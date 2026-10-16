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
    const nx = this.x + dx;
    if (!nav.solidAtPx(nx - r, this.y - r * 0.6) && !nav.solidAtPx(nx + r, this.y - r * 0.6) && !nav.solidAtPx(nx - r, this.y + r * 0.6) && !nav.solidAtPx(nx + r, this.y + r * 0.6)) this.x = nx;
    const ny = this.y + dy;
    if (!nav.solidAtPx(this.x - r, ny - r * 0.6) && !nav.solidAtPx(this.x + r, ny - r * 0.6) && !nav.solidAtPx(this.x - r, ny + r * 0.6) && !nav.solidAtPx(this.x + r, ny + r * 0.6)) this.y = ny;
  }

  sync(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.restoreTint();
    }
    // lift: standing up on something (a lookout platform) — drawn higher, sorted as if on the ground
    const lift = this.lift || 0;
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - lift));
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
  addUlt(n) { if (!this.downed) this.ult = this.ult + n * (this.stats?.traits?.includes('zeal') ? 1.15 : 1); }
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

  buff(stat, mul, t) { this.buffs[stat] = { mul, t }; }

  // Poison from leeches / venom: ticks down HP for a few seconds.
  addPoison(dps, t) {
    if (this.downed || this.antidoteT > 0) return;
    this.poison = { dps: Math.max(dps, this.poison?.dps || 0), t: Math.max(t, this.poison?.t || 0), next: this.poison?.next ?? 0.6 };
    this.sprite.setTint(0xb8ff9a);
  }
  buffMul(stat) { return this.buffs[stat]?.mul || 1; }

  heal(amt) {
    if (this.downed || amt <= 0) return;
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
    if (id === 'brann' || id === 'kesh') audio.sfx('swing', { pitch: id === 'kesh' ? 0.65 : 0.8 });
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
      sc.spawnProjectile({ owner: this, x: this.x + nx * 8, y: this.y - 8, vx: nx * 280, vy: ny * 280, dmg: this.stats.atk, kind: 'arrow', target, basic: true, critBonus: far ? 0.15 : 0, life: 0.8 });
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
  }

  useSkill(i, target) {
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
    amount = Math.max(1, Math.round(mitigate(amount, this.stats.def * this.buffMul('def'), src?.level || 1)));
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
    if (!this.downed) this.addUlt(dt * tuning.ultPassive); // slow passive recharge (~45s)
    this.hs.hp = this.hp;
    for (const s of this.skills) s.t = Math.max(0, s.t - dt);
    this.physics(dt);

    if (this.downed) { this.sync(dt); return; }

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

    // 1) step out of telegraphed danger zones
    const danger = sc.dangers.find((z) => Math.hypot(this.x - z.x, this.y - z.y) < z.r + 4);
    if (danger) {
      const [nx, ny] = norm(this.x - danger.x, this.y - danger.y);
      this.face(nx, ny);
      this.moveBy(nx * this.spd * 1.3 * dt, ny * this.spd * 1.3 * dt);
      this.clearPath();
      return;
    }

    // 2) revive a downed ally
    if (this.reviveTarget) {
      const r = this.reviveTarget;
      if (!r.downed) { this.reviveTarget = null; this.reviveT = 0; }
      else if (dist(this, r) < 14) {
        this.clearPath();
        this.play('cast');
        this.reviveT += dt;
        if (this.reviveT > 1.4) { r.revive(0.4); audio.sfx('heal'); this.reviveTarget = null; this.reviveT = 0; }
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
    if (this.target && dl0 > 112) this.target = null;

    // 4) fight
    const t = this.target;
    if (t && t.alive) {
      const d = dist(this, t);
      const st = this.stats;
      if (this.ranged) {
        // kite: step back only when something is really close, and never far from the leader
        if (d < 34 && dl0 < 110) {
          const [nx, ny] = norm(this.x - t.x, this.y - t.y);
          this.moveBy(nx * st.speed * dt, ny * st.speed * dt);
          this.face(t.x - this.x, t.y - this.y);
          this.clearPath();
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

    // 4) follow in formation behind the leader
    const slot = this.formationSlot();
    const dl = dist(this, L);
    if (dl > 230) { this.teleportNear(slot); return; }
    const ds = Math.hypot(this.x - slot.x, this.y - slot.y);
    // settle/resume with a gap between the thresholds so we don't stop-start
    // (only settle once the leader has stopped; while it walks, keep easing)
    const lsp = Math.hypot(L.vel?.x || 0, L.vel?.y || 0);
    if (ds < 3 && lsp < 12) this.settled = true;
    else if (ds > 12 || lsp > 20) this.settled = false;
    if (!this.settled && ds < 48 && this.scene.nav.lineClear(this.x, this.y, slot.x, slot.y, 3)) {
      // close and in the open: ease toward the slot, matching the leader's pace
      // rather than sprinting there and stopping dead
      this.clearPath();
      const want = Math.min(this.spd * 1.3, lsp + ds * 3);
      const [nx, ny] = norm(slot.x - this.x, slot.y - this.y);
      const step = Math.min(ds, want * dt);
      if (lsp > 12) this.face(L.head?.x ?? nx, L.head?.y ?? ny); else this.face(nx, ny);
      this.moveBy(nx * step, ny * step);
    } else if (!this.settled) {
      this.repathT -= dt;
      if (!this.path || this.repathT <= 0) { this.path = null; this.setGoal(slot.x, slot.y); }
      this.followPath(dt, dl > 40 ? 1.3 : 1);
    } else {
      this.clearPath();
      if (L.view) this.face(L.x - this.x + (L.view === 'side' ? (L.flip ? -40 : 40) : 0), L.y - this.y + (L.view === 'down' ? 40 : L.view === 'up' ? -40 : 0));
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
        || (id === 'talons' && (near.length >= 2 || boss)) || (id === 'primal' && (near.length >= 2 || boss || this.hp / this.maxHp < 0.5));
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
    const bx = L.x - fx * 14 + -fy * side * 11;
    const by = L.y - fy * 12 + fx * side * 8;
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
const ENEMY_TEX = { goblin: 'goblin', hexling: 'hexling', mire: 'mire', golem: 'golem', archer: 'archer', knight: 'knight', rats: 'rats', hollow: 'hollow', hollowpile: 'hollowpile', boar: 'boar', crab: 'crab', wisp: 'wisp', warlock: 'warlock', snagtooth: 'goblin', pitchamp: 'goblin', drowned: 'drowned', witchling: 'witchling', leeches: 'leeches', lurker: 'lurker', croaker: 'croaker', snapjaw: 'snapjaw', murk: 'murk' };
const PUPPETS = new Set(['goblin', 'archer', 'knight', 'hollow', 'warlock', 'snagtooth', 'pitchamp', 'drowned', 'witchling']);

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
    this.restoreTint();
  }

  restoreTint() {
    const t = this.statusColor();
    if (t) this.sprite.setTint(t);
    else if (this.frenzy) this.sprite.setTint(0xff8a7a);
    else if (this.elite) this.sprite.setTint(0xffd889);
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
    if (el === 'fire') this.status.burn = { t: 3 * dur, tick: 0.5, next: 0.5, dmg: base * 0.12 };
    else if (el === 'venom') {
      const n = Math.min(5, (this.status.poison?.n || 0) + 1);
      this.status.poison = { t: 4 * dur, tick: 0.6, next: this.status.poison?.next ?? 0.6, dmg: base * 0.09, n };
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

  aggroOn(h, spread = true) {
    if (!h || h.downed || this.staged) return;
    const was = this.engaged;
    this.target = this.tauntT > 0 ? this.taunter : h;
    this.engaged = true;
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    if (!was) {
      this.scene.fx.alert(this);
      if (this.elite) this.scene.floatText(this.x, this.y - 34, this.named ? this.s.name : `${this.affix ? AFFIXES[this.affix] : 'ELITE'} ${this.s.name}`, 'fontGold');
      if (spread) for (const e of this.scene.enemies) if (e !== this && e.alive && !e.engaged && dist(e, this) < 70) e.aggroOn(h, false);
    }
  }

  damage(amount, src, { crit = false, knock = 40, dot = false } = {}) {
    if (!this.alive) return 0;
    if (this.submerged || this.introT > 0) return 0;
    if (this.staged && src?.team === 'party') this.engageStaged(src instanceof Hero && !src.downed ? src : this.scene.leader);
    // Armored: a frontal guard. Hit it from the side or behind, while it's stunned, or Shock it
    if (this.affix === 'armored' && src && !dot && !(this.stunT > 0) && !this.status?.shock) {
      const f = this.view === 'side' ? [this.flip ? -1 : 1, 0] : [0, this.view === 'down' ? 1 : -1];
      const [dx, dy] = norm(src.x - this.x, src.y - this.y);
      if (f[0] * dx + f[1] * dy > 0.3) {
        amount *= 0.35;
        if (!this.guardMsgT || this.scene.time.now > this.guardMsgT) { this.guardMsgT = this.scene.time.now + 1500; this.scene.floatText(this.x, this.y - 30, 'GUARDED - FLANK IT', 'fontPlain', 0xbfd0e6); audio.sfx('block'); }
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
    if (src && src.team === 'party') this.aggroOn(src);
    if (this.hp <= 0) this.die(src);
    else if (this.elite) this.affixOnHurt();
    return amount;
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
      this.reformT = (this.reformT ?? 5) - dt;
      this.sprite.setAngle(this.reformT < 1.5 ? Math.sin(this.reformT * 40) * 4 : 0);
      if (this.reformT <= 0) {
        this.alive = false; this.destroy();
        const g = this.scene.spawnEnemy('hollow', this.x, this.y, true);
        g.hp = Math.round(g.maxHp * 0.5); g.reassembled = true;
        this.scene.floatText(this.x, this.y - 30, 'IT REASSEMBLED!', 'fontPlain', 0xd9b8ff);
      }
      this.sync(dt);
      return;
    }
    this.physics(dt);
    this.tauntT = Math.max(0, this.tauntT - dt);
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
    if (this.affix) this.affixTick(dt);
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
        const h = sc.nearestHero(this, s.aggro);
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
        const t = this.target;
        if (!t) { this.state = 'return'; break; }
        // give up the chase: too far from home, or the target has pulled well away for a moment
        const d = dist(this, t);
        this.loseT = d > s.aggro * 1.4 ? (this.loseT || 0) + dt : 0;
        if (!this.boss && (Math.hypot(this.x - this.spawn.x, this.y - this.spawn.y) > 160 || this.loseT > 1.2)) { this.state = 'return'; this.engaged = false; this.target = null; this.loseT = 0; this.homeT = 0; this.clearZone(); break; }
        if (s.ranged) {
          // archers keep their distance and need a clear shot
          if (d < s.keepAway) { this.stepTo({ x: this.x * 2 - t.x, y: this.y * 2 - t.y }, dt, 0.9); break; }
          if (d <= s.reach && this.onScreen() && this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 1)) { this.beginWindup(t); break; }
          this.stepTo(t, dt, 1);
          break;
        }
        if (s.ai === 'tongue' && (this.tongueCd || 0) <= 0 && d > 34 && d < s.reach && this.onScreen()) { this.beginTongue(t); break; }
        if (s.ai === 'charge' && this.chargeCd <= 0 && d > 40 && d < 130 && this.onScreen() && this.scene.nav.lineClear(this.x, this.y, t.x, t.y, 2)) { this.beginCharge(t); break; }
        if (d <= s.reach + t.r) { this.beginWindup(t); break; }
        this.stepTo(t, dt, 1);
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
        if (this.t >= s.windup) this.strike();
        break;
      }
      case 'recover': {
        this.play('recover');
        if (this.t >= s.recover) { this.state = 'chase'; this.t = 0; }
        break;
      }
      case 'return': {
        this.engaged = false;
        this.hp = Math.min(this.maxHp, this.hp + dt * 20);
        if (Math.hypot(this.x - this.spawn.x, this.y - this.spawn.y) < 6) { this.state = 'idle'; this.homeT = 0; break; }
        this.stepTo(this.spawn, dt, 1);
        // heading home: ignore the party for a couple of seconds so it doesn't ping-pong
        this.homeT = (this.homeT || 0) + dt;
        const h = this.homeT > 2 && sc.nearestHero(this, s.aggro * 0.6);
        if (h) { this.homeT = 0; this.aggroOn(h); }
        break;
      }
    }
    this.sync(dt);
  }

  // Errand set-piece (Quill's ambush): circle the NPC and swing at them for
  // show. No damage, no aggro, until the errand is taken or someone hits us.
  // staged.wake: the errand is already running (after a reload), so the
  // party walking up is enough to start the fight.
  updateStaged(dt) {
    const st = this.staged, n = st.npc, sc = this.scene;
    if (st.wake) { const h = sc.nearestHero(this, this.s.aggro); if (h) { this.engageStaged(h); return; } }
    st.a = (st.a ?? Math.random() * Math.PI * 2) + dt * 0.3;
    const ring = this.s.ranged ? 40 : 17;
    const spot = { x: n.px + Math.cos(st.a) * ring, y: n.py + 4 + Math.sin(st.a) * ring * 0.7 };
    st.swing = Math.max(0, (st.swing || 0) - dt);
    st.t = (st.t ?? 0.4 + Math.random()) - dt;
    if (st.swing > 0) return; // mid-swing: hold the pose
    if (Math.hypot(spot.x - this.x, spot.y - this.y) > 4) { this.stepTo(spot, dt, 0.45); return; }
    this.face(n.px - this.x, n.py - this.y);
    if (st.t <= 0) {
      st.t = 1 + Math.random() * 1.2; st.swing = 0.35;
      this.anim = ''; this.play('attack');
      if (!this.s.ranged) sc.time.delayedCall(140, () => { if (!n.s?.active || !this.staged) return; n.s.setTintFill(0xffffff); sc.time.delayedCall(60, () => n.s.active && n.s.clearTint()); });
      if (this.onScreen()) audio.sfx(this.s.ranged ? 'swing' : 'stab', { pitch: this.s.ranged ? 1.6 : 1.2 });
    } else this.play('idle');
  }

  engageStaged(h) {
    if (!this.staged) return;
    const id = this.staged.id;
    this.staged = null;
    this.spawn = { x: this.x, y: this.y }; // home is the fight, not where we first stood
    this.aggroOn(h);
    this.scene.quests?.engageStaged(id, h);
  }

  stepTo(p, dt, mul) {
    let [nx, ny] = norm(p.x - this.x, p.y - this.y);
    // simple obstacle avoidance: if blocked, use a path
    if (!this.scene.nav.lineClear(this.x, this.y, p.x, p.y, 3)) {
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
    this.moveBy(nx * sp * dt, ny * sp * dt);
    this.play('walk');
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
      const h = sc.nearestHero(this, this.s.aggro);
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
    if (!t?.alive || t.downed || t.invuln > 0 || Math.hypot(t.x - this.x, t.y - this.y) > this.s.reach + 20) { sc.floatText(this.x, this.y - 24, 'MISS', 'fontPlain'); return; }
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
export class Breakable extends Unit {
  constructor(scene, def) {
    const x = def.x * 16 + 8, y = def.y * 16 + 8;
    super(scene, x, y, { key: def.kind === 'boulder' ? 'boulder_cracked' : 'wall_cracked', maxHp: def.hp, team: 'enemy', r: def.kind === 'boulder' ? 14 : 8, shadow: 'shadowL' });
    this.def = def;
    this.kind = 'breakable';
    this.engaged = false;
    this.sprite.setOrigin(0.5, 1).setPosition(x, y + 8).setDepth(y + 4);
    this.shadow.setVisible(def.kind === 'boulder').setAlpha(0.25);
  }
  damage(amount, src) {
    if (!this.alive) return 0;
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
