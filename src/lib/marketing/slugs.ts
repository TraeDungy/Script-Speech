import type { MarketingContentSlug } from "@/lib/db/marketingContent";

const KNOWN_SLUGS: MarketingContentSlug[] = ["landing", "faq"];

export function parseMarketingSlug(value: string | null | undefined): MarketingContentSlug | null {
  const normalized = value?.toLowerCase();
  return KNOWN_SLUGS.find((slug) => slug === normalized) ?? null;
}
