import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/server";
import { enforceRateLimit } from "@/lib/rateLimit";

interface RateLimitRule {
  matcher: RegExp;
  methods: string[];
  limit: number;
  windowMs: number;
  prefix: string;
}

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    matcher: /^\/api\/assets$/,
    methods: ["POST", "PUT"],
    limit: 25,
    windowMs: 60_000,
    prefix: "rate:assets",
  },
  {
    matcher: /^\/api\/realtime\/orchestrator/,
    methods: ["POST"],
    limit: 120,
    windowMs: 60_000,
    prefix: "rate:realtime",
  },
  {
    matcher: /^\/api\/projects\/[^/]+\/script-doc\/orchestrate/,
    methods: ["POST"],
    limit: 30,
    windowMs: 60_000,
    prefix: "rate:orchestrate",
  },
];

function resolveIp(request: NextRequest): string | null {
  return (
    request.ip ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

async function resolveRateLimitKey(request: NextRequest): Promise<string> {
  const user = await getUserFromRequest(request);
  if (user) {
    return user.id;
  }

  return resolveIp(request) ?? "anonymous";
}

export async function middleware(request: NextRequest) {
  const rule = RATE_LIMIT_RULES.find(
    (entry) => entry.matcher.test(request.nextUrl.pathname) && entry.methods.includes(request.method),
  );

  if (!rule) {
    return NextResponse.next();
  }

  const key = await resolveRateLimitKey(request);
  const rate = await enforceRateLimit({
    key,
    limit: rule.limit,
    windowMs: rule.windowMs,
    prefix: rule.prefix,
  });

  if (rate.allowed) {
    return NextResponse.next();
  }

  const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)).toString();
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429, headers: { "Retry-After": retryAfter } },
  );
}

export const config = {
  matcher: ["/api/assets", "/api/realtime/orchestrator", "/api/projects/:path*/script-doc/orchestrate"],
};
