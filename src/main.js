import Phaser from 'phaser';
import { Boot } from './scenes/Boot.js';
import { Loading } from './scenes/Loading.js';
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
  // guard against a 0x0 window (hidden webviews / tabs report this briefly)
  const w = window.innerWidth || 800, h = window.innerHeight || 450;
  let zoom = Math.max(1, Math.round(h / BASE_H));
  while (zoom > 1 && w / zoom < 190) zoom--; // portrait phones still get chunky pixels
  return { zoom, width: Math.ceil(w / zoom), height: Math.ceil(h / zoom) };
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
  scene: [Boot, Title, Game, UI, Menu, WorldMap, Shop, Minigame, FrogRace, FxLab, Loading],
});

// Phaser stops requesting frames if anything throws inside the loop, which
// looks like a freeze. Keep the loop alive and surface the error instead.
const step = game.step.bind(game);
let lastErr = 0;
game.step = (time, delta) => {
  try { step(time, delta); } catch (e) {
    console.error('[loop]', e);
    (window.__errs ??= []).push(`[loop] ${e.stack?.split('\n').slice(0, 3).join(' | ') || e}`); // test harness sees these too
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

window.addEventListener('resize', () => {
  const n = fit();
  game.scale.setZoom(n.zoom);
  game.scale.resize(n.width, n.height);
});
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
