import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireServerAuthSession, UnauthorizedError } from "@/lib/auth/server";
import { createProject } from "@/lib/db/projects";
import { createScriptDocVersion } from "@/lib/db/scriptDocs";
import type { ScriptDoc, ScriptDocTranscriptEntry } from "@/lib/scriptDoc";

type OnboardNote = {
  id?: string;
  role?: string;
  text: string;
  createdAt?: string;
};

type OnboardPayload = {
  title?: string;
  scriptType?: string;
  logline?: string;
  genre?: string;
  toneKeywords?: string[];
  subgenres?: string[];
  targetLength?: { unit: "pages" | "minutes" | "seconds"; value?: number };
  keywords?: string[];
  voiceSummary?: string;
  voiceNotes?: OnboardNote[];
};

function buildSeedDoc(
  projectId: string,
  input: Required<Pick<OnboardPayload, "title" | "scriptType">> & OnboardPayload,
  createdBy: string,
): ScriptDoc {
  const now = new Date().toISOString();
  const toneKeywords = (input.toneKeywords ?? []).filter(Boolean);
  const keywords = (input.keywords ?? []).filter(Boolean);
  const summary = input.voiceSummary?.trim() || input.logline || "Concept summary coming soon.";
  const noteEntries: ScriptDocTranscriptEntry[] = (input.voiceNotes ?? [])
    .filter((entry) => entry.text?.trim().length)
    .map((entry, index) => ({
      id: entry.id ?? randomUUID(),
      role: entry.role ?? "user",
      text: entry.text.trim(),
      final: true,
      createdAt: entry.createdAt ?? new Date(Date.now() + index).toISOString(),
    }));

  return {
    metadata: {
      projectId,
      title: input.title,
      format: input.scriptType as ScriptDoc["metadata"]["format"],
      genre: input.genre ?? "Drama",
      subgenres: input.subgenres?.filter(Boolean) ?? [],
      logline: input.logline ?? summary,
      toneKeywords: toneKeywords.length ? toneKeywords : ["cinematic", "character-first"],
      targetLength: input.targetLength ?? { unit: "pages", value: 90 },
      status: "outline",
      createdAt: now,
      updatedAt: now,
      relatedProjects: [],
      isExtension: false,
    },
    revision: {
      id: randomUUID(),
      version: "0.1.0",
      label: "Onboarding seed",
      createdAt: now,
      createdBy,
      notes: input.voiceSummary ?? "Seeded via onboarding wizard",
    },
    referenceAssets: [],
    characters: [],
    locations: [],
    props: [],
    beats: [],
    scenes: [],
    conceptAnalysis: {
      conceptSummary: summary,
      keywords: keywords.length ? keywords : toneKeywords,
      audiencePromise: input.voiceSummary ?? undefined,
      genreConfidence: [
        {
          genre: input.genre ?? "Drama",
          confidence: 0.55,
        },
      ],
      toneConfidence: (toneKeywords.length ? toneKeywords : ["character-first"]).map((tone) => ({
        tone,
        confidence: 0.5,
      })),
      lengthRecommendation: {
        unit: input.targetLength?.unit ?? "pages",
        typical: input.targetLength?.value ?? 90,
        confidence: 0.5,
        rationale: "Seeded from onboarding selections",
      },
      recommendedFormats: [
        {
          formatId: input.scriptType,
          confidence: 0.8,
          rationale: "Selected during onboarding",
          suggestedLength: input.targetLength ?? { unit: "pages", typical: 90 },
        },
      ],
      relatedProjects: [],
      isFranchiseExtension: false,
      conversationLog: noteEntries,
    },
  };
}

export async function POST(request: NextRequest) {
  let body: OnboardPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.scriptType?.trim()) {
    return NextResponse.json(
      { error: "Both title and scriptType are required" },
      { status: 400 },
    );
  }

  try {
    const { user } = await requireServerAuthSession();
    const project = await createProject({
      title: body.title.trim(),
      scriptType: body.scriptType.trim(),
      genre: body.genre?.trim() ?? null,
      logline: body.logline?.trim() ?? null,
      ownerId: user.id,
      tags: [],
      status: "outline",
      targetLength: body.targetLength ? { ...body.targetLength } : undefined,
    });

    const seedDoc = buildSeedDoc(project.id, {
      title: project.title,
      scriptType: project.scriptType,
      logline: body.logline,
      genre: body.genre,
      toneKeywords: body.toneKeywords,
      subgenres: body.subgenres,
      targetLength: body.targetLength,
      keywords: body.keywords,
      voiceSummary: body.voiceSummary,
      voiceNotes: body.voiceNotes,
    }, user.id);

    const record = await createScriptDocVersion(project.id, seedDoc);

    return NextResponse.json(
      {
        project,
        scriptDoc: record.doc,
        redirectUrl: `/studio?projectId=${project.id}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to onboard project", error);
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
