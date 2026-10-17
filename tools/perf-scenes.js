// Standard performance scenes (dev only). Reload first, then:
//   const S = await import('/tools/perf-scenes.js'); await S.run()
// Boots a fixed save and measures frame cost in three
// places: the Brightwater overworld, a fight with 8 goblins, and a dungeon
// room (the Sunken Abbey entrance). Same code paths old and new, so it gives
// before/after numbers.
import { go, step, closeDialog } from './goto.js';

// Light timing: whole frame, render, and each scene's step (no per-method
// wrappers, which inflate the update side). Milliseconds per frame.
async function light(frames, each = null) {
  const game = window.__game, T = { total: 0, render: 0 }, und = [];
  for (const s of game.scene.getScenes(true)) { const sys = s.sys, st = sys.step; sys.step = function (...a) { const t0 = performance.now(); try { return st.apply(this, a); } finally { T[s.scene.key] = (T[s.scene.key] || 0) + performance.now() - t0; } }; und.push(() => { sys.step = st; }); }
  const rr = game.renderer.render; game.renderer.render = function (...a) { const t0 = performance.now(); try { return rr.apply(this, a); } finally { T.render += performance.now() - t0; } }; und.push(() => { game.renderer.render = rr; });
  let t = game.loop.now || performance.now();
  try { for (let f = 0; f < frames; f++) { each?.(); t += 16; const t0 = performance.now(); game.step(t, 16); T.total += performance.now() - t0; await new Promise((r) => setTimeout(r, 0)); } } finally { und.forEach((u) => u()); }
  const out = {}; for (const [k, v] of Object.entries(T)) out[k] = +(v / frames).toFixed(3);
  out.objects = window.__scene.sys.displayList.length;
  return out;
}

export async function run(frames = 300) {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  st.pos = { x: 44 * 16 + 8, y: 30 * 16 + 8 };
  let sc = await go(44, 30, { state: st, level: 8 });
  await step(60); closeDialog();
  const out = {};
  out.overworld = await light(frames);
  const L = sc.leader;
  for (let i = 0; i < 8; i++) { const e = sc.spawnEnemy('goblin', L.x + 40 + (i % 4) * 14, L.y - 20 + Math.floor(i / 4) * 30, true); e.maxHp = e.hp = 99999; }
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await step(30);
  out.fight = await light(frames, () => { if (!sc.leader.command) sc.leader.command = { type: 'attack', target: sc.nearestEnemy(sc.leader, 300) }; });
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  sc = await go(470, 66, { clear: true });
  for (let i = 0; i < 60 && window.__game.scene.isActive('Loading'); i++) await step(10);
  await step(30); closeDialog();
  out.dungeon = await light(frames);
  out.errs = (window.__errs || []).slice(0, 3);
  return out;
}
