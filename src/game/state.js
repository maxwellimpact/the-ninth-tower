// Persistent game state + pure rules. No Phaser here: this file is meant to
// translate directly to Swift (it defines the save schema and stat math the
// iOS build will share).
import heroData from '../data/heroes.json';
import items from '../data/items.json';
import DISCIPLINES from '../data/disciplines.json';
import tuning from '../data/tuning.json';
import crafting from '../data/crafting.json';
import world from '../data/world.json';
import skills from '../data/skills.json';
import gearData from '../data/gear.json';
import { ensureItems, isGenerated, tierOf } from './itemgen.js';
import { cloudBackup, cloudClear, cloudCopy } from './cloudsave.js';

export const SAVE_KEY = 'ninthTower.save.v1';
export const SLOTS = ['head', 'body', 'weapon', 'offhand']; // drawn on the hero
export const TRINKETS = ['trinket1', 'trinket2'];             // rings and charms
export const ALL_SLOTS = [...SLOTS, ...TRINKETS];

export function newState(leaderId) {
  const heroes = {};
  for (const h of heroData) heroes[h.id] = { level: 1, xp: 0, hp: null, ult: 0, equip: { ...h.equip, trinket1: null, trinket2: null }, ...newSkillState(h.id) };
  return {
    version: 1,
    leader: leaderId,
    recruited: [leaderId],
    active: [leaderId], // who travels in the party (max 3); the rest wait on the bench
    heroes,
    inventory: [],      // owned, unequipped item ids
    fresh: [],          // item ids picked up but not yet looked at in the menu ("NEW")
    gold: 0,
    flags: {},          // chests opened, ward broken, boss defeated, ...
    relics: [],         // 'grapple'
    cleared: {},        // enemy group id -> true (only persists for one-shot groups)
    respawn: {},        // enemy group id -> seconds left before a cleared group returns (0: due, waiting out of sight)
    pos: null,          // { x, y } world px of the leader at save time
    difficulty: 'normal',
    materials: { herb: 0, gel: 0, ore: 0, crystal: 0, scrap: 0 },
    potions: { potion: 2, elixir: 0, antidote: 0 },
    lore: [],           // lore page ids read
    refine: {},         // itemId -> +N
    gems: {},           // 'ember1' -> count (kind + grade 1-4)
    sockets: {},        // itemId -> [gemKey|null, ...]
    flies: [],          // indices into world.flies (+ 'whack' for the minigame prize)
    flyRewards: 0,      // reward tiers claimed from the Frog King
    playTime: 0,
    stats: { kills: 0, levelUps: [] }, // pacing telemetry (debug readout)
    savedAt: null,
  };
}

// ------------------------------------------------------------------ skills
// Per hero: ranks of learned skills/passives, which are equipped, unspent points.
// A hero's own tree, plus the skills of the discipline they've learned (if any)
export const heroSkillIds = (id, disc = null) => Object.entries(skills).filter(([, s]) => (s.hero === id || (disc && s.discipline === disc)) && !s.ult);
export const skillDef = (sid) => skills[sid];

export function newSkillState(id) {
  const starters = heroSkillIds(id).filter(([, s]) => s.unlock === 1);
  const act = starters.filter(([, s]) => !s.passive).map(([k]) => k);
  const pas = starters.filter(([, s]) => s.passive).map(([k]) => k);
  const ranks = Object.fromEntries(starters.map(([k]) => [k, 1]));
  return { skills: { ranks, active: [...act, null].slice(0, tuning.activeSlots), passive: [...pas, null].slice(0, tuning.passiveSlots) }, sp: 0 };
}

// Saves from the demo: start the hero on the new tree and refund a point per level.
function migrateSkills(id, hs) {
  Object.assign(hs, newSkillState(id));
  hs.sp = Math.max(0, (hs.level || 1) - 1);
}

export const skillRank = (hs, sid) => hs.skills?.ranks[sid] || 0;
export const nextRankCost = (hs, sid) => tuning.skillRankCost[skillRank(hs, sid) + 1] ?? null;
export function canRankUp(hs, sid) {
  const d = skills[sid];
  const cost = nextRankCost(hs, sid);
  return !!d && cost !== null && hs.level >= d.unlock && hs.sp >= cost;
}
// unspent points that would buy something right now (the "+" badges on the HUD and menu)
export const skillsReady = (id, hs) => !!hs?.sp && heroSkillIds(id, hs.disc).some(([sid]) => canRankUp(hs, sid));
export function rankUp(hs, sid) {
  if (!canRankUp(hs, sid)) return false;
  hs.sp -= nextRankCost(hs, sid);
  hs.skills.ranks[sid] = skillRank(hs, sid) + 1;
  // auto-fill an empty slot with a newly learned skill
  const list = skills[sid].passive ? hs.skills.passive : hs.skills.active;
  if (!list.includes(sid)) { const i = list.indexOf(null); if (i >= 0) list[i] = sid; }
  return true;
}
// Toggle a learned skill into / out of its slots.
export function toggleSkill(hs, sid) {
  if (!skillRank(hs, sid)) return false;
  const list = skills[sid].passive ? hs.skills.passive : hs.skills.active;
  const i = list.indexOf(sid);
  if (i >= 0) { if (!skills[sid].passive && list.filter(Boolean).length <= 1) return false; list[i] = null; return true; }
  const e = list.indexOf(null);
  if (e < 0) return false;
  list[e] = sid;
  return true;
}
// Learn (or switch to) a discipline. Switching refunds every skill point spent
// on the old one; the new discipline's first skill comes free at rank 1.
export function learnDiscipline(hs, disc) {
  const cost = (r) => { let n = 0; for (let i = 1; i <= r; i++) n += tuning.skillRankCost[i] || 0; return n; };
  if (hs.disc) {
    for (const [sid, d] of Object.entries(skills)) {
      if (d.discipline !== hs.disc) continue;
      const r = skillRank(hs, sid);
      if (r) hs.sp += cost(r) - (sid === hs.discFree ? tuning.skillRankCost[1] : 0);
      delete hs.skills.ranks[sid];
      for (const list of [hs.skills.active, hs.skills.passive]) { const i = list.indexOf(sid); if (i >= 0) list[i] = null; }
    }
  }
  hs.disc = disc;
  const first = DISCIPLINES[disc]?.first;
  hs.discFree = first;
  if (first) {
    hs.skills.ranks[first] = 1;
    const list = hs.skills.active;
    const i = list.indexOf(null);
    if (i >= 0) list[i] = first;
  }
}
// Respec (Trainers' Hall): every skill point spent comes back; the hero keeps
// their discipline, back at its free first skill.
export function respecHero(id, hs) {
  const cost = (r) => { let n = 0; for (let i = 1; i <= r; i++) n += tuning.skillRankCost[i] || 0; return n; };
  const fresh = newSkillState(id).skills;
  let refund = 0;
  for (const [sid, r] of Object.entries(hs.skills.ranks)) refund += cost(r) - (fresh.ranks[sid] || sid === hs.discFree ? tuning.skillRankCost[1] : 0);
  hs.skills = fresh;
  hs.sp = (hs.sp || 0) + Math.max(0, refund);
  if (hs.disc) { hs.skills.ranks[hs.discFree] = 1; const i = hs.skills.active.indexOf(null); if (i >= 0) hs.skills.active[i] = hs.discFree; }
  return refund;
}
export const respecCost = (hs) => 20 * hs.level;
export const switchCost = (hs, disc) => DISCIPLINES[disc].cost + (hs.disc ? 15 * hs.level : 0);
// Rank multiplier: +15% per rank above 1.
export const rankMul = (rank) => 1 + Math.max(0, rank - 1) * tuning.skillRankBonus;

export function saveState(state) {
  try {
    state.savedAt = new Date().toISOString();
    const json = JSON.stringify(state);
    cloudBackup(json, state.savedAt); // the Claude app can wipe localStorage, so keep a copy
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch { return false; }
}

export function loadState() {
  try {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { /* storage blocked */ }
    raw ||= cloudCopy();
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    // forward-fill fields added after the save was written
    s.materials ??= { herb: 0, gel: 0, ore: 0, crystal: 0, scrap: 0 };
    s.potions ??= { potion: 2, elixir: 0 };
    s.refine ??= {};
    s.flies ??= [];
    s.flyRewards ??= 0;
    for (const h of heroData) if (!s.heroes[h.id]) s.heroes[h.id] = { level: 1, xp: 0, hp: null, ult: 0, equip: { ...h.equip, trinket1: null, trinket2: null }, ...newSkillState(h.id) };
    s.active ??= s.recruited.slice(0, 3);
    for (const [id, hs] of Object.entries(s.heroes)) {
      if (!hs.skills) migrateSkills(id, hs);
      hs.equip.trinket1 ??= null; hs.equip.trinket2 ??= null;
    }
    s.gems ??= {};
    s.sockets ??= {};
    s.fresh ??= [];
    s.lore ??= [];
    s.potions.antidote ??= 0;
    ensureItems(s);
    s.stats ??= { kills: 0, levelUps: [] };
    return s;
  } catch { return null; }
}

// Items picked up from the world: into the bag, flagged NEW until seen in the menu.
export function gainItems(state, ids) {
  state.inventory.push(...ids);
  state.fresh ??= [];
  for (const id of ids) if (!state.fresh.includes(id)) state.fresh.push(id);
}
// NEW items a hero can use: their own gear plus rings
export function freshFor(state, heroId, kind) {
  return (state.fresh || []).filter((id) => state.inventory.includes(id) && items[id] && (!kind || (items[id].slot === kind)) && (items[id].slot === 'trinket' || items[id].hero === heroId));
}

export function clearSave() { cloudClear(); try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export const heroInfo = (id) => heroData.find((h) => h.id === id);

// Live modifiers from the current save (gear refinement, the Frog King's blessing).
let MODS = { refine: {}, sockets: {}, blessing: false };
export function setStatMods(state) { MODS = { get refine() { return state.refine; }, get sockets() { return state.sockets || {}; }, get blessing() { return !!state.flags.blessing; } }; }

// Level + gear -> final stats.
export function computeStats(id, level, equip, hs = null) {
  const base = heroInfo(id).stats;
  const s = { ...base, def: 0, cdr: 0, regen: 0, maxHp: Math.round(base.maxHp * (1 + (level - 1) * tuning.hpGrowth)), atk: base.atk + (level - 1) * tuning.atkGrowth };
  const traits = [];
  let hpPct = 0, defPct = 0;
  s.gemElements = [];
  for (const slot of ALL_SLOTS) {
    const iid = equip[slot];
    const it = items[iid];
    if (!it) continue;
    const r = MODS.refine[iid] || 0;
    const mul = 1 + r * crafting.refine.statPerLevel;
    // refinement: +6% of the item's stats per level, at least +1 per level to its main stat
    const main = Object.entries(it.stats).sort((a, b) => (b[0] === 'crit' ? b[1] * 100 : b[1]) - (a[0] === 'crit' ? a[1] * 100 : a[1]))[0]?.[0];
    for (const [k, v] of Object.entries(it.stats)) {
      const key = k === 'hp' ? 'maxHp' : k;
      let add = v * mul;
      if (k === main && r && k !== 'crit' && k !== 'cdr') add = Math.max(add, v + r);
      s[key] = (s[key] || 0) + (k === 'crit' || k === 'cdr' ? add : Math.round(add));
    }
    if (it.trait) traits.push(it.trait);
    for (const g of MODS.sockets[iid] || []) {
      if (!g) continue;
      const kind = g.replace(/\d/g, ''), grade = +g.slice(kind.length) - 1;
      const G = crafting.gems, gk = G.kinds[kind];
      if (gk.element) s.gemElements.push({ el: gk.element, dmg: G.elementDmg[grade], armor: slot !== 'weapon' && slot !== 'offhand' });
      else if (gk.stat === 'hpPct') hpPct += G.hpPct[grade];
      else if (gk.stat === 'defPct') defPct += G.defPct[grade];
      else if (gk.stat === 'crit') s.crit += G.crit[grade];
      else if (gk.stat === 'regen') s.regen += G.regen[grade];
    }
  }
  s.maxHp = Math.round(s.maxHp * (1 + hpPct));
  s.def = Math.round(s.def * (1 + defPct));
  if (MODS.blessing) s.maxHp = Math.round(s.maxHp * 1.15);
  // element comes from the weapon, else the off-hand (Sable's twin fang, Pip's grimoire), else a weapon gem
  s.element = items[equip.weapon]?.element || items[equip.offhand]?.element || s.gemElements.find((g) => !g.armor)?.el || null;
  s.passives = ALL_SLOTS.map((k) => items[equip[k]]?.passive).filter(Boolean);
  s.traits = traits;
  if (traits.includes('cdr')) s.cdr += 0.1;
  if (traits.includes('fleet')) s.speed = Math.round(s.speed * 1.08);
  if (ALL_SLOTS.some((k) => items[equip[k]]?.perk === 'wanderer')) s.speed = Math.round(s.speed * 1.08); // Wanderer's Charm
  if (hs?.skills?.passive.includes('clarity')) s.cdr += 0.1 + 0.02 * ((hs.skills.ranks.clarity || 1) - 1); // Clarity (Arcane)
  s.cdr = Math.min(0.3, s.cdr);
  // equipped stat passives
  const pr = (pid) => (hs?.skills?.passive.includes(pid) ? hs.skills.ranks[pid] || 0 : 0);
  if (pr('ironskin')) s.def = Math.round(s.def * (1.12 + 0.03 * (pr('ironskin') - 1)));
  if (pr('eagleeye')) s.range = Math.round(s.range * 1.2);
  if (pr('fleet')) s.speed = Math.round(s.speed * (1.08 + 0.02 * (pr('fleet') - 1)));
  return s;
}

// Damage after defence (diminishing returns).
// K grows with the attacker's level so armour keeps mattering late.
export const mitigate = (raw, def, attackerLevel = 1) => { const k = tuning.defK + 6 * (attackerLevel - 1); return raw * (k / (k + Math.max(0, def))); };

// steeper curve: linear + quadratic term so mid/late levels take real effort
export const xpToNext = (level) => tuning.xpBase + level * tuning.xpPerLevel + level * level * (tuning.xpQuad || 0);
// XP a hero earns from an enemy: damped when the enemy is far below the hero.
export function xpFor(heroLevel, enemyLevel, xp) {
  const gap = heroLevel - enemyLevel - tuning.overLevelGrace;
  return Math.max(1, Math.round(xp * (gap > 0 ? Math.max(tuning.overLevelMin, 1 - gap * tuning.overLevelPenalty) : 1)));
}

// Stat delta of swapping `newId` into its slot for this hero.
export function statDelta(id, level, equip, newId) {
  let slot = items[newId].slot;
  if (slot === 'trinket') slot = equip.trinket1 ? (equip.trinket2 ? 'trinket1' : 'trinket2') : 'trinket1';
  const a = computeStats(id, level, equip);
  const b = computeStats(id, level, { ...equip, [slot]: newId });
  return { atk: b.atk - a.atk, def: b.def - a.def, maxHp: b.maxHp - a.maxHp, crit: Math.round((b.crit - a.crit) * 100) };
}

// Pick a "fine" drop the party doesn't own yet, favouring recruited heroes.
export function rollFineDrop(state, rand = Math.random) {
  if (rand() > tuning.fineDropChance) return null;
  const owned = new Set([...state.inventory, ...Object.values(state.heroes).flatMap((h) => Object.values(h.equip))]);
  const pool = Object.entries(items).filter(([id, it]) => it.rarity === 'fine' && !owned.has(id));
  if (!pool.length) return null;
  const mine = pool.filter(([, it]) => state.recruited.includes(it.hero));
  const pick = (mine.length ? mine : pool)[Math.floor(rand() * (mine.length ? mine : pool).length)];
  return pick[0];
}

// ----------------------------------------------------------- crafting & shop
export const CRAFT = crafting;
export const itemName = (id) => `${items[id].name}${MODS.refine[id] ? ` +${MODS.refine[id]}` : ''}`;

export function canAfford(state, needs, gold = 0) {
  if (state.gold < gold) return false;
  return Object.entries(needs).every(([k, n]) => (state.materials[k] || 0) >= n);
}
function pay(state, needs, gold = 0) {
  state.gold -= gold;
  for (const [k, n] of Object.entries(needs)) state.materials[k] -= n;
}

export function craft(state, recipe) {
  if (!canAfford(state, recipe.needs)) return false;
  pay(state, recipe.needs);
  // Tinker's Luck (Gizmo, in the party): sometimes a second one comes out of it
  const g = state.heroes.gizmo, lucky = state.active?.includes('gizmo') && g?.skills?.passive.includes('tinkersluck') && Math.random() < 0.2;
  state.potions[recipe.makes] = (state.potions[recipe.makes] || 0) + (lucky ? 2 : 1);
  return lucky ? 'double' : true;
}

// Blacksmith rank 0-3 (C5): returns with the Vale stone, then 3 and 5 stones.
export const smithRank = (state) => state.flags.smithRank || 0;
export const refineCap = (state) => crafting.refine.rankCap[smithRank(state)] ?? 0;

export function refineCost(state, itemId) {
  const R = crafting.refine;
  const lvl = (state.refine[itemId] || 0) + 1;
  const tier = tierOf(itemId);
  const needs = { [R.ore[tier]]: lvl, scrap: R.scrapPerLevel * lvl };
  if (R.regionMat[lvl]) needs[R.regionMat[lvl]] = (needs[R.regionMat[lvl]] || 0) + 1;
  if (R.starAt.includes(lvl)) needs.starmetal = (needs.starmetal || 0) + 1;
  return { level: lvl, needs, gold: R.goldPerLevel * lvl * tier };
}

export function refine(state, itemId) {
  const c = refineCost(state, itemId);
  if (c.level > refineCap(state) || !canAfford(state, c.needs, c.gold)) return false;
  pay(state, c.needs, c.gold);
  state.refine[itemId] = c.level;
  return true;
}

// Break an item down for ~40% of what it took to make and refine (never Uniques).
export function salvageYield(state, itemId) {
  const it = items[itemId];
  if (!it || it.rarity === 'unique' || it.rarity === 'legendary') return null;
  const R = crafting.refine, tier = tierOf(itemId);
  const out = { [R.ore[tier]]: Math.max(1, Math.round(tier * 0.8)), scrap: 1 };
  for (let l = 1; l <= (state.refine[itemId] || 0); l++) {
    const c = { [R.ore[tier]]: l, scrap: l };
    for (const [k, n] of Object.entries(c)) out[k] = (out[k] || 0) + n * R.salvage;
  }
  for (const k of Object.keys(out)) out[k] = Math.max(1, Math.round(out[k]));
  return out;
}
export function salvage(state, itemId) {
  const y = salvageYield(state, itemId);
  const i = state.inventory.indexOf(itemId);
  if (!y || i < 0) return null;
  state.inventory.splice(i, 1);
  delete state.refine[itemId];
  delete state.sockets[itemId];
  addMats(state, y);
  return y;
}

export function sellPrice(itemId) {
  const it = items[itemId];
  const base = it.generated ? Math.round(gearData.tiers[it.tier - 1].price * 0.25 * ({ common: 1, fine: 1.4, rare: 2 }[it.rarity] || 1)) : world.shop.sell[it.rarity] || 10;
  return base + (MODS.refine[itemId] || 0) * 10 * tierOf(itemId);
}

// ------------------------------------------------------------------ gems
export const socketCount = (itemId) => ({ rare: 1, unique: 1, legendary: 2 }[items[itemId]?.rarity] || 0);
export const gemName = (g) => { const k = g.replace(/\d/g, ''); return `${crafting.gems.grades[+g.slice(k.length) - 1]} ${crafting.gems.kinds[k].name}`; };
export function socketGem(state, itemId, slotIdx, gem) {
  if (slotIdx >= socketCount(itemId) || !(state.gems[gem] > 0)) return false;
  const grade = +gem.replace(/\D/g, '');
  const gold = crafting.gems.socketGold[grade - 1];
  if (state.gold < gold) return false;
  state.gold -= gold;
  const s = (state.sockets[itemId] ??= []);
  if (s[slotIdx]) state.gems[s[slotIdx]] = (state.gems[s[slotIdx]] || 0) + 1; // removing is free: the old gem comes back
  s[slotIdx] = gem;
  state.gems[gem]--;
  return true;
}
export function unsocket(state, itemId, slotIdx) {
  const s = state.sockets[itemId];
  if (!s?.[slotIdx]) return false;
  state.gems[s[slotIdx]] = (state.gems[s[slotIdx]] || 0) + 1;
  s[slotIdx] = null;
  return true;
}
// three of a grade make one of the next
export function combineGems(state, gem) {
  const kind = gem.replace(/\d/g, ''), grade = +gem.slice(kind.length);
  if (grade >= 4 || (state.gems[gem] || 0) < crafting.gems.combine) return false;
  state.gems[gem] -= crafting.gems.combine;
  const next = `${kind}${grade + 1}`;
  state.gems[next] = (state.gems[next] || 0) + 1;
  return true;
}

export function addMats(state, mats = {}) { for (const [k, n] of Object.entries(mats)) state.materials[k] = (state.materials[k] || 0) + n; }
export function addPotions(state, p = {}) { for (const [k, n] of Object.entries(p)) state.potions[k] = (state.potions[k] || 0) + n; }

// ------------------------------------------------------------ level bands
// C1: the four outer regions take their band from how many outer Ward Stones
// are already down; a freed region keeps the band it had, but never falls
// more than 6 levels below the current outer floor.
export const OUTER_REGIONS = ['marsh', 'gloam', 'cinder', 'frost'];
export const outerWardsDown = (state) => OUTER_REGIONS.filter((r) => state.flags[`ward_${r}`]).length;
export function regionBand(state, r) {
  if (!r) return [1, 9];
  if (!r.outer) return r.band;
  const floor = 6 + 4 * outerWardsDown(state);
  const frozen = state.flags[`band_${r.outer}`];
  if (frozen) { const f = Math.max(frozen[0], floor - 6); return [f, f + (frozen[1] - frozen[0])]; }
  return [floor, floor + 8];
}
