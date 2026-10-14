// Skill engine: what each active skill does (cast), and when an AI companion
// should use it (ai). Numbers scale with rank via `m` (rank multiplier).
// Passives are looked up with hero.passive(id) -> rank (0 when not equipped).
import { audio } from '../audio/synth.js';

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
            sc.dealDamage(h, e, h.stats.atk * 1.6 * m, { knock: 160 });
            e.stun?.(1.0 + 0.1 * (m - 1) / 0.15);
            hit = true;
          }
          if (hit) audio.sfx('bash');
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
        for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < 18 + e.r) { sc.dealDamage(h, e, h.stats.atk * 1.4 * m, { knock: 80 }); if (!e.boss) e.stun?.(0.6); }
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
          sc.spawnProjectile({ owner: h, x: h.x + nx * 10, y: h.y - 8, vx: nx * 160, vy: ny * 160, dmg: h.stats.atk * 2.4 * m, kind: 'fireball', aoe: 28, target, element: 'fire', spell: true });
          h.maybeEcho(target, h.stats.atk * 1.2, 'fireball');
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
        sc.dealDamage(h, e, h.stats.atk * 1.2 * m, { knock: 90, element: 'frost', spell: true });
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
          let from = { x: h.x, y: h.y - 10 }, cur = target, dmg = h.stats.atk * 1.6 * m;
          for (let i = 0; i < 4 && cur; i++) {
            hit.add(cur);
            bolt(sc, from.x, from.y, cur.x, cur.y - 8);
            sc.dealDamage(h, cur, dmg, { knock: 20, element: 'storm', spell: true });
            from = { x: cur.x, y: cur.y - 8 };
            dmg *= 0.85;
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
      const threats = sc.enemies.filter((e) => e.alive && dist(e, h) < 90);
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
      const pool = sc.enemies.filter((e) => e.alive && dist(e, h) < 130);
      if (!pool.length) return false;
      h.act('barrage', 0.6, 'cast');
      for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 80, () => {
        const live = pool.filter((e) => e.alive);
        if (!live.length || h.downed) return;
        const t = i === 0 && target?.alive ? target : live[i % live.length];
        const a = -Math.PI / 2 + (i - 2.5) * 0.45;
        sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: h.stats.atk * 0.8 * m, kind: 'missile', target: t, spell: true, life: 1.6 });
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
  step: {
    cast(h, { target }) {
      const sc = h.scene;
      if (!target || dist(h, target) > 115) return false;
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      const [nx, ny] = norm(target.x - h.x, target.y - h.y);
      const bx = target.x + nx * 12, by = target.y + ny * 12;
      if (!sc.nav.solidAtPx(bx, by)) { h.x = bx; h.y = by; } else { h.x = target.x - nx * 12; h.y = target.y - ny * 12; }
      h.face(target.x - h.x, target.y - h.y);
      sc.fx.puff(h.x, h.y, 'sparkCurse');
      audio.sfx('dash');
      h.nextCrit = true;
      h.atkT = 0;
      h.clearPath();
      if (h.isLeader) h.command = { type: 'attack', target }; else h.target = target;
      return true;
    },
    ai(h, c) { const t = c.target; return t && dist(t, h) > 50 && dist(t, h) < 110 && t.kind !== 'ward' ? t : null; },
  },
  fan: {
    cast(h, { m }) {
      const sc = h.scene;
      h.act('fan', 0.3, 'cast');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        sc.spawnProjectile({ owner: h, x: h.x, y: h.y - 8, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, dmg: h.stats.atk * 1.4 * m, kind: 'knife', life: 0.32 });
      }
      audio.sfx('stab'); sc.time.delayedCall(40, () => audio.sfx('stab')); sc.time.delayedCall(80, () => audio.sfx('swing', { pitch: 1.4 }));
      return true;
    },
    ai(h, c) { return engagedNear(h.scene, h, 38).length >= 2 ? true : null; },
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
          sc.spawnProjectile({ owner: h, x: h.x + nx * 8, y: h.y - 8, vx: nx * 300, vy: ny * 300, dmg: h.stats.atk * 2.2 * m, kind: 'arrow', pierce: true, life: 0.7 });
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
          sc.dealDamage(h, target, h.stats.atk * 1.2 * m, { knock: 30 });
          target.hawkMarked = { t: 6 };
          if (target.submerged) target.submerge?.(false);
          sc.floatText(target.x, target.y - 34, 'MARKED', 'fontPlain', 0xffd04a);
        }
        sc.tweens.add({ targets: hawk, x: target.x + 90, y: target.y - 130, alpha: 0, duration: 500, onComplete: () => hawk.destroy() });
      } });
      return true;
    },
    ai(h, c) { return c.target && !c.target.hawkMarked && dist(c.target, h) < 150 ? c.target : null; },
  },
  volley: {
    cast(h, { target, m }) {
      const sc = h.scene;
      if (!target) return false;
      const cx = target.x, cy = target.y;
      h.face(cx - h.x, cy - h.y);
      h.act('volley', 0.5, 'attack');
      const g = sc.fx.telegraph(cx, cy, 30, 0.3); sc.time.delayedCall(300, () => g.destroy());
      for (let i = 0; i < 10; i++) sc.time.delayedCall(250 + i * 180, () => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 28;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7;
        const ar = sc.add.image(x - 10, y - 60, 'arrow').setRotation(1.4).setDepth(TOP - 20);
        sc.tweens.add({ targets: ar, x, y: y - 4, duration: 160, onComplete: () => {
          ar.destroy(); sc.fx.burst('spark', x, y, 3);
          for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - x, e.y - y) < 14 + e.r) sc.dealDamage(h, e, h.stats.atk * 0.5 * m, { knock: 10 });
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
    ai(h) { return attackers(h.scene, h, 32).length >= 1 ? true : null; },
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
          sc.spawnProjectile({ owner: h, x: h.x + nx * 8, y: h.y - 8, vx: nx * 240, vy: ny * 240, dmg: h.stats.atk * 2.4 * m, kind: 'fireball', aoe: 30, target, element: 'fire' });
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
            if (d < 34 + e.r && (dx * nx + dy * ny) / (d || 1) > 0.2) sc.dealDamage(h, e, h.stats.atk * 1.5 * m, { knock: 90 });
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
        for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - h.x, e.y - h.y) < 32 + e.r) { sc.dealDamage(h, e, h.stats.atk * 1.8 * m, { knock: 120 }); if (!e.boss) e.stun?.(0.5); }
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
            for (const e of sc.enemies) if (e.alive && !e.submerged && Math.hypot(e.x - h.x, e.y - h.y) < 30 + e.r) sc.dealDamage(h, e, h.stats.atk * 0.6 * m, { knock: 40 });
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
};

// Skills that need an enemy to aim at.
export const TARGETED = new Set(['bash', 'charge', 'earthsplitter', 'fireball', 'chain', 'barrage', 'step', 'deathmark', 'powershot', 'hawkstrike', 'volley', 'blastarrow', 'cleave', 'leap', 'rend']);
