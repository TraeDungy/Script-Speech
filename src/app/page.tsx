import { coreFeatures } from "@/data/coreFeatures";
import { platformPillars } from "@/data/platformPillars";
import { workflowStages } from "@/data/workflowStages";
import { GlassCard } from "@/components/GlassCard";
import { SectionHeader } from "@/components/SectionHeader";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-24 px-6 py-16 md:px-10">
      <header className="relative overflow-hidden rounded-3xl border border-white/5 bg-vs-panel p-10 text-center shadow-glow backdrop-blur-2xl md:p-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan-500/10 via-transparent to-indigo-500/20" />
        <div className="mx-auto max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1 text-sm font-medium text-cyan-200/90">
            Voice-first storytelling OS
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Interview. Iterate. Deliver production-ready scripts in hours, not weeks.
          </h1>
          <p className="text-pretty text-lg text-slate-300/85 md:text-xl">
            Voice Script Studio pairs real-time conversation with multimodal reference boards to plan, draft, and deliver screen-ready stories across film, episodic, documentary, and commercial formats.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-cyan-300 to-indigo-400 px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
              Start a voice brief
            </button>
            <button className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3 text-base font-semibold text-white/90 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
              Explore the studio
            </button>
          </div>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {["Fountain", "Final Draft", "DOCX", "PDF", "TXT", "Reference boards"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200/90"
            >
              {item}
            </div>
          ))}
        </div>
      </header>

      <section className="space-y-12">
        <SectionHeader
          eyebrow="Core system"
          title="Orchestrated agents keep writers in flow"
          description="Every tool contributes to a shared ScriptDoc backbone. Voice directives, text edits, and reference assets stay synchronized from the first beat to the final export."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {coreFeatures.map((feature) => (
            <GlassCard key={feature.title} title={`${feature.icon} ${feature.title}`}>
              <p>{feature.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="space-y-12">
        <SectionHeader
          eyebrow="Workflow"
          title="A guided path from interview to delivery"
          description="Each stage adapts to the script type—commercial runtimes, episodic story arcs, or documentary narrative threads—all while preserving continuity and references."
        />
        <div className="grid gap-6 md:grid-cols-4">
          {workflowStages.map((stage) => (
            <GlassCard key={stage.label} title={stage.title} subtitle={stage.label} accent="indigo">
              <p>{stage.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="space-y-12">
        <SectionHeader
          eyebrow="Platform pillars"
          title="Designed for realtime collaboration between humans and AI"
          description="Built on a Next.js front end, NestJS orchestration layer, and OpenAI realtime capabilities—backed by secure storage, accessibility features, and export automation."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {platformPillars.map((pillar) => (
            <GlassCard key={pillar.title} title={pillar.title} accent="cyan">
              <ul className="space-y-2 text-sm text-slate-200/90 md:text-base">
                {pillar.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </section>

      <footer className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-10 text-center shadow-glow backdrop-blur-2xl md:p-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent" />
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-balance text-3xl font-semibold text-white md:text-5xl">
            Join the founding storyteller program
          </h2>
          <p className="text-pretty text-base text-slate-300/80 md:text-lg">
            Help shape Voice Script Studio’s realtime voice and multimodal workflows. Early access members receive concierge onboarding, direct feedback channels, and premium export credits.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-base font-semibold text-slate-950 shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">
              Request early access
            </button>
            <button className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-base font-semibold text-white/90 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
              View roadmap
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
