// Full-screen world map: the explored minimap scaled up, with markers and a
// legend. Opened by tapping the minimap (or N); tap anywhere to close.
import Phaser from 'phaser';
import { MARK, panel } from './UI.js';
import { OW_H } from '../world/map.js';

const LEGEND = [['chest', 'CHEST'], ['camp', 'CAMPFIRE'], ['recruit', 'ALLY'], ['door', 'DOOR'], ['post', 'GRAPPLE'], ['boss', 'WARD STONE'], ['npc', 'FOLK'], ['node', 'GATHER']];

export class WorldMap extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  create({ game }) {
    this.g = game;
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
    g.fillStyle(0x16121f, 0.95).fillRect(0, 0, W, H);
    panel(g, mx - 2, my - 2, mw + 4, mh + 4, 0x2b2140, 0x6e6a87);
    this.add.image(mx - a.x0 * s, my - a.y0 * s, 'minimap').setOrigin(0).setScale(s).setCrop(a.x0, a.y0, aw, ah);
    const title = a.interior ? (game.region || '').toUpperCase() : 'MAP OF ALDERMERE';
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
    this.add.bitmapText(W / 2, H - 9, 'fontPlain', 'TAP TO CLOSE').setOrigin(0.5).setAlpha(0.7);
    this.input.on('pointerdown', () => this.close());
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-N', () => this.close());
  }

  close() { this.scene.stop(); this.g.closeMap(); }

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
