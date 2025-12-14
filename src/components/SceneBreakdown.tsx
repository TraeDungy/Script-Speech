"use client";

/**
 * SceneBreakdown Component
 * F034: Scene breakdown view
 *
 * Displays all scenes in a list with key information:
 * - Scene number
 * - Location (slugline)
 * - Characters
 * - Scene length
 * - Reorderable (optional)
 */

import React, { useCallback } from "react";
import type { ScriptScene, ScriptDocCharacter } from "@/lib/scriptDoc";

export interface SceneBreakdownProps {
  /**
   * Array of scenes to display
   */
  scenes: ScriptScene[];

  /**
   * Optional array of characters for name resolution
   */
  characters?: Pick<ScriptDocCharacter, "id" | "name">[];

  /**
   * Callback when a scene is clicked
   */
  onSceneClick?: (scene: ScriptScene) => void;

  /**
   * Callback when scenes are reordered (fromIndex, toIndex)
   */
  onReorder?: (fromIndex: number, toIndex: number) => void;

  /**
   * Whether to show reorder controls
   */
  showReorder?: boolean;

  /**
   * Whether the component is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface SceneItemProps {
  scene: ScriptScene;
  sceneNumber: number;
  totalScenes: number;
  characters?: Pick<ScriptDocCharacter, "id" | "name">[];
  onSceneClick?: (scene: ScriptScene) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showReorder?: boolean;
  disabled?: boolean;
}

/**
 * Individual scene item component
 */
function SceneItem({
  scene,
  sceneNumber,
  totalScenes,
  characters = [],
  onSceneClick,
  onMoveUp,
  onMoveDown,
  showReorder = false,
  disabled = false,
}: SceneItemProps) {
  const handleClick = useCallback(() => {
    if (!disabled && onSceneClick) {
      onSceneClick(scene);
    }
  }, [scene, onSceneClick, disabled]);

  const handleMoveUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onMoveUp) {
        onMoveUp();
      }
    },
    [onMoveUp]
  );

  const handleMoveDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onMoveDown) {
        onMoveDown();
      }
    },
    [onMoveDown]
  );

  // Resolve character names
  const characterNames = scene.characterIds
    .map((id) => {
      const char = characters.find((c) => c.id === id);
      return char?.name;
    })
    .filter(Boolean);

  const elementCount = scene.elements.length;
  const characterCount = scene.characterIds.length;

  // Format slugline
  const sluglineText = `${scene.slugline.setting} - ${scene.slugline.location} - ${scene.slugline.timeOfDay}`;

  return (
    <article
      role="article"
      className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-colors duration-200 hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="flex-1 text-left disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
            <span>Scene {sceneNumber}</span>
          </div>

          <h3 className="mt-2 text-base font-semibold text-white">{scene.title}</h3>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-full bg-white/10 px-2 py-1 uppercase tracking-wider">
              {scene.slugline.setting}
            </span>
            <span className="font-semibold text-zinc-300">{scene.slugline.location}</span>
            <span className="rounded-full bg-white/10 px-2 py-1 uppercase tracking-wider">
              {scene.slugline.timeOfDay}
            </span>
          </div>

          {scene.summary && (
            <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{scene.summary}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <span className="uppercase tracking-[0.2em]">Characters:</span>
              <span className="text-zinc-300">
                {characterCount > 0 ? (
                  <>
                    {characterNames.length > 0
                      ? characterNames.join(", ")
                      : `${characterCount} characters`}
                  </>
                ) : (
                  "None"
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="uppercase tracking-[0.2em]">Length:</span>
              <span className="text-zinc-300">{elementCount} elements</span>
            </div>
          </div>
        </button>

        {showReorder && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleMoveUp}
              disabled={sceneNumber === 1}
              aria-label="Move up"
              className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-zinc-300 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={handleMoveDown}
              disabled={sceneNumber === totalScenes}
              aria-label="Move down"
              className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-zinc-300 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↓
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * SceneBreakdown component for displaying all scenes
 */
export function SceneBreakdown({
  scenes,
  characters = [],
  onSceneClick,
  onReorder,
  showReorder = false,
  disabled = false,
  className = "",
}: SceneBreakdownProps) {
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (onReorder) {
        onReorder(fromIndex, toIndex);
      }
    },
    [onReorder]
  );

  // Sort scenes by order
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);

  return (
    <div
      role="region"
      aria-label="Scene breakdown"
      className={`flex flex-col gap-6 ${className}`}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Breakdown</p>
        <h2 className="mt-2 text-lg font-semibold text-white">All Scenes</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {sortedScenes.length === 0
            ? "No scenes in your script yet."
            : `${sortedScenes.length} scene${sortedScenes.length === 1 ? "" : "s"} in your script.`}
        </p>
      </div>

      {sortedScenes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-zinc-400">
            No scenes yet. Start by creating scenes in the editor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedScenes.map((scene, index) => (
            <SceneItem
              key={scene.id}
              scene={scene}
              sceneNumber={index + 1}
              totalScenes={sortedScenes.length}
              characters={characters}
              onSceneClick={onSceneClick}
              onMoveUp={
                showReorder && index > 0
                  ? () => handleReorder(index, index - 1)
                  : undefined
              }
              onMoveDown={
                showReorder && index < sortedScenes.length - 1
                  ? () => handleReorder(index, index + 1)
                  : undefined
              }
              showReorder={showReorder}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
