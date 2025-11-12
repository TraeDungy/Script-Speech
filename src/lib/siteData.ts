import { landingContent, type LandingContent } from "@/data/landing";
import { coreFeatures } from "@/data/coreFeatures";
import { platformPillars } from "@/data/platformPillars";
import { workflowStages } from "@/data/workflowStages";

import { getSupabaseServiceClient } from "@/lib/supabase.server";

export type FAQContent = {
  coreFeatures: typeof coreFeatures;
  workflowStages: typeof workflowStages;
  platformPillars: typeof platformPillars;
};

const MARKETING_CONTENT_TABLE =
  process.env.SUPABASE_MARKETING_CONTENT_TABLE ?? "marketing_content";

type MarketingContentRow<T> = {
  slug: string;
  content: T;
  updated_at: string | null;
};

async function fetchMarketingContent<T>(slug: string, fallback: T): Promise<T> {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return structuredClone(fallback);
  }

  try {
    const { data, error } = await supabase
      .from<MarketingContentRow<T>>(MARKETING_CONTENT_TABLE)
      .select("content")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch marketing content for slug "${slug}":`, error);
      return structuredClone(fallback);
    }

    if (!data?.content) {
      return structuredClone(fallback);
    }

    try {
      return structuredClone(data.content);
    } catch (cloneError) {
      console.error(
        `Failed to clone marketing content for slug "${slug}", using fallback instead`,
        cloneError,
      );
      return structuredClone(fallback);
    }
  } catch (error) {
    console.error(`Unexpected error retrieving marketing content for slug "${slug}":`, error);
    return structuredClone(fallback);
  }
}

export async function getLandingContent(): Promise<LandingContent> {
  return fetchMarketingContent<LandingContent>("landing", landingContent);
}

export async function getFaqContent(): Promise<FAQContent> {
  return fetchMarketingContent<FAQContent>("faq", {
    coreFeatures,
    workflowStages,
    platformPillars,
  });
}
