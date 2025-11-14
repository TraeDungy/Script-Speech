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

export interface ProjectRow {
  id: string;
  title: string;
  script_type: string;
  genre: string | null;
  logline: string | null;
  status: "outline" | "draft" | "polish" | "locked";
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  tags: string[] | null;
  target_length_unit: "pages" | "minutes" | "seconds" | null;
  target_length_value: number | null;
}

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "editor" | "member" | "viewer" | "admin";
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}
