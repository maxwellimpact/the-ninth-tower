// Errands: small opt-in quests from townsfolk and the rumour board (DESIGN
// C10). Data lives in quests.json; progress is saved as
//   state.quests[id] = { s: stepIndex, n: counter, done }  and state.tracked.
// Step types: talk, kill, gather, spawn (fight at a spot), find (interact with
// something placed in the world), escort (protect a cart), bells (ring in
// order), defend (keep an NPC alive until the attackers are gone).
import Q from '../data/quests.json';
import W from '../data/world.json';
import items from '../data/items.json';
import { RACE_BET } from '../scenes/FrogRace.js';
import { audio } from '../audio/synth.js';
import { makeItem, tierForLevel } from './itemgen.js';
import { addMats, addPotions, CRAFT, gainItems } from './state.js';
import { makeStage } from './setpiece.js';

const TILE = 16;
const px = (t) => t * TILE + 8;
export const ERRANDS = Q.errands;

export class QuestManager {
  constructor(scene) {
    this.sc = scene;
    const st = scene.state;
    st.quests ??= {};
    st.tracked ??= null;
    this.npcs = [];
    this.live = {}; // runtime objects per active errand step
    this.staged = {}; // errand id -> set-piece enemies waiting for you to step in
    for (const n of Q.npcs) this.addNpc(n);
    // chance-meeting errands can also be (re)taken by talking to their giver
    for (const [id, e] of Object.entries(ERRANDS)) {
      const g = e.trigger && this.npcs.find((n) => n.id === e.giver);
      if (g && !(g.errands ||= []).includes(id)) g.errands.push(id);
    }
    for (const id of Object.keys(st.quests)) if (!st.quests[id].done) this.enterStep(id);
  }

  get state() { return this.sc.state; }
  q(id) { return this.state.quests[id]; }
  step(id) { const q = this.q(id); return q && !q.done ? ERRANDS[id].steps[q.s] : null; }
  active() { return Object.keys(this.state.quests).filter((id) => !this.q(id).done); }

  // ------------------------------------------------------------------ NPCs
  addNpc(n) {
    const sc = this.sc;
    const npc = { ...n, px: px(n.x), py: px(n.y) };
    if (n.look === 'board') {
      npc.s = sc.add.image(npc.px, npc.py + 6, 'board').setOrigin(0.5, 1).setDepth(npc.py);
      sc.nav.block(n.x, n.y);
    } else if (n.look === 'wisplight') {
      // a friendly light in the gloom: the wisp, washed ghost-green
      npc.s = sc.add.sprite(npc.px, npc.py - 26, 'wisp', 'idle_0').play('wisp_idle').setTint(0x9ff2c8).setDepth(100000 - 50);
      npc.flying = true;
    } else if (n.look === 'hawk') {
      npc.s = sc.add.sprite(npc.px, npc.py - 30, 'hawk', '0').play('hawk').setDepth(100000 - 50);
      npc.flying = true;
    } else {
      npc.s = sc.add.sprite(npc.px, npc.py, n.look, 'idle_down_0').setOrigin(0.5, 0.75).play(`${n.look}_idle_down`).setDepth(npc.py);
      if (n.ghost) npc.s.setTint(0x9fd8ff).setAlpha(0.65);
      npc.shadow = sc.add.image(npc.px + 1, npc.py + 1, 'shadow').setAlpha(n.ghost ? 0.08 : 0.2).setDepth(-4);
    }
    npc.mark = sc.add.image(npc.px, npc.py - 30, 'markQ').setDepth(100000 - 40).setVisible(false);
    sc.tweens.add({ targets: npc.mark, y: npc.py - 33, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    npc.o = sc.addInteractable({ x: npc.px, y: npc.py, reach: 34, standOff: 24, h: 24, kind: 'npc', interact: () => this.talk(npc) });
    if (n.hidden || (n.requires && !this.sc.flags[n.requires]) || (n.wards && this.brokenWards() < n.wards) || (n.recruitOf && this.state.recruited.includes(n.recruitOf))) this.setNpcVisible(npc, false);
    if (n.service === 'smith') npc.forge = this.sc.add.image(npc.px + 18, npc.py + 6, 'forge').setOrigin(0.5, 1).setDepth(npc.py).setVisible(!npc.hiddenNow);
    this.npcs.push(npc);
  }

  npc(id) { return this.npcs.find((n) => n.id === id); }

  setNpcVisible(npc, v) {
    npc.s.setVisible(v); npc.shadow?.setVisible(v); npc.forge?.setVisible(v);
    npc.o.hidden = !v;
    npc.hiddenNow = !v;
  }

  // errand this NPC can offer right now
  offerFor(npc) {
    return (npc.errands || []).find((id) => {
      const e = ERRANDS[id];
      if (e.reward?.recruit && this.state.recruited.includes(e.reward.recruit)) return false; // they've already joined
      if (e.wards && this.brokenWards() < e.wards) return false; // e.g. Gizmo's mill: after two Ward Stones
      return !this.q(id) && (!e.requires || this.q(e.requires)?.done);
    });
  }

  brokenWards() { return W.wards.filter((w) => this.sc.flags[w.flag]).length; }

  // an active step that wants to talk to this NPC
  turnInFor(npc) { return this.active().find((id) => { const s = this.step(id); return s?.type === 'talk' && s.npc === npc.id; }); }

  line(npc, text) { return { who: npc.name, voice: npc.voice, text }; }

  talk(npc) {
    const sc = this.sc;
    const L = sc.leader;
    L.face(npc.px - L.x, npc.py - L.y);
    const tid = this.turnInFor(npc);
    if (tid) { this.advance(tid, npc); return; }
    const oid = this.offerFor(npc);
    if (oid) { this.offer(oid, npc); return; }
    if (npc.trainer) { sc.trainerTalk(npc); return; }
    if (npc.vendor) { this.vendorTalk(npc); return; }
    if (npc.minigame) {
      // a game host: their pitch the first time, then straight to the offer
      const lines = (npc.metHost ? npc.lines.slice(-1) : npc.lines).map((t) => this.line(npc, t));
      npc.metHost = true;
      lines[lines.length - 1].choices = [[`RACE (${RACE_BET}G)`, () => sc.openOverlay(npc.minigame)], ['NOT NOW', () => {}]];
      sc.events.emit('dialogue', lines);
      return;
    }
    if (npc.service) {
      // Brightwater services open the matching crafting screen
      const lines = npc.lines.map((t) => this.line(npc, t));
      sc.events.emit('dialogue', lines.slice(npc.met ? lines.length - 1 : 0), () => { npc.met = true; sc.openMenu({ tab: 'craft', craftTab: npc.service === 'smith' ? 'upgrade' : 'gems' }); });
      return;
    }
    // an errand of theirs is in progress: remind; otherwise small talk
    const doing = (npc.errands || []).find((id) => this.q(id) && !this.q(id).done);
    const text = doing ? `${ERRANDS[doing].title}: ${this.step(doing).text}.` : npc.lines[Math.floor(Math.random() * npc.lines.length)];
    sc.events.emit('dialogue', [this.line(npc, text)]);
  }

  // A one-item seller (Emberwatch's quartermaster: Ember Salve). The first
  // visit comes with a couple free, so the heat never strands a new arrival.
  vendorTalk(npc) {
    const sc = this.sc, st = this.state, v = npc.vendor;
    const name = CRAFT.consumables[v.item]?.name || v.item.toUpperCase();
    const giftKey = `gift_${npc.id}`;
    if (v.gift && !sc.flags[giftKey]) {
      sc.flags[giftKey] = true;
      addPotions(st, { [v.item]: v.gift });
      sc.events.emit('dialogue', [this.line(npc, v.giftLine || `FIRST TIME? TAKE ${v.gift}. YOU'LL WANT MORE.`)], () => sc.events.emit('party'));
      sc.autosave('vendor');
      return;
    }
    const lines = [this.line(npc, npc.lines[Math.floor(Math.random() * npc.lines.length)])];
    lines[0].choices = [[`BUY ${name} (${v.price}G)`, () => {
      if (st.gold < v.price) { sc.events.emit('dialogue', [this.line(npc, "THAT'S NOT ENOUGH COIN, FRIEND.")]); return; }
      st.gold -= v.price; addPotions(st, { [v.item]: 1 });
      audio.sfx('coin'); sc.events.emit('party'); sc.autosave('vendor');
      sc.floatText(sc.leader.x, sc.leader.y - 30, `+1 ${name}`, 'fontGold');
    }], ['NOT NOW', () => {}]];
    sc.events.emit('dialogue', lines);
  }

  offer(id, npc) {
    const e = ERRANDS[id];
    const lines = e.offer.map((t) => this.line(npc, t));
    lines[lines.length - 1].choices = [[e.accept, () => this.start(id)], ['NOT NOW', () => {}]];
    this.sc.events.emit('dialogue', lines);
  }

  start(id) {
    this.state.quests[id] = { s: 0, n: 0, done: false };
    this.state.tracked = id;
    audio.sfx('equip');
    this.sc.events.emit('banner', 'ERRAND ACCEPTED', ERRANDS[id].title);
    this.enterStep(id);
    // taking a defend errand is stepping in: the raiders turn on you
    if (this.step(id)?.type === 'defend') this.engageStaged(id, this.sc.leader);
    this.sc.autosave('errand');
  }

  // Defend errands are a set piece: from the moment you meet the giver, the
  // raiders are there swinging at them for show (no damage, no fail state).
  // They only fight once you accept, or once you hit one first. How they act
  // meanwhile is the step's "stage" (see setpiece.js).
  stageAmbush(id, wake = false) {
    const e = ERRANDS[id], s = e.steps[0], sc = this.sc;
    if (this.staged[id]?.some((u) => u.alive)) return this.staged[id];
    const npc = this.npc(s.npc);
    if (!npc) return [];
    if (npc.hiddenNow) this.setNpcVisible(npc, true);
    const units = s.units.map(([k, x, y]) => {
      const u = sc.spawnEnemy(k, px(x), px(y), false);
      u.questSpawn = id;
      return u;
    });
    // one shared stage per group: posts around the victim, turn-taking swings
    const group = makeStage(npc, units, s.stage);
    for (const u of units) u.staged = { id, npc, wake, group };
    this.staged[id] = units;
    return units;
  }

  // Set pieces keep their stage clear: while the errand is unfinished, world
  // groups based within its radius (stage.clear, tiles) stay away, so nobody
  // wanders into the scene or gets mistaken for one of its actors.
  quietZones() {
    return Object.entries(ERRANDS).filter(([id, e]) => e.steps[0].type === 'defend' && !this.q(id)?.done).map(([, e]) => {
      const n = this.npc(e.steps[0].npc);
      return n && { x: n.px, y: n.py, r: (e.steps[0].stage?.clear ?? 10) * TILE };
    }).filter(Boolean);
  }

  engageStaged(id, h) {
    if (this.engaging) return;
    this.engaging = true;
    if (!this.q(id)) this.start(id); // hit one before saying yes: that's a yes
    for (const u of this.staged[id] || []) if (u.alive && u.staged) u.engageStaged(h);
    this.engaging = false;
  }

  // ---------------------------------------------------------------- steps
  // Build whatever the current step needs in the world.
  enterStep(id) {
    this.clearLive(id);
    const s = this.step(id);
    if (!s) return;
    const sc = this.sc;
    const live = (this.live[id] = { objs: [] });
    const giver = this.npc(ERRANDS[id].giver);
    if (giver?.hiddenNow) this.setNpcVisible(giver, true);
    if (s.prop) live.prop = this.placeProp(s.prop, live);
    if (s.type === 'find') {
      const prev = this.live[`${id}:prop`];
      const spr = prev || this.placeProp({ kind: s.kind, x: s.x, y: s.y }, live);
      live.find = sc.addInteractable({ x: px(s.x), y: px(s.y), reach: 24, standOff: 12, h: 12, kind: 'find', interact: () => {
        sc.floatText(px(s.x), px(s.y) - 24, s.say, 'fontPlain');
        audio.sfx(s.kind === 'dog' ? 'blip' : 'coin');
        if (s.kind === 'dog' && spr) { spr.play('dog_run').setFlipX(true); sc.tweens.add({ targets: spr, x: spr.x + 140, alpha: 0, duration: 1600, onComplete: () => spr.destroy() }); }
        else if ((s.kind === 'cage' || s.kind === 'net') && spr) { spr.over?.destroy(); sc.fx.puff(spr.x, spr.y, 'spark'); spr.destroy(); audio.sfx('block'); }
        else spr?.destroy();
        delete this.live[`${id}:prop`];
        this.advance(id);
      } });
    }
    if (s.type === 'bells') {
      live.rung = [];
      live.bells = s.bells.map(([x, y, tone]) => {
        const img = sc.add.image(px(x), px(y) + 6, 'bell').setOrigin(0.5, 1).setDepth(px(y));
        live.objs.push(img);
        const o = sc.addInteractable({ x: px(x), y: px(y), reach: 24, standOff: 12, h: 18, kind: 'bell', interact: () => this.ring(id, tone, img) });
        live.objs.push({ destroy: () => sc.removeInteractable(o) });
        return { x, y, tone, img };
      });
    }
    if (s.announce) sc.time.delayedCall((s.delay || 0) * 900, () => sc.events.emit('banner', s.announce, ERRANDS[id].title));
    if (s.type === 'follow') {
      // the hawk flies ahead, waiting for you at each point
      const hk = this.npc(ERRANDS[id].giver);
      live.i = 0;
      live.hawk = hk;
      const [x0, y0] = s.path[0];
      if (hk) { sc.tweens.add({ targets: hk, px: px(x0), py: px(y0), duration: 900 }); }
    }
    if (s.type === 'escort') this.startEscort(id, s, live);
    if (s.type === 'defend') this.startDefend(id, s, live);
  }

  placeProp(p, live) {
    const sc = this.sc;
    let spr;
    if (p.kind === 'cage' || p.kind === 'net') {
      // a caged / netted hero waiting to be freed
      const who = p.kind === 'cage' ? 'kesh' : 'wren';
      const x = px(p.x), y = px(p.y);
      spr = sc.add.sprite(x, y, who, 'idle_down_0').setOrigin(0.5, 0.75).play(`${who}_${p.kind === 'cage' ? 'idle' : 'downed'}_down`).setDepth(y);
      const over = sc.add.image(x, y + (p.kind === 'cage' ? 8 : 4), p.kind).setOrigin(0.5, 1).setDepth(y + 1);
      live.objs.push(over);
      spr.over = over;
      const destroy = spr.destroy.bind(spr);
      spr.destroy = () => { over.destroy(); destroy(); };
      live.objs.push(spr);
      return spr;
    }
    if (p.kind === 'dog') spr = sc.add.sprite(px(p.x), px(p.y) + 4, 'dog', '0').setOrigin(0.5, 1).play('dog_sit').setDepth(px(p.y));
    else spr = sc.add.sprite(px(p.x), px(p.y), 'glint', '0').play('glint').setDepth(px(p.y) + 2);
    live.objs.push(spr);
    return spr;
  }

  clearLive(id) {
    const live = this.live[id];
    if (!live) return;
    // keep a placed prop alive into the next step (the dog you then call over)
    if (live.prop?.active) { this.live[`${id}:prop`] = live.prop; live.objs = live.objs.filter((o) => o !== live.prop); }
    for (const o of live.objs) o.destroy?.();
    if (live.find) this.sc.removeInteractable(live.find);
    if (live.cart) { live.cart.alive = false; this.sc.allies = this.sc.allies.filter((a) => a !== live.cart); }
    if (live.guard) { live.guard.alive = false; this.sc.allies = this.sc.allies.filter((a) => a !== live.guard); }
    delete this.live[id];
  }

  advance(id, npc = null) {
    const q = this.q(id), e = ERRANDS[id], s = this.step(id);
    if (!s) return;
    if (s.take) {
      if (!Object.entries(s.take).every(([k, n]) => (this.state.materials[k] || 0) >= n)) {
        this.sc.events.emit('dialogue', [this.line(npc, `YOU'LL NEED ${Object.entries(s.take).map(([k, n]) => `${n} ${CRAFT.materials[k].name}`).join(', ')} FIRST.`)]);
        return;
      }
      for (const [k, n] of Object.entries(s.take)) this.state.materials[k] -= n;
    }
    q.s++; q.n = 0;
    if (q.s >= e.steps.length) { this.complete(id, npc); return; }
    audio.sfx('click');
    this.enterStep(id);
    this.sc.autosave('errand');
  }

  complete(id, npc) {
    const e = ERRANDS[id], q = this.q(id), sc = this.sc;
    q.done = true;
    this.clearLive(id);
    if (this.state.tracked === id) this.state.tracked = this.active()[0] || null;
    const finish = () => {
      const got = this.reward(e.reward);
      audio.sfx('levelUp');
      sc.events.emit('banner', 'ERRAND COMPLETE', got);
      sc.autosave('errand');
    };
    const who = npc || this.npc(e.giver);
    if (e.thanks && who) sc.events.emit('dialogue', e.thanks.map((t) => this.line(who, t)), finish);
    else finish();
  }

  reward(r = {}) {
    const st = this.state, sc = this.sc, out = [];
    if (r.gold) { st.gold += r.gold; out.push(`${r.gold} GOLD`); }
    if (r.xp) { for (const h of sc.party) if (!h.downed) h.gainXp(r.xp); out.push(`${r.xp} XP`); }
    if (r.mats) addMats(st, r.mats);
    if (r.potions) { addPotions(st, r.potions); out.push(Object.entries(r.potions).map(([k, n]) => `${n} ${k.toUpperCase()}${n > 1 ? 'S' : ''}`).join(' ')); }
    if (r.relic) sc.acquireRelic(r.relic, 900);
    if (r.recruit) sc.time.delayedCall(600, () => sc.addRecruit(r.recruit, sc.leader.x + 14, sc.leader.y + 8));
    if (r.sp) { for (const id of st.recruited) st.heroes[id].sp = (st.heroes[id].sp || 0) + r.sp; out.push(`+${r.sp} SKILL POINT`); }
    const give = [];
    if (r.item) give.push(r.item);
    if (r.gear) {
      const lv = Math.round(sc.party.reduce((a, h) => a + h.level, 0) / sc.party.length);
      const hero = st.recruited[Math.floor(Math.random() * st.recruited.length)];
      const slot = r.gear.slot || ['weapon', 'offhand', 'head', 'body'][Math.floor(Math.random() * 4)];
      give.push(makeItem(hero, slot, tierForLevel(lv), r.gear.rarity || 'fine'));
    }
    if (give.length) { gainItems(st, give); sc.events.emit('loot', { ids: give }); }
    sc.events.emit('party');
    return out.join('  ');
  }

  // ------------------------------------------------------------ world hooks
  onKill(e) {
    for (const id of this.active()) {
      const s = this.step(id);
      if (s?.type === 'kill' && (!s.kind || s.kind === e.kind)) { this.q(id).n++; if (this.q(id).n >= s.count) this.advance(id); }
    }
  }

  onGather(mat, n = 1) {
    for (const id of this.active()) {
      const s = this.step(id);
      if (s?.type === 'gather' && s.mat === mat) { this.q(id).n += n; if (this.q(id).n >= s.count) this.advance(id); }
    }
  }

  ring(id, tone, img) {
    const live = this.live[id], s = this.step(id);
    if (!live || s?.type !== 'bells') return;
    const pitch = { low: 0.6, mid: 0.85, high: 1.2 }[tone];
    audio.sfx('bellTone', { pitch });
    img.setTexture('bellRung');
    this.sc.tweens.add({ targets: img, angle: { from: -12, to: 12 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => img.setAngle(0) });
    live.rung.push(tone);
    const ok = s.order.slice(0, live.rung.length).every((t, i) => t === live.rung[i]);
    if (!ok) {
      live.rung = [];
      this.sc.time.delayedCall(500, () => { for (const b of live.bells) b.img.setTexture('bell'); this.sc.floatText(img.x, img.y - 30, 'THE CHIME FALLS FLAT...', 'fontPlain'); });
      return;
    }
    if (live.rung.length === s.order.length) this.sc.time.delayedCall(600, () => this.advance(id));
  }

  // escort: the cart rolls along its path while the party is close; goblins
  // ambush at set points and go for the cart. If it breaks, the errand resets.
  startEscort(id, s, live) {
    const sc = this.sc;
    const p0 = s.path[0];
    const spr = sc.add.sprite(px(p0[0]), px(p0[1]), 'cart', '0').setOrigin(0.5, 0.85).setDepth(px(p0[1]));
    live.objs.push(spr);
    const cart = { x: px(p0[0]), y: px(p0[1]), r: 8, alive: true, team: 'party', hp: s.hp, maxHp: s.hp, ally: true, idx: 1, spr,
      damage: (amt) => {
        cart.hp -= amt; spr.setTintFill(0xffffff); sc.time.delayedCall(70, () => spr.clearTint());
        sc.floatText(cart.x, cart.y - 20, `${Math.round(amt)}`, 'font', 0xff6a6a);
        if (cart.hp <= 0 && cart.alive) this.failEscort(id);
        return amt;
      } };
    live.cart = cart;
    live.ambushed = new Set();
    live.bar = sc.add.graphics().setDepth(100000 - 41);
    live.objs.push(live.bar);
    (sc.allies ??= []).push(cart);
  }

  failEscort(id) {
    const sc = this.sc;
    sc.events.emit('banner', 'THE CART IS WRECKED', 'TALK TO PIET TO TRY AGAIN');
    this.q(id).s = 0;
    for (const e of sc.enemies) if (e.alive && e.questSpawn === id) { e.alive = false; e.clearZone(); e.destroy(); }
    sc.enemies = sc.enemies.filter((e) => e.alive);
    this.clearLive(id);
    delete this.state.quests[id]; // offered again from the start
    sc.autosave('errand');
  }

  startDefend(id, s, live) {
    const npc = this.npc(s.npc);
    this.setNpcVisible(npc, true);
    // reuse the raiders already on stage; after a reload they're re-staged and
    // wake when the party walks up
    live.units = this.stageAmbush(id, true);
    for (const u of live.units) if (u.staged && !this.engaging) u.staged.wake = true;
  }

  update(dt) {
    const sc = this.sc, L = sc.leader;
    // markers: "!" when an errand is on offer, "?" when they're waiting on you
    for (const n of this.npcs) {
      if (n.requires && n.hiddenNow && sc.flags[n.requires]) this.setNpcVisible(n, true);
      if (n.wards && n.hiddenNow && !this.state.recruited.includes(n.recruitOf) && this.brokenWards() >= n.wards) this.setNpcVisible(n, true);
      if (n.recruitOf && !n.hiddenNow && this.state.recruited.includes(n.recruitOf)) this.setNpcVisible(n, false); // joined the party: no double
      if (n.hiddenNow) { n.mark.setVisible(false); continue; }
      const ready = this.turnInFor(n), offer = this.offerFor(n);
      n.mark.setVisible(!!(ready || offer)).setTexture(ready ? 'markA' : 'markQ');
      if (n.flying) { n.s.y = n.py - 30 + Math.sin(Date.now() / 300) * 4; n.s.x = n.px + Math.cos(Date.now() / 700) * 10; }
      if (!n.ghost && !n.flying && n.look !== 'board' && n.s.anims) {
        const d = Math.hypot(L.x - n.px, L.y - n.py);
        if (d < 60) { const dx = L.x - n.px, dy = L.y - n.py; const v = Math.abs(dx) > Math.abs(dy) ? 'side' : dy > 0 ? 'down' : 'up'; const key = `${n.look}_idle_${v}`; if (n.s.anims.currentAnim?.key !== key) n.s.play(key); n.s.setFlipX(v === 'side' && dx < 0); }
      }
    }
    // chance meetings
    for (const [id, e] of Object.entries(ERRANDS)) {
      if (!e.trigger || this.q(id)) continue;
      // already met (e.g. after a reload): they wait where you left them
      if (sc.flags[`met_${id}`]) {
        const g = this.npc(e.giver); if (g?.hiddenNow) this.setNpcVisible(g, true);
        if (e.steps[0].type === 'defend') this.stageAmbush(id);
        continue;
      }
      if (sc.busy || sc.ui?.dialogOpen || sc.combatHold > 0) continue;
      const [tx, ty, r] = e.trigger;
      if (Math.hypot(L.x - px(tx), L.y - px(ty)) < r * TILE) {
        // they call out once; you choose whether to help (after that, talk to them)
        const npc = this.npc(e.giver);
        sc.flags[`met_${id}`] = true;
        this.setNpcVisible(npc, true);
        if (e.steps[0].type === 'defend') this.stageAmbush(id);
        this.offer(id, npc);
      }
    }
    for (const id of this.active()) {
      const s = this.step(id), live = this.live[id];
      if (!s || !live) continue;
      if (s.type === 'follow') {
        const [wx, wy] = s.path[live.i];
        if (Math.hypot(L.x - px(wx), L.y - px(wy)) < s.r * TILE) {
          live.i++;
          if (live.i >= s.path.length) { if (live.hawk) this.setNpcVisible(live.hawk, false); this.advance(id); continue; }
          const [nx, ny] = s.path[live.i];
          if (live.hawk) sc.tweens.add({ targets: live.hawk, px: px(nx), py: px(ny), duration: 900 });
          audio.sfx('blip', { voice: { pitch: 900, wave: 'square', duty: 0.125 } });
        }
      }
      if (s.type === 'spawn') {
        if (!live.spawned && s.delay && (live.wait = (live.wait ?? s.delay) - dt) > 0) continue;
        if (!live.spawned && Math.hypot(L.x - px(s.at[0]), L.y - px(s.at[1])) < s.r * TILE) {
          live.spawned = s.units.map(([k, x, y], i) => {
            // a bounty's named foe: an elite with its own name (Old Smokestack)
            const named = s.elite === i;
            const e = sc.spawnEnemy(k, px(x), px(y), true, named);
            if (named && s.name) { e.named = true; e.s = { ...e.s, name: s.name }; e.maxHp = Math.round(e.maxHp * 2.2); e.hp = e.maxHp; e.sprite.setScale((e.s.scale || 1) * 1.25); }
            e.questSpawn = id; return e;
          });
          if (live.prop) sc.bark({ x: live.prop.x, y: live.prop.y + 6, def: { voice: { pitch: 600, wave: 'square', duty: 0.25 } } }, 'WOOF! WOOF!');
        }
        if (live.spawned && live.spawned.every((e) => !e.alive)) this.advance(id);
      }
      if (s.type === 'escort' && live.cart) {
        const c = live.cart, wp = s.path[c.idx];
        const near = sc.party.some((h) => !h.downed && Math.hypot(h.x - c.x, h.y - c.y) < 70);
        const fighting = sc.enemies.some((e) => e.alive && e.questSpawn === id);
        if (wp && near && !fighting) {
          const tx = px(wp[0]), ty = px(wp[1]);
          const d = Math.hypot(tx - c.x, ty - c.y), sp = 26 * dt;
          if (d <= sp) { c.idx++; } else { c.x += ((tx - c.x) / d) * sp; c.y += ((ty - c.y) / d) * sp; c.spr.setFlipX(tx < c.x); }
          if (!c.spr.anims.isPlaying) c.spr.play('cart');
        } else c.spr.anims.stop();
        c.spr.setPosition(Math.round(c.x), Math.round(c.y)).setDepth(c.y);
        for (const a of s.ambush) {
          if (c.idx >= a.at && !live.ambushed.has(a.at)) {
            live.ambushed.add(a.at);
            sc.bark(sc.leader, 'AMBUSH! PROTECT THE CART!');
            for (const [k, x, y] of a.units) { const e = sc.spawnEnemy(k, px(x), px(y), false); e.questSpawn = id; e.setTaunt(c, 6); e.engaged = true; }
          }
        }
        live.bar.clear().fillStyle(0x1a1423).fillRect(c.x - 13, c.y - 22, 26, 4).fillStyle(0x6fd3a0).fillRect(c.x - 12, c.y - 21, Math.round(24 * Math.max(0, c.hp) / c.maxHp), 2);
        if (c.idx >= s.path.length && !fighting) { sc.floatText(c.x, c.y - 26, 'MADE IT!', 'fontGold'); this.advance(id); }
      }
      if (s.type === 'defend' && live.units?.length && live.units.every((e) => !e.alive)) { delete this.staged[id]; this.advance(id); }
    }
  }

  // ---------------------------------------------------------------- UI
  // Where the tracked errand wants you to go (tile coords) for map pins.
  pin(id = this.state.tracked) {
    const s = id && this.step(id);
    if (!s) return null;
    if (s.type === 'talk') { const n = this.npc(s.npc); return n ? { x: n.x, y: n.y } : null; }
    if (s.type === 'spawn') return { x: s.at[0], y: s.at[1] };
    if (s.type === 'follow') { const i = this.live[id]?.i || 0; const p = s.path[Math.min(i, s.path.length - 1)]; return { x: p[0], y: p[1] }; }
    if (s.type === 'find') return { x: s.x, y: s.y };
    if (s.type === 'escort') { const c = this.live[id]?.cart; return c ? { x: Math.floor(c.x / TILE), y: Math.floor(c.y / TILE) } : { x: s.path[0][0], y: s.path[0][1] }; }
    if (s.type === 'bells') return { x: s.bells[0][0], y: s.bells[0][1] };
    if (s.type === 'defend') { const n = this.npc(s.npc); return { x: n.x, y: n.y }; }
    return null;
  }

  stepText(id) {
    const s = this.step(id);
    if (!s) return 'COMPLETE';
    const n = this.q(id).n;
    return s.count ? `${s.text} (${n}/${s.count})` : s.text;
  }

  title(id) { return ERRANDS[id]?.title || ''; }

  trackerText() {
    const id = this.state.tracked;
    if (!id || !this.step(id)) return '';
    return `${ERRANDS[id].title}: ${this.stepText(id)}`;
  }
}
