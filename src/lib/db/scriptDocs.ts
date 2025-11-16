import type { ScriptDoc } from "@/lib/scriptDoc";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { getMockScriptDocRow } from "./mocks";
import type { BeatRow, SceneRow, ScriptDocRow } from "./schema";

export type ScriptDocRecordType = ScriptDocRow["record_type"];

export interface ScriptDocRecord {
  id: string;
  projectId: string;
  doc: ScriptDoc;
  revisionId: string | null;
  recordType: ScriptDocRecordType;
  versionNumber: number | null;
  sourceVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const localAutosaves = new Map<string, ScriptDocRecord>();
const localVersions = new Map<string, ScriptDocRecord[]>();

const cloneDoc = (doc: ScriptDoc): ScriptDoc =>
  typeof structuredClone === "function"
    ? structuredClone(doc)
    : (JSON.parse(JSON.stringify(doc)) as ScriptDoc);

function mapScriptDocRow(row: ScriptDocRow): ScriptDocRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    doc: row.doc,
    revisionId: row.revision_id,
    recordType: row.record_type,
    versionNumber: row.version_number,
    sourceVersionId: row.source_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function seedLocalVersion(projectId: string): ScriptDocRecord {
  const base = mapScriptDocRow(getMockScriptDocRow());
  const now = new Date().toISOString();
  const docClone = cloneDoc(base.doc);
  docClone.metadata = {
    ...docClone.metadata,
    projectId,
  };

  const record: ScriptDocRecord = {
    ...base,
    id: `${base.id}-${projectId}`,
    projectId,
    doc: docClone,
    createdAt: now,
    updatedAt: now,
  };
  localVersions.set(projectId, [record]);
  return record;
}

function ensureLocalVersion(projectId: string): ScriptDocRecord {
  const versions = localVersions.get(projectId);
  if (versions && versions.length > 0) {
    return versions[versions.length - 1]!;
  }
  return seedLocalVersion(projectId);
}

async function syncBeatsForDoc(
  projectId: string,
  scriptDocId: string,
  doc: ScriptDoc,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!doc.beats?.length) {
    return;
  }

  const beatPayloads = doc.beats.map((beat) => ({
    project_id: projectId,
    script_doc_id: scriptDocId,
    beat_id: beat.id,
    title: beat.title,
    summary: beat.summary ?? null,
    intent: beat.intent ?? null,
    order_index: beat.order,
    duration_seconds: beat.durationSeconds ?? null,
    spotlight_character_ids: beat.spotlightCharacterIds ?? null,
    location_ids: beat.locationIds ?? null,
    reference_asset_ids: beat.referenceAssetIds ?? null,
    payload: beat,
  } satisfies Partial<BeatRow> & {
    project_id: string;
    script_doc_id: string;
    beat_id: string;
    title: string;
    order_index: number;
  }));

  const { error } = await supabase.from<BeatRow>("beats").insert(beatPayloads);
  if (error) {
    console.error("Failed to sync beats for script doc", error);
    throw error;
  }
}

async function syncScenesForDoc(
  projectId: string,
  scriptDocId: string,
  doc: ScriptDoc,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!doc.scenes?.length) {
    return;
  }

  const scenePayloads = doc.scenes.map((scene) => ({
    project_id: projectId,
    script_doc_id: scriptDocId,
    scene_id: scene.id,
    beat_id: scene.beatId ?? null,
    title: scene.title ?? null,
    summary: scene.summary ?? null,
    slugline: scene.slugline ?? null,
    order_index: scene.order,
    payload: scene,
  } satisfies Partial<SceneRow> & {
    project_id: string;
    script_doc_id: string;
    scene_id: string;
    order_index: number;
  }));

  const { error } = await supabase.from<SceneRow>("scenes").insert(scenePayloads);
  if (error) {
    console.error("Failed to sync scenes for script doc", error);
    throw error;
  }
}

export interface FetchScriptDocOptions {
  preferAutosave?: boolean;
}

export async function fetchLatestScriptDoc(
  projectId: string,
  options: FetchScriptDocOptions = {},
): Promise<ScriptDocRecord | null> {
  if (!isSupabaseConfigured()) {
    const autosave = localAutosaves.get(projectId);
    const latestVersion = ensureLocalVersion(projectId);
    if (options.preferAutosave && autosave) {
      return autosave;
    }
    return latestVersion;
  }

  const supabase = getSupabaseClient();

  const [{ data: autosaveRow, error: autosaveError }, { data: versionRow, error: versionError }]
    = await Promise.all([
      supabase
        .from<ScriptDocRow>("script_docs")
        .select("*")
        .eq("project_id", projectId)
        .eq("record_type", "autosave")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from<ScriptDocRow>("script_docs")
        .select("*")
        .eq("project_id", projectId)
        .eq("record_type", "version")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (autosaveError && autosaveError.code !== "PGRST116") {
    console.error("Failed to fetch script doc autosave", autosaveError);
    throw autosaveError;
  }

  if (versionError && versionError.code !== "PGRST116") {
    console.error("Failed to fetch script doc version", versionError);
    throw versionError;
  }

  if (options.preferAutosave && autosaveRow) {
    return mapScriptDocRow(autosaveRow);
  }

  if (versionRow) {
    return mapScriptDocRow(versionRow);
  }

  if (autosaveRow) {
    return mapScriptDocRow(autosaveRow);
  }

  return null;
}

export async function listScriptDocVersions(
  projectId: string,
  limit = 10,
): Promise<ScriptDocRecord[]> {
  if (!isSupabaseConfigured()) {
    const versions = localVersions.get(projectId) ?? [ensureLocalVersion(projectId)];
    return versions.slice(-limit);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ScriptDocRow>("script_docs")
    .select("*")
    .eq("project_id", projectId)
    .eq("record_type", "version")
    .order("version_number", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list script doc versions", error);
    throw error;
  }

  return (data ?? []).map(mapScriptDocRow);
}

export async function createScriptDocAutosave(
  projectId: string,
  doc: ScriptDoc,
  options: { sourceVersionId?: string | null } = {},
): Promise<ScriptDocRecord> {
  if (!isSupabaseConfigured()) {
    const latest = ensureLocalVersion(projectId);
    const record: ScriptDocRecord = {
      ...latest,
      id: `autosave-${projectId}`,
      doc,
      revisionId: doc.revision?.id ?? latest.revisionId ?? null,
      recordType: "autosave",
      versionNumber: null,
      sourceVersionId: options.sourceVersionId ?? latest.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localAutosaves.set(projectId, record);
    return record;
  }

  const supabase = getSupabaseClient();
  const payload = {
    project_id: projectId,
    doc,
    revision_id: doc.revision?.id ?? null,
    record_type: "autosave" as ScriptDocRecordType,
    source_version_id: options.sourceVersionId ?? null,
  } satisfies Partial<ScriptDocRow> & {
    project_id: string;
    record_type: ScriptDocRecordType;
  };

  await supabase
    .from<ScriptDocRow>("script_docs")
    .delete()
    .eq("project_id", projectId)
    .eq("record_type", "autosave");

  const { data, error } = await supabase
    .from<ScriptDocRow>("script_docs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create script doc autosave", error);
    throw error;
  }

  return mapScriptDocRow(data);
}

export async function createScriptDocVersion(
  projectId: string,
  doc: ScriptDoc,
): Promise<ScriptDocRecord> {
  if (!isSupabaseConfigured()) {
    const latest = ensureLocalVersion(projectId);
    const nextVersionNumber = (latest.versionNumber ?? 0) + 1;
    const now = new Date().toISOString();
    const record: ScriptDocRecord = {
      id: `version-${projectId}-${nextVersionNumber}`,
      projectId,
      doc,
      revisionId: doc.revision?.id ?? null,
      recordType: "version",
      versionNumber: nextVersionNumber,
      sourceVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const versions = localVersions.get(projectId) ?? [];
    versions.push(record);
    localVersions.set(projectId, versions);
    localAutosaves.delete(projectId);
    return record;
  }

  const supabase = getSupabaseClient();
  const { data: latestVersion, error: latestError } = await supabase
    .from<ScriptDocRow>("script_docs")
    .select("version_number")
    .eq("project_id", projectId)
    .eq("record_type", "version")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError && latestError.code !== "PGRST116") {
    console.error("Failed to resolve latest script doc version", latestError);
    throw latestError;
  }

  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

  const insertPayload = {
    project_id: projectId,
    doc,
    revision_id: doc.revision?.id ?? null,
    record_type: "version" as ScriptDocRecordType,
    version_number: nextVersionNumber,
  } satisfies Partial<ScriptDocRow> & {
    project_id: string;
    record_type: ScriptDocRecordType;
    version_number: number;
  };

  const { data, error } = await supabase
    .from<ScriptDocRow>("script_docs")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create script doc version", error);
    throw error;
  }

  await Promise.all([
    syncBeatsForDoc(projectId, data.id, doc),
    syncScenesForDoc(projectId, data.id, doc),
  ]);

  await supabase
    .from<ScriptDocRow>("script_docs")
    .delete()
    .eq("project_id", projectId)
    .eq("record_type", "autosave");

  return mapScriptDocRow(data);
}

export async function upsertScriptDoc(
  projectId: string,
  doc: ScriptDoc,
): Promise<ScriptDoc> {
  const record = await createScriptDocVersion(projectId, doc);
  return record.doc;
}
