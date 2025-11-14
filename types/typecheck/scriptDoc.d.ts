import type { ScriptFormatDefinition, ScriptFormatId } from "@/lib/scriptFormats";

export interface ScriptDocTranscriptEntry {
  id: string;
  role: string;
  text: string;
  final: boolean;
  createdAt: string;
}

export interface ScriptDocFormatRecommendation {
  formatId: ScriptFormatId;
  confidence: number;
  rationale: string;
}

export interface ScriptDocRelatedProject {
  projectId: string;
  relationship: string;
  title?: string;
}

export interface ScriptDocConceptAnalysis {
  conceptSummary: string;
  keywords: string[];
  recommendedFormats?: ScriptDocFormatRecommendation[];
  relatedProjects?: ScriptDocRelatedProject[];
  conversationLog?: ScriptDocTranscriptEntry[];
}

export interface ScriptDocMetadata {
  projectId: string;
  title: string;
  format: ScriptFormatId;
  genre: string;
  logline: string;
  toneKeywords: string[];
  targetLength: { unit: "pages" | "minutes" | "seconds"; value: number };
  status: string;
  createdAt: string;
  updatedAt: string;
  customFormatDefinition?: ScriptFormatDefinition;
}

export interface ScriptDocBeat {
  id: string;
  order: number;
  title: string;
  summary: string;
  intent?: string;
  durationSeconds?: number;
  spotlightCharacterIds: string[];
  locationIds: string[];
  referenceAssetIds: string[];
  sceneIds: string[];
}

export type ScriptSceneElementType =
  | "action"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "note";

export interface ScriptSceneElementBase {
  id: string;
  type: ScriptSceneElementType;
  text: string;
  referenceAssetIds?: string[];
}

export interface ScriptSceneActionElement extends ScriptSceneElementBase {
  type: "action";
}

export interface ScriptSceneDialogueElement extends ScriptSceneElementBase {
  type: "dialogue";
  speaker: string;
  parenthetical?: string;
}

export interface ScriptSceneParentheticalElement extends ScriptSceneElementBase {
  type: "parenthetical";
  speaker?: string;
}

export interface ScriptSceneTransitionElement extends ScriptSceneElementBase {
  type: "transition";
}

export interface ScriptSceneNoteElement extends ScriptSceneElementBase {
  type: "note";
  tone?: "info" | "warning" | "success";
}

export type ScriptSceneElement =
  | ScriptSceneActionElement
  | ScriptSceneDialogueElement
  | ScriptSceneParentheticalElement
  | ScriptSceneTransitionElement
  | ScriptSceneNoteElement;

export interface ScriptSceneSlugline {
  setting: "INT" | "EXT" | "INT/EXT";
  location: string;
  timeOfDay: string;
}

export interface ScriptScene {
  id: string;
  order: number;
  beatId?: string;
  title: string;
  summary: string;
  slugline: ScriptSceneSlugline;
  elements: ScriptSceneElement[];
  referenceAssetIds: string[];
  locationIds: string[];
  characterIds: string[];
}

export interface ScriptDoc {
  metadata: ScriptDocMetadata;
  conceptAnalysis: ScriptDocConceptAnalysis;
  beats: ScriptDocBeat[];
  scenes: ScriptScene[];
}
