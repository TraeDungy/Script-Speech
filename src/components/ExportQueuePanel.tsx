"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportFormat, ExportJob, ScriptDoc as ExportScriptDoc } from "@/lib/exports/types";
import type {
  ScriptDoc as StudioScriptDoc,
  ScriptScene,
  ScriptSceneElement,
} from "@/lib/scriptDoc";
import { useScriptDocStore } from "@/lib/state/scriptDocStore";

interface ExportQueuePanelProps {
  projectId?: string;
}

const formats: { value: ExportFormat; label: string }[] = [
  { value: "fountain", label: "Fountain" },
  { value: "fdx", label: "FDX" },
  { value: "docx", label: "DOCX" },
  { value: "pdf", label: "PDF" },
];

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

const convertSceneSlugline = (scene: ScriptScene) =>
  `${scene.slugline.setting}. ${scene.slugline.location} - ${scene.slugline.timeOfDay}`;

const collectActionText = (elements: ScriptSceneElement[]) =>
  elements
    .filter((element) => element.type === "action")
    .map((element) => element.text)
    .join("\n\n")
    .trim();

const collectDialogue = (elements: ScriptSceneElement[]) => {
  const dialogue: NonNullable<ExportScriptDoc["scenes"][number]["dialogue"]> = [];
  let pendingParenthetical: string | undefined;

  for (const element of elements) {
    if (element.type === "parenthetical") {
      pendingParenthetical = element.text;
      continue;
    }

    if (element.type === "dialogue") {
      dialogue.push({
        character: element.speaker,
        text: element.text,
        parenthetical: element.parenthetical ?? pendingParenthetical ?? undefined,
      });
      pendingParenthetical = undefined;
    }
  }

  return dialogue.length ? dialogue : undefined;
};

const convertScriptDocForExport = (doc: StudioScriptDoc | null): ExportScriptDoc | null => {
  if (!doc) {
    return null;
  }

  const scenes = doc.scenes.map((scene) => {
    const action = collectActionText(scene.elements);
    return {
      heading: convertSceneSlugline(scene),
      action: action || undefined,
      dialogue: collectDialogue(scene.elements),
    } satisfies ExportScriptDoc["scenes"][number];
  });

  return {
    title: doc.metadata?.title,
    logline: doc.metadata?.logline,
    scenes,
  } satisfies ExportScriptDoc;
};

export function ExportQueuePanel() {
  const [jobs, setJobs] = useState<JobsState>({});
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const jobIdsRef = useRef<string[]>([]);
  const doc = useScriptDocStore((state) => state.doc);
  const projectId = doc.metadata?.projectId ?? "";
  const exportDoc = useMemo(() => convertScriptDocForExport(doc), [doc]);

  const orderedJobs = useMemo(() => {
    return Object.values(jobs).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [jobs]);

  useEffect(() => {
    jobIdsRef.current = [];
    setJobs({});
    setJobsError(null);

    if (!projectId) {
      return;
    }

    let cancelled = false;

    async function loadJobs() {
      setIsLoadingJobs(true);
      setJobsError(null);
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to load export queue");
        }
        const payload = (await response.json()) as { jobs: ExportJob[] };
        if (!cancelled) {
          const nextJobs: JobsState = {};
          const ids: string[] = [];
          for (const job of payload.jobs) {
            nextJobs[job.id] = job;
            ids.push(job.id);
          }
          jobIdsRef.current = ids;
          setJobs(nextJobs);
        }
      } catch (loadError) {
        if (!cancelled) {
          setJobsError(
            loadError instanceof Error ? loadError.message : "Unable to load export queue",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJobs(false);
        }
      }
    }

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!jobIdsRef.current.length || !projectId) {
        return;
      }

      const updatedJobs: ExportJob[] = [];

      await Promise.all(
        jobIdsRef.current.map(async (jobId) => {
          try {
            const response = await fetch(`/api/exports/${jobId}`);
            if (!response.ok) {
              return;
            }
            const job: ExportJob = await response.json();
            updatedJobs.push(job);
          } catch (pollError) {
            console.error("Failed to poll export job", pollError);
          }
        }),
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
  }, [projectId]);

  const queueExport = async (format: ExportFormat) => {
    if (!projectId || !exportDoc) {
      setError("Project data is still loading. Please try again shortly.");
      return;
    }

    setIsSubmitting(format);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          format,
          scriptDoc: exportDoc,
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
          : "Export queued. Keep an eye on the queue for download links.",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to queue export");
    } finally {
      setIsSubmitting(null);
      setRetryingJobId(null);
    }
  };

  const retryExport = async (job: ExportJob) => {
    setRetryingJobId(job.id);
    await queueExport(job.format, { deliverToEmail: job.deliverToEmail });
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
              disabled={
                isSubmitting !== null || !projectId || !exportDoc || isLoadingJobs || Boolean(jobsError)
              }
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting === formatOption.value ? "Queuing…" : `Queue ${formatOption.label}`}
            </button>
          ))}
        </div>
        {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {jobsError ? <p className="text-sm text-rose-300">{jobsError}</p> : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500">
          <span>Active jobs</span>
          {isLoadingJobs ? <span className="text-[0.6rem] text-zinc-400">Loading…</span> : null}
        </div>
        {orderedJobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
            {projectId ? "Queue an export to see progress updates here." : "Project data is still loading."}
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
                        href={`/api/exports/${job.id}/download`}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:border-white/40 hover:bg-white/20"
                      >
                        Download {job.result.fileName}
                      </a>
                      {job.result.notes ? (
                        <span className="text-xs text-zinc-500">{job.result.notes}</span>
                      ) : null}
                      {job.result.readyAt ? (
                        <span className="text-xs text-zinc-500">
                          Ready {new Date(job.result.readyAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                      {job.deliverToEmail ? (
                        <span className="text-xs text-zinc-500">
                          A copy has also been queued for delivery to {job.deliverToEmail}.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {job.error ? <p className="text-sm text-rose-300">{job.error}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {projectId && (
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500">Project: {projectId}</p>
      )}
    </div>
  );
}
