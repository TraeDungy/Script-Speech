export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/server";
import { logAuditEvent } from "@/lib/auditLog";
import { getSupabaseServiceClient } from "@/lib/supabase.server";

export const runtime = "nodejs";

interface SessionPayload {
  accessToken?: string;
  refreshToken?: string;
}

function setAuthCookie(name: string, value: string, maxAgeSeconds: number) {
  const cookieStore = cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function POST(request: Request) {
  let payload: SessionPayload;
  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const accessToken = payload.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }

    setAuthCookie(ACCESS_TOKEN_COOKIE, accessToken, 60 * 60);

    if (payload.refreshToken?.trim()) {
      setAuthCookie(REFRESH_TOKEN_COOKIE, payload.refreshToken.trim(), 60 * 60 * 24 * 30);
    }

    await logAuditEvent({
      action: "auth.session.sync",
      userId: data.user.id,
      details: { source: "browser" },
    });

    return NextResponse.json({ ok: true, user: { id: data.user.id } });
  } catch (error) {
    console.error("Failed to sync session", error);
    return NextResponse.json({ error: "Unable to sync session" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  return NextResponse.json({ ok: true }, { status: 200 });
}
