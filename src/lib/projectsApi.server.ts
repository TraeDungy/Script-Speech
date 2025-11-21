import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase.server";
import type { Database, Tables } from "@/types/supabase";

export type ProjectMetadata = Record<string, unknown>;
export type ScriptDocPayload = {
  doc: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  transcriptRefs?: string[];
  revisionId?: string | null;
  recordType?: Tables<"script_docs">["record_type"];
};

export type ProjectSummary = {
  id: string;
  title: string;
  scriptType: string;
  metadata: ProjectMetadata;
  updatedAt: string;
};

export type ProjectWithDoc = {
  project: ProjectSummary;
  scriptDoc: Tables<"script_docs"> | null;
};

function getDbClient(): SupabaseClient<Database> {
  const client = getSupabaseServiceClient();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return client as SupabaseClient<Database>;
}

function mapProjectRow(row: Tables<"projects">): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    scriptType: row.script_type,
    metadata: (row.metadata ?? {}) as ProjectMetadata,
    updatedAt: row.updated_at,
  };
}

export async function listProjectsForUser(
  userId: string,
  options: { limit?: number } = {},
): Promise<ProjectSummary[]> {
  const supabase = getDbClient();
  const limitCandidate = options.limit;
  const limit = Math.min(
    Math.max(Number.isFinite(limitCandidate) ? (limitCandidate as number) : 25, 1),
    100,
  );
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProjectRow);
}

export async function createProjectWithDoc(
  userId: string,
  input: {
    title: string;
    scriptType?: string;
    metadata?: ProjectMetadata;
    scriptDoc?: ScriptDocPayload;
  },
): Promise<ProjectWithDoc> {
  const supabase = getDbClient();

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .insert({
      title: input.title,
      script_type: input.scriptType ?? "feature",
      user_id: userId,
      owner_id: userId,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (projectError || !projectRow) {
    throw projectError ?? new Error("Project could not be created");
  }

  let scriptDoc: Tables<"script_docs"> | null = null;

  if (input.scriptDoc) {
    const { data, error } = await supabase
      .from("script_docs")
      .insert({
        project_id: projectRow.id,
        user_id: userId,
        doc: input.scriptDoc.doc,
        metadata: input.scriptDoc.metadata ?? {},
        transcript_refs: input.scriptDoc.transcriptRefs ?? [],
        revision_id: input.scriptDoc.revisionId ?? null,
        record_type: input.scriptDoc.recordType ?? "autosave",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    scriptDoc = data;
  }

  return { project: mapProjectRow(projectRow), scriptDoc };
}

export async function fetchProjectWithDoc(
  projectId: string,
  userId: string,
): Promise<ProjectWithDoc | null> {
  const supabase = getDbClient();

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError?.code === "PGRST116") {
    return null;
  }

  if (projectError) {
    throw projectError;
  }

  if (!projectRow) {
    return null;
  }

  const { data: docRow, error: docError } = await supabase
    .from("script_docs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docError && docError.code !== "PGRST116") {
    throw docError;
  }

  return {
    project: mapProjectRow(projectRow),
    scriptDoc: docRow ?? null,
  };
}

export async function updateProjectWithDoc(
  projectId: string,
  userId: string,
  input: {
    metadata?: ProjectMetadata;
    title?: string;
    scriptDoc?: ScriptDocPayload;
  },
): Promise<ProjectWithDoc> {
  const supabase = getDbClient();

  const projectUpdates: Partial<Tables<"projects">> = {};
  if (input.metadata) {
    projectUpdates.metadata = input.metadata;
  }
  if (input.title) {
    projectUpdates.title = input.title;
  }

  if (Object.keys(projectUpdates).length) {
    const { error } = await supabase
      .from("projects")
      .update(projectUpdates)
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  if (input.scriptDoc) {
    const { error } = await supabase
      .from("script_docs")
      .insert({
        project_id: projectId,
        user_id: userId,
        doc: input.scriptDoc.doc,
        metadata: input.scriptDoc.metadata ?? {},
        transcript_refs: input.scriptDoc.transcriptRefs ?? [],
        revision_id: input.scriptDoc.revisionId ?? null,
        record_type: input.scriptDoc.recordType ?? "autosave",
      });

    if (error) {
      throw error;
    }
  }

  const result = await fetchProjectWithDoc(projectId, userId);
  if (!result) {
    throw new Error("Project not found after update");
  }
  return result;
}
