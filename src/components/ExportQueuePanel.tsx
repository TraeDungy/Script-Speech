"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportFormat, ExportJob } from "@/lib/exports/types";

const formats: { value: ExportFormat; label: string }[] = [
  { value: "fountain", label: "Fountain" },
  { value: "fdx", label: "FDX" },
  { value: "docx", label: "DOCX" },
  { value: "pdf", label: "PDF" },
];

const demoScriptDoc = {
  title: "Studio Canvas Demo",
  logline: "A director and Script Speech iterate on a scene live in the control room.",
  scenes: [
    {
      heading: "INT. CONTROL ROOM - NIGHT",
      action:
        "Monitors glow over the monochrome console as waveform meters dance in sync with whispered direction.",
      dialogue: [
        {
          character: "DIRECTOR",
          text: "Let's lock the reveal to the second beat and keep the camera floating.",
        },
        {
          character: "SCRIPT SPEECH",
          parenthetical: "calm",
          text: "Copy. Updating beat two and readying exports for review.",
        },
      ],
    },
    {
      heading: "INT. STAGE - CONTINUOUS",
      action: "Overhead rigs sweep as the set resets for another take in amber light.",
      dialogue: [
        {
          character: "DIRECTOR",
          text: "Flag this pass for reference and send me the fountain draft.",
        },
      ],
    },
  ],
};

type JobsState = Record<string, ExportJob>;

type StatusStyle = {
  background: string;
  text: string;
  border: string;
};

const statusStyles: Record<ExportJob["status"], StatusStyle> = {
  queued: {
    background: "bg-amber-500/10",
    text: "text-amber-200",
    border: "border-amber-500/30",
  },
  processing: {
    background: "bg-blue-500/10",
    text: "text-blue-200",
    border: "border-blue-500/30",
  },
  completed: {
    background: "bg-emerald-500/10",
    text: "text-emerald-200",
    border: "border-emerald-500/30",
  },
  failed: {
    background: "bg-rose-500/10",
    text: "text-rose-200",
    border: "border-rose-500/30",
  },
};

export function ExportQueuePanel() {
  const [jobs, setJobs] = useState<JobsState>({});
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobIdsRef = useRef<string[]>([]);

  const orderedJobs = useMemo(() => {
    return Object.values(jobs).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [jobs]);

  useEffect(() => {
    const loadInitialJobs = async () => {
      try {
        const response = await fetch(`/api/projects/demo-project/exports?limit=10`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { jobs?: ExportJob[] };
        if (data.jobs?.length) {
          setJobs((previous) => {
            const next = { ...previous };
            for (const job of data.jobs ?? []) {
              next[job.id] = job;
            }
            return next;
          });
          jobIdsRef.current = Array.from(new Set([...(data.jobs ?? []).map((job) => job.id), ...jobIdsRef.current]));
        }
      } catch (error) {
        console.error("Failed to load export jobs", error);
      }
    };

    void loadInitialJobs();

    const interval = setInterval(async () => {
      if (!jobIdsRef.current.length) {
        return;
      }

      const updatedJobs: ExportJob[] = [];

      await Promise.all(
        jobIdsRef.current.map(async (jobId) => {
          try {
            const response = await fetch(`/api/projects/demo-project/exports/${jobId}`);
            if (!response.ok) {
              return;
            }
            const job: ExportJob = await response.json();
            updatedJobs.push(job);
          } catch (pollError) {
            console.error("Failed to poll export job", pollError);
          }
        })
      );

      if (updatedJobs.length) {
        setJobs((previous) => {
          const next = { ...previous };
          for (const job of updatedJobs) {
            next[job.id] = job;
          }
          return next;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const queueExport = async (format: ExportFormat) => {
    setIsSubmitting(format);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/projects/demo-project/exports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format,
          scriptDoc: demoScriptDoc,
          deliverToEmail: email.trim() ? email.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to queue export");
      }

      const job: ExportJob = await response.json();
      jobIdsRef.current = Array.from(new Set([...jobIdsRef.current, job.id]));
      setJobs((previous) => ({ ...previous, [job.id]: job }));
      setMessage(
        job.deliverToEmail
          ? "Export queued. We will email the download link when it is ready."
          : "Export queued. Keep an eye on the queue for download links."
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to queue export");
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Export queue</p>
        <h2 className="text-lg font-semibold text-white">Preview export package</h2>
        <p className="text-sm text-zinc-400">
          Queue Fountain, FDX, DOCX, or PDF exports. Jobs process asynchronously, and links appear as soon as the renderer
          finishes.
        </p>
      </header>

      <div className="space-y-3">
        <label className="block text-xs uppercase tracking-[0.35em] text-zinc-500">
          Email delivery (optional)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="director@production.com"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {formats.map((formatOption) => (
            <button
              key={formatOption.value}
              type="button"
              onClick={() => queueExport(formatOption.value)}
              disabled={isSubmitting !== null}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting === formatOption.value ? "Queuing…" : `Queue ${formatOption.label}`}
            </button>
          ))}
        </div>
        {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Active jobs</p>
        {orderedJobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
            Queue an export to see progress updates here.
          </p>
        ) : (
          <ul className="space-y-4">
            {orderedJobs.map((job) => {
              const style = statusStyles[job.status];
              return (
                <li key={job.id} className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{job.format.toUpperCase()} export</p>
                      <p className="text-xs text-zinc-500">
                        Requested {new Date(job.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {job.deliverToEmail ? (
                        <p className="text-xs text-zinc-500">Email delivery: {job.deliverToEmail}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${style.background} ${style.text} ${style.border}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  {job.result ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <a
                        href={job.result.downloadUrl}
                        download={job.result.fileName}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:border-white/40 hover:bg-white/20"
                      >
                        Download {job.result.fileName}
                      </a>
                      {job.result.notes ? (
                        <span className="text-xs text-zinc-500">{job.result.notes}</span>
                      ) : null}
                      {job.deliverToEmail ? (
                        <span className="text-xs text-zinc-500">
                          A copy has also been queued for delivery to {job.deliverToEmail}.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {job.error ? (
                    <p className="text-sm text-rose-300">{job.error}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
