import { NextRequest, NextResponse } from "next/server";

import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { fetchLatestScriptDoc } from "@/lib/db/scriptDocs";
import { evaluatePromptGuardrails } from "@/lib/orchestrator/guardrails";
import { ScriptDocOrchestratorService } from "@/lib/orchestrator/scriptDocOrchestrator.server";
import {
  searchScriptDocEmbeddings,
  upsertScriptDocEmbeddings,
} from "@/lib/retrieval/referenceRetrieval.server";

const service = new ScriptDocOrchestratorService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const projectId = params.id;

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const [record, references, entityAssets] = await Promise.all([
      fetchLatestScriptDoc(projectId, { preferAutosave: true }),
      listReferenceAssets(projectId),
      listEntityAssets(projectId),
    ]);

    if (!record?.doc) {
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    const guardrailResult = evaluatePromptGuardrails({ prompt: body.prompt, doc: record.doc });
    if (!guardrailResult.allowed) {
      return NextResponse.json(
        { error: "Prompt violates guardrails", violations: guardrailResult.violations },
        { status: 400 },
      );
    }

    const docId = record.doc.revision?.id ?? `${projectId}-draft`;

    await upsertScriptDocEmbeddings({
      projectId,
      docId,
      doc: record.doc,
      referenceAssets: references,
      entityAssets,
    }).catch((error) => {
      console.error("Failed to sync embeddings", error);
    });

    const contextMatches = await searchScriptDocEmbeddings({
      projectId,
      docId,
      query: body.prompt,
      matchCount: 8,
    }).catch((error) => {
      console.error("Failed to search embeddings", error);
      return [];
    });

    const orchestration = await service.generate({
      doc: record.doc,
      prompt: body.prompt,
      contextMatches,
    });

    return NextResponse.json({
      plan: orchestration.plan,
      beats: orchestration.beats,
      scenes: orchestration.scenes,
      context: orchestration.context,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("ScriptDoc orchestration error", error);
    return NextResponse.json({ error: "Unable to orchestrate ScriptDoc" }, { status: 500 });
  }
}
