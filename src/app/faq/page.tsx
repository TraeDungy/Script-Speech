import { fetchFaqContent } from "@/lib/http";
import { FaqExperience } from "@/components/marketing/FaqExperience";

export const revalidate = 600;

export default async function FAQPage() {
  const faqResult = await fetchFaqContent();
  const faq = faqResult.data;
  const showFallbackNotice = faqResult.source === "fallback";

  return <FaqExperience faq={faq} showFallbackNotice={showFallbackNotice} />;
}
