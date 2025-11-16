import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const exportsModule = vi.hoisted(() => ({
  enqueueExportJob: vi.fn(),
}));

const authModule = vi.hoisted(() => ({
  requireServerAuthSession: vi.fn(),
  UnauthorizedError: class extends Error {},
}));

const authzModule = vi.hoisted(() => ({
  ensureProjectMembership: vi.fn(),
  ProjectAuthorizationError: class extends Error {},
}));

const rateLimitModule = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
}));

const auditModule = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
}));

const observabilityModule = vi.hoisted(() => ({
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
}));

const dbModule = vi.hoisted(() => ({
  listExportJobRecords: vi.fn(),
}));

vi.mock("@/lib/exports", () => exportsModule);
vi.mock("@/lib/auth/server", () => authModule);
vi.mock("@/lib/authz/projects.server", () => authzModule);
vi.mock("@/lib/rateLimit", () => rateLimitModule);
vi.mock("@/lib/auditLog", () => auditModule);
vi.mock("@/lib/observability", () => observabilityModule);
vi.mock("@/lib/db/exportJobs", () => dbModule);

const mockEnqueueExportJob = exportsModule.enqueueExportJob;
const mockRequireServerAuthSession = authModule.requireServerAuthSession;
const UnauthorizedError = authModule.UnauthorizedError;
const mockEnsureProjectMembership = authzModule.ensureProjectMembership;
const ProjectAuthorizationError = authzModule.ProjectAuthorizationError;
const mockEnforceRateLimit = rateLimitModule.enforceRateLimit;
const mockLogAuditEvent = auditModule.logAuditEvent;
const mockCaptureException = observabilityModule.captureApiException;
const mockListExportJobRecords = dbModule.listExportJobRecords;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  mockEnforceRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 });
  mockListExportJobRecords.mockResolvedValue([]);
});

describe("/api/projects/[id]/export", () => {
  it("lists export jobs for the project", async () => {
    const jobs = [{ id: "job-1" }];
    mockListExportJobRecords.mockResolvedValueOnce(jobs);
    const request = new NextRequest("http://localhost/api/projects/demo/export?limit=5");

    const response = await GET(request, { params: { id: "demo" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ jobs });
    expect(mockListExportJobRecords).toHaveBeenCalledWith("demo", { limit: 5 });
  });

  it("enforces authentication on GET", async () => {
    mockRequireServerAuthSession.mockRejectedValueOnce(new UnauthorizedError("nope"));
    const request = new NextRequest("http://localhost/api/projects/demo/export");
    const response = await GET(request, { params: { id: "demo" } });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("queues an export job", async () => {
    const job = { id: "job-123", format: "pdf", status: "queued" };
    mockEnqueueExportJob.mockResolvedValueOnce(job);

    const request = new NextRequest("http://localhost/api/projects/demo/export", {
      method: "POST",
      body: JSON.stringify({ format: "pdf", scriptDoc: { scenes: [] }, deliverToEmail: "director@demo.com" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: { id: "demo" } });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual(job);
    expect(mockEnqueueExportJob).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "demo", format: "pdf", deliverToEmail: "director@demo.com" }),
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "export.job.enqueue" }));
  });

  it("rejects invalid POST payload", async () => {
    const request = new NextRequest("http://localhost/api/projects/demo/export", { method: "POST" });
    const response = await POST(request, { params: { id: "demo" } });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
  });

  it("enforces rate limits", async () => {
    mockEnforceRateLimit.mockResolvedValueOnce({ allowed: false, resetAt: Date.now() + 5000 });
    const request = new NextRequest("http://localhost/api/projects/demo/export", {
      method: "POST",
      body: JSON.stringify({ format: "pdf", scriptDoc: { scenes: [] } }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: { id: "demo" } });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Export rate limit exceeded" });
  });

  it("propagates enqueue failures", async () => {
    const error = new Error("boom");
    mockEnqueueExportJob.mockRejectedValueOnce(error);
    const request = new NextRequest("http://localhost/api/projects/demo/export", {
      method: "POST",
      body: JSON.stringify({ format: "pdf", scriptDoc: { scenes: [] } }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: { id: "demo" } });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to enqueue export job" });
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
