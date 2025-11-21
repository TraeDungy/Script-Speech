import { NextResponse } from "next/server";

import {
  AccessRequestError,
  createAccessRequest,
  listAccessRequests,
} from "@/lib/accessRequests.server";
import { sendAccessRequestNotifications } from "@/lib/notifications.server";
import {
  captureApiException,
  recordApiError,
  recordApiRequest,
  recordBusinessEvent,
  withSpan,
} from "@/lib/observability";
import { createRequestLogger, getRequestIdFromHeaders } from "@/lib/requestContext";

export async function GET(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const log = createRequestLogger(requestId);
  recordApiRequest("request-access", "GET");

  try {
    return await withSpan(
      { name: "api.request-access.get", attributes: { route: "/api/request-access", requestId } },
      async (span) => {
        const requests = await listAccessRequests();
        span.setAttribute("request.count", requests.length);
        return NextResponse.json({ requests });
      },
    );
  } catch (error) {
    recordApiError("request-access", "GET", 500);
    log({ level: "error", message: "access-request.list.failed", error });
    await captureApiException(error, { route: "request-access", method: "GET", status: 500 });
    return NextResponse.json(
      { success: false, message: "Unable to load access requests right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const log = createRequestLogger(requestId);
  recordApiRequest("request-access", "POST");

  try {
    const payload = await request.json();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const response = await withSpan(
      {
        name: "api.request-access.post",
        attributes: { route: "/api/request-access", requestId },
      },
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

        recordBusinessEvent("access_request_submissions_total", "Count of access requests", {
          status: "created",
        });

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

    log({
      level: "info",
      message: "access-request.received",
      context: {
        email: payload?.email,
        hasMetadata: Boolean(payload?.metadata),
        clientIp,
        requestId,
      },
    });

    return response;
  } catch (error) {
    const status = error instanceof AccessRequestError ? error.statusCode : 400;
    const message =
      error instanceof Error ? error.message : "Unable to process your request right now.";

    recordApiError("request-access", "POST", status);
    log({
      level: "error",
      message: "access-request.create.failed",
      error,
      context: { requestId },
    });
    if (!(error instanceof AccessRequestError)) {
      await captureApiException(error, { route: "request-access", method: "POST", status });
    }

    return NextResponse.json({ success: false, message }, { status });
  }
}
