/**
 * Tests for Voice Command Parser
 * F011: Voice command detection
 */

import { describe, it, expect } from "vitest";
import { CommandParser, createCommandParser, DEFAULT_COMMAND_PATTERNS, type CommandPattern } from "./commandParser";

describe("Voice Command Parser (F011)", () => {
  describe("Initialization", () => {
    it("should create parser with default patterns", () => {
      const parser = createCommandParser();
      expect(parser).toBeInstanceOf(CommandParser);
      expect(parser.getPatterns().length).toBeGreaterThan(0);
    });

    it("should create parser with custom patterns", () => {
      const customPatterns: CommandPattern[] = [
        {
          type: "custom_command",
          patterns: [/test/i],
          description: "A test command",
        },
      ];

      const parser = createCommandParser(customPatterns);
      expect(parser.getPatterns()).toEqual(customPatterns);
    });
  });

  describe("Scene Commands", () => {
    it("should detect 'new scene' command", () => {
      const parser = createCommandParser();

      const variations = ["new scene", "create a new scene", "add a scene", "make a new scene", "start a new scene"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("new_scene");
      }
    });

    it("should detect 'delete scene' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("delete this scene");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("delete_scene");
    });
  });

  describe("Character Commands", () => {
    it("should detect 'new character' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("new character");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("new_character");
    });

    it("should extract character name from command", () => {
      const parser = createCommandParser();

      const command = parser.parse("new character named John");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("new_character");
      expect(command?.params.name).toBe("John");
    });

    it("should handle character names with multiple words", () => {
      const parser = createCommandParser();

      const command = parser.parse("create a new character called Mary Jane");
      expect(command).not.toBeNull();
      expect(command?.params.name).toBe("Mary Jane");
    });

    it("should detect 'delete character' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("delete character");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("delete_character");
    });
  });

  describe("Generic Commands", () => {
    it("should detect 'delete' command", () => {
      const parser = createCommandParser();

      const variations = ["delete that", "delete this", "remove that", "get rid of it"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("delete");
      }
    });

    it("should detect 'undo' command", () => {
      const parser = createCommandParser();

      const variations = ["undo", "undo that", "go back", "step back", "revert"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("undo");
      }
    });

    it("should detect 'redo' command", () => {
      const parser = createCommandParser();

      const variations = ["redo", "redo that", "go forward", "do it again"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("redo");
      }
    });

    it("should detect 'save' command", () => {
      const parser = createCommandParser();

      const variations = ["save", "save this", "save the script", "save my work"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("save");
      }
    });
  });

  describe("Formatting Commands", () => {
    it("should detect 'make bold' command", () => {
      const parser = createCommandParser();

      const variations = ["make that bold", "bold", "make it bold"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("make_bold");
      }
    });

    it("should detect 'make italic' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("make that italic");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("make_italic");
    });

    it("should detect 'make underline' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("underline that");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("make_underline");
    });
  });

  describe("Navigation Commands", () => {
    it("should detect 'go to scene' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("go to scene 5");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("go_to_scene");
      expect(command?.params.identifier).toBe("5");
    });

    it("should extract scene identifier", () => {
      const parser = createCommandParser();

      const command = parser.parse("jump to scene Act 2 Scene 1");
      expect(command?.params.identifier).toBe("Act 2 Scene 1");
    });
  });

  describe("Help Commands", () => {
    it("should detect 'help' command", () => {
      const parser = createCommandParser();

      const variations = ["help", "show commands", "what can I say", "show voice commands"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("help");
      }
    });
  });

  describe("Playback Commands", () => {
    it("should detect 'read aloud' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("read this aloud");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("read_aloud");
    });

    it("should detect 'stop' command", () => {
      const parser = createCommandParser();

      const variations = ["stop", "stop that", "pause", "halt"];

      for (const text of variations) {
        const command = parser.parse(text);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("stop");
      }
    });
  });

  describe("Export Commands", () => {
    it("should detect 'export' command", () => {
      const parser = createCommandParser();

      const command = parser.parse("export");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("export");
    });

    it("should extract export format", () => {
      const parser = createCommandParser();

      const command = parser.parse("export as PDF");
      expect(command).not.toBeNull();
      expect(command?.params.format).toBe("pdf");
    });
  });

  describe("Command Confidence", () => {
    it("should return confidence score", () => {
      const parser = createCommandParser();

      const command = parser.parse("new scene");
      expect(command).not.toBeNull();
      expect(command?.confidence).toBeGreaterThan(0);
      expect(command?.confidence).toBeLessThanOrEqual(1);
    });

    it("should give higher confidence to exact matches", () => {
      const parser = createCommandParser();

      const exact = parser.parse("undo");
      const fuzzy = parser.parse("undo that thing I just did");

      expect(exact?.confidence).toBeGreaterThan(fuzzy?.confidence || 0);
    });
  });

  describe("Multiple Commands", () => {
    it("should return first matched command with parse()", () => {
      const parser = createCommandParser();

      const command = parser.parse("new scene");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("new_scene");
    });

    it("should return all matched commands with parseAll()", () => {
      const parser = createCommandParser();

      // Text that could match multiple patterns
      const commands = parser.parseAll("new scene");
      expect(commands.length).toBeGreaterThan(0);
    });
  });

  describe("Pattern Management", () => {
    it("should add custom pattern", () => {
      const parser = createCommandParser();
      const initialCount = parser.getPatterns().length;

      parser.addPattern({
        type: "custom_test",
        patterns: [/test command/i],
        description: "A test command",
      });

      expect(parser.getPatterns().length).toBe(initialCount + 1);

      const command = parser.parse("test command");
      expect(command?.type).toBe("custom_test");
    });

    it("should remove pattern by type", () => {
      const parser = createCommandParser();

      parser.removePattern("new_scene");

      const command = parser.parse("new scene");
      // Should not match the removed pattern
      expect(command?.type).not.toBe("new_scene");
    });

    it("should get help text", () => {
      const parser = createCommandParser();

      const help = parser.getHelp();
      expect(help.length).toBeGreaterThan(0);
      expect(help[0]).toHaveProperty("type");
      expect(help[0]).toHaveProperty("description");
    });
  });

  describe("Edge Cases", () => {
    it("should return null for empty text", () => {
      const parser = createCommandParser();

      const command = parser.parse("");
      expect(command).toBeNull();
    });

    it("should return null for whitespace only", () => {
      const parser = createCommandParser();

      const command = parser.parse("   ");
      expect(command).toBeNull();
    });

    it("should return null for unmatched text", () => {
      const parser = createCommandParser();

      const command = parser.parse("this is not a command");
      expect(command).toBeNull();
    });

    it("should handle case insensitive matching", () => {
      const parser = createCommandParser();

      const upper = parser.parse("NEW SCENE");
      const lower = parser.parse("new scene");
      const mixed = parser.parse("NeW ScEnE");

      expect(upper?.type).toBe("new_scene");
      expect(lower?.type).toBe("new_scene");
      expect(mixed?.type).toBe("new_scene");
    });

    it("should preserve original text in rawText", () => {
      const parser = createCommandParser();

      const originalText = "NEW SCENE Please";
      const command = parser.parse(originalText);

      expect(command?.rawText).toBe(originalText);
    });

    it("should include timestamp", () => {
      const parser = createCommandParser();

      const before = Date.now();
      const command = parser.parse("new scene");
      const after = Date.now();

      expect(command?.timestamp).toBeGreaterThanOrEqual(before);
      expect(command?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("Performance", () => {
    it("should parse commands quickly (< 100ms)", () => {
      const parser = createCommandParser();

      const start = Date.now();
      parser.parse("new scene");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should handle multiple parse calls efficiently", () => {
      const parser = createCommandParser();

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        parser.parse("new scene");
      }
      const duration = Date.now() - start;

      // 100 parses should complete in reasonable time
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Default Command Coverage", () => {
    it("should have 10+ command types", () => {
      const uniqueTypes = new Set(DEFAULT_COMMAND_PATTERNS.map((p) => p.type));
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(10);
    });

    it("should have descriptions for all commands", () => {
      const withoutDescription = DEFAULT_COMMAND_PATTERNS.filter((p) => !p.description);
      expect(withoutDescription.length).toBe(0);
    });
  });
});
