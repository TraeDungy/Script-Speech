import { NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { enqueueExportJob, getExportJob } from "@/lib/exports";
import type { ExportJob, ScriptDoc as ExportScriptDoc } from "@/lib/exports/types";
import { listExportJobsForUser } from "@/lib/db/exportJobs";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { ensureProjectMembership, ProjectAuthorizationError } from "@/lib/authz/projects.server";
import { recordBusinessEvent, withSpan } from "@/lib/observability";
import {
  REQUEST_ID_HEADER,
  createRequestLogger,
  getRequestIdFromHeaders,
} from "@/lib/requestContext";

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
  const requestId = getRequestIdFromHeaders(request.headers);
  const log = createRequestLogger(requestId);
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
    return await withSpan(
      {
        name: "api.exports.post",
        attributes: { route: "/api/exports", requestId, userId: user.id },
      },
      async (span) => {
        const supabase = getSupabaseServiceClient();
        if (!supabase) {
          return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
        }

        const fetchedDoc = body.scriptDocId ? await fetchScriptDoc(body.scriptDocId, user.id) : null;
        const scriptDocPayload = body.content ?? fetchedDoc?.doc ?? null;

        const projectId = extractProjectId(scriptDocPayload) ?? fetchedDoc?.projectId ?? null;
        if (projectId) {
          await ensureProjectMembership(projectId, user.id, { minimumRole: "viewer" });
        }

        if (!scriptDocPayload) {
          return NextResponse.json({ error: "ScriptDoc not found" }, { status: 404 });
        }

        const job = await enqueueExportJob({
          userId: user.id,
          projectId: projectId ?? user.id,
          scriptDoc: scriptDocPayload as ExportScriptDoc,
          format: body.format ?? "pdf",
          deliverToEmail: body.deliverToEmail,
        });

        span.setAttribute("export.jobId", job.id);
        span.setAttribute("export.format", job.format);

        recordBusinessEvent("export_jobs_enqueued_total", "Queued export jobs", {
          format: job.format,
          hasProject: Boolean(projectId),
        });

        return NextResponse.json(job, {
          status: 202,
          headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : {},
        });
      },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    log({ level: "error", message: "export.queue.failed", error, context: { requestId } });
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

export async function GET(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const log = createRequestLogger(requestId);
  const jobId = new URL(request.url).searchParams.get("id");

  try {
    const { user } = await requireServerAuthSession();
    if (jobId) {
      const job = await getExportJob(jobId);
      if (!job || (job.userId && job.userId !== user.id)) {
        return NextResponse.json({ error: "Export job not found" }, { status: 404 });
      }
      return NextResponse.json(job, { headers: { "Cache-Control": "no-cache, no-store" } });
    }

    const jobs = await listExportJobsForUser(user.id);
    return NextResponse.json(jobs, { headers: { "Cache-Control": "no-cache, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    log({ level: "error", message: "export.job.fetch.failed", error });
    return NextResponse.json({ error: "Failed to load export job" }, { status: 500 });
  }
}
