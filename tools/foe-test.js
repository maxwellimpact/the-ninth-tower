// New-foe check (dev only). In a running game (after goto.js has booted one):
//   const F = await import('/tools/foe-test.js'); await F.run(['frostwolf', 'brute'], { at: [46, 240], n: 2, runs: 3 })
// For each kind: clears the area, heals the party, spawns `n` of it already
// engaged beside the party, lets the fight play out (up to `max` seconds),
// and reports the average time to kill, the party's health left (%) and
// wipes over `runs` tries. Compare a new foe against an existing one of the
// same weight class at the same party level.
import { go, step } from './goto.js';

export async function run(kinds, { at = [46, 240], n = 2, runs = 3, max = 25 } = {}) {
  const sc = () => window.__scene;
  const out = {};
  for (const k of kinds) {
    const r = { kill: [], hp: [], wipes: 0, timeouts: 0 };
    for (let i = 0; i < runs; i++) {
      await go(at[0], at[1], { clear: true });
      const s = sc();
      for (const e of s.enemies) if (e.alive) { e.alive = false; e.clearZone?.(); e.destroy(); }
      s.enemies = [];
      for (const h of s.party) { if (h.downed) h.revive?.(1); h.hp = h.maxHp; }
      const L = s.leader;
      const es = [];
      for (let j = 0; j < n; j++) es.push(s.spawnEnemy(k, L.x + 56 + j * 10, L.y - 20 + j * 30, true));
      let t = 0;
      for (; t < max * 60 && es.some((e) => e.alive); t += 10) {
        await step(10);
        if (s.party.every((h) => h.downed || !h.alive)) { r.wipes++; break; }
      }
      if (es.some((e) => e.alive) && !s.party.every((h) => h.downed || !h.alive)) r.timeouts++;
      if (!es.some((e) => e.alive)) r.kill.push((t * 16) / 1000);
      r.hp.push(Math.round((100 * s.party.reduce((a, h) => a + (h.downed ? 0 : h.hp), 0)) / s.party.reduce((a, h) => a + h.maxHp, 0)));
    }
    const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
    out[k] = { killSecs: avg(r.kill), partyHpLeft: avg(r.hp), wipes: r.wipes, timeouts: r.timeouts, level: sc().enemyLevel(sc().leader.x, sc().leader.y) };
  }
  return out;
}
