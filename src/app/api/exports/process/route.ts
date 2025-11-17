import { NextResponse } from "next/server";

import { processPendingExportJobs } from "@/lib/exports";
import { captureApiException, recordApiError, recordApiRequest } from "@/lib/observability";

const WORKER_TOKEN = process.env.EXPORT_WORKER_TOKEN?.trim();

export async function POST(request: Request): Promise<NextResponse> {
  recordApiRequest("exports/process", "POST");
  if (WORKER_TOKEN) {
    const authorization = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${WORKER_TOKEN}`;
    if (authorization !== expected) {
      recordApiError("exports/process", "POST", 401);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(25, Number.parseInt(limitParam, 10) || 5)) : 5;

  try {
    const result = await processPendingExportJobs(limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Export worker failed", error);
    recordApiError("exports/process", "POST", 500);
    await captureApiException(error, { route: "exports/process", method: "POST", status: 500 });
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}
