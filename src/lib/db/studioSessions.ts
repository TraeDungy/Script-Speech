import { randomUUID } from "node:crypto";

import { getSupabaseClient } from "./client";
import { isSupabaseConfigured } from "./config";
import type {
  ProjectSessionRow,
  ProjectSessionStatus,
  ProjectTranscriptRow,
} from "./schema";

export type StudioSlotPayload = {
  format?: string | null;
  toneKeywords?: string[] | null;
  constraints?: string | null;
  [key: string]: unknown;
};

export interface StudioSessionRecord {
  id: string;
  projectId: string;
  userId: string;
  status: ProjectSessionStatus;
  slots: StudioSlotPayload;
  summary: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureProjectSlotsInput {
  sessionId: string;
  projectId: string;
  userId: string;
  slots: StudioSlotPayload;
}

export interface ConfirmProjectSessionInput {
  sessionId: string;
  projectId: string;
  userId: string;
  summary?: StudioSlotPayload | null;
}

export interface LogProjectTranscriptInput {
  sessionId: string;
  projectId: string;
  userId: string;
  transcript: string;
  speaker?: string;
  source?: string;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface StudioTranscriptRecord {
  id: string;
  projectId: string;
  sessionId: string | null;
  speaker: string;
  transcript: string;
  source: string;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const localSessions = new Map<string, {
  record: StudioSessionRecord;
  transcripts: StudioTranscriptRecord[];
}>();

function normalizeSlotValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
      .filter((entry) => entry !== null && entry !== undefined && entry !== "");
    return entries.length ? entries : null;
  }

  if (value === undefined) {
    return null;
  }

  return value;
}

function sanitizeSlots(slots?: StudioSlotPayload | null): StudioSlotPayload {
  const payload: StudioSlotPayload = {};
  if (!slots) {
    return payload;
  }

  for (const [key, rawValue] of Object.entries(slots)) {
    const value = normalizeSlotValue(rawValue);
    if (value === null) {
      continue;
    }
    payload[key] = value;
  }

  return payload;
}

function mapSessionRow(row: ProjectSessionRow): StudioSessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    status: row.status,
    slots: (row.slots ?? {}) as StudioSlotPayload,
    summary: row.summary ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTranscriptRow(row: ProjectTranscriptRow): StudioTranscriptRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    speaker: row.speaker,
    transcript: row.transcript,
    source: row.source,
    confidence: row.confidence,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  };
}

function upsertLocalSession(userId: string): StudioSessionRecord {
  const existing = localSessions.get(userId);
  if (existing) {
    return { ...existing.record };
  }

  const now = new Date().toISOString();
  const record: StudioSessionRecord = {
    id: `local-session-${randomUUID()}`,
    projectId: `local-project-${randomUUID()}`,
    userId,
    status: "collecting",
    slots: {},
    summary: null,
    createdAt: now,
    updatedAt: now,
  };

  localSessions.set(userId, { record, transcripts: [] });
  return { ...record };
}

function updateLocalSession(userId: string, updater: (session: StudioSessionRecord) => void): StudioSessionRecord {
  const existing = localSessions.get(userId);
  if (!existing) {
    throw new Error("Studio session not initialized");
  }

  const record = { ...existing.record };
  updater(record);
  record.updatedAt = new Date().toISOString();
  existing.record = record;
  return { ...record };
}

export async function ensureStudioProjectSession(userId: string): Promise<StudioSessionRecord> {
  if (!isSupabaseConfigured()) {
    return upsertLocalSession(userId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc<ProjectSessionRow>(
    "create_or_resume_project_session",
    { p_user_id: userId },
  );

  if (error || !data) {
    console.error("Failed to initialize studio session", error);
    throw error ?? new Error("Studio session could not be created");
  }

  return mapSessionRow(data);
}

export async function captureProjectSlots(
  input: CaptureProjectSlotsInput,
): Promise<StudioSessionRecord> {
  const payload = sanitizeSlots(input.slots);

  if (!isSupabaseConfigured()) {
    return updateLocalSession(input.userId, (session) => {
      session.slots = { ...session.slots, ...payload };
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc<ProjectSessionRow>(
    "capture_project_slots",
    {
      p_session_id: input.sessionId,
      p_project_id: input.projectId,
      p_user_id: input.userId,
      p_slots: payload,
    },
  );

  if (error || !data) {
    console.error("Failed to capture project slots", error);
    throw error ?? new Error("Slot capture failed");
  }

  return mapSessionRow(data);
}

export async function confirmProjectSession(
  input: ConfirmProjectSessionInput,
): Promise<StudioSessionRecord> {
  const summary = sanitizeSlots(input.summary ?? null);

  if (!isSupabaseConfigured()) {
    return updateLocalSession(input.userId, (session) => {
      session.status = "confirmed";
      if (Object.keys(summary).length) {
        session.summary = summary;
        session.slots = { ...session.slots, ...summary };
      }
    });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc<ProjectSessionRow>(
    "confirm_project_session",
    {
      p_session_id: input.sessionId,
      p_project_id: input.projectId,
      p_user_id: input.userId,
      p_summary: Object.keys(summary).length ? summary : null,
    },
  );

  if (error || !data) {
    console.error("Failed to confirm studio session", error);
    throw error ?? new Error("Session confirmation failed");
  }

  return mapSessionRow(data);
}

export async function logProjectTranscript(
  input: LogProjectTranscriptInput,
): Promise<StudioTranscriptRecord> {
  if (!input.transcript.trim()) {
    throw new Error("Transcript text is required");
  }

  if (!isSupabaseConfigured()) {
    const session = localSessions.get(input.userId) ?? {
      record: upsertLocalSession(input.userId),
      transcripts: [],
    };
    const record: StudioTranscriptRecord = {
      id: `local-transcript-${randomUUID()}`,
      projectId: session.record.projectId,
      sessionId: session.record.id,
      speaker: input.speaker ?? "user",
      transcript: input.transcript,
      source: input.source ?? "voice",
      confidence: input.confidence ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date().toISOString(),
    };
    session.transcripts.push(record);
    localSessions.set(input.userId, session);
    return record;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc<ProjectTranscriptRow>(
    "log_project_transcript",
    {
      p_session_id: input.sessionId,
      p_project_id: input.projectId,
      p_user_id: input.userId,
      p_transcript: input.transcript,
      p_speaker: input.speaker ?? "user",
      p_source: input.source ?? "voice",
      p_confidence: input.confidence ?? null,
      p_metadata: input.metadata ?? null,
    },
  );

  if (error || !data) {
    console.error("Failed to log project transcript", error);
    throw error ?? new Error("Transcript logging failed");
  }

  return mapTranscriptRow(data);
}
