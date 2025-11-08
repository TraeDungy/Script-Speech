import type { FAQContent } from "@/lib/siteData";
import type { LandingContent } from "@/data/landing";
import { headers } from "next/headers";

import { getFaqContent, getLandingContent } from "@/lib/siteData";

type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

type MarketingFetchResult<T> = {
  data: T;
  error?: Error;
  source: "remote" | "fallback";
};

const MARKETING_REVALIDATE_SECONDS = 60 * 10; // 10 minutes

function resolveBaseUrl() {
  const headerList = headers();
  const forwardedProto = headerList.get("x-forwarded-proto");
  const inferredProto = forwardedProto ?? (process.env.VERCEL_URL ? "https" : "http");
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? process.env.VERCEL_URL;

  if (host) {
    const normalizedHost = host.startsWith("http") ? host : `${inferredProto}://${host}`;
    return normalizedHost;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    return siteUrl;
  }

  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

async function fetchFromApi<T>(path: string, init?: NextFetchInit, options?: { timeoutMs?: number; retries?: number }) {
  const { timeoutMs = 5000, retries = 2 } = options ?? {};
  const baseUrl = resolveBaseUrl();
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...init?.headers,
          },
          cache: init?.cache ?? "force-cache",
          next: {
            revalidate: MARKETING_REVALIDATE_SECONDS,
            ...init?.next,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as T;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError"
        ? new Error(`Request to ${path} timed out after ${timeoutMs}ms`)
        : error;

      if (attempt === retries) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchLandingContent(): Promise<MarketingFetchResult<LandingContent>> {
  try {
    const data = await fetchFromApi<LandingContent>("/api/landing");
    return { data, source: "remote" };
  } catch (error) {
    console.error("Failed to fetch landing content from API, using local fallback", error);
    const fallback = await getLandingContent();
    return {
      data: fallback,
      error: error instanceof Error ? error : new Error(String(error)),
      source: "fallback",
    };
  }
}

export async function fetchFaqContent(): Promise<MarketingFetchResult<FAQContent>> {
  try {
    const data = await fetchFromApi<FAQContent>("/api/faq");
    return { data, source: "remote" };
  } catch (error) {
    console.error("Failed to fetch FAQ content from API, using local fallback", error);
    const fallback = await getFaqContent();
    return {
      data: fallback,
      error: error instanceof Error ? error : new Error(String(error)),
      source: "fallback",
    };
  }
}
