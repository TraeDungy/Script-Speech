import type { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import type {
  AssetScanStatus,
  AssetStatus,
  AssetTranscodeStatus,
  CreateEntityAssetInput,
  CreateReferenceAssetInput,
  EntityAsset,
  EntityAssetTargetType,
  ReferenceAsset,
} from "@/lib/types/assets";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import {
  createMockReferenceAsset,
  findMockReferenceAsset,
  listMockEntityAssets,
  listMockReferenceAssets,
  recordMockAssetBinary,
  updateMockReferenceAsset,
  upsertMockEntityAsset,
} from "./mocks";
import type { EntityAssetRow, ReferenceAssetRow } from "./schema";

function mapReferenceAssetRow(row: ReferenceAssetRow): ReferenceAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type === "link" ? "external" : row.source_type,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    previewColor: row.preview_color,
    contentType: row.content_type,
    size: row.size,
    tags: row.tags ?? [],
    status: row.status,
    scanStatus: row.scan_status,
    transcodeStatus: row.transcode_status,
    processingProgress: row.processing_progress,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attribution: row.attribution,
  };
}

function mapEntityAssetRow(row: EntityAssetRow): EntityAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    assetId: row.asset_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    caption: row.caption,
    order: row.order,
    isPrivate: row.is_private,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchReferenceAssets(
  projectId?: string | null,
): Promise<ReferenceAsset[]> {
  if (!isSupabaseConfigured()) {
    return listMockReferenceAssets(projectId);
  }

  const supabase = getSupabaseClient();
  let query = supabase.from<ReferenceAssetRow>("reference_assets").select("*");

  if (projectId) {
    query = query.or(`project_id.eq.${projectId},project_id.is.null`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load reference assets", error);
    throw error;
  }

  return (data ?? []).map(mapReferenceAssetRow);
}

export async function fetchReferenceAsset(assetId: string): Promise<ReferenceAsset | null> {
  if (!isSupabaseConfigured()) {
    return findMockReferenceAsset(assetId) ?? null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ReferenceAssetRow>("reference_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to fetch reference asset", error);
    throw error;
  }

  return data ? mapReferenceAssetRow(data) : null;
}

export async function insertReferenceAsset(
  input: CreateReferenceAssetInput,
): Promise<ReferenceAsset> {
  if (!isSupabaseConfigured()) {
    return createMockReferenceAsset(input);
  }

  const supabase = getSupabaseClient();
  const payload = {
    id: randomUUID(),
    project_id: input.projectId ?? null,
    name: input.name,
    description: input.description ?? null,
    source_type: input.sourceType ?? (input.url ? "external" : "upload"),
    url: input.url ?? "",
    thumbnail_url: null as string | null,
    preview_color: null as string | null,
    content_type: input.contentType,
    size: input.size,
    tags: input.tags ?? [],
    status: "pending" as ReferenceAssetRow["status"],
    scan_status: "pending" as ReferenceAssetRow["scan_status"],
    transcode_status:
      (input.sourceType ?? (input.url ? "external" : "upload")) === "external"
        ? "ready"
        : ("pending" as ReferenceAssetRow["transcode_status"]),
    processing_progress:
      (input.sourceType ?? (input.url ? "external" : "upload")) === "external" ? 100 : 0,
    failure_code: null as string | null,
    failure_message: null as string | null,
    attribution: input.attribution ?? null,
  };

  const { data, error } = await supabase
    .from<ReferenceAssetRow>("reference_assets")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to insert reference asset", error);
    throw error;
  }

  return mapReferenceAssetRow(data);
}

export async function modifyReferenceAsset(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): Promise<ReferenceAsset | null> {
  if (!isSupabaseConfigured()) {
    return updateMockReferenceAsset(assetId, updates) ?? null;
  }

  const supabase = getSupabaseClient();
  const payload: Partial<ReferenceAssetRow> = {
    name: updates.name,
    description: updates.description ?? null,
    url: updates.url,
    thumbnail_url: updates.thumbnailUrl ?? null,
    preview_color: updates.previewColor ?? null,
    tags: updates.tags,
    status: updates.status,
    scan_status: updates.scanStatus,
    transcode_status: updates.transcodeStatus,
    processing_progress: updates.processingProgress ?? null,
    failure_code: updates.failureCode ?? null,
    failure_message: updates.failureMessage ?? null,
    attribution: updates.attribution ?? null,
  };

  const { data, error } = await supabase
    .from<ReferenceAssetRow>("reference_assets")
    .update(payload)
    .eq("id", assetId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update reference asset", error);
    throw error;
  }

  return data ? mapReferenceAssetRow(data) : null;
}

export async function persistAssetBinary(
  assetId: string,
  data: Buffer,
  contentType: string,
): Promise<ReferenceAsset | null> {
  if (!isSupabaseConfigured()) {
    return recordMockAssetBinary(assetId, data, contentType) ?? null;
  }

  const encoded = `data:${contentType};base64,${data.toString("base64")}`;
  const supabase = getSupabaseClient();

  const { data: row, error } = await supabase
    .from<ReferenceAssetRow>("reference_assets")
    .update({
      url: encoded,
      thumbnail_url: encoded,
      status: "ready",
      scan_status: "clean",
      transcode_status: "ready",
      processing_progress: 100,
      content_type: contentType,
      size: data.byteLength,
      failure_code: null,
      failure_message: null,
    })
    .eq("id", assetId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to store asset binary", error);
    throw error;
  }

  return row ? mapReferenceAssetRow(row) : null;
}

export async function fetchEntityAssets(
  projectId: string,
  options?: { includePrivate?: boolean },
): Promise<EntityAsset[]> {
  if (!isSupabaseConfigured()) {
    const assets = listMockEntityAssets(projectId);
    if (options?.includePrivate) {
      return assets;
    }
    return assets.filter((asset) => !asset.isPrivate);
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from<EntityAssetRow>("entity_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("order", { ascending: true });

  if (!options?.includePrivate) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load entity assets", error);
    throw error;
  }

  return (data ?? []).map(mapEntityAssetRow);
}

export async function updateReferenceAssetStatus(
  assetId: string,
  status: Partial<{
    status: AssetStatus;
    scanStatus: AssetScanStatus;
    transcodeStatus: AssetTranscodeStatus;
    processingProgress: number | null;
    failureCode: string | null;
    failureMessage: string | null;
    contentType: string;
    size: number;
    url: string | null;
    thumbnailUrl: string | null;
  }>,
): Promise<ReferenceAsset | null> {
  if (!isSupabaseConfigured()) {
    return updateMockReferenceAsset(assetId, {
      ...("url" in status ? { url: status.url ?? "" } : {}),
      ...("thumbnailUrl" in status ? { thumbnailUrl: status.thumbnailUrl ?? null } : {}),
      ...status,
    }) ?? null;
  }

  const supabase = getSupabaseClient();
  const payload: Partial<ReferenceAssetRow> = {};

  if (typeof status.status !== "undefined") {
    payload.status = status.status;
  }
  if (typeof status.scanStatus !== "undefined") {
    payload.scan_status = status.scanStatus;
  }
  if (typeof status.transcodeStatus !== "undefined") {
    payload.transcode_status = status.transcodeStatus;
  }
  if (Object.prototype.hasOwnProperty.call(status, "processingProgress")) {
    payload.processing_progress = status.processingProgress ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(status, "failureCode")) {
    payload.failure_code = status.failureCode ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(status, "failureMessage")) {
    payload.failure_message = status.failureMessage ?? null;
  }
  if (typeof status.contentType !== "undefined") {
    payload.content_type = status.contentType;
  }
  if (typeof status.size !== "undefined") {
    payload.size = status.size;
  }
  if (Object.prototype.hasOwnProperty.call(status, "url")) {
    payload.url = status.url ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(status, "thumbnailUrl")) {
    payload.thumbnail_url = status.thumbnailUrl ?? null;
  }

  const { data, error } = await supabase
    .from<ReferenceAssetRow>("reference_assets")
    .update(payload)
    .eq("id", assetId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update reference asset status", error);
    throw error;
  }

  return data ? mapReferenceAssetRow(data) : null;
}

export async function searchReferenceAssets(options: {
  projectId?: string | null;
  query?: string | null;
  tags?: string[];
  includePrivate?: boolean;
}): Promise<ReferenceAsset[]> {
  if (!isSupabaseConfigured()) {
    const results = listMockReferenceAssets(options.projectId);
    const filtered = results.filter((asset) => {
      if (options.query) {
        const q = options.query.toLowerCase();
        if (
          !asset.name.toLowerCase().includes(q) &&
          !(asset.description ?? "").toLowerCase().includes(q) &&
          !asset.tags.some((tag) => tag.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (options.tags?.length) {
        return options.tags.every((tag) => asset.tags.includes(tag));
      }
      return true;
    });
    return filtered;
  }

  const supabase = getSupabaseClient();
  let queryBuilder = supabase
    .from<ReferenceAssetRow>("reference_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.projectId) {
    queryBuilder = queryBuilder.or(
      `project_id.eq.${options.projectId},project_id.is.null`,
    );
  }

  if (options.query) {
    const q = options.query;
    queryBuilder = queryBuilder.or(
      `name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`,
    );
  }

  if (options.tags?.length) {
    queryBuilder = queryBuilder.contains("tags", options.tags);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error("Failed to search reference assets", error);
    throw error;
  }

  return (data ?? []).map(mapReferenceAssetRow);
}

export async function upsertEntityAssetRecord(
  input: CreateEntityAssetInput,
): Promise<EntityAsset> {
  if (!isSupabaseConfigured()) {
    return upsertMockEntityAsset(input);
  }

  const supabase = getSupabaseClient();
  const payload = {
    project_id: input.projectId,
    asset_id: input.assetId,
    entity_id: input.entityId,
    entity_type: input.entityType,
    caption: input.caption ?? null,
    order: input.order ?? 0,
    is_private: input.isPrivate ?? false,
  } satisfies Partial<EntityAssetRow> & {
    project_id: string;
    asset_id: string;
    entity_id: string;
    entity_type: EntityAssetTargetType;
  };

  const { data, error } = await supabase
    .from<EntityAssetRow>("entity_assets")
    .upsert(payload, { onConflict: "project_id,asset_id,entity_id,entity_type" })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to upsert entity asset", error);
    throw error;
  }

  return mapEntityAssetRow(data);
}
