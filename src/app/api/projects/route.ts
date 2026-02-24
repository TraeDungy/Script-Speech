export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { logAuditEvent } from "@/lib/auditLog";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";
import {
  createProjectWithDoc,
  listProjectsForUser,
  type ScriptDocPayload,
} from "@/lib/projectsApi.server";

export async function GET(request: NextRequest) {
  recordApiRequest("projects", "GET");

  try {
    return await withSpan({ name: "api.projects.get" }, async () => {
      const { user } = await requireServerAuthSession();
      const limitParam = request.nextUrl.searchParams.get("limit");
      const limit = limitParam === null ? undefined : Number.parseInt(limitParam, 10);

      if (limitParam !== null && (!Number.isFinite(limit) || limit <= 0)) {
        recordApiError("projects", "GET", 400);
        return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
      }
      const projects = await listProjectsForUser(user.id, { limit });

      logStructuredEvent({
        level: "info",
        message: "projects.listed",
        context: { userId: user.id, total: projects.length },
      });

      return NextResponse.json({ projects });
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      recordApiError("projects", "GET", 401);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    recordApiError("projects", "GET", 500);
    await captureApiException(error, { route: "projects", method: "GET", status: 500 });
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: {
    title?: string;
    scriptType?: string;
    metadata?: Record<string, unknown>;
    scriptDoc?: ScriptDocPayload;
  };

  try {
    body = await request.json();
  } catch {
    recordApiError("projects", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body?.title || !body?.scriptType) {
    recordApiError("projects", "POST", 400);
    return NextResponse.json({ error: "Both title and scriptType are required" }, { status: 400 });
  }

  recordApiRequest("projects", "POST");

  try {
    const { user } = await requireServerAuthSession();

    const result = await createProjectWithDoc(user.id, {
      title: body.title,
      scriptType: body.scriptType,
      metadata: body.metadata ?? {},
      scriptDoc: body.scriptDoc,
    });

    await logAuditEvent({
      action: "project.create",
      userId: user.id,
      projectId: result.project.id,
      details: { title: result.project.title, scriptType: result.project.scriptType },
      severity: "high",
    });

    logStructuredEvent({
      level: "info",
      message: "project.created",
      context: { projectId: result.project.id, ownerId: user.id },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      recordApiError("projects", "POST", 401);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    recordApiError("projects", "POST", 500);
    await captureApiException(error, { route: "projects", method: "POST", status: 500 });
    logStructuredEvent({ level: "error", message: "project.create.failed", error });
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
