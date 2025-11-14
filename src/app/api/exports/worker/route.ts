import { NextResponse } from "next/server";

import { processExportJob } from "@/lib/exports";
import { recordApiError, captureApiException } from "@/lib/observability";

interface WorkerRequestBody {
  jobId?: string;
}

export async function POST(request: Request) {
  let body: WorkerRequestBody;

  try {
    body = await request.json();
  } catch {
    recordApiError("exports/worker", "POST", 400);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId) {
    recordApiError("exports/worker", "POST", 400);
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  try {
    await processExportJob(jobId);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      recordApiError("exports/worker", "POST", 404);
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    await captureApiException(error, {
      route: "exports/worker",
      method: "POST",
      status: 500,
    });
    console.error("Export worker failed", error);
    recordApiError("exports/worker", "POST", 500);
    return NextResponse.json({ error: "Failed to process export job" }, { status: 500 });
  }
}
