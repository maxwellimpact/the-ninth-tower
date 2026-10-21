// 03: chunk streaming, with the game's own rules (load radius, unload
// radius, a cap, four paints in flight), painting real chunks in a worker.
import { world, paintChunk, stats as wstats } from '../lib/world.js';
import { CHUNK } from '../../src/gfx/terrain.js';
import { OW_W, MAP_H, T } from '../../src/world/map.js';
import { PAL } from '../../src/gfx/palette.js';
import { heroFrames } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const VIEW = { w: 422, h: 196 };            // a phone's view in game pixels (844 × 390 at 2×)
const CAP = 40, INFLIGHT = 4;
const WPX = OW_W * 16, HPX = MAP_H * 16;
const COLS = Math.ceil(WPX / CHUNK), ROWS = Math.ceil(HPX / CHUNK);
// a tour of the regions (tiles), for when nobody's dragging
const TOUR = [[16, 36], [62, 38], [128, 40], [170, 52], [120, 90], [70, 100], [32, 120], [48, 160], [90, 182], [150, 170], [176, 196], [120, 230], [60, 240], [30, 270], [96, 300], [150, 275], [130, 210], [60, 150], [20, 70]];
const TILE_COL = {
  GRASS: 'grass', PATH: 'dirt', SAND: 'sand', WATER: 'water', PLATEAU: 'grassL', CLIFF: 'dirtD', STAIRS: 'stone', PAVED: 'stone', WALL: 'slate', RIM: 'dirtD',
  MARSH: 'moss', SHALLOW: 'bogL', BOG: 'bog', CHASM: 'ink', CAVEFLOOR: 'cave', CAVEWALL: 'caveD', BRIDGE: 'wood', MOUTH: 'ink',
  FLOOR: 'wood', IWALL: 'woodD', HOUSE: 'woodD', DFLOOR: 'slate', DWALL: 'night', LOAM: 'gloom', ASH: 'ash', LAVA: 'lava', BASALT: 'basalt', SNOW: 'snow', ICE: 'ice', BLIGHT: 'hexD',
};

export async function mount(el) {
  el.innerHTML = `
    <div class="stage wd-stage"><canvas class="wd-main"></canvas><canvas class="px wd-mini"></canvas><span class="hint">Drag to move the camera</span></div>
    <div class="readout wd-read"></div>
    <div class="controls">
      <button class="chip" data-a="tour" aria-pressed="true">Tour the regions</button>
      <label>Zoom <input type="range" min="0.18" max="0.6" step="0.01" value="0.32" class="wd-zoom"></label>
      <span class="caption wd-legend"><i style="color:#73b25a">■</i> resident &nbsp; <i style="color:#f2c14e">■</i> painting &nbsp; <i style="color:#ec6a5e">■</i> evicted &nbsp; <span style="color:#fff0a0">- -</span> load radius &nbsp; <span style="color:#ec6a5e">- -</span> unload radius</span>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `
    .wd-stage { height: clamp(360px, 56vw, 600px); cursor: grab; }
    .wd-stage:active { cursor: grabbing; }
    .wd-main { width: 100%; height: 100%; display: block; }
    .wd-mini { position: absolute; right: 10px; top: 10px; border: 1px solid #45405e; border-radius: 4px; background: #120e17; }
    .wd-legend i { font-style: normal; }
    @media (max-width: 700px) { .wd-mini { width: 72px !important; height: 120px !important; } }`;
  el.appendChild(css);
  const stage = el.querySelector('.wd-stage'), cv = el.querySelector('.wd-main'), ctx = cv.getContext('2d');
  const read = el.querySelector('.wd-read');
  read.innerHTML = '<div><div class="k">Building the world</div><div class="v">in a worker…</div></div>';

  const wd = await world();
  // the minimap: one pixel per tile, coloured by terrain
  const mini = el.querySelector('.wd-mini');
  mini.width = OW_W; mini.height = MAP_H; mini.style.width = `${OW_W * 0.6}px`; mini.style.height = `${MAP_H * 0.6}px`;
  const mctx = mini.getContext('2d');
  const names = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k]));
  const img = mctx.createImageData(OW_W, MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < OW_W; x++) {
    const h = PAL[TILE_COL[names[wd.at(x, y)]] || 'ink'];
    const i = (y * OW_W + x) * 4;
    img.data[i] = parseInt(h.slice(1, 3), 16); img.data[i + 1] = parseInt(h.slice(3, 5), 16); img.data[i + 2] = parseInt(h.slice(5, 7), 16); img.data[i + 3] = 255;
  }
  const miniBase = document.createElement('canvas'); miniBase.width = OW_W; miniBase.height = MAP_H;
  miniBase.getContext('2d').putImageData(img, 0, 0);

  const resident = new Map(), pending = new Set(), flash = new Map();
  const st = { painted: 0, evicted: 0, ms: 0, max: 0 };
  const cam = { x: TOUR[0][0] * 16, y: TOUR[0][1] * 16 };
  let tour = true, leg = 1, zoom = 0.32, idleT = 0;
  const brann = heroFrames('brann');

  const dist = (cx, cy) => { const x0 = cx * CHUNK, y0 = cy * CHUNK; return Math.hypot(Math.max(x0 - cam.x, 0, cam.x - (x0 + CHUNK)), Math.max(y0 - cam.y, 0, cam.y - (y0 + CHUNK))); };
  const loadR = Math.hypot(VIEW.w, VIEW.h) * 0.5 + CHUNK, unloadR = loadR + CHUNK * 1.2;

  function stream() {
    const need = [];
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const k = `${cx},${cy}`, d = dist(cx, cy);
      if (d <= loadR && !resident.has(k) && !pending.has(k)) need.push([d, cx, cy, k]);
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cy, k] of need.slice(0, INFLIGHT - pending.size)) {
      pending.add(k);
      paintChunk(cx, cy).then(({ canvas, ms }) => {
        pending.delete(k);
        if (dist(cx, cy) > unloadR) return; // walked away while it was painting
        resident.set(k, { canvas, cx, cy, at: performance.now(), ms });
        st.painted++; st.ms = st.ms ? st.ms * 0.85 + ms * 0.15 : ms; st.max = Math.max(st.max, ms);
      });
    }
    for (const [k, r] of resident) if (dist(r.cx, r.cy) > unloadR) { resident.delete(k); st.evicted++; flash.set(k, performance.now()); }
    if (resident.size > CAP) {
      const far = [...resident.entries()].sort((a, b) => dist(b[1].cx, b[1].cy) - dist(a[1].cx, a[1].cy));
      for (const [k] of far.slice(0, resident.size - CAP)) { resident.delete(k); st.evicted++; flash.set(k, performance.now()); }
    }
  }

  // drag the camera (in world pixels)
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; stage.setPointerCapture(e.pointerId); setTour(false); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; cam.x = clamp(drag.cx - (e.clientX - drag.x) / zoom, 0, WPX); cam.y = clamp(drag.cy - (e.clientY - drag.y) / zoom, 0, HPX); });
  stage.addEventListener('pointerup', () => { drag = null; idleT = 0; });
  const tourBtn = el.querySelector('[data-a=tour]');
  const setTour = (on) => { tour = on; tourBtn.setAttribute('aria-pressed', on); };
  tourBtn.onclick = () => { setTour(!tour); if (tour) leg = nearestLeg(); };
  const nearestLeg = () => { let b = 0, bd = Infinity; TOUR.forEach(([x, y], i) => { const d = Math.hypot(x * 16 - cam.x, y * 16 - cam.y); if (d < bd) { bd = d; b = i; } }); return b; };
  el.querySelector('.wd-zoom').oninput = (e) => { zoom = +e.target.value; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let walkT = 0, face = 'down', flip = false, last = { x: cam.x, y: cam.y };
  animate(stage, (dt) => {
    if (!tour && !drag && (idleT += dt) > 8) { setTour(true); leg = nearestLeg(); }
    if (tour) {
      const [tx, ty] = TOUR[leg], gx = tx * 16, gy = ty * 16, d = Math.hypot(gx - cam.x, gy - cam.y);
      if (d < 8) leg = (leg + 1) % TOUR.length;
      else { const v = Math.min(d, 260 * dt); cam.x += ((gx - cam.x) / d) * v; cam.y += ((gy - cam.y) / d) * v; }
    }
    stream();
    // draw
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const W = cv.width, H = cv.height, z = zoom * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f0c14'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
    ctx.imageSmoothingEnabled = zoom < 0.5;
    const now = performance.now();
    const vx0 = cam.x - W / 2 / z, vy0 = cam.y - H / 2 / z, vx1 = cam.x + W / 2 / z, vy1 = cam.y + H / 2 / z;
    for (let cy = Math.max(0, Math.floor(vy0 / CHUNK)); cy <= Math.min(ROWS - 1, Math.floor(vy1 / CHUNK)); cy++)
      for (let cx = Math.max(0, Math.floor(vx0 / CHUNK)); cx <= Math.min(COLS - 1, Math.floor(vx1 / CHUNK)); cx++) {
        const k = `${cx},${cy}`, rr = resident.get(k), x = cx * CHUNK, y = cy * CHUNK;
        if (rr) {
          ctx.globalAlpha = Math.min(1, (now - rr.at) / 250);
          ctx.drawImage(rr.canvas, x, y);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(115,178,90,0.55)'; ctx.lineWidth = 2 / z; ctx.strokeRect(x + 1 / z, y + 1 / z, CHUNK - 2 / z, CHUNK - 2 / z);
          if (zoom > 0.24) { ctx.fillStyle = 'rgba(15,12,20,0.7)'; ctx.fillRect(x + 4 / z, y + 4 / z, 64 / z, 16 / z); ctx.fillStyle = '#d8d3e0'; ctx.font = `${11 / z}px Inter, sans-serif`; ctx.fillText(`${rr.ms.toFixed(0)} ms`, x + 8 / z, y + 16 / z); }
        } else {
          ctx.strokeStyle = 'rgba(69,64,94,0.5)'; ctx.lineWidth = 1 / z; ctx.strokeRect(x, y, CHUNK, CHUNK);
        }
        if (pending.has(k)) { ctx.fillStyle = `rgba(242,193,78,${0.12 + 0.1 * Math.sin(now / 120)})`; ctx.fillRect(x, y, CHUNK, CHUNK); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2 / z; ctx.strokeRect(x, y, CHUNK, CHUNK); }
        const f = flash.get(k);
        if (f && now - f < 700) { ctx.fillStyle = `rgba(236,106,94,${0.35 * (1 - (now - f) / 700)})`; ctx.fillRect(x, y, CHUNK, CHUNK); ctx.strokeStyle = `rgba(236,106,94,${1 - (now - f) / 700})`; ctx.lineWidth = 2 / z; ctx.strokeRect(x, y, CHUNK, CHUNK); }
      }
    // radii and the phone's view
    ctx.setLineDash([10 / z, 8 / z]); ctx.lineWidth = 2 / z;
    ctx.strokeStyle = 'rgba(255,240,160,0.8)'; ctx.beginPath(); ctx.arc(cam.x, cam.y, loadR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(236,106,94,0.7)'; ctx.beginPath(); ctx.arc(cam.x, cam.y, unloadR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f6f2ea'; ctx.lineWidth = 2.5 / z; ctx.strokeRect(cam.x - VIEW.w / 2, cam.y - VIEW.h / 2, VIEW.w, VIEW.h);
    // the party's leader at the centre of the view
    const mx = cam.x - last.x, my = cam.y - last.y, moving = Math.hypot(mx, my) > 0.2;
    if (moving) { if (Math.abs(mx) > Math.abs(my)) { face = 'side'; flip = mx < 0; } else face = my > 0 ? 'down' : 'up'; }
    last = { x: cam.x, y: cam.y };
    walkT += dt;
    const fr = (moving ? brann.walk : brann.idle)[face], f = fr[Math.floor(walkT * (moving ? 9 : 2.5)) % fr.length];
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.translate(Math.round(cam.x), Math.round(cam.y)); if (face === 'side' && flip) ctx.scale(-1, 1);
    ctx.drawImage(f, -24, -36); ctx.restore();
    // the minimap
    mctx.drawImage(miniBase, 0, 0);
    mctx.strokeStyle = '#fff0a0'; mctx.lineWidth = 1;
    mctx.strokeRect(Math.round(vx0 / 16) + 0.5, Math.round(vy0 / 16) + 0.5, Math.round((vx1 - vx0) / 16), Math.round((vy1 - vy0) / 16));
    // numbers
    const mb = (resident.size * CHUNK * CHUNK * 4) / 1048576;
    read.innerHTML = `
      <div><div class="k">Resident</div><div class="v">${resident.size}<small>/ ${CAP} cap</small></div></div>
      <div><div class="k">Painting</div><div class="v">${pending.size}<small>/ ${INFLIGHT}</small></div></div>
      <div><div class="k">Painted</div><div class="v">${st.painted}</div></div>
      <div><div class="k">Evicted</div><div class="v">${st.evicted}</div></div>
      <div><div class="k">Paint time</div><div class="v">${st.ms.toFixed(0)}<small>ms avg</small></div></div>
      <div><div class="k">Terrain memory</div><div class="v">${mb.toFixed(1)}<small>MB</small></div></div>`;
  });
  void wstats;
}
