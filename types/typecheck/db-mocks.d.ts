import type { ExportQueuePayload } from "@/lib/exports";
import type { ExportJobRow } from "./db-schema";

export function createMockExportJob(payload: ExportQueuePayload): ExportJobRow;
export function getMockExportJob(jobId: string): ExportJobRow | undefined;
export function upsertMockExportJob(row: ExportJobRow): void;
export function listMockExportJobs(): ExportJobRow[];
