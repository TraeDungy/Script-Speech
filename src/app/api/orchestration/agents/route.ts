export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { getAgentSchemaPayload } from "@/lib/orchestrator/agentSchemas.server";

function isAuthorized(request: Request) {
  const apiKey = process.env.ORCHESTRATION_API_KEY?.trim();
  if (!apiKey) return true;

  const provided = request.headers.get("authorization") ?? "";
  return provided === `Bearer ${apiKey}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = getAgentSchemaPayload();

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
