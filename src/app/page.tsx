import Link from "next/link";

import { AccessRequestForm } from "@/components/AccessRequestForm";
import { AnimatedHeadline } from "@/components/AnimatedHeadline";
import { fetchFaqContent, fetchLandingContent } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [landing, faq] = await Promise.all([fetchLandingContent(), fetchFaqContent()]);

  const footnotes = faq.coreFeatures.map((feature, index) => ({
    number: index + 1,
    title: feature.title,
    href: `/faq#${feature.slug}`,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-24 px-6 py-16 md:px-10">
      <header className="grain-overlay relative overflow-hidden rounded-[3rem] border border-white/10 bg-vs-panel px-10 py-16 shadow-glow backdrop-blur-2xl md:px-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
        <div className="flex flex-col gap-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium uppercase tracking-[0.35em] text-zinc-300">
            Script Speech
          </div>
          <div className="max-w-3xl space-y-6">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
              {landing.hero.title}
            </h1>
            <AnimatedHeadline phrases={landing.hero.phrases} />
            <p className="text-pretty text-lg text-zinc-300/90 md:text-xl">{landing.hero.description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/90 px-8 py-3 text-base font-semibold text-zinc-950 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              Enter the studio
            </Link>
            <Link
              href="/faq"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              Study the system
            </Link>
            <Link
              href="/preview"
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-8 py-3 text-base font-semibold text-white/80 transition-transform duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30"
            >
              Share the preview
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-12 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <h2 className="text-balance text-3xl font-semibold text-white md:text-4xl">
            A stripped-back control room where every surface listens.
          </h2>
          <p className="text-pretty text-base text-zinc-300/90 md:text-lg">
            Direct the session with voice and keep typing in reach for surgical edits. The interface is monochrome on purpose—your story, waveforms, and references are the only elements in motion. Scene boards and exports remain tucked away until you summon them
            <sup className="ml-1 text-sm align-super text-zinc-400">
              <Link href={footnotes[2].href}>{footnotes[2].number}</Link>
            </sup>
            .
          </p>
          <p className="text-pretty text-base text-zinc-400 md:text-lg">
            The landing page is nothing but welcome and invitation. Production controls live beyond the fold so prospects catch the vibe first and dive into details later.
          </p>
        </div>
        <div className="grid gap-6">
          {landing.vignettes.map((item) => (
            <div
              key={item.title}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-white/30 hover:bg-white/10"
            >
              <div className="flex items-start justify-between">
                <p className="text-lg font-semibold text-white">{item.title}</p>
                <Link href={footnotes[item.footnote - 1].href} className="text-sm text-zinc-400 transition-colors group-hover:text-white">
                  {item.footnote}
                </Link>
              </div>
              <p className="mt-3 text-sm text-zinc-400 md:text-base">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <h2 className="text-balance text-3xl font-semibold text-white md:text-4xl">How a session flows once you log in</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {landing.cadence.map((step) => (
            <div
              key={step.heading}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{step.heading}</p>
              <p className="mt-4 text-pretty text-base text-zinc-300/90">{step.body}</p>
              <Link href={footnotes[step.anchor - 1].href} className="mt-6 inline-flex text-sm text-zinc-400 hover:text-white">
                Learn more ↗
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-white/10 bg-white/5 px-10 py-16 text-center shadow-glass backdrop-blur-xl md:px-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">{landing.callToAction.eyebrow}</p>
          <h2 className="text-balance text-3xl font-semibold text-white md:text-5xl">{landing.callToAction.title}</h2>
          <p className="text-pretty text-base text-zinc-300/85 md:text-lg">{landing.callToAction.description}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={landing.callToAction.primaryCta.href}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-8 py-3 text-base font-semibold text-zinc-950 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              {landing.callToAction.primaryCta.label}
            </Link>
            <Link
              href={landing.callToAction.secondaryCta.href}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-base font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              {landing.callToAction.secondaryCta.label}
            </Link>
          </div>
          <p className="text-sm text-zinc-500">{landing.callToAction.helper}</p>
        </div>
        <AccessRequestForm />
      </section>

      <footer className="space-y-6 border-t border-white/10 pt-10 text-sm text-zinc-500">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-600">Feature footnotes</p>
          <Link href="/faq" className="text-xs uppercase tracking-[0.35em] text-white hover:text-vs-accent-strong">
            View the FAQ dossier
          </Link>
        </div>
        <ol className="grid gap-3 md:grid-cols-2">
          {footnotes.map((note) => (
            <li key={note.number} className="flex items-baseline gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <span className="text-xs font-semibold text-white/70">[{note.number}]</span>
              <Link href={note.href} className="text-sm text-zinc-300 hover:text-white">
                {note.title}
              </Link>
            </li>
          ))}
        </ol>
      </footer>
    </main>
  );
}
