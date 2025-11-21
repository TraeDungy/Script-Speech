import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET } from "./route";

const authModule = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireServerAuthSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    UnauthorizedError,
  };
});

vi.mock("@/lib/auth/server", () => authModule);

const jobsModule = vi.hoisted(() => ({
  getExportJobForUser: vi.fn(),
}));

vi.mock("@/lib/exports/jobs", () => jobsModule);

const supabase = {
  storage: {
    from: vi.fn().mockReturnThis(),
    createSignedUrl: vi.fn(),
  },
};

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseServiceClient: () => supabase,
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabase.storage.from.mockReturnThis();
  supabase.storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://download" } });
  jobsModule.getExportJobForUser.mockResolvedValue({
    id: "job-1",
    userId: "user-1",
    status: "succeeded",
    downloadPath: "exports/demo.json",
  });
});

describe("/api/exports/[jobId]/download", () => {
  it("returns a signed download url", async () => {
    const request = new NextRequest("http://localhost/api/exports/job-1/download");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ url: expect.stringContaining("https://") });
  });

  it("returns 409 if the job is not ready", async () => {
    jobsModule.getExportJobForUser.mockResolvedValueOnce({ id: "job-1", status: "processing" });
    const request = new NextRequest("http://localhost/api/exports/job-1/download");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(409);
  });

  it("returns 404 for missing jobs", async () => {
    jobsModule.getExportJobForUser.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/exports/missing/download");
    const response = await GET(request, { params: { jobId: "missing" } });
    expect(response.status).toBe(404);
  });

  it("returns 401 for unauthorized sessions", async () => {
    const error = new authModule.UnauthorizedError();
    authModule.requireServerAuthSession.mockRejectedValueOnce(error);
    const request = new NextRequest("http://localhost/api/exports/job-1/download");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(401);
  });
});
