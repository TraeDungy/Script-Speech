"use client";

import { useEffect, useMemo, useState } from "react";

import type { ScriptDoc } from "@/lib/scriptDoc";
import type { StudioSessionRecord, StudioSlotPayload } from "@/lib/db/studioSessions";
import type { StudioInitializationPayload } from "./actions";
import { persistStudioTranscript, saveStudioSlotInputs } from "./actions";

type WizardState = {
  title: string;
  intent: string;
  tones: string;
  goals: string;
  voiceTranscript: string;
};

type OnboardingWizardProps = {
  initialization: StudioInitializationPayload | null;
  onSessionUpdated?: (session: StudioSessionRecord) => void;
};

function parseTones(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
function ScriptDocPreview({
  hydration,
  transcriptRefs,
  payload,
}: {
  hydration: StudioInitializationPayload | null;
  transcriptRefs: string[];
  payload: StudioSlotPayload;
}) {
  const scriptDoc = hydration?.scriptDoc as ScriptDoc | null;
  const projectTitle = hydration?.project?.title ?? "Untitled project";

  if (!hydration) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Studio hydration</p>
          <h3 className="text-xl font-semibold text-white">{projectTitle}</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Project {hydration.project?.id ?? "pending"} · Session {hydration.session.id} · {hydration.session.status}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
          Supabase linked
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Intent</dt>
          <dd className="mt-1 text-white">{(payload.intent as string) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tones</dt>
          <dd className="mt-1 text-white">{Array.isArray(payload.tones) ? payload.tones.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Goal</dt>
          <dd className="mt-1 text-white">{(payload.goal as string) ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Voice transcripts</p>
        {transcriptRefs.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {transcriptRefs.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">No transcripts captured yet.</p>
        )}
      </div>

      {scriptDoc?.metadata && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Metadata</p>
          <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/40 p-3 text-xs text-zinc-200">
            {JSON.stringify(scriptDoc.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizard({ initialization, onSessionUpdated }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydration, setHydration] = useState<StudioInitializationPayload | null>(initialization);
  const [transcriptRefs, setTranscriptRefs] = useState<string[]>([]);
  const [state, setState] = useState<WizardState>({
    title: initialization?.project?.title ?? "",
    intent: "",
    tones: "",
    goals: "",
    voiceTranscript: "",
  });

  useEffect(() => {
    setHydration(initialization);
    if (initialization?.project?.title) {
      setState((prev) => ({ ...prev, title: prev.title || initialization.project?.title || "" }));
    }
  }, [initialization?.project?.id, initialization?.project?.title]);

  const slotPayload = useMemo<StudioSlotPayload>(() => {
    const tones = parseTones(state.tones);
    return {
      intent: state.intent,
      tones,
      goal: state.goals,
      title: state.title || initialization?.project?.title,
    } satisfies StudioSlotPayload;
  }, [initialization?.project?.title, state.goals, state.intent, state.tones, state.title]);

  const handleSubmit = async () => {
    const sessionId = hydration?.session.id;
    const projectId = hydration?.session.projectId;
    if (!sessionId || !projectId) {
      setError("Studio session could not be initialized.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await saveStudioSlotInputs({
        sessionId,
        projectId,
        slots: slotPayload,
      });
      setHydration((prev) => (prev ? { ...prev, session: updated } : prev));
      onSessionUpdated?.(updated);

      if (state.voiceTranscript.trim()) {
        const transcriptLabel = `voice-${Date.now()}`;
        await persistStudioTranscript({
          sessionId,
          projectId,
          transcript: state.voiceTranscript,
          speaker: "user",
          source: "wizard",
        });
        setTranscriptRefs((previous) => Array.from(new Set([...previous, transcriptLabel])));
      }

      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((Math.min(step, 2) + 1) / 3) * 100;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-vs-panel to-black/60 p-6 shadow-xl shadow-black/40 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Onboarding wizard</p>
          <h2 className="text-2xl font-semibold text-white">Capture intent before drafting</h2>
          <p className="text-xs text-zinc-400">
            Project and session IDs are provisioned through Supabase RPCs as soon as you land on this route.
          </p>
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
                Voice transcript (captured to Supabase)
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
                {isSubmitting ? "Saving..." : "Save to Supabase"}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-200">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Live payload preview</p>
          <pre className="max-h-[420px] overflow-auto rounded-2xl bg-black/60 p-3 text-xs text-emerald-100">
            {JSON.stringify(
              {
                session: hydration?.session,
                slots: slotPayload,
                transcript: state.voiceTranscript ? "ready" : "",
              },
              null,
              2,
            )}
          </pre>
          <p className="text-xs text-zinc-400">
            Slot values are stored on the active studio session. When provided, transcripts are logged directly through the
            Supabase RPC used by the voice capture panel.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ScriptDocPreview hydration={hydration} transcriptRefs={transcriptRefs} payload={slotPayload} />
      </div>
    </section>
  );
}
