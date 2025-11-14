import { NextRequest, NextResponse } from "next/server";

import {
  createProject,
  listProjects,
  type CreateProjectInput,
  type ListProjectsOptions,
} from "@/lib/db/projects";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { logAuditEvent } from "@/lib/auditLog";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

export async function GET(request: NextRequest) {
  recordApiRequest("projects", "GET");

  try {
    return await withSpan(
      { name: "api.projects.get", attributes: { route: "/api/projects" } },
      async (span) => {
        const { user } = await requireServerAuthSession();
        const { searchParams } = request.nextUrl;
        const limit = Number(searchParams.get("limit"));
        const cursor = searchParams.get("cursor") ?? undefined;
        const search = searchParams.get("search") ?? undefined;
        const status = searchParams.get("status") ?? undefined;

        const options: ListProjectsOptions = {
          limit: Number.isFinite(limit) ? limit : undefined,
          cursor,
          search,
          status: status as ListProjectsOptions["status"],
          userId: user.id,
        };

        span.setAttribute("project.query", {
          hasSearch: Boolean(search),
          status: options.status ?? "all",
        });

        const result = await listProjects(options);
        logStructuredEvent({
          level: "info",
          message: "projects.listed",
          context: { userId: user.id, total: result.total },
        });
        return NextResponse.json(result);
      },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      recordApiError("projects", "GET", 401);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    recordApiError("projects", "GET", 500);
    await captureApiException(error, { route: "projects", method: "GET", status: 500 });
    logStructuredEvent({ level: "error", message: "projects.list.failed", error });
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<CreateProjectInput>;
  try {
    body = await request.json();
  } catch {
    recordApiError("projects", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body?.title || !body?.scriptType) {
    recordApiError("projects", "POST", 400);
    return NextResponse.json(
      { error: "Both title and scriptType are required" },
      { status: 400 },
    );
  }

  recordApiRequest("projects", "POST");

  try {
    return await withSpan(
      { name: "api.projects.post", attributes: { route: "/api/projects" } },
      async (span) => {
        const { user } = await requireServerAuthSession();

        const project = await createProject({
          title: body.title,
          scriptType: body.scriptType,
          genre: body.genre ?? null,
          logline: body.logline ?? null,
          status: body.status,
          targetLength: body.targetLength,
          tags: body.tags ?? [],
          ownerId: user.id,
        });

        await logAuditEvent({
          action: "project.create",
          userId: user.id,
          projectId: project.id,
          details: { title: project.title, scriptType: project.scriptType },
          severity: "high",
        });

        span.setAttribute("project.id", project.id);
        logStructuredEvent({
          level: "info",
          message: "project.created",
          context: { projectId: project.id, ownerId: user.id },
        });
        return NextResponse.json({ project }, { status: 201 });
      },
    );
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
