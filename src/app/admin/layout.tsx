import type { ReactNode } from "react";

import { requireServerAuthSession } from "@/lib/auth/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireServerAuthSession({ redirectTo: "/" });
  return <>{children}</>;
}
