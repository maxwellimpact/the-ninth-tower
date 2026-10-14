// Dev-only: every item with a gear effect, worn by its hero, shown facing
// down / side / up with the live effect layer running. Snapshot it to tune.
import Phaser from 'phaser';
import items from '../data/items.json';
import heroes from '../data/heroes.json';
import { bakeHero } from '../game/bake.js';
import { GearFX } from '../game/gearfx.js';

export class FxLab extends Phaser.Scene {
  constructor() { super('FxLab'); }

  create({ scale = 2 } = {}) {
    const ids = Object.entries(items).filter(([, it]) => it.fx).map(([id]) => id);
    const S = scale, cellW = 70 * S, cellH = 40 * S;
    const W = this.scale.width;
    const perRow = Math.max(1, Math.floor((W - 8) / cellW));
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x4a8a4a).setOrigin(0);
    this.fx = new GearFX(this, { scale: S, depth: 50, glowDepth: 9, fixed: true });
    this.units = [];
    ids.forEach((id, n) => {
      const it = items[id];
      const h = heroes.find((x) => x.id === it.hero);
      const equip = { ...h.equip, [it.slot]: id };
      const key = bakeHero(this, h.id, equip);
      const views = [['down', false], ['side', false], ['up', false]];
      const col = n % perRow, row = Math.floor(n / perRow);
      const x0 = 4 + col * cellW, y0 = 4 + row * (cellH + 10);
      this.add.rectangle(x0, y0, cellW - 4, cellH + 6, 0x3c6b44).setOrigin(0);
      this.add.bitmapText(x0 + 3, y0 + 3, 'font', it.name);
      views.forEach(([v], i) => {
        const x = x0 + 13 * S + i * 22 * S, y = y0 + 33 * S;
        const spr = this.add.sprite(x, y, key, `idle_${v}_0`).setOrigin(0.5, 0.75).setScale(S).setDepth(10);
        spr.play(`${key}_walk_${v}`);
        this.units.push({ x, y, view: v, flip: false, hs: { equip }, def: { id: `${h.id}`, _k: `${id}${v}` }, sprite: spr });
      });
    });
    // give each unit its own fx slot key
    for (const u of this.units) u.def = { id: u.def.id, slotKey: u.def._k };
  }

  update(time, delta) {
    for (const u of this.units) {
      // GearFX keys slots by hero id; use a per-cell id so cells don't share state
      const real = u.def.id;
      this.fx.update({ ...u, def: { id: real }, hs: u.hs, key: u.def.slotKey }, delta / 1000);
    }
  }
}
