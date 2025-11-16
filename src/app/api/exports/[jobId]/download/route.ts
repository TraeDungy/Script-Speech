import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { getExportJob } from "@/lib/exports";
import { logAuditEvent } from "@/lib/auditLog";
import { recordExportDownload } from "@/lib/db/exportDownloads";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN,
  STORAGE_SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/config";
import type { ExportJob } from "@/lib/exports/types";

const TTL_SECONDS = STORAGE_SIGNED_URL_TTL_SECONDS;

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const { user } = await requireServerAuthSession();
    const job = await getExportJob(params.jobId);

    if (!job) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    await ensureProjectMembership(job.projectId, user.id);

    if (job.status !== "completed" || !job.result) {
      return NextResponse.json({ error: "Export not ready" }, { status: 409 });
    }

    const signed = await createSignedDownload(job);

    await recordExportDownload({
      jobId: job.id,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
      userId: user.id,
    });

    await logAuditEvent({
      action: "export.job.download",
      userId: user.id,
      projectId: job.projectId,
      targetId: job.id,
      details: { format: job.format, fileName: job.result.fileName },
    });

    return NextResponse.redirect(signed.url);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to generate export download", error);
    return NextResponse.json({ error: "Failed to generate download" }, { status: 500 });
  }
}

async function createSignedDownload(job: ExportJob): Promise<{ url: string; expiresAt: string }> {
  if (job.result?.downloadUrl) {
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    return { url: job.result.downloadUrl, expiresAt };
  }

  if (job.result?.storageDriver === "supabase" && job.result.storageBucket && job.result.storagePath) {
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      throw new Error("Supabase storage client unavailable");
    }
    const { data, error } = await supabase.storage
      .from(job.result.storageBucket)
      .createSignedUrl(job.result.storagePath, TTL_SECONDS, {
        download: job.result.fileName,
      });
    if (error || !data?.signedUrl) {
      throw error ?? new Error("Failed to sign Supabase download");
    }
    const url = data.signedUrl;
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  }

  if (job.result?.storageDriver === "s3" && job.result.storageBucket && job.result.storagePath) {
    const client = getS3Client();
    if (!client) {
      throw new Error("S3 client unavailable");
    }
    const command = new GetObjectCommand({
      Bucket: job.result.storageBucket,
      Key: job.result.storagePath,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(job.result.fileName)}"`,
    });
    const url = await getSignedUrl(client, command, { expiresIn: TTL_SECONDS });
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  }

  throw new Error("Export artifact is missing download metadata");
}

let cachedS3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!S3_BUCKET || !S3_REGION) {
    return null;
  }

  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials:
        S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: S3_ACCESS_KEY_ID,
              secretAccessKey: S3_SECRET_ACCESS_KEY!,
              sessionToken: S3_SESSION_TOKEN,
            }
          : undefined,
    });
  }

  return cachedS3Client;
}
