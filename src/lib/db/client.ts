import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./config";
import type { Database } from "./generated.types";

type CachedGlobal = typeof globalThis & {
  __scriptSpeechSupabaseClient?: SupabaseClient<Database>;
};

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured() || !SUPABASE_URL) {
    throw new Error("Supabase is not configured");
  }

  const globalRef = globalThis as CachedGlobal;
  if (globalRef.__scriptSpeechSupabaseClient) {
    return globalRef.__scriptSpeechSupabaseClient;
  }

  const key = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Supabase credentials are missing");
  }

  const client = createClient<Database>(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "script-speech/dev",
      },
    },
  });

  globalRef.__scriptSpeechSupabaseClient = client;
  return client;
}
