import type { Buffer } from "node:buffer";

import {
  fetchEntityAssets,
  fetchReferenceAsset,
  fetchReferenceAssets,
  insertReferenceAsset,
  modifyReferenceAsset,
  persistAssetBinary,
  upsertEntityAssetRecord,
} from "@/lib/db/assets";
import type {
  CreateEntityAssetInput,
  CreateReferenceAssetInput,
  EntityAsset,
  EntityAssetTargetType,
  ReferenceAsset,
} from "@/lib/types/assets";

export type { AssetSourceType, AssetStatus } from "@/lib/types/assets";
export type {
  CreateEntityAssetInput,
  CreateReferenceAssetInput,
  EntityAsset,
  EntityAssetTargetType,
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

export async function recordAssetBinary(
  assetId: string,
  data: Buffer,
  contentType: string,
): Promise<ReferenceAsset | null> {
  return persistAssetBinary(assetId, data, contentType);
}

export async function listEntityAssets(projectId: string): Promise<EntityAsset[]> {
  return fetchEntityAssets(projectId);
}

export async function upsertEntityAsset(
  input: CreateEntityAssetInput,
): Promise<EntityAsset> {
  return upsertEntityAssetRecord(input);
}

export function serializeReferenceAsset(asset: ReferenceAsset) {
  return { ...asset };
}

export function serializeEntityAsset(asset: EntityAsset) {
  return { ...asset };
}
