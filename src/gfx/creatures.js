// Non-humanoid creatures and NPCs, drawn procedurally or from small grids.
import { makeCanvas, grid, px, outline, bayer, hash } from './pixel.js';

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
// 64x64 frames, feet at y=60. Designed as a key object (shape, then light,
// then structure, then detail): a hulk of hewn stone blocks - two great
// shoulder stones, a chest block carved with the hex, a small head sunk
// between the shoulders, short heavy legs and huge fists - held together by
// the curse, whose violet light shows in the seams between the blocks. Each
// block is chiselled into facets lit from the upper left (a flat face, its
// edges catching the light on the lit side, the far facets in shadow), with
// cracks and chips, and moss on the tops of the shoulders and head.
const STONE = ['slate', 'stone', 'mist', 'bone'];
const GOLEM = ['ink', 'night', 'slate', 'stone', 'mist']; // darker so it pops against cursed ground
// one hewn block: an irregular polygon, faceted and shaded, its seams dark
function stoneBlock(ctx, cx, cy, rx, ry, seed, { moss = false, cracks = 1, far = false } = {}) {
  const n = 7, V = [];
  for (let i = 0; i < n; i++) { const a = ((i + hash(i, seed, 401) * 0.5) / n) * Math.PI * 2 - Math.PI / 2; const k = 0.86 + hash(i, seed, 402) * 0.18; V.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, a]); }
  const inside = (x, y) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = V[i], [xj, yj] = V[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const pts = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (inside(x + 0.5, y + 0.5)) pts.push([x, y]);
  const isIn = new Set(pts.map(([x, y]) => x * 1000 + y));
  for (const [x, y] of pts) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = Math.hypot(nx, ny);
    let l;
    if (d < 0.55) l = 0.56 - nx * 0.12 - ny * 0.16; // the flat face
    else { // a facet round it: which way it leans decides its light
      let a = Math.atan2(ny, nx), fa = V[0][2];
      for (let i = 0; i < n; i++) { const a0 = V[i][2], a1 = V[(i + 1) % n][2] + (i === n - 1 ? Math.PI * 2 : 0); let aa = a; while (aa < a0) aa += Math.PI * 2; if (aa < a1) { fa = (a0 + a1) / 2; break; } }
      l = 0.5 + (-Math.cos(fa) * 0.55 - Math.sin(fa) * 0.75) * 0.42;
      if (d < 0.66 && -Math.cos(fa) - Math.sin(fa) > 0.3) l += 0.2; // the edge of the face, catching the light
    }
    const edge = !isIn.has((x - 1) * 1000 + y) || !isIn.has((x + 1) * 1000 + y) || !isIn.has(x * 1000 + y - 1) || !isIn.has(x * 1000 + y + 1);
    if (edge) l = !isIn.has(x * 1000 + y - 1) && ny < 0 ? l + 0.12 : l - 0.3; // the block's own rim: a lit top, dark seams elsewhere
    if (hash(x >> 1, y >> 1, seed + 3) < 0.06) l -= 0.12; // pitted
    if (far) l -= 0.16; // the far side, in the body's shadow
    px(ctx, x, y, GOLEM[Math.max(0, Math.min(GOLEM.length - 1, Math.floor(l * GOLEM.length + (bayer(x, y) - 0.5) * 0.15)))]);
    if (moss && ny < -0.45 && hash(x, y, seed + 5) < 0.7 - (ny + 0.45) * -0.4) px(ctx, x, y, hash(x, y, seed + 6) < 0.3 ? 'grass' : 'leafD');
  }
  for (let k = 0; k < cracks; k++) { // a crack across the face
    let x = cx + (hash(k, seed, 404) - 0.5) * rx * 0.8, y = cy - ry * 0.3;
    for (let i = 0; i < ry * 0.9; i++) { if (isIn.has(Math.round(x) * 1000 + Math.round(y))) px(ctx, Math.round(x), Math.round(y), 'ink'); x += hash(i, seed + k, 405) < 0.5 ? -0.6 : 0.6; y += 1; }
  }
}
// the curse's light in the seams: a soft violet core behind the blocks
function hexCore(ctx, cx, cy, rx, ry, hot) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d <= 1) px(ctx, x, y, d < 0.3 ? hot : d < 0.6 ? 'curse' : d < 0.85 ? 'purp' : 'purpD');
  }
}
// The three views (down = toward you, side = facing right, up = away) are
// built from the same blocks at the same heights (feet on 60, hips 48, chest
// 38, shoulders 30, head 23), as Keep Defense's ART_GUIDE asks, so it turns
// without changing size. Far parts are drawn first and a little darker.
const GOLEM_ROWS = { feet: 56, hips: 48, chest: 38, shoulder: 30, head: 23 };
function golemArm(ctx, sx, sy, f, seed, hot, far) {
  for (let i = 1; i <= 8; i++) { const t = i / 10; hexCore(ctx, sx + (f.x - sx) * t, sy + (f.y - sy) * t, 1.8, 1.8, hot); } // the light in the joints (not over the fist)
  stoneBlock(ctx, sx + (f.x - sx) * 0.3, sy + (f.y - sy) * 0.3, 4.6, 4.6, seed, { cracks: 0, far });
  stoneBlock(ctx, sx + (f.x - sx) * 0.66, sy + (f.y - sy) * 0.66, 4.2, 4.2, seed + 20, { cracks: 0, far });
}
function golemFist(ctx, f, seed, far, side = false) {
  stoneBlock(ctx, f.x, f.y, 7, 6, seed, { cracks: 0, far });
  if (!far) for (let k = -1; k <= 1; k++) px(ctx, Math.round(f.x) + (side ? 2 : k * 3 - 1), Math.round(f.y) + (side ? k * 2 : 2), 'night', side ? 1 : 2, 1); // knuckles
}
function golemFrame(view, { fl, fr, bob = 0, eye = 'curseL', crouch = 0, rune = 'curseL', step = 0 }) {
  const [c, ctx] = makeCanvas(64, 64);
  const by = bob + crouch, hot = rune === 'white' ? 'white' : 'curseL', R = GOLEM_ROWS;
  if (view === 'side') {
    // facing right: fl is the far fist, fr the near one; step swings the legs
    const sw = [0, 3, 0, -3][step % 4];
    golemArm(ctx, 34, R.shoulder + 2 + by, fl, 11, hot, true); golemFist(ctx, fl, 51, true, true);
    hexCore(ctx, 28 - sw * 0.3, 52, 2.5, 2.5, hot); stoneBlock(ctx, 28 - sw, R.feet, 6.4, 4.4, 31, { cracks: 0, far: true }); // the far leg
    hexCore(ctx, 31, R.chest - 1 + by, 11, 11, hot);
    stoneBlock(ctx, 30, R.hips + by, 10, 5, 40);
    stoneBlock(ctx, 36, R.shoulder - 2 + by, 7.5, 6.5, 43, { moss: true, far: true }); // the far shoulder, behind
    stoneBlock(ctx, 31, R.chest + by, 11.5, 10, 41, { cracks: 1 }); // as deep from the side as the front is wide, near enough: a hulk, not a slab
    for (const [x, y] of [[42, 35], [42, 36], [42, 37]]) px(ctx, x, y + by, rune === 'white' ? 'white' : 'curse'); // the hex's light, at the front edge of the chest
    hexCore(ctx, 37, 28 + by, 3.5, 3, hot);
    stoneBlock(ctx, 40, R.head + 2 + by, 6, 5.6, 44, { moss: true, cracks: 0 }); // the head, carried low and forward
    px(ctx, 39, 22 + by, 'stone', 5, 1); px(ctx, 40, 23 + by, 'night', 6, 1); // the brow
    px(ctx, 42, 24 + by, 'ink', 3, 3); px(ctx, 43, 25 + by, eye, 2, 1); px(ctx, 43, 24 + by, eye === 'white' ? 'white' : 'curse', 2, 1); // one eye, deep in its socket
    hexCore(ctx, 34 + sw * 0.3, 52, 2.5, 2.5, hot); stoneBlock(ctx, 34 + sw, R.feet, 6.6, 4.4, 32, { cracks: 0 }); // the near leg
    stoneBlock(ctx, 28, R.shoulder + by, 10, 8.4, 42, { moss: true }); // the near shoulder: the biggest stone in the profile
    for (const [x, n] of [[20, 3], [23, 2]]) for (let k = 0; k < n; k++) px(ctx, x, 32 + by + k, k === n - 1 ? 'grass' : 'leafD');
    golemArm(ctx, 29, R.shoulder + 2 + by, fr, 12, hot, false); golemFist(ctx, fr, 52, false, true);
    outline(c, 'ink');
    return c;
  }
  const up = view === 'up';
  if (up) { golemFist(ctx, fl, 51, true); golemFist(ctx, fr, 52, true); } // facing away, the fists are beyond the body
  for (const [sx, f, sd] of [[19, fl, 11], [45, fr, 12]]) golemArm(ctx, sx, R.shoulder + 2 + by, f, sd, hot, up);
  for (const [lx, sd] of [[25, 31], [39, 32]]) { hexCore(ctx, lx, 52 + crouch * 0.5, 3, 2.5, hot); stoneBlock(ctx, lx, R.feet, 6, 4.4, sd, { cracks: 0 }); }
  hexCore(ctx, 32, R.chest - 1 + by, 12, 10, hot);
  stoneBlock(ctx, 32, R.hips + by, 11.5, 5, 40);
  if (up) { // the back: two great stones with the hex glowing up the seam between them
    stoneBlock(ctx, 26, R.chest + by, 7.5, 9.5, 45, { cracks: 1 }); stoneBlock(ctx, 38, R.chest + by, 7.5, 9.5, 46, { cracks: 1 });
    let sx = 32; for (let y = 30; y < 47; y++) { sx += hash(y, 1, 407) < 0.25 ? -1 : hash(y, 2, 407) < 0.25 ? 1 : 0; sx = Math.max(31, Math.min(33, sx)); px(ctx, sx, y + by, y % 5 ? 'curse' : hot); } // a jagged seam
  } else stoneBlock(ctx, 32, R.chest + by, 13.5, 9.5, 41, { cracks: 1 });
  stoneBlock(ctx, 19, R.shoulder + by, 9, 7.6, 42, { moss: true });
  stoneBlock(ctx, 45, R.shoulder + by, 9, 7.6, 43, { moss: true });
  hexCore(ctx, 32, 27 + by, 5, 3, hot);
  stoneBlock(ctx, 32, R.head + by, 6.5, 5.6, 44, { moss: true, cracks: up ? 1 : 0 });
  if (!up) {
    // the face: a heavy brow over two deep sockets, the eyes burning in them
    px(ctx, 27, 21 + by, 'night', 10, 1); px(ctx, 27, 20 + by, 'stone', 4, 1);
    for (const ex of [28, 34]) { px(ctx, ex - 1, 22 + by, 'ink', 4, 3); px(ctx, ex, 23 + by, eye, 2, 1); px(ctx, ex, 22 + by, eye === 'white' ? 'white' : 'curse', 2, 1); }
    // the hex carved into the chest, glowing
    for (const [x, y] of [[31, 33], [32, 34], [33, 33], [32, 35], [32, 36], [32, 37], [31, 38], [33, 38], [30, 39], [34, 39]]) px(ctx, x, y + by, rune);
    px(ctx, 31, 35 + by, hot, 3, 1);
    for (const [x, y] of [[30, 34], [34, 34], [29, 39], [35, 39]]) px(ctx, x, y + by, 'purp');
  }
  for (const [x, n] of [[14, 3], [17, 2], [47, 2], [50, 3]]) for (let k = 0; k < n; k++) px(ctx, x, 31 + by + k, k === n - 1 ? 'grass' : 'leafD');
  if (!up) { golemFist(ctx, fl, 51, false); golemFist(ctx, fr, 52, false); } // facing you, the fists are in front
  outline(c, 'ink');
  return c;
}

export function buildGolem() {
  const rest = { fl: { x: 13, y: 46 }, fr: { x: 51, y: 46 } };
  const front = (F) => ({
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
  });
  // side (facing right): fl the far fist, fr the near; the arms swing against the legs
  const S = (o) => golemFrame('side', o);
  const hang = { fl: { x: 27, y: 46 }, fr: { x: 37, y: 48 } };
  const side = {
    idle: [S({ ...hang }), S({ fl: { x: 28, y: 47 }, fr: { x: 36, y: 48 }, bob: 1 })],
    walk: [0, 1, 2, 3].map((st) => S({ step: st, bob: -(st % 2), fl: { x: 27 + [0, -3, 0, 3][st], y: 46 }, fr: { x: 37 + [0, 3, 0, -3][st], y: 48 } })),
    windup: [S({ fl: { x: 31, y: 12 }, fr: { x: 35, y: 13 }, eye: 'white', bob: -1 }), S({ fl: { x: 31, y: 9 }, fr: { x: 35, y: 10 }, eye: 'white', bob: -2, rune: 'white' })],
    slam: [S({ fl: { x: 43, y: 56 }, fr: { x: 47, y: 57 }, crouch: 3, rune: 'white' }), S({ fl: { x: 42, y: 56 }, fr: { x: 46, y: 57 }, crouch: 2 })],
    throw: [S({ fl: { x: 28, y: 46 }, fr: { x: 22, y: 14 }, eye: 'white' }), S({ fl: { x: 28, y: 46 }, fr: { x: 46, y: 30 }, bob: 1 })],
    hurt: [S({ ...hang, eye: 'white' })],
  };
  return { down: front((o) => golemFrame('down', o)), side, up: front((o) => golemFrame('up', o)) };
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
// Frosthelm's Frost Wolf: the hound's build in a thick pale coat, a bushy grey tail
const WOLF = { d: 'frostD', b: 'frost', L: 'frostL', W: 'snowL', E: 'goldL', k: 'ink', m: 'frostL' }; // grey, so it shows on snow
function houndFrame({ step = 0, crouch = 0, leap = 0, blink = false, pal = HOUND }) {
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
  grid(ctx, b, pal, 5, y0);
  const legs = leap ? ['....bb.......bb.....', '.....b........b.....'] : step % 2
    ? ['....bb....bb..bb.bb..', '....b......b..b...b..', '...bb.....bb..bb..bb.']
    : ['.....bb..bb....bb.bb.', '.....b...b.....b..b..', '....bb..bb....bb..bb.'];
  grid(ctx, legs, pal, 5, y0 + 9);
  outline(c, 'ink');
  return c;
}
export function buildHound(pal = HOUND) {
  return {
    idle: [houndFrame({ pal }), houndFrame({ step: 0, crouch: 0, pal })],
    walk: [0, 1, 0, 1].map((st, i) => houndFrame({ step: st, crouch: i % 2, pal })),
    windup: [houndFrame({ crouch: 2, pal }), houndFrame({ crouch: 2, step: 1, pal })],
    attack: [houndFrame({ leap: 3, pal }), houndFrame({ step: 1, pal })],
    hurt: [houndFrame({ blink: true, pal })],
  };
}
// ---------------------------------------------------------------- Frost Wolf
// A grey timber wolf in profile, bigger than the hounds so it reads as a
// wolf: a long snout with a black nose, upright pointed ears, a thick pale
// ruff at the neck, a dark saddle down the back, long legs and a bushy tail
// with a pale tip. Crouches with its hackles up, leaps with jaws open
// (48x36, feet at y=28).
const WOLFC = ['frostD', 'frost', 'frostL', 'snowL'];
function wolfFrame({ step = 0, crouch = 0, leap = 0, open = false, blink = false }) {
  const [c, ctx] = makeCanvas(48, 36);
  const dot = (x, y, col, w = 1, h = 1) => px(ctx, Math.round(x), Math.round(y), col, w, h);
  const by = 17 + crouch - leap * 2; // body centre line
  // tail: bushy, sweeping down and back from the rump, a pale tip
  for (let i = 0; i < 10; i++) { // hangs from the rump in a soft curve, fullest in the middle
    const tx = 11 - i * 0.75 - (i > 5 ? (i - 5) * 0.2 : 0), ty = by - 2 + i * 1.05 - (leap ? i * 0.7 : 0);
    const w = i < 2 ? 2 : i < 7 ? 3 : 2;
    dot(tx - w + 1, ty, i > 7 ? 'snowL' : i % 3 === 0 ? 'frostD' : 'frost', w, 2);
  }
  // legs (far pair darker): long and thin, stepping; stretched out in a leap
  const legs = leap
    ? [[14, by + 4, -4, 'frostD'], [17, by + 4, -2, 'frost'], [30, by + 2, 4, 'frostD'], [33, by + 2, 5, 'frost']]
    : [[14, by + 4, step ? 1 : -1, 'frostD'], [17, by + 4, step ? -1 : 1, 'frost'], [29, by + 4, step ? -1 : 1, 'frostD'], [32, by + 4, step ? 1 : -1, 'frost']];
  for (const [lx, ly, sw, col] of legs) {
    const foot = 28 - (leap ? 4 : 0);
    for (let y = ly; y <= foot; y++) dot(lx + sw * (y - ly) / Math.max(1, foot - ly), y, col, 2, 1);
    dot(lx + sw - 1 + (leap ? 0 : 0), foot, 'frostD', 3, 1); // paw
  }
  // body, the dark saddle and pale belly
  shadedBlob(ctx, 22, by, 11, 5.5, WOLFC);
  for (let x = 13; x <= 29; x++) dot(x, by - 5 + Math.abs(x - 21) * 0.08, 'frostD', 1, 2); // saddle
  for (let x = 16; x <= 28; x += 2) dot(x, by + 4, 'snowL', 2, 1); // belly fur
  if (crouch) for (let x = 18; x <= 28; x += 2) dot(x, by - 7, 'frostD', 1, 2); // hackles up
  // the ruff: thick pale fur at the neck and chest
  shadedBlob(ctx, 31, by - 1, 5, 6, ['frost', 'frostL', 'snowL', 'snowXL']);
  // head, lowered when crouching
  const hx = 37 + leap, hy = by - 6 + crouch * 1.5 + leap;
  shadedBlob(ctx, hx, hy, 4.5, 4, WOLFC);
  // ears: upright, pointed, dark-tipped
  for (const ex of [hx - 4, hx]) { dot(ex + 1, hy - 8, 'frostD'); dot(ex + 1, hy - 7, 'frostD', 1, 1); dot(ex, hy - 6, 'frost', 2, 1); dot(ex, hy - 5, 'frost', 3, 1); dot(ex + 1, hy - 5, 'snowL'); dot(ex, hy - 4, 'frost', 3, 1); }
  // the long snout, tapering to a black nose
  for (let i = 0; i < 7; i++) dot(hx + 3 + i, hy + 0.5 + i * 0.12, i < 2 ? 'frostL' : 'frost', 1, 3 - Math.floor(i / 4));
  dot(hx + 10, hy + 1, 'ink', 1, 1); dot(hx + 9, hy, 'ink', 1, 1);
  if (open) { // jaws open: the lower jaw drops, teeth showing
    dot(hx + 3, hy + 3, 'redD', 6, 1); dot(hx + 3, hy + 4, 'frost', 6, 1); dot(hx + 4, hy + 2, 'white', 1, 1); dot(hx + 8, hy + 2, 'white', 1, 1); dot(hx + 5, hy + 4, 'white', 1, 1);
  } else dot(hx + 4, hy + 2, 'frostD', 5, 1); // mouth line
  dot(hx, hy - 1, blink ? 'frostD' : 'ink', 2, 1); if (!blink) dot(hx + 1, hy - 1, 'goldL');
  outline(c, 'ink');
  return c;
}
export function buildWolf() {
  return {
    idle: [wolfFrame({}), wolfFrame({ crouch: 0, blink: true })],
    walk: [0, 1, 0, 1].map((st, i) => wolfFrame({ step: st, crouch: i % 2 ? 0 : 0 })),
    windup: [wolfFrame({ crouch: 2 }), wolfFrame({ crouch: 2, open: true })],
    attack: [wolfFrame({ leap: 2, open: true }), wolfFrame({ step: 1 })],
    hurt: [wolfFrame({ blink: true })],
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

// ================================================================ Frosthelm
const SNOWFUR = ['frost', 'snow', 'snowL', 'snowXL'];
const MUSK = ['leatherD', 'leather', 'woodL', 'snowL']; // the Rimehorn's shaggy brown fleece, frosted at the tips
const FROSTSKIN = ['frostD', 'frost', 'frostL', 'snowL'];

// ------------------------------------------------------------------ Rimehorn
// A great shaggy highland beast in profile: a humped body of long pale fur,
// a low head under heavy curled horns, a snub muzzle, stumpy legs. It lowers
// its head (windup) to charge or to scoop and fling a snowball (44x40, feet
// near y=35).
function rimehornFrame({ step = 0, lower = 0, rear = 0, snowball = false, eye = 'iceD' }) {
  const [c, ctx] = makeCanvas(44, 40);
  const y = -rear;
  const lg = step % 2 ? [0, 2, 2, 0] : [2, 0, 0, 2];
  // legs (far pair darker), stubby and hairy
  [[11, 0], [16, 1], [27, 2], [32, 3]].forEach(([x, i]) => { px(ctx, x, 29 + y - lg[i] * 0.5, i % 2 ? 'frost' : 'frostD', 4, 7 - (i < 2 ? rear : 0)); px(ctx, x, 35 - lg[i] * 0.5, 'ink', 4, 1); });
  // body: a big humped fleece, fur hanging in a ragged skirt
  shadedBlob(ctx, 21, 22 + y, 14, 9, MUSK);
  shadedBlob(ctx, 17, 16 + y, 9, 6, MUSK); // the hump
  for (let i = 0; i < 12; i++) px(ctx, 9 + i * 2.3, 29 + y + (i % 3), i % 2 ? 'leather' : 'leatherD', 1, 2 + (i % 2)); // the fringe
  for (let i = 0; i < 7; i++) px(ctx, 11 + i * 3.6, 13 + y + (i % 2) * 2, 'snowXL', 2, 1); // frost on its back
  for (let i = 0; i < 6; i++) px(ctx, 12 + i * 4, 21 + y + (i % 2) * 3, 'leatherD', 2, 1); // tufts
  // head: low and forward, lowering further to charge
  const hy = 21 + y + lower * 3, hx = 36 + lower;
  shadedBlob(ctx, hx, hy, 5, 4.5, FROSTSKIN);
  shadedBlob(ctx, hx + 4, hy + 2, 3, 2.5, ['frostD', 'frost', 'snowD', 'snow']); // muzzle
  px(ctx, hx + 6, hy + 2, 'ink'); // nostril
  px(ctx, hx - 1, hy - 1, 'ink', 2, 2); px(ctx, hx, hy - 1, eye);
  // horns: thick bone curls back over the ear and round to the front
  for (let k = 0; k < 10; k++) { const a = -0.6 - k * 0.5, r = 6 - k * 0.25; px(ctx, Math.round(hx - 2 + Math.cos(a) * r), Math.round(hy - 3 + Math.sin(a) * r * 0.9), k > 7 ? 'bone' : k % 3 ? 'mist' : 'stone', 2, 2); }
  px(ctx, hx - 4, hy + 3, 'bone', 1, 2);
  if (snowball) shadedBlob(ctx, hx + 7, hy - 6, 3.5, 3.5, ['snow', 'snowL', 'snowXL', 'white']);
  outline(c, 'ink');
  return c;
}
export function buildRimehorn() {
  return {
    idle: [rimehornFrame({}), rimehornFrame({ step: 1 })],
    walk: [0, 1, 0, 1].map((st) => rimehornFrame({ step: st })),
    windup: [rimehornFrame({ lower: 1 }), rimehornFrame({ lower: 1, step: 1 })],
    attack: [rimehornFrame({ lower: 2 }), rimehornFrame({})],
    throw: [rimehornFrame({ rear: 2, snowball: true }), rimehornFrame({ rear: 3, snowball: true })],
    hurt: [rimehornFrame({ eye: 'white' })],
  };
}

// --------------------------------------------------------------- Hex Sentinel
// A tall shard of cursed crystal on a broken plinth, a hex eye burning in its
// face (the side it reflects spells from). The eye flares before it fires
// (24x32, base at y=25).
function sentinelFrame({ glow = 0, eye = 'curseL' }) {
  const [c, ctx] = makeCanvas(24, 32);
  shadedBlob(ctx, 12, 25, 8, 3, ['frostD', 'frost', 'frostL', 'mist']); // plinth
  px(ctx, 5, 25, 'frostD', 14, 2);
  for (let y = 0; y < 20; y++) {
    const half = y < 3 ? y : y < 15 ? 4 : 4 - (y - 15) * 0.4;
    for (let x = Math.round(12 - half); x <= Math.round(11 + half); x++) px(ctx, x, 4 + y, x < 10 ? 'iceXL' : x < 12 ? 'iceL' : x < 14 ? 'ice' : 'iceD');
  }
  for (let y = 7; y < 22; y += 4) px(ctx, 13, y, 'purpL', 1, 2); // the hex seams in the glass
  px(ctx, 10, 12, 'hexD', 4, 3); px(ctx, 11, 13, glow ? 'white' : eye, 2, 1);
  if (glow) { px(ctx, 9, 11, 'curseL', 1, 1); px(ctx, 14, 11, 'curseL', 1, 1); px(ctx, 11, 10, 'curse', 2, 1); }
  // little shards orbiting the plinth
  for (const [x, yy] of [[3, 20 - glow], [20, 18 + glow]]) { px(ctx, x, yy, 'iceL', 1, 3); px(ctx, x, yy, 'iceXL'); }
  outline(c, 'ink');
  return c;
}
export function buildSentinel() {
  return {
    idle: [sentinelFrame({}), sentinelFrame({ eye: 'curse' })],
    walk: [sentinelFrame({})],
    windup: [sentinelFrame({ glow: 1 }), sentinelFrame({ glow: 1, eye: 'white' })],
    attack: [sentinelFrame({ glow: 1 }), sentinelFrame({})],
    hurt: [sentinelFrame({ eye: 'white' })],
  };
}

// -------------------------------------------------------- Snow Goblin Raider
// A hex goblin in goggles and a fur hood, crouched on a wooden sled with
// curling runners, a lit bomb held up to throw (36x28, runners at y=22).
function raiderFrame({ bob = 0, arm = 0, bomb = true }) {
  const [c, ctx] = makeCanvas(36, 28);
  // the sled: plank bed and two runners curling up at the front
  px(ctx, 6, 18, 'woodD', 22, 1); px(ctx, 6, 17, 'wood', 22, 1); px(ctx, 7, 16, 'woodL', 20, 1);
  px(ctx, 4, 22, 'steelD', 26, 1); px(ctx, 28, 21, 'steelD', 2, 1); px(ctx, 30, 19, 'steelD', 1, 2); px(ctx, 29, 18, 'steelD', 1, 1);
  for (const x of [9, 16, 23]) px(ctx, x, 19, 'woodD', 1, 3); // struts
  // the goblin, crouched and leaning into the run
  const y = bob;
  shadedBlob(ctx, 17, 12 + y, 5, 4, ['leatherD', 'leather', 'woodL', 'snowL']); // fur coat
  shadedBlob(ctx, 21, 7 + y, 4.5, 4, ['grassD', 'grass', 'grassL', 'grassXL']); // head
  px(ctx, 17, 3 + y, 'snowL', 8, 2); px(ctx, 16, 5 + y, 'snow', 2, 3); // fur hood
  px(ctx, 21, 6 + y, 'steelD', 5, 2); px(ctx, 22, 6 + y, 'iceL', 1, 1); px(ctx, 24, 6 + y, 'iceL', 1, 1); // goggles
  px(ctx, 25, 9 + y, 'grassD', 2, 1); px(ctx, 14, 6 + y, 'grassL', 2, 1); // nose, ear
  px(ctx, 15, 15 + y, 'grassD', 3, 1); px(ctx, 21, 15 + y, 'grassD', 3, 1); // knees
  if (bomb) {
    const bx = arm ? 12 : 20, by = arm ? 2 + y : 9 + y;
    px(ctx, bx - 1, by + 2, 'grass', 2, 2); // a hand
    shadedBlob(ctx, bx, by, 2.6, 2.6, ['ink', 'night', 'slate', 'stone']);
    px(ctx, bx + 1, by - 3, 'woodD', 1, 2); px(ctx, bx + 1, by - 4, arm ? 'fireL' : 'fire');
  }
  outline(c, 'ink');
  return c;
}
export function buildRaider() {
  return {
    idle: [raiderFrame({}), raiderFrame({ bob: 1 })],
    walk: [raiderFrame({}), raiderFrame({ bob: 1 })],
    windup: [raiderFrame({ arm: 1 }), raiderFrame({ arm: 1, bob: 1 })],
    attack: [raiderFrame({ bomb: false }), raiderFrame({})],
    hurt: [raiderFrame({ bomb: false })],
  };
}

// ----------------------------------------------------------- Avalanche Troll
// A hulking hunched troll: blue-grey hide, a mantle of white fur over the
// shoulders, a small head with tusks sunk between them, long arms ending in
// huge fists. Pounds the ground with both (56x56, feet near y=47).
function trollFrame({ fl = 0, fr = 0, bob = 0, raise = 0, eye = 'goldL' }) {
  const [c, ctx] = makeCanvas(56, 56);
  const y = bob;
  shadedBlob(ctx, 21, 44, 5, 4, FROSTSKIN); shadedBlob(ctx, 35, 44, 5, 4, FROSTSKIN); // legs
  px(ctx, 17, 47, 'frostD', 9, 1); px(ctx, 31, 47, 'frostD', 9, 1);
  // arms: from the shoulders down to fists (raised for the pound)
  for (const [sx, d, f] of [[13, -1, fl], [43, 1, fr]]) {
    const fy = 38 + y + f - raise * 18, fx = sx + d * (4 + raise * 2);
    for (let k = 0; k <= 6; k++) shadedBlob(ctx, sx + (fx - sx) * k / 6, 22 + y + (fy - 22 - y) * k / 6, 3.5, 3.5, FROSTSKIN);
    shadedBlob(ctx, fx, fy, 6, 5.5, FROSTSKIN);
    px(ctx, fx - 4, fy + 2, 'frostD', 8, 1);
  }
  shadedBlob(ctx, 28, 32 + y, 13, 11, FROSTSKIN); // gut and chest
  shadedBlob(ctx, 28, 36 + y, 7, 5, ['frost', 'frostL', 'snowD', 'snow']); // pale belly
  shadedBlob(ctx, 28, 21 + y, 16, 7, SNOWFUR); // the fur mantle
  for (let i = 0; i < 14; i++) px(ctx, 14 + i * 2.1, 26 + y + (i % 3), i % 2 ? 'snow' : 'frost', 1, 2); // mantle fringe
  shadedBlob(ctx, 28, 18 + y, 5.5, 5, FROSTSKIN); // head, sunk low
  px(ctx, 25, 17 + y, 'ink', 6, 2); px(ctx, 25, 17 + y, eye, 2, 1); px(ctx, 29, 17 + y, eye, 2, 1);
  px(ctx, 24, 21 + y, 'bone', 1, 3); px(ctx, 32, 21 + y, 'bone', 1, 3); // tusks
  for (const [x, yy] of [[18, 15], [38, 15], [28, 12]]) { px(ctx, x, yy + y, 'iceXL', 1, 3); px(ctx, x, yy + y - 1, 'iceL'); } // icicles in the fur
  outline(c, 'ink');
  return c;
}
export function buildTroll() {
  return {
    idle: [trollFrame({}), trollFrame({ bob: 1 })],
    walk: [trollFrame({ fl: -2 }), trollFrame({ fr: -2, bob: 1 }), trollFrame({ fl: 2 }), trollFrame({ fr: 2, bob: 1 })],
    windup: [trollFrame({ raise: 1, bob: -1 }), trollFrame({ raise: 1, bob: -2 })],
    attack: [trollFrame({ fl: 6, fr: 6, bob: 2 }), trollFrame({})],
    hurt: [trollFrame({ eye: 'white' })],
  };
}

// ================================================================ the Basin
// --------------------------------------------------------------- Voidling
// A scrap of living dark: a hunched shadow body trailing tendrils, two
// violet eyes, claws out when it strikes. It hovers (32x32).
function voidlingFrame({ bob = 0, claw = 0, eye = 'curseL' }) {
  const [c, ctx] = makeCanvas(32, 32);
  const y = 14 + bob;
  for (let i = 0; i < 5; i++) for (let k = 0; k < 4 + (i % 2) * 2; k++) px(ctx, 10 + i * 3 + Math.round(Math.sin(k * 0.9 + i) * 1), y + 6 + k, k > 3 ? 'hexD' : 'purpD'); // tendrils
  shadedBlob(ctx, 16, y, 7, 6, ['ink', 'hexD', 'purpD', 'purp']);
  px(ctx, 12, y - 1, eye, 2, 2); px(ctx, 18, y - 1, eye, 2, 2); px(ctx, 13, y - 1, 'white'); px(ctx, 19, y - 1, 'white');
  px(ctx, 11, y - 6, 'hexD', 2, 2); px(ctx, 19, y - 6, 'hexD', 2, 2); // little horns
  if (claw) { for (const sx of [7, 24]) { px(ctx, sx, y + 1 - claw, 'purp', 2, 1); px(ctx, sx + (sx < 16 ? -1 : 2), y - claw, 'curseL'); } }
  outline(c, 'ink');
  return c;
}
export function buildVoidling() {
  return {
    idle: [voidlingFrame({}), voidlingFrame({ bob: 1 })],
    walk: [voidlingFrame({}), voidlingFrame({ bob: 1 }), voidlingFrame({ bob: 2 }), voidlingFrame({ bob: 1 })],
    windup: [voidlingFrame({ claw: 2 }), voidlingFrame({ claw: 3, bob: 1 })],
    attack: [voidlingFrame({ claw: 1 }), voidlingFrame({})],
    hurt: [voidlingFrame({ eye: 'white' })],
  };
}

// ---------------------------------------------------------- Tower Gargoyle
// A crouched stone beast with folded bat wings, horns and a snarl, grey and
// cracked; its eyes kindle when it moves (40x40, feet near y=33).
const GSTONE = ['slate', 'stone', 'mist', 'bone'];
function gargoyleFrame({ step = 0, wings = 0, lunge = 0, lit = true }) {
  const [c, ctx] = makeCanvas(40, 40);
  const y = -lunge;
  // wings: folded behind, or half spread to pounce
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) px(ctx, 20 + s * (6 + i * (wings ? 1.2 : 0.6)), 12 + y + i * (wings ? 0.4 : 1.2), i % 3 ? 'stone' : 'slate', 2, wings ? 6 - Math.floor(i / 2) : 3);
  const lg = step % 2 ? [0, 1] : [1, 0];
  shadedBlob(ctx, 14, 31 - lg[0], 3.5, 3, GSTONE); shadedBlob(ctx, 26, 31 - lg[1], 3.5, 3, GSTONE); // haunches
  shadedBlob(ctx, 20, 24 + y, 9, 7, GSTONE); // body
  shadedBlob(ctx, 20 + lunge, 13 + y, 5.5, 5, GSTONE); // head
  px(ctx, 15 + lunge, 7 + y, 'slate', 2, 3); px(ctx, 24 + lunge, 7 + y, 'slate', 2, 3); // horns
  px(ctx, 17 + lunge, 12 + y, 'ink', 6, 2); if (lit) { px(ctx, 17 + lunge, 12 + y, 'curseL', 2, 1); px(ctx, 21 + lunge, 12 + y, 'curseL', 2, 1); }
  px(ctx, 18 + lunge, 16 + y, 'bone', 1, 2); px(ctx, 21 + lunge, 16 + y, 'bone', 1, 2); // fangs
  for (const [cx, cy] of [[16, 22], [23, 26], [19, 29]]) px(ctx, cx, cy + y, 'slate', 2, 1); // cracks
  outline(c, 'ink');
  return c;
}
export function buildGargoyle() {
  return {
    idle: [gargoyleFrame({ lit: false })],
    walk: [gargoyleFrame({ step: 0, wings: 1 }), gargoyleFrame({ step: 1, wings: 1 })],
    windup: [gargoyleFrame({ wings: 1, lunge: 1 }), gargoyleFrame({ wings: 1, lunge: 2 })],
    attack: [gargoyleFrame({ wings: 1, lunge: 3 }), gargoyleFrame({ wings: 1 })],
    hurt: [gargoyleFrame({ lit: false })],
  };
}
