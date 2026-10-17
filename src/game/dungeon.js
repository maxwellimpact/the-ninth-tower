// Dungeon kit (C8): the puzzle pieces every hand-built dungeon draws from,
// driven by a text-grid layout in src/data/dungeons.json.
//
//   small keys + key doors, a big key (the boss door), push blocks onto floor
//   plates (plates latch, so a solved room stays solved), crystal switches
//   that swap which coloured pegs are raised, sealed fight rooms (the doors
//   slam shut until the room is clear, sometimes revealing a chest), hook
//   posts across chasms, cracked walls, map + compass.
//
// Rooms are found by flood-filling the floor between doors, so a layout only
// marks what is where; which door a plate opens or a fight seals follows from
// which room they share. Progress is saved in state.flags (dg_<id>); the
// Dungeon Lab runs the same dungeons with a test party and never saves.
//
// Sluices (the Abbey): a lever swaps the water between two basins ('w' / 'v'),
// like red and blue pegs. Drained basin floor is walkable; flooded needs the
// Tide Charm to swim.
import { Unit, Breakable, Golem, Murk, Huntsman, Vulk, Isolde, Malgrim } from './units.js';
import HERO_DATA from '../data/heroes.json';
import { audio } from '../audio/synth.js';
import DUNGEONS from '../data/dungeons.json';

const TILE = 16;
const px = (t) => t * TILE + TILE / 2;
const DOOR = { '=': 'shutter', k: 'key', K: 'boss', V: 'vault' };
const FOES = { h: 'hollow', R: 'rats' }; // defaults; a dungeon can list its own (def.foes)
const WALLISH = new Set(['#', ' ', '~', 'I', '_', '&']); // illusory walls and hidden bridges divide rooms like walls and chasms
const BASIN = { w: 'A', v: 'B' };
const T_WATER = 3; // map.js T.WATER
const key = (x, y) => `${x},${y}`;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A crystal switch: any hit (blade, arrow, spell, knife, the hook) flips it.
class Crystal extends Unit {
  constructor(scene, kit, tx, ty, zone) {
    super(scene, px(tx), px(ty), { key: 'dgCrystal_blue', maxHp: 1, team: 'enemy', r: 7 });
    this.kind = 'crystal'; this.kit = kit; this.tx = tx; this.ty = ty; this.zone = zone;
    this.engaged = false; this.cd = 0;
    this.def = { kind: 'crystal' }; this.hinted = true; // shares the breakables list
    this.sprite.setOrigin(0.5, 1).setPosition(this.x, this.y + 6).setDepth(this.y + 4);
    this.shadow.setAlpha(0.25);
  }
  damage(amount, src) {
    if (this.cd > 0) return 0;
    this.cd = 0.7;
    this.kit.toggle(this.zone, this);
    for (const h of this.scene.party) if (h.command?.target === this) h.command = null; // one hit, not a flurry
    return 0;
  }
  update(dt) { this.cd = Math.max(0, this.cd - dt); }
}

// A brazier (Witchroot Hollow): lit by a fire hit, or by anyone carrying the
// Lantern of Embers. A room's shutters stay shut until its braziers burn,
// like plates; lit braziers are lights in the dark.
class Brazier extends Unit {
  constructor(scene, kit, tx, ty, room) {
    super(scene, px(tx), px(ty), { key: 'dgBrazier', maxHp: 1, team: 'enemy', r: 6 });
    this.kind = 'brazier'; this.kit = kit; this.tx = tx; this.ty = ty; this.room = room;
    this.engaged = false; this.lit = false;
    this.def = { kind: 'brazier' }; this.hinted = true;
    this.sprite.setOrigin(0.5, 1).setPosition(this.x, this.y + 6).setDepth(this.y + 4);
    this.shadow.setAlpha(0.25);
  }
  damage(amount, src) {
    if (this.lit) return 0;
    const sc = this.scene;
    for (const h of sc.party) if (h.command?.target === this) h.command = null;
    if (this.lastElement === 'fire' || sc.state.relics.includes('lantern')) this.kit.light(this);
    else if (!this.kit.hinted.has('brazier')) { this.kit.hinted.add('brazier'); sc.bark(sc.leader, "IT WANTS A FLAME. A FIRE SPELL... OR THE LAMPLIGHTER'S LANTERN BACK IN BRIGHTWATER."); }
    this.lastElement = null;
    return 0;
  }
  setLit(on) {
    this.lit = on;
    if (on) this.sprite.play('dgBrazierLit'); else { this.sprite.stop(); this.sprite.setTexture('dgBrazier'); }
  }
  update() {}
}

export class DungeonKit {
  constructor(scene, id) {
    this.sc = scene;
    this.id = id;
    this.def = DUNGEONS[id];
    this.keys = 0; this.big = false; this.map = false; this.compass = false;
    this.cells = new Map();
    if (this.def.rows) {
      const [ox, oy] = this.def.origin;
      this.ox = ox; this.oy = oy;
      this.def.rows.forEach((row, y) => [...row].forEach((ch, x) => this.cells.set(key(ox + x, oy + y), ch)));
    } else {
      // overlay mode: an existing (noise-built) cave read from the world, with
      // puzzle pieces placed on top at absolute tiles
      const r = this.def.rect, w = scene.world;
      this.ox = r[0]; this.oy = r[1];
      for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) {
        const t = w.at(x, y);
        this.cells.set(key(x, y), t === T_WATER ? 'W' : scene.nav.isSolid(x, y) ? '#' : '.');
      }
      for (const [ch, x, y] of this.def.entities || []) this.cells.set(key(x, y), ch);
    }
    this.at = (x, y) => this.cells.get(key(x, y)) ?? '#';
    this.hinted = new Set();
    this.foeKinds = { ...FOES, ...(this.def.foes || {}) };
    this.lab = scene.state.lab === id;
    this.findRooms();
    this.build();
    if (this.lab && scene.state.labStart === 'boss') this.skipToBoss();
    else this.load();
    this.refreshDoors(true);
    this.refreshLens();
    this.buildVine();
    if (scene.area === this.def.area) this.emit();
  }

  // ------------------------------------------------------------- saving
  get saveKey() { return `dg_${this.id}`; }

  save(autosave = true) {
    if (this.lab) return;
    this.sc.flags[this.saveKey] = {
      k: this.keys, b: this.big, m: this.map, c: this.compass,
      d: this.doors.map((d, i) => (d.unlocked && d.kind !== 'shutter' ? i : -1)).filter((i) => i >= 0),
      p: this.plates.map((p, i) => (p.latched ? i : -1)).filter((i) => i >= 0),
      r: this.rooms.map((r, i) => (r.cleared ? i : -1)).filter((i) => i >= 0),
      z: this.zones.map((z) => [z.raised, z.flood]),
      f: this.braziers.map((b, i) => (b.lit ? i : -1)).filter((i) => i >= 0),
      s: (this.sunkLog || []),
      h: [...this.hinted],
    };
    if (autosave) this.sc.autosave('dungeon');
  }

  load() {
    const f = this.sc.flags, s = f[this.saveKey];
    if (s) {
      this.keys = s.k || 0; this.big = !!s.b; this.map = !!s.m; this.compass = !!s.c;
      for (const i of s.d || []) if (this.doors[i]) this.doors[i].unlocked = true;
      for (const i of s.p || []) { const p = this.plates[i]; if (p) { p.latched = true; p.s.setTexture('dgPlateDown'); } }
      for (const i of s.r || []) { const r = this.rooms[i]; if (r) { r.cleared = true; r.entered = true; } }
      (s.z || []).forEach(([raised, flood], i) => { const z = this.zones[i]; if (z) { z.raised = raised; z.flood = flood; this.applyPegs(z, true); this.applyWater(z, true); } });
      for (const h of s.h || []) this.hinted.add(h);
      for (const i of s.f || []) if (this.braziers[i]) this.light(this.braziers[i], true);
      for (const [x0, y0, x, y] of s.s || []) { const b = this.blocks.find((k) => k.heavy && k.x0 === x0 && k.y0 === y0); if (b) { this.sc.nav.unblock(b.x, b.y); b.x = x; b.y = y; this.sink(b, true); this.sunkLog.push([x0, y0, x, y]); } }
    } else this.migrate();
    for (const c of this.chests) {
      if (f[`chest_${c.id}`]) { c.opened = true; c.img?.setTexture('chestOpen'); }
      if (c.reveal && !c.placed && c.room.cleared) this.placeChest(c); // a fight already won: its prize is there
    }
  }

  // A save from before this dungeon was rebuilt: carry its progress over. Its
  // relic already found -> that room is done; its boss already beaten ->
  // everything is open.
  migrate() {
    const sc = this.sc, f = sc.flags, d = this.def;
    // only saves from before the rebuild: the old dungeon's relic chest was opened
    const relicChest = d.relicChest && this.chests.find((c) => c.ch === d.relicChest);
    if (relicChest && d.oldRelicChest && f[`chest_${d.oldRelicChest}`]) {
      f[`chest_${relicChest.id}`] = true;
      const r = relicChest.room; r.cleared = true; r.entered = true;
      for (const door of r.doors) if (door.kind === 'key') door.unlocked = true;
    }
    if (d.boss?.flag && f[d.boss.flag]) {
      this.big = true;
      for (const door of this.doors) if (door.kind === 'key' || door.kind === 'boss') door.unlocked = true;
      for (const p of this.plates) { p.latched = true; p.s.setTexture('dgPlateDown'); }
      for (const r of this.rooms) if (r.seal) { r.cleared = true; r.entered = true; }
      for (const b of this.braziers) this.light(b, true);
    }
  }

  // Boss test: everything up to the great door is done (Grapple, Seal, door
  // open), and a wipe puts you back in the corridor for another go.
  skipToBoss() {
    const st = this.sc.state;
    for (const r of this.def.bossRelics || ['grapple']) if (!st.relics.includes(r)) st.relics.push(r);
    this.big = true;
    for (const d of this.doors) if (d.kind === 'boss') d.unlocked = true;
    // and the rooms before it count as solved, so you can walk back out
    for (const p of this.plates) { p.latched = true; p.s.setTexture('dgPlateDown'); }
    for (const r of this.rooms) if (r.seal) { r.entered = true; r.cleared = true; }
    for (const b of this.braziers) this.light(b, true);
    const s = dungeonStart(this.id, 'boss');
    this.respawn = { x: s.x, y: s.y };
    this.restock = { ...st.potions }; // every retry starts with the same supplies
    for (const h of this.hints) this.hinted.add(h.text); // no tutorial hints on a boss rerun
  }

  // The cursed vine (C12): grows in from the entrance, through the dungeon and
  // under the great door to the sacred place where the Shadow stands, draining
  // it. Same painter as the real wards' vines; withers when the Shadow breaks.
  buildVine() {
    const route = this.def.vine;
    if (!route || !this.sc.paintVine) return;
    const sc = this.sc;
    this.ward = { def: { id: this.id } }; // stands in for a Ward Stone (texture key, thoughts)
    const v = { ward: this.ward, i: 1, n: 2, seed: 991, dead: false, stoneEnd: false, diveEnd: false, source: true };
    v.pts = sc.vinePath(sc.growVineRoute(route.map(([x, y]) => [this.ox + x, this.oy + y])));
    v.len = v.pts[v.pts.length - 1].d;
    sc.paintVine(v);
    (sc.vines ??= []).push(v);
    this.vine = v;
    this.thinkT = 2; // first thought once the curtain is up, before the room hint
  }

  witherVine() { if (this.vine && !this.vine.dead) this.sc.witherVines(this.ward); }

  // ------------------------------------------------------------- layout
  findRooms() {
    // flood-fill the grid into connected groups of tiles; `into` maps tile -> group
    const fill = (blocked, into) => {
      const groups = [];
      for (const [k, ch] of this.cells) {
        if (blocked(ch) || into.has(k)) continue;
        const id = groups.length, tiles = [], q = [k];
        into.set(k, id);
        while (q.length) {
          const c = q.pop(); tiles.push(c);
          const [x, y] = c.split(',').map(Number);
          for (const [dx, dy] of DIRS) { const n = key(x + dx, y + dy); if (!into.has(n) && this.cells.has(n) && !blocked(this.cells.get(n))) { into.set(n, id); q.push(n); } }
        }
        groups.push(tiles);
      }
      return groups;
    };
    // rooms: floor between walls, chasms and doors
    this.roomOf = new Map();
    this.rooms = fill((ch) => WALLISH.has(ch) || DOOR[ch] || ch === 'Y', this.roomOf).map((tiles, id) => ({ id, tiles, foes: [], plates: [], blocks: [], doors: new Set(), seal: false, cleared: false, active: false, entered: false }));
    // crystal zones: like rooms, but chasms don't divide them (a switch on a
    // pillar works the pegs on the ledge you shoot it from)
    this.zoneOf = new Map();
    this.zones = fill((ch) => ch === '#' || ch === ' ' || DOOR[ch] || ch === 'Y', this.zoneOf).map(() => ({ raised: 'blue', flood: 'A', pegs: [], crystals: [], basins: [], levers: [] }));
  }

  build() {
    const sc = this.sc;
    this.doors = []; this.blocks = []; this.plates = []; this.chests = []; this.crystals = []; this.braziers = []; this.illusions = []; this.bridges = []; this.sunkLog = [];
    const seen = new Set();
    for (const [k, ch] of this.cells) {
      const [x, y] = k.split(',').map(Number);
      const lx = x - this.ox, ly = y - this.oy;
      const room = this.rooms[this.roomOf.get(k)];
      if (DOOR[ch] && !seen.has(k)) this.addDoor(x, y, ch, seen);
      else if (ch === '@') this.start = { x, y };
      else if (ch === 'F') this.addCampfire(x, y);
      else if (ch === 'B' || ch === 'O') { const b = { x, y, x0: x, y0: y, room, heavy: ch === 'O', s: sc.add.image(px(x), px(y) + 8, ch === 'O' ? 'dgBoulder' : 'dgBlock').setOrigin(0.5, 1).setDepth(px(y) + 2) }; sc.nav.block(x, y); this.blocks.push(b); room.blocks.push(b); b.o = sc.addInteractable({ x: px(x), y: px(y), reach: 24, standOff: 12, h: 16, kind: 'block', interact: (h) => this.pushFrom(b, h) }); }
      else if (ch === 'P') { const p = { x, y, room, latched: false, s: sc.add.image(px(x), px(y), 'dgPlate').setDepth(-30) }; this.plates.push(p); room.plates.push(p); }
      else if (ch === 'b' || ch === 'r') { const z = this.zones[this.zoneOf.get(k)]; z.pegs.push({ x, y, color: ch === 'b' ? 'blue' : 'red', s: sc.add.image(px(x), px(y) + 6, 'dgPeg_blue_up').setOrigin(0.5, 1) }); }
      else if (this.def.posts?.[ch]) this.addPost(x, y, ch); // a dungeon's own post letters win over shared ones
      else if (BASIN[ch]) { const z = this.zones[this.zoneOf.get(k)]; z.basins.push({ x, y, side: BASIN[ch], s: sc.add.image(px(x), px(y), 'dgWater').setDepth(-29) }); }
      else if (ch === 'L') { const z = this.zones[this.zoneOf.get(k)]; const l = { x, y, z, s: sc.add.image(px(x), px(y) + 6, 'dgLever_A').setOrigin(0.5, 1).setDepth(px(y)) }; sc.nav.block(x, y); z.levers.push(l); l.o = sc.addInteractable({ x: px(x), y: px(y), reach: 24, standOff: 12, h: 18, kind: 'lever', interact: (h) => this.pull(l, h) }); }
      else if (ch === 'C') { const z = this.zones[this.zoneOf.get(k)]; const c = new Crystal(sc, this, x, y, z); z.crystals.push(c); this.crystals.push(c); sc.breakables.push(c); sc.nav.block(x, y); }
      else if (ch === 'X') {
        // reinforced wall: only the Stone Gauntlets break it
        const face = !WALLISH.has(this.at(x, y + 1)) && this.at(x, y + 1) !== 'X';
        const bid = `${this.id}_${lx}_${ly}`;
        if (!sc.flags[`broke_${bid}`]) {
          const b = new Breakable(sc, { id: bid, kind: 'wall', reinforced: true, tex: face ? 'dgReinforcedFace' : 'dgReinforcedTop', x, y, hp: 60, tiles: [[x, y]] });
          sc.nav.block(x, y); sc.breakables.push(b);
        }
      }
      else if (ch === '%') {
        // cracked wall: drawn to match a wall face (floor below it) or a wall run seen from above
        const face = !WALLISH.has(this.at(x, y + 1)) && this.at(x, y + 1) !== '%';
        const bid = `${this.id}_${lx}_${ly}`;
        if (!sc.flags[`broke_${bid}`]) {
          const b = new Breakable(sc, { id: bid, kind: 'wall', tex: face ? 'dgCrackFace' : 'dgCrackTop', x, y, hp: 60, tiles: [[x, y]] });
          sc.nav.block(x, y); sc.breakables.push(b);
        }
      }
      else if (ch === '*') { const b = new Brazier(sc, this, x, y, room); this.braziers.push(b); (room.braziers ??= []).push(b); sc.breakables.push(b); sc.nav.block(x, y); }
      else if (ch === 'I') this.illusions.push({ x, y });
      else if (ch === 'J') this.addGlide(x, y);
      else if (ch === 'M') this.addFrozen(x, y, room);
      else if (ch === '_') this.bridges.push({ x, y });
      else if (/[1-9]/.test(ch)) this.addChest(x, y, ch, room);
      else if (this.foeKinds[ch] || this.def.elite?.[ch]) room.foes.push({ ch, x, y });
      else if (ch === '!') room.seal = true;
      else if (ch === 'G') this.bossAt = { x, y };
      else if (ch === 'g') this.gateAt = { x, y };
    }
    this.pegAt = new Set(this.zones.flatMap((z) => z.pegs.map((p) => key(p.x, p.y))));
    for (const z of this.zones) this.applyPegs(z, true);
    this.waterAt = new Set(this.zones.flatMap((z) => z.basins.map((b) => key(b.x, b.y))));
    for (const z of this.zones) this.applyWater(z, true);
    // which doors each room touches
    for (const d of this.doors) for (const [x, y] of d.tiles) for (const [dx, dy] of DIRS) {
      const r = this.roomOf.get(key(x + dx, y + dy));
      if (r !== undefined) { this.rooms[r].doors.add(d); d.rooms.add(this.rooms[r]); }
    }
    // hints: shown the first time the leader walks into the room they sit in
    this.hints = (this.def.hints || []).map((h) => ({ ...h, room: this.roomOf.get(key(this.ox + h.at[0], this.oy + h.at[1])) }));
  }

  addDoor(x0, y0, ch, seen) {
    const tiles = [], q = [[x0, y0]]; seen.add(key(x0, y0));
    while (q.length) {
      const [x, y] = q.pop(); tiles.push([x, y]);
      for (const [dx, dy] of DIRS) { const k = key(x + dx, y + dy); if (!seen.has(k) && this.cells.get(k) === ch) { seen.add(k); q.push([x + dx, y + dy]); } }
    }
    const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]);
    const vertical = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2 * TILE, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2 * TILE;
    const kind = DOOR[ch];
    const tex = `dgDoor_${kind}_${vertical ? 'v' : 'h'}`;
    const s = vertical ? this.sc.add.image(cx, cy, tex).setDepth(cy + 16) : this.sc.add.image(cx, (Math.max(...ys) + 1) * TILE, tex).setOrigin(0.5, 1).setDepth((Math.max(...ys) + 1) * TILE);
    const d = { kind, tiles, vertical, cx, cy, s, tex, rooms: new Set(), unlocked: kind === 'shutter', closed: null };
    // the spot you walk to: the middle floor tile on either side of the door
    // (update() keeps it on the leader's side)
    const sorted = [...tiles].sort((a, b) => (vertical ? a[1] - b[1] : a[0] - b[0]));
    const m = sorted[Math.floor(sorted.length / 2)];
    d.sides = vertical ? [[m[0] - 1, m[1]], [m[0] + 1, m[1]]] : [[m[0], m[1] - 1], [m[0], m[1] + 1]];
    if (kind !== 'shutter') d.o = this.sc.addInteractable({ x: px(d.sides[1][0]), y: px(d.sides[1][1]), reach: 22, standOff: 0, h: 20, kind: 'door', interact: () => this.tryUnlock(d) });
    this.doors.push(d);
  }

  addCampfire(x, y) {
    const sc = this.sc;
    this.camp = { x, y };
    sc.add.sprite(px(x), px(y) + 6, 'campfire').setOrigin(0.5, 1).play('campfire').setDepth(px(y));
    sc.nav.block(x, y);
    sc.addInteractable({ x: px(x), y: px(y), reach: 26, h: 20, kind: 'campfire', interact: () => { sc.flags[`camp_${x}_${y}`] = true; sc.rest(); } });
  }

  addChest(x, y, ch, room) {
    const c = { ...(this.def.chests?.[ch] || {}), x, y, ch, room, opened: false };
    c.id = `${this.id}_${ch}`;
    if (c.ambush) c.ambush = c.ambush.map(([k, ax, ay]) => [k, this.ox + ax, this.oy + ay]);
    this.chests.push(c);
    if (!c.reveal) this.placeChest(c);
  }

  placeChest(c) {
    const sc = this.sc;
    c.img = sc.add.image(px(c.x), px(c.y) + 4, c.opened ? 'chestOpen' : 'chest').setOrigin(0.5, 1).setDepth(px(c.y));
    sc.nav.block(c.x, c.y);
    c.o = sc.addInteractable({ x: px(c.x), y: px(c.y), reach: 22, h: 14, kind: 'chest', interact: (h) => this.openChest(c, h) });
    c.placed = true;
  }

  addPost(x, y, ch) {
    const sc = this.sc, p = this.def.posts[ch];
    // land next to the pair post, offset as authored
    const pair = [...this.cells].find(([, c]) => c === p.pair);
    const [pxT, pyT] = pair[0].split(',').map(Number);
    sc.add.image(px(x), px(y) + 4, 'post').setOrigin(0.5, 1).setDepth(px(y));
    sc.add.image(px(x) + 1, px(y) + 3, 'shadow').setAlpha(0.2).setDepth(-4);
    sc.nav.block(x, y);
    sc.addInteractable({ x: px(x), y: px(y), reach: 34, standOff: 14, h: 20, kind: 'post', id: `${this.id}_${ch}`, pair: `${this.id}_${p.pair}`, land: [pxT + p.land[0], pyT + p.land[1]], interact: (h, o) => sc.grapple(o) });
  }

  // A glide pad (Rimeglass Spire): a wind vent on the lip of a chasm. With the
  // Gale Cloak, tap it and the party glides straight across to the far lip.
  addGlide(x, y) {
    const sc = this.sc;
    const dir = DIRS.find(([dx, dy]) => this.at(x + dx, y + dy) === '~');
    if (!dir) return;
    let land = null;
    for (let k = 1; k <= 16 && !land; k++) { const c = this.at(x + dir[0] * k, y + dir[1] * k); if (c !== '~') land = WALLISH.has(c) ? null : [x + dir[0] * k, y + dir[1] * k]; if (c !== '~') break; }
    if (!land) return;
    sc.add.sprite(px(x), px(y), 'windvent').setDepth(-24).play('windvent');
    sc.addInteractable({ x: px(x), y: px(y), reach: 24, standOff: 2, h: 12, kind: 'glide', interact: () => {
      if (sc.busy) return;
      if (!sc.state.relics.includes('cloak')) { if (!this.hinted.has('glide')) { this.hinted.add('glide'); } sc.bark(sc.leader, 'THE WIND ROARS UP OUT OF THE CHASM. WITH SOMETHING TO CATCH IT, WE COULD GLIDE ACROSS.'); return; }
      sc.leader.x = px(x); sc.leader.y = px(y);
      sc.glideTo(px(land[0]), px(land[1]), () => sc.autosave('glide'));
    } });
  }

  // Mirelle, frozen in the Spire (Thaw): she stands encased in the room with
  // the braziers; when they all burn, the ice melts and she joins.
  addFrozen(x, y, room) {
    const sc = this.sc;
    if (sc.state.recruited.includes('mirelle')) return;
    const s = sc.add.sprite(px(x), px(y), 'mirelle', 'idle_down_0').setOrigin(0.5, 0.75).setTint(0xc8f0ff).setDepth(px(y));
    const ice = sc.add.image(px(x), px(y) + 6, 'iceblock').setOrigin(0.5, 1).setScale(1.3, 1.5).setAlpha(0.42).setDepth(px(y) + 1);
    sc.nav.block(x, y);
    const o = sc.addInteractable({ x: px(x), y: px(y), reach: 30, standOff: 20, h: 24, kind: 'npc', interact: () => sc.bark(sc.leader, (room.braziers || []).length ? "THERE'S SOMEONE IN THERE, FROZEN SOLID. THOSE BRAZIERS - IF WE LIT THEM, MAYBE THE ICE WOULD GIVE." : "THERE'S SOMEONE FROZEN IN THERE.") });
    this.frozen = { x, y, room, s, ice, o };
  }

  checkThaw() {
    const f = this.frozen, sc = this.sc;
    if (!f || f.thawing || !(f.room.braziers || []).every((b) => b.lit)) return;
    f.thawing = true;
    sc.time.delayedCall(600, () => {
      sc.fx.burst('foam', px(f.x), px(f.y) - 10, 30); audio.sfx('bash', { pitch: 1.6 }); sc.shake(200, 0.006);
      f.ice.destroy(); f.s.clearTint(); sc.nav.unblock(f.x, f.y); sc.removeInteractable(f.o);
      const lines = (HERO_DATA.find((h) => h.id === 'mirelle')?.recruit || []).map((text) => ({ who: 'MIRELLE', text }));
      sc.events.emit('dialogue', lines, () => { f.s.destroy(); this.frozen = null; sc.addRecruit('mirelle', px(f.x), px(f.y), true); });
    });
  }

  // ------------------------------------------------------------- doors
  // A door is shut if a fight in a room it borders is under way, or (shutters)
  // a room it borders has plates that aren't all down, or (key / boss) it's
  // still locked.
  doorShut(d) {
    for (const r of d.rooms) if (r.active) return true;
    if (d.kind !== 'shutter') return !d.unlocked;
    for (const r of d.rooms) if (r.plates.length && !r.plates.every((p) => p.latched)) return true;
    for (const r of d.rooms) if (r.braziers?.length && !r.braziers.every((b) => b.lit)) return true;
    return false;
  }

  // ------------------------------------------------------------- braziers
  light(b, silent = false) {
    if (b.lit) return;
    b.setLit(true);
    const sc = this.sc;
    if (!silent) {
      audio.sfx('fireImpact'); sc.fx.burst('ember', b.x, b.y - 14, 14);
      const left = b.room.braziers.filter((q) => !q.lit).length;
      if (left) sc.floatText(b.x, b.y - 28, `${left} MORE`, 'fontPlain');
      this.save(!left);
    }
    this.refreshDoors(silent);
    this.checkThaw();
  }

  // ------------------------------------------------------------- the Lens
  // Illusory walls and hidden bridges: solid wall / open chasm until the party
  // holds the Seer's Lens, then a walkable shimmer / a bridge of light.
  refreshLens() {
    const sc = this.sc, on = sc.state.relics.includes('lens');
    if (on === this.lensOn) return;
    this.lensOn = on;
    for (const t of this.illusions) {
      if (on) {
        sc.nav.unblock(t.x, t.y);
        t.s ??= sc.add.sprite(px(t.x), (t.y + 1) * TILE, 'dgFalseWall').setOrigin(0.5, 1).play('dgFalseWall').setAlpha(0.5).setDepth((t.y + 1) * TILE + 2);
      } else { sc.nav.block(t.x, t.y); t.s?.destroy(); t.s = null; }
    }
    for (const t of this.bridges) {
      if (on) { sc.nav.unblock(t.x, t.y); t.s ??= sc.add.image(px(t.x), px(t.y), 'dgSpiritBridge').setAlpha(0.85).setDepth(-30); }
      else { sc.nav.block(t.x, t.y); t.s?.destroy(); t.s = null; }
    }
  }

  // light sources in this (dark) dungeon for Game.updateDarkness
  lights() { return this.braziers.filter((b) => b.lit); }

  refreshDoors(silent = false) {
    const sc = this.sc;
    let opened = false, closed = false;
    for (const d of this.doors) {
      const shut = this.doorShut(d);
      if (shut === d.closed) continue;
      if (d.closed !== null) { if (shut) closed = true; else opened = true; }
      d.closed = shut;
      // a sealed key/boss door shows bars over its open frame
      const sealed = shut && d.unlocked && d.kind !== 'shutter';
      d.s.setTexture(sealed ? `dgDoor_shutter_${d.vertical ? 'v' : 'h'}` : shut ? d.tex : `${d.tex}_open`);
      for (const [x, y] of d.tiles) { if (shut) sc.nav.block(x, y); else sc.nav.unblock(x, y); }
      if (shut) { const into = [...d.rooms].find((r) => r.active); for (const u of [...sc.party, ...sc.enemies.filter((e) => e.alive)]) this.evict(u, d.tiles, into); }
      if (d.o) d.o.hidden = !shut || d.unlocked;
    }
    if (silent) return;
    if (closed) { audio.sfx('doorClose'); sc.shake(160, 0.006); }
    if (opened) audio.sfx('doorOpen');
  }

  tryUnlock(d) {
    const sc = this.sc, L = sc.leader;
    if (d.unlocked) return;
    const vault = this.def.vault;
    if (d.kind === 'key' && this.keys > 0) { this.keys--; d.unlocked = true; }
    else if (d.kind === 'boss' && this.big) d.unlocked = true;
    else if (d.kind === 'vault' && sc.state.relics.includes(vault?.relic)) { d.unlocked = true; sc.events.emit('banner', 'SEALED VAULT', vault.open || 'THE SEAL ANSWERS AND THE DOOR GRINDS OPEN'); }
    else {
      sc.bark(L, d.kind === 'boss' ? (this.def.bossLock || 'A GREAT SEALED DOOR. THE LOCK IS SHAPED LIKE A WARDEN\'S CREST.') : d.kind === 'vault' ? (vault?.locked || 'A SEALED VAULT. THIS NEEDS SOMETHING WE DON\'T HAVE YET.') : 'LOCKED. THERE MUST BE A KEY SOMEWHERE DOWN HERE.');
      audio.sfx('block');
      return;
    }
    audio.sfx('unlock'); audio.sfx('chest');
    sc.fx.burst('gold', d.cx, d.cy, 16);
    this.refreshDoors();
    this.emit();
    this.save();
  }

  // anyone whose footprint is caught in tiles that just turned solid steps
  // clear: into `room` if given (the fight that just sealed), else to the
  // nearest open floor
  evict(u, tiles, room = null) {
    const r = u.r || 5;
    const hit = (x, y) => tiles.some(([a, b]) => a === Math.floor(x / TILE) && b === Math.floor(y / TILE));
    const caught = [[-r, -r * 0.6], [r, -r * 0.6], [-r, r * 0.6], [r, r * 0.6], [0, 0]].some(([ox, oy]) => hit(u.x + ox, u.y + oy));
    const tx = Math.floor(u.x / TILE), ty = Math.floor(u.y / TILE);
    if (!caught && !this.sc.nav.isSolid(tx, ty)) return;
    let best = null, bd = Infinity;
    for (const [x, y] of tiles) for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (this.sc.nav.isSolid(nx, ny)) continue;
      if (room && this.roomOf.get(key(nx, ny)) !== room.id) continue;
      const d = Math.hypot(px(nx) - u.x, px(ny) - u.y);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    best ??= this.sc.nav.nearestOpen(tx, ty, 4);
    if (best) { u.x = px(best[0]); u.y = px(best[1]); u.clearPath?.(); u.sync?.(0); }
  }

  // ------------------------------------------------------------- blocks
  pushFrom(b, h) {
    if (b.heavy && !this.sc.state.relics.includes('gauntlets')) {
      audio.sfx('block');
      if (!this.hinted.has('heavy')) { this.hinted.add('heavy'); this.sc.bark(h || this.sc.leader, "IT WON'T EVEN ROCK. WE'D NEED THE STRENGTH OF A GIANT FOR THIS ONE."); }
      return;
    }
    const dx = b.x * TILE + 8 - h.x, dy = b.y * TILE + 8 - h.y;
    if (Math.abs(dx) > Math.abs(dy)) this.push(b, Math.sign(dx), 0, h); else this.push(b, 0, Math.sign(dy), h);
  }

  push(b, dx, dy, h) {
    const sc = this.sc;
    if (b.moving) { b.queued = { dx, dy, h }; return true; } // a quick second tap waits for the slide, never lost
    if (b.heavy && !sc.state.relics.includes('gauntlets')) return false;
    const nx = b.x + dx, ny = b.y + dy;
    const occupied = sc.enemies.some((e) => e.alive && Math.floor(e.x / TILE) === nx && Math.floor(e.y / TILE) === ny);
    const intoLava = b.heavy && this.at(nx, ny) === '&' && !this.filled?.has(key(nx, ny)); // a boulder rolls into lava and fills it
    if (!intoLava && (sc.nav.isSolid(nx, ny) || occupied || this.roomOf.get(key(nx, ny)) !== b.room.id)) {
      audio.sfx('block');
      if (!this.hinted.has('stuck')) { this.hinted.add('stuck'); sc.bark(h || sc.leader, 'IT WON\'T BUDGE THAT WAY.'); }
      return false;
    }
    b.moving = true;
    sc.nav.unblock(b.x, b.y); sc.nav.block(nx, ny);
    b.x = nx; b.y = ny;
    audio.sfx('push');
    sc.fx.dust(b.s.x, b.s.y);
    sc.tweens.add({ targets: b.s, x: px(nx), y: px(ny) + 8, duration: 160, ease: 'Sine.easeOut', onUpdate: () => b.s.setDepth(b.s.y - 6), onComplete: () => {
      b.moving = false;
      if (intoLava) { this.sink(b); this.save(); return; }
      b.o.x = px(nx); b.o.y = px(ny);
      for (const u of sc.party) this.evict(u, [[nx, ny]]);
      this.checkPlates();
      if (b.queued) { const q = b.queued; b.queued = null; this.push(b, q.dx, q.dy, q.h); }
    } });
    if (h) { h.face(dx, dy); h.anim = ''; h.play('attack'); }
    return true;
  }

  // a heavy boulder in the lava: it sinks to a cooling slab you can walk on
  sink(b, silent = false) {
    const sc = this.sc;
    (this.filled ??= new Set()).add(key(b.x, b.y));
    b.sunk = true;
    if (!silent) this.sunkLog.push([b.x0, b.y0, b.x, b.y]);
    sc.nav.unblock(b.x, b.y);
    b.s.setTexture('dgBoulderSunk').setOrigin(0.5).setPosition(px(b.x), px(b.y)).setDepth(-30);
    sc.removeInteractable(b.o);
    this.blocks = this.blocks.filter((k) => k !== b);
    b.room.blocks = b.room.blocks.filter((k) => k !== b);
    this.cells.set(key(b.x, b.y), '.');
    if (!silent) {
      audio.sfx('fireImpact'); audio.sfx('push', { pitch: 0.6 });
      sc.fx.burst('ember', px(b.x), px(b.y) - 4, 20); sc.shake(200, 0.006);
      if (!this.hinted.has('sink')) { this.hinted.add('sink'); sc.bark(sc.leader, 'IT SANK! THE LAVA COOLED OVER IT - WE CAN WALK ON THAT.'); }
    }
  }

  // leaving a room with its puzzle unsolved puts the blocks back
  resetBlocks(room) {
    if (!room.plates.length || room.plates.every((p) => p.latched)) return;
    for (const b of room.blocks) {
      if (b.x === b.x0 && b.y === b.y0) continue;
      this.sc.nav.unblock(b.x, b.y); this.sc.nav.block(b.x0, b.y0);
      b.x = b.x0; b.y = b.y0;
      b.s.setPosition(px(b.x), px(b.y) + 8).setDepth(px(b.y) + 2);
      b.o.x = px(b.x); b.o.y = px(b.y);
      this.sc.fx.puff(b.s.x, b.s.y - 8, 'spark');
    }
  }

  checkPlates() {
    const L = this.sc.leader;
    const lt = [Math.floor(L.x / TILE), Math.floor(L.y / TILE)];
    for (const p of this.plates) {
      if (p.latched) continue;
      const onBlock = this.blocks.some((b) => b.x === p.x && b.y === p.y && !b.moving);
      if (!onBlock && !(lt[0] === p.x && lt[1] === p.y)) continue;
      p.latched = true;
      p.s.setTexture('dgPlateDown');
      audio.sfx('click'); audio.sfx('block', { pitch: 0.6 });
      this.sc.fx.burst('gold', px(p.x), px(p.y), 8);
      const left = p.room.plates.filter((q) => !q.latched).length;
      if (left) this.sc.floatText(px(p.x), px(p.y) - 14, `${left} MORE`, 'fontPlain');
      this.save(!left);
    }
    this.refreshDoors();
  }

  // ------------------------------------------------------------- pegs
  toggle(z, c) {
    z.raised = z.raised === 'blue' ? 'red' : 'blue';
    audio.sfx('frost', { pitch: 1.5 }); audio.sfx('block', { pitch: 1.4 });
    if (c) this.sc.fx.burst('spark', c.x, c.y - 12, 10);
    this.applyPegs(z);
    this.save(false);
  }

  applyPegs(z, silent = false) {
    const sc = this.sc;
    for (const c of z.crystals) c.sprite.setTexture(`dgCrystal_${z.raised}`);
    for (const p of z.pegs) {
      const up = p.color === z.raised;
      p.s.setTexture(`dgPeg_${p.color}_${up ? 'up' : 'down'}`).setDepth(up ? px(p.y) + 4 : -30);
      if (up) { sc.nav.block(p.x, p.y); for (const u of [...sc.party, ...sc.enemies.filter((e) => e.alive)]) this.evict(u, [[p.x, p.y]]); }
      else sc.nav.unblock(p.x, p.y);
      if (!silent && up) sc.fx.dust(px(p.x), px(p.y) + 4);
    }
  }

  // raised pegs are low posts and flooded basins are water: shots pass over both
  lowAt(x, y) { const k = key(Math.floor(x / TILE), Math.floor(y / TILE)); return this.pegAt.has(k) || this.waterAt.has(k); }

  // ------------------------------------------------------------- sluices
  pull(l, h) {
    const z = l.z, sc = this.sc;
    z.flood = z.flood === 'A' ? 'B' : 'A';
    if (h) { h.face(l.x * TILE + 8 - h.x, l.y * TILE + 8 - h.y); h.anim = ''; h.play('attack'); }
    audio.sfx('rumble'); audio.sfx('doorOpen');
    sc.shake(200, 0.004);
    this.applyWater(z);
    if (!this.hinted.has('sluice')) { this.hinted.add('sluice'); sc.bark(h || sc.leader, 'THE WATER SHIFTED TO THE OTHER BASIN!'); }
    this.save(false);
  }

  applyWater(z, silent = false) {
    const sc = this.sc;
    for (const l of z.levers) l.s.setTexture(`dgLever_${z.flood}`);
    for (const b of z.basins) {
      const wet = b.side === z.flood;
      b.s.setVisible(wet);
      if (wet) {
        sc.nav.block(b.x, b.y, 2); // water: open to swimmers only
        for (const u of [...sc.party.filter((h) => !sc.canSwim), ...sc.enemies.filter((e) => e.alive && !e.boss && !e.s.swim)]) this.evict(u, [[b.x, b.y]]);
      } else sc.nav.unblock(b.x, b.y);
      if (!silent && wet) sc.fx.burst('foam', px(b.x), px(b.y), 2);
    }
  }

  // The Grapple reaches switches nobody can walk to.
  hook(c) {
    const sc = this.sc, L = sc.leader;
    L.face(c.x - L.x, c.y - L.y); L.anim = ''; L.play('attack');
    const line = sc.add.graphics().setDepth(100000 - 18);
    const t = { k: 0 };
    audio.sfx('zip');
    sc.tweens.add({ targets: t, k: 1, duration: 180, yoyo: true, hold: 60, onUpdate: () => {
      line.clear().lineStyle(1, 0xc4cfe2, 1).lineBetween(L.x, L.y - 12, L.x + (c.x - L.x) * t.k, L.y - 12 + (c.y - 12 - L.y + 12) * t.k);
    }, onYoyo: () => c.damage(1, L), onComplete: () => line.destroy() });
  }

  // ------------------------------------------------------------- chests
  openChest(c, h) {
    const sc = this.sc;
    if (c.opened) { sc.events.emit('dialogue', [{ who: 'CHEST', text: "IT'S EMPTY. YOU ALREADY LOOTED IT." }]); return; }
    c.opened = true;
    if (!c.key) {
      // ordinary loot (and the relic) through the game's own chest code
      sc.openChest({ id: c.id, gold: c.gold, items: c.items, potions: c.potions, mats: c.mats, relic: c.relic, ambush: c.ambush }, c.img, h);
      return;
    }
    sc.flags[`chest_${c.id}`] = true;
    c.img.setTexture('chestOpen');
    audio.sfx('chest');
    sc.fx.burst('gold', c.img.x, c.img.y - 10, 24);
    if (c.key === 'small') { this.keys++; audio.sfx('levelUp'); sc.events.emit('banner', 'SMALL KEY', c.say || 'IT OPENS ONE LOCKED DOOR'); }
    else {
      const card = { big: [this.def.bigKey || 'WARDEN\'S SEAL', 'seal'], map: ['DUNGEON MAP', 'map'], compass: ['COMPASS', 'compass'] }[c.key];
      if (c.key === 'big') this.big = true;
      if (c.key === 'map') { this.map = true; this.revealMap(); }
      if (c.key === 'compass') this.compass = true;
      sc.scene.pause(); audio.sfx('levelUp');
      sc.events.emit('keyItem', { name: card[0], icon: `dgIcon_${card[1]}`, text: c.say || '' }, () => sc.scene.resume());
    }
    if (c.ambush) sc.time.delayedCall(900, () => { for (const [k, x, y] of c.ambush) sc.spawnEnemy(k, px(x), px(y), true); sc.bark(h, this.def.ambushLine || 'THE ARMOUR IS MOVING!'); });
    this.emit();
    this.save();
  }

  revealMap() {
    for (const r of this.rooms) for (const k of r.tiles) { const [x, y] = k.split(',').map(Number); this.sc.minimap.reveal(x, y, 1); }
    this.sc.minimap.flush();
  }

  // compass: unopened chests and the boss on the minimap / map
  markers() {
    if (!this.compass) return [];
    const m = this.chests.filter((c) => !c.opened).map((c) => ({ x: c.x, y: c.y, kind: 'chest', always: true }));
    if (this.bossAt && !this.sc.flags[this.bossFlag]) m.push({ ...this.bossAt, kind: 'boss', always: true });
    return m;
  }

  emit() { this.sc.events.emit('dungeon', { keys: this.keys, big: this.big, map: this.map, compass: this.compass }); }

  // ------------------------------------------------------------- boss
  get bossFlag() { return this.def.boss?.flag || `${this.id}_boss`; }

  // The dungeon's boss (its lieutenant's Shadow) for Game.updateBoss: base
  // config from world.json (def.boss.cfg), the arena from the layout.
  bossDef(W) {
    if (this._bossDef !== undefined) return this._bossDef;
    if (!this.bossAt || !this.gateAt) return (this._bossDef = null);
    const sc = this.sc, room = this.rooms[this.roomOf.get(key(this.bossAt.x, this.bossAt.y))];
    const pts = room.tiles.map((k) => k.split(',').map(Number)).filter(([, y]) => y < this.gateAt.y);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const b = this.def.boss || {};
    const echo = !!b.echo; // a Ward Echo in the Ninth Tower: the true lieutenant, empowered, not a Shadow
    const cfg = { ...(W[b.cfg || 'boss'] || W.boss), ...b, arena: [this.bossAt.x, this.bossAt.y], shadow: !echo && b.kind !== 'malgrim', ward: null, drops: [] };
    if (echo) { cfg.hpMul = 1.25; cfg.dmgMul = 1.15; }
    if (this.lab && sc.state.labStart === 'boss' && b.labLevelBonus !== undefined) cfg.levelBonus = b.labLevelBonus;
    const arena = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const sh = !echo;
    const make0 = b.kind === 'murk'
      ? (x, y, o) => new Murk(sc, x, y, { ...o, shadow: sh, arena, pool: b.pool })
      : b.kind === 'huntsman'
        ? (x, y, o) => new Huntsman(sc, x, y, { ...o, shadow: sh, arena })
        : b.kind === 'vulk'
          ? (x, y, o) => new Vulk(sc, x, y, { ...o, shadow: sh, arena })
        : b.kind === 'isolde'
          ? (x, y, o) => new Isolde(sc, x, y, { ...o, shadow: sh, arena })
        : b.kind === 'malgrim'
          ? (x, y, o) => new Malgrim(sc, x, y, { ...o, arena })
        : (x, y, o) => new Golem(sc, x, y - 24, { ...o, shadow: sh });
    const make = (x, y, o) => { const g = make0(x, y, o); if (echo) { g.isEcho = true; g.sprite.setTint(0xd9b8ff); } return g; };
    return this._bossDef = { id: this.id, flag: this.bossFlag, style: b.style || 'shadow', cfg, rect: [arena.x0, arena.y0, arena.x1, arena.y1 - 3], gate: [this.gateAt.x, this.gateAt.y], make }; // rect stops 3 rows short: walk a few steps in before it wakes
  }

  // ------------------------------------------------------------- update
  update(dt) {
    const sc = this.sc, L = sc.leader;
    const lt = key(Math.floor(L.x / TILE), Math.floor(L.y / TILE));
    const rid = this.roomOf.get(lt);
    for (const c of this.crystals) c.update(dt);
    for (const d of this.doors) if (d.o) { const [a, b] = d.sides.map(([x, y]) => [px(x), px(y)]); const near = Math.hypot(a[0] - L.x, a[1] - L.y) < Math.hypot(b[0] - L.x, b[1] - L.y) ? a : b; d.o.x = near[0]; d.o.y = near[1]; }
    // walking into a room: puzzles reset behind you, fights start, hints show
    if (rid !== undefined && rid !== this.roomNow) {
      const prev = this.rooms[this.roomNow];
      if (prev) this.resetBlocks(prev);
      this.roomNow = rid;
      this.enter(this.rooms[rid]);
    }
    // a sealed fight waits until the leader is a step clear of every doorway
    const pend = this.rooms[rid];
    if (pend?.seal && pend.foes.length && !pend.entered && !this.nearDoor(L, pend)) this.seal(pend);
    const room = this.rooms[rid];
    if (room?.active) {
      const inRoom = (e) => this.roomOf.get(key(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) === room.id;
      if (!sc.enemies.some((e) => e.alive && !e.boss && inRoom(e))) this.clearRoom(room);
    }
    // the leader thinks out loud following the vine, and at its source
    if (this.vine && !this.vine.dead && !sc.golem && !(this.thinkT = Math.max(0, (this.thinkT || 0) - dt))) {
      this.thinkT = 0.5;
      const nv = sc.nearVine(this.ward, L, 3);
      if (nv) { if (Math.hypot(this.vine.sigil.x - L.x, this.vine.sigil.y - L.y) < 11 * TILE) sc.think(this.id, 'source'); else sc.think(this.id, 'below'); }
    }
    // the Lens picked up: false walls and hidden bridges open at once
    if (!this.lensOn && (this.illusions.length || this.bridges.length) && sc.state.relics.includes('lens')) this.refreshLens();
    // bumping a false wall without the Lens: a nudge that something's off
    if (!this.lensOn && this.illusions.length && !this.hinted.has('illusion')) {
      const lx = Math.floor(L.x / TILE), ly = Math.floor(L.y / TILE);
      if (this.illusions.some((t) => Math.abs(t.x - lx) <= 1 && Math.abs(t.y - ly) <= 1)) { this.hinted.add('illusion'); sc.bark(L, "THIS WALL LOOKS... WRONG. LIKE IT ISN'T QUITE THERE."); }
    }
    // the leader can stand on a plate too
    if (this.plates.some((p) => !p.latched)) this.checkPlates();
    // keyboard / stick: walking into a block pushes it
    const d = L.direct;
    if (d && (d.x || d.y)) {
      const [dx, dy] = Math.abs(d.x) > Math.abs(d.y) ? [Math.sign(d.x), 0] : [0, Math.sign(d.y)];
      const tx = Math.floor((L.x + dx * 9) / TILE), ty = Math.floor((L.y + dy * 9) / TILE);
      const b = this.blocks.find((k) => k.x === tx && k.y === ty);
      this.pushT = b ? (this.pushT || 0) + dt : 0;
      if (b && this.pushT > 0.25) { this.pushT = 0; this.push(b, dx, dy, L); }
    } else this.pushT = 0;
  }

  enter(room) {
    const sc = this.sc;
    for (const h of this.hints) if (h.room === room.id && !this.hinted.has(h.text)) { this.hinted.add(h.text); this.save(false); sc.time.delayedCall(h.delay ?? 500, () => sc.bark(sc.leader, h.text)); }
    if (room.entered || !room.foes.length) { room.entered = true; return; }
    if (room.seal) return; // update() seals it once the leader is clear of the door
    this.seal(room);
  }

  nearDoor(u, room) {
    for (const d of room.doors) for (const [x, y] of d.tiles) if (Math.hypot(px(x) - u.x, px(y) - u.y) < TILE * 1.6) return true;
    return false;
  }

  seal(room) {
    const sc = this.sc;
    room.entered = true;
    const elite = this.def.elite || {};
    const spawn = () => room.spawned = room.foes.map(({ ch, x, y }) => {
      const e = elite[ch];
      const u = sc.spawnEnemy(e ? e.kind : this.foeKinds[ch], px(x), px(y), room.seal, !!e);
      if (e?.name) { u.named = true; u.s = { ...u.s, name: e.name }; }
      if (room.seal) u.noLeash = true; // a sealed fight is fought to the end
      return u;
    });
    if (!room.seal) { spawn(); return; }
    // sealed fight: everyone in, doors slam, foes rise
    room.active = true;
    const L = sc.leader;
    for (const h of sc.party) if (h !== L && !h.downed && this.roomOf.get(key(Math.floor(h.x / TILE), Math.floor(h.y / TILE))) !== room.id) { h.x = L.x + (Math.random() - 0.5) * 14; h.y = L.y + (Math.random() - 0.5) * 8; h.clearPath(); }
    this.refreshDoors();
    sc.bark(L, 'THE DOORS SLAMMED SHUT!');
    sc.time.delayedCall(500, spawn);
  }

  // The party fell: any sealed fight under way stands down (its foes vanish,
  // its doors open) and re-arms, so walking back in starts it over.
  onWipe() {
    if (this.restock) Object.assign(this.sc.state.potions, this.restock);
    for (const r of this.rooms) {
      if (!r.active) continue;
      for (const e of r.spawned || []) if (e.alive) { e.alive = false; e.destroy(); }
      const inRoom = (e) => this.roomOf.get(key(Math.floor(e.x / TILE), Math.floor(e.y / TILE))) === r.id;
      for (const e of this.sc.enemies) if (e.alive && !e.boss && inRoom(e)) { e.alive = false; e.destroy(); } // reassembled hollows too
      r.active = false; r.entered = false; r.spawned = null;
    }
    this.roomNow = undefined;
    this.refreshDoors(true);
  }

  clearRoom(room) {
    const sc = this.sc;
    if (!room.spawned) return; // foes still on their way in
    room.active = false; room.cleared = true;
    this.refreshDoors();
    this.save();
    audio.sfx('levelUp');
    for (const c of this.chests) if (c.reveal && !c.placed && c.room === room) {
      this.placeChest(c);
      sc.fx.puff(c.img.x, c.img.y - 8, 'spark'); sc.fx.burst('gold', c.img.x, c.img.y - 8, 20);
      sc.events.emit('banner', 'ROOM CLEARED', 'A CHEST APPEARED!');
      return;
    }
    sc.events.emit('banner', 'ROOM CLEARED', 'THE DOORS GRIND OPEN');
  }
}

export { DUNGEONS };
// Where a dungeon starts: its entrance ('@'), or for a lab boss test the
// corridor four tiles below the arena gate ('g').
export const dungeonStart = (id, at = null) => {
  const d = DUNGEONS[id];
  const find = (ch) => { for (let y = 0; y < d.rows.length; y++) { const x = d.rows[y].indexOf(ch); if (x >= 0) return { x: d.origin[0] + x, y: d.origin[1] + y }; } return null; };
  if (at === 'boss') { const g = find('g'); if (g) return { x: g.x, y: g.y + 4 }; }
  return find('@') || { x: d.origin[0], y: d.origin[1] };
};
