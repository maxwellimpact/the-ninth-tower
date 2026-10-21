// 05: tap to walk. The game's own NavGrid finds the route; a thin subclass
// records what A* looked at and the tile-by-tile route before it was pulled
// straight, so both can be drawn.
import { NavGrid } from '../../src/game/path.js';
import { makeScene, drawSorted, walker } from '../lib/scene.js';
import { navGrid } from '../lib/world.js';
import { pixelCanvas } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const AREA = { x0: 2 * 16, y0: 24 * 16, w: 34 * 16, h: 22 * 16 }; // Brightwater, tiles 2-35 x 24-45
const SPEED = 46;

class Tracer extends NavGrid {
  constructor(nav) { super(nav.w, nav.h); this.solid = nav.solid; }
  trace(sx, sy, gx, gy) {
    // pass 1: no straight lines allowed, so A* runs and the route comes back tile by tile
    const seen = [], seenSet = new Set();
    const isSolid = this.isSolid.bind(this);
    this.isSolid = (x, y) => { const k = y * this.w + x; if (!seenSet.has(k)) { seenSet.add(k); seen.push(k); } return isSolid(x, y); };
    this.lineClear = () => false;
    const raw = this.find(sx, sy, gx, gy, 20000);
    delete this.isSolid; delete this.lineClear;
    // pass 2: the real thing, string-pulled
    const pulled = this.find(sx, sy, gx, gy, 20000);
    return { raw, pulled, seen };
  }
}

export async function mount(el) {
  el.innerHTML = `
    <div class="stage wk-stage"><span class="hint">Tap somewhere to walk there</span></div>
    <div class="controls">
      <button class="chip" data-t="grid" aria-pressed="false">Show what's solid</button>
      <button class="chip" data-t="search" aria-pressed="true">Show the search</button>
      <span class="caption wk-cap"></span>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `.wk-stage canvas { width: 100%; height: auto; cursor: crosshair; } .wk-cap { margin: 0 0 0 auto; }`;
  el.appendChild(css);
  const stage = el.querySelector('.wk-stage'), cap = el.querySelector('.wk-cap');
  const [scene, nav] = await Promise.all([makeScene(AREA.x0, AREA.y0, AREA.w, AREA.h), navGrid()]);
  const tracer = new Tracer(nav);
  const [cv, ctx] = pixelCanvas(AREA.w, AREA.h, 2);
  cv.style.width = '100%'; cv.style.height = 'auto';
  stage.prepend(cv);
  const show = { grid: false, search: true };
  for (const b of el.querySelectorAll('[data-t]')) b.onclick = () => { show[b.dataset.t] = !show[b.dataset.t]; b.setAttribute('aria-pressed', show[b.dataset.t]); };

  const W = (x) => x + AREA.x0, H = (y) => y + AREA.y0; // area px -> world px
  const party = [walker('brann', 13 * 16 + 8 - AREA.x0, 37 * 16 + 8 - AREA.y0), walker('pip', 12 * 16 - AREA.x0, 38 * 16 - AREA.y0), walker('sable', 14 * 16 + 8 - AREA.x0, 38 * 16 + 4 - AREA.y0)];
  party.forEach((h) => { h.path = []; });
  let plan = null, plannedAt = 0;

  const route = (h, gx, gy) => (nav.find(W(h.x), H(h.y), W(gx), H(gy), 8000) || []).map((p) => ({ x: p.x - AREA.x0, y: p.y - AREA.y0 }));
  function go(x, y) {
    const L = party[0];
    plan = tracer.trace(W(L.x), H(L.y), W(x), H(y));
    plannedAt = performance.now();
    plan.goal = { x, y };
    plan.start = [L.x, L.y];
    if (!plan.pulled) { cap.textContent = "No way there: it's walled in or under water."; return; }
    L.path = plan.pulled.map((p) => ({ x: p.x - AREA.x0, y: p.y - AREA.y0 }));
    const tiles = plan.raw ? plan.raw.length : 0;
    cap.textContent = `A* looked at ${plan.seen.length} tiles. ${tiles} tile steps became ${plan.pulled.length} straight line${plan.pulled.length === 1 ? '' : 's'}.`;
  }
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    go(((e.clientX - r.left) / r.width) * AREA.w, ((e.clientY - r.top) / r.height) * AREA.h);
  });
  setTimeout(() => go(27 * 16 + 8 - AREA.x0, 31 * 16 + 8 - AREA.y0), 600);

  let repathT = 0;
  animate(stage, (dt, t) => {
    const L = party[0];
    // the leader walks its waypoints
    const step = (h, speed) => {
      const g = h.path[0];
      if (!g) { h.moving = false; return; }
      const dx = g.x - h.x, dy = g.y - h.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { h.path.shift(); return; }
      const v = Math.min(d, speed * dt);
      h.x += (dx / d) * v; h.y += (dy / d) * v; h.face(dx, dy); h.moving = true;
    };
    step(L, SPEED);
    // the others take spots behind the leader and route there when they fall behind
    repathT -= dt;
    const [fx, fy] = L.view === 'side' ? [L.flip ? 1 : -1, 0] : [0, L.view === 'down' ? -1 : 1];
    party.slice(1).forEach((h, i) => {
      const side = i ? 1 : -1;
      const sx = L.x + fx * 14 + (fy ? side * 10 : 0), sy = L.y + fy * 14 + (fx ? side * 7 : 0);
      const far = Math.hypot(sx - h.x, sy - h.y);
      if (repathT <= 0 && far > 10) h.path = route(h, sx, sy);
      if (far < 4) h.path = [];
      step(h, SPEED * (far > 40 ? 1.25 : 1));
    });
    if (repathT <= 0) repathT = 0.35;
    for (const h of party) h.t += dt;

    ctx.drawImage(scene.bg, 0, 0);
    if (show.grid) {
      for (let ty = 0; ty < AREA.h / 16; ty++) for (let tx = 0; tx < AREA.w / 16; tx++) {
        const v = nav.solid[(ty + AREA.y0 / 16) * nav.w + tx + AREA.x0 / 16];
        if (v) { ctx.fillStyle = v === 2 ? 'rgba(78,154,208,0.45)' : 'rgba(236,106,94,0.4)'; ctx.fillRect(tx * 16, ty * 16, 16, 16); }
      }
    }
    if (plan && show.search) {
      // the search spreads out in the order A* looked, over half a second
      const n = Math.min(plan.seen.length, Math.floor(((performance.now() - plannedAt) / 500) * plan.seen.length));
      ctx.fillStyle = 'rgba(255,240,160,0.13)';
      for (let i = 0; i < n; i++) { const k = plan.seen[i], tx = (k % nav.w) * 16 - AREA.x0, ty = Math.floor(k / nav.w) * 16 - AREA.y0; ctx.fillRect(tx + 1, ty + 1, 14, 14); }
      if (plan.raw && n >= plan.seen.length) {
        ctx.fillStyle = 'rgba(255,240,160,0.75)';
        for (const p of plan.raw) ctx.fillRect(Math.round(p.x - AREA.x0) - 1, Math.round(p.y - AREA.y0) - 1, 2, 2);
      }
    }
    if (plan?.pulled) {
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(...plan.start);
      for (const p of plan.pulled) ctx.lineTo(p.x - AREA.x0, p.y - AREA.y0);
      ctx.stroke();
      ctx.fillStyle = '#fff0a0';
      for (const p of plan.pulled) { ctx.fillRect(Math.round(p.x - AREA.x0) - 2, Math.round(p.y - AREA.y0) - 2, 4, 4); }
    }
    if (plan?.goal) {
      const r = 5 + Math.sin(t * 5) * 1.2;
      ctx.strokeStyle = plan.pulled ? '#fff0a0' : '#ec6a5e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(plan.goal.x, plan.goal.y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawSorted(ctx, scene, party, t);
  });
}
