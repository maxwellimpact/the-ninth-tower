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
