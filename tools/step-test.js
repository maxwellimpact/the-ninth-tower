// Shadow Step damage test (dev only). In a Dungeon Lab session:
//   const T = await import('/tools/step-test.js'); await T.run()
// Sable leads alone against two harmless dummies 60px apart. She attacks one;
// whenever Shadow Step is ready she steps to the other. Measures only her
// damage, so old and new versions of the skill compare without the noise of a
// whole party fight (fight-bench). Seeded.
import { step } from './goto.js';

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export async function run(secs = 60, seed = 3) {
  const sc = window.__scene;
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  sc.enemies = [];
  const sable = sc.party.find((h) => h.def.id === 'sable');
  sc.setLeader(sable);
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; if (h !== sable) { h.x = sable.x - 200; h.y = sable.y + 120; h.stats.atk = 0; h.command = { type: 'move', x: h.x, y: h.y }; } }
  const realRandom = Math.random; Math.random = seeded(seed);
  const dummies = [-30, 30].map((dx) => { const e = sc.spawnEnemy('goblin', sable.x + dx, sable.y - 30, false); e.maxHp = e.hp = 1e7; e.s.speed = 0; e.s.dmg = 0; return e; });
  const m = { dmg: 0, hits: 0, crits: 0, steps: 0 };
  const dd = sc.dealDamage;
  sc.dealDamage = function (src, tgt, amt, o) { if (src === sable && dummies.includes(tgt)) { m.dmg += amt; m.hits++; if (o?.crit) m.crits++; } return dd.apply(this, arguments); };
  try {
    const idx = sable.skills.findIndex((s) => s.id === 'step');
    let on = 0;
    sable.command = { type: 'attack', target: dummies[on] };
    const frames = Math.round(secs * 60 / sc.speed); // game seconds, whatever the speed setting
    for (let f = 0; f < frames; f++) {
      if (sable.skills[idx].t <= 0 && sable.canAct()) { on = 1 - on; if (sable.useSkill(idx, dummies[on])) m.steps++; }
      if (!sable.command || sable.command.type !== 'attack') sable.command = { type: 'attack', target: dummies[on] };
      await step(1);
    }
  } finally { sc.dealDamage = dd; Math.random = realRandom; for (const e of dummies) { e.alive = false; e.destroy(); } sc.enemies = sc.enemies.filter((e) => e.alive); }
  return { dps: +(m.dmg / secs).toFixed(1), hits: m.hits, crits: m.crits, steps: m.steps, errs: (window.__errs || []).slice(0, 2) };
}
