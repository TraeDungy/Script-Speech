/**
 * Tests for Element Type Switcher Library
 * F028: Element type switching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ELEMENT_TYPE_SHORTCUTS,
  ELEMENT_NAVIGATION_RULES,
  ELEMENT_TYPE_LABELS,
  ELEMENT_TYPE_ICONS,
  matchesShortcut,
  getElementTypeFromShortcut,
  getNextElementType,
  getNavigationKey,
  handleElementTypeSwitching,
  applyElementTypeChange,
  validateElementTypeSwitch,
  getShortcutHint,
  getAvailableElementTypes,
  type SwitchableElementType,
} from './elementTypeSwitcher';

describe('Element Type Switcher - F028', () => {
  describe('Constants', () => {
    it('should have shortcuts for all element types', () => {
      const types: SwitchableElementType[] = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      types.forEach(type => {
        const hasShortcut = Object.values(ELEMENT_TYPE_SHORTCUTS).includes(type);
        expect(hasShortcut).toBe(true);
      });
    });

    it('should have navigation rules for all element types', () => {
      const types: SwitchableElementType[] = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      types.forEach(type => {
        expect(ELEMENT_NAVIGATION_RULES).toHaveProperty(type);
      });
    });

    it('should have labels for all element types', () => {
      const types: SwitchableElementType[] = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      types.forEach(type => {
        expect(ELEMENT_TYPE_LABELS).toHaveProperty(type);
        expect(ELEMENT_TYPE_LABELS[type]).toBeTruthy();
      });
    });

    it('should have icons for all element types', () => {
      const types: SwitchableElementType[] = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      types.forEach(type => {
        expect(ELEMENT_TYPE_ICONS).toHaveProperty(type);
        expect(ELEMENT_TYPE_ICONS[type]).toBeTruthy();
      });
    });
  });

  describe('matchesShortcut', () => {
    it('should match Mod+number shortcuts', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
      });

      expect(matchesShortcut(event, 'Mod+1')).toBe(true);
    });

    it('should match Mod+Shift+letter shortcuts', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'H',
        metaKey: true,
        shiftKey: true,
      });

      expect(matchesShortcut(event, 'Mod+Shift+H')).toBe(true);
    });

    it('should not match if modifier is missing', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
      });

      expect(matchesShortcut(event, 'Mod+1')).toBe(false);
    });

    it('should not match if key is different', () => {
      const event = new KeyboardEvent('keydown', {
        key: '2',
        metaKey: true,
      });

      expect(matchesShortcut(event, 'Mod+1')).toBe(false);
    });

    it('should work with Ctrl key on Windows/Linux', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true,
      });

      expect(matchesShortcut(event, 'Mod+1')).toBe(true);
    });
  });

  describe('getElementTypeFromShortcut', () => {
    it('should return slugline for Mod+1', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
      });

      expect(getElementTypeFromShortcut(event)).toBe('slugline');
    });

    it('should return action for Mod+2', () => {
      const event = new KeyboardEvent('keydown', {
        key: '2',
        metaKey: true,
      });

      expect(getElementTypeFromShortcut(event)).toBe('action');
    });

    it('should return character for Mod+3', () => {
      const event = new KeyboardEvent('keydown', {
        key: '3',
        metaKey: true,
      });

      expect(getElementTypeFromShortcut(event)).toBe('character');
    });

    it('should return dialogue for Mod+4', () => {
      const event = new KeyboardEvent('keydown', {
        key: '4',
        metaKey: true,
      });

      expect(getElementTypeFromShortcut(event)).toBe('dialogue');
    });

    it('should return undefined for non-shortcut keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
      });

      expect(getElementTypeFromShortcut(event)).toBeUndefined();
    });

    it('should handle letter shortcuts', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'H',
        metaKey: true,
        shiftKey: true,
      });

      expect(getElementTypeFromShortcut(event)).toBe('slugline');
    });
  });

  describe('getNextElementType', () => {
    it('should navigate from slugline to action on Enter', () => {
      expect(getNextElementType('slugline', 'Enter')).toBe('action');
    });

    it('should navigate from character to dialogue on Enter', () => {
      expect(getNextElementType('character', 'Enter')).toBe('dialogue');
    });

    it('should navigate from action to character on Tab', () => {
      expect(getNextElementType('action', 'Tab')).toBe('character');
    });

    it('should navigate from dialogue to character on Enter', () => {
      expect(getNextElementType('dialogue', 'Enter')).toBe('character');
    });

    it('should navigate back with Shift+Tab', () => {
      expect(getNextElementType('character', 'Shift+Tab')).toBe('action');
    });

    it('should return undefined for undefined rules', () => {
      // @ts-expect-error - testing invalid navigation
      expect(getNextElementType('slugline', 'invalid')).toBeUndefined();
    });
  });

  describe('getNavigationKey', () => {
    it('should detect Tab key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
      });

      expect(getNavigationKey(event)).toBe('Tab');
    });

    it('should detect Shift+Tab', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
      });

      expect(getNavigationKey(event)).toBe('Shift+Tab');
    });

    it('should detect Enter key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
      });

      expect(getNavigationKey(event)).toBe('Enter');
    });

    it('should not detect Enter with modifiers', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
      });

      expect(getNavigationKey(event)).toBeUndefined();
    });

    it('should return undefined for other keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
      });

      expect(getNavigationKey(event)).toBeUndefined();
    });
  });

  describe('handleElementTypeSwitching', () => {
    it('should switch type on keyboard shortcut', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
      });

      const result = handleElementTypeSwitching(event, 'action');

      expect(result.action).toBe('switch');
      expect(result.newType).toBe('slugline');
      expect(result.preserveContent).toBe(true);
      expect(result.preventDefault).toBe(true);
    });

    it('should navigate on Tab key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
      });

      const result = handleElementTypeSwitching(event, 'action');

      expect(result.action).toBe('navigate');
      expect(result.newType).toBe('character');
      expect(result.preserveContent).toBe(false);
      expect(result.preventDefault).toBe(true);
    });

    it('should navigate on Enter key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
      });

      const result = handleElementTypeSwitching(event, 'character');

      expect(result.action).toBe('navigate');
      expect(result.newType).toBe('dialogue');
      expect(result.preserveContent).toBe(false);
      expect(result.preventDefault).toBe(true);
    });

    it('should create same element type on Enter in empty element', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
      });

      const result = handleElementTypeSwitching(event, 'action', { isEmpty: true });

      expect(result.action).toBe('navigate');
      expect(result.newType).toBe('action');
      expect(result.preserveContent).toBe(false);
    });

    it('should not navigate when navigation is disabled', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
      });

      const result = handleElementTypeSwitching(event, 'action', { allowNavigation: false });

      expect(result.action).toBe('none');
      expect(result.preventDefault).toBe(false);
    });

    it('should do nothing for non-special keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
      });

      const result = handleElementTypeSwitching(event, 'action');

      expect(result.action).toBe('none');
      expect(result.preventDefault).toBe(false);
    });
  });

  describe('applyElementTypeChange', () => {
    it('should uppercase sluglines', () => {
      const result = applyElementTypeChange('int. coffee shop - day', 'action', 'slugline');
      expect(result).toBe('INT. COFFEE SHOP - DAY');
    });

    it('should uppercase character names', () => {
      const result = applyElementTypeChange('john', 'action', 'character');
      expect(result).toBe('JOHN');
    });

    it('should format parentheticals', () => {
      const result = applyElementTypeChange('smiling', 'dialogue', 'parenthetical');
      expect(result).toBe('(smiling)');
    });

    it('should not transform dialogue', () => {
      const result = applyElementTypeChange('Hello there!', 'action', 'dialogue');
      expect(result).toBe('Hello there!');
    });

    it('should return empty for empty content', () => {
      const result = applyElementTypeChange('', 'action', 'slugline');
      expect(result).toBe('');
    });

    it('should return empty for whitespace-only content', () => {
      const result = applyElementTypeChange('   ', 'action', 'slugline');
      expect(result).toBe('');
    });
  });

  describe('validateElementTypeSwitch', () => {
    it('should allow empty content switches', () => {
      const result = validateElementTypeSwitch('action', 'slugline', '');
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should warn when switching dialogue to slugline', () => {
      const result = validateElementTypeSwitch('dialogue', 'slugline', 'Some dialogue');
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeTruthy();
    });

    it('should warn when switching character to action', () => {
      const result = validateElementTypeSwitch('character', 'action', 'JOHN');
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeTruthy();
    });

    it('should warn about long character names', () => {
      const longName = 'THIS IS A VERY LONG CHARACTER NAME THAT EXCEEDS THIRTY CHARACTERS';
      const result = validateElementTypeSwitch('action', 'character', longName);
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeTruthy();
    });

    it('should warn about long parentheticals', () => {
      const longParenthetical = 'This is a very long parenthetical that should really be brief';
      const result = validateElementTypeSwitch('dialogue', 'parenthetical', longParenthetical);
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeTruthy();
    });

    it('should allow normal switches', () => {
      const result = validateElementTypeSwitch('action', 'dialogue', 'Normal text');
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('getShortcutHint', () => {
    it('should return shortcut hint for slugline', () => {
      const hint = getShortcutHint('slugline');
      expect(hint).toBeTruthy();
      // Should contain either number or letter shortcut
      expect(hint.length).toBeGreaterThan(0);
    });

    it('should return shortcut hint for action', () => {
      const hint = getShortcutHint('action');
      expect(hint).toBeTruthy();
      expect(hint.length).toBeGreaterThan(0);
    });

    it('should return shortcut hint for character', () => {
      const hint = getShortcutHint('character');
      expect(hint).toBeTruthy();
      expect(hint.length).toBeGreaterThan(0);
    });

    it('should return shortcut hint for dialogue', () => {
      const hint = getShortcutHint('dialogue');
      expect(hint).toBeTruthy();
      expect(hint.length).toBeGreaterThan(0);
    });

    it('should return platform-appropriate hints', () => {
      const hint = getShortcutHint('slugline');
      // Should contain either Ctrl or ⌘ or letter, depending on platform
      expect(hint).toBeTruthy();
      expect(hint.length).toBeGreaterThan(0);
    });

    it('should return shortcuts for all element types', () => {
      const types: SwitchableElementType[] = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      types.forEach(type => {
        const hint = getShortcutHint(type);
        expect(hint).toBeTruthy();
      });
    });
  });

  describe('getAvailableElementTypes', () => {
    it('should return all element types', () => {
      const types = getAvailableElementTypes();

      expect(types).toHaveLength(7);
      expect(types.map(t => t.type)).toContain('slugline');
      expect(types.map(t => t.type)).toContain('action');
      expect(types.map(t => t.type)).toContain('character');
      expect(types.map(t => t.type)).toContain('dialogue');
      expect(types.map(t => t.type)).toContain('parenthetical');
      expect(types.map(t => t.type)).toContain('transition');
      expect(types.map(t => t.type)).toContain('note');
    });

    it('should include labels for all types', () => {
      const types = getAvailableElementTypes();

      types.forEach(type => {
        expect(type.label).toBeTruthy();
      });
    });

    it('should include icons for all types', () => {
      const types = getAvailableElementTypes();

      types.forEach(type => {
        expect(type.icon).toBeTruthy();
      });
    });

    it('should include shortcuts for all types', () => {
      const types = getAvailableElementTypes();

      types.forEach(type => {
        expect(type.shortcut).toBeTruthy();
      });
    });
  });

  describe('Navigation Flow', () => {
    it('should follow typical screenplay flow', () => {
      // Typical flow: Slugline -> Action -> Character -> Dialogue -> Character -> ...

      // Start with slugline
      expect(getNextElementType('slugline', 'Enter')).toBe('action');

      // Action to character
      expect(getNextElementType('action', 'Tab')).toBe('character');

      // Character to dialogue
      expect(getNextElementType('character', 'Enter')).toBe('dialogue');

      // Dialogue back to character (next speaker)
      expect(getNextElementType('dialogue', 'Enter')).toBe('character');
    });

    it('should support backwards navigation', () => {
      // Navigate backwards with Shift+Tab
      expect(getNextElementType('character', 'Shift+Tab')).toBe('action');
      expect(getNextElementType('action', 'Shift+Tab')).toBe('slugline');
    });

    it('should support parenthetical flow', () => {
      // From character, Tab to parenthetical
      expect(getNextElementType('character', 'Tab')).toBe('parenthetical');

      // From parenthetical, Enter to dialogue
      expect(getNextElementType('parenthetical', 'Enter')).toBe('dialogue');
    });

    it('should support transition flow', () => {
      // After transition, usually new scene
      expect(getNextElementType('transition', 'Enter')).toBe('slugline');
    });
  });

  describe('F028 Acceptance Criteria', () => {
    it('should support Tab navigation between element types', () => {
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      const result = handleElementTypeSwitching(tabEvent, 'action');

      expect(result.action).toBe('navigate');
      expect(result.newType).toBe('character');
      expect(result.preventDefault).toBe(true);
    });

    it('should support Enter navigation between element types', () => {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const result = handleElementTypeSwitching(enterEvent, 'character');

      expect(result.action).toBe('navigate');
      expect(result.newType).toBe('dialogue');
      expect(result.preventDefault).toBe(true);
    });

    it('should support keyboard shortcuts for switching', () => {
      const shortcutEvent = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
      });
      const result = handleElementTypeSwitching(shortcutEvent, 'action');

      expect(result.action).toBe('switch');
      expect(result.newType).toBe('slugline');
      expect(result.preventDefault).toBe(true);
    });

    it('should preserve content when switching via shortcuts', () => {
      const shortcutEvent = new KeyboardEvent('keydown', {
        key: '2',
        metaKey: true,
      });
      const result = handleElementTypeSwitching(shortcutEvent, 'slugline');

      expect(result.preserveContent).toBe(true);
    });

    it('should not preserve content when navigating', () => {
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      const result = handleElementTypeSwitching(tabEvent, 'action');

      expect(result.preserveContent).toBe(false);
    });

    it('should auto-format content based on element type', () => {
      const slugline = applyElementTypeChange('int. test - day', 'action', 'slugline');
      expect(slugline).toBe('INT. TEST - DAY');

      const character = applyElementTypeChange('john', 'action', 'character');
      expect(character).toBe('JOHN');
    });
  });
});
