import { NextResponse } from "next/server";

import { enqueueExportJob } from "@/lib/exports";
import type { ExportFormat, ExportQueuePayload, ScriptDoc } from "@/lib/exports/types";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";
import { logStructuredEvent, recordApiError, recordApiRequest } from "@/lib/observability";

interface RequestBody extends Partial<ExportQueuePayload> {
  projectId?: string;
  format?: ExportFormat;
  scriptDoc?: ScriptDoc;
}

export async function POST(request: Request): Promise<NextResponse> {
  recordApiRequest("exports", "POST");
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    recordApiError("exports", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.projectId || !body.format || !body.scriptDoc) {
    recordApiError("exports", "POST", 400);
    return NextResponse.json(
      { error: "projectId, format, and scriptDoc are required" },
      { status: 400 },
    );
  }

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(body.projectId, user.id, { minimumRole: "member" });

    const rate = await enforceRateLimit({
      key: `${user.id}:${body.projectId}`,
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
      projectId: body.projectId,
      format: body.format,
      scriptDoc: body.scriptDoc,
      deliverToEmail: body.deliverToEmail?.trim() || undefined,
    });

    await logAuditEvent({
      action: "export.job.enqueued",
      userId: user.id,
      projectId: body.projectId,
      targetId: job.id,
      details: { format: job.format, deliverToEmail: job.deliverToEmail ?? null },
    });
    logStructuredEvent({
      message: "export.job.enqueued",
      context: { jobId: job.id, projectId: body.projectId, format: job.format },
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
    recordApiError("exports", "POST", 500);
    return NextResponse.json({ error: "Failed to enqueue export job" }, { status: 500 });
  }
}
