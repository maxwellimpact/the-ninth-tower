// Frame profiler (dev only). In a running game, from the console:
//   const P = await import('/tools/perf.js'); await P.profile()            // here, standing still
//   await P.profile({ walk: true })                                       // walking to somewhere ~60 tiles off
//   await P.tour()                                                        // Aldermere's regions, one profile each
// It steps the game by hand (the browser pane throttles real frames), so the
// numbers are CPU time per frame on this machine, split into logic (every
// scene's update) and drawing (Phaser's render pass), plus the Game scene's
// own methods that cost the most. GPU time isn't included.
const g = () => window.__game;
const pump = async (ms) => { let t = g().loop.now || performance.now(); for (let i = 0; i < ms / 16; i++) { t += 16; g().step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };
const stats = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return { avg: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2), p95: +s[Math.floor(n * 0.95)].toFixed(2), max: +s[n - 1].toFixed(2) }; };

export async function profile({ frames = 600, walk = false, methods = true } = {}) {
  const game = g(), sc = window.__scene;
  await pump(1500); // let anything that just streamed in settle
  if (walk) {
    // somewhere ~60 tiles away that can be reached: a campfire or open ground
    const L = sc.leader, tx = L.x / 16, ty = L.y / 16;
    let goal = null;
    for (let a = 0; a < 16 && !goal; a++) {
      const gx = Math.round(tx + Math.cos(a * 0.4) * 60), gy = Math.round(ty + Math.sin(a * 0.4) * 60);
      const o = sc.nav.nearestOpen(gx, gy, 6);
      if (o && sc.nav.find(L.x, L.y, o[0] * 16 + 8, o[1] * 16 + 8, 40000)) goal = o;
    }
    if (goal) sc.tapWorld(goal[0] * 16 + 8, goal[1] * 16 + 8);
  }
  // time Game's own methods (not getters), unwrapped afterwards
  const tally = {}, wrapped = [];
  if (methods) {
    const proto = Object.getPrototypeOf(sc);
    for (const k of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      if (k === 'constructor' || typeof d.value !== 'function') continue;
      const f = d.value;
      sc[k] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { (tally[k] ??= [0, 0]); tally[k][0] += performance.now() - t; tally[k][1]++; } };
      wrapped.push(k);
    }
  }
  let rs = 0;
  const onPre = () => { rs = performance.now(); }, render = [], total = [];
  const onPost = () => render.push(performance.now() - rs);
  game.events.on('prerender', onPre); game.events.on('postrender', onPost);
  let t = game.loop.now || performance.now();
  const x0 = sc.leader.x, y0 = sc.leader.y;
  for (let i = 0; i < frames; i++) { t += 16; const a = performance.now(); game.step(t, 16); total.push(performance.now() - a); await new Promise((r) => setTimeout(r, 0)); }
  game.events.off('prerender', onPre); game.events.off('postrender', onPost);
  for (const k of wrapped) delete sc[k];
  const logic = total.map((v, i) => v - (render[i] || 0));
  const top = Object.entries(tally).map(([k, [ms, n]]) => ({ fn: k, perFrame: +(ms / frames).toFixed(3), perCall: +(ms / n).toFixed(2), calls: n })).sort((a, b) => b.perFrame - a.perFrame).slice(0, 10);
  return {
    where: `${sc.state.map || 'aldermere'} ${sc.region} @ ${Math.floor(sc.leader.x / 16)},${Math.floor(sc.leader.y / 16)}`,
    walked: Math.round(Math.hypot(sc.leader.x - x0, sc.leader.y - y0) / 16),
    frame: stats(total), logic: stats(logic), render: stats(render),
    objects: sc.children.list.length, uiObjects: game.scene.getScene('UI')?.children.list.length,
    awake: sc.enemies.filter((e) => e.alive).length, chunks: sc.streamer.resident.size,
    top,
  };
}

// Aldermere's regions in turn (warping to each), one profile each
export const SPOTS = { brightwater: [15, 41], meadow: [120, 30], mistfen: [60, 95], gloamwood: [40, 152], cinderreach: [139, 160], frosthelm: [48, 232] };
export async function tour({ frames = 400, walk = true } = {}) {
  const sc = window.__scene, out = {};
  for (const [name, [x, y]] of Object.entries(SPOTS)) {
    sc.warp({ to: { x, y } });
    for (let i = 0; i < 60 && (sc.busy || g().scene.isActive('Loading')); i++) await pump(500);
    for (const h of sc.party) { h.maxHp = 1e6; h.hp = 1e6; } // fights still happen, but nobody is sent home mid-profile
    out[name] = await profile({ frames, walk });
  }
  return out;
}

// Where a frame's time goes on the engine side. A scene's step runs its
// 'update' event (sprite animations, tweens, timers), then its own update(),
// then 'postupdate' (the off-screen cull); listeners added last mark the
// boundaries. Drawing is Phaser's render pass for every scene.
//   await P.engine()
export async function engine({ frames = 400 } = {}) {
  const sc = window.__scene, game = g(), ui = game.scene.getScene('UI');
  await pump(1000);
  const T = {}, add = (k, v) => { T[k] = (T[k] || 0) + v; };
  const marks = {};
  const onPre = () => { marks.pre = performance.now(); }, onUpd = () => { const t = performance.now(); add('anims + tweens + timers (game)', t - marks.pre); marks.upd = t; };
  const onPost = () => add('off-screen cull (game)', performance.now() - marks.logicEnd);
  const sceneUpdate = sc.sys.sceneUpdate, uiUpdate = ui.sys.sceneUpdate, render = game.renderer.render;
  sc.sys.sceneUpdate = function (...a) { const t = performance.now(); try { return sceneUpdate.apply(this, a); } finally { marks.logicEnd = performance.now(); add('Game.update (game logic)', marks.logicEnd - t); } };
  ui.sys.sceneUpdate = function (...a) { const t = performance.now(); try { return uiUpdate.apply(this, a); } finally { add('UI.update (HUD)', performance.now() - t); } };
  game.renderer.render = function (...a) { const t = performance.now(); try { return render.apply(this, a); } finally { add('drawing (all scenes)', performance.now() - t); } };
  sc.events.on('preupdate', onPre); sc.events.on('update', onUpd); sc.events.on('postupdate', onPost);
  let t = game.loop.now || performance.now(), all = 0;
  try {
    for (let i = 0; i < frames; i++) { t += 16; const a = performance.now(); game.step(t, 16); all += performance.now() - a; await new Promise((r) => setTimeout(r, 0)); }
  } finally {
    sc.sys.sceneUpdate = sceneUpdate; ui.sys.sceneUpdate = uiUpdate; game.renderer.render = render;
    sc.events.off('preupdate', onPre); sc.events.off('update', onUpd); sc.events.off('postupdate', onPost);
  }
  const cam = sc.cameras.main.worldView;
  let anims = 0, near = 0, animsOff = 0;
  for (const o of sc.children.list) { const on = cam.contains(o.x, o.y); if (on) near++; if (o.anims?.isPlaying) { anims++; if (!on) animsOff++; } }
  const tw = sc.tweens.getTweens();
  const twOff = tw.filter((x) => x.targets?.every?.((o) => o && typeof o.x === 'number' && !cam.contains(o.x, o.y))).length;
  const known = Object.values(T).reduce((a, b) => a + b, 0);
  T['everything else (Phaser, other scenes)'] = all - known;
  return {
    where: `${sc.state.map || 'aldermere'} ${sc.region}`, frameMs: +(all / frames).toFixed(2),
    objects: sc.children.list.length, onScreen: near, playingAnims: anims, animsOffScreen: animsOff, tweens: tw.length, tweensOffScreen: twOff,
    perFrameMs: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, +(v / frames).toFixed(3)]).sort((a, b) => b[1] - a[1])),
  };
}
