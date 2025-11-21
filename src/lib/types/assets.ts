export type AssetSourceType = "upload" | "external";

export type AssetStatus =
  | "pending"
  | "uploading"
  | "scanning"
  | "processing"
  | "ready"
  | "failed"
  | "quarantined";

export type AssetScanStatus = "pending" | "clean" | "infected" | "error";

export type AssetTranscodeStatus =
  | "pending"
  | "queued"
  | "processing"
  | "ready"
  | "error";

export interface ReferenceAsset {
  id: string;
  projectId: string | null;
  name: string;
  description?: string | null;
  sourceType: AssetSourceType;
  url: string;
  storageKey?: string | null;
  thumbnailUrl: string | null;
  previewColor: string | null;
  contentType: string;
  size: number;
  tags: string[];
  beatTags?: string[];
  sceneTags?: string[];
  status: AssetStatus;
  scanStatus: AssetScanStatus;
  transcodeStatus: AssetTranscodeStatus;
  processingProgress: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
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
  beatTags?: string[];
  sceneTags?: string[];
  sourceType?: AssetSourceType;
  url?: string;
  storageKey?: string | null;
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
