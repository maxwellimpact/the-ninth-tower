// The guide's copy of the game's terrain worker: it builds the same
// deterministic world, then paints 256px chunks on request. The tile map and
// prop list go to the page once, so it can draw the minimap and route paths.
// The built world is kept in IndexedDB per build of the page, so a second
// visit skips the few seconds of building (the painter only needs the tiles).
import { buildWorld, MAP_W, MAP_H, T } from '../../src/world/map.js';
import { makeTerrainPainter } from '../../src/gfx/terrain.js';

const DB = 'ninth-tower-guide', STORE = 'world';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const get = async (k) => { const db = await idb(); return new Promise((res) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const put = async (k, v) => { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); };

let painter = null;
const queue = [];

async function init(build) {
  const t0 = performance.now();
  let tiles = null, props = null, cached = false, firstMs = 0;
  try { const hit = build !== 'dev' && (await get(build)); if (hit) { ({ tiles, props, firstMs } = hit); cached = true; } } catch { /* no IndexedDB here */ }
  if (!tiles) {
    const w = buildWorld();
    tiles = w.tiles; props = w.props;
    firstMs = performance.now() - t0;
    try { if (build !== 'dev') await put(build, { tiles, props, firstMs }); } catch { /* fine: build again next time */ }
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.CAVEWALL : tiles[y * MAP_W + x]);
  painter = makeTerrainPainter({ tiles, props, at });
  postMessage({ type: 'ready', ms: performance.now() - t0, firstMs, cached, tiles: tiles.slice(), props });
  for (const m of queue.splice(0)) paint(m);
}

function paint(m) {
  const start = performance.now();
  const data = painter.chunkPixels(m.cx, m.cy);
  postMessage({ type: 'chunk', id: m.id, cx: m.cx, cy: m.cy, data, ms: performance.now() - start }, [data.buffer]);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m.build);
  else if (m.type === 'chunk') { if (painter) paint(m); else queue.push(m); }
};
