// The Archery Butts: Brightwater's range, opened once fifteen townsfolk are
// home (Fletcher Wynn keeps it). Five arrows: the sight sweeps side to side -
// tap to fix it - then up and down - tap to loose. Rings score 10 / 8 / 6 / 4 / 2.
// Prizes by total; the first perfect round also wins Wynn's thumb ring.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import { panel } from './UI.js';
import { gainItems } from '../game/state.js';

export const ARCHERY_FEE = 15;
const ARROWS = 5;
const RINGS = [[6, 10, 0xf2c14e], [12, 8, 0xec6a5e], [18, 6, 0x4e9ad0], [24, 4, 0x2b2140], [30, 2, 0xd8d3e0]]; // radius, score, colour (drawn outermost first)
const PRIZES = [[30, 40], [40, 90], [46, 160]]; // [score at least, gold]

export class Archery extends Phaser.Scene {
  constructor() { super('Archery'); }

  create({ game }) {
    this.g = game;
    this.start();
  }

  clear() { this.children.removeAll(true); this.time.removeAllEvents(); this.tweens.killAll(); this.input.removeAllListeners(); this.input.keyboard?.removeAllListeners(); }

  btn(x, y, w, label, fn, hot = true) {
    const g = this.add.graphics().setDepth(12);
    panel(g, x, y, w, 18, hot ? 0x3a2f52 : 0x2b2140, hot ? 0xf2c14e : 0x45405e);
    this.add.bitmapText(x + w / 2, y + 5, hot ? 'fontGold' : 'fontPlain', label).setOrigin(0.5, 0).setDepth(13);
    this.add.zone(x, y, w, 18).setDepth(14).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); fn(); });
  }

  leave() { audio.sfx('click'); this.scene.stop(); this.g.closeOverlay(); }

  // ---- one round
  start() {
    this.clear();
    const W = this.scale.width, H = this.scale.height;
    this.cx = Math.round(W / 2); this.cy = Math.round(H / 2 + 8);
    this.score = 0; this.shot = 0; this.hits = []; this.phase = 'x'; this.t = 0;
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.97).fillRect(-2, -2, W + 4, H + 4);
    // the butt: a straw boss on a stand, the painted face on it
    g.fillStyle(0x8a5c38).fillRect(this.cx - 3, this.cy + 30, 6, 28).fillRect(this.cx - 26, this.cy + 52, 52, 4);
    g.fillStyle(0xc99a66).fillCircle(this.cx, this.cy, 36).fillStyle(0xa7744a).fillCircle(this.cx, this.cy, 34);
    for (const [r, , c] of RINGS.slice().reverse()) g.fillStyle(c).fillCircle(this.cx, this.cy, r).lineStyle(1, 0x1a1423, 0.6).strokeCircle(this.cx, this.cy, r);
    this.add.bitmapText(W / 2, 8, 'fontGold', 'THE ARCHERY BUTTS').setOrigin(0.5, 0).setScale(2);
    this.info = this.add.bitmapText(W / 2, 28, 'font', '').setOrigin(0.5, 0);
    this.hint = this.add.bitmapText(W / 2, H - 16, 'fontPlain', 'TAP TO FIX THE SIGHT SIDE TO SIDE, THEN TAP TO LOOSE').setOrigin(0.5, 0).setTint(0x9d93b3);
    this.marks = this.add.graphics().setDepth(5);
    this.sight = this.add.graphics().setDepth(6);
    this.input.on('pointerdown', () => this.tap());
    this.input.keyboard?.on('keydown-SPACE', () => this.tap());
    this.updateInfo();
  }

  updateInfo() { this.info.setText(`ARROW ${Math.min(this.shot + 1, ARROWS)} OF ${ARROWS}    SCORE ${this.score}`); }

  update(time, delta) {
    if (!this.sight || this.phase === 'done' || this.phase === 'flying') return;
    this.t += delta / 1000;
    const speed = 2.3 + this.shot * 0.35; // each arrow a little quicker
    if (this.phase === 'x') { this.sx = this.cx + Math.sin(this.t * speed) * 40; this.sy = this.cy; }
    else this.sy = this.cy + Math.sin(this.t * speed * 1.15) * 40;
    const s = this.sight.clear().lineStyle(1, 0xffffff, 1);
    if (this.phase === 'x') s.lineBetween(this.sx, this.cy - 44, this.sx, this.cy + 44);
    else s.lineBetween(this.sx - 44, this.sy, this.sx + 44, this.sy).lineBetween(this.sx, this.sy - 4, this.sx, this.sy + 4);
    s.strokeCircle(this.sx, this.sy, 3);
  }

  tap() {
    if (this.phase === 'x') { this.phase = 'y'; this.t = 0; audio.sfx('click'); return; }
    if (this.phase !== 'y') return;
    this.phase = 'flying';
    audio.sfx('swing');
    const x = this.sx + (Math.random() - 0.5) * 2, y = this.sy + (Math.random() - 0.5) * 2; // a breath of wind
    const d = Math.hypot(x - this.cx, y - this.cy);
    const ring = RINGS.find(([r]) => d <= r);
    const pts = ring ? ring[1] : 0;
    this.time.delayedCall(220, () => {
      audio.sfx(pts >= 8 ? 'crit' : pts ? 'hit' : 'block');
      this.marks.fillStyle(0x1a1423).fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3).fillStyle(0xd8d3e0).fillRect(Math.round(x), Math.round(y), 1, 1);
      this.marks.lineStyle(1, 0x5a3a26, 1).lineBetween(x, y, x + 5, y + 6); // the shaft, sticking out
      const t = this.add.bitmapText(x, y - 10, pts >= 8 ? 'fontGold' : 'font', pts ? `${pts}` : 'MISS').setOrigin(0.5).setDepth(7);
      this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 900, onComplete: () => t.destroy() });
      this.score += pts; this.shot++; this.updateInfo();
      if (this.shot >= ARROWS) { this.phase = 'done'; this.sight.clear(); this.time.delayedCall(700, () => this.results()); }
      else { this.phase = 'x'; this.t = Math.random() * 6; }
    });
  }

  // ---- what the round won
  results() {
    const st = this.g.state, W = this.scale.width, H = this.scale.height;
    const gold = PRIZES.filter(([n]) => this.score >= n).map(([, gp]) => gp).pop() || 0;
    const perfect = this.score >= ARROWS * 10;
    let ring = false;
    st.gold += gold;
    if (perfect && !this.g.flags.fletcherRing) { this.g.flags.fletcherRing = true; gainItems(st, ['fletchers_thumb_ring']); ring = true; }
    st.archeryBest = Math.max(st.archeryBest || 0, this.score);
    this.input.removeAllListeners();
    // beside the target, so the arrows you put in it stay in view
    this.hint.setVisible(false);
    const pw = 150, px0 = Math.min(W - pw - 4, this.cx + 44), pcx = px0 + pw / 2, py = this.cy - 40;
    const g = this.add.graphics().setDepth(10);
    panel(g, px0, py, pw, 88, 0x2b2140, 0xf2c14e);
    const line = (y, s, f = 'font') => this.add.bitmapText(pcx, y, f, s).setOrigin(0.5, 0).setDepth(11).setMaxWidth(pw - 8);
    line(py + 6, `SCORE ${this.score} / ${ARROWS * 10}`, 'fontGold');
    line(py + 17, perfect ? 'FIVE GOLDS!' : this.score >= 40 ? 'A FINE ROUND.' : this.score >= 30 ? 'NOT BAD AT ALL.' : 'THE STRAW IS SAFE.');
    line(py + 27, gold ? `+${gold} GOLD` : `BEST SO FAR: ${st.archeryBest}`, 'fontPlain');
    if (ring) line(py + 36, "+ WYNN'S THUMB RING", 'fontGold');
    line(py + 46, '30/40/46+ PAYS 40/90/160G', 'fontPlain').setTint(0x9d93b3);
    audio.sfx(gold ? 'coin' : 'click');
    if (ring) { audio.sfx('chest'); this.g.events.emit('loot', { ids: ['fletchers_thumb_ring'] }); }
    this.g.events.emit('party');
    const can = st.gold >= ARCHERY_FEE;
    this.btn(px0 + 4, py + 62, 76, `AGAIN ${ARCHERY_FEE}G`, () => { if (!can) { audio.sfx('click'); return; } st.gold -= ARCHERY_FEE; audio.sfx('coin'); this.start(); }, can);
    this.btn(px0 + 84, py + 62, 62, 'LEAVE', () => this.leave());
  }
}
