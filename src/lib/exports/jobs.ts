import { randomUUID } from "node:crypto";

import type { ExportJob } from "@/lib/exports/types";
import type { Database } from "@/lib/db/generated.types";
import { getSupabaseServiceClient } from "@/lib/supabase.server";

export type ExportJobRow = Database["public"]["Tables"]["export_jobs"]["Row"];

function mapExportJob(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    userId: row.user_id ?? undefined,
    scriptDocId: row.script_doc_id ?? undefined,
    draftVersionId: row.draft_version_id ?? undefined,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliverToEmail: row.deliver_to_email ?? undefined,
    result: (row.result as ExportJob["result"]) ?? undefined,
    error: row.error ?? undefined,
    errorMessage: row.error_message,
    downloadPath: row.download_path,
  };
}

export async function createQueuedExportJob(params: {
  userId: string;
  scriptDocId?: string | null;
  scriptDoc: unknown;
  format: ExportJob["format"];
  deliverToEmail?: string;
}): Promise<ExportJob> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("export_jobs")
    .insert({
      id: randomUUID(),
      user_id: params.userId,
      script_doc_id: params.scriptDocId ?? null,
      script_doc: params.scriptDoc ?? {},
      status: "queued",
      format: params.format,
      deliver_to_email: params.deliverToEmail ?? null,
      created_at: now,
      updated_at: now,
      download_path: null,
      error_message: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to insert export job");
  }

  return mapExportJob(data);
}

export async function getExportJobForUser(jobId: string, userId: string): Promise<ExportJob | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data, error } = await supabase
    .from("export_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data ? mapExportJob(data) : null;
}

export async function updateExportJobForUser(
  jobId: string,
  userId: string,
  updates: Partial<Pick<ExportJobRow, "status" | "download_path" | "error_message">>,
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { error } = await supabase
    .from("export_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export { mapExportJob };
