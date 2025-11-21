"use client";

import { useEffect, useMemo, useState } from "react";

import type { Tables } from "@/types/supabase";

type WizardState = {
  title: string;
  intent: string;
  tones: string;
  goals: string;
  voiceTranscript: string;
};

type HydratedProject = {
  projectId: string;
  projectTitle: string;
  scriptDoc: Tables<"script_docs"> | null;
};

type ScriptDocPayload = {
  doc: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  transcriptRefs?: string[];
  recordType?: Tables<"script_docs">["record_type"];
};

type ProjectPayload = {
  project: { id: string; title: string };
  scriptDoc: Tables<"script_docs"> | null;
};

const storageKey = "studio-onboarding-wizard";

function parseTones(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error ?? "Request failed");
  }

  return (await response.json()) as T;
}

function toHydratedProject(payload: ProjectPayload): HydratedProject {
  return {
    projectId: payload.project.id,
    projectTitle: payload.project.title,
    scriptDoc: payload.scriptDoc,
  };
}

function ScriptDocPreview({ hydration }: { hydration: HydratedProject | null }) {
  const transcriptRefs = hydration?.scriptDoc?.transcript_refs ?? [];
  const doc = hydration?.scriptDoc?.doc as Record<string, unknown> | undefined;
  const wizardMetadata = hydration?.scriptDoc?.metadata as Record<string, unknown> | undefined;

  if (!hydration) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">ScriptDoc hydration</p>
          <h3 className="text-xl font-semibold text-white">{hydration.projectTitle}</h3>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
          Synced
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Intent</dt>
          <dd className="mt-1 text-white">{(doc?.intent as string) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tones</dt>
          <dd className="mt-1 text-white">{(doc?.tones as string[])?.join(", ") ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Goal</dt>
          <dd className="mt-1 text-white">{(doc?.goal as string) ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Voice transcripts</p>
        {transcriptRefs?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {transcriptRefs.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">No transcripts captured yet.</p>
        )}
      </div>

      {wizardMetadata && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Metadata</p>
          <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/40 p-3 text-xs text-zinc-200">
            {JSON.stringify(wizardMetadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydration, setHydration] = useState<HydratedProject | null>(null);
  const [state, setState] = useState<WizardState>(() => {
    if (typeof window === "undefined") {
      return { title: "", intent: "", tones: "", goals: "", voiceTranscript: "" };
    }
    const cached = window.sessionStorage.getItem(storageKey);
    if (!cached) {
      return { title: "", intent: "", tones: "", goals: "", voiceTranscript: "" };
    }
    try {
      return JSON.parse(cached) as WizardState;
    } catch {
      return { title: "", intent: "", tones: "", goals: "", voiceTranscript: "" };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const scriptDocPayload: ScriptDocPayload = useMemo(() => {
    const tones = parseTones(state.tones);
    const transcriptRef = state.voiceTranscript ? [`voice-${Date.now()}`] : [];
    return {
      doc: {
        intent: state.intent,
        tones,
        goal: state.goals,
        transcript: state.voiceTranscript || undefined,
        capturedAt: new Date().toISOString(),
      },
      metadata: {
        wizard: {
          intent: state.intent,
          tones,
          goals: state.goals,
          voiceTranscript: state.voiceTranscript,
        },
      },
      transcriptRefs: transcriptRef,
      recordType: "autosave",
    };
  }, [state.goals, state.intent, state.tones, state.voiceTranscript]);

  const persistProject = async (projectId: string, title: string) => {
    const payload = {
      metadata: {
        intent: state.intent,
        tones: parseTones(state.tones),
        goals: state.goals,
      },
      title,
      scriptDoc: scriptDocPayload,
    };

    await fetchJson(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const refreshed = await fetchJson<ProjectPayload>(`/api/projects/${projectId}`);
    setHydration(toHydratedProject(refreshed));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<ProjectPayload>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: state.title || "Untitled project",
          scriptType: "feature",
          metadata: {
            intent: state.intent,
            tones: parseTones(state.tones),
            goals: state.goals,
          },
          scriptDoc: scriptDocPayload,
        }),
      });
      setHydration(toHydratedProject(result));
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!hydration?.projectId) {
      return;
    }
    const timer = setTimeout(() => {
      persistProject(hydration.projectId, hydration.projectTitle).catch((err) => {
        console.error("Failed to persist wizard state", err);
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.intent, state.tones, state.goals, state.voiceTranscript]);

  const progress = ((Math.min(step, 2) + 1) / 3) * 100;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-vs-panel to-black/60 p-6 shadow-xl shadow-black/40 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Onboarding wizard</p>
          <h2 className="text-2xl font-semibold text-white">Capture intent before drafting</h2>
        </div>
        <div className="w-40">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500">
            Step {step + 1} / 3
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-zinc-200" htmlFor="wizard-title">
            Project title
          </label>
          <input
            id="wizard-title"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-sky-400 focus:outline-none"
            value={state.title}
            onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="e.g., Lunar Tides"
          />

          {step === 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-200" htmlFor="wizard-intent">
                What do you want to make?
              </label>
              <textarea
                id="wizard-intent"
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-sky-400 focus:outline-none"
                value={state.intent}
                onChange={(event) => setState((prev) => ({ ...prev, intent: event.target.value }))}
                placeholder="Outline the concept, characters, or world you want to explore"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-200" htmlFor="wizard-tones">
                What tonal direction should we keep in mind?
              </label>
              <textarea
                id="wizard-tones"
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-sky-400 focus:outline-none"
                value={state.tones}
                onChange={(event) => setState((prev) => ({ ...prev, tones: event.target.value }))}
                placeholder="Moody, character-first, hopeful, comedic, grounded..."
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-200" htmlFor="wizard-goals">
                What success looks like
              </label>
              <textarea
                id="wizard-goals"
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-sky-400 focus:outline-none"
                value={state.goals}
                onChange={(event) => setState((prev) => ({ ...prev, goals: event.target.value }))}
                placeholder="Festival-ready pilot, tight two-minute pitch, character bible, etc."
              />
              <label className="mt-3 block text-sm font-medium text-zinc-200" htmlFor="wizard-voice">
                Voice transcript (paste notes from voice capture)
              </label>
              <textarea
                id="wizard-voice"
                className="min-h-[80px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-sky-400 focus:outline-none"
                value={state.voiceTranscript}
                onChange={(event) => setState((prev) => ({ ...prev, voiceTranscript: event.target.value }))}
                placeholder="Optional: paste the transcript from your voice walkthrough"
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white"
              disabled={step === 0 || isSubmitting}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </button>
            {step < 2 ? (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/25 transition hover:shadow-lg"
                onClick={() => setStep((current) => Math.min(2, current + 1))}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Saving..." : "Save project"}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-200">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Live payload preview</p>
          <pre className="max-h-[420px] overflow-auto rounded-2xl bg-black/60 p-3 text-xs text-emerald-100">
            {JSON.stringify(
              {
                metadata: {
                  intent: state.intent,
                  tones: parseTones(state.tones),
                  goals: state.goals,
                },
                transcriptRefs: scriptDocPayload.transcriptRefs,
                doc: scriptDocPayload.doc,
              },
              null,
              2,
            )}
          </pre>
          <p className="text-xs text-zinc-400">
            We automatically persist this structure to Supabase using the /api/projects endpoints and hydrate the ScriptDoc view
            below when it finishes saving.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ScriptDocPreview hydration={hydration} />
      </div>
    </section>
  );
}
