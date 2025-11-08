interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  alignment?: "left" | "center";
}

const alignmentClassnames: Record<NonNullable<SectionHeaderProps["alignment"]>, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
};

export function SectionHeader({ eyebrow, title, description, alignment = "center" }: SectionHeaderProps) {
  return (
    <div className={`mx-auto flex max-w-4xl flex-col gap-4 ${alignmentClassnames[alignment]}`}>
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-vs-accent">{eyebrow}</span>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold text-white md:text-5xl">{title}</h2>
      {description ? (
        <p className="text-pretty text-base text-slate-300/85 md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
