// World builder for the demo: Brightwater Vale (the original slice),
// Highmeadow to the east, Mistfen marsh to the south and a cave interior.
// Built from authored shapes + noise; real regions will be authored in Tiled.
// Pure (no DOM) so the terrain worker can rebuild the identical world.
import { hash, vnoise } from '../gfx/pixel.js';
import LORE from '../data/lore.json';
import W from '../data/world.json';
import QD from '../data/quests.json';
import DUNGEONS from '../data/dungeons.json';

export const TILE = 16;
// The grid's size is Aldermere's unless a generated map (world/vast.js) sets
// its own through setMapShape (world/content.js's useMap calls it). These are
// live bindings: read them when building, never copy them at import time.
export let MAP_W = W.size.w;
export let MAP_H = W.size.h;

export const T = {
  GRASS: 0, PATH: 1, SAND: 2, WATER: 3, PLATEAU: 4, CLIFF: 5, STAIRS: 6, PAVED: 7, WALL: 8, RIM: 9,
  MARSH: 10, SHALLOW: 11, BOG: 12, CHASM: 13, CAVEFLOOR: 14, CAVEWALL: 15, BRIDGE: 16, MOUTH: 17,
  FLOOR: 18, IWALL: 19, HOUSE: 20, DFLOOR: 21, DWALL: 22,
  LOAM: 23, // Gloamwood forest floor
  ASH: 24, // Cinderreach ash flats
  LAVA: 25, // Cinderreach lava (solid; scorches anyone near it)
  BASALT: 26, // Cinderreach basalt pavement
  SNOW: 27, // Frosthelm snowfields
  ICE: 28, // frozen lake (walkable)
  BLIGHT: 29, // the Blight Basin's dead ground
};
export const SOLID = new Set([T.WATER, T.CLIFF, T.WALL, T.RIM, T.BOG, T.CHASM, T.CAVEWALL, T.IWALL, T.HOUSE, T.DWALL, T.LAVA]);
export const SOFT = new Set([T.GRASS, T.PATH, T.SAND, T.WATER, T.MARSH, T.SHALLOW, T.BOG, T.LOAM, T.ASH, T.LAVA, T.SNOW, T.ICE, T.BLIGHT]);

export const MARSH_Y = 64;
export const SOUTH_Y = 128; // Wave 2: the southern band (Gloamwood west, Cinderreach east)
export const RIDGE_X = 100; // the ridge between Gloamwood and Cinderreach
export const FROST_Y = 208; // Wave 3: the southern highlands (Frosthelm west, the Blight Basin east)
export let OW_H = MAP_H; // the overworld's walkable depth
export const BASIN_X = 118; // the rough line (a ridge) between Frosthelm and the Basin
export let OW_W = W.size.overworldW; // overworld width; interiors live to the right of it

// Separate areas share one tile grid but never share a camera view: the
// overworld, and interior maps parked off to the right of it.
export const AREAS = {
  overworld: { x0: 0, y0: 0, x1: OW_W - 1, y1: MAP_H - 1, interior: false },
  cave: { x0: 202, y0: 2, x1: 230, y1: 54, interior: true, dark: true },
  shop: { x0: 236, y0: 2, x1: 248, y1: 11, interior: true },
  tavern: { x0: 236, y0: 16, x1: 250, y1: 27, interior: true },
  grotto: { x0: 236, y0: 32, x1: 248, y1: 43, interior: true, dark: true },
  // hand-built dungeons (layouts in dungeons.json), each inside wide wall
  // margins so the camera can centre any room clear of the HUD (C12 rule 1)
  undercroft: { x0: 322, y0: 0, x1: 415, y1: 80, interior: true },
  abbey: { x0: 418, y0: 0, x1: 511, y1: 90, interior: true },
  // Wave 2: under the Gloamwood elder (dark: the Lantern earns its keep)
  witchroot: { x0: 322, y0: 130, x1: 415, y1: 209, interior: true, dark: true },
  // inside the Cinderreach volcano: the dwarves' forge (lit by its lava)
  forge: { x0: 418, y0: 130, x1: 511, y1: 209, interior: true },
  // Wave 3: the trappers' ice cave under Rimewatch (the Climbing Claws)
  clawhold: { x0: 250, y0: 0, x1: 312, y1: 50, interior: true },
  // the Rimeglass Spire, the astronomers' tower on the Highfold
  spire: { x0: 322, y0: 212, x1: 415, y1: 318, interior: true },
  // the Ninth Tower's nine floors, each its own space (a floor whose outer
  // Ward Stone has fallen is sealed: the stairs pass it by)
  tower1: { x0: 418, y0: 212, x1: 448, y1: 246, interior: true },
  tower2: { x0: 449, y0: 212, x1: 479, y1: 246, interior: true },
  tower3: { x0: 480, y0: 212, x1: 510, y1: 246, interior: true },
  tower4: { x0: 418, y0: 247, x1: 448, y1: 281, interior: true, dark: true },
  tower5: { x0: 449, y0: 247, x1: 479, y1: 281, interior: true },
  tower6: { x0: 480, y0: 247, x1: 510, y1: 281, interior: true },
  tower7: { x0: 418, y0: 282, x1: 448, y1: 316, interior: true },
  tower8: { x0: 449, y0: 282, x1: 479, y1: 316, interior: true },
  tower9: { x0: 480, y0: 282, x1: 510, y1: 316, interior: true },
};
export const CAVE_RECT = AREAS.cave;

// A generated map brings its own size and its own region rule (its whole grid
// is overworld: no interiors parked beside it); null puts Aldermere's back.
let shapeBiome = null;
export function setMapShape(def) {
  const sz = def?.size || W.size;
  MAP_W = sz.w; MAP_H = sz.h; OW_W = sz.overworldW; OW_H = MAP_H;
  AREAS.overworld.x1 = OW_W - 1; AREAS.overworld.y1 = MAP_H - 1;
  shapeBiome = def?.biome || null;
  biomeMemo = null; // (sized to the grid it was made for)
}

export function areaAt(tx, ty) {
  if (tx < OW_W) return 'overworld';
  for (const [id, a] of Object.entries(AREAS)) if (a.interior && tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1) return id;
  return 'void';
}

// Region borders meander instead of running along straight rows and columns:
// a broad wave of a few tiles, plus finer noise so the ground of one region
// fingers into the next. The ridge itself bends (only ever westward, clear of
// the lava pool on its east foot).
export const marshEdge = (x) => MARSH_Y + (vnoise(x / 22, 0.5, 801) - 0.5) * 30 + (vnoise(x / 7, 0.5, 811) - 0.5) * 8;
export const southEdge = (x) => SOUTH_Y + (vnoise(x / 22, 0.5, 802) - 0.5) * 30 + (vnoise(x / 7, 0.5, 812) - 0.5) * 8;
export const meadowEdge = (y) => 96 + (vnoise(0.5, y / 14, 804) - 0.5) * 24;
export const ridgeAt = (y) => {
  const off = Math.round((vnoise(0.5, y / 14, 803) - 0.5) * 16);
  return RIDGE_X + (y > 158 && y < 192 ? Math.min(0, off) : off); // never east into the lava pool at its foot
};
const fray = (x, y, seed) => (vnoise(x / 5, y / 5, seed) - 0.5) * 9 + (vnoise(x / 2.5, y / 2.5, seed + 50) - 0.5) * 4;

// Landmarks and everything authored near a border keep the region they were
// built for: inside these circles the old straight-line rule decides.
const PINS = [
  [172, 139, 13], [126, 120, 9], [111, 135, 10], [160, 112, 11], [171, 99, 9], [139, 150, 9], [30, 141, 8], [86, 146, 6],
  [80, 85, 8], [96, 88, 8], [60, 104, 9], [44, 23, 10], [57, 20, 4], [161, 20, 8], [69, 10, 12], [185, 99, 7],
  ...W.wards.map((w) => [w.x, w.y, 9]), ...W.chests.map((c) => [c.x, c.y, 2.5]), ...W.campfires.map((c) => [c.x, c.y, 3]),
  ...W.groups.flatMap((g) => g.units.map(([, x, y]) => [x, y, 2])), ...QD.npcs.map((n) => [n.x, n.y, 2]),
];
// The escarpment Frosthelm and the Basin stand on: its row in each column
// wanders between 207 and 212 (never up into the band's older ground, and
// level across the stair pass at x 44-48).
const rawFrostEdge = (x) => 207 + Math.round(vnoise(x / 9, 0.5, 821) * 4 + vnoise(x / 3.5, 0.5, 822) * 1.4);
export const frostEdge = (x) => rawFrostEdge(Math.abs(x - 46) <= 2 ? 46 : x);
export const basinEdge = (y) => BASIN_X + (vnoise(0.5, y / 14, 823) - 0.5) * 10;
const straightBiome = (tx, ty) => (ty > frostEdge(tx) ? (tx < BASIN_X ? 'frost' : 'basin') : ty >= SOUTH_Y ? (tx < RIDGE_X ? 'gloam' : 'cinder') : ty >= MARSH_Y ? 'marsh' : tx >= 96 ? 'meadow' : 'vale');

// Aldermere's rule is pure but costly (the pins, the frayed borders), and the
// builder, the painter and the game ask it about the same tiles over and
// over: each whole tile is worked out once and remembered, and only the pins
// whose circles reach a tile's 8x8 cell are checked.
const BIOME_IDS = ['vale', 'meadow', 'marsh', 'gloam', 'cinder', 'frost', 'basin'];
let biomeMemo = null, pinCells = null;
const PIN_CELL = 8;
function pinsNear(tx, ty) {
  if (!pinCells) {
    const cols = Math.ceil(W.size.overworldW / PIN_CELL), rows = Math.ceil(W.size.h / PIN_CELL);
    pinCells = Array.from({ length: cols * rows }, () => []);
    for (const pin of PINS) {
      const [px, py, r] = pin;
      for (let cy = Math.max(0, Math.floor((py - r) / PIN_CELL)); cy <= Math.min(rows - 1, Math.floor((py + r) / PIN_CELL)); cy++)
        for (let cx = Math.max(0, Math.floor((px - r) / PIN_CELL)); cx <= Math.min(cols - 1, Math.floor((px + r) / PIN_CELL)); cx++) pinCells[cy * cols + cx].push(pin);
    }
    pinCells.cols = cols; pinCells.rows = rows;
  }
  const cx = Math.floor(tx / PIN_CELL), cy = Math.floor(ty / PIN_CELL);
  return cx < 0 || cy < 0 || cx >= pinCells.cols || cy >= pinCells.rows ? PINS : pinCells[cy * pinCells.cols + cx];
}
export function biomeAt(tx, ty) {
  if (shapeBiome) return shapeBiome(tx, ty);
  const a = areaAt(tx, ty);
  if (a !== 'overworld') return a;
  if (Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < OW_W && ty < MAP_H) {
    biomeMemo ??= new Int8Array(OW_W * MAP_H).fill(-1);
    const i = ty * OW_W + tx;
    if (biomeMemo[i] < 0) biomeMemo[i] = BIOME_IDS.indexOf(aldermereBiome(tx, ty));
    return BIOME_IDS[biomeMemo[i]];
  }
  return aldermereBiome(tx, ty);
}
function aldermereBiome(tx, ty) {
  for (const [px, py, r] of pinsNear(tx, ty)) if (Math.abs(px - tx) < r && Math.abs(py - ty) < r && Math.hypot(px - tx, py - ty) < r) return straightBiome(tx, ty);
  // the highlands start above the escarpment (it meanders, but never into older ground)
  if (ty > frostEdge(tx)) return tx < basinEdge(ty) + fray(tx, ty, 810) * 0.5 ? 'frost' : 'basin';
  if (ty >= southEdge(tx) + fray(tx, ty, 805)) return tx < ridgeAt(ty) + 2 + (ty < SOUTH_Y + 4 ? fray(tx, ty, 806) : 0) ? 'gloam' : 'cinder';
  if (ty >= marshEdge(tx) + fray(tx, ty, 807)) return 'marsh';
  return tx >= meadowEdge(ty) + fray(tx, ty, 808) ? 'meadow' : 'vale';
}

export const LANDMARKS = {
  start: W.start,
  frog: { x: 44, y: 26 },
  colosseum: { x: 160, y: 44 }, // Highmeadow: the gate of the old arena (a way into the Colosseum's world)
  ward: { x: 82, y: 38 },
  curse: { x: 82, y: 38, r: 15 },
  // Gloamwood landmarks (tiles)
  gloamCamp: { x: 30, y: 141 },
  elderTree: { x: 50, y: 187 }, // Witchroot Hollow: steps down inside the hollow elder
  mirrorPool: { x: 17, y: 167 },
  hermitTower: { x: 86, y: 146 },
  spiderLair: { x: 20, y: 196 },
  // Cinderreach landmarks (tiles)
  emberwatch: { x: 138, y: 150 }, // the outpost
  monastery: { x: 172, y: 140 },
  springs: { x: 128, y: 163 },
  minersCamp: { x: 117, y: 188 },
  drakeLair: { x: 111, y: 135 },
  forgeGate: { x: 177, y: 185 }, // the Forge of Ash: a dwarven gate in the mountain's face
  // Frosthelm landmarks (tiles)
  rimewatch: { x: 46, y: 220 }, // the refugee outpost at the top of the pass
  clawhold: { x: 28, y: 216 }, // the trappers' cave (Climbing Claws)
  glasswater: { x: 22, y: 249 }, // the frozen lake
  trollGully: { x: 100, y: 226 },
  spire: { x: 62, y: 270 }, // the Rimeglass Spire, up on the Highfold
};
// The Blight Basin: the Ninth Tower stands at its heart, ringed by the
// barrier's four layers (outermost first; each outer Ward Stone that falls
// takes one away). A causeway through the Frosthelm ridge always reaches the
// Tower door; its sides in each band are walled by that band's layer.
export const TOWER = { x: 155, y: 262 };
export const BARRIER_R = [40, 31, 22, 13];
export const TOWER_DOOR = { x: 155, y: 269 };
// the Highfold: a raised massif in the middle of Frosthelm, sheer on three
// sides; its south face can be climbed with the Climbing Claws
export const HIGHFOLD = { x0: 24, y0: 264, x1: 100, y1: 292 };
// the lava river, from the volcano's flank down into a pool by the ridge
export const LAVA_RIVER = [[166, 178], [156, 173], [146, 168], [134, 171], [122, 177], [110, 175]];

const PATHS = [
  { w: 1.15, pts: [[2, 37], [14, 37], [24, 36], [33, 33], [44, 31], [44, 26]] },
  { w: 1.15, pts: [[33, 33], [44, 34], [55, 36], [66, 36], [74, 37], [80, 39]] },
  { w: 0.9, pts: [[60, 36], [64, 28], [66, 20], [66, 17]] },
  { w: 1.1, pts: [[66, 36], [90, 31], [110, 33], [126, 36], [142, 36], [156, 26], [161, 22]] },
  { w: 0.85, pts: [[142, 36], [149, 40], [155, 44], [160, 45.5]] }, // off the Watchtower Road to the Colosseum's gate
  { w: 1.1, pts: [[20, 37], [20, 50], [25, 62], [30, 72], [44, 82], [60, 88], [80, 92], [96, 94]] },
  { w: 0.9, pts: [[44, 82], [41, 92], [40, 102]] },
  { w: 0.9, pts: [[96, 94], [110, 99], [124, 104]] },
  // Brightwater's front paths: each wanders off the road and runs right up to
  // its doorstep (the last point tucks under the house, so there's no gap)
  { w: 0.75, pts: [[14, 37], [15, 34], [14, 31], [14, 29.5]] }, // the shop
  { w: 0.75, pts: [[21, 36.5], [20, 34], [21, 31.5], [21, 30.5]] }, // the tavern
  { w: 0.75, pts: [[7, 37], [6, 34], [6, 31.5], [6, 30.5]] }, // Bess's curios
  { w: 0.75, pts: [[29, 34.5], [30, 32], [29, 29.5], [29, 28.5]] }, // the mayor's
  { w: 0.75, pts: [[15, 42.5], [17, 44], [20, 44.5], [23, 45.5], [26, 45], [26, 44.5]] }, // the lane between the steam house and the archery
  { w: 0.7, pts: [[11, 37], [11, 31], [11, 25], [10, 20.5]] }, // up to the mill
  // Wave 2: Mistfen's west road runs on south into Gloamwood ...
  { w: 1.0, pts: [[40, 102], [38, 116], [36, 128], [32, 137], [33, 145], [40, 151], [56, 158], [68, 167], [74, 177], [76, 181]] },
  { w: 0.85, pts: [[56, 158], [52, 168], [50, 178], [50, 185]] }, // to the elder tree
  { w: 0.8, pts: [[56, 158], [72, 152], [84, 149]] }, // the hermit's tower
  { w: 0.8, pts: [[40, 151], [27, 158], [21, 164]] }, // the Mirror Pool
  { w: 0.7, pts: [[27, 158], [20, 176], [18, 186], [20, 193]] }, // a deer trail to the spider lair
  { w: 0.9, pts: [[84, 149], [96, 152], [106, 152], [116, 150]] }, // the ridge pass into Cinderreach
  // ... and its east road into Cinderreach
  { w: 1.0, pts: [[124, 104], [138, 114], [148, 124], [150, 136], [146, 142], [140, 144]] },
  // Cinderreach roads (bridges where they cross the lava)
  { w: 0.95, pts: [[116, 150], [131, 150]] }, // the ridge pass to Emberwatch's west gate
  { w: 0.95, pts: [[139, 156], [140, 162], [146, 166], [148, 176], [150, 186]] }, // south to the Ward Stone
  { w: 0.85, pts: [[150, 186], [160, 189], [172, 188], [177, 187]] }, // to the forge gate
  { w: 0.8, pts: [[140, 162], [131, 163]] }, // the hot springs
  { w: 0.8, pts: [[131, 163], [124, 170], [119, 180], [117, 186]] }, // the burned miners' camp
  { w: 0.85, pts: [[146, 150], [160, 150], [172, 149]] }, // to the monastery stairs
  { w: 0.75, pts: [[116, 150], [112, 142], [111, 137]] }, // up into the drake's crags
  // Wave 3: Frosthelm. The old road behind the elder tree climbs a stair
  // pass in the escarpment to the Rimewatch outpost ...
  { w: 0.95, pts: [[50, 191], [47, 199], [46, 207], [46, 214]] },
  // ... and on south round the Highfold's east side to the Ward Stone
  { w: 1.0, pts: [[46, 226], [48, 236], [56, 245], [66, 251], [82, 255], [96, 258], [104, 266], [106, 280], [104, 294], [96, 301], [82, 306], [70, 307]] },
  { w: 0.85, pts: [[54, 220], [68, 222], [84, 225], [96, 227]] }, // east into the pinewood (the troll's gully)
  { w: 0.8, pts: [[47, 234], [40, 237], [34, 240]] }, // down to the frozen lake
  { w: 0.75, pts: [[38, 220], [32, 219], [29, 218]] }, // the trappers' cave
  { w: 0.75, pts: [[14, 259], [10, 268], [9, 282], [13, 296], [24, 305], [40, 308], [52, 308]] }, // the west trail past the lake
  // the causeway: from Frosthelm's south road, through a cut in the ridge, round to the Ninth Tower's door
  { w: 1.1, pts: [[96, 301], [106, 306], [116, 309], [128, 310], [142, 309], [155, 306], [155, 270]] },
];

function distToSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToLine(x, y, line) {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) d = Math.min(d, distToSeg(x, y, line[i], line[i + 1]));
  return d;
}
const riverX = (y) => 134 + Math.sin(y / 9) * 3;
const southRiverY = (x) => 53.5 + Math.sin(x / 13) * 1.6 + Math.sin(x / 5.3) * 0.5;

export function buildWorld() {
  const ms = {}, t0 = performance.now(), lap = (k) => { const t = performance.now(); ms[k] = Math.round(t - (lap.t ?? t0)); lap.t = t; }; // stage timings (the debug panel's LOAD line)
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const at = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  // (a road can only reach tiles within w + 0.5 of its line, so each is only
  // measured inside its own bounding box)
  const boxes = PATHS.map((p) => { const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]), m = p.w + 0.5; return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m]; });
  const onPath = (x, y) => x < OW_W && PATHS.some((p, i) => { const b = boxes[i]; return x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3] && distToLine(x, y, p.pts) < p.w + vnoise(x / 6, y / 6, 5) * 0.5; });

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const b = biomeAt(x, y);
    if (x >= OW_W) { set(x, y, b === 'shop' || b === 'tavern' ? T.IWALL : b === 'undercroft' || b === 'abbey' || b === 'witchroot' || b === 'forge' || b === 'clawhold' || b === 'spire' || b.startsWith('tower') ? T.DWALL : T.CAVEWALL); continue; }
    if (b === 'basin') {
      set(x, y, T.BLIGHT);
      // rifts into nothing, where the curse ate through the ground
      const rv = vnoise(x / 6, y / 6, 250), dT = Math.hypot(x - TOWER.x, y - TOWER.y);
      if (rv > 0.79 && dT > 9 && Math.abs(x - TOWER.x) > 3) set(x, y, T.CHASM);
    } else if (b === 'frost') {
      set(x, y, T.SNOW);
      // Glasswater: the frozen lake, with a few holes of open black water
      const gd = Math.hypot((x - 22) / 16, (y - 249) / 10) + (vnoise(x / 4, y / 4, 200) - 0.5) * 0.3;
      if (gd < 1) set(x, y, [[14, 246, 1.7], [30, 252, 1.4], [25, 242, 1.1]].some(([hx, hy, hr]) => Math.hypot(x - hx, y - hy) < hr) ? T.WATER : T.ICE);
    } else if (b === 'gloam') {
      set(x, y, T.LOAM);
      // mossy clearings where the canopy breaks
      if (vnoise(x / 11, y / 11, 140) > 0.64) set(x, y, T.GRASS);
    } else if (b === 'cinder') {
      // ash flats, with basalt pavement where old flows cooled
      set(x, y, vnoise(x / 9, y / 9, 170) > 0.6 ? T.BASALT : T.ASH);
      const d = distToLine(x, y, LAVA_RIVER);
      if (d < 1.3 + vnoise(x / 4, y / 4, 171) * 0.9) set(x, y, T.LAVA);
      else if (d < 2.6 + vnoise(x / 4, y / 4, 172) * 0.8) set(x, y, T.BASALT);
    } else if (b === 'marsh') {
      set(x, y, T.MARSH);
      const n = vnoise(x / 7, y / 7, 60) + (vnoise(x / 3, y / 3, 61) - 0.5) * 0.2;
      const edge = Math.min(y - marshEdge(x), southEdge(x) - 1 - y);
      if (edge > 3 && n > 0.74) set(x, y, T.BOG);
      else if (edge > 2 && n > 0.62) set(x, y, T.SHALLOW);
    } else set(x, y, T.GRASS);

    // Brightwater lake
    const lx = (x - 24) / 11, ly = (y - 15) / 6.5;
    const ld = lx * lx + ly * ly + (vnoise(x / 4, y / 4, 3) - 0.5) * 0.45;
    if (ld < 1) set(x, y, T.WATER); else if (ld < 1.35) set(x, y, T.SAND);
    // Highmeadow pond
    const px2 = (x - 108) / 7, py2 = (y - 12) / 4;
    const pd = px2 * px2 + py2 * py2 + (vnoise(x / 4, y / 4, 7) - 0.5) * 0.4;
    if (pd < 1) set(x, y, T.WATER); else if (pd < 1.4) set(x, y, T.SAND);
    // River down Highmeadow, sinking into the fen as bog
    if (y < MARSH_Y + 6 && x > 120) {
      const d = Math.abs(x - riverX(y));
      if (d < 1.9) set(x, y, y < MARSH_Y ? T.WATER : T.BOG);
      else if (d < 2.9 && y < MARSH_Y) set(x, y, T.SAND);
    }
    // The Southwash: a river across the south of the Vale, crossed by a bridge
    // on the south road (it was a broken one with hook posts, which stranded
    // errands that cross it, like Piet's cart to Hobb's farm).
    if (x < OW_W && y > 46 && y < 62) {
      const d = Math.abs(y - southRiverY(x));
      if (d < 1.6 && x < riverX(y) - 1) set(x, y, T.WATER);
      else if (d < 2.6 && x < riverX(y) - 1 && at(x, y) !== T.WATER) set(x, y, T.SAND);
    }
    if (onPath(x, y)) {
      const t = at(x, y);
      if (t === T.WATER || t === T.LAVA || (t === T.BOG && y < MARSH_Y + 6 && x > 120)) set(x, y, T.BRIDGE);
      else if (t !== T.CAVEWALL && t !== T.ICE) set(x, y, T.PATH);
    }
  }

  lap('ground');
  // Brightwater ruins
  rect(36, 18, 52, 29, T.PAVED);
  const wall = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, T.WALL);
  wall(36, 17, 41, 17); wall(45, 17, 52, 17); wall(35, 17, 35, 25);
  wall(53, 17, 53, 21); wall(53, 25, 53, 28); wall(36, 29, 40, 29); wall(48, 29, 52, 29);
  // Brightwater hamlet by the lake: shop + tavern (sprites over solid footprints; doors are warps)
  // the watermill on the lake's west shore, its wheel in a short mill race cut from the lake
  rect(9, 17, 11, 19, T.HOUSE);
  for (const b of W.buildings || []) if (!b.landmark || b.opens) rect(b.x - 1, b.y - 2, b.x + 1, b.y, T.HOUSE); // the cottages: shop, tavern, and the homes that open as townsfolk come back
  for (const [x, y] of [[12, 17], [12, 18], [13, 18], [14, 18], [12, 19], [13, 19], [14, 19], [15, 19], [16, 19]]) set(x, y, T.WATER);
  wall(38, 20, 39, 21); wall(48, 21, 50, 21); // collapsed house corners in the ruins
  set(47, 25, T.STAIRS); // steps down to the Undercroft
  // the old King's tomb east of the ruins: an iron-strapped door (Stone Gauntlets)
  rect(55, 17, 59, 22, T.WALL); rect(56, 18, 58, 21, T.PAVED); set(57, 22, T.PAVED);

  // NE plateau with cliff + stairs
  rect(58, 3, 80, 14, T.PLATEAU);
  rect(58, 15, 80, 16, T.CLIFF);
  for (let y = 3; y <= 16; y++) { set(57, y, T.RIM); set(81, y, T.RIM); }
  rect(66, 15, 67, 16, T.STAIRS);
  rect(73, 15, 74, 16, T.MOUTH); // hidden grotto, sealed by a cracked boulder

  // The Colosseum (Highmeadow): solid where its walls stand (only the tiles
  // its sprite covers, so no ground shows through), the gate open, a paved apron
  { const C = LANDMARKS.colosseum; rect(C.x - 3, C.y - 3, C.x + 3, C.y - 1, T.HOUSE); rect(C.x - 2, C.y, C.x + 2, C.y, T.HOUSE); rect(C.x - 2, C.y + 1, C.x + 2, C.y + 1, T.PAVED); set(C.x, C.y, T.PAVED); }

  // Old watchtower (Highmeadow)
  rect(156, 15, 167, 25, T.PAVED);
  wall(156, 14, 160, 14); wall(164, 14, 167, 14); wall(155, 14, 155, 21); wall(168, 14, 168, 25);
  wall(155, 25, 159, 25); wall(164, 25, 167, 25); wall(159, 21, 160, 22);
  wall(163, 15, 163, 19); wall(164, 19, 164, 19); wall(166, 19, 167, 19); // secret room, cracked gap at (165,19)

  // Mistfen: rock outcrop with the cave mouth
  rect(89, 84, 103, 88, T.PLATEAU);
  rect(89, 89, 103, 90, T.CLIFF);
  for (let y = 84; y <= 90; y++) { set(88, y, T.RIM); set(104, y, T.RIM); }
  set(96, 90, T.MOUTH); set(97, 90, T.MOUTH); set(96, 89, T.MOUTH); set(97, 89, T.MOUTH);
  // clear standing room in front of the mouth
  rect(93, 91, 100, 96, T.MARSH);
  // Witch hut ruin
  rect(37, 97, 43, 102, T.PAVED);
  wall(36, 96, 44, 96); wall(36, 96, 36, 103); wall(44, 96, 44, 103); wall(36, 103, 38, 103); wall(42, 103, 44, 103);
  // Hook bluff: a raised rock shelf in the fen, cliff face to the south, only
  // reachable by grappling up from the post at its foot
  rect(129, 98, 139, 105, T.PLATEAU);
  rect(129, 106, 139, 107, T.CLIFF);
  for (let y = 97; y <= 107; y++) { set(128, y, T.RIM); set(140, y, T.RIM); }
  rect(128, 97, 140, 97, T.RIM); // back edge
  rect(126, 108, 142, 112, T.MARSH); // firm ground at the foot of the face

  // Wave 2: the southern band ---------------------------------------------
  // the highland escarpment along the south of the band (Frosthelm lies above it)
  // (a staircase of rim tiles, closed between columns so nothing slips through)
  for (let x = 0; x < OW_W; x++) {
    const e = frostEdge(x), p = x > 0 ? frostEdge(x - 1) : e;
    for (let y = Math.min(e, p); y <= Math.max(e, p); y++) set(x, y, T.RIM);
  }
  // the ridge between Gloamwood and Cinderreach: a raised rock spine with one
  // pass through it (the road at y 150-154)
  for (let y = SOUTH_Y + 3; y < FROST_Y + 5; y++) {
    if (y >= 149 && y <= 155) continue;
    const w = Math.round(1 + vnoise(0, y / 7, 141) * 2), rx = ridgeAt(y);
    for (let x = rx - w; x <= rx + 3 + w; x++) if (y < frostEdge(x)) set(x, y, x === rx - w || x === rx + 3 + w ? T.RIM : T.PLATEAU);
  }
  // Gloamwood edge camp: a trodden clearing where the hunters gather
  for (let y = 136; y <= 147; y++) for (let x = 24; x <= 37; x++) {
    if (Math.hypot((x - 30.5) / 6, (y - 141.5) / 5) + (vnoise(x / 3, y / 3, 142) - 0.5) * 0.3 < 1 && at(x, y) !== T.PATH) set(x, y, T.GRASS);
  }
  // the Mirror Pool: still black water in a ring of moss
  for (let y = 160; y <= 175; y++) for (let x = 8; x <= 27; x++) {
    const d = Math.hypot((x - 17) / 5.4, (y - 167) / 3.8) + (vnoise(x / 3, y / 3, 143) - 0.5) * 0.25;
    if (d < 1) set(x, y, T.WATER); else if (d < 1.45) set(x, y, T.GRASS);
  }
  // the elder tree: Witchroot Hollow lies under its roots. Its trunk is a
  // solid footprint (the tree is drawn over it); the steps down sit in the
  // hollow at its foot
  for (let y = 178; y <= 192; y++) for (let x = 42; x <= 58; x++) {
    if (Math.hypot((x - 50) / 7.5, (y - 186) / 6) < 1 && at(x, y) !== T.PATH) set(x, y, T.GRASS);
  }
  rect(48, 183, 52, 185, T.HOUSE); // as wide as the trunk's foot
  set(50, 186, T.STAIRS);
  // the hermit's tower: a squat ruin whose doorway is a false wall (Seer's Lens)
  for (let y = 142; y <= 150; y++) for (let x = 82; x <= 90; x++) {
    const d = Math.hypot(x - 86, (y - 146) * 1.1);
    if (d < 3.2) set(x, y, T.PAVED); else if (d < 4.4) set(x, y, T.WALL);
  }
  // a forgotten shrine on the forest's west edge: its door is a false wall
  // (Seer's Lens) and the Penitent's Gown lies inside (Wave 3, Mirelle's)
  for (let y = 134; y <= 145; y++) for (let x = 2; x <= 12; x++) {
    const d = Math.hypot(x - 7, (y - 139) * 1.1);
    if (d < 3.2) set(x, y, T.PAVED); else if (d < 4.4) set(x, y, T.WALL);
  }
  // Queen Mab's lair: a hollow under the canopy, choked with webs
  for (let y = 190; y <= 203; y++) for (let x = 12; x <= 29; x++) {
    if (Math.hypot((x - 20) / 6.5, (y - 196.5) / 5) + (vnoise(x / 3, y / 3, 144) - 0.5) * 0.3 < 1) set(x, y, T.LOAM);
  }

  // Cinderreach ------------------------------------------------------------
  // the lava pool the river drains into, under the ridge
  for (let y = 170; y <= 181; y++) for (let x = 104; x <= 115; x++) {
    const d = Math.hypot((x - 109) / 4.2, (y - 176) / 3.4) + (vnoise(x / 3, y / 3, 173) - 0.5) * 0.25;
    if (d < 1) set(x, y, T.LAVA); else if (d < 1.5 && at(x, y) !== T.LAVA) set(x, y, T.BASALT);
  }
  // Emberwatch: a palisade outpost where the roads meet (gates west, north, south, east)
  rect(132, 145, 146, 155, T.ASH); // a trodden yard...
  rect(133, 149, 145, 151, T.PAVED); rect(138, 146, 140, 154, T.PAVED); // ...with paving where the roads cross it
  for (let x = 132; x <= 146; x++) { if (Math.abs(x - 140) > 1) set(x, 145, T.WALL); if (Math.abs(x - 139) > 1) set(x, 155, T.WALL); }
  for (let y = 145; y <= 155; y++) { if (Math.abs(y - 150) > 1) { set(132, y, T.WALL); set(146, y, T.WALL); } }
  // the hot springs: steaming pools, the one cool spot in the badlands
  for (let y = 158; y <= 168; y++) for (let x = 122; x <= 134; x++) {
    const d = Math.hypot((x - 128) / 4.4, (y - 163) / 3.2) + (vnoise(x / 3, y / 3, 174) - 0.5) * 0.25;
    if (d < 1) set(x, y, T.WATER); else if (d < 1.4 && at(x, y) !== T.PATH) set(x, y, T.BASALT);
  }
  // St. Cinder's monastery on its crag: a walled court up a flight of steps
  rect(164, 132, 181, 145, T.PLATEAU);
  rect(164, 146, 181, 147, T.CLIFF);
  for (let y = 131; y <= 147; y++) { set(163, y, T.RIM); set(182, y, T.RIM); }
  rect(163, 131, 182, 131, T.RIM);
  rect(171, 146, 173, 147, T.STAIRS);
  rect(167, 134, 178, 143, T.PAVED);
  for (let x = 166; x <= 179; x++) { set(x, 133, T.WALL); if (Math.abs(x - 172) > 1) set(x, 144, T.WALL); }
  for (let y = 133; y <= 144; y++) { set(166, y, T.WALL); set(179, y, T.WALL); }
  // the burned miners' camp, by the old mine's boarded mouth
  for (let y = 183; y <= 194; y++) for (let x = 110; x <= 124; x++) {
    if (Math.hypot((x - 117) / 6.5, (y - 188.5) / 5) < 1 && at(x, y) !== T.PATH) set(x, y, T.ASH);
  }
  // the drake's crags: a broken shelf of basalt in the north-west
  for (let y = 130; y <= 142; y++) for (let x = 104; x <= 120; x++) {
    if (Math.hypot((x - 111) / 7, (y - 135.5) / 5) + (vnoise(x / 4, y / 4, 175) - 0.5) * 0.3 < 1) set(x, y, T.BASALT);
  }
  // the volcano's shoulder: a raised mass with a cliff face to the south,
  // and the dwarven gate of the Forge of Ash cut into it
  rect(164, 168, 190, 184, T.PLATEAU);
  rect(164, 185, 190, 186, T.CLIFF);
  for (let y = 168; y <= 186; y++) set(163, y, T.RIM);
  rect(163, 167, 190, 167, T.RIM);
  rect(176, 185, 178, 186, T.MOUTH);
  rect(172, 187, 182, 190, T.BASALT); // the gate's apron
  // the lava vent by the Ward Stone (the true Forgemaster climbs out of it)
  for (let y = 182; y <= 187; y++) for (let x = 146; x <= 154; x++) {
    if (Math.hypot((x - 150) / 2.6, (y - 184.5) / 1.8) < 1) set(x, y, T.LAVA);
  }

  // Wave 3: Frosthelm --------------------------------------------------------
  rect(0, MAP_H - 1, OW_W - 1, MAP_H - 1, T.RIM); // the bottom of the world
  for (let x = 45; x <= 47; x++) set(x, frostEdge(x), T.STAIRS); // the stair pass up from Gloamwood
  // the ridge between Frosthelm and the Basin: a raised spine, sheer both sides
  for (let y = FROST_Y; y < MAP_H - 1; y++) {
    const w = Math.round(1 + vnoise(0, y / 7, 201) * 2), rx = Math.round(basinEdge(y));
    for (let x = rx - w; x <= rx + 3 + w; x++) if (y > frostEdge(x)) set(x, y, x === rx - w || x === rx + 3 + w ? T.RIM : T.PLATEAU);
  }
  // Rimewatch: a refugee camp behind a stake palisade, gates on all four sides
  rect(39, 214, 53, 225, T.PATH);
  for (let x = 38; x <= 54; x++) { if (Math.abs(x - 46) > 1) { set(x, 213, T.WALL); set(x, 226, T.WALL); } }
  for (let y = 213; y <= 226; y++) { if (Math.abs(y - 220) > 1) { set(38, y, T.WALL); set(54, y, T.WALL); } }
  // the trappers' cave: an outcrop under the escarpment with a dark mouth
  for (let x = 22; x <= 34; x++) rect(x, frostEdge(x) + 1, x, 214, T.PLATEAU);
  rect(22, 215, 34, 216, T.CLIFF);
  for (const x of [21, 35]) for (let y = frostEdge(x) + 1; y <= 216; y++) set(x, y, T.RIM);
  rect(27, 215, 28, 216, T.MOUTH);
  rect(25, 217, 31, 219, T.SNOW); // standing room at the mouth
  // the troll's gully: a trampled clearing in the pinewood
  for (let y = 220; y <= 233; y++) for (let x = 92; x <= 109; x++) if (Math.hypot((x - 100) / 7, (y - 226) / 5.5) + (vnoise(x / 3, y / 3, 202) - 0.5) * 0.3 < 1 && at(x, y) === T.SNOW && hash(x, y, 203) < 0.6) set(x, y, T.PATH);
  // the Highfold: raised, sheer on its back and sides, a climbable face to the south
  // (a rounded, noise-edged mass: a two-row face wherever it drops to the
  // south, a sheer rim everywhere else)
  const HF = HIGHFOLD, hcx = (HF.x0 + HF.x1) / 2, hcy = (HF.y0 + HF.y1) / 2;
  const inHF = (x, y) => Math.abs((x - hcx) / ((HF.x1 - HF.x0) / 2 + 0.5)) ** 3 + Math.abs((y - hcy) / ((HF.y1 - HF.y0) / 2 + 0.5)) ** 3 + (vnoise(x / 6, y / 6, 206) - 0.5) * 0.4 < 1;
  for (let y = HF.y0 - 3; y <= HF.y1 + 3; y++) for (let x = HF.x0 - 3; x <= HF.x1 + 3; x++) if (inHF(x, y)) set(x, y, T.PLATEAU);
  for (let y = HF.y0 - 3; y <= HF.y1 + 5; y++) for (let x = HF.x0 - 4; x <= HF.x1 + 4; x++) {
    if (inHF(x, y)) continue;
    if (inHF(x, y - 1) || (inHF(x, y - 2) && at(x, y - 1) === T.CLIFF)) { set(x, y, T.CLIFF); continue; }
  }
  for (let y = HF.y0 - 4; y <= HF.y1 + 5; y++) for (let x = HF.x0 - 4; x <= HF.x1 + 4; x++) {
    const t = at(x, y);
    if (t === T.PLATEAU || t === T.CLIFF) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => at(x + dx, y + dy) === T.PLATEAU || (dy === 0 && at(x + dx, y) === T.CLIFF))) set(x, y, T.RIM);
  }
  rect(61, 268, 63, 270, T.HOUSE); // the Rimeglass Spire's footprint (the tower is drawn over it)
  // the Blight Basin: a cut through the ridge for the causeway, and the Tower's footprint
  for (let y = 307; y <= 311; y++) for (let x = 104; x <= 128; x++) if (at(x, y) === T.RIM || at(x, y) === T.PLATEAU) set(x, y, Math.abs(y - 309) <= 1 ? T.PATH : T.RIM);
  rect(TOWER.x - 3, TOWER.y + 2, TOWER.x + 3, TOWER.y + 6, T.HOUSE);
  for (let y = TOWER.y - 10; y <= TOWER.y + 12; y++) for (let x = TOWER.x - 10; x <= TOWER.x + 10; x++) if (at(x, y) === T.CHASM) set(x, y, T.BLIGHT); // a clear courtyard
  // the sky ledge: a sheer pillar of rock standing out of the frozen lake,
  // reached only by gliding off the Highfold (Gale Cloak)
  rect(28, 249, 32, 252, T.PLATEAU);
  rect(28, 253, 32, 254, T.CLIFF);
  rect(27, 248, 33, 248, T.RIM);
  for (let y = 249; y <= 254; y++) { set(27, y, T.RIM); set(33, y, T.RIM); }

  // Interiors ---------------------------------------------------------------
  // Cave: tunnels + chambers carved out of rock
  const C = AREAS.cave;
  const tunnel = [[208, 51], [208, 38], [216, 30], [212, 20], [220, 14], [224, 9]];
  for (let y = C.y0 + 1; y < C.y1; y++) for (let x = C.x0 + 1; x < C.x1; x++) {
    const d = distToLine(x, y, tunnel);
    const ch = Math.min(Math.hypot(x - 216, y - 30) - 4.5, Math.hypot(x - 212, y - 20) - 3.5, Math.hypot(x - 224, y - 10) - 4.5, Math.hypot(x - 208, y - 46) - 3);
    if (d < 1.8 + vnoise(x / 3, y / 3, 70) * 1.2 || ch < vnoise(x / 2, y / 2, 71)) set(x, y, T.CAVEFLOOR);
  }
  // Grotto: one round chamber with a pool
  const G = AREAS.grotto;
  for (let y = G.y0 + 1; y < G.y1; y++) for (let x = G.x0 + 1; x < G.x1; x++) {
    const d = Math.hypot((x - 242) / 5.5, (y - 37) / 4) + (vnoise(x / 2, y / 2, 72) - 0.5) * 0.3;
    if (d < 1) set(x, y, Math.hypot(x - 244.5, y - 35.5) < 1.6 ? T.WATER : T.CAVEFLOOR);
  }
  rect(241, 41, 242, 42, T.CAVEFLOOR);
  // The smugglers' pool: an isle in the open fen, reachable only by swimming (Tide Charm)
  for (let y = 79; y <= 91; y++) for (let x = 72; x <= 88; x++) {
    const d = Math.hypot((x - 80) / 6.2, (y - 85) / 4.6);
    if (d < 0.36) set(x, y, T.MARSH); else if (d < 1) set(x, y, T.WATER); else if (d < 1.25) set(x, y, T.SHALLOW);
  }
  // Mother Murk's bog pool, just north of the Mistfen Ward Stone (she rises here)
  for (let y = 104; y <= 112; y++) for (let x = 154; x <= 166; x++) {
    const d = Math.hypot((x - 160) / 4.6, (y - 108) / 2.6);
    if (d < 1) set(x, y, T.WATER); else if (d < 1.3) set(x, y, T.SHALLOW);
  }
  // Abbey ruins in the overworld fen, steps down into the nave
  rect(165, 95, 178, 104, T.PAVED);
  wall(165, 94, 169, 94); wall(173, 94, 178, 94); wall(164, 94, 164, 100); wall(179, 94, 179, 104);
  wall(164, 104, 168, 104); wall(175, 104, 179, 104); wall(171, 96, 172, 97); // broken bell tower
  set(171, 100, T.STAIRS);
  // Grub's fighting pit in the west fen: a ring of stakes around beaten earth
  for (let y = 96; y <= 112; y++) for (let x = 52; x <= 68; x++) {
    const d = Math.hypot(x - 60, (y - 104) * 1.15);
    if (d < 7) set(x, y, T.PAVED);
    else if (d < 8 && !(y > 109 && Math.abs(x - 60) < 2)) set(x, y, T.WALL);
  }
  // the drowned Fenmill: a ruined mill on an islet in a deep pool (swim out with the Tide Charm)
  for (let y = 114; y <= 126; y++) for (let x = 119; x <= 133; x++) {
    const d = Math.hypot((x - 126) / 5.2, (y - 120) / 4.2) + (vnoise(x / 3, y / 3, 52) - 0.5) * 0.15;
    if (d < 0.34) set(x, y, T.MARSH); else if (d < 1) set(x, y, T.WATER); else if (d < 1.25) set(x, y, T.SHALLOW);
  }
  set(125, 119, T.WALL); set(127, 121, T.WALL); // what's left of the mill walls
  // the deep pool east of the abbey, where the bell clapper sank
  for (let y = 94; y <= 104; y++) for (let x = 181; x <= 190; x++) {
    const d = Math.hypot((x - 185.5) / 4.2, (y - 99) / 3.6) + (vnoise(x / 3, y / 3, 40) - 0.5) * 0.25;
    if (d < 1) set(x, y, T.WATER); else if (d < 1.35) set(x, y, T.SHALLOW);
  }
  lap('features');
  // Lab dungeons: authored as text grids (src/data/dungeons.json)
  for (const d of Object.values(DUNGEONS)) {
    if (!d.rows) continue; // overlay dungeons (caves) keep their own terrain
    const [ox, oy] = d.origin;
    const cell = (x, y) => d.rows[y]?.[x] ?? '#';
    const water = (c) => c === 'W' || c === 'Y';
    d.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      // a boss marked inside a pool (Murk) stands in water too
      const pooled = ch === 'G' && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => water(cell(x + dx, y + dy)));
      // 'I' (illusory wall) is built as wall and '_' (hidden bridge) as chasm:
      // the dungeon kit opens them once the party holds the Seer's Lens
      // '&' is lava (the Forge): a heavy boulder rolled in fills it
      set(ox + x, oy + y, ch === '#' || ch === ' ' || ch === 'I' ? T.DWALL : ch === '~' || ch === '_' ? T.CHASM : ch === '&' ? T.LAVA : water(ch) || pooled ? T.WATER : ch === '^' ? T.STAIRS : T.DFLOOR);
    }));
  }
  // Shop + tavern: plank floors inside wall shells (top 2 rows show the wall face)
  const shell = (A) => rect(A.x0 + 1, A.y0 + 2, A.x1 - 1, A.y1 - 1, T.FLOOR);
  shell(AREAS.shop); shell(AREAS.tavern);
  set(242, 11, T.FLOOR); // shop doorway
  set(243, 27, T.FLOOR); // tavern doorway

  lap('interiors');
  // ------------------------------------------------------------------ props
  const props = [];
  const occupied = new Uint8Array(MAP_W * MAP_H); // tiles taken by props
  const add = (type, x, y, extra = {}) => { props.push({ type, x, y, ...extra }); };
  const reserved = [];
  const reserve = (x, y, r) => reserved.push([x, y, r]);
  for (const c of W.chests) reserve(c.x, c.y, 3);
  for (const c of W.campfires) reserve(c.x, c.y, 3);
  for (const s of W.signs) reserve(s.x, s.y, 2);
  for (const r of W.recruits) reserve(r.x, r.y, 3);
  for (const p of W.posts) reserve(p.x, p.y, 3);
  for (const f of W.flies || []) reserve(f[0], f[1], 1.5);
  for (const t of W.townsfolk || []) reserve(t.x, t.y, 3);
  for (const p of LORE) reserve(p.x, p.y, 1.5);
  for (const n of W.nodes || []) reserve(n.x, n.y, 1.5);
  for (const b of W.breakables || []) reserve(b.x, b.y, 3);
  for (const b of W.buildings || []) { reserve(b.x, b.y + 2, 4); reserve(b.x, b.y - 2, 3); if (b.kind === 'archery') reserve(b.x + 6, b.y - 2, 4); } // the door yard, the roof (no tree through it), and the archery range
  for (const w of W.warps || []) reserve(w.x, w.y, 2.5);
  for (const k of [...(W.shrines || []), ...(W.lookouts || [])]) reserve(k.x, k.y, 3);
  // errand NPCs, props and routes stay clear of trees
  for (const n of QD.npcs) reserve(n.x, n.y, 2.5);
  for (const e of Object.values(QD.errands)) for (const st of e.steps) {
    if (st.at) reserve(st.at[0], st.at[1], 4);
    if (st.x !== undefined) reserve(st.x, st.y, 2);
    for (const b of st.bells || []) reserve(b[0], b[1], 2);
    for (const pt of st.path || []) reserve(pt[0], pt[1], 2.5);
  }
  // Gloamwood landmarks keep their clearings open
  reserve(LANDMARKS.gloamCamp.x, LANDMARKS.gloamCamp.y, 7); reserve(LANDMARKS.elderTree.x, LANDMARKS.elderTree.y - 2, 9);
  reserve(LANDMARKS.mirrorPool.x, LANDMARKS.mirrorPool.y, 8); reserve(LANDMARKS.hermitTower.x, LANDMARKS.hermitTower.y, 6);
  reserve(LANDMARKS.spiderLair.x, LANDMARKS.spiderLair.y, 5);
  reserve(7, 145, 3.5); // the way up to the forgotten shrine's false door
  for (const k of ['emberwatch', 'springs', 'minersCamp', 'drakeLair']) reserve(LANDMARKS[k].x, LANDMARKS[k].y, 8);
  reserve(LANDMARKS.rimewatch.x, LANDMARKS.rimewatch.y, 11); reserve(LANDMARKS.clawhold.x, LANDMARKS.clawhold.y + 2, 4);
  reserve(LANDMARKS.trollGully.x, LANDMARKS.trollGully.y, 8); reserve(LANDMARKS.spire.x, LANDMARKS.spire.y + 1, 7);
  for (const c of W.climbs || []) { reserve(c.x, c.y, 3); reserve(c.top[0], c.top[1], 3); }
  for (const gl of W.glides || []) { reserve(gl.x, gl.y, 3); reserve(gl.land[0], gl.land[1], 3); }
  reserve(LANDMARKS.forgeGate.x, LANDMARKS.forgeGate.y + 3, 6);
  reserve(LANDMARKS.colosseum.x, LANDMARKS.colosseum.y - 1, 7); // the Colosseum and its apron
  reserve(W.start.x, W.start.y, 4); reserve(80, 85, 9); reserve(LANDMARKS.frog.x, LANDMARKS.frog.y, 3); for (const wd of W.wards) reserve(wd.x, wd.y, 9);
  for (const g of W.groups) for (const [, x, y] of g.units) reserve(x, y, 1.5);
  // every reserved circle painted into a grid once, instead of checking each one at every tile
  const reservedMask = new Uint8Array(MAP_W * MAP_H);
  for (const [rx, ry, r] of reserved) for (let y = Math.max(0, Math.floor(ry - r)); y <= Math.min(MAP_H - 1, Math.ceil(ry + r)); y++) for (let x = Math.max(0, Math.floor(rx - r)); x <= Math.min(MAP_W - 1, Math.ceil(rx + r)); x++) if (Math.hypot(rx - x, ry - y) < r) reservedMask[y * MAP_W + x] = 1;
  const isReserved = (x, y) => reservedMask[y * MAP_W + x] === 1;
  const groundOk = (t) => t === T.GRASS || t === T.PLATEAU || t === T.MARSH || t === T.LOAM || t === T.ASH || t === T.SNOW || t === T.BLIGHT;
  const free = (x, y, pad = 1) => {
    for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!groundOk(at(tx, ty)) || occupied[ty * MAP_W + tx]) return false;
    }
    return true;
  };
  const claim = (x, y) => { occupied[y * MAP_W + x] = 1; };

  // trees: world-edge forest frame, groves, and a belt between vale and fen
  for (let y = 0; y < MAP_H; y += 2) for (let x = 0; x < MAP_W; x += 2) {
    const jx = x + Math.floor(hash(x, y, 11) * 2), jy = y + Math.floor(hash(x, y, 12) * 2);
    if (jx >= OW_W || jy >= OW_H - 1) continue;
    const b = biomeAt(jx, jy);
    const fe = frostEdge(jx);
    const edge = Math.min(jx, jy, OW_W - 1 - jx, jy < fe ? fe - 1 - jy : OW_H - 1 - jy); // the escarpment edges the band above it
    if (b === 'basin') continue;
    const belt = Math.abs(jy - marshEdge(jx) + 1) < 2.5 + vnoise(jx / 5, 0, 9) * 2 || Math.abs(jy - southEdge(jx) + 0.5) < 2.5 + vnoise(jx / 5, 0, 19) * 2;
    const grove = vnoise(jx / 9, jy / 9, 21);
    // Gloamwood is the deep forest: trees everywhere the canopy doesn't break
    const pinewood = b === 'frost' && jx >= 58 && jy < 252; // Frosthelm's dense pinewood, east of the outpost
    const highfold = jx >= HIGHFOLD.x0 && jx <= HIGHFOLD.x1 && jy >= HIGHFOLD.y0 && jy <= HIGHFOLD.y1;
    const forest = edge < 4 + vnoise(jx / 5, jy / 5, 2) * 3 || grove > (b === 'marsh' ? 0.66 : b === 'gloam' ? 0.3 : pinewood ? 0.38 : highfold ? 0.74 : b === 'frost' ? 0.64 : 0.72) || belt;
    if (!forest || hash(jx, jy, 13) < (b === 'gloam' ? 0.22 : 0.15)) continue;
    if (!free(jx, jy, 1) || isReserved(jx, jy)) continue;
    if (W.wards.some((wd) => Math.hypot(jx - wd.x, jy - wd.y) < 9)) continue;
    if (b === 'cinder' && grove < 0.82 && edge >= 4 + vnoise(jx / 5, jy / 5, 2) * 3) continue; // the badlands are mostly bare
    const kind = b === 'frost' ? 'snowpine' : b === 'cinder' ? 'ashtree' : b === 'gloam' && jy >= SOUTH_Y + 2 ? 'gloomtree' : b === 'marsh' && hash(jx, jy, 15) < 0.45 ? 'deadtree' : 'tree';
    add(kind, jx, jy, { seed: Math.floor(hash(jx, jy, 14) * (kind === 'gloomtree' || kind === 'ashtree' || kind === 'snowpine' ? 6 : 8)) });
    claim(jx, jy);
  }

  lap('trees');
  // scatter
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    const b = biomeAt(x, y);
    const r = hash(x, y, 31);
    if (b === 'shop' || b === 'tavern' || b === 'void') continue;
    if (b === 'cave' || b === 'grotto') {
      if (at(x, y) === T.CAVEFLOOR && at(x, y + 1) === T.CAVEFLOOR && !isReserved(x, y)) {
        if (r < 0.04) { add('stalagmite', x, y, { seed: x + y }); claim(x, y); } else if (r < 0.07) add('crystal', x, y, { seed: x * 3 + y });
      }
      continue;
    }
    if (at(x, y) === T.SHALLOW && r < 0.08) { add('lily', x, y, { seed: x + y * 7 }); continue; }
    if (!free(x, y, 0) || isReserved(x, y)) continue;
    if (b === 'cinder') {
      const t0 = at(x, y);
      if (t0 !== T.ASH && t0 !== T.BASALT) continue;
      const nearLava = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].some(([dx, dy]) => at(x + dx, y + dy) === T.LAVA);
      if (r < 0.022) { add('obsidian', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
      else if (r < 0.032 && !nearLava) { add('vent', x, y, { seed: x * 7 + y }); claim(x, y); }
      else if (r < 0.05 && t0 === T.ASH) add('emberbloom', x, y, { seed: x * 13 + y });
      else if (r < 0.07 && nearLava) add('cinders', x, y, { seed: x + y * 5 });
      continue;
    }
    if (b === 'basin') {
      if (at(x, y) !== T.BLIGHT || Math.hypot(x - TOWER.x, y - TOWER.y) < 11) continue;
      if (r < 0.008) { add('deadtree', x, y, { seed: Math.floor(hash(x, y, 14) * 8) }); claim(x, y); }
      else if (r < 0.016) { add('hexcrystal', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
      else if (r < 0.03) add('bones', x, y, { seed: x * 7 + y });
      continue;
    }
    if (b === 'frost') {
      if (at(x, y) !== T.SNOW && at(x, y) !== T.PLATEAU) continue;
      if (r < 0.008) { add('rimeglass', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.35 }); claim(x, y); }
      else if (r < 0.02) { add('snowrock', x, y, { seed: x * 7 + y, big: hash(x, y, 34) < 0.3 }); claim(x, y); }
      else if (r < 0.045 && vnoise(x / 7, y / 7, 204) > 0.45) add('drift', x, y, { seed: x * 13 + y });
      else if (r < 0.065 && vnoise(x / 6, y / 6, 205) > 0.55) add('snowtuft', x, y, { seed: x + y * 5 });
      continue;
    }
    if (b === 'gloam') {
      if (at(x, y) !== T.LOAM && at(x, y) !== T.GRASS) continue;
      if (r < 0.06) add('fern', x, y, { seed: x * 13 + y });
      else if (r < 0.075) add('glowcap', x, y, { seed: x + y * 3 });
      else if (r < 0.085) { add('stump', x, y, { seed: x + y * 5 }); claim(x, y); }
      else if (r < 0.092 && Math.hypot(x - LANDMARKS.spiderLair.x, y - LANDMARKS.spiderLair.y) < 14) add('web', x, y, { seed: x * 7 + y });
      continue;
    }
    if (b === 'marsh') {
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === T.SHALLOW || at(x + dx, y + dy) === T.BOG);
      if (nearWater && r < 0.35) add('reeds', x, y, { seed: x * 13 + y });
      else if (r < 0.025) add('mushrooms', x, y, { seed: x + y * 3 });
      else if (r < 0.04) { add('rock', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.3 }); claim(x, y); }
      else if (r < 0.07 && vnoise(x / 6, y / 6, 40) > 0.5) add('tuft', x, y, { seed: x * 13 + y });
      continue;
    }
    if (r < 0.018) { add('bush', x, y, { seed: x * 7 + y, berries: hash(x, y, 32) < 0.3 }); claim(x, y); }
    else if (r < 0.03) { add('rock', x, y, { seed: x + y * 3, big: hash(x, y, 33) < 0.3 }); claim(x, y); }
    else if (r < 0.085 && vnoise(x / 6, y / 6, 40) > 0.5) add('tuft', x, y, { seed: x * 13 + y });
    else if (r < 0.11 && vnoise(x / 8, y / 8, 41) > 0.55) add('flowers', x, y, { seed: x * 5 + y * 11 });
  }
  for (let i = 0; i < 14; i++) {
    const x = 16 + Math.floor(hash(i, 1, 50) * 16), y = 11 + Math.floor(hash(i, 2, 50) * 8);
    if (at(x, y) === T.WATER) add('lily', x, y, { seed: i });
  }

  // Rimewatch dressing: hide tents along the palisade, barrels, a woodpile
  for (const [x, y, k] of [[41, 216, 0], [51, 216, 1], [41, 224, 2], [51, 224, 0]]) add('furtent', x, y, { seed: k });
  for (const [x, y] of [[44, 215], [49, 224], [40, 220], [52, 221]]) add('barrel', x, y);
  // Emberwatch dressing: tents along the palisade, barrels, crates
  for (const [x, y, k] of [[134, 147, 0], [144, 147, 1], [134, 153, 2], [143, 153, 0]]) add('tent', x, y, { seed: k });
  for (const [x, y] of [[136, 146], [145, 152], [133, 151], [141, 154]]) add('barrel', x, y);
  // St. Cinder's: braziers by the door, the cold hearthstone's altar
  add('pillar', 168, 142, { broken: false }); add('pillar', 176, 142, { broken: false });
  // the miners' camp: tents and the boarded mine mouth's timbers
  for (const [x, y, k] of [[113, 186, 2], [121, 186, 1], [114, 191, 0]]) add('tent', x, y, { seed: k });
  // smugglers' den dressing on the isle
  add('barrel', 79, 84); add('barrel', 82, 86);
  // ruins dressing
  add('pillar', 41, 29, { broken: false }); add('pillar', 47, 29, { broken: true });
  add('pillar', 160, 25, { broken: true }); add('pillar', 164, 25, { broken: false });
  for (const [x, y] of [[37, 26], [51, 19], [50, 27], [37, 19], [157, 16], [166, 23]]) add('barrel', x, y);

  // furniture
  for (const f of W.furniture || []) add(f.type, f.x, f.y, { ...f });
  lap('scatter');
  ms.total = Math.round(performance.now() - t0);

  return {
    tiles,
    props,
    ms,
    at: (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]),
  };
}

// A test map (src/data/maps/*.json, loaded through world/content.js): its
// rows stamped at `at` into an otherwise solid grid of the usual size, so
// everything that's sized to the world (navigation, the minimap, saves'
// explored bits, chunk streaming) works unchanged and costs nothing to build.
// Where it's stamped decides its region (grass colours, music, heat or cold).
const MAP_LEGEND = {
  '.': 'GRASS', ',': 'GRASS', '=': 'PATH', ':': 'SAND', '~': 'WATER', s: 'SHALLOW', m: 'MARSH', '#': 'CLIFF', w: 'WALL', p: 'PAVED',
  a: 'ASH', l: 'LAVA', n: 'SNOW', i: 'ICE', g: 'LOAM', '@': 'GRASS', F: 'GRASS',
  T: ['GRASS', 'tree'], b: ['GRASS', 'bush'], o: ['GRASS', 'rock'], O: ['GRASS', 'rock', { big: true }], f: ['GRASS', 'flowers'], t: ['GRASS', 'tuft'], r: ['GRASS', 'reeds'],
};
export function buildMapWorld(def) {
  if (def.build) return def.build(); // a generated map builds itself (world/vast.js)
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.CAVEWALL);
  const props = [];
  const legend = { ...MAP_LEGEND, ...(def.legend || {}) };
  const [ox, oy] = def.at;
  def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const e = legend[ch] ?? 'GRASS';
    const [tile, prop, extra] = Array.isArray(e) ? e : [e];
    tiles[(oy + y) * MAP_W + ox + x] = T[tile];
    if (prop) props.push({ type: prop, x: ox + x, y: oy + y, seed: Math.floor(hash(ox + x, oy + y, 77) * 8), ...extra });
  }));
  return { tiles, props, at: (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]) };
}
