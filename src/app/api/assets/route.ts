import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";

import {
  createReferenceAsset,
  getReferenceAsset,
  listReferenceAssets,
  recordAssetBinary,
  serializeReferenceAsset,
  updateReferenceAsset,
  updateReferenceAssetLifecycle,
} from "@/lib/assets";
import type {
  AssetScanStatus,
  AssetStatus,
  AssetTranscodeStatus,
} from "@/lib/types/assets";
import {
  captureApiException,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";
import { getStorageProvider } from "@/lib/storage";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireServerAuthSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    const assetId = request.nextUrl.searchParams.get("assetId");

    if (assetId) {
      const asset = await getReferenceAsset(assetId);
      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      if (asset.projectId) {
        await ensureProjectMembership(asset.projectId, user.id);
      }

      return NextResponse.json({ asset: serializeReferenceAsset(asset) });
    }

    if (projectId) {
      await ensureProjectMembership(projectId, user.id);
    }

    const assets = await listReferenceAssets(projectId);
    return NextResponse.json({ assets: assets.map(serializeReferenceAsset) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list assets", error);
    return NextResponse.json({ error: "Unable to load assets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { name, description, contentType, size, projectId, tags, sourceType, url } = body;

  if (typeof name !== "string" || typeof contentType !== "string" || typeof size !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    if (typeof projectId === "string" && projectId) {
      await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });
    }

    const rate = await enforceRateLimit({
      key: `${user.id}:${projectId ?? "global"}:create`,
      limit: 20,
      windowMs: 60_000,
      prefix: "assets",
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Asset creation rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            ).toString(),
          },
        },
      );
    }

    const asset = await createReferenceAsset({
      name,
      description: typeof description === "string" ? description : undefined,
      contentType,
      size,
      projectId: typeof projectId === "string" ? projectId : null,
      tags: Array.isArray(tags) ? (tags as string[]) : undefined,
      sourceType: typeof sourceType === "string" ? sourceType : undefined,
      url: typeof url === "string" ? url : undefined,
    });

    await logAuditEvent({
      action: "asset.create",
      userId: user.id,
      projectId: asset.projectId ?? undefined,
      targetId: asset.id,
      details: { name: asset.name, contentType: asset.contentType, size: asset.size },
    });

    const storage = getStorageProvider();
    const signedUpload = await storage.createSignedUpload({
      assetId: asset.id,
      contentType,
      size,
      projectId: asset.projectId ?? undefined,
    });

    return NextResponse.json({
      asset: serializeReferenceAsset(asset),
      upload: signedUpload,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create asset", error);
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
    const { user } = await requireServerAuthSession();
    const asset = await getReferenceAsset(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (asset.projectId) {
      await ensureProjectMembership(asset.projectId, user.id, { minimumRole: "member" });
    }

    const contentTypeHeader = request.headers.get("content-type") ?? "";

    if (contentTypeHeader.startsWith("application/json")) {
      const payload = await request.json();
      const statusUpdates = payload.statusUpdates as Record<string, unknown> | undefined;
      if (!statusUpdates) {
        return NextResponse.json({ error: "Missing statusUpdates" }, { status: 400 });
      }

      const updated = await updateReferenceAssetLifecycle(assetId, {
        status:
          typeof statusUpdates.status === "string"
            ? (statusUpdates.status as AssetStatus)
            : undefined,
        scanStatus:
          typeof statusUpdates.scanStatus === "string"
            ? (statusUpdates.scanStatus as AssetScanStatus)
            : undefined,
        transcodeStatus:
          typeof statusUpdates.transcodeStatus === "string"
            ? (statusUpdates.transcodeStatus as AssetTranscodeStatus)
            : undefined,
        processingProgress:
          typeof statusUpdates.processingProgress === "number"
            ? statusUpdates.processingProgress
            : null,
        failureCode:
          typeof statusUpdates.failureCode === "string" ? statusUpdates.failureCode : null,
        failureMessage:
          typeof statusUpdates.failureMessage === "string"
            ? statusUpdates.failureMessage
            : null,
        contentType:
          typeof statusUpdates.contentType === "string"
            ? statusUpdates.contentType
            : undefined,
        size:
          typeof statusUpdates.size === "number"
            ? statusUpdates.size
            : undefined,
        url: typeof statusUpdates.url === "string" ? statusUpdates.url : undefined,
        thumbnailUrl:
          typeof statusUpdates.thumbnailUrl === "string"
            ? statusUpdates.thumbnailUrl
            : undefined,
      });

      if (!updated) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      await logAuditEvent({
        action: "asset.lifecycle.update",
        userId: user.id,
        projectId: updated.projectId ?? undefined,
        targetId: updated.id,
        details: statusUpdates,
      });

      return NextResponse.json({ asset: serializeReferenceAsset(updated) });
    }

    const rate = await enforceRateLimit({
      key: `${user.id}:${asset.projectId ?? "global"}:upload`,
      limit: 10,
      windowMs: 60_000,
      prefix: "assets",
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Asset upload rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            ).toString(),
          },
        },
      );
    }

    const contentType = contentTypeHeader || asset.contentType;
    const data = Buffer.from(await request.arrayBuffer());

    const updated = await recordAssetBinary(assetId, data, contentType);
    if (!updated) {
      return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
    }

    await logAuditEvent({
      action: "asset.binary.upload",
      userId: user.id,
      projectId: updated.projectId ?? undefined,
      targetId: updated.id,
      details: { contentType: updated.contentType, size: updated.size },
      severity: "high",
    });

    return NextResponse.json({ asset: serializeReferenceAsset(updated) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to upload asset", error);
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const assetId = typeof body.assetId === "string" ? body.assetId : undefined;
  const updates = body.updates as Record<string, unknown> | undefined;

  if (!assetId || !updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    const existing = await getReferenceAsset(assetId);
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (existing.projectId) {
      await ensureProjectMembership(existing.projectId, user.id, { minimumRole: "member" });
    }

    const updated = await updateReferenceAsset(assetId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await logAuditEvent({
      action: "asset.update",
      userId: user.id,
      projectId: updated.projectId ?? undefined,
      targetId: updated.id,
      details: updates,
    });

    return NextResponse.json({ asset: serializeReferenceAsset(updated) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to update asset metadata", error);
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }
}
