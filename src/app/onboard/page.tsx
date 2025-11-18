"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ScriptDocTranscriptEntry } from "@/lib/scriptDoc";
import { listScriptFormats } from "@/lib/scriptFormats";

const steps = [
  {
    title: "Describe your project",
    subtitle: "Name the world you're about to build.",
  },
  {
    title: "Capture voice notes",
    subtitle: "Drop quick tonal notes so Script Speech has context.",
  },
  {
    title: "Launch the studio",
    subtitle: "Review your seed data and jump in.",
  },
];

const scriptFormats = listScriptFormats();
const defaultFormat = scriptFormats[0]?.id ?? "feature";

export default function OnboardPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<ScriptDocTranscriptEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    scriptType: defaultFormat,
    genre: "",
    logline: "",
    voiceSummary: "",
  });

  const formatOptions = useMemo(() => {
    return scriptFormats
      .map((format) => ({ value: format.id, label: format.label, description: format.description }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const canAdvanceToNotes = Boolean(projectId);
  const generateClientId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `note-${Date.now()}`;

  const handleMetadataSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.title.trim()) {
      setError("Give your project a working title.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formData.title.trim(),
          scriptType: formData.scriptType,
          logline: formData.logline.trim() || undefined,
          genre: formData.genre.trim() || undefined,
          voiceSummary: formData.voiceSummary.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to seed project");
      }
      setProjectId(payload?.project?.id ?? payload?.projectId ?? null);
      setStepIndex(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoteSave = async () => {
    if (!projectId || !noteDraft.trim()) {
      return;
    }
    setNoteStatus(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries: [
            {
              text: noteDraft.trim(),
              role: "user",
              final: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save note");
      }
      const entry: ScriptDocTranscriptEntry = {
        id: generateClientId(),
        role: "user",
        text: noteDraft.trim(),
        final: true,
        createdAt: new Date().toISOString(),
      };
      setSavedNotes((previous) => [...previous, entry]);
      setNoteDraft("");
      setNoteStatus("Note saved");
    } catch (err) {
      setNoteStatus(err instanceof Error ? err.message : "Unable to save note");
    }
  };

  const handleLaunch = () => {
    if (!projectId) {
      setError("Create a project first");
      return;
    }
    router.push(`/studio?projectId=${encodeURIComponent(projectId)}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-14 text-white">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Onboarding</p>
        <h1 className="text-4xl font-semibold md:text-5xl">Seed your Script Speech studio</h1>
        <p className="text-base text-zinc-400">
          Capture a few details and we'll spin up a ScriptDoc, persist your notes, and drop you into the canvas.
        </p>
      </header>

      <ol className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur md:grid-cols-3">
        {steps.map((step, index) => {
          const isActive = index === stepIndex;
          const isComplete = index < stepIndex;
          return (
            <li
              key={step.title}
              className={`rounded-2xl border px-4 py-3 text-sm transition ${
                isActive
                  ? "border-white/60 bg-white/10"
                  : isComplete
                  ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                  : "border-white/5 bg-transparent text-zinc-400"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Step {index + 1}</p>
              <p className="mt-1 text-base font-semibold text-white">{step.title}</p>
              <p className="text-sm text-zinc-400">{step.subtitle}</p>
            </li>
          );
        })}
      </ol>

      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>}

      {stepIndex === 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <form onSubmit={handleMetadataSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-white">Project title</label>
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Echoes on the Pier"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-white">Primary format</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
                  value={formData.scriptType}
                  onChange={(event) => setFormData((prev) => ({ ...prev, scriptType: event.target.value }))}
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-black text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">Genre</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
                  value={formData.genre}
                  onChange={(event) => setFormData((prev) => ({ ...prev, genre: event.target.value }))}
                  placeholder="Sci-Fi Drama"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white">Logline</label>
              <textarea
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
                rows={3}
                value={formData.logline}
                onChange={(event) => setFormData((prev) => ({ ...prev, logline: event.target.value }))}
                placeholder="An estranged sound designer returns home to decode a signal pulsing from her family's pier."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white">Voice summary</label>
              <textarea
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
                rows={3}
                value={formData.voiceSummary}
                onChange={(event) => setFormData((prev) => ({ ...prev, voiceSummary: event.target.value }))}
                placeholder="Use this to capture tone, intent, or immediate marching orders."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-zinc-400">We'll create the project and seed a ScriptDoc snapshot.</p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-white/90 px-6 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {isSubmitting ? "Seeding…" : "Create my project"}
              </button>
            </div>
          </form>
        </section>
      )}

      {stepIndex === 1 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-zinc-300">
                {canAdvanceToNotes
                  ? "Pretend you're speaking into Script Speech. Type a quick transcript and we'll persist it as canonical notes."
                  : "Create a project first so we know where to store your notes."}
              </p>
            </div>
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white focus:border-white/50 focus:outline-none"
              rows={4}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="We open on bioluminescent surf, microphone submerged..."
              disabled={!canAdvanceToNotes}
            />
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleNoteSave}
                disabled={!canAdvanceToNotes || !noteDraft.trim()}
                className="rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:cursor-not-allowed disabled:border-white/20"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={() => setStepIndex(2)}
                disabled={!canAdvanceToNotes}
                className="rounded-2xl bg-white/90 px-6 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40"
              >
                Continue to launch
              </button>
              {noteStatus && <span className="text-sm text-zinc-300">{noteStatus}</span>}
            </div>
            {savedNotes.length > 0 && (
              <ul className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
                {savedNotes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="mt-1 text-white">{note.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {stepIndex === 2 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">Ready to enter the studio.</p>
            <dl className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Project</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{formData.title || "Untitled"}</dd>
                <dd className="text-sm text-zinc-400">{formData.scriptType}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500">Notes stored</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{savedNotes.length}</dd>
                <dd className="text-sm text-zinc-400">via /api/projects/{projectId ?? "?"}/notes</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={!projectId}
              className="w-full rounded-2xl bg-white/90 px-6 py-3 text-base font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40"
            >
              Enter the studio →
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
