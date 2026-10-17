// Skill smoke test (dev only): every active skill and the ultimate of a hero,
// cast in a real fight against spawned foes.
//   reload first (it boots a fresh game), then
//   const H = await import('/tools/hero-skill-test.js'); await H.run('oake')
// Reports, per skill: did it cast, damage dealt to foes, healing/shields on
// the party, gadgets out, and any errors thrown. Pass { equip } to test uniques.
import { go, step } from './goto.js';
import skillData from '../src/data/skills.json';

export async function run(hero, { foes = ['goblin', 'goblin', 'archer', 'knight'], equip = {} } = {}) {
  const { newState } = await import('/src/game/state.js');
  const st = newState(hero);
  st.recruited = [hero, 'brann', 'pip']; st.active = [...st.recruited];
  Object.assign(st.heroes[hero].equip, equip); // e.g. { weapon: 'dawnhammer' } to test a unique's perk
  st.pos = { x: 24 * 16 + 8, y: 40 * 16 + 8 };
  const sc = await go(24, 40, { state: st, level: 12, clear: true });
  const h = sc.party.find((p) => p.def.id === hero);
  const ids = Object.entries(skillData).filter(([, v]) => v.hero === hero && v.cd).map(([k]) => k);
  const out = {};
  const errs0 = (window.__errs || []).length;
  for (const id of [...ids, 'ULT']) {
    for (const e of sc.enemies) if (e.alive && !e.boss) { e.alive = false; e.destroy(); }
    sc.enemies = sc.enemies.filter((e) => e.alive);
    for (const p of sc.party) { p.downed = false; p.hp = p.maxHp * 0.5; p.shield = 0; }
    const foesNow = foes.map((k, i) => sc.spawnEnemy(k, h.x + 50 + i * 12, h.y + (i % 2 ? 20 : -20), true));
    await step(10);
    const hp0 = foesNow.reduce((a, e) => a + e.hp, 0), php0 = sc.party.reduce((a, p) => a + p.hp + (p.shield || 0), 0);
    const g0 = (sc.gadgets || []).length;
    let cast;
    try {
      if (id === 'ULT') { h.ult = 100; cast = sc.useUltimate(h); } else {
        if (id === 'overcharge') { h.skills[1] = { id: 'turret', ...skillData.turret, t: 0, rank: 1 }; h.useSkill(1, foesNow[0]); await step(45); } // needs a gadget out
        h.skills[0] = { id, ...skillData[id], t: 0, rank: 1 };
        cast = h.useSkill(0, foesNow[0]);
      }
    } catch (err) { cast = 'THREW ' + err.message; }
    let gMax = 0;
    for (let f = 0; f < 150; f++) { await step(1); gMax = Math.max(gMax, (sc.gadgets || []).filter((g) => g.alive !== false).length); }
    const hp1 = foesNow.reduce((a, e) => a + Math.max(0, e.alive ? e.hp : 0), 0), php1 = sc.party.reduce((a, p) => a + p.hp + (p.shield || 0), 0);
    out[id] = { cast, foeDmg: Math.round(hp0 - hp1), partyGain: Math.round(php1 - php0), gadgets: gMax - g0 };
    for (const g of sc.gadgets || []) g.expire?.();
  }
  out.errs = (window.__errs || []).slice(errs0, errs0 + 5);
  return out;
}
