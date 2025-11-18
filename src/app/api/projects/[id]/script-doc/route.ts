import { NextRequest, NextResponse } from "next/server";

import { fetchLatestScriptDoc, upsertScriptDoc } from "@/lib/db/scriptDocs";
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

    const record = await fetchLatestScriptDoc(projectId, { preferAutosave: true });
    if (!record) {
      return NextResponse.json({ error: "Script doc not found" }, { status: 404 });
    }

    return NextResponse.json({
      scriptDoc: record.doc,
      recordType: record.recordType,
      versionNumber: record.versionNumber,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to load script doc", error);
    return NextResponse.json({ error: "Unable to load script doc" }, { status: 500 });
  }
}

export async function PUT(
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

    const record = await upsertScriptDoc(projectId, body.doc);
    return NextResponse.json({ scriptDoc: record });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to persist script doc", error);
    return NextResponse.json({ error: "Unable to persist script doc" }, { status: 500 });
  }
}
