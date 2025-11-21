import { useCallback, useEffect, useRef, useState } from "react";

import type { ExportJob } from "@/lib/exports/types";

const TERMINAL_STATUSES: ExportJob["status"][] = ["succeeded", "failed", "completed"];

interface Options {
  intervalMs?: number;
  initialJob?: ExportJob | null;
}

export function useExportJobStatus(jobId?: string, options: Options = {}) {
  const intervalMs = options.intervalMs ?? 2000;
  const [job, setJob] = useState<ExportJob | null>(options.initialJob ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!options.initialJob);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/exports/${encodeURIComponent(jobId)}`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      const payload = (await response.json()) as ExportJob;
      setJob(payload);
      setError(null);
    } catch (pollError) {
      if ((pollError as { name?: string }).name === "AbortError") {
        return;
      }
      setError(pollError instanceof Error ? pollError.message : "Unable to load job status");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return undefined;

    void fetchStatus();

    const timer = setInterval(() => {
      if (job && TERMINAL_STATUSES.includes(job.status)) {
        return;
      }
      void fetchStatus();
    }, intervalMs);

    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [fetchStatus, intervalMs, job, jobId]);

  return { job, error, isLoading, refresh: fetchStatus };
}
