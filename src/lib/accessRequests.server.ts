import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SUPABASE_GENERIC_KEY = process.env.SUPABASE_KEY?.trim();
const SUPABASE_ACCESS_REQUESTS_TABLE =
  process.env.SUPABASE_ACCESS_REQUESTS_TABLE?.trim() ?? "access_requests";

type NullableString = string | null | undefined;

export type AccessRequestMetadata = {
  company?: string;
  projectTitle?: string;
  projectTimeline?: string;
  projectNotes?: string;
};

export type AccessRequestClientContext = {
  ip?: string;
  userAgent?: string;
};

export type AccessRequestInput = {
  email: string;
  message?: string;
  metadata?: AccessRequestMetadata;
  client?: AccessRequestClientContext;
};

export type AccessRequestRecord = {
  id: string;
  email: string;
  message?: string;
  metadata?: AccessRequestMetadata;
  client?: AccessRequestClientContext;
  submittedAt: string;
};

export class AccessRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AccessRequestError";
    this.statusCode = statusCode;
  }
}

const DEFAULT_RATE_LIMIT_MINUTES = 15;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const STORE_PATH =
  process.env.ACCESS_REQUEST_STORE_PATH ??
  path.join(process.cwd(), ".data", "access-requests.json");

type AccessRequestPersistence = {
  create(record: AccessRequestRecord): Promise<void>;
  list(): Promise<AccessRequestRecord[]>;
  hasRecentSubmission(email: string, windowStart: Date): Promise<boolean>;
};

function getRateLimitMinutes(): number {
  const value = Number(process.env.ACCESS_REQUEST_RATE_LIMIT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RATE_LIMIT_MINUTES;
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore(): Promise<AccessRequestRecord[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as AccessRequestRecord[];
    }
  } catch (error) {
    console.error("Failed to read access request store", error);
  }
  return [];
}

async function writeStore(records: AccessRequestRecord[]): Promise<void> {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(records, null, 2), "utf8");
}

function normalizeValue(value: NullableString): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertValidEmail(email: NullableString): string {
  const normalized = normalizeValue(email);
  if (!normalized) {
    throw new AccessRequestError("Email is required.");
  }

  if (!EMAIL_REGEX.test(normalized)) {
    throw new AccessRequestError("Please provide a valid email address.");
  }

  return normalized.toLowerCase();
}

function sanitizeMetadata(metadata?: AccessRequestMetadata): AccessRequestMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: AccessRequestMetadata = {};

  const company = normalizeValue(metadata.company);
  if (company) normalized.company = company;

  const projectTitle = normalizeValue(metadata.projectTitle);
  if (projectTitle) normalized.projectTitle = projectTitle;

  const projectTimeline = normalizeValue(metadata.projectTimeline);
  if (projectTimeline) normalized.projectTimeline = projectTimeline;

  const projectNotes = normalizeValue(metadata.projectNotes);
  if (projectNotes) normalized.projectNotes = projectNotes;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function sanitizeClientContext(
  client?: AccessRequestClientContext,
): AccessRequestClientContext | undefined {
  if (!client) {
    return undefined;
  }

  const normalized: AccessRequestClientContext = {};

  const ip = normalizeValue(client.ip);
  if (ip) normalized.ip = ip;

  const userAgent = normalizeValue(client.userAgent);
  if (userAgent) normalized.userAgent = userAgent;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

const filePersistence: AccessRequestPersistence = {
  async create(record) {
    const existing = await readStore();
    await writeStore([...existing, record]);
  },
  async list() {
    const records = await readStore();
    return records.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  },
  async hasRecentSubmission(email, windowStart) {
    const existingRequests = await readStore();
    return existingRequests.some((request) => {
      if (request.email !== email) {
        return false;
      }

      const submittedAt = new Date(request.submittedAt);
      return submittedAt > windowStart;
    });
  },
};

type SupabaseAccessRequestRow = {
  id: string;
  email: string;
  message: string | null;
  metadata: AccessRequestMetadata | null;
  client: AccessRequestClientContext | null;
  submitted_at: string;
};

let cachedSupabaseClient: SupabaseClient | null = null;

function resolveSupabaseKey(): string | undefined {
  return SUPABASE_SERVICE_ROLE_KEY || SUPABASE_GENERIC_KEY;
}

function getSupabaseClient(): SupabaseClient | null {
  const key = resolveSupabaseKey();
  if (!SUPABASE_URL || !key) {
    return null;
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(SUPABASE_URL, key, {
      auth: {
        persistSession: false,
      },
    });
  }

  return cachedSupabaseClient;
}

function assertSupabaseConfigured(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new AccessRequestError("Supabase is not configured.", 500);
  }
  return client;
}

const supabasePersistence: AccessRequestPersistence = {
  async create(record) {
    const client = assertSupabaseConfigured();
    const { error } = await client.from(SUPABASE_ACCESS_REQUESTS_TABLE).insert({
      id: record.id,
      email: record.email,
      message: record.message ?? null,
      metadata: record.metadata ?? null,
      client: record.client ?? null,
      submitted_at: record.submittedAt,
    });

    if (error) {
      throw new AccessRequestError(
        error.message ?? "Failed to persist access request to Supabase.",
        error.status ?? 500,
      );
    }
  },
  async list() {
    const client = assertSupabaseConfigured();
    const { data, error } = await client
      .from(SUPABASE_ACCESS_REQUESTS_TABLE)
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      throw new AccessRequestError(
        error.message ?? "Failed to list access requests from Supabase.",
        error.status ?? 500,
      );
    }

    return (data ?? []).map(transformSupabaseRow);
  },
  async hasRecentSubmission(email, windowStart) {
    const client = assertSupabaseConfigured();
    const { data, error } = await client
      .from(SUPABASE_ACCESS_REQUESTS_TABLE)
      .select("id")
      .eq("email", email)
      .gte("submitted_at", windowStart.toISOString())
      .limit(1);

    if (error) {
      throw new AccessRequestError(
        error.message ?? "Failed to query access requests from Supabase.",
        error.status ?? 500,
      );
    }

    return Array.isArray(data) && data.length > 0;
  },
};

function transformSupabaseRow(row: SupabaseAccessRequestRow): AccessRequestRecord {
  return {
    id: row.id,
    email: row.email,
    message: row.message ?? undefined,
    metadata: row.metadata ?? undefined,
    client: row.client ?? undefined,
    submittedAt: row.submitted_at,
  };
}

function getPersistence(): AccessRequestPersistence {
  if (SUPABASE_URL && resolveSupabaseKey()) {
    return supabasePersistence;
  }

  return filePersistence;
}

export async function createAccessRequest({
  email,
  message,
  metadata,
  client,
}: AccessRequestInput): Promise<AccessRequestRecord> {
  const normalizedEmail = assertValidEmail(email);
  const normalizedMessage = normalizeValue(message);
  const normalizedMetadata = sanitizeMetadata(metadata);
  const normalizedClient = sanitizeClientContext(client);

  const now = new Date();
  const rateLimitMinutes = getRateLimitMinutes();
  const windowStart = new Date(now.getTime() - rateLimitMinutes * 60 * 1000);

  const persistence = getPersistence();

  const hasRecentSubmission = await persistence.hasRecentSubmission(
    normalizedEmail,
    windowStart,
  );

  if (hasRecentSubmission) {
    throw new AccessRequestError(
      `We received a recent request from this email. Please try again in ${rateLimitMinutes} minutes.`,
      429,
    );
  }

  const record: AccessRequestRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    message: normalizedMessage,
    metadata: normalizedMetadata,
    client: normalizedClient,
    submittedAt: now.toISOString(),
  };

  await persistence.create(record);

  return record;
}

export async function listAccessRequests(): Promise<AccessRequestRecord[]> {
  const persistence = getPersistence();
  return persistence.list();
}
