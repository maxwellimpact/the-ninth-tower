// The true Isolde at the Frosthelm Ward Stone (dev only). After a reload:
//   const T = await import('/tools/isolde-test.js'); await T.run({ mirelle: true })
// Boots a party (with Mirelle if asked) with her Shadow already broken, walks
// to the stone, and drives her through all three phases: the ice platform
// (knocked down from a vent), the blizzard and frost armour (Mirelle's line
// drops it, or time does), then the kill and breaking the stone.
import { go, step, closeDialog } from './goto.js';

export async function run({ mirelle = true } = {}) {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann');
  st.recruited = mirelle ? ['brann', 'pip', 'mirelle'] : ['brann', 'pip', 'sable'];
  st.active = [...st.recruited];
  st.relics = ['grapple', 'claws', 'cloak'];
  st.flags = { ...(st.flags || {}), isoldeDefeated: true };
  st.pos = { x: 62 * 16 + 8, y: 296 * 16 + 8 };
  const sc = await go(62, 296, { state: st, level: 16, clear: true });
  sc.flags.isoldeDefeated = true;
  for (const h of sc.party) { h.maxHp *= 40; h.hp = h.maxHp; }
  const log = [];
  sc.leader.x = 62 * 16 + 8; sc.leader.y = 300 * 16 + 8;
  for (let i = 0; i < 60 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 80 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'she forms', boss: g?.bossName, shadow: g?.isShadow, hp: g?.maxHp });
  for (let i = 0; i < 80 && g?.alive && g.phase === 1; i++) { g.damage(250, sc.leader); await step(8); }
  await step(30);
  log.push({ step: 'phase 2', aloft: !!g?.aloft, vents: g?.vents.length });
  g?.vents[0]?.o.interact(sc.leader);
  for (let i = 0; i < 80 && (sc.busy || g?.aloft); i++) await step(10);
  log.push({ step: 'knocked down', aloft: !!g?.aloft });
  for (let i = 0; i < 80 && g?.alive && g.phase === 2; i++) { g.damage(250, sc.leader); await step(8); }
  log.push({ step: 'phase 3', phase: g?.phase, armor: g?.armor, blizzard: !!g?.blizzard });
  for (let i = 0; i < 90 && g?.armor; i++) { await step(10); closeDialog(); }
  log.push({ step: 'guard drops', armor: g?.armor });
  for (let i = 0; i < 200 && g?.alive; i++) { g.damage(300, sc.leader); await step(12); closeDialog(); }
  for (let i = 0; i < 40; i++) { await step(10); closeDialog(); }
  const w = sc.wards.find((k) => k.def.id === 'frost');
  log.push({ step: 'she falls', dead: !g?.alive, flag: !!sc.flags.isoldeWardenDefeated, shielded: sc.wardShielded(w.unit), wand: sc.state.inventory?.includes?.('glacier_wand') ?? null });
  for (let i = 0; i < 60 && w.unit?.alive; i++) { w.unit.damage(500, sc.leader); await step(6); }
  for (let i = 0; i < 80; i++) { await step(10); closeDialog(); if (sc.scene.isPaused()) sc.scene.resume(); }
  log.push({ step: 'stone broken', flag: !!sc.flags.ward_frost });
  log.push({ errs: window.__errs || [] });
  return log;
}
