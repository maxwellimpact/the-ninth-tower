// Armour gem benchmark (dev only). From the title screen, after a reload:
//   const G = await import('/tools/gem-bench.js'); G.start();   // then poll window.__gems
// Boots the fight bench's map and party (tools/evade-bench.js does the same),
// then fights each element's foes several times over, the same seeds each
// time, with the party wearing different armour gems:
//   none   no gems
//   half   a Clear gem of the fight's element in each hero's head and body (20% resist)
//   match  a Royal gem of the fight's element in head and body (40% resist)
//   wrong  Royal gems of another element (should change nothing)
// and two more on plain goblins:
//   storm  Royal storm in head and body: Static jolts melee attackers
//   sun    Royal sun in each weapon (light hits heal), with and without Royal
//          sun in head and body (Radiance: heals received +40%)
// Whole fights drift apart run to run (one dodge changes everything after it),
// so read damage per hit (tookPerHit) for the resist, and checks() for the
// exact numbers: it hits and heals heroes directly and compares.
// Reports per fight: damage the party took (per second and per hit), how long
// it spent burning, chilled or slowed, and poisoned (hero-seconds per minute),
// the party's damage out, when the foes fell, and HP healed.
import { runScenario } from './fight-bench.js';

const FIGHTS = {
  fire: { room: 'hall', units: ['imp', 'imp', 'imp', 'slug', 'slug', 'warlock', 'warlock'], school: 'fire', wrong: 'rime' },
  frost: { room: 'hall', units: ['frostwolf', 'frostwolf', 'frostwolf', 'icewraith', 'icewraith', 'warlock'], school: 'frost', wrong: 'ember' },
  venom: { room: 'hall', units: ['spider', 'spider', 'spider', 'witchling', 'witchling', 'warlock'], school: 'venom', wrong: 'gloam' },
  shadow: { room: 'hall', units: ['banshee', 'banshee', 'banshee', 'warlock', 'warlock', 'warlock'], school: 'shadow', wrong: 'venom' },
  goblins: { room: 'hall', units: Array(6).fill('goblin') },
};
const GEM_OF = { fire: 'ember', frost: 'rime', venom: 'venom', shadow: 'gloam' };
const RUNS = [
  ...['fire', 'frost', 'venom', 'shadow'].flatMap((f) => ['none', 'half', 'match', 'wrong'].map((g) => [f, g])),
  ['goblins', 'none'], ['goblins', 'storm'], ['goblins', 'sunWeapon'], ['goblins', 'sunBoth'],
];

const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

// put gems straight into the party's sockets (a test: every piece takes them)
function dress(sc, fight, loadout) {
  const F = FIGHTS[fight], st = sc.state;
  for (const h of sc.party) {
    const eq = h.hs.equip;
    for (const slot of ['head', 'body', 'weapon']) if (eq[slot]) delete st.sockets[eq[slot]];
    const armour = (gem) => { for (const slot of ['head', 'body']) if (eq[slot]) st.sockets[eq[slot]] = [gem]; };
    if (loadout === 'half') armour(`${GEM_OF[F.school]}2`);
    if (loadout === 'match') armour(`${GEM_OF[F.school]}4`);
    if (loadout === 'wrong') armour(`${F.wrong}4`);
    if (loadout === 'storm') armour('storm4');
    if (loadout === 'sunWeapon' || loadout === 'sunBoth') st.sockets[eq.weapon] = ['sun4'];
    if (loadout === 'sunBoth') armour('sun4');
    h.refreshStats();
  }
}

async function runOne(sc, fight, loadout, seeds, secs) {
  const F = FIGHTS[fight];
  dress(sc, fight, loadout);
  // warlocks cast the fight's school, wherever the bench map is stamped
  const spawn = sc.spawnEnemy;
  sc.spawnEnemy = function (...a) { const e = spawn.apply(this, a); if (e.kind === 'warlock' && F.school) e.atkEl = F.school; return e; };
  // statuses, sampled every frame; heals, by the HP they gave back
  const m = { frames: 0, burn: 0, slow: 0, poison: 0, healed: 0 };
  const sample = () => { m.frames++; for (const h of sc.party) { if (h.burn) m.burn++; if (h.poison) m.poison++; if (h.buffs?.slow) m.slow++; } };
  sc.events.on('postupdate', sample);
  const heals = sc.party.map((h) => { const o = h.heal; h.heal = function (amt) { const b = this.hp; o.call(this, amt); m.healed += Math.max(0, this.hp - b); }; return () => { h.heal = o; }; });
  const runs = [];
  try {
    // the same seeds for every loadout: a fight's id seeds its randomness
    for (let k = 0; k < seeds; k++) {
      for (const h of sc.party) { h.burn = null; h.poison = null; } // nothing carried over from the last fight
      runs.push(await runScenario(sc, { id: k ? `${fight}#${k}` : fight, room: F.room, units: F.units }, secs));
    }
  } finally {
    sc.spawnEnemy = spawn;
    sc.events.off('postupdate', sample);
    heals.forEach((f) => f());
  }
  const avg = (key) => +(runs.map((r) => r[key] ?? secs).reduce((a, v) => a + v, 0) / runs.length).toFixed(1);
  const perMin = (n) => +((n / 60) / Math.max(0.01, m.frames / 3600)).toFixed(1); // hero-seconds per minute of fighting
  return { fight, loadout, tookPerSec: avg('partyDmgPerSec'), hitsPerSec: avg('hitsOnPartyPerSec'), tookPerHit: +(avg('partyDmgPerSec') / Math.max(0.01, avg('hitsOnPartyPerSec'))).toFixed(1), dpsOut: avg('partyDpsOut'), clearedAt: avg('clearedAt'), burnSecsPerMin: perMin(m.burn), slowSecsPerMin: perMin(m.slow), poisonSecsPerMin: perMin(m.poison), healedPerMin: perMin(m.healed * 60) };
}

export async function bench(secs = 20, seeds = 2, only = null) {
  const sc = window.__scene, out = [];
  for (const [fight, loadout] of RUNS) if (!only || only.includes(fight)) out.push(await runOne(sc, fight, loadout, seeds, secs));
  dress(sc, 'goblins', 'none');
  for (const e of sc.enemies) if (e.alive) { e.alive = false; e.destroy(); }
  return out;
}

// Exact checks, no fighting: hit, burn, chill and heal a hero with and without
// gems, and have a goblin strike a hero wearing storm. Returns { pass, ... }.
export async function checks() {
  const sc = window.__scene, h = sc.party[0], st = sc.state, eq = h.hs.equip;
  const { chillHero } = await import('/src/game/units.js');
  const foe = (k, el) => { const e = sc.spawnEnemy(k, h.x + 300, h.y, false); e.atkEl = el; return e; };
  const imp = foe('imp', 'fire'), gob = foe('goblin', null);
  const wear = (gems) => { for (const k of ['head', 'body', 'trinket1', 'trinket2']) if (eq[k]) delete st.sockets[eq[k]]; gems.forEach((g, i) => { const k = ['head', 'body', 'trinket1', 'trinket2'][i]; if (eq[k] && g) st.sockets[eq[k]] = [g]; }); h.refreshStats(); };
  const hit = (src, n = 1000) => { h.invuln = 0; h.shield = 0; h.riposteT = 0; h.hp = h.maxHp = 1e6; return h.damage(n, src); };
  const out = {};
  wear([]); const base = hit(imp), baseGob = hit(gob);
  wear(['ember4', 'ember4']);
  out.royalPairCutsFire = +(hit(imp) / base).toFixed(2); // expect 0.6
  out.fireGemsLeaveGoblins = +(hit(gob) / baseGob).toFixed(2); // expect 1
  h.burn = null; h.purifyT = 0; h.addBurn(10, 3); out.burnSecs = +(h.burn?.t ?? 0).toFixed(2); // expect 1.8
  wear(['rime4', 'rime4']);
  out.wrongGemOnFire = +(hit(imp) / base).toFixed(2); // expect 1
  h.buffs = {}; chillHero(h, 2); out.chillSecs = +(h.buffs.slow?.t ?? 0).toFixed(2); // expect 1.2
  wear([]); st.sockets[eq.head] = ['ember4', 'ember4']; st.sockets[eq.body] = ['ember4', 'ember4']; h.refreshStats(); // four Royals (80%), two to a piece
  out.fourRoyalCapped = +(hit(imp) / base).toFixed(2); // expect 0.5
  wear(['storm4', 'storm4']);
  gob.hp = gob.maxHp = 1e5; h.staticT = 0;
  hit(gob); const jolt = 1e5 - gob.hp; hit(gob); const second = 1e5 - gob.hp - jolt;
  out.staticJolt = jolt; out.staticJoltExpect = Math.round(h.stats.atk * 0.8); out.staticWaits = second === 0;
  wear(['sun4', 'sun4']);
  h.maxHp = 1e6; h.hp = 1; h.heal(100); out.radianceHeal = h.hp - 1; // expect 140
  wear([]); h.hp = 1; h.heal(100); out.plainHeal = h.hp - 1; // expect 100
  for (const e of [imp, gob]) { e.alive = false; e.destroy(); }
  h.maxHp = h.stats.maxHp; h.hp = h.maxHp; h.buffs = {}; h.burn = null;
  out.pass = out.royalPairCutsFire === 0.6 && out.fireGemsLeaveGoblins === 1 && out.wrongGemOnFire === 1 && out.burnSecs === 1.8 && out.chillSecs === 1.2 && out.fourRoyalCapped === 0.5 && out.staticJolt > 0 && out.staticWaits && out.radianceHeal === 140 && out.plainHeal === 100;
  return out;
}

// From the title screen: the bench map with the bench party, levels frozen,
// the game's own loop asleep while the bench steps it.
export async function start(secs = 20, seeds = 2, only = null) {
  const g = window.__game;
  g.loop.sleep();
  let s = 12345;
  const real = Math.random;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  g.scene.getScene('Title').enterBench();
  const ready = () => window.__scene?.state?.map === 'bench' && !window.__scene.busy && !window.__scene.loading;
  for (let i = 0; i < 600 && !ready(); i++) await step(5);
  Math.random = real;
  const sc = window.__scene;
  for (const h of sc.party) h.gainXp = () => {};
  window.__gems = null; window.__gemsErr = null;
  window.__gemChecks = await checks();
  bench(secs, seeds, only).then((r) => { window.__gems = r; g.loop.wake(); }).catch((e) => { window.__gemsErr = String(e?.stack || e); g.loop.wake(); });
  return { party: sc.party.map((h) => `${h.def.id}:${h.level}`), slots: sc.party.map((h) => ['head', 'body', 'weapon'].filter((k) => h.hs.equip[k]).join('+')) };
}
