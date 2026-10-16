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
