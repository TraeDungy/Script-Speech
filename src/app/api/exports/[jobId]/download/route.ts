export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { getExportJob } from "@/lib/exports";
import { recordExportDownload } from "@/lib/db/exportDownloads";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/storage/config";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  try {
    const { user } = await requireServerAuthSession();
    const job = await getExportJob(params.jobId);

    if (!job || (job.userId && job.userId !== user.id)) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    const directUrl = job.result?.downloadUrl;
    if (directUrl) {
      return NextResponse.json({ url: directUrl });
    }

    const bucket = job.result?.storageBucket ?? SUPABASE_STORAGE_BUCKET;
    const path = job.result?.storagePath ?? job.downloadPath;
    if (!bucket || !path) {
      const notReady = job.status === "queued" || job.status === "processing";
      return NextResponse.json(
        { error: notReady ? "Export is still processing" : "No downloadable artifact is available" },
        { status: notReady ? 409 : 404 },
      );
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
    }

    const expiresIn = 60 * 10; // 10 minutes
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "Unable to generate signed download URL" }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await recordExportDownload({ jobId: job.id, signedUrl: data.signedUrl, expiresAt, userId: user.id });

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to generate export download", error);
    return NextResponse.json({ error: "Unable to generate download link" }, { status: 500 });
  }
}
