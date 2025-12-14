/**
 * Tests for CharacterList Component
 * F030: Character list view
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CharacterList, CharacterBadge } from "./CharacterList";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";

describe("CharacterList", () => {
  const mockCharacters: ScriptDocCharacter[] = [
    {
      id: "char1",
      name: "Charlie",
      archetype: "Protagonist",
      tags: ["hero", "brave"],
      referenceAssetIds: [],
    },
    {
      id: "char2",
      name: "Alice",
      archetype: "Mentor",
      tags: ["wise"],
      referenceAssetIds: [],
    },
    {
      id: "char3",
      name: "Bob",
      archetype: "Antagonist",
      tags: ["villain", "cunning"],
      referenceAssetIds: [],
    },
  ];

  beforeEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render with characters", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("should display character count", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("3 characters")).toBeInTheDocument();
    });

    it("should show empty state when no characters", () => {
      render(<CharacterList characters={[]} />);

      expect(screen.getByText("No characters yet")).toBeInTheDocument();
    });

    it("should render search input by default", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByPlaceholderText("Search characters...")).toBeInTheDocument();
    });

    it("should render add button by default", () => {
      const onAdd = vi.fn();
      render(<CharacterList characters={mockCharacters} onAddCharacter={onAdd} />);

      expect(screen.getByText("Add Character")).toBeInTheDocument();
    });

    it("should not show search when showSearch is false", () => {
      render(<CharacterList characters={mockCharacters} showSearch={false} />);

      expect(screen.queryByPlaceholderText("Search characters...")).not.toBeInTheDocument();
    });

    it("should not show add button when showAddButton is false", () => {
      const onAdd = vi.fn();
      render(
        <CharacterList
          characters={mockCharacters}
          onAddCharacter={onAdd}
          showAddButton={false}
        />
      );

      expect(screen.queryByText("Add Character")).not.toBeInTheDocument();
    });

    it("should show character archetype", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("Protagonist")).toBeInTheDocument();
      expect(screen.getByText("Mentor")).toBeInTheDocument();
      expect(screen.getByText("Antagonist")).toBeInTheDocument();
    });

    it("should show character tags", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("hero")).toBeInTheDocument();
      expect(screen.getByText("brave")).toBeInTheDocument();
      expect(screen.getByText("wise")).toBeInTheDocument();
    });
  });

  describe("Sorting", () => {
    it("should sort characters alphabetically by name", () => {
      const { container } = render(<CharacterList characters={mockCharacters} />);

      const names = Array.from(container.querySelectorAll("h3")).map((el) =>
        el.textContent?.trim()
      );

      expect(names).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe("Search", () => {
    it("should filter characters by search query", () => {
      render(<CharacterList characters={mockCharacters} />);

      const searchInput = screen.getByPlaceholderText("Search characters...");
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    });

    it("should update character count when filtering", () => {
      render(<CharacterList characters={mockCharacters} />);

      const searchInput = screen.getByPlaceholderText("Search characters...");
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Showing 1 of 3 characters")).toBeInTheDocument();
    });

    it("should show empty state for no search results", () => {
      render(<CharacterList characters={mockCharacters} />);

      const searchInput = screen.getByPlaceholderText("Search characters...");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      expect(screen.getByText("No characters found matching your search")).toBeInTheDocument();
    });

    it("should search by archetype", () => {
      render(<CharacterList characters={mockCharacters} />);

      const searchInput = screen.getByPlaceholderText("Search characters...");
      fireEvent.change(searchInput, { target: { value: "protagonist" } });

      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("should call onCharacterClick when character is clicked", () => {
      const onClick = vi.fn();
      render(<CharacterList characters={mockCharacters} onCharacterClick={onClick} />);

      fireEvent.click(screen.getByText("Alice"));

      expect(onClick).toHaveBeenCalledWith(mockCharacters[1]);
    });

    it("should call onAddCharacter when add button is clicked", () => {
      const onAdd = vi.fn();
      render(<CharacterList characters={mockCharacters} onAddCharacter={onAdd} />);

      fireEvent.click(screen.getByText("Add Character"));

      expect(onAdd).toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should disable search input when disabled", () => {
      render(<CharacterList characters={mockCharacters} disabled />);

      expect(screen.getByPlaceholderText("Search characters...")).toBeDisabled();
    });

    it("should disable character click when disabled", () => {
      const onClick = vi.fn();
      render(<CharacterList characters={mockCharacters} onCharacterClick={onClick} disabled />);

      const characterButton = screen.getByLabelText("Edit Alice");
      expect(characterButton).toBeDisabled();
    });
  });

  describe("F030 Acceptance Criteria", () => {
    it("should show character names", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("should show character roles", () => {
      render(<CharacterList characters={mockCharacters} />);

      expect(screen.getByText("Protagonist")).toBeInTheDocument();
      expect(screen.getByText("Mentor")).toBeInTheDocument();
      expect(screen.getByText("Antagonist")).toBeInTheDocument();
    });

    it("should have working search", () => {
      render(<CharacterList characters={mockCharacters} />);

      const searchInput = screen.getByPlaceholderText("Search characters...");
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    it("should be clickable to edit", () => {
      const onClick = vi.fn();
      render(<CharacterList characters={mockCharacters} onCharacterClick={onClick} />);

      fireEvent.click(screen.getByLabelText("Edit Alice"));

      expect(onClick).toHaveBeenCalled();
    });

    it("should be sorted alphabetically", () => {
      const { container } = render(<CharacterList characters={mockCharacters} />);

      const names = Array.from(container.querySelectorAll("h3")).map((el) => el.textContent?.trim());

      expect(names).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });
});

describe("CharacterBadge", () => {
  const mockCharacter: ScriptDocCharacter = {
    id: "char1",
    name: "Test Character",
    tags: [],
    referenceAssetIds: [],
  };

  it("should render character name", () => {
    render(<CharacterBadge character={mockCharacter} />);

    expect(screen.getByText("Test Character")).toBeInTheDocument();
  });

  it("should be clickable when onClick is provided", () => {
    const onClick = vi.fn();
    render(<CharacterBadge character={mockCharacter} onClick={onClick} />);

    fireEvent.click(screen.getByText("Test Character"));

    expect(onClick).toHaveBeenCalled();
  });

  it("should not be clickable when onClick is not provided", () => {
    const { container } = render(<CharacterBadge character={mockCharacter} />);

    const badge = screen.getByText("Test Character");
    expect(badge.tagName).toBe("SPAN");
  });
});
