// Generated gear (DESIGN C4, §16 Q6). Common / Fine / Rare items are built
// from templates (tier x hero family x slot x rarity) instead of authored one
// by one. Fine and Rare drops roll one small bonus stat that fits the item;
// Rares also roll a trait. The roll is encoded in the item id, so a save only
// ever stores strings and items are rebuilt from their ids on load:
//
//   g.<hero>.<slot>.<tier>.<rarity>.<lookIdx>.<bonus|->.<trait|->#<uid>
//   e.g. g.brann.offhand.3.fine.1.def4.-#k2x9   ("STURDY SILVERSTEEL SHIELD")
//
// Generated items are registered into the shared items table, so every
// existing `items[id]` lookup keeps working.
import items from '../data/items.json';
import G from '../data/gear.json';

const STATS = ['atk', 'def', 'hp', 'crit', 'cdr'];
export const TRAITS = G.traits;
export const isGenerated = (id) => typeof id === 'string' && id.startsWith('g.');

export function tierForLevel(level) {
  let t = 1;
  for (const b of G.tierForLevel) if (level > b) t++;
  return t;
}

// budget points -> stat values (1 pt = 1 ATK = 1 DEF = 5 HP = 0.5% crit / cooldown)
const value = (k, pts) => (k === 'crit' || k === 'cdr' ? Math.max(1, Math.round((pts / G.statValue[k]) * 100)) / 100 : Math.max(1, Math.round(pts / G.statValue[k])));
const budgetOf = (tier, slot, rarity) => G.tiers[tier - 1].budget * G.slotWeight[slot] * (G.rarityMul[rarity] || 1);

function family(hero, slot) {
  if (slot === 'trinket') return null;
  return G.families[hero]?.[slot] || null;
}

function parse(id) {
  const [body] = id.split('#');
  const [, hero, slot, tier, rarity, look, bonus, trait] = body.split('.');
  return { hero, slot, tier: +tier, rarity, look, bonus, trait };
}

// Build (or fetch) the item object for a generated id.
export function registerItem(id) {
  if (!isGenerated(id) || items[id]) return items[id];
  const p = parse(id);
  const budget = budgetOf(p.tier, p.slot, p.rarity);
  const stats = {};
  let name, lookId, split;
  if (p.slot === 'trinket') {
    const r = G.rings[p.look];
    split = r.split;
    name = `${G.materials.ring[p.tier - 1]} ${r.name.replace('RING OF ', 'RING OF ')}`;
    lookId = `ring_${p.look}@${p.tier}`;
  } else {
    const f = family(p.hero, p.slot);
    split = f.split;
    name = `${G.materials[f.mat][p.tier - 1]} ${f.name}`;
    lookId = `${f.looks[+p.look] || f.looks[0]}@${p.tier}`;
  }
  for (const [k, w] of Object.entries(split)) stats[k] = value(k, budget * w);
  let bonus = null;
  if (p.bonus && p.bonus !== '-') {
    const k = STATS.find((s) => p.bonus.startsWith(s));
    const n = +p.bonus.slice(k.length);
    const v = k === 'crit' || k === 'cdr' ? n / 100 : n;
    stats[k] = Math.round(((stats[k] || 0) + v) * 100) / 100;
    bonus = { [k]: v };
    name = `${G.bonusPrefix[k]} ${name}`;
  }
  let trait = null, element = null;
  if (p.trait && p.trait !== '-') {
    const [t, el] = p.trait.split(':');
    trait = t;
    if (t === 'edge') element = el;
  }
  const it = { name, hero: p.hero === 'any' ? null : p.hero, slot: p.slot, rarity: p.rarity, tier: p.tier, look: lookId, stats, bonus, trait, element, generated: true, desc: '' };
  if (!element) delete it.element;
  items[id] = it;
  return it;
}

const uid = () => Math.random().toString(36).slice(2, 7);
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

// Roll a new item. slot 'trinket' makes a ring (hero 'any').
export function makeItem(hero, slot, tier, rarity, rand = Math.random) {
  tier = Math.max(1, Math.min(6, tier));
  let look, bonusKeys;
  if (slot === 'trinket') { look = pick(Object.keys(G.rings), rand); bonusKeys = Object.keys(G.rings[look].split); hero = 'any'; }
  else { const f = family(hero, slot); if (!f) return null; look = rarity === 'common' ? 0 : 1; bonusKeys = f.bonus; }
  let bonus = '-';
  if (rarity !== 'common') {
    const k = pick(bonusKeys, rand);
    const pts = budgetOf(tier, slot, rarity) * (0.05 + rand() * 0.1);
    bonus = `${k}${k === 'crit' || k === 'cdr' ? Math.max(1, Math.round((pts / G.statValue[k]) * 100)) : Math.max(1, Math.round(pts / G.statValue[k]))}`;
  }
  let trait = '-';
  if (rarity === 'rare') {
    const pool = Object.keys(G.traits).filter((t) => t !== 'edge' || slot === 'weapon');
    trait = pick(pool, rand);
    if (trait === 'edge') trait = `edge:${pick(G.edgeElements, rand)}`;
  }
  const id = `g.${hero}.${slot}.${tier}.${rarity}.${look}.${bonus}.${trait}#${uid()}`;
  registerItem(id);
  return id;
}

// Every id a save refers to must be registered before anything reads items[].
export function ensureItems(state) {
  const ids = [...state.inventory, ...Object.values(state.heroes).flatMap((h) => Object.values(h.equip))];
  for (const id of ids) if (id) registerItem(id);
}

export function tierOf(id) {
  const it = items[id];
  return it?.tier || { common: 1, fine: 2, rare: 3, unique: 3, legendary: 6 }[it?.rarity] || 1;
}

// Random gear drop from an enemy (C10 economy). Picks a recruited hero.
export function rollGearDrop(state, level, elite, rand = Math.random) {
  const D = G.drops;
  if (!elite && rand() > D.chance) return null;
  const heroes = state.recruited;
  const hero = pick(heroes, rand);
  const slotRoll = rand();
  const slot = slotRoll < 0.08 ? 'trinket' : pick(['weapon', 'offhand', 'head', 'body'], rand);
  let rarity;
  const r = rand();
  if (elite) rarity = r < D.eliteRare ? 'rare' : 'fine';
  else rarity = r < D.rare ? 'rare' : r < D.rare + D.fine ? 'fine' : 'common';
  return makeItem(hero, slot, tierForLevel(level), rarity, rand);
}

// Chest gear (C4: Fine from chests, Rare from dungeon chests): one piece a
// little better than what someone in the party wears now. Every active hero's
// four slots are weighed by how far (as a share) they lag this level's Fine piece; one of
// the three that lag most is picked, then the smallest step up that beats what
// is worn there by at least 3% (Fine, then Rare, then the same a tier higher).
// A dungeon chest starts from Rare. Luck on top: 15% one step better, 4% a Rare
// from the tier above. If nobody can be upgraded (all uniques), a Fine piece.
const CHEST_LUCK = { step: 0.15, jackpot: 0.04 };
export function rollChestGear(state, { dungeon = false } = {}, rand = Math.random) {
  const probe = (hero, slot, tier, rarity) => { const it = registerItem(`g.${hero}.${slot}.${tier}.${rarity}.1.-.-#probe`); return it ? statScore(it) : 0; };
  const worn = (hero, slot) => { const id = state.heroes[hero]?.equip?.[slot]; const it = id && (items[id] || registerItem(id)); return it ? statScore(it) : 0; };
  const options = [];
  for (const hero of state.active || state.recruited) {
    const t = tierForLevel(state.heroes[hero]?.level || 1);
    for (const slot of ['weapon', 'offhand', 'head', 'body']) {
      if (!family(hero, slot)) continue;
      const now = worn(hero, slot);
      const ladder = [[t, 'fine'], [t, 'rare'], [t + 1, 'fine'], [t + 1, 'rare']].filter(([tt]) => tt <= 6).slice(dungeon ? 1 : 0);
      const rung = ladder.findIndex(([tt, r]) => probe(hero, slot, tt, r) >= now * 1.03 + 0.5);
      if (rung >= 0) options.push({ hero, slot, ladder, rung, lag: 1 - now / Math.max(1, probe(hero, slot, t, 'fine')) }); // relative, so a cap and a sword weigh the same
    }
  }
  if (!options.length) { const hero = pick(state.active || state.recruited, rand); return makeItem(hero, pick(['weapon', 'offhand', 'head', 'body'], rand), tierForLevel(state.heroes[hero]?.level || 1), 'fine', rand); }
  options.sort((a, b) => b.lag - a.lag);
  const o = pick(options.slice(0, 3), rand);
  let [tier, rarity] = o.ladder[o.rung];
  const r = rand();
  if (r < CHEST_LUCK.jackpot) [tier, rarity] = o.ladder[o.ladder.length - 1];
  else if (r < CHEST_LUCK.jackpot + CHEST_LUCK.step) [tier, rarity] = o.ladder[Math.min(o.ladder.length - 1, o.rung + 1)];
  return makeItem(o.hero, o.slot, tier, rarity, rand);
}

// Shop stock: the current tier's Common pieces for each recruited hero.
export function shopGear(state, tier) {
  const out = [];
  for (const hero of state.recruited) for (const slot of ['weapon', 'offhand', 'head', 'body']) {
    const id = `g.${hero}.${slot}.${tier}.common.0.-.-#shop`;
    registerItem(id);
    out.push(id);
  }
  return out;
}
export const gearPrice = (tier, rarity = 'common') => Math.round(G.tiers[tier - 1].price * (rarity === 'rare' ? 2.2 : rarity === 'fine' ? 1.5 : 1));

// What a piece of gear is worth, from what it actually does: its stats (by the
// same stat values the gear budget uses), plus its trait, element, echo and
// gem sockets. Scaled so the average of a hero's four Common pieces at a tier
// costs that tier's price - so a sword costs more than a cap, and a Rare more
// than a Common, instead of every piece in a tier costing the same.
const statScore = (it) => Object.entries(it.stats || {}).reduce((a, [k, v]) => a + v * (G.statValue[k] ?? 0.5), 0);
const refScores = {};
function refScore(hero, tier) {
  const k = `${hero}.${tier}`;
  if (refScores[k] == null) {
    const ss = ['weapon', 'offhand', 'head', 'body'].map((slot) => registerItem(`g.${hero}.${slot}.${tier}.common.0.-.-#ref`)).filter(Boolean).map(statScore);
    refScores[k] = ss.length ? ss.reduce((a, b) => a + b, 0) / ss.length : 1;
  }
  return refScores[k];
}
export function gearValue(id) {
  const it = items[id] || registerItem(id);
  if (!it || !it.generated) return null;
  const ref = refScore(it.hero && it.hero !== 'any' ? it.hero : 'brann', it.tier);
  const extras = (it.trait ? 0.15 : 0) + (it.element ? 0.1 : 0) + (it.passive ? 0.25 : 0) + ({ rare: 1, unique: 1, legendary: 2 }[it.rarity] || 0) * 0.08;
  return Math.max(1, Math.round(G.tiers[it.tier - 1].price * (statScore(it) / ref + extras)));
}
