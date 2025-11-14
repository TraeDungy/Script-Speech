import { notFound } from "next/navigation";

import { LandingExperience } from "@/components/marketing/LandingExperience";
import { FaqExperience } from "@/components/marketing/FaqExperience";
import { getMarketingContentRevisionById } from "@/lib/db/marketingContent";
import type { LandingContent } from "@/data/landing";
import type { FAQContent } from "@/lib/siteData";
import { parseMarketingSlug } from "@/lib/marketing/slugs";
import { getFaqContent } from "@/lib/siteData";
import { requireMarketingAdminSession } from "@/lib/authz/marketing.server";

function PreviewBanner({ revisionId }: { revisionId: string }) {
  return (
    <div className="border border-amber-400/40 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
      Previewing revision {revisionId}. This view is only visible to marketing admins.
    </div>
  );
}

export default async function MarketingPreviewPage({
  params,
}: {
  params: { slug: string; revisionId: string };
}) {
  await requireMarketingAdminSession();
  const slug = parseMarketingSlug(params.slug);
  if (!slug) {
    notFound();
  }

  const revision = await getMarketingContentRevisionById<LandingContent | FAQContent>(params.revisionId);
  if (!revision || revision.slug !== slug) {
    notFound();
  }

  const banner = <PreviewBanner revisionId={revision.id} />;

  if (slug === "landing") {
    const faq = await getFaqContent();
    return (
      <div className="space-y-6">
        {banner}
        <LandingExperience landing={revision.data as LandingContent} faq={faq} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner}
      <FaqExperience faq={revision.data as FAQContent} />
    </div>
  );
}
