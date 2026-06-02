import { useCallback, useEffect, useMemo, useState } from "react";
import { CortexPanel } from "@/components/CortexPanel";
import { Notepad } from "@/components/Notepad";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { ConstraintsBar } from "@/components/ConstraintsBar";
import { Roadmap } from "@/components/Roadmap";
import { GameScreen } from "@/components/GameScreen";
import { UnderstandingPreview } from "@/components/UnderstandingPreview";
import { fetchRoadmap } from "@/lib/api";
import { deriveDomain, detectInsights } from "@/lib/insights";
import { parseNotes } from "@/lib/notes";
import type { Roadmap as RoadmapData } from "@/data/mockRoadmap";

// Minimum time to keep the "sketching..." beat on screen so the hand-off feels
// deliberate even when the data returns instantly (as the mock does).
const MIN_SKETCH_MS = 1400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Top-level container. Holds the two pieces of shared state — the notes text
// and which screen we're on — and toggles between screen 1 (notes) and screen 2
// (roadmap). Navigation is a simple in-page toggle rather than a router, which
// keeps the static S3/CloudFront hosting trivial (no SPA routing fallback).
export default function App() {
  const [screen, setScreen] = useState<"notes" | "roadmap"| "game">("notes");
  const [text, setText] = useState("");
  // The roadmap returned by the backend (or mock); null until the user builds one.
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  // Whether we're mid-"sketching..." (fetching + the deliberate beat).
  const [building, setBuilding] = useState(false);
  // The plug-ins panel starts hidden; the user opens it, and a pin keeps it open.
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [integrationsPinned, setIntegrationsPinned] = useState(false);

  // The page reveals itself as the "AI" notices things: cortex once you start
  // writing, the "things I know" strip once it actually picks something up.
  const hasText = text.trim().length > 0;
  const hasInsights = useMemo(() => detectInsights(text).length > 0, [text]);
  // Once 2+ insight rules match, we're confident enough to name the domain.
  const domain = useMemo(() => deriveDomain(text).domain, [text]);
  // Live structured view of the notes — shown in the preview and sent to the backend.
  const notesDoc = useMemo(() => parseNotes(text), [text]);
  const integrationsVisible = integrationsOpen || integrationsPinned;

  const handleBuild = useCallback(async () => {
    if (building) return;
    setBuilding(true);
    try {
      // Wait on whichever takes longer: the fetch or the minimum beat. Instant
      // for the mock today; honours real latency once the backend is wired.
      const [data] = await Promise.all([fetchRoadmap(notesDoc), wait(MIN_SKETCH_MS)]);
      setRoadmap(data);
      setScreen("roadmap");
    } catch (err) {
      // Don't dead-end the demo — log it and let the user try again.
      console.error("Couldn't build the roadmap:", err);
    } finally {
      setBuilding(false);
    }
  }, [notesDoc, building]);

  // Cmd/Ctrl + Enter mirrors the "build my roadmap" button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleBuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleBuild]);

  if (screen === "game" && roadmap)
    return <GameScreen roadmap={roadmap} onBack={() => setScreen("roadmap")} />;
  
  if (screen === "roadmap" && roadmap)
    return (
      <div className="screen-enter">
        <Roadmap
          roadmap={roadmap}
          onBack={() => setScreen("notes")}
          onPlay={() => setScreen("game")}
        />
      </div>
    );

  return (
    <main className="bg-paper screen-enter min-h-screen text-ink">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-hand text-4xl text-ink leading-none">Pathfinder</span>
            <span className="font-hand text-base text-pencil leading-none">— a thinking page</span>
          </div>
          <div className="flex items-center gap-3">
            {domain && (
              <span className="fade-up inline-flex items-center gap-1.5 rounded-full border border-success/50 bg-success/20 px-3 py-1 font-hand text-base text-ink">
                <span aria-hidden className="pulse-dot h-2 w-2 rounded-full bg-success" />
                {domain} mode
              </span>
            )}
            <span className="hidden font-hand text-base text-pencil md:inline">
              <span aria-hidden className="text-primary">●</span> writing with you
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
          {/* left: the cortex appears once there's something to read */}
          <div className="order-2 lg:order-1">
            {hasText && (
              <div className="slide-in-left">
                <CortexPanel text={text} />
              </div>
            )}
          </div>

          {/* middle: the notepad — always here, the heart of screen 1 */}
          <div className="order-1 lg:order-2">
            <Notepad value={text} onChange={setText} />
          </div>

          {/* right: plug-ins, hidden behind a launcher until opened/pinned */}
          <div className="order-3">
            {integrationsVisible ? (
              <div className="slide-in-right">
                <IntegrationsPanel
                  pinned={integrationsPinned}
                  onTogglePin={() => setIntegrationsPinned((p) => !p)}
                  onClose={() => {
                    setIntegrationsOpen(false);
                    setIntegrationsPinned(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIntegrationsOpen(true)}
                className="paper-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
              >
                <span aria-hidden className="text-xl">🧩</span>
                <span className="flex flex-col">
                  <span className="font-hand text-lg text-ink">plug-ins</span>
                  <span className="font-hand text-sm text-pencil">connect your real stuff</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* live structured view of the notes — what we'll send to the backend */}
        {notesDoc.sections.length > 0 && (
          <div className="screen-enter mt-6">
            <UnderstandingPreview doc={notesDoc} />
          </div>
        )}

        {/* "things i know about you" — appears once the AI picks something up */}
        {hasInsights && (
          <div className="screen-enter mt-6">
            <ConstraintsBar />
          </div>
        )}

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
            type="button"
            onClick={handleBuild}
            disabled={building}
            className="group relative inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3 font-hand text-xl text-paper transition hover:scale-[1.02] hover:bg-primary hover:border-primary disabled:opacity-80"
            style={{ boxShadow: "3px 3px 0 oklch(0.30 0.05 50 / 0.25)" }}
          >
            {building ? (
              <>
                <span aria-hidden className="h-2 w-2 animate-ping rounded-full bg-paper" />
                sketching your path…
              </>
            ) : (
              <>
                build my roadmap
                <span aria-hidden className="transition group-hover:translate-x-1">→</span>
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
