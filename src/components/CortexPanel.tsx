import { useEffect, useMemo, useState } from "react";
import { detectInsights } from "@/lib/insights";

// The left panel of screen 1: the "AI is reading along" cortex. The insights it
// shows come from the shared detectInsights() keyword matcher, so they fake the
// feeling of the AI noticing things as you type.

export function CortexPanel({ text }: { text: string }) {
  // Re-derive insights whenever the notes change.
  const insights = useMemo(() => detectInsights(text), [text]);

  // Briefly show a "reading along" state each time the notes change.
  const [isThinking, setIsThinking] = useState(false);
  useEffect(() => {
    if (!text) return;
    setIsThinking(true);
    const t = setTimeout(() => setIsThinking(false), 700);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <aside className="paper-card relative flex flex-col gap-4 rounded-2xl p-5">
      <div className="tape -top-3 left-6 -rotate-3" />

      <div className="flex items-center gap-2.5">
        <span aria-hidden className="pulse-dot h-2.5 w-2.5 rounded-full bg-primary" />
        <div className="flex flex-col">
          <span className="font-hand text-xs text-pencil">a little note from me —</span>
          <span className="text-sm font-medium text-ink">
            {isThinking ? (
              <span className="blink-caret">reading along</span>
            ) : (
              text ? "i'm here, listening" : "i'll start reading once you write"
            )}
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        <span className="font-hand text-base text-pencil">what i'm picking up on:</span>
        {insights.length === 0 ? (
          <p className="font-hand text-base leading-snug text-pencil/80">
            nothing yet — just write whatever's on your mind. i'll catch on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {insights.map((i, idx) => (
              <li
                key={i.id}
                className="fade-up flex items-start gap-2 font-hand text-base leading-snug text-ink"
                style={{ ["--tilt" as string]: `${(idx % 2 ? 0.4 : -0.4)}deg`, animationDelay: `${idx * 80}ms` }}
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{i.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto rounded-xl border border-dashed border-border bg-paper-warm/60 p-3">
        <p className="font-hand text-base leading-snug text-pencil">
          write the way you'd write on a napkin. messy is good — i'll figure it out with you.
        </p>
      </div>
    </aside>
  );
}
