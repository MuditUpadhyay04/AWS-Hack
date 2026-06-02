import { mockRoadmap, type Roadmap } from "@/data/mockRoadmap";
import type { NotesDocument } from "@/lib/notes";

// The single integration seam between the frontend and the roadmap backend.
//
// The backend (Teammate 2's Qdrant engine, POST /roadmap/next) runs a short,
// stateless multi-turn interview: we send the notes plus the answers gathered
// so far, and it returns either the next clarifying question or the finished
// roadmap. Until VITE_API_BASE_URL is set we simulate that here with a couple of
// canned questions and the mock roadmap — so the whole flow is demoable offline.

export interface InterviewQuestion {
  id: string;
  text: string;
  domain: string;
}

export interface InterviewAnswer {
  domain: string;
  questionId?: string;
  value: string;
}

export interface Constraint {
  icon: string;
  label: string;
}

export interface Rationale {
  path: string;
  similarUsers: number;
  successRate: number;
}

export type InterviewResponse =
  | { status: "question"; question: InterviewQuestion; constraints: Constraint[] }
  | { status: "complete"; roadmap: Roadmap; constraints: Constraint[]; rationale?: Rationale };

export interface InterviewInput {
  notes: string;
  structured: NotesDocument["sections"];
  answers: InterviewAnswer[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function advanceInterview(input: InterviewInput): Promise<InterviewResponse> {
  // No backend configured yet — run the local mock interview.
  if (!API_BASE_URL) {
    return mockAdvance(input);
  }

  const res = await fetch(`${API_BASE_URL}/roadmap/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Roadmap request failed (${res.status})`);
  }

  return (await res.json()) as InterviewResponse;
}

// --- Mock interview (used until the backend is wired) ---

const MOCK_QUESTIONS: InterviewQuestion[] = [
  { id: "q_timeline", text: "Roughly when do you want to reach this — a few months, a year, longer?", domain: "timeline" },
  { id: "q_risk", text: "How do you feel about risk right now — play it safe, or open to some?", domain: "risk_tolerance" },
];

const ICONS: Record<string, string> = {
  timeline: "⏳",
  risk_tolerance: "📊",
  debt: "💰",
  income: "💵",
  savings: "🏦",
};

function mockConstraints(answers: InterviewAnswer[]): Constraint[] {
  return answers.map((a) => ({
    icon: ICONS[a.domain] ?? "•",
    label: `${a.domain.replace(/_/g, " ")}: ${a.value}`,
  }));
}

function mockAdvance(input: InterviewInput): InterviewResponse {
  const asked = input.answers.length;
  const constraints = mockConstraints(input.answers);

  if (asked < MOCK_QUESTIONS.length) {
    return { status: "question", question: MOCK_QUESTIONS[asked], constraints };
  }

  return {
    status: "complete",
    roadmap: mockRoadmap,
    constraints,
    rationale: { path: "balanced_debt_and_savings", similarUsers: 12, successRate: 0.84 },
  };
}
