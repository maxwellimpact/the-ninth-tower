// 13: a campfire under the Tower, to end on.
import * as P from '../../src/gfx/props.js';
import { hash } from '../../src/gfx/pixel.js';
import { heroFrames, mirrored, pixelCanvas } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

export function mount(el) {
  el.innerHTML = '<div class="stage jn-stage"></div><p class="caption">The party at camp, the Ninth Tower on the horizon. Drawn by the same code as everything else here.</p>';
  const css = document.createElement('style');
  css.textContent = '.jn-stage canvas { width: 100% !important; height: auto !important; }';
  el.appendChild(css);
  const W = 200, H = 120;
  const [cv, ctx] = pixelCanvas(W, H, 2);
  el.querySelector('.jn-stage').appendChild(cv);
  const tower = P.ninthTower(), fire = P.campfire();
  const party = [['brann', 'side', false, 70, 96], ['pip', 'side', true, 130, 96], ['wren', 'down', false, 88, 84], ['sable', 'down', false, 113, 85]]
    .map(([id, v, flip, x, y], i) => ({ fr: heroFrames(id).idle[v], flip, x, y, t: i * 0.4 }));
  const stars = Array.from({ length: 46 }, (_, i) => [Math.floor(hash(i, 1, 7) * 200), Math.floor(hash(i, 2, 7) * 56), hash(i, 3, 7)]);
  let t = 0;
  animate(cv, (dt) => {
    t += dt;
    const sky = ctx.createLinearGradient(0, 0, 0, 70); sky.addColorStop(0, '#120e17'); sky.addColorStop(1, '#2b2140');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (const [x, y, p] of stars) { ctx.fillStyle = `rgba(246,242,234,${0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + p * 6))})`; ctx.fillRect(x, y, 1, 1); }
    // the Tower, far off, with its curse glow
    const g = ctx.createRadialGradient(160, 40, 2, 160, 40, 40); g.addColorStop(0, 'rgba(178,76,230,0.35)'); g.addColorStop(1, 'rgba(178,76,230,0)');
    ctx.fillStyle = g; ctx.fillRect(110, 0, 90, 80);
    const s = 0.32;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tower, Math.round(162 - (tower.width * s) / 2), Math.round(68 - tower.height * s), Math.round(tower.width * s), Math.round(tower.height * s));
    // ground
    const gr = ctx.createLinearGradient(0, 64, 0, H); gr.addColorStop(0, '#132c34'); gr.addColorStop(1, '#1f4630');
    ctx.fillStyle = gr; ctx.fillRect(0, 66, W, H - 66);
    ctx.fillStyle = '#1d4448'; for (let x = 0; x < W; x++) if (hash(x, 9, 3) < 0.35) ctx.fillRect(x, 65, 1, 1);
    // firelight
    const fl = 0.85 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.04;
    const lg = ctx.createRadialGradient(100, 94, 4, 100, 94, 60 * fl); lg.addColorStop(0, 'rgba(255,176,80,0.45)'); lg.addColorStop(1, 'rgba(255,176,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(30, 40, 140, 80);
    const list = [...party.map((p) => ({ y: p.y, d: () => { p.t += 0; const f = p.fr[Math.floor((t + p.t) * 2.5) % p.fr.length]; ctx.drawImage(p.flip ? mirrored(f) : f, p.x - 24, p.y - 36); } })),
      { y: 97, d: () => { const f = fire[Math.floor(t * 8) % fire.length]; ctx.drawImage(f, 100 - f.width / 2, 100 - f.height); } }].sort((a, b) => a.y - b.y);
    for (const i of list) i.d();
  });
}
