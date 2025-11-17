import { Buffer } from "node:buffer";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { logAuditEvent } from "@/lib/auditLog";
import {
  createExportJobRecord,
  fetchExportJobRecord,
  listExportJobRecordsForProject,
  listQueuedExportJobRows,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import type { ExportJob, ExportQueuePayload } from "@/lib/exports/types";
import type { ExportJobRow } from "@/lib/db/schema";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { logStructuredEvent } from "@/lib/observability";
import {
  S3_ACCESS_KEY_ID,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_BUCKET,
  S3_PREFIX,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_STORAGE_FOLDER,
} from "@/lib/storage/config";
import type { ExportFormat, ScriptDoc } from "./types";

const EXPORT_STORAGE_PREFIX = process.env.EXPORT_STORAGE_PREFIX?.trim() || "exports";

interface RenderedArtifact {
  buffer: Buffer;
  extension: string;
  mime: string;
  notes?: string;
}

interface PersistedArtifact {
  file_name: string;
  content_type: string;
  notes?: string;
  storage_driver?: "supabase" | "s3" | "local";
  storage_bucket?: string;
  storage_path?: string;
  storage_key?: string;
  data_url?: string;
  size?: number;
}

export function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob> {
  return createExportJobRecord(payload);
}

export function getExportJob(
  jobId: string,
  options?: { includeDownload?: boolean },
): Promise<ExportJob | null> {
  return fetchExportJobRecord(jobId, { includeDownload: options?.includeDownload ?? true });
}

export function listProjectExportJobs(
  projectId: string,
  options?: { limit?: number; includeDownload?: boolean },
): Promise<ExportJob[]> {
  return listExportJobRecordsForProject(projectId, {
    limit: options?.limit,
    includeDownload: options?.includeDownload ?? true,
  });
}

export async function processPendingExportJobs(limit = 5): Promise<{ processed: number; failures: number }> {
  const queued = await listQueuedExportJobRows(limit);
  let processed = 0;
  let failures = 0;

  for (const job of queued) {
    try {
      await updateExportJobRecord(job.id, { status: "processing" });
      const artifact = await renderExport(job);
      const persisted = await persistArtifact(job, artifact);
      await updateExportJobRecord(job.id, { status: "completed", result: persisted, error: null });
      processed += 1;
      await logAuditEvent({
        action: "export.job.completed",
        userId: "system",
        projectId: job.project_id,
        targetId: job.id,
        details: { format: job.format },
      });
      logStructuredEvent({
        message: "export.job.completed",
        context: { jobId: job.id, projectId: job.project_id, format: job.format },
      });
    } catch (error) {
      failures += 1;
      console.error("Export job failed", error);
      await updateExportJobRecord(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Export failed",
      });
      await logAuditEvent({
        action: "export.job.failed",
        userId: "system",
        projectId: job.project_id,
        targetId: job.id,
        severity: "high",
        details: { format: job.format },
      });
      logStructuredEvent({
        level: "error",
        message: "export.job.failed",
        context: { jobId: job.id, projectId: job.project_id, format: job.format },
        error,
      });
    }
  }

  return { processed, failures };
}

async function renderExport(job: ExportJobRow): Promise<RenderedArtifact> {
  const payload = job.script_doc as ScriptDoc;
  switch (job.format) {
    case "fountain":
      return {
        buffer: Buffer.from(scriptDocToFountain(payload), "utf8"),
        extension: "fountain",
        mime: "text/plain;charset=utf-8",
        notes: "Generated from ScriptDoc payload",
      };
    case "fdx":
      return {
        buffer: Buffer.from(scriptDocToFdx(payload), "utf8"),
        extension: "fdx",
        mime: "application/xml",
        notes: "Simplified Final Draft XML",
      };
    case "docx":
      return {
        buffer: scriptDocToDocx(payload),
        extension: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        notes: "Minimal WordprocessingML payload",
      };
    case "pdf":
      return {
        buffer: scriptDocToPdf(payload),
        extension: "pdf",
        mime: "application/pdf",
        notes: "Stub PDF content",
      };
    default:
      throw new Error(`Unsupported export format: ${job.format}`);
  }
}

async function persistArtifact(job: ExportJobRow, artifact: RenderedArtifact): Promise<PersistedArtifact> {
  const fileName = buildFileName(job.project_id, artifact.extension);
  const size = artifact.buffer.length;
  const storageDriver = selectStorageDriver();

  if (storageDriver === "supabase") {
    const supabase = getSupabaseServiceClient();
    if (!supabase || !SUPABASE_STORAGE_BUCKET) {
      throw new Error("Supabase storage is not configured for export jobs");
    }
    const path = buildSupabasePath(job.project_id, job.id, artifact.extension);
    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(path, artifact.buffer, {
        contentType: artifact.mime,
        upsert: true,
      });
    if (error) {
      throw error;
    }
    return {
      file_name: fileName,
      content_type: artifact.mime,
      notes: artifact.notes,
      storage_driver: "supabase",
      storage_bucket: SUPABASE_STORAGE_BUCKET,
      storage_path: path,
      size,
    };
  }

  if (storageDriver === "s3") {
    if (!S3_BUCKET || !S3_REGION) {
      throw new Error("S3 storage is not configured for export jobs");
    }
    const key = buildS3Key(job.project_id, job.id, artifact.extension);
    const client = getS3UploadClient();
    await client.send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: artifact.buffer, ContentType: artifact.mime }),
    );
    return {
      file_name: fileName,
      content_type: artifact.mime,
      notes: artifact.notes,
      storage_driver: "s3",
      storage_bucket: S3_BUCKET,
      storage_key: key,
      size,
    };
  }

  return {
    file_name: fileName,
    content_type: artifact.mime,
    notes: artifact.notes,
    storage_driver: "local",
    data_url: createDataUrl(artifact.buffer, artifact.mime),
    size,
  };
}

function buildFileName(projectId: string, extension: string): string {
  const safeProject = projectId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeProject}-${timestamp}.${extension}`;
}

function buildSupabasePath(projectId: string, jobId: string, extension: string): string {
  const baseFolder = SUPABASE_STORAGE_FOLDER?.replace(/\/$/, "") || "reference";
  return `${baseFolder}/${EXPORT_STORAGE_PREFIX}/${projectId}/${jobId}.${extension}`;
}

function buildS3Key(projectId: string, jobId: string, extension: string): string {
  const prefix = S3_PREFIX?.replace(/\/$/, "") || "assets";
  return `${prefix}/${EXPORT_STORAGE_PREFIX}/${projectId}/${jobId}.${extension}`;
}

function createDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

let cachedS3Client: S3Client | null = null;

function getS3UploadClient(): S3Client {
  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
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
  return cachedS3Client;
}

function selectStorageDriver(): "supabase" | "s3" | "local" {
  if (SUPABASE_STORAGE_BUCKET && getSupabaseServiceClient()) {
    return "supabase";
  }
  if (S3_BUCKET && S3_REGION) {
    return "s3";
  }
  return "local";
}

function scriptDocToFountain(doc: ScriptDoc): string {
  return linesFromScriptDoc(doc).join("\n").trimEnd().concat("\n");
}

function scriptDocToFdx(doc: ScriptDoc): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenes = (doc.scenes ?? [])
    .map((scene) => {
      const dialogue = (scene.dialogue ?? [])
        .map((beat) => {
          const parenthetical = beat.parenthetical
            ? `<Parenthetical>${escape(beat.parenthetical)}</Parenthetical>`
            : "";
          return `
            <Paragraph Type="Character">${escape(beat.character)}</Paragraph>
            ${parenthetical}
            <Paragraph Type="Dialogue">${escape(beat.text)}</Paragraph>
          `;
        })
        .join("");
      const action = scene.action ? `<Paragraph Type="Action">${escape(scene.action)}</Paragraph>` : "";
      return `
        <Paragraph Type="Scene Heading">${escape(scene.heading)}</Paragraph>
        ${action}
        ${dialogue}
      `;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
  <FinalDraft DocumentType="Script" Version="1">
    <Content>${scenes}</Content>
  </FinalDraft>`;
}

function scriptDocToDocx(doc: ScriptDoc): Buffer {
  const paragraphs = linesFromScriptDoc(doc)
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>${paragraphs}</w:body>
  </w:document>`;
  return Buffer.from(xml, "utf8");
}

function scriptDocToPdf(doc: ScriptDoc): Buffer {
  const body = linesFromScriptDoc(doc).join("\n");
  const pdf = `%PDF-1.4\n${body}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function linesFromScriptDoc(doc: ScriptDoc): string[] {
  const lines: string[] = [];
  if (doc.title) {
    lines.push(doc.title.toUpperCase(), "");
  }
  if (doc.logline) {
    lines.push(doc.logline, "");
  }
  for (const scene of doc.scenes ?? []) {
    lines.push(scene.heading.toUpperCase());
    if (scene.action) {
      lines.push(scene.action, "");
    }
    for (const beat of scene.dialogue ?? []) {
      lines.push(beat.character.toUpperCase());
      if (beat.parenthetical) {
        lines.push(`(${beat.parenthetical})`);
      }
      lines.push(beat.text, "");
    }
    lines.push("");
  }
  return lines;
}
