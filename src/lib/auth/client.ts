"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

function resolveSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_KEY?.trim();
  return { url, key };
}

export function isBrowserSupabaseConfigured(): boolean {
  const { url, key } = resolveSupabaseConfig();
  return Boolean(url && key);
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const { url, key } = resolveSupabaseConfig();
  if (!url || !key) {
    cachedClient = null;
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase browser client is not configured");
    }
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "script-speech-auth", // custom key for clarity
      autoRefreshToken: true,
    },
    global: {
      headers: {
        "X-Client-Info": "script-speech/web",
      },
    },
  });

  return cachedClient;
}

async function postJson(path: string, payload: Record<string, unknown>) {
  await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    cache: "no-store",
  });
}

async function deleteJson(path: string) {
  await fetch(path, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
}

export async function syncSessionCookie(session: Session | null): Promise<void> {
  try {
    if (session?.access_token) {
      await postJson("/api/auth/session", {
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? undefined,
      });
      return;
    }

    await deleteJson("/api/auth/session");
  } catch (error) {
    console.warn("Failed to sync session cookie", error);
  }
}
