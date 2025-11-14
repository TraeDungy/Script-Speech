import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const dbModule = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));

const authModule = vi.hoisted(() => ({
  requireServerAuthSession: vi.fn(),
  UnauthorizedError: class extends Error {},
}));

const auditModule = vi.hoisted(() => ({
  logAuditEvent: vi.fn(),
}));

const observabilityModule = vi.hoisted(() => ({
  recordApiRequest: vi.fn(),
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
  logStructuredEvent: vi.fn(),
  withSpan: async (_options: unknown, fn: (span: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: () => {} }),
}));

vi.mock("@/lib/db/projects", () => dbModule);
vi.mock("@/lib/auth/server", () => authModule);
vi.mock("@/lib/auditLog", () => auditModule);
vi.mock("@/lib/observability", () => observabilityModule);

const mockListProjects = dbModule.listProjects;
const mockCreateProject = dbModule.createProject;
const mockRequireServerAuthSession = authModule.requireServerAuthSession;
const mockLogAuditEvent = auditModule.logAuditEvent;
const mockRecordApiError = observabilityModule.recordApiError;
const UnauthorizedError = authModule.UnauthorizedError;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
});

describe("/api/projects", () => {
  it("lists projects for the authenticated user", async () => {
    mockListProjects.mockResolvedValueOnce({ projects: [], total: 0, hasMore: false });
    const request = new NextRequest("http://localhost/api/projects?limit=10&status=draft");

    const response = await GET(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [], total: 0, hasMore: false });
    expect(mockListProjects).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", limit: 10, status: "draft" }),
    );
  });

  it("returns 401 when authentication fails", async () => {
    mockRequireServerAuthSession.mockRejectedValueOnce(new UnauthorizedError("nope"));
    const request = new NextRequest("http://localhost/api/projects");

    const response = await GET(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockRecordApiError).toHaveBeenCalledWith("projects", "GET", 401);
  });

  it("handles GET failures", async () => {
    const error = new Error("db down");
    mockListProjects.mockRejectedValueOnce(error);
    const request = new NextRequest("http://localhost/api/projects");

    const response = await GET(request);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to load projects" });
  });

  it("creates a project for the authenticated user", async () => {
    const project = { id: "p1", title: "Pilot", scriptType: "feature" };
    mockCreateProject.mockResolvedValueOnce(project);

    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ title: project.title, scriptType: project.scriptType }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ project });
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: project.title, ownerId: "user-1" }),
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project.create", projectId: project.id }),
    );
  });

  it("rejects invalid POST payloads", async () => {
    const request = new NextRequest("http://localhost/api/projects", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
  });

  it("returns 401 when project creation lacks auth", async () => {
    mockRequireServerAuthSession.mockRejectedValueOnce(new UnauthorizedError("no session"));
    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ title: "Doc", scriptType: "short" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
