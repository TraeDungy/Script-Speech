export interface ExportJobRow {
  id: string;
  project_id: string;
  format: string;
  status: string;
  deliver_to_email?: string | null;
  script_doc: unknown;
  result?: {
    file_name: string;
    content_type?: string;
    storage_driver?: string;
    storage_bucket?: string;
    storage_path?: string;
    storage_key?: string;
    data_url?: string;
    notes?: string;
    size?: number;
  } | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
}
