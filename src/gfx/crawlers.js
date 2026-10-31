// Crawlers seen from above, in all three views: the body points the way it
// goes (down = head toward you, up = head away, side = head to the right,
// left a mirror), so it turns as it crawls. Built in the creature's own
// space - u along its body (forward +), v across it, z up off the ground -
// and laid onto the screen with the depth squashed a little, as the camera
// sees the ground at a slant. Legs are jointed (hip on the body, knee raised,
// foot on the ground) and walk in a real gait: a spider's eight in two
// alternating sets of four, a beetle's six as two tripods. Each planted foot
// slides back under the body, then lifts, reaches forward and sets down.
import { makeCanvas, px, outline } from './pixel.js';
import { shadedBlob } from './creatures.js';

const SQUASH = 0.75; // the ground's depth as the camera sees it
const AXES = { side: [[1, 0], [0, 1]], down: [[0, 1], [-1, 0]], up: [[0, -1], [1, 0]] }; // [forward, across] on the screen
function mapper(view, cx, cy) {
  const [[ax, ay], [bx, by]] = AXES[view];
  return (u, v, z = 0) => [cx + u * ax + v * bx, cy + (u * ay + v * by) * SQUASH - z];
}
function line(ctx, [x0, y0], [x1, y1], col) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) px(ctx, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col);
}
// a body part: an ellipse lying along the body (len along it, wid across),
// shaded from the top left; on the screen its length or its width is the
// squashed one, by which way the body points
function segment(ctx, P, view, u, len, wid, tones, z = 0) {
  const [x, y] = P(u, 0, z);
  if (view === 'side') shadedBlob(ctx, x, y, len, wid * SQUASH, tones);
  else shadedBlob(ctx, x, y, wid, len * SQUASH, tones);
}
// a leg's foot over a walk: planted (sliding back under the body) for half
// the cycle, then lifted and swung forward; `ph` 0..1
function gait(ph, reach) {
  if (ph < 0.5) return { du: reach * (1 - 4 * ph), lift: 0 };
  const s = (ph - 0.5) * 2;
  return { du: reach * (-1 + 2 * s * s * (3 - 2 * s)), lift: Math.sin(Math.PI * s) };
}
// one jointed leg: hip on the body, knee pushed out and up, foot on the ground
function leg(ctx, P, hip, foot, kneeUp, col, joint) {
  const h = P(hip[0], hip[1], hip[2]), f = P(foot[0], foot[1], foot[2]);
  const k = P(hip[0] + (foot[0] - hip[0]) * 0.45, hip[1] + (foot[1] - hip[1]) * 0.6, kneeUp + (foot[2] || 0));
  line(ctx, h, k, col); line(ctx, k, f, col);
  px(ctx, Math.round(k[0]), Math.round(k[1]), joint);
}

// ---------------------------------------------------------------- spiders
// A Gloom Spider: a round purple abdomen with the pale hourglass, a smaller
// head with a cluster of red eyes and white fangs, eight long legs. `sz`
// scales it (the spiderling is the same beast small).
const SPIDER_TONES = ['purpD', 'purp', 'purpL', 'curseL'];
function spider(view, { sz = 1, step = -1, rear = 0, lunge = 0, open = false, bob = 0, W = 40 }) {
  const [c, ctx] = makeCanvas(W, W), P = mapper(view, W / 2, W * 0.75 - 4 * sz);
  const S = (v) => v * sz, legCol = 'night', joint = 'purp';
  const lift = rear * 2 + bob * 0.5, fwd = lunge;
  // legs (hips along the head, feet spread round it); sets: L1 R2 L3 R4 / the rest
  const HIPS = [2.5, 1.2, 0, -1.2], FEET = [[10, 9], [4, 12], [-3, 12], [-9, 9]];
  const legs = [];
  for (const side of [-1, 1]) HIPS.forEach((hu, i) => {
    const set = (i + (side > 0 ? 1 : 0)) % 2, g = step < 0 ? { du: 0, lift: 0 } : gait(((step / 6) + set * 0.5) % 1, S(1.6));
    let [fu, fv] = FEET[i]; fu = S(fu) + g.du + fwd * (i === 0 ? 1.5 : 0.5); fv = S(fv) * side;
    let fz = g.lift * S(2.2);
    if (rear && i === 0) { fu += S(2); fz += S(5) * rear / 2; } // reared: the front pair raised, reaching
    const far = view === 'side' && side < 0; // seen at a slant, the far legs reach only a little way up the screen
    if (far) fv *= 0.5;
    legs.push({ hip: [S(hu) + fwd, side * S(1.8), S(2) + lift], foot: [fu, fv, fz], up: (far ? S(2.5) : S(4)) + lift * 0.5, near: !far });
  });
  // the far legs (on the screen above the body in the side view) first
  if (view === 'side') for (const L of legs.filter((l) => !l.near)) leg(ctx, P, L.hip, L.foot, L.up, legCol, joint);
  else for (const L of legs) leg(ctx, P, L.hip, L.foot, L.up, legCol, joint);
  // the abdomen behind, then the head; from behind the abdomen hides the head's face
  const abU = S(-5) + fwd * 0.5, hdU = S(3) + fwd;
  if (view === 'up') segment(ctx, P, view, hdU, S(3.4), S(3.2), SPIDER_TONES, lift);
  segment(ctx, P, view, abU, S(6), S(5.4), SPIDER_TONES, lift * 0.6);
  // the hourglass on its back
  const hg = (du, dv, col) => { const [x, y] = P(abU + du, dv, lift * 0.6 + S(3)); px(ctx, Math.round(x), Math.round(y), col); };
  if (sz >= 1) { for (const [du, dv] of [[-2, -1], [-2, 1], [-1, 0], [0, 0], [1, 0], [2, -1], [2, 1]]) hg(du, dv, 'curseL'); hg(0, 0, 'white'); }
  else hg(0, 0, 'curseL');
  if (view !== 'up') {
    segment(ctx, P, view, hdU, S(3.4), S(3.2), SPIDER_TONES, lift);
    // eyes: a cluster at the front of the head; fangs below them
    const e = (du, dv, col) => { const [x, y] = P(hdU + du, dv, lift + S(1.5)); px(ctx, Math.round(x), Math.round(y), col); };
    if (sz >= 1) { e(S(1.6), -1, 'redL'); e(S(1.6), 1, 'redL'); e(S(2.4), 0, 'redL'); e(S(0.6), -1.6, 'redD'); e(S(0.6), 1.6, 'redD'); }
    else { e(S(1.6), -1, 'redL'); e(S(1.6), 1, 'redL'); }
    const fy = lift - S(0.5);
    for (const sv of [-1, 1]) { const [x, y] = P(hdU + S(3.6), sv * (open ? S(1.6) : S(0.8)), fy); px(ctx, Math.round(x), Math.round(y), 'white'); if (open && sz >= 1) { const [x2, y2] = P(hdU + S(4.4), sv * S(1.2), fy); px(ctx, Math.round(x2), Math.round(y2), 'white'); } }
  }
  if (view === 'side') for (const L of legs.filter((l) => l.near)) leg(ctx, P, L.hip, L.foot, L.up, legCol, joint);
  outline(c, 'ink');
  return c;
}
function spiderSet(o) {
  const v = {};
  for (const view of ['side', 'down', 'up']) {
    const f = (p) => spider(view, { ...o, ...p });
    v[view] = {
      idle: [f({}), f({ bob: 1 })],
      walk: [0, 1, 2, 3, 4, 5].map((st) => f({ step: st, bob: st % 3 === 1 ? 1 : 0 })),
      windup: [f({ rear: 1, open: true }), f({ rear: 2, open: true })], // rearing up, fangs bared (held)
      attack: [f({ lunge: 3, open: true }), f({ lunge: 1 })],
      hurt: [f({ bob: 1 })],
    };
  }
  return v;
}
export const buildSpider3 = () => spiderSet({ sz: 1, W: 40 });
export const buildSpiderling3 = () => spiderSet({ sz: 0.55, W: 28 });

// ---------------------------------------------------------------- beetle
// A Fire Beetle: a domed black shell split down the middle, lava glowing in
// the seam and in two stripes, a small head with gold eyes and feelers, six
// short legs. Before it bursts the shell swells and its seams run white-hot.
const SHELL = ['leatherD', 'redD', 'red', 'redL']; // a dark crimson carapace, so it reads on ash and stone
const HEAD = ['basaltD', 'leatherD', 'leather', 'redD'];
function beetle(view, { step = -1, swell = 0, bob = 0 }) {
  const W = 32, [c, ctx] = makeCanvas(W, W), P = mapper(view, W / 2, W * 0.75 - 3);
  const lift = bob * 0.5 + swell * 0.5;
  const HIPS = [2, 0, -2], FEET = [[6, 6.5], [0.5, 7.5], [-5, 6.5]];
  const legs = [];
  for (const side of [-1, 1]) HIPS.forEach((hu, i) => {
    const set = (i + (side > 0 ? 1 : 0)) % 2, g = step < 0 ? { du: 0, lift: 0 } : gait(((step / 6) + set * 0.5) % 1, 1.3);
    const far = view === 'side' && side < 0;
    legs.push({ hip: [hu, side * 2, 1.5 + lift], foot: [FEET[i][0] + g.du, FEET[i][1] * side * (far ? 0.5 : 1), g.lift * 1.6], up: far ? 1.5 : 2.5, near: !far });
  });
  const drawLegs = (near) => { for (const L of legs.filter((l) => (view === 'side' ? l.near === near : near))) leg(ctx, P, L.hip, L.foot, L.up, 'basaltL', 'ash'); };
  drawLegs(false);
  if (view !== 'side') drawLegs(true);
  const hdU = 6.6; // the head out in front of the shell, where it shows
  const feelers = () => { const sp = view === 'side' ? 0.5 : 1; for (const sv of [-1, 1]) { const a = P(hdU + 1.6, sv * 0.9 * sp, lift + 1.5), b = P(hdU + 4.2, sv * 2.8 * sp, lift + (view === 'side' ? 2 : 3)); line(ctx, a, b, 'basaltL'); } }; // forward and out
  if (view === 'up') { feelers(); segment(ctx, P, view, hdU, 1.8, 2.2, HEAD, lift); }
  segment(ctx, P, view, 0, 5.8 + swell * 0.6, 4.6 + swell * 0.6, SHELL, lift);
  // the seams on the shell: the split down the middle and a stripe either side
  const hot = swell ? ['lavaL', 'lavaXL'] : ['lava', 'lavaL'];
  for (let u = -4.5; u <= 4.5; u += 0.5) {
    const z = lift + 3.6 - Math.abs(u) * 0.25;
    const [x, y] = P(u, 0, z); px(ctx, Math.round(x), Math.round(y), Math.abs(u) < 2.5 ? hot[1] : hot[0]);
    if (Math.abs(u) < 3.5) for (const sv of [-1, 1]) { const [x2, y2] = P(u, sv * 2.6, z - 0.6); px(ctx, Math.round(x2), Math.round(y2), swell ? hot[0] : 'lavaD'); }
  }
  if (view !== 'up') {
    segment(ctx, P, view, hdU, 1.8, 2.2, HEAD, lift);
    feelers();
    for (const sv of [-1, 1]) { const [x, y] = P(hdU + 1, sv * 1, lift + 1.4); px(ctx, Math.round(x), Math.round(y), 'goldL'); } // eyes (over the feelers' roots)
  }
  if (view === 'side') drawLegs(true); // the near legs over the shell
  outline(c, 'ink');
  return c;
}
export function buildBeetle3() {
  const v = {};
  for (const view of ['side', 'down', 'up']) {
    const f = (p) => beetle(view, p);
    v[view] = {
      idle: [f({}), f({ bob: 1 })],
      walk: [0, 1, 2, 3, 4, 5].map((st) => f({ step: st })),
      windup: [f({ swell: 1 }), f({ swell: 1, bob: 1 })], // swelling, the seams white-hot
      attack: [f({ swell: 1 }), f({})],
      hurt: [f({ swell: 1 })],
    };
  }
  return v;
}
