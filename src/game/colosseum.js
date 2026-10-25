// The Colosseum (src/data/maps/colosseum.json): a shared map of the main game,
// where foes pour through the gates wave after wave until the party falls.
// Its foes climb a ladder of their own: wave N fights at level
// levelStart + (N - 1) * levelPerWave, whatever the party's level, so how far a
// run gets says how strong the party is. Kills give XP, gold and drops as
// anywhere else, and every `prizeEvery` waves the crowd throws a prize. The
// party's gains go to the main save; the best run is the Colosseum's own
// (its world's flags.arenaBest), and a new run starts at half of it.
import Phaser from 'phaser';
import tuning from '../data/tuning.json';
import { makeItem, tierForLevel } from './itemgen.js';
import { audio } from '../audio/synth.js';

const TILE = 16;
// who comes through the gates, from the wave they first appear in
const ROSTER = [
  [1, ['goblin', 'archer', 'hexling', 'boar', 'rats', 'wisp']],
  [4, ['knight', 'warlock', 'crab', 'witchling', 'croaker', 'shade', 'hound', 'spider']],
  [8, ['imp', 'salamander', 'brute', 'beetle', 'frostwolf', 'banshee', 'rootling']],
  [12, ['sentinel', 'icewraith', 'rimehorn', 'gargoyle', 'voidling', 'chainwarden']],
];

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

  // a new run
  start(delay = 1800) {
    this.wave = this.startWave - 1;
    this.first = this.startWave;
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
    const pool = ROSTER.filter(([w]) => w <= n);
    const count = Math.min(this.cfg.maxFoes, 2 + Math.ceil(n * 0.6));
    const elites = n % this.cfg.prizeEvery === 0 ? 1 + Math.floor(n / (this.cfg.prizeEvery * 2)) : 0; // every prize wave brings elites, more as the runs go on
    this.foes = [];
    for (let i = 0; i < count; i++) {
      // half from the newest foes on the roster, half from any
      const tier = Math.random() < 0.5 ? pool[pool.length - 1] : pool[Math.floor(Math.random() * pool.length)];
      const kind = tier[1][Math.floor(Math.random() * tier[1].length)];
      const [gx, gy] = this.gates[i % this.gates.length];
      const o = sc.nav.nearestOpen(gx + Phaser.Math.Between(-1, 1), gy + Phaser.Math.Between(-1, 1), 4) || [gx, gy];
      const e = sc.spawnEnemy(kind, o[0] * TILE + 8, o[1] * TILE + 8, true, i < elites, lv);
      e.noLeash = true; // fought to the end, as in a sealed dungeon room: nothing wanders back to its gate
      this.foes.push(e);
    }
    audio.sfx('roar');
    sc.events.emit('banner', `WAVE ${n}`, n === this.first && n > 1 ? `HALF YOUR BEST (${this.best}) - LEVEL ${lv}` : `LEVEL ${lv} - ${count} FOES${elites ? ` - ${elites} ELITE` : ''}${n === 1 && this.best ? ` - BEST ${this.best}` : ''}`);
  }

  check() {
    const sc = this.sc;
    if (!this.wave || this.next || sc.busy || !this.foes.length || this.foes.some((e) => e.alive)) return;
    const n = this.wave, record = n > this.best;
    if (record) sc.flags.arenaBest = n;
    if (n % this.cfg.prizeEvery === 0) this.prize(n);
    sc.events.emit('banner', `WAVE ${n} CLEARED`, record && n > 1 ? 'A NEW BEST!' : `NEXT: LEVEL ${this.levelOf(n + 1)}`);
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

  // The party fell: the run is over. Clear the sand, say how it went, and
  // start a new run once the party is back on its feet (see Game.wipe).
  onWipe() {
    const reached = this.wave;
    this.next?.remove(); this.next = null;
    for (const e of this.sc.enemies) if (e.alive) { e.alive = false; e.clearZone(); e.destroy(); }
    this.foes = [];
    this.wave = 0;
    return ['THE CROWD ROARS', `FELL ON WAVE ${reached} - BEST ${this.best}`];
  }

  destroy() { this.watch?.remove(); this.next?.remove(); }
}
