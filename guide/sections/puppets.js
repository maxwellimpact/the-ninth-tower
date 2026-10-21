// 02: heroes are puppets built from parts, dressed in gear, then baked.
import heroes from '../../src/data/heroes.json';
import items from '../../src/data/items.json';
import { heroDef } from '../../src/gfx/heroes.js';
import { buildPuppetFrames } from '../../src/gfx/puppet.js';
import { pixelCanvas, mirrored } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const ANIMS = ['idle', 'walk', 'attack', 'cast', 'dodge', 'mine', 'gather', 'hurt', 'downed'];
const RATE = { idle: 2.5, walk: 9, attack: 12, cast: 9, dodge: 14, hurt: 1, downed: 1, mine: 10, gather: 4 }; // the game's rates, a touch slower to read
const VIEWS = [['down', 'Front'], ['side', 'Right'], ['left', 'Left'], ['up', 'Back']];
const SLOTS = [['head', 'Head'], ['body', 'Body'], ['weapon', 'Weapon'], ['offhand', 'Off-hand']];
const S = 5;

export function mount(el) {
  el.innerHTML = `
    <div class="pp-top">
      <div class="seg pp-heroes" role="group" aria-label="Hero"></div>
    </div>
    <div class="pp-grid">
      <div class="stage pp-stage"></div>
      <div class="pp-side">
        <div class="pp-gear"></div>
        <div class="seg pp-anims" role="group" aria-label="Animation"></div>
        <div class="seg pp-views" role="group" aria-label="Facing"></div>
      </div>
    </div>
    <p class="caption">The bake: every frame of every animation, packed into one texture.</p>
    <div class="scroll-x pp-sheet"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .pp-top { margin-bottom: 12px; overflow-x: auto; }
    .pp-heroes { flex-wrap: nowrap; }
    .pp-grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
    .pp-stage { flex: 0 0 auto; width: ${48 * S}px; height: ${48 * S}px; background: radial-gradient(ellipse at 50% 76%, #3d6e3d 0 26%, #2f5d3a 27% 44%, #16121f 72%); }
    .pp-stage canvas { position: absolute; left: 0; top: 0; }
    .pp-side { display: grid; gap: 10px; min-width: 0; flex: 1 1 280px; }
    .pp-gear { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pp-gear label { display: grid; gap: 3px; color: var(--mist); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    .pp-gear select { width: 100%; text-transform: none; letter-spacing: 0; }
    .pp-anims, .pp-views { flex-wrap: wrap; }
    .pp-sheet { margin-top: 8px; background: #0f0c14; border-radius: 6px; padding: 8px; }
    @media (max-width: 560px) { .pp-stage { margin: 0 auto; } }`;
  el.appendChild(css);

  const stage = el.querySelector('.pp-stage'), gear = el.querySelector('.pp-gear'), sheet = el.querySelector('.pp-sheet');
  const [cv, ctx] = pixelCanvas(48, 48, S);
  stage.appendChild(cv);
  const st = { hero: 'brann', equip: { ...heroes[0].equip }, anim: 'attack', view: 'side', frames: null, t: 0 };

  const seg = (box, list, key, after) => {
    box.innerHTML = '';
    for (const [v, label] of list) {
      const b = document.createElement('button'); b.textContent = label;
      b.setAttribute('aria-pressed', st[key] === v);
      b.onclick = () => { st[key] = v; st.t = 0; after?.(); for (const o of box.children) o.setAttribute('aria-pressed', o === b); };
      box.appendChild(b);
    }
  };
  seg(el.querySelector('.pp-heroes'), heroes.map((h) => [h.id, h.name]), 'hero', () => { st.equip = { ...heroes.find((h) => h.id === st.hero).equip }; gearUI(); bake(); });
  seg(el.querySelector('.pp-anims'), ANIMS.map((a) => [a, a[0].toUpperCase() + a.slice(1)]), 'anim');
  seg(el.querySelector('.pp-views'), VIEWS, 'view');

  function gearUI() {
    gear.innerHTML = '';
    for (const [slot, label] of SLOTS) {
      const opts = Object.entries(items).filter(([, it]) => it.hero === st.hero && it.slot === slot);
      const l = document.createElement('label'); l.textContent = label;
      const s = document.createElement('select');
      if (slot === 'head' || slot === 'offhand') s.add(new Option('(none)', ''));
      for (const [id, it] of opts) s.add(new Option(`${it.name[0]}${it.name.slice(1).toLowerCase()} · ${it.rarity}`, id));
      s.value = st.equip[slot] || '';
      s.onchange = () => { st.equip[slot] = s.value || null; bake(); };
      l.appendChild(s); gear.appendChild(l);
    }
  }

  function bake() {
    const t0 = performance.now();
    st.frames = buildPuppetFrames(heroDef(st.hero, st.equip));
    const ms = performance.now() - t0;
    // pack exactly like bake.js: one row per animation, views side by side
    let n = 0;
    const rows = ANIMS.map((a) => { const r = ['down', 'side', 'up'].flatMap((v) => st.frames[a][v]); n += r.length; return r; });
    const cols = Math.max(...rows.map((r) => r.length));
    const sc = 2;
    const [sh, sx] = pixelCanvas(cols * 48, rows.length * 48, sc);
    rows.forEach((r, y) => r.forEach((f, x) => sx.drawImage(f, x * 48, y * 48)));
    sheet.innerHTML = ''; sheet.appendChild(sh);
    const kb = Math.round((48 * 48 * 4 * n) / 1024);
    document.getElementById('bake-stats').textContent = `${n} frames of 48 × 48 (${kb} KB of pixels), baked in ${ms.toFixed(0)} ms.`;
  }

  gearUI();
  bake();
  animate(stage, (dt) => {
    st.t += dt;
    const v = st.view === 'left' ? 'side' : st.view;
    const list = st.frames[st.anim][v];
    const once = !['idle', 'walk', 'mine', 'gather'].includes(st.anim);
    // one-shot animations play, hold a beat, and go again
    const len = list.length / RATE[st.anim];
    const k = once ? Math.min(list.length - 1, Math.floor(((st.t % (len + 0.7)) * RATE[st.anim]))) : Math.floor(st.t * RATE[st.anim]) % list.length;
    let f = list[k];
    if (st.view === 'left') f = mirrored(f);
    ctx.clearRect(0, 0, 48, 48);
    ctx.drawImage(f, 0, 0);
  });
}
