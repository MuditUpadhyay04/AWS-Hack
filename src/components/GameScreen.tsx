import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { WorldMapScene } from "@/components/WorldMapScene";
import { PlatformerScene } from "@/components/PlatformerScene";
import { speak } from "@/lib/voice";
import { validateReflection } from "@/lib/reflection";
import type { Roadmap as RoadmapData, RoadmapStep } from "@/data/mockRoadmap";

// The level is a *reward* for doing the real-world step. Before playing, the
// player says what they've actually done; an AI checks it's genuine, relevant
// effort. This keeps the game tied to the cause instead of feeling bolted on.
export function GameScreen({ roadmap, onBack }: { roadmap: RoadmapData; onBack: () => void }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  // The step whose level briefing is open (null = no modal).
  const [pendingStep, setPendingStep] = useState<RoadmapStep | null>(null);
  const [reflection, setReflection] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current,
      backgroundColor: "#87CEEB", // Mario sky blue
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [WorldMapScene, PlatformerScene],
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0, x: 0 }, debug: false },
      },
    };

    const game = new Phaser.Game(config);
    gameInstance.current = game;

    // The world map emits this when a step is tapped — we open the briefing
    // instead of launching the level straight away.
    const onStepSelected = (step: RoadmapStep) => {
      setPendingStep(step);
      setReflection("");
      setFeedback(null);
    };
    game.events.on("step-selected", onStepSelected);

    game.scene.start("WorldMapScene", { roadmap });

    return () => {
      game.events.off("step-selected", onStepSelected);
      game.destroy(true);
      gameInstance.current = null;
    };
  }, [roadmap]);

  // Voice the briefing prompt so the AI feels present at the gate.
  useEffect(() => {
    if (pendingStep) speak(`Before you play: what have you done toward ${pendingStep.title}?`);
  }, [pendingStep]);

  const handlePlay = async () => {
    if (!pendingStep || checking) return;
    setChecking(true);
    setFeedback(null);
    const verdict = await validateReflection(pendingStep.title, reflection);
    setChecking(false);
    if (!verdict.ok) {
      setFeedback(verdict.message);
      return;
    }
    speak(verdict.message);
    // Hand back to the world map, which runs the proper Phaser scene transition.
    gameInstance.current?.events.emit("reflection-passed", pendingStep);
    setPendingStep(null);
  };

  return (
    <div className="bg-paper screen-enter min-h-screen flex flex-col items-center px-4 py-10">
      <header className="mb-6 w-full max-w-4xl flex justify-between items-center px-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pencil">
            now playing · your roadmap, as a world
          </p>
          <h1 className="font-hand text-4xl text-ink">{roadmap.goal}</h1>
          <p className="text-pencil font-hand">
            do the real step, then play its level as a reward — surplus moves you forward, setbacks push you back.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border-2 border-ink bg-paper px-4 py-2 font-hand text-lg hover:bg-ink hover:text-paper transition"
        >
          ← Back to Roadmap
        </button>
      </header>

      {/* Phaser canvas — fluid up to 800px, keeps the 4:3 aspect on small screens */}
      <div
        ref={gameRef}
        className="w-full overflow-hidden rounded-xl border-4 border-ink shadow-lg"
        style={{ maxWidth: 800, aspectRatio: "4 / 3" }}
      />

      {/* Level briefing: reflect on the real-world step to earn the level */}
      {pendingStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="paper-card fade-up w-full max-w-md rounded-2xl p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pencil">
              level · {pendingStep.is_risk ? "boss" : pendingStep.difficulty}
            </p>
            <h2 className="font-hand text-3xl text-ink">{pendingStep.title}</h2>
            <p className="mt-2 font-hand text-lg text-pencil">
              this level is a reward for doing the real thing. tell me what you've actually done toward it.
            </p>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              autoFocus
              rows={3}
              placeholder="what have you done so far?"
              aria-label={`What have you done toward ${pendingStep.title}?`}
              className="mt-3 w-full resize-none rounded-lg border-2 border-dashed border-ink/40 bg-paper-warm/40 p-3 font-hand text-lg text-ink outline-none transition focus:border-solid focus:border-ink"
            />
            {feedback && <p className="mt-2 font-hand text-base text-primary">{feedback}</p>}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPendingStep(null)}
                className="rounded-full border-2 border-ink/50 bg-paper px-4 py-2 font-hand text-lg text-pencil transition hover:text-ink"
              >
                not yet
              </button>
              <button
                type="button"
                onClick={handlePlay}
                disabled={checking}
                className="rounded-full border-2 border-ink bg-ink px-5 py-2 font-hand text-lg text-paper transition hover:bg-primary hover:border-primary disabled:opacity-60"
              >
                {checking ? "checking…" : "I've done this →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
