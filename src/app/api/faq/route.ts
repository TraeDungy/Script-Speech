import { NextResponse } from "next/server";

import { getFaqContent } from "@/lib/siteData";

export async function GET() {
  const content = await getFaqContent();

  return NextResponse.json(content);
}
