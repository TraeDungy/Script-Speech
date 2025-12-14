/**
 * Element Type Switcher Library
 * F028: Element type switching
 *
 * Provides utilities for switching between screenplay element types
 * (action, dialogue, slugline, etc.) with keyboard shortcuts and navigation.
 */

import type { ScriptSceneElementType } from '@/lib/scriptDoc';
import { autoFormatScreenplayElement } from './screenplayFormat';

/**
 * Extended element types including character name (which appears before dialogue)
 */
export type SwitchableElementType = ScriptSceneElementType | 'slugline' | 'character';

/**
 * Keyboard shortcuts for element type switching
 * Using common screenplay software conventions
 */
export const ELEMENT_TYPE_SHORTCUTS: Record<string, SwitchableElementType> = {
  // Standard shortcuts
  'Mod+1': 'slugline',      // Scene heading
  'Mod+2': 'action',        // Action/description
  'Mod+3': 'character',     // Character name
  'Mod+4': 'dialogue',      // Dialogue
  'Mod+5': 'parenthetical', // Parenthetical
  'Mod+6': 'transition',    // Transition
  'Mod+7': 'note',          // Note

  // Alternative shortcuts
  'Mod+Shift+H': 'slugline',
  'Mod+Shift+A': 'action',
  'Mod+Shift+C': 'character',
  'Mod+Shift+D': 'dialogue',
  'Mod+Shift+P': 'parenthetical',
  'Mod+Shift+T': 'transition',
  'Mod+Shift+N': 'note',
};

/**
 * Element type navigation rules for Tab/Enter key
 * Defines what element type should follow when Tab or Enter is pressed
 */
export interface NavigationRule {
  /** Element type to switch to on Tab */
  onTab?: SwitchableElementType;
  /** Element type to switch to on Enter */
  onEnter?: SwitchableElementType;
  /** Element type to switch to on Shift+Tab (go back) */
  onShiftTab?: SwitchableElementType;
}

/**
 * Standard navigation flow for screenplay elements
 * Based on common screenplay software patterns
 */
export const ELEMENT_NAVIGATION_RULES: Record<SwitchableElementType, NavigationRule> = {
  slugline: {
    onEnter: 'action',      // After scene heading, usually action
    onTab: 'action',
  },
  action: {
    onEnter: 'action',      // Continue action on new line
    onTab: 'character',     // Tab to start dialogue
    onShiftTab: 'slugline',
  },
  character: {
    onEnter: 'dialogue',    // After character name, enter their dialogue
    onTab: 'parenthetical', // Tab for parenthetical
    onShiftTab: 'action',
  },
  dialogue: {
    onEnter: 'character',   // After dialogue, next character speaks
    onTab: 'parenthetical', // Tab for parenthetical within dialogue
    onShiftTab: 'character',
  },
  parenthetical: {
    onEnter: 'dialogue',    // After parenthetical, back to dialogue
    onTab: 'dialogue',
    onShiftTab: 'dialogue',
  },
  transition: {
    onEnter: 'slugline',    // After transition, usually new scene
    onTab: 'slugline',
    onShiftTab: 'action',
  },
  note: {
    onEnter: 'action',      // After note, back to action
    onTab: 'action',
    onShiftTab: 'action',
  },
};

/**
 * Element type display labels
 */
export const ELEMENT_TYPE_LABELS: Record<SwitchableElementType, string> = {
  slugline: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  note: 'Note',
};

/**
 * Element type icons/symbols for UI
 */
export const ELEMENT_TYPE_ICONS: Record<SwitchableElementType, string> = {
  slugline: '🎬',
  action: '📝',
  character: '👤',
  dialogue: '💬',
  parenthetical: '( )',
  transition: '➡️',
  note: '📌',
};

/**
 * Check if a keyboard event matches a shortcut pattern
 *
 * @param event - Keyboard event
 * @param pattern - Shortcut pattern (e.g., "Mod+1", "Mod+Shift+H")
 * @returns True if the event matches the pattern
 */
export function matchesShortcut(event: KeyboardEvent, pattern: string): boolean {
  const parts = pattern.split('+');
  const modKey = parts.includes('Mod');
  const shiftKey = parts.includes('Shift');
  const altKey = parts.includes('Alt');
  const keyPart = parts[parts.length - 1]; // Last part is the key

  // Check modifier keys
  const modPressed = event.metaKey || event.ctrlKey;
  if (modKey && !modPressed) return false;
  if (!modKey && modPressed) return false;
  if (shiftKey && !event.shiftKey) return false;
  if (!shiftKey && event.shiftKey && keyPart.length > 1) return false; // Allow shift+letter
  if (altKey && !event.altKey) return false;
  if (!altKey && event.altKey) return false;

  // Check key
  const eventKey = event.key.toUpperCase();
  const patternKey = keyPart.toUpperCase();

  return eventKey === patternKey;
}

/**
 * Get element type from keyboard shortcut
 *
 * @param event - Keyboard event
 * @returns Element type if shortcut matches, undefined otherwise
 */
export function getElementTypeFromShortcut(
  event: KeyboardEvent
): SwitchableElementType | undefined {
  for (const [pattern, elementType] of Object.entries(ELEMENT_TYPE_SHORTCUTS)) {
    if (matchesShortcut(event, pattern)) {
      return elementType;
    }
  }
  return undefined;
}

/**
 * Get next element type based on navigation key
 *
 * @param currentType - Current element type
 * @param key - Navigation key ('Tab', 'Enter', 'Shift+Tab')
 * @returns Next element type, or undefined if no rule
 */
export function getNextElementType(
  currentType: SwitchableElementType,
  key: 'Tab' | 'Enter' | 'Shift+Tab'
): SwitchableElementType | undefined {
  const rules = ELEMENT_NAVIGATION_RULES[currentType];

  switch (key) {
    case 'Tab':
      return rules.onTab;
    case 'Enter':
      return rules.onEnter;
    case 'Shift+Tab':
      return rules.onShiftTab;
    default:
      return undefined;
  }
}

/**
 * Check if a navigation key was pressed
 *
 * @param event - Keyboard event
 * @returns Navigation key type if pressed, undefined otherwise
 */
export function getNavigationKey(event: KeyboardEvent): 'Tab' | 'Enter' | 'Shift+Tab' | undefined {
  if (event.key === 'Tab' && event.shiftKey) {
    return 'Shift+Tab';
  }
  if (event.key === 'Tab') {
    return 'Tab';
  }
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    return 'Enter';
  }
  return undefined;
}

/**
 * Handle element type switching keyboard event
 *
 * @param event - Keyboard event
 * @param currentType - Current element type
 * @param options - Options for handling
 * @returns Action to take (switch type, navigate, or none)
 */
export interface SwitchHandlerResult {
  action: 'switch' | 'navigate' | 'none';
  newType?: SwitchableElementType;
  preserveContent: boolean;
  preventDefault: boolean;
}

export function handleElementTypeSwitching(
  event: KeyboardEvent,
  currentType: SwitchableElementType,
  options: {
    /** Whether content is empty (affects some navigation rules) */
    isEmpty?: boolean;
    /** Whether to allow navigation keys */
    allowNavigation?: boolean;
  } = {}
): SwitchHandlerResult {
  const { isEmpty = false, allowNavigation = true } = options;

  // Check for explicit element type shortcuts (Mod+1, Mod+Shift+H, etc.)
  const shortcutType = getElementTypeFromShortcut(event);
  if (shortcutType) {
    return {
      action: 'switch',
      newType: shortcutType,
      preserveContent: true, // Keep content when switching via shortcut
      preventDefault: true,
    };
  }

  // Check for navigation keys (Tab, Enter)
  if (allowNavigation) {
    const navKey = getNavigationKey(event);
    if (navKey) {
      // Special handling for Enter in empty elements
      if (navKey === 'Enter' && isEmpty) {
        // Empty enter creates a new element of the same type
        return {
          action: 'navigate',
          newType: currentType,
          preserveContent: false,
          preventDefault: true,
        };
      }

      const nextType = getNextElementType(currentType, navKey);
      if (nextType) {
        return {
          action: 'navigate',
          newType: nextType,
          preserveContent: false, // Start fresh when navigating
          preventDefault: true,
        };
      }
    }
  }

  // No special handling needed
  return {
    action: 'none',
    preserveContent: true,
    preventDefault: false,
  };
}

/**
 * Apply element type change to content
 * Auto-formats content based on the new element type
 *
 * @param content - Current content
 * @param fromType - Current element type
 * @param toType - New element type
 * @returns Formatted content
 */
export function applyElementTypeChange(
  content: string,
  fromType: SwitchableElementType,
  toType: SwitchableElementType
): string {
  // If content is empty, return empty
  if (!content.trim()) {
    return '';
  }

  // Auto-format based on new type
  return autoFormatScreenplayElement(content, toType);
}

/**
 * Validate if element type can be switched
 * Some validations before allowing a switch
 *
 * @param fromType - Current element type
 * @param toType - Target element type
 * @param content - Current content
 * @returns Validation result
 */
export interface TypeSwitchValidation {
  allowed: boolean;
  warning?: string;
  suggestion?: string;
}

export function validateElementTypeSwitch(
  fromType: SwitchableElementType,
  toType: SwitchableElementType,
  content: string
): TypeSwitchValidation {
  const trimmed = content.trim();

  // Empty content can always be switched
  if (!trimmed) {
    return { allowed: true };
  }

  // Warn if switching from dialogue to slugline (unusual)
  if (fromType === 'dialogue' && toType === 'slugline') {
    return {
      allowed: true,
      warning: 'Switching dialogue to scene heading',
      suggestion: 'Did you mean to create a new scene?',
    };
  }

  // Warn if switching from character to action (might lose speaker info)
  if (fromType === 'character' && toType === 'action') {
    return {
      allowed: true,
      warning: 'Converting character name to action',
      suggestion: 'Character name will not be linked to dialogue',
    };
  }

  // Warn if content is very long for the target type
  if (toType === 'character' && trimmed.length > 30) {
    return {
      allowed: true,
      warning: 'Character name is quite long',
      suggestion: 'Consider shortening or using a nickname',
    };
  }

  if (toType === 'parenthetical' && trimmed.length > 50) {
    return {
      allowed: true,
      warning: 'Parenthetical is quite long',
      suggestion: 'Parentheticals should be brief stage directions',
    };
  }

  // All other switches are allowed
  return { allowed: true };
}

/**
 * Get keyboard shortcut hint for element type
 *
 * @param elementType - Element type
 * @returns Shortcut hint string (e.g., "Cmd+1" or "⌘1")
 */
export function getShortcutHint(elementType: SwitchableElementType): string {
  // Find the primary shortcut (Mod+number)
  for (const [pattern, type] of Object.entries(ELEMENT_TYPE_SHORTCUTS)) {
    if (type === elementType && pattern.startsWith('Mod+') && /Mod+\d/.test(pattern)) {
      const number = pattern.replace('Mod+', '');
      // Use symbol for Mac, text for others
      const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
      return isMac ? `⌘${number}` : `Ctrl+${number}`;
    }
  }

  // Fall back to letter shortcuts
  for (const [pattern, type] of Object.entries(ELEMENT_TYPE_SHORTCUTS)) {
    if (type === elementType && pattern.startsWith('Mod+Shift+')) {
      const letter = pattern.replace('Mod+Shift+', '');
      const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
      return isMac ? `⇧⌘${letter}` : `Ctrl+Shift+${letter}`;
    }
  }

  return '';
}

/**
 * Get all available element types for UI picker
 *
 * @returns Array of element types with labels and shortcuts
 */
export function getAvailableElementTypes(): Array<{
  type: SwitchableElementType;
  label: string;
  icon: string;
  shortcut: string;
}> {
  const types: SwitchableElementType[] = [
    'slugline',
    'action',
    'character',
    'dialogue',
    'parenthetical',
    'transition',
    'note',
  ];

  return types.map(type => ({
    type,
    label: ELEMENT_TYPE_LABELS[type],
    icon: ELEMENT_TYPE_ICONS[type],
    shortcut: getShortcutHint(type),
  }));
}
