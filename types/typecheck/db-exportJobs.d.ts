import type { ExportQueuePayload } from "@/lib/exports";
import type { ExportJob } from "@/lib/exports/types";

export interface ExportJobRow {
  id: string;
  project_id: string;
  user_id?: string | null;
  format: string;
  status: string;
  deliver_to_email?: string | null;
  script_doc: unknown;
  result?: unknown;
  error?: string | null;
  storage_path?: string | null;
  created_at: string;
  updated_at: string;
}

export declare function createExportJobRecord(payload: ExportQueuePayload): Promise<ExportJob>;
export declare function updateExportJobRecord(
  jobId: string,
  updates: Partial<{
    status: string;
    result: unknown;
    error: string | null;
    storage_driver?: string | null;
    storage_bucket?: string | null;
    storage_path?: string | null;
  }>,
): Promise<void>;
export declare function fetchExportJobRecord(jobId: string): Promise<ExportJob | null>;
export declare function listExportJobsForProject(
  projectId: string,
  options?: { limit?: number },
): Promise<ExportJob[]>;
export declare function listExportJobsForUser(userId: string): Promise<ExportJob[]>;
