// Party & Gear menu. Pauses the world; equipping re-bakes the hero's sprite
// sheet immediately so the preview (and the world) show the new look.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import { SLOTS, statDelta, xpToNext, CRAFT, canAfford, craft, refineCost, refine, itemName } from '../game/state.js';
import { panel, RARITY } from './UI.js';
import { GearFX } from '../game/gearfx.js';

const C = { ink: 0x1a1423, night: 0x2b2140, slate: 0x45405e, stone: 0x6e6a87, gold: 0xf2c14e, goldL: 0xfff0a0, deep: 0x16121f };
const VIEWS = [['down', false], ['side', false], ['up', false], ['side', true]];
const SLOT_LABEL = { head: 'HEAD', body: 'BODY', weapon: 'WEAPON', offhand: 'OFF-HAND' };

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create({ game }) {
    this.g = game;
    this.heroIdx = Math.max(0, game.party.indexOf(game.leader));
    this.slot = 'weapon';
    this.tab = 'gear';
    this.viewIdx = 0;
    this.selected = null;
    this.dyn = [];
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-I', () => this.close());
    this.input.keyboard.on('keydown-LEFT', () => this.rotate(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.rotate(1));
    this.scale.on('resize', this.render, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.render, this));
    this.time.addEvent({ delay: 2500, loop: true, callback: () => { if (!this.manualView) this.rotate(1, true); } });
    this.render();
  }

  get hero() { return this.g.party[this.heroIdx]; }

  update(time, delta) {
    if (!this.preview || !this.pfx || this.tab === 'bag') { if (this.pfx) for (const [, st] of this.pfx.slots) st.glow?.setVisible(false); return; }
    const [v, flip] = VIEWS[this.viewIdx];
    this.pfx.update({ x: this.prevX, y: this.prevY, view: v, flip, hs: this.hero.hs, def: this.hero.def }, delta / 1000);
  }

  close() {
    audio.sfx('click');
    this.scene.stop();
    this.g.closeMenu();
  }

  rotate(d, auto = false) {
    if (!auto) this.manualView = true;
    this.viewIdx = (this.viewIdx + d + 4) % 4;
    this.updatePreview();
  }

  btn(x, y, w, h, fn) {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', fn);
    this.dyn.push(z);
    return z;
  }

  t(x, y, str, font = 'font', tint) {
    const o = this.add.bitmapText(Math.round(x), Math.round(y), font, String(str).toUpperCase());
    if (tint !== undefined) o.setTint(tint);
    this.dyn.push(o);
    return o;
  }

  equip(id) {
    const h = this.hero;
    const hs = h.hs;
    const slot = items[id].slot;
    const cur = hs.equip[slot];
    if (cur === id) return;
    const inv = this.g.state.inventory;
    inv.splice(inv.indexOf(id), 1);
    if (cur) inv.push(cur);
    hs.equip[slot] = id;
    h.refreshGear();
    audio.sfx('equip');
    this.selected = id;
    this.render();
    // little flourish on the preview
    this.time.delayedCall(10, () => {
      for (let i = 0; i < 10; i++) {
        const p = this.add.image(this.prevX + Phaser.Math.Between(-16, 16), this.prevY - Phaser.Math.Between(4, 40), 'px2_goldL');
        this.tweens.add({ targets: p, y: p.y - 12, alpha: 0, duration: 500, delay: i * 30, onComplete: () => p.destroy() });
      }
    });
  }

  updatePreview() {
    if (!this.preview) return;
    const [v, flip] = VIEWS[this.viewIdx];
    this.preview.setFlipX(flip).play(`${this.hero.texKey}_walk_${v}`);
  }

  // Three layouts: wide (3 columns), short landscape (compact 3 columns) and
  // portrait (stacked single column) so it works on any phone orientation.
  render() {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.preview?.destroy();
    this.preview = null;
    const W = this.scale.width, H = this.scale.height;
    const mode = H > W ? 'portrait' : W >= 360 && H >= 215 ? 'wide' : 'short';
    const g = this.add.graphics();
    this.dyn.push(g);
    g.fillStyle(C.deep, 0.94).fillRect(0, 0, W, H);
    this.gfx = g;
    const h = this.hero;

    // header: tabs
    ['gear', 'craft', 'bag'].forEach((tb, i) => {
      const x = 6 + i * 38, sel = tb === this.tab;
      panel(g, x, 4, 34, 14, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      this.t(x + 17 - tb.length * 2.5, 8, tb.toUpperCase(), sel ? 'fontGold' : 'fontPlain');
      this.btn(x, 2, 34, 18, () => { if (this.tab !== tb) { audio.sfx('click'); this.tab = tb; this.selected = null; this.render(); } });
    });
    panel(g, W - 26, 5, 18, 14, C.night, C.stone);
    this.t(W - 20, 9, 'X');
    this.btn(W - 34, 0, 34, 24, () => this.close());
    const gold = `${this.g.state.gold}G`;
    this.t(W - 32 - gold.length * 5, 9, gold, 'fontGold');

    if (this.tab === 'bag') { this.renderBag(W, H); return; }
    // hero tabs + name
    this.g.party.forEach((p, i) => {
      const x = 8 + i * 28, y = 22;
      panel(g, x, y, 22, 22, C.ink, i === this.heroIdx ? C.gold : C.slate);
      this.dyn.push(this.add.image(x + 3, y + 3, `${p.texKey}_portrait`).setOrigin(0));
      this.btn(x, y, 22, 22, () => { if (this.heroIdx !== i) { audio.sfx('click'); this.heroIdx = i; this.selected = null; this.render(); } });
    });
    const name = `${h.def.name} THE ${h.def.title}`;
    if (mode === 'portrait') this.t(8, 48, name, 'font');
    else this.t(12 + this.g.party.length * 28, 30, name, 'font');

    if (this.tab === 'craft') { this.renderCraft(W, H, mode); return; }
    if (mode === 'wide') {
      const top = 52, wL = 92, colM = 10 + wL + 8;
      const wM = Math.min(130, Math.max(110, (W - 230) * 0.45));
      const colR = colM + wM + 8, wR = W - colR - 10;
      this.drawPreview(10, top, wL, 84);
      this.drawStats(10, top + 92, wL, 1);
      this.drawSlotsColumn(colM, top, wM, 28);
      this.drawList(colR, top, wR, H - 38, 24);
      this.drawDesc(colM, H - 34, W - colM - 10);
    } else if (mode === 'short') {
      const top = 48, wL = 92, colM = 10 + wL + 6;
      const wM = Math.min(124, Math.max(100, (W - 220) * 0.45));
      const colR = colM + wM + 6, wR = W - colR - 8;
      this.drawPreview(10, top, wL, 66);
      this.drawStats(10, top + 70, wL, 2);
      this.drawSlotsColumn(colM, top, wM, 25);
      this.drawList(colR, top, wR, H - 34, 22);
      this.drawDesc(colM, H - 30, W - colM - 8);
    } else {
      const y0 = 60;
      const pw = Math.min(84, Math.floor(W * 0.44));
      this.drawPreview(8, y0, pw, 84);
      this.drawStats(pw + 16, y0 + 2, W - pw - 24, 1);
      const sy = y0 + 92;
      this.drawSlotsRow(8, sy, W - 16);
      this.drawList(8, sy + 54, W - 16, H - 40, 24, false);
      this.drawDesc(8, H - 34, W - 16);
    }
  }

  drawPreview(x, y, w, h) {
    const g = this.gfx;
    panel(g, x, y, w, h, 0x223a2a, C.stone);
    g.fillStyle(0x2f5d3a).fillRect(x + 1, y + h - 24, w - 2, 23);
    this.prevX = x + w / 2; this.prevY = y + h - 14;
    this.dyn.push(this.add.image(this.prevX + 1, this.prevY + 1, 'shadow').setScale(2).setAlpha(0.3));
    this.preview = this.add.sprite(this.prevX, this.prevY, this.hero.texKey, 'idle_down_0').setOrigin(0.5, 0.75).setScale(2).setDepth(5);
    this.updatePreview();
    // live gear effects on the preview too
    this.pfx?.clear(this.pfxHero);
    this.pfx ??= new GearFX(this, { scale: 2, depth: 50, glowDepth: 4, fixed: true });
    this.pfxHero = this.hero.def.id;
    this.t(x + 4, y + h - 10, '<', 'fontGold'); this.btn(x, y + h - 24, 22, 24, () => this.rotate(-1));
    this.t(x + w - 9, y + h - 10, '>', 'fontGold'); this.btn(x + w - 22, y + h - 24, 22, 24, () => this.rotate(1));
  }

  drawStats(x, y, w, cols) {
    const h = this.hero, hs = h.hs, st = h.stats;
    const compact = cols > 1;
    const lines = [
      ['LV', `${hs.level}`], ['XP', compact ? `${Math.floor((hs.xp / xpToNext(hs.level)) * 100)}%` : `${hs.xp}/${xpToNext(hs.level)}`],
      ['HP', compact ? `${h.maxHp}` : `${Math.ceil(h.hp)}/${h.maxHp}`],
      ['ATK', `${st.atk}`], ['DEF', `${st.def}`], ['CRIT', `${Math.round(st.crit * 100)}%`],
    ];
    const per = Math.ceil(lines.length / cols), cw = Math.floor(w / cols);
    lines.forEach(([k, v], i) => {
      const cx = x + Math.floor(i / per) * cw, cy = y + (i % per) * 9;
      this.t(cx + 2, cy, k, 'fontPlain');
      this.t(cx + cw - 4 - v.length * 5, cy, v, 'font');
    });
  }

  selectSlot(slot) { audio.sfx('click'); this.slot = slot; this.selected = null; this.render(); }

  drawSlotsColumn(x, y, w, rowH) {
    const g = this.gfx, hs = this.hero.hs;
    this.t(x, y - 8, 'EQUIPPED', 'fontPlain');
    SLOTS.forEach((slot, i) => {
      const yy = y + i * rowH;
      const id = hs.equip[slot], it = items[id], sel = slot === this.slot;
      panel(g, x, yy, w, rowH - 4, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      const iy = yy + Math.floor((rowH - 4 - 18) / 2);
      g.fillStyle(C.ink).fillRect(x + 3, iy, 18, 18);
      if (it) this.dyn.push(this.add.image(x + 4, iy + 1, `item_${id}`).setOrigin(0));
      this.t(x + 25, yy + 3, SLOT_LABEL[slot], 'fontPlain');
      this.t(x + 25, yy + rowH - 13, it ? itemName(id) : '-', 'font', it ? RARITY[it.rarity].col : 0x888888);
      this.btn(x, yy, w, rowH - 4, () => this.selectSlot(slot));
    });
  }

  // Portrait: four big slot tiles in a row, selected slot's item named below.
  drawSlotsRow(x, y, w) {
    const g = this.gfx, hs = this.hero.hs;
    const tw = Math.floor((w - 9) / 4);
    SLOTS.forEach((slot, i) => {
      const xx = x + i * (tw + 3);
      const id = hs.equip[slot], it = items[id], sel = slot === this.slot;
      panel(g, xx, y, tw, 36, sel ? 0x3a2f52 : C.night, sel ? C.gold : it ? RARITY[it.rarity].col : C.slate);
      if (it) this.dyn.push(this.add.image(xx + tw / 2, y + 14, `item_${id}`).setOrigin(0.5));
      const lab = { head: 'HEAD', body: 'BODY', weapon: 'WPN', offhand: 'OFF' }[slot];
      this.t(xx + Math.round(tw / 2 - lab.length * 2.5), y + 26, lab, 'fontPlain');
      this.btn(xx, y, tw, 36, () => this.selectSlot(slot));
    });
    const it = items[hs.equip[this.slot]];
    this.t(x, y + 41, `${SLOT_LABEL[this.slot]}: `, 'fontPlain');
    if (it) this.t(x + (SLOT_LABEL[this.slot].length + 2) * 5, y + 41, itemName(hs.equip[this.slot]), 'font', RARITY[it.rarity].col);
  }

  drawList(x, y, w, bottom, rowH, header = true) {
    const g = this.gfx, h = this.hero, hs = h.hs;
    const equipped = hs.equip[this.slot];
    const owned = this.g.state.inventory.filter((id) => items[id].hero === h.def.id && items[id].slot === this.slot);
    const list = [...(equipped ? [equipped] : []), ...new Set(owned)];
    const maxRows = Math.max(1, Math.floor((bottom - y) / rowH));
    if (header) this.t(x, y - 8, 'TAP TO EQUIP', 'fontPlain');
    list.slice(0, maxRows).forEach((id, i) => {
      const it = items[id];
      const yy = y + i * rowH;
      const isEq = id === equipped, isSel = id === this.selected;
      panel(g, x, yy, w, rowH - 3, isSel ? 0x3a2f52 : C.night, isEq ? C.gold : RARITY[it.rarity].col);
      const iy = yy + Math.floor((rowH - 3 - 17) / 2);
      g.fillStyle(C.ink).fillRect(x + 3, iy, 17, 17);
      this.dyn.push(this.add.image(x + 3, iy, `item_${id}`).setOrigin(0));
      this.t(x + 23, yy + 3, itemName(id), 'font', RARITY[it.rarity].col);
      if (isEq) this.t(x + 23, yy + rowH - 12, 'EQUIPPED', 'fontPlain', 0xf2c14e);
      else {
        const d = statDelta(h.def.id, hs.level, hs.equip, id);
        let xx = x + 23;
        for (const [k, label] of [['atk', 'ATK'], ['def', 'DEF'], ['maxHp', 'HP'], ['crit', 'CRIT']]) {
          if (!d[k]) continue;
          const str = `${d[k] > 0 ? '+' : ''}${d[k]}${k === 'crit' ? '%' : ''} ${label}`;
          if (xx + str.length * 5 > x + w) break;
          this.t(xx, yy + rowH - 12, str, 'fontPlain', d[k] > 0 ? 0x8cff8c : 0xff7a7a);
          xx += str.length * 5 + 5;
        }
      }
      this.btn(x, yy, w, rowH - 3, () => { if (isEq) { this.selected = id; this.render(); } else this.equip(id); });
    });
    if (list.length <= 1) this.t(x, y + list.length * rowH + 4, 'FIND MORE IN CHESTS AND FROM FOES.', 'fontPlain', 0x9d93b3).setMaxWidth(w);
  }

  drawDesc(x, y, w) {
    const id = this.selected || this.hero.hs.equip[this.slot];
    if (!id) return;
    const it = items[id];
    panel(this.gfx, x, y, w, 28, C.night, C.slate);
    this.t(x + 4, y + 4, `${it.name} - ${RARITY[it.rarity].label}${it.element ? ` - ${it.element.toUpperCase()}` : ''}${it.passive ? ' - ECHO' : ''}`, 'font', RARITY[it.rarity].col);
    const statStr = Object.entries(it.stats).map(([k, v]) => (k === 'crit' ? `+${Math.round(v * 100)}% CRIT` : `+${v} ${k.toUpperCase()}`)).join('  ');
    this.t(x + 4, y + 14, it.desc || statStr, 'fontPlain').setMaxWidth(w - 8);
  }

  // ------------------------------------------------------------------ CRAFT
  renderCraft(W, H, mode) {
    const g = this.gfx, st = this.g.state, h = this.hero;
    let y = mode === 'portrait' ? 60 : 50;
    const x = 8, w = W - 16;
    const matStr = (needs) => Object.entries(needs).map(([k, n]) => `${n} ${CRAFT.materials[k].short}`).join(' ');
    this.t(x, y, 'BREW', 'fontGold'); y += 10;
    for (const r of CRAFT.recipes) {
      const ok = canAfford(st, r.needs);
      panel(g, x, y, w, 24, C.night, ok ? 0x6fd3a0 : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 3, 18, 18);
      this.dyn.push(this.add.image(x + 4, y + 4, `icon_${r.makes}`).setOrigin(0));
      this.t(x + 25, y + 3, `${CRAFT.consumables[r.makes].name} (${st.potions[r.makes] || 0})`, 'font');
      this.t(x + 25, y + 13, matStr(r.needs), 'fontPlain', ok ? 0x8cff8c : 0xff7a7a);
      panel(g, x + w - 30, y + 5, 26, 14, ok ? 0x2f5d3a : C.night, ok ? 0x8cff8c : C.slate);
      this.t(x + w - 27, y + 9, 'MAKE', ok ? 'font' : 'fontPlain');
      this.btn(x + w - 44, y, 44, 24, () => { if (craft(st, r)) { audio.sfx('chest'); this.render(); } else audio.sfx('click'); });
      y += 27;
    }
    y += 4;
    this.t(x, y, `UPGRADE GEAR (MAX +${CRAFT.refine.max})`, 'fontGold'); y += 10;
    const rowH = 24;
    for (const slot of SLOTS) {
      const id = h.hs.equip[slot];
      if (!id || y + rowH > H - 4) continue;
      const lvl = st.refine[id] || 0;
      const c = refineCost(st, id);
      const maxed = lvl >= CRAFT.refine.max;
      const ok = !maxed && canAfford(st, c.needs, c.gold);
      panel(g, x, y, w, rowH - 3, C.night, ok ? 0x6fd3a0 : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 2, 17, 17);
      this.dyn.push(this.add.image(x + 3, y + 2, `item_${id}`).setOrigin(0));
      const b = CRAFT.refine.bonus[slot];
      this.t(x + 23, y + 3, itemName(id), 'font', RARITY[items[id].rarity].col);
      this.t(x + 23, y + 12, maxed ? 'FULLY UPGRADED' : `${matStr(c.needs)} ${c.gold}G: +${b.atk ? `${b.atk} ATK` : `${b.def} DEF`}`, 'fontPlain', maxed ? 0xf2c14e : ok ? 0x8cff8c : 0xff7a7a);
      if (!maxed) {
        panel(g, x + w - 30, y + 4, 26, 13, ok ? 0x2f5d3a : C.night, ok ? 0x8cff8c : C.slate);
        this.t(x + w - 25, y + 7, 'UP', ok ? 'font' : 'fontPlain');
        this.btn(x + w - 44, y, 44, rowH - 3, () => { if (refine(st, id)) { audio.sfx('equip'); audio.sfx('bash'); h.refreshGear(); this.render(); } else audio.sfx('click'); });
      }
      y += rowH;
    }
  }

  // -------------------------------------------------------------------- BAG
  renderBag(W, H) {
    const g = this.gfx, st = this.g.state;
    const x = 8, w = W - 16;
    let y = 26;
    const cols = W > 300 ? 2 : 1;
    const cw = Math.floor((w - (cols - 1) * 6) / cols);
    const row = (icon, label, value, i) => {
      const cx = x + (i % cols) * (cw + 6), cy = y + Math.floor(i / cols) * 22;
      panel(g, cx, cy, cw, 19, C.night, C.slate);
      this.dyn.push(this.add.image(cx + 2, cy + 2, icon).setOrigin(0));
      this.t(cx + 22, cy + 7, label, 'font');
      this.t(cx + cw - 5 - String(value).length * 5, cy + 7, value, 'fontGold');
    };
    this.t(x, y, 'MATERIALS', 'fontGold'); y += 10;
    Object.entries(CRAFT.materials).forEach(([k, m], i) => row(`icon_${k}`, m.name, st.materials[k] || 0, i));
    y += Math.ceil(Object.keys(CRAFT.materials).length / cols) * 22 + 6;
    this.t(x, y, 'POTIONS', 'fontGold'); y += 10;
    Object.entries(CRAFT.consumables).forEach(([k, c], i) => row(`icon_${k}`, c.name, st.potions[k] || 0, i));
    y += Math.ceil(2 / cols) * 22 + 6;
    this.t(x, y, 'COLLECTION', 'fontGold'); y += 10;
    row('icon_fly', 'GOLDEN FLIES', `${st.flies.length}/10`, 0);
    if (st.relics.includes('grapple')) row('icon_step', 'GRAPPLE HOOK', 'OWNED', 1);
    y += 50;
    if (y < H - 20) this.t(x, y, 'POTIONS: TAP THE FLASKS ON THE HUD (H / J). GATHER HERBS, ORE AND CRYSTALS; FOES DROP GEL AND SCRAP.', 'fontPlain', 0x9d93b3).setMaxWidth(w);
  }
}
