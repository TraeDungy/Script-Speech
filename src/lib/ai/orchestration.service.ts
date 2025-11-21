import { type ScriptDoc, scriptDocSchema } from "@/lib/scriptDoc";
import type { RetrievalMatch } from "@/lib/retrieval/referenceRetrieval.server";
import type { ReferenceAssetMatch } from "@/lib/retrieval/referenceAssetsVector.server";

import {
  beatResponseSchema,
  buildJsonSchema,
  plannerResponseSchema,
  sceneBatchSchema,
  scriptDocUpdateSchema,
  type PlannerResponse,
  type ScriptDocUpdatePayload,
} from "./schemas";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini";
const MAX_RETRIES = Number(process.env.SCRIPT_DOC_ORCHESTRATOR_RETRIES ?? 2);

interface StructuredStepOptions<T> {
  schemaName: string;
  schema: typeof plannerResponseSchema | typeof beatResponseSchema | typeof sceneBatchSchema;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface OrchestrationInput {
  doc: ScriptDoc;
  prompt: string;
  scriptContext: RetrievalMatch[];
  referenceContext: ReferenceAssetMatch[];
}

function extractContent(payload: Record<string, unknown>): string {
  if (typeof payload.status === "string" && payload.status !== "completed") {
    throw new Error(`Response status: ${payload.status}`);
  }

  const outputText = payload.output_text;
  if (Array.isArray(outputText)) {
    const candidate = outputText.find((entry) => typeof entry === "string" && entry.trim().length);
    if (candidate) return candidate;
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output as Array<{ content?: Array<{ text?: string }> }>) {
      if (!Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (typeof part?.text === "string" && part.text.trim()) {
          return part.text;
        }
      }
    }
  }

  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content;
  }

  throw new Error("Unable to extract response content");
}

function buildContextBlock(matches: RetrievalMatch[], references: ReferenceAssetMatch[]): string {
  const scriptDocBlock = matches.length
    ? matches
        .map((match) => `Source: ${match.source}\n${match.content}\n(Similarity: ${match.similarity?.toFixed(3) ?? "n/a"})`)
        .join("\n---\n")
    : "No ScriptDoc snippets retrieved.";

  const referenceBlock = references.length
    ? references
        .map(
          (match) =>
            `Reference Asset ${match.assetId}\n${match.content}\n(Similarity: ${match.similarity?.toFixed(3) ?? "n/a"})`,
        )
        .join("\n---\n")
    : "No reference assets retrieved.";

  return `ScriptDoc Context:\n${scriptDocBlock}\n\nReference Assets:\n${referenceBlock}`;
}

export class ScriptDocAiOrchestrator {
  private async callStructuredStep<T>(options: StructuredStepOptions<T>): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const schemaPayload = buildJsonSchema(options.schema, options.schemaName);
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
          response_format: { type: "json_schema", json_schema: schemaPayload },
          temperature: options.temperature ?? 0.5,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        lastError = new Error(`OpenAI response error: ${message}`);
        continue;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      if ((payload as { error?: unknown }).error) {
        lastError = new Error("Model returned error payload");
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractContent(payload));
      } catch (error) {
        lastError = new Error(`Failed to parse response: ${(error as Error).message}`);
        continue;
      }

      const result = options.schema.safeParse(parsed);
      if (result.success) {
        return result.data as T;
      }

      lastError = new Error(`Schema validation failed: ${result.error.message}`);
    }

    throw lastError ?? new Error("Structured call failed");
  }

  private buildProjectBrief(doc: ScriptDoc): string {
    const parsed = scriptDocSchema.safeParse(doc);
    if (!parsed.success) {
      throw new Error(`Invalid ScriptDoc: ${parsed.error.message}`);
    }

    return `Title: ${parsed.data.metadata.title}\nFormat: ${parsed.data.metadata.format}\nLogline: ${parsed.data.metadata.logline}\nTone: ${parsed.data.metadata.toneKeywords.join(", ")}`;
  }

  private validatePlan(plan: PlannerResponse) {
    if (!plan.beats.length) {
      throw new Error("Planner returned no beats");
    }

    const ids = new Set<string>();
    for (const beat of plan.beats) {
      if (ids.has(beat.id)) {
        throw new Error(`Duplicate beat id detected: ${beat.id}`);
      }
      ids.add(beat.id);
    }
  }

  private buildContextPayload(scriptContext: RetrievalMatch[], referenceContext: ReferenceAssetMatch[]) {
    return {
      scriptDoc: scriptContext.map((match) => ({
        source: match.source,
        content: match.content,
        chunkIndex: match.chunkIndex,
        similarity: match.similarity,
      })),
      referenceAssets: referenceContext.map((match) => ({
        assetId: match.assetId,
        content: match.content,
        similarity: match.similarity,
      })),
    } satisfies ScriptDocUpdatePayload["context"];
  }

  async orchestrate(input: OrchestrationInput): Promise<ScriptDocUpdatePayload> {
    const contextBlock = buildContextBlock(input.scriptContext, input.referenceContext);

    const plannerPrompt = `Use the ScriptDoc brief to produce an act-level plan.\n\nBrief:\n${this.buildProjectBrief(input.doc)}\n\nContext:\n${contextBlock}\n\nUser goal:\n${input.prompt}`;

    const plan = await this.callStructuredStep<PlannerResponse>({
      schema: plannerResponseSchema,
      schemaName: "ScriptDocPlannerResponse",
      systemPrompt:
        "You are a development editor creating production-ready ScriptDoc beat plans. Respond with strict JSON matching the provided schema.",
      userPrompt: plannerPrompt,
      temperature: 0.35,
    });

    this.validatePlan(plan);

    const beats: ScriptDocUpdatePayload["beats"] = [];
    const scenes: ScriptDocUpdatePayload["scenes"] = [];
    let sceneOrder = input.doc.scenes.length ? input.doc.scenes.length + 1 : 1;

    for (const [index, beatPlan] of plan.beats.entries()) {
      const beat = await this.callStructuredStep({
        schema: beatResponseSchema,
        schemaName: "ScriptDocBeat",
        systemPrompt:
          "You convert outline plans into ScriptDoc beats. Maintain canonical field names and respond with valid JSON only.",
        userPrompt: `Beat number ${index + 1} with ID ${beatPlan.id}. Focus: ${beatPlan.focus}. Promise: ${beatPlan.promise}. Existing brief: ${this.buildProjectBrief(input.doc)}. Context:\n${contextBlock}`,
        temperature: 0.4,
      });

      const beatScenes = await this.callStructuredStep({
        schema: sceneBatchSchema,
        schemaName: "ScriptDocSceneBatch",
        systemPrompt:
          "You expand ScriptDoc beats into fully structured scenes using the ScriptDoc scene schema.",
        userPrompt: `Beat ${beat.title} (${beat.id}) should be expanded into cinematic scenes. Each scene must include slugline, summary, and formatted elements. Context:\n${contextBlock}`,
        temperature: 0.5,
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

    const payload = {
      plan,
      beats,
      scenes,
      context: this.buildContextPayload(input.scriptContext, input.referenceContext),
    } satisfies ScriptDocUpdatePayload;

    const validation = scriptDocUpdateSchema.safeParse(payload);
    if (!validation.success) {
      throw new Error(`Structured orchestration failed validation: ${validation.error.message}`);
    }

    return validation.data;
  }
}
