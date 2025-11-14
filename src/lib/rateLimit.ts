interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  cost?: number;
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

interface MemoryRecord {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryRecord>();

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const cost = Math.max(1, options.cost ?? 1);

  const now = Date.now();
  const bucketKey = `${options.prefix ?? "rate"}:${options.key}:${options.limit}:${options.windowMs}`;
  const record = memoryBuckets.get(bucketKey);

  if (!record || record.resetAt <= now) {
    const resetAt = now + options.windowMs;
    const next: MemoryRecord = { count: cost, resetAt };
    memoryBuckets.set(bucketKey, next);
    return {
      allowed: cost <= options.limit,
      remaining: Math.max(0, options.limit - next.count),
      limit: options.limit,
      resetAt,
    };
  }

  if (record.count + cost > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      limit: options.limit,
      resetAt: record.resetAt,
    };
  }

  record.count += cost;
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - record.count),
    limit: options.limit,
    resetAt: record.resetAt,
  };
}
