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
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const includePrivate = request.nextUrl.searchParams.get("includePrivate") === "true";
  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id);

    const [assets, references] = await Promise.all([
      listEntityAssets(projectId, { includePrivate }),
      listReferenceAssets(projectId),
    ]);

    return NextResponse.json({
      assets: assets.map(serializeEntityAsset),
      references: references.map(serializeReferenceAsset),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list project assets", error);
    return NextResponse.json({ error: "Unable to load assets" }, { status: 500 });
  }
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

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

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

    await logAuditEvent({
      action: "project.entityAsset.upsert",
      userId: user.id,
      projectId,
      targetId: entityAsset.id,
      details: { assetId, entityId, entityType },
    });

    return NextResponse.json({ asset: serializeEntityAsset(entityAsset) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to upsert entity asset", error);
    return NextResponse.json({ error: "Unable to update asset" }, { status: 500 });
  }
}

function isEntityTargetType(value: string): value is EntityAssetTargetType {
  return value === "beat" || value === "scene";
}
