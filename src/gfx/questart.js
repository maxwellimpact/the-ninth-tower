// Small props for errands: Biscuit the dog, a glint in the shallows, the
// ruin bells, Marla's goods cart and the tavern rumour board.
import { makeCanvas, grid, outline, px } from './pixel.js';
import { PAL } from './palette.js';

const DOG = { B: 'dirtL', b: 'dirt', d: 'dirtD', W: 'bone', E: 'ink', N: 'ink', T: 'redL' };
export function dogFrames() {
  const sit = [
    '....bb......',
    '...bBBb.....',
    '..bBEBBd....',
    '..NBBBBd....',
    '...TBBb.....',
    '...bBBBb....',
    '..bBWBBBb.b.',
    '..bBWBBBbb..',
    '..bB.bB.b...',
    '..dd.dd.....',
  ];
  const sit2 = sit.map((r, i) => (i === 6 ? '..bBWBBBb..b' : i === 7 ? '..bBWBBBbbb.' : r));
  const run = [
    '............',
    '.bb.........',
    'bBBb......b.',
    'BEBBbbbbbb..',
    'NBBBBBBBBb..',
    '.TbBWBBBBb..',
    '...bWBBBb...',
    '..b.b..b.b..',
    '.d.....d....',
    '............',
  ];
  const run2 = run.map((r, i) => (i === 7 ? '...bb..bb...' : i === 8 ? '...d....d...' : r));
  return [sit, sit2, run, run2].map((rows) => { const [c, ctx] = makeCanvas(14, 12); grid(ctx, rows, DOG, 1, 1); outline(c, 'ink'); return c; });
}

export function glintFrames() {
  return [0, 1, 2, 3].map((f) => {
    const [c, ctx] = makeCanvas(9, 9);
    const r = [1, 2, 3, 2][f];
    px(ctx, 4, 4, 'white');
    for (let i = 1; i <= r; i++) { px(ctx, 4 - i, 4, i === r ? 'goldL' : 'white'); px(ctx, 4 + i, 4, i === r ? 'goldL' : 'white'); px(ctx, 4, 4 - i, i === r ? 'goldL' : 'white'); px(ctx, 4, 4 + i, i === r ? 'goldL' : 'white'); }
    return c;
  });
}

export function bell(rung = false) {
  const [c, ctx] = makeCanvas(14, 20);
  grid(ctx, [
    '..dkkkkkkd....',
    '..k......k....',
    '..k..gg..k....',
    '..k.gGGg.k....',
    '..k.GGGG.k....',
    '..kgGGGGgk....',
    '..kGGYGGGk....',
    '..gGGGGGGg....',
    '..GGGGGGGG....',
    '...ggGGgg.....',
    '.....dd.......',
    '..k......k....',
    '..k......k....',
    '..k......k....',
    '..k......k....',
    '.kkk....kkk...',
  ].map((r) => (rung ? r.replace(/Y/g, 'W') : r)), { d: 'woodD', k: 'wood', G: 'gold', g: 'hairBlD', Y: 'goldL', W: 'white' }, 0, 2);
  outline(c, 'ink');
  return c;
}

export function cartFrames() {
  const rows = (wheel) => [
    '..................',
    '....ccbbcc........',
    '...cCCbbCCc.......',
    '...bbbbbbbbb......',
    '..wWWWWWWWWWw.....',
    '..wWWWWWWWWWwmm...',
    '..wwwwwwwwwww.mm..',
    `...${wheel}......${wheel}......`,
    '..dsd......dsd....',
    '...d........d.....',
  ];
  return ['s', 'S'].map((wh) => { const [c, ctx] = makeCanvas(20, 13); grid(ctx, rows(wh), { c: 'sand', C: 'dirtL', b: 'leatherD', w: 'woodD', W: 'wood', m: 'woodD', d: 'woodD', s: 'stone', S: 'mist' }, 1, 1); outline(c, 'ink'); return c; });
}

export function noticeBoard() {
  const [c, ctx] = makeCanvas(20, 22);
  grid(ctx, [
    'dwwwwwwwwwwwwwwwd',
    'dWWWWWWWWWWWWWWWd',
    'dWbbbWWwwwWbbWWWd',
    'dWbsbWWwswWbsbWWd',
    'dWbbbWWwwwWbbbWWd',
    'dWWWWbbbWWWWWWWWd',
    'dWWWWbsbWWbbbbWWd',
    'dWWWWbbbWWbssbWWd',
    'dWWWWWWWWWbbbbWWd',
    'dddddddddddddddd.',
    '..d..........d...',
    '..d..........d...',
    '..d..........d...',
    '..d..........d...',
    '.ddd........ddd..',
  ], { d: 'woodD', W: 'wood', w: 'bone', b: 'sand', s: 'dirtD' }, 1, 3);
  outline(c, 'ink');
  return c;
}

// small "!" / "?" bubble over quest givers
export function questMark(ch = '!') {
  const [c, ctx] = makeCanvas(9, 11);
  grid(ctx, ['.ggggg.', 'gGGGGGg', 'gGGkGGg', 'gGGkGGg', 'gGGkGGg', 'gGGGGGg', 'gGGkGGg', '.ggggg.', '...g...'].map((r) => (ch === '?' ? r.replace(/(gGGkGGg)/, 'gGkkkGg') : r)), { g: 'hairBlD', G: 'goldL', k: 'ink' }, 1, 1);
  outline(c, 'ink');
  return c;
}

// open-air forge for Greta: hearth with embers and an anvil
export function forge() {
  const [c, ctx] = makeCanvas(26, 22);
  grid(ctx, [
    '..ssssssss..............',
    '.sSSSSSSSSs.............',
    '.sSffFFffSs.............',
    '.sSfFWWFfSs.............',
    '.sSSFFFFSSs.....kkkkkk..',
    '.sSSSSSSSSs....kKKKKKKk.',
    '.ssssssssss.....kkKKkk..',
    '................dkKKkd..',
    '.................dKKd...',
    '................dddddd..',
  ], { s: 'slate', S: 'stone', f: 'fire', F: 'fireL', W: 'goldL', k: 'steelD', K: 'steel', d: 'night' }, 1, 9);
  outline(c, 'ink');
  return c;
}

// Shrine: a small standing stone with a rune that glows until claimed.
export function shrine(lit = true) {
  const [c, ctx] = makeCanvas(18, 26);
  grid(ctx, [
    '....ssss....',
    '...sSSSSs...',
    '..sSSSSSSs..',
    '..sSSRRSSs..',
    '..sSRSSRSs..',
    '..sSSRRSSs..',
    '..sSSRSSSs..',
    '..sSSRRSSs..',
    '..sSSSSSSs..',
    '.ssSSSSSSss.',
    'sSSSSSSSSSSs',
    'ssssssssssss',
  ].map((r) => (lit ? r : r.replace(/R/g, 'S'))), { s: 'slate', S: 'stone', R: 'crystalL' }, 3, 10);
  outline(c, 'ink');
  return c;
}

// Lookout tower: a tall timber watch platform with a ladder.
// Lookout watchtower: four braced stilts, a ladder up the front, a platform
// wide enough for the party, a railing and a pennant. The front railing is a
// separate texture drawn over the heroes standing on the platform.
const TW = 52, TH = 90;
function towerPal() { return { d: PAL.woodD, w: PAL.wood, l: PAL.woodL, ink: PAL.ink, r: PAL.red, R: PAL.redL }; }
export function lookout() {
  const [c, ctx] = makeCanvas(TW, TH);
  const P = towerPal();
  const R = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const line = (col, x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(col, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); };
  // back stilts (shaded) and their bracing
  R(P.d, 10, 34, 2, 52); R(P.d, 40, 34, 2, 52);
  line(P.d, 11, 44, 40, 64); line(P.d, 40, 44, 11, 64);
  // pennant pole at the back corner
  R(P.d, 46, 2, 1, 22); R(P.r, 47, 3, 6, 3); R(P.R, 47, 3, 4, 1); R(P.r, 47, 6, 3, 1);
  // back railing
  R(P.d, 3, 18, 46, 2); R(P.w, 3, 18, 46, 1);
  for (const x of [3, 15, 26, 37, 48]) R(P.d, x, 18, 2, 13);
  // platform deck (planks) with a darker front edge
  R(P.w, 1, 30, 50, 7);
  for (let x = 1; x < 51; x += 6) R(P.d, x, 30, 1, 7);
  R(P.l, 1, 30, 50, 1);
  R(P.d, 1, 36, 50, 3);
  // front stilts with highlights
  for (const x of [5, 45]) { R(P.d, x, 38, 3, 52); R(P.l, x, 38, 1, 52); }
  line(P.w, 7, 50, 45, 72); line(P.w, 45, 50, 7, 72);
  line(P.w, 7, 72, 45, 88); line(P.w, 45, 72, 7, 88);
  // ladder up the middle, rungs every 5px
  R(P.d, 21, 33, 2, 57); R(P.d, 30, 33, 2, 57);
  R(P.l, 21, 33, 1, 57); R(P.l, 30, 33, 1, 57);
  for (let y = 38; y < 90; y += 5) R(P.l, 22, y, 9, 1);
  outline(c, 'ink');
  return c;
}
export function lookoutFront() {
  const [c, ctx] = makeCanvas(TW, TH);
  const P = towerPal();
  const R = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  // front railing at the deck's lip, with a gap where the ladder comes up
  for (const [x0, x1] of [[1, 21], [32, 51]]) { R(P.d, x0, 24, x1 - x0, 2); R(P.l, x0, 24, x1 - x0, 1); }
  for (const x of [1, 11, 19, 32, 40, 49]) R(P.d, x, 24, 2, 12);
  outline(c, 'ink');
  return c;
}

// Kestrel, Wren's hawk: two wing frames, seen from above
export function hawkFrames() {
  return [
    ['ss.......ss', '.sS.....Ss.', '..sSSdSSs..', '...sSKSs...', '....sSs....', '.....s.....'],
    ['...........', 'sss.....sss', '.sSSSdSSSs.', '...sSKSs...', '....sSs....', '.....s.....'],
  ].map((rows) => { const [c, ctx] = makeCanvas(13, 9); grid(ctx, rows, { s: 'woodD', S: 'wood', d: 'bone', K: 'goldL' }, 1, 1); outline(c, 'ink'); return c; });
}

// snare trap for Wren
export function snareTrap() {
  const [c, ctx] = makeCanvas(14, 9);
  grid(ctx, ['.kkkkkkkk.', 'k.K.KK.K.k', 'kKKKKKKKKk', 'k.K.KK.K.k', '.kkkkkkkk.'], { k: 'steelD', K: 'steel' }, 2, 2);
  outline(c, 'ink');
  return c;
}

// iron cage (Kesh in the pit) and a hunter's net (Wren)
export function cage() {
  const [c, ctx] = makeCanvas(24, 30);
  for (let x = 2; x <= 20; x += 3) px(ctx, x, 3, 'steelD', 1, 24);
  px(ctx, 1, 2, 'steel', 21, 2); px(ctx, 1, 26, 'steel', 21, 2);
  outline(c, 'ink');
  return c;
}
export function net() {
  const [c, ctx] = makeCanvas(24, 18);
  for (let y = 2; y < 16; y += 3) for (let x = 1; x < 23; x++) if ((x + y) % 3) px(ctx, x, y, 'sand');
  for (let x = 2; x < 22; x += 3) for (let y = 1; y < 16; y++) px(ctx, x, y, 'dirtL');
  return c;
}

// A stairwell going down: stone rim, steps that sink into darkness.
export function stairsDown() {
  const [c, ctx] = makeCanvas(30, 28);
  // rim
  px(ctx, 1, 2, 'slate', 28, 24); px(ctx, 2, 3, 'stone', 26, 22);
  // the shaft: each step a little lower, narrower and darker
  const steps = ['bone', 'mist', 'stone', 'slate', 'night', 'ink', 'ink'];
  steps.forEach((col, i) => {
    const y = 5 + i * 3, inset = 4 + Math.floor(i / 2);
    px(ctx, inset, y, col, 30 - inset * 2, 3);
    if (i < 4) px(ctx, inset, y + 2, 'night', 30 - inset * 2, 1); // step edge shadow
  });
  // side walls of the shaft
  for (let y = 5; y < 26; y++) { const i = Math.floor((y - 5) / 3), inset = 4 + Math.floor(i / 2); px(ctx, inset - 1, y, 'night'); px(ctx, 30 - inset, y, 'night'); }
  // lintel stones on the rim
  px(ctx, 1, 1, 'mist', 28, 2); px(ctx, 1, 1, 'bone', 28, 1);
  outline(c, 'ink');
  return c;
}

// A loose lore page: a curled sheet of parchment with a few lines of ink.
export function lorePage() {
  const [c, ctx] = makeCanvas(12, 12);
  const R = (col, x, y, w, h) => { ctx.fillStyle = PAL[col] || col; ctx.fillRect(x, y, w, h); };
  R('bone', 2, 2, 8, 9); R('sand', 2, 9, 8, 2); R('white', 3, 2, 6, 1);
  for (const y of [4, 6, 8]) R('woodD', 3, y, y === 8 ? 4 : 6, 1);
  R('redD', 8, 1, 2, 2); // a wax seal corner
  outline(c, 'ink');
  return c;
}
