import type { ScriptDoc } from "@/lib/scriptDoc";
import type { EntityAssetTargetType } from "@/lib/types/assets";
import type { ExportFormat, ExportJobStatus } from "@/lib/exports/types";

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

export interface ScriptDocRow {
  id: string;
  project_id: string;
  doc: ScriptDoc;
  revision_id: string | null;
  record_type: "version" | "autosave";
  version_number: number | null;
  source_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftVersionRow {
  id: string;
  project_id: string;
  doc: ScriptDoc;
  summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BeatRow {
  id: string;
  project_id: string;
  script_doc_id: string | null;
  beat_id: string;
  title: string;
  summary: string | null;
  intent: string | null;
  order_index: number;
  duration_seconds: number | null;
  spotlight_character_ids: string[] | null;
  location_ids: string[] | null;
  reference_asset_ids: string[] | null;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface SceneRow {
  id: string;
  project_id: string;
  script_doc_id: string | null;
  scene_id: string;
  beat_id: string | null;
  title: string | null;
  summary: string | null;
  slugline: unknown;
  order_index: number;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface ReferenceAssetRow {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  source_type: "upload" | "external" | "link";
  url: string;
  thumbnail_url: string | null;
  preview_color: string | null;
  content_type: string;
  size: number;
  tags: string[] | null;
  status:
    | "pending"
    | "uploading"
    | "scanning"
    | "processing"
    | "ready"
    | "failed"
    | "quarantined";
  scan_status: "pending" | "clean" | "infected" | "error";
  transcode_status: "pending" | "queued" | "processing" | "ready" | "error";
  processing_progress: number | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
  attribution: string | null;
}

export interface EntityAssetRow {
  id: string;
  project_id: string;
  asset_id: string;
  entity_id: string;
  entity_type: EntityAssetTargetType;
  caption: string | null;
  order_index: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExportJobRow {
  id: string;
  project_id: string;
  draft_version_id: string | null;
  format: ExportFormat;
  status: ExportJobStatus;
  deliver_to_email: string | null;
  script_doc: ScriptDoc;
  result: {
    fileName: string;
    notes?: string;
    downloadUrl?: string;
    storageDriver?: string;
    storageBucket?: string;
    storagePath?: string;
    contentType?: string;
    size?: number;
    readyAt?: string;
  } | null;
  error: string | null;
  storage_driver: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportDownloadTokenRow {
  id: string;
  job_id: string;
  token: string;
  signed_url: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
}

export type MarketingContentStatus = "draft" | "published" | "archived";

export interface MarketingContentRow<T = unknown> {
  id: string;
  slug: string;
  data: T;
  status: MarketingContentStatus;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
