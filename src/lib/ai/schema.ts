import type {
  ScriptDoc,
  ScriptDocBeat,
  ScriptScene,
  ScriptSceneElement,
  ScriptSceneSlugline,
} from "@/lib/scriptDoc";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AgentSchemaError(`Expected ${field} to be a non-empty string`);
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AgentSchemaError(`Expected ${field} to be a number`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AgentSchemaError(`Expected ${field} to be an array of strings`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new AgentSchemaError(`Expected ${field}[${index}] to be a string`);
    }
    return item;
  });
}

function parseSlugline(value: unknown): ScriptSceneSlugline {
  if (!isPlainObject(value)) {
    throw new AgentSchemaError("Scene slugline must be an object");
  }

  const setting = value.setting;
  if (setting !== "INT" && setting !== "EXT" && setting !== "INT/EXT") {
    throw new AgentSchemaError("Scene slugline setting must be INT, EXT, or INT/EXT");
  }

  return {
    setting,
    location: asString(value.location, "scene.slugline.location"),
    timeOfDay: asString(value.timeOfDay, "scene.slugline.timeOfDay"),
  } satisfies ScriptSceneSlugline;
}

function parseSceneElement(value: unknown): ScriptSceneElement {
  if (!isPlainObject(value)) {
    throw new AgentSchemaError("Scene element must be an object");
  }

  const id = asString(value.id, "sceneElement.id");
  const text = asString(value.text, "sceneElement.text");
  const referenceAssetIds = value.referenceAssetIds
    ? asStringArray(value.referenceAssetIds, "sceneElement.referenceAssetIds")
    : undefined;

  switch (value.type) {
    case "action":
      return { id, type: "action", text, referenceAssetIds };
    case "dialogue":
      return {
        id,
        type: "dialogue",
        text,
        referenceAssetIds,
        speaker: asString(value.speaker, "sceneElement.speaker"),
        parenthetical: asOptionalString(value.parenthetical),
      };
    case "parenthetical":
      return {
        id,
        type: "parenthetical",
        text,
        referenceAssetIds,
        speaker: asOptionalString(value.speaker),
      };
    case "transition":
      return { id, type: "transition", text, referenceAssetIds };
    case "note":
      return {
        id,
        type: "note",
        text,
        referenceAssetIds,
        tone:
          value.tone === "info" || value.tone === "warning" || value.tone === "success"
            ? value.tone
            : undefined,
      };
    default:
      throw new AgentSchemaError(`Unsupported scene element type: ${String(value.type)}`);
  }
}

export class AgentSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSchemaError";
  }
}

export type OutlineBeatSuggestion = Pick<
  ScriptDocBeat,
  | "id"
  | "order"
  | "title"
  | "summary"
  | "intent"
  | "durationSeconds"
  | "spotlightCharacterIds"
  | "locationIds"
  | "referenceAssetIds"
  | "sceneIds"
>;

export interface OutlineAgentPrompt {
  doc: ScriptDoc;
  instructions?: string;
  minBeats?: number;
  maxBeats?: number;
}

export interface OutlineAgentResponse {
  rationale?: string;
  beats: OutlineBeatSuggestion[];
}

export interface BeatAgentPrompt {
  doc: ScriptDoc;
  beat: OutlineBeatSuggestion;
  instructions?: string;
  targetSceneCount?: number;
}

export type BeatSceneOutline = Pick<
  ScriptScene,
  "id" | "beatId" | "order" | "title" | "summary" | "slugline"
> & {
  focusCharacterIds?: string[];
};

export interface BeatAgentResponse {
  beatId: string;
  scenes: BeatSceneOutline[];
}

export interface SceneAgentPrompt {
  doc: ScriptDoc;
  beat: OutlineBeatSuggestion;
  scene: BeatSceneOutline;
  instructions?: string;
}

export interface SceneAgentResponse {
  scene: ScriptScene;
}

export function parseOutlineAgentResponse(payload: unknown): OutlineAgentResponse {
  if (!isPlainObject(payload)) {
    throw new AgentSchemaError("Outline response must be an object");
  }

  const beatsPayload = payload.beats;
  if (!Array.isArray(beatsPayload)) {
    throw new AgentSchemaError("Outline response must include a beats array");
  }

  const beats = beatsPayload.map((beat, index) => parseBeatSuggestion(beat, index));
  const rationale = typeof payload.rationale === "string" ? payload.rationale : undefined;

  return { beats, rationale };
}

export function parseBeatAgentResponse(payload: unknown): BeatAgentResponse {
  if (!isPlainObject(payload)) {
    throw new AgentSchemaError("Beat response must be an object");
  }

  const beatId = asString(payload.beatId, "beatId");
  if (!Array.isArray(payload.scenes)) {
    throw new AgentSchemaError("Beat response must include a scenes array");
  }

  const scenes = payload.scenes.map((scene, index) => parseSceneOutline(scene, index, beatId));
  return { beatId, scenes };
}

export function parseSceneAgentResponse(payload: unknown): SceneAgentResponse {
  if (!isPlainObject(payload)) {
    throw new AgentSchemaError("Scene response must be an object");
  }

  return { scene: parseScene(payload.scene) };
}

function parseBeatSuggestion(value: unknown, index: number): OutlineBeatSuggestion {
  if (!isPlainObject(value)) {
    throw new AgentSchemaError(`Beat ${index} must be an object`);
  }

  return {
    id: asString(value.id, `beats[${index}].id`),
    order: asNumber(value.order ?? index + 1, `beats[${index}].order`),
    title: asString(value.title, `beats[${index}].title`),
    summary: asString(value.summary, `beats[${index}].summary`),
    intent: asOptionalString(value.intent),
    durationSeconds:
      typeof value.durationSeconds === "number" && !Number.isNaN(value.durationSeconds)
        ? value.durationSeconds
        : undefined,
    spotlightCharacterIds: asStringArray(value.spotlightCharacterIds ?? [], `beats[${index}].spotlightCharacterIds`),
    locationIds: asStringArray(value.locationIds ?? [], `beats[${index}].locationIds`),
    referenceAssetIds: asStringArray(value.referenceAssetIds ?? [], `beats[${index}].referenceAssetIds`),
    sceneIds: asStringArray(value.sceneIds ?? [], `beats[${index}].sceneIds`),
  } satisfies OutlineBeatSuggestion;
}

function parseSceneOutline(value: unknown, index: number, beatId: string): BeatSceneOutline {
  if (!isPlainObject(value)) {
    throw new AgentSchemaError(`Scene outline ${index} must be an object`);
  }

  const focusCharacterIds = value.focusCharacterIds
    ? asStringArray(value.focusCharacterIds, `scene[${index}].focusCharacterIds`)
    : undefined;

  return {
    id: asString(value.id, `scene[${index}].id`),
    beatId: asString(value.beatId ?? beatId, `scene[${index}].beatId`),
    order: asNumber(value.order ?? index + 1, `scene[${index}].order`),
    title: asString(value.title, `scene[${index}].title`),
    summary: asString(value.summary, `scene[${index}].summary`),
    slugline: parseSlugline(value.slugline),
    focusCharacterIds,
  } satisfies BeatSceneOutline;
}

function parseScene(value: unknown): ScriptScene {
  if (!isPlainObject(value)) {
    throw new AgentSchemaError("Scene must be an object");
  }

  if (!Array.isArray(value.elements)) {
    throw new AgentSchemaError("Scene elements must be an array");
  }

  return {
    id: asString(value.id, "scene.id"),
    beatId: value.beatId ? asString(value.beatId, "scene.beatId") : undefined,
    order: asNumber(value.order, "scene.order"),
    title: asString(value.title, "scene.title"),
    summary: asString(value.summary, "scene.summary"),
    slugline: parseSlugline(value.slugline),
    elements: value.elements.map(parseSceneElement),
    referenceAssetIds: asStringArray(value.referenceAssetIds ?? [], "scene.referenceAssetIds"),
    locationIds: asStringArray(value.locationIds ?? [], "scene.locationIds"),
    characterIds: asStringArray(value.characterIds ?? [], "scene.characterIds"),
  } satisfies ScriptScene;
}
