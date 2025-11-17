import type { ExportJob, ExportQueuePayload } from "@/lib/exports/types";

export declare function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob>;
export declare function getExportJob(
  jobId: string,
  options?: { includeDownload?: boolean },
): Promise<ExportJob | null>;
export declare function listProjectExportJobs(
  projectId: string,
  options?: { limit?: number; includeDownload?: boolean },
): Promise<ExportJob[]>;
export declare function processPendingExportJobs(limit?: number): Promise<{ processed: number; failures: number }>;
export declare function formatSseEvent(event: string, data: string): string;
