import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, POST } from "./route";

const accessRequestModule = vi.hoisted(() => {
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
    listAccessRequests: vi.fn(),
    createAccessRequest: vi.fn(),
  };
});

const notificationsModule = vi.hoisted(() => ({
  sendAccessRequestNotifications: vi.fn(),
}));

vi.mock("@/lib/accessRequests.server", () => accessRequestModule);
vi.mock("@/lib/notifications.server", () => notificationsModule);

const { AccessRequestError } = accessRequestModule;
const mockListAccessRequests = accessRequestModule.listAccessRequests;
const mockCreateAccessRequest = accessRequestModule.createAccessRequest;
const mockSendNotifications = notificationsModule.sendAccessRequestNotifications;

const observabilityModule = vi.hoisted(() => ({
  recordApiRequest: vi.fn(),
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
  logStructuredEvent: vi.fn(),
  recordBusinessEvent: vi.fn(),
  withSpan: async (_options: unknown, fn: (span: { setAttribute: () => void }) => Promise<NextResponse>) =>
    fn({ setAttribute: () => {} }),
}));

vi.mock("@/lib/observability", () => observabilityModule);
vi.mock("@/lib/requestContext", () => ({
  getRequestIdFromHeaders: vi.fn(() => "app-request-id"),
  createRequestLogger: () => vi.fn(),
}));

const mockCaptureApiException = observabilityModule.captureApiException;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/request-access", () => {
  it("returns stored requests", async () => {
    mockListAccessRequests.mockResolvedValueOnce([
      { id: "1", email: "demo@example.com", submittedAt: new Date().toISOString() },
    ]);

    const response = await GET(new Request("http://localhost/api/request-access"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requests: [{ id: "1", email: "demo@example.com", submittedAt: expect.any(String) }],
    });
  });

  it("creates access request and notifies", async () => {
    const record = {
      id: "req-1",
      email: "demo@example.com",
      submittedAt: new Date().toISOString(),
    };
    mockCreateAccessRequest.mockResolvedValueOnce(record);
    mockSendNotifications.mockResolvedValueOnce(undefined);

    const request = new Request("http://localhost/api/request-access", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify({ email: record.email, message: "Hello" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      request: record,
    });

    expect(mockCreateAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({ email: record.email, message: "Hello" }),
    );
    expect(mockSendNotifications).toHaveBeenCalledWith(record);
  });

  it("returns client error for known validation issues", async () => {
    const error = new AccessRequestError("Invalid email", 422);
    mockCreateAccessRequest.mockRejectedValueOnce(error);

    const request = new Request("http://localhost/api/request-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ success: false, message: "Invalid email" });
    expect(mockCaptureApiException).not.toHaveBeenCalled();
  });

  it("captures unexpected errors", async () => {
    const error = new Error("boom");
    mockCreateAccessRequest.mockRejectedValueOnce(error);

    const request = new Request("http://localhost/api/request-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(mockCaptureApiException).toHaveBeenCalled();
  });
});
