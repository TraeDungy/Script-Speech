import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import {
  createReferenceAsset,
  getReferenceAsset,
  listReferenceAssets,
  recordAssetBinary,
  serializeReferenceAsset,
  updateReferenceAsset,
} from "@/lib/assets";
import {
  captureApiException,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  recordApiRequest("assets", "GET");

  const projectId = request.nextUrl.searchParams.get("projectId");
  const assetId = request.nextUrl.searchParams.get("assetId");

  if (assetId) {
    try {
      const asset = await withSpan(
        { name: "api.assets.get-one", attributes: { assetId } },
        async (span) => {
          const record = await getReferenceAsset(assetId);
          if (record) {
            span.setAttribute("asset.projectId", record.projectId ?? "");
          }
          return record;
        },
      );

      if (!asset) {
        recordApiError("assets", "GET", 404);
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      return NextResponse.json({ asset: serializeReferenceAsset(asset) });
    } catch (error) {
      recordApiError("assets", "GET", 500);
      console.error("Failed to fetch reference asset", error);
      await captureApiException(error, { route: "assets", method: "GET", status: 500 });
      return NextResponse.json({ error: "Unable to load asset" }, { status: 500 });
    }
  }

  try {
    const assets = await withSpan(
      { name: "api.assets.list", attributes: { projectId: projectId ?? "all" } },
      async (span) => {
        const records = await listReferenceAssets(projectId);
        span.setAttribute("asset.count", records.length);
        return records;
      },
    );
    return NextResponse.json({ assets: assets.map(serializeReferenceAsset) });
  } catch (error) {
    recordApiError("assets", "GET", 500);
    console.error("Failed to list reference assets", error);
    await captureApiException(error, { route: "assets", method: "GET", status: 500 });
    return NextResponse.json({ error: "Unable to list assets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  recordApiRequest("assets", "POST");

  const body = await request.json();
  const { name, description, contentType, size, projectId, tags, sourceType, url } = body;

  if (!name || !contentType || typeof size !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { asset, upload } = await withSpan(
      { name: "api.assets.post", attributes: { route: "/api/assets" } },
      async (span) => {
        const created = await createReferenceAsset({
          name,
          description,
          contentType,
          size,
          projectId,
          tags,
          sourceType,
          url,
        });

        span.setAttribute("asset.id", created.id);
        span.setAttribute("asset.projectId", created.projectId ?? "");

        const storage = getStorageProvider();
        const signedUpload = await storage.createSignedUpload({
          assetId: created.id,
          contentType,
          size,
          projectId,
        });

        return { asset: created, upload: signedUpload };
      },
    );

    console.info("[api] created reference asset", { assetId: asset.id, projectId });

    return NextResponse.json({
      asset: serializeReferenceAsset(asset),
      upload,
    });
  } catch (error) {
    recordApiError("assets", "POST", 500);
    console.error("Failed to create reference asset", error);
    await captureApiException(error, { route: "assets", method: "POST", status: 500 });
    return NextResponse.json({ error: "Unable to create asset" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  recordApiRequest("assets", "PUT");

  const assetId = request.nextUrl.searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  try {
    const asset = await getReferenceAsset(assetId);
    if (!asset) {
      recordApiError("assets", "PUT", 404);
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? asset.contentType;
    const data = Buffer.from(await request.arrayBuffer());

    const updated = await withSpan(
      { name: "api.assets.put", attributes: { assetId } },
      async (span) => {
        const record = await recordAssetBinary(assetId, data, contentType);
        if (record) {
          span.setAttribute("asset.updated", true);
        }
        return record;
      },
    );

    if (!updated) {
      recordApiError("assets", "PUT", 500);
      return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
    }

    return NextResponse.json({ asset: serializeReferenceAsset(updated) });
  } catch (error) {
    recordApiError("assets", "PUT", 500);
    console.error("Failed to upload asset binary", error);
    await captureApiException(error, { route: "assets", method: "PUT", status: 500 });
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  recordApiRequest("assets", "PATCH");

  const body = await request.json();
  const { assetId, updates } = body;

  if (!assetId || typeof updates !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const asset = await withSpan(
      { name: "api.assets.patch", attributes: { assetId } },
      async (span) => {
        const record = await updateReferenceAsset(assetId, updates);
        if (record) {
          span.setAttribute("asset.updated", true);
        }
        return record;
      },
    );

    if (!asset) {
      recordApiError("assets", "PATCH", 404);
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ asset: serializeReferenceAsset(asset) });
  } catch (error) {
    recordApiError("assets", "PATCH", 500);
    console.error("Failed to update reference asset", error);
    await captureApiException(error, { route: "assets", method: "PATCH", status: 500 });
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }
}
