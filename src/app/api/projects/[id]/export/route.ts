import { NextResponse } from "next/server";

import { enqueueExportJob } from "@/lib/exports";
import type { ExportFormat, ScriptDoc } from "@/lib/exports/types";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";

interface RequestBody {
  format?: ExportFormat;
  scriptDoc?: ExportQueuePayload["scriptDoc"];
  deliverToEmail?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.format || !body.scriptDoc) {
    recordApiError("projects/export", "POST", 400);
    return NextResponse.json(
      { error: "Both format and scriptDoc are required" },
      { status: 400 },
    );
  }

  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const rate = await enforceRateLimit({
      key: `${user.id}:${projectId}`,
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
            "Retry-After": Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            ).toString(),
          },
        },
      );
    }

    const job = await enqueueExportJob({
      projectId,
      format: body.format,
      scriptDoc: body.scriptDoc,
      deliverToEmail: body.deliverToEmail?.trim() || undefined,
    });

    await logAuditEvent({
      action: "export.job.enqueue",
      userId: user.id,
      projectId,
      targetId: job.id,
      details: { format: job.format, deliverToEmail: job.deliverToEmail ?? null },
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
    await captureApiException(error, {
      route: "projects/export",
      method: "POST",
      status: 500,
    });
    return NextResponse.json({ error: "Failed to enqueue export job" }, { status: 500 });
  }
}
