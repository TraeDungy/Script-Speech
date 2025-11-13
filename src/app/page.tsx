import { fetchFaqContent, fetchLandingContent } from "@/lib/http";
import { LandingExperience } from "@/components/marketing/LandingExperience";

export const revalidate = 600;

export default async function HomePage() {
  const [landingResult, faqResult] = await Promise.all([fetchLandingContent(), fetchFaqContent()]);
  const landing = landingResult.data;
  const faq = faqResult.data;
  const showFallbackNotice = landingResult.source === "fallback" || faqResult.source === "fallback";

  return <LandingExperience landing={landing} faq={faq} showFallbackNotice={showFallbackNotice} />;
}
