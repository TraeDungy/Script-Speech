import Link from "next/link";

import { VoiceChatPanel } from "./voice-chat-panel";

const prompts = [
  "Outline the cold open with a single location",
  "Drop in references for lighting and costume",
  "Preview export package"
];

export default function StudioPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-16 md:px-10">
      <header className="flex flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Workspace</p>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">Script Speech studio canvas</h1>
        <p className="max-w-3xl text-base text-zinc-400 md:text-lg">
          A monochrome control room centered around a living ScriptDoc. Speak or type to guide the agents, drag reference panes to the timeline, and keep the view focused on what matters.
        </p>
        <Link href="/" className="text-sm text-zinc-300 hover:text-white">
          Return to the landing page ↗
        </Link>
      </header>

      <section className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500">
              <span>Scene canvas</span>
              <span>Live sync</span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                <p className="text-sm font-semibold text-white">Outline</p>
                <p className="text-sm text-zinc-400">
                  Beat markers snap to your spoken timing. Drag to reorder or dictate adjustments for instant updates.
                </p>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                <p className="text-sm font-semibold text-white">Script view</p>
                <p className="text-sm text-zinc-400">
                  Scene text updates line-by-line with each directive. Hand off or continue typing without switching modes.
                </p>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                <p className="text-sm font-semibold text-white">Reference rail</p>
                <p className="text-sm text-zinc-400">
                  Slide boards and clips in from the edge, attach them to beats, and keep exports aligned.
                </p>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-vs-panel p-4">
                <p className="text-sm font-semibold text-white">Export queue</p>
                <p className="text-sm text-zinc-400">
                  Queue Fountain, FDX, and PDF without leaving the canvas. Status pulses softly when jobs finish.
                </p>
              </div>
            </div>
          </div>
        </div>
        <aside className="space-y-6">
          <VoiceChatPanel />
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Quick prompts</p>
            <ul className="mt-4 space-y-3">
              {prompts.map((prompt) => (
                <li key={prompt} className="rounded-2xl border border-white/10 bg-vs-panel p-3 text-sm text-zinc-300 transition-colors duration-300 hover:border-white/25 hover:text-white">
                  {prompt}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
