import { NextRequest, NextResponse } from "next/server";

import {
  getProject,
  getStudioHydration,
  updateProject,
  type UpdateProjectInput,
} from "@/lib/db/projects";
import {
  fetchLatestScriptDoc,
  upsertScriptDoc,
} from "@/lib/db/scriptDocs";
import {
  listEntityAssets,
  listReferenceAssets,
  serializeEntityAsset,
  serializeReferenceAsset,
} from "@/lib/assets";
import type { ScriptDoc } from "@/lib/scriptDoc";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { logAuditEvent } from "@/lib/auditLog";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id);

    const [project, scriptDocRecord, references, entityAssets] = await Promise.all([
      getProject(projectId),
      fetchLatestScriptDoc(projectId, { preferAutosave: true }),
      listReferenceAssets(projectId),
      listEntityAssets(projectId),
    ]);

    if (!project && !scriptDocRecord) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project,
      scriptDoc: scriptDocRecord?.doc ?? null,
      scriptDocSource: scriptDocRecord?.recordType ?? null,
      scriptDocVersion: scriptDocRecord?.versionNumber ?? null,
      assets: {
        references: references.map(serializeReferenceAsset),
        entity: entityAssets.map(serializeEntityAsset),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to load project", error);
    return NextResponse.json({ error: "Unable to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: {
    project?: UpdateProjectInput;
    scriptDoc?: ScriptDoc;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const updates: Array<Promise<unknown>> = [];
    if (body.project) {
      updates.push(updateProject(projectId, body.project));
    }
    if (body.scriptDoc) {
      updates.push(upsertScriptDoc(projectId, body.scriptDoc));
    }

    if (updates.length) {
      await Promise.all(updates);
    }

    if (body.project) {
      await logAuditEvent({
        action: "project.metadata.update",
        userId: user.id,
        projectId,
        details: body.project,
        severity: "high",
      });
    }

    if (body.scriptDoc) {
      await logAuditEvent({
        action: "project.scriptDoc.upsert",
        userId: user.id,
        projectId,
        details: {
          revisionId: body.scriptDoc.revision?.id ?? null,
          sceneCount: body.scriptDoc.scenes?.length ?? 0,
        },
        severity: "high",
      });
    }

    const hydration = await getStudioHydration(projectId);
    return NextResponse.json(hydration);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to update project", error);
    return NextResponse.json({ error: "Unable to update project" }, { status: 500 });
  }
}
