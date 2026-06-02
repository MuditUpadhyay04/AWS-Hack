// The strip below screen 1's panels: the constraints/facts the system has
// gathered about the user. Hardcoded sample data for now; eventually these come
// from the backend alongside the roadmap.

const CONSTRAINTS = [
  { icon: "🎓", label: "final year student" },
  { icon: "💰", label: "$5,000 saved" },
  { icon: "🏠", label: "$650/mo rent" },
  { icon: "📅", label: "graduates in 8 months" },
  { icon: "💼", label: "part-time intern income" },
];

export function ConstraintsBar() {
  return (
    <section className="paper-card relative rounded-2xl p-5">
      <div className="tape -top-3 left-1/2 -translate-x-1/2 rotate-1" />
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-hand text-xl text-ink scribble-underline inline-block">
          things i know about you so far
        </span>
        <span className="font-hand text-sm text-pencil">— i'll keep adding as we talk</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CONSTRAINTS.map((c, i) => (
          <span
            key={c.label}
            className="fade-up inline-flex items-center gap-1.5 rounded-full border border-ink/30 bg-paper-warm px-3 py-1.5 font-hand text-base text-ink"
            style={{
              ["--tilt" as string]: `${(i % 2 ? 1 : -1) * (0.4 + (i % 3) * 0.3)}deg`,
              animationDelay: `${i * 80}ms`,
              boxShadow: "1px 2px 0 oklch(0.30 0.05 50 / 0.10)",
            }}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </span>
        ))}
        <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-pencil/60 bg-transparent px-3 py-1.5 font-hand text-base text-pencil transition hover:border-ink hover:text-ink">
          + add something
        </button>
      </div>
    </section>
  );
}
