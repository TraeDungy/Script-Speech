import { randomUUID } from "node:crypto";

import {
  TOOL_DEFINITIONS,
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
import { ensureProjectMembership } from "@/lib/authz/projects.server";
import { logAuditEvent } from "@/lib/auditLog";
import { moderateRealtimeText } from "./middleware.server";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

interface SessionCacheEntry {
  ackToken: string;
  projectId?: string;
  expiresAt?: string;
}

export class RealtimeOrchestratorError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RealtimeOrchestratorError";
    this.status = status;
  }
}

async function createRealtimeSession(body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new RealtimeOrchestratorError("OPENAI_API_KEY is not configured", 500);
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
        ? ((payload as { error?: { message?: string } }).error?.message ?? "OpenAI realtime session error")
        : "Failed to create realtime session";
    throw new RealtimeOrchestratorError(message, response.status === 401 ? 401 : 502);
  }

  return payload as Record<string, unknown>;
}

function normalizeSessionMetadata(
  session: Record<string, unknown>,
  projectId: string | undefined,
  ackToken: string,
): OrchestratorSessionMetadata {
  const sessionId = typeof session.id === "string" ? session.id : randomUUID();
  const expiresAt = typeof session.expires_at === "string" ? session.expires_at : undefined;

  return {
    sessionId,
    ackToken,
    projectId,
    expiresAt,
    toolSchemas: TOOL_DEFINITIONS,
    transcripts: [],
  } satisfies OrchestratorSessionMetadata;
}

function parseTranscriptTurn(value: unknown): (TranscriptTurnDTO & { projectId?: string }) | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : null;
  const role = typeof value.role === "string" ? value.role : null;
  const text = typeof value.text === "string" ? value.text : null;
  const final = typeof value.final === "boolean" ? value.final : null;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : null;

  if (!id || !role || !text || final === null || !createdAt) {
    return null;
  }

  const projectId = typeof value.projectId === "string" ? value.projectId : undefined;

  return {
    id,
    role,
    text,
    final,
    createdAt,
    projectId,
  };
}

export interface CreateSessionInput {
  userId: string;
  projectId?: string;
  requestedSessionId?: string | null;
}

export interface AppendTranscriptInput {
  payload: Record<string, unknown>;
  userId: string;
}

export interface ToolInvocationInput {
  payload: Record<string, unknown>;
  userId: string;
}

export interface TranscriptFetchInput {
  sessionId: string;
  userId: string;
  limit?: number;
}

export class RealtimeOrchestratorService {
  private readonly sessionCache = new Map<string, SessionCacheEntry>();

  async createSession(input: CreateSessionInput): Promise<{ session: Record<string, unknown>; metadata: OrchestratorSessionMetadata }>
  {
    if (input.projectId) {
      await ensureProjectMembership(input.projectId, input.userId, { minimumRole: "member" });
    }

    const session = await createRealtimeSession({
      model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-10",
      voice: process.env.OPENAI_REALTIME_VOICE ?? "verse",
      instructions:
        "Use update_project_state to synchronize ScriptDoc patches and log_transcript_turn to persist transcript updates.",
      tools: TOOL_DEFINITIONS.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      })),
    });

    const ackToken = randomUUID();
    const metadata = normalizeSessionMetadata(session, input.projectId, ackToken);

    if (input.requestedSessionId && input.requestedSessionId !== metadata.sessionId) {
      metadata.sessionId = input.requestedSessionId;
    }

    this.sessionCache.set(metadata.sessionId, {
      ackToken,
      projectId: metadata.projectId,
      expiresAt: metadata.expiresAt,
    });

    try {
      await persistSessionMetadata({
        sessionId: metadata.sessionId,
        projectId: metadata.projectId,
        ackToken,
        expiresAt: metadata.expiresAt ?? null,
        rawSession: session,
        orchestratorSessionId: input.requestedSessionId ?? null,
      });
    } catch (error) {
      console.warn("Failed to persist realtime session metadata", error);
    }

    try {
      metadata.transcripts = await fetchTranscriptTurns(metadata.sessionId, 200);
    } catch (error) {
      console.warn("Failed to hydrate transcript history", error);
    }

    await logAuditEvent({
      action: "realtime.session.create",
      userId: input.userId,
      projectId: input.projectId,
      targetId: metadata.sessionId,
      details: { requestedSessionId: input.requestedSessionId ?? null, expiresAt: metadata.expiresAt },
    });

    return { session, metadata };
  }

  async appendTranscript(input: AppendTranscriptInput): Promise<ToolAcknowledgement> {
    const sessionId = typeof input.payload.sessionId === "string" ? input.payload.sessionId : null;
    const ackToken = typeof input.payload.ackToken === "string" ? input.payload.ackToken : null;
    const turn = parseTranscriptTurn(input.payload.turn);

    if (!sessionId || !ackToken || !turn) {
      throw new RealtimeOrchestratorError("Invalid transcript payload", 400);
    }

    const entry = await this.requireSessionEntry(sessionId, ackToken);

    if (turn.projectId) {
      await ensureProjectMembership(turn.projectId, input.userId, { minimumRole: "member" });
    } else if (entry.projectId) {
      await ensureProjectMembership(entry.projectId, input.userId, { minimumRole: "member" });
    }

    const { flagged } = await moderateRealtimeText(turn.text);
    if (flagged) {
      throw new RealtimeOrchestratorError("Transcript failed moderation", 400);
    }

    const projectId = turn.projectId ?? entry.projectId;
    try {
      await persistTranscriptTurn({ ...turn, sessionId, projectId });
    } catch (error) {
      console.warn("Failed to persist transcript turn", error);
      throw new RealtimeOrchestratorError("Unable to persist transcript", 500);
    }

    this.sessionCache.set(sessionId, { ...entry, projectId });

    await logAuditEvent({
      action: "transcript.turn.append",
      userId: input.userId,
      projectId: projectId ?? undefined,
      targetId: turn.id,
      details: { role: turn.role, final: turn.final },
    });

    return {
      requestId: turn.id,
      status: "accepted",
      timestamp: new Date().toISOString(),
      transcriptTurn: { ...turn, sessionId, projectId },
    } satisfies ToolAcknowledgement;
  }

  async invokeTool(input: ToolInvocationInput): Promise<ToolAcknowledgement> {
    const sessionId = typeof input.payload.sessionId === "string" ? input.payload.sessionId : null;
    const ackToken = typeof input.payload.ackToken === "string" ? input.payload.ackToken : null;
    const rawInvocation = input.payload.invocation;

    if (!sessionId || !ackToken || !rawInvocation) {
      throw new RealtimeOrchestratorError("Invalid tool invocation", 400);
    }

    const entry = await this.requireSessionEntry(sessionId, ackToken);
    const invocation = parseToolInvocationPayload(rawInvocation);
    if (!invocation) {
      throw new RealtimeOrchestratorError("Malformed tool invocation", 400);
    }

    invocation.sessionId = sessionId;
    invocation.projectId = typeof input.payload.projectId === "string" ? input.payload.projectId : entry.projectId;

    if (invocation.projectId) {
      await ensureProjectMembership(invocation.projectId, input.userId, { minimumRole: "member" });
    }

    const validationErrors = validateToolInvocationPayload(invocation);
    if (validationErrors.length > 0) {
      throw new RealtimeOrchestratorError(validationErrors.join("; "), 400);
    }

    const acknowledgement: ToolAcknowledgement = {
      requestId: invocation.callId,
      status: "accepted",
      timestamp: new Date().toISOString(),
    };

    if (invocation.name === "log_transcript_turn") {
      const turn = parseTranscriptTurn(invocation.arguments);
      if (!turn) {
        throw new RealtimeOrchestratorError("Invalid transcript payload", 400);
      }

      const { flagged } = await moderateRealtimeText(turn.text);
      if (flagged) {
        acknowledgement.status = "rejected";
        acknowledgement.reason = "Transcript failed moderation";
        return acknowledgement;
      }

      const projectId = turn.projectId ?? invocation.projectId ?? entry.projectId;
      try {
        await persistTranscriptTurn({ ...turn, sessionId, projectId });
      } catch (error) {
        console.warn("Failed to persist transcript turn", error);
        throw new RealtimeOrchestratorError("Unable to persist transcript", 500);
      }

      this.sessionCache.set(sessionId, { ...entry, projectId });

      await logAuditEvent({
        action: "transcript.turn.append",
        userId: input.userId,
        projectId: projectId ?? undefined,
        targetId: turn.id,
        details: { role: turn.role, final: turn.final },
      });

      acknowledgement.transcriptTurn = { ...turn, sessionId, projectId };
      return acknowledgement;
    }

    if (invocation.name === "update_project_state") {
      const args = isPlainObject(invocation.arguments) ? invocation.arguments : {};
      const patch = isPlainObject(args.patch) ? args.patch : isPlainObject(invocation.arguments) ? invocation.arguments : null;
      if (!patch || !isPlainObject(patch)) {
        throw new RealtimeOrchestratorError("Invalid project state patch", 400);
      }

      const reason = typeof args.reason === "string" ? args.reason : undefined;

      try {
        await persistProjectStatePatch({
          sessionId,
          projectId: invocation.projectId,
          patch,
          reason,
        });
      } catch (error) {
        console.warn("Failed to persist project state patch", error);
        throw new RealtimeOrchestratorError("Unable to persist project state", 500);
      }

      this.sessionCache.set(sessionId, {
        ackToken: entry.ackToken,
        projectId: invocation.projectId ?? entry.projectId,
        expiresAt: entry.expiresAt,
      });

      await logAuditEvent({
        action: "project.state.patch",
        userId: input.userId,
        projectId: invocation.projectId ?? undefined,
        targetId: sessionId,
        details: { reason },
        severity: "high",
      });

      acknowledgement.projectStatePatch = patch;
      return acknowledgement;
    }

    acknowledgement.status = "rejected";
    acknowledgement.reason = `Unsupported tool: ${invocation.name}`;
    return acknowledgement;
  }

  async fetchTranscripts(input: TranscriptFetchInput): Promise<TranscriptTurnDTO[]> {
    const entry = await this.ensureSessionEntry(input.sessionId);
    if (entry?.projectId) {
      await ensureProjectMembership(entry.projectId, input.userId);
    }

    try {
      return await fetchTranscriptTurns(input.sessionId, input.limit ?? 200);
    } catch (error) {
      console.warn("Failed to load transcripts", error);
      throw new RealtimeOrchestratorError("Unable to load transcripts", 500);
    }
  }

  private async requireSessionEntry(sessionId: string, ackToken: string): Promise<SessionCacheEntry> {
    const entry = await this.ensureSessionEntry(sessionId);
    if (!entry || entry.ackToken !== ackToken) {
      throw new RealtimeOrchestratorError("Unauthorized", 401);
    }
    return entry;
  }

  private async ensureSessionEntry(sessionId: string): Promise<SessionCacheEntry | null> {
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId)!;
    }

    try {
      const metadata = await fetchSessionMetadata(sessionId);
      if (metadata?.ackToken) {
        const entry: SessionCacheEntry = {
          ackToken: metadata.ackToken,
          projectId: metadata.projectId,
          expiresAt: metadata.expiresAt,
        };
        this.sessionCache.set(sessionId, entry);
        return entry;
      }
    } catch (error) {
      console.warn("Failed to hydrate session cache", error);
    }

    return null;
  }
}

let cachedService: RealtimeOrchestratorService | null = null;

export function getRealtimeOrchestratorService(): RealtimeOrchestratorService {
  if (!cachedService) {
    cachedService = new RealtimeOrchestratorService();
  }
  return cachedService;
}
