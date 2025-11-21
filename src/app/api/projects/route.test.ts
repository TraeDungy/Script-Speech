import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const projectsApiModule = vi.hoisted(() => ({
  listProjectsForUser: vi.fn(),
  createProjectWithDoc: vi.fn(),
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
  withSpan: async (_options: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/projectsApi.server", () => projectsApiModule);
vi.mock("@/lib/auth/server", () => authModule);
vi.mock("@/lib/auditLog", () => auditModule);
vi.mock("@/lib/observability", () => observabilityModule);

const mockListProjects = projectsApiModule.listProjectsForUser;
const mockCreateProjectWithDoc = projectsApiModule.createProjectWithDoc;
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
    mockListProjects.mockResolvedValueOnce([]);
    const request = new NextRequest("http://localhost/api/projects?limit=10");

    const response = await GET(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [] });
    expect(mockListProjects).toHaveBeenCalledWith("user-1", { limit: 10 });
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

  it("rejects invalid limit parameter", async () => {
    const request = new NextRequest("http://localhost/api/projects?limit=abc");

    const response = await GET(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid limit parameter" });
    expect(mockListProjects).not.toHaveBeenCalled();
    expect(mockRecordApiError).toHaveBeenCalledWith("projects", "GET", 400);
  });

  it("creates a project and script doc for the authenticated user", async () => {
    const result = { project: { id: "p1", title: "Pilot", scriptType: "feature", metadata: {}, updatedAt: "" }, scriptDoc: null };
    mockCreateProjectWithDoc.mockResolvedValueOnce(result);

    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ title: result.project.title, scriptType: result.project.scriptType }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(result);
    expect(mockCreateProjectWithDoc).toHaveBeenCalledWith("user-1", {
      title: result.project.title,
      scriptType: result.project.scriptType,
      metadata: {},
      scriptDoc: undefined,
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project.create", projectId: result.project.id }),
    );
  });

  it("rejects invalid POST payloads", async () => {
    const request = new NextRequest("http://localhost/api/projects", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
  });

  it("rejects missing required fields", async () => {
    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ title: "Doc" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Both title and scriptType are required" });
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
