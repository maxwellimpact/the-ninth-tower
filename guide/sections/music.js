// 09: music is data. A region's theme as a piano roll, played by the game's
// own sequencer and synth, with its layers and variants on switches; then
// the sound-effect patches; and a scope on the game's master output.
import * as M from '../../src/audio/music.js';
import { audio } from '../../src/audio/synth.js';
import { animate } from '../lib/loop.js';

const THEMES = [
  ['Brightwater Vale', M.VALE_THEME], ['Highmeadow', M.MEADOW_THEME], ['Mistfen', M.MISTFEN_THEME], ['Gloamwood', M.GLOAMWOOD_THEME],
  ['Cinderreach', M.CINDERREACH_THEME], ['Frosthelm', M.FROSTHELM_THEME], ['The Blight Basin', M.BASIN_THEME], ['The Sunken Abbey', M.ABBEY_THEME],
  ['The Forge of Ash', M.FORGE_THEME], ['The Ninth Tower', M.TOWER_THEME], ['Malgrim', M.MALGRIM_THEME], ['The tavern', M.HEARTH_THEME],
];
const COL = { lead: '#fff0a0', arp: '#5fd4e8', bass: '#6f93e0', pad: '#a070d8', sub: '#3a5fb0', drums: '#ec6a5e', cbass: '#ff7b2e', counter: '#ffd04a', harp: '#73b25a' };
const NAME = { lead: 'lead', arp: 'arpeggio', bass: 'bass', pad: 'pad', sub: 'sub bass', drums: 'drums', cbass: 'driving bass', counter: 'counter-melody', harp: "the Bard's harp" };
const SFX = [['swing', 'Sword swing'], ['hit', 'Hit'], ['crit', 'Critical'], ['dodge', 'Dodge'], ['block', 'Blocked'], ['fireCast', 'Fire cast'], ['frost', 'Frost'], ['zap', 'Storm'], ['heal', 'Heal'], ['coin', 'Coin'], ['chest', 'Chest'], ['levelUp', 'Level up'], ['enemyDie', 'Foe falls'], ['shatter', 'Shatter'], ['curseLift', 'Curse lifts'], ['portalOpen', 'Portal']];

export function mount(el) {
  el.innerHTML = `
    <div class="controls mu-top">
      <button class="chip primary mu-play">▶ Play</button>
      <select class="mu-theme"></select>
      <button class="chip" data-l="combat" aria-pressed="false">Combat layer</button>
      <button class="chip" data-l="cursed" aria-pressed="false">Cursed (minor)</button>
      <button class="chip" data-l="bard" aria-pressed="false">The Bard's harp</button>
    </div>
    <div class="stage mu-roll"><canvas></canvas></div>
    <div class="mu-legend caption"></div>
    <div class="mu-bottom">
      <div><p class="caption">Sound effects are patches: a few lines each of pulse, noise and envelopes.</p><div class="mu-sfx"></div></div>
      <div><p class="caption">The game's master output, right now.</p><canvas class="mu-scope"></canvas></div>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `
    .mu-top { margin: 0 0 12px; }
    .mu-roll { height: 280px; }
    .mu-roll canvas { width: 100%; height: 100%; display: block; }
    .mu-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .mu-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
    .mu-legend .off { opacity: 0.35; }
    .mu-bottom { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 18px; margin-top: 18px; }
    .mu-sfx { display: flex; flex-wrap: wrap; gap: 6px; }
    .mu-scope { width: 100%; height: 120px; display: block; background: #0f0c14; border-radius: 6px; }
    @media (max-width: 760px) { .mu-bottom { grid-template-columns: 1fr; } }`;
  el.appendChild(css);
  const sel = el.querySelector('.mu-theme'), roll = el.querySelector('.mu-roll canvas'), rctx = roll.getContext('2d');
  THEMES.forEach(([n], i) => sel.add(new Option(n, i)));
  let song = THEMES[0][1], playing = false;
  const lay = { combat: false, cursed: false, bard: false };
  const playBtn = el.querySelector('.mu-play');

  const stop = () => { playing = false; music.stop(); playBtn.textContent = '▶ Play'; };
  const music = M.music;
  playBtn.onclick = () => {
    if (playing) { stop(); return; }
    audio.init();
    music.state.variant = lay.cursed ? 'cursed' : 'freed'; music.state.combat = lay.combat ? 1 : 0; music.state.bard = lay.bard;
    music.start(song, 0.3);
    playing = true; playBtn.textContent = '■ Stop';
    window.dispatchEvent(new CustomEvent('guide-music', { detail: 'music' }));
  };
  window.addEventListener('guide-music', (e) => { if (e.detail !== 'music' && playing) { playing = false; playBtn.textContent = '▶ Play'; } });
  sel.onchange = () => { song = THEMES[+sel.value][1]; if (playing) music.setTheme(song); legend(); };
  for (const b of el.querySelectorAll('[data-l]')) b.onclick = () => {
    const k = b.dataset.l; lay[k] = !lay[k]; b.setAttribute('aria-pressed', lay[k]);
    if (k === 'combat') music.setCombat(lay.combat);
    if (k === 'cursed') music.setVariant(lay.cursed ? 'cursed' : 'freed');
    if (k === 'bard') music.setBard(lay.bard);
    legend();
  };
  const sfxBox = el.querySelector('.mu-sfx');
  for (const [k, label] of SFX) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.onclick = () => { audio.init(); audio.sfx(k); }; sfxBox.appendChild(b); }

  const legendBox = el.querySelector('.mu-legend');
  const on = (tr) => tr.layer === 'base' || (tr.layer === 'combat' && lay.combat) || (tr.layer === 'bard' && lay.bard);
  function legend() {
    legendBox.innerHTML = song.tracks.map((tr) => `<span class="${on(tr) ? '' : 'off'}"><i style="background:${COL[tr.inst] || '#a3a1b9'}"></i>${NAME[tr.inst] || tr.inst} <small>(${tr.layer})</small></span>`).join('');
  }
  legend();

  // a scope on the master bus (made once the audio starts)
  let analyser = null, buf = null;
  const scope = el.querySelector('.mu-scope'), sctx = scope.getContext('2d');
  const toMinor = (m) => ([4, 9, 11].includes(((m % 12) + 12) % 12) ? m - 1 : m); // as the sequencer does it

  animate(el, () => {
    if (!analyser && audio.ctx) { analyser = audio.ctx.createAnalyser(); analyser.fftSize = 1024; audio.master.connect(analyser); buf = new Uint8Array(analyser.fftSize); }
    // the roll
    const dpr = Math.min(2, devicePixelRatio || 1), Wd = roll.clientWidth * dpr, Hd = roll.clientHeight * dpr;
    if (roll.width !== Wd) { roll.width = Wd; roll.height = Hd; }
    rctx.fillStyle = '#0f0c14'; rctx.fillRect(0, 0, Wd, Hd);
    const notes = [];
    for (const tr of song.tracks) if (tr.inst !== 'drums') for (const e of tr.events) for (const m of [].concat(e[1])) notes.push(m);
    const lo = Math.min(...notes) - 1, hi = Math.max(...notes) + 1;
    const sx = Wd / song.steps, sy = (Hd - 30 * dpr) / (hi - lo + 1);
    for (let b = 0; b <= song.steps / 16; b++) { rctx.fillStyle = b % 4 ? 'rgba(69,64,94,0.35)' : 'rgba(110,106,135,0.6)'; rctx.fillRect(b * 16 * sx, 0, 1, Hd); }
    for (const tr of song.tracks) {
      const vis = on(tr);
      rctx.globalAlpha = vis ? 0.95 : 0.14;
      rctx.fillStyle = COL[tr.inst] || '#a3a1b9';
      if (tr.inst === 'drums') { for (const e of tr.events) { const row = { kick: 0, snare: 1, hat: 2 }[e[1]] ?? 2; rctx.fillRect(e[0] * sx + 1, Hd - (8 + row * 8) * dpr, Math.max(2, sx - 2), 5 * dpr); } continue; }
      for (const e of tr.events) for (const m0 of [].concat(e[1])) {
        const m = lay.cursed ? toMinor(m0) : m0;
        rctx.fillRect(e[0] * sx + 1, (Hd - 30 * dpr) - (m - lo + 1) * sy, Math.max(2, e[2] * sx - 2), Math.max(2, sy - 1));
      }
    }
    rctx.globalAlpha = 1;
    // the playhead: the step you're hearing (the sequencer runs a little ahead)
    if (playing && music.song === song && audio.ctx) {
      const ahead = Math.max(0, Math.round((music.nextTime - audio.ctx.currentTime) / music.stepDur));
      const s = (music.step - ahead + song.steps) % song.steps;
      rctx.fillStyle = 'rgba(255,240,160,0.9)'; rctx.fillRect(s * sx, 0, 2 * dpr, Hd);
    }
    // the scope
    const sw = scope.clientWidth * dpr, sh = scope.clientHeight * dpr;
    if (scope.width !== sw) { scope.width = sw; scope.height = sh; }
    sctx.fillStyle = '#0f0c14'; sctx.fillRect(0, 0, sw, sh);
    sctx.strokeStyle = 'rgba(69,64,94,0.8)'; sctx.beginPath(); sctx.moveTo(0, sh / 2); sctx.lineTo(sw, sh / 2); sctx.stroke();
    if (analyser) {
      analyser.getByteTimeDomainData(buf);
      sctx.strokeStyle = '#f2c14e'; sctx.lineWidth = 1.5 * dpr; sctx.beginPath();
      for (let i = 0; i < buf.length; i++) { const x = (i / buf.length) * sw, y = (buf[i] / 255) * sh; i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }
      sctx.stroke();
    }
  });
}
