export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import {
  createScriptDocVersion,
  listScriptDocVersions,
} from "@/lib/db/scriptDocs";
import type { ScriptDoc } from "@/lib/scriptDoc";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const versions = await listScriptDocVersions(projectId, 20);

    return NextResponse.json({
      versions: versions.map((record) => ({
        id: record.id,
        versionNumber: record.versionNumber,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        doc: record.doc,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list versions", error);
    return NextResponse.json({ error: "Unable to list versions" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: { doc?: ScriptDoc };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.doc) {
    return NextResponse.json({ error: "Missing doc" }, { status: 400 });
  }

  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const record = await createScriptDocVersion(projectId, body.doc);

    return NextResponse.json({
      versionNumber: record.versionNumber,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      id: record.id,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create version", error);
    return NextResponse.json({ error: "Unable to create version" }, { status: 500 });
  }
}
