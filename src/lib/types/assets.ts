export type AssetSourceType = "upload" | "external";

export type AssetStatus = "pending" | "ready";

export interface ReferenceAsset {
  id: string;
  projectId: string | null;
  name: string;
  description?: string | null;
  sourceType: AssetSourceType;
  url: string;
  thumbnailUrl: string | null;
  previewColor: string | null;
  contentType: string;
  size: number;
  tags: string[];
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  attribution?: string | null;
}

export type EntityAssetTargetType = "beat" | "scene";

export interface EntityAsset {
  id: string;
  projectId: string;
  assetId: string;
  entityId: string;
  entityType: EntityAssetTargetType;
  caption?: string | null;
  order: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferenceAssetInput {
  name: string;
  projectId?: string | null;
  description?: string | null;
  contentType: string;
  size: number;
  tags?: string[];
  sourceType?: AssetSourceType;
  url?: string;
  attribution?: string | null;
}

export interface CreateEntityAssetInput {
  projectId: string;
  assetId: string;
  entityId: string;
  entityType: EntityAssetTargetType;
  caption?: string | null;
  isPrivate?: boolean;
  order?: number;
}
