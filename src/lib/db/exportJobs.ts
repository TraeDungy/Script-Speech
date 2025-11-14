import { randomUUID } from "node:crypto";

import type { ExportFormat, ExportJob, ScriptDoc } from "@/lib/exports/types";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  createMockExportJob,
  getMockExportJob,
  upsertMockExportJob,
} from "./mocks";
import type { ExportJobRow } from "./schema";

function mapExportJobRow(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    projectId: row.project_id,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliverToEmail: row.deliver_to_email ?? undefined,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
  };
}

export async function createExportJobRecord(payload: {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
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
    format: payload.format,
    status: "queued",
    deliver_to_email: payload.deliverToEmail ?? null,
    script_doc: payload.scriptDoc,
    result: null,
    error: null,
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
  updates: Partial<Pick<ExportJobRow, "status" | "result" | "error" | "updated_at">>,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const job = getMockExportJob(jobId);
    if (!job) {
      return;
    }
    const merged: ExportJobRow = {
      ...job,
      ...updates,
      updated_at: updates.updated_at ?? new Date().toISOString(),
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

export async function fetchExportJobRow(jobId: string): Promise<ExportJobRow | null> {
  if (!isSupabaseConfigured()) {
    const job = getMockExportJob(jobId);
    return job ? { ...job } : null;
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
    console.error("Failed to fetch export job row", error);
    throw error;
  }

  return data ?? null;
}
