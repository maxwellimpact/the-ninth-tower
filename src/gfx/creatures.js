// Non-humanoid creatures and NPCs, drawn procedurally or from small grids.
import { makeCanvas, grid, px, outline, bayer, hash, vnoise } from './pixel.js';

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

export function buildGolem(vs = ['down', 'side', 'up']) { // (only the views asked for: a loader builds one at a time)
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
  const side = () => ({
    idle: [S({ ...hang }), S({ fl: { x: 28, y: 47 }, fr: { x: 36, y: 48 }, bob: 1 })],
    walk: [0, 1, 2, 3].map((st) => S({ step: st, bob: -(st % 2), fl: { x: 27 + [0, -3, 0, 3][st], y: 46 }, fr: { x: 37 + [0, 3, 0, -3][st], y: 48 } })),
    windup: [S({ fl: { x: 31, y: 12 }, fr: { x: 35, y: 13 }, eye: 'white', bob: -1 }), S({ fl: { x: 31, y: 9 }, fr: { x: 35, y: 10 }, eye: 'white', bob: -2, rune: 'white' })],
    slam: [S({ fl: { x: 43, y: 56 }, fr: { x: 47, y: 57 }, crouch: 3, rune: 'white' }), S({ fl: { x: 42, y: 56 }, fr: { x: 46, y: 57 }, crouch: 2 })],
    throw: [S({ fl: { x: 28, y: 46 }, fr: { x: 22, y: 14 }, eye: 'white' }), S({ fl: { x: 28, y: 46 }, fr: { x: 46, y: 30 }, bob: 1 })],
    hurt: [S({ ...hang, eye: 'white' })],
  });
  const all = { down: () => front((o) => golemFrame('down', o)), side, up: () => front((o) => golemFrame('up', o)) };
  return Object.fromEntries(vs.map((v) => [v, all[v]()]));
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
// A giant snapping turtle, as a key object: a high domed shell of raised
// plates (a row of keeled, spiked plates down the spine, plates either side,
// small ones round the seamed rim), each plate a little dome of its own with
// growth rings, weed and moss on the old shell; a big head with a hooked
// beak, clawed legs, a spiked tail. 48x40 frames, feet on y=36, in three
// views (down: head toward you; side: facing right; up: tail toward you),
// and flipped on its back (the pale belly plates up, legs waving).
const SHELL = ['ink', 'leafD', 'mossD', 'moss', 'mossL', 'mossXL'];
const TURTLE_SKIN = ['mudD', 'mossD', 'moss', 'mossL'];
// the shell seen from above (rx, ry: its outline); the head end is down (+1) or up (-1)
function turtleShell(ctx, cx, cy, rx, ry, headEnd) {
  const plate = (nx, ny) => { // which plate, and its centre, at a point of the shell
    const d = Math.hypot(nx, ny);
    if (d > 0.8) { const k = Math.floor(((Math.atan2(ny, nx) + Math.PI) / (Math.PI * 2)) * 18); const a = ((k + 0.5) / 18) * Math.PI * 2 - Math.PI; return [`m${k}`, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.14]; }
    if (Math.abs(nx) < 0.27) { const r = Math.max(0, Math.min(3, Math.floor((ny + 0.8) / 0.4))); return [`v${r}`, 0, -0.6 + r * 0.4, 0.22]; }
    const sd = nx < 0 ? -1 : 1, r = Math.max(0, Math.min(2, Math.floor((ny + 0.75) / 0.5)));
    return [`c${sd}${r}`, sd * 0.52, -0.5 + r * 0.5, 0.26];
  };
  const id = new Map();
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny <= 1) id.set(x * 1000 + y, plate(nx, ny));
  }
  for (const [k, [pid, pcx, pcy, pr]] of id) {
    const x = Math.floor(k / 1000), y = k % 1000, nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = Math.hypot(nx, ny);
    let l = 0.6 - nx * 0.28 - ny * 0.4 - d * d * 0.3; // the dome, lit on its upper left
    const px0 = nx - pcx, py0 = ny - pcy, pd = Math.hypot(px0, py0) / pr; // its own plate: a little dome
    l += (-px0 - py0 * 1.2) * 0.28 * (pr > 0.15 ? 1 : 0.5);
    if (Math.abs(pd - 0.62) < 0.06 && pr > 0.15) l -= 0.07; // a growth ring
    const nb = [id.get((x + 1) * 1000 + y), id.get((x - 1) * 1000 + y), id.get(x * 1000 + y + 1), id.get(x * 1000 + y - 1)];
    if (nb.some((n) => n && n[0] !== pid)) l -= 0.2; // the seams between plates
    if (pid[0] === 'v' && Math.abs(nx) < 0.04 && !nb.some((n) => n && n[0] !== pid)) l += 0.12; // the keel down the spine plates, catching the light
    if (vnoise(x / 3, y / 3, 61) > 0.8 && ny < 0.3) { px(ctx, x, y, hash(x, y, 62) < 0.4 ? 'grassL' : 'grass'); continue; } // moss on the old shell
    px(ctx, x, y, SHELL[Math.max(0, Math.min(SHELL.length - 1, Math.floor(l * SHELL.length + (bayer(x, y) - 0.5) * 0.25)))]);
  }
  for (let r = 0; r < 4; r++) { const sy = Math.round(cy + (-0.6 + r * 0.4) * ry * headEnd * -1); px(ctx, cx, sy - 1, 'mist'); px(ctx, cx, sy, 'mossXL'); } // a spike on each spine plate
  for (let i = 0; i < 5; i++) { const x = Math.round(cx - rx * 0.6 + hash(i, 1, 63) * rx * 1.2), y = Math.round(cy + ry * (0.6 + hash(i, 2, 63) * 0.3)); px(ctx, x, y, 'reed', 1, 2 + (i % 2)); } // weed trailing off the rim
}
// a clawed leg: a scaly stump with pale claws
function turtleLeg(ctx, x, y, w, h, far = false) {
  shadedBlob(ctx, x, y, w, h, far ? ['mudD', 'mudD', 'mossD', 'moss'] : TURTLE_SKIN);
  for (let k = -1; k <= 1; k++) px(ctx, Math.round(x) + k * 2, Math.round(y + h) - 1, 'bone');
  px(ctx, Math.round(x - w * 0.4), Math.round(y - h * 0.2), 'mudD');
}
// the head, from the front: broad and flat, a hooked beak, gold eyes, the jaw open to snap
function turtleHeadFront(ctx, x, y, open) {
  shadedBlob(ctx, x, y, 6.5, 5, TURTLE_SKIN);
  px(ctx, x - 4, y - 2, 'goldL'); px(ctx, x + 3, y - 2, 'goldL'); px(ctx, x - 4, y - 1, 'ink'); px(ctx, x + 3, y - 1, 'ink'); // eyes set wide
  px(ctx, x - 1, y + 1, 'bone', 2, 3); px(ctx, x - 1, y + 4, 'mist', 2, 1); // the hooked beak
  if (open) { px(ctx, x - 4, y + 3, 'redD', 9, open + 1); px(ctx, x - 4, y + 3, 'bone', 3, 1); px(ctx, x + 2, y + 3, 'bone', 3, 1); }
  else px(ctx, x - 4, y + 3, 'ink', 3, 1), px(ctx, x + 2, y + 3, 'ink', 3, 1);
  for (const k of [-5, 5]) px(ctx, x + k, y + 1, 'mudD'); // knobbly skin at the jaw hinge
}
function snapjawFrame(view, { step = 0, open = 0 } = {}) {
  const [c, ctx] = makeCanvas(48, 40);
  const st = step ? 1 : 0;
  if (view === 'side') { // facing right: the shell's high dome in profile, the head out front
    turtleLeg(ctx, 15 - st, 33, 3.5, 3, true); turtleLeg(ctx, 31 + st, 33, 3.5, 3, true); // far legs
    for (let i = 0; i < 5; i++) px(ctx, 4 - i, 28 + (i >> 1), i % 2 ? 'mossD' : 'mudD', 2, 2); // the spiked tail
    for (let x = 5; x < 41; x++) { // the dome: the plates' rows bending over it, the rim along the bottom
      const u = (x - 23) / 18, top = Math.round(29 - Math.sqrt(Math.max(0, 1 - u * u)) * 17);
      for (let y = top; y < 30; y++) {
        const v = (y - top) / Math.max(1, 30 - top), row = Math.floor((x - 5 + (y < 18 ? 3 : 0)) / 7);
        let l = 0.62 - u * 0.22 - v * 0.35 + ((x - 5) % 7 < 1 || (y > 25 && y < 27) ? -0.28 : 0) + (y === top ? 0.2 : 0);
        if (y < top + 2 && row % 2 === 0) l += 0.1; // the spine plates' keels along the top
        if (vnoise(x / 3, y / 3, 64) > 0.74 && v < 0.5) { px(ctx, x, y, 'grass'); continue; }
        px(ctx, x, y, SHELL[Math.max(0, Math.min(5, Math.floor(l * 6 + (bayer(x, y) - 0.5) * 0.25)))]);
      }
    }
    for (let i = 0; i < 4; i++) { const x = 12 + i * 7, u = (x - 23) / 18; px(ctx, x, Math.round(29 - Math.sqrt(1 - u * u) * 17) - 1, 'mist'); } // the spikes along the spine
    px(ctx, 5, 30, 'mossD', 36, 2); px(ctx, 7, 31, 'sand', 32, 1); // the rim and a line of pale belly under it
    turtleLeg(ctx, 13 + st, 34, 4, 3); turtleLeg(ctx, 33 - st, 34, 4, 3); // near legs
    shadedBlob(ctx, 41, 28, 3.5, 3, TURTLE_SKIN); // the neck
    shadedBlob(ctx, 44, 26, 4.5, 4, TURTLE_SKIN); // the head: a heavy wedge
    px(ctx, 44, 24, 'goldL'); px(ctx, 45, 24, 'ink');
    px(ctx, 47, 26, 'bone', 1, 3); px(ctx, 46, 28 + open, 'mist', 2, 1); // the hook of the beak
    if (open) px(ctx, 43, 28, 'redD', 4, open);
    outline(c, 'ink');
    return c;
  }
  const up = view === 'up';
  if (up) { turtleHeadFront(ctx, 24, 6, 0); px(ctx, 19, 3, 'mossD', 10, 3); } // the head, beyond the shell (only its top shows)
  else for (let i = 0; i < 5; i++) px(ctx, 23 + (i % 2), 6 - i, i % 2 ? 'mossD' : 'mudD', 2, 2); // the spiked tail, beyond
  // legs: the near pair stepping, the far pair peeking past the shell
  const nearY = up ? 13 : 27, farY = up ? 27 : 13;
  turtleLeg(ctx, 10 - st, farY, 3.5, 3, true); turtleLeg(ctx, 38 + st, farY, 3.5, 3, true);
  turtleLeg(ctx, 8 + st, nearY, 4.5, 4); turtleLeg(ctx, 40 - st, nearY, 4.5, 4);
  turtleShell(ctx, 24, 20, 17, 12, up ? -1 : 1);
  if (up) for (let i = 0; i < 6; i++) px(ctx, 23 + (i % 2), 31 + i, i % 2 ? 'mossD' : 'mudD', 2, 2); // the tail toward you, spikes along it
  else turtleHeadFront(ctx, 24, 32, open);
  outline(c, 'ink');
  return c;
}
// on its back: the pale belly plates up, the legs waving
function snapjawFlipped(step = 0) {
  const [c, ctx] = makeCanvas(48, 40);
  for (const [x, y] of [[9, 14], [39, 14], [11, 28], [37, 28]]) turtleLeg(ctx, x + (step ? (x < 24 ? -1 : 1) : 0), y - (step ? 2 : 0), 3.5, 3);
  shadedBlob(ctx, 24, 22, 17, 10, ['mud', 'dirtL', 'sand', 'bone']);
  for (let y = 14; y < 31; y += 4) px(ctx, 12, y, 'dirt', 25, 1); // the belly's plates, in rows
  px(ctx, 24, 13, 'dirt', 1, 18);
  px(ctx, 7, 22, 'mossD', 3, 2); // the shell's rim showing at the edge
  outline(c, 'ink');
  return c;
}
export function buildSnapjaw(vs = ['down', 'side', 'up']) {
  const flipped = [snapjawFlipped(0), snapjawFlipped(1)];
  const views = {};
  for (const v of vs) {
    const F = (o) => snapjawFrame(v, o);
    views[v] = { idle: [F({}), F({})], walk: [F({}), F({ step: 1 })], windup: [F({ open: 1 }), F({ step: 1, open: 1 })], attack: [F({ open: 2 }), F({ step: 1 })], hurt: [F({})], flipped };
  }
  return views;
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
// Spiderlings: drawn at their own size, not the spider shrunk (shrinking lost
// the legs and left a purple dot). A red-eyed head over a round abdomen with a
// pale mark, and eight thin legs, each bent at the knee, that step in two
// sets of four (alternating, as a real spider walks).
const LING_LEGS = [ // [hip dy, knee dx, knee dy, foot dx, foot dy] for the right side; the left mirrors them
  [-1, 2, -2, 4, -4], [0, 3, -1, 4, 0], [0, 3, 1, 4, 3], [1, 2, 2, 3, 4],
];
function lingFrame({ step = 0, rear = 0, open = false }) {
  const [c, ctx] = makeCanvas(32, 32);
  const cx = 16, cy = 22 - rear;
  const line = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) px(ctx, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 'night'); };
  for (const side of [1, -1]) LING_LEGS.forEach(([hy, kx, ky, fx, fy], i) => {
    // the sets: right 1 and 3 with left 2 and 4, then the others; a lifted foot reaches on and its knee rises
    const up = step && ((i % 2 === 0) === (side > 0)) === (step === 1);
    const hx = cx + side, hY = cy + 1 + hy;
    const kX = hx + side * kx, kY = hY + ky - (up ? 1 : 0), fX = hx + side * fx, fY = 23 + hy + fy - (up ? 1 : 0); // (feet stay planted as the body rears)
    line(hx, hY, kX, kY); line(kX, kY, fX, fY);
  });
  grid(ctx, ['.PPP.', 'PpLpP', 'PLpCP', 'PpCpP', '.PPP.'], SPIDER, cx - 2, cy);
  grid(ctx, open ? ['PPP', 'EpE', 'W.W'] : ['PPP', 'EpE', '.W.'], SPIDER, cx - 1, cy - 3);
  outline(c, 'ink');
  return c;
}
export function buildSpiderling() {
  return {
    idle: [lingFrame({}), lingFrame({ rear: 1 })],
    walk: [lingFrame({ step: 1 }), lingFrame({}), lingFrame({ step: 2 }), lingFrame({})],
    windup: [lingFrame({ rear: 1, open: true }), lingFrame({ rear: 2, open: true })],
    attack: [lingFrame({ step: 1, open: true }), lingFrame({})],
    hurt: [lingFrame({})],
  };
}

// Egg sac: a silk-wrapped bundle tied down by guy lines, the eggs showing as
// pale bumps through the wrapping. Stage 1, about to hatch: swollen, the
// silk stretched thin over dark shapes that stir; stage 2, the torn husk left
// behind, open at the top.
const SAC = { W: 'web', m: 'mist', b: 'bone', w: 'white', e: 'purpL', p: 'purp', d: 'purpD', E: 'redL', n: 'night' };
export function eggSac(stage = 0) {
  const [c, ctx] = makeCanvas(16, 16);
  const rows = [
    ['......bb........', '.....bwWb.......', '....bwWeWm......', '...bWWeWWem.....', '...bWeWWeWm.....', '..bWWWeWWWem....', '..bWeWWWeWWm....', '..mWWeWWWeWm....', '...mWWWeWWm.....', '....mmWWmm......'],
    ['.....bb.........', '....bwWWb.......', '...bWpWWpWm.....', '..bWpdpWdpWm....', '..bWWpWWpEWm....', '.bWpdpWpdpWWm...', '.bWWpEWWpWWWm...', '.mWpdpWpdpWm....', '..mWWpWWpWm.....', '...mmWWWmm......'],
    ['................', '................', '...b.....b......', '..bWb...bWm.....', '..bWnb.bnWm.....', '.bWnnnnnnnWm....', '.bWnnnnnnnWm....', '.mWWnnnnnWWm....', '..mWWWWWWWm.....', '...mmWWWmm......'],
  ][stage];
  grid(ctx, rows, SAC, 2, 4);
  outline(c, 'ink');
  // guy lines to the ground (after the outline, so they stay one pixel)
  const g = [[2, 13], [1, 14], [12, 13], [13, 14], [7, 2], [7, 3]];
  if (stage < 2) for (const [x, y] of g) px(ctx, x, y, 'web');
  else for (const [x, y] of g.slice(0, 4)) px(ctx, x, y, 'web');
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
// The Hex Sentinel: a cursed ice crystal set up as a watch-turret. A tall
// six-sided shard, pointed, held in two iron bands, lesser crystals grown off
// the carved frost-stone drum it stands on; a hex eye in an iron mount on its
// face (the side it watches from), a hex vein running up through the ice from
// the rune on the drum to the eye, and two ice shards circling it. Lit from
// the upper left: the left face brightest, the right darkest. Three views (it
// turns to face its mark). 32x44, ground at y=34 (origin 0.75).
const SENT_CX = 16, SENT_TIP = 2, SENT_FOOT = 29;
// the crystal: faces listed left to right as [width, upper tone, lower tone]
function sentCrystal(ctx, faces, lift = 0) {
  const W = faces.reduce((n, f) => n + f[0], 0), top = SENT_TIP - lift;
  for (let y = top; y <= SENT_FOOT; y++) {
    const r = y - top, taper = r < 6 ? (r + 1) / 6 : 1, hw = Math.max(1, Math.round((W / 2) * taper));
    const x0 = SENT_CX - hw, low = r > (SENT_FOOT - top) * 0.55;
    for (let x = x0; x < SENT_CX + hw; x++) {
      let u = ((x - x0 + 0.5) / (2 * hw)) * W, f = 0;
      while (f < faces.length - 1 && u > faces[f][0]) { u -= faces[f][0]; f++; }
      px(ctx, x, y, low ? faces[f][2] : faces[f][1]);
    }
    if (r >= 5 && r < 14) px(ctx, x0 + 1, y, 'white'); // the glint down its lit edge
  }
}
function sentBand(ctx, y, hw) { px(ctx, SENT_CX - hw - 1, y, 'steel', hw * 2 + 2, 1); px(ctx, SENT_CX - hw - 1, y + 1, 'steelD', hw * 2 + 2, 1); px(ctx, SENT_CX - hw - 1, y, 'steelL'); }
function sentShard(ctx, x, y, glow) { px(ctx, x, y + 1, 'iceXL', 1, 3); px(ctx, x + 1, y + 1, 'ice', 1, 3); px(ctx, x, y, glow ? 'curseL' : 'iceXL', 2, 1); px(ctx, x, y + 4, 'iceD', 2, 1); }
function sentDrum(ctx, back, rune) {
  shadedBlob(ctx, SENT_CX, 31, 11, 4, ['frostD', 'frost', 'frostL', 'snow']); // the drum, its lit top
  px(ctx, SENT_CX - 11, 31, 'frostD', 22, 3); px(ctx, SENT_CX - 11, 31, 'frost', 7, 3); px(ctx, SENT_CX - 11, 34, 'frostD', 22, 1);
  for (const x of [SENT_CX - 9, SENT_CX - 3, SENT_CX + 4]) px(ctx, x, 27 + (x % 2), 'snowL', 3, 1); // snow lying on its rim
  if (back) { px(ctx, SENT_CX + 3, 31, 'slate', 1, 2); px(ctx, SENT_CX + 4, 33, 'slate'); return; } // a crack behind
  const c = rune ? 'curseL' : 'purp'; // the hex rune carved in its face
  px(ctx, SENT_CX - 1, 31, c, 2, 1); px(ctx, SENT_CX - 2, 32, c); px(ctx, SENT_CX + 1, 32, c); px(ctx, SENT_CX - 1, 33, c, 2, 1);
}
// the hex vein: the curse running up through the ice from the rune to the eye;
// lit from the bottom as it winds up (0 dim, 1-3 rising, 4 all white)
function sentVein(ctx, lit, dx = 0, eyeY = 15) {
  const pts = [[0, 28], [0, 27], [1, 26], [1, 25], [0, 24], [0, 23], [-1, 22], [-1, 21], [0, 20], [0, 19], [0, eyeY + 3]];
  pts.forEach(([x, y], i) => { const k = (i + 1) / pts.length; px(ctx, SENT_CX + x + dx, y, lit === 4 ? 'white' : lit && k <= lit / 3 ? (k > (lit - 1) / 3 ? 'curseL' : 'curse') : 'purp'); });
  px(ctx, SENT_CX + 2 + dx, 6, 'purp'); px(ctx, SENT_CX + 1 + dx, 7, 'purp'); // a hairline near its tip
}
// a lesser crystal grown off the drum, leaning out in clean steps: [x at its foot, height, lean -1/1]
function sentSpike(ctx, x, h, lean, flash) {
  for (let r = 0; r < h; r++) {
    const y = 30 - r, xx = x + lean * Math.floor(r / 4), tip = h - r; // a straight-sided shard, pointed over its last two rows
    if (tip === 1) { px(ctx, xx + 1, y, flash ? 'white' : 'iceXL'); continue; }
    px(ctx, xx, y, flash ? 'white' : 'iceXL'); px(ctx, xx + 1, y, flash ? 'iceXL' : r > h / 2 ? 'iceL' : 'ice');
    if (tip > 2) px(ctx, xx + 2, y, r > h / 2 ? 'ice' : 'iceD');
  }
}
// the eye: 0 a slit, 1 watching, 2 wide open, 3 flaring
function sentEye(ctx, open, y = 15) {
  const rows = open === 0 ? [5] : open === 1 ? [3, 5, 3] : [3, 5, 7, 5, 3], y0 = y - (rows.length >> 1);
  if (open >= 2) for (const [x, yy] of [[-4, -1], [-4, 1], [4, -1], [4, 1], [-2, -3], [2, -3], [-2, 3], [2, 3]]) px(ctx, SENT_CX + x, y + yy, 'purpL'); // its glow on the ice round it
  rows.forEach((w, i) => { px(ctx, SENT_CX - (w >> 1) - 1, y0 + i, 'steelD', w + 2, 1); }); // its iron mount, then the socket
  px(ctx, SENT_CX - 1, y0 - 1, 'steelD', 3, 1); px(ctx, SENT_CX - 1, y0 + rows.length, 'steelD', 3, 1);
  rows.forEach((w, i) => px(ctx, SENT_CX - (w >> 1), y0 + i, 'hexD', w, 1));
  if (open === 0) { px(ctx, SENT_CX, y, 'curse'); return; }
  const r = open >= 2 ? 1 : 0;
  px(ctx, SENT_CX - r, y - r, open === 3 ? 'curseL' : 'curse', 1 + 2 * r, 1 + 2 * r); px(ctx, SENT_CX, y, open === 3 ? 'white' : 'curseL');
  if (open >= 2) px(ctx, SENT_CX - 1, y - 1, 'white');
  if (open === 3) for (const [x, yy] of [[-5, 0], [5, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]]) px(ctx, SENT_CX + x, y + yy, 'curseL'); // flaring out
}
function sentinelView(view, { eye = 1, shards = [[-11, 12], [10, 15]], glow = 0, vein = 0, rune = false, lift = 0, flash = false, hurt = false } = {}) {
  const [c, ctx] = makeCanvas(32, 44), side = view === 'side', back = view === 'up';
  const faces = side ? [[5, 'iceXL', 'iceL'], [5, 'ice', 'iceD']] : [[3, 'iceXL', 'iceL'], [6, 'iceL', 'ice'], [3, 'ice', 'iceD']];
  const hw = side ? 5 : 6, shard = (s) => sentShard(ctx, SENT_CX + s[0], s[1], glow);
  if (side) shards.filter((s) => s[0] < 0).forEach(shard); // the one behind it
  if (side) sentSpike(ctx, SENT_CX - 8, 12, -1, flash);
  else { sentSpike(ctx, back ? SENT_CX + 5 : SENT_CX - 8, 13, back ? 1 : -1, flash); sentSpike(ctx, back ? SENT_CX - 8 : SENT_CX + 5, 9, back ? -1 : 1, flash); } // the lesser crystals, behind (mirrored from behind)
  sentDrum(ctx, back, rune);
  if (flash) sentCrystal(ctx, side ? [[5, 'white', 'iceXL'], [5, 'iceXL', 'ice']] : [[3, 'white', 'iceXL'], [6, 'iceXL', 'iceL'], [3, 'iceL', 'ice']], lift);
  else sentCrystal(ctx, faces, lift);
  if (!back) sentVein(ctx, hurt || flash ? 4 : vein, side ? -1 : 0);
  sentBand(ctx, 9 - lift, hw - 1); sentBand(ctx, 21 - lift, hw);
  for (const x of side ? [-2, 2] : [-3, 0, 3]) { px(ctx, SENT_CX + x, 9 - lift, 'purpL'); px(ctx, SENT_CX + x, 21 - lift, 'purpL'); } // its rivets
  if (back) { px(ctx, SENT_CX - 2, 13 - lift, 'steelD', 4, 5); px(ctx, SENT_CX - 2, 13 - lift, 'steel', 4, 1); px(ctx, SENT_CX - 1, 15 - lift, 'purpL', 2, 1); } // the mount's back plate
  else if (side) { // the eye's mount stands out from its face
    const y = 15 - lift, e = hurt ? 'white' : eye >= 2 ? 'curseL' : 'curse';
    px(ctx, SENT_CX + 5, y - 2, 'steelD', 2, 5); px(ctx, SENT_CX + 7, y - 1, 'steelD', 1, 3); px(ctx, SENT_CX + 7, y, e); if (eye >= 2) px(ctx, SENT_CX + 8, y, eye === 3 ? 'white' : 'curse');
    if (eye === 3) for (const [x, yy] of [[9, -2], [10, 0], [9, 2]]) px(ctx, SENT_CX + x, y + yy, 'curseL');
  } else sentEye(ctx, hurt ? 0 : eye, 15 - lift);
  (side ? shards.filter((s) => s[0] >= 0) : shards).forEach(shard);
  outline(c, 'ink');
  if (hurt && !back && !side) px(ctx, SENT_CX, 15, 'white');
  return c;
}
const SENT_POSES = {
  idle: [{}, { shards: [[-11, 13], [10, 14]] }],
  walk: [{}],
  windup: [{ eye: 1, shards: [[-9, 11], [8, 13]], rune: true, vein: 1 }, { eye: 2, shards: [[-7, 10], [6, 11]], glow: 1, rune: true, vein: 2 }, { eye: 2, shards: [[-4, 9], [3, 9]], glow: 1, rune: true, vein: 3 }], // the rune lights, the curse climbs the vein to its eye, the shards swing round before it (held)
  attack: [{ eye: 3, shards: [], glow: 1, rune: true, flash: true, lift: 1 }, { eye: 2, shards: [], vein: 2 }, { eye: 1, shards: [[-10, 17], [9, 18]] }], // they fly; its eye flares, the ice flashes; new ones forming low
  hurt: [{ hurt: true }],
};
export function buildSentinel() {
  const out = {};
  for (const v of ['down', 'side', 'up']) { out[v] = {}; for (const [a, ps] of Object.entries(SENT_POSES)) out[v][a] = ps.map((p) => sentinelView(v, p)); }
  return out;
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
// A hulking hunched troll: blue-grey hide, a shaggy mantle of white fur over
// the shoulders with icicles in its fringe, a small head with big tusks sunk
// between them, long arms ending in huge frost-crusted fists. Pounds the
// ground with both. 56x56, feet on y=47, in three views (as Keep Defense's
// troll: the same build turned, from the same heights - feet 47, gut 32,
// shoulders 21, head 18).
const TROLL_BELLY = ['frost', 'frostL', 'snowD', 'snow'];
// the fur mantle: a pelt with a shaggy hanging fringe (icicles in it) and a tufted top
function trollPelt(ctx, cx, cy, rx, ry, seed, fringe = 4) {
  shadedBlob(ctx, cx, cy, rx, ry, SNOWFUR);
  for (let x = Math.ceil(cx - rx + 1); x <= Math.floor(cx + rx - 1); x++) {
    const u = (x + 0.5 - cx) / rx, bottom = Math.round(cy + Math.sqrt(Math.max(0, 1 - u * u)) * ry);
    const clump = Math.floor((x + seed) / 3), len = 1 + Math.floor(hash(clump, seed, 21) * fringe) - ((x + seed) % 3 === 2 ? 1 : 0); // hanging in clumps, not a comb
    px(ctx, x, bottom, hash(clump, seed, 27) < 0.3 ? 'snowD' : 'snow', 1, Math.max(1, len)); px(ctx, x, bottom + Math.max(1, len) - 1, u > 0.2 ? 'frost' : 'snowD'); // each clump's tip in shadow
    if (hash(x, seed, 26) < 0.14) { px(ctx, x, bottom + len, 'iceL', 1, 2); px(ctx, x, bottom + len + 2, 'iceXL'); } // an icicle
    const top = Math.round(cy - Math.sqrt(Math.max(0, 1 - u * u)) * ry);
    if (hash(x, seed, 23) < 0.4) px(ctx, x, top - 1, u < 0.2 ? 'snowXL' : 'snow'); // tufts along the top
  }
  for (let i = 0; i < rx * 2.2; i++) { // shaggy strokes: lit on the left, shadowed on the right
    const x = Math.round(cx - rx + 2 + hash(i, seed, 24) * (rx * 2 - 4)), y = Math.round(cy - ry * 0.4 + hash(i, seed, 25) * ry);
    px(ctx, x, y, x < cx - 2 ? 'snowXL' : x > cx + 3 ? 'frost' : 'snowD', 1, 2);
  }
}
// hide: a shaded blob with a lit rim on its upper left and old scars and warts
function trollHide(ctx, cx, cy, rx, ry, seed, tones = FROSTSKIN, spots = 3) {
  shadedBlob(ctx, cx, cy, rx, ry, tones);
  for (let i = 0; i < spots; i++) { const a = hash(i, seed, 31) * Math.PI * 2, r = Math.sqrt(hash(i, seed, 32)) * 0.7; px(ctx, Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r), tones[0]); }
}
// a fist: knuckles across it, frost crusted on top, claws at the front
function trollFist(ctx, fx, fy, side = false, tones = FROSTSKIN) {
  trollHide(ctx, fx, fy, 6, 5.5, Math.round(fx * 7 + fy), tones, 1);
  if (side) { px(ctx, fx + 2, fy - 2, 'frostD', 1, 4); px(ctx, fx + 5, fy + 1, 'bone', 2, 1); px(ctx, fx + 5, fy + 3, 'bone', 2, 1); }
  else { px(ctx, fx - 4, fy + 2, 'frostD', 8, 1); for (const k of [-3, 0, 3]) px(ctx, fx + k - 1, fy + 4, 'bone', 2, 1); } // knuckles, claws
  for (const k of [-3, -1, 1, 3]) if (!side || k < 2) px(ctx, fx + k, fy - 5 + (k & 1), k < 0 ? 'snowXL' : 'snowL'); // frost on the back of the hand
}
function trollFace(ctx, x, y, eye) { // facing you
  px(ctx, x - 4, y - 3, 'frostL', 4, 1); px(ctx, x, y - 3, 'frost', 4, 1); // a heavy brow, lit at its left
  px(ctx, x - 4, y - 2, 'frostD', 3, 2); px(ctx, x + 1, y - 2, 'frostD', 3, 2); // deep-set sockets
  px(ctx, x - 3, y - 1, eye); px(ctx, x + 2, y - 1, eye); // small mean eyes
  px(ctx, x - 1, y - 1, 'frostL', 2, 2); px(ctx, x - 1, y + 1, 'frostD', 2, 1); // a broad flat nose
  px(ctx, x - 3, y + 3, 'ink', 7, 1); px(ctx, x - 2, y + 4, 'frostD', 5, 1); // the wide mouth and heavy jaw
  for (const tx of [x - 4, x + 3]) { px(ctx, tx, y + 1, 'white', 2, 1); px(ctx, tx, y + 2, 'bone', 2, 2); } // tusks up out of the jaw
}
function trollDown({ fl = 0, fr = 0, bob = 0, raise = 0, eye = 'goldL', ll = 0, lr = 0 }, up = false) {
  const [c, ctx] = makeCanvas(56, 56);
  const y = bob;
  trollHide(ctx, 21, 43 - ll, 5, 4.5, 1); trollHide(ctx, 35, 43 - lr, 5, 4.5, 2); // legs
  px(ctx, 17, 47 - ll, 'frostD', 9, 1); px(ctx, 31, 47 - lr, 'frostD', 9, 1);
  if (!up) for (const fx of [18, 22, 32, 36]) px(ctx, fx, 47 - (fx < 28 ? ll : lr), 'bone'); // toenails
  const arms = [[13, -1, fl], [43, 1, fr]];
  const arm = ([sx, d, f]) => {
    const fy = 38 + y + f - raise * 24, fx = sx + d * (4 - raise * 7); // raised for the pound: up over the head
    for (let k = 0; k <= 6; k++) trollHide(ctx, sx + (fx - sx) * k / 6, 22 + y + (fy - 22 - y) * k / 6, 3.5, 3.5, 3 + k, FROSTSKIN, 0);
    trollFist(ctx, fx, fy, false);
  };
  if (up) arms.forEach(arm); // facing away, the arms are beyond the body
  trollHide(ctx, 28, 32 + y, 13, 11, 4, up ? ['frostD', 'frostD', 'frost', 'frostL'] : FROSTSKIN, 5); // gut and chest (or the broad back)
  if (up) for (let i = 0; i < 5; i++) px(ctx, 27 + (i % 2), 30 + y + i * 2, 'frostD'); // the spine's knobs
  else { trollHide(ctx, 28, 36 + y, 7, 5, 5, TROLL_BELLY, 0); px(ctx, 25, 37 + y, 'frost', 6, 1); } // the pale belly and its fold
  trollPelt(ctx, 28, 21 + y, 16.5, 6, up ? 3 : 5, 5); // the mantle across the shoulders
  trollHide(ctx, 28, (up ? 16 : 18) + y, up ? 5.5 : 6.5, up ? 4.5 : 5.5, 6, up ? ['frostD', 'frost', 'frost', 'frostL'] : FROSTSKIN, 0); // the head, sunk low
  if (up) { px(ctx, 21, 14 + y, 'frost', 2, 3); px(ctx, 33, 14 + y, 'frost', 2, 3); } // ears
  else trollFace(ctx, 28, 18 + y, eye);
  for (const [x, yy] of [[18, 15], [38, 15], [28, 12]]) { px(ctx, x, yy + y, 'iceXL', 1, 3); px(ctx, x, yy + y - 1, 'iceL'); } // icicles frozen into the fur
  if (!up) arms.forEach(arm); // facing you, the arms swing in front
  outline(c, 'ink');
  return c;
}
// facing right: the same build turned - upright, the gut out front, the
// mantle across the shoulders, the head sunk low and forward
function trollSide({ fl = 0, bob = 0, raise = 0, eye = 'goldL', step = 0 }) {
  const [c, ctx] = makeCanvas(56, 56);
  const y = bob, legs = [[0, 0], [2, -2], [0, 0], [-2, 2]][step % 4];
  const FAR = ['frostD', 'frostD', 'frost', 'frostL'];
  const fax = 25 - fl + raise * 4, fay = 39 + y - raise * 24; // the far arm and leg, behind
  for (let k = 0; k <= 6; k++) shadedBlob(ctx, 27 + (fax - 27) * k / 6, 24 + y + (fay - 24 - y) * k / 6, 3, 3, FAR);
  trollFist(ctx, fax, fay, true, FAR);
  shadedBlob(ctx, 25 + legs[0], 43, 4.5, 4.5, FAR); px(ctx, 22 + legs[0], 47, 'frostD', 8, 1);
  trollHide(ctx, 27, 31 + y, 11, 11, 4, FROSTSKIN, 4); // an upright barrel of a body
  trollHide(ctx, 33, 35 + y, 7, 7, 5, TROLL_BELLY, 0); // the gut pushed out front
  trollHide(ctx, 31 + legs[1], 43, 5, 4.5, 2); px(ctx, 28 + legs[1], 47, 'frostD', 9, 1); px(ctx, 35 + legs[1], 47, 'bone'); // the near leg
  trollPelt(ctx, 28, 21 + y, 11.5, 5, 7, 4);
  const hx = 37, hy = 19 + y; // the head, sunk low in front of the shoulders
  trollHide(ctx, hx, hy, 5.5, 5, 6, FROSTSKIN, 0);
  px(ctx, hx - 1, hy - 3, 'frostD', 6, 1); px(ctx, hx - 1, hy - 4, 'frostL', 3, 1); // the heavy brow
  px(ctx, hx + 1, hy - 2, 'ink', 3, 2); px(ctx, hx + 2, hy - 2, eye, 2, 1);
  px(ctx, hx + 5, hy, 'frostD', 1, 2); // the nose
  px(ctx, hx + 4, hy + 1, 'bone', 1, 4); px(ctx, hx + 4, hy + 1, 'white'); // a tusk
  px(ctx, hx - 4, hy - 3, 'frost', 2, 3); px(ctx, hx - 4, hy - 3, 'frostD'); // the ear
  px(ctx, hx + 1, hy + 3, 'frostD', 4, 1); // the jaw
  for (const [x, yy] of [[22, 15], [32, 14]]) { px(ctx, x, yy + y, 'iceXL', 1, 3); px(ctx, x, yy + y - 1, 'iceL'); }
  const ax = 31 + fl + raise * 2, ay = 40 + y - raise * 26, ARM = FROSTSKIN; // the near arm, hanging from the shoulder (up over the head for the pound)
  for (let k = 0; k <= 6; k++) { const x = 27 + (ax - 27) * k / 6, yy = 24 + y + (ay - 24 - y) * k / 6; px(ctx, Math.round(x - 4.5), Math.round(yy), 'frostD', 1, 2); shadedBlob(ctx, x, yy, 3.5, 3.5, ARM); }
  trollFist(ctx, ax, ay, true, ARM);
  outline(c, 'ink');
  return c;
}
export function buildTroll(vs = ['down', 'side', 'up']) {
  const D = (o) => trollDown(o), U = (o) => trollDown(o, true);
  const front = (F) => ({
    idle: [F({}), F({ bob: 1 })],
    walk: [F({ fl: -2, ll: 2 }), F({ fr: -2, bob: 1 }), F({ fl: 2, lr: 2 }), F({ fr: 2, bob: 1 })],
    windup: [F({ raise: 1, bob: -1 }), F({ raise: 1, bob: -2 })],
    attack: [F({ fl: 6, fr: 6, bob: 2 }), F({})],
    hurt: [F({ eye: 'white' })],
  });
  const all = {
    down: () => front(D),
    side: () => ({
      idle: [trollSide({}), trollSide({ bob: 1 })],
      walk: [0, 1, 2, 3].map((st) => trollSide({ step: st, fl: [-2, 0, 2, 0][st], bob: st % 2 })),
      windup: [trollSide({ raise: 1, bob: -1 }), trollSide({ raise: 1, bob: -2 })],
      attack: [trollSide({ fl: 5, bob: 2 }), trollSide({})],
      hurt: [trollSide({ eye: 'white' })],
    }),
    up: () => front(U),
  };
  return Object.fromEntries(vs.map((v) => [v, all[v]()]));
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
