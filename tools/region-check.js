// Region placement check (dev only). In a running game:
//   const R = await import('/tools/region-check.js'); R.check('gloam', [31, 145])
// Every authored thing in a region (campfires, signs, NPCs, townsfolk, nodes,
// flies, chests, shrines, lookouts, lore, enemy groups, errand points, the
// Ward Stone) must stand on open ground the party can walk to from `from`.
// Returns the problems found (empty = all good).
import W from '../src/data/world.json';
import Q from '../src/data/quests.json';
import L from '../src/data/lore.json';
import { biomeAt } from '../src/world/map.js';

export function check(region, from) {
  const sc = window.__scene, nav = sc.nav;
  const inRegion = (x, y) => biomeAt(Math.floor(x), Math.floor(y)) === region;
  const things = [];
  const add = (kind, id, x, y, solidOk = false) => { if (inRegion(x, y)) things.push({ kind, id, x: Math.round(x), y: Math.round(y), solidOk }); };
  for (const c of W.campfires) add('campfire', `${c.x},${c.y}`, c.x, c.y, true);
  for (const s of W.signs) add('sign', s.lines[0].slice(0, 18), s.x, s.y, true);
  for (const n of Q.npcs) add('npc', n.id, n.x, n.y, n.look === 'board' || n.look === 'hawk' || n.look === 'wisplight');
  for (const t of W.townsfolk || []) add('townsfolk', t.id, t.x, t.y, true); // they block their own tile
  for (const n of W.nodes || []) add('node', n.kind, n.x, n.y);
  for (const f of W.flies || []) add('fly', `${f[0]},${f[1]}`, f[0], f[1]);
  for (const c of W.chests) add('chest', c.id, c.x, c.y, true);
  for (const s of W.shrines || []) add('shrine', s.id, s.x, s.y, true);
  for (const l of W.lookouts || []) add('lookout', l.id, l.x, l.y, true);
  for (const p of L) add('lore', p.id, p.x, p.y);
  for (const wd of W.wards) add('ward', wd.id, wd.x, wd.y + 2);
  for (const g of W.groups) for (const [k, x, y] of g.units) add('foe', `${g.id}:${k}`, x, y);
  for (const [id, e] of Object.entries(Q.errands)) {
    if (e.trigger) add('trigger', id, e.trigger[0], e.trigger[1], true); // a point with a radius
    for (const st of e.steps) {
      if (st.at) add('step-at', id, st.at[0], st.at[1]);
      if (st.x !== undefined) add('step-find', id, st.x, st.y);
      for (const u of st.units || []) add('step-foe', `${id}:${u[0]}`, u[1], u[2]);
      for (const p of st.path || []) add('step-path', id, p[0], p[1]);
    }
  }
  const out = [];
  const [fx, fy] = from;
  for (const t of things) {
    // stand next to solid things (signs, fires, chests); otherwise on the tile
    let goal = [t.x, t.y];
    if (nav.isSolid(t.x, t.y)) {
      if (!t.solidOk) { out.push(`${t.kind} ${t.id} at ${t.x},${t.y}: on a solid tile`); }
      goal = nav.nearestOpen(t.x, t.y + 1, 2) || nav.nearestOpen(t.x, t.y, 2);
      if (!goal) { out.push(`${t.kind} ${t.id} at ${t.x},${t.y}: nothing open beside it`); continue; }
    }
    const path = nav.find(fx * 16 + 8, fy * 16 + 8, goal[0] * 16 + 8, goal[1] * 16 + 8, 20000);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x / 16 - goal[0] - 0.5, end.y / 16 - goal[1] - 0.5) > 1.6) out.push(`${t.kind} ${t.id} at ${t.x},${t.y}: can't be reached`);
  }
  return { checked: things.length, problems: out };
}
