import type { Buffer } from "node:buffer";

import {
  fetchEntityAssets,
  fetchReferenceAsset,
  fetchReferenceAssets,
  insertReferenceAsset,
  modifyReferenceAsset,
  searchReferenceAssets,
  persistAssetBinary,
  upsertEntityAssetRecord,
  updateReferenceAssetStatus,
} from "@/lib/db/assets";
import type {
  CreateEntityAssetInput,
  CreateReferenceAssetInput,
  EntityAsset,
  ReferenceAsset,
} from "@/lib/types/assets";

export type { AssetSourceType, AssetStatus } from "@/lib/types/assets";
export type {
  CreateEntityAssetInput,
  CreateReferenceAssetInput,
  EntityAsset,
  ReferenceAsset,
} from "@/lib/types/assets";

export async function listReferenceAssets(
  projectId?: string | null,
): Promise<ReferenceAsset[]> {
  return fetchReferenceAssets(projectId);
}

export async function getReferenceAsset(
  assetId: string,
): Promise<ReferenceAsset | null> {
  return fetchReferenceAsset(assetId);
}

export async function createReferenceAsset(
  input: CreateReferenceAssetInput,
): Promise<ReferenceAsset> {
  return insertReferenceAsset(input);
}

export async function updateReferenceAsset(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): Promise<ReferenceAsset | null> {
  return modifyReferenceAsset(assetId, updates);
}

export async function updateReferenceAssetLifecycle(
  assetId: string,
  updates: Parameters<typeof updateReferenceAssetStatus>[1],
): Promise<ReferenceAsset | null> {
  return updateReferenceAssetStatus(assetId, updates);
}

export async function recordAssetBinary(
  assetId: string,
  data: Buffer,
  contentType: string,
): Promise<ReferenceAsset | null> {
  return persistAssetBinary(assetId, data, contentType);
}

export async function listEntityAssets(
  projectId: string,
  options?: { includePrivate?: boolean },
): Promise<EntityAsset[]> {
  return fetchEntityAssets(projectId, options);
}

export async function upsertEntityAsset(
  input: CreateEntityAssetInput,
): Promise<EntityAsset> {
  return upsertEntityAssetRecord(input);
}

export async function searchAssets(options: {
  projectId?: string | null;
  query?: string | null;
  tags?: string[];
  includePrivate?: boolean;
}): Promise<ReferenceAsset[]> {
  return searchReferenceAssets(options);
}

export function serializeReferenceAsset(asset: ReferenceAsset) {
  return { ...asset };
}

export function serializeEntityAsset(asset: EntityAsset) {
  return { ...asset };
}
