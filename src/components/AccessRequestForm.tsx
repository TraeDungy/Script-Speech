"use client";

import { useState, useTransition, type FormEvent } from "react";

const initialState = {
  email: "",
  message: "",
};

export function AccessRequestForm() {
  const [formState, setFormState] = useState(initialState);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/request-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formState.email,
            message: formState.message,
          }),
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          const message = payload?.message ?? "Unable to submit your request right now.";
          throw new Error(message);
        }

        setFormState(initialState);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        );
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
      {status === "success" && (
        <p className="text-sm text-emerald-400">
          Request received. We will reach out shortly with onboarding details.
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="text-sm text-rose-400">{errorMessage}</p>
      )}
    </form>
  );
}
