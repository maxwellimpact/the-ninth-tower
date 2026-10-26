// World props and FX sprites. All return canvases (or arrays of frames).
// Anchor convention: props sit with their ground contact at the canvas
// bottom-centre unless noted.
import { makeCanvas, grid, px, outline, hash, bayer, vnoise } from './pixel.js';
import { shadedBlob } from './creatures.js';
import { cottage, street, doorOpen as cottageDoorOpen } from './cottage.js';

const LEAF = ['leafD', 'leaf', 'grass', 'grassL'];

export function tree(seed = 0) {
  const W = 40, H = 50;
  const [c, ctx] = makeCanvas(W, H);
  const r = (i) => hash(seed, i, 7);
  // trunk with root flare
  px(ctx, 17, 34, 'woodD', 6, 12);
  px(ctx, 18, 34, 'wood', 3, 12);
  px(ctx, 19, 36, 'woodL', 1, 6);
  px(ctx, 15, 44, 'woodD', 2, 2); px(ctx, 23, 44, 'woodD', 2, 2);
  // canopy: several overlapping lit blobs
  const blobs = [
    [11 + r(1) * 2, 25, 9, 8],
    [29 - r(2) * 2, 25, 9, 8],
    [20, 20, 14, 12],
    [15 + r(3) * 3, 12, 8, 7],
    [25 - r(4) * 3, 11, 8, 7],
  ];
  for (const [x, y, rx, ry] of blobs) shadedBlob(ctx, x, y, rx, ry, LEAF, { bias: -0.05 });
  // leaf clumps: little 2px highlights in the lit half
  for (let i = 0; i < 26; i++) {
    const x = 8 + Math.floor(r(10 + i) * 24), y = 5 + Math.floor(r(50 + i) * 22);
    const d = ctx.getImageData(x, y, 1, 1).data[3];
    if (!d) continue;
    const lit = x + y < 34;
    px(ctx, x, y, lit ? 'grassXL' : 'grass', 2, 1);
    px(ctx, x, y + 1, lit ? 'grassL' : 'leaf', 1, 1);
  }
  // shade band under the canopy where it overhangs the trunk
  for (let x = 12; x < 29; x++) for (let y = 30; y < 34; y++) {
    const d = ctx.getImageData(x, y, 1, 1).data;
    if (d[3] && bayer(x, y) < 0.6) px(ctx, x, y, 'leafD');
  }
  outline(c, 'ink');
  return c;
}

export function bush(seed = 0, berries = false) {
  const [c, ctx] = makeCanvas(20, 16);
  shadedBlob(ctx, 7, 9, 6, 5, LEAF);
  shadedBlob(ctx, 13, 9, 6, 5, LEAF);
  shadedBlob(ctx, 10, 6, 6, 5, LEAF);
  if (berries) for (let i = 0; i < 5; i++) {
    px(ctx, 5 + Math.floor(hash(seed, i, 3) * 10), 5 + Math.floor(hash(seed, i, 4) * 7), 'redL');
  }
  outline(c, 'ink');
  return c;
}

export function rock(seed = 0, big = false) {
  const w = big ? 20 : 14, h = big ? 14 : 10;
  const [c, ctx] = makeCanvas(w + 2, h + 2);
  shadedBlob(ctx, w / 2 + 1, h / 2 + 1, w / 2, h / 2, ['slate', 'stone', 'mist', 'bone']);
  // crack + moss
  const cx = Math.floor(w * (0.35 + hash(seed, 1) * 0.3));
  px(ctx, cx, h / 2, 'slate'); px(ctx, cx + 1, h / 2 + 1, 'slate'); px(ctx, cx + 1, h / 2 + 2, 'slate');
  px(ctx, 3, h - 2, 'grass', 3, 1); px(ctx, 2, h - 1, 'grassD', 4, 1);
  outline(c, 'ink');
  return c;
}

// Tall grass tuft, 3 sway frames.
export function grassTuft(seed = 0) {
  return [-1, 0, 1].map((sway) => {
    const [c, ctx] = makeCanvas(14, 12);
    const blades = 6;
    for (let i = 0; i < blades; i++) {
      const bx = 2 + i * 2 + Math.floor(hash(seed, i) * 2);
      const bh = 6 + Math.floor(hash(seed, i, 2) * 5);
      for (let y = 0; y < bh; y++) {
        const t = y / bh;
        const x = bx + Math.round(sway * t * t * 2 * (i % 2 ? 1 : 0.6));
        px(ctx, x, 11 - y, t > 0.7 ? 'grassXL' : t > 0.35 ? 'grassL' : 'grass');
      }
    }
    outline(c, 'leafD');
    return c;
  });
}

export function flowerPatch(seed = 0) {
  const [c, ctx] = makeCanvas(10, 8);
  const cols = ['white', 'gold', 'redL', 'blueL', 'purpL'];
  const col = cols[Math.floor(hash(seed, 9) * cols.length)];
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(hash(seed, i) * 7), y = 2 + Math.floor(hash(seed, i, 1) * 4);
    px(ctx, x, y + 1, 'grassD');
    px(ctx, x - 1, y, col); px(ctx, x + 1, y, col); px(ctx, x, y - 1, col); px(ctx, x, y + 1 - 2 + 2, col);
    px(ctx, x, y, 'goldL');
  }
  return c;
}

// Campfire: 4 flicker frames, 20x24.
export function campfire() {
  return [0, 1, 2, 3].map((f) => {
    const [c, ctx] = makeCanvas(20, 24);
    // stone ring
    for (const [x, y] of [[2, 19], [5, 21], [9, 22], [13, 21], [16, 19], [4, 17], [15, 17]]) {
      px(ctx, x, y, 'stone', 3, 2); px(ctx, x, y, 'mist', 1, 1);
    }
    // logs
    px(ctx, 5, 18, 'woodD', 10, 2); px(ctx, 6, 18, 'wood', 8, 1);
    px(ctx, 7, 16, 'woodD', 2, 4); px(ctx, 11, 16, 'woodD', 2, 4);
    // flame layers
    const hgt = [10, 12, 9, 11][f];
    const sway = [0, 1, 0, -1][f];
    for (let y = 0; y < hgt; y++) {
      const t = y / hgt;
      const half = Math.max(0, Math.round((1 - t) * 4.5 - (t > 0.6 ? 1 : 0)));
      const x0 = 10 + Math.round(sway * t * 2);
      for (let x = -half; x <= half; x++) {
        const edge = Math.abs(x) / (half + 0.01);
        const col = edge > 0.66 || t > 0.75 ? 'red' : edge > 0.33 || t > 0.5 ? 'fire' : t > 0.25 ? 'fireL' : 'goldL';
        px(ctx, x0 + x, 17 - y, col);
      }
    }
    // spark
    px(ctx, 8 + f * 2, 3 + (f % 2) * 2, 'fireL');
    return c;
  });
}

// The Ward Stone: cursed obelisk with a floating crystal. 4 pulse frames.
export function wardStone() {
  const rune = ['curse', 'curseL', 'white', 'curseL'];
  return [0, 1, 2, 3].map((f) => {
    const [c, ctx] = makeCanvas(28, 52);
    // base plinth
    px(ctx, 4, 44, 'slate', 20, 6); px(ctx, 4, 44, 'stone', 20, 1); px(ctx, 5, 49, 'night', 18, 1);
    // obelisk body (tapered)
    for (let y = 0; y < 28; y++) {
      const half = 4 + Math.floor(y / 6);
      for (let x = -half; x < half; x++) {
        const col = x < -half + 2 ? 'stone' : x > half - 3 ? 'night' : 'slate';
        px(ctx, 14 + x, 16 + y, col);
      }
    }
    // runes
    const rc = rune[f];
    for (const [x, y] of [[13, 20], [12, 21], [14, 21], [13, 22], [13, 27], [12, 28], [13, 29], [14, 29], [13, 34], [14, 35], [12, 36], [13, 37], [13, 40]]) px(ctx, x, y, rc);
    // floating crystal
    const cy = 6 + [0, -1, -2, -1][f];
    for (let y = 0; y < 9; y++) {
      const half = y < 4 ? y : 8 - y;
      for (let x = -half; x <= half; x++) px(ctx, 14 + x, cy + y, x < 0 ? 'curseL' : x === 0 ? 'white' : 'curse');
    }
    outline(c, 'ink');
    // glow motes (unoutlined)
    px(ctx, 6 + f * 3, 12 - f, 'curseL'); px(ctx, 22 - f * 2, 18 + f, 'curse');
    return c;
  });
}

export function wardRubble() {
  const [c, ctx] = makeCanvas(28, 52);
  px(ctx, 4, 44, 'slate', 20, 6); px(ctx, 4, 44, 'stone', 20, 1); px(ctx, 5, 49, 'night', 18, 1);
  for (const [x, y, w, h] of [[8, 38, 8, 6], [15, 36, 6, 8], [5, 41, 4, 3], [19, 40, 5, 4]]) {
    px(ctx, x, y, 'slate', w, h); px(ctx, x, y, 'stone', w, 1);
  }
  outline(c, 'ink');
  return c;
}

// Ruined gate pillar for Brightwater. 18x46.
export function pillar(broken = false) {
  const [c, ctx] = makeCanvas(18, 46);
  const top = broken ? 14 : 4;
  for (let y = top; y < 44; y++) {
    const row = Math.floor((y - top) / 5);
    for (let x = 2; x < 16; x++) {
      const mortar = (y - top) % 5 === 4 || (x + (row % 2) * 4) % 8 === 0;
      const col = mortar ? 'slate' : x < 5 ? 'mist' : x > 12 ? 'stone' : 'bone';
      px(ctx, x, y, col);
    }
  }
  if (!broken) { px(ctx, 0, 2, 'mist', 18, 3); px(ctx, 0, 2, 'bone', 18, 1); }
  else { px(ctx, 3, 12, 'mist', 5, 2); px(ctx, 10, 13, 'stone', 4, 1); }
  // ivy
  for (let i = 0; i < 9; i++) px(ctx, 3 + (i % 3), 30 + i, i % 2 ? 'grass' : 'leaf');
  px(ctx, 13, 36, 'grass', 2, 3);
  outline(c, 'ink');
  return c;
}

export function signpost() {
  const [c, ctx] = makeCanvas(16, 18);
  px(ctx, 7, 6, 'woodD', 2, 12);
  px(ctx, 1, 3, 'wood', 14, 6); px(ctx, 1, 3, 'woodL', 14, 1); px(ctx, 1, 8, 'woodD', 14, 1);
  px(ctx, 3, 5, 'woodD', 6, 1); px(ctx, 3, 6, 'woodD', 8, 1);
  outline(c, 'ink');
  return c;
}

export function lilyPad(seed = 0) {
  const [c, ctx] = makeCanvas(10, 7);
  shadedBlob(ctx, 5, 3.5, 4.5, 3, ['leafD', 'leaf', 'grass', 'grassL']);
  px(ctx, 5, 1, 'water', 1, 3);
  if (hash(seed, 3) > 0.5) { px(ctx, 6, 2, 'white', 2, 1); px(ctx, 7, 1, 'redL'); }
  return c;
}

export function barrel() {
  const [c, ctx] = makeCanvas(12, 14);
  shadedBlob(ctx, 6, 7, 5, 6, ['woodD', 'wood', 'woodL', 'woodL']);
  px(ctx, 1, 3, 'steelD', 10, 1); px(ctx, 1, 10, 'steelD', 10, 1);
  outline(c, 'ink');
  return c;
}

// A cracked flagstone with flooded dark water showing through (the monastery's
// cistern): something glints down there until you've dived for it. Lies flat on
// whatever floor it's set in, 20x14.
export function cisternCrack(dived = false) {
  const [c, ctx] = makeCanvas(20, 14);
  // the broken slab's rim, a little lighter than the floor round it
  for (const [x, y, w] of [[3, 1, 13], [1, 2, 18], [0, 3, 20], [0, 4, 20], [0, 5, 20], [0, 6, 20], [0, 7, 20], [0, 8, 20], [1, 9, 19], [1, 10, 18], [2, 11, 16], [4, 12, 11]]) px(ctx, x, y, 'stone', w, 1);
  // the hole: a jagged gap down to black water
  for (const [x, y, w] of [[7, 3, 5], [5, 4, 9], [4, 5, 12], [3, 6, 13], [4, 7, 12], [5, 8, 10], [6, 9, 7], [8, 10, 3]]) px(ctx, x, y, 'waterD', w, 1);
  if (dived) { px(ctx, 5, 5, 'water', 3, 1); px(ctx, 10, 7, 'water', 4, 1); px(ctx, 7, 9, 'water', 2, 1); } // just ripples now
  else { px(ctx, 9, 6, 'goldL', 2, 1); px(ctx, 10, 5, 'white'); px(ctx, 6, 7, 'water', 2, 1); px(ctx, 12, 4, 'water', 2, 1); } // a glint at the bottom
  // cracks running off into the slab
  for (const [x, y] of [[2, 4], [1, 5], [16, 5], [17, 4], [18, 3], [15, 8], [16, 9], [3, 9], [10, 11], [11, 12]]) px(ctx, x, y, 'slate');
  outline(c, 'ink');
  return c;
}

export function chest(open = false) {
  const [c, ctx] = makeCanvas(16, 16);
  if (!open) {
    px(ctx, 1, 4, 'wood', 14, 4); px(ctx, 1, 4, 'woodL', 14, 1);
    px(ctx, 1, 8, 'woodD', 14, 6); px(ctx, 2, 9, 'wood', 12, 4);
  } else {
    px(ctx, 1, 1, 'woodD', 14, 4); px(ctx, 2, 2, 'night', 12, 2);
    px(ctx, 1, 8, 'woodD', 14, 6); px(ctx, 2, 8, 'goldL', 12, 1); px(ctx, 2, 9, 'wood', 12, 4);
  }
  px(ctx, 1, 7, 'gold', 14, 1);
  px(ctx, 7, 7, 'goldL', 2, 3);
  px(ctx, 0, 4, 'gold', 1, 10); px(ctx, 15, 4, 'gold', 1, 10);
  outline(c, 'ink');
  return c;
}

// ------------------------------------------------------------------- FX

export function coin() {
  return [6, 4, 2, 4].map((w) => {
    const [c, ctx] = makeCanvas(8, 8);
    const x0 = 4 - w / 2;
    px(ctx, x0, 1, 'gold', w, 6);
    px(ctx, x0, 1, 'goldL', Math.max(1, w / 2), 5);
    outline(c, 'ink');
    return c;
  });
}

export function fireBolt() {
  return [0, 1, 2].map((f) => {
    const [c, ctx] = makeCanvas(16, 16);
    // horizontal comet pointing right; rotate in-game
    for (let x = 0; x < 11; x++) {
      const t = x / 10;
      const half = Math.round(t * 3.5);
      for (let y = -half; y <= half; y++) {
        if (bayer(x + f, y + 8) > t + 0.25) continue;
        const col = Math.abs(y) === half ? 'red' : t > 0.75 ? 'goldL' : t > 0.45 ? 'fireL' : 'fire';
        px(ctx, 2 + x, 8 + y, col);
      }
    }
    px(ctx, 12, 7, 'white', 2, 3);
    return c;
  });
}

export function sparkle(color = 'white', size = 2) {
  const [c, ctx] = makeCanvas(size * 2 + 1, size * 2 + 1);
  for (let i = -size; i <= size; i++) { px(ctx, size + i, size, color); px(ctx, size, size + i, color); }
  return c;
}

export function dot(color, n = 2) {
  const [c, ctx] = makeCanvas(n, n);
  px(ctx, 0, 0, color, n, n);
  return c;
}

export function hitStar() {
  return [0, 1, 2].map((f) => {
    const [c, ctx] = makeCanvas(17, 17);
    const r = [4, 7, 8][f];
    const col = ['white', 'goldL', 'gold'][f];
    for (let i = -r; i <= r; i++) {
      if (f < 2 || Math.abs(i) > 3) { px(ctx, 8 + i, 8, col); px(ctx, 8, 8 + i, col); }
    }
    const d = Math.round(r * 0.6);
    for (let i = 1; i <= d; i++) if (f < 2 || i > 2) { px(ctx, 8 + i, 8 + i, col); px(ctx, 8 - i, 8 + i, col); px(ctx, 8 + i, 8 - i, col); px(ctx, 8 - i, 8 - i, col); }
    return c;
  });
}

export function dustPuff() {
  return [3, 4, 5].map((r, f) => {
    const [c, ctx] = makeCanvas(12, 12);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (bayer(x + 6, y + 6) < f * 0.3) continue;
      px(ctx, 6 + x, 6 + y, x + y < 0 ? 'bone' : 'mist');
    }
    return c;
  });
}

export function shadow(w = 14, h = 5) {
  const [c, ctx] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
    if (nx * nx + ny * ny <= 1) px(ctx, x, y, '#000000');
  }
  return c;
}

export function ring(r, color) {
  const [c, ctx] = makeCanvas(r * 2 + 2, r * 2 + 2);
  for (let a = 0; a < Math.PI * 2; a += 0.5 / r) px(ctx, Math.round(r + 1 + Math.cos(a) * r), Math.round(r + 1 + Math.sin(a) * r * 0.5 + r * 0.5), color);
  return c;
}

// ------------------------------------------------------------ Mistfen props
export function deadTree(seed = 0) {
  const [c, ctx] = makeCanvas(32, 44);
  const r = (i) => hash(seed, i, 17);
  // trunk
  px(ctx, 14, 22, 'mudD', 5, 20); px(ctx, 15, 22, 'mud', 2, 20);
  px(ctx, 12, 40, 'mudD', 2, 2); px(ctx, 19, 40, 'mudD', 2, 2);
  // bare branches
  const branch = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) px(ctx, Math.round(x + dx * i), Math.round(y + dy * i), i % 3 ? 'mud' : 'mudD', 2, 1); };
  branch(16, 24, -0.9, -0.8, 9 + Math.floor(r(1) * 3));
  branch(17, 22, 0.9, -1, 8 + Math.floor(r(2) * 4));
  branch(16, 14, -0.5, -1, 6);
  branch(16, 12, 0.6, -0.9, 7);
  px(ctx, 15, 8, 'mudD', 2, 14);
  // moss tufts hanging
  for (let i = 0; i < 6; i++) px(ctx, 6 + Math.floor(r(10 + i) * 20), 6 + Math.floor(r(20 + i) * 14), 'mossL', 1, 2 + Math.floor(r(30 + i) * 3));
  outline(c, 'ink');
  return c;
}

export function reeds(seed = 0) {
  return [-1, 0, 1].map((sway) => {
    const [c, ctx] = makeCanvas(14, 18);
    for (let i = 0; i < 5; i++) {
      const bx = 2 + i * 2 + Math.floor(hash(seed, i) * 2);
      const bh = 9 + Math.floor(hash(seed, i, 2) * 7);
      for (let y = 0; y < bh; y++) {
        const t = y / bh;
        const x = bx + Math.round(sway * t * t * 1.5);
        px(ctx, x, 17 - y, t > 0.75 ? 'reed' : t > 0.4 ? 'mossL' : 'moss');
      }
      if (i % 2 === 0) { const x = bx + sway; px(ctx, x, 17 - bh - 2, 'reedD', 1, 3); }
    }
    outline(c, 'mossD');
    return c;
  });
}

export function mushrooms(seed = 0) {
  const [c, ctx] = makeCanvas(14, 10);
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(hash(seed, i) * 9), y = 3 + Math.floor(hash(seed, i, 1) * 3);
    px(ctx, x + 1, y + 2, 'mushL', 1, 3);
    px(ctx, x, y, 'mushR', 3, 2); px(ctx, x + 1, y, 'mushL');
  }
  outline(c, 'ink');
  return c;
}

export function stalagmite(seed = 0) {
  const [c, ctx] = makeCanvas(16, 22);
  const h = 14 + Math.floor(hash(seed, 1) * 6);
  for (let y = 0; y < h; y++) {
    const half = Math.max(0, Math.round((y / h) * 5));
    px(ctx, 8 - half, 21 - h + y, 'cave', half * 2 + 1, 1);
    px(ctx, 8 - half, 21 - h + y, 'caveXL', 1, 1);
    if (half > 1) px(ctx, 8 + half - 1, 21 - h + y, 'caveD', 1, 1);
  }
  outline(c, 'ink');
  return c;
}

export function crystal(seed = 0) {
  return [0, 1, 2, 1].map((f) => {
    const [c, ctx] = makeCanvas(12, 14);
    for (const [ox, h] of [[3, 9], [6, 12], [8, 7]]) {
      for (let y = 0; y < h; y++) {
        const half = y < 2 ? 0 : 1;
        px(ctx, ox - half, 13 - h + y, y < 3 ? 'crystalL' : 'crystal', half * 2 + 1, 1);
      }
    }
    if (f === 2) { px(ctx, 6, 1, 'white'); px(ctx, 3, 4, 'white'); }
    outline(c, 'caveD');
    return c;
  });
}

// Grapple post: stake with a ring on top.
export function grapplePost() {
  const [c, ctx] = makeCanvas(12, 22);
  px(ctx, 5, 6, 'woodD', 3, 16); px(ctx, 6, 6, 'wood', 1, 16);
  px(ctx, 3, 1, 'steel', 7, 1); px(ctx, 3, 5, 'steel', 7, 1); px(ctx, 3, 1, 'steel', 1, 5); px(ctx, 9, 1, 'steel', 1, 5);
  px(ctx, 4, 2, 'steelL', 1, 1);
  outline(c, 'ink');
  return c;
}

// Shaft of light marking the cave exit.
export function lightShaft() {
  const [c, ctx] = makeCanvas(32, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) {
    const half = 6 + y * 0.25;
    if (Math.abs(x - 16) > half) continue;
    if (bayer(x, y) > 0.35 + (1 - y / 40) * 0.2) continue;
    px(ctx, x, y, y > 34 ? 'goldL' : 'bone');
  }
  return c;
}

// Loot bag shown on the ground for a dropped item.
export function lootBag(rarityColor = 'goldL') {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(12, 12);
    px(ctx, 3, 4, 'woodD', 6, 6); px(ctx, 4, 5, 'wood', 4, 4); px(ctx, 4, 2, 'woodD', 4, 2); px(ctx, 5, 3, rarityColor, 2, 1);
    outline(c, 'ink');
    if (f) { px(ctx, 1, 1, rarityColor); px(ctx, 10, 3, rarityColor); }
    return c;
  });
}

// ------------------------------------------------------------ buildings
// Brightwater's cottages come from the cottage generator (cottage.js): the two
// body types alternate down each street, roofs and doors are dealt so no two
// neighbours match, and the rest (windows, chimney, ornaments) is rolled once
// from a fixed seed, so every building always looks the same. Each keeps the
// sign that says what's inside; the mayor's flies the town banner. The homes
// that open as townsfolk come home also have a boarded-up version
// (house(kind, true)). Any lit chimney smokes (chimneyOf).
export const CHIMNEYS = { mill: [13, -77] }; // smoke spouts for the non-cottages, from the sprite's bottom-centre
export const DOOR_H = 22; // cottage doors (the open-door overlay matches)
const STREETS = [ // west to east: the square's row, then the lower row
  ['curio', 'C', { sign: 'gem' }], ['shop', 'A', { sign: 'potion' }], ['tavern', 'C', { sign: 'mug', chimney: 'stone' }], ['mayor', 'A', { sign: 'crest', flag: true }],
  ['bath', 'C', { sign: 'steam', chimney: 'stone' }], ['archery', 'A', { sign: 'target' }],
];
const TOWN_SEED = 1;
const TOWN = Object.fromEntries(street(STREETS.length, TOWN_SEED, STREETS.map((s) => s[1])).map((f, i) => [STREETS[i][0], { ...f, ...STREETS[i][2] }]));
export const houseLook = (kind) => TOWN[kind] || TOWN.shop;
export function house(kind = 'shop', boarded = false) { return cottage(houseLook(kind), boarded); }
// where a cottage's doorway sits ({x, y, w, h} from the sprite's bottom-centre) and its open-door overlay
const geo = {};
const geoOf = (kind) => (geo[kind] ||= (() => { const c = house(kind); return { W: c.width, H: c.height, door: c.door, spout: c.spout }; })());
export function doorOf(kind) { const { W, H, door } = geoOf(kind); return { x: door.x - W / 2, y: door.y - H, w: door.w, h: door.h }; }
export function houseDoorOpen(kind) { return cottageDoorOpen(houseLook(kind)); }
export function chimneyOf(kind) {
  if (CHIMNEYS[kind]) return CHIMNEYS[kind];
  if (!TOWN[kind]) return null;
  const { W, H, spout } = geoOf(kind);
  return spout && [Math.round(spout[0] - W / 2), spout[1] - H + 1];
}

export function counter() {
  const [c, ctx] = makeCanvas(16, 18);
  px(ctx, 0, 2, 'woodL', 16, 4); px(ctx, 0, 2, 'goldL', 16, 1);
  px(ctx, 0, 6, 'wood', 16, 11); px(ctx, 0, 6, 'woodD', 16, 1);
  for (let x = 1; x < 16; x += 5) px(ctx, x, 8, 'woodD', 1, 8);
  return c;
}

export function shelf() {
  const [c, ctx] = makeCanvas(16, 22);
  px(ctx, 0, 0, 'woodD', 16, 22); px(ctx, 1, 1, 'wood', 14, 20);
  for (const y of [7, 14, 20]) px(ctx, 1, y, 'woodD', 14, 1);
  const jars = ['redL', 'blueL', 'grassL', 'goldL', 'purpL', 'foam'];
  for (let i = 0; i < 6; i++) { const x = 2 + (i % 3) * 5, y = i < 3 ? 2 : 9; px(ctx, x, y + 1, jars[i], 3, 4); px(ctx, x, y, 'bone', 3, 1); }
  px(ctx, 3, 16, 'woodL', 9, 4);
  outline(c, 'ink');
  return c;
}

export function table() {
  const [c, ctx] = makeCanvas(22, 16);
  shadedBlob(ctx, 11, 6, 10, 5, ['woodD', 'wood', 'woodL', 'goldL']);
  px(ctx, 10, 11, 'woodD', 2, 5);
  px(ctx, 7, 4, 'bone', 3, 3); px(ctx, 13, 5, 'gold', 3, 3); px(ctx, 13, 5, 'white', 3, 1);
  outline(c, 'ink');
  return c;
}

export function fireplace() {
  return [0, 1, 2].map((f) => {
    const [c, ctx] = makeCanvas(28, 30);
    px(ctx, 0, 2, 'slate', 28, 28); px(ctx, 2, 0, 'stone', 24, 4);
    for (let y = 4; y < 30; y += 4) for (let x = (y / 4) % 2 ? 0 : 3; x < 28; x += 6) px(ctx, x, y, 'stone', 5, 3);
    px(ctx, 6, 12, 'ink', 16, 18);
    const fl = [8, 10, 9][f];
    for (let y = 0; y < fl; y++) { const hw = Math.max(1, Math.round((1 - y / fl) * 6)); px(ctx, 14 - hw + (y > fl / 2 ? f - 1 : 0), 29 - y, y < fl * 0.4 ? 'fireL' : y < fl * 0.7 ? 'fire' : 'red', hw * 2, 1); }
    px(ctx, 9, 28, 'woodD', 10, 2);
    outline(c, 'ink');
    return c;
  });
}

export function rug() {
  const [c, ctx] = makeCanvas(36, 18);
  px(ctx, 0, 0, 'redD', 36, 18); px(ctx, 2, 2, 'red', 32, 14); px(ctx, 5, 5, 'gold', 26, 8); px(ctx, 6, 6, 'redD', 24, 6);
  for (let x = 0; x < 36; x += 3) { px(ctx, x, -0, 'bone', 1, 1); px(ctx, x, 17, 'bone', 1, 1); }
  return c;
}

export function whackBoard() {
  const [c, ctx] = makeCanvas(26, 24);
  px(ctx, 1, 4, 'woodD', 24, 18); px(ctx, 2, 5, 'wood', 22, 16);
  for (let i = 0; i < 9; i++) { const x = 4 + (i % 3) * 7, y = 7 + Math.floor(i / 3) * 5; px(ctx, x, y, 'ink', 5, 3); }
  px(ctx, 9, 9, 'purpL', 3, 2);
  px(ctx, 6, 0, 'woodD', 14, 5); px(ctx, 7, 1, 'goldL', 12, 3);
  outline(c, 'ink');
  return c;
}

// Cracked boulder sealing the hidden grotto (32px wide, covers 2 tiles).
export function crackedBoulder() {
  const [c, ctx] = makeCanvas(36, 30);
  shadedBlob(ctx, 18, 16, 16, 12, ['slate', 'stone', 'mist', 'bone']);
  const crack = [[18, 5], [17, 8], [19, 11], [16, 14], [18, 17], [15, 20], [17, 24], [20, 14], [23, 16], [25, 15], [13, 12], [11, 13]];
  for (const [x, y] of crack) px(ctx, x, y, 'night', 1, 2);
  px(ctx, 6, 24, 'grass', 6, 2); px(ctx, 24, 25, 'grassD', 7, 2);
  outline(c, 'ink');
  return c;
}

export function crackedWall() {
  const [c, ctx] = makeCanvas(16, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
    const top = y < 6;
    const row = Math.floor((y - 6) / 4);
    const mortar = !top && ((y - 6) % 4 === 3 || (x + (row % 2) * 4) % 8 === 0);
    px(ctx, x, y, top ? (y < 2 ? 'white' : 'bone') : mortar ? 'slate' : 'stone');
  }
  for (const [x, y] of [[8, 7], [7, 9], [8, 11], [9, 12], [7, 14], [6, 16], [8, 18], [10, 15], [11, 17]]) px(ctx, x, y, 'night', 1, 2);
  outline(c, 'ink');
  return c;
}

// Golden fly: tiny bug with flickering wings + glint.
export function goldenFly() {
  return [0, 1, 2, 3].map((f) => {
    const [c, ctx] = makeCanvas(11, 11);
    const wy = f % 2 ? 3 : 2;
    px(ctx, 2, wy, 'white', 2, 2); px(ctx, 7, wy, 'white', 2, 2);
    px(ctx, 4, 4, 'gold', 3, 3); px(ctx, 4, 4, 'goldL', 2, 1); px(ctx, 5, 7, 'hairBlD', 1, 1);
    if (f === 2) { px(ctx, 9, 0, 'goldL'); px(ctx, 10, 1, 'white'); }
    return c;
  });
}

export function herbNode(picked = false) {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(16, 14);
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 2, h = 5 + ((i * 7) % 4);
      for (let y = 0; y < h; y++) px(ctx, x + (y > h - 3 ? (i % 2 ? 1 : -1) : 0), 13 - y, picked ? 'mossD' : y > h - 3 ? 'grassXL' : 'grass');
    }
    if (!picked) { px(ctx, 5, 4, f ? 'white' : 'blueL', 2, 2); px(ctx, 10, 3, f ? 'blueL' : 'white', 2, 2); px(ctx, 8, 6, 'blueL'); }
    outline(c, 'leafD');
    return c;
  });
}

export function oreNode(picked = false) {
  const [c, ctx] = makeCanvas(20, 16);
  shadedBlob(ctx, 10, 9, 9, 6, picked ? ['night', 'slate', 'stone', 'stone'] : ['slate', 'stone', 'mist', 'bone']);
  if (!picked) for (const [x, y] of [[6, 7], [11, 6], [13, 10], [8, 11]]) { px(ctx, x, y, 'gold', 2, 1); px(ctx, x, y, 'goldL'); }
  outline(c, 'ink');
  return c;
}

export function arrow() {
  const [c, ctx] = makeCanvas(12, 3);
  px(ctx, 0, 1, 'bone', 9, 1); px(ctx, 9, 0, 'steelL', 2, 3); px(ctx, 11, 1, 'white'); px(ctx, 0, 0, 'redL', 2, 1); px(ctx, 0, 2, 'redL', 2, 1);
  return c;
}

// Dithered radial glow (white; tint + additive blend in-game). 32x32, radius 16.
export function glow(r = 16) {
  const [c, ctx] = makeCanvas(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
    if (d > 1) continue;
    const a = Math.pow(1 - d, 1.6);
    if (bayer(x, y) < a) px(ctx, x, y, 'white');
  }
  return c;
}

// Speech-bubble marker for harvestable things (icon drawn on top in-game).
export function bubble() {
  const [c, ctx] = makeCanvas(20, 22);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
    const nx = (x + 0.5 - 10) / 9.5, ny = (y + 0.5 - 9) / 8.5;
    if (nx * nx + ny * ny <= 1) px(ctx, x, y, y < 3 ? 'white' : 'bone');
  }
  px(ctx, 8, 17, 'bone', 4, 1); px(ctx, 9, 18, 'bone', 2, 1); px(ctx, 9, 19, 'bone', 1, 1);
  outline(c, 'ink');
  return c;
}

// Door in an interior's bottom wall. open=false: closed planks; open: daylight.
export function interiorDoor(open = false) {
  const [c, ctx] = makeCanvas(18, 20);
  px(ctx, 0, 0, 'woodD', 18, 20);
  if (open) { // bright daylight filling the doorway (no landscape: we're still looking at the inside wall)
    for (let y = 2; y < 20; y++) for (let x = 2; x < 16; x++) px(ctx, x, y, y < 8 ? 'white' : bayer(x, y) < (y - 8) / 14 ? 'goldL' : 'white');
    px(ctx, 2, 2, 'wood', 3, 18); px(ctx, 2, 2, 'woodL', 1, 18); // the door, swung inward
  } else {
    for (let x = 2; x < 16; x++) px(ctx, x, 2, x % 4 === 1 ? 'woodD' : x < 9 ? 'woodL' : 'wood', 1, 18);
    px(ctx, 12, 11, 'gold', 2, 2);
  }
  px(ctx, 0, 18, 'stone', 18, 2);
  outline(c, 'ink');
  return c;
}

// Floating orb (Orb of Echoes), drawn live above the hero.
export function orb() {
  const [c, ctx] = makeCanvas(9, 9);
  shadedBlob(ctx, 4.5, 4.5, 3.4, 3.4, ['purpD', 'purp', 'purpL', 'white']);
  outline(c, 'hexD');
  return c;
}


// ------------------------------------------------------------ Gloamwood
// Gloomtree: a tall, crooked trunk with a thin, drooping canopy and hanging
// moss. Darker than the vale's trees so the forest reads as deep and cold.
const GLOOM_LEAF = ['gloomD', 'gloomL', 'gloomXL', 'fernL'];
export function gloomTree(seed = 0) {
  const W = 44, H = 58;
  const [c, ctx] = makeCanvas(W, H);
  const r = (i) => hash(seed, i, 71);
  // crooked trunk: leans one way then the other
  const lean = r(1) < 0.5 ? -1 : 1;
  for (let y = 22; y < 54; y++) {
    const t = (54 - y) / 32;
    const x = Math.round(20 + lean * Math.sin(t * 2.6) * 2.5);
    const w = y > 49 ? 7 : 5;
    px(ctx, x - (w >> 1), y, 'barkD', w, 1);
    px(ctx, x - (w >> 1) + 1, y, 'bark', w - 3, 1);
    if (y % 5 === 0) px(ctx, x - 1, y, 'barkL', 1, 2);
  }
  // roots
  px(ctx, 13, 53, 'barkD', 4, 2); px(ctx, 24, 53, 'barkD', 5, 2); px(ctx, 11, 54, 'barkD', 2, 1); px(ctx, 28, 54, 'barkD', 2, 1);
  // gnarled branches
  const branch = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) px(ctx, Math.round(x + dx * i), Math.round(y + dy * i), i % 3 ? 'bark' : 'barkD', 2, 1); };
  branch(20, 28, -1, -0.7, 8 + Math.floor(r(2) * 4));
  branch(21, 25, 1, -0.8, 8 + Math.floor(r(3) * 4));
  // a thin, ragged canopy
  const blobs = [[12 + r(4) * 3, 20, 8, 6], [31 - r(5) * 3, 18, 8, 6], [21, 13, 11, 8], [16, 8, 6, 5], [27, 7, 6, 5]];
  for (const [x, y, rx, ry] of blobs) shadedBlob(ctx, x, y, rx, ry, GLOOM_LEAF, { bias: -0.15 });
  // holes where the canopy is thin
  for (let i = 0; i < 10; i++) { const x = 8 + Math.floor(r(10 + i) * 28), y = 4 + Math.floor(r(30 + i) * 18); ctx.clearRect(x, y, 2, 1); }
  // hanging moss strands
  for (let i = 0; i < 8; i++) {
    const x = 9 + Math.floor(r(50 + i) * 26), y0 = 18 + Math.floor(r(60 + i) * 8), n = 3 + Math.floor(r(70 + i) * 7);
    for (let k = 0; k < n; k++) px(ctx, x, y0 + k, k > n - 2 ? 'gloomXL' : 'fernD');
  }
  outline(c, 'ink');
  return c;
}

export function fern(seed = 0) {
  return [-1, 0, 1].map((sway) => {
    const [c, ctx] = makeCanvas(16, 12);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55 + sway * 0.06 + (hash(seed, i) - 0.5) * 0.2;
      const n = 6 + Math.floor(hash(seed, i, 2) * 3);
      for (let k = 0; k < n; k++) {
        const x = Math.round(8 + Math.cos(a) * k), y = Math.round(11 + Math.sin(a) * k * 0.9);
        px(ctx, x, y, k > n - 3 ? 'fernL' : 'fern');
        if (k > 1 && k % 2 === 0) px(ctx, x + (i < 2 ? -1 : 1), y, 'fernD');
      }
    }
    outline(c, 'gloomD');
    return c;
  });
}

// glowing mushrooms: a faint light source in the gloom (two pulse frames)
export function glowcap(seed = 0) {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(14, 12);
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(hash(seed, i) * 9), y = 4 + Math.floor(hash(seed, i, 1) * 3);
      px(ctx, x + 1, y + 2, 'gloomXL', 1, 4);
      px(ctx, x, y, f ? 'glowL' : 'glow', 3, 2); px(ctx, x + 1, y, 'glowL');
    }
    outline(c, 'gloomD');
    return c;
  });
}

export function stump(seed = 0) {
  const [c, ctx] = makeCanvas(18, 14);
  px(ctx, 3, 4, 'barkD', 12, 8); px(ctx, 4, 4, 'bark', 9, 7);
  px(ctx, 3, 3, 'barkL', 12, 2); px(ctx, 6, 3, 'woodL', 6, 1); // cut face
  px(ctx, 1, 11, 'barkD', 3, 2); px(ctx, 14, 11, 'barkD', 3, 2);
  if (hash(seed, 1) < 0.6) { px(ctx, 11, 1, 'glow', 2, 2); px(ctx, 12, 3, 'gloomXL', 1, 1); }
  outline(c, 'ink');
  return c;
}

// a web stretched across the ground (flat decal)
export function web(seed = 0) {
  const [c, ctx] = makeCanvas(24, 20);
  const cx = 12, cy = 10;
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4 + hash(seed, a) * 0.3;
    for (let k = 0; k < 11; k++) px(ctx, Math.round(cx + Math.cos(ang) * k), Math.round(cy + Math.sin(ang) * k * 0.8), 'web');
  }
  for (let ring = 3; ring <= 9; ring += 3) for (let t = 0; t < 40; t++) {
    const ang = t / 40 * Math.PI * 2;
    if (hash(seed, ring * 50 + t) < 0.2) continue;
    px(ctx, Math.round(cx + Math.cos(ang) * ring), Math.round(cy + Math.sin(ang) * ring * 0.8), 'web');
  }
  return c;
}

// The elder tree over Witchroot Hollow: a vast hollow trunk with a dark mouth
// at its foot (steps down). Drawn over a solid footprint like the houses.
export function elderTree() {
  const W = 128, H = 128;
  const [c, ctx] = makeCanvas(W, H);
  // great trunk: furrowed bark running up it, lit on the left, flaring to the roots
  for (let y = 46; y < 124; y++) {
    const t = (y - 46) / 78, w = Math.round(34 + t * t * 38), x0 = 64 - (w >> 1);
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - x0) / w, furrow = Math.sin(x * 0.9 + Math.sin(y * 0.09) * 2.2) > 0.55;
      px(ctx, x, y, u < 0.06 || u > 0.94 ? 'barkD' : furrow ? 'barkD' : u < 0.35 ? 'barkL' : u < 0.75 ? 'bark' : 'barkD');
    }
  }
  // roots spilling out at the base
  for (const [x, dx] of [[30, -1], [40, -1.4], [88, 1.4], [98, 1]]) for (let k = 0; k < 14; k++) px(ctx, Math.round(x + dx * k), 118 + Math.round(k * 0.35), k % 3 ? 'bark' : 'barkD', 4, 3);
  // the hollow mouth
  for (let y = 98; y < 124; y++) {
    const w = Math.round(18 * Math.sqrt(Math.max(0, 1 - ((y - 124) / 26) ** 2)));
    px(ctx, 64 - w, y, 'ink', w * 2, 1);
  }
  for (let y = 100; y < 124; y += 2) px(ctx, 60, y, 'night', 8, 1);
  // the trunk forks into great limbs that taper as they climb into the crown
  const limb = (x0, y0, x1, y1, w0, w1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
      for (let k = 0; k < w; k++) px(ctx, Math.round(x - w / 2 + k), Math.round(y), k === 0 ? 'barkL' : k === w - 1 ? 'barkD' : 'bark');
    }
  };
  limb(52, 50, 26, 26, 12, 4); limb(76, 50, 102, 24, 12, 4); limb(60, 48, 48, 14, 10, 4); limb(68, 48, 82, 12, 10, 4); limb(64, 50, 64, 20, 10, 5);
  limb(30, 30, 16, 26, 4, 2); limb(98, 28, 112, 26, 4, 2); // and their side branches
  // the crown, detailed at its own size: a handful of big lobes (each a dome
  // of leaves lit on its upper left, dark where it turns under), built from
  // many small clumps that texture them, with deep shadow in the seams where
  // one lobe sits behind another; single leaves speckle it, leaf tips break
  // the scalloped outline, and through a few gaps the limbs show. The tones
  // are the Gloamwood trees' own, mostly dark, the light kept for the tops.
  const RAMP = ['gloomD', 'gloom', 'gloomL', 'gloomXL', 'fern', 'fernL'];
  const LOBES = [ // back to front: [cx, cy, rx, ry]
    [64, 11, 21, 10], [37, 14, 14, 10], [91, 14, 14, 10],
    [22, 30, 16, 11], [106, 29, 16, 11], [46, 25, 19, 12], [82, 24, 19, 12], [64, 37, 20, 8],
  ];
  const inLobe = (x, y, [cx, cy, rx, ry], k = 0.86) => ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1;
  // the clumps: scattered through each lobe; the ones near its edge make its outline bumpy
  const clumps = [];
  LOBES.forEach((L, li) => { for (let i = 0; i < 60; i++) { const a = hash(i, li, 21) * Math.PI * 2, r = Math.sqrt(hash(i, li, 22)) * 0.98; const x = L[0] + Math.cos(a) * r * L[2], y = L[1] + Math.sin(a) * r * L[3]; clumps.push([x, y, 2.6 + hash(i, li, 23) * 2.2, li]); } });
  // which lobe is frontmost at each pixel (its core, or one of its clumps), worked out once
  const LOBE = new Int8Array(W * 56).fill(-1);
  LOBES.forEach((L, k) => {
    for (let y = 0; y < 56; y++) for (let x = 0; x < W; x++) if (inLobe(x, y, L)) LOBE[y * W + x] = k;
    for (const cl of clumps) if (cl[3] === k) for (let y = Math.max(0, Math.floor(cl[1] - cl[2])); y <= Math.min(55, Math.ceil(cl[1] + cl[2])); y++) for (let x = Math.max(0, Math.floor(cl[0] - cl[2])); x <= Math.min(W - 1, Math.ceil(cl[0] + cl[2])); x++) if (Math.hypot(x - cl[0], (y - cl[1]) * 1.2) <= cl[2]) LOBE[y * W + x] = k;
  });
  const lobeAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= 56 ? -1 : LOBE[y * W + x]);
  const inCrown = (x, y) => lobeAt(x, y) >= 0;
  const gaps = [[40, 35, 4, 2], [88, 34, 4, 2], [31, 19, 2, 2], [97, 18, 2, 2]]; // where the limbs show through
  const inGap = (x, y) => gaps.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  const crownLow = (x) => { let b = -1; for (const [cx, cy, rx, ry] of LOBES) { const u = (x - cx) / rx; if (Math.abs(u) < 1) b = Math.max(b, cy + ry * Math.sqrt(1 - u * u)); } return b; };
  for (let y = 0; y < 52; y++) for (let x = 2; x < 126; x++) {
    const k = lobeAt(x, y);
    if (k < 0 || inGap(x, y)) continue;
    const [cx, cy, rx, ry] = LOBES[k], nx = (x - cx) / rx, ny = (y - cy) / ry;
    let l = 0.44 - nx * 0.18 - ny * 0.36; // the lobe's dome, lit on its upper left
    if (ny < -0.35 && nx < 0.25) l += 0.08; // its sunlit cap
    if (ny > 0.5) l -= 0.14; // turning under
    const up = lobeAt(x - 2, y - 2); // a lobe up-and-left of here sits in front: its shadow falls on this one
    if (up > k) l -= 0.3;
    else if (up >= 0 && up < k && lobeAt(x + 2, y + 2) !== k) l += 0.05;
    // the clumps that texture it: each one a little lit on its upper left, a thin seam between
    let d1 = 1e9, d2 = 1e9, near = null;
    for (const cl of clumps) { if (cl[3] !== k) continue; const d = Math.hypot(x - cl[0], (y - cl[1]) * 1.2) / cl[2]; if (d < d1) { d2 = d1; d1 = d; near = cl; } else if (d < d2) d2 = d; }
    l += -((x - near[0]) / near[2] * 0.5 + (y - near[1]) / near[2] * 0.8) * 0.13;
    if (d2 - d1 < 0.16) l -= 0.13;
    const sp = hash(x, y, 29);
    if (sp < 0.06 && l > 0.38) l += 0.22; else if (sp > 0.95) l -= 0.14; // single leaves catching the light, or in shadow
    px(ctx, x, y, RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(l * RAMP.length)))]);
  }
  // leaf tips breaking the outline: a pixel beyond the edge, lit along the top
  for (let y = 0; y < 54; y++) for (let x = 1; x < 127; x++) {
    if (inCrown(x, y) || hash(x, y, 31) > 0.24) continue;
    const by = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([ox, oy]) => inCrown(x + ox, y + oy) && !inGap(x + ox, y + oy));
    if (by) px(ctx, x, y, by[1] === 1 ? (hash(x, y, 33) < 0.35 ? 'gloomXL' : 'gloomL') : by[1] === -1 ? 'gloomD' : 'gloom');
  }
  // moss and old vines hanging from the underside of the crown
  for (let i = 0; i < 22; i++) {
    const x = 8 + Math.floor(hash(i, 5, 13) * 112), y0 = Math.floor(crownLow(x)) - 1, n = 3 + Math.floor(hash(i, 7, 13) * 9);
    if (y0 < 0 || (x > 46 && x < 82)) continue; // not across the trunk
    for (let k = 0; k < n; k++) px(ctx, x + (k > n / 2 && i % 3 === 0 ? 1 : 0), y0 + k, k > n - 2 ? 'gloomXL' : k % 3 === 2 ? 'fern' : 'fernD');
  }
  // witchroot's curse in it: a few pale violet blooms among the leaves, the sigil glow in the hollow
  for (let i = 0; i < 6; i++) px(ctx, 14 + Math.floor(hash(i, 8, 13) * 100), 8 + Math.floor(hash(i, 9, 13) * 26), 'curseL');
  px(ctx, 62, 112, 'curse', 4, 2);
  outline(c, 'ink');
  return c;
}

// ------------------------------------------------------------ Cinderreach
// Charred tree: a burnt trunk and a few crooked bare limbs, ember-lit at the
// breaks (like the fen's dead trees, in ash and basalt tones).
export function ashTree(seed = 0) {
  const [c, ctx] = makeCanvas(32, 44);
  const r = (i) => hash(seed, i, 91);
  px(ctx, 14, 20, 'basaltD', 5, 22); px(ctx, 15, 20, 'ashD', 2, 22); px(ctx, 16, 24, 'ash', 1, 10);
  px(ctx, 12, 40, 'basaltD', 2, 2); px(ctx, 19, 40, 'basaltD', 2, 2);
  const limb = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) px(ctx, Math.round(x + dx * i), Math.round(y + dy * i), i % 3 ? 'ashD' : 'basaltD', 2, 1); px(ctx, Math.round(x + dx * n), Math.round(y + dy * n), 'lavaL'); };
  limb(16, 24, -1, -0.8, 8 + Math.floor(r(1) * 3));
  limb(17, 21, 1, -1, 7 + Math.floor(r(2) * 3));
  limb(16, 14, -0.5, -1, 5);
  limb(16, 12, 0.6, -0.9, 6);
  px(ctx, 15, 8, 'basaltD', 2, 14);
  for (let i = 0; i < 3; i++) px(ctx, 14 + Math.floor(r(10 + i) * 4), 26 + Math.floor(r(20 + i) * 12), 'lavaD'); // smouldering cracks
  outline(c, 'ink');
  return c;
}

// Obsidian: a glossy black rock with a sharp highlight.
export function obsidian(seed = 0, big = false) {
  const w = big ? 20 : 14, h = big ? 15 : 11;
  const [c, ctx] = makeCanvas(w + 2, h + 2);
  shadedBlob(ctx, w / 2 + 1, h / 2 + 1, w / 2, h / 2, ['basaltD', 'basalt', 'basaltL', 'mist']);
  const cx = Math.floor(w * (0.3 + hash(seed, 1) * 0.3));
  for (let i = 0; i < 4; i++) px(ctx, cx + i, 3 + i, 'purpL'); // a glassy facet catching the light
  px(ctx, 2, h - 1, 'ashD', w - 3, 1);
  outline(c, 'ink');
  return c;
}

// Brimstone vent: a cracked mound crusted yellow, glowing in its throat
// (smoke puffs rise from it in play). Two glow frames.
export function vent(seed = 0) {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(18, 14);
    shadedBlob(ctx, 9, 9, 8, 5, ['ashD', 'ash', 'ashL', 'ashXL']);
    for (let i = 0; i < 5; i++) px(ctx, 3 + Math.floor(hash(seed, i) * 12), 7 + Math.floor(hash(seed, i, 2) * 4), 'brim');
    px(ctx, 7, 5, 'ink', 4, 2); px(ctx, 8, 5, f ? 'lavaXL' : 'lavaL', 2, 1);
    outline(c, 'ink');
    return c;
  });
}

// Emberbloom: a hardy badlands plant whose flowers glow like coals.
export function emberbloom(seed = 0) {
  const [c, ctx] = makeCanvas(14, 12);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(hash(seed, i) * 9), h = 4 + Math.floor(hash(seed, i, 1) * 5);
    px(ctx, x, 11 - h, 'ashD', 1, h);
    px(ctx, x - 1, 11 - h - 1, 'lava', 3, 2); px(ctx, x, 11 - h - 1, 'lavaXL');
  }
  outline(c, 'basaltD');
  return c;
}

// Cinders: glowing embers scattered on the ground near the lava (flat decal).
export function cinders(seed = 0) {
  const [c, ctx] = makeCanvas(16, 10);
  for (let i = 0; i < 7; i++) px(ctx, Math.floor(hash(seed, i) * 15), Math.floor(hash(seed, i, 1) * 9), i % 3 ? 'lavaD' : 'lavaL');
  return c;
}

// A canvas tent with a dark doorway (Emberwatch, the miners' camp): ridge
// pole, sagging canvas lit on its left slope, guy ropes.
export function tent(seed = 0) {
  const [c, ctx] = makeCanvas(32, 26);
  const cols = [['woodD', 'dirtD', 'dirt', 'dirtL'], ['redD', 'redD', 'red', 'redL'], ['slate', 'stone', 'mist', 'bone']][seed % 3];
  for (let y = 0; y < 18; y++) {
    const half = Math.round(2 + y * 0.8);
    for (let x = 16 - half; x <= 15 + half; x++) px(ctx, x, 5 + y, x < 16 ? (y % 6 === 5 ? cols[1] : cols[3]) : (y % 6 === 5 ? cols[0] : cols[2]));
  }
  for (let y = 9; y < 23; y++) { const w = Math.round((y - 9) * 0.45); px(ctx, 16 - w, y, 'ink', w * 2, 1); } // doorway
  px(ctx, 15, 2, 'woodD', 2, 4); // ridge pole
  for (let k = 0; k < 6; k++) { px(ctx, 2 + k, 22 - k * 2, 'bone'); px(ctx, 29 - k, 22 - k * 2, 'bone'); } // guy ropes
  outline(c, 'ink');
  return c;
}

// The Forge of Ash's gate: a dwarven archway cut into the mountain, its
// great doors standing open on a red glow (drawn over the cliff face).
export function forgeGate() {
  const [c, ctx] = makeCanvas(72, 52);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 72; x++) {
    const inArch = Math.hypot((x - 36) / 22, Math.max(0, 20 - y) / 18) < 1 && y > 6;
    const ring = Math.hypot((x - 36) / 30, Math.max(0, 22 - y) / 24) < 1 && y > 2;
    if (inArch) px(ctx, x, y, y > 30 ? 'lavaD' : y > 22 ? 'redD' : 'ink'); // the glowing passage
    else if (ring) { // carved stone voussoirs
      const blk = Math.floor(Math.atan2(22 - y, x - 36) * 6) % 2;
      px(ctx, x, y, blk ? 'basaltL' : 'basalt');
    }
  }
  for (const sx of [12, 54]) { px(ctx, sx, 20, 'steelD', 6, 30); px(ctx, sx + 1, 20, 'gold', 4, 30); for (let y = 24; y < 50; y += 6) px(ctx, sx + 1, y, 'goldL', 4, 1); } // brass door leaves, swung open
  px(ctx, 32, 3, 'gold', 8, 5); px(ctx, 34, 4, 'lavaXL', 4, 3); // a hearth rune on the keystone
  outline(c, 'ink');
  return c;
}

// The Colosseum (Highmeadow), built the way a walled town is: a ring of
// sandstone on a shallow oval, drawn column by column. The far half shows its
// inner face - two tiers of benches under a colonnade, with awning masts on
// the rim - and the near half its outer face: two arcades, a cornice, a lit
// walk, and the gate under a raised portcullis in a taller block. Two layers,
// so the crowd (real townsfolk sprites, Game.buildColosseum) sits between
// them: `back` (stands and sand) and `front` (the near wall and the gate),
// both 176 x 86 with their feet on the bottom row. `seats` lists where each
// spectator's head-and-shoulders sit, from the canvas's top-left: x, the
// bench line y, the tier (0 back, 1 front) and which way they face.
export const COLOSSEUM = { W: 176, H: 86, RX: 82, RY: 9, WH: 26, WB: 38 };
const SANDSTONE = ['dirtD', 'dirt', 'dirtL', 'sand', 'bone'];
const tone = (l, x, y) => SANDSTONE[Math.max(0, Math.min(4, Math.floor(l * 5 + (bayer(x, y) - 0.5) * 0.5)))];
// big irregular blocks: 4px courses, each row's blocks a different width and offset
function sandBlock(x, y, top, seed) {
  const row = Math.floor((y - top) / 4), off = Math.floor(hash(row, 1, seed) * 9), bw = 7 + Math.floor(hash(row, 2, seed) * 4);
  return { joint: (x + off) % bw === 0 || (y - top) % 4 === 3, tone: (hash(Math.floor((x + off) / bw), row, seed + 5) - 0.5) * 0.22 };
}
export function colosseumArt() {
  const { W, H, RX, RY, WH, WB } = COLOSSEUM, CX = W / 2, ECY = H - 2 - RY;
  const at = (deg) => { const a = (deg * Math.PI) / 180; return [CX + Math.cos(a) * RX, ECY + Math.sin(a) * RY]; };
  const run = (ctx, a0, a1, col) => { let last = null; for (let a = a0; a <= a1; a += 0.2) { const [x, y] = at(a), ix = Math.round(x); if (ix === last) continue; last = ix; col(ix, Math.round(y), a); } };
  const [back, bctx] = makeCanvas(W, H), [front, fctx] = makeCanvas(W, H);
  // the far half: the colonnade, then benches (a 2px lit seat, an 8px riser in shadow)
  run(bctx, 180, 360, (x, gy, a) => {
    const top = gy - WB, light = 0.5 - (x - CX) / RX * 0.12;
    for (let y = top; y <= gy; y++) {
      const r = y - top;
      if (r < 7) { const open = r > 1 && r < 6 && Math.floor((x + 1) / 3) % 2 === 0; px(bctx, x, y, open ? 'night' : tone(r === 0 ? light + 0.25 : light, x, y)); continue; }
      const k = (r - 7) % 10;
      px(bctx, x, y, tone(k < 2 ? light + 0.22 - k * 0.1 : light - 0.2 - (k > 7 ? 0.08 : 0), x, y));
    }
    if (Math.round(a) % 30 === 0) { px(bctx, x, top - 7, 'woodD', 1, 7); px(bctx, x + 1, top - 6, 'red', 3, 3); } // awning masts
  });
  for (let y = Math.floor(ECY - RY); y <= ECY + RY; y++) for (let x = Math.floor(CX - RX); x <= CX + RX; x++) { // the sand, where any shows
    if (((x - CX) / RX) ** 2 + ((y - ECY) / RY) ** 2 <= 0.9) px(bctx, x, y, hash(x, y, 4) < 0.15 ? 'dirtL' : 'sand');
  }
  outline(back, 'ink');
  // the near half: the outer face with two arcades, cornices and the walk
  const step = 7;
  const inArch = (a, r0, r1, gy, y) => {
    const u = (((a % step) + step) % step) / step - 0.5, half = 0.24;
    if (Math.abs(u) > half) return false;
    return y >= gy - r1 + Math.round((1 - Math.sqrt(1 - (u / half) ** 2)) * 3) && y <= gy - r0;
  };
  run(fctx, 0, 180, (x, gy, a) => {
    const top = gy - WH, light = 0.62 - (x - CX) / RX * 0.16 - Math.abs(Math.cos((a * Math.PI) / 180)) * 0.12, mid = Math.round(WH * 0.5);
    for (let y = top; y <= gy; y++) {
      const r = gy - y, b = sandBlock(x, y, top, 3);
      let l = light + b.tone - (b.joint ? 0.28 : 0) - (r < 2 ? 0.15 : 0);
      if (y === top) l = light + 0.35; else if (y === top + 1 || r === mid) l = light + 0.12; else if (y === top + 2 || r === mid - 1) l = light - 0.3;
      if (inArch(a + step * 0.45, 2, Math.round(WH * 0.4), gy, y)) { px(fctx, x, y, y - (gy - Math.round(WH * 0.4)) < 2 ? 'night' : 'ink'); continue; }
      if (inArch(a, Math.round(WH * 0.58), Math.round(WH * 0.84), gy, y)) { px(fctx, x, y, 'night'); continue; }
      px(fctx, x, y, tone(l, x, y));
    }
  });
  // the gate: a taller block with a low pediment, a banner and the raised portcullis
  const gx = Math.round(CX), gy = H - 2, gw = 26, gTop = gy - WH - 6;
  for (let y = gTop; y <= gy; y++) for (let x = gx - gw / 2; x < gx + gw / 2; x++) {
    const b = sandBlock(x, y, gTop, 8), f = (x - (gx - gw / 2)) / gw;
    let l = 0.66 - f * 0.22 + b.tone - (b.joint ? 0.28 : 0);
    if (y === gTop) l = 0.95; else if (y === gTop + 1) l = 0.75; else if (y === gTop + 2) l = 0.3;
    px(fctx, x, y, tone(l, x, y));
  }
  for (let i = 0; i < 6; i++) px(fctx, gx - 12 + i * 2, gTop - 1 - i, 'sand', 24 - i * 4, 1);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 18; x++) { const dx = x + 0.5 - 9, dy = Math.max(0, 9 - y - 0.5); if (dx * dx + dy * dy <= 81) px(fctx, gx - 9 + x, gy - 22 + y, y < 1 ? 'dirtD' : 'ink'); }
  for (let x = 0; x < 18; x += 3) px(fctx, gx - 9 + x, gy - 19, 'steelD', 1, 4);
  px(fctx, gx - 8, gy - 16, 'steel', 16, 1);
  px(fctx, gx - 3, gTop + 5, 'red', 6, 9); px(fctx, gx - 3, gTop + 5, 'redL', 6, 1); px(fctx, gx - 1, gTop + 8, 'gold', 2, 2);
  for (const bx of [gx - 17, gx + 13]) { px(fctx, bx, gy - 2, 'steelD', 4, 2); px(fctx, bx + 1, gy, 'steelD', 2, 1); px(fctx, bx + 1, gy - 5, 'fire', 2, 3); px(fctx, bx + 1, gy - 6, 'fireL', 2, 1); } // braziers
  outline(front, 'ink');
  // the seats: two tiers along the far half, the ends turned toward the middle
  const seats = [];
  for (const tier of [0, 1]) for (let a = 196 + tier * 4.75; a <= 344; a += 9.5) {
    const [x, gy] = at(a);
    seats.push({ x: Math.round(x), y: Math.round(gy) - WB + 18 + tier * 10, tier, face: a < 222 ? 'right' : a > 318 ? 'left' : 'down' });
  }
  return { back, front, seats };
}

// ================================================================ Frosthelm
// The Rimeglass Spire: the old astronomers' tower of pale glass on the
// Highfold - a tapering faceted shaft ringed with frosted bands, slit
// windows, an arched door at its foot and a cupola holding the star-mirror.
export function rimeSpire() {
  const W = 60, H = 116;
  const [c, ctx] = makeCanvas(W, H);
  const cx = 30;
  for (let y = 22; y < 108; y++) {
    const half = Math.round(8 + (y - 22) * 0.07);
    for (let x = cx - half; x <= cx + half; x++) {
      const f = (x - (cx - half)) / (half * 2); // 0 left (lit) .. 1 right
      let col = f < 0.18 ? 'iceXL' : f < 0.5 ? 'iceL' : f < 0.8 ? 'ice' : 'iceD';
      if ((y - 22) % 16 === 0 || (y - 22) % 16 === 1) col = f < 0.5 ? 'frostL' : 'frost'; // frosted bands
      if (Math.abs(x - cx) === Math.round(half * 0.45) && (y - 22) % 16 > 1) col = f < 0.5 ? 'iceL' : 'iceD'; // facet edges
      px(ctx, x, y, col);
    }
  }
  for (const wy of [34, 50, 66, 82]) { px(ctx, cx - 1, wy, 'iceD', 3, 7); px(ctx, cx, wy + 1, 'ink', 1, 5); } // slit windows
  // the foot: a broad plinth and the arched door
  for (let y = 106; y < 114; y++) px(ctx, cx - 16 + (y - 106 > 3 ? 0 : 1), y, y < 108 ? 'frostL' : 'frost', 32 - (y - 106 > 3 ? 0 : 2), 1);
  for (let y = 96; y < 112; y++) { const w = y < 99 ? 2 + (y - 96) : 5; px(ctx, cx - w, y, y < 99 ? 'frostD' : 'ink', w * 2 + 1, 1); }
  // the cupola and the star-mirror
  for (let y = 10; y < 22; y++) { const half = Math.round(4 + (y - 10) * 0.6); px(ctx, cx - half, y, 'frostL', half, 1); px(ctx, cx, y, 'frost', half + 1, 1); }
  for (let y = 12; y < 20; y++) { const half = Math.round(Math.sqrt(16 - (y - 16) * (y - 16))); px(ctx, cx - half, y, y < 15 ? 'white' : 'goldL', half * 2 + 1, 1); }
  px(ctx, cx, 2, 'iceL', 1, 8); px(ctx, cx - 1, 6, 'iceL', 3, 1); px(ctx, cx, 1, 'white');
  outline(c, 'ink');
  return c;
}
// Isolde's floating ice platform (phase 2): a ragged slab of blue ice.
export function icePlatform() {
  const [c, ctx] = makeCanvas(40, 16);
  shadedBlob(ctx, 20, 7, 18, 5, ['iceD', 'ice', 'iceL', 'iceXL']);
  for (let i = 0; i < 6; i++) px(ctx, 6 + i * 5, 11 + (i % 2), 'iceL', 1, 3 + (i % 3)); // icicles under it
  outline(c, 'ink');
  return c;
}
// A wind vent (the Gale Cloak catches it): a grate with swirling air rising.
export function windVent() {
  return [0, 1, 2].map((f) => {
    const [c, ctx] = makeCanvas(22, 16);
    shadedBlob(ctx, 11, 10, 9, 4.5, ['frostD', 'frost', 'frostL', 'snowL']);
    for (let i = -6; i <= 6; i += 3) px(ctx, 11 + i, 9, 'ink', 1, 3);
    for (let k = 0; k < 3; k++) { const y = 6 - ((k * 3 + f * 2) % 7); px(ctx, 6 + k * 4 + (f % 2), y, 'snowXL', 2, 1); px(ctx, 7 + k * 4, y - 1, 'white'); }
    return c;
  });
}

// ================================================================ the Basin
// A cluster of hex crystal: violet shards that grew where the curse pooled.
export function hexCrystal(seed = 0, big = false) {
  const w = big ? 22 : 16, h = big ? 22 : 16;
  const [c, ctx] = makeCanvas(w, h);
  const n = big ? 4 : 3;
  for (let k = 0; k < n; k++) {
    const cx = Math.round(w / 2 + (k - (n - 1) / 2) * (big ? 4 : 3.5) + (hash(seed, k, 261) - 0.5) * 2), ch = Math.round((big ? 12 : 8) + hash(seed, k + 5, 262) * (big ? 8 : 6) - Math.abs(k - (n - 1) / 2) * 3);
    for (let y = 0; y < ch; y++) { const half = y < 2 ? 0 : y < 4 ? 1 : 2; for (let x = cx - half; x <= cx + half; x++) px(ctx, x, h - 2 - ch + y, x < cx ? 'curseL' : x === cx ? 'curse' : 'purp'); }
  }
  px(ctx, 2, h - 2, 'hexD', w - 4, 1);
  outline(c, 'ink');
  return c;
}
// Old bones in the dead earth.
export function bones(seed = 0) {
  const [c, ctx] = makeCanvas(14, 8);
  px(ctx, 2, 4, 'bone', 7, 1); px(ctx, 1, 3, 'bone'); px(ctx, 1, 5, 'bone'); px(ctx, 9, 3, 'bone'); px(ctx, 9, 5, 'bone');
  if (hash(seed, 1, 263) < 0.5) { px(ctx, 10, 1, 'bone', 3, 3); px(ctx, 11, 2, 'ink'); } // a skull
  return c;
}
// The Ninth Tower: Malgrim's black spire - a tall tapering shaft of dark
// stone in tiers, violet light in its windows and seams, a crown of horns
// at the top round a burning hex, and a great door at its foot.
export function ninthTower() {
  const W = 104, H = 236;
  const [c, ctx] = makeCanvas(W, H);
  const cx = 52;
  for (let y = 30; y < 226; y++) {
    const half = Math.round(10 + (y - 30) * 0.13);
    for (let x = cx - half; x <= cx + half; x++) {
      const f = (x - (cx - half)) / (half * 2);
      let col = f < 0.15 ? 'slate' : f < 0.55 ? 'night' : f < 0.85 ? 'hexD' : 'ink';
      if ((y - 30) % 28 < 2) col = f < 0.5 ? 'stone' : 'slate'; // tier ledges
      if (Math.abs(x - cx) === Math.round(half * 0.4) && hash(x, y, 264) < 0.35) col = 'purpD'; // seams
      px(ctx, x, y, col);
    }
  }
  for (let t = 0; t < 6; t++) { const wy = 44 + t * 28; px(ctx, cx - 2, wy, 'ink', 5, 9); px(ctx, cx - 1, wy + 1, t % 2 ? 'curse' : 'curseL', 3, 7); } // lit windows
  for (let t = 0; t < 5; t++) for (const s of [-1, 1]) { const wy = 58 + t * 28, half = Math.round(10 + (wy - 30) * 0.13); px(ctx, cx + s * Math.round(half * 0.7) - 1, wy, 'curse', 2, 4); }
  // the horned crown and the hex burning in it
  for (let i = 0; i < 5; i++) { const x0 = cx - 16 + i * 8; for (let y = 0; y < 14 - Math.abs(i - 2) * 3; y++) px(ctx, x0 + Math.round(y * (i - 2) * 0.12), 30 - y, i % 2 ? 'night' : 'slate', 2, 1); }
  for (let y = 4; y < 22; y++) { const half = Math.round(Math.sqrt(Math.max(0, 64 - (y - 13) * (y - 13)))); px(ctx, cx - half, y, y < 10 ? 'curseL' : 'curse', half * 2 + 1, 1); }
  px(ctx, cx - 2, 11, 'white', 5, 4);
  // the base and the great door
  for (let y = 222; y < 234; y++) px(ctx, cx - 40 + (y - 222), y, y < 226 ? 'slate' : 'night', 80 - (y - 222) * 2, 1);
  for (let y = 196; y < 232; y++) { const w = y < 204 ? 2 + (y - 196) : 10; px(ctx, cx - w, y, y < 204 ? 'purpD' : 'ink', w * 2 + 1, 1); }
  px(ctx, cx - 1, 210, 'curse', 3, 3);
  outline(c, 'ink');
  return c;
}

// What's left of the Ninth Tower: a broken black stump in a ring of rubble.
export function towerRuin() {
  const [c, ctx] = makeCanvas(96, 70);
  for (let y = 18; y < 62; y++) { const half = Math.round(14 + (y - 18) * 0.25), top = 18 + Math.round(Math.abs(Math.sin(y)) * 0); for (let x = 48 - half; x <= 48 + half; x++) { if (y < 18 + Math.round(6 + Math.sin(x * 0.7) * 5)) continue; const f = (x - (48 - half)) / (half * 2); px(ctx, x, y, f < 0.2 ? 'slate' : f < 0.6 ? 'night' : 'hexD'); } void top; }
  for (let i = 0; i < 14; i++) { const x = 6 + ((i * 37) % 84), y = 56 + ((i * 13) % 10); shadedBlob(ctx, x, y, 3 + (i % 3), 2.5, ['ink', 'night', 'slate', 'stone']); }
  px(ctx, 40, 40, 'purpD', 3, 3); // a dead rune
  outline(c, 'ink');
  return c;
}

// Frost Prison: a translucent block of ice that encases whoever is inside.
export function iceBlock() {
  const [c, ctx] = makeCanvas(22, 26);
  for (let y = 2; y < 25; y++) for (let x = 2; x < 20; x++) {
    const edge = x === 2 || x === 19 || y === 2 || y === 24;
    const n = hash(x, y, 141);
    px(ctx, x, y, edge ? 'iceL' : x < 6 || y < 6 ? 'iceXL' : n < 0.1 ? 'white' : 'ice');
  }
  for (let i = 0; i < 6; i++) px(ctx, 5 + i * 2, 18 - i * 2, 'white'); // a crack of light
  outline(c, 'ink');
  return c;
}
// Glacial Wall: one tile of a jagged ice wall (two tiles tall).
export function iceWall() {
  const [c, ctx] = makeCanvas(16, 26);
  for (let x = 0; x < 16; x++) {
    const top = 2 + Math.round(Math.abs(Math.sin(x * 1.3)) * 4);
    for (let y = top; y < 26; y++) px(ctx, x, y, y < top + 2 ? 'snowXL' : x < 4 ? 'iceXL' : x < 10 ? 'iceL' : 'ice');
  }
  px(ctx, 0, 24, 'iceD', 16, 2);
  outline(c, 'ink');
  return c;
}

// Claw marks up a cliff face (Climbing Claws): paired scratches gouged into
// the ice and rock, with frosted holds, reaching two tiles up the face.
export function clawMarks() {
  const [c, ctx] = makeCanvas(16, 34);
  for (let i = 0; i < 6; i++) {
    const y = 2 + i * 5, x = 4 + (i % 2) * 5;
    for (let k = 0; k < 3; k++) { px(ctx, x + k * 2, y + k, 'ink', 1, 3); px(ctx, x + k * 2 + 1, y + k, 'iceXL', 1, 2); }
    px(ctx, x - 1, y + 4, 'snowXL', 4, 1); // a frosted hold
  }
  return c;
}

// Snow pine: a tall dark fir in stacked tiers, each tier's top loaded with
// snow (lit on the left), on a short trunk.
const PINE = ['pineD', 'pine', 'pineL', 'pineL'];
export function snowPine(seed = 0) {
  const [c, ctx] = makeCanvas(34, 54);
  const r = (i) => hash(seed, i, 131);
  px(ctx, 15, 44, 'woodD', 4, 8); px(ctx, 16, 44, 'wood', 1, 8);
  const tiers = 4 + (r(1) < 0.4 ? 1 : 0);
  for (let t = 0; t < tiers; t++) {
    const top = 4 + t * (38 / tiers), h = 14, w0 = 3 + t * 2.4 + r(2 + t) * 1.5;
    for (let y = 0; y < h; y++) {
      const half = Math.round(1 + (w0 + 1) * (y / h)), yy = Math.round(top + y);
      for (let x = 17 - half; x <= 16 + half; x++) {
        const lit = x < 17 - half / 3;
        px(ctx, x, yy, y < 2 ? 'pineD' : lit ? 'pine' : 'pineD');
      }
      // the snow lying on the tier's upper slope
      if (y > 1 && y < 6) { const sw = Math.round(half * (0.7 - y * 0.08)); px(ctx, 17 - half, yy, y < 4 ? 'snowL' : 'snow', sw + 1, 1); px(ctx, 17 + half - Math.round(sw / 2), yy, 'snowD', Math.max(1, Math.round(sw / 2)), 1); }
    }
    for (let i = 0; i < 3; i++) px(ctx, 17 - Math.round(w0) + Math.floor(r(20 + t * 3 + i) * w0 * 2), Math.round(top + 9 + r(40 + t + i) * 4), 'snowXL'); // clumps caught in the branches
  }
  px(ctx, 16, 2, 'snowXL', 2, 2); px(ctx, 16, 1, 'snowL');
  outline(c, 'ink');
  return c;
}

// Rimeglass: a cluster of pale ice crystals growing out of the snow, glowing
// faintly from inside.
export function rimeglass(seed = 0, big = false) {
  const w = big ? 22 : 16, h = big ? 22 : 16;
  const [c, ctx] = makeCanvas(w, h);
  const r = (i) => hash(seed, i, 133);
  const n = big ? 4 : 3;
  for (let k = 0; k < n; k++) {
    const cx = Math.round(w / 2 + (k - (n - 1) / 2) * (big ? 4 : 3.5) + (r(k) - 0.5) * 2), ch = Math.round((big ? 12 : 8) + r(k + 5) * (big ? 8 : 6) - Math.abs(k - (n - 1) / 2) * 3);
    for (let y = 0; y < ch; y++) {
      const half = y < 2 ? 0 : y < 4 ? 1 : 2;
      for (let x = cx - half; x <= cx + half; x++) px(ctx, x, h - 2 - ch + y, x < cx ? 'iceXL' : x === cx ? 'iceL' : 'ice');
    }
    px(ctx, cx - 1, h - ch + 2, 'snowXL');
  }
  px(ctx, 2, h - 2, 'snowL', w - 4, 1); px(ctx, 3, h - 1, 'snowD', w - 6, 1);
  outline(c, 'ink');
  return c;
}

// A low wind-carved drift: a soft hump of snow with a blue lee side.
export function snowDrift(seed = 0) {
  const [c, ctx] = makeCanvas(20, 9);
  shadedBlob(ctx, 10, 6, 8 + hash(seed, 1, 135) * 2, 3, ['snowD', 'snow', 'snowL', 'snowXL']);
  return c;
}

// Dead grass poking out of the snow.
export function snowTuft(seed = 0) {
  const [c, ctx] = makeCanvas(10, 8);
  for (let i = 0; i < 4; i++) { const x = 2 + Math.floor(hash(seed, i, 137) * 6), h = 2 + Math.floor(hash(seed, i, 138) * 4); px(ctx, x, 7 - h, i % 2 ? 'reedD' : 'reed', 1, h); }
  px(ctx, 1, 7, 'snowL', 8, 1);
  return c;
}

// A snow-capped boulder.
export function snowRock(seed = 0, big = false) {
  const w = big ? 20 : 14, h = big ? 14 : 10;
  const [c, ctx] = makeCanvas(w + 2, h + 2);
  shadedBlob(ctx, w / 2 + 1, h / 2 + 2, w / 2, h / 2, ['frostD', 'frost', 'frostL', 'snowL']);
  for (let x = 2; x < w; x++) { const d = Math.round(1 + Math.sin(x * 0.9 + seed) * 1.2 + (h / 3)); px(ctx, x, 2, 'snowXL', 1, Math.max(1, d - Math.abs(x - w / 2) / 2.5)); }
  outline(c, 'ink');
  return c;
}

// A hide tent for the refugee camp: furs over a frame, snow on the ridge.
export function furTent(seed = 0) {
  const [c, ctx] = makeCanvas(32, 26);
  const cols = [['woodD', 'leatherD', 'leather', 'dirtD'], ['leatherD', 'woodD', 'wood', 'woodL'], ['slate', 'stone', 'mist', 'bone']][seed % 3];
  for (let y = 0; y < 18; y++) {
    const half = Math.round(2 + y * 0.8);
    for (let x = 16 - half; x <= 15 + half; x++) px(ctx, x, 5 + y, x < 16 ? (y % 5 === 4 ? cols[1] : cols[3]) : (y % 5 === 4 ? cols[0] : cols[2]));
    if (y < 5) { px(ctx, 16 - half, 5 + y, 'snowL', half, 1); px(ctx, 16, 5 + y, 'snow', Math.max(1, half - 1), 1); }
  }
  for (let y = 10; y < 23; y++) { const w = Math.round((y - 10) * 0.45); px(ctx, 16 - w, y, 'ink', w * 2, 1); }
  px(ctx, 13, 1, 'woodD', 1, 5); px(ctx, 18, 1, 'woodD', 1, 5); // crossed poles
  outline(c, 'ink');
  return c;
}

// Brightwater's watermill on the lake shore, in the cottages' 3/4 view: a
// fieldstone ground floor, a timber-framed loft with a sack hoist under the
// gable, a steep slate roof (blue-grey, so it doesn't read as the red shop or
// the thatched tavern) with a little dormer and a weathervane. The wheel is
// its own sprite on the east wall (see millWheel). Footprint 3 tiles wide.
export function mill() {
  const W = 56, H = 78;
  const [c, ctx] = makeCanvas(W, H);
  const L = 3, R = W - 4, roofTop = 6, ridge = 16, eave = 44, loftBot = 56, wallBot = H - 3;
  // --- stone ground floor: rough coursed fieldstone, mortar lines, a dark plinth
  for (let y = loftBot; y <= wallBot; y++) for (let x = L + 1; x <= R - 1; x++) {
    const row = Math.floor((y - loftBot) / 4), off = (row % 2) * 4;
    const joint = (y - loftBot) % 4 === 3 || (x + off) % 8 === 0;
    const h = hash(Math.floor((x + off) / 8), row, 77);
    px(ctx, x, y, joint ? 'slate' : h < 0.3 ? 'mist' : h < 0.8 ? 'stone' : 'bone');
  }
  for (let x = L + 1; x <= R - 1; x++) px(ctx, x, wallBot, 'slate');
  for (let y = loftBot; y < wallBot; y++) { px(ctx, R - 1, y, 'slate'); px(ctx, R - 2, y, 'stone'); } // shaded east corner
  // --- timber-framed loft: plaster panels between dark beams, with a cross brace
  for (let y = eave - 1; y < loftBot; y++) for (let x = L + 2; x <= R - 2; x++) {
    const beam = x === L + 2 || x === R - 2 || x === 18 || x === 37 || y === loftBot - 1;
    px(ctx, x, y, beam ? 'woodD' : (x * 5 + y * 3) % 19 === 0 ? 'mist' : 'bone');
  }
  for (let i = 0; i < 10; i++) { px(ctx, L + 4 + i, eave + 1 + i, 'woodD'); px(ctx, R - 4 - i, eave + 1 + i, 'woodD'); } // braces in the end panels
  for (let x = L + 2; x <= R - 2; x++) { px(ctx, x, eave - 1, 'stone'); px(ctx, x, eave, 'mist'); } // shadow under the eave
  px(ctx, L + 2, loftBot, 'woodD', R - L - 3, 1); // the jetty beam over the stone
  // loft hatch with the sack hoist: a beam out under the eave, a rope and a sack
  px(ctx, 22, eave + 2, 'woodD', 12, 10); px(ctx, 23, eave + 3, 'wood', 10, 8); px(ctx, 27, eave + 3, 'woodD', 1, 8);
  px(ctx, 26, eave - 3, 'woodD', 4, 2); px(ctx, 28, eave - 1, 'leather', 1, 7);
  px(ctx, 26, eave + 6, 'sand', 5, 6); px(ctx, 27, eave + 6, 'bone', 3, 1); px(ctx, 26, eave + 11, 'dirtL', 5, 1); // the hanging sack
  // --- the door (arched, plank) and two small deep windows in the stone
  const dx = 23;
  px(ctx, dx - 1, wallBot - 18, 'slate', 12, 18); px(ctx, dx, wallBot - 19, 'slate', 10, 1);
  px(ctx, dx, wallBot - 17, 'wood', 10, 17); px(ctx, dx + 1, wallBot - 18, 'wood', 8, 1);
  for (const x of [dx + 3, dx + 6]) px(ctx, x, wallBot - 17, 'woodD', 1, 17);
  px(ctx, dx, wallBot - 12, 'steelD', 10, 1); px(ctx, dx, wallBot - 4, 'steelD', 10, 1); // iron straps
  px(ctx, dx + 8, wallBot - 8, 'gold', 1, 2);
  px(ctx, dx - 2, wallBot + 1, 'stone', 14, 2); px(ctx, dx - 2, wallBot + 1, 'bone', 14, 1);
  for (const wx of [L + 6, R - 13]) {
    px(ctx, wx, loftBot + 5, 'slate', 8, 8); px(ctx, wx + 1, loftBot + 6, 'fire', 6, 6); px(ctx, wx + 1, loftBot + 6, 'fireL', 3, 3);
    px(ctx, wx + 4, loftBot + 6, 'woodD', 1, 6); px(ctx, wx, loftBot + 13, 'bone', 8, 1);
  }
  // flour sacks and a spare millstone by the door
  for (const [sx, sy] of [[L + 2, wallBot - 6], [L + 7, wallBot - 5]]) { px(ctx, sx, sy, 'sand', 5, 6); px(ctx, sx + 1, sy - 1, 'bone', 3, 1); px(ctx, sx + 4, sy + 1, 'dirtL', 1, 5); }
  for (let a = 0; a < 28; a++) { const t = (a / 28) * Math.PI * 2; px(ctx, Math.round(R - 7 + Math.cos(t) * 4.5), Math.round(wallBot - 5 + Math.sin(t) * 4.5), a % 4 ? 'stone' : 'mist'); }
  px(ctx, R - 8, wallBot - 6, 'slate', 2, 2);
  // --- roof: hipped slate like the cottages, narrowing to the ridge, courses growing toward the eave
  const rTop = 6, rRidge = 11, rEave = eave - 1;
  for (let y = rTop; y < rRidge; y++) { const ins = 10 + (rRidge - y); for (let x = L + ins; x <= R - ins; x++) px(ctx, x, y, y === rTop ? 'blueD' : 'steelD'); }
  for (let y = rRidge; y <= rEave; y++) {
    const t = (y - rRidge) / (rEave - rRidge), ins = Math.round((1 - t) * 9) - 2;
    const row = Math.floor(Math.pow(t, 0.75) * 7), rowStart = Math.ceil(rRidge + Math.pow(row / 7, 1 / 0.75) * (rEave - rRidge)), off = (row % 2) * 3;
    for (let x = L + ins; x <= R - ins; x++) {
      let col = y === rowStart ? 'blueD' : (x + off) % (5 + Math.round(t * 2)) === 0 ? 'blueD' : t < 0.3 ? 'steelL' : t < 0.7 ? 'steel' : 'steelD';
      if (y > rRidge + 16 && hash(x, y, 79) < 0.02) col = 'mossD'; // a little moss low on the slates
      if (x <= L + ins + 1) col = 'steelL';
      if (x >= R - ins - 1) col = 'blueD';
      if (y === rRidge) col = 'bone';
      px(ctx, x, y, col);
    }
  }
  for (let y = rRidge; y <= rEave; y++) { const t = (y - rRidge) / (rEave - rRidge), ins = Math.round((1 - t) * 9) - 2; px(ctx, L + ins + 2, y, 'steelL'); px(ctx, R - ins - 2, y, 'blueD'); }
  px(ctx, L - 2, rEave + 1, 'woodD', R - L + 5, 1); // fascia along the overhang
  // dormer on the front slope
  px(ctx, 13, rRidge + 9, 'blueD', 10, 3); px(ctx, 14, rRidge + 12, 'woodD', 8, 7); px(ctx, 15, rRidge + 13, 'fire', 6, 5); px(ctx, 15, rRidge + 13, 'fireL', 2, 2); px(ctx, 18, rRidge + 13, 'woodD', 1, 5);
  px(ctx, 12, rRidge + 8, 'steelL', 12, 1);
  // chimney standing up through the roof, and the weathervane (a little iron rooster) on the ridge
  px(ctx, R - 14, 1, 'slate', 6, 14); px(ctx, R - 14, 1, 'stone', 6, 2); px(ctx, R - 13, 3, 'night', 4, 1);
  px(ctx, 22, 3, 'ink', 1, rRidge - 3); px(ctx, 19, 3, 'ink', 7, 1); px(ctx, 23, 1, 'ink', 3, 2); px(ctx, 19, 2, 'ink', 1, 1); px(ctx, 25, 0, 'ink', 1, 1);
  outline(c, 'ink');
  return c;
}

// The mill's waterwheel, seen face-on on the east wall: a rim of planks, eight
// spokes, paddles round the edge, an iron hub and the lake foaming over its
// foot. Four frames turning; frame 0 alone is the seized wheel.
export function millWheel() {
  const S = 34, cx = 16.5, cy = 15.5, R0 = 13.5;
  return [0, 1, 2, 3].map((f) => {
    const [c, ctx] = makeCanvas(S, S);
    const rot = (f / 4) * (Math.PI / 4); // eight spokes: a quarter of their spacing per frame
    // paddles sticking out past the rim
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let r = R0 - 1; r <= R0 + 2; r += 0.5) px(ctx, Math.round(cx + ca * r), Math.round(cy + sa * r), r > R0 + 1 ? 'woodD' : 'wood');
    }
    // the rim (two rings of plank)
    for (let a = 0; a < 96; a++) {
      const t = (a / 96) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      const lit = ct + st < -0.3; // lit from the top-left
      px(ctx, Math.round(cx + ct * R0), Math.round(cy + st * R0), lit ? 'woodL' : 'wood');
      px(ctx, Math.round(cx + ct * (R0 - 1.5)), Math.round(cy + st * (R0 - 1.5)), 'woodD');
    }
    // spokes
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let r = 2; r < R0 - 1.5; r += 0.5) px(ctx, Math.round(cx + ca * r), Math.round(cy + sa * r), i % 2 ? 'woodD' : 'wood');
    }
    // hub and axle
    px(ctx, Math.round(cx) - 2, Math.round(cy) - 2, 'steelD', 4, 4); px(ctx, Math.round(cx) - 1, Math.round(cy) - 1, 'steel', 2, 2); px(ctx, Math.round(cx) - 1, Math.round(cy) - 2, 'steelL', 1, 1);
    outline(c, 'ink');
    // the lake over its foot: water and foam (foam churns while it turns)
    // (an oval that thins at the ends, in the lake's own blues, so it sits in the water rather than on it)
    for (let y = S - 6; y < S; y++) for (let x = 0; x < S; x++) {
      const k = (y - (S - 6)) / 6, half = (R0 - 2) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k) * 0.7));
      if (Math.abs(x - cx) > half) continue;
      const top = y === S - 6, churn = hash(x + f * 5, y, 82);
      px(ctx, x, y, top ? (churn < 0.55 ? 'foam' : 'waterL') : churn < 0.22 ? 'foam' : churn < 0.5 ? 'waterL' : y > S - 3 ? 'waterD' : 'water');
    }
    return c;
  });
}

// A patch of the spreading blight (the Basin's dead violet earth, a step
// beyond each standing Ward Stone): a ragged blob with faint glowing cracks,
// dithered out at the edge so it eats into the ground rather than sitting on
// it, a dead tuft or two and the odd bone. Gone when the region's stone falls.
export function blightPatch(seed = 0, W = 64, H = 40) {
  const [c, ctx] = makeCanvas(W, H);
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - cx) / (W / 2), ny = (y - cy) / (H / 2);
    const d = Math.hypot(nx, ny) + (vnoise(x / 9, y / 9, 300 + seed) - 0.5) * 0.7;
    if (d > 1) continue;
    if (d > 0.72 && bayer(x, y) < (d - 0.72) / 0.28) continue; // ragged, dithered edge
    const cr = Math.abs(vnoise(x / 11, y / 11, 310 + seed) - 0.5);
    let col;
    if (cr < 0.018 && d < 0.8) col = hash(x, y, 311 + seed) < 0.5 ? 'curse' : 'purp'; // the glowing cracks
    else if (cr < 0.035 && d < 0.85) col = 'hexD';
    else { const n = vnoise(x / 6, y / 6, 320 + seed) + (bayer(x, y) - 0.5) * 0.2; col = d > 0.82 ? (n < 0.5 ? 'purpD' : 'hexD') : n < 0.35 ? 'hexD' : n < 0.7 ? 'night' : 'purpD'; }
    px(ctx, x, y, col);
  }
  // a few dead, grey tufts (no bones out here; those belong to the Basin)
  for (let i = 0; i < 3; i++) {
    const tx = Math.round(cx + (hash(seed, i, 330) - 0.5) * W * 0.6), ty = Math.round(cy + (hash(seed, i, 331) - 0.5) * H * 0.5);
    px(ctx, tx, ty - 2, 'slate', 1, 3); px(ctx, tx - 2, ty - 1, 'slate', 1, 2); px(ctx, tx + 2, ty - 1, 'stone', 1, 2);
  }
  return c;
}

// A straw archery butt on a little trestle, its painted face toward you (the range by Wynn's house).
export function strawButt() {
  const [c, ctx] = makeCanvas(22, 26);
  px(ctx, 4, 16, 'woodD', 2, 10); px(ctx, 16, 16, 'woodD', 2, 10); px(ctx, 3, 22, 'wood', 16, 2); // trestle
  shadedBlob(ctx, 11, 11, 9, 9, ['dirtD', 'dirt', 'dirtL', 'sand']); // the straw boss
  for (const [r, col] of [[7, 'bone'], [5, 'blue'], [3, 'redL'], [1, 'gold']]) for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; for (let rr = r - 1; rr <= r; rr += 0.5) px(ctx, Math.round(11 + Math.cos(t) * rr), Math.round(11 + Math.sin(t) * rr * 0.95), col); }
  px(ctx, 10, 10, 'gold', 2, 2);
  px(ctx, 14, 6, 'woodD', 1, 4); px(ctx, 13, 5, 'bone', 3, 1); // an arrow in it
  outline(c, 'ink');
  return c;
}
