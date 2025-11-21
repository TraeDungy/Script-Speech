import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { scriptDocBeatSchema, scriptSceneSchema } from "@/lib/scriptDoc";

export const plannerBeatSchema = z.object({
  id: z.string(),
  focus: z.string(),
  promise: z.string(),
  lengthSeconds: z.number().positive().optional(),
});

export const plannerResponseSchema = z.object({
  synopsis: z.string(),
  tone: z.array(z.string()).optional(),
  beats: z.array(plannerBeatSchema).min(1),
});

export const beatResponseSchema = scriptDocBeatSchema;

export const sceneBatchSchema = z.object({
  scenes: z.array(scriptSceneSchema),
});

export const orchestrationContextSchema = z.object({
  scriptDoc: z.array(
    z.object({
      source: z.string(),
      content: z.string(),
      chunkIndex: z.number().optional(),
      similarity: z.number().optional(),
    }),
  ),
  referenceAssets: z.array(
    z.object({
      assetId: z.string(),
      content: z.string(),
      similarity: z.number().optional(),
    }),
  ),
});

export const scriptDocUpdateSchema = z.object({
  plan: plannerResponseSchema,
  beats: z.array(beatResponseSchema),
  scenes: z.array(scriptSceneSchema),
  context: orchestrationContextSchema,
});

export type PlannerBeat = z.infer<typeof plannerBeatSchema>;
export type PlannerResponse = z.infer<typeof plannerResponseSchema>;
export type BeatResponse = z.infer<typeof beatResponseSchema>;
export type SceneBatchResponse = z.infer<typeof sceneBatchSchema>;
export type ScriptDocUpdatePayload = z.infer<typeof scriptDocUpdateSchema>;

export function buildJsonSchema(schema: z.ZodTypeAny, name: string) {
  return {
    name,
    schema: zodToJsonSchema(schema, name),
    strict: true,
  } as const;
}
