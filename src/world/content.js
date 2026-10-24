// What the loaded map contains: Aldermere's world.json and quests.json, or a
// small test map's own content (src/data/maps/*.json) in their place.
//
// The game reads `W` and `Q` from here, not from the JSON files, and they're
// live bindings: useMap() swaps them before the Game scene builds anything,
// so every `W.campfires`, `W.groups`, `Q.npcs`… then means the test map's.
// A test map keeps Aldermere's settings (regions' level bands unless it has a
// `band` of its own, the shop, the bosses' tuning) and replaces every list of
// things in the world with its own, empty unless it lists some. Its coordinates are its own (0,0 is its
// top-left) and are moved to where the map is stamped (`at`).
//
// A generated map (world/vast.js: `vast`, `vast40`...) also brings its own
// size and region rule (setMapShape), and its own regions and level bands.
import WORLD from '../data/world.json';
import QUESTS from '../data/quests.json';
import { setMapShape } from './map.js';
import { vastDef, VAST_SAVED } from './vast.js';

const MAPS = Object.fromEntries(Object.entries(import.meta.glob('../data/maps/*.json', { eager: true, import: 'default' })).map(([p, d]) => [p.match(/([^/]+)\.json$/)[1], d]));
export const mapIds = () => Object.keys(MAPS); // the authored test maps (generated ones are made on request)
export const mapDef = (id) => MAPS[id] || vastDef(id) || null;
// How a map saves (its `save`): 'none' (the default for test and profiling
// maps), 'own' or 'shared'. Aldermere is the main game. See game/state.js, worlds.
export const saveMode = (id) => (id ? mapDef(id)?.save || 'none' : 'shared');
export const ownMapIds = () => [...mapIds(), ...VAST_SAVED].filter((id) => mapDef(id).save === 'own');

export let W = WORLD;
export let Q = QUESTS;
export let MAP = null; // the test map in play, or null for Aldermere

// shift every x/y (and a pack's units) by the stamp origin
function place(list, [ox, oy]) {
  return list.map((e) => {
    if (Array.isArray(e)) return [e[0] + ox, e[1] + oy, ...e.slice(2)]; // a bare [x, y] (golden flies)
    const o = { ...e };
    if (typeof o.x === 'number') o.x += ox;
    if (typeof o.y === 'number') o.y += oy;
    if (o.units) o.units = o.units.map(([k, x, y, ...r]) => [k, x + ox, y + oy, ...r]);
    if (o.to) o.to = { ...o.to, x: o.to.x + ox, y: o.to.y + oy };
    return o;
  });
}

export function useMap(id) {
  const def = id ? mapDef(id) : null;
  setMapShape(def?.generated ? def : null);
  MAP = def ? { ...def, id } : null;
  if (!def) { W = WORLD; Q = QUESTS; return null; }
  const at = def.at;
  const c = def.content || {};
  W = Object.fromEntries(Object.entries(WORLD).map(([k, v]) => [k, Array.isArray(v) && k !== 'regions' && k !== 'flyRewards' ? place(c[k] || [], at) : v]));
  // whatever region the stamp sits in, the banner names the test map (a
  // generated map has real regions of its own)
  W.regions = def.regions || WORLD.regions.map((r) => ({ ...r, name: def.name, sub: def.sub || 'A TEST MAP' }));
  W.start = { x: def.start[0] + at[0], y: def.start[1] + at[1] };
  Q = { ...QUESTS, npcs: place(c.questNpcs || [], at), errands: c.errands || {} };
  return MAP;
}

// the map's rectangle, in world tiles
export const mapRect = () => MAP && { x0: MAP.at[0], y0: MAP.at[1], x1: MAP.at[0] + (MAP.w ?? MAP.rows[0].length) - 1, y1: MAP.at[1] + (MAP.h ?? MAP.rows.length) - 1 };
