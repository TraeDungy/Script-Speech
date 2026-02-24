export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { getReferenceAsset } from "@/lib/assets";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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
      await ensureProjectMembership(asset.projectId, user.id);
    }

    const storage = getStorageProvider();
    const download = await storage.createSignedDownload({
      assetId: asset.id,
      contentType: asset.contentType,
      projectId: asset.projectId ?? undefined,
      fileName: asset.name,
    });

    return NextResponse.json({ download });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create download URL", error);
    return NextResponse.json({ error: "Unable to create download link" }, { status: 500 });
  }
}
