import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase.server";

import type { MarketingContentRow, MarketingContentStatus } from "./schema";

export type MarketingContentSlug = "landing" | "faq";

function shouldLogError(error: PostgrestError | null): error is PostgrestError {
  if (!error) {
    return false;
  }

  // PGRST116 indicates no rows returned for maybeSingle, which is expected
  // when the marketing content has not yet been created.
  return error.code !== "PGRST116";
}

async function fetchLatestRevision<T>(slug: MarketingContentSlug, status: MarketingContentStatus) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .select("*")
    .eq("slug", slug)
    .eq("status", status)
    .order(status === "published" ? "published_at" : "created_at", { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle();

  if (shouldLogError(error)) {
    console.error(`Failed to load marketing content for slug "${slug}"`, error);
  }

  return data ?? null;
}

export async function loadMarketingContent<T>(slug: MarketingContentSlug): Promise<T | null> {
  const revision = await fetchLatestRevision<T>(slug, "published");
  return revision?.data ?? null;
}

export async function loadPublishedMarketingRevision<T>(
  slug: MarketingContentSlug,
): Promise<MarketingContentRow<T> | null> {
  return fetchLatestRevision<T>(slug, "published");
}

export async function loadDraftMarketingContent<T>(
  slug: MarketingContentSlug,
): Promise<MarketingContentRow<T> | null> {
  return fetchLatestRevision<T>(slug, "draft");
}

export async function listMarketingContentRevisions<T>(
  slug: MarketingContentSlug,
  options: { limit?: number } = {},
): Promise<MarketingContentRow<T>[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .select("*")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 20);

  if (shouldLogError(error)) {
    console.error(`Failed to list marketing content revisions for slug "${slug}"`, error);
    return [];
  }

  return data ?? [];
}

export type MarketingRevisionAuthor = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export async function saveMarketingContentDraft<T>(
  slug: MarketingContentSlug,
  data: T,
  author: MarketingRevisionAuthor,
): Promise<MarketingContentRow<T> | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const { data: inserted, error } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .insert({
      slug,
      data,
      status: "draft",
      author_id: author.id,
      author_name: author.name ?? null,
      author_email: author.email ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error(`Failed to save marketing draft for slug "${slug}"`, error);
    return null;
  }

  return inserted;
}

export async function publishMarketingContentRevision<T>(
  revisionId: string,
): Promise<MarketingContentRow<T> | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const { data: revision, error: fetchError } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .select("*")
    .eq("id", revisionId)
    .maybeSingle();

  if (shouldLogError(fetchError)) {
    console.error(`Failed to load marketing revision ${revisionId} before publish`, fetchError);
    return null;
  }

  if (!revision) {
    return null;
  }

  const { error: archiveError } = await supabase
    .from("marketing_content")
    .update({ status: "archived" })
    .eq("slug", revision.slug)
    .eq("status", "published");

  if (shouldLogError(archiveError)) {
    console.error(`Failed to archive previous published marketing content for slug "${revision.slug}"`, archiveError);
  }

  const { data: updated, error: publishError } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", revisionId)
    .select("*")
    .single();

  if (publishError) {
    console.error(`Failed to publish marketing revision ${revisionId}`, publishError);
    return null;
  }

  return updated;
}

export async function getMarketingContentRevisionById<T>(
  revisionId: string,
): Promise<MarketingContentRow<T> | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from<MarketingContentRow<T>>("marketing_content")
    .select("*")
    .eq("id", revisionId)
    .maybeSingle();

  if (shouldLogError(error)) {
    console.error(`Failed to load marketing content revision ${revisionId}`, error);
  }

  return data ?? null;
}
