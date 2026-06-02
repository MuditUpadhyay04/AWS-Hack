
import Phaser from "phaser";
import type { Roadmap as RoadmapData } from "@/data/mockRoadmap";

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
    const padding = 100;
    const spacing = (800 - padding * 2) / (steps.length - 1);

    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xffffff, 1);

    // Draw the connecting path first
    graphics.beginPath();
    steps.forEach((step, index) => {
      const x = padding + (index * spacing);
      const y = 300 + (index % 2 === 0 ? 30 : -30); // Slight zig-zag
      
      if (index === 0) graphics.moveTo(x, y);
      else graphics.lineTo(x, y);
    });
    graphics.strokePath();

    // Render nodes based on the 6 rules
    steps.forEach((step, index) => {
      const x = padding + (index * spacing);
      const y = 300 + (index % 2 === 0 ? 30 : -30);

      // Rule 5: Difficulty controls size
      let radius = 15;
      if (step.difficulty === "medium") radius = 20;
      if (step.difficulty === "hard") radius = 25;

      let color = 0x888888; // Default: Rule 3 (not_started / gray)
      
      // Rule 1: Done -> Green
      if (step.status === "done") color = 0x4ade80; 
      
      // Rule 2: In Progress -> Highlighted (Yellow)
      if (step.status === "in_progress") color = 0xfde047;

      // Rule 4: Risk -> Red/Orange (Bowser level substitute)
      if (step.is_risk) {
        color = 0xef4444; 
        radius += 5; // Risks look bigger/spikier
      }

      // Draw the level node
      const node = this.add.circle(x, y, radius, color).setStrokeStyle(3, 0x000000);
      node.setInteractive({ useHandCursor: true });

      // Label
      this.add.text(x, y - radius - 20, step.title, {
        fontSize: '12px',
        color: '#000000',
        fontFamily: 'monospace'
      }).setOrigin(0.5);

      // Place Mario (Player) on the in_progress step
      if (step.status === "in_progress") {
        this.player = this.add.circle(x, y - 10, 10, 0x3b82f6); // Blue dot for Mario
        this.add.tween({
          targets: this.player,
          y: y - 20,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      // Interaction: Click a node to load the Bedrock-generated platformer level
      node.on('pointerdown', () => {
         if (step.status !== "not_started") {
             console.log(`Entering level ${step.id}. Calling Bedrock...`);
             
             // Update this line to pass the roadmap too
             this.scene.start('PlatformerScene', { 
               step: step,
               roadmap: this.roadmap 
             });
         }
      });
    });
  }
}