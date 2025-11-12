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

export interface ScriptDocRow {
  id: string;
  project_id: string;
  doc: ScriptDoc;
  revision_id: string | null;
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
  status: "pending" | "ready";
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
  order: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExportJobRow {
  id: string;
  project_id: string;
  format: ExportFormat;
  status: ExportJobStatus;
  deliver_to_email: string | null;
  script_doc: ScriptDoc;
  result: {
    downloadUrl: string;
    fileName: string;
    notes?: string;
  } | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
