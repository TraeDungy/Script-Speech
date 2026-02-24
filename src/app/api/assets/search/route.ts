export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { searchAssets, serializeReferenceAsset } from "@/lib/assets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const query = request.nextUrl.searchParams.get("q");
  const tagsParam = request.nextUrl.searchParams.get("tags");
  const includePrivateParam = request.nextUrl.searchParams.get("includePrivate");

  try {
    const { user } = await requireServerAuthSession();

    if (projectId) {
      await ensureProjectMembership(projectId, user.id);
    }

    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined;

    const includePrivate = includePrivateParam === "true";

    const assets = await searchAssets({
      projectId: projectId ?? undefined,
      query,
      tags,
      includePrivate,
    });

    const filtered = includePrivate
      ? assets
      : assets.filter((asset) => asset.status !== "quarantined");

    return NextResponse.json({ assets: filtered.map(serializeReferenceAsset) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to search assets", error);
    return NextResponse.json({ error: "Unable to search assets" }, { status: 500 });
  }
}
