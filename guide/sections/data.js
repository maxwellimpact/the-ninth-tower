// 10: content is data. Sir Oswin's errand, read from quests.json, played
// where it happens in the Vale: his lines typed in the game's font with his
// voice, and the three bells rung at the pitches the game uses.
import Q from '../../src/data/quests.json';
import { FOLK } from '../../src/gfx/heroes.js';
import { buildPuppetFrames } from '../../src/gfx/puppet.js';
import * as QA from '../../src/gfx/questart.js';
import { audio } from '../../src/audio/synth.js';
import { makeScene, drawSorted } from '../lib/scene.js';
import { pixelCanvas, drawText, textWidth } from '../lib/pixels.js';
import { buildFontAtlas } from '../../src/gfx/font.js';
import { animate } from '../lib/loop.js';

const E = Q.errands.bells, OSWIN = Q.npcs.find((n) => n.id === 'oswin');
const PITCH = { low: 0.6, mid: 0.85, high: 1.2 }; // as quests.js rings them
const AREA = { x0: 33 * 16, y0: 14 * 16, w: 23 * 16, h: 13 * 16 };

// syntax-tint a JSON excerpt
const tint = (json) => json.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/("(?:[^"\\]|\\.)*")(\s*:)?/g, (m, s, colon) => (colon ? `<span class="k">${s}</span>${colon}` : `<span class="s">${s}</span>`))
  .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="n">$1</span>');

export async function mount(el) {
  const excerpt = { errand: { title: E.title, giver: E.giver, offer: E.offer, steps: E.steps.map((s) => (s.type === 'bells' ? { type: s.type, text: s.text, order: s.order } : s)), reward: E.reward }, npc: { id: OSWIN.id, name: OSWIN.name, ghost: true, voice: OSWIN.voice } };
  el.innerHTML = `
    <div class="da-grid">
      <div class="stage da-stage"><span class="hint">Talk to Sir Oswin, then ring the bells</span></div>
      <pre class="code da-json">${tint(JSON.stringify(excerpt, null, 1))}</pre>
    </div>
    <div class="controls"><button class="chip primary" data-a="talk">Talk to Sir Oswin</button><label><input type="checkbox" class="da-sound" checked> Voices</label><span class="caption da-cap"></span></div>
    <p class="caption">The whole font: 3 × 5 pixels a letter, drawn in code, outlined in ink. The last two cells together make the ampersand.</p>
    <div class="scroll-x da-font"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .da-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .da-stage canvas { width: 100% !important; height: auto !important; cursor: pointer; }
    .da-json { max-height: 430px; font-size: 12px; }
    .da-font { background: #0f0c14; border-radius: 6px; padding: 10px; margin-top: 6px; }
    @media (max-width: 760px) { .da-grid { grid-template-columns: 1fr; } }`;
  el.appendChild(css);
  const font = buildFontAtlas('white', 'ink');
  const [fc, fx] = pixelCanvas(font.width, font.height, 3); fx.drawImage(font, 0, 0);
  el.querySelector('.da-font').appendChild(fc);

  const stage = el.querySelector('.da-stage'), cap = el.querySelector('.da-cap');
  const scene = await makeScene(AREA.x0, AREA.y0, AREA.w, AREA.h);
  const [cv, ctx] = pixelCanvas(AREA.w, AREA.h, 2);
  stage.prepend(cv);
  // Sir Oswin: a puppet in old armour, washed ghost-blue at 65% (the game tints him 0x9fd8ff)
  const idle = buildPuppetFrames(FOLK.oswin).idle.down.map((f) => {
    const c = document.createElement('canvas'); c.width = f.width; c.height = f.height;
    const x = c.getContext('2d'); x.drawImage(f, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#9fd8ff'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(f, 0, 0); return c;
  });
  const oswin = { x: OSWIN.x * 16 + 8 - AREA.x0, y: OSWIN.y * 16 + 8 - AREA.y0 };
  const bells = E.steps[0].bells.map(([x, y, tone]) => ({ x: x * 16 + 8 - AREA.x0, y: y * 16 + 8 - AREA.y0, tone, rung: 0 }));
  const art = { bell: QA.bell(false), rung: QA.bell(true) };
  const order = E.steps[0].order;
  let rung = [], dlg = null, accepted = false, done = false, t = 0;
  const sound = () => el.querySelector('.da-sound').checked;

  function say(lines, then) { dlg = { lines, i: 0, shown: 0, acc: 0, then }; }
  el.querySelector('[data-a=talk]').onclick = () => {
    audio.init();
    if (done) say(OSWIN.later?.[0]?.lines || OSWIN.lines);
    else if (accepted) say([E.accept]);
    else say([...E.offer, E.accept], () => { accepted = true; cap.textContent = `Step 1 of ${E.steps.length}: ${E.steps[0].text}.`; });
  };
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * AREA.w, y = ((e.clientY - r.top) / r.height) * AREA.h;
    if (dlg) { // tap to hurry the line, or move on
      const L = dlg.lines[dlg.i];
      if (dlg.shown < L.length) dlg.shown = L.length; else if (++dlg.i >= dlg.lines.length) { const th = dlg.then; dlg = null; th?.(); } else { dlg.shown = 0; }
      return;
    }
    if (Math.hypot(x - oswin.x, y - (oswin.y - 12)) < 16) { el.querySelector('[data-a=talk]').click(); return; }
    const b = bells.find((q) => Math.abs(x - q.x) < 12 && y > q.y - 30 && y < q.y + 8);
    if (!b) return;
    audio.init(); audio.sfx('bellTone', { pitch: PITCH[b.tone] }); b.rung = 0.6;
    if (!accepted || done) return;
    rung.push(b.tone);
    if (rung.some((tone, i) => tone !== order[i])) { cap.textContent = 'That sounded wrong. The bells fall quiet: start again.'; rung = []; return; }
    cap.textContent = `${rung.join(', ').toLowerCase()}…`;
    if (rung.length === order.length) { done = true; audio.sfx('levelUp'); cap.textContent = `Errand done: +${E.reward.xp} XP, +${E.reward.sp} skill point.`; say(E.thanks); }
  });

  animate(stage, (dt) => {
    t += dt;
    for (const b of bells) b.rung = Math.max(0, b.rung - dt);
    // dialogue typing: a character every 28 ms, a voice blip every other one (as UI.js does)
    if (dlg && dlg.shown < dlg.lines[dlg.i].length) {
      dlg.acc += dt;
      while (dlg.acc > 0.028 && dlg.shown < dlg.lines[dlg.i].length) {
        dlg.acc -= 0.028; dlg.shown++;
        const ch = dlg.lines[dlg.i][dlg.shown - 1];
        if (sound() && dlg.shown % 2 === 0 && ch !== ' ') audio.sfx('blip', { voice: OSWIN.voice });
      }
    }
    ctx.drawImage(scene.bg, 0, 0);
    const extras = bells.map((b) => ({ y: b.y, draw: () => { const img = b.rung > 0 ? art.rung : art.bell; const sway = b.rung > 0 ? Math.round(Math.sin(t * 30) * 1.5) : 0; ctx.drawImage(img, Math.round(b.x - img.width / 2) + sway, Math.round(b.y + 6 - img.height)); } }));
    extras.push({ y: oswin.y, draw: () => { ctx.globalAlpha = 0.65; const f = idle[Math.floor(t * 2.5) % idle.length]; ctx.drawImage(f, Math.round(oswin.x - 24), Math.round(oswin.y - 36 + Math.sin(t * 2) * 1.5)); ctx.globalAlpha = 1; if (!accepted && !dlg) drawText(ctx, '!', Math.round(oswin.x - 2), Math.round(oswin.y - 44 + Math.sin(t * 4)), { color: 'goldL' }); } });
    drawSorted(ctx, scene, extras, t);
    if (dlg) {
      // the game's dialogue panel
      const w = AREA.w - 24, h = 50, x = 12, y = AREA.h - h - 8;
      ctx.fillStyle = '#1a1423'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#2b2140'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#6e6a87'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
      drawText(ctx, OSWIN.name, x + 6, y + 5, { color: 'goldL' });
      // wrap by words to the box
      const text = dlg.lines[dlg.i].slice(0, dlg.shown), max = Math.floor((w - 12) / 5);
      const words = dlg.lines[dlg.i].split(' '), lines = []; let cur = '';
      for (const wd of words) { const nx = cur ? `${cur} ${wd}` : wd; if (nx.length > max) { lines.push(cur); cur = wd; } else cur = nx; }
      lines.push(cur);
      let used = 0;
      lines.forEach((ln, i) => { const part = text.slice(used, used + ln.length); used += ln.length + 1; drawText(ctx, part, x + 6, y + 16 + i * 8); });
      if (dlg.shown >= dlg.lines[dlg.i].length && Math.floor(t * 3) % 2) drawText(ctx, '>', x + w - 10, y + h - 10, { color: 'goldL' });
      void textWidth;
    }
  });
}
