// Enemy AI benchmark (dev only). Load into a running Dungeon Lab session:
//   const { bench } = await import('/tools/fight-bench.js'); await bench();
// Spawns fixed enemy groups in fixed spots (open hall, tight pillared vault),
// lets the party fight them with seeded randomness, and measures how the
// enemies behave. Only uses long-standing game APIs, so the same file runs
// against old and new AI for before/after numbers.

const SCENARIOS = [
  { id: 'goblins3', room: 'hall', units: ['goblin', 'goblin', 'goblin'] },
  { id: 'goblins6', room: 'hall', units: Array(6).fill('goblin') },
  { id: 'mixed10', room: 'hall', units: ['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'archer', 'archer', 'archer', 'hollow', 'hollow'] },
  { id: 'archers', room: 'hall', units: ['archer', 'archer', 'archer', 'archer', 'goblin', 'goblin'] },
  { id: 'elitePack', room: 'hall', units: ['goblin', 'goblin', 'goblin', 'goblin'], elite: 'goblin' },
  { id: 'undercroft', room: 'vault', units: ['rats', 'rats', 'rats', 'rats', 'hollow', 'hollow', 'hollow'] },
  { id: 'tightMixed', room: 'vault', units: ['goblin', 'goblin', 'goblin', 'goblin', 'archer', 'archer'] },
];
// party stand point and enemy arc centre, in the lab dungeon's local tiles
const ROOMS = { hall: { party: [37, 47], foes: [37, 40] }, vault: { party: [12, 13], foes: [12, 7] } };
const WIND = new Set(['windup', 'chargeWindup', 'tongueWind']);

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

export async function runScenario(sc, S, secs = 20) {
  const O = sc.dungeon.def.origin, T = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  const realRandom = Math.random;
  Math.random = seeded(S.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  try {
    // a clean slate: no foes, piles that reform, shots or danger zones left
    // over from the previous scenario (they skewed the next one's numbers)
    const wipe = () => { for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); } sc.enemies = sc.enemies.filter((e) => e.alive); sc.clearProjectiles?.(); sc.dangers.length = 0; };
    wipe(); await step(40); wipe();
    for (const h of sc.party) { for (const k of h.skills || []) k.t = 0; h.atkT = 0; h.dodgeCd = 0; h.buffs = {}; }
    const R = ROOMS[S.room], P = T(...R.party), F = T(...R.foes);
    sc.party.forEach((h, i) => { h.x = P.x + (i - 1) * 14; h.y = P.y + (i ? 6 : 0); h.downed = false; h.maxHp = h.hs.__baseMax ??= h.maxHp; h.maxHp *= 50; h.hp = h.maxHp; h.command = null; h.target = null; h.action = null; h.clearPath(); });
    const foes = [];
    const n = S.units.length + (S.elite ? 1 : 0);
    const kinds = S.elite ? [S.elite, ...S.units] : S.units;
    kinds.forEach((k, i) => {
      const a = Math.PI + (i + 0.5) / n * Math.PI; // an arc on the far side of the room
      const e = sc.spawnEnemy(k, F.x + Math.cos(a) * 60, F.y + Math.sin(a) * 26, true, S.elite && i === 0);
      e.maxHp *= 3; e.hp = e.maxHp; e.aggroOn(sc.leader, false);
      foes.push(e);
    });
    const L = sc.leader;
    const hp0 = foes.reduce((a, e) => a + e.hp, 0);
    const m = { evadeFrames: 0, compFrames: 0, inReachFrames: 0, hits: 0, frames: 0, windMax: 0, windSum: 0, windFrames: 0, wind3: 0, overlapPairs: 0, switches: 0, stuck: 0, chaseSamples: 0, rangedFrames: 0, rangedCanShoot: 0, rangedShots: 0, returns: 0, flees: 0, flankFrames: 0, enemyFrames: 0, hpLost: 0 };
    const prevT = new Map(), prevState = new Map(), lastPos = new Map();
    // party damage: count the hits themselves (a level-up resets max HP, so
    // watching the HP bars would misread that as damage)
    const restore = sc.party.map((h) => { const o = h.damage; h.damage = function (...a) { const r = o.apply(this, a); if (typeof r === 'number' && r > 0) { m.hpLost += r; m.hits++; } return r; }; return () => { h.damage = o; }; });
    let cleared = null;
    for (let f = 0; f < secs * 60; f++) {
      // the "player": keep hitting the nearest foe
      if (!L.command || L.command.type !== 'attack' || !L.command.target?.alive) { const t = sc.nearestEnemy(L, 400); if (t) L.command = { type: 'attack', target: t }; }
      for (const h of sc.party) { if (h.downed) h.revive?.(1); }
      await step(1);
      m.frames++;
      const alive = foes.filter((e) => e.alive);
      if (!alive.length) { cleared = f / 60; break; }
      // companions: time spent sidestepping, and time close enough to hit what they're fighting
      for (const h of sc.party) {
        if (h === L || h.downed) continue;
        m.compFrames++;
        if (h.evading) m.evadeFrames++;
        const t = h.target;
        if (t?.alive && Math.hypot(t.x - h.x, t.y - h.y) <= (h.stats.range || 16) + (t.r || 6) + 6) m.inReachFrames++;
      }
      // wind-ups stacked on one hero at the same moment
      let worst = 0;
      for (const h of sc.party) worst = Math.max(worst, alive.filter((e) => WIND.has(e.state) && e.target === h).length);
      m.windMax = Math.max(m.windMax, worst);
      if (worst > 0) { m.windSum += worst; m.windFrames++; }
      if (worst >= 3) m.wind3++;
      // stacking: pairs standing on top of each other
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) if (Math.hypot(alive[i].x - alive[j].x, alive[i].y - alive[j].y) < 9) m.overlapPairs++;
      for (const e of alive) {
        m.enemyFrames++;
        const pt = prevT.get(e);
        if (pt && e.target && pt !== e.target) m.switches++;
        prevT.set(e, e.target || pt);
        if (e.target && e.target !== L) m.flankFrames++;
        if (e.s.ranged && e.engaged && e.target) {
          m.rangedFrames++;
          const d = Math.hypot(e.x - e.target.x, e.y - e.target.y);
          if (d <= e.s.reach && sc.nav.lineClear(e.x, e.y, e.target.x, e.target.y, 1)) m.rangedCanShoot++;
          if (e.state === 'windup' && prevState.get(e) !== 'windup') m.rangedShots++;
        }
        if (e.state === 'return' && prevState.get(e) !== 'return') m.returns++;
        if (e.state === 'flee' && prevState.get(e) !== 'flee') m.flees++;
        prevState.set(e, e.state);
      }
      // stuck: chasing (not yet in reach) yet barely moved over half a second
      if (f % 30 === 0) {
        for (const e of alive) {
          const lp = lastPos.get(e);
          const wants = e.state === 'chase' && !e.waiting && e.target && Math.hypot(e.x - e.target.x, e.y - e.target.y) > (e.s.ranged ? e.s.reach : e.s.reach + e.target.r + 8);
          if (lp && lp.wants && wants) { m.chaseSamples++; if (Math.hypot(e.x - lp.x, e.y - lp.y) < 4) m.stuck++; }
          lastPos.set(e, { x: e.x, y: e.y, wants });
        }
      }
    }
    restore.forEach((f) => f());
    const mins = m.frames / 3600, eMins = m.enemyFrames / 3600;
    return {
      id: S.id, foes: n, secs: +(m.frames / 60).toFixed(1), clearedAt: cleared,
      maxWindupsOnOneHero: m.windMax,
      avgWindupsWhenAttacking: m.windFrames ? +(m.windSum / m.windFrames).toFixed(2) : 0,
      pct3PlusWindups: +(100 * m.wind3 / m.frames).toFixed(1),
      overlapPairsPerSec: +(m.overlapPairs / (m.frames / 60)).toFixed(1),
      targetSwitchesPerEnemyMin: +(m.switches / Math.max(0.01, eMins)).toFixed(1),
      stuckPct: m.chaseSamples ? +(100 * m.stuck / m.chaseSamples).toFixed(1) : 0,
      rangedCanShootPct: m.rangedFrames ? +(100 * m.rangedCanShoot / m.rangedFrames).toFixed(1) : null,
      rangedShotsPerMin: m.rangedFrames ? +(m.rangedShots / (m.rangedFrames / 3600)).toFixed(1) : null,
      gaveUpAndWentHome: m.returns,
      flees: m.flees,
      pctTargetingNonLeader: +(100 * m.flankFrames / Math.max(1, m.enemyFrames)).toFixed(1),
      partyDmgPerSec: +(m.hpLost / Math.max(0.01, mins * 60)).toFixed(1),
      hitsOnPartyPerSec: +(m.hits / Math.max(0.01, mins * 60)).toFixed(2),
      partyDpsOut: +((hp0 - foes.reduce((a, e) => a + Math.max(0, e.alive ? e.hp : 0), 0)) / Math.max(0.01, mins * 60)).toFixed(1),
      companionEvadePct: +(100 * m.evadeFrames / Math.max(1, m.compFrames)).toFixed(1),
      companionInReachPct: +(100 * m.inReachFrames / Math.max(1, m.compFrames)).toFixed(1),
    };
  } finally { Math.random = realRandom; }
}

// seeds > 1: every scenario runs once per seed and numeric results are averaged
export async function bench(secs = 20, only = null, seeds = 1) {
  const sc = window.__scene;
  const out = [];
  for (const S of SCENARIOS) {
    if (only && !only.includes(S.id)) continue;
    const runs = [];
    for (let k = 0; k < seeds; k++) runs.push(await runScenario(sc, k ? { ...S, id: `${S.id}#${k}` } : S, secs));
    const avg = { id: S.id, seeds };
    for (const key of Object.keys(runs[0])) {
      if (key === 'id') continue;
      const vals = runs.map((r) => r[key]).filter((v) => typeof v === 'number');
      avg[key] = vals.length ? +(vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : runs[0][key];
    }
    out.push(avg);
  }
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  return out;
}

// Leash: a foe chases the leader who backs off across a dungeon room.
// Returns whether it gave up (and healed) or kept coming.
export async function leashTest() {
  const sc = window.__scene, O = sc.dungeon.def.origin, L = sc.leader;
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  const hall = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  const p = hall(26, 44); sc.party.forEach((h) => { h.x = p.x; h.y = p.y; h.maxHp *= 50; h.hp = h.maxHp; });
  const e = sc.spawnEnemy('goblin', p.x + 40, p.y, true); e.aggroOn(L, false); e.hp = e.maxHp * 0.5;
  e.damage = () => 0; // the party can't kill it: we only watch whether it gives up
  await step(60);
  // the leader walks steadily away along the hall
  let gaveUp = false;
  for (let f = 0; f < 60 * 8; f++) { L.x += 1.1; L.command = null; await step(1); if (e.state === 'return') gaveUp = true; }
  return { gaveUp, enemyHpPct: Math.round(100 * e.hp / e.maxHp), engaged: e.engaged };
}

// Area attacks: a meteor-sized zone (r 46, 1.5 s) lands on an elite and two
// regular goblins fighting the party. Returns the share of the zone's life each
// spent inside it (elites should step out; regular foes needn't).
export async function aoeTest(trials = 6) {
  const sc = window.__scene, O = sc.dungeon.def.origin, L = sc.leader;
  const realRandom = Math.random; Math.random = seeded(4242);
  const res = { elite: 0, regular: 0, samples: 0, eliteOut: 0, regularOut: 0 };
  try {
    for (let k = 0; k < trials; k++) {
      for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
      await step(10);
      const p = { x: (O[0] + 37) * 16 + 8, y: (O[1] + 46) * 16 + 8 };
      sc.party.forEach((h, i) => { h.x = p.x + (i - 1) * 14; h.y = p.y + 10; h.maxHp = h.hs.__baseMax ??= h.maxHp; h.maxHp *= 50; h.hp = h.maxHp; });
      const el = sc.spawnEnemy('goblin', p.x, p.y - 26, true, true), a = sc.spawnEnemy('goblin', p.x - 18, p.y - 22, true), b = sc.spawnEnemy('goblin', p.x + 18, p.y - 22, true);
      for (const e of [el, a, b]) { e.maxHp *= 20; e.hp = e.maxHp; e.aggroOn(L, false); }
      await step(30);
      const z = { x: el.x, y: el.y, r: 46, until: sc.time.now + 1500 };
      (sc.partyZones ??= []).push(z);
      const g = sc.fx.telegraph(z.x, z.y, z.r, 1.5);
      let inE = 0, inR = 0, n = 0;
      for (let f = 0; f < 90; f++) { await step(1); n++; if (Math.hypot(el.x - z.x, el.y - z.y) < z.r) inE++; for (const e of [a, b]) if (Math.hypot(e.x - z.x, e.y - z.y) < z.r) inR += 0.5; }
      g.destroy?.(); sc.partyZones = sc.partyZones.filter((q) => q !== z);
      res.elite += inE / n; res.regular += inR / n; res.samples++;
      if (Math.hypot(el.x - z.x, el.y - z.y) >= z.r) res.eliteOut++; // clear when it lands
      for (const e of [a, b]) if (Math.hypot(e.x - z.x, e.y - z.y) >= z.r) res.regularOut += 0.5;
    }
  } finally { Math.random = realRandom; }
  return { eliteClearAtImpactPct: Math.round(100 * res.eliteOut / res.samples), regularClearAtImpactPct: Math.round(100 * res.regularOut / res.samples), eliteInsidePct: Math.round(100 * res.elite / res.samples), regularInsidePct: Math.round(100 * res.regular / res.samples) };
}

// Corners and doorways: goblins scattered round the crystal room must funnel
// through its doorway to reach the party in the hall. Times each one's arrival
// and how much of its trip it spent stuck.
export async function stuckTest() {
  const sc = window.__scene, O = sc.dungeon.def.origin, L = sc.leader;
  const realRandom = Math.random; Math.random = seeded(777);
  const T = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  try {
    for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
    await step(10);
    for (const d of sc.dungeon.doors) if (d.kind === 'shutter') { d.closed = null; } sc.dungeon.refreshDoors(true);
    const p = T(44, 44);
    sc.party.forEach((h, i) => { h.x = p.x - i * 10; h.y = p.y + (i ? 8 : 0); h.maxHp = h.hs.__baseMax ??= h.maxHp; h.maxHp *= 50; h.hp = h.maxHp; h.command = null; h.update = () => {}; }); // the party holds still
    const spots = [[54, 38], [59, 39], [54, 55], [59, 56], [58, 42], [55, 48]]; // reachable spots (the north pocket is behind raised pegs)
    const foes = spots.map(([x, y]) => { const q = T(x, y); const e = sc.spawnEnemy('goblin', q.x, q.y, true); e.maxHp *= 50; e.hp = e.maxHp; e.aggroOn(L, false); e.noLeash = true; return e; });
    const arrive = foes.map(() => null), last = foes.map((e) => ({ x: e.x, y: e.y }));
    let stuck = 0, samples = 0;
    for (let f = 0; f < 60 * 15; f++) {
      await step(1);
      foes.forEach((e, i) => { if (arrive[i] === null && Math.hypot(e.x - L.x, e.y - L.y) < 56) arrive[i] = f / 60; }); // 56: the ring where foes wait for an attack turn
      if (f % 30 === 0) foes.forEach((e, i) => { if (arrive[i] === null && !e.waiting) { samples++; if (Math.hypot(e.x - last[i].x, e.y - last[i].y) < 4) stuck++; } last[i] = { x: e.x, y: e.y }; });
      if (arrive.every((a) => a !== null)) break;
    }
    const got = arrive.filter((a) => a !== null);
    return { arrived: `${got.length}/${foes.length}`, avgArriveSecs: got.length ? +(got.reduce((a, v) => a + v, 0) / got.length).toFixed(1) : null, slowestSecs: got.length === foes.length ? Math.max(...got) : 'never', stuckPct: samples ? Math.round(100 * stuck / samples) : 0 };
  } finally { Math.random = realRandom; for (const h of sc.party) delete h.update; }
}

// The Gatewarden (true form numbers: +30% HP, +15% damage) against the party
// in the lab hall for a fixed time. Counts its slams that connect, rocks
// thrown and hitting, how much of the fight the companions spend dodging, and
// how often anyone is inside its slam reach.
export async function golemTest(secs = 45, seed = 99, leaderDodges = true) {
  const sc = window.__scene, O = sc.dungeon.def.origin, L = sc.leader;
  const { Golem } = await import('/src/game/units.js');
  const realRandom = Math.random; Math.random = seeded(seed);
  const T = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  try {
    for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
    sc.enemies = sc.enemies.filter((e) => e.alive); sc.dangers.length = 0; await step(20);
    const P = T(37, 47);
    sc.party.forEach((h, i) => { h.x = P.x + (i - 1) * 14; h.y = P.y; h.downed = false; h.maxHp = h.hs.__baseMax ??= h.maxHp; h.maxHp *= 50; h.hp = h.maxHp; h.command = null; h.target = null; h.action = null; h.clearPath(); });
    const g = new Golem(sc, P.x, P.y - 60, { level: 7 });
    g.maxHp = Math.round(g.maxHp * 1.3 * 20); g.hp = g.maxHp; g.s = { ...g.s, dmg: g.s.dmg * 1.15 };
    sc.enemies.push(g); g.aggroOn(L, false);
    const landed = new Set(); let frame = 0;
    const m = { frames: 0, slamHits: 0, rocks: 0, rockHits: 0, evade: 0, comp: 0, inReach: 0, hits: 0, windups: 0 };
    let src = null;
    const restore = sc.party.map((h) => { const o = h.damage; h.damage = function (a, s2, ...r) { const v = o.call(this, a, s2, ...r); if (typeof v === 'number' && v > 0) { m.hits++; if (s2 === g) { m.slamHits++; landed.add(frame); } } return v; }; return () => { h.damage = o; }; });
    let prev = null;
    for (let f = 0; f < secs * 60; f++) {
      if (!L.command || L.command.type !== 'attack') L.command = { type: 'attack', target: g };
      // the "player" dodges a marker they're standing in, a beat after it appears (as you would)
      if (leaderDodges) {
        const z = sc.dangers.find((q) => Math.hypot(L.x - q.x, L.y - q.y) < q.r + L.r);
        if (z) { z.playerSeen ??= f; if (f - z.playerSeen >= 18 && L.dodgeCd <= 0) L.dodge(...L.smartDodge()); }
      }
      frame = f;
      await step(1); m.frames++;
      if (g.state === 'throw' && prev !== 'throw') m.rocks++;
      if (g.state === 'windup' && prev !== 'windup') m.windups++;
      prev = g.state;
      for (const h of sc.party) { if (h === L) continue; m.comp++; if (h.evading) m.evade++; }
      if (sc.party.some((h) => Math.hypot(h.x - g.x, h.y - g.y) < g.s.zr + h.r)) m.inReach++;
    }
    restore.forEach((f) => f());
    const s2 = m.frames / 60;
    g.alive = false; g.destroy?.();
    return { slamsLandedPct: Math.round(100 * landed.size / Math.max(1, m.windups)), slamWindupsPerMin: +(m.windups / s2 * 60).toFixed(1), slamHitsPerMin: +(m.slamHits / s2 * 60).toFixed(1), rocksPerMin: +(m.rocks / s2 * 60).toFixed(1), hitsOnPartyPerMin: +(m.hits / s2 * 60).toFixed(1), companionEvadePct: Math.round(100 * m.evade / Math.max(1, m.comp)), anyoneInSlamReachPct: Math.round(100 * m.inReach / m.frames), golemHpLostPct: +(100 * (1 - g.hp / g.maxHp)).toFixed(1) };
  } finally { Math.random = realRandom; }
}
