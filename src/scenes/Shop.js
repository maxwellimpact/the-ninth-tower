// Marla's shop: buy potions / materials / gear, sell spare gear + materials.
// Single-column list so it works in portrait and landscape alike.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import W from '../data/world.json';
import { CRAFT, sellPrice, itemName } from '../game/state.js';
import { panel, RARITY } from './UI.js';

const C = { ink: 0x1a1423, night: 0x2b2140, slate: 0x45405e, gold: 0xf2c14e, deep: 0x16121f };

export class Shop extends Phaser.Scene {
  constructor() { super('Shop'); }

  create({ game }) {
    this.g = game;
    this.tab = 'buy';
    this.scroll = 0;
    this.dyn = [];
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (p, o, dx, dy) => { this.scroll = Math.max(0, this.scroll + Math.sign(dy)); this.render(); });
    this.render();
  }

  close() { audio.sfx('click'); this.scene.stop(); this.g.closeOverlay(); }

  t(x, y, str, font = 'font', tint) {
    const o = this.add.bitmapText(Math.round(x), Math.round(y), font, String(str).toUpperCase());
    if (tint !== undefined) o.setTint(tint);
    this.dyn.push(o);
    return o;
  }

  btn(x, y, w, h, fn) {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', fn);
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
      const owned = new Set([...st.inventory, ...Object.values(st.heroes).flatMap((h) => Object.values(h.equip))]);
      for (const [id, it] of Object.entries(items)) {
        if (it.rarity !== 'fine' || owned.has(id) || !st.recruited.includes(it.hero)) continue;
        out.push({ icon: `item_${id}`, name: it.name, sub: `${it.hero.toUpperCase()} ${it.slot.toUpperCase()} - ${Object.entries(it.stats).map(([k, v]) => (k === 'crit' ? `+${Math.round(v * 100)}% CRIT` : `+${v} ${k.toUpperCase()}`)).join(' ')}`, price: W.shop.gearPrice.fine, col: RARITY.fine.col, once: true, act: () => st.inventory.push(id) });
      }
      return out;
    }
    const out = [];
    for (const id of new Set(st.inventory)) {
      const it = items[id];
      out.push({ icon: `item_${id}`, name: itemName(id), sub: `${RARITY[it.rarity].label} ${it.slot.toUpperCase()} - ${it.hero.toUpperCase()}`, price: sellPrice(id), col: RARITY[it.rarity].col, sell: true, act: () => { st.inventory.splice(st.inventory.indexOf(id), 1); delete st.refine[id]; } });
    }
    for (const [k, m] of Object.entries(CRAFT.materials)) {
      if (!st.materials[k]) continue;
      const shopPrice = W.shop.stock.find((s) => s.id === k)?.price || 10;
      out.push({ icon: `icon_${k}`, name: `${m.name} (x${st.materials[k]})`, sub: 'CRAFTING MATERIAL', price: Math.max(1, Math.floor(shopPrice * W.shop.sell.mat)), col: 0xd8d3e0, sell: true, act: () => { st.materials[k]--; } });
    }
    return out;
  }

  render() {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const Wd = this.scale.width, H = this.scale.height;
    const st = this.g.state;
    const g = this.add.graphics();
    this.dyn.push(g);
    g.fillStyle(C.deep, 0.95).fillRect(0, 0, Wd, H);
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
      this.btn(x, 20, 38, 18, () => { audio.sfx('click'); this.tab = tb; this.scroll = 0; this.render(); });
    });
    const list = this.entries();
    const rowH = 26, top = 44, x = 8, w = Wd - 16;
    const maxRows = Math.max(1, Math.floor((H - top - 14) / rowH));
    this.scroll = Math.min(this.scroll, Math.max(0, list.length - maxRows));
    list.slice(this.scroll, this.scroll + maxRows).forEach((e, i) => {
      const y = top + i * rowH;
      const can = e.sell || st.gold >= e.price;
      panel(g, x, y, w, rowH - 3, C.night, can ? e.col : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 3, 17, 17);
      this.dyn.push(this.add.image(x + 3, y + 3, e.icon).setOrigin(0));
      this.t(x + 23, y + 4, e.name, 'font', e.col);
      this.t(x + 23, y + 13, e.sub, 'fontPlain').setMaxWidth(w - 80);
      const label = `${e.sell ? '+' : ''}${e.price}G`;
      panel(g, x + w - 42, y + 5, 38, 13, can ? 0x2f5d3a : C.night, can ? 0x8cff8c : C.slate);
      this.t(x + w - 23 - label.length * 2.5, y + 8, label, can ? 'fontGold' : 'fontPlain');
      this.btn(x, y, w, rowH - 3, () => {
        if (e.sell) { st.gold += e.price; e.act(); audio.sfx('coin'); }
        else if (st.gold >= e.price) { st.gold -= e.price; e.act(); audio.sfx('coin'); audio.sfx('equip'); }
        else { audio.sfx('click'); return; }
        this.render();
      });
    });
    if (!list.length) this.t(x, top + 4, this.tab === 'sell' ? 'NOTHING TO SELL. SPARE GEAR AND MATERIALS SHOW UP HERE.' : 'SOLD OUT!', 'fontPlain', 0x9d93b3).setMaxWidth(w);
    if (list.length > maxRows) {
      this.t(x, H - 10, `${this.scroll + 1}-${Math.min(list.length, this.scroll + maxRows)} OF ${list.length}`, 'fontPlain');
      panel(g, Wd - 70, H - 13, 28, 11, C.night, C.slate); this.t(Wd - 62, H - 10, 'UP', 'fontPlain');
      this.btn(Wd - 72, H - 16, 32, 16, () => { this.scroll = Math.max(0, this.scroll - maxRows); this.render(); });
      panel(g, Wd - 38, H - 13, 30, 11, C.night, C.slate); this.t(Wd - 33, H - 10, 'DOWN', 'fontPlain');
      this.btn(Wd - 40, H - 16, 34, 16, () => { this.scroll += maxRows; this.render(); });
    }
  }
}
