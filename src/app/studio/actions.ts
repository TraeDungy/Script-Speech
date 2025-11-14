import type { StudioHydrationPayload } from "@/lib/db/projects";
import type { EntityAsset, ReferenceAsset } from "@/lib/types/assets";

export interface StudioProjectDataResponse extends StudioHydrationPayload {
  assets?: {
    references: ReferenceAsset[];
    entity: EntityAsset[];
  };
}

function resolveBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export async function fetchStudioProjectData(projectId: string): Promise<StudioProjectDataResponse> {
  if (!projectId) {
    throw new Error("A projectId is required to fetch studio data");
  }

  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: typeof window !== "undefined" ? "include" : "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Unable to load project");
  }

  return (await response.json()) as StudioProjectDataResponse;
}
