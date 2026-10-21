// One shared world for every demo on the page: the tile map, the props and a
// chunk painter running off the main thread (exactly as the game does it).
import { MAP_W, MAP_H, T, SOLID, TILE } from '../../src/world/map.js';
import { CHUNK } from '../../src/gfx/terrain.js';
import { NavGrid } from '../../src/game/path.js';

let ready = null;
const listeners = new Set();
let worker, reqId = 0;
const waiting = new Map();
export const stats = { buildMs: 0, firstMs: 0, cached: false, painted: 0, totalMs: 0, maxMs: 0 };

export function world() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    worker = new Worker(new URL('./world.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'init', build: typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') {
        stats.buildMs = m.ms; stats.firstMs = m.firstMs; stats.cached = m.cached;
        const tiles = m.tiles;
        const at = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]);
        resolve({ tiles, props: m.props, at, buildMs: m.ms });
      } else if (m.type === 'chunk') {
        stats.painted++; stats.totalMs += m.ms; stats.maxMs = Math.max(stats.maxMs, m.ms);
        const cb = waiting.get(m.id); waiting.delete(m.id);
        cb?.(m);
        for (const l of listeners) l(m);
      }
    };
  });
  return ready;
}

// Paint one chunk in the worker. Resolves { canvas, ms }.
export async function paintChunk(cx, cy) {
  await world();
  return new Promise((resolve) => {
    const id = ++reqId;
    waiting.set(id, (m) => {
      const c = document.createElement('canvas');
      c.width = CHUNK; c.height = CHUNK;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.data.buffer), CHUNK, CHUNK), 0, 0);
      resolve({ canvas: c, ms: m.ms });
    });
    worker.postMessage({ type: 'chunk', id, cx, cy });
  });
}

const cache = new Map();
// A painted chunk, kept for reuse by the demos that sit in the same place.
export function chunk(cx, cy) {
  const k = `${cx},${cy}`;
  if (!cache.has(k)) cache.set(k, paintChunk(cx, cy));
  return cache.get(k);
}

// Paint a rectangle of the world (in pixels) from its chunks.
export async function paintArea(x0, y0, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const jobs = [];
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor((y0 + h - 1) / CHUNK); cy++)
    for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor((x0 + w - 1) / CHUNK); cx++)
      jobs.push(chunk(cx, cy).then(({ canvas }) => ctx.drawImage(canvas, cx * CHUNK - x0, cy * CHUNK - y0)));
  await Promise.all(jobs);
  return c;
}

// The game's walking grid: solid tiles, deep water, and props you can't walk through.
export const BLOCKING = new Set(['tree', 'deadtree', 'gloomtree', 'stump', 'ashtree', 'obsidian', 'vent', 'tent', 'snowpine', 'rimeglass', 'snowrock', 'furtent', 'hexcrystal', 'bush', 'rock', 'pillar', 'barrel', 'stalagmite', 'counter', 'table', 'whackboard']);
let nav = null;
export async function navGrid() {
  if (nav) return nav;
  const w = await world();
  nav = new NavGrid(MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = w.at(x, y); if (SOLID.has(t)) nav.block(x, y, t === T.WATER ? 2 : 1); }
  for (const p of w.props) if (BLOCKING.has(p.type)) nav.block(p.x, p.y);
  return nav;
}

export { MAP_W, MAP_H, T, TILE, CHUNK };
