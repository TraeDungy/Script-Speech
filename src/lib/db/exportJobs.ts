import { randomUUID } from "node:crypto";

import type { ExportFormat, ExportJob, ScriptDoc } from "@/lib/exports/types";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  createMockExportJob,
  getMockExportJob,
  listMockExportJobs,
  upsertMockExportJob,
} from "./mocks";
import type { ExportJobRow } from "./schema";

function mapExportJobRow(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id ?? undefined,
    draftVersionId: row.draft_version_id ?? undefined,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliverToEmail: row.deliver_to_email ?? undefined,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    downloadPath: row.storage_path ?? undefined,
  };
}

export async function createExportJobRecord(payload: {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
  userId?: string;
  draftVersionId?: string | null;
}): Promise<ExportJob> {
  if (!isSupabaseConfigured()) {
    const job = createMockExportJob(payload);
    return mapExportJobRow(job);
  }

  const supabase = getSupabaseClient();
  const id = randomUUID();
  const now = new Date().toISOString();
  const record: ExportJobRow = {
    id,
    project_id: payload.projectId,
    draft_version_id: payload.draftVersionId ?? null,
    user_id: payload.userId ?? null,
    format: payload.format,
    status: "queued",
    deliver_to_email: payload.deliverToEmail ?? null,
    script_doc: payload.scriptDoc,
    result: null,
    error: null,
    storage_bucket: null,
    storage_driver: null,
    storage_path: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from<ExportJobRow>("export_jobs")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create export job", error);
    throw error;
  }

  return mapExportJobRow(data);
}

export async function updateExportJobRecord(
  jobId: string,
  updates: Partial<
    Pick<ExportJobRow, "status" | "result" | "error" | "storage_driver" | "storage_bucket" | "storage_path">
  >,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const job = getMockExportJob(jobId);
    if (!job) {
      return;
    }
    const merged: ExportJobRow = {
      ...job,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    upsertMockExportJob(merged);
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from<ExportJobRow>("export_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Failed to update export job", error);
    throw error;
  }
}

export async function fetchExportJobRecord(jobId: string): Promise<ExportJob | null> {
  if (!isSupabaseConfigured()) {
    const job = getMockExportJob(jobId);
    return job ? mapExportJobRow(job) : null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ExportJobRow>("export_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to fetch export job", error);
    throw error;
  }

  return data ? mapExportJobRow(data) : null;
}

export async function listExportJobsForProject(
  projectId: string,
  options: { limit?: number } = {},
): Promise<ExportJob[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  if (!isSupabaseConfigured()) {
    const jobs = listMockExportJobs()
      .filter((job) => job.project_id === projectId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, limit);
    return jobs.map(mapExportJobRow);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ExportJobRow>("export_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list export jobs", error);
    throw error;
  }

  return (data ?? []).map(mapExportJobRow);
}

export async function listExportJobsForUser(
  userId: string,
  options: { limit?: number } = {},
): Promise<ExportJob[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  if (!isSupabaseConfigured()) {
    const jobs = listMockExportJobs()
      .filter((job) => job.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
    return jobs.map(mapExportJobRow);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ExportJobRow>("export_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list export jobs", error);
    throw error;
  }

  return (data ?? []).map(mapExportJobRow);
}
