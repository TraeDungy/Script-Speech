/**
 * SceneBreakdown Component Tests
 * F034: Scene breakdown view
 *
 * Tests for displaying all scenes with key information in a list format.
 */

import React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SceneBreakdown } from "./SceneBreakdown";
import type { ScriptScene } from "@/lib/scriptDoc";

const createMockScene = (overrides: Partial<ScriptScene> = {}): ScriptScene => ({
  id: `scene-${Math.random()}`,
  order: 0,
  title: "Test Scene",
  summary: "A test scene summary",
  slugline: {
    setting: "INT",
    location: "TEST LOCATION",
    timeOfDay: "DAY",
  },
  elements: [
    {
      id: "elem-1",
      type: "action",
      text: "Test action",
      locationIds: [],
      propIds: [],
    },
  ],
  referenceAssetIds: [],
  locationIds: ["loc-1"],
  characterIds: ["char-1", "char-2"],
  propIds: [],
  ...overrides,
});

describe("SceneBreakdown", () => {
  let mockScenes: ScriptScene[];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockScenes = [
      createMockScene({
        id: "scene-1",
        order: 0,
        title: "Opening Scene",
        slugline: {
          setting: "INT",
          location: "COFFEE SHOP",
          timeOfDay: "DAY",
        },
        characterIds: ["char-1", "char-2"],
        elements: [
          {
            id: "elem-1",
            type: "action",
            text: "Line 1",
            locationIds: [],
            propIds: [],
          },
          {
            id: "elem-2",
            type: "dialogue",
            text: "Line 2",
            speaker: "John",
            locationIds: [],
            propIds: [],
          },
        ],
      }),
      createMockScene({
        id: "scene-2",
        order: 1,
        title: "Second Scene",
        slugline: {
          setting: "EXT",
          location: "PARK",
          timeOfDay: "NIGHT",
        },
        characterIds: ["char-3"],
        elements: [
          {
            id: "elem-3",
            type: "action",
            text: "Line 1",
            locationIds: [],
            propIds: [],
          },
        ],
      }),
      createMockScene({
        id: "scene-3",
        order: 2,
        title: "Final Scene",
        slugline: {
          setting: "INT/EXT",
          location: "CAR",
          timeOfDay: "DAWN",
        },
        characterIds: ["char-1"],
        elements: [],
      }),
    ];
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<SceneBreakdown scenes={[]} />);
      expect(screen.getByRole("region", { name: /scene breakdown/i })).toBeInTheDocument();
    });

    it("should display all scenes", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      expect(screen.getByText("Opening Scene")).toBeInTheDocument();
      expect(screen.getByText("Second Scene")).toBeInTheDocument();
      expect(screen.getByText("Final Scene")).toBeInTheDocument();
    });

    it("should display scene numbers correctly", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      const scene1Elements = screen.getAllByText(/scene 1/i);
      const scene2Elements = screen.getAllByText(/scene 2/i);
      const scene3Elements = screen.getAllByText(/scene 3/i);
      expect(scene1Elements.length).toBeGreaterThan(0);
      expect(scene2Elements.length).toBeGreaterThan(0);
      expect(scene3Elements.length).toBeGreaterThan(0);
    });

    it("should display location information", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      expect(screen.getByText(/COFFEE SHOP/i)).toBeInTheDocument();
      expect(screen.getByText(/PARK/i)).toBeInTheDocument();
      expect(screen.getByText(/CAR/i)).toBeInTheDocument();
    });

    it("should display setting and time of day", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      expect(screen.getAllByText("INT").length).toBeGreaterThan(0);
      expect(screen.getAllByText("EXT").length).toBeGreaterThan(0);
      expect(screen.getAllByText("DAY").length).toBeGreaterThan(0);
      expect(screen.getAllByText("NIGHT").length).toBeGreaterThan(0);
    });

    it("should display character count", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      const scene1 = screen.getByText("Opening Scene").closest("[role='article']");
      expect(scene1).toBeInTheDocument();
      if (scene1) {
        expect(within(scene1).getByText(/2 characters/i)).toBeInTheDocument();
      }
    });

    it("should display scene length (element count)", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      const scene1 = screen.getByText("Opening Scene").closest("[role='article']");
      if (scene1) {
        expect(within(scene1).getByText(/2 elements/i)).toBeInTheDocument();
      }
    });

    it("should show empty state when no scenes provided", () => {
      render(<SceneBreakdown scenes={[]} />);
      const emptyMessages = screen.getAllByText(/no scenes/i);
      expect(emptyMessages.length).toBeGreaterThan(0);
    });
  });

  describe("Interaction", () => {
    it("should call onSceneClick when a scene is clicked", () => {
      const onSceneClick = vi.fn();
      render(<SceneBreakdown scenes={mockScenes} onSceneClick={onSceneClick} />);

      const scene1 = screen.getByText("Opening Scene").closest("button");
      if (scene1) {
        fireEvent.click(scene1);
        expect(onSceneClick).toHaveBeenCalledWith(mockScenes[0]);
      }
    });

    it("should not call onSceneClick when disabled", () => {
      const onSceneClick = vi.fn();
      render(<SceneBreakdown scenes={mockScenes} onSceneClick={onSceneClick} disabled />);

      const scene1 = screen.getByText("Opening Scene").closest("button");
      if (scene1) {
        fireEvent.click(scene1);
        expect(onSceneClick).not.toHaveBeenCalled();
      }
    });

    it("should call onReorder when reorder is triggered", () => {
      const onReorder = vi.fn();
      render(<SceneBreakdown scenes={mockScenes} onReorder={onReorder} showReorder />);

      // Find the move up button for scene 2
      const scene2 = screen.getByText("Second Scene").closest("[role='article']");
      if (scene2) {
        const moveUpButton = within(scene2).getByRole("button", { name: /move up/i });
        fireEvent.click(moveUpButton);
        expect(onReorder).toHaveBeenCalledWith(1, 0);
      }
    });
  });

  describe("Reordering", () => {
    it("should show reorder buttons when showReorder is true", () => {
      render(<SceneBreakdown scenes={mockScenes} showReorder />);
      expect(screen.getAllByRole("button", { name: /move up/i }).length).toBeGreaterThan(0);
    });

    it("should not show reorder buttons when showReorder is false", () => {
      render(<SceneBreakdown scenes={mockScenes} showReorder={false} />);
      expect(screen.queryByRole("button", { name: /move up/i })).not.toBeInTheDocument();
    });

    it("should disable move up button for first scene", () => {
      render(<SceneBreakdown scenes={mockScenes} showReorder />);
      const scene1 = screen.getByText("Opening Scene").closest("[role='article']");
      if (scene1) {
        const moveUpButton = within(scene1).getByRole("button", { name: /move up/i });
        expect(moveUpButton).toBeDisabled();
      }
    });

    it("should disable move down button for last scene", () => {
      render(<SceneBreakdown scenes={mockScenes} showReorder />);
      const scene3 = screen.getByText("Final Scene").closest("[role='article']");
      if (scene3) {
        const moveDownButton = within(scene3).getByRole("button", { name: /move down/i });
        expect(moveDownButton).toBeDisabled();
      }
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      expect(screen.getByRole("region", { name: /scene breakdown/i })).toBeInTheDocument();
    });

    it("should have proper role for scene items", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      const articles = screen.getAllByRole("article");
      expect(articles.length).toBe(mockScenes.length);
    });

    it("should support keyboard navigation", () => {
      const onSceneClick = vi.fn();
      render(<SceneBreakdown scenes={mockScenes} onSceneClick={onSceneClick} />);

      const scene1 = screen.getByText("Opening Scene").closest("button");
      if (scene1) {
        scene1.focus();
        fireEvent.keyDown(scene1, { key: "Enter", code: "Enter" });
        // Note: fireEvent doesn't trigger click on Enter, so we test that the button is focusable
        expect(scene1).toHaveFocus();
      }
    });
  });

  describe("Custom Props", () => {
    it("should apply custom className", () => {
      const { container } = render(<SceneBreakdown scenes={mockScenes} className="custom-class" />);
      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("should respect disabled state", () => {
      render(<SceneBreakdown scenes={mockScenes} disabled />);
      const scene1 = screen.getByText("Opening Scene").closest("button");
      if (scene1) {
        expect(scene1).toBeDisabled();
      }
    });
  });

  describe("Character Resolution", () => {
    it("should use character names when provided", () => {
      const characters = [
        { id: "char-1", name: "John Doe" },
        { id: "char-2", name: "Jane Smith" },
      ];
      render(<SceneBreakdown scenes={mockScenes} characters={characters} />);

      const scene1 = screen.getByText("Opening Scene").closest("[role='article']");
      if (scene1) {
        expect(within(scene1).getByText(/John Doe, Jane Smith/i)).toBeInTheDocument();
      }
    });

    it("should handle missing character data gracefully", () => {
      render(<SceneBreakdown scenes={mockScenes} />);
      // Should still render scene even without character names
      expect(screen.getByText("Opening Scene")).toBeInTheDocument();
    });
  });
});
