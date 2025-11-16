import { Buffer } from "node:buffer";

import {
  createExportJobRecord,
  fetchExportJobRecord,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import { logStructuredEvent, recordFlowMetric, withSpan } from "@/lib/observability";
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

class ExportJobQueue {
  private inflight = new Map<string, ExportQueuePayload>();

  async enqueue(payload: ExportQueuePayload): Promise<ExportJob> {
    return withSpan(
      {
        name: "exports.job.enqueue",
        attributes: { format: payload.format, projectId: payload.projectId },
      },
      async () => {
        const job = await createExportJobRecord(payload);
        this.inflight.set(job.id, payload);
        recordFlowMetric("export_jobs_total", "Count of export jobs", {
          stage: "queued",
          format: payload.format,
        });
        logStructuredEvent({
          level: "info",
          message: "export.job.queued",
          context: { jobId: job.id, projectId: job.projectId, format: job.format },
        });

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

  private async process(jobId: string): Promise<void> {
    const payload = this.inflight.get(jobId);
    if (!payload) {
      return;
    }

    try {
      await withSpan(
        {
          name: "exports.job.process",
          attributes: { jobId, format: payload.format, projectId: payload.projectId },
        },
        async (span) => {
          await updateExportJobRecord(jobId, { status: "processing" });
          recordFlowMetric("export_jobs_total", "Count of export jobs", {
            stage: "processing",
            format: payload.format,
          });

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

          recordFlowMetric("export_jobs_total", "Count of export jobs", {
            stage: "completed",
            format: payload.format,
          });
          span.setAttribute("export.result.extension", rendered.extension);
          logStructuredEvent({
            level: "info",
            message: "export.job.completed",
            context: { jobId, projectId: payload.projectId, format: payload.format },
          });
        },
      );
    } catch (error) {
      recordFlowMetric("export_jobs_total", "Count of export jobs", {
        stage: "failed",
        format: payload.format,
      });
      await updateExportJobRecord(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Export failed",
      });
      throw error;
    } finally {
      this.inflight.delete(jobId);
    }
  }
}

const queueRef = globalThis as typeof globalThis & { __scriptSpeechExportQueue?: ExportJobQueue };

function getQueue(): ExportJobQueue {
  if (!queueRef.__scriptSpeechExportQueue) {
    queueRef.__scriptSpeechExportQueue = new ExportJobQueue();
  }
  return queueRef.__scriptSpeechExportQueue;
}

export function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob> {
  return getQueue().enqueue(payload);
}

export function getExportJob(jobId: string): Promise<ExportJob | null> {
  return getQueue().getJob(jobId);
}

async function renderExport(payload: ExportQueuePayload): Promise<RenderedExportResult> {
  await wait(650 + Math.random() * 400);

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
