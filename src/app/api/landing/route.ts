import { NextResponse } from "next/server";

import { getLandingContent } from "@/lib/siteData";

export async function GET() {
  const content = await getLandingContent();

  return NextResponse.json(content);
}
