import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import type { ScriptDoc } from "@/lib/scriptDoc";
import type {
  CreateReferenceAssetInput,
  EntityAsset,
  EntityAssetTargetType,
  ReferenceAsset,
} from "@/lib/types/assets";
import type {
  DraftVersionRow,
  ExportDownloadTokenRow,
  ExportJobRow,
  ProjectRow,
  ScriptDocRow,
} from "./schema";

type MockProjectRole = "owner" | "editor" | "member" | "viewer";

const mockProjectMemberships = new Map<
  string,
  Array<{ userId: string; role: MockProjectRole }>
>();

mockProjectMemberships.set("demo-project", [
  { userId: "demo-user", role: "owner" },
]);

export function upsertMockProjectMembership(
  projectId: string,
  userId: string,
  role: MockProjectRole,
): void {
  const entries = mockProjectMemberships.get(projectId) ?? [];
  const existingIndex = entries.findIndex((entry) => entry.userId === userId);
  if (existingIndex >= 0) {
    entries[existingIndex] = { userId, role };
  } else {
    entries.push({ userId, role });
  }
  mockProjectMemberships.set(projectId, entries);
}

export function getMockProjectMembership(
  projectId: string,
  userId: string,
): { projectId: string; userId: string; role: MockProjectRole } | null {
  const entries = mockProjectMemberships.get(projectId);
  const record = entries?.find((entry) => entry.userId === userId);
  if (!record) {
    return null;
  }
  return { projectId, userId, role: record.role };
}

const MOCK_PROJECT_ID = "demo-project";

const baseScriptDoc: ScriptDoc = {
  metadata: {
    projectId: MOCK_PROJECT_ID,
    title: "Echoes on the Pier",
    format: "feature",
    genre: "Sci-Fi Drama",
    subgenres: ["Family", "Mystery"],
    logline:
      "An estranged sound designer returns home to capture the mysterious signal haunting her family's pier.",
    rating: "PG-13",
    toneKeywords: ["atmospheric", "intimate", "mysterious"],
    targetLength: {
      unit: "pages",
      value: 105,
    },
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    relatedProjects: [
      {
        projectId: "doc-signal-archive",
        relationship: "inspired-by",
        title: "Signal Archive",
        notes: "Short doc exploring the original anomaly recordings.",
      },
    ],
    franchiseOriginId: "universe-reyes",
    isExtension: true,
  },
  revision: {
    id: "rev-1",
    version: "0.3.0",
    label: "Initial studio exploration",
    createdAt: new Date().toISOString(),
    createdBy: "Script Speech",
    notes: "Seeded from blueprint outline for UI exploration.",
  },
  referenceAssets: [
    {
      id: "asset-moonlight",
      title: "Moonlit tide study",
      description: "Long exposure photo of the pier with bioluminescent tide.",
      url: "https://example.com/assets/moonlight.jpg",
      thumbnailUrl: "https://example.com/assets/moonlight-thumb.jpg",
      sourceType: "link",
      tags: ["lighting", "location"],
      attribution: "J. Alvarez",
    },
    {
      id: "asset-console",
      title: "Analog mixing console",
      description: "Reference board for the studio flashback.",
      url: "https://example.com/assets/console.png",
      thumbnailUrl: "https://example.com/assets/console-thumb.png",
      sourceType: "upload",
      tags: ["prop"],
      attribution: "Set design team",
    },
  ],
  characters: [
    {
      id: "char-mara",
      name: "Mara Reyes",
      description: "Gifted sound designer navigating grief and rediscovery.",
      pronouns: "she/her",
      archetype: "Reluctant prodigy",
      goal: "Decode the signal and reconcile with her brother.",
      arc: "From avoidance to embrace of her family's legacy.",
      voiceNotes: "Measured, observant, occasionally wry.",
      referenceAssetIds: ["asset-console"],
    },
    {
      id: "char-luis",
      name: "Luis Reyes",
      description: "Brother safeguarding the pier and its secrets.",
      pronouns: "he/him",
      archetype: "Guardian",
      goal: "Protect the pier from corporate buyout.",
      arc: "Learns to trust Mara's instincts again.",
      referenceAssetIds: ["asset-moonlight"],
    },
  ],
  locations: [
    {
      id: "loc-pier",
      name: "Reyes Family Pier",
      description: "Weathered pier with experimental hydrophones installed.",
      type: "mixed",
      sensoryNotes: "Salt, creaking wood, distant foghorns.",
      referenceAssetIds: ["asset-moonlight"],
    },
    {
      id: "loc-studio",
      name: "Abandoned Mix Studio",
      description: "Dusty analog setup with walls of cassette archives.",
      type: "interior",
      referenceAssetIds: ["asset-console"],
    },
  ],
  props: [
    {
      id: "prop-recorder",
      name: "Custom field recorder",
      description: "Mara's modded recorder capable of capturing subsonic layers.",
      purpose: "Records the anomaly",
      isCritical: true,
      referenceAssetIds: ["asset-console"],
    },
  ],
  beats: [
    {
      id: "beat-setup",
      order: 0,
      title: "Return to the pier",
      summary:
        "Mara arrives and senses something off as hydrophones hum with residual signal.",
      intent: "Reunite siblings and establish the anomaly.",
      spotlightCharacterIds: ["char-mara", "char-luis"],
      locationIds: ["loc-pier"],
      propIds: ["prop-recorder"],
      referenceAssetIds: ["asset-moonlight"],
      durationSeconds: 180,
      sceneIds: ["scene-arrival"],
    },
    {
      id: "beat-investigation",
      order: 1,
      title: "Signal patterns emerge",
      summary:
        "Late-night recording session reveals rhythmic signal echoing Mara's childhood lullaby.",
      intent: "Deepen mystery and show Mara's obsession.",
      spotlightCharacterIds: ["char-mara"],
      locationIds: ["loc-studio"],
      propIds: ["prop-recorder"],
      referenceAssetIds: ["asset-console"],
      durationSeconds: 240,
      sceneIds: ["scene-recording"],
    },
    {
      id: "beat-revelation",
      order: 2,
      title: "Pier awakens",
      summary:
        "Signal triggers light swell across the water revealing submerged array Mara never knew existed.",
      intent: "Promise of deeper family secret.",
      spotlightCharacterIds: ["char-mara", "char-luis"],
      locationIds: ["loc-pier"],
      propIds: ["prop-recorder"],
      referenceAssetIds: ["asset-moonlight"],
      durationSeconds: 210,
      sceneIds: ["scene-swell"],
    },
  ],
  scenes: [
    {
      id: "scene-arrival",
      order: 0,
      beatId: "beat-setup",
      title: "Mara steps onto the pier",
      summary:
        "She tests hydrophones while Luis watches from the shack, tension thick between them.",
      slugline: {
        setting: "EXT",
        location: "REYES FAMILY PIER",
        timeOfDay: "DUSK",
      },
      elements: [
        {
          id: "scene-arrival-action-1",
          type: "action",
          text: "Waves lap softly as Mara kneels to adjust the hydrophone cables.",
          locationIds: ["loc-pier"],
          propIds: ["prop-recorder"],
        },
        {
          id: "scene-arrival-dialogue-1",
          type: "dialogue",
          speaker: "MARA",
          text: "You ever fix that grounding issue?",
          locationIds: ["loc-pier"],
          propIds: ["prop-recorder"],
        },
        {
          id: "scene-arrival-dialogue-2",
          type: "dialogue",
          speaker: "LUIS",
          text: "Been waiting on the expert.",
          locationIds: ["loc-pier"],
        },
        {
          id: "scene-arrival-action-2",
          type: "action",
          text: "The recorder peaks for a beat, the anomaly whispering beneath the breeze.",
          locationIds: ["loc-pier"],
          propIds: ["prop-recorder"],
        },
      ],
      referenceAssetIds: ["asset-moonlight"],
      locationIds: ["loc-pier"],
      characterIds: ["char-mara", "char-luis"],
      propIds: ["prop-recorder"],
    },
    {
      id: "scene-recording",
      order: 1,
      beatId: "beat-investigation",
      title: "Decoding the signal",
      summary:
        "Mara isolates frequencies and hums along, discovering the lullaby's cadence in the noise.",
      slugline: {
        setting: "INT",
        location: "ABANDONED MIX STUDIO",
        timeOfDay: "NIGHT",
      },
      elements: [
        {
          id: "scene-recording-action-1",
          type: "action",
          text: "LEDs pulse erratically as Mara rides the console faders.",
          locationIds: ["loc-studio"],
          propIds: ["prop-recorder"],
        },
        {
          id: "scene-recording-dialogue-1",
          type: "dialogue",
          speaker: "MARA",
          text: "It's mapping to something familiar...",
          locationIds: ["loc-studio"],
          propIds: ["prop-recorder"],
        },
        {
          id: "scene-recording-note-1",
          type: "note",
          tone: "info",
          text: "Overlay archived family lullaby in sound design pass.",
          locationIds: ["loc-studio"],
        },
      ],
      referenceAssetIds: ["asset-console"],
      locationIds: ["loc-studio"],
      characterIds: ["char-mara"],
      propIds: ["prop-recorder"],
    },
    {
      id: "scene-swell",
      order: 2,
      beatId: "beat-revelation",
      title: "The swell of light",
      summary:
        "Signal crescendos, water glows, and Luis confesses the array was their mother's unfinished project.",
      slugline: {
        setting: "EXT",
        location: "REYES FAMILY PIER",
        timeOfDay: "NIGHT",
      },
      elements: [
        {
          id: "scene-swell-action-1",
          type: "action",
          text: "Bioluminescence blooms beneath the planks, outlining a hidden grid of devices.",
          locationIds: ["loc-pier"],
        },
        {
          id: "scene-swell-dialogue-1",
          type: "dialogue",
          speaker: "LUIS",
          text: "She built it for you to finish.",
          locationIds: ["loc-pier"],
        },
        {
          id: "scene-swell-transition-1",
          type: "transition",
          text: "CUT TO BLACK.",
          locationIds: ["loc-pier"],
        },
      ],
      referenceAssetIds: ["asset-moonlight"],
      locationIds: ["loc-pier"],
      characterIds: ["char-mara", "char-luis"],
      propIds: ["prop-recorder"],
    },
  ],
  exportSnapshots: [
    {
      id: "snapshot-fountain-latest",
      format: "fountain",
      status: "completed",
      capturedAt: new Date().toISOString(),
      jobId: "job-fountain-123",
      draftVersionId: "draft-version-1",
      fileName: "echoes-pilot.fountain",
      downloadUrl: "https://example.com/exports/echoes-pilot.fountain",
      notes: "Autosaved from studio workspace",
      storageDriver: "supabase",
      storageBucket: "exports",
      storagePath: "projects/mock/echoes-pilot.fountain",
      contentType: "text/plain",
      size: 10240,
    },
  ],
  conceptAnalysis: {
    conceptSummary:
      "Grounded sci-fi mystery about family legacy and sound revealing hidden ecosystems.",
    keywords: [
      "sound design",
      "family mystery",
      "bioluminescence",
      "returning home",
    ],
    audiencePromise: "An intimate, sensory thriller blending emotion with science intrigue.",
    genreConfidence: [
      { genre: "Sci-Fi", confidence: 0.85 },
      { genre: "Drama", confidence: 0.9 },
      { genre: "Mystery", confidence: 0.75 },
    ],
    toneConfidence: [
      { tone: "Atmospheric", confidence: 0.9 },
      { tone: "Hopeful", confidence: 0.6 },
    ],
    lengthRecommendation: {
      unit: "minutes",
      min: 95,
      max: 115,
      typical: 105,
      confidence: 0.8,
      rationale:
        "Feature-length allows the mystery to unfold while preserving intimate character work.",
    },
    recommendedFormats: [
      {
        formatId: "feature",
        confidence: 0.88,
        rationale: "Character-driven cinematic arcs with premium production design.",
        suggestedLength: { unit: "pages", typical: 110, min: 100, max: 115 },
        suggestedGenres: ["Sci-Fi", "Drama"],
      },
      {
        formatId: "limited-series",
        confidence: 0.55,
        rationale: "Could expand into multi-episode exploration of the anomaly and town history.",
        suggestedLength: {
          unit: "minutes",
          typical: 300,
          notes: "5 x 60 minute episodes",
        },
        suggestedGenres: ["Sci-Fi", "Mystery", "Drama"],
      },
    ],
    relatedProjects: [
      {
        projectId: "short-echoes",
        relationship: "spinoff",
        title: "Echoes: The Signal Hunters",
        notes: "Proposed social-first extension featuring user-submitted recordings.",
      },
    ],
    isFranchiseExtension: true,
    extensionNotes:
      "Expands the Reyes family universe established in the short doc, bridging into feature territory.",
  },
};

const fallbackThumbnails = [
  "linear-gradient(135deg, rgba(15,15,18,0.92), rgba(39,39,42,0.88))",
  "linear-gradient(135deg, rgba(24,24,27,0.9), rgba(63,63,70,0.82))",
  "linear-gradient(135deg, rgba(9,9,11,0.95), rgba(36,36,40,0.85))",
];

function computePreviewColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackThumbnails[hash % fallbackThumbnails.length];
}

const mockReferenceAssets: ReferenceAsset[] = [
  {
    id: "asset-moonlight",
    projectId: MOCK_PROJECT_ID,
    name: "Moonlit tide study",
    description: "Long exposure photo of the pier with bioluminescent tide.",
    sourceType: "external",
    url: "https://example.com/assets/moonlight.jpg",
    thumbnailUrl: "https://example.com/assets/moonlight-thumb.jpg",
    previewColor: "linear-gradient(135deg, rgba(15,15,18,0.92), rgba(39,39,42,0.88))",
    contentType: "image/jpeg",
    size: 102400,
    tags: ["lighting", "location"],
    status: "ready",
    scanStatus: "clean",
    transcodeStatus: "ready",
    processingProgress: 100,
    failureCode: null,
    failureMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attribution: "J. Alvarez",
  },
  {
    id: "asset-console",
    projectId: MOCK_PROJECT_ID,
    name: "Analog mixing console",
    description: "Reference board for the studio flashback.",
    sourceType: "upload",
    url: "https://example.com/assets/console.png",
    thumbnailUrl: "https://example.com/assets/console-thumb.png",
    previewColor: "linear-gradient(135deg, rgba(24,24,27,0.9), rgba(63,63,70,0.82))",
    contentType: "image/png",
    size: 204800,
    tags: ["prop"],
    status: "ready",
    scanStatus: "clean",
    transcodeStatus: "ready",
    processingProgress: 100,
    failureCode: null,
    failureMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attribution: "Set design team",
  },
];

const mockEntityAssets: EntityAsset[] = [
  {
    id: "entity-asset-1",
    projectId: MOCK_PROJECT_ID,
    assetId: "asset-moonlight",
    entityId: "scene-arrival",
    entityType: "scene",
    caption: "Bioluminescent tides cue the anomaly reveal.",
    order: 0,
    isPrivate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const draftVersions = new Map<string, DraftVersionRow>();
const exportJobs = new Map<string, ExportJobRow>();
const exportDownloadTokens: ExportDownloadTokenRow[] = [];

function cloneScriptDoc(): ScriptDoc {
  return typeof structuredClone === "function"
    ? structuredClone(baseScriptDoc)
    : JSON.parse(JSON.stringify(baseScriptDoc));
}

function cloneReferenceAssets(): ReferenceAsset[] {
  return mockReferenceAssets.map((asset) => ({ ...asset }));
}

function cloneEntityAssets(): EntityAsset[] {
  return mockEntityAssets.map((asset) => ({ ...asset }));
}

export function getMockProjectRow(): ProjectRow {
  const metadata = baseScriptDoc.metadata;
  return {
    id: metadata.projectId,
    title: metadata.title,
    script_type: metadata.format,
    genre: metadata.genre,
    logline: metadata.logline,
    status: metadata.status,
    created_at: metadata.createdAt,
    updated_at: metadata.updatedAt,
    owner_id: null,
    tags: metadata.toneKeywords,
    target_length_unit: metadata.targetLength.unit,
    target_length_value: metadata.targetLength.value,
  };
}

export function getMockScriptDocRow(): ScriptDocRow {
  return {
    id: "script-doc-1",
    project_id: MOCK_PROJECT_ID,
    doc: cloneScriptDoc(),
    revision_id: baseScriptDoc.revision?.id ?? null,
    record_type: "version",
    version_number: 1,
    source_version_id: null,
    created_at: baseScriptDoc.metadata.createdAt,
    updated_at: baseScriptDoc.metadata.updatedAt,
  };
}

export function listMockProjects(): ProjectRow[] {
  return [getMockProjectRow()];
}

export function getMockScriptDoc(): ScriptDoc {
  return cloneScriptDoc();
}

export function listMockReferenceAssets(projectId?: string | null): ReferenceAsset[] {
  if (!projectId) {
    return cloneReferenceAssets();
  }
  return cloneReferenceAssets().filter(
    (asset) => asset.projectId === projectId || asset.projectId === null,
  );
}

export function listMockEntityAssets(projectId: string): EntityAsset[] {
  return cloneEntityAssets().filter((asset) => asset.projectId === projectId);
}

export function createMockReferenceAsset(
  input: CreateReferenceAssetInput,
): ReferenceAsset {
  const id = randomUUID();
  const now = new Date().toISOString();
  const asset: ReferenceAsset = {
    id,
    projectId: input.projectId ?? null,
    name: input.name,
    description: input.description ?? null,
    sourceType: input.sourceType ?? (input.url ? "external" : "upload"),
    url: input.url ?? "",
    storageKey: input.storageKey ?? null,
    thumbnailUrl: null,
    previewColor: computePreviewColor(id),
    contentType: input.contentType,
    size: input.size,
    tags: input.tags ?? [],
    beatTags: input.beatTags ?? [],
    sceneTags: input.sceneTags ?? [],
    status: "pending",
    scanStatus: "pending",
    transcodeStatus: input.sourceType === "external" ? "ready" : "pending",
    processingProgress: input.sourceType === "external" ? 100 : 0,
    failureCode: null,
    failureMessage: null,
    createdAt: now,
    updatedAt: now,
    attribution: input.attribution ?? null,
  };

  mockReferenceAssets.push(asset);
  return { ...asset };
}

export function updateMockReferenceAsset(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): ReferenceAsset | undefined {
  const index = mockReferenceAssets.findIndex((asset) => asset.id === assetId);
  if (index === -1) {
    return undefined;
  }

  const merged: ReferenceAsset = {
    ...mockReferenceAssets[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  mockReferenceAssets[index] = merged;
  return { ...merged };
}

export function recordMockAssetBinary(
  assetId: string,
  data: Buffer,
  contentType: string,
): ReferenceAsset | undefined {
  const asset = mockReferenceAssets.find((item) => item.id === assetId);
  if (!asset) {
    return undefined;
  }

  const encoded = `data:${contentType};base64,${data.toString("base64")}`;
  const updated: ReferenceAsset = {
    ...asset,
    url: encoded,
    thumbnailUrl: encoded,
    contentType,
    size: data.byteLength,
    status: "ready",
    scanStatus: "clean",
    transcodeStatus: "ready",
    processingProgress: 100,
    updatedAt: new Date().toISOString(),
  };

  const index = mockReferenceAssets.findIndex((item) => item.id === assetId);
  mockReferenceAssets[index] = updated;
  return { ...updated };
}

export function upsertMockEntityAsset(input: {
  projectId: string;
  assetId: string;
  entityId: string;
  entityType: EntityAssetTargetType;
  caption?: string | null;
  isPrivate?: boolean;
  order?: number;
}): EntityAsset {
  const existingIndex = mockEntityAssets.findIndex(
    (entity) =>
      entity.projectId === input.projectId &&
      entity.assetId === input.assetId &&
      entity.entityId === input.entityId &&
      entity.entityType === input.entityType,
  );

  if (existingIndex >= 0) {
    const updated: EntityAsset = {
      ...mockEntityAssets[existingIndex],
      caption: input.caption ?? mockEntityAssets[existingIndex].caption,
      order: input.order ?? mockEntityAssets[existingIndex].order,
      isPrivate: input.isPrivate ?? mockEntityAssets[existingIndex].isPrivate,
      updatedAt: new Date().toISOString(),
    };
    mockEntityAssets[existingIndex] = updated;
    return { ...updated };
  }

  const entity: EntityAsset = {
    id: randomUUID(),
    projectId: input.projectId,
    assetId: input.assetId,
    entityId: input.entityId,
    entityType: input.entityType,
    caption: input.caption ?? null,
    order: input.order ?? 0,
    isPrivate: input.isPrivate ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockEntityAssets.push(entity);
  return { ...entity };
}

export function findMockReferenceAsset(assetId: string): ReferenceAsset | undefined {
  const asset = mockReferenceAssets.find((item) => item.id === assetId);
  return asset ? { ...asset } : undefined;
}

export function listMockExportJobs(): ExportJobRow[] {
  return Array.from(exportJobs.values()).map((job) => ({ ...job }));
}

export function createMockDraftVersion(payload: {
  projectId: string;
  doc: ScriptDoc;
  summary?: string | null;
  createdBy?: string | null;
}): DraftVersionRow {
  const row: DraftVersionRow = {
    id: randomUUID(),
    project_id: payload.projectId,
    doc: payload.doc,
    summary: payload.summary ?? null,
    created_by: payload.createdBy ?? null,
    created_at: new Date().toISOString(),
  };
  draftVersions.set(row.id, row);
  return { ...row };
}

export function insertMockExportDownloadToken(row: ExportDownloadTokenRow): void {
  exportDownloadTokens.push({ ...row });
}

export function getMockExportJob(jobId: string): ExportJobRow | undefined {
  const job = exportJobs.get(jobId);
  return job ? { ...job } : undefined;
}

export function upsertMockExportJob(job: ExportJobRow): void {
  exportJobs.set(job.id, { ...job });
}

export function createMockExportJob(payload: {
  projectId: string;
  format: ExportJobRow["format"];
  scriptDoc: ScriptDoc;
  deliverToEmail?: string | null;
  draftVersionId?: string | null;
}): ExportJobRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job: ExportJobRow = {
    id,
    project_id: payload.projectId,
    draft_version_id: payload.draftVersionId ?? null,
    format: payload.format,
    status: "queued",
    deliver_to_email: payload.deliverToEmail ?? null,
    script_doc: payload.scriptDoc,
    result: null,
    error: null,
    storage_driver: null,
    storage_path: null,
    storage_bucket: null,
    created_at: now,
    updated_at: now,
  };
  exportJobs.set(id, job);
  return { ...job };
}
