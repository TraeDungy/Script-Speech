import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type {
  ScriptFormatDefinition,
  ScriptFormatId,
} from "@/lib/scriptFormats";

export type ScriptFormat = ScriptFormatId;

const stringArraySchema = z.array(z.string());
const lengthUnitSchema = z.enum(["pages", "minutes", "seconds"]);
const scriptFormatIdSchema: ZodType<ScriptFormat> = z.string();
const scriptFormatDefinitionSchema: ZodType<ScriptFormatDefinition> = z.any();

export const scriptDocFormatRecommendationSchema = z.object({
  formatId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  suggestedLength: z
    .object({
      unit: lengthUnitSchema,
      min: z.number().optional(),
      max: z.number().optional(),
      typical: z.number().optional(),
      confidence: z.number().min(0).max(1),
      rationale: z.string().optional(),
    })
    .partial({
      unit: false,
      confidence: false,
    })
    .optional(),
  suggestedGenres: stringArraySchema.optional(),
});

export type ScriptDocFormatRecommendation = z.infer<
  typeof scriptDocFormatRecommendationSchema
>;

export const scriptDocRelatedProjectSchema = z.object({
  projectId: z.string(),
  relationship: z.enum([
    "sequel",
    "prequel",
    "spinoff",
    "shared-universe",
    "remake",
    "adaptation",
    "inspired-by",
    "cross-over",
    "reference",
  ]),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export type ScriptDocRelatedProject = z.infer<typeof scriptDocRelatedProjectSchema>;

export const scriptDocTranscriptEntrySchema = z.object({
  id: z.string(),
  role: z.string(),
  text: z.string(),
  final: z.boolean(),
  createdAt: z.string(),
});

export type ScriptDocTranscriptEntry = z.infer<
  typeof scriptDocTranscriptEntrySchema
>;

export const scriptDocConceptAnalysisSchema = z.object({
  conceptSummary: z.string(),
  keywords: stringArraySchema,
  audiencePromise: z.string().optional(),
  genreConfidence: z.array(z.object({ genre: z.string(), confidence: z.number() })),
  toneConfidence: z
    .array(z.object({ tone: z.string(), confidence: z.number() }))
    .optional(),
  lengthRecommendation: z
    .object({
      unit: lengthUnitSchema,
      min: z.number().optional(),
      max: z.number().optional(),
      typical: z.number().optional(),
      confidence: z.number(),
      rationale: z.string().optional(),
    })
    .optional(),
  recommendedFormats: z.array(scriptDocFormatRecommendationSchema),
  relatedProjects: z.array(scriptDocRelatedProjectSchema),
  isFranchiseExtension: z.boolean(),
  extensionNotes: z.string().optional(),
  conversationLog: z.array(scriptDocTranscriptEntrySchema).optional(),
});

export type ScriptDocConceptAnalysis = z.infer<
  typeof scriptDocConceptAnalysisSchema
>;

export const scriptReferenceSourceSchema = z.enum(["upload", "link"]);
export type ScriptReferenceSource = z.infer<typeof scriptReferenceSourceSchema>;

export const scriptReferenceAssetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  sourceType: scriptReferenceSourceSchema,
  attribution: z.string().optional(),
  tags: stringArraySchema.optional(),
  privacy: z.enum(["public", "private"]).optional(),
});

export type ScriptReferenceAsset = z.infer<typeof scriptReferenceAssetSchema>;

export const scriptDocMetadataSchema = z.object({
  projectId: z.string(),
  title: z.string(),
  format: scriptFormatIdSchema,
  genre: z.string(),
  subgenres: stringArraySchema.optional(),
  logline: z.string(),
  rating: z.string().optional(),
  toneKeywords: stringArraySchema,
  targetLength: z.object({
    unit: lengthUnitSchema,
    value: z.number(),
  }),
  status: z.enum(["outline", "draft", "polish", "locked"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  relatedProjects: z.array(scriptDocRelatedProjectSchema).optional(),
  franchiseOriginId: z.string().optional(),
  isExtension: z.boolean().optional(),
  customFormatDefinition: scriptFormatDefinitionSchema.optional(),
});

export type ScriptDocMetadata = z.infer<typeof scriptDocMetadataSchema>;

const scriptEntityCommonSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: stringArraySchema.optional(),
  notes: z.string().optional(),
  referenceAssetIds: stringArraySchema.default([]),
});

export const scriptDocCharacterSchema = scriptEntityCommonSchema.extend({
  pronouns: z.string().optional(),
  archetype: z.string().optional(),
  goal: z.string().optional(),
  arc: z.string().optional(),
  voiceNotes: z.string().optional(),
});

export type ScriptDocCharacter = z.infer<typeof scriptDocCharacterSchema>;

export const scriptDocLocationSchema = scriptEntityCommonSchema.extend({
  type: z.enum(["interior", "exterior", "mixed"]),
  timeOfDayPreferences: stringArraySchema.optional(),
  sensoryNotes: z.string().optional(),
});

export type ScriptDocLocation = z.infer<typeof scriptDocLocationSchema>;

export const scriptDocPropSchema = scriptEntityCommonSchema.extend({
  purpose: z.string().optional(),
  isCritical: z.boolean().optional(),
});

export type ScriptDocProp = z.infer<typeof scriptDocPropSchema>;

export const scriptDocBeatSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  title: z.string(),
  summary: z.string(),
  intent: z.string().optional(),
  spotlightCharacterIds: stringArraySchema.default([]),
  locationIds: stringArraySchema.default([]),
  referenceAssetIds: stringArraySchema.default([]),
  durationSeconds: z.number().optional(),
  sceneIds: stringArraySchema.default([]),
});

export type ScriptDocBeat = z.infer<typeof scriptDocBeatSchema>;

export const scriptSceneElementTypeSchema = z.enum([
  "action",
  "dialogue",
  "parenthetical",
  "transition",
  "note",
]);

export type ScriptSceneElementType = z.infer<typeof scriptSceneElementTypeSchema>;

const scriptSceneElementBaseSchema = z.object({
  id: z.string(),
  type: scriptSceneElementTypeSchema,
  text: z.string(),
  referenceAssetIds: stringArraySchema.optional(),
});

export const scriptSceneActionElementSchema = scriptSceneElementBaseSchema.extend({
  type: z.literal("action"),
});

export const scriptSceneDialogueElementSchema = scriptSceneElementBaseSchema.extend({
  type: z.literal("dialogue"),
  speaker: z.string(),
  parenthetical: z.string().optional(),
});

export const scriptSceneParentheticalElementSchema =
  scriptSceneElementBaseSchema.extend({
    type: z.literal("parenthetical"),
    speaker: z.string().optional(),
  });

export const scriptSceneTransitionElementSchema =
  scriptSceneElementBaseSchema.extend({
    type: z.literal("transition"),
  });

export const scriptSceneNoteElementSchema = scriptSceneElementBaseSchema.extend({
  type: z.literal("note"),
  tone: z.enum(["info", "warning", "success"]).optional(),
});

export const scriptSceneElementSchema = z.discriminatedUnion("type", [
  scriptSceneActionElementSchema,
  scriptSceneDialogueElementSchema,
  scriptSceneParentheticalElementSchema,
  scriptSceneTransitionElementSchema,
  scriptSceneNoteElementSchema,
]);

export type ScriptSceneElement = z.infer<typeof scriptSceneElementSchema>;

export const scriptSceneSluglineSchema = z.object({
  setting: z.enum(["INT", "EXT", "INT/EXT"]),
  location: z.string(),
  timeOfDay: z.string(),
});

export type ScriptSceneSlugline = z.infer<typeof scriptSceneSluglineSchema>;

export const scriptSceneSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  beatId: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  slugline: scriptSceneSluglineSchema,
  elements: z.array(scriptSceneElementSchema),
  referenceAssetIds: stringArraySchema.default([]),
  locationIds: stringArraySchema.default([]),
  characterIds: stringArraySchema.default([]),
});

export type ScriptScene = z.infer<typeof scriptSceneSchema>;

export const scriptDocRevisionSchema = z.object({
  id: z.string(),
  version: z.string(),
  label: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string(),
  notes: z.string().optional(),
});

export type ScriptDocRevision = z.infer<typeof scriptDocRevisionSchema>;

export const scriptDocSchema = z.object({
  metadata: scriptDocMetadataSchema,
  revision: scriptDocRevisionSchema,
  referenceAssets: z.array(scriptReferenceAssetSchema),
  characters: z.array(scriptDocCharacterSchema),
  locations: z.array(scriptDocLocationSchema),
  props: z.array(scriptDocPropSchema),
  beats: z.array(scriptDocBeatSchema),
  scenes: z.array(scriptSceneSchema),
  conceptAnalysis: scriptDocConceptAnalysisSchema,
});

export type ScriptDoc = z.infer<typeof scriptDocSchema>;

export const scriptDocJsonSchema = zodToJsonSchema(scriptDocSchema, "ScriptDoc");
