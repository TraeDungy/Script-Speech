import type { ReactNode } from "react";

import { requireServerAuthSession } from "@/lib/auth/server";

export default async function PreviewLayout({ children }: { children: ReactNode }) {
  await requireServerAuthSession({ redirectTo: "/" });
  return <>{children}</>;
}
