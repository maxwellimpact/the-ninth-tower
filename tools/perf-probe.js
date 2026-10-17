// Frame-cost probe (dev only). In a running game:
//   const P = await import('/tools/perf-probe.js'); await P.probe(600)
// Wraps every method of the main game classes with a timer, steps the game
// `frames` times (update + render), and returns per-frame milliseconds:
// total, render, and the methods that cost the most (inclusive time, so a
// parent includes its children). Also counts display objects and tweens.

export async function probe(frames = 600, { scenario = null } = {}) {
  const sc = window.__scene, game = window.__game;
  const U = await import('/src/game/units.js');
  const ui = game.scene.getScene('UI');
  const targets = [
    ['Game', Object.getPrototypeOf(sc)], ['UI', Object.getPrototypeOf(ui)],
    ['Hero', U.Hero.prototype], ['Enemy', U.Enemy.prototype], ['Unit', Object.getPrototypeOf(U.Hero.prototype)],
  ];
  if (sc.minimap) targets.push(['MiniMap', Object.getPrototypeOf(sc.minimap)]);
  if (sc.streamer) targets.push(['Streamer', Object.getPrototypeOf(sc.streamer)]);
  if (sc.quests) targets.push(['Quests', Object.getPrototypeOf(sc.quests)]);
  if (sc.fx) targets.push(['Fx', Object.getPrototypeOf(sc.fx)]);
  const stats = new Map(), undo = [];
  for (const [name, proto] of targets) {
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (k === 'constructor') continue;
      const d = Object.getOwnPropertyDescriptor(proto, k);
      if (!d || typeof d.value !== 'function') continue;
      const fn = d.value, label = `${name}.${k}`;
      proto[k] = function (...a) { const t0 = performance.now(); try { return fn.apply(this, a); } finally { const s = stats.get(label) || { ms: 0, n: 0 }; s.ms += performance.now() - t0; s.n++; stats.set(label, s); } };
      undo.push(() => { proto[k] = fn; });
    }
  }
  // the renderer
  const r = game.renderer, rr = r.render.bind(r); let renderMs = 0;
  r.render = function (...a) { const t0 = performance.now(); try { return rr(...a); } finally { renderMs += performance.now() - t0; } };
  undo.push(() => { r.render = rr; });
  if (scenario) await scenario(sc);
  let total = 0;
  try {
    let t = game.loop.now || performance.now();
    for (let f = 0; f < frames; f++) { t += 16; const t0 = performance.now(); game.step(t, 16); total += performance.now() - t0; await new Promise((res) => setTimeout(res, 0)); } // time the frame itself, not the yield
  } finally { undo.forEach((u) => u()); }
  const per = (ms) => +(ms / frames).toFixed(3);
  const top = [...stats.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 30).map(([k, s]) => [k, per(s.ms), Math.round(s.n / frames)]);
  const count = (s) => s.sys.displayList.list.length;
  return {
    msPerFrame: per(total), renderMs: per(renderMs),
    displayObjects: { game: count(sc), ui: count(ui) }, tweens: sc.tweens.getTweens().length, timers: sc.time.getAllEvents?.().length,
    enemies: sc.enemies.filter((e) => e.alive).length, top,
  };
}
