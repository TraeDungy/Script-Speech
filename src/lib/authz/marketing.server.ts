import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";

function parseAllowlist(): string[] {
  const raw = process.env.MARKETING_ADMIN_EMAILS ?? "";
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireMarketingAdminSession(options?: { redirectTo?: string }) {
  const session = await requireServerAuthSession(options);
  const allowlist = parseAllowlist();
  if (allowlist.length === 0) {
    return session;
  }

  const email = session.user.email?.toLowerCase();
  if (!email || !allowlist.includes(email)) {
    throw new UnauthorizedError("Marketing admin access required");
  }

  return session;
}
