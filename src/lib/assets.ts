import { Buffer } from "buffer";
import { randomUUID } from "crypto";

export type AssetSourceType = "upload" | "external";

export type AssetStatus = "pending" | "ready";

export interface ReferenceAsset {
  id: string;
  projectId: string | null;
  name: string;
  description?: string;
  sourceType: AssetSourceType;
  url: string;
  thumbnailUrl: string | null;
  previewColor: string;
  contentType: string;
  size: number;
  tags: string[];
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
}

export type EntityAssetTargetType = "beat" | "scene";

export interface EntityAsset {
  id: string;
  projectId: string;
  assetId: string;
  entityId: string;
  entityType: EntityAssetTargetType;
  caption?: string;
  order: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredAssetBinary {
  data: string;
  contentType: string;
  size: number;
}

const referenceAssets = new Map<string, ReferenceAsset>();
const entityAssets = new Map<string, EntityAsset>();
const assetBinary = new Map<string, StoredAssetBinary>();

const fallbackThumbnails = [
  "linear-gradient(135deg, rgba(15,15,18,0.92), rgba(39,39,42,0.88))",
  "linear-gradient(135deg, rgba(24,24,27,0.9), rgba(63,63,70,0.82))",
  "linear-gradient(135deg, rgba(9,9,11,0.95), rgba(36,36,40,0.85))"
];

function computePreviewColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackThumbnails[hash % fallbackThumbnails.length];
}

export interface CreateReferenceAssetInput {
  name: string;
  projectId?: string | null;
  description?: string;
  contentType: string;
  size: number;
  tags?: string[];
  sourceType?: AssetSourceType;
  url?: string;
}

export interface CreateEntityAssetInput {
  projectId: string;
  assetId: string;
  entityId: string;
  entityType: EntityAssetTargetType;
  caption?: string;
  isPrivate?: boolean;
  order?: number;
}

export function listReferenceAssets(projectId?: string | null): ReferenceAsset[] {
  const values = Array.from(referenceAssets.values());
  if (!projectId) {
    return values;
  }

  return values.filter((asset) => asset.projectId === projectId || asset.projectId === null);
}

export function getReferenceAsset(assetId: string): ReferenceAsset | undefined {
  return referenceAssets.get(assetId);
}

export function createReferenceAsset(input: CreateReferenceAssetInput): ReferenceAsset {
  const id = randomUUID();
  const now = new Date().toISOString();
  const asset: ReferenceAsset = {
    id,
    projectId: input.projectId ?? null,
    name: input.name,
    description: input.description,
    sourceType: input.sourceType ?? (input.url ? "external" : "upload"),
    url: input.url ?? "",
    thumbnailUrl: null,
    previewColor: computePreviewColor(id),
    contentType: input.contentType,
    size: input.size,
    tags: input.tags ?? [],
    status: "pending",
    createdAt: now,
    updatedAt: now
  };

  referenceAssets.set(id, asset);
  return asset;
}

export function updateReferenceAsset(assetId: string, updates: Partial<ReferenceAsset>): ReferenceAsset | undefined {
  const existing = referenceAssets.get(assetId);
  if (!existing) {
    return undefined;
  }

  const updated: ReferenceAsset = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  referenceAssets.set(assetId, updated);
  return updated;
}

export function recordAssetBinary(assetId: string, data: Buffer, contentType: string): ReferenceAsset | undefined {
  const existing = referenceAssets.get(assetId);
  if (!existing) {
    return undefined;
  }

  const encoded = `data:${contentType};base64,${data.toString("base64")}`;
  assetBinary.set(assetId, {
    data: encoded,
    contentType,
    size: data.byteLength
  });

  const asset = updateReferenceAsset(assetId, {
    status: "ready",
    url: existing.url || encoded,
    thumbnailUrl: encoded,
    contentType,
    size: data.byteLength
  });

  return asset;
}

export function listEntityAssets(projectId: string): EntityAsset[] {
  return Array.from(entityAssets.values()).filter((item) => item.projectId === projectId);
}

export function createEntityAsset(input: CreateEntityAssetInput): EntityAsset {
  const id = randomUUID();
  const now = new Date().toISOString();
  const entity: EntityAsset = {
    id,
    projectId: input.projectId,
    assetId: input.assetId,
    entityId: input.entityId,
    entityType: input.entityType,
    caption: input.caption,
    order: input.order ?? 0,
    isPrivate: input.isPrivate ?? false,
    createdAt: now,
    updatedAt: now
  };

  entityAssets.set(id, entity);
  return entity;
}

export function findEntityAsset(assetId: string, entityId: string, entityType: EntityAssetTargetType): EntityAsset | undefined {
  return Array.from(entityAssets.values()).find(
    (item) => item.assetId === assetId && item.entityId === entityId && item.entityType === entityType
  );
}

export function upsertEntityAsset(input: CreateEntityAssetInput): EntityAsset {
  const existing = findEntityAsset(input.assetId, input.entityId, input.entityType);
  if (existing) {
    const updated: EntityAsset = {
      ...existing,
      caption: input.caption ?? existing.caption,
      order: input.order ?? existing.order,
      isPrivate: input.isPrivate ?? existing.isPrivate,
      updatedAt: new Date().toISOString()
    };

    entityAssets.set(existing.id, updated);
    return updated;
  }

  return createEntityAsset(input);
}

export function serializeReferenceAsset(asset: ReferenceAsset) {
  return {
    ...asset
  };
}

export function serializeEntityAsset(asset: EntityAsset) {
  return {
    ...asset
  };
}
