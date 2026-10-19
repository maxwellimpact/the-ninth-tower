// Cottage generator (DESIGN: cottages). Two body types - 'A' (the hipped 3/4
// cottage) and 'C' (the storybook cottage: a big rounded roof over a low wall,
// an arched door) - and every house rolls its own roof, door, windows, chimney
// and ornaments from a seed, so a street isn't a row of copies. Chimneys stand
// in the roof they rise from. A shop can pin a hanging sign; any cottage can be
// drawn boarded up. The canvas carries `door` (the doorway's rect, for the
// open-door overlay) and `spout` (the chimney mouth, for smoke, or null).
import { makeCanvas, px, outline, hash } from './pixel.js';
import { PAL } from './palette.js';

const ROOFS = {
  tile: { lit: 'redL', mid: 'red', dark: 'redD', cap: 'bone' },
  slate: { lit: 'steelL', mid: 'steel', dark: 'blueD', cap: 'bone' },
  thatch: { lit: 'dirtL', mid: 'dirt', dark: 'dirtD', cap: 'woodL', straw: true },
  moss: { lit: 'grassL', mid: 'leaf', dark: 'leafD', cap: 'mossL' },
  plum: { lit: 'purpL', mid: 'purp', dark: 'purpD', cap: 'bone' },
  shingle: { lit: 'woodL', mid: 'wood', dark: 'woodD', cap: 'sand' },
};
const DOORS = [['blueD', 'blue'], ['leafD', 'leaf'], ['redD', 'red'], ['woodD', 'wood'], ['purpD', 'purp'], ['steelD', 'steel']];
const WINDOWS = ['four', 'round', 'tall', 'shutter', 'small', 'diamond'];
const CHIMNEYS = ['none', 'stone', 'brick', 'pipe'];
const ORNAMENTS = ['lantern', 'barrel', 'ivy', 'pots', 'bench', 'vane', 'dormer'];

function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];

// the features a seed rolls (or pass your own to pin any of them)
export function roll(type, seed, pin = {}) {
  const r = rng(seed * 97 + (type === 'C' ? 13 : 7));
  const f = {
    type, roof: pick(r, Object.keys(ROOFS)), door: pick(r, DOORS), doorStyle: pick(r, ['plain', 'panel', 'window']),
    arch: type === 'C' ? r() < 0.8 : r() < 0.3, windows: [pick(r, WINDOWS), pick(r, WINDOWS)], pair: r() < 0.6,
    flowers: r() < 0.55, chimney: pick(r, CHIMNEYS), chimneySide: r() < 0.5 ? -1 : 1,
    ornaments: [],
  };
  if (f.pair) f.windows[1] = f.windows[0]; // a matching pair more often than not
  const n = r() < 0.3 ? 0 : r() < 0.7 ? 1 : 2;
  while (f.ornaments.length < n) { const o = pick(r, ORNAMENTS); if (!f.ornaments.includes(o) && !((o === 'dormer' || o === 'lantern') && type === 'C')) f.ornaments.push(o); } // C's low wall has no room for a lantern
  return { ...f, ...pin };
}

// hanging signs, 8x7, drawn at (x, y), the bracket above
function hangSign(ctx, x, y, sign) {
  px(ctx, x, y - 3, 'woodD', 8, 1); px(ctx, x + 1, y - 2, 'woodD', 1, 2); px(ctx, x + 6, y - 2, 'woodD', 1, 2);
  px(ctx, x, y, 'wood', 8, 7);
  if (sign === 'potion') { px(ctx, x + 2, y + 2, 'redL', 3, 4); px(ctx, x + 2, y + 1, 'bone', 3, 1); }
  if (sign === 'mug') { px(ctx, x + 2, y + 1, 'gold', 3, 4); px(ctx, x + 5, y + 2, 'gold', 1, 2); px(ctx, x + 2, y + 1, 'white', 3, 1); }
  if (sign === 'gem') { px(ctx, x + 3, y + 1, 'purpL', 2, 1); px(ctx, x + 2, y + 2, 'purpL', 4, 2); px(ctx, x + 3, y + 4, 'purp', 2, 1); px(ctx, x + 3, y + 2, 'white'); }
  if (sign === 'target') { px(ctx, x + 2, y + 1, 'bone', 4, 5); px(ctx, x + 3, y + 2, 'redL', 2, 3); px(ctx, x + 1, y + 3, 'bone', 1, 1); px(ctx, x + 6, y + 3, 'bone', 1, 1); }
  if (sign === 'steam') { px(ctx, x + 1, y + 4, 'blueL', 6, 2); px(ctx, x + 2, y + 1, 'bone', 1, 2); px(ctx, x + 4, y + 2, 'bone', 1, 2); px(ctx, x + 6, y + 1, 'bone', 1, 2); }
  if (sign === 'crest') { px(ctx, x + 2, y + 1, 'gold', 4, 4); px(ctx, x + 3, y + 5, 'gold', 2, 1); px(ctx, x + 3, y + 2, 'redL', 2, 2); }
}

function plaster(ctx, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(ctx, x, y, (x * 7 + y * 3) % 23 === 0 ? 'mist' : 'bone');
  for (let y = y0; y <= y1; y++) px(ctx, x1, y, 'mist');
}

// ---- doors: no centre seam; plain (hinges + latch), panelled, or with a little window
const doorShape = (x, y, w, h, arch) => { const r = arch ? Math.floor(w / 2) : 0, cx = x + (w - 1) / 2; return [r, (xx, yy) => xx >= x && xx < x + w && yy >= y && yy < y + h && (!r || yy >= y + r || Math.hypot(xx - cx, yy - (y + r)) <= r + 0.3)]; };

export function drawDoor(ctx, x, y, w, h, style, { base = 'blueD', lite = 'blue', trim = 'woodD', arch = false } = {}) {
  const [r, inside] = doorShape(x, y, w, h, arch);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!inside(xx, yy)) continue;
    px(ctx, xx, yy, !inside(xx - 1, yy) || !inside(xx + 1, yy) || !inside(xx, yy - 1) ? trim : base);
  }
  for (let xx = x + 1; xx < x + w - 1; xx++) for (let yy = y; yy < y + h; yy++) if (inside(xx, yy) && inside(xx, yy - 1) && !inside(xx, yy - 2)) { px(ctx, xx, yy, lite); break; }
  const ix = x + 1, iw = w - 2, iy = y + (r ? Math.round(r * 0.6) : 1), ih = y + h - iy;
  if (style === 'plain') {
    for (const hy of [iy + Math.round(ih * 0.22), iy + Math.round(ih * 0.68)]) px(ctx, ix, hy, 'steelD', Math.ceil(iw * 0.5), 1);
    px(ctx, ix + iw - 3, iy + Math.round(ih * 0.48), 'gold', 2, 2);
  }
  if (style === 'panel') {
    const pw = iw - 4, ph = Math.floor((ih - 6) / 2);
    for (const py of [iy + 2, iy + 4 + ph]) { px(ctx, ix + 2, py, trim, pw, 1); px(ctx, ix + 2, py, trim, 1, ph); px(ctx, ix + 2, py + ph - 1, lite, pw, 1); px(ctx, ix + 1 + pw, py, lite, 1, ph); }
    px(ctx, ix + iw - 2, iy + Math.round(ih * 0.5), 'gold', 1, 2);
  }
  if (style === 'window') {
    const ww = Math.max(4, iw - 4), wh = Math.max(4, Math.round(ih * 0.3));
    px(ctx, ix + 2, iy + 1, trim, ww, wh); px(ctx, ix + 3, iy + 2, 'fire', ww - 2, wh - 2); px(ctx, ix + 3, iy + 2, 'fireL', Math.ceil((ww - 2) / 2), Math.ceil((wh - 2) / 2));
    px(ctx, ix + 1, iy + 3 + wh, trim, iw - 2, 1);
    px(ctx, ix + iw - 3, iy + Math.round(ih * 0.6), 'gold', 2, 2);
  }
}

// ---- windows, each about 8-10px; (x, y) is the top-left; flower box under it
function drawWindow(ctx, kind, x, y, flowers, shutter = 'leafD') {
  const glass = (gx, gy, w, h) => { px(ctx, gx, gy, 'fire', w, h); px(ctx, gx, gy, 'fireL', Math.ceil(w / 2), Math.ceil(h / 2)); };
  let w = 9, h = 8;
  if (kind === 'four' || kind === 'shutter') {
    px(ctx, x, y, 'woodD', 9, 8); glass(x + 1, y + 1, 7, 6); px(ctx, x + 4, y + 1, 'woodD', 1, 6); px(ctx, x + 1, y + 4, 'woodD', 7, 1);
    if (kind === 'shutter') { px(ctx, x - 3, y, shutter, 3, 8); px(ctx, x + 9, y, shutter, 3, 8); px(ctx, x - 2, y + 2, 'woodD', 1, 4); px(ctx, x + 10, y + 2, 'woodD', 1, 4); }
  } else if (kind === 'round') {
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; px(ctx, Math.round(x + 4 + Math.cos(t) * 4), Math.round(y + 4 + Math.sin(t) * 4), 'woodD'); }
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= 9) px(ctx, x + 4 + xx, y + 4 + yy, xx + yy < 0 ? 'fireL' : 'fire');
    px(ctx, x + 4, y + 1, 'woodD', 1, 7); h = 9;
  } else if (kind === 'tall') {
    w = 7; h = 11;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const arc = yy < 3 && Math.hypot(xx - 3, yy - 3) > 3.4; if (!arc) px(ctx, x + xx, y + yy, xx === 0 || xx === w - 1 || yy === h - 1 || (yy < 4 && Math.hypot(xx - 3, yy - 3) > 2.4) ? 'woodD' : yy < 5 ? 'fireL' : 'fire'); }
    px(ctx, x + 1, y + 6, 'woodD', 5, 1);
  } else if (kind === 'small') {
    w = 6; h = 6; px(ctx, x, y, 'woodD', 6, 6); glass(x + 1, y + 1, 4, 4);
  } else if (kind === 'diamond') {
    px(ctx, x, y, 'woodD', 9, 9); glass(x + 1, y + 1, 7, 7);
    for (let yy = 1; yy < 8; yy++) for (let xx = 1; xx < 8; xx++) if ((xx + yy) % 4 === 0 || (xx - yy + 8) % 4 === 0) px(ctx, x + xx, y + yy, 'woodD'); // the leading
    h = 9;
  }
  if (flowers === 'dead') { px(ctx, x - 1, y + h, 'woodD', w + 2, 1); px(ctx, x - 1, y + h + 1, 'dirtD', w + 2, 2); }
  else if (flowers) { px(ctx, x - 1, y + h, 'woodD', w + 2, 1); px(ctx, x - 1, y + h + 1, 'grass', w + 2, 2); px(ctx, x + 1, y + h + 1, 'redL'); px(ctx, x + w - 2, y + h + 1, 'goldL'); }
  else px(ctx, x - 1, y + h, 'woodD', w + 2, 1); // a sill
  return { x, y, w, h };
}

// ---- chimneys: a stone stack, a thin brick one, or a narrow metal pipe; `roofY(x)` is the roof's top at a column
function drawChimney(ctx, kind, cx, baseY, shade) {
  if (kind === 'none') return null;
  const w = kind === 'stone' ? 7 : kind === 'brick' ? 5 : 3, x0 = Math.round(cx - w / 2);
  const base = baseY, top = Math.max(0, base - (kind === 'pipe' ? 13 : 14));
  for (let y = top; y <= base; y++) for (let x = x0; x < x0 + w; x++) {
    let col;
    if (kind === 'stone') col = (y - top) % 3 === 2 || ((x + Math.floor((y - top) / 3)) % 4 === 0) ? 'slate' : x === x0 ? 'mist' : 'stone';
    else if (kind === 'brick') col = (y - top) % 2 === 1 ? 'redD' : x === x0 ? 'redL' : 'red';
    else col = x === x0 ? 'steelL' : x === x0 + w - 1 ? 'steelD' : 'steel';
    px(ctx, x, y, col);
  }
  px(ctx, x0 + w, base - 1, shade, 2, 2); px(ctx, x0 - 1, base + 1, shade, w + 3, 1); // its shadow on the roof: standing in it, not floating over it
  if (kind === 'pipe') { px(ctx, x0 - 1, top, 'steelD', w + 2, 2); } // a little cap
  else { px(ctx, x0 - 1, top, kind === 'stone' ? 'stone' : 'redD', w + 2, 2); px(ctx, x0 + 1, top + 2, 'night', w - 2, 1); } // the rim and its dark mouth
  return [x0 + w / 2, top];
}

// ---- ornaments
function drawOrnaments(ctx, f, g) {
  for (const o of f.ornaments) {
    if (o === 'lantern' && !g.boarded) { const lx = g.doorX - 5, ly = g.wallTop + 2; /* under the eave, above the window line */ px(ctx, lx, ly, 'woodD', 3, 1); px(ctx, lx + 2, ly + 1, 'woodD', 1, 2); px(ctx, lx + 1, ly + 3, 'steelD', 3, 4); px(ctx, lx + 2, ly + 4, 'fireL', 1, 2); }
    if (o === 'barrel') { const bx = g.wallR - 7, by = g.bot - 7; px(ctx, bx, by, 'woodD', 6, 8); px(ctx, bx + 1, by, 'wood', 4, 8); px(ctx, bx, by + 2, 'steelD', 6, 1); px(ctx, bx, by + 5, 'steelD', 6, 1); px(ctx, bx + 1, by, 'woodL', 1, 8); }
    if (o === 'ivy') for (let y = g.wallTop - 1; y < g.bot; y++) { const reach = 2 + Math.round(3 * (1 - (y - g.wallTop) / (g.bot - g.wallTop)) * hash(y, 5, 9)) + (y > g.bot - 8 ? 2 : 0); for (let k = 0; k < reach; k++) { const h = hash(g.wallL + k, y, 9); if (h < 0.8) px(ctx, g.wallL + k, y, h < 0.3 ? 'leafD' : h < 0.65 ? 'leaf' : 'grassL'); } }
    if (o === 'pots' && !g.boarded) { for (const dx of [-6, g.doorW + 2]) { const x = g.doorX + dx, y = g.bot - 4; px(ctx, x, y, 'fire', 4, 4); px(ctx, x, y, 'woodD', 4, 1); px(ctx, x + 1, y - 3, 'leaf', 2, 3); px(ctx, x + 1, y - 4, 'redL', 2, 1); } }
    if (o === 'bench') { const x = g.wallL + 3, y = g.bot - 4; px(ctx, x, y, 'wood', 10, 2); px(ctx, x, y - 3, 'woodD', 10, 1); px(ctx, x + 1, y + 2, 'woodD', 1, 2); px(ctx, x + 8, y + 2, 'woodD', 1, 2); }
    if (o === 'vane') { const x = g.vaneX, y = Math.max(8, g.vaneY); px(ctx, x, y - 6, 'ink', 1, 7); px(ctx, x - 3, y - 6, 'ink', 7, 1); px(ctx, x + 1, y - 8, 'ink', 3, 2); px(ctx, x - 2, y - 7, 'ink', 1, 1); }
  }
}

// ---------------------------------------------------------------- the two bodies
// f: what roll() rolled (plus any pins: sign, flag). boarded: the windows dark
// and planked, the door nailed shut, no sign, no flowers, no lantern lit.
export function cottage(f, boarded = false) {
  f = { ...f, ornaments: f.ornaments.filter((o) => !(f.flag && o === 'vane')) }; // the banner flies where a vane would turn
  if (f.sign && f.windows[1] === 'shutter') f.windows = [f.windows[0], 'four']; // no shutter under the sign
  const g = { boarded, wins: [] };
  const [c, ctx] = f.type === 'C' ? storybook(f, g) : hipped(f, g);
  if (boarded) {
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, swap = [[hex('fire'), hex('night')], [hex('fireL'), hex('slate')]].map(([a, b]) => [rgbOf(a), rgbOf(b)]);
    for (let i = 0; i < d.length; i += 4) for (const [a, b] of swap) if (d[i] === a[0] && d[i + 1] === a[1] && d[i + 2] === a[2]) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; }
    ctx.putImageData(img, 0, 0);
    for (const w of g.wins) for (let i = 0; i < w.w - 2; i++) { const t = i / Math.max(1, w.w - 3); px(ctx, w.x + 1 + i, w.y + 1 + Math.round(t * (w.h - 3)), 'wood'); px(ctx, w.x + w.w - 2 - i, w.y + 1 + Math.round(t * (w.h - 3)), 'woodL'); }
    const { x, y, w } = g.door;
    for (let i = -1; i <= w; i++) { px(ctx, x + i, y + 4 + Math.round(i * 0.35), 'woodL', 1, 2); px(ctx, x + i, y + 13 + Math.round(i * 0.35), 'wood', 1, 2); px(ctx, x + i, y + 18 - Math.round(i * 0.35), 'woodL', 1, 2); }
  } else if (f.sign) hangSign(ctx, g.wallR - 3, g.wallTop + 3, f.sign);
  if (f.flag) { const x = g.vaneX, y0 = Math.max(0, g.vaneY - 9); px(ctx, x, y0, 'woodD', 1, g.vaneY - y0 + 2); px(ctx, x + 1, y0, boarded ? 'stone' : 'gold', 6, 4); if (!boarded) px(ctx, x + 2, y0 + 1, 'redL', 2, 2); } // the town banner
  outline(c, 'ink');
  c.door = g.door; c.spout = boarded ? null : g.spout;
  return c;
}

// the open doorway for a cottage's door: dark inside, warm light on the floor,
// the door swung in against the jamb; drawn over the door at c.door
export function doorOpen(f) {
  const probe = cottage(f), { w, h, arch } = probe.door;
  const [c, ctx] = makeCanvas(w, h), [, inside] = doorShape(0, 0, w, h, arch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1);
    px(ctx, x, y, edge ? 'woodD' : x <= 2 ? (x === 1 ? 'woodL' : 'wood') : y >= h - 7 && x >= 3 && x <= w - 3 ? (y >= h - 4 && x >= 4 && x <= w - 4 ? 'fireL' : 'fire') : 'ink');
  }
  return c;
}

const hex = (k) => PAL[k];
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function hipped(f, g) {
  const W = 56, H = 64, L = 3, R = W - 4, bot = H - 3, top = 3, ridge = 7, eave = 31, P = ROOFS[f.roof];
  const [c, ctx] = makeCanvas(W, H);
  const wallL = L + 2, wallR = R - 2, wallTop = eave + 1;
  plaster(ctx, wallL, wallTop, wallR, bot);
  for (let y = wallTop; y <= bot; y++) { px(ctx, wallL, y, 'woodD'); px(ctx, wallR, y, 'woodD'); }
  px(ctx, wallL, bot, 'woodD', wallR - wallL + 1, 1);
  for (let x = wallL; x <= wallR; x++) { px(ctx, x, wallTop, 'slate'); px(ctx, x, wallTop + 1, 'stone'); }
  const doorW = f.arch ? 13 : 12, doorX = Math.round(W / 2 - doorW / 2);
  drawDoor(ctx, doorX, bot - 22, doorW, 22, f.doorStyle, { base: f.door[0], lite: f.door[1], arch: f.arch });
  px(ctx, doorX - 1, bot + 1, 'stone', doorW + 2, 2);
  const flowers = f.flowers && (g.boarded ? 'dead' : true);
  g.wins.push(drawWindow(ctx, f.windows[0], wallL + 4, bot - 19, flowers, f.door[0]));
  g.wins.push(drawWindow(ctx, f.windows[1], wallR - 13, bot - 19, flowers, f.door[0]));
  // the hipped roof
  for (let y = top; y < ridge; y++) { const ins = 10 + (ridge - y); for (let x = L + ins; x <= R - ins; x++) px(ctx, x, y, y === top ? P.dark : P.mid); }
  const insetAt = (y) => Math.round((1 - (y - ridge) / (eave - ridge)) * 9) - 2;
  for (let y = ridge; y <= eave; y++) {
    const t = (y - ridge) / (eave - ridge), ins = insetAt(y), row = Math.floor(Math.pow(t, 0.75) * 6), rowStart = Math.ceil(ridge + Math.pow(row / 6, 1 / 0.75) * (eave - ridge));
    for (let x = L + ins; x <= R - ins; x++) {
      let col;
      if (P.straw) { const sh = hash(x, Math.floor(y / 2), 41); col = y === rowStart && hash(x, y, 42) < 0.8 ? P.dark : sh < 0.2 ? P.dark : sh < 0.65 ? P.mid : P.lit; }
      else { const off = (row % 2) * 3; col = y === rowStart ? P.dark : (x + off) % (5 + Math.round(t * 2)) === 0 ? P.dark : t < 0.35 ? P.lit : P.mid; }
      if (x <= L + ins + 1) col = P.lit;
      if (x >= R - ins - 1) col = P.dark;
      if (y === ridge) col = P.cap;
      px(ctx, x, y, col);
    }
  }
  px(ctx, L - 2, eave + 1, 'woodD', R - L + 5, 1);
  if (P.straw) for (let x = L - 2; x <= R + 2; x += 2) px(ctx, x, eave + 1, P.dark, 1, 2);
  if (f.ornaments.includes('dormer')) { const dx = f.chimneySide > 0 ? 14 : 30; px(ctx, dx - 1, ridge + 6, P.dark, 12, 3); px(ctx, dx, ridge + 9, 'woodD', 10, 8); px(ctx, dx + 1, ridge + 10, 'fire', 8, 6); px(ctx, dx + 1, ridge + 10, 'fireL', 3, 3); px(ctx, dx + 4, ridge + 10, 'woodD', 1, 6); px(ctx, dx - 2, ridge + 5, P.cap, 14, 1); }
  if (g.boarded) slipped(ctx, P, L, R, ridge, eave);
  g.spout = drawChimney(ctx, f.chimney, f.chimneySide > 0 ? R - 12 : L + 12, ridge + 8, P.dark);
  Object.assign(g, { doorX, doorW, bot, wallL, wallR, wallTop, vaneX: f.chimneySide > 0 ? 20 : 36, vaneY: ridge, door: { x: doorX, y: bot - 22, w: doorW, h: 22, arch: f.arch } });
  drawOrnaments(ctx, f, g);
  return [c, ctx];
}

// a boarded-up house has lost a few tiles
function slipped(ctx, P, L, R, y0, y1) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
  for (let y = y0 + 2; y < y1 - 1; y++) for (let x = L + 4; x < R - 4; x++) if (img[(y * ctx.canvas.width + x) * 4 + 3] && hash(x, y, 43) < 0.035) px(ctx, x, y, P.dark, 2, 1);
}

function storybook(f, g) {
  const W = 60, H = 64, L = 2, R = W - 3, bot = H - 3, eave = 36, top = 4, P = ROOFS[f.roof];
  const [c, ctx] = makeCanvas(W, H);
  const wallL = L + 5, wallR = R - 5, wallTop = eave + 1;
  plaster(ctx, wallL, wallTop, wallR, bot);
  for (let x = wallL; x <= wallR; x++) { px(ctx, x, bot - 2, (x % 5) ? 'stone' : 'slate'); px(ctx, x, bot - 1, (x % 5) ? 'mist' : 'slate'); px(ctx, x, bot, 'slate'); }
  const doorW = 15, doorX = Math.round(W / 2 - doorW / 2); // centred: the party files through the middle
  drawDoor(ctx, doorX, bot - 22, doorW, 22, f.doorStyle, { base: f.door[0], lite: f.door[1], trim: 'stone', arch: f.arch });
  px(ctx, doorX - 1, bot + 1, 'stone', doorW + 2, 2);
  // a window each side of the door
  const flowers = f.flowers && (g.boarded ? 'dead' : true);
  g.wins.push(drawWindow(ctx, f.windows[0], wallL + 3, wallTop + 6, flowers, f.door[0]));
  g.wins.push(drawWindow(ctx, f.windows[1], wallR - 11 - (f.windows[1] === 'shutter' ? 0 : 1), wallTop + 6, flowers, f.door[0]));
  // the big rounded roof
  const cx = (L + R) / 2, full = (R - L) / 2;
  const halfAt = (y) => { const t = (y - top) / (eave - top); let h = 7 + (full - 7) * Math.pow(t, 0.5); if (y >= eave - 1) h -= (y - (eave - 2)); return h; };
  for (let y = top; y <= eave; y++) {
    const t = (y - top) / (eave - top), half = halfAt(y), rowH = 5, row = Math.floor((y - top) / rowH), off = (row % 2) * 4;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const nx = (x - cx) / half;
      let col;
      if (P.straw) { const sh = hash(x, Math.floor(y / 2), 41); col = sh < 0.2 ? P.dark : sh < 0.65 ? P.mid : P.lit; if ((y - top) % rowH === rowH - 1 && hash(x, y, 42) < 0.7) col = P.dark; }
      else col = (y - top) % rowH === rowH - 1 ? P.dark : (x + off) % 8 === 0 ? P.dark : t < 0.3 ? P.lit : P.mid;
      if (nx < -0.75) col = P.lit;
      if (nx > 0.85) col = P.dark;
      if (y === top || (y === top + 1 && Math.abs(nx) > 0.6)) col = P.cap;
      if (y >= eave - 1) col = P.dark;
      px(ctx, x, y, col);
    }
  }
  for (let x = wallL; x <= wallR; x++) px(ctx, x, wallTop, 'slate');
  if (g.boarded) slipped(ctx, P, L + 4, R - 4, top + 3, eave - 2);
  g.spout = drawChimney(ctx, f.chimney, cx + f.chimneySide * 13, top + 11, P.dark);
  Object.assign(g, { doorX, doorW, bot, wallL, wallR, wallTop, vaneX: Math.round(cx), vaneY: top + 8, door: { x: doorX, y: bot - 22, w: doorW, h: 22, arch: f.arch } });
  drawOrnaments(ctx, f, g);
  return [c, ctx];
}

// a street of n cottages: roofs and door colours dealt from shuffled decks, so
// every colour turns up before any repeats and next-door neighbours never match
export function street(n, seed = 1, types = ['A', 'C']) {
  const r = rng(seed * 31 + 5), deck = (list) => { const d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };
  const roofs = [], doors = [];
  while (roofs.length < n) { const d = deck(Object.keys(ROOFS)); if (roofs.length && d[0] === roofs[roofs.length - 1]) d.push(d.shift()); roofs.push(...d); }
  while (doors.length < n) { const d = deck(DOORS); if (doors.length && d[0] === doors[doors.length - 1]) d.push(d.shift()); doors.push(...d); }
  return Array.from({ length: n }, (_, i) => roll(types[i % types.length], seed * 100 + i, { roof: roofs[i], door: doors[i] }));
}
