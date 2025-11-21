import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { getExportJobForUser } from "@/lib/exports/jobs";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { STORAGE_SIGNED_URL_TTL_SECONDS, SUPABASE_STORAGE_BUCKET } from "@/lib/storage/config";

const TTL_SECONDS = STORAGE_SIGNED_URL_TTL_SECONDS;

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  try {
    const { user } = await requireServerAuthSession();
    const job = await getExportJobForUser(params.jobId, user.id);

    if (!job) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    if (job.status !== "succeeded" || !job.downloadPath) {
      return NextResponse.json({ error: "Export not ready" }, { status: 409 });
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase || !SUPABASE_STORAGE_BUCKET) {
      return NextResponse.json({ error: "Downloads are unavailable" }, { status: 503 });
    }

    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(job.downloadPath, TTL_SECONDS, {
        download: job.downloadPath.split("/").pop() ?? "export.json",
      });

    if (error || !data?.signedUrl) {
      console.error("Failed to sign download", error);
      return NextResponse.json({ error: "Unable to sign download" }, { status: 500 });
    }

    return NextResponse.json(
      { url: data.signedUrl, expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() },
      { headers: { "Cache-Control": "no-cache, no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to generate export download", error);
    return NextResponse.json({ error: "Failed to generate download" }, { status: 500 });
  }
}
