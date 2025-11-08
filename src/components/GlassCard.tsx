import type { ReactNode } from "react";

interface GlassCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "light" | "dim";
  id?: string;
  className?: string;
}

const accentClassnames: Record<NonNullable<GlassCardProps["accent"]>, string> = {
  light: "from-white/60 to-white/0",
  dim: "from-zinc-500/40 to-zinc-800/10",
};

export function GlassCard({ title, subtitle, children, accent = "light", id, className }: GlassCardProps) {
  return (
    <section
      id={id}
      className={`rounded-3xl border border-white/10 bg-vs-panel p-8 shadow-glass backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1 ${
        className ?? ""
      }`}
    >
      <div
        className={`mb-6 inline-flex flex-col gap-1 bg-gradient-to-br ${accentClassnames[accent]} bg-clip-text text-left`}
      >
        <h2 className="text-2xl font-semibold text-transparent md:text-3xl">{title}</h2>
        {subtitle ? <p className="text-sm text-zinc-300/90 md:text-base">{subtitle}</p> : null}
      </div>
      <div className="space-y-4 text-zinc-200/90">{children}</div>
    </section>
  );
}
