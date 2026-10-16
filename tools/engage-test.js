// Off-screen engagement test (dev only). Set the Browser pane to the phone
// size first (844x390), reload, then:
//   const E = await import('/tools/engage-test.js'); await E.run()
// Walks the party along a route past several world groups (letting fights
// play out) and records where fights start relative to the camera:
//   offscreenEngage: foes that noticed the party while not on screen
//   offscreenTargets: companions picking a new target that isn't on screen
// Both should be ~0; fights that are already going may run past the edge.

const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

async function boot() {
  try { window.__game.sound.mute = true; } catch { /* no audio yet */ }
  for (let i = 0; i < 40 && !window.__game.scene.isActive('Title'); i++) await step(30);
  const { newState } = await import('/src/game/state.js');
  localStorage.removeItem('ninthTower.save.v1');
  const st = newState('brann'); st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  for (const h of st.recruited) st.heroes[h].level = 6; // strong enough to clear the route
  st.pos = { x: 96 * 16 + 8, y: 33 * 16 + 8 };
  st.quests = { ambush: { s: 1, n: 0, done: true } };
  window.__game.scene.getScene('Title').enterWorld(st);
  for (let i = 0; i < 200 && !(window.__scene && !window.__scene.busy && window.__scene.state === st); i++) await step(10);
  await step(20);
  return window.__scene;
}

const ROUTE = [[104, 40], [102, 43], [110, 37], [116, 30], [108, 27], [103, 23], [96, 28], [90, 33], [96, 33]];

export async function run(secs = 80) {
  const sc = await boot();
  const L = sc.leader, cam = sc.cameras.main;
  const vis = (e, m = 0) => { const v = cam.worldView; return e.x > v.x + m && e.x < v.right - m && e.y > v.y + m && e.y < v.bottom - m; };
  const m = { engages: 0, offscreenEngage: 0, engageDist: [], targets: 0, offscreenTargets: 0, kills: 0, flees: 0 };
  const was = new Map(), tgt = new Map(), fled = new Set();
  let wp = 0, wpT = 0;
  const ui = sc.ui;
  for (let f = 0; f < secs * 60; f++) {
    if (ui.dialogOpen) { ui.clearChoices(); ui.dialogOpen = false; ui.dlgCatch?.disableInteractive(); ui.dlg.setVisible(false); ui.onDone = null; ui.pendingDialog = null; }
    // walk the route; hold still while a fight is on so it can play out
    const fighting = sc.enemies.some((e) => e.alive && e.engaged);
    const [tx, ty] = ROUTE[wp % ROUTE.length];
    if (!fighting) {
      wpT++;
      if (Math.hypot(L.x - (tx * 16 + 8), L.y - (ty * 16 + 8)) < 20 || wpT > 360) { wp++; wpT = 0; }
      if (f % 30 === 0) sc.tapWorld(ROUTE[wp % ROUTE.length][0] * 16 + 8, ROUTE[wp % ROUTE.length][1] * 16 + 8);
    }
    for (const h of sc.party) if (h.downed) { h.downed = false; h.hp = h.maxHp; } // keep the walk going
    await step(1);
    for (const e of sc.enemies) {
      if (!e.alive) continue;
      if (e.engaged && !was.get(e)) {
        m.engages++;
        m.engageDist.push(Math.round(Math.hypot(e.x - L.x, e.y - L.y)));
        if (!vis(e)) m.offscreenEngage++;
      }
      was.set(e, e.engaged);
      if (e.state === 'flee' && !fled.has(e)) { fled.add(e); m.flees++; }
    }
    for (const h of sc.party) {
      if (h.isLeader) continue;
      if (h.target && h.target !== tgt.get(h) && h.target.alive && h.target.kind !== 'breakable') {
        m.targets++;
        if (!vis(h.target)) m.offscreenTargets++;
      }
      tgt.set(h, h.target);
    }
  }
  m.view = [Math.round(cam.worldView.width), Math.round(cam.worldView.height)];
  m.engageDist = m.engageDist.length ? { mean: Math.round(m.engageDist.reduce((a, b) => a + b, 0) / m.engageDist.length), max: Math.max(...m.engageDist) } : null;
  m.errs = (window.__errs || []).slice(0, 3);
  return m;
}
