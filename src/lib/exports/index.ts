import { createExportJobRecord, fetchExportJobRecord, updateExportJobRecord } from "@/lib/db/exportJobs";
import type { ExportFormat, ExportJob, ScriptDoc } from "./types";

interface EnqueuePayload {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
}

interface RenderedExportResult {
  buffer: Buffer;
  extension: string;
  mime: string;
  notes?: string;
}

interface ExportJobResultRow {
  file_name: string;
  storage_path?: string | null;
  download_url?: string | null;
  notes?: string | null;
  mime_type?: string | null;
  size?: number | null;
}

interface ExportJobRow {
  id: string;
  project_id: string;
  format: ExportFormat;
  status: ExportJobStatus;
  deliver_to_email: string | null;
  created_at: string;
  updated_at: string;
  payload: {
    scriptDoc: ScriptDoc;
  } | null;
  result: ExportJobResultRow | null;
  error: string | null;
}

type SupabaseError = PostgrestError & { status?: number };

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY?.trim();
const SUPABASE_EXPORT_JOBS_TABLE =
  process.env.SUPABASE_EXPORT_JOBS_TABLE?.trim() ?? "export_jobs";
const SUPABASE_EXPORT_BUCKET =
  process.env.SUPABASE_EXPORT_BUCKET?.trim() ?? "exports";

const EXPORT_PROCESSOR_URL = process.env.EXPORT_PROCESSOR_URL?.trim();
const EXPORT_PROCESSOR_API_KEY = process.env.EXPORT_PROCESSOR_API_KEY?.trim();
const EXPORT_DELIVERY_EMAIL_ENDPOINT =
  process.env.EXPORT_DELIVERY_EMAIL_ENDPOINT?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim();
const EXPORT_EMAIL_SUBJECT =
  process.env.EXPORT_EMAIL_SUBJECT?.trim() ?? "Your Script Speech export is ready";

let supabaseServiceClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

const globalRef = globalThis as typeof globalThis & {
  __scriptSpeechLocalExportQueue?: LocalExportQueue;
};

export class ExportQueue {
  async enqueue(payload: EnqueuePayload): Promise<ExportJob> {
    const job = await createExportJobRecord(payload);

    setTimeout(() => {
      this.processJob(job.id, payload).catch((error) => {
        console.error("Export job failed", error);
      });

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
    lines.push(doc.title.toUpperCase());
    lines.push("");
  }

  if (doc.logline) {
    lines.push(doc.logline.trim());
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
    .split("\n");
}

export function scriptDocToFountain(doc: ScriptDoc): string {
  return scriptDocToLines(doc).join("\n").concat("\n");
}

export function scriptDocToFdx(doc: ScriptDoc): string {
  const escapeXml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const content = doc.scenes
    .map((scene) => {
      const action = scene.action ? `<Paragraph Type="Action">${escapeXml(scene.action)}</Paragraph>` : "";
      const dialogue = (scene.dialogue ?? [])
        .map((beat) => {
          const parenthetical = beat.parenthetical
            ? `<Parenthetical>${escapeXml(beat.parenthetical)}</Parenthetical>`
            : "";
          return `
            <Paragraph Type="Character">${escapeXml(beat.character)}</Paragraph>
            ${parenthetical}
            <Paragraph Type="Dialogue">${escapeXml(beat.text)}</Paragraph>
          `;
        })
        .join("");

      return `
        <Paragraph Type="Scene Heading">${escapeXml(scene.heading)}</Paragraph>
        ${action}
        ${dialogue}
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <FinalDraft DocumentType="Script" Template="Screenplay" Version="1">
    <Content>
      ${content}
    </Content>
  </FinalDraft>`;
}

async function scriptDocToDocx(doc: ScriptDoc): Promise<Buffer> {
  const lines = scriptDocToLines(doc);
  const contentTypes = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`,
    "utf8",
  );

  const rels = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`,
    "utf8",
  );

  const documentRels = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
    "utf8",
  );

  const paragraphs = lines
    .map((line) =>
      `<w:p><w:r><w:t xml:space="preserve">${line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`,
    )
    .join("");

  const documentXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${paragraphs}
        <w:sectPr>
          <w:pgSz w:w="12240" w:h="15840"/>
          <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
        </w:sectPr>
      </w:body>
    </w:document>`,
    "utf8",
  );

  return createStoredZip([
    { path: "[Content_Types].xml", content: contentTypes },
    { path: "_rels/.rels", content: rels },
    { path: "word/_rels/document.xml.rels", content: documentRels },
    { path: "word/document.xml", content: documentXml },
  ]);
}

async function scriptDocToPdf(doc: ScriptDoc): Promise<Buffer> {
  const lines = scriptDocToLines(doc);
  const header = "%PDF-1.4\n";
  const objects: Buffer[] = [];

  const addObject = (id: number, body: string | Buffer, options?: { stream?: boolean }) => {
    const prefix = Buffer.from(`${id} 0 obj\n`, "utf8");
    const suffix = Buffer.from("endobj\n", "utf8");
    let payload: Buffer;

    if (options?.stream && typeof body !== "string") {
      const header = Buffer.from(`<< /Length ${body.length} >>\nstream\n`, "utf8");
      const footer = Buffer.from("\nendstream\n", "utf8");
      payload = Buffer.concat([header, body, footer]);
    } else {
      const content = typeof body === "string" ? Buffer.from(body, "utf8") : body;
      payload = Buffer.concat([content, Buffer.from("\n", "utf8")]);
    }

    const objectBuffer = Buffer.concat([prefix, payload, suffix]);
    objects.push(objectBuffer);
  };

  const contentStreamLines = ["BT", "/F1 12 Tf", "14 TL", "72 720 Td"];
  let firstLine = true;
  for (const line of lines) {
    if (!firstLine) {
      contentStreamLines.push("T*");
    }
    firstLine = false;
    const escaped = line.replace(/([\\()])/g, "\\$1");
    contentStreamLines.push(`(${escaped}) Tj`);
  }
  contentStreamLines.push("ET");

  const contentBuffer = Buffer.from(contentStreamLines.join("\n"), "utf8");

  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  addObject(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  );
  addObject(4, contentBuffer, { stream: true });
  addObject(5, "<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Courier >>");

  const bodyBuffer = Buffer.concat(objects);
  const xrefOffset = header.length + bodyBuffer.length;
  const totalObjects = objects.length + 1;
  const xrefLines = ["xref", `0 ${totalObjects}`];
  xrefLines.push("0000000000 65535 f ");

  let cumulative = header.length;
  for (const object of objects) {
    const offset = cumulative;
    xrefLines.push(`${offset.toString().padStart(10, "0")} 00000 n `);
    cumulative += object.length;
  }

  const trailer = [
    "trailer",
    `<< /Size ${totalObjects} /Root 1 0 R >>`,
    "startxref",
    `${xrefOffset}`,
    "%%EOF",
  ].join("\n");

  return Buffer.concat([
    Buffer.from(header, "utf8"),
    bodyBuffer,
    Buffer.from(xrefLines.join("\n") + "\n", "utf8"),
    Buffer.from(trailer + "\n", "utf8"),
  ]);
}

type ZipEntry = { path: string; content: Buffer };

function createStoredZip(entries: ZipEntry[]): Buffer {
  const fileRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const fileName = Buffer.from(entry.path.replace(/\\/g, "/"), "utf8");
    const content = entry.content;
    const crc = crc32(content);
    const compressedSize = content.length;
    const uncompressedSize = content.length;
    const { time, date } = getDosDateTime(new Date());

    const localHeader = Buffer.alloc(30 + fileName.length);
    let cursor = 0;
    cursor = localHeader.writeUInt32LE(0x04034b50, cursor);
    cursor = localHeader.writeUInt16LE(20, cursor);
    cursor = localHeader.writeUInt16LE(0, cursor);
    cursor = localHeader.writeUInt16LE(0, cursor);
    cursor = localHeader.writeUInt16LE(time, cursor);
    cursor = localHeader.writeUInt16LE(date, cursor);
    cursor = localHeader.writeUInt32LE(crc >>> 0, cursor);
    cursor = localHeader.writeUInt32LE(compressedSize, cursor);
    cursor = localHeader.writeUInt32LE(uncompressedSize, cursor);
    cursor = localHeader.writeUInt16LE(fileName.length, cursor);
    cursor = localHeader.writeUInt16LE(0, cursor);
    fileName.copy(localHeader, cursor);

    fileRecords.push(localHeader, content);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    cursor = 0;
    cursor = centralHeader.writeUInt32LE(0x02014b50, cursor);
    cursor = centralHeader.writeUInt16LE(0x031e, cursor);
    cursor = centralHeader.writeUInt16LE(20, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt16LE(time, cursor);
    cursor = centralHeader.writeUInt16LE(date, cursor);
    cursor = centralHeader.writeUInt32LE(crc >>> 0, cursor);
    cursor = centralHeader.writeUInt32LE(compressedSize, cursor);
    cursor = centralHeader.writeUInt32LE(uncompressedSize, cursor);
    cursor = centralHeader.writeUInt16LE(fileName.length, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt16LE(0, cursor);
    cursor = centralHeader.writeUInt32LE(0, cursor);
    cursor = centralHeader.writeUInt32LE(offset, cursor);
    fileName.copy(centralHeader, cursor);

    centralRecords.push(centralHeader);

    offset += localHeader.length + content.length;
  });

  const centralDirectory = Buffer.concat(centralRecords);
  const centralSize = centralDirectory.length;
  const endRecord = Buffer.alloc(22);
  let cursor = 0;
  cursor = endRecord.writeUInt32LE(0x06054b50, cursor);
  cursor = endRecord.writeUInt16LE(0, cursor);
  cursor = endRecord.writeUInt16LE(0, cursor);
  cursor = endRecord.writeUInt16LE(entries.length, cursor);
  cursor = endRecord.writeUInt16LE(entries.length, cursor);
  cursor = endRecord.writeUInt32LE(centralSize, cursor);
  cursor = endRecord.writeUInt32LE(offset, cursor);
  cursor = endRecord.writeUInt16LE(0, cursor);

  return Buffer.concat([...fileRecords, centralDirectory, endRecord]);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    const tableIndex = (crc ^ byte) & 0xff;
    crc = CRC32_TABLE[tableIndex] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { date: number; time: number } {
  const year = date.getUTCFullYear();
  const dosYear = Math.max(1980, Math.min(2107, year)) - 1980;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosDate = (dosYear << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return { date: dosDate, time: dosTime };
}

class LocalExportQueue {
  private jobs = new Map<string, ExportJob & { scriptDoc: ScriptDoc }>();

  enqueue(payload: EnqueuePayload): ExportJob {
    const id = randomUUID();
    const now = new Date().toISOString();

    const job: ExportJob & { scriptDoc: ScriptDoc } = {
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
      this.process(job.id).catch((error) => {
        console.error("Local export processing failed", error);
      });
    }, 50);

    return this.strip(job);
  }

  get(jobId: string): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? this.strip(job) : undefined;
  }

  private async process(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = "processing";
    job.updatedAt = new Date().toISOString();

    try {
      const rendered = await renderExport({
        projectId: job.projectId,
        format: job.format,
        scriptDoc: job.scriptDoc,
        deliverToEmail: job.deliverToEmail,
      });

      const fileName = buildExportFileName(job.projectId, rendered.extension);
      job.result = {
        fileName,
        downloadUrl: createDataUrl(rendered.buffer, rendered.mime),
        notes: rendered.notes,
      };
      job.status = "completed";
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Export failed";
      job.updatedAt = new Date().toISOString();
    }
  }

  private strip(job: ExportJob & { scriptDoc: ScriptDoc }): ExportJob {
    const { scriptDoc: _scriptDoc, ...rest } = job;
    return rest;
  }
}

function getLocalExportQueue(): LocalExportQueue {
  if (!globalRef.__scriptSpeechLocalExportQueue) {
    globalRef.__scriptSpeechLocalExportQueue = new LocalExportQueue();
  }
  return globalRef.__scriptSpeechLocalExportQueue;
}

