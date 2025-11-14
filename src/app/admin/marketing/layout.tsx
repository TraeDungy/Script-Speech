import type { ReactNode } from "react";

import { requireMarketingAdminSession } from "@/lib/authz/marketing.server";

export default async function MarketingAdminLayout({ children }: { children: ReactNode }) {
  await requireMarketingAdminSession({ redirectTo: "/" });
  return <>{children}</>;
}
