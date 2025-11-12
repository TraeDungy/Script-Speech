import { NextRequest, NextResponse } from "next/server";
import {
  EntityAssetTargetType,
  listEntityAssets,
  serializeEntityAsset,
  serializeReferenceAsset,
  upsertEntityAsset,
  getReferenceAsset,
  listReferenceAssets
} from "@/lib/assets";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const [assets, references] = await Promise.all([
    listEntityAssets(projectId),
    listReferenceAssets(projectId),
  ]);

  return NextResponse.json({
    assets: assets.map(serializeEntityAsset),
    references: references.map(serializeReferenceAsset),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const body = await request.json();
  const { assetId, entityId, entityType, caption, order, isPrivate } = body;

  if (!assetId || !entityId || !entityType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!(await getReferenceAsset(assetId))) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (!isEntityTargetType(entityType)) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const entityAsset = await upsertEntityAsset({
    projectId,
    assetId,
    entityId,
    entityType,
    caption,
    order,
    isPrivate
  });

  return NextResponse.json({ asset: serializeEntityAsset(entityAsset) });
}

function isEntityTargetType(value: string): value is EntityAssetTargetType {
  return value === "beat" || value === "scene";
}
