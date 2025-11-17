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
  recordApiRequest("projects/exports/[jobId]/download", "GET");
  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(params.id, user.id, { minimumRole: "member" });

    const job = await getExportJob(params.jobId, { includeDownload: true });
    if (!job || job.projectId !== params.id) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    if (!job.result?.downloadUrl) {
      return NextResponse.json({ error: "Job not ready" }, { status: 409 });
    }

    return NextResponse.json({
      url: job.result.downloadUrl,
      expiresAt: job.result.expiresAt ?? null,
      fileName: job.result.fileName,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to generate download", error);
    recordApiError("projects/exports/[jobId]/download", "GET", 500);
    return NextResponse.json({ error: "Failed to generate download" }, { status: 500 });
  }
}
