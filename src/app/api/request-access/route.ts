import { NextResponse } from "next/server";

import {
  AccessRequestError,
  createAccessRequest,
  listAccessRequests,
} from "@/lib/accessRequests.server";
import { sendAccessRequestNotifications } from "@/lib/notifications.server";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

export async function GET() {
  recordApiRequest("request-access", "GET");

  try {
    return await withSpan(
      { name: "api.request-access.get", attributes: { route: "/api/request-access" } },
      async (span) => {
        const requests = await listAccessRequests();
        span.setAttribute("request.count", requests.length);
        return NextResponse.json({ requests });
      },
    );
  } catch (error) {
    recordApiError("request-access", "GET", 500);
    logStructuredEvent({ level: "error", message: "access-request.list.failed", error });
    await captureApiException(error, { route: "request-access", method: "GET", status: 500 });
    return NextResponse.json(
      { success: false, message: "Unable to load access requests right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  recordApiRequest("request-access", "POST");

  try {
    const payload = await request.json();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const response = await withSpan(
      { name: "api.request-access.post", attributes: { route: "/api/request-access" } },
      async (span) => {
        const record = await createAccessRequest({
          email: payload?.email ?? "",
          message: payload?.message,
          metadata: payload?.metadata,
          client: {
            ip: clientIp,
            userAgent,
          },
        });

        span.setAttribute("request.id", record.id);
        span.setAttribute("request.email", record.email);

        await sendAccessRequestNotifications(record);

        return NextResponse.json(
          {
            success: true,
            request: record,
            message: "Thanks for requesting access. We will be in touch shortly.",
          },
          { status: 201 },
        );
      },
    );

    logStructuredEvent({
      level: "info",
      message: "access-request.received",
      context: {
        email: payload?.email,
        hasMetadata: Boolean(payload?.metadata),
        clientIp,
      },
    });

    return response;
  } catch (error) {
    const status = error instanceof AccessRequestError ? error.statusCode : 400;
    const message =
      error instanceof Error ? error.message : "Unable to process your request right now.";

    recordApiError("request-access", "POST", status);
    logStructuredEvent({ level: "error", message: "access-request.create.failed", error });
    if (!(error instanceof AccessRequestError)) {
      await captureApiException(error, { route: "request-access", method: "POST", status });
    }

    return NextResponse.json({ success: false, message }, { status });
  }
}
