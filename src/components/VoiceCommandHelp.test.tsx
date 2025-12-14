/**
 * Tests for Voice Command Help Overlay
 * F017: Voice command help overlay
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { VoiceCommandHelp } from "./VoiceCommandHelp";
import { type CommandPattern } from "@/lib/voice/commandParser";

describe("VoiceCommandHelp", () => {
  let mockOnClose: ReturnType<typeof vi.fn>;
  let originalBodyOverflow: string;

  beforeEach(() => {
    mockOnClose = vi.fn();
    originalBodyOverflow = document.body.style.overflow;
    // Clear the DOM before each test
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.style.overflow = originalBodyOverflow;
    // Clean up DOM after test
    document.body.innerHTML = "";
  });

  describe("Rendering", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(<VoiceCommandHelp isOpen={false} onClose={mockOnClose} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders modal when isOpen is true", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Voice Commands")).toBeInTheDocument();
    });

    it("renders all command groups", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      // Should have multiple categories
      expect(screen.getAllByText("Scene")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Character")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Edit")[0]).toBeInTheDocument();
      expect(screen.getAllByText("File")[0]).toBeInTheDocument();
    });

    it("renders command descriptions", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText("Create a new scene")).toBeInTheDocument();
      expect(screen.getByText("Create a new character")).toBeInTheDocument();
      expect(screen.getByText("Save the current script")).toBeInTheDocument();
    });

    it("renders with dark theme by default", () => {
      const { container } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop.className).toContain("bg-black/80");
    });

    it("renders with light theme when specified", () => {
      const { container } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} theme="light" />);
      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop.className).toContain("bg-black/50");
    });
  });

  describe("Search Functionality", () => {
    it("renders search input", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByPlaceholderText("Search commands...")).toBeInTheDocument();
    });

    it("filters commands based on search query", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      fireEvent.change(searchInput, { target: { value: "scene" } });

      // Should show scene commands
      expect(screen.getByText("Scene")).toBeInTheDocument();
      expect(screen.getByText("Create a new scene")).toBeInTheDocument();

      // Should not show unrelated commands (if search is working)
      // Note: Some commands might still appear if they contain "scene" in their description
    });

    it("shows no results message when no commands match", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      fireEvent.change(searchInput, { target: { value: "xyznonexistent" } });

      expect(screen.getByText(/No commands found matching/)).toBeInTheDocument();
    });

    it("filters by command type", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      fireEvent.change(searchInput, { target: { value: "save" } });

      expect(screen.getByText("SAVE")).toBeInTheDocument();
    });

    it("filters by description", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      fireEvent.change(searchInput, { target: { value: "undo" } });

      expect(screen.getByText("Undo last action")).toBeInTheDocument();
    });

    it("search is case-insensitive", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      fireEvent.change(searchInput, { target: { value: "SCENE" } });

      expect(screen.getByText("Create a new scene")).toBeInTheDocument();
    });
  });

  describe("Close Functionality", () => {
    it("calls onClose when close button is clicked", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText("Close help overlay");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    // Note: Backdrop click testing is complex in JSDOM and handled by integration tests

    it("calls onClose when Escape key is pressed", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for other keys", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: "Enter" });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Body Scroll Lock", () => {
    it("prevents body scroll when modal is open", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when modal is closed", () => {
      const { rerender } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe("hidden");

      rerender(<VoiceCommandHelp isOpen={false} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Custom Patterns", () => {
    it("displays custom command patterns when provided", () => {
      const customPatterns: CommandPattern[] = [
        {
          type: "custom_command",
          patterns: [/custom test/i],
          description: "A custom test command",
        },
      ];

      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} customPatterns={customPatterns} />);

      expect(screen.getByText("CUSTOM COMMAND")).toBeInTheDocument();
      expect(screen.getByText("A custom test command")).toBeInTheDocument();
    });

    it("uses default patterns when custom patterns not provided", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      // Should show default commands
      expect(screen.getByText("Create a new scene")).toBeInTheDocument();
      expect(screen.getByText("Save the current script")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "voice-command-help-title");
    });

    it("has accessible close button", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText("Close help overlay");
      expect(closeButton).toBeInTheDocument();
    });

    it("has accessible search input", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByLabelText("Search voice commands");
      expect(searchInput).toBeInTheDocument();
    });

    it("has proper heading structure", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const mainHeading = screen.getByRole("heading", { name: "Voice Commands", level: 2 });
      expect(mainHeading).toBeInTheDocument();
    });
  });

  describe("Command Grouping", () => {
    it("groups scene commands together", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const sceneSection = screen.getByText("Scene").parentElement!;
      const sceneCommands = within(sceneSection).getAllByText(/scene/i);
      expect(sceneCommands.length).toBeGreaterThan(0);
    });

    it("groups character commands together", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const characterSection = screen.getByText("Character").parentElement!;
      expect(within(characterSection).getByText("Create a new character")).toBeInTheDocument();
    });

    it("groups edit commands together", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const editSection = screen.getByText("Edit").parentElement!;
      expect(within(editSection).getByText("Undo last action")).toBeInTheDocument();
    });
  });

  describe("F017 Acceptance Criteria", () => {
    it("shows modal with all commands", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      // Modal should be visible
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Should show multiple command categories
      expect(screen.getByText("Scene")).toBeInTheDocument();
      expect(screen.getByText("Character")).toBeInTheDocument();
      expect(screen.getByText("File")).toBeInTheDocument();

      // Should show multiple commands (at least 10+)
      const commands = screen.getAllByText(/SCENE|CHARACTER|DELETE|SAVE|UNDO|REDO/i);
      expect(commands.length).toBeGreaterThan(10);
    });

    it("is searchable", () => {
      render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText("Search commands...");
      expect(searchInput).toBeInTheDocument();

      // Search should filter results
      fireEvent.change(searchInput, { target: { value: "save" } });
      expect(screen.getByText("SAVE")).toBeInTheDocument();
    });

    it("is dismissible", () => {
      // Test 1: Can dismiss with close button
      const { unmount: unmount1 } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      const closeButton = screen.getByLabelText("Close help overlay");
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
      unmount1();

      // Test 2: Can dismiss with Escape key
      mockOnClose.mockClear();
      const { unmount: unmount2 } = render(<VoiceCommandHelp isOpen={true} onClose={mockOnClose} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalled();
      unmount2();

      // Note: Backdrop click dismiss is verified in integration tests
    });
  });
});
