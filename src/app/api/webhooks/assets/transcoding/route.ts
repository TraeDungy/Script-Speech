export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import {
  getReferenceAsset,
  serializeReferenceAsset,
  updateReferenceAssetLifecycle,
} from "@/lib/assets";
import type { AssetStatus, AssetTranscodeStatus } from "@/lib/types/assets";

export const runtime = "nodejs";

function assertAuthorized(request: NextRequest): boolean {
  const secret = process.env.ASSET_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }
  const headerSecret = request.headers.get("x-asset-webhook-secret");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!assertAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const assetId = typeof payload.assetId === "string" ? payload.assetId : null;
  const transcodeStatus =
    typeof payload.transcodeStatus === "string" ? payload.transcodeStatus : null;
  const progress = typeof payload.progress === "number" ? payload.progress : null;
  const outputUrl = typeof payload.outputUrl === "string" ? payload.outputUrl : null;
  const thumbnailUrl = typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl : null;
  const failureMessage =
    typeof payload.failureMessage === "string" ? payload.failureMessage : null;
  const failureCode = typeof payload.failureCode === "string" ? payload.failureCode : null;
  const size = typeof payload.size === "number" ? payload.size : null;
  const contentType =
    typeof payload.contentType === "string" ? payload.contentType : null;

  if (!assetId || !transcodeStatus) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const asset = await getReferenceAsset(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const normalisedStatus = transcodeStatus as AssetTranscodeStatus;
  let nextStatus: AssetStatus = asset.status;

  if (normalisedStatus === "ready") {
    nextStatus = asset.scanStatus === "clean" ? "ready" : "processing";
  } else if (normalisedStatus === "error") {
    nextStatus = "failed";
  } else {
    nextStatus = "processing";
  }

  const updated = await updateReferenceAssetLifecycle(assetId, {
    transcodeStatus: normalisedStatus,
    status: nextStatus,
    processingProgress: progress ?? undefined,
    failureCode: failureCode ?? null,
    failureMessage: failureMessage ?? null,
    url: outputUrl ?? undefined,
    thumbnailUrl: thumbnailUrl ?? undefined,
    size: size ?? undefined,
    contentType: contentType ?? undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ asset: serializeReferenceAsset(updated) });
}
