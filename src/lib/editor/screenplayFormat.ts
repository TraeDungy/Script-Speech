/**
 * Screenplay Formatting Library
 * F027: Screenplay formatting presets
 *
 * Provides industry-standard screenplay formatting rules, measurements,
 * and utilities for enforcing proper screenplay layout per WGA/Academy standards.
 */

import type { ScriptSceneElementType } from '@/lib/scriptDoc';

/**
 * Industry-standard screenplay measurements (in inches)
 * Based on WGA and Academy of Motion Picture Arts and Sciences standards
 */
export interface ScreenplayMeasurements {
  /** Page margins */
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Element-specific left indent from page margin */
  indents: Record<ScriptSceneElementType | 'character' | 'slugline', number>;
  /** Element-specific widths (in inches) */
  widths: Record<ScriptSceneElementType | 'character' | 'slugline', number>;
}

/**
 * Standard screenplay measurements per industry conventions
 * - Page: 8.5" x 11" (US Letter)
 * - Font: Courier 12pt (or Courier Final Draft)
 * - Line height: Single-spaced with specific inter-element spacing
 * - 1 page ≈ 1 minute of screen time
 */
export const STANDARD_SCREENPLAY_MEASUREMENTS: ScreenplayMeasurements = {
  margins: {
    top: 1.0,    // 1 inch from top
    bottom: 0.5, // 0.5 to 1 inch from bottom (flexible for page breaks)
    left: 1.5,   // 1.5 inches from left
    right: 1.0,  // 1 inch from right
  },
  indents: {
    slugline: 0,       // Starts at left margin
    action: 0,         // Starts at left margin
    character: 2.2,    // 3.7" from left edge (2.2" from text margin)
    dialogue: 1.0,     // 2.5" from left edge (1.0" from text margin)
    parenthetical: 1.5, // 3.0" from left edge (1.5" from text margin)
    transition: 4.0,   // 5.5" from left edge (4.0" from text margin, right-aligned)
    note: 0,           // Starts at left margin
  },
  widths: {
    slugline: 6.0,      // Full width (page width - margins)
    action: 6.0,        // Full width
    character: 3.3,     // Character name width
    dialogue: 3.5,      // Dialogue column width
    parenthetical: 2.0, // Parenthetical width (narrower than dialogue)
    transition: 2.0,    // Transition width
    note: 6.0,          // Full width
  },
};

/**
 * Font specifications for screenplay text
 */
export interface ScreenplayFontSpec {
  family: string;
  size: number; // in points
  lineHeight: number; // multiplier
  letterSpacing?: number; // in em units
}

/**
 * Standard screenplay font: Courier 12pt
 * Courier is monospaced, ensuring consistent character count per line
 */
export const STANDARD_SCREENPLAY_FONT: ScreenplayFontSpec = {
  family: '"Courier Prime", "Courier Final Draft", "Courier New", Courier, monospace',
  size: 12,
  lineHeight: 1.0, // Single-spaced
  letterSpacing: 0,
};

/**
 * Spacing between different screenplay elements (in line units)
 */
export interface ScreenplaySpacing {
  /** Space before element (in lines) */
  before: Record<ScriptSceneElementType | 'character' | 'slugline', number>;
  /** Space after element (in lines) */
  after: Record<ScriptSceneElementType | 'character' | 'slugline', number>;
}

/**
 * Standard inter-element spacing
 * Ensures proper readability and follows industry conventions
 */
export const STANDARD_SCREENPLAY_SPACING: ScreenplaySpacing = {
  before: {
    slugline: 2,       // 2 blank lines before slugline (new scene)
    action: 1,         // 1 blank line before action
    character: 1,      // 1 blank line before character name
    dialogue: 0,       // No space (immediately after character)
    parenthetical: 0,  // No space (within dialogue)
    transition: 1,     // 1 blank line before transition
    note: 1,           // 1 blank line before note
  },
  after: {
    slugline: 0,       // No space after (action follows)
    action: 0,         // No space after (unless followed by character)
    character: 0,      // No space after (dialogue follows immediately)
    dialogue: 0,       // No space after (unless end of dialogue block)
    parenthetical: 0,  // No space after (dialogue continues)
    transition: 1,     // 1 blank line after transition
    note: 0,           // No space after
  },
};

/**
 * Text transformation rules for screenplay elements
 */
export type TextTransform = 'uppercase' | 'lowercase' | 'capitalize' | 'none';

/**
 * Formatting rules for each screenplay element type
 */
export interface ScreenplayElementFormat {
  textAlign: 'left' | 'center' | 'right';
  textTransform: TextTransform;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

/**
 * Standard formatting rules per element type
 */
export const SCREENPLAY_ELEMENT_FORMATS: Record<
  ScriptSceneElementType | 'character' | 'slugline',
  ScreenplayElementFormat
> = {
  slugline: {
    textAlign: 'left',
    textTransform: 'uppercase',
    fontWeight: 'normal',
  },
  action: {
    textAlign: 'left',
    textTransform: 'none',
    fontWeight: 'normal',
  },
  character: {
    textAlign: 'left', // Left-aligned within its indented column
    textTransform: 'uppercase',
    fontWeight: 'normal',
  },
  dialogue: {
    textAlign: 'left',
    textTransform: 'none',
    fontWeight: 'normal',
  },
  parenthetical: {
    textAlign: 'left',
    textTransform: 'none',
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
  transition: {
    textAlign: 'right',
    textTransform: 'uppercase',
    fontWeight: 'normal',
  },
  note: {
    textAlign: 'left',
    textTransform: 'none',
    fontStyle: 'italic',
  },
};

/**
 * CSS class names for screenplay elements
 * Follows BEM naming convention
 */
export const SCREENPLAY_ELEMENT_CLASSES: Record<
  ScriptSceneElementType | 'character' | 'slugline',
  string
> = {
  slugline: 'screenplay-slugline',
  action: 'screenplay-action',
  character: 'screenplay-character',
  dialogue: 'screenplay-dialogue',
  parenthetical: 'screenplay-parenthetical',
  transition: 'screenplay-transition',
  note: 'screenplay-note',
};

/**
 * Generate CSS rules for a screenplay element type
 *
 * @param elementType - The screenplay element type
 * @param measurements - Screenplay measurements (defaults to standard)
 * @param font - Font specification (defaults to standard)
 * @param spacing - Spacing rules (defaults to standard)
 * @returns CSS properties as an object
 */
export function generateElementStyles(
  elementType: ScriptSceneElementType | 'character' | 'slugline',
  measurements: ScreenplayMeasurements = STANDARD_SCREENPLAY_MEASUREMENTS,
  font: ScreenplayFontSpec = STANDARD_SCREENPLAY_FONT,
  spacing: ScreenplaySpacing = STANDARD_SCREENPLAY_SPACING
): Record<string, string | number> {
  const format = SCREENPLAY_ELEMENT_FORMATS[elementType];
  const indent = measurements.indents[elementType];
  const width = measurements.widths[elementType];
  const spaceBefore = spacing.before[elementType];
  const spaceAfter = spacing.after[elementType];

  return {
    fontFamily: font.family,
    fontSize: `${font.size}pt`,
    lineHeight: font.lineHeight,
    letterSpacing: font.letterSpacing ? `${font.letterSpacing}em` : '0',
    textAlign: format.textAlign,
    textTransform: format.textTransform,
    fontWeight: format.fontWeight || 'normal',
    fontStyle: format.fontStyle || 'normal',
    marginLeft: `${indent}in`,
    width: `${width}in`,
    marginTop: `${spaceBefore}em`,
    marginBottom: `${spaceAfter}em`,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  };
}

/**
 * Generate CSS string for all screenplay elements
 * Can be injected into a style tag or CSS file
 *
 * @param measurements - Custom measurements (optional)
 * @param font - Custom font (optional)
 * @param spacing - Custom spacing (optional)
 * @returns CSS string
 */
export function generateScreenplayCSS(
  measurements?: ScreenplayMeasurements,
  font?: ScreenplayFontSpec,
  spacing?: ScreenplaySpacing
): string {
  const m = measurements || STANDARD_SCREENPLAY_MEASUREMENTS;
  const f = font || STANDARD_SCREENPLAY_FONT;
  const s = spacing || STANDARD_SCREENPLAY_SPACING;

  const elementTypes: Array<ScriptSceneElementType | 'character' | 'slugline'> = [
    'slugline',
    'action',
    'character',
    'dialogue',
    'parenthetical',
    'transition',
    'note',
  ];

  let css = `/* Screenplay Formatting - Industry Standard */\n\n`;

  // Page container styles
  css += `.screenplay-page {\n`;
  css += `  width: 8.5in;\n`;
  css += `  height: 11in;\n`;
  css += `  padding: ${m.margins.top}in ${m.margins.right}in ${m.margins.bottom}in ${m.margins.left}in;\n`;
  css += `  font-family: ${f.family};\n`;
  css += `  font-size: ${f.size}pt;\n`;
  css += `  line-height: ${f.lineHeight};\n`;
  css += `  background: white;\n`;
  css += `  color: black;\n`;
  css += `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);\n`;
  css += `  margin: 0 auto 1in;\n`;
  css += `  position: relative;\n`;
  css += `}\n\n`;

  // Page number (top right, per industry standard)
  css += `.screenplay-page-number {\n`;
  css += `  position: absolute;\n`;
  css += `  top: 0.5in;\n`;
  css += `  right: 1in;\n`;
  css += `  font-family: ${f.family};\n`;
  css += `  font-size: ${f.size}pt;\n`;
  css += `}\n\n`;

  // Title page styles
  css += `.screenplay-title-page {\n`;
  css += `  width: 8.5in;\n`;
  css += `  height: 11in;\n`;
  css += `  padding: 3in 1in;\n`;
  css += `  font-family: ${f.family};\n`;
  css += `  font-size: ${f.size}pt;\n`;
  css += `  text-align: center;\n`;
  css += `}\n\n`;

  // Element styles
  elementTypes.forEach((type) => {
    const className = SCREENPLAY_ELEMENT_CLASSES[type];
    const styles = generateElementStyles(type, m, f, s);

    css += `.${className} {\n`;
    Object.entries(styles).forEach(([prop, value]) => {
      const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      css += `  ${cssProp}: ${value};\n`;
    });
    css += `}\n\n`;
  });

  // Special formatting for dual dialogue (two characters speaking simultaneously)
  css += `.screenplay-dual-dialogue {\n`;
  css += `  display: flex;\n`;
  css += `  gap: 0.5in;\n`;
  css += `}\n\n`;

  css += `.screenplay-dual-dialogue .screenplay-dialogue-block {\n`;
  css += `  flex: 1;\n`;
  css += `  max-width: 2.75in;\n`;
  css += `}\n\n`;

  return css;
}

/**
 * Validate if text follows screenplay element rules
 *
 * @param text - Text to validate
 * @param elementType - Expected element type
 * @returns Validation result with any issues
 */
export interface ScreenplayValidationResult {
  valid: boolean;
  issues: string[];
  suggestions: string[];
}

export function validateScreenplayElement(
  text: string,
  elementType: ScriptSceneElementType | 'character' | 'slugline'
): ScreenplayValidationResult {
  const result: ScreenplayValidationResult = {
    valid: true,
    issues: [],
    suggestions: [],
  };

  const trimmed = text.trim();

  switch (elementType) {
    case 'slugline':
      // Should start with INT., EXT., or INT./EXT.
      if (!/^(INT\.|EXT\.|INT\.\/EXT\.)/i.test(trimmed)) {
        result.valid = false;
        result.issues.push('Slugline should start with INT., EXT., or INT./EXT.');
        result.suggestions.push('Example: INT. COFFEE SHOP - DAY');
      }
      // Should be uppercase
      if (trimmed !== trimmed.toUpperCase()) {
        result.issues.push('Slugline should be in UPPERCASE');
        result.suggestions.push(trimmed.toUpperCase());
      }
      break;

    case 'character':
      // Should be uppercase
      if (trimmed !== trimmed.toUpperCase()) {
        result.issues.push('Character name should be in UPPERCASE');
        result.suggestions.push(trimmed.toUpperCase());
      }
      // Shouldn't be too long (usually < 30 chars)
      if (trimmed.length > 30) {
        result.issues.push('Character name is unusually long');
      }
      break;

    case 'parenthetical':
      // Should be wrapped in parentheses
      if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
        result.valid = false;
        result.issues.push('Parenthetical should be wrapped in parentheses');
        result.suggestions.push(`(${trimmed})`);
      }
      // Should be lowercase (except first letter)
      if (trimmed.length > 2) {
        const inner = trimmed.slice(1, -1);
        if (inner && inner !== inner.toLowerCase()) {
          result.issues.push('Parenthetical content should be lowercase');
        }
      }
      break;

    case 'transition':
      // Should be uppercase
      if (trimmed !== trimmed.toUpperCase()) {
        result.issues.push('Transition should be in UPPERCASE');
        result.suggestions.push(trimmed.toUpperCase());
      }
      // Should end with ":"  or "TO:"
      if (!trimmed.endsWith(':') && !trimmed.endsWith('TO:')) {
        result.issues.push('Transition usually ends with colon (:)');
        result.suggestions.push(`${trimmed}:`);
      }
      break;

    case 'dialogue':
      // No uppercase requirement
      // Shouldn't be all caps (that's yelling)
      if (trimmed.length > 10 && trimmed === trimmed.toUpperCase()) {
        result.issues.push('Dialogue in ALL CAPS indicates yelling - is this intentional?');
      }
      break;

    case 'action':
      // No strict rules, but shouldn't be too long
      if (trimmed.length > 300) {
        result.issues.push('Action block is quite long - consider breaking into multiple paragraphs');
      }
      break;

    case 'note':
      // Notes are free-form
      break;
  }

  return result;
}

/**
 * Auto-format text based on element type
 * Applies standard screenplay formatting rules
 *
 * @param text - Text to format
 * @param elementType - Element type
 * @returns Formatted text
 */
export function autoFormatScreenplayElement(
  text: string,
  elementType: ScriptSceneElementType | 'character' | 'slugline'
): string {
  const trimmed = text.trim();

  switch (elementType) {
    case 'slugline':
    case 'character':
    case 'transition':
      // Uppercase
      return trimmed.toUpperCase();

    case 'parenthetical':
      // Ensure parentheses and lowercase content
      let content = trimmed;
      if (!content.startsWith('(')) content = '(' + content;
      if (!content.endsWith(')')) content = content + ')';
      // Lowercase the inner content
      if (content.length > 2) {
        const inner = content.slice(1, -1);
        content = '(' + inner.toLowerCase() + ')';
      }
      return content;

    case 'dialogue':
    case 'action':
    case 'note':
      // No transformation
      return trimmed;

    default:
      return trimmed;
  }
}

/**
 * Calculate approximate screen time for a page count
 * Industry rule of thumb: 1 page = 1 minute
 *
 * @param pages - Number of pages
 * @returns Estimated minutes
 */
export function calculateScreenTime(pages: number): number {
  return Math.round(pages);
}

/**
 * Calculate approximate page count from word count
 * Rough estimate: ~250 words per page for action-heavy scripts,
 * ~200 words per page for dialogue-heavy scripts
 *
 * @param words - Word count
 * @param dialogueHeavy - Whether the script is dialogue-heavy
 * @returns Estimated pages
 */
export function estimatePageCount(words: number, dialogueHeavy: boolean = false): number {
  const wordsPerPage = dialogueHeavy ? 200 : 250;
  return Math.round(words / wordsPerPage);
}

/**
 * Character count limits per line (at 12pt Courier)
 * Based on industry standards
 */
export const SCREENPLAY_LINE_LIMITS = {
  action: 61,        // Full width
  dialogue: 35,      // Narrower column
  parenthetical: 25, // Even narrower
  character: 33,     // Character name column
  slugline: 61,      // Full width
  transition: 20,    // Right-aligned, shorter
};

/**
 * Check if a line exceeds the character limit for its element type
 *
 * @param text - Line text
 * @param elementType - Element type
 * @returns True if line is too long
 */
export function isLineTooLong(
  text: string,
  elementType: ScriptSceneElementType | 'character' | 'slugline'
): boolean {
  const limit = SCREENPLAY_LINE_LIMITS[elementType as keyof typeof SCREENPLAY_LINE_LIMITS];
  return text.length > limit;
}

/**
 * Wrap text to fit within screenplay line limits
 *
 * @param text - Text to wrap
 * @param elementType - Element type
 * @returns Array of wrapped lines
 */
export function wrapTextToLineLimit(
  text: string,
  elementType: ScriptSceneElementType | 'character' | 'slugline'
): string[] {
  const limit = SCREENPLAY_LINE_LIMITS[elementType as keyof typeof SCREENPLAY_LINE_LIMITS];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > limit) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word exceeds limit, force break
        lines.push(word);
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Export configuration for different screenplay formats
 */
export interface ScreenplayExportConfig {
  includeTitlePage: boolean;
  includePageNumbers: boolean;
  startPageNumber: number;
  includeRevisionInfo: boolean;
  watermark?: string;
}

export const DEFAULT_EXPORT_CONFIG: ScreenplayExportConfig = {
  includeTitlePage: true,
  includePageNumbers: true,
  startPageNumber: 1,
  includeRevisionInfo: false,
};
