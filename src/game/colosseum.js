// The Colosseum (src/data/maps/colosseum.json): a shared map of the main game,
// where foes pour through the gates wave after wave until the party falls.
// Its foes climb a ladder of their own: wave N fights at level
// levelStart + (N - 1) * levelPerWave, whatever the party's level, so how far a
// run gets says how strong the party is. Kills give XP, gold and drops as
// anywhere else, and every `prizeEvery` waves the crowd throws a prize. The
// party's gains go to the main save; the best run is the Colosseum's own
// (its world's flags.arenaBest), and a new run starts at half of it.
//   Themed waves: every fifth wave from the eighth (8, 13, 18...) draws from
// one theme - an element's foes (its warlocks casting that school), a swarm
// of small fast ones, or a few brutes - so armour gems and builds get tested.
//   Milestones: the first time a party clears wave 10, 20 and 30 the crowd
// throws a unique charm (the Laurel, the Torc, the Crown); every tenth wave
// past that, the first time, a Royal gem and a Rare.
//   The board of champions (a sign by the gate) keeps the five best runs:
// flags.arenaRuns, kept up to date as each wave falls, so a run that ends by
// walking out counts as much as one that ends on the sand.
import Phaser from 'phaser';
import tuning from '../data/tuning.json';
import { makeItem, tierForLevel } from './itemgen.js';
import items from '../data/items.json';
import heroes from '../data/heroes.json';
import { audio } from '../audio/synth.js';

const TILE = 16;
// who comes through the gates, from the wave they first appear in. Only foes
// that come for you: nothing rooted to one spot or too slow to cross the sand
// (sentinels, rootlings), which would wait at a far gate to be walked to.
export const ROSTER = [
  [1, ['goblin', 'archer', 'hexling', 'boar', 'rats', 'wisp']],
  [4, ['knight', 'warlock', 'crab', 'witchling', 'croaker', 'shade', 'hound', 'spider']],
  [8, ['imp', 'salamander', 'brute', 'beetle', 'frostwolf', 'banshee', 'slug']],
  [12, ['raider', 'icewraith', 'rimehorn', 'gargoyle', 'voidling', 'chainwarden']],
];

// themed waves, in turn: [banner, foes, element their warlocks cast, how many foes x]
export const THEMES = [
  ['A FIRE WAVE', ['imp', 'slug', 'salamander', 'warlock'], 'fire'],
  ['A SWARM', ['rats', 'hound', 'beetle', 'frostwolf', 'spiderling'], null, 1.6],
  ['A FROST WAVE', ['frostwolf', 'icewraith', 'rimehorn', 'warlock'], 'frost'],
  ['THE BRUTES', ['knight', 'brute', 'croaker', 'chainwarden', 'rimehorn'], null, 0.5],
  ['A VENOM WAVE', ['spider', 'witchling', 'slug', 'warlock'], 'venom'],
  ['A SHADOW WAVE', ['banshee', 'shade', 'voidling', 'warlock'], 'shadow'],
];
// the first clear of these waves throws a unique charm (items.json)
export const MILESTONES = { 10: 'laurel_sands', 20: 'gladiator_torc', 30: 'colosseum_crown' };
const GEMS = ['ember', 'rime', 'venom', 'gloam', 'storm', 'sun'];

export class Colosseum {
  constructor(sc, cfg, at) {
    this.sc = sc;
    this.cfg = cfg;
    this.gates = cfg.gates.map(([x, y]) => [x + at[0], y + at[1]]);
    this.wave = 0;
    this.foes = [];
    this.next = null;
    this.watch = sc.time.addEvent({ delay: 400, loop: true, callback: () => this.check() });
  }

  get best() { return this.sc.flags.arenaBest || 0; }
  levelOf(wave) { return Math.min(tuning.levelCap + 5, this.cfg.levelStart + (wave - 1) * this.cfg.levelPerWave); }

  // the wave a new run starts at: half the best run so far, so a strong party
  // doesn't wade through waves it can't feel (wave 1 until there's a best of 4)
  get startWave() { return Math.max(1, Math.floor(this.best / 2)); }
  theme(wave) { return wave >= 8 && wave % 5 === 3 ? THEMES[Math.floor((wave - 8) / 5) % THEMES.length] : null; }

  // a new run
  start(delay = 1800) {
    this.wave = this.startWave - 1;
    this.first = this.startWave;
    this.run = { id: Date.now(), s: this.first, w: 0 };
    this.foes = [];
    this.queue(delay);
  }

  queue(ms) {
    this.next?.remove();
    this.next = this.sc.time.delayedCall(ms, () => this.spawnWave());
  }

  spawnWave() {
    const sc = this.sc;
    this.next = null;
    const n = ++this.wave, lv = this.levelOf(n);
    const pool = ROSTER.filter(([w]) => w <= n), theme = this.theme(n);
    const count = Math.max(2, Math.min(Math.round(this.cfg.maxFoes * (theme?.[3] || 1)), Math.round((2 + Math.ceil(n * 0.6)) * (theme?.[3] || 1))));
    const elites = n % this.cfg.prizeEvery === 0 ? 1 + Math.floor(n / (this.cfg.prizeEvery * 2)) : 0; // every prize wave brings elites, more as the runs go on
    this.foes = [];
    for (let i = 0; i < count; i++) {
      // half from the newest foes on the roster, half from any
      const tier = Math.random() < 0.5 ? pool[pool.length - 1] : pool[Math.floor(Math.random() * pool.length)];
      const kinds = theme ? theme[1] : tier[1], kind = kinds[Math.floor(Math.random() * kinds.length)];
      const [gx, gy] = this.gates[i % this.gates.length];
      const o = sc.nav.nearestOpen(gx + Phaser.Math.Between(-1, 1), gy + Phaser.Math.Between(-1, 1), 4) || [gx, gy];
      const e = sc.spawnEnemy(kind, o[0] * TILE + 8, o[1] * TILE + 8, true, i < elites, lv);
      e.noLeash = true; // fought to the end, as in a sealed dungeon room: nothing wanders back to its gate
      e.hunt = true; // and it comes for the party from the gate, however far across the sand (units.js)
      if (theme?.[2] && e.kind === 'warlock') e.atkEl = theme[2]; // a themed wave's warlocks cast its school
      this.foes.push(e);
    }
    for (const e of this.foes) e.aggroOn(sc.nearestHero(e, Infinity) || sc.leader, false);
    audio.sfx('roar');
    sc.events.emit('banner', `WAVE ${n}`, n === this.first && n > 1 ? `HALF YOUR BEST (${this.best}) - LEVEL ${lv}` : `${theme ? `${theme[0]} - ` : ''}LEVEL ${lv} - ${count} FOES${elites ? ` - ${elites} ELITE` : ''}${n === 1 && this.best ? ` - BEST ${this.best}` : ''}`);
  }

  check() {
    const sc = this.sc;
    if (!this.wave || this.next || sc.busy || !this.foes.length || this.foes.some((e) => e.alive)) return;
    const n = this.wave, record = n > this.best;
    if (record) sc.flags.arenaBest = n;
    if (n % this.cfg.prizeEvery === 0) this.prize(n);
    const milestone = n % 10 === 0 && !(sc.flags.arenaPrizes || []).includes(n) && this.milestone(n);
    this.record(n);
    const next = this.theme(n + 1);
    sc.events.emit('banner', `WAVE ${n} CLEARED`, milestone || (record && n > 1 ? 'A NEW BEST!' : `NEXT: ${next ? `${next[0]} - ` : ''}LEVEL ${this.levelOf(n + 1)}`));
    sc.autosave('wave');
    this.foes = [];
    this.queue(this.cfg.rest * 1000);
  }

  // the crowd throws a prize: gold, and gear at the wave's tier for someone in the party
  prize(n) {
    const sc = this.sc, L = sc.leader;
    const gold = 15 * n;
    sc.state.gold += gold;
    for (let i = 0; i < 8; i++) sc.dropCoin(L.x + Phaser.Math.Between(-20, 20), L.y + Phaser.Math.Between(-14, 14));
    const hero = sc.state.active[Math.floor(Math.random() * sc.state.active.length)];
    const id = makeItem(hero, ['weapon', 'offhand', 'head', 'body'][Math.floor(Math.random() * 4)], tierForLevel(this.levelOf(n)), n >= this.cfg.prizeEvery * 3 ? 'rare' : 'fine');
    if (id) sc.dropLoot(id, L.x, L.y + 10);
    sc.floatText(L.x, L.y - 40, `THE CROWD THROWS ${gold} GOLD!`, 'fontGold');
  }

  // a milestone, the first time it's cleared: a unique charm (waves 10, 20,
  // 30), then a Royal gem and a Rare every tenth wave. Returns the banner line.
  milestone(n) {
    const sc = this.sc, L = sc.leader;
    sc.flags.arenaPrizes = [...(sc.flags.arenaPrizes || []), n];
    const charm = MILESTONES[n];
    if (charm) { sc.dropLoot(charm, L.x, L.y + 14); return `THE CROWD THROWS A ${items[charm].name}!`; }
    const g = `${GEMS[Math.floor(Math.random() * GEMS.length)]}4`;
    sc.state.gems[g] = (sc.state.gems[g] || 0) + 1;
    const hero = sc.state.active[Math.floor(Math.random() * sc.state.active.length)];
    const id = makeItem(hero, ['weapon', 'offhand', 'head', 'body'][Math.floor(Math.random() * 4)], tierForLevel(this.levelOf(n)), 'rare');
    if (id) sc.dropLoot(id, L.x - 12, L.y + 14);
    return 'A ROYAL GEM AND A RARE, FROM THE CROWD!';
  }

  // the board of champions: this run's best wave, kept among the top five
  record(n) {
    const sc = this.sc, R = this.run;
    if (!R || n <= R.w) return;
    R.w = n;
    const runs = (sc.flags.arenaRuns || []).filter((r) => r.id !== R.id);
    const t = new Date(R.id), dd = (v) => String(v).padStart(2, '0'); // the player's own day, not UTC's
    runs.push({ id: R.id, w: n, s: R.s, d: `${t.getFullYear()}-${dd(t.getMonth() + 1)}-${dd(t.getDate())}`, p: sc.party.map((h) => [h.def.id, h.level]) });
    runs.sort((a, b) => b.w - a.w || a.id - b.id);
    sc.flags.arenaRuns = runs.slice(0, 5);
  }
  place() { const i = (this.sc.flags.arenaRuns || []).findIndex((r) => r.id === this.run?.id); return i < 0 ? 0 : i + 1; }

  // what the board shows (UI.showBoard): the runs, then the prizes, won or not
  board() {
    const runs = this.sc.flags.arenaRuns || [], won = this.sc.flags.arenaPrizes || [];
    const name = (id) => (heroes.find((h) => h.id === id)?.name || id).toUpperCase();
    return {
      runs: runs.map((r) => ({ w: r.w, party: r.p.map(([id, lv]) => `${name(id)} ${lv}`).join(' '), day: r.d.slice(5), current: r.id === this.run?.id })),
      prizes: Object.entries(MILESTONES).map(([w, id]) => ({ wave: +w, name: items[id].name, won: won.includes(+w) })),
      more: 'THEN EVERY TENTH WAVE: A ROYAL GEM AND A RARE',
    };
  }

  // The party fell: the run is over. Clear the sand, say how it went, and
  // start a new run once the party is back on its feet (see Game.wipe).
  onWipe() {
    const reached = this.wave;
    this.next?.remove(); this.next = null;
    for (const e of this.sc.enemies) if (e.alive) { e.alive = false; e.clearZone(); e.destroy(); }
    this.foes = [];
    this.wave = 0;
    const place = this.place();
    this.run = null;
    return ['THE CROWD ROARS', `FELL ON WAVE ${reached} - ${place ? `${['', '1ST', '2ND', '3RD', '4TH', '5TH'][place]} ON THE BOARD` : `BEST ${this.best}`}`];
  }

  destroy() { this.watch?.remove(); this.next?.remove(); }
}
