// The main quest (dev only): find the king, the Ward Stones, the Tower.
//   const T = await import('/tools/main-quest-test.js'); await T.run()
// Boots a test game (it never saves), sets the world's flags directly and reads
// what the HUD, the pin and the journal would show. Returns { pass, fail }.
import { step, closeDialog } from './goto.js';

export async function run() {
  const W = await import('/tools/dungeon-walk.js');
  await W.boot({ level: 8, relics: ['grapple'] });
  const sc = window.__scene, q = sc.quests, fails = [], log = [];
  const check = (ok, what) => { log.push(`${ok ? 'ok' : 'FAIL'}: ${what}`); if (!ok) fails.push(what); };
  const { LANDMARKS } = await import('/src/world/map.js');
  const { W: world } = await import('/src/world/content.js');
  const flagsOf = world.wards.map((w) => w.flag);
  const reset = () => { for (const f of flagsOf) delete sc.flags[f]; delete sc.flags.metKing; delete sc.flags.malgrimDefeated; delete sc.flags.kingTower; delete sc.flags.towerWarned; delete sc.flags.metFerryman; for (const w of world.wards) { delete sc.flags[w.guardian]; delete sc.flags[w.warden]; } sc.state.tracked = null; };
  reset();

  // the first step, wherever the party starts
  let m = q.mainQuest(), p = q.pin();
  check(m?.text === 'FIND THE KING', `a new game: ${m?.text}`);
  check(p?.x === LANDMARKS.frog.x && p?.y === LANDMARKS.frog.y, `the pin is on the king: ${JSON.stringify(p)}`);
  check(!q.mainHint(), 'no hint before the first stone');

  // meeting him gives the quest, even carrying enough flies for a reward (those wait)
  const flies = sc.state.flies, rewards = sc.state.flyRewards;
  sc.state.flies = Array.from({ length: world.flyRewards[0].n }, (_, i) => i);
  let said = null;
  const say = (lines) => { said = lines; };
  sc.events.on('dialogue', say);
  sc.talkFrog();
  await step(2);
  check(said?.[0]?.text.includes('MADE A FROG'), `his first words are the quest: ${said?.[0]?.text}`);
  check(sc.state.flyRewards === rewards, 'no fly reward at the first meeting');
  m = q.mainQuest();
  check(m?.text === `BREAK THE WARD STONES (0/${flagsOf.length})`, `after meeting him: ${m?.text}`);
  let st = q.mainStones();
  check(st.rows.length === 1 && st.rows[0].name === 'BRIGHTWATER VALE' && st.unfound === 4, `only the Vale is listed: ${JSON.stringify(st)}`);
  check(q.pin()?.x === world.wards[0].x, 'the pin is on the Vale stone');
  closeDialog();
  said = null;
  sc.talkFrog();
  await step(2);
  check(sc.state.flyRewards === rewards + 1, 'the next talk pays the flies');
  sc.events.off('dialogue', say);
  closeDialog();
  sc.state.flies = flies; sc.state.flyRewards = rewards;

  // an old save that broke a stone without this flag: no going back for the king
  reset();
  sc.flags.wardBroken = true;
  m = q.mainQuest();
  check(m?.text === `BREAK THE WARD STONES (1/${flagsOf.length})`, `an old save with one stone: ${m?.text}`);
  check(q.mainStones().rows[0].text === 'STONE BROKEN', 'the Vale row shows it broken');
  check(q.mainHint().includes('SOMEONE WAITS') && !q.mainHint().includes('FERRYMAN'), `the hint keeps his name: ${q.mainHint()}`);
  sc.flags.metFerryman = true;
  check(!q.mainHint(), 'no hint once you have met him');

  // a stone never seen isn't pinned or named; found, it is, and the nearest found one wins
  const mm = sc.minimap;
  mm.isExplored = () => false;
  check(q.pin() === null, 'every stone left unseen: no pin');
  check(q.mainStones().unfound === 4 && q.mainStones().rows.length === 1, 'and no names');
  check(!JSON.stringify(q.mainQuest()).includes('TOWER') && !JSON.stringify(q.mainStones()).includes('TOWER'), 'and no Tower');
  const g = world.wards.find((w) => w.id === 'gloam');
  mm.isExplored = (x, y) => x === g.x && y === g.y;
  check(q.pin()?.x === g.x && q.pin()?.y === g.y, 'found one: the pin goes there');
  check(q.mainStones().rows.some((r) => r.name === 'GLOAMWOOD' && r.text.startsWith('FOLLOW')), 'and it gets a row');
  sc.flags[g.guardian] = true;
  check(q.mainStones().rows.find((r) => r.name === 'GLOAMWOOD').text.includes('WITHERED'), 'its Shadow beaten, the row says so');
  sc.flags[g.warden] = true;
  check(q.mainStones().rows.find((r) => r.name === 'GLOAMWOOD').text === 'BREAK THE STONE', 'its lieutenant beaten, the row says so');
  delete mm.isExplored;

  // all down: back to the king, who names the Tower; Malgrim gone: done
  for (const f of flagsOf) sc.flags[f] = true;
  m = q.mainQuest(); p = q.pin();
  check(m?.text === 'RETURN TO THE KING', `all five down: ${m?.text}`);
  check(p?.x === LANDMARKS.frog.x, 'the pin is on the king');
  sc.events.on('dialogue', say);
  sc.state.flies = Array.from({ length: world.flyRewards[0].n }, (_, i) => i); sc.state.flyRewards = 0;
  said = null; sc.talkFrog(); await step(2);
  check(said?.[0]?.text.includes('ALL FIVE STONES'), `he names it, ahead of any flies: ${said?.[0]?.text}`);
  sc.events.off('dialogue', say); closeDialog(); sc.state.flies = flies; sc.state.flyRewards = rewards;
  m = q.mainQuest(); p = q.pin();
  const door = world.warps.find((w) => w.tower === 'door');
  check(m?.text === 'CLIMB THE NINTH TOWER', `then: ${m?.text}`);
  check(p?.x === door.x && p?.y === door.y, 'the pin is on the Tower door');
  delete sc.flags.kingTower; sc.flags.towerWarned = true;
  check(q.mainQuest()?.text === 'CLIMB THE NINTH TOWER', 'standing at the door earlier counts too');
  sc.flags.malgrimDefeated = true;
  check(q.mainQuest() === null && q.pin() === null, 'Malgrim gone: nothing left to track');
  reset();

  // an errand tracked takes the HUD and the pin; none tracked gives them back
  sc.flags.metKing = true;
  const id = Object.keys(q.state.quests).find((k) => !q.state.quests[k].done) || 'biscuit';
  const had = q.state.quests[id];
  q.state.quests[id] ??= { s: 0, n: 0 };
  sc.state.tracked = id;
  await step(2);
  const ui = sc.ui;
  check(ui.trackTitle.text === q.title(id), `an errand tracked: the HUD says "${ui.trackTitle.text}"`);
  sc.state.tracked = null;
  await step(2);
  check(ui.trackTitle.text === "THE KING'S QUEST", `none tracked: the HUD says "${ui.trackTitle.text}"`);
  check(ui.trackTxt.text.startsWith('BREAK THE WARD STONES'), `and "${ui.trackTxt.text}"`);
  if (had) q.state.quests[id] = had; else delete q.state.quests[id];
  reset();
  console.log(log.join('\n'));
  return { pass: log.length - fails.length, fail: fails, log };
}
