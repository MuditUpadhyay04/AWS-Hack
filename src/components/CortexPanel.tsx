import { useEffect, useMemo, useState } from "react";

// The left panel of screen 1: the "AI is reading along" cortex. For now the
// insights are produced locally by simple keyword matching on the notes — it
// fakes the feeling of the AI noticing things as you type. (When the backend is
// live this could instead surface real detected context through the same prop.)

interface Insight {
  id: string;
  label: string;
  kind: "notice" | "guess" | "care";
}

const RULES: { match: RegExp; insight: Insight }[] = [
  { match: /\b(invest|stock|etf|portfolio|crypto)\b/i,
    insight: { id: "invest", label: "sounds like you're thinking about investing", kind: "notice" } },
  { match: /\b(loan|debt|tuition|owe)\b/i,
    insight: { id: "debt", label: "there's something about loans here", kind: "notice" } },
  { match: /\b(save|saving|emergency|fund)\b/i,
    insight: { id: "save", label: "you want to save more — got it", kind: "notice" } },
  { match: /\b(student|college|school|university|semester)\b/i,
    insight: { id: "student", label: "guessing you're a student?", kind: "guess" } },
  { match: /\b(rent|apartment|housing|dorm)\b/i,
    insight: { id: "housing", label: "housing is on your mind", kind: "care" } },
  { match: /\b(money|income|earn|salary|job|intern)\b/i,
    insight: { id: "income", label: "noting your income situation", kind: "notice" } },
  { match: /\b(health|gym|workout|fitness)\b/i,
    insight: { id: "health", label: "looks like a health goal too", kind: "notice" } },
  { match: /\b(career|cert|certification|skill)\b/i,
    insight: { id: "career", label: "career growth — i hear you", kind: "notice" } },
];

export function CortexPanel({ text }: { text: string }) {
  // Re-derive insights whenever the notes change; cap at 4 so it stays calm.
  const insights = useMemo(() => {
    const found = new Map<string, Insight>();
    for (const { match, insight } of RULES) {
      if (match.test(text)) found.set(insight.id, insight);
    }
    return Array.from(found.values()).slice(0, 4);
  }, [text]);

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
        <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-primary" />
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
