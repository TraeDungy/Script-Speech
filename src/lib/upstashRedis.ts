const JSON_HEADERS = {
  "Content-Type": "application/json",
};

type RedisCommand = Array<string | number>;

type RedisResponse<T> = { result: T } | { error: string };

export class UpstashRedisClient {
  constructor(private readonly url: string, private readonly token: string) {}

  private async callCommand<T>(command: RedisCommand): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as RedisResponse<T>;
    if ("error" in payload) {
      throw new Error(payload.error ?? "Redis command failed");
    }
    return payload.result;
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.callCommand<T | null>(["GET", key]);
    return result ?? null;
  }

  async set(key: string, value: string): Promise<string | null> {
    return this.callCommand<string | null>(["SET", key, value]);
  }

  async hset(key: string, values: Record<string, string>): Promise<number> {
    const entries = Object.entries(values);
    if (!entries.length) {
      return 0;
    }
    const command: RedisCommand = ["HSET", key];
    for (const [field, value] of entries) {
      command.push(field, value);
    }
    return this.callCommand<number>(command);
  }

  async hvals<T>(key: string): Promise<T[]> {
    const result = await this.callCommand<T[] | null>(["HVALS", key]);
    return result ?? [];
  }

  async incrBy(key: string, value: number): Promise<number> {
    return this.callCommand<number>(["INCRBY", key, value]);
  }

  async pttl(key: string): Promise<number> {
    return this.callCommand<number>(["PTTL", key]);
  }

  async pexpire(key: string, ttlMs: number): Promise<number> {
    return this.callCommand<number>(["PEXPIRE", key, ttlMs]);
  }
}

export function getRedisClientFromEnv(): UpstashRedisClient | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return new UpstashRedisClient(url, token);
}
