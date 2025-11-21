"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExportFormat, ExportJob, ScriptDoc as ExportScriptDoc } from "@/lib/exports/types";
import type {
  ScriptDoc as StudioScriptDoc,
  ScriptScene,
  ScriptSceneElement,
} from "@/lib/scriptDoc";
import { useExportJobStatus } from "@/lib/hooks/useExportJobStatus";
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
  succeeded: {
    background: "bg-emerald-500/10",
    text: "text-emerald-200",
    border: "border-emerald-500/30",
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

function ExportJobRow({ job, onUpdate }: { job: ExportJob; onUpdate: (job: ExportJob) => void }) {
  const { job: liveJob, error } = useExportJobStatus(job.id, { initialJob: job });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const resolvedJob = liveJob ?? job;
  const statusStyle = statusStyles[resolvedJob.status];

  useEffect(() => {
    if (liveJob) {
      onUpdate(liveJob);
    }
  }, [liveJob, onUpdate]);

  const handleDownload = async () => {
    setDownloadError(null);
    try {
      const response = await fetch(`/api/exports/${resolvedJob.id}/download`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to generate download link");
      }

      const payload = (await response.json()) as { url: string };
      window.open(payload.url, "_blank", "noreferrer");
    } catch (downloadErr) {
      setDownloadError(
        downloadErr instanceof Error ? downloadErr.message : "Unable to download export",
      );
    }
  };

  return (
    <li className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{resolvedJob.format.toUpperCase()} export</p>
          <p className="text-xs text-zinc-500">
            Requested {new Date(resolvedJob.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span
          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyle.background} ${statusStyle.text} ${statusStyle.border}`}
        >
          {resolvedJob.status}
        </span>
      </div>
      {resolvedJob.downloadPath && (resolvedJob.status === "succeeded" || resolvedJob.status === "completed") ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:border-white/40 hover:bg-white/20"
          >
            Download {resolvedJob.downloadPath.split("/").pop() ?? "export"}
          </button>
        </div>
      ) : null}
      {downloadError ? <p className="text-sm text-rose-300">{downloadError}</p> : null}
      {resolvedJob.errorMessage || resolvedJob.error ? (
        <p className="text-sm text-rose-300">{resolvedJob.errorMessage ?? resolvedJob.error}</p>
      ) : null}
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
    </li>
  );
}

export function ExportQueuePanel({ projectId }: ExportQueuePanelProps) {
  const [jobs, setJobs] = useState<JobsState>({});
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const doc = useScriptDocStore((state) => state.doc);
  const exportDoc = useMemo(() => convertScriptDocForExport(doc), [doc]);
  const scriptDocId = doc?.revision?.id ?? null;

  const orderedJobs = useMemo(() => {
    return Object.values(jobs).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [jobs]);

  const upsertJob = useCallback((job: ExportJob) => {
    setJobs((previous) => ({ ...previous, [job.id]: { ...previous[job.id], ...job } }));
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchJobs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/exports", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load exports");
        }

        const payload = (await response.json()) as ExportJob[];
        if (!isActive) return;

        const nextJobs: JobsState = {};
        payload.forEach((job) => {
          nextJobs[job.id] = job;
        });
        setJobs(nextJobs);
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load exports");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void fetchJobs();

    return () => {
      isActive = false;
    };
  }, []);

  const queueExport = async (format: ExportFormat) => {
    if (!exportDoc) {
      setError("Script data is still loading. Please try again shortly.");
      return;
    }

    setIsSubmitting(format);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/exports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          format,
          scriptDocId: scriptDocId ?? undefined,
          content: exportDoc,
          deliverToEmail: email.trim() ? email.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to queue export");
      }

      const job: ExportJob = await response.json();
      upsertJob(job);
      setMessage("Export queued. Keep this panel open to monitor progress.");
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
          Queue Fountain, FDX, DOCX, or PDF exports. Jobs process asynchronously, and links appear as soon as the renderer finishes.
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
              disabled={isSubmitting !== null || !exportDoc}
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
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500">
          <span>Active jobs</span>
          {isLoading ? <span className="text-[0.6rem] text-zinc-400">Refreshing…</span> : null}
        </div>
        {orderedJobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
            {projectId ? "Queue an export to see progress updates here." : "Project data is still loading."}
          </p>
        ) : (
          <ul className="space-y-4">
            {orderedJobs.map((job) => (
              <ExportJobRow key={job.id} job={job} onUpdate={upsertJob} />
            ))}
          </ul>
        )}
      </div>

      {projectId && (
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500">Project: {projectId}</p>
      )}
    </div>
  );
}
