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
  const reset = () => { for (const f of flagsOf) delete sc.flags[f]; delete sc.flags.metKing; delete sc.flags.malgrimDefeated; sc.state.tracked = null; };
  reset();

  // the first step, wherever the party starts
  let m = q.mainQuest(), p = q.pin();
  check(m?.text === 'FIND THE KING', `a new game: ${m?.text}`);
  check(p?.x === LANDMARKS.frog.x && p?.y === LANDMARKS.frog.y, `the pin is on the king: ${JSON.stringify(p)}`);
  check(!q.mainNote(), 'no note before you meet him');

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
  check(q.mainNote().includes('STAIR'), `the note repeats his directions: ${q.mainNote()}`);
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
  check(q.mainNote().startsWith('STILL STANDING') && !q.mainNote().includes('VALE'), `the rest are listed: ${q.mainNote()}`);

  // the outer stones come in any order: the pin is the nearest one up, and moves on
  sc.flags.ward_frost = true;
  const L = sc.leader, stand = world.wards.filter((w) => !sc.flags[w.flag]);
  const near = [...stand].sort((a, b) => Math.hypot(a.x - L.x / 16, a.y - L.y / 16) - Math.hypot(b.x - L.x / 16, b.y - L.y / 16))[0];
  p = q.pin();
  check(p?.x === near.x && p?.y === near.y, `the pin is the nearest stone still up: ${near.id}`);
  check(q.mainQuest().text.includes('(2/'), `two down, any order: ${q.mainQuest().text}`);

  // all down: the Tower; Malgrim gone: done
  for (const f of flagsOf) sc.flags[f] = true;
  m = q.mainQuest(); p = q.pin();
  const door = world.warps.find((w) => w.tower === 'door');
  check(m?.text === 'CLIMB THE NINTH TOWER', `all five down: ${m?.text}`);
  check(p?.x === door.x && p?.y === door.y, 'the pin is on the Tower door');
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
