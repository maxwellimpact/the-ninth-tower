// The Ninth Tower, door to Malgrim (dev only). After a reload:
//   const T = await import('/tools/tower-test.js'); await T.run({ down: ['marsh', 'frost'] })
// Boots a sturdy party with the Vale stone and the given outer stones broken,
// goes in at the door, climbs floor by floor (killing what's there, beating
// any Ward Echo), checks sealed floors are passed by, then drives Malgrim
// through every phase and reports what happened.
import { go, step, closeDialog } from './goto.js';

const tough = (sc) => { for (const h of sc.party) { h.invuln = 1e9; if (h.downed) h.revive?.(1); h.hp = h.maxHp; } }; // the test party can't fall
const settle = async (sc, n = 40) => { for (let i = 0; i < n; i++) { tough(sc); await step(5); closeDialog(); if (sc.scene.isPaused()) sc.scene.resume(); } };

export async function run({ down = ['marsh', 'frost'], level = 28 } = {}) {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  st.relics = ['grapple', 'lantern', 'lens', 'cloak'];
  st.flags = { ...(st.flags || {}), wardBroken: true, golemDefeated: true, towerWarned: true };
  for (const r of down) st.flags[`ward_${r}`] = true;
  st.pos = { x: 155 * 16 + 8, y: 271 * 16 + 8 };
  const sc = await go(155, 271, { state: st, level, clear: true });
  for (const h of sc.party) { h.maxHp *= 60; h.hp = h.maxHp; }
  const log = [];
  const W = (await import('/src/data/world.json')).default;
  await settle(sc);
  for (let tries = 0; tries < 3 && !sc.area.startsWith('tower'); tries++) {
    sc.warp(W.warps.find((w) => w.id === 'towerIn'));
    for (let i = 0; i < 80 && (sc.busy || window.__game.scene.isActive('Loading')); i++) await step(10);
  }
  await settle(sc);
  const killAll = async () => { for (let r = 0; r < 6; r++) { tough(sc); for (const e of sc.enemies) if (e.alive && !e.boss) e.damage(1e6, sc.leader); await step(30); } };
  const visited = [];
  for (let guard = 0; guard < 12; guard++) {
    const area = sc.area; visited.push(area);
    if (area === 'tower9') break;
    const k = sc.dungeon;
    await killAll();
    if (k.def.boss && !sc.flags[k.def.boss.flag]) {
      // walk into the arena: the echo wakes
      const B = k.bossDef(W);
      sc.party.forEach((h, i) => { h.x = (B.cfg.arena[0] + i - 1) * 16 + 8; h.y = (B.cfg.arena[1]) * 16 + 8; h.clearPath(); });
      for (let i = 0; i < 40 && !sc.golem; i++) await step(10);
      for (let i = 0; i < 80 && sc.busy; i++) await step(10);
      const g = sc.golem;
      const name = g?.bossName;
      for (let i = 0; i < 400 && g?.alive; i++) { tough(sc); if (g.aloft) g.knockDown?.(true); g.damage(400, sc.leader); await step(6); if (sc.busy) await settle(sc, 10); }
      await settle(sc, 60);
      log.push({ step: `${area}: echo`, boss: name, beaten: !!sc.flags[k.def.boss.flag] });
    } else log.push({ step: `${area}: cleared` });
    const up = sc.interactables.find((o) => o.kind === 'warp' && typeof o.warp.tower === 'number' && sc.areaRect() === sc.areaRect());
    const mine = sc.interactables.filter((o) => o.kind === 'warp' && typeof o.warp.tower === 'number').find((o) => `tower${o.warp.tower}` === area);
    if (!mine) { log.push({ step: 'no stairs', area }); break; }
    void up;
    sc.tryWarp(mine.warp);
    for (let i = 0; i < 80 && (sc.busy || window.__game.scene.isActive('Loading')); i++) await step(10);
    await settle(sc);
  }
  log.push({ step: 'floors visited', visited });
  // Malgrim
  await killAll();
  for (const h of sc.party) h.invuln = 0;
  const k9 = sc.dungeon, B = k9.bossDef(W);
  sc.party.forEach((h) => { h.x = B.cfg.arena[0] * 16 + 8; h.y = (B.cfg.arena[1] + 4) * 16 + 8; h.clearPath(); });
  for (let i = 0; i < 40 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 80 && sc.busy; i++) await step(10);
  const m = sc.golem;
  log.push({ step: 'malgrim', boss: m?.bossName, phases: m?.phases, hp: m?.maxHp });
  const seen = new Set();
  let decoys = 0, frogs = 0, reflects = 0;
  for (let i = 0; i < 900 && m?.alive; i++) {
    seen.add(m.phase);
    if (m.phase === 'mirrors') decoys = Math.max(decoys, m.decoys.filter((d) => d.alive).length);
    if (sc.party.some((h) => h.frogT > 0)) frogs++;
    if (m.reflectNext) reflects++;
    if (m.phase === 'heart' && i % 60 === 0) m.curseT = 0; // make sure the curse is tried
    if (i % 10 === 0) for (const h of sc.party) { if (h.downed) h.revive?.(1); h.hp = h.maxHp; } // (not invulnerable here, so the frog curse can land)
    m.damage(m.maxHp * 0.012, sc.leader);
    await step(4);
    if (sc.busy) await settle(sc, 5);
  }
  await settle(sc, 80);
  log.push({ step: 'malgrim falls', dead: !m?.alive, flag: !!sc.flags.malgrimDefeated, phasesSeen: [...seen], decoysUp: decoys, frogFrames: frogs, reflectFrames: reflects });
  log.push({ errs: window.__errs || [] });
  return log;
}
