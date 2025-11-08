import { NextResponse } from "next/server";

import {
  createAccessRequest,
  listAccessRequests,
} from "@/lib/accessRequests";

export async function GET() {
  const requests = await listAccessRequests();
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const record = await createAccessRequest({
      email: payload?.email ?? "",
      message: payload?.message,
    });

    return NextResponse.json({ success: true, request: record }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process your request right now.";

    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
