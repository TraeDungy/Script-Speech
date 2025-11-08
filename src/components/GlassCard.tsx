import type { ReactNode } from "react";

interface GlassCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "cyan" | "indigo";
}

const accentClassnames: Record<NonNullable<GlassCardProps["accent"]>, string> = {
  cyan: "from-cyan-500/40 to-cyan-400/10",
  indigo: "from-indigo-500/40 to-indigo-400/10",
};

export function GlassCard({ title, subtitle, children, accent = "cyan" }: GlassCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-vs-panel p-8 shadow-glass backdrop-blur-xl">
      <div
        className={`mb-6 inline-flex flex-col gap-1 bg-gradient-to-br ${accentClassnames[accent]} bg-clip-text text-left`}
      >
        <h2 className="text-2xl font-semibold text-transparent md:text-3xl">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-300/90 md:text-base">{subtitle}</p> : null}
      </div>
      <div className="space-y-4 text-slate-200/90">{children}</div>
    </section>
  );
}
