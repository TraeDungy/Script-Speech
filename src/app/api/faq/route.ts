export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { getFaqContent } from "@/lib/siteData";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

export async function GET() {
  recordApiRequest("faq", "GET");

  try {
    return await withSpan(
      { name: "api.faq.get", attributes: { route: "/api/faq" } },
      async (span) => {
        const content = await getFaqContent();
        span.setAttribute("faq.sections", {
          coreFeatures: content.coreFeatures?.length ?? 0,
          workflowStages: content.workflowStages?.length ?? 0,
          platformPillars: content.platformPillars?.length ?? 0,
        });
        logStructuredEvent({
          level: "info",
          message: "faq-content.served",
          context: { coreFeatures: content.coreFeatures?.length ?? 0 },
        });
        return NextResponse.json(content);
      },
    );
  } catch (error) {
    recordApiError("faq", "GET", 500);
    await captureApiException(error, { route: "faq", method: "GET", status: 500 });
    logStructuredEvent({ level: "error", message: "faq-content.failed", error });
    return NextResponse.json({ error: "Unable to load FAQ content" }, { status: 500 });
  }
}
