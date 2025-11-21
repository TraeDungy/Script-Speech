import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  createQueuedExportJob,
  getExportJobForUser,
  listExportJobsForUser,
  updateExportJobForUser,
} from "@/lib/exports/jobs";
import type { ExportJob } from "@/lib/exports/types";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/storage/config";
import { ensureProjectMembership, ProjectAuthorizationError } from "@/lib/authz/projects.server";

interface ExportRequestPayload {
  scriptDocId?: string;
  content?: unknown;
  format?: ExportJob["format"];
  deliverToEmail?: string;
}

function extractProjectId(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "metadata" in payload &&
    payload.metadata &&
    typeof payload.metadata === "object" &&
    "projectId" in payload.metadata &&
    typeof payload.metadata.projectId === "string"
  ) {
    return payload.metadata.projectId;
  }
  return null;
}

export async function POST(request: Request) {
  let body: ExportRequestPayload;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.scriptDocId && !body.content) {
    return NextResponse.json(
      { error: "Provide a scriptDocId or a content payload to export." },
      { status: 400 },
    );
  }

  const { user } = await requireServerAuthSession();
  try {
    const fetchedDoc = body.scriptDocId ? await fetchScriptDoc(body.scriptDocId, user.id) : null;
    const scriptDocPayload = body.content ?? fetchedDoc?.doc ?? null;

    const projectId = extractProjectId(scriptDocPayload) ?? fetchedDoc?.projectId ?? null;
    if (projectId) {
      await ensureProjectMembership(projectId, user.id, { minimumRole: "viewer" });
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
    }

    if (!scriptDocPayload) {
      return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
    }

    const job = await createQueuedExportJob({
      userId: user.id,
      projectId,
      scriptDocId: body.scriptDocId ?? null,
      scriptDoc: scriptDocPayload,
      format: body.format ?? "pdf",
      deliverToEmail: body.deliverToEmail,
    });

    void processJobArtifact(job, scriptDocPayload).catch((error) => {
      console.error("Failed to process export job", error);
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Unable to queue export job", error);
    return NextResponse.json({ error: "Unable to queue export job" }, { status: 500 });
  }
}

async function fetchScriptDoc(
  scriptDocId: string,
  userId: string,
): Promise<{ doc: unknown; projectId: string | null } | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("script_docs")
    .select("doc, user_id, project_id")
    .eq("id", scriptDocId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  if (data.user_id && data.user_id !== userId) {
    throw new UnauthorizedError();
  }

  if (data.project_id) {
    await ensureProjectMembership(data.project_id, userId, { minimumRole: "viewer" });
  }

  return { doc: data.doc, projectId: data.project_id ?? null };
}

async function processJobArtifact(job: ExportJob, content: unknown): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  if (!SUPABASE_STORAGE_BUCKET) {
    await updateExportJobForUser(job.id, job.userId ?? "", {
      status: "failed",
      error_message: "Storage bucket unavailable",
    });
    return;
  }

  await updateExportJobForUser(job.id, job.userId ?? "", { status: "processing" });

  try {
    const payloadBuffer = Buffer.from(JSON.stringify(content ?? {}, null, 2));
    const downloadPath = job.downloadPath ?? `exports/${job.userId ?? "anonymous"}/${job.id}.json`;

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(downloadPath, payloadBuffer, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    await updateExportJobForUser(job.id, job.userId ?? "", {
      status: "completed",
      download_path: downloadPath,
      error_message: null,
    });
  } catch (error) {
    await updateExportJobForUser(job.id, job.userId ?? "", {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Failed to render export",
    });
  }
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("id");

  try {
    const { user } = await requireServerAuthSession();
    if (!jobId) {
      const jobs = await listExportJobsForUser(user.id);
      return NextResponse.json(jobs, { headers: { "Cache-Control": "no-cache, no-store" } });
    }

    const job = await getExportJobForUser(jobId, user.id);

    if (!job) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    return NextResponse.json(job, { headers: { "Cache-Control": "no-cache, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Failed to load export job", error);
    return NextResponse.json({ error: "Failed to load export job" }, { status: 500 });
  }
}
