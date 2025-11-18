import { randomUUID } from "node:crypto";

import type { ScriptDocTranscriptEntry } from "@/lib/scriptDoc";
import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type { ProjectTranscriptTurnRow } from "./schema";

export interface TranscriptTurnInput {
  id?: string;
  role?: string;
  text: string;
  final?: boolean;
  createdAt?: string;
  sessionId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const localTranscriptStore = new Map<string, ScriptDocTranscriptEntry[]>();

const mapRow = (row: ProjectTranscriptTurnRow): ScriptDocTranscriptEntry => ({
  id: row.id,
  role: row.role,
  text: row.text,
  final: row.final,
  createdAt: row.created_at,
});

export async function listTranscriptTurns(
  projectId: string,
  limit = 100,
): Promise<ScriptDocTranscriptEntry[]> {
  if (!isSupabaseConfigured()) {
    const entries = localTranscriptStore.get(projectId) ?? [];
    return entries.slice(-limit);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from<ProjectTranscriptTurnRow>("project_transcript_turns")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load transcript turns", error);
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function appendTranscriptTurns(
  projectId: string,
  turns: TranscriptTurnInput[],
): Promise<ScriptDocTranscriptEntry[]> {
  if (!turns.length) {
    return [];
  }

  if (!isSupabaseConfigured()) {
    const entries = localTranscriptStore.get(projectId) ?? [];
    const now = new Date().toISOString();
    const mapped = turns.map((turn) => ({
      id: turn.id ?? randomUUID(),
      role: turn.role ?? "user",
      text: turn.text,
      final: turn.final ?? true,
      createdAt: turn.createdAt ?? now,
    }));
    localTranscriptStore.set(projectId, [...entries, ...mapped]);
    return mapped;
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const payloads = turns.map((turn) => ({
    id: turn.id ?? randomUUID(),
    project_id: projectId,
    session_id: turn.sessionId ?? null,
    user_id: turn.userId ?? null,
    role: turn.role ?? "user",
    text: turn.text,
    final: turn.final ?? true,
    metadata: turn.metadata ?? null,
    created_at: turn.createdAt ?? now,
    updated_at: now,
  } satisfies Partial<ProjectTranscriptTurnRow> & {
    id: string;
    project_id: string;
    role: string;
    text: string;
    final: boolean;
  }));

  const { data, error } = await supabase
    .from<ProjectTranscriptTurnRow>("project_transcript_turns")
    .upsert(payloads, { onConflict: "id" })
    .select("*");

  if (error) {
    console.error("Failed to persist transcript turns", error);
    throw error;
  }

  return (data ?? []).map(mapRow);
}
