import { describe, expect, it, beforeEach, vi } from "vitest";

import { GET, POST } from "@/app/api/request-access/route";
import { AccessRequestError, createAccessRequest, listAccessRequests } from "@/lib/accessRequests.server";
import { sendAccessRequestNotifications } from "@/lib/notifications.server";
import { recordBusinessEvent, withSpan } from "@/lib/observability";

const logSpy = vi.fn();
vi.mock("@/lib/accessRequests.server", () => {
  class AccessRequestErrorMock extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = "AccessRequestError";
      this.statusCode = statusCode;
    }
  }
  return {
    AccessRequestError: AccessRequestErrorMock,
    createAccessRequest: vi.fn(),
    listAccessRequests: vi.fn(),
  };
});

vi.mock("@/lib/notifications.server", () => ({
  sendAccessRequestNotifications: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureApiException: vi.fn(),
  recordApiError: vi.fn(),
  recordApiRequest: vi.fn(),
  recordBusinessEvent: vi.fn(),
  withSpan: vi.fn((options: unknown, callback: (span: { setAttribute: () => void }) => Promise<Response>) =>
    callback({ setAttribute: () => {} }),
  ),
}));

vi.mock("@/lib/requestContext", () => ({
  createRequestLogger: () => logSpy,
  getRequestIdFromHeaders: vi.fn(() => "test-request-id"),
}));

describe("request-access API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a list of access requests", async () => {
    (listAccessRequests as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "1", email: "first@example.com" },
    ]);

    const response = await GET(new Request("http://localhost/api/request-access"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.requests).toEqual([
      { id: "1", email: "first@example.com" },
    ]);
  });

  it("returns a fallback error when loading fails", async () => {
    (listAccessRequests as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    const response = await GET(new Request("http://localhost/api/request-access"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ success: false, message: expect.stringContaining("Unable") });
  });

  it("creates a request and returns success", async () => {
    const record = { id: "123", email: "user@example.com" };
    (createAccessRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const response = await POST(
      new Request("http://localhost/api/request-access", {
        method: "POST",
        body: JSON.stringify({ email: record.email }),
        headers: { "content-type": "application/json", "x-request-id": "abc" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ success: true, request: record });
    expect(sendAccessRequestNotifications).toHaveBeenCalledWith(record);
    expect(recordBusinessEvent).toHaveBeenCalledWith(
      "access_request_submissions_total",
      "Count of access requests",
      expect.objectContaining({ status: "created" }),
    );
    expect(withSpan).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ requestId: "test-request-id" }) }),
      expect.any(Function),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "access-request.received",
        context: expect.objectContaining({ requestId: "test-request-id" }),
      }),
    );
  });

  it("returns an AccessRequestError status when validation fails", async () => {
    const error = new AccessRequestError("Invalid", 422);
    (createAccessRequest as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/request-access", {
        method: "POST",
        body: JSON.stringify({ email: "bad" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ success: false, message: error.message });
  });
});
