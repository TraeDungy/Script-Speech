import { NextRequest, NextResponse } from "next/server";

import {
  createProject,
  listProjects,
  type CreateProjectInput,
  type ListProjectsOptions,
} from "@/lib/db/projects";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { logAuditEvent } from "@/lib/auditLog";

export async function GET(request: NextRequest) {
  try {
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

    const result = await listProjects(options);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to list projects", error);
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<CreateProjectInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body?.title || !body?.scriptType) {
    return NextResponse.json(
      { error: "Both title and scriptType are required" },
      { status: 400 },
    );
  }

  try {
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

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create project", error);
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
