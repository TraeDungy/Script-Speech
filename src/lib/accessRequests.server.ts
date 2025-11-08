import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

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

  const existingRequests = await readStore();
  const now = new Date();
  const rateLimitMinutes = getRateLimitMinutes();
  const windowStart = new Date(now.getTime() - rateLimitMinutes * 60 * 1000);

  const hasRecentSubmission = existingRequests.some((request) => {
    if (request.email !== normalizedEmail) {
      return false;
    }

    const submittedAt = new Date(request.submittedAt);
    return submittedAt > windowStart;
  });

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

  await writeStore([...existingRequests, record]);

  return record;
}

export async function listAccessRequests(): Promise<AccessRequestRecord[]> {
  const records = await readStore();
  return records.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}
