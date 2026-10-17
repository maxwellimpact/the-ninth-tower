// Puppet renderer: composes a humanoid from small hand-authored pixel grids
// (head + torso per direction) and procedural parts (legs, arms, weapons),
// posed per animation frame, then auto-outlined.
//
// Frame: 48x48. Character feet rest on y=35, centred on x=24.
// Directions: 'down', 'up', 'side' (side faces RIGHT; left is a mirror).
import { makeCanvas, grid, px, outline } from './pixel.js';

export const FRAME = 48;
export const FEET_Y = 35;
export const ORIGIN = { x: 24 / FRAME, y: 36 / FRAME };

// ---------------------------------------------------------------- primitives

function stamp(ctx, x, y, color, w = 2, h = 2) {
  px(ctx, Math.round(x), Math.round(y), color, w, h);
}

// 2px-thick arm from shoulder to hand; last pixel(s) are the hand.
function arm(ctx, sx, sy, hx, hy, colors, leftSide) {
  const [sleeve, sleeveD, hand] = colors;
  const steps = Math.max(1, Math.round(Math.hypot(hx - sx, hy - sy)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = sx + (hx - sx) * t - (leftSide ? 1 : 0);
    const y = sy + (hy - sy) * t;
    stamp(ctx, x, y, i === 0 ? sleeveD : sleeve, 2, 1);
  }
  stamp(ctx, hx - (leftSide ? 1 : 0), hy, hand, 2, 1);
}

// Pixel line along an angle.
function ray(ctx, x, y, ang, len, color, start = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = start; i < len; i++) px(ctx, Math.round(x + c * i), Math.round(y + s * i), color);
}

// --------------------------------------------------------------- weapons

export const WEAPONS = {
  sword(ctx, h, ang, glow, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const len = st.len || 9;
    ray(ctx, h.x, h.y, ang + Math.PI, 3, st.grip || 'woodD'); // grip + pommel
    px(ctx, Math.round(h.x - c * 3), Math.round(h.y - s * 3), st.guard || 'gold');
    for (const d of [-2, -1, 1, 2]) px(ctx, Math.round(h.x + c + -s * d), Math.round(h.y + s + c * d), st.guard || 'gold');
    ray(ctx, h.x + c * 2, h.y + s * 2, ang, len, st.blade || 'steelL');
    ray(ctx, h.x + c * 2 + -s, h.y + s * 2 + c, ang, len - 1, st.edge || 'steel');
    px(ctx, Math.round(h.x + c * (len + 2)), Math.round(h.y + s * (len + 2)), st.tip || 'white');
    if (st.flames) for (let i = 3; i < len; i += 3) px(ctx, Math.round(h.x + c * (i + 2) + s * 2), Math.round(h.y + s * (i + 2) - c * 2), i % 2 ? 'red' : 'fire');
  },
  staff(ctx, h, ang, glow = 0, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const [sh, shD] = st.shaft || ['wood', 'woodD'];
    ray(ctx, h.x - c * 5, h.y - s * 5, ang, 16, sh);
    ray(ctx, h.x - c * 5 + 1, h.y - s * 5, ang, 15, shD);
    const gx = Math.round(h.x + c * 11), gy = Math.round(h.y + s * 11);
    const rim = st.rim || 'gold', core = st.core || 'goldL', gl = st.glow || 'fireL';
    if (st.hook) { px(ctx, gx + 2, gy - 1, sh, 1, 3); px(ctx, gx + 1, gy - 2, sh, 2, 1); }
    if (st.crystal) {
      for (let y = -3; y <= 2; y++) { const hw = y < 0 ? 3 + y : 2 - y; px(ctx, gx - hw, gy + y, rim, hw * 2 + 1, 1); }
      px(ctx, gx, gy - 1, core);
    } else {
      const r = st.big ? 2 : 1;
      px(ctx, gx - r, gy - r, rim, r * 2 + 1, r * 2 + 1);
      px(ctx, gx, gy, glow ? 'white' : core);
      if (st.big) px(ctx, gx - 1, gy - 1, core);
    }
    if (glow) {
      px(ctx, gx - 2 - (st.big ? 1 : 0), gy, gl); px(ctx, gx + 2 + (st.big ? 1 : 0), gy, gl);
      px(ctx, gx, gy - 2 - (st.big ? 1 : 0), gl); px(ctx, gx, gy + 2 + (st.big ? 1 : 0), gl);
      if (glow > 1) { px(ctx, gx - 3, gy - 3, core); px(ctx, gx + 3, gy - 3, core); px(ctx, gx + 3, gy + 3, core); px(ctx, gx - 3, gy + 3, core); }
    }
  },
  dagger(ctx, h, ang, glow, st = {}) {
    const len = st.len || 6;
    const c = Math.cos(ang), s = Math.sin(ang);
    ray(ctx, h.x, h.y, ang + Math.PI, 2, 'leatherD');
    for (let i = 1; i < len; i++) {
      const w = st.wavy ? (i % 2 ? 1 : -1) * 0.6 : 0;
      px(ctx, Math.round(h.x + c * i - s * w), Math.round(h.y + s * i + c * w), st.blade || 'steelL');
    }
    px(ctx, Math.round(h.x + c * len), Math.round(h.y + s * len), st.tip || 'white');
    px(ctx, Math.round(h.x - s), Math.round(h.y + c), st.guard || 'gold');
    if (st.glow) px(ctx, Math.round(h.x + c * 3 + s), Math.round(h.y + s * 3 - c), st.glow);
  },
  pickaxe(ctx, h, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ray(ctx, h.x - c * 2, h.y - s * 2, ang, 11, 'woodL');
    ray(ctx, h.x - c * 2 + 1, h.y - s * 2, ang, 10, 'wood');
    // curved iron head across the end of the haft
    const hx = h.x + c * 8, hy = h.y + s * 8;
    for (let t = -4; t <= 4; t++) {
      const bend = Math.abs(t) * 0.35;
      px(ctx, Math.round(hx - s * t - c * bend), Math.round(hy + c * t - s * bend), Math.abs(t) > 2 ? 'steelL' : 'steel');
    }
  },
  // the pick seen end-on (facing you or facing away, swinging in line with the
  // view): no crossbar, just a thick iron head with its point running on past
  // the end of the haft, toward or away from you
  pickaxeEnd(ctx, h, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ray(ctx, h.x - c * 2, h.y - s * 2, ang, 9, 'woodL');
    ray(ctx, h.x - c * 2 + 1, h.y - s * 2, ang, 8, 'wood');
    const hx = h.x + c * 7, hy = h.y + s * 7;
    // the head, foreshortened: a broad iron collar across the haft end (darker at its edges)...
    for (let t = -2; t <= 2; t++) px(ctx, Math.round(hx - s * t), Math.round(hy + c * t), Math.abs(t) === 2 ? 'steelD' : 'steel');
    for (let t = -1; t <= 1; t++) px(ctx, Math.round(hx - s * t + c), Math.round(hy + c * t + s), 'steel');
    // ...and its point coming on toward / away from you, tapering to a bright tip
    for (let i = 2; i <= 3; i++) px(ctx, Math.round(hx + c * i), Math.round(hy + s * i), i === 3 ? 'white' : 'steelL');
  },
  sickle(ctx, h, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ray(ctx, h.x, h.y, ang + Math.PI, 3, 'woodD');
    for (let i = 0; i < 7; i++) {
      const a = ang - 0.9 + i * 0.32;
      px(ctx, Math.round(h.x + Math.cos(a) * (3 + i * 0.3)), Math.round(h.y + Math.sin(a) * (3 + i * 0.3)), i > 4 ? 'white' : 'steelL');
    }
  },
  bow(ctx, h, ang, glow, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const cx = h.x + c * 2, cy = h.y + s * 2;
    const half = st.len || 6, bend = st.bend || 2.5;
    let e0 = null, e1 = null;
    for (let t = -1; t <= 1.001; t += 0.125) {
      const x = cx + -s * t * half + c * (1 - t * t) * bend, y = cy + c * t * half + s * (1 - t * t) * bend;
      px(ctx, Math.round(x), Math.round(y), Math.abs(t) > 0.7 ? st.tips || 'woodD' : st.wood || 'woodL');
      if (t <= -1) e0 = [x, y];
      e1 = [x, y];
    }
    const n = 12;
    for (let i = 0; i <= n; i++) px(ctx, Math.round(e0[0] + (e1[0] - e0[0]) * (i / n)), Math.round(e0[1] + (e1[1] - e0[1]) * (i / n)), st.string || 'bone');
  },
  // hand axe / hatchet: short haft, bearded head
  axe(ctx, h, ang, glow, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const len = st.len || 8;
    ray(ctx, h.x - c * 2, h.y - s * 2, ang, len + 2, st.haft || 'wood');
    const hx = h.x + c * (len - 1), hy = h.y + s * (len - 1);
    for (let t = -1; t <= (st.bearded ? 3 : 2); t++) {
      const w = t === -1 || t === (st.bearded ? 3 : 2) ? 2 : 3;
      for (let k = 0; k < w; k++) px(ctx, Math.round(hx + -s * (k + 1) + c * t * 0.6), Math.round(hy + c * (k + 1) + s * t * 0.6), k === w - 1 ? st.edge || 'steelL' : st.head || 'steel');
    }
    px(ctx, Math.round(hx + c), Math.round(hy + s), st.haftD || 'woodD');
  },
  // war hammer (Oake): a long haft with a squared head, struck face lit
  hammer(ctx, h, ang, glow, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const len = st.len || 9;
    ray(ctx, h.x - c * 2, h.y - s * 2, ang, len + 2, st.haft || 'wood');
    const hx = h.x + c * len, hy = h.y + s * len;
    for (let t = -1; t <= 1; t++) for (let k = -2; k <= 2; k++) {
      const x = Math.round(hx + c * t - s * k), y = Math.round(hy + s * t + c * k);
      px(ctx, x, y, k === 2 || k === -2 ? st.face || 'steelL' : st.head || 'steel');
    }
    if (st.glow) px(ctx, Math.round(hx), Math.round(hy), st.glow);
  },
  // spanner (Gizmo): a short shaft and an open jaw
  wrench(ctx, h, ang, glow, st = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const len = st.len || 7;
    ray(ctx, h.x - c * 1, h.y - s * 1, ang, 3, st.grip || 'leatherD');
    ray(ctx, h.x + c * 2, h.y + s * 2, ang, len - 1, st.head || 'steel');
    const hx = h.x + c * (len + 1), hy = h.y + s * (len + 1);
    for (const k of [-2, 2]) for (let t = 0; t <= 1; t++) px(ctx, Math.round(hx + c * t - s * k), Math.round(hy + s * t + c * k), st.jaw || 'steelL');
    px(ctx, Math.round(hx - s), Math.round(hy + c), st.head || 'steel'); px(ctx, Math.round(hx + s), Math.round(hy - c), st.head || 'steel');
  },
  spear(ctx, h, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ray(ctx, h.x - c * 6, h.y - s * 6, ang, 17, 'woodL');
    ray(ctx, h.x + c * 11, h.y + s * 11, ang, 4, 'steelL');
    px(ctx, Math.round(h.x + c * 11 - s), Math.round(h.y + s * 11 + c), 'steel');
  },
};

// Motion smear: crescent of light pixels along the swing arc.
function smear(ctx, sm) {
  const { cx, cy, a0, a1, r0, r1 } = sm;
  const n = Math.ceil(Math.abs(a1 - a0) * r1 * 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    // thin at the start, thick at the leading edge
    const thick = Math.round((r1 - r0) * (0.25 + 0.75 * t));
    for (let r = r1 - thick; r <= r1; r++) {
      const col = r === r1 ? 'white' : t > 0.6 ? 'steelL' : 'mist';
      px(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), col);
    }
  }
}

// ------------------------------------------------------------------- legs

function legsFront(ctx, def, pose, view) {
  const [pants, pantsD, boot] = def.legs;
  const lift = pose.lift || [0, 0];
  const crouch = pose.crouch || 0;
  const len = 6 - crouch;
  [[20, lift[0]], [25, lift[1]]].forEach(([x, l], i) => {
    const top = FEET_Y - len + 1 - l;
    for (let y = 0; y < len; y++) {
      const col = y >= len - 2 ? boot : i === 0 ? pantsD : pants;
      px(ctx, x, top + y, col, 3, 1);
    }
    if (view === 'down') px(ctx, x, FEET_Y - l, boot, 3, 1);
  });
}

function legsSide(ctx, def, pose) {
  const [pants, pantsD, boot] = def.legs;
  const st = pose.stride || 0;
  const lift = pose.lift || [0, 0];
  const crouch = pose.crouch || 0;
  const len = 6 - crouch;
  // back leg (darker) then front leg
  [[22 - st, lift[0], pantsD], [22 + st, lift[1], pants]].forEach(([x, l, col]) => {
    const top = FEET_Y - len + 1 - l;
    for (let y = 0; y < len; y++) px(ctx, x, top + y, y >= len - 2 ? boot : col, 3, 1);
    px(ctx, x + 3, FEET_Y - l, boot); // toe pointing forward
  });
}

// ---------------------------------------------------------------- compose

// Sway rows of the torso grid (robe hems, scarves) by pose.sway.
function torsoGrid(ctx, rows, map, ox, oy, sway, swayFrom) {
  rows.forEach((row, i) => grid(ctx, [row], map, ox + (i >= swayFrom ? sway : 0), oy + i));
}

// pose: { bob, lift, stride, crouch, sway, handR, handL, angR, angL, glow, smear, weaponBehind }
export function drawPuppet(def, view, pose = {}) {
  const [c, ctx] = makeCanvas(FRAME, FRAME);
  const bob = pose.bob || 0;
  const crouch = pose.crouch || 0;
  const by = bob + crouch;
  const head = def.head[view];
  const torso = def.torso[view];
  const tw = Math.max(...torso.map((r) => r.length));
  const torsoX = view === 'side' ? 24 - Math.ceil(tw / 2) + (def.sideTorsoNudge || 0) : 24 - tw / 2;
  const torsoY = 24 + by;
  const headY = 24 - head.length + by;
  const hw = Math.max(...head.map((r) => r.length));
  const headX = 24 - Math.ceil(hw / 2);
  const armC = def.arms;

  // Default hand positions (relative to frame), override via pose.
  let shR, shL, hR, hL;
  if (view === 'down') {
    // character's right hand is screen-left when facing the camera
    shR = { x: 19, y: 24 + by }; shL = { x: 28, y: 24 + by };
    hR = pose.handR || { x: 19, y: 28 + by }; hL = pose.handL || { x: 28, y: 28 + by };
  } else if (view === 'up') {
    shR = { x: 28, y: 24 + by }; shL = { x: 19, y: 24 + by };
    hR = pose.handR || { x: 28, y: 28 + by }; hL = pose.handL || { x: 19, y: 28 + by };
  } else {
    shR = { x: 23, y: 24 + by }; shL = { x: 25, y: 24 + by };
    hR = pose.handR || { x: 23 + (pose.swing || 0), y: 28 + by }; hL = pose.handL || { x: 25 - (pose.swing || 0), y: 27 + by };
  }
  if (pose.handR) hR = { x: pose.handR.x, y: pose.handR.y + by };
  if (pose.handL) hL = { x: pose.handL.x, y: pose.handL.y + by };

  const wR = typeof def.weaponR === 'string' ? { kind: def.weaponR, style: {} } : def.weaponR;
  const wL = typeof def.weaponL === 'string' ? { kind: def.weaponL, style: {} } : def.weaponL;
  // a tool pose (harvesting) swaps the weapon for the tool and stows the off-hand
  const weaponR = () => (pose.tool ? WEAPONS[pose.tool](ctx, hR, pose.angR) : wR && WEAPONS[wR.kind](ctx, hR, pose.angR ?? def.idleAng[view], pose.glow || 0, wR.style));
  const weaponL = () => !pose.tool && wL && WEAPONS[wL.kind](ctx, hL, pose.angL ?? def.idleAngL?.[view] ?? Math.PI / 2, 0, wL.style);
  const offhand = () => !pose.tool && def.offhand && def.offhand(ctx, view, hL, pose);
  const headMap = def.headMap || def.map, torsoMap = def.torsoMap || def.map;
  const drawHead = () => {
    grid(ctx, head, headMap, headX, headY);
    const o = def.headOver;
    if (o) grid(ctx, o.rows[view], o.map, headX, headY + head.length - 8 - o.oy);
  };

  const back = () => !pose.tool && def.back && def.back(ctx, view, by);
  if (view !== 'up') back();
  const leftSideR = view === 'down'; // which arm is on screen-left
  if (view === 'up') {
    // facing away: weapons and arms partly behind the body, and the off hand's
    // shield or book is held out in front of him, so the body hides most of it
    weaponR(); weaponL();
    offhand();
    legsFront(ctx, def, pose, view);
    arm(ctx, shR.x, shR.y, hR.x, hR.y, armC, false);
    arm(ctx, shL.x, shL.y, hL.x, hL.y, armC, true);
    torsoGrid(ctx, torso, torsoMap, torsoX, torsoY, pose.sway || 0, def.swayFrom ?? 99);
    back();
    drawHead();
  } else if (view === 'down') {
    legsFront(ctx, def, pose, view);
    torsoGrid(ctx, torso, torsoMap, torsoX, torsoY, pose.sway || 0, def.swayFrom ?? 99);
    if (pose.weaponBehind) weaponR();
    arm(ctx, shR.x, shR.y, hR.x, hR.y, armC, leftSideR);
    arm(ctx, shL.x, shL.y, hL.x, hL.y, armC, !leftSideR);
    drawHead();
    if (!pose.weaponBehind) weaponR();
    weaponL();
    offhand();
  } else {
    // side (facing right): far arm + off-hand behind, near arm + weapon in front
    if (wL) weaponL();
    if (def.offhand?.held) offhand(); // carried in the far hand, behind the body
    arm(ctx, shL.x, shL.y, hL.x, hL.y, [armC[1], armC[1], armC[2]], false);
    legsSide(ctx, def, pose);
    torsoGrid(ctx, torso, torsoMap, torsoX, torsoY, pose.sway || 0, def.swayFrom ?? 99);
    drawHead();
    if (!def.offhand?.held) offhand();
    if (pose.weaponBehind) weaponR();
    arm(ctx, shR.x, shR.y, hR.x, hR.y, armC, false);
    if (!pose.weaponBehind) weaponR();
  }

  outline(c, 'ink');
  if (pose.smear) smear(ctx, pose.smear); // smears are unoutlined light streaks
  return c;
}

// Rotate a frame by k*90deg around the character's centre of mass (for rolls
// and the downed pose). Exact pixel rotation — no resampling blur.
export function rotateFrame(src, k, cx = 24, cy = 28) {
  const [c, ctx] = makeCanvas(FRAME, FRAME);
  ctx.translate(cx, cy);
  ctx.rotate((k * Math.PI) / 2);
  ctx.drawImage(src, -cx, -cy);
  return c;
}

export function mirrorFrame(src) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// --------------------------------------------------------- animation sets

const WALK_FRONT = [
  { lift: [2, 0], bob: 0, sway: -1, arms: 1 },
  { lift: [0, 0], bob: -1, sway: 0, arms: 0 },
  { lift: [0, 2], bob: 0, sway: 1, arms: -1 },
  { lift: [0, 0], bob: -1, sway: 0, arms: 0 },
];
const WALK_SIDE = [
  { stride: 2, lift: [0, 0], bob: 0, swing: -2, sway: -1 },
  { stride: 0, lift: [1, 0], bob: -1, swing: 0, sway: 0 },
  { stride: -2, lift: [0, 0], bob: 0, swing: 2, sway: 1 },
  { stride: 0, lift: [0, 1], bob: -1, swing: 0, sway: 0 },
];

function walkPose(view, f) {
  if (view === 'side') return { ...WALK_SIDE[f] };
  const p = WALK_FRONT[f];
  // arm swing: one hand forward (lower), other back
  const r = view === 'down' ? { x: 19, y: 28 + p.arms } : { x: 28, y: 28 - p.arms };
  const l = view === 'down' ? { x: 28, y: 28 - p.arms } : { x: 19, y: 28 + p.arms };
  return { ...p, handR: r, handL: l };
}

// Build every frame for a puppet def. Returns { [anim]: { down:[], up:[], side:[] } }.
export function buildPuppetFrames(def) {
  const views = ['down', 'up', 'side'];
  const out = { idle: {}, walk: {}, attack: {}, cast: {}, dodge: {}, hurt: {}, downed: {}, mine: {}, gather: {} };
  // Mining: a real overhead pick swing, both hands on the haft. Lift it up
  // behind the head, hold it high, bring it down fast, and the point bites the
  // ground in front with the knees bent. Six frames at 10fps (0.6 s, the swing
  // period): the lift and the strike are held two frames, the downswing one.
  const pick = (x, y, ang, crouch = 0, tool = 'pickaxe') => ({ handR: { x, y }, handL: { x: Math.round(x + Math.cos(ang) * 3), y: Math.round(y + Math.sin(ang) * 3) }, angR: ang, tool, crouch });
  const end = (x, y, ang, crouch = 0) => pick(x, y, ang, crouch, 'pickaxeEnd'); // facing you / away: the head is seen end-on
  const swing = (lift, top, down, hit) => [lift, lift, top, down, hit, hit];
  const MINE = {
    // facing right: up behind the head, over the top, forward, point into the ground ahead
    side: swing(pick(21, 19, -2.25), pick(21, 14, -1.95), pick(28, 20, -0.35), pick(28, 26, 1.1, 1)),
    // facing you: raised overhead, then straight down in front, head at the feet
    down: swing(end(22, 15, -1.85), end(24, 13, -1.57), end(24, 22, 1.57), end(24, 27, 1.57, 1)),
    // facing away: raised overhead, then forward and down onto the ground ahead
    up: swing(end(26, 16, -1.35), end(24, 13, -1.57), end(24, 17, -1.6), end(26, 21, -1.4, 1)),
  };
  const GATHER = {
    down: [{ handR: { x: 20, y: 30 }, angR: 2.5, tool: 'sickle', crouch: 2 }, { handR: { x: 25, y: 31 }, angR: 0.6, tool: 'sickle', crouch: 2 }],
    side: [{ handR: { x: 26, y: 30 }, angR: 1.6, tool: 'sickle', crouch: 2 }, { handR: { x: 30, y: 31 }, angR: 0.2, tool: 'sickle', crouch: 2 }],
    up: [{ handR: { x: 28, y: 27 }, angR: -2.0, tool: 'sickle', crouch: 2 }, { handR: { x: 23, y: 26 }, angR: -1.0, tool: 'sickle', crouch: 2 }],
  };
  for (const v of views) {
    out.idle[v] = [drawPuppet(def, v, { fi: 0 }), drawPuppet(def, v, { bob: 1, sway: 0, fi: 2 })];
    out.walk[v] = [0, 1, 2, 3].map((f) => drawPuppet(def, v, { ...walkPose(v, f), fi: f }));
    out.attack[v] = def.attack(v).map((p, i) => drawPuppet(def, v, { ...p, fi: i }));
    out.cast[v] = def.cast(v).map((p, i) => drawPuppet(def, v, { ...p, fi: i }));
    const crouch = drawPuppet(def, v, { crouch: 2 });
    const tuck = drawPuppet(def, v, { crouch: 3, handR: v === 'up' ? { x: 26, y: 27 } : { x: 21, y: 27 }, handL: v === 'up' ? { x: 21, y: 27 } : { x: 26, y: 27 } });
    const dir = v === 'side' ? 1 : v === 'down' ? 1 : -1;
    out.dodge[v] = [crouch, rotateFrame(tuck, dir), rotateFrame(tuck, 2), rotateFrame(tuck, 3 * dir), crouch];
    out.hurt[v] = [drawPuppet(def, v, { bob: 1, crouch: 1, ...(def.hurtPose?.(v) || {}) })];
    out.downed[v] = [rotateFrame(drawPuppet(def, v, { crouch: 1 }), 1, 24, 30)];
    out.mine[v] = MINE[v].map((p, i) => drawPuppet(def, v, { ...p, fi: i }));
    out.gather[v] = GATHER[v].map((p, i) => drawPuppet(def, v, { ...p, fi: i }));
  }
  return out;
}
