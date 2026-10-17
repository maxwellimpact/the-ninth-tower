// Melee reach probe (dev only). In a Dungeon Lab session:
//   const R = await import('/tools/reach-probe.js'); await R.run()
// Spawns a pack in the lab hall and, for each hero, samples every frame: is
// there a target, how far outside striking reach, and what the hero is doing
// while out of reach (moving to a slot, evading, backing off, casting...).
// Seeded, so old and new code compare.
import { step } from './goto.js';

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export async function run({ secs = 20, seed = 4, units = ['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin'] } = {}) {
  const sc = window.__scene;
  const O = sc.dungeon.def.origin, T = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  sc.enemies = []; sc.dangers = [];
  const realRandom = Math.random; Math.random = seeded(seed);
  const out = {};
  try {
    const p0 = T(37, 47);
    sc.party.forEach((h, i) => { h.maxHp *= 50; h.hp = h.maxHp; h.x = p0.x + (i - 1) * 16; h.y = p0.y; h.command = null; h.action = null; h.clearPath?.(); });
    const f0 = T(37, 40);
    const foes = units.map((k, i) => { const e = sc.spawnEnemy(k, f0.x + (i - units.length / 2) * 14, f0.y + (i % 2) * 10, true); e.maxHp = e.hp = e.maxHp * 30; return e; });
    const L = sc.leader;
    const S = Object.fromEntries(sc.party.map((h) => [h.def.id, { n: 0, tgt: 0, inReach: 0, gap: 0, why: {} }]));
    for (let f = 0; f < secs * 60; f++) {
      if (!L.command || L.command.type !== 'attack' || !L.command.target?.alive) { const t = foes.filter((e) => e.alive).sort((a, b) => Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(b.x - L.x, b.y - L.y))[0]; if (t) L.command = { type: 'attack', target: t }; }
      await step(1);
      for (const h of sc.party) {
        if (h.ranged || h.def.id === 'pip') continue;
        const s = S[h.def.id]; s.n++;
        const t = h.isLeader ? h.command?.target : h.target;
        if (!t?.alive) { s.why.noTarget = (s.why.noTarget || 0) + 1; continue; }
        s.tgt++;
        const gap = Math.hypot(h.x - t.x, h.y - t.y) - (h.stats.range + t.r + 8);
        if (gap <= 0) { s.inReach++; continue; }
        s.gap += gap;
        const why = h.evading ? 'evading' : h.backing ? 'backing' : h.action?.type === 'skill' ? `skill:${h.action.id}` : h.action?.type ? h.action.type : h.path?.length ? 'pathing' : h.braveT > 0 ? 'brave' : 'moving/idle';
        s.why[why] = (s.why[why] || 0) + 1;
      }
    }
    for (const [id, s] of Object.entries(S)) {
      if (!s.n) continue;
      out[id] = { inReachPct: Math.round(100 * s.inReach / s.n), hasTargetPct: Math.round(100 * s.tgt / s.n), avgGapPx: s.tgt - s.inReach ? Math.round(s.gap / (s.tgt - s.inReach)) : 0, outOfReachWhy: Object.fromEntries(Object.entries(s.why).map(([k, v]) => [k, Math.round(100 * v / s.n)])), range: sc.party.find((h) => h.def.id === id).stats.range };
    }
    for (const e of foes) if (e.alive) { e.alive = false; e.destroy(); }
    sc.enemies = sc.enemies.filter((e) => e.alive);
  } finally { Math.random = realRandom; }
  out.errs = (window.__errs || []).slice(0, 2);
  return out;
}
