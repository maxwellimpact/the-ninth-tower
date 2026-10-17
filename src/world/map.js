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
export const MAP_W = W.size.w;
export const MAP_H = W.size.h;

export const T = {
  GRASS: 0, PATH: 1, SAND: 2, WATER: 3, PLATEAU: 4, CLIFF: 5, STAIRS: 6, PAVED: 7, WALL: 8, RIM: 9,
  MARSH: 10, SHALLOW: 11, BOG: 12, CHASM: 13, CAVEFLOOR: 14, CAVEWALL: 15, BRIDGE: 16, MOUTH: 17,
  FLOOR: 18, IWALL: 19, HOUSE: 20, DFLOOR: 21, DWALL: 22,
  LOAM: 23, // Gloamwood forest floor
  ASH: 24, // Cinderreach ash flats
  LAVA: 25, // Cinderreach lava (solid; scorches anyone near it)
  BASALT: 26, // Cinderreach basalt pavement
};
export const SOLID = new Set([T.WATER, T.CLIFF, T.WALL, T.RIM, T.BOG, T.CHASM, T.CAVEWALL, T.IWALL, T.HOUSE, T.DWALL, T.LAVA]);
export const SOFT = new Set([T.GRASS, T.PATH, T.SAND, T.WATER, T.MARSH, T.SHALLOW, T.BOG, T.LOAM, T.ASH, T.LAVA]);

export const MARSH_Y = 64;
export const SOUTH_Y = 128; // Wave 2: the southern band (Gloamwood west, Cinderreach east)
export const RIDGE_X = 100; // the ridge between Gloamwood and Cinderreach
export const OW_H = 208; // the overworld's walkable depth; the highlands beyond wait for Wave 3
export const OW_W = W.size.overworldW; // overworld width; interiors live to the right of it

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
};
export const CAVE_RECT = AREAS.cave;

export function areaAt(tx, ty) {
  if (tx < OW_W) return 'overworld';
  for (const [id, a] of Object.entries(AREAS)) if (a.interior && tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1) return id;
  return 'void';
}

export function biomeAt(tx, ty) {
  const a = areaAt(tx, ty);
  if (a !== 'overworld') return a;
  if (ty >= SOUTH_Y) return tx < RIDGE_X ? 'gloam' : 'cinder';
  if (ty >= MARSH_Y) return 'marsh';
  return tx >= 96 ? 'meadow' : 'vale';
}

export const LANDMARKS = {
  start: W.start,
  frog: { x: 44, y: 26 },
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
};
// the lava river, from the volcano's flank down into a pool by the ridge
export const LAVA_RIVER = [[166, 178], [156, 173], [146, 168], [134, 171], [122, 177], [110, 175]];

const PATHS = [
  { w: 1.15, pts: [[2, 37], [14, 37], [24, 36], [33, 33], [44, 31], [44, 26]] },
  { w: 1.15, pts: [[33, 33], [44, 34], [55, 36], [66, 36], [74, 37], [80, 39]] },
  { w: 0.9, pts: [[60, 36], [64, 28], [66, 20], [66, 17]] },
  { w: 1.1, pts: [[66, 36], [90, 31], [110, 33], [126, 36], [142, 36], [156, 26], [161, 22]] },
  { w: 1.1, pts: [[20, 37], [20, 50], [25, 62], [30, 72], [44, 82], [60, 88], [80, 92], [96, 94]] },
  { w: 0.9, pts: [[44, 82], [41, 92], [40, 102]] },
  { w: 0.9, pts: [[96, 94], [110, 99], [124, 104]] },
  { w: 0.75, pts: [[14, 36], [14, 31]] },
  { w: 0.75, pts: [[21, 36], [21, 31]] },
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
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const at = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const onPath = (x, y) => x < OW_W && PATHS.some((p) => distToLine(x, y, p.pts) < p.w + vnoise(x / 6, y / 6, 5) * 0.5);

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const b = biomeAt(x, y);
    if (x >= OW_W) { set(x, y, b === 'shop' || b === 'tavern' ? T.IWALL : b === 'undercroft' || b === 'abbey' || b === 'witchroot' ? T.DWALL : T.CAVEWALL); continue; }
    if (y >= OW_H) { set(x, y, T.PLATEAU); continue; } // the highlands beyond (Wave 3)
    if (b === 'gloam') {
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
      const edge = Math.min(y - MARSH_Y, SOUTH_Y - 1 - y);
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
    // The Southwash: a river across the south of the Vale. Its bridge on the
    // south road has collapsed (hook posts), so Mistfen opens with the Grapple.
    if (x < OW_W && y > 46 && y < 62) {
      const d = Math.abs(y - southRiverY(x));
      if (d < 1.6 && x < riverX(y) - 1) set(x, y, T.WATER);
      else if (d < 2.6 && x < riverX(y) - 1 && at(x, y) !== T.WATER) set(x, y, T.SAND);
    }
    if (onPath(x, y)) {
      const t = at(x, y);
      if (t === T.WATER && y > 46 && y < 62 && x < 60) { if (Math.abs(y - southRiverY(x)) > 0.9) set(x, y, T.BRIDGE); /* stubs on each bank, gap in the middle */ }
      else if (t === T.WATER || t === T.LAVA || (t === T.BOG && y < MARSH_Y + 6 && x > 120)) set(x, y, T.BRIDGE);
      else if (t !== T.CAVEWALL) set(x, y, T.PATH);
    }
  }

  // Brightwater ruins
  rect(36, 18, 52, 29, T.PAVED);
  const wall = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, T.WALL);
  wall(36, 17, 41, 17); wall(45, 17, 52, 17); wall(35, 17, 35, 25);
  wall(53, 17, 53, 21); wall(53, 25, 53, 28); wall(36, 29, 40, 29); wall(48, 29, 52, 29);
  // Brightwater hamlet by the lake: shop + tavern (sprites over solid footprints; doors are warps)
  rect(13, 27, 15, 29, T.HOUSE);
  rect(20, 27, 22, 29, T.HOUSE);
  wall(38, 20, 39, 21); wall(48, 21, 50, 21); // collapsed house corners in the ruins
  set(47, 25, T.STAIRS); // steps down to the Undercroft

  // NE plateau with cliff + stairs
  rect(58, 3, 80, 14, T.PLATEAU);
  rect(58, 15, 80, 16, T.CLIFF);
  for (let y = 3; y <= 16; y++) { set(57, y, T.RIM); set(81, y, T.RIM); }
  rect(66, 15, 67, 16, T.STAIRS);
  rect(73, 15, 74, 16, T.MOUTH); // hidden grotto, sealed by a cracked boulder

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
  // the highland edge along the bottom of the world (Wave 3 lies beyond it)
  rect(0, OW_H - 1, OW_W - 1, OW_H - 1, T.RIM);
  // the ridge between Gloamwood and Cinderreach: a raised rock spine with one
  // pass through it (the road at y 150-154)
  for (let y = SOUTH_Y + 3; y < OW_H - 1; y++) {
    if (y >= 149 && y <= 155) continue;
    const w = Math.round(1 + vnoise(0, y / 7, 141) * 2);
    for (let x = RIDGE_X - w; x <= RIDGE_X + 3 + w; x++) set(x, y, x === RIDGE_X - w || x === RIDGE_X + 3 + w ? T.RIM : T.PLATEAU);
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
  // the deep pool east of the abbey, where the bell clapper sank
  for (let y = 94; y <= 104; y++) for (let x = 181; x <= 190; x++) {
    const d = Math.hypot((x - 185.5) / 4.2, (y - 99) / 3.6) + (vnoise(x / 3, y / 3, 40) - 0.5) * 0.25;
    if (d < 1) set(x, y, T.WATER); else if (d < 1.35) set(x, y, T.SHALLOW);
  }
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
      set(ox + x, oy + y, ch === '#' || ch === ' ' || ch === 'I' ? T.DWALL : ch === '~' || ch === '_' ? T.CHASM : water(ch) || pooled ? T.WATER : ch === '^' ? T.STAIRS : T.DFLOOR);
    }));
  }
  // Shop + tavern: plank floors inside wall shells (top 2 rows show the wall face)
  const shell = (A) => rect(A.x0 + 1, A.y0 + 2, A.x1 - 1, A.y1 - 1, T.FLOOR);
  shell(AREAS.shop); shell(AREAS.tavern);
  set(242, 11, T.FLOOR); // shop doorway
  set(243, 27, T.FLOOR); // tavern doorway

  // ------------------------------------------------------------------ props
  const props = [];
  const occupied = new Set(); // tile keys taken by props
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
  for (const b of W.buildings || []) reserve(b.x, b.y + 2, 4);
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
  for (const k of ['emberwatch', 'springs', 'minersCamp', 'drakeLair']) reserve(LANDMARKS[k].x, LANDMARKS[k].y, 8);
  reserve(LANDMARKS.forgeGate.x, LANDMARKS.forgeGate.y + 3, 6);
  reserve(W.start.x, W.start.y, 4); reserve(80, 85, 9); reserve(LANDMARKS.frog.x, LANDMARKS.frog.y, 3); for (const wd of W.wards) reserve(wd.x, wd.y, 9);
  for (const g of W.groups) for (const [, x, y] of g.units) reserve(x, y, 1.5);
  const isReserved = (x, y) => reserved.some(([rx, ry, r]) => Math.hypot(rx - x, ry - y) < r);
  const groundOk = (t) => t === T.GRASS || t === T.PLATEAU || t === T.MARSH || t === T.LOAM || t === T.ASH;
  const free = (x, y, pad = 1) => {
    for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!groundOk(at(tx, ty)) || occupied.has(tx + ',' + ty)) return false;
    }
    return true;
  };
  const claim = (x, y) => occupied.add(x + ',' + y);

  // trees: world-edge forest frame, groves, and a belt between vale and fen
  for (let y = 0; y < MAP_H; y += 2) for (let x = 0; x < MAP_W; x += 2) {
    const jx = x + Math.floor(hash(x, y, 11) * 2), jy = y + Math.floor(hash(x, y, 12) * 2);
    if (jx >= OW_W || jy >= OW_H - 1) continue;
    const b = biomeAt(jx, jy);
    const edge = Math.min(jx, jy, OW_W - 1 - jx, OW_H - 1 - jy);
    const belt = Math.abs(jy - MARSH_Y + 1) < 2.5 + vnoise(jx / 5, 0, 9) * 2 || Math.abs(jy - SOUTH_Y + 0.5) < 2.5 + vnoise(jx / 5, 0, 19) * 2;
    const grove = vnoise(jx / 9, jy / 9, 21);
    // Gloamwood is the deep forest: trees everywhere the canopy doesn't break
    const forest = edge < 4 + vnoise(jx / 5, jy / 5, 2) * 3 || grove > (b === 'marsh' ? 0.66 : b === 'gloam' ? 0.3 : 0.72) || belt;
    if (!forest || hash(jx, jy, 13) < (b === 'gloam' ? 0.22 : 0.15)) continue;
    if (!free(jx, jy, 1) || isReserved(jx, jy)) continue;
    if (W.wards.some((wd) => Math.hypot(jx - wd.x, jy - wd.y) < 9)) continue;
    if (b === 'cinder' && grove < 0.82 && edge >= 4 + vnoise(jx / 5, jy / 5, 2) * 3) continue; // the badlands are mostly bare
    const kind = b === 'cinder' ? 'ashtree' : b === 'gloam' && jy >= SOUTH_Y + 2 ? 'gloomtree' : b === 'marsh' && hash(jx, jy, 15) < 0.45 ? 'deadtree' : 'tree';
    add(kind, jx, jy, { seed: Math.floor(hash(jx, jy, 14) * (kind === 'gloomtree' || kind === 'ashtree' ? 6 : 8)) });
    claim(jx, jy);
  }

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

  return {
    tiles,
    props,
    at: (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]),
  };
}
