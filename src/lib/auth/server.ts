import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase.server";

export const ACCESS_TOKEN_COOKIE = "sb-access-token";
export const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
const AUTHORIZATION_HEADER = "authorization";

export interface ServerAuthSession {
  user: User;
  accessToken: string;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/Bearer\s+([^\s]+)/i);
  return match ? match[1] : null;
}

function readAccessToken(): string | null {
  const cookieStore = cookies();
  const cookieToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value?.trim();
  if (cookieToken) {
    return cookieToken;
  }

  const headerToken = extractBearerToken(headers().get(AUTHORIZATION_HEADER));
  return headerToken ?? null;
}

export function readAccessTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value?.trim();
  if (cookieToken) {
    return cookieToken;
  }

  const headerToken = extractBearerToken(request.headers.get(AUTHORIZATION_HEADER));
  return headerToken ?? null;
}

async function resolveUser(accessToken: string): Promise<User | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.warn("Failed to resolve Supabase user", error);
    return null;
  }
}

export async function getUserFromAccessToken(accessToken: string): Promise<User | null> {
  return resolveUser(accessToken);
}

export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  const accessToken = readAccessTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  return resolveUser(accessToken);
}

export async function getServerAuthSession(): Promise<ServerAuthSession | null> {
  const accessToken = readAccessToken();
  if (!accessToken) {
    return null;
  }

  const user = await resolveUser(accessToken);
  if (!user) {
    return null;
  }

  return { user, accessToken };
}

export async function requireServerAuthSession(options?: {
  redirectTo?: string;
}): Promise<ServerAuthSession> {
  const session = await getServerAuthSession();
  if (session) {
    return session;
  }

  if (options?.redirectTo) {
    redirect(options.redirectTo);
  }

  throw new UnauthorizedError();
}
