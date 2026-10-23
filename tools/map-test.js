// Integration tests on test maps (dev only), away from Aldermere. In a
// running dev game (any page, even the title):
//   const T = await import('/tools/map-test.js'); await T.runAll()   // or T.run('pack-fight')
// Each test boots a small map from src/data/maps with a ready-made party,
// plays it out by stepping the game, and checks the result. Nothing touches
// a save: test maps never save. Returns { name, pass, checks, errors } each.
import { step } from './goto.js';
import { boot } from './dungeon-walk.js';

const loopErrors = [];
const origError = console.error;
console.error = (...a) => { if (String(a[0]).startsWith('[loop]')) loopErrors.push(String(a[1]?.message || a[1] || a[0])); origError(...a); };

async function start(map, { level = 6 } = {}) {
  const { newState } = await import('/src/game/state.js');
  const { mapDef } = await import('/src/world/content.js');
  const d = mapDef(map);
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  for (const h of st.recruited) st.heroes[h].level = level;
  st.map = map;
  st.pos = { x: (d.at[0] + d.start[0]) * 16 + 8, y: (d.at[1] + d.start[1]) * 16 + 8 };
  const before = localStorage.getItem('ninthTower.save.v1');
  window.__loadT0 = performance.now(); // load timings count from here (the title screen sets it in the game)
  const sc = await boot({ state: st });
  return { sc, d, savedBefore: before };
}
const rectOf = (d) => ({ x0: d.at[0], y0: d.at[1], x1: d.at[0] + d.rows[0].length - 1, y1: d.at[1] + d.rows.length - 1 });
const inside = (r, x, y) => x / 16 >= r.x0 - 1 && x / 16 <= r.x1 + 1 && y / 16 >= r.y0 - 1 && y / 16 <= r.y1 + 1;

export const TESTS = {
  // every test map's file is sound: even rows, inside the overworld, things placed on it
  'maps-valid': async () => {
    const { mapIds, mapDef } = await import('/src/world/content.js');
    const { OW_W, MAP_H } = await import('/src/world/map.js');
    const out = {};
    for (const id of mapIds()) {
      const d = mapDef(id), w = d.rows[0].length, h = d.rows.length;
      const onMap = ([x, y]) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
      out[`${id}: rows all ${w} wide`] = d.rows.every((r) => r.length === w);
      out[`${id}: fits in the overworld`] = d.at[0] >= 0 && d.at[1] >= 0 && d.at[0] + w <= OW_W && d.at[1] + h <= MAP_H;
      out[`${id}: start inside, on open ground`] = onMap(d.start) && !'#~wTboOl'.includes(d.rows[d.start[1]][d.start[0]]);
      const things = Object.values(d.content || {}).flat().flatMap((e) => (e.units ? e.units.map(([, x, y]) => [x, y]) : typeof e.x === 'number' ? [[e.x, e.y]] : []));
      out[`${id}: everything placed inside it`] = things.every(onMap);
    }
    return out;
  },
  // the arena loads with nothing of Aldermere's in it, and never saves
  'arena-isolated': async () => {
    const { sc, d, savedBefore } = await start('arena');
    const r = rectOf(d);
    await step(120);
    sc.autosave('test');
    return {
      'on the test map': sc.state.map === 'arena',
      'only its own things to tap': sc.interactables.every((o) => inside(r, o.x, o.y)),
      'no foes, NPCs, townsfolk or packs': !sc.enemies.some((e) => e.alive) && !Object.keys(sc.quests.npcs).length && !sc.groups.length,
      'no dungeons': !Object.keys(sc.dungeons).length,
      'the save untouched': localStorage.getItem('ninthTower.save.v1') === savedBefore,
    };
  },
  // an authored pack on a test map is met, fought and beaten by the party's AI alone
  'pack-fight': async () => {
    const { sc } = await start('pack', { level: 8 });
    for (const h of sc.party) { h.maxHp *= 5; h.hp = h.maxHp; }
    const L = sc.leader, g = sc.groups[0];
    // walk the leader up to the pack; the fight takes it from there
    for (let i = 0; i < 20 && !g.units.length; i++) await step(10);
    const p = g.units[0];
    if (p) sc.tapWorld(p.x - 40, p.y);
    let engaged = false, t = 0;
    for (; t < 3600 && !(engaged && g.units.length && g.units.every((e) => !e.alive)); t += 20) {
      await step(20);
      if (!engaged && g.units.some((e) => e.alive && (e.engaged || e.target))) engaged = true;
      if (engaged && !sc.leader.target && !sc.leader.path?.length) { const e = g.units.find((x) => x.alive); if (e) sc.tapWorld(e.x, e.y - 6); }
    }
    return {
      'the pack spawned': g.units.length === 3,
      'it noticed the party': engaged,
      'the party beat it': g.units.length > 0 && g.units.every((e) => !e.alive),
      'nobody fell': sc.party.every((h) => !h.downed),
      [`took ${(t / 60).toFixed(1)} s of game time`]: true,
    };
  },
  // the Vast (world/vast.js): ten times Aldermere, generated; it loads, every
  // pack stands on open ground, every region is there, and nothing saves
  'vast-loads': async () => {
    const { sc, savedBefore } = await start('vast', { level: 12 });
    await step(120);
    sc.autosave('test');
    const lt = window.__loadTimes || {};
    const regions = new Set(sc.world.towns.map((t) => t.biome));
    const packsOk = sc.world.content.groups.every((g) => g.units.every(([, x, y]) => !sc.nav.isSolid(x, y)));
    return {
      'on the Vast': sc.state.map === 'vast' && lt.size === '608x1008',
      'ten times the packs (800+)': sc.groups.length >= 800,
      'every pack on open ground': packsOk,
      'villages in all seven regions': ['vale', 'meadow', 'marsh', 'gloam', 'cinder', 'frost', 'basin'].every((r) => regions.has(r)),
      'starts in Brightwater Vale': sc.region === 'vale',
      'the save untouched': localStorage.getItem('ninthTower.save.v1') === savedBefore,
      [`ready in ${((lt.ready || 0) / 1000).toFixed(1)} s (world ${lt.world} ms, already built if this page made it before; worker ${lt.worker} ms)`]: true,
    };
  },
};

export async function run(name) {
  loopErrors.length = 0;
  let checks = {}, errors = [];
  try { checks = await TESTS[name](); } catch (e) { errors.push(e.message); }
  errors.push(...loopErrors);
  return { name, pass: !errors.length && Object.values(checks).every(Boolean), checks, errors };
}
export async function runAll() { const out = []; for (const n of Object.keys(TESTS)) out.push(await run(n)); return out; }
