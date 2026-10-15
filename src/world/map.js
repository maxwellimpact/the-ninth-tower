// World builder for the demo: Brightwater Vale (the original slice),
// Highmeadow to the east, Mistfen marsh to the south and a cave interior.
// Built from authored shapes + noise; real regions will be authored in Tiled.
// Pure (no DOM) so the terrain worker can rebuild the identical world.
import { hash, vnoise } from '../gfx/pixel.js';
import W from '../data/world.json';
import QD from '../data/quests.json';

export const TILE = 16;
export const MAP_W = W.size.w;
export const MAP_H = W.size.h;

export const T = {
  GRASS: 0, PATH: 1, SAND: 2, WATER: 3, PLATEAU: 4, CLIFF: 5, STAIRS: 6, PAVED: 7, WALL: 8, RIM: 9,
  MARSH: 10, SHALLOW: 11, BOG: 12, CHASM: 13, CAVEFLOOR: 14, CAVEWALL: 15, BRIDGE: 16, MOUTH: 17,
  FLOOR: 18, IWALL: 19, HOUSE: 20, DFLOOR: 21, DWALL: 22,
};
export const SOLID = new Set([T.WATER, T.CLIFF, T.WALL, T.RIM, T.BOG, T.CHASM, T.CAVEWALL, T.IWALL, T.HOUSE, T.DWALL]);
export const SOFT = new Set([T.GRASS, T.PATH, T.SAND, T.WATER, T.MARSH, T.SHALLOW, T.BOG]);

export const MARSH_Y = 64;
export const OW_W = W.size.overworldW; // overworld width; interiors live to the right of it

// Separate areas share one tile grid but never share a camera view: the
// overworld, and interior maps parked off to the right of it.
export const AREAS = {
  overworld: { x0: 0, y0: 0, x1: OW_W - 1, y1: MAP_H - 1, interior: false },
  cave: { x0: 202, y0: 2, x1: 230, y1: 54, interior: true, dark: true },
  shop: { x0: 236, y0: 2, x1: 248, y1: 11, interior: true },
  tavern: { x0: 236, y0: 16, x1: 250, y1: 27, interior: true },
  grotto: { x0: 236, y0: 32, x1: 248, y1: 43, interior: true, dark: true },
  undercroft: { x0: 256, y0: 2, x1: 318, y1: 60, interior: true },
  abbey: { x0: 256, y0: 63, x1: 318, y1: 126, interior: true },
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
  if (ty >= MARSH_Y) return 'marsh';
  return tx >= 96 ? 'meadow' : 'vale';
}

export const LANDMARKS = {
  start: W.start,
  frog: { x: 44, y: 26 },
  ward: { x: 82, y: 38 },
  curse: { x: 82, y: 38, r: 15 },
};

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
    if (x >= OW_W) { set(x, y, b === 'shop' || b === 'tavern' ? T.IWALL : b === 'undercroft' || b === 'abbey' ? T.DWALL : T.CAVEWALL); continue; }
    if (b === 'marsh') {
      set(x, y, T.MARSH);
      const n = vnoise(x / 7, y / 7, 60) + (vnoise(x / 3, y / 3, 61) - 0.5) * 0.2;
      const edge = Math.min(y - MARSH_Y, MAP_H - 1 - y);
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
      else if (t === T.WATER || (t === T.BOG && y < MARSH_Y + 6 && x > 120)) set(x, y, T.BRIDGE);
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
  // Brightwater Undercroft: cellars beneath the keep, explored south to north
  const room = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, T.DFLOOR);
  room(282, 48, 294, 56); rect(288, 57, 288, 57, T.STAIRS);      // entry, stairs up
  room(287, 44, 289, 47);                                          // corridor
  room(278, 34, 298, 43);                                          // guard hall
  room(270, 38, 277, 40); room(260, 33, 269, 44);                  // west passage + relic room
  // the gallery: a raised ledge above the hall (face at y 32-33), reached by hook
  room(280, 22, 296, 31);
  room(287, 17, 289, 21);                                          // corridor north
  room(274, 4, 302, 16); set(288, 4, T.STAIRS);                    // Gatewarden's arena, back stairs
  // Sunken Abbey (Mistfen): a drowned church, explored south to north
  room(281, 116, 293, 123); set(287, 124, T.STAIRS);                // narthex, stairs up
  room(286, 113, 288, 115);                                          // passage
  room(272, 96, 302, 112);                                           // flooded nave
  rect(284, 96, 290, 110, T.WATER);                                  // the drowned aisle (dry crossing at the south end)
  room(270, 103, 271, 105); room(260, 100, 269, 108);                // west chapel (Tide Charm)
  room(303, 103, 304, 105); room(305, 100, 314, 108);                // east chapel
  rect(286, 94, 288, 95, T.WATER);                                   // the aisle runs on under the choir wall
  room(278, 84, 296, 93);                                            // choir
  rect(285, 84, 289, 93, T.WATER);
  for (const [px0, py0] of [[280, 86], [293, 90]]) rect(px0, py0, px0 + 1, py0 + 1, T.WATER); // font basins
  room(286, 79, 288, 83);                                            // passage north
  room(266, 65, 308, 78); set(287, 64, T.STAIRS);                    // Mother Murk's nest, back stairs
  for (let y = 68; y <= 75; y++) for (let x = 282; x <= 292; x++) if (Math.hypot((x - 287) / 5.2, (y - 71.5) / 3.6) < 1) set(x, y, T.WATER); // her pool
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
  reserve(W.start.x, W.start.y, 4); reserve(LANDMARKS.frog.x, LANDMARKS.frog.y, 3); for (const wd of W.wards) reserve(wd.x, wd.y, 9);
  for (const g of W.groups) for (const [, x, y] of g.units) reserve(x, y, 1.5);
  const isReserved = (x, y) => reserved.some(([rx, ry, r]) => Math.hypot(rx - x, ry - y) < r);
  const groundOk = (t) => t === T.GRASS || t === T.PLATEAU || t === T.MARSH;
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
    if (jx >= OW_W) continue;
    const b = biomeAt(jx, jy);
    const edge = Math.min(jx, jy, OW_W - 1 - jx, MAP_H - 1 - jy);
    const belt = Math.abs(jy - MARSH_Y + 1) < 2.5 + vnoise(jx / 5, 0, 9) * 2;
    const grove = vnoise(jx / 9, jy / 9, 21);
    const forest = edge < 4 + vnoise(jx / 5, jy / 5, 2) * 3 || grove > (b === 'marsh' ? 0.66 : 0.72) || belt;
    if (!forest || hash(jx, jy, 13) < 0.15) continue;
    if (!free(jx, jy, 1) || isReserved(jx, jy)) continue;
    if (W.wards.some((wd) => Math.hypot(jx - wd.x, jy - wd.y) < 9)) continue;
    add(b === 'marsh' && hash(jx, jy, 15) < 0.45 ? 'deadtree' : 'tree', jx, jy, { seed: Math.floor(hash(jx, jy, 14) * 8) });
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
