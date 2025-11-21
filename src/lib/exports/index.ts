import { Buffer } from "node:buffer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { createDraftVersionRecord } from "@/lib/db/draftVersions";
import {
  createExportJobRecord,
  fetchExportJobRecord,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import { logStructuredEvent, recordFlowMetric, withSpan } from "@/lib/observability";
import type { ExportFormat, ExportJob, ScriptDoc } from "./types";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_PREFIX,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/storage/config";

export type ExportQueuePayload = {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
};

type RenderedExportResult = {
  buffer: Buffer;
  extension: string;
  mime: string;
  notes?: string;
};

type StoredArtifact = {
  downloadUrl?: string;
  storageDriver?: "supabase" | "s3" | "local";
  storageBucket?: string;
  storagePath?: string;
  contentType: string;
  size: number;
};

const EXPORT_STORAGE_BUCKET = process.env.EXPORT_STORAGE_BUCKET?.trim() || SUPABASE_STORAGE_BUCKET;
const EXPORT_STORAGE_FOLDER = process.env.EXPORT_STORAGE_FOLDER?.trim() || "exports";
const EXPORT_S3_BUCKET = process.env.EXPORT_S3_BUCKET?.trim() || S3_BUCKET;
const EXPORT_S3_PREFIX =
  process.env.EXPORT_S3_PREFIX?.trim() || (S3_PREFIX ? `${S3_PREFIX.replace(/\/$/, "")}/exports` : "exports");

class LocalExportQueue {
  private payloads = new Map<string, ExportQueuePayload & { draftVersionId?: string | null }>();

  async enqueue(payload: ExportQueuePayload): Promise<ExportJob> {
    const draft = await createDraftVersionRecord({ projectId: payload.projectId, doc: payload.scriptDoc });
    const job = await createExportJobRecord({
      ...payload,
      draftVersionId: draft.id,
    });

    this.payloads.set(job.id, { ...payload, draftVersionId: draft.id });

    setTimeout(() => {
      void this.processJob(job.id).catch((error) => {
        console.error("Export job failed", error);
      });
    }, 25);

        setTimeout(() => {
          void this.process(job.id).catch((error) => {
            logStructuredEvent({
              level: "error",
              message: "export.job.failed",
              error,
              context: { jobId: job.id },
            });
          });
        }, 10);

        return job;
      },
    );
  }

  getJob(jobId: string): Promise<ExportJob | null> {
    return fetchExportJobRecord(jobId);
  }

  private async processJob(jobId: string): Promise<void> {
    const payload = this.payloads.get(jobId);
    if (!payload) {
      return;
    }

    await updateExportJobRecord(jobId, { status: "processing" });

    try {
      const rendered = await renderExport(payload);
      const fileName = buildFileName(payload.projectId, rendered.extension);
      const artifact = await persistExportArtifact(jobId, payload, rendered);
      const readyAt = new Date().toISOString();

      await updateExportJobRecord(jobId, {
        status: "completed",
        result: {
          fileName,
          notes: rendered.notes,
          readyAt,
          downloadUrl: artifact.downloadUrl,
          storageDriver: artifact.storageDriver,
          storageBucket: artifact.storageBucket,
          storagePath: artifact.storagePath,
          contentType: artifact.contentType,
          size: artifact.size,
        },
        error: null,
        storage_driver: artifact.storageDriver ?? null,
        storage_bucket: artifact.storageBucket ?? null,
        storage_path: artifact.storagePath ?? null,
      });
    } catch (error) {
      recordFlowMetric("export_jobs_total", "Count of export jobs", {
        stage: "failed",
        format: payload.format,
      });
      await updateExportJobRecord(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      this.payloads.delete(jobId);
    }
  }
}

const queueGlobal = globalThis as typeof globalThis & {
  __scriptSpeechExportQueue?: LocalExportQueue;
};

function getExportQueue(): LocalExportQueue {
  if (!queueGlobal.__scriptSpeechExportQueue) {
    queueGlobal.__scriptSpeechExportQueue = new LocalExportQueue();
  }
  return queueGlobal.__scriptSpeechExportQueue;
}

export function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob> {
  return getExportQueue().enqueue(payload);
}

export function getExportJob(jobId: string): Promise<ExportJob | null> {
  return getExportQueue().getJob(jobId);
}

async function renderExport(payload: ExportQueuePayload): Promise<RenderedExportResult> {
  switch (payload.format) {
    case "fountain":
      return {
        buffer: Buffer.from(scriptDocToFountain(payload.scriptDoc), "utf8"),
        extension: "fountain",
        mime: "text/plain;charset=utf-8",
        notes: "Generated from ScriptDoc snapshot",
      };
    case "fdx":
      return {
        buffer: Buffer.from(scriptDocToFdx(payload.scriptDoc), "utf8"),
        extension: "fdx",
        mime: "application/xml",
        notes: "Simplified Final Draft XML",
      };
    case "docx":
      return {
        buffer: scriptDocToDocx(payload.scriptDoc),
        extension: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        notes: "WordprocessingML placeholder",
      };
    case "pdf":
      return {
        buffer: scriptDocToPdf(payload.scriptDoc),
        extension: "pdf",
        mime: "application/pdf",
        notes: "Stub PDF preview",
      };
    default:
      throw new Error(`Unsupported export format: ${payload.format}`);
  }
}

async function persistExportArtifact(
  jobId: string,
  payload: ExportQueuePayload,
  rendered: RenderedExportResult,
): Promise<StoredArtifact> {
  const supabase = getSupabaseServiceClient();
  if (supabase && EXPORT_STORAGE_BUCKET) {
    const path = buildStoragePath(payload.projectId, jobId, rendered.extension, EXPORT_STORAGE_FOLDER);
    const { error } = await supabase.storage.from(EXPORT_STORAGE_BUCKET).upload(path, rendered.buffer, {
      contentType: rendered.mime,
      upsert: true,
    });
    if (!error) {
      return {
        storageDriver: "supabase",
        storageBucket: EXPORT_STORAGE_BUCKET,
        storagePath: path,
        contentType: rendered.mime,
        size: rendered.buffer.byteLength,
      };
    }
    console.error("Failed to upload export artifact to Supabase storage", error);
  }

  const s3Client = getS3ExportClient();
  if (s3Client && EXPORT_S3_BUCKET) {
    const key = buildStoragePath(payload.projectId, jobId, rendered.extension, EXPORT_S3_PREFIX);
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: EXPORT_S3_BUCKET,
          Key: key,
          Body: rendered.buffer,
          ContentType: rendered.mime,
          ContentLength: rendered.buffer.byteLength,
        }),
      );
      return {
        storageDriver: "s3",
        storageBucket: EXPORT_S3_BUCKET,
        storagePath: key,
        contentType: rendered.mime,
        size: rendered.buffer.byteLength,
      };
    } catch (error) {
      console.error("Failed to upload export artifact to S3", error);
    }
  }

  return {
    downloadUrl: createDataUrl(rendered.buffer, rendered.mime),
    storageDriver: "local",
    contentType: rendered.mime,
    size: rendered.buffer.byteLength,
  };
}

function buildStoragePath(projectId: string, jobId: string, extension: string, prefix: string): string {
  const safeProject = projectId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const safePrefix = prefix.replace(/\/+$/, "");
  return `${safePrefix}/${safeProject}/${jobId}.${extension}`;
}

let s3Client: S3Client | null = null;

function getS3ExportClient(): S3Client | null {
  if (!EXPORT_S3_BUCKET || !S3_REGION) {
    return null;
  }

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

function linesFromScriptDoc(doc: ScriptDoc): string[] {
  const lines: string[] = [];
  if (doc.title) {
    lines.push(doc.title.toUpperCase(), "");
  }
  if (doc.logline) {
    lines.push(doc.logline, "");
  }
  for (const scene of doc.scenes) {
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

function scriptDocToFountain(doc: ScriptDoc): string {
  return linesFromScriptDoc(doc).join("\n").trimEnd().concat("\n");
}

function scriptDocToFdx(doc: ScriptDoc): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenes = doc.scenes
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
      const action = scene.action
        ? `<Paragraph Type="Action">${escape(scene.action)}</Paragraph>`
        : "";
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

function createDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function buildFileName(projectId: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${projectId}-${timestamp}.${extension}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LocalExportQueue {
  private payloads = new Map<string, ExportQueuePayload>();

  async enqueue(payload: ExportQueuePayload): Promise<ExportJob> {
    const job = await createExportJobRecord(payload);
    this.payloads.set(job.id, payload);
    setTimeout(() => {
      void this.processJob(job.id).catch((error) => {
        console.error("Export job processing failed", error);
      });
    }, 10);
    return job;
  }

  async getJob(jobId: string): Promise<ExportJob | null> {
    return fetchExportJobRecord(jobId);
  }

  private async processJob(jobId: string): Promise<void> {
    const payload = this.payloads.get(jobId);
    if (!payload) {
      return;
    }

    await updateExportJobRecord(jobId, { status: "processing" });

    try {
      const rendered = await renderExport(payload);
      const fileName = buildFileName(payload.projectId, rendered.extension);
      await updateExportJobRecord(jobId, {
        status: "completed",
        result: {
          fileName,
          downloadUrl: createDataUrl(rendered.buffer, rendered.mime),
          notes: rendered.notes,
        },
        error: null,
      });
    } catch (error) {
      await updateExportJobRecord(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      this.payloads.delete(jobId);
    }
  }
}

const globalQueueRef = globalThis as typeof globalThis & {
  __scriptSpeechExportQueue?: LocalExportQueue;
};

export function getExportQueue(): LocalExportQueue {
  if (!globalQueueRef.__scriptSpeechExportQueue) {
    globalQueueRef.__scriptSpeechExportQueue = new LocalExportQueue();
  }
  return globalQueueRef.__scriptSpeechExportQueue;
}

export function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob> {
  return getExportQueue().enqueue(payload);
}

export function getExportJob(jobId: string): Promise<ExportJob | null> {
  return getExportQueue().getJob(jobId);
}

let sharedQueue: ExportQueue | LocalExportQueue | null = null;

export function getExportQueue(): ExportQueue | LocalExportQueue {
  if (sharedQueue) {
    return sharedQueue;
  }

  sharedQueue = isSupabaseConfigured() ? new ExportQueue() : getLocalExportQueue();
  return sharedQueue;
}

export async function enqueueExportJob(payload: EnqueuePayload): Promise<ExportJob> {
  const queue = getExportQueue();
  return queue.enqueue(payload);
}

export async function getExportJob(jobId: string): Promise<ExportJob | null> {
  const queue = getExportQueue();
  return queue.getJob(jobId);
}

export function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

