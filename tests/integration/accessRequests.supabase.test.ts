import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  type TableRow = Record<string, any>;

  class FakeQueryBuilder {
    private selection: TableRow[] = [];

    constructor(private readonly rows: TableRow[]) {}

    async insert(record: TableRow) {
      this.rows.push(record);
      return { error: null };
    }

    select(): this {
      this.selection = this.rows.map((row) => ({ ...row }));
      return this;
    }

    order(column: string, options: { ascending: boolean }) {
      const ordered = [...this.selection].sort((a, b) => {
        const left = new Date(a[column]).getTime();
        const right = new Date(b[column]).getTime();
        return options.ascending ? left - right : right - left;
      });
      return Promise.resolve({ data: ordered, error: null });
    }

    eq(column: string, value: unknown): this {
      this.selection = this.selection.filter((row) => row[column] === value);
      return this;
    }

    gte(column: string, value: string): this {
      const min = new Date(value).getTime();
      this.selection = this.selection.filter((row) => new Date(row[column]).getTime() >= min);
      return this;
    }

    limit(count: number) {
      return Promise.resolve({ data: this.selection.slice(0, count), error: null });
    }
  }

  class FakeSupabaseClient {
    private tables = new Map<string, TableRow[]>();

    from(table: string) {
      if (!this.tables.has(table)) {
        this.tables.set(table, []);
      }
      return new FakeQueryBuilder(this.tables.get(table)!);
    }
  }

  let currentClient = new FakeSupabaseClient();
  const createClient = vi.fn(() => currentClient);

  return {
    createClient,
    reset() {
      currentClient = new FakeSupabaseClient();
      createClient.mockImplementation(() => currentClient);
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMock.createClient,
}));

describe("accessRequests Supabase integration", () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseMock.reset();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });

  it("persists requests via Supabase", async () => {
    const module = await import("@/lib/accessRequests.server");
    const record = await module.createAccessRequest({ email: "demo@example.com" });
    expect(record.id).toBeTruthy();
    const requests = await module.listAccessRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].email).toBe("demo@example.com");
  });

  it("enforces rate limits via Supabase lookups", async () => {
    const module = await import("@/lib/accessRequests.server");
    await module.createAccessRequest({ email: "demo@example.com" });
    await expect(
      module.createAccessRequest({ email: "demo@example.com" }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
