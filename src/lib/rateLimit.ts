import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  cost?: number;
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redisLimiters = new Map<string, Ratelimit>();

interface MemoryRecord {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryRecord>();

function getRedisLimiter(limit: number, windowMs: number, prefix?: string): Ratelimit {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const key = `${prefix ?? "rate"}:${limit}:${windowSeconds}`;
  const existing = redisLimiters.get(key);
  if (existing) {
    return existing;
  }

  const redis = Redis.fromEnv();
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: key,
  });

  redisLimiters.set(key, limiter);
  return limiter;
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const cost = Math.max(1, options.cost ?? 1);

  if (redisUrl && redisToken) {
    try {
      const limiter = getRedisLimiter(options.limit, options.windowMs, options.prefix);
      const result = await limiter.limit(options.key, { cost });
      return {
        allowed: result.success,
        remaining: Math.max(0, result.remaining),
        limit: options.limit,
        resetAt: result.reset * 1000,
      };
    } catch (error) {
      console.warn("Redis rate limiter failed, falling back to in-memory limiter", error);
    }
  }

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
