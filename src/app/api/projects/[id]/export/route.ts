import { NextResponse } from "next/server";

import { enqueueExportJob } from "@/lib/exports";
import type { ExportQueuePayload } from "@/lib/exports";
import type { ExportFormat, ScriptDoc } from "@/lib/exports/types";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

interface RequestBody {
  format?: ExportFormat;
  scriptDoc?: ExportQueuePayload["scriptDoc"];
  deliverToEmail?: string;
}

const ROUTE_ID = "projects/export";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  recordApiRequest(ROUTE_ID, "POST");
  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    recordApiError(ROUTE_ID, "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.format || !body.scriptDoc) {
    recordApiError(ROUTE_ID, "POST", 400);
    return NextResponse.json(
      { error: "Both format and scriptDoc are required" },
      { status: 400 },
    );
  }

  const projectId = params.id;

  return withSpan(
    {
      name: "api.projects.export.post",
      attributes: { projectId, format: body.format },
    },
    async (span) => {
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
          recordApiError(ROUTE_ID, "POST", 429);
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

        logStructuredEvent({
          level: "info",
          message: "export.job.enqueued",
          context: { jobId: job.id, projectId: job.projectId, format: job.format },
        });
        span.setAttribute("export.jobId", job.id);
        return NextResponse.json(job, { status: 202 });
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          recordApiError(ROUTE_ID, "POST", 401);
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error instanceof ProjectAuthorizationError) {
          recordApiError(ROUTE_ID, "POST", 403);
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        recordApiError(ROUTE_ID, "POST", 500);
        await captureApiException(error, {
          route: ROUTE_ID,
          method: "POST",
          status: 500,
        });
        return NextResponse.json({ error: "Failed to enqueue export job" }, { status: 500 });
      }
    },
  );
}
