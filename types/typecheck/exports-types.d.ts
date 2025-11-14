import type { ScriptDoc } from "@/lib/scriptDoc";

export type ExportFormat = "fountain" | "fdx" | "pdf" | "txt";
export type ExportJobStatus = "queued" | "processing" | "completed" | "failed";

export interface ExportJobResult {
  downloadUrl: string;
  fileName: string;
  notes?: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: ExportFormat;
  status: ExportJobStatus;
  createdAt: string;
  updatedAt: string;
  deliverToEmail?: string;
  result?: ExportJobResult;
  error?: string;
}

export type { ScriptDoc };
