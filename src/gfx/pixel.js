// Low-level pixel drawing helpers. Everything renders into plain canvases,
// which Phaser then registers as textures (see sheets.js).
import { hex, rgb } from './palette.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function px(ctx, x, y, color, w = 1, h = 1) {
  if (!color) return;
  ctx.fillStyle = hex(color);
  ctx.fillRect(x | 0, y | 0, w, h);
}

// Paint a string grid: each char maps to a palette key via `map`. '.' and ' '
// are transparent. Optional mirror flips horizontally within the grid width.
export function grid(ctx, rows, map, ox = 0, oy = 0, mirror = false) {
  const w = Math.max(...rows.map((r) => r.length));
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = map[ch];
      if (!col) continue;
      const dx = mirror ? w - 1 - x : x;
      px(ctx, ox + dx, oy + y, col);
    }
  }
}

// Add a 1px outline around every opaque pixel. Done after compositing all
// layers so parts read as one silhouette (the single biggest readability win
// at phone size).
export function outline(canvas, color = 'ink', diagonals = false) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.getImageData(0, 0, w, h);
  const [r, g, b] = rgb(color);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y)) continue;
      let n = a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1);
      if (!n && diagonals) n = a(x - 1, y - 1) || a(x + 1, y - 1) || a(x - 1, y + 1) || a(x + 1, y + 1);
      if (n) {
        const i = (y * w + x) * 4;
        out.data[i] = r;
        out.data[i + 1] = g;
        out.data[i + 2] = b;
        out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Make a pure-white copy of a canvas (used for hit-flash frames).
export function silhouette(canvas, color = '#ffffff') {
  const [c, ctx] = makeCanvas(canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Deterministic hash noise in [0,1).
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth value noise for organic terrain edges.
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 4x4 Bayer matrix for ordered dithering — gives pixel-art gradients.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
