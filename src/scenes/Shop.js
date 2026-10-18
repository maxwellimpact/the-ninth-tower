// Marla's shop: buy potions / materials / gear, sell spare gear + materials.
// Single-column list so it works in portrait and landscape alike.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import W from '../data/world.json';
import { CRAFT, sellPrice, itemName } from '../game/state.js';
import { panel, RARITY } from './UI.js';
import { itemTex } from '../game/itemtex.js';
import { shopGear, gearPrice, tierForLevel, registerItem } from '../game/itemgen.js';
import { statLine } from './Menu.js';
import { fitString } from './textfit.js';

const C = { ink: 0x1a1423, night: 0x2b2140, slate: 0x45405e, gold: 0xf2c14e, deep: 0x16121f };

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  create({ game }) {
    this.g = game;
    this.tab = 'buy';
    this.dyn = [];
    this.list = null; // the scrolling list (see Menu.region): its own camera over rows drawn off to the right
    this.scrollPos = { buy: 0, sell: 0 };
    // drag anywhere in the list to scroll it, like the other menus; a drag never counts as a tap
    this.input.on('pointerdown', (p) => {
      this.dragged = false;
      this.drag = this.inList(p) ? { y: p.y, from: this.list.cam.scrollY } : null;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || !this.drag) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 5) this.dragged = true;
      if (this.dragged) this.setScroll(this.drag.from - dy);
    });
    this.input.on('wheel', (p, o, dx, dy) => { if (this.inList(p)) this.setScroll(this.list.cam.scrollY + dy * 0.5); });
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.render();
  }

  inList(p) { const r = this.list; return r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; }

  setScroll(sy) {
    const r = this.list;
    r.cam.scrollY = Math.round(Math.max(r.min, Math.min(r.max, sy)));
    this.scrollPos[this.tab] = r.cam.scrollY - r.min;
    // scrollbar on the right edge, only when there's more than fits
    r.bar.clear();
    const span = r.max - r.min;
    if (span <= 0) return;
    const th = Math.max(12, Math.round(r.h * (r.h / (r.h + span))));
    const ty = r.y + Math.round((r.h - th) * ((r.cam.scrollY - r.min) / span));
    r.bar.fillStyle(C.slate, 0.8).fillRect(r.x + r.w + 2, r.y, 2, r.h).fillStyle(C.gold).fillRect(r.x + r.w + 2, ty, 2, th);
  }

  close() { audio.sfx('click'); this.scene.stop(); this.g.closeOverlay(); }

  t(x, y, str, font = 'font', tint, maxW = 0, maxLines = 1) {
    const o = this.add.bitmapText(Math.round(x), Math.round(y), font, maxW > 0 ? fitString(str, maxW, maxLines) : String(str).toUpperCase());
    if (tint !== undefined) o.setTint(tint);
    this.dyn.push(o);
    return o;
  }

  btn(x, y, w, h, fn) {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => { this.downZone = z; });
    z.on('pointerup', () => { if (this.downZone !== z || this.dragged) return; this.downZone = null; fn(); });
    this.dyn.push(z);
  }

  entries() {
    const st = this.g.state;
    if (this.tab === 'buy') {
      const out = W.shop.stock.map((s) => {
        const isPotion = !!CRAFT.consumables[s.id];
        const def = isPotion ? CRAFT.consumables[s.id] : CRAFT.materials[s.id];
        return { icon: `icon_${s.id}`, name: def.name, sub: isPotion ? def.desc : 'CRAFTING MATERIAL', price: s.price, col: 0xd8d3e0, act: () => { if (isPotion) st.potions[s.id] = (st.potions[s.id] || 0) + 1; else st.materials[s.id] = (st.materials[s.id] || 0) + 1; } };
      });
      // Marla stocks the current tier's Common gear for everyone in the party
      const lv = Math.round(this.g.party.reduce((a, h) => a + h.level, 0) / this.g.party.length);
      const tier = tierForLevel(lv);
      for (const id of shopGear(st, tier)) {
        const it = items[id];
        out.push({ icon: itemTex(this, id), name: it.name, sub: `${it.hero.toUpperCase()} ${it.slot.toUpperCase()} - ${statLine(it)}`, price: gearPrice(tier), col: RARITY.common.col,
          act: () => { const nid = id.replace('#shop', `#${Math.random().toString(36).slice(2, 7)}`); registerItem(nid); st.inventory.push(nid); } });
      }
      return out;
    }
    const out = [];
    for (const id of new Set(st.inventory)) {
      const it = items[id];
      out.push({ icon: itemTex(this, id), name: itemName(id), sub: `${RARITY[it.rarity].label} ${it.slot === 'trinket' ? 'RING' : it.slot.toUpperCase()} - ${it.hero ? it.hero.toUpperCase() : 'ANY'}`, price: sellPrice(id), col: RARITY[it.rarity].col, sell: true, act: () => { st.inventory.splice(st.inventory.indexOf(id), 1); delete st.refine[id]; if (st.sockets?.[id]) { for (const gm of st.sockets[id]) if (gm) st.gems[gm] = (st.gems[gm] || 0) + 1; delete st.sockets[id]; } } });
    }
    for (const [k, m] of Object.entries(CRAFT.materials)) {
      if (!st.materials[k]) continue;
      const shopPrice = W.shop.stock.find((s) => s.id === k)?.price || 10;
      out.push({ icon: `icon_${k}`, name: `${m.name} (x${st.materials[k]})`, sub: 'CRAFTING MATERIAL', price: Math.max(1, Math.floor(shopPrice * W.shop.sell.mat)), col: 0xd8d3e0, sell: true, act: () => { st.materials[k]--; } });
    }
    return out;
  }

  render() {
    if (this.list) { this.cameras.remove(this.list.cam); this.list = null; }
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const Wd = this.scale.width, H = this.scale.height;
    const st = this.g.state;
    const g = this.add.graphics();
    this.dyn.push(g);
    g.fillStyle(C.deep, 1).fillRect(-2, -2, Wd + 4, H + 4);
    this.t(8, 7, "MARLA'S GOODS", 'fontGold');
    panel(g, Wd - 26, 5, 18, 14, C.night, 0x6e6a87);
    this.t(Wd - 20, 9, 'X');
    this.btn(Wd - 34, 0, 34, 24, () => this.close());
    const gold = `${st.gold}G`;
    this.t(Wd - 32 - gold.length * 5, 9, gold, 'fontGold');
    ['buy', 'sell'].forEach((tb, i) => {
      const x = 8 + i * 42, sel = tb === this.tab;
      panel(g, x, 22, 38, 14, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      this.t(x + 19 - tb.length * 2.5, 26, tb.toUpperCase(), sel ? 'fontGold' : 'fontPlain');
      this.btn(x, 20, 38, 18, () => { audio.sfx('click'); this.tab = tb; this.render(); });
    });
    const list = this.entries();
    const rowH = 26, top = 44, x = 8, w = Wd - 20, h = H - top - 4;
    if (!list.length) { this.t(x, top + 4, this.tab === 'sell' ? 'NOTHING TO SELL. SPARE GEAR AND MATERIALS SHOW UP HERE.' : 'SOLD OUT!', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
    // every row, drawn off to the right (OX) and seen through the list's camera
    const OX = 5000, lg = this.add.graphics();
    this.dyn.push(lg);
    list.forEach((e, i) => {
      const y = top + i * rowH, rx = x + OX;
      const can = e.sell || st.gold >= e.price;
      panel(lg, rx, y, w, rowH - 3, C.night, can ? e.col : C.slate);
      lg.fillStyle(C.ink).fillRect(rx + 3, y + 3, 17, 17);
      this.dyn.push(this.add.image(rx + 3, y + 3, e.icon).setOrigin(0));
      this.t(rx + 23, y + 4, e.name, 'font', e.col, w - 23 - 48);
      this.t(rx + 23, y + 13, e.sub, 'fontPlain', undefined, w - 23 - 48);
      const label = `${e.sell ? '+' : ''}${e.price}G`;
      panel(lg, rx + w - 42, y + 5, 38, 13, can ? 0x2f5d3a : C.night, can ? 0x8cff8c : C.slate);
      this.t(rx + w - 23 - label.length * 2.5, y + 8, label, can ? 'fontGold' : 'fontPlain');
      this.btn(rx, y, w, rowH - 3, () => {
        if (e.sell) { st.gold += e.price; e.act(); audio.sfx('coin'); }
        else if (st.gold >= e.price) { st.gold -= e.price; e.act(); audio.sfx('coin'); audio.sfx('equip'); }
        else { audio.sfx('click'); return; }
        this.render();
      });
    });
    const bottom = top + list.length * rowH;
    const cam = this.cameras.add(x, top, w, h);
    cam.scrollX = OX + x;
    this.list = { x, y: top, w, h, cam, min: top, max: Math.max(top, bottom + 4 - h), bar: this.add.graphics().setDepth(100) };
    this.dyn.push(this.list.bar);
    this.setScroll(top + (this.scrollPos[this.tab] || 0));
  }
}
