import Phaser from "phaser";
import { generateLevelWithBedrock } from "../components/LevelGen";

export class PlatformerScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private stepData: any;
  private roadmap: any;
  private isLoading: boolean = true;
  private isTransitioning: boolean = false;

  constructor() {
    super({ key: "PlatformerScene" });
  }

  init(data: { step: any; roadmap: any }) {
    this.stepData = data.step;
    this.roadmap = data.roadmap;
  }

  async create() {
    this.isLoading = true;
    this.isTransitioning = false;

    // 1. Initial Background Color
    this.cameras.main.setBackgroundColor(this.stepData?.is_risk ? "#3f0000" : "#87CEEB");

    // 2. Add UI text
    this.add.text(16, 16, `Level: ${this.stepData?.title || 'Unknown'}`, {
      fontSize: "18px", color: "#ffffff", fontStyle: "bold"
    }).setScrollFactor(0); 

    this.add.text(16, 40, "Use ARROWS to move. Press ESC to return to map.", {
      fontSize: "14px", color: "#ffffff"
    }).setScrollFactor(0); 

    // 3. Setup input early so ESC works while loading
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-ESC', () => {
        // Clean up the listener so it doesn't duplicate on restart
        this.input.keyboard?.removeAllListeners('keydown-ESC');
        this.scene.start('WorldMapScene', { roadmap: this.roadmap }); 
      });
    }

    // 4. Show Loading State
    const loadingText = this.add.text(400, 300, "Asking AI to build level...", {
      fontSize: "24px", color: "#ffffff", fontFamily: "monospace"
    }).setOrigin(0.5).setScrollFactor(0);

    // 5. THE API CALL (Replaces the hardcoded rawLayout)
    const levelData = await generateLevelWithBedrock(
      this.stepData?.difficulty || "easy",
      this.stepData?.is_risk || false,
      this.stepData?.domain || "general"
    );

    // Remove loading text once the data arrives
    loadingText.destroy();
    
    // 6. Dynamic World Sizing Math
    const blockSize = 40;
    const startY = 200; 
    
    const levelWidthInPixels = levelData.layout[0].length * blockSize;
    
    this.physics.world.setBounds(0, 0, levelWidthInPixels, 600);
    this.cameras.main.setBounds(0, 0, levelWidthInPixels, 600);

    const platforms = this.physics.add.staticGroup();
    const hazards = this.physics.add.staticGroup();
    const objectives = this.physics.add.staticGroup();

    // 7. Parse the AI-generated 2D Array
    for (let y = 0; y < levelData.layout.length; y++) {
      for (let x = 0; x < levelData.layout[y].length; x++) {
        const tile = levelData.layout[y][x];
        const worldX = (x * blockSize) + (blockSize / 2);
        const worldY = startY + (y * blockSize) + (blockSize / 2);

        if (tile === "P") {
          platforms.add(this.add.rectangle(worldX, worldY, blockSize, blockSize, 0x228b22));
        } else if (tile === "H") {
          hazards.add(this.add.rectangle(worldX, worldY, blockSize, blockSize, 0xff6600));
        } else if (tile === "O") {
          objectives.add(this.add.rectangle(worldX, worldY, blockSize, blockSize, 0xffff00));
        }
      }
    }

    // 8. Create the player
    const playerRect = this.add.rectangle(100, 450, 32, 48, 0xff0000);
    this.player = this.physics.add.existing(playerRect) as any;
    
    this.player.body.setGravityY(800); 
    this.player.body.setCollideWorldBounds(true);

    // 9. Make the camera follow the player smoothly
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // 10. Setup Collisions
    this.physics.add.collider(this.player, platforms);

    this.physics.add.overlap(this.player, hazards, () => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      this.physics.pause(); // Freeze physics immediately

      this.cameras.main.shake(200, 0.01); 
      
      // Delay the restart slightly so you actually see the screen shake
      this.time.delayedCall(250, () => {
        // MUST pass the roadmap back in so it isn't lost on death
        this.scene.restart({ step: this.stepData, roadmap: this.roadmap });
      });
    });

    this.physics.add.overlap(this.player, objectives, () => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      this.physics.pause(); // Freeze physics immediately

      const currentIndex = this.roadmap.steps.findIndex((s: any) => s.id === this.stepData.id);
      
      if (currentIndex !== -1) {
        this.roadmap.steps[currentIndex].status = "done";
        if (currentIndex + 1 < this.roadmap.steps.length) {
          this.roadmap.steps[currentIndex + 1].status = "in_progress";
        }
      }

      this.scene.start('WorldMapScene', { roadmap: this.roadmap }); 
    });

    this.isLoading = false;
  }

  update() {
    // 4. Also block inputs if we are mid-transition
    if (this.isLoading || this.isTransitioning || !this.cursors || !this.player) return;

    if (this.cursors.left.isDown) {
      this.player.body.setVelocityX(-260);
    } else if (this.cursors.right.isDown) {
      this.player.body.setVelocityX(260);
    } else {
      this.player.body.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.touching.down) {
      this.player.body.setVelocityY(-500);
    }
  }
}