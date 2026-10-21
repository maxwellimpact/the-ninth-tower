// 04: loading = running the game's real asset tasks (src/game/assets.js),
// time-sliced in 12 ms slices and yielding through a MessageChannel, just as
// the game's loadGroup does. A stand-in for the Phaser scene catches every
// canvas the tasks make, so you can watch them arrive.
import { GROUPS } from '../../src/game/assets.js';

const BUDGET = 12;
const LABEL = { core: 'Core', marsh: 'Mistfen', gloam: 'Gloamwood', cinder: 'Cinderreach', frost: 'Frosthelm', basin: 'The Basin', interior: 'Interiors', cave: 'Caves' };
const CELL = 26;

// a scene that accepts everything and keeps the canvases
function standIn(onCanvas) {
  const noop = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop });
  const tex = {
    addCanvas(k, c) { onCanvas(k, c); return { add() {}, key: k, source: [{ image: c, width: c.width, height: c.height }], get: () => noop }; },
    exists: () => false, remove() {}, get: () => noop, getFrame: () => noop,
  };
  return { textures: tex, anims: { create() {}, exists: () => false, remove() {}, get: () => noop }, cache: { bitmapFont: { add() {} } }, sys: { textures: tex, game: noop }, add: noop, make: noop };
}

const chan = new MessageChannel(), queue = [];
chan.port1.onmessage = () => queue.shift()?.();
const nextTick = (fn) => { queue.push(fn); chan.port2.postMessage(0); };

export function mount(el) {
  el.innerHTML = `
    <div class="ld-groups"></div>
    <div class="ld-now"><span class="ld-task">Ready</span><span class="ld-bar"><i></i></span></div>
    <div class="stage ld-stage"><canvas class="px ld-mosaic"></canvas></div>
    <p class="caption">Each frame: the time spent on asset tasks (bars) against the 12 ms budget (line). The page never freezes.</p>
    <canvas class="ld-frames"></canvas>
    <div class="readout ld-read"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .ld-groups { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .ld-groups button { position: relative; overflow: hidden; }
    .ld-groups button .p { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--gold); }
    .ld-groups button small { color: var(--mist); margin-left: 6px; font-variant-numeric: tabular-nums; }
    .ld-now { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 13px; color: var(--mist); }
    .ld-task { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ld-bar { width: 38%; height: 6px; background: var(--night); border-radius: 3px; overflow: hidden; }
    .ld-bar i { display: block; height: 100%; width: 0; background: var(--gold); }
    .ld-stage { padding: 6px; }
    .ld-mosaic { width: 100%; height: auto; }
    .ld-frames { width: 100%; height: 56px; display: block; margin-top: 4px; }`;
  el.appendChild(css);
  const groupsBox = el.querySelector('.ld-groups'), task = el.querySelector('.ld-task'), bar = el.querySelector('.ld-bar i');
  const mosaic = el.querySelector('.ld-mosaic'), mctx = mosaic.getContext('2d');
  const frames = el.querySelector('.ld-frames'), fctx = frames.getContext('2d');
  const read = el.querySelector('.ld-read');
  const COLS = 24, ROWS = 32;
  mosaic.width = COLS * CELL; mosaic.height = ROWS * CELL;
  mctx.imageSmoothingEnabled = false;
  const state = { canvases: 0, pixels: 0, done: {}, running: null, slices: [], startedAt: 0 };
  const btns = {};

  const clear = () => { mctx.fillStyle = '#0f0c14'; mctx.fillRect(0, 0, mosaic.width, mosaic.height); for (let i = 0; i < COLS * ROWS; i++) { mctx.fillStyle = '#17121f'; mctx.fillRect((i % COLS) * CELL + 1, Math.floor(i / COLS) * CELL + 1, CELL - 2, CELL - 2); } };
  clear();
  const scene = standIn((k, c) => {
    const i = state.canvases++;
    state.pixels += c.width * c.height;
    if (i >= COLS * ROWS) return;
    // a sheet shows its first frame: the leftmost square
    const s = Math.min(c.width, c.height), sw = c.width > c.height * 1.5 ? c.height : c.width;
    const fit = Math.min((CELL - 4) / sw, (CELL - 4) / s);
    const w = sw * fit, h = c.height * fit;
    const x = (i % COLS) * CELL + (CELL - w) / 2, y = Math.floor(i / COLS) * CELL + (CELL - h) / 2;
    mctx.fillStyle = '#231d31'; mctx.fillRect((i % COLS) * CELL + 1, Math.floor(i / COLS) * CELL + 1, CELL - 2, CELL - 2);
    mctx.imageSmoothingEnabled = fit < 1;
    mctx.drawImage(c, 0, 0, sw, c.height, x, y, w, h);
  });

  for (const g of Object.keys(GROUPS)) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = `${LABEL[g] || g}<small></small><span class="p"></span>`;
    b.onclick = () => run(g);
    groupsBox.appendChild(b);
    btns[g] = b;
  }

  // the game's loadGroup, line for line in spirit: run tasks until the slice's
  // budget is spent, then yield and carry on next tick
  function run(name) {
    if (state.running || state.done[name]) return;
    const tasks = GROUPS[name];
    let i = 0;
    const t0 = performance.now();
    state.running = name;
    btns[name].setAttribute('aria-pressed', 'true');
    const step = () => {
      const start = performance.now();
      while (i < tasks.length && performance.now() - start < BUDGET) {
        task.textContent = `${LABEL[name]}: ${tasks[i][0]}`;
        try { tasks[i][1](scene); } catch { /* a Phaser-only step (e.g. registering the font with Phaser) */ }
        i++;
      }
      state.slices.push({ ms: performance.now() - start, at: performance.now() });
      const frac = i / tasks.length;
      bar.style.width = `${frac * 100}%`;
      btns[name].querySelector('.p').style.width = `${frac * 100}%`;
      if (i < tasks.length) nextTick(step);
      else {
        state.done[name] = Math.round(performance.now() - t0);
        btns[name].querySelector('small').textContent = `${state.done[name]} ms`;
        task.textContent = `${LABEL[name]}: ${tasks.length} tasks done in ${state.done[name]} ms`;
        state.running = null;
      }
      draw();
    };
    nextTick(step);
  }

  function draw() {
    const dpr = Math.min(2, devicePixelRatio || 1), W = (frames.width = frames.clientWidth * dpr), H = (frames.height = frames.clientHeight * dpr);
    fctx.fillStyle = '#0f0c14'; fctx.fillRect(0, 0, W, H);
    const list = state.slices.slice(-160), bw = W / 160, max = 24;
    list.forEach((s, i) => { const h = (Math.min(s.ms, max) / max) * H; fctx.fillStyle = s.ms > 16.7 ? '#ec6a5e' : '#73b25a'; fctx.fillRect(i * bw, H - h, Math.max(1, bw - 1), h); });
    const y12 = H - (BUDGET / max) * H;
    fctx.strokeStyle = '#f2c14e'; fctx.setLineDash([6, 5]); fctx.beginPath(); fctx.moveTo(0, y12); fctx.lineTo(W, y12); fctx.stroke(); fctx.setLineDash([]);
    fctx.fillStyle = '#f2c14e'; fctx.font = `${11 * dpr}px Inter, sans-serif`; fctx.fillText('12 ms', 6, y12 - 4);
    const kb = (state.pixels * 4) / 1048576;
    read.innerHTML = `
      <div><div class="k">Canvases made</div><div class="v">${state.canvases}</div></div>
      <div><div class="k">Pixels</div><div class="v">${(state.pixels / 1e6).toFixed(1)}<small>M · ${kb.toFixed(0)} MB</small></div></div>
      <div><div class="k">Slices</div><div class="v">${state.slices.length}</div></div>
      <div><div class="k">Core group</div><div class="v">${state.done.core ? `${state.done.core}<small>ms</small>` : '…'}</div></div>`;
  }
  draw();
  // the core group starts as soon as the section is near (the game runs it behind its first progress bar)
  setTimeout(() => run('core'), 400);
}
