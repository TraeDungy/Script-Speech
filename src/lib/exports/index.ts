import { randomUUID } from "crypto";
import type { ExportFormat, ExportJob } from "./types";

export interface ScriptDocDialogue {
  character: string;
  text: string;
  parenthetical?: string;
}

export interface ScriptDocScene {
  heading: string;
  action?: string;
  dialogue?: ScriptDocDialogue[];
}

export interface ScriptDoc {
  title?: string;
  logline?: string;
  scenes: ScriptDocScene[];
}

interface ExportJobInternal extends ExportJob {
  scriptDoc: ScriptDoc;
}

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
  private jobs = new Map<string, ExportJobInternal>();

  enqueue(payload: EnqueuePayload): ExportJob {
    const id = randomUUID();
    const now = new Date().toISOString();

    const job: ExportJobInternal = {
      id,
      projectId: payload.projectId,
      format: payload.format,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      deliverToEmail: payload.deliverToEmail,
      scriptDoc: payload.scriptDoc,
    };

    this.jobs.set(id, job);
    setTimeout(() => {
      this.processJob(id).catch((error) => {
        console.error("Export job failed", error);
      });
    }, 50);

    return this.toPublicJob(job);
  }

  getJob(jobId: string): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? this.toPublicJob(job) : undefined;
  }

  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = "processing";
    job.updatedAt = new Date().toISOString();

    try {
      const result = await this.generateResult(job);
      const fileName = `${job.projectId}-${job.id}.${result.extension}`;
      const downloadUrl = `data:${result.mime};base64,${Buffer.from(result.content, "utf8").toString("base64")}`;

      job.result = {
        fileName,
        downloadUrl,
        notes: result.notes,
      };
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unexpected export failure";
    }

    job.updatedAt = new Date().toISOString();
  }

  private async generateResult(job: ExportJobInternal): Promise<StubResult> {
    await wait(650 + Math.random() * 400);

    switch (job.format) {
      case "fountain": {
        const content = scriptDocToFountain(job.scriptDoc);
        return {
          content,
          extension: "fountain",
          mime: "text/plain;charset=utf-8",
          notes: "Generated directly from the ScriptDoc structure.",
        };
      }
      case "fdx":
        return generateStubDocument(job.format, job.scriptDoc, job.projectId, {
          mime: "application/xml",
          extension: "fdx",
        });
      case "docx":
        return generateStubDocument(job.format, job.scriptDoc, job.projectId, {
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          extension: "docx",
        });
      case "pdf":
        return generateStubDocument(job.format, job.scriptDoc, job.projectId, {
          mime: "application/pdf",
          extension: "pdf",
        });
      default:
        throw new Error(`Unsupported export format: ${job.format}`);
    }
  }

  private toPublicJob(job: ExportJobInternal): ExportJob {
    const { scriptDoc: _scriptDoc, ...rest } = job;
    return { ...rest };
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
