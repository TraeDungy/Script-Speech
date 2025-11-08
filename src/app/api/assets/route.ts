import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import {
  createReferenceAsset,
  getReferenceAsset,
  listReferenceAssets,
  recordAssetBinary,
  serializeReferenceAsset,
  updateReferenceAsset
} from "@/lib/assets";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const assetId = request.nextUrl.searchParams.get("assetId");

  if (assetId) {
    const asset = getReferenceAsset(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ asset: serializeReferenceAsset(asset) });
  }

  const assets = listReferenceAssets(projectId);
  return NextResponse.json({ assets: assets.map(serializeReferenceAsset) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, contentType, size, projectId, tags, sourceType, url } = body;

  if (!name || !contentType || typeof size !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const asset = createReferenceAsset({
    name,
    description,
    contentType,
    size,
    projectId,
    tags,
    sourceType,
    url
  });

  const storage = getStorageProvider();
  const signedUpload = await storage.createSignedUpload({
    assetId: asset.id,
    contentType,
    size,
    projectId
  });

  return NextResponse.json({
    asset: serializeReferenceAsset(asset),
    upload: signedUpload
  });
}

export async function PUT(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  const asset = getReferenceAsset(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? asset.contentType;
  const data = Buffer.from(await request.arrayBuffer());

  const updated = recordAssetBinary(assetId, data, contentType);
  if (!updated) {
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }

  return NextResponse.json({ asset: serializeReferenceAsset(updated) });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { assetId, updates } = body;

  if (!assetId || typeof updates !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const asset = updateReferenceAsset(assetId, updates);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ asset: serializeReferenceAsset(asset) });
}
