import { NextRequest, NextResponse } from "next/server";

import {
  createProject,
  listProjects,
  type CreateProjectInput,
  type ListProjectsOptions,
} from "@/lib/db/projects";

export async function GET(request: NextRequest) {
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
  };

  try {
    const result = await listProjects(options);
    return NextResponse.json(result);
  } catch (error) {
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
    const project = await createProject({
      title: body.title,
      scriptType: body.scriptType,
      genre: body.genre ?? null,
      logline: body.logline ?? null,
      status: body.status,
      targetLength: body.targetLength,
      tags: body.tags ?? [],
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project", error);
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
