// Small props for errands: Biscuit the dog, a glint in the shallows, the
// ruin bells, Marla's goods cart and the tavern rumour board.
import { makeCanvas, grid, outline, px } from './pixel.js';

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
