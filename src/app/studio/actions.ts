"use server";

import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
import { requireServerAuthSession } from "@/lib/auth/server";
import { getStudioHydration } from "@/lib/db/projects";
import {
  captureProjectSlots,
  confirmProjectSession,
  ensureStudioProjectSession,
  logProjectTranscript,
  type StudioSessionRecord,
  type StudioSlotPayload,
} from "@/lib/db/studioSessions";

export interface StudioInitializationPayload {
  session: StudioSessionRecord;
  project: Awaited<ReturnType<typeof getStudioHydration>>["project"];
  scriptDoc: Awaited<ReturnType<typeof getStudioHydration>>["scriptDoc"];
  scriptDocSource: Awaited<ReturnType<typeof getStudioHydration>>["scriptDocSource"];
  scriptDocVersionNumber: Awaited<ReturnType<typeof getStudioHydration>>["scriptDocVersionNumber"];
  assets: {
    references: Awaited<ReturnType<typeof listReferenceAssets>>;
    entityAssets: Awaited<ReturnType<typeof listEntityAssets>>;
  };
}

export async function initializeStudioSession(): Promise<StudioInitializationPayload> {
  const { user } = await requireServerAuthSession({ redirectTo: "/" });
  const session = await ensureStudioProjectSession(user.id);

  const [hydration, references, entityAssets] = await Promise.all([
    getStudioHydration(session.projectId),
    listReferenceAssets(session.projectId),
    listEntityAssets(session.projectId),
  ]);

  return {
    session,
    ...hydration,
    assets: {
      references,
      entityAssets,
    },
  };
}

export async function saveStudioSlotInputs(input: {
  sessionId: string;
  projectId: string;
  slots: StudioSlotPayload;
}): Promise<StudioSessionRecord> {
  const { user } = await requireServerAuthSession();
  return captureProjectSlots({
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: user.id,
    slots: input.slots,
  });
}

export async function confirmStudioSessionAction(input: {
  sessionId: string;
  projectId: string;
  summary?: StudioSlotPayload | null;
}): Promise<StudioSessionRecord> {
  const { user } = await requireServerAuthSession();
  return confirmProjectSession({
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: user.id,
    summary: input.summary ?? null,
  });
}

export async function persistStudioTranscript(input: {
  sessionId: string;
  projectId: string;
  transcript: string;
  speaker?: string;
  source?: string;
}): Promise<void> {
  const { user } = await requireServerAuthSession();
  await logProjectTranscript({
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: user.id,
    transcript: input.transcript,
    speaker: input.speaker,
    source: input.source,
  });
}
