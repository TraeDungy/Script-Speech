export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { getExportJob } from "@/lib/exports";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  try {
    const { user } = await requireServerAuthSession();
    const job = await getExportJob(params.jobId);

    if (!job || (job.userId && job.userId !== user.id)) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    return NextResponse.json(job, {
      headers: { "Cache-Control": "no-cache, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to read export job", error);
    return NextResponse.json({ error: "Failed to read export job" }, { status: 500 });
  }
}
