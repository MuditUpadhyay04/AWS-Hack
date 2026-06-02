import { mockRoadmap, type Roadmap } from "@/data/mockRoadmap";

// The single integration seam between the frontend and the roadmap backend.
//
// Today it returns the local mock so the app is fully demoable on its own. When
// Teammate 2's backend is ready (API Gateway + Lambda, with the roadmap built
// from a Qdrant vector search over a knowledge base), set VITE_API_BASE_URL and
// this will POST the user's notes to it. No component code changes either way.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchRoadmap(notes: string): Promise<Roadmap> {
  // No backend configured yet — fall back to the bundled mock roadmap.
  if (!API_BASE_URL) {
    return mockRoadmap;
  }

  const res = await fetch(`${API_BASE_URL}/roadmap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });

  if (!res.ok) {
    throw new Error(`Roadmap request failed (${res.status})`);
  }

  return (await res.json()) as Roadmap;
}
