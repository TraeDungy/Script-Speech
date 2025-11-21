import type { ExportJob, ExportFormat, ScriptDoc } from "@/lib/exports/types";

export type ExportQueuePayload = {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
  userId?: string;
};

export declare function enqueueExportJob(payload: ExportQueuePayload): Promise<ExportJob>;
export declare function getExportQueue(): { enqueue(payload: ExportQueuePayload): Promise<ExportJob>; getJob(id: string): Promise<ExportJob | null> };
export declare function getExportJob(jobId: string): Promise<ExportJob | null>;
export declare function formatSseEvent(event: string, data: string): string;
