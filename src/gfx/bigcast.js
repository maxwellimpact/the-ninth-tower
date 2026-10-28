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
  head: rows('snag front head', [
    '........hhhhhhhh........',
    '......hhHHHHHHHHhh......',
    '.....hHHjjHHHHHHHHh.....',
    '.....hHjHHHHHHHHHHh.....',
    '....hhHHHHHHHHHHHHhh....',
    'LLL..ghhhhhhhhhhhhg..ggg',
    'XXLLLGGgGGGGGGGGgGGgggdd',
    '..gLLGGLGGGGGGGGGGgggd..',
    '....gGLGGGGGGGGGGGGg....',
    '....GGyYGGGGGGGGyYGG....',
    '....GGYYGGGGGGGGYYGg....',
    '....gGGrGGGLgGGGrGGg....',
    '.....gGGwGGGGGGGGgg.....',
    '.....gGGwwwwwGGgg.......',
    '.......gggggggg.........',
  ]),
  torso: rows('snag front torso', [
    '..VVvVvvvvVvvu..',
    '.VVvVvvvvvvvVvu.',
    'VVvVvuvvvvuvvvuu',
    '.uvDTuTTTTuTTvu.',
    '.DTTTTTTTTTTTTt.',
    '.DTTrTTTTTTTTTt.',
    '.DTTTTTTTTrTTTt.',
    '.hhhhhhYYhhhhhh.',
    '.DTTTTTTTTTTTTt.',
    '..tTTtTTTtTTTt..',
    '..t.tTt..tTt.t..',
  ]),
  legL: rows('snag front leg L', ['.ooO.', '.ooO.', '.ooO.', '.ooO.', '.ooO.', 'hHhh.', 'hHhhh', 'hhhhh']),
  legR: rows('snag front leg R', ['.oOO.', '.oOO.', '.oOO.', '.oOO.', '.oOO.', '.hhhh', 'hHhhh', 'hhhhh']),
  fist: rows('snag front fist', ['LGg', 'GGg', 'ggd']),
};
function snagFront({ bob = 0, step = 0, hand = null, ang = null, reach = 36, crouch = 0, eye = null } = {}) {
  const W = 80, H = 64, [c, ctx] = frame(W, H, 8), M = SNAGF_MAP, by = bob + crouch;
  const put = (r, x, y, m = M) => grid(ctx, r, m, x, y);
  put(SNAGF.legL, 26, 41 - (step > 0 ? 1 : 0)); put(SNAGF.legR, 33, 41 - (step < 0 ? 1 : 0));
  put(SNAGF.torso, 24, 30 + by);
  const arm = (s, h) => { limb(ctx, s, h, 1.7, 1.5, SKIN); put(SNAGF.fist, h[0] - 1, h[1] - 1); };
  const hd = hand ? [hand[0], hand[1] + by] : [23, 38 + by];
  arm([39, 33 + by], [41, 38 + by + step]); // the off arm
  snagSpear(ctx, hd, ang ?? -1.57, reach, 0.25);
  arm([25, 33 + by], hd);
  put(SNAGF.head, 20, 17 + by, eye ? { ...M, Y: eye, y: eye } : M);
  for (const [x, y, col, w] of [[36, 17, 'redD', 2], [37, 16, 'red', 2], [38, 15, 'red', 2], [39, 14, 'redL', 2], [40, 13, 'redL', 1]]) px(ctx, x, y + by, col, w, 1); // a red feather tucked in the hood, swept back
  outline(c, 'ink');
  return c;
}

// Malgrim facing you, on the heroes' proportions: the crooked hat a little
// taller than his head, a pale face with the curse in his eyes under dark
// brows and an iron-grey beard, the red-lined collar standing up beside it,
// a shorter violet coat over pointed boots, short bell sleeves, the staff.
export const MALF = {
  hat: rows('mal front hat', MAL.hat.down.filter((_, i) => ![1, 3, 5, 7].includes(i))),
  face: rows('mal front face', [
    '.vvvvvvvvvvvv.',
    '.fnnffffffnnv.',
    '.fnCffffffCnv.',
    '.ffffffFfffvv.',
    '.fffffFFfffvv.',
    '..fdggggggdv..',
    '..vgGgEEgggv..',
    '...gGgggggd...',
    '....gGgggd....',
    '.....gGd......',
  ]),
  collar: rowsAt('mal front collar', 22, ['1:P|20:x', '1:Pr|19:rx', '1:PRr|18:rrx', '1:PRrr|17:rrrx', '0:PPpRr|16:rRppx', '0:PPpppppppppppppppxxxx']),
  hand: rows('mal front hand', ['ff.', 'fFv', '.vv']),
};
function malCoatFront(ctx, cx, y0, sway = 0) {
  const n = 15;
  for (let i = 0; i < n; i++) {
    let hw = 7.5 + i * 0.24;
    if (i >= 3 && i <= 5) hw -= 0.5; // the waist, pulled in by the belt
    const sw = i >= 8 ? Math.round(sway * (i - 7) / 7) : 0;
    const l = Math.round(cx - hw) + sw, r = Math.round(cx + hw) - 1 + sw, y = y0 + i;
    for (let x = l; x <= r; x++) {
      const u = (x - l) / Math.max(1, r - l), rel = x - (cx + sw);
      let col = u < 0.1 ? 'purpL' : u > 0.8 ? 'purpD' : 'purp';
      if (Math.abs(rel + 0.5) < 2.6) col = Math.abs(rel + 0.5) > 1.6 ? 'redD' : 'night'; // the front panel, red lining at its edges
      if (i >= 7 && i <= 12 && (rel === -5 || rel === 4)) col = 'purpD'; // folds
      if (i === 4) col = 'hexD'; // the belt
      if (i === n - 2) col = (x + 1) % 4 === 0 ? 'curse' : 'purpD'; // the hem's runes
      if (i === n - 1 && (x + sway) % 3 === 0) continue; // a ragged edge
      px(ctx, x, y, col);
    }
  }
  px(ctx, cx - 1, y0 + 4, 'curseL', 2, 1); px(ctx, cx - 2, y0 + 4, 'curse'); px(ctx, cx + 1, y0 + 4, 'curse'); // the hex for a buckle
  for (const i of [8, 11]) px(ctx, cx - 1, y0 + i, 'curse', 2, 1); // runes down the panel
}
const MALF_MAP = { ...MAL_MAP, f: 'skinL', F: 'white', v: 'skin', C: 'curse', g: 'mist', G: 'bone', d: 'stone' }; // a pale but living face, the curse burning in his eyes, a grey-white beard (a darker grey read as a mask)
function malFront({ bob = 0, step = 0, hand = null, ang = null, glow = 0, off = null, cast = 0, crouch = 0, eye = null, reach = 30 } = {}) {
  const W = 72, H = 72, [c, ctx] = frame(W, H), M = MAL_MAP, by = bob + crouch, lights = [];
  grid(ctx, MAL.boot, M, 30, 52 - (step > 0 ? 1 : 0)); grid(ctx, MAL.boot, M, 37, 52 - (step < 0 ? 1 : 0));
  malCoatFront(ctx, 36, 38 + by, -step);
  grid(ctx, MALF.collar, COAT_MAP, 25, 31 + by);
  const sleeve = (s, h) => layerSoft(ctx, W, H, 'hexD', [s], (g) => { limb(g, s, [h[0], h[1] - 1], 2, 2.8, SLEEVE); px(g, h[0] - 1, h[1] - 1, 'night', 3, 1); grid(g, MALF.hand, M, h[0] - 1, h[1]); }); // edged in the coat's darkest violet where it crosses the coat
  const hd = hand ? [hand[0], hand[1] + by] : [25, 45 + by], oh = off ? [off[0], off[1] + by] : [47, 45 + by - step];
  sleeve([45, 39 + by], oh);
  lights.push(malStaff(ctx, hd, ang ?? -1.57, { up: reach, down: 9, glow }));
  sleeve([27, 39 + by], hd);
  grid(ctx, MALF.face, eye ? { ...MALF_MAP, C: eye } : MALF_MAP, 29, 24 + by);
  grid(ctx, MALF.hat, M, 25, 11 + by);
  outline(c, 'ink');
  malGlow(ctx, lights[0], glow);
  if (cast) malGlow(ctx, [oh[0], oh[1] + 1], cast);
  return c;
}

// the front views' attacks, on the new proportions
const SNAGF_THRUST = [{ hand: [23, 34], ang: 1.75, reach: 24, crouch: 1 }, { hand: [25, 40], ang: 1.62, reach: 20 }, { hand: [23, 37], ang: 1.7, reach: 22 }];
const MALF_BOLT = [{ hand: [26, 42], ang: -1.85, glow: 1, off: [44, 40], cast: 1 }, { hand: [26, 44], ang: -1.4, glow: 2, off: [40, 47], cast: 2 }, { hand: [25, 45], ang: -1.5, glow: 1 }];
const MALF_CAST = [{ hand: [27, 38], ang: -1.57, glow: 1, reach: 26, off: [47, 40], cast: 1 }, { hand: [28, 35], ang: -1.57, glow: 2, reach: 26, off: [48, 37], cast: 2, bob: -1 }, { hand: [27, 38], ang: -1.57, glow: 1, reach: 26, off: [47, 40], cast: 1 }];
// facing you: the redrawn front; the side and back views are still the first pass
const front = (fn, other) => (view, pose) => (view === 'down' ? fn(pose) : other(view, pose));
export const buildSnagtooth = (views = VIEWS) => cycle(front(snagFront, snagtooth), { ...SNAG_THRUST, down: SNAGF_THRUST }, { bob: 1, crouch: 1, eye: 'white' }, views);
export const buildMalgrim = (views = VIEWS) => cycle(front(malFront, malgrim), { ...MAL_BOLT, down: MALF_BOLT }, { bob: 1, crouch: 1, eye: 'white', ang: -1.75 }, views, { ...MAL_CAST, down: MALF_CAST });
