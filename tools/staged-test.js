// Staged set-piece test (dev only): Quill's ambush, before you accept.
//   const T = await import('/tools/staged-test.js'); await T.run();
// Boots a fresh game, walks the party up to Quill, declines the offer, then
// records every frame of the raiders while the party idles nearby, walks
// through them, and fights a stray foe next to them. Measures how calm the
// "fake attack" is and whether anything pulls them off Quill early.

const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

async function boot() {
  try { window.__game.sound.mute = true; } catch { /* no audio yet */ }
  for (let i = 0; i < 40 && !window.__game.scene.isActive('Title'); i++) await step(30);
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann'); st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  for (const h of st.recruited) st.heroes[h].level = 4;
  st.pos = { x: 94 * 16 + 8, y: 33 * 16 + 8 };
  st.demo = 'test'; // a test game never saves (never-again rule 15)
  window.__game.scene.getScene('Title').enterWorld(st);
  for (let i = 0; i < 200 && !(window.__scene && !window.__scene.busy && window.__scene.state === st); i++) await step(10);
  await step(20);
  return window.__scene;
}

const closeDialog = (ui) => { ui.clearChoices(); ui.dialogOpen = false; ui.dlgCatch?.disableInteractive(); ui.dlg.setVisible(false); ui.onDone = null; };

// one phase: record n frames while `act(frame)` drives the party
async function record(sc, us, npc, n, act) {
  const prev = us.map((u) => ({ x: u.x, y: u.y, vx: 0, vy: 0, face: null }));
  const m = { frames: 0, moved: 0, reversals: 0, faceFlips: 0, facingNpc: 0, facingHero: 0, offStage: 0, engaged: 0, speedSum: 0 };
  for (let f = 0; f < n; f++) {
    act?.(f);
    await step(1);
    us.forEach((u, i) => {
      if (!u.alive) return;
      const p = prev[i], vx = u.x - p.x, vy = u.y - p.y, sp = Math.hypot(vx, vy);
      m.frames++; m.speedSum += sp;
      if (sp > 0.05) m.moved++;
      // a reversal: moving, and against last frame's motion (the twitch)
      if (sp > 0.05 && Math.hypot(p.vx, p.vy) > 0.05 && vx * p.vx + vy * p.vy < 0) m.reversals++;
      const face = `${u.view}${u.flip ? 'L' : 'R'}`;
      if (p.face && face !== p.face) m.faceFlips++;
      // which way is it looking: at Quill or at the nearest hero?
      const fx = u.view === 'side' ? (u.flip ? -1 : 1) : 0, fy = u.view === 'down' ? 1 : u.view === 'up' ? -1 : 0;
      const dot = (tx, ty) => { const d = Math.hypot(tx - u.x, ty - u.y) || 1; return ((tx - u.x) * fx + (ty - u.y) * fy) / d; };
      const h = sc.party.filter((q) => !q.downed).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (dot(npc.px, npc.py) > 0.5) m.facingNpc++;
      else if (h && dot(h.x, h.y) > 0.5) m.facingHero++;
      if (Math.hypot(u.x - npc.px, u.y - npc.py) > 70) m.offStage++;
      if (!u.staged) m.engaged++;
      Object.assign(p, { x: u.x, y: u.y, vx, vy, face });
    });
  }
  const r = (k) => +(m[k] / Math.max(1, m.frames)).toFixed(3);
  return { reversalsPerSec: +(m.reversals / (n / 60)).toFixed(2), faceFlipsPerSec: +(m.faceFlips / (n / 60)).toFixed(2), moving: r('moved'), facingNpc: r('facingNpc'), facingHero: r('facingHero'), offStage: r('offStage'), engagedEarly: r('engaged'), avgSpeed: +(m.speedSum / Math.max(1, m.frames)).toFixed(2) };
}

// One phase per fresh page load, so a wake-up in one phase can't spoil the
// next. Phases: idleNear, standAmong, walkThrough, tapQuill, fightNearby, accept.
//   location.reload(); then: const T = await import('/tools/staged-test.js'); await T.run('idleNear')
export async function run(phase) {
  const sc = await boot();
  const L = sc.leader;
  // walk up to trigger the meeting, then say NOT NOW
  for (let i = 0; i < 60 && !sc.ui.dialogOpen; i++) { L.x += 3; await step(2); }
  const us = sc.quests.staged.ambush;
  const npc = sc.quests.npcs.find((n) => n.id === 'quill');
  if (!us?.length) return { error: 'no staged raiders', at: [L.x / 16, L.y / 16] };
  closeDialog(sc.ui);
  // note what wakes them early (for the report)
  const woke = [];
  for (const k of ['start', 'engageStaged']) { const f = sc.quests[k].bind(sc.quests); sc.quests[k] = (...a) => { if (phase !== 'accept' && woke.length < 2) woke.push(`${k} < ${new Error().stack.split('\n').slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(/\(.*\/src\//, '(')).join(' < ')}`); return f(...a); }; }
  await step(30);
  const goTo = (x, y) => sc.tapWorld(x, y);
  let out;
  if (phase === 'idleNear') out = await record(sc, us, npc, 600, (f) => { if (f === 0) goTo(npc.px - 56, npc.py); });
  if (phase === 'standAmong') out = await record(sc, us, npc, 600, (f) => { if (f === 0) goTo(npc.px + 6, npc.py + 30); if (f === 90) goTo(npc.px - 4, npc.py + 20); });
  if (phase === 'walkThrough') out = await record(sc, us, npc, 600, (f) => { if (f % 60 === 0) { const a = f / 60; goTo(npc.px + Math.cos(a) * 30, npc.py + Math.sin(a) * 22); } });
  if (phase === 'fightNearby') {
    const stray = sc.spawnEnemy('boar', npc.px - 40, npc.py + 30, true);
    out = await record(sc, us, npc, 480, () => {});
    if (stray.alive) stray.damage(99999, L);
  }
  if (phase === 'tapQuill') {
    // tap Quill to talk, ten times, as the raiders move around him: each
    // should open his dialogue, never start the fight
    let talks = 0, wokeByTap = 0;
    for (let i = 0; i < 10; i++) {
      await step(37);
      sc.tapWorld(npc.px + (Math.random() * 8 - 4), npc.py - 10 + (Math.random() * 8 - 4));
      const cmd = sc.leader.command?.type || 'none';
      for (let f = 0; f < 300 && !sc.ui.dialogOpen && us.every((u) => !u.alive || u.staged); f++) await step(1);
      (out ??= { taps: [] }).taps.push(cmd + (sc.ui.dialogOpen ? ':talk' : ''));
      if (us.some((u) => u.alive && !u.staged)) { wokeByTap++; break; }
      if (sc.ui.dialogOpen) { talks++; closeDialog(sc.ui); sc.leader.command = null; }
      await step(10);
    }
    out = { talks, wokeByTap, taps: out?.taps };
  }
  if (phase === 'accept') {
    // accept: they should all turn on the party at once
    sc.quests.start('ambush');
    await step(60);
    out = { engaged: us.filter((u) => u.alive && !u.staged).length, targetingParty: us.filter((u) => u.alive && sc.party.includes(u.target)).length, of: us.length };
  }
  // world foes that wandered into the scene (not the errand's, not the test's boar)
  const intruders = sc.enemies.filter((e) => e.alive && !us.includes(e) && e.kind !== 'boar' && Math.hypot(e.x - npc.px, e.y - npc.py) < 220).map((e) => e.kind);
  return { phase, ...out, intruders, woke, errs: (window.__errs || []).slice(0, 3) };
}
