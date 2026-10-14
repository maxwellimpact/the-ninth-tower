// Sprite & Sound Lab: previews every generated sprite/animation at large
// scale, plus an audio board for music layers, SFX and voice blips.
import { HEROES, GOBLIN } from '../gfx/heroes.js';
import { buildPuppetFrames, mirrorFrame } from '../gfx/puppet.js';
import { PAL } from '../gfx/palette.js';
import labExtra from './lab-extra.js';

const lab = document.getElementById('lab');
const SCALE = 4;
const sections = [];

function section(title) {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${title}</h2>`;
  lab.appendChild(s);
  return s;
}

function animCell(parent, label, frames, fps, scale = SCALE, dark = false) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const cv = document.createElement('canvas');
  const w = frames[0].width, h = frames[0].height;
  cv.width = w * scale; cv.height = h * scale;
  if (dark) cv.classList.add('dark');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  cell.appendChild(cv);
  const lbl = document.createElement('div');
  lbl.textContent = label;
  cell.appendChild(lbl);
  parent.appendChild(cell);
  const anim = { ctx, frames, fps, scale, w, h, i: 0, t: 0 };
  sections.push(anim);
  return anim;
}

function tick(dt) {
  for (const a of sections) {
    a.t += dt;
    const fi = Math.floor((a.t * a.fps) / 1000) % a.frames.length;
    a.ctx.clearRect(0, 0, a.w * a.scale, a.h * a.scale);
    a.ctx.drawImage(a.frames[fi], 0, 0, a.w * a.scale, a.h * a.scale);
  }
}

const FPS = { idle: 2.5, walk: 8, attack: 10, cast: 7, dodge: 12, hurt: 1, downed: 1, mine: 5, gather: 4 };

export function addPuppetSection(def) {
  const s = section(`${def.name}${def.title ? ' — ' + def.title : ''}`);
  const frames = buildPuppetFrames(def);
  for (const anim of Object.keys(FPS)) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginBottom = '8px';
    const tag = document.createElement('div');
    tag.style.width = '60px';
    tag.style.color = 'var(--muted)';
    tag.textContent = anim;
    row.appendChild(tag);
    for (const v of ['down', 'up', 'side']) animCell(row, v, frames[anim][v], FPS[anim]);
    animCell(row, 'left', frames[anim].side.map(mirrorFrame), FPS[anim]);
    s.appendChild(row);
  }
}

function paletteSection() {
  const s = section('Palette (locked)');
  const row = document.createElement('div');
  row.className = 'row';
  row.style.gap = '4px';
  for (const [k, v] of Object.entries(PAL)) {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = v;
    sw.title = k;
    row.appendChild(sw);
  }
  s.appendChild(row);
}

export const labApi = { section, animCell };

labExtra(labApi);
paletteSection();
HEROES.forEach(addPuppetSection);
addPuppetSection(GOBLIN);

let last = performance.now();
function loop(now) {
  tick(now - last);
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

