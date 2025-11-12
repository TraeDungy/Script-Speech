import { NextResponse } from "next/server";
import { getExportQueue } from "@/lib/exports";

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const queue = getExportQueue();
  const job = await queue.getJob(params.jobId);

  if (!job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
