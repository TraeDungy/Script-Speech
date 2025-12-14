/**
 * Voice Command Handlers for Script Document Operations
 * F012: Voice command: New Scene
 * F013: Voice command: New Character
 * F014: Voice command: Delete
 * F015: Voice command: Undo/Redo
 *
 * These handlers integrate voice commands with the Script-Speech document store
 */

import type { VoiceCommand } from "./commandParser";
import type { ScriptScene, ScriptDocCharacter, ScriptSceneSlugline } from "@/lib/scriptDoc";

/**
 * Generate a random ID for entities
 */
const randomId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

/**
 * Create a new scene with default values
 */
export function createDefaultScene(order: number = 0): ScriptScene {
  return {
    id: randomId(),
    order,
    title: "New Scene",
    summary: "Enter scene description",
    slugline: {
      setting: "INT",
      location: "LOCATION",
      timeOfDay: "DAY",
    } as ScriptSceneSlugline,
    elements: [],
    referenceAssetIds: [],
    locationIds: [],
    characterIds: [],
    propIds: [],
  };
}

/**
 * Create a new character with default values
 */
export function createDefaultCharacter(name: string): ScriptDocCharacter {
  return {
    id: randomId(),
    name: name || "New Character",
    description: "",
    tags: [],
    notes: "",
    referenceAssetIds: [],
  };
}

export interface ScriptCommandHandlerOptions {
  /**
   * Callback for when a scene is created
   * @param scene - The newly created scene
   */
  onSceneCreated?: (scene: ScriptScene) => void;

  /**
   * Callback for when a character is created
   * @param character - The newly created character
   */
  onCharacterCreated?: (character: ScriptDocCharacter) => void;

  /**
   * Callback for confirmation messages
   * @param message - The confirmation message to display
   */
  onConfirmation?: (message: string) => void;

  /**
   * Callback for focusing the editor
   */
  onFocusEditor?: () => void;

  /**
   * Callback for opening the character editor
   * @param characterId - The ID of the character to edit
   */
  onOpenCharacterEditor?: (characterId: string) => void;

  /**
   * Callback for delete operation
   * Should delete the most recent element
   */
  onDelete?: () => void;

  /**
   * Callback for undo operation
   * Should trigger undo in the document history
   */
  onUndo?: () => void;

  /**
   * Callback for redo operation
   * Should trigger redo in the document history
   */
  onRedo?: () => void;

  /**
   * Callback for audio feedback
   * @param type - Type of audio feedback (success, error, info)
   */
  onAudioFeedback?: (type: "success" | "error" | "info") => void;
}

/**
 * Handler for "new scene" voice command
 * F012: Creates scene with default values, focuses editor, shows confirmation
 */
export function handleNewSceneCommand(
  command: VoiceCommand,
  options: ScriptCommandHandlerOptions = {},
): void {
  // Create a new scene
  const scene = createDefaultScene();

  // Notify that scene was created
  if (options.onSceneCreated) {
    options.onSceneCreated(scene);
  }

  // Focus the editor
  if (options.onFocusEditor) {
    options.onFocusEditor();
  }

  // Show confirmation
  if (options.onConfirmation) {
    options.onConfirmation(`New scene created: ${scene.title}`);
  }
}

/**
 * Handler for "new character" voice command
 * F013: Extracts name from command, creates character, opens character editor
 */
export function handleNewCharacterCommand(
  command: VoiceCommand,
  options: ScriptCommandHandlerOptions = {},
): void {
  // Extract character name from command parameters
  const characterName = command.params.name as string | undefined;

  if (!characterName) {
    // If no name provided, show error or use default
    if (options.onConfirmation) {
      options.onConfirmation("Please provide a character name. Say 'new character [name]'");
    }
    return;
  }

  // Create a new character
  const character = createDefaultCharacter(characterName);

  // Notify that character was created
  if (options.onCharacterCreated) {
    options.onCharacterCreated(character);
  }

  // Open character editor
  if (options.onOpenCharacterEditor) {
    options.onOpenCharacterEditor(character.id);
  }

  // Show confirmation
  if (options.onConfirmation) {
    options.onConfirmation(`New character created: ${character.name}`);
  }
}

/**
 * Handler for "delete" voice command
 * F014: Removes most recent element, supports undo, shows confirmation
 */
export function handleDeleteCommand(
  command: VoiceCommand,
  options: ScriptCommandHandlerOptions = {},
): void {
  // Trigger delete operation
  if (options.onDelete) {
    options.onDelete();
  }

  // Show confirmation
  if (options.onConfirmation) {
    options.onConfirmation("Last element deleted. Say 'undo' to restore.");
  }

  // Provide audio feedback
  if (options.onAudioFeedback) {
    options.onAudioFeedback("success");
  }
}

/**
 * Handler for "undo" voice command
 * F015: Triggers undo action, provides audio feedback, updates UI
 */
export function handleUndoCommand(
  command: VoiceCommand,
  options: ScriptCommandHandlerOptions = {},
): void {
  // Trigger undo operation
  if (options.onUndo) {
    options.onUndo();
  }

  // Show confirmation
  if (options.onConfirmation) {
    options.onConfirmation("Undo successful");
  }

  // Provide audio feedback
  if (options.onAudioFeedback) {
    options.onAudioFeedback("success");
  }
}

/**
 * Handler for "redo" voice command
 * F015: Triggers redo action, provides audio feedback, updates UI
 */
export function handleRedoCommand(
  command: VoiceCommand,
  options: ScriptCommandHandlerOptions = {},
): void {
  // Trigger redo operation
  if (options.onRedo) {
    options.onRedo();
  }

  // Show confirmation
  if (options.onConfirmation) {
    options.onConfirmation("Redo successful");
  }

  // Provide audio feedback
  if (options.onAudioFeedback) {
    options.onAudioFeedback("success");
  }
}

/**
 * Factory function to create script command handlers bound to specific options
 */
export function createScriptCommandHandlers(options: ScriptCommandHandlerOptions = {}) {
  return {
    new_scene: (command: VoiceCommand) => handleNewSceneCommand(command, options),
    new_character: (command: VoiceCommand) => handleNewCharacterCommand(command, options),
    delete: (command: VoiceCommand) => handleDeleteCommand(command, options),
    undo: (command: VoiceCommand) => handleUndoCommand(command, options),
    redo: (command: VoiceCommand) => handleRedoCommand(command, options),
  };
}
