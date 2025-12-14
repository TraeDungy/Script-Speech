/**
 * Tests for Fountain Export Library
 * F052: Export to Fountain format
 */

import { describe, it, expect } from "vitest";
import {
  scriptDocToFountain,
  validateFountain,
  estimatePageCount,
  extractFountainMetadata,
  generateFountainFilename,
} from "./fountain";
import type { ScriptDoc, ScriptScene } from "@/lib/scriptDoc";

describe("Fountain Export Library - F052", () => {
  // Helper to create a minimal ScriptDoc for testing
  const createTestScriptDoc = (overrides?: Partial<ScriptDoc>): ScriptDoc => {
    return {
      metadata: {
        projectId: "test-project-1",
        title: "Test Script",
        format: "feature",
        genre: "Action",
        logline: "A test script for Fountain export",
        toneKeywords: ["exciting", "fast-paced"],
        targetLength: { unit: "pages", value: 110 },
        status: "draft",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      },
      revision: {
        id: "rev-1",
        version: "1.0",
        label: "First Draft",
        createdAt: "2024-01-01T00:00:00Z",
        createdBy: "John Doe",
      },
      referenceAssets: [],
      characters: [
        {
          id: "char-1",
          name: "JACK",
          description: "The protagonist",
          tags: [],
          notes: "",
          referenceAssetIds: [],
        },
      ],
      locations: [],
      props: [],
      beats: [],
      scenes: [],
      exportSnapshots: [],
      conceptAnalysis: {
        conceptSummary: "Test concept",
        keywords: ["action"],
        genreConfidence: [{ genre: "Action", confidence: 0.9 }],
        recommendedFormats: [],
        relatedProjects: [],
        isFranchiseExtension: false,
      },
      ...overrides,
    } as ScriptDoc;
  };

  const createTestScene = (overrides?: Partial<ScriptScene>): ScriptScene => {
    return {
      id: "scene-1",
      order: 1,
      title: "Opening Scene",
      summary: "Jack enters the room",
      slugline: {
        setting: "INT",
        location: "APARTMENT - LIVING ROOM",
        timeOfDay: "DAY",
      },
      elements: [],
      referenceAssetIds: [],
      locationIds: [],
      characterIds: [],
      propIds: [],
      ...overrides,
    } as ScriptScene;
  };

  describe("scriptDocToFountain", () => {
    it("should generate title page with basic metadata", () => {
      const doc = createTestScriptDoc();
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("Title: Test Script");
      expect(fountain).toContain("Author: John Doe");
      expect(fountain).toContain("Version: 1.0");
      expect(fountain).toContain("Genre: Action");
    });

    it("should include logline on title page", () => {
      const doc = createTestScriptDoc();
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("A test script for Fountain export");
    });

    it("should format scene heading correctly", () => {
      const scene = createTestScene();
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("INT. APARTMENT - LIVING ROOM - DAY");
    });

    it("should format action elements", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "action",
            text: "Jack enters the room cautiously.",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("Jack enters the room cautiously.");
    });

    it("should format dialogue with character name", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "dialogue",
            speaker: "Jack",
            text: "Hello, is anyone there?",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("JACK");
      expect(fountain).toContain("Hello, is anyone there?");
    });

    it("should format dialogue with parenthetical", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "dialogue",
            speaker: "Jack",
            text: "I can't believe it.",
            parenthetical: "whispering",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("JACK");
      expect(fountain).toContain("(whispering)");
      expect(fountain).toContain("I can't believe it.");
    });

    it("should format transitions", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "transition",
            text: "CUT TO",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("CUT TO:");
    });

    it("should add TO: to transitions that don't have it", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "transition",
            text: "FADE OUT",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("FADE OUT TO:");
    });

    it("should format notes with brackets", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "note",
            text: "This scene needs more tension",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("[[ This scene needs more tension ]]");
    });

    it("should format parenthetical elements", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "parenthetical",
            speaker: "Jack",
            text: "to himself",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("JACK");
      expect(fountain).toContain("(to himself)");
    });

    it("should handle multiple scenes", () => {
      const scene1 = createTestScene({
        id: "scene-1",
        order: 1,
        slugline: {
          setting: "INT",
          location: "APARTMENT",
          timeOfDay: "DAY",
        },
      });
      const scene2 = createTestScene({
        id: "scene-2",
        order: 2,
        slugline: {
          setting: "EXT",
          location: "STREET",
          timeOfDay: "NIGHT",
        },
      });
      const doc = createTestScriptDoc({ scenes: [scene1, scene2] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("INT. APARTMENT - DAY");
      expect(fountain).toContain("EXT. STREET - NIGHT");
    });

    it("should handle a complete scene with mixed elements", () => {
      const scene = createTestScene({
        elements: [
          {
            id: "elem-1",
            type: "action",
            text: "Jack enters the dimly lit room.",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
          {
            id: "elem-2",
            type: "dialogue",
            speaker: "Jack",
            text: "Anyone home?",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
          {
            id: "elem-3",
            type: "action",
            text: "Silence. He takes another step forward.",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
          {
            id: "elem-4",
            type: "dialogue",
            speaker: "Sarah",
            text: "Over here.",
            parenthetical: "off-screen",
            referenceAssetIds: [],
            locationIds: [],
            propIds: [],
          },
        ],
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("INT. APARTMENT - LIVING ROOM - DAY");
      expect(fountain).toContain("Jack enters the dimly lit room.");
      expect(fountain).toContain("JACK");
      expect(fountain).toContain("Anyone home?");
      expect(fountain).toContain("Silence. He takes another step forward.");
      expect(fountain).toContain("SARAH");
      expect(fountain).toContain("(off-screen)");
      expect(fountain).toContain("Over here.");
    });

    it("should handle INT/EXT scene settings", () => {
      const scene = createTestScene({
        slugline: {
          setting: "INT/EXT",
          location: "CAR",
          timeOfDay: "NIGHT",
        },
      });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      expect(fountain).toContain("INT/EXT. CAR - NIGHT");
    });

    it("should end with a single newline", () => {
      const doc = createTestScriptDoc();
      const fountain = scriptDocToFountain(doc);

      expect(fountain.endsWith("\n")).toBe(true);
      expect(fountain.endsWith("\n\n")).toBe(false);
    });

    it("should handle empty scenes array", () => {
      const doc = createTestScriptDoc({ scenes: [] });
      const fountain = scriptDocToFountain(doc);

      // Should still have title page
      expect(fountain).toContain("Title: Test Script");
      expect(fountain.length).toBeGreaterThan(0);
    });

    it("should handle scene with no elements", () => {
      const scene = createTestScene({ elements: [] });
      const doc = createTestScriptDoc({ scenes: [scene] });
      const fountain = scriptDocToFountain(doc);

      // Should still have scene heading
      expect(fountain).toContain("INT. APARTMENT - LIVING ROOM - DAY");
    });
  });

  describe("validateFountain", () => {
    it("should validate correct Fountain syntax", () => {
      const fountain = `Title: Test Script

INT. APARTMENT - DAY

Jack enters the room.

JACK
Hello?`;

      const result = validateFountain(fountain);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about non-uppercase scene headings", () => {
      const fountain = `Int. apartment - day

Jack enters.`;

      const result = validateFountain(fountain);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("uppercase"))).toBe(true);
    });

    it("should warn about parentheticals outside dialogue", () => {
      const fountain = `INT. ROOM - DAY

(whispering)
Some action here.`;

      const result = validateFountain(fountain);
      expect(result.warnings.some((w) => w.includes("outside of dialogue"))).toBe(true);
    });

    it("should recognize transitions", () => {
      const fountain = `INT. ROOM - DAY

Some action.

CUT TO:

EXT. STREET - DAY`;

      const result = validateFountain(fountain);
      // Should not have warnings about CUT TO: being a character name
      expect(result.valid).toBe(true);
    });

    it("should recognize notes", () => {
      const fountain = `INT. ROOM - DAY

[[ This is a note ]]

Action here.`;

      const result = validateFountain(fountain);
      expect(result.valid).toBe(true);
    });
  });

  describe("estimatePageCount", () => {
    it("should estimate page count based on lines", () => {
      // Create text with ~110 non-empty lines (should be 2 pages)
      const lines = Array(110).fill("This is a line of text.");
      const fountain = lines.join("\n");

      const pageCount = estimatePageCount(fountain);
      expect(pageCount).toBe(2);
    });

    it("should handle single page scripts", () => {
      const fountain = `Title: Short Script

INT. ROOM - DAY

JACK
One line.`;

      const pageCount = estimatePageCount(fountain);
      expect(pageCount).toBe(1);
    });

    it("should ignore empty lines", () => {
      const fountain = `Title: Test



INT. ROOM - DAY



JACK
Dialogue.



`;

      const pageCount = estimatePageCount(fountain);
      // Should only count non-empty lines
      expect(pageCount).toBe(1);
    });

    it("should round up partial pages", () => {
      // 56 lines should round up to 2 pages (55 lines per page)
      const lines = Array(56).fill("Text");
      const fountain = lines.join("\n");

      const pageCount = estimatePageCount(fountain);
      expect(pageCount).toBe(2);
    });
  });

  describe("extractFountainMetadata", () => {
    it("should extract title from title page", () => {
      const fountain = `Title: My Great Script
Author: Jane Smith

INT. ROOM - DAY`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.title).toBe("My Great Script");
    });

    it("should extract author from title page", () => {
      const fountain = `Title: Script
Author: John Doe

INT. ROOM - DAY`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.author).toBe("John Doe");
    });

    it("should extract genre from title page", () => {
      const fountain = `Title: Script
Genre: Sci-Fi

INT. ROOM - DAY`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.genre).toBe("Sci-Fi");
    });

    it("should extract draft info", () => {
      const fountain = `Title: Script
Draft date: 2024-01-01

INT. ROOM - DAY`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.draft).toBe("Draft date: 2024-01-01");
    });

    it("should stop after first blank line", () => {
      const fountain = `Title: Script

Author: Should Not Extract

INT. ROOM - DAY`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.title).toBe("Script");
      expect(metadata.author).toBeUndefined();
    });

    it("should handle missing metadata", () => {
      const fountain = `INT. ROOM - DAY

Action here.`;

      const metadata = extractFountainMetadata(fountain);
      expect(metadata.title).toBeUndefined();
      expect(metadata.author).toBeUndefined();
    });
  });

  describe("generateFountainFilename", () => {
    it("should generate filename with title", () => {
      const filename = generateFountainFilename("proj-123", "My Great Script");

      expect(filename).toContain("my_great_script");
      expect(filename).toMatch(/\.fountain$/);
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/); // Should have date
    });

    it("should generate filename without title", () => {
      const filename = generateFountainFilename("proj-123");

      expect(filename).toContain("proj-123");
      expect(filename).toMatch(/\.fountain$/);
    });

    it("should sanitize special characters", () => {
      const filename = generateFountainFilename("proj-123", "Test!@#$%Script");

      expect(filename).not.toContain("!");
      expect(filename).not.toContain("@");
      expect(filename).not.toContain("#");
      expect(filename).toMatch(/^[a-z0-9_-]+_\d{4}-\d{2}-\d{2}\.fountain$/);
    });

    it("should include current date", () => {
      const filename = generateFountainFilename("proj-123", "Test");
      const today = new Date().toISOString().split("T")[0];

      expect(filename).toContain(today);
    });
  });

  describe("Integration Tests - F052 Acceptance Criteria", () => {
    it("F052: should generate valid .fountain file", () => {
      const doc = createTestScriptDoc({
        scenes: [
          createTestScene({
            elements: [
              {
                id: "1",
                type: "action",
                text: "The hero enters.",
                referenceAssetIds: [],
                locationIds: [],
                propIds: [],
              },
            ],
          }),
        ],
      });

      const fountain = scriptDocToFountain(doc);
      const validation = validateFountain(fountain);

      expect(validation.valid).toBe(true);
      expect(fountain.length).toBeGreaterThan(0);
    });

    it("F052: should generate valid Fountain syntax", () => {
      const doc = createTestScriptDoc({
        scenes: [
          createTestScene({
            elements: [
              {
                id: "1",
                type: "dialogue",
                speaker: "Hero",
                text: "I'll save the day!",
                referenceAssetIds: [],
                locationIds: [],
                propIds: [],
              },
            ],
          }),
        ],
      });

      const fountain = scriptDocToFountain(doc);

      // Should have proper formatting
      expect(fountain).toContain("HERO"); // Character in caps
      expect(fountain).toContain("I'll save the day!");
      expect(fountain).toContain("INT. APARTMENT - LIVING ROOM - DAY"); // Scene heading

      // Should validate
      const validation = validateFountain(fountain);
      expect(validation.valid).toBe(true);
    });

    it("F052: should be importable into other tools", () => {
      // Test that format follows Fountain spec for compatibility
      const doc = createTestScriptDoc({
        metadata: {
          projectId: "test",
          title: "Compatibility Test",
          format: "feature",
          genre: "Drama",
          logline: "A test",
          toneKeywords: [],
          targetLength: { unit: "pages", value: 90 },
          status: "draft",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
        scenes: [
          createTestScene({
            slugline: {
              setting: "INT",
              location: "COFFEE SHOP",
              timeOfDay: "DAY",
            },
            elements: [
              {
                id: "1",
                type: "action",
                text: "Sarah sits alone at a table.",
                referenceAssetIds: [],
                locationIds: [],
                propIds: [],
              },
              {
                id: "2",
                type: "dialogue",
                speaker: "Sarah",
                text: "Where is he?",
                parenthetical: "checking her watch",
                referenceAssetIds: [],
                locationIds: [],
                propIds: [],
              },
            ],
          }),
        ],
      });

      const fountain = scriptDocToFountain(doc);

      // Should follow Fountain spec requirements:
      // 1. Scene headings in ALL CAPS
      expect(fountain).toMatch(/INT\. COFFEE SHOP - DAY/);

      // 2. Character names in ALL CAPS
      expect(fountain).toMatch(/SARAH/);

      // 3. Parentheticals in (parentheses)
      expect(fountain).toMatch(/\(checking her watch\)/);

      // 4. Title page with key: value format
      expect(fountain).toMatch(/Title: Compatibility Test/);

      // All these make it compatible with tools like Highland, WriterDuet, etc.
    });
  });
});
