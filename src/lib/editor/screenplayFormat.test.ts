/**
 * Tests for Screenplay Formatting Library
 * F027: Screenplay formatting presets
 */

import { describe, it, expect } from 'vitest';
import {
  STANDARD_SCREENPLAY_MEASUREMENTS,
  STANDARD_SCREENPLAY_FONT,
  STANDARD_SCREENPLAY_SPACING,
  SCREENPLAY_ELEMENT_FORMATS,
  SCREENPLAY_ELEMENT_CLASSES,
  SCREENPLAY_LINE_LIMITS,
  generateElementStyles,
  generateScreenplayCSS,
  validateScreenplayElement,
  autoFormatScreenplayElement,
  calculateScreenTime,
  estimatePageCount,
  isLineTooLong,
  wrapTextToLineLimit,
  DEFAULT_EXPORT_CONFIG,
  type ScreenplayMeasurements,
  type ScreenplayFontSpec,
  type ScreenplaySpacing,
} from './screenplayFormat';

describe('Screenplay Format - F027', () => {
  describe('Standard Measurements', () => {
    it('should have correct page margins per industry standards', () => {
      expect(STANDARD_SCREENPLAY_MEASUREMENTS.margins).toEqual({
        top: 1.0,
        bottom: 0.5,
        left: 1.5,
        right: 1.0,
      });
    });

    it('should have correct indents for all element types', () => {
      const { indents } = STANDARD_SCREENPLAY_MEASUREMENTS;

      expect(indents.slugline).toBe(0); // Left margin
      expect(indents.action).toBe(0);
      expect(indents.character).toBe(2.2); // Indented
      expect(indents.dialogue).toBe(1.0);
      expect(indents.parenthetical).toBe(1.5);
      expect(indents.transition).toBe(4.0); // Right-aligned
      expect(indents.note).toBe(0);
    });

    it('should have correct widths for all element types', () => {
      const { widths } = STANDARD_SCREENPLAY_MEASUREMENTS;

      expect(widths.slugline).toBe(6.0);
      expect(widths.action).toBe(6.0);
      expect(widths.character).toBe(3.3);
      expect(widths.dialogue).toBe(3.5);
      expect(widths.parenthetical).toBe(2.0);
      expect(widths.transition).toBe(2.0);
      expect(widths.note).toBe(6.0);
    });
  });

  describe('Standard Font', () => {
    it('should use Courier 12pt', () => {
      expect(STANDARD_SCREENPLAY_FONT.size).toBe(12);
      expect(STANDARD_SCREENPLAY_FONT.family).toContain('Courier');
    });

    it('should be monospaced fonts only', () => {
      expect(STANDARD_SCREENPLAY_FONT.family).toContain('monospace');
    });

    it('should have correct line height', () => {
      expect(STANDARD_SCREENPLAY_FONT.lineHeight).toBe(1.0);
    });
  });

  describe('Standard Spacing', () => {
    it('should have 2 blank lines before new scene (slugline)', () => {
      expect(STANDARD_SCREENPLAY_SPACING.before.slugline).toBe(2);
    });

    it('should have 1 blank line before character name', () => {
      expect(STANDARD_SCREENPLAY_SPACING.before.character).toBe(1);
    });

    it('should have no space between character and dialogue', () => {
      expect(STANDARD_SCREENPLAY_SPACING.before.dialogue).toBe(0);
      expect(STANDARD_SCREENPLAY_SPACING.after.character).toBe(0);
    });

    it('should have proper spacing for all elements', () => {
      // Test that all required element types have spacing defined
      const elementTypes = ['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note'];

      elementTypes.forEach(type => {
        expect(STANDARD_SCREENPLAY_SPACING.before).toHaveProperty(type);
        expect(STANDARD_SCREENPLAY_SPACING.after).toHaveProperty(type);
      });
    });
  });

  describe('Element Formats', () => {
    it('should uppercase sluglines', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.slugline.textTransform).toBe('uppercase');
    });

    it('should uppercase character names', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.character.textTransform).toBe('uppercase');
    });

    it('should uppercase transitions', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.transition.textTransform).toBe('uppercase');
    });

    it('should not transform dialogue or action', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.dialogue.textTransform).toBe('none');
      expect(SCREENPLAY_ELEMENT_FORMATS.action.textTransform).toBe('none');
    });

    it('should right-align transitions', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.transition.textAlign).toBe('right');
    });

    it('should left-align most elements', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.slugline.textAlign).toBe('left');
      expect(SCREENPLAY_ELEMENT_FORMATS.action.textAlign).toBe('left');
      expect(SCREENPLAY_ELEMENT_FORMATS.dialogue.textAlign).toBe('left');
    });

    it('should italicize notes', () => {
      expect(SCREENPLAY_ELEMENT_FORMATS.note.fontStyle).toBe('italic');
    });
  });

  describe('CSS Class Names', () => {
    it('should have BEM-style class names for all elements', () => {
      expect(SCREENPLAY_ELEMENT_CLASSES.slugline).toBe('screenplay-slugline');
      expect(SCREENPLAY_ELEMENT_CLASSES.action).toBe('screenplay-action');
      expect(SCREENPLAY_ELEMENT_CLASSES.character).toBe('screenplay-character');
      expect(SCREENPLAY_ELEMENT_CLASSES.dialogue).toBe('screenplay-dialogue');
      expect(SCREENPLAY_ELEMENT_CLASSES.parenthetical).toBe('screenplay-parenthetical');
      expect(SCREENPLAY_ELEMENT_CLASSES.transition).toBe('screenplay-transition');
      expect(SCREENPLAY_ELEMENT_CLASSES.note).toBe('screenplay-note');
    });
  });

  describe('generateElementStyles', () => {
    it('should generate correct styles for slugline', () => {
      const styles = generateElementStyles('slugline');

      expect(styles.fontFamily).toContain('Courier');
      expect(styles.fontSize).toBe('12pt');
      expect(styles.textTransform).toBe('uppercase');
      expect(styles.marginLeft).toBe('0in');
      expect(styles.width).toBe('6in');
      expect(styles.marginTop).toBe('2em'); // 2 blank lines before
    });

    it('should generate correct styles for character name', () => {
      const styles = generateElementStyles('character');

      expect(styles.textTransform).toBe('uppercase');
      expect(styles.marginLeft).toBe('2.2in'); // Indented
      expect(styles.width).toBe('3.3in');
      expect(styles.marginTop).toBe('1em'); // 1 blank line before
    });

    it('should generate correct styles for dialogue', () => {
      const styles = generateElementStyles('dialogue');

      expect(styles.textTransform).toBe('none');
      expect(styles.marginLeft).toBe('1in');
      expect(styles.width).toBe('3.5in');
      expect(styles.marginTop).toBe('0em'); // No space before
    });

    it('should generate correct styles for transition', () => {
      const styles = generateElementStyles('transition');

      expect(styles.textTransform).toBe('uppercase');
      expect(styles.textAlign).toBe('right');
      expect(styles.marginLeft).toBe('4in');
    });

    it('should accept custom measurements', () => {
      const customMeasurements: ScreenplayMeasurements = {
        ...STANDARD_SCREENPLAY_MEASUREMENTS,
        indents: {
          ...STANDARD_SCREENPLAY_MEASUREMENTS.indents,
          dialogue: 2.0,
        },
      };

      const styles = generateElementStyles('dialogue', customMeasurements);
      expect(styles.marginLeft).toBe('2in');
    });

    it('should accept custom font', () => {
      const customFont: ScreenplayFontSpec = {
        family: 'Custom Font',
        size: 14,
        lineHeight: 1.2,
      };

      const styles = generateElementStyles('action', undefined, customFont);
      expect(styles.fontFamily).toBe('Custom Font');
      expect(styles.fontSize).toBe('14pt');
      expect(styles.lineHeight).toBe(1.2);
    });

    it('should include all necessary CSS properties', () => {
      const styles = generateElementStyles('action');

      expect(styles).toHaveProperty('fontFamily');
      expect(styles).toHaveProperty('fontSize');
      expect(styles).toHaveProperty('lineHeight');
      expect(styles).toHaveProperty('textAlign');
      expect(styles).toHaveProperty('textTransform');
      expect(styles).toHaveProperty('marginLeft');
      expect(styles).toHaveProperty('width');
      expect(styles).toHaveProperty('marginTop');
      expect(styles).toHaveProperty('marginBottom');
      expect(styles).toHaveProperty('whiteSpace');
      expect(styles).toHaveProperty('wordWrap');
    });
  });

  describe('generateScreenplayCSS', () => {
    it('should generate complete CSS string', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('.screenplay-page');
      expect(css).toContain('.screenplay-slugline');
      expect(css).toContain('.screenplay-character');
      expect(css).toContain('.screenplay-dialogue');
      expect(css).toContain('.screenplay-action');
      expect(css).toContain('.screenplay-transition');
    });

    it('should include page dimensions', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('width: 8.5in');
      expect(css).toContain('height: 11in');
    });

    it('should include page margins', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('padding: 1in 1in 0.5in 1.5in');
    });

    it('should include page number styles', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('.screenplay-page-number');
    });

    it('should include title page styles', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('.screenplay-title-page');
    });

    it('should include dual dialogue styles', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('.screenplay-dual-dialogue');
    });

    it('should use Courier font throughout', () => {
      const css = generateScreenplayCSS();

      expect(css).toContain('Courier');
      expect(css).toContain('12pt');
    });
  });

  describe('validateScreenplayElement', () => {
    describe('Sluglines', () => {
      it('should validate correct slugline', () => {
        const result = validateScreenplayElement('INT. COFFEE SHOP - DAY', 'slugline');
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should require INT., EXT., or INT./EXT.', () => {
        const result = validateScreenplayElement('COFFEE SHOP - DAY', 'slugline');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.includes('INT.'))).toBe(true);
      });

      it('should suggest uppercase', () => {
        const result = validateScreenplayElement('int. coffee shop - day', 'slugline');
        expect(result.issues.some(i => i.includes('UPPERCASE'))).toBe(true);
      });

      it('should accept EXT. sluglines', () => {
        const result = validateScreenplayElement('EXT. PARK - NIGHT', 'slugline');
        expect(result.valid).toBe(true);
      });

      it('should accept INT./EXT. sluglines', () => {
        const result = validateScreenplayElement('INT./EXT. CAR - SUNSET', 'slugline');
        expect(result.valid).toBe(true);
      });
    });

    describe('Character Names', () => {
      it('should validate correct character name', () => {
        const result = validateScreenplayElement('JOHN', 'character');
        expect(result.valid).toBe(true);
      });

      it('should suggest uppercase', () => {
        const result = validateScreenplayElement('john', 'character');
        expect(result.issues.some(i => i.includes('UPPERCASE'))).toBe(true);
      });

      it('should warn about long names', () => {
        const result = validateScreenplayElement('A VERY LONG CHARACTER NAME THAT EXCEEDS THIRTY CHARACTERS', 'character');
        expect(result.issues.some(i => i.includes('long'))).toBe(true);
      });
    });

    describe('Parentheticals', () => {
      it('should validate correct parenthetical', () => {
        const result = validateScreenplayElement('(smiling)', 'parenthetical');
        expect(result.valid).toBe(true);
      });

      it('should require parentheses', () => {
        const result = validateScreenplayElement('smiling', 'parenthetical');
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.includes('parentheses'))).toBe(true);
      });

      it('should suggest lowercase content', () => {
        const result = validateScreenplayElement('(Smiling)', 'parenthetical');
        expect(result.issues.some(i => i.includes('lowercase'))).toBe(true);
      });
    });

    describe('Transitions', () => {
      it('should validate correct transition', () => {
        const result = validateScreenplayElement('FADE TO:', 'transition');
        expect(result.valid).toBe(true);
      });

      it('should suggest uppercase', () => {
        const result = validateScreenplayElement('fade to:', 'transition');
        expect(result.issues.some(i => i.includes('UPPERCASE'))).toBe(true);
      });

      it('should suggest colon', () => {
        const result = validateScreenplayElement('CUT TO BLACK', 'transition');
        expect(result.issues.some(i => i.includes('colon'))).toBe(true);
      });

      it('should accept transitions ending with TO:', () => {
        const result = validateScreenplayElement('DISSOLVE TO:', 'transition');
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('Dialogue', () => {
      it('should validate normal dialogue', () => {
        const result = validateScreenplayElement('Hello there!', 'dialogue');
        expect(result.valid).toBe(true);
      });

      it('should warn about all-caps dialogue', () => {
        const result = validateScreenplayElement('I AM YELLING AT YOU!', 'dialogue');
        expect(result.issues.some(i => i.includes('ALL CAPS'))).toBe(true);
      });

      it('should allow short all-caps words', () => {
        const result = validateScreenplayElement('NO!', 'dialogue');
        // Short all-caps shouldn't trigger warning
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('Action', () => {
      it('should validate normal action', () => {
        const result = validateScreenplayElement('He walks into the room.', 'action');
        expect(result.valid).toBe(true);
      });

      it('should warn about very long action blocks', () => {
        const longText = 'Lorem ipsum dolor sit amet, '.repeat(15); // > 300 chars
        const result = validateScreenplayElement(longText, 'action');
        expect(result.issues.some(i => i.includes('long'))).toBe(true);
      });
    });

    describe('Notes', () => {
      it('should validate notes without restriction', () => {
        const result = validateScreenplayElement('TODO: Fix this scene', 'note');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('autoFormatScreenplayElement', () => {
    it('should uppercase sluglines', () => {
      const result = autoFormatScreenplayElement('int. coffee shop - day', 'slugline');
      expect(result).toBe('INT. COFFEE SHOP - DAY');
    });

    it('should uppercase character names', () => {
      const result = autoFormatScreenplayElement('john', 'character');
      expect(result).toBe('JOHN');
    });

    it('should uppercase transitions', () => {
      const result = autoFormatScreenplayElement('fade to:', 'transition');
      expect(result).toBe('FADE TO:');
    });

    it('should format parentheticals correctly', () => {
      const result = autoFormatScreenplayElement('Smiling', 'parenthetical');
      expect(result).toBe('(smiling)');
    });

    it('should add missing opening parenthesis', () => {
      const result = autoFormatScreenplayElement('smiling)', 'parenthetical');
      expect(result).toBe('(smiling)');
    });

    it('should add missing closing parenthesis', () => {
      const result = autoFormatScreenplayElement('(smiling', 'parenthetical');
      expect(result).toBe('(smiling)');
    });

    it('should not transform dialogue', () => {
      const result = autoFormatScreenplayElement('Hello there!', 'dialogue');
      expect(result).toBe('Hello there!');
    });

    it('should not transform action', () => {
      const result = autoFormatScreenplayElement('He walks in.', 'action');
      expect(result).toBe('He walks in.');
    });

    it('should trim whitespace', () => {
      const result = autoFormatScreenplayElement('  JOHN  ', 'character');
      expect(result).toBe('JOHN');
    });
  });

  describe('Screen Time Calculations', () => {
    it('should calculate screen time (1 page = 1 minute)', () => {
      expect(calculateScreenTime(90)).toBe(90);
      expect(calculateScreenTime(120)).toBe(120);
      expect(calculateScreenTime(1)).toBe(1);
    });

    it('should round to nearest minute', () => {
      expect(calculateScreenTime(90.7)).toBe(91);
      expect(calculateScreenTime(90.3)).toBe(90);
    });
  });

  describe('Page Count Estimation', () => {
    it('should estimate pages from word count (action-heavy)', () => {
      expect(estimatePageCount(250)).toBe(1);
      expect(estimatePageCount(2500)).toBe(10);
    });

    it('should estimate pages from word count (dialogue-heavy)', () => {
      expect(estimatePageCount(200, true)).toBe(1);
      expect(estimatePageCount(2000, true)).toBe(10);
    });

    it('should use different rates for dialogue-heavy scripts', () => {
      const actionHeavy = estimatePageCount(2000, false);
      const dialogueHeavy = estimatePageCount(2000, true);
      expect(dialogueHeavy).toBeGreaterThan(actionHeavy);
    });
  });

  describe('Line Length Validation', () => {
    it('should have correct line limits per element type', () => {
      expect(SCREENPLAY_LINE_LIMITS.action).toBe(61);
      expect(SCREENPLAY_LINE_LIMITS.dialogue).toBe(35);
      expect(SCREENPLAY_LINE_LIMITS.parenthetical).toBe(25);
      expect(SCREENPLAY_LINE_LIMITS.character).toBe(33);
      expect(SCREENPLAY_LINE_LIMITS.slugline).toBe(61);
      expect(SCREENPLAY_LINE_LIMITS.transition).toBe(20);
    });

    it('should detect lines that are too long', () => {
      const longLine = 'This is a very long line that exceeds the maximum character limit for dialogue';
      expect(isLineTooLong(longLine, 'dialogue')).toBe(true);
    });

    it('should accept lines within limits', () => {
      const shortLine = 'Hello there!';
      expect(isLineTooLong(shortLine, 'dialogue')).toBe(false);
    });
  });

  describe('Text Wrapping', () => {
    it('should wrap long dialogue to multiple lines', () => {
      const longText = 'This is a very long line of dialogue that needs to be wrapped to fit within the dialogue column width limits';
      const wrapped = wrapTextToLineLimit(longText, 'dialogue');

      expect(wrapped.length).toBeGreaterThan(1);
      wrapped.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(SCREENPLAY_LINE_LIMITS.dialogue);
      });
    });

    it('should not wrap short text', () => {
      const shortText = 'Hello!';
      const wrapped = wrapTextToLineLimit(shortText, 'dialogue');

      expect(wrapped).toEqual(['Hello!']);
    });

    it('should wrap at word boundaries', () => {
      const text = 'One two three four five six seven eight nine ten';
      const wrapped = wrapTextToLineLimit(text, 'dialogue');

      // Each line should be a valid sentence fragment (not break mid-word)
      wrapped.forEach(line => {
        expect(line.trim()).not.toBe('');
        expect(line).not.toMatch(/\s$/); // No trailing space
      });
    });

    it('should handle single long word', () => {
      const longWord = 'x'.repeat(50);
      const wrapped = wrapTextToLineLimit(longWord, 'dialogue');

      // Should force-break even though it exceeds limit
      expect(wrapped).toContain(longWord);
    });

    it('should preserve content', () => {
      const text = 'One two three four five six seven eight nine ten';
      const wrapped = wrapTextToLineLimit(text, 'dialogue');
      const rejoined = wrapped.join(' ');

      expect(rejoined).toBe(text);
    });
  });

  describe('Export Configuration', () => {
    it('should have default export config', () => {
      expect(DEFAULT_EXPORT_CONFIG.includeTitlePage).toBe(true);
      expect(DEFAULT_EXPORT_CONFIG.includePageNumbers).toBe(true);
      expect(DEFAULT_EXPORT_CONFIG.startPageNumber).toBe(1);
      expect(DEFAULT_EXPORT_CONFIG.includeRevisionInfo).toBe(false);
    });
  });

  describe('F027 Acceptance Criteria', () => {
    it('should enforce correct margins per screenplay standards', () => {
      const margins = STANDARD_SCREENPLAY_MEASUREMENTS.margins;
      expect(margins.left).toBe(1.5);
      expect(margins.right).toBe(1.0);
      expect(margins.top).toBe(1.0);
      expect(margins.bottom).toBeGreaterThanOrEqual(0.5);
    });

    it('should use Courier font family', () => {
      expect(STANDARD_SCREENPLAY_FONT.family).toMatch(/courier/i);
    });

    it('should use 12pt font size', () => {
      expect(STANDARD_SCREENPLAY_FONT.size).toBe(12);
    });

    it('should have proper spacing between elements', () => {
      expect(STANDARD_SCREENPLAY_SPACING.before.slugline).toBeGreaterThan(0);
      expect(STANDARD_SCREENPLAY_SPACING.before.character).toBeGreaterThan(0);
    });

    it('should auto-format sluglines, characters, and transitions to uppercase', () => {
      expect(autoFormatScreenplayElement('test', 'slugline')).toBe('TEST');
      expect(autoFormatScreenplayElement('test', 'character')).toBe('TEST');
      expect(autoFormatScreenplayElement('test', 'transition')).toBe('TEST');
    });

    it('should generate valid CSS for all element types', () => {
      const css = generateScreenplayCSS();

      const requiredClasses = [
        '.screenplay-page',
        '.screenplay-slugline',
        '.screenplay-character',
        '.screenplay-dialogue',
        '.screenplay-action',
        '.screenplay-transition',
        '.screenplay-parenthetical',
        '.screenplay-note',
      ];

      requiredClasses.forEach(className => {
        expect(css).toContain(className);
      });
    });

    it('should provide validation for screenplay elements', () => {
      const validSlugline = validateScreenplayElement('INT. TEST - DAY', 'slugline');
      const invalidSlugline = validateScreenplayElement('test', 'slugline');

      expect(validSlugline.valid).toBe(true);
      expect(invalidSlugline.valid).toBe(false);
      expect(invalidSlugline.issues.length).toBeGreaterThan(0);
    });
  });
});
