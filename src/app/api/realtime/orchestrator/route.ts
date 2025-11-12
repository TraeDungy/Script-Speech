import { NextRequest, NextResponse } from "next/server";

import {
  TOOL_DEFINITIONS,
  parseToolAcknowledgement,
  parseToolInvocationPayload,
  type OrchestratorSessionMetadata,
  type ToolAcknowledgement,
  type TranscriptTurnDTO,
  validateToolInvocationPayload,
} from "@/lib/realtime/schema";
import {
  fetchSessionMetadata,
  fetchTranscriptTurns,
  persistProjectStatePatch,
  persistSessionMetadata,
  persistTranscriptTurn,
} from "@/lib/transcripts.server";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "@/lib/auditLog";

const DEFAULT_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-10";
const DEFAULT_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE ?? "verse";
const MODERATION_MODEL = process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

interface SessionCacheEntry {
  ackToken: string;
  projectId?: string;
  expiresAt?: string;
}

const sessionCache = new Map<string, SessionCacheEntry>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

async function ensureSessionCache(sessionId: string): Promise<SessionCacheEntry | null> {
  if (sessionCache.has(sessionId)) {
    return sessionCache.get(sessionId)!;
  }

  try {
    const metadata = await fetchSessionMetadata(sessionId);
    if (metadata?.ackToken) {
      const entry: SessionCacheEntry = {
        ackToken: metadata.ackToken,
        projectId: metadata.projectId,
        expiresAt: metadata.expiresAt,
      };
      sessionCache.set(sessionId, entry);
      return entry;
    }
  } catch (error) {
    console.warn("Failed to hydrate session cache from Supabase", error);
  }

  return null;
}

async function moderateText(text: string) {
  if (!text?.trim()) {
    return { flagged: false } as const;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { flagged: false } as const;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
    });

    if (!response.ok) {
      console.warn("Moderation request failed", response.status, await response.text());
      return { flagged: false } as const;
    }

    const payload = (await response.json()) as { results?: Array<{ flagged?: boolean }> };
    const flagged = Boolean(payload.results?.some((result) => result.flagged));
    return { flagged } as const;
  } catch (error) {
    console.warn("Moderation request error", error);
    return { flagged: false } as const;
  }
}

async function createRealtimeSession(body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? (payload.error as { message?: string }).message ?? "OpenAI realtime session error"
        : "Failed to create realtime session";
    throw new Error(message);
  }

  return payload as Record<string, unknown>;
}

function normalizeSessionMetadata(
  session: Record<string, unknown>,
  projectId: string | undefined,
  ackToken: string,
): OrchestratorSessionMetadata {
  const sessionId = typeof session.id === "string" ? session.id : crypto.randomUUID();
  const expiresAt = typeof session.expires_at === "string" ? session.expires_at : undefined;

  const metadata: OrchestratorSessionMetadata = {
    sessionId,
    ackToken,
    projectId,
    expiresAt,
    toolSchemas: TOOL_DEFINITIONS,
    transcripts: [],
  };

  sessionCache.set(sessionId, { ackToken, projectId, expiresAt });
  return metadata;
}

async function handleSessionCreate(
  request: NextRequest,
  payload: Record<string, unknown>,
  userId: string,
) {
  const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;
  const requestedSessionId = typeof payload.sessionId === "string" ? payload.sessionId : undefined;

  const session = await createRealtimeSession({
    model: DEFAULT_REALTIME_MODEL,
    voice: DEFAULT_REALTIME_VOICE,
    instructions:
      "Use update_project_state to synchronize ScriptDoc patches and log_transcript_turn to persist transcript updates.",
    tools: TOOL_DEFINITIONS.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    })),
  });

  const ackToken = crypto.randomUUID();
  const metadata = normalizeSessionMetadata(session, projectId, ackToken);
  if (requestedSessionId && requestedSessionId !== metadata.sessionId) {
    metadata.sessionId = requestedSessionId;
    sessionCache.set(requestedSessionId, {
      ackToken,
      projectId,
      expiresAt: metadata.expiresAt,
    });
  }

  try {
    await persistSessionMetadata({
      sessionId: metadata.sessionId,
      projectId,
      ackToken,
      expiresAt: metadata.expiresAt ?? null,
      rawSession: session,
      orchestratorSessionId: requestedSessionId ?? null,
    });
  } catch (error) {
    console.warn("Failed to persist realtime session metadata", error);
  }

  try {
    const existing = await fetchTranscriptTurns(metadata.sessionId, 200);
    metadata.transcripts = existing;
  } catch (error) {
    console.warn("Failed to hydrate transcript history", error);
  }

  await logAuditEvent({
    action: "realtime.session.create",
    userId,
    projectId,
    targetId: metadata.sessionId,
    details: { requestedSessionId, expiresAt: metadata.expiresAt },
  });

  return NextResponse.json(
    { session, metadata },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function parseTranscriptTurn(payload: unknown): TranscriptTurnDTO | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const id = typeof payload.id === "string" ? payload.id : null;
  const role = typeof payload.role === "string" ? payload.role : null;
  const text = typeof payload.text === "string" ? payload.text : null;
  const final = typeof payload.final === "boolean" ? payload.final : null;
  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : null;

  if (!id || !role || !text || final === null || !createdAt) {
    return null;
  }

  const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;

  return {
    id,
    role,
    text,
    final,
    createdAt,
    projectId,
  };
}

async function handleTranscriptAppend(payload: Record<string, unknown>, userId: string) {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  const ackToken = typeof payload.ackToken === "string" ? payload.ackToken : null;
  const turn = parseTranscriptTurn(payload.turn);

  if (!sessionId || !ackToken || !turn) {
    return NextResponse.json({ error: "Invalid transcript payload" }, { status: 400 });
  }

  const entry = (await ensureSessionCache(sessionId)) ?? undefined;
  if (!entry || entry.ackToken !== ackToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { flagged } = await moderateText(turn.text);
  if (flagged) {
    return NextResponse.json({ error: "Transcript failed moderation" }, { status: 400 });
  }

  const projectId = turn.projectId ?? entry.projectId;
  if (projectId) {
    await ensureProjectMembership(projectId, userId, { minimumRole: "member" });
  }

  try {
    await persistTranscriptTurn({ ...turn, sessionId, projectId });
  } catch (error) {
    console.warn("Failed to persist transcript turn", error);
    return NextResponse.json({ error: "Unable to persist transcript" }, { status: 500 });
  }

  await logAuditEvent({
    action: "transcript.turn.append",
    userId,
    projectId: projectId ?? undefined,
    targetId: turn.id,
    details: { role: turn.role, final: turn.final },
  });

  return NextResponse.json(
    {
      acknowledgement: {
        requestId: turn.id,
        status: "accepted",
        timestamp: new Date().toISOString(),
        transcriptTurn: { ...turn, sessionId },
      } satisfies ToolAcknowledgement,
    },
    { status: 200 },
  );
}

async function dispatchToolInvocation(
  payload: Record<string, unknown>,
  userId: string,
): Promise<NextResponse<ToolAcknowledgement | { error: string }>> {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  const ackToken = typeof payload.ackToken === "string" ? payload.ackToken : null;
  const rawInvocation = payload.invocation;

  if (!sessionId || !ackToken || !rawInvocation) {
    return NextResponse.json({ error: "Invalid tool invocation" }, { status: 400 });
  }

  const entry = await ensureSessionCache(sessionId);
  if (!entry || entry.ackToken !== ackToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invocation = parseToolInvocationPayload(rawInvocation);
  if (!invocation) {
    return NextResponse.json({ error: "Malformed tool invocation" }, { status: 400 });
  }

  invocation.sessionId = sessionId;
  invocation.projectId = typeof payload.projectId === "string" ? payload.projectId : entry.projectId;

  if (invocation.projectId) {
    await ensureProjectMembership(invocation.projectId, userId, { minimumRole: "member" });
  }

  const validationErrors = validateToolInvocationPayload(invocation);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join("; ") }, { status: 400 });
  }

  const acknowledgement: ToolAcknowledgement = {
    requestId: invocation.callId,
    status: "accepted",
    timestamp: new Date().toISOString(),
  };

  if (invocation.name === "log_transcript_turn") {
    const turn = parseTranscriptTurn(invocation.arguments);
    if (!turn) {
      return NextResponse.json({ error: "Invalid transcript payload" }, { status: 400 });
    }

    const { flagged } = await moderateText(turn.text);
    if (flagged) {
      acknowledgement.status = "rejected";
      acknowledgement.reason = "Transcript failed moderation";
      return NextResponse.json(acknowledgement, { status: 400 });
    }

    const projectId = turn.projectId ?? invocation.projectId;
    try {
      await persistTranscriptTurn({ ...turn, sessionId, projectId });
      acknowledgement.transcriptTurn = { ...turn, sessionId };
    } catch (error) {
      console.warn("Failed to persist transcript turn", error);
      return NextResponse.json({ error: "Unable to persist transcript" }, { status: 500 });
    }

    await logAuditEvent({
      action: "transcript.turn.append",
      userId,
      projectId: projectId ?? undefined,
      targetId: turn.id,
      details: { role: turn.role, final: turn.final },
    });

    return NextResponse.json(acknowledgement, { status: 200 });
  }

  if (invocation.name === "update_project_state") {
    const patch = isPlainObject(invocation.arguments) ? invocation.arguments.patch ?? invocation.arguments : null;
    if (!patch || !isPlainObject(patch)) {
      return NextResponse.json({ error: "Invalid project state patch" }, { status: 400 });
    }

    const reason = isPlainObject(invocation.arguments) && typeof invocation.arguments.reason === "string"
      ? invocation.arguments.reason
      : undefined;

    try {
      await persistProjectStatePatch({
        sessionId,
        projectId: invocation.projectId,
        patch,
        reason,
      });
      acknowledgement.projectStatePatch = patch;
    } catch (error) {
      console.warn("Failed to persist project state patch", error);
      return NextResponse.json({ error: "Unable to persist project state" }, { status: 500 });
    }

    await logAuditEvent({
      action: "project.state.patch",
      userId,
      projectId: invocation.projectId ?? undefined,
      targetId: sessionId,
      details: { reason },
      severity: "high",
    });

    return NextResponse.json(acknowledgement, { status: 200 });
  }

  acknowledgement.status = "rejected";
  acknowledgement.reason = `Unsupported tool: ${invocation.name}`;
  return NextResponse.json(acknowledgement, { status: 400 });
}

async function handleTranscriptFetch(payload: Record<string, unknown>, userId: string) {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const entry = await ensureSessionCache(sessionId);
    if (entry?.projectId) {
      await ensureProjectMembership(entry.projectId, userId);
    }

    const transcripts = await fetchTranscriptTurns(sessionId, 200);
    return NextResponse.json({ transcripts }, { status: 200 });
  } catch (error) {
    console.warn("Failed to load transcripts", error);
    return NextResponse.json({ error: "Unable to load transcripts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireServerAuthSession();
    const rate = await enforceRateLimit({
      key: user.id,
      limit: 120,
      windowMs: 60_000,
      prefix: "realtime:orchestrator",
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            ).toString(),
          },
        },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const data = isPlainObject(payload) ? payload : {};
    const action = typeof data.action === "string" ? data.action : "session.create";

    if (action === "session.create") {
      if (typeof data.projectId === "string") {
        await ensureProjectMembership(data.projectId, user.id, { minimumRole: "member" });
      }

      try {
        return await handleSessionCreate(request, data, user.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create session";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    if (action === "transcript.append") {
      return handleTranscriptAppend(data, user.id);
    }

    if (action === "transcript.fetch") {
      return handleTranscriptFetch(data, user.id);
    }

    if (action === "tool.invoke") {
      return dispatchToolInvocation(data, user.id);
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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Realtime orchestrator error", error);
    return NextResponse.json({ error: "Unexpected orchestrator error" }, { status: 500 });
  }
}
