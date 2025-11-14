import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const siteDataModule = vi.hoisted(() => ({
  getFaqContent: vi.fn(),
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

const mockGetFaqContent = siteDataModule.getFaqContent;
const mockRecordApiError = observabilityModule.recordApiError;
const mockCaptureApiException = observabilityModule.captureApiException;

describe("/api/faq", () => {
  it("returns FAQ content", async () => {
    mockGetFaqContent.mockResolvedValueOnce({
      coreFeatures: [{ slug: "1", title: "Feature", description: "desc" }],
      workflowStages: [],
      platformPillars: [],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ coreFeatures: [{ slug: "1" }] });
  });

  it("captures failures", async () => {
    const error = new Error("faq boom");
    mockGetFaqContent.mockRejectedValueOnce(error);

    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to load FAQ content" });
    expect(mockRecordApiError).toHaveBeenCalledWith("faq", "GET", 500);
    expect(mockCaptureApiException).toHaveBeenCalledWith(error, {
      route: "faq",
      method: "GET",
      status: 500,
    });
  });
});
