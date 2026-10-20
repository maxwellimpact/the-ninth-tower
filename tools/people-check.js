// People on dry land (dev only; never-again rule 9). In a running game:
//   const P = await import('/tools/people-check.js'); P.check()
// Every errand giver, keeper, townsperson and the Ferryman's spot at every
// campfire: nothing solid under them, no water (open water, bog, shallows) or
// lava within a tile, and a walking path from the Brightwater fire.
// Returns the problems found (empty = all good).
import W from '../src/data/world.json';
import Q from '../src/data/quests.json';
import { T, MAP_W, MAP_H } from '../src/world/map.js';

const WET = new Set([T.WATER, T.BOG, T.SHALLOW, T.LAVA]);
// out of reach on foot by design: Margo's swim island, the Hermit behind his
// Lens wall, and the fires up the Highfold climb and past the Basin barrier
const GATED = new Set(['margo', 'hermit', 'THE HIGHFOLD', 'THE TOWER GATE']);

export function check({ from = [13, 37] } = {}) {
  const sc = window.__scene, nav = sc.nav, w = sc.world;
  const name = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k]));
  const people = [];
  for (const n of Q.npcs) if (!['board', 'hawk', 'wisplight'].includes(n.look)) people.push(['npc', n.id, n.x, n.y]);
  for (const t of W.townsfolk || []) people.push(['townsfolk', t.id, t.x, t.y]);
  // anyone moved since (homes, the Ferryman): where they stand in this game
  for (const n of Object.values(sc.quests.npcs)) if (n.x !== Q.npcs.find((q) => q.id === n.id)?.x || n.y !== Q.npcs.find((q) => q.id === n.id)?.y) people.push(['npc (moved)', n.id, n.x, n.y]);
  for (const c of W.campfires) { const s = sc.ferrySpot?.(c); if (s) people.push(['ferryman', c.name, s[0], s[1]]); }
  const out = [];
  for (const [kind, id, x, y] of people) {
    if (x >= MAP_W || y >= MAP_H) continue; // indoors (shop keepers and the like)
    const under = w.at(x, y);
    const wet = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (WET.has(w.at(x + dx, y + dy))) wet.push(`${name[w.at(x + dx, y + dy)]}@${x + dx},${y + dy}`);
    // the person's own tile is blocked by them; walk to a free neighbour
    const goal = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => !nav.isSolid(a, b));
    let reach = false;
    if (goal) { const p = nav.find(from[0] * 16 + 8, from[1] * 16 + 8, goal[0] * 16 + 8, goal[1] * 16 + 8, 60000); const e = p?.[p.length - 1]; reach = !!e && Math.hypot(e.x / 16 - goal[0] - 0.5, e.y / 16 - goal[1] - 0.5) < 1.6; }
    if (WET.has(under) || [T.WALL, T.CLIFF, T.RIM, T.HOUSE, T.CHASM].includes(under) || wet.length || (!reach && !GATED.has(id))) out.push({ kind, id, at: [x, y], under: name[under], wet, reach });
  }
  return { checked: people.length, problems: out };
}
