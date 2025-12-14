/**
 * Rich Text Formatting Library
 * F025: Rich text formatting engine
 *
 * Provides utilities for applying bold, italic, and underline formatting
 * to contentEditable elements with keyboard shortcuts support.
 */

/**
 * Format types supported by the editor
 */
export type FormatType = 'bold' | 'italic' | 'underline';

/**
 * Format command names for execCommand API
 */
const FORMAT_COMMANDS: Record<FormatType, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
};

/**
 * HTML tags used for each format type
 */
export const FORMAT_TAGS: Record<FormatType, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
};

/**
 * Default keyboard shortcuts for formatting
 */
export const FORMAT_SHORTCUTS: Record<FormatType, string> = {
  bold: 'Mod+B',
  italic: 'Mod+I',
  underline: 'Mod+U',
};

/**
 * Format state for a selection
 */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/**
 * Apply a format to the current selection
 *
 * @param format - The format type to apply
 * @returns Whether the operation was successful
 */
export function applyFormat(format: FormatType): boolean {
  const commandSupported = typeof document.queryCommandSupported === 'function'
    ? document.queryCommandSupported(FORMAT_COMMANDS[format])
    : false;

  if (!commandSupported) {
    return applyFormatFallback(format);
  }

  try {
    return document.execCommand(FORMAT_COMMANDS[format], false);
  } catch (error) {
    console.error(`Failed to apply ${format} format:`, error);
    return false;
  }
}

/**
 * Fallback method for browsers that don't support execCommand
 * Uses direct DOM manipulation to wrap selection in format tags
 */
function applyFormatFallback(format: FormatType): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  try {
    const range = selection.getRangeAt(0);
    const tag = FORMAT_TAGS[format];

    // Check if already formatted
    let parent = range.commonAncestorContainer as Node;
    if (parent.nodeType === Node.TEXT_NODE) {
      parent = parent.parentNode!;
    }

    // If already wrapped in this format, unwrap it
    if (parent && parent.nodeName.toLowerCase() === tag) {
      const parentElement = parent as HTMLElement;
      const fragment = range.extractContents();
      parentElement.parentNode?.insertBefore(fragment, parentElement);
      if (parentElement.textContent === '') {
        parentElement.remove();
      }
      return true;
    }

    // Otherwise, wrap selection in format tag
    const element = document.createElement(tag);
    element.appendChild(range.extractContents());
    range.insertNode(element);

    // Restore selection
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    return true;
  } catch (error) {
    console.error(`Fallback formatting failed for ${format}:`, error);
    return false;
  }
}

/**
 * Remove a format from the current selection
 *
 * @param format - The format type to remove
 * @returns Whether the operation was successful
 */
export function removeFormat(format: FormatType): boolean {
  // Toggle the format off
  return applyFormat(format);
}

/**
 * Check if a format is currently active in the selection
 *
 * @param format - The format type to check
 * @returns Whether the format is active
 */
export function isFormatActive(format: FormatType): boolean {
  if (typeof document.queryCommandState !== 'function') {
    return isFormatActiveFallback(format);
  }

  try {
    return document.queryCommandState(FORMAT_COMMANDS[format]);
  } catch (error) {
    return isFormatActiveFallback(format);
  }
}

/**
 * Fallback method to check format state
 * Walks up the DOM tree to find format tags
 */
function isFormatActiveFallback(format: FormatType): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  try {
    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;

    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    const tag = FORMAT_TAGS[format].toUpperCase();

    // Walk up the tree looking for the format tag
    while (node && node !== document.body) {
      if (node.nodeName === tag) {
        return true;
      }
      node = node.parentNode;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get the current format state for the selection
 *
 * @returns Object with boolean flags for each format type
 */
export function getFormatState(): FormatState {
  return {
    bold: isFormatActive('bold'),
    italic: isFormatActive('italic'),
    underline: isFormatActive('underline'),
  };
}

/**
 * Toggle a format on the current selection
 *
 * @param format - The format type to toggle
 * @returns Whether the format is now active
 */
export function toggleFormat(format: FormatType): boolean {
  applyFormat(format);
  return isFormatActive(format);
}

/**
 * Apply multiple formats at once
 *
 * @param formats - Array of format types to apply
 * @returns Whether all operations were successful
 */
export function applyFormats(formats: FormatType[]): boolean {
  return formats.every(format => applyFormat(format));
}

/**
 * Clear all formatting from the current selection
 *
 * @returns Whether the operation was successful
 */
export function clearFormatting(): boolean {
  const commandSupported = typeof document.queryCommandSupported === 'function'
    ? document.queryCommandSupported('removeFormat')
    : false;

  if (!commandSupported) {
    return clearFormattingFallback();
  }

  try {
    return document.execCommand('removeFormat', false);
  } catch (error) {
    return clearFormattingFallback();
  }
}

/**
 * Fallback method to clear all formatting
 */
function clearFormattingFallback(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  try {
    const range = selection.getRangeAt(0);
    const contents = range.extractContents();

    // Get text content only (strips all HTML)
    const textContent = contents.textContent || '';
    const textNode = document.createTextNode(textContent);

    range.insertNode(textNode);

    // Restore selection
    range.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    return true;
  } catch (error) {
    console.error('Failed to clear formatting:', error);
    return false;
  }
}

/**
 * Handle keyboard shortcut for formatting
 *
 * @param event - Keyboard event
 * @returns Whether the event was handled
 */
export function handleFormatKeyboard(event: KeyboardEvent): boolean {
  // Check for Cmd (Mac) or Ctrl (Windows/Linux)
  const modKey = event.metaKey || event.ctrlKey;

  if (!modKey) {
    return false;
  }

  const key = event.key.toUpperCase();

  switch (key) {
    case 'B':
      event.preventDefault();
      applyFormat('bold');
      return true;

    case 'I':
      event.preventDefault();
      applyFormat('italic');
      return true;

    case 'U':
      event.preventDefault();
      applyFormat('underline');
      return true;

    default:
      return false;
  }
}

/**
 * Extract formatted text as HTML
 *
 * @param element - The contentEditable element
 * @returns HTML string with formatting
 */
export function getFormattedHTML(element: HTMLElement): string {
  return element.innerHTML;
}

/**
 * Extract formatted text as plain text (strips formatting)
 *
 * @param element - The contentEditable element
 * @returns Plain text without formatting
 */
export function getPlainText(element: HTMLElement): string {
  return element.textContent || '';
}

/**
 * Set formatted HTML content
 *
 * @param element - The contentEditable element
 * @param html - HTML string with formatting
 */
export function setFormattedHTML(element: HTMLElement, html: string): void {
  element.innerHTML = html;
}

/**
 * Check if document.execCommand is supported
 *
 * @returns Whether execCommand is available
 */
export function isExecCommandSupported(): boolean {
  return typeof document.execCommand === 'function';
}

/**
 * Save current selection for restoration later
 * Useful when focus is lost temporarily
 */
export function saveSelection(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  return selection.getRangeAt(0);
}

/**
 * Restore a previously saved selection
 *
 * @param range - The range to restore
 */
export function restoreSelection(range: Range | null): void {
  if (!range) {
    return;
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Format export/persistence utilities
 */

/**
 * Convert HTML with formatting to a serializable format
 * Useful for database storage
 *
 * @param html - HTML string
 * @returns Serializable representation
 */
export function serializeFormatting(html: string): string {
  // For now, just return HTML as-is
  // Can be extended to use custom format or markdown
  return html;
}

/**
 * Convert serialized format back to HTML
 *
 * @param serialized - Serialized format string
 * @returns HTML string
 */
export function deserializeFormatting(serialized: string): string {
  // For now, just return as-is
  // Can be extended to parse custom format or markdown
  return serialized;
}

/**
 * Sanitize HTML to only allow safe formatting tags
 * Prevents XSS attacks
 *
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML with only formatting tags
 */
export function sanitizeFormattedHTML(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  // Walk through and only keep allowed tags
  const allowedTags = ['STRONG', 'EM', 'U', 'B', 'I'];

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      if (!allowedTags.includes(element.nodeName)) {
        // Replace element with its text content
        const textContent = element.textContent || '';
        return document.createTextNode(textContent);
      }

      // Remove all attributes (prevents event handlers, styles, etc.)
      while (element.attributes.length > 0) {
        element.removeAttribute(element.attributes[0].name);
      }

      // Recursively clean children
      const children = Array.from(element.childNodes);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const cleaned = cleanNode(child);
        if (cleaned !== child) {
          element.replaceChild(cleaned!, child);
        }
      }

      return element;
    }

    return node;
  }

  // Clean all top-level children
  const children = Array.from(div.childNodes);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const cleaned = cleanNode(child);
    if (cleaned !== child) {
      div.replaceChild(cleaned!, child);
    }
  }

  return div.innerHTML;
}
