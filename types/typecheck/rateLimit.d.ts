export type RateLimitResult = { allowed: boolean; resetAt: number };

export async function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  prefix?: string;
}): Promise<RateLimitResult>
