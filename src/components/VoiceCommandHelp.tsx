"use client";

/**
 * Voice Command Help Overlay
 * F017: Voice command help overlay
 *
 * Shows available voice commands in a searchable modal
 */

import React, { useState, useEffect, useCallback } from "react";
import { DEFAULT_COMMAND_PATTERNS, type CommandPattern } from "@/lib/voice/commandParser";

export interface VoiceCommandHelpProps {
  /**
   * Whether the help overlay is visible
   */
  isOpen: boolean;

  /**
   * Callback when the overlay should close
   */
  onClose: () => void;

  /**
   * Custom command patterns to display (defaults to DEFAULT_COMMAND_PATTERNS)
   */
  customPatterns?: CommandPattern[];

  /**
   * Theme variant
   */
  theme?: "dark" | "light";
}

interface CommandGroup {
  category: string;
  commands: CommandPattern[];
}

/**
 * Group commands by category based on their type prefix
 */
function groupCommands(patterns: CommandPattern[]): CommandGroup[] {
  const groups: Record<string, CommandPattern[]> = {};

  patterns.forEach((pattern) => {
    // Determine category from command type
    let category = "Other";
    if (pattern.type.includes("scene")) category = "Scene";
    else if (pattern.type.includes("character")) category = "Character";
    else if (pattern.type === "delete" || pattern.type === "undo" || pattern.type === "redo") category = "Edit";
    else if (pattern.type === "save" || pattern.type === "export") category = "File";
    else if (pattern.type.includes("make_")) category = "Formatting";
    else if (pattern.type.includes("go_to")) category = "Navigation";
    else if (pattern.type === "help") category = "Help";
    else if (pattern.type === "read_aloud" || pattern.type === "stop") category = "Playback";

    if (!groups[category]) groups[category] = [];
    groups[category].push(pattern);
  });

  // Convert to array and sort by category
  return Object.entries(groups)
    .map(([category, commands]) => ({ category, commands }))
    .sort((a, b) => {
      // Priority order
      const order = ["Scene", "Character", "Edit", "File", "Formatting", "Navigation", "Playback", "Help", "Other"];
      return order.indexOf(a.category) - order.indexOf(b.category);
    });
}

export function VoiceCommandHelp({
  isOpen,
  onClose,
  customPatterns,
  theme = "dark",
}: VoiceCommandHelpProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const patterns = customPatterns || DEFAULT_COMMAND_PATTERNS;
  const commandGroups = groupCommands(patterns);

  // Filter commands based on search query
  const filteredGroups = commandGroups
    .map((group) => ({
      ...group,
      commands: group.commands.filter(
        (cmd) =>
          cmd.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.patterns.some((pattern) => pattern.source.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    }))
    .filter((group) => group.commands.length > 0);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  const themeClasses = {
    dark: {
      backdrop: "bg-black/80",
      modal: "bg-zinc-900/95 border-white/10 text-zinc-100",
      header: "text-white border-white/10",
      search: "bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder-zinc-400",
      category: "text-emerald-400",
      command: "bg-zinc-800/30 border-zinc-700/30 hover:bg-zinc-800/50 hover:border-emerald-500/30",
      commandType: "text-emerald-300",
      description: "text-zinc-400",
      example: "bg-zinc-800/50 text-emerald-200/80",
      close: "text-zinc-400 hover:text-white hover:bg-white/10",
    },
    light: {
      backdrop: "bg-black/50",
      modal: "bg-white/95 border-zinc-200 text-zinc-900",
      header: "text-zinc-900 border-zinc-200",
      search: "bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-500",
      category: "text-emerald-600",
      command: "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-emerald-500/50",
      commandType: "text-emerald-600",
      description: "text-zinc-600",
      example: "bg-zinc-100 text-emerald-700",
      close: "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200",
    },
  };

  const t = themeClasses[theme];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${t.backdrop}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-command-help-title"
    >
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-2xl ${t.modal}`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4 ${t.header}`}>
          <div>
            <h2 id="voice-command-help-title" className="text-2xl font-bold">
              Voice Commands
            </h2>
            <p className={`text-sm mt-1 ${t.description}`}>
              Say any of these commands to control the script editor
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 transition-colors ${t.close}`}
            aria-label="Close help overlay"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-lg border px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${t.search}`}
            aria-label="Search voice commands"
          />
        </div>

        {/* Commands List */}
        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(90vh - 200px)" }}>
          {filteredGroups.length === 0 ? (
            <div className={`text-center py-8 ${t.description}`}>
              <p>No commands found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGroups.map((group) => (
                <div key={group.category}>
                  <h3 className={`text-lg font-semibold mb-3 ${t.category}`}>{group.category}</h3>
                  <div className="space-y-2">
                    {group.commands.map((command) => (
                      <div
                        key={command.type}
                        className={`rounded-lg border p-4 transition-all ${t.command}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className={`font-mono text-sm font-semibold ${t.commandType}`}>
                              {command.type.replace(/_/g, " ").toUpperCase()}
                            </div>
                            {command.description && (
                              <p className={`mt-1 text-sm ${t.description}`}>{command.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {command.patterns.slice(0, 2).map((pattern, idx) => {
                                // Extract a simple example from the regex
                                const example = pattern.source
                                  .replace(/\(\?:/g, "(")
                                  .replace(/\\s\+/g, " ")
                                  .replace(/\|/g, " or ")
                                  .replace(/[\[\](){}?*+^$|\\]/g, "")
                                  .toLowerCase()
                                  .trim()
                                  .split(" ")
                                  .slice(0, 4)
                                  .join(" ");

                                return (
                                  <span
                                    key={idx}
                                    className={`rounded px-2 py-1 text-xs font-mono ${t.example}`}
                                  >
                                    "{example}"
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 border-t px-6 py-3 text-center text-xs ${t.header} ${t.description}`}>
          Press <kbd className={`rounded px-2 py-1 font-mono ${t.example}`}>Esc</kbd> to close • Say "help" to
          show this again
        </div>
      </div>
    </div>
  );
}
