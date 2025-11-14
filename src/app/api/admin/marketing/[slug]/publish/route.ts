import { NextRequest, NextResponse } from "next/server";

import { publishMarketingContentRevision } from "@/lib/db/marketingContent";
import { requireMarketingAdminSession } from "@/lib/authz/marketing.server";
import { parseMarketingSlug } from "@/lib/marketing/slugs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = parseMarketingSlug(params.slug);
  if (!slug) {
    return errorResponse("Unknown marketing content slug", 404);
  }

  await requireMarketingAdminSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload");
  }

  const payload = body as { revisionId?: string };
  if (!payload.revisionId) {
    return errorResponse("revisionId is required");
  }

  const revision = await publishMarketingContentRevision(payload.revisionId);
  if (!revision || revision.slug !== slug) {
    return errorResponse("Unable to publish revision", 500);
  }

  return NextResponse.json({ revision });
}
