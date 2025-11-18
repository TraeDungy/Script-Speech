import { NextRequest, NextResponse } from "next/server";

import { appendTranscriptTurns, listTranscriptTurns } from "@/lib/db/transcriptTurns";
import type { TranscriptTurnInput } from "@/lib/db/transcriptTurns";
import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import {
  ensureProjectMembership,
  ProjectAuthorizationError,
} from "@/lib/authz/projects.server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const entries = await listTranscriptTurns(projectId, 200);
    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to load project notes", error);
    return NextResponse.json({ error: "Unable to load notes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: { entries?: TranscriptTurnInput[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.entries?.length) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 });
  }

  const projectId = params.id;

  try {
    const { user } = await requireServerAuthSession();
    await ensureProjectMembership(projectId, user.id, { minimumRole: "member" });

    const saved = await appendTranscriptTurns(projectId, body.entries.map((entry) => ({
      ...entry,
      userId: entry.userId ?? user.id,
    })));

    return NextResponse.json({ count: saved.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProjectAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to persist project notes", error);
    return NextResponse.json({ error: "Unable to persist notes" }, { status: 500 });
  }
}
