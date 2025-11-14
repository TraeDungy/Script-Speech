"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { MarketingContentSlug } from "@/lib/db/marketingContent";
import type { MarketingContentRow } from "@/lib/db/schema";

interface MarketingContentEditorProps {
  slug: MarketingContentSlug;
  title: string;
  description: string;
  latestDraft: MarketingContentRow | null;
  published: MarketingContentRow | null;
  revisions: MarketingContentRow[];
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusStyles(status: MarketingContentRow["status"]) {
  switch (status) {
    case "published":
      return "bg-emerald-500/10 text-emerald-200 border-emerald-400/40";
    case "draft":
      return "bg-sky-500/10 text-sky-200 border-sky-400/40";
    default:
      return "bg-zinc-500/10 text-zinc-300 border-zinc-400/30";
  }
}

export function MarketingContentEditor({
  slug,
  title,
  description,
  latestDraft,
  published,
  revisions,
}: MarketingContentEditorProps) {
  const router = useRouter();
  const baseRevision = latestDraft ?? published;
  const [editorValue, setEditorValue] = useState(() => JSON.stringify(baseRevision?.data ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    setEditorValue(JSON.stringify((latestDraft ?? published)?.data ?? {}, null, 2));
  }, [latestDraft?.id, published?.id]);

  const revisionHint = useMemo(() => {
    if (latestDraft) {
      return `Latest draft saved ${formatTimestamp(latestDraft.created_at)}`;
    }
    if (published) {
      return `Live revision published ${formatTimestamp(published.published_at ?? published.updated_at)}`;
    }
    return "No revisions have been saved yet.";
  }, [latestDraft, published]);

  async function saveDraft() {
    setError(null);
    setSuccess(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(editorValue);
    } catch (parseError) {
      setError("Draft JSON is invalid. Please fix syntax errors before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/marketing/${slug}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to save draft");
      }

      setSuccess("Draft snapshot saved. Refreshing data…");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishRevision(revisionId: string) {
    setError(null);
    setSuccess(null);
    setPublishingId(revisionId);
    try {
      const response = await fetch(`/api/admin/marketing/${slug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to publish revision");
      }

      setSuccess("Revision published. Refreshing live content…");
      router.refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish revision");
    } finally {
      setPublishingId(null);
    }
  }

  function resetToPublished() {
    if (!published) {
      return;
    }
    setEditorValue(JSON.stringify(published.data, null, 2));
    setError(null);
    setSuccess(null);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">{slug}</p>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
          </div>
          <p className="text-sm text-zinc-400">{revisionHint}</p>
        </div>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={isSaving}
              className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save draft snapshot"}
            </button>
            <button
              type="button"
              onClick={resetToPublished}
              disabled={!published}
              className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:-translate-y-0.5 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset to published
            </button>
            {baseRevision ? (
              <Link
                href={`/admin/marketing/preview/${slug}/${baseRevision.id}`}
                className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:-translate-y-0.5 hover:border-white/30"
              >
                Preview latest draft
              </Link>
            ) : null}
          </div>

          <textarea
            className="min-h-[420px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-white/90 focus:border-white/30 focus:outline-none"
            spellCheck={false}
            value={editorValue}
            onChange={(event) => {
              setEditorValue(event.target.value);
              setError(null);
              setSuccess(null);
            }}
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Revision history</p>
          <ul className="space-y-4">
            {revisions.map((revision) => (
              <li key={revision.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(revision.status)}`}>
                      {revision.status}
                    </span>
                    <p className="text-sm text-zinc-400">
                      Saved {formatTimestamp(revision.created_at)}
                      {revision.author_name ? ` by ${revision.author_name}` : revision.author_email ? ` by ${revision.author_email}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">Revision ID: {revision.id}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/marketing/preview/${slug}/${revision.id}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:border-white/30"
                    >
                      Preview
                    </Link>
                    {revision.status !== "published" ? (
                      <button
                        type="button"
                        onClick={() => publishRevision(revision.id)}
                        disabled={publishingId === revision.id}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {publishingId === revision.id ? "Publishing…" : "Publish"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
