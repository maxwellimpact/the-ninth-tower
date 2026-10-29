// Big bosses drawn the cast's way (2026-10-28): hand-authored pixel grids for
// each part in each view (head, ears, torso, kilt, legs), the way the goblin
// and hero puppets are, only bigger, posed per frame and outlined in ink.
// Flat clusters of two or three tones lit from the upper left, no dithered
// gradients: the 3D modeler's renders (bosses.js) read as forced next to the
// cast. Limbs that cross the body (arms, weapons) are drawn on their own
// layer and outlined there first, so a green arm still reads over a green
// chest. Frames come out in the puppets' shape ({ anim: { view: [canvas] } }:
// idle, walk, attack, cast, hurt) for bake.js registerBigPuppet.
import { makeCanvas, grid, px, outline } from './pixel.js';

const VIEWS = ['down', 'up', 'side'];
const L2 = (() => { const n = Math.hypot(-0.8, -0.6); return [-0.8 / n, -0.6 / n]; })(); // toward the light: upper left

// a frame W x H whose drawing is shifted right by ox (a figure laid out for a
// narrower frame, centred in a wider one so a long weapon fits)
function frame(W, H, ox = 0) {
  const [c, ctx] = makeCanvas(W, H);
  ctx.translate(ox, 0);
  return [c, ctx];
}
// a part drawn on its own canvas and outlined there, then laid on the frame
function layer(ctx, W, H, draw) {
  const [c, g] = makeCanvas(W, H);
  g.setTransform(ctx.getTransform());
  draw(g);
  outline(c, 'ink');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, 0, 0); ctx.restore();
}

// a part on its own layer edged in a dark tone of its own (not ink), so it
// reads where it crosses the body in the same colour, with no edge near
// `joins` (where it grows out of the body: a line there reads as a cut-out)
function layerSoft(ctx, W, H, tone, joins, draw) {
  const [c, g] = makeCanvas(W, H);
  g.setTransform(ctx.getTransform());
  draw(g);
  const [e, eg] = makeCanvas(W, H);
  eg.drawImage(c, 0, 0);
  outline(e, tone);
  const t = ctx.getTransform(), img = eg.getImageData(0, 0, W, H), src = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    if (src.data[k + 3] || !img.data[k + 3]) continue; // only the new edge pixels
    if (joins.some(([jx, jy]) => Math.hypot(x - (jx + t.e), y - (jy + t.f)) < 4.5)) img.data[k + 3] = 0;
  }
  eg.putImageData(img, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e, 0, 0); ctx.restore();
}

// a limb as a shaded cylinder from a to b, radius r0 to r1: light, mid and
// dark bands across it by which side faces the light; `bands` recolour
// stretches of it (bracers, cuffs, sleeves) as [t0, t1, [light, mid, dark]]
function limb(ctx, [ax, ay], [bx, by], r0, r1, tones, bands = []) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(ay, by) - R); y <= Math.ceil(Math.max(ay, by) + R); y++) for (let x = Math.floor(Math.min(ax, bx) - R); x <= Math.ceil(Math.max(ax, bx) + R); x++) {
    const px0 = x + 0.5 - ax, py0 = y + 0.5 - ay, t = Math.max(0, Math.min(1, (px0 * dx + py0 * dy) / (L * L)));
    const ox = px0 - dx * t, oy = py0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.hypot(ox, oy);
    if (d > r) continue;
    const lam = (ox * L2[0] + oy * L2[1]) / r;
    let tn = tones;
    for (const [t0, t1, tt] of bands) if (t >= t0 && t <= t1) tn = tt;
    px(ctx, x, y, lam > 0.3 ? tn[0] : lam < -0.35 ? tn[2] : tn[1]);
  }
}

// rows of a grid, checked: every row the width of the first (a ragged grid
// shifts its own silhouette a pixel)
export function rows(name, r) {
  if (r.some((s) => s.length !== r[0].length)) throw new Error(`${name}: rows of ${[...new Set(r.map((s) => s.length))].join('/')} px`);
  return r;
}

// a frame's builder over a part table: put(part, x, y) paints a grid at its
// top-left; the views place their parts and the poses move them
function cycle(build, attack, hurt, views, cast = null) {
  const out = { idle: {}, walk: {}, attack: {}, cast: {}, hurt: {} };
  for (const v of views) {
    out.idle[v] = [build(v, {}), build(v, { bob: 1 })];
    out.walk[v] = [0, 1, 2, 3].map((f) => build(v, { step: [1, 0, -1, 0][f], bob: f % 2 ? 0 : 1 }));
    out.attack[v] = attack[v].map((p) => build(v, p));
    out.cast[v] = (cast || attack)[v].map((p) => build(v, p));
    out.hurt[v] = [build(v, hurt)];
  }
  return out;
}

// ------------------------------------------------------------------ Snagtooth
// The Vale's bounty: a goblin grown huge and hunched, keeping what says
// goblin (green skin, long ears out to the sides, yellow eyes, a leather
// hood, a spear), with his own marks: one great tusk up past his lip, red war
// paint under the eyes, a necklace of teeth, a strap across the chest, a hide
// kilt with a ragged hem and a branch for a spear with a rusted blade and red
// feathers. 64x64, the feet on y 48 (the units' 3/4 line).
const SNAG_MAP = {
  X: 'grassXL', L: 'grassL', G: 'grass', g: 'grassD', d: 'leafD',
  H: 'leather', h: 'leatherD', j: 'stone',
  Y: 'gold', y: 'goldL', E: 'ink', w: 'white', b: 'bone', r: 'red',
  D: 'dirt', T: 'dirtD', t: 'woodD', m: 'mudD',
};
export const SNAG = {
  head: {
    down: rows('snag head down', [
      '...hhhhhhhh...',
      '.hhHHHHHHHHhh.',
      'hHHjjHHHHHHHHh',
      'hHjHHHHHHHHHHh',
      'hhhhhhhhhhhhhh',
      'LXGGGGGGGGGGGg',
      'LGdGGGGGGGGdGg',
      'LGGddGGGGddGGg',
      'GGEYyGGGGyYEGg',
      'GrGGGGLgGGGGrg',
      'GrGGGLLggGGGrg',
      'GGGGwGggGGGGgg',
      'gGEEwEEEEEEEgg',
      '.gGGbGGGGGGgd.',
      '..gGGGGGGGgd..',
      '...dddddddd...',
    ]),
    side: rows('snag head side', [
      '...hhhhhhh........',
      '..hHHHHHHHhh......',
      '.hHjjHHHHHHHh.....',
      '.hHjHHHHHHHHHh....',
      '.hhhhhhhhhhhhh....',
      '..gGGGGGGLGGGg....',
      '..gGGGGGGGLddG....',
      '..gGGGGGGGGEYyG...',
      '..gGGGGGGGGGGGLL..',
      '..ggGGGGGGrGGGGLLg',
      '..ggGGGGGGrGGGGGgg',
      '...gGGGGGGGGGGwGg.',
      '...gGGGGGGGGEEwEE.',
      '....gGGGGGGGGGbGd.',
      '.....ggGGGGGGGgd..',
      '.......ddddddd....',
    ]),
    up: rows('snag head up', [
      '...hhhhhhhh...',
      '.hhHHHHHHHHhh.',
      'hHHjjHHHHHHHHh',
      'hHjHHHHHHHHHHh',
      'hHHHHHHhHHHHhh',
      'hHHHHHHhHHHHhh',
      '.hHHHHHhHHHhh.',
      '..hhhhhhhhhh..',
      '.LGGGGGGGGGGg.',
      '.LGGGGGGGGGgg.',
      '.gGGGGGGGGGgg.',
      '..gGGGGGGGgg..',
      '...gggggggg...',
    ]),
  },
  // long ears, out to the sides and a little up: the screen-left one lit
  earL: rows('snag ear L', ['LL.......', 'XLLL.....', 'gGLLLGGG.', '.ggGGGGGG', '...gggGGG']),
  earR: rows('snag ear R', ['.......gg', '.....GGGg', '.GGGGGGgd', 'GGGGGGgd.', 'GGGgdd...']),
  earSide: rows('snag ear side', ['LL......', '.XLLL...', '..gGGLGG', '....ggGG']),
  torso: {
    down: rows('snag torso down', [
      '...XLLGGg......gGGGgg...',
      '..XLGGGGGGGGGGGGGGGGGgg.',
      '.XLGGGGGGGGGGGGGGGGGGGgg',
      '.LGGGLLLGGGGgGGGGGGGGGgg',
      '.LGGLLGGGGGGgGGLLGGGGGgg',
      '.GGGGGGGGGGgGgGGGGGGGgg.',
      '..gGGgggggggdggggGGGgg..',
      '..gGGGLLGGGGGGGGGGGGgg..',
      '...GGLGGGGGGGGGGGGGGg...',
      '...gGGGGGGGGGGGGGGGgg...',
      '....gGGGGGGGGGGGGGgg....',
      '....hHHHHHHYYYHHHHHh....',
      '....hhhhhhhYyYhhhhhh....',
    ]),
    side: rows('snag torso side', [
      '...LGGGGg.......',
      '.LLGGGGGGGg.....',
      'LLGGGGGGGGGg....',
      'LGGGGGGGGGGGg...',
      'GGGGGGGGGGGGGg..',
      'GGGGGGGGGGLGGg..',
      'gGGGGGGGGLGGGGg.',
      'gGGGGGGGGGGGGGg.',
      '.gGGGGGGGGGGGGg.',
      '.gGGGGGGGGGGGgg.',
      '..ggGGGGGGGGgg..',
      '..hHHHHHHHHHHYh.',
      '..hhhhhhhhhhhYh.',
    ]),
    up: rows('snag torso up', [
      '...XLLGGg......gGGGgg...',
      '..XLGGGGGGGGGGGGGGGGGgg.',
      '.XLGGGGGGGGGGGGGGGGGGGgg',
      '.LGGGLLGGGGGgGGGGGGGGGgg',
      '.LGGLGGGGGGGgGGGGGGGGGgg',
      '.GGGgGGGGGGGgGGGGGgGGgg.',
      '..gGGgGGGGGGgGGGGGgGGgg.',
      '..gGGGggGGGGgGGGGggGGgg.',
      '...GGGGGGGGGgGGGGGGGGg..',
      '...gGGGGGGGGgGGGGGGGgg..',
      '....gGGGGGGGGGGGGGGgg...',
      '....hHHHHHHHHHHHHHHh....',
      '....hhhhhhhhhhhhhhhh....',
    ]),
  },
  kilt: {
    down: rows('snag kilt down', [
      '.DDDDTTTTTTTTTTTTTTTt.',
      '.DTTTTTTTTTTTtTTTTTTt.',
      '.DTTTtTTTTTTTtTTTTTtt.',
      '..TTTtTTTTTmTtTTTTTt..',
      '..TtTmTTtTTmTtTTtTtt..',
      '...m.mTm.tm..mtT.mm...',
    ]),
    side: rows('snag kilt side', [
      '.DDTTTTTTTTTTTt.',
      '.DTTTTTtTTTTTTt.',
      '.DTTtTTtTTTTTtt.',
      '..TTtTTmTTtTTt..',
      '..TtmTTmTtTTtt..',
      '...m.mTm.tm.m...',
    ]),
  },
  legs: {
    downL: rows('snag leg L', ['.LGGGg.', '.LGGGg.', '.GGGGg.', '.mDDTm.', '.LGGGg.', '.mDDTm.', '.GGGGg.', 'LGGGGGg', 'gbGbGbd']),
    downR: rows('snag leg R', ['.GGGgd.', '.GGGgd.', '.GGggd.', '.mDTtm.', '.GGGgd.', '.mDTtm.', '.GGggd.', 'GGGGggd', 'gbGbgbd']),
    upL: rows('snag heel L', ['.LGGGg.', '.LGGGg.', '.GGGGg.', '.mDDTm.', '.LGGGg.', '.mDDTm.', '.GGGGg.', '.GGGGg.', '.gGGgd.']),
    upR: rows('snag heel R', ['.GGGgd.', '.GGGgd.', '.GGggd.', '.mDTtm.', '.GGGgd.', '.mDTtm.', '.GGggd.', '.GGGgd.', '.gGggd.']),
    side: rows('snag leg side', ['.GGGg..', '.GGGg..', '.GGgg..', '.mDTm..', '.GGGg..', '.mDTm..', '.GGGgg.', 'LGGGGGg', 'gGGGbGb']),
  },
  fist: rows('snag fist', ['.LGg.', 'LGGGg', 'GbGbg', 'gGGgd', '.ggd.']),
  // a hide pauldron with bone spikes on the off shoulder: his silhouette isn't a goblin's mirrored
  pauldron: rows('snag pauldron', ['..b.b..', '.bDbDT.', 'TDDDDTt', 'tTTTTtm', '.m.m.m.']),
};
const SKIN = ['grassL', 'grass', 'grassD'];
const BRACER = ['leather', 'leather', 'leatherD'];

// the branch spear: a crooked shaft through the fist, a leather binding, a
// rusted leaf blade, two red feathers hanging from the binding
function snagSpear(g, [hx, hy], ang, len = 40, back = 0.34) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c; // along, and across
  const lit = nx * L2[0] + ny * L2[1] > 0 ? 1 : -1; // which side of the shaft faces the light
  const a0 = -len * back, a1 = len * (1 - back);
  for (let t = a0; t <= a1; t += 0.5) {
    const bend = Math.sin((t - a0) * 0.16) * 0.6; // a branch, not a turned pole
    for (const k of [0, 1]) {
      const o = k * -lit + bend, X = Math.round(hx + c * t + nx * o - 0.5), Y = Math.round(hy + s * t + ny * o - 0.5);
      px(g, X, Y, k ? 'woodD' : Math.round(t) % 11 === 3 ? 'woodL' : 'wood');
    }
  }
  const tip = (t, o = 0) => [Math.round(hx + c * t + nx * o - 0.5), Math.round(hy + s * t + ny * o - 0.5)];
  for (const t of [a1 - 1, a1]) for (const o of [-1, 0, 1]) { const [X, Y] = tip(t, o); px(g, X, Y, o === lit ? 'leather' : 'leatherD'); } // the binding
  const W = [1, 1.5, 2, 2, 1.5, 1.5, 1, 1, 0.5]; // the blade's half-widths, base to point
  W.forEach((w, i) => {
    for (let o = -w; o <= w + 0.01; o += 0.5) {
      const [X, Y] = tip(a1 + 1 + i, o), rust = (i === 1 && o < 0) || (i === 3 && o > 0.6);
      px(g, X, Y, rust ? 'dirtD' : i === W.length - 1 ? 'white' : Math.sign(o) === lit ? 'steelL' : Math.abs(o) >= w - 0.01 ? 'steelD' : 'steel');
    }
  });
  for (const [o, col] of [[1.6, 'red'], [-1.6, 'redL']]) { const [X, Y] = tip(a1 - 1, o * lit); for (let k = 0; k < 4; k++) px(g, X + (k > 1 ? Math.sign(o) : 0), Y + 1 + k, k === 3 ? 'redD' : col); } // feathers, hanging
}

// pose: bob, step (-1..1), hand (the spear hand), ang (the spear's angle),
// reach (the spear's drawn length: shorter when it points at or away from the
// camera), crouch, eye. Laid out for a 64 frame, centred in an 80 one.
function snagtooth(view, { bob = 0, step = 0, hand = null, ang = null, reach = 40, crouch = 0, eye = null, lunge = 0 } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), S = SNAG, M = SNAG_MAP;
  const by = bob + crouch, put = (r, x, y, m = M) => grid(ctx, r, m, x, y);
  const eyeMap = eye ? { ...M, Y: eye, y: eye } : M;
  if (view === 'side') {
    const st = step * 3, lift = (k) => (k > 0 ? 2 : 0);
    const sh = [31 + lunge, 24 + by], hd = hand || [36 + lunge, 36 + by], a = ang ?? -0.42; // the spear held low and forward, ready, clear of his face
    const fsh = [35 + lunge, 23 + by], fh = [37 + lunge - step * 2, 36 + by];
    layer(ctx, W, H, (g) => { limb(g, fsh, [fsh[0] + 1, fsh[1] + 6], 3, 2.6, ['grass', 'grassD', 'leafD']); limb(g, [fsh[0] + 1, fsh[1] + 6], fh, 2.6, 2.2, ['grass', 'grassD', 'leafD'], [[0.55, 0.8, ['leather', 'leatherD', 'leatherD']]]); }); // the far arm, behind
    put(S.legs.side, 25 - st, 40 - lift(-step), { ...M, G: 'grassD', L: 'grass', g: 'leafD' }); // the far leg, in shadow
    put(S.legs.side, 29 + st, 40 - lift(step));
    put(S.kilt.side, 23 + lunge, 34 + by);
    put(S.torso.side, 22 + lunge, 21 + by);
    for (let i = 0; i < 9; i++) px(ctx, 25 + lunge + i, 22 + by + Math.round(i * 1.15), i % 3 === 0 ? 'leatherD' : 'leather'); // the strap over his shoulder
    layer(ctx, W, H, (g) => grid(g, S.head.side, eyeMap, 26 + lunge, 10 + by));
    layer(ctx, W, H, (g) => grid(g, S.earSide, M, 22 + lunge, 15 + by));
    layer(ctx, W, H, (g) => snagSpear(g, hd, a, reach));
    layer(ctx, W, H, (g) => { const el = [sh[0] - 1, (sh[1] + hd[1]) / 2 + 1]; limb(g, sh, el, 3.4, 3, SKIN); limb(g, el, hd, 3, 2.6, SKIN, [[0.5, 0.78, BRACER]]); grid(g, S.fist, M, hd[0] - 2, hd[1] - 2); });
    outline(c, 'ink');
    return c;
  }
  const up = view === 'up';
  const lift = [step > 0 ? 2 : 0, step < 0 ? 2 : 0];
  // the spear hand: screen-left facing you, screen-right facing away
  const sh = up ? [40, 24 + by] : [24, 24 + by], hd = hand || (up ? [43, 37 + by] : [21, 37 + by]), a = ang ?? -1.57;
  const osh = up ? [24, 24 + by] : [40, 24 + by], oh = up ? [21, 37 + by - step] : [43, 37 + by + step];
  if (up) layer(ctx, W, H, (g) => snagSpear(g, hd, a, reach)); // facing away, the spear is beyond him
  put(up ? S.legs.upL : S.legs.downL, 23, 40 - lift[0]);
  put(up ? S.legs.upR : S.legs.downR, 34, 40 - lift[1]);
  put(S.kilt.down, 21, 34 + by);
  put(up ? S.torso.up : S.torso.down, 20, 21 + by);
  if (!up) for (let i = 0; i < 17; i++) px(ctx, 22 + i, 23 + by + Math.round(i * 0.6), 'leather'), px(ctx, 22 + i, 24 + by + Math.round(i * 0.6), 'leatherD'); // the strap across his chest
  else for (let i = 0; i < 17; i++) px(ctx, 41 - i, 23 + by + Math.round(i * 0.6), 'leather'), px(ctx, 41 - i, 24 + by + Math.round(i * 0.6), 'leatherD');
  if (up) for (let y = 27; y < 32; y++) px(ctx, 32, y + by, 'grassD'); // the spine
  layer(ctx, W, H, (g) => grid(g, up ? S.head.up : S.head.down, eyeMap, 25, (up ? 12 : 10) + by)); // outlined on its own, so the jaw reads over the chest
  if (!up) for (let i = 0; i < 7; i++) { const x = 27 + i * 2, y = 26 + by + (i === 0 || i === 6 ? 0 : i === 1 || i === 5 ? 1 : 2); px(ctx, x, y, 'leatherD'); px(ctx, x + 1, y, i % 2 ? 'white' : 'bone'); px(ctx, x + 1, y + 1, 'bone'); } // a necklace of teeth
  layer(ctx, W, H, (g) => { grid(g, S.earL, M, 17, 15 + by); grid(g, S.earR, M, 38, 15 + by); });
  const arm = (g, s, h, tones) => { const el = [s[0] + (s[0] < 32 ? -2 : 2), (s[1] + h[1]) / 2]; limb(g, s, el, 3.4, 3, tones); limb(g, el, h, 3, 2.6, tones, [[0.5, 0.78, BRACER]]); grid(g, S.fist, M, h[0] - 2, h[1] - 2); };
  layer(ctx, W, H, (g) => arm(g, osh, oh, SKIN));
  if (!up) layer(ctx, W, H, (g) => snagSpear(g, hd, a, reach));
  layer(ctx, W, H, (g) => arm(g, sh, hd, SKIN));
  layer(ctx, W, H, (g) => grid(g, S.pauldron, M, osh[0] - 3, osh[1] - 4));
  outline(c, 'ink');
  return c;
}

// the thrust: drawn back, driven out, recovering (the windup holds the first)
const SNAG_THRUST = {
  down: [{ hand: [22, 27], ang: 1.75, reach: 26, crouch: 1 }, { hand: [24, 36], ang: 1.62, reach: 22 }, { hand: [22, 32], ang: 1.7, reach: 24 }],
  up: [{ hand: [42, 36], ang: -1.57, reach: 30, crouch: 1 }, { hand: [41, 27], ang: -1.6, reach: 26 }, { hand: [42, 31], ang: -1.57, reach: 28 }],
  side: [{ hand: [27, 31], ang: -0.05, reach: 36, crouch: 1 }, { hand: [38, 32], ang: 0.02, reach: 36, lunge: 2 }, { hand: [34, 32], ang: 0, reach: 36 }],
};

// rows given as "offset:pixels|offset:pixels", padded out to the width w:
// for big shapes where most of each row is empty or the counting is the hard part
export function rowsAt(name, w, list) {
  return rows(name, list.map((line) => {
    const r = Array(w).fill('.');
    for (const seg of line.split('|')) { if (!seg) continue; const i = seg.indexOf(':'), o = +seg.slice(0, i), s = seg.slice(i + 1); if (o + s.length > w) throw new Error(`${name}: "${line}" runs past ${w}`); for (let k = 0; k < s.length; k++) if (s[k] !== '.') r[o + k] = s[k]; }
    return r.join('');
  }));
}

// -------------------------------------------------------------------- Malgrim
// Malgrim the Unkind: a tall, gaunt sorcerer. A crooked pointed hat with the
// hex's runes glowing round its band, a pale face with the curse burning in
// deep-set eyes, a hooked nose and a long iron-grey beard, a stiff high collar
// standing up behind his head, a long violet coat with a hex buckle, folds and
// a hem stitched with glowing runes, the hex's sigil across his back, bell
// sleeves, long bony hands, and a black staff with the hex caught in claws at
// its head. 72x72, the feet on y 54 (the units' 3/4 line).
const MAL_MAP = {
  P: 'purp', p: 'purpD', x: 'hexD', n: 'night', c: 'curse', C: 'curseL', E: 'ink', r: 'redD', R: 'red',
  f: 'bone', F: 'white', v: 'mist', d: 'slate', g: 'stone', G: 'mist',
};
export const MAL = {
  hat: {
    down: rowsAt('mal hat down', 22, ['14:xx', '13:pxx', '12:ppx', '11:ppxx', '10:pPpx', '9:pPppx', '9:Pppxx', '8:pPppxx', '8:Ppppxx', '7:pPpppxxx', '7:Ppppppxx', '6:pPpppppxxx', '6:Ppppppppxx', '5:xcxCxcxcxCxx', '5:xxxxxxxxxxxx', '2:xpPPPpppppppppxxx', '0:xpPPpppppppppppppxxxx', '1:xxxxxxxxxxxxxxxxxxx']),
    up: rowsAt('mal hat up', 22, ['6:px', '6:ppx', '7:ppx', '7:pPpx', '8:Pppx', '8:pPppx', '8:Pppxx', '8:pPppxx', '8:Ppppxx', '7:pPpppxxx', '7:Ppppppxx', '6:pPpppppxxx', '6:Ppppppppxx', '5:xcxCxcxcxCxx', '5:xxxxxxxxxxxx', '2:xpPPPpppppppppxxx', '0:xpPPpppppppppppppxxxx', '1:xxxxxxxxxxxxxxxxxxx']),
    side: rowsAt('mal hat side', 24, ['3:xx', '3:pxx', '4:ppx', '4:pPpx', '5:pPpx', '5:Pppxx', '6:pPppx', '6:Ppppxx', '7:pPppxx', '7:Ppppxxx', '7:pPpppxxx', '7:Ppppppxx', '6:xcxCxcxCxx', '6:xxxxxxxxxx', '1:xpPPPpppppppppppxxx', '0:xpPPppppppppppppppxxxx', '1:xxxxxxxxxxxxxxxxxxxxx']),
  },
  face: {
    down: rowsAt('mal face down', 12, ['1:vvvvvvvvvv', '1:vnnffffnnv', '1:nCCnffnCCn', '1:vfffFfffvv', '2:vffFffvv', '2:vfffvfvv', '2:gGGggGgd', '2:gdEEEEdd', '2:gGggggdd', '3:gGgggd', '3:Ggggdd', '4:Gggd', '4:ggdd', '5:gd', '5:d']),
    side: rowsAt('mal face side', 12, ['1:dvvvvvvvv', '1:dvfffffnn', '1:dvffffnCn', '1:dvffffffFf', '2:dvfffffFf', '2:dvfffffvff', '2:dggGGggGg', '2:dgggEEEd', '3:dgGgggg', '3:dgGggggd', '4:dgGgggd', '5:dgggGd', '6:dggGd', '7:dgd', '8:d']),
    up: rowsAt('mal face up', 12, ['1:gggggggggg', '1:gGggggggdg', '1:gGgggggddg', '2:gGgggddd', '2:ggggddd', '3:gggdd']),
  },
  collar: {
    down: rowsAt('mal collar down', 28, ['1:P|26:x', '1:Pr|25:rx', '1:PRr|24:rrx', '2:PRr|23:rrx', '2:PRrr|22:rrrx', '3:PRrr|21:rrrx', '3:PpRrr|20:rrpxx', '2:PPpppRr|19:rpppxxx', '1:PPppppppxxxxxxxxxxxxpppxxx', '0:PPppppppppppppppppppppppxxxx', '1:xxppppppppppppppppppppxxxx']),
    side: rowsAt('mal collar side', 20, ['3:P', '3:Pp', '3:PPx', '3:PPpx', '2:PPppx', '2:PPpppx', '2:PPppppx', '1:PPpppppxx', '0:PPppppppppxx', '0:Ppppppppppppppxx', '1:xxppppppppppxx']),
    up: rowsAt('mal collar up', 28, ['1:P|26:x', '1:Pp|25:px', '1:PPp|24:ppx', '1:PPpppppppppppxpppppppppppx', '1:PPpppppppppppxpppppppppppx', '2:PPppppppppppxppppppppppx', '2:PPppppppppppxppppppppppx', '1:PPpppppppppppxppppppppppxx', '1:PPpppppppppppxpppppppppxxx', '0:PPppppppppppppppppppppppxxxx', '1:xxppppppppppppppppppppxxxx']),
  },
  sigil: rows('mal sigil', ['..c..', '.cCc.', 'cC.Cc', '.cCc.', '..c..']),
  hand: rows('mal hand', ['.ff..', 'fFfv.', 'fffvv', '.fvfv', '.v.v.']),
  boot: rows('mal boot', ['.xxx..', 'pPxxx.', 'Ppxxxx']),
};
const SLEEVE = ['purpL', 'purp', 'purpD'];
const COAT_MAP = { ...MAL_MAP, P: 'purpL', p: 'purp', x: 'purpD' }; // the coat and its collar a brighter violet than the hat, so the two part

// the coat below the collar: rows widening to the hem, lit down the left
// edge and dark down the right, a belt with the hex for its buckle, folds, a
// dark front panel with runes down it facing you (the sigil facing away),
// and a hem stitched with runes over a ragged edge that swings as he walks
function malCoat(ctx, cx, y0, view, sway = 0) {
  const n = 23, side = view === 'side';
  for (let i = 0; i < n; i++) {
    let hw = side ? 7 + i * 0.16 : 9.5 + i * 0.17;
    if (i >= 6 && i <= 8) hw -= 1; // the waist, pulled in by the belt
    const sw = i >= 12 ? Math.round(sway * (i - 11) / 11) : 0; // the skirts swing, more toward the hem
    const l = Math.round(cx - hw) + sw + (side ? -1 : 0), r = Math.round(cx + hw) - 1 + sw + (side ? 1 : 0), y = y0 + i;
    for (let x = l; x <= r; x++) {
      const u = (x - l) / Math.max(1, r - l), rel = x - (cx + sw);
      let col = u < 0.1 ? 'purpL' : u > 0.78 ? 'purpD' : 'purp';
      if (!side && view === 'down' && Math.abs(rel + 0.5) < 2.6) col = Math.abs(rel + 0.5) > 1.6 ? 'redD' : 'night'; // the front panel, the coat's red lining at its edges
      if (side && rel >= 4 + i * 0.12) col = rel < 5 + i * 0.12 ? 'redD' : 'night'; // the coat's open front edge, in profile
      if (i >= 10 && i <= 20 && (rel === -6 || rel === 5)) col = 'purpD'; // folds
      if (i >= 10 && i <= 20 && rel === -7) col = 'purpL';
      if (i === 7 || i === 8) col = 'hexD'; // the belt
      if (i === n - 3) col = 'hexD';
      if (i === n - 2) col = (x + 1) % 4 === 0 ? 'curse' : 'purpD'; // the hem's runes
      if (i === n - 1 && (x + sway) % 3 === 0) continue; // a ragged edge
      px(ctx, x, y, col);
    }
    if (!side && view === 'down' && [11, 14, 17].includes(i)) px(ctx, cx - 1 + sw, y, 'curse', 2, 1); // runes down the panel
  }
  if (!side) { px(ctx, cx - 1, y0 + 7, view === 'down' ? 'curseL' : 'hexD', 2, 1); if (view === 'down') { px(ctx, cx - 2, y0 + 7, 'curse'); px(ctx, cx + 1, y0 + 7, 'curse'); px(ctx, cx - 1, y0 + 8, 'curse', 2, 1); } } // the hex for a buckle
  if (view === 'up') grid(ctx, MAL.sigil, MAL_MAP, cx - 3, y0 + 11); // the hex's sigil across his back
}

// the staff: black wood twisting up through his fist, the hex held at its
// head in three claws; `glow` lights the orb (1) and throws its light (2).
// The light is returned to be painted after the outline, unoutlined.
function malStaff(g, [hx, hy], ang, { up = 26, down = 14, glow = 0 } = {}) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
  const lit = nx * L2[0] + ny * L2[1] > 0 ? 1 : -1;
  for (let t = -down; t <= up; t += 0.5) for (const k of [0, 1]) {
    const X = Math.round(hx + c * t + nx * k * -lit - 0.5), Y = Math.round(hy + s * t + ny * k * -lit - 0.5);
    px(g, X, Y, k ? 'barkD' : (Math.round(t) % 4 === 0 ? 'barkL' : 'bark')); // a twist of light up the wood
  }
  const at = (t, o) => [Math.round(hx + c * t + nx * o - 0.5), Math.round(hy + s * t + ny * o - 0.5)];
  const o = at(up + 3, 0);
  for (const side of [-1, 1]) for (let k = 0; k < 5; k++) { const [X, Y] = at(up + k * 0.9, side * (2.2 + Math.sin(k * 0.8) * 1.4)); px(g, X, Y, k === 4 ? 'bone' : 'barkL'); } // two claws round it
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) px(g, o[0] + x, o[1] + y, x + y < -1 ? 'curseL' : x + y > 1 ? 'purp' : 'curse'); // the hex
  px(g, o[0] - 1, o[1] - 1, glow ? 'white' : 'curseL');
  return o;
}
function malGlow(ctx, [x, y], glow) {
  if (!glow) return;
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) px(ctx, x + dx, y + dy, 'curseL');
  if (glow > 1) for (const [dx, dy] of [[-3, -3], [3, -3], [3, 3], [-3, 3], [-6, 0], [6, 0], [0, -6], [0, 6]]) px(ctx, x + dx, y + dy, Math.abs(dx) + Math.abs(dy) > 5 ? 'curse' : 'white');
}

// pose: bob, step, hand (the staff hand), ang (the staff), glow, off (the
// other hand), cast (light in the other hand), crouch, eye
function malgrim(view, { bob = 0, step = 0, hand = null, ang = null, glow = 0, off = null, cast = 0, crouch = 0, eye = null, reach = 26 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = MAL_MAP, by = bob + crouch, sway = -step;
  const eyeMap = eye ? { ...M, C: eye } : M, lights = [];
  const sleeve = (g, s, h, flip) => {
    const el = [s[0] + (flip ? 1 : -1) * 2, (s[1] + h[1]) / 2];
    limb(g, s, el, 3, 3.4, SLEEVE); limb(g, el, [h[0], h[1] - 2], 3.4, 4.4, SLEEVE); // a bell sleeve, flaring to the wrist
    px(g, h[0] - 2, h[1] - 1, 'night', 5, 2); // the dark inside of the sleeve
    grid(g, MAL.hand, M, h[0] - 2, h[1]);
  };
  if (view === 'side') {
    const sh = [36, 31 + by], hd = hand || [44, 41 + by], a = ang ?? -1.6, fsh = [39, 30 + by], fh = off || [41, 41 + by];
    layer(ctx, W, H, (g) => { limb(g, fsh, [fh[0], fh[1] - 2], 2.8, 3.6, ['purp', 'purpD', 'hexD']); grid(g, MAL.hand, { ...M, f: 'mist', F: 'bone', v: 'stone' }, fh[0] - 2, fh[1]); }); // the far arm
    for (const [x, k] of [[33 + step * 2, 0], [37 - step * 2, 1]]) grid(ctx, MAL.boot, k ? M : { ...M, P: 'purpD', p: 'hexD' }, x, 52);
    malCoat(ctx, 36, 31 + by, 'side', sway);
    grid(ctx, MAL.collar.side, COAT_MAP, 28, 20 + by);
    layer(ctx, W, H, (g) => { grid(g, MAL.face.side, eyeMap, 33, 20 + by); grid(g, MAL.hat.side, M, 27, 3 + by); });
    layer(ctx, W, H, (g) => lights.push(malStaff(g, hd, a, { up: reach, glow })));
    layer(ctx, W, H, (g) => sleeve(g, sh, hd, true));
    if (cast) lights.push([fh[0], fh[1]]);
  } else {
    const up = view === 'up';
    const sh = up ? [46, 31 + by] : [26, 31 + by], hd = hand || (up ? [48, 41 + by] : [24, 41 + by]), a = ang ?? -1.57;
    const osh = up ? [26, 31 + by] : [46, 31 + by], oh = off || (up ? [24, 42 + by + step] : [48, 42 + by - step]);
    if (up) layer(ctx, W, H, (g) => lights.push(malStaff(g, hd, a, { up: reach, glow })));
    grid(ctx, MAL.boot, M, 30, 52 - (step > 0 ? 1 : 0)); grid(ctx, MAL.boot, M, 37, 52 - (step < 0 ? 1 : 0));
    malCoat(ctx, 36, 31 + by, view, sway);
    grid(ctx, MAL.collar[view], COAT_MAP, 22, 20 + by); // the collar's wings stand up beside the hat's brim
    layer(ctx, W, H, (g) => { grid(g, MAL.face[view], eyeMap, 30, 20 + by); grid(g, MAL.hat[view], M, 25, 3 + by); });
    layer(ctx, W, H, (g) => sleeve(g, osh, oh, !up));
    if (!up) layer(ctx, W, H, (g) => lights.push(malStaff(g, hd, a, { up: reach, glow })));
    layer(ctx, W, H, (g) => sleeve(g, sh, hd, up));
    if (cast) lights.push([oh[0], oh[1] + 2]);
  }
  outline(c, 'ink');
  lights.forEach((l, i) => malGlow(ctx, l, i === 0 ? glow : cast));
  return c;
}

// the bolt (the hex levelled at you and loosed: the windup holds the first)
// and the great cast (the staff raised high, the light in his other hand)
const MAL_BOLT = {
  down: [{ hand: [25, 37], ang: -1.85, glow: 1, off: [44, 34], cast: 1 }, { hand: [25, 39], ang: -1.4, glow: 2, off: [39, 44], cast: 2 }, { hand: [24, 40], ang: -1.5, glow: 1 }],
  up: [{ hand: [47, 37], ang: -1.3, glow: 1 }, { hand: [47, 35], ang: -1.65, glow: 2, reach: 22 }, { hand: [48, 40], ang: -1.6, glow: 1 }],
  side: [{ hand: [41, 38], ang: -2.1, glow: 1 }, { hand: [48, 38], ang: -0.25, glow: 2, reach: 18 }, { hand: [46, 40], ang: -0.9, glow: 1 }],
};
const MAL_CAST = {
  down: [{ hand: [27, 31], ang: -1.57, glow: 1, reach: 22, off: [47, 33], cast: 1 }, { hand: [28, 27], ang: -1.57, glow: 2, reach: 22, off: [48, 30], cast: 2, bob: -1 }, { hand: [27, 31], ang: -1.57, glow: 1, reach: 22, off: [47, 33], cast: 1 }],
  up: [{ hand: [45, 31], ang: -1.57, glow: 1, reach: 22 }, { hand: [44, 27], ang: -1.57, glow: 2, reach: 22, bob: -1 }, { hand: [45, 31], ang: -1.57, glow: 1, reach: 22 }],
  side: [{ hand: [43, 32], ang: -1.65, glow: 1, reach: 22 }, { hand: [43, 28], ang: -1.65, glow: 2, reach: 22, bob: -1 }, { hand: [43, 32], ang: -1.65, glow: 1, reach: 22 }],
};

// ------------------------------------------------- the front views, redrawn
// (2026-10-28, the user's notes on the first pass: ink lines where an arm or
// an ear joins the body read as cut-outs, and Snagtooth was a cartoon ogre,
// not a goblin.) Drawn on the cast's own proportions: a big head, a stubby
// body and short arms, a face of a few clean pixels, and ink only round the
// outside: parts are told apart by their tones, never by black lines inside.

// Snagtooth facing you: the goblin's own head (the hood, the ears out along
// the brim, wide-set gold eyes, a row of teeth) grown, a tusk up past the
// teeth, a red feather in the hood, a wolf pelt over his shoulders for a
// chief's mantle, the goblin's brown tunic belted with gold, dark legs, boots.
const SNAGF_MAP = { ...SNAG_MAP, V: 'mist', v: 'stone', u: 'slate', R: 'redD', o: 'grassD', O: 'leafD' };
export const SNAGF = {
  // the goblin's head at 1.6x: the small hood, ears out under it, the face
  // narrowing to the chin; brows down to the nose, a scowl turned down at
  // the corners and one tusk up past it, where the goblin grins
  head: rows('snag front head', [
    '......hhhh......',
    '....hhHHHHhh....',
    '...hHHjjHHHHh...',
    '...hHjHHHHHHh...',
    'LXLgGhhhhhhhGggd',
    '.LLGdGGGGGGdGgg.',
    '...GGddGGddGGg..',
    '...GGYGGGGYGGg..',
    '...gGwGGLgGGgg..',
    '...gGwEEEEGGgg..',
    '....gEggggEgg...',
    '.....gggggg.....',
  ]),
  // the goblin's brown tunic with its red marks, under a wolf pelt for a chief's mantle
  torso: rows('snag front torso', [
    'VVvVvvVvvVvuu',
    'uvuTTuTTuTTvu',
    'tDTTTTTTTTTTt',
    'tDTrTTTTTTTTt',
    'tDTTTTTTTTTTt',
    'tDTTTTTTTrTTt',
    '.hhhhhYYhhhh.',
    '.tTt.tTTt.tt.',
  ]),
  legL: rows('snag front leg L', ['oooO.', 'oooO.', 'oooO.', 'oooO.', 'oooO.', 'oooO.', 'hHhh.', 'hHhhh', 'hhhhh']),
  legR: rows('snag front leg R', ['.ooOO', '.ooOO', '.ooOO', '.ooOO', '.ooOO', '.ooOO', '.hhhh', 'hHhhh', 'hhhhh']),
  fist: rows('snag front fist', ['LG', 'Gg']),
};
function snagFront({ bob = 0, step = 0, hand = null, ang = null, reach = 34, crouch = 0, eye = null } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = SNAGF_MAP, by = bob + crouch;
  const put = (r, x, y, m = M) => grid(ctx, r, m, x, y);
  put(SNAGF.legL, 26, 40 - (step > 0 ? 1 : 0)); put(SNAGF.legR, 33, 40 - (step < 0 ? 1 : 0));
  put(SNAGF.torso, 26, 32 + by);
  const arm = (s, h) => { limb(ctx, s, h, 1.5, 1.3, SKIN); put(SNAGF.fist, h[0] - 1, h[1]); }; // the goblin's thin arms, a little longer
  const hd = hand ? [hand[0], hand[1] + by] : [24, 38 + by];
  arm([39, 33 + by], [40, 38 + by + step]); // the off arm
  put(SNAGF.head, 24, 20 + by, eye ? { ...M, Y: eye, y: eye } : M);
  for (const [x, y, col, w] of [[36, 21, 'redD', 2], [37, 20, 'red', 2], [38, 19, 'red', 2], [39, 18, 'redL', 1]]) px(ctx, x, y + by, col, w, 1); // a red feather tucked in the hood, swept back
  snagSpear(ctx, hd, ang ?? -1.57, reach, 0.27); // held in front of him: over the ear, not behind it
  arm([25, 33 + by], hd);
  outline(c, 'ink');
  return c;
}

// Malgrim facing you: a man, not a giant (the user, 2026-10-28), so a little
// bigger than the heroes, about 1.3x their height, on their proportions: the
// crooked hat with its runes, a gaunt face with the curse in his eyes and a
// thin grey beard, the red-lined collar his head sits down into, a violet
// coat over pointed boots, bell sleeves, the staff. 64x64, the feet on y 48.
export const MALF = {
  hat: rowsAt('mal front hat', 15, ['9:xx', '8:pxx', '7:pPx', '6:pPpx', '5:pPppx', '4:pPpppxx', '3:xcxCxcxCx', '1:xpPPpppppppxx', '0:xpPpppppppppxx', '1:xxxxxxxxxxxxx']),
  face: rows('mal front face', [
    '.vnnffnnv.',
    '.vnCffCnv.',
    '.vffFfffv.',
    '..vggggv..',
    '..vgEEgv..',
    '...gGgd...',
    '...gGd....',
    '....gd....',
  ]),
  // the collar's wings, red-lined, and its dark inside between them: his head sits down into it
  collar: rowsAt('mal front collar', 16, ['1:P|14:x', '1:Pr|13:rx', '1:PRr' + 'n'.repeat(8) + 'rrx', '0:PPRr' + 'n'.repeat(8) + 'rRpx', '0:PP' + 'p'.repeat(10) + 'xxxx']),
  hand: rows('mal front hand', ['fv', 'vv']),
  boot: rows('mal front boot', ['.xxx', 'Ppxx']),
};
const MALF_MAP = { ...MAL_MAP, f: 'skinL', F: 'skinL', v: 'skin', C: 'curse', g: 'mist', G: 'bone', d: 'stone' }; // a pale but living face, the curse burning in his eyes, a grey-white beard (a darker grey read as a mask)
function malCoatFront(ctx, cx, y0, sway = 0) {
  const n = 11;
  for (let i = 0; i < n; i++) {
    let hw = 5 + i * 0.3;
    if (i >= 2 && i <= 3) hw -= 0.5; // the waist, pulled in by the belt
    const sw = i >= 6 ? Math.round(sway * (i - 5) / 5) : 0;
    const l = Math.round(cx - hw) + sw, r = Math.round(cx + hw) - 1 + sw, y = y0 + i;
    for (let x = l; x <= r; x++) {
      const u = (x - l) / Math.max(1, r - l), rel = x - (cx + sw);
      let col = u < 0.12 ? 'purpL' : u > 0.8 ? 'purpD' : 'purp';
      if (Math.abs(rel + 0.5) < 2) col = Math.abs(rel + 0.5) > 1 ? 'redD' : 'night'; // the front panel, red lining at its edges
      if (i >= 5 && i <= 8 && rel === 3) col = 'purpD'; // a fold
      if (i === 3) col = 'hexD'; // the belt
      if (i === n - 1) col = (x - l) % 4 === 2 ? 'curse' : 'purpD'; // the hem, a rune stitched in it here and there
      px(ctx, x, y, col);
    }
  }
  px(ctx, cx - 1, y0 + 3, 'curseL', 2, 1); // the hex for a buckle
  px(ctx, cx - 1, y0 + 6, 'curse', 2, 1); // a rune down the panel
}
function malFront({ bob = 0, step = 0, hand = null, ang = null, glow = 0, off = null, cast = 0, crouch = 0, eye = null, reach = 22 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = MAL_MAP, by = bob + crouch, lights = [];
  grid(ctx, MALF.boot, M, 27, 46 - (step > 0 ? 1 : 0)); grid(ctx, MALF.boot, M, 33, 46 - (step < 0 ? 1 : 0));
  malCoatFront(ctx, 32, 36 + by, -step);
  grid(ctx, MALF.collar, COAT_MAP, 24, 33 + by);
  const sleeve = (s, h) => layerSoft(ctx, W, H, 'hexD', [s], (g) => { limb(g, s, [h[0], h[1] - 1], 1.4, 2, SLEEVE); px(g, h[0] - 1, h[1] - 1, 'night', 2, 1); grid(g, MALF.hand, MALF_MAP, h[0] - 1, h[1]); }); // edged in the coat's darkest violet where it crosses the coat
  const hd = hand ? [hand[0], hand[1] + by] : [25, 42 + by], oh = off ? [off[0], off[1] + by] : [39, 42 + by - step];
  sleeve([37, 37 + by], oh);
  grid(ctx, MALF.face, eye ? { ...MALF_MAP, C: eye } : MALF_MAP, 27, 28 + by);
  grid(ctx, MALF.hat, M, 25, 18 + by);
  lights.push(malStaff(ctx, hd, ang ?? -1.57, { up: reach, down: 6, glow })); // held out in front of him: over the hat's brim, not behind it
  sleeve([27, 37 + by], hd);
  outline(c, 'ink');
  malGlow(ctx, lights[0], glow);
  if (cast) malGlow(ctx, [oh[0], oh[1] + 1], cast);
  c.portraitAt = [24, 21]; // his face for the HUD (the frame's default crop is for a taller figure)
  return c;
}

// the front views' attacks, on the new proportions
const SNAGF_THRUST = [{ hand: [24, 34], ang: 1.75, reach: 24, crouch: 1 }, { hand: [26, 40], ang: 1.62, reach: 20 }, { hand: [24, 37], ang: 1.7, reach: 22 }];
const MALF_BOLT = [{ hand: [26, 40], ang: -1.85, glow: 1, off: [39, 38], cast: 1 }, { hand: [26, 41], ang: -1.4, glow: 2, off: [41, 41], cast: 2 }, { hand: [25, 42], ang: -1.5, glow: 1 }];
const MALF_CAST = [{ hand: [25, 37], ang: -1.6, glow: 1, reach: 18, off: [39, 38], cast: 1 }, { hand: [25, 34], ang: -1.6, glow: 2, reach: 18, off: [40, 35], cast: 2, bob: -1 }, { hand: [25, 37], ang: -1.6, glow: 1, reach: 18, off: [39, 38], cast: 1 }]; // raised beside his face, not across it
// facing you: the redrawn front; the side and back views are still the first pass
// ------------------------------------------- the side and back views, redrawn
// on the fronts' proportions and sizes (2026-10-28), so they turn without
// changing size or style

// Snagtooth from the side (facing right): the hood toward the back, an ear
// sweeping back under it, brows down to the front, the gold eye, a long nose,
// the tusk up past a turned-down mouth; the pelt over his shoulders, the tunic
// belted with the buckle at the front, the spear held low and forward, ready
Object.assign(SNAGF, {
  headSide: rows('snag side head', [
    '.....hhhh.......',
    '...hhHHHHhh.....',
    '..hHHjjHHHHh....',
    '..hHjHHHHHHHh...',
    'LLggGhhhhhhhhG..',
    '.XLLGGGGGGdGGGg.',
    '...gLGGGGGGddGG.',
    '...gGGGGGGGGYGGG',
    '...gGGGGGGGGGGLg',
    '...ggGGGGGGwEEg.',
    '....gGGGGGGwgEg.',
    '.....gggggggg...',
  ]),
  torsoSide: rows('snag side torso', ['VVvVvvVu.', 'uvuTTuTvu', 'tDTTTTTTt', 'tDTTrTTTt', 'tDTTTTTTt', 'tDTTTTTrt', 'hhhhhhhYh', '.tTt.tTt.']),
  legSide: rows('snag side leg', ['.ooO..', '.ooO..', '.ooO..', '.ooO..', '.ooO..', '.ooO..', '.hHhh.', '.hHhhh', '.hhhhh']),
  // from behind: the hood over the back of his head, the ears out under it,
  // the wolf pelt draped down his back with its tail over the belt, heels
  headBack: rows('snag back head', [
    '......hhhh......',
    '....hhHHHHhh....',
    '...hHHjjHHHHh...',
    '...hHjHHHHHHh...',
    'LXLghhhhhhhhhggd',
    '.LLGGGGGGGGGGgg.',
    '...gGGGGGGGGGg..',
    '...gGGGGGGGGGg..',
    '...gGGGGGGGGgg..',
    '....gGGGGGGgg...',
    '.....gggggg.....',
  ]),
  torsoBack: rows('snag back torso', ['VVvVvvVvvVvuu', 'VVvVvvvvvVvuu', 'uVvvvVvvvvvuu', 'tuVvvvvvvvuut', 'tDuVvvvvvuuTt', 'tDTuvVvvvuTTt', '.hhhhuVuhhhh.', '.tTt.uvu.tTt.']),
  legBackL: rows('snag back leg L', ['oooO.', 'oooO.', 'oooO.', 'oooO.', 'oooO.', 'oooO.', 'hhhh.', 'hhhhh', '.hhh.']),
  legBackR: rows('snag back leg R', ['.ooOO', '.ooOO', '.ooOO', '.ooOO', '.ooOO', '.ooOO', '.hhhh', 'hhhhh', '.hhh.']),
});
function snagSide({ bob = 0, step = 0, hand = null, ang = null, reach = 34, crouch = 0, eye = null, lunge = 0 } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = SNAGF_MAP, by = bob + crouch, st = step * 2;
  const put = (r, x, y, m = M) => grid(ctx, r, m, x, y);
  const far = { ...M, o: 'leafD', O: 'leafD', h: 'leatherD', H: 'leatherD' };
  put(SNAGF.legSide, 28 - st, 40 - (step < 0 ? 1 : 0), far); // the far leg, in shadow
  limb(ctx, [34 + lunge, 33 + by], [35 + lunge - step, 38 + by], 1.4, 1.2, ['grass', 'grassD', 'leafD']); // the far arm, behind
  put(SNAGF.legSide, 30 + st, 40 - (step > 0 ? 1 : 0));
  put(SNAGF.torsoSide, 28 + lunge, 32 + by);
  put(SNAGF.headSide, 25 + lunge, 20 + by, eye ? { ...M, Y: eye, y: eye } : M);
  for (const [x, y, col, w] of [[27, 21, 'redD', 2], [26, 20, 'red', 2], [25, 19, 'red', 2], [24, 18, 'redL', 1]]) px(ctx, x + lunge, y + by, col, w, 1); // the feather, swept back
  const hd = hand ? [hand[0] + lunge, hand[1] + by] : [34, 38 + by];
  snagSpear(ctx, hd, ang ?? -0.42, reach, 0.27);
  limb(ctx, [31 + lunge, 33 + by], hd, 1.5, 1.3, SKIN); grid(ctx, SNAGF.fist, M, hd[0] - 1, hd[1]);
  outline(c, 'ink');
  return c;
}
function snagBack({ bob = 0, step = 0, hand = null, ang = null, reach = 34, crouch = 0 } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = SNAGF_MAP, by = bob + crouch;
  const put = (r, x, y, m = M) => grid(ctx, r, m, x, y);
  const hd = hand ? [hand[0], hand[1] + by] : [40, 38 + by];
  snagSpear(ctx, hd, ang ?? -1.57, reach, 0.27); // facing away, the spear is beyond him
  put(SNAGF.legBackL, 26, 40 - (step < 0 ? 1 : 0)); put(SNAGF.legBackR, 33, 40 - (step > 0 ? 1 : 0));
  put(SNAGF.torsoBack, 26, 32 + by);
  const arm = (s, h) => { limb(ctx, s, h, 1.5, 1.3, SKIN); grid(ctx, SNAGF.fist, M, h[0] - 1, h[1]); };
  arm([25, 33 + by], [24, 38 + by - step]);
  arm([39, 33 + by], hd);
  put(SNAGF.headBack, 24, 21 + by);
  for (const [x, y, col, w] of [[36, 21, 'redD', 2], [37, 20, 'red', 2], [38, 19, 'red', 2], [39, 18, 'redL', 1]]) px(ctx, x, y + by, col, w, 1); // the feather
  outline(c, 'ink');
  return c;
}
const SNAGS_THRUST = [{ hand: [27, 36], ang: -0.05, reach: 32, crouch: 1 }, { hand: [36, 37], ang: 0.02, reach: 32, lunge: 2 }, { hand: [33, 37], ang: 0, reach: 32 }];
const SNAGB_THRUST = [{ hand: [41, 40], ang: -1.57, reach: 26, crouch: 1 }, { hand: [40, 32], ang: -1.6, reach: 22 }, { hand: [41, 36], ang: -1.57, reach: 24 }];

// Malgrim from the side (facing right): the hat's tip leaning back and its
// brim out over his brow, grey hair at the back, a hooked nose, the glowing
// eye, the beard jutting forward; the collar's wing standing up behind his
// head; the coat open at the front on its red lining; the staff held out ahead
Object.assign(MALF, {
  hatSide: rowsAt('mal side hat', 15, ['3:xx', '3:pxx', '4:pPx', '4:pPpx', '5:pPppx', '4:pPpppxx', '4:xcxCxcxx', '1:xpPPppppppppx', '0:xpPpppppppppxx', '1:xxxxxxxxxxxxx']),
  faceSide: rows('mal side face', [
    '.ggvvvvvv.',
    '.ggfffnnf.',
    '.ggffffnCf',
    '.gvfffffff',
    '..vffffffv',
    '..vfgggggv',
    '..vgggEEg.',
    '...gGgggd.',
    '....gGggd.',
    '.....gGd..',
    '......gd..',
  ]),
  collarSide: rowsAt('mal side collar', 12, ['1:P', '1:Pp', '1:PPp', '0:PPpp|7:rrn', '0:PPpppppppxxx']),
  // from behind: the hat (its tip leaning the other way), grey hair, the
  // collar's back standing up like a fan, the coat with the hex's sigil on it
  hatBack: rowsAt('mal back hat', 15, ['4:px', '4:ppx', '5:pPx', '5:pPpx', '5:pPppx', '4:pPpppxx', '3:xcxCxcxCx', '1:xpPPpppppppxx', '0:xpPpppppppppxx', '1:xxxxxxxxxxxxx']),
  faceBack: rows('mal back hair', ['.gggggggg.', '.gGggggdg.', '.gGgggddg.', '..gGggdd..', '..ggggdd..', '...gggd...']),
  collarBack: rowsAt('mal back collar', 16, ['1:P|14:x', '1:Pp|13:px', '1:PPp' + 'p'.repeat(3) + 'x' + 'p'.repeat(4) + 'ppx', '0:PPpp' + 'p'.repeat(3) + 'x' + 'p'.repeat(4) + 'ppxx', '0:PP' + 'p'.repeat(10) + 'xxxx']),
  bootSide: rows('mal side boot', ['.xxx..', 'Ppxxxx']),
  sigil: rows('mal back sigil', ['.c.', 'cCc', '.c.']),
});
// the coat seen from the side or from behind, on the front's proportions
function malCoatTurned(ctx, cx, y0, view, sway = 0) {
  const n = 11, side = view === 'side';
  for (let i = 0; i < n; i++) {
    let hw = side ? 4 + i * 0.25 : 5 + i * 0.3;
    if (i >= 2 && i <= 3) hw -= 0.5;
    const sw = i >= 6 ? Math.round(sway * (i - 5) / 5) : 0;
    const l = Math.round(cx - hw) + sw, r = Math.round(cx + hw) - 1 + sw + (side ? 1 : 0), y = y0 + i;
    for (let x = l; x <= r; x++) {
      const u = (x - l) / Math.max(1, r - l);
      let col = u < 0.12 ? 'purpL' : u > 0.8 ? 'purpD' : 'purp';
      if (side && x === r) col = i > 3 ? 'redD' : 'purpD'; // the coat open at the front, its red lining showing
      if (!side && i >= 5 && i <= 8 && x - (cx + sw) === 0) col = 'purpD'; // the back seam
      if (i === 3) col = 'hexD'; // the belt
      if (i === n - 1) col = (x - l) % 4 === 2 ? 'curse' : 'purpD'; // the hem, a rune stitched in it here and there
      px(ctx, x, y, col);
    }
  }
  if (!side) grid(ctx, MALF.sigil, MAL_MAP, cx - 2, y0 + 5); // the hex's sigil across his back
}
function malSide({ bob = 0, step = 0, hand = null, ang = null, glow = 0, cast = 0, crouch = 0, eye = null, reach = 22 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = MAL_MAP, by = bob + crouch, lights = [];
  grid(ctx, MALF.bootSide, { ...M, P: 'purpD', p: 'hexD' }, 28 - step, 46); // the far boot
  grid(ctx, MALF.bootSide, M, 30 + step, 46);
  malCoatTurned(ctx, 31, 36 + by, 'side', -step);
  grid(ctx, MALF.collarSide, COAT_MAP, 25, 33 + by);
  grid(ctx, MALF.faceSide, eye ? { ...MALF_MAP, C: eye } : MALF_MAP, 28, 28 + by);
  grid(ctx, MALF.hatSide, M, 25, 18 + by);
  const hd = hand ? [hand[0], hand[1] + by] : [38, 42 + by];
  lights.push(malStaff(ctx, hd, ang ?? -1.6, { up: reach, down: 6, glow }));
  layerSoft(ctx, W, H, 'hexD', [[31, 37 + by]], (g) => { limb(g, [31, 37 + by], [hd[0], hd[1] - 1], 1.4, 2, SLEEVE); px(g, hd[0] - 1, hd[1] - 1, 'night', 2, 1); grid(g, MALF.hand, MALF_MAP, hd[0] - 1, hd[1]); });
  outline(c, 'ink');
  malGlow(ctx, lights[0], glow);
  if (cast) malGlow(ctx, [hd[0] + 3, hd[1] - 4], cast);
  return c;
}
function malBack({ bob = 0, step = 0, hand = null, ang = null, glow = 0, off = null, cast = 0, crouch = 0, reach = 22 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = MAL_MAP, by = bob + crouch, lights = [];
  const hd = hand ? [hand[0], hand[1] + by] : [39, 42 + by], oh = off ? [off[0], off[1] + by] : [25, 42 + by + step];
  lights.push(malStaff(ctx, hd, ang ?? -1.57, { up: reach, down: 6, glow })); // facing away, the staff is beyond him
  grid(ctx, MALF.boot, { ...M, P: 'purpD' }, 27, 46 - (step < 0 ? 1 : 0)); grid(ctx, MALF.boot, { ...M, P: 'purpD' }, 33, 46 - (step > 0 ? 1 : 0));
  malCoatTurned(ctx, 32, 36 + by, 'up', step);
  const sleeve = (s, h) => layerSoft(ctx, W, H, 'hexD', [s], (g) => { limb(g, s, [h[0], h[1] - 1], 1.4, 2, SLEEVE); grid(g, MALF.hand, MALF_MAP, h[0] - 1, h[1]); });
  sleeve([27, 37 + by], oh); sleeve([37, 37 + by], hd);
  grid(ctx, MALF.collarBack, COAT_MAP, 24, 32 + by);
  grid(ctx, MALF.faceBack, { ...MALF_MAP, g: 'stone', G: 'mist', d: 'slate' }, 27, 28 + by); // grey hair, darker than the beard (a pale block from behind read as a face)
  grid(ctx, MALF.hatBack, M, 25, 18 + by);
  outline(c, 'ink');
  malGlow(ctx, lights[0], glow);
  return c;
}
const MALS_BOLT = [{ hand: [35, 40], ang: -2.1, glow: 1 }, { hand: [40, 39], ang: -0.3, glow: 2, reach: 16 }, { hand: [39, 41], ang: -0.9, glow: 1 }];
const MALS_CAST = [{ hand: [37, 37], ang: -1.65, glow: 1, reach: 18 }, { hand: [37, 34], ang: -1.65, glow: 2, reach: 18, bob: -1, cast: 2 }, { hand: [37, 37], ang: -1.65, glow: 1, reach: 18 }];
const MALB_BOLT = [{ hand: [39, 40], ang: -1.3, glow: 1 }, { hand: [39, 38], ang: -1.65, glow: 2, reach: 18 }, { hand: [39, 41], ang: -1.6, glow: 1 }];
const MALB_CAST = [{ hand: [38, 37], ang: -1.57, glow: 1, reach: 18 }, { hand: [38, 34], ang: -1.57, glow: 2, reach: 18, bob: -1 }, { hand: [38, 37], ang: -1.57, glow: 1, reach: 18 }];

const byView = (fns) => (view, pose) => fns[view](pose);
export const buildSnagtooth = (views = VIEWS) => cycle(byView({ down: snagFront, side: snagSide, up: snagBack }), { down: SNAGF_THRUST, side: SNAGS_THRUST, up: SNAGB_THRUST }, { bob: 1, crouch: 1, eye: 'white' }, views);
export const buildMalgrim = (views = VIEWS) => cycle(byView({ down: malFront, side: malSide, up: malBack }), { down: MALF_BOLT, side: MALS_BOLT, up: MALB_BOLT }, { bob: 1, crouch: 1, eye: 'white', ang: -1.75 }, views, { down: MALF_CAST, side: MALS_CAST, up: MALB_CAST });

// --------------------------------------------------------------------- Isolde
// Isolde the Rimeguard: a knight, human-sized (the user, 2026-10-28) and on a
// man's proportions, not the heroes' chibi ones, with the rime in her: a
// closed great helm crowned with jagged ice, cold eyes burning in the visor
// slit, frosted steel plate with ice growing out of the pauldrons, one
// gauntlet gone to claws of ice, a blue tabard with Frosthelm's white tree, a
// frozen, tattered cape, a kite shield and the rime lance. 64x64, feet on y 48.
const ISO_MAP = { // darker steel plate (pale plate read as a ghost, and hid the ice growing out of it), a dark blue tabard and cape
  A: 'steelL', a: 'steel', s: 'steelD', S: 'slate', F: 'blueD', E: 'ink', Y: 'iceXL',
  t: 'blue', T: 'blueD', W: 'white', I: 'iceL', i: 'ice', j: 'iceD', o: 'wood', O: 'woodD', h: 'leatherD',
};
export const ISOF = {
  helm: rows('iso helm', ['..saaaas..', '.aAAAAaas.', 'saAAAaaasS', 'FEYEEEEYEF', 'saAaEEaasS', 'saaaEEassS', '.saassasS.', '..SSSSSS..']),
  torso: rows('iso torso', ['.AAs....aSS.', 'AAAassssaaSS', '.aaastTTsaS.', '..aastWTsS..', '..aasWWWsS..', '..aastWTsS..', '..aastTTsS..', '..FFFtTTFF..', '..aastTTsS..', '..as.tTT.S..']),
  legL: rows('iso leg L', ['.aAs', '.aAs', '.aAs', '.FsF', '.aAs', '.aAs', 'aAss', 'aasS']),
  legR: rows('iso leg R', ['asS.', 'asS.', 'asS.', 'FSF.', 'asS.', 'asS.', 'assS', 'asSS']),
  shield: rows('iso shield', ['aAAAAs', 'AIWIiS', 'AWWWiS', 'AIWIiS', 'AIWijS', '.AWjS.', '.AijS.', '..jS..', '..S...']),
  gauntlet: rows('iso gauntlet', ['aS', 'SS']),
  claws: rows('iso claws', ['IA.', 'AIA', 'I.I']), // the rime's gauntlet: fingers of ice
  helmSide: rows('iso side helm', ['..saaas..', '.aAAAaas.', 'saAAAaasS', 'saAAaFEYE', 'saAaaaasS', 'saaaaassS', '.sasssSS.', '..SSSSS..']),
  torsoSide: rows('iso side torso', ['.Aas...', 'AAasS..', 'aaasStT', 'aaasStT', 'aaasStT', 'aaasStT', 'aaasStT', 'FFFFFtT', '.aasStT', '.as.StT']),
  legSide: rows('iso side leg', ['.aAs.', '.aAs.', '.aAs.', '.FsF.', '.aAs.', '.aAs.', '.aAss', '.asSS']),
  shieldEdge: rows('iso shield edge', ['aS', 'IS', 'IS', 'IS', 'jS', 'jS', 'jS', '.S']),
  helmBack: rows('iso back helm', ['..saaaas..', '.aAAAsaas.', 'saAAAsaasS', 'saAAasaasS', 'saAaasaasS', 'saaaasassS', '.saassasS.', '..SSSSSS..']),
  shieldBack: rows('iso shield back', ['aaaaaS', 'aohhoS', 'aoooOS', 'aohhoS', 'aoooOS', '.aooS.', '.aooS.', '..aS..', '..S...']),
};
const PLATE = ['steelL', 'steel', 'slate'];
const ICE_CROWN = [[1, 2, 3], [3, 0, 5], [6, 2, 3]]; // [dx, dy, height]: shards of ice grown up out of the helm, uneven
function iceCrown(ctx, x, y) { for (const [dx, dy, h] of ICE_CROWN) { px(ctx, x + dx, y + dy, 'iceXL', 1, h); if (h > 2) px(ctx, x + dx + 1, y + dy + 1, 'iceL', 1, h - 1); } }
function iceShards(ctx, x, y, dir) { px(ctx, x, y, 'iceXL', 1, 2); px(ctx, x + dir, y - 2, 'iceXL', 1, 3); px(ctx, x + dir * 2, y - 1, 'iceL', 1, 2); } // ice grown out of a pauldron
// the cape, frozen stiff and torn: a ragged hem with icicles hanging off it
function isoCape(ctx, cx, y0, n, hw0, grow, dark = false) {
  for (let i = 0; i < n; i++) {
    const hw = hw0 + i * grow, y = y0 + i;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      if (i === n - 1 && x % 3 === 0) continue; // torn
      px(ctx, x, y, i === n - 1 ? 'iceL' : dark || x >= cx - 4 ? 'blueD' : 'blue');
    }
  }
  for (let x = Math.round(cx - hw0 - (n - 1) * grow) + 1; x < cx + hw0 + (n - 1) * grow; x += 4) px(ctx, x, y0 + n, 'iceXL', 1, 2); // icicles
}

// the rime lance: a long steel shaft, a flared guard over her hand, a leaf of ice for its head
function isoLance(g, [hx, hy], ang, reach = 30, back = 0.3) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c, lit = nx * L2[0] + ny * L2[1] > 0 ? 1 : -1;
  const at = (t, o = 0) => [Math.round(hx + c * t + nx * o - 0.5), Math.round(hy + s * t + ny * o - 0.5)];
  for (let t = -reach * back; t <= reach * (1 - back); t += 0.5) { const [X, Y] = at(t); px(g, X, Y, 'steelL'); const [X2, Y2] = at(t, -lit); px(g, X2, Y2, 'steelD'); }
  for (const o of [-2, -1, 0, 1, 2]) { const [X, Y] = at(-1.5, o); px(g, X, Y, Math.abs(o) === 2 ? 'steelD' : 'steel'); } // the vamplate, guarding her hand
  const W = [1, 1.5, 2, 1.5, 1, 0.5], t0 = reach * (1 - back);
  W.forEach((w, i) => { for (let o = -w; o <= w + 0.01; o += 0.5) { const [X, Y] = at(t0 + 1 + i, o); px(g, X, Y, i === W.length - 1 ? 'white' : Math.sign(o) === lit ? 'iceXL' : 'iceL'); } }); // the leaf of ice
}

function isoFront({ bob = 0, step = 0, hand = null, ang = null, reach = 30, crouch = 0, eye = null, guard = 0 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = eye ? { ...ISO_MAP, Y: eye } : ISO_MAP, by = bob + crouch;
  isoCape(ctx, 32, 33 + by, 13, 5, 0.25); // the cape, behind her
  grid(ctx, ISOF.legL, M, 28, 41 - (step > 0 ? 1 : 0)); grid(ctx, ISOF.legR, M, 32, 41 - (step < 0 ? 1 : 0));
  grid(ctx, ISOF.torso, M, 26, 31 + by);
  const hd = hand ? [hand[0], hand[1] + by] : [25, 39 + by], sh = [38 - (guard ? 1 : 0), (guard ? 35 : 38) + by + (guard ? 0 : step)];
  limb(ctx, [36, 33 + by], sh, 1.3, 1.1, PLATE); // the shield arm
  grid(ctx, ISOF.helm, M, 27, 23 + by); iceCrown(ctx, 28, 19 + by);
  iceShards(ctx, 27, 30 + by, -1); iceShards(ctx, 37, 30 + by, 1);
  for (let k = 0; k < 6; k++) px(ctx, 29 - (k > 3 ? 1 : 0), 30 + by + k, k % 2 ? 'mist' : 'bone', 1, 1); // her pale braid, out from under the helm and over her shoulder
  grid(ctx, ISOF.shield, M, sh[0] - 1, sh[1] - 4);
  isoLance(ctx, hd, ang ?? -1.57, reach);
  limb(ctx, [27, 33 + by], hd, 1.3, 1.1, PLATE); grid(ctx, ISOF.claws, M, hd[0] - 1, hd[1]); // the lance hand: the gauntlet gone to claws of ice
  outline(c, 'ink');
  c.portraitAt = [24, 18];
  return c;
}
function isoSide({ bob = 0, step = 0, hand = null, ang = null, reach = 30, crouch = 0, eye = null, lunge = 0 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = eye ? { ...ISO_MAP, Y: eye } : ISO_MAP, by = bob + crouch, st = step * 2;
  for (let i = 0; i < 13; i++) { const w = 2 + Math.round(i * 0.3), y = 33 + by + i; for (let x = 30 - w + lunge; x <= 30 + lunge; x++) if (!(i === 12 && x % 3 === 0)) px(ctx, x, y, i === 12 ? 'iceL' : 'blueD'); } // the cape, frozen stiff behind her
  for (const x of [26, 29]) px(ctx, x + lunge, 46 + by, 'iceXL', 1, 2); // icicles off its hem
  grid(ctx, ISOF.legSide, { ...M, a: 'steel', A: 'steelL', s: 'steelD' }, 29 - st, 41 - (step < 0 ? 1 : 0)); // the far leg, in shadow
  grid(ctx, ISOF.shieldEdge, M, 36 + lunge, 33 + by); // the shield, on her far arm, out ahead
  grid(ctx, ISOF.legSide, M, 30 + st, 41 - (step > 0 ? 1 : 0));
  grid(ctx, ISOF.torsoSide, M, 29 + lunge, 31 + by);
  for (let k = 0; k < 7; k++) px(ctx, 29 + lunge, 30 + by + k, k % 2 ? 'mist' : 'bone'); // the braid, down her back
  grid(ctx, ISOF.helmSide, M, 28 + lunge, 23 + by); iceCrown(ctx, 28 + lunge, 19 + by);
  iceShards(ctx, 31 + lunge, 30 + by, -1);
  const hd = hand ? [hand[0] + lunge, hand[1] + by] : [36, 39 + by];
  isoLance(ctx, hd, ang ?? -1.3, reach);
  limb(ctx, [32 + lunge, 33 + by], hd, 1.3, 1.1, PLATE); grid(ctx, ISOF.claws, M, hd[0] - 1, hd[1]);
  outline(c, 'ink');
  return c;
}
function isoBack({ bob = 0, step = 0, hand = null, ang = null, reach = 30, crouch = 0, guard = 0 } = {}) {
  const W = 64, H = 64, [c, ctx] = frame(W, H), M = ISO_MAP, by = bob + crouch;
  const hd = hand ? [hand[0], hand[1] + by] : [39, 39 + by];
  isoLance(ctx, hd, ang ?? -1.57, reach); // facing away, the lance is beyond her
  grid(ctx, ISOF.legL, M, 28, 41 - (step < 0 ? 1 : 0)); grid(ctx, ISOF.legR, M, 32, 41 - (step > 0 ? 1 : 0));
  isoCape(ctx, 32, 31 + by, 15, 5, 0.25); // the cape, all down her back
  px(ctx, 32, 35 + by, 'white', 1, 6); px(ctx, 30, 37 + by, 'white', 5, 1); px(ctx, 31, 40 + by, 'white', 3, 1); // the white tree on it
  for (let k = 0; k < 7; k++) px(ctx, 32, 30 + by + k, k % 2 ? 'mist' : 'bone'); // the braid, down her back
  limb(ctx, [37, 33 + by], hd, 1.3, 1.1, PLATE); grid(ctx, ISOF.claws, M, hd[0] - 1, hd[1]);
  const sh = [25 + (guard ? 1 : 0), (guard ? 35 : 38) + by + (guard ? 0 : step)];
  limb(ctx, [27, 33 + by], sh, 1.3, 1.1, PLATE);
  grid(ctx, ISOF.shieldBack, M, sh[0] - 4, sh[1] - 4); // the back of the shield, on her left arm
  grid(ctx, ISOF.helmBack, M, 27, 23 + by); iceCrown(ctx, 28, 19 + by);
  iceShards(ctx, 27, 30 + by, -1); iceShards(ctx, 37, 30 + by, 1);
  outline(c, 'ink');
  return c;
}
const ISOF_LANCE = [{ hand: [25, 35], ang: -1.25, reach: 28, crouch: 1, guard: 1 }, { hand: [27, 40], ang: 2.0, reach: 16, guard: 1 }, { hand: [26, 39], ang: 2.2, reach: 20 }];
const ISOS_LANCE = [{ hand: [33, 36], ang: -2.0, reach: 28, crouch: 1 }, { hand: [37, 38], ang: 0, reach: 26, lunge: 2 }, { hand: [35, 39], ang: -0.7, reach: 28 }];
const ISOB_LANCE = [{ hand: [40, 41], ang: -1.57, reach: 26, crouch: 1, guard: 1 }, { hand: [39, 33], ang: -1.6, reach: 22, guard: 1 }, { hand: [39, 37], ang: -1.57, reach: 24 }];
export const buildIsolde = (views = VIEWS) => cycle(byView({ down: isoFront, side: isoSide, up: isoBack }), { down: ISOF_LANCE, side: ISOS_LANCE, up: ISOB_LANCE }, { bob: 1, crouch: 1, eye: 'white', guard: 1 }, views);

// ----------------------------------------------------------------- Gutcrusher
// The pit champion: a goblin, on the goblin's proportions like Snagtooth but
// bigger again (about 1.25x him). A horned iron helm with cheek guards, two
// tusks, a scowl, a bare green chest crossed by a leather harness, a chain
// over one shoulder, a spiked iron pauldron and gauntlet on the off side, a
// loincloth, iron-capped boots, and a great spiked maul. 80x64, feet on y 48.
const GUT_MAP = { ...SNAGF_MAP, I: 'steelL', i: 'steel', k: 'steelD' };
export const GUT = {
  head: rows('gut head', [
    '.......kkkkk.......',
    '.....kiIIiiiik.....',
    '....kiIIiiiiiik....',
    '....kIiiiiiiiik....',
    'LXLLkkkkkkkkkkkgggd',
    '.LLGkiGdGGGdGikgg..',
    '...GkGGddGddGGkG...',
    '...GkGYGGGGYGGkg...',
    '...gkGGGLgGGGGkg...',
    '...gGwGGGGGGwGgg...',
    '...gGwEEEEEEwGgg...',
    '....gEgggggggEg....',
    '.....ggggggggg.....',
  ]),
  torso: rows('gut torso', ['.LLGGGGGGGGGGg.', 'LLGGGhGGGhGGGgg', 'LGGGGGhGhGGGGgg', 'LGGLGGGhGGGGGgg', 'GGGGGGhGhGGGGgg', '.GGGGhGGGhGGGg.', '.gGGGGGGGGGGgg.', '.hhhhhhbbhhhhh.', '.tTTTTtTTtTTTt.', '..tTt.tTt.tTt..']),
  legL: rows('gut leg L', ['ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'hHhhh.', 'hHhhhh', 'kkhhhh']),
  legR: rows('gut leg R', ['.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.hhhhh', 'hHhhhh', 'hhhhkk']),
  headSide: rows('gut side head', [
    '.....kkkkk........',
    '...kkiIIiik.......',
    '..kiIIiiiiiik.....',
    '..kIiiiiiiiiik....',
    'LLLkkkkkkkkkkkk...',
    '.XLLGkiGGGGdGGGg..',
    '...gGkiGGGGGddGG..',
    '...gGkiGGGGGGYGGG.',
    '...gGGkGGGGGGGGLLg',
    '...ggGGGGGGGGwEEg.',
    '....gGGGGGGGGwgEg.',
    '.....gggggggggg...',
  ]),
  torsoSide: rows('gut side torso', ['.LGGGGGg..', 'LLGGGGGGgg', 'LGGGhGGGgg', 'LGGGGhGGgg', 'GGGGGGhGgg', 'GGGGGGGhgg', '.gGGGGGGg.', '.hhhhhhhb.', '.tTTTTTTt.', '..tTt.tTt.']),
  legSide: rows('gut side leg', ['.ooO..', '.ooO..', '.ooO..', '.ooO..', '.ooO..', '.ooO..', '.ooO..', '.hHhh.', '.hHhhh', '.hhhkk']),
  headBack: rows('gut back head', [
    '.......kkkkk.......',
    '.....kiIIiiiik.....',
    '....kiIIiiiiiik....',
    '....kIiiiiiiiik....',
    'LXLLkiiiiiiiiikgggd',
    '.LLGkiiiiiiiiikgg..',
    '...GkkiiiiiiikkG...',
    '...GGkkkkkkkkkGg...',
    '...gGGGGGGGGGGGg...',
    '....gGGGGGGGGGg....',
    '.....ggggggggg.....',
  ]),
  torsoBack: rows('gut back torso', ['.LLGGGGGGGGGGg.', 'LLGhGGGGGGGhGgg', 'LGGGhGGGGGhGGgg', 'LGGGGhGgGhGGGgg', 'GGGGGGhghGGGGgg', '.GGGGGGgGGGGGg.', '.gGGGGGgGGGGgg.', '.hhhhhhhhhhhhh.', '.tTTTTtTTtTTTt.', '..tTt.tTt.tTt..']),
  legBackL: rows('gut back leg L', ['ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'ooooO.', 'hhhhh.', 'hhhhhh', '.hhhh.']),
  legBackR: rows('gut back leg R', ['.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.oooOO', '.hhhhh', 'hhhhhh', '.hhhh.']),
  pauldron: rows('gut pauldron', ['.I..I.', 'kiIiik', 'kiiiik', '.kkkk.']),
  gauntlet: rows('gut gauntlet', ['IiI', 'iik', 'kkk']),
  fist: rows('gut fist', ['LGg', 'GGg', 'ggd']),
};
// the horns of his helm, curving up and out from its sides
const HORN = rows('gut horn', ['B.....', 'Bb....', 'bb....', '.bbn..', '..bnnn', '...nnn']); // thick at the helm, curving out and up to a pale tip
const HORN_MAP = { B: 'white', b: 'bone', n: 'dirt' };
function gutHorns(ctx, x0, x1, y) {
  grid(ctx, HORN, HORN_MAP, x0 - 5, y - 4);
  grid(ctx, HORN, HORN_MAP, x1, y - 4, true);
}
// the chain over his shoulder
function gutChain(ctx, [ax, ay], [bx, by]) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let k = 0; k <= n; k++) px(ctx, Math.round(ax + (bx - ax) * k / n), Math.round(ay + (by - ay) * k / n), k % 2 ? 'steelD' : 'steelL');
}
// the maul: a wooden haft through his fist, a block of iron at its head with spikes
function gutMaul(g, [hx, hy], ang, reach = 22, back = 0.45) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c, lit = nx * L2[0] + ny * L2[1] > 0 ? 1 : -1;
  const at = (t, o = 0) => [Math.round(hx + c * t + nx * o - 0.5), Math.round(hy + s * t + ny * o - 0.5)];
  for (let t = -reach * back; t <= reach * (1 - back); t += 0.5) { const [X, Y] = at(t); px(g, X, Y, Math.round(t) % 6 === 2 ? 'woodL' : 'wood'); const [X2, Y2] = at(t, -lit); px(g, X2, Y2, 'woodD'); }
  const [cx, cy] = at(reach * (1 - back) + 2);
  for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) px(g, cx + x, cy + y, x === -3 || y === -2 ? 'steelL' : x === 3 || y === 2 ? 'steelD' : 'steel');
  for (const [x, y] of [[-4, 0], [4, 0], [0, -3], [-2, -3], [2, -3]]) px(g, cx + x, cy + y, 'white'); // spikes
}
function gutFront({ bob = 0, step = 0, hand = null, ang = null, reach = 22, back = 0.45, crouch = 0, eye = null } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = eye ? { ...GUT_MAP, Y: eye } : GUT_MAP, by = bob + crouch;
  grid(ctx, GUT.legL, M, 26, 39 - (step > 0 ? 1 : 0)); grid(ctx, GUT.legR, M, 33, 39 - (step < 0 ? 1 : 0));
  grid(ctx, GUT.torso, M, 25, 30 + by);
  gutChain(ctx, [37, 30 + by], [27, 37 + by]); // the chain, from his left shoulder across his chest
  const hd = hand ? [hand[0], hand[1] + by] : [22, 38 + by];
  limb(ctx, [40, 32 + by], [42, 38 + by + step], 1.9, 1.6, SKIN); grid(ctx, GUT.gauntlet, M, 41, 38 + by + step); // the off arm, the spiked gauntlet
  grid(ctx, GUT.head, M, 23, 17 + by); gutHorns(ctx, 26, 37, 18 + by);
  grid(ctx, GUT.pauldron, M, 38, 29 + by);
  gutMaul(ctx, hd, ang ?? -1.57, reach, back);
  limb(ctx, [24, 32 + by], hd, 1.9, 1.6, SKIN); grid(ctx, GUT.fist, M, hd[0] - 1, hd[1]);
  outline(c, 'ink');
  return c;
}
function gutSide({ bob = 0, step = 0, hand = null, ang = null, reach = 22, back = 0.45, crouch = 0, eye = null, lunge = 0 } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = eye ? { ...GUT_MAP, Y: eye } : GUT_MAP, by = bob + crouch, st = step * 2;
  const far = { ...M, o: 'leafD', O: 'leafD', h: 'leatherD', H: 'leatherD' };
  grid(ctx, GUT.legSide, far, 28 - st, 39 - (step < 0 ? 1 : 0));
  limb(ctx, [35 + lunge, 32 + by], [36 + lunge - step, 38 + by], 1.8, 1.5, ['grass', 'grassD', 'leafD']); grid(ctx, GUT.gauntlet, { ...M, I: 'steel', i: 'steelD', k: 'slate' }, 35 + lunge - step, 38 + by); // the far arm, the gauntlet
  grid(ctx, GUT.legSide, M, 30 + st, 39 - (step > 0 ? 1 : 0));
  grid(ctx, GUT.torsoSide, M, 28 + lunge, 30 + by);
  grid(ctx, GUT.headSide, M, 24 + lunge, 17 + by);
  grid(ctx, HORN, HORN_MAP, 22 + lunge, 14 + by); // a horn, swept back
  const hd = hand ? [hand[0] + lunge, hand[1] + by] : [34, 38 + by];
  gutMaul(ctx, hd, ang ?? 1.2, hand ? reach : 18, hand ? back : 0.3); // held low, its head on the ground ahead of him (upright, it hid his face)
  limb(ctx, [32 + lunge, 32 + by], hd, 1.9, 1.6, SKIN); grid(ctx, GUT.fist, M, hd[0] - 1, hd[1]);
  outline(c, 'ink');
  return c;
}
function gutBack({ bob = 0, step = 0, hand = null, ang = null, reach = 22, back = 0.45, crouch = 0 } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = GUT_MAP, by = bob + crouch;
  const hd = hand ? [hand[0], hand[1] + by] : [42, 38 + by];
  gutMaul(ctx, hd, ang ?? -1.57, reach, back); // facing away, the maul is beyond him
  grid(ctx, GUT.legBackL, M, 26, 39 - (step < 0 ? 1 : 0)); grid(ctx, GUT.legBackR, M, 33, 39 - (step > 0 ? 1 : 0));
  grid(ctx, GUT.torsoBack, M, 25, 30 + by);
  gutChain(ctx, [27, 30 + by], [37, 37 + by]); // the chain, over his left shoulder and down his back
  limb(ctx, [24, 32 + by], [22, 38 + by - step], 1.9, 1.6, SKIN); grid(ctx, GUT.gauntlet, M, 21, 38 + by - step);
  limb(ctx, [40, 32 + by], hd, 1.9, 1.6, SKIN); grid(ctx, GUT.fist, M, hd[0] - 1, hd[1]);
  grid(ctx, GUT.headBack, M, 23, 18 + by); gutHorns(ctx, 26, 37, 19 + by);
  grid(ctx, GUT.pauldron, M, 20, 29 + by);
  outline(c, 'ink');
  return c;
}
// the smash: raised high, brought down on the ground in front, and up again
const GUTF_SMASH = [{ hand: [24, 28], ang: -1.4, reach: 20, back: 0.3, crouch: 1 }, { hand: [28, 41], ang: 1.57, reach: 10, back: 0.2 }, { hand: [26, 40], ang: 1.9, reach: 14, back: 0.3 }];
const GUTS_SMASH = [{ hand: [30, 30], ang: -2.4, reach: 20, back: 0.3, crouch: 1 }, { hand: [39, 40], ang: 0.9, reach: 16, back: 0.3, lunge: 2 }, { hand: [37, 40], ang: 0.3, reach: 18, back: 0.3 }];
const GUTB_SMASH = [{ hand: [40, 40], ang: -1.57, reach: 18, back: 0.3, crouch: 1 }, { hand: [40, 30], ang: -1.6, reach: 14, back: 0.3 }, { hand: [41, 35], ang: -1.57, reach: 18, back: 0.4 }];
export const buildGutcrusher = (views = VIEWS) => cycle(byView({ down: gutFront, side: gutSide, up: gutBack }), { down: GUTF_SMASH, side: GUTS_SMASH, up: GUTB_SMASH }, { bob: 1, crouch: 1, eye: 'white' }, views);

// ---------------------------------------------------------- the Pale Huntsman
// Gloamwood's hunter, drained of colour, and as tall as he was (the user: the
// others keep their size): gaunt, a skull for a face with cold green eyes
// burning in it, a deep hood with antlers branching from it, a ragged pelt
// mantle open on a bare ribcage, a long cloak behind, a quiver on his back
// and a great longbow. 72x72, feet on y 54.
const HUNT_MAP = {
  n: 'night', u: 'slate', v: 'stone', V: 'mist', B: 'bone', W: 'white', k: 'night', G: 'glow', g: 'glow',
  h: 'leatherD', b: 'bone', m: 'mist',
};
export const HUNT = {
  head: rows('hunt head', ['...uuuu...', '..unnnnu..', '.unnnnnnu.', '.unWBBBnu.', 'unkGBBkGnu', 'unBBkBBBnu', 'unBkBkBknu', '.unBBBBnu.', '.uunnnnuu.', '..uuuuuu..']),
  antler: rows('hunt antler', ['b...b.', 'b..b..', 'bb.b..', '.bbb.b', '..bbb.', '...bm.', '....mm', '.....m']),
  torso: rows('hunt torso', ['..uvvvvvvvvu..', '.uvVvvvvvvvvu.', 'uvVvvvvvvvvvvu', 'uvVvvunnuvvvvu', 'uvvvvunnuvvvuu', '.uvvvunnuvvuu.', '.uvuvunnuvuvu.', '..u.unnnnu.u..', '....uhhhhu....', '....uvvvvu....', '...uvvvvvvu...', '...u.v..v.u...']),
  legL: rows('hunt leg L', ['.Vvu', '.Vvu', '.Vvu', '.uuu', '.Vvu', '.Vvu', '.Vvu', '.uuu', '.Vvu', '.Vvu', 'nnnu', 'nnnn']),
  legR: rows('hunt leg R', ['Vvu.', 'Vvu.', 'Vvu.', 'uuu.', 'Vvu.', 'Vvu.', 'Vvu.', 'uuu.', 'Vvu.', 'Vvu.', 'unnn', 'nnnn']),
  hand: rows('hunt hand', ['BV', 'VV']),
};
const BONEARM = ['mist', 'stone', 'slate'];
// the longbow: a tall curved stave of black wood, its string pulled back by `draw` (0 slack .. 1 full) to the hand at `nock`
function huntBow(g, [hx, hy], { half = 15, bend = 3, dir = 1, draw = 0, nock = null, arrow = false } = {}) {
  let top = null, bot = null;
  for (let t = -1; t <= 1.001; t += 1 / (half * 1.5)) {
    const x = hx + dir * (1 - t * t) * bend, y = hy + t * half;
    px(g, Math.round(x), Math.round(y), Math.abs(t) > 0.8 ? 'barkD' : 'barkL');
    px(g, Math.round(x) + dir, Math.round(y), 'barkD');
    if (t <= -1) top = [x, y]; bot = [x, y];
  }
  const mid = draw && nock ? nock : [hx - dir, hy];
  for (const [a, b] of [[top, mid], [mid, bot]]) { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) px(g, Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), 'bone'); }
  if (arrow && nock) { const n = Math.ceil(Math.abs(hx + dir * 4 - nock[0])); for (let i = 0; i <= n; i++) px(g, Math.round(nock[0] + dir * i), Math.round(nock[1]), i > n - 2 ? 'glowL' : 'mist'); px(g, nock[0] - dir, nock[1] - 1, 'bone'); px(g, nock[0] - dir, nock[1] + 1, 'bone'); } // the arrow, its head cold as his eyes
}
// the hood's long pelt cloak, hanging behind him to the ground in tatters
function huntCloak(ctx, cx, y0, n, hw0, grow, sway = 0, [lit, mid] = ['slate', 'night']) {
  for (let i = 0; i < n; i++) { const hw = hw0 + i * grow, y = y0 + i, sw = i > n / 2 ? sway : 0; for (let x = Math.round(cx - hw) + sw; x < Math.round(cx + hw) + sw; x++) { if (i >= n - 2 && (x * 7 + i) % 3 === 0) continue; px(ctx, x, y, i >= n - 2 ? lit : x < cx - hw + 2 ? lit : mid); } }
}
function huntFront({ bob = 0, step = 0, draw = 0, release = false, crouch = 0, eye = null, bowUp = 0 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = eye ? { ...HUNT_MAP, G: eye } : HUNT_MAP, by = bob + crouch;
  huntCloak(ctx, 35.5, 31 + by, 22, 5.5, 0.14, -step); // the cloak, behind: dark, so his pale limbs read against it
  grid(ctx, HUNT.legL, M, 31, 42 - (step > 0 ? 1 : 0)); grid(ctx, HUNT.legR, M, 37, 42 - (step < 0 ? 1 : 0));
  grid(ctx, HUNT.torso, M, 29, 30 + by);
  for (const [x, y] of [[31, 28], [32, 27], [33, 28]]) px(ctx, x, y + by, 'bone', 1, 2); // fletchings, over his shoulder from the quiver on his back
  const bh = [44, 40 + by - bowUp * 4], nock = draw ? [bh[0] - 2 - Math.round(draw * 6), bh[1]] : null;
  limb(ctx, [41, 32 + by], bh, 1.2, 1, BONEARM); // the bow arm
  huntBow(ctx, bh, { dir: 1, draw, nock, arrow: draw > 0 && !release });
  grid(ctx, HUNT.hand, M, bh[0] - 1, bh[1] - 1);
  const dh = nock || [29, 40 + by + step];
  limb(ctx, [30, 32 + by], dh, 1.2, 1, BONEARM); grid(ctx, HUNT.hand, M, dh[0] - 1, dh[1] - 1); // the drawing hand
  grid(ctx, HUNT.head, M, 31, 21 + by);
  grid(ctx, HUNT.antler, M, 26, 14 + by); grid(ctx, HUNT.antler, M, 40, 14 + by, true);
  outline(c, 'ink');
  if (release) for (const [dx, dy] of [[0, 0], [-2, -1], [-2, 1]]) px(ctx, bh[0] - 3 + dx, bh[1] + dy, 'glowL'); // the loosed arrow's cold flash
  c.portraitAt = [28, 18];
  return c;
}
// from the side (facing right): the skull looking out of the hood's opening,
// an antler swept back, the quiver on his back, the cloak trailing behind,
// the bow held out ahead and drawn to his cheek
Object.assign(HUNT, {
  headSide: rows('hunt side head', ['..uuuu....', '.unnnnu...', 'unnnnnnu..', 'unnnWBBu..', 'unnnBkGBu.', 'unnnBBBBBu', 'unnnBkBkBu', '.unnnBBBu.', '.uunnnnu..', '..uuuuu...']),
  torsoSide: rows('hunt side torso', ['.uvvvvu..', 'uvVvvvvu.', 'uvVvvvvvu', 'uvvvvvvnu', 'uvvvvvvnu', '.uvvvvvnu', '.uvuvvunu', '..u.unnnu', '....uhhhu', '....uvvvu', '...uvvvvu', '...u.v.vu']),
  legSide: rows('hunt side leg', ['.Vvu.', '.Vvu.', '.Vvu.', '.uuu.', '.Vvu.', '.Vvu.', '.Vvu.', '.uuu.', '.Vvu.', '.Vvu.', '.nnnn', 'nnnnn']),
  // from behind: the hood, the cloak down his back with the quiver slung across it
  headBack: rows('hunt back head', ['...uuuu...', '..unnnnu..', '.unnnnnnu.', '.unnnnnnu.', 'unnnnnnnnu', 'unnnnnnnnu', 'unnnnnnnnu', '.unnnnnnu.', '.uunnnnuu.', '..uuuuuu..']),
});
function huntQuiver(ctx, x, y) { // a leather quiver slung on his back, the fletchings out of its mouth
  for (let k = 0; k < 10; k++) { const X = x + Math.round(k * 0.45); px(ctx, X, y + k, 'leather'); px(ctx, X + 1, y + k, 'leather'); px(ctx, X + 2, y + k, 'leatherD'); }
  for (const [dx, dy] of [[-1, -2], [0, -3], [1, -2], [2, -3], [3, -2]]) px(ctx, x + dx, y + dy, dx % 2 ? 'mist' : 'bone', 1, 2);
}
function huntSide({ bob = 0, step = 0, draw = 0, release = false, crouch = 0, eye = null, bowUp = 0 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = eye ? { ...HUNT_MAP, G: eye } : HUNT_MAP, by = bob + crouch, st = step * 2;
  for (let i = 0; i < 22; i++) { const w = 3 + Math.round(i * 0.25), y = 31 + by + i; for (let x = 33 - w; x <= 34; x++) if (!(i >= 20 && (x * 7 + i) % 3 === 0)) px(ctx, x - (i > 11 ? step : 0), y, x < 35 - w ? 'slate' : 'night'); } // the cloak, trailing behind
  huntQuiver(ctx, 30, 30 + by);
  grid(ctx, HUNT.legSide, { ...M, V: 'stone', v: 'slate' }, 32 - st, 42 - (step < 0 ? 1 : 0)); // the far leg, in shadow
  const bh = [44, 38 + by - bowUp * 3], nock = draw ? [bh[0] - 3 - Math.round(draw * 5), bh[1]] : null;
  limb(ctx, [37, 32 + by], bh, 1.1, 1, ['stone', 'slate', 'night']); // the bow arm, the far one, out ahead
  huntBow(ctx, bh, { dir: 1, draw, nock, arrow: draw > 0 && !release });
  grid(ctx, HUNT.hand, M, bh[0] - 1, bh[1] - 1);
  grid(ctx, HUNT.legSide, M, 34 + st, 42 - (step > 0 ? 1 : 0));
  grid(ctx, HUNT.torsoSide, M, 31, 30 + by);
  grid(ctx, HUNT.headSide, M, 32, 21 + by);
  grid(ctx, HUNT.antler, M, 27, 14 + by);
  const dh = nock || [37, 40 + by + step];
  limb(ctx, [35, 32 + by], dh, 1.2, 1, BONEARM); grid(ctx, HUNT.hand, M, dh[0] - 1, dh[1] - 1); // the near hand, on the string
  outline(c, 'ink');
  if (release) for (const [dx, dy] of [[0, 0], [2, -1], [2, 1]]) px(ctx, bh[0] + 4 + dx, bh[1] + dy, 'glowL');
  return c;
}
function huntBack({ bob = 0, step = 0, draw = 0, release = false, crouch = 0, bowUp = 0 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = HUNT_MAP, by = bob + crouch;
  const bh = [27, 40 + by - bowUp * 4];
  huntBow(ctx, bh, { dir: -1, draw, nock: draw ? [bh[0] + 2 + Math.round(draw * 6), bh[1]] : null, arrow: draw > 0 && !release }); // facing away, the bow is beyond him
  grid(ctx, HUNT.legL, M, 31, 42 - (step < 0 ? 1 : 0)); grid(ctx, HUNT.legR, M, 37, 42 - (step > 0 ? 1 : 0));
  huntCloak(ctx, 35.5, 30 + by, 22, 6, 0.14, step, ['stone', 'slate']); // the cloak, all down his back, a shade lighter than the hood so the two part
  huntQuiver(ctx, 37, 30 + by);
  limb(ctx, [30, 32 + by], bh, 1.2, 1, BONEARM); grid(ctx, HUNT.hand, M, bh[0] - 1, bh[1] - 1);
  limb(ctx, [41, 32 + by], [42, 40 + by - step], 1.2, 1, BONEARM); grid(ctx, HUNT.hand, M, 41, 39 + by - step);
  grid(ctx, HUNT.headBack, M, 31, 21 + by);
  grid(ctx, HUNT.antler, M, 26, 14 + by); grid(ctx, HUNT.antler, M, 40, 14 + by, true);
  outline(c, 'ink');
  return c;
}
const HUNTF_SHOT = [{ draw: 1, bowUp: 1, crouch: 1 }, { release: true, bowUp: 1 }, { draw: 0.3 }];
export const buildHuntsman = (views = VIEWS) => cycle(byView({ down: huntFront, side: huntSide, up: huntBack }), { down: HUNTF_SHOT, side: HUNTF_SHOT, up: HUNTF_SHOT }, { bob: 1, crouch: 1, eye: 'white' }, views);

// ------------------------------------------------------------ Forgemaster Vulk
// The salamander smith of the Forge of Ash, as big as he was: a hulk of the
// Salamander Warriors' rust-red scales (their lizard head, blunt, the eyes
// set to the sides) under a crown of forged iron spikes with a molten stone
// in it, a scowl, fangs over a pale jaw, a pale throat, a smith's leather
// apron strapped over his chest, iron bracers, clawed feet, a thick tail
// behind, and a great bearded forge-axe whose edge still glows from the fire.
// 72x72, feet on y 54.
const VULK_MAP = {
  A: 'lavaL', R: 'lava', r: 'lavaD', q: 'ashD', B: 'sand', b: 'dirtL',
  H: 'leather', h: 'leatherD', I: 'steelL', i: 'steel', k: 'steelD', F: 'fireL', f: 'fire', Y: 'goldL', E: 'ink', w: 'bone',
};
export const VULK = {
  crown: rows('vulk crown', ['.......II.......', '..I....Ii....I..', '..Ii..IiiI..Ii..', '.kIi.kIiiik.Iik.', 'kIiiiiiFFiiiiiik', 'kkkkkkfFFfkkkkkk']),
  head: rows('vulk head', [
    '..rRRRRRRRRRrr..',
    '.rRAARRRRRRRrrr.',
    'rRAqRRRRRRRRqRrr',
    'rRARqqRRRRqqRRrr',
    'rRAYEYRRRRYEYRrr',
    'rRRYYRRRRRRYYrrr',
    '.rRRRRRRRRRRrrr.',
    '.rRRRrRRRRrRRrr.',
    '.rRRRRRRRRRRrrr.',
    '.rwqqqqqqqqqqwr.',
    '..rBwBBBBBBwBr..',
    '...rrBBBBBBrr...',
    '.....rrrrrr.....',
  ]),
  torso: rows('vulk torso', [
    '........rRRRRRRRRr........',
    '.....rRARBBBBBBBBRRrr.....',
    '..rRAARRhBBBBBBBBhRRRrrr..',
    'rRAAARRRhHHHHHHHHhRRRRrrrr',
    'rRAARRRRhHHHHHHHHhRRRrrrrr',
    'rRARRRRRhHHHhHHHHhRRRrrrr.',
    '.rRRRRRRhHHHHHHHHhRRrrrrr.',
    '.rRRRRRRhHHHHHHHHhRrrrrr..',
    '..rRRhhhhhhiIihhhhhhRrrr..',
    '..rRRRhHHHHHHHHHHHHhRrrr..',
    '...rRRhHHHHHHHHHHHHhrrr...',
    '....rrhHHHHHHHHHHHHhrr....',
    '......hHHHHHHHHHHHHh......',
    '......hHHhHHHHHHhHHh......',
    '......hhhh.hhhhh.hhh......',
  ]),
  legL: rows('vulk leg L', ['ARRRRr.', 'ARRRRr.', 'ARRRrr.', 'ARRRRr.', '.ARRRr.', '.ARRRr.', '.ARRrr.', '.ARRRr.', '.ARRRr.', 'ARRRRRr', 'ARRRRRr', 'wrrwrrw']),
  legR: rows('vulk leg R', ['.RRRRrr', '.RRRRrr', '.RRRrrr', '.RRRRrr', '.RRRrr.', '.RRRrr.', '.RRrrr.', '.RRRrr.', '.RRRrr.', 'RRRRRrr', 'RRRRRrr', 'wrrwrrw']),
  fist: rows('vulk fist', ['.ARr.', 'ARRRr', 'RRRrr', '.w.w.']),
  // from the side (facing right): the long snout, the back hunched and lit, the apron on his front
  crownSide: rows('vulk side crown', ['......II......', '..I...Ii...I..', '..Ii.IiiI..Ii.', '.kIi.kIiik.Iik', 'kIiiiiiiiiFFik', 'kkkkkkkkkfFFfk']),
  headSide: rows('vulk side head', [
    '..rRRRRRRRr.......',
    '.rRAARRRRRRr......',
    'rRAARRRRRqRRrr....',
    'rRARRRRRRRqqRRrr..',
    'rRRRRRRRRRYEYRRRr.',
    'rRRRRRRRRRRRRRRRRr',
    'rRRRRRRRRRRRRRRrRr',
    '.rRRRRRRqqqqqqqqqr',
    '.rBBRRRRRwRRwRRwr.',
    '..rBBBBBBBBBBBBr..',
    '...rrBBBBBBBrrr...',
    '.....rrrrrrr......',
  ]),
  torsoSide: rows('vulk side torso', [
    '.....rRRRRRRr.......',
    '..rRAARRRRRRRr......',
    'rRAARRRRRRRRRBBr....',
    'rRARRRRRRRRRRBBhh...',
    'rRARRRRRRRRRRBhHHh..',
    'rRRRRRRRRRRRRBhHHh..',
    'rRRRRRRRRRRRRBhHHh..',
    '.rRRRRRRRRRRRBhHHh..',
    '.rrhhhhhhhhhhhhiIh..',
    '..rRRRRRRRRRRRhHHHh.',
    '..rRRRRRRRRRRhHHHHh.',
    '...rrRRRRRRRhHHHHh..',
    '.....rrrrrrrhHHHHh..',
    '............hHhHHh..',
    '............hh.hhh..',
  ]),
  legSide: rows('vulk side leg', ['.ARRRr..', '.ARRRr..', '.ARRrr..', '.ARRRr..', '..ARRr..', '..ARRr..', '..ARrr..', '..ARRr..', '..ARRRr.', '.ARRRRRr', '.ARRRRRr', '.rrrrwrw']),
  // from behind: the apron's straps crossed on his back and tied at the belt
  headBack: rows('vulk back head', ['..rRRRRRRRRRrr..', '.rRAARRRRRRRrrr.', 'rRAARRRRRRRRRrrr', 'rRARRRRRRRRRRrrr', 'rRARRRRRRRRRrrrr', 'rRRRRRRRRRRRrrrr', '.rRRRRRRRRRrrrr.', '.rrRRRRRRRRrrrr.', '..rrrRRRRRrrrr..', '....rrrrrrrr....']),
  torsoBack: rows('vulk back torso', [
    '........rRRRRRRRRr........',
    '.....rRAARRRRRRRRRRrr.....',
    '..rRAARRhRRRRRRRRhRRRrrr..',
    'rRAAARRRRhRRRRRRhRRRRRrrrr',
    'rRAARRRRRRhRRRRhRRRRRrrrrr',
    'rRARRRRRRRRhRRhRRRRRRrrrr.',
    '.rRRRRRRRRRRhhRRRRRRrrrrr.',
    '.rRRRRRRRRRhRRhRRRRRrrrr..',
    '..rRRhhhhhhhhhhhhhhhhrrr..',
    '..rRRRRRRRRRhhRRRRRRRrrr..',
    '...rRRRRRRRRRRRRRRRRrrr...',
    '....rrRRRRRRRRRRRRRrrr....',
    '.....rrRRRRRRRRRRRRrr.....',
    '......rrrrrrrrrrrrrr......',
  ]),
};
const SCALES = ['lavaL', 'lava', 'lavaD'];
const BRACERS = [[0.6, 0.85, ['steelL', 'steel', 'steelD']]]; // iron bracers on his forearms
// an arm on its own layer, edged in his dark scale (not ink) where it crosses his body
function vulkArm(ctx, [sx, sy], hd, M, tones = SCALES) {
  layerSoft(ctx, 72, 72, 'lavaD', [[sx, sy]], (g) => { limb(g, [sx, sy], hd, 3.6, 2.8, tones, BRACERS); grid(g, VULK.fist, M, hd[0] - 2, hd[1] - 1); });
}
// the forge-axe: an iron-shod haft through his fist, a broad bearded head on
// one side (`side`: which way the edge faces), its edge glowing from the forge
const BEARD = [4, 5, 5, 6, 5, 5, 6, 7, 8, 8]; // how far the blade reaches from the haft, from the top of the head down: the beard hangs and flares
function vulkAxe(g, [hx, hy], ang, { reach = 26, back = 0.3, side = -1 } = {}) {
  const c = Math.cos(ang), s = Math.sin(ang), lit = -s * L2[0] + c * L2[1] > 0 ? 1 : -1;
  const at = (t, o = 0) => [Math.round(hx + c * t - s * o - 0.5), Math.round(hy + s * t + c * o - 0.5)];
  const top = reach * (1 - back);
  for (let t = -reach * back; t <= top + 1; t += 0.5) { const [X, Y] = at(t); px(g, X, Y, t < -reach * back + 2 ? 'steel' : Math.round(t) % 7 === 3 ? 'woodL' : 'wood'); const [X2, Y2] = at(t, -lit); px(g, X2, Y2, 'woodD'); }
  for (let k = 0; k < BEARD.length; k += 0.5) {
    const w = BEARD[Math.floor(k)], t = top - k;
    for (let o = 1; o <= w; o += 0.5) { const [X, Y] = at(t, o * side); px(g, X, Y, o > w - 1 ? (k > 7 ? 'lavaXL' : 'lavaL') : k < 1 ? 'steelL' : o < 2 ? 'steelD' : 'steel'); } // iron, the edge alone glowing
    if (k >= 1 && k < 5) { const [X, Y] = at(t, -1.5 * side); px(g, X, Y, 'steelD'); } // the poll behind the haft
  }
}
function vulkFront({ bob = 0, step = 0, hand = null, ang = null, reach = 26, back = 0.3, side = -1, grip = null, crouch = 0, eye = null } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = eye ? { ...VULK_MAP, Y: eye } : VULK_MAP, by = bob + crouch;
  limb(ctx, [42, 47], [51, 51 - step], 3.2, 2.2, SCALES); limb(ctx, [51, 51 - step], [59, 52], 2.2, 0.8, SCALES); // the tail, behind, out to his left
  grid(ctx, VULK.legL, M, 27, 42 - (step > 0 ? 1 : 0)); grid(ctx, VULK.legR, M, 38, 42 - (step < 0 ? 1 : 0));
  grid(ctx, VULK.torso, M, 23, 28 + by);
  const hd = hand ? [hand[0], hand[1] + by] : [20, 42 + by - step];
  vulkArm(ctx, [46, 33 + by], grip ? [grip[0], grip[1] + by] : [52, 42 + by + step], M); // the off arm
  grid(ctx, VULK.head, M, 28, 17 + by); grid(ctx, VULK.crown, M, 28, 13 + by);
  vulkAxe(ctx, hd, ang ?? -1.75, { reach, back, side });
  vulkArm(ctx, [25, 33 + by], hd, M);
  outline(c, 'ink');
  c.portraitAt = [28, 15];
  return c;
}
function vulkSide({ bob = 0, step = 0, hand = null, ang = null, reach = 26, back = 0.3, side = -1, grip = null, crouch = 0, eye = null, lunge = 0 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = eye ? { ...VULK_MAP, Y: eye } : VULK_MAP, by = bob + crouch, st = step * 2;
  const far = { ...M, A: 'lava', R: 'lavaD', r: 'lavaD' };
  limb(ctx, [27, 41 + by], [16, 49], 3.4, 2.4, SCALES); limb(ctx, [16, 49], [6, 53 - step], 2.4, 0.8, SCALES); // the tail, sweeping down behind him to the ground
  grid(ctx, VULK.legSide, far, 29 - st, 42 - (step < 0 ? 1 : 0)); // the far leg, in shadow
  if (!grip) vulkArm(ctx, [36 + lunge, 33 + by], [38 + lunge - step, 42 + by], far, ['lava', 'lavaD', 'lavaD']); // the far arm
  grid(ctx, VULK.legSide, M, 32 + st, 42 - (step > 0 ? 1 : 0));
  grid(ctx, VULK.torsoSide, M, 24 + lunge, 28 + by);
  grid(ctx, VULK.headSide, M, 31 + lunge, 18 + by); grid(ctx, VULK.crownSide, M, 32 + lunge, 14 + by);
  const hd = hand ? [hand[0] + lunge, hand[1] + by] : [41, 40 + by];
  vulkAxe(ctx, hd, ang ?? -2.4, hand ? { reach, back, side } : { reach: 24, back: 0.25, side: -1 }); // carried on his shoulder, the head behind him
  if (grip) vulkArm(ctx, [36 + lunge, 33 + by], [grip[0] + lunge, grip[1] + by], far, ['lava', 'lavaD', 'lavaD']);
  vulkArm(ctx, [33 + lunge, 33 + by], hd, M);
  outline(c, 'ink');
  return c;
}
function vulkBack({ bob = 0, step = 0, hand = null, ang = null, reach = 26, back = 0.3, side = 1, crouch = 0 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = VULK_MAP, by = bob + crouch;
  const hd = hand ? [hand[0], hand[1] + by] : [52, 42 + by - step];
  vulkAxe(ctx, hd, ang ?? -1.4, { reach, back, side }); // facing away, the axe is beyond him
  const heel = { ...M, w: 'lavaD' };
  grid(ctx, VULK.legL, heel, 27, 42 - (step < 0 ? 1 : 0)); grid(ctx, VULK.legR, heel, 38, 42 - (step > 0 ? 1 : 0));
  grid(ctx, VULK.torsoBack, M, 23, 28 + by);
  limb(ctx, [36, 39 + by], [39, 49], 3.6, 2.8, SCALES); limb(ctx, [39, 49], [50, 55 + step], 2.8, 0.8, SCALES); // the tail, down to the ground and curling out to one side
  vulkArm(ctx, [25, 33 + by], [20, 42 + by + step], M);
  vulkArm(ctx, [46, 33 + by], hd, M);
  grid(ctx, VULK.headBack, M, 28, 18 + by); grid(ctx, VULK.crown, { ...M, F: 'steel', f: 'steelD' }, 28, 14 + by);
  for (let y = 20; y <= 38; y += 3) { if (y > 26 && y < 29) continue; px(ctx, 35, y + by, 'lavaL'); px(ctx, 36, y + by, 'lavaD'); px(ctx, 35, y + 1 + by, 'lavaD', 2, 1); } // the ridge of raised scales from the back of his head down his spine
  outline(c, 'ink');
  return c;
}
// the chop: raised over his head in both hands, brought down on the ground before him, and lifted again
const VULKF_CHOP = [{ hand: [26, 28], ang: -1.25, reach: 26, back: 0.3, side: -1, grip: [31, 31], crouch: 1 }, { hand: [33, 46], ang: 1.57, reach: 16, back: 0.2, side: 1, grip: [39, 44] }, { hand: [28, 44], ang: 2.0, reach: 20, back: 0.3, side: 1, grip: [36, 42] }];
const VULKS_CHOP = [{ hand: [33, 28], ang: -2.2, reach: 26, back: 0.3, side: -1, grip: [36, 30], crouch: 1 }, { hand: [43, 40], ang: 0.8, reach: 20, back: 0.25, side: -1, grip: [40, 38], lunge: 2 }, { hand: [41, 41], ang: 0.4, reach: 22, back: 0.3, side: -1, grip: [38, 40] }];
const VULKB_CHOP = [{ hand: [48, 30], ang: -1.6, reach: 24, back: 0.3, side: 1, crouch: 1 }, { hand: [46, 32], ang: -1.65, reach: 16, back: 0.2, side: 1 }, { hand: [50, 38], ang: -1.5, reach: 22, back: 0.3, side: 1 }];
export const buildVulk = (views = VIEWS) => cycle(byView({ down: vulkFront, side: vulkSide, up: vulkBack }), { down: VULKF_CHOP, side: VULKS_CHOP, up: VULKB_CHOP }, { bob: 1, crouch: 1, eye: 'white' }, views);

// ----------------------------------------------------------------- Queen Mab
// The Gloom Spiders' queen, as big as she was: their purple chitin, a round
// abdomen marked with a pale skull, a body and head crowned with bone spines,
// a cluster of red eyes, long white fangs, and eight long jointed legs, each
// knee catching a glint of violet. 96x72, feet on y 54; a creature's frames
// ({ view: { anim: [canvas] } }) for assets.js creatureViews.
// a body part as a flat-shaded oval (light, mid, dark by which way it faces the light), with a highlight
function blob(ctx, cx, cy, rx, ry, [lit, mid, dark], hi = null) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = nx * L2[0] + ny * L2[1];
    let col = l > 0.5 ? lit : l < -0.35 || d > 0.85 && l < 0.1 ? dark : mid; // a lit cap, not a split down the middle
    if (hi && Math.hypot(nx + 0.4, ny + 0.5) < 0.22) col = hi;
    px(ctx, x, y, col);
  }
}
const MAB_MAP = { b: 'bone', W: 'white', n: 'night', E: 'redL' };
const MAB_SKULL = rows('mab skull', ['..bbb..', '.Wbbbb.', 'bnnbnnb', 'bbbbbbb', '.bbnbb.', '.b.b.b.']);
const CHIT = ['purpL', 'purp', 'purpD'];
const MAB_LEG = ['purp', 'purpD', 'night'];
// a leg: up from the hip to a high knee, then down to the foot; a glint on the knee
function mabLeg(ctx, hip, knee, foot, far = false) {
  const T = far ? ['purpD', 'night', 'night'] : MAB_LEG;
  limb(ctx, hip, knee, 1.5, 1.1, T); limb(ctx, knee, foot, 1.1, 0.5, T);
  if (!far) px(ctx, Math.round(knee[0] - 0.5), Math.round(knee[1] - 1.5), 'purpL');
}
// the crown of bone spines on her head, tallest in the middle
function mabCrown(ctx, x, y, w = 3) { [3, 5, 3].forEach((h, i) => { const X = Math.round(x + (i - 1) * w); px(ctx, X, y - h, 'bone', 2, h); px(ctx, X, y - h, 'white', 1, h - 1); px(ctx, X + 1, y - h, 'mist'); }); } // three thick spines, the middle one tallest
function mabFangs(ctx, x, y, open) { for (const dx of [-2, 2]) { const o = open ? Math.sign(dx) : 0; px(ctx, x + dx + o, y, 'white', 1, open ? 4 : 3); px(ctx, x + dx + o, y + (open ? 3 : 2), 'bone'); } }
// the legs from above, splayed round her like a spider's: each pair at its
// own angle from her body (the front pair reaching ahead, the rear pair back),
// the knee raised high, the foot out on the ground (the ground foreshortened
// to 0.6 of its depth seen from above); `away` turns the layout round for the back view
const MAB_ANG = [40, 12, -15, -42].map((d) => d * Math.PI / 180);
function mabLegsTop(ctx, cx, cy, { step = 0, rear = 0, lunge = 0, away = false } = {}) {
  MAB_ANG.forEach((a0, i) => { for (const sx of [-1, 1]) {
    const lifted = step && (i + (sx > 0 ? 1 : 0) + step) % 2, a = a0 + (step ? (lifted ? 0.07 : -0.07) : 0), lift = lifted ? 3 : 0;
    const up = i === 0 ? rear * 8 : 0, fwd = i === 0 ? lunge : 0, dy = away ? -1 : 1;
    const at = (R, z) => [cx + sx * R * Math.cos(a), cy + dy * (R * 0.6 * Math.sin(a) + fwd) - z];
    mabLeg(ctx, at(6, 0), at(16 - up * 0.4, 10 + up + lift), at(26 - up, lift + up * 1.4));
  } });
}
function mabFront({ step = 0, rear = 0, open = false, lunge = 0, eye = null } = {}) {
  const [c, ctx] = frame(96, 72), cx = 48, r = Math.round(rear * 2), M = eye ? { ...MAB_MAP, E: eye } : MAB_MAP;
  blob(ctx, cx, 32 - r, 13, 10, CHIT, 'purpL'); grid(ctx, MAB_SKULL, MAB_MAP, cx - 3.5, 28 - r); // the abdomen behind, its skull
  mabLegsTop(ctx, cx, 43 - r, { step, rear, lunge });
  blob(ctx, cx, 43 - r + lunge * 0.5, 8, 6, CHIT, 'purpL'); // her body
  const hy = 49 - r + lunge;
  blob(ctx, cx, hy, 6, 4.5, CHIT);
  mabCrown(ctx, cx - 1, hy - 3);
  grid(ctx, rows('mab eyes', ['E.WE.WE.E', '..EE.EE..']), M, cx - 4.5, hy - 1); // two great eyes catching the light, two small beside them
  mabFangs(ctx, cx - 0.5, hy + 3, open);
  outline(c, 'ink');
  return c;
}
function mabBack({ step = 0, rear = 0, open = false, lunge = 0 } = {}) {
  const [c, ctx] = frame(96, 72), cx = 48, r = Math.round(rear * 2);
  mabLegsTop(ctx, cx, 43 - r, { step, rear, lunge, away: true }); // the front pair now reach away
  const hy = 37 - r - lunge;
  blob(ctx, cx, hy, 5.5, 4, CHIT); mabCrown(ctx, cx - 1, hy - 2); // her head, beyond
  blob(ctx, cx, 43 - r - lunge * 0.5, 8, 6, CHIT, 'purpL');
  blob(ctx, cx, 50, 13, 9, CHIT, 'purpL'); grid(ctx, [...MAB_SKULL].reverse(), MAB_MAP, cx - 3.5, 46); // the abdomen, nearest, its skull seen the other way up
  if (open) { px(ctx, cx - 3, hy + 3, 'white'); px(ctx, cx + 2, hy + 3, 'white'); }
  outline(c, 'ink');
  return c;
}
function mabSide({ step = 0, rear = 0, open = false, lunge = 0, eye = null } = {}) {
  const [c, ctx] = frame(96, 72), r = Math.round(rear * 2), M = eye ? { ...MAB_MAP, E: eye } : MAB_MAP;
  const KX = [68, 60, 47, 38], FX = [80, 69, 40, 24], KY = [32, 30, 30, 32]; // knees high, feet spread fore and aft
  const leg = (i, far) => { const lift = step && (i + (far ? 1 : 0) + step) % 2 ? 3 : 0, up = i === 0 ? rear * 9 : 0, o = far ? -3 : 0;
    mabLeg(ctx, [56 - i * 2 + lunge, 44 - r], [KX[i] + o + lunge * (i === 0 ? 1 : 0), KY[i] - up - lift + o], [FX[i] + o + (i === 0 ? lunge * 2 : 0), 54 - up * 1.4 - lift + (far ? -2 : 0)], far); };
  for (let i = 3; i >= 0; i--) leg(i, true); // the far legs, behind her, in shadow
  blob(ctx, 35, 39 - r, 14, 10, CHIT, 'purpL'); grid(ctx, MAB_SKULL, MAB_MAP, 31, 31 - r); // the abdomen, the skull on its back
  blob(ctx, 53 + lunge * 0.5, 43 - r, 8, 6, CHIT, 'purpL');
  const hx = 61 + lunge, hy = 44 - r;
  blob(ctx, hx, hy, 5, 4.5, CHIT); mabCrown(ctx, hx - 2, hy - 3, 2.5);
  grid(ctx, rows('mab side eyes', ['WE.', 'EE.', '.EE']), M, hx + 2, hy - 2);
  for (const dx of [0, 2]) px(ctx, hx + 3 + dx + (open ? dx / 2 : 0), hy + 3, 'white', 1, open ? 4 : 3); // the fangs
  for (let i = 3; i >= 0; i--) leg(i, false);
  outline(c, 'ink');
  return c;
}
const MAB_POSES = { idle: [{}, { rear: 0.5 }], walk: [{ step: 1 }, { step: 2 }, { step: 1 }, { step: 2 }], windup: [{ rear: 1, open: true }, { rear: 1.5, open: true }], attack: [{ lunge: 3, open: true }, {}], hurt: [{ eye: 'white' }] };
export const buildMab = (views = VIEWS) => { const out = {}; const fn = { down: mabFront, side: mabSide, up: mabBack }; for (const v of views) { out[v] = {}; for (const [a, ps] of Object.entries(MAB_POSES)) out[v][a] = ps.map((p) => fn[v](p)); } return out; };

// --------------------------------------------------------------- Mother Murk
// The Mistfen's hag on her toad, as big as she was: a vast Croaker (its moss
// hide, warts lit on top, the sandy throat that swells, gold eyes up in their
// bulges with a heavy lid, a mouth from ear to ear) and on its back a Marsh
// Witchling grown old (the same moss skin, lank black hair, a crooked hat
// with a bog-green band), hunched in a violet shawl, raising hex-lit hands.
// 80x72, feet on y 54; a creature's frames for assets.js creatureViews.
const MURK_MAP = {
  S: 'mossL', s: 'moss', L: 'mossXL', n: 'mossD', E: 'goldL', m: 'mudD', w: 'bone', h: 'night', H: 'hairBkL',
  P: 'night', p: 'hexD', K: 'slate', r: 'mud', b: 'bogL',
  V: 'purp', v: 'purpD', U: 'purpL', D: 'night', d: 'ink', g: 'curseL',
};
export const MURK = {
  head: {
    down: rows('murk head down', ['hhSLSSSShh', 'hSLSSSSSsh', 'hSnSSSSnsh', 'hSEnSSnEsh', 'hSSSLnSSsh', 'hsSSSLnSsh', 'hsSmmwmssh', 'h.ssSSss.h', 'h..ssss..h']),
    side: rows('murk head side', ['hhhSLSSS..', 'hhSLSSSSs.', 'hhSSSSSnn.', 'hhSSSSSEn.', 'hhSSSSSSLn', 'hhsSSSSSSn', 'hhsSSSmmw.', 'h.ssSSSs..', 'h...sssS..']),
    up: rows('murk head up', ['hhHHhhhhhh', 'hHHhhhhhhh', 'hHhhhhhhhh', 'hhhhhhhhhh', 'hhhhhhhhhh', 'hhhhhhhhhh', 'hhhhhhhhhh', 'h.hhhhhh.h', 'h..hhhh..h']),
  },
  hat: {
    down: rows('murk hat down', ['........KPPPp...', '.......KPp..pp..', '.......KPp...p..', '......KPPp......', '......KPPp......', '.....KPPPPp.....', '.....KPrPPp.....', '....KPPPPPPp....', '....bbbbbbbb....', 'KPPPPPPPPPPPPPPp', '.pppppppppppppp.']),
    side: rows('murk hat side', ['KPPp............', 'K..PPp..........', '....KPp.........', '....KPPp........', '....KPPPp.......', '...KPPPPPp......', '...KPPrPPp......', '..KPPPPPPPp.....', '..bbbbbbbbb.....', 'KPPPPPPPPPPPPp..', '.pppppppppppp...']),
  },
  shawl: {
    down: rows('murk shawl down', ['...vUVVVVVv...', '.vUVVVVVVVVVv.', 'vUVVVVgVVVVVVv', 'vVVVvVVVvVVVVv', 'vVVVDvVvDVVVvv', 'vVVDDDvDDDVVvv', '.vvDDDDDDDvvv.', '.v.dDDDDDd.v..', '...dDDDDDd....']),
    side: rows('murk shawl side', ['...vUVVVv...', '..vUVVVVVv..', '.vUVVVVVVVv.', '.vVVVVVVVVv.', 'vVVVVVVVVvD.', 'vVVVVVVVvDD.', '.vVVVvvvDDD.', '.v.vv.dDDDd.', '......dDDDd.']),
    up: rows('murk shawl up', ['...vUVVVVVv...', '.vUVVVVVVVVVv.', 'vUVVVVVVVVVVVv', 'vVVVVVVVVVVVVv', 'vVVVVVVVVVVVvv', '.vVVVVVVVVVvv.', '..vVVVVVVVvv..', '..v.vVVVv.v...', '......vv......']),
  },
};
const TOADT = ['mossL', 'moss', 'mossD'];
const TOADFAR = ['moss', 'mossD', 'mossD'];
const BELLY = ['sand', 'dirtL', 'dirt']; // the Croaker's sandy underside, kept below the hide's brightest moss
const HAGARM = ['purp', 'purpD', 'hexD'];
const HAGHAND = [[0.6, 1, ['mossXL', 'mossL', 'moss']]];
const WARTS = [[-0.72, -0.25], [-0.46, -0.55], [-0.22, -0.2], [0.28, -0.5], [0.52, -0.12], [0.78, -0.35], [-0.86, 0.12], [0.86, 0.08], [-0.55, 0.15], [0.4, 0.12], [-0.05, -0.62], [0.12, -0.05]];
function murkWarts(ctx, cx, cy, rx, ry, skip = () => false) {
  for (const [nx, ny] of WARTS) { const x = Math.round(cx + nx * rx), y = Math.round(cy + ny * ry); if (skip(x, y)) continue; px(ctx, x, y, nx + ny < 0.2 ? 'mossXL' : 'mossL'); px(ctx, x + 1, y + 1, 'mossD'); } // a bump lit on top, its shadow under
}
const MURK_EYE = { n: 'mossD', E: 'goldL', y: 'gold', e: 'ink' };
function murkEye(ctx, x, y, eye, side = false) { grid(ctx, side ? ['nnn', 'EeE', 'yEy'] : ['nnnn', 'EeeE', 'yEEy'], eye ? { ...MURK_EYE, E: eye, y: eye } : MURK_EYE, x, y); } // a heavy lid over a gold eye, its pupil a slit across
function murkToes(ctx, x, y, dir = 0) { for (const dx of [-2, 0, 2]) px(ctx, x + dx + dir * (dx + 2) * 0.5, y, 'mossL', 1, 1); }
// her hex-lit hand
function hexHand(ctx, x, y) { px(ctx, x - 1, y - 1, 'curse', 3, 3); px(ctx, x, y, 'white'); px(ctx, x - 3, y - 3, 'curseL'); px(ctx, x + 2, y - 4, 'curseL'); px(ctx, x + 3, y, 'curse'); }
// the hag, hunched on the toad's back: her shawl's top at y, centred on x
function hagFront(ctx, x, y, raise, back = false) {
  const R = Math.round(raise * 7);
  for (const sx of [-1, 1]) { const hand = raise ? [x + sx * 11, y - 3 - R] : [x + sx * 7, y + 10]; limb(ctx, [x + sx * 5, y + 3], hand, 1.6, 1.2, HAGARM, HAGHAND); if (raise) hexHand(ctx, ...hand); }
  grid(ctx, MURK.shawl[back ? 'up' : 'down'], MURK_MAP, x - 7, y);
  grid(ctx, MURK.head[back ? 'up' : 'down'], MURK_MAP, x - 5, y - 6);
  grid(ctx, MURK.hat.down, MURK_MAP, x - 8, y - 15, back);
}
function hagSide(ctx, x, y, raise) {
  grid(ctx, MURK.shawl.side, MURK_MAP, x - 6, y);
  grid(ctx, MURK.head.side, MURK_MAP, x - 3, y - 6);
  grid(ctx, MURK.hat.side, MURK_MAP, x - 6, y - 15);
  const R = Math.round(raise * 7), hand = raise ? [x + 9, y - 3 - R] : [x + 8, y + 8];
  limb(ctx, [x + 2, y + 3], hand, 1.6, 1.2, HAGARM, HAGHAND); if (raise) hexHand(ctx, ...hand); // her near arm, reaching forward
}
// the toad's body: its centre and radii, by how it puffs, rises for the
// windup and squashes flat in the slam
function toadBody({ puff = 0, rise = 0, squash = 0 }) { return { by: 39 - rise + squash, rx: 22 + puff + squash * 2, ry: 13 + puff * 0.5 - squash }; }
function murkFront({ step = 0, puff = 0, open = 0, raise = 0, rise = 0, squash = 0, eye = null } = {}) {
  const [c, ctx] = frame(80, 72), cx = 40, { by, rx, ry } = toadBody({ puff, rise, squash }), top = by - ry;
  hagFront(ctx, cx, top - 6, raise); // sitting on its back, behind its head
  for (const sx of [-1, 1]) { blob(ctx, cx + sx * (20 + squash), by + 5, 8, 7, TOADT); blob(ctx, cx + sx * (28 + squash), 52, 5, 2.5, TOADFAR); } // the folded hind legs and their feet
  blob(ctx, cx, by, rx, ry, TOADT, 'mossXL');
  murkWarts(ctx, cx, by, rx, ry, (x, y) => Math.abs(x - cx) < 6 && y < by - 4);
  for (const sx of [-1, 1]) { const ex = cx + sx * 12; blob(ctx, ex, top + 2, 5, 4.5, TOADT, sx < 0 ? 'mossXL' : null); murkEye(ctx, ex - 2, top + 1, eye); } // the eyes bulging on top
  blob(ctx, cx, by + 10 + puff * 0.5, 9 + puff * 2, 2.5 + puff, BELLY); // the sandy throat under the jaw, swelling
  const my = by + 2; // a lit upper lip over a mouth from ear to ear, its corners turned down
  for (let x = -17; x <= 17; x++) { const y = my + Math.round((x / 17) ** 2 * 3); if (Math.abs(x) < 15) px(ctx, cx + x, y - 1, 'mossL'); px(ctx, cx + x, y, 'ink'); if (open && Math.abs(x) < 15) px(ctx, cx + x, y + 1, 'redD', 1, Math.round(open * 1.6 * (1 - (x / 15) ** 2)) + 1); } // gaping for the slam
  if (open > 1) px(ctx, cx - 3, my + 3, 'redL', 6, 2); // the tongue
  for (const sx of [-1, 1]) { const lift = step && (sx > 0) === (step > 0) ? 2 : 0, f = [cx + sx * (21 + squash), 53 - lift]; limb(ctx, [cx + sx * 14, by + 6], f, 3.5, 2.6, TOADT); murkToes(ctx, f[0], 54 - lift); } // the front legs, splayed
  outline(c, 'ink');
  return c;
}
function murkSide({ step = 0, puff = 0, open = 0, raise = 0, rise = 0, squash = 0, eye = null } = {}) {
  const [c, ctx] = frame(80, 72), { by, rx, ry } = toadBody({ puff, rise, squash }), bx = 36;
  const lift = (near) => step && near === step > 0 ? 2 : 0;
  limb(ctx, [51, by + 4], [57 + squash, 52 - lift(false)], 3, 2.2, TOADFAR); // the far front leg
  blob(ctx, 22, 52, 7, 2.5, TOADFAR); // the far hind foot
  hagSide(ctx, 33, by - ry - 6, raise);
  blob(ctx, bx, by, rx - 2, ry - 0.5, TOADT, 'mossXL');
  blob(ctx, bx + 16 + squash, by + 1, 9, 8.5, TOADT); // its broad head
  murkWarts(ctx, bx - 2, by, rx - 4, ry, (x, y) => x > 26 && x < 40 && y < by - 6);
  blob(ctx, 50, by - 9, 4.5, 4, TOADT, 'mossXL'); murkEye(ctx, 50, by - 10, eye, true);
  blob(ctx, bx, by + 9, 16, 3.5, BELLY); blob(ctx, 51 + squash, by + 7 + puff * 0.3, 5 + puff * 0.6, 3 + puff * 0.6, BELLY); // the pale belly and the throat
  for (let x = 0; x <= 15; x++) { const X = 61 + squash - x, Y = by + 2 + Math.round(x * 0.18); px(ctx, X, Y, 'ink'); if (open && x > 1) px(ctx, X, Y + 1, 'redD', 1, Math.round(open * 1.4 * (x < 8 ? x / 8 : 1))); } // the long jaw line, dropping open
  if (open > 1) px(ctx, 56, by + 5, 'redL', 3, 1);
  layerSoft(ctx, 80, 72, 'mossD', [[24, by - 3]], (g) => { blob(g, 24, by + 4, 9, 7.5, TOADT, 'mossXL'); }); // the near hind leg, folded
  limb(ctx, [28, by + 10], [38, 53 - lift(true)], 2.6, 1.8, TOADT); murkToes(ctx, 39, 54 - lift(true), 1); // its long foot, flat forward
  const f = [56 + squash, 53 - lift(true)]; limb(ctx, [50, by + 6], f, 3.2, 2.5, TOADT); murkToes(ctx, f[0] + 1, 54 - lift(true), 1); // the near front leg
  outline(c, 'ink');
  return c;
}
function murkBack({ step = 0, puff = 0, raise = 0, rise = 0, squash = 0 } = {}) {
  const [c, ctx] = frame(80, 72), cx = 40, { by, rx, ry } = toadBody({ puff, rise, squash }), top = by - ry;
  for (const sx of [-1, 1]) blob(ctx, cx + sx * 12, top + 3, 4.5, 4, TOADT); // its eyes, beyond
  for (const sx of [-1, 1]) { const lift = step && (sx > 0) === (step > 0) ? 2 : 0; blob(ctx, cx + sx * (21 + squash), 52 - lift, 4, 2, TOADFAR); } // the front feet peeking out
  blob(ctx, cx, by, rx, ry, TOADT, 'mossXL');
  murkWarts(ctx, cx, by, rx, ry, (x, y) => Math.abs(x - cx) < 8 && y < by + 2);
  for (const sx of [-1, 1]) {
    layerSoft(ctx, 80, 72, 'mossD', [[cx + sx * 12, by]], (g) => blob(g, cx + sx * (17 + squash), by + 7, 9, 6.5, TOADT, sx < 0 ? 'mossXL' : null)); // the hind legs, nearest
    blob(ctx, cx + sx * (27 + squash), 52, 6, 2.5, TOADT); murkToes(ctx, cx + sx * (29 + squash), 54);
  }
  hagFront(ctx, cx, top + 2, raise, true); // on its back, nearer than its head
  outline(c, 'ink');
  return c;
}
const MURK_POSES = {
  idle: [{}, { puff: 1 }], walk: [{ step: 1 }, { rise: 1 }, { step: -1 }, { rise: 1 }],
  windup: [{ puff: 2, raise: 1, rise: 1 }, { puff: 3, raise: 1, rise: 2 }], slam: [{ open: 3, squash: 2 }, { open: 1, squash: 1 }], hurt: [{ eye: 'white' }],
};
export const buildMurk = (views = VIEWS) => { const out = {}; const fn = { down: murkFront, side: murkSide, up: murkBack }; for (const v of views) { out[v] = {}; for (const [a, ps] of Object.entries(MURK_POSES)) out[v][a] = ps.map((p) => fn[v](p)); } return out; };
