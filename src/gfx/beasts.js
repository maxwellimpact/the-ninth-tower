// Four-legged beasts drawn in all three views (down = facing you, up = facing
// away, side = facing right; left is a mirror), so they turn to face where
// they go. Keep Defense's wolf, the one that took four rounds to get right:
// drawn from silhouettes, not blobs (a few polygons and ellipses filled into
// a mask, each column shaded from the dark saddle to the pale belly), each
// body part on its own layer with a lit rim and a core shadow, ink-outlined
// where a part lies over another but seamless where a leg grows out of the
// body. The hindquarter is one wedge, as on a real wolf, so the hind legs
// come out of the haunch. It draws in the fur ramp (palette furD..furXXL) and
// each beast is recoloured from it: the Frost Wolf in frost greys, the
// Spectral Hound in ghost-light with pricked ears and a whip tail.
import { makeCanvas, px, outline, hash } from './pixel.js';
import { rgb } from './palette.js';

// fill shapes into a mask: polys are [[x,y],...], ellipses {e:[cx,cy,rx,ry]}
function mask(W, H, shapes) {
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#fff';
  for (const s of shapes) {
    ctx.beginPath();
    if (s.e) ctx.ellipse(s.e[0], s.e[1], s.e[2], s.e[3], 0, 0, Math.PI * 2);
    else s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();
  }
  const d = ctx.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  return m;
}
// shade a mask: tone(x, y, t) gets t = 0 at the column's top .. 1 at its bottom
function furFill(ctx, W, H, m, tone, seed = 1) {
  for (let x = 0; x < W; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < H; y++) if (m[y * W + x]) { if (top < 0) top = y; bot = y; }
    if (top < 0) continue;
    for (let y = top; y <= bot; y++) {
      if (!m[y * W + x]) continue;
      const t = (y - top) / Math.max(1, bot - top) + (hash(Math.floor(x / 2), y, seed) - 0.5) * 0.14;
      const col = tone(x, y, t);
      if (col) px(ctx, x, y, col);
    }
  }
}
const FUR = (t, pale = 0) => {
  t += pale;
  return t < 0.12 ? 'furD' : t < 0.34 ? 'fur' : t < 0.62 ? 'furM' : t < 0.88 ? 'furL' : t < 0.97 ? 'furXL' : 'furXXL';
};
// a jointed leg through a list of points, tapering, lit on its left edge
function leg(ctx, pts, w0, w1, far, toe = 0) {
  const col = far ? 'fur' : 'furL', edge = far ? 'furD' : 'furM', lit = far ? 'furM' : 'furXL';
  const total = pts.length - 1;
  pts.forEach((p, i) => {
    if (!i) return;
    const [x0, y0] = pts[i - 1], [x1, y1] = p, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k <= n; k++) {
      const t = (i - 1 + k / n) / total, x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n, w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
      const xl = Math.round(x - w / 2);
      px(ctx, xl, Math.round(y), col, w, 1);
      if (w > 1) { px(ctx, xl, Math.round(y), lit); px(ctx, xl + w - 1, Math.round(y), edge); }
    }
  });
  // the paw: wider than the ankle, pale, toes split; `toe` pushes it forward
  const [fx, fy] = pts[pts.length - 1], pw = Math.max(3, Math.round(w1) + 1);
  const x0 = Math.round(fx - pw / 2 + toe * 0.5), y0 = Math.round(fy);
  if (!far) px(ctx, Math.round(fx - w1 / 2), y0 - 3, 'furXL', Math.round(w1), 2); // pale lower leg
  px(ctx, x0, y0 - 1, far ? 'furM' : 'furXL', pw, 1);
  px(ctx, x0 + (toe > 0 ? 1 : 0), y0, far ? 'fur' : 'furXXL', pw + Math.abs(toe), 1);
  px(ctx, x0 + Math.floor(pw / 2) + (toe > 0 ? 1 : 0), y0, far ? 'furD' : 'furM'); // the split between the toes
}
// a tail along a curve: round stamps of fur, thick in the middle, the tip
// pale; `edged` rims it dark where it lies over the body
function tail(ctx, pts, widths, edged = false) {
  const n = 18, stamps = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, seg = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(seg)), f = seg - k;
    stamps.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f, widths[Math.min(widths.length - 1, Math.floor(t * widths.length))] / 2, t]);
  }
  const fill = (grow, colFn) => {
    for (const [x, y, r, t] of stamps) {
      const R = r + grow;
      for (let yy = Math.floor(y - R); yy <= Math.ceil(y + R); yy++) for (let xx = Math.floor(x - R); xx <= Math.ceil(x + R); xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
        if (dx * dx + dy * dy <= R * R) px(ctx, xx, yy, colFn(t, dx / Math.max(0.5, R), dy / Math.max(0.5, R)));
      }
    }
  };
  if (edged) fill(0.8, () => 'furD');
  fill(0, (t, nx, ny) => (t > 0.8 ? (nx + ny < 0.3 ? 'furXXL' : 'furXL') : nx + ny < -0.5 ? 'furL' : nx + ny > 0.6 ? 'fur' : 'furM'));
}

// Each body part is drawn on its own layer, shaped (a lit rim along its top
// edge, a core shadow along its underside) and ink-outlined. The outline
// always shows against empty space (the silhouette), but over parts already
// drawn only where `inner(x, y)` allows: an ink line where a head or tail
// lies over the body and would blur into it, none where a leg grows out of
// the body. `seam`: the part grows out of what's already drawn (a leg out
// of the body), so it gets no lit rim where it starts inside it.
const STEPS = ['furD', 'fur', 'furM', 'furL', 'furXL', 'furXXL'];
const STEP_RGB = STEPS.map(rgb);
function part(main, W, H, draw, inner = null, seam = false) {
  const [c, ctx] = frameCanvas(W, H);
  draw(ctx);
  const img = ctx.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d);
  const m = main.getImageData(0, 0, W, H).data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!src[i + 3]) continue;
    let k = STEP_RGB.findIndex((q) => q[0] === src[i] && q[1] === src[i + 1] && q[2] === src[i + 2]);
    if (k < 0) continue;
    const a = (dy) => (y + dy >= 0 && y + dy < H ? src[i + dy * W * 4 + 3] || (seam && dy < 0 && m[i + dy * W * 4 + 3]) : 0);
    if (!a(-1)) k = Math.min(5, k + 1); // the lit rim
    else if (!a(1)) k = Math.max(0, k - 2); // the core shadow underneath
    else if (!a(2)) k = Math.max(0, k - 1);
    const q = STEP_RGB[k];
    d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
  }
  ctx.putImageData(img, 0, 0);
  outline(c, 'ink');
  const out = ctx.getImageData(0, 0, W, H), o = out.data;
  for (let i = 0; i < W * H; i++) {
    if (src[i * 4 + 3] || !o[i * 4 + 3] || !m[i * 4 + 3]) continue; // only outline pixels over earlier parts
    if (!(inner === true || (inner && inner(i % W - PAD_X, ((i / W) | 0) - PAD_T)))) o[i * 4 + 3] = 0;
  }
  ctx.putImageData(out, 0, 0);
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.drawImage(c, 0, 0); main.restore();
}
const fillMask = (ctx, W, m, col) => { for (let i = 0; i < m.length; i++) if (m[i]) px(ctx, i % W, (i / W) | 0, col); };
// a straight line of pixels between two canvas points
function seg(ctx, [x0, y0], [x1, y1], col) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) px(ctx, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col); }
// a bat wing (the gargoyle's), canvas points: [root, wrist, finger tip, scallop, finger tip, scallop, finger
// tip, ...back to the body]: skin between the fingers cut in scallops, a pale bony arm from the shoulder to
// the wrist and on to the first tip, the fingers fanning out from the wrist
function wing(q, W, H, pts, far) {
  fillMask(q, W, mask(W, H, [pts]), far ? 'furD' : 'fur');
  const [root, wrist, t1, , t2, , t3] = pts;
  for (const t of [t2, t3]) seg(q, wrist, t, far ? 'fur' : 'furM');
  seg(q, root, wrist, far ? 'furM' : 'furXL'); seg(q, wrist, t1, far ? 'furM' : 'furL');
  px(q, Math.round(wrist[0]), Math.round(wrist[1]) - 1, far ? 'fur' : 'furXXL'); // the claw at the wrist
}
// a horn curling back off the skull (canvas points), pale stone, its tip darker
function horn(q, W, H, pts, far) { fillMask(q, W, mask(W, H, [pts]), far ? 'furM' : 'furL'); const t = pts[Math.floor(pts.length / 2)]; px(q, Math.round(t[0]), Math.round(t[1]), 'fur'); }

// Design coordinates are scaled by WS (each beast sets its own size), with
// the paws on design y = 36 and the canvas 48 high, so the paws sit at the
// sprite's origin (0.75 of its height).
let WS = 1.25, ST = {};
const sp = (pts, dx = 0, dy = 0) => pts.map(([x, y]) => [(x + dx) * WS, (y + dy) * WS]);
const se = (cx, cy, rx, ry) => ({ e: [cx * WS, cy * WS, rx * WS, ry * WS] });
const sw = (w) => w * WS;
const R = (v) => Math.round(v * WS);
// Every frame has room round the drawing for wing tips, a lunging muzzle and a raised tail: more at the
// top than the bottom (a third as much), so the paws stay at the sprite's origin (0.75 of its height).
// The drawing is shifted into it by the canvas transform; anything reading raw pixels undoes the shift.
const PAD_T = 6, PAD_B = 2, PAD_X = 5;
const size = (w) => [Math.round(w * WS) + PAD_X * 2, Math.round(48 * WS) + PAD_T + PAD_B];
function frameCanvas(W, H) { const [c, ctx] = makeCanvas(W, H); ctx.translate(PAD_X, PAD_T); return [c, ctx]; }

// The trot: a two-beat gait, the diagonal pairs (near fore with far hind,
// far fore with near hind) swinging together. 8 frames; each paw is planted
// for 4, sliding back under the body as it passes over at ground speed, then
// swings for 4: lifted, folded at the wrist or hock, and reaching forward.
// The body dips at mid-stance and floats between beats.
const TROT = 8;
function stride(step, phase) { // reach -1 (back) .. 1 (forward), lift and fold 0..1
  if (step < 0) return { x: 0, lift: 0, fold: 0 }; // standing
  const p = ((step + 0.5) / TROT + phase) % 1;
  if (p < 0.5) return { x: 1 - 4 * p, lift: 0, fold: 0 };
  const s = (p - 0.5) * 2;
  return { x: -1 + 2 * s * s * (3 - 2 * s), lift: Math.sin(Math.PI * s), fold: Math.sin(Math.PI * Math.pow(s, 0.7)) };
}
const TROT_BOB = [0, 1, 1, 0, 0, 1, 1, 0];
const lerp2 = ([ax, ay], [bx, by], t) => [ax + (bx - ax) * t, ay + (by - ay) * t];
// the joint between bones l1 (from a) and l2 (to c); bend -1 puts it ahead
// of the line a-c (facing right), +1 behind
function knee([ax, ay], [cx, cy], l1, l2, bend) {
  const dx = cx - ax, dy = cy - ay, D = Math.hypot(dx, dy), d = Math.min(l1 + l2, D);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / D, uy = dy / D;
  return [ax + ux * a - uy * h * bend, ay + uy * a + ux * h * bend];
}
const THIGH = 7.4; // hip to stifle, and stifle to hock
const LEGS = 2.5; // how much higher than Keep Defense's wolf the body rides: a wolf's leg below the elbow is about as long as its chest is deep

// side, facing right. Head carried low (level with the back) on a thick
// neck, a ruff over the shoulders, a deep chest, short legs that grow out
// of the shoulder and the haunch; ears laid back (a wolf) or pricked (the
// hound), the tail bushy (a wolf) or a thin whip (the hound).
function beastSide({ step = -1, bob = 0, lunge = 0, open = false, blink = false, crouch = 0, wings = 0, lit = true }) {
  const [W, H] = size(56);
  const [c, ctx] = frameCanvas(W, H);
  const o = (pts, dx = 0, dy = 0) => sp(pts, 4 + dx, 6 + dy); // design space -> canvas
  const oe = (cx, cy, rx, ry) => se(cx + 4, cy + 6, rx, ry);
  const by = bob + crouch - (ST.legs ?? LEGS), L = lunge, hy = by + (L ? 1 : 0) + crouch, hx = 4 + L; // the body carried high on long legs
  const nF = stride(step, 0), fH = stride(step, 0), fF = stride(step, 0.5), nH = stride(step, 0.5);
  const S = 6, trot = step >= 0;
  const sway = trot ? [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5][step] : 0;
  const below = (yy) => (x, y) => y > R(yy + 6); // ink only below a design y (under the belly)
  const fore = (x0, g) => {
    const paw = [x0 + g.x * S, 30 - g.lift * 3.5], elbow = [x0 + g.x * 1.8 - 0.5 + g.fold * 1.2, 21 + by];
    return { elbow, pts: [elbow, lerp2([paw[0] + 0.3, paw[1] - 3.6], [paw[0] + 2.8, paw[1] - 2.6], g.fold), paw] };
  };
  // the hind leg keeps its bone lengths: the hip fixed in the haunch, the
  // hock above the paw, the stifle bending forward between them
  const hind = (x0, g) => {
    let paw = [x0 + g.x * S, 30 - g.lift * 3];
    const hip = [x0 + 2 + g.x * 0.4, 14 + by], meta = g.lift > 0 ? [-0.4 - g.x, -5 + g.fold * 0.4] : [-1.2, -5.2]; // the hip just inside the rump, the hock behind it under the tail
    let hock = [paw[0] + meta[0], paw[1] + meta[1]];
    const d = Math.hypot(hock[0] - hip[0], hock[1] - hip[1]), reach = THIGH * 2 - 0.05;
    if (d > reach) { hock = lerp2(hip, hock, reach / d); paw = [hock[0] - meta[0], hock[1] - meta[1]]; }
    const stifle = knee(hip, hock, THIGH, THIGH, -1);
    return { stifle, hock, pts: [hock, paw] };
  };
  // the hindquarter as one wedge: the back of the thigh in one line from
  // under the tail down to the hock, the front rising past the stifle into
  // the tucked-up flank; only the shank below the hock is drawn as a leg
  const thigh = (h, dx = 0) => {
    const [kx, ky] = h.stifle, [jx, jy] = h.hock, a = [10.6 + dx, 15 + by], P = [kx - 3.4, ky + 0.2], b = [jx - 1.2, jy - 0.4];
    const cx = Math.min(a[0], P[0]) - 0.8, cy = (a[1] + P[1]) / 2;
    const ham = [0.33, 0.66].map((t) => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * cx + t * t * P[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * cy + t * t * P[1]]);
    return [[11.8 + dx, 12 + by], a, ...ham, P, b, [jx - 0.7, jy + 0.7], [jx + 0.8, jy + 0.6], [jx + 1.2, jy - 0.6], [kx + 1.5, ky + 0.6], [kx + 2, ky - 1], [kx + 2.8, ky - 3.4]];
  };
  // the hind legs stand under the rump (as on the skeleton: hock and paw under the tail base, the back of
  // the thigh the back end of the animal), the fore legs under the shoulder
  const NF = fore(36 + L, nF), FF = fore(33 + L, fF), NH = hind(12.6, nH), FH = hind(13.6, fH);
  // the gargoyle's bat wings off the withers: folded along the back, half open as it lopes, spread to pounce
  const WING = [ // folded, half open, spread: root, wrist, tip, scallop, tip, scallop, tip, back along the body
    [[33, 9], [30, 1.5], [25.5, -2.5], [24.5, 2.5], [20.5, 2.5], [22.5, 6], [21, 9.5], [25.5, 10.5]], // standing up off the shoulders
    [[33, 9], [29.5, -2.5], [23, -6], [22.5, 0], [17, -0.5], [19.5, 4], [16.5, 8], [24, 10]],
    [[33, 9], [31, -3], [26.5, -5], [24, 0], [17.5, -2.5], [19, 3], [12, 3], [22, 9]]][wings]; // (spread wide, kept inside the frame)
  if (ST.wings) part(ctx, W, H, (q) => wing(q, W, H, o(WING, 1.6, by - 1.2), true)); // the far wing, behind
  part(ctx, W, H, (q) => leg(q, o(FF.pts), sw(4), sw(2.5), true, 1));
  part(ctx, W, H, (q) => {
    furFill(q, W, H, mask(W, H, [o(thigh(FH, -0.5))]), (x, y, t) => (t < 0.3 ? 'furD' : t < 0.75 ? 'fur' : 'furM'), 11);
    leg(q, o(FH.pts), sw(2.6), sw(2.5), true, 1);
  });
  const tl = ST.whip
    ? (trot ? [[12, 12 + by], [8.5, 11 + by], [5.5, 12.5 + by], [3 + sway * 0.5, 16 + by]] : [[12, 12 + by], [9, 12.5 + by], [6.5, 15 + by], [5, 19 + by]])
    : (trot ? [[12, 12 + by], [8.5, 13.5 + by], [5.5, 16.5 + by], [4 + sway * 0.5, 21 + by]] : [[12, 12 + by], [9, 14 + by], [7, 18 + by], [6, 23 + by]]);
  part(ctx, W, H, (q) => {
    tail(q, o(tl), ST.spade ? [4, 3.5, 3, 3, 2.5, 2] : ST.whip ? [3, 3, 2.5, 2, 2, 1.5] : [4, 5, 6, 7, 7, 6, 4]);
    if (ST.spade) { const [ex, ey] = tl[tl.length - 1]; fillMask(q, W, mask(W, H, [o([[ex + 1, ey - 1], [ex - 2.4, ey], [ex - 0.6, ey + 3.6], [ex + 2, ey + 1.4]])]), 'furM'); } // a spade at its tip
  }, (x, y) => y > R(16 + by + 6));
  // the body: level back, the ruff's hump at the withers, a deep chest, the
  // belly tucked up to the flank
  part(ctx, W, H, (q) => {
    const m = mask(W, H, [o([[11, 12], [15, 10.5], [22, 11], [27, 10.5], [30, 9], [33, 8], [36.5, 8.5], [39.5, 10.5], [39.5, 15], [38, 18.5], [35.5, 21.5], [30, 22], [25.5, 20], [22, 18], [17, 16.5], [12, 16], [10.5, 15]], 0, by),
      o(thigh(NH)), oe(NF.elbow[0] - 0.2, NF.elbow[1] - 1.4, 2.6, 2.2)]);
    furFill(q, W, H, m, (x, y, t) => (x / WS - 4 >= 33 ? FUR(t, 0.1) : FUR(t, -0.08)), 3);
    for (let y = R(16 + 6 + by); y < H; y++) { // the pale "pants" down the back of the thigh, lit from the left
      const x = [...Array(R(24))].findIndex((_, xx) => m[y * W + xx]);
      if (x >= 0) { px(q, x, y, 'furXL'); if (m[y * W + x + 1] && m[y * W + x + 2]) px(q, x + 1, y, 'furL'); }
    }
    for (let k = 0; k < 8; k++) px(q, R(40) - (k % 3), R(18 + by) + (k >> 1) * 2, 'furXL', 1, 2); // long pale ruff fur down the neck
    for (let k = 0; k < 6; k++) px(q, R(18 + 4 + k * 3.2), R(17 + 6 + by) - (k % 2), 'furL', 2, 1); // flank highlights
    for (let k = 0; k < 5; k++) px(q, R(19 + 4 + k * 3), R(10.5 + 6 + by) + 1, 'furD', 2, 1); // the dark saddle's edge
  });
  if (ST.wings) part(ctx, W, H, (q) => wing(q, W, H, o(WING, 0, by), false), true); // the near wing, over the back
  // ears behind the skull: small and laid back, or pricked up tall (or horns); the head over them
  if (!ST.horns) part(ctx, W, H, (q) => {
    const ears = ST.pricked
      ? [[[38.4, 14.8], [39, 10], [40.2, 14.4], 'fur'], [[40.2, 15], [41.3, 7], [42.6, 14.8], 'furM']] // tall and narrow, pointed
      : [[[37.5, 15.5], [37.5, 12], [40, 15], 'fur'], [[39.5, 15], [39.5, 10.8], [42.2, 15], 'furM']];
    for (const [a, b, d, col] of ears) fillMask(q, W, mask(W, H, [sp([[a[0] + hx, a[1] + hy], [b[0] + hx, b[1] + hy], [d[0] + hx, d[1] + hy]])]), col);
    if (!ST.pricked) px(q, R(40.2 + hx), R(13 + hy), 'leatherD', 1, 2); // the dark inside of a laid-back ear (a pricked one shows its back)
  }, true);
  part(ctx, W, H, (q) => {
    const snout = ST.pricked ? 1.4 : 0; // the hound's longer, narrower muzzle
    const m = mask(W, H, [o([[37, 10], [39, 8.8], [42, 8.8], [44, 10.2], [48 + snout, 11.8], [49.6 + snout, 12.8], [49.2 + snout, 14], [44.5, 14.8], [42, 16.4], [39, 17], [37, 15.5]], L, hy)]);
    furFill(q, W, H, m, (x, y, t) => {
      const dx = x / WS - hx;
      if (dx >= 43 && t > 0.5) return 'furXL'; // pale lower muzzle
      if (dx < 42 && t > 0.6) return 'furXL'; // cheek ruff
      return t < 0.25 ? 'fur' : t < 0.6 ? 'furM' : 'furL';
    }, 4);
  }, (x, y) => y < R(10 + 6 + hy)); // a line only where the skull meets the ears
  if (ST.horns) part(ctx, W, H, (q) => { for (const [d, far] of [[1.2, true], [0, false]]) horn(q, W, H, sp([[43 + d, 15.6], [41.8 + d, 12], [40 + d, 9.6], [38.2 + d, 8], [39.6 + d, 10.8], [40.8 + d, 13.2], [41.2 + d, 15.8]].map(([x, y]) => [x + hx, y + hy])), far); }, true); // horns sweeping back off the brow
  // near legs over the body: seamless where they join it
  part(ctx, W, H, (q) => leg(q, o(NF.pts), sw(4.5), sw(3), false, 1), below(21.5), true);
  part(ctx, W, H, (q) => leg(q, o(NH.pts), sw(2.8), sw(3), false, 1), null, true);
  // face: eye under the brow, nose, mouth
  const fy = 6 + hy, ex = R(42 + hx), sn = ST.pricked ? 1.4 : 0;
  if (blink) px(ctx, ex, R(11 + fy), 'furD', 2, 1); else { px(ctx, ex, R(11 + fy), 'ink', 3, 1); px(ctx, ex, R(11 + fy), lit ? ST.eye : 'furM'); }
  px(ctx, ex - 1, R(11 + fy) - 1, 'furD', 4, 1); // brow
  px(ctx, R(48.5 + sn + hx), R(12 + fy), 'ink', 2, 2); // nose
  if (open) {
    px(ctx, R(43 + hx), R(14 + fy), 'redD', 7, 2); px(ctx, R(44 + hx), R(14 + fy), 'white'); px(ctx, R(47.5 + sn + hx), R(14 + fy), 'white');
    px(ctx, R(42 + hx), R(16 + fy), 'furL', 7, 1);
  } else { px(ctx, R(44 + hx), R(14 + fy), 'ink', 5 + Math.round(sn), 1); if (ST.horns) px(ctx, R(46 + hx), R(14 + fy) + 1, 'white'); } // the gargoyle's fang over its lip
  return c;
}

// facing you. From above and in front the body is long: the back runs away
// up the screen to the tail; the broad head is held low at the front, the
// front legs planted either side of it.
function beastDown({ step = -1, bob = 0, open = false, blink = false, lunge = 0, crouch = 0, wings = 0, lit = true }) {
  const [W, H] = size(36), b = bob + crouch, hy = b + (lunge ? 1 : 0) + lunge * 0.6;
  const [c, ctx] = frameCanvas(W, H);
  const g = [stride(step, 0), stride(step, 0.5)];
  const sway = step < 0 ? 0 : [-1, -0.5, 0, 0.5, 1, 0.5, 0, -0.5][step];
  const foreX = [13.8, 22.2];
  if (ST.wings) for (const s of [-1, 1]) { // the wings rise behind it from the shoulders
    const T = [[[5, 19], [8, 14], [11.5, 11], [10.5, 14], [11, 16.5], [9.5, 17], [8.5, 20.5], [6, 21]], [[5, 19], [9, 12], [13.5, 8], [12, 12.5], [13, 16], [11, 16.5], [9.5, 20.5], [6.5, 21]], [[5, 19], [10, 10], [16, 4], [14, 9.5], [15.5, 14], [12.5, 14.5], [11, 19.5], [7, 21]]][wings];
    part(ctx, W, H, (q) => wing(q, W, H, sp(T.map(([x, y]) => [18 + s * x, y + b])), false));
  }
  part(ctx, W, H, (q) => tail(q, sp(ST.whip ? [[18.5, 10 + b], [19.5 + sway, 6.5 + b], [20.5 + sway * 1.5, 4 + b], [19.5 + sway * 1.5, 2 + b]] : [[18.5, 10 + b], [19.5 + sway, 6 + b], [20.5 + sway * 1.5, 3 + b], [19 + sway * 1.5, 1 + b]]), ST.whip ? [3, 2.5, 2, 1.5] : [4, 4, 4, 3]));
  part(ctx, W, H, (q) => {
    const m = mask(W, H, [se(18, 12 + b, 4.5, 4.5), se(18, 17 + b, 6, 5.5), se(18, 22.5 + b, 8, 4.5),
      ...foreX.map((x, i) => se(x + (i ? 0.3 : -0.3), 25.5 + b - g[i].lift * 0.8, 2.7, 3.4))]);
    furFill(q, W, H, m, (x, y) => {
      const dx = x / WS + 0.5 / WS - 18, yy = y / WS;
      if (Math.abs(dx) < 0.8 && yy < 21 + b) return 'furD'; // the dark line down the spine
      if (Math.abs(dx) < 2.5 && yy < 17 + b) return 'fur'; // the saddle
      if (yy > 21 + b && Math.abs(dx) > 5.5) return 'furL'; // the ruff at the shoulders
      return dx < -2 ? 'furL' : 'furM';
    }, 5);
  }, (x, y) => y < R(10 + b));
  foreX.forEach((x, i) => {
    const s2 = i ? 1 : -1, { x: r, lift, fold } = g[i];
    const paw = [x + s2 * 0.3, 36 + r * 1.2 - lift * 3.5];
    part(ctx, W, H, (q) => leg(q, sp([[x, 27 + b - lift], [x + s2 * 0.5, 31 + b - lift * 1.5 - fold], paw]), sw(4), sw(2.5), false), (xx, yy) => yy > R(28.5 + b), true);
  });
  // ears at the corners of the skull (laid back, or pricked up tall), then the head over them
  if (ST.horns) part(ctx, W, H, (q) => { for (const s of [-1, 1]) horn(q, W, H, sp([[18 + s * 3.4, 21], [18 + s * 5.6, 19.8], [18 + s * 7.4, 16], [18 + s * 6.6, 15.2], [18 + s * 4.8, 18.4]].map(([x, y]) => [x, y + hy])), s > 0); }, true);
  else part(ctx, W, H, (q) => { for (const s of [-1, 1]) {
    const tri = ST.pricked ? [[18 + s * 5.4, 22 + hy], [18 + s * 5.6, 14.6 + hy], [18 + s * 2.6, 20 + hy]] : [[18 + s * 5.5, 22 + hy], [18 + s * 6.2, 18 + hy], [18 + s * 2.5, 20 + hy]];
    fillMask(q, W, mask(W, H, [sp(tri)]), s < 0 ? 'furM' : 'fur'); px(q, R(18 + s * (ST.pricked ? 4.6 : 5)) - (s > 0 ? 1 : 0), R((ST.pricked ? 18 : 20) + hy), 'leatherD', 1, ST.pricked ? 3 : 2);
  } }, true);
  part(ctx, W, H, (q) => {
    const sn = ST.pricked ? 1 : 0;
    const m = mask(W, H, [sp([[13, 21], [15.5, 19.5], [20.5, 19.5], [23, 21], [24, 24], [22.5, 27], [20.5 - sn * 0.4, 29 + sn], [19.8 - sn * 0.4, 32 + sn], [16.2 + sn * 0.4, 32 + sn], [15.5 + sn * 0.4, 29 + sn], [13.5, 27], [12, 24]], 0, hy)]);
    furFill(q, W, H, m, (x, y, t) => {
      const dx = Math.abs((x + 0.5) / WS - 18);
      if (t > 0.55 && dx < 2.6) return t > 0.82 ? 'furXXL' : 'furXL'; // the muzzle
      if (t > 0.35 && dx > 3.8) return 'furXL'; // pale cheeks
      if (t < 0.45 && dx < 1) return 'furD'; // the dark blaze down the brow
      return t < 0.25 ? 'fur' : 'furM';
    }, 7);
  }, true);
  const ey = R(24 + hy), sn = ST.pricked ? 1 : 0;
  for (const ex of [R(15), R(20.5)]) { if (blink) px(ctx, ex, ey, 'furD', 2, 1); else { px(ctx, ex, ey, 'ink', 2, 1); px(ctx, ex + (ex < R(18) ? 1 : 0), ey, lit ? ST.eye : 'furM'); } }
  px(ctx, R(18) - 2, R(30 + sn + hy), 'ink', 5, 1); px(ctx, R(18) - 1, R(30 + sn + hy) + 1, 'ink', 3, 1); // nose
  if (open) { px(ctx, R(18) - 2, R(32 + sn + hy), 'redD', 5, 2); px(ctx, R(18) - 2, R(32 + sn + hy), 'white'); px(ctx, R(18) + 2, R(32 + sn + hy), 'white'); }
  return c;
}

// facing away. The head and ears at the top, broad shoulders with the front
// paws just showing, the back narrowing to the hips, the hind legs at the
// bottom corners, the tail hanging between them.
function beastUp({ step = -1, bob = 0, lunge = 0, crouch = 0, wings = 0 }) {
  const [W, H] = size(36), b = bob + crouch, hy = b - lunge * 0.5; // (a full lunge would lift the head clear of the shoulders)
  const [c, ctx] = frameCanvas(W, H);
  const fore = [stride(step, 0), stride(step, 0.5)], hind = [stride(step, 0.5), stride(step, 0)];
  const sway = step < 0 ? 0 : [-1, -0.5, 0, 0.5, 1, 0.5, 0, -0.5][step];
  const hindX = [13.5, 22.5];
  [12.5, 23.5].forEach((x, i) => part(ctx, W, H, (q) => leg(q, sp([[x, 15 + b], [x, 22 - fore[i].x * 0.8 - fore[i].lift * 2]]), sw(3), sw(2), true)));
  if (ST.horns) part(ctx, W, H, (q) => { for (const s of [-1, 1]) horn(q, W, H, sp([[18 + s * 2.4, 6], [18 + s * 4.4, 5], [18 + s * 6, 1.2], [18 + s * 5.2, 0.6], [18 + s * 3.6, 3.6]].map(([x, y]) => [x, y + hy])), s > 0); });
  else part(ctx, W, H, (q) => { for (const s of [-1, 1]) {
    const tri = ST.pricked ? [[18 + s * 3.6, 7 + hy], [18 + s * 3.4, 0.6 + hy], [18 + s * 1.4, 5.5 + hy]] : [[18 + s * 3.8, 7 + hy], [18 + s * 3.4, 2.5 + hy], [18 + s * 1.2, 5.5 + hy]];
    fillMask(q, W, mask(W, H, [sp(tri)]), s < 0 ? 'furM' : 'fur');
  } });
  part(ctx, W, H, (q) => {
    const m = mask(W, H, [sp([[18, 3.5 + hy], [21.5, 6.5 + hy], [22.5, 10.5 + hy], [18, 12 + hy], [13.5, 10.5 + hy], [14.5, 6.5 + hy]])]);
    furFill(q, W, H, m, (x) => (Math.abs((x + 0.5) / WS - 18) < 0.8 ? 'fur' : x / WS < 18 ? 'furM' : 'fur'), 10);
  }, true);
  part(ctx, W, H, (q) => {
    const m = mask(W, H, [se(18, 15 + b, 7.5, 5), se(18, 21 + b, 5.5, 5), se(18, 27.5 + b, 7, 5),
      ...hindX.map((x, i) => se(x + (i ? 0.3 : -0.3), 28.5 + b - hind[i].lift * 0.8, 3.1, 3.3))]);
    furFill(q, W, H, m, (x, y) => {
      const dx = Math.abs((x + 0.5) / WS - 18), yy = y / WS;
      if (dx < 0.8) return 'furD'; // the dark line down the spine
      if (dx < 3 && yy < 25 + b) return 'fur'; // the saddle
      if (yy < 15 + b && dx > 5) return 'furL'; // the ruff over the shoulders
      return x / WS < 16 ? 'furL' : 'furM';
    }, 9);
  }, (x, y) => y < R(12 + b));
  if (ST.wings) for (const s of [-1, 1]) { // the wings on its back, toward us
    const T = [[[3.5, 14], [7, 10], [10.5, 7.5], [9.5, 11], [10, 14], [8.5, 14.5], [7.5, 18.5], [4.5, 19.5]], [[3.5, 14], [8, 9], [13, 5.5], [11.5, 10], [12.5, 14], [10.5, 14.5], [9, 18.5], [5, 19.5]], [[3.5, 14], [9, 7], [15.5, 1.5], [13.5, 7], [15, 12], [12, 12.5], [10.5, 17.5], [6, 19]]][wings];
    part(ctx, W, H, (q) => wing(q, W, H, sp(T.map(([x, y]) => [18 + s * x, y + b])), false), true);
  }
  hindX.forEach((x, i) => {
    const s2 = i ? 1 : -1, { x: r, lift, fold } = hind[i];
    part(ctx, W, H, (q) => leg(q, sp([[x, 30 + b - lift], [x + s2 * 0.6, 33 + b - lift * 1.5 - fold * 0.5], [x + s2 * 0.3, 36 - r * 1.2 - lift * 3]]), sw(4.5), sw(3), false), (xx, yy) => yy > R(32 + b), true);
  });
  part(ctx, W, H, (q) => tail(q, sp(ST.whip ? [[18, 25 + b], [18 + sway, 30 + b], [18 + sway * 2, 35 + b]] : [[18, 25 + b], [18 + sway, 30 + b], [18 + sway * 2, 36 + b]]), ST.whip ? [3, 3, 2.5, 2, 1.5] : [5, 6, 6, 6, 5, 4]), (x, y) => y > R(28 + b));
  return c;
}

// recolour the fur ramp (and anything else listed) into a beast's own tones
function recolour(c, map) {
  const ctx = c.getContext('2d'), img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  const pairs = Object.entries(map).map(([from, to]) => [rgb(from), rgb(to)]);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    for (const [f, t] of pairs) if (d[i] === f[0] && d[i + 1] === f[1] && d[i + 2] === f[2]) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; break; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// the spectral hound's ghost-light: lit from within along its upper edge,
// its outline a deep teal instead of ink, and its whip tail's tip fraying
// off into mist
function ghostLight(c, view) {
  const ctx = c.getContext('2d'), W = c.width, H = c.height, img = ctx.getImageData(0, 0, W, H), d = img.data;
  const [ir, ig, ib] = rgb('ink'), [gr, gg, gb] = rgb('glowL'), soft = [16, 42, 52];
  const isInk = (i) => d[i] === ir && d[i + 1] === ig && d[i + 2] === ib;
  for (let x = 0; x < W; x++) { // the first coat pixel under the outline, down each column
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3] || isInk(i)) continue;
      if (y > 0 && d[i - W * 4 + 3]) { d[i] = gr; d[i + 1] = gg; d[i + 2] = gb; }
      break;
    }
  }
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] && isInk(i)) { d[i] = soft[0]; d[i + 1] = soft[1]; d[i + 2] = soft[2]; }
  ctx.putImageData(img, 0, 0);
  if (view === 'side') { // the tail's tip, fraying off behind it
    let tx = -1, ty = -1;
    for (let x = 0; x < W && tx < 0; x++) for (let y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3]) { tx = x; ty = y; break; }
    if (tx > 2) { px(ctx, tx - 1, ty, 'glow'); px(ctx, tx - 2, ty - 1, 'glowL'); px(ctx, tx - 3, ty - 1, 'glow'); }
  }
}

const BEASTS = {
  // the Tower Gargoyle: a grotesque of tower stone prowling on all fours, folded bat wings that half open as
  // it lopes and spread as it pounces, horns curling back off its skull, a spade-tipped tail, cracks in the
  // stone; at rest it's a statue, its eyes dark, and they kindle curse-light when it moves
  gargoyle: { ws: 1.1, legs: 0.8, pricked: false, whip: true, spade: true, horns: true, wings: true, statue: true, cracks: true, eye: 'curseL', tones: { furD: '#25222f', fur: '#3d3950', furM: '#5a566f', furL: '#7d7a94', furXL: '#9f9db4', furXXL: '#c4c2d4' } },
  // Frosthelm's Frost Wolf: grey-blue saddle, frost-pale belly and ruff,
  // so it shows on snow; gold eyes
  frostwolf: { ws: 1.05, pricked: false, whip: false, eye: 'goldL', tones: { furD: '#232a40', fur: '#3a4566', furM: '#5c6a8e', furL: '#8c9abd', furXL: '#b9c6e2', furXXL: '#e6edf8' } },
  // Gloamwood's Spectral Hound: a lean hunting hound made of ghost-light
  // (pricked ears, a longer muzzle, a thin whip tail), glowing eyes, lit
  // from within along its back
  hound: { ws: 0.95, pricked: true, whip: true, eye: 'glowL', ghost: true, tones: { furD: '#1b3a48', fur: '#2a5767', furM: '#3d7584', furL: '#5c9aa3', furXL: '#8fc9c8', furXXL: '#cdf2ec' } },
};

// weathered stone: a few hairline cracks across it (drawn in the darkest step, before the recolour)
function cracks(c, seed) {
  const ctx = c.getContext('2d'), W = c.width, H = c.height, d = ctx.getImageData(0, 0, W, H).data, [ir, ig, ib] = rgb('ink');
  const coat = (x, y) => { const i = (y * W + x) * 4; return x > 0 && y > 0 && x < W && y < H && d[i + 3] && !(d[i] === ir && d[i + 1] === ig && d[i + 2] === ib); };
  for (let k = 0; k < 4; k++) {
    let x = Math.floor(W * (0.3 + hash(k, seed, 51) * 0.4)), y = Math.floor(H * (0.35 + hash(k, seed, 52) * 0.3));
    for (let i = 0; i < 4; i++) { if (coat(x, y)) px(ctx, x, y, 'furD'); x += hash(i, k + seed, 53) < 0.5 ? 1 : -1; y += 1; }
  }
}

export function buildBeast(kind) {
  const B = BEASTS[kind];
  WS = B.ws; ST = B;
  const views = {};
  let seed = 0;
  const fin = (c, v) => { if (B.cracks) cracks(c, ++seed % 3); recolour(c, B.tones); if (B.ghost) ghostLight(c, v); return c; };
  for (const [v, fn] of [['side', beastSide], ['down', beastDown], ['up', beastUp]]) {
    const idle = B.statue ? [fn({ lit: false }), fn({ lit: false })] : [fn({}), fn({ bob: 1, blink: true })]; // a gargoyle at rest is a statue: still, its eyes dark
    views[v] = {
      idle: idle.map((c) => fin(c, v)),
      walk: TROT_BOB.map((b, st) => fin(fn({ step: st, bob: b, wings: 1 }), v)),
      windup: [fn({ crouch: 1, open: true, wings: 2 }), fn({ crouch: 1, bob: 1, open: true, wings: 2 })].map((c) => fin(c, v)), // crouched low, snarling (wings spread)
      attack: [fn({ lunge: 3, open: true, wings: 2 }), fn({ lunge: 1, open: true, wings: 1 })].map((c) => fin(c, v)),
      hurt: [fin(fn({ blink: true, bob: 1 }), v)],
    };
  }
  return views;
}
