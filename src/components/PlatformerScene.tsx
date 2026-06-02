import Phaser from "phaser";
import { generateLevelWithBedrock } from "../components/LevelGen";

export class PlatformerScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private stepData: any;
  private roadmap: any;
  private isLoading: boolean = true;
  private isTransitioning: boolean = false;

  private cachedLevelData: any = null;

  constructor() {
    super({ key: "PlatformerScene" });
  }

  init(data: { step: any, roadmap: any, cachedLevelData?: any }) {
    this.stepData = data.step;
    this.roadmap = data.roadmap;
    this.cachedLevelData = data.cachedLevelData || null;
  }

  preload() {
    const g = this.make.graphics({ x: 0, y: 0 });
    
    // Fake Player Sprite
    g.fillStyle(0xff0000); g.fillRect(0, 0, 32, 48); 
    g.generateTexture('player', 32, 48); g.clear();
    
    // Fake Ground Block
    g.fillStyle(0x228b22); g.fillRect(0, 0, 40, 40); 
    g.generateTexture('ground', 40, 40); g.clear();
    
    // Fake Bowser/Hazard Sprite
    g.fillStyle(0xff6600); g.fillRect(0, 0, 40, 40); 
    g.generateTexture('hazard', 40, 40); g.clear();
    
    // Fake Castle/Objective Sprite
    g.fillStyle(0xffff00); g.fillRect(0, 0, 40, 40); 
    g.generateTexture('objective', 40, 40); g.clear();
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

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-ESC', () => {
        this.input.keyboard?.removeAllListeners('keydown-ESC');
        this.scene.start('WorldMapScene', { roadmap: this.roadmap }); 
      });
    }

    let levelData;

    // 3. Skip the API call if we already have the level data
    if (this.cachedLevelData) {
      levelData = this.cachedLevelData;
    } else {
      const loadingText = this.add.text(400, 300, "Asking AI to build level...", {
        fontSize: "24px", color: "#ffffff", fontFamily: "monospace"
      }).setOrigin(0.5).setScrollFactor(0);

      levelData = await generateLevelWithBedrock(
        this.stepData?.difficulty || "easy",
        this.stepData?.is_risk || false,
        this.stepData?.domain || "general"
      );

      loadingText.destroy();
      this.cachedLevelData = levelData; // Save it for next time
    }
    
    const blockSize = 40;
    const startY = 200; 
    const levelWidthInPixels = levelData.layout[0].length * blockSize;
    
    this.physics.world.setBounds(0, 0, levelWidthInPixels, 600);
    this.cameras.main.setBounds(0, 0, levelWidthInPixels, 600);

    const platforms = this.physics.add.staticGroup();
    const hazards = this.physics.add.staticGroup();
    const objectives = this.physics.add.staticGroup();

    for (let y = 0; y < levelData.layout.length; y++) {
      for (let x = 0; x < levelData.layout[y].length; x++) {
        const tile = levelData.layout[y][x];
        const worldX = (x * blockSize) + (blockSize / 2);
        const worldY = startY + (y * blockSize) + (blockSize / 2);

        if (tile === "P") {
          platforms.create(worldX, worldY, 'ground');
        } else if (tile === "H") {
          hazards.create(worldX, worldY, 'hazard');
        } else if (tile === "O") {
          objectives.create(worldX, worldY, 'objective');
        }
      }
    }

    this.player = this.physics.add.sprite(100, 450, 'player');
    this.player.setGravityY(800); 
    this.player.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.physics.add.collider(this.player, platforms);

    this.physics.add.overlap(this.player, hazards, () => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      
      this.physics.pause(); 
      this.player.setTint(0x555555); 
      this.cameras.main.shake(200, 0.01); 

      this.add.text(400, 300, "YOU DIED", {
        fontSize: "64px", color: "#ff0000", fontStyle: "bold", 
        stroke: "#000000", strokeThickness: 8
      }).setOrigin(0.5).setScrollFactor(0);
      
      this.time.delayedCall(2500, () => {
        // 4. Pass the cached data back into the scene restart!
        this.scene.restart({ 
          step: this.stepData, 
          roadmap: this.roadmap, 
          cachedLevelData: this.cachedLevelData // <-- The crucial handoff
        });
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