import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase.server";

import type { MarketingContentRow } from "./schema";

export type MarketingContentSlug = "landing" | "faq";

function shouldLogError(error: PostgrestError | null): error is PostgrestError {
  if (!error) {
    return false;
  }

  // PGRST116 indicates no rows returned for maybeSingle, which is expected
  // when the marketing content has not yet been created.
  return error.code !== "PGRST116";
}

export async function loadMarketingContent<T>(
  slug: MarketingContentSlug,
): Promise<T | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();

  if (shouldLogError(error)) {
    console.error(`Failed to load marketing content for slug "${slug}"`, error);
  }

  return data?.data ?? null;
}
