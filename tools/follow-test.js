// Companion follow smoothness (dev only). On a fresh page:
//   const F = await import('/tools/follow-test.js'); await F.run()
// Drives the leader through set walking patterns in open meadow (no foes)
// and measures how smoothly the two companions follow.
//   twitch: heading reversals/s (moving, then moving back)  - lower is better
//   flips:  facing changes/s                                 - lower is better
//   jerk:   mean change in velocity per frame (px/s)         - lower is better
//   stops:  walk->idle->walk restarts/s                      - lower is better
//   lag:    mean / max distance from the leader (px)         - should stay sane

const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

async function boot() {
  try { window.__game.sound.mute = true; } catch { /* no audio yet */ }
  for (let i = 0; i < 40 && !window.__game.scene.isActive('Title'); i++) await step(30);
  const { newState } = await import('/src/game/state.js');
  localStorage.removeItem('ninthTower.save.v1');
  const st = newState('brann'); st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  st.pos = { x: 84 * 16 + 8, y: 32 * 16 + 8 };
  st.quests = { ambush: { s: 1, n: 0, done: true } }; // keep Quill's set piece out of the test field
  window.__game.scene.getScene('Title').enterWorld(st);
  for (let i = 0; i < 200 && !(window.__scene && !window.__scene.busy && window.__scene.state === st); i++) await step(10);
  await step(20);
  const sc = window.__scene;
  for (const e of sc.enemies) { e.alive = false; e.destroy?.(); } // a quiet field
  sc.enemies = []; sc.groups.forEach((g) => { g.deadT = 1e9; g.active = false; });
  return sc;
}

// leader walking patterns, as held-direction input per frame
const PATTERNS = {
  straight: (f) => [1, 0],
  diagonal: (f) => [1, 1],
  zigzag: (f) => [1, Math.floor(f / 30) % 2 ? 1 : -1],
  circle: (f) => [Math.cos(f / 40), Math.sin(f / 40)],
  stopGo: (f) => (Math.floor(f / 45) % 2 ? [0, 0] : [1, 0.3]),
  wiggle: (f) => [1, Math.sin(f / 6)], // a thumb wobbling on the stick
  turnBack: (f) => (f % 120 < 60 ? [1, 0] : [-1, 0]),
  // phone play: tap a spot, walk the path there (tile paths stair-step)
  tapLong: { taps: [[150, 40], [-60, 90], [130, -70], [-140, -20]], every: 90 },
  tapShort: { taps: [[40, 20], [30, -30], [-20, 40], [50, 10], [-40, -20], [35, 35]], every: 60 },
};

export async function run(only, { reuse = false } = {}) {
  const sc = reuse && window.__scene ? window.__scene : await boot();
  const L = sc.leader, comps = sc.party.filter((h) => !h.isLeader);
  const out = {};
  for (const [name, pat] of Object.entries(PATTERNS)) {
    if (only && !only.includes(name)) continue;
    // reset formation around a clear spot
    L.x = 84 * 16 + 8; L.y = 32 * 16 + 8; comps.forEach((c, i) => { c.x = L.x - 14; c.y = L.y + (i ? 8 : -8); c.clearPath(); c.command = null; });
    await step(30);
    const m = { frames: 0, rev: 0, flips: 0, jerk: 0, stops: 0, lagSum: 0, lagMax: 0 };
    const prev = comps.map((c) => ({ x: c.x, y: c.y, vx: 0, vy: 0, face: `${c.view}${c.flip}`, walking: false, idleT: 0 }));
    const N = 360;
    for (let f = 0; f < N; f++) {
      let dx = 0, dy = 0;
      if (typeof pat === 'function') [dx, dy] = pat(f);
      else if (f % pat.every === 0) { const [tx, ty] = pat.taps[(f / pat.every) % pat.taps.length]; sc.tapWorld(L.x + tx, L.y + ty); }
      // the game reads the keyboard into L.direct each frame; stand in for it
      const k = sc.keys; for (const key of ['A', 'D', 'W', 'S', 'LEFT', 'RIGHT', 'UP', 'DOWN']) k[key].isDown = false;
      if (dx > 0.3) k.D.isDown = true; if (dx < -0.3) k.A.isDown = true; if (dy > 0.3) k.S.isDown = true; if (dy < -0.3) k.W.isDown = true;
      const ui = sc.ui; if (ui.dialogOpen) { ui.clearChoices(); ui.dialogOpen = false; ui.dlgCatch?.disableInteractive(); ui.dlg.setVisible(false); ui.onDone = null; ui.pendingDialog = null; }
      await step(1);
      comps.forEach((c, i) => {
        const p = prev[i], vx = (c.x - p.x) * 60, vy = (c.y - p.y) * 60, sp = Math.hypot(vx, vy);
        m.frames++;
        if (sp > 6 && Math.hypot(p.vx, p.vy) > 6 && vx * p.vx + vy * p.vy < 0) m.rev++;
        m.jerk += Math.hypot(vx - p.vx, vy - p.vy);
        const face = `${c.view}${c.flip}`; if (face !== p.face) m.flips++;
        const walking = sp > 8;
        if (walking && !p.walking && p.idleT > 0 && p.idleT < 0.5) m.stops++; // a short stop then go again
        p.idleT = walking ? 0 : p.idleT + 1 / 60;
        const lag = Math.hypot(c.x - L.x, c.y - L.y); m.lagSum += lag; m.lagMax = Math.max(m.lagMax, lag);
        Object.assign(p, { x: c.x, y: c.y, vx, vy, face, walking });
      });
    }
    const secs = N / 60 * comps.length;
    out[name] = { twitch: +(m.rev / secs).toFixed(2), flips: +(m.flips / secs).toFixed(2), jerk: Math.round(m.jerk / m.frames), stops: +(m.stops / secs).toFixed(2), lag: Math.round(m.lagSum / m.frames), lagMax: Math.round(m.lagMax) };
  }
  const k = sc.keys; for (const key of ['A', 'D', 'W', 'S']) k[key].isDown = false;
  const avg = (key) => +(Object.values(out).reduce((a, r) => a + r[key], 0) / Object.keys(out).length).toFixed(2);
  out.mean = { twitch: avg('twitch'), flips: avg('flips'), jerk: avg('jerk'), stops: avg('stops'), lag: avg('lag') };
  out.errs = (window.__errs || []).slice(0, 3);
  return out;
}
