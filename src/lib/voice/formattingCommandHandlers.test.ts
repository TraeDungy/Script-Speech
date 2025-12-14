/**
 * Tests for Voice Formatting Command Handlers
 * F026: Voice-activated formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleMakeBoldCommand,
  handleMakeItalicCommand,
  handleMakeUnderlineCommand,
  createFormattingCommandHandlers,
  storeCurrentSelection,
  clearStoredSelection,
  getStoredSelection,
  setupSelectionTracking,
  type FormattingCommandHandlerOptions,
} from "./formattingCommandHandlers";
import type { VoiceCommand } from "./commandParser";
import * as formatting from "@/lib/editor/formatting";

// Mock the formatting module
vi.mock("@/lib/editor/formatting", () => ({
  applyFormat: vi.fn(),
  saveSelection: vi.fn(),
  restoreSelection: vi.fn(),
}));

describe("Voice Formatting Command Handlers - F026", () => {
  let mockCommand: VoiceCommand;
  let mockOptions: FormattingCommandHandlerOptions;

  // Create a test contentEditable element
  let testElement: HTMLDivElement;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Clear stored selection
    clearStoredSelection();

    // Create test command
    mockCommand = {
      type: "make_bold",
      rawText: "make that bold",
      params: {},
      confidence: 0.95,
      timestamp: Date.now(),
    };

    // Create test options with spies
    mockOptions = {
      onConfirmation: vi.fn(),
      onAudioFeedback: vi.fn(),
      onError: vi.fn(),
      onFormatApplied: vi.fn(),
    };

    // Create contentEditable element for testing
    testElement = document.createElement("div");
    testElement.contentEditable = "true";
    testElement.textContent = "Test content for formatting";
    document.body.appendChild(testElement);

    // Mock successful formatting by default
    vi.mocked(formatting.applyFormat).mockReturnValue(true);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(testElement);
    clearStoredSelection();
  });

  describe("Selection Storage", () => {
    it("should store the current selection", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Store selection
      storeCurrentSelection();

      // Verify selection was stored
      const stored = getStoredSelection();
      expect(stored).not.toBeNull();
      expect(stored?.toString()).toBe(testElement.textContent);
    });

    it("should clear stored selection", () => {
      // Store a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      storeCurrentSelection();

      // Clear it
      clearStoredSelection();

      // Verify it was cleared
      expect(getStoredSelection()).toBeNull();
    });

    it("should handle storing when no selection exists", () => {
      // Clear any existing selection
      window.getSelection()?.removeAllRanges();

      // Try to store
      storeCurrentSelection();

      // Should not throw and should not store anything
      expect(getStoredSelection()).toBeNull();
    });
  });

  describe("handleMakeBoldCommand", () => {
    it("should apply bold formatting to current selection", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Execute command
      handleMakeBoldCommand(mockCommand, mockOptions);

      // Verify formatting was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Bold formatting");
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
      expect(mockOptions.onFormatApplied).toHaveBeenCalledWith("bold", true);
    });

    it("should apply bold formatting to stored selection", () => {
      // Store a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      storeCurrentSelection();

      // Clear current selection
      selection?.removeAllRanges();

      // Execute command
      handleMakeBoldCommand(mockCommand, mockOptions);

      // Verify stored selection was restored
      expect(formatting.restoreSelection).toHaveBeenCalled();
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");
      expect(mockOptions.onConfirmation).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
    });

    it("should show error when no selection exists", () => {
      // Clear any selection
      window.getSelection()?.removeAllRanges();
      clearStoredSelection();

      // Execute command
      handleMakeBoldCommand(mockCommand, mockOptions);

      // Verify error handling
      expect(formatting.applyFormat).not.toHaveBeenCalled();
      expect(mockOptions.onError).toHaveBeenCalledWith(
        "Please select some text first, then use the voice command",
      );
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("error");
    });

    it("should handle formatting failure", () => {
      // Mock formatting failure
      vi.mocked(formatting.applyFormat).mockReturnValue(false);

      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Execute command
      handleMakeBoldCommand(mockCommand, mockOptions);

      // Verify error handling
      expect(mockOptions.onError).toHaveBeenCalledWith(
        "Failed to apply formatting. Please try again.",
      );
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("error");
      expect(mockOptions.onFormatApplied).toHaveBeenCalledWith("bold", false);
    });

    it("should handle exceptions gracefully", () => {
      // Mock formatting to throw an error
      vi.mocked(formatting.applyFormat).mockImplementation(() => {
        throw new Error("Test error");
      });

      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Execute command
      handleMakeBoldCommand(mockCommand, mockOptions);

      // Verify error handling
      expect(mockOptions.onError).toHaveBeenCalledWith(
        "An error occurred while applying formatting",
      );
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("error");
    });

    it("should work without callbacks", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Execute command without options
      expect(() => handleMakeBoldCommand(mockCommand)).not.toThrow();
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");
    });
  });

  describe("handleMakeItalicCommand", () => {
    it("should apply italic formatting to current selection", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Update command
      mockCommand.type = "make_italic";
      mockCommand.rawText = "make that italic";

      // Execute command
      handleMakeItalicCommand(mockCommand, mockOptions);

      // Verify formatting was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("italic");
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Italic formatting");
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
      expect(mockOptions.onFormatApplied).toHaveBeenCalledWith("italic", true);
    });

    it("should apply italic formatting to stored selection", () => {
      // Store a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      storeCurrentSelection();

      // Clear current selection
      selection?.removeAllRanges();

      // Execute command
      handleMakeItalicCommand(mockCommand, mockOptions);

      // Verify stored selection was restored
      expect(formatting.restoreSelection).toHaveBeenCalled();
      expect(formatting.applyFormat).toHaveBeenCalledWith("italic");
    });

    it("should show error when no selection exists", () => {
      // Clear any selection
      window.getSelection()?.removeAllRanges();
      clearStoredSelection();

      // Execute command
      handleMakeItalicCommand(mockCommand, mockOptions);

      // Verify error handling
      expect(formatting.applyFormat).not.toHaveBeenCalled();
      expect(mockOptions.onError).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("error");
    });
  });

  describe("handleMakeUnderlineCommand", () => {
    it("should apply underline formatting to current selection", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Update command
      mockCommand.type = "make_underline";
      mockCommand.rawText = "make that underline";

      // Execute command
      handleMakeUnderlineCommand(mockCommand, mockOptions);

      // Verify formatting was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("underline");
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Underline formatting");
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
      expect(mockOptions.onFormatApplied).toHaveBeenCalledWith("underline", true);
    });

    it("should apply underline formatting to stored selection", () => {
      // Store a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      storeCurrentSelection();

      // Clear current selection
      selection?.removeAllRanges();

      // Execute command
      handleMakeUnderlineCommand(mockCommand, mockOptions);

      // Verify stored selection was restored
      expect(formatting.restoreSelection).toHaveBeenCalled();
      expect(formatting.applyFormat).toHaveBeenCalledWith("underline");
    });

    it("should show error when no selection exists", () => {
      // Clear any selection
      window.getSelection()?.removeAllRanges();
      clearStoredSelection();

      // Execute command
      handleMakeUnderlineCommand(mockCommand, mockOptions);

      // Verify error handling
      expect(formatting.applyFormat).not.toHaveBeenCalled();
      expect(mockOptions.onError).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("error");
    });
  });

  describe("createFormattingCommandHandlers", () => {
    it("should create handlers for all format types", () => {
      const handlers = createFormattingCommandHandlers(mockOptions);

      expect(handlers).toHaveProperty("make_bold");
      expect(handlers).toHaveProperty("make_italic");
      expect(handlers).toHaveProperty("make_underline");
      expect(typeof handlers.make_bold).toBe("function");
      expect(typeof handlers.make_italic).toBe("function");
      expect(typeof handlers.make_underline).toBe("function");
    });

    it("should create handlers bound to options", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const handlers = createFormattingCommandHandlers(mockOptions);

      // Execute each handler
      handlers.make_bold(mockCommand);
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Bold formatting");

      handlers.make_italic(mockCommand);
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Italic formatting");

      handlers.make_underline(mockCommand);
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Underline formatting");
    });

    it("should work without options", () => {
      const handlers = createFormattingCommandHandlers();

      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Should not throw
      expect(() => handlers.make_bold(mockCommand)).not.toThrow();
      expect(() => handlers.make_italic(mockCommand)).not.toThrow();
      expect(() => handlers.make_underline(mockCommand)).not.toThrow();
    });
  });

  describe("setupSelectionTracking", () => {
    it("should return a cleanup function", () => {
      const cleanup = setupSelectionTracking(testElement);

      // Verify cleanup is a function
      expect(typeof cleanup).toBe("function");

      // Verify cleanup doesn't throw
      expect(() => cleanup()).not.toThrow();
    });

    it("should accept an HTML element", () => {
      // Should not throw when passed a valid element
      expect(() => setupSelectionTracking(testElement)).not.toThrow();

      // Create another element
      const anotherElement = document.createElement("div");
      anotherElement.contentEditable = "true";
      document.body.appendChild(anotherElement);

      // Should work with different elements
      expect(() => setupSelectionTracking(anotherElement)).not.toThrow();

      document.body.removeChild(anotherElement);
    });

    it("should track selection changes manually", () => {
      // Since event listeners are async and hard to test,
      // we test that storeCurrentSelection works correctly
      const cleanup = setupSelectionTracking(testElement);

      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Manually store selection
      storeCurrentSelection();

      // Verify selection was stored
      const stored = getStoredSelection();
      expect(stored).not.toBeNull();

      cleanup();
    });
  });

  describe("Integration Tests - F026 Acceptance Criteria", () => {
    it("F026: should support bold via voice", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // User says "make that bold"
      const command: VoiceCommand = {
        type: "make_bold",
        rawText: "make that bold",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleMakeBoldCommand(command, mockOptions);

      // Verify bold was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");
      expect(mockOptions.onConfirmation).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
    });

    it("F026: should support italic via voice", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // User says "make that italic"
      const command: VoiceCommand = {
        type: "make_italic",
        rawText: "make that italic",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleMakeItalicCommand(command, mockOptions);

      // Verify italic was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("italic");
      expect(mockOptions.onConfirmation).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
    });

    it("F026: should support underline via voice", () => {
      // Create a selection
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // User says "make that underline"
      const command: VoiceCommand = {
        type: "make_underline",
        rawText: "make that underline",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleMakeUnderlineCommand(command, mockOptions);

      // Verify underline was applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("underline");
      expect(mockOptions.onConfirmation).toHaveBeenCalled();
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
    });

    it("F026: should apply formatting to selection", () => {
      // Create a selection (simulating user selecting text)
      const range = document.createRange();
      range.setStart(testElement.firstChild!, 0);
      range.setEnd(testElement.firstChild!, 4); // Select "Test"
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // User selects text, then says "make that bold"
      const command: VoiceCommand = {
        type: "make_bold",
        rawText: "make that bold",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleMakeBoldCommand(command, mockOptions);

      // Verify formatting was applied to selection
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");
      expect(mockOptions.onFormatApplied).toHaveBeenCalledWith("bold", true);
    });

    it("F026: should handle voice command end-to-end", () => {
      // Simulate full workflow:
      // 1. User selects text
      const range = document.createRange();
      range.selectNodeContents(testElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // 2. Selection is automatically tracked
      storeCurrentSelection();

      // 3. User speaks command
      const command: VoiceCommand = {
        type: "make_bold",
        rawText: "make that bold",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      // 4. Command is executed
      const handlers = createFormattingCommandHandlers(mockOptions);
      handlers.make_bold(command);

      // 5. Formatting is applied
      expect(formatting.applyFormat).toHaveBeenCalledWith("bold");

      // 6. User receives confirmation
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("Applied Bold formatting");
      expect(mockOptions.onAudioFeedback).toHaveBeenCalledWith("success");
    });
  });
});
