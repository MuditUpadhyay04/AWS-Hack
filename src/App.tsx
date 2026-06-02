import { useEffect, useState } from "react";
import { CortexPanel } from "@/components/CortexPanel";
import { Notepad } from "@/components/Notepad";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { ConstraintsBar } from "@/components/ConstraintsBar";
import { Roadmap } from "@/components/Roadmap";
import { mockRoadmap } from "@/data/mockRoadmap";

// Top-level container. Holds the two pieces of shared state — the notes text
// and which screen we're on — and toggles between screen 1 (notes) and screen 2
// (roadmap). Navigation is a simple in-page toggle rather than a router, which
// keeps the static S3/CloudFront hosting trivial (no SPA routing fallback).
export default function App() {
  const [screen, setScreen] = useState<"notes" | "roadmap">("notes");
  const [text, setText] = useState("");
  // Short "sketching..." beat so the hand-off to the roadmap feels deliberate.
  const [building, setBuilding] = useState(false);

  const handleBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      setScreen("roadmap");
      setBuilding(false);
    }, 1400);
  };

  // Cmd/Ctrl + Enter is a shortcut for the "build my roadmap" button. The
  // handler only touches state setters (stable), so binding once is enough.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleBuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (screen === "roadmap")
    return <Roadmap roadmap={mockRoadmap} onBack={() => setScreen("notes")} />;

  return (
    <main className="bg-paper min-h-screen text-ink">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-hand text-4xl text-ink leading-none">Pathfinder</span>
            <span className="font-hand text-base text-pencil leading-none">— a thinking page</span>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <span className="font-hand text-base text-pencil">
              <span className="text-primary">●</span> writing with you
            </span>
          </div>
        </header>

        <div className="mb-6 max-w-3xl">
          <h1 className="font-hand text-4xl leading-tight text-ink md:text-5xl">
            hey — what are you trying to figure out?
          </h1>
          <p className="mt-2 font-hand text-xl leading-snug text-pencil">
            just write. headings, bullets, half-thoughts, doesn't matter. i'll read along, and together we'll trace something that makes sense — even if you don't see it yet.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr_300px]">
          <CortexPanel text={text} />
          <Notepad value={text} onChange={setText} />
          <IntegrationsPanel />
        </div>

        <div className="mt-6">
          <ConstraintsBar />
        </div>

        <div
          className="paper-card relative mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl p-5 md:flex-row"
          style={{ background: "linear-gradient(180deg, var(--paper-warm), var(--paper))" }}
        >
          <div>
            <p className="font-hand text-2xl text-ink">
              {text.trim().length > 20
                ? "okay — i think i've got enough to sketch something."
                : "keep writing a bit. i'll let you know when we've got something."}
            </p>
            <p className="font-hand text-base text-pencil">
              i'll turn this into a hand-drawn path you can actually follow.
            </p>
          </div>
          <button
            onClick={handleBuild}
            disabled={building}
            className="group relative inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3 font-hand text-xl text-paper transition hover:scale-[1.02] hover:bg-primary hover:border-primary disabled:opacity-80"
            style={{ boxShadow: "3px 3px 0 oklch(0.30 0.05 50 / 0.25)" }}
          >
            {building ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-paper" />
                sketching your path…
              </>
            ) : (
              <>
                build my roadmap
                <span className="transition group-hover:translate-x-1">→</span>
              </>
            )}
          </button>
        </div>

        <footer className="mt-10 flex items-center justify-between font-hand text-base text-pencil">
          <span>made with care · pathfinder</span>
          <span>⌘ + enter when you're ready</span>
        </footer>
      </div>
    </main>
  );
}
