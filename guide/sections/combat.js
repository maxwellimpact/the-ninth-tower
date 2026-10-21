// 06: combat. Two pieces you can poke: the attack-token rule that keeps
// crowds readable (a small re-creation with the game's sprites and numbers),
// and the damage pipeline using the game's own stat and defence functions.
import tuning from '../../src/data/tuning.json';
import heroes from '../../src/data/heroes.json';
import { computeStats, mitigate } from '../../src/game/state.js';
import { heroFrames, goblinFrames, mirrored, pixelCanvas, drawText, textWidth } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const AW = 260, AH = 150;
// the hosted game (the same site serves the guide's sibling repo); its ?demo= links open sandboxes that never save
const GAME = 'https://maxwellimpact.github.io/ninth-tower/';
const WIND = 0.75, STRIKE = 0.18, RECOVER = 0.55; // seconds (the game's windups run about this long)

export function mount(el) {
  el.innerHTML = `
    <div class="cb-live">
      <div class="cb-head"><b>The real thing</b><span class="caption">The game itself, on a test map of its own (a small meadow only this link reaches). Waves keep coming; nothing is saved.</span></div>
      <div class="cb-frame"><button class="chip primary cb-go">▶ Play the combat sandbox</button><p class="caption">Loads the full game (about 2 MB). Tap a foe to attack, swipe to dodge, tap a portrait to switch hero.</p></div>
      <p class="caption cb-more">Also: <a href="${GAME}?demo=boss" target="_blank" rel="noopener">a boss fight</a> (the Gatewarden's Shadow) · <a href="${GAME}?demo=explore" target="_blank" rel="noopener">free roam from Brightwater</a> · <a href="${GAME}?demo=combat" target="_blank" rel="noopener">the sandbox full screen</a></p>
    </div>
    <div class="cb-two"><div>
    <div class="cb-head"><b>Attack tokens</b><span class="caption">Foes take turns: at most this many wind up on a hero at once.</span></div>
    <div class="stage cb-stage"></div>
    <div class="controls">
      <label>Tokens</label><div class="seg cb-tok"></div>
      <label>Foes</label><div class="seg cb-foes"></div>
      <span class="caption cb-now"></span>
    </div>
    </div>
    <div class="cb-calc">
      <div class="cb-head"><b>One hit, step by step</b><span class="caption">The game's own stat and defence code, live.</span></div>
      <div class="controls">
        <select class="cb-hero"></select>
        <label>Level <input type="range" min="1" max="35" value="8" class="cb-lvl"><span class="cb-lvlv">8</span></label>
        <label>Target DEF <input type="range" min="0" max="120" value="20" class="cb-def"><span class="cb-defv">20</span></label>
      </div>
      <div class="controls">
        <button class="chip" data-k="crit" aria-pressed="false">Critical hit</button>
        <div class="seg cb-el"></div>
      </div>
      <div class="cb-steps"></div>
    </div></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .cb-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 10px; color: var(--white); }
    .cb-head .caption { margin: 0; }
    .cb-stage canvas { width: 100% !important; height: auto !important; }
    .cb-calc { min-width: 0; }
    .cb-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--night); }
    .cb-two > div { min-width: 0; }
    .cb-frame { position: relative; aspect-ratio: 844 / 390; max-width: 100%; background: radial-gradient(ellipse at 50% 60%, #2b2140, #0f0c14 75%); border-radius: 8px; overflow: hidden; display: grid; place-content: center; justify-items: center; gap: 8px; text-align: center; padding: 16px; }
    .cb-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .cb-more { margin-top: 8px; }
    @media (max-width: 860px) { .cb-two { grid-template-columns: 1fr; } }
    .cb-steps { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; margin-top: 14px; font-variant-numeric: tabular-nums; }
    .cb-steps div { background: var(--panel); border-radius: 7px; padding: 8px 10px; min-width: 0; }
    .cb-steps .k { color: var(--mist); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .cb-steps .v { color: var(--white); font-weight: 600; }
    .cb-steps .op { background: none; color: var(--stone); align-self: center; padding: 0 2px; }
    .cb-steps .final { background: rgba(242,193,78,0.12); outline: 1px solid rgba(242,193,78,0.5); }
    .cb-steps .final .v { color: var(--goldL); font-size: 20px; }`;
  el.appendChild(css);

  // ---------------------------------------------------------- the live game
  el.querySelector('.cb-go').onclick = () => {
    const box = el.querySelector('.cb-frame');
    box.innerHTML = `<iframe src="${GAME}?demo=combat" title="The Ninth Tower: combat sandbox" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  };

  // ---------------------------------------------------------- the arena
  const stage = el.querySelector('.cb-stage');
  const [cv, ctx] = pixelCanvas(AW, AH, 2);
  stage.appendChild(cv);
  const hero = heroFrames('brann'), gob = goblinFrames();
  const H = { x: AW / 2, y: AH / 2 + 10, flash: 0, t: 0, swing: 0 };
  let tokens = tuning.attackTokens, count = 6, foes = [], floats = [];
  const seg = (box, vals, get, set) => {
    box.innerHTML = '';
    for (const v of vals) { const b = document.createElement('button'); b.textContent = v; b.setAttribute('aria-pressed', get() === v); b.onclick = () => { set(v); for (const o of box.children) o.setAttribute('aria-pressed', o === b); }; box.appendChild(b); }
  };
  seg(el.querySelector('.cb-tok'), [1, 2, 3, 4], () => tokens, (v) => { tokens = v; });
  seg(el.querySelector('.cb-foes'), [3, 6, 9], () => count, (v) => { count = v; spawn(); });
  const now = el.querySelector('.cb-now');

  function spawn() {
    foes = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + 0.3;
      return { a, x: H.x + Math.cos(a) * 110, y: H.y + Math.sin(a) * 60, state: 'wait', t: Math.random() * 1.5, cd: 0.4 + Math.random() * 1.6, f: 0 };
    });
  }
  spawn();

  const float = (x, y, text, color) => floats.push({ x, y, text, color, t: 0 });

  animate(stage, (dt) => {
    H.t += dt; H.flash = Math.max(0, H.flash - dt); H.swing = Math.max(0, H.swing - dt);
    const winding = foes.filter((f) => f.state === 'windup' || f.state === 'strike').length;
    // a waiting foe whose cooldown is up takes a token if one is free
    for (const f of foes) {
      f.t += dt; f.cd -= dt;
      const reach = f.state === 'wait' ? 46 : f.state === 'windup' || f.state === 'strike' ? 26 : 40;
      const tx = H.x + Math.cos(f.a) * reach, ty = H.y + Math.sin(f.a) * reach * 0.62;
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
      f.moving = d > 1;
      if (f.moving) { const v = Math.min(d, 38 * dt); f.x += (dx / d) * v; f.y += (dy / d) * v; }
      if (f.state === 'wait' && f.cd <= 0 && foes.filter((o) => o.state === 'windup' || o.state === 'strike').length < tokens) { f.state = 'windup'; f.t = 0; }
      else if (f.state === 'windup' && f.t > WIND) { f.state = 'strike'; f.t = 0; }
      else if (f.state === 'strike' && f.t > STRIKE) {
        f.state = 'recover'; f.t = 0;
        if (Math.random() < tuning.evade.hero.brann + 0.05) float(H.x, H.y - 30, 'DODGE', 'goldL');
        else { H.flash = 0.12; float(H.x + (Math.random() - 0.5) * 10, H.y - 30, String(8 + Math.floor(Math.random() * 6)), 'white'); }
      } else if (f.state === 'recover' && f.t > RECOVER) { f.state = 'wait'; f.cd = 0.8 + Math.random() * 1.8; }
    }
    // Brann swings back now and then
    if (H.swing <= 0 && Math.random() < dt * 0.7) { H.swing = 0.45; const f = foes[Math.floor(Math.random() * foes.length)]; H.face = f; float(f.x, f.y - 34, Math.random() < 0.15 ? 'CRIT 42' : '24', Math.random() < 0.15 ? 'goldL' : 'white'); }

    // draw
    ctx.fillStyle = '#2f5d3a'; ctx.fillRect(0, 0, AW, AH);
    const g = ctx.createRadialGradient(H.x, H.y, 10, H.x, H.y, 150); g.addColorStop(0, '#4a8a4a'); g.addColorStop(1, '#2f5d3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, AW, AH);
    // the ring of spots around the target
    ctx.strokeStyle = 'rgba(246,242,234,0.15)'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.ellipse(H.x, H.y, 46, 46 * 0.62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // telegraphs: a wedge that fills over the windup
    for (const f of foes) if (f.state === 'windup' || f.state === 'strike') {
      const p = f.state === 'strike' ? 1 : f.t / WIND;
      ctx.strokeStyle = `rgba(236,106,94,${0.35 + p * 0.5})`; ctx.lineWidth = 1 + p * 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y - 6); ctx.lineTo(f.x + (H.x - f.x) * p, f.y - 6 + (H.y - 6 - (f.y - 6)) * p); ctx.stroke();
      if (f.state === 'windup' && Math.floor(f.t * 8) % 2 === 0) drawText(ctx, '!', Math.round(f.x - 2), Math.round(f.y - 40), { color: 'redL' });
      ctx.lineWidth = 1;
    }
    const units = [...foes, H].sort((a, b) => a.y - b.y);
    for (const u of units) {
      ctx.fillStyle = 'rgba(15,10,20,0.3)'; ctx.beginPath(); ctx.ellipse(u.x, u.y, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      if (u === H) {
        const tgt = H.face || foes[0];
        const right = tgt.x >= H.x;
        const list = H.swing > 0 ? hero.attack.side : hero.idle.down;
        let fr = list[H.swing > 0 ? Math.min(list.length - 1, Math.floor((0.45 - H.swing) * 14)) : Math.floor(H.t * 2.5) % list.length];
        if (H.swing > 0 && !right) fr = mirrored(fr);
        if (H.flash > 0) ctx.filter = 'brightness(2.2)';
        ctx.drawImage(fr, Math.round(H.x - 24), Math.round(H.y - 36));
        ctx.filter = 'none';
      } else {
        const left = u.x > H.x;
        const anim = u.state === 'windup' ? gob.attack.side : u.state === 'strike' ? gob.attack.side : u.moving ? gob.walk.side : gob.idle.side;
        const k = u.state === 'windup' ? Math.min(1, Math.floor((u.t / WIND) * 2)) : u.state === 'strike' ? Math.min(anim.length - 1, 2 + Math.floor((u.t / STRIKE) * (anim.length - 2))) : Math.floor(u.t * (u.moving ? 9 : 2.5)) % anim.length;
        let fr = anim[k];
        if (left) fr = mirrored(fr);
        ctx.drawImage(fr, Math.round(u.x - 24), Math.round(u.y - 36));
      }
    }
    // token pips over the hero: filled = a foe is using it
    for (let i = 0; i < tokens; i++) {
      const x = Math.round(H.x - (tokens * 6) / 2 + i * 6), y = Math.round(H.y - 46);
      ctx.fillStyle = '#1a1423'; ctx.fillRect(x, y, 5, 5);
      ctx.fillStyle = i < winding ? '#ec6a5e' : '#45405e'; ctx.fillRect(x + 1, y + 1, 3, 3);
    }
    floats = floats.filter((f) => (f.t += dt) < 0.9);
    for (const f of floats) drawText(ctx, f.text, Math.round(f.x - textWidth(f.text) / 2), Math.round(f.y - f.t * 16), { color: f.color });
    now.textContent = `Winding up now: ${winding} of ${tokens}. Waiting: ${foes.filter((f) => f.state === 'wait').length}.`;
  });

  // ------------------------------------------------------------ the maths
  const heroSel = el.querySelector('.cb-hero');
  for (const h of heroes) heroSel.add(new Option(`${h.name} · ${h.title}`, h.id));
  const st = { crit: false, el: 1 };
  const ELS = [['Neutral', 1], ['Weak to it ×1.5', 1.5], ['Resists ×0.5', 0.5]];
  seg(el.querySelector('.cb-el'), ELS.map((e) => e[0]), () => 'Neutral', (v) => { st.el = ELS.find((e) => e[0] === v)[1]; calc(); });
  el.querySelector('[data-k=crit]').onclick = (e) => { st.crit = !st.crit; e.target.setAttribute('aria-pressed', st.crit); calc(); };
  for (const s of el.querySelectorAll('.cb-calc input, .cb-calc select')) s.oninput = calc;
  const steps = el.querySelector('.cb-steps');
  function calc() {
    const id = heroSel.value, lvl = +el.querySelector('.cb-lvl').value, def = +el.querySelector('.cb-def').value;
    el.querySelector('.cb-lvlv').textContent = lvl; el.querySelector('.cb-defv').textContent = def;
    const s = computeStats(id, lvl, heroes.find((h) => h.id === id).equip);
    const crit = st.crit ? tuning.critMult : 1;
    const raw = s.atk * crit * st.el;
    const k = tuning.defK + 6 * (lvl - 1);
    const out = mitigate(raw, def, lvl);
    const box = (key, v, cls = '') => `<div class="${cls}"><div class="k">${key}</div><div class="v">${v}</div></div>`;
    steps.innerHTML = [
      box('Attack', s.atk), '<div class="op">×</div>', box('Crit', `${crit}`), '<div class="op">×</div>', box('Element', st.el),
      '<div class="op">×</div>', box(`Defence ${k}/(${k}+${def})`, (k / (k + def)).toFixed(2)), '<div class="op">=</div>', box('Damage', Math.round(out), 'final'),
    ].join('');
  }
  calc();
}
