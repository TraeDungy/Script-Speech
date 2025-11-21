import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/exports/route";
import { requireServerAuthSession } from "@/lib/auth/server";
import { ensureProjectMembership } from "@/lib/authz/projects.server";
import { createQueuedExportJob, getExportJobForUser, listExportJobsForUser } from "@/lib/exports/jobs";
import { getSupabaseServiceClient } from "@/lib/supabase.server";
import { updateExportJobForUser } from "@/lib/exports/jobs";
import { recordBusinessEvent, withSpan } from "@/lib/observability";

const logSpy = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  requireServerAuthSession: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/authz/projects.server", () => ({
  ensureProjectMembership: vi.fn(),
  ProjectAuthorizationError: class ProjectAuthorizationError extends Error {},
}));

vi.mock("@/lib/supabase.server", () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/exports/jobs", () => ({
  createQueuedExportJob: vi.fn(),
  getExportJobForUser: vi.fn(),
  listExportJobsForUser: vi.fn(),
  updateExportJobForUser: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  recordBusinessEvent: vi.fn(),
  withSpan: vi.fn(
    (options: unknown, callback: (span: { setAttribute: () => void }, ...args: unknown[]) => Promise<Response>, ...args: unknown[]) =>
      callback({ setAttribute: () => {} }, ...args),
  ),
}));

vi.mock("@/lib/requestContext", () => ({
  REQUEST_ID_HEADER: "x-request-id",
  createRequestLogger: () => logSpy,
  getRequestIdFromHeaders: vi.fn(() => "export-request-id"),
}));

describe("exports API", () => {
  const supabaseMock = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { doc: { metadata: { projectId: "project-1" } }, user_id: "user-1", project_id: "project-1" },
        error: null,
      }),
    })),
    storage: {
      from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }) })),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy.mockClear();
    (requireServerAuthSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (ensureProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("returns 503 when Supabase client is unavailable", async () => {
    (getSupabaseServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({ scriptDocId: "doc-1", content: { doc: true } }),
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Supabase client");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("queues an export job and returns the job payload", async () => {
    (getSupabaseServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabaseMock);
    const job = {
      id: "job-1",
      userId: "user-1",
      format: "pdf",
      createdAt: new Date().toISOString(),
      status: "queued",
      downloadPath: null,
      errorMessage: null,
    } as const;

    (createQueuedExportJob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(job);
    (updateExportJobForUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({ content: { metadata: { projectId: "project-1" } }, format: "pdf" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject(job);
    expect(createQueuedExportJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", format: "pdf" }),
    );
    expect(recordBusinessEvent).toHaveBeenCalledWith(
      "export_jobs_enqueued_total",
      "Queued export jobs",
      expect.objectContaining({ format: "pdf" }),
    );
    expect(withSpan).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ requestId: "export-request-id" }) }),
      expect.any(Function),
    );
    expect(response.headers.get("x-request-id")).toBe("export-request-id");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("returns a users export job when an id is provided", async () => {
    (getSupabaseServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabaseMock);
    const job = { id: "job-2", userId: "user-1", status: "queued" };
    (getExportJobForUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(job);

    const response = await GET(new Request("http://localhost/api/exports?id=job-2"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(job);
    expect(getExportJobForUser).toHaveBeenCalledWith("job-2", "user-1");
  });

  it("lists export jobs for the authenticated user when no id is provided", async () => {
    (getSupabaseServiceClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabaseMock);
    (listExportJobsForUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "job-3", userId: "user-1", status: "completed" },
    ]);

    const response = await GET(new Request("http://localhost/api/exports"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([{ id: "job-3", userId: "user-1", status: "completed" }]);
  });
});
