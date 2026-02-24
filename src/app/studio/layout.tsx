import type { ReactNode } from "react";

import { requireServerAuthSession } from "@/lib/auth/server";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  // Demo mode: allow access without auth if Supabase not configured
  const hasSupabaseConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (hasSupabaseConfig) {
    await requireServerAuthSession({ redirectTo: "/" });
  }

  return <>{children}</>;
}
