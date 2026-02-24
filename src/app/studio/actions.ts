"use server";

import { headers } from "next/headers";

import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
import { requireServerAuthSession } from "@/lib/auth/server";
import { getStudioHydration } from "@/lib/db/projects";
import { recordBusinessEvent, withSpan } from "@/lib/observability";
import { createRequestLogger, getRequestIdFromHeaders } from "@/lib/requestContext";
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
  const requestId = getRequestIdFromHeaders(headers());
  const log = createRequestLogger(requestId);

  return withSpan(
    {
      name: "action.studio.confirm-session",
      attributes: { sessionId: input.sessionId, projectId: input.projectId, requestId },
    },
    async (span) => {
      const confirmation = await confirmProjectSession({
        sessionId: input.sessionId,
        projectId: input.projectId,
        userId: user.id,
        summary: input.summary ?? null,
      });

      recordBusinessEvent("onboarding_completion_total", "Completed studio onboarding", {
        projectId: input.projectId,
      });
      span.setAttribute("studio.confirmed", true);
      log({
        level: "info",
        message: "studio.session.confirmed",
        context: { sessionId: input.sessionId, projectId: input.projectId, requestId },
      });

      return confirmation;
    },
  );
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
