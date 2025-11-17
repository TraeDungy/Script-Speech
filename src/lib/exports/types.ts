export type ExportFormat = "fountain" | "fdx" | "docx" | "pdf";

export type ExportJobStatus = "queued" | "processing" | "completed" | "failed";

export interface ExportJobResult {
  fileName: string;
  notes?: string;
  downloadUrl?: string;
  contentType?: string;
  expiresAt?: string;
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

export type ExportQueuePayload = {
  projectId: string;
  format: ExportFormat;
  scriptDoc: ScriptDoc;
  deliverToEmail?: string;
};

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
