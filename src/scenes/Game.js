import Phaser from 'phaser';
import { buildWorld, LANDMARKS, TILE, MAP_W, MAP_H, T, SOLID, biomeAt, areaAt, AREAS, MARSH_Y } from '../world/map.js';
import { makeTerrainPainter, CHUNK } from '../gfx/terrain.js';
import { NavGrid } from '../game/path.js';
import { Hero, Enemy, Golem, Murk, WardStone, Breakable, dist, norm } from '../game/units.js';
import { FX } from '../game/fx.js';
import { Streamer } from '../game/streamer.js';
import { MiniMap } from '../game/minimap.js';
import { GearFX } from '../game/gearfx.js';
import { loadGroup, loadGroupNow, loaded, assetStats } from '../game/assets.js';
import { rollGearDrop, ensureItems } from '../game/itemgen.js';
import { itemTex } from '../game/itemtex.js';
import { QuestManager } from '../game/quests.js';
import HERO_LIST from '../data/heroes.json';
import { newSkillState } from '../game/state.js';
import { saveState, heroInfo, setStatMods, addMats, addPotions, CRAFT, xpFor, xpToNext, regionBand } from '../game/state.js';
import { audio } from '../audio/synth.js';
import { music, VALE_THEME } from '../audio/music.js';
import { CURSE_TINT } from '../gfx/palette.js';
import { bayer, hash, makeCanvas } from '../gfx/pixel.js';
import W from '../data/world.json';
import items from '../data/items.json';
import tuning from '../data/tuning.json';

const TOP = 100000;
const w_locked = (sc, o) => (o.warp.lockedBy && !sc.flags[`broke_${o.warp.lockedBy}`]) || (o.warp.requires && !sc.flags[o.warp.requires]);
const BLOCKING = new Set(['tree', 'deadtree', 'bush', 'rock', 'pillar', 'barrel', 'stalagmite', 'counter', 'table', 'whackboard']);
// Gathering node kinds: what they look like, how long they take, which tool
const NODE_KINDS = {
  herb: { base: 'herb', dur: 1.5 }, bogmoss: { base: 'herb', dur: 1.8, tint: 0xc9b46a },
  ore: { base: 'ore', dur: 2.4 }, silver: { base: 'ore', dur: 2.9, tint: 0xd8e4ff },
  crystal: { base: 'crystal', dur: 3.2 },
};
const nodeBase = (n) => NODE_KINDS[n.kind]?.base || n.kind;
const PROP_GROUP = { deadtree: 'marsh', reeds: 'marsh', mushrooms: 'marsh', stalagmite: 'cave', crystal: 'cave', counter: 'interior', shelf: 'interior', table: 'interior', rug: 'interior', whackboard: 'interior', fireplace: 'interior' };

const BARKS = {
  start: { brann: "THE KING'S TOWN... WHAT'S LEFT OF IT.", pip: 'OOH, A RUIN! I MEAN... HOW TRAGIC.', sable: 'QUIET OUT HERE. TOO QUIET. ALSO: GOBLINS.' },
  curse: { brann: 'STAY CLOSE. THE AIR TASTES WRONG.', pip: 'THAT STONE IS HUMMING. I HATE IT WHEN THEY HUM.', sable: 'PURPLE GRASS. NEVER A GOOD SIGN.' },
  ward: { brann: 'FOR THE KING. THE FROG KING. STILL COUNTS.', pip: 'ONE DOWN! MALGRIM IS GOING TO BE SO CROSS.', sable: 'THAT FELT GOOD. WHAT ELSE CAN WE BREAK?' },
  chest: { brann: 'A FINE FIND. WE TAKE IT FOR THE KING.', pip: "IS IT A SPELLBOOK? IT'S NOT A SPELLBOOK.", sable: 'FINDERS KEEPERS.' },
  gap: { brann: "TOO SHEER TO CLIMB. EVEN FOR ME.", pip: 'IF ONLY WE HAD SOME KIND OF... HOOK.', sable: "I COULD FREE-CLIMB THAT. PROBABLY. NO." },
  help: { brann: '', pip: 'HELP! THE PUDDLES ARE WINNING!', sable: "LITTLE HELP? THESE THINGS DON'T TAKE BRIBES." },
};

export class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create(data) {
    const st = (this.state = data.state);
    st.stats ??= { kills: 0, levelUps: [] };
    st.gems ??= {}; st.sockets ??= {};
    for (const hs of Object.values(st.heroes)) { hs.equip.trinket1 ??= null; hs.equip.trinket2 ??= null; }
    ensureItems(st);
    setStatMods(st);
    this.difficulty = { dmg: tuning.difficulty[st.difficulty] ?? 1, hp: 1 };
    this.speed = this.registry.get('gameSpeed') ?? tuning.gameSpeed;
    this.dangers = [];
    this.projectiles = [];
    this.enemies = [];
    this.party = [];
    this.interactables = [];
    this.loot = [];
    this.shockwaves = [];
    this.hitStopT = 0;
    this.combatHold = 0;
    this.swapCd = 0;
    this.flags = st.flags;
    this.frameMs = [];

    // ------------------------------------------------------------ world
    this.world = buildWorld();
    this.painter = makeTerrainPainter(this.world);
    const WPX = MAP_W * TILE, HPX = MAP_H * TILE;
    this.area = null;
    this.nav = new NavGrid(MAP_W, MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = this.world.at(x, y); if (SOLID.has(t)) this.nav.block(x, y, t === T.WATER ? 2 : 1); }
    for (const p of this.world.props) if (BLOCKING.has(p.type)) this.nav.block(p.x, p.y);

    this.propsByChunk = new Map();
    for (const p of this.world.props) {
      const k = `${Math.floor((p.x * TILE) / CHUNK)},${Math.floor((p.y * TILE) / CHUNK)}`;
      if (!this.propsByChunk.has(k)) this.propsByChunk.set(k, []);
      this.propsByChunk.get(k).push(p);
    }
    this.chunkObjs = new Map();
    this.minimap = new MiniMap(this, this.world, st);
    this.fx = new FX(this);
    this.gearFx = new GearFX(this);
    this.streamer = new Streamer(this, {
      painter: this.painter, worldW: WPX, worldH: HPX,
      onChunkIn: (cx, cy) => this.spawnChunk(cx, cy),
      onChunkOut: (cx, cy) => this.despawnChunk(cx, cy),
    });

    // Ward Stones: each holds a region under a curse until its guardian falls and it breaks
    this.wards = W.wards.map((def) => ({ def, C: { x: (def.x + 0.5) * TILE, y: (def.y + 0.5) * TILE, R: def.r * TILE }, bloomR: -1 }));
    this.moteT = 0;
    for (const w of this.wards) if (!this.flags[w.def.flag]) this.buildCurse(w);

    this.allies = []; // non-hero friendlies enemies can attack (escort carts, NPCs being defended)
    this.buildLandmarks();
    this.quests = new QuestManager(this);

    // ------------------------------------------------------------ party
    const start = st.pos || { x: W.start.x * TILE, y: W.start.y * TILE };
    st.active ??= st.recruited.slice(0, 3);
    if (!st.active.includes(st.leader)) st.active.unshift(st.leader);
    st.active = st.active.slice(0, 3);
    for (const h of HERO_LIST) if (!st.heroes[h.id]) st.heroes[h.id] = { level: 1, xp: 0, hp: null, ult: 0, equip: { ...h.equip, trinket1: null, trinket2: null }, ...newSkillState(h.id) };
    const order = [st.leader, ...st.active.filter((id) => id !== st.leader)];
    order.forEach((id, i) => this.party.push(new Hero(this, id, st.heroes[id], start.x + i * 12, start.y + (i ? 12 : 0))));
    this.setLeader(this.party[0], true);
    this.buildRecruits();
    this.groups = W.groups.map((g) => ({ ...g, units: [], active: false, deadT: 0, chunk: `${Math.floor((g.units[0][1] * TILE) / CHUNK)},${Math.floor((g.units[0][2] * TILE) / CHUNK)}` }));

    const cam = this.cameras.main;
    cam.startFollow(this.leader.sprite, true, 0.12, 0.12);
    cam.centerOn(this.leader.x, this.leader.y);

    this.buildDarkness();
    this.setupInput();
    this.scene.launch('UI', { game: this });
    this.ui = this.scene.get('UI');

    this.region = null;
    // Hold the game behind the loading curtain until the art, terrain and
    // enemies around the party are all in place, so nothing starts mid-load.
    this.loading = true;
    this.busy = true;
    const place = this.placeName(start.x, start.y);
    if (!this.scene.isActive('Loading')) this.scene.launch('Loading', { title: place });
    const curtain = this.scene.get('Loading');
    if (this.scene.isActive('Loading')) curtain.setTitle(place);
    this.prepareAt(start.x, start.y, curtain, 8).then(() => {
      this.loading = false;
      this.busy = false;
      this.calmT = 1.5; // a moment to get bearings before anything nearby notices you
      music.start(VALE_THEME);
      curtain.done();
      this.time.delayedCall(2200, () => this.bark(this.leader, BARKS.start[this.leader.def.id]));
    });

    window.__game = this.game;
    window.__scene = this;
    // free the terrain worker and chunk textures if the scene is ever restarted
    this.events.once('shutdown', () => { this.streamer?.destroy(); for (const w of this.wards || []) if (w.tex) this.textures.remove(`curseOverlay_${w.def.id}`); });
  }

  // ============================================================ streaming
  spawnChunk(cx, cy) {
    const k = `${cx},${cy}`;
    const list = this.propsByChunk.get(k) || [];
    for (const p of list) { const g = PROP_GROUP[p.type]; if (g && !loaded.has(g)) loadGroupNow(this, g); }
    const objs = [];
    for (const p of list) objs.push(...this.createProp(p));
    // water sparkles (deterministic per chunk)
    for (let i = 0; i < 10; i++) {
      const x = cx * CHUNK + Math.floor(hash(cx, cy * 31 + i, 5) * CHUNK), y = cy * CHUNK + Math.floor(hash(cx * 17 + i, cy, 6) * CHUNK);
      const t = this.painter.typeAt(x, y);
      if ((t !== T.WATER && t !== T.SHALLOW) || this.painter.typeAt(x + 10, y) !== t || this.painter.typeAt(x - 10, y) !== t) continue;
      const s = this.add.image(x, y, i % 3 ? 'px_white' : 'px_foam').setDepth(-49).setScale(i % 4 ? 2 : 3, 1).setAlpha(0);
      this.tweens.add({ targets: s, alpha: t === T.SHALLOW ? 0.5 : 0.9, duration: 500 + i * 60, yoyo: true, repeat: -1, delay: i * 300, hold: 200, repeatDelay: 900 + i * 200 });
      objs.push(s);
    }
    this.chunkObjs.set(k, objs);
  }

  despawnChunk(cx, cy) {
    const k = `${cx},${cy}`;
    for (const o of this.chunkObjs.get(k) || []) { this.tweens.killTweensOf(o); o.destroy(); }
    this.chunkObjs.delete(k);
  }

  createProp(p) {
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    const out = [];
    let img = null;
    switch (p.type) {
      case 'tree':
        img = this.add.image(x, y + 6, `tree${p.seed}`).setOrigin(0.5, 1);
        out.push(this.add.image(x + 2, y + 4, 'shadowL').setAlpha(0.22).setDepth(-4).setScale(1.3, 1.2));
        break;
      case 'deadtree':
        img = this.add.image(x, y + 6, `deadtree${p.seed}`).setOrigin(0.5, 1);
        out.push(this.add.image(x + 1, y + 4, 'shadow').setAlpha(0.22).setDepth(-4));
        break;
      case 'bush': img = this.add.image(x, y + 4, `${p.berries ? 'bushB' : 'bush'}${p.seed % 4}`).setOrigin(0.5, 1); break;
      case 'rock': img = this.add.image(x, y + 4, `${p.big ? 'rockB' : 'rock'}${p.seed % 4}`).setOrigin(0.5, 1); break;
      case 'tuft': img = this.add.sprite(x, y + 4, `tuft${p.seed % 4}`).setOrigin(0.5, 1).play({ key: `tuft${p.seed % 4}`, startFrame: p.seed % 3 }); break;
      case 'reeds': img = this.add.sprite(x, y + 6, `reeds${p.seed % 4}`).setOrigin(0.5, 1).play({ key: `reeds${p.seed % 4}`, startFrame: p.seed % 3 }); break;
      case 'mushrooms': img = this.add.image(x, y + 4, `mushrooms${p.seed % 4}`).setOrigin(0.5, 1); break;
      case 'flowers': img = this.add.image(x, y, `flowers${p.seed % 6}`).setDepth(-50); break;
      case 'lily': img = this.add.image(x, y, `lily${p.seed % 3}`).setDepth(-50); break;
      case 'pillar': img = this.add.image(x, y + 8, p.broken ? 'pillarBroken' : 'pillar').setOrigin(0.5, 1); break;
      case 'barrel': img = this.add.image(x, y + 4, 'barrel').setOrigin(0.5, 1); break;
      case 'stalagmite': img = this.add.image(x, y + 6, `stalagmite${p.seed % 4}`).setOrigin(0.5, 1); break;
      case 'crystal': img = this.add.sprite(x, y + 4, `crystal${p.seed % 3}`).setOrigin(0.5, 1).play(`crystal${p.seed % 3}`); img.isLight = true; break;
      case 'counter': img = this.add.image(x, y + 8, 'counter').setOrigin(0.5, 1); break;
      case 'shelf': img = this.add.image(x, y + 10, 'shelf').setOrigin(0.5, 1); break;
      case 'table': img = this.add.image(x, y + 6, 'table').setOrigin(0.5, 1); break;
      case 'rug': img = this.add.image(x, y, 'rug').setDepth(-50); break;
      case 'whackboard': img = this.add.image(x, y + 8, 'whackboard').setOrigin(0.5, 1); break;
      case 'fireplace': img = this.add.sprite(x, y + 14, 'fireplace').setOrigin(0.5, 1).play('fireplace'); out.push(this.add.circle(x, y + 22, 34, 0xffb050, 0.1).setDepth(-60).setBlendMode(Phaser.BlendModes.ADD)); break;
    }
    if (img) {
      if (img.depth === 0) img.setDepth(img.y);
      if (this.inCurse(x, y, 12)) img.setTint(CURSE_TINT);
      out.push(img);
    }
    return out;
  }

  updateGroups(dt) {
    const L = this.leader;
    for (const g of this.groups) {
      const blocked = (g.until && this.flags[g.until]) || (g.once && this.state.cleared[g.id]);
      const res = this.streamer.resident.has(g.chunk);
      if (!g.active) {
        if (blocked || !res) continue;
        if (g.deadT > 0) { g.deadT -= dt; continue; }
        const def = W.groups.find((x) => x.id === g.id).units;
        // never respawn a cleared group in plain sight
        if (g.spawnedOnce && Math.hypot(def[0][1] * TILE - L.x, def[0][2] * TILE - L.y) < 260) continue;
        const eliteIdx = !g.guards && Math.random() < 0.3 ? Math.floor(Math.random() * def.length) : -1;
        g.units = def.map(([k, x, y], i) => this.spawnEnemy(k, x * TILE + 8, y * TILE + 8, false, i === eliteIdx));
        g.active = true;
        g.spawnedOnce = true;
      } else {
        const alive = g.units.filter((u) => u.alive);
        if (!alive.length) {
          g.active = false;
          if (g.once) this.state.cleared[g.id] = true;
          g.deadT = 45;
          continue;
        }
        if (!res && !alive.some((u) => u.engaged)) {
          for (const u of alive) { u.alive = false; u.clearZone(); u.destroy(); }
          g.active = false;
          g.deadT = 0;
        }
      }
    }
  }

  enemyLevel(x, y) {
    const r = W.regions.find((k) => k.id === biomeAt(Math.floor(x / TILE), Math.floor(y / TILE)));
    const avg = this.party.reduce((a, h) => a + h.level, 0) / this.party.length;
    const [lo, hi] = regionBand(this.state, r);
    return Phaser.Math.Clamp(Math.round(avg), lo, hi);
  }

  spawnEnemy(kind, x, y, engaged = false, elite = false) {
    if (['mire', 'drowned', 'witchling', 'leeches', 'lurker', 'croaker', 'snapjaw', 'murk'].includes(kind) && !loaded.has('marsh')) loadGroupNow(this, 'marsh');
    const open = this.nav.nearestOpen(Math.floor(x / TILE), Math.floor(y / TILE));
    if (open && this.nav.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) { x = open[0] * TILE + 8; y = open[1] * TILE + 8; }
    const e = new Enemy(this, kind, x, y, { level: this.enemyLevel(x, y) + (elite ? 2 : 0), elite }); // elites sit 2 levels up (C1)
    this.enemies.push(e);
    if (engaged) { this.fx.puff(x, y, 'sparkCurse'); e.aggroOn(this.leader, false); }
    return e;
  }

  // ============================================================ areas
  areaRect(id = this.area) { return AREAS[id] || AREAS.overworld; }

  enterArea(id) {
    this.area = id;
    const a = this.areaRect(id);
    this.cameras.main.setBounds(a.x0 * TILE, a.y0 * TILE, (a.x1 - a.x0 + 1) * TILE, (a.y1 - a.y0 + 1) * TILE);
    this.events.emit('area', id);
  }

  tryWarp(w) {
    if (w.requires && !this.flags[w.requires]) { this.bark(this.leader, 'BARRED FROM THE OTHER SIDE.'); return; }
    if (w.lockedBy && !this.flags[`broke_${w.lockedBy}`]) {
      this.bark(this.leader, { brann: 'THIS ROCK IS CRACKED. ONE GOOD HIT...', pip: "THERE'S A DRAFT BEHIND THAT ROCK. SUSPICIOUS.", sable: 'HOLLOW BEHIND THERE. I CAN SMELL TREASURE.' }[this.leader.def.id]);
      return;
    }
    this.warp(w);
  }

  // ============================================================ secrets & gathering
  onBreak(b) {
    this.flags[`broke_${b.def.id}`] = true;
    for (const [tx, ty] of b.def.tiles) this.nav.solid[ty * this.nav.w + tx] = 0;
    audio.sfx('bash'); audio.sfx('shatter');
    this.shake(200, 0.008);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 80, () => this.fx.dust(b.x + (i - 1) * 8, b.y));
    this.fx.burst('spark', b.x, b.y - 10, 20);
    this.tweens.add({ targets: b.sprite, alpha: 0, scaleY: 0.3, duration: 260, onComplete: () => b.destroy() });
    this.breakables = this.breakables.filter((x) => x !== b);
    for (const h of this.party) if (h.command?.target === b) h.command = null;
    audio.sfx('levelUp');
    this.events.emit('banner', 'A SECRET!', b.def.kind === 'boulder' ? 'THE BOULDER CRUMBLES TO REVEAL A PASSAGE' : 'THE WALL GIVES WAY');
    this.autosave('secret');
  }

  // Harvesting is a timed action: the hero swings a tool (pickaxe / sickle)
  // until the bar fills. Rarer materials take longer. Moving or getting hit
  // interrupts it.
  harvest(n, h) {
    if (!n.ready) { this.floatText(n.px, n.py - 16, `REGROWS IN ${Math.ceil(n.t)}S`, 'fontPlain'); return; }
    if (!n.s || h.action) return;
    const dur = NODE_KINDS[n.kind]?.dur || 2;
    h.face(n.px - h.x, n.py - h.y);
    h.clearPath();
    h.action = { type: 'harvest', t: 0, dur, node: n, anim: nodeBase(n) === 'herb' ? 'gather' : 'mine', swingT: 0, period: nodeBase(n) === 'herb' ? 0.5 : 0.6 };
    h.anim = '';
    h.play(h.action.anim);
  }

  harvestTick(h, n) {
    const herb = nodeBase(n) === 'herb';
    audio.sfx(herb ? 'stab' : 'block');
    this.fx.burst(herb ? 'heal' : 'spark', n.px + (Math.random() * 6 - 3), n.py - 4, herb ? 3 : 4);
    if (!herb) this.shake(30, 0.0015);
  }

  cancelHarvest(h) {
    if (h.action?.type !== 'harvest') return;
    h.action = null;
    h.anim = '';
    this.floatText(h.x, h.y - 30, 'STOPPED', 'fontPlain');
  }

  finishHarvest(h, n) {
    n.ready = false; n.t = 90;
    const amt = n.kind === 'crystal' ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0);
    addMats(this.state, { [n.kind]: amt });
    this.quests?.onGather(n.kind, amt);
    audio.sfx(nodeBase(n) === 'ore' ? 'bash' : n.kind === 'crystal' ? 'frost' : 'heal');
    audio.sfx('coin');
    this.fx.burst(nodeBase(n) === 'herb' ? 'heal' : 'gold', n.px, n.py - 6, 10);
    this.floatText(n.px, n.py - 18, `+${amt} ${CRAFT.materials[n.kind].name}`, 'fontGold');
    this.nodeTexture(n);
    this.events.emit('party');
  }

  nodeTexture(n) {
    if (!n.s) return;
    if (nodeBase(n) === 'herb') { if (n.ready) n.s.play('herb'); else { n.s.stop(); n.s.setTexture('herb_used'); } }
    else if (nodeBase(n) === 'ore') n.s.setTexture(n.ready ? 'ore' : 'ore_used');
    if (NODE_KINDS[n.kind]?.tint) n.s.setTint(NODE_KINDS[n.kind].tint);
    else { if (n.ready) { n.s.setAlpha(1).play('crystal1'); } else { n.s.stop(); n.s.setAlpha(0.35); } }
  }

  updateNodesAndNpcs(dt) {
    for (const n of this.nodes) {
      if (!n.s) {
        const grp = n.kind === 'crystal' ? 'cave' : 'core';
        if (grp === 'core' || loaded.has(grp)) {
          if (nodeBase(n) === 'herb') n.s = this.add.sprite(n.px, n.py + 6, 'herb').setOrigin(0.5, 1).play('herb');
          else if (nodeBase(n) === 'ore') n.s = this.add.image(n.px, n.py + 6, 'ore').setOrigin(0.5, 1);
          else { n.s = this.add.sprite(n.px, n.py + 6, 'crystal1').setOrigin(0.5, 1).play('crystal1').setScale(1.3); n.s.isLight = true; }
          n.s.setDepth(n.py);
          this.nodeTexture(n);
        }
      }
      if (!n.ready) { n.t -= dt; if (n.t <= 0) { n.ready = true; this.nodeTexture(n); audio.sfx('click'); } }
      this.updateNodeMarker(n);
    }
    for (const n of this.npcs) {
      if (n.s || !loaded.has('interior')) continue;
      n.s = this.add.sprite(n.px, n.py, n.id, 'idle_down_0').setOrigin(0.5, 0.75).play(`${n.id}_idle_down`).setDepth(n.py);
      this.add.image(n.px + 1, n.py + 1, 'shadow').setAlpha(0.2).setDepth(-4);
    }
    // golden flies: walk close to grab
    for (const f of this.flies) {
      if (f.got) continue;
      if (!this.party.some((h) => !h.downed && Math.hypot(h.x - f.x, h.y - f.y) < 16)) continue;
      f.got = true;
      this.state.flies.push(f.i);
      this.tweens.killTweensOf(f.s);
      this.tweens.add({ targets: f.s, y: f.s.y - 24, alpha: 0, duration: 500, onComplete: () => f.s.destroy() });
      this.fx.burst('gold', f.x, f.y - 8, 18);
      audio.sfx('coin'); audio.sfx('levelUp');
      this.events.emit('banner', `GOLDEN FLY!  ${this.state.flies.length} / 10`, 'THE FROG KING WILL WANT TO SEE THIS');
      this.autosave('fly');
    }
  }

  // Harvestables always wear the same marker: a bobbing bubble with the
  // material icon when ready, a filling ring while regrowing, and a label
  // when you're close. Nothing without a bubble can be harvested.
  updateNodeMarker(n) {
    if (!n.s) return;
    if (!n.mk) {
      n.mk = this.add.container(n.px, n.py - 26).setDepth(TOP - 40);
      n.mkBub = this.add.image(0, 0, 'bubble');
      n.mkIcon = this.add.image(0, -1, `icon_${n.kind}`);
      n.mkRing = this.add.graphics();
      n.mk.add([n.mkBub, n.mkIcon, n.mkRing]);
      n.label = this.add.bitmapText(n.px, n.py - 44, 'font', `${CRAFT.materials[n.kind].name} - TAP TO ${nodeBase(n) === 'ore' ? 'MINE' : nodeBase(n) === 'herb' ? 'PICK' : 'GATHER'}`).setOrigin(0.5).setDepth(TOP - 39).setVisible(false);
    }
    const t = this.time.now / 1000;
    n.mk.y = n.py - 26 + Math.round(Math.sin(t * 3 + n.px) * 1.5);
    n.mkBub.setVisible(n.ready);
    n.mkIcon.setVisible(n.ready);
    const g = n.mkRing.clear();
    if (!n.ready) {
      const f = 1 - n.t / 90;
      g.fillStyle(0x1a1423, 0.75).fillCircle(0, 0, 6);
      g.lineStyle(2, 0x6fd3a0, 1).beginPath().arc(0, 0, 5, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2).strokePath();
      g.lineStyle(1, 0x45405e, 1).strokeCircle(0, 0, 6.5);
    }
    const L = this.leader;
    const near = Math.hypot(L.x - n.px, L.y - n.py) < 48;
    n.label.setVisible(near).setText(n.ready ? `${CRAFT.materials[n.kind].name} - TAP TO ${nodeBase(n) === 'ore' ? 'MINE' : nodeBase(n) === 'herb' ? 'PICK' : 'GATHER'}` : `REGROWS IN ${Math.ceil(n.t)}S`);
    if (near && n.ready && !this.flags.harvestHint) {
      this.flags.harvestHint = true;
      this.events.emit('banner', 'GATHERING', 'TAP ANYTHING WITH A BUBBLE. IT REGROWS.');
    }
  }

  talkNpc(npc) {
    const L = this.leader;
    L.face(npc.px - L.x, npc.py - L.y);
    const lines = npc.lines.map((text) => ({ who: npc.name, portrait: loaded.has('interior') ? `${npc.id}_portrait` : null, voice: npc.voice, text }));
    if (npc.kind === 'merchant') this.events.emit('dialogue', lines.slice(this.flags.metMarla ? 1 : 0), () => { this.flags.metMarla = true; this.openOverlay('Shop'); });
    else {
      const ask = { who: npc.name, portrait: `${npc.id}_portrait`, voice: npc.voice, text: this.state.gold >= 10 ? 'TEN GOLD. YOU IN? (TAP TO PLAY)' : "YOU'RE SHORT OF TEN GOLD, FRIEND. COME BACK RICHER." };
      this.events.emit('dialogue', [...lines.slice(this.flags.metBruno ? 1 : 0), ask], () => {
        this.flags.metBruno = true;
        if (this.state.gold < 10) return;
        this.state.gold -= 10;
        this.openOverlay('Minigame');
      });
    }
  }

  openOverlay(key) {
    if (this.scene.isActive(key)) return;
    this.scene.pause();
    this.scene.launch(key, { game: this });
  }

  closeOverlay() { this.scene.resume(); this.autosave('overlay'); this.events.emit('party'); }

  // ============================================================ potions
  usePotion(kind = 'potion') {
    const st = this.state;
    if (!st.potions[kind]) { audio.sfx('click'); return false; }
    const c = CRAFT.consumables[kind];
    if (kind === 'potion') {
      const L = this.leader;
      if (L.downed || L.hp >= L.maxHp) { audio.sfx('click'); return false; }
      const amt = Math.round(L.maxHp * c.heal * (L.hasTrait('tonic') ? 1.2 : 1));
      L.hp = Math.min(L.maxHp, L.hp + amt);
      this.floatText(L.x, L.y - 28, `+${amt}`, 'font', 0x8cff8c);
      this.fx.heal(L.x, L.y);
    } else {
      for (const h of this.party) { if (h.downed) h.revive(c.heal); else h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * c.heal)); this.fx.heal(h.x, h.y); }
    }
    st.potions[kind]--;
    audio.sfx('heal');
    this.events.emit('party');
    return true;
  }

  // ============================================================ enemy arrows
  // kind: arrow (default), orb (slow curse orb that slows), bolt (hex bolt)
  spawnEnemyArrow(from, to, dmg, kind = 'arrow') {
    const [nx, ny] = norm(to.x - from.x, to.y - (from.y - 8));
    let s, sp = 210;
    if (kind === 'orb') { s = this.add.sprite(from.x, from.y - 8, 'sparkCurse').setScale(2).setDepth(TOP - 21); sp = 110; audio.sfx('frost', { pitch: 0.6 }); }
    else if (kind === 'bolt') { s = this.add.sprite(from.x, from.y - 8, 'firebolt').play('firebolt').setTint(0xd28cff).setDepth(TOP - 21).setRotation(Math.atan2(ny, nx)); sp = 160; audio.sfx('fireCast'); }
    else { s = this.add.image(from.x, from.y - 8, 'arrow').setDepth(TOP - 21).setRotation(Math.atan2(ny, nx)); audio.sfx('swing', { pitch: 1.6 }); }
    (this.enemyShots ??= []).push({ s, x: from.x, y: from.y - 8, vx: nx * sp, vy: ny * sp, dmg, life: kind === 'orb' ? 1.8 : 1.1, from, kind });
  }

  updateEnemyShots(dt) {
    if (!this.enemyShots) return;
    for (const p of this.enemyShots) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.setPosition(Math.round(p.x), Math.round(p.y));
      const hit = this.party.find((h) => h.alive && !h.downed && !h.zipping && Math.hypot(h.x - p.x, h.y - 8 - p.y) < h.r + 4)
        || (this.allies || []).find((a) => a.alive && Math.hypot(a.x - p.x, a.y - 8 - p.y) < a.r + 4);
      const t = this.painter.typeAt(p.x, p.y + 8);
      const wall = this.nav.solidAtPx(p.x, p.y + 8) && t !== T.WATER && t !== T.BOG && t !== T.CHASM;
      if (hit && hit.wallT > 0 && !p.reflected && p.from?.alive) {
        // Shield Wall: send the arrow back at the archer
        p.reflected = true; p.life = 1.1;
        const [rx, ry] = norm(p.from.x - p.x, p.from.y - 8 - p.y);
        p.vx = rx * 230; p.vy = ry * 230; p.s.setRotation(Math.atan2(ry, rx));
        audio.sfx('block'); this.fx.burst('spark', p.x, p.y, 6);
        continue;
      }
      if (p.reflected) {
        const e = this.enemies.find((k) => k.alive && Math.hypot(k.x - p.x, k.y - 8 - p.y) < k.r + 4);
        if (e) { this.dealDamage(this.party.find((h) => h.wallT > 0) || this.leader, e, p.dmg * 1.5, { knock: 40 }); p.dead = true; p.s.destroy(); continue; }
        if (p.life <= 0) { p.dead = true; p.s.destroy(); }
        continue;
      }
      if (hit) {
        hit.damage(p.dmg, p.from);
        this.fx.burst(p.kind === 'arrow' || !p.kind ? 'spark' : 'curse', p.x, p.y, 4);
        if (p.kind === 'orb' && hit.buff) { hit.buff('slow', 0.6, 2.5); this.floatText(hit.x, hit.y - 34, 'SLOWED', 'fontPlain', 0xd9b8ff); }
      }
      if (hit || wall || p.life <= 0) { p.dead = true; p.s.destroy(); }
    }
    this.enemyShots = this.enemyShots.filter((p) => !p.dead);
  }

  // ============================================================ curse
  buildCurse(w) {
    const c = w.def;
    const m = c.r + 3;
    const x0 = Math.max(0, (c.x - m) * TILE), y0 = Math.max(0, (c.y - m) * TILE);
    const x1 = Math.min(MAP_W * TILE, (c.x + m) * TILE), y1 = Math.min(MAP_H * TILE, (c.y + m) * TILE);
    w.region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    this.streamer.curse(w.region, c).then((canvas) => {
      if (this.flags[c.flag]) return;
      w.canvas = canvas;
      w.tex = this.textures.addCanvas(`curseOverlay_${c.id}`, canvas);
      w.img = this.add.image(x0, y0, `curseOverlay_${c.id}`).setOrigin(0).setDepth(-90);
    });
  }

  // the unbroken ward whose curse covers this point
  curseAt(x, y, pad = 0) { return this.wards.find((w) => !this.flags[w.def.flag] && Math.hypot(x - w.C.x, y - w.C.y) < w.C.R - pad); }
  inCurse(x, y, pad = 0) { return !!this.curseAt(x, y, pad); }
  get canSwim() { return this.state.relics.includes('tide'); }

  wardUnits() { return this.wards.filter((w) => w.unit?.alive).map((w) => w.unit); }

  wardShielded(unit) { return !this.flags[unit?.wardDef?.guardian ?? 'golemDefeated']; }

  // ============================================================ landmarks
  addInteractable(o) { this.interactables.push(o); return o; }
  removeInteractable(o) { this.interactables = this.interactables.filter((k) => k !== o); }

  buildLandmarks() {
    const px = (t) => t * TILE + TILE / 2;
    for (const c of W.campfires) {
      const x = px(c.x), y = px(c.y);
      this.add.sprite(x, y + 6, 'campfire').setOrigin(0.5, 1).play('campfire').setDepth(y);
      const glow = this.add.circle(x, y, 26, 0xffb050, 0.12).setDepth(-60).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.06, scale: 0.9, duration: 220, yoyo: true, repeat: -1 });
      this.nav.block(c.x, c.y);
      this.addInteractable({ x, y, reach: 26, h: 20, kind: 'campfire', interact: () => this.rest() });
    }
    for (const s of W.signs) {
      const x = px(s.x), y = px(s.y);
      this.add.image(x, y + 4, 'sign').setOrigin(0.5, 1).setDepth(y);
      this.nav.block(s.x, s.y);
      this.addInteractable({ x, y, reach: 22, h: 16, kind: 'sign', interact: () => this.events.emit('dialogue', s.lines.map((text) => ({ who: 'SIGN', text }))) });
    }
    for (const c of W.chests) {
      const x = px(c.x), y = px(c.y);
      const img = this.add.image(x, y + 4, this.flags[`chest_${c.id}`] ? 'chestOpen' : 'chest').setOrigin(0.5, 1).setDepth(y);
      this.nav.block(c.x, c.y);
      this.addInteractable({ x, y, reach: 22, h: 14, kind: 'chest', interact: (h) => this.openChest(c, img, h) });
    }
    for (const p of W.posts) {
      const x = px(p.x), y = px(p.y);
      this.add.image(x, y + 4, 'post').setOrigin(0.5, 1).setDepth(y);
      this.add.image(x + 1, y + 3, 'shadow').setAlpha(0.2).setDepth(-4);
      this.nav.block(p.x, p.y);
      this.addInteractable({ x, y, reach: 34, standOff: 14, h: 20, kind: 'post', id: p.id, pair: p.pair, land: p.land, interact: (h, o) => this.grapple(o) });
    }
    // Shrines: +1 skill point for every recruited hero, once each (C10)
    for (const k of W.shrines || []) {
      const x = px(k.x), y = px(k.y), used = this.flags[`shrine_${k.id}`];
      const img = this.add.image(x, y + 6, used ? 'shrineUsed' : 'shrine').setOrigin(0.5, 1).setDepth(y);
      if (!used) { img.glow = this.add.circle(x, y - 6, 12, 0x9fe6ff, 0.18).setDepth(-50).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: img.glow, alpha: 0.06, duration: 1400, yoyo: true, repeat: -1 }); }
      this.nav.block(k.x, k.y);
      this.addInteractable({ x, y, reach: 24, standOff: 14, h: 22, kind: 'shrine', interact: () => this.useShrine(k, img) });
    }
    // Lookout towers: climb to sketch the surrounding region onto the map
    for (const k of W.lookouts || []) {
      const x = px(k.x), y = px(k.y);
      this.add.image(x, y + 8, 'lookout').setOrigin(0.5, 1).setDepth(y);
      for (const dx of [-1, 0, 1]) this.nav.block(k.x + dx, k.y);
      this.addInteractable({ x, y: y + 4, reach: 26, standOff: 16, h: 40, kind: 'lookout', interact: () => this.climbLookout(k) });
    }
    for (const w of W.warps) {
      const x = px(w.x), y = px(w.y);
      const o = this.addInteractable({ x, y, reach: 22, standOff: 10, h: 16, kind: 'warp', warp: w, armed: false, interact: () => this.tryWarp(w) });
      if (w.exit && !w.door) o.needsLight = true;
    }
    // Brightwater buildings
    for (const b of W.buildings) {
      const bx = b.x * TILE + 8, by = (b.y + 1) * TILE;
      this.add.image(bx, by, `house_${b.kind}`).setOrigin(0.5, 1).setDepth(by);
      this.add.image(bx + 3, by - 4, 'shadowXL').setAlpha(0.25).setDepth(-4).setScale(1.5, 1.6);
    }
    // Doors: an open-doorway overlay on each cottage, and a door in each
    // interior's bottom wall
    this.doors = {};
    for (const b of W.buildings) {
      const bx = b.x * TILE + 8, by = (b.y + 1) * TILE;
      const ext = this.add.image(bx - 6, by - 17, 'door_open').setOrigin(0).setDepth(by + 1).setVisible(false);
      const out = W.warps.find((w) => w.door && w.exit && w.building === b.id);
      const int = this.add.image(out.x * TILE + 8, (out.y + 1) * TILE, 'idoor').setOrigin(0.5, 1).setDepth((out.y + 1) * TILE);
      this.doors[b.id] = { ext, int };
    }
    // Breakable secrets
    this.breakables = [];
    for (const bd of W.breakables) {
      if (this.flags[`broke_${bd.id}`]) continue;
      const b = new Breakable(this, bd);
      for (const [tx, ty] of bd.tiles) this.nav.block(tx, ty);
      this.breakables.push(b);
    }
    // Golden flies
    this.flies = [];
    W.flies.forEach(([fxT, fyT], i) => {
      if (this.state.flies.includes(i)) return;
      const x = fxT * TILE + 8, y = fyT * TILE + 8;
      const s = this.add.sprite(x, y - 6, 'fly').play('fly').setDepth(y - 14);
      this.tweens.add({ targets: s, y: y - 10, duration: 700 + i * 37, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.flies.push({ i, x, y, s });
    });
    // Gathering nodes (sprites created once their biome art exists)
    this.nodes = W.nodes.map((n) => ({ ...n, px: n.x * TILE + 8, py: n.y * TILE + 8, ready: true, t: 0, s: null }));
    for (const n of this.nodes) {
      n.o = this.addInteractable({ x: n.px, y: n.py, reach: 22, standOff: 12, h: 12, kind: 'node', node: n, interact: (h) => this.harvest(n, h) });
    }
    // Townsfolk NPCs (sprites appear when interior art is loaded)
    this.npcs = W.npcs.map((n) => {
      const x = n.x * TILE + 8, y = n.y * TILE + 8;
      const npc = { ...n, px: x, py: y, s: null };
      npc.o = this.addInteractable({ x, y, reach: 40, standOff: 32, h: 24, kind: 'npc', interact: () => this.talkNpc(npc) });
      return npc;
    });

    // Frog King
    const f = LANDMARKS.frog;
    const fx = px(f.x), fy = px(f.y);
    this.frog = this.add.sprite(fx, fy + 6, 'frog').setOrigin(0.5, 1).play('frog_idle').setDepth(fy);
    this.add.image(fx + 1, fy + 5, 'shadow').setAlpha(0.2).setDepth(-4);
    this.nav.block(f.x, f.y);
    this.addInteractable({ x: fx, y: fy, reach: 30, standOff: 26, h: 14, kind: 'frog', interact: () => { this.leader.face(fx - this.leader.x, fy - this.leader.y); this.talkFrog(); } });
    // Ward Stone
    for (const w of this.wards) {
      const wd = w.def;
      if (!this.flags[wd.flag]) {
        w.unit = new WardStone(this, px(wd.x), px(wd.y));
        w.unit.wardDef = wd;
        w.shieldFx = this.add.ellipse(w.unit.x, w.unit.y - 18, 46, 60, 0x6f93e0, 0.12).setStrokeStyle(1, 0x9fd8ff, 0.6).setDepth(w.unit.y + 3);
        this.tweens.add({ targets: w.shieldFx, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
        if (this.flags[wd.guardian]) w.shieldFx.setVisible(false);
      } else this.add.image(px(wd.x), px(wd.y) + 6, 'wardRubble').setOrigin(0.5, 1).setDepth(px(wd.y));
      for (const dx of [-1, 0, 1]) this.nav.block(wd.x + dx, wd.y);
    }
    this.ward = this.wards[0].unit; // the Vale stone (kept for older code paths)
  }

  buildRecruits() {
    this.recruitNPCs = [];
    for (const r of W.recruits) {
      const id = this.recruitOrder()[r.slot];
      if (!id || this.state.recruited.includes(id)) continue;
      const x = r.x * TILE + 8, y = r.y * TILE + 8;
      const sprite = this.add.sprite(x, y, id, 'idle_down_0').setOrigin(0.5, 0.75).play(`${id}_idle_down`).setDepth(y);
      const sh = this.add.image(x + 1, y + 1, 'shadow').setAlpha(0.2).setDepth(-4);
      const mark = this.add.bitmapText(x, y - 32, 'fontGold', r.guardedBy ? '!!' : '!').setOrigin(0.5).setDepth(TOP);
      this.tweens.add({ targets: mark, y: y - 35, duration: 400, yoyo: true, repeat: -1 });
      const npc = { id, r, sprite, sh, mark };
      npc.o = this.addInteractable({ x, y, reach: 24, standOff: 18, h: 24, kind: 'recruit', interact: () => this.talkRecruit(npc) });
      this.recruitNPCs.push(npc);
    }
  }

  recruitOrder() {
    const all = ['brann', 'pip', 'sable'];
    const first = this.state.recruited[0];
    return [first, ...all.filter((i) => i !== first)];
  }

  // ============================================================ darkness (caves)
  buildDarkness() {
    const [c, ctx] = makeCanvas(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const d = Math.hypot(x - 64, y - 64) / 64;
      const a = d < 0.55 ? 1 : d > 1 ? 0 : 1 - (d - 0.55) / 0.45;
      if (a > 0 && bayer(x, y) < a) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); }
    }
    this.textures.addCanvas('lightMask', c);
    this.darkRT = this.add.renderTexture(0, 0, this.scale.width + 2, this.scale.height + 2).setOrigin(0).setScrollFactor(0).setDepth(TOP + 40).setVisible(false);
    this.scale.on('resize', () => this.darkRT.resize(this.scale.width + 2, this.scale.height + 2));
  }

  updateDarkness() {
    const L = this.leader;
    const inCave = !!this.areaRect().dark;
    this.darkRT.setVisible(inCave);
    if (!inCave) return;
    const cam = this.cameras.main;
    const rt = this.darkRT;
    rt.clear();
    const lantern = this.state.relics.includes('lantern');
    rt.fill(0x05030a, lantern ? 0.86 : 0.94);
    const light = (wx, wy, s) => rt.erase('lightMask', Math.round(wx - cam.worldView.x - 64 * s), Math.round(wy - cam.worldView.y - 64 * s)).setScale?.(1);
    const stamp = (wx, wy, s) => { this.lightStamp ??= this.make.image({ key: 'lightMask', add: false }); this.lightStamp.setScale(s).setOrigin(0.5); rt.erase(this.lightStamp, Math.round(wx - cam.worldView.x), Math.round(wy - cam.worldView.y)); };
    void light;
    stamp(L.x, L.y - 10, (lantern ? 2.1 : 1.25) + Math.sin(this.time.now / 180) * 0.03); // the Lantern of Embers lights far more
    for (const h of this.party) if (h !== L) stamp(h.x, h.y - 10, 0.55);
    for (const objs of this.chunkObjs.values()) for (const o of objs) if (o.isLight && cam.worldView.contains(o.x, o.y)) stamp(o.x, o.y - 6, 0.35);
    for (const i of this.interactables) if (i.needsLight) stamp(i.x, i.y - 10, 0.9);
  }

  // ============================================================== party
  setLeader(h, silent = false) {
    for (const p of this.party) p.isLeader = false;
    const prev = this.leader;
    h.isLeader = true;
    h.command = null;
    h.clearPath();
    h.target = null;
    this.leader = h;
    this.state.leader = h.def.id;
    if (prev && prev !== h) { prev.command = null; prev.clearPath(); prev.direct = null; }
    this.cameras.main.startFollow(h.sprite, true, 0.12, 0.12);
    if (!silent) {
      audio.sfx('swap');
      this.fx.ring(h.x, h.y, 'ringGold', 3);
      this.floatText(h.x, h.y - 30, h.def.name.toUpperCase(), 'fontGold');
    }
    this.events.emit('party');
  }

  swapLeader(dir = 1) {
    const alive = this.party.filter((p) => !p.downed);
    if (alive.length < 2 || this.swapCd > 0) return;
    this.swapCd = 0.6;
    const i = this.party.indexOf(this.leader);
    for (let k = 1; k <= this.party.length; k++) {
      const n = this.party[(i + dir * k + this.party.length * 3) % this.party.length];
      if (!n.downed) { this.setLeader(n); return; }
    }
  }

  // ============================================================== input
  setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p) => {
      if (this.consumeUI() || this.busy) return;
      if (this.ui?.dialogOpen) return;
      if (p.rightButtonDown()) { this.leader.dodge(p.worldX - this.leader.x, p.worldY - this.leader.y); this.down = null; return; }
      this.down = { x: p.x, y: p.y, t: this.time.now, real: performance.now(), wx: p.worldX, wy: p.worldY };
    });
    this.input.on('pointerup', (p) => {
      if (this.consumeUI()) { this.down = null; return; }
      if (this.ui?.dialogOpen) { this.ui.advanceDialog(); this.down = null; return; }
      const d = this.down;
      this.down = null;
      if (!d || this.busy) return;
      const dx = p.x - d.x, dy = p.y - d.y;
      if (Math.hypot(dx, dy) > 18 && performance.now() - d.real < 380) { this.leader.dodge(dx, dy); return; }
      this.tapWorld(d.wx, d.wy);
    });
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({ W: K.W, A: K.A, S: K.S, D: K.D, UP: K.UP, DOWN: K.DOWN, LEFT: K.LEFT, RIGHT: K.RIGHT });
    const kb = this.input.keyboard;
    kb.on('keydown-SPACE', () => {
      if (this.ui?.dialogOpen) { this.ui.advanceDialog(); return; }
      const L = this.leader;
      const v = L.direct && (L.direct.x || L.direct.y) ? [L.direct.x, L.direct.y] : L.facingVec();
      L.dodge(...v);
    });
    kb.on('keydown-ONE', () => this.leaderSkill(0));
    kb.on('keydown-TWO', () => this.leaderSkill(1));
    kb.on('keydown-THREE', () => this.leaderSkill(2));
    kb.on('keydown-Z', () => this.useUltimate(this.leader));
    kb.on('keydown-TAB', (e) => { e.preventDefault?.(); this.swapLeader(); });
    kb.on('keydown-Q', () => this.swapLeader(-1));
    kb.on('keydown-E', () => this.swapLeader(1));
    kb.on('keydown-M', () => this.toggleMute());
    kb.on('keydown-I', () => this.openMenu());
    kb.on('keydown-N', () => this.openMap());
    kb.on('keydown-H', () => this.usePotion('potion'));
    kb.on('keydown-J', () => this.usePotion('elixir'));
    kb.on('keydown-BACKTICK', () => this.ui?.toggleDebug());
    kb.on('keydown-ENTER', () => { if (this.ui?.dialogOpen) this.ui.advanceDialog(); });
    kb.addCapture('TAB,SPACE');
  }

  consumeUI() {
    if (this.registry.get('uiTap')) { this.registry.set('uiTap', false); return true; }
    return false;
  }

  toggleMute() { audio.setMuted(!audio.muted); this.events.emit('party'); }

  setSpeed(v) {
    this.speed = Math.round(Phaser.Math.Clamp(v, 0.3, 1.5) * 100) / 100;
    this.registry.set('gameSpeed', this.speed);
  }

  openMenu(opts = {}) {
    if (this.busy || this.ui?.dialogOpen || this.scene.isActive('Menu')) return;
    audio.sfx('click');
    this.scene.pause();
    this.scene.launch('Menu', { game: this, ...opts });
  }

  openMap() {
    if (this.busy || this.ui?.dialogOpen || this.scene.isActive('WorldMap') || this.scene.isActive('Menu')) return;
    audio.sfx('click');
    this.scene.pause();
    this.scene.launch('WorldMap', { game: this });
  }

  closeMap() { this.scene.resume(); }

  // Points of interest for the minimap / world map (tile coords).
  mapMarkers() {
    const m = [];
    const tile = (o) => ({ x: Math.floor(o.x / TILE), y: Math.floor(o.y / TILE) });
    for (const o of this.interactables) {
      if (o.hidden) continue;
      const t = tile(o);
      if (o.kind === 'chest') { const c = W.chests.find((k) => k.x === t.x && k.y === t.y); if (c && !this.flags[`chest_${c.id}`]) m.push({ ...t, kind: 'chest' }); }
      else if (o.kind === 'campfire') m.push({ ...t, kind: 'camp' });
      else if (o.kind === 'recruit') m.push({ ...t, kind: 'recruit' });
      else if (o.kind === 'warp') m.push({ ...t, kind: 'door' });
      else if (o.kind === 'frog') m.push({ ...t, kind: 'npc' });
      else if (o.kind === 'post') m.push({ ...t, kind: 'post' });
      else if (o.kind === 'shrine' || o.kind === 'lookout') m.push({ ...t, kind: 'recruit' });
    }
    for (const u of this.wardUnits()) m.push({ ...tile(u), kind: 'boss' });
    for (const n of this.npcs) m.push({ ...tile({ x: n.px, y: n.py }), kind: 'npc' });
    for (const n of this.quests.npcs) if (!n.hiddenNow) m.push({ x: n.x, y: n.y, kind: 'npc' });
    const pin = this.quests.pin();
    if (pin) m.push({ ...pin, kind: 'quest', always: true });
    for (const n of this.nodes) if (n.ready) m.push({ ...tile({ x: n.px, y: n.py }), kind: 'node' });
    const a = this.areaRect();
    return m.filter((k) => k.x >= a.x0 && k.x <= a.x1 && k.y >= a.y0 && k.y <= a.y1 && (k.always || this.minimap.isExplored(k.x, k.y)));
  }

  closeMenu() {
    this.scene.resume();
    this.autosave('menu');
    this.events.emit('party');
  }

  leaderSkill(i) {
    const L = this.leader;
    const t = L.command && L.command.type === 'attack' ? L.command.target : null;
    if (!L.useSkill(i, t) && L.skills[i]?.t > 0) audio.sfx('click');
    this.events.emit('party');
  }

  tapWorld(wx, wy) {
    const L = this.leader;
    if (L.downed) return;
    if (L.action?.type === 'harvest') this.cancelHarvest(L);
    // boss plates take priority over the boss behind them
    const plate = this.interactables.find((o) => o.kind === 'plate' && Math.hypot(o.x - wx, o.y - 24 - wy) < 16);
    if (plate) { plate.interact(L, plate); audio.sfx('click'); return; }
    const all = [...this.enemies.filter((e) => e.alive && !e.submerged), ...this.wardUnits(), ...this.breakables.filter((b) => b.alive)];
    let best = null, bd = 16;
    for (const e of all) {
      const d = Math.hypot(e.x - wx, e.y - (e.boss ? 24 : 8) - wy) - (e.kind === 'ward' || e.kind === 'breakable' ? 10 : e.boss ? 16 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      L.command = { type: 'attack', target: best };
      L.clearPath();
      this.fx.ring(best.x, best.y, 'ringRed', best.boss ? 3 : 1.6);
      audio.sfx('click');
      return;
    }
    for (const o of this.interactables) {
      if (o.hidden) continue;
      if (Math.hypot(o.x - wx, o.y - (o.h || 12) / 2 - wy) < 16 + (o.h || 12) / 2) {
        L.command = { type: 'interact', obj: o };
        L.clearPath();
        audio.sfx('click');
        return;
      }
    }
    this.nav.swimmer = this.canSwim;
    const path = this.nav.find(L.x, L.y, wx, wy);
    this.nav.swimmer = false;
    if (path) {
      L.command = { type: 'move' };
      L.path = path;
      L.pathGoal = { x: wx, y: wy };
      const end = path[path.length - 1];
      this.fx.ring(end.x, end.y, 'ringWhite', 1.4);
    }
  }

  // ============================================================== combat api
  nearestEnemy(from, range) {
    let best = null, bd = range;
    for (const e of this.enemies) { if (!e.alive || e.submerged) continue; const d = dist(e, from); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  nearestHero(from, range) {
    if (this.calmT > 0 && from.team !== 'party') return null; // just arrived: enemies haven't noticed yet
    let best = null, bd = range;
    for (const h of this.party) { if (!h.alive || h.downed || h.zipping || h.hiddenT > 0) continue; const d = dist(h, from); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  // Smoke clouds (Sable): enemies inside miss half their attacks.
  addSmoke(x, y, r, t) {
    const g = this.add.graphics().setDepth(y + 30).setAlpha(0.8);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = r * (0.3 + Math.random() * 0.55);
      g.fillStyle(i % 2 ? 0x6e6a87 : 0x45405e, 0.55).fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - 4, 8 + Math.random() * 6);
    }
    (this.smokes ??= []).push({ x, y, r, t, g });
    this.tweens.add({ targets: g, alpha: 0.55, duration: t * 1000, onComplete: () => g.destroy() });
    this.time.delayedCall(t * 1000, () => { this.smokes = this.smokes.filter((k) => k.g !== g); });
  }

  inSmoke(x, y) { return (this.smokes || []).some((k) => Math.hypot(x - k.x, (y - k.y) / 0.6) < k.r); }

  taunt(by, range, t) { for (const e of this.enemies) if (e.alive && dist(e, by) < range) e.setTaunt(by, t); }

  // All hero damage goes through here: element, passives and marks apply.
  // opts: crit, knock, element (forced, e.g. a skill), spell, basic (weapon hit), noProc
  dealDamage(src, target, amount, { crit = false, knock = 40, element = null, spell = false, basic = false, noProc = false } = {}) {
    const hero = src?.team === 'party' && src.passive;
    const weaponEl = src?.stats?.element;
    const el = element || weaponEl;
    if (target.elementMul) amount *= target.elementMul(el);
    if (target.status?.weaken) amount *= 1.1;
    if (target.marked) amount *= target.marked.mul;
    if (target.hawkMarked) amount *= 1.1;
    if (hero) {
      const rage = src.passive('rage');
      if (rage) amount *= 1 + (0.4 + 0.05 * (rage - 1)) * (1 - src.hp / src.maxHp);
      if (src.passive('steadyaim') && src.stillT > 1) amount *= 1.2;
      if (src.buffs?.primal) amount *= 1.5;
      if (src.hasTrait('slayer') && (target.elite || target.boss)) amount *= 1.15;
      // weapon gems: a little extra elemental damage on every hit
      for (const g of src.stats.gemElements || []) if (!g.armor) amount *= 1 + g.dmg * (target.elementMul ? target.elementMul(g.el) : 1);
      const bs = src.passive('backstab');
      if (bs && !spell && target.view) {
        const f = target.view === 'side' ? [target.flip ? -1 : 1, 0] : [0, target.view === 'down' ? 1 : -1];
        const [dx, dy] = norm(src.x - target.x, src.y - target.y);
        if (f[0] * dx + f[1] * dy < -0.3) { amount *= 1.5 + 0.1 * (bs - 1); if (!target.backstabShown) { target.backstabShown = true; this.floatText(target.x, target.y - 34, 'BACKSTAB', 'fontPlain', 0xff9ad8); } }
      }
    }
    target.lastElement = el;
    const dealt = target.damage(amount, src, { crit, knock });
    if (!dealt) return;
    if (!noProc && target.applyElement) {
      if (element) target.applyElement(element, src);
      else if (weaponEl && (!basic || Math.random() < 0.25)) target.applyElement(weaponEl, src);
      if (hero && src.envenom > 0 && !spell) { src.envenom--; target.applyElement('venom', src); }
      if (hero && src.surgeT > 0 && spell) for (const e of ['fire', 'frost', 'storm']) if (e !== element) target.applyElement(e, src);
      // Shock: this hit arcs to two nearby foes for 40%
      if (target.status?.shock && el !== 'storm' && !target.arcing) {
        const near = this.enemies.filter((e) => e !== target && e.alive && dist(e, target) < 60).slice(0, 2);
        for (const e of near) { e.arcing = true; this.dealDamage(src, e, dealt * 0.4, { knock: 0, noProc: true }); e.arcing = false; this.fx.burst('spark', e.x, e.y - 8, 4); }
      }
      if (el === 'light' && hero) { const low = this.party.filter((p) => !p.downed).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; low?.heal(Math.round(dealt * 0.02)); }
    }
    if (hero) {
      if (crit && src.passive('quickhands')) for (const k of src.skills) k.t = Math.max(0, k.t - 0.3 - 0.05 * (src.passive('quickhands') - 1));
      if (crit && spell && src.passive('studious')) { const k = [...src.skills].sort((a, b) => b.t - a.t)[0]; if (k) k.t = Math.max(0, k.t - 1); }
      if (src.passive('lightfingers') && !target.fingered && target.s?.gold) { target.fingered = true; if (Math.random() < 0.15 + 0.03 * (src.passive('lightfingers') - 1)) { for (let i = 0; i < 3; i++) this.dropCoin(target.x, target.y); this.floatText(target.x, target.y - 34, 'PILFERED', 'fontPlain', 0xf2c14e); } }
    }
    src.addUlt?.(dealt * tuning.ultChargeDeal);
    if (hero && src.hasTrait('lifesteal') && !src.downed) src.hp = Math.min(src.maxHp, src.hp + dealt * 0.03);
    if (hero && src.buffs?.primal && !src.downed) src.hp = Math.min(src.maxHp, src.hp + dealt * 0.2);
    this.fx.hit(target.x, target.y - (target.boss ? 24 : 8), crit);
    this.floatText(target.x + (Math.random() * 8 - 4), target.y - (target.boss ? 50 : 20), `${dealt}`, crit ? 'fontGold' : 'font', 0xffffff, crit);
    this.hitStop(crit ? 0.085 : 0.045);
    if (crit) { this.shake(80, 0.004); audio.sfx('crit'); }
    else if (target.kind === 'hexling' || target.kind === 'mire') audio.sfx('squish');
    else audio.sfx('hit', { pitch: target.kind === 'ward' || target.boss ? 0.6 : 1 });
  }

  spawnProjectile(o) {
    const tex = o.kind === 'knife' ? 'px_white' : o.kind === 'arrow' ? 'arrow' : 'firebolt';
    const s = this.add.sprite(o.x, o.y, tex).setDepth(TOP - 20);
    if (o.kind === 'knife') s.setScale(4, 1);
    else if (o.kind === 'arrow') { if (o.pierce) s.setScale(1.4); if (o.element === 'frost') s.setTint(0x9fe6ff); }
    else {
      s.play('firebolt');
      if (o.kind === 'fireball') s.setScale(o.echo ? 1.2 : 1.6);
      const el = o.owner?.stats?.element;
      if (o.echo || o.kind === 'missile') s.setTint(0xd28cff);
      else if (el === 'frost') s.setTint(0x9fe6ff);
      else if (el === 'venom') s.setTint(0xa6ff7a);
    }
    s.setRotation(Math.atan2(o.vy, o.vx));
    this.projectiles.push({ ...o, s, life: o.life ?? 1.2, trail: 0 });
  }

  updateProjectiles(dt) {
    const targets = [...this.enemies, ...this.wardUnits(), ...this.breakables.filter((b) => b.alive)];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.target && p.target.alive && (p.kind === 'bolt' || p.kind === 'missile')) {
        const [nx, ny] = norm(p.target.x - p.x, p.target.y - (p.target.boss ? 24 : 8) - p.y);
        const sp = Math.hypot(p.vx, p.vy);
        p.vx += (nx * sp - p.vx) * Math.min(1, dt * 6);
        p.vy += (ny * sp - p.vy) * Math.min(1, dt * 6);
        p.s.setRotation(Math.atan2(p.vy, p.vx));
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.setPosition(Math.round(p.x), Math.round(p.y));
      if (p.kind !== 'knife' && p.kind !== 'arrow') { p.trail -= dt; if (p.trail <= 0) { p.trail = 0.03; this.fx.burst('ember', p.x - p.vx * 0.02, p.y - p.vy * 0.02, 1); } }
      let hit = null;
      for (const e of targets) if (e.alive && !e.submerged && !p.hitSet?.has(e) && Math.hypot(e.x - p.x, e.y - (e.boss ? 24 : 8) - p.y) < e.r + 5) { hit = e; break; }
      if (hit && p.pierce) {
        // Power Shot: punches through everything in the line
        (p.hitSet ??= new Set()).add(hit);
        this.dealDamage(p.owner, hit, p.dmg, { knock: 60 });
        hit = null;
      }
      const t = this.painter.typeAt(p.x, p.y + 8);
      const wall = this.nav.solidAtPx(p.x, p.y + 8) && t !== T.WATER && t !== T.BOG && t !== T.CHASM;
      if (hit || p.life <= 0 || wall) {
        p.dead = true;
        p.s.destroy();
        if (p.kind === 'knife') { if (hit) this.dealDamage(p.owner, hit, p.dmg, { knock: 30 }); continue; }
        if (p.kind === 'arrow') {
          if (hit) {
            const crit = Math.random() < p.owner.stats.crit + (p.critBonus || 0);
            this.dealDamage(p.owner, hit, p.dmg * (crit ? tuning.critMult : 1) * (0.9 + Math.random() * 0.2), { crit, knock: 25, basic: p.basic, element: p.element });
            if (p.element === 'frost') hit.applyElement?.('frost', p.owner);
          }
          continue;
        }
        if (p.kind === 'missile') { this.fx.puff(p.x, p.y, 'sparkCurse'); if (hit) this.dealDamage(p.owner, hit, p.dmg, { knock: 20, spell: true }); continue; }
        audio.sfx('fireImpact');
        this.fx.burst('ember', p.x, p.y, p.kind === 'fireball' ? 22 : 8);
        if (p.aoe) {
          this.fx.ring(p.x, p.y + 6, 'ringGold', (p.aoe / 8) * 1.2);
          this.shake(90, 0.005);
          for (const e of targets) if (e.alive && Math.hypot(e.x - p.x, e.y - 8 - p.y) < p.aoe + e.r) this.dealDamage(p.owner, e, p.dmg * (e === hit ? 1 : 0.7), { knock: 90, element: p.element, spell: p.spell });
        } else if (hit) {
          const crit = Math.random() < p.owner.stats.crit;
          this.dealDamage(p.owner, hit, p.dmg * (crit ? tuning.critMult : 1) * (0.9 + Math.random() * 0.2), { crit, knock: 35, element: p.element, spell: p.spell, basic: p.basic });
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  addShockwave(x, y, delay, maxR, speed, opts = {}) {
    const g = this.add.graphics().setDepth(-3);
    this.shockwaves.push({ x, y, t: 0, delay, maxR, speed, hit: new Set(), g, ...opts });
  }

  updateShockwaves(dt) {
    for (const w of this.shockwaves) {
      w.t += dt;
      if (w.t < w.delay) continue;
      const r = (w.t - w.delay) * w.speed;
      w.g.clear().lineStyle(2, 0xec6a5e, 1 - r / w.maxR).strokeEllipse(w.x, w.y, r * 2, r * 1.3);
      w.g.lineStyle(1, 0xffd04a, 0.7 * (1 - r / w.maxR)).strokeEllipse(w.x, w.y, r * 2 - 4, r * 1.3 - 3);
      for (const h of this.party) {
        if (!h.alive || h.downed || w.hit.has(h) || (w.skipSwimmers && h.swimming)) continue;
        const d = Math.hypot((h.x - w.x), (h.y - w.y) / 0.65);
        if (Math.abs(d - r) < 7) { w.hit.add(h); h.damage(16 * this.difficulty.dmg, { x: w.x, y: w.y }); }
      }
      if (r > w.maxR) { w.g.destroy(); w.done = true; }
    }
    this.shockwaves = this.shockwaves.filter((w) => !w.done);
  }

  // ============================================================== ultimates
  useUltimate(h) {
    if (h.downed || !h.alive || h.ult < 100 || this.busy) { audio.sfx('click'); return false; }
    h.ult = 0;
    const sc = this;
    audio.sfx('ult');
    this.events.emit('ult', h);
    this.hitStop(0.12);
    switch (h.ultimate.id) {
      case 'bulwark': {
        sc.shake(200, 0.008);
        sc.fx.ring(h.x, h.y, 'ringGold', 9);
        for (const p of this.party) {
          if (p.downed) continue;
          p.shield = Math.round(p.maxHp * 0.35); p.shieldT = 6;
          sc.fx.ring(p.x, p.y - 8, 'ringBlue', 2.5);
        }
        sc.taunt(h, 150, 5);
        for (const e of this.enemies) if (e.alive && dist(e, h) < 56) this.dealDamage(h, e, h.stats.atk * 1.2, { knock: 150 });
        sc.floatText(h.x, h.y - 36, 'BULWARK!', 'fontGold', 0xffffff, true);
        break;
      }
      case 'meteor': {
        const pool = this.enemies.filter((e) => e.alive && dist(e, h) < 190);
        if (!pool.length) { h.ult = 100; audio.sfx('click'); this.floatText(h.x, h.y - 30, 'NO TARGETS', 'fontPlain'); return false; }
        const t = pool.map((e) => [e, pool.filter((o) => dist(o, e) < 44).length]).sort((a, b) => b[1] - a[1])[0][0];
        const tx = t.x, ty = t.y;
        h.face(tx - h.x, ty - h.y);
        h.action = { type: 'skill', id: 'meteor', t: 0, dur: 0.6 }; h.anim = ''; h.play('cast');
        const g = this.fx.telegraph(tx, ty, 46, 0.8);
        g.setDepth(-2);
        const m = this.add.sprite(tx - 60, ty - 180, 'firebolt').play('firebolt').setScale(3.2).setDepth(TOP - 15).setRotation(Math.atan2(180, 60));
        audio.sfx('fireCast');
        this.tweens.add({
          targets: m, x: tx, y: ty - 8, duration: 800, ease: 'Quad.easeIn',
          onUpdate: () => this.fx.burst('ember', m.x, m.y, 2),
          onComplete: () => {
            m.destroy(); g.destroy();
            this.shake(350, 0.014); this.cameras.main.flash(120, 255, 200, 120);
            audio.sfx('fireImpact'); audio.sfx('bash');
            this.fx.burst('ember', tx, ty, 50); this.fx.ring(tx, ty, 'ringGold', 7);
            for (const e of [...this.enemies, ...this.wardUnits()]) if (e.alive && Math.hypot(e.x - tx, e.y - ty) < 46 + e.r) this.dealDamage(h, e, h.stats.atk * 6, { crit: true, knock: 200 });
          },
        });
        sc.floatText(h.x, h.y - 36, 'METEOR!', 'fontGold', 0xffffff, true);
        break;
      }
      case 'talons': {
        // Storm of Talons: Kestrel and a rain of arrows on every foe nearby
        const pool = () => this.enemies.filter((e) => e.alive && !e.submerged && dist(e, h) < 180);
        if (!pool().length) { h.ult = 100; audio.sfx('click'); this.floatText(h.x, h.y - 30, 'NO TARGETS', 'fontPlain'); return false; }
        sc.floatText(h.x, h.y - 36, 'STORM OF TALONS!', 'fontGold', 0xffffff, true);
        const hawk = this.add.sprite(h.x, h.y - 60, 'hawk', '0').play('hawk').setDepth(TOP - 15).setScale(1.4);
        for (let i = 0; i < 20; i++) this.time.delayedCall(i * 200, () => {
          const list = pool();
          if (!list.length) return;
          const e = list[Math.floor(Math.random() * list.length)];
          if (i % 3 === 0) this.tweens.add({ targets: hawk, x: e.x, y: e.y - 12, duration: 160, yoyo: true });
          const ar = this.add.image(e.x - 12, e.y - 70, 'arrow').setRotation(1.4).setDepth(TOP - 20);
          this.tweens.add({ targets: ar, x: e.x, y: e.y - 6, duration: 150, onComplete: () => { ar.destroy(); if (e.alive) this.dealDamage(h, e, h.stats.atk * 0.8, { knock: 15 }); } });
          audio.sfx('swing', { pitch: 1.8 });
        });
        this.time.delayedCall(4200, () => this.tweens.add({ targets: hawk, y: hawk.y - 120, alpha: 0, duration: 500, onComplete: () => hawk.destroy() }));
        break;
      }
      case 'primal': {
        h.buff('primal', 1, 8);
        sc.fx.ring(h.x, h.y - 6, 'ringRed', 7);
        sc.shake(260, 0.01);
        audio.sfx('roar');
        h.sprite.setTint(0xffb0a0);
        this.time.delayedCall(8000, () => { if (!h.flashT) h.sprite.clearTint(); });
        sc.floatText(h.x, h.y - 36, 'PRIMAL FORM!', 'fontGold', 0xffffff, true);
        break;
      }
      case 'thousand_cuts': {
        const targets = this.enemies.filter((e) => e.alive && dist(e, h) < 170).sort((a, b) => dist(a, h) - dist(b, h)).slice(0, 6);
        if (!targets.length) { h.ult = 100; audio.sfx('click'); this.floatText(h.x, h.y - 30, 'NO TARGETS', 'fontPlain'); return false; }
        const home = { x: h.x, y: h.y };
        h.invuln = 0.15 * targets.length + 0.4;
        h.zipping = true;
        sc.floatText(h.x, h.y - 36, 'THOUSAND CUTS!', 'fontGold', 0xffffff, true);
        targets.forEach((e, i) => this.time.delayedCall(130 * i, () => {
          if (!e.alive) return;
          this.fx.ghost(h);
          h.x = e.x - 10; h.y = e.y + 2; h.face(1, 0); h.anim = ''; h.play('attack'); h.sync(0);
          this.fx.puff(h.x, h.y, 'sparkCurse');
          audio.sfx('stab');
          this.dealDamage(h, e, h.stats.atk * 2.5, { crit: true, knock: 60 });
        }));
        this.time.delayedCall(130 * targets.length + 120, () => {
          this.fx.ghost(h); h.x = home.x; h.y = home.y; h.zipping = false; h.anim = '';
          this.fx.puff(h.x, h.y, 'sparkCurse');
        });
        break;
      }
    }
    return true;
  }

  // ============================================================== helpers
  hitStop(t) { this.hitStopT = Math.max(this.hitStopT, t); }
  shake(ms, amt) { this.cameras.main.shake(ms, amt); }

  surfaceAt(x, y) {
    const t = this.painter.typeAt(x, y);
    return t === T.PAVED || t === T.STAIRS || t === T.CAVEFLOOR || t === T.DFLOOR || t === T.BRIDGE ? 'stone' : t === T.PATH || t === T.SAND || t === T.SHALLOW ? 'path' : 'grass';
  }

  floatText(x, y, text, font = 'font', tint = 0xffffff, big = false) {
    const t = this.add.bitmapText(Math.round(x), Math.round(y), font, String(text).toUpperCase()).setOrigin(0.5).setDepth(TOP + 5);
    if (tint !== 0xffffff) t.setTint(tint);
    if (big) t.setScale(1.5);
    this.tweens.add({ targets: t, y: y - 14, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 520, duration: 260, onComplete: () => t.destroy() });
  }

  bark(h, text) {
    if (!h || !text) return;
    if (this.barkObj) this.barkObj.destroy();
    const t = this.add.bitmapText(0, 0, 'font', '').setOrigin(0.5, 1).setDepth(TOP + 6);
    this.barkObj = t;
    let i = 0;
    const ev = this.time.addEvent({ delay: 32, repeat: text.length - 1, callback: () => {
      i++; t.setText(text.slice(0, i));
      if (i % 2 === 0 && text[i - 1] !== ' ') audio.sfx('blip', { voice: h.def?.voice || h.voice });
    } });
    t.follow = h;
    this.time.delayedCall(text.length * 32 + 2200, () => { if (this.barkObj === t) this.barkObj = null; ev.remove(); this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() }); });
  }

  autosave(reason) {
    const L = this.leader;
    this.state.explored = this.minimap.serialize();
    this.state.pos = { x: Math.round(L.x), y: Math.round(L.y) };
    for (const h of this.party) h.hs.hp = h.hp;
    if (saveState(this.state)) this.events.emit('saved', reason);
  }

  nextFrame() { return new Promise((r) => this.events.once('postupdate', r)); }

  placeName(x, y) {
    const id = biomeAt(Math.floor(x / TILE), Math.floor(y / TILE));
    return W.regions.find((r) => r.id === id)?.name || { cave: 'FENMOUTH CAVE', grotto: 'HIDDEN GROTTO', shop: "MARLA'S GOODS", tavern: "BRUNO'S TAVERN" }[id] || 'THE NINTH TOWER';
  }

  // Biome art groups wanted around a tile (shared by streaming and preloading).
  groupsNear(tx, ty, area) {
    const out = [];
    if ((ty > MARSH_Y - 22 && area === 'overworld') || area === 'abbey') out.push('marsh');
    if (Math.hypot(tx - 96, ty - 90) < 26 || Math.hypot(tx - 73, ty - 16) < 20 || area !== 'overworld') out.push('cave');
    if (Math.hypot(tx - 17, ty - 30) < 24 || area === 'shop' || area === 'tavern') out.push('interior', 'cave');
    return out;
  }

  // Get everything around (x, y) ready before play resumes: art groups for
  // the area and its props, every terrain chunk in and around the view, the
  // enemy groups there, then a few frames for the frame time to settle.
  // `ui` is the loading curtain (or a stand-in) that receives progress.
  async prepareAt(x, y, ui, settleFrames = 4) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const area = areaAt(tx, ty);
    const vw = this.scale.width, vh = this.scale.height;
    const need = new Set(this.groupsNear(tx, ty, area));
    const reach = Math.hypot(vw, vh) * 0.5 + CHUNK * 2;
    for (const [k, list] of this.propsByChunk) {
      const [cx, cy] = k.split(',').map(Number);
      if (Math.hypot((cx + 0.5) * CHUNK - x, (cy + 0.5) * CHUNK - y) > reach) continue;
      for (const p of list) if (PROP_GROUP[p.type]) need.add(PROP_GROUP[p.type]);
    }
    const groups = [...need].filter((g) => !loaded.has(g));
    for (let i = 0; i < groups.length; i++) {
      await loadGroup(this, groups[i], (p) => ui?.setProgress(0.35 * (i + p) / groups.length, 'GATHERING ART'));
    }
    ui?.setProgress(0.35, 'PAINTING THE WORLD');
    for (;;) {
      this.streamer.update(x, y, vw, vh);
      const p = this.streamer.wantedProgress();
      ui?.setProgress(0.35 + 0.5 * p, 'PAINTING THE WORLD');
      if (p >= 1) break;
      await this.nextFrame();
    }
    ui?.setProgress(0.88, 'WAKING THE LOCALS');
    this.updateGroups(0);
    let calm = 0;
    for (let i = 0; i < 120 && calm < settleFrames; i++) {
      await this.nextFrame();
      calm = this.game.loop.rawDelta < 40 ? calm + 1 : 0;
      ui?.setProgress(0.88 + 0.12 * Math.min(1, calm / settleFrames));
    }
  }

  waitForWorld(cb) {
    const v = this.cameras.main.worldView;
    if (this.streamer.isReady(v.x, v.y, v.width || this.scale.width, v.height || this.scale.height)) { cb(); return; }
    this.time.delayedCall(50, () => this.waitForWorld(cb));
  }

  // ============================================================== events
  onEnemyKilled(e) {
    audio.sfx('enemyDie');
    this.fx.dust(e.x, e.y);
    this.fx.burst('curse', e.x, e.y - 6, 10);
    const n = Phaser.Math.Between(...e.s.gold);
    for (let i = 0; i < n; i++) this.dropCoin(e.x, e.y);
    for (const h of this.party) if (!h.downed) h.gainXp(xpFor(h.level, e.level, e.s.xp));
    this.state.stats.kills++;
    if (e.s.gem && Math.random() < e.s.gem) {
      // warlocks and witchlings sometimes carry a chipped gem
      const kinds = ['ember', 'rime', 'storm', 'venom', 'sun', 'gloam', 'ruby', 'onyx', 'topaz', 'emerald'];
      const g = `${kinds[Math.floor(Math.random() * kinds.length)]}1`;
      this.state.gems[g] = (this.state.gems[g] || 0) + 1;
      this.time.delayedCall(400, () => this.floatText(e.x, e.y - 40, 'A GEM!', 'fontGold'));
    }
    const drop = rollGearDrop(this.state, e.level, e.elite);
    if (drop) this.dropLoot(drop, e.x, e.y);
    const got = {};
    for (const [m, chance] of Object.entries(e.s.drops || {})) {
      const n = (Math.random() < chance ? 1 : 0) + (e.elite ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0);
      if (n) got[m] = n;
    }
    this.quests?.onKill(e);
    if (Object.keys(got).length) {
      addMats(this.state, got);
      for (const [m, n] of Object.entries(got)) this.quests?.onGather(m, n);
      this.time.delayedCall(250, () => this.floatText(e.x, e.y - 30, Object.entries(got).map(([k, n]) => `+${n} ${CRAFT.materials[k].name}`).join(' '), 'fontPlain', 0xbfe6f2));
    }
    this.events.emit('party');
  }

  onBossKilled(b) {
    const B = b.bossDef || this.bossDefs()[0];
    this.flags[B.flag] = true;
    audio.sfx('shatter'); audio.sfx('roar');
    this.shake(700, 0.014);
    this.cameras.main.flash(200, 255, 255, 255);
    this.fx.burst('curse', b.x, b.y - 20, 60);
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 150, () => this.fx.dust(b.x + (i - 1.5) * 12, b.y));
    for (let i = 0; i < 18; i++) this.dropCoin(b.x, b.y);
    (B.cfg.drops || []).forEach((id, i) => this.time.delayedCall(300 + i * 200, () => this.dropLoot(id, b.x + (i - 1.5) * 14, b.y + 6)));
    this.state.gold += B.cfg.gold || 0;
    for (const h of this.party) if (!h.downed) h.gainXp(b.s.xp);
    this.golem = null;
    for (const w of this.wards) if (this.flags[w.def.guardian]) w.shieldFx?.setVisible(false);
    this.events.emit('boss', null);
    this.events.emit('banner', `${B.cfg.name} FALLS`, "THE WARD STONE'S BARRIER HAS FAILED");
    this.sealArena(false);
    for (const e of this.enemies) if (e.alive && e.summoned) e.damage(999, this.leader);
    this.autosave('boss');
  }

  dropCoin(x, y) {
    const c = this.add.sprite(x, y - 6, 'coin').play('coin').setDepth(TOP - 30);
    const a = Math.random() * Math.PI * 2;
    const tx = x + Math.cos(a) * 14, ty = y + Math.sin(a) * 8;
    this.tweens.add({ targets: c, x: tx, duration: 380 });
    this.tweens.add({ targets: c, y: ty - 14, duration: 190, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: c, y: ty, duration: 190, ease: 'Bounce.easeOut' }) });
    this.time.delayedCall(700 + Math.random() * 300, () => {
      const L = this.leader;
      this.tweens.add({ targets: c, x: L.x, y: L.y - 10, duration: 260, ease: 'Quad.easeIn', onComplete: () => {
        c.destroy(); this.state.gold += this.party.some((h) => !h.downed && h.hasTrait('fortune')) && Math.random() < 0.1 ? 2 : 1; audio.sfx('coin'); this.fx.coinBurst(this.leader.x, this.leader.y); this.events.emit('party');
      } });
    });
  }

  dropLoot(id, x, y) {
    const it = items[id];
    const key = it.rarity === 'unique' || it.rarity === 'legendary' ? 'lootU' : it.rarity === 'common' ? 'lootC' : 'lootF';
    const s = this.add.sprite(x, y - 6, key).play(key).setDepth(TOP - 31);
    if (it.rarity === 'rare') s.setTint(0x9fc0ff);
    const beam = this.add.rectangle(x, y - 20, 2, 26, { unique: 0xfff0a0, legendary: 0xffb060, rare: 0x6f93e0 }[it.rarity] || 0xa6d36a, 0.5).setDepth(TOP - 32).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: beam, alpha: 0.15, duration: 600, yoyo: true, repeat: -1 });
    const a = Math.random() * Math.PI * 2;
    const tx = x + Math.cos(a) * 10, ty = y + Math.sin(a) * 6;
    this.tweens.add({ targets: s, x: tx, duration: 380 });
    this.tweens.add({ targets: s, y: ty - 16, duration: 190, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: s, y: ty, duration: 220, ease: 'Bounce.easeOut' }) });
    this.tweens.add({ targets: beam, x: tx, y: ty - 14, duration: 400 });
    audio.sfx('coin');
    this.loot.push({ id, s, beam, x: tx, y: ty, t: 0 });
  }

  updateLoot(dt) {
    for (const l of this.loot) {
      l.t += dt;
      if (l.t < 0.6) continue;
      const h = this.party.find((p) => !p.downed && Math.hypot(p.x - l.x, p.y - l.y) < 16);
      if (!h) continue;
      l.dead = true;
      l.s.destroy(); this.tweens.killTweensOf(l.beam); l.beam.destroy();
      this.state.inventory.push(l.id);
      audio.sfx('chest');
      this.fx.burst('gold', l.x, l.y - 6, 14);
      this.events.emit('loot', { ids: [l.id] });
      this.autosave('loot');
    }
    this.loot = this.loot.filter((l) => !l.dead);
  }

  onLevelUp(h) {
    if (h === this.leader) this.state.stats.levelUps.push({ level: h.level, t: Math.round(this.state.playTime), kills: this.state.stats.kills });
    audio.sfx('levelUp');
    this.time.delayedCall(900, () => this.floatText(h.x, h.y - 44, '+1 SKILL POINT', 'fontPlain', 0x8cff8c));
    this.floatText(h.x, h.y - 34, 'LEVEL UP!', 'fontGold', 0xffffff, true);
    this.fx.burst('gold', h.x, h.y - 10, 16);
    this.events.emit('party');
  }

  onHeroDowned(h) {
    if (h.isLeader) {
      const next = this.party.find((p) => !p.downed);
      if (next) this.time.delayedCall(250, () => this.setLeader(next));
    }
    if (this.party.every((p) => p.downed)) this.wipe();
  }

  wipe() {
    this.events.emit('banner', 'THE PARTY FALLS...', 'REGROUPING AT THE CAMPFIRE');
    this.busy = true;
    this.cameras.main.fadeOut(900, 10, 6, 20);
    this.time.delayedCall(1100, () => {
      this.state.gold -= Math.floor(this.state.gold * 0.1);
      const st = W.start;
      this.party.forEach((h, i) => { h.x = (st.x + i) * TILE; h.y = st.y * TILE; h.downed = false; h.hp = h.maxHp; h.sprite.setAlpha(1); h.anim = ''; h.clearPath(); h.command = null; });
      for (const e of this.enemies) if (e.alive) { e.x = e.spawn.x; e.y = e.spawn.y; e.state = 'idle'; e.target = null; e.engaged = false; e.hp = e.maxHp; e.clearZone(); }
      if (this.golem) { for (const p of this.golem.plates || []) { p.img.destroy(); this.removeInteractable(p.o); } this.golem.alive = false; this.golem.destroy(); this.golem = null; this.events.emit('boss', null); this.sealArena(false); }
      this.setLeader(this.party[0], true);
      this.cameras.main.centerOn(this.leader.x, this.leader.y);
      this.waitForWorld(() => { this.cameras.main.fadeIn(700); this.busy = false; });
      this.events.emit('party');
    });
  }

  rest() {
    for (const h of this.party) { if (h.downed) h.revive(1); h.hp = h.maxHp; this.fx.heal(h.x, h.y); }
    audio.sfx('heal');
    this.autosave('rest');
    this.events.emit('banner', 'THE PARTY RESTS', 'HP RESTORED  -  GAME SAVED');
    this.events.emit('party');
    // with more than three heroes, the campfire is where you choose who travels
    if (this.state.recruited.length > 3) this.time.delayedCall(400, () => this.events.emit('dialogue', [{ who: 'CAMPFIRE', text: 'THE FIRE CRACKLES. YOUR WHOLE COMPANY IS HERE.', choices: [['CHANGE PARTY', () => this.openMenu({ tab: 'party' })], ['RESUME', () => {}]] }]));
  }

  openChest(c, img, h) {
    const flag = `chest_${c.id}`;
    if (this.flags[flag]) { this.events.emit('dialogue', [{ who: 'CHEST', text: "IT'S EMPTY. YOU ALREADY LOOTED IT. SHAMELESS." }]); return; }
    this.flags[flag] = true;
    img.setTexture('chestOpen');
    audio.sfx('chest');
    this.fx.burst('gold', img.x, img.y - 10, 24);
    this.state.gold += c.gold || 0;
    const loot = c.items || [];
    this.state.inventory.push(...loot);
    addMats(this.state, c.mats || {});
    addPotions(this.state, c.potions || {});
    if (loot.length) this.events.emit('loot', { ids: loot, gold: c.gold });
    const extras = [c.gold && !loot.length ? `${c.gold} GOLD` : null,
      ...Object.entries(c.potions || {}).map(([k, n]) => `${n} ${CRAFT.consumables[k].name}`),
      ...Object.entries(c.mats || {}).map(([k, n]) => `${n} ${CRAFT.materials[k].name}`)].filter(Boolean);
    if (extras.length) this.time.delayedCall(loot.length ? 2600 * loot.length : 0, () => this.events.emit('banner', 'TREASURE!', extras.join(', ')));
    const RELICS = {
      grapple: ['GRAPPLE HOOK ACQUIRED', 'TAP A HOOK POST TO HAUL UP A LEDGE OR SWING OVER WATER'],
      tide: ['TIDE CHARM ACQUIRED', 'THE PARTY CAN SWIM THROUGH DEEP WATER'],
    };
    if (c.relic && !this.state.relics.includes(c.relic)) {
      this.state.relics.push(c.relic);
      this.time.delayedCall(2600, () => { audio.sfx('levelUp'); this.events.emit('banner', ...(RELICS[c.relic] || [c.relic.toUpperCase(), ''])); });
    }
    // some chests are bait: hollow guards rise when the lid opens
    if (c.ambush) this.time.delayedCall(900, () => { for (const [k, x, y] of c.ambush) this.spawnEnemy(k, x * TILE + 8, y * TILE + 8, true); this.bark(h, 'THE ARMOUR IS MOVING!'); });
    this.time.delayedCall(1800, () => this.bark(h, BARKS.chest[h.def.id]));
    this.autosave('chest');
    this.events.emit('party');
  }

  useShrine(k, img) {
    const flag = `shrine_${k.id}`;
    if (this.flags[flag]) { this.events.emit('dialogue', [{ who: 'SHRINE', text: 'THE RUNE IS DARK. ITS GIFT IS ALREADY GIVEN.' }]); return; }
    this.flags[flag] = true;
    img.setTexture('shrineUsed');
    img.glow?.destroy();
    for (const id of this.state.recruited) this.state.heroes[id].sp = (this.state.heroes[id].sp || 0) + 1;
    for (const h of this.party) { if (h.downed) h.revive(1); h.hp = h.maxHp; this.fx.heal(h.x, h.y); }
    audio.sfx('levelUp'); audio.sfx('heal');
    this.fx.burst('bloom', img.x, img.y - 14, 30);
    const n = Object.keys(this.flags).filter((f) => f.startsWith('shrine_')).length;
    this.events.emit('banner', 'SHRINE OF INSIGHT', `+1 SKILL POINT FOR EVERY HERO  (${n} / 12 SHRINES)`);
    this.autosave('shrine');
  }

  climbLookout(k) {
    const L = this.leader;
    const first = !this.flags[`lookout_${k.id}`];
    this.flags[`lookout_${k.id}`] = true;
    this.minimap.reveal(k.x, k.y, k.r);
    this.minimap.flush();
    audio.sfx('levelUp');
    this.cameras.main.flash(200, 255, 240, 200);
    this.events.emit('banner', k.name, first ? 'THE LAND AROUND IS SKETCHED ONTO YOUR MAP' : 'A FINE VIEW. STILL.');
    if (first) for (const h of this.party) if (!h.downed) h.gainXp(60);
    this.bark(L, first ? 'YOU CAN SEE HALF THE KINGDOM FROM UP HERE.' : 'SAME VIEW. STILL GOOD.');
    this.autosave('lookout');
  }

  grapple(o) {
    const L = this.leader;
    if (!this.state.relics.includes('grapple')) { this.bark(L, BARKS.gap[L.def.id]); return; }
    const pair = this.interactables.find((i) => i.kind === 'post' && i.id === o.pair);
    const land = o.land ? { x: o.land[0] * TILE + TILE / 2, y: o.land[1] * TILE + TILE / 2 } : { x: pair.x + Math.sign(pair.x - o.x) * 14, y: pair.y + 10 };
    const up = land.y < o.y - 24; // hauling up a cliff vs. dropping down it
    this.busy = true;
    const zipOne = (h, delay) => this.time.delayedCall(delay, () => {
      h.zipping = true; h.clearPath(); h.command = null; h.target = null; h.action = null;
      const line = this.add.graphics().setDepth(TOP - 18);
      const from = { x: h.x, y: h.y - 12 };
      audio.sfx('zip');
      const hook = { k: 0 };
      this.tweens.add({ targets: hook, k: 1, duration: 160, onUpdate: () => {
        line.clear().lineStyle(1, 0xc4cfe2, 1).lineBetween(from.x, from.y, from.x + (pair.x - from.x) * hook.k, from.y + (pair.y - 16 - from.y) * hook.k);
      }, onComplete: () => {
        const ox = h.x, oy = h.y;
        const tgt = { x: land.x + (h === L ? 0 : (Math.random() - 0.5) * 16), y: land.y + (h === L ? 0 : (up ? -8 : 8) - Math.random() * 6 * (up ? 1 : -1)) };
        this.tweens.addCounter({ from: 0, to: 1, duration: up ? 520 : 380, ease: up ? 'Quad.easeIn' : 'Sine.easeInOut', onUpdate: (tw) => {
          const k = tw.getValue();
          h.x = ox + (tgt.x - ox) * k; h.y = oy + (tgt.y - oy) * k - Math.sin(k * Math.PI) * (up ? 10 : 18);
          line.clear().lineStyle(1, 0xc4cfe2, 1).lineBetween(h.x, h.y - 12, pair.x, pair.y - 16);
          if (Math.random() < 0.5) this.fx.ghost(h);
        }, onComplete: () => { line.destroy(); h.zipping = false; this.fx.dust(h.x, h.y); if (h === L) this.busy = false; } });
      } });
    });
    zipOne(L, 0);
    this.party.filter((p) => p !== L && !p.downed).forEach((p, i) => zipOne(p, 450 + i * 300));
  }

  warp(w) {
    if (w.door) { this.doorWarp(w); return; }
    this.busy = true;
    audio.sfx('warp');
    this.cameras.main.fadeOut(350, 5, 3, 10);
    this.time.delayedCall(380, () => this.teleportParty(w, () => { this.cameras.main.fadeIn(400); this.busy = false; this.autosave('warp'); }));
  }

  // Move the party to a warp's destination, wait for the area to be painted.
  teleportParty(w, onReady, arriveOffsetY = 0) {
    const tx = w.to.x * TILE + 8, ty = w.to.y * TILE + 8;
    const dest = areaAt(w.to.x, w.to.y);
    this.enterArea(dest);
    this.party.forEach((h, i) => { h.x = tx + (i ? (i === 1 ? -12 : 12) : 0); h.y = ty + arriveOffsetY + (i ? 10 : 0); h.clearPath(); h.command = null; h.target = null; h.action = null; h.sync(0); });
    for (const e of this.enemies) if (e.alive && e.engaged) { e.state = 'return'; e.engaged = false; e.target = null; e.clearZone(); }
    this.cameras.main.centerOn(tx, ty);
    for (const o of this.interactables) if (o.kind === 'warp') o.armed = false;
    // Quick hops finish under the fade; the loading curtain only comes up
    // when the destination takes a while (new biome art, many chunks).
    const t0 = performance.now();
    let curtain = null;
    const ui = {
      setProgress: (p, label) => {
        if (!curtain && performance.now() - t0 > 250) {
          this.scene.launch('Loading', { title: this.placeName(tx, ty) });
          curtain = this.scene.get('Loading');
        }
        curtain?.setProgress(p, label);
      },
    };
    this.prepareAt(tx, ty, ui, 2).then(() => {
      this.calmT = 1;
      if (curtain) curtain.done(); // fades over the camera fade-in
      onReady();
    });
  }

  // Buildings: the door swings open, the party steps through, and it closes
  // behind them on the other side.
  doorWarp(w) {
    const d = this.doors[w.building];
    if (!d) { this.warp({ ...w, door: false }); return; }
    this.busy = true;
    const entering = !w.exit;
    const L = this.leader;
    const open = (outside) => { if (outside) d.ext.setVisible(true); else d.int.setTexture('idoor_open'); };
    const close = (outside) => { if (outside) d.ext.setVisible(false); else d.int.setTexture('idoor'); audio.sfx('doorClose'); };
    open(entering);
    audio.sfx('doorOpen');
    const dir = entering ? -1 : 1;
    for (const h of this.party) { h.face(0, dir); h.anim = ''; h.play('walk'); }
    this.tweens.killTweensOf(this.party);
    this.tweens.add({ targets: this.party, y: `+=${dir * 12}`, duration: 320 });
    this.time.delayedCall(220, () => this.cameras.main.fadeOut(220, 5, 3, 10));
    this.time.delayedCall(470, () => {
      this.tweens.killTweensOf(this.party); // the step-in tween must not fight the teleport
      if (!entering) close(false);
      open(!entering);
      // arrive on the doorstep, then walk clear of the door
      this.teleportParty(w, () => {
        this.cameras.main.fadeIn(260);
        for (const h of this.party) { h.face(0, entering ? -1 : 1); h.anim = ''; h.play('walk'); }
        this.tweens.add({ targets: this.party, y: `+=${entering ? -12 : 12}`, duration: 340, onComplete: () => {
          for (const h of this.party) { h.anim = ''; }
          close(!entering);
          if (entering) d.ext.setVisible(false);
          this.busy = false;
          this.autosave('warp');
        } });
      }, entering ? 12 : -12);
    });
  }


  talkRecruit(npc) {
    const g = npc.r.guardedBy && this.groups.find((x) => x.id === npc.r.guardedBy);
    if (g && !this.state.cleared[g.id] && (!g.active || g.units.some((u) => u.alive))) { this.bark({ x: npc.sprite.x, y: npc.sprite.y, def: { voice: heroInfo(npc.id).voice } }, BARKS.help[npc.id] || 'HELP!'); return; }
    const info = heroInfo(npc.id);
    const lines = info.recruit.map((text) => ({ who: info.name.toUpperCase(), portrait: `${npc.id}_portrait`, voice: info.voice, text }));
    lines.push({ who: info.name.toUpperCase(), portrait: `${npc.id}_portrait`, voice: info.voice, text: 'LEAD THE WAY.' });
    this.events.emit('dialogue', lines, () => this.recruit(npc));
  }

  recruit(npc) {
    npc.sprite.destroy(); npc.sh.destroy(); npc.mark.destroy();
    npc.o.hidden = true;
    this.interactables = this.interactables.filter((i) => i !== npc.o);
    this.addRecruit(npc.id, npc.sprite.x, npc.sprite.y);
  }

  // A hero joins: caught up to the party's level (C3), into the party if
  // there's room, otherwise onto the bench until the next campfire.
  addRecruit(id, x, y) {
    const st = this.state;
    if (st.recruited.includes(id)) return;
    st.recruited.push(id);
    const hs = st.heroes[id];
    const avg = Math.round(this.party.reduce((a, h) => a + h.level, 0) / Math.max(1, this.party.length));
    if (hs.level < avg) {
      const shrines = Object.keys(this.flags).filter((f) => f.startsWith('shrine_')).length;
      hs.sp = (hs.sp || 0) + (avg - hs.level) + shrines;
      hs.level = avg; hs.xp = 0;
    }
    audio.sfx('levelUp');
    this.party.find((h) => h.def.id === id)?.refreshStats();
    if (st.active.includes(id)) { this.events.emit('partyChanged'); this.autosave('recruit'); return; }
    if (st.active.length < 3) {
      st.active.push(id);
      const h = new Hero(this, id, hs, x, y);
      this.party.push(h);
      this.fx.burst('gold', h.x, h.y - 10, 20);
      this.events.emit('banner', `${h.def.name.toUpperCase()} JOINED THE PARTY!`, 'TAP A PORTRAIT TO SWITCH HEROES');
    } else {
      this.fx.burst('gold', x, y - 10, 20);
      this.events.emit('banner', `${heroInfo(id).name.toUpperCase()} JOINED!`, 'THE PARTY IS FULL - SWAP HEROES AT ANY CAMPFIRE');
    }
    this.events.emit('partyChanged');
    this.autosave('recruit');
  }

  // Rebuild the travelling party from state.active (campfire swaps).
  applyParty() {
    const st = this.state;
    if (!st.active.length) st.active = [st.leader];
    for (const h of [...this.party]) if (!st.active.includes(h.def.id)) {
      this.gearFx.clear?.(h.def.id);
      h.alive = false; h.destroy();
      this.party = this.party.filter((p) => p !== h);
    }
    const L = this.leader && this.party.includes(this.leader) ? this.leader : this.party[0];
    for (const id of st.active) if (!this.party.some((h) => h.def.id === id)) {
      const h = new Hero(this, id, st.heroes[id], (L?.x ?? 0) + 12, (L?.y ?? 0) + 8);
      this.party.push(h);
      this.fx.puff(h.x, h.y, 'spark');
    }
    this.setLeader(this.party.includes(L) ? L : this.party[0], true);
    this.events.emit('partyChanged');
    this.autosave('party');
  }

  talkFrog() {
    const K = { who: 'KING ALDRIC', portrait: 'portrait_frog', voice: { pitch: 110, wave: 'square', duty: 0.125 } };
    const st = this.state;
    const tiers = W.flyRewards;
    const next = tiers[st.flyRewards];
    if (next && st.flies.length >= next.n) {
      st.flyRewards++;
      st.gold += next.gold || 0;
      addPotions(st, next.potions || {});
      addMats(st, next.mats || {});
      if (next.blessing) { st.flags.blessing = true; for (const h of this.party) h.refreshGear(); }
      const what = [next.gold ? `${next.gold} GOLD` : null, ...Object.entries(next.potions || {}).map(([k, n]) => `${n} ${CRAFT.consumables[k].name}`), ...Object.entries(next.mats || {}).map(([k, n]) => `${n} ${CRAFT.materials[k].name}`)].filter(Boolean).join(', ');
      audio.sfx('chest');
      this.events.emit('dialogue', [
        { ...K, text: `GOLDEN FLIES! ${st.flies.length} OF THEM! OH, MY ROYAL TONGUE IS TINGLING.` },
        { ...K, text: next.blessing ? 'ALL TEN! I GRANT YOU THE BLESSING OF THE FROG KING: YOUR PARTY IS HARDIER, FOREVER. ALSO, 300 GOLD.' : `A KING REWARDS LOYALTY. TAKE THIS: ${what}.` },
      ], () => this.autosave('frog'));
      this.events.emit('party');
      return;
    }
    if (st.flies.length > 0 && next) {
      this.events.emit('dialogue', [{ ...K, text: `YOU HAVE ${st.flies.length} GOLDEN FLIES. BRING ME ${next.n} AND I SHALL REWARD YOU. THEY HIDE IN THE STRANGEST PLACES...` }]);
      return;
    }
    const lines = this.flags.wardBroken
      ? [
        { ...K, text: 'YOU DID IT! LOOK AT THOSE COLOURS! I HAD FORGOTTEN WHAT GREEN LOOKED LIKE. ...OTHER THAN ME.' },
        { ...K, text: 'FOUR MORE WARD STONES HOLD THE NINTH TOWER. BRING THEM DOWN, AND MALGRIM WITH THEM.' },
        { ...K, text: 'ALSO, IF YOU SEE ANY FLIES... NO. NO. A KING HAS STANDARDS.' },
      ]
      : [
        { ...K, text: 'AH, HEROES! FORGIVE THE... GREEN. MALGRIM HAS MADE A FROG OF YOUR KING.' },
        { ...K, text: 'A WARD STONE BURNS TO THE EAST. ITS BARRIER DRAWS ON A GUARDIAN BENEATH THE OLD KEEP - STAIRS IN THE RUINS. DEFEAT IT, SMASH THE STONE, AND THE VALE WILL BLOOM AGAIN!' },
        { ...K, text: 'YOU WILL WANT FRIENDS FOR THAT. AND BETTER ARMOUR. AND IF YOU FIND ANY FLIES... NO. FORGET I SAID THAT.' },
      ];
    this.events.emit('dialogue', lines);
  }

  onWardDestroyed(unit) {
    const w = this.wards.find((k) => k.unit === unit) || this.wards[0];
    const def = w.def;
    // a freed outer region keeps the band it had (C1)
    const region = W.regions.find((r) => r.outer === def.region);
    if (region) this.flags[`band_${def.region}`] = regionBand(this.state, region);
    this.flags[def.flag] = true;
    if (def.id === 'vale') this.flags.smithRank = Math.max(this.flags.smithRank || 0, 1); // the Blacksmith returns (C9)
    const down = this.wards.filter((k) => this.flags[k.def.flag]).length;
    if (down >= 2) this.flags.enchanter = true; // two stones: the Enchanter comes home
    if (down >= 3) this.flags.smithRank = Math.max(this.flags.smithRank || 0, 2);
    this.hitStop(0.3);
    this.cameras.main.flash(250, 240, 200, 255);
    this.shake(500, 0.012);
    audio.sfx('shatter');
    unit.sprite.stop();
    unit.sprite.setTexture('wardRubble').clearTint();
    this.fx.burst('curse', unit.x, unit.y - 20, 40);
    for (const h of this.party) if (h.command?.target === unit) h.command = null;
    this.time.delayedCall(700, () => {
      audio.sfx('curseLift');
      music.setVariant('freed', 1.6);
      w.bloomR = 0;
      this.events.emit('banner', 'WARD STONE DESTROYED', def.lifts);
    });
    this.time.delayedCall(4200, () => this.bark(this.leader, BARKS.ward[this.leader.def.id]));
    this.autosave('ward');
  }

  updateBloom(dt) { for (const w of this.wards) this.bloomWard(w, dt); }

  bloomWard(w, dt) {
    if (w.bloomR < 0 || !w.canvas) { if (w.bloomR >= 0 && !w.canvas) w.bloomR = -1; return; }
    w.bloomR += dt * 190;
    const ctx = w.canvas.getContext('2d');
    const { x: rx, y: ry } = w.region;
    const cx = w.C.x - rx, cy = w.C.y - ry;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, w.bloomR - 10), 0, Math.PI * 2); ctx.fill();
    const band = 10, r0 = w.bloomR - band, r1 = w.bloomR;
    const steps = Math.ceil(r1 * Math.PI * 2);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      for (let r = Math.max(0, r0); r < r1; r++) {
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (bayer(x, y) < (r1 - r) / band) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    w.tex.refresh();
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2;
      this.fx.burst('bloom', w.C.x + Math.cos(a) * w.bloomR, w.C.y + Math.sin(a) * w.bloomR, 1);
    }
    for (const objs of this.chunkObjs.values()) for (const img of objs) {
      if (img.cleansed || !img.tintTopLeft || img.tintTopLeft === 0xffffff) continue;
      if (Math.hypot(img.x - w.C.x, img.y - w.C.y) < w.bloomR) { img.cleansed = true; img.clearTint(); }
    }
    for (const e of this.enemies) {
      if (e.alive && e.cursed && Math.hypot(e.x - w.C.x, e.y - w.C.y) < w.bloomR) {
        e.alive = false; e.clearZone(); this.fx.burst('bloom', e.x, e.y - 6, 14); this.fx.dust(e.x, e.y); e.destroy();
      }
    }
    if (w.bloomR > w.C.R + 80) { w.bloomR = -1; w.img.setVisible(false); }
  }


  // Walk-on doorways (plus visible markers once the cave art is loaded).
  updateWarps() {
    const L = this.leader;
    for (const o of this.interactables) {
      if (o.kind !== 'warp') continue;
      if (w_locked(this, o)) continue;
      if (!o.marker && o.needsLight && loaded.has('cave')) {
        o.marker = this.add.image(o.x, o.y + 10, 'lightShaft').setOrigin(0.5, 1).setDepth(o.y - 20).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
        this.tweens.add({ targets: o.marker, alpha: 0.45, duration: 1200, yoyo: true, repeat: -1 });
        o.label = this.add.bitmapText(o.x, o.y - 34, 'fontGold', 'EXIT').setOrigin(0.5).setDepth(TOP);
        this.tweens.add({ targets: o.label, y: o.y - 37, duration: 500, yoyo: true, repeat: -1 });
      }
      const d = Math.hypot(L.x - o.x, L.y - o.y);
      if (d > 30) o.armed = true;
      else if (d < 12 && o.armed) { o.armed = false; this.tryWarp(o.warp); return; }
    }
  }

  // Lieutenant arenas: the boss wakes once the party is inside, bars close behind.
  bossDefs() {
    return [
      { id: 'golem', flag: 'golemDefeated', cfg: W.boss, rect: [274, 4, 302, 15], gate: [288, 16], make: (x, y, o) => new Golem(this, x, y - 24, o) },
      { id: 'murk', flag: 'murkDefeated', cfg: W.murk, rect: [270, 65, 304, 77], gate: [287, 78], make: (x, y, o) => new Murk(this, x, y, o) },
    ];
  }

  updateBoss() {
    if (this.golem) return;
    const L = this.leader;
    for (const B of this.bossDefs()) {
      if (this.flags[B.flag]) continue;
      const [x0, y0, x1, y1] = B.rect;
      const inArena = (h) => h.x > x0 * TILE && h.x < (x1 + 1) * TILE && h.y < (y1 + 1) * TILE && h.y > y0 * TILE;
      if (!inArena(L)) continue;
      for (const h of this.party) if (!inArena(h) && !h.downed) { h.x = L.x + (Math.random() - 0.5) * 16; h.y = L.y - 6; }
      const ax = B.cfg.arena[0] * TILE + 8, ay = B.cfg.arena[1] * TILE + 8;
      const g = B.make(ax, ay, { level: this.enemyLevel(ax, ay) + 1 });
      g.bossName = B.cfg.name; g.bossDef = B;
      this.golem = g; // the active lieutenant (name kept from the demo)
      this.enemies.push(g);
      audio.sfx('roar');
      this.shake(600, 0.01);
      g.sprite.setAlpha(0).setY(g.y - 30);
      this.tweens.add({ targets: g.sprite, alpha: 1, duration: 400 });
      this.fx.burst('curse', g.x, g.y - 20, 40);
      this.time.delayedCall(500, () => g.alive && g.aggroOn(L));
      this.events.emit('banner', B.cfg.name, B.cfg.sub);
      this.events.emit('boss', g);
      this.sealArena(true, B.gate);
      return;
    }
  }

  // Bars drop across the arena's entrance during the boss fight.
  sealArena(on, gate) {
    if (gate) this.arenaGatePos = gate;
    const [gx, gy] = this.arenaGatePos || [288, 16];
    if (on && !this.arenaGate) {
      this.arenaGate = this.add.graphics().setDepth(gy * TILE + 20);
      for (let i = 0; i < 4; i++) this.arenaGate.fillStyle(0x1a1423).fillRect((gx - 1) * TILE + 6 + i * 11, gy * TILE - 6, 4, 26).fillStyle(0x6e6a87).fillRect((gx - 1) * TILE + 7 + i * 11, gy * TILE - 6, 2, 26);
      for (let x = gx - 1; x <= gx + 1; x++) this.nav.block(x, gy);
      audio.sfx('doorClose');
    } else if (!on && this.arenaGate) {
      this.arenaGate.destroy(); this.arenaGate = null;
      for (let x = gx - 1; x <= gx + 1; x++) this.nav.unblock?.(x, gy);
      audio.sfx('doorOpen');
    }
  }


  // ============================================================== update
  update(time, deltaMs) {
    this.frameMs.push(deltaMs);
    if (this.frameMs.length > 60) this.frameMs.shift();
    const sp = this.speed;
    this.anims.globalTimeScale = sp;
    this.tweens.timeScale = sp;
    this.time.timeScale = sp;
    this.fx.setTimeScale(sp);
    const dt = Math.min(0.05, deltaMs / 1000) * sp;
    const L = this.leader;
    const view = this.cameras.main.worldView;
    this.streamer.update(L.x, L.y, view.width || this.scale.width, view.height || this.scale.height);
    this.state.playTime += deltaMs / 1000;

    // lazy biome assets: start loading before the party gets there
    const ty = L.y / TILE, tx = L.x / TILE;
    const area = areaAt(Math.floor(tx), Math.floor(ty));
    if (area !== this.area && area !== 'void') this.enterArea(area);
    if (this.loading) { for (const h of this.party) h.sync(dt); return; } // prepareAt is running
    for (const g of this.groupsNear(tx, ty, area)) loadGroup(this, g);
    this.calmT = Math.max(0, (this.calmT || 0) - dt);

    // region banner
    const region = biomeAt(Math.floor(tx), Math.floor(ty));
    if (region !== this.region) {
      if (this.region !== null) { const r = W.regions.find((x) => x.id === region); this.events.emit('banner', r.name, r.sub); }
      else { const r = W.regions.find((x) => x.id === region); this.time.delayedCall(600, () => this.events.emit('banner', r.name, r.sub)); }
      this.region = region;
    }

    this.swapCd = Math.max(0, this.swapCd - dt);
    this.updateDarkness();
    this.revealT = (this.revealT || 0) - deltaMs / 1000;
    if (this.revealT <= 0) {
      this.revealT = 0.25;
      this.minimap.reveal(Math.floor(tx), Math.floor(ty), region === 'cave' ? 6 : 10);
      this.minimap.flush();
    }

    if (this.hitStopT > 0) {
      this.hitStopT -= deltaMs / 1000;
      if (!this.anims.paused) this.anims.pauseAll();
      return;
    }
    if (this.anims.paused) this.anims.resumeAll();
    if (this.busy) { for (const h of this.party) h.sync(dt); return; }

    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    L.direct = this.ui?.dialogOpen ? null : { x: dx, y: dy };
    if ((dx || dy) && L.action?.type === 'harvest') this.cancelHarvest(L);
    const hv = this.party.find((h) => h.action?.type === 'harvest');
    this.harvestBar ??= this.add.graphics().setDepth(TOP + 4);
    this.harvestBar.clear();
    if (hv) {
      const f = Math.min(1, hv.action.t / hv.action.dur), x = Math.round(hv.x) - 12, y = Math.round(hv.y) - 34;
      this.harvestBar.fillStyle(0x1a1423).fillRect(x - 1, y - 1, 26, 5).fillStyle(0x2b2140).fillRect(x, y, 24, 3).fillStyle(0x6fd3a0).fillRect(x, y, Math.round(24 * f), 3);
    }

    for (const h of this.party) { if (h.zipping) h.sync(dt); else h.update(dt); this.gearFx.update(h, dt); }
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    for (const u of this.wardUnits()) u.update(dt);
    this.updateProjectiles(dt);
    this.updateEnemyShots(dt);
    this.updateNodesAndNpcs(dt);
    for (const b of this.breakables) b.update(dt);
    this.updateShockwaves(dt);
    this.updateBloom(dt);
    this.updateLoot(dt);
    this.updateBoss();
    this.updateWarps();
    this.quests.update(dt);
    this.groupT = (this.groupT || 0) - dt;
    if (this.groupT <= 0) { this.groupT = 0.4; this.updateGroups(0.4); }

    if (this.barkObj && this.barkObj.follow) this.barkObj.setPosition(Math.round(this.barkObj.follow.x), Math.round(this.barkObj.follow.y) - 30);

    this.moteT -= dt;
    const mw = this.wards.find((w) => !this.flags[w.def.flag] && Math.hypot(L.x - w.C.x, L.y - w.C.y) < 500);
    if (mw && this.moteT <= 0) {
      this.moteT = 0.08;
      const a = Math.random() * Math.PI * 2, r = Math.random() * mw.C.R * 0.8;
      this.fx.burst('motes', mw.C.x + Math.cos(a) * r, mw.C.y + Math.sin(a) * r * 0.8, 1);
    }

    const inZone = this.inCurse(L.x, L.y, 30);
    music.setVariant(inZone ? 'cursed' : 'freed');
    if (inZone && !this.flags.enteredCurse) {
      this.flags.enteredCurse = true;
      const pip = this.party.find((p) => p.def.id === 'pip') || L;
      this.bark(pip, BARKS.curse[pip.def.id]);
    }
    const fighting = this.golem || this.enemies.some((e) => e.alive && e.engaged && dist(e, L) < 220);
    if (fighting) this.combatHold = 2.5; else this.combatHold -= dt;
    if (this.combatHold <= 0) for (const h of this.party) h.lastStandUsed = false;
    music.setCombat(this.combatHold > 0);

    for (const b of this.breakables) {
      if (b.hinted || Math.hypot(L.x - b.x, L.y - b.y) > 70) continue;
      b.hinted = true;
      this.bark(L, b.def.kind === 'boulder' ? 'THAT BOULDER LOOKS CRACKED...' : 'THIS WALL SOUNDS HOLLOW.');
    }
    // recruit guarded by enemies calls for help when the party is near
    for (const n of this.recruitNPCs) {
      if (n.called || !n.r.guardedBy || n.o.hidden) continue;
      if (Math.hypot(L.x - n.sprite.x, L.y - n.sprite.y) < 140) { n.called = true; this.bark({ x: n.sprite.x, y: n.sprite.y, def: { voice: heroInfo(n.id).voice } }, BARKS.help[n.id] || 'HELP!'); }
    }
  }

  debugInfo() {
    const s = this.streamer.stats;
    const fps = this.frameMs.length ? Math.round(1000 / (this.frameMs.reduce((a, b) => a + b, 0) / this.frameMs.length)) : 0;
    const texMB = (this.streamer.textureBytes() / 1048576).toFixed(1);
    const sprites = this.children.list.length;
    return [
      `FPS ${fps}   SPEED ${this.speed.toFixed(2)}X`,
      `CHUNKS ${this.streamer.resident.size}/${this.streamer.cols * this.streamer.rows}  PENDING ${this.streamer.pending.size}`,
      `PAINT ${s.worker ? 'WORKER' : 'MAIN'} AVG ${s.avgMs.toFixed(0)}MS MAX ${s.maxMs.toFixed(0)}MS`,
      `PAINTED ${s.painted} EVICTED ${s.evicted}  TERRAIN ${texMB}MB`,
      `OBJECTS ${sprites}  ENEMIES ${this.enemies.length}  PROPS ${[...this.chunkObjs.values()].reduce((a, o) => a + o.length, 0)}`,
      `ASSETS ${[...loaded].join(',').toUpperCase()}`,
      `${assetStats.log.slice(-2).join('  ').toUpperCase()}`,
      `TILE ${Math.floor(this.leader.x / TILE)},${Math.floor(this.leader.y / TILE)}  ${this.region?.toUpperCase()}`,
      this.pacingLine(),
    ];
  }

  // Pacing telemetry for tuning the XP curve: time on this level, how long
  // the last level took, kills per minute over the whole save.
  pacingLine() {
    const st = this.state, ups = st.stats.levelUps, L = this.leader;
    const last = ups[ups.length - 1], prev = ups[ups.length - 2];
    const since = (st.playTime - (last?.t || 0)) / 60;
    const took = last ? (last.t - (prev?.t || 0)) / 60 : null;
    const kpm = st.stats.kills / Math.max(1, st.playTime / 60);
    return `PACE LV${L.level} ${Math.round((L.hs.xp / xpToNext(L.level)) * 100)}%  ON LV ${since.toFixed(1)}M  LAST ${took === null ? '-' : took.toFixed(1) + 'M'}  KILLS/MIN ${kpm.toFixed(1)}`;
  }
}
