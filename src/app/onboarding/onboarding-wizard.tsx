"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { buildOnboardingScriptDoc, type SlotResponseMap } from "@/lib/onboarding";
import { useVoiceCaptureClient } from "@/lib/hooks/useVoiceCaptureClient";

const formatOptions = [
  { value: "feature", label: "Feature film", helper: "85-120 pages" },
  { value: "pilot", label: "Series pilot", helper: "45-65 pages" },
  { value: "short", label: "Short film", helper: "10-25 pages" },
  { value: "limited-series", label: "Limited series", helper: "6 episodes" },
  { value: "doc-feature", label: "Documentary feature", helper: "80-100 minutes" },
];

const defaultResponses: SlotResponseMap = {
  title: "",
  format: formatOptions[0]?.value ?? "feature",
  logline: "",
  genre: "",
  tone: "",
  lengthUnit: "pages",
  lengthValue: "100",
  characters: "",
  locations: "",
  props: "",
  signatureMoment: "",
};

type QuestionType = "text" | "textarea" | "select" | "length";

type SlotQuestion = {
  id: keyof SlotResponseMap;
  label: string;
  description: string;
  placeholder: string;
  type: QuestionType;
};

const slotQuestions: SlotQuestion[] = [
  {
    id: "title",
    label: "Working title",
    description: "Give the project a name—even if it's a codename.",
    placeholder: "The Signal at Low Tide",
    type: "text",
  },
  {
    id: "format",
    label: "Target format",
    description: "Pick the structure you want the studio to prepare.",
    placeholder: "Feature",
    type: "select",
  },
  {
    id: "logline",
    label: "Logline / premise",
    description: "Two sentences covering the protagonist, goal, and obstacle.",
    placeholder: "An estranged sound designer returns home to decode a mysterious signal.",
    type: "textarea",
  },
  {
    id: "genre",
    label: "Genre",
    description: "Primary genre or blend of styles.",
    placeholder: "Sci-Fi Drama",
    type: "text",
  },
  {
    id: "tone",
    label: "Tone keywords",
    description: "Comma-separated vibes, pacing notes, or brand pillars.",
    placeholder: "Atmospheric, intimate, hopeful",
    type: "text",
  },
  {
    id: "lengthValue",
    label: "Target length",
    description: "Pages or minutes depending on the format.",
    placeholder: "100",
    type: "length",
  },
  {
    id: "characters",
    label: "Key characters",
    description: "List names with optional shorthand descriptions.",
    placeholder: "Mara Reyes - gifted sound designer",
    type: "textarea",
  },
  {
    id: "locations",
    label: "Signature locations",
    description: "World anchors, sets, or repeating environments.",
    placeholder: "Family pier, analog mix studio",
    type: "textarea",
  },
  {
    id: "props",
    label: "Signature props",
    description: "Objects, tech, or motifs that matter.",
    placeholder: "Custom hydrophone rig, heirloom compass",
    type: "textarea",
  },
  {
    id: "signatureMoment",
    label: "Signature moment",
    description: "Describe a moment you want preserved in the draft.",
    placeholder: "Signal erupts in shimmering light as siblings reconcile.",
    type: "textarea",
  },
];

const connectionLabels: Record<RTCPeerConnectionState, string> = {
  closed: "Closed",
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  failed: "Failed",
  "new": "New",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [responses, setResponses] = useState<SlotResponseMap>(defaultResponses);
  const [activePrompt, setActivePrompt] = useState<keyof SlotResponseMap>("title");
  const [isStartingVoice, setIsStartingVoice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    connect,
    disconnect,
    startMicrophone,
    stopMicrophone,
    attachAudioElement,
    connectionState,
    metadata,
    transcripts,
    isMicrophoneActive,
    microphonePermission,
    error: voiceError,
    resetError,
  } = useVoiceCaptureClient();

  useEffect(() => {
    if (audioRef.current) {
      attachAudioElement(audioRef.current);
    }
  }, [attachAudioElement]);

  const handleChange = useCallback(
    <T extends keyof SlotResponseMap>(id: T, value: SlotResponseMap[T]) => {
      setResponses((current) => ({ ...current, [id]: value }));
    },
    [],
  );

  const answeredCount = useMemo(() => {
    return slotQuestions.filter((question) => responses[question.id].trim().length > 0).length;
  }, [responses]);

  const progressPercent = Math.round((answeredCount / slotQuestions.length) * 100);

  const recentTranscripts = useMemo(() => transcripts.slice(-8), [transcripts]);

  const beginVoiceSession = useCallback(async () => {
    setSubmitError(null);
    setIsStartingVoice(true);
    try {
      await connect();
      await startMicrophone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start voice session";
      setSubmitError(message);
    } finally {
      setIsStartingVoice(false);
    }
  }, [connect, startMicrophone]);

  const stopVoiceSession = useCallback(() => {
    stopMicrophone();
    disconnect();
  }, [disconnect, stopMicrophone]);

  const handleSubmit = useCallback(async () => {
    if (!responses.title.trim() || !responses.logline.trim()) {
      setSubmitError("Title and logline are required.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const projectPayload = {
        title: responses.title.trim() || "Untitled Voice Project",
        scriptType: responses.format || "feature",
        genre: responses.genre.trim() || null,
        logline: responses.logline.trim() || null,
        status: "draft",
        targetLength: {
          unit: responses.lengthUnit,
          value: Number(responses.lengthValue) || null,
        },
        tags: responses.tone
          .split(/[,\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      };

      const createResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectPayload),
      });

      const projectBody = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(projectBody.error ?? "Unable to create project");
      }

      const projectId = projectBody.project?.id as string | undefined;
      if (!projectId) {
        throw new Error("Project identifier missing from response");
      }

      const scriptDoc = buildOnboardingScriptDoc({
        projectId,
        sessionId: metadata?.sessionId,
        responses,
        transcripts,
      });

      const patchResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            logline: scriptDoc.metadata.logline,
            genre: scriptDoc.metadata.genre,
            targetLength: scriptDoc.metadata.targetLength,
            tags: scriptDoc.metadata.toneKeywords,
          },
          scriptDoc,
        }),
      });

      const patchBody = await patchResponse.json().catch(() => ({}));
      if (!patchResponse.ok) {
        throw new Error(patchBody.error ?? "Unable to persist ScriptDoc seed");
      }

      stopVoiceSession();
      router.push(`/studio?project=${encodeURIComponent(projectId)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to complete onboarding");
    } finally {
      setIsSubmitting(false);
    }
  }, [metadata?.sessionId, responses, router, stopVoiceSession, transcripts]);

  const canSubmit = Boolean(
    responses.title.trim() &&
      responses.logline.trim() &&
      transcripts.length > 0 &&
      metadata?.sessionId &&
      !isSubmitting,
  );

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_rgba(0,0,0,0))]" />
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="max-w-3xl space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Voice onboarding</p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">Capture intent before touching the studio canvas</h1>
          <p className="text-base text-zinc-400 md:text-lg">
            Speak through the slot-filling interview while the assistant records transcripts and builds a ScriptDoc seed. The more detail you provide here, the more aligned your opening draft will be when the studio loads.
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Interview blueprint</p>
                <span className="text-xs text-zinc-400">{progressPercent}% complete</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="space-y-5">
              {slotQuestions.map((question) => (
                <div
                  key={question.id}
                  className={`rounded-2xl border bg-black/20 p-4 transition ${
                    activePrompt === question.id ? "border-white/40" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{question.label}</p>
                      <p className="text-xs text-zinc-400">{question.description}</p>
                    </div>
                  </div>

                  {question.type === "textarea" ? (
                    <textarea
                      value={responses[question.id]}
                      onChange={(event) => handleChange(question.id, event.target.value)}
                      onFocus={() => setActivePrompt(question.id)}
                      rows={3}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
                      placeholder={question.placeholder}
                    />
                  ) : question.type === "select" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {formatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setActivePrompt(question.id);
                            handleChange("format", option.value);
                          }}
                          className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            responses.format === option.value
                              ? "border-white/60 bg-white/10 text-white"
                              : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30"
                          }`}
                        >
                          <p className="font-semibold">{option.label}</p>
                          <p className="text-xs text-zinc-400">{option.helper}</p>
                        </button>
                      ))}
                    </div>
                  ) : question.type === "length" ? (
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="number"
                        value={responses.lengthValue}
                        onChange={(event) => handleChange("lengthValue", event.target.value)}
                        onFocus={() => setActivePrompt(question.id)}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
                        placeholder={question.placeholder}
                        min={1}
                      />
                      <select
                        value={responses.lengthUnit}
                        onChange={(event) =>
                          handleChange("lengthUnit", event.target.value as SlotResponseMap["lengthUnit"])
                        }
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                      >
                        <option value="pages">Pages</option>
                        <option value="minutes">Minutes</option>
                        <option value="seconds">Seconds</option>
                      </select>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={responses[question.id]}
                      onChange={(event) => handleChange(question.id, event.target.value)}
                      onFocus={() => setActivePrompt(question.id)}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
                      placeholder={question.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            {(submitError || voiceError) && (
              <div className="space-y-2 text-sm text-rose-400">
                {submitError && <p>{submitError}</p>}
                {voiceError && (
                  <p>
                    {voiceError}{" "}
                    <button type="button" className="underline" onClick={resetError}>
                      Dismiss
                    </button>
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`inline-flex flex-1 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                  canSubmit
                    ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white"
                    : "bg-white/10 text-zinc-500"
                }`}
              >
                {isSubmitting ? "Seeding project…" : "Send to studio"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResponses(() => ({ ...defaultResponses }));
                  setActivePrompt("title");
                  setSubmitError(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Reset form
              </button>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Realtime session</p>
                  <p className="text-2xl font-semibold text-white">
                    {connectionLabels[connectionState]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={beginVoiceSession}
                    disabled={isStartingVoice || connectionState === "connected"}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50 disabled:opacity-40"
                  >
                    {isStartingVoice ? "Requesting mic…" : "Begin voice onboarding"}
                  </button>
                  <button
                    type="button"
                    onClick={stopVoiceSession}
                    disabled={connectionState !== "connected"}
                    className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50 disabled:opacity-40"
                  >
                    Stop session
                  </button>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Mic status</dt>
                  <dd className="text-white">{isMicrophoneActive ? "Live" : "Muted"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Permission</dt>
                  <dd className="text-white">{microphonePermission}</dd>
                </div>
                {metadata?.sessionId && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Session ID</dt>
                    <dd className="truncate text-white">{metadata.sessionId}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Transcript feed</p>
              {recentTranscripts.length ? (
                <ul className="mt-4 space-y-3">
                  {recentTranscripts.map((turn) => (
                    <li key={turn.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-zinc-500">
                        <span>{turn.role}</span>
                        <span>{turn.final ? "final" : "live"}</span>
                      </div>
                      <p className="mt-2 text-sm text-white">{turn.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">Voice answers will appear here as the session streams.</p>
              )}
            </div>
          </section>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
