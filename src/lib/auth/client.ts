// Client-side auth utilities

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
