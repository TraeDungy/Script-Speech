import { NextResponse } from "next/server";
import { enqueueExportJob, type ScriptDoc } from "@/lib/exports";
import type { ExportFormat } from "@/lib/exports/types";

interface RequestBody {
  format?: ExportFormat;
  scriptDoc?: ScriptDoc;
  deliverToEmail?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: RequestBody;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.format || !body.scriptDoc) {
    return NextResponse.json(
      { error: "Both format and scriptDoc are required" },
      { status: 400 }
    );
  }

  try {
    const job = await enqueueExportJob({
      projectId: params.id,
      format: body.format,
      scriptDoc: body.scriptDoc,
      deliverToEmail: body.deliverToEmail?.trim() || undefined,
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    console.error("Failed to enqueue export job", error);
    return NextResponse.json(
      { error: "Failed to enqueue export job" },
      { status: 500 },
    );
  }
}
