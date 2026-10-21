// 11: performance. The game's budgets, with the numbers measured live on
// this page where the page can measure them.
import { stats as wstats } from '../lib/world.js';
import { frameStats, animate, demoCount } from '../lib/loop.js';
import { heroFrames } from '../lib/pixels.js';

const CARDS = [
  { k: 'build', title: 'Build the world once, off the main thread', body: 'The 512 × 320 map is generated from noise and a list of roads and landmarks. On this page a worker builds it while the opening scene waits, then keeps a copy for your next visit. (The game currently builds it twice, once per thread: a known cost, parked for now.)' },
  { k: 'paint', title: 'Paint only what’s near', body: 'Terrain is painted per 256 px chunk in a worker, four at a time, nearest first. Chunks beyond the unload radius are freed, and at most 40 exist, so terrain never needs more than about 10 MB.' },
  { k: 'bake', title: 'Bake, don’t pose', body: 'Posing a puppet is too slow for every frame, so each hero is baked into one sheet when their gear changes. In play, a hero costs one sprite draw.' },
  { k: 'slice', title: 'Load in 12 ms slices', body: 'Generators run in slices that leave room for the frame, yielding through a MessageChannel. Region art loads only as the party approaches it.' },
  { k: 'res', title: 'Few pixels, scaled whole', body: 'A phone in landscape shows about 422 × 196 game pixels, scaled up by a whole number so every pixel stays square. Fewer pixels means less to fill each frame.' },
  { k: 'music', title: 'Music scheduled ahead', body: 'The sequencer queues notes 150 ms ahead on a 25 ms timer, so a busy frame never makes the music stumble, and it skips voices in silent layers.' },
  { k: 'cull', title: 'Nothing off screen costs a frame', body: 'Props, sparkles and enemy groups spawn and despawn with their chunks. This page does the same: a demo only animates while you can see it.' },
];

export function mount(el) {
  el.innerHTML = `<div class="pf-grid">${CARDS.map((c) => `<article class="pf-card" data-k="${c.k}"><div class="pf-num"><b>…</b><span></span></div><h3>${c.title}</h3><p>${c.body}</p></article>`).join('')}
    <article class="pf-card pf-live"><div class="pf-num"><b>…</b><span>ms a frame, this page</span></div><canvas class="pf-graph"></canvas><p class="caption">The last four seconds of this page's frames. The line is 16.7 ms (60 fps).</p></article></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .pf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
    .pf-card { background: var(--panel); border-radius: 9px; padding: 16px 16px 14px; min-width: 0; }
    .pf-card h3 { font: 600 15px var(--sans); color: var(--white); margin: 10px 0 6px; }
    .pf-card p { font-size: 14px; color: var(--mist); margin: 0; line-height: 1.55; }
    .pf-num b { font: 650 30px var(--serif); color: var(--goldL); font-variant-numeric: tabular-nums; }
    .pf-num span { color: var(--mist); font-size: 13px; margin-left: 6px; }
    .pf-graph { width: 100%; height: 70px; display: block; margin: 8px 0 6px; background: #0f0c14; border-radius: 5px; }`;
  el.appendChild(css);
  const set = (k, v, unit) => { const c = el.querySelector(`[data-k=${k}] .pf-num`); c.querySelector('b').textContent = v; c.querySelector('span').textContent = unit; };
  set('paint', '…', 'ms a chunk');
  set('slice', '12', 'ms per slice');
  set('res', '422 × 196', 'game pixels');
  set('music', '150', 'ms lookahead');
  const t0 = performance.now(); heroFrames('kesh'); const bake = performance.now() - t0;
  set('bake', bake.toFixed(0), 'ms to bake 81 frames');
  const graph = el.querySelector('.pf-graph'), g = graph.getContext('2d'), live = el.querySelector('.pf-live .pf-num b');

  animate(el, () => {
    set('build', wstats.buildMs ? (wstats.firstMs / 1000).toFixed(1) : '…', !wstats.buildMs ? 'building…' : wstats.cached ? `s to build on your first visit; this time it came from your browser's cache in ${Math.round(wstats.buildMs)} ms` : 's to build, in a worker');
    set('paint', wstats.painted ? (wstats.totalMs / wstats.painted).toFixed(0) : '…', wstats.painted ? `ms a chunk, ${wstats.painted} painted` : 'ms a chunk');
    { const n = demoCount(); set('cull', `${n.on} of ${n.all}`, 'demos animating now'); }
    const d = frameStats.dt, dpr = Math.min(2, devicePixelRatio || 1), W = (graph.width = graph.clientWidth * dpr), H = (graph.height = graph.clientHeight * dpr);
    g.fillStyle = '#0f0c14'; g.fillRect(0, 0, W, H);
    const max = 40, bw = W / 240;
    d.forEach((ms, i) => { const h = (Math.min(ms, max) / max) * H; g.fillStyle = ms > 20 ? '#ec6a5e' : '#73b25a'; g.fillRect(i * bw, H - h, Math.max(1, bw - 0.5), h); });
    const y = H - (16.7 / max) * H; g.strokeStyle = '#f2c14e'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
    const recent = d.slice(-60); live.textContent = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1) : '…';
  });
}
