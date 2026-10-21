// 08: the curse. The Vale around its Ward Stone, painted for real, then run
// through the palette's curse transform (curseRGB). Breaking the stone sends
// the bloom out, and the Vale's theme crossfades from its minor variant (made
// by the sequencer) to the major one it was written in.
import W from '../../src/data/world.json';
import * as P from '../../src/gfx/props.js';
import { curseRGB } from '../../src/gfx/palette.js';
import { audio } from '../../src/audio/synth.js';
import { music, VALE_THEME } from '../../src/audio/music.js';
import { makeScene, drawSorted } from '../lib/scene.js';
import { pixelCanvas } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const WARD = W.wards.find((w) => w.id === 'vale');
const AREA = { x0: (WARD.x - 15) * 16, y0: (WARD.y - 10) * 16, w: 30 * 16, h: 19 * 16 };

export async function mount(el) {
  el.innerHTML = `
    <div class="stage cu-stage"></div>
    <div class="controls">
      <button class="chip primary" data-a="break">Break the Ward Stone</button>
      <button class="chip" data-a="music" aria-pressed="false">♪ Play the Vale's theme</button>
      <span class="caption cu-cap">The Vale under the curse. The theme plays in its derived minor key.</span>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `.cu-stage canvas { width: 100% !important; height: auto !important; }`;
  el.appendChild(css);
  const stage = el.querySelector('.cu-stage'), cap = el.querySelector('.cu-cap');
  const scene = await makeScene(AREA.x0, AREA.y0, AREA.w, AREA.h);
  // the freed land: terrain plus everything standing on it
  const [freed, fctx] = pixelCanvas(AREA.w, AREA.h, 1);
  fctx.drawImage(scene.bg, 0, 0);
  drawSorted(fctx, scene, [], 0);
  // the cursed land: the same pixels through one colour transform
  const [cursed, cctx] = pixelCanvas(AREA.w, AREA.h, 1);
  const img = fctx.getImageData(0, 0, AREA.w, AREA.h);
  for (let i = 0; i < img.data.length; i += 4) { const [r, g, b] = curseRGB(img.data[i], img.data[i + 1], img.data[i + 2]); img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; }
  cctx.putImageData(img, 0, 0);

  const [cv, ctx] = pixelCanvas(AREA.w, AREA.h, 2);
  stage.appendChild(cv);
  const stone = P.wardStone(), rubble = P.wardRubble();
  const sx = WARD.x * 16 + 8 - AREA.x0, sy = WARD.y * 16 + 8 - AREA.y0;
  let broken = false, bloomT = -1, t = 0, playing = false;
  const R = Math.hypot(AREA.w, AREA.h);

  el.querySelector('[data-a=break]').onclick = (e) => {
    if (!broken) {
      broken = true; bloomT = 0;
      audio.init(); audio.sfx('shatter'); setTimeout(() => audio.sfx('curseLift'), 250);
      if (playing) music.setVariant('freed', 2.5);
      e.target.textContent = 'Put the curse back';
      cap.textContent = 'The bloom spreads from the stone. Same land, same song: the curse was only ever a transform.';
    } else {
      broken = false; bloomT = -1;
      if (playing) music.setVariant('cursed', 1.2);
      e.target.textContent = 'Break the Ward Stone';
      cap.textContent = "The Vale under the curse. The theme plays in its derived minor key.";
    }
  };
  el.querySelector('[data-a=music]').onclick = (e) => {
    playing = !playing;
    e.target.setAttribute('aria-pressed', playing);
    if (playing) { audio.init(); music.state.variant = broken ? 'freed' : 'cursed'; music.state.combat = 0; music.start(VALE_THEME, 0.8); window.dispatchEvent(new CustomEvent('guide-music', { detail: 'curse' })); }
    else music.stop();
  };
  window.addEventListener('guide-music', (e) => { if (e.detail !== 'curse' && playing) { playing = false; el.querySelector('[data-a=music]').setAttribute('aria-pressed', false); } });

  animate(stage, (dt) => {
    t += dt;
    ctx.drawImage(cursed, 0, 0);
    if (broken) {
      bloomT += dt;
      const r = Math.min(R, (bloomT / 2.4) ** 1.3 * R);
      ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(freed, 0, 0); ctx.restore();
      if (r < R) { // the bright edge of the bloom
        ctx.strokeStyle = `rgba(255,240,160,${0.7 * (1 - r / R)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(231,166,255,${0.5 * (1 - r / R)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, r + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if (bloomT < 0.25) { ctx.fillStyle = `rgba(255,240,200,${0.6 * (1 - bloomT / 0.25)})`; ctx.fillRect(0, 0, AREA.w, AREA.h); }
      ctx.drawImage(rubble, Math.round(sx - rubble.width / 2), Math.round(sy + 8 - rubble.height));
    } else {
      const f = stone[Math.floor(t * 5) % stone.length];
      // the stone's curse glow
      const g = ctx.createRadialGradient(sx, sy - 10, 4, sx, sy - 10, 46); g.addColorStop(0, 'rgba(178,76,230,0.35)'); g.addColorStop(1, 'rgba(178,76,230,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 50, sy - 60, 100, 100);
      ctx.drawImage(f, Math.round(sx - f.width / 2), Math.round(sy + 8 - f.height));
    }
  });
}
