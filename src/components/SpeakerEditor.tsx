"use client";

/**
 * Speaker Editor Component
 * F009: Speaker name assignment
 *
 * Allows users to assign character names to identified speakers.
 * - Click to rename speaker
 * - Persists across session
 * - Updates retroactively
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { Speaker } from "@/lib/voice/types";

export interface SpeakerEditorProps {
  /**
   * List of detected speakers
   */
  speakers: Speaker[];

  /**
   * Active speaker ID (optional, for highlighting)
   */
  activeSpeakerId?: string;

  /**
   * Callback when a speaker name is changed
   */
  onSpeakerNameChange?: (speakerId: string, newName: string) => void;

  /**
   * Callback when a speaker is clicked
   */
  onSpeakerClick?: (speakerId: string) => void;

  /**
   * Whether editing is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show confidence scores
   */
  showConfidence?: boolean;
}

/**
 * SpeakerEditor component for managing speaker names
 */
export function SpeakerEditor({
  speakers,
  activeSpeakerId,
  onSpeakerNameChange,
  onSpeakerClick,
  disabled = false,
  className = "",
  showConfidence = false,
}: SpeakerEditorProps) {
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingSpeakerId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSpeakerId]);

  const handleStartEdit = useCallback(
    (speaker: Speaker) => {
      if (disabled) return;

      setEditingSpeakerId(speaker.id);
      setEditingValue(speaker.characterName || speaker.label);
    },
    [disabled]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSpeakerId(null);
    setEditingValue("");
  }, []);

  const handleSaveEdit = useCallback(
    (speakerId: string) => {
      const trimmedValue = editingValue.trim();

      if (trimmedValue && onSpeakerNameChange) {
        onSpeakerNameChange(speakerId, trimmedValue);
      }

      setEditingSpeakerId(null);
      setEditingValue("");
    },
    [editingValue, onSpeakerNameChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, speakerId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveEdit(speakerId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const handleSpeakerClick = useCallback(
    (speakerId: string) => {
      if (onSpeakerClick) {
        onSpeakerClick(speakerId);
      }
    },
    [onSpeakerClick]
  );

  if (speakers.length === 0) {
    return (
      <div className={`text-sm text-gray-500 p-4 ${className}`}>
        No speakers detected yet
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} role="list" aria-label="Detected speakers">
      {speakers.map((speaker) => {
        const isActive = speaker.id === activeSpeakerId;
        const isEditing = speaker.id === editingSpeakerId;

        return (
          <div
            key={speaker.id}
            className={`
              flex items-center justify-between p-3 rounded-lg border
              transition-colors duration-200
              ${isActive ? "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700" : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"}
              ${!disabled && !isEditing ? "hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" : ""}
            `}
            onClick={() => !isEditing && handleSpeakerClick(speaker.id)}
            role="listitem"
            aria-label={`Speaker ${speaker.label}${isActive ? " (active)" : ""}`}
          >
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, speaker.id)}
                    onBlur={() => handleSaveEdit(speaker.id)}
                    className="
                      flex-1 px-2 py-1 text-sm font-medium
                      bg-white dark:bg-gray-700
                      border border-blue-500 rounded
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                    placeholder="Enter name..."
                    aria-label="Edit speaker name"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {speaker.characterName || speaker.label}
                  </span>
                  {!disabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(speaker);
                      }}
                      className="
                        text-xs px-2 py-0.5 rounded
                        text-blue-600 hover:text-blue-700
                        hover:bg-blue-50 dark:hover:bg-blue-900/30
                        transition-colors duration-150
                      "
                      aria-label={`Rename ${speaker.label}`}
                    >
                      Rename
                    </button>
                  )}
                </div>
              )}
              {showConfidence && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Confidence: {Math.round(speaker.confidence * 100)}%
                </div>
              )}
            </div>

            {isActive && (
              <div className="flex items-center gap-1 ml-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Speaking
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact version of SpeakerEditor for inline use
 */
export function SpeakerBadge({
  speaker,
  isActive = false,
  onClick,
  className = "",
}: {
  speaker: Speaker;
  isActive?: boolean;
  onClick?: (speakerId: string) => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onClick?.(speaker.id)}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        transition-colors duration-150
        ${isActive
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
        }
        hover:bg-opacity-80
        ${className}
      `}
      aria-label={`Speaker: ${speaker.label}${isActive ? " (active)" : ""}`}
    >
      <span>{speaker.characterName || speaker.label}</span>
      {isActive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
        </span>
      )}
    </button>
  );
}

/**
 * Speaker list for transcript display
 */
export function SpeakerList({
  speakers,
  activeSpeakerId,
  onSpeakerSelect,
  className = "",
}: {
  speakers: Speaker[];
  activeSpeakerId?: string;
  onSpeakerSelect?: (speakerId: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="list" aria-label="Speaker list">
      {speakers.map((speaker) => (
        <SpeakerBadge
          key={speaker.id}
          speaker={speaker}
          isActive={speaker.id === activeSpeakerId}
          onClick={onSpeakerSelect}
        />
      ))}
    </div>
  );
}
