import { NextResponse } from "next/server";

import { enqueueExportJob, type ExportQueuePayload } from "@/lib/exports";
import type { ExportFormat } from "@/lib/exports/types";
import {
  captureApiException,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

interface RequestBody {
  format?: ExportFormat;
  scriptDoc?: ExportQueuePayload["scriptDoc"];
  deliverToEmail?: string;
}

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  recordApiRequest("projects/export", "POST");
  let body: RequestBody;

  try {
    body = await request.json();
  } catch (error) {
    recordApiError("projects/export", "POST", 400);
    console.error("Invalid JSON payload for export", error);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.format || !body.scriptDoc) {
    recordApiError("projects/export", "POST", 400);
    return NextResponse.json(
      { error: "Both format and scriptDoc are required" },
      { status: 400 },
    );
  }

  try {
    const job = await withSpan(
      {
        name: "api.projects.export.post",
        attributes: { projectId: params.id, format: body.format },
      },
      async (span) => {
        const payload: ExportQueuePayload = {
          projectId: params.id,
          format: body.format!,
          scriptDoc: body.scriptDoc!,
          deliverToEmail: body.deliverToEmail?.trim() || undefined,
        };
        const queued = await enqueueExportJob(payload);
        span.setAttribute("job.id", queued.id);
        span.setAttribute("job.status", queued.status);
        return queued;
      },
    );

    console.info("[api] queued export job", {
      jobId: job.id,
      projectId: params.id,
      format: job.format,
      deliverToEmail: job.deliverToEmail,
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    recordApiError("projects/export", "POST", 500);
    console.error("Failed to enqueue export job", error);
    await captureApiException(error, {
      route: "projects/export",
      method: "POST",
      status: 500,
    });
    return NextResponse.json({ error: "Failed to enqueue export job" }, { status: 500 });
  }
}
