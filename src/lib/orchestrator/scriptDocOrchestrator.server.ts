import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  scriptDocBeatSchema,
  scriptSceneSchema,
  type ScriptDoc,
  type ScriptDocBeat,
  type ScriptScene,
} from "@/lib/scriptDoc";
import type { RetrievalMatch } from "@/lib/retrieval/referenceRetrieval.server";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini";
const MAX_RETRIES = Number(process.env.SCRIPT_DOC_ORCHESTRATOR_RETRIES ?? 2);

const plannerBeatSchema = z.object({
  id: z.string(),
  focus: z.string(),
  promise: z.string(),
  lengthSeconds: z.number().optional(),
});

const plannerResponseSchema = z.object({
  beats: z.array(plannerBeatSchema).min(1),
  tone: z.array(z.string()).optional(),
  synopsis: z.string(),
});

const sceneBatchSchema = z.object({
  scenes: z.array(scriptSceneSchema),
});

type PlannerResponse = z.infer<typeof plannerResponseSchema>;

interface StructuredStepOptions<T> {
  schema: z.ZodType<T>;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

interface ScriptDocOrchestrationInput {
  doc: ScriptDoc;
  prompt: string;
  contextMatches: RetrievalMatch[];
}

export interface ScriptDocOrchestrationResult {
  plan: PlannerResponse;
  beats: ScriptDocBeat[];
  scenes: ScriptScene[];
  context: RetrievalMatch[];
}

function extractContent(payload: Record<string, unknown>): string {
  const outputText = payload.output_text;
  if (Array.isArray(outputText)) {
    const candidate = outputText.find((entry) => typeof entry === "string" && entry.trim().length);
    if (candidate) {
      return candidate;
    }
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output as Array<{ content?: Array<{ text?: string }> }>) {
      if (!Array.isArray(item.content)) {
        continue;
      }
      for (const part of item.content) {
        if (typeof part?.text === "string" && part.text.trim()) {
          return part.text;
        }
      }
    }
  }

  if (typeof payload.content === "string") {
    return payload.content;
  }

  throw new Error("Unable to extract response content");
}

function buildContextBlock(matches: RetrievalMatch[]): string {
  if (!matches.length) {
    return "No prior context snippets were retrieved.";
  }
  return matches
    .map((match) => `Source: ${match.source}\n${match.content}`)
    .join("\n---\n");
}

export class ScriptDocOrchestratorService {
  private async callStructuredStep<T>(options: StructuredStepOptions<T>): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const schemaPayload = zodToJsonSchema(options.schema, options.schemaName);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await fetch(RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: RESPONSES_MODEL,
          input: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: options.schemaName,
              schema: schemaPayload,
              strict: true,
            },
          },
          temperature: options.temperature ?? 0.5,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        lastError = new Error(`OpenAI response error: ${message}`);
        continue;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractContent(payload));
      } catch (error) {
        lastError = new Error(`Failed to parse response: ${(error as Error).message}`);
        continue;
      }

      const result = options.schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }

      lastError = new Error(`Schema validation failed: ${result.error.message}`);
    }

    throw lastError ?? new Error("Structured call failed");
  }

  private buildProjectBrief(doc: ScriptDoc): string {
    return `Title: ${doc.metadata.title}\nFormat: ${doc.metadata.format}\nLogline: ${doc.metadata.logline}\nTone: ${doc.metadata.toneKeywords.join(", ")}`;
  }

  async generate(input: ScriptDocOrchestrationInput): Promise<ScriptDocOrchestrationResult> {
    const contextBlock = buildContextBlock(input.contextMatches);

    const plannerPrompt = `Use the ScriptDoc brief to produce an act-level plan.\n\nBrief:\n${this.buildProjectBrief(input.doc)}\n\nContext:\n${contextBlock}\n\nUser goal:\n${input.prompt}`;

    const plan = await this.callStructuredStep({
      schema: plannerResponseSchema,
      schemaName: "ScriptDocPlannerResponse",
      systemPrompt:
        "You are a development editor creating production-ready ScriptDoc beat plans. Respond with strict JSON matching the provided schema.",
      userPrompt: plannerPrompt,
      temperature: 0.4,
    });

    const beats: ScriptDocBeat[] = [];
    const scenes: ScriptScene[] = [];
    let sceneOrder = input.doc.scenes.length ? input.doc.scenes.length + 1 : 1;

    for (const [index, beatPlan] of plan.beats.entries()) {
      const beat = await this.callStructuredStep({
        schema: scriptDocBeatSchema,
        schemaName: "ScriptDocBeat",
        systemPrompt:
          "You convert outline plans into ScriptDoc beats. Maintain canonical field names and respond with valid JSON only.",
        userPrompt: `Beat number ${index + 1} with ID ${beatPlan.id}. Focus: ${beatPlan.focus}. Promise: ${beatPlan.promise}. Existing brief: ${this.buildProjectBrief(input.doc)}. Context:\n${contextBlock}`,
        temperature: 0.45,
      });

      const beatScenes = await this.callStructuredStep({
        schema: sceneBatchSchema,
        schemaName: "ScriptDocSceneBatch",
        systemPrompt:
          "You expand ScriptDoc beats into fully structured scenes using the ScriptDoc scene schema.",
        userPrompt: `Beat ${beat.title} (${beat.id}) should be expanded into cinematic scenes. Each scene must include slugline, summary, and formatted elements. Context:\n${contextBlock}`,
        temperature: 0.55,
      });

      beat.sceneIds = beatScenes.scenes.map((scene) => scene.id);
      beats.push(beat);

      beatScenes.scenes.forEach((scene, offset) => {
        scenes.push({
          ...scene,
          beatId: beat.id,
          order: scene.order ?? sceneOrder + offset,
        });
      });

      sceneOrder += beatScenes.scenes.length;
    }

    return { plan, beats, scenes, context: input.contextMatches };
  }
}
