"use server";

import { headers } from "next/headers";

import { listEntityAssets, listReferenceAssets } from "@/lib/assets";
// import { requireServerAuthSession } from "@/lib/auth/server"; // Temporarily disabled for preview
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
  // Temporarily use a mock user ID for preview/testing
  // TODO: Re-enable authentication before production
  const mockUserId = "00000000-0000-0000-0000-000000000000";

  try {
    const session = await ensureStudioProjectSession(mockUserId);

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
  } catch (error) {
    console.error("Failed to initialize studio session:", error);
    // Return a minimal payload if there's an error
    return {
      session: {
        id: mockUserId,
        projectId: mockUserId,
        userId: mockUserId,
        status: 'collecting' as const,
        slots: {},
        summary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      project: null,
      scriptDoc: null,
      scriptDocSource: 'none' as const,
      scriptDocVersionNumber: null,
      assets: {
        references: [],
        entityAssets: [],
      },
    };
  }
}

export async function saveStudioSlotInputs(input: {
  sessionId: string;
  projectId: string;
  slots: StudioSlotPayload;
}): Promise<StudioSessionRecord> {
  // Temporarily use mock user ID for preview/testing
  // TODO: Re-enable authentication before production
  const mockUserId = "00000000-0000-0000-0000-000000000000";

  return captureProjectSlots({
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: mockUserId,
    slots: input.slots,
  });
}

export async function confirmStudioSessionAction(input: {
  sessionId: string;
  projectId: string;
  summary?: StudioSlotPayload | null;
}): Promise<StudioSessionRecord> {
  // Temporarily use mock user ID for preview/testing
  // TODO: Re-enable authentication before production
  const mockUserId = "00000000-0000-0000-0000-000000000000";

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
        userId: mockUserId,
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
  // Temporarily use mock user ID for preview/testing
  // TODO: Re-enable authentication before production
  const mockUserId = "00000000-0000-0000-0000-000000000000";

  await logProjectTranscript({
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: mockUserId,
    transcript: input.transcript,
    speaker: input.speaker,
    source: input.source,
  });
}
