import { randomUUID } from "node:crypto";

import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { insertMockExportDownloadToken } from "./mocks";
import type { ExportDownloadTokenRow } from "./schema";

export interface ExportDownloadRecordInput {
  jobId: string;
  signedUrl: string;
  expiresAt: string;
  userId?: string;
}

export async function recordExportDownload(
  input: ExportDownloadRecordInput,
): Promise<ExportDownloadTokenRow> {
  if (!isSupabaseConfigured()) {
    const row: ExportDownloadTokenRow = {
      id: randomUUID(),
      job_id: input.jobId,
      token: randomUUID(),
      signed_url: input.signedUrl,
      expires_at: input.expiresAt,
      created_by: input.userId ?? null,
      created_at: new Date().toISOString(),
    };
    insertMockExportDownloadToken(row);
    return row;
  }

  const supabase = getSupabaseClient();
  const payload = {
    job_id: input.jobId,
    token: randomUUID(),
    signed_url: input.signedUrl,
    expires_at: input.expiresAt,
    created_by: input.userId ?? null,
  };

  const { data, error } = await supabase
    .from<ExportDownloadTokenRow>("export_download_tokens")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to record export download", error);
    throw error ?? new Error("Unable to persist export download token");
  }

  return data;
}
