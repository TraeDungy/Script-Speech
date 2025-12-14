/**
 * Character CRUD Operations
 * F029: Character creation
 *
 * Utility functions for creating, reading, updating, and deleting characters
 * in the ScriptDoc. Characters are stored in the `doc.characters` array.
 */

import type { ScriptDocCharacter } from "@/lib/scriptDoc";

/**
 * Generate a random ID for a character
 */
export const generateCharacterId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Create a new character with default values
 */
export interface CreateCharacterInput {
  name: string;
  description?: string;
  pronouns?: string;
  archetype?: string;
  goal?: string;
  arc?: string;
  voiceNotes?: string;
  tags?: string[];
  notes?: string;
  referenceAssetIds?: string[];
}

export const createCharacter = (
  input: CreateCharacterInput
): ScriptDocCharacter => {
  const id = generateCharacterId();

  return {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || "",
    pronouns: input.pronouns?.trim(),
    archetype: input.archetype?.trim(),
    goal: input.goal?.trim(),
    arc: input.arc?.trim(),
    voiceNotes: input.voiceNotes?.trim(),
    tags: input.tags || [],
    notes: input.notes?.trim(),
    referenceAssetIds: input.referenceAssetIds || [],
  };
};

/**
 * Update a character's fields
 */
export const updateCharacter = (
  character: ScriptDocCharacter,
  updates: Partial<Omit<ScriptDocCharacter, "id">>
): ScriptDocCharacter => {
  return {
    ...character,
    ...updates,
    id: character.id, // Preserve ID
  };
};

/**
 * Find a character by ID
 */
export const findCharacterById = (
  characters: ScriptDocCharacter[],
  id: string
): ScriptDocCharacter | undefined => {
  return characters.find((char) => char.id === id);
};

/**
 * Find a character by name (case-insensitive)
 */
export const findCharacterByName = (
  characters: ScriptDocCharacter[],
  name: string
): ScriptDocCharacter | undefined => {
  const searchName = name.toLowerCase().trim();
  return characters.find((char) => char.name.toLowerCase() === searchName);
};

/**
 * Sort characters alphabetically by name
 */
export const sortCharactersByName = (
  characters: ScriptDocCharacter[]
): ScriptDocCharacter[] => {
  return [...characters].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
};

/**
 * Filter characters by search query
 * Searches in name, description, archetype, and tags
 */
export const searchCharacters = (
  characters: ScriptDocCharacter[],
  query: string
): ScriptDocCharacter[] => {
  if (!query || query.trim() === "") {
    return characters;
  }

  const searchTerm = query.toLowerCase().trim();

  return characters.filter((char) => {
    // Search in name
    if (char.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in description
    if (char.description && char.description.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in archetype
    if (char.archetype && char.archetype.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in tags
    if (char.tags && char.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
      return true;
    }

    return false;
  });
};

/**
 * Delete a character by ID
 * Returns the updated characters array
 */
export const deleteCharacter = (
  characters: ScriptDocCharacter[],
  id: string
): ScriptDocCharacter[] => {
  return characters.filter((char) => char.id !== id);
};

/**
 * Get characters with a specific tag
 */
export const filterCharactersByTag = (
  characters: ScriptDocCharacter[],
  tag: string
): ScriptDocCharacter[] => {
  return characters.filter(
    (char) => char.tags && char.tags.includes(tag)
  );
};

/**
 * Get character statistics
 */
export interface CharacterStats {
  total: number;
  withDescription: number;
  withGoals: number;
  withArchetype: number;
  withVoiceNotes: number;
  withReferenceAssets: number;
}

export const getCharacterStats = (
  characters: ScriptDocCharacter[]
): CharacterStats => {
  return {
    total: characters.length,
    withDescription: characters.filter((c) => c.description && c.description.length > 0).length,
    withGoals: characters.filter((c) => c.goal && c.goal.length > 0).length,
    withArchetype: characters.filter((c) => c.archetype && c.archetype.length > 0).length,
    withVoiceNotes: characters.filter((c) => c.voiceNotes && c.voiceNotes.length > 0).length,
    withReferenceAssets: characters.filter((c) => c.referenceAssetIds && c.referenceAssetIds.length > 0).length,
  };
};

/**
 * Validate character data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateCharacter = (
  input: CreateCharacterInput
): ValidationResult => {
  const errors: string[] = [];

  // Name is required and must not be empty
  if (!input.name || input.name.trim().length === 0) {
    errors.push("Character name is required");
  }

  // Name should not be too long
  if (input.name && input.name.length > 100) {
    errors.push("Character name must be 100 characters or less");
  }

  // Description should not be too long
  if (input.description && input.description.length > 1000) {
    errors.push("Description must be 1000 characters or less");
  }

  // Goal should not be too long
  if (input.goal && input.goal.length > 500) {
    errors.push("Goal must be 500 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
