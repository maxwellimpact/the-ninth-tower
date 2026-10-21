// Small helpers for drawing the game's generated art on the page: crisp
// scaled canvases, the game's own pixel font, prop sprites and hero puppets.
import { buildFontAtlas, FONT_CHARS, AMP_PAIR, CELL_W, CELL_H } from '../../src/gfx/font.js';
import * as P from '../../src/gfx/props.js';
import { heroDef, GOBLIN } from '../../src/gfx/heroes.js';
import { buildPuppetFrames } from '../../src/gfx/puppet.js';

// A canvas that draws at `w`×`h` game pixels and shows them `scale`× bigger.
export function pixelCanvas(w, h, scale = 1, cls = '') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  c.className = `px ${cls}`.trim();
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// ------------------------------------------------------------------ the font
const atlases = new Map();
const atlas = (color, edge) => {
  const k = `${color}|${edge}`;
  if (!atlases.has(k)) atlases.set(k, buildFontAtlas(color, edge));
  return atlases.get(k);
};
const index = new Map([...FONT_CHARS].map((ch, i) => [ch, i]));

// Draw a line of text with the game's 3×5 font (white with an ink outline by
// default; 'goldL' is the gold used for titles). "&" takes two cells, as in the game.
export function drawText(ctx, text, x, y, { color = 'white', edge = 'ink' } = {}) {
  const a = atlas(color, edge);
  const s = String(text).toUpperCase().replace(/&/g, AMP_PAIR);
  let cx = x;
  for (const ch of s) {
    const i = index.get(ch);
    if (i !== undefined) ctx.drawImage(a, i * CELL_W, 0, CELL_W, CELL_H, cx, y, CELL_W, CELL_H);
    cx += CELL_W;
  }
  return cx - x;
}
export const textWidth = (text) => String(text).replace(/&/g, AMP_PAIR).length * CELL_W;

// A canvas holding one line of pixel text, shown `scale`× (for labels on the page).
export function pixelText(text, scale = 3, opts = {}) {
  const [c, ctx] = pixelCanvas(textWidth(text), CELL_H, scale, 'pxtext');
  drawText(ctx, text, 0, 0, opts);
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', text);
  return c;
}
export { CELL_W, CELL_H };

// ------------------------------------------------------------------- props
// The world's scenery, drawn by the same generators the game uses. Each entry
// says how a prop of that type stands on its tile (anchor offset below the
// tile centre, as in Game.createProp).
const first = (v) => (Array.isArray(v) ? v[0] : v);
const PROPS = {
  tree: [(p) => P.tree(p.seed % 8), 6], deadtree: [(p) => P.deadTree(p.seed % 4), 6], gloomtree: [(p) => P.gloomTree(p.seed % 4), 6],
  ashtree: [(p) => P.ashTree(p.seed % 4), 6], snowpine: [(p) => P.snowPine(p.seed % 4), 6],
  bush: [(p) => P.bush(p.seed % 4, !!p.berries), 4], rock: [(p) => P.rock(p.seed % 4, !!p.big), 4],
  tuft: [(p) => first(P.grassTuft(p.seed % 4)), 4], reeds: [(p) => first(P.reeds(p.seed % 4)), 6],
  mushrooms: [(p) => P.mushrooms(p.seed % 4), 4], flowers: [(p) => P.flowerPatch(p.seed % 6), 8, true], lily: [(p) => P.lilyPad(p.seed % 3), 8, true],
  stump: [(p) => P.stump(p.seed % 4), 4], fern: [(p) => first(P.fern(p.seed % 4)), 4], obsidian: [(p) => P.obsidian(p.seed % 4, !!p.big), 4],
  snowrock: [(p) => P.snowRock(p.seed % 4, !!p.big), 4], pillar: [(p) => P.pillar(!!p.broken), 8], barrel: [() => P.barrel(), 4],
};
const propCache = new Map();
export function propSprite(p) {
  const def = PROPS[p.type];
  if (!def) return null;
  const k = `${p.type}|${p.seed}|${p.big ? 1 : 0}|${p.berries ? 1 : 0}|${p.broken ? 1 : 0}`;
  if (!propCache.has(k)) { try { propCache.set(k, def[0](p)); } catch { propCache.set(k, null); } }
  const img = propCache.get(k);
  return img ? { img, dy: def[1], flat: !!def[2] } : null;
}

// Draw every prop that stands inside a pixel rectangle, back to front.
export function drawProps(ctx, props, x0, y0, w, h) {
  const list = props.filter((p) => p.x * 16 >= x0 - 48 && p.x * 16 <= x0 + w + 48 && p.y * 16 >= y0 - 16 && p.y * 16 <= y0 + h + 64).sort((a, b) => a.y - b.y);
  for (const p of list) {
    const s = propSprite(p);
    if (!s) continue;
    const x = p.x * 16 + 8 - x0, y = p.y * 16 + 8 - y0;
    if (s.flat) ctx.drawImage(s.img, Math.round(x - s.img.width / 2), Math.round(y - s.img.height / 2));
    else ctx.drawImage(s.img, Math.round(x - s.img.width / 2), Math.round(y + s.dy - s.img.height));
  }
}

// ------------------------------------------------------------------ puppets
const puppets = new Map();
// Every frame of a hero in some gear: { idle: { down: [...], side, up }, walk, ... }
export function heroFrames(id, equip = null) {
  const k = `${id}|${JSON.stringify(equip)}`;
  if (!puppets.has(k)) puppets.set(k, buildPuppetFrames(heroDef(id, equip)));
  return puppets.get(k);
}
let goblin = null;
export const goblinFrames = () => (goblin ??= buildPuppetFrames(GOBLIN));

// Mirror a side-view frame to face left.
const mirrors = new WeakMap();
export function mirrored(frame) {
  if (!mirrors.has(frame)) {
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    const x = c.getContext('2d'); x.translate(frame.width, 0); x.scale(-1, 1); x.drawImage(frame, 0, 0);
    mirrors.set(frame, c);
  }
  return mirrors.get(frame);
}
