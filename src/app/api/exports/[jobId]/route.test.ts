import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET } from "./route";

const exportsModule = vi.hoisted(() => ({
  getExportJob: vi.fn(),
  formatSseEvent: (event: string, data: string) => `event: ${event}\ndata: ${data}\n\n`,
}));

vi.mock("@/lib/exports", () => exportsModule);

const mockGetExportJob = exportsModule.getExportJob;

const authModule = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireServerAuthSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/server", () => authModule);

const mockRequireServerAuthSession = authModule.requireServerAuthSession;

const authzModule = vi.hoisted(() => {
  class ProjectAuthorizationError extends Error {}
  return {
    ensureProjectMembership: vi.fn(),
    ProjectAuthorizationError,
  };
});

vi.mock("@/lib/authz/projects.server", () => authzModule);

const mockEnsureProjectMembership = authzModule.ensureProjectMembership;

const observabilityModule = vi.hoisted(() => ({
  recordApiRequest: vi.fn(),
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
  logStructuredEvent: vi.fn(),
  withSpan: async (_options: unknown, fn: (span: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: () => {} }),
}));

vi.mock("@/lib/observability", () => observabilityModule);

const mockRecordApiRequest = observabilityModule.recordApiRequest;
const mockRecordApiError = observabilityModule.recordApiError;
const mockCaptureApiException = observabilityModule.captureApiException;

const buildJob = (status: "queued" | "processing" | "completed" | "failed") => ({
  id: "job-1",
  projectId: "p1",
  format: "pdf" as const,
  status,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  mockEnsureProjectMembership.mockResolvedValue(undefined);
});

describe("/api/exports/[jobId]", () => {
  it("returns job details when not streaming", async () => {
    mockGetExportJob.mockResolvedValueOnce(buildJob("queued"));
    const request = new Request("http://localhost/api/exports/job-1");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "job-1", status: "queued" });
    expect(mockRecordApiRequest).toHaveBeenCalledWith("exports/job", "GET");
  });

  it("returns 404 for unknown job", async () => {
    mockGetExportJob.mockResolvedValueOnce(null);
    const request = new Request("http://localhost/api/exports/job-unknown");
    const response = await GET(request, { params: { jobId: "job-unknown" } });
    expect(response.status).toBe(404);
    expect(mockRecordApiError).toHaveBeenCalledWith("exports/job", "GET", 404);
  });

  it("streams job updates over SSE", async () => {
    vi.useFakeTimers();
    const states = [buildJob("queued"), buildJob("queued"), buildJob("completed")];
    let index = 0;
    mockGetExportJob.mockImplementation(async () => states[Math.min(index++, states.length - 1)]);

    const request = new Request("http://localhost/api/exports/job-1", {
      headers: { accept: "text/event-stream" },
    });

    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const decoder = new TextDecoder();
    const firstChunk = await reader!.read();
    expect(decoder.decode(firstChunk.value ?? new Uint8Array())).toContain("status\":\"queued");

    await vi.advanceTimersByTimeAsync(1500);
    const secondChunk = await reader!.read();
    expect(decoder.decode(secondChunk.value ?? new Uint8Array())).toContain("status\":\"completed");
  });
});
