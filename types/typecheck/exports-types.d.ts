export type ExportFormat = "fountain" | "fdx" | "docx" | "pdf";
export type ExportJobStatus = "queued" | "processing" | "succeeded" | "completed" | "failed";

export interface ExportJobResult {
  fileName: string;
  storageBucket?: string;
  storagePath?: string;
  storageDriver?: "supabase" | "s3" | "local";
  downloadUrl?: string;
  readyAt?: string;
  contentType?: string;
  size?: number;
  notes?: string;
}

export interface ExportJob {
  id: string;
  projectId?: string;
  userId?: string;
  scriptDocId?: string | null;
  draftVersionId?: string;
  format: ExportFormat;
  status: ExportJobStatus;
  downloadPath?: string | null;
  createdAt: string;
  updatedAt: string;
  deliverToEmail?: string;
  result?: ExportJobResult;
  error?: string;
}

export interface ScriptDoc {
  title?: string;
  logline?: string;
  scenes: Array<{ heading: string; action?: string; dialogue?: Array<{ character: string; text: string; parenthetical?: string }> }>;
}
