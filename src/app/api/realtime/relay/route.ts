import type { NextRequest } from "next/server";

import { POST as orchestratorHandler } from "../orchestrator/route";

export async function POST(request: NextRequest) {
  return orchestratorHandler(request);
}

export async function GET(request: NextRequest) {
  return orchestratorHandler(request);
}
