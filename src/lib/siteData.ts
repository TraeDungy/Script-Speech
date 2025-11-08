import { landingContent, type LandingContent } from "@/data/landing";
import { coreFeatures } from "@/data/coreFeatures";
import { platformPillars } from "@/data/platformPillars";
import { workflowStages } from "@/data/workflowStages";

export type FAQContent = {
  coreFeatures: typeof coreFeatures;
  workflowStages: typeof workflowStages;
  platformPillars: typeof platformPillars;
};

export async function getLandingContent(): Promise<LandingContent> {
  return structuredClone(landingContent);
}

export async function getFaqContent(): Promise<FAQContent> {
  return {
    coreFeatures: structuredClone(coreFeatures),
    workflowStages: structuredClone(workflowStages),
    platformPillars: structuredClone(platformPillars),
  };
}
