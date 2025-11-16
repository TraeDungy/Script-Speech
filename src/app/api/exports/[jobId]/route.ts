import { NextResponse } from "next/server";

import { getExportJob } from "@/lib/exports";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

const STREAM_INTERVAL_MS = 1500;

function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

const ROUTE_ID = "exports/job";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } },
) {
  recordApiRequest(ROUTE_ID, "GET");

  return withSpan(
    { name: "api.exports.job.get", attributes: { jobId: params.jobId } },
    async (span) => {
      try {
        const { user } = await requireServerAuthSession();
        const initialJob = await getExportJob(params.jobId);

        if (!initialJob) {
          recordApiError(ROUTE_ID, "GET", 404);
          return NextResponse.json({ error: "Export job not found" }, { status: 404 });
        }

        await ensureProjectMembership(initialJob.projectId, user.id);
        span.setAttribute("export.projectId", initialJob.projectId);

        const accepts = request.headers.get("accept") ?? "";
        const wantsStream = accepts.includes("text/event-stream");
        span.setAttribute("export.stream", wantsStream);

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
                logStructuredEvent({
                  level: "error",
                  message: "export.job.stream.failed",
                  error,
                  context: { jobId: params.jobId },
                });
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
          recordApiError(ROUTE_ID, "GET", 401);
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error instanceof ProjectAuthorizationError) {
          recordApiError(ROUTE_ID, "GET", 403);
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        recordApiError(ROUTE_ID, "GET", 500);
        await captureApiException(error, { route: ROUTE_ID, method: "GET", status: 500 });
        return NextResponse.json({ error: "Failed to read export job" }, { status: 500 });
      }
    },
  );
}
