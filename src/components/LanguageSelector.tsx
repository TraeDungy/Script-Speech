"use client";

/**
 * Language Selector Component
 * F006: Multi-language support - Spanish
 * F007: Multi-language support - French
 *
 * Provides a dropdown for selecting transcription language
 */

import React, { useState } from "react";
import { getSupportedLanguages } from "@/lib/voice/transcription";

export interface LanguageSelectorProps {
  /**
   * Currently selected language code (e.g., "en-US")
   */
  value?: string;

  /**
   * Callback when language is changed
   */
  onChange?: (languageCode: string) => void;

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;

  /**
   * Size variant
   */
  size?: "small" | "medium" | "large";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show language name only (no code)
   */
  showNameOnly?: boolean;
}

const sizeClasses = {
  small: "text-xs px-2 py-1",
  medium: "text-sm px-3 py-2",
  large: "text-base px-4 py-3",
};

export function LanguageSelector({
  value = "en-US",
  onChange,
  disabled = false,
  size = "medium",
  className = "",
  showNameOnly = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const languages = getSupportedLanguages();
  const selectedLanguage = languages.find((lang) => lang.code === value) || languages[0];

  const handleSelect = (code: string) => {
    setIsOpen(false);
    onChange?.(code);
  };

  const handleKeyDown = (e: React.KeyboardEvent, code: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(code);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled}
        className={`${sizeClasses[size]} flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 text-zinc-300 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Select transcription language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            />
          </svg>
          {showNameOnly ? selectedLanguage.name : `${selectedLanguage.name} (${selectedLanguage.code})`}
        </span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/95 py-1 shadow-xl backdrop-blur-xl"
          role="listbox"
          aria-label="Language options"
        >
          {languages.map((language) => {
            const isSelected = language.code === value;
            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(language.code)}
                onKeyDown={(e) => handleKeyDown(e, language.code)}
                className={`${sizeClasses[size]} flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                  isSelected ? "bg-white/5 text-white" : "text-zinc-300"
                }`}
              >
                <span>{showNameOnly ? language.name : `${language.name} (${language.code})`}</span>
                {isSelected && (
                  <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact language indicator (read-only display)
 */
export function LanguageIndicator({ languageCode, className = "" }: { languageCode: string; className?: string }) {
  const languages = getSupportedLanguages();
  const language = languages.find((lang) => lang.code === languageCode);

  if (!language) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-400 ${className}`}
      title={language.name}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      {language.code}
    </span>
  );
}
