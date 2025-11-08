import Link from "next/link";

import { AnimatedHeadline } from "@/components/AnimatedHeadline";
import { fetchFaqContent } from "@/lib/http";

const previewPhrases = [
  "Minimal monochrome hero",
  "Voice-led studio canvas",
  "Footnote-led feature dossier",
];

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const faq = await fetchFaqContent();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-16 md:px-10">
      <header className="space-y-8">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Preview</p>
        <div className="space-y-6">
          <h1 className="text-balance text-4xl font-semibold text-white md:text-5xl">
            Walk through the Script Speech experience in seconds.
          </h1>
          <AnimatedHeadline phrases={previewPhrases} />
          <p className="max-w-3xl text-pretty text-base text-zinc-300/90 md:text-lg">
            This condensed preview stitches together the highlights from the landing page, the studio canvas, and the FAQ dossier so stakeholders can scan the direction without logging in.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white hover:border-white/30 hover:bg-white/10">
            Landing page
          </Link>
          <Link href="/studio" className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white hover:border-white/30 hover:bg-white/10">
            Studio canvas
          </Link>
          <Link href="/faq" className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white hover:border-white/30 hover:bg-white/10">
            FAQ dossier
          </Link>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {faq.coreFeatures.slice(0, 4).map((feature, index) => (
          <div key={feature.slug} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur transition hover:border-white/25 hover:bg-white/10">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Feature {index + 1}</p>
            <h2 className="mt-3 text-lg font-semibold text-white">{feature.title}</h2>
            <p className="mt-3 text-sm text-zinc-300">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Studio canvas vignette</p>
          <p className="mt-4 text-sm text-zinc-300">
            Voice chat, quick prompts, and the living ScriptDoc sit inside a restrained control room. Micro animations keep focus on the session instead of UI chrome.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">FAQ dossier</p>
          <p className="mt-4 text-sm text-zinc-300">
            Footnotes on the landing page route here so prospects can deep dive without cluttering the hero moment.
          </p>
        </div>
      </section>

      <footer className="space-y-4 border-t border-white/10 pt-8 text-sm text-zinc-500">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-600">Share</p>
        <p className="text-sm text-zinc-400">
          Drop this preview link in investor updates or team chats when you need a fast walkthrough of Script Speech.
        </p>
      </footer>
    </main>
  );
}
