import { landingContent, type LandingContent } from "@/data/landing";
import { coreFeatures } from "@/data/coreFeatures";
import { platformPillars } from "@/data/platformPillars";
import { workflowStages } from "@/data/workflowStages";

import { loadMarketingContent } from "./db/marketingContent";

export type FAQContent = {
  coreFeatures: typeof coreFeatures;
  workflowStages: typeof workflowStages;
  platformPillars: typeof platformPillars;
};

export async function getLandingContent(): Promise<LandingContent> {
  const remoteContent = await loadMarketingContent<LandingContent>("landing");
  if (remoteContent) {
    return structuredClone(remoteContent);
  }

  return structuredClone(landingContent);
}

export async function getFaqContent(): Promise<FAQContent> {
  const remoteContent = await loadMarketingContent<FAQContent>("faq");
  if (remoteContent) {
    return structuredClone(remoteContent);
  }

  return {
    coreFeatures: structuredClone(coreFeatures),
    workflowStages: structuredClone(workflowStages),
    platformPillars: structuredClone(platformPillars),
  };
}
