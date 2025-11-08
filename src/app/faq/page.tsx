import Link from "next/link";

import { GlassCard } from "@/components/GlassCard";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchFaqContent } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function FAQPage() {
  const faq = await fetchFaqContent();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-20 px-6 py-16 md:px-10">
      <header className="space-y-10">
        <SectionHeader
          alignment="left"
          eyebrow="FAQ dossier"
          title="Details that stay off the landing page"
          description="Script Speech keeps the hero moment quiet and confident. This dossier captures the mechanics and safeguards once you are inside the workspace."
        />
        <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
          Looking for something specific? Email us at
          <Link href="mailto:hello@scriptspeech.com" className="ml-2 underline underline-offset-4">
            hello@scriptspeech.com
          </Link>
          .
        </p>
      </header>

      <section className="space-y-10">
        <SectionHeader
          alignment="left"
          eyebrow="Core system"
          title="What powers each session?"
          description="Four feature pillars handle intake, drafting, reference management, and delivery without overwhelming the interface."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {faq.coreFeatures.map((feature) => (
            <GlassCard key={feature.slug} id={feature.slug} title={feature.title}>
              <p>{feature.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <SectionHeader
          alignment="left"
          eyebrow="Workflow"
          title="How does the flow feel after login?"
          description="The studio canvas opens to a voice-ready control room. These stages surface progressively so the workspace stays calm."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {faq.workflowStages.map((stage) => (
            <GlassCard key={stage.slug} id={stage.slug} title={stage.title} subtitle={stage.label} accent="dim">
              <p>{stage.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <SectionHeader
          alignment="left"
          eyebrow="Platform"
          title="Under the hood"
          description="Script Speech combines realtime voice processing, orchestrated AI agents, and reference management."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {faq.platformPillars.map((pillar) => (
            <GlassCard key={pillar.slug} id={pillar.slug} title={pillar.title}>
              <ul className="space-y-2 text-sm text-zinc-300/90 md:text-base">
                {pillar.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </section>

      <footer className="space-y-6 border-t border-white/10 pt-10 text-sm text-zinc-500">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-600">Back to top</p>
        <Link href="/" className="inline-flex text-sm text-white hover:text-vs-accent-strong">
          Return to the landing page ↗
        </Link>
      </footer>
    </main>
  );
}
