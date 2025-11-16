import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exportsModule = vi.hoisted(() => ({
  getExportJob: vi.fn(),
}));

const authModule = vi.hoisted(() => ({
  requireServerAuthSession: vi.fn(),
  UnauthorizedError: class extends Error {},
}));

const authzModule = vi.hoisted(() => ({
  ensureProjectMembership: vi.fn(),
  ProjectAuthorizationError: class extends Error {},
}));

const auditModule = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
}));

const downloadsModule = vi.hoisted(() => ({
  recordExportDownload: vi.fn(),
}));

vi.mock("@/lib/exports", () => exportsModule);
vi.mock("@/lib/auth/server", () => authModule);
vi.mock("@/lib/authz/projects.server", () => authzModule);
vi.mock("@/lib/auditLog", () => auditModule);
vi.mock("@/lib/db/exportDownloads", () => downloadsModule);
vi.mock("@/lib/supabase.server", () => ({ getSupabaseServiceClient: () => null }));

const mockGetExportJob = exportsModule.getExportJob;
const mockRequireServerAuthSession = authModule.requireServerAuthSession;
const UnauthorizedError = authModule.UnauthorizedError;
const mockEnsureProjectMembership = authzModule.ensureProjectMembership;
const mockRecordDownload = downloadsModule.recordExportDownload;
const mockLogAuditEvent = auditModule.logAuditEvent;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  mockEnsureProjectMembership.mockResolvedValue(undefined);
  mockRecordDownload.mockResolvedValue({ id: "token" });
});

describe("/api/exports/[jobId]/download", () => {
  it("redirects to an existing download URL", async () => {
    mockGetExportJob.mockResolvedValueOnce({
      id: "job-1",
      projectId: "demo",
      format: "pdf",
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: { fileName: "demo.pdf", downloadUrl: "data:text/plain;base64,ZmFrZQ==" },
    });

    const request = new NextRequest("http://localhost/api/exports/job-1/download");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("data:text/plain");
    expect(mockRecordDownload).toHaveBeenCalledWith(expect.objectContaining({ jobId: "job-1" }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "export.job.download" }));
  });

  it("returns 404 when the job is missing", async () => {
    mockGetExportJob.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/exports/missing/download");
    const response = await GET(request, { params: { jobId: "missing" } });
    expect(response.status).toBe(404);
  });

  it("enforces authentication", async () => {
    mockRequireServerAuthSession.mockRejectedValueOnce(new UnauthorizedError("nope"));
    const request = new NextRequest("http://localhost/api/exports/job-1/download");
    const response = await GET(request, { params: { jobId: "job-1" } });
    expect(response.status).toBe(401);
  });
});
