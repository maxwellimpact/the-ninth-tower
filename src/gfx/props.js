// World props and FX sprites. All return canvases (or arrays of frames).
// Anchor convention: props sit with their ground contact at the canvas
// bottom-centre unless noted.
import { makeCanvas, grid, px, outline, hash, bayer } from './pixel.js';
import { shadedBlob } from './creatures.js';

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
// Top-down 3/4 cottage to match the rest of the art: the roof (seen from
// above, lit from the NW) dominates; a short front wall with the door shows
// beneath it. Footprint is 3 tiles wide; the door is bottom-centre.
export function house(kind = 'shop') {
  const W = 56, H = 64;
  const [c, ctx] = makeCanvas(W, H);
  const thatch = kind === 'tavern';
  const roofTop = 2, ridge = 12, eave = 40, wallBot = H - 3;
  const L = 3, R = W - 4;
  // --- front wall (plaster + timber frame), under the eave
  for (let y = eave - 2; y <= wallBot; y++) for (let x = L + 2; x <= R - 2; x++) {
    const beam = x === L + 2 || x === R - 2 || x === Math.round(W / 2) - 9 || x === Math.round(W / 2) + 8 || y === wallBot;
    px(ctx, x, y, beam ? 'woodD' : (x * 7 + y * 3) % 23 === 0 ? 'mist' : 'bone');
  }
  // wall shading: right side darker, under-eave shadow band
  for (let x = L + 2; x <= R - 2; x++) { px(ctx, x, eave - 2, 'stone'); px(ctx, x, eave - 1, 'mist'); }
  for (let y = eave; y < wallBot; y++) px(ctx, R - 3, y, 'mist');
  // door (centre) + step
  const dx = Math.round(W / 2) - 5;
  px(ctx, dx - 1, wallBot - 14, 'woodD', 12, 14);
  px(ctx, dx, wallBot - 13, thatch ? 'wood' : 'blueD', 10, 13);
  px(ctx, dx, wallBot - 13, thatch ? 'woodL' : 'blue', 10, 1);
  px(ctx, dx + 4, wallBot - 13, 'woodD', 1, 13);
  px(ctx, dx + 7, wallBot - 7, 'gold', 1, 2);
  px(ctx, dx - 2, wallBot + 1, 'stone', 14, 2); px(ctx, dx - 2, wallBot + 1, 'mist', 14, 1);
  // windows with warm light
  for (const wx of [L + 5, R - 12]) {
    px(ctx, wx, eave + 4, 'woodD', 9, 8); px(ctx, wx + 1, eave + 5, 'fire', 7, 6); px(ctx, wx + 1, eave + 5, 'fireL', 3, 3); px(ctx, wx + 4, eave + 5, 'woodD', 1, 6); px(ctx, wx + 1, eave + 8, 'woodD', 7, 1);
    px(ctx, wx - 1, eave + 12, 'woodD', 11, 1);
    if (!thatch) { px(ctx, wx, eave + 13, 'grass', 9, 2); px(ctx, wx + 2, eave + 13, 'redL', 1, 1); px(ctx, wx + 6, eave + 13, 'goldL', 1, 1); } // flower box
  }
  // --- roof: back slope (top strip), ridge, front slope (big)
  for (let y = roofTop; y <= eave; y++) {
    const inset = y < ridge ? Math.max(0, Math.round((ridge - y) * 0.4)) : 0;
    for (let x = L + inset; x <= R - inset; x++) {
      const edgeL = x <= L + inset + 1, edgeR = x >= R - inset - 1;
      let col;
      if (thatch) {
        const streak = hash(x, Math.floor(y / 3), 41);
        const back = y < ridge;
        col = back ? (streak < 0.3 ? 'dirt' : 'dirtL') : streak < 0.18 ? 'dirtD' : streak < 0.6 ? 'dirt' : 'dirtL';
        if (!back && (y - ridge) % 7 === 6 && hash(x, y, 42) < 0.7) col = 'dirtD'; // thatch layers
        if (y === eave || (y === eave - 1 && x % 3 === 0)) col = 'dirtD';    // shaggy eave
      } else {
        const back = y < ridge;
        const row = Math.floor((y - ridge) / 4);
        const off = (row % 2) * 3;
        if (back) col = (x + y) % 5 === 0 ? 'red' : 'redL';
        else if ((y - ridge) % 4 === 3) col = 'redD';
        else if ((x + off) % 6 === 0) col = 'redD';
        else col = y - ridge < 6 ? 'redL' : 'red';
        if (y === eave) col = 'redD';
      }
      if (y === ridge) col = thatch ? 'woodL' : 'bone';
      if (y === ridge - 1) col = thatch ? 'dirtL' : 'redL';
      if (edgeL && y >= ridge) col = thatch ? 'dirtL' : 'redL';
      if (edgeR) col = thatch ? 'dirtD' : 'redD';
      px(ctx, x, y, col);
    }
  }
  // chimney (tavern) / sign (shop)
  if (thatch) {
    px(ctx, R - 14, roofTop + 2, 'slate', 7, 12); px(ctx, R - 14, roofTop + 2, 'stone', 7, 2); px(ctx, R - 13, roofTop + 4, 'night', 5, 1);
    // hanging mug sign by the door
    px(ctx, dx + 13, eave + 1, 'woodD', 8, 1); px(ctx, dx + 14, eave + 2, 'woodD', 1, 2); px(ctx, dx + 19, eave + 2, 'woodD', 1, 2);
    px(ctx, dx + 13, eave + 4, 'wood', 8, 7); px(ctx, dx + 15, eave + 5, 'gold', 3, 4); px(ctx, dx + 18, eave + 6, 'gold', 1, 2); px(ctx, dx + 15, eave + 5, 'white', 3, 1);
  } else {
    px(ctx, dx - 9, eave + 1, 'woodD', 8, 1); px(ctx, dx - 8, eave + 2, 'woodD', 1, 2); px(ctx, dx - 3, eave + 2, 'woodD', 1, 2);
    px(ctx, dx - 9, eave + 4, 'wood', 8, 7); px(ctx, dx - 7, eave + 6, 'redL', 3, 4); px(ctx, dx - 7, eave + 5, 'bone', 3, 1); // potion sign
  }
  outline(c, 'ink');
  return c;
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

// Open doorway overlay for a cottage door (sits exactly over the baked door).
export function doorOpen() {
  const [c, ctx] = makeCanvas(12, 14);
  px(ctx, 0, 0, 'woodD', 12, 14);
  px(ctx, 1, 1, 'ink', 10, 13);
  px(ctx, 3, 9, 'fire', 7, 5); px(ctx, 4, 11, 'fireL', 5, 3); // warm light on the floor inside
  px(ctx, 1, 1, 'wood', 2, 13); px(ctx, 1, 1, 'woodL', 1, 13); // door swung inward
  return c;
}

// Door in an interior's bottom wall. open=false: closed planks; open: daylight.
export function interiorDoor(open = false) {
  const [c, ctx] = makeCanvas(18, 20);
  px(ctx, 0, 0, 'woodD', 18, 20);
  if (open) {
    px(ctx, 2, 2, 'grassL', 14, 18); px(ctx, 2, 2, 'bone', 14, 3); px(ctx, 5, 8, 'grass', 8, 12);
    px(ctx, 2, 2, 'wood', 3, 18); px(ctx, 2, 2, 'woodL', 1, 18);
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
  // great trunk
  for (let y = 40; y < 124; y++) {
    const t = (y - 40) / 84;
    const w = Math.round(38 + t * t * 34);
    const x0 = 64 - (w >> 1);
    px(ctx, x0, y, 'barkD', w, 1);
    for (let x = x0 + 2; x < x0 + w - 2; x++) {
      const n = Math.sin(x * 0.7 + y * 0.05) + Math.sin(x * 0.23 - y * 0.11);
      px(ctx, x, y, n > 1.1 ? 'barkL' : n > -0.6 ? 'bark' : 'barkD');
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
  // a crown of dead boughs and a few clinging leaves
  const bough = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) px(ctx, Math.round(x + dx * i), Math.round(y + dy * i), i % 4 ? 'bark' : 'barkD', 3, 2); };
  bough(52, 44, -1.2, -0.9, 30); bough(76, 44, 1.2, -0.9, 30); bough(60, 40, -0.4, -1, 32); bough(68, 40, 0.5, -1, 30); bough(64, 42, 0, -1, 36);
  for (let i = 0; i < 9; i++) shadedBlob(ctx, 18 + hash(i, 1, 9) * 92, 6 + hash(i, 2, 9) * 30, 7, 5, GLOOM_LEAF, { bias: -0.2 });
  // the vine's sigil glow in the hollow
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
