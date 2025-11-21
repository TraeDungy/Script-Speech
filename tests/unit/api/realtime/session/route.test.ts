import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/realtime/session/route";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { enforceRateLimit } from "@/lib/rateLimit";

vi.mock("@/lib/auth/server", () => ({
  requireServerAuthSession: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: vi.fn(),
}));

describe("realtime session API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ORCHESTRATION_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    (requireServerAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (enforceRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, resetAt: Date.now() });
  });

  it("returns an orchestration session when orchestrator responds", async () => {
    process.env.ORCHESTRATION_BASE_URL = "https://orchestrator.example.com";
    const orchestrationPayload = { session: "orchestrated" };
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(orchestrationPayload), { status: 200 }));

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(orchestrationPayload);
    expect(fetchMock).toHaveBeenCalledWith(new URL("/api/realtime/session", process.env.ORCHESTRATION_BASE_URL), {
      body: "{}",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: undefined },
      method: "POST",
    });
  });

  it("falls back to OpenAI when orchestration is unavailable", async () => {
    process.env.ORCHESTRATION_BASE_URL = "https://orchestrator.example.com";
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "openai-session" }), { status: 200 }));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: "openai-session" });
  });

  it("returns 401 when authentication fails", async () => {
    (requireServerAuthSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("no session"),
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("Unauthorized");
  });
});
