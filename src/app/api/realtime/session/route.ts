import { NextResponse } from "next/server";

// import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server"; // Temporarily disabled for preview
import { UnauthorizedError } from "@/lib/auth/server";
import { enforceRateLimit } from "@/lib/rateLimit";

const DEFAULT_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-10";
const DEFAULT_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE ?? "verse";

async function requestOrchestrationSession() {
  const orchestrationBase = process.env.ORCHESTRATION_BASE_URL ?? process.env.ORCHESTRATION_URL;
  if (!orchestrationBase) {
    return null;
  }

  try {
    const url = new URL("/api/realtime/session", orchestrationBase);
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (process.env.ORCHESTRATION_API_KEY) {
      headers.Authorization = `Bearer ${process.env.ORCHESTRATION_API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Realtime orchestration session request failed", response.status, await response.text());
      return null;
    }

    return (await response.json()) as unknown;
  } catch (error) {
    console.error("Realtime orchestration session request error", error);
    return null;
  }
}

async function createOpenAISession() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_REALTIME_MODEL,
      voice: DEFAULT_REALTIME_VOICE,
    }),
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload.error as { message?: string }).message ?? "Unknown OpenAI response error"
        : "Failed to create OpenAI realtime session";
    throw new Error(errorMessage);
  }

  return payload as unknown;
}

async function createSession() {
  const orchestrationSession = await requestOrchestrationSession();
  if (orchestrationSession) {
    return orchestrationSession;
  }

  return createOpenAISession();
}

export async function POST() {
  try {
    // Temporarily disabled auth for preview mode
    // TODO: Re-enable authentication before production
    // const { user } = await requireServerAuthSession();
    const mockUserId = "00000000-0000-0000-0000-000000000000";
    const rate = await enforceRateLimit({
      key: mockUserId,
      limit: 15,
      windowMs: 60_000,
      prefix: "realtime",
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Realtime session rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            ).toString(),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const session = await createSession();
    console.log("[DEBUG] Realtime session response:", JSON.stringify(session, null, 2));
    return NextResponse.json(session, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create realtime session";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function GET() {
  return POST();
}
