export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { listMarketingContentRevisions } from "@/lib/db/marketingContent";
import { requireMarketingAdminSession } from "@/lib/authz/marketing.server";
import { parseMarketingSlug } from "@/lib/marketing/slugs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = parseMarketingSlug(params.slug);
  if (!slug) {
    return errorResponse("Unknown marketing content slug", 404);
  }

  await requireMarketingAdminSession();

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const revisions = await listMarketingContentRevisions(slug, {
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
  });

  return NextResponse.json({ slug, revisions });
}
