import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const queue = getExportQueue();
  const job = await queue.getJob(params.jobId);

const STREAM_INTERVAL_MS = 1500;

export async function GET(request: Request, { params }: { params: { jobId: string } }) {
  const accepts = request.headers.get("accept") ?? "";
  const wantsStream = accepts.includes("text/event-stream");

  if (!wantsStream) {
    const job = await getExportJob(params.jobId);
    if (!job) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

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
            closed = true;
            return;
          }

          controller.enqueue(encoder.encode(formatSseEvent("job", JSON.stringify(job))));

          if (job.status === "completed" || job.status === "failed") {
            cleanup();
            controller.close();
            closed = true;
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              formatSseEvent("error", JSON.stringify({ message: "polling-failed" })),
            ),
          );
          cleanup();
          controller.close();
          closed = true;
          console.error("Failed to poll export job", error);
        }
      };

      void pushEvent().then(() => {
        if (closed) {
          return;
        }

        timer = setInterval(() => {
          void pushEvent();
        }, STREAM_INTERVAL_MS);
      });
    },
    cancel() {
      cleanup();
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

function formatSseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}
