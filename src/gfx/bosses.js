// Big bosses, hand-built (2026-10-27): each is a 3D model (gfx/modeler.js)
// rendered in all three views at the cast's own pixel size, instead of a
// hero-sized puppet scaled up by a fraction (which gave uneven, chunky
// pixels). Their frames come out in the puppets' shape ({ anim: { view:
// [canvas] } }: idle, walk, attack, cast, hurt), 64x64 with the feet on y=48,
// so the enemy code drives them exactly as it drives a puppet
// (bake.js registerBigPuppet).
import { renderModel } from './modeler.js';

const SIZE = { W: 64, H: 64, feet: 48, tilt: 10 }; // seen nearly flat-on, facing out, as the puppets are (not tipped toward the camera)
const VIEWS = ['down', 'up', 'side'];

// a model point helper: limbs from a to b
const limb = (a, b, r0, r1, ramp, id, extra = {}) => ({ a, b, r0, r1, ramp, id, ...extra });
// a band round a volume (a belt, a wrapping, a bracer): a closed depth-tested line, so only its near side shows
const ring = (c, rx, ry, color, id, w = 1, n = 24) => ({ line: Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, c[2]]; }), color, w, id });
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// a walk cycle's legs and arm swing (4 frames) and an idle bob (2), shared
function cycle(build, attackPoses, hurtPose, views = VIEWS, castPoses = null) {
  const out = { idle: {}, walk: {}, attack: {}, cast: {}, hurt: {} };
  for (const v of views) {
    const R = (pose) => build(v, pose);
    out.idle[v] = [R({}), R({ bob: 1 })];
    out.walk[v] = [0, 1, 2, 3].map((f) => R({ step: [0, 1, 0, -1][f], bob: f % 2 }));
    out.attack[v] = attackPoses.map((p) => R(p));
    out.cast[v] = castPoses ? castPoses.map((p) => R(p)) : out.attack[v];
    out.hurt[v] = [R(hurtPose)];
  }
  return out;
}

// ------------------------------------------------------------- goblin warlords
// Snagtooth (the Vale's bounty) and Gutcrusher (the pit champion): goblins
// grown huge, keeping what says goblin - green skin, long ears out to the
// sides, yellow eyes, a leather hood - and each with features of his own.
const SKIN = ['leafD', 'grassD', 'grass', 'grassL', 'grassXL'];
const LEATHER = ['ink', 'leatherD', 'leather', 'woodD', 'wood'];
const HIDE = ['mudD', 'dirtD', 'dirt', 'dirtL', 'sand'];
const IRON = ['ink', 'steelD', 'steel', 'steelL', 'white'];
const WOOD = ['woodD', 'woodD', 'wood', 'woodL', 'woodL'];

function warlord(spec) {
  return (view, { bob = 0, step = 0, hand = null, aim = null, crouch = 0, eye = 'goldL' } = {}) => {
    const z0 = -bob - crouch, sw = step * 3; // the body's drop; the legs' stride
    const k = spec.k || 1, s = (v) => v * k; // Gutcrusher is the bigger
    const P = [];
    // legs: thick and bowed, wrapped in hide, the feet bare and clawed
    for (const [sx, st] of [[-1, sw], [1, -sw]]) {
      const lift = st > 0 ? 2 : 0; // the stepping foot comes up off the ground
      P.push(limb([sx * s(5), 0, s(15) + z0], [sx * s(6.5), st, s(3) + lift], s(4.2), s(3.4), spec.legs || HIDE, 'legs'));
      P.push({ c: [sx * s(6.5), st + s(2), s(2) + lift], r: [s(3.4), s(4.5), s(2.4)], ramp: SKIN, id: 'legs' });
    }
    P.push({ c: [0, 0, s(16) + z0], r: [s(10.5), s(8.5), s(4.5)], ramp: spec.kilt || HIDE, id: 'kilt' }); // the hide kilt
    P.push({ c: [0, s(1.5), s(22) + z0], r: [s(11), s(9.5), s(8)], ramp: SKIN, id: 'body' }); // the belly
    P.push({ c: [0, 0, s(28) + z0], r: [s(12.5), s(8), s(6)], ramp: SKIN, id: 'body' }); // the chest and shoulders
    for (const sx of [-1, 1]) P.push({ c: [sx * s(12), 0, s(29) + z0], r: s(5), ramp: SKIN, id: 'body' });
    // the head, low between the shoulders: skull, heavy jaw, long ears out to the sides, the hood
    const hz = s(37) + z0;
    P.push({ c: [0, s(3), hz], r: [s(7), s(6.5), s(6)], ramp: SKIN, id: 'head' });
    P.push({ c: [0, s(5), hz - s(3)], r: [s(6.2), s(5), s(3.6)], ramp: SKIN, id: 'head' });
    for (const sx of [-1, 1]) P.push(limb([sx * s(6), s(1), hz + s(1)], [sx * s(14.5), s(-5), hz + s(4)], s(2.8), s(0.8), SKIN, `ear${sx}`)); // long ears, out to the sides and swept back (so they show from every side)
    if (spec.helm) P.push({ c: [0, s(2), hz + s(3)], r: [s(7.4), s(7), s(4.2)], ramp: IRON, id: 'helm' });
    else P.push({ c: [0, 0, hz + s(3.5)], r: [s(6.2), s(5.6), s(3.2)], ramp: LEATHER, id: 'hood' }); // a leather hood, sat back on the skull
    // arms: the right holds the weapon (hand, aim), the left swings or braces
    const hR = hand || [-s(12), s(6), s(20) + z0], hL = [s(13), -sw * 0.6, s(19) + z0];
    for (const [sx, h] of [[-1, hR], [1, hL]]) {
      const sh = [sx * s(12), 0, s(29) + z0], el = [(sh[0] + h[0]) / 2 + sx * s(2.5), (sh[1] + h[1]) / 2 - s(2), (sh[2] + h[2]) / 2];
      P.push(limb(sh, el, s(4), s(3.4), SKIN, `arm${sx}`), limb(el, h, s(3.4), s(3), SKIN, `arm${sx}`));
      P.push({ c: h, r: s(3.2), ramp: sx < 0 && spec.gauntlet ? IRON : SKIN, id: `arm${sx}` });
      const br = lerp(el, h, 0.62); P.push(ring(br, s(3.6), s(3.6), ['leatherD', 'leather'], `arm${sx}`, 2)); // a bracer
    }
    // the mid-scale structure: a belt with its buckle, the kilt's dark hem, wrappings round the legs, the line under the chest, claws on the toes
    P.push(ring([0, s(0.3), s(19) + z0], s(10.8), s(8.8), ['leatherD', 'woodD'], 'belt', 2));
    P.push({ c: [0, s(9), s(19) + z0], r: [s(1.8), s(0.8), s(1.5)], ramp: ['woodD', 'gold', 'gold', 'goldL', 'goldL'], id: 'belt' });
    P.push(ring([0, 0, s(12) + z0], s(10.2), s(8.3), 'mudD', 'kilt'));
    for (const [sx, st] of [[-1, sw], [1, -sw]]) for (const t of [0.45, 0.7]) P.push(ring(lerp([sx * s(5), 0, s(15) + z0], [sx * s(6.5), st, s(3)], t), s(3.9), s(3.9), spec.legs ? 'ink' : 'dirtD', 'legs'));
    P.push({ line: Array.from({ length: 13 }, (_, i) => { const x = (i / 12 - 0.5) * s(18); return [x, Math.sqrt(Math.max(0, 1 - (x / s(12.5)) ** 2)) * s(8) + s(0.4), s(24.5) + z0 - Math.abs(x) * 0.12]; }), color: 'grassD', id: 'body' });
    for (const [sx, st] of [[-1, sw], [1, -sw]]) for (const d of [-1.6, 0, 1.6]) { const lf = st > 0 ? 2 : 0; P.push({ line: [[sx * s(6.5) + d, st + s(6.2), s(1.4) + lf], [sx * s(6.5) + d, st + s(6.9), s(0.6) + lf]], color: 'bone', id: 'legs' }); }
    spec.weapon(P, hR, aim || [0.15, 0.25, 1], s);
    spec.more?.(P, s, z0);
    return renderModel(P, view, { ...SIZE, paint: (ctx, D) => {
      // the face (only where it shows): eyes, a nose, the mouth, and his own marks
      const e1 = D.at(-s(2.6), s(8.5), hz + s(0.5)), e2 = D.at(s(2.6), s(8.5), hz + s(0.5));
      for (const e of [e1, e2]) if (e.show) { D.px(e.x - 1, e.y - 1, 'leafD', 3, 1); D.px(e.x, e.y, eye, view === 'side' ? 1 : 2, 1); D.px(e.x + (view === 'side' ? 1 : 2), e.y, 'ink'); } // a heavy brow over each yellow eye
      const m = D.at(0, s(9.5), hz - s(3.5));
      if (m.show) D.px(m.x - (view === 'side' ? 0 : 2), m.y, 'ink', view === 'side' ? 2 : 5, 1);
      spec.face?.(D, s, hz, view);
    } });
  };
}

// Snagtooth: one great tusk jutting up out of his jaw, red war paint, a hide
// kilt, a crude spear of a whole branch with a rusted blade and feathers
const SNAGTOOTH = warlord({
  weapon(P, h, aim, s) {
    const len = s(30), a = [h[0] - aim[0] * len * 0.35, h[1] - aim[1] * len * 0.35, h[2] - aim[2] * len * 0.35], b = [h[0] + aim[0] * len * 0.65, h[1] + aim[1] * len * 0.65, h[2] + aim[2] * len * 0.65];
    P.push({ line: [a, b], color: ['woodD', 'wood'], w: 2, id: 'spear' });
    P.push(limb(b, [b[0] + aim[0] * s(7), b[1] + aim[1] * s(7), b[2] + aim[2] * s(7)], s(2), s(0.4), ['ink', 'mudD', 'dirtD', 'steel', 'steelL'], 'spear')); // the rusted blade
    P.push({ line: [[b[0] - aim[0] * 2 + 1, b[1], b[2] - aim[2] * 2], [b[0] - aim[0] * 5 + 2, b[1] - 1, b[2] - aim[2] * 5 - 2]], color: 'redL', id: 'spear' }); // a feather
  },
  more(P, s, z0) {
    P.push({ line: [[-s(11), s(7), s(31) + z0], [s(10), s(8.5), s(19) + z0]], color: ['leatherD', 'leather'], w: 2, id: 'strap' }); // a strap across the chest
  },
  face(D, s, hz, view) {
    const t = D.at(-s(2.5), s(10), hz - s(3)); // the snaggle tooth, up past the lip
    if (t.show) { D.px(t.x, t.y - 3, 'white', 2, 1); D.px(t.x, t.y - 2, 'bone', 2, 3); }
    for (const [x, z] of [[-s(4.5), hz - s(1.5)], [s(4.5), hz - s(1.5)]]) { const w = D.at(x, s(8), z); if (w.show) D.px(w.x, w.y, 'red', 1, 2); } // war paint under the eyes
  },
});

// Gutcrusher: the pit champion - a horned iron helm, a chain over one
// shoulder, a spiked iron gauntlet on his right hand and a great spiked maul
const GUTCRUSHER = warlord({
  k: 1.12, helm: true, gauntlet: true, kilt: LEATHER,
  weapon(P, h, aim, s) {
    const len = s(20), a = [h[0] - aim[0] * len * 0.2, h[1] - aim[1] * len * 0.2, h[2] - aim[2] * len * 0.2], b = [h[0] + aim[0] * len * 0.8, h[1] + aim[1] * len * 0.8, h[2] + aim[2] * len * 0.8];
    P.push({ line: [a, b], color: ['woodD', 'wood'], w: 2, id: 'maul' });
    P.push({ c: b, r: [s(4.5), s(4.5), s(5.5)], ramp: IRON, id: 'maul' }); // the maul's head
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]]) P.push({ line: [[b[0] + d[0] * s(4), b[1] + d[1] * s(4), b[2] + d[2] * s(5)], [b[0] + d[0] * s(7), b[1] + d[1] * s(7), b[2] + d[2] * s(8)]], color: 'steelL', id: 'maul' }); // its spikes
  },
  more(P, s, z0) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([-s(12) + t * s(22), s(7.5) + Math.sin(t * Math.PI) * s(1.5), s(32) - t * s(13) + z0]); }
    P.push({ line: pts, color: ['steel', 'steelD'], w: 2, id: 'chain' }); // the chain over his shoulder
    for (const sx of [-1, 1]) P.push(limb([sx * s(6), s(2), s(42) + z0], [sx * s(11.5), s(1), s(50) + z0], s(2.4), s(0.6), ['mudD', 'dirt', 'bone', 'bone', 'white'], `horn${sx}`)); // the helm's horns, curving up and out
  },
  face(D, s, hz, view) {
    for (const x of [-s(3), s(2.5)]) { const t = D.at(x, s(10), hz - s(3)); if (t.show) D.px(t.x, t.y - 2, 'bone', 1, 2); } // two tusks
    const sc = D.at(s(3), s(9.5), s(22)); if (sc.show) { D.px(sc.x, sc.y, 'grassD', 4, 1); D.px(sc.x + 1, sc.y - 1, 'grassD', 1, 3); } // an old scar on the belly
  },
});

// the spear thrust and the maul's overhead smash, as hand positions and the
// weapon's aim in model space (+y forward, toward whoever it faces)
const THRUST = [
  { hand: [-11, -3, 26], aim: [0.1, 0.55, 0.8], crouch: 1 },
  { hand: [-7, 16, 22], aim: [0.05, 1, 0.05] },
  { hand: [-9, 9, 22], aim: [0.1, 0.7, 0.5] },
];
const SMASH = [
  { hand: [-6, -4, 44], aim: [0, -0.4, 1], crouch: 1 },
  { hand: [-5, 15, 16], aim: [0, 0.8, -0.6], crouch: 2 },
  { hand: [-8, 10, 20], aim: [0, 0.6, 0.4] },
];
// each takes the views to build (all three by default), so a loader can build one view a frame
export const buildSnagtooth = (views) => cycle(SNAGTOOTH, THRUST, { bob: 1, crouch: 1, eye: 'white' }, views);
export const buildGutcrusher = (views) => cycle(GUTCRUSHER, SMASH.map((p) => ({ ...p, hand: p.hand.map((v) => v * 1.12) })), { bob: 1, crouch: 1, eye: 'white' }, views);
// frames built a view at a time, put back together
export function mergeViews(parts) {
  const out = {};
  for (const fr of parts) for (const [anim, views] of Object.entries(fr)) Object.assign((out[anim] ??= {}), views);
  return out;
}

// ------------------------------------------------------- the humanoid bosses
// Shared pieces: a pair of legs that stride and lift, an arm from shoulder to
// hand bending out at the elbow, and the face's small marks painted on after.
function legPair(P, { hip, foot, r0, r1, ramp, bootRamp, sw, z0, id = 'legs', apart }) {
  for (const [sx, st] of [[-1, sw], [1, -sw]]) {
    const lift = st > 0 ? 2 : 0;
    P.push(limb([sx * apart, 0, hip + z0], [sx * (apart + 0.6), st, 4 + lift], r0, r1, ramp, id));
    P.push({ c: [sx * (apart + 0.6), st + 1.6, 2 + lift], r: [r1 + 0.4, r1 + 1.6, 2.2], ramp: bootRamp || ramp, id });
  }
}
function armTo(P, sh, hand, r0, r1, ramp, id, out = 2.5, handRamp = ramp, handR = r1 + 0.3) {
  const sx = Math.sign(sh[0]) || 1, el = [(sh[0] + hand[0]) / 2 + sx * out, (sh[1] + hand[1]) / 2 - 2, (sh[2] + hand[2]) / 2];
  P.push(limb(sh, el, r0, (r0 + r1) / 2, ramp, id), limb(el, hand, (r0 + r1) / 2, r1, ramp, id));
  P.push({ c: hand, r: handR, ramp: handRamp, id });
  return el;
}
// the humanoid bosses are taller than the goblins: a taller frame, the feet still on its 3/4 line (the units' origin)
const TALL = { W: 72, H: 72, feet: 54, tilt: 10 };
const along = (h, aim, t) => [h[0] + aim[0] * t, h[1] + aim[1] * t, h[2] + aim[2] * t];
const norm3 = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };

// ------------------------------------------------------------ the Pale Huntsman
// Gloamwood's hunter, drained of colour: gaunt and tall, a skull for a face
// with cold green eyes in it, a deep hood with antlers branching from it, a
// ragged pelt cloak, a quiver on his back and a great longbow.
const PALE = ['slate', 'stone', 'mist', 'bone', 'white']; // drained of colour, but solid
const PELT = ['night', 'slate', 'stone', 'mist', 'bone'];
const BONE = ['slate', 'mist', 'bone', 'white', 'white'];
const BOW = ['ink', 'barkD', 'leatherD', 'bark', 'barkL'];
function huntsman(view, { bob = 0, step = 0, draw = 0, release = false, bowUp = 0, crouch = 0, eye = 'glowL' } = {}) {
  const z0 = -bob - crouch, sw = step * 3, P = [];
  legPair(P, { hip: 21, r0: 3, r1: 2.3, ramp: PALE, bootRamp: PELT, sw, z0, apart: 3.2 });
  P.push({ c: [0, 0, 22 + z0], r: [6.5, 5, 4], ramp: PELT, id: 'body' }); // the belt of the pelt kilt
  P.push({ c: [0, 0.5, 28 + z0], r: [6.5, 4.6, 6], ramp: PALE, id: 'body' }); // a gaunt chest
  P.push({ c: [0, -3.5, 27 + z0], r: [8.5, 2.6, 11], ramp: PELT, id: 'cloak', bias: -0.08 }); // the pelt cloak hanging behind
  P.push({ c: [0, -1, 33 + z0], r: [10, 5.6, 3.2], ramp: PELT, id: 'cloak' }); // its mantle on the shoulders, sloping off them
  for (const sx of [-1, 1]) P.push({ c: [sx * 7.5, -0.5, 31.5 + z0], r: [3.2, 4.6, 2.6], ramp: PELT, id: 'cloak' });
  P.push({ c: [-4.5, -4.5, 33 + z0], r: [1.8, 1.8, 5], ramp: BOW, id: 'quiver' }); // the quiver, on his back
  for (const dx of [-5.5, -4.5, -3.5]) P.push({ line: [[dx, -4.5, 38 + z0], [dx, -5, 41 + z0]], color: 'mist', id: 'quiver' }); // fletchings
  const hz = 38 + z0;
  P.push({ c: [0, 1.2, hz], r: [4.2, 4.2, 4.8], ramp: BONE, id: 'skull' }); // the skull
  P.push({ c: [0, -0.4, hz + 0.8], r: [5.6, 5.4, 5.6], ramp: PELT, id: 'hood', bias: -0.05, soft: true }); // the hood round it
  for (const sx of [-1, 1]) { // the antlers: a beam each side with tines off it
    const base = [sx * 3, -1, hz + 4.5], top = [sx * 9, -2, hz + 10];
    P.push(limb(base, top, 1.2, 0.6, BONE, `antler${sx}`));
    P.push(limb(lerp(base, top, 0.45), [sx * 5.5, 0.5, hz + 11], 0.8, 0.4, BONE, `antler${sx}`));
    P.push(limb(lerp(base, top, 0.8), [sx * 11.5, -1, hz + 12.5], 0.7, 0.4, BONE, `antler${sx}`));
  }
  // the bow in his left hand; the right draws the string
  const bowHand = draw || release ? [5, 10, 31 + z0] : [8.5, 3, 19 + z0 + bowUp];
  const pull = draw ? [-1.5, 1 - draw * 4, 33 + z0] : release ? [-6, -4, 32 + z0] : [-8.5, 2 - sw * 0.5, 20 + z0];
  armTo(P, [7, 0, 32 + z0], bowHand, 2.2, 1.8, PALE, 'armL', 1.5, BONE, 1.8);
  armTo(P, [-7, 0, 32 + z0], pull, 2.2, 1.8, PALE, 'armR', 1.5, BONE, 1.8);
  const up = draw || release ? [0, 0, 1] : norm3([0.25, 0.1, 1]), back = draw || release ? [0, -1, 0] : [-0.3, -0.2, 0];
  const bowPts = Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * 2 - 1; return along(along(bowHand, up, t * 15), back, (1 - t * t) * -3.5 + 3.5 * (1 - Math.abs(t)) * 0 + (Math.abs(t) > 0.8 ? 1 : 0)); });
  P.push({ line: bowPts, color: ['barkD', 'bark'], w: 2, id: 'bow' });
  const tip = bowPts[0], foot = bowPts[12];
  P.push({ line: draw ? [tip, pull, foot] : [tip, foot], color: 'mist', id: 'string' });
  if (draw) P.push({ line: [pull, along(bowHand, [0, 1, 0], 4)], color: ['bone', 'barkL'], id: 'arrow' });
  return renderModel(P, view, { ...TALL, paint: (ctx, D) => {
    for (const ex of [-1.6, 1.6]) { const e = D.at(ex, 5.2, hz + 0.6); if (e.show) { D.px(e.x, e.y, 'ink', view === 'side' ? 1 : 2, 2); D.px(e.x, e.y, eye); } } // eyes burning cold in the sockets
    const n = D.at(0, 5.4, hz - 1.2); if (n.show) D.px(n.x, n.y, 'slate'); // the nose hole
    const m = D.at(0, 5, hz - 3); if (m.show) { D.px(m.x - (view === 'side' ? 0 : 1), m.y, 'slate', view === 'side' ? 2 : 3, 1); D.px(m.x, m.y, 'bone'); } // the teeth
    for (let i = 0; i < 7; i++) { const t = D.at(-7 + i * 2.3, -4.5, 16 + z0); if (t.show) D.px(t.x, t.y, i % 2 ? 'slate' : 'night', 1, 2 + (i % 3)); } // the cloak's ragged hem
    for (let i = 0; i < 9; i++) { const f = D.at(-9 + i * 2.25, 1.5, 30.5 + z0); if (f.show) D.px(f.x, f.y, i % 2 ? 'mist' : 'stone', 1, 2); } // the fur of the mantle
  } });
}
const BOW_SHOT = [{ draw: 1 }, { release: true }, { bowUp: 4 }];
export const buildHuntsman = (views) => cycle(huntsman, BOW_SHOT, { bob: 1, crouch: 1, eye: 'white' }, views);

// --------------------------------------------------------- Forgemaster Vulk
// The salamander smith of the Forge of Ash: a hulk of red scales with a
// paler belly, a lizard's head with a long snout under a crown of forged
// horns, a heavy leather apron, a thick tail behind him, and a great bearded
// forge-axe whose edge still glows from the fire.
const SCALE = ['ink', 'redD', 'red', 'redL', 'fire'];
const BELLY = ['redD', 'fire', 'fireL', 'goldL', 'goldL'];
const CROWN = ['ink', 'woodD', 'gold', 'goldL', 'white'];
const APRON = ['leatherD', 'leather', 'woodD', 'wood', 'woodL'];
function vulk(view, { bob = 0, step = 0, hand = null, aim = null, crouch = 0, eye = 'goldL' } = {}) {
  const z0 = -bob - crouch, sw = step * 3, P = [];
  P.push(limb([0, -6, 15 + z0], [-3 + sw * 0.4, -14, 6], 4.2, 2.6, SCALE, 'tail'), limb([-3 + sw * 0.4, -14, 6], [9 + sw, -20, 2], 2.6, 1, SCALE, 'tail')); // the tail, behind, sweeping round to one side
  legPair(P, { hip: 16, r0: 4.6, r1: 3.6, ramp: SCALE, sw, z0, apart: 5.5 });
  P.push({ c: [0, 0.5, 24 + z0], r: [11, 8.5, 9.5], ramp: SCALE, id: 'body' });
  P.push({ c: [0, 3.5, 23 + z0], r: [7, 6, 7.5], ramp: BELLY, id: 'body' }); // the pale belly
  P.push({ c: [0, 0, 31 + z0], r: [13, 8, 6], ramp: SCALE, id: 'body' }); // the shoulders
  for (const sx of [-1, 1]) P.push({ c: [sx * 12.5, 0, 31 + z0], r: 5.2, ramp: SCALE, id: 'body' });
  P.push({ c: [0, 8.4, 25 + z0], r: [6, 1.4, 5], ramp: APRON, id: 'apron' }); // the apron's bib
  P.push({ c: [0, 8.8, 17 + z0], r: [8.5, 1.4, 6], ramp: APRON, id: 'apron' }); // and its skirt, wider at the hem
  P.push({ line: [[-9, 4, 31 + z0], [0, 8.8, 31.5 + z0], [9, 4, 31 + z0]], color: 'leatherD', w: 1, id: 'apron' }); // its neck strap
  const hz = 38 + z0;
  P.push({ c: [0, 3, hz], r: [6.2, 6.4, 5.2], ramp: SCALE, id: 'head' });
  P.push({ c: [0, 9, hz - 1.4], r: [4, 5, 3.2], ramp: SCALE, id: 'head' }); // the snout
  P.push(ring([0, 2.5, hz + 3.6], 5.8, 5.8, ['gold', 'woodD'], 'crown', 2)); // the crown's band
  for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9 + Math.PI; const x = Math.cos(a) * 5.6, y = 2.5 + Math.sin(a) * 5.6; P.push(limb([x, y, hz + 3.6], [x * 1.25, y * 1.1, hz + (i % 3 === 1 ? 10 : 7.5)], 1.1, 0.4, CROWN, 'crown')); } // its forged horns
  const hR = hand || [-14, 6, 18 + z0], hL = hand ? lerp(hand, [-3, 0, 30 + z0], 0.3) : [14, -sw * 0.6, 19 + z0];
  for (const [sx, h] of [[-1, hR], [1, hL]]) armTo(P, [sx * 12.5, 0, 31 + z0], h, 4.4, 3.6, SCALE, `arm${sx}`, 2.5, APRON, 3.6);
  const a = aim || [0.25, 0.3, 1];
  const top = along(hR, a, 18), butt = along(hR, a, -6);
  P.push({ line: [butt, top], color: ['woodD', 'wood'], w: 2, id: 'axe' });
  const side = norm3([a[1], -a[0], 0].map((v) => v || 0.0001)).map((v) => v * 1);
  P.push({ c: along(top, a, -2.5), r: [4.5, 1.2, 4.5], ramp: IRON, id: 'axe' }); // the blade: a broad bearded head
  P.push({ c: along(along(top, a, -3.5), side, 3), r: [2.6, 1, 3.8], ramp: ['redD', 'lava', 'lavaL', 'lavaXL', 'white'], id: 'axe', rim: false }); // its edge, glowing from the forge
  return renderModel(P, view, { ...TALL, paint: (ctx, D) => {
    for (const ex of [-3.4, 3.4]) { const e = D.at(ex, 7.4, hz + 1.2); if (e.show) { D.px(e.x, e.y, 'ink', 2, 1); D.px(e.x + (ex < 0 ? 0 : 1), e.y, eye); } } // eyes set to the sides of the head
    for (const nx of [-1.2, 1.2]) { const n = D.at(nx, 13.6, hz - 0.6); if (n.show) D.px(n.x, n.y, 'redD'); } // nostrils
    const m = D.at(0, 12, hz - 3.4); if (m.show) D.px(m.x - (view === 'side' ? 3 : 2), m.y, 'ink', view === 'side' ? 4 : 5, 1); // the long mouth
    for (let i = 0; i < 4; i++) { const sc = D.at(-6 + i * 4, 6, 33 + z0 - (i % 2)); if (sc.show) D.px(sc.x, sc.y, 'redL'); } // scales catching the light
  } });
}
const CHOP = [
  { hand: [-6, -2, 42], aim: [0.1, -0.5, 1], crouch: 1 },
  { hand: [-4, 14, 18], aim: [0, 0.85, -0.5], crouch: 2 },
  { hand: [-8, 9, 22], aim: [0.1, 0.6, 0.6] },
];
export const buildVulk = (views) => cycle(vulk, CHOP, { bob: 1, crouch: 1, eye: 'white' }, views);

// --------------------------------------------------- Isolde the Rimeguard
// Mirelle's sister in frosted plate: a great helm with a crest of ice and a
// dark visor slit, broad pauldrons, a blue tabard and cape, a kite shield on
// her left arm with a white tree on it, and a long frost lance.
const RIME = ['ink', 'frostD', 'steel', 'steelL', 'iceXL'];
const TABARD = ['ink', 'blueD', 'blue', 'blueL', 'iceL'];
const ICE = ['iceD', 'ice', 'iceL', 'iceXL', 'white'];
function isolde(view, { bob = 0, step = 0, hand = null, aim = null, crouch = 0, eye = 'iceXL', guard = 0 } = {}) {
  const z0 = -bob - crouch, sw = step * 3, P = [];
  P.push({ c: [0, -4.5, 24 + z0], r: [8.5, 1.8, 13], ramp: TABARD, id: 'cape', bias: -0.1 }); // the cape, behind
  legPair(P, { hip: 18, r0: 3.4, r1: 2.8, ramp: RIME, sw, z0, apart: 3.6 });
  P.push({ c: [0, 0, 20 + z0], r: [7.5, 5.5, 4], ramp: RIME, id: 'body' }); // the plated hips
  P.push({ c: [0, 4.6, 17 + z0], r: [4.5, 1.4, 7], ramp: TABARD, id: 'tabard' }); // the tabard's skirt, in front
  P.push({ c: [0, 0.5, 28 + z0], r: [8.5, 5.6, 7.5], ramp: RIME, id: 'body' }); // the breastplate
  P.push({ c: [0, 5.2, 28 + z0], r: [4.2, 1.2, 6], ramp: TABARD, id: 'tabard' }); // the tabard over it
  for (const sx of [-1, 1]) P.push({ c: [sx * 8.8, 0, 33 + z0], r: [4.6, 4.6, 3.6], ramp: RIME, id: `pauldron${sx}` }); // pauldrons
  const hz = 39 + z0;
  P.push({ c: [0, 0.8, hz], r: [4.8, 4.8, 5.4], ramp: RIME, id: 'helm' }); // the great helm
  for (let i = 0; i < 4; i++) P.push(limb([0, -1 + i * 1.6, hz + 4.6], [0, -1.5 + i * 2, hz + 8 - Math.abs(i - 1.5)], 1, 0.4, ICE, 'crest')); // its crest of ice
  const hR = hand || [-10, 5, 22 + z0], hL = [9, 6 + guard * 3, 26 + z0 + guard * 2];
  armTo(P, [-9, 0, 32 + z0], hR, 2.8, 2.4, RIME, 'armR', 2, RIME, 2.6);
  armTo(P, [9, 0, 32 + z0], hL, 2.8, 2.4, RIME, 'armL', 1.5, RIME, 2.6);
  const a = aim || [0.05, 0.12, 1];
  P.push({ line: [along(hR, a, -8), along(hR, a, 28)], color: ['steel', 'steelD'], w: 2, id: 'lance' });
  P.push(limb(along(hR, a, 28), along(hR, a, 36), 2, 0.3, ICE, 'lance')); // the frost tip
  P.push({ c: along(hR, a, 3), r: 2.2, ramp: ICE, id: 'lance' }); // the vamplate guarding her hand
  P.push({ c: [hL[0] + 2.5, hL[1] + 3, hL[2] - 2], r: [5.2, 1.2, 8], ramp: ICE, id: 'shield' }); // the kite shield, on her left arm
  return renderModel(P, view, { ...TALL, W: 76, paint: (ctx, D) => {
    const v = D.at(0, 5.5, hz + 0.4); if (v.show) { D.px(v.x - (view === 'side' ? 0 : 3), v.y, 'ink', view === 'side' ? 2 : 7, 1); D.px(v.x - (view === 'side' ? 0 : 2), v.y, eye); D.px(v.x + (view === 'side' ? 1 : 1), v.y, eye); } // the visor slit, a cold light in it
    const b = D.at(0, 5.8, hz - 2); if (b.show && view !== 'side') D.px(b.x, b.y, 'frostD', 1, 2); // the helm's breaths
    const sh = D.at(hL[0] + 2.5, hL[1] + 4.3, hL[2] - 2); if (sh.show) { D.px(sh.x, sh.y - 4, 'white', 1, 8); D.px(sh.x - 2, sh.y - 2, 'white', 5, 1); D.px(sh.x - 1, sh.y + 3, 'white', 3, 1); } // the white tree on her shield
    const t = D.at(0, 6.5, 28 + z0); if (t.show) D.px(t.x, t.y - 2, 'iceXL', 1, 3); // a frost star on the tabard
  } });
}
const LANCE = [
  { hand: [-10, -2, 27], aim: [0.05, 0.9, 0.35], crouch: 1, guard: 1 },
  { hand: [-6, 14, 24], aim: [0, 1, 0.04], guard: 1 },
  { hand: [-9, 8, 23], aim: [0.05, 0.7, 0.6] },
];
export const buildIsolde = (views) => cycle(isolde, LANCE, { bob: 1, crouch: 1, eye: 'white', guard: 1 }, views);

// ------------------------------------------------------ Malgrim the Unkind
// The court mage who cursed Aldermere: tall and thin in a long grey-violet
// coat with a high collar, a pale long face, a tall star-pointed hat whose
// tip bends, and a hex staff, its violet orb alight.
const COAT = ['ink', 'hexD', 'purpD', 'slate', 'stone'];
const FACE = ['skinD', 'skin', 'skinL', 'skinL', 'white'];
const ORB = ['purpD', 'purp', 'curse', 'curseL', 'white'];
function malgrim(view, { bob = 0, step = 0, hand = null, aim = null, crouch = 0, eye = 'curseL', glow = 0 } = {}) {
  const z0 = -bob - crouch, sw = step * 1.6, P = [];
  // the coat falls in a long cone to the ground, the hem swaying as he walks
  P.push(limb([sw * 0.6, 0, 9], [0, 0, 22 + z0], 8.6, 6.2, COAT, 'coat')); // one smooth cone, not a stack
  P.push({ c: [sw * 0.6, 0.4, 4.5], r: [10.5, 8.6, 4.5], ramp: COAT, id: 'coat' }); // the skirts, flaring out
  P.push({ c: [sw * 0.6, 0.4, 1.2], r: [11.5, 9.4, 1.4], ramp: COAT, id: 'coat' }); // the hem, spread flat on the ground
  P.push({ c: [0, 0, 27 + z0], r: [7.6, 5.2, 5.5], ramp: COAT, id: 'coat' }); // the shoulders
  for (const sx of [-1, 1]) P.push({ line: [[sx * 3.2, 6.4, 25 + z0], [sx * 5.5 + sw * 0.4, 8.6, 4]], color: 'stone', id: 'coat' }); // the coat's open front, its lit edges
  for (const [sx, st] of [[-1, sw], [1, -sw]]) P.push({ c: [sx * 3.5, st + 6, 1.4 + (st > 0 ? 1 : 0)], r: [2, 3, 1.4], ramp: COAT, id: 'feet' }); // boot toes peeking out
  P.push(ring([0, 0.3, 20 + z0], 6.7, 5.4, ['curse', 'purp'], 'coat', 1)); // a sash of hex-light
  P.push({ c: [0, -1.5, 34 + z0], r: [6.4, 3, 4.5], ramp: COAT, id: 'collar', bias: 0.05 }); // the high collar behind his head
  const hz = 34 + z0;
  P.push({ c: [0, 1.4, hz], r: [3.6, 3.8, 4.8], ramp: FACE, id: 'face' }); // a long pale face
  P.push({ c: [0, 1, hz + 4.2], r: [8.4, 8.4, 1.1], ramp: COAT, id: 'hat' }); // the brim
  const pts = [[0, 0.6, hz + 5], [0, 0, hz + 8.5], [0.6, -1, hz + 11], [1.8, -2.4, hz + 12.8], [3.4, -3.6, hz + 13.5]];
  for (let i = 0; i + 1 < pts.length; i++) P.push(limb(pts[i], pts[i + 1], [5.6, 4.2, 2.8, 1.6][i], [4.2, 2.8, 1.6, 0.6][i], COAT, 'hat')); // the cone, its tip bending over
  P.push(ring([0, 0.6, hz + 5.6], 5.6, 5.6, ['purp', 'purpD'], 'hat', 1)); // a violet band round it
  const hR = hand || [-9, 4, 22 + z0], hL = [8, 2 - sw, 21 + z0];
  armTo(P, [-7.5, 0, 30 + z0], hR, 2.4, 2, COAT, 'armR', 1.8, FACE, 1.6);
  armTo(P, [7.5, 0, 30 + z0], hL, 2.4, 2, COAT, 'armL', 1.8, FACE, 1.6);
  const a = aim || [0.08, 0.15, 1];
  const top = along(hR, a, 15);
  P.push({ line: [along(hR, a, -18 + (hand ? 6 : 0)), top], color: ['barkD', 'bark'], w: 2, id: 'staff' });
  P.push(limb(along(top, a, -1), along(top, a, 2.5), 1.4, 0.6, ['ink', 'barkD', 'bark', 'barkL', 'barkL'], 'staff')); // the claw holding the orb
  P.push({ c: along(top, a, 3), r: 2.6 + glow * 0.6, ramp: ORB, id: 'orb', rim: false });
  return renderModel(P, view, { ...TALL, paint: (ctx, D) => {
    for (const ex of [-1.5, 1.5]) { const e = D.at(ex, 4.6, hz + 0.8); if (e.show) { D.px(e.x - (ex < 0 ? 1 : 0), e.y - 1, 'skinD', 2, 1); D.px(e.x, e.y, eye); } } // brows drawn down over eyes lit by the hex
    const n = D.at(0, 5.1, hz - 0.6); if (n.show) D.px(n.x, n.y, 'skinD', 1, 2); // the long nose
    const m = D.at(0, 4.6, hz - 2.8); if (m.show) D.px(m.x - (view === 'side' ? 0 : 1), m.y, 'skinD', view === 'side' ? 2 : 3, 1); // a thin mouth, unkind
    const g = D.at(...along(top, a, 3)); if (g.show) { D.px(g.x - 1, g.y - 1, 'white', 2, 2); if (glow) for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) D.px(g.x + dx, g.y + dy, 'curseL'); } // the orb's hot heart, sparks when he casts
    for (let i = 0; i < 6; i++) { const b = D.at(-7 + i * 2.8, 3, 26 + z0 - (i % 2)); if (b.show && i % 2) D.px(b.x, b.y, 'purp'); } // buttons of hex-light down the coat
  } });
}
// a bolt: the staff pointed at whoever it faces; a cast: raised high, the orb blazing
const BOLT = [{ hand: [-8, 6, 28], aim: [0.05, 0.7, 0.7], glow: 1 }, { hand: [-6, 12, 26], aim: [0, 1, 0.25], glow: 2 }, { hand: [-8, 8, 24], aim: [0.05, 0.5, 0.85] }];
const CAST = [{ hand: [-7, 3, 32], aim: [0.05, 0.05, 1], glow: 1 }, { hand: [-6, 2, 34], aim: [0, 0, 1], glow: 2, bob: -1 }, { hand: [-7, 3, 32], aim: [0.05, 0.05, 1], glow: 1 }];
export const buildMalgrim = (views) => cycle(malgrim, BOLT, { bob: 1, crouch: 1, eye: 'white' }, views, CAST);

// ============================================================ creature bosses
// The big creatures, modelled the same way and turned in all three views:
// Queen Mab, Mother Murk and the Cinder Drake. They're low and wide, so the
// camera sits a little higher over them than over the upright bosses (enough
// to see a spider's back or a toad's bulk), each frame in its own key set.
function views(build, anims, vs = VIEWS) {
  const out = {};
  for (const [anim, poses] of Object.entries(anims)) { out[anim] = {}; for (const v of vs) out[anim][v] = poses.map((p) => build(v, p)); }
  return out;
}
// the same frames, the creatures' way round: { view: { anim: [canvas] } } (assets.js creatureViews)
const byView = (fr) => { const out = {}; for (const [anim, vs] of Object.entries(fr)) for (const [v, frames] of Object.entries(vs)) (out[v] ??= {})[anim] = frames; return out; };

// ---------------------------------------------------------------- Queen Mab
// The spider queen: a swollen abdomen marked with a pale skull, a body and
// head crowned with bone spines, a cluster of red eyes, long white fangs,
// and eight long jointed legs, each knee catching a glint of violet.
const CHITIN = ['ink', 'night', 'purpD', 'purp', 'purpL'];
const LEGS = ['ink', 'ink', 'night', 'purpD', 'purp'];
function mab(view, { step = 0, rear = 0, open = false, lunge = 0, eye = 'redL' } = {}) {
  const P = [], z0 = rear * 2;
  P.push({ c: [0, -9 - lunge * 0.5, 9], r: [10.5, 12, 8.5], ramp: CHITIN, id: 'abdomen' });
  P.push({ c: [0, 3 + lunge, 8 + z0 * 0.5], r: [7, 7.5, 5], ramp: CHITIN, id: 'body' });
  P.push({ c: [0, 10 + lunge * 1.5, 9 + z0], r: [5, 4.5, 4.5], ramp: CHITIN, id: 'head' });
  for (const [x, z] of [[-3.5, 3], [-1.5, 4.5], [1.5, 4.5], [3.5, 3], [0, 5.5]]) P.push(limb([x, 9 + lunge * 1.5, 12 + z0], [x * 1.3, 8 + lunge * 1.5, 12 + z0 + z], 0.8, 0.3, BONE, 'crown')); // the crown of spines
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const lift = ((i + step + (sx > 0 ? 1 : 0)) % 2) * (step ? 3 : 0), y = 7 - i * 4 + lunge * (i === 0 ? 2 : 0);
    const front = i === 0 && rear ? 8 : 0; // the front legs reach up when she rears
    const a = [sx * 5.5, y, 8 + z0 * 0.5], k = [sx * (15 + i), y * 1.6, 17 + front], f = [sx * (22 + i * 1.5), y * 2.3 + (i === 0 ? 4 : 0), lift + front * 1.5]; // splayed forward and back, so they read from the side too
    P.push(limb(a, k, 1.8, 1.3, LEGS, `leg${sx}${i}`), limb(k, f, 1.3, 0.6, LEGS, `leg${sx}${i}`));
  }
  return renderModel(P, view, { W: 96, H: 72, feet: 54, tilt: 30, paint: (ctx, D) => {
    const top = D.at(0, -8 - lunge * 0.5, 17.5); // the pale skull on her back
    if (top.show) { const { x, y } = top; for (const [dx, dy, w] of [[-2, -2, 5], [-3, -1, 7], [-3, 0, 7], [-2, 1, 5], [-1, 2, 1], [1, 2, 1]]) D.px(x + dx, y + dy, 'bone', w, 1); D.px(x - 2, y - 1, 'night', 2, 1); D.px(x + 1, y - 1, 'night', 2, 1); }
    for (const [ex, ez] of [[-2.2, 1.5], [2.2, 1.5], [-1, 2.6], [1, 2.6], [-3.4, 0.4], [3.4, 0.4]]) { const e = D.at(ex, 14 + lunge * 1.5, 9 + z0 + ez); if (e.show) D.px(e.x, e.y, eye); } // the eyes
    for (const fx of [-1.6, 1.6]) { const f = D.at(fx, 14.5 + lunge * 1.5, 6 + z0); if (f.show) D.px(f.x, f.y, 'white', 1, open ? 4 : 3); } // the fangs
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { const y = 7 - i * 4, kk = D.at(sx * (15 + i), y * 1.6, 18.2 + (i === 0 && rear ? 8 : 0)); if (kk.show) D.px(kk.x, kk.y, 'purpL'); } // a glint on each knee
  } });
}
export const buildMab = (vs) => byView(views(mab, {
  idle: [{}, { rear: 0.5 }], walk: [{ step: 1 }, { step: 2 }, { step: 1 }, { step: 2 }],
  windup: [{ rear: 1, open: true }, { rear: 1.5, open: true }], attack: [{ lunge: 3, open: true }, {}], hurt: [{ eye: 'white' }],
}, vs));

// -------------------------------------------------------------- Mother Murk
// A bog hag riding a vast toad: the toad warty and mossy, a pale belly, a
// wide mouth that gapes for the slam, bulging red eyes on top; the hag in a
// violet shawl and a tall black hat on its back, raising hex-lit hands.
const TOAD = ['mossD', 'mossD', 'moss', 'mossL', 'mossXL'];
const TBELLY = ['mud', 'dirtL', 'sand', 'bone', 'bone'];
const SHAWL = ['ink', 'hexD', 'purpD', 'purp', 'curseL'];
const HAGSKIN = ['mossD', 'grassD', 'moss', 'mossL', 'mossL'];
const HAT = ['ink', 'ink', 'night', 'slate', 'stone'];
function murk(view, { puff = 0, open = 0, raise = 0, step = 0 } = {}) {
  const P = [], p = puff * 0.8;
  for (const sx of [-1, 1]) P.push({ c: [sx * 17, -7 + (step && sx > 0 ? 2 : 0), 6], r: [6.5, 9, 6], ramp: TOAD, id: `thigh${sx}` }); // the folded hind legs
  P.push({ c: [0, 0, 11 + p], r: [21 + p, 17 + p, 11 + p], ramp: TOAD, id: 'toad' });
  P.push({ c: [0, 6, 6], r: [15 + p, 12, 6], ramp: TBELLY, id: 'toad', bias: 0.05 }); // the pale belly underneath
  P.push({ c: [0, 13, 11 + p * 0.5], r: [16 + p, 8, 8 + p * 0.5], ramp: TOAD, id: 'toad' }); // the broad head
  for (const sx of [-1, 1]) {
    P.push({ c: [sx * 10.5, 12, 19 + p], r: 4.2, ramp: TOAD, id: `eye${sx}` }); // the bulging eyes
    P.push(limb([sx * 14, 11, 8], [sx * (17 + (step && sx < 0 ? 2 : 0)), 17, 1.5], 3.4, 2.6, TOAD, `arm${sx}`)); // the front legs, splayed
  }
  // the hag, hunched on its back
  P.push({ c: [0, -3, 26 + p], r: [6.5, 5.5, 7], ramp: SHAWL, id: 'hag' });
  P.push({ c: [0, -1.5, 35 + p], r: [4, 4, 4.2], ramp: HAGSKIN, id: 'haghead' });
  P.push({ c: [0, -1.5, 38.5 + p], r: [6.5, 6.5, 1], ramp: HAT, id: 'hat' });
  P.push(limb([0, -1.5, 39 + p], [1, -3, 45 + p], 3.6, 1.6, HAT, 'hat'), limb([1, -3, 45 + p], [3, -5, 49 + p], 1.6, 0.5, HAT, 'hat'));
  for (const sx of [-1, 1]) P.push(limb([sx * 5.5, -2, 30 + p], [sx * (8 + raise * 2), 1 + raise, 25 + p + raise * 10], 1.8, 1.3, SHAWL, `hagarm${sx}`));
  return renderModel(P, view, { W: 80, H: 72, feet: 54, tilt: 30, paint: (ctx, D) => {
    for (const sx of [-1, 1]) { const e = D.at(sx * 10.5, 14.5, 22 + p); if (e.show) { D.px(e.x - 1, e.y, 'goldL', 3, 2); D.px(e.x, e.y, 'ink', 1, 2); D.px(e.x - 1, e.y - 1, 'mossD', 3, 1); } } // gold eyes up in the bulges, slit pupils, a heavy lid
    const m = D.at(0, 21, 9 + p * 0.5); // the wide mouth across the front, gaping for the slam
    if (m.show) { const w = view === 'side' ? 6 : 25, x0 = view === 'side' ? m.x - 6 : m.x - 12; D.px(x0, m.y, open ? 'redD' : 'ink', w, open ? 1 + open : 1); if (open) for (let x = 1; x < w; x += 3) D.px(x0 + x, m.y, 'white'); }
    for (let i = 0; i < 14; i++) { const w = D.at(-16 + ((i * 7.3) % 32), -6 + ((i * 5.1) % 16), 19 + p - ((i * 3) % 5)); if (w.show) D.px(w.x, w.y, i % 3 ? 'mossD' : 'mossXL'); } // warts
    for (const ex of [-1.4, 1.4]) { const e = D.at(ex, 2.4, 35.5 + p); if (e.show) D.px(e.x, e.y, 'goldL'); } // the hag's eyes
    if (raise) for (const sx of [-1, 1]) { const h = D.at(sx * (8 + raise * 2), 1 + raise, 26 + p + raise * 10); if (h.show) D.px(h.x - 2, h.y - 2, 'curseL', 4, 2); } // hex-light in her hands
  } });
}
export const buildMurk = (vs) => byView(views(murk, {
  idle: [{}, { puff: 1 }], walk: [{ step: 1 }, { puff: 1 }, { step: 1 }, { puff: 1 }],
  windup: [{ puff: 2, raise: 1 }, { puff: 3, raise: 1 }], slam: [{ open: 3 }, { open: 1 }], hurt: [{}],
}, vs));

// --------------------------------------------------------- the Cinder Drake
// A young dragon: a long arched neck lifting a horned, snouted head, wings
// folded along the back (spread to fly), a spined ridge, a tail tapering to
// an ember, ember-pale belly plates, and a throat that glows before it breathes.
const DSCALE = ['ink', 'redD', 'red', 'redL', 'fire'];
const DBELLY = ['lavaD', 'lava', 'lavaL', 'lavaXL', 'lavaXL'];
const WING = ['ink', 'redD', 'redD', 'red', 'redL'];
function drake(view, { step = 0, bob = 0, spread = 0, breath = 0, lunge = 0 } = {}) {
  const P = [], z0 = -bob;
  const tail = [[0, -11, 12 + z0], [0, -20, 8], [3, -29, 5], [7, -35, 4]];
  for (let i = 0; i + 1 < tail.length; i++) P.push(limb(tail[i], tail[i + 1], [5, 3.6, 2.2][i], [3.6, 2.2, 1][i], DSCALE, 'tail'));
  P.push({ c: tail[3], r: 1.6, ramp: ['lavaD', 'lava', 'lavaL', 'lavaXL', 'white'], id: 'ember', rim: false }); // the ember at its tip
  for (const [y, sx, k] of [[7, -1, 0], [7, 1, 1], [-7, -1, 1], [-7, 1, 0]]) { const st = step ? ((k + step) % 2 ? 3 : -2) : 0; P.push(limb([sx * 5, y, 11 + z0], [sx * 6.5, y + st, 0.5 + (st > 0 ? 2 : 0)], 3, 2.2, DSCALE, `leg${sx}${y}`)); } // four legs
  P.push({ c: [0, 0, 14 + z0], r: [7.5, 13, 7], ramp: DSCALE, id: 'body' });
  P.push({ c: [0, 1, 10 + z0], r: [5.5, 11, 3.5], ramp: DBELLY, id: 'body' }); // the belly plates
  const nk = [[0, 10, 18 + z0], [0, 15 + lunge, 25 + z0 - lunge], [0, 19 + lunge * 2, 29 + z0 - lunge * 2]];
  P.push(limb(nk[0], nk[1], 4.4, 3.2, DSCALE, 'neck'), limb(nk[1], nk[2], 3.2, 2.8, DSCALE, 'neck'));
  const hd = [0, 22 + lunge * 2, 30 + z0 - lunge * 2];
  P.push({ c: hd, r: [3.6, 5.5, 3.4], ramp: DSCALE, id: 'head' });
  P.push({ c: [0, hd[1] + 4.5, hd[2] - 1.2], r: [2.6, 3, 2.2], ramp: DSCALE, id: 'head' }); // the snout
  for (const sx of [-1, 1]) P.push(limb([sx * 2.2, hd[1] - 2, hd[2] + 2], [sx * 3.4, hd[1] - 8, hd[2] + 5], 1, 0.3, BONE, 'head')); // horns swept back
  for (const sx of [-1, 1]) { // the wings: folded along the back, or spread wide and up
    const root = [sx * 5, 4, 19 + z0], tip = spread ? [sx * 24, -2, 34 + z0] : [sx * 8, -12, 24 + z0];
    P.push(limb(root, tip, 2, 0.8, DSCALE, `wing${sx}`)); // the wing's leading bone
    if (spread) { // a membrane stretched between finger bones fanning back from the tip
      const trail = [[sx * 8, -8, 18 + z0], [sx * 15, -9, 21 + z0], [sx * 21, -7, 26 + z0]];
      P.push({ c: lerp(root, tip, 0.55).map((v, i) => v + [0, -4.5, -4][i]), r: [9.5, 1.6, 5.5], ramp: WING, id: `wing${sx}`, bias: -0.05 });
      for (const t of trail) P.push({ line: [tip, t], color: 'redD', id: `wing${sx}` });
    } else P.push({ c: lerp(root, tip, 0.5).map((v, i) => v + [0, -3, -3][i]), r: [3, 9, 4], ramp: WING, id: `wing${sx}`, bias: -0.05 }); // folded along the back
  }
  for (let i = 0; i < 6; i++) P.push({ line: [[0, 8 - i * 4, 21 + z0 - Math.abs(i - 1) * 0.6], [0, 7 - i * 4, 23.5 + z0 - Math.abs(i - 1) * 0.6]], color: 'bone', id: 'body' }); // the spined ridge
  return renderModel(P, view, { W: 96, H: 72, feet: 54, tilt: 20, paint: (ctx, D) => {
    for (const sx of [-1, 1]) { const e = D.at(sx * 2.6, hd[1] + 2.2, hd[2] + 1.2); if (e.show) D.px(e.x, e.y, 'goldL'); }
    for (const sx of [-1, 1]) { const n = D.at(sx * 1, hd[1] + 7.4, hd[2] - 0.6); if (n.show) D.px(n.x, n.y, breath ? 'lavaXL' : 'redD'); } // nostrils, smoking when it breathes
    if (breath) for (let t = 0; t < 1; t += 0.2) { const g = D.at(...lerp(nk[0], nk[2], t).map((v, i) => v + [0, 3, -1.5][i])); if (g.show) D.px(g.x - 1, g.y, t > 0.5 ? 'lavaXL' : 'lavaL', 2, 1); } // the throat glowing
  } });
}
export const buildDrake = (vs) => byView(views(drake, {
  idle: [{}, { bob: 1 }], walk: [{ step: 1 }, { step: 2, bob: 1 }, { step: 1 }, { step: 2, bob: 1 }],
  windup: [{ breath: 1 }, { breath: 1, bob: -1 }], attack: [{ breath: 1, lunge: 3 }, {}], fly: [{ spread: 1 }, { spread: 1, bob: -2 }], hurt: [{}],
}, vs));
