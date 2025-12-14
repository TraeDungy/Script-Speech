import type { ReactNode } from "react";

// import { requireServerAuthSession } from "@/lib/auth/server";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  // Temporarily disabled auth for preview/testing
  // TODO: Re-enable authentication before production
  // await requireServerAuthSession({ redirectTo: "/" });
  return <>{children}</>;
}
