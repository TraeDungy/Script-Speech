"use client";

import { create } from "zustand";

import {
  ScriptDoc,
  ScriptDocBeat,
  ScriptScene,
  ScriptSceneElement,
  type ScriptDocTranscriptEntry,
} from "@/lib/scriptDoc";

const AUTOSAVE_DEBOUNCE_MS = 1500;

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveReady = false;
let autosaveProjectId: string | null = null;
let lastAutosaveDigest: string | null = null;
let autosaveDisabled = false;

const encodeDoc = (doc: ScriptDoc) => JSON.stringify(doc);

async function sendAutosave(projectId: string, doc: ScriptDoc) {
  if (typeof window === "undefined" || autosaveDisabled || !projectId) {
    return;
  }

  try {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/script-doc/autosave`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ doc }),
      },
    );

    if (!response.ok) {
      if ([401, 403, 404, 501, 503].includes(response.status)) {
        autosaveDisabled = true;
      }
      const message = await response.text();
      console.error("ScriptDoc autosave failed", message);
    }
  } catch (error) {
    console.error("Failed to autosave ScriptDoc", error);
  }
}

function scheduleAutosave(doc: ScriptDoc) {
  if (
    typeof window === "undefined" ||
    autosaveDisabled ||
    !autosaveReady ||
    !doc.metadata?.projectId
  ) {
    return;
  }

  const serialized = encodeDoc(doc);
  if (serialized === lastAutosaveDigest) {
    return;
  }

  lastAutosaveDigest = serialized;
  autosaveProjectId = doc.metadata.projectId;

  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }

  autosaveTimer = setTimeout(() => {
    if (autosaveProjectId) {
      void sendAutosave(autosaveProjectId, doc);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

type ScriptDocHistoryState = {
  doc: ScriptDoc;
  past: ScriptDoc[];
  future: ScriptDoc[];
};

export interface ScriptDocStore extends ScriptDocHistoryState {
  hasUndo: boolean;
  hasRedo: boolean;
  loadDoc: (doc: ScriptDoc) => void;
  updateMetadata: (updates: Partial<ScriptDoc["metadata"]>) => void;
  setCustomFormatDefinition: (definition: ScriptDoc["metadata"]["customFormatDefinition"] | null) => void;
  updateBeat: (beatId: string, updates: Partial<ScriptDocBeat>) => void;
  addBeatAfter: (beatId?: string) => void;
  reorderBeats: (fromIndex: number, toIndex: number) => void;
  updateScene: (sceneId: string, updater: (scene: ScriptScene) => void) => void;
  updateSceneElement: (
    sceneId: string,
    elementId: string,
    updater: (element: ScriptSceneElement) => void,
  ) => void;
  updateConceptAnalysis: (
    updater: (analysis: ScriptDoc["conceptAnalysis"]) => void,
  ) => void;
  applyPatch: (patch: Partial<ScriptDoc>) => void;
  appendTranscriptTurn: (turn: ScriptDocTranscriptEntry) => void;
  loadTranscriptLog: (turns: ScriptDocTranscriptEntry[]) => void;
  undo: () => void;
  redo: () => void;
}

const structuredCloneDoc = (doc: ScriptDoc): ScriptDoc =>
  typeof structuredClone === "function"
    ? structuredClone(doc)
    : JSON.parse(JSON.stringify(doc)) as ScriptDoc;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const deepMerge = (target: unknown, patch: unknown): unknown => {
  if (Array.isArray(target) && Array.isArray(patch)) {
    return patch;
  }

  if (isPlainObject(target) && isPlainObject(patch)) {
    const result: Record<string, unknown> = { ...target };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        continue;
      }

      result[key] = key in result ? deepMerge(result[key], value) : value;
    }
    return result;
  }

  return patch;
};

const mergeScriptDocPatch = (doc: ScriptDoc, patch: Partial<ScriptDoc>): ScriptDoc => {
  const merged = deepMerge(structuredCloneDoc(doc), patch) as ScriptDoc;
  ensureOrder(merged);
  return merged;
};

const applyOrder = <T extends { order: number }>(items: T[]) => {
  items.forEach((item, index) => {
    item.order = index;
  });
};

const randomId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10));

const createInitialScriptDoc = (): ScriptDoc => ({
  metadata: {
    projectId: "",
    title: "Untitled project",
    format: "feature",
    genre: "Unspecified",
    logline: "",
    toneKeywords: [],
    targetLength: {
      unit: "pages",
      value: 0,
    },
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  revision: {
    id: "initial",
    version: "0.0.1",
    createdAt: new Date().toISOString(),
    createdBy: "Script Speech",
  },
  referenceAssets: [],
  characters: [],
  locations: [],
  props: [],
  beats: [],
  scenes: [],
  exportSnapshots: [],
  conceptAnalysis: {
    conceptSummary: "",
    keywords: [],
    genreConfidence: [],
    recommendedFormats: [],
    relatedProjects: [],
    isFranchiseExtension: false,
  },
});

const initialDoc = createInitialScriptDoc();

function ensureOrder(doc: ScriptDoc) {
  applyOrder(doc.beats);
  applyOrder(doc.scenes);
}

ensureOrder(initialDoc);

export const useScriptDocStore = create<ScriptDocStore>((set, get) => ({
  doc: structuredCloneDoc(initialDoc),
  past: [],
  future: [],
  hasUndo: false,
  hasRedo: false,
  loadDoc: (doc) => {
    const cloned = structuredCloneDoc(doc);
    ensureOrder(cloned);
    set({
      doc: cloned,
      past: [],
      future: [],
      hasUndo: false,
      hasRedo: false,
    });
    if (typeof window !== "undefined") {
      autosaveReady = true;
      autosaveProjectId = cloned.metadata?.projectId ?? null;
      lastAutosaveDigest = encodeDoc(cloned);
    }
  },
  updateMetadata: (updates) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    draft.metadata = { ...draft.metadata, ...updates };
    ensureOrder(draft);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  setCustomFormatDefinition: (definition) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    draft.metadata = {
      ...draft.metadata,
      customFormatDefinition: definition || undefined,
    };
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  updateBeat: (beatId, updates) => {
    const apply = get();
    const previous = apply.doc;
    const draft = structuredCloneDoc(previous);
    const beat = draft.beats.find((b) => b.id === beatId);
    if (!beat) {
      return;
    }
    Object.assign(beat, updates);
    ensureOrder(draft);
    set({
      doc: draft,
      past: [...apply.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  addBeatAfter: (beatId) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    const beats = draft.beats;
    const insertIndex = beatId
      ? Math.max(
          0,
          beats.findIndex((beat) => beat.id === beatId) + 1,
        )
      : beats.length;
    const newBeat: ScriptDocBeat = {
      id: randomId(),
      order: insertIndex,
      title: "New beat",
      summary: "Detail what should happen in this moment.",
      spotlightCharacterIds: [],
      locationIds: [],
      propIds: [],
      referenceAssetIds: [],
      sceneIds: [],
    };
    beats.splice(insertIndex, 0, newBeat);
    ensureOrder(draft);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  reorderBeats: (fromIndex, toIndex) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    const beats = draft.beats;
    if (
      fromIndex < 0 ||
      fromIndex >= beats.length ||
      toIndex < 0 ||
      toIndex >= beats.length
    ) {
      return;
    }
    const [moved] = beats.splice(fromIndex, 1);
    beats.splice(toIndex, 0, moved);
    ensureOrder(draft);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  updateScene: (sceneId, updater) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    const scene = draft.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }
    updater(scene);
    ensureOrder(draft);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  updateSceneElement: (sceneId, elementId, updater) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    const scene = draft.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }
    const element = scene.elements.find((el) => el.id === elementId);
    if (!element) {
      return;
    }
    updater(element);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  updateConceptAnalysis: (updater) => {
    const state = get();
    const previous = state.doc;
    const draft = structuredCloneDoc(previous);
    updater(draft.conceptAnalysis);
    set({
      doc: draft,
      past: [...state.past, previous],
      future: [],
      hasUndo: true,
      hasRedo: false,
    });
  },
  applyPatch: (patch) => {
    console.log("[scriptDocStore] applyPatch called with:", JSON.stringify(patch, null, 2));
    const state = get();
    const merged = mergeScriptDocPatch(state.doc, patch);
    console.log("[scriptDocStore] Merged document:", JSON.stringify(merged, null, 2));
    set({
      doc: merged,
      past: state.past,
      future: state.future,
      hasUndo: state.hasUndo,
      hasRedo: state.hasRedo,
    });
  },
  appendTranscriptTurn: (turn) => {
    const state = get();
    const draft = structuredCloneDoc(state.doc);
    const log = Array.isArray(draft.conceptAnalysis.conversationLog)
      ? [...draft.conceptAnalysis.conversationLog]
      : [];
    const index = log.findIndex((entry) => entry.id === turn.id);
    if (index >= 0) {
      log[index] = { ...log[index], ...turn };
    } else {
      log.push({ ...turn });
    }
    log.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    draft.conceptAnalysis.conversationLog = log;
    set({
      doc: draft,
      past: state.past,
      future: state.future,
      hasUndo: state.hasUndo,
      hasRedo: state.hasRedo,
    });
  },
  loadTranscriptLog: (turns) => {
    const state = get();
    const draft = structuredCloneDoc(state.doc);
    draft.conceptAnalysis.conversationLog = [...turns].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    set({
      doc: draft,
      past: state.past,
      future: state.future,
      hasUndo: state.hasUndo,
      hasRedo: state.hasRedo,
    });
  },
  undo: () => {
    const state = get();
    if (!state.past.length) {
      return;
    }
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    set({
      doc: previous,
      past: newPast,
      future: [state.doc, ...state.future],
      hasUndo: newPast.length > 0,
      hasRedo: true,
    });
  },
  redo: () => {
    const state = get();
    if (!state.future.length) {
      return;
    }
    const [next, ...rest] = state.future;
    set({
      doc: next,
      past: [...state.past, state.doc],
      future: rest,
      hasUndo: true,
      hasRedo: rest.length > 0,
    });
  },
}));

export const selectBeats = (state: ScriptDocStore) =>
  [...state.doc.beats].sort((a, b) => a.order - b.order);

export const selectScenes = (state: ScriptDocStore) =>
  [...state.doc.scenes].sort((a, b) => a.order - b.order);

if (typeof window !== "undefined") {
  useScriptDocStore.subscribe(
    (state) => state.doc,
    (doc) => {
      scheduleAutosave(doc);
    },
  );
}

