import { Buffer } from "node:buffer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { createDraftVersionRecord } from "@/lib/db/draftVersions";
import {
  createExportJobRecord,
  fetchExportJobRecord,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import type { ExportFormat, ExportJob, ExportJobResult, ScriptDoc } from "./types";
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
  userId?: string;
};

type RenderedExportResult = {
  buffer: Buffer;
  extension: string;
  mime: string;
  notes?: string;
  pageCount?: number;
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
    const draft = await createDraftVersionRecord({
      projectId: payload.projectId,
      doc: payload.scriptDoc,
      createdBy: payload.userId ?? null,
    });
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
      const artifact = await persistExportArtifact(jobId, payload, rendered);
      const emailDelivery = await maybeDeliverExportEmail({
        jobId,
        deliverToEmail: payload.deliverToEmail,
        artifact,
        format: payload.format,
        fileName,
      });
      const readyAt = new Date().toISOString();

      await updateExportJobRecord(jobId, {
        status: "succeeded",
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
          pageCount: rendered.pageCount,
          emailDelivery,
        },
        error: null,
        storage_driver: artifact.storageDriver ?? null,
        storage_bucket: artifact.storageBucket ?? null,
        storage_path: artifact.storagePath ?? null,
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
      return scriptDocToFountain(payload.scriptDoc);
    case "fdx":
      return scriptDocToFdx(payload.scriptDoc);
    case "txt":
      return scriptDocToPlainText(payload.scriptDoc);
    case "rtf":
      return scriptDocToRtf(payload.scriptDoc);
    case "docx":
      return await scriptDocToDocx(payload.scriptDoc);
    case "pdf":
      return await scriptDocToPdf(payload.scriptDoc);
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
      const { data: publicUrl } = supabase.storage.from(EXPORT_STORAGE_BUCKET).getPublicUrl(path);
      return {
        storageDriver: "supabase",
        storageBucket: EXPORT_STORAGE_BUCKET,
        storagePath: path,
        contentType: rendered.mime,
        size: rendered.buffer.byteLength,
        downloadUrl: publicUrl?.publicUrl ?? undefined,
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
        downloadUrl: buildS3DownloadUrl(key),
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

function buildS3DownloadUrl(key: string): string | undefined {
  if (!EXPORT_S3_BUCKET) return undefined;
  if (S3_ENDPOINT?.startsWith("http")) {
    const base = S3_ENDPOINT.replace(/\/+$/, "");
    return `${base}/${EXPORT_S3_BUCKET}/${key}`;
  }
  if (S3_REGION) {
    return `https://${EXPORT_S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }
  return undefined;
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

const DEFAULT_LINES_PER_PAGE = 55;
const SCREENPLAY_LINE_WIDTH = 60;
const CHARACTER_COLUMN = 20;
const DIALOGUE_COLUMN = 10;
const PARENTHETICAL_COLUMN = 16;

function wrapIndentedText(text: string, width: number, indent = 0): string[] {
  const words = text.split(/\s+/g);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word;
    if (tentative.length + indent > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = tentative;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.map((line) => `${" ".repeat(indent)}${line}`);
}

function formatDialogueBlock(beat: ScriptDoc["scenes"][number]["dialogue"][number]): string[] {
  const lines: string[] = [];
  lines.push(`${" ".repeat(CHARACTER_COLUMN)}${beat.character.toUpperCase()}`);
  if (beat.parenthetical) {
    lines.push(`${" ".repeat(PARENTHETICAL_COLUMN)}(${beat.parenthetical})`);
  }
  const dialogueLines = wrapIndentedText(beat.text, SCREENPLAY_LINE_WIDTH, DIALOGUE_COLUMN);
  lines.push(...dialogueLines);
  lines.push("");
  return lines;
}

function formatScriptDocLines(doc: ScriptDoc): string[] {
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
      lines.push(...wrapIndentedText(scene.action, SCREENPLAY_LINE_WIDTH, 4), "");
    }
    for (const beat of scene.dialogue ?? []) {
      lines.push(...formatDialogueBlock(beat));
    }
    lines.push("");
  }
  return lines;
}

function paginateLines(lines: string[], maxLinesPerPage = DEFAULT_LINES_PER_PAGE): {
  pages: string[][];
  pageCount: number;
} {
  const pages: string[][] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    if (current.length >= maxLinesPerPage) {
      pages.push(current);
      current = [];
    }
    current.push(line);
  });

  if (current.length) {
    pages.push(current);
  }

  return { pages: pages.length ? pages : [[]], pageCount: pages.length || 1 };
}

function scriptDocToFountain(doc: ScriptDoc): RenderedExportResult {
  const { pages, pageCount } = paginateLines(formatScriptDocLines(doc));
  const body = pages.flat().join("\n").trimEnd().concat("\n");
  return {
    buffer: Buffer.from(body, "utf8"),
    extension: "fountain",
    mime: "text/plain;charset=utf-8",
    notes: `Generated from ScriptDoc snapshot (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

function scriptDocToFdx(doc: ScriptDoc): RenderedExportResult {
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
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <FinalDraft DocumentType="Script" Version="1">
    <Content>${scenes}</Content>
  </FinalDraft>`;
  const { pageCount } = paginateLines(formatScriptDocLines(doc));
  return {
    buffer: Buffer.from(xml, "utf8"),
    extension: "fdx",
    mime: "application/xml",
    notes: `Simplified Final Draft XML (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

function scriptDocToPlainText(doc: ScriptDoc): RenderedExportResult {
  const { pages, pageCount } = paginateLines(formatScriptDocLines(doc));
  const textPages = pages.map((page, index) => `Page ${index + 1}/${pageCount}\n\n${page.join("\n")}`);
  const body = textPages.join("\n\f\n");
  return {
    buffer: Buffer.from(body, "utf8"),
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    notes: `Paginated plain text (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

function scriptDocToRtf(doc: ScriptDoc): RenderedExportResult {
  const { pages, pageCount } = paginateLines(formatScriptDocLines(doc));
  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
  const pageBlocks = pages.map((page, index) => {
    const header = `\\pard\\qr Page ${index + 1} of ${pageCount}\\par\\pard\\ql`;
    const lines = page.map((line) => `${escape(line)}\\line`).join("");
    return `${header}${lines}${index < pages.length - 1 ? "\\page" : ""}`;
  });
  const body = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 \\fmodern Courier New;}}${pageBlocks.join("")}}`;
  return {
    buffer: Buffer.from(body, "utf8"),
    extension: "rtf",
    mime: "application/rtf",
    notes: `Rich Text Format with page breaks (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

async function scriptDocToDocx(doc: ScriptDoc): Promise<RenderedExportResult> {
  const { pages, pageCount } = paginateLines(formatScriptDocLines(doc));
  const sections = pages.map((page, index) => ({
    properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children: [
      new Paragraph({
        children: [new TextRun({ text: `Page ${index + 1} of ${pageCount}`, font: "Courier New", size: 18 })],
        alignment: AlignmentType.RIGHT,
      }),
      ...page.map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line || " ", font: "Courier New", size: 24 })],
            spacing: { after: 120 },
          }),
      ),
    ],
  }));

  const document = new Document({
    sections,
  });

  const buffer = await Packer.toBuffer(document);
  return {
    buffer,
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    notes: `Paginated DOCX export (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

async function scriptDocToPdf(doc: ScriptDoc): Promise<RenderedExportResult> {
  const { pages, pageCount } = paginateLines(formatScriptDocLines(doc));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  const fontSize = 12;
  const lineHeight = 16;
  const margin = 72;
  const pageWidth = 612;
  const pageHeight = 792;

  pages.forEach((pageLines, index) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const { width, height } = page.getSize();
    let y = height - margin;

    page.drawText(`Page ${index + 1} of ${pageCount}`, {
      x: width - margin - font.widthOfTextAtSize(`Page ${index + 1} of ${pageCount}`, fontSize),
      y,
      size: fontSize,
      font,
    });

    y -= lineHeight * 1.5;

    for (const line of pageLines) {
      if (y <= margin) break;
      page.drawText(line || " ", { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }
  });

  const buffer = Buffer.from(await pdf.save());
  return {
    buffer,
    extension: "pdf",
    mime: "application/pdf",
    notes: `Paginated PDF (${pageCount} page${pageCount === 1 ? "" : "s"})`,
    pageCount,
  };
}

function createDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function buildFileName(projectId: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${projectId}-${timestamp}.${extension}`;
}

type EmailDeliveryRequest = {
  jobId: string;
  deliverToEmail?: string;
  artifact: StoredArtifact;
  format: ExportFormat;
  fileName: string;
};

async function maybeDeliverExportEmail(
  params: EmailDeliveryRequest,
): Promise<ExportJobResult["emailDelivery"] | undefined> {
  const { deliverToEmail, artifact, format, fileName, jobId } = params;
  if (!deliverToEmail) return undefined;

  const downloadUrl = buildDownloadReference(artifact, fileName);
  if (!downloadUrl) {
    return { status: "failed", to: deliverToEmail, detail: "No download URL available" };
  }

  const endpoint = process.env.EXPORT_DELIVERY_EMAIL_ENDPOINT;
  const apiKey = process.env.EXPORT_DELIVERY_EMAIL_API_KEY;

  try {
    if (endpoint) {
      await postJson(
        endpoint,
        {
          to: deliverToEmail,
          jobId,
          format,
          fileName,
          downloadUrl,
        },
        apiKey,
      );
      return { status: "sent", to: deliverToEmail };
    }

    console.info("Export ready for email delivery", { to: deliverToEmail, jobId, downloadUrl });
    return { status: "queued", to: deliverToEmail, detail: "No email endpoint configured; logged delivery." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Failed to deliver export via email", { error, jobId, deliverToEmail });
    return { status: "failed", to: deliverToEmail, detail };
  }
}

function buildDownloadReference(artifact: StoredArtifact, fileName: string): string | null {
  if (artifact.downloadUrl) return artifact.downloadUrl;
  if (artifact.storageDriver && artifact.storageBucket && artifact.storagePath) {
    if (artifact.storageDriver === "s3") {
      return buildS3DownloadUrl(artifact.storagePath) ?? null;
    }
    if (artifact.storageDriver === "supabase") {
      const supabase = getSupabaseServiceClient();
      const { data } = supabase
        ?.storage.from(artifact.storageBucket)
        .getPublicUrl?.(artifact.storagePath) ?? { data: null };
      if (data?.publicUrl) return data.publicUrl;
    }
  }
  if (artifact.storageDriver === "local") {
    return artifact.downloadUrl ?? null;
  }
  return null;
}

async function postJson(url: string, payload: unknown, apiKey?: string): Promise<void> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to POST to ${url}: ${response.status} ${response.statusText}`);
  }
}

export function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}
