import type { ScriptFormat } from "@/lib/scriptDoc";
import type {
  ScriptDoc,
  ScriptDocBeat,
  ScriptDocCharacter,
  ScriptDocLocation,
  ScriptDocProp,
  ScriptDocTranscriptEntry,
} from "@/lib/scriptDoc";
import type { TranscriptTurnDTO } from "@/lib/realtime/schema";

export type SlotResponseMap = {
  title: string;
  format: string;
  logline: string;
  genre: string;
  tone: string;
  lengthUnit: "pages" | "minutes" | "seconds";
  lengthValue: string;
  characters: string;
  locations: string;
  props: string;
  signatureMoment: string;
};

export interface BuildOnboardingDocInput {
  projectId: string;
  sessionId?: string;
  responses: SlotResponseMap;
  transcripts: TranscriptTurnDTO[];
}

const SUPPORTED_FORMATS: ScriptFormat[] = [
  "feature",
  "short",
  "pilot",
  "limited-series",
  "doc-feature",
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseKeywords(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function parseStructuredList(value: string, fallback: string): Array<{ name: string; detail?: string }> {
  const items = value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, detail] = entry.split(/[-–—:]/, 2).map((part) => part.trim());
      return {
        name: name || fallback,
        detail: detail || undefined,
      };
    });
  if (items.length === 0) {
    return [{ name: fallback }];
  }
  return items;
}

function resolveFormat(raw: string): ScriptFormat {
  if (SUPPORTED_FORMATS.includes(raw as ScriptFormat)) {
    return raw as ScriptFormat;
  }
  return "feature";
}

function ensureLength(responses: SlotResponseMap) {
  const unit = responses.lengthUnit ?? "pages";
  const value = Number(responses.lengthValue);
  return {
    unit,
    value: Number.isFinite(value) && value > 0 ? value : unit === "minutes" ? 90 : 100,
  } as const;
}

function mapTranscriptsToLog(transcripts: TranscriptTurnDTO[]): ScriptDocTranscriptEntry[] {
  return transcripts.map((turn) => ({
    id: turn.id,
    role: turn.role,
    text: turn.text,
    final: turn.final,
    createdAt: turn.createdAt,
  }));
}

function buildCharacters(entries: Array<{ name: string; detail?: string }>): ScriptDocCharacter[] {
  return entries.map((entry, index) => ({
    id: createId(`char-${index + 1}`),
    name: entry.name,
    description: entry.detail,
    tags: [],
    referenceAssetIds: [],
  }));
}

function buildLocations(entries: Array<{ name: string; detail?: string }>): ScriptDocLocation[] {
  return entries.map((entry, index) => ({
    id: createId(`loc-${index + 1}`),
    name: entry.name,
    description: entry.detail,
    type: "mixed",
    referenceAssetIds: [],
  }));
}

function buildProps(entries: Array<{ name: string; detail?: string }>): ScriptDocProp[] {
  return entries.map((entry, index) => ({
    id: createId(`prop-${index + 1}`),
    name: entry.name,
    description: entry.detail,
    referenceAssetIds: [],
  }));
}

function buildBeats(
  logline: string,
  characters: ScriptDocCharacter[],
  locations: ScriptDocLocation[],
  signatureMoment: string,
): ScriptDocBeat[] {
  const introSceneId = createId("scene");
  const conflictSceneId = createId("scene");
  const resolutionSceneId = createId("scene");
  return [
    {
      id: createId("beat"),
      order: 0,
      title: "Orientation",
      summary: logline,
      intent: "Introduce protagonists and stakes",
      spotlightCharacterIds: characters.slice(0, 2).map((character) => character.id),
      locationIds: locations.slice(0, 1).map((location) => location.id),
      referenceAssetIds: [],
      sceneIds: [introSceneId],
    },
    {
      id: createId("beat"),
      order: 1,
      title: "Complication",
      summary: signatureMoment || "Escalate the central conflict",
      intent: "Surface the dramatic question",
      spotlightCharacterIds: characters.slice(0, 2).map((character) => character.id),
      locationIds: locations.slice(0, 2).map((location) => location.id),
      referenceAssetIds: [],
      sceneIds: [conflictSceneId],
    },
    {
      id: createId("beat"),
      order: 2,
      title: "Promise",
      summary: "Sketch the next big swing",
      intent: "Point toward payoffs",
      spotlightCharacterIds: characters.slice(0, 2).map((character) => character.id),
      locationIds: locations.slice(0, 1).map((location) => location.id),
      referenceAssetIds: [],
      sceneIds: [resolutionSceneId],
    },
  ];
}

function buildScenes(
  beats: ScriptDocBeat[],
  characters: ScriptDocCharacter[],
  locations: ScriptDocLocation[],
  logline: string,
  signatureMoment: string,
) {
  return beats.map((beat, index) => {
    const location = locations[index % locations.length] ?? locations[0];
    const characterIds = characters.slice(0, 2).map((character) => character.id);
    return {
      id: beat.sceneIds[0],
      order: index,
      beatId: beat.id,
      title: beat.title,
      summary: index === 1 && signatureMoment ? signatureMoment : beat.summary,
      slugline: {
        setting: "INT/EXT",
        location: location?.name ?? "Primary Location",
        timeOfDay: index === 0 ? "DAY" : index === 1 ? "DUSK" : "NIGHT",
      },
      elements: [
        {
          id: createId("element"),
          type: "action",
          text: beat.summary,
        },
        {
          id: createId("element"),
          type: "dialogue",
          speaker: characters[0]?.name ?? "Lead",
          text: index === 1 && signatureMoment ? signatureMoment : logline,
        },
      ],
      referenceAssetIds: [],
      locationIds: location ? [location.id] : [],
      characterIds,
    };
  });
}

export function buildOnboardingScriptDoc({
  projectId,
  sessionId,
  responses,
  transcripts,
}: BuildOnboardingDocInput): ScriptDoc {
  const format = resolveFormat(responses.format);
  const logline = responses.logline.trim() || "New voice-seeded concept";
  const genre = responses.genre.trim() || "Drama";
  const toneKeywords = parseKeywords(responses.tone);
  const targetLength = ensureLength(responses);
  const characterEntries = buildCharacters(parseStructuredList(responses.characters, "Protagonist"));
  const locationEntries = buildLocations(parseStructuredList(responses.locations, "Signature Location"));
  const propEntries = buildProps(parseStructuredList(responses.props, "Key Prop"));
  const beats = buildBeats(logline, characterEntries, locationEntries, responses.signatureMoment.trim());
  const scenes = buildScenes(beats, characterEntries, locationEntries, logline, responses.signatureMoment.trim());
  const now = new Date().toISOString();
  const transcriptLog = mapTranscriptsToLog(transcripts);

  return {
    metadata: {
      projectId,
      title: responses.title.trim() || "Untitled Voice Project",
      format,
      genre,
      subgenres: [],
      logline,
      rating: "PG-13",
      toneKeywords: toneKeywords.length ? toneKeywords : [genre],
      targetLength,
      status: "outline",
      createdAt: now,
      updatedAt: now,
    },
    revision: {
      id: createId("rev"),
      version: "0.1.0",
      label: "Voice onboarding seed",
      createdAt: now,
      createdBy: "Voice Onboarding",
      notes: sessionId ? `Session ${sessionId}` : undefined,
    },
    referenceAssets: [],
    characters: characterEntries,
    locations: locationEntries,
    props: propEntries,
    beats,
    scenes,
    conceptAnalysis: {
      conceptSummary: logline,
      keywords: Array.from(
        new Set([
          genre,
          ...toneKeywords,
          ...locationEntries.map((location) => location.name),
          ...propEntries.map((prop) => prop.name),
        ]),
      ),
      genreConfidence: [
        { genre, confidence: 0.85 },
      ],
      toneConfidence: toneKeywords.map((keyword) => ({ tone: keyword, confidence: 0.7 })),
      lengthRecommendation: {
        unit: targetLength.unit,
        typical: targetLength.value,
        confidence: 0.8,
        rationale: "Seeded from onboarding responses.",
      },
      recommendedFormats: [
        {
          formatId: format,
          confidence: 0.78,
          rationale: "Matched to your selected format and length goals.",
          suggestedLength: {
            unit: targetLength.unit,
            typical: targetLength.value,
          },
        },
      ],
      relatedProjects: [],
      isFranchiseExtension: false,
      extensionNotes: undefined,
      conversationLog: transcriptLog,
    },
  } satisfies ScriptDoc;
}
