// Client-side auth utilities
import { createClient } from '@supabase/supabase-js';

// Check if Supabase is configured in browser
export function isBrowserSupabaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Get Supabase browser client
export function getSupabaseBrowserClient() {
  if (!isBrowserSupabaseConfigured()) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

// Sync session cookie (no-op for now, will be implemented with Supabase)
export async function syncSessionCookie() {
  // TODO: Implement when Supabase credentials are available
  return;
}

export async function logout() {
  // Demo mode cleanup
  sessionStorage.removeItem('demoUserLoggedIn');
  localStorage.removeItem('demoUserEmail');

  // Redirect to home
  window.location.href = '/';
}

export function isDemoUser(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('demoUserLoggedIn') === 'true';
}

export function getDemoUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('demoUserEmail') || localStorage.getItem('demoUser');
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Supabase session (will be added when credentials provided)
  const supabaseSession = sessionStorage.getItem('sb-auth-token');
  if (supabaseSession) return true;

  // Check for demo mode
  return isDemoUser();
}
