export const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
export const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY?.trim();
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY));
}
