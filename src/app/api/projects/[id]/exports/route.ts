import { NextResponse } from "next/server";

import { enqueueExportJob, listProjectExportJobs } from "@/lib/exports";
import type { ExportFormat, ScriptDoc } from "@/lib/exports/types";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";
import { logStructuredEvent, recordApiError, recordApiRequest } from "@/lib/observability";

interface RequestBody {
  format?: ExportFormat;
  scriptDoc?: ScriptDoc;
  deliverToEmail?: string;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  recordApiRequest("projects/exports", "GET");
  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(params.id, user.id, { minimumRole: "member" });

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(100, Number.parseInt(limitParam, 10) || 20)) : 20;

    const jobs = await listProjectExportJobs(params.id, { limit, includeDownload: true });
    return NextResponse.json({ jobs });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list export jobs", error);
    recordApiError("projects/exports", "GET", 500);
    return NextResponse.json({ error: "Failed to list export jobs" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  recordApiRequest("projects/exports", "POST");
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    recordApiError("projects/exports", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.format || !body.scriptDoc) {
    recordApiError("projects/exports", "POST", 400);
    return NextResponse.json(
      { error: "Both format and scriptDoc are required" },
      { status: 400 },
    );
  }

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(params.id, user.id, { minimumRole: "member" });

    const rate = await enforceRateLimit({
      key: `${user.id}:${params.id}`,
      limit: 5,
      windowMs: 5 * 60 * 1000,
      prefix: "exports",
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Export rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString(),
          },
        },
      );
    }

    const job = await enqueueExportJob({
      projectId: params.id,
      format: body.format,
      scriptDoc: body.scriptDoc,
      deliverToEmail: body.deliverToEmail?.trim() || undefined,
    });

    await logAuditEvent({
      action: "export.job.enqueued",
      userId: user.id,
      projectId: params.id,
      targetId: job.id,
      details: { format: job.format, deliverToEmail: job.deliverToEmail ?? null },
    });
    logStructuredEvent({
      message: "export.job.enqueued",
      context: { jobId: job.id, projectId: params.id, format: job.format },
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to enqueue export job", error);
    recordApiError("projects/exports", "POST", 500);
    return NextResponse.json({ error: "Failed to enqueue export job" }, { status: 500 });
  }
}
