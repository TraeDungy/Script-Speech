import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  fetchProjectWithDoc,
  updateProjectWithDoc,
  type ScriptDocPayload,
} from "@/lib/projectsApi.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user } = await requireServerAuthSession();
    const result = await fetchProjectWithDoc(params.id, user.id);

    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Unable to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: { metadata?: Record<string, unknown>; title?: string; scriptDoc?: ScriptDocPayload };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    const result = await updateProjectWithDoc(params.id, user.id, {
      metadata: body.metadata,
      title: body.title,
      scriptDoc: body.scriptDoc,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Unable to update project" }, { status: 500 });
  }
}
