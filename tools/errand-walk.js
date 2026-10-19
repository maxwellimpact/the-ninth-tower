// Errand playthrough (dev only). After a reload:
//   const E = await import('/tools/errand-walk.js'); E.runAll();   // runs in the background
//   E.report()                                                      // progress / results so far
//   await E.run('biscuit')                                          // one errand
// For each errand: boots a late-game save (every hero but the one it recruits,
// every relic, all Ward Stones down, every townsfolk home), walks to the giver
// (or the chance-meeting spot), accepts, then plays each step for real -
// talking, fighting what spawns, gathering, finding, following the hawk,
// escorting the cart, ringing the bells - and turns it in. Dialogue is
// answered automatically (first choice) and recorded, so the text can be read
// in order. Reports per errand: done or where it stuck, dialogue, rewards and
// any errors.
import { go, step } from './goto.js';
import Q from '../src/data/quests.json';
import W from '../src/data/world.json';
import RL from '../src/data/relics.json';
import HE from '../src/data/heroes.json';

const px = (t) => t * 16 + 8;
const tile = (u) => [Math.floor(u.x / 16), Math.floor(u.y / 16)];
const HEROES = HE.map((h) => h.id);
let results = {};
let running = null;

function hook(sc, log) {
  // swallow dialogue: record it, take the first choice, finish it
  if (sc.__walkHooked) { sc.__walkLog = log; return; }
  sc.__walkHooked = true; sc.__walkLog = log;
  const emit = sc.events.emit.bind(sc.events);
  sc.events.emit = (ev, ...a) => {
    if (ev === 'dialogue') {
      const [lines, done] = a;
      const L = sc.__walkLog;
      for (const l of lines) L.dialog.push(`${l.who || '?'}: ${l.text}${l.choices ? `  [${l.choices.map((c) => c[0]).join(' | ')}]` : ''}`);
      const last = lines[lines.length - 1];
      setTimeout(() => { if (last?.choices) last.choices[0][1](); done?.(); }, 0);
      return true;
    }
    if (ev === 'banner') sc.__walkLog.banners.push(a.filter((x) => typeof x === 'string').join(' / '));
    if (ev === 'loot') sc.__walkLog.loot.push(...(a[0]?.ids || []));
    return emit(ev, ...a);
  };
}

const tough = (sc) => { for (const h of sc.party) { h.invuln = 1e9; if (h.downed) h.revive?.(1); h.hp = h.maxHp; } };
const wait = async (sc, n) => { for (let i = 0; i < n; i++) { tough(sc); await step(5); if (sc.scene.isPaused()) sc.scene.resume(); } };

function lateState(newState, e) {
  e = { ...e, id: e.id };
  const recruit = e.reward?.recruit;
  const start = recruit === 'brann' ? 'pip' : 'brann';
  const st = newState(start);
  st.recruited = HEROES.filter((h) => h !== recruit);
  st.active = st.recruited.slice(0, 3);
  for (const h of st.recruited) st.heroes[h] ??= newState(h).heroes[h];
  for (const h of st.recruited) st.heroes[h].level = 30;
  st.relics = Object.keys(RL);
  st.gold = 5000;
  st.flags = { ...(st.flags || {}), wardBroken: true, golemDefeated: true, towerWarned: true };
  for (const w of W.wards) st.flags[w.flag] = true;
  for (const t of W.townsfolk) st.flags[`folk_${t.id}`] = true;
  for (const n of Q.npcs) if (n.requires) st.flags[n.requires] = true;
  st.quests ??= {};
  if (e.requires) st.quests[e.requires] = { s: 99, n: 0, done: true };
  // boards and givers offer one errand at a time, in order: the earlier ones are behind you
  const g = Q.npcs.find((n) => n.id === e.giver), mine = g?.errands || [];
  for (const other of mine.slice(0, mine.indexOf(e.id))) st.quests[other] ??= { s: 99, n: 0, done: true };
  return st;
}

async function moveTo(sc, x, y) {
  const goal = sc.nav.isSolid(x, y) ? (sc.nav.nearestOpen(x, y + 1, 3) || sc.nav.nearestOpen(x, y, 3) || [x, y]) : [x, y];
  await go(goal[0], goal[1]);
  return goal;
}

async function talkTo(sc, id) {
  const n = sc.quests.npc(id);
  if (n) { await moveTo(sc, n.x, n.y + 1); sc.quests.talk(n); await wait(sc, 4); return n; }
  const wn = sc.npcs?.find((k) => k.id === id); // a town NPC (Bruno)
  if (wn) { await moveTo(sc, wn.x, wn.y + 1); const t = sc.quests.turnInFor(wn); if (t) sc.quests.advance(t, wn); await wait(sc, 4); return wn; }
  return null;
}

async function killQuestFoes(sc, id, rounds = 30) {
  for (let r = 0; r < rounds; r++) {
    const foes = sc.enemies.filter((e) => e.alive && (e.questSpawn === id || e.staged?.id === id));
    if (!foes.length) return;
    for (const e of foes) e.damage(e.maxHp * 2, sc.leader);
    await wait(sc, 6);
  }
}

export async function run(id) {
  const e = Q.errands[id];
  const log = { id, title: e.title, giver: e.giver, steps: [], dialog: [], banners: [], loot: [], problems: [], done: false };
  const errs0 = (window.__errs ||= []).length;
  const { newState } = await import('/src/game/state.js');
  const st = lateState(newState, { ...e, id });
  const giverDef = Q.npcs.find((n) => n.id === e.giver);
  const start = e.trigger ? [e.trigger[0], e.trigger[1] + e.trigger[2] + 2] : [giverDef.x, giverDef.y + 2];
  st.pos = { x: px(start[0]), y: px(start[1]) };
  const { boot } = await import('/tools/dungeon-walk.js');
  let sc = await boot({ state: st });
  hook(sc, log);
  await go(start[0], start[1], { clear: true });
  // the offer
  const g = sc.quests.npc(e.giver);
  if (!g) { log.problems.push('giver not in the world'); return log; }
  if (e.trigger) {
    await go(e.trigger[0], e.trigger[1]);
    await wait(sc, 10);
  }
  if (!sc.quests.q(id)) {
    if (g.hiddenNow) log.problems.push('giver hidden when the errand should be on offer');
    const offer = sc.quests.offerFor(g);
    if (offer !== id) log.problems.push(`giver offers ${offer || 'nothing'} instead`);
    await talkTo(sc, e.giver);
    await wait(sc, 4);
  }
  if (!sc.quests.q(id)) { log.problems.push('could not accept'); return finish(); }
  // the steps
  for (let guard = 0; guard < 12; guard++) {
    const q = sc.quests.q(id);
    if (!q || q.done) break;
    const s = e.steps[q.s];
    const sIdx = q.s;
    const note = { i: sIdx, type: s.type, text: s.text };
    try {
      if (s.type === 'talk') {
        if (s.take) for (const [k, n] of Object.entries(s.take)) if ((sc.state.materials[k] || 0) < n) note.short = `${k} ${sc.state.materials[k] || 0}/${n}`;
        const n = await talkTo(sc, s.npc);
        if (!n) note.problem = `npc ${s.npc} not found`;
        else if (n.hiddenNow) note.problem = `npc ${s.npc} hidden`;
      } else if (s.type === 'kill') {
        const kinds = [].concat(s.kind || []), where = W.groups.filter((gr) => gr.units.some((u) => !kinds.length || kinds.includes(u[0])));
        note.worldGroups = where.length;
        if (!where.length) note.problem = `no world group has ${s.kind}`;
        const gp = where[0]?.units.find((u) => !kinds.length || kinds.includes(u[0]));
        if (gp) await moveTo(sc, gp[1], gp[2] + 2);
        for (let k = 0; k < s.count + 2 && sc.quests.q(id).s === sIdx; k++) {
          const f = sc.spawnEnemy(kinds[0] || 'goblin', sc.leader.x + 40, sc.leader.y, true);
          f.damage(f.maxHp * 3, sc.leader); await wait(sc, 4);
        }
      } else if (s.type === 'gather') {
        const nodes = W.nodes.filter((n) => n.kind === s.mat).length;
        const drops = Object.entries((await import('/src/data/enemies.json')).default).filter(([, en]) => en.drops?.[s.mat]).map(([k]) => k);
        note.sources = { nodes, drops };
        if (!nodes && !drops.length) note.problem = `no source for ${s.mat}`;
        const have = sc.state.materials[s.mat] || 0;
        sc.state.materials[s.mat] = have + s.count;
        sc.quests.onGather(s.mat, s.count);
      } else if (s.type === 'spawn') {
        await moveTo(sc, s.at[0], s.at[1]);
        for (let k = 0; k < 40 && !sc.quests.live[id]?.spawned; k++) await wait(sc, 2);
        if (!sc.quests.live[id]?.spawned) note.problem = 'nothing spawned at the spot';
        note.foes = sc.quests.live[id]?.spawned?.map((f) => f.kind);
        await killQuestFoes(sc, id);
      } else if (s.type === 'find') {
        await moveTo(sc, s.x, s.y + 1);
        const o = sc.interactables.find((k) => k.kind === 'find');
        if (!o) note.problem = 'no find target';
        else o.interact(sc.leader);
        await wait(sc, 6);
      } else if (s.type === 'follow') {
        for (const [x, y] of s.path) { await moveTo(sc, x, y); await wait(sc, 4); }
      } else if (s.type === 'bells') {
        await moveTo(sc, s.bells[0][0], s.bells[0][1] + 1);
        const live = sc.quests.live[id];
        for (const tone of s.order) { const b = live.bells.find((k) => k.tone === tone); sc.quests.ring(id, tone, b.img); await wait(sc, 2); }
        await wait(sc, 12);
      } else if (s.type === 'defend') {
        const n = sc.quests.npc(s.npc); await moveTo(sc, n.x, n.y + 2);
        await wait(sc, 6); await killQuestFoes(sc, id); await wait(sc, 6);
      } else if (s.type === 'escort') {
        const live = sc.quests.live[id];
        for (let k = 0; k < 900 && sc.quests.q(id)?.s === sIdx; k++) {
          const c = live?.cart; if (!c) break;
          for (const h of sc.party) { h.x = c.x + 20; h.y = c.y + 12; }
          tough(sc);
          const foes = sc.enemies.filter((f) => f.alive && f.questSpawn === id);
          for (const f of foes) f.damage(f.maxHp * 2, sc.leader);
          await step(5);
        }
        note.cartHp = live?.cart ? Math.round(live.cart.hp) : null;
      }
    } catch (err) { note.problem = `threw: ${err.message}`; }
    await wait(sc, 6);
    const after = sc.quests.q(id);
    note.advanced = !after || after.done || after.s > sIdx;
    log.steps.push(note);
    if (!note.advanced) { log.problems.push(`stuck at step ${sIdx} (${s.type})${note.problem ? `: ${note.problem}` : ''}`); break; }
    if (note.problem) log.problems.push(`step ${sIdx}: ${note.problem}`);
  }
  await wait(sc, 30);
  return finish();
  function finish() {
    log.done = !!sc?.quests?.q(id)?.done;
    log.errors = (window.__errs || []).slice(errs0);
    log.recruited = e.reward?.recruit ? sc.state.recruited.includes(e.reward.recruit) : undefined;
    results[id] = log;
    return log;
  }
}

export function runAll(ids = Object.keys(Q.errands)) {
  if (running) return 'already running';
  results = {};
  running = (async () => {
    for (const id of ids) {
      try { await run(id); } catch (err) { results[id] = { id, problems: [`harness threw: ${err.message}`], done: false }; }
    }
    running = null;
  })();
  return `running ${ids.length}`;
}

export function report(full = false) {
  const rows = Object.values(results);
  if (full) return results;
  return { running: !!running, finished: rows.length, done: rows.filter((r) => r.done).length, failing: rows.filter((r) => !r.done || r.problems.length || r.errors?.length).map((r) => ({ id: r.id, done: r.done, problems: r.problems, errors: r.errors })) };
}
