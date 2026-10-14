// Persistent game state + pure rules. No Phaser here: this file is meant to
// translate directly to Swift (it defines the save schema and stat math the
// iOS build will share).
import heroData from '../data/heroes.json';
import items from '../data/items.json';
import tuning from '../data/tuning.json';
import crafting from '../data/crafting.json';
import world from '../data/world.json';

export const SAVE_KEY = 'ninthTower.save.v1';
export const SLOTS = ['head', 'body', 'weapon', 'offhand'];

export function newState(leaderId) {
  const heroes = {};
  for (const h of heroData) heroes[h.id] = { level: 1, xp: 0, hp: null, ult: 0, equip: { ...h.equip } };
  return {
    version: 1,
    leader: leaderId,
    recruited: [leaderId],
    heroes,
    inventory: [],      // owned, unequipped item ids
    gold: 0,
    flags: {},          // chests opened, ward broken, boss defeated, ...
    relics: [],         // 'grapple'
    cleared: {},        // enemy group id -> true (only persists for one-shot groups)
    pos: null,          // { x, y } world px of the leader at save time
    difficulty: 'normal',
    materials: { herb: 0, gel: 0, ore: 0, crystal: 0, scrap: 0 },
    potions: { potion: 2, elixir: 0 },
    refine: {},         // itemId -> +N
    flies: [],          // indices into world.flies (+ 'whack' for the minigame prize)
    flyRewards: 0,      // reward tiers claimed from the Frog King
    playTime: 0,
    savedAt: null,
  };
}

export function saveState(state) {
  try {
    state.savedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    // forward-fill fields added after the save was written
    s.materials ??= { herb: 0, gel: 0, ore: 0, crystal: 0, scrap: 0 };
    s.potions ??= { potion: 2, elixir: 0 };
    s.refine ??= {};
    s.flies ??= [];
    s.flyRewards ??= 0;
    return s;
  } catch { return null; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export const heroInfo = (id) => heroData.find((h) => h.id === id);

// Live modifiers from the current save (gear refinement, the Frog King's blessing).
let MODS = { refine: {}, blessing: false };
export function setStatMods(state) { MODS = { get refine() { return state.refine; }, get blessing() { return !!state.flags.blessing; } }; }

// Level + gear -> final stats.
export function computeStats(id, level, equip) {
  const base = heroInfo(id).stats;
  const s = { ...base, def: 0, maxHp: Math.round(base.maxHp * Math.pow(1.1, level - 1)), atk: base.atk + (level - 1) * 2 };
  for (const slot of SLOTS) {
    const it = items[equip[slot]];
    if (!it) continue;
    s.atk += it.stats.atk || 0;
    s.def += it.stats.def || 0;
    s.maxHp += it.stats.hp || 0;
    s.crit += it.stats.crit || 0;
    const r = MODS.refine[equip[slot]] || 0;
    const b = crafting.refine.bonus[slot] || {};
    s.atk += (b.atk || 0) * r;
    s.def += (b.def || 0) * r;
  }
  if (MODS.blessing) s.maxHp = Math.round(s.maxHp * 1.15);
  // element comes from the weapon, else the off-hand (Sable's twin fang, Pip's grimoire)
  s.element = items[equip.weapon]?.element || items[equip.offhand]?.element || null;
  s.passives = SLOTS.map((k) => items[equip[k]]?.passive).filter(Boolean);
  return s;
}

// Damage after defence (diminishing returns).
export const mitigate = (raw, def) => raw * (tuning.defK / (tuning.defK + def));

// steeper curve: linear + quadratic term so mid/late levels take real effort
export const xpToNext = (level) => tuning.xpBase + level * tuning.xpPerLevel + level * level * (tuning.xpQuad || 0);

// Stat delta of swapping `newId` into its slot for this hero.
export function statDelta(id, level, equip, newId) {
  const slot = items[newId].slot;
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
  state.potions[recipe.makes] = (state.potions[recipe.makes] || 0) + 1;
  return true;
}

export function refineCost(state, itemId) {
  const lvl = (state.refine[itemId] || 0) + 1;
  const per = crafting.refine.perLevel;
  return { level: lvl, needs: Object.fromEntries(Object.entries(per).map(([k, n]) => [k, n * lvl])), gold: crafting.refine.goldPerLevel * lvl };
}

export function refine(state, itemId) {
  const c = refineCost(state, itemId);
  if (c.level > crafting.refine.max || !canAfford(state, c.needs, c.gold)) return false;
  pay(state, c.needs, c.gold);
  state.refine[itemId] = c.level;
  return true;
}

export function sellPrice(itemId) {
  const base = world.shop.sell[items[itemId].rarity] || 10;
  return base + (MODS.refine[itemId] || 0) * 10;
}

export function addMats(state, mats = {}) { for (const [k, n] of Object.entries(mats)) state.materials[k] = (state.materials[k] || 0) + n; }
export function addPotions(state, p = {}) { for (const [k, n] of Object.entries(p)) state.potions[k] = (state.potions[k] || 0) + n; }
