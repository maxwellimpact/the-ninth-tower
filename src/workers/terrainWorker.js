// Off-main-thread terrain painting. The world builder is deterministic, so
// the worker rebuilds the same map itself and only chunk coordinates cross
// the thread boundary; pixel buffers come back as transferables.
import { buildWorld } from '../world/map.js';
import { makeTerrainPainter } from '../gfx/terrain.js';

const t0 = performance.now();
const painter = makeTerrainPainter(buildWorld());
postMessage({ type: 'ready', ms: performance.now() - t0 });

onmessage = (e) => {
  const m = e.data;
  const start = performance.now();
  if (m.type === 'chunk') {
    const data = painter.chunkPixels(m.cx, m.cy);
    postMessage({ type: 'chunk', id: m.id, cx: m.cx, cy: m.cy, data, ms: performance.now() - start }, [data.buffer]);
  } else if (m.type === 'curse') {
    const data = painter.cursePixels(m.region, m.curse);
    postMessage({ type: 'curse', id: m.id, data, ms: performance.now() - start }, [data.buffer]);
  }
};
