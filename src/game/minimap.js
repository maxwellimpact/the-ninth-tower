// Minimap: one pixel per tile, coloured by terrain, hidden under fog of war
// until explored. Exploration is saved as a base64 bitset in the save state.
import { rgb } from '../gfx/palette.js';
import { makeCanvas } from '../gfx/pixel.js';
import { T, MAP_W, MAP_H } from '../world/map.js';

const COL = {
  [T.GRASS]: 'grass', [T.PATH]: 'dirtL', [T.SAND]: 'sand', [T.WATER]: 'water', [T.PLATEAU]: 'grassL',
  [T.CLIFF]: 'slate', [T.STAIRS]: 'bone', [T.PAVED]: 'mist', [T.WALL]: 'bone', [T.RIM]: 'slate',
  [T.MARSH]: 'moss', [T.SHALLOW]: 'bogL', [T.BOG]: 'bogD', [T.CHASM]: 'ink', [T.CAVEFLOOR]: 'caveXL', [T.DFLOOR]: 'stone', [T.DWALL]: 'night',
  [T.CAVEWALL]: 'caveD', [T.BRIDGE]: 'wood', [T.MOUTH]: 'ink', [T.LOAM]: 'gloomL', [T.HOUSE]: 'woodD',
};
const FOG = rgb('night');

const LEGACY_W = 320; // map width before the dungeon lab widened it

export class MiniMap {
  constructor(scene, world, state) {
    this.scene = scene;
    this.state = state;
    this.base = new Uint8ClampedArray(MAP_W * MAP_H * 4);
    const cache = {};
    const c = (k) => (cache[k] ??= rgb(k));
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = world.at(x, y);
      const [r, g, b] = c(COL[t] || 'ink');
      const i = (y * MAP_W + x) * 4;
      this.base[i] = r; this.base[i + 1] = g; this.base[i + 2] = b; this.base[i + 3] = 255;
    }
    for (const p of world.props) {
      if (p.type !== 'tree' && p.type !== 'deadtree' && p.type !== 'gloomtree') continue;
      const i = (p.y * MAP_W + p.x) * 4;
      const [r, g, b] = c(p.type === 'tree' ? 'leafD' : p.type === 'gloomtree' ? 'gloomD' : 'mudD');
      this.base[i] = r; this.base[i + 1] = g; this.base[i + 2] = b;
    }
    this.explored = this.decode(state.explored);
    const [cv, ctx] = makeCanvas(MAP_W, MAP_H);
    this.canvas = cv;
    this.ctx = ctx;
    this.img = ctx.createImageData(MAP_W, MAP_H);
    for (let i = 0; i < MAP_W * MAP_H; i++) this.paint(i);
    ctx.putImageData(this.img, 0, 0);
    if (scene.textures.exists('minimap')) scene.textures.remove('minimap');
    this.tex = scene.textures.addCanvas('minimap', cv);
    this.dirty = false;
  }

  paint(i) {
    const d = this.img.data, o = i * 4;
    if (this.explored[i]) { d[o] = this.base[o]; d[o + 1] = this.base[o + 1]; d[o + 2] = this.base[o + 2]; }
    else { d[o] = FOG[0]; d[o + 1] = FOG[1]; d[o + 2] = FOG[2]; }
    d[o + 3] = 255;
  }

  reveal(tx, ty, r) {
    for (let y = Math.max(0, ty - r); y <= Math.min(MAP_H - 1, ty + r); y++) for (let x = Math.max(0, tx - r); x <= Math.min(MAP_W - 1, tx + r); x++) {
      if ((x - tx) * (x - tx) + (y - ty) * (y - ty) > r * r) continue;
      const i = y * MAP_W + x;
      if (this.explored[i]) continue;
      this.explored[i] = 1;
      this.paint(i);
      this.dirty = true;
    }
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  }

  isExplored(tx, ty) { return !!this.explored[ty * MAP_W + tx]; }

  serialize() {
    const bytes = new Uint8Array(Math.ceil((MAP_W * MAP_H) / 8));
    for (let i = 0; i < MAP_W * MAP_H; i++) if (this.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }

  // Explored tiles are saved as a bit per tile, row by row, so they only line
  // up at the map width they were saved with. Saves record that width
  // (state.exploredW); older saves predate it and were written at 320 wide.
  decode(b64) {
    const out = new Uint8Array(MAP_W * MAP_H);
    if (!b64) return out;
    try {
      const s = atob(b64);
      const w = this.state.exploredW || LEGACY_W;
      const bit = (i) => s.charCodeAt(i >> 3) & (1 << (i & 7));
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < Math.min(w, MAP_W); x++) if (bit(y * w + x)) out[y * MAP_W + x] = 1;
    } catch { /* corrupt -> start fresh */ }
    return out;
  }
}
