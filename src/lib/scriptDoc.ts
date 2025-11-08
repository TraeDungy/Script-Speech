import type {
  ScriptFormatDefinition,
  ScriptFormatId,
  ScriptFormatLengthProfile,
} from "@/lib/scriptFormats";

export type ScriptFormat = ScriptFormatId;

export interface ScriptDocFormatRecommendation {
  formatId: ScriptFormatId;
  confidence: number;
  rationale: string;
  suggestedLength?: ScriptFormatLengthProfile;
  suggestedGenres?: string[];
}

export interface ScriptDocRelatedProject {
  projectId: string;
  relationship:
    | "sequel"
    | "prequel"
    | "spinoff"
    | "shared-universe"
    | "remake"
    | "adaptation"
    | "inspired-by"
    | "cross-over"
    | "reference";
  title?: string;
  notes?: string;
}

export interface ScriptDocConceptAnalysis {
  conceptSummary: string;
  keywords: string[];
  audiencePromise?: string;
  genreConfidence: Array<{ genre: string; confidence: number }>;
  toneConfidence?: Array<{ tone: string; confidence: number }>;
  lengthRecommendation?: {
    unit: ScriptFormatLengthProfile["unit"];
    min?: number;
    max?: number;
    typical?: number;
    confidence: number;
    rationale?: string;
  };
  recommendedFormats: ScriptDocFormatRecommendation[];
  relatedProjects: ScriptDocRelatedProject[];
  isFranchiseExtension: boolean;
  extensionNotes?: string;
}

export type ScriptReferenceSource = "upload" | "link";

export interface ScriptReferenceAsset {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  sourceType: ScriptReferenceSource;
  attribution?: string;
  tags?: string[];
  privacy?: "public" | "private";
}

export interface ScriptDocMetadata {
  projectId: string;
  title: string;
  format: ScriptFormat;
  genre: string;
  subgenres?: string[];
  logline: string;
  rating?: string;
  toneKeywords: string[];
  targetLength: {
    unit: "pages" | "minutes" | "seconds";
    value: number;
  };
  status: "outline" | "draft" | "polish" | "locked";
  createdAt: string;
  updatedAt: string;
  relatedProjects?: ScriptDocRelatedProject[];
  franchiseOriginId?: string;
  isExtension?: boolean;
  customFormatDefinition?: ScriptFormatDefinition;
}

interface ScriptEntityCommon {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  notes?: string;
  referenceAssetIds: string[];
}

export interface ScriptDocCharacter extends ScriptEntityCommon {
  pronouns?: string;
  archetype?: string;
  goal?: string;
  arc?: string;
  voiceNotes?: string;
}

export interface ScriptDocLocation extends ScriptEntityCommon {
  type: "interior" | "exterior" | "mixed";
  timeOfDayPreferences?: string[];
  sensoryNotes?: string;
}

export interface ScriptDocProp extends ScriptEntityCommon {
  purpose?: string;
  isCritical?: boolean;
}

export interface ScriptDocBeat {
  id: string;
  order: number;
  title: string;
  summary: string;
  intent?: string;
  spotlightCharacterIds: string[];
  locationIds: string[];
  referenceAssetIds: string[];
  durationSeconds?: number;
  sceneIds: string[];
}

export type ScriptSceneElementType =
  | "action"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "note";

interface ScriptSceneElementBase {
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

export interface ScriptSceneParentheticalElement
  extends ScriptSceneElementBase {
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

export interface ScriptDocRevision {
  id: string;
  version: string;
  label?: string;
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface ScriptDoc {
  metadata: ScriptDocMetadata;
  revision: ScriptDocRevision;
  referenceAssets: ScriptReferenceAsset[];
  characters: ScriptDocCharacter[];
  locations: ScriptDocLocation[];
  props: ScriptDocProp[];
  beats: ScriptDocBeat[];
  scenes: ScriptScene[];
  conceptAnalysis: ScriptDocConceptAnalysis;
}
