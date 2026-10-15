// Full-screen loading curtain for big loads: entering the world from the
// title screen, and slow teleports. Sits above every other scene; the Game
// scene drives it (setProgress / done) while the world gets ready behind it.
import Phaser from 'phaser';

const TIPS = [
  'TAP AN ENEMY TO ATTACK. SWIPE TO DODGE.',
  'TAP A PORTRAIT TO TAKE CONTROL OF THAT HERO.',
  'YOUR COMPANIONS FIRE THEIR OWN ULTIMATES - OR TAP THEIR BUTTONS.',
  'FIRE BURNS, FROST SLOWS, VENOM POISONS. FIND WHAT EACH FOE FEARS.',
  'GOLDEN FLIES HIDE ALL OVER ALDERMERE. THE FROG KING WANTS THEM.',
  'BUBBLES MARK THINGS YOU CAN HARVEST. THEY GROW BACK.',
  'CRACKED ROCKS AND HOLLOW WALLS HIDE SECRETS.',
  'CAMPFIRES HEAL THE PARTY AND SAVE YOUR GAME.',
];

// Rotating status lines while the world gets ready (kept short for phones).
const QUIPS = [
  'PAINTING THE GRASS GREEN',
  'TEACHING TREES TO SWAY',
  'POLISHING THE ARMOUR',
  'SHARPENING SWORDS',
  'WAKING THE GOBLINS',
  'HIDING THE GOLDEN FLIES',
  'COUNTING THE GOLD',
  'FILLING THE LAKE',
  'STACKING BRICKS FOR THE RUINS',
  'TUNING THE BARD',
  'BREWING POTIONS',
  'SCATTERING MOONHERB',
  'PLANTING CRACKED WALLS',
  'BRIBING THE FROG KING',
  'DUSTING OFF THE TREASURE',
  'LIGHTING THE CAMPFIRES',
  'ARGUING WITH MALGRIM',
  'UNTANGLING THE HAWK',
  'WARMING UP THE HEXLINGS',
  'CURSING THE FEN (POLITELY)',
];

export class Loading extends Phaser.Scene {
  constructor() { super('Loading'); }

  create(data = {}) {
    this.scene.bringToTop();
    this.p = 0;
    this.shown = 0;
    this.closing = false;
    this.title = data.title || 'THE NINTH TOWER';
    this.label = data.label || 'PREPARING THE WORLD';
    this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.quips = Phaser.Utils.Array.Shuffle([...QUIPS]);
    this.quipI = 0;
    this.label = this.quips[0];
    this.quipT = 0;
    this.g = this.add.graphics();
    this.tTitle = this.add.bitmapText(0, 0, 'fontGold', '').setOrigin(0.5).setScale(2);
    this.tLabel = this.add.bitmapText(0, 0, 'fontPlain', '').setOrigin(0.5);
    this.tTip = this.add.bitmapText(0, 0, 'fontPlain', '').setOrigin(0.5).setTint(0x9d93b3).setCenterAlign();
    this.root = [this.g, this.tTitle, this.tLabel, this.tTip];
    this.scale.on('resize', this.draw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.draw, this));
    this.draw();
  }

  // the stage label is ignored: the status line rotates through quips instead
  setProgress(p) {
    this.p = Math.max(this.p, Math.min(1, p));
  }

  setTitle(t) { this.title = t; }

  // Fill the bar, then fade the curtain away and stop.
  done(onGone) {
    if (this.closing) return;
    this.closing = true;
    this.p = 1;
    this.label = 'READY';
    this.time.delayedCall(240, () => {
      this.tweens.add({ targets: this.root, alpha: 0, duration: 260, onComplete: () => { onGone?.(); this.scene.stop(); } });
    });
  }

  update(time, delta) {
    // ease the drawn bar toward the real progress so it never jumps backward
    this.shown += (this.p - this.shown) * Math.min(1, delta / 90);
    this.quipT += delta;
    if (!this.closing && this.quipT > 2200) { this.quipT = 0; this.quipI = (this.quipI + 1) % this.quips.length; this.label = this.quips[this.quipI]; }
    this.dots = Math.floor(time / 350) % 4;
    this.draw();
  }

  draw() {
    const W = this.scale.width, H = this.scale.height, g = this.g;
    const p = this.shown;
    g.clear();
    g.fillStyle(0x16121f).fillRect(-8, -8, W + 16, H + 16);
    const bw = Math.min(180, W - 60), bx = Math.round((W - bw) / 2), by = Math.round(H / 2 + 8);
    // tower silhouette that fills from the bottom as the world loads
    const tx = Math.round(W / 2), base = by - 20;
    for (let y = 0; y < 30; y++) {
      const w = 2 + Math.floor(y / 6);
      g.fillStyle(y > 30 - p * 30 ? 0x6b3fa0 : 0x2b2140).fillRect(tx - w, base - 30 + y, w * 2, 1);
    }
    g.fillStyle(0xe7a6ff).fillRect(tx - 1, base - 33, 2, 2);
    g.fillStyle(0x1a1423).fillRect(bx - 2, by - 2, bw + 4, 10);
    g.fillStyle(0x45405e).fillRect(bx - 1, by - 1, bw + 2, 8);
    g.fillStyle(0x2b2140).fillRect(bx, by, bw, 6);
    g.fillStyle(0xf2c14e).fillRect(bx, by, Math.round(bw * p), 6);
    g.fillStyle(0xfff0a0).fillRect(bx, by, Math.round(bw * p), 1);
    this.tTitle.setText(this.title).setPosition(W / 2, base - 52);
    if (this.tTitle.width > W - 16) this.tTitle.setScale(1); else this.tTitle.setScale(2);
    this.tLabel.setText(this.closing ? this.label : this.label + '.'.repeat(this.dots || 0)).setPosition(W / 2, by + 18);
    this.tTip.setText(this.tip).setMaxWidth(W - 32).setPosition(W / 2, Math.min(H - 24, by + 46));
  }
}
