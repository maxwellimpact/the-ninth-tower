// The Vast: a generated world for profiling, Aldermere's layout blown up.
//
// Ten times Aldermere's overworld by area (about 608 x 1008 tiles; `vast40`
// is forty times, and so on), laid out like Aldermere: Brightwater Vale in the
// north-west and Highmeadow north-east, Mistfen across the middle, Gloamwood
// and Cinderreach below it either side of the ridge, Frosthelm and the Blight
// Basin in the far south. The region borders are Aldermere's own meandering
// edges, scaled up, with the same fraying where regions meet.
//
// Each region gets its own ground, water and scenery (the same props and
// thresholds as Aldermere's builder), villages of cottages joined by roads
// (bridges where they cross rivers or lava), and its own foes, chests,
// gathering nodes, campfires and lookouts, at Aldermere's densities. There
// are no errands, people or Ward Stones: it's for measuring load times and
// frame rates on a big map, not for playing the story.
//
// Everything comes from hash/noise of the tile position, so the main thread
// and the terrain worker build the identical world. Nothing is saved.
import { hash, vnoise } from '../gfx/pixel.js';
import { T, SOLID, marshEdge, southEdge, meadowEdge, ridgeAt, frostEdge, basinEdge } from './map.js';
import WORLD from '../data/world.json';
import QUESTS from '../data/quests.json';

const REG = ['vale', 'meadow', 'marsh', 'gloam', 'cinder', 'frost', 'basin'];
const REGIONS = [
  { id: 'vale', name: 'BRIGHTWATER VALE', band: [1, 8] },
  { id: 'meadow', name: 'HIGHMEADOW', band: [3, 10] },
  { id: 'marsh', name: 'MISTFEN', band: [6, 14] },
  { id: 'gloam', name: 'GLOAMWOOD', band: [10, 18] },
  { id: 'cinder', name: 'CINDERREACH', band: [12, 20] },
  { id: 'frost', name: 'FROSTHELM', band: [16, 24] },
  { id: 'basin', name: 'THE BLIGHT BASIN', band: [22, 30] },
];
// what lives where: Aldermere's own packs, nodes and chest materials, counted by region
const FOES = {
  vale: { goblin: 7, hexling: 10, archer: 4, boar: 3, crab: 6 },
  meadow: { hexling: 9, goblin: 18, archer: 8, knight: 3, boar: 4, wisp: 4, warlock: 2 },
  marsh: { mire: 22, goblin: 4, archer: 4, knight: 2, leeches: 5, drowned: 7, croaker: 3, witchling: 3 },
  gloam: { hound: 7, rootling: 6, spider: 5, shade: 7, banshee: 4, spiderling: 2, goblin: 2, archer: 1, warlock: 1 },
  cinder: { imp: 8, salamander: 7, slug: 3, beetle: 6, brute: 2, goblin: 2, archer: 1, warlock: 1 },
  frost: { frostwolf: 18, raider: 5, rimehorn: 5, icewraith: 6, sentinel: 4 },
  basin: { hexling: 5, goblin: 3, archer: 3, knight: 2, voidling: 4, wisp: 1, gargoyle: 3, chainwarden: 2, warlock: 1 },
};
const NODES = {
  vale: { herb: 4, ore: 1 }, meadow: { ore: 5, crystal: 5, herb: 4 }, marsh: { herb: 10, bogmoss: 6, silver: 4 },
  gloam: { ghostcap: 7, herb: 2 }, cinder: { brimstone: 7, silver: 3 }, frost: { rimeglass: 7, herb: 4 }, basin: { starmetal: 4 },
};
const MATS = {
  vale: ['crystal', 'herb'], meadow: ['crystal', 'ore', 'herb', 'gel'], marsh: ['herb', 'pearl'], gloam: ['silk', 'ghostcap', 'heartwood'],
  cinder: ['brimstone', 'silver'], frost: ['rimeglass', 'pelt', 'silver'], basin: ['starmetal', 'crystal'],
};
const GOLD = { vale: [80, 120], meadow: [90, 150], marsh: [60, 90], gloam: [60, 90], cinder: [60, 90], frost: [60, 90], basin: [120, 200] };
const GROUND = { vale: T.GRASS, meadow: T.GRASS, marsh: T.MARSH, gloam: T.LOAM, cinder: T.ASH, frost: T.SNOW, basin: T.BLIGHT };
const NAMES = {
  vale: [['BRIGHT', 'MILL', 'OAK', 'WILLOW', 'HAY', 'ASHEN', 'DOVE', 'CLOVER'], ['WATER', 'FORD', 'STEAD', 'WICK', 'BROOK', 'HOLM']],
  meadow: [['HIGH', 'BARLEY', 'WIND', 'SHEP', 'LARK', 'GOLD'], ['FIELD', 'HILL', 'TON', 'LEA', 'CROFT', 'DOWN']],
  marsh: [['MIRE', 'SEDGE', 'FROG', 'MOSS', 'REED', 'MURK'], ['HOLLOW', 'FEN', 'POOL', 'WADE', 'MERE', 'BANK']],
  gloam: [['GLOAM', 'ROOT', 'BRAMBLE', 'NIGHT', 'FERN', 'OWL'], ['HOLLOW', 'GROVE', 'DELL', 'SHADE', 'WOOD', 'GLEN']],
  cinder: [['EMBER', 'ASH', 'CINDER', 'SLAG', 'FLINT', 'SMOKE'], ['WATCH', 'GATE', 'FORGE', 'REACH', 'CRAG', 'KILN']],
  frost: [['RIME', 'FROST', 'WOLF', 'PINE', 'SLEET', 'ICE'], ['WATCH', 'HOLD', 'FELL', 'CAMP', 'PEAK', 'MERE']],
  basin: [['HEX', 'GRIEF', 'HOLLOW', 'GREY', 'SILENT', 'LAST'], ['RUIN', 'STONES', 'END', 'REST', 'MARCH', 'WARD']],
};
// cottage art (all three tiles wide, footprint x-1..x+1, y-2..y) and where
// a village's cottages stand around its square (doors face south)
const COTTAGES = ['shop', 'tavern', 'curio', 'bath', 'mayor'];
const LOTS = [[-5, -2], [5, -2], [0, -5], [-10, -1], [10, -1], [-5, 7], [5, 7]];

const pickW = (w, r) => { const e = Object.entries(w), tot = e.reduce((a, [, n]) => a + n, 0); let t = r * tot; for (const [k, n] of e) if ((t -= n) < 0) return k; return e[0][0]; };
const fray = (x, y, seed) => (vnoise(x / 5, y / 5, seed) - 0.5) * 9 + (vnoise(x / 2.5, y / 2.5, seed + 50) - 0.5) * 4;

const DEFS = {};
// mapDef('vast') is ten times Aldermere's overworld; 'vast40' forty times.
// A 'd' on the end ('vast40d') adds Aldermere's people and collectibles at
// Aldermere's density (golden flies, shrines, cursed townsfolk, errand-style
// people) and leaves the blight down, to see how the main game's kind of
// content scales on a big map.
export function vastDef(id) {
  const m = /^vast(\d+)?(d)?$/.exec(id || '');
  if (!m) return null;
  if (DEFS[id]) return DEFS[id];
  const mult = Math.max(1, Math.min(100, +(m[1] || 10))), dense = !!m[2];
  const k = Math.sqrt(mult);
  const W = Math.round((192 * k) / 8) * 8, H = Math.round((320 * k) / 8) * 8;
  const home = [Math.round(15 * k), Math.round(37 * k)]; // where Brightwater would be: the first village, and the start
  let built = null;

  // --- regions: Aldermere's borders at Aldermere scale, frayed at this one.
  // The borders run along rows or columns, so they're worked out once per
  // row and column; the fraying is only looked up near a border.
  const colMarsh = new Float32Array(W), colSouth = new Float32Array(W), colFrost = new Float32Array(W);
  for (let x = 0; x < W; x++) { colMarsh[x] = marshEdge(x / k) * k; colSouth[x] = southEdge(x / k) * k; colFrost[x] = frostEdge(x / k) * k; }
  const rowMeadow = new Float32Array(H), rowRidge = new Float32Array(H), rowBasin = new Float32Array(H);
  for (let y = 0; y < H; y++) { rowMeadow[y] = meadowEdge(y / k) * k; rowRidge[y] = ridgeAt(y / k) * k; rowBasin[y] = basinEdge(y / k) * k; }
  const near = (v, edge) => Math.abs(v - edge) < 9;
  function rawBiome(x, y) {
    const f = (e, s) => (near(x, e) || near(y, e) ? fray(x, y, s) : 0);
    if (y > colFrost[x] + (near(y, colFrost[x]) ? fray(x, y, 809) * 0.6 : 0)) return x < rowBasin[y] + f(rowBasin[y], 810) ? 'frost' : 'basin';
    if (y >= colSouth[x] + (near(y, colSouth[x]) ? fray(x, y, 805) : 0)) return x < rowRidge[y] + 2 + f(rowRidge[y], 806) ? 'gloam' : 'cinder';
    if (y >= colMarsh[x] + (near(y, colMarsh[x]) ? fray(x, y, 807) : 0)) return 'marsh';
    return x >= rowMeadow[y] + f(rowMeadow[y], 808) ? 'meadow' : 'vale';
  }
  const biome = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 'vale';
    return built ? REG[built.bio[y * W + x]] : rawBiome(x, y);
  };

  function build() {
    if (built) return built;
    const t0 = performance.now();
    const N = W * H;
    const bio = new Uint8Array(N), tiles = new Uint8Array(N);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.CAVEWALL : tiles[y * W + x]);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t; };
    const B = (x, y) => REG[bio[y * W + x]];
    const ms = {};

    // ground, lakes, pools, lava and lake ice, region by region
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = rawBiome(x, y), i = y * W + x;
      bio[i] = REG.indexOf(b);
      let t = GROUND[b];
      if (b === 'vale' || b === 'meadow') { const n = vnoise(x / 40, y / 40, 901); t = n > 0.74 ? T.WATER : n > 0.71 ? T.SAND : t; }
      else if (b === 'marsh') { const n = vnoise(x / 14, y / 14, 902); t = n > 0.7 ? T.WATER : n > 0.6 ? T.SHALLOW : vnoise(x / 9, y / 9, 903) > 0.74 ? T.BOG : t; }
      else if (b === 'gloam') { if (vnoise(x / 20, y / 20, 904) > 0.68) t = T.GRASS; else if (vnoise(x / 26, y / 26, 911) > 0.8) t = T.WATER; }
      else if (b === 'cinder') { if (vnoise(x / 22, y / 22, 906) > 0.77) t = T.LAVA; else if (vnoise(x / 16, y / 16, 905) > 0.62) t = T.BASALT; }
      else if (b === 'frost') { const n = vnoise(x / 30, y / 30, 907); t = n > 0.82 ? T.WATER : n > 0.68 ? T.ICE : t; }
      else if (b === 'basin') { if (vnoise(x / 12, y / 12, 908) > 0.82) t = T.CHASM; }
      tiles[i] = t;
    }
    built = { bio }; // region lookups read the table from here on
    ms.ground = performance.now() - t0;

    // rivers run south from the northern edge to the escarpment: water, lava in
    // Cinderreach, frozen in Frosthelm; a shallow ford every so often
    const rivers = Math.max(2, Math.round(W / 220));
    for (let r = 0; r < rivers; r++) {
      const x0 = W * ((r + 0.6) / (rivers + 0.2));
      for (let y = 0; y < H; y++) {
        const cx = x0 + Math.sin(y / 31 + r) * 9 + (vnoise(0.5, y / 60, 930 + r) - 0.5) * 80;
        const b = B(Math.max(0, Math.min(W - 1, Math.round(cx))), y);
        if (b === 'basin') continue;
        const ford = (y + r * 37) % 90 < 4;
        const half = 1.4 + vnoise(0.5, y / 20, 940 + r) * 1.2;
        for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
          const d = Math.abs(x - cx);
          if (d > half + 1 || x < 1 || x >= W - 1) continue;
          const bank = d > half;
          if (b === 'cinder') { if (!bank) set(x, y, T.LAVA); }
          else if (b === 'frost') set(x, y, T.ICE);
          else if (ford || bank) set(x, y, b === 'marsh' || ford ? T.SHALLOW : T.SAND);
          else set(x, y, T.WATER);
        }
      }
    }

    // villages: one where Brightwater would be, then a jittered grid of them
    const towns = [];
    const S = 64;
    for (let gy = 0; gy < Math.ceil(H / S); gy++) for (let gx = 0; gx < Math.ceil(W / S); gx++) {
      const x = Math.round(gx * S + 16 + hash(gx, gy, 950) * (S - 32)), y = Math.round(gy * S + 16 + hash(gx, gy, 951) * (S - 32));
      if (x < 16 || y < 16 || x >= W - 16 || y >= H - 16 || hash(gx, gy, 952) > 0.42) continue;
      towns.push({ x, y });
    }
    towns.unshift({ x: home[0], y: home[1] });
    for (let i = towns.length - 1; i > 0; i--) if (towns.slice(0, i).some((o) => Math.hypot(o.x - towns[i].x, o.y - towns[i].y) < 40)) towns.splice(i, 1);
    for (const [i, tw] of towns.entries()) {
      const b = B(tw.x, tw.y);
      for (let y = tw.y - 11; y <= tw.y + 11; y++) for (let x = tw.x - 13; x <= tw.x + 13; x++) { // dry, open ground to build on
        if (Math.hypot((x - tw.x) / 13, (y - tw.y) / 11) <= 1 && (SOLID.has(at(x, y)) || at(x, y) === T.SHALLOW || at(x, y) === T.ICE)) set(x, y, GROUND[b]);
      }
      const [a, z] = NAMES[b];
      tw.name = `${a[Math.floor(hash(i, 1, 953) * a.length)]}${z[Math.floor(hash(i, 2, 953) * z.length)]}`;
      tw.biome = b;
    }

    // roads: every village joined to the network (a spanning tree), plus a
    // second road to its next nearest for loops; bridges over water and lava
    const edges = [], inTree = [0], left = towns.map((_, i) => i).slice(1);
    while (left.length) {
      let best = null;
      for (const a of inTree) for (const [j, b] of left.entries()) { const d = Math.hypot(towns[a].x - towns[b].x, towns[a].y - towns[b].y); if (!best || d < best[0]) best = [d, a, b, j]; }
      edges.push([best[1], best[2]]); inTree.push(best[2]); left.splice(best[3], 1);
    }
    for (const [i, tw] of towns.entries()) {
      const o = towns.map((u, j) => [Math.hypot(u.x - tw.x, u.y - tw.y), j]).filter(([, j]) => j !== i).sort((p, q) => p[0] - q[0]);
      for (const [d, j] of o.slice(0, 2)) if (d < 110 && !edges.some(([p, q]) => (p === i && q === j) || (p === j && q === i))) edges.push([i, j]);
    }
    const roadAt = new Uint8Array(N);
    const pave = (x, y) => {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return;
      const t = at(x, y);
      if (t === T.HOUSE) return;
      set(x, y, t === T.WATER || t === T.LAVA || t === T.CHASM ? T.BRIDGE : t === T.BRIDGE ? T.BRIDGE : T.PATH);
      roadAt[y * W + x] = 1;
    };
    // a road: every tile whose centre lies within w of the line (as Aldermere's are drawn)
    const line = (pts, w) => {
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        for (let y = Math.floor(Math.min(ay, by) - w - 1); y <= Math.max(ay, by) + w + 1; y++) for (let x = Math.floor(Math.min(ax, bx) - w - 1); x <= Math.max(ax, bx) + w + 1; x++) {
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
          if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < w) pave(x, y);
        }
      }
    };
    for (const [ai, bi] of edges) {
      const a = towns[ai], b = towns[bi], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const pts = [[a.x, a.y]];
      for (let s = 1; s < 4; s++) { const off = (hash(ai * 7 + s, bi, 960) - 0.5) * len * 0.22; pts.push([a.x + (dx * s) / 4 + nx * off, a.y + (dy * s) / 4 + ny * off]); }
      pts.push([b.x, b.y]);
      line(pts, 1.1);
    }
    ms.roads = performance.now() - t0 - ms.ground;

    // each village: a square, cottages round it (each with a path to its
    // door), a campfire and a signpost
    const buildings = [], campfires = [], signs = [], reserved = new Uint8Array(N);
    const reserve = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - cx, y - cy) <= r) reserved[y * W + x] = 1; };
    const props = [];
    const occupied = new Uint8Array(N);
    const add = (type, x, y, extra = {}) => props.push({ type, x, y, ...extra });
    const claim = (x, y) => { occupied[y * W + x] = 1; };
    for (const [i, tw] of towns.entries()) {
      for (let y = tw.y - 2; y <= tw.y + 2; y++) for (let x = tw.x - 3; x <= tw.x + 3; x++) if (Math.hypot((x - tw.x) / 3.2, (y - tw.y) / 2.4) <= 1) pave(x, y);
      const n = i === 0 ? 5 : 2 + Math.floor(hash(i, 3, 954) * 4);
      for (let h = 0; h < n; h++) {
        const [ox, oy] = LOTS[h], x = tw.x + ox, y = tw.y + oy;
        for (let yy = y - 2; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) set(xx, yy, T.HOUSE);
        line([[x, y + 1], [x, y + 2], [tw.x + Math.sign(ox) * 2, tw.y + Math.sign(oy)]], 0.7);
        buildings.push({ id: `v${i}_${h}`, x, y, kind: COTTAGES[Math.floor(hash(i, h, 955) * COTTAGES.length)], landmark: true });
        reserve(x, y + 2, 3); reserve(x, y - 2, 3);
      }
      campfires.push({ x: tw.x + 2, y: tw.y + 1, name: tw.name });
      signs.push({ x: tw.x - 3, y: tw.y + 2, lines: [`${tw.name}.`, `${REGIONS.find((r) => r.id === tw.biome).name}. ONE OF ${towns.length} VILLAGES IN THE VAST.`] });
      reserve(tw.x, tw.y, 7);
      // a little dressing on the square
      const dress = tw.biome === 'frost' ? 'furtent' : tw.biome === 'cinder' ? 'tent' : null;
      if (dress) add(dress, tw.x - 8, tw.y + 3, { seed: i % 3 });
      add('barrel', tw.x + 4, tw.y + 3); add('barrel', tw.x - 4, tw.y - 1);
      if (tw.biome === 'basin') { add('pillar', tw.x - 7, tw.y - 4, { broken: true }); add('pillar', tw.x + 7, tw.y - 4, { broken: false }); }
    }
    for (const p of props) claim(p.x, p.y);
    ms.villages = performance.now() - t0 - ms.ground - ms.roads;

    // things placed on a jittered grid: open ground, off the roads, clear of villages
    const open = (x, y) => x > 2 && y > 2 && x < W - 3 && y < H - 3 && !SOLID.has(at(x, y)) && at(x, y) !== T.BRIDGE && !occupied[y * W + x] && !reserved[y * W + x];
    const offRoad = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H && roadAt[yy * W + xx]) return false; return true; };
    const nearTown = (x, y, r) => towns.some((tw) => Math.hypot(tw.x - x, tw.y - y) < r);
    const grid = (sp, seed, fn) => {
      let n = 0;
      for (let gy = 0; gy < Math.ceil(H / sp); gy++) for (let gx = 0; gx < Math.ceil(W / sp); gx++) {
        const x = Math.floor(gx * sp + hash(gx, gy, seed) * sp), y = Math.floor(gy * sp + hash(gx, gy, seed + 1) * sp);
        if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
        if (fn(x, y, n, hash(gx, gy, seed + 2))) n++;
      }
    };
    const groups = [], chests = [], nodes = [], lookouts = [];
    // foe packs: 2-4 of the region's own kinds (Aldermere's mix of sizes)
    grid(20, 970, (x, y, n, r) => {
      if (r > 0.9 || !open(x, y) || !offRoad(x, y, 2) || nearTown(x, y, 18)) return false;
      const b = B(x, y), size = r < 0.25 ? 2 : r < 0.8 ? 3 : 4, units = [];
      for (let u = 0; u < size; u++) {
        const ux = x + [0, 3, -2, 1][u], uy = y + [0, 1, 2, -2][u];
        if (open(ux, uy)) units.push([pickW(FOES[b], hash(x, y + u, 971)), ux, uy]);
      }
      if (units.length < 2) return false;
      groups.push({ id: `vg${n}`, units });
      for (const [, ux, uy] of units) reserve(ux, uy, 1.5);
      return true;
    });
    grid(42, 975, (x, y, n, r) => {
      if (!open(x, y) || nearTown(x, y, 12)) return false;
      const b = B(x, y), [lo, hi] = GOLD[b], mats = {};
      const m = MATS[b];
      mats[m[Math.floor(r * m.length)]] = 1 + Math.floor(hash(x, y, 976) * 3);
      chests.push({ id: `vc${n}`, x, y, items: [], gold: Math.round((lo + (hi - lo) * hash(x, y, 977)) / 10) * 10, mats });
      reserve(x, y, 3);
      return true;
    });
    grid(24, 980, (x, y, n) => {
      if (!open(x, y) || nearTown(x, y, 10)) return false;
      nodes.push({ kind: pickW(NODES[B(x, y)], hash(x, y, 981)), x, y });
      reserve(x, y, 1.5);
      return true;
    });
    grid(78, 985, (x, y, n, r) => {
      if (r > 0.75 || ![-1, 0, 1].every((dx) => open(x + dx, y) && open(x + dx, y - 1) && open(x + dx, y + 1)) || nearTown(x, y, 14)) return false;
      lookouts.push({ id: `vl${n}`, x, y, r: 48, name: `${REGIONS.find((rg) => rg.id === B(x, y)).name} LOOKOUT ${n + 1}` });
      reserve(x, y, 3);
      return true;
    });
    // a campfire now and then out in the wilds, for the long walks between villages
    grid(64, 990, (x, y, n, r) => {
      if (r > 0.6 || !open(x, y) || nearTown(x, y, 30)) return false;
      campfires.push({ x, y, name: `${REGIONS.find((rg) => rg.id === B(x, y)).name} CAMP ${n + 1}` });
      reserve(x, y, 3);
      return true;
    });
    // the dense variant: Aldermere's people and collectibles, at its densities per tile
    const flies = [], shrines = [], townsfolk = [], questNpcs = [];
    if (dense) {
      const per = (n) => Math.sqrt((192 * 320) / n); // the spacing that gives Aldermere's count per area
      const folkLooks = [...new Set(WORLD.townsfolk.map((t) => t.look))];
      const npcLooks = [...new Set(QUESTS.npcs.map((n) => n.look).filter((l) => !['board', 'wisplight', 'hawk'].includes(l)))];
      grid(per(58), 1001, (x, y, n) => { if (!open(x, y)) return false; flies.push([x, y]); reserve(x, y, 1.5); return true; });
      grid(per(12), 1005, (x, y, n) => { if (!open(x, y) || nearTown(x, y, 10)) return false; shrines.push({ id: `vs${n}`, x, y }); reserve(x, y, 3); return true; });
      grid(per(30), 1010, (x, y, n, r) => {
        if (!open(x, y)) return false;
        townsfolk.push({ id: `vf${n}`, name: `VILLAGER ${n + 1}`, look: folkLooks[Math.floor(r * folkLooks.length)], x, y, quirk: 'THE HEX HAS ME. IT ITCHES.', home: 'HOME AGAIN.' });
        reserve(x, y, 3); return true;
      });
      grid(per(57), 1015, (x, y, n, r) => {
        if (!open(x, y)) return false;
        questNpcs.push({ id: `vn${n}`, name: `TRAVELLER ${n + 1}`, x, y, look: npcLooks[Math.floor(r * npcLooks.length)], lines: ['A BIG WORLD, THIS. BIGGER EVERY DAY.'] });
        reserve(x, y, 2.5); return true;
      });
    }
    ms.content = performance.now() - t0 - ms.ground - ms.roads - ms.villages;

    // scenery: Aldermere's props by region, at its thresholds
    const groundOk = (t) => t === T.GRASS || t === T.MARSH || t === T.LOAM || t === T.ASH || t === T.SNOW || t === T.BLIGHT;
    const free = (x, y, pad = 1) => {
      for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!groundOk(at(tx, ty)) || occupied[ty * W + tx] || roadAt[ty * W + tx]) return false;
      }
      return true;
    };
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const jx = x + Math.floor(hash(x, y, 11) * 2), jy = y + Math.floor(hash(x, y, 12) * 2);
      if (jx >= W - 1 || jy >= H - 1) continue;
      const b = B(jx, jy);
      if (b === 'basin') continue;
      const edge = Math.min(jx, jy, W - 1 - jx, H - 1 - jy);
      const grove = vnoise(jx / 9, jy / 9, 21);
      const frame = edge < 4 + vnoise(jx / 5, jy / 5, 2) * 3;
      const forest = frame || grove > (b === 'marsh' ? 0.66 : b === 'gloam' ? 0.3 : b === 'frost' ? 0.5 : 0.72);
      if (!forest || (!frame && hash(jx, jy, 13) < (b === 'gloam' ? 0.22 : 0.15))) continue;
      if (!free(jx, jy, frame ? 0 : 1) || reserved[jy * W + jx]) continue;
      if (b === 'cinder' && grove < 0.82 && !frame) continue; // the badlands are mostly bare
      const kind = b === 'frost' ? 'snowpine' : b === 'cinder' ? 'ashtree' : b === 'gloam' ? 'gloomtree' : b === 'marsh' && hash(jx, jy, 15) < 0.45 ? 'deadtree' : 'tree';
      add(kind, jx, jy, { seed: Math.floor(hash(jx, jy, 14) * (kind === 'gloomtree' || kind === 'ashtree' || kind === 'snowpine' ? 6 : 8)) });
      claim(jx, jy);
    }
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const b = B(x, y), r = hash(x, y, 31), t0 = at(x, y);
      if ((t0 === T.SHALLOW) && r < 0.08) { add('lily', x, y, { seed: x + y * 7 }); continue; }
      if (!free(x, y, 0) || reserved[y * W + x]) continue;
      if (b === 'cinder') {
        const nearLava = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].some(([dx, dy]) => at(x + dx, y + dy) === T.LAVA);
        if (r < 0.022) { add('obsidian', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
        else if (r < 0.032 && !nearLava) { add('vent', x, y, { seed: x * 7 + y }); claim(x, y); }
        else if (r < 0.05 && t0 === T.ASH) add('emberbloom', x, y, { seed: x * 13 + y });
        else if (r < 0.07 && nearLava) add('cinders', x, y, { seed: x + y * 5 });
      } else if (b === 'basin') {
        if (r < 0.008) { add('deadtree', x, y, { seed: Math.floor(hash(x, y, 14) * 8) }); claim(x, y); }
        else if (r < 0.016) { add('hexcrystal', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
        else if (r < 0.03) add('bones', x, y, { seed: x * 7 + y });
      } else if (b === 'frost') {
        if (r < 0.008) { add('rimeglass', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
        else if (r < 0.02) { add('snowrock', x, y, { seed: x * 7 + y, big: hash(x, y, 34) < 0.3 }); claim(x, y); }
        else if (r < 0.045 && vnoise(x / 7, y / 7, 204) > 0.45) add('drift', x, y, { seed: x * 13 + y });
        else if (r < 0.065 && vnoise(x / 6, y / 6, 205) > 0.55) add('snowtuft', x, y, { seed: x + y * 5 });
      } else if (b === 'gloam') {
        if (r < 0.06) add('fern', x, y, { seed: x * 13 + y });
        else if (r < 0.075) add('glowcap', x, y, { seed: x + y * 3 });
        else if (r < 0.085) { add('stump', x, y, { seed: x + y * 5 }); claim(x, y); }
        else if (r < 0.09 && vnoise(x / 30, y / 30, 990) > 0.7) add('web', x, y, { seed: x * 7 + y });
      } else if (b === 'marsh') {
        const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === T.SHALLOW || at(x + dx, y + dy) === T.BOG);
        if (wet && r < 0.35) add('reeds', x, y, { seed: x * 13 + y });
        else if (r < 0.025) add('mushrooms', x, y, { seed: x + y * 3 });
        else if (r < 0.04) { add('rock', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.3 }); claim(x, y); }
        else if (r < 0.07 && vnoise(x / 6, y / 6, 40) > 0.5) add('tuft', x, y, { seed: x * 13 + y });
      } else {
        if (r < 0.018) { add('bush', x, y, { seed: x * 7 + y, berries: hash(x, y, 32) < 0.3 }); claim(x, y); }
        else if (r < 0.03) { add('rock', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.3 }); claim(x, y); }
        else if (r < 0.085 && vnoise(x / 6, y / 6, 40) > 0.5) add('tuft', x, y, { seed: x * 13 + y });
        else if (r < (b === 'meadow' ? 0.14 : 0.11) && vnoise(x / 8, y / 8, 41) > 0.55) add('flowers', x, y, { seed: x * 5 + y * 11 });
      }
    }
    ms.props = performance.now() - t0 - ms.ground - ms.roads - ms.villages - ms.content;
    ms.total = performance.now() - t0;

    built = {
      bio, tiles, props, ms,
      at: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.CAVEWALL : tiles[y * W + x]),
      content: { groups, chests, nodes, lookouts, campfires, signs, buildings, flies, shrines, townsfolk, questNpcs },
      towns,
    };
    return built;
  }

  const def = {
    id, name: 'THE VAST', sub: `${mult}X ALDERMERE${dense ? ', DENSE' : ''} - A TEST WORLD`, generated: true, mult, dense,
    at: [0, 0], w: W, h: H, start: [home[0], home[1] + 4],
    size: { w: W, h: H, overworldW: W },
    regions: REGIONS.map((r) => ({ ...r, sub: `THE VAST - ${mult}X ALDERMERE` })),
    biome, build,
    get content() { return build().content; },
  };
  DEFS[id] = def;
  return def;
}
