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
