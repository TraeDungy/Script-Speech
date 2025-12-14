"use client";

/**
 * Character Editor Component
 * F029: Character creation
 *
 * Allows users to create and edit characters with name, description, goals, and other metadata.
 * - Form with all character fields
 * - Validation
 * - Saves to ScriptDoc via callback
 * - Can be used for both creating and editing
 */

import React, { useState, useEffect, useCallback } from "react";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";
import {
  createCharacter,
  validateCharacter,
  type CreateCharacterInput,
} from "@/lib/characters/crud";

export interface CharacterEditorProps {
  /**
   * Character to edit (if editing existing character)
   * If undefined, creates a new character
   */
  character?: ScriptDocCharacter;

  /**
   * Callback when character is saved
   */
  onSave?: (character: ScriptDocCharacter) => void;

  /**
   * Callback when cancel is clicked
   */
  onCancel?: () => void;

  /**
   * Whether the form is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show character name as title
   */
  showTitle?: boolean;
}

/**
 * CharacterEditor component for creating and editing characters
 */
export function CharacterEditor({
  character,
  onSave,
  onCancel,
  disabled = false,
  className = "",
  showTitle = false,
}: CharacterEditorProps) {
  // Form state
  const [name, setName] = useState(character?.name || "");
  const [description, setDescription] = useState(character?.description || "");
  const [pronouns, setPronouns] = useState(character?.pronouns || "");
  const [archetype, setArchetype] = useState(character?.archetype || "");
  const [goal, setGoal] = useState(character?.goal || "");
  const [arc, setArc] = useState(character?.arc || "");
  const [voiceNotes, setVoiceNotes] = useState(character?.voiceNotes || "");
  const [notes, setNotes] = useState(character?.notes || "");
  const [tags, setTags] = useState(character?.tags?.join(", ") || "");

  // Validation state
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  // Update form when character prop changes
  useEffect(() => {
    if (character) {
      setName(character.name || "");
      setDescription(character.description || "");
      setPronouns(character.pronouns || "");
      setArchetype(character.archetype || "");
      setGoal(character.goal || "");
      setArc(character.arc || "");
      setVoiceNotes(character.voiceNotes || "");
      setNotes(character.notes || "");
      setTags(character.tags?.join(", ") || "");
    }
  }, [character]);

  // Validate form
  const validate = useCallback(() => {
    const input: CreateCharacterInput = {
      name,
      description,
      pronouns,
      archetype,
      goal,
      arc,
      voiceNotes,
      notes,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    const result = validateCharacter(input);
    setErrors(result.errors);
    return result.isValid;
  }, [name, description, pronouns, archetype, goal, arc, voiceNotes, notes, tags]);

  // Handle save
  const handleSave = useCallback(() => {
    setShowErrors(true);

    if (!validate()) {
      return;
    }

    const input: CreateCharacterInput = {
      name: name.trim(),
      description: description.trim(),
      pronouns: pronouns.trim() || undefined,
      archetype: archetype.trim() || undefined,
      goal: goal.trim() || undefined,
      arc: arc.trim() || undefined,
      voiceNotes: voiceNotes.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      referenceAssetIds: character?.referenceAssetIds || [],
    };

    let savedCharacter: ScriptDocCharacter;

    if (character) {
      // Update existing character
      savedCharacter = {
        ...character,
        ...input,
        name: input.name, // Ensure name is always set
        description: input.description || "",
        tags: input.tags || [],
        referenceAssetIds: input.referenceAssetIds || [],
      };
    } else {
      // Create new character
      savedCharacter = createCharacter(input);
    }

    if (onSave) {
      onSave(savedCharacter);
    }
  }, [
    name,
    description,
    pronouns,
    archetype,
    goal,
    arc,
    voiceNotes,
    notes,
    tags,
    character,
    onSave,
    validate,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const isEditing = !!character;

  return (
    <div className={`space-y-6 ${className}`} role="form" aria-label={isEditing ? "Edit character" : "Create character"}>
      {/* Title */}
      {showTitle && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? `Edit ${character.name}` : "New Character"}
          </h2>
        </div>
      )}

      {/* Error messages */}
      {showErrors && errors.length > 0 && (
        <div
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          role="alert"
          aria-live="polite"
        >
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Please fix the following errors:
          </h3>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        {/* Name (required) */}
        <div>
          <label htmlFor="character-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="character-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            placeholder="e.g., John Doe"
            required
            aria-required="true"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="character-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="character-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            rows={3}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
            "
            placeholder="Brief description of the character..."
            maxLength={1000}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {description.length}/1000 characters
          </p>
        </div>

        {/* Two-column layout for smaller fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pronouns */}
          <div>
            <label htmlFor="character-pronouns" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pronouns
            </label>
            <input
              id="character-pronouns"
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              disabled={disabled}
              className="
                w-full px-3 py-2 text-sm
                bg-white dark:bg-gray-800
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              placeholder="e.g., he/him, she/her, they/them"
            />
          </div>

          {/* Archetype */}
          <div>
            <label htmlFor="character-archetype" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Archetype
            </label>
            <input
              id="character-archetype"
              type="text"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              disabled={disabled}
              className="
                w-full px-3 py-2 text-sm
                bg-white dark:bg-gray-800
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              placeholder="e.g., Hero, Mentor, Trickster"
            />
          </div>
        </div>

        {/* Goal */}
        <div>
          <label htmlFor="character-goal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Goal
          </label>
          <textarea
            id="character-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={disabled}
            rows={2}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
            "
            placeholder="What does this character want to achieve?"
            maxLength={500}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {goal.length}/500 characters
          </p>
        </div>

        {/* Arc */}
        <div>
          <label htmlFor="character-arc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Character Arc
          </label>
          <input
            id="character-arc"
            type="text"
            value={arc}
            onChange={(e) => setArc(e.target.value)}
            disabled={disabled}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            placeholder="e.g., Redemption, Transformation, Fall"
          />
        </div>

        {/* Voice Notes */}
        <div>
          <label htmlFor="character-voice-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Voice Notes
          </label>
          <textarea
            id="character-voice-notes"
            value={voiceNotes}
            onChange={(e) => setVoiceNotes(e.target.value)}
            disabled={disabled}
            rows={2}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
            "
            placeholder="How should this character sound? (for voice acting)"
          />
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="character-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags
          </label>
          <input
            id="character-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={disabled}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            placeholder="Comma-separated tags (e.g., protagonist, detective, hero)"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Separate tags with commas
          </p>
        </div>

        {/* Additional Notes */}
        <div>
          <label htmlFor="character-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Additional Notes
          </label>
          <textarea
            id="character-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            rows={3}
            className="
              w-full px-3 py-2 text-sm
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
            "
            placeholder="Any additional notes about this character..."
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {typeof onCancel !== "undefined" && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="
              px-4 py-2 text-sm font-medium
              text-gray-700 dark:text-gray-300
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-gray-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          onClick={handleSave}
          disabled={disabled}
          className="
            px-4 py-2 text-sm font-medium
            text-white
            bg-blue-600 hover:bg-blue-700
            rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
          "
        >
          {isEditing ? "Save Changes" : "Create Character"}
        </button>
      </div>
    </div>
  );
}
