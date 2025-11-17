import { randomUUID } from "node:crypto";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ExportJob, ExportQueuePayload } from "@/lib/exports/types";
import { getSupabaseClient } from "./client";
import { SUPABASE_URL, isSupabaseConfigured } from "./config";
import {
  createMockExportJob,
  getMockExportJob,
  listMockExportJobs,
  upsertMockExportJob,
} from "./mocks";
import type { ExportJobRow } from "./schema";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import {
  S3_ACCESS_KEY_ID,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN,
  STORAGE_SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/config";

interface MapOptions {
  includeDownload?: boolean;
}

function baseJobFromRow(row: ExportJobRow): Omit<ExportJob, "result"> {
  return {
    id: row.id,
    projectId: row.project_id,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliverToEmail: row.deliver_to_email ?? undefined,
    error: row.error ?? undefined,
  };
}

async function buildResult(
  row: ExportJobRow,
  options?: MapOptions,
): Promise<ExportJob["result"] | undefined> {
  if (!row.result) {
    return undefined;
  }

  const result = {
    fileName: row.result.file_name,
    notes: row.result.notes ?? undefined,
    contentType: row.result.content_type ?? undefined,
  } satisfies Omit<ExportJob["result"], "downloadUrl" | "expiresAt">;

  if (!options?.includeDownload) {
    return result;
  }

  if (row.result.data_url) {
    return { ...result, downloadUrl: row.result.data_url };
  }

  if (row.result.storage_driver === "supabase" && row.result.storage_bucket && row.result.storage_path) {
    const supabase = getSupabaseServiceClient();
    if (supabase) {
      const { data, error } = await supabase.storage
        .from(row.result.storage_bucket)
        .createSignedUrl(row.result.storage_path, STORAGE_SIGNED_URL_TTL_SECONDS, {
          download: row.result.file_name,
        });

      if (!error && data?.signedUrl) {
        const baseUrl = SUPABASE_URL?.replace(/\/$/, "") ?? "";
        const absoluteUrl = data.signedUrl.startsWith("http")
          ? data.signedUrl
          : `${baseUrl}${data.signedUrl.startsWith("/") ? "" : "/"}${data.signedUrl}`;
        return {
          ...result,
          downloadUrl: absoluteUrl,
          expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        };
      }
    }
  }

  if (row.result.storage_driver === "s3" && row.result.storage_bucket && row.result.storage_key) {
    const s3Url = await createS3SignedDownload(row.result.storage_bucket, row.result.storage_key, row.result.file_name);
    if (s3Url) {
      return { ...result, downloadUrl: s3Url.url, expiresAt: s3Url.expiresAt };
    }
  }

  return result;
}

async function mapExportJobRow(row: ExportJobRow, options?: MapOptions): Promise<ExportJob> {
  return {
    ...baseJobFromRow(row),
    result: await buildResult(row, options),
  };
}

async function createS3SignedDownload(bucket: string, key: string, fileName: string): Promise<{ url: string; expiresAt: string } | null> {
  if (!S3_REGION) {
    return null;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });

  const url = await getSignedUrl(client, command, { expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS });
  return {
    url,
    expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials:
        S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: S3_ACCESS_KEY_ID,
              secretAccessKey: S3_SECRET_ACCESS_KEY!,
              sessionToken: S3_SESSION_TOKEN,
            }
          : undefined,
    });
  }

  return s3Client;
}

export async function createExportJobRecord(payload: ExportQueuePayload): Promise<ExportJob> {
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

export async function fetchExportJobRecord(
  jobId: string,
  options?: { includeDownload?: boolean },
): Promise<ExportJob | null> {
  const includeDownload = options?.includeDownload ?? false;
  if (!isSupabaseConfigured()) {
    const job = getMockExportJob(jobId);
    return job ? mapExportJobRow(job, { includeDownload }) : null;
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

  return data ? mapExportJobRow(data, { includeDownload }) : null;
}

export async function listExportJobRecordsForProject(
  projectId: string,
  options?: { limit?: number; includeDownload?: boolean },
): Promise<ExportJob[]> {
  const includeDownload = options?.includeDownload ?? false;
  const limit = options?.limit ?? 20;

  if (!isSupabaseConfigured()) {
    const rows = listMockExportJobs()
      .filter((job) => job.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
    return Promise.all(rows.map((row) => mapExportJobRow(row, { includeDownload })));
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

  return Promise.all((data ?? []).map((row) => mapExportJobRow(row, { includeDownload })));
}

export async function claimQueuedExportJobRows(limit: number): Promise<ExportJobRow[]> {
  if (!isSupabaseConfigured()) {
    const claimed = listMockExportJobs()
      .filter((job) => job.status === "queued")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, limit)
      .map((row) => ({ ...row, status: "processing", updated_at: new Date().toISOString() }));

    claimed.forEach((row) => upsertMockExportJob(row));
    return claimed;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc<ExportJobRow[]>("claim_export_jobs", { claim_limit: limit });

  if (error) {
    console.error("Failed to claim queued export jobs", error);
    throw error;
  }

  return data ?? [];
}
