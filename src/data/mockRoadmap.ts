// The roadmap data contract — shared with the backend (Teammate 2, which builds
// it via Qdrant vector search over a knowledge base) and the Mario-style game
// (Teammate 3). The frontend renders entirely from this shape, so going live is
// just a matter of swapping where the data comes from (see src/lib/api.ts) —
// none of the components change.

export type Difficulty = "easy" | "medium" | "hard";

export type StepStatus = "done" | "in_progress" | "not_started";

export interface RoadmapStep {
  id: number;
  title: string;
  difficulty: Difficulty;
  /** Drives how the node looks: completed, current, or still locked. */
  status: StepStatus;
  /** Hazard step — the one that becomes a "Bowser" level in the game. */
  is_risk: boolean;
}

export interface Roadmap {
  /** finance / education / health / ... — lets the roadmap restyle per topic later. */
  domain: string;
  goal: string;
  steps: RoadmapStep[];
}

// Stand-in roadmap used until the backend is wired. Matches the shared sample
// goal so the demo stays consistent with Teammate 3's game world.
export const mockRoadmap: Roadmap = {
  domain: "finance",
  goal: "Pay off loans and start investing",
  steps: [
    { id: 0, title: "Build an emergency fund", difficulty: "easy", status: "done", is_risk: false },
    { id: 1, title: "Cut monthly costs", difficulty: "medium", status: "in_progress", is_risk: false },
    { id: 2, title: "Start loan payments", difficulty: "medium", status: "not_started", is_risk: false },
    { id: 3, title: "New semester loans hit", difficulty: "hard", status: "not_started", is_risk: true },
    { id: 4, title: "First investment", difficulty: "hard", status: "not_started", is_risk: false },
  ],
};
