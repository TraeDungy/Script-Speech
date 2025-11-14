import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const siteDataModule = vi.hoisted(() => ({
  getLandingContent: vi.fn(),
}));

const observabilityModule = vi.hoisted(() => ({
  recordApiRequest: vi.fn(),
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
  logStructuredEvent: vi.fn(),
  withSpan: async (_options: unknown, fn: (span: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: () => {} }),
}));

vi.mock("@/lib/siteData", () => siteDataModule);
vi.mock("@/lib/observability", () => observabilityModule);

const mockGetLandingContent = siteDataModule.getLandingContent;
const mockRecordApiError = observabilityModule.recordApiError;
const mockCaptureApiException = observabilityModule.captureApiException;

describe("/api/landing", () => {
  it("returns landing content", async () => {
    mockGetLandingContent.mockResolvedValueOnce({
      hero: { title: "Hero", description: "Desc", phrases: [] },
      vignettes: [],
      cadence: [],
      callToAction: {
        eyebrow: "CTA",
        title: "Do it",
        description: "now",
        primaryCta: { label: "Go", href: "/" },
        secondaryCta: { label: "Stay", href: "/stay" },
        helper: "Help",
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ hero: { title: "Hero" } });
  });

  it("handles failures by returning 500", async () => {
    const error = new Error("boom");
    mockGetLandingContent.mockRejectedValueOnce(error);

    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to load landing content" });
    expect(mockRecordApiError).toHaveBeenCalledWith("landing", "GET", 500);
    expect(mockCaptureApiException).toHaveBeenCalledWith(error, {
      route: "landing",
      method: "GET",
      status: 500,
    });
  });
});
