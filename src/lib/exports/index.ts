import { Buffer } from "node:buffer";

import {
  createExportJobRecord,
  fetchExportJobRecord,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import type { ExportFormat, ExportJob, ScriptDoc } from "./types";

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

export class ExportQueue {
  async enqueue(payload: EnqueuePayload): Promise<ExportJob> {
    const job = await createExportJobRecord(payload);

    setTimeout(() => {
      this.processJob(job.id, payload).catch((error) => {
        console.error("Export job failed", error);
      });
    }, 0);

    return job;
  }

  async getJob(jobId: string): Promise<ExportJob | null> {
    return fetchExportJobRecord(jobId);
  }

  private async processJob(jobId: string, payload: EnqueuePayload) {
    await updateExportJobRecord(jobId, { status: "processing" });

    try {
      const result = await this.generateResult(payload);
      const fileName = `${payload.projectId}-${jobId}.${result.extension}`;
      const downloadUrl = `data:${result.mime};base64,${Buffer.from(result.content, "utf8").toString("base64")}`;

      await updateExportJobRecord(jobId, {
        status: "completed",
        result: {
          fileName,
          downloadUrl,
          notes: result.notes,
        },
        error: null,
      });
    } catch (error) {
      await updateExportJobRecord(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unexpected export failure",
      });
    }
  }

  private async generateResult(payload: EnqueuePayload): Promise<StubResult> {
    await wait(650 + Math.random() * 400);

    switch (payload.format) {
      case "fountain": {
        const content = scriptDocToFountain(payload.scriptDoc);
        return {
          content,
          extension: "fountain",
          mime: "text/plain;charset=utf-8",
          notes: "Generated directly from the ScriptDoc structure.",
        };
      }
      case "fdx":
        return generateStubDocument(payload.format, payload.scriptDoc, payload.projectId, {
          mime: "application/xml",
          extension: "fdx",
        });
      case "docx":
        return generateStubDocument(payload.format, payload.scriptDoc, payload.projectId, {
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          extension: "docx",
        });
      case "pdf":
        return generateStubDocument(payload.format, payload.scriptDoc, payload.projectId, {
          mime: "application/pdf",
          extension: "pdf",
        });
      default:
        throw new Error(`Unsupported export format: ${job.format}`);
    }
  }
}

function getSupabaseServiceClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable exports.",
    );
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseServiceClient;
}

function getSupabaseAnonClient(): SupabaseClient {
  if (!SUPABASE_ANON_KEY) {
    return getSupabaseServiceClient();
  }

  if (!supabaseAnonClient) {
    supabaseAnonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseAnonClient;
}

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function formatSupabaseError(message: string, error: SupabaseError): string {
  const details = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");
  return `${message}: ${details || "Unknown error"}`;
}

async function postJson(
  url: string,
  payload: unknown,
  headers?: Record<string, string>,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
}

function scriptDocToLines(doc: ScriptDoc): string[] {
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

async function renderExport(payload: ExportQueuePayload): Promise<RenderedExportResult> {
  switch (payload.format) {
    case "fountain":
      return {
        buffer: Buffer.from(scriptDocToFountain(payload.scriptDoc), "utf8"),
        extension: "fountain",
        mime: "text/plain;charset=utf-8",
        notes: "Generated from script document",
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
        notes: "Minimal WordprocessingML payload",
      };
    case "pdf":
      return {
        buffer: scriptDocToPdf(payload.scriptDoc),
        extension: "pdf",
        mime: "application/pdf",
        notes: "Stub PDF content for preview flows",
      };
    default:
      throw new Error(`Unsupported export format: ${payload.format}`);
  }
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

