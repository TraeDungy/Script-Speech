/**
 * Voice Command Parser
 * F011: Voice command detection
 *
 * Parses transcribed text to detect voice commands
 */

export interface VoiceCommand {
  /**
   * The command type (e.g., "new_scene", "new_character", "delete")
   */
  type: string;

  /**
   * Original text that was matched
   */
  rawText: string;

  /**
   * Extracted parameters from the command
   */
  params: Record<string, string | number | boolean>;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Timestamp when command was detected
   */
  timestamp: number;
}

export interface CommandPattern {
  /**
   * Command type identifier
   */
  type: string;

  /**
   * List of regex patterns to match this command
   */
  patterns: RegExp[];

  /**
   * Function to extract parameters from matched text
   */
  extractParams?: (match: RegExpMatchArray, text: string) => Record<string, string | number | boolean>;

  /**
   * Aliases for this command
   */
  aliases?: string[];

  /**
   * Description for help text
   */
  description?: string;
}

/**
 * Default command patterns for voice commands
 */
export const DEFAULT_COMMAND_PATTERNS: CommandPattern[] = [
  // Scene commands
  {
    type: "new_scene",
    patterns: [
      /(?:create|add|new|make)\s+(?:a\s+)?(?:new\s+)?scene/i,
      /(?:start|begin)\s+(?:a\s+)?(?:new\s+)?scene/i,
      /scene\s+(?:creation|new)/i,
    ],
    description: "Create a new scene",
  },
  {
    type: "delete_scene",
    patterns: [/(?:delete|remove)\s+(?:this\s+|current\s+)?scene/i, /scene\s+(?:deletion|remove)/i],
    description: "Delete current scene",
  },

  // Character commands
  {
    type: "new_character",
    patterns: [
      /(?:create|add|new|make)\s+(?:a\s+)?(?:new\s+)?character(?:\s+(?:named|called)\s+)?(.+)?/i,
      /(?:new|add)\s+character\s+(.+)/i,
    ],
    extractParams: (match) => {
      const name = match[1]?.trim();
      return name ? { name } : {};
    },
    description: "Create a new character",
  },
  {
    type: "delete_character",
    patterns: [/(?:delete|remove)\s+character(?:\s+(.+))?/i],
    extractParams: (match) => {
      const name = match[1]?.trim();
      return name ? { name } : {};
    },
    description: "Delete a character",
  },

  // Generic delete/undo commands
  {
    type: "delete",
    patterns: [/(?:delete|remove)\s+(?:that|this|it)/i, /(?:get\s+)?rid\s+of\s+(?:that|this|it)/i],
    description: "Delete the last element",
  },
  {
    type: "undo",
    patterns: [/undo(?:\s+that)?/i, /(?:go|step)\s+back/i, /revert(?:\s+that)?/i],
    description: "Undo last action",
  },
  {
    type: "redo",
    patterns: [/redo(?:\s+that)?/i, /(?:go|step)\s+forward/i, /(?:do|repeat)\s+(?:it\s+)?again/i],
    description: "Redo last undone action",
  },

  // Save commands
  {
    type: "save",
    patterns: [/save(?:\s+(?:this|it|script|project))?/i, /(?:please\s+)?save\s+(?:my\s+)?work/i],
    description: "Save the current script",
  },
  {
    type: "export",
    patterns: [/export(?:\s+(?:as|to)\s+(.+))?/i, /(?:download|generate)\s+(.+)/i],
    extractParams: (match) => {
      const format = match[1]?.trim().toLowerCase();
      return format ? { format } : {};
    },
    description: "Export the script",
  },

  // Formatting commands
  {
    type: "make_bold",
    patterns: [/(?:make|set)\s+(?:that|this|it)\s+bold/i, /bold(?:\s+that)?/i],
    description: "Make selected text bold",
  },
  {
    type: "make_italic",
    patterns: [/(?:make|set)\s+(?:that|this|it)\s+italic/i, /italic(?:ize)?(?:\s+that)?/i],
    description: "Make selected text italic",
  },
  {
    type: "make_underline",
    patterns: [/(?:make|set)\s+(?:that|this|it)\s+underlined?/i, /underline(?:\s+that)?/i],
    description: "Underline selected text",
  },

  // Navigation commands
  {
    type: "go_to_scene",
    patterns: [
      /(?:go\s+to|jump\s+to|show|open)\s+scene\s+(.+)/i,
      /scene\s+(.+)(?:\s+please)?/i,
    ],
    extractParams: (match) => {
      const identifier = match[1]?.trim();
      return identifier ? { identifier } : {};
    },
    description: "Navigate to a specific scene",
  },

  // Help commands
  {
    type: "help",
    patterns: [/(?:show|display)\s+(?:voice\s+)?(?:commands|help)/i, /what\s+can\s+(?:I|you)\s+(?:say|do)/i, /help(?:\s+me)?/i],
    description: "Show available voice commands",
  },

  // Playback commands
  {
    type: "read_aloud",
    patterns: [/(?:read|play)\s+(?:this|that|it)\s+(?:aloud|out\s+loud)?/i, /hear\s+(?:this|that|it)/i],
    description: "Read current selection aloud",
  },
  {
    type: "stop",
    patterns: [/stop(?:\s+(?:that|it|reading|playing))?/i, /(?:pause|halt)(?:\s+that)?/i],
    description: "Stop current playback",
  },
];

/**
 * Command Parser class
 */
export class CommandParser {
  private patterns: CommandPattern[];

  constructor(customPatterns?: CommandPattern[]) {
    this.patterns = customPatterns || DEFAULT_COMMAND_PATTERNS;
  }

  /**
   * Parse text and detect voice commands
   */
  parse(text: string): VoiceCommand | null {
    const trimmedText = text.trim();
    const normalizedText = trimmedText.toLowerCase();

    if (!normalizedText) {
      return null;
    }

    // Try to match against each pattern
    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedText.match(regex);

        if (match) {
          // Extract parameters if extractor is provided
          // Use original text to preserve case
          let params: Record<string, string | number | boolean> = {};
          if (pattern.extractParams) {
            const originalMatch = trimmedText.match(regex);
            params = pattern.extractParams(originalMatch || match, trimmedText);
          }

          // Calculate confidence based on match quality
          const confidence = this.calculateConfidence(match, normalizedText);

          return {
            type: pattern.type,
            rawText: text,
            params,
            confidence,
            timestamp: Date.now(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse text and return all possible command matches
   */
  parseAll(text: string): VoiceCommand[] {
    const commands: VoiceCommand[] = [];
    const trimmedText = text.trim();
    const normalizedText = trimmedText.toLowerCase();

    if (!normalizedText) {
      return commands;
    }

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedText.match(regex);

        if (match) {
          let params: Record<string, string | number | boolean> = {};
          if (pattern.extractParams) {
            const originalMatch = trimmedText.match(regex);
            params = pattern.extractParams(originalMatch || match, trimmedText);
          }

          const confidence = this.calculateConfidence(match, normalizedText);

          commands.push({
            type: pattern.type,
            rawText: text,
            params,
            confidence,
            timestamp: Date.now(),
          });
        }
      }
    }

    return commands;
  }

  /**
   * Add a custom command pattern
   */
  addPattern(pattern: CommandPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove a command pattern by type
   */
  removePattern(type: string): void {
    this.patterns = this.patterns.filter((p) => p.type !== type);
  }

  /**
   * Get all registered command patterns
   */
  getPatterns(): CommandPattern[] {
    return [...this.patterns];
  }

  /**
   * Get help text for all commands
   */
  getHelp(): Array<{ type: string; description: string }> {
    return this.patterns
      .filter((p) => p.description)
      .map((p) => ({
        type: p.type,
        description: p.description || "",
      }));
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(match: RegExpMatchArray, text: string): number {
    // Base confidence
    let confidence = 0.7;

    // Boost if match is exact or nearly exact
    const matchLength = match[0].length;
    const textLength = text.length;
    const coverage = matchLength / textLength;

    if (coverage > 0.9) {
      confidence = 0.95;
    } else if (coverage > 0.7) {
      confidence = 0.85;
    }

    // Boost if match starts at beginning
    if (match.index === 0) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1);
  }
}

/**
 * Create a default command parser
 */
export function createCommandParser(customPatterns?: CommandPattern[]): CommandParser {
  return new CommandParser(customPatterns);
}
