// Off-main-thread terrain painting. The world builder is deterministic, so
// the worker rebuilds the same map itself and only chunk coordinates cross
// the thread boundary; pixel buffers come back as transferables. The first
// message says which map (Aldermere, or a test map by id) to build.
import { buildWorld, buildMapWorld } from '../world/map.js';
import { makeTerrainPainter } from '../gfx/terrain.js';
import { mapDef } from '../world/content.js';

let painter = null;
const queue = [];

function handle(m) {
  const start = performance.now();
  if (m.type === 'chunk') {
    const data = painter.chunkPixels(m.cx, m.cy);
    postMessage({ type: 'chunk', id: m.id, cx: m.cx, cy: m.cy, data, ms: performance.now() - start }, [data.buffer]);
  } else if (m.type === 'curse') {
    const data = painter.cursePixels(m.region, m.curse);
    postMessage({ type: 'curse', id: m.id, data, ms: performance.now() - start }, [data.buffer]);
  }
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    const t0 = performance.now();
    const def = m.map && mapDef(m.map);
    painter = makeTerrainPainter(def ? buildMapWorld(def) : buildWorld());
    postMessage({ type: 'ready', ms: performance.now() - t0 });
    for (const q of queue.splice(0)) handle(q);
  } else if (painter) handle(m);
  else queue.push(m);
};
