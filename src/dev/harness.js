// Dev-only test harness (imported from the browser console / automation).
// Pumps the game loop manually (hidden tabs freeze RAF) and saves snapshots.
export const errs = (window.__errs ??= []);
if (!window.__harness) {
  window.__harness = true;
  window.addEventListener('error', (e) => errs.push(e.message));
  window.addEventListener('unhandledrejection', (e) => errs.push('rej ' + (e.reason?.stack || e.reason)));
}
// MessageChannel yields aren't throttled in background tabs (setTimeout is).
const yieldNow = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
export const wait = async (ms) => { const end = performance.now() + ms; do { await yieldNow(); } while (performance.now() < end); };
export function pump(ms = 500, step = 16) {
  const g = window.__game;
  let t = g.loop.now || performance.now();
  for (let i = 0; i < ms / step; i++) {
    t += step;
    try { g.step(t, step); } catch (e) { errs.push(e.stack.split('\n').slice(0, 4).join(' | ')); return; }
  }
}
// pump with real-time gaps so worker messages / timeouts get processed
export async function run(ms, chunk = 100) { for (let i = 0; i < ms / chunk; i++) { pump(chunk); await wait(15); } }
export function snap(name) {
  const p = new Promise((res) => window.__game.renderer.snapshot((img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    fetch('/__snap?name=' + name, { method: 'POST', body: c.toDataURL() }).then(() => res([img.width, img.height]));
  }));
  pump(16); // the capture happens during the next render
  return p;
}
export async function newGame(hero = 'brann') {
  const St = await import('../game/state.js');
  const A = await import('../audio/synth.js');
  A.audio.setMuted(true); // automated runs stay silent
  window.__muteTests = true;
  St.clearSave();
  for (let i = 0; i < 60 && !window.__game?.scene.getScene('Title')?.sys.isActive(); i++) { pump(50); await wait(50); }
  window.__game.scene.getScene('Title').scene.start('Game', { state: St.newState(hero) });
  await run(1500);
  return window.__scene;
}
export function tp(x, y) { const S = window.__scene; S.party.forEach((h, i) => { h.x = x * 16 + i * 10; h.y = y * 16 + (i ? 10 : 0); h.clearPath(); h.command = null; }); }
