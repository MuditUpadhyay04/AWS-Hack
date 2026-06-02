
import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { WorldMapScene } from "@/components/WorldMapScene";
import { PlatformerScene } from "@/components/PlatformerScene";
import type { Roadmap as RoadmapData } from "@/data/mockRoadmap";

export function GameScreen({ roadmap, onBack }: { roadmap: RoadmapData; onBack: () => void }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current,
      backgroundColor: '#87CEEB', // Mario sky blue
      scene: [WorldMapScene, PlatformerScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0, x: 0 }, // Top-down map doesn't need Y gravity
          debug: false
        }
      }
    };

    gameInstance.current = new Phaser.Game(config);

    // Pass the roadmap data into the scene once it starts
    gameInstance.current.scene.start('WorldMapScene', { roadmap });

    return () => {
      gameInstance.current?.destroy(true);
    };
  }, [roadmap]);

  return (
    <div className="bg-paper screen-enter min-h-screen flex flex-col items-center py-10">
      <header className="mb-6 w-full max-w-4xl flex justify-between items-center px-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pencil">
            now playing · your roadmap, as a world
          </p>
          <h1 className="font-hand text-4xl text-ink">{roadmap.goal}</h1>
          <p className="text-pencil font-hand">
            each step is a level — surplus moves you forward, setbacks push you back.
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
      
      {/* Phaser Canvas Container */}
      <div 
        ref={gameRef} 
        className="rounded-xl overflow-hidden border-4 border-ink shadow-lg"
        style={{ width: 800, height: 600 }}
      />
    </div>
  );
}