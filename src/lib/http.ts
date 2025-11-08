import type { FAQContent } from "@/lib/siteData";
import type { LandingContent } from "@/data/landing";
import { headers } from "next/headers";

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

async function fetchFromApi<T>(path: string, init?: RequestInit) {
  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchLandingContent() {
  return fetchFromApi<LandingContent>("/api/landing");
}

export async function fetchFaqContent() {
  return fetchFromApi<FAQContent>("/api/faq");
}
