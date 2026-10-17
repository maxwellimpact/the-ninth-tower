// Non-humanoid creatures and NPCs, drawn procedurally or from small grids.
import { makeCanvas, grid, px, outline, bayer } from './pixel.js';

// Shaded ellipse "blob" body, lit from the top-left, with ordered dithering
// between tones. Basis for slimes, bushes, canopies.
export function shadedBlob(ctx, cx, cy, rx, ry, tones, opts = {}) {
  const [dark, mid, light, hi] = tones;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      // light term: top-left bright, bottom-right dark, rim darkening
      const l = 0.55 - nx * 0.35 - ny * 0.55 - d * 0.35 + (opts.bias || 0);
      const t = l + (bayer(x, y) - 0.5) * 0.28;
      let col = t > 0.62 ? light : t > 0.18 ? mid : dark;
      if (hi && nx < -0.15 && nx > -0.55 && ny < -0.25 && ny > -0.7 && d < 0.6) col = hi;
      px(ctx, x, y, col);
    }
  }
}

// ------------------------------------------------------------- Hexling
// Cursed slime. 32x32 frames; feet rest on y=26.
const HEX_TONES = ['purpD', 'purp', 'purpL', 'curseL'];

function hexFrame({ w, h, lift = 0, eye = 'curseL', tones = HEX_TONES, angry = false }) {
  const [c, ctx] = makeCanvas(32, 32);
  const cx = 16, cy = 26 - lift - h / 2;
  shadedBlob(ctx, cx, cy, w / 2, h / 2, tones);
  // drips at the base
  if (!lift) { px(ctx, cx - w / 2 + 2, 26, tones[0]); px(ctx, cx + w / 2 - 3, 26, tones[0]); }
  // eyes
  const ey = Math.round(cy - h * 0.08);
  for (const ex of [cx - 4, cx + 2]) {
    px(ctx, ex, ey, eye, 2, 2);
    px(ctx, ex + (angry ? 0 : 1), ey + 1, 'hexD');
  }
  if (angry) { px(ctx, cx - 5, ey - 1, 'hexD', 3, 1); px(ctx, cx + 2, ey - 1, 'hexD', 3, 1); }
  // jagged mouth
  const my = ey + 3;
  for (let i = -2; i <= 2; i++) px(ctx, cx + i - 1, my + (i & 1), 'hexD');
  outline(c, 'ink');
  return c;
}

export const MIRE_TONES = ['bogD', 'bog', 'bogL', 'bogXL'];

export function buildHexling(tones = HEX_TONES, eye = 'curseL') {
  const f = (o) => hexFrame({ tones, eye, ...o });
  return {
    idle: [f({ w: 16, h: 11 }), f({ w: 17, h: 10 })],
    walk: [f({ w: 18, h: 9 }), f({ w: 13, h: 14, lift: 3 }), f({ w: 14, h: 12, lift: 5 }), f({ w: 19, h: 8 })],
    windup: [f({ w: 19, h: 9, angry: true }), f({ w: 20, h: 8, angry: true, eye: 'white' })],
    attack: [f({ w: 12, h: 15, lift: 4, angry: true }), f({ w: 18, h: 10, angry: true })],
    hurt: [f({ w: 14, h: 12, eye: 'white' })],
  };
}

// ------------------------------------------------------------- Hex Golem
// 64x64 frames, feet at y=60. Rock body, glowing hex runes, mossy shoulders.
const STONE = ['slate', 'stone', 'mist', 'bone'];
const GOLEM = ['night', 'slate', 'stone', 'mist']; // darker so it pops against cursed ground
function golemFrame({ fl, fr, bob = 0, eye = 'curseL', crouch = 0, rune = 'curseL' }) {
  const [c, ctx] = makeCanvas(64, 64);
  const by = bob + crouch;
  // legs
  shadedBlob(ctx, 25.5, 56, 5, 4.5, GOLEM);
  shadedBlob(ctx, 38.5, 56, 5, 4.5, GOLEM);
  // arms (thick stone limbs) behind the body
  const limb = (sx, sy, ex, ey) => {
    const n = Math.ceil(Math.hypot(ex - sx, ey - sy));
    for (let i = 0; i <= n; i++) { const t = i / n; px(ctx, Math.round(sx + (ex - sx) * t) - 2, Math.round(sy + (ey - sy) * t) - 2, 'slate', 5, 5); }
  };
  limb(19, 33 + by, fl.x, fl.y);
  limb(45, 33 + by, fr.x, fr.y);
  // body + head
  shadedBlob(ctx, 32, 40 + by, 15, 12.5, GOLEM);
  shadedBlob(ctx, 32, 23 + by, 8.5, 7, GOLEM);
  // hex runes
  for (const [x, y] of [[31, 35], [32, 36], [33, 35], [32, 37], [32, 38], [32, 39], [31, 40], [33, 40], [26, 43], [27, 44], [26, 45], [38, 43], [37, 44], [38, 45], [22, 38], [42, 38]]) px(ctx, x, y + by, rune);
  px(ctx, 31, 37 + by, 'curseL', 3, 1);
  // eyes
  px(ctx, 28, 23 + by, eye, 2, 2); px(ctx, 34, 23 + by, eye, 2, 2);
  px(ctx, 27, 21 + by, 'night', 4, 1); px(ctx, 33, 21 + by, 'night', 4, 1);
  // moss
  for (const [x, y, w] of [[20, 29, 6], [38, 29, 6], [29, 16, 6], [24, 31, 3]]) px(ctx, x, y + by, 'grass', w, 1);
  for (const [x, y] of [[21, 30], [25, 30], [40, 30], [43, 30], [31, 17]]) px(ctx, x, y + by, 'leafD', 1, 2);
  // fists in front
  shadedBlob(ctx, fl.x, fl.y, 6, 5.5, GOLEM);
  shadedBlob(ctx, fr.x, fr.y, 6, 5.5, GOLEM);
  outline(c, 'ink');
  return c;
}

export function buildGolem() {
  const F = (o) => golemFrame(o);
  const rest = { fl: { x: 13, y: 46 }, fr: { x: 51, y: 46 } };
  return {
    idle: [F({ ...rest }), F({ ...rest, bob: 1, fl: { x: 13, y: 47 }, fr: { x: 51, y: 47 } })],
    walk: [
      F({ fl: { x: 13, y: 43 }, fr: { x: 51, y: 48 }, bob: 0 }),
      F({ fl: { x: 13, y: 45 }, fr: { x: 51, y: 46 }, bob: -1 }),
      F({ fl: { x: 13, y: 48 }, fr: { x: 51, y: 43 }, bob: 0 }),
      F({ fl: { x: 13, y: 46 }, fr: { x: 51, y: 45 }, bob: -1 }),
    ],
    windup: [
      F({ fl: { x: 19, y: 12 }, fr: { x: 45, y: 12 }, eye: 'white', bob: -1 }),
      F({ fl: { x: 20, y: 9 }, fr: { x: 44, y: 9 }, eye: 'white', bob: -2, rune: 'white' }),
    ],
    slam: [
      F({ fl: { x: 24, y: 57 }, fr: { x: 40, y: 57 }, crouch: 3, rune: 'white' }),
      F({ fl: { x: 24, y: 57 }, fr: { x: 40, y: 57 }, crouch: 2 }),
    ],
    throw: [
      F({ fl: { x: 13, y: 46 }, fr: { x: 52, y: 16 }, eye: 'white' }),
      F({ fl: { x: 13, y: 46 }, fr: { x: 44, y: 34 }, bob: 1 }),
    ],
    hurt: [F({ ...rest, eye: 'white' })],
  };
}

// Thrown boulder.
export function boulder() {
  const [c, ctx] = makeCanvas(14, 12);
  shadedBlob(ctx, 7, 6, 6, 5, STONE);
  px(ctx, 5, 5, 'curse');
  outline(c, 'ink');
  return c;
}

// ------------------------------------------------------------- Frog King
const FROG_MAP = { y: 'gold', Y: 'goldL', F: 'grass', f: 'grassD', L: 'grassXL', W: 'white', E: 'ink', R: 'red', r: 'redD', m: 'leafD' };
const FROG = [
  '...y.Y.y...',
  '...yyyyy...',
  '..FWFFFWF..',
  '.FWEFFFEWF.',
  '.FFFFFFFFF.',
  'rFFmmmmmFFr',
  'RRFFFFFFFRR',
  'RRFLLLLLFRR',
  '.RFLLLLLFR.',
  '..ff...ff..',
];
const FROG_PUFF = [
  '...y.Y.y...',
  '...yyyyy...',
  '..FWFFFWF..',
  '.FWEFFFEWF.',
  '.FFFFFFFFF.',
  'rFFmmmmmFFr',
  'RRFLLLLLFRR',
  'RLLLLLLLLLR',
  '.RFLLLLLFR.',
  '..ff...ff..',
];
export function buildFrogKing() {
  const f = (rows) => {
    const [c, ctx] = makeCanvas(32, 32);
    grid(ctx, rows, FROG_MAP, 11, 26 - rows.length + 1);
    outline(c, 'ink');
    return c;
  };
  return { idle: [f(FROG), f(FROG), f(FROG_PUFF)] };
}

// Portrait (for dialogue + party HUD): crop a frame's head region, scaled 1x.
export function portraitFrom(frame, sx, sy, size = 16) {
  const [c, ctx] = makeCanvas(size, size);
  ctx.drawImage(frame, sx, sy, size, size, 0, 0, size, size);
  return c;
}

// ------------------------------------------------------------ Rat swarm
// Four rats scurrying as one enemy. 32x32 frames, feet on y=26.
const RAT = { R: 'stone', r: 'slate', d: 'night', E: 'redL', T: 'skinD' };
function ratAt(ctx, x, y, flip, frame) {
  const body = frame ? ['.rRRr..', 'rRRRRrT', 'drRRrd.', '.d..d..'] : ['.rRRr..', 'rRRRRr.', 'drRRrdT', 'd....d.'];
  grid(ctx, body, RAT, x, y, flip);
  px(ctx, flip ? x + 5 : x + 1, y, 'redL');
}
function ratsFrame(phase, jump = 0) {
  const [c, ctx] = makeCanvas(32, 32);
  const spots = [[6, 20, false], [17, 18, true], [10, 23, true], [20, 23, false]];
  spots.forEach(([x, y, f], i) => ratAt(ctx, x + ((phase + i) % 2), y - (jump && i % 2 ? jump : 0), f, (phase + i) % 2));
  outline(c, 'ink');
  return c;
}
export function buildRats() {
  return {
    idle: [ratsFrame(0), ratsFrame(1)],
    walk: [ratsFrame(0), ratsFrame(1), ratsFrame(0, 1), ratsFrame(1, 1)],
    windup: [ratsFrame(0, 2)],
    attack: [ratsFrame(1, 3), ratsFrame(0)],
    hurt: [ratsFrame(1)],
  };
}

// collapsed Hollow Guard armour (it reassembles unless smashed)
export function hollowPile() {
  const [c, ctx] = makeCanvas(24, 16);
  grid(ctx, [
    '.....kkkk...........',
    '....kKKKKk..........',
    '....kKEEKk...ddd....',
    '.....kKKk...dKKKd...',
    '..kkk..k...dKkkKd...',
    '.kKKKk....kdKKKKdk..',
    'kKkkKKkkkkKKkkkkKKk.',
    'kkkkkkkkkkkkkkkkkkk.',
  ], { k: 'steelD', K: 'mist', E: 'curseL', d: 'slate' }, 2, 6);
  outline(c, 'ink');
  return c;
}

// armour plate bolted onto the Gatewarden in phase 2 (hooked off with the Grapple)
export function golemPlate() {
  const [c, ctx] = makeCanvas(14, 16);
  grid(ctx, ['.kkkkkkkk.', 'kKWWKKKKKk', 'kWKKKKKKKk', 'kKKdKKdKKk', 'kKKKKKKKKk', 'kKKKKKKKKk', 'kKKdKKdKKk', 'kKKKKKKKKk', '.kKKKKKKk.', '..kkkkkk..'], { k: 'steelD', K: 'steel', W: 'steelL', d: 'night' }, 2, 3);
  outline(c, 'ink');
  return c;
}

// --------------------------------------------------------- Thornback Boar
const BOAR = { B: 'dirtD', b: 'woodD', L: 'dirt', T: 'bone', E: 'redL', S: 'grassD', s: 'leafD', N: 'skinD' };
function boarFrame(step = 0, lower = 0) {
  const [c, ctx] = makeCanvas(32, 32);
  const body = [
    '......s.s.s.........',
    '.....sSsSsSs........',
    '...bBBBBBBBBBb......',
    '..bBLLLBBBBBBBb.....',
    '.bBLLBBBBBBBBBBbb...',
    'TbBBBBBBBBBBBBBBb...',
    'NNEBBBBBBBBBBBBbb...',
    'TNNBBBBBBBBBBBbb....',
    '.bbbBBBBBBBBBbb.....',
  ];
  grid(ctx, body, BOAR, 6, 13 + lower);
  const legs = step % 2 ? ['.bb...bb...bb..bb.', '.b....b.....b..b..'] : ['..bb..bb..bb...bb.', '..b....b..b.....b.'];
  grid(ctx, legs, BOAR, 7, 22);
  outline(c, 'ink');
  return c;
}
export function buildBoar() {
  return {
    idle: [boarFrame(0), boarFrame(0, 0)],
    walk: [boarFrame(0), boarFrame(1)],
    windup: [boarFrame(0, 1), boarFrame(1, 1)],
    attack: [boarFrame(1), boarFrame(0)],
    hurt: [boarFrame(0)],
  };
}

// --------------------------------------------------------------- Pond Crab
const CRAB = { R: 'redD', r: 'red', L: 'redL', W: 'white', E: 'ink', k: 'woodD' };
function crabFrame(step = 0, claws = 0, flipped = false) {
  const [c, ctx] = makeCanvas(32, 32);
  const shell = ['....rrrrrrrr....', '..rrLLrrrrrrrr..', '.rLLrrrrrrrrrrr.', 'rrrrrrrrrrrrrrrr', 'RrrrrrrrrrrrrrrR', '.RRRRRRRRRRRRRR.'];
  const eyes = ['....W......W....', '....E......E....'];
  if (!flipped) grid(ctx, eyes, CRAB, 8, 13);
  grid(ctx, flipped ? [...shell].reverse() : shell, CRAB, 8, 15);
  const cl = claws ? ['rr..', 'rLr.', '.rr.'] : ['.rr.', 'rLr.', 'rr..'];
  grid(ctx, cl, CRAB, 4 - claws, 14); grid(ctx, cl, CRAB, 24 + claws, 14, true);
  const legs = step % 2 ? ['.r.r.r....r.r.r.', 'r.r.r......r.r.r'] : ['r.r.r......r.r.r', '.r.r.r....r.r.r.'];
  grid(ctx, legs, CRAB, 8, flipped ? 13 : 21);
  outline(c, 'ink');
  return c;
}
export function buildCrab() {
  return {
    idle: [crabFrame(0), crabFrame(0, 1)],
    walk: [crabFrame(0), crabFrame(1)],
    windup: [crabFrame(0, 2), crabFrame(0, 2)],
    attack: [crabFrame(1, 0), crabFrame(0, 1)],
    hurt: [crabFrame(0)],
    flipped: [crabFrame(0, 0, true), crabFrame(1, 0, true)],
  };
}

// ---------------------------------------------------------------- Hex Wisp
function wispFrame(f) {
  const [c, ctx] = makeCanvas(32, 32);
  const bob = [0, 1, 2, 1][f];
  shadedBlob(ctx, 16, 14 + bob, 5, 5, ['purpD', 'purp', 'curseL', 'white']);
  px(ctx, 14, 13 + bob, 'white', 1, 2); px(ctx, 17, 13 + bob, 'white', 1, 2);
  for (let i = 0; i < 3; i++) px(ctx, 15 + ((f + i) % 3) - 1, 20 + bob + i * 2, i ? 'purp' : 'curseL');
  outline(c, 'ink');
  return c;
}
export function buildWisp() {
  const fr = [0, 1, 2, 3].map(wispFrame);
  return { idle: fr, walk: fr, windup: [fr[0], fr[2]], attack: [fr[1], fr[3]], hurt: [fr[0]] };
}

// ------------------------------------------------------------ Leech swarm
function leechFrame(phase, jump = 0) {
  const [c, ctx] = makeCanvas(32, 32);
  const spots = [[7, 21], [16, 19], [11, 24], [20, 24], [24, 20]];
  spots.forEach(([x, y], i) => {
    const w = (phase + i) % 2 ? 5 : 4;
    const yy = y - (jump && i % 2 ? jump : 0);
    px(ctx, x, yy, 'bogD', w, 2); px(ctx, x + 1, yy, 'bogL', w - 2, 1); px(ctx, x + w - 1, yy - 1, 'redD');
  });
  outline(c, 'ink');
  return c;
}
export function buildLeeches() {
  return { idle: [leechFrame(0), leechFrame(1)], walk: [leechFrame(0), leechFrame(1), leechFrame(0, 1), leechFrame(1, 1)], windup: [leechFrame(0, 2)], attack: [leechFrame(1, 3), leechFrame(0)], hurt: [leechFrame(1)] };
}

// -------------------------------------------------------------- Bog Lurker
// Mostly a head with a jaw full of teeth; it lives under the water.
function lurkerFrame(open = 0, sub = 0) {
  const [c, ctx] = makeCanvas(32, 32);
  const y0 = 12 + sub;
  shadedBlob(ctx, 16, y0 + 5, 9, 6, ['bogD', 'bog', 'bogL', 'bogXL']);
  px(ctx, 11, y0 + 1, 'goldL', 2, 2); px(ctx, 19, y0 + 1, 'goldL', 2, 2); px(ctx, 12, y0 + 2, 'ink'); px(ctx, 20, y0 + 2, 'ink');
  if (open) { px(ctx, 9, y0 + 7, 'redD', 14, 2 + open); for (let x = 10; x < 22; x += 2) { px(ctx, x, y0 + 7, 'white'); px(ctx, x + 1, y0 + 8 + open, 'white'); } }
  else px(ctx, 9, y0 + 7, 'bogD', 14, 1);
  // water line hides the rest
  px(ctx, 4, 24, 'waterL', 24, 1); px(ctx, 6, 25, 'water', 20, 1);
  ctx.clearRect(0, 26, 32, 6);
  outline(c, 'ink');
  return c;
}
export function buildLurker() {
  return { idle: [lurkerFrame(0, 2), lurkerFrame(0, 3)], walk: [lurkerFrame(0, 2), lurkerFrame(0, 3)], windup: [lurkerFrame(1), lurkerFrame(2)], attack: [lurkerFrame(3), lurkerFrame(1)], hurt: [lurkerFrame(0)] };
}

// ----------------------------------------------------------------- Croaker
const TOAD = { G: 'moss', g: 'mossD', L: 'mossL', Y: 'sand', E: 'goldL', k: 'ink', R: 'redL' };
function croakerFrame(puff = 0, step = 0, tongue = 0) {
  const [c, ctx] = makeCanvas(40, 32);
  shadedBlob(ctx, 20, 20 - puff * 0.5, 12 + puff, 8 + puff * 0.5, ['mossD', 'moss', 'mossL', 'mossXL']);
  shadedBlob(ctx, 20, 24, 8, 4, ['mud', 'sand', 'sand', 'bone']);
  for (const ex of [13, 25]) { shadedBlob(ctx, ex, 12 - puff, 3, 3, ['mossD', 'moss', 'mossL', 'mossXL']); px(ctx, ex - 1, 11 - puff, 'goldL', 2, 2); px(ctx, ex, 12 - puff, 'ink'); }
  px(ctx, 12, 18, 'mossD', 16, 1);
  if (tongue) { px(ctx, 19, 19, 'redL', 2, 8 + tongue * 3); px(ctx, 18, 26 + tongue * 3, 'redL', 4, 2); }
  const legY = 26 + (step ? 1 : 0);
  px(ctx, 7, legY, 'mossD', 5, 3); px(ctx, 28, 27 - (step ? 1 : 0), 'mossD', 5, 3);
  outline(c, 'ink');
  return c;
}
export function buildCroaker() {
  return { idle: [croakerFrame(0), croakerFrame(1)], walk: [croakerFrame(0, 0), croakerFrame(0, 1)], windup: [croakerFrame(2), croakerFrame(2)], attack: [croakerFrame(0, 0, 2), croakerFrame(0, 0, 1)], hurt: [croakerFrame(0)] };
}

// ------------------------------------------------------------- Old Snapjaw
function snapjawFrame(step = 0, open = 0, flipped = false) {
  const [c, ctx] = makeCanvas(48, 40);
  if (flipped) {
    shadedBlob(ctx, 24, 22, 17, 10, ['mud', 'sand', 'sand', 'bone']);
    for (let i = 0; i < 4; i++) px(ctx, 12 + i * 7 + (step ? 1 : 0), 10, 'mossD', 3, 4);
  } else {
    shadedBlob(ctx, 24, 20, 17, 11, ['leafD', 'mossD', 'moss', 'mossL']);
    for (let y = 13; y < 28; y += 5) for (let x = 12; x < 38; x += 7) px(ctx, x + ((y / 5) % 2) * 3, y, 'leafD', 4, 1);
    shadedBlob(ctx, 24, 32, 6, 4, ['mossD', 'moss', 'mossL', 'mossXL']);
    px(ctx, 21, 31, 'goldL'); px(ctx, 26, 31, 'goldL');
    if (open) { px(ctx, 20, 34, 'redD', 8, 2); px(ctx, 20, 34, 'white', 8, 1); }
    px(ctx, 6 + (step ? 1 : 0), 26, 'mossD', 5, 5); px(ctx, 37 - (step ? 1 : 0), 26, 'mossD', 5, 5);
  }
  outline(c, 'ink');
  return c;
}
export function buildSnapjaw() {
  return { idle: [snapjawFrame(0), snapjawFrame(0)], walk: [snapjawFrame(0), snapjawFrame(1)], windup: [snapjawFrame(0, 1), snapjawFrame(1, 1)], attack: [snapjawFrame(0, 2), snapjawFrame(1, 0)], hurt: [snapjawFrame(0)], flipped: [snapjawFrame(0, 0, true), snapjawFrame(1, 0, true)] };
}

// ------------------------------------------------------------ Mother Murk
// A bog hag riding a vast toad. 64x64 frames, feet on y=60.
function murkFrame({ puff = 0, open = 0, raise = 0 } = {}) {
  const [c, ctx] = makeCanvas(64, 64);
  shadedBlob(ctx, 32, 46 - puff, 24 + puff, 14 + puff * 0.6, ['mossD', 'moss', 'mossL', 'mossXL']);
  shadedBlob(ctx, 32, 54, 15, 6, ['mud', 'sand', 'sand', 'bone']);
  for (const ex of [18, 46]) { shadedBlob(ctx, ex, 34 - puff, 5, 5, ['mossD', 'moss', 'mossL', 'mossXL']); px(ctx, ex - 2, 33 - puff, 'redL', 3, 3); px(ctx, ex - 1, 34 - puff, 'ink'); }
  if (open) { px(ctx, 18, 48, 'redD', 28, 3 + open); for (let x = 19; x < 45; x += 3) px(ctx, x, 48, 'white'); }
  else px(ctx, 18, 48, 'mossD', 28, 1);
  // the hag: hunched in a shawl on the toad's back
  shadedBlob(ctx, 32, 24, 8, 9, ['purpD', 'hexD', 'purp', 'curseL']);
  shadedBlob(ctx, 32, 14, 5, 5, ['mossD', 'grassD', 'moss', 'mossL']);
  px(ctx, 30, 13, 'goldL'); px(ctx, 34, 13, 'goldL');
  px(ctx, 27, 8, 'night', 11, 2); px(ctx, 29, 4, 'night', 7, 4); px(ctx, 31, 1, 'night', 3, 3);
  const ay = 22 - raise * 6;
  px(ctx, 22, ay, 'moss', 3, 6); px(ctx, 40, ay, 'moss', 3, 6);
  if (raise) { px(ctx, 21, ay - 2, 'curseL', 5, 2); px(ctx, 39, ay - 2, 'curseL', 5, 2); }
  outline(c, 'ink');
  return c;
}
export function buildMurk() {
  return {
    idle: [murkFrame(), murkFrame({ puff: 1 })],
    walk: [murkFrame(), murkFrame({ puff: 1 })],
    windup: [murkFrame({ puff: 2, raise: 1 }), murkFrame({ puff: 3, raise: 1 })],
    slam: [murkFrame({ open: 3 }), murkFrame({ open: 1 })],
    hurt: [murkFrame()],
  };
}

// ================================================================ Gloamwood
// Drawn the way the Vale and Mistfen creatures are: chunky grids with a
// lit top-left (a light tone and a highlight), a dark underside, and the ink
// outline every sprite shares. The Shade and the Banshee are puppets (heroes.js).

// ---------------------------------------------------------------- Rootling
// A stump that walked a little and then decided to stay: ridged bark, a
// shock of leaves, ember eyes, a branch arm that flings thorns.
const ROOT = { b: 'barkD', B: 'bark', L: 'barkL', w: 'woodL', E: 'fireL', e: 'fire', k: 'ink', f: 'fernD', F: 'fern', G: 'fernL', g: 'grassXL' };
function rootlingFrame({ arm = 0, sway = 0, blink = false }) {
  const [c, ctx] = makeCanvas(32, 32);
  const crown = [
    '....GgG.GG......',
    '..GGFGGgFGGG....',
    '.GFFFGFFFFGFG...',
    'GFFfFFFFFfFFFG..',
    '.FfffFFfffFFf...',
    '..ff.fff.ff.....',
  ];
  void crown;
  // a shock of leaves: overlapping shaded clumps, lit from the top-left, with a
  // few stray leaves sticking up
  const LEAVES = ['fernD', 'fern', 'fernL', 'grassXL'];
  for (const [x, y, rx, ry] of [[11, 10, 4, 3.5], [21, 10, 4, 3.5], [16, 7, 5, 4], [13, 4, 3, 2.5], [19, 4, 3, 2.5]]) shadedBlob(ctx, x + sway, y, rx, ry, LEAVES);
  for (const [x, y] of [[10, 1], [16, 0], [22, 2], [7, 7], [25, 7]]) { px(ctx, x + sway, y, 'fernL', 1, 2); px(ctx, x + sway, y + 2, 'fern'); }
  const trunk = [
    '..bBBLLBBb..',
    '.bBLwLBBLBb.',
    '.BBLLBBLBBB.',
    'bBkkBBBkkBBb',
    'bBkEBBBkEBBb',
    'bBBBBLBBBBBb',
    'bBBkkkkkBBBb',
    'bBBBLBBBLBBb',
    '.bBBLBBBLBb.',
    '.bBBBBBBBBb.',
    'bbBBb..bBBbb',
    'b.bb....bb.b',
  ];
  const t = blink ? trunk.map((r) => r.replace(/E/g, 'k')) : trunk;
  grid(ctx, t, ROOT, 10, 13);
  // the branch arm: down at rest, cocked back to throw, flung forward
  const arms = [['bB', '.bB', '..bB', '...G'], ['...G', '..bG', '.bB.', 'bB..'], ['bBBBG', '.....', '.....', '.....']];
  grid(ctx, arms[arm], ROOT, 21, arm === 1 ? 10 : 17);
  outline(c, 'ink');
  return c;
}
export function buildRootling() {
  return {
    idle: [rootlingFrame({}), rootlingFrame({ sway: 1 })],
    walk: [rootlingFrame({}), rootlingFrame({ sway: 1 })],
    windup: [rootlingFrame({ arm: 1 }), rootlingFrame({ arm: 1, sway: 1 })],
    attack: [rootlingFrame({ arm: 2 }), rootlingFrame({})],
    hurt: [rootlingFrame({ blink: true })],
  };
}

// ------------------------------------------------------------ Gloom Spider
// Seen from above like the crab: a round shaded abdomen with a pale hourglass,
// a small head with a cluster of red eyes and white fangs, and eight bent legs
// two pixels thick that scuttle in alternating sets.
const SPIDER = { k: 'night', P: 'purpD', p: 'purp', L: 'purpL', C: 'curseL', E: 'redL', W: 'white', h: 'bone' };
function spiderFrame({ step = 0, rear = 0, open = false }) {
  const [c, ctx] = makeCanvas(32, 32);
  const legsA = [
    'kk..........kk',
    '.kk........kk.',
    '..k........k..',
    'k..k......k..k',
    '.kk.k....k.kk.',
    '....k....k....',
    '.kkk......kkk.',
    'k............k',
  ];
  const legsB = [
    '.kk........kk.',
    'k..k......k..k',
    '...k......k...',
    '.kk.k....k.kk.',
    'k...k....k...k',
    '..kk......kk..',
    '.k..........k.',
    'k............k',
  ];
  grid(ctx, step % 2 ? legsB : legsA, SPIDER, 9, 13 - rear);
  const body = [
    '....PPPP....',
    '..PppLLppP..',
    '.PpLLppppPP.',
    '.PpLpCCppPP.',
    'PppppCCpppPP',
    'PpppCppCppPP',
    '.PppppppppP.',
    '..PPppppPP..',
    '....PPPP....',
  ];
  grid(ctx, body, SPIDER, 10, 15 - rear);
  const head = open ? ['..PPPP..', '.PpEEpP.', '.PEppEP.', '..PPPP..', '..W..W..', '.W....W.'] : ['..PPPP..', '.PpEEpP.', '.PEppEP.', '..PPPP..', '..W..W..'];
  grid(ctx, head, SPIDER, 12, 9 - rear);
  outline(c, 'ink');
  return c;
}
function shrink(src, f) {
  // spiderlings: the same drawing at a smaller size, re-outlined
  const [c, ctx] = makeCanvas(32, 32);
  ctx.imageSmoothingEnabled = false;
  const w = Math.round(32 * f);
  ctx.drawImage(src, 0, 0, 32, 32, Math.round((32 - w) / 2), 32 - w - 4, w, w);
  return c;
}
export function buildSpider(size = 1) {
  const f = (o) => (size < 1 ? shrink(spiderFrame(o), size) : spiderFrame(o));
  return {
    idle: [f({ step: 0 }), f({ step: 0, rear: 1 })],
    walk: [f({ step: 0 }), f({ step: 1 }), f({ step: 0 }), f({ step: 1 })],
    windup: [f({ rear: 1, open: true }), f({ rear: 2, open: true })],
    attack: [f({ step: 1, open: true }), f({ step: 0 })],
    hurt: [f({ step: 0 })],
  };
}
// Queen Mab: the spider queen. Long jointed legs reach well past a swollen,
// shaded abdomen marked with a pale skull; a big head crowned with bone
// spines, a cluster of red eyes and long white fangs (56x48 frames).
function mabFrame({ step = 0, rear = 0, open = false }) {
  const [c, ctx] = makeCanvas(56, 48);
  const cx = 28, cy = 30 - rear;
  // legs: 4 per side, thick, each with a raised knee; alternating sets lift
  const seg = (ax, ay, bx, by, col) => { const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)))); for (let k = 0; k <= n; k++) px(ctx, Math.round(ax + (bx - ax) * k / n) - 1, Math.round(ay + (by - ay) * k / n) - 1, col, 2, 2); };
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const lift = ((i + step + (side > 0 ? 1 : 0)) % 2) * 2;
    const ax = cx + side * 6, ay = cy - 6 + i * 3;
    const kx = cx + side * (14 + i * 2), ky = cy - 16 + i * 5 - lift;
    const fx = cx + side * (20 + i * 2), fy = cy - 2 + i * 6 - lift;
    seg(ax, ay, kx, ky, 'night'); seg(kx, ky, fx, fy, 'night');
    px(ctx, kx - 1, ky - 1, 'purp', 2, 1); // a glint on each knee
  }
  // abdomen
  shadedBlob(ctx, cx, cy + 4, 11, 9, ['night', 'purpD', 'purp', 'purpL']);
  const skull = ['.SSSS.', 'SkSSkS', 'SSSSSS', '.S.S..'];
  grid(ctx, skull, { S: 'bone', k: 'night' }, cx - 3, cy + 2);
  // head
  shadedBlob(ctx, cx, cy - 8, 6.5, 5, ['night', 'purpD', 'purp', 'purpL']);
  for (const [x, y] of [[-5, -15], [-2, -16], [2, -16], [5, -15], [0, -17]]) px(ctx, cx + x, cy + y, 'bone', 1, 3); // crown of spines
  for (const [x, y] of [[-3, -10], [2, -10], [-1, -11], [0, -11], [-4, -8], [3, -8]]) px(ctx, cx + x, cy + y, 'redL', 1, 1);
  const fy = cy - 4 + (open ? 1 : 0);
  px(ctx, cx - 3, fy, 'white', 1, open ? 4 : 3); px(ctx, cx + 2, fy, 'white', 1, open ? 4 : 3);
  outline(c, 'ink');
  return c;
}
export function buildMab() {
  return {
    idle: [mabFrame({}), mabFrame({ rear: 1 })],
    walk: [mabFrame({ step: 0 }), mabFrame({ step: 1 }), mabFrame({ step: 0 }), mabFrame({ step: 1 })],
    windup: [mabFrame({ rear: 1, open: true }), mabFrame({ rear: 2, open: true })],
    attack: [mabFrame({ step: 1, open: true }), mabFrame({})],
    hurt: [mabFrame({})],
  };
}
export function eggSac() {
  const [c, ctx] = makeCanvas(16, 16);
  shadedBlob(ctx, 8, 9, 5, 5.5, ['mist', 'web', 'bone', 'white']);
  px(ctx, 6, 8, 'purpL'); px(ctx, 9, 10, 'purpL'); px(ctx, 7, 11, 'purp');
  outline(c, 'ink');
  return c;
}

// ---------------------------------------------------------- Spectral Hound
// Built like the boar: a lean grid body in profile, lit along the back,
// with a glowing eye, pricked ears and a tail that trails into mist.
const HOUND = { d: 'blueD', b: 'blue', L: 'blueL', W: 'white', E: 'glowL', k: 'ink', m: 'mist' };
function houndFrame({ step = 0, crouch = 0, leap = 0, blink = false }) {
  const [c, ctx] = makeCanvas(32, 32);
  const body = [
    '................LL.L..',
    '...............LbLbL..',
    '..............LbbbbbW.',
    'm.............bbEbbbWW',
    '.m..LLLLLLLLLbbbbbbbb.',
    'mm.LbbbbbbbbbbbbbbdW..',
    '..mbbbbbbbbbbbbbbd....',
    '...dbbbbbbbbbbbbd.....',
    '....ddbbbbbbbddd......',
  ];
  const b = blink ? body.map((r) => r.replace('E', 'd')) : body;
  const y0 = 11 + crouch - leap;
  grid(ctx, b, HOUND, 5, y0);
  const legs = leap ? ['....bb.......bb.....', '.....b........b.....'] : step % 2
    ? ['....bb....bb..bb.bb..', '....b......b..b...b..', '...bb.....bb..bb..bb.']
    : ['.....bb..bb....bb.bb.', '.....b...b.....b..b..', '....bb..bb....bb..bb.'];
  grid(ctx, legs, HOUND, 5, y0 + 9);
  outline(c, 'ink');
  return c;
}
export function buildHound() {
  return {
    idle: [houndFrame({}), houndFrame({ step: 0, crouch: 0 })],
    walk: [0, 1, 0, 1].map((st, i) => houndFrame({ step: st, crouch: i % 2 })),
    windup: [houndFrame({ crouch: 2 }), houndFrame({ crouch: 2, step: 1 })],
    attack: [houndFrame({ leap: 3 }), houndFrame({ step: 1 })],
    hurt: [houndFrame({ blink: true })],
  };
}

// ============================================================== Cinderreach
// ---------------------------------------------------------------- Ember Imp
// A small horned fire-sprite with a flame for hair and a spark of a tail,
// hovering (built like the wisp: shaded body, ink outline).
const IMP = ['lavaD', 'lava', 'lavaL', 'lavaXL'];
function impFrame({ bob = 0, arms = 0, eye = 'goldL' }) {
  const [c, ctx] = makeCanvas(32, 32);
  const y = 14 + bob;
  for (const [x, h] of [[12, 4], [15, 6], [18, 5], [20, 3]]) px(ctx, x, y - 6 - h, h > 4 ? 'lavaXL' : 'lavaL', 2, h); // flame hair
  shadedBlob(ctx, 16, y, 5, 4.5, IMP); // head
  px(ctx, 11, y - 4, 'basaltD', 1, 2); px(ctx, 10, y - 5, 'basaltD'); px(ctx, 21, y - 4, 'basaltD', 1, 2); px(ctx, 22, y - 5, 'basaltD'); // horns
  px(ctx, 13, y - 1, 'ink', 2, 2); px(ctx, 18, y - 1, 'ink', 2, 2); px(ctx, 14, y - 1, eye); px(ctx, 19, y - 1, eye);
  px(ctx, 14, y + 2, 'lavaD', 4, 1);
  shadedBlob(ctx, 16, y + 7, 3.5, 3, IMP); // body
  for (let i = 0; i < 4; i++) px(ctx, 19 + i, y + 9 + (i % 2) - bob, i === 3 ? 'lavaXL' : 'lava'); // tail
  const ay = arms === 1 ? y + 2 : arms === 2 ? y + 3 : y + 6;
  px(ctx, 10, ay, 'lava', 3, 1); px(ctx, 19, ay - (arms === 1 ? 3 : 0), 'lava', 3, 1);
  if (arms === 1) { px(ctx, 21, y - 3, 'lavaXL', 2, 2); px(ctx, 22, y - 4, 'goldL'); } // a bolt in its palm
  outline(c, 'ink');
  return c;
}
export function buildImp() {
  return {
    idle: [impFrame({ bob: 0 }), impFrame({ bob: 1 })],
    walk: [impFrame({ bob: 0 }), impFrame({ bob: 1 }), impFrame({ bob: 2 }), impFrame({ bob: 1 })],
    windup: [impFrame({ arms: 1 }), impFrame({ arms: 1, bob: 1 })],
    attack: [impFrame({ arms: 2 }), impFrame({})],
    hurt: [impFrame({ eye: 'white' })],
  };
}

// --------------------------------------------------------------- Magma Slug
// A fat slug of cooling rock, molten in the cracks, glowing spots on its back.
function slugFrame({ stretch = 0, rear = 0, eye = 'goldL' }) {
  const [c, ctx] = makeCanvas(32, 32);
  shadedBlob(ctx, 15 - stretch, 21 - rear, 10 + stretch, 5 + rear * 0.5, ['basaltD', 'basalt', 'basaltL', 'ashXL']);
  for (const [x, y] of [[9, 19], [14, 17], [19, 19], [12, 22], [17, 22]]) { px(ctx, x - stretch, y - rear, 'lavaL', 2, 1); px(ctx, x - stretch, y + 1 - rear, 'lava', 2, 1); }
  shadedBlob(ctx, 25, 18 - rear * 2, 3.5, 3.5, ['basaltD', 'basalt', 'basaltL', 'ashXL']); // head
  px(ctx, 24, 12 - rear * 2, 'basaltL', 1, 4); px(ctx, 27, 12 - rear * 2, 'basaltL', 1, 4); // eye stalks
  px(ctx, 24, 11 - rear * 2, eye); px(ctx, 27, 11 - rear * 2, eye);
  px(ctx, 5 - stretch * 2, 25, 'lavaD', 22 + stretch * 2, 1); // a glowing sole
  outline(c, 'ink');
  return c;
}
export function buildSlug() {
  return {
    idle: [slugFrame({}), slugFrame({ stretch: 1 })],
    walk: [slugFrame({}), slugFrame({ stretch: 1 }), slugFrame({ stretch: 2 }), slugFrame({ stretch: 1 })],
    windup: [slugFrame({ rear: 2 }), slugFrame({ rear: 3 })],
    attack: [slugFrame({ stretch: 2 }), slugFrame({})],
    hurt: [slugFrame({ eye: 'white' })],
  };
}

// -------------------------------------------------------------- Basalt Brute
// A squat rock golem (the Golem's little cousin) with lava in its seams. Its
// armour plates fall away when cracked (`cracked` frames show the glow).
const BRUTE = ['basaltD', 'basalt', 'basaltL', 'ashXL'];
function bruteFrame({ fl = 0, fr = 0, bob = 0, cracked = false, eye = 'lavaXL' }) {
  const [c, ctx] = makeCanvas(40, 40);
  const by = bob;
  shadedBlob(ctx, 15, 34, 4, 3.5, BRUTE); shadedBlob(ctx, 25, 34, 4, 3.5, BRUTE); // legs
  shadedBlob(ctx, 8, 24 + by + fl, 4.5, 5.5, BRUTE); shadedBlob(ctx, 32, 24 + by + fr, 4.5, 5.5, BRUTE); // fists
  shadedBlob(ctx, 20, 23 + by, 10, 9, BRUTE); // body
  shadedBlob(ctx, 20, 12 + by, 5.5, 4.5, BRUTE); // head
  px(ctx, 17, 11 + by, 'ink', 6, 2); px(ctx, 17, 11 + by, eye, 2, 1); px(ctx, 21, 11 + by, eye, 2, 1);
  const seams = [[14, 18], [16, 21], [18, 24], [24, 19], [23, 23], [21, 27]];
  for (const [x, y] of seams) px(ctx, x, y + by, cracked ? 'lavaXL' : 'lavaD', 2, 1);
  if (!cracked) for (const [x, y, w] of [[12, 16, 7], [22, 16, 7], [14, 26, 12]]) { px(ctx, x, y + by, 'ashL', w, 1); px(ctx, x, y + 1 + by, 'basaltL', w, 2); } // armour plates
  outline(c, 'ink');
  return c;
}
export function buildBrute(cracked = false) {
  const f = (o) => bruteFrame({ cracked, ...o });
  return {
    idle: [f({}), f({ bob: 1 })],
    walk: [f({ fl: -1 }), f({ fr: -1, bob: 1 }), f({ fl: 1 }), f({ fr: 1, bob: 1 })],
    windup: [f({ fl: -6, fr: -6 }), f({ fl: -7, fr: -7, bob: -1 })],
    attack: [f({ fl: 4, fr: 4, bob: 1 }), f({})],
    hurt: [f({ eye: 'white' })],
  };
}

// --------------------------------------------------------------- Fire Beetle
// Seen from above like the crab: a domed shell striped with glowing seams
// that swell before it bursts.
const BEETLE = { R: 'lavaD', r: 'lava', L: 'lavaL', W: 'lavaXL', k: 'basaltD', b: 'basalt', E: 'goldL' };
function beetleFrame({ step = 0, swell = 0 }) {
  const [c, ctx] = makeCanvas(32, 32);
  const legs = step % 2 ? ['k.k......k.k', '.k........k.', 'k.k......k.k'] : ['.k........k.', 'k.k......k.k', '.k........k.'];
  grid(ctx, legs, BEETLE, 10, 17);
  const shell = swell
    ? ['...bbbbbb...', '..bRLWWLRb..', '.bRrLWWLrRb.', '.bRrLWWLrRb.', '.bRrLWWLrRb.', '..bRLWWLRb..', '...bbbbbb...']
    : ['...bbbbbb...', '..bRrLLrRb..', '.bRrrLLrrRb.', '.bRrrLLrrRb.', '.bRrrLLrrRb.', '..bRrLLrRb..', '...bbbbbb...'];
  grid(ctx, shell, BEETLE, 10, 14);
  grid(ctx, ['..kkkk..', '.kEkkEk.', '..kkkk..'], BEETLE, 12, 11);
  px(ctx, 13, 10, 'basaltD', 1, 2); px(ctx, 18, 10, 'basaltD', 1, 2); // feelers
  outline(c, 'ink');
  return c;
}
export function buildBeetle() {
  return {
    idle: [beetleFrame({}), beetleFrame({ step: 1 })],
    walk: [beetleFrame({}), beetleFrame({ step: 1 })],
    windup: [beetleFrame({ swell: 1 }), beetleFrame({ swell: 1, step: 1 })],
    attack: [beetleFrame({ swell: 1 }), beetleFrame({})],
    hurt: [beetleFrame({ swell: 1 })],
  };
}

// --------------------------------------------------------------- Cinder Drake
// A young dragon in profile: a long arched neck lifting a horned, snouted
// head, a big wing folded along its back (spread to take off), a spined
// ridge, a tail tapering to an ember, and a throat that glows before it
// breathes (64x52 frames, feet near y=48).
const DRAKE = ['lavaD', 'redD', 'red', 'redL'];
function drakeFrame({ step = 0, wings = 0, breath = 0, lift = 0 }) {
  const [c, ctx] = makeCanvas(64, 52);
  const y = -lift;
  const dot = (x, yy, col, w = 1, h = 1) => px(ctx, Math.round(x), Math.round(yy + y), col, w, h);
  // far wing (spread) behind everything
  if (wings) {
    for (let i = 0; i < 18; i++) { const top = 22 - i * 0.9; dot(26 - i * 0.4, top, 'redD', 2, 8 + i * 0.5); }
    for (let i = 0; i < 18; i += 5) dot(26 - i * 0.4, 22 - i * 0.9, 'basaltD', 1, 12);
  }
  // tail: tapering from the hip to an ember tip
  for (let i = 0; i < 14; i++) { const w = Math.max(1, 4 - Math.floor(i / 4)); dot(16 - i, 36 + i * 0.35 + Math.sin(i / 3) * 1, i > 11 ? 'lavaL' : 'redD', 2, w); }
  dot(2, 41, 'lavaXL', 2, 2);
  // legs (back and front), stepping
  const lg = step % 2 ? [0, 2] : [2, 0];
  shadedBlob(ctx, 22, 44 + y - lg[0], 3.5, 4.5, DRAKE); dot(19, 47 - lg[0], 'bone', 1, 1); dot(23, 47 - lg[0], 'bone', 1, 1);
  shadedBlob(ctx, 38, 44 + y - lg[1], 3, 4.5, DRAKE); dot(36, 47 - lg[1], 'bone', 1, 1); dot(39, 47 - lg[1], 'bone', 1, 1);
  // body
  shadedBlob(ctx, 30, 35 + y, 13, 8, DRAKE);
  shadedBlob(ctx, 32, 39 + y, 9, 3.5, ['lavaD', 'lava', 'lavaL', 'lavaL']); // pale-ember belly plates
  for (let i = 0; i < 4; i++) dot(26 + i * 3, 38, 'lavaD', 1, 3);
  // neck: an arch from the shoulder up to the head
  for (let i = 0; i < 9; i++) shadedBlob(ctx, 40 + i * 1.3, 30 + y - i * 1.4, 3.6 - i * 0.12, 3.2, DRAKE);
  // head with a long snout, horns and a brow
  shadedBlob(ctx, 52, 16 + y, 5, 4, DRAKE);
  shadedBlob(ctx, 57, 18 + y, 4, 2.5, DRAKE); // snout
  dot(49, 9, 'bone', 1, 4); dot(50, 8, 'bone'); dot(53, 10, 'bone', 1, 3); // horns
  dot(52, 14, 'ink', 2, 2); dot(53, 14, 'goldL');
  dot(60, 17, 'ink'); // nostril
  if (breath) { dot(55, 20, 'lavaXL', 6, 2); dot(61, 19, 'lavaXL', 2, 1); for (let i = 0; i < 5; i++) dot(43 + i * 1.3, 33 - i * 1.4, 'lavaL', 2, 2); } // glowing throat
  else dot(55, 20, 'redD', 6, 1);
  // back ridge spines
  for (let i = 0; i < 6; i++) dot(20 + i * 4, 27 - (i % 2), 'basaltD', 2, 3);
  // near wing: folded along the back, or spread
  if (wings) {
    for (let i = 0; i < 20; i++) { const top = 20 - i * 0.8; dot(30 + i * 0.5, top, 'red', 2, 9 + i * 0.4); }
    for (let i = 0; i < 20; i += 5) dot(30 + i * 0.5, 20 - i * 0.8, 'redD', 1, 13);
    dot(30, 19, 'basaltD', 12, 1);
  } else {
    for (let i = 0; i < 14; i++) dot(18 + i, 26 + Math.abs(i - 9) * 0.5, i % 4 ? 'redD' : 'basaltD', 1, 5 - Math.floor(Math.abs(i - 7) / 3));
    dot(18, 26, 'basaltD', 15, 1);
  }
  outline(c, 'ink');
  return c;
}
export function buildDrake() {
  return {
    idle: [drakeFrame({}), drakeFrame({ step: 1 })],
    walk: [drakeFrame({ step: 0 }), drakeFrame({ step: 1 })],
    windup: [drakeFrame({ breath: 1 }), drakeFrame({ breath: 1, step: 1 })],
    attack: [drakeFrame({ breath: 1 }), drakeFrame({})],
    fly: [drakeFrame({ wings: 1, lift: 5 }), drakeFrame({ wings: 1, lift: 7 })],
    hurt: [drakeFrame({})],
  };
}

// ================================================================== Gizmo's gadgets
// Turret: a brass tripod with a stubby barrel and a glowing sight (two frames:
// ready, recoil).
const BRASS = ['hairBlD', 'gold', 'goldL', 'white'];
function turretFrame(recoil = 0) {
  const [c, ctx] = makeCanvas(24, 24);
  for (const [x0, x1] of [[12, 5], [12, 19], [12, 12]]) for (let k = 0; k <= 7; k++) px(ctx, Math.round(x0 + (x1 - x0) * k / 7), 14 + k, k === 7 ? 'steelD' : 'woodD'); // tripod legs
  shadedBlob(ctx, 12, 11, 5, 4, BRASS); // housing
  px(ctx, 15 - recoil, 9, 'steelD', 7, 3); px(ctx, 16 - recoil, 9, 'steel', 6, 1); // barrel
  px(ctx, 9, 9, 'redL', 2, 2); // sight
  outline(c, 'ink');
  return c;
}
export function buildTurret() { return { idle: [turretFrame(0)], attack: [turretFrame(2), turretFrame(0)] }; }

// Repair bot: a little hovering drone with a green cross and a spinning rotor.
function botFrame(f) {
  const [c, ctx] = makeCanvas(18, 18);
  const y = 9 + (f % 2);
  px(ctx, f ? 3 : 5, y - 6, 'mist', f ? 12 : 8, 1); // rotor blur
  px(ctx, 8, y - 5, 'steelD', 2, 2);
  shadedBlob(ctx, 9, y, 5, 3.5, ['steelD', 'steel', 'steelL', 'white']);
  px(ctx, 8, y - 1, 'grassL', 2, 3); px(ctx, 7, y, 'grassL', 4, 1);
  outline(c, 'ink');
  return c;
}
export function buildBot() { return { idle: [botFrame(0), botFrame(1)] }; }

// Clank: Gizmo's mech - a barrel-chested brass walker with a porthole cockpit
// (Gizmo's goggles peer out), riveted arms with piston fists, stubby legs.
function clankFrame({ step = 0, slam = 0 }) {
  const [c, ctx] = makeCanvas(48, 48);
  const by = slam ? 2 : 0;
  const lg = step % 2 ? [0, 2] : [2, 0];
  px(ctx, 15, 38 - lg[0], 'steelD', 6, 8); px(ctx, 16, 38 - lg[0], 'steel', 3, 8); px(ctx, 14, 45 - lg[0], 'night', 8, 2);
  px(ctx, 27, 38 - lg[1], 'steelD', 6, 8); px(ctx, 28, 38 - lg[1], 'steel', 3, 8); px(ctx, 26, 45 - lg[1], 'night', 8, 2);
  const armY = slam ? 34 : 24;
  for (const side of [-1, 1]) {
    const ax = 24 + side * 15;
    px(ctx, ax - 2, 18 + by, 'steelD', 4, armY - 18); px(ctx, ax - 1, 18 + by, 'steel', 2, armY - 18);
    shadedBlob(ctx, ax, armY + by + 2, 4, 3.5, BRASS); // piston fist
  }
  shadedBlob(ctx, 24, 24 + by, 12, 11, BRASS); // body
  for (const [x, y] of [[15, 18], [33, 18], [15, 30], [33, 30], [24, 14]]) px(ctx, x, y + by, 'hairBlD'); // rivets
  shadedBlob(ctx, 24, 21 + by, 5, 4.5, ['steelD', 'blueD', 'blue', 'blueL']); // porthole
  px(ctx, 21, 20 + by, 'gold', 2, 2); px(ctx, 25, 20 + by, 'gold', 2, 2); px(ctx, 22, 20 + by, 'foam'); px(ctx, 26, 20 + by, 'foam'); // goggles peering out
  px(ctx, 20, 31 + by, 'redL', 8, 1); // grille glow
  px(ctx, 31, 9 + by, 'steelD', 2, 6); px(ctx, 30, 7 + by, 'mist', 4, 2); // smokestack
  outline(c, 'ink');
  return c;
}
export function buildClank() {
  return { idle: [clankFrame({}), clankFrame({ step: 1 })], walk: [clankFrame({ step: 0 }), clankFrame({ step: 1 })], attack: [clankFrame({ slam: 1 }), clankFrame({})] };
}
