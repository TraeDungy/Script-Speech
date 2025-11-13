import { NextRequest, NextResponse } from "next/server";

import {
  getReferenceAsset,
  serializeReferenceAsset,
  updateReferenceAssetLifecycle,
} from "@/lib/assets";
import type { AssetScanStatus, AssetStatus } from "@/lib/types/assets";

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
  const scanStatus = typeof payload.scanStatus === "string" ? payload.scanStatus : null;
  const failureMessage =
    typeof payload.failureMessage === "string" ? payload.failureMessage : undefined;

  if (!assetId || !scanStatus) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const asset = await getReferenceAsset(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const normalisedScanStatus = scanStatus as AssetScanStatus;
  let nextStatus: AssetStatus = asset.status;
  let failureCode: string | null = null;
  let failureMessageValue: string | null | undefined = failureMessage ?? null;

  if (normalisedScanStatus === "clean") {
    if (asset.transcodeStatus === "ready") {
      nextStatus = "ready";
    } else {
      nextStatus = "processing";
    }
    failureMessageValue = null;
  } else if (normalisedScanStatus === "infected") {
    nextStatus = "quarantined";
    failureCode = "scan_infected";
  } else if (normalisedScanStatus === "error") {
    nextStatus = "failed";
    failureCode = "scan_error";
  }

  const updated = await updateReferenceAssetLifecycle(assetId, {
    scanStatus: normalisedScanStatus,
    status: nextStatus,
    failureCode,
    failureMessage: failureMessageValue ?? null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ asset: serializeReferenceAsset(updated) });
}
