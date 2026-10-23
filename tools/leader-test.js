// Idle leader test (dev only). In a running dev game (any page):
//   const T = await import('/tools/leader-test.js'); await T.run()
// On the `pack` test map, for a melee leader (Brann) and a ranged one (Pip):
// walk up short of the goblin pack, then give no orders while the companions
// start the fight (only the leader's own step-ins are allowed through). The
// leader should keep up their basic attack: a ranged one without moving, a
// melee one stepping in a couple of tiles at most, and neither using a skill.
// Then a foe in the fight is carried 8 tiles off: an idle leader must not
// follow it. Returns per leader: swings, skills, how far they moved, the
// furthest a step-in took them, whether the pack fell, whether they chased.
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
    let t = 0, maxOff = 0;
    for (; t < 1200; t += 10) {
      await step(10);
      if (L.command && !L.command.auto) L.command = null; // no orders: what the leader does now is their own idea
      maxOff = Math.max(maxOff, Math.hypot(L.x - x0, L.y - y0));
      if (g.units.length && g.units.every((e) => !e.alive)) break;
    }
    delete L.startAttack; delete L.useSkill;
    // a foe in the fight, set down 8 tiles off: the leader stays where they are
    const e = sc.spawnEnemy('goblin', L.x + 128, L.y, true);
    e.update = () => {}; // (holds still, so only the leader could close the gap)
    const ax = L.x, ay = L.y;
    for (let i = 0; i < 60; i++) { await step(2); if (L.command && !L.command.auto) L.command = null; }
    const chased = Math.round(Math.hypot(L.x - ax, L.y - ay));
    e.alive = false; e.destroy();
    out[lead] = { swings, skills, moved: Math.round(Math.hypot(L.x - x0, L.y - y0)), furthest: Math.round(maxOff), packBeaten: g.units.every((x) => !x.alive), secs: +(t / 60).toFixed(1), chasedFarFoe: chased };
  }
  out.pass = leaders.every((l) => out[l].swings > 0 && out[l].skills === 0 && out[l].chasedFarFoe < 8);
  out.errs = (window.__errs || []).slice(0, 3);
  return out;
}
