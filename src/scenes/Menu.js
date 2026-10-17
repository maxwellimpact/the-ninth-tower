// Party & Gear menu. Pauses the world; equipping re-bakes the hero's sprite
// sheet immediately so the preview (and the world) show the new look.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import { freshFor, SLOTS, ALL_SLOTS, refineCap, smithRank, salvage, salvageYield, socketCount, socketGem, unsocket, combineGems, gemName, statDelta, xpToNext, CRAFT, canAfford, craft, refineCost, refine, itemName, heroSkillIds, skillRank, nextRankCost, canRankUp, rankUp, toggleSkill, skillsReady } from '../game/state.js';
import tuning from '../data/tuning.json';
import { panel, RARITY, skillBadge } from './UI.js';
import { itemTex } from '../game/itemtex.js';
import { fitString } from './textfit.js';
import { TRAITS } from '../game/itemgen.js';
import { ERRANDS } from '../game/quests.js';
import KEY_ITEMS from '../data/relics.json';
import DISCIPLINES from '../data/disciplines.json';
import LORE from '../data/lore.json';
import WORLD from '../data/world.json';
import { TOTAL_FLIES } from './Game.js';
const W_TOWNSFOLK = WORLD.townsfolk;
import HERO_DATA from '../data/heroes.json';
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
    this.regions = [];
    this.scrollPos = {};
    this.marquees = [];
    // drag anywhere in a scrolling list to scroll it; a drag never counts as a tap
    this.input.on('pointerdown', (p) => {
      this.dragged = false;
      const r = this.regionAt(p);
      this.drag = r ? { r, y: p.y, from: r.cam.scrollY } : null;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || !this.drag) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 5) this.dragged = true;
      if (this.dragged) this.setScroll(this.drag.r, this.drag.from - dy);
    });
    this.input.on('wheel', (p, over, dx, dy) => { const r = this.regionAt(p); if (r) this.setScroll(r, r.cam.scrollY + dy * 0.5); });
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
    this.markSeen();
    audio.sfx('click');
    this.scene.stop();
    this.g.closeMenu();
    if (this.partyDirty) this.g.applyParty();
  }

  rotate(d, auto = false) {
    if (!auto) this.manualView = true;
    this.viewIdx = (this.viewIdx + d + 4) % 4;
    this.updatePreview();
  }

  btn(x, y, w, h, fn) {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => { this.downZone = z; });
    z.on('pointerup', () => {
      if (this.downZone !== z || this.dragged) return;
      this.downZone = null;
      // any shortened name inside what was tapped scrolls to show it in full
      const m = this.marquees.find((o) => o.active && o.x >= x - 1 && o.x < x + w && o.y >= y - 1 && o.y < y + h);
      if (m) { this.marqueeText = m.full; this.playMarquee(m); }
      fn();
    });
    this.dyn.push(z);
    return z;
  }

  // ------------------------------------------------------------ scrolling
  // A scrolling region is its own camera looking at content drawn far off to
  // the right (x + OX), clipped to the region's rectangle on screen. Drawing
  // code just adds `ox` to its x; heights come from what was drawn.
  region(key, x, y, w, h, draw) {
    const OX = (this.regions.length + 1) * 5000;
    const g = this.add.graphics();
    this.dyn.push(g);
    const keepG = this.gfx;
    this.gfx = g;
    const n0 = this.dyn.length;
    draw(OX);
    this.gfx = keepG;
    let bottom = y;
    for (const o of this.dyn.slice(n0)) {
      if (o.type === 'Graphics' || !o.getBounds) continue;
      bottom = Math.max(bottom, o.getBounds().bottom);
    }
    const cam = this.cameras.add(x, y, w, h);
    const r = { key, x, y, w, h, cam, min: y, max: Math.max(y, bottom + 6 - h) };
    cam.scrollX = OX + x;
    r.bar = this.add.graphics().setDepth(100);
    this.dyn.push(r.bar);
    this.regions.push(r);
    this.setScroll(r, y + (this.scrollPos[key] || 0));
    return r;
  }

  regionAt(p) { return this.regions.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h); }

  setScroll(r, sy) {
    r.cam.scrollY = Math.round(Math.max(r.min, Math.min(r.max, sy)));
    this.scrollPos[r.key] = r.cam.scrollY - r.min;
    // scrollbar on the right edge, only when there's more than fits
    r.bar.clear();
    const span = r.max - r.min;
    if (span <= 0) return;
    const th = Math.max(12, Math.round(r.h * (r.h / (r.h + span))));
    const ty = r.y + Math.round((r.h - th) * ((r.cam.scrollY - r.min) / span));
    // in the gutter just right of the list (or inside the right margin for full-width pages)
    const bx = r.x + r.w + 4 <= this.scale.width ? r.x + r.w + 2 : r.x + r.w - 5;
    r.bar.fillStyle(C.slate, 0.8).fillRect(bx, r.y, 2, r.h).fillStyle(C.gold).fillRect(bx, ty, 2, th);
  }

  clearRegions() {
    for (const r of this.regions) this.cameras.remove(r.cam);
    this.regions = [];
  }

  // ------------------------------------------------------------- marquee
  // Shortened names scroll sideways to show the whole thing, then settle back.
  playMarquee(o, loop = false) {
    if (!o.active || o.playing) return;
    o.playing = true;
    const dist = o.full.length * 5 - o.maxW + 4;
    o.setText(o.full).setSize(o.maxW, 12);
    const st = { x: 0 };
    this.tweens.add({
      targets: st, x: dist, duration: Math.max(600, dist * 35), delay: 500, hold: 900,
      onUpdate: (tw) => { if (!o.active) { tw.stop(); return; } o.scrollX = Math.round(st.x); },
      onComplete: () => {
        if (!o.active) return;
        o.playing = false;
        o.scrollX = 0;
        if (loop) { this.time.delayedCall(400, () => o.active && this.playMarquee(o, true)); return; }
        o.setText(o.fitted).setSize(0, 0);
        if (this.marqueeText === o.full) this.marqueeText = null;
      },
    });
  }

  // NEW gear that was on screen counts as seen once you move on from it
  markSeen() {
    const st = this.g.state;
    if (this.shownList?.length) st.fresh = (st.fresh || []).filter((id) => !this.shownList.includes(id));
    this.shownList = null;
  }

  newDot(x, y) { this.gfx.fillStyle(C.ink).fillCircle(x, y, 3.5).fillStyle(C.goldL).fillCircle(x, y, 2.5); }

  // maxW: fit inside this width (shortened with ".."); maxLines > 1 wraps first
  t(x, y, str, font = 'font', tint, maxW = 0, maxLines = 1) {
    const full = String(str).toUpperCase();
    const text = maxW > 0 ? fitString(str, maxW, maxLines) : full;
    const short = maxW > 0 && maxLines === 1 && text !== full;
    const o = short ? this.add.dynamicBitmapText(Math.round(x), Math.round(y), font, text) : this.add.bitmapText(Math.round(x), Math.round(y), font, text);
    if (short) {
      Object.assign(o, { full, fitted: text, maxW });
      this.marquees.push(o);
      if (this.marqueeText === full) this.time.delayedCall(0, () => this.playMarquee(o));
    }
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
    const ctx = `${this.tab}:${this.heroIdx}:${this.slot}`;
    if (this.listCtx && this.listCtx !== ctx) this.markSeen();
    this.listCtx = ctx;
    this.clearRegions();
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.marquees = [];
    this.preview?.destroy();
    this.preview = null;
    const W = this.scale.width, H = this.scale.height;
    const mode = H > W ? 'portrait' : W >= 360 && H >= 215 ? 'wide' : 'short';
    const g = this.add.graphics();
    this.dyn.push(g);
    g.fillStyle(C.deep, 1).fillRect(-2, -2, W + 4, H + 4); // past the edges: a rect at y=0 rasterizes a row short and the world peeks through
    this.gfx = g;
    const h = this.hero;

    // header: tabs
    const tabs = ['gear', 'skills', 'craft', 'bag', 'journal'];
    const narrow = W < 300;
    // narrow screens: tabs share the row with only the close button; gold moves down a row
    const tw = Math.min(38, Math.floor((W - (narrow ? 32 : 70)) / tabs.length)) - 3;
    tabs.forEach((tb, i) => {
      const x = 4 + i * (tw + 3), sel = tb === this.tab;
      const label = tw * 1 < tb.length * 5 + 4 ? { gear: 'GEAR', skills: 'SKILL', craft: 'CRAFT', bag: 'BAG', journal: 'QUEST' }[tb] : tb === 'journal' ? 'QUEST' : tb.toUpperCase();
      panel(g, x, 4, tw, 14, sel ? 0x3a2f52 : C.night, sel ? C.gold : C.slate);
      this.t(x + Math.round(tw / 2 - label.length * 2.5), 8, label, sel ? 'fontGold' : 'fontPlain');
      this.btn(x, 2, tw, 18, () => { if (this.tab !== tb) { audio.sfx('click'); this.tab = tb; this.selected = null; this.render(); } });
      if (tb === 'gear' && this.g.party.some((p) => freshFor(this.g.state, p.def.id).length)) this.newDot(x + tw - 2, 5);
      if (tb === 'skills' && this.g.party.some((p) => skillsReady(p.def.id, p.hs))) skillBadge(g, x + tw - 5, 1);
    });
    panel(g, W - 26, 5, 18, 14, C.night, C.stone);
    this.t(W - 20, 9, 'X');
    this.btn(W - 34, 0, 34, 24, () => this.close());
    const gold = `${this.g.state.gold}G`;
    if (narrow) this.t(W - 6 - gold.length * 5, 25, gold, 'fontGold');
    else this.t(W - 32 - gold.length * 5, 9, gold, 'fontGold');

    // everything under the tab row scrolls if it doesn't fit
    const body = (fn) => this.region(this.tab, 0, 22, W, H - 22, fn);
    if (this.tab === 'bag') { body((ox) => this.renderBag(W, 1e6, ox)); return; }
    if (this.tab === 'journal') { body((ox) => this.renderJournal(W, 1e6, ox)); return; }
    if (this.tab === 'party') { body((ox) => this.renderParty(W, 1e6, ox)); return; }
    // hero tabs + name
    this.g.party.forEach((p, i) => {
      const x = 8 + i * 28, y = 22;
      panel(g, x, y, 22, 22, C.ink, i === this.heroIdx ? C.gold : C.slate);
      this.dyn.push(this.add.image(x + 3, y + 3, `${p.texKey}_portrait`).setOrigin(0));
      this.btn(x, y, 22, 22, () => { if (this.heroIdx !== i) { audio.sfx('click'); this.heroIdx = i; this.selected = null; this.render(); } });
      if (this.tab === 'gear' && freshFor(this.g.state, p.def.id).length) this.newDot(x + 21, y + 1);
      if (skillsReady(p.def.id, p.hs)) skillBadge(g, x + 17, y + 17);
    });
    const name = `${h.def.name} THE ${h.def.title}`;
    if (mode === 'portrait') this.t(8, 48, name, 'font');
    else this.t(12 + this.g.party.length * 28, 30, name, 'font');

    if (this.tab === 'craft') { this.renderCraft(W, H, mode); return; }
    if (this.tab === 'skills') {
      const top = mode === 'portrait' ? 70 : 58;
      this.region(`skills:${this.heroIdx}`, 0, top - 12, W, H - top + 12, (ox) => this.renderSkills(W, H, mode, ox));
      return;
    }
    if (mode === 'wide') {
      const top = 52, wL = 92, colM = 10 + wL + 8;
      const wM = Math.min(130, Math.max(110, (W - 230) * 0.45));
      const colR = colM + wM + 8, wR = W - colR - 10;
      this.drawPreview(10, top, wL, 84);
      this.drawStats(10, top + 92, wL, 1);
      this.drawSlotsColumn(colM, top, wM, 28);
      this.listRegion(colR, top, wR, H - 38, 24);
      this.drawDesc(colM, H - 34, W - colM - 10);
    } else if (mode === 'short') {
      const top = 48, wL = 92, colM = 10 + wL + 6;
      const wM = Math.min(124, Math.max(100, (W - 220) * 0.45));
      const colR = colM + wM + 6, wR = W - colR - 8;
      this.drawPreview(10, top, wL, 66);
      this.drawStats(10, top + 70, wL, 2);
      this.drawSlotsColumn(colM, top, wM, 25);
      this.listRegion(colR, top, wR, H - 34, 22);
      this.drawDesc(colM, H - 30, W - colM - 8);
    } else {
      const y0 = 60;
      const pw = Math.min(84, Math.floor(W * 0.44));
      this.drawPreview(8, y0, pw, 84);
      this.drawStats(pw + 16, y0 + 2, W - pw - 24, 1);
      const sy = y0 + 92;
      this.drawSlotsRow(8, sy, W - 16);
      this.listRegion(8, sy + 54, W - 16, H - 40, 24, false);
      this.drawDesc(8, H - 34, W - 16);
    }
  }

  // Skills: spend points to learn / rank up (1-5), tap a learned skill to
  // equip or unequip it (3 active slots, 2 passive slots).
  renderSkills(W, H, mode, ox = 0) {
    const g = this.gfx, h = this.hero, hs = h.hs;
    const all = heroSkillIds(h.def.id, hs.disc).sort((a, b) => (a[1].discipline ? 100 : 0) + a[1].unlock - ((b[1].discipline ? 100 : 0) + b[1].unlock));
    const act = all.filter(([, d]) => !d.passive), pas = all.filter(([, d]) => d.passive);
    const top = mode === 'portrait' ? 70 : 58;
    const spTxt = `SKILL POINTS ${hs.sp || 0}`;
    this.t(ox + W - 10 - spTxt.length * 5, top - 10, spTxt, hs.sp ? 'fontGold' : 'fontPlain');
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
      this.t(x + 21, y + 2, d.name, rank ? 'font' : 'fontPlain', rank ? (eq ? 0xfff0a0 : d.discipline ? 0xd9b8ff : 0xffffff) : 0x9d93b3, w - 52);
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
      const rh = 24, x = 8 + ox, w = W - 16;
      this.t(x, top - 10, `ACTIVE ${nA}/${tuning.activeSlots}`, 'fontPlain');
      act.forEach((e, i) => row(x, top + i * rh, w, rh, e));
      const py = top + act.length * rh + 12;
      this.t(x, py - 10, `PASSIVE ${nP}/${tuning.passiveSlots}`, 'fontPlain');
      pas.forEach((e, i) => row(x, py + i * rh, w, rh, e));
      this.drawSkillDesc(x, py + pas.length * rh + 4, w);
    } else {
      const rh = mode === 'wide' ? 24 : 21, gap = 6, cw = Math.floor((W - 16 - gap) / 2);
      const x = 8 + ox;
      this.t(x, top - 10, `ACTIVE ${nA}/${tuning.activeSlots}`, 'fontPlain');
      act.forEach((e, i) => row(x, top + i * rh, cw, rh, e));
      this.t(x + cw + gap, top - 10, `PASSIVE ${nP}/${tuning.passiveSlots}`, 'fontPlain');
      pas.forEach((e, i) => row(x + cw + gap, top + i * rh, cw, rh, e));
      this.drawSkillDesc(x + cw + gap, top + pas.length * rh + 4, cw);
    }
  }

  drawSkillDesc(x, y, w) {
    const sid = this.skillSel;
    const d = sid && heroSkillIds(this.hero.def.id, this.hero.hs.disc).find(([k]) => k === sid)?.[1];
    if (!d) {
      const disc = this.hero.hs.disc;
      this.t(x, y, `TAP A SKILL TO EQUIP IT. "+" SPENDS POINTS TO RANK IT UP (EACH RANK +20%). DISCIPLINE: ${disc ? `${DISCIPLINES[disc].name} (LAVENDER SKILLS)` : 'NONE YET - TRAINERS TEACH ONE PER HERO'}.`, 'fontPlain', 0x9d93b3).setMaxWidth(w);
      return;
    }
    this.t(x, y, d.name, 'fontGold');
    this.t(x, y + 10, d.desc + (d.cd ? `  COOLDOWN ${d.cd}S.` : ''), 'fontPlain', undefined, w, 4);
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
      if (compact) this.t(x + isz + 6, yy + Math.floor(ph / 2) - 3, it ? itemName(id) : `${SLOT_LABEL[slot]} (EMPTY)`, it ? 'font' : 'fontPlain', it ? RARITY[it.rarity].col : 0x888888, w - isz - 10);
      else {
        this.t(x + 25, yy + 3, SLOT_LABEL[slot], 'fontPlain');
        this.t(x + 25, yy + ph - 10, it ? itemName(id) : '-', 'font', it ? RARITY[it.rarity].col : 0x888888, w - 28);
      }
      this.btn(x, yy, w, rowH - 3, () => this.selectSlot(slot));
      if (freshFor(this.g.state, this.hero.def.id, slotKind(slot)).length) this.newDot(x + w - 4, yy + 3);
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
      if (freshFor(this.g.state, this.hero.def.id, slotKind(slot)).length) this.newDot(xx + tw - 3, y + 3);
    });
    const it = items[hs.equip[this.slot]];
    this.t(x, y + 41, `${SLOT_LABEL[this.slot]}: `, 'fontPlain');
    if (it) this.t(x + (SLOT_LABEL[this.slot].length + 2) * 5, y + 41, itemName(hs.equip[this.slot]), 'font', RARITY[it.rarity].col, w - (SLOT_LABEL[this.slot].length + 2) * 5);
  }

  listRegion(x, y, w, bottom, rowH, header = true) {
    if (header) this.t(x, y - 8, 'TAP TO EQUIP', 'fontPlain');
    this.region(`list:${this.heroIdx}:${this.slot}`, x, y, w, bottom - y, (ox) => this.drawList(x + ox, y, w, 1e6, rowH, false));
  }

  drawList(x, y, w, bottom, rowH, header = true) {
    const g = this.gfx, h = this.hero, hs = h.hs;
    const equipped = hs.equip[this.slot];
    const kind = slotKind(this.slot);
    const owned = this.g.state.inventory.filter((id) => items[id].slot === kind && (kind === 'trinket' || items[id].hero === h.def.id));
    const fresh = new Set(freshFor(this.g.state, h.def.id, kind));
    const rest = [...new Set(owned)];
    const list = [...(equipped ? [equipped] : []), ...rest.filter((id) => fresh.has(id)), ...rest.filter((id) => !fresh.has(id))];
    this.shownList = [...fresh];
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
      const isNew = fresh.has(id);
      this.t(x + 23, yy + 3, itemName(id), 'font', RARITY[it.rarity].col, w - 26 - (isNew ? 20 : 0));
      if (isNew) this.t(x + w - 20, yy + 3, 'NEW', 'fontGold');
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
    if (list.length <= 1) this.t(x, y + list.length * rowH + 4, kind === 'trinket' ? 'RINGS AND CHARMS: ANY HERO CAN WEAR TWO.' : 'FIND MORE IN CHESTS AND FROM FOES.', 'fontPlain', 0x9d93b3, w, 3);
  }

  drawDesc(x, y, w) {
    const id = this.selected || this.hero.hs.equip[this.slot];
    if (!id) return;
    const it = items[id];
    const st = this.g.state;
    panel(this.gfx, x, y, w, 28, C.night, C.slate);
    const tags = [RARITY[it.rarity].label, it.element ? it.element.toUpperCase() : null, it.passive ? 'ECHO' : null, it.trait ? TRAITS[it.trait]?.name : null].filter(Boolean).join(' - ');
    const title = this.t(x + 4, y + 4, `${itemName(id)} - ${tags}`, 'font', RARITY[it.rarity].col, w - 8);
    if (title.full) this.playMarquee(title, true);
    const sockets = socketCount(id) ? `  SOCKETS: ${Array.from({ length: socketCount(id) }, (_, i) => (st.sockets[id]?.[i] ? gemName(st.sockets[id][i]) : 'EMPTY')).join(', ')}` : '';
    const line = it.desc || [statLine(it), it.trait ? TRAITS[it.trait]?.desc : null].filter(Boolean).join('  ');
    this.t(x + 4, y + 14, line + sockets, 'fontPlain', undefined, w - 8, 2);
  }

  // ------------------------------------------------------------------ CRAFT
  renderCraft(W, H, mode) {
    const g = this.gfx;
    let y = mode === 'portrait' ? 60 : 50;
    const x = 8;
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
    y += 16;
    this.region(`craft:${this.craftTab}:${this.heroIdx}`, 0, y, W, H - y, (ox) => this.renderCraftBody(W, y + 2, ox));
  }

  renderCraftBody(W, y0, ox) {
    const g = this.gfx, st = this.g.state, h = this.hero;
    let y = y0;
    const x = 8 + ox, w = W - 16;
    const matStr = (needs) => Object.entries(needs).map(([k, n]) => `${n} ${CRAFT.materials[k].short}`).join(' ');
    const rowH = 24;
    const fits = () => true; // the list scrolls
    const row = (icon, title, titleCol, sub, subCol, btnLabel, ok, fn) => {
      panel(g, x, y, w, rowH - 3, C.night, ok ? 0x6fd3a0 : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 2, 17, 17);
      this.dyn.push(this.add.image(x + 3, y + 2, icon).setOrigin(0));
      const bwid = btnLabel ? Math.max(26, btnLabel.length * 5 + 6) + 8 : 4;
      this.t(x + 23, y + 3, title, 'font', titleCol, w - 23 - bwid);
      this.t(x + 23, y + 12, sub, 'fontPlain', subCol, w - 23 - bwid);
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
        row(`icon_${r.makes}`, `${CRAFT.consumables[r.makes].name} (${st.potions[r.makes] || 0})`, 0xffffff, matStr(r.needs), ok ? 0x8cff8c : 0xff7a7a, r.count > 1 ? `MAKE ${r.count}` : 'MAKE', ok, () => { if (craft(st, r)) { audio.sfx('chest'); this.render(); } else audio.sfx('click'); });
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

  // ------------------------------------------------------------------ PARTY
  // Campfire only: tap heroes to bring them along (max 3) or bench them.
  renderParty(W, H, ox = 0) {
    const g = this.gfx, st = this.g.state;
    const x = 8 + ox, w = W - 16;
    let y = 26;
    this.t(x, y, `CHOOSE YOUR PARTY - ${st.active.length} / 3`, 'fontGold'); y += 10;
    this.t(x, y, 'BENCHED HEROES DO NOT EARN XP.', 'fontPlain', 0x9d93b3); y += 12;
    for (const id of st.recruited) {
      if (y + 28 > H - 4) break;
      const on = st.active.includes(id), hs = st.heroes[id], info = this.g.party.find((h) => h.def.id === id);
      panel(g, x, y, w, 26, on ? 0x2f3a52 : C.night, on ? C.gold : C.slate);
      g.fillStyle(C.ink).fillRect(x + 3, y + 3, 20, 20);
      const key = info ? `${info.texKey}_portrait` : `${id}_portrait`;
      if (this.textures.exists(key)) this.dyn.push(this.add.image(x + 4, y + 4, key).setOrigin(0).setAlpha(on ? 1 : 0.6));
      const nm = HERO_DATA.find((k) => k.id === id);
      this.t(x + 28, y + 5, `${nm.name} THE ${nm.title}`, on ? 'fontGold' : 'font');
      this.t(x + 28, y + 15, `LV${hs.level}  ${on ? (id === st.leader ? 'IN PARTY - LEADER' : 'IN PARTY') : 'BENCHED'}`, 'fontPlain', on ? 0x8cff8c : 0x9d93b3);
      this.btn(x, y, w, 26, () => {
        if (on) { if (st.active.length <= 1) { audio.sfx('click'); return; } st.active = st.active.filter((k) => k !== id); if (st.leader === id) st.leader = st.active[0]; }
        else { if (st.active.length >= 3) { audio.sfx('click'); return; } st.active.push(id); }
        audio.sfx('equip');
        this.partyDirty = true;
        this.render();
      });
      y += 29;
    }
  }

  // ---------------------------------------------------------------- JOURNAL
  // Errands: active ones first (tap to track on the HUD and map), then done.
  renderJournal(W, H, ox = 0) {
    const g = this.gfx, Qm = this.g.quests, st = this.g.state;
    const x = 8 + ox, w = W - 16;
    let y = 26;
    const act = Qm.active(), done = Object.keys(st.quests).filter((id) => st.quests[id].done);
    this.t(x, y, `ERRANDS - ${act.length} ACTIVE, ${done.length} DONE`, 'fontGold'); y += 12;
    if (!act.length && !done.length) { this.t(x, y, 'NO ERRANDS YET. TALK TO PEOPLE WITH A "!" OVER THEIR HEADS, OR READ THE RUMOUR BOARD IN THE TAVERN.', 'fontPlain', 0x9d93b3).setMaxWidth(w); y += 24; }
    for (const id of act) {
      if (y + 30 > H - 4) break;
      const tracked = st.tracked === id;
      panel(g, x, y, w, 27, tracked ? 0x3a2f52 : C.night, tracked ? C.gold : C.slate);
      this.t(x + 5, y + 4, ERRANDS[id].title, tracked ? 'fontGold' : 'font', undefined, w - 64);
      this.t(x + 5, y + 15, Qm.stepText(id), 'fontPlain', undefined, w - 10);
      const tag = tracked ? 'TRACKED' : 'TAP: TRACK';
      this.t(x + w - 5 - tag.length * 5, y + 4, tag, 'fontPlain', tracked ? 0xf2c14e : 0x9d93b3);
      this.btn(x, y, w, 27, () => { st.tracked = id; audio.sfx('click'); this.render(); });
      y += 30;
    }
    if (done.length && y + 20 < H) {
      y += 4;
      this.t(x, y, 'COMPLETED', 'fontPlain'); y += 10;
      for (const id of done) { if (y + 10 > H - 4) break; this.t(x + 4, y, ERRANDS[id].title, 'fontPlain', 0x8cff8c); y += 10; }
    }
    // lore pages you've found: tap a title to read it again
    const read = LORE.filter((p) => (st.lore || []).includes(p.id));
    y += 8;
    this.t(x, y, `LORE PAGES - ${read.length} / 40`, 'fontGold'); y += 12;
    if (!read.length) { this.t(x, y, 'LOOSE PAGES ARE SCATTERED ACROSS ALDERMERE. THEY GLOW FAINTLY.', 'fontPlain', 0x9d93b3).setMaxWidth(w); return; }
    for (const p of read) {
      const open = this.loreOpen === p.id;
      const body = open ? fitString(p.text, w - 12, 12) : '';
      const bh = open ? body.split('\n').length * 8 + 4 : 0;
      panel(g, x, y, w, 15 + bh, open ? 0x3a2f52 : C.night, open ? C.gold : C.slate);
      this.dyn.push(this.add.image(x + 3, y + 0, 'icon_lore').setOrigin(0).setScale(0.85));
      this.t(x + 20, y + 5, p.title, open ? 'fontGold' : 'font', undefined, w - 26);
      if (open) this.t(x + 6, y + 16, body, 'fontPlain');
      this.btn(x, y, w, 15 + bh, () => { this.loreOpen = open ? null : p.id; audio.sfx('click'); this.render(); });
      y += 18 + bh;
    }
  }

  // -------------------------------------------------------------------- BAG
  renderBag(W, H, ox = 0) {
    const g = this.gfx, st = this.g.state;
    const x = 8 + ox, w = W - 16;
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
    y += Math.ceil(Object.keys(CRAFT.consumables).length / cols) * 22 + 6;
    this.t(x, y, 'COLLECTION', 'fontGold'); y += 10;
    row('icon_fly', 'GOLDEN FLIES', `${st.flies.length}/${TOTAL_FLIES}`, 0);
    row('icon_bag', 'TOWNSFOLK', `${W_TOWNSFOLK.filter((t) => this.g.flags[`folk_${t.id}`]).length}/30`, 1);
    row('icon_lore', 'LORE PAGES', `${(st.lore || []).length}/40`, 2);
    const keys = Object.entries(KEY_ITEMS).filter(([k]) => st.relics.includes(k));
    keys.forEach(([, d], i) => row(d.icon, d.name, 'OWNED', i + 3));
    y += Math.ceil((keys.length + 3) / cols) * 22 + 6;
    if (y < H - 20) this.t(x, y, 'FLASKS ON THE HUD (H / J / K): POTION, ELIXIR, ANTIDOTE. GATHER HERBS, ORE, CRYSTALS AND BOGMOSS; FOES DROP GEL AND SCRAP.', 'fontPlain', 0x9d93b3).setMaxWidth(w);
  }
}
