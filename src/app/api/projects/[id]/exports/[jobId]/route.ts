import { NextResponse } from "next/server";

import { getExportJob } from "@/lib/exports";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { recordApiError, recordApiRequest } from "@/lib/observability";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; jobId: string } },
): Promise<NextResponse> {
  recordApiRequest("projects/exports/[jobId]", "GET");
  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(params.id, user.id, { minimumRole: "member" });

    const job = await getExportJob(params.jobId, { includeDownload: true });
    if (!job || job.projectId !== params.id) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch export job", error);
    recordApiError("projects/exports/[jobId]", "GET", 500);
    return NextResponse.json({ error: "Failed to fetch export job" }, { status: 500 });
  }
}
