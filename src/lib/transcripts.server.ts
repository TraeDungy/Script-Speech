import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "./supabase.server";
import type { OrchestratorSessionMetadata, TranscriptTurnDTO } from "./realtime/schema";

const SESSION_TABLE = "realtime_sessions";
const TRANSCRIPT_TABLE = "realtime_transcript_turns";

type SessionRow = {
  session_id: string;
  project_id: string | null;
  ack_token: string | null;
  expires_at: string | null;
  session_payload?: unknown;
  orchestrator_session_id?: string | null;
  last_state_patch?: unknown;
  state_patch_reason?: string | null;
  updated_at?: string | null;
};

type TranscriptRow = {
  id: string;
  session_id: string;
  project_id: string | null;
  role: string;
  content: string;
  final: boolean;
  created_at: string;
};

function getClient(): SupabaseClient | null {
  return getSupabaseServiceClient();
}

export async function persistSessionMetadata(input: {
  sessionId: string;
  projectId?: string;
  ackToken: string;
  expiresAt?: string | null;
  rawSession?: unknown;
  orchestratorSessionId?: string | null;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await client.from(SESSION_TABLE).upsert(
    {
      session_id: input.sessionId,
      project_id: input.projectId ?? null,
      ack_token: input.ackToken,
      expires_at: input.expiresAt ?? null,
      session_payload: input.rawSession ?? null,
      orchestrator_session_id: input.orchestratorSessionId ?? null,
      updated_at: now,
    } satisfies SessionRow,
    { onConflict: "session_id" },
  );

  if (error) {
    throw new Error(error.message ?? "Failed to persist realtime session metadata");
  }
}

export interface StoredSessionMetadata extends OrchestratorSessionMetadata {}

export async function fetchSessionMetadata(sessionId: string): Promise<StoredSessionMetadata | null> {
  const client = getClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from(SESSION_TABLE)
    .select("session_id, project_id, ack_token, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle<SessionRow>();

  if (error) {
    throw new Error(error.message ?? "Failed to load realtime session metadata");
  }

  if (!data?.ack_token) {
    return null;
  }

  const metadata: StoredSessionMetadata = {
    sessionId: data.session_id,
    ackToken: data.ack_token,
    projectId: data.project_id ?? undefined,
    expiresAt: data.expires_at ?? undefined,
    toolSchemas: [],
    transcripts: [],
  };

  return metadata;
}

export async function persistTranscriptTurn(turn: TranscriptTurnDTO & { sessionId: string }): Promise<void> {
  const client = getClient();
  if (!client) {
    return;
  }

  const { error } = await client.from(TRANSCRIPT_TABLE).upsert(
    {
      id: turn.id,
      session_id: turn.sessionId,
      project_id: turn.projectId ?? null,
      role: turn.role,
      content: turn.text,
      final: turn.final,
      created_at: turn.createdAt,
    } satisfies TranscriptRow,
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message ?? "Failed to persist transcript turn");
  }
}

export async function fetchTranscriptTurns(
  sessionId: string,
  limit = 50,
): Promise<TranscriptTurnDTO[]> {
  const client = getClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from(TRANSCRIPT_TABLE)
    .select("id, session_id, project_id, role, content, final, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<TranscriptRow[]>();

  if (error) {
    throw new Error(error.message ?? "Failed to load transcript turns");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id ?? undefined,
    role: row.role,
    text: row.content,
    final: row.final,
    createdAt: row.created_at,
  }));
}

export async function persistProjectStatePatch(input: {
  sessionId: string;
  projectId?: string;
  patch: unknown;
  reason?: string;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await client.from(SESSION_TABLE).upsert(
    {
      session_id: input.sessionId,
      project_id: input.projectId ?? null,
      last_state_patch: input.patch ?? null,
      state_patch_reason: input.reason ?? null,
      updated_at: now,
    } satisfies SessionRow,
    { onConflict: "session_id" },
  );

  if (error) {
    throw new Error(error.message ?? "Failed to persist project state patch");
  }
}
