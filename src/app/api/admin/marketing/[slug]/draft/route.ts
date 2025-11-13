import { NextRequest, NextResponse } from "next/server";

import { loadDraftMarketingContent, loadPublishedMarketingRevision, saveMarketingContentDraft } from "@/lib/db/marketingContent";
import { requireMarketingAdminSession } from "@/lib/authz/marketing.server";
import { parseMarketingSlug } from "@/lib/marketing/slugs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const slug = parseMarketingSlug(params.slug);
  if (!slug) {
    return errorResponse("Unknown marketing content slug", 404);
  }

  await requireMarketingAdminSession();

  const [latestDraft, published] = await Promise.all([
    loadDraftMarketingContent(slug),
    loadPublishedMarketingRevision(slug),
  ]);

  return NextResponse.json({ slug, latestDraft, published });
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = parseMarketingSlug(params.slug);
  if (!slug) {
    return errorResponse("Unknown marketing content slug", 404);
  }

  const session = await requireMarketingAdminSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload");
  }

  const payload = body as { data?: unknown };
  if (typeof payload !== "object" || payload.data === undefined) {
    return errorResponse("Missing data payload for draft");
  }

  const revision = await saveMarketingContentDraft(slug, payload.data, {
    id: session.user.id,
    name: (session.user.user_metadata?.full_name as string | undefined) ?? session.user.email,
    email: session.user.email,
  });

  if (!revision) {
    return errorResponse("Unable to save draft", 500);
  }

  return NextResponse.json({ revision });
}
