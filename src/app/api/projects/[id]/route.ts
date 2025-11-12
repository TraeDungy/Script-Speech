import { NextRequest, NextResponse } from "next/server";

import {
  getProject,
  getStudioHydration,
  updateProject,
  type UpdateProjectInput,
} from "@/lib/db/projects";
import { fetchLatestScriptDoc, upsertScriptDoc } from "@/lib/db/scriptDocs";
import {
  listEntityAssets,
  listReferenceAssets,
  serializeEntityAsset,
  serializeReferenceAsset,
} from "@/lib/assets";
import type { ScriptDoc } from "@/lib/scriptDoc";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const projectId = params.id;

  try {
    const [project, scriptDoc, references, entityAssets] = await Promise.all([
      getProject(projectId),
      fetchLatestScriptDoc(projectId),
      listReferenceAssets(projectId),
      listEntityAssets(projectId),
    ]);

    if (!project && !scriptDoc) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project,
      scriptDoc,
      assets: {
        references: references.map(serializeReferenceAsset),
        entity: entityAssets.map(serializeEntityAsset),
      },
    });
  } catch (error) {
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

    const hydration = await getStudioHydration(projectId);
    return NextResponse.json(hydration);
  } catch (error) {
    console.error("Failed to update project", error);
    return NextResponse.json({ error: "Unable to update project" }, { status: 500 });
  }
}
