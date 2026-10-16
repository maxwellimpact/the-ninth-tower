// Frog Races: Mistfen's minigame, run by Ribbit Rosie at the fen camp.
// Bet on a frog, then make it hop by tapping when the swinging needle is in
// the sweet spot (a better tap = a longer hop). First win also earns a fly.
import Phaser from 'phaser';
import { TOTAL_FLIES } from './Game.js';
import { audio } from '../audio/synth.js';
import { panel } from './UI.js';

export const RACE_BET = 15;
const SWING = 4; // needle speed
const LANES = [
  { name: 'BOGWART', tint: 0x7ac26a }, { name: 'SIR HOPS', tint: 0x6f93e0 },
  { name: 'RUBY', tint: 0xec6a5e }, { name: 'GOLDIE', tint: 0xf2c14e },
];

export class FrogRace extends Phaser.Scene {
  constructor() { super('FrogRace'); }

  create({ game }) {
    this.g = game;
    this.pick();
  }

  clear() { this.children.removeAll(true); this.time.removeAllEvents(); this.tweens.killAll(); this.input.removeAllListeners(); }

  frogImg(x, y, tint) {
    const key = this.textures.exists('croaker') ? 'croaker' : 'frog';
    const frame = this.textures.get(key).has('idle_0') ? 'idle_0' : undefined;
    return this.add.image(x, y, key, frame).setOrigin(0.5, 1).setTint(tint);
  }

  // ---- choose a frog
  pick() {
    this.clear();
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.96).fillRect(0, 0, W, H);
    this.add.bitmapText(W / 2, 8, 'fontGold', 'FROG RACES').setOrigin(0.5, 0).setScale(2);
    this.add.bitmapText(W / 2, 28, 'font', `PICK YOUR FROG - ${RACE_BET} GOLD. WIN PAYS ${RACE_BET * 3}.`).setOrigin(0.5, 0);
    const cw = Math.min(70, Math.floor((W - 40) / 4)), x0 = Math.round((W - cw * 4 - 18) / 2), y = 46, ch = Math.min(70, H - 90);
    LANES.forEach((l, i) => {
      const x = x0 + i * (cw + 6);
      panel(g, x, y, cw, ch, 0x2b2140, l.tint);
      this.frogImg(x + cw / 2, y + ch - 16, l.tint).setScale(1.4);
      this.add.bitmapText(x + cw / 2, y + ch - 11, 'font', l.name).setOrigin(0.5, 0);
      this.add.zone(x, y, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.g.state.gold < RACE_BET) { audio.sfx('click'); return; }
        this.g.state.gold -= RACE_BET; audio.sfx('coin'); this.race(i);
      });
    });
    if (this.g.state.gold < RACE_BET) this.add.bitmapText(W / 2, y + ch + 8, 'fontPlain', 'YOU NEED MORE GOLD TO BET.').setOrigin(0.5, 0).setTint(0xff7a7a);
    this.leaveBtn(W / 2 - 40, H - 24);
  }

  leaveBtn(x, y, fly = false) {
    const g = this.add.graphics();
    panel(g, x, y, 80, 18, 0x3a2f52, 0xf2c14e);
    this.add.bitmapText(x + 40, y + 5, 'fontGold', 'LEAVE').setOrigin(0.5, 0);
    this.add.zone(x, y, 80, 18).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      audio.sfx('click'); this.scene.stop(); this.g.closeOverlay();
      if (fly) this.g.events.emit('banner', `GOLDEN FLY!  ${this.g.state.flies.length} / ${TOTAL_FLIES}`, 'WON AT THE FROG RACES');
    });
  }

  // ---- the race
  race(mine) {
    this.clear();
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.96).fillRect(0, 0, W, H);
    this.add.bitmapText(W / 2, 6, 'fontGold', 'FROG RACES').setOrigin(0.5, 0);
    const laneH = Math.min(28, Math.floor((H - 70) / 4)), top = 22, x0 = 24, x1 = W - 30;
    this.track = { x0, x1 };
    this.frogs = LANES.map((l, i) => {
      const y = top + i * laneH + laneH - 3;
      g.fillStyle(i % 2 ? 0x223a2a : 0x2a4630).fillRect(x0 - 10, top + i * laneH, x1 - x0 + 22, laneH);
      const s = this.frogImg(x0, y, l.tint);
      this.add.bitmapText(4, y - 9, i === mine ? 'fontGold' : 'fontPlain', `${i + 1}`);
      // AI frogs: each has its own pace
      return { i, s, x: x0, y, mine: i === mine, cd: 0.5 + Math.random() * 0.4, pace: 15 + Math.random() * 6 };
    });
    g.fillStyle(0xf6f2ea).fillRect(x1 + 8, top, 2, laneH * 4);
    for (let k = 0; k < 4 * laneH; k += 4) g.fillStyle(0x1a1423).fillRect(x1 + 8, top + k, 2, 2);
    // the power meter
    const my = top + laneH * 4 + 10, mw = Math.min(200, W - 40), mx = Math.round((W - mw) / 2);
    this.meter = { x: mx, y: my, w: mw, t: 0 };
    this.meterG = this.add.graphics();
    this.add.bitmapText(W / 2, my + 14, 'font', 'TAP WHEN THE NEEDLE IS IN THE GOLD!').setOrigin(0.5, 0);
    this.myCd = 0;
    this.running = false;
    const cd = this.add.bitmapText(W / 2, top + laneH * 2, 'fontGold', '3').setOrigin(0.5).setScale(3);
    [2, 1, 'GO!'].forEach((n, k) => this.time.delayedCall((k + 1) * 600, () => { cd.setText(`${n}`); audio.sfx('click'); }));
    this.time.delayedCall(2400, () => { cd.destroy(); this.running = true; audio.sfx('levelUp'); });
    this.input.on('pointerdown', () => this.tapHop());
    this.input.keyboard?.on('keydown-SPACE', () => this.tapHop());
  }

  quality() { return Math.max(0, 1 - Math.abs(Math.sin(this.meter.t * SWING))); } // 1 at the centre

  tapHop() {
    if (!this.running || this.myCd > 0) return;
    const f = this.frogs.find((k) => k.mine), q = this.quality();
    // a good tap is a long hop; a sloppy one is a stumble (so mashing doesn't win)
    const stumble = q < 0.35;
    this.myCd = stumble ? 0.7 : 0.45;
    this.hop(f, stumble ? 2 : 6 + 16 * q);
    const word = q > 0.92 ? 'PERFECT!' : stumble ? 'STUMBLE' : null;
    if (word) {
      if (!stumble) audio.sfx('coin');
      const t = this.add.bitmapText(f.x, f.y - 20, stumble ? 'fontPlain' : 'fontGold', word).setOrigin(0.5).setDepth(5);
      this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    }
  }

  hop(f, dist) {
    f.x = Math.min(this.track.x1 + 8, f.x + dist);
    const from = f.s.x;
    this.tweens.add({ targets: f.s, x: f.x, duration: 220 });
    this.tweens.add({ targets: f.s, y: f.y - 6, duration: 110, yoyo: true });
    if (f.mine) audio.sfx('blip');
    if (f.x >= this.track.x1 + 8 && this.running) this.finish(f);
    return from;
  }

  update(time, delta) {
    if (!this.meter) return;
    const dt = delta / 1000;
    this.meter.t += dt;
    const { x, y, w } = this.meter, g = this.meterG.clear();
    g.fillStyle(0x2b2140).fillRect(x, y, w, 8).fillStyle(0xf2c14e).fillRect(x + w / 2 - w * 0.08, y, w * 0.16, 8).fillStyle(0x8cff8c, 0.5).fillRect(x + w / 2 - w * 0.2, y, w * 0.4, 8);
    const nx = x + w / 2 + Math.sin(this.meter.t * SWING) * (w / 2 - 2);
    g.fillStyle(0xffffff).fillRect(Math.round(nx) - 1, y - 3, 2, 14);
    if (!this.running) return;
    this.myCd -= dt;
    for (const f of this.frogs) {
      if (f.mine) continue;
      f.cd -= dt;
      if (f.cd <= 0) { f.cd = 0.45 + Math.random() * 0.35; this.hop(f, f.pace * (0.45 + Math.random() * 0.35)); if (!this.running) return; }
    }
  }

  finish(winner) {
    this.running = false;
    const st = this.g.state, won = winner.mine;
    let fly = false;
    if (won) { st.gold += RACE_BET * 3; if (!st.flies.includes('race')) { st.flies.push('race'); fly = true; } }
    audio.sfx(won ? 'chest' : 'enemyDie');
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics().setDepth(10);
    const w = Math.min(W - 20, 220), h = 84, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
    panel(g, x, y, w, h, 0x2b2140, 0xf2c14e);
    this.add.bitmapText(W / 2, y + 8, 'fontGold', won ? 'YOUR FROG WINS!' : `${LANES[winner.i].name} WINS`).setOrigin(0.5, 0).setScale(won ? 2 : 1).setDepth(11);
    this.add.bitmapText(W / 2, y + 30, 'font', won ? `+${RACE_BET * 3} GOLD${fly ? ' AND A GOLDEN FLY!' : ''}` : 'BETTER LUCK NEXT TIME.').setOrigin(0.5, 0).setDepth(11);
    const again = this.add.graphics().setDepth(10);
    const can = st.gold >= RACE_BET;
    panel(again, x + 10, y + h - 26, 80, 18, can ? 0x3a2f52 : 0x2b2140, can ? 0xf2c14e : 0x45405e);
    this.add.bitmapText(x + 50, y + h - 21, can ? 'fontGold' : 'fontPlain', `AGAIN (${RACE_BET}G)`).setOrigin(0.5, 0).setDepth(11);
    this.time.delayedCall(400, () => {
      this.input.removeAllListeners();
      if (can) this.add.zone(x + 10, y + h - 26, 80, 18).setOrigin(0).setDepth(12).setInteractive({ useHandCursor: true }).on('pointerdown', () => { audio.sfx('click'); this.pick(); });
      this.leaveBtn(x + w - 90, y + h - 26, fly);
    });
  }
}
