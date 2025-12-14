// import { requireServerAuthSession } from "@/lib/auth/server"; // Temporarily disabled for preview
import { enforceRateLimit, type RateLimitResult } from "@/lib/rateLimit";

const MODERATION_MODEL = process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

export class RateLimitExceededError extends Error {
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfter = retryAfter;
  }
}

export interface RealtimeRequestContext {
  userId: string;
  rateLimit: RateLimitResult;
}

interface RateLimitOptions {
  key?: string;
  limit?: number;
  windowMs?: number;
  cost?: number;
  prefix?: string;
}

export async function requireRealtimeContext(options?: RateLimitOptions): Promise<RealtimeRequestContext> {
  // Temporarily disabled auth for preview mode
  // TODO: Re-enable authentication before production
  // const { user } = await requireServerAuthSession();
  const mockUserId = "00000000-0000-0000-0000-000000000000";
  const rate = await enforceRateLimit({
    key: options?.key ?? mockUserId,
    limit: options?.limit ?? 120,
    windowMs: options?.windowMs ?? 60_000,
    cost: options?.cost,
    prefix: options?.prefix ?? "realtime:orchestrator",
  });

  if (!rate.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
    throw new RateLimitExceededError("Rate limit exceeded", retryAfter);
  }

  return { userId: mockUserId, rateLimit: rate };
}

export async function moderateRealtimeText(text: string): Promise<{ flagged: boolean }> {
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
      console.warn("Moderation request failed", response.status, await response.text().catch(() => ""));
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
