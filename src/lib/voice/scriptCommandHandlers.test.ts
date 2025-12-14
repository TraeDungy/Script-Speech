/**
 * Tests for Script Command Handlers
 * F012: Voice command: New Scene
 * F013: Voice command: New Character
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDefaultScene,
  createDefaultCharacter,
  handleNewSceneCommand,
  handleNewCharacterCommand,
  createScriptCommandHandlers,
  type ScriptCommandHandlerOptions,
} from "./scriptCommandHandlers";
import type { VoiceCommand } from "./commandParser";

describe("scriptCommandHandlers", () => {
  describe("createDefaultScene", () => {
    it("creates a scene with default values", () => {
      const scene = createDefaultScene();

      expect(scene).toHaveProperty("id");
      expect(scene.id).toBeTruthy();
      expect(scene.order).toBe(0);
      expect(scene.title).toBe("New Scene");
      expect(scene.summary).toBe("Enter scene description");
      expect(scene.slugline).toEqual({
        setting: "INT",
        location: "LOCATION",
        timeOfDay: "DAY",
      });
      expect(scene.elements).toEqual([]);
      expect(scene.characterIds).toEqual([]);
    });

    it("creates a scene with specified order", () => {
      const scene = createDefaultScene(5);

      expect(scene.order).toBe(5);
    });

    it("generates unique IDs for each scene", () => {
      const scene1 = createDefaultScene();
      const scene2 = createDefaultScene();

      expect(scene1.id).not.toBe(scene2.id);
    });
  });

  describe("createDefaultCharacter", () => {
    it("creates a character with provided name", () => {
      const character = createDefaultCharacter("John Doe");

      expect(character).toHaveProperty("id");
      expect(character.id).toBeTruthy();
      expect(character.name).toBe("John Doe");
      expect(character.description).toBe("");
      expect(character.tags).toEqual([]);
      expect(character.notes).toBe("");
      expect(character.referenceAssetIds).toEqual([]);
    });

    it("uses fallback name if empty string provided", () => {
      const character = createDefaultCharacter("");

      expect(character.name).toBe("New Character");
    });

    it("generates unique IDs for each character", () => {
      const character1 = createDefaultCharacter("Alice");
      const character2 = createDefaultCharacter("Bob");

      expect(character1.id).not.toBe(character2.id);
    });

    it("preserves character name case", () => {
      const character = createDefaultCharacter("SHOUTING PERSON");

      expect(character.name).toBe("SHOUTING PERSON");
    });
  });

  describe("handleNewSceneCommand", () => {
    let mockOptions: ScriptCommandHandlerOptions;
    let mockCommand: VoiceCommand;

    beforeEach(() => {
      mockOptions = {
        onSceneCreated: vi.fn(),
        onFocusEditor: vi.fn(),
        onConfirmation: vi.fn(),
      };

      mockCommand = {
        type: "new_scene",
        rawText: "new scene",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };
    });

    it("creates a new scene and calls onSceneCreated", () => {
      handleNewSceneCommand(mockCommand, mockOptions);

      expect(mockOptions.onSceneCreated).toHaveBeenCalledTimes(1);
      const createdScene = (mockOptions.onSceneCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdScene).toHaveProperty("id");
      expect(createdScene.title).toBe("New Scene");
    });

    it("focuses the editor", () => {
      handleNewSceneCommand(mockCommand, mockOptions);

      expect(mockOptions.onFocusEditor).toHaveBeenCalledTimes(1);
    });

    it("shows confirmation message", () => {
      handleNewSceneCommand(mockCommand, mockOptions);

      expect(mockOptions.onConfirmation).toHaveBeenCalledTimes(1);
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("New scene created: New Scene");
    });

    it("works without any callbacks", () => {
      expect(() => {
        handleNewSceneCommand(mockCommand);
      }).not.toThrow();
    });

    it("works with partial callbacks", () => {
      const partialOptions: ScriptCommandHandlerOptions = {
        onSceneCreated: vi.fn(),
      };

      handleNewSceneCommand(mockCommand, partialOptions);

      expect(partialOptions.onSceneCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleNewCharacterCommand", () => {
    let mockOptions: ScriptCommandHandlerOptions;
    let mockCommand: VoiceCommand;

    beforeEach(() => {
      mockOptions = {
        onCharacterCreated: vi.fn(),
        onOpenCharacterEditor: vi.fn(),
        onConfirmation: vi.fn(),
      };

      mockCommand = {
        type: "new_character",
        rawText: "new character John",
        params: { name: "John" },
        confidence: 0.95,
        timestamp: Date.now(),
      };
    });

    it("creates a new character with extracted name", () => {
      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onCharacterCreated).toHaveBeenCalledTimes(1);
      const createdCharacter = (mockOptions.onCharacterCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdCharacter).toHaveProperty("id");
      expect(createdCharacter.name).toBe("John");
    });

    it("opens the character editor with character ID", () => {
      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onOpenCharacterEditor).toHaveBeenCalledTimes(1);
      const characterId = (mockOptions.onOpenCharacterEditor as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(characterId).toBeTruthy();
      expect(typeof characterId).toBe("string");
    });

    it("shows confirmation message with character name", () => {
      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onConfirmation).toHaveBeenCalledTimes(1);
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith("New character created: John");
    });

    it("handles multi-word character names", () => {
      mockCommand.params.name = "John Smith Jr.";

      handleNewCharacterCommand(mockCommand, mockOptions);

      const createdCharacter = (mockOptions.onCharacterCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdCharacter.name).toBe("John Smith Jr.");
    });

    it("shows error when no name provided", () => {
      mockCommand.params = {};

      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onCharacterCreated).not.toHaveBeenCalled();
      expect(mockOptions.onOpenCharacterEditor).not.toHaveBeenCalled();
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith(
        "Please provide a character name. Say 'new character [name]'",
      );
    });

    it("shows error when name is undefined", () => {
      mockCommand.params = { name: undefined };

      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onCharacterCreated).not.toHaveBeenCalled();
      expect(mockOptions.onOpenCharacterEditor).not.toHaveBeenCalled();
      expect(mockOptions.onConfirmation).toHaveBeenCalledWith(
        "Please provide a character name. Say 'new character [name]'",
      );
    });

    it("works without any callbacks", () => {
      expect(() => {
        handleNewCharacterCommand(mockCommand);
      }).not.toThrow();
    });

    it("works with partial callbacks", () => {
      const partialOptions: ScriptCommandHandlerOptions = {
        onCharacterCreated: vi.fn(),
      };

      handleNewCharacterCommand(mockCommand, partialOptions);

      expect(partialOptions.onCharacterCreated).toHaveBeenCalledTimes(1);
    });

    it("preserves character name case", () => {
      mockCommand.params.name = "MYSTERIOUS STRANGER";

      handleNewCharacterCommand(mockCommand, mockOptions);

      const createdCharacter = (mockOptions.onCharacterCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdCharacter.name).toBe("MYSTERIOUS STRANGER");
    });
  });

  describe("createScriptCommandHandlers", () => {
    it("creates handlers with bound options", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onSceneCreated: vi.fn(),
        onCharacterCreated: vi.fn(),
        onConfirmation: vi.fn(),
      };

      const handlers = createScriptCommandHandlers(mockOptions);

      expect(handlers).toHaveProperty("new_scene");
      expect(handlers).toHaveProperty("new_character");
      expect(typeof handlers.new_scene).toBe("function");
      expect(typeof handlers.new_character).toBe("function");
    });

    it("new_scene handler calls handleNewSceneCommand", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onSceneCreated: vi.fn(),
        onFocusEditor: vi.fn(),
        onConfirmation: vi.fn(),
      };

      const handlers = createScriptCommandHandlers(mockOptions);
      const mockCommand: VoiceCommand = {
        type: "new_scene",
        rawText: "new scene",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handlers.new_scene(mockCommand);

      expect(mockOptions.onSceneCreated).toHaveBeenCalledTimes(1);
      expect(mockOptions.onFocusEditor).toHaveBeenCalledTimes(1);
      expect(mockOptions.onConfirmation).toHaveBeenCalledTimes(1);
    });

    it("new_character handler calls handleNewCharacterCommand", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onCharacterCreated: vi.fn(),
        onOpenCharacterEditor: vi.fn(),
        onConfirmation: vi.fn(),
      };

      const handlers = createScriptCommandHandlers(mockOptions);
      const mockCommand: VoiceCommand = {
        type: "new_character",
        rawText: "new character Alice",
        params: { name: "Alice" },
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handlers.new_character(mockCommand);

      expect(mockOptions.onCharacterCreated).toHaveBeenCalledTimes(1);
      expect(mockOptions.onOpenCharacterEditor).toHaveBeenCalledTimes(1);
      expect(mockOptions.onConfirmation).toHaveBeenCalledTimes(1);
    });

    it("creates handlers without options", () => {
      const handlers = createScriptCommandHandlers();

      const mockCommand: VoiceCommand = {
        type: "new_scene",
        rawText: "new scene",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      expect(() => {
        handlers.new_scene(mockCommand);
      }).not.toThrow();
    });
  });

  describe("F012 Acceptance Criteria", () => {
    it("creates scene with default values", () => {
      const scene = createDefaultScene();

      // Verify default values
      expect(scene.title).toBeTruthy();
      expect(scene.summary).toBeTruthy();
      expect(scene.slugline).toEqual({
        setting: "INT",
        location: "LOCATION",
        timeOfDay: "DAY",
      });
      expect(scene.elements).toEqual([]);
    });

    it("focuses editor when scene is created", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onFocusEditor: vi.fn(),
      };

      const mockCommand: VoiceCommand = {
        type: "new_scene",
        rawText: "new scene",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleNewSceneCommand(mockCommand, mockOptions);

      expect(mockOptions.onFocusEditor).toHaveBeenCalled();
    });

    it("shows confirmation when scene is created", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onConfirmation: vi.fn(),
      };

      const mockCommand: VoiceCommand = {
        type: "new_scene",
        rawText: "new scene",
        params: {},
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleNewSceneCommand(mockCommand, mockOptions);

      expect(mockOptions.onConfirmation).toHaveBeenCalledWith(
        expect.stringContaining("New scene created"),
      );
    });
  });

  describe("F013 Acceptance Criteria", () => {
    it("extracts name from command", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onCharacterCreated: vi.fn(),
      };

      const mockCommand: VoiceCommand = {
        type: "new_character",
        rawText: "new character Sarah Connor",
        params: { name: "Sarah Connor" },
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleNewCharacterCommand(mockCommand, mockOptions);

      const createdCharacter = (mockOptions.onCharacterCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdCharacter.name).toBe("Sarah Connor");
    });

    it("creates character with extracted name", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onCharacterCreated: vi.fn(),
      };

      const mockCommand: VoiceCommand = {
        type: "new_character",
        rawText: "new character Detective Miller",
        params: { name: "Detective Miller" },
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onCharacterCreated).toHaveBeenCalledTimes(1);
      const createdCharacter = (mockOptions.onCharacterCreated as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createdCharacter).toHaveProperty("id");
      expect(createdCharacter.name).toBe("Detective Miller");
    });

    it("opens character editor after creation", () => {
      const mockOptions: ScriptCommandHandlerOptions = {
        onCharacterCreated: vi.fn(),
        onOpenCharacterEditor: vi.fn(),
      };

      const mockCommand: VoiceCommand = {
        type: "new_character",
        rawText: "new character Bob",
        params: { name: "Bob" },
        confidence: 0.95,
        timestamp: Date.now(),
      };

      handleNewCharacterCommand(mockCommand, mockOptions);

      expect(mockOptions.onOpenCharacterEditor).toHaveBeenCalledTimes(1);
      expect(mockOptions.onOpenCharacterEditor).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
