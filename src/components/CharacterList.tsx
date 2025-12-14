"use client";

/**
 * Character List Component
 * F030: Character list view
 *
 * Displays all characters in a searchable, alphabetically sorted list.
 * - Shows name and role/archetype
 * - Search functionality
 * - Click to edit
 * - Sorted alphabetically
 */

import React, { useState, useMemo, useCallback } from "react";
import type { ScriptDocCharacter } from "@/lib/scriptDoc";
import { sortCharactersByName, searchCharacters } from "@/lib/characters/crud";

export interface CharacterListProps {
  /**
   * Array of characters to display
   */
  characters: ScriptDocCharacter[];

  /**
   * Callback when a character is clicked
   */
  onCharacterClick?: (character: ScriptDocCharacter) => void;

  /**
   * Callback when add character button is clicked
   */
  onAddCharacter?: () => void;

  /**
   * Whether the list is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show add button
   */
  showAddButton?: boolean;

  /**
   * Show search input
   */
  showSearch?: boolean;
}

/**
 * CharacterList component for displaying and managing characters
 */
export function CharacterList({
  characters,
  onCharacterClick,
  onAddCharacter,
  disabled = false,
  className = "",
  showAddButton = true,
  showSearch = true,
}: CharacterListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort characters
  const filteredAndSortedCharacters = useMemo(() => {
    const filtered = searchCharacters(characters, searchQuery);
    return sortCharactersByName(filtered);
  }, [characters, searchQuery]);

  // Handle character click
  const handleCharacterClick = useCallback(
    (character: ScriptDocCharacter) => {
      if (!disabled && onCharacterClick) {
        onCharacterClick(character);
      }
    },
    [disabled, onCharacterClick]
  );

  // Handle add character
  const handleAddCharacter = useCallback(() => {
    if (!disabled && onAddCharacter) {
      onAddCharacter();
    }
  }, [disabled, onAddCharacter]);

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Character list">
      {/* Header with search and add button */}
      <div className="flex items-center justify-between gap-4">
        {/* Search input */}
        {showSearch && (
          <div className="flex-1">
            <label htmlFor="character-search" className="sr-only">
              Search characters
            </label>
            <input
              id="character-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              className="
                w-full px-3 py-2 text-sm
                bg-white dark:bg-gray-800
                border border-gray-300 dark:border-gray-600
                rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              placeholder="Search characters..."
              aria-label="Search characters"
            />
          </div>
        )}

        {/* Add character button */}
        {showAddButton && onAddCharacter && (
          <button
            onClick={handleAddCharacter}
            disabled={disabled}
            className="
              flex items-center gap-2 px-4 py-2 text-sm font-medium
              text-white
              bg-blue-600 hover:bg-blue-700
              rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
              whitespace-nowrap
            "
            aria-label="Add new character"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Character</span>
          </button>
        )}
      </div>

      {/* Character count */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {filteredAndSortedCharacters.length === characters.length ? (
          <span>
            {characters.length} {characters.length === 1 ? "character" : "characters"}
          </span>
        ) : (
          <span>
            Showing {filteredAndSortedCharacters.length} of {characters.length}{" "}
            {characters.length === 1 ? "character" : "characters"}
          </span>
        )}
      </div>

      {/* Character list */}
      {filteredAndSortedCharacters.length === 0 ? (
        <div className="text-center py-12 px-4">
          <svg
            className="mx-auto w-12 h-12 text-gray-400 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? "No characters found matching your search" : "No characters yet"}
          </p>
          {!searchQuery && showAddButton && onAddCharacter && (
            <button
              onClick={handleAddCharacter}
              disabled={disabled}
              className="
                mt-4 px-4 py-2 text-sm font-medium
                text-blue-600 hover:text-blue-700
                dark:text-blue-400 dark:hover:text-blue-300
                hover:underline
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Create your first character
            </button>
          )}
        </div>
      ) : (
        <div
          className="space-y-2"
          role="list"
          aria-label={`${filteredAndSortedCharacters.length} characters`}
        >
          {filteredAndSortedCharacters.map((character) => (
            <CharacterListItem
              key={character.id}
              character={character}
              onClick={() => handleCharacterClick(character)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual character list item
 */
interface CharacterListItemProps {
  character: ScriptDocCharacter;
  onClick?: () => void;
  disabled?: boolean;
}

function CharacterListItem({
  character,
  onClick,
  disabled = false,
}: CharacterListItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        w-full flex items-center justify-between p-4 rounded-lg border
        bg-white dark:bg-gray-800
        border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        hover:border-gray-300 dark:hover:border-gray-600
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150
        text-left
      "
      role="listitem"
      aria-label={`Edit ${character.name}`}
    >
      <div className="flex-1 min-w-0">
        {/* Character name */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {character.name}
        </h3>

        {/* Character role/archetype */}
        {character.archetype && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {character.archetype}
          </p>
        )}

        {/* Character tags */}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {character.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="
                  inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                  bg-blue-100 text-blue-700
                  dark:bg-blue-900/30 dark:text-blue-300
                "
              >
                {tag}
              </span>
            ))}
            {character.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
                +{character.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Edit icon */}
      <div className="ml-4 flex-shrink-0">
        <svg
          className="w-5 h-5 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </button>
  );
}

/**
 * Compact character badge for inline use
 */
export function CharacterBadge({
  character,
  onClick,
  className = "",
}: {
  character: ScriptDocCharacter;
  onClick?: () => void;
  className?: string;
}) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
          bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-gray-600
          transition-colors duration-150
          ${className}
        `}
        aria-label={`Select ${character.name}`}
      >
        {character.name}
      </button>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300
        ${className}
      `}
      aria-label={character.name}
    >
      {character.name}
    </span>
  );
}
