// Dungeon walkthroughs (dev only). In a running game (not the lab):
//   const W = await import('/tools/dungeon-walk.js'); await W.abbey();
// Plays a dungeon start to finish with taps (teleporting between rooms to save
// time, killing fights outright), checking each beat. Returns a step log.

const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };
const resume = async (sc) => { for (let i = 0; i < 8; i++) { if (sc.scene.isPaused()) sc.scene.resume(); await step(10); } };

function ctx(id) {
  const sc = window.__scene, k = Object.values(sc.dungeons).find((d) => d.id === id);
  const T = (lx, ly) => ({ x: (k.ox + lx) * 16 + 8, y: (k.oy + ly) * 16 + 8 });
  const tp = (lx, ly) => { const p = T(lx, ly); sc.party.forEach((h, i) => { h.x = p.x + (i ? (i === 1 ? -8 : 8) : 0); h.y = p.y + (i ? 6 : 0); h.clearPath(); h.command = null; h.target = null; }); };
  const at = () => [Math.floor(sc.leader.x / 16) - k.ox, Math.floor(sc.leader.y / 16) - k.oy];
  const tapTile = async (lx, ly, frames = 90) => { const p = T(lx, ly); sc.tapWorld(p.x, p.y - 4); await step(frames); };
  const solid = (lx, ly) => sc.nav.isSolid(k.ox + lx, k.oy + ly);
  const killAll = async () => { for (let r = 0; r < 6; r++) { for (const e of sc.enemies) if (e.alive && !e.boss) e.damage(99999, sc.leader); await step(40); } };
  const chest = (ch) => k.chests.find((c) => c.ch === ch);
  const openChest = async (ch) => { const c = chest(ch); if (!c?.placed) return false; c.o.interact(sc.leader); await step(60); await resume(sc); return c.opened; };
  const lever = (lx, ly) => sc.interactables.find((o) => o.kind === 'lever' && Math.floor(o.x / 16) === k.ox + lx && Math.floor(o.y / 16) === k.oy + ly);
  const pull = async (lx, ly) => { const l = lever(lx, ly); l.interact(sc.leader); await step(20); };
  const door = (lx, ly) => k.doors.find((d) => d.tiles.some(([x, y]) => x === k.ox + lx && y === k.oy + ly));
  const unlock = async (lx, ly) => { const d = door(lx, ly); k.tryUnlock(d); await step(20); return d.unlocked && !d.closed; };
  const room = (lx, ly) => k.rooms[k.roomOf.get(`${k.ox + lx},${k.oy + ly}`)];
  const enterFight = async (lx, ly) => { tp(lx, ly); for (let i = 0; i < 30 && !room(lx, ly).active; i++) await step(10); const was = room(lx, ly).active; await step(60); await killAll(); await step(60); return { sealed: was, cleared: room(lx, ly).cleared }; };
  const push = async (b, sx, sy) => { sc.leader.x = (k.ox + sx) * 16 + 8; sc.leader.y = (k.oy + sy) * 16 + 8; sc.leader.command = null; k.pushFrom(b, sc.leader); for (let i = 0; i < 80 && (b.moving || b.queued); i++) await step(2); await step(4); };
  const crystal = async (lx, ly) => { const c = k.crystals.find((q) => q.tx === k.ox + lx && q.ty === k.oy + ly); c.damage(1, sc.leader); await step(50); return c.zone.raised; };
  return { sc, k, T, tp, at, tapTile, solid, killAll, chest, openChest, pull, door, unlock, room, enterFight, push, crystal };
}

async function enter(warpId) {
  const sc = window.__scene, W = (await import('/src/data/world.json')).default;
  const w = W.warps.find((q) => q.id === warpId);
  sc.warp(w);
  for (let i = 0; i < 60 && (sc.busy || window.__game.scene.isActive('Loading')); i++) await step(10);
  await step(30);
}

export async function abbey() {
  const log = [];
  const sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await enter('abbeyIn');
  const c = ctx('abbey');
  log.push({ step: 'entered', area: sc.area, at: c.at() });
  // narthex: the flooded threshold
  log.push({ step: 'threshold flooded', blocked: c.solid(37, 53) });
  await c.pull(29, 56);
  log.push({ step: 'lever drains it', open: !c.solid(37, 53), fontFlooded: c.solid(44, 57) });
  // nave: sealed fight
  log.push({ step: 'nave fight', ...(await c.enterFight(28, 40)) });
  // east chapel: three basins
  c.tp(58, 38); await c.step?.(1);
  log.push({ step: 'east chapel', S1blockedDeep: c.solid(58, 34), S3reachable: !c.solid(58, 40), S4blocked: c.solid(58, 46) });
  c.tp(58, 43); log.push({ step: 'map chest (S3)', opened: await c.openChest('2'), map: c.k.map });
  await c.pull(60, 43);
  log.push({ step: 'S3 lever', S4open: !c.solid(58, 46), S2cutOff: c.solid(58, 40) });
  c.tp(58, 52); log.push({ step: 'key chest (S4)', opened: await c.openChest('1'), keys: c.k.keys });
  c.tp(58, 44); await c.pull(60, 43);
  log.push({ step: 'back out', S2open: !c.solid(58, 40) });
  // west chapel: the key, the Drowned Prior, the Tide Charm
  c.tp(21, 42); log.push({ step: 'west chapel door', unlocked: await c.unlock(19, 42), keys: c.k.keys });
  const fight = await c.enterFight(10, 45);
  const prior = c.room(10, 45).spawned?.find((e) => e.named);
  log.push({ step: 'prior fight', ...fight, prior: prior?.s.name });
  log.push({ step: 'tide charm chest appears', placed: !!c.chest('3').placed });
  await c.openChest('3'); log.push({ step: 'tide charm', relics: [...sc.state.relics] });
  // swim north to the crypt
  c.tp(10, 37); await c.tapTile(10, 25, 360);
  log.push({ step: 'swam to crypt', at: c.at(), swimming: sc.leader.swimming });
  await c.pull(15, 22);
  log.push({ step: 'crypt drained', plateDry: !c.solid(10, 12) });
  const b = c.k.blocks[0];
  for (let i = 0; i < 4; i++) await c.push(b, b.x - c.k.ox - 1, b.y - c.k.oy);
  for (let i = 0; i < 6; i++) await c.push(b, b.x - c.k.ox, b.y - c.k.oy + 1);
  const alcove = c.door(10, 7);
  log.push({ step: 'block on plate', block: [b.x - c.k.ox, b.y - c.k.oy], alcoveOpen: !alcove.closed });
  c.tp(10, 8); await c.tapTile(10, 5, 200); log.push({ step: 'walk into alcove', at: c.at() });
  log.push({ step: 'key 2', opened: await c.openChest('4'), keys: c.k.keys });
  c.tp(5, 28); log.push({ step: 'compass', opened: await c.openChest('7'), compass: c.k.compass });
  // the bell tower, behind deep water in the east chapel
  c.tp(58, 37); await c.tapTile(58, 31, 300);
  log.push({ step: 'swam to S1', at: c.at() });
  log.push({ step: 'tower door', unlocked: await c.unlock(58, 29), keys: c.k.keys });
  const climb = [];
  c.tp(56, 27); climb.push(await c.crystal(55, 26));
  c.tp(57, 22); climb.push(await c.crystal(58, 21));
  c.tp(56, 16); climb.push(await c.crystal(55, 15));
  log.push({ step: 'crystal climb', raised: climb, topOpen: !c.solid(56, 12) });
  c.tp(56, 7); log.push({ step: 'sanctum key', opened: await c.openChest('5'), big: c.k.big });
  await c.killAll();
  // up the drowned aisle to the boss door
  c.tp(36, 44); await c.tapTile(36, 31, 400);
  log.push({ step: 'swam up the aisle', at: c.at() });
  log.push({ step: 'boss door', unlocked: await c.unlock(36, 29) });
  c.tp(36, 25); await c.tapTile(36, 17, 200);
  for (let i = 0; i < 30 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 40 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'murk rises', boss: g?.bossName, level: g?.level, shadow: g?.isShadow });
  for (let i = 0; i < 200 && g?.alive; i++) { if (!g.submerged) g.damage(400, sc.leader); await step(20); for (let k = 0; k < 20 && sc.busy; k++) await step(10); }
  await step(200);
  log.push({ step: 'murk falls', dead: !g?.alive, flag: !!sc.flags.murkDefeated, gate: !!sc.arenaGate, vineWithering: sc.vines.filter((v) => v.ward.def.id === 'marsh').map((v) => v.dead) });
  const back = sc.interactables.find((o) => o.kind === 'warp' && o.warp.id === 'abbeyBack');
  log.push({ step: 'back stairs', present: !!back });
  log.push({ errs: window.__errs || [] });
  return log;
}

// Witchroot Hollow (Gloamwood): braziers, the crystal grotto, the pack fight
// for the Seer's Lens, false walls and the hidden bridge, the brazier alcove
// for the Hunt Horn, then the Huntsman's Shadow. Boot with the Lantern:
//   await W.boot({ relics: ['grapple', 'lantern'] }); await W.witchroot()
export async function witchroot() {
  const log = [];
  const sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await enter('witchrootIn');
  const c = ctx('witchroot');
  log.push({ step: 'entered', area: sc.area, at: c.at(), dark: !!sc.areaRect().dark, music: sc.musicName?.() });
  const hallDoor = c.door(31, 48);
  log.push({ step: 'hall shutter waits for the braziers', shut: !!hallDoor.closed });
  const lightAt = async (lx, ly) => { const b = c.k.braziers.find((q) => q.tx === c.k.ox + lx && q.ty === c.k.oy + ly); b.damage(1, sc.leader); await step(20); return b.lit; };
  log.push({ step: 'light hall braziers (lantern)', lit: [await lightAt(24, 51), await lightAt(38, 51)], open: !hallDoor.closed });
  log.push({ step: 'hub fight', ...(await c.enterFight(31, 44)) });
  // west grotto: the crystal across the chasm works the pegs
  c.tp(9, 37); await step(30);
  const redUp = () => c.solid(8, 32), blueUp = () => c.solid(8, 42);
  log.push({ step: 'grotto pegs', redUp: redUp(), blueUp: blueUp() });
  if (redUp()) await c.crystal(3, 37);
  c.tp(9, 30); log.push({ step: 'key 1', opened: await c.openChest('1'), keys: c.k.keys });
  c.tp(9, 37); await c.crystal(3, 37);
  c.tp(9, 44); log.push({ step: 'map', opened: await c.openChest('2'), map: c.k.map });
  await c.killAll();
  // east chamber: key door, the pack, the Lens
  c.tp(49, 36); log.push({ step: 'east door', unlocked: await c.unlock(51, 36), keys: c.k.keys });
  const fight = await c.enterFight(56, 39);
  const greyjaw = c.room(56, 39).spawned?.find((e) => e.named);
  log.push({ step: 'pack fight', ...fight, elite: greyjaw?.s.name });
  log.push({ step: 'lens chest appears', placed: !!c.chest('3').placed });
  c.tp(56, 43); await c.openChest('3'); await step(30);
  log.push({ step: 'seer\'s lens', relics: [...sc.state.relics], falseWallOpen: !c.solid(15, 26), bridgeOpen: !c.solid(10, 12) });
  // through the false wall, across the bridge of light
  c.tp(15, 28); await c.tapTile(15, 22, 200); log.push({ step: 'through the false wall', at: c.at() });
  await c.tapTile(16, 12, 200); await c.tapTile(4, 12, 300); log.push({ step: 'across the hidden bridge', at: c.at() });
  await c.killAll();
  c.tp(4, 8); log.push({ step: 'key 2', opened: await c.openChest('4'), keys: c.k.keys });
  c.tp(4, 16); log.push({ step: 'compass', opened: await c.openChest('7'), compass: c.k.compass });
  c.tp(3, 5); await c.tapTile(3, 2, 200); log.push({ step: 'secret shrine (false wall)', at: c.at() });
  c.tp(3, 2); log.push({ step: 'shrine chest', opened: await c.openChest('6') });
  // the top corridor to the second key door, and the brazier alcove
  c.tp(42, 2); log.push({ step: 'north-east door', unlocked: await c.unlock(44, 2), keys: c.k.keys });
  c.tp(47, 6); await step(40); await c.killAll();
  const alcove = c.door(52, 17);
  log.push({ step: 'alcove waits', shut: !!alcove.closed });
  const lit = [await lightAt(47, 4), await lightAt(58, 4), await lightAt(52, 14)];
  log.push({ step: 'alcove braziers', lit, open: !alcove.closed });
  c.tp(52, 19); log.push({ step: 'hunt horn', opened: await c.openChest('5'), big: c.k.big });
  await step(90); await c.killAll();
  // vault: needs the Stone Gauntlets
  c.tp(23, 52); log.push({ step: 'vault stays sealed', unlocked: await c.unlock(21, 52) });
  // the root door and the Huntsman's Shadow
  c.tp(31, 28); log.push({ step: 'boss door', unlocked: await c.unlock(31, 26) });
  c.tp(31, 24); await c.tapTile(31, 16, 200);
  for (let i = 0; i < 30 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 60 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'the huntsman rises', boss: g?.bossName, level: g?.level, shadow: g?.isShadow });
  let phases = new Set();
  for (let i = 0; i < 300 && g?.alive; i++) { phases.add(g.phase); g.damage(300, sc.leader); await step(15); for (let k = 0; k < 20 && sc.busy; k++) await step(10); }
  await step(240);
  log.push({ step: 'the shadow breaks', dead: !g?.alive, phases: [...phases], flag: !!sc.flags.huntsmanDefeated, gate: !!sc.arenaGate, vineWithering: sc.vines.filter((v) => v.ward.def.id === 'gloam').map((v) => v.dead) });
  const back = sc.interactables.find((o) => o.kind === 'warp' && o.warp.id === 'witchrootBack');
  log.push({ step: 'back stairs', present: !!back });
  log.push({ errs: window.__errs || [] });
  return log;
}

// The Forge of Ash (Cinderreach): the push-block entry, the crucible crystal,
// the Forge Guardian for the Stone Gauntlets, a reinforced wall, a boulder
// rolled into the lava, two boulders on plates for the Master's Brand, then
// Vulk's Shadow and its vents.
//   await W.boot({ relics: ['grapple', 'lantern'] }); await W.forge()
export async function forge() {
  const log = [];
  const sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await enter('forgeIn');
  const c = ctx('forge');
  log.push({ step: 'entered', area: sc.area, at: c.at() });
  const hallDoor = c.door(31, 48);
  log.push({ step: 'hall shutter', shut: !!hallDoor.closed });
  const b0 = c.k.blocks.find((b) => !b.heavy);
  for (let i = 0; i < 9; i++) await c.push(b0, b0.x - c.k.ox - 1, b0.y - c.k.oy);
  log.push({ step: 'block on plate', block: [b0.x - c.k.ox, b0.y - c.k.oy], open: !hallDoor.closed });
  log.push({ step: 'forge fight', ...(await c.enterFight(31, 44)) });
  c.tp(9, 37); await step(30);
  if (c.solid(8, 32)) await c.crystal(3, 37);
  c.tp(9, 30); log.push({ step: 'key 1', opened: await c.openChest('1'), keys: c.k.keys });
  c.tp(9, 37); await c.crystal(3, 37);
  c.tp(9, 44); log.push({ step: 'map', opened: await c.openChest('2'), map: c.k.map });
  await c.killAll();
  c.tp(49, 36); log.push({ step: 'east door', unlocked: await c.unlock(51, 36), keys: c.k.keys });
  // the reinforced wall holds without the Gauntlets
  const wallBefore = c.solid(15, 26);
  const fight = await c.enterFight(56, 39);
  const guardian = c.room(56, 39).spawned?.find((e) => e.named);
  log.push({ step: 'guardian fight', ...fight, elite: guardian?.s.name, wallHeldBefore: wallBefore });
  c.tp(56, 43); await c.openChest('3'); await step(30);
  log.push({ step: 'stone gauntlets', relics: [...sc.state.relics] });
  // smash the reinforced wall
  const rw = sc.breakables.find((b) => b.def?.reinforced && b.def.x === c.k.ox + 15 && b.def.y === c.k.oy + 26);
  for (let i = 0; i < 4 && rw?.alive; i++) { rw.damage(30, sc.leader); await step(10); }
  log.push({ step: 'reinforced wall smashed', open: !c.solid(15, 26) });
  // the NW wing: roll the boulder into the lava
  c.tp(15, 23); await c.tapTile(15, 12, 240); await c.killAll();
  const bo = c.k.blocks.find((b) => b.heavy && b.x0 === c.k.ox + 12 && b.y0 === c.k.oy + 12);
  log.push({ step: 'lava blocks the way', lava: c.solid(10, 12) });
  await c.push(bo, 13, 12); await c.push(bo, 13, 12); await step(20);
  log.push({ step: 'boulder in the lava', crossing: !c.solid(10, 12) });
  c.tp(11, 12); await c.tapTile(5, 12, 240); log.push({ step: 'across', at: c.at() });
  await c.killAll();
  c.tp(4, 8); log.push({ step: 'key 2', opened: await c.openChest('4'), keys: c.k.keys });
  c.tp(4, 16); log.push({ step: 'compass', opened: await c.openChest('7'), compass: c.k.compass });
  const rw2 = sc.breakables.find((b) => b.def?.reinforced && b.def.y === c.k.oy + 3);
  for (let i = 0; i < 4 && rw2?.alive; i++) { rw2.damage(30, sc.leader); await step(10); }
  c.tp(3, 2); log.push({ step: 'secret chest', opened: await c.openChest('6') });
  // NE chamber: two boulders onto two plates
  c.tp(42, 2); log.push({ step: 'north-east door', unlocked: await c.unlock(44, 2), keys: c.k.keys });
  c.tp(47, 9); await step(40); await c.killAll();
  const alcove = c.door(52, 17);
  for (const [bx] of [[48], [57]]) {
    const b = c.k.blocks.find((k) => k.heavy && k.x0 === c.k.ox + bx);
    for (let i = 0; i < 7; i++) await c.push(b, bx, b.y - c.k.oy - 1);
  }
  log.push({ step: 'boulders on plates', open: !alcove.closed });
  c.tp(52, 19); log.push({ step: "master's brand", opened: await c.openChest('5'), big: c.k.big });
  await step(90); await c.killAll();
  c.tp(23, 52); log.push({ step: 'vault (tide) sealed', unlocked: await c.unlock(21, 52) });
  c.tp(31, 28); log.push({ step: 'boss door', unlocked: await c.unlock(31, 26) });
  c.tp(31, 24); await c.tapTile(31, 16, 200);
  for (let i = 0; i < 30 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 60 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'vulk rises', boss: g?.bossName, level: g?.level, shadow: g?.isShadow, scale: g?.sprite.scaleX });
  // drive him into phase 2, then plug every vent with the Gauntlets
  for (let i = 0; i < 60 && g?.alive && g.phase === 1; i++) { g.damage(200, sc.leader); await step(10); for (let k = 0; k < 20 && sc.busy; k++) await step(10); }
  await step(80);
  log.push({ step: 'phase 2', phase: g?.phase, vents: g?.vents.length, slag: g?.slag.length, stoked: g?.stoked });
  for (const v of g?.vents || []) {
    const b = g.slag.find((s2) => !s2.plugged && Math.hypot(s2.x - v.x, s2.y - v.y) < 56);
    if (!b) continue;
    // shove it along one axis then the other, from the far side (the slide takes a moment)
    for (let i = 0; i < 6 && !v.plugged; i++) {
      const dx = v.x - b.x, dy = v.y - b.y, horiz = Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 2;
      g.shove(b, { x: horiz ? b.x - Math.sign(dx) * 12 : b.x, y: horiz ? b.y : b.y - Math.sign(dy) * 12, face() {}, play() {}, anim: '' });
      await step(40);
    }
  }
  log.push({ step: 'vents plugged', plugged: g?.vents.filter((v) => v.plugged).length, stoked: g?.stoked });
  for (let i = 0; i < 200 && g?.alive; i++) { g.damage(300, sc.leader); await step(15); for (let k = 0; k < 20 && sc.busy; k++) await step(10); }
  await step(240);
  log.push({ step: 'the shadow breaks', dead: !g?.alive, flag: !!sc.flags.vulkDefeated, gate: !!sc.arenaGate, vineWithering: sc.vines.filter((v) => v.ward.def.id === 'cinder').map((v) => v.dead) });
  log.push({ step: 'back stairs', present: !!sc.interactables.find((o) => o.kind === 'warp' && o.warp.id === 'forgeBack') });
  log.push({ errs: window.__errs || [] });
  return log;
}

// The Clawhold (Frosthelm): block onto plate opens the den, the den fight
// seals, its side room keeps the key, the key door, the Climbing Claws.
export async function clawhold() {
  const log = [];
  const sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await enter('clawholdIn');
  const c = ctx('clawhold');
  log.push({ step: 'entered', area: sc.area, at: c.at() });
  const shutter = c.door(21, 21);
  log.push({ step: 'shutter', shut: !!shutter.closed });
  const b0 = c.k.blocks[0];
  for (let i = 0; i < 7; i++) await c.push(b0, b0.x - c.k.ox - 1, b0.y - c.k.oy);
  await c.push(b0, b0.x - c.k.ox, b0.y - c.k.oy + 1);
  log.push({ step: 'block on plate', block: [b0.x - c.k.ox, b0.y - c.k.oy], open: !shutter.closed });
  log.push({ step: 'den fight', ...(await c.enterFight(21, 15)) });
  c.tp(39, 14); log.push({ step: 'key', opened: await c.openChest('1'), keys: c.k.keys });
  c.tp(9, 10); log.push({ step: 'key door', unlocked: await c.unlock(9, 9), keys: c.k.keys });
  c.tp(9, 5); await step(40); await c.killAll();
  c.tp(14, 3); log.push({ step: 'cache', opened: await c.openChest('2') });
  c.tp(8, 4); await c.openChest('3'); await step(30);
  log.push({ step: 'climbing claws', relics: [...sc.state.relics] });
  log.push({ errs: window.__errs || [] });
  return log;
}

// The Rimeglass Spire (Frosthelm): the key wing, the Gale Cloak, gliding the
// chasm, thawing Mirelle with the braziers, the Gauntlets vault, the east
// ledge, the big key, and Isolde's Shadow (knocked off her ice by a vent).
export async function spire() {
  const log = [];
  const sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  await enter('spireIn');
  const c = ctx('spire');
  log.push({ step: 'entered', area: sc.area, at: c.at() });
  await c.killAll();
  log.push({ step: 'west wing fight', ...(await c.enterFight(5, 55)) });
  c.tp(5, 57); log.push({ step: 'key', opened: await c.openChest('1'), keys: c.k.keys });
  c.tp(50, 54); log.push({ step: 'east door', unlocked: await c.unlock(52, 54) });
  c.tp(56, 55); await step(30); await c.killAll();
  c.tp(57, 54); await c.openChest('3'); await step(30);
  log.push({ step: 'gale cloak', relics: [...sc.state.relics] });
  const pad = sc.interactables.find((o) => o.kind === 'glide' && Math.floor(o.x / 16) === c.k.ox + 30 && Math.floor(o.y / 16) === c.k.oy + 52);
  c.tp(30, 53); await step(10); pad.interact(sc.leader); for (let i = 0; i < 60 && sc.busy; i++) await step(10); await step(20);
  log.push({ step: 'glided the chasm', at: c.at() });
  await c.killAll();
  const shutter = c.door(30, 31);
  log.push({ step: 'mirelle frozen', frozen: !!c.k.frozen, shutterShut: !!shutter.closed });
  for (const b of c.k.braziers) c.k.light(b);
  for (let i = 0; i < 30; i++) { await step(10); if (sc.scene.get('UI').dialogOpen) break; }
  const { closeDialog } = await import('./goto.js');
  for (let i = 0; i < 6; i++) { const ui = sc.scene.get('UI'); if (ui.dialogOpen) { const done = ui.onDone; closeDialog(); done?.(); } await step(10); }
  await step(30);
  log.push({ step: 'thawed', recruited: sc.state.recruited.includes('mirelle'), active: [...sc.state.active], shutterOpen: !shutter.closed });
  c.tp(15, 38); log.push({ step: 'vault sealed', unlocked: await c.unlock(13, 38) });
  sc.state.relics.push('gauntlets');
  log.push({ step: 'vault (gauntlets)', unlocked: await c.unlock(13, 38) });
  c.tp(9, 39); log.push({ step: 'crown of rime', opened: await c.openChest('8') });
  const pad2 = sc.interactables.find((o) => o.kind === 'glide' && Math.floor(o.x / 16) === c.k.ox + 47 && Math.floor(o.y / 16) === c.k.oy + 38);
  c.tp(46, 38); await step(10); pad2.interact(sc.leader); for (let i = 0; i < 60 && sc.busy; i++) await step(10); await step(20);
  await c.killAll();
  c.tp(55, 38); log.push({ step: 'east ledge', at: c.at(), opened: await c.openChest('6') });
  c.tp(30, 27); await step(40); await c.killAll(); await step(40); await c.killAll();
  c.tp(18, 21); log.push({ step: 'map', opened: await c.openChest('2') });
  c.tp(43, 25); log.push({ step: 'star-key', opened: await c.openChest('5'), big: c.k.big });
  c.tp(30, 19); log.push({ step: 'boss door', unlocked: await c.unlock(30, 17) });
  c.tp(30, 15); await c.tapTile(30, 7, 260);
  for (let i = 0; i < 30 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 60 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'isolde rises', boss: g?.bossName, shadow: g?.isShadow, level: g?.level });
  for (let i = 0; i < 60 && g?.alive && g.phase === 1; i++) { g.damage(200, sc.leader); await step(10); }
  await step(60);
  log.push({ step: 'phase 2: aloft', aloft: !!g?.aloft, vents: g?.vents.length, hitWhileAloft: g?.aloft ? g.damage(200, sc.leader) : null });
  const v = g?.vents[0];
  if (v) { v.o.interact(sc.leader); for (let i = 0; i < 80 && (sc.busy || g.aloft); i++) await step(10); }
  log.push({ step: 'knocked down', aloft: !!g?.aloft, stagger: g?.staggerT > 0 });
  for (let i = 0; i < 200 && g?.alive; i++) { g.damage(300, sc.leader); await step(15); for (let k = 0; k < 20 && sc.busy; k++) await step(10); }
  await step(240);
  log.push({ step: 'the shadow shatters', dead: !g?.alive, flag: !!sc.flags.isoldeDefeated, vines: sc.vines.filter((q) => q.ward.def.id === 'frost').map((q) => q.dead) });
  log.push({ step: 'back stairs', present: !!sc.interactables.find((o) => o.kind === 'warp' && o.warp.id === 'spireBack') });
  log.push({ errs: window.__errs || [] });
  return log;
}

// A fresh real game (not the lab): Brann, Pip and Sable at `level`, with the
// given relics, at the start of the world. Clears the saved game first.
export async function boot({ level = 6, relics = ['grapple'], state = null } = {}) {
  try { window.__game.sound.mute = true; } catch { /* no audio yet */ }
  for (let i = 0; i < 40 && !window.__game.scene.isActive('Title') && !window.__scene; i++) await step(30);
  const { newState } = await import('/src/game/state.js');
  let st = state;
  if (!st) {
    localStorage.removeItem('ninthTower.save.v1');
    st = newState('brann'); st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
    for (const h of st.recruited) st.heroes[h].level = level;
    st.relics = [...relics];
  }
  if (window.__game.scene.isActive('Title')) window.__game.scene.getScene('Title').enterWorld(st);
  else window.__game.scene.getScene('Game').scene.restart({ state: st }); // a game is already running
  for (let i = 0; i < 200 && !(window.__scene && !window.__scene.busy && window.__scene.state === st); i++) await step(10);
  await step(20);
  return window.__scene;
}

export async function undercroft({ reloadAfterKey = true } = {}) {
  const log = [];
  let sc = window.__scene;
  for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
  sc.state.relics = sc.state.relics.filter((r) => r !== 'grapple'); // found inside
  await enter('undercroftIn');
  let c = ctx('undercroft');
  log.push({ step: 'entered', area: sc.area, at: c.at(), music: (await import('/src/audio/music.js')).music?.song?.name });
  // entry: block onto the plate
  const b = c.k.blocks.find((q) => q.y - c.k.oy === 58);
  await c.push(b, 39, 58); await c.push(b, 40, 58);
  for (let i = 0; i < 3; i++) await c.push(b, b.x - c.k.ox, b.y - c.k.oy + 1);
  log.push({ step: 'entry plate', block: [b.x - c.k.ox, b.y - c.k.oy], shutterOpen: !c.door(37, 52).closed });
  log.push({ step: 'hall fight', ...(await c.enterFight(37, 46)) });
  // crystal room
  c.tp(56, 38); const cr = c.k.crystals.find((q) => q.tx - c.k.ox === 57);
  c.sc.setLeader(sc.party.find((h) => h.def.id === 'pip'), true); c.tp(56, 38);
  sc.tapWorld(cr.x, cr.y - 8); await step(120);
  log.push({ step: 'shoot crystal (Pip)', raised: cr.zone.raised });
  c.tp(55, 33); log.push({ step: 'key 1', opened: await c.openChest('1'), keys: c.k.keys });
  sc.tapWorld(cr.x, cr.y - 8); await step(80);
  c.tp(56, 54); log.push({ step: 'map', opened: await c.openChest('2'), map: c.k.map });
  sc.setLeader(sc.party.find((h) => h.def.id === 'brann'), true);
  if (reloadAfterKey) {
    // save, then load the save into a fresh scene: progress must survive
    c.tp(37, 47); await step(10);
    sc.autosave('test');
    const { loadState } = await import('/src/game/state.js');
    const st = loadState();
    window.__game.scene.getScene('Game').scene.restart({ state: st });
    for (let i = 0; i < 200 && !(window.__scene?.state === st && !window.__scene.busy); i++) await step(10);
    await step(40);
    sc = window.__scene; c = ctx('undercroft');
    for (const h of sc.party) { h.maxHp *= 50; h.hp = h.maxHp; }
    log.push({ step: 'after reload', area: sc.area, keys: c.k.keys, map: c.k.map, plateDown: c.k.plates.find((p) => p.y - c.k.oy === 55).latched, hallCleared: c.room(37, 46).cleared, chest1: c.chest('1').opened, entryShutterOpen: !c.door(37, 52).closed });
  }
  // armory: key door, captain, grapple
  c.tp(24, 44); log.push({ step: 'armory door', unlocked: await c.unlock(22, 44), keys: c.k.keys });
  log.push({ step: 'captain fight', ...(await c.enterFight(15, 46)) });
  await c.openChest('3'); log.push({ step: 'grapple', relics: [...sc.state.relics] });
  // gallery: hook across, hook the pillar switch, island key, north ledge
  const post = (ch) => sc.interactables.find((o) => o.kind === 'post' && o.id === `undercroft_${ch}`);
  c.tp(8, 42); post('u').interact(sc.leader, post('u')); await step(140); for (let i = 0; i < 40 && sc.busy; i++) await step(10);
  log.push({ step: 'hooked to the gallery', at: c.at() });
  const pc = c.k.crystals.find((q) => q.tx - c.k.ox === 6);
  sc.tapWorld(pc.x, pc.y - 8); await step(120);
  log.push({ step: 'hook the pillar switch', raised: pc.zone.raised, pegsDown: !c.solid(12, 32) });
  c.tp(4, 32); log.push({ step: 'compass', opened: await c.openChest('7') });
  c.tp(16, 32); post('w').interact(sc.leader, post('w')); await step(140); for (let i = 0; i < 40 && sc.busy; i++) await step(10);
  c.tp(17, 27); log.push({ step: 'island key', opened: await c.openChest('4'), keys: c.k.keys });
  c.tp(15, 25); post('y').interact(sc.leader, post('y')); await step(140); for (let i = 0; i < 40 && sc.busy; i++) await step(10);
  log.push({ step: 'north ledge', at: c.at() });
  c.tp(12, 17); log.push({ step: 'vault door', unlocked: await c.unlock(12, 16), keys: c.k.keys });
  // the block vault
  const [b1, b2] = c.k.blocks.filter((q) => q.room === c.room(12, 10));
  await c.push(b1, 9, 12); for (let i = 0; i < 5; i++) await c.push(b1, 7, 13 - i); await c.push(b1, 8, 7);
  await c.push(b2, 15, 12); for (let i = 0; i < 5; i++) await c.push(b2, 17, 13 - i); await c.push(b2, 16, 7);
  log.push({ step: 'vault plates', plates: c.room(12, 10).plates.map((p) => p.latched), alcoveOpen: !c.door(12, 4).closed });
  c.tp(12, 6); await c.tapTile(12, 3, 160); log.push({ step: 'seal', opened: await c.openChest('5'), big: c.k.big });
  await c.killAll();
  // back down, boss door, boss
  c.tp(37, 39); log.push({ step: 'boss door', unlocked: await c.unlock(37, 36) });
  c.tp(37, 31); await c.tapTile(37, 22, 200);
  for (let i = 0; i < 30 && !sc.golem; i++) await step(10);
  for (let i = 0; i < 40 && sc.busy; i++) await step(10);
  const g = sc.golem;
  log.push({ step: 'shadow rises', boss: g?.bossName, level: g?.level });
  for (let i = 0; i < 300 && g?.alive; i++) {
    for (const o of sc.interactables.filter((q) => q.kind === 'plate' && !q.hidden)) { sc.tapWorld(o.x, o.y - 24); await step(50); }
    if (!g.armor) g.damage(300, sc.leader); await step(20); for (let k = 0; k < 20 && sc.busy; k++) await step(10);
  }
  await step(200);
  log.push({ step: 'shadow falls', dead: !g?.alive, flag: !!sc.flags.golemDefeated, gate: !!sc.arenaGate, valeVinesDead: sc.vines.filter((v) => v.ward.def.id === 'vale').map((v) => v.dead) });
  log.push({ step: 'back stairs', present: !!sc.interactables.find((o) => o.kind === 'warp' && o.warp.id === 'undercroftBack') });
  log.push({ errs: window.__errs || [] });
  return log;
}

export async function cave() {
  const log = [], sc = window.__scene;
  await enter('caveIn');
  const k = sc.dungeons.cave, solid = (x, y) => sc.nav.isSolid(x, y);
  log.push({ step: 'entered', area: sc.area, kit: !!k });
  log.push({ step: 'start', treasureGateShut: solid(220, 14), lowerOpen: !solid(215, 26) });
  const c = k.crystals[0];
  sc.party.forEach((h) => { h.x = 213 * 16 + 8; h.y = 23 * 16 + 8; });
  c.damage(1, sc.leader); await step(40);
  log.push({ step: 'hit switch', treasureGateOpen: !solid(220, 14), lowerShut: solid(215, 26) });
  sc.party.forEach((h) => { h.x = 222 * 16 + 8; h.y = 10 * 16 + 8; }); await step(10);
  c.damage(1, sc.leader); await step(40);
  log.push({ step: 'hit again on the way out', lowerOpen: !solid(215, 26) });
  log.push({ errs: window.__errs || [] });
  return log;
}

// An old save (made before the rebuild) loads into the new dungeons sensibly.
export async function migration() {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann'); st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  st.relics = ['grapple', 'tide'];
  Object.assign(st.flags, { chest_undercroftRelic: true, golemDefeated: true, chest_abbeyTide: true });
  st.pos = { x: 280 * 16 + 8, y: 40 * 16 + 8 }; // standing in the OLD Undercroft
  const sc = await boot({ state: st });
  const u = sc.dungeons.undercroft, a = sc.dungeons.abbey;
  const tile = [Math.floor(sc.leader.x / 16), Math.floor(sc.leader.y / 16)];
  return {
    placedAt: tile, area: sc.area,
    undercroft: { big: u.big, doorsUnlocked: u.doors.filter((d) => d.kind !== 'shutter').map((d) => `${d.kind}:${d.unlocked}`), fightsCleared: u.rooms.filter((r) => r.seal).map((r) => r.cleared) },
    abbey: { tideChestDone: !!sc.flags.chest_abbey_3, westChapelCleared: a.rooms.find((r) => r.foes.some((f) => f.ch === 'H'))?.cleared, westDoor: a.doors.find((d) => d.kind === 'key' && d.vertical)?.unlocked, otherKeyDoor: a.doors.find((d) => d.kind === 'key' && !d.vertical)?.unlocked, bossDoor: a.doors.find((d) => d.kind === 'boss')?.unlocked },
    errs: window.__errs || [],
  };
}
