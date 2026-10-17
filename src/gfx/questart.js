// Small props for errands: Biscuit the dog, a glint in the shallows, the
// ruin bells, Marla's goods cart and the tavern rumour board.
import { makeCanvas, grid, outline, px } from './pixel.js';
import { PAL } from './palette.js';
import { shadedBlob } from './creatures.js';

// Biscuit: a scruffy brown mutt, big enough to read as a dog beside the
// heroes (a sit and a run, facing right; flip for left). Floppy ears, a white
// blaze down the chest, a red collar and a tail that never stops.
const DOGC = ['dirtD', 'dirt', 'dirtL', 'sand'];
function dogFrame({ sit = false, step = 0, wag = 0 }) {
  const [c, ctx] = makeCanvas(36, 28);
  const dot = (x, y, col, w = 1, h = 1) => px(ctx, Math.round(x), Math.round(y), col, w, h);
  const foot = 25;
  let hx, hy;
  if (sit) {
    // tail sweeping the ground behind, side to side
    for (let i = 0; i < 6; i++) dot(10 - i, foot - 1 - (wag ? i * 0.6 : 0) + (wag ? 0 : i * 0.1), i > 3 ? 'dirtL' : 'dirt', 2, 2);
    shadedBlob(ctx, 14, 19, 6, 5.5, DOGC); // haunch
    dot(10, foot - 1, 'dirtD', 5, 1); dot(10, foot, 'dirtD', 4, 1); // back paw
    shadedBlob(ctx, 19, 15, 4, 6, DOGC); // chest, upright
    for (let y = 13; y <= 20; y++) dot(20 + (y > 17 ? 0 : 1), y, y % 3 ? 'bone' : 'white', 2, 1); // the blaze
    for (const lx of [18, 21]) { dot(lx, 19, lx === 18 ? 'dirtD' : 'dirt', 2, foot - 19); dot(lx, foot, lx === 18 ? 'dirtD' : 'dirtL', 3, 1); } // front legs
    dot(18, 10, 'redD', 5, 1); dot(18, 11, 'red', 5, 1); dot(21, 12, 'goldL'); // collar and tag
    hx = 21; hy = 7;
  } else {
    const by = 15 - (step === 1 ? 1 : 0);
    // tail up and waving from the rump
    for (let i = 0; i < 6; i++) dot(8 - i * 0.6 - (wag ? i * 0.4 : 0), by - 3 - i * (wag ? 0.9 : 1.2), i > 3 ? 'dirtL' : 'dirt', 2, 2);
    // legs: far pair darker, a trotting stride
    const sw = step ? 2 : -2;
    for (const [lx, d, col] of [[11, sw, 'dirtD'], [14, -sw, 'dirt'], [23, -sw, 'dirtD'], [26, sw, 'dirt']]) {
      for (let y = by + 3; y <= foot; y++) dot(lx + (d * (y - by - 3)) / (foot - by - 3), y, col, 2, 1);
      dot(lx + d - 1, foot, 'dirtD', 3, 1);
    }
    shadedBlob(ctx, 17, by, 9, 4.5, DOGC); // body
    shadedBlob(ctx, 25, by - 1, 4, 4.5, DOGC); // chest
    for (let x = 23; x <= 27; x++) dot(x, by + 2 + (x === 25 ? 1 : 0), 'bone', 1, 1); // white chest
    dot(24, by - 5, 'redD', 2, 4); dot(26, by - 4, 'red', 1, 3); // collar
    hx = 28; hy = by - 6;
  }
  shadedBlob(ctx, hx, hy, 4.5, 4, DOGC); // head
  for (let i = 0; i < 4; i++) dot(hx + 3 + i, hy + 0.5, i < 2 ? 'dirtL' : 'sand', 1, 3); // the short muzzle
  dot(hx + 7, hy + 0.5, 'ink', 1, 2); // nose
  dot(hx + 3, hy + 3, 'dirtD', 4, 1); // jaw line
  if (!sit) dot(hx + 4, hy + 4, 'redL', 2, 2); // tongue out at a trot
  dot(hx + 1, hy - 1, 'ink', 2, 2); dot(hx + 1, hy - 1, 'white'); // eye
  // the floppy ear, hanging past the cheek
  dot(hx - 3, hy - 4, 'dirtD', 3, 1); dot(hx - 3, hy - 3, 'dirtD', 3, 3); dot(hx - 2, hy, 'dirtD', 2, 2);
  outline(c, 'ink');
  return c;
}
export function dogFrames() {
  return [dogFrame({ sit: true }), dogFrame({ sit: true, wag: 1 }), dogFrame({ step: 0 }), dogFrame({ step: 1, wag: 1 })];
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

// Marla's goods cart, pulled by its driver by two long shafts: grain sacks,
// a crate and a cloth bundle on a planked bed, spoked wheels that turn.
// Three views: 'side' (shafts point right, the way it's heading; flip for
// left), 'down' (coming toward you, shafts toward the viewer) and 'up'
// (going away, shafts up past the load). Two frames each for the wheels.
const CART = { c: 'sand', C: 'dirtL', b: 'leatherD', w: 'woodD', W: 'wood', d: 'woodD', m: 'woodD', h: 'wood', s: 'stone', S: 'mist', X: 'steel', r: 'redL', R: 'red' };
const WHEEL = [
  ['..ddd..', '.d.s.d.', 'd..s..d', 'dssXssd', 'd..s..d', '.d.s.d.', '..ddd..'],
  ['..ddd..', '.ds.sd.', 'd.s.s.d', 'd..X..d', 'd.s.s.d', '.ds.sd.', '..ddd..'],
];
export function cartFrames(view = 'side') {
  return [0, 1].map((f) => {
    if (view === 'side') {
      const [c, ctx] = makeCanvas(33, 18);
      grid(ctx, [ // the load
        '......cCc.......dddddd.......',
        '.....cCCCc.cCc..dWWWWd.......',
        '....cCCCCCcCCCc.dWddWd.rrr...',
        '....cCCbCCCCCCCcdWWWWdrRrrr..',
      ], CART, 1, 1);
      grid(ctx, [ // the bed, and the shafts reaching forward to a crossbar grip
        '..wwwwwwwwwwwwwwwwwwwwwwww.....',
        '..wWWWWWWWWWWWWWWWWWWWWWWw.....',
        '..wWdWWWWWdWWWWWWWdWWWWWWwmmmmh',
        '..wwwwwwwwwwwwwwwwwwwwwwww....h',
      ], CART, 1, 5);
      grid(ctx, WHEEL[f], CART, 7, 9);
      grid(ctx, ['d', 'd', 'd', 'd'], CART, 23, 9); // the rest leg at the front
      outline(c, 'ink');
      return c;
    }
    const [c, ctx] = makeCanvas(24, 18);
    const tread = f ? ['kk', 'Sk', 'kS', 'Sk', 'kk'] : ['kk', 'kS', 'Sk', 'kS', 'kk'];
    const wl = tread.map((r) => r.replace(/k/g, 'd')), wr = tread.map((r) => [...r].reverse().join('').replace(/k/g, 'd'));
    if (view === 'down') {
      grid(ctx, [
        '......cCCc.dddd......',
        '.....cCCCCcdWWdrr....',
        '....cCCbCCCdWWdrRr...',
        '...wwwwwwwwwwwwwwww..',
        '...wWWWWWWWWWWWWWWw..',
        '...wWdWWWWWWWWdWWWw..',
        '...wwwwwwwwwwwwwwww..',
        '........m....m.......',
        '........m....m.......',
        '........m....m.......',
        '........mhhhhm.......',
      ], CART, 1, 1);
      grid(ctx, wl, CART, 1, 5); grid(ctx, wr, CART, 20, 5);
    } else {
      grid(ctx, [
        '........mhhhhm.......',
        '........m....m.......',
        '......cCm..dWm.......',
        '.....cCCmCcdWmdrr....',
        '....cCCCCCCdWWdrRr...',
        '...wwwwwwwwwwwwwwww..',
        '...wWWWWWWWWWWWWWWw..',
        '...wWdWWWWWWWWdWWWw..',
        '...wwwwwwwwwwwwwwww..',
      ], CART, 1, 1);
      grid(ctx, wl, CART, 1, 6); grid(ctx, wr, CART, 20, 6);
    }
    outline(c, 'ink');
    return c;
  });
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

// The hermit's rune stones: a squat standing stone with a carved glyph that
// glows once it's been touched in the right order.
const GLYPHS = {
  eye: ['.GGG.', 'G.g.G', '.GGG.'],
  sun: ['G.G.G', '.GgG.', 'G.G.G'],
  moon: ['.GG..', 'G....', '.GG..'],
  star: ['..G..', 'GGgGG', '..G..'],
};
export function runeStone(glyph, lit = false) {
  const [c, ctx] = makeCanvas(14, 20);
  grid(ctx, [
    '...ssssss.....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '..sSSSSSSs....',
    '.ssSSSSSSss...',
    'ddddddddddd...',
  ], { s: 'slate', S: 'stone', d: 'leafD' }, 0, 8);
  grid(ctx, GLYPHS[glyph], { G: lit ? 'crystalL' : 'night', g: lit ? 'white' : 'slate' }, 3, 11);
  outline(c, 'ink');
  return c;
}
