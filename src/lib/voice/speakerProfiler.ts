/**
 * Speaker Profile Linking
 * F010: Speaker profile creation
 *
 * Links speakers from voice diarization to character profiles.
 * Automatically creates character profiles for detected speakers.
 */

import type { Speaker } from "./types";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";
import {
  createCharacter,
  findCharacterByName,
  type CreateCharacterInput,
} from "@/lib/characters/crud";

export interface SpeakerProfileLinkResult {
  character: ScriptDocCharacter;
  wasCreated: boolean;
  speaker: Speaker;
}

export interface SpeakerProfilerCallbacks {
  /**
   * Called when a speaker is linked to a character
   */
  onSpeakerLinked?: (result: SpeakerProfileLinkResult) => void;

  /**
   * Called when a new character is auto-created from a speaker
   */
  onCharacterCreated?: (character: ScriptDocCharacter, speaker: Speaker) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Speaker profiler that manages speaker-to-character linkage
 */
export class SpeakerProfiler {
  private callbacks: SpeakerProfilerCallbacks;
  private speakerToCharacterMap: Map<string, string> = new Map(); // speakerId -> characterId

  constructor(callbacks: SpeakerProfilerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Link a speaker to a character, creating the character if needed
   */
  linkSpeakerToCharacter(
    speaker: Speaker,
    existingCharacters: ScriptDocCharacter[]
  ): SpeakerProfileLinkResult {
    try {
      // If speaker already has a character name assigned, use it
      const speakerName = speaker.characterName || speaker.label;

      // Check if character already exists
      let character = findCharacterByName(existingCharacters, speakerName);
      let wasCreated = false;

      if (!character) {
        // Create new character from speaker info
        character = this.createCharacterFromSpeaker(speaker);
        wasCreated = true;

        if (this.callbacks.onCharacterCreated) {
          this.callbacks.onCharacterCreated(character, speaker);
        }
      }

      // Store mapping
      this.speakerToCharacterMap.set(speaker.id, character.id);

      const result: SpeakerProfileLinkResult = {
        character,
        wasCreated,
        speaker,
      };

      if (this.callbacks.onSpeakerLinked) {
        this.callbacks.onSpeakerLinked(result);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      throw err;
    }
  }

  /**
   * Link multiple speakers to characters in batch
   */
  linkMultipleSpeakers(
    speakers: Speaker[],
    existingCharacters: ScriptDocCharacter[]
  ): SpeakerProfileLinkResult[] {
    const results: SpeakerProfileLinkResult[] = [];
    const updatedCharacters = [...existingCharacters];

    for (const speaker of speakers) {
      const result = this.linkSpeakerToCharacter(speaker, updatedCharacters);
      results.push(result);

      // Add newly created character to the list for next iteration
      if (result.wasCreated) {
        updatedCharacters.push(result.character);
      }
    }

    return results;
  }

  /**
   * Create a character profile from speaker data
   */
  private createCharacterFromSpeaker(speaker: Speaker): ScriptDocCharacter {
    const speakerName = speaker.characterName || speaker.label;

    const input: CreateCharacterInput = {
      name: speakerName,
      description: `Character profile auto-generated from voice recording.`,
      voiceNotes: this.generateVoiceNotes(speaker),
      tags: ["voice-generated"],
    };

    return createCharacter(input);
  }

  /**
   * Generate voice notes from speaker's voice profile
   */
  private generateVoiceNotes(speaker: Speaker): string {
    const notes: string[] = [];

    notes.push(`Speaker ID: ${speaker.id}`);
    notes.push(`Confidence: ${(speaker.confidence * 100).toFixed(1)}%`);

    if (speaker.voiceProfile) {
      notes.push("\nVoice Characteristics:");
      notes.push(`- Pitch: ${(speaker.voiceProfile.pitch * 100).toFixed(1)}%`);
      notes.push(`- Tempo: ${(speaker.voiceProfile.tempo * 100).toFixed(1)}%`);
      notes.push(`- Energy: ${(speaker.voiceProfile.energy * 100).toFixed(1)}%`);
    }

    return notes.join("\n");
  }

  /**
   * Get character ID for a speaker ID
   */
  getCharacterIdForSpeaker(speakerId: string): string | undefined {
    return this.speakerToCharacterMap.get(speakerId);
  }

  /**
   * Get all speaker-to-character mappings
   */
  getAllMappings(): Map<string, string> {
    return new Map(this.speakerToCharacterMap);
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.speakerToCharacterMap.clear();
  }

  /**
   * Update speaker-to-character mapping manually
   */
  updateMapping(speakerId: string, characterId: string): void {
    this.speakerToCharacterMap.set(speakerId, characterId);
  }

  /**
   * Check if a speaker is already linked to a character
   */
  isSpeakerLinked(speakerId: string): boolean {
    return this.speakerToCharacterMap.has(speakerId);
  }

  /**
   * Get statistics about speaker-character linkage
   */
  getLinkageStats(): {
    totalSpeakers: number;
    linkedSpeakers: number;
    unlinkedSpeakers: number;
  } {
    const totalSpeakers = this.speakerToCharacterMap.size;
    const linkedSpeakers = Array.from(this.speakerToCharacterMap.values()).filter(
      (id) => id !== undefined
    ).length;

    return {
      totalSpeakers,
      linkedSpeakers,
      unlinkedSpeakers: totalSpeakers - linkedSpeakers,
    };
  }
}

/**
 * Factory function to create a speaker profiler
 */
export function createSpeakerProfiler(
  callbacks: SpeakerProfilerCallbacks = {}
): SpeakerProfiler {
  return new SpeakerProfiler(callbacks);
}

/**
 * Utility function to link a speaker to an existing character by name
 */
export function linkSpeakerToExistingCharacter(
  speaker: Speaker,
  characterName: string,
  characters: ScriptDocCharacter[]
): ScriptDocCharacter | null {
  const character = findCharacterByName(characters, characterName);
  return character || null;
}

/**
 * Utility function to update all characters with speaker voice data
 */
export function enrichCharactersWithVoiceData(
  characters: ScriptDocCharacter[],
  speakers: Speaker[],
  mappings: Map<string, string>
): ScriptDocCharacter[] {
  return characters.map((character) => {
    // Find if this character is linked to any speaker
    const speakerEntry = Array.from(mappings.entries()).find(
      ([_speakerId, charId]) => charId === character.id
    );

    if (!speakerEntry) {
      return character;
    }

    const [speakerId] = speakerEntry;
    const speaker = speakers.find((s) => s.id === speakerId);

    if (!speaker || !speaker.voiceProfile) {
      return character;
    }

    // Enrich voice notes with speaker data
    const voiceNotes = character.voiceNotes || "";
    const enrichedNotes = voiceNotes + (voiceNotes ? "\n\n" : "") +
      `Voice Profile:\n` +
      `- Pitch: ${(speaker.voiceProfile.pitch * 100).toFixed(1)}%\n` +
      `- Tempo: ${(speaker.voiceProfile.tempo * 100).toFixed(1)}%\n` +
      `- Energy: ${(speaker.voiceProfile.energy * 100).toFixed(1)}%`;

    return {
      ...character,
      voiceNotes: enrichedNotes,
    };
  });
}
