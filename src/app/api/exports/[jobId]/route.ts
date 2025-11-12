import { NextResponse } from "next/server";

import { getExportJob } from "@/lib/exports";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";

const STREAM_INTERVAL_MS = 1500;

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const { user } = await requireServerAuthSession();
    const initialJob = await getExportJob(params.jobId);

    if (!initialJob) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    await ensureProjectMembership(initialJob.projectId, user.id);

    const accepts = request.headers.get("accept") ?? "";
    const wantsStream = accepts.includes("text/event-stream");

    if (!wantsStream) {
      return NextResponse.json(initialJob);
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        const cleanup = () => {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        };

        const pushEvent = async () => {
          try {
            const job = await getExportJob(params.jobId);
            if (!job) {
              controller.enqueue(
                encoder.encode(formatSseEvent("error", JSON.stringify({ message: "not-found" }))),
              );
              cleanup();
              controller.close();
              return;
            }

            controller.enqueue(
              encoder.encode(formatSseEvent("job", JSON.stringify(job))),
            );

            if (job.status === "completed" || job.status === "failed") {
              cleanup();
              controller.close();
            }
          } catch (error) {
            console.error("Failed to poll export job", error);
            controller.enqueue(
              encoder.encode(formatSseEvent("error", JSON.stringify({ message: "polling-failed" }))),
            );
            cleanup();
            controller.close();
          }
        };

        void pushEvent().then(() => {
          timer = setInterval(() => {
            void pushEvent();
          }, STREAM_INTERVAL_MS);
        });
      },
      cancel() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to read export job", error);
    return NextResponse.json({ error: "Failed to read export job" }, { status: 500 });
  }
}

function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}
