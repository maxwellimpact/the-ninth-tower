// Integration tests on test maps (dev only), away from Aldermere. In a
// running dev game (any page, even the title):
//   const T = await import('/tools/map-test.js'); await T.runAll()   // or T.run('pack-fight')
// Each test boots a small map from src/data/maps with a ready-made party,
// plays it out by stepping the game, and checks the result. Most test maps
// never save; the save tests (own-save, shared-world, old-save, colosseum)
// put the page's saves back as they found them. Returns { name, pass, checks,
// errors } each.
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
// Run fn with the page's saves set aside, and put them back after, whatever happens.
async function withSaves(fn) {
  const keep = Object.keys(localStorage).filter((k) => k.startsWith('ninthTower.save')).map((k) => [k, localStorage.getItem(k)]);
  for (const [k] of keep) localStorage.removeItem(k);
  try { return await fn(); } finally {
    for (const k of Object.keys(localStorage)) if (k.startsWith('ninthTower.save')) localStorage.removeItem(k);
    for (const [k, v] of keep) localStorage.setItem(k, v);
  }
}
// a main-game save to test with: Aldermere progress, the Frog King's blessing, some gold
async function mainSave() {
  const S = await import('/src/game/state.js');
  const st = S.newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  for (const h of st.recruited) st.heroes[h].level = 8;
  Object.assign(st.flags, { chest_plateau: true, ward_marsh: true, blessing: true });
  st.gold = 100; st.flies = [3, 7]; st.pos = { x: 15 * 16 + 8, y: 37 * 16 + 8 };
  S.saveState(st);
  return S;
}
const waitFor = async (ok, frames = 600) => { for (let i = 0; i < frames && !ok(); i += 10) await step(10); return ok(); };
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
  // a map with a save of its own (trial): a fresh party of its own, saved
  // under its own key only, and CLEAR wipes only that
  'own-save': async () => withSaves(async () => {
    const S = await mainSave();
    const main = localStorage.getItem(S.SAVE_KEY), key = S.ownSaveKey('trial');
    const st = (await import('/src/scenes/Title.js')).ownStart('trial'); // what the title builds on a first visit
    const sc = await boot({ state: st });
    await step(60);
    sc.state.gold = 77;
    sc.autosave('test');
    const own = S.loadState(key);
    const out = {
      'a fresh party (level 1, its own)': sc.party.every((h) => h.level === 1) && sc.state.recruited.length === 3,
      'saved under its own key': own?.gold === 77 && own.map === 'trial',
      'the main save untouched': localStorage.getItem(S.SAVE_KEY) === main,
      'listed as a map with its own save': (await import('/src/world/content.js')).ownMapIds().includes('trial'),
    };
    S.clearSave(key);
    out['CLEAR removes it'] = !localStorage.getItem(key);
    out['CLEAR leaves the main save'] = localStorage.getItem(S.SAVE_KEY) === main;
    return out;
  }),
  // the 40x Vast (dense) keeps its own save too: a fresh party with the Vast's
  // kit, saved under its own key; and how long a save of a map that big takes
  'vast-save': async () => withSaves(async () => {
    const S = await mainSave();
    const main = localStorage.getItem(S.SAVE_KEY), key = S.ownSaveKey('vast40d');
    const st = (await import('/src/scenes/Title.js')).ownStart('vast40d');
    const sc = await boot({ state: st });
    await step(60);
    const t0 = performance.now();
    sc.autosave('test');
    const ms = Math.round(performance.now() - t0), raw = localStorage.getItem(key) || '';
    const own = S.loadState(key), plain = (await import('/src/world/content.js')).mapDef('vast40');
    const out = {
      'on the dense 40x Vast': sc.state.map === 'vast40d',
      'a fresh party (level 1)': sc.party.every((h) => h.level === 1) && sc.party.length === 3,
      'salves and tonics for the heat and cold': st.potions.salve === 4 && st.potions.tonic === 4,
      'blight left down (dense), land freed on the plain one': !st.flags.wardBroken && !!plain.kit.flags.wardBroken,
      'saved under its own key': own?.map === 'vast40d',
      'the main save untouched': localStorage.getItem(S.SAVE_KEY) === main,
      'listed with the saved maps': (await import('/src/world/content.js')).ownMapIds().includes('vast40d'),
      'the 10x Vast still never saves': (await import('/src/world/content.js')).saveMode('vast') === 'none',
      [`a save takes ${ms} ms and ${Math.round(raw.length / 1024)} KB`]: ms < 100 && raw.length < 64 * 1024,
    };
    // the explored map, saved as runs: it reads back exactly, and an old save's
    // bit per tile still reads
    const M = await import('/src/world/map.js');
    const mm = sc.minimap, n = mm.explored.length, keep = mm.explored.slice();
    for (let k = 0; k < 40; k++) { const cx = Math.floor(Math.random() * (M.MAP_W - 80)), cy = Math.floor(Math.random() * (M.MAP_H - 60)); for (let y = cy; y < cy + 60; y++) for (let x = cx; x < cx + 80; x++) mm.explored[y * M.MAP_W + x] = 1; }
    const runs = mm.serialize(), back = mm.decode(runs);
    const bytes = new Uint8Array(Math.ceil(n / 8)); for (let i = 0; i < n; i++) if (mm.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
    let b = ''; for (const x of bytes) b += String.fromCharCode(x);
    const old = mm.decode(btoa(b));
    const same = (a) => { for (let i = 0; i < n; i++) if (a[i] !== mm.explored[i]) return false; return true; };
    out[`explored map as runs reads back exactly (${Math.round(runs.length / 1024)} KB with 40 patches seen)`] = same(back);
    out['an old bit-per-tile save still reads'] = same(old);
    mm.explored.set(keep);
    S.clearSave(key);
    return out;
  }),
  // a shared map (the Colosseum) carries the party both ways, keeps its own
  // world's progress apart, and can read Aldermere's
  'shared-world': async () => withSaves(async () => {
    const S = await mainSave();
    const save = S.loadState();
    S.switchWorld(save, 'colosseum');
    const { mapDef } = await import('/src/world/content.js');
    const d = mapDef('colosseum');
    save.pos = { x: (d.at[0] + d.start[0]) * 16 + 8, y: (d.at[1] + d.start[1]) * 16 + 8 };
    let sc = await boot({ state: save });
    const there = {
      'in the Colosseum': sc.state.map === 'colosseum' && !!sc.colosseum,
      'none of Aldermere\'s flags there': !sc.flags.chest_plateau && !sc.flags.ward_marsh,
      'the blessing came along (the party\'s)': !!sc.flags.blessing,
      'can read Aldermere\'s flies': S.worldOf(sc.state, 'aldermere')?.flies?.length === 2,
    };
    sc.state.gold += 50;
    sc.flags.arenaBest = 3;
    sc.goToWorld(null);
    const was = sc.state;
    await waitFor(() => sc.state !== was && !sc.travelling && !sc.busy, 1200); // (the same scene, restarted in Aldermere)
    sc = window.__scene;
    const disk = JSON.parse(localStorage.getItem(S.SAVE_KEY));
    return {
      ...there,
      'back in Aldermere': sc.state.map == null && !sc.state.world,
      'gold earned there came home': sc.state.gold === 150,
      'Aldermere\'s flags are back': sc.flags.chest_plateau && sc.flags.ward_marsh,
      'the Colosseum\'s best stays in its world': !sc.flags.arenaBest && S.worldOf(sc.state, 'colosseum')?.flags.arenaBest === 3,
      'back where the party left Aldermere': Math.abs(sc.leader.x - (15 * 16 + 8)) < 40,
      'on disk: Aldermere at the top, the Colosseum under worlds': disk.flags.chest_plateau && disk.worlds?.colosseum?.flags?.arenaBest === 3 && !disk.world,
    };
  }),
  // a save from before worlds loads as it was, and the first save keeps a backup of it
  'old-save': async () => withSaves(async () => {
    const S = await import('/src/game/state.js');
    const st = S.newState('pip');
    st.flags.chest_plateau = true; st.gold = 321; st.pos = { x: 500, y: 600 }; st.lore = ['a'];
    delete st.worlds;
    const old = JSON.stringify(st);
    localStorage.setItem(S.SAVE_KEY, old);
    const loaded = S.loadState();
    S.saveState(loaded);
    const after = JSON.parse(localStorage.getItem(S.SAVE_KEY)), o = JSON.parse(old);
    return {
      'it loads': !!loaded && loaded.leader === 'pip',
      'nothing moved: flags, gold, place, lore, heroes': JSON.stringify([after.flags, after.gold, after.pos, after.lore, after.heroes]) === JSON.stringify([o.flags, o.gold, o.pos, o.lore, o.heroes]),
      'still version 1 (older builds still read it)': after.version === 1 && !after.worlds && !after.world,
      'a backup of the old save': localStorage.getItem(`${S.SAVE_KEY}.bak`) === old,
    };
  }),
  // the Colosseum: waves climb their own ladder, clearing one saves the
  // party's gains, and falling ends the run without costing gold
  colosseum: async () => withSaves(async () => {
    const S = await mainSave();
    const save = S.loadState();
    S.switchWorld(save, 'colosseum');
    const { mapDef } = await import('/src/world/content.js');
    const d = mapDef('colosseum');
    save.pos = { x: (d.at[0] + d.start[0]) * 16 + 8, y: (d.at[1] + d.start[1]) * 16 + 8 };
    const sc = await boot({ state: save });
    for (const h of sc.party) { h.maxHp *= 20; h.hp = h.maxHp; }
    const C = sc.colosseum;
    await waitFor(() => C.wave === 1 && C.foes.length);
    const w1 = C.foes.map((e) => e.level);
    // the party fights it out on its own; the leader is pointed at whoever is left
    const fight = async (until) => { for (let t = 0; t < 4800 && !until(); t += 20) { await step(20); if (!sc.leader.target && !sc.leader.path?.length) { const e = C.foes.find((x) => x.alive); if (e) sc.tapWorld(e.x, e.y - 6); } } return until(); };
    const cleared = await fight(() => C.wave === 2 && C.foes.length);
    const w2 = C.foes.map((e) => e.level);
    const disk = JSON.parse(localStorage.getItem(S.SAVE_KEY));
    const gold = sc.state.gold;
    sc.flags.arenaBest = 12; // as if an earlier run had reached wave 12: the next starts at half that
    for (const h of sc.party) { h.hp = 0; h.downed = true; }
    sc.wipe();
    const restarted = await waitFor(() => C.wave === 6 && C.foes.length && !sc.busy, 900);
    const w6 = C.foes.map((e) => e.level);
    return {
      'wave 1 at level 1': w1.length >= 2 && w1.every((l) => l === 1),
      'the party cleared it': cleared,
      'wave 2 at level 2': w2.every((l) => l === 2) && w2.length >= w1.length,
      'the best run is kept in the Colosseum\'s world': disk.worlds?.colosseum?.flags?.arenaBest >= 1 && !disk.flags.arenaBest,
      'the party\'s XP saved to the main game': disk.heroes.brann.xp > 0 || disk.heroes.brann.level > 8,
      'falling costs no gold': sc.state.gold === gold,
      'with a best of 12, the next run starts at wave 6, level 6': restarted && w6.every((l) => l === 6 || l === 8), // (elites sit 2 up)
      'Aldermere untouched on disk': disk.flags.chest_plateau && disk.flags.ward_marsh,
    };
  }),
};

export async function run(name) {
  loopErrors.length = 0;
  let checks = {}, errors = [];
  try { checks = await TESTS[name](); } catch (e) { errors.push(e.message); }
  errors.push(...loopErrors);
  return { name, pass: !errors.length && Object.values(checks).every(Boolean), checks, errors };
}
export async function runAll() { const out = []; for (const n of Object.keys(TESTS)) out.push(await run(n)); return out; }
