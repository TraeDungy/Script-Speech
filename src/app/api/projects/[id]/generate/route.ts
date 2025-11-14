import { NextResponse } from "next/server";

import { ScriptGenerationOrchestrator } from "@/lib/ai/orchestrator";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { fetchLatestScriptDoc } from "@/lib/db/scriptDocs";
import { recordApiError, captureApiException } from "@/lib/observability";
import { logAuditEvent } from "@/lib/auditLog";

interface GenerateRequestBody {
  instructions?: string;
  maxBeats?: number;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: GenerateRequestBody;

  try {
    body = await request.json();
  } catch {
    recordApiError("projects/generate", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const instructions = body.instructions?.trim() || undefined;
  const maxBeats = body.maxBeats;

  if (maxBeats !== undefined && (typeof maxBeats !== "number" || maxBeats <= 0)) {
    recordApiError("projects/generate", "POST", 400);
    return NextResponse.json({ error: "maxBeats must be a positive number" }, { status: 400 });
  }

  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const record = await fetchLatestScriptDoc(projectId, { preferAutosave: true });
    if (!record?.doc) {
      recordApiError("projects/generate", "POST", 404);
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    const orchestrator = new ScriptGenerationOrchestrator();
    const result = await orchestrator.generate({
      projectId,
      doc: record.doc,
      instructions,
      maxBeats,
    });

    await logAuditEvent({
      action: "ai.generate.script",
      userId: user.id,
      projectId,
      details: {
        instructionsLength: instructions?.length ?? 0,
        maxBeats: maxBeats ?? null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      recordApiError("projects/generate", "POST", 401);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      recordApiError("projects/generate", "POST", 403);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await captureApiException(error, {
      route: "projects/generate",
      method: "POST",
      status: 500,
    });
    console.error("Failed to generate script content", error);
    recordApiError("projects/generate", "POST", 500);
    return NextResponse.json({ error: "Failed to generate script content" }, { status: 500 });
  }
}
