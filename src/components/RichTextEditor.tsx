"use client";

/**
 * Rich Text Editor Component
 * F025: Rich text formatting engine
 *
 * A contentEditable-based rich text editor with formatting toolbar.
 * Supports bold, italic, and underline formatting with keyboard shortcuts.
 * - Keyboard shortcuts work (Cmd/Ctrl+B, I, U)
 * - Formatting persists in HTML
 * - Exports correctly with formatting intact
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  applyFormat,
  getFormatState,
  handleFormatKeyboard,
  getFormattedHTML,
  setFormattedHTML,
  saveSelection,
  restoreSelection,
  sanitizeFormattedHTML,
  type FormatType,
  type FormatState,
} from "@/lib/editor/formatting";

export interface RichTextEditorProps {
  /**
   * Current HTML content value
   */
  value?: string;

  /**
   * Callback when content changes
   */
  onChange?: (html: string) => void;

  /**
   * Placeholder text when empty
   */
  placeholder?: string;

  /**
   * Whether to show the formatting toolbar
   * Default: true
   */
  showToolbar?: boolean;

  /**
   * Whether the editor is disabled
   * Default: false
   */
  disabled?: boolean;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Additional CSS classes for the editor area
   */
  editorClassName?: string;

  /**
   * Minimum height of the editor
   * Default: '150px'
   */
  minHeight?: string;

  /**
   * Auto-focus the editor on mount
   * Default: false
   */
  autoFocus?: boolean;

  /**
   * Whether to sanitize HTML on change
   * Default: true (recommended for security)
   */
  sanitize?: boolean;

  /**
   * aria-label for accessibility
   */
  ariaLabel?: string;
}

/**
 * Format button component
 */
interface FormatButtonProps {
  format: FormatType;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function FormatButton({ format, isActive, onClick, disabled }: FormatButtonProps) {
  const icons = {
    bold: 'B',
    italic: 'I',
    underline: 'U',
  };

  const labels = {
    bold: 'Bold (Cmd+B)',
    italic: 'Italic (Cmd+I)',
    underline: 'Underline (Cmd+U)',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={labels[format]}
      title={labels[format]}
      className={`
        rounded px-3 py-1.5 text-sm font-semibold
        transition-colors duration-150
        ${isActive
          ? 'bg-white/20 text-white'
          : 'text-zinc-400 hover:bg-white/10 hover:text-white'
        }
        ${format === 'bold' ? 'font-bold' : ''}
        ${format === 'italic' ? 'italic' : ''}
        ${format === 'underline' ? 'underline' : ''}
        disabled:cursor-not-allowed disabled:opacity-40
      `}
    >
      {icons[format]}
    </button>
  );
}

/**
 * Rich Text Editor
 */
export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  showToolbar = true,
  disabled = false,
  className = '',
  editorClassName = '',
  minHeight = '150px',
  autoFocus = false,
  sanitize = true,
  ariaLabel = 'Rich text editor',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
  });
  const savedSelectionRef = useRef<Range | null>(null);
  const isUpdatingRef = useRef(false);

  // Update format state on selection change
  const updateFormatState = useCallback(() => {
    if (disabled || !editorRef.current) return;

    const state = getFormatState();
    setFormatState(state);
  }, [disabled]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      // Check if it's a formatting shortcut
      const handled = handleFormatKeyboard(event.nativeEvent);

      if (handled) {
        // Update format state after a short delay
        setTimeout(updateFormatState, 0);
      }
    },
    [disabled, updateFormatState]
  );

  // Handle content changes
  const handleInput = useCallback(() => {
    if (disabled || !editorRef.current || isUpdatingRef.current) return;

    let html = getFormattedHTML(editorRef.current);

    // Sanitize if enabled
    if (sanitize) {
      html = sanitizeFormattedHTML(html);
    }

    onChange?.(html);
  }, [disabled, onChange, sanitize]);

  // Handle selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      if (disabled) return;

      // Only update if selection is within our editor
      const selection = window.getSelection();
      if (!selection || !editorRef.current) return;

      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!range) return;

      // Check if selection is inside editor
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        updateFormatState();
        savedSelectionRef.current = saveSelection();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [disabled, updateFormatState]);

  // Sync value prop to editor
  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return;

    const currentHTML = getFormattedHTML(editorRef.current);
    if (currentHTML !== value) {
      isUpdatingRef.current = true;
      setFormattedHTML(editorRef.current, value);
      isUpdatingRef.current = false;
    }
  }, [value]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Apply format and restore focus
  const applyFormatAndRestore = useCallback(
    (format: FormatType) => {
      if (disabled || !editorRef.current) return;

      // Restore selection before formatting
      if (savedSelectionRef.current) {
        restoreSelection(savedSelectionRef.current);
      }

      // Focus editor
      editorRef.current.focus();

      // Apply format
      applyFormat(format);

      // Update state
      setTimeout(() => {
        updateFormatState();
        savedSelectionRef.current = saveSelection();
      }, 0);

      // Trigger change
      handleInput();
    },
    [disabled, updateFormatState, handleInput]
  );

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div
          className="flex items-center gap-1 rounded-t-xl border border-b-0 border-white/10 bg-white/5 p-2"
          role="toolbar"
          aria-label="Text formatting toolbar"
        >
          <FormatButton
            format="bold"
            isActive={formatState.bold}
            onClick={() => applyFormatAndRestore('bold')}
            disabled={disabled}
          />
          <FormatButton
            format="italic"
            isActive={formatState.italic}
            onClick={() => applyFormatAndRestore('italic')}
            disabled={disabled}
          />
          <FormatButton
            format="underline"
            isActive={formatState.underline}
            onClick={() => applyFormatAndRestore('underline')}
            disabled={disabled}
          />
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className={`
          ${showToolbar ? 'rounded-b-xl' : 'rounded-xl'}
          border border-white/10 bg-white/5 px-4 py-3
          text-sm text-zinc-200 outline-none
          focus:border-white/30 focus:ring-1 focus:ring-white/20
          disabled:cursor-not-allowed disabled:opacity-60
          ${editorClassName}
        `}
        style={{
          minHeight,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        aria-disabled={disabled}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}

export default RichTextEditor;
