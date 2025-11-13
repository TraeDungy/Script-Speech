import { Metadata } from "next";

import type { MarketingContentSlug } from "@/lib/db/marketingContent";
import {
  listMarketingContentRevisions,
  loadDraftMarketingContent,
  loadPublishedMarketingRevision,
} from "@/lib/db/marketingContent";
import type { FAQContent } from "@/lib/siteData";
import type { LandingContent } from "@/data/landing";
import type { MarketingContentRow } from "@/lib/db/schema";
import { MarketingContentEditor } from "@/components/marketing/MarketingContentEditor";

export const metadata: Metadata = {
  title: "Marketing content control room",
};

const MARKETING_SECTIONS: Array<{
  slug: MarketingContentSlug;
  title: string;
  description: string;
}> = [
  {
    slug: "landing",
    title: "Landing page",
    description: "Edit hero, vignettes, cadence, and CTA copy used on scriptspeech.com.",
  },
  {
    slug: "faq",
    title: "FAQ dossier",
    description: "Manage the feature dossier surfaced on the landing page and preview route.",
  },
];

export default async function MarketingAdminPage() {
  const sections = await Promise.all(
    MARKETING_SECTIONS.map(async (section) => {
      const [latestDraft, published, revisions] = await Promise.all([
        loadDraftMarketingContent(section.slug),
        loadPublishedMarketingRevision(section.slug),
        listMarketingContentRevisions(section.slug, { limit: 25 }),
      ]);

      return { ...section, latestDraft, published, revisions };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Marketing controls</p>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-white md:text-4xl">Edit landing and FAQ copy without redeploys.</h1>
          <p className="max-w-3xl text-sm text-zinc-400 md:text-base">
            Save draft snapshots as you collaborate, share previews with stakeholders, and publish when you are ready. All changes are versioned with author details and kept in Supabase.
          </p>
        </div>
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <MarketingContentEditor
            key={section.slug}
            slug={section.slug}
            title={section.title}
            description={section.description}
            latestDraft={section.latestDraft as MarketingContentRow<LandingContent | FAQContent> | null}
            published={section.published as MarketingContentRow<LandingContent | FAQContent> | null}
            revisions={section.revisions as MarketingContentRow<LandingContent | FAQContent>[]}
          />
        ))}
      </div>
    </main>
  );
}
