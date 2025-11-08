"use client";

import { useState, useTransition, type FormEvent } from "react";

type FormState = {
  email: string;
  message: string;
  company: string;
  projectTitle: string;
  projectTimeline: string;
  projectNotes: string;
};

const initialState: FormState = {
  email: "",
  message: "",
  company: "",
  projectTitle: "",
  projectTimeline: "",
  projectNotes: "",
};

type Status = "idle" | "success" | "error";

type Feedback = {
  status: Status;
  message: string | null;
};

export function AccessRequestForm() {
  const [formState, setFormState] = useState(initialState);
  const [feedback, setFeedback] = useState<Feedback>({ status: "idle", message: null });
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetFeedback() {
    setFeedback({ status: "idle", message: null });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();

    startTransition(async () => {
      try {
        const metadata = showProjectDetails
          ? {
              company: formState.company.trim() || undefined,
              projectTitle: formState.projectTitle.trim() || undefined,
              projectTimeline: formState.projectTimeline.trim() || undefined,
              projectNotes: formState.projectNotes.trim() || undefined,
            }
          : undefined;

        const response = await fetch("/api/request-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formState.email,
            message: formState.message || undefined,
            metadata,
          }),
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          const message = payload?.message ?? "Unable to submit your request right now.";
          throw new Error(message);
        }

        setFormState(initialState);
        setShowProjectDetails(false);
        setFeedback({ status: "success", message: payload?.message ?? null });
      } catch (error) {
        setFeedback({
          status: "error",
          message:
            error instanceof Error ? error.message : "Something went wrong. Please try again.",
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-black/20 p-6 text-left shadow-glass"
    >
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Email</span>
          <input
            type="email"
            required
            value={formState.email}
            onChange={(event) =>
              setFormState((state) => ({ ...state, email: event.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
            placeholder="you@studio.com"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Project focus</span>
          <input
            type="text"
            value={formState.message}
            onChange={(event) =>
              setFormState((state) => ({ ...state, message: event.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
            placeholder="Commercial short, feature, episodic"
          />
        </label>
      </div>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setShowProjectDetails((visible) => !visible);
          }}
          className="text-left text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400 transition hover:text-white"
        >
          {showProjectDetails ? "Hide project details" : "Add project details"}
        </button>
        {showProjectDetails && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Company</span>
              <input
                type="text"
                value={formState.company}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, company: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
                placeholder="Studio or production company"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Project title</span>
              <input
                type="text"
                value={formState.projectTitle}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, projectTitle: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
                placeholder="Working title"
              />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Timeline</span>
              <input
                type="text"
                value={formState.projectTimeline}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, projectTimeline: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
                placeholder="Prep, shoot, post schedule"
              />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.35em] text-zinc-500">Notes</span>
              <textarea
                value={formState.projectNotes}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, projectNotes: event.target.value }))
                }
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none focus:ring-0"
                placeholder="Share anything else that helps us prep for the walkthrough"
              />
            </label>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-zinc-500 md:max-w-sm">
          Share your best contact email and what you are producing next. We will schedule a 15-minute run-through of Script Speech.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-6 py-2 text-sm font-semibold text-zinc-950 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isPending ? "Sending…" : "Request access"}
        </button>
      </div>
      {feedback.status === "success" && feedback.message && (
        <p className="text-sm text-emerald-400">{feedback.message}</p>
      )}
      {feedback.status === "error" && feedback.message && (
        <p className="text-sm text-rose-400">{feedback.message}</p>
      )}
    </form>
  );
}
