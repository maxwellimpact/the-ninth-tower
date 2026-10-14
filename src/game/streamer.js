// World streaming: terrain chunks are painted in a Web Worker and kept
// resident only near the camera. Props/enemies hook in via onChunkIn/Out.
// Budget: chunks beyond the unload radius are evicted (texture freed), and a
// hard cap evicts the farthest chunks first.
import { CHUNK } from '../gfx/terrain.js';

export class Streamer {
  constructor(scene, { painter, worldW, worldH, onChunkIn, onChunkOut, maxResident = 40 }) {
    this.scene = scene;
    this.painter = painter;
    this.cols = Math.ceil(worldW / CHUNK);
    this.rows = Math.ceil(worldH / CHUNK);
    this.onChunkIn = onChunkIn;
    this.onChunkOut = onChunkOut;
    this.maxResident = maxResident;
    this.resident = new Map();
    this.pending = new Map();
    this.wanted = new Set();
    this.stats = { painted: 0, evicted: 0, lastMs: 0, avgMs: 0, maxMs: 0, worker: false, mainPaints: 0 };
    this.reqId = 0;
    this.callbacks = new Map();
    try {
      this.worker = new Worker(new URL('../workers/terrainWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.onMessage(e.data);
      this.worker.onerror = (e) => { console.warn('[stream] worker failed, painting on main thread', e.message); this.worker = null; this.stats.worker = false; this.pending.clear(); };
      this.stats.worker = true;
    } catch (e) {
      this.worker = null;
    }
  }

  key(cx, cy) { return `${cx},${cy}`; }

  rectDist(cx, cy, fx, fy) {
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const dx = Math.max(x0 - fx, 0, fx - (x0 + CHUNK));
    const dy = Math.max(y0 - fy, 0, fy - (y0 + CHUNK));
    return Math.hypot(dx, dy);
  }

  update(fx, fy, viewW, viewH) {
    const loadR = Math.hypot(viewW, viewH) * 0.5 + CHUNK; // view + one chunk of prefetch
    const unloadR = loadR + CHUNK * 1.2;
    this.focus = { fx, fy, loadR, unloadR };
    const need = [];
    const c0 = Math.max(0, Math.floor((fx - loadR) / CHUNK)), c1 = Math.min(this.cols - 1, Math.floor((fx + loadR) / CHUNK));
    const r0 = Math.max(0, Math.floor((fy - loadR) / CHUNK)), r1 = Math.min(this.rows - 1, Math.floor((fy + loadR) / CHUNK));
    this.wanted.clear();
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const d = this.rectDist(cx, cy, fx, fy);
      if (d > loadR) continue;
      const k = this.key(cx, cy);
      this.wanted.add(k);
      if (!this.resident.has(k) && !this.pending.has(k)) need.push([d, cx, cy]);
    }
    need.sort((a, b) => a[0] - b[0]);
    const inflight = this.pending.size;
    const slots = this.worker ? 4 - inflight : 1;
    for (let i = 0; i < Math.min(slots, need.length); i++) this.request(need[i][1], need[i][2]);

    // evict far chunks, then enforce the residency cap
    for (const [k, r] of this.resident) if (this.rectDist(r.cx, r.cy, fx, fy) > unloadR) this.evict(k);
    if (this.resident.size > this.maxResident) {
      const far = [...this.resident.values()].sort((a, b) => this.rectDist(b.cx, b.cy, fx, fy) - this.rectDist(a.cx, a.cy, fx, fy));
      for (const r of far.slice(0, this.resident.size - this.maxResident)) if (!this.wanted.has(this.key(r.cx, r.cy))) this.evict(this.key(r.cx, r.cy));
    }
  }

  request(cx, cy) {
    const k = this.key(cx, cy);
    this.pending.set(k, performance.now());
    if (this.worker) this.worker.postMessage({ type: 'chunk', id: ++this.reqId, cx, cy });
    else {
      const t0 = performance.now();
      const data = this.painter.chunkPixels(cx, cy);
      this.stats.mainPaints++;
      this.install(cx, cy, data, performance.now() - t0);
    }
  }

  onMessage(m) {
    if (m.type === 'chunk') this.install(m.cx, m.cy, m.data, m.ms);
    else if (m.type === 'curse') { const cb = this.callbacks.get(m.id); this.callbacks.delete(m.id); cb?.(m.data, m.ms); }
  }

  install(cx, cy, data, ms) {
    const k = this.key(cx, cy);
    this.pending.delete(k);
    if (!this.scene.sys.isActive() && !this.scene.sys.isPaused()) return;
    // dropped while in flight?
    if (this.focus && this.rectDist(cx, cy, this.focus.fx, this.focus.fy) > this.focus.unloadR) return;
    if (this.resident.has(k)) return;
    const texKey = `chunk_${k}`;
    if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
    this.scene.textures.addCanvas(texKey, this.painter.toCanvas(data, CHUNK, CHUNK));
    const img = this.scene.add.image(cx * CHUNK, cy * CHUNK, texKey).setOrigin(0).setDepth(-100);
    this.resident.set(k, { cx, cy, img, texKey, at: performance.now() });
    this.stats.painted++;
    this.stats.lastMs = ms;
    this.stats.maxMs = Math.max(this.stats.maxMs, ms);
    this.stats.avgMs = this.stats.avgMs ? this.stats.avgMs * 0.9 + ms * 0.1 : ms;
    this.onChunkIn?.(cx, cy);
  }

  evict(k) {
    const r = this.resident.get(k);
    if (!r) return;
    r.img.destroy();
    this.scene.textures.remove(r.texKey);
    this.resident.delete(k);
    this.stats.evicted++;
    this.onChunkOut?.(r.cx, r.cy);
  }

  // Share of the chunks around the current focus that are painted (0..1).
  wantedProgress() {
    if (!this.wanted.size) return 1;
    let n = 0;
    for (const k of this.wanted) if (this.resident.has(k)) n++;
    return n / this.wanted.size;
  }

  // Are all chunks covering this world rect painted?
  isReady(x, y, w, h) {
    for (let cy = Math.max(0, Math.floor(y / CHUNK)); cy <= Math.min(this.rows - 1, Math.floor((y + h) / CHUNK)); cy++)
      for (let cx = Math.max(0, Math.floor(x / CHUNK)); cx <= Math.min(this.cols - 1, Math.floor((x + w) / CHUNK)); cx++)
        if (!this.resident.has(this.key(cx, cy))) return false;
    return true;
  }

  curse(region, curse) {
    return new Promise((resolve) => {
      if (!this.worker) { resolve(this.painter.toCanvas(this.painter.cursePixels(region, curse), region.w, region.h)); return; }
      const id = ++this.reqId;
      this.callbacks.set(id, (data) => resolve(this.painter.toCanvas(data, region.w, region.h)));
      this.worker.postMessage({ type: 'curse', id, region, curse });
    });
  }

  textureBytes() { return this.resident.size * CHUNK * CHUNK * 4; }

  destroy() {
    this.worker?.terminate();
    for (const k of [...this.resident.keys()]) this.evict(k);
  }
}
