import type { CreateReferenceAssetInput, EntityAsset, ReferenceAsset } from "@/lib/db/assets";

export { CreateReferenceAssetInput, EntityAsset, ReferenceAsset };

export function listReferenceAssets(projectId?: string | null): Promise<ReferenceAsset[]>;
export function getReferenceAsset(assetId: string): Promise<ReferenceAsset | null>;
export function createReferenceAsset(input: CreateReferenceAssetInput): Promise<ReferenceAsset>;
export function recordAssetBinary(
  assetId: string,
  data: unknown,
  contentType: string,
): Promise<ReferenceAsset | null>;
export function updateReferenceAsset(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): Promise<ReferenceAsset | null>;
export function updateReferenceAssetLifecycle(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): Promise<ReferenceAsset | null>;
export function serializeReferenceAsset(asset: ReferenceAsset): ReferenceAsset;
export function searchAssets(input: {
  projectId?: string;
  query?: string | null;
  tags?: string[];
  includePrivate?: boolean;
}): Promise<ReferenceAsset[]>;
