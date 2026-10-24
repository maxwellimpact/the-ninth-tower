// Dodge/miss before-vs-after (dev only). From the title screen, after a reload:
//   const E = await import('/tools/evade-bench.js'); E.start();   // then poll window.__res
// Puts the game's own loop to sleep (the bench steps it by hand; both at once
// double the game speed), enters the bench test map (or the Dungeon Lab with
// start(20, 2, 'lab'), for comparing with older numbers) with seeded
// randomness so the party's rolled gear is the same every run, freezes
// levels, counts dodges and misses (if this build has them), and runs the
// 7-fight bench on 2 seeds.
export async function start(secs = 20, seeds = 2, where = 'map') {
  const g = window.__game;
  g.loop.sleep();
  const step = async (n = 1) => { let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };
  let s = 12345;
  const real = Math.random;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const title = g.scene.getScene('Title');
  if (where === 'lab' || !title.enterBench) title.enterLab(); else title.enterBench(); // (an older build has no bench map)
  const ready = () => (window.__scene?.state?.lab || window.__scene?.state?.map === 'bench') && !window.__scene.busy && !window.__scene.loading;
  for (let i = 0; i < 600 && !ready(); i++) await step(5);
  Math.random = real;
  const sc = window.__scene;
  for (const h of sc.party) h.gainXp = () => {};
  const counts = { heroDodged: 0, foeMissed: 0 };
  if (sc.tryEvade) { const te = sc.tryEvade.bind(sc); sc.tryEvade = (t, src) => { const r = te(t, src); if (r) counts[t.team === 'party' ? 'heroDodged' : 'foeMissed']++; return r; }; }
  window.__res = null; window.__benchErr = null; window.__counts = counts;
  const B = await import('/tools/fight-bench.js');
  B.bench(secs, null, seeds).then((r) => { window.__res = r; g.loop.wake(); }).catch((e) => { window.__benchErr = String(e); g.loop.wake(); });
  return { where: sc.state.map || (sc.state.lab ? 'lab' : '?'), party: sc.party.map((h) => `${h.def.id}:${h.level}`), gear: sc.party.map((h) => Object.values(h.hs.equip).filter(Boolean).length) };
}
