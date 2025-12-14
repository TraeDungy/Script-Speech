/**
 * Tests for Character CRUD Operations
 * F029: Character creation
 */

import { describe, it, expect } from "vitest";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";
import {
  generateCharacterId,
  createCharacter,
  updateCharacter,
  findCharacterById,
  findCharacterByName,
  sortCharactersByName,
  searchCharacters,
  deleteCharacter,
  filterCharactersByTag,
  getCharacterStats,
  validateCharacter,
  type CreateCharacterInput,
} from "./crud";

describe("Character CRUD Operations", () => {
  describe("generateCharacterId", () => {
    it("should generate a unique ID", () => {
      const id1 = generateCharacterId();
      const id2 = generateCharacterId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it("should generate a string ID", () => {
      const id = generateCharacterId();
      expect(typeof id).toBe("string");
    });
  });

  describe("createCharacter", () => {
    it("should create a character with minimal required data", () => {
      const input: CreateCharacterInput = {
        name: "John Doe",
      };

      const character = createCharacter(input);

      expect(character).toMatchObject({
        id: expect.any(String),
        name: "John Doe",
        description: "",
        tags: [],
        referenceAssetIds: [],
      });
    });

    it("should create a character with all optional fields", () => {
      const input: CreateCharacterInput = {
        name: "Jane Smith",
        description: "A brave detective",
        pronouns: "she/her",
        archetype: "Hero",
        goal: "Solve the mystery",
        arc: "Redemption",
        voiceNotes: "Deep voice with slight accent",
        tags: ["protagonist", "detective"],
        notes: "Based on classic noir characters",
        referenceAssetIds: ["asset1", "asset2"],
      };

      const character = createCharacter(input);

      expect(character).toMatchObject({
        id: expect.any(String),
        name: "Jane Smith",
        description: "A brave detective",
        pronouns: "she/her",
        archetype: "Hero",
        goal: "Solve the mystery",
        arc: "Redemption",
        voiceNotes: "Deep voice with slight accent",
        tags: ["protagonist", "detective"],
        notes: "Based on classic noir characters",
        referenceAssetIds: ["asset1", "asset2"],
      });
    });

    it("should trim whitespace from string fields", () => {
      const input: CreateCharacterInput = {
        name: "  Trimmed Name  ",
        description: "  Trimmed Description  ",
      };

      const character = createCharacter(input);

      expect(character.name).toBe("Trimmed Name");
      expect(character.description).toBe("Trimmed Description");
    });
  });

  describe("updateCharacter", () => {
    it("should update character fields", () => {
      const original: ScriptDocCharacter = {
        id: "char1",
        name: "Original Name",
        description: "Original description",
        tags: [],
        referenceAssetIds: [],
      };

      const updated = updateCharacter(original, {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(updated).toMatchObject({
        id: "char1",
        name: "Updated Name",
        description: "Updated description",
      });
    });

    it("should preserve ID when updating", () => {
      const original: ScriptDocCharacter = {
        id: "char1",
        name: "Name",
        tags: [],
        referenceAssetIds: [],
      };

      const updated = updateCharacter(original, { name: "New Name" });

      expect(updated.id).toBe("char1");
    });

    it("should allow partial updates", () => {
      const original: ScriptDocCharacter = {
        id: "char1",
        name: "Name",
        description: "Description",
        archetype: "Archetype",
        tags: [],
        referenceAssetIds: [],
      };

      const updated = updateCharacter(original, { archetype: "New Archetype" });

      expect(updated).toMatchObject({
        id: "char1",
        name: "Name",
        description: "Description",
        archetype: "New Archetype",
      });
    });
  });

  describe("findCharacterById", () => {
    const characters: ScriptDocCharacter[] = [
      { id: "char1", name: "Alice", tags: [], referenceAssetIds: [] },
      { id: "char2", name: "Bob", tags: [], referenceAssetIds: [] },
      { id: "char3", name: "Charlie", tags: [], referenceAssetIds: [] },
    ];

    it("should find character by ID", () => {
      const found = findCharacterById(characters, "char2");
      expect(found).toMatchObject({ id: "char2", name: "Bob" });
    });

    it("should return undefined if not found", () => {
      const found = findCharacterById(characters, "nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("findCharacterByName", () => {
    const characters: ScriptDocCharacter[] = [
      { id: "char1", name: "Alice", tags: [], referenceAssetIds: [] },
      { id: "char2", name: "Bob", tags: [], referenceAssetIds: [] },
      { id: "char3", name: "Charlie", tags: [], referenceAssetIds: [] },
    ];

    it("should find character by name (case-insensitive)", () => {
      const found = findCharacterByName(characters, "alice");
      expect(found).toMatchObject({ id: "char1", name: "Alice" });
    });

    it("should find character with exact case", () => {
      const found = findCharacterByName(characters, "Bob");
      expect(found).toMatchObject({ id: "char2", name: "Bob" });
    });

    it("should return undefined if not found", () => {
      const found = findCharacterByName(characters, "Dave");
      expect(found).toBeUndefined();
    });

    it("should trim whitespace before searching", () => {
      const found = findCharacterByName(characters, "  Charlie  ");
      expect(found).toMatchObject({ id: "char3", name: "Charlie" });
    });
  });

  describe("sortCharactersByName", () => {
    it("should sort characters alphabetically", () => {
      const characters: ScriptDocCharacter[] = [
        { id: "char1", name: "Charlie", tags: [], referenceAssetIds: [] },
        { id: "char2", name: "Alice", tags: [], referenceAssetIds: [] },
        { id: "char3", name: "Bob", tags: [], referenceAssetIds: [] },
      ];

      const sorted = sortCharactersByName(characters);

      expect(sorted.map((c) => c.name)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should be case-insensitive", () => {
      const characters: ScriptDocCharacter[] = [
        { id: "char1", name: "zebra", tags: [], referenceAssetIds: [] },
        { id: "char2", name: "Apple", tags: [], referenceAssetIds: [] },
        { id: "char3", name: "banana", tags: [], referenceAssetIds: [] },
      ];

      const sorted = sortCharactersByName(characters);

      expect(sorted.map((c) => c.name)).toEqual(["Apple", "banana", "zebra"]);
    });

    it("should not mutate original array", () => {
      const characters: ScriptDocCharacter[] = [
        { id: "char1", name: "Charlie", tags: [], referenceAssetIds: [] },
        { id: "char2", name: "Alice", tags: [], referenceAssetIds: [] },
      ];

      const originalOrder = characters.map((c) => c.name);
      sortCharactersByName(characters);

      expect(characters.map((c) => c.name)).toEqual(originalOrder);
    });
  });

  describe("searchCharacters", () => {
    const characters: ScriptDocCharacter[] = [
      {
        id: "char1",
        name: "John Doe",
        description: "A detective in New York",
        archetype: "Hero",
        tags: ["protagonist"],
        referenceAssetIds: [],
      },
      {
        id: "char2",
        name: "Jane Smith",
        description: "A lawyer",
        archetype: "Mentor",
        tags: ["supporting"],
        referenceAssetIds: [],
      },
      {
        id: "char3",
        name: "Bob Johnson",
        description: "A villain who seeks revenge",
        tags: ["antagonist"],
        referenceAssetIds: [],
      },
    ];

    it("should search by name", () => {
      const results = searchCharacters(characters, "john");
      expect(results).toHaveLength(2);
      expect(results.map((c) => c.name)).toContain("John Doe");
      expect(results.map((c) => c.name)).toContain("Bob Johnson");
    });

    it("should search by description", () => {
      const results = searchCharacters(characters, "revenge");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Bob Johnson");
    });

    it("should search by archetype", () => {
      const results = searchCharacters(characters, "hero");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("John Doe");
    });

    it("should search by tags", () => {
      const results = searchCharacters(characters, "protagonist");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("John Doe");
    });

    it("should return all characters for empty query", () => {
      const results = searchCharacters(characters, "");
      expect(results).toHaveLength(3);
    });

    it("should be case-insensitive", () => {
      const results = searchCharacters(characters, "JANE");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Jane Smith");
    });
  });

  describe("deleteCharacter", () => {
    const characters: ScriptDocCharacter[] = [
      { id: "char1", name: "Alice", tags: [], referenceAssetIds: [] },
      { id: "char2", name: "Bob", tags: [], referenceAssetIds: [] },
      { id: "char3", name: "Charlie", tags: [], referenceAssetIds: [] },
    ];

    it("should delete character by ID", () => {
      const updated = deleteCharacter(characters, "char2");

      expect(updated).toHaveLength(2);
      expect(updated.map((c) => c.id)).toEqual(["char1", "char3"]);
    });

    it("should return original array if ID not found", () => {
      const updated = deleteCharacter(characters, "nonexistent");

      expect(updated).toHaveLength(3);
    });

    it("should not mutate original array", () => {
      const originalLength = characters.length;
      deleteCharacter(characters, "char1");

      expect(characters).toHaveLength(originalLength);
    });
  });

  describe("filterCharactersByTag", () => {
    const characters: ScriptDocCharacter[] = [
      { id: "char1", name: "Alice", tags: ["protagonist", "hero"], referenceAssetIds: [] },
      { id: "char2", name: "Bob", tags: ["antagonist"], referenceAssetIds: [] },
      { id: "char3", name: "Charlie", tags: ["protagonist", "sidekick"], referenceAssetIds: [] },
    ];

    it("should filter characters by tag", () => {
      const results = filterCharactersByTag(characters, "protagonist");

      expect(results).toHaveLength(2);
      expect(results.map((c) => c.name)).toContain("Alice");
      expect(results.map((c) => c.name)).toContain("Charlie");
    });

    it("should return empty array if tag not found", () => {
      const results = filterCharactersByTag(characters, "nonexistent");

      expect(results).toHaveLength(0);
    });
  });

  describe("getCharacterStats", () => {
    const characters: ScriptDocCharacter[] = [
      {
        id: "char1",
        name: "Alice",
        description: "A detective",
        goal: "Solve the case",
        archetype: "Hero",
        voiceNotes: "Deep voice",
        referenceAssetIds: ["asset1"],
        tags: [],
      },
      {
        id: "char2",
        name: "Bob",
        description: "",
        tags: [],
        referenceAssetIds: [],
      },
      {
        id: "char3",
        name: "Charlie",
        goal: "Get revenge",
        tags: [],
        referenceAssetIds: [],
      },
    ];

    it("should calculate character statistics", () => {
      const stats = getCharacterStats(characters);

      expect(stats).toEqual({
        total: 3,
        withDescription: 1,
        withGoals: 2,
        withArchetype: 1,
        withVoiceNotes: 1,
        withReferenceAssets: 1,
      });
    });

    it("should handle empty array", () => {
      const stats = getCharacterStats([]);

      expect(stats).toEqual({
        total: 0,
        withDescription: 0,
        withGoals: 0,
        withArchetype: 0,
        withVoiceNotes: 0,
        withReferenceAssets: 0,
      });
    });
  });

  describe("validateCharacter", () => {
    it("should validate valid character data", () => {
      const input: CreateCharacterInput = {
        name: "Valid Name",
        description: "Valid description",
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty name", () => {
      const input: CreateCharacterInput = {
        name: "",
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Character name is required");
    });

    it("should reject whitespace-only name", () => {
      const input: CreateCharacterInput = {
        name: "   ",
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Character name is required");
    });

    it("should reject name that is too long", () => {
      const input: CreateCharacterInput = {
        name: "A".repeat(101),
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Character name must be 100 characters or less");
    });

    it("should reject description that is too long", () => {
      const input: CreateCharacterInput = {
        name: "Valid Name",
        description: "A".repeat(1001),
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Description must be 1000 characters or less");
    });

    it("should reject goal that is too long", () => {
      const input: CreateCharacterInput = {
        name: "Valid Name",
        goal: "A".repeat(501),
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Goal must be 500 characters or less");
    });

    it("should return multiple errors", () => {
      const input: CreateCharacterInput = {
        name: "",
        description: "A".repeat(1001),
      };

      const result = validateCharacter(input);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  // F029 Acceptance Criteria Tests
  describe("F029 Acceptance Criteria", () => {
    it("should create character with name", () => {
      const input: CreateCharacterInput = {
        name: "Test Character",
      };

      const character = createCharacter(input);

      expect(character.name).toBe("Test Character");
      expect(character.id).toBeTruthy();
    });

    it("should create character with description", () => {
      const input: CreateCharacterInput = {
        name: "Test Character",
        description: "A test description",
      };

      const character = createCharacter(input);

      expect(character.description).toBe("A test description");
    });

    it("should create character with goals", () => {
      const input: CreateCharacterInput = {
        name: "Test Character",
        goal: "Achieve something great",
      };

      const character = createCharacter(input);

      expect(character.goal).toBe("Achieve something great");
    });

    it("should support all character fields from schema", () => {
      const input: CreateCharacterInput = {
        name: "Complete Character",
        description: "Full description",
        pronouns: "they/them",
        archetype: "Trickster",
        goal: "Change the world",
        arc: "Transformation",
        voiceNotes: "Raspy voice",
        tags: ["tag1", "tag2"],
        notes: "Additional notes",
        referenceAssetIds: ["asset1"],
      };

      const character = createCharacter(input);

      expect(character).toMatchObject(input);
      expect(character.id).toBeTruthy();
    });
  });
});
