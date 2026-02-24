export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { parseToolAcknowledgement } from "@/lib/realtime/schema";
import { ProjectAuthorizationError } from "@/lib/authz/projects.server";
import { UnauthorizedError } from "@/lib/auth/server";
import {
  RateLimitExceededError,
  requireRealtimeContext,
} from "@/lib/orchestrator/middleware.server";
import {
  RealtimeOrchestratorError,
  getRealtimeOrchestratorService,
} from "@/lib/orchestrator/service.server";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export async function POST(request: NextRequest) {
  const orchestrator = getRealtimeOrchestratorService();

  try {
    const { userId } = await requireRealtimeContext();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const data = isPlainObject(payload) ? payload : {};
    const action = typeof data.action === "string" ? data.action : "session.create";

    if (action === "session.create") {
      const result = await orchestrator.createSession({
        userId,
        projectId: typeof data.projectId === "string" ? data.projectId : undefined,
        requestedSessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
      });

      return NextResponse.json(result, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (action === "transcript.append") {
      const acknowledgement = await orchestrator.appendTranscript({ payload: data, userId });
      return NextResponse.json({ acknowledgement }, { status: 200 });
    }

    if (action === "tool.invoke") {
      const acknowledgement = await orchestrator.invokeTool({ payload: data, userId });
      const status = acknowledgement.status === "accepted" ? 200 : 400;
      return NextResponse.json(acknowledgement, { status });
    }

    if (action === "transcript.fetch") {
      const sessionId = typeof data.sessionId === "string" ? data.sessionId : null;
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
      }

      const limit =
        typeof data.limit === "number" && Number.isFinite(data.limit) && data.limit > 0
          ? Math.min(500, Math.floor(data.limit))
          : 200;

      const transcripts = await orchestrator.fetchTranscripts({ sessionId, userId, limit });
      return NextResponse.json({ transcripts }, { status: 200 });
    }

    if (action === "ack.parse") {
      const acknowledgement = parseToolAcknowledgement(data.payload);
      if (!acknowledgement) {
        return NextResponse.json({ error: "Invalid acknowledgement payload" }, { status: 400 });
      }
      return NextResponse.json({ acknowledgement }, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": error.retryAfter.toString() },
        },
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error instanceof RealtimeOrchestratorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Realtime orchestrator error", error);
    return NextResponse.json({ error: "Unexpected orchestrator error" }, { status: 500 });
  }
}
