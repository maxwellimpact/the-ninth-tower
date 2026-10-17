// Units: heroes (leader + AI companions), enemies, the Ward Stone, projectiles.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import { CURSE_TINT } from '../gfx/palette.js';
import skillData from '../data/skills.json';
import enemyData from '../data/enemies.json';
import itemsData from '../data/items.json';
import tuning from '../data/tuning.json';
import { computeStats, heroInfo, mitigate, xpToNext, skillRank, rankMul } from './state.js';
import { SKILL_FX, TARGETED } from './skills.js';
import { bakeHero } from './bake.js';
import { updateStaged as updateStagedShow } from './setpiece.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
let UID = 0;

// ------------------------------------------------------------------- Unit
export class Unit {
  constructor(scene, x, y, { key, frame, maxHp = 50, team = 'party', r = 5, shadow = 'shadow' }) {
    this.id = ++UID;
    this.scene = scene;
    this.x = x; this.y = y;
    this.team = team;
    this.r = r;
    this.maxHp = maxHp; this.hp = maxHp;
    this.alive = true;
    this.kx = 0; this.ky = 0;
    this.view = 'down'; this.flip = false;
    this.shadow = scene.add.image(x, y, shadow).setAlpha(0.2).setDepth(-4);
    this.sprite = scene.add.sprite(x, y, key, frame).setOrigin(0.5, 0.75);
    this.flashT = 0;
    this.hurtTint = 0;
  }

  face(dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    // hysteresis: near-diagonal headings keep the current view instead of
    // flipping side/front every frame (reads as twitching)
    const k = this.view === 'side' ? 0.75 : this.view ? 1.35 : 1.05;
    if (Math.abs(dx) > Math.abs(dy) * k) { this.view = 'side'; this.flip = dx < 0; }
    else this.view = dy > 0 ? 'down' : 'up';
  }

  flash(ms = 70, color = 0xffffff) {
    this.flashT = ms / 1000;
    this.sprite.setTintFill(color);
  }

  knock(dx, dy, power) {
    const [nx, ny] = norm(dx, dy);
    this.kx += nx * power; this.ky += ny * power;
  }

  // integrate knockback + collisions with the world
  physics(dt) {
    if (this.kx || this.ky) {
      this.moveBy(this.kx * dt, this.ky * dt);
      const decay = Math.pow(0.0005, dt);
      this.kx *= decay; this.ky *= decay;
      if (Math.abs(this.kx) < 2) this.kx = 0;
      if (Math.abs(this.ky) < 2) this.ky = 0;
    }
  }

  moveBy(dx, dy) {
    const nav = this.scene.nav;
    const r = this.r;
    const clear = (x, y) => !nav.solidAtPx(x - r, y - r * 0.6) && !nav.solidAtPx(x + r, y - r * 0.6) && !nav.solidAtPx(x - r, y + r * 0.6) && !nav.solidAtPx(x + r, y + r * 0.6);
    // already overlapping something solid (a gate or door shut on our heels, a
    // block slid against us): let any step that keeps our centre on open floor
    // through, so the unit can walk itself free instead of being pinned
    const free = (x, y) => clear(x, y) || (!clear(this.x, this.y) && !nav.solidAtPx(x, y));
    const nx = this.x + dx;
    if (free(nx, this.y)) this.x = nx;
    const ny = this.y + dy;
    if (free(this.x, ny)) this.y = ny;
  }

  sync(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.restoreTint();
    }
    // lift: standing up on something (a lookout platform) — drawn higher, sorted as if on the ground
    const lift = this.lift || 0;
    // hovering ghosts float a little above their shadow, bobbing
    const hover = this.s?.hover ? this.s.hover + Math.sin(this.scene.time.now / 320 + this.spawn.x) * 1.5 : 0;
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - lift - hover));
    this.sprite.setFlipX(this.flip);
    this.sprite.setDepth(this.y + (lift ? 4 : 0));
    this.shadow.setPosition(Math.round(this.x) + 1, Math.round(this.y - lift) + 1);
  }

  restoreTint() { this.sprite.clearTint(); }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

// ---------------------------------------------------------------- Heroes
// Derived views of the hero data (kept for callers like the title screen).
import heroList from '../data/heroes.json';
export const HERO_STATS = Object.fromEntries(heroList.map((h) => [h.id, h.stats]));
export const SKILLS = Object.fromEntries(heroList.map((h) => [h.id, h.skills.map((id) => ({ id, ...skillData[id] }))]));
const critMul = () => tuning.critMult || 1.75;

// Health, max health and the ultimate meter must always be real numbers: one
// bad value (NaN) spreads through every hit and blanks every bar. If something
// ever tries to set one, keep the last good value and report where it came
// from (once per field) so the cause can be found.
const badReported = new Set();
function reportBad(field, v, u) {
  if (badReported.has(field)) return;
  badReported.add(field);
  const e = new Error(`${field} was set to ${v} on ${u.kind || u.def?.id || 'a unit'}`);
  console.error(e);
  (window.__errs ??= []).push(`[guard] ${e.stack?.split('\n').slice(0, 4).join(' | ')}`);
  window.__reportBug?.(e);
}
function guardNumber(proto, field, fallback) {
  const k = `_g_${field}`;
  Object.defineProperty(proto, field, {
    configurable: true,
    get() { return this[k]; },
    set(v) {
      if (typeof v === 'number' && Number.isFinite(v)) { this[k] = v; return; }
      if (this[k] === undefined) this[k] = fallback(this);
      reportBad(field, v, this);
    },
  });
}
guardNumber(Unit.prototype, 'maxHp', () => 100);
guardNumber(Unit.prototype, 'hp', (u) => u.maxHp ?? 100);

export class Hero extends Unit {
  constructor(scene, id, hs, x, y) {
    const st = computeStats(id, hs.level, hs.equip, hs);
    const texKey = bakeHero(scene, id, hs.equip);
    super(scene, x, y, { key: texKey, frame: 'idle_down_0', maxHp: st.maxHp, team: 'party', r: 5 });
    const info = heroInfo(id);
    this.texKey = texKey;
    this.hs = hs;               // persistent hero state (level, xp, equip, ult)
    this.def = { id, name: info.name, title: info.title, voice: info.voice };
    this.stats = st;
    this.hp = hs.hp ?? st.maxHp;
    this.skills = [];
    this.buildSkills();
    this.buffs = {};
    this.ultimate = { id: info.ultimate, ...skillData[info.ultimate] };
    this.shield = 0; this.shieldT = 0;
    this.isLeader = false;
    this.command = null;       // leader: {type:'move'|'attack'|'interact', ...}
    this.path = null; this.pathGoal = null; this.repathT = 0;
    this.atkT = 0;
    this.action = null;        // locked action: attack / cast / dodge / skill
    this.dodgeCd = 0;
    this.invuln = 0;
    this.downed = false;
    this.target = null;
    this.thinkT = Math.random() * 0.2;
    this.taunting = 0;         // damage reduction window
    this.nextCrit = false;
    this.anim = '';
    this.stepT = 0;
    this.reviveT = 0;
    this.direct = null;        // WASD vector
  }

  get name() { return this.def.name; }
  get spd() { return this.stats.speed * (this.buffs?.primal ? 1 : this.buffMul('slow')); }
  get ranged() { return this.stats.role === 'caster' || this.stats.role === 'ranged'; }
  get level() { return this.hs.level; }
  get ult() { return this.hs.ult || 0; }
  set ult(v) {
    if (!Number.isFinite(v)) { reportBad('ult', v, this); return; } // keep the meter as it was
    this.hs.ult = Math.max(0, Math.min(100, v));
  }
  addUlt(n) { if (!this.downed) this.ult = this.ult + n * (this.stats?.traits?.includes('zeal') ? 1.15 : 1) * (this.hasPerk('echobell') ? 1.2 : 1); } // Echo Bell: +20%
  hasTrait(t) { return !!this.stats.traits?.includes(t); }
  // unique-item perks (signature effects named on the item)
  hasPerk(p) { return Object.values(this.hs.equip).some((id) => id && itemsData[id]?.perk === p); }

  // Equipped active skills (keeps cooldowns across loadout changes).
  buildSkills() {
    const prev = Object.fromEntries((this.skills || []).map((k) => [k.id, k.t]));
    this.skills = this.hs.skills.active.filter(Boolean).map((sid) => ({ id: sid, ...skillData[sid], t: prev[sid] || 0, rank: skillRank(this.hs, sid) }));
  }

  // Rank of an equipped passive (0 when not equipped).
  passive(id) { return this.hs.skills.passive.includes(id) ? skillRank(this.hs, id) : 0; }
  // crit damage multiplier (Keen Edge adds to it)
  critMult() { const k = this.passive('keenedge'); return critMul() + (k ? 0.25 + 0.05 * (k - 1) : 0); }

  // Lock into a skill action. extra: { hitAt, resolve(), tick(a, dt) }
  act(id, dur, anim, extra = {}) {
    this.action = { type: 'skill', id, t: 0, dur, ...extra };
    this.anim = '';
    if (anim) this.play(anim);
  }

  buff(stat, mul, t) { if (stat === 'slow' && mul < 1 && this.purifyT > 0) return; this.buffs[stat] = { mul, t }; }

  // Poison from leeches / venom: ticks down HP for a few seconds.
  addPoison(dps, t) {
    if (this.downed || this.antidoteT > 0 || this.purifyT > 0) return;
    this.poison = { dps: Math.max(dps, this.poison?.dps || 0), t: Math.max(t, this.poison?.t || 0), next: this.poison?.next ?? 0.6 };
    this.sprite.setTint(0xb8ff9a);
  }
  // Burning (fire shots, breath, molten ground): a short fire DoT. Flameproof
  // gear and Purify keep it off.
  addBurn(dps, t = 3) {
    if (this.downed || this.purifyT > 0 || this.hasPerk('flameproof') || this.hasTrait('heatproof')) return;
    this.burn = { dps: Math.max(dps, this.burn?.dps || 0), t: Math.max(t, this.burn?.t || 0), next: this.burn?.next ?? 0.5 };
    this.sprite.setTint(0xffb08a);
  }
  buffMul(stat) { return this.buffs[stat]?.mul || 1; }

  heal(amt) {
    if (this.downed || amt <= 0) return;
    const bl = this.passive?.('blessed');
    if (bl) amt = Math.round(amt * (1.2 + 0.04 * (bl - 1))); // Blessed (Cleric): heals land harder
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amt);
    if (this.hp > before) { this.scene.floatText(this.x, this.y - 26, `+${this.hp - before}`, 'font', 0x8cff8c); this.scene.fx.heal(this.x, this.y); }
  }

  // Recompute stats only (skill/passive changes).
  refreshStats() {
    const frac = this.hp / this.maxHp;
    this.stats = computeStats(this.def.id, this.hs.level, this.hs.equip, this.hs);
    this.maxHp = this.stats.maxHp;
    this.hp = Math.max(1, Math.round(this.maxHp * frac));
  }

  // Re-bake sprites and recompute stats after an equipment change.
  refreshGear() {
    const frac = this.hp / this.maxHp;
    this.stats = computeStats(this.def.id, this.hs.level, this.hs.equip, this.hs);
    this.maxHp = this.stats.maxHp;
    this.hp = Math.max(1, Math.round(this.maxHp * frac));
    const old = this.texKey;
    this.texKey = bakeHero(this.scene, this.def.id, this.hs.equip, old);
    this.anim = '';
    this.sprite.setTexture(this.texKey, 'idle_down_0');
    this.play(this.downed ? 'downed' : 'idle');
  }

  play(anim) {
    const key = `${this.texKey}_${anim}_${this.view}`;
    if (this.anim !== key) { this.anim = key; this.sprite.play(key); }
  }

  // ----------------------------------------------------------- movement
  setGoal(x, y) {
    if (this.pathGoal && Math.hypot(this.pathGoal.x - x, this.pathGoal.y - y) < 6 && this.path) return;
    this.pathGoal = { x, y };
    const nav = this.scene.nav;
    nav.swimmer = this.scene.canSwim;
    this.path = nav.find(this.x, this.y, x, y);
    nav.swimmer = false;
    this.repathT = 0.5;
  }

  // Heroes swim once the party has the Tide Charm (slower, half-submerged).
  moveBy(dx, dy) {
    const nav = this.scene.nav;
    nav.swimmer = this.scene.canSwim;
    const m = this.swimming ? 0.65 : 1;
    super.moveBy(dx * m, dy * m);
    nav.swimmer = false;
  }

  updateSwim() {
    const nav = this.scene.nav;
    const sw = nav.isWater(Math.floor(this.x / 16), Math.floor(this.y / 16));
    if (sw !== this.swimming) {
      this.swimming = sw;
      if (sw) { this.scene.fx.burst('foam', this.x, this.y, 8); audio.sfx('step', { surface: 'path' }); }
      else this.sprite.setCrop();
      this.shadow.setVisible(!sw);
    }
    if (sw) {
      const fh = this.sprite.frame.height;
      this.sprite.setCrop(0, 0, this.sprite.frame.width, Math.round(fh * 0.66));
      this.rippleT = (this.rippleT || 0) - 0.016;
      if (this.rippleT <= 0) { this.rippleT = 0.35; this.scene.fx.burst('foam', this.x + (Math.random() - 0.5) * 8, this.y + 2, 1); }
    }
  }

  clearPath() { this.path = null; this.pathGoal = null; }

  followPath(dt, speedMul = 1) {
    if (!this.path || !this.path.length) return false;
    const wp = this.path[0];
    const dx = wp.x - this.x, dy = wp.y - this.y;
    const d = Math.hypot(dx, dy);
    const sp = this.spd * speedMul * dt;
    if (d <= Math.max(1.5, sp)) {
      this.moveBy(dx, dy);
      this.path.shift();
      if (!this.path.length) { this.path = null; return false; }
      return true;
    }
    this.face(dx, dy);
    const ox = this.x, oy = this.y;
    this.moveBy((dx / d) * sp, (dy / d) * sp);
    if (Math.hypot(this.x - ox, this.y - oy) < sp * 0.2) this.stuckT = (this.stuckT || 0) + dt; else this.stuckT = 0;
    if (this.stuckT > 0.4 && this.pathGoal) {
      this.stuckT = 0;
      // blocked again and again (usually by a crowd): stop pushing rather than jitter in place
      this.stuckCount = (this.stuckCount || 0) + 1;
      if (this.stuckCount > 2) { this.stuckCount = 0; this.path = null; this.blockedT = 0.6; return false; }
      const nav = this.scene.nav; nav.swimmer = this.scene.canSwim; this.path = nav.find(this.x, this.y, this.pathGoal.x, this.pathGoal.y); nav.swimmer = false;
    } else if (Math.hypot(this.x - ox, this.y - oy) >= sp * 0.2) this.stuckCount = 0;
    return true;
  }

  // ------------------------------------------------------------- combat
  canAct() { return this.alive && !this.downed && !this.action; }

  startAttack(target) {
    if (this.atkT > 0 || !this.canAct()) return false;
    this.face(target.x - this.x, target.y - this.y);
    this.atkT = this.stats.atkCd / this.buffMul('atkspd');
    this.action = { type: 'attack', t: 0, dur: this.ranged ? 0.3 : 0.24, hitAt: this.stats.hitAt, target, done: false };
    this.anim = '';
    this.play('attack');
    const id = this.def.id;
    if (id === 'brann' || id === 'kesh' || id === 'oake' || id === 'gizmo') audio.sfx('swing', { pitch: id === 'kesh' ? 0.65 : id === 'oake' ? 0.7 : id === 'gizmo' ? 1.1 : 0.8 });
    else if (id === 'sable') audio.sfx('stab');
    else if (id === 'wren') audio.sfx('swing', { pitch: 1.7 });
    else audio.sfx('fireCast');
    return true;
  }

  resolveAttack(target) {
    const sc = this.scene;
    if (this.def.id === 'wren') {
      // arrows: physical, so they crit and backstab like blades; Eagle Eye favours long shots
      const [nx, ny] = norm(target.x - this.x, target.y - (this.y - 6));
      const far = this.passive('eagleeye') && dist(this, target) > 70;
      // Quiver of Embers: every 4th arrow bursts into fire
      const blast = this.hasPerk('embers') && (this.emberShots = (this.emberShots || 0) + 1) % 4 === 0;
      sc.spawnProjectile({ owner: this, x: this.x + nx * 8, y: this.y - 8, vx: nx * 280, vy: ny * 280, dmg: this.stats.atk, kind: 'arrow', target, basic: true, critBonus: far ? 0.15 : 0, life: 0.8, blast, element: blast ? 'fire' : undefined });
      return;
    }
    if (this.def.id === 'pip') {
      const [nx, ny] = norm(target.x - this.x, target.y - (this.y - 6));
      sc.spawnProjectile({ owner: this, x: this.x + nx * 10, y: this.y - 8 + ny * 6, vx: nx * 190, vy: ny * 190, dmg: this.stats.atk, kind: 'bolt', target, spell: true, basic: true });
      this.maybeEcho(target, this.stats.atk * 0.6, 'bolt');
      return;
    }
    if (!target.alive || dist(this, target) > this.stats.range + target.r + 8) return;
    let crit = this.nextCrit || Math.random() < this.stats.crit;
    if (this.stats.traits?.includes('opener') && !target.openedBy?.has(this)) { (target.openedBy ??= new Set()).add(this); crit = true; }
    this.nextCrit = false;
    sc.dealDamage(this, target, this.stats.atk * (crit ? this.critMult() : 1) * (0.9 + Math.random() * 0.2), { crit, knock: { brann: 70, sable: 12 }[this.def.id] ?? 40, basic: true });
  }

  // Orb of Echoes: every third spell repeats as a purple echo bolt from the orb.
  maybeEcho(target, dmg, kind) {
    if (!this.stats.passives?.includes('echo')) return;
    this.echoCount = (this.echoCount || 0) + 1;
    if (this.echoCount % 3 !== 0) return;
    const sc = this.scene;
    sc.time.delayedCall(220, () => {
      if (!target.alive || this.downed) return;
      const ox = this.x + (this.flip ? -8 : 8), oy = this.y - 16;
      const [nx, ny] = norm(target.x - ox, target.y - 8 - oy);
      sc.spawnProjectile({ owner: this, x: ox, y: oy, vx: nx * 200, vy: ny * 200, dmg, kind, target, echo: true });
      audio.sfx('frost');
      sc.floatText(ox, oy - 8, 'ECHO', 'fontPlain', 0xe7a6ff);
    });
  }

  // Where a dodge should go when you aren't steering: out of telegraphed
  // attacks and out of reach of whoever is fighting you, into open floor, and
  // only as far as it takes (a ~3 tile hop, never across the room).
  smartDodge() {
    const sc = this.scene;
    const threats = [];
    for (const z of sc.dangers) if (Math.hypot(this.x - z.x, this.y - z.y) < z.r + 48) threats.push({ x: z.x, y: z.y, r: z.r + 10, w: 3 });
    for (const e of sc.enemies) {
      if (!e.alive || e.submerged || !(e.engaged || e.boss || e.target === this)) continue; // a boss always counts
      const reach = e.s.ranged ? 24 : (e.s.range || 14) + e.r + 14;
      if (dist(e, this) < reach + 48) threats.push({ x: e.x, y: e.y, r: reach, w: e.target === this ? 2 : 1 });
    }
    if (!threats.length) {
      // nothing swinging at us: roll back from a nearby foe rather than into it
      const near = sc.nearestEnemy(this, 80);
      if (near) return norm(this.x - near.x, this.y - near.y);
      return this.facingVec();
    }
    const hop = 46; // what a dodge actually covers
    let best = null, bs = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      let len = hop;
      if (!sc.nav.lineClear(this.x, this.y, this.x + ux * len, this.y + uy * len, 4)) { len = hop * 0.5; if (!sc.nav.lineClear(this.x, this.y, this.x + ux * len, this.y + uy * len, 4)) continue; }
      const lx = this.x + ux * len, ly = this.y + uy * len;
      let score = len * 0.05;
      for (const t of threats) {
        const d = Math.hypot(lx - t.x, ly - t.y);
        if (d < t.r) score -= (t.r - d + 20) * t.w * 3; // still in it: bad
        score += Math.min(d, t.r + 24) * 0.2 * t.w;     // clear of it is good, further is no better
      }
      if (score > bs) { bs = score; best = [ux, uy]; }
    }
    return best || this.facingVec();
  }

  dodge(dx, dy) {
    if (!this.alive || this.downed || this.dodgeCd > 0) return;
    if (this.action && this.action.type === 'dodge') return;
    const [nx, ny] = norm(dx, dy);
    this.face(nx, ny);
    this.action = { type: 'dodge', t: 0, dur: 0.32, nx, ny, ghostT: 0 };
    this.invuln = 0.28;
    this.dodgeCd = 0.55;
    this.anim = '';
    this.play('dodge');
    this.clearPath();
    audio.sfx('dodge');
    this.scene.fx.dust(this.x, this.y);
    if (this.hasPerk('nightsilk')) new Gadget(this.scene, this, 'decoy', this.x, this.y); // Nightsilk Coat
  }

  // The leader is never stuck in a swing: moving, picking another target or a
  // skill cuts it short (a swing cut before it lands doesn't hit, and its
  // cooldown comes back). Skill animations can be cut once their effect is out.
  cancelForInput() {
    const a = this.action, c = this.command, d = this.direct;
    const cancellable = a.type === 'attack' || (a.type === 'skill' && !a.tick && (a.hitAt === undefined || a.done));
    if (!cancellable) return;
    const wants = (d && (d.x || d.y)) || c?.type === 'move' || c?.type === 'interact' || (c?.type === 'attack' && a.type === 'attack' && c.target !== a.target);
    if (wants) this.cancelAction();
  }

  cancelAction() {
    const a = this.action;
    if (a?.type === 'attack' && !a.done) this.atkT = 0;
    this.action = null; this.anim = '';
  }

  useSkill(i, target) {
    if (this.isLeader && this.action?.type === 'attack') this.cancelAction(); // a skill press never waits on a swing
    const sk = this.skills[i];
    if (!sk || sk.t > 0 || !this.canAct()) return false;
    const fx = SKILL_FX[sk.id];
    if (!fx) return false;
    const sc = this.scene;
    let t = target && target.alive ? target : null;
    if (!t && TARGETED.has(sk.id)) t = sc.nearestEnemy(this, sk.range || 120);
    if (!fx.cast(this, { target: t, m: rankMul(sk.rank), rank: sk.rank, sk })) return false;
    sk.t = sk.cd * (1 - (this.stats.cdr || 0));
    return true;
  }

  facingVec() {
    if (this.view === 'side') return [this.flip ? -1 : 1, 0];
    return [0, this.view === 'down' ? 1 : -1];
  }

  updateAction(dt) {
    const a = this.action;
    if (!a) return;
    a.t += dt;
    const sc = this.scene;
    if (a.type === 'harvest') {
      a.swingT += dt;
      if (a.swingT >= a.period) { a.swingT -= a.period; sc.harvestTick(this, a.node); }
      if (a.t >= a.dur) { this.action = null; this.anim = ''; sc.finishHarvest(this, a.node); }
      return;
    }
    if (a.type === 'dodge') {
      const sp = 210 * (1 - a.t / a.dur) + 40;
      this.moveBy(a.nx * sp * dt, a.ny * sp * dt);
      a.ghostT -= dt;
      if (a.ghostT <= 0) { a.ghostT = 0.045; sc.fx.ghost(this); }
    }
    if (a.type === 'attack' && !a.done && a.t >= a.hitAt) { a.done = true; this.resolveAttack(a.target); }
    if (a.type === 'skill') {
      a.tick?.(a, dt);
      if (!a.done && a.hitAt !== undefined && a.t >= a.hitAt) { a.done = true; a.resolve?.(); }
    }
    if (a.t >= a.dur) { this.action = null; this.anim = ''; }
  }

  // signature effects of uniques that tick on their own
  updatePerks(dt) {
    const sc = this.scene;
    this.fightCheckT = (this.fightCheckT || 0) - dt;
    if (this.fightCheckT <= 0) { this.fightCheckT = 1; if (!sc.enemies.some((e) => e.alive && e.engaged)) this.phoenixUsed = false; } // once per fight
    // Lionheart Helm: below 40% HP, a roar every 3s pulls nearby foes onto Brann
    if (this.hasPerk('lionheart') && !this.downed && this.hp < this.maxHp * 0.4) {
      this.lionT = (this.lionT ?? 0) - dt;
      if (this.lionT <= 0) {
        const near = sc.enemies.filter((e) => e.alive && e.engaged && !e.boss && dist(e, this) < 90);
        if (near.length) {
          this.lionT = 3;
          for (const e of near) e.setTaunt(this, 1.5);
          sc.fx.ring(this.x, this.y - 6, 'ringGold', 3);
          sc.floatText(this.x, this.y - 34, 'ROAR!', 'fontGold');
          audio.sfx('roar', { pitch: 1.2 });
        }
      }
    }
  }

  damage(amount, src) {
    if (!this.alive || this.downed) return 0;
    if (this.invuln > 0) { this.scene.floatText(this.x, this.y - 28, 'DODGE', 'fontPlain'); return 0; }
    // Riposte: parry and counter with a guaranteed crit
    if (this.riposteT > 0 && src && src.alive && !src.s?.ranged) {
      this.riposteT = 0;
      this.scene.floatText(this.x, this.y - 28, 'PARRY!', 'fontGold');
      audio.sfx('block');
      this.face(src.x - this.x, src.y - this.y);
      this.anim = ''; this.play('attack');
      this.scene.dealDamage(this, src, this.stats.atk * 2 * this.critMult() * (this.riposteMul || 1), { crit: true, knock: 90 });
      return 0;
    }
    if (this.taunting > 0) amount *= 0.5;
    if (this.wallT > 0) amount *= 0.2;
    if (this.passive('wardweave') && src && (src.s?.ranged || src.spell)) amount *= 0.8;
    if (this.action?.type === 'harvest') this.scene.cancelHarvest(this);
    const lion = this.hasPerk('lionheart') && this.hp < this.maxHp * 0.4 ? 1.25 : 1; // Lionheart Helm
    amount = Math.max(1, Math.round(mitigate(amount, this.stats.def * this.buffMul('def') * lion, src?.level || 1)));
    this.addUlt((amount / this.maxHp) * tuning.ultTakeFull); // losing a whole health bar is worth ~25
    const ret = this.passive('retribution');
    if (ret) { const bash = this.skills.find((k) => k.id === 'bash'); if (bash) bash.t = Math.max(0, bash.t - 0.5 - 0.1 * (ret - 1)); }
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      if (!amount) { this.scene.floatText(this.x, this.y - 28, 'BLOCK', 'fontPlain'); audio.sfx('block'); return 0; }
    }
    this.hp -= amount;
    if (this.hasPerk('aegis') && (this.aegisHits = (this.aegisHits || 0) + 1) % 5 === 0) { // Aegis of Dawn: every 5th hit taken heals the party 8%
      for (const p of this.scene.party) if (p.alive && !p.downed) p.heal(Math.round(p.maxHp * 0.08));
      this.scene.fx.ring(this.x, this.y - 6, 'ringGold', 2.4);
    }
    if (src?.affix === 'vampiric') src.vampHeal(amount, this);
    this.flash(90, 0xff5050);
    audio.sfx('hurt');
    this.scene.floatText(this.x, this.y - 26, `${amount}`, 'font', 0xff6a6a);
    if (this.isLeader) this.scene.shake(70, 0.004);
    if (src) this.knock(this.x - src.x, this.y - src.y, 50);
    if (src?.alive && src.team === 'enemy' && !src.s?.ranged && this.hasTrait('thorns')) src.damage(Math.max(1, Math.round(amount * 0.1)), this, { knock: 0, dot: true });
    if (this.hp <= 0 && this.passive('laststand') && !this.lastStandUsed) {
      this.lastStandUsed = true;
      this.hp = 1;
      this.invuln = 3;
      this.scene.floatText(this.x, this.y - 34, 'LAST STAND!', 'fontGold', 0xffffff, true);
      this.scene.fx.ring(this.x, this.y - 6, 'ringGold', 3);
      return amount;
    }
    if (this.hp <= 0) this.goDown();
    return amount;
  }

  goDown() {
    if (this.hasPerk('phoenix') && !this.phoenixUsed) { // Phoenix Robe: once a fight, rise again
      this.phoenixUsed = true;
      this.hp = Math.round(this.maxHp * 0.4); this.invuln = 1.5; this.burn = null; this.poison = null;
      const sc = this.scene;
      sc.fx.burst('ember', this.x, this.y - 10, 30); sc.fx.ring(this.x, this.y - 6, 'ringGold', 3);
      sc.floatText(this.x, this.y - 34, 'REBORN!', 'fontGold', 0xffffff, true);
      audio.sfx('fireImpact');
      return;
    }
    this.hp = 0;
    this.downed = true;
    this.action = null;
    this.clearPath();
    this.anim = '';
    this.play('downed');
    this.sprite.setAlpha(0.85);
    this.scene.onHeroDowned(this);
  }

  revive(frac = 0.4) {
    this.downed = false;
    this.hp = Math.max(1, Math.round(this.maxHp * frac));
    this.sprite.setAlpha(1);
    this.anim = '';
    this.scene.fx.heal(this.x, this.y);
    this.scene.floatText(this.x, this.y - 28, 'REVIVED', 'fontGold');
  }

  gainXp(n) {
    const hs = this.hs;
    if (hs.level >= tuning.levelCap) { hs.xp = 0; return; }
    hs.xp += n;
    if (hs.xp >= xpToNext(hs.level)) {
      hs.xp -= xpToNext(hs.level);
      hs.level++;
      hs.sp = (hs.sp || 0) + 1;
      this.stats = computeStats(this.def.id, hs.level, hs.equip, hs);
      this.maxHp = this.stats.maxHp;
      this.hp = this.maxHp;
      this.scene.onLevelUp(this);
    }
  }

  // ---------------------------------------------------------- per-frame
  update(dt) {
    if (!this.alive) return;
    this.atkT = Math.max(0, this.atkT - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.taunting = Math.max(0, this.taunting - dt);
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    this.wallT = Math.max(0, (this.wallT || 0) - dt);
    this.riposteT = Math.max(0, (this.riposteT || 0) - dt);
    this.surgeT = Math.max(0, (this.surgeT || 0) - dt);
    this.overchargeT = Math.max(0, (this.overchargeT || 0) - dt); // Gizmo's Overcharge
    this.purifyT = Math.max(0, (this.purifyT || 0) - dt); // Oake's Purify: no new poison, burn or slow
    if (this.hiddenT > 0) { this.hiddenT -= dt; this.sprite.setAlpha(this.hiddenT > 0 ? 0.45 : 1); }
    for (const [k, b] of Object.entries(this.buffs)) { b.t -= dt; if (b.t <= 0) delete this.buffs[k]; }
    if (this.stats.regen && !this.downed) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.stats.regen * dt);
    const hide = this.passive('thickhide');
    if (hide && !this.downed) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (this.scene.combatHold > 0 ? 0.003 : 0.01) * (1 + 0.2 * (hide - 1)) * dt);
    if (this.passive('beastsense')) for (const e of this.scene.enemies) if (e.submerged && dist(e, this) < 90) e.sprite.setAlpha(0.55);
    // Steady Aim: standing still builds focus
    const moved = this.lastX !== undefined && Math.hypot(this.x - this.lastX, this.y - this.lastY) > 0.15;
    this.stillT = moved ? 0 : (this.stillT || 0) + dt;
    if (this.buffs.primal) { this.sprite.setScale(1.15); } else if (this.sprite.scaleX !== 1) this.sprite.setScale(1);
    if (this.antidoteT > 0) this.antidoteT -= dt;
    if (this.poison && !this.downed) {
      this.poison.t -= dt; this.poison.next -= dt;
      if (this.poison.next <= 0) {
        this.poison.next += 0.6;
        const d = Math.max(1, Math.round(this.poison.dps * 0.6));
        this.hp -= d;
        this.scene.floatText(this.x + (Math.random() * 8 - 4), this.y - 22, `${d}`, 'font', 0x9cff7a);
        if (this.hp <= 0) { if (this.passive('laststand') && !this.lastStandUsed) { this.lastStandUsed = true; this.hp = 1; this.invuln = 3; } else this.goDown(); }
      }
      if (this.poison.t <= 0) { this.poison = null; if (this.flashT <= 0) this.sprite.clearTint(); }
    }
    if (this.burn && !this.downed) {
      this.burn.t -= dt; this.burn.next -= dt;
      if (this.burn.next <= 0) {
        this.burn.next += 0.5;
        const d = Math.max(1, Math.round(this.burn.dps * 0.5));
        this.hp -= d;
        this.scene.floatText(this.x + (Math.random() * 8 - 4), this.y - 22, `${d}`, 'font', 0xffa060);
        this.scene.fx.burst('ember', this.x, this.y - 10, 2);
        if (this.hp <= 0) this.goDown();
      }
      if (this.burn.t <= 0) { this.burn = null; if (this.flashT <= 0) this.sprite.clearTint(); }
    }
    this.updatePerks(dt);
    if (!this.downed) this.addUlt(dt * tuning.ultPassive); // slow passive recharge (~45s)
    this.hs.hp = this.hp;
    for (const s of this.skills) s.t = Math.max(0, s.t - dt);
    this.physics(dt);

    if (this.downed) { this.sync(dt); return; }

    if (this.action && this.isLeader) this.cancelForInput();
    if (this.action) this.updateAction(dt);
    else if (this.isLeader) this.updateLeader(dt);
    else this.updateCompanion(dt);

    // smoothed velocity: the leader's heading steers the formation, and the
    // walk/idle choice uses it so tiny nudges don't flicker the animation
    if (this.lastX !== undefined && dt > 0) {
      const vx = (this.x - this.lastX) / dt, vy = (this.y - this.lastY) / dt;
      const a = Math.min(1, dt * 10);
      this.vel = { x: (this.vel?.x || 0) + (vx - (this.vel?.x || 0)) * a, y: (this.vel?.y || 0) + (vy - (this.vel?.y || 0)) * a };
      const sp = Math.hypot(this.vel.x, this.vel.y);
      if (sp > 12) {
        const ux = this.vel.x / sp, uy = this.vel.y / sp;
        const h = this.head || { x: ux, y: uy };
        const b = Math.min(1, dt * 6);
        const hx = h.x + (ux - h.x) * b, hy = h.y + (uy - h.y) * b;
        const hl = Math.hypot(hx, hy) || 1;
        this.head = { x: hx / hl, y: hy / hl };
      }
    }
    if (!this.action) {
      const moving = this.lastX !== undefined && Math.hypot(this.vel?.x || 0, this.vel?.y || 0) > 8;
      this.play(moving ? 'walk' : 'idle');
      if (moving && this.isLeader) {
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.24; audio.sfx('step', { surface: this.scene.surfaceAt(this.x, this.y) }); }
      }
    }
    this.lastX = this.x; this.lastY = this.y;
    this.separate();
    this.sync(dt);
    this.updateSwim();
  }

  // Soft separation: companions yield to the leader and to each other; the
  // leader is never shoved (never blocked by allies).
  separate() {
    if (this.isLeader) return;
    for (const o of this.scene.party) {
      if (o === this || !o.alive) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = o.isLeader ? 12 : 10;
      if (d > 0.01 && d < min) this.moveBy((dx / d) * (min - d) * 0.35, (dy / d) * (min - d) * 0.35);
    }
  }

  // ------------------------------------------------------------- leader
  updateLeader(dt) {
    const sc = this.scene;
    if (this.direct && (this.direct.x || this.direct.y)) {
      this.command = null; this.clearPath();
      const [nx, ny] = norm(this.direct.x, this.direct.y);
      this.face(nx, ny);
      this.moveBy(nx * this.spd * dt, ny * this.spd * dt);
      return;
    }
    const c = this.command;
    if (c && c.type === 'attack') {
      const t = c.target;
      if (!t.alive) { this.command = null; this.clearPath(); return; }
      const d = dist(this, t);
      const range = this.stats.range + t.r;
      const slack = this.ranged ? 0 : 6; // melee: close enough counts
      if (d <= range + slack && (!this.ranged || sc.nav.lineClear(this.x, this.y, t.x, t.y, 1))) {
        this.clearPath();
        this.face(t.x - this.x, t.y - this.y);
        this.startAttack(t);
      } else if (!this.ranged && d < range + 36 && sc.nav.lineClear(this.x, this.y, t.x, t.y, 3)) {
        // the last few steps: walk straight at it instead of re-pathing every frame
        this.clearPath();
        this.face(t.x - this.x, t.y - this.y);
        this.moveTowards(t, dt);
      } else {
        this.blockedT = Math.max(0, (this.blockedT || 0) - dt);
        if (this.blockedT > 0) return;
        this.repathT -= dt;
        if (!this.path || this.repathT <= 0) { this.path = null; this.setGoal(t.x, t.y); }
        this.followPath(dt);
      }
      return;
    }
    if (c && c.type === 'interact') {
      if (dist(this, c.obj) < (c.obj.reach || 20)) { this.clearPath(); this.command = null; c.obj.interact(this, c.obj); return; }
      if (!this.path) this.setGoal(c.obj.x, c.obj.y + (c.obj.standOff ?? 8));
      if (!this.followPath(dt) && !this.path) { this.command = null; }
      return;
    }
    if (c && c.type === 'move') {
      if (!this.followPath(dt)) this.command = null;
      return;
    }
    // idle: auto-retaliate against adjacent enemies attacking us
    const threat = sc.enemies.find((e) => e.alive && e.target === this && dist(e, this) < this.stats.range + 22);
    if (threat && !this.ranged) this.command = { type: 'attack', target: threat };
  }

  // ---------------------------------------------------------- companion AI
  updateCompanion(dt) {
    const sc = this.scene;
    const L = sc.leader;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.15; this.think(); }

    // 1) step out of telegraphed danger zones, and commit to it: keep going
    // until well clear (not just over the edge), or the AI flickers in and out
    const danger = sc.dangers.find((z) => Math.hypot(this.x - z.x, this.y - z.y) < z.r + (z === this.evading ? 12 : 4));
    if (danger) {
      this.evading = danger;
      const [nx, ny] = norm(this.x - danger.x, this.y - danger.y);
      this.face(nx, ny);
      this.moveBy(nx * this.spd * 1.3 * dt, ny * this.spd * 1.3 * dt);
      this.clearPath();
      return;
    }
    this.evading = null;

    // 2) revive a downed ally
    if (this.reviveTarget) {
      const r = this.reviveTarget;
      if (!r.downed) { this.reviveTarget = null; this.reviveT = 0; }
      else if (dist(this, r) < 14) {
        this.clearPath();
        this.play('cast');
        this.reviveT += dt;
        if (this.reviveT > (this.passive('steadyhands') ? 0.7 : 1.4)) { r.revive(0.4); audio.sfx('heal'); this.reviveTarget = null; this.reviveT = 0; } // Steady Hands: twice as fast
        return;
      } else { this.setGoal(r.x, r.y); this.followPath(dt, 1.2); return; }
    }

    // 3) stay with the leader: when the leader runs (moving, not attacking) the
    // party breaks off and follows; mid-fight nobody strays far from the leader
    const dl0 = dist(this, L);
    const leaderRunning = (L.command?.type === 'move' || (L.direct && (L.direct.x || L.direct.y))) && !(L.command?.type === 'attack');
    if (leaderRunning && dl0 > 56) { this.target = null; this.runOff = 1.2; }
    this.runOff = Math.max(0, (this.runOff || 0) - dt);
    if (this.runOff > 0) this.target = null;
    if (this.target && dl0 > (this.ranged ? 170 : 112)) this.target = null; // ranged allies hang back further

    // 4) fight
    const t = this.target;
    if (t && t.alive) {
      const d = dist(this, t);
      const st = this.stats;
      if (this.ranged) {
        // keep a comfortable firing distance (about 3/4 of range): back off when
        // the target gets inside it, with some slack so it doesn't jitter, and
        // never wander far from the leader
        const keep = Math.min(st.range - 12, Math.max(56 + t.r, st.range * 0.72));
        if (d < keep - 12) this.backing = true; else if (d >= keep) this.backing = false;
        if (this.backing && dl0 < 170) {
          const [nx, ny] = norm(this.x - t.x, this.y - t.y);
          const ox = this.x, oy = this.y;
          this.moveBy(nx * st.speed * dt, ny * st.speed * dt);
          if (Math.hypot(this.x - ox, this.y - oy) < st.speed * dt * 0.3) this.moveBy(-ny * st.speed * dt, nx * st.speed * dt); // backed into a wall: slide sideways
          this.face(t.x - this.x, t.y - this.y);
          this.clearPath();
          if (d > keep - 24) this.startAttack(t); // shoot while backing off, unless it's right on top of us: then just run
          return;
        }
        if (d <= st.range && sc.nav.lineClear(this.x, this.y, t.x, t.y, 1)) {
          this.clearPath();
          this.face(t.x - this.x, t.y - this.y);
          this.startAttack(t);
          return;
        }
        // close in for a clear shot, but on a leash: past ~7 tiles from the leader, come back
        if (dl0 > 110) { this.setGoal(L.x, L.y); this.followPath(dt, 1.2); return; }
        this.setGoal(t.x, t.y); this.followPath(dt);
        return;
      }
      // melee: approach a flank slot (opposite the leader / tank, not stacked)
      const slot = this.flankSlot(t);
      const reach = st.range + t.r;
      // don't walk back into an attack that's about to land: wait just outside it
      const [ax, ay] = norm(slot.x - this.x, slot.y - this.y);
      if (sc.dangers.some((z) => Math.hypot(this.x + ax * 10 - z.x, this.y + ay * 10 - z.y) < z.r + 6)) {
        this.clearPath();
        this.face(t.x - this.x, t.y - this.y);
        if (d <= reach + 6) this.startAttack(t);
        return;
      }
      if (d <= reach + 6) {
        this.clearPath();
        this.face(t.x - this.x, t.y - this.y);
        if (Math.hypot(this.x - slot.x, this.y - slot.y) > 5 && d > reach - 4) this.moveTowards(slot, dt, 0.6);
        this.startAttack(t);
        return;
      }
      // close in directly when near and unobstructed, path only from farther away
      if (d < reach + 40 && sc.nav.lineClear(this.x, this.y, t.x, t.y, 3)) { this.clearPath(); this.face(t.x - this.x, t.y - this.y); this.moveTowards(sc.nav.solidAtPx(slot.x, slot.y) ? t : slot, dt); return; }
      this.blockedT = Math.max(0, (this.blockedT || 0) - dt);
      if (this.blockedT > 0) { this.moveTowards(t, dt, 0.5); return; }
      this.setGoal(slot.x, slot.y);
      this.followPath(dt);
      return;
    }

    // 4) follow in formation behind the leader, on a loose lead: the slot is
    // smoothed (the leader's tile-path stair-steps and quick turns don't yank
    // it), we stay put inside a slack radius, and speed ramps with the gap
    // (ease in, ease out, catch up when far) instead of tracking every step
    const raw = this.formationSlot();
    const dl = dist(this, L);
    if (dl > 230) { this.teleportNear(raw); this.fspd = 0; return; }
    // smooth the slot's offset from the leader (which swings as it turns), not
    // the slot itself, so the slot never trails a walking leader
    const ox = raw.x - L.x, oy = raw.y - L.y, sa = Math.min(1, dt * 4);
    this.slotOff = this.slotOff ? { x: this.slotOff.x + (ox - this.slotOff.x) * sa, y: this.slotOff.y + (oy - this.slotOff.y) * sa } : { x: ox, y: oy };
    const sm = { x: L.x + this.slotOff.x, y: L.y + this.slotOff.y };
    const slot = this.scene.nav.solidAtPx(sm.x, sm.y) ? raw : sm;
    const ds = Math.hypot(this.x - slot.x, this.y - slot.y);
    const lsp = Math.hypot(L.vel?.x || 0, L.vel?.y || 0);
    // slack: settle once close and the leader has (nearly) stopped; only move
    // again when the gap has really opened up
    if (ds < 4 && lsp < 12) this.settled = true;
    else if (ds > 16 || (lsp > 30 && ds > 8)) this.settled = false;
    if (this.settled) {
      this.fspd = 0; this.pathing = false;
      this.clearPath();
      if (L.view) this.face(L.x - this.x + (L.view === 'side' ? (L.flip ? -40 : 40) : 0), L.y - this.y + (L.view === 'down' ? 40 : L.view === 'up' ? -40 : 0));
      return;
    }
    // direct while the slot is in plain view; once we've had to path round
    // something, stick with the path a moment (flicking between the two jitters)
    this.pathHoldT = Math.max(0, (this.pathHoldT || 0) - dt);
    if (this.pathHoldT <= 0 && ds < 60 && this.scene.nav.lineClear(this.x, this.y, slot.x, slot.y, 3)) {
      this.pathing = false;
      this.clearPath();
      // wanted speed: the leader's pace, plus a catch-up term for the gap
      // beyond the slack, eased so starts and stops aren't instant
      const want = Math.min(this.spd * 1.35, Math.max(0, lsp * 0.95 + (ds - 5) * 2.2));
      this.fspd = (this.fspd || 0) + (want - (this.fspd || 0)) * Math.min(1, dt * 5);
      const [nx, ny] = norm(slot.x - this.x, slot.y - this.y);
      // our own heading turns smoothly too
      const h = this.fhead || { x: nx, y: ny }, ha = Math.min(1, dt * 8);
      const hx = h.x + (nx - h.x) * ha, hy = h.y + (ny - h.y) * ha, hl = Math.hypot(hx, hy) || 1;
      this.fhead = { x: hx / hl, y: hy / hl };
      const stp = Math.min(ds, this.fspd * dt);
      if (lsp > 12 && L.head) this.face(L.head.x, L.head.y); // walk the way the party walks
      else if (this.fspd > 10) this.face(this.fhead.x, this.fhead.y);
      this.moveBy(this.fhead.x * stp, this.fhead.y * stp);
    } else {
      // out of sight of the slot (round a corner): path there
      if (!this.pathing) { this.pathing = true; this.pathHoldT = 0.5; }
      this.fspd = this.spd;
      this.repathT -= dt;
      if (!this.path || this.repathT <= 0) {
        this.path = null; this.setGoal(slot.x, slot.y);
        // skip waypoints we can already see past (a path from our tile's
        // centre can start behind us, which read as a step back)
        const nav = this.scene.nav;
        while (this.path?.length > 1 && nav.lineClear(this.x, this.y, this.path[1].x, this.path[1].y, 3)) this.path.shift();
      }
      this.followPath(dt, dl > 40 ? 1.3 : 1);
    }
  }

  moveTowards(p, dt, mul = 1) {
    const [nx, ny] = norm(p.x - this.x, p.y - this.y);
    this.moveBy(nx * this.spd * mul * dt, ny * this.spd * mul * dt);
  }

  think() {
    const sc = this.scene;
    const L = sc.leader;
    const st = this.stats;

    // downed ally? (not while enemies are right on top of us)
    const downed = sc.party.find((h) => h.downed);
    if (downed && !this.reviveTarget && !sc.party.some((h) => h !== this && h.reviveTarget === downed)) {
      const pressure = sc.enemies.some((e) => e.alive && e.target === this && dist(e, this) < 30);
      if (!pressure) this.reviveTarget = downed;
    }

    // ultimates: companions fire their own when it's worth it
    if (this.ult >= 100) {
      const near = sc.enemies.filter((e) => e.alive && e.engaged && dist(e, this) < 150);
      const boss = near.some((e) => e.boss);
      const hurt = sc.party.some((h) => !h.downed && h.hp / h.maxHp < 0.45);
      const id = this.ultimate.id;
      const want = (id === 'bulwark' && (hurt || near.length >= 3 || boss)) || (id === 'meteor' && (near.length >= 2 || boss)) || (id === 'thousand_cuts' && (near.length >= 2 || boss))
        || (id === 'talons' && (near.length >= 2 || boss)) || (id === 'primal' && (near.length >= 2 || boss || this.hp / this.maxHp < 0.5))
        || (id === 'dawnbreak' && (sc.party.some((p) => p.downed) || sc.party.filter((p) => !p.downed && p.hp / p.maxHp < 0.4).length >= 2))
        || (id === 'clank' && (near.length >= 2 || boss));
      if (want && sc.useUltimate(this)) return;
    }
    // pick a target: what the leader engages, else what's attacking us
    const engaged = sc.enemies.filter((e) => e.alive && e.engaged && dist(e, L) < 96);
    const leaderT = L.command && L.command.type === 'attack' && L.command.target.alive ? L.command.target : null;
    const byDist = (list) => list.sort((a, b) => dist(a, this) - dist(b, this));
    let t = null;
    if (st.role === 'tank') t = byDist(engaged.filter((e) => e.target && e.target !== this))[0] || leaderT || byDist(engaged)[0]; // protect squishies first
    else if (this.ranged) t = leaderT || byDist(engaged)[0];
    else t = leaderT || engaged.sort((a, b) => a.hp - b.hp)[0];

    // skills: first ready one whose rule says it's worth it right now; companions
    // pace themselves (one skill per ~1.5s) so fights don't turn into chaos
    const ctx = { target: t, engaged, leaderT };
    this.aiSkillT = Math.max(0, (this.aiSkillT || 0) - 0.15);
    for (let i = 0; i < this.skills.length && this.aiSkillT <= 0; i++) {
      const sk = this.skills[i];
      if (sk.t > 0) continue;
      const want = SKILL_FX[sk.id]?.ai?.(this, ctx);
      if (want && this.useSkill(i, want === true ? t : want)) { this.aiSkillT = 1.5; return; }
    }
    // never wander off after the ward stone unless the leader is hitting it
    if (t && (t.kind === 'ward' || t.kind === 'breakable') && leaderT !== t) t = null;
    this.target = t;
  }

  flankSlot(t) {
    const L = this.scene.leader;
    let [nx, ny] = norm(t.x - L.x, t.y - L.y);
    if (L === this) [nx, ny] = norm(t.x - this.x, t.y - this.y);
    const side = this.def.id === 'sable' ? 1 : -1;
    // 120 degrees around from the leader's side
    const a = Math.atan2(ny, nx) + side * 2.1;
    const r = this.stats.range + t.r - 2;
    return { x: t.x - Math.cos(a) * r, y: t.y - Math.sin(a) * r };
  }

  formationSlot() {
    const L = this.scene.leader;
    // the leader's smoothed heading, not its 4-way facing: a diagonal walk
    // flips facing back and forth, which made the slot (and Sable) jump
    const [fx, fy] = L.head ? [L.head.x, L.head.y] : L.facingVec();
    const idx = this.scene.party.filter((h) => !h.isLeader).indexOf(this);
    const side = idx === 0 ? -1 : 1;
    // behind the leader, offset to either side
    const bx = L.x - fx * 17 + -fy * side * 12;
    const by = L.y - fy * 14 + fx * side * 9;
    return this.scene.nav.solidAtPx(bx, by) ? { x: L.x - fx * 10, y: L.y - fy * 10 } : { x: bx, y: by };
  }

  teleportNear(p) {
    const sc = this.scene;
    const cam = sc.cameras.main.worldView;
    // only snap when the catch-up point is off-screen, or with a puff
    if (!sc.nav.solidAtPx(p.x, p.y)) {
      if (cam.contains(this.x, this.y)) sc.fx.puff(this.x, this.y, 'spark');
      this.x = p.x; this.y = p.y;
      sc.fx.puff(this.x, this.y, 'spark');
      this.clearPath();
    }
  }
}

// ---------------------------------------------------------------- Enemies
const ENEMY = enemyData;
const COWARDS = new Set(['goblin', 'rats', 'hexling']); // small fry that can break and run
const TOKEN_STATES = new Set(['windup', 'chargeWindup', 'charging', 'tongueWind']); // states that hold an attack token
const ENEMY_TEX = { goblin: 'goblin', hexling: 'hexling', mire: 'mire', golem: 'golem', archer: 'archer', knight: 'knight', rats: 'rats', hollow: 'hollow', hollowpile: 'hollowpile', boar: 'boar', crab: 'crab', wisp: 'wisp', warlock: 'warlock', snagtooth: 'goblin', pitchamp: 'goblin', drowned: 'drowned', witchling: 'witchling', leeches: 'leeches', lurker: 'lurker', croaker: 'croaker', snapjaw: 'snapjaw', murk: 'murk', shade: 'shade', huntsman: 'huntsman', huntecho: 'huntsman', rootling: 'rootling', spider: 'spider', spiderling: 'spiderling', hound: 'hound', banshee: 'banshee', mab: 'mab', eggsac: 'eggsac', imp: 'imp', slug: 'slug', salamander: 'salamander', brute: 'brute', beetle: 'beetle', drake: 'drake', vulk: 'vulk' };
const PUPPETS = new Set(['goblin', 'archer', 'knight', 'hollow', 'warlock', 'snagtooth', 'pitchamp', 'drowned', 'witchling', 'shade', 'banshee', 'huntsman', 'huntecho', 'salamander', 'vulk']);

// Elite affixes (C7): every elite gets one, named on its tag so it's clear
// what makes it dangerous and how to answer it.
export const AFFIXES = {
  swift: 'SWIFT', armored: 'ARMORED', vampiric: 'VAMPIRIC', volatile: 'VOLATILE',
  warded: 'WARDED', splitting: 'SPLITTING', shielder: 'SHIELDER', frenzied: 'FRENZIED',
};

export class Enemy extends Unit {
  constructor(scene, kind, x, y, { level = 1, elite = false } = {}) {
    const base = ENEMY[kind];
    // level scaling within the region's band, plus the elite affix
    if (!Number.isFinite(level)) level = 1; // never let a bad level poison health and damage
    const L1 = level - 1;
    const hpMul = (1 + L1 * tuning.enemyHpGrowth) * (elite ? 1.8 : 1);
    const dmgMul = (1 + L1 * tuning.enemyDmgGrowth) * (elite ? 1.15 : 1);
    const s = { ...base, dmg: base.dmg * dmgMul, xp: Math.round(base.xp * (1 + L1 * tuning.enemyXpGrowth) * (elite ? 2.5 : 1)), gold: base.gold.map((g) => Math.round(g * (elite ? 2 : 1) * (1 + L1 * tuning.enemyGoldGrowth))) };
    super(scene, x, y, { key: ENEMY_TEX[kind], frame: PUPPETS.has(kind) ? 'idle_down_0' : base.inert ? undefined : 'idle_0', maxHp: Math.round(base.maxHp * hpMul * scene.difficulty.hp), team: 'enemy', r: s.r, shadow: s.boss ? 'shadowXL' : 'shadow' });
    this.kind = kind;
    this.tex = ENEMY_TEX[kind];
    this.puppet = PUPPETS.has(kind);
    this.level = level;
    this.elite = elite;
    this.affix = null;
    if (elite && !base.named && !base.boss && !base.inert) {
      const pool = Object.keys(AFFIXES).filter((a) => !((a === 'splitting' || a === 'armored') && base.ranged));
      this.affix = pool[Math.floor(Math.random() * pool.length)];
      if (this.affix === 'swift') { s.speed *= 1.4; if (s.windup) s.windup *= 0.75; if (s.recover) s.recover *= 0.8; }
    }
    this.s = s;
    this.spawn = { x, y };
    this.state = 'idle';
    this.t = 0;
    this.target = null;
    this.stunT = 0;
    this.tauntT = 0; this.taunter = null;
    this.wanderT = Math.random() * 2;
    this.anim = '';
    this.hop = Math.random() * 6;
    this.engaged = false;
    this.cursed = scene.inCurse(x, y, 0);
    if (s.scale) this.sprite.setScale(s.scale);
    if (s.ai === 'lurk') this.submerge(true);
    if (s.rise) { this.riseT = 0.7; this.sprite.setAlpha(0); scene.fx.burst('foam', x, y, 10); }
    if (s.named) { this.elite = true; this.named = true; }
    if (s.alpha) this.sprite.setAlpha(s.alpha);
    this.restoreTint();
  }

  restoreTint() {
    const t = this.statusColor();
    if (t) this.sprite.setTint(t);
    else if (this.frenzy) this.sprite.setTint(0xff8a7a);
    else if (this.elite) this.sprite.setTint(0xffd889);
    else if (this.s.tint) this.sprite.setTint(this.s.tint); // ghosts keep their pallor
    else if (this.puppet && this.cursed) this.sprite.setTint(0xd9b8ff);
    else this.sprite.clearTint();
  }

  statusColor() {
    const st = this.status;
    if (!st) return 0;
    if (st.freeze) return 0x7fd0ff;
    if (st.chill) return 0x9fdcff;
    if (st.burn) return 0xffb08a;
    if (st.poison) return 0xb8ff9a;
    if (st.shock) return 0xc8d8ff;
    if (st.weaken) return 0xb89ad8;
    return 0;
  }

  play(anim) {
    const key = this.puppet ? `${this.tex}_${anim === 'windup' ? 'attack' : anim === 'recover' ? 'idle' : anim}_${this.view}` : `${this.tex}_${anim === 'recover' ? 'idle' : anim}`;
    if (this.anim !== key) {
      this.anim = key;
      if (this.puppet && anim === 'windup') {
        // hold the first attack frame as a readable telegraph
        this.sprite.anims.stop();
        this.sprite.setFrame(`attack_${this.view}_0`);
      } else this.sprite.play(key);
    }
  }

  stun(t) {
    if (this.s.ai === 'shell') { this.flippedT = 3; this.anim = ''; this.sprite.play(`${this.tex}_flipped`); this.anim = `${this.tex}_flipped`; this.clearZone(); this.state = 'chase'; this.scene.floatText(this.x, this.y - 22, 'FLIPPED!', 'fontGold'); return; }
    this.stunT = Math.max(this.stunT, t); this.state = 'chase'; this.clearZone(); this.scene.floatText(this.x, this.y - 22, 'STUN', 'fontPlain');
  }

  // flying foes drift over water and walls
  moveBy(dx, dy) { if (this.s.flying) { this.x += dx; this.y += dy; } else super.moveBy(dx, dy); }

  // Damage multiplier for an element hitting this enemy (C2: weak x1.5, resist x0.5).
  elementMul(el) {
    if (!el) return 1;
    if (this.affix === 'warded' && el !== 'light') return 0.5;
    if (this.s.resist === el || (this.s.hexed && el === 'shadow')) return 0.5;
    if (this.s.weak === el || (this.s.hexed && el === 'light')) return 1.5;
    return 1;
  }

  // Elemental statuses (C2). src = the hero who applied it.
  applyElement(el, src) {
    if (!el || !this.alive || this.elementMul(el) < 1) return;
    this.status ??= {};
    const weak = this.elementMul(el) > 1 ? 1.5 : 1;
    const dur = weak * (1 + (src.passive ? src.passive('attunement') ? 0.5 + 0.1 * (src.passive('attunement') - 1) : 0 : 0));
    const base = src.stats.atk;
    const sc = this.scene;
    if (el === 'fire') this.status.burn = { t: 3 * dur * (src.hasPerk?.('circlet') ? 1.5 : 1), tick: 0.5, next: 0.5, dmg: base * 0.12 }; // Ember Circlet: +50%
    else if (el === 'venom') {
      const n = Math.min(src.hasPerk?.('wyrmfang') ? 7 : 5, (this.status.poison?.n || 0) + 1); // Wyrmfang: stacks to 7
      this.status.poison = { t: 4 * dur, tick: 0.6, next: this.status.poison?.next ?? 0.6, dmg: base * 0.09, n, src };
    } else if (el === 'frost') {
      const n = (this.status.chill?.n || 0) + 1;
      this.status.chill = { t: 3 * dur, n };
      if (n >= 3) {
        delete this.status.chill;
        if (this.boss) this.status.chill = { t: 2 * dur, n: 2, heavy: true };
        else { this.status.freeze = { t: 1.5 * dur }; this.stunT = Math.max(this.stunT, 1.5 * dur); this.clearZone(); sc.floatText(this.x, this.y - 30, 'FROZEN', 'fontPlain', 0x9fe6ff); }
      }
    } else if (el === 'storm') {
      this.status.shock = { t: 3 * dur };
      if (this.state === 'windup' && !this.boss) { this.clearZone(); this.state = 'recover'; this.t = 0; sc.floatText(this.x, this.y - 30, 'INTERRUPT', 'fontPlain', 0xc8d8ff); }
    } else if (el === 'light') {
      if (this.status.buff) delete this.status.buff;
    } else if (el === 'shadow') this.status.weaken = { t: 4 * dur };
    if (weak > 1 && !this.weakShown) { this.weakShown = true; sc.floatText(this.x, this.y - 40, 'WEAK!', 'fontGold'); }
    this.statusTint();
  }

  // Kesh's Rend: a physical bleed that stacks (up to 5)
  addBleed(dps, t) {
    this.status ??= {};
    const n = Math.min(5, (this.status.bleed?.n || 0) + 1);
    this.status.bleed = { t, tick: 0.5, next: this.status.bleed?.next ?? 0.5, dmg: dps * 0.5, n };
  }

  get slow() { return this.status?.chill ? (this.status.chill.heavy ? 0.4 : 0.7) : 1; }

  statusTint() {
    if (this.flashT > 0) return;
    this.restoreTint();
  }

  updateStatus(dt) {
    if (!this.status) return;
    const sc = this.scene;
    for (const [k, st] of Object.entries(this.status)) {
      st.t -= dt;
      if (st.tick) {
        st.next -= dt;
        if (st.next <= 0 && this.alive) {
          st.next += st.tick;
          const d = Math.max(1, Math.round(st.dmg * (st.n || 1)));
          sc.floatText(this.x + (Math.random() * 8 - 4), this.y - 18, `${d}`, 'font', k === 'burn' ? 0xffa060 : k === 'bleed' ? 0xff6a6a : 0x9cff7a);
          sc.fx.burst(k === 'burn' ? 'ember' : k === 'bleed' ? 'spark' : 'heal', this.x, this.y - 8, 3);
          this.damage(d, sc.leader, { knock: 0, dot: true });
          if (!this.alive) return;
        }
      }
      if (st.t <= 0) { delete this.status[k]; this.statusTint(); }
    }
    if (this.marked) { this.marked.t -= dt; if (this.marked.t <= 0) this.marked = null; }
    if (this.hawkMarked) { this.hawkMarked.t -= dt; if (this.hawkMarked.t <= 0) this.hawkMarked = null; }
  }

  setTaunt(by, t) { this.taunter = by; this.tauntT = t; this.target = by; this.engaged = true; if (this.state === 'idle') this.state = 'chase'; }

  // Sticky targeting: a foe commits to its target for a couple of seconds and
  // never switches mid-swing; after that it switches only for a reason (someone
  // hurting it far more, or its target out of reach while another hero is right
  // here). Remembered damage fades. A taunt always wins.
  noteAttacker(src, amount) {
    (this.threat ??= new Map()).set(src, (this.threat.get(src) || 0) + amount);
    const t = this.target;
    if (!t || t.downed || !t.alive || !this.engaged) { this.aggroOn(src); return; }
    if (t === src || this.tauntT > 0 || TOKEN_STATES.has(this.state) || (this.commitT || 0) > 0) return;
    const reach = (this.s.reach || 16) + 10;
    const outOfReach = dist(this, t) > reach + 50 && dist(this, src) < reach + (src.r || 5) + 10;
    const harder = this.threat.get(src) > (this.threat.get(t) || 0) * 1.6;
    if (outOfReach || harder) { this.target = src; this.commitT = 2; }
  }

  aggroOn(h, spread = true) {
    if (!h || h.downed || this.staged) return;
    // archers and casters go for the most fragile hero they can reach
    if (this.s.ranged && !(this.tauntT > 0)) {
      // ...spread across them, so a whole archer line doesn't queue on one hero
      const load = (p) => this.scene.enemies.filter((e) => e !== this && e.alive && e.s.ranged && e.target === p).length;
      const soft = this.scene.party.filter((p) => p.alive && !p.downed && dist(p, this) < this.s.aggro * 1.4).sort((a, b) => (a.maxHp + load(a) * 70) - (b.maxHp + load(b) * 70))[0];
      if (soft) h = soft;
    }
    this.pickRole();
    if (this.role === 'flank' && !(this.tauntT > 0)) {
      const soft = this.scene.party.filter((p) => p.alive && !p.downed && !p.isLeader && dist(p, this) < this.s.aggro * 1.6).sort((a, b) => a.maxHp - b.maxHp)[0];
      if (soft) h = soft;
    }
    this.commitT = 2;
    const was = this.engaged;
    this.target = this.tauntT > 0 ? this.taunter : h;
    this.engaged = true;
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    if (!was) {
      this.scene.fx.alert(this);
      if (this.elite) this.scene.floatText(this.x, this.y - 34, this.named ? this.s.name : `${this.affix ? AFFIXES[this.affix] : 'ELITE'} ${this.s.name}`, 'fontGold');
      if (spread) for (const e of this.scene.enemies) if (e !== this && e.alive && !e.engaged && dist(e, this) < 70 && e.onScreen(0)) e.aggroOn(h, false); // packmates out of view notice for themselves once seen
    }
  }

  damage(amount, src, { crit = false, knock = 40, dot = false } = {}) {
    if (!this.alive) return 0;
    if (this.submerged || this.introT > 0 || this.invulnT > 0) return 0; // invulnT: aloft (the drake's dive)
    if (this.staged && src?.team === 'party') {
      // only a deliberate hit starts an errand fight: the leader's (you), or a
      // companion's aimed at us. Strays from a fight nearby glance off.
      if (!src.isLeader && src.target !== this) return 0;
      this.engageStaged(src instanceof Hero && !src.downed ? src : this.scene.leader);
    }
    // Armored: a frontal guard. Hit it from the side or behind, while it's stunned, or Shock it
    if ((this.affix === 'armored' || this.s.guard) && src && !dot && !(this.stunT > 0) && !this.status?.shock) {
      const f = this.view === 'side' ? [this.flip ? -1 : 1, 0] : [0, this.view === 'down' ? 1 : -1];
      const [dx, dy] = norm(src.x - this.x, src.y - this.y);
      if (f[0] * dx + f[1] * dy > 0.3) {
        amount *= 0.35;
        if (!this.guardMsgT || this.scene.time.now > this.guardMsgT) { this.guardMsgT = this.scene.time.now + 1500; this.scene.floatText(this.x, this.y - 30, 'GUARDED - FLANK IT', 'fontPlain', 0xbfd0e6); audio.sfx('block'); }
      }
    }
    // Basalt Brute: rock armour turns most of a blow until it cracks - to Storm,
    // a shock, the Gauntlets' slam, or simply enough hits chipping it away
    if (this.s.ai === 'brute' && !this.cracked && src) {
      this.chips = (this.chips || 0) + (dot ? 0 : 1);
      const fist = src.team === 'party' && !src.ranged && !dot && this.scene.state.relics.includes('gauntlets'); // the Stone Gauntlets crack rock
      if (this.lastElement === 'storm' || this.status?.shock || fist || this.chips >= 8) this.crackArmour();
      else {
        amount *= 0.2;
        if (!this.guardMsgT || this.scene.time.now > this.guardMsgT) { this.guardMsgT = this.scene.time.now + 1800; this.scene.floatText(this.x, this.y - 34, 'ROCK ARMOUR', 'fontPlain', 0xbfb0a8); audio.sfx('block'); }
      }
    }
    if (this.s.ai === 'shell' && src && !dot) {
      // the shell turns blows from the front; a flipped crab takes extra
      if (this.flippedT > 0) amount *= 1.5;
      else {
        const f = this.view === 'side' ? [this.flip ? -1 : 1, 0] : [0, this.view === 'down' ? 1 : -1];
        const [dx, dy] = norm(src.x - this.x, src.y - this.y);
        if (f[0] * dx + f[1] * dy > 0.2) { amount *= 0.3; if (Math.random() < 0.3) this.scene.floatText(this.x, this.y - 24, 'CLANG', 'fontPlain'); }
      }
    }
    if (this.wardShield > 0 && !dot) {
      const a = Math.min(this.wardShield, amount);
      this.wardShield -= a; amount -= a;
      if (this.wardShield <= 0) { this.wardRing?.destroy(); this.wardRing = null; }
      if (amount <= 0) { this.scene.floatText(this.x, this.y - 24, 'WARDED', 'fontPlain', 0xd9b8ff); return 1; }
    }
    amount = Math.round(amount);
    this.hp -= amount;
    if (!dot) this.flash(crit ? 90 : 60);
    if (knock && this.state !== 'windup') this.knock(this.x - src.x, this.y - src.y, knock);
    else if (knock) this.knock(this.x - src.x, this.y - src.y, knock * 0.3);
    if (src && src.team === 'party') this.noteAttacker(src, amount);
    if (this.hp <= 0) this.die(src);
    else if (this.elite) this.affixOnHurt();
    else if (!this.fled && COWARDS.has(this.kind) && !this.boss && this.hp < this.maxHp * 0.25 && this.mayFlee()) this.flee(src);
    return amount;
  }

  // Morale is rare: most foes stand and fight. Only about one small fry in
  // six has the nerve to break, never the last of its group, and never while
  // a nearby ally is already running.
  mayFlee() {
    this.morale ??= Math.random();
    if (this.morale > 0.17) return false;
    const near = this.scene.enemies.filter((e) => e !== this && e.alive && dist(e, this) < 160);
    return near.length > 0 && !near.some((e) => e.state === 'flee');
  }

  // Morale (group roles): a small fry that breaks runs a short way and
  // shouts for help (idle allies nearby join in), then comes back.
  flee(src) {
    this.fled = true;
    this.clearZone();
    this.state = 'flee'; this.t = 0; this.token = null;
    this.fleeFrom = src && src.alive ? src : this.scene.leader;
    this.scene.floatText(this.x, this.y - 26, 'HELP!', 'fontPlain', 0xffd04a);
    for (const e of this.scene.enemies) if (e !== this && e.alive && !e.engaged && !e.staged && dist(e, this) < 160 && e.onScreen(0)) e.aggroOn(this.fleeFrom, false);
  }

  // Group roles: in a pack of four or more melee foes, about one in three
  // flanks, going for the back line (the most fragile hero) instead of the leader.
  pickRole() {
    if (this.role || this.boss || this.s.ranged) return;
    if (this.s.ai === 'pack') { this.role = 'flank'; return; } // spectral hounds always circle round
    this.role = 'front';
    const pack = this.scene.enemies.filter((e) => e.alive && !e.s.ranged && !e.boss && dist(e, this) < 140).length;
    if (pack >= 4 && Math.random() < 0.34) this.role = 'flank';
  }

  // ---- elite affixes
  affixDmg() { return this.frenzy ? 1.5 : 1; }

  affixOnHurt() {
    const sc = this.scene;
    if (this.affix === 'frenzied' && !this.frenzy && this.hp < this.maxHp / 2) {
      this.frenzy = true;
      this.restoreTint();
      sc.floatText(this.x, this.y - 34, 'FRENZY!', 'fontGold', 0xff8a7a);
      audio.sfx('roar');
    }
    if (this.affix === 'splitting' && !this.splitDone && this.hp < this.maxHp / 2) {
      this.splitDone = true;
      sc.floatText(this.x, this.y - 34, 'SPLIT!', 'fontGold');
      sc.fx.burst('curse', this.x, this.y - 8, 16);
      for (const dx of [-14, 14]) {
        const e = sc.spawnEnemy(this.kind, this.x + dx, this.y + 4, true, false);
        e.maxHp = Math.max(1, Math.round(this.maxHp * 0.3)); e.hp = e.maxHp;
        e.sprite.setScale(0.85);
      }
    }
  }

  // Vampiric: heals by the damage it deals, with a visible drain line back to it
  vampHeal(amount, from) {
    if (!this.alive) return;
    const sc = this.scene, heal = Math.round(amount * 0.3);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    sc.floatText(this.x, this.y - 30, `+${heal}`, 'font', 0xff6a8a);
    const g = sc.add.graphics().setDepth(100000 - 19);
    const st = { a: 1 };
    sc.tweens.add({ targets: st, a: 0, duration: 420, onUpdate: () => { if (!g.active) return; g.clear().lineStyle(3, 0x8a1030, 0.5 * st.a).lineBetween(from.x, from.y - 10, this.x, this.y - 10).lineStyle(1, 0xff6a8a, st.a).lineBetween(from.x, from.y - 10, this.x, this.y - 10); }, onComplete: () => g.destroy() });
  }

  affixTick(dt) {
    if (this.affix !== 'shielder' || !this.engaged) return;
    const sc = this.scene;
    this.shieldT = (this.shieldT ?? 2) - dt;
    if (this.shieldT > 0) return;
    this.shieldT = 7;
    for (const e of sc.enemies) {
      if (e === this || !e.alive || e.s.inert || Math.hypot(e.x - this.x, e.y - this.y) > 90) continue;
      e.wardShield = Math.round(e.maxHp * 0.3);
      e.wardRing?.destroy();
      e.wardRing = sc.add.ellipse(e.x, e.y - 8, 26, 30, 0x6f93e0, 0.12).setStrokeStyle(1, 0x9fd8ff, 0.8).setDepth(e.y + 2);
    }
    sc.fx.ring(this.x, this.y - 6, 'ringBlue', 4);
    sc.floatText(this.x, this.y - 30, 'SHIELDS ALLIES!', 'fontPlain', 0x9fd8ff);
    audio.sfx('frost', { pitch: 0.9 });
  }

  // Volatile: blows up shortly after it dies (the circle shows where)
  volatileBlast() {
    const sc = this.scene, x = this.x, y = this.y, r = 40, t = 1.6;
    const zone = { x, y, r, until: t };
    sc.dangers.push(zone);
    const g = sc.fx.telegraph(x, y, r, t);
    sc.floatText(x, y - 30, 'IT WILL BLOW!', 'fontGold', 0xffa060);
    const dmg = this.s.dmg * 1.4 * sc.difficulty.dmg;
    sc.time.delayedCall(t * 1000, () => {
      g.destroy(); sc.dangers = sc.dangers.filter((z) => z !== zone);
      sc.fx.slam(x, y, r); sc.fx.burst('ember', x, y - 6, 24); sc.shake(260, 0.01); audio.sfx('bash');
      for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - x, h.y - y) <= r + h.r) h.damage(dmg, { x, y });
    });
  }

  destroy() { this.wardRing?.destroy(); this.wardRing = null; this.eliteTag?.destroy(); this.eliteTag = null; this.clearZone(); super.destroy(); }

  die(src) {
    this.alive = false;
    // Hollow Guards fall apart and reform unless burning or struck with light
    if (this.s.reassemble && !this.reassembled && !this.status?.burn && this.lastElement !== 'light' && this.lastElement !== 'fire') {
      const sc = this.scene;
      sc.time.delayedCall(10, () => { const p = sc.spawnEnemy('hollowpile', this.x, this.y + 2, false); p.sprite.setOrigin(0.5, 0.8); sc.floatText(this.x, this.y - 30, 'SMASH THE ARMOUR!', 'fontPlain', 0xffd04a); });
    }
    if (this.marked) { const sk = this.marked.sk; if (sk) sk.t = 0; this.scene.floatText(this.x, this.y - 40, 'MARK RESET', 'fontPlain', 0xff6a6a); }
    if (this.affix === 'volatile') this.volatileBlast();
    if (this.s.ai === 'bomber' && !this.burst) this.beetleBurst(14); // it pops when it dies, too
    const pz = this.status?.poison; // Wyrmfang pair: the poison jumps to whoever's near
    if (pz?.src?.alive && pz.src.hasPerk?.('wyrmfang') && pz.src.hasPerk('twinfang')) {
      const sc = this.scene, near = sc.enemies.filter((e) => e !== this && e.alive && Math.hypot(e.x - this.x, e.y - this.y) < 48);
      for (const e of near) for (let i = 0; i < Math.min(3, pz.n); i++) e.applyElement('venom', pz.src);
      if (near.length) { sc.fx.burst('heal', this.x, this.y - 8, 12); sc.floatText(this.x, this.y - 34, 'SPREAD', 'fontPlain', 0x9cff7a); }
    }
    this.clearZone();
    this.scene.onEnemyKilled(this, src);
    this.destroy();
  }

  sync(dt) {
    super.sync(dt);
    if (this.s.flying) this.sprite.y = Math.round(this.y) - 8 - Math.sin(Date.now() / 300 + this.id) * 2;
    if (this.wardRing) this.wardRing.setPosition(Math.round(this.x), Math.round(this.y) - 8).setDepth(this.y + 2);
  }

  clearZone() {
    this.clearCharge?.();
    if (this.zone) { this.scene.dangers = this.scene.dangers.filter((z) => z !== this.zone); this.zone = null; }
    if (this.zoneGfx) { this.zoneGfx.destroy(); this.zoneGfx = null; }
  }

  update(dt) {
    if (!this.alive) return;
    if (this.s.inert) {
      // armour pile: if nobody smashes it in time, the Hollow Guard stands back up
      this.reformT = (this.reformT ?? (this.s.hatch?.t || 5)) - dt;
      this.sprite.setAngle(this.reformT < 1.5 ? Math.sin(this.reformT * 40) * 4 : 0);
      if (this.reformT <= 0) {
        this.alive = false; this.destroy();
        if (this.s.hatch) { // an egg sac: spiderlings spill out
          for (let i = 0; i < this.s.hatch.n; i++) this.scene.spawnEnemy(this.s.hatch.kind, this.x + (i - 0.5) * 10, this.y + 4, true);
          this.scene.fx.burst('spark', this.x, this.y - 4, 8); audio.sfx('squish');
        } else {
          const g = this.scene.spawnEnemy('hollow', this.x, this.y, true);
          g.hp = Math.round(g.maxHp * 0.5); g.reassembled = true;
          this.scene.floatText(this.x, this.y - 30, 'IT REASSEMBLED!', 'fontPlain', 0xd9b8ff);
        }
      }
      this.sync(dt);
      return;
    }
    this.physics(dt);
    this.tauntT = Math.max(0, this.tauntT - dt);
    if (this.token && !TOKEN_STATES.has(this.state)) this.token = null;
    this.commitT = Math.max(0, (this.commitT || 0) - dt);
    if (this.threat) for (const [k, v] of this.threat) this.threat.set(k, v * (1 - dt * 0.25)); // grudges fade
    if (this.staged) { this.updateStaged(dt); this.sync(dt); if (this.staged) return; }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.play('idle');
      this.sprite.setAngle(Math.sin(this.stunT * 30) * 6);
      this.sync(dt);
      return;
    }
    this.sprite.setAngle(0);
    const sc = this.scene;
    const s = this.s;
    this.updateStatus(dt);
    if (!this.alive) return;
    if (this.flippedT > 0) { this.flippedT -= dt; if (this.flippedT <= 0) this.anim = ''; this.sync(dt); return; }
    if (this.introT > 0) {
      this.introT -= dt; this.play('idle'); this.sync(dt);
      if (this.introT <= 0 && this.introTarget?.alive) this.aggroOn(this.introTarget);
      return;
    }
    if (this.riseT > 0) { this.riseT -= dt; this.sprite.setAlpha(1 - Math.max(0, this.riseT) / 0.7); this.sync(dt); if (this.riseT > 0) this.sprite.y += this.riseT * 14; return; }
    if (s.ai === 'lurk' && this.aiLurk(dt)) { this.sync(dt); return; }
    if (s.ai === 'blink' && this.engaged) { this.blinkT = (this.blinkT ?? 4) - dt; if (this.blinkT <= 0 && this.state === 'chase') this.blinkAway(); }
    if (s.ai === 'warlock' && this.engaged) this.aiWarlock(dt);
    if (s.ai === 'shade') this.aiShade(dt);
    if (s.ai === 'banshee' && this.engaged && this.aiBanshee(dt)) { this.sync(dt); return; }
    if (s.ai === 'mab' && this.engaged) this.aiMab(dt);
    if (s.ai === 'web') this.webCd = Math.max(0, (this.webCd ?? 0.3) - dt);
    if (s.ai === 'trail' && this.engaged) this.aiTrail(dt);
    if (s.ai === 'bomber' && this.engaged && this.aiBomber(dt)) { this.sync(dt); return; }
    if (s.ai === 'drake' && this.engaged && this.aiDrake(dt)) { this.sync(dt); return; }
    if (this.affix) this.affixTick(dt);
    // elites read the party's telegraphed area attacks (Meteor, Volley) and step out
    if ((this.elite || this.named) && !this.boss && this.state !== 'charging' && sc.partyZones?.length) {
      const now = sc.time.now;
      sc.partyZones = sc.partyZones.filter((z) => z.until > now);
      const z = sc.partyZones.find((q) => Math.hypot(this.x - q.x, this.y - q.y) < q.r + 6);
      if (z) {
        if (TOKEN_STATES.has(this.state)) { this.clearZone(); this.state = 'chase'; this.t = 0; } // abandon the swing to get clear
        const [nx, ny] = norm(this.x - z.x, this.y - z.y);
        this.face(nx, ny); this.moveBy(nx * s.speed * 1.6 * dt, ny * s.speed * 1.6 * dt); this.play('walk');
        this.sync(dt);
        return;
      }
    }
    if (this.fearT > 0) {
      // Howl: run from Kesh
      this.fearT -= dt;
      const [nx, ny] = norm(this.x - this.fearFrom.x, this.y - this.fearFrom.y);
      this.face(nx, ny); this.moveBy(nx * s.speed * 1.3 * dt, ny * s.speed * 1.3 * dt); this.play('walk');
      this.sync(dt);
      return;
    }
    this.chargeCd = Math.max(0, (this.chargeCd || 0) - dt);
    this.tongueCd = Math.max(0, (this.tongueCd || 0) - dt);
    this.t += dt * this.slow;

    if (this.target && (this.target.downed || !this.target.alive)) {
      this.target = sc.nearestHero(this, s.aggro * 1.5);
      if (!this.target) { this.state = 'return'; this.engaged = false; }
    }

    switch (this.state) {
      case 'idle': {
        const h = this.notice(s.aggro);
        if (h) { this.aggroOn(h); break; }
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          this.wander = { x: this.spawn.x + Math.cos(a) * 24, y: this.spawn.y + Math.sin(a) * 24 };
        }
        if (this.wander && Math.hypot(this.wander.x - this.x, this.wander.y - this.y) > 3) this.stepTo(this.wander, dt, 0.4);
        else this.play('idle');
        break;
      }
      case 'chase': {
        this.waiting = false;
        const t = this.target;
        if (!t) { this.state = 'return'; break; }
        // give up the chase only when it's really lost: dragged far from home
        // (much further in dungeons; never out of a sealed fight room), or the
        // target is both far away and out of sight for a while
        const d = dist(this, t);
        const lost = d > s.aggro * 1.4 && !(d < s.aggro * 2.2 && this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 1));
        this.loseT = lost ? (this.loseT || 0) + dt : 0;
        const leash = this.noLeash ? Infinity : this.scene.areaRect?.().interior ? 360 : 200;
        if (!this.boss && !this.noLeash && (Math.hypot(this.x - this.spawn.x, this.y - this.spawn.y) > leash || this.loseT > 2.5)) { this.state = 'return'; this.engaged = false; this.target = null; this.loseT = 0; this.homeT = 0; this.clearZone(); break; }
        if (s.ranged) {
          // archers keep their distance and need a clear shot: back off along
          // open floor (not into walls), sidestep to find an angle, and shift
          // position a little after shooting
          if (d < s.keepAway) { this.backOff(t, dt); break; }
          if (this.repos && (this.reposT = (this.reposT || 0) - dt) > 0 && Math.hypot(this.repos.x - this.x, this.repos.y - this.y) > 3) { this.stepTo(this.repos, dt, 0.8); break; }
          this.repos = null;
          const clear = this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 1);
          if (d <= s.reach && !clear) { this.strafe(t, dt); break; }
          if (d <= s.reach && this.onScreen() && clear) {
            if (this.takeToken(t)) this.beginWindup(t); else { this.waiting = true; this.face(t.x - this.x, t.y - this.y); this.play('idle'); this.keepApart(dt); } // wait for a turn to shoot
            break;
          }
          this.stepTo(t, dt, 1);
          break;
        }
        if (s.ai === 'tongue' && (this.tongueCd || 0) <= 0 && d > 34 && d < s.reach && this.onScreen() && this.takeToken(t)) { this.beginTongue(t); break; }
        if (s.ai === 'mab' && (this.tongueCd ?? 3) <= 0 && d > 60 && d < s.pullRange && this.onScreen() && this.takeToken(t)) { this.beginTongue(t); break; }
        if (s.ai === 'web' && this.webCd <= 0 && d > 30 && d < 110 && this.onScreen() && this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 1) && this.takeToken(t)) { this.spitWeb(t); break; }
        if (s.ai === 'charge' && this.chargeCd <= 0 && d > 40 && d < 130 && this.onScreen() && this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 2) && this.takeToken(t)) { this.beginCharge(t); break; }
        // melee: surround the target; only a few may wind up on it at once (the
        // rest wait just outside reach for a turn)
        const free = this.tokenFree(t);
        if (free && d <= s.reach + t.r && this.takeToken(t)) { this.beginWindup(t); break; }
        const slot = this.boss ? t : this.surroundSlot(t, free ? s.reach + t.r - 3 : s.reach + t.r + 18);
        this.waiting = !free; // holding outside reach for a turn (not stuck)
        if (Math.hypot(slot.x - this.x, slot.y - this.y) > 3) this.stepTo(slot, dt, free ? 1 : 0.6);
        else { this.waiting = true; this.face(t.x - this.x, t.y - this.y); this.play('idle'); this.keepApart(dt); }
        break;
      }
      case 'tongueWind': {
        this.play('windup');
        if (this.t >= 0.8) { this.tongue(); }
        break;
      }
      case 'chargeWindup': {
        this.play('windup');
        if (Math.random() < 0.2) sc.fx.dust(this.x - this.cdir[0] * 8, this.y);
        if (this.t >= 0.8) { this.clearCharge(); this.state = 'charging'; this.t = 0; this.chargeHit = new Set(); audio.sfx('dash'); }
        break;
      }
      case 'charging': {
        this.play('walk');
        const ox = this.x, oy = this.y;
        this.moveBy(this.cdir[0] * 230 * dt, this.cdir[1] * 230 * dt);
        if (Math.random() < 0.5) sc.fx.dust(this.x, this.y);
        for (const h of sc.party) if (h.alive && !h.downed && !this.chargeHit.has(h) && Math.hypot(h.x - this.x, h.y - this.y) < this.r + h.r + 3) { this.chargeHit.add(h); h.damage(s.dmg * 1.3 * sc.difficulty.dmg, this); h.knock(this.cdir[0], this.cdir[1], 160); }
        if (Math.hypot(this.x - ox, this.y - oy) < 230 * dt * 0.3) { this.state = 'chase'; this.chargeCd = 3.5; this.stunT = 1.6; sc.shake(120, 0.006); audio.sfx('bash'); sc.floatText(this.x, this.y - 24, 'THUNK!', 'fontPlain'); break; }
        if (this.t >= 0.6) { this.state = 'recover'; this.t = 0; this.chargeCd = 3.5; }
        break;
      }
      case 'windup': {
        this.play('windup');
        this.keepApart(dt); // the strike lands on its marked zone, so a little sidestep is safe
        if (this.t >= s.windup) this.strike();
        break;
      }
      case 'flee': {
        const f = this.fleeFrom;
        const [nx, ny] = f ? norm(this.x - f.x, this.y - f.y) : [0, 1];
        this.stepTo({ x: this.x + nx * 30, y: this.y + ny * 30 }, dt, 1.15);
        if (this.t >= 2.2) { this.state = 'chase'; this.t = 0; if (!this.target?.alive) this.target = this.scene.nearestHero(this, 300); }
        break;
      }
      case 'recover': {
        this.play('recover');
        this.keepApart(dt);
        if (this.t >= s.recover) {
          this.state = 'chase'; this.t = 0;
          const t = this.target, nav = sc.nav;
          if (s.ranged && t && Math.random() < 0.5) {
            const want = (s.keepAway + s.reach) / 2, a = Math.atan2(this.y - t.y, this.x - t.x) + (Math.random() < 0.5 ? 0.45 : -0.45);
            const p = { x: t.x + Math.cos(a) * want, y: t.y + Math.sin(a) * want };
            if (!nav.solidAtPx(p.x, p.y) && nav.lineClear(p.x, p.y, t.x, t.y, 1)) { this.repos = p; this.reposT = 0.8; }
          }
        }
        break;
      }
      case 'return': {
        this.engaged = false;
        this.hp = Math.min(this.maxHp, this.hp + dt * 20);
        if (Math.hypot(this.x - this.spawn.x, this.y - this.spawn.y) < 6) { this.state = 'idle'; this.homeT = 0; break; }
        this.stepTo(this.spawn, dt, 1);
        // heading home: ignore the party for a couple of seconds so it doesn't ping-pong
        this.homeT = (this.homeT || 0) + dt;
        const h = this.homeT > 2 && this.notice(s.aggro * 0.6);
        if (h) { this.homeT = 0; this.aggroOn(h); }
        break;
      }
    }
    this.sync(dt);
  }

  // Errand set piece (Quill's ambush): put on a show around the NPC until the
  // errand is taken or someone hits us (setpiece.js). staged.wake: the errand
  // is already running (after a reload), so the party walking up starts it.
  updateStaged(dt) {
    if (this.staged.wake) { const h = this.notice(this.s.aggro); if (h) { this.engageStaged(h); return; } }
    updateStagedShow(this, dt);
  }

  engageStaged(h) {
    if (!this.staged) return;
    const id = this.staged.id;
    this.staged = null;
    this.spawn = { x: this.x, y: this.y }; // home is the fight, not where we first stood
    this.aggroOn(h);
    this.scene.quests?.engageStaged(id, h);
  }

  // Attack tokens: only a few foes may be winding up an attack on one hero at
  // the same moment (tuning.attackTokens), so a crowd attacks in turns that can
  // be read and dodged on a phone. Bosses don't queue. Held only while winding
  // up / charging; released the moment the attack resolves.
  tokenFree(t) {
    if (this.boss || !t || this.token === t) return true;
    const max = tuning.attackTokens ?? 2;
    let n = 0;
    for (const e of this.scene.enemies) if (e !== this && e.alive && e.token === t && TOKEN_STATES.has(e.state)) n++;
    return n < max;
  }

  takeToken(t) { if (!this.tokenFree(t)) return false; this.token = t; return true; }

  // A spot on a ring around the target, pushed apart from the other melee foes
  // on it, so a group surrounds instead of stacking on one side.
  surroundSlot(t, ring) {
    const others = this.scene.enemies.filter((e) => e !== this && e.alive && !e.boss && !e.s.ranged && e.target === t && Math.hypot(e.x - t.x, e.y - t.y) < ring + 40);
    let a = Math.atan2(this.y - t.y, this.x - t.x);
    const minSep = Math.min(1.1, (Math.PI * 2) / (others.length + 1));
    for (let it = 0; it < 3; it++) for (const o of others) {
      const ao = Math.atan2(o.y - t.y, o.x - t.x), da = Math.atan2(Math.sin(a - ao), Math.cos(a - ao));
      if (Math.abs(da) < minSep) a += (da >= 0 ? 1 : -1) * (minSep - Math.abs(da)) * 0.5;
    }
    const x = t.x + Math.cos(a) * ring, y = t.y + Math.sin(a) * ring * 0.8;
    return this.scene.nav.solidAtPx(x, y) ? { x: t.x + (this.x - t.x) * 0.5, y: t.y + (this.y - t.y) * 0.5 } : { x, y };
  }

  // nudge apart from other foes while standing still
  keepApart(dt) {
    for (const e of this.scene.enemies) {
      if (e === this || !e.alive) continue;
      const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 12) this.moveBy((dx / d) * 20 * dt, (dy / d) * 20 * dt);
    }
  }

  // Ranged: retreat to the most open spot away from the target (straight back,
  // or angled off a wall) instead of grinding into it.
  backOff(t, dt) {
    const base = Math.atan2(this.y - t.y, this.x - t.x), nav = this.scene.nav;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.6, -1.6]) {
      const x = this.x + Math.cos(base + off) * 24, y = this.y + Math.sin(base + off) * 24;
      if (!nav.solidAtPx(x, y) && nav.lineClear(this.x, this.y, x, y, 3)) { this.stepTo({ x, y }, dt, 0.9); return; }
    }
    this.stepTo({ x: this.x * 2 - t.x, y: this.y * 2 - t.y }, dt, 0.9);
  }

  // Ranged, in range but blocked: sidestep (keeping to one side a while) to
  // find a line of fire.
  strafe(t, dt) {
    const nav = this.scene.nav;
    this.strafeT = (this.strafeT || 0) - dt;
    if (this.strafeT <= 0) { this.strafeT = 1.2; this.strafeSide = Math.random() < 0.5 ? 1 : -1; }
    const [nx, ny] = norm(t.x - this.x, t.y - this.y);
    for (const side of [this.strafeSide, -this.strafeSide]) {
      const x = this.x - ny * side * 20, y = this.y + nx * side * 20;
      if (!nav.solidAtPx(x, y) && nav.lineClear(this.x, this.y, x, y, 3)) { this.strafeSide = side; this.stepTo({ x, y }, dt, 0.85); return; }
    }
    this.stepTo(t, dt, 1); // boxed in: close the distance instead
  }

  stepTo(p, dt, mul) {
    let [nx, ny] = norm(p.x - this.x, p.y - this.y);
    // stuck on a corner or in a crowd: sidestep briefly, then re-route
    if (this.unstickT > 0) { this.unstickT -= dt; this.moveBy(this.unstick[0] * this.s.speed * dt, this.unstick[1] * this.s.speed * dt); this.play('walk'); return; }
    // simple obstacle avoidance: if blocked, use a path (the straight-line test
    // is as wide as the body, or it clips door frames and grinds on them)
    if (!this.scene.nav.lineClear(this.x, this.y, p.x, p.y, Math.max(3, this.r))) {
      this.repathT = (this.repathT || 0) - dt;
      if (!this.path || this.repathT <= 0) { this.path = this.scene.nav.find(this.x, this.y, p.x, p.y, 1500); this.repathT = 0.6; }
      if (this.path && this.path.length) {
        const wp = this.path[0];
        if (Math.hypot(wp.x - this.x, wp.y - this.y) < 3) this.path.shift();
        if (this.path.length) [nx, ny] = norm(this.path[0].x - this.x, this.path[0].y - this.y);
      }
    } else this.path = null;
    let sp = this.s.speed * mul * this.slow;
    if (this.kind === 'hexling' || this.kind === 'mire') {
      // hop: fast while airborne, nearly still between hops
      this.hop += dt * 7;
      sp *= Math.sin(this.hop) > 0 ? 1.7 : 0.15;
    }
    // spread out from other enemies
    for (const e of this.scene.enemies) {
      if (e === this || !e.alive) continue;
      const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 14) { nx += (dx / d) * 0.6; ny += (dy / d) * 0.6; }
    }
    [nx, ny] = norm(nx, ny);
    this.face(nx, ny);
    const ox = this.x, oy = this.y;
    this.moveBy(nx * sp * dt, ny * sp * dt);
    this.play('walk');
    // barely moving for a moment while trying to: sidestep and find a new route
    const want = sp * dt, got = Math.hypot(this.x - ox, this.y - oy);
    this.stuckT = want > 0.2 && got < want * 0.25 ? (this.stuckT || 0) + dt : Math.max(0, (this.stuckT || 0) - dt * 2);
    if (this.stuckT > 0.4) {
      this.stuckT = 0;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.unstick = [-ny * side, nx * side]; this.unstickT = 0.3;
      this.path = this.scene.nav.find(this.x, this.y, p.x, p.y, 3000); this.repathT = 0.6;
    }
  }

  // Boar charge: paw the ground (telegraphed line), then rush in a straight line.
  beginCharge(t) {
    this.clearZone(); // never leave an old warning marker behind
    this.state = 'chargeWindup';
    this.t = 0;
    this.cdir = norm(t.x - this.x, t.y - this.y);
    this.face(...this.cdir);
    this.chargeZones = [];
    for (let i = 1; i <= 5; i++) {
      const z = { x: this.x + this.cdir[0] * i * 26, y: this.y + this.cdir[1] * i * 26, r: 12, until: 0.8 };
      this.scene.dangers.push(z); this.chargeZones.push(z);
    }
    const g = this.scene.add.graphics().setDepth(-2);
    g.lineStyle(6, 0xec6a5e, 0.25).lineBetween(this.x, this.y, this.x + this.cdir[0] * 130, this.y + this.cdir[1] * 130);
    this.chargeGfx = g;
    audio.sfx('aggro');
  }

  clearCharge() {
    if (this.chargeZones) this.scene.dangers = this.scene.dangers.filter((z) => !this.chargeZones.includes(z));
    this.chargeZones = null;
    this.chargeGfx?.destroy(); this.chargeGfx = null;
  }

  // Bog Lurker: hides underwater (just bubbles) until someone wades close.
  submerge(on) {
    this.submerged = on;
    this.sprite.setAlpha(on ? 0.12 : 1);
    this.shadow.setVisible(!on);
    if (on) { this.engaged = false; this.target = null; this.state = 'idle'; this.clearZone(); }
  }

  aiLurk(dt) {
    const sc = this.scene;
    if (this.submerged) {
      if (Math.random() < dt * 2) sc.fx.burst('foam', this.x + (Math.random() - 0.5) * 10, this.y - 2, 1);
      const h = this.notice(this.s.aggro);
      if (h) { this.submerge(false); sc.fx.burst('foam', this.x, this.y, 16); audio.sfx('squish'); this.aggroOn(h); this.beginWindup(h); }
      return true;
    }
    if (!this.engaged || !this.target) { this.idleT = (this.idleT || 0) + dt; if (this.idleT > 3) { this.idleT = 0; this.submerge(true); } }
    else this.idleT = 0;
    return false;
  }

  // Witchling: hops to a nearby pool when you close in.
  blinkAway() {
    const sc = this.scene;
    this.blinkT = 5 + Math.random() * 3;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 40;
      const x = this.x + Math.cos(a) * r, y = this.y + Math.sin(a) * r;
      if (!sc.nav.solidAtPx(x, y)) { sc.fx.puff(this.x, this.y, 'sparkCurse'); this.x = x; this.y = y; sc.fx.puff(x, y, 'sparkCurse'); audio.sfx('warp'); return; }
    }
  }

  // Shade: all but invisible until it's close or striking. The Seer's Lens
  // (or a reveal, like Hawk Strike) shows it.
  aiShade(dt) {
    const sc = this.scene;
    this.revealT = Math.max(0, (this.revealT || 0) - dt);
    const near = sc.party.some((h) => h.alive && !h.downed && Math.hypot(h.x - this.x, h.y - this.y) < 42);
    const show = near || this.revealT > 0 || TOKEN_STATES.has(this.state) || this.stunT > 0 || this.flashT > 0;
    const lens = sc.state.relics.includes('lens');
    const want = show ? 1 : lens ? 0.6 : 0.08;
    this.veil = (this.veil ?? want) + (want - (this.veil ?? want)) * Math.min(1, dt * 6);
    this.sprite.setAlpha(this.veil);
    this.hidden = this.veil < 0.4; // no health bar or name while veiled
  }

  // Gloom Spider: spits a web that roots the hero it hits.
  spitWeb(t) {
    this.webCd = 6;
    this.state = 'recover'; this.t = -0.2;
    this.face(t.x - this.x, t.y - this.y);
    this.anim = ''; this.play('windup');
    this.token = null;
    this.scene.spawnEnemyArrow(this, t, this.s.dmg * 0.4 * this.scene.difficulty.dmg, 'web');
  }

  // Wailing Banshee: a scream that interrupts and staggers everyone in its
  // line of sight close by. A ring shows its reach while she draws breath;
  // step out of it or break line of sight (a tree, a wall).
  aiBanshee(dt) {
    const sc = this.scene, R = 74;
    this.screamCd = (this.screamCd ?? 3) - dt;
    if (this.state === 'scream') {
      this.play('windup');
      this.t += dt;
      if (this.t >= 0.85) {
        this.clearZone();
        this.anim = ''; this.play('attack');
        audio.sfx('roar', { pitch: 1.8 });
        sc.fx.ring(this.x, this.y - 8, 'ringWhite', 5);
        sc.shake(140, 0.004);
        for (const h of sc.party) {
          if (!h.alive || h.downed || h.invuln > 0 || Math.hypot(h.x - this.x, h.y - this.y) > R + h.r) continue;
          if (!sc.nav.lineClear(this.x, this.y, h.x, h.y, 1)) continue; // a tree or wall breaks the scream
          h.damage(this.s.dmg * 0.7 * sc.difficulty.dmg, this);
          if (h.action) h.cancelAction();
          h.buff('slow', 0.05, 0.6);
          sc.floatText(h.x, h.y - 34, 'STAGGERED', 'fontPlain', 0xd8d3e0);
        }
        this.state = 'recover'; this.t = 0;
      }
      return true;
    }
    if (this.screamCd <= 0 && this.onScreen() && !TOKEN_STATES.has(this.state) && this.state !== 'recover' && sc.party.some((h) => h.alive && !h.downed && Math.hypot(h.x - this.x, h.y - this.y) < R - 10)) {
      this.screamCd = 6.5;
      this.state = 'scream'; this.t = 0;
      this.zone = { x: this.x, y: this.y, r: R, until: 0.85 };
      sc.dangers.push(this.zone);
      this.zoneGfx = sc.fx.telegraph(this.x, this.y, R, 0.85);
      sc.floatText(this.x, this.y - 32, 'A WAIL RISES...', 'fontPlain', 0xd8d3e0);
      return true;
    }
    return false;
  }

  // Queen Mab: lays egg sacs that hatch spiderlings unless smashed, and drags
  // heroes who keep their distance in with a web line.
  aiMab(dt) {
    const sc = this.scene;
    this.tongueCd = Math.max(0, (this.tongueCd ?? 3) - dt);
    this.eggT = (this.eggT ?? 5) - dt;
    if (this.eggT <= 0 && !TOKEN_STATES.has(this.state)) {
      const sacs = sc.enemies.filter((e) => e.alive && e.kind === 'eggsac').length;
      this.eggT = 9;
      if (sacs >= 4) return;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = this.x + Math.cos(a) * 26, y = this.y + Math.sin(a) * 18;
        if (sc.nav.solidAtPx(x, y)) continue;
        sc.spawnEnemy('eggsac', x, y, true);
      }
      sc.floatText(this.x, this.y - 44, 'SHE LAYS EGGS!', 'fontPlain', 0xd9b8ff);
      audio.sfx('squish', { pitch: 0.7 });
    }
  }

  // ---- Cinderreach
  crackArmour() {
    const sc = this.scene;
    this.cracked = true;
    this.tex = 'bruteCracked'; this.anim = '';
    this.sprite.setTexture('bruteCracked', 'idle_0');
    sc.floatText(this.x, this.y - 36, 'ARMOUR CRACKED!', 'fontGold');
    sc.fx.burst('ember', this.x, this.y - 16, 18); sc.shake(160, 0.006); audio.sfx('bash');
  }

  // Magma Slug: wherever it crawls it leaves burning rock for a few seconds
  aiTrail(dt) {
    const sc = this.scene;
    this.trailT = (this.trailT ?? 0.5) - dt;
    if (this.trailT > 0 || Math.hypot(this.x - (this.lastTrail?.x ?? -99), this.y - (this.lastTrail?.y ?? -99)) < 10) return;
    this.trailT = 0.45;
    const x = this.x, y = this.y + 2;
    this.lastTrail = { x, y };
    const zone = { x, y, r: 10, until: 3 };
    sc.dangers.push(zone);
    const g = sc.add.ellipse(x, y, 20, 12, 0xff9a2e, 0.35).setDepth(-25);
    sc.tweens.add({ targets: g, alpha: 0, duration: 3000, onComplete: () => g.destroy() });
    const dmg = this.s.dmg * 0.25 * sc.difficulty.dmg;
    let ticks = 0;
    const ev = sc.time.addEvent({ delay: 500, repeat: 5, callback: () => {
      ticks++;
      for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - x, h.y - y) < 12) { h.damage(dmg, null); sc.floatText(h.x, h.y - 30, 'BURN', 'fontPlain', 0xffa060); }
      if (ticks >= 6) sc.dangers = sc.dangers.filter((z) => z !== zone);
    } });
    void ev;
  }

  // Fire Beetle: rushes in, swells, and bursts. Kill it before it reaches you.
  aiBomber(dt) {
    const sc = this.scene, t = this.target;
    if (this.fuseT !== undefined) {
      this.fuseT -= dt;
      this.play('windup');
      this.sprite.setScale(1 + (0.6 - this.fuseT) * 0.6);
      if (this.fuseT <= 0) { this.beetleBurst(34); this.hp = 0; this.alive = false; this.clearZone(); sc.onEnemyKilled(this, null); this.destroy(); }
      return true;
    }
    if (t && this.onScreen() && Math.hypot(t.x - this.x, t.y - this.y) < 22) {
      this.fuseT = 0.6;
      this.zone = { x: this.x, y: this.y, r: 34, until: 0.6 };
      sc.dangers.push(this.zone);
      this.zoneGfx = sc.fx.telegraph(this.x, this.y, 34, 0.6);
      audio.sfx('hexCharge', { pitch: 1.8 });
      return true;
    }
    return false;
  }

  beetleBurst(r) {
    const sc = this.scene, x = this.x, y = this.y;
    this.burst = true;
    sc.fx.slam(x, y, r); sc.fx.burst('ember', x, y - 6, 20); sc.shake(180, 0.007); audio.sfx('bash');
    const dmg = this.s.dmg * (r > 20 ? 1 : 0.4) * sc.difficulty.dmg;
    for (const h of sc.party) if (h.alive && !h.downed && h.invuln <= 0 && Math.hypot(h.x - x, h.y - y) <= r + h.r) h.damage(dmg, { x, y });
  }

  // Cinder Drake: sweeps fire breath across a marked arc, and takes off to dive
  // on a marked spot. Bites when you're close.
  aiDrake(dt) {
    const sc = this.scene, t = this.target;
    this.breathT = (this.breathT ?? 4) - dt;
    this.diveT = (this.diveT ?? 9) - dt;
    if (this.dive) {
      const D = this.dive;
      D.t += dt;
      if (D.t < 0.5) { this.play('fly'); this.sprite.y -= D.t * 40; return true; }
      if (D.t < 1.6) { // aloft: out of reach, the shadow slides to the mark
        this.sprite.setAlpha(0.15); this.invulnT = 1;
        const p = Math.min(1, (D.t - 0.5) / 1.1);
        this.x = D.from.x + (D.to.x - D.from.x) * p; this.y = D.from.y + (D.to.y - D.from.y) * p;
        return true;
      }
      // the dive
      this.sprite.setAlpha(1); this.dive = null; this.invulnT = 0;
      this.clearZone();
      sc.fx.slam(this.x, this.y, 44); sc.shake(400, 0.012); audio.sfx('bash');
      for (const h of sc.party) if (h.alive && !h.downed && h.invuln <= 0 && Math.hypot(h.x - this.x, h.y - this.y) <= 44 + h.r) { h.damage(this.s.dmg * 1.4 * sc.difficulty.dmg, this); h.knock(h.x - this.x, h.y - this.y, 120); }
      this.state = 'recover'; this.t = 0;
      return true;
    }
    if (this.breath) {
      const B = this.breath;
      B.t += dt;
      this.play('windup');
      if (B.t >= 0.8 && !B.done) {
        B.done = true;
        audio.sfx('fireCast', { pitch: 0.6 }); sc.shake(250, 0.006);
        for (const z of B.zones) { sc.fx.burst('ember', z.x, z.y - 4, 10); for (const h of sc.party) if (h.alive && !h.downed && h.invuln <= 0 && Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) { h.damage(this.s.dmg * 0.9 * sc.difficulty.dmg, this); h.addBurn(this.s.dmg * 0.1, 3); } }
      }
      if (B.t >= 1.1) { for (const g of B.gfx) g.destroy(); sc.dangers = sc.dangers.filter((z) => !B.zones.includes(z)); this.breath = null; this.state = 'recover'; this.t = 0; }
      return true;
    }
    if (!t || this.state !== 'chase' || !this.onScreen()) return false;
    const d = Math.hypot(t.x - this.x, t.y - this.y);
    if (this.diveT <= 0 && d > 50) {
      this.diveT = 10;
      const to = { x: t.x, y: t.y };
      this.dive = { t: 0, from: { x: this.x, y: this.y }, to };
      this.zone = { x: to.x, y: to.y, r: 44, until: 1.6 };
      sc.dangers.push(this.zone);
      this.zoneGfx = sc.fx.telegraph(to.x, to.y, 44, 1.6);
      sc.floatText(this.x, this.y - 50, 'IT TAKES WING!', 'fontPlain', 0xffa060);
      audio.sfx('dash');
      return true;
    }
    if (this.breathT <= 0 && d < 110) {
      this.breathT = 6;
      // a fan of marked circles sweeping out from its jaws toward the target
      const base = Math.atan2(t.y - this.y, t.x - this.x);
      this.face(t.x - this.x, t.y - this.y);
      const zones = [], gfx = [];
      for (let k = -2; k <= 2; k++) for (const dd of [34, 62, 90]) {
        const a = base + k * 0.22;
        const z = { x: this.x + Math.cos(a) * dd, y: this.y + Math.sin(a) * dd * 0.8, r: 13, until: 0.8 };
        zones.push(z); sc.dangers.push(z); gfx.push(sc.fx.telegraph(z.x, z.y, z.r, 0.8));
      }
      this.breath = { t: 0, zones, gfx };
      sc.floatText(this.x, this.y - 50, 'ITS THROAT GLOWS...', 'fontPlain', 0xffa060);
      return true;
    }
    return false;
  }

  // Croaker: a tongue that drags you in for a bite.
  beginTongue(t) {
    this.clearZone(); // never leave an old warning marker behind
    this.state = 'tongueWind';
    this.t = 0;
    this.tongueTarget = t;
    this.face(t.x - this.x, t.y - this.y);
    const g = this.scene.add.graphics().setDepth(-2);
    const st = { p: 0 };
    const draw = () => { if (!t.alive || !g.active) return; g.clear().lineStyle(2, 0xec6a5e, 0.2 + st.p * 0.6).lineBetween(this.x, this.y - 6, t.x, t.y - 6); };
    draw();
    this.scene.tweens.add({ targets: st, p: 1, duration: 800, onUpdate: draw });
    this.zoneGfx = g;
    audio.sfx('hexCharge');
  }

  tongue() {
    const sc = this.scene, t = this.tongueTarget;
    this.clearZone();
    this.state = 'recover'; this.t = 0; this.tongueCd = 4;
    this.anim = ''; this.sprite.play(`${this.tex}_attack`); this.anim = `${this.tex}_attack`;
    if (!t?.alive || t.downed || t.invuln > 0 || Math.hypot(t.x - this.x, t.y - this.y) > (this.s.pullRange || this.s.reach) + 20) { sc.floatText(this.x, this.y - 24, 'MISS', 'fontPlain'); return; }
    audio.sfx('zip');
    const [nx, ny] = norm(this.x - t.x, this.y - t.y);
    const tx = this.x - nx * 18, ty = this.y - ny * 18;
    sc.tweens.add({ targets: t, x: tx, y: ty, duration: 220, onComplete: () => { t.damage(this.s.dmg * sc.difficulty.dmg, this); sc.floatText(t.x, t.y - 34, 'GULP!', 'fontPlain'); } });
  }

  // Hex Warlock: wards nearby allies and calls hexlings to its side.
  aiWarlock(dt) {
    const sc = this.scene;
    this.wardT = (this.wardT ?? 2) - dt;
    this.summonT = (this.summonT ?? 6) - dt;
    if (this.wardT <= 0) {
      this.wardT = 7;
      for (const e of sc.enemies) {
        if (!e.alive || Math.hypot(e.x - this.x, e.y - this.y) > 90 || e.s.inert) continue;
        e.wardShield = Math.round(e.maxHp * 0.3);
        e.wardRing?.destroy();
        e.wardRing = sc.add.ellipse(e.x, e.y - 8, 26, 30, 0xb24ce6, 0.12).setStrokeStyle(1, 0xd9b8ff, 0.8).setDepth(e.y + 2);
      }
      sc.fx.ring(this.x, this.y - 6, 'ringBlue', 4);
      sc.floatText(this.x, this.y - 30, 'HEX WARD!', 'fontPlain', 0xd9b8ff);
      audio.sfx('frost', { pitch: 0.7 });
    }
    if (this.summonT <= 0) {
      this.summonT = 11;
      const mine = sc.enemies.filter((e) => e.alive && e.summonedBy === this).length;
      for (let i = mine; i < Math.min(mine + 2, 3); i++) { const e = sc.spawnEnemy('hexling', this.x + (i ? 20 : -20), this.y + 10, true); e.summonedBy = this; e.summoned = true; }
      sc.fx.burst('curse', this.x, this.y - 10, 16);
    }
  }

  // Ranged attackers only fire once they're on screen, so nothing shoots you
  // from somewhere you can't see (portrait phones have a narrow view).
  onScreen(m = 10) {
    const v = this.scene.cameras.main.worldView;
    return this.x > v.x + m && this.x < v.right - m && this.y > v.y + m && this.y < v.bottom - m;
  }

  // Noticing the party (starting a fight) needs us on screen: the player
  // should see a foe before it charges in. Once engaged, the fight can run
  // past the screen edge (a chase, an archer at range).
  notice(range) {
    if (!this.onScreen(4)) return null;
    return this.scene.nearestHero(this, range);
  }

  beginWindup(t) {
    this.clearZone(); // never leave an old warning marker behind
    this.state = 'windup';
    this.t = 0;
    this.face(t.x - this.x, t.y - this.y);
    const s = this.s;
    if (s.ranged) {
      // telegraph: a thin aim line to where the arrow will fly
      this.aim = { x: t.x, y: t.y - 6 };
      this.zone = { x: t.x, y: t.y, r: 12, until: s.windup };
      this.scene.dangers.push(this.zone);
      const g = this.scene.add.graphics().setDepth(-2);
      const st = { p: 0 };
      const draw = () => { if (!g.active) return; g.clear().lineStyle(1, 0xec6a5e, 0.25 + st.p * 0.6).lineBetween(this.x, this.y - 8, this.aim.x, this.aim.y); };
      draw();
      this.scene.tweens.add({ targets: st, p: 1, duration: s.windup * 1000, onUpdate: draw });
      this.zoneGfx = g;
      return;
    }
    let zx = this.x, zy = this.y;
    if (s.zone === 'front') { const [nx, ny] = norm(t.x - this.x, t.y - this.y); zx += nx * 16; zy += ny * 16; }
    this.zone = { x: zx, y: zy, r: s.zr, until: s.windup };
    this.scene.dangers.push(this.zone);
    this.zoneGfx = this.scene.fx.telegraph(zx, zy, s.zr, s.windup);
    if (this.kind === 'hexling' || this.kind === 'mire') audio.sfx('hexCharge');
  }

  strike() {
    const z = this.zone;
    this.clearZone();
    this.state = 'recover';
    this.t = 0;
    const sc = this.scene;
    if (this.s.ranged) {
      this.anim = ''; this.sprite.play(`${this.tex}_attack_${this.view}`); this.anim = `${this.tex}_attack_${this.view}`;
      sc.spawnEnemyArrow(this, this.aim, this.s.dmg * sc.difficulty.dmg * this.affixDmg(), this.s.shot);
      return;
    }
    if (this.kind === 'hexling' || this.kind === 'mire') { const k = `${ENEMY_TEX[this.kind]}_attack`; this.sprite.play(k); this.anim = k; sc.fx.slam(z.x, z.y, z.r); audio.sfx('squish'); }
    else if (this.kind === 'golem') { this.sprite.play('golem_slam'); this.anim = 'golem_slam'; sc.fx.slam(z.x, z.y, z.r); }
    else { this.anim = ''; this.sprite.play(`${this.tex}_attack_${this.view}`); this.anim = `${this.tex}_attack_${this.view}`; audio.sfx('swing', { pitch: this.kind === 'knight' ? 0.5 : 0.7 }); }
    if (sc.inSmoke(this.x, this.y) && Math.random() < 0.5) { sc.floatText(this.x, this.y - 24, 'MISS', 'fontPlain'); return; }
    if (this.s.drain) for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) h.addPoison?.(this.s.dmg * 0.5, 3);
    const dmg = this.s.dmg * sc.difficulty.dmg * (this.status?.weaken ? 0.85 : 1) * this.affixDmg();
    for (const h of sc.party) {
      if (!h.alive || h.downed) continue;
      if (Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) h.damage(dmg, this);
    }
    for (const a of sc.allies || []) if (a.alive && Math.hypot(a.x - z.x, a.y - z.y) <= z.r + a.r) a.damage(dmg, this);
  }
}

// --------------------------------------------------------------- Hex Golem
// Three phases: (1) slams; (2) <60%: summons hexlings + throws boulders at
// telegraphed spots; (3) <30%: enraged, faster, slams send out shockwaves.
export class Golem extends Enemy {
  constructor(scene, x, y, opts = {}) {
    super(scene, 'golem', x, y, opts);
    this.sprite.setOrigin(0.5, 60 / 64);
    this.shadow.setAlpha(0.28);
    this.phase = 1;
    // the Undercroft's Shadow: a weaker cursed echo that never enrages
    this.isShadow = !!opts.shadow;
    if (this.isShadow) { this.maxHp = Math.round(this.maxHp * 0.6); this.hp = this.maxHp; this.sprite.setTint(0x8a6cc4); }
    this.throwT = 3.5;
    this.boss = true;
    this.sprite.play('golem_idle');
  }

  play(anim) {
    const key = `golem_${anim === 'recover' ? 'idle' : anim === 'attack' ? 'slam' : anim}`;
    if (this.anim !== key) { this.anim = key; this.sprite.play(key); }
  }
  face() { /* symmetric front-facing boss */ }
  knock(dx, dy, p) { super.knock(dx, dy, p * 0.12); }
  stun(t) { super.stun(t * 0.3); }
  setTaunt(by, t) { super.setTaunt(by, t * 0.5); }

  damage(amount, src, opts) {
    if (this.armor > 0) { amount *= 0.2; if (Math.random() < 0.15) this.scene.floatText(this.x, this.y - 60, 'ARMOURED', 'fontPlain'); }
    const r = super.damage(amount, src, opts);
    if (!this.alive) return r;
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.6) this.enterPhase(2);
    else if (this.phase === 2 && f < 0.3 && !this.isShadow) this.enterPhase(3);
    return r;
  }

  enterPhase(n) {
    const sc = this.scene;
    this.phase = n;
    audio.sfx('roar');
    sc.shake(400, 0.008);
    if (n === 2) {
      sc.floatText(this.x, this.y - 70, 'ARMOUR PLATES! HOOK THEM OFF!', 'fontGold');
      for (const dx of [-40, 40]) sc.spawnEnemy('hexling', this.x + dx, this.y + 10, true);
      this.addPlates();
    } else {
      sc.floatText(this.x, this.y - 70, 'ENRAGED!', 'fontGold');
      this.sprite.setTint(0xffa8a8);
      this.s = { ...this.s, speed: this.s.speed * 1.4, windup: 0.62, recover: 0.9 };
    }
  }

  restoreTint() { if (this.isShadow) this.sprite.setTint(0x8a6cc4); else if (this.phase === 3) this.sprite.setTint(0xffa8a8); else this.sprite.clearTint(); }

  // Phase 2: two plates shield the core (80% less damage) until hooked off.
  addPlates() {
    const sc = this.scene;
    this.armor = 2;
    this.plates = [-1, 1].map((side) => {
      const img = sc.add.image(this.x + side * 15, this.y - 34, 'plate').setDepth(this.y + 2);
      const p = { side, img, on: true };
      p.o = sc.addInteractable({ x: img.x, y: img.y + 24, reach: 110, standOff: 46, h: 30, kind: 'plate', interact: () => this.hookPlate(p) });
      return p;
    });
    const pip = sc.party.find((h) => h.def.id === 'pip' && !h.downed) || sc.leader;
    sc.time.delayedCall(900, () => sc.bark(pip, sc.state.relics.includes('grapple') ? 'THOSE PLATES! TAP ONE - HOOK IT OFF!' : 'IF ONLY WE COULD PRY THOSE PLATES OFF...'));
  }

  hookPlate(p) {
    const sc = this.scene, L = sc.leader;
    if (!p.on || !this.alive) return;
    if (!sc.state.relics.includes('grapple')) { sc.bark(L, 'I CAN\'T REACH IT.'); return; }
    p.on = false;
    sc.removeInteractable(p.o);
    const line = sc.add.graphics().setDepth(100000 - 18);
    audio.sfx('zip');
    const st = { k: 0 };
    sc.tweens.add({ targets: st, k: 1, duration: 180, onUpdate: () => line.clear().lineStyle(1, 0xc4cfe2, 1).lineBetween(L.x, L.y - 12, L.x + (p.img.x - L.x) * st.k, L.y - 12 + (p.img.y - L.y + 12) * st.k), onComplete: () => {
      line.destroy();
      audio.sfx('bash'); audio.sfx('block');
      sc.shake(160, 0.008);
      sc.tweens.add({ targets: p.img, x: p.img.x + p.side * 40, y: p.img.y + 30, angle: p.side * 200, alpha: 0, duration: 500, onComplete: () => p.img.destroy() });
      this.armor--;
      if (this.armor <= 0) { this.stunT = 2.2; this.state = 'chase'; this.clearZone(); sc.floatText(this.x, this.y - 70, 'CORE EXPOSED!', 'fontGold', 0xffffff, true); }
    } });
  }

  die(src) {
    this.alive = false;
    this.clearZone();
    for (const p of this.plates || []) { p.img.destroy(); this.scene.removeInteractable(p.o); }
    this.scene.onBossKilled(this, src);
    this.destroy();
  }

  update(dt) {
    if (!this.alive) return;
    const sc = this.scene;
    if (this.state === 'chase' && this.phase >= 2) {
      this.throwT -= dt;
      if (this.throwT <= 0) { this.throwBoulder(); this.sync(dt); return; }
    }
    if (this.state === 'throw') {
      this.t += dt;
      if (this.t >= 1.3) { this.state = 'chase'; this.t = 0; }
      this.sync(dt);
      return;
    }
    super.update(dt);
    this.sprite.setDepth(this.y);
    for (const p of this.plates || []) if (p.on) { p.img.setPosition(this.x + p.side * 15, this.y - 34 + Math.sin(Date.now() / 200) * 0.5).setDepth(this.y + 2); p.o.x = p.img.x; p.o.y = p.img.y + 24; }
  }

  throwBoulder() {
    const sc = this.scene;
    const targets = sc.party.filter((h) => h.alive && !h.downed);
    if (!targets.length) return;
    const t = targets[Math.floor(Math.random() * targets.length)];
    this.state = 'throw';
    this.t = 0;
    this.throwT = this.phase === 3 ? 3 : 4.5;
    this.anim = ''; this.sprite.play('golem_throw'); this.anim = 'golem_throw';
    const tx = t.x, ty = t.y, r = 20;
    const zone = { x: tx, y: ty, r, until: 0.95 };
    sc.dangers.push(zone);
    const g = sc.fx.telegraph(tx, ty, r, 0.95);
    sc.time.delayedCall(500, () => {
      if (!this.alive) { g.destroy(); sc.dangers = sc.dangers.filter((z) => z !== zone); return; }
      const b = sc.add.image(this.x + 12, this.y - 44, 'boulder').setDepth(100000 - 25);
      const sx = b.x, sy = b.y;
      audio.sfx('swing', { pitch: 0.5 });
      sc.tweens.addCounter({
        from: 0, to: 1, duration: 450,
        onUpdate: (tw) => {
          const k = tw.getValue();
          b.setPosition(sx + (tx - sx) * k, sy + (ty - 6 - sy) * k - Math.sin(k * Math.PI) * 50);
          b.setRotation(k * 6);
        },
        onComplete: () => {
          b.destroy(); g.destroy();
          sc.dangers = sc.dangers.filter((z) => z !== zone);
          sc.fx.slam(tx, ty, r); sc.fx.dust(tx, ty); audio.sfx('bash');
          for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - tx, h.y - ty) <= r + h.r) h.damage(18 * sc.difficulty.dmg, { x: tx, y: ty });
        },
      });
    });
  }

  strike() {
    super.strike();
    const sc = this.scene;
    sc.shake(220, 0.01);
    sc.fx.dust(this.x - 14, this.y + 2); sc.fx.dust(this.x + 14, this.y + 2);
    audio.sfx('bash');
    if (this.phase === 3) for (let i = 0; i < 2; i++) sc.addShockwave(this.x, this.y, 0.15 + i * 0.35, 90, 150);
  }
}

// ------------------------------------------------------------- Mother Murk
// Mother Murk, the Mistfen lieutenant. Three phases:
//  1. on land: slams, belly-flop leaps, bog-spit puddles, a tongue grab
//  2. sunk in her pool: shockwave rings, and every few seconds she erupts at
//     the pool's edge to snap at you, open to everyone while she's up
//     (swimmers can reach her any time)
//  3. the curse fog closes in: everything faster and more often
export class Murk extends Enemy {
  constructor(scene, x, y, opts = {}) {
    super(scene, 'murk', x, y, opts);
    this.sprite.setOrigin(0.5, 60 / 64);
    this.shadow.setAlpha(0.28);
    this.boss = true;
    this.phase = 1;
    this.home = { x, y };
    // where she fights (tiles) and the pool she dives into; defaults: the Abbey nest
    this.arena = opts.arena || { x0: 266, y0: 65, x1: 308, y1: 78 };
    this.pool = opts.pool || { rx: 5.2, ry: 3.6 };
    // the Abbey's Shadow: a weaker cursed echo that never calls the fog
    this.isShadow = !!opts.shadow;
    if (this.isShadow) { this.maxHp = Math.round(this.maxHp * 0.6); this.hp = this.maxHp; this.sprite.setTint(0x8a6cc4); }
    this.grabT = 7; this.summonT = 12; this.waveT = 2; this.fogR = 0;
    this.leapT = 5; this.spitT = 3; this.surfaceT = 3;
    this.puddles = [];
    this.sprite.play('murk_idle');
  }

  play(anim) {
    const key = `murk_${anim === 'recover' ? 'idle' : anim === 'attack' ? 'slam' : anim}`;
    if (this.anim !== key) { this.anim = key; this.sprite.play(key); }
  }
  face() {}
  knock(dx, dy, p) { super.knock(dx, dy, p * 0.1); }
  stun(t) { super.stun(t * 0.3); }
  setTaunt(by, t) { super.setTaunt(by, t * 0.5); }

  get submerged() { return this.phase === 2 && !this.surfaced; }

  damage(amount, src, opts) {
    // submerged: only someone swimming close can reach her
    if (this.submerged && !(src?.swimming && Math.hypot(src.x - this.x, src.y - this.y) < 80)) {
      if (Math.random() < 0.2) this.scene.floatText(this.x, this.y - 30, 'SHE\'S UNDERWATER!', 'fontPlain');
      return 0;
    }
    const r = Enemy.prototype.damage.call(this, amount, src, opts);
    if (!this.alive) return r;
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.65) this.enterPhase(2);
    else if (this.phase === 2 && f < 0.35 && !this.isShadow) this.enterPhase(3);
    return r;
  }

  restoreTint() { if (this.isShadow) this.sprite.setTint(0x8a6cc4); else this.sprite.clearTint(); }

  enterPhase(n) {
    const sc = this.scene;
    this.phase = n;
    audio.sfx('roar');
    sc.shake(500, 0.01);
    this.clearZone(); this.leapEnd();
    this.state = 'chase'; this.t = 0;
    if (n === 2) {
      this.surfaced = false;
      this.surfaceT = 4;
      sc.floatText(this.x, this.y - 80, 'SHE SINKS INTO THE POOL!', 'fontGold');
      sc.tweens.add({ targets: this, x: this.home.x, y: this.home.y, duration: 700 });
      sc.fx.burst('foam', this.home.x, this.home.y, 30);
      const A = this.arena;
      this.flood = sc.add.rectangle(A.x0 * 16, A.y0 * 16, (A.x1 - A.x0 + 1) * 16, (A.y1 - A.y0 + 1) * 16, 0x3f6fae, 0).setOrigin(0).setDepth(-80);
      sc.tweens.add({ targets: this.flood, fillAlpha: 0.22, duration: 1200 });
      const pip = sc.party.find((h) => h.def.id === 'pip' && !h.downed) || sc.leader;
      sc.time.delayedCall(800, () => sc.bark(pip, sc.canSwim ? 'INTO THE WATER! SWIMMING, THE WAVES PASS OVER US!' : 'SHE HAS TO COME UP FOR AIR - HIT HER WHEN SHE DOES!'));
    } else {
      this.surfaced = false;
      this.sprite.setAlpha(1).setCrop();
      this.flood?.destroy(); this.flood = null;
      sc.tweens.add({ targets: this, x: this.home.x, y: this.home.y + 40, duration: 500 });
      sc.floatText(this.x, this.y - 80, 'THE CURSE FOG CLOSES IN!', 'fontGold');
      this.fogR = 300;
      this.fog = sc.add.graphics().setDepth(100000 - 45);
      this.s = { ...this.s, windup: 0.7, recover: 0.8, speed: 26 };
      this.leapT = 3; this.spitT = 2; this.grabT = 6;
    }
  }

  die(src) {
    this.alive = false;
    this.cleanup();
    this.scene.onBossKilled(this, src);
    this.destroy();
  }

  cleanup() {
    this.clearZone(); this.leapEnd();
    this.flood?.destroy(); this.fog?.destroy(); this.flood = null; this.fog = null;
    for (const p of this.puddles) this.dropPuddle(p);
    this.puddles = [];
    for (const g of this.globs || []) g.destroy();
    this.globs = [];
  }
  destroy() { this.cleanup(); super.destroy(); }

  minions() { return this.scene.enemies.filter((e) => e.alive && e.summoned).length; }
  heroes() { return this.scene.party.filter((h) => h.alive && !h.downed); }

  // keep a landing point inside her nest
  clampArena(x, y) {
    const A = this.arena;
    return { x: Math.max((A.x0 + 2) * 16, Math.min((A.x1 - 2) * 16, x)), y: Math.max((A.y0 + 1) * 16, Math.min((A.y1 - 1) * 16, y)) };
  }

  update(dt) {
    if (!this.alive) return;
    const sc = this.scene;
    this.updatePuddles(dt);
    if (this.leap) { this.updateLeap(dt); return; }

    if (this.phase === 2) { this.updateSubmerged(dt); return; }

    if (this.phase === 3) {
      this.fogR = Math.max(150, this.fogR - dt * 5);
      const g = this.fog.clear();
      g.lineStyle(26, 0x6b3fa0, 0.35).strokeCircle(this.home.x, this.home.y, this.fogR + 13);
      g.lineStyle(2, 0xe7a6ff, 0.6).strokeCircle(this.home.x, this.home.y, this.fogR);
      this.fogTick = (this.fogTick || 0) - dt;
      if (this.fogTick <= 0) {
        this.fogTick = 0.8;
        for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - this.home.x, h.y - this.home.y) > this.fogR) { h.damage(h.maxHp * 0.05, null); sc.floatText(h.x, h.y - 30, 'CURSE FOG', 'fontPlain', 0xd9b8ff); }
      }
    }

    // pick a move between attacks (only from the ready state, never mid-swing)
    if (this.engaged) { this.leapT -= dt; this.spitT -= dt; this.grabT -= dt; this.summonT -= dt; }
    if (this.state === 'chase' && this.engaged && !(this.stunT > 0)) {
      const p3 = this.phase === 3;
      if (this.leapT <= 0) { this.leapT = p3 ? 6.5 : 9; this.beginLeap(); return; }
      if (this.spitT <= 0) { this.spitT = p3 ? 5.5 : 7.5; this.spit(p3 ? 5 : 3); }
      if (this.grabT <= 0) {
        // tongue grab: only reaches a hero lagging nearby, not one running for it
        const far = this.heroes().map((h) => [h, Math.hypot(h.x - this.x, h.y - this.y)]).filter(([, d]) => d > 64 && d < 150).sort((a, b) => b[1] - a[1])[0];
        if (far) { this.grabT = p3 ? 8 : 10; this.beginTongue(far[0]); this.sync(dt); return; }
        this.grabT = 1.5;
      }
      if (this.phase === 1) {
        if (this.summonT <= 0 && this.minions() < 2) { this.summonT = 14; for (const dx of [-60, 60]) { const e = sc.spawnEnemy('mire', this.x + dx, this.y + 16, true); e.summoned = true; } }
      }
    }
    super.update(dt);
    this.sprite.setDepth(this.y);
  }

  // ---- belly-flop leap: crouch, sail over, land with a shockwave
  beginLeap() {
    const sc = this.scene;
    const t = this.target?.alive && !this.target.downed ? this.target : this.heroes()[0];
    if (!t) return;
    this.clearZone();
    const to = this.clampArena(t.x, t.y);
    const R = 40, crouch = this.phase === 3 ? 0.5 : 0.65, air = 0.7;
    this.leap = { from: { x: this.x, y: this.y }, to, t: 0, crouch, air, R };
    this.zone = { x: to.x, y: to.y, r: R, until: crouch + air };
    sc.dangers.push(this.zone);
    this.zoneGfx = sc.fx.telegraph(to.x, to.y, R, crouch + air);
    this.state = 'leap';
    this.play('windup');
    audio.sfx('hexCharge');
  }

  updateLeap(dt) {
    const L = this.leap, sc = this.scene;
    L.t += dt;
    if (L.t < L.crouch) { this.play('windup'); this.sync(dt); this.sprite.y += Math.sin(L.t * 40) * 1; return; }
    const p = Math.min(1, (L.t - L.crouch) / L.air);
    this.x = L.from.x + (L.to.x - L.from.x) * p;
    this.y = L.from.y + (L.to.y - L.from.y) * p;
    this.play('idle');
    this.sync(dt);
    this.sprite.y -= Math.sin(p * Math.PI) * 46;
    this.shadow.setScale(1 - Math.sin(p * Math.PI) * 0.4);
    this.sprite.setDepth(this.y + 40);
    if (p < 1) return;
    // landing
    this.leapEnd();
    this.state = 'recover'; this.t = 0;
    this.play('attack');
    sc.fx.slam(this.x, this.y, L.R);
    sc.fx.burst('foam', this.x, this.y, 16);
    sc.shake(320, 0.012);
    audio.sfx('bash');
    sc.addShockwave(this.x, this.y, 0.05, 110, 150);
    const dmg = this.s.dmg * 1.1 * sc.difficulty.dmg;
    for (const h of this.heroes()) if (Math.hypot(h.x - this.x, h.y - this.y) <= L.R + h.r) h.damage(dmg, this);
  }

  leapEnd() {
    if (!this.leap) return;
    this.leap = null;
    this.clearZone();
    this.shadow.setScale(1);
  }

  // ---- bog spit: lobs globs that leave poison puddles for a few seconds
  spit(n) {
    const sc = this.scene;
    const hs = this.heroes();
    if (!hs.length) return;
    this.play('attack');
    audio.sfx('squish');
    this.globs = this.globs || [];
    for (let i = 0; i < n; i++) {
      const h = hs[i % hs.length];
      const a = Math.random() * Math.PI * 2, off = i < hs.length ? 0 : 20 + Math.random() * 30;
      const to = this.clampArena(h.x + Math.cos(a) * off, h.y + Math.sin(a) * off * 0.7);
      const fly = 0.9 + i * 0.12;
      const warn = sc.fx.telegraph(to.x, to.y, 15, fly);
      const zone = { x: to.x, y: to.y, r: 15, until: fly };
      sc.dangers.push(zone);
      const glob = sc.add.graphics().setDepth(100000 - 50);
      glob.fillStyle(0x5d8a3a).fillCircle(0, 0, 4).fillStyle(0xb8ff9a).fillCircle(-1, -1, 1.5);
      this.globs.push(glob);
      const from = { x: this.x, y: this.y - 30 }, st = { p: 0 };
      sc.tweens.add({
        targets: st, p: 1, duration: fly * 1000,
        onUpdate: () => { if (glob.active) glob.setPosition(from.x + (to.x - from.x) * st.p, from.y + (to.y - from.y) * st.p - Math.sin(st.p * Math.PI) * 50); },
        onComplete: () => {
          glob.destroy(); warn.destroy();
          sc.dangers = sc.dangers.filter((z) => z !== zone);
          if (!this.alive) return;
          sc.fx.burst('foam', to.x, to.y, 6);
          this.addPuddle(to.x, to.y);
        },
      });
    }
  }

  addPuddle(x, y) {
    const sc = this.scene;
    const g = sc.add.graphics().setDepth(-3);
    g.fillStyle(0x4f7a2f, 0.55).fillEllipse(x, y, 32, 20).fillStyle(0x9fd06a, 0.35).fillEllipse(x - 3, y - 2, 16, 8);
    const zone = { x, y, r: 15, until: 4 };
    sc.dangers.push(zone);
    this.puddles.push({ x, y, t: 4, g, zone, tick: 0 });
  }
  dropPuddle(p) { p.g.destroy(); this.scene.dangers = this.scene.dangers.filter((z) => z !== p.zone); }

  updatePuddles(dt) {
    for (const p of this.puddles) {
      p.t -= dt; p.tick -= dt;
      if (p.t < 1) p.g.setAlpha(p.t);
      if (p.tick <= 0) {
        p.tick = 0.5;
        for (const h of this.heroes()) if (!h.swimming && Math.hypot(h.x - p.x, (h.y - p.y) / 0.65) < 16 + h.r) h.addPoison(this.s.dmg * 0.25, 2);
      }
    }
    for (const p of this.puddles) if (p.t <= 0) this.dropPuddle(p);
    this.puddles = this.puddles.filter((p) => p.t > 0);
  }

  // ---- phase 2: under the pool, erupting at the edge every few seconds
  updateSubmerged(dt) {
    const sc = this.scene;
    this.sync(dt);
    this.waveT -= dt;
    if (this.waveT <= 0 && !this.surfaced) { this.waveT = 3.6; sc.addShockwave(this.x, this.y, 0.25, 230, 120, { skipSwimmers: true }); audio.sfx('squish'); sc.fx.burst('foam', this.x, this.y, 20); }
    this.summonT -= dt;
    if (this.summonT <= 0 && this.minions() < 2) { this.summonT = 11; const e = sc.spawnEnemy('mire', this.home.x + (Math.random() < 0.5 ? -90 : 90), this.home.y + 30, true); e.summoned = true; }

    if (!this.surfaced) {
      this.sprite.y = Math.round(this.y) + 10;
      this.sprite.setAlpha(0.55).setCrop(0, 0, 64, 40); // only her back and the hag show above the water
      this.surfaceT -= dt;
      if (this.surfaceT <= 0 && !this.rising) {
        // bubbles mark where she'll come up: the pool's edge nearest a hero
        const h = this.heroes().filter((x) => !x.swimming).sort(() => Math.random() - 0.5)[0] || this.heroes()[0];
        if (!h) return;
        const { rx, ry } = this.pool;
        const a = Math.atan2((h.y - this.home.y) / ry, (h.x - this.home.x) / rx);
        const at = { x: this.home.x + Math.cos(a) * rx * 16 * 0.8, y: this.home.y + Math.sin(a) * ry * 16 * 0.8 };
        this.rising = at;
        this.zoneGfx = sc.fx.telegraph(at.x, at.y, 34, 1.1);
        this.zone = { x: at.x, y: at.y, r: 34, until: 1.1 };
        sc.dangers.push(this.zone);
        sc.fx.burst('foam', at.x, at.y, 10);
        audio.sfx('hexCharge');
        this.riseT2 = 1.1;
      }
      if (this.rising) {
        this.riseT2 -= dt;
        if (Math.random() < dt * 12) sc.fx.burst('foam', this.rising.x + (Math.random() - 0.5) * 30, this.rising.y + (Math.random() - 0.5) * 16, 2);
        if (this.riseT2 <= 0) {
          // erupt: snap at anyone standing on the bubbles, then stay up for a few seconds
          const at = this.rising; this.rising = null;
          this.clearZone();
          this.x = at.x; this.y = at.y;
          this.surfaced = true; this.upT = 3.6;
          this.sprite.setCrop().setAlpha(1);
          this.play('attack');
          sc.fx.slam(at.x, at.y, 34); sc.fx.burst('foam', at.x, at.y, 24); sc.shake(260, 0.01); audio.sfx('bash');
          const dmg = this.s.dmg * sc.difficulty.dmg;
          for (const h of this.heroes()) if (Math.hypot(h.x - at.x, h.y - at.y) <= 34 + h.r) h.damage(dmg, this);
          sc.floatText(at.x, at.y - 70, 'SHE SURFACES! STRIKE!', 'fontGold');
        }
      }
      return;
    }
    // surfaced: open to attack; gulps at whoever is close, then sinks back
    this.upT -= dt;
    this.sprite.setDepth(this.y);
    if (this.upT > 0.8 && this.upT < 2.4 && !this.zone) {
      this.zone = { x: this.x, y: this.y, r: this.s.zr, until: 0.9 };
      sc.dangers.push(this.zone);
      this.zoneGfx = sc.fx.telegraph(this.x, this.y, this.s.zr, 0.9);
      this.play('windup');
      this.slamAt = this.upT - 0.9;
    }
    if (this.zone && this.slamAt != null && this.upT <= this.slamAt) {
      this.slamAt = null;
      const z = this.zone; this.clearZone();
      this.play('attack'); sc.fx.slam(z.x, z.y, z.r); sc.shake(200, 0.008); audio.sfx('bash');
      for (const h of this.heroes()) if (Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) h.damage(this.s.dmg * sc.difficulty.dmg, this);
      this.zone = { done: true }; // one gulp per surfacing
    }
    if (this.upT <= 0) {
      if (this.zone && !this.zone.done) this.clearZone();
      this.zone = null;
      this.surfaced = false; this.slamAt = null;
      this.surfaceT = 4.5;
      sc.fx.burst('foam', this.x, this.y, 16);
      sc.tweens.add({ targets: this, x: this.home.x, y: this.home.y, duration: 600 });
    }
  }

  // tongue grab: tugs a straggler in close, but not right under her
  tongue() {
    const sc = this.scene, t = this.tongueTarget;
    this.clearZone();
    this.state = 'recover'; this.t = 0;
    this.play('attack');
    if (!t?.alive || t.downed || t.invuln > 0 || Math.hypot(t.x - this.x, t.y - this.y) > 200) { sc.floatText(this.x, this.y - 24, 'MISS', 'fontPlain'); return; }
    audio.sfx('zip');
    const [nx, ny] = norm(t.x - this.x, t.y - this.y);
    let tx = this.x + nx * 58, ty = this.y + ny * 58;
    const open = sc.nav.nearestOpen(Math.floor(tx / 16), Math.floor(ty / 16));
    if (open && sc.nav.solidAtPx(tx, ty)) { tx = open[0] * 16 + 8; ty = open[1] * 16 + 8; }
    sc.tweens.add({ targets: t, x: tx, y: ty, duration: 220, onComplete: () => {
      t.damage(this.s.dmg * 0.6 * sc.difficulty.dmg, this);
      t.invuln = Math.max(t.invuln, 0.6);
      sc.floatText(t.x, t.y - 34, 'GULP!', 'fontPlain');
    } });
  }

  strike() {
    super.strike();
    this.scene.shake(220, 0.01);
    audio.sfx('bash');
  }
}

// ------------------------------------------------------------- Breakables
// Cracked walls / boulders hiding secrets. Anything that hits them counts.
// The Pale Huntsman (Gloamwood): King Aldric's master of hounds, given a hunt
// that never ends. He fights from range and won't be cornered.
//   phase 1: arrows and three-arrow volleys, a Hunter's Mark (a reticle, then a
//            heavy shot at where the hero stood: step out of it), spectral
//            hounds, and a leap away when crowded
//   phase 2 (60%): he vanishes. The Seer's Lens shows him faintly, footprints
//            show in the leaves, and he flickers into sight when he shoots
//   phase 3 (30%, true form only): six of him. Only the real one casts a shadow
// His Shadow (Witchroot Hollow) has 60% health and never reaches phase 3.
export class Huntsman extends Enemy {
  constructor(scene, x, y, opts = {}) {
    super(scene, 'huntsman', x, y, opts);
    this.boss = true;
    this.phase = 1;
    this.home = { x, y };
    this.arena = opts.arena || null; // tiles {x0,y0,x1,y1}
    this.isShadow = !!opts.shadow;
    if (this.isShadow) { this.maxHp = Math.round(this.maxHp * 0.6); this.hp = this.maxHp; }
    this.volleyT = 3; this.markT = 7; this.howlT = 5; this.leapT = 2; this.printT = 0; this.shuffleT = 8;
    this.veil = 1; this.echoes = [];
    this.restoreTint();
  }

  restoreTint() {
    const t = this.statusColor();
    if (t) this.sprite.setTint(t);
    else if (this.isShadow) this.sprite.setTint(0x8a6cc4);
    else this.sprite.clearTint();
  }
  knock(dx, dy, p) { super.knock(dx, dy, p * 0.15); }
  stun(t) { super.stun(t * 0.3); }
  setTaunt(by, t) { super.setTaunt(by, t * 0.5); }
  heroes() { return this.scene.party.filter((h) => h.alive && !h.downed); }

  clampArena(x, y) {
    const A = this.arena;
    if (!A) return { x, y };
    return { x: Math.max((A.x0 + 1) * 16, Math.min((A.x1) * 16, x)), y: Math.max((A.y0 + 1) * 16, Math.min((A.y1) * 16, y)) };
  }

  damage(amount, src, opts) {
    const r = Enemy.prototype.damage.call(this, amount, src, opts);
    if (!this.alive) return r;
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.6) this.enterPhase(2);
    else if (this.phase === 2 && f < 0.3 && !this.isShadow) this.enterPhase(3);
    return r;
  }

  enterPhase(n) {
    const sc = this.scene;
    this.phase = n;
    audio.sfx('roar', { pitch: 1.3 });
    sc.shake(400, 0.008);
    this.clearZone(); this.state = 'chase'; this.t = 0;
    if (n === 2) {
      sc.floatText(this.x, this.y - 60, 'HE FADES INTO THE DARK!', 'fontGold');
      sc.fx.burst('curse', this.x, this.y - 20, 24);
      const lens = sc.state.relics.includes('lens');
      const who = sc.party.find((h) => h.def.id === 'wren' && !h.downed) || sc.leader;
      sc.time.delayedCall(900, () => sc.bark(who, lens ? 'THE LENS! I CAN SEE HIM - JUST.' : 'WATCH THE LEAVES - HE LEAVES TRACKS!'));
      this.s = { ...this.s, speed: this.s.speed * 1.2 };
    } else {
      sc.floatText(this.x, this.y - 60, 'THE HUNT MULTIPLIES!', 'fontGold');
      this.veil = 1;
      this.spawnEchoes();
      const who = sc.party.find((h) => h.def.id === 'pip' && !h.downed) || sc.leader;
      sc.time.delayedCall(900, () => sc.bark(who, 'ONLY ONE OF THEM HAS A SHADOW!'));
    }
  }

  spawnEchoes() {
    const sc = this.scene;
    for (const e of this.echoes) if (e.alive) { e.alive = false; e.destroy(); }
    this.echoes = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = this.clampArena(this.home.x + Math.cos(a) * 70, this.home.y + Math.sin(a) * 45);
      const e = sc.spawnEnemy('huntecho', p.x, p.y, true, false);
      e.level = this.level; e.echoOf = this;
      e.shadow.setVisible(false); // the tell: echoes cast no shadow
      sc.fx.burst('curse', p.x, p.y - 20, 10);
      this.echoes.push(e);
    }
  }

  // everyone (him and his echoes) blinks to new places, so the real one has to be found again
  shuffle() {
    const sc = this.scene;
    const all = [this, ...this.echoes.filter((e) => e.alive)];
    for (const u of all) {
      const p = this.clampArena(this.home.x + (Math.random() - 0.5) * 200, this.home.y + (Math.random() - 0.5) * 120);
      sc.fx.burst('curse', u.x, u.y - 20, 8);
      u.x = p.x; u.y = p.y; u.state = 'chase'; u.clearZone();
      sc.fx.burst('curse', u.x, u.y - 20, 8);
    }
    audio.sfx('warp');
  }

  // a three-arrow volley at a hero
  volley(t) {
    const sc = this.scene;
    const base = Math.atan2(t.y - this.y, t.x - this.x);
    for (const da of [-0.22, 0, 0.22]) sc.spawnEnemyArrow(this, { x: this.x + Math.cos(base + da) * 100, y: this.y - 8 + Math.sin(base + da) * 100 + 8 }, this.s.dmg * 0.7 * sc.difficulty.dmg);
    this.reveal(0.5);
    this.anim = ''; this.play('attack');
  }

  // Hunter's Mark: a reticle follows a hero, locks, then a heavy shot flies
  // at where they stood
  mark(t) {
    const sc = this.scene;
    const g = sc.add.graphics().setDepth(100000 - 30);
    const st = { t: 0 };
    let lock = null;
    sc.floatText(t.x, t.y - 36, 'MARKED!', 'fontPlain', 0xff8a7a);
    audio.sfx('hexCharge', { pitch: 1.4 });
    const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
      st.t += 0.016;
      const p = lock || t;
      const r = 10 - Math.min(1, st.t / 1.2) * 4;
      g.clear().lineStyle(1, 0xff6a5e, 0.9).strokeCircle(p.x, p.y - 6, r).lineBetween(p.x - r - 3, p.y - 6, p.x + r + 3, p.y - 6).lineBetween(p.x, p.y - 6 - r - 3, p.x, p.y - 6 + r + 3);
      if (st.t >= 1.2 && !lock) lock = { x: t.x, y: t.y };
      if (st.t >= 1.55) {
        ev.remove(); g.destroy();
        if (!this.alive) return;
        sc.spawnEnemyArrow(this, { x: lock.x, y: lock.y }, this.s.dmg * 2.2 * sc.difficulty.dmg, 'heavy');
        this.reveal(0.6);
        this.anim = ''; this.play('attack');
      }
    } });
  }

  howl() {
    const sc = this.scene;
    const hounds = sc.enemies.filter((e) => e.alive && e.summonedBy === this).length;
    if (hounds >= 3) return;
    audio.sfx('roar', { pitch: 2.2 });
    sc.floatText(this.x, this.y - 50, 'THE HOUNDS ANSWER!', 'fontPlain', 0x9fd8ff);
    for (const dx of [-50, 50].slice(0, 3 - hounds)) { // never more than three at his heel
      const p = this.clampArena(this.x + dx, this.y + 30);
      const h = sc.spawnEnemy('hound', p.x, p.y, true);
      h.summonedBy = this; h.summoned = true; h.noLeash = true;
      sc.fx.burst('curse', p.x, p.y - 8, 10);
    }
  }

  leapAway() {
    const sc = this.scene;
    const near = this.heroes().sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
    if (!near) return;
    const [nx, ny] = norm(this.x - near.x, this.y - near.y);
    const p = this.clampArena(this.x + nx * 80, this.y + ny * 60);
    sc.fx.ghost?.(this);
    sc.fx.dust(this.x, this.y);
    sc.tweens.add({ targets: this, x: p.x, y: p.y, duration: 260, ease: 'Sine.easeOut' });
    audio.sfx('dash');
  }

  reveal(t) { this.revealT = Math.max(this.revealT || 0, t); }

  update(dt) {
    if (!this.alive) return;
    if (this.introT > 0) { super.update(dt); return; } // the entrance owns his fade-in
    const sc = this.scene;
    this.revealT = Math.max(0, (this.revealT || 0) - dt);
    // phase 2: veiled, with footprints in the leaves
    if (this.phase === 2) {
      const lens = sc.state.relics.includes('lens');
      const want = this.revealT > 0 || this.stunT > 0 ? 1 : lens ? 0.45 : 0.06;
      this.veil += (want - this.veil) * Math.min(1, dt * 8);
      this.printT -= dt;
      if (this.printT <= 0 && this.state !== 'windup') {
        this.printT = 0.32;
        const fp = sc.add.ellipse(this.x + (Math.random() < 0.5 ? -2 : 2), this.y + 2, 3, 2, 0x1a1423, 0.75).setDepth(-20);
        sc.tweens.add({ targets: fp, alpha: 0, duration: 2600, onComplete: () => fp.destroy() });
      }
    } else this.veil += (1 - this.veil) * Math.min(1, dt * 6);
    this.sprite.setAlpha(this.veil);
    this.shadow.setAlpha(this.phase === 2 ? this.veil * 0.28 : 0.28);
    this.hidden = this.veil < 0.3;
    if (this.phase === 3) { this.shuffleT -= dt; if (this.shuffleT <= 0) { this.shuffleT = 8; this.shuffle(); } }
    // special moves, only from the ready state
    if (this.engaged && !(this.introT > 0)) { this.volleyT -= dt; this.markT -= dt; this.howlT -= dt; this.leapT -= dt; }
    if (this.state === 'chase' && this.engaged && !(this.stunT > 0) && !(this.introT > 0)) {
      const t = this.target?.alive && !this.target.downed ? this.target : this.heroes()[0];
      if (t) {
        const crowd = this.heroes().some((h) => Math.hypot(h.x - this.x, h.y - this.y) < 40);
        if (crowd && this.leapT <= 0) { this.leapT = this.phase === 1 ? 4.5 : 3.5; this.leapAway(); }
        else if (this.markT <= 0) { this.markT = this.phase === 1 ? 9 : 7; this.mark(t); }
        else if (this.volleyT <= 0) { this.volleyT = this.phase === 1 ? 5 : 4; this.volley(t); }
        else if (this.howlT <= 0) { this.howlT = this.phase === 1 ? 12 : 14; this.howl(); }
      }
    }
    super.update(dt);
    if (this.state === 'windup') this.reveal(0.3); // drawing his bow shows him
  }

  die(src) {
    this.alive = false;
    this.clearZone();
    for (const e of this.echoes) if (e.alive) { this.scene.fx.burst('curse', e.x, e.y - 20, 10); e.alive = false; e.destroy(); }
    for (const e of this.scene.enemies) if (e.alive && e.summonedBy === this) { e.alive = false; e.destroy(); }
    this.scene.onBossKilled(this, src);
    this.destroy();
  }
}

// Forgemaster Vulk (Cinderreach): the salamander smith Malgrim gave a forge
// that never cools.
//   phase 1: a three-swing hammer combo, each swing telegraphed, and molten
//            globs lobbed onto marked spots that leave burning puddles
//   phase 2 (65%): four lava vents erupt in turn while slag boulders crash
//            down. While any vent is open he's stoked (half damage taken).
//            Shove a boulder onto a vent with the Stone Gauntlets to plug it:
//            each plug staggers him and opens him up
//   phase 3 (30%, true form only): his armour glows white-hot and turns most
//            blows. Frost cools it for a few seconds; so does his own breath
//            every few seconds (a window to strike)
// His Shadow (the Forge of Ash) has 60% health and never reaches phase 3.
export class Vulk extends Enemy {
  constructor(scene, x, y, opts = {}) {
    super(scene, 'vulk', x, y, opts);
    this.boss = true;
    this.phase = 1;
    this.home = { x, y };
    this.arena = opts.arena || null;
    this.isShadow = !!opts.shadow;
    if (this.isShadow) { this.maxHp = Math.round(this.maxHp * 0.6); this.hp = this.maxHp; }
    this.globT = 5; this.vents = []; this.slag = []; this.heatT = 0; this.coolT = 0;
    this.restoreTint();
  }
  restoreTint() {
    const t = this.statusColor();
    if (t) this.sprite.setTint(t);
    else if (this.isShadow) this.sprite.setTint(0x8a6cc4);
    else if (this.phase === 3 && this.coolT <= 0) this.sprite.setTint(0xffe0a0);
    else this.sprite.clearTint();
  }
  knock(dx, dy, p) { super.knock(dx, dy, p * 0.1); }
  stun(t) { super.stun(t * 0.3); }
  setTaunt(by, t) { super.setTaunt(by, t * 0.5); }
  heroes() { return this.scene.party.filter((h) => h.alive && !h.downed); }
  clampArena(x, y) {
    const A = this.arena;
    if (!A) return { x, y };
    return { x: Math.max((A.x0 + 1) * 16, Math.min(A.x1 * 16, x)), y: Math.max((A.y0 + 1) * 16, Math.min(A.y1 * 16, y)) };
  }
  get stoked() { return this.phase >= 2 && this.vents.some((v) => !v.plugged); }

  damage(amount, src, opts) {
    if (this.phase === 3 && this.lastElement === 'frost' && this.coolT <= 0) this.cool(4); // frost always cools him
    if (this.staggerT > 0) amount *= 1.3;
    else if (this.phase === 3 && this.coolT <= 0) { amount *= 0.12; this.hintMsg('WHITE-HOT! COOL HIM - FROST!'); }
    else if (this.stoked) { amount *= 0.5; this.hintMsg('THE VENTS STOKE HIM - PLUG THEM!'); }
    const r = Enemy.prototype.damage.call(this, amount, src, opts);
    if (!this.alive) return r;
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.65) this.enterPhase(2);
    else if (this.phase === 2 && f < 0.3 && !this.isShadow) this.enterPhase(3);
    return r;
  }
  hintMsg(t) { const sc = this.scene; if (!this.msgT || sc.time.now > this.msgT) { this.msgT = sc.time.now + 2500; sc.floatText(this.x, this.y - 64, t, 'fontPlain', 0xffd04a); } }

  enterPhase(n) {
    const sc = this.scene;
    this.phase = n;
    audio.sfx('roar', { pitch: 0.7 });
    sc.shake(500, 0.012);
    this.clearZone(); this.state = 'chase'; this.t = 0;
    if (n === 2) {
      sc.floatText(this.x, this.y - 70, 'THE FORGE ROARS!', 'fontGold');
      const spots = [[-64, -40], [64, -40], [-64, 40], [64, 40]];
      for (const [dx, dy] of spots) {
        const p = this.clampArena(this.home.x + dx, this.home.y + dy);
        if (sc.nav.solidAtPx(p.x, p.y)) continue;
        const v = { x: p.x, y: p.y, plugged: false, t: 1 + this.vents.length * 0.9 };
        v.s = sc.add.sprite(p.x, p.y + 4, 'vent0').setOrigin(0.5, 1).play('vent0').setScale(1.6).setDepth(p.y);
        this.vents.push(v);
        // a slag boulder crashes down beside each vent (off its tile, toward the middle)
        const bx = p.x - Math.sign(dx) * 32, by = p.y - Math.sign(dy) * 16;
        this.dropSlag(bx, by);
      }
      const who = sc.party.find((h) => !h.downed) || sc.leader;
      sc.time.delayedCall(1200, () => sc.bark(who, sc.state.relics.includes('gauntlets') ? 'THE GAUNTLETS! SHOVE THOSE BOULDERS ONTO THE VENTS!' : "THOSE VENTS ARE FEEDING HIM. IF ONLY WE COULD MOVE THOSE ROCKS..."));
    } else {
      sc.floatText(this.x, this.y - 70, 'HIS ARMOUR BLAZES WHITE-HOT!', 'fontGold');
      this.coolT = 0; this.heatT = 6;
      this.restoreTint();
      const pip = sc.party.find((h) => h.def.id === 'pip' && !h.downed) || sc.leader;
      sc.time.delayedCall(1000, () => sc.bark(pip, 'FROST! COOL HIS ARMOUR AND IT CRACKS!'));
    }
  }

  dropSlag(x, y) {
    const sc = this.scene;
    const b = { x, y, s: sc.add.image(x, y - 80, 'dgBoulder').setOrigin(0.5, 1).setDepth(y) };
    sc.tweens.add({ targets: b.s, y: y + 8, duration: 500, ease: 'Quad.easeIn', onComplete: () => { sc.fx.dust(x, y); sc.shake(140, 0.006); audio.sfx('bash'); } });
    sc.nav.block(Math.floor(x / 16), Math.floor(y / 16));
    b.o = sc.addInteractable({ x, y, reach: 26, standOff: 14, h: 18, kind: 'block', interact: (h) => this.shove(b, h || sc.leader) });
    this.slag.push(b);
  }

  // the Gauntlets shove a slag boulder one tile away from the hero
  shove(b, h) {
    const sc = this.scene;
    if (!sc.state.relics.includes('gauntlets')) { audio.sfx('block'); sc.bark(h, "IT'S FAR TOO HEAVY TO MOVE."); return; }
    if (b.moving || b.plugged) return;
    const dx = b.x - h.x, dy = b.y - h.y;
    const [sx, sy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    const nx = b.x + sx * 16, ny = b.y + sy * 16;
    const vent = this.vents.find((v) => !v.plugged && Math.hypot(v.x - nx, v.y - ny) < 14);
    if (!vent && sc.nav.solidAtPx(nx, ny)) { audio.sfx('block'); return; }
    b.moving = true;
    sc.nav.unblock(Math.floor(b.x / 16), Math.floor(b.y / 16));
    b.x = vent ? vent.x : nx; b.y = vent ? vent.y : ny;
    h.face(sx, sy); h.anim = ''; h.play('attack');
    audio.sfx('push'); sc.fx.dust(b.s.x, b.s.y);
    sc.tweens.add({ targets: b.s, x: b.x, y: b.y + 8, duration: 180, onComplete: () => {
      b.moving = false; b.o.x = b.x; b.o.y = b.y; b.s.setDepth(b.y);
      if (vent) this.plug(vent, b);
      else sc.nav.block(Math.floor(b.x / 16), Math.floor(b.y / 16));
    } });
  }

  plug(v, b) {
    const sc = this.scene;
    v.plugged = true; b.plugged = true;
    v.s.stop(); v.s.setTexture('vent0', '0').setTint(0x555060);
    b.s.setTexture('dgBoulderSunk').setOrigin(0.5).setPosition(v.x, v.y).setDepth(v.y - 2);
    sc.removeInteractable(b.o);
    sc.fx.burst('ember', v.x, v.y - 6, 24); sc.shake(300, 0.01); audio.sfx('bash'); audio.sfx('fireImpact', { pitch: 0.6 });
    this.staggerT = 2.5; this.stunT = Math.max(this.stunT, 2.5); this.clearZone(); this.state = 'chase';
    const left = this.vents.filter((q) => !q.plugged).length;
    sc.floatText(this.x, this.y - 70, left ? `VENT PLUGGED! ${left} LEFT` : 'THE FORGE GOES QUIET!', 'fontGold');
  }

  cool(t) {
    const sc = this.scene;
    this.coolT = t;
    this.restoreTint();
    sc.fx.burst('spark', this.x, this.y - 30, 16);
    sc.floatText(this.x, this.y - 64, 'HIS ARMOUR COOLS!', 'fontPlain', 0x9fd8ff);
  }

  // a lobbed glob of molten metal: a marked spot, then a burning puddle
  globs(n) {
    const sc = this.scene;
    const hs = this.heroes();
    for (let i = 0; i < n && hs.length; i++) {
      const t = hs[i % hs.length];
      const p = this.clampArena(t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 30);
      const zone = { x: p.x, y: p.y, r: 18, until: 1.2 };
      sc.dangers.push(zone);
      const g = sc.fx.telegraph(p.x, p.y, 18, 1.2);
      sc.time.delayedCall(1200, () => {
        g.destroy();
        if (!this.alive) { sc.dangers = sc.dangers.filter((z) => z !== zone); return; }
        sc.fx.burst('ember', p.x, p.y - 4, 12); audio.sfx('fireImpact');
        for (const h of sc.party) if (h.alive && !h.downed && h.invuln <= 0 && Math.hypot(h.x - p.x, h.y - p.y) < 18 + h.r) h.damage(this.s.dmg * 0.6 * sc.difficulty.dmg, this);
        // the puddle burns a while
        const pud = sc.add.ellipse(p.x, p.y, 30, 18, 0xff7b2e, 0.4).setDepth(-25);
        zone.until = 4;
        sc.tweens.add({ targets: pud, alpha: 0, duration: 4000, onComplete: () => { pud.destroy(); sc.dangers = sc.dangers.filter((z) => z !== zone); } });
        let k = 0;
        sc.time.addEvent({ delay: 600, repeat: 5, callback: () => { k++; for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - p.x, h.y - p.y) < 14) { h.damage(this.s.dmg * 0.15 * sc.difficulty.dmg, null); h.addBurn(this.s.dmg * 0.08, 2); } } });
        void k;
      });
    }
    sc.floatText(this.x, this.y - 64, 'MOLTEN METAL!', 'fontPlain', 0xffa060);
    this.anim = ''; this.play('attack');
  }

  updateVents(dt) {
    const sc = this.scene;
    for (const v of this.vents) {
      if (v.plugged) continue;
      v.t -= dt;
      if (v.t > 0) continue;
      v.t = 3.6;
      const zone = { x: v.x, y: v.y, r: 28, until: 0.9 };
      sc.dangers.push(zone);
      const g = sc.fx.telegraph(v.x, v.y, 28, 0.9);
      sc.time.delayedCall(900, () => {
        g.destroy(); sc.dangers = sc.dangers.filter((z) => z !== zone);
        if (v.plugged || !this.alive) return;
        sc.fx.burst('ember', v.x, v.y - 10, 26); audio.sfx('fireImpact', { pitch: 0.8 });
        for (const h of sc.party) if (h.alive && !h.downed && h.invuln <= 0 && Math.hypot(h.x - v.x, h.y - v.y) < 28 + h.r) h.damage(this.s.dmg * 0.8 * sc.difficulty.dmg, { x: v.x, y: v.y });
      });
    }
  }

  update(dt) {
    if (!this.alive) return;
    if (this.introT > 0) { super.update(dt); return; }
    this.staggerT = Math.max(0, (this.staggerT || 0) - dt);
    if (this.phase >= 2) this.updateVents(dt);
    if (this.phase === 3) {
      const was = this.coolT > 0;
      this.coolT = Math.max(0, this.coolT - dt);
      this.heatT -= dt;
      if (this.heatT <= 0) { this.heatT = 9; this.cool(2.5); } // he has to breathe: a short window
      if (was && this.coolT <= 0) this.restoreTint();
    }
    if (this.engaged && this.state === 'chase' && !(this.stunT > 0)) {
      this.globT -= dt;
      if (this.globT <= 0) { this.globT = this.phase === 1 ? 7 : 5.5; this.globs(this.phase === 1 ? 3 : 4); }
    }
    super.update(dt);
  }

  die(src) {
    this.alive = false;
    this.clearZone();
    for (const v of this.vents) v.s?.destroy();
    for (const b of this.slag) { if (!b.plugged) { this.scene.nav.unblock(Math.floor(b.x / 16), Math.floor(b.y / 16)); this.scene.removeInteractable(b.o); } b.s.destroy(); }
    this.scene.onBossKilled(this, src);
    this.destroy();
  }
}

export class Breakable extends Unit {
  constructor(scene, def) {
    const x = def.x * 16 + 8, y = def.y * 16 + 8;
    super(scene, x, y, { key: def.tex || (def.kind === 'boulder' ? 'boulder_cracked' : 'wall_cracked'), maxHp: def.hp, team: 'enemy', r: def.kind === 'boulder' ? 14 : 8, shadow: 'shadowL' });
    this.def = def;
    this.kind = 'breakable';
    this.engaged = false;
    this.sprite.setOrigin(0.5, 1).setPosition(x, y + 8).setDepth(y + 4);
    this.shadow.setVisible(def.kind === 'boulder').setAlpha(0.25);
  }
  damage(amount, src) {
    if (!this.alive) return 0;
    if (this.def.reinforced) { // iron-strapped: only the Stone Gauntlets break it
      if (!this.scene.state.relics.includes('gauntlets')) {
        audio.sfx('block');
        if (!this.hintT || this.scene.time.now > this.hintT) { this.hintT = this.scene.time.now + 3000; this.scene.floatText(this.x, this.y - 24, 'IT WON\'T BREAK. NOT FOR A BLADE.', 'fontPlain'); }
        return 0;
      }
      amount *= 6;
    }
    amount = Math.round(amount);
    this.hp -= amount;
    this.flash(60, 0xffffff);
    this.scene.fx.burst('spark', this.x, this.y - 8, 4);
    this.scene.shake(40, 0.002);
    audio.sfx('block');
    if (this.hp <= 0) { this.alive = false; this.scene.onBreak(this); }
    return amount;
  }
  update(dt) { if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.sprite.clearTint(); } }
}

// ------------------------------------------------------------- Gizmo's gadgets
// Friendly machines on the field: a turret that shoots, a repair bot that
// heals, and Clank the mech that taunts and slams. They live in scene.allies
// (so enemy strikes and shots can hit them) and scene.gadgets (updated each
// frame). Damage scales off Gizmo's attack; Overcharge doubles their pace
// and makes their hits Shock.
const GADGET = {
  turret: { tex: 'gadget_turret', hp: 0.6, life: 12, r: 6 },
  bot: { tex: 'gadget_bot', hp: 0.4, life: 8, r: 5 },
  clank: { tex: 'gadget_clank', hp: 2.2, life: 12, r: 11 },
  decoy: { tex: null, hp: 0.3, life: 2, r: 6 }, // Nightsilk Coat: a shadow of the owner
};
export class Gadget extends Unit {
  constructor(scene, owner, kind, x, y, m = 1) {
    const g = GADGET[kind];
    super(scene, x, y, { key: g.tex || owner.sprite.texture.key, frame: g.tex ? 'idle_0' : owner.sprite.frame.name, maxHp: Math.round(owner.maxHp * g.hp), team: 'party', r: g.r, shadow: kind === 'clank' ? 'shadowL' : 'shadow' });
    this.kind = kind; this.owner = owner; this.m = m;
    this.life = g.life * (kind === 'turret' && owner.hasPerk?.('turret2') ? 2 : 1);
    this.ally = true; this.gadget = true;
    this.t = 0.4;
    if (g.tex) this.sprite.play(`${g.tex}_idle`);
    else {
      this.sprite.setOrigin(0.5, 0.75).setFlipX(owner.flip).setTint(0x8a5cc8).setAlpha(0.6);
      for (const e of scene.enemies) if (e.alive && e.engaged && !e.boss && Math.hypot(e.x - x, e.y - y) < 90) e.setTaunt(this, 2);
    }
    if (kind === 'clank') this.sprite.setOrigin(0.5, 44 / 48);
    scene.fx.puff(x, y - 6, 'spark');
    (scene.allies ??= []).push(this);
    (scene.gadgets ??= []).push(this);
  }
  get over() { return this.owner.overchargeT > 0; }
  damage(amt) {
    if (!this.alive) return 0;
    this.hp -= amt; this.flash(60);
    this.scene.floatText(this.x, this.y - 20, `${Math.round(amt)}`, 'font', 0xff6a6a);
    if (this.hp <= 0) this.expire();
    return amt;
  }
  expire() {
    if (!this.alive) return;
    const sc = this.scene;
    this.alive = false;
    sc.fx.puff(this.x, this.y - 6, 'spark'); audio.sfx('block', { pitch: 1.6 });
    sc.allies = sc.allies.filter((a) => a !== this);
    sc.gadgets = sc.gadgets.filter((a) => a !== this);
    for (const e of sc.enemies) if (e.taunter === this) { e.tauntT = 0; e.taunter = null; }
    this.destroy();
  }
  update(dt) {
    if (!this.alive) return;
    const sc = this.scene, o = this.owner, rate = this.over ? 2 : 1;
    this.life -= dt;
    if (this.life <= 0 || !o.alive) { this.expire(); return; }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.sprite.clearTint(); }
    this.t -= dt * rate;
    if (this.kind === 'turret' && this.t <= 0) {
      const e = sc.enemies.filter((k) => sc.fairTarget(k) && !k.submerged && Math.hypot(k.x - this.x, k.y - this.y) < 110).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
      if (e) {
        this.t = 0.9;
        const [nx, ny] = norm(e.x - this.x, e.y - 8 - (this.y - 10));
        this.flip = nx < 0; this.sprite.setFlipX(this.flip);
        this.sprite.play('gadget_turret_attack');
        sc.spawnProjectile({ owner: o, target: e, x: this.x + nx * 8, y: this.y - 10, vx: nx * 260, vy: ny * 260, dmg: o.stats.atk * 0.55 * this.m, kind: 'arrow', life: 0.6, element: this.over || o.hasPerk?.('turret2') ? 'storm' : undefined });
        audio.sfx('swing', { pitch: 2.1 });
      } else this.t = 0.3;
    }
    if (this.kind === 'bot') {
      this.y += Math.sin(sc.time.now / 200) * 0.05;
      if (this.t <= 0) {
        this.t = 1;
        for (const h of sc.party) if (h.alive && !h.downed && Math.hypot(h.x - this.x, h.y - this.y) < 44 && h.hp < h.maxHp) h.heal(Math.round(h.maxHp * 0.04 * this.m));
        sc.fx.ring(this.x, this.y - 6, 'ringWhite', 1.6);
      }
      // drift after Gizmo
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d > 30) { const [nx, ny] = norm(o.x - this.x, o.y - this.y); this.x += nx * 40 * dt; this.y += ny * 40 * dt; }
    }
    if (this.kind === 'clank') {
      const e = sc.enemies.filter((k) => sc.fairTarget(k) && !k.submerged).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
      if (e && Math.hypot(e.x - this.x, e.y - this.y) > 30) {
        const [nx, ny] = norm(e.x - this.x, e.y - this.y);
        this.moveBy(nx * 46 * dt, ny * 46 * dt); this.flip = nx < 0; this.sprite.setFlipX(this.flip);
        if (this.sprite.anims.currentAnim?.key !== 'gadget_clank_walk' && this.t > 0.2) this.sprite.play('gadget_clank_walk');
      }
      if (this.t <= 0 && e && Math.hypot(e.x - this.x, e.y - this.y) < 44) {
        this.t = 1.6;
        this.sprite.play('gadget_clank_attack');
        sc.fx.slam(this.x, this.y, 36); sc.shake(160, 0.006); audio.sfx('bash');
        for (const k of sc.enemies) if (k.alive && Math.hypot(k.x - this.x, k.y - this.y) < 36 + k.r) { sc.dealDamage(o, k, o.stats.atk * 1.6 * this.m, { knock: 90, element: this.over ? 'storm' : undefined }); }
        for (const k of sc.enemies) if (k.alive && !k.boss && Math.hypot(k.x - this.x, k.y - this.y) < 90) k.setTaunt(this, 2.5); // HEY! OVER HERE!
        sc.floatText(this.x, this.y - 40, 'CLANK!', 'fontGold');
      }
    }
    this.sync(dt);
  }
}

// ------------------------------------------------------------- Ward Stone
export class WardStone extends Unit {
  constructor(scene, x, y) {
    super(scene, x, y, { key: 'ward', frame: '0', maxHp: 260, team: 'enemy', r: 10, shadow: 'shadowL' });
    this.kind = 'ward';
    this.sprite.setOrigin(0.5, 1).play('ward');
    this.engaged = false;
    this.shadow.setAlpha(0.3);
  }
  damage(amount, src, { crit = false } = {}) {
    if (!this.alive) return 0;
    if (this.scene.wardShielded(this)) {
      this.flash(60, 0x9fd8ff);
      if (!this.shieldMsgT || this.scene.time.now > this.shieldMsgT) { this.shieldMsgT = this.scene.time.now + 900; this.scene.floatText(this.x, this.y - 44, 'SHIELDED', 'fontPlain'); audio.sfx('block'); }
      const hk = `wardHint_${this.wardDef?.id}`;
      if (!this.scene.flags[hk]) { this.scene.flags[hk] = true; const pip = this.scene.party.find((h) => h.def.id === 'pip') || this.scene.leader; this.scene.bark(pip, !this.scene.flags[this.wardDef?.guardian] ? 'SHIELDED. THAT VINE IS FEEDING IT - FIND WHERE IT STARTS AND CUT IT OFF.' : 'STILL SHIELDED... SOMETHING ELSE IS GUARDING IT.'); }
      return 0;
    }
    amount = Math.round(amount);
    this.hp -= amount;
    this.flash(crit ? 90 : 60, 0xffd0ff);
    this.scene.shake(40, 0.002);
    if (this.hp <= 0) { this.alive = false; this.scene.onWardDestroyed(this); }
    return amount;
  }
  update(dt) { this.sync(dt); this.sprite.setDepth(this.y + 2); }
  sync(dt) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.sprite.clearTint(); }
    this.sprite.setPosition(this.x, this.y + 6);
    this.shadow.setPosition(this.x + 1, this.y + 4);
  }
}

export { dist, norm, CURSE_TINT };
