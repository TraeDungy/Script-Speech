import { createExportJobRecord, fetchExportJobRecord, updateExportJobRecord } from "@/lib/db/exportJobs";
import type { ExportFormat, ExportJob, ScriptDoc } from "./types";

interface EnqueuePayload {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
}

interface StubResult {
  content: string;
  extension: string;
  mime: string;
  notes?: string;
}

const globalRef = globalThis as typeof globalThis & {
  __scriptSpeechExportQueue?: ExportQueue;
};

export class ExportQueue {
  async enqueue(payload: EnqueuePayload): Promise<ExportJob> {
    const job = await createExportJobRecord(payload);

    setTimeout(() => {
      this.processJob(job.id, payload).catch((error) => {
        console.error("Export job failed", error);
      });
    }, 50);

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

export function scriptDocToFountain(doc: ScriptDoc): string {
  const lines: string[] = [];

  if (doc.title) {
    lines.push(doc.title.toUpperCase());
    lines.push("");
  }

  if (doc.logline) {
    lines.push(doc.logline);
    lines.push("");
  }

  for (const scene of doc.scenes) {
    lines.push(scene.heading.toUpperCase());
    lines.push("");

    if (scene.action) {
      lines.push(scene.action.trim());
      lines.push("");
    }

    for (const beat of scene.dialogue ?? []) {
      lines.push(beat.character.toUpperCase());
      if (beat.parenthetical) {
        lines.push(`(${beat.parenthetical})`);
      }
      lines.push(beat.text.trim());
      lines.push("");
    }

    if (!lines.at(-1)) {
      lines.push("");
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}

function generateStubDocument(
  format: ExportFormat,
  doc: ScriptDoc,
  projectId: string,
  meta: { extension: string; mime: string }
): StubResult {
  const summary = doc.scenes
    .map((scene, index) => `${index + 1}. ${scene.heading}`)
    .join("\n");

  const content = [
    `Stub ${format.toUpperCase()} export for project ${projectId}.`,
    "",
    "This placeholder simulates integration with a headless renderer or external export service.",
    "Replace this stub by wiring the queue to the rendering backend when available.",
    "",
    "Scene summary:",
    summary,
  ].join("\n");

  return {
    content,
    extension: meta.extension,
    mime: meta.mime,
    notes: "Stub content generated until the renderer service is connected.",
  };
}

function wait(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration));
}

export function getExportQueue() {
  if (!globalRef.__scriptSpeechExportQueue) {
    globalRef.__scriptSpeechExportQueue = new ExportQueue();
  }

  return globalRef.__scriptSpeechExportQueue;
}
