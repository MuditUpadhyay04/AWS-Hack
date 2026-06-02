// Lightweight keyword detection that fakes the "AI is reading along" feeling on
// screen 1. Shared by the cortex panel (which shows the insights) and App (which
// uses whether anything was picked up to reveal the "things I know" strip).
//
// This is intentionally simple and local — when the backend is live, real
// detected context could replace it without changing the components that use it.

export interface Insight {
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

// Returns up to 4 distinct insights matched in the text (kept calm on purpose).
export function detectInsights(text: string): Insight[] {
  const found = new Map<string, Insight>();
  for (const { match, insight } of RULES) {
    if (match.test(text)) found.set(insight.id, insight);
  }
  return Array.from(found.values()).slice(0, 4);
}
