import type { ScriptDoc } from "@/lib/scriptDoc";
import type { EntityAssetTargetType } from "@/lib/types/assets";
import type { ExportFormat, ExportJobStatus } from "@/lib/exports/types";
import type { Tables } from "./generated.types";

export type ProjectRow = Tables<"projects">;

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

type GeneratedScriptDocRow = Tables<"script_docs">;

export interface ScriptDocRow extends Omit<GeneratedScriptDocRow, "doc"> {
  doc: ScriptDoc;
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

type ExportJobRowResult = {
  downloadUrl: string;
  fileName: string;
  notes?: string;
};

type GeneratedExportJobRow = Tables<"export_jobs">;

export interface ExportJobRow
  extends Omit<GeneratedExportJobRow, "script_doc" | "result"> {
  script_doc: ScriptDoc;
  result: ExportJobRowResult | null;
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
