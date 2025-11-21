import { describe, expect, it, beforeEach, vi } from "vitest";

import { GET, POST } from "@/app/api/request-access/route";
import { AccessRequestError, createAccessRequest, listAccessRequests } from "@/lib/accessRequests.server";
import { sendAccessRequestNotifications } from "@/lib/notifications.server";

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
  logStructuredEvent: vi.fn(),
  recordApiError: vi.fn(),
  recordApiRequest: vi.fn(),
  withSpan: (_options: unknown, callback: (span: { setAttribute: () => void }) => Promise<Response>) =>
    callback({ setAttribute: () => {} }),
}));

describe("request-access API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a list of access requests", async () => {
    (listAccessRequests as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "1", email: "first@example.com" },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.requests).toEqual([
      { id: "1", email: "first@example.com" },
    ]);
  });

  it("returns a fallback error when loading fails", async () => {
    (listAccessRequests as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    const response = await GET();
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
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ success: true, request: record });
    expect(sendAccessRequestNotifications).toHaveBeenCalledWith(record);
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
