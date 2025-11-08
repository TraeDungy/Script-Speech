import { NextResponse } from "next/server";

import {
  AccessRequestError,
  createAccessRequest,
  listAccessRequests,
} from "@/lib/accessRequests.server";
import { sendAccessRequestNotifications } from "@/lib/notifications.server";

export async function GET() {
  const requests = await listAccessRequests();
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const record = await createAccessRequest({
      email: payload?.email ?? "",
      message: payload?.message,
      metadata: payload?.metadata,
      client: {
        ip: clientIp,
        userAgent,
      },
    });

    await sendAccessRequestNotifications(record);

    return NextResponse.json(
      {
        success: true,
        request: record,
        message: "Thanks for requesting access. We will be in touch shortly.",
      },
      { status: 201 },
    );
  } catch (error) {
    const status = error instanceof AccessRequestError ? error.statusCode : 400;
    const message =
      error instanceof Error ? error.message : "Unable to process your request right now.";

    return NextResponse.json({ success: false, message }, { status });
  }
}
