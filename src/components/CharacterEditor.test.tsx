/**
 * Tests for CharacterEditor Component
 * F029: Character creation
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CharacterEditor } from "./CharacterEditor";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";

describe("CharacterEditor", () => {
  describe("Rendering", () => {
    it("should render in create mode", () => {
      render(<CharacterEditor />);

      expect(screen.getByRole("form")).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create character/i })).toBeInTheDocument();
    });

    it("should render in edit mode", () => {
      const character: ScriptDocCharacter = {
        id: "char1",
        name: "John Doe",
        description: "A detective",
        tags: [],
        referenceAssetIds: [],
      };

      render(<CharacterEditor character={character} />);

      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
    });

    it("should show title when showTitle is true", () => {
      render(<CharacterEditor showTitle />);

      expect(screen.getByText("New Character")).toBeInTheDocument();
    });

    it("should show character name in title when editing", () => {
      const character: ScriptDocCharacter = {
        id: "char1",
        name: "Jane Smith",
        tags: [],
        referenceAssetIds: [],
      };

      render(<CharacterEditor character={character} showTitle />);

      expect(screen.getByText("Edit Jane Smith")).toBeInTheDocument();
    });

    it("should render all form fields", () => {
      render(<CharacterEditor />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/pronouns/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/archetype/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/goal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/character arc/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/voice notes/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/additional notes/i)).toBeInTheDocument();
    });

    it("should show cancel button when onCancel is provided", () => {
      const onCancel = vi.fn();
      render(<CharacterEditor onCancel={onCancel} />);

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("should not show cancel button when onCancel is not provided", () => {
      render(<CharacterEditor />);

      expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe("Form Input", () => {
    it("should update name field", () => {
      render(<CharacterEditor />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Alice" } });

      expect(nameInput).toHaveValue("Alice");
    });

    it("should update description field", () => {
      render(<CharacterEditor />);

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "A brave hero" } });

      expect(descInput).toHaveValue("A brave hero");
    });

    it("should update pronouns field", () => {
      render(<CharacterEditor />);

      const pronounsInput = screen.getByLabelText(/pronouns/i);
      fireEvent.change(pronounsInput, { target: { value: "she/her" } });

      expect(pronounsInput).toHaveValue("she/her");
    });

    it("should update archetype field", () => {
      render(<CharacterEditor />);

      const archetypeInput = screen.getByLabelText(/archetype/i);
      fireEvent.change(archetypeInput, { target: { value: "Hero" } });

      expect(archetypeInput).toHaveValue("Hero");
    });

    it("should update goal field", () => {
      render(<CharacterEditor />);

      const goalInput = screen.getByLabelText(/goal/i);
      fireEvent.change(goalInput, { target: { value: "Save the world" } });

      expect(goalInput).toHaveValue("Save the world");
    });

    it("should show character count for description", () => {
      render(<CharacterEditor />);

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "Test" } });

      expect(screen.getByText("4/1000 characters")).toBeInTheDocument();
    });

    it("should show character count for goal", () => {
      render(<CharacterEditor />);

      const goalInput = screen.getByLabelText(/goal/i);
      fireEvent.change(goalInput, { target: { value: "Test goal" } });

      expect(screen.getByText("9/500 characters")).toBeInTheDocument();
    });
  });

  describe("Loading Existing Character", () => {
    it("should populate form with character data", () => {
      const character: ScriptDocCharacter = {
        id: "char1",
        name: "Bob",
        description: "A villain",
        pronouns: "he/him",
        archetype: "Antagonist",
        goal: "Conquer the world",
        arc: "Downfall",
        voiceNotes: "Deep voice",
        notes: "Based on classic villains",
        tags: ["antagonist", "villain"],
        referenceAssetIds: [],
      };

      render(<CharacterEditor character={character} />);

      expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
      expect(screen.getByDisplayValue("A villain")).toBeInTheDocument();
      expect(screen.getByDisplayValue("he/him")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Antagonist")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Conquer the world")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Downfall")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Deep voice")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Based on classic villains")).toBeInTheDocument();
      expect(screen.getByDisplayValue("antagonist, villain")).toBeInTheDocument();
    });

    it("should handle empty optional fields", () => {
      const character: ScriptDocCharacter = {
        id: "char1",
        name: "Minimal",
        tags: [],
        referenceAssetIds: [],
      };

      render(<CharacterEditor character={character} />);

      expect(screen.getByDisplayValue("Minimal")).toBeInTheDocument();
      // Optional fields should be empty
      expect(screen.getByLabelText(/description/i)).toHaveValue("");
      expect(screen.getByLabelText(/pronouns/i)).toHaveValue("");
    });
  });

  describe("Validation", () => {
    it("should show error when name is empty", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/character name is required/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error when name is too long", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "A".repeat(101) } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/name must be 100 characters or less/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error when description is too long", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Valid Name" } });

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "A".repeat(1001) } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/description must be 1000 characters or less/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show multiple errors", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "A".repeat(1001) } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/character name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description must be 1000 characters or less/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should clear errors after valid input", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/character name is required/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Valid Name" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });
  });

  describe("Saving", () => {
    it("should call onSave with new character data", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "New Character" } });

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "Test description" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const savedCharacter = onSave.mock.calls[0][0];
      expect(savedCharacter).toMatchObject({
        id: expect.any(String),
        name: "New Character",
        description: "Test description",
      });
    });

    it("should call onSave with updated character data", async () => {
      const character: ScriptDocCharacter = {
        id: "char1",
        name: "Original Name",
        description: "Original description",
        tags: [],
        referenceAssetIds: [],
      };

      const onSave = vi.fn();
      render(<CharacterEditor character={character} onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Updated Name" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const savedCharacter = onSave.mock.calls[0][0];
      expect(savedCharacter).toMatchObject({
        id: "char1",
        name: "Updated Name",
        description: "Original description",
      });
    });

    it("should trim whitespace from inputs", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "  Trimmed  " } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const savedCharacter = onSave.mock.calls[0][0];
      expect(savedCharacter.name).toBe("Trimmed");
    });

    it("should parse tags from comma-separated string", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      const tagsInput = screen.getByLabelText(/tags/i);
      fireEvent.change(tagsInput, { target: { value: "tag1, tag2, tag3" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const savedCharacter = onSave.mock.calls[0][0];
      expect(savedCharacter.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should filter empty tags", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      const tagsInput = screen.getByLabelText(/tags/i);
      fireEvent.change(tagsInput, { target: { value: "tag1, , tag2,  , tag3" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const savedCharacter = onSave.mock.calls[0][0];
      expect(savedCharacter.tags).toEqual(["tag1", "tag2", "tag3"]);
    });
  });

  describe("Cancel", () => {
    it("should call onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(<CharacterEditor onCancel={onCancel} />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should disable all inputs when disabled is true", () => {
      render(<CharacterEditor disabled />);

      expect(screen.getByLabelText(/name/i)).toBeDisabled();
      expect(screen.getByLabelText(/description/i)).toBeDisabled();
      expect(screen.getByLabelText(/pronouns/i)).toBeDisabled();
      expect(screen.getByLabelText(/archetype/i)).toBeDisabled();
      expect(screen.getByLabelText(/goal/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /create character/i })).toBeDisabled();
    });

    it("should disable cancel button when disabled is true", () => {
      const onCancel = vi.fn();
      render(<CharacterEditor onCancel={onCancel} disabled />);

      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<CharacterEditor />);

      expect(screen.getByRole("form")).toHaveAccessibleName(/create character/i);
      expect(screen.getByLabelText(/name/i)).toHaveAttribute("aria-required", "true");
    });

    it("should show error alert with proper ARIA", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "polite");
      });
    });
  });

  // F029 Acceptance Criteria Tests
  describe("F029 Acceptance Criteria", () => {
    it("should create character with name", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test Character" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const character = onSave.mock.calls[0][0];
      expect(character.name).toBe("Test Character");
    });

    it("should create character with description", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "Test description" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const character = onSave.mock.calls[0][0];
      expect(character.description).toBe("Test description");
    });

    it("should create character with goals", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      const goalInput = screen.getByLabelText(/goal/i);
      fireEvent.change(goalInput, { target: { value: "Test goal" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const character = onSave.mock.calls[0][0];
      expect(character.goal).toBe("Test goal");
    });

    it("should create character ready to save to DB", async () => {
      const onSave = vi.fn();
      render(<CharacterEditor onSave={onSave} />);

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "DB Test" } });

      const saveButton = screen.getByRole("button", { name: /create character/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      const character = onSave.mock.calls[0][0];
      // Character should have all required fields for ScriptDoc schema
      expect(character).toHaveProperty("id");
      expect(character).toHaveProperty("name");
      expect(character).toHaveProperty("tags");
      expect(character).toHaveProperty("referenceAssetIds");
    });
  });
});
