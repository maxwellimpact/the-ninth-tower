// Hexling Whack: Bruno's tavern game. 30 seconds, 3x3 holes.
// Hexling +1, golden hexling +3, curse wisp -2. Prizes by score.
import Phaser from 'phaser';
import { TOTAL_FLIES } from './Game.js';
import { audio } from '../audio/synth.js';
import { addMats, addPotions } from '../game/state.js';
import { panel } from './UI.js';

const DURATION = 30;
const PRIZES = [
  { min: 40, gold: 80, potions: { elixir: 1 }, mats: { crystal: 1 }, fly: true, label: 'CHAMPION!' },
  { min: 28, gold: 40, potions: { potion: 1 }, mats: { gel: 2 }, label: 'GREAT WHACKING!' },
  { min: 16, gold: 20, label: 'NOT BAD!' },
  { min: -99, gold: 0, label: 'BETTER LUCK NEXT TIME.' },
];

export class Minigame extends Phaser.Scene {
  constructor() { super('Minigame'); }

  create({ game }) {
    this.g = game;
    this.start();
  }

  start() {
    this.children.removeAll(true);
    this.time.removeAllEvents();
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.96).fillRect(0, 0, W, H);
    // board
    const cell = Math.floor(Math.min((W - 24) / 3, (H - 70) / 3, 56));
    const bw = cell * 3, bx = Math.round((W - bw) / 2), by = Math.round(40 + (H - 60 - bw) / 2);
    panel(g, bx - 6, by - 6, bw + 12, bw + 12, 0x5a3a26, 0x8a5c38);
    this.add.bitmapText(W / 2, 8, 'fontGold', 'HEXLING WHACK').setOrigin(0.5, 0).setScale(2);
    this.scoreTxt = this.add.bitmapText(10, 26, 'font', 'SCORE 0');
    this.timeTxt = this.add.bitmapText(W - 10, 26, 'font', `${DURATION}`).setOrigin(1, 0);
    this.add.bitmapText(W / 2, H - 9, 'fontPlain', 'HEXLING +1   GOLDEN +3   WISP -2').setOrigin(0.5);
    this.holes = [];
    for (let i = 0; i < 9; i++) {
      const cx = bx + (i % 3) * cell + cell / 2, cy = by + Math.floor(i / 3) * cell + cell / 2;
      g.fillStyle(0x1a1423).fillEllipse(cx, cy + cell * 0.18, cell * 0.7, cell * 0.32);
      g.fillStyle(0x3a2a2e).fillEllipse(cx, cy + cell * 0.16, cell * 0.62, cell * 0.24);
      const sc = Math.max(1, Math.floor(cell / 28));
      const upY = cy + cell * 0.2, downY = upY + 30 * sc;
      const mask = this.make.graphics({ add: false }).fillRect(cx - cell / 2, cy - cell * 1.2, cell, cell * 1.4 + 2);
      const s = this.add.sprite(cx, downY, 'hexling', 'idle_0').setOrigin(0.5, 27 / 32).setScale(sc);
      s.setMask(mask.createGeometryMask());
      s.setVisible(false);
      const hole = { i, cx, cy, cell, s, up: false, kind: null, t: 0, upY, downY };
      const z = this.add.zone(cx - cell / 2, cy - cell / 2, cell, cell).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.whack(hole));
      this.holes.push(hole);
    }
    this.score = 0;
    this.left = DURATION;
    this.running = true;
    this.spawnT = 0.6;
    this.countdown = 3;
    this.cdTxt = this.add.bitmapText(W / 2, H / 2, 'fontGold', '3').setOrigin(0.5).setScale(4);
    audio.sfx('click');
  }

  pop(hole) {
    const r = Math.random();
    hole.kind = r < 0.12 ? 'gold' : r < 0.32 ? 'wisp' : 'hex';
    hole.up = true;
    hole.hit = false;
    const progress = 1 - this.left / DURATION;
    hole.t = 0.95 - progress * 0.4;
    const s = hole.s;
    s.setVisible(true).clearTint().setAlpha(1);
    if (hole.kind === 'wisp') { s.setTexture('sparkCurse').setScale(Math.max(2, Math.floor(hole.cell / 14))); }
    else { s.setTexture('hexling', 'idle_0').setScale(Math.max(1, Math.floor(hole.cell / 28))); s.play('hexling_idle'); if (hole.kind === 'gold') s.setTint(0xffd84a); }
    s.y = hole.downY;
    this.tweens.add({ targets: s, y: hole.kind === 'wisp' ? hole.upY - 4 : hole.upY, duration: 120, ease: 'Back.easeOut' });
  }

  hide(hole) {
    hole.up = false;
    this.tweens.add({ targets: hole.s, y: hole.downY, duration: 100, onComplete: () => hole.s.setVisible(false) });
  }

  whack(hole) {
    if (!this.running || this.countdown > 0) return;
    if (!hole.up || hole.hit) { audio.sfx('step', { surface: 'stone' }); return; }
    hole.hit = true;
    const pts = hole.kind === 'gold' ? 3 : hole.kind === 'wisp' ? -2 : 1;
    this.score = Math.max(0, this.score + pts);
    this.scoreTxt.setText(`SCORE ${this.score}`);
    const f = this.add.bitmapText(hole.cx, hole.cy - hole.cell * 0.3, pts > 0 ? 'fontGold' : 'font', pts > 0 ? `+${pts}` : `${pts}`).setOrigin(0.5).setScale(2);
    if (pts < 0) f.setTint(0xff6a6a);
    this.tweens.add({ targets: f, y: f.y - 14, alpha: 0, duration: 500, onComplete: () => f.destroy() });
    if (hole.kind === 'wisp') { audio.sfx('hurt'); this.cameras.main.shake(120, 0.01); }
    else if (hole.kind === 'gold') { audio.sfx('coin'); audio.sfx('squish'); }
    else audio.sfx('squish');
    hole.s.setTintFill(0xffffff);
    this.time.delayedCall(60, () => this.hide(hole));
  }

  update(time, delta) {
    const dt = delta / 1000;
    if (this.countdown > 0) {
      const prev = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== prev) { this.cdTxt.setText(now > 0 ? `${now}` : 'GO!'); audio.sfx(now > 0 ? 'click' : 'aggro'); }
      if (this.countdown <= 0) this.time.delayedCall(400, () => this.cdTxt?.setVisible(false));
      return;
    }
    if (!this.running) return;
    this.left -= dt;
    this.timeTxt.setText(`${Math.max(0, Math.ceil(this.left))}`);
    for (const h of this.holes) if (h.up && !h.hit) { h.t -= dt; if (h.t <= 0) this.hide(h); }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const progress = 1 - this.left / DURATION;
      this.spawnT = 0.75 - progress * 0.35;
      const free = this.holes.filter((h) => !h.up);
      const n = progress > 0.5 && Math.random() < 0.4 ? 2 : 1;
      for (let k = 0; k < n && free.length; k++) this.pop(free.splice(Math.floor(Math.random() * free.length), 1)[0]);
    }
    if (this.left <= 0) this.finish();
  }

  finish() {
    this.running = false;
    for (const h of this.holes) if (h.up) this.hide(h);
    const st = this.g.state;
    const prize = PRIZES.find((p) => this.score >= p.min);
    st.gold += prize.gold;
    addPotions(st, prize.potions || {});
    addMats(st, prize.mats || {});
    let fly = false;
    if (prize.fly && !st.flies.includes('whack')) { st.flies.push('whack'); fly = true; }
    audio.sfx(prize.gold ? 'chest' : 'enemyDie');
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    const w = Math.min(W - 20, 220), h = 104, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
    panel(g, x, y, w, h, 0x2b2140, 0xf2c14e);
    this.add.bitmapText(W / 2, y + 8, 'fontGold', `SCORE ${this.score}`).setOrigin(0.5, 0).setScale(2);
    this.add.bitmapText(W / 2, y + 26, 'font', prize.label).setOrigin(0.5, 0);
    const parts = [prize.gold ? `${prize.gold} GOLD` : null, prize.potions?.potion ? 'A HEALTH POTION' : null, prize.potions?.elixir ? 'AN ELIXIR' : null, fly ? 'A GOLDEN FLY!' : null].filter(Boolean);
    this.add.bitmapText(W / 2, y + 38, 'fontPlain', parts.length ? `PRIZE: ${parts.join(', ')}` : 'NO PRIZE. 16+ WINS GOLD, 40+ WINS THE BIG ONE.').setOrigin(0.5, 0).setMaxWidth(w - 12).setCenterAlign();
    const button = (bx, label, fn, enabled = true) => {
      panel(g, bx, y + h - 26, 80, 18, enabled ? 0x3a2f52 : 0x2b2140, enabled ? 0xf2c14e : 0x45405e);
      this.add.bitmapText(bx + 40, y + h - 21, enabled ? 'fontGold' : 'fontPlain', label).setOrigin(0.5, 0);
      if (enabled) this.add.zone(bx, y + h - 26, 80, 18).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    };
    const canPlay = st.gold >= 10;
    button(x + 10, 'AGAIN (10G)', () => { st.gold -= 10; this.start(); }, canPlay);
    button(x + w - 90, 'LEAVE', () => { audio.sfx('click'); this.scene.stop(); this.g.closeOverlay(); if (fly) this.g.events.emit('banner', `GOLDEN FLY!  ${st.flies.length} / ${TOTAL_FLIES}`, 'WON AT HEXLING WHACK'); });
  }
}
