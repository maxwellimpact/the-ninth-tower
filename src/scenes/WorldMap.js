// Full-screen world map: the explored minimap scaled up, with markers and a
// legend. Opened by tapping the minimap (or N); tap anywhere to close. The
// campfires you've rested at carry their names; opened by the Ferryman
// (travel), those names are buttons that send the party there.
import Phaser from 'phaser';
import { MARK, panel } from './UI.js';
import { OW_H } from '../world/map.js';
import { MAP } from '../world/content.js';

const LEGEND = [['chest', 'CHEST'], ['camp', 'CAMPFIRE'], ['recruit', 'ALLY'], ['door', 'DOOR'], ['post', 'GRAPPLE'], ['boss', 'WARD STONE'], ['npc', 'FOLK'], ['node', 'GATHER']];

export class WorldMap extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  create({ game, travel = null }) {
    this.g = game;
    this.travel = travel;
    const W = this.scale.width, H = this.scale.height;
    const portrait = H > W;
    const legendH = portrait ? 48 : 34; // two legend rows, then TAP TO CLOSE
    const a = { ...game.areaRect() };
    if (!a.interior) a.y1 = Math.min(a.y1, OW_H - 1); // the unexplorable highlands (Wave 3) stay off the map
    const aw = a.x1 - a.x0 + 1, ah = a.y1 - a.y0 + 1;
    // whole pixels when it fits; on a short landscape phone the overworld (208 tiles tall) has to shrink to fit
    const fit = Math.min((W - 12) / aw, (H - 30 - legendH) / ah);
    const s = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    const mw = aw * s, mh = ah * s;
    const mx = Math.round((W - mw) / 2), my = Math.round(18 + (H - 18 - legendH - mh) / 2);
    const g = this.add.graphics();
    g.fillStyle(0x16121f, 0.95).fillRect(-2, -2, W + 4, H + 4);
    panel(g, mx - 2, my - 2, mw + 4, mh + 4, 0x2b2140, 0x6e6a87);
    game.minimap.syncBig(); // (the full map's texture is only brought up to date when it's shown)
    this.add.image(mx - a.x0 * s, my - a.y0 * s, 'minimap').setOrigin(0).setScale(s).setCrop(a.x0, a.y0, aw, ah);
    const title = travel ? 'WHERE TO? TAP A FIRE' : a.interior ? (game.region || '').toUpperCase() : `MAP OF ${MAP?.name || 'ALDERMERE'}`;
    this.add.bitmapText(W / 2, 8, 'fontGold', title === 'CAVE' ? 'DROWNED HOLLOW' : title).setOrigin(0.5, 0);
    this.mk = this.add.graphics();
    this.m = { mx: mx - a.x0 * s, my: my - a.y0 * s, s };
    // legend
    const items = LEGEND;
    const perRow = portrait ? 3 : 4;
    items.forEach(([k, label], i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const lx = portrait ? 8 + col * Math.floor((W - 16) / 3) : Math.round(W / 2 - 120 + col * 60);
      const ly = my + mh + 8 + row * 10;
      g.fillStyle(MARK[k]).fillRect(lx, ly + 1, 4, 4);
      this.add.bitmapText(lx + 7, ly, 'fontPlain', label);
    });
    if (!a.interior) this.fireLabels(game, mx - a.x0 * s, my - a.y0 * s, s, W, H, mx, mx + mw, my + mh + 2);
    this.add.bitmapText(W / 2, H - 9, 'fontPlain', travel ? 'TAP A NAME TO GO - ANYWHERE ELSE TO CLOSE' : 'TAP TO CLOSE').setOrigin(0.5).setAlpha(0.7);
    this.input.on('pointerdown', (p, over) => { if (!over.some((o) => o.fire)) this.close(); });
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-N', () => this.close());
  }

  close() { this.scene.stop(); this.g.closeMap(); }

  // The names of the fires you've rested at, in a column either side of the map
  // (whichever side the fire is on), each joined to its dot by a thin line: the
  // overworld is a narrow strip on a phone, so names beside the dots would pile up.
  fireLabels(game, ox, oy, s, W, H, mapL, mapR, mapB) {
    const here = this.travel?.here;
    const fires = game.restedFires().map((c) => ({ c, fx: ox + (c.x + 0.5) * s, fy: oy + (c.y + 0.5) * s }));
    const lines = this.add.graphics().setDepth(1);
    for (const side of [-1, 1]) {
      const list = fires.filter((f) => (f.fx < (mapL + mapR) / 2 ? -1 : 1) === side).sort((a, b) => a.fy - b.fy);
      const items = list.map((f) => {
        const isHere = f.c === here, go = this.travel && !isHere;
        const t = this.add.bitmapText(0, 0, go ? 'fontGold' : 'fontPlain', isHere ? `${f.c.name} (HERE)` : f.c.name).setDepth(3);
        return { ...f, t, go, w: t.width + 4, h: t.height + 4 };
      });
      // stack top to bottom from each dot's height, never overlapping; then pull back up if it runs off the bottom
      let y = 16;
      for (const it of items) { it.y = Math.max(y, it.fy - it.h / 2); y = it.y + it.h + 2; }
      let bottom = mapB; // clear of the legend under the map
      for (const it of [...items].reverse()) { if (it.y + it.h > bottom) it.y = bottom - it.h; bottom = it.y - 2; }
      for (const it of items) {
        const x = Phaser.Math.Clamp(side < 0 ? mapL - 8 - it.w : mapR + 8, 2, W - 2 - it.w);
        const bg = this.add.graphics().setDepth(2);
        bg.fillStyle(0x16121f, 0.9).fillRect(x, it.y, it.w, it.h);
        bg.lineStyle(1, it.go ? 0xf2c14e : 0x6e6a87, it.go ? 0.9 : 0.7).strokeRect(x + 0.5, it.y + 0.5, it.w - 1, it.h - 1);
        it.t.setPosition(Math.round(x + 2), Math.round(it.y + 2));
        const ex = side < 0 ? x + it.w : x, ey = it.y + it.h / 2;
        lines.lineStyle(1, it.go ? 0xf2c14e : 0x9d93b3, 0.55).lineBetween(ex, ey, it.fx, it.fy);
        lines.fillStyle(it.go ? 0xf2c14e : 0xd8d3e0).fillRect(Math.round(it.fx) - 1, Math.round(it.fy) - 1, 3, 3);
        if (it.go) {
          const z = this.add.zone(x - 2, it.y - 2, it.w + 4, it.h + 4).setOrigin(0).setDepth(4).setInteractive({ useHandCursor: true });
          z.fire = it.c;
          z.on('pointerdown', () => { const pick = this.travel.pick; this.close(); pick(it.c); });
        }
      }
    }
  }

  update(time) {
    const { mx, my, s } = this.m;
    const g = this.mk.clear();
    const sz = Math.max(2, Math.round(s * 2));
    for (const m of this.g.mapMarkers()) g.fillStyle(MARK[m.kind]).fillRect(mx + m.x * s - sz / 2, my + m.y * s - sz / 2, sz, sz);
    for (const p of this.g.party) if (p !== this.g.leader) g.fillStyle(0xd8d3e0).fillRect(mx + (p.x / 16) * s - 1, my + (p.y / 16) * s - 1, 2, 2);
    const L = this.g.leader;
    const lx = mx + (L.x / 16) * s, ly = my + (L.y / 16) * s;
    g.fillStyle(Math.floor(time / 300) % 2 ? 0xffffff : 0xfff0a0).fillRect(lx - 2, ly - 2, 5, 5);
    g.fillStyle(0x1a1423).fillRect(lx - 1, ly - 1, 3, 3);
    g.fillStyle(0xffffff).fillRect(lx, ly, 1, 1);
  }
}
