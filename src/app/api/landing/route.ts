import { NextResponse } from "next/server";

import { getLandingContent } from "@/lib/siteData";
import {
  captureApiException,
  logStructuredEvent,
  recordApiError,
  recordApiRequest,
  withSpan,
} from "@/lib/observability";

export async function GET() {
  recordApiRequest("landing", "GET");

  try {
    return await withSpan(
      { name: "api.landing.get", attributes: { route: "/api/landing" } },
      async (span) => {
        const content = await getLandingContent();
        span.setAttribute("landing.vignettes", content.vignettes?.length ?? 0);
        span.setAttribute("landing.cadence", content.cadence?.length ?? 0);
        logStructuredEvent({
          level: "info",
          message: "landing-content.served",
          context: { vignetteCount: content.vignettes?.length ?? 0 },
        });
        return NextResponse.json(content);
      },
    );
  } catch (error) {
    recordApiError("landing", "GET", 500);
    await captureApiException(error, { route: "landing", method: "GET", status: 500 });
    logStructuredEvent({
      level: "error",
      message: "landing-content.failed",
      error,
    });
    return NextResponse.json({ error: "Unable to load landing content" }, { status: 500 });
  }
}
