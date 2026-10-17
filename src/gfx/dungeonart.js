// Dungeon puzzle pieces (C8 dungeon kit): push blocks, floor plates, crystal
// switches, coloured pegs and the three door kinds. Doors come in a
// horizontal (3 tiles, in a wall row) and a vertical (3 tiles, in a wall
// column) form.
import { makeCanvas, px, outline, hash } from './pixel.js';

// A carved stone block with a rune, sitting a little proud of the floor.
export function pushBlock() {
  const [c, ctx] = makeCanvas(18, 20);
  px(ctx, 1, 4, 'slate', 16, 15);                 // body / front face
  px(ctx, 1, 1, 'mist', 16, 12); px(ctx, 2, 2, 'stone', 14, 10); // top
  px(ctx, 1, 13, 'stone', 16, 1);                 // top edge highlight on the face
  px(ctx, 2, 14, 'night', 14, 1);
  for (const [x, y] of [[8, 4], [7, 5], [9, 5], [8, 6], [8, 7], [6, 8], [10, 8]]) px(ctx, x, y, 'goldL'); // rune
  px(ctx, 3, 16, 'stone', 3, 1); px(ctx, 11, 17, 'stone', 4, 1); // face chips
  outline(c, 'ink');
  return c;
}

// Floor plate: a raised square that sinks (and glows) when pressed.
export function plate(down = false) {
  const [c, ctx] = makeCanvas(16, 16);
  px(ctx, 0, 0, 'ink', 16, 16); px(ctx, 1, 1, 'gold', 14, 14); px(ctx, 2, 2, 'night', 12, 12); // brass rim so it reads on flagstones
  if (down) { px(ctx, 3, 4, 'slate', 10, 9); px(ctx, 5, 6, 'gold', 6, 5); px(ctx, 6, 7, 'goldL', 4, 3); }
  else { px(ctx, 3, 3, 'stone', 10, 9); px(ctx, 3, 3, 'mist', 10, 2); px(ctx, 3, 11, 'slate', 10, 2); px(ctx, 6, 6, 'slate', 4, 4); }
  return c;
}

const PEG = { blue: ['blueD', 'blue', 'blueL'], red: ['redD', 'red', 'redL'] };

// Crystal switch on a pedestal; its colour is the pegs that are currently raised.
export function crystal(color) {
  const [d, m, l] = PEG[color];
  const [c, ctx] = makeCanvas(14, 24);
  px(ctx, 2, 18, 'slate', 10, 5); px(ctx, 3, 17, 'stone', 8, 2); // pedestal
  const rows = [[6, 1, 2], [5, 2, 4], [4, 3, 6], [3, 4, 8], [3, 5, 8], [3, 6, 8], [3, 7, 8], [3, 8, 8], [3, 9, 8], [4, 10, 6], [4, 11, 6], [5, 12, 4], [5, 13, 4], [6, 14, 2], [6, 15, 2]];
  for (const [x, y, w] of rows) { px(ctx, x, y, m, w); px(ctx, x, y, d, 1); px(ctx, x + w - 1, y, d, 1); }
  px(ctx, 6, 3, l, 1, 6); px(ctx, 5, 5, l, 1, 2); px(ctx, 6, 1, 'white');
  outline(c, 'ink');
  return c;
}

// Coloured peg: raised (a solid post) or lowered (a flat tile in the floor).
export function peg(color, up) {
  const [d, m, l] = PEG[color];
  const [c, ctx] = makeCanvas(16, 20);
  if (up) {
    px(ctx, 2, 7, d, 12, 12); px(ctx, 2, 3, m, 12, 9); px(ctx, 3, 4, l, 10, 2); px(ctx, 2, 11, d, 12, 1);
    px(ctx, 6, 13, m, 4, 4);
    outline(c, 'ink');
  } else {
    px(ctx, 2, 6, 'night', 12, 12); px(ctx, 3, 7, d, 10, 10); px(ctx, 5, 9, m, 6, 6);
  }
  return c;
}

const LEAF = { key: ['wood', 'woodD'], boss: ['purp', 'purpD'], vault: ['blue', 'blueD'] };

// Doors. kind: 'shutter' (iron bars), 'key' (keyhole), 'boss' (the great
// door with the Warden's Seal). open: the doorway with the frame only.
export function door(kind, vertical = false, open = false) {
  const W = vertical ? 16 : 48, H = vertical ? 52 : 26;
  const [c, ctx] = makeCanvas(W, H);
  const frame = kind === 'boss' ? 'purpD' : kind === 'vault' ? 'blueD' : 'slate';
  if (vertical) {
    // seen side-on from above: a thick jamb top and bottom, the leaf between
    px(ctx, 2, 0, frame, 12, 5); px(ctx, 2, 47, frame, 12, 5);
    if (!open) {
      if (kind === 'shutter') for (let y = 5; y < 47; y += 6) { px(ctx, 4, y, 'steelD', 8, 3); px(ctx, 4, y, 'steelL', 8, 1); }
      else {
        const [leaf, edge] = LEAF[kind];
        px(ctx, 4, 5, edge, 8, 42); px(ctx, 5, 5, leaf, 6, 42);
        for (const y of [12, 26, 40]) px(ctx, 4, y, 'steel', 8, 2);
        if (kind === 'key') { px(ctx, 6, 22, 'gold', 4, 6); px(ctx, 7, 24, 'ink', 2, 3); }
        else if (kind === 'vault') { px(ctx, 5, 21, 'steelL', 6, 8); for (const [x, y] of [[5, 25], [6, 24], [7, 24], [8, 25], [9, 26], [10, 25], [6, 27], [8, 27], [9, 28]]) px(ctx, x, y, 'waterD'); }
        else { px(ctx, 5, 21, 'goldL', 6, 8); px(ctx, 6, 22, 'curseL', 4, 6); }
      }
    }
  } else {
    // front-on: stone arch, the leaf filling the opening
    px(ctx, 0, 2, frame, 6, 24); px(ctx, 42, 2, frame, 6, 24); px(ctx, 0, 0, frame, 48, 5);
    px(ctx, 1, 1, kind === 'boss' ? 'purp' : kind === 'vault' ? 'blue' : 'stone', 46, 2);
    if (open) px(ctx, 6, 5, 'night', 36, 21);
    else if (kind === 'shutter') {
      px(ctx, 6, 5, 'night', 36, 21);
      for (let x = 8; x < 42; x += 6) { px(ctx, x, 5, 'steelD', 3, 21); px(ctx, x, 5, 'steelL', 1, 21); }
      px(ctx, 6, 9, 'steelD', 36, 2); px(ctx, 6, 19, 'steelD', 36, 2);
    } else {
      const [leaf, edge] = LEAF[kind];
      px(ctx, 6, 5, edge, 36, 21);
      for (let x = 7; x < 42; x += 5) px(ctx, x, 5, leaf, 4, 21);
      px(ctx, 6, 9, 'steel', 36, 2); px(ctx, 6, 20, 'steel', 36, 2);
      if (kind === 'vault') { px(ctx, 18, 10, 'steelL', 12, 12); for (let i = 0; i < 10; i++) px(ctx, 19 + i, 15 + Math.round(Math.sin(i * 0.9) * 2), 'waterD'); }
      else if (kind === 'key') { px(ctx, 21, 12, 'gold', 6, 8); px(ctx, 23, 14, 'ink', 2, 2); px(ctx, 23, 16, 'ink', 2, 3); }
      else { px(ctx, 18, 10, 'goldL', 12, 12); px(ctx, 19, 11, 'gold', 10, 10); px(ctx, 21, 13, 'curseL', 6, 6); px(ctx, 23, 15, 'curse', 2, 2); }
    }
  }
  outline(c, 'ink');
  return c;
}

// Key-item icons for the pickup card and the dungeon HUD (14x14).
export function dungeonIcon(kind) {
  const [c, ctx] = makeCanvas(14, 14);
  if (kind === 'key') {
    px(ctx, 2, 2, 'gold', 5, 5); px(ctx, 3, 3, 'ink', 3, 3); px(ctx, 4, 4, 'goldL');
    px(ctx, 6, 6, 'gold', 2, 2); px(ctx, 7, 7, 'gold', 2, 2); px(ctx, 8, 8, 'gold', 2, 2); px(ctx, 9, 9, 'gold', 3, 2);
    px(ctx, 10, 11, 'gold', 1, 2); px(ctx, 8, 10, 'gold', 1, 2);
  } else if (kind === 'seal') {
    px(ctx, 3, 1, 'goldL', 8, 12); px(ctx, 1, 3, 'goldL', 12, 8); px(ctx, 2, 2, 'gold', 10, 10);
    px(ctx, 4, 4, 'purp', 6, 6); px(ctx, 5, 5, 'curseL', 4, 4); px(ctx, 6, 6, 'curse', 2, 2);
  } else if (kind === 'map') {
    px(ctx, 1, 2, 'bone', 12, 10); px(ctx, 1, 2, 'sand', 1, 10); px(ctx, 12, 2, 'sand', 1, 10);
    px(ctx, 3, 4, 'woodD', 3, 1); px(ctx, 5, 4, 'woodD', 1, 4); px(ctx, 5, 7, 'woodD', 4, 1); px(ctx, 8, 7, 'woodD', 1, 3);
    px(ctx, 9, 4, 'red', 2, 2);
  } else {
    px(ctx, 2, 2, 'steel', 10, 10); px(ctx, 1, 4, 'steel', 12, 6); px(ctx, 4, 1, 'steel', 6, 12);
    px(ctx, 3, 3, 'bone', 8, 8); px(ctx, 2, 5, 'bone', 10, 4); px(ctx, 5, 2, 'bone', 4, 10);
    px(ctx, 6, 3, 'red', 2, 4); px(ctx, 6, 7, 'slate', 2, 4); px(ctx, 6, 6, 'ink', 2, 2);
  }
  outline(c, 'ink');
  return c;
}

// Cracked dungeon wall: matches the Undercroft's painted walls. 'face' is a
// wall seen front-on (a two-tile brick face), 'top' a wall run seen from above.
export function crackedWall(face) {
  const H = face ? 32 : 16;
  const [c, ctx] = makeCanvas(16, H);
  if (face) {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      let col = y < 2 ? 'mist' : y < 4 ? 'stone' : y > 29 ? 'ink' : null;
      if (!col) { const brow = Math.floor((y - 4) / 6), bx = (x + (brow % 2) * 7) % 14; col = (y - 4) % 6 === 5 || bx === 0 ? 'night' : bx < 2 ? 'stone' : 'slate'; }
      px(ctx, x, y, col);
    }
  } else {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const n = hash(x, y, 7); px(ctx, x, y, n > 0.8 ? 'slate' : n > 0.4 ? 'night' : 'ink'); }
  }
  // the crack: a jagged light seam with dark edges, and a little rubble at the foot
  const seam = face ? [[8, 6], [7, 8], [8, 10], [9, 12], [8, 14], [6, 16], [7, 18], [9, 20], [10, 22], [9, 24], [7, 26]] : [[8, 2], [7, 4], [8, 6], [10, 8], [9, 10], [7, 12], [8, 14]];
  for (const [x, y] of seam) { px(ctx, x, y, 'mist', 1, 2); px(ctx, x + 1, y, 'ink', 1, 2); }
  px(ctx, 5, face ? 12 : 6, 'mist'); px(ctx, 4, face ? 13 : 7, 'mist'); px(ctx, 11, face ? 19 : 9, 'mist'); px(ctx, 12, face ? 20 : 10, 'mist');
  px(ctx, 3, H - 2, 'stone', 2, 1); px(ctx, 11, H - 2, 'stone', 2, 1); px(ctx, 7, H - 1, 'slate', 2, 1);
  return c;
}

// A flooded basin tile: deep blue water with a lighter ripple, drawn over the
// floor while its side of the sluice is full.
export function waterTile() {
  const [c, ctx] = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = hash(x, y, 31);
    px(ctx, x, y, n > 0.92 ? 'waterL' : n > 0.55 ? 'water' : 'waterD');
  }
  for (const [x, y, w] of [[2, 4, 4], [9, 9, 5], [4, 13, 3]]) px(ctx, x, y, 'foam', w, 1);
  return c;
}

// A sluice lever on a stone post; its handle leans toward the side that's full.
export function lever(side) {
  const [c, ctx] = makeCanvas(12, 18);
  px(ctx, 3, 9, 'slate', 6, 8); px(ctx, 4, 10, 'stone', 4, 6); px(ctx, 2, 15, 'night', 8, 2); // post
  const lean = side === 'A' ? -1 : 1;
  for (let i = 0; i < 7; i++) px(ctx, 6 + Math.round(lean * i * 0.6) - 1, 9 - i, 'woodD', 2, 1);
  px(ctx, 6 + Math.round(lean * 4) - 2, 1, 'redL', 3, 3); px(ctx, 6 + Math.round(lean * 4) - 2, 1, 'red', 3, 1); // knob
  px(ctx, 4, 12, side === 'A' ? 'waterL' : 'blueL', 4, 2); // a little dial showing which basin
  outline(c, 'ink');
  return c;
}

// ------------------------------------------------------------ Witchroot Hollow
// Brazier: an iron bowl on a root-wrapped stone foot. Unlit it holds cold ash;
// lit, a flame in three flicker frames (lit[] is the animation).
export function brazier(lit = false, f = 0) {
  const [c, ctx] = makeCanvas(16, 24);
  px(ctx, 5, 15, 'slate', 6, 7); px(ctx, 6, 16, 'stone', 3, 5); px(ctx, 4, 21, 'night', 8, 2); // stone foot
  px(ctx, 4, 17, 'bark', 1, 4); px(ctx, 11, 16, 'bark', 1, 5); px(ctx, 5, 19, 'barkD', 6, 1); // roots wrapped round it
  px(ctx, 2, 11, 'steelD', 12, 4); px(ctx, 3, 11, 'steel', 10, 1); px(ctx, 3, 14, 'night', 10, 1); // the bowl
  if (!lit) { px(ctx, 4, 10, 'slate', 8, 1); px(ctx, 6, 9, 'stone', 3, 1); }
  else {
    const flame = [
      ['....f.....', '...fFf....', '..fFFFf...', '..fFwFFf..', '.fFFwwFf..', '.fFwwwFFf.', '..fFwwFf..'],
      ['.....f....', '....fF....', '...fFFf...', '..fFwFFf..', '..fFwwFf..', '.fFwwwFFf.', '..fFwwFf..'],
      ['...f......', '...Ff.f...', '..fFFFf...', '.fFFwFf...', '.fFwwFFf..', '.fFwwwFFf.', '..fFwwFf..'],
    ][f % 3];
    flame.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(ctx, 3 + x, 3 + y, ch === 'f' ? 'fire' : ch === 'F' ? 'fireL' : 'goldL'); }));
  }
  outline(c, 'ink');
  return c;
}

// The Seer's Lens shows a false wall for what it is: a shimmering veil of
// violet light over the stone (drawn over the wall tile, two shimmer frames).
export function falseWall(f = 0) {
  const [c, ctx] = makeCanvas(16, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
    const n = hash(x, y + f * 7, 41);
    if (n < 0.16) px(ctx, x, y, 'curseL');
    else if (n < 0.3) px(ctx, x, y, 'purpL');
  }
  for (let y = (f * 5) % 6; y < 32; y += 6) px(ctx, 0, y, 'white', 16, 1);
  return c;
}

// A bridge of light over a chasm, there only through the Lens (one tile).
export function spiritBridge() {
  const [c, ctx] = makeCanvas(16, 16);
  for (let y = 1; y < 16; y += 5) { px(ctx, 0, y, 'blueL', 16, 3); px(ctx, 0, y, 'white', 16, 1); px(ctx, 0, y + 2, 'blue', 16, 1); }
  px(ctx, 1, 0, 'crystal', 1, 16); px(ctx, 14, 0, 'crystal', 1, 16); // rails
  return c;
}

// ------------------------------------------------------------ the Forge of Ash
// A heavy boulder: rough basalt bound with an iron band. Only the Stone
// Gauntlets can shift it.
export function heavyBoulder() {
  const [c, ctx] = makeCanvas(20, 20);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const nx = (x - 9) / 8.5, ny = (y - 10) / 8;
    const d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = 0.5 - nx * 0.35 - ny * 0.5 + (hash(x, y, 51) - 0.5) * 0.3;
    px(ctx, x + 1, y + 1, l > 0.55 ? 'basaltL' : l > 0.15 ? 'basalt' : 'basaltD');
  }
  px(ctx, 2, 9, 'steelD', 16, 2); px(ctx, 2, 9, 'steel', 16, 1); // iron band
  px(ctx, 8, 8, 'steelL', 2, 4); // its rivet
  px(ctx, 5, 4, 'ashL', 2, 1); px(ctx, 12, 14, 'basaltL', 3, 1);
  outline(c, 'ink');
  return c;
}
// ...and once it's rolled into the lava: a cooling slab you can walk on
export function sunkBoulder() {
  const [c, ctx] = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x < 1 || y < 1 || x > 14 || y > 14;
    px(ctx, x, y, edge ? 'lavaD' : hash(x, y, 52) < 0.2 ? 'basaltL' : (x + y) % 7 === 0 ? 'lavaD' : 'basalt');
  }
  px(ctx, 3, 7, 'steelD', 10, 1);
  return c;
}
// Reinforced wall: a cracked dwarven wall bound with iron straps. Blades
// glance off it; a fist of stone breaks it. 'face' = wall seen front-on.
export function reinforcedWall(face) {
  const c = crackedWall(face);
  const ctx = c.getContext('2d');
  const H = face ? 32 : 16;
  for (const y of face ? [8, 22] : [4, 11]) { px(ctx, 0, y, 'steelD', 16, 2); px(ctx, 0, y, 'steel', 16, 1); px(ctx, 3, y, 'steelL'); px(ctx, 12, y, 'steelL'); }
  void H;
  return c;
}
