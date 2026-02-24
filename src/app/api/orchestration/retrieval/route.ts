export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { ensureProjectMembership, ProjectAuthorizationError } from "@/lib/authz/projects.server";
import { fetchLatestScriptDoc } from "@/lib/db/scriptDocs";
import { getOrchestrationRetrievalService } from "@/lib/orchestrator/retrieval.service";

const retrievalService = getOrchestrationRetrievalService();

export async function POST(request: NextRequest) {
  let body: { projectId?: string; prompt?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.projectId || !body.prompt) {
    return NextResponse.json({ error: "projectId and prompt are required" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(body.projectId, user.id, { minimumRole: "member" });

    const record = await fetchLatestScriptDoc(body.projectId, { preferAutosave: true });
    if (!record?.doc) {
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    const docId = record.doc.revision?.id ?? `${body.projectId}-draft`;
    const assets = await retrievalService.loadProjectAssets(body.projectId);
    const context = await retrievalService.syncAndSearch(
      { projectId: body.projectId, docId, prompt: body.prompt, doc: record.doc },
      assets,
    );

    return NextResponse.json({
      docId,
      scriptDoc: context.scriptDoc,
      references: context.references,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Orchestration retrieval error", error);
    return NextResponse.json({ error: "Unable to load orchestration context" }, { status: 500 });
  }
}
