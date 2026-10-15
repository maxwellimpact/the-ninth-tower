import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import items from '../data/items.json';
import { itemTex } from '../game/itemtex.js';
import { TRAITS } from '../game/itemgen.js';
import { fitString } from './textfit.js';
import { freshFor } from '../game/state.js';

const C = { ink: 0x1a1423, night: 0x2b2140, slate: 0x45405e, stone: 0x6e6a87, gold: 0xf2c14e, goldL: 0xfff0a0, hp: 0x73b25a, hpLow: 0xec6a5e, bone: 0xd8d3e0, ult: 0x6f93e0, ultFull: 0xfff0a0, boss: 0xc0394b };
export const RARITY = { common: { col: 0xd8d3e0, label: 'COMMON' }, fine: { col: 0x6fd3a0, label: 'FINE' }, rare: { col: 0x6f93e0, label: 'RARE' }, unique: { col: 0xf2c14e, label: 'UNIQUE' }, legendary: { col: 0xff9a3c, label: 'LEGENDARY' } };

// Marker colours shared by the minimap and the world map.
export const MARK = { chest: 0xf2c14e, camp: 0xff7b2e, recruit: 0x8cff8c, door: 0xe7a6ff, npc: 0x6fd3a0, post: 0xc4cfe2, boss: 0xb24ce6, node: 0x4e9ad0, quest: 0xffffff };

export function panel(g, x, y, w, h, fill = C.night, edge = C.stone) {
  g.fillStyle(C.ink, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(edge, 1).fillRect(x, y, w, h);
  g.fillStyle(fill, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(0x000000, 0.25).fillRect(x + 1, y + h - 2, w - 2, 1);
}

export class UI extends Phaser.Scene {
  constructor() { super('UI'); }

  create({ game }) {
    this.g = game;
    this.dialogOpen = false;
    this.gfx = this.add.graphics();
    this.portraits = [];
    this.buttons = [];

    // combat cluster (bottom left): dodge, two skills, the leader's ultimate
    // combat grid (bottom left), all buttons the same size, each labelled:
    //   [ULT ]  [ALLY ULT] [ALLY ULT]
    //   [DODGE] [SKILL 1]  [SKILL 2]  [SKILL 3]
    const SZ = 26;
    this.skillBtns = [0, 1, 2].map((i) => this.makeButton('icon_bash', () => this.g.leaderSkill(i), `${i + 1}`, null, SZ, true));
    this.dodgeBtn = this.makeButton('icon_dodge', () => { const L = this.g.leader; L.dodge(...L.facingVec()); }, 'SPC', null, SZ, true);
    this.ultBtn = this.makeButton('icon_meteor', () => this.g.useUltimate(this.g.leader), 'Z', null, SZ, true);
    this.allyBtns = [0, 1].map((i) => this.makeButton('icon_meteor', () => { const a = this.allies()[i]; if (a) this.g.useUltimate(a); }, '', null, SZ, true));
    for (const b of [this.ultBtn, ...this.allyBtns, this.dodgeBtn, ...this.skillBtns]) b.lbl = this.add.bitmapText(0, 0, 'font', '').setOrigin(0.5, 0);
    this.dodgeBtn.lbl.setText('DODGE');
    this.arcG = this.add.graphics().setDepth(10); // recharge arcs drawn over the icons
    // touch devices don't need keyboard hints on the round buttons
    if (this.sys.game.device.input.touch) for (const b of [this.dodgeBtn, this.ultBtn, ...this.skillBtns]) { b.hideKey = true; b.key.setVisible(false); }
    this.bagBtn = this.makeButton('icon_bag', () => this.g.openMenu(), 'I');
    this.potBtn = this.makeButton('icon_potion', () => this.g.usePotion('potion'), 'H', null, 18);
    this.elxBtn = this.makeButton('icon_elixir', () => this.g.usePotion('elixir'), 'J', null, 18);
    this.potTxt = this.add.bitmapText(0, 0, 'font', '0');
    this.elxTxt = this.add.bitmapText(0, 0, 'font', '0');
    this.muteBtn = this.makeButton('icon_soundOn', () => this.g.toggleMute(), 'M', null, 14);
    this.dbgBtn = this.makeButton('icon_bug', () => this.toggleDebug(), '`', null, 14);

    // minimap (2px per tile window centred on the leader); tap for the world map
    this.MM = { w: 64, h: 44, s: 2 };
    this.mmFrame = this.add.graphics();
    this.mmImg = this.add.image(0, 0, 'minimap').setOrigin(0).setScale(this.MM.s);
    this.mmG = this.add.graphics();
    this.mmZone = this.add.zone(0, 0, this.MM.w, this.MM.h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.mmZone.on('pointerdown', () => { this.tapUI(); this.g.openMap(); });

    this.coin = this.add.sprite(0, 0, 'coin').play('coin').setOrigin(0);
    this.goldTxt = this.add.bitmapText(0, 0, 'fontGold', '0');

    this.hint = this.add.bitmapText(0, 0, 'font', 'TAP: MOVE / ATTACK / TALK   YOUR PORTRAIT: GEAR   OTHER PORTRAIT: SWITCH').setAlpha(0.85);
    this.time.delayedCall(16000, () => this.tweens.add({ targets: this.hint, alpha: 0, duration: 1200 }));

    this.bannerT = this.add.bitmapText(0, 0, 'fontGold', '').setOrigin(0.5).setScale(2).setAlpha(0);
    this.bannerS = this.add.bitmapText(0, 0, 'font', '').setOrigin(0.5).setAlpha(0);
    this.toast = this.add.bitmapText(0, 0, 'font', '').setOrigin(1, 0).setAlpha(0);

    // boss bar
    this.bossName = this.add.bitmapText(0, 0, 'fontGold', '').setOrigin(0.5).setVisible(false);
    this.boss = null;

    // loading overlay
    this.loadTxt = this.add.bitmapText(0, 0, 'fontGold', 'LOADING').setOrigin(0.5).setVisible(false);

    // dialogue
    this.dlg = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.dlgG = this.add.graphics();
    this.dlgPortrait = this.add.image(0, 0, 'portrait_frog').setOrigin(0).setScale(2);
    this.dlgName = this.add.bitmapText(0, 0, 'fontGold', '');
    this.dlgText = this.add.bitmapText(0, 0, 'font', '').setMaxWidth(200);
    this.dlgMore = this.add.bitmapText(0, 0, 'fontGold', '>');
    this.dlg.add([this.dlgG, this.dlgPortrait, this.dlgName, this.dlgText, this.dlgMore]);
    this.dlgCatch = this.add.zone(0, 0, 4000, 4000).setOrigin(0).setDepth(49).setInteractive();
    this.dlgCatch.on('pointerdown', () => { this.tapUI(); this.advanceDialog(); });
    this.dlgCatch.disableInteractive();
    this.tweens.add({ targets: this.dlgMore, alpha: 0.2, duration: 350, yoyo: true, repeat: -1 });

    this.choiceObjs = [];
    // errand tracker: one line under the minimap
    this.trackTitle = this.add.bitmapText(0, 0, 'fontGold', '').setOrigin(1, 0);
    this.trackTxt = this.add.bitmapText(0, 0, 'font', '').setOrigin(1, 0).setRightAlign();
    this.loot = this.add.container(0, 0).setVisible(false).setDepth(40);
    this.lootQueue = [];

    // debug overlay
    this.dbg = this.add.container(0, 0).setVisible(false).setDepth(60);
    this.dbgG = this.add.graphics();
    this.dbgTxt = this.add.bitmapText(0, 0, 'fontPlain', '').setLineSpacing(2);
    this.dbg.add([this.dbgG, this.dbgTxt]);
    this.speedDown = this.makeButton(null, () => this.g.setSpeed(this.g.speed - 0.05), '', 'SLOW', 22);
    this.speedUp = this.makeButton(null, () => this.g.setSpeed(this.g.speed + 0.05), '', 'FAST', 22);

    this.buildPortraits();
    game.events.on('banner', this.showBanner, this);
    game.events.on('dialogue', this.openDialog, this);
    game.events.on('loot', this.showLoot, this);
    game.events.on('keyItem', this.showKeyItem, this);
    game.events.on('partyChanged', this.buildPortraits, this);
    game.events.on('boss', (b) => { this.boss = b; this.bossName.setVisible(!!b).setText(b ? b.bossName || b.s?.name || 'BOSS' : ''); }, this);
    game.events.on('saved', () => { this.toast.setText('SAVED').setAlpha(1); this.tweens.killTweensOf(this.toast); this.tweens.add({ targets: this.toast, alpha: 0, delay: 900, duration: 500 }); }, this);
    game.events.on('loading', (on) => this.loadTxt.setVisible(on), this);
    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  allies() { return this.g.party.filter((h) => h !== this.g.leader); }

  tapUI() { this.registry.set('uiTap', true); audio.sfx('click'); }

  makeButton(icon, fn, key, label, size = 22, round = false) {
    const b = { size, round, icon: icon ? this.add.image(0, 0, icon) : null, key: this.add.bitmapText(0, 0, 'font', key), label: label ? this.add.bitmapText(0, 0, 'font', label).setOrigin(0.5) : null, visible: true };
    b.zone = this.add.zone(0, 0, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    b.zone.on('pointerdown', () => { if (!b.visible) return; this.tapUI(); if (this.dialogOpen) { this.advanceDialog(); return; } fn(); });
    this.buttons.push(b);
    return b;
  }

  placeButton(b) {
    b.zone.setPosition(b.x, b.y);
    b.icon?.setPosition(b.x + b.size / 2, b.y + b.size / 2);
    b.key.setPosition(b.round ? b.x + b.size - 6 : b.x + 1, b.round ? b.y + b.size - 6 : b.y + b.size + 2);
    b.label?.setPosition(b.x + b.size / 2, b.y + b.size / 2);
  }

  // Landscape: one compact row hugging the bottom edge, icons only. The
  // leader's own buttons sit in a thin gold outline tagged with their name;
  // the companions' ULTs sit apart in a grey one. Only visible buttons are
  // packed and framed (re-packed when a skill unlocks or the leader changes).
  packRow(L) {
    const lead = [this.ultBtn, this.dodgeBtn, ...this.skillBtns].filter((b) => b.visible);
    const allies = this.allyBtns.filter((b) => b.visible);
    const key = `${lead.length}|${allies.length}|${L.def.id}`;
    if (key === this.rowKey) return;
    this.rowKey = key;
    const step = this.ultBtn.size + 4, y = this.rowY, x0 = 8 + this.pad.l;
    lead.forEach((b, i) => { b.x = x0 + i * step; b.y = y; this.placeButton(b); });
    const ax = x0 + lead.length * step + 10;
    allies.forEach((b, i) => { b.x = ax + i * step; b.y = y; this.placeButton(b); });
    const g = this.grpG.clear();
    const frame = (bs, col, lbl, text) => {
      if (!bs.length) { lbl.setVisible(false); return; }
      const fx = bs[0].x - 3, fw = bs[bs.length - 1].x + bs[0].size + 3 - fx;
      g.lineStyle(1, col, 0.75).strokeRoundedRect(fx, y - 3, fw, bs[0].size + 6, 4);
      lbl.setText(text).setVisible(true);
      // the name sits on the frame's top edge
      g.fillStyle(C.ink, 0.85).fillRect(fx + 4, y - 7, lbl.width + 4, 7);
      lbl.setPosition(fx + 6, y - 7);
    };
    frame(lead, C.gold, this.groupLbl[0], L.def.name.toUpperCase());
    frame(allies, C.stone, this.groupLbl[1], 'ALLIES');
  }

  setButtonVisible(b, v) {
    b.visible = v;
    b.icon?.setVisible(v); b.key.setVisible(v && !b.hideKey); b.label?.setVisible(v);
    if (v) b.zone.setInteractive(); else b.zone.disableInteractive();
  }

  buildPortraits() {
    for (const p of this.portraits) { p.img.destroy(); p.hit.destroy(); p.lv.destroy(); p.nm.destroy(); }
    this.portraits = this.g.party.map((h) => {
      const img = this.add.image(0, 0, `${h.texKey}_portrait`).setOrigin(0);
      const hit = this.add.zone(0, 0, 70, 24).setOrigin(0).setInteractive({ useHandCursor: true });
      // tap the leader to open their gear menu; tap anyone else to switch to them
      hit.on('pointerdown', () => { this.tapUI(); if (h === this.g.leader) this.g.openMenu(); else if (!h.downed) this.g.setLeader(h); });
      const lv = this.add.bitmapText(0, 0, 'font', 'LV1');
      const nm = this.add.bitmapText(0, 0, 'font', h.def.name.toUpperCase());
      return { h, img, hit, lv, nm };
    });
    this.layout();
  }

  layout() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    // keep controls clear of notches, rounded corners and the home indicator
    const z = this.scale.zoom || 1;
    const si = window.__safeInsets ? window.__safeInsets() : { top: 0, right: 0, bottom: 0, left: 0 };
    const pad = { t: Math.ceil(si.top / z), r: Math.ceil(si.right / z), b: Math.ceil(si.bottom / z), l: Math.ceil(si.left / z) };
    if (pad.b > 0) pad.l = Math.max(pad.l, 8), pad.r = Math.max(pad.r, 8); // rounded screen corners
    this.pad = pad;
    const W = this.W - pad.r, H = this.H - pad.b;
    const L0 = pad.l, T0 = pad.t;
    this.portraits.forEach((p, i) => {
      const x = 6 + L0, y = 6 + T0 + i * 30;
      p.x = x; p.y = y;
      p.img.setPosition(x + 3, y + 3);
      p.hit.setPosition(x, y);
      p.nm.setPosition(x + 26, y + 1);
      p.lv.setPosition(x + 56, y + 1);
    });
    // combat controls. Landscape: one row along the bottom edge — the leader's
    // own group (ULT, DODGE, skills) framed in gold, the companions' ULTs apart
    // in a grey frame. Portrait: the two-row grid in the bottom-left corner.
    const colX = (c) => 6 + L0 + c * 38;
    const rowB = H - 40, rowT = rowB - 40;
    this.rowMode = this.W > this.H && W - L0 >= 380;
    this.grpG ??= this.add.graphics().setDepth(-1);
    this.grpG.clear();
    this.rowKey = null; // re-pack the landscape row on the next frame
    if (this.rowMode) {
      this.groupLbl ??= [this.add.bitmapText(0, 0, 'fontGold', ''), this.add.bitmapText(0, 0, 'font', 'ALLIES')];
      this.rowY = H - this.ultBtn.size - 5;
    } else {
      [[this.dodgeBtn, 0, rowB], [this.skillBtns[0], 1, rowB], [this.skillBtns[1], 2, rowB], [this.skillBtns[2], 3, rowB],
        [this.ultBtn, 0, rowT], [this.allyBtns[0], 1, rowT], [this.allyBtns[1], 2, rowT]].forEach(([b, c, y]) => { b.x = colX(c); b.y = y; });
      this.groupLbl?.forEach((t) => t.setVisible(false));
    }
    for (const b of [this.ultBtn, ...this.allyBtns, this.dodgeBtn, ...this.skillBtns]) b.lbl.setPosition(b.x + b.size / 2, b.y + b.size + 2);
    // icons only in the landscape row (keyboard hints are already hidden on touch screens)
    for (const b of [this.ultBtn, ...this.allyBtns, this.dodgeBtn, ...this.skillBtns]) b.lbl.setVisible(!this.rowMode);
    // utility, bottom right: bag + flasks
    this.bagBtn.x = W - 30; this.bagBtn.y = H - 30;
    this.muteBtn.x = W - 22; this.muteBtn.y = 6 + T0;
    this.potBtn.x = W - 54; this.potBtn.y = H - 26;
    this.elxBtn.x = W - 76; this.elxBtn.y = H - 26;
    this.potTxt.setPosition(this.potBtn.x + 12, this.potBtn.y + 11);
    this.elxTxt.setPosition(this.elxBtn.x + 12, this.elxBtn.y + 11);
    this.dbgBtn.x = W - 40; this.dbgBtn.y = 6 + T0;
    this.speedDown.x = 8; this.speedDown.y = H - 100;
    this.speedUp.x = 34; this.speedUp.y = H - 100;
    for (const b of this.buttons) this.placeButton(b);
    this.mmX = W - this.MM.w - 6; this.mmY = 24 + T0;
    this.mmZone.setPosition(this.mmX, this.mmY);
    this.mmFrame.clear();
    panel(this.mmFrame, this.mmX - 1, this.mmY - 1, this.MM.w + 2, this.MM.h + 2, 0x2b2140, 0x6e6a87);
    this.coin.setPosition(W - 84, 8 + T0);
    this.goldTxt.setPosition(W - 74, 9 + T0);
    this.toast.setPosition(W - 8, 72);
    const tw = Math.max(this.MM.w + 30, Math.min(160, W - 100));
    this.trackTitle.setPosition(W - 6, this.mmY + this.MM.h + 4);
    this.trackTxt.setPosition(W - 6, this.mmY + this.MM.h + 13).setMaxWidth(tw);
    this.hint.setPosition(162 + L0, H - 9).setMaxWidth(Math.max(40, W - 250));
    if (W < 360 || this.rowMode) this.hint.setVisible(false); // no room beside the combat controls
    // portrait: drop banners below the hero portraits
    this.bannerY = W < 300 ? 112 + T0 : 40;
    this.bannerT.setPosition(W / 2, this.bannerY);
    this.bannerS.setPosition(W / 2, this.bannerY + 16);
    this.bossName.setPosition(W / 2, 12);
    this.loadTxt.setPosition(W / 2, H / 2);
    this.setButtonVisible(this.speedDown, this.dbg.visible);
    this.setButtonVisible(this.speedUp, this.dbg.visible);
  }

  toggleDebug() {
    this.dbg.setVisible(!this.dbg.visible);
    this.layout();
  }

  showBanner(title, sub) {
    // big title at 2x when it fits, otherwise 1x; the subtitle wraps to two lines
    this.bannerT.setScale(2).setText(title);
    if (this.bannerT.width > this.W - 8) this.bannerT.setScale(1).setText(fitString(title, this.W - 8));
    this.bannerS.setText(fitString(sub || '', this.W - 12, 2)).setCenterAlign();
    this.tweens.killTweensOf([this.bannerT, this.bannerS]);
    const by = this.bannerY ?? 40;
    this.bannerT.setAlpha(0).setY(by - 6); this.bannerS.setAlpha(0).setY(by + (this.bannerT.scaleX > 1 ? 16 : 11));
    this.tweens.add({ targets: this.bannerT, alpha: 1, y: by, duration: 400 });
    this.tweens.add({ targets: this.bannerS, alpha: 1, duration: 400, delay: 200 });
    this.tweens.add({ targets: [this.bannerT, this.bannerS], alpha: 0, duration: 600, delay: 3200 });
  }

  // Key item card: the game is paused behind it until it's tapped away.
  showKeyItem(def, onClose) {
    const W = this.W, H = this.H;
    const w = Math.min(220, W - 16), h = 128, x = Math.round((W - w) / 2), y = Math.round(H * 0.32 - h / 2);
    const box = this.add.container(0, 0).setDepth(80);
    const dim = this.add.rectangle(0, 0, W, H, 0x0a0710, 0.6).setOrigin(0);
    const g = this.add.graphics();
    panel(g, x, y, w, h, C.night, C.gold);
    g.fillStyle(C.ink).fillRect(Math.round(W / 2) - 26, y + 18, 52, 46);
    const head = this.add.bitmapText(Math.round(W / 2), y + 7, 'fontPlain', 'KEY ITEM ACQUIRED').setOrigin(0.5, 0).setTint(0xf2c14e);
    const icon = this.add.image(Math.round(W / 2), y + 41, def.icon).setScale(3);
    const name = this.add.bitmapText(Math.round(W / 2), y + 70, 'fontGold', def.name).setOrigin(0.5, 0).setScale(2);
    if (name.width > w - 10) name.setScale(1);
    const desc = this.add.bitmapText(Math.round(W / 2), y + 86, 'font', fitString(def.text, w - 14, 2)).setOrigin(0.5, 0).setCenterAlign();
    const tap = this.add.bitmapText(Math.round(W / 2), y + h - 13, 'fontPlain', 'TAP TO CONTINUE').setOrigin(0.5, 0).setTint(0x9d93b3).setAlpha(0);
    box.add([dim, g, head, icon, name, desc, tap]);
    box.setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, duration: 250 });
    this.tweens.add({ targets: icon, scale: 3.4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // swallow taps; ignore them for a moment so a tap already in flight doesn't dismiss it
    const zone = this.add.zone(0, 0, 4000, 4000).setOrigin(0).setDepth(81).setInteractive();
    let ready = false;
    this.time.delayedCall(700, () => { ready = true; this.tweens.add({ targets: tap, alpha: 1, duration: 300, yoyo: true, repeat: -1, hold: 400 }); });
    const close = () => {
      if (!ready) return;
      ready = false;
      this.tapUI?.();
      zone.destroy();
      this.input.keyboard?.off('keydown', close);
      this.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => { this.tweens.killTweensOf([icon, tap]); box.destroy(true); onClose?.(); } });
    };
    zone.on('pointerdown', close);
    this.input.keyboard?.on('keydown', close);
  }

  // Loot popup: one card per item, queued.
  showLoot({ ids, gold }) {
    ids.forEach((id, i) => this.lootQueue.push({ id, gold: i === 0 ? gold : 0 }));
    if (!this.lootBusy) this.nextLoot();
  }

  nextLoot() {
    const n = this.lootQueue.shift();
    if (!n) { this.lootBusy = false; return; }
    this.lootBusy = true;
    const it = items[n.id];
    const r = RARITY[it.rarity];
    this.loot.removeAll(true);
    if (this.g.combatHold > 0) { this.smallLoot(n, it, r); return; }
    const W = this.W, w = Math.min(184, W - 12), h = 54, x = Math.round((W - w) / 2), y = 66;
    const g = this.add.graphics();
    panel(g, x, y, w, h, C.night, r.col);
    g.fillStyle(C.ink).fillRect(x + 6, y + 9, 36, 36);
    this.loot.add(g);
    this.loot.add(this.add.image(x + 8, y + 11, itemTex(this, n.id)).setOrigin(0).setScale(2));
    this.loot.add(this.add.bitmapText(x + 48, y + 7, 'font', 'FOUND!'));
    this.loot.add(this.add.bitmapText(x + 48, y + 17, 'fontGold', fitString(it.name, w - 52)).setTint(it.rarity === 'unique' ? 0xffffff : r.col));
    this.loot.add(this.add.bitmapText(x + 48, y + 27, 'fontPlain', `${r.label} ${it.slot === 'trinket' ? 'RING' : it.slot.toUpperCase()} - ${it.hero ? it.hero.toUpperCase() : 'ANY HERO'}`).setTint(r.col));
    const st = Object.entries(it.stats).map(([k, v]) => (k === 'crit' || k === 'cdr' ? `+${Math.round(v * 100)}% ${k === 'cdr' ? 'CDR' : 'CRIT'}` : `+${v} ${k.toUpperCase()}`)).join('  ') + (it.element ? `  ${it.element.toUpperCase()}` : '') + (it.passive ? '  ECHO' : '') + (it.trait ? `  ${TRAITS[it.trait].name}` : '');
    this.loot.add(this.add.bitmapText(x + 48, y + 37, 'fontPlain', fitString(st + (n.gold ? `   +${n.gold} GOLD` : ''), w - 52)));
    this.loot.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.loot, alpha: 1, duration: 200 });
    this.tweens.add({ targets: this.loot, alpha: 0, duration: 300, delay: 2300, onComplete: () => { this.loot.setVisible(false); this.nextLoot(); } });
  }

  // Mid-fight pickups: a small line on the right under the minimap, no card
  // over the action. Stacks if several drop at once.
  smallLoot(n, it, r) {
    const right = this.W - 6 - (this.pad?.r || 0);
    const y = this.mmY + this.MM.h + 26 + (this.smallLootN || 0) * 12;
    this.smallLootN = (this.smallLootN || 0) + 1;
    const img = this.add.image(right, y, itemTex(this, n.id)).setOrigin(1, 0.5).setScale(0.75).setDepth(40);
    // outlined white text (like the LV labels) so it reads over any ground
    const t = this.add.bitmapText(right - 14, y - 3, 'font', fitString(`+ ${it.name}`, Math.min(130, this.W - 120))).setOrigin(1, 0).setDepth(40);
    const objs = [img, t];
    for (const o of objs) o.setAlpha(0);
    this.tweens.add({ targets: objs, alpha: 1, duration: 150 });
    this.tweens.add({ targets: objs, alpha: 0, delay: 1800, duration: 300, onComplete: () => { for (const o of objs) o.destroy(); this.smallLootN = Math.max(0, this.smallLootN - 1); } });
    this.time.delayedCall(250, () => this.nextLoot());
  }

  // ---------------------------------------------------------- dialogue
  // Dialogue never opens over a fight: it waits until combat ends.
  openDialog(lines, onDone) {
    if (this.g.combatHold > 0) { this.pendingDialog = [lines, onDone]; return; }
    this.pendingDialog = null;
    this.lines = lines;
    this.lineI = 0;
    this.onDone = onDone;
    this.dialogOpen = true;
    this.dlg.setVisible(true);
    this.dlgCatch.setInteractive();
    this.showLine();
  }

  showLine() {
    const L = this.lines[this.lineI];
    const W = this.W, H = this.H;
    const w = Math.min(W - 16, 300), h = 50, x = Math.round((W - w) / 2), y = H - h - 40;
    this.dlgG.clear();
    panel(this.dlgG, x, y, w, h, C.night, C.stone);
    const hasP = !!L.portrait;
    if (hasP) this.dlgG.fillStyle(C.ink).fillRect(x + 5, y + 7, 36, 36);
    this.dlgPortrait.setVisible(hasP).setPosition(x + 7, y + 9);
    if (hasP) this.dlgPortrait.setTexture(L.portrait);
    const tx = hasP ? x + 48 : x + 8;
    this.dlgName.setText(L.who).setPosition(tx, y + 6);
    this.dlgText.setPosition(tx, y + 16).setMaxWidth(w - (tx - x) - 8).setText('');
    this.dlgMore.setPosition(x + w - 10, y + h - 10).setVisible(false);
    this.clearChoices();
    this.dlgBox = { x, y, w, h };
    this.full = L.text;
    this.shown = 0;
    this.typing = true;
    this.voice = L.voice || { pitch: 240, wave: 'square', duty: 0.25 };
    this.typeEv?.remove();
    this.typeEv = this.time.addEvent({ delay: 28, loop: true, callback: () => {
      this.shown++;
      this.dlgText.setText(this.full.slice(0, this.shown));
      const ch = this.full[this.shown - 1];
      if (this.shown % 2 === 0 && ch !== ' ') audio.sfx('blip', { voice: this.voice });
      if (this.shown >= this.full.length) this.finishLine();
    } });
  }

  finishLine() {
    this.typing = false;
    this.typeEv?.remove();
    this.dlgText.setText(this.full);
    const L = this.lines[this.lineI];
    if (L.choices) { this.showChoices(L.choices); return; }
    this.dlgMore.setVisible(true);
  }

  // Two-button choice under the dialogue box (accept / not now).
  showChoices(choices) {
    this.choosing = true;
    const { x, y, w, h } = this.dlgBox;
    let bx = x + w;
    [...choices].reverse().forEach(([label, fn], i) => {
      const bw = label.length * 5 + 12;
      bx -= bw + 4;
      const by = y + h + 3;
      const g = this.add.graphics().setDepth(51);
      panel(g, bx, by, bw, 15, i === choices.length - 1 ? 0x2f5d3a : C.night, i === choices.length - 1 ? 0x8cff8c : C.stone);
      const t = this.add.bitmapText(bx + 6, by + 5, i === choices.length - 1 ? 'fontGold' : 'font', label).setDepth(52);
      const z = this.add.zone(bx, by - 2, bw, 19).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(53);
      z.on('pointerdown', () => {
        this.tapUI();
        this.clearChoices();
        this.dialogOpen = false;
        this.dlgCatch?.disableInteractive();
        this.dlg.setVisible(false);
        this.onDone = null;
        fn();
      });
      this.choiceObjs.push(g, t, z);
    });
  }

  clearChoices() { for (const o of this.choiceObjs) o.destroy(); this.choiceObjs = []; this.choosing = false; }

  advanceDialog() {
    if (!this.dialogOpen || this.choosing) return;
    if (this.typing) { this.finishLine(); return; }
    this.lineI++;
    if (this.lineI >= this.lines.length) {
      this.dialogOpen = false;
      this.dlgCatch?.disableInteractive();
      this.dlg.setVisible(false);
      const cb = this.onDone; this.onDone = null;
      cb?.();
      return;
    }
    audio.sfx('click');
    this.showLine();
  }

  // A fight starting closes the open dialogue; it comes back (from the line
  // you were on) once things are quiet again.
  checkDialogCombat() {
    const fighting = this.g.combatHold > 0;
    if (fighting && this.dialogOpen) {
      this.pendingDialog = [this.lines.slice(this.lineI), this.onDone];
      this.typeEv?.remove();
      this.clearChoices();
      this.dialogOpen = false;
      this.dlgCatch?.disableInteractive();
      this.dlg.setVisible(false);
      this.onDone = null;
    } else if (!fighting && !this.dialogOpen && this.pendingDialog && !this.g.busy) {
      const [lines, done] = this.pendingDialog;
      this.pendingDialog = null;
      if (lines.length) this.openDialog(lines, done);
    }
  }

  // ---------------------------------------------------------- per frame
  update(time) {
    this.checkDialogCombat();
    const g = this.gfx;
    const game = this.g;
    g.clear();
    this.arcG.clear();
    // gold dot on the bag button while there's unseen gear
    const b = this.bagBtn;
    if (b?.visible && b.x != null && game.party.some((h) => freshFor(game.state, h.def.id).length)) {
      const blink = Math.floor(time / 450) % 2;
      this.arcG.fillStyle(0x1a1423).fillCircle(b.x + b.size - 3, b.y + 3, 4).fillStyle(blink ? 0xfff0a0 : 0xf2c14e).fillCircle(b.x + b.size - 3, b.y + 3, 3);
    }
    for (const p of this.portraits) {
      const h = p.h;
      const lead = h === game.leader;
      const ready = h.ult >= 100 && !h.downed;
      panel(g, p.x, p.y, 22, 22, C.ink, lead ? C.gold : ready ? 0xb89a4a : C.slate);
      if (p.img.texture.key !== `${h.texKey}_portrait` && this.textures.exists(`${h.texKey}_portrait`)) p.img.setTexture(`${h.texKey}_portrait`);
      p.img.setAlpha(h.downed ? 0.35 : 1);
      const frac = Math.max(0, h.hp / h.maxHp);
      g.fillStyle(C.ink).fillRect(p.x + 25, p.y + 8, 42, 5);
      g.fillStyle(0x3a2f52).fillRect(p.x + 26, p.y + 9, 40, 3);
      g.fillStyle(frac < 0.35 ? C.hpLow : C.hp).fillRect(p.x + 26, p.y + 9, Math.round(40 * frac), 3);
      if (h.shield > 0) g.fillStyle(C.ult).fillRect(p.x + 26, p.y + 9, Math.round(40 * Math.min(1, h.shield / h.maxHp)), 1);
      // ultimate meter
      g.fillStyle(C.ink).fillRect(p.x + 25, p.y + 14, 42, 4);
      g.fillStyle(0x2b2140).fillRect(p.x + 26, p.y + 15, 40, 2);
      g.fillStyle(ready ? C.ultFull : C.ult).fillRect(p.x + 26, p.y + 15, Math.round(40 * h.ult / 100), 2);
      p.lv.setText(h.downed ? 'DOWN' : ready ? 'ULT!' : `LV${h.level}`).setTint(h.downed ? 0xec6a5e : ready ? 0xfff0a0 : 0xffffff);
      p.nm.setTint(lead ? C.goldL : 0xffffff);
    }
    const tq = game.quests, tid = tq?.state.tracked, tstep = tid && tq.step(tid);
    this.trackTitle.setText(tstep ? tq.title(tid) : '');
    this.trackTxt.setText(tstep ? tq.stepText(tid) : '');
    const L = game.leader;

    this.skillBtns.forEach((b, i) => {
      const s = L.skills[i];
      this.setButtonVisible(b, !!s);
      b.lbl.setVisible(!!s && !this.rowMode);
      if (!s) return;
      if (this.textures.exists(s.icon)) b.icon.setTexture(s.icon);
      b.lbl.setText(s.short || s.name);
      this.drawBtn(g, b, s.t / s.cd);
    });
    this.drawBtn(g, this.dodgeBtn, L.dodgeCd / 0.55);
    // ultimate: its own icon, a slow clockwise recharge sweep, gold pulse when ready
    const u = L.ultimate;
    this.ultBtn.icon.setTexture(u.icon || 'icon_meteor');
    const ready = L.ult >= 100 && !L.downed;
    // ready: a slow, soft breathe between two close golds (no blinking)
    const breathe = 0.5 + 0.5 * Math.sin(time / 650);
    const gold = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xc89b3c), Phaser.Display.Color.ValueToColor(0xf2c14e), 1, breathe);
    this.drawBtn(g, this.ultBtn, 1 - L.ult / 100, ready ? Phaser.Display.Color.GetColor(gold.r, gold.g, gold.b) : 0x6e6a87, 0x6fd3ff);
    this.ultBtn.lbl.setText(u.short || u.name).setTint(ready ? 0xfff0a0 : 0xffffff);
    // companions' ultimates: the AI fires them on its own, these let you fire them yourself
    const al = this.allies();
    this.allyBtns.forEach((b, i) => {
      const a = al[i];
      this.setButtonVisible(b, !!a);
      b.lbl.setVisible(!!a && !this.rowMode);
      if (!a) return;
      const r = a.ult >= 100 && !a.downed;
      b.icon.setTexture(a.ultimate.icon || 'icon_meteor');
      b.lbl.setText(a.def.name.toUpperCase()).setTint(a.downed ? 0xec6a5e : r ? 0xfff0a0 : 0xffffff);
      this.drawBtn(g, b, a.downed ? 1 : 1 - a.ult / 100, r ? Phaser.Display.Color.GetColor(gold.r, gold.g, gold.b) : 0x6e6a87, 0x6fd3ff);
    });
    if (this.rowMode) this.packRow(L);
    this.drawBtn(g, this.bagBtn, 0);
    this.drawBtn(g, this.potBtn, 0); this.drawBtn(g, this.elxBtn, 0);
    this.potTxt.setText(`${game.state.potions.potion || 0}`).setTint(game.state.potions.potion ? 0xffffff : 0x777777);
    this.elxTxt.setText(`${game.state.potions.elixir || 0}`).setTint(game.state.potions.elixir ? 0xffffff : 0x777777);
    this.muteBtn.icon.setTexture(audio.muted ? 'icon_soundOff' : 'icon_soundOn');
    this.drawBtn(g, this.muteBtn, 0);
    this.drawBtn(g, this.dbgBtn, 0);
    this.goldTxt.setText(`${game.state.gold}`);
    this.drawMinimap(time);

    // boss bar
    if (this.boss && this.boss.alive) {
      const w = Math.min(220, this.W - 160), x = Math.round((this.W - w) / 2), y = 18;
      g.fillStyle(C.ink).fillRect(x - 1, y - 1, w + 2, 7);
      g.fillStyle(0x3a2f52).fillRect(x, y, w, 5);
      g.fillStyle(C.boss).fillRect(x, y, Math.round(w * Math.max(0, this.boss.hp / this.boss.maxHp)), 5);
      for (const f of [0.6, 0.3]) g.fillStyle(C.ink).fillRect(x + Math.round(w * f), y, 1, 5);
    } else if (this.boss && !this.boss.alive) { this.boss = null; this.bossName.setVisible(false); }

    if (this.loadTxt.visible) this.loadTxt.setText('LOADING' + '.'.repeat(Math.floor(time / 300) % 4));

    if (this.dbg.visible) {
      const lines = game.debugInfo();
      this.dbgTxt.setText(lines.join('\n')).setPosition(10, this.H - 96 - lines.length * 8 - 18);
      this.dbgG.clear().fillStyle(0x000000, 0.6).fillRect(6, this.dbgTxt.y - 4, Math.max(170, this.dbgTxt.width + 8), lines.length * 8 + 6);
      this.drawBtn(g, this.speedDown, 0); this.drawBtn(g, this.speedUp, 0);
    }
  }

  drawMinimap(time) {
    const { w, h, s } = this.MM;
    const L = this.g.leader;
    const tw = w / s, th = h / s;
    const ltx = L.x / 16, lty = L.y / 16;
    const a = this.g.areaRect();
    const cx = Phaser.Math.Clamp(ltx - tw / 2, a.x0, Math.max(a.x0, a.x1 + 1 - tw)), cy = Phaser.Math.Clamp(lty - th / 2, a.y0, Math.max(a.y0, a.y1 + 1 - th));
    const ox = Math.floor(cx), oy = Math.floor(cy);
    this.mmImg.setCrop(ox, oy, tw, th).setPosition(this.mmX - ox * s, this.mmY - oy * s);
    const g = this.mmG.clear();
    for (const m of this.g.mapMarkers()) {
      let x = (m.x - ox) * s, y = (m.y - oy) * s;
      if (m.kind === 'quest') {
        // errand pin: clamps to the minimap edge so it points the way
        x = Phaser.Math.Clamp(x, 1, w - 3); y = Phaser.Math.Clamp(y, 1, h - 3);
        g.fillStyle(0x1a1423).fillRect(this.mmX + x - 1, this.mmY + y - 1, 4, 4);
        g.fillStyle(0xffffff).fillRect(this.mmX + x, this.mmY + y, 2, 2);
        continue;
      }
      if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) continue;
      g.fillStyle(MARK[m.kind]).fillRect(this.mmX + x, this.mmY + y, 2, 2);
    }
    for (const e of this.g.enemies) {
      if (!e.alive || !e.engaged) continue;
      const x = (e.x / 16 - ox) * s, y = (e.y / 16 - oy) * s;
      if (x >= 0 && y >= 0 && x < w - 1 && y < h - 1) g.fillStyle(0xec6a5e).fillRect(this.mmX + Math.round(x), this.mmY + Math.round(y), 1, 1);
    }
    for (const p of this.g.party) {
      if (p === L) continue;
      g.fillStyle(0xd8d3e0).fillRect(this.mmX + Math.round((p.x / 16 - ox) * s), this.mmY + Math.round((p.y / 16 - oy) * s), 1, 1);
    }
    const lx = this.mmX + Math.round((ltx - ox) * s), ly = this.mmY + Math.round((lty - oy) * s);
    g.fillStyle(Math.floor(time / 300) % 2 ? 0xffffff : 0xfff0a0).fillRect(lx - 1, ly - 1, 3, 3);
    g.fillStyle(0x1a1423).fillRect(lx, ly, 1, 1);
  }

  drawBtn(g, b, cd, ring = 0x6e6a87, arc = 0x8cff8c) {
    if (!b.visible) return;
    if (b.round) {
      const r = b.size / 2, cx = b.x + r, cy = b.y + r;
      g.fillStyle(C.ink, 1).fillCircle(cx, cy, r + 1);
      g.fillStyle(ring, 1).fillCircle(cx, cy, r);
      g.fillStyle(C.night, 1).fillCircle(cx, cy, r - 1.5);
      const charging = cd > 0.001;
      b.icon?.setAlpha(charging ? 0.4 : 1);
      if (charging) {
        // remaining cooldown as a dark pie, plus a bright rim arc that fills clockwise
        const f = 1 - Math.min(1, cd);
        const a0 = -Math.PI / 2 + f * Math.PI * 2;
        g.fillStyle(C.ink, 0.6).slice(cx, cy, r - 1.5, a0, Math.PI * 1.5, false).fillPath();
        if (f > 0.01) this.arcG.lineStyle(2, arc, 1).beginPath().arc(cx, cy, r - 0.5, -Math.PI / 2, a0, false).strokePath();
      }
      this.children.sendToBack(g);
      return;
    }
    panel(g, b.x, b.y, b.size, b.size, C.night, C.stone);
    if (cd > 0) {
      const h = Math.round((b.size - 2) * Math.min(1, cd));
      g.fillStyle(C.ink, 0.7).fillRect(b.x + 1, b.y + b.size - 1 - h, b.size - 2, h);
    }
    this.children.sendToBack(g);
  }
}
