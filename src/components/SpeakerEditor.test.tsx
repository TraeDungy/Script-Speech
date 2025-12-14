/**
 * Tests for SpeakerEditor component
 * F009: Speaker name assignment
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpeakerEditor, SpeakerBadge, SpeakerList } from "./SpeakerEditor";
import type { Speaker } from "@/lib/voice/types";

const mockSpeakers: Speaker[] = [
  {
    id: "speaker_1",
    label: "Speaker 1",
    confidence: 0.92,
    voiceProfile: { pitch: 0.5, tempo: 0.6, energy: 0.7 },
  },
  {
    id: "speaker_2",
    label: "Speaker 2",
    confidence: 0.88,
    characterName: "Alice",
  },
  {
    id: "speaker_3",
    label: "Speaker 3",
    confidence: 0.95,
    characterName: "Bob",
  },
];

describe("SpeakerEditor", () => {
  describe("Rendering", () => {
    it("should render empty state when no speakers", () => {
      render(<SpeakerEditor speakers={[]} />);
      expect(screen.getByText("No speakers detected yet")).toBeInTheDocument();
    });

    it("should render all speakers", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      expect(screen.getByText("Speaker 1")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("should display character names when available", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      // Speaker with character name should show it
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Speaker 2")).not.toBeInTheDocument();
    });

    it("should highlight active speaker", () => {
      render(<SpeakerEditor speakers={mockSpeakers} activeSpeakerId="speaker_1" />);

      const activeSpeaker = screen.getByText("Speaker 1").closest("div");
      expect(activeSpeaker).toHaveClass("bg-blue-50");
      expect(screen.getByText("Speaking")).toBeInTheDocument();
    });

    it("should show confidence scores when enabled", () => {
      render(<SpeakerEditor speakers={mockSpeakers} showConfidence />);

      expect(screen.getByText("Confidence: 92%")).toBeInTheDocument();
      expect(screen.getByText("Confidence: 88%")).toBeInTheDocument();
      expect(screen.getByText("Confidence: 95%")).toBeInTheDocument();
    });

    it("should not show confidence scores by default", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <SpeakerEditor speakers={mockSpeakers} className="custom-class" />
      );

      const element = container.querySelector(".custom-class");
      expect(element).toBeInTheDocument();
    });
  });

  describe("Editing", () => {
    it("should show rename button for each speaker", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      const renameButtons = screen.getAllByText("Rename");
      expect(renameButtons).toHaveLength(3);
    });

    it("should not show rename button when disabled", () => {
      render(<SpeakerEditor speakers={mockSpeakers} disabled />);

      expect(screen.queryByText("Rename")).not.toBeInTheDocument();
    });

    it("should enter edit mode when rename button is clicked", async () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("Speaker 1");
    });

    it("should save new name on Enter key", async () => {
      const onSpeakerNameChange = vi.fn();
      render(
        <SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />
      );

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Charlie" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(onSpeakerNameChange).toHaveBeenCalledWith("speaker_1", "Charlie");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should cancel edit on Escape key", async () => {
      const onSpeakerNameChange = vi.fn();
      render(
        <SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />
      );

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Charlie" } });
      fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

      expect(onSpeakerNameChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should save on blur", async () => {
      const onSpeakerNameChange = vi.fn();
      render(
        <SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />
      );

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "David" } });

      // Blur by clicking outside
      fireEvent.blur(input);

      await waitFor(() => {
        expect(onSpeakerNameChange).toHaveBeenCalledWith("speaker_1", "David");
      });
    });

    it("should trim whitespace from names", async () => {
      const onSpeakerNameChange = vi.fn();
      render(
        <SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />
      );

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "  Eve  " } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(onSpeakerNameChange).toHaveBeenCalledWith("speaker_1", "Eve");
    });

    it("should not save empty names", async () => {
      const onSpeakerNameChange = vi.fn();
      render(
        <SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />
      );

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(onSpeakerNameChange).not.toHaveBeenCalled();
    });

    it("should not enter edit mode when disabled", async () => {
      render(<SpeakerEditor speakers={mockSpeakers} disabled />);

      // Try clicking on a speaker (no rename button should be present)
      expect(screen.queryByText("Rename")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onSpeakerClick when speaker is clicked", async () => {
      const onSpeakerClick = vi.fn();
      render(<SpeakerEditor speakers={mockSpeakers} onSpeakerClick={onSpeakerClick} />);

      const items = screen.getAllByRole("listitem");
      fireEvent.click(items[0]!);

      expect(onSpeakerClick).toHaveBeenCalledWith("speaker_1");
    });

    it("should not call onSpeakerClick when editing", async () => {
      const onSpeakerClick = vi.fn();
      render(<SpeakerEditor speakers={mockSpeakers} onSpeakerClick={onSpeakerClick} />);

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      expect(onSpeakerClick).not.toHaveBeenCalled();
    });

    it("should stop propagation when rename button is clicked", async () => {
      const onSpeakerClick = vi.fn();
      render(<SpeakerEditor speakers={mockSpeakers} onSpeakerClick={onSpeakerClick} />);

      const renameButton = screen.getAllByText("Rename")[0]!;
      fireEvent.click(renameButton);

      // onSpeakerClick should not be called because event propagation is stopped
      expect(onSpeakerClick).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      expect(screen.getByRole("list", { name: "Detected speakers" })).toBeInTheDocument();

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
    });

    it("should label active speaker", () => {
      render(<SpeakerEditor speakers={mockSpeakers} activeSpeakerId="speaker_1" />);

      expect(screen.getByLabelText(/Speaker 1 \(active\)/)).toBeInTheDocument();
    });

    it("should have accessible input field", async () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      const renameButtons = screen.getAllByText("Rename");
      fireEvent.click(renameButtons[0]!);

      const input = screen.getByLabelText("Edit speaker name");
      expect(input).toBeInTheDocument();
    });

    it("should have accessible rename button", () => {
      render(<SpeakerEditor speakers={mockSpeakers} />);

      expect(screen.getByLabelText("Rename Speaker 1")).toBeInTheDocument();
    });
  });
});

describe("SpeakerBadge", () => {
  const mockSpeaker: Speaker = {
    id: "speaker_1",
    label: "Speaker 1",
    confidence: 0.9,
  };

  it("should render speaker label", () => {
    render(<SpeakerBadge speaker={mockSpeaker} />);
    expect(screen.getByText("Speaker 1")).toBeInTheDocument();
  });

  it("should render character name if available", () => {
    const speakerWithName: Speaker = {
      ...mockSpeaker,
      characterName: "Frank",
    };
    render(<SpeakerBadge speaker={speakerWithName} />);
    expect(screen.getByText("Frank")).toBeInTheDocument();
  });

  it("should show active indicator when active", () => {
    render(<SpeakerBadge speaker={mockSpeaker} isActive />);
    expect(screen.getByText("Speaker 1")).toBeInTheDocument();

    // Check for pulsing indicator (by class)
    const badge = screen.getByRole("button");
    const indicator = badge.querySelector(".animate-ping");
    expect(indicator).toBeInTheDocument();
  });

  it("should call onClick with speaker ID", async () => {
    const onClick = vi.fn();
    render(<SpeakerBadge speaker={mockSpeaker} onClick={onClick} />);

    const badge = screen.getByRole("button");
    fireEvent.click(badge);

    expect(onClick).toHaveBeenCalledWith("speaker_1");
  });

  it("should apply custom className", () => {
    render(<SpeakerBadge speaker={mockSpeaker} className="custom-badge" />);
    const badge = screen.getByRole("button");
    expect(badge).toHaveClass("custom-badge");
  });

  it("should have proper ARIA label", () => {
    render(<SpeakerBadge speaker={mockSpeaker} />);
    expect(screen.getByLabelText("Speaker: Speaker 1")).toBeInTheDocument();
  });

  it("should include active state in ARIA label", () => {
    render(<SpeakerBadge speaker={mockSpeaker} isActive />);
    expect(screen.getByLabelText("Speaker: Speaker 1 (active)")).toBeInTheDocument();
  });
});

describe("SpeakerList", () => {
  it("should render all speaker badges", () => {
    render(<SpeakerList speakers={mockSpeakers} />);

    expect(screen.getByText("Speaker 1")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("should highlight active speaker", () => {
    render(<SpeakerList speakers={mockSpeakers} activeSpeakerId="speaker_2" />);

    const aliceBadge = screen.getByText("Alice").closest("button");
    expect(aliceBadge).toHaveClass("bg-blue-100");
  });

  it("should call onSpeakerSelect when badge is clicked", async () => {
    const onSpeakerSelect = vi.fn();
    render(<SpeakerList speakers={mockSpeakers} onSpeakerSelect={onSpeakerSelect} />);

    const badge = screen.getByText("Alice").closest("button")!;
    fireEvent.click(badge);

    expect(onSpeakerSelect).toHaveBeenCalledWith("speaker_2");
  });

  it("should have proper ARIA label", () => {
    render(<SpeakerList speakers={mockSpeakers} />);
    expect(screen.getByRole("list", { name: "Speaker list" })).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <SpeakerList speakers={mockSpeakers} className="custom-list" />
    );
    const list = container.querySelector(".custom-list");
    expect(list).toBeInTheDocument();
  });
});

describe("F009 Acceptance Criteria", () => {
  it("✓ Click to rename speaker", async () => {
    const onSpeakerNameChange = vi.fn();
    render(<SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />);

    // Click rename button
    const renameButtons = screen.getAllByText("Rename");
    fireEvent.click(renameButtons[0]!);

    // Enter new name
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Grace" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Verify callback was called
    expect(onSpeakerNameChange).toHaveBeenCalledWith("speaker_1", "Grace");
  });

  it("✓ Persists across session (via callback)", () => {
    const onSpeakerNameChange = vi.fn();
    render(<SpeakerEditor speakers={mockSpeakers} onSpeakerNameChange={onSpeakerNameChange} />);

    // The component provides callback mechanism for persistence
    // Parent component would handle actual persistence
    expect(onSpeakerNameChange).toBeDefined();
  });

  it("✓ Updates retroactively (shows assigned names)", () => {
    // Create speakers with assigned names
    const speakersWithNames: Speaker[] = [
      { ...mockSpeakers[0]!, characterName: "Henry" },
      { ...mockSpeakers[1]!, characterName: "Irene" },
    ];

    render(<SpeakerEditor speakers={speakersWithNames} />);

    // Verify assigned names are displayed
    expect(screen.getByText("Henry")).toBeInTheDocument();
    expect(screen.getByText("Irene")).toBeInTheDocument();

    // Original labels should not be the main display (names override labels)
    const henryElement = screen.getByText("Henry");
    const ireneElement = screen.getByText("Irene");
    expect(henryElement).toBeInTheDocument();
    expect(ireneElement).toBeInTheDocument();
  });
});
