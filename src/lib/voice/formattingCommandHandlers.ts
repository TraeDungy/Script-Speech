/**
 * Voice Command Handlers for Text Formatting Operations
 * F026: Voice-activated formatting
 *
 * These handlers integrate voice commands with the rich text formatting library
 * to allow users to format text using voice commands like "make that bold"
 */

import type { VoiceCommand } from "./commandParser";
import { applyFormat, saveSelection, restoreSelection, type FormatType } from "@/lib/editor/formatting";

/**
 * Stored selection for formatting operations
 * When user says "make that bold", we need to apply formatting to the last selection
 */
let storedSelection: Range | null = null;

/**
 * Store the current selection for later formatting
 * Should be called whenever the selection changes in the editor
 */
export function storeCurrentSelection(): void {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    storedSelection = selection.getRangeAt(0).cloneRange();
  }
}

/**
 * Clear the stored selection
 */
export function clearStoredSelection(): void {
  storedSelection = null;
}

/**
 * Get the stored selection
 */
export function getStoredSelection(): Range | null {
  return storedSelection;
}

export interface FormattingCommandHandlerOptions {
  /**
   * Callback for confirmation messages
   * @param message - The confirmation message to display
   */
  onConfirmation?: (message: string) => void;

  /**
   * Callback for audio feedback
   * @param type - Type of audio feedback (success, error, info)
   */
  onAudioFeedback?: (type: "success" | "error" | "info") => void;

  /**
   * Callback for error messages
   * @param message - The error message to display
   */
  onError?: (message: string) => void;

  /**
   * Callback when formatting is applied
   * @param format - The format that was applied
   * @param success - Whether the operation was successful
   */
  onFormatApplied?: (format: FormatType, success: boolean) => void;
}

/**
 * Apply formatting to the current or stored selection
 * @param format - The format type to apply
 * @param options - Handler options for callbacks
 * @returns Whether the operation was successful
 */
function applyFormattingToSelection(
  format: FormatType,
  options: FormattingCommandHandlerOptions,
): boolean {
  // Check if there's a current selection
  const currentSelection = window.getSelection();
  const hasCurrentSelection = currentSelection && currentSelection.rangeCount > 0 && !currentSelection.isCollapsed;

  if (!hasCurrentSelection && !storedSelection) {
    // No selection to format
    if (options.onError) {
      options.onError("Please select some text first, then use the voice command");
    }
    if (options.onAudioFeedback) {
      options.onAudioFeedback("error");
    }
    return false;
  }

  try {
    // If there's no current selection but we have a stored one, restore it
    if (!hasCurrentSelection && storedSelection) {
      restoreSelection(storedSelection);
    }

    // Apply the format
    const success = applyFormat(format);

    if (success) {
      // Show confirmation
      if (options.onConfirmation) {
        const formatName = format.charAt(0).toUpperCase() + format.slice(1);
        options.onConfirmation(`Applied ${formatName} formatting`);
      }

      // Provide audio feedback
      if (options.onAudioFeedback) {
        options.onAudioFeedback("success");
      }

      // Notify callback
      if (options.onFormatApplied) {
        options.onFormatApplied(format, true);
      }

      // Save the new selection
      storeCurrentSelection();

      return true;
    } else {
      // Formatting failed
      if (options.onError) {
        options.onError("Failed to apply formatting. Please try again.");
      }
      if (options.onAudioFeedback) {
        options.onAudioFeedback("error");
      }
      if (options.onFormatApplied) {
        options.onFormatApplied(format, false);
      }
      return false;
    }
  } catch (error) {
    // Handle unexpected errors
    if (options.onError) {
      options.onError("An error occurred while applying formatting");
    }
    if (options.onAudioFeedback) {
      options.onAudioFeedback("error");
    }
    if (options.onFormatApplied) {
      options.onFormatApplied(format, false);
    }
    console.error("Formatting error:", error);
    return false;
  }
}

/**
 * Handler for "make bold" voice command
 * F026: Supports bold formatting via voice
 */
export function handleMakeBoldCommand(
  command: VoiceCommand,
  options: FormattingCommandHandlerOptions = {},
): void {
  applyFormattingToSelection("bold", options);
}

/**
 * Handler for "make italic" voice command
 * F026: Supports italic formatting via voice
 */
export function handleMakeItalicCommand(
  command: VoiceCommand,
  options: FormattingCommandHandlerOptions = {},
): void {
  applyFormattingToSelection("italic", options);
}

/**
 * Handler for "make underline" voice command
 * F026: Supports underline formatting via voice
 */
export function handleMakeUnderlineCommand(
  command: VoiceCommand,
  options: FormattingCommandHandlerOptions = {},
): void {
  applyFormattingToSelection("underline", options);
}

/**
 * Factory function to create formatting command handlers bound to specific options
 * This makes it easy to register all formatting handlers at once
 */
export function createFormattingCommandHandlers(options: FormattingCommandHandlerOptions = {}) {
  return {
    make_bold: (command: VoiceCommand) => handleMakeBoldCommand(command, options),
    make_italic: (command: VoiceCommand) => handleMakeItalicCommand(command, options),
    make_underline: (command: VoiceCommand) => handleMakeUnderlineCommand(command, options),
  };
}

/**
 * Setup helper to automatically track selection changes
 * Call this once during editor initialization
 *
 * @param element - The contentEditable element to track
 * @returns Cleanup function to remove event listeners
 */
export function setupSelectionTracking(element: HTMLElement): () => void {
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      element.contains(selection.anchorNode)
    ) {
      storeCurrentSelection();
    }
  };

  // Track selection changes
  document.addEventListener("selectionchange", handleSelectionChange);

  // Track mouse up (for selection by dragging)
  element.addEventListener("mouseup", handleSelectionChange);

  // Track keyboard selection (Shift+Arrow, Cmd+A, etc.)
  element.addEventListener("keyup", handleSelectionChange);

  // Return cleanup function
  return () => {
    document.removeEventListener("selectionchange", handleSelectionChange);
    element.removeEventListener("mouseup", handleSelectionChange);
    element.removeEventListener("keyup", handleSelectionChange);
  };
}
