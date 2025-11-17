import type { ExportJob, ExportQueuePayload } from "@/lib/exports/types";

export interface ExportJobRow {
  id: string;
  project_id: string;
  format: string;
  status: string;
  deliver_to_email?: string | null;
  script_doc: unknown;
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
export declare function fetchExportJobRecord(
  jobId: string,
  options?: { includeDownload?: boolean },
): Promise<ExportJob | null>;
export declare function listExportJobRecordsForProject(
  projectId: string,
  options?: { limit?: number; includeDownload?: boolean },
): Promise<ExportJob[]>;
export declare function listQueuedExportJobRows(limit: number): Promise<ExportJobRow[]>;
