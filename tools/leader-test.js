// Idle leader test (dev only). In a running dev game (any page):
//   const T = await import('/tools/leader-test.js'); await T.run()
// On the `pack` test map, for a melee leader (Brann) and a ranged one (Pip):
// walk up short of the goblin pack, then give no orders at all (any order the
// game sets is cleared each step) while the companions start the fight. The
// leader should keep up their basic attack on foes in reach without walking
// off after them, and never use a skill. Returns per leader: swings, skills,
// how far they moved, whether the pack fell.
import { step } from './goto.js';
import { boot } from './dungeon-walk.js';

export async function run(leaders = ['brann', 'pip']) {
  const { newState } = await import('/src/game/state.js');
  const { mapDef } = await import('/src/world/content.js');
  const out = {};
  for (const lead of leaders) {
    const d = mapDef('pack'), st = newState(lead);
    st.recruited = ['brann', 'pip', 'sable']; st.active = [lead, ...st.recruited.filter((h) => h !== lead)];
    for (const h of st.recruited) st.heroes[h].level = 8;
    st.map = 'pack'; st.pos = { x: (d.at[0] + d.start[0]) * 16 + 8, y: (d.at[1] + d.start[1]) * 16 + 8 };
    const sc = await boot({ state: st });
    for (const h of sc.party) { h.maxHp *= 5; h.hp = h.maxHp; }
    const L = sc.leader, g = sc.groups[0];
    for (let i = 0; i < 20 && !g.units.length; i++) await step(10);
    const p = g.units[0];
    sc.tapWorld(p.x - (L.ranged ? 70 : 26), p.y);
    for (let i = 0; i < 300 && (L.command || L.path?.length); i++) await step(2);
    L.command = null; L.clearPath?.();
    const x0 = L.x, y0 = L.y;
    let swings = 0, skills = 0;
    const sa = L.startAttack.bind(L), us = L.useSkill.bind(L);
    L.startAttack = (t) => { const ok = sa(t); if (ok) swings++; return ok; };
    L.useSkill = (...a) => { skills++; return us(...a); };
    let t = 0;
    for (; t < 1200; t += 10) {
      await step(10);
      if (L.command) L.command = null; // no orders: what the leader does now is their own idea
      if (g.units.length && g.units.every((e) => !e.alive)) break;
    }
    delete L.startAttack; delete L.useSkill;
    out[lead] = { swings, skills, moved: Math.round(Math.hypot(L.x - x0, L.y - y0)), packBeaten: g.units.every((e) => !e.alive), secs: +(t / 60).toFixed(1) };
  }
  out.pass = leaders.every((l) => out[l].swings > 0 && out[l].skills === 0);
  out.errs = (window.__errs || []).slice(0, 3);
  return out;
}
