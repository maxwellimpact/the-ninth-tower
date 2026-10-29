// The Proving Field (src/data/maps/battlefield.json): a small test map for
// fighting any foe on its own. The muster board by the path lists them by
// where they're met; pick one and it appears out on the field at the party's
// level and comes for you. Ordinary foes add to the field (pick one again for
// a pack); a boss clears it first and rises with its own entrance, title and
// arena (the field), as at a Ward Stone. The board also sets the party's
// level (regearing them at that tier) and clears the field. Never saves: the
// map's save is `none`, and the boss flags it sets are its own (field_<kind>).
import Phaser from 'phaser';
import enemies from '../data/enemies.json';
import tuning from '../data/tuning.json';
import { Golem, Murk, Huntsman, Vulk, Isolde, Malgrim } from './units.js';
import { makeItem, tierForLevel } from './itemgen.js';

const TILE = 16;
// the board's lists: [heading, kinds]
export const GROUPS = [
  ['BOSSES', ['golem', 'murk', 'huntsman', 'vulk', 'isolde', 'malgrim']],
  ['NAMED FOES', ['snagtooth', 'pitchamp', 'snapjaw', 'mab', 'drake', 'troll']],
  ['THE VALE', ['hexling', 'goblin', 'archer', 'knight', 'mire', 'rats', 'hollow', 'boar', 'crab', 'wisp', 'warlock']],
  ['MISTFEN', ['drowned', 'witchling', 'leeches', 'lurker', 'croaker']],
  ['GLOAMWOOD', ['shade', 'rootling', 'spider', 'spiderling', 'hound', 'banshee']],
  ['CINDERREACH', ['imp', 'slug', 'salamander', 'brute', 'beetle']],
  ['FROSTHELM', ['frostwolf', 'rimehorn', 'icewraith', 'sentinel', 'raider']],
  ['THE TOWER', ['voidling', 'gargoyle', 'chainwarden', 'huntecho']],
];
// the bosses that fight as they do at their Ward Stones or in their dungeons: their class and how they rise
const BOSSES = { golem: [Golem, 'stone'], murk: [Murk, 'pool'], huntsman: [Huntsman, 'fog'], vulk: [Vulk, 'magma'], isolde: [Isolde, 'frost'], malgrim: [Malgrim, 'stone'] };
const LEVELS = [5, 10, 15, 20, 25, 30, tuning.levelCap];

export class Battlefield {
  constructor(sc, cfg, at) {
    this.sc = sc;
    this.spot = [cfg.spot[0] + at[0], cfg.spot[1] + at[1]];
    const [x0, y0, x1, y1] = cfg.arena;
    this.arena = { x0: x0 + at[0], y0: y0 + at[1], x1: x1 + at[0], y1: y1 + at[1] };
  }

  get level() { return this.sc.leader.hs.level; }

  // the board: where they're met, then the party's level and a clean field
  menu() {
    const ui = this.sc.ui;
    if (this.sc.busy) return; // not while a boss is rising (its entrance runs on timers that expect it there)
    ui.pickPlace('THE MUSTER BOARD', [...GROUPS.map(([g]) => g), `PARTY LEVEL ${this.level}`, 'CLEAR THE FIELD'], (i) => {
      if (i < GROUPS.length) this.group(i);
      else if (i === GROUPS.length) this.levels();
      else this.clear(true);
    });
  }

  group(i) {
    const [title, kinds] = GROUPS[i];
    this.sc.ui.pickPlace(title, kinds.map((k) => enemies[k].name), (j) => this.spawn(kinds[j]), ['BACK', () => this.menu()]);
  }

  levels() {
    this.sc.ui.pickPlace('PARTY LEVEL', LEVELS.map((l) => `LEVEL ${l}${l === this.level ? ' (NOW)' : ''}`), (i) => this.setLevel(LEVELS[i]), ['BACK', () => this.menu()]);
  }

  // every hero at that level, with fine gear of its tier and the skill points
  // a hero would have by then; healed, and the downed back on their feet
  setLevel(lv) {
    const sc = this.sc;
    for (const h of sc.party) {
      const hs = h.hs;
      hs.sp = Math.max(0, (hs.sp || 0) + (lv - hs.level)); hs.level = lv; hs.xp = 0;
      for (const slot of ['weapon', 'body', 'head', 'offhand']) { const id = makeItem(h.def.id, slot, tierForLevel(lv), 'fine'); if (id) hs.equip[slot] = id; }
      h.refreshGear();
    }
    this.heal();
    sc.events.emit('party');
    sc.events.emit('banner', `THE PARTY IS LEVEL ${lv}`, 'GEARED AT ITS TIER');
  }

  heal() {
    for (const h of this.sc.party) { if (h.downed) h.revive?.(1); h.hp = h.maxHp; }
  }

  // everything on the field gone (and the boss bar with it)
  clear(say = false) {
    const sc = this.sc, g = sc.golem;
    if (g?.alive) { g.bossDef.sentAway = true; g.die(null); } // its own clean-up (vents, plates, summons), with no prize (Game.onBossKilled)
    for (const e of sc.enemies) if (e.alive) { e.alive = false; e.clearZone(); e.destroy(); }
    sc.enemies = sc.enemies.filter((e) => e.alive);
    sc.namedBar = null; sc.events.emit('boss', null);
    sc.clearProjectiles?.();
    if (say) sc.events.emit('banner', 'THE FIELD IS CLEAR', 'PICK A FOE AT THE BOARD');
  }

  spawn(kind) {
    const sc = this.sc, [tx, ty] = this.spot;
    this.heal();
    if (BOSSES[kind] || sc.golem) this.clear(); // one boss at a time, alone on the field
    const lv = this.level;
    if (BOSSES[kind]) {
      const [Cls, style] = BOSSES[kind], name = enemies[kind].name;
      const boss = new Cls(sc, tx * TILE + 8, ty * TILE + 8, { level: lv + 2, arena: this.arena });
      boss.bossName = name;
      boss.bossDef = { id: 'battlefield', flag: `field_${kind}`, cfg: { name, fall: [`${name} FALLS`, 'PICK ANOTHER AT THE BOARD'] } };
      sc.golem = boss;
      sc.enemies.push(boss);
      sc.bossIntro(boss, style, boss.bossDef);
      return;
    }
    const o = sc.nav.nearestOpen(tx + Phaser.Math.Between(-2, 2), ty + Phaser.Math.Between(-2, 2), 4) || [tx, ty];
    const e = sc.spawnEnemy(kind, o[0] * TILE + 8, o[1] * TILE + 8, true, false, lv);
    e.noLeash = true; e.hunt = true; // fought to the end, wherever on the field
    e.aggroOn(sc.nearestHero(e, Infinity) || sc.leader, false);
  }
}
