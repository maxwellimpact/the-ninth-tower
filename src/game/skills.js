// Skill engine: what each active skill does (cast), and when an AI companion
// should use it (ai). Numbers scale with rank via `m` (rank multiplier).
// Passives are looked up with hero.passive(id) -> rank (0 when not equipped).
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';
import { Gadget } from './units.js'; // Gizmo's machines (used only inside casts, so the cycle is safe)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const TOP = 100000;

// Jagged lightning bolt between two points that fades out.
function bolt(sc, x0, y0, x1, y1) {
  const g = sc.add.graphics().setDepth(TOP - 18);
  const pts = [[x0, y0]];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([x0 + (x1 - x0) * k + (Math.random() - 0.5) * 8, y0 + (y1 - y0) * k + (Math.random() - 0.5) * 8]);
  }
  pts.push([x1, y1]);
  const draw = (a) => {
    g.clear().lineStyle(3, 0x6f93e0, 0.5 * a);
    for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    g.lineStyle(1, 0xf6f2ea, a);
    for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  };
  draw(1);
  const st = { a: 1 };
  sc.tweens.add({ targets: st, a: 0, duration: 260, onUpdate: () => draw(st.a), onComplete: () => g.destroy() });
}

const engagedNear = (sc, p, r) => sc.enemies.filter((e) => e.alive && e.engaged && dist(e, p) < r);
const attackers = (sc, h, r = 40) => sc.enemies.filter((e) => e.alive && e.target === h && dist(e, h) < r);
const tough = (e) => e && (e.boss || e.elite || e.maxHp >= 200);
const inDanger = (sc, x, y, pad = 0) => sc.dangers.some((z) => Math.hypot(x - z.x, y - z.y) < z.r + pad);
// the undead and the Hexed: Oake's light hits them harder (and Judgment stuns them)
const UNDEAD = new Set(['drowned', 'hollow', 'shade', 'banshee', 'huntecho', 'wisp']);
const unholy = (e) => e && (UNDEAD.has(e.kind) || e.s?.hexed);
// a heal from Oake: with Optimism, what overflows becomes a shield (up to 15% of max HP)
function healBy(src, t, amt, quiet = false) {
  const room = t.maxHp - t.hp;
  if (quiet && amt > room && room <= 0 && !src.passive?.('optimism')) return;
  t.heal(amt);
  const over = amt - room;
  if (over > 0 && src.passive?.('optimism')) {
    const cap = Math.round(t.maxHp * (src.hasPerk?.('cheer') ? 0.3 : 0.15)); // Mitre of Good Cheer
    t.shield = Math.min(cap, (t.shield || 0) + over); t.shieldT = Math.max(t.shieldT || 0, 6);
  }
}

export const SKILL_FX = {
  // ----------------------------------------------------------------- Brann
  bash: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const [nx, ny] = target ? norm(target.x - h.x, target.y - h.y) : h.facingVec();
      h.face(nx, ny);
      audio.sfx('dash');
      h.act('bash', 0.3, 'attack', {
        hitAt: 0.16,
        tick: (a, dt) => { if (a.t < 0.16) h.moveBy(nx * 170 * dt, ny * 170 * dt); },
        resolve: () => {
          const fx = h.x + nx * 14, fy = h.y + ny * 14;
          sc.shake(90, 0.006);
          let hit = false;
          for (const e of sc.enemies) {
            if (!e.alive || Math.hypot(e.x - fx, e.y - fy) > 24) continue;
            sc.dealDamage(h, e, h.stats.atk * 1.4 * m, { knock: 160 });
            e.stun?.(1.0 + 0.1 * (m - 1) / 0.15);
            hit = true;
          }
          if (hit) audio.sfx('bash');
          if (h.hasPerk('emberbrand')) { // Emberbrand: the bash sets the ground alight
            const g = sc.add.ellipse(fx, fy, 52, 30, 0xff7b2e, 0.3).setDepth(-25);
            sc.fx.burst('ember', fx, fy - 4, 12);
            sc.tweens.add({ targets: g, alpha: 0, duration: 3000, onComplete: () => g.destroy() });
            sc.time.addEvent({ delay: 500, repeat: 5, callback: () => { for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - fx, e.y - fy) < 26 + e.r) { sc.dealDamage(h, e, h.stats.atk * 0.2 * m, { knock: 0, element: 'fire' }); } } });
          }
        },
      });
      return true;
    },
    ai(h, c) { return c.target && dist(c.target, h) < 30 && c.target.kind !== 'ward' ? c.target : null; },
  },
  taunt: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('taunt', 0.4, 'cast');
      h.taunting = 4 * Math.min(1.5, m);
      sc.taunt(h, 110, 4);
      audio.sfx('aggro'); audio.sfx('bash');
      sc.fx.ring(h.x, h.y - 4, 'ringRed', 6);
      sc.floatText(h.x, h.y - 30, 'TAUNT!', 'fontGold');
      return true;
    },
    ai(h, c) { return c.engaged.filter((e) => e.target && e.target !== h && dist(e, h) < 100).length >= 2 ? true : null; },
  },
  charge: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 125) return false;
      const [nx, ny] = norm(target.x - h.x, target.y - h.y);
      h.face(nx, ny);
      audio.sfx('dash');
      const hitSet = new Set();
      h.invuln = Math.max(h.invuln, 0.3);
      h.act('charge', 0.42, 'attack', {
        tick: (a, dt) => {
          if (a.t > 0.36 || dist(h, target) < target.r + 10) return;
          h.moveBy(nx * 300 * dt, ny * 300 * dt);
          sc.fx.ghost(h);
          for (const e of sc.enemies) {
            if (!e.alive || hitSet.has(e) || dist(e, h) > e.r + 10) continue;
            hitSet.add(e);
            sc.dealDamage(h, e, h.stats.atk * 1.3 * m, { knock: 140 });
            if (e === target) e.stun?.(0.6);
          }
        },
      });
      return true;
    },
    ai(h, c) {
      const t = c.engaged.filter((e) => e.target && e.target !== h).sort((a, b) => dist(a, h) - dist(b, h))[0] || c.target;
      return t && dist(t, h) > 45 && dist(t, h) < 120 && t.kind !== 'ward' ? t : null;
    },
  },
  shieldwall: {
    cast(h, { m }) {
      h.act('shieldwall', 0.3, 'cast');
      h.wallT = 3 * Math.min(1.6, m);
      audio.sfx('block');
      h.scene.fx.ring(h.x, h.y - 6, 'ringBlue', 3);
      h.scene.floatText(h.x, h.y - 30, 'SHIELD WALL', 'fontGold');
      return true;
    },
    ai(h, c) { return attackers(h.scene, h, 50).length >= 2 || h.hp / h.maxHp < 0.45 || h.scene.enemies.some((e) => e.alive && e.s.ranged && e.state === 'windup' && e.target === h) ? true : null; },
  },
  rally: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('rally', 0.5, 'cast');
      audio.sfx('levelUp');
      sc.fx.ring(h.x, h.y - 6, 'ringGold', 7);
      for (const p of sc.party) {
        if (p.downed || dist(p, h) > 160) continue;
        p.buff('def', 1.25 * Math.min(1.3, m), 6);
        const amt = Math.round(p.maxHp * 0.1 * m);
        p.heal(amt);
      }
      sc.floatText(h.x, h.y - 30, 'RALLY!', 'fontGold');
      return true;
    },
    ai(h, c) { const hurt = h.scene.party.filter((p) => !p.downed && p.hp / p.maxHp < 0.7).length; return c.engaged.length >= 2 && hurt >= 2 ? true : null; },
  },
  earthsplitter: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const [nx, ny] = target ? norm(target.x - h.x, target.y - h.y) : h.facingVec();
      h.face(nx, ny);
      h.act('earthsplitter', 0.55, 'attack');
      [18, 36, 54, 72].forEach((d, i) => sc.time.delayedCall(90 + i * 90, () => {
        const x = h.x + nx * d, y = h.y + ny * d;
        sc.fx.slam(x, y, 16); sc.shake(60, 0.004); audio.sfx('bash', { pitch: 0.7 });
        for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < 18 + e.r) { sc.dealDamage(h, e, h.stats.atk * 1.2 * m, { knock: 80 }); if (!e.boss) e.stun?.(0.6); }
      }));
      return true;
    },
    ai(h, c) {
      const t = c.target;
      if (!t || dist(t, h) > 70) return null;
      const [nx, ny] = norm(t.x - h.x, t.y - h.y);
      const inLine = c.engaged.filter((e) => { const dx = e.x - h.x, dy = e.y - h.y; const along = dx * nx + dy * ny; return along > 0 && along < 80 && Math.abs(dx * ny - dy * nx) < 18; });
      return inLine.length >= 2 || tough(t) ? t : null;
    },
  },

  // ------------------------------------------------------------------- Pip
  fireball: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      h.face(target.x - h.x, target.y - h.y);
      audio.sfx('fireCast');
      h.act('fireball', 0.4, 'cast', {
        hitAt: 0.2,
        resolve: () => {
          const [nx, ny] = norm(target.x - h.x, target.y - (h.y - 6));
          sc.spawnProjectile({ owner: h, x: h.x + nx * 10, y: h.y - 8, vx: nx * 160, vy: ny * 160, dmg: h.stats.atk * 1.5 * m, kind: 'fireball', aoe: 24, target, element: 'fire', spell: true });
          h.maybeEcho(target, h.stats.atk * 0.8, 'fireball');
        },
      });
      return true;
    },
    ai(h, c) {
      const t = c.target;
      if (!t || dist(t, h) > 115) return null;
      return c.engaged.filter((e) => dist(e, t) < 30).length >= 2 || t.maxHp >= 60 ? t : null;
    },
  },
  frostnova: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('frostnova', 0.35, 'cast');
      audio.sfx('frost');
      sc.fx.ring(h.x, h.y - 4, 'ringBlue', 6);
      sc.fx.burst('foam', h.x, h.y - 6, 24);
      for (const e of sc.enemies) {
        if (!e.alive || dist(e, h) > 46 + e.r) continue;
        sc.dealDamage(h, e, h.stats.atk * 0.9 * m, { knock: 90, element: 'frost', spell: true });
        e.applyElement?.('frost', h); // second stack
      }
      return true;
    },
    ai(h, c) { return engagedNear(h.scene, h, 40).length >= 1 ? true : null; },
  },
  chain: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 125) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('chain', 0.35, 'cast', {
        hitAt: 0.12,
        resolve: () => {
          audio.sfx('zap');
          const hit = new Set();
          let from = { x: h.x, y: h.y - 10 }, cur = target, dmg = h.stats.atk * 1.2 * m;
          for (let i = 0; i < 4 && cur; i++) {
            hit.add(cur);
            bolt(sc, from.x, from.y, cur.x, cur.y - 8);
            sc.dealDamage(h, cur, dmg, { knock: 20, element: 'storm', spell: true });
            from = { x: cur.x, y: cur.y - 8 };
            dmg *= 0.7;
            const prev = cur;
            cur = sc.enemies.filter((e) => e.alive && !hit.has(e) && dist(e, prev) < 70).sort((a, b) => dist(a, prev) - dist(b, prev))[0];
          }
        },
      });
      return true;
    },
    ai(h, c) { return c.target && dist(c.target, h) < 115 && c.engaged.length >= 2 ? c.target : null; },
  },
  blink: {
    cast(h, { m }) {
      const sc = h.scene;
      const threats = sc.enemies.filter((e) => sc.fairTarget(e) && dist(e, h) < 90);
      let [nx, ny] = threats.length ? norm(h.x - threats.reduce((a, e) => a + e.x, 0) / threats.length, h.y - threats.reduce((a, e) => a + e.y, 0) / threats.length) : h.facingVec();
      let tx = h.x, ty = h.y;
      for (let d = 80; d > 16; d -= 8) { const x = h.x + nx * d, y = h.y + ny * d; if (!sc.nav.solidAtPx(x, y)) { tx = x; ty = y; break; } }
      const decoy = { x: h.x, y: h.y, r: 5, alive: true, downed: false, team: 'party', decoy: true };
      const img = sc.add.sprite(h.x, h.y, h.texKey, h.sprite.frame.name).setOrigin(0.5, 0.75).setDepth(h.y).setTint(0xd28cff).setAlpha(0.7);
      for (const e of threats) e.setTaunt(decoy, 2 * Math.min(1.5, m));
      sc.time.delayedCall(2000 * Math.min(1.5, m), () => { decoy.alive = false; sc.fx.puff(decoy.x, decoy.y, 'sparkCurse'); img.destroy(); });
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      h.x = tx; h.y = ty; h.clearPath();
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      audio.sfx('warp');
      return true;
    },
    ai(h) { return attackers(h.scene, h, 30).length >= 1 && h.hp / h.maxHp < 0.6 ? true : null; },
  },
  barrage: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const pool = sc.enemies.filter((e) => sc.fairTarget(e) && dist(e, h) < 130);
      if (!pool.length) return false;
      h.act('barrage', 0.6, 'cast');
      for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 80, () => {
        const live = pool.filter((e) => e.alive);
        if (!live.length || h.downed) return;
        const t = i === 0 && target?.alive ? target : live[i % live.length];
        const a = -Math.PI / 2 + (i - 2.5) * 0.45;
        sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: h.stats.atk * 0.5 * m, kind: 'missile', target: t, spell: true, life: 1.6 });
        audio.sfx('frost', { pitch: 1.3 });
      });
      return true;
    },
    ai(h, c) { return c.engaged.length >= 3 || (c.target && c.target.boss) ? c.target || true : null; },
  },
  surge: {
    cast(h, { m }) {
      h.act('surge', 0.4, 'cast');
      h.surgeT = 6 * Math.min(1.5, m);
      audio.sfx('ult');
      h.scene.fx.ring(h.x, h.y - 6, 'ringGold', 4);
      h.scene.floatText(h.x, h.y - 30, 'SURGE!', 'fontGold');
      return true;
    },
    ai(h, c) { return c.engaged.length >= 3 || (c.target && c.target.boss) ? true : null; },
  },

  // ----------------------------------------------------------------- Sable
  // Sable melts into shadow, a dark streak crosses to the foe, she rises behind
  // it and backstabs (a sure crit). Paced (~0.5 s) so it reads on a phone;
  // untouchable while she's out of sight. Same damage as before: one crit hit.
  step: {
    cast(h, { target }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 85) return false;
      const [nx, ny] = norm(target.x - h.x, target.y - h.y);
      let bx = target.x + nx * 8, by = target.y + ny * 8;
      if (sc.nav.solidAtPx(bx, by)) { bx = target.x - nx * 8; by = target.y - ny * 8; }
      const ox = h.x, oy = h.y, lift = h.sprite.y - h.y;
      const VANISH = 0.12, ARRIVE = 0.26, SHOWN = 0.34, STAB = 0.34;
      h.clearPath();
      h.face(nx, ny);
      h.invuln = Math.max(h.invuln, SHOWN);
      sc.fx.puff(ox, oy, 'sparkCurse');
      audio.sfx('dash', { pitch: 0.7 });
      const steps = { moved: false, puffed: false, stabbed: false };
      h.act('step', 0.48, 'cast', {
        tick: (a) => {
          if (a.t < VANISH) h.sprite.setAlpha(1 - a.t / VANISH);
          else if (!steps.moved) {
            steps.moved = true;
            // the streak: dark silhouettes from where she stood to behind the foe, in order
            // (faint where she left, solid where she's going; the tail clears first)
            for (let k = 1; k <= 5; k++) sc.fx.ghost(h, { x: ox + (bx - ox) * (k / 6), y: oy + (by - oy) * (k / 6) + lift, tint: 0x2a1840, alpha: 0.3 + 0.1 * k, dur: 180 + 40 * k });
            h.x = bx; h.y = by;
            h.face(target.x - h.x, target.y - h.y);
            h.sprite.setAlpha(0);
          }
          if (a.t >= ARRIVE - 0.04 && !steps.puffed) { steps.puffed = true; sc.fx.puff(bx, by, 'sparkCurse'); audio.sfx('dash', { pitch: 1.3 }); }
          if (a.t >= ARRIVE) h.sprite.setAlpha(Math.min(1, (a.t - ARRIVE) / (SHOWN - ARRIVE)));
          if (a.t >= STAB && !steps.stabbed) {
            steps.stabbed = true;
            h.play('attack');
            if (target.alive && !target.submerged) {
              h.nextCrit = true;
              h.resolveAttack(target);
              h.nextCrit = false;
              sc.fx.ring(target.x, target.y - 4, 'ringGold', 2.5);
              sc.floatText(target.x, target.y - 34, 'BACKSTAB!', 'fontGold');
              audio.sfx('stab', { pitch: 0.8 });
            }
            h.atkT = 0; // her blades keep going straight after (the old instant step's pace, so her damage holds)
          }
        },
      });
      // never leave her see-through if the step is cut short (downed, knocked away)
      sc.time.delayedCall(800, () => { if (h.action?.id !== 'step' && h.sprite?.active) h.sprite.setAlpha(1); });
      if (h.isLeader) h.command = { type: 'attack', target }; else h.target = target;
      return true;
    },
    ai(h, c) {
      // short hops back into the leader's fight, not cross-screen blinks, and
      // never into an attack that's about to land
      const t = c.target;
      if (!t || dist(t, h) <= 36 || dist(t, h) >= 75 || dist(t, h.scene.leader) >= 60 || t.kind === 'ward') return null;
      return inDanger(h.scene, t.x, t.y, 14) ? null : t;
    },
  },
  fan: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('fan', 0.3, 'cast');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 8, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, dmg: h.stats.atk * 1.2 * m, kind: 'knife', life: 0.32 });
      }
      audio.sfx('stab'); sc.time.delayedCall(40, () => audio.sfx('stab')); sc.time.delayedCall(80, () => audio.sfx('swing', { pitch: 1.4 }));
      return true;
    },
    ai(h, c) { return engagedNear(h.scene, h, 38).length >= 2 || (tough(c.target) && dist(c.target, h) < 34) ? true : null; }, // a crowd, or point-blank on a boss / elite
  },
  envenom: {
    cast(h, { m }) {
      h.act('envenom', 0.3, 'cast');
      h.envenom = Math.round(6 * m);
      audio.sfx('squish');
      h.scene.fx.burst('heal', h.x, h.y - 10, 12);
      h.scene.floatText(h.x, h.y - 30, 'ENVENOM', 'fontPlain', 0xa6ff7a);
      return true;
    },
    ai(h, c) { return !h.envenom && c.target && c.engaged.length >= 1 && (c.engaged.length >= 2 || tough(c.target)) ? true : null; },
  },
  smoke: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('smoke', 0.25, 'cast');
      sc.addSmoke(h.x, h.y, 42, 4 * Math.min(1.5, m));
      h.hiddenT = 2;
      for (const e of sc.enemies) if (e.target === h) { e.target = null; e.tauntT = 0; }
      audio.sfx('dodge');
      return true;
    },
    ai(h) { const n = attackers(h.scene, h, 45).length; return n >= 3 || (n >= 1 && h.hp / h.maxHp < 0.4) ? true : null; },
  },
  riposte: {
    cast(h, { m }) {
      h.act('riposte', 0.6, 'idle');
      h.riposteT = 0.6 * Math.min(1.4, m);
      h.riposteMul = m;
      h.scene.fx.ring(h.x, h.y - 6, 'ringWhite', 1.6);
      audio.sfx('block');
      return true;
    },
    ai(h) { return h.scene.enemies.some((e) => e.alive && e.state === 'windup' && e.target === h && !e.s.ranged && dist(e, h) < 40) ? true : null; },
  },
  deathmark: {
    cast(h, { target, m, sk }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 125 || !target.alive || target.kind === 'ward') return false;
      h.act('deathmark', 0.3, 'cast');
      target.marked = { t: 8, by: h, sk, mul: 1.25 + (m - 1) * 0.3 };
      sc.fx.puff(target.x, target.y - 10, 'sparkCurse');
      sc.floatText(target.x, target.y - 34, 'MARKED', 'fontPlain', 0xff6a6a);
      audio.sfx('aggro');
      return true;
    },
    ai(h, c) { return c.target && !c.target.marked && (tough(c.target) || c.engaged.length >= 3) ? c.target : null; },
  },

  // ------------------------------------------------------------------ Wren
  powershot: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('powershot', 0.45, 'attack', {
        hitAt: 0.25,
        resolve: () => {
          const [nx, ny] = norm(target.x - h.x, target.y - (h.y - 6));
          sc.spawnProjectile({ owner: h, x: h.x + nx * 8, y: h.y - 8, vx: nx * 300, vy: ny * 300, dmg: h.stats.atk * 1.6 * m, kind: 'arrow', pierce: true, life: 0.7 });
          audio.sfx('swing', { pitch: 1.2 }); audio.sfx('dash');
        },
      });
      return true;
    },
    ai(h, c) {
      const t = c.target;
      if (!t || dist(t, h) > 140) return null;
      const [nx, ny] = norm(t.x - h.x, t.y - h.y);
      const inLine = c.engaged.filter((e) => { const dx = e.x - h.x, dy = e.y - h.y; const a = dx * nx + dy * ny; return a > 0 && a < 160 && Math.abs(dx * ny - dy * nx) < 14; });
      return inLine.length >= 2 || tough(t) ? t : null;
    },
  },
  hawkstrike: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      h.act('hawkstrike', 0.3, 'cast');
      const hawk = sc.add.sprite(target.x - 80, target.y - 120, 'hawk', '0').play('hawk').setDepth(TOP - 15);
      audio.sfx('zip');
      sc.tweens.add({ targets: hawk, x: target.x, y: target.y - 10, duration: 380, ease: 'Quad.easeIn', onComplete: () => {
        if (target.alive) {
          sc.dealDamage(h, target, h.stats.atk * 1.0 * m, { knock: 30 });
          target.hawkMarked = { t: 6 };
          if (target.submerged) target.submerge?.(false);
          sc.floatText(target.x, target.y - 34, 'MARKED', 'fontPlain', 0xffd04a);
        }
        sc.tweens.add({ targets: hawk, x: target.x + 90, y: target.y - 130, alpha: 0, duration: 500, onComplete: () => hawk.destroy() });
      } });
      return true;
    },
    ai(h, c) { return c.target && !c.target.hawkMarked && dist(c.target, h) < 150 && (tough(c.target) || c.engaged.length >= 2) ? c.target : null; },
  },
  volley: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      const cx = target.x, cy = target.y;
      h.face(cx - h.x, cy - h.y);
      h.act('volley', 0.5, 'attack');
      const g = sc.fx.telegraph(cx, cy, 30, 0.3); sc.time.delayedCall(300, () => g.destroy());
      (sc.partyZones ??= []).push({ x: cx, y: cy, r: 30, until: sc.time.now + 2100 }); // elites read the volley and step out
      for (let i = 0; i < 10; i++) sc.time.delayedCall(250 + i * 180, () => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 28;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7;
        const ar = sc.add.image(x - 10, y - 60, 'arrow').setRotation(1.4).setDepth(TOP - 20);
        sc.tweens.add({ targets: ar, x, y: y - 4, duration: 160, onComplete: () => {
          ar.destroy(); sc.fx.burst('spark', x, y, 3);
          for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - x, e.y - y) < 14 + e.r) sc.dealDamage(h, e, h.stats.atk * 0.3 * m, { knock: 10 });
        } });
      });
      audio.sfx('swing', { pitch: 1.6 });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(t, h) < 130 && c.engaged.filter((e) => dist(e, t) < 32).length >= 2 ? t : null; },
  },
  snare: {
    cast(h, { m }) {
      const sc = h.scene;
      const [fx, fy] = h.facingVec();
      const x = h.x + fx * 18, y = h.y + fy * 14;
      h.act('snare', 0.3, 'cast');
      const img = sc.add.image(x, y, 'snare').setDepth(y - 4);
      const trap = { x, y, img, t: 20 };
      const check = sc.time.addEvent({ delay: 100, loop: true, callback: () => {
        trap.t -= 0.1;
        const e = sc.enemies.find((k) => k.alive && !k.boss && Math.hypot(k.x - x, k.y - y) < 12 + k.r);
        if (e || trap.t <= 0) {
          check.remove(); img.destroy();
          if (e) { e.stunT = Math.max(e.stunT, 3 * Math.min(1.5, m)); e.clearZone(); sc.floatText(e.x, e.y - 26, 'SNARED!', 'fontGold'); audio.sfx('block'); sc.dealDamage(h, e, h.stats.atk * 0.8 * m, { knock: 0 }); }
        }
      } });
      audio.sfx('equip');
      return true;
    },
    ai(h) { return attackers(h.scene, h, 50).length >= 1 ? true : null; },
  },
  disengage: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const from = target || sc.nearestEnemy(h, 80);
      const [nx, ny] = from ? norm(h.x - from.x, h.y - from.y) : h.facingVec().map((v) => -v);
      h.invuln = Math.max(h.invuln, 0.35);
      h.act('disengage', 0.35, 'dodge', { tick: (a, dt) => { if (a.t < 0.25) h.moveBy(nx * 240 * dt, ny * 240 * dt); } });
      if (from) sc.time.delayedCall(260, () => { if (!from.alive) return; const [ax, ay] = norm(from.x - h.x, from.y - (h.y - 6)); sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 8, vx: ax * 280, vy: ay * 280, dmg: h.stats.atk * 1.2 * m, kind: 'arrow', element: 'frost' }); });
      audio.sfx('dodge');
      return true;
    },
    ai(h) { return attackers(h.scene, h, 26).length >= 1 && h.hp / h.maxHp < 0.6 ? true : null; },
  },
  blastarrow: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('blastarrow', 0.45, 'attack', {
        hitAt: 0.25,
        resolve: () => {
          const [nx, ny] = norm(target.x - h.x, target.y - (h.y - 6));
          sc.spawnProjectile({ owner: h, x: h.x + nx * 8, y: h.y - 8, vx: nx * 240, vy: ny * 240, dmg: h.stats.atk * 1.7 * m, kind: 'fireball', aoe: 28, target, element: 'fire' });
          audio.sfx('fireCast');
        },
      });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(t, h) < 140 && (c.engaged.filter((e) => dist(e, t) < 30).length >= 2 || tough(t)) ? t : null; },
  },

  // ------------------------------------------------------------------ Kesh
  cleave: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const [nx, ny] = target ? norm(target.x - h.x, target.y - h.y) : h.facingVec();
      h.face(nx, ny);
      h.act('cleave', 0.32, 'attack', {
        hitAt: 0.12,
        resolve: () => {
          audio.sfx('swing', { pitch: 0.7 });
          for (const e of sc.enemies) {
            if (!e.alive || e.submerged) continue;
            const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy);
            if (d < 34 + e.r && (dx * nx + dy * ny) / (d || 1) > 0.2) sc.dealDamage(h, e, h.stats.atk * 1.3 * m, { knock: 90 });
          }
        },
      });
      return true;
    },
    ai(h, c) { return engagedNear(h.scene, h, 36).length >= 2 || (c.target && dist(c.target, h) < 30) ? c.target || true : null; },
  },
  leap: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 125) return false;
      const ox = h.x, oy = h.y, tx = target.x - (target.x - h.x) * 0.15, ty = target.y + 6;
      h.invuln = Math.max(h.invuln, 0.5);
      h.zipping = true;
      h.act('leap', 0.55, 'dodge');
      audio.sfx('dash');
      sc.tweens.addCounter({ from: 0, to: 1, duration: 420, ease: 'Sine.easeInOut', onUpdate: (tw) => {
        const k = tw.getValue();
        h.x = ox + (tx - ox) * k; h.y = oy + (ty - oy) * k - Math.sin(k * Math.PI) * 26;
      }, onComplete: () => {
        h.zipping = false;
        sc.fx.slam(h.x, h.y, 30); sc.shake(140, 0.008); audio.sfx('bash');
        for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - h.x, e.y - h.y) < 32 + e.r) { sc.dealDamage(h, e, h.stats.atk * 1.5 * m, { knock: 120 }); if (!e.boss) e.stun?.(0.5); }
        if (h.hasPerk('gnasher')) { // Gnasher: the landing leaves a burning crater
          const cx = h.x, cy = h.y, g = sc.add.ellipse(cx, cy, 60, 36, 0xff7b2e, 0.3).setDepth(-25);
          sc.tweens.add({ targets: g, alpha: 0, duration: 3000, onComplete: () => g.destroy() });
          sc.time.addEvent({ delay: 500, repeat: 5, callback: () => { for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - cx, e.y - cy) < 30 + e.r) { sc.dealDamage(h, e, h.stats.atk * 0.25 * m, { knock: 0, element: 'fire' }); e.applyElement?.('fire', h); } } });
        }
        if (h.isLeader) h.command = { type: 'attack', target }; else h.target = target;
      } });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(t, h) > 45 && dist(t, h) < 120 && t.kind !== 'ward' ? t : null; },
  },
  howl: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('howl', 0.5, 'cast');
      audio.sfx('roar');
      sc.fx.ring(h.x, h.y - 6, 'ringRed', 5);
      for (const e of sc.enemies) if (e.alive && !e.boss && dist(e, h) < 80) { e.fearT = 2 * Math.min(1.5, m); e.fearFrom = { x: h.x, y: h.y }; e.clearZone(); e.state = 'chase'; }
      sc.floatText(h.x, h.y - 30, 'HOWL!', 'fontGold');
      if (h.hasPerk('wolfskull')) for (const p of sc.party) if (!p.downed && dist(p, h) < 160) { p.buff('might', 1.15, 6); sc.fx.burst('ember', p.x, p.y - 12, 4); } // Wolfskull Helm
      return true;
    },
    ai(h) { return attackers(h.scene, h, 45).length >= 3 || (attackers(h.scene, h, 40).length >= 1 && h.hp / h.maxHp < 0.35) ? true : null; },
  },
  frenzy: {
    cast(h, { m }) {
      h.act('frenzy', 0.3, 'cast');
      h.hp = Math.max(1, h.hp - Math.round(h.maxHp * 0.1));
      h.buff('atkspd', 1.4 + (m - 1) * 0.5, 6);
      h.scene.fx.ring(h.x, h.y - 6, 'ringRed', 3);
      h.scene.floatText(h.x, h.y - 30, 'FRENZY!', 'fontGold');
      audio.sfx('aggro');
      return true;
    },
    ai(h, c) { return c.target && dist(c.target, h) < 40 && h.hp / h.maxHp > 0.4 && (c.engaged.length >= 2 || tough(c.target)) ? true : null; },
  },
  rend: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 50) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('rend', 0.3, 'attack', {
        hitAt: 0.12,
        resolve: () => {
          if (!target.alive) return;
          sc.dealDamage(h, target, h.stats.atk * 1.2 * m, { knock: 20 });
          target.addBleed?.(h.stats.atk * 0.18 * m, 5);
          if (h.hasPerk('bloodfang')) target.addBleed?.(h.stats.atk * 0.18 * m, 5); // Bloodfang: stacks twice as fast
          audio.sfx('stab');
        },
      });
      return true;
    },
    ai(h, c) { return c.target && dist(c.target, h) < 34 && tough(c.target) ? c.target : null; },
  },
  whirlwind: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('whirlwind', 3, 'attack', {
        tick: (a, dt) => {
          h.spinT = (h.spinT || 0) - dt;
          h.sprite.setFlipX(Math.floor(a.t * 12) % 2 === 0);
          if (h.spinT <= 0) {
            h.spinT = 0.25;
            sc.fx.ring(h.x, h.y - 6, 'ringWhite', 2.2);
            audio.sfx('swing', { pitch: 0.9 + Math.random() * 0.3 });
            for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - h.x, e.y - h.y) < 30 + e.r) sc.dealDamage(h, e, h.stats.atk * 0.45 * m, { knock: 40 });
          }
          // the leader can steer the spin
          if (h.isLeader && h.path) h.followPath(dt, 0.6);
        },
      });
      return true;
    },
    ai(h) { return engagedNear(h.scene, h, 40).length >= 3 ? true : null; },
  },

  // -------------------------------------------------------- disciplines
  mend: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('mend', 0.5, 'cast');
      audio.sfx('heal');
      for (const p of sc.party) {
        if (!p.alive || dist(p, h) > 140) continue;
        if (p.downed) p.revive(0.35);
        p.heal(Math.round(p.maxHp * 0.35 * m));
      }
      return true;
    },
    ai(h) { return h.scene.party.some((p) => p.downed || (p.alive && p.hp / p.maxHp < 0.5)) ? true : null; },
  },

  clericward: {
    cast(h, { m }) {
      const sc = h.scene;
      const t = sc.party.filter((p) => p.alive && !p.downed && dist(p, h) < 160).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!t) return false;
      h.act('clericward', 0.4, 'cast');
      t.shield = Math.max(t.shield || 0, Math.round(t.maxHp * 0.25 * m)); t.shieldT = 6;
      sc.fx.ring(t.x, t.y - 6, 'ringGold', 2.4);
      sc.floatText(t.x, t.y - 32, 'WARDED', 'fontPlain', 0xfff0a0);
      audio.sfx('heal', { pitch: 1.3 });
      return true;
    },
    ai(h) { return h.scene.party.some((p) => p.alive && !p.downed && p.hp / p.maxHp < 0.6 && !(p.shield > 0)) ? true : null; },
  },

  // ------------------------------------------------------- Brother Oake
  oheal: {
    cast(h, { m }) {
      const sc = h.scene;
      const t = sc.party.filter((p) => p.alive && !p.downed && dist(p, h) < 170).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!t) return false;
      h.act('oheal', 0.45, 'cast');
      healBy(h, t, Math.round(t.maxHp * 0.45 * m));
      sc.fx.ring(t.x, t.y - 6, 'ringGold', 2.2);
      audio.sfx('heal');
      return true;
    },
    ai(h) { return h.scene.party.some((p) => p.alive && !p.downed && p.hp / p.maxHp < 0.55) ? true : null; },
  },
  smite: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 130) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('smite', 0.4, 'cast', {
        hitAt: 0.2,
        resolve: () => {
          if (!target.alive) return;
          const g = sc.add.rectangle(target.x, target.y - 30, 6, 60, 0xfff0a0, 0.8).setDepth(target.y + 10).setBlendMode(Phaser.BlendModes.ADD);
          sc.tweens.add({ targets: g, alpha: 0, scaleX: 3, duration: 300, onComplete: () => g.destroy() });
          sc.dealDamage(h, target, h.stats.atk * 1.5 * m * (unholy(target) ? 1.5 : 1), { knock: 20, element: 'light', spell: true });
          audio.sfx('frost', { pitch: 1.8 });
          if (h.hasPerk('dawnhammer')) { // Dawnhammer: the light jumps to two more
            let from = target; const hit = new Set([target]);
            for (let i = 0; i < 2; i++) {
              const nx = sc.enemies.filter((e) => e.alive && !hit.has(e) && sc.fairTarget(e) && dist(e, from) < 70).sort((a, b) => dist(a, from) - dist(b, from))[0];
              if (!nx) break;
              hit.add(nx);
              const f = from;
              sc.time.delayedCall(90 * (i + 1), () => {
                if (!nx.alive) return;
                const ln = sc.add.line(0, 0, f.x, f.y - 14, nx.x, nx.y - 14, 0xfff0a0, 0.9).setOrigin(0).setLineWidth(2).setDepth(nx.y + 10).setBlendMode(Phaser.BlendModes.ADD);
                sc.tweens.add({ targets: ln, alpha: 0, duration: 250, onComplete: () => ln.destroy() });
                sc.dealDamage(h, nx, h.stats.atk * 0.9 * m * (unholy(nx) ? 1.5 : 1), { knock: 10, element: 'light', spell: true });
              });
              from = nx;
            }
          }
        },
      });
      return true;
    },
    ai(h, c) { return c.target && dist(h, c.target) < 120 ? c.target : null; },
  },
  sanctuary: {
    cast(h, { m }) {
      const sc = h.scene, follow = h.hasPerk('faithful'); // Lantern of the Faithful: the circle walks with Oake
      let x = h.x, y = h.y;
      h.act('sanctuary', 0.5, 'cast');
      const g = sc.add.ellipse(x, y, 84, 52, 0xfff0a0, 0.18).setStrokeStyle(1, 0xfff0a0, 0.8).setDepth(-25);
      if (follow) { const mv = () => { if (!g.active) return; if (!h.downed) { x = h.x; y = h.y; g.setPosition(x, y); } }; sc.events.on('update', mv); g.once('destroy', () => sc.events.off('update', mv)); }
      sc.time.addEvent({ delay: 500, repeat: 11, callback: () => { for (const p of sc.party) if (p.alive && !p.downed && Math.hypot(p.x - x, (p.y - y) * 1.6) < 42) healBy(h, p, Math.round(p.maxHp * 0.035 * m), true); } });
      sc.tweens.add({ targets: g, alpha: 0, duration: 6000, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
      audio.sfx('heal', { pitch: 0.8 });
      return true;
    },
    ai(h) { return h.scene.party.filter((p) => p.alive && !p.downed && p.hp / p.maxHp < 0.75 && dist(p, h) < 50).length >= 2 ? true : null; },
  },
  purify: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('purify', 0.4, 'cast');
      for (const p of sc.party) {
        if (!p.alive || p.downed) continue;
        p.poison = null; p.status && (p.status = null); delete p.buffs.slow;
        p.purifyT = 3 * Math.min(1.5, m);
        p.sprite.clearTint(); sc.fx.heal(p.x, p.y);
      }
      sc.floatText(h.x, h.y - 30, 'PURIFIED', 'fontPlain', 0xfff0a0);
      audio.sfx('heal', { pitch: 1.4 });
      return true;
    },
    ai(h) { return h.scene.party.some((p) => p.alive && !p.downed && (p.poison || p.buffs.slow)) ? true : null; },
  },
  halo: {
    cast(h, { m }) {
      const sc = h.scene;
      const t = sc.party.filter((p) => p.alive && !p.downed && dist(p, h) < 170).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!t) return false;
      h.act('halo', 0.35, 'cast');
      t.shield = Math.max(t.shield || 0, Math.round(t.maxHp * 0.2 * m)); t.shieldT = 6;
      sc.fx.ring(t.x, t.y - 20, 'ringGold', 1.4);
      sc.floatText(t.x, t.y - 32, 'HALO', 'fontPlain', 0xfff0a0);
      audio.sfx('heal', { pitch: 1.6 });
      return true;
    },
    ai(h) { return h.scene.party.some((p) => p.alive && !p.downed && p.hp / p.maxHp < 0.5 && !(p.shield > 0)) ? true : null; },
  },
  judgment: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 130) return false;
      const x = target.x, y = target.y;
      h.act('judgment', 0.6, 'cast');
      const g = sc.add.ellipse(x, y, 60, 36, 0xfff0a0, 0.15).setStrokeStyle(1, 0xfff0a0, 0.9).setDepth(-25);
      sc.time.delayedCall(600, () => {
        g.destroy();
        const p = sc.add.rectangle(x, y - 60, 22, 120, 0xfff6c0, 0.85).setDepth(y + 10).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: p, alpha: 0, duration: 500, onComplete: () => p.destroy() });
        sc.shake(200, 0.008); audio.sfx('bash'); audio.sfx('frost', { pitch: 1.3 });
        for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < 30 + e.r) {
          sc.dealDamage(h, e, h.stats.atk * 2.4 * m * (unholy(e) ? 1.4 : 1), { knock: 40, element: 'light', spell: true });
          if (unholy(e) && !e.boss) e.stun?.(2);
        }
      });
      return true;
    },
    ai(h, c) { const t = c.target; return t && (t.boss || t.elite || engagedNear(h.scene, t, 34).length >= 2) ? t : null; },
  },

  // ------------------------------------------------------------ Gizmo
  turret: {
    cast(h, { m }) {
      const sc = h.scene;
      const max = h.passive('engineering') ? 2 : 1;
      const mine = (sc.gadgets || []).filter((g) => g.kind === 'turret' && g.owner === h);
      if (mine.length >= max) mine[0].expire(); // the oldest goes
      const [fx, fy] = h.facingVec();
      const x = h.x + fx * 14, y = h.y + fy * 10;
      h.act('turret', 0.4, 'cast');
      new Gadget(sc, h, 'turret', sc.nav.solidAtPx(x, y) ? h.x : x, sc.nav.solidAtPx(x, y) ? h.y + 4 : y, m);
      audio.sfx('equip');
      return true;
    },
    ai(h) { return engagedNear(h.scene, h, 110).length >= 1 && !(h.scene.gadgets || []).some((g) => g.kind === 'turret' && g.owner === h && g.life > 3) ? true : null; },
  },
  sparkmine: {
    cast(h, { m }) {
      const sc = h.scene;
      const [fx, fy] = h.facingVec();
      const x = h.x + fx * 16, y = h.y + fy * 12;
      h.act('sparkmine', 0.3, 'cast');
      const img = sc.add.image(x, y, 'snare').setDepth(y - 4).setTint(0x9fd8ff);
      const trap = { t: 20 };
      const check = sc.time.addEvent({ delay: 100, loop: true, callback: () => {
        trap.t -= 0.1;
        const e = sc.enemies.find((k) => k.alive && !k.staged && Math.hypot(k.x - x, k.y - y) < 12 + k.r);
        if (e || trap.t <= 0) {
          check.remove(); img.destroy();
          if (!e) return;
          sc.fx.burst('spark', x, y - 4, 14); audio.sfx('frost', { pitch: 2 });
          for (const k of sc.enemies) if (k.alive && Math.hypot(k.x - x, k.y - y) < 26 + k.r) {
            sc.dealDamage(h, k, h.stats.atk * 0.9 * m, { knock: 0, element: 'storm' });
            k.applyElement?.('storm', h);
            if (!k.boss) k.stun?.(1.5);
          }
        }
      } });
      audio.sfx('equip');
      return true;
    },
    ai(h) { return attackers(h.scene, h, 50).length >= 1 || engagedNear(h.scene, h, 40).length >= 2 ? true : null; },
  },
  repairbot: {
    cast(h, { m }) {
      const sc = h.scene;
      (sc.gadgets || []).filter((g) => g.kind === 'bot' && g.owner === h).forEach((g) => g.expire());
      h.act('repairbot', 0.4, 'cast');
      new Gadget(sc, h, 'bot', h.x + 10, h.y - 4, m);
      audio.sfx('equip', { pitch: 1.3 });
      return true;
    },
    ai(h) { return h.scene.party.filter((p) => p.alive && !p.downed && p.hp / p.maxHp < 0.7).length >= 1 && engagedNear(h.scene, h, 120).length ? true : null; },
  },
  gravity: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const c = target && dist(h, target) < 120 ? { x: target.x, y: target.y } : { x: h.x + h.facingVec()[0] * 50, y: h.y + h.facingVec()[1] * 40 };
      h.act('gravity', 0.45, 'cast');
      const g = sc.add.circle(c.x, c.y - 6, 30, 0x6b3fa0, 0.25).setStrokeStyle(1, 0xd9b8ff, 0.9).setDepth(c.y + 10);
      sc.tweens.add({ targets: g, scale: 0.1, alpha: 0, duration: 600, onComplete: () => g.destroy() });
      for (const e of sc.enemies) {
        if (!e.alive || e.boss || Math.hypot(e.x - c.x, e.y - c.y) > 75) continue;
        const [nx, ny] = norm(c.x - e.x, c.y - e.y), d = Math.hypot(c.x - e.x, c.y - e.y);
        e.knock(nx, ny, Math.min(220, d * 4));
        e.status ??= {}; // a 2s slow that doesn't count toward a frost freeze
        if (!e.status.chill) { e.status.chill = { t: 2, n: 0 }; e.statusTint(); }
      }
      audio.sfx('warp', { pitch: 0.7 });
      sc.dealDamage && sc.time.delayedCall(450, () => { for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - c.x, e.y - c.y) < 26 + e.r) sc.dealDamage(h, e, h.stats.atk * 0.6 * m, { knock: 0 }); });
      return true;
    },
    ai(h, c) { const t = c.target; return t && engagedNear(h.scene, t, 75).length >= 3 ? t : null; },
  },
  rocketboots: {
    cast(h, { m }) {
      const sc = h.scene;
      const threat = sc.enemies.filter((e) => e.alive && e.engaged).sort((a, b) => dist(a, h) - dist(b, h))[0];
      let [nx, ny] = h.direct && (h.direct.x || h.direct.y) ? norm(h.direct.x, h.direct.y) : threat && dist(threat, h) < 50 ? norm(h.x - threat.x, h.y - threat.y) : h.facingVec();
      const ox = h.x, oy = h.y;
      let d = 0;
      for (let k = 8; k <= 80; k += 8) { if (sc.nav.solidAtPx(ox + nx * k, oy + ny * k)) break; d = k; }
      h.act('rocketboots', 0.3, 'dodge');
      h.invuln = Math.max(h.invuln, 0.3);
      audio.sfx('dash'); audio.sfx('fireCast', { pitch: 1.4 });
      sc.tweens.add({ targets: h, x: ox + nx * d, y: oy + ny * d, duration: 260, ease: 'Sine.easeOut' });
      for (let k = 0; k <= d; k += 14) {
        const x = ox + nx * k, y = oy + ny * k;
        const f = sc.add.ellipse(x, y, 16, 10, 0xff7b2e, 0.5).setDepth(-25);
        sc.tweens.add({ targets: f, alpha: 0, duration: 2500, onComplete: () => f.destroy() });
        sc.time.addEvent({ delay: 500, repeat: 4, callback: () => { for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < 10 + e.r) { sc.dealDamage(h, e, h.stats.atk * 0.3 * m, { knock: 0, element: 'fire' }); e.applyElement?.('fire', h); } } });
      }
      return true;
    },
    ai(h) { return attackers(h.scene, h, 30).length >= 2 || (attackers(h.scene, h, 30).length && h.hp / h.maxHp < 0.4) ? true : null; },
  },
  overcharge: {
    cast(h, { m }) {
      const sc = h.scene;
      if (!(sc.gadgets || []).some((g) => g.owner === h)) return false;
      h.act('overcharge', 0.35, 'cast');
      h.overchargeT = 5 * Math.min(1.5, m);
      for (const g of sc.gadgets) if (g.owner === h) sc.fx.ring(g.x, g.y - 6, 'ringBlue', 1.8);
      sc.floatText(h.x, h.y - 30, 'OVERCHARGE!', 'fontGold');
      audio.sfx('frost', { pitch: 2.2 });
      return true;
    },
    ai(h) { return (h.scene.gadgets || []).filter((g) => g.owner === h).length >= 2 && engagedNear(h.scene, h, 110).length >= 2 ? true : null; },
  },

  // ------------------------------------------------ Ranger discipline
  // ------------------------------------------------ Arcane discipline
  arcmissile: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 140) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('arcmissile', 0.4, 'cast');
      for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 110, () => {
        if (h.downed) return;
        const t = target.alive ? target : sc.nearestEnemy(h, 140);
        if (!t) return;
        const a = Math.atan2(t.y - h.y, t.x - h.x) + (i - 1) * 0.6;
        sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 10, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, dmg: h.stats.atk * 0.45 * m, kind: 'missile', target: t, spell: true, life: 1.6 });
        audio.sfx('frost', { pitch: 1.5 });
      });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(h, t) < 130 ? t : null; },
  },
  phasestep: {
    cast(h, { m }) {
      const sc = h.scene;
      const threats = sc.enemies.filter((e) => sc.fairTarget(e) && dist(e, h) < 70);
      const [nx, ny] = threats.length ? norm(h.x - threats.reduce((a, e) => a + e.x, 0) / threats.length, h.y - threats.reduce((a, e) => a + e.y, 0) / threats.length) : h.facingVec();
      let tx = h.x, ty = h.y;
      const a0 = Math.atan2(ny, nx);
      // straight away from danger if there's room, else the nearest heading that has some
      for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const cx = Math.cos(a0 + da), cy = Math.sin(a0 + da);
        for (let d = 72; d > 16; d -= 8) { const x = h.x + cx * d, y = h.y + cy * d; if (!sc.nav.solidAtPx(x, y) && sc.nav.lineClear(h.x, h.y, x, y)) { tx = x; ty = y; break; } }
        if (tx !== h.x || ty !== h.y) break;
      }
      if (tx === h.x && ty === h.y) return false;
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      h.x = tx; h.y = ty; h.clearPath();
      h.invuln = Math.max(h.invuln, 0.4 * Math.min(1.5, m));
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      audio.sfx('warp', { pitch: 1.2 });
      return true;
    },
    ai(h) { return attackers(h.scene, h, 28).length >= 2 || (attackers(h.scene, h, 28).length && h.hp / h.maxHp < 0.5) ? true : null; },
  },

  quickshot: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 150) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('quickshot', 0.28, 'attack', {
        hitAt: 0.12,
        resolve: () => {
          const [nx, ny] = norm(target.x - h.x, target.y - (h.y - 6));
          sc.spawnProjectile({ owner: h, target, x: h.x + nx * 8, y: h.y - 8, vx: nx * 320, vy: ny * 320, dmg: h.stats.atk * 1.0 * m, kind: 'arrow', life: 0.6 });
          audio.sfx('swing', { pitch: 1.5 });
        },
      });
      return true;
    },
    // melee heroes use it on something they can't reach; archers in a gap between shots
    ai(h, c) { const t = c.target; return t && dist(h, t) > (h.ranged ? 0 : 50) && dist(h, t) < 140 ? t : null; },
  },
  tripwire: {
    cast(h, { m }) {
      const sc = h.scene;
      const x = h.x, y = h.y + 2;
      h.act('tripwire', 0.3, 'cast');
      const img = sc.add.image(x, y, 'snare').setDepth(y - 4).setTint(0xc9b46a);
      const trap = { t: 20 };
      const check = sc.time.addEvent({ delay: 100, loop: true, callback: () => {
        trap.t -= 0.1;
        const e = sc.enemies.find((k) => k.alive && !k.boss && !k.staged && Math.hypot(k.x - x, k.y - y) < 12 + k.r);
        if (e || trap.t <= 0) {
          check.remove(); img.destroy();
          if (e) { e.stunT = Math.max(e.stunT, 2 * Math.min(1.5, m)); e.clearZone(); sc.floatText(e.x, e.y - 26, 'SNARED!', 'fontGold'); audio.sfx('block'); }
        }
      } });
      audio.sfx('equip');
      return true;
    },
    ai(h) { return attackers(h.scene, h, 40).length >= 1 ? true : null; },
  },

  // ------------------------------------------------------------- Mirelle
  // Ice Shard: a shard that punches through every foe in a line, Chilling
  // each (the Glacier Wand splits it in three at the first hit)
  iceshard: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 140) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('iceshard', 0.35, 'cast', {
        hitAt: 0.15,
        resolve: () => {
          const [nx, ny] = norm(target.x - h.x, target.y - (h.y - 6));
          sc.spawnProjectile({ owner: h, x: h.x + nx * 10, y: h.y - 8, vx: nx * 230, vy: ny * 230, dmg: h.stats.atk * 1.2 * m, kind: 'iceshard', pierce: true, element: 'frost', spell: true, life: 0.75, split: h.hasPerk('glacier') ? 0 : -1 });
          audio.sfx('frost', { pitch: 1.3 });
        },
      });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(h, t) < 125 ? t : null; },
  },
  // Frost Prison: encases a foe in ice (a boss is only chilled to the bone);
  // with no foe at hand it guards the most hurt ally instead
  frostprison: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const foe = target && target.alive && target.team === 'enemy' && dist(h, target) < 135 ? target : null;
      const ally = !foe && sc.party.filter((p) => !p.downed && p.hp < p.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!foe && !ally) return false;
      const t = foe || ally;
      h.face(t.x - h.x, t.y - h.y);
      h.act('frostprison', 0.4, 'cast');
      audio.sfx('frost', { pitch: 0.7 });
      const ice = sc.add.image(t.x, t.y + 4, 'iceblock').setOrigin(0.5, 1).setDepth(t.y + 3).setAlpha(0.85);
      sc.fx.burst('foam', t.x, t.y - 8, 14);
      const hold = foe ? (foe.boss ? 0 : 3 * Math.min(1.4, m)) : 2;
      if (foe) {
        foe.status ??= {};
        if (foe.boss) { foe.status.chill = { t: 3, n: 2, heavy: true, cold: !!h.passive('coldheart') }; ice.setScale(0.6).setAlpha(0.5); sc.floatText(foe.x, foe.y - 40, 'CHILLED TO THE BONE', 'fontPlain', 0x9fe6ff); }
        else { foe.status.freeze = { t: hold, cold: !!h.passive('coldheart') }; foe.stunT = Math.max(foe.stunT, hold); foe.clearZone(); sc.floatText(foe.x, foe.y - 30, 'ENCASED', 'fontPlain', 0x9fe6ff); }
        foe.statusTint?.();
      } else { ally.invuln = Math.max(ally.invuln, 2); ally.prisonT = 2; sc.floatText(ally.x, ally.y - 30, 'SAFE IN THE ICE', 'fontPlain', 0x9fe6ff); }
      sc.tweens.add({ targets: ice, alpha: 0, delay: Math.max(300, (foe?.boss ? 1 : hold) * 1000 - 300), duration: 300, onComplete: () => ice.destroy() });
      sc.time.addEvent({ delay: 50, repeat: 60, callback: () => { if (ice.active && t.alive) ice.setPosition(t.x, t.y + 4); } });
      return true;
    },
    ai(h, c) {
      const sc = h.scene;
      const hurt = sc.party.find((p) => !p.downed && p.hp / p.maxHp < 0.25 && sc.enemies.some((e) => e.alive && e.target === p && dist(e, p) < 40));
      if (hurt) return true; // an ally in trouble: no target, so it guards the most hurt ally
      const big = c.engaged.filter((e) => !e.boss && dist(e, h) < 120 && (e.elite || e.maxHp >= 200 || e.state === 'windup')).sort((a, b) => b.maxHp - a.maxHp)[0];
      return big || null;
    },
  },
  // Glacial Wall: a short wall of ice across the line between her and a foe;
  // it blocks movement and enemy shots for 5s
  glacialwall: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const t = target && target.alive ? target : sc.nearestEnemy(h, 120);
      if (!t) return false;
      h.face(t.x - h.x, t.y - h.y);
      h.act('glacialwall', 0.4, 'cast');
      const [nx, ny] = norm(t.x - h.x, t.y - h.y);
      const mx = h.x + nx * 30, my = h.y + ny * 30;
      const tiles = [];
      for (let k = -2; k <= 2; k++) {
        const tx = Math.floor((mx - ny * k * 16) / 16), ty = Math.floor((my + nx * k * 16) / 16);
        if (sc.nav.isSolid(tx, ty) || tiles.some(([a, b]) => a === tx && b === ty)) continue;
        if ([...sc.party, ...sc.enemies].some((u) => u.alive && Math.floor(u.x / 16) === tx && Math.floor(u.y / 16) === ty)) continue; // never entomb anyone
        tiles.push([tx, ty]);
      }
      if (!tiles.length) return false;
      audio.sfx('frost', { pitch: 0.5 }); sc.shake(80, 0.004);
      const imgs = tiles.map(([tx, ty]) => { sc.nav.block(tx, ty); sc.fx.burst('foam', tx * 16 + 8, ty * 16 + 4, 6); return sc.add.image(tx * 16 + 8, ty * 16 + 14, 'icewall').setOrigin(0.5, 1).setDepth(ty * 16 + 14); });
      const life = 5 * Math.min(1.3, m);
      sc.time.delayedCall(life * 1000, () => { for (const [tx, ty] of tiles) sc.nav.unblock(tx, ty); for (const i of imgs) { sc.fx.burst('foam', i.x, i.y - 8, 5); i.destroy(); } audio.sfx('frost', { pitch: 1.6 }); });
      return true;
    },
    ai(h, c) {
      const sc = h.scene;
      // shield the back line from a rush or a volley
      const rushing = c.engaged.filter((e) => !e.boss && dist(e, h) < 90 && dist(e, h) > 34).length;
      const shooting = c.engaged.filter((e) => e.s.ranged && e.state === 'windup' && dist(e, h) < 130).length;
      return rushing >= 3 || shooting >= 2 ? (c.target || sc.nearestEnemy(h, 110)) : null;
    },
  },
  // Shatter: a heavy burst that spends a foe's Chill or Freeze
  shatter: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || !target.alive || dist(h, target) > 135) return false;
      h.face(target.x - h.x, target.y - h.y);
      h.act('shatter', 0.35, 'cast', {
        hitAt: 0.16,
        resolve: () => {
          if (!target.alive) return;
          const cold = target.status?.freeze || target.status?.chill;
          sc.fx.burst('foam', target.x, target.y - 10, cold ? 26 : 8);
          if (cold) { delete target.status.freeze; delete target.status.chill; target.stunT = Math.min(target.stunT, 0.2); target.statusTint?.(); sc.shake(120, 0.006); audio.sfx('bash', { pitch: 1.6 }); sc.floatText(target.x, target.y - 34, 'SHATTER!', 'fontGold'); }
          else audio.sfx('frost', { pitch: 1.8 });
          sc.dealDamage(h, target, h.stats.atk * (cold ? 3.2 : 1) * m, { knock: cold ? 80 : 30, spell: true, noProc: !!cold });
        },
      });
      return true;
    },
    ai(h, c) { const t = c.engaged.filter((e) => dist(e, h) < 125 && (e.status?.freeze || (e.status?.chill && (e.status.chill.n >= 2 || e.status.chill.heavy)))).sort((a, b) => b.hp - a.hp)[0]; return t || null; },
  },
  // Blizzard: snow over an area for 4s, chilling everything in it every half second
  blizzard: {
    cast(h, { target, m }) {
      const sc = h.scene;
      const t = target && target.alive ? target : sc.nearestEnemy(h, 130);
      if (!t || dist(h, t) > 140) return false;
      h.face(t.x - h.x, t.y - h.y);
      h.act('blizzard', 0.45, 'cast');
      const x = t.x, y = t.y, r = 40;
      const zone = sc.add.ellipse(x, y, r * 2, r * 1.4, 0xd6efff, 0.18).setDepth(-25).setStrokeStyle(1, 0xffffff, 0.4);
      (sc.partyZones ??= []).push({ x, y, r, until: sc.time.now + 4000 });
      audio.sfx('frost', { pitch: 0.6 });
      let n = 0;
      sc.time.addEvent({ delay: 500, repeat: 7, callback: () => {
        n++;
        for (let i = 0; i < 8; i++) sc.fx.burst('foam', x + (Math.random() - 0.5) * r * 2, y - 20 + (Math.random() - 0.5) * r, 1);
        for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - x, (e.y - y) * 1.3) < r + e.r) sc.dealDamage(h, e, h.stats.atk * 0.3 * m, { knock: 0, element: 'frost', spell: true });
        if (n >= 8) sc.tweens.add({ targets: zone, alpha: 0, duration: 300, onComplete: () => zone.destroy() });
      } });
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(h, t) < 130 && c.engaged.filter((e) => dist(e, t) < 40).length >= 2 ? t : null; },
  },
  // Mirror Image: two ice copies of her step out to either side and cast shards for 6s
  mirrorimage: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('mirrorimage', 0.45, 'cast');
      audio.sfx('warp', { pitch: 1.4 });
      for (const side of [-1, 1]) {
        const img = sc.add.sprite(h.x + side * 18, h.y, h.sprite.texture.key, h.sprite.frame.name).setOrigin(h.sprite.originX, h.sprite.originY).setTint(0x9fe6ff).setAlpha(0.7).setFlipX(h.sprite.flipX).setDepth(h.y);
        sc.fx.burst('foam', img.x, img.y - 10, 10);
        const clone = { x: img.x, y: img.y };
        const ev = sc.time.addEvent({ delay: 1100, repeat: 4, startAt: side > 0 ? 500 : 0, callback: () => {
          if (h.downed) return;
          const t = sc.nearestEnemy(clone, 140);
          if (!t) return;
          const [nx, ny] = norm(t.x - clone.x, t.y - (clone.y - 6));
          img.setFlipX(nx < 0);
          sc.spawnProjectile({ owner: h, x: clone.x + nx * 8, y: clone.y - 8, vx: nx * 220, vy: ny * 220, dmg: h.stats.atk * 0.6 * m, kind: 'iceshard', pierce: true, element: 'frost', spell: true, life: 0.7, split: -1 });
          audio.sfx('frost', { pitch: 1.6 });
        } });
        sc.time.delayedCall(6000, () => { ev.remove(); sc.fx.burst('foam', img.x, img.y - 10, 8); img.destroy(); });
      }
      return true;
    },
    ai(h, c) { return c.engaged.filter((e) => dist(e, h) < 140).length >= 2 || c.engaged.some((e) => e.boss) ? true : null; },
  },

  // ---------------------------------------------- Guardian discipline
  guardup: {
    cast(h, { m }) {
      h.act('guardup', 0.3, 'cast');
      h.shield = Math.max(h.shield || 0, Math.round(h.maxHp * (0.25 + 0.05 * (m - 1) / 0.15)));
      h.shieldT = Math.max(h.shieldT || 0, 6);
      audio.sfx('block');
      h.scene.fx.ring(h.x, h.y - 6, 'ringBlue', 3);
      h.scene.floatText(h.x, h.y - 30, 'GUARD UP', 'fontGold');
      return true;
    },
    ai(h) { return !(h.shield > 0) && (attackers(h.scene, h, 50).length >= 2 || h.hp / h.maxHp < 0.5) ? true : null; },
  },
  provoke: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('provoke', 0.4, 'cast');
      h.taunting = Math.max(h.taunting || 0, 3); // (taunting halves damage; Provoke's own cut is gentler, below)
      h.provokeT = 3;
      sc.taunt(h, 90 * Math.min(1.3, m), 3);
      audio.sfx('aggro');
      sc.fx.ring(h.x, h.y - 4, 'ringRed', 4.5);
      sc.floatText(h.x, h.y - 30, 'PROVOKE!', 'fontGold');
      return true;
    },
    ai(h, c) { return h.hp / h.maxHp > 0.5 && c.engaged.filter((e) => e.target && e.target !== h && dist(e, h) < 80).length >= 1 ? true : null; },
  },

  // ------------------------------------------------- Blade discipline
  sweep: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('sweep', 0.34, 'attack', {
        hitAt: 0.14,
        resolve: () => {
          audio.sfx('swing', { pitch: 0.8 });
          sc.fx.ring(h.x, h.y - 6, 'ringWhite', 3.4);
          for (const e of sc.enemies) if (e.alive && !e.submerged && dist(e, h) < 36 + e.r) sc.dealDamage(h, e, h.stats.atk * 1.1 * m, { knock: 120 });
        },
      });
      return true;
    },
    ai(h) { return engagedNear(h.scene, h, 40).length >= 2 ? true : null; },
  },
  guardparry: {
    cast(h, { m }) {
      h.act('guardparry', 0.5, 'idle');
      h.riposteT = 0.8;
      h.riposteMul = m;
      h.scene.fx.ring(h.x, h.y - 6, 'ringWhite', 1.8);
      audio.sfx('block');
      return true;
    },
    ai(h) { return h.scene.enemies.some((e) => e.alive && e.state === 'windup' && e.target === h && !e.s.ranged && dist(e, h) < 40) ? true : null; },
  },
  // ------------------------------------------------ Shadow discipline
  shadedash: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 120) return false;
      const [nx, ny] = norm(target.x - h.x, target.y - h.y);
      const sx = h.x, sy = h.y;
      let ex = target.x + nx * 18, ey = target.y + ny * 18;
      if (sc.nav.solidAtPx(ex, ey)) { ex = target.x - nx * 10; ey = target.y - ny * 10; }
      // everything along the line gets cut
      const seg = Math.hypot(ex - sx, ey - sy) || 1;
      for (const e of sc.enemies) {
        if (!e.alive || e.submerged) continue;
        const t = Math.max(0, Math.min(1, ((e.x - sx) * (ex - sx) + (e.y - sy) * (ey - sy)) / (seg * seg)));
        if (Math.hypot(sx + (ex - sx) * t - e.x, sy + (ey - sy) * t - e.y) < 14 + e.r) sc.dealDamage(h, e, h.stats.atk * 1.2 * m, { knock: 60 });
      }
      for (let i = 0; i <= 4; i++) sc.fx.puff(sx + (ex - sx) * i / 4, sy + (ey - sy) * i / 4, 'sparkCurse');
      h.x = ex; h.y = ey;
      h.invuln = Math.max(h.invuln, 0.35);
      h.face(target.x - h.x, target.y - h.y);
      audio.sfx('dash');
      h.clearPath();
      if (h.isLeader) h.command = { type: 'attack', target }; else h.target = target;
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(t, h) > 40 && dist(t, h) < 110 && t.kind !== 'ward' ? t : null; },
  },
  poisoncloud: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      const x = target.x, y = target.y, r = 30;
      h.face(x - h.x, y - h.y);
      h.act('poisoncloud', 0.4, 'cast');
      audio.sfx('squish');
      const g = sc.add.graphics().setDepth(y + 20);
      let t = 0, tick = 0;
      const ev = sc.time.addEvent({ delay: 100, loop: true, callback: () => {
        t += 0.1; tick -= 0.1;
        if (!g.active) { ev.remove(); return; }
        const a = Math.min(1, t * 3) * Math.min(1, (4 - t) * 2);
        g.clear().fillStyle(0x6fbf4a, 0.22 * a).fillEllipse(x, y, r * 2, r * 1.3).fillStyle(0xb8ff9a, 0.15 * a).fillEllipse(x + Math.sin(t * 3) * 6, y - 2, r * 1.3, r * 0.8);
        if (tick <= 0) {
          tick = 0.5;
          for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - x, (e.y - y) / 0.65) < r + e.r) { e.applyElement?.('venom', h); sc.dealDamage(h, e, h.stats.atk * 0.15 * m, { knock: 0, dot: true, noProc: true }); }
        }
        if (t >= 4) { ev.remove(); g.destroy(); }
      } });
      return true;
    },
    ai(h, c) { const t = c.target; return t && engagedNear(h.scene, t, 40).length >= 2 ? t : null; },
  },
};

// Skills that need an enemy to aim at.
export const TARGETED = new Set(['arcmissile', 'shadedash', 'poisoncloud', 'bash', 'charge', 'earthsplitter', 'fireball', 'chain', 'barrage', 'step', 'deathmark', 'powershot', 'hawkstrike', 'volley', 'blastarrow', 'cleave', 'leap', 'rend']);
