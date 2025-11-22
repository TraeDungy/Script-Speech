export type ExportFormat = "fountain" | "fdx" | "txt" | "rtf" | "docx" | "pdf";

export type ExportJobStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "completed";

export interface ExportJobResult {
  fileName: string;
  notes?: string;
  readyAt?: string;
  downloadUrl?: string;
  storageDriver?: "supabase" | "s3" | "local";
  storageBucket?: string;
  storagePath?: string;
  contentType?: string;
  size?: number;
  pageCount?: number;
  emailDelivery?: {
    status: "sent" | "queued" | "failed" | "skipped";
    to: string;
    detail?: string;
  };
}

export interface ExportJob {
  id: string;
  projectId?: string;
  userId?: string;
  scriptDocId?: string | null;
  draftVersionId?: string;
  format: ExportFormat;
  status: ExportJobStatus;
  createdAt: string;
  updatedAt: string;
  deliverToEmail?: string;
  result?: ExportJobResult;
  error?: string;
  errorMessage?: string | null;
  downloadPath?: string | null;
}

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
