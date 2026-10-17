// Mother Murk companion test (dev only). Reload first, then:
//   const M = await import('/tools/murk-test.js'); await M.run()
// The true Murk at her Mistfen pool against Brann (leader, keeps attacking),
// Pip and Sable, with the Tide Charm, for `secs` seconds and a fixed seed.
// Measures what playtesting showed going wrong:
//   pipSwimPct      - Pip (ranged) in the water instead of shooting from shore
//   rangedInRangePct- Pip within range with a clear shot
//   dodgeStarts/min - companions starting to sidestep (high = dithering)
//   inPuddlePct     - companion time standing in poison
//   reversals/min   - companions doubling back on themselves (bouncing)
import { go, step, closeDialog } from './goto.js';

// line of fire by the projectile rule (walls stop shots; water, bog and chasms
// don't), measured the same way for old and new code
function shotLine(sc, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 1; i < n; i++) {
    const x = a.x + (b.x - a.x) * (i / n), y = a.y + (b.y - a.y) * (i / n), tx = Math.floor(x / 16), ty = Math.floor(y / 16);
    if (!sc.nav.isSolid(tx, ty)) continue;
    const t = sc.world.at(tx, ty);
    if (t === 3 || t === 12 || t === 13) continue; // WATER, BOG, CHASM
    return false;
  }
  return true;
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export async function run(secs = 60, seed = 5) {
  const { newState } = await import('/src/game/state.js');
  const W = (await import('/src/data/world.json')).default;
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  st.relics = ['grapple', 'tide'];
  st.pos = { x: 160 * 16 + 8, y: 112 * 16 + 8 };
  let sc = await go(160, 112, { state: st, level: 10, relics: st.relics });
  for (let i = 0; i < 60 && window.__game.scene.isActive('Loading'); i++) await step(10);
  await step(20); closeDialog();
  sc = window.__scene;
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  sc.enemies = sc.enemies.filter((e) => e.alive);
  const wb = W.wardBosses.find((b) => b.kind === 'murk'), wd = W.wards.find((w) => w.id === wb.ward);
  const { Murk } = await import('/src/game/units.js');
  const realRandom = Math.random; Math.random = seeded(seed);
  const m = { frames: 0, pipSwim: 0, pipInRange: 0, dodgeStarts: 0, comp: 0, inPuddle: 0, reversals: 0, murkHpLost: 0, puddleBy: {}, pipFar: 0, pipTarget: {} };
  try {
    const x = (wd.x + wb.offset[0]) * 16 + 8, y = (wd.y + wb.offset[1]) * 16 + 8;
    const boss = new Murk(sc, x, y, { level: 12, arena: wb.arena, pool: wb.pool });
    boss.maxHp *= 20; boss.hp = boss.maxHp; boss.introT = 0;
    sc.enemies.push(boss); sc.golem = boss; boss.engaged = true; boss.aggroOn?.(sc.leader, false);
    const L = sc.leader;
    for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; h.x = x + (h === L ? 0 : h.def.id === 'pip' ? -40 : 40); h.y = y + 70; }
    const hp0 = boss.hp, pip = sc.party.find((h) => h.def.id === 'pip');
    const prevEv = new Map(), lastPos = new Map(), lastDir = new Map();
    for (let f = 0; f < secs * 60; f++) {
      if (!L.command || L.command.type !== 'attack') L.command = { type: 'attack', target: boss };
      for (const h of sc.party) if (h.downed) h.revive(1);
      if (sc.ui?.dialogOpen) closeDialog();
      await step(1); m.frames++;
      if (pip.swimming) m.pipSwim++;
      if (pip.swimming && !m.wasSwim) (m.swimWhy ??= []).push([f, pip.target === boss ? 'boss' : pip.target ? 'other' : 'none', pip.evading ? 'ev' : '', L.swimming ? 'Lswim' : '', boss.submerged ? 'sub' : '', 'ph' + boss.phase, sc.fairTarget(boss) ? 'fair' : 'unfair', Math.round(Math.hypot(pip.x - L.x, pip.y - L.y)), pip.backing ? 'back' : '', pip.reviveTarget ? 'revive' : ''].join(' '));
      m.wasSwim = pip.swimming;
      const tk = pip.target === boss ? 'boss' : pip.target ? 'other' : 'none'; m.pipTarget[tk] = (m.pipTarget[tk] || 0) + 1;
      if (pip.target === boss && Math.hypot(pip.x - boss.x, pip.y - boss.y) <= pip.stats.range && shotLine(sc, pip, boss)) m.pipInRange++;
      for (const h of sc.party) {
        if (h === L) continue;
        m.comp++;
        if (h.evading && !prevEv.get(h)) m.dodgeStarts++;
        prevEv.set(h, h.evading);
        if ((boss.puddles || []).some((p) => Math.hypot(h.x - p.x, (h.y - p.y) / 0.65) < 16 + h.r)) { m.inPuddle++; m.puddleBy[h.def.id + (h.braveT > 0 ? ':brave' : h.evading ? ':evading' : h.action?.type ? ':' + h.action.type : ':moving')] = (m.puddleBy[h.def.id + (h.braveT > 0 ? ':brave' : h.evading ? ':evading' : h.action?.type ? ':' + h.action.type : ':moving')] || 0) + 1; }
        // a reversal: over 1/6 s it moved one way, over the next the other way
        if (f % 10 === 0) {
          const lp = lastPos.get(h);
          if (lp) {
            const dx = h.x - lp.x, dy = h.y - lp.y, len = Math.hypot(dx, dy);
            if (len > 3) { const ld = lastDir.get(h); if (ld && (dx * ld.x + dy * ld.y) / len < -0.7) m.reversals++; lastDir.set(h, { x: dx / len, y: dy / len }); }
          }
          lastPos.set(h, { x: h.x, y: h.y });
        }
      }
    }
    m.murkHpLost = Math.round(100 * (hp0 - boss.hp) / hp0 * 10) / 10;
    boss.alive = false; boss.destroy(); sc.golem = null;
  } finally { Math.random = realRandom; }
  const mins = m.frames / 3600;
  return {
    pipSwimPct: Math.round(100 * m.pipSwim / m.frames), pipInRangePct: Math.round(100 * m.pipInRange / m.frames),
    dodgeStartsPerMin: +(m.dodgeStarts / mins).toFixed(1), inPuddlePct: +(100 * m.inPuddle / m.comp).toFixed(1),
    reversalsPerMin: +(m.reversals / mins).toFixed(1), murkHpLostPct: m.murkHpLost, puddleBy: m.puddleBy, pipTarget: m.pipTarget, swimWhy: (m.swimWhy || []).slice(0, 8), errs: (window.__errs || []).slice(0, 2),
  };
}
