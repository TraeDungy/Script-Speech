import { NextResponse } from "next/server";

import { formatSseEvent, getExportJob } from "@/lib/exports";
import {
  captureApiException,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

const STREAM_INTERVAL_MS = 1500;

type RouteContext = { params: { jobId: string } };

export async function GET(request: Request, { params }: RouteContext) {
  recordApiRequest("exports/job", "GET");
  const accepts = request.headers.get("accept") ?? "";
  const wantsStream = accepts.includes("text/event-stream");
  const jobId = params.jobId;

  if (!wantsStream) {
    try {
      const job = await withSpan(
        { name: "api.exports.job.get", attributes: { jobId } },
        async (span) => {
          const record = await getExportJob(jobId);
          if (record) {
            span.setAttribute("job.status", record.status);
          }
          return record;
        },
      );

      if (!job) {
        recordApiError("exports/job", "GET", 404);
        return NextResponse.json({ error: "Export job not found" }, { status: 404 });
      }

      return NextResponse.json(job);
    } catch (error) {
      recordApiError("exports/job", "GET", 500);
      console.error("Failed to fetch export job", error);
      await captureApiException(error, { route: "exports/job", method: "GET", status: 500 });
      return NextResponse.json({ error: "Failed to fetch export job" }, { status: 500 });
    }
  }

  let cancelled = false;
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
          const job = await getExportJob(jobId);
          if (!job) {
            controller.enqueue(
              encoder.encode(formatSseEvent("error", JSON.stringify({ message: "not-found" }))),
            );
            cleanup();
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode(formatSseEvent("job", JSON.stringify(job))));

          if (job.status === "completed" || job.status === "failed") {
            cleanup();
            controller.close();
          }
        } catch (error) {
          recordApiError("exports/job", "GET", 500);
          console.error("Failed to poll export job", error);
          void captureApiException(error, {
            route: "exports/job",
            method: "GET",
            status: 500,
          });
          controller.enqueue(
            encoder.encode(formatSseEvent("error", JSON.stringify({ message: "polling-failed" }))),
          );
          cleanup();
          controller.close();
        }
      };

      void pushEvent().then(() => {
        if (cancelled) {
          cleanup();
          return;
        }

        timer = setInterval(() => {
          void pushEvent();
        }, STREAM_INTERVAL_MS);
      });
    },
    cancel() {
      cancelled = true;
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
}
