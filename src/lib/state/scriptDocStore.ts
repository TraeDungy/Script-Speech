"use client";

import { create } from "zustand";

import { mockScriptDoc } from "./mockScriptDoc";

import {
  ScriptDoc,
  ScriptDocBeat,
  ScriptScene,
  ScriptSceneElement,
} from "@/lib/scriptDoc";

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
  undo: () => void;
  redo: () => void;
}

const structuredCloneDoc = (doc: ScriptDoc): ScriptDoc =>
  typeof structuredClone === "function"
    ? structuredClone(doc)
    : JSON.parse(JSON.stringify(doc)) as ScriptDoc;

const applyOrder = <T extends { order: number }>(items: T[]) => {
  items.forEach((item, index) => {
    item.order = index;
  });
};

const randomId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10));

const fallbackDoc = mockScriptDoc;
const initialDoc: ScriptDoc = structuredCloneDoc(fallbackDoc);
const ensureOrder = (doc: ScriptDoc) => {
  applyOrder(doc.beats);
  applyOrder(doc.scenes);
};

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

