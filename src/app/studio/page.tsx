"use client";

import type { ChangeEvent, ReactNode, UIEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExportQueuePanel } from "@/components/ExportQueuePanel";
import type { ScriptDoc } from "@/lib/scriptDoc";
import type { StudioSessionRecord, StudioSlotPayload } from "@/lib/db/studioSessions";
import type { StudioInitializationPayload } from "./actions";
import { initializeStudioSession } from "./actions";
import { StudioOnboardingPanel } from "./onboarding-panel";
import { OnboardingWizard } from "./onboarding-wizard";

import {
  ScriptDocFormatRecommendation,
  ScriptDocRelatedProject,
  ScriptSceneElement,
  ScriptFormat,
} from "@/lib/scriptDoc";
import { selectBeats, selectScenes, useScriptDocStore } from "@/lib/state/scriptDocStore";
import type {
  ScriptFormatDefinition,
  ScriptFormatLengthProfile,
} from "@/lib/scriptFormats";
import { listScriptFormats } from "@/lib/scriptFormats";

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  className?: string;
};

const clampConfidence = (value: number) => Math.max(0, Math.min(1, value));

const formatLengthProfile = (profile: ScriptFormatLengthProfile) => {
  const unitLabel =
    profile.unit === "minutes"
      ? "min"
      : profile.unit === "pages"
      ? "pages"
      : "sec";
  if (profile.min && profile.max) {
    return `${profile.min}-${profile.max} ${unitLabel}`;
  }
  if (profile.min && !profile.max) {
    return `${profile.min}+ ${unitLabel}`;
  }
  if (!profile.min && profile.max) {
    return `≤${profile.max} ${unitLabel}`;
  }
  return `${profile.typical} ${unitLabel}`;
};

const relationshipLabelMap: Record<
  ScriptDocRelatedProject["relationship"],
  string
> = {
  sequel: "Sequel",
  prequel: "Prequel",
  spinoff: "Spin-off",
  "shared-universe": "Shared universe",
  remake: "Remake",
  adaptation: "Adaptation",
  "inspired-by": "Inspired by",
  "cross-over": "Cross-over",
  reference: "Reference",
};

type RelatedProjectWithSource = ScriptDocRelatedProject & {
  source: "metadata" | "analysis" | "both";
};

function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  getKey,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + height) / itemHeight) + 2,
    );
    return { startIndex: start, endIndex: end };
  }, [scrollTop, itemHeight, height, items.length]);

  const visibleItems = items.slice(startIndex, endIndex + 1);

  return (
    <div
      onScroll={handleScroll}
      className={className}
      style={{ height, overflowY: "auto", position: "relative" }}
    >
      <div style={{ height: items.length * itemHeight, position: "relative" }}>
        {visibleItems.map((item, idx) => {
          const index = startIndex + idx;
          return (
            <div
              key={getKey(item, index)}
              style={{
                position: "absolute",
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
                paddingBottom: 12,
              }}
              className="px-1"
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FormatRecommendationCardProps = {
  recommendation: ScriptDocFormatRecommendation;
  definition?: ScriptFormatDefinition | null;
};

function FormatRecommendationCard({
  recommendation,
  definition,
}: FormatRecommendationCardProps) {
  const percent = Math.round(clampConfidence(recommendation.confidence) * 100);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/10 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-white">
            {definition?.label ?? recommendation.formatId}
          </h4>
          {definition?.category && (
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
              {definition.category}
            </p>
          )}
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-300">
          {percent}% match
        </span>
      </header>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      {recommendation.rationale && (
        <p className="mt-3 text-sm text-zinc-300">{recommendation.rationale}</p>
      )}
      {(recommendation.suggestedLength || recommendation.suggestedGenres?.length) && (
        <dl className="mt-3 space-y-2 text-xs text-zinc-400">
          {recommendation.suggestedLength && (
            <div className="flex justify-between gap-2">
              <dt className="uppercase tracking-[0.3em]">Length</dt>
              <dd className="text-right text-zinc-200">
                {formatLengthProfile(recommendation.suggestedLength)}
                {recommendation.suggestedLength.notes && (
                  <span className="block text-[0.65rem] text-zinc-400">
                    {recommendation.suggestedLength.notes}
                  </span>
                )}
              </dd>
            </div>
          )}
          {recommendation.suggestedGenres?.length ? (
            <div className="flex justify-between gap-2">
              <dt className="uppercase tracking-[0.3em]">Genres</dt>
              <dd className="flex flex-wrap justify-end gap-1 text-right text-zinc-200">
                {recommendation.suggestedGenres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem]"
                  >
                    {genre}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </article>
  );
}

function HistoryControls() {
  const undo = useScriptDocStore((state) => state.undo);
  const redo = useScriptDocStore((state) => state.redo);
  const hasUndo = useScriptDocStore((state) => state.hasUndo);
  const hasRedo = useScriptDocStore((state) => state.hasRedo);

  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-zinc-500">
      <button
        type="button"
        className="rounded-full border border-white/10 px-4 py-2 text-[0.65rem] text-zinc-300 transition-colors duration-200 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
        onClick={undo}
        disabled={!hasUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className="rounded-full border border-white/10 px-4 py-2 text-[0.65rem] text-zinc-300 transition-colors duration-200 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
        onClick={redo}
        disabled={!hasRedo}
      >
        Redo
      </button>
    </div>
  );
}

function OutlineEditor() {
  const beats = useScriptDocStore(selectBeats);
  const updateBeat = useScriptDocStore((state) => state.updateBeat);
  const addBeatAfter = useScriptDocStore((state) => state.addBeatAfter);
  const reorderBeats = useScriptDocStore((state) => state.reorderBeats);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Outline</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Beat sheet</h2>
        </div>
        <HistoryControls />
      </div>
      <p className="mt-4 max-w-xl text-sm text-zinc-400">
        Reorder beats, refine intent, and branch new ideas directly into the living ScriptDoc. Changes are tracked for undo/redo.
      </p>
      <button
        type="button"
        onClick={() => addBeatAfter(beats[beats.length - 1]?.id)}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-dashed border-white/20 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/40 hover:text-white"
      >
        + Add beat
      </button>
      <VirtualList
        items={beats}
        itemHeight={168}
        height={480}
        className="mt-6"
        getKey={(beat) => beat.id}
        renderItem={(beat, index) => (
          <OutlineBeatRow
            key={beat.id}
            beat={beat}
            index={index}
            total={beats.length}
            onMove={(target) => reorderBeats(index, target)}
            onChangeTitle={(value) => updateBeat(beat.id, { title: value })}
            onChangeSummary={(value) => updateBeat(beat.id, { summary: value })}
            onChangeIntent={(value) => updateBeat(beat.id, { intent: value })}
            onAddBelow={() => addBeatAfter(beat.id)}
          />
        )}
      />
    </div>
  );
}

type OutlineBeatRowProps = {
  beat: ReturnType<typeof selectBeats>[number];
  index: number;
  total: number;
  onMove: (targetIndex: number) => void;
  onChangeTitle: (value: string) => void;
  onChangeSummary: (value: string) => void;
  onChangeIntent: (value: string) => void;
  onAddBelow: () => void;
};

function OutlineBeatRow({
  beat,
  index,
  total,
  onMove,
  onChangeTitle,
  onChangeSummary,
  onChangeIntent,
  onAddBelow,
}: OutlineBeatRowProps) {
  const titleRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const intentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (titleRef.current && titleRef.current.textContent !== beat.title) {
      titleRef.current.textContent = beat.title;
    }
  }, [beat.title]);

  useEffect(() => {
    if (summaryRef.current && summaryRef.current.textContent !== beat.summary) {
      summaryRef.current.textContent = beat.summary;
    }
  }, [beat.summary]);

  useEffect(() => {
    const value = beat.intent ?? "";
    if (intentRef.current && intentRef.current.textContent !== value) {
      intentRef.current.textContent = value;
    }
  }, [beat.intent]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-vs-panel/90 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>Beat</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-40"
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-40"
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
          >
            ↓
          </button>
        </div>
      </div>
      <div
        ref={titleRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 w-full rounded-xl border border-transparent bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-white/40 focus:outline-none"
        onBlur={(event) => onChangeTitle(event.currentTarget.textContent ?? "")}
      />
      <div
        ref={summaryRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 w-full flex-1 rounded-xl border border-transparent bg-white/5 px-3 py-2 text-sm text-zinc-300 focus:border-white/40 focus:outline-none"
        onBlur={(event) => onChangeSummary(event.currentTarget.textContent ?? "")}
      />
      <div
        ref={intentRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 w-full rounded-xl border border-dashed border-white/10 bg-white/0 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-400 focus:border-white/40 focus:outline-none"
        data-placeholder="Intent"
        onBlur={(event) => onChangeIntent(event.currentTarget.textContent ?? "")}
      />
      <button
        type="button"
        onClick={onAddBelow}
        className="mt-3 self-start text-xs text-zinc-300 underline decoration-dotted underline-offset-4 hover:text-white"
      >
        Add beat below
      </button>
    </div>
  );
}

function ScenesEditor() {
  const scenes = useScriptDocStore(selectScenes);
  const updateScene = useScriptDocStore((state) => state.updateScene);
  const updateSceneElement = useScriptDocStore((state) => state.updateSceneElement);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Scene editor</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Script canvas</h2>
        </div>
      </div>
      <p className="mt-4 max-w-xl text-sm text-zinc-400">
        Edit slug lines, summaries, and elements directly. Content updates persist to the ScriptDoc history with full undo/redo support.
      </p>
      <VirtualList
        items={scenes}
        itemHeight={248}
        height={520}
        className="mt-6"
        getKey={(scene) => scene.id}
        renderItem={(scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            onUpdateSummary={(value) =>
              updateScene(scene.id, (draft) => {
                draft.summary = value;
              })
            }
            onUpdateSlugSetting={(value) =>
              updateScene(scene.id, (draft) => {
                draft.slugline.setting = value as typeof draft.slugline.setting;
              })
            }
            onUpdateSlugLocation={(value) =>
              updateScene(scene.id, (draft) => {
                draft.slugline.location = value;
              })
            }
            onUpdateSlugTime={(value) =>
              updateScene(scene.id, (draft) => {
                draft.slugline.timeOfDay = value;
              })
            }
            onUpdateTitle={(value) =>
              updateScene(scene.id, (draft) => {
                draft.title = value;
              })
            }
            onUpdateElement={(elementId, updater) =>
              updateSceneElement(scene.id, elementId, updater)
            }
          />
        )}
      />
    </div>
  );
}

type SceneCardProps = {
  scene: ReturnType<typeof selectScenes>[number];
  onUpdateTitle: (value: string) => void;
  onUpdateSummary: (value: string) => void;
  onUpdateSlugSetting: (value: string) => void;
  onUpdateSlugLocation: (value: string) => void;
  onUpdateSlugTime: (value: string) => void;
  onUpdateElement: (
    elementId: string,
    updater: (element: ScriptSceneElement) => void,
  ) => void;
};

function SceneCard({
  scene,
  onUpdateTitle,
  onUpdateSummary,
  onUpdateSlugSetting,
  onUpdateSlugLocation,
  onUpdateSlugTime,
  onUpdateElement,
}: SceneCardProps) {
  const titleRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const settingRef = useRef<HTMLDivElement | null>(null);
  const locationRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (titleRef.current && titleRef.current.textContent !== scene.title) {
      titleRef.current.textContent = scene.title;
    }
  }, [scene.title]);

  useEffect(() => {
    if (summaryRef.current && summaryRef.current.textContent !== scene.summary) {
      summaryRef.current.textContent = scene.summary;
    }
  }, [scene.summary]);

  useEffect(() => {
    if (settingRef.current && settingRef.current.textContent !== scene.slugline.setting) {
      settingRef.current.textContent = scene.slugline.setting;
    }
  }, [scene.slugline.setting]);

  useEffect(() => {
    if (locationRef.current && locationRef.current.textContent !== scene.slugline.location) {
      locationRef.current.textContent = scene.slugline.location;
    }
  }, [scene.slugline.location]);

  useEffect(() => {
    if (timeRef.current && timeRef.current.textContent !== scene.slugline.timeOfDay) {
      timeRef.current.textContent = scene.slugline.timeOfDay;
    }
  }, [scene.slugline.timeOfDay]);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-vs-panel/90 p-5 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          Scene {String(scene.order + 1).padStart(2, "0")}
        </div>
        <div className="flex gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-400">
          <div
            ref={settingRef}
            contentEditable
            suppressContentEditableWarning
            className="rounded-full border border-transparent bg-white/5 px-3 py-1 text-white focus:border-white/40 focus:outline-none"
            onBlur={(event) => onUpdateSlugSetting(event.currentTarget.textContent ?? scene.slugline.setting)}
          />
          <div
            ref={timeRef}
            contentEditable
            suppressContentEditableWarning
            className="rounded-full border border-transparent bg-white/5 px-3 py-1 text-white focus:border-white/40 focus:outline-none"
            onBlur={(event) => onUpdateSlugTime(event.currentTarget.textContent ?? scene.slugline.timeOfDay)}
          />
        </div>
      </header>
      <div
        ref={locationRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 w-full rounded-xl border border-transparent bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.35em] text-zinc-400 focus:border-white/40 focus:outline-none"
        onBlur={(event) => onUpdateSlugLocation(event.currentTarget.textContent ?? scene.slugline.location)}
      />
      <div
        ref={titleRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 text-base font-semibold text-white focus:outline-none"
        onBlur={(event) => onUpdateTitle(event.currentTarget.textContent ?? scene.title)}
      />
      <div
        ref={summaryRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 flex-1 rounded-xl border border-transparent bg-white/5 px-3 py-2 text-sm text-zinc-300 focus:border-white/40 focus:outline-none"
        onBlur={(event) => onUpdateSummary(event.currentTarget.textContent ?? scene.summary)}
      />
      <ul className="mt-4 space-y-3">
        {scene.elements.map((element) => (
          <li key={element.id}>
            <SceneElementEditor element={element} onChange={(updater) => onUpdateElement(element.id, updater)} />
          </li>
        ))}
      </ul>
    </article>
  );
}

type SceneElementEditorProps = {
  element: ScriptSceneElement;
  onChange: (updater: (element: ScriptSceneElement) => void) => void;
};

function SceneElementEditor({ element, onChange }: SceneElementEditorProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const speakerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== element.text) {
      contentRef.current.textContent = element.text;
    }
  }, [element.text]);

  useEffect(() => {
    if (!speakerRef.current) return;
    if (element.type === "dialogue" || element.type === "parenthetical") {
      const value = element.speaker ?? "";
      if (speakerRef.current.textContent !== value) {
        speakerRef.current.textContent = value;
      }
    } else if (speakerRef.current.textContent) {
      speakerRef.current.textContent = "";
    }
  }, [element]);

  const label = useMemo(() => {
    switch (element.type) {
      case "dialogue":
        return "Dialogue";
      case "action":
        return "Action";
      case "parenthetical":
        return "Parenthetical";
      case "transition":
        return "Transition";
      case "note":
        return "Note";
      default:
        return element.type;
    }
  }, [element.type]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-400">{label}</span>
        {(element.type === "dialogue" || element.type === "parenthetical") && (
          <div
            ref={speakerRef}
            contentEditable
            suppressContentEditableWarning
            className="rounded-full border border-transparent bg-white/10 px-3 py-1 text-[0.7rem] font-semibold text-white focus:border-white/40 focus:outline-none"
            onBlur={(event) =>
              onChange((draft) => {
                if (draft.type === "dialogue" || draft.type === "parenthetical") {
                  draft.speaker = event.currentTarget.textContent ?? "";
                }
              })
            }
          />
        )}
      </div>
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        className="mt-3 rounded-xl border border-transparent bg-black/20 px-3 py-2 text-sm text-zinc-200 focus:border-white/40 focus:outline-none"
        onBlur={(event) =>
          onChange((draft) => {
            draft.text = event.currentTarget.textContent ?? "";
          })
        }
      />
    </div>
  );
}

function ConceptIntelligencePanel() {
  const metadata = useScriptDocStore((state) => state.doc.metadata);
  const conceptAnalysis = useScriptDocStore((state) => state.doc.conceptAnalysis);
  const updateMetadata = useScriptDocStore((state) => state.updateMetadata);
  const setCustomFormatDefinition = useScriptDocStore(
    (state) => state.setCustomFormatDefinition,
  );

  const formatOptions = useMemo(() => listScriptFormats(), []);
  const formatLookup = useMemo(() => {
    const map = new Map<ScriptFormat, ScriptFormatDefinition>();
    formatOptions.forEach((format) => {
      map.set(format.id as ScriptFormat, format);
    });
    return map;
  }, [formatOptions]);

  const handleFormatChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      updateMetadata({ format: event.target.value as ScriptFormat });
    },
    [updateMetadata],
  );

  const selectedFormatDefinition =
    formatLookup.get(metadata.format) ?? metadata.customFormatDefinition ?? null;

  const recommendedFormats = useMemo(
    () =>
      [...conceptAnalysis.recommendedFormats].sort(
        (a, b) => clampConfidence(b.confidence) - clampConfidence(a.confidence),
      ),
    [conceptAnalysis.recommendedFormats],
  );

  const relatedProjects = useMemo(() => {
    const combined = new Map<string, RelatedProjectWithSource>();
    (metadata.relatedProjects ?? []).forEach((project) => {
      combined.set(project.projectId, { ...project, source: "metadata" });
    });
    conceptAnalysis.relatedProjects.forEach((project) => {
      const existing = combined.get(project.projectId);
      if (existing) {
        combined.set(project.projectId, {
          ...existing,
          relationship: existing.relationship || project.relationship,
          notes:
            existing.notes && project.notes
              ? `${existing.notes} / ${project.notes}`
              : existing.notes || project.notes,
          source:
            existing.source === "metadata"
              ? "both"
              : existing.source === "analysis"
              ? "both"
              : existing.source,
        });
      } else {
        combined.set(project.projectId, { ...project, source: "analysis" });
      }
    });
    return Array.from(combined.values());
  }, [metadata.relatedProjects, conceptAnalysis.relatedProjects]);

  const extensionFlag = metadata.isExtension ?? conceptAnalysis.isFranchiseExtension;

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Intelligence</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Format & franchise understanding
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <span className="uppercase tracking-[0.3em] text-zinc-500">Format</span>
            <select
              value={metadata.format}
              onChange={handleFormatChange}
              className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[0.7rem] uppercase tracking-[0.3em] text-white focus:border-white/40 focus:outline-none"
            >
              {formatOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {selectedFormatDefinition ? (
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                Selected format profile
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                {selectedFormatDefinition.label}
              </h3>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-300">
              {selectedFormatDefinition.category}
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-300">
            {selectedFormatDefinition.description}
          </p>
          <dl className="mt-4 grid gap-3 text-xs text-zinc-400 md:grid-cols-3">
            <div>
              <dt className="uppercase tracking-[0.3em]">Default length</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {formatLengthProfile(selectedFormatDefinition.defaultLength)}
              </dd>
            </div>
            {selectedFormatDefinition.commonGenres?.length ? (
              <div>
                <dt className="uppercase tracking-[0.3em]">Common genres</dt>
                <dd className="mt-1 flex flex-wrap gap-1 text-sm text-zinc-200">
                  {selectedFormatDefinition.commonGenres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem]"
                    >
                      {genre}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {selectedFormatDefinition.usageExamples?.length ? (
              <div>
                <dt className="uppercase tracking-[0.3em]">Use cases</dt>
                <dd className="mt-1 text-sm text-zinc-200">
                  {selectedFormatDefinition.usageExamples.join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
          Select or register a format to load its canonical guidance.
        </div>
      )}

      {metadata.customFormatDefinition && (
        <button
          type="button"
          onClick={() => setCustomFormatDefinition(null)}
          className="self-start text-xs text-zinc-300 underline decoration-dotted underline-offset-4 hover:text-white"
        >
          Clear custom format override
        </button>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
          AI-backed recommendations
        </p>
        <h3 className="mt-1 text-base font-semibold text-white">
          Optimal storytelling vehicles
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          Script Speech&apos;s LLM scans concept language to align length, medium, and genre fit across
          the format registry.
        </p>
        {recommendedFormats.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {recommendedFormats.map((recommendation) => (
              <FormatRecommendationCard
                key={recommendation.formatId}
                recommendation={recommendation}
                definition={formatLookup.get(recommendation.formatId as ScriptFormat) ?? null}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Feed your concept to the LLM to generate tailored format recommendations.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
          Franchise signals
        </p>
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-white">
              {extensionFlag ? "Extension detected" : "Original concept"}
            </span>
            {metadata.franchiseOriginId && (
              <span className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-300">
                Franchise ID: {metadata.franchiseOriginId}
              </span>
            )}
          </div>
          {conceptAnalysis.extensionNotes && (
            <p className="text-sm text-zinc-300">{conceptAnalysis.extensionNotes}</p>
          )}
          {relatedProjects.length ? (
            <ul className="space-y-3 text-sm">
              {relatedProjects.map((project) => (
                <li key={project.projectId} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {project.title ?? project.projectId}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                      {relationshipLabelMap[project.relationship]}
                    </span>
                  </div>
                  {project.notes && (
                    <p className="mt-2 text-xs text-zinc-400">{project.notes}</p>
                  )}
                  {project.source === "both" ? (
                    <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-sky-300">
                      Studio & AI aligned
                    </p>
                  ) : (
                    <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500">
                      {project.source === "analysis" ? "AI identified" : "Studio noted"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">
              No related projects detected yet. Feed context to surface franchise connections.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
import { VoiceChatPanel, VoiceChatProvider, VoiceControlBar } from "./voice-chat-panel";

const prompts = [
  "Outline the cold open with a single location",
  "Drop in references for lighting and costume",
  "Preview export package"
];

export default function StudioPage() {
  const metadata = useScriptDocStore((state) => state.doc.metadata);
  const loadDoc = useScriptDocStore((state) => state.loadDoc);
  const updateMetadata = useScriptDocStore((state) => state.updateMetadata);
  const [initialization, setInitialization] = useState<StudioInitializationPayload | null>(null);
  const [session, setSession] = useState<StudioSessionRecord | null>(null);
  const projectId = metadata.projectId ?? "preview-project";

  const applySlotMetadata = useCallback(
    (slots?: StudioSlotPayload | null) => {
      if (!slots) {
        return;
      }

      const updates: Partial<ScriptDoc["metadata"]> = {};
      if (typeof slots.format === "string" && slots.format.trim()) {
        updates.format = slots.format;
      }

      if (Array.isArray(slots.toneKeywords) && slots.toneKeywords.length) {
        updates.toneKeywords = slots.toneKeywords;
      }

      if (typeof slots.constraints === "string" && slots.constraints.trim()) {
        updates.notes = slots.constraints.trim();
      }

      if (Object.keys(updates).length) {
        updateMetadata(updates);
      }
    },
    [updateMetadata],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        // Demo mode: skip database initialization if not available
        const hasSupabaseConfig = !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        if (!hasSupabaseConfig) {
          // Demo mode: set up default project
          console.log("Studio running in demo mode");
          updateMetadata({
            projectId: "demo-project",
            title: "Demo Script",
            format: "feature",
          });
          setInitialization(null);
          setSession(null);
          return;
        }

        const data = await initializeStudioSession();
        if (cancelled) {
          return;
        }

        setInitialization(data);

        if (data?.scriptDoc) {
          loadDoc(data.scriptDoc);
        } else if (data?.project) {
          updateMetadata({
            projectId: data.project.id,
            title: data.project.title,
            format: data.project.scriptType,
          });
        }

        setSession(data.session);
        if (data.session.status === "confirmed") {
          applySlotMetadata((data.session.summary ?? data.session.slots ?? {}) as StudioSlotPayload);
        }
      } catch (error) {
        console.error("Failed to hydrate studio project, using demo mode", error);
        // Fallback to demo mode
        updateMetadata({
          projectId: "demo-project",
          title: "Demo Script",
          format: "feature",
        });
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [applySlotMetadata, loadDoc, updateMetadata]);

  return (
    <VoiceChatProvider>
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-16 md:px-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Workspace</p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">Script Speech studio canvas</h1>
          <p className="max-w-3xl text-base text-zinc-400 md:text-lg">
            Live-edit the <span className="font-semibold text-white">{metadata.title}</span> blueprint. Every beat, scene, and annotation syncs through the ScriptDoc store for rapid iteration.
          </p>
          <Link href="/" className="text-sm text-zinc-300 hover:text-white">
            Return to the landing page ↗
          </Link>
        </header>

        <VoiceControlBar />

        <OnboardingWizard initialization={initialization} onSessionUpdated={setSession} />

        <StudioOnboardingPanel
          session={session}
          onSessionUpdated={setSession}
          onSessionConfirmed={(next) => {
            setSession(next);
            applySlotMetadata((next.summary ?? next.slots ?? {}) as StudioSlotPayload);
          }}
        />

        <section className="grid gap-10 md:grid-cols-[1.1fr_1.4fr]">
          <OutlineEditor />
          <ScenesEditor />
        </section>

        <section>
          <ConceptIntelligencePanel />
        </section>
        <section className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500">
                <span>Scene canvas</span>
                <span>Live sync</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                  <p className="text-sm font-semibold text-white">Outline</p>
                  <p className="text-sm text-zinc-400">
                    Beat markers snap to your spoken timing. Drag to reorder or dictate adjustments for instant updates.
                  </p>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                  <p className="text-sm font-semibold text-white">Script view</p>
                  <p className="text-sm text-zinc-400">
                    Scene text updates line-by-line with each directive. Hand off or continue typing without switching modes.
                  </p>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                  <p className="text-sm font-semibold text-white">Reference rail</p>
                  <p className="text-sm text-zinc-400">
                    Slide boards and clips in from the edge, attach them to beats, and keep exports aligned.
                  </p>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                  <p className="text-sm font-semibold text-white">Export queue</p>
                  <p className="text-sm text-zinc-400">
                    Queue Fountain, FDX, and PDF without leaving the canvas. Status pulses softly when jobs finish.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <aside className="space-y-6">
            <VoiceChatPanel />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Quick prompts</p>
              <ul className="mt-4 space-y-3">
                {prompts.map((prompt) => (
                  <li key={prompt} className="rounded-2xl border border-white/10 bg-vs-panel p-3 text-sm text-zinc-300 transition-colors duration-300 hover:border-white/25 hover:text-white">
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
            <ExportQueuePanel projectId={projectId} />
          </aside>
        </section>
      </main>
    </VoiceChatProvider>
  );
}
