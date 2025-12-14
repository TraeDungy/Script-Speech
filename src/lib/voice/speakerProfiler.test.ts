/**
 * Tests for Speaker Profile Linking
 * F010: Speaker profile creation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SpeakerProfiler,
  createSpeakerProfiler,
  linkSpeakerToExistingCharacter,
  enrichCharactersWithVoiceData,
  type SpeakerProfilerCallbacks,
  type SpeakerProfileLinkResult,
} from "./speakerProfiler";
import type { Speaker, VoiceProfile } from "./types";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";

// Helper to create test speakers
function createTestSpeaker(
  id: string,
  label: string,
  characterName?: string,
  voiceProfile?: VoiceProfile
): Speaker {
  return {
    id,
    label,
    confidence: 0.85,
    characterName,
    voiceProfile: voiceProfile || {
      pitch: 0.5,
      tempo: 0.6,
      energy: 0.7,
    },
  };
}

// Helper to create test character
function createTestCharacter(id: string, name: string): ScriptDocCharacter {
  return {
    id,
    name,
    description: "Test character",
    tags: [],
    referenceAssetIds: [],
  };
}

describe("SpeakerProfiler", () => {
  let profiler: SpeakerProfiler;
  let callbacks: SpeakerProfilerCallbacks;

  beforeEach(() => {
    callbacks = {
      onSpeakerLinked: vi.fn(),
      onCharacterCreated: vi.fn(),
      onError: vi.fn(),
    };
    profiler = new SpeakerProfiler(callbacks);
  });

  describe("linkSpeakerToCharacter", () => {
    it("should create new character when none exists", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1");
      const existingCharacters: ScriptDocCharacter[] = [];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(result.wasCreated).toBe(true);
      expect(result.character.name).toBe("Speaker 1");
      expect(result.character.tags).toContain("voice-generated");
      expect(result.character.description).toContain("auto-generated");
      expect(result.speaker).toBe(speaker);
    });

    it("should link to existing character by name", () => {
      const speaker = createTestSpeaker("speaker_1", "John");
      const existingCharacter = createTestCharacter("char_1", "John");
      const existingCharacters = [existingCharacter];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(result.wasCreated).toBe(false);
      expect(result.character.id).toBe("char_1");
      expect(result.character.name).toBe("John");
    });

    it("should use characterName if available", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1", "Jane Doe");
      const existingCharacters: ScriptDocCharacter[] = [];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(result.character.name).toBe("Jane Doe");
    });

    it("should call onCharacterCreated when creating new character", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1");
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(callbacks.onCharacterCreated).toHaveBeenCalledTimes(1);
      expect(callbacks.onCharacterCreated).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Speaker 1" }),
        speaker
      );
    });

    it("should call onSpeakerLinked callback", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1");
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(callbacks.onSpeakerLinked).toHaveBeenCalledTimes(1);
      expect(callbacks.onSpeakerLinked).toHaveBeenCalledWith(
        expect.objectContaining({
          wasCreated: true,
          speaker,
        })
      );
    });

    it("should store speaker-to-character mapping", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1");
      const existingCharacters: ScriptDocCharacter[] = [];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      const characterId = profiler.getCharacterIdForSpeaker("speaker_1");
      expect(characterId).toBe(result.character.id);
    });

    it("should handle case-insensitive name matching", () => {
      const speaker = createTestSpeaker("speaker_1", "john doe");
      const existingCharacter = createTestCharacter("char_1", "John Doe");
      const existingCharacters = [existingCharacter];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(result.wasCreated).toBe(false);
      expect(result.character.id).toBe("char_1");
    });

    it("should include voice profile in voice notes", () => {
      const voiceProfile: VoiceProfile = {
        pitch: 0.75,
        tempo: 0.65,
        energy: 0.85,
      };
      const speaker = createTestSpeaker("speaker_1", "Speaker 1", undefined, voiceProfile);
      const existingCharacters: ScriptDocCharacter[] = [];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

      expect(result.character.voiceNotes).toContain("Voice Characteristics");
      expect(result.character.voiceNotes).toContain("Pitch: 75.0%");
      expect(result.character.voiceNotes).toContain("Tempo: 65.0%");
      expect(result.character.voiceNotes).toContain("Energy: 85.0%");
    });

    it("should handle errors gracefully", () => {
      const speaker = createTestSpeaker("speaker_1", "Speaker 1");
      // Pass invalid characters array to trigger error
      const invalidCharacters = null as unknown as ScriptDocCharacter[];

      expect(() => {
        profiler.linkSpeakerToCharacter(speaker, invalidCharacters);
      }).toThrow();

      expect(callbacks.onError).toHaveBeenCalled();
    });
  });

  describe("linkMultipleSpeakers", () => {
    it("should link multiple speakers in batch", () => {
      const speakers = [
        createTestSpeaker("speaker_1", "Alice"),
        createTestSpeaker("speaker_2", "Bob"),
        createTestSpeaker("speaker_3", "Charlie"),
      ];
      const existingCharacters: ScriptDocCharacter[] = [];

      const results = profiler.linkMultipleSpeakers(speakers, existingCharacters);

      expect(results).toHaveLength(3);
      expect(results[0].character.name).toBe("Alice");
      expect(results[1].character.name).toBe("Bob");
      expect(results[2].character.name).toBe("Charlie");
      expect(results.every(r => r.wasCreated)).toBe(true);
    });

    it("should handle mix of existing and new characters", () => {
      const speakers = [
        createTestSpeaker("speaker_1", "Alice"),
        createTestSpeaker("speaker_2", "Bob"),
      ];
      const existingCharacter = createTestCharacter("char_1", "Alice");
      const existingCharacters = [existingCharacter];

      const results = profiler.linkMultipleSpeakers(speakers, existingCharacters);

      expect(results).toHaveLength(2);
      expect(results[0].wasCreated).toBe(false); // Alice exists
      expect(results[0].character.id).toBe("char_1");
      expect(results[1].wasCreated).toBe(true); // Bob is new
      expect(results[1].character.name).toBe("Bob");
    });

    it("should handle empty speaker list", () => {
      const speakers: Speaker[] = [];
      const existingCharacters: ScriptDocCharacter[] = [];

      const results = profiler.linkMultipleSpeakers(speakers, existingCharacters);

      expect(results).toHaveLength(0);
    });

    it("should update characters list for subsequent speakers", () => {
      const speakers = [
        createTestSpeaker("speaker_1", "Alice"),
        createTestSpeaker("speaker_2", "Alice"), // Same name
      ];
      const existingCharacters: ScriptDocCharacter[] = [];

      const results = profiler.linkMultipleSpeakers(speakers, existingCharacters);

      expect(results).toHaveLength(2);
      // Second speaker should link to the character created by first speaker
      expect(results[1].wasCreated).toBe(false);
      expect(results[0].character.id).toBe(results[1].character.id);
    });
  });

  describe("getCharacterIdForSpeaker", () => {
    it("should return character ID for linked speaker", () => {
      const speaker = createTestSpeaker("speaker_1", "Alice");
      const existingCharacters: ScriptDocCharacter[] = [];

      const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);
      const characterId = profiler.getCharacterIdForSpeaker("speaker_1");

      expect(characterId).toBe(result.character.id);
    });

    it("should return undefined for unlinked speaker", () => {
      const characterId = profiler.getCharacterIdForSpeaker("speaker_999");
      expect(characterId).toBeUndefined();
    });
  });

  describe("getAllMappings", () => {
    it("should return all speaker-character mappings", () => {
      const speakers = [
        createTestSpeaker("speaker_1", "Alice"),
        createTestSpeaker("speaker_2", "Bob"),
      ];
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkMultipleSpeakers(speakers, existingCharacters);
      const mappings = profiler.getAllMappings();

      expect(mappings.size).toBe(2);
      expect(mappings.has("speaker_1")).toBe(true);
      expect(mappings.has("speaker_2")).toBe(true);
    });

    it("should return empty map when no mappings exist", () => {
      const mappings = profiler.getAllMappings();
      expect(mappings.size).toBe(0);
    });
  });

  describe("clearMappings", () => {
    it("should clear all speaker-character mappings", () => {
      const speaker = createTestSpeaker("speaker_1", "Alice");
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkSpeakerToCharacter(speaker, existingCharacters);
      expect(profiler.getAllMappings().size).toBe(1);

      profiler.clearMappings();
      expect(profiler.getAllMappings().size).toBe(0);
    });
  });

  describe("updateMapping", () => {
    it("should manually update speaker-character mapping", () => {
      profiler.updateMapping("speaker_1", "char_1");

      const characterId = profiler.getCharacterIdForSpeaker("speaker_1");
      expect(characterId).toBe("char_1");
    });

    it("should overwrite existing mapping", () => {
      profiler.updateMapping("speaker_1", "char_1");
      profiler.updateMapping("speaker_1", "char_2");

      const characterId = profiler.getCharacterIdForSpeaker("speaker_1");
      expect(characterId).toBe("char_2");
    });
  });

  describe("isSpeakerLinked", () => {
    it("should return true for linked speaker", () => {
      const speaker = createTestSpeaker("speaker_1", "Alice");
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkSpeakerToCharacter(speaker, existingCharacters);
      expect(profiler.isSpeakerLinked("speaker_1")).toBe(true);
    });

    it("should return false for unlinked speaker", () => {
      expect(profiler.isSpeakerLinked("speaker_999")).toBe(false);
    });
  });

  describe("getLinkageStats", () => {
    it("should return correct statistics", () => {
      const speakers = [
        createTestSpeaker("speaker_1", "Alice"),
        createTestSpeaker("speaker_2", "Bob"),
      ];
      const existingCharacters: ScriptDocCharacter[] = [];

      profiler.linkMultipleSpeakers(speakers, existingCharacters);
      const stats = profiler.getLinkageStats();

      expect(stats.totalSpeakers).toBe(2);
      expect(stats.linkedSpeakers).toBe(2);
      expect(stats.unlinkedSpeakers).toBe(0);
    });

    it("should return zero stats when no speakers linked", () => {
      const stats = profiler.getLinkageStats();

      expect(stats.totalSpeakers).toBe(0);
      expect(stats.linkedSpeakers).toBe(0);
      expect(stats.unlinkedSpeakers).toBe(0);
    });
  });
});

describe("createSpeakerProfiler", () => {
  it("should create a speaker profiler with callbacks", () => {
    const callbacks: SpeakerProfilerCallbacks = {
      onSpeakerLinked: vi.fn(),
    };

    const profiler = createSpeakerProfiler(callbacks);
    expect(profiler).toBeInstanceOf(SpeakerProfiler);
  });

  it("should create a speaker profiler without callbacks", () => {
    const profiler = createSpeakerProfiler();
    expect(profiler).toBeInstanceOf(SpeakerProfiler);
  });
});

describe("linkSpeakerToExistingCharacter", () => {
  it("should link speaker to existing character by name", () => {
    const speaker = createTestSpeaker("speaker_1", "Alice");
    const character = createTestCharacter("char_1", "Alice");
    const characters = [character];

    const linked = linkSpeakerToExistingCharacter(speaker, "Alice", characters);

    expect(linked).not.toBeNull();
    expect(linked?.id).toBe("char_1");
  });

  it("should return null when character doesn't exist", () => {
    const speaker = createTestSpeaker("speaker_1", "Alice");
    const characters: ScriptDocCharacter[] = [];

    const linked = linkSpeakerToExistingCharacter(speaker, "Bob", characters);

    expect(linked).toBeNull();
  });

  it("should handle case-insensitive matching", () => {
    const speaker = createTestSpeaker("speaker_1", "alice");
    const character = createTestCharacter("char_1", "Alice");
    const characters = [character];

    const linked = linkSpeakerToExistingCharacter(speaker, "alice", characters);

    expect(linked).not.toBeNull();
    expect(linked?.id).toBe("char_1");
  });
});

describe("enrichCharactersWithVoiceData", () => {
  it("should enrich character with voice profile data", () => {
    const voiceProfile: VoiceProfile = {
      pitch: 0.75,
      tempo: 0.65,
      energy: 0.85,
    };
    const speaker = createTestSpeaker("speaker_1", "Alice", undefined, voiceProfile);
    const character = createTestCharacter("char_1", "Alice");
    const mappings = new Map([["speaker_1", "char_1"]]);

    const enriched = enrichCharactersWithVoiceData([character], [speaker], mappings);

    expect(enriched[0].voiceNotes).toContain("Voice Profile");
    expect(enriched[0].voiceNotes).toContain("Pitch: 75.0%");
    expect(enriched[0].voiceNotes).toContain("Tempo: 65.0%");
    expect(enriched[0].voiceNotes).toContain("Energy: 85.0%");
  });

  it("should preserve existing voice notes", () => {
    const voiceProfile: VoiceProfile = {
      pitch: 0.5,
      tempo: 0.6,
      energy: 0.7,
    };
    const speaker = createTestSpeaker("speaker_1", "Alice", undefined, voiceProfile);
    const character: ScriptDocCharacter = {
      ...createTestCharacter("char_1", "Alice"),
      voiceNotes: "Existing notes",
    };
    const mappings = new Map([["speaker_1", "char_1"]]);

    const enriched = enrichCharactersWithVoiceData([character], [speaker], mappings);

    expect(enriched[0].voiceNotes).toContain("Existing notes");
    expect(enriched[0].voiceNotes).toContain("Voice Profile");
  });

  it("should not modify character without voice mapping", () => {
    const character = createTestCharacter("char_1", "Alice");
    const speaker = createTestSpeaker("speaker_1", "Bob");
    const mappings = new Map([["speaker_1", "char_2"]]); // Maps to different character

    const enriched = enrichCharactersWithVoiceData([character], [speaker], mappings);

    expect(enriched[0]).toEqual(character);
  });

  it("should handle empty characters list", () => {
    const speaker = createTestSpeaker("speaker_1", "Alice");
    const mappings = new Map([["speaker_1", "char_1"]]);

    const enriched = enrichCharactersWithVoiceData([], [speaker], mappings);

    expect(enriched).toHaveLength(0);
  });

  it("should handle speaker without voice profile", () => {
    const speaker = createTestSpeaker("speaker_1", "Alice");
    speaker.voiceProfile = undefined;
    const character = createTestCharacter("char_1", "Alice");
    const mappings = new Map([["speaker_1", "char_1"]]);

    const enriched = enrichCharactersWithVoiceData([character], [speaker], mappings);

    expect(enriched[0]).toEqual(character);
  });
});

describe("F010 Acceptance Criteria", () => {
  it("should create character if doesn't exist", () => {
    const profiler = createSpeakerProfiler();
    const speaker = createTestSpeaker("speaker_1", "New Character");
    const existingCharacters: ScriptDocCharacter[] = [];

    const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

    expect(result.wasCreated).toBe(true);
    expect(result.character.name).toBe("New Character");
  });

  it("should link to existing character", () => {
    const profiler = createSpeakerProfiler();
    const speaker = createTestSpeaker("speaker_1", "Existing Character");
    const existingCharacter = createTestCharacter("char_1", "Existing Character");
    const existingCharacters = [existingCharacter];

    const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

    expect(result.wasCreated).toBe(false);
    expect(result.character.id).toBe("char_1");
  });

  it("should show in character panel (via mapping)", () => {
    const profiler = createSpeakerProfiler();
    const speaker = createTestSpeaker("speaker_1", "Character Name");
    const existingCharacters: ScriptDocCharacter[] = [];

    const result = profiler.linkSpeakerToCharacter(speaker, existingCharacters);

    // Verify mapping exists so character can be shown in panel
    const characterId = profiler.getCharacterIdForSpeaker("speaker_1");
    expect(characterId).toBe(result.character.id);
    expect(profiler.isSpeakerLinked("speaker_1")).toBe(true);
  });
});
