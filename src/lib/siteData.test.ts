import { describe, expect, it, vi } from "vitest";

import { getFaqContent, getLandingContent } from "./siteData";

const marketingModule = vi.hoisted(() => ({
  loadMarketingContent: vi.fn(),
}));

vi.mock("@/lib/db/marketingContent", () => marketingModule);

const mockLoadMarketingContent = marketingModule.loadMarketingContent;

describe("siteData", () => {
  it("returns remote landing content when available", async () => {
    const remote = {
      hero: { title: "Remote", description: "desc", phrases: [] },
      vignettes: [],
      cadence: [],
      callToAction: {
        eyebrow: "CTA",
        title: "title",
        description: "desc",
        primaryCta: { label: "Go", href: "/" },
        secondaryCta: { label: "Stay", href: "/stay" },
        helper: "help",
      },
    };
    mockLoadMarketingContent.mockResolvedValueOnce(remote);

    const result = await getLandingContent();
    expect(result.hero.title).toBe("Remote");
    expect(result).not.toBe(remote);
    result.hero.title = "Changed";
    expect(remote.hero.title).toBe("Remote");
  });

  it("falls back to bundled landing content", async () => {
    mockLoadMarketingContent.mockResolvedValueOnce(null);

    const result = await getLandingContent();
    expect(result.hero.title).toBeTruthy();
  });

  it("returns FAQ content from remote store when present", async () => {
    const remoteFaq = {
      coreFeatures: [{ slug: "feature", title: "Feature", description: "desc" }],
      workflowStages: [],
      platformPillars: [],
    };
    mockLoadMarketingContent.mockResolvedValueOnce(remoteFaq);

    const result = await getFaqContent();
    expect(result.coreFeatures[0]?.slug).toBe("feature");
    expect(result).not.toBe(remoteFaq);
  });
});
