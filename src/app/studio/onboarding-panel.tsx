"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StudioSessionRecord, StudioSlotPayload } from "@/lib/db/studioSessions";

import {
  confirmStudioSessionAction,
  persistStudioTranscript,
  saveStudioSlotInputs,
} from "./actions";

type StudioOnboardingPanelProps = {
  session: StudioSessionRecord | null;
  onSessionUpdated?: (session: StudioSessionRecord) => void;
  onSessionConfirmed?: (session: StudioSessionRecord) => void;
};

type SlotFormState = {
  format: string;
  toneKeywords: string;
  constraints: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const formatOptions = [
  { label: "Feature film", value: "feature" },
  { label: "Episodic series", value: "series" },
  { label: "Documentary", value: "doc" },
  { label: "Commercial :30", value: "spot" },
  { label: "Short form / social", value: "short" },
];

const initialForm: SlotFormState = {
  format: "",
  toneKeywords: "",
  constraints: "",
};

function parseToneKeywords(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSlots(state: SlotFormState): StudioSlotPayload {
  const payload: StudioSlotPayload = {};
  if (state.format.trim()) {
    payload.format = state.format.trim();
  }

  const tones = parseToneKeywords(state.toneKeywords);
  if (tones.length) {
    payload.toneKeywords = tones;
  }

  if (state.constraints.trim()) {
    payload.constraints = state.constraints.trim();
  }

  return payload;
}

export function StudioOnboardingPanel({
  session,
  onSessionUpdated,
  onSessionConfirmed,
}: StudioOnboardingPanelProps) {
  const [formState, setFormState] = useState<SlotFormState>(initialForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info">("info");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    if (!session) {
      setFormState(initialForm);
      return;
    }

    const source = (session.summary ?? session.slots ?? {}) as StudioSlotPayload;
    setFormState({
      format: typeof source.format === "string" ? source.format : "",
      toneKeywords: Array.isArray(source.toneKeywords)
        ? source.toneKeywords.join(", ")
        : typeof source.toneKeywords === "string"
        ? source.toneKeywords
        : "",
      constraints: typeof source.constraints === "string" ? source.constraints : "",
    });
  }, [session?.id]);

  const summaryEntries = useMemo(() => {
    const payload = (session?.summary ?? session?.slots ?? {}) as StudioSlotPayload;
    return [
      {
        label: "Format",
        value: typeof payload.format === "string" ? payload.format : "—",
      },
      {
        label: "Tone keywords",
        value: Array.isArray(payload.toneKeywords)
          ? payload.toneKeywords.join(", ") || "—"
          : "—",
      },
      {
        label: "Constraints",
        value: typeof payload.constraints === "string" && payload.constraints.trim()
          ? payload.constraints
          : "—",
      },
    ];
  }, [session?.summary, session?.slots]);

  const stopStream = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const persistTranscript = useCallback(
    async (text: string) => {
      if (!session || !text.trim()) {
        return;
      }
      try {
        await persistStudioTranscript({
          sessionId: session.id,
          projectId: session.projectId,
          transcript: text,
          speaker: "user",
          source: "voice",
        });
        setVoiceStatus("Transcript saved to project session");
      } catch (error) {
        console.error("Failed to persist transcript", error);
        setMicError("Transcript could not be saved. Try again.");
      }
    },
    [session],
  );

  const handleFieldChange = useCallback(
    (field: keyof SlotFormState, value: string) => {
      setFormState((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const payload = normalizeSlots(formState);

    try {
      const updated = await saveStudioSlotInputs({
        sessionId: session.id,
        projectId: session.projectId,
        slots: payload,
      });
      onSessionUpdated?.(updated);
      setFeedbackTone("success");
      setFeedback("Slot inputs saved to Supabase");
    } catch (error) {
      console.error("Failed to save slot inputs", error);
      setFeedbackTone("error");
      setFeedback("Could not save slots. Please retry.");
    } finally {
      setIsSaving(false);
    }
  }, [formState, onSessionUpdated, session]);

  const handleConfirm = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsConfirming(true);
    setFeedback(null);
    const summary = normalizeSlots(formState);

    try {
      const confirmed = await confirmStudioSessionAction({
        sessionId: session.id,
        projectId: session.projectId,
        summary,
      });
      onSessionConfirmed?.(confirmed);
      setFeedbackTone("success");
      setFeedback("Session confirmed. Drafting agents can begin.");
    } catch (error) {
      console.error("Failed to confirm onboarding", error);
      setFeedbackTone("error");
      setFeedback("Confirmation failed. Check your slots and retry.");
    } finally {
      setIsConfirming(false);
    }
  }, [formState, onSessionConfirmed, session]);

  const getRecognitionConstructor = useCallback((): SpeechRecognitionConstructor | null => {
    if (typeof window === "undefined") {
      return null;
    }

    return (window.SpeechRecognition || window.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!session || isRecording) {
      return;
    }

    setMicError(null);
    setVoiceStatus("Requesting microphone access");
    transcriptRef.current = "";
    setLiveTranscript("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const RecognitionConstructor = getRecognitionConstructor();
      if (!RecognitionConstructor) {
        setVoiceStatus("Listening (browser lacks speech recognition)");
        setIsRecording(true);
        return;
      }

      const recognition = new RecognitionConstructor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ");
        transcriptRef.current = text.trim();
        setLiveTranscript(text.trim());
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event);
        setMicError("Speech recognition failed. Try again.");
        setIsRecording(false);
        stopStream();
      };

      recognition.onend = async () => {
        const transcript = transcriptRef.current;
        setIsRecording(false);
        stopStream();
        if (transcript) {
          await persistTranscript(transcript);
        } else {
          setVoiceStatus("Microphone calibrated. No transcript captured.");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setVoiceStatus("Listening for slot inputs");
    } catch (error) {
      console.error("Microphone access failed", error);
      setMicError(error instanceof Error ? error.message : "Unable to access microphone");
      stopStream();
      setIsRecording(false);
    }
  }, [getRecognitionConstructor, isRecording, persistTranscript, session, stopStream]);

  const handleStopRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }
    setIsRecording(false);
    setVoiceStatus("Recording stopped");
    stopStream();
  }, [isRecording, stopStream]);

  const disabled = !session;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Onboarding</p>
        <h2 className="text-2xl font-semibold text-white">Voice slot capture</h2>
        <p className="text-sm text-zinc-400">
          Capture format, tone, and constraints before the drafting agents spin up. Voice transcripts persist directly to Supabase via RPCs.
        </p>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-500">
            Script format
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
              value={formState.format}
              onChange={(event) => handleFieldChange("format", event.target.value)}
              disabled={disabled}
            >
              <option value="">Select a format</option>
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-500">
            Tone keywords
            <textarea
              className="mt-2 min-h-[96px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
              placeholder="moody, intimate, high-energy"
              value={formState.toneKeywords}
              onChange={(event) => handleFieldChange("toneKeywords", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-500">
            Constraints & guardrails
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
              placeholder="Avoid gore. Keep runtime under 90 pages."
              value={formState.constraints}
              onChange={(event) => handleFieldChange("constraints", event.target.value)}
              disabled={disabled}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || isSaving}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
            >
              {isSaving ? "Saving…" : "Save slots"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={disabled || isConfirming}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200 transition hover:border-sky-300 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
            >
              {session?.status === "confirmed" ? "Confirmed" : isConfirming ? "Confirming…" : "Confirm & hand off"}
            </button>
          </div>
          {feedback && (
            <p
              className={
                feedbackTone === "success"
                  ? "text-xs text-emerald-300"
                  : feedbackTone === "error"
                  ? "text-xs text-rose-300"
                  : "text-xs text-zinc-400"
              }
            >
              {feedback}
            </p>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Voice capture</p>
            <p className="mt-1 text-sm text-zinc-300">
              Use your mic to dictate slot answers. We use getUserMedia for capture and Web Speech when available.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={disabled || isRecording}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
              >
                {isRecording ? "Listening…" : "Start recording"}
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                disabled={disabled || !isRecording}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-zinc-300 transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-zinc-500"
              >
                Stop
              </button>
            </div>
            {voiceStatus && <p className="mt-2 text-xs text-zinc-400">{voiceStatus}</p>}
            {micError && <p className="mt-2 text-xs text-rose-300">{micError}</p>}
            {liveTranscript && (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white">
                {liveTranscript}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Captured summary</p>
            <ul className="mt-3 space-y-3">
              {summaryEntries.map((entry) => (
                <li key={entry.label} className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-zinc-500">{entry.label}</p>
                  <p className="mt-1 text-sm text-white">{entry.value || "—"}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-400">
            Session status: <span className="text-white">{session?.status ?? "pending"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
