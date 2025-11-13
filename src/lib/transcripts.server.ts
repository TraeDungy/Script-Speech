import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Redis } from "@upstash/redis";
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

const SESSION_STORE_PATH =
  process.env.REALTIME_SESSION_STORE_PATH ?? path.join(process.cwd(), ".data", "realtime-sessions.json");

const TRANSCRIPT_STORE_PATH =
  process.env.REALTIME_TRANSCRIPT_STORE_PATH ??
  path.join(process.cwd(), ".data", "realtime-transcripts.json");

const DEFAULT_STORE_ENCODING: BufferEncoding = "utf8";

type FileSessionRecord = {
  sessionId: string;
  projectId?: string;
  ackToken: string;
  expiresAt?: string | null;
  orchestratorSessionId?: string | null;
  lastStatePatch?: unknown;
  statePatchReason?: string | null;
  updatedAt: string;
};

type FileSessionStore = Record<string, FileSessionRecord>;
type FileTranscriptStore = Record<string, TranscriptTurnDTO[]>;

let cachedRedisClient: Redis | null | undefined;

function getClient(): SupabaseClient | null {
  return getSupabaseServiceClient();
}

function getRedisClient(): Redis | null {
  if (cachedRedisClient !== undefined) {
    return cachedRedisClient;
  }

  try {
    cachedRedisClient = Redis.fromEnv();
  } catch (error) {
    console.warn("Redis client unavailable for realtime persistence", error);
    cachedRedisClient = null;
  }

  return cachedRedisClient;
}

async function ensureFileStore<T>(filePath: string, fallback: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), DEFAULT_STORE_ENCODING);
  }
}

async function readFileStore<T>(filePath: string, fallback: T): Promise<T> {
  await ensureFileStore(filePath, fallback);
  try {
    const raw = await fs.readFile(filePath, DEFAULT_STORE_ENCODING);
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch (error) {
    console.warn("Failed to read realtime file store", { filePath, error });
    return JSON.parse(JSON.stringify(fallback)) as T;
  }
}

async function writeFileStore<T>(filePath: string, value: T): Promise<void> {
  await ensureFileStore(filePath, value);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), DEFAULT_STORE_ENCODING);
}

async function executeWithFallback(operations: Array<() => Promise<boolean>>): Promise<void> {
  const errors: unknown[] = [];
  let succeeded = false;

  for (const operation of operations) {
    try {
      const result = await operation();
      if (result) {
        succeeded = true;
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (!succeeded && errors.length) {
    const message = errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join("; ");
    throw new Error(`All realtime persistence backends failed: ${message}`);
  }
}

function mapRowToMetadata(row: SessionRow): StoredSessionMetadata {
  return {
    sessionId: row.session_id,
    ackToken: row.ack_token!,
    projectId: row.project_id ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    toolSchemas: [],
    transcripts: [],
  } satisfies StoredSessionMetadata;
}

async function persistSessionMetadataToSupabase(
  client: SupabaseClient,
  input: {
    sessionId: string;
    projectId?: string;
    ackToken: string;
    expiresAt?: string | null;
    rawSession?: unknown;
    orchestratorSessionId?: string | null;
  },
): Promise<void> {
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

async function persistSessionMetadataToRedis(
  redis: Redis,
  input: {
    sessionId: string;
    projectId?: string;
    ackToken: string;
    expiresAt?: string | null;
    orchestratorSessionId?: string | null;
  },
): Promise<void> {
  const existingRaw = await redis.get<string>(`realtime:session:${input.sessionId}`);
  const existing = existingRaw ? (JSON.parse(existingRaw) as FileSessionRecord) : null;
  const record: FileSessionRecord = {
    sessionId: input.sessionId,
    projectId: input.projectId ?? existing?.projectId ?? undefined,
    ackToken: input.ackToken,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    orchestratorSessionId: input.orchestratorSessionId ?? existing?.orchestratorSessionId ?? null,
    lastStatePatch: existing?.lastStatePatch,
    statePatchReason: existing?.statePatchReason ?? null,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(`realtime:session:${input.sessionId}`, JSON.stringify(record));
}

async function persistSessionMetadataToFile(
  input: {
    sessionId: string;
    projectId?: string;
    ackToken: string;
    expiresAt?: string | null;
    orchestratorSessionId?: string | null;
  },
): Promise<void> {
  const store = await readFileStore<FileSessionStore>(SESSION_STORE_PATH, {});
  const record: FileSessionRecord = {
    sessionId: input.sessionId,
    projectId: input.projectId ?? store[input.sessionId]?.projectId ?? undefined,
    ackToken: input.ackToken,
    expiresAt: input.expiresAt ?? store[input.sessionId]?.expiresAt ?? null,
    orchestratorSessionId: input.orchestratorSessionId ?? store[input.sessionId]?.orchestratorSessionId ?? null,
    lastStatePatch: store[input.sessionId]?.lastStatePatch,
    statePatchReason: store[input.sessionId]?.statePatchReason ?? null,
    updatedAt: new Date().toISOString(),
  };

  store[input.sessionId] = record;
  await writeFileStore(SESSION_STORE_PATH, store);
}

async function fetchSessionMetadataFromSupabase(
  client: SupabaseClient,
  sessionId: string,
): Promise<StoredSessionMetadata | null> {
  const { data, error } = await client
    .from(SESSION_TABLE)
    .select("session_id, project_id, ack_token, expires_at, last_state_patch, state_patch_reason")
    .eq("session_id", sessionId)
    .maybeSingle<SessionRow>();

  if (error) {
    throw new Error(error.message ?? "Failed to load realtime session metadata");
  }

  if (!data?.ack_token) {
    return null;
  }

  const metadata = mapRowToMetadata(data);
  if (data.last_state_patch !== undefined) {
    metadata.projectStatePatch = data.last_state_patch ?? undefined;
  }
  if (data.state_patch_reason) {
    metadata.projectStatePatchReason = data.state_patch_reason ?? undefined;
  }
  return metadata;
}

async function fetchSessionMetadataFromRedis(sessionId: string): Promise<StoredSessionMetadata | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get<string>(`realtime:session:${sessionId}`);
    if (!raw) {
      return null;
    }

    const record = JSON.parse(raw) as FileSessionRecord;
    if (!record.ackToken) {
      return null;
    }

    const metadata: StoredSessionMetadata = {
      sessionId: record.sessionId,
      ackToken: record.ackToken,
      projectId: record.projectId,
      expiresAt: record.expiresAt ?? undefined,
      toolSchemas: [],
      transcripts: [],
    };

    if (record.lastStatePatch !== undefined) {
      metadata.projectStatePatch = record.lastStatePatch;
    }
    if (record.statePatchReason) {
      metadata.projectStatePatchReason = record.statePatchReason ?? undefined;
    }

    return metadata;
  } catch (error) {
    console.warn("Failed to load realtime session metadata from Redis", error);
    return null;
  }
}

async function fetchSessionMetadataFromFile(sessionId: string): Promise<StoredSessionMetadata | null> {
  const store = await readFileStore<FileSessionStore>(SESSION_STORE_PATH, {});
  const record = store[sessionId];
  if (!record?.ackToken) {
    return null;
  }

  const metadata: StoredSessionMetadata = {
    sessionId: record.sessionId,
    ackToken: record.ackToken,
    projectId: record.projectId,
    expiresAt: record.expiresAt ?? undefined,
    toolSchemas: [],
    transcripts: [],
  };

  if (record.lastStatePatch !== undefined) {
    metadata.projectStatePatch = record.lastStatePatch;
  }
  if (record.statePatchReason) {
    metadata.projectStatePatchReason = record.statePatchReason ?? undefined;
  }

  return metadata;
}

async function persistTranscriptTurnToSupabase(client: SupabaseClient, turn: TranscriptTurnDTO & { sessionId: string }) {
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

async function persistTranscriptTurnToRedis(redis: Redis, turn: TranscriptTurnDTO & { sessionId: string }) {
  await redis.hset(`realtime:transcripts:${turn.sessionId}`, {
    [turn.id]: JSON.stringify(turn),
  });
}

async function persistTranscriptTurnToFile(turn: TranscriptTurnDTO & { sessionId: string }) {
  const store = await readFileStore<FileTranscriptStore>(TRANSCRIPT_STORE_PATH, {});
  const entries = store[turn.sessionId] ?? [];
  const index = entries.findIndex((entry) => entry.id === turn.id);
  if (index >= 0) {
    entries[index] = turn;
  } else {
    entries.push(turn);
  }
  store[turn.sessionId] = entries
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  await writeFileStore(TRANSCRIPT_STORE_PATH, store);
}

async function fetchTranscriptTurnsFromSupabase(
  client: SupabaseClient,
  sessionId: string,
  limit: number,
): Promise<TranscriptTurnDTO[]> {
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

async function fetchTranscriptTurnsFromRedis(sessionId: string): Promise<TranscriptTurnDTO[] | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const values = await redis.hvals<string>(`realtime:transcripts:${sessionId}`);
    if (!values?.length) {
      return [];
    }

    return values
      .map((value) => {
        try {
          return JSON.parse(value) as TranscriptTurnDTO & { sessionId?: string };
        } catch {
          return null;
        }
      })
      .filter((turn): turn is TranscriptTurnDTO => Boolean(turn))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    console.warn("Failed to load transcript turns from Redis", error);
    return null;
  }
}

async function fetchTranscriptTurnsFromFile(sessionId: string): Promise<TranscriptTurnDTO[]> {
  const store = await readFileStore<FileTranscriptStore>(TRANSCRIPT_STORE_PATH, {});
  return (store[sessionId] ?? []).map((entry) => ({
    ...entry,
    sessionId,
  }));
}

async function persistProjectStatePatchToSupabase(
  client: SupabaseClient,
  input: { sessionId: string; projectId?: string; patch: unknown; reason?: string },
) {
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

async function persistProjectStatePatchToRedis(
  redis: Redis,
  input: { sessionId: string; projectId?: string; patch: unknown; reason?: string },
) {
  const raw = await redis.get<string>(`realtime:session:${input.sessionId}`);
  const existing = raw ? (JSON.parse(raw) as FileSessionRecord) : null;
  const record: FileSessionRecord = {
    sessionId: input.sessionId,
    projectId: input.projectId ?? existing?.projectId ?? undefined,
    ackToken: existing?.ackToken ?? randomUUID(),
    expiresAt: existing?.expiresAt ?? null,
    orchestratorSessionId: existing?.orchestratorSessionId ?? null,
    lastStatePatch: input.patch,
    statePatchReason: input.reason ?? null,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(`realtime:session:${input.sessionId}`, JSON.stringify(record));
}

async function persistProjectStatePatchToFile(input: {
  sessionId: string;
  projectId?: string;
  patch: unknown;
  reason?: string;
}) {
  const store = await readFileStore<FileSessionStore>(SESSION_STORE_PATH, {});
  const record = store[input.sessionId] ?? {
    sessionId: input.sessionId,
    ackToken: randomUUID(),
    updatedAt: new Date().toISOString(),
  };

  record.projectId = input.projectId ?? record.projectId;
  record.lastStatePatch = input.patch;
  record.statePatchReason = input.reason ?? null;
  record.updatedAt = new Date().toISOString();

  store[input.sessionId] = record;
  await writeFileStore(SESSION_STORE_PATH, store);
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
  const redis = getRedisClient();

  await executeWithFallback([
    async () => {
      if (!client) return false;
      await persistSessionMetadataToSupabase(client, input);
      return true;
    },
    async () => {
      if (!redis) return false;
      await persistSessionMetadataToRedis(redis, input);
      return true;
    },
    async () => {
      await persistSessionMetadataToFile(input);
      return true;
    },
  ]);
}

export interface StoredSessionMetadata extends OrchestratorSessionMetadata {}

export async function fetchSessionMetadata(sessionId: string): Promise<StoredSessionMetadata | null> {
  const client = getClient();
  const redis = getRedisClient();

  if (client) {
    try {
      const metadata = await fetchSessionMetadataFromSupabase(client, sessionId);
      if (metadata) {
        return metadata;
      }
    } catch (error) {
      console.warn("Failed to fetch realtime session metadata from Supabase", error);
    }
  }

  const redisMetadata = await fetchSessionMetadataFromRedis(sessionId);
  if (redisMetadata) {
    return redisMetadata;
  }

  return fetchSessionMetadataFromFile(sessionId);
}

export async function persistTranscriptTurn(turn: TranscriptTurnDTO & { sessionId: string }): Promise<void> {
  const client = getClient();
  const redis = getRedisClient();

  await executeWithFallback([
    async () => {
      if (!client) return false;
      await persistTranscriptTurnToSupabase(client, turn);
      return true;
    },
    async () => {
      if (!redis) return false;
      await persistTranscriptTurnToRedis(redis, turn);
      return true;
    },
    async () => {
      await persistTranscriptTurnToFile(turn);
      return true;
    },
  ]);
}

export async function fetchTranscriptTurns(
  sessionId: string,
  limit = 50,
): Promise<TranscriptTurnDTO[]> {
  const client = getClient();

  if (client) {
    try {
      const turns = await fetchTranscriptTurnsFromSupabase(client, sessionId, limit);
      if (turns.length) {
        return turns;
      }
    } catch (error) {
      console.warn("Failed to load transcript turns from Supabase", error);
    }
  }

  const redisTurns = await fetchTranscriptTurnsFromRedis(sessionId);
  if (redisTurns?.length) {
    return redisTurns.slice(0, limit);
  }

  const fileTurns = await fetchTranscriptTurnsFromFile(sessionId);
  return fileTurns.slice(0, limit);
}

export async function persistProjectStatePatch(input: {
  sessionId: string;
  projectId?: string;
  patch: unknown;
  reason?: string;
}): Promise<void> {
  const client = getClient();
  const redis = getRedisClient();

  await executeWithFallback([
    async () => {
      if (!client) return false;
      await persistProjectStatePatchToSupabase(client, input);
      return true;
    },
    async () => {
      if (!redis) return false;
      await persistProjectStatePatchToRedis(redis, input);
      return true;
    },
    async () => {
      await persistProjectStatePatchToFile(input);
      return true;
    },
  ]);
}
