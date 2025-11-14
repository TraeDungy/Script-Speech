import { randomUUID } from "node:crypto";

import type { ScriptDoc, ScriptDocBeat, ScriptScene } from "@/lib/scriptDoc";
import {
  type BeatAgentPrompt,
  type BeatAgentResponse,
  type BeatSceneOutline,
  type OutlineAgentPrompt,
  type OutlineAgentResponse,
  type OutlineBeatSuggestion,
  type SceneAgentPrompt,
  type SceneAgentResponse,
  AgentSchemaError,
  parseBeatAgentResponse,
  parseOutlineAgentResponse,
  parseSceneAgentResponse,
} from "./schema";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_JSON_MODEL ?? "gpt-4.1-mini";

type FetchImplementation = typeof fetch;

export interface GenerationWorkflowInput {
  projectId: string;
  doc: ScriptDoc;
  instructions?: string;
  maxBeats?: number;
}

export interface ScriptGenerationResult {
  beats: ScriptDocBeat[];
  scenes: ScriptScene[];
  rationale?: string;
  patch: Pick<ScriptDoc, "beats" | "scenes">;
}

interface AgentInvocation<TPrompt, TResponse> {
  agentName: "outline" | "beat" | "scene";
  prompt: TPrompt;
  systemPrompt: string;
  validator: (payload: unknown) => TResponse;
  fallback: () => TResponse;
}

export class ScriptGenerationOrchestrator {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = DEFAULT_MODEL;
  private readonly fetchImpl: FetchImplementation;

  constructor(options?: { fetchImpl?: FetchImplementation }) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  async generate(input: GenerationWorkflowInput): Promise<ScriptGenerationResult> {
    const outline = await this.generateOutline({
      doc: input.doc,
      instructions: input.instructions,
      maxBeats: input.maxBeats,
    });

    const beats = outline.beats.map((beat, index) => this.normalizeBeat(beat, index));
    const scenes: ScriptScene[] = [];

    for (const beat of beats) {
      const beatPlan = await this.generateBeatPlan({ doc: input.doc, beat });
      for (const sceneOutline of beatPlan.scenes) {
        const scene = await this.generateScene({ doc: input.doc, beat, scene: sceneOutline });
        scenes.push(scene);
      }
    }

    const patch: Pick<ScriptDoc, "beats" | "scenes"> = {
      beats,
      scenes,
    };

    return { beats, scenes, rationale: outline.rationale, patch };
  }

  private normalizeBeat(beat: OutlineBeatSuggestion, index: number): ScriptDocBeat {
    return {
      ...beat,
      order: typeof beat.order === "number" ? beat.order : index + 1,
      spotlightCharacterIds: beat.spotlightCharacterIds ?? [],
      locationIds: beat.locationIds ?? [],
      referenceAssetIds: beat.referenceAssetIds ?? [],
      sceneIds: beat.sceneIds ?? [],
      durationSeconds: beat.durationSeconds,
    } satisfies ScriptDocBeat;
  }

  private async generateOutline(prompt: OutlineAgentPrompt): Promise<OutlineAgentResponse> {
    return this.invokeAgent({
      agentName: "outline",
      prompt,
      systemPrompt:
        "You are the outline agent for Script Speech. Produce JSON that matches OutlineAgentResponse with beat objects referencing ScriptDoc fields.",
      validator: parseOutlineAgentResponse,
      fallback: () => this.buildFallbackOutline(prompt.doc, prompt.maxBeats),
    });
  }

  private async generateBeatPlan(prompt: BeatAgentPrompt): Promise<BeatAgentResponse> {
    return this.invokeAgent({
      agentName: "beat",
      prompt,
      systemPrompt:
        "You expand a single beat into scene outlines. Respond with BeatAgentResponse JSON describing the ordered scenes.",
      validator: parseBeatAgentResponse,
      fallback: () => this.buildFallbackBeatPlan(prompt.doc, prompt.beat),
    });
  }

  private async generateScene(prompt: SceneAgentPrompt): Promise<ScriptScene> {
    const response = await this.invokeAgent({
      agentName: "scene",
      prompt,
      systemPrompt:
        "You author fully realized screenplay scenes. Respond with SceneAgentResponse JSON referencing ScriptDoc scene types.",
      validator: parseSceneAgentResponse,
      fallback: () => this.buildFallbackScene(prompt.scene),
    });
    return response.scene;
  }

  private async invokeAgent<TPrompt, TResponse>({
    agentName,
    prompt,
    systemPrompt,
    validator,
    fallback,
  }: AgentInvocation<TPrompt, TResponse>): Promise<TResponse> {
    if (!this.apiKey) {
      return fallback();
    }

    try {
      const response = await this.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                "Return valid JSON only. Payload schema: ",
                JSON.stringify(prompt, null, 2),
              ].join("\n"),
            },
          ],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = payload?.error?.message ?? `${agentName} agent failed`;
        throw new Error(message);
      }

      const rawContent = payload?.choices?.[0]?.message?.content;
      const jsonText = typeof rawContent === "string" ? rawContent : rawContent?.[0]?.text;
      const data = jsonText ? JSON.parse(jsonText) : {};
      return validator(data);
    } catch (error) {
      if (error instanceof AgentSchemaError) {
        console.warn(`${agentName} agent validation failed`, error);
      } else {
        console.warn(`${agentName} agent invocation failed`, error);
      }
      return fallback();
    }
  }

  private buildFallbackOutline(doc: ScriptDoc, maxBeats?: number): OutlineAgentResponse {
    const beats = (doc.beats.length ? doc.beats : this.deriveBeatsFromScenes(doc.scenes)).slice(
      0,
      maxBeats ?? Infinity,
    );
    return {
      rationale: "Using existing ScriptDoc beats as outline fallback.",
      beats: beats.map((beat) => ({
        ...beat,
        spotlightCharacterIds: beat.spotlightCharacterIds ?? [],
        locationIds: beat.locationIds ?? [],
        referenceAssetIds: beat.referenceAssetIds ?? [],
        sceneIds: beat.sceneIds ?? [],
      })),
    };
  }

  private deriveBeatsFromScenes(scenes: ScriptScene[]): ScriptDocBeat[] {
    if (!scenes.length) {
      const id = randomUUID();
      return [
        {
          id,
          order: 1,
          title: "Opening",
          summary: "Automatically generated placeholder beat.",
          intent: undefined,
          spotlightCharacterIds: [],
          locationIds: [],
          referenceAssetIds: [],
          durationSeconds: undefined,
          sceneIds: [],
        },
      ];
    }

    return scenes.map((scene, index) => ({
      id: scene.beatId ?? randomUUID(),
      order: index + 1,
      title: scene.title,
      summary: scene.summary,
      intent: undefined,
      spotlightCharacterIds: scene.characterIds,
      locationIds: scene.locationIds,
      referenceAssetIds: scene.referenceAssetIds,
      durationSeconds: undefined,
      sceneIds: [scene.id],
    }));
  }

  private buildFallbackBeatPlan(doc: ScriptDoc, beat: OutlineBeatSuggestion): BeatAgentResponse {
    const scenes = doc.scenes.filter((scene) => scene.beatId === beat.id);
    if (scenes.length) {
      return {
        beatId: beat.id,
        scenes: scenes.map((scene) => ({
          id: scene.id,
          beatId: beat.id,
          order: scene.order,
          title: scene.title,
          summary: scene.summary,
          slugline: scene.slugline,
          focusCharacterIds: scene.characterIds,
        })),
      };
    }

    const slugline = {
      setting: "INT" as const,
      location: beat.title,
      timeOfDay: "UNKNOWN",
    };

    return {
      beatId: beat.id,
      scenes: [
        {
          id: randomUUID(),
          beatId: beat.id,
          order: 1,
          title: `${beat.title} Scene`,
          summary: beat.summary,
          slugline,
          focusCharacterIds: beat.spotlightCharacterIds,
        },
      ],
    };
  }

  private buildFallbackScene(scene: BeatSceneOutline): ScriptScene {
    return {
      id: scene.id ?? randomUUID(),
      beatId: scene.beatId,
      order: scene.order,
      title: scene.title,
      summary: scene.summary,
      slugline: scene.slugline,
      referenceAssetIds: [],
      locationIds: [],
      characterIds: scene.focusCharacterIds ?? [],
      elements: [
        {
          id: randomUUID(),
          type: "action",
          text: scene.summary,
        },
      ],
    };
  }
}
