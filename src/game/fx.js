// Visual effects. Everything is small, punchy and pixel-snapped.
import Phaser from 'phaser';

const TOP = 100000; // depth for fx that float above everything in the world

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.emit = {};
    const mk = (tex, cfg) => scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(TOP - 10);
    this.emit.spark = mk('px_white', { speed: { min: 40, max: 110 }, lifespan: 220, scale: 1, gravityY: 120 });
    this.emit.ember = mk('px_fireL', { speed: { min: 30, max: 90 }, lifespan: { min: 200, max: 450 }, gravityY: -40, tint: [0xffd04a, 0xff7b2e, 0xffffff] });
    this.emit.curse = mk('px_curseL', { speed: { min: 20, max: 70 }, lifespan: { min: 300, max: 700 }, gravityY: -30 });
    this.emit.heal = mk('px_grassXL', { speedY: { min: -40, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 600, x: { min: -8, max: 8 }, alpha: { start: 1, end: 0 } });
    this.emit.gold = mk('px_goldL', { speed: { min: 30, max: 100 }, lifespan: 500, gravityY: 80 });
    this.emit.bloom = mk('px_grassXL', { speed: { min: 10, max: 40 }, lifespan: { min: 400, max: 900 }, gravityY: -25, tint: [0xa6d36a, 0xf6f2ea, 0xf2c14e, 0x6f93e0] });
    this.emit.foam = mk('px_foam', { speed: { min: 10, max: 30 }, lifespan: 300 });
    this.emit.motes = mk('px_curseL', { speedY: { min: -14, max: -6 }, speedX: { min: -4, max: 4 }, lifespan: { min: 1400, max: 2400 }, alpha: { start: 0.9, end: 0 } });
  }

  burst(name, x, y, n) { this.emit[name].explode(n, x, y); }

  setTimeScale(t) { if (this.ts === t) return; this.ts = t; for (const e of Object.values(this.emit)) e.timeScale = t; }

  dust(x, y) {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y) - 2, 'dust').setDepth(y - 1).setAlpha(0.8);
    s.play('dust'); s.once('animationcomplete', () => s.destroy());
  }

  hit(x, y, crit) {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y), 'hitstar').setDepth(TOP).setScale(crit ? 1.4 : 1);
    s.play('hitstar'); s.once('animationcomplete', () => s.destroy());
    this.burst('spark', x, y, crit ? 10 : 5);
  }

  // Afterimage for dodges.
  ghost(u) {
    const g = this.scene.add.sprite(u.sprite.x, u.sprite.y, u.sprite.texture.key, u.sprite.frame.name)
      .setOrigin(0.5, 0.75).setFlipX(u.flip).setDepth(u.y - 1).setTintFill(0x8fb6ff).setAlpha(0.55);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  puff(x, y, tex = 'spark') {
    const dot = tex === 'sparkCurse' ? 'px2_curseL' : 'px2_mist';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = this.scene.add.image(x + Math.cos(a) * 5, y - 8 + Math.sin(a) * 4, dot).setDepth(TOP - 5);
      this.scene.tweens.add({ targets: p, x: x + Math.cos(a) * 14, y: y - 8 + Math.sin(a) * 9, alpha: 0, duration: 280, onComplete: () => p.destroy() });
    }
    const s = this.scene.add.image(x, y - 8, tex).setDepth(TOP - 5).setScale(2);
    this.scene.tweens.add({ targets: s, scale: 0, duration: 200, onComplete: () => s.destroy() });
  }

  ring(x, y, tex, scale = 4) {
    const r = this.scene.add.image(x, y, tex).setDepth(-3).setScale(0.5);
    this.scene.tweens.add({ targets: r, scale, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  heal(x, y) { this.burst('heal', x, y - 10, 10); }

  alert(u) {
    const t = this.scene.add.bitmapText(Math.round(u.x), Math.round(u.y) - 26, 'fontGold', '!').setOrigin(0.5).setDepth(TOP);
    this.scene.tweens.add({ targets: t, y: t.y - 6, duration: 160, yoyo: true, hold: 220, onComplete: () => t.destroy() });
  }

  // Ground telegraph that fills as the windup completes.
  telegraph(x, y, r, dur) {
    const g = this.scene.add.graphics().setDepth(-3);
    const state = { p: 0 };
    const draw = () => {
      g.clear();
      g.fillStyle(0xc0394b, 0.18 + state.p * 0.22);
      g.fillEllipse(x, y, r * 2 * state.p, r * 1.3 * state.p);
      g.lineStyle(1, 0xec6a5e, 0.9);
      g.strokeEllipse(x, y, r * 2, r * 1.3);
    };
    draw();
    this.scene.tweens.add({ targets: state, p: 1, duration: dur * 1000, onUpdate: draw });
    return g;
  }

  slam(x, y, r) {
    this.ring(x, y, 'ringRed', r / 8 * 1.2);
    this.burst('curse', x, y, 8);
    this.scene.shake(60, 0.003);
  }

  coinBurst(x, y) { this.burst('gold', x, y - 6, 8); }
}
