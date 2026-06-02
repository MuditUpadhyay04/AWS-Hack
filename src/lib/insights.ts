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
  // income owns earning/money words; job/salary moved to `career` to avoid overlap.
  { match: /\b(money|income|earn|intern)\b/i,
    insight: { id: "income", label: "noting your income situation", kind: "notice" } },
  { match: /\b(health|gym|workout|fitness|doctor|diet|mental|sleep|calories|meditat)\b/i,
    insight: { id: "health", label: "looks like a health goal too", kind: "notice" } },
  // career owns job-move words; cert/skill/learning moved to `education`.
  { match: /\b(career|job|promotion|resume|interview|salary|raise)\b/i,
    insight: { id: "career", label: "career growth — i hear you", kind: "notice" } },
  { match: /\b(course|degree|cert|certification|study|class|skill|bootcamp|learn)\b/i,
    insight: { id: "education", label: "learning something new — noted", kind: "notice" } },
  { match: /\b(move|moving|relocate|city|new place|new city)\b/i,
    insight: { id: "relocation", label: "a move might be in the picture", kind: "care" } },
  { match: /\b(freelance|side hustle|passive income|startup|business|selling|consulting)\b/i,
    insight: { id: "sideincome", label: "you're thinking about earning more", kind: "notice" } },
  { match: /\b(anxious|stress|overwhelm|burnout|tired|exhaust|stuck|lost)\b/i,
    insight: { id: "emotional", label: "sounds like there's a lot on your plate", kind: "care" } },
];

// All distinct insights matched in the text (one per id).
function matchAll(text: string): Insight[] {
  const found = new Map<string, Insight>();
  for (const { match, insight } of RULES) {
    if (match.test(text)) found.set(insight.id, insight);
  }
  return Array.from(found.values());
}

// Returns up to 4 distinct insights matched in the text (kept calm on purpose).
export function detectInsights(text: string): Insight[] {
  return matchAll(text).slice(0, 4);
}

export interface DomainResult {
  /** A friendly domain label once we're confident, else null. */
  domain: string | null;
  /** How many distinct rule ids matched (drives "are we confident yet?"). */
  matchCount: number;
}

// Maps the matched insight ids to a single domain once 2+ rules match. Used by
// the top-bar "domain mode" badge so the app can signal it understood the topic.
export function deriveDomain(text: string): DomainResult {
  const ids = new Set(matchAll(text).map((i) => i.id));
  const matchCount = ids.size;

  if (matchCount < 2) return { domain: null, matchCount };
  if (["invest", "debt", "save", "income"].some((d) => ids.has(d)))
    return { domain: "finance", matchCount };
  if (ids.has("education") || ids.has("career"))
    return { domain: "career & learning", matchCount };
  if (ids.has("health")) return { domain: "health", matchCount };
  if (ids.has("sideincome")) return { domain: "entrepreneurship", matchCount };
  return { domain: "personal growth", matchCount };
}
