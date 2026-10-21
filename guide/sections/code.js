// 01: sprites are functions of a seed, on one locked palette.
import * as P from '../../src/gfx/props.js';
import { PAL } from '../../src/gfx/palette.js';
import { pixelCanvas } from '../lib/pixels.js';

const first = (v) => (Array.isArray(v) ? v[0] : v);
const FAMILIES = {
  'Tree': (s) => P.tree(s), 'Gloom tree': (s) => P.gloomTree(s), 'Snow pine': (s) => P.snowPine(s), 'Ash tree': (s) => P.ashTree(s),
  'Dead tree': (s) => P.deadTree(s), 'Rock': (s) => P.rock(s, true), 'Bush': (s) => P.bush(s, s % 2 === 1), 'Mushrooms': (s) => P.mushrooms(s),
};
const SEEDS = 8;
const names = Object.keys(PAL);
const toHex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const byHex = new Map(names.map((k) => [PAL[k].toLowerCase(), k]));

export function mount(el) {
  el.innerHTML = `
    <div class="code-grid">
      <div class="stage code-big"></div>
      <div class="code-side">
        <div class="seg fam" role="group" aria-label="Family"></div>
        <div class="code-thumbs" role="group" aria-label="Seed"></div>
        <div class="controls">
          <button class="chip" data-t="outline" aria-pressed="false">Show the outline</button>
          <button class="chip" data-t="grid" aria-pressed="false">Pixel grid</button>
        </div>
        <p class="caption code-cap"></p>
      </div>
    </div>
    <div class="palette" aria-label="The palette"></div>
    <p class="caption pal-cap"></p>`;
  const css = document.createElement('style');
  css.textContent = `
    .code-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 16px; }
    .code-big { display: grid; place-items: end center; min-height: 330px; padding: 16px; background: radial-gradient(ellipse at 50% 85%, #2b2140 0%, #120e17 70%); }
    .code-side { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
    .fam { flex-wrap: wrap; }
    .fam button { flex: 1 0 auto; }
    .code-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .code-thumbs button { background: #120e17; border: 1px solid var(--night); border-radius: 7px; padding: 6px; display: grid; place-items: end center; height: 86px; cursor: pointer; }
    .code-thumbs button[aria-pressed='true'] { border-color: var(--gold); }
    .code-thumbs canvas { max-height: 72px; }
    .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(18px, 1fr)); gap: 3px; margin-top: 18px; }
    .palette i { aspect-ratio: 1; border-radius: 3px; position: relative; outline: 1px solid rgba(0,0,0,0.3); transition: transform 0.15s, opacity 0.2s; }
    .palette i.used { outline: 2px solid var(--goldL); outline-offset: 1px; z-index: 1; }
    .palette.dim i:not(.used) { opacity: 0.22; }
    @media (max-width: 700px) { .code-grid { grid-template-columns: 1fr; } .code-big { min-height: 260px; } }`;
  el.appendChild(css);

  const big = el.querySelector('.code-big'), thumbs = el.querySelector('.code-thumbs'), fam = el.querySelector('.fam');
  const pal = el.querySelector('.palette');
  const cap = el.querySelector('.code-cap'), palCap = el.querySelector('.pal-cap');
  const sw = names.map((k) => { const i = document.createElement('i'); i.style.background = PAL[k]; i.title = `${k} ${PAL[k]}`; pal.appendChild(i); return i; });
  palCap.textContent = `The whole palette: ${names.length} named colours. The outlined ones are in this sprite.`;
  let family = 'Tree', seed = 3, outline = false, gridOn = false;

  for (const f of Object.keys(FAMILIES)) {
    const b = document.createElement('button'); b.textContent = f;
    b.onclick = () => { family = f; render(); };
    fam.appendChild(b);
  }
  for (const t of el.querySelectorAll('[data-t]')) t.onclick = () => {
    if (t.dataset.t === 'outline') outline = !outline; else gridOn = !gridOn;
    t.setAttribute('aria-pressed', t.dataset.t === 'outline' ? outline : gridOn);
    render();
  };

  function render() {
    for (const b of fam.children) b.setAttribute('aria-pressed', b.textContent === family);
    const make = FAMILIES[family];
    // the seeds, side by side
    thumbs.innerHTML = '';
    for (let s = 0; s < SEEDS; s++) {
      const img = first(make(s));
      const b = document.createElement('button');
      b.setAttribute('aria-pressed', s === seed); b.setAttribute('aria-label', `Seed ${s}`);
      const sc = Math.max(1, Math.min(3, Math.floor(72 / img.height)));
      const [c, x] = pixelCanvas(img.width, img.height, sc); x.drawImage(img, 0, 0);
      b.appendChild(c); b.onclick = () => { seed = s; render(); };
      thumbs.appendChild(b);
    }
    // the chosen one, big
    const img = first(make(seed));
    const S = Math.max(2, Math.min(7, Math.floor(300 / Math.max(img.height, img.width * 0.9))));
    const [c, ctx] = pixelCanvas(img.width * S, img.height * S, 1);
    ctx.drawImage(img, 0, 0, img.width * S, img.height * S);
    const data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    const used = new Map();
    let ink = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      n++;
      const h = toHex(data[i], data[i + 1], data[i + 2]);
      used.set(h, (used.get(h) || 0) + 1);
      if (h === PAL.ink.toLowerCase()) {
        ink++;
        if (outline) { const p = i / 4; ctx.fillStyle = '#f2c14e'; ctx.fillRect((p % img.width) * S, Math.floor(p / img.width) * S, S, S); }
      }
    }
    if (gridOn) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      for (let x = 0; x <= img.width; x++) { ctx.beginPath(); ctx.moveTo(x * S + 0.5, 0); ctx.lineTo(x * S + 0.5, img.height * S); ctx.stroke(); }
      for (let y = 0; y <= img.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * S + 0.5); ctx.lineTo(img.width * S, y * S + 0.5); ctx.stroke(); }
    }
    big.innerHTML = ''; big.appendChild(c);
    const named = [...used.keys()].filter((h) => byHex.has(h));
    sw.forEach((s, i) => s.classList.toggle('used', named.includes(PAL[names[i]].toLowerCase())));
    pal.classList.add('dim');
    cap.innerHTML = `<b>${family.toLowerCase()}, seed ${seed}</b>: ${img.width} × ${img.height} px, ${n} pixels in <b>${named.length}</b> palette colours${outline ? `, ${ink} of them outline` : ''}.`;
  }
  render();
}
