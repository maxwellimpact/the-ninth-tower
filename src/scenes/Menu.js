// Party & Gear menu. Pauses the world; equipping re-bakes the hero's sprite
// sheet immediately so the preview (and the world) show the new look.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import { SLOTS, ALL_SLOTS, refineCap, smithRank, salvage, salvageYield, socketCount, socketGem, unsocket, combineGems, gemName, statDelta, xpToNext, CRAFT, canAfford, craft, refineCost, refine, itemName, heroSkillIds, skillRank, nextRankCost, canRankUp, rankUp, toggleSkill } from '../game/state.js';
import tuning from '../data/tuning.json';
import { panel, RARITY } from './UI.js';
import { itemTex } from '../game/itemtex.js';
import { TRAITS } from '../game/itemgen.js';
import { ERRANDS } from '../game/quests.js';
import { GearFX } from '../game/gearfx.js';

const C = { ink: 0x1a1423, night: 0x2b2140, slate: 0x45405e, stone: 0x6e6a87, gold: 0xf2c14e, goldL: 0xfff0a0, deep: 0x16121f };
const VIEWS = [['down', false], ['side', false], ['up', false], ['side', true]];
const SLOT_LABEL = { head: 'HEAD', body: 'BODY', weapon: 'WEAPON', offhand: 'OFF-HAND', trinket1: 'RING', trinket2: 'RING' };
const slotKind = (slot) => (slot.startsWith('trinket') ? 'trinket' : slot);
// one-line stat summary for an item
export const statLine = (it) => Object.entries(it.stats).map(([k, v]) => (k === 'crit' || k === 'cdr' ? `+${Math.round(v * 100)}% ${k === 'cdr' ? 'CDR' : 'CRIT'}` : `+${v} ${k.toUpperCase()}`)).join('  ');

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create({ game, tab, craftTab }) {
    this.g = game;
    this.heroIdx = Math.max(0, game.party.indexOf(game.leader));
    this.slot = 'weapon';
    this.tab = tab || 'gear';
    this.craftTab = craftTab;
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
    let slot = items[id].slot;
    if (slot === 'trinket') slot = this.slot.startsWith('trinket') ? this.slot : !hs.equip.trinket1 ? 'trinket1' : 'trinket2';
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
    const tabs = ['gear', 'skills', 'craft', 'bag', 'journal'];
    const tw = Math.min(38, Math.floor((W - 34) / tabs.length)) - 3;
    tabs.forEach((tb, i) => {
      const x = 4 + i * (tw + 3), sel = tb === this.tab;
      const label = tw < 36 && tb === 'journal' ? 'QUEST' : tb.toUpperCase();
      panel(g, x, 4, tw, 14, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      this.t(x + Math.round(tw / 2 - label.length * 2.5), 8, label, sel ? 'fontGold' : 'fontPlain');
      this.btn(x, 2, tw, 18, () => { if (this.tab !== tb) { audio.sfx('click'); this.tab = tb; this.selected = null; this.render(); } });
    });
    panel(g, W - 26, 5, 18, 14, C.night, C.stone);
    this.t(W - 20, 9, 'X');
    this.btn(W - 34, 0, 34, 24, () => this.close());
    const gold = `${this.g.state.gold}G`;
    this.t(W - 32 - gold.length * 5, 9, gold, 'fontGold');

    if (this.tab === 'bag') { this.renderBag(W, H); return; }
    if (this.tab === 'journal') { this.renderJournal(W, H); return; }
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
    if (this.tab === 'skills') { this.renderSkills(W, H, mode); return; }
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

  // Skills: spend points to learn / rank up (1-5), tap a learned skill to
  // equip or unequip it (3 active slots, 2 passive slots).
  renderSkills(W, H, mode) {
    const g = this.gfx, h = this.hero, hs = h.hs;
    const all = heroSkillIds(h.def.id).sort((a, b) => a[1].unlock - b[1].unlock);
    const act = all.filter(([, d]) => !d.passive), pas = all.filter(([, d]) => d.passive);
    const top = mode === 'portrait' ? 70 : 58;
    const spTxt = `SKILL POINTS ${hs.sp || 0}`;
    this.t(W - 10 - spTxt.length * 5, top - 10, spTxt, hs.sp ? 'fontGold' : 'fontPlain');
    const nA = hs.skills.active.filter(Boolean).length, nP = hs.skills.passive.filter(Boolean).length;
    const row = (x, y, w, rh, [sid, d]) => {
      const rank = skillRank(hs, sid), locked = hs.level < d.unlock;
      const eq = (d.passive ? hs.skills.passive : hs.skills.active).includes(sid);
      const sel = this.skillSel === sid;
      panel(g, x, y, w, rh - 3, sel ? 0x3a2f52 : C.night, eq ? C.gold : sel ? C.stone : C.slate);
      g.fillStyle(C.ink).fillRect(x + 2, y + Math.floor((rh - 3 - 16) / 2), 16, 16);
      const ic = this.add.image(x + 2, y + Math.floor((rh - 3 - 16) / 2), d.icon).setOrigin(0);
      if (!rank) ic.setAlpha(0.35);
      this.dyn.push(ic);
      this.t(x + 21, y + 2, d.name, rank ? 'font' : 'fontPlain', rank ? (eq ? 0xfff0a0 : 0xffffff) : 0x9d93b3);
      if (locked) this.t(x + 21, y + rh - 11, `UNLOCKS AT LV${d.unlock}`, 'fontPlain', 0x9d93b3);
      else {
        for (let r = 0; r < 5; r++) g.fillStyle(r < rank ? C.gold : C.slate).fillRect(x + 21 + r * 6, y + rh - 9, 4, 3);
        this.t(x + 54, y + rh - 11, eq ? 'EQUIPPED' : rank ? 'TAP TO EQUIP' : 'NOT LEARNED', 'fontPlain', eq ? 0xf2c14e : 0x9d93b3);
      }
      this.btn(x, y, w - 30, rh - 3, () => {
        this.skillSel = sid;
        if (rank) {
          if (toggleSkill(hs, sid)) { audio.sfx('equip'); h.buildSkills(); h.refreshStats(); }
          else audio.sfx('click');
        } else audio.sfx('click');
        this.render();
      });
      // rank-up button
      const cost = nextRankCost(hs, sid), can = canRankUp(hs, sid);
      if (cost !== null && !locked) {
        const bx = x + w - 28, by = y + 3;
        panel(g, bx, by, 25, rh - 9, can ? 0x2f5d3a : C.night, can ? 0x8cff8c : C.slate);
        this.t(bx + 3, by + Math.floor((rh - 9) / 2) - 3, `+${cost}`, can ? 'fontGold' : 'fontPlain');
        this.btn(bx - 2, y, 30, rh - 3, () => {
          this.skillSel = sid;
          if (rankUp(hs, sid)) { audio.sfx('levelUp'); h.buildSkills(); h.refreshStats(); } else audio.sfx('click');
          this.render();
        });
      }
    };
    if (mode === 'portrait') {
      const rh = 24, x = 8, w = W - 16;
      this.t(x, top - 10, `ACTIVE ${nA}/${tuning.activeSlots}`, 'fontPlain');
      act.forEach((e, i) => row(x, top + i * rh, w, rh, e));
      const py = top + act.length * rh + 12;
      this.t(x, py - 10, `PASSIVE ${nP}/${tuning.passiveSlots}`, 'fontPlain');
      pas.forEach((e, i) => row(x, py + i * rh, w, rh, e));
      this.drawSkillDesc(x, py + pas.length * rh + 4, w);
    } else {
      const rh = mode === 'wide' ? 24 : 21, gap = 6, cw = Math.floor((W - 16 - gap) / 2);
      this.t(8, top - 10, `ACTIVE ${nA}/${tuning.activeSlots}`, 'fontPlain');
      act.forEach((e, i) => row(8, top + i * rh, cw, rh, e));
      this.t(8 + cw + gap, top - 10, `PASSIVE ${nP}/${tuning.passiveSlots}`, 'fontPlain');
      pas.forEach((e, i) => row(8 + cw + gap, top + i * rh, cw, rh, e));
      this.drawSkillDesc(8 + cw + gap, top + pas.length * rh + 4, cw);
    }
  }

  drawSkillDesc(x, y, w) {
    const sid = this.skillSel;
    const d = sid && heroSkillIds(this.hero.def.id).find(([k]) => k === sid)?.[1];
    if (!d) { this.t(x, y, 'TAP A SKILL TO EQUIP IT. "+" SPENDS POINTS TO RANK IT UP (EACH RANK +15%).', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
    this.t(x, y, d.name, 'fontGold');
    this.t(x, y + 10, d.desc + (d.cd ? `  COOLDOWN ${d.cd}S.` : ''), 'fontPlain').setMaxWidth(w);
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
    rowH = Math.min(rowH, Math.floor((this.scale.height - y - 36) / ALL_SLOTS.length));
    ALL_SLOTS.forEach((slot, i) => {
      const yy = y + i * rowH;
      const id = hs.equip[slot], it = items[id], sel = slot === this.slot;
      const ph = rowH - 3, compact = ph < 22;
      panel(g, x, yy, w, ph, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      const isz = compact ? Math.min(16, ph - 2) : 18;
      const iy = yy + Math.floor((ph - isz) / 2);
      g.fillStyle(C.ink).fillRect(x + 2, iy, isz, isz);
      if (it) this.dyn.push(this.add.image(x + 2 + isz / 2, iy + isz / 2, itemTex(this, id)).setOrigin(0.5).setScale(isz / 16 > 1 ? 1 : isz / 16));
      if (compact) this.t(x + isz + 6, yy + Math.floor(ph / 2) - 3, it ? itemName(id) : `${SLOT_LABEL[slot]} (EMPTY)`, it ? 'font' : 'fontPlain', it ? RARITY[it.rarity].col : 0x888888);
      else {
        this.t(x + 25, yy + 3, SLOT_LABEL[slot], 'fontPlain');
        this.t(x + 25, yy + ph - 10, it ? itemName(id) : '-', 'font', it ? RARITY[it.rarity].col : 0x888888);
      }
      this.btn(x, yy, w, rowH - 3, () => this.selectSlot(slot));
    });
  }

  // Portrait: four big slot tiles in a row, selected slot's item named below.
  drawSlotsRow(x, y, w) {
    const g = this.gfx, hs = this.hero.hs;
    const tw = Math.floor((w - 15) / 6);
    ALL_SLOTS.forEach((slot, i) => {
      const xx = x + i * (tw + 3);
      const id = hs.equip[slot], it = items[id], sel = slot === this.slot;
      panel(g, xx, y, tw, 36, sel ? 0x3a2f52 : C.night, sel ? C.gold : it ? RARITY[it.rarity].col : C.slate);
      if (it) this.dyn.push(this.add.image(xx + tw / 2, y + 14, itemTex(this, id)).setOrigin(0.5));
      const lab = { head: 'HEAD', body: 'BODY', weapon: 'WPN', offhand: 'OFF', trinket1: 'RING', trinket2: 'RING' }[slot];
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
    const kind = slotKind(this.slot);
    const owned = this.g.state.inventory.filter((id) => items[id].slot === kind && (kind === 'trinket' || items[id].hero === h.def.id));
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
      this.dyn.push(this.add.image(x + 3, iy, itemTex(this, id)).setOrigin(0));
      this.t(x + 23, yy + 3, itemName(id), 'font', RARITY[it.rarity].col);
      if (isEq) this.t(x + 23, yy + rowH - 12, 'EQUIPPED', 'fontPlain', 0xf2c14e);
      else {
        const d = statDelta(h.def.id, hs.level, hs.equip, id);
        let xx = x + 23;
        for (const [k, label] of [['atk', 'ATK'], ['def', 'DEF'], ['maxHp', 'HP'], ['crit', 'CRIT'], ['cdr', 'CDR']]) {
          if (!d[k]) continue;
          const str = `${d[k] > 0 ? '+' : ''}${d[k]}${k === 'crit' ? '%' : ''} ${label}`;
          if (xx + str.length * 5 > x + w) break;
          this.t(xx, yy + rowH - 12, str, 'fontPlain', d[k] > 0 ? 0x8cff8c : 0xff7a7a);
          xx += str.length * 5 + 5;
        }
      }
      this.btn(x, yy, w, rowH - 3, () => { if (isEq) { this.selected = id; this.render(); } else this.equip(id); });
    });
    if (list.length <= 1) this.t(x, y + list.length * rowH + 4, kind === 'trinket' ? 'RINGS AND CHARMS: ANY HERO CAN WEAR TWO.' : 'FIND MORE IN CHESTS AND FROM FOES.', 'fontPlain', 0x9d93b3).setMaxWidth(w);
  }

  drawDesc(x, y, w) {
    const id = this.selected || this.hero.hs.equip[this.slot];
    if (!id) return;
    const it = items[id];
    const st = this.g.state;
    panel(this.gfx, x, y, w, 28, C.night, C.slate);
    const tags = [RARITY[it.rarity].label, it.element ? it.element.toUpperCase() : null, it.passive ? 'ECHO' : null, it.trait ? TRAITS[it.trait]?.name : null].filter(Boolean).join(' - ');
    this.t(x + 4, y + 4, `${itemName(id)} - ${tags}`, 'font', RARITY[it.rarity].col).setMaxWidth(w - 8);
    const sockets = socketCount(id) ? `  SOCKETS: ${Array.from({ length: socketCount(id) }, (_, i) => (st.sockets[id]?.[i] ? gemName(st.sockets[id][i]) : 'EMPTY')).join(', ')}` : '';
    const line = it.desc || [statLine(it), it.trait ? TRAITS[it.trait]?.desc : null].filter(Boolean).join('  ');
    this.t(x + 4, y + 14, line + sockets, 'fontPlain').setMaxWidth(w - 8);
  }

  // ------------------------------------------------------------------ CRAFT
  renderCraft(W, H, mode) {
    const g = this.gfx, st = this.g.state, h = this.hero;
    let y = mode === 'portrait' ? 60 : 50;
    const x = 8, w = W - 16;
    const matStr = (needs) => Object.entries(needs).map(([k, n]) => `${n} ${CRAFT.materials[k].short}`).join(' ');
    // sub tabs
    this.craftTab ??= 'brew';
    const subs = [['brew', 'BREW'], ['upgrade', 'UPGRADE'], ['salvage', 'SALVAGE'], ['gems', 'GEMS']];
    let sx = x;
    for (const [k, label] of subs) {
      const sel = this.craftTab === k, bw = label.length * 5 + 8;
      panel(g, sx, y, bw, 12, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      this.t(sx + 4, y + 3, label, sel ? 'fontGold' : 'fontPlain');
      this.btn(sx, y - 2, bw, 16, () => { if (this.craftTab !== k) { audio.sfx('click'); this.craftTab = k; this.render(); } });
      sx += bw + 4;
    }
    y += 18;
    const rowH = 24;
    const fits = () => y + rowH <= H - 4;
    const row = (icon, title, titleCol, sub, subCol, btnLabel, ok, fn) => {
      panel(g, x, y, w, rowH - 3, C.night, ok ? 0x6fd3a0 : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 2, 17, 17);
      this.dyn.push(this.add.image(x + 3, y + 2, icon).setOrigin(0));
      this.t(x + 23, y + 3, title, 'font', titleCol);
      this.t(x + 23, y + 12, sub, 'fontPlain', subCol).setMaxWidth(w - 80);
      if (btnLabel) {
        const bw = Math.max(26, btnLabel.length * 5 + 6);
        panel(g, x + w - bw - 4, y + 4, bw, 13, ok ? 0x2f5d3a : C.night, ok ? 0x8cff8c : C.slate);
        this.t(x + w - bw - 1, y + 7, btnLabel, ok ? 'font' : 'fontPlain');
        this.btn(x + w - bw - 18, y, bw + 18, rowH - 3, fn);
      }
      y += rowH;
    };
    if (this.craftTab === 'brew') {
      for (const r of CRAFT.recipes) {
        const ok = canAfford(st, r.needs);
        row(`icon_${r.makes}`, `${CRAFT.consumables[r.makes].name} (${st.potions[r.makes] || 0})`, 0xffffff, matStr(r.needs), ok ? 0x8cff8c : 0xff7a7a, 'MAKE', ok, () => { if (craft(st, r)) { audio.sfx('chest'); this.render(); } else audio.sfx('click'); });
      }
    } else if (this.craftTab === 'upgrade') {
      const cap = refineCap(st);
      if (!cap) { this.t(x, y, 'THE BLACKSMITH RETURNS TO BRIGHTWATER ONCE THE VALE WARD STONE FALLS.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
      this.t(x, y, `BLACKSMITH RANK ${smithRank(st)}: UP TO +${cap}. EACH +1 ADDS 6% OF THE ITEM'S STATS.`, 'fontPlain', 0x9d93b3).setMaxWidth(w); y += 12;
      for (const slot of ALL_SLOTS) {
        const id = h.hs.equip[slot];
        if (!id || !fits()) continue;
        const lvl = st.refine[id] || 0, c = refineCost(st, id);
        const maxed = lvl >= 10, capped = lvl >= cap;
        const ok = !capped && canAfford(st, c.needs, c.gold);
        row(itemTex(this, id), itemName(id), RARITY[items[id].rarity].col, maxed ? 'FULLY UPGRADED' : capped ? `MAX +${cap} AT THIS RANK` : `${matStr(c.needs)} ${c.gold}G`, maxed ? 0xf2c14e : ok ? 0x8cff8c : 0xff7a7a,
          maxed ? null : `+${lvl + 1}`, ok, () => { if (refine(st, id)) { audio.sfx('equip'); audio.sfx('bash'); h.refreshGear(); this.render(); } else audio.sfx('click'); });
      }
    } else if (this.craftTab === 'salvage') {
      const list = [...new Set(st.inventory)].filter((id) => salvageYield(st, id));
      if (!list.length) { this.t(x, y, 'NOTHING TO SALVAGE. SPARE GEAR (NOT UNIQUES) BREAKS DOWN INTO MATERIALS.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
      for (const id of list) {
        if (!fits()) break;
        const yd = salvageYield(st, id);
        row(itemTex(this, id), itemName(id), RARITY[items[id].rarity].col, `GIVES ${matStr(yd)}`, 0xbfe6f2, 'BREAK', true, () => { if (salvage(st, id)) { audio.sfx('bash'); this.render(); } });
      }
    } else {
      if (!st.flags.enchanter) { this.t(x, y, 'THE ENCHANTER RETURNS TO BRIGHTWATER ONCE TWO WARD STONES FALL. RARE AND UNIQUE GEAR HAS A GEM SOCKET.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
      const gems = Object.entries(st.gems).filter(([, n]) => n > 0);
      const target = ALL_SLOTS.map((s) => h.hs.equip[s]).find((id) => id === this.gemItem) || ALL_SLOTS.map((s) => h.hs.equip[s]).find((id) => id && socketCount(id));
      if (!target) { this.t(x, y, 'NO SOCKETED GEAR EQUIPPED. RARE AND UNIQUE ITEMS HAVE A SOCKET.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
      this.gemItem = target;
      const sk = st.sockets[target] || [];
      row(itemTex(this, target), itemName(target), RARITY[items[target].rarity].col, `SOCKET: ${sk[0] ? gemName(sk[0]) : 'EMPTY'}${socketCount(target) > 1 ? `, ${sk[1] ? gemName(sk[1]) : 'EMPTY'}` : ''}`, 0xbfe6f2, sk[0] ? 'REMOVE' : null, true, () => { unsocket(st, target, 0); h.refreshStats(); audio.sfx('click'); this.render(); });
      for (const [gem, n] of gems) {
        if (!fits()) break;
        const can3 = n >= CRAFT.gems.combine;
        row(`icon_crystal`, `${gemName(gem)} X${n}`, 0xffffff, can3 ? 'TAP COMBINE: 3 -> 1 OF THE NEXT GRADE' : 'SET INTO THE SOCKET', 0x9d93b3, 'SET', st.gold >= CRAFT.gems.socketGold[+gem.replace(/\D/g, '') - 1], () => {
          const arr = st.sockets[target] || [];
          let idx = 0;
          for (let i = 0; i < socketCount(target); i++) if (!arr[i]) { idx = i; break; }
          if (socketGem(st, target, idx, gem)) { audio.sfx('equip'); h.refreshStats(); } else audio.sfx('click');
          this.render();
        });
        if (can3) this.btn(x, y - rowH, 22, rowH - 3, () => { if (combineGems(st, gem)) audio.sfx('chest'); this.render(); });
      }
      if (!gems.length) this.t(x, y, 'NO GEMS YET. WITCHLINGS, WARLOCKS, BOSSES AND CHESTS DROP THEM.', 'fontPlain', 0x9d93b3).setMaxWidth(w);
    }
  }

  // ---------------------------------------------------------------- JOURNAL
  // Errands: active ones first (tap to track on the HUD and map), then done.
  renderJournal(W, H) {
    const g = this.gfx, Qm = this.g.quests, st = this.g.state;
    const x = 8, w = W - 16;
    let y = 26;
    const act = Qm.active(), done = Object.keys(st.quests).filter((id) => st.quests[id].done);
    this.t(x, y, `ERRANDS - ${act.length} ACTIVE, ${done.length} DONE`, 'fontGold'); y += 12;
    if (!act.length && !done.length) { this.t(x, y, 'NO ERRANDS YET. TALK TO PEOPLE WITH A "!" OVER THEIR HEADS, OR READ THE RUMOUR BOARD IN THE TAVERN.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
    for (const id of act) {
      if (y + 30 > H - 4) break;
      const tracked = st.tracked === id;
      panel(g, x, y, w, 27, tracked ? 0x3a2f52 : C.night, tracked ? C.gold : C.slate);
      this.t(x + 5, y + 4, ERRANDS[id].title, tracked ? 'fontGold' : 'font');
      this.t(x + 5, y + 15, Qm.stepText(id), 'fontPlain').setMaxWidth(w - 60);
      this.t(x + w - 50, y + 4, tracked ? 'TRACKED' : 'TAP: TRACK', 'fontPlain', tracked ? 0xf2c14e : 0x9d93b3);
      this.btn(x, y, w, 27, () => { st.tracked = id; audio.sfx('click'); this.render(); });
      y += 30;
    }
    if (done.length && y + 20 < H) {
      y += 4;
      this.t(x, y, 'COMPLETED', 'fontPlain'); y += 10;
      for (const id of done) { if (y + 10 > H - 4) break; this.t(x + 4, y, ERRANDS[id].title, 'fontPlain', 0x8cff8c); y += 10; }
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
