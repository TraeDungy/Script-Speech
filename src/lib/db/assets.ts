import type { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import type {
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
    order: row.order_index,
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
      content_type: contentType,
      size: data.byteLength,
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

export async function fetchEntityAssets(projectId: string): Promise<EntityAsset[]> {
  if (!isSupabaseConfigured()) {
    return listMockEntityAssets(projectId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<EntityAssetRow>("entity_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to load entity assets", error);
    throw error;
  }

  return (data ?? []).map(mapEntityAssetRow);
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
    order_index: input.order ?? 0,
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
