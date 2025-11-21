import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { getExportJobForUser } from "@/lib/exports/jobs";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  try {
    const { user } = await requireServerAuthSession();
    const job = await getExportJobForUser(params.jobId, user.id);

    if (!job) {
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
