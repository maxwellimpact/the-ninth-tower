import Phaser from 'phaser';
import { Archery } from './scenes/Archery.js';
import { audio } from './audio/synth.js';
import { Boot } from './scenes/Boot.js';
import { Loading } from './scenes/Loading.js';
import { Credits } from './scenes/Credits.js';
import { Title } from './scenes/Title.js';
import { Game } from './scenes/Game.js';
import { UI } from './scenes/UI.js';
import { Menu } from './scenes/Menu.js';
import { WorldMap } from './scenes/WorldMap.js';
import { Shop } from './scenes/Shop.js';
import { Minigame } from './scenes/Minigame.js';
import { FrogRace } from './scenes/FrogRace.js';
import { FxLab } from './scenes/FxLab.js';

// Pixel-perfect integer scaling: pick the integer zoom that gets the view
// closest to ~216px tall, then let the width flex to the screen's aspect.
const BASE_H = 216;
function fit() {
  // the visible area (Safari's visualViewport is right when innerHeight is stale);
  // guard against a 0x0 window (hidden webviews / tabs report this briefly)
  const vv = window.visualViewport;
  const w = Math.round(vv?.width || window.innerWidth) || 800, h = Math.round(vv?.height || window.innerHeight) || 450;
  let zoom = Math.max(1, Math.round(h / BASE_H));
  while (zoom > 1 && w / zoom < 190) zoom--; // portrait phones still get chunky pixels
  // the height is kept even: with an odd height (and roundPixels) WebGL draws
  // everything a pixel low, so row 0 never gets covered and the world shows
  // through the top of every overlay. The spare row is cropped off the bottom.
  const height = Math.ceil(h / zoom);
  return { zoom, width: Math.ceil(w / zoom), height: height + (height % 2) };
}

const f = fit();
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#16121f',
  pixelArt: true,
  roundPixels: true,
  width: f.width,
  height: f.height,
  zoom: f.zoom,
  scale: { mode: Phaser.Scale.NONE },
  input: { activePointers: 2 },
  scene: [Boot, Title, Game, UI, Menu, WorldMap, Shop, Minigame, FrogRace, Archery, FxLab, Loading, Credits],
});

// Phaser stops requesting frames if anything throws inside the loop, which
// looks like a freeze. Keep the loop alive and surface the error instead.
const step = game.step.bind(game);
let lastErr = 0;
game.step = (time, delta) => {
  try { step(time, delta); } catch (e) {
    console.error('[loop]', e);
    (window.__errs ??= []).push(`[loop] ${e.stack?.split('\n').slice(0, 6).join(' | ') || e}`); // test harness sees these too
    if (performance.now() - lastErr > 3000) { lastErr = performance.now(); showError(e); }
  }
};
function showError(e) {
  let el = document.getElementById('err');
  if (!el) {
    el = document.createElement('div');
    el.id = 'err';
    el.style.cssText = 'position:fixed;left:6px;bottom:6px;right:6px;max-height:30vh;overflow:auto;background:rgba(26,20,35,.92);color:#ec6a5e;font:11px/1.3 ui-monospace,monospace;padding:6px;border:1px solid #ec6a5e;z-index:9;white-space:pre-wrap';
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }
  el.textContent = `Something broke (tap to hide). Please screenshot this:\n${e && e.stack ? e.stack.split('\n').slice(0, 8).join('\n') : e}`;
}
window.addEventListener('error', (ev) => showError(ev.error || ev.message));
window.__reportBug = showError; // non-fatal problems the game recovered from, but we want to hear about

// Keep the game the size of the screen. iOS Safari is unreliable here: while its
// toolbars slide in and out, or mid-rotation, it reports an in-between size and
// sometimes never sends a final resize, which left a band of background showing
// until the phone was turned again. So listen to everything it does send,
// measure again once the animation has settled, and check once a second too.
function refit() {
  const n = fit();
  if (n.width < 32 || n.height < 32) return; // mid-animation, iOS can report a sliver (even 0): a zero-sized screen can't be drawn to, so wait for a real size
  if (game.scale.zoom !== n.zoom) game.scale.setZoom(n.zoom);
  if (game.scale.width !== n.width || game.scale.height !== n.height) game.scale.resize(n.width, n.height);
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0); // iOS can leave the page nudged after its toolbar moves
}
const refitSoon = () => { refit(); setTimeout(refit, 120); setTimeout(refit, 500); setTimeout(refit, 1200); };
window.addEventListener('resize', refitSoon);
window.addEventListener('orientationchange', refitSoon);
window.addEventListener('pageshow', refitSoon);
window.visualViewport?.addEventListener('resize', refitSoon);
window.visualViewport?.addEventListener('scroll', () => refit());
document.addEventListener('visibilitychange', () => { if (!document.hidden) refitSoon(); });
setInterval(refit, 1000);
// Safe-area insets (notch, rounded corners, home indicator) in CSS px; the HUD
// keeps its controls inside them.
export function safeInsets() {
  const el = document.getElementById('safe');
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  const v = (k) => parseFloat(cs[k]) || 0;
  return { top: v('paddingTop'), right: v('paddingRight'), bottom: v('paddingBottom'), left: v('paddingLeft') };
}
window.__safeInsets = safeInsets;
window.__game = game;

// Phones play in landscape only. iOS Safari can't lock the orientation (no
// lock API, manifest ignored), so held upright the game pauses behind a
// "turn sideways" card and carries on when the phone is turned back. Where the
// browser does allow a lock (Android, fullscreen), take it as well.
const UPRIGHT = window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 520px)');
const turnCard = document.createElement('div');
turnCard.id = 'turn';
turnCard.innerHTML = '<div class="ph"><i></i></div>TURN YOUR PHONE SIDEWAYS<span>THE NINTH TOWER PLAYS IN LANDSCAPE</span><b>PLAY UPRIGHT ANYWAY</b>';
const turnCss = document.createElement('style');
turnCss.textContent = `
  #turn { position:fixed; inset:0; z-index:20; display:none; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:#16121f; color:#fff0a0; font:bold 14px/1.4 ui-monospace, Menlo, monospace; letter-spacing:.15em; text-align:center; padding:0 24px; }
  #turn span { color:#9d93b3; font-size:11px; letter-spacing:.1em; }
  #turn b { margin-top:28px; color:#6e6a87; font-size:10px; letter-spacing:.1em; padding:10px 14px; border:1px solid #45405e; }
  #turn .ph { width:34px; height:58px; border:4px solid #f2c14e; border-radius:6px; position:relative; animation:turnph 2.4s steps(1) infinite; }
  #turn .ph i { position:absolute; left:50%; bottom:4px; width:8px; height:4px; margin-left:-4px; background:#f2c14e; }
  @keyframes turnph { 0%, 45% { transform:rotate(0); } 50%, 95% { transform:rotate(-90deg); } }
  body.upright #turn { display:flex; }`;
document.head.appendChild(turnCss);
document.body.appendChild(turnCard);
let upright = false, anyway = false;
// escape hatch for a viewer that can't rotate: the portrait layouts still work
turnCard.querySelector('b').addEventListener('click', () => { anyway = true; checkUpright(); });
function checkUpright() {
  const now = UPRIGHT.matches && !anyway;
  if (now === upright) return;
  upright = now;
  document.body.classList.toggle('upright', now);
  // sleep stops the frame loop outright (game.pause only shifts the clock and
  // relies on the browser to stop frames, which it doesn't for a rotation)
  if (now) { if (game.loop.running) game.loop.sleep(); audio.ctx?.suspend(); } else { if (game.loop.started) game.loop.wake(); audio.ctx?.resume(); }
}
UPRIGHT.addEventListener?.('change', checkUpright);
game.events.once('poststep', () => { if (upright) game.loop.sleep(); }); // held upright from the start: sleep once the loop is running
checkUpright();
// a real lock where one exists (needs fullscreen on most browsers; harmless to try on the first tap)
window.addEventListener('pointerdown', () => { screen.orientation?.lock?.('landscape').catch(() => {}); }, { once: true });
