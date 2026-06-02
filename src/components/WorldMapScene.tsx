
import Phaser from "phaser";
import type { Roadmap as RoadmapData, RoadmapStep } from "@/data/mockRoadmap";

export class WorldMapScene extends Phaser.Scene {
  private roadmap!: RoadmapData;
  private player!: Phaser.GameObjects.Arc;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  init(data: { roadmap: RoadmapData }) {
    this.roadmap = data.roadmap;
  }

  create() {
    const steps = this.roadmap.steps;
    // Cream "paper" background + warm ink palette, so the world reads as the
    // hand-drawn roadmap come to life (same colors as the sketch on screen 2).
    this.cameras.main.setBackgroundColor("#f3ead2");

    // React shows a "level briefing" when a step is tapped; once the player's
    // reflection passes, it emits this and we run the real scene transition.
    // Re-bind cleanly each time this scene (re)starts to avoid duplicate handlers.
    this.game.events.off("reflection-passed");
    this.game.events.on("reflection-passed", (step: RoadmapStep) => {
      this.scene.start("PlatformerScene", { step, roadmap: this.roadmap });
    });

    // Header: what this world is actually about.
    this.add
      .text(400, 36, this.roadmap.goal, {
        fontSize: "30px",
        color: "#2a2a2a",
        fontFamily: "Caveat, cursive",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 720 },
      })
      .setOrigin(0.5);
    this.add
      .text(400, 70, `your ${this.roadmap.domain} path · tap a step to play it · reach the flag to advance`, {
        fontSize: "16px",
        color: "#6b5d4a",
        fontFamily: "Caveat, cursive",
      })
      .setOrigin(0.5);

    const padding = 100;
    const spacing = steps.length > 1 ? (800 - padding * 2) / (steps.length - 1) : 0;
    const xFor = (i: number) => (steps.length > 1 ? padding + i * spacing : 400);
    const yFor = (i: number) => 320 + (i % 2 === 0 ? 30 : -30);

    // Connecting trail (warm ink, like the roadmap path).
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x6b5d4a, 0.7);
    graphics.beginPath();
    steps.forEach((_step, index) => {
      const x = xFor(index);
      const y = yFor(index);
      if (index === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    });
    graphics.strokePath();

    steps.forEach((step, index) => {
      const x = xFor(index);
      const y = yFor(index);

      // Difficulty controls size.
      let radius = step.difficulty === "hard" ? 25 : step.difficulty === "medium" ? 20 : 15;

      // Status/risk controls color — matched to the hand-drawn roadmap legend.
      let color = 0xe8e2d0; // not_started
      if (step.status === "done") color = 0xa7d8a3;
      if (step.status === "in_progress") color = 0xfde68a;
      if (step.is_risk) {
        color = 0xf4a261;
        radius += 5;
      }

      const node = this.add.circle(x, y, radius, color).setStrokeStyle(3, 0x3a2e1f);
      const locked = step.status === "not_started";
      if (locked) node.setAlpha(0.55);
      else node.setInteractive({ useHandCursor: true });

      // Marker inside the node: check / star / number (or "!" for a risk).
      const marker = step.is_risk
        ? "!"
        : step.status === "done"
        ? "✓"
        : step.status === "in_progress"
        ? "★"
        : String(index + 1);
      this.add
        .text(x, y, marker, {
          fontSize: "16px",
          color: "#3a2e1f",
          fontFamily: "Caveat, cursive",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // Title under the node.
      this.add
        .text(x, y + radius + 16, step.title, {
          fontSize: "14px",
          color: "#2a2a2a",
          fontFamily: "Caveat, cursive",
          align: "center",
          wordWrap: { width: 130 },
        })
        .setOrigin(0.5);

      // Flag a risk node as the "boss".
      if (step.is_risk) {
        this.add
          .text(x, y - radius - 14, "⚠ boss", {
            fontSize: "13px",
            color: "#7a1f00",
            fontFamily: "Caveat, cursive",
          })
          .setOrigin(0.5);
      }

      // "You are here" marker on the in-progress step.
      if (step.status === "in_progress") {
        this.player = this.add.circle(x, y - radius - 28, 9, 0x3b82f6).setStrokeStyle(2, 0x1e3a8a);
        this.add
          .text(x, y - radius - 46, "you", {
            fontSize: "12px",
            color: "#1e3a8a",
            fontFamily: "Caveat, cursive",
          })
          .setOrigin(0.5);
        this.tweens.add({
          targets: this.player,
          y: y - radius - 38,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // Click an unlocked step -> open its level briefing (handled in React).
      if (!locked) {
        node.on("pointerdown", () => {
          this.game.events.emit("step-selected", step);
        });
      }
    });

    // Celebrate when the whole roadmap is complete.
    if (steps.every((s) => s.status === "done")) {
      this.add
        .text(400, 560, `you reached: ${this.roadmap.goal} 🎉`, {
          fontSize: "22px",
          color: "#2f6b34",
          fontFamily: "Caveat, cursive",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }
  }
}