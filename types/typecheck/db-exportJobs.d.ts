import type { ExportQueuePayload } from "@/lib/exports";
import type { ExportJob, ExportFormat, ScriptDoc } from "@/lib/exports/types";

export interface ExportJobRow {
  id: string;
  project_id: string;
  format: ExportFormat;
  status: string;
  deliver_to_email?: string | null;
  script_doc: ScriptDoc;
  result?: unknown;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export declare function createExportJobRecord(payload: ExportQueuePayload): Promise<ExportJob>;
export declare function updateExportJobRecord(
  jobId: string,
  updates: Partial<{ status: string; result: unknown; error: string | null }>,
): Promise<void>;
export declare function fetchExportJobRecord(jobId: string): Promise<ExportJob | null>;
export declare function fetchExportJobRow(jobId: string): Promise<ExportJobRow | null>;
