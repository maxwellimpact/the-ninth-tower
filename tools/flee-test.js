// Morale test (dev only). In a Dungeon Lab session:
//   const M = await import('/tools/flee-test.js'); await M.run(12)
// Packs of small fry (4 goblins, rats, hexling) at 2.5x health fight the lab
// party in the open hall; counts how many break and run, and whether a last
// survivor ever flees. Foes get extra health so more of them pass through the
// low-health window where morale is checked.
const step = async (n = 1) => { const g = window.__game; let t = g.loop.now; for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

export async function run(trials = 12) {
  const sc = window.__scene, O = sc.dungeon.def.origin, T = (lx, ly) => ({ x: (O[0] + lx) * 16 + 8, y: (O[1] + ly) * 16 + 8 });
  let fry = 0, fled = 0, lastStanding = 0, low = 0;
  for (let k = 0; k < trials; k++) {
    for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
    sc.enemies = [];
    const P = T(37, 47), F = T(37, 40);
    sc.party.forEach((h, i) => { h.x = P.x + (i - 1) * 14; h.y = P.y; h.downed = false; h.hp = h.maxHp; h.command = null; h.target = null; h.action = null; h.clearPath(); });
    const kinds = ['goblin', 'goblin', 'goblin', 'goblin', 'rats', 'hexling'];
    const foes = kinds.map((kd, i) => { const a = Math.PI + (i + 0.5) / kinds.length * Math.PI; const e = sc.spawnEnemy(kd, F.x + Math.cos(a) * 60, F.y + Math.sin(a) * 26, true); e.maxHp *= 2.5; e.hp = e.maxHp; e.aggroOn(sc.leader, false); return e; });
    fry += foes.length;
    const seen = new Set(), wasLow = new Set();
    for (let f = 0; f < 60 * 25 && foes.some((e) => e.alive); f++) {
      const L = sc.leader;
      if (!L.command || !L.command.target?.alive) { const t = sc.nearestEnemy(L, 400); if (t) L.command = { type: 'attack', target: t }; }
      for (const h of sc.party) { if (h.downed) h.revive?.(1); h.hp = Math.max(h.hp, h.maxHp * 0.5); }
      await step(1);
      for (const e of foes) if (e.alive && e.hp < e.maxHp * 0.25 && !wasLow.has(e)) { wasLow.add(e); low++; }
      for (const e of foes) if (e.alive && e.state === 'flee' && !seen.has(e)) { seen.add(e); fled++; if (foes.filter((o) => o.alive).length === 1) lastStanding++; }
    }
  }
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  return { fry, reachedLowHp: low, fled, pct: +(fled / fry * 100).toFixed(1), pctOfLow: +(fled / Math.max(1, low) * 100).toFixed(1), lastStanding };
}
