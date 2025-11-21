import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET } from "./route";

const jobsModule = vi.hoisted(() => ({
  getExportJobForUser: vi.fn(),
}));

vi.mock("@/lib/exports/jobs", () => jobsModule);

const authModule = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireServerAuthSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/server", () => authModule);

const mockRequireServerAuthSession = authModule.requireServerAuthSession;
const mockGetExportJobForUser = jobsModule.getExportJobForUser;

describe("/api/exports/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns job details for the current user", async () => {
    mockGetExportJobForUser.mockResolvedValueOnce({ id: "job-1", status: "queued" });
    const request = new Request("http://localhost/api/exports/job-1");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "job-1", status: "queued" });
  });

  it("returns 404 when the job does not exist", async () => {
    mockGetExportJobForUser.mockResolvedValueOnce(null);
    const request = new Request("http://localhost/api/exports/job-unknown");
    const response = await GET(request, { params: { jobId: "job-unknown" } });
    expect(response.status).toBe(404);
  });

  it("returns 401 when authentication fails", async () => {
    const error = new authModule.UnauthorizedError();
    mockRequireServerAuthSession.mockRejectedValueOnce(error);
    const request = new Request("http://localhost/api/exports/job-1");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(401);
  });
});
