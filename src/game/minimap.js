// Minimap: one pixel per tile, coloured by terrain, hidden under fog of war
// until explored. Exploration is saved in the save state as runs (see serialize).
import { rgb } from '../gfx/palette.js';
import { makeCanvas } from '../gfx/pixel.js';
import { T, MAP_W, MAP_H, biomeAt } from '../world/map.js';

const COL = {
  [T.GRASS]: 'grass', [T.PATH]: 'dirtL', [T.SAND]: 'sand', [T.WATER]: 'water', [T.PLATEAU]: 'grassL',
  [T.CLIFF]: 'slate', [T.STAIRS]: 'bone', [T.PAVED]: 'mist', [T.WALL]: 'bone', [T.RIM]: 'slate',
  [T.MARSH]: 'moss', [T.SHALLOW]: 'bogL', [T.BOG]: 'bogD', [T.CHASM]: 'ink', [T.CAVEFLOOR]: 'caveXL', [T.DFLOOR]: 'stone', [T.DWALL]: 'night',
  [T.CAVEWALL]: 'caveD', [T.BRIDGE]: 'wood', [T.MOUTH]: 'ink', [T.LOAM]: 'gloomL', [T.HOUSE]: 'woodD', [T.ASH]: 'ashL', [T.LAVA]: 'lava', [T.BASALT]: 'basalt', [T.SNOW]: 'snowL', [T.ICE]: 'iceL', [T.BLIGHT]: 'slate',
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
      // raised rock is only grassy in the Vale: stone in the south and the fen, basalt in Cinderreach (as the terrain paints it)
      const bm = t === T.PLATEAU && y >= 64 ? biomeAt(x, y) : null;
      const k = bm ? ({ cinder: 'basalt', frost: 'snow', basin: 'hexD' }[bm] || 'stone') : t === T.CLIFF && y >= 208 ? 'frost' : COL[t] || 'ink';
      const [r, g, b] = c(k);
      const i = (y * MAP_W + x) * 4;
      this.base[i] = r; this.base[i + 1] = g; this.base[i + 2] = b; this.base[i + 3] = 255;
    }
    for (const p of world.props) {
      if (p.type !== 'tree' && p.type !== 'deadtree' && p.type !== 'gloomtree' && p.type !== 'snowpine') continue;
      const i = (p.y * MAP_W + p.x) * 4;
      const [r, g, b] = c(p.type === 'tree' ? 'leafD' : p.type === 'gloomtree' ? 'gloomD' : p.type === 'snowpine' ? 'pine' : 'mudD');
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
    // Uploading the whole map to the GPU each time a corner of it is explored
    // cost ~10 ms on the 40x Vast (a 1216 x 2024 canvas), about once a second
    // while walking. So the canvas only redraws the patch that changed, the
    // HUD's minimap gets a small texture of just the window it shows
    // (viewTexture), and the full one is uploaded when the world map opens (syncBig).
    this.box = null; // the explored patch not yet drawn into the canvas
    this.bigStale = false;
    this.viewKey = null;
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
      const b = (this.box ??= { x0: x, y0: y, x1: x, y1: y });
      b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
    }
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const b = this.box; this.box = null;
    this.ctx.putImageData(this.img, 0, 0, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1); // just the patch
    this.bigStale = true; this.viewStale = true;
  }

  // the full map's texture, brought up to date (the world map shows all of it)
  syncBig() { if (this.bigStale) { this.bigStale = false; this.tex.refresh(); } }

  // A small texture of the window (ox, oy, w, h tiles) the HUD's minimap
  // shows, drawn from the canvas only when the window moves or the map
  // changes. Only the area's own tiles are drawn (rect a): the rest stays clear.
  viewTexture(ox, oy, w, h, a) {
    const sc = this.scene;
    if (!this.viewKey || this.vw !== w || this.vh !== h) {
      if (sc.textures.exists('minimapView')) sc.textures.remove('minimapView');
      [this.vcv, this.vctx] = makeCanvas(w, h);
      this.vtex = sc.textures.addCanvas('minimapView', this.vcv);
      this.viewKey = 'minimapView'; this.vw = w; this.vh = h; this.vat = null;
    }
    const at = `${ox},${oy},${a.x0},${a.y0},${a.x1},${a.y1}`;
    if (at !== this.vat || this.viewStale) {
      this.vat = at; this.viewStale = false;
      const x0 = Math.max(ox, a.x0), y0 = Math.max(oy, a.y0), x1 = Math.min(ox + w, a.x1 + 1), y1 = Math.min(oy + h, a.y1 + 1);
      this.vctx.clearRect(0, 0, w, h);
      if (x1 > x0 && y1 > y0) this.vctx.drawImage(this.canvas, x0, y0, x1 - x0, y1 - y0, x0 - ox, y0 - oy, x1 - x0, y1 - y0);
      this.vtex.refresh();
    }
    return this.viewKey;
  }

  isExplored(tx, ty) { return !!this.explored[ty * MAP_W + tx]; }

  // Explored tiles are saved as runs, row by row: alternate lengths of
  // unexplored and explored tiles, in base 36 ("r:" then "4c3.1k.9a..."). What
  // you've seen is a few blobs, so even the 40x Vast fully walked is a few KB,
  // where a bit per tile was 400 KB however little you'd explored.
  serialize() {
    const out = [], n = MAP_W * MAP_H;
    let cur = 0, run = 0;
    for (let i = 0; i < n; i++) {
      if (this.explored[i] === cur) { run++; continue; }
      out.push(run.toString(36)); cur ^= 1; run = 1;
    }
    out.push(run.toString(36));
    return `r:${out.join('.')}`;
  }

  // Saves record the map width they were written at (state.exploredW): the
  // tiles only line up at that width. Older saves predate it (320 wide), and
  // saves before 2026-10-25 hold a base64 bit per tile instead of runs.
  decode(saved) {
    const out = new Uint8Array(MAP_W * MAP_H);
    if (!saved) return out;
    try {
      const w = this.state.exploredW || LEGACY_W;
      const put = (i) => { const x = i % w, y = (i / w) | 0; if (x < MAP_W && y < MAP_H) out[y * MAP_W + x] = 1; };
      if (saved.startsWith('r:')) {
        let i = 0, on = 0;
        for (const r of saved.slice(2).split('.')) { const len = parseInt(r, 36); if (on) for (let k = 0; k < len; k++) put(i + k); i += len; on ^= 1; }
        return out;
      }
      const s = atob(saved);
      const bit = (i) => s.charCodeAt(i >> 3) & (1 << (i & 7));
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < Math.min(w, MAP_W); x++) if (bit(y * w + x)) out[y * MAP_W + x] = 1;
    } catch { /* corrupt -> start fresh */ }
    return out;
  }
}
