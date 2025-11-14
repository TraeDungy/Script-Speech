import { Buffer } from "node:buffer";

import type { ScriptDoc, ScriptScene, ScriptSceneElement } from "@/lib/scriptDoc";
import type { ExportFormat, ExportJob } from "./types";
import {
  createExportJobRecord,
  fetchExportJobRecord,
  fetchExportJobRow,
  updateExportJobRecord,
} from "@/lib/db/exportJobs";
import { isSupabaseConfigured } from "@/lib/db/config";

export type ExportQueuePayload = {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
};

interface RenderedExportResult {
  buffer: Buffer;
  extension: string;
  mime: string;
  notes?: string;
}

export async function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob> {
  const job = await createExportJobRecord(payload);

  if (!isSupabaseConfigured()) {
    await processExportJob(job.id);
  }

  return job;
}

export function getExportJob(jobId: string): Promise<ExportJob | null> {
  return fetchExportJobRecord(jobId);
}

export async function processExportJob(jobId: string): Promise<void> {
  const jobRow = await fetchExportJobRow(jobId);
  if (!jobRow) {
    throw new Error("Export job not found");
  }

  await updateExportJobRecord(jobId, { status: "processing" });

  try {
    const rendered = renderExport(jobRow.format, jobRow.script_doc);
    const fileName = buildFileName(jobRow.project_id, rendered.extension);
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
    throw error;
  }
}

export function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function renderExport(format: ExportFormat, doc: ScriptDoc): RenderedExportResult {
  switch (format) {
    case "fountain":
      return {
        buffer: Buffer.from(scriptDocToFountain(doc), "utf8"),
        extension: "fountain",
        mime: "text/plain;charset=utf-8",
        notes: "Converted to Fountain from ScriptDoc scenes.",
      };
    case "fdx":
      return {
        buffer: Buffer.from(scriptDocToFdx(doc), "utf8"),
        extension: "fdx",
        mime: "application/xml",
        notes: "Simplified Final Draft XML.",
      };
    case "pdf":
      return {
        buffer: scriptDocToPdf(doc),
        extension: "pdf",
        mime: "application/pdf",
        notes: "Lightweight PDF preview of ScriptDoc content.",
      };
    case "txt":
      return {
        buffer: Buffer.from(scriptDocToTxt(doc), "utf8"),
        extension: "txt",
        mime: "text/plain;charset=utf-8",
        notes: "Plain-text rendering of ScriptDoc scenes.",
      };
    default: {
      const unknownFormat: never = format;
      throw new Error(`Unsupported export format: ${unknownFormat}`);
    }
  }
}

function scriptDocToLines(doc: ScriptDoc): string[] {
  const lines: string[] = [];
  const title = doc.metadata?.title ?? "Untitled";
  lines.push(title.toUpperCase(), "");

  if (doc.metadata?.logline) {
    lines.push(doc.metadata.logline, "");
  }

  for (const scene of doc.scenes.slice().sort((a, b) => a.order - b.order)) {
    lines.push(formatSlugline(scene));
    if (scene.summary) {
      lines.push(scene.summary);
    }
    for (const element of scene.elements) {
      lines.push(...renderSceneElement(element));
    }
    lines.push("");
  }

  return lines;
}

function scriptDocToFountain(doc: ScriptDoc): string {
  return scriptDocToLines(doc).join("\n");
}

function scriptDocToTxt(doc: ScriptDoc): string {
  const header = [
    doc.metadata?.title ?? "Untitled",
    doc.metadata?.logline ?? "",
    doc.metadata?.genre ?? "",
  ]
    .filter(Boolean)
    .join(" | ");

  return [header, "", ...scriptDocToLines(doc)].join("\n");
}

function scriptDocToFdx(doc: ScriptDoc): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const paragraphs = doc.scenes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const slugline = `<Paragraph Type="Scene Heading">${escape(formatSlugline(scene))}</Paragraph>`;
      const body = scene.elements
        .map((element) => {
          switch (element.type) {
            case "action":
              return `<Paragraph Type=\"Action\">${escape(element.text)}</Paragraph>`;
            case "dialogue":
              return [
                `<Paragraph Type=\"Character\">${escape(element.speaker)}</Paragraph>`,
                element.parenthetical
                  ? `<Paragraph Type=\"Parenthetical\">(${escape(element.parenthetical)})</Paragraph>`
                  : "",
                `<Paragraph Type=\"Dialogue\">${escape(element.text)}</Paragraph>`,
              ].join("");
            case "transition":
              return `<Paragraph Type=\"Transition\">${escape(element.text)}</Paragraph>`;
            case "parenthetical":
              return `<Paragraph Type=\"Parenthetical\">(${escape(element.text)})</Paragraph>`;
            case "note":
              return `<Paragraph Type=\"Action\">[NOTE] ${escape(element.text)}</Paragraph>`;
            default:
              return "";
          }
        })
        .join("");
      return `${slugline}${body}`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="1">
  <Content>${paragraphs}</Content>
</FinalDraft>`;
}

function scriptDocToPdf(doc: ScriptDoc): Buffer {
  const text = scriptDocToFountain(doc);
  const body = text.replace(/\r?\n/g, "\\n");
  const pdf = `
%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length ${body.length + 33} >> stream
BT /F1 12 Tf 50 750 Td (${body}) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000061 00000 n 
0000000116 00000 n 
0000000223 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
${body.length + 290}
%%EOF`;
  return Buffer.from(pdf.trim(), "utf8");
}

function renderSceneElement(element: ScriptSceneElement): string[] {
  switch (element.type) {
    case "action":
      return [element.text];
    case "dialogue": {
      const lines = [element.speaker.toUpperCase()];
      if (element.parenthetical) {
        lines.push(`(${element.parenthetical})`);
      }
      lines.push(element.text);
      return lines;
    }
    case "parenthetical":
      return [`(${element.text})`];
    case "transition":
      return [element.text.toUpperCase()];
    case "note":
      return [`[NOTE${element.tone ? `:${element.tone}` : ""}] ${element.text}`];
    default:
      return [];
  }
}

function formatSlugline(scene: ScriptScene): string {
  return `${scene.slugline.setting}. ${scene.slugline.location} - ${scene.slugline.timeOfDay}`;
}

function createDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function buildFileName(projectId: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${projectId}-${timestamp}.${extension}`;
}
