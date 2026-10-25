// Colosseum exterior options (dev only), drawn as facades: the front face and
// a sliver of top, no interior seen over a rim. In a running dev game:
//   const O = await import('/tools/colosseum-options.js'); await O.sheet()   // or O.sheet(true): the depth variants
// saves snapshots/colosseum-options.png (-depth.png): each option at 3x beside the current
// drum and the party, on grass. The chosen one moves into gfx/props.js.
import { makeCanvas, px, outline, hash, bayer } from '/src/gfx/pixel.js';
import { colosseumArt } from '/src/gfx/props.js';
// the one in the game now: its two layers flattened (no crowd)
const colosseum = () => { const { back, front } = colosseumArt(), c = document.createElement('canvas'); c.width = back.width; c.height = back.height; const g = c.getContext('2d'); g.drawImage(back, 0, 0); g.drawImage(front, 0, 0); return c; };

const S = { lit: 'sand', mid: 'dirtL', shade: 'dirt', course: 'dirtD', top: 'sand' };

// coursed sandstone: rows of 6, joints staggered, the east end in shade
function wall(ctx, x0, y0, w, h, { shadeFrom = 0.8, seed = 1 } = {}) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const r = y - y0, f = (x - x0) / w;
    const joint = r % 6 === 5 || ((x + Math.floor(r / 6) * 5) % 10 === 0 && r % 6 !== 0);
    const worn = hash(x >> 2, y >> 2, seed) < 0.08;
    px(ctx, x, y, joint ? S.course : worn ? S.shade : f > shadeFrom ? S.shade : f < 0.12 ? S.lit : S.mid);
  }
}
const band = (ctx, x, y, w) => { px(ctx, x, y, S.top, w, 1); px(ctx, x, y + 1, S.mid, w, 1); px(ctx, x, y + 2, S.course, w, 1); }; // a cornice
function arch(ctx, ax, ay, w, h, inside = 'ink') {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = w / 2, dx = x + 0.5 - r, dy = Math.max(0, r - y - 0.5);
    if (dx * dx + dy * dy <= r * r) px(ctx, ax + x, ay + y, y < 1 ? S.course : inside);
  }
  px(ctx, ax + Math.floor(w / 2) - 1, ay - 1, S.lit, 2, 1); // keystone
}
function arcade(ctx, x0, x1, y, h, w = 7, step = 11, inside = 'ink', skip = null) {
  for (let ax = x0; ax + w <= x1; ax += step) { if (skip && ax + w > skip[0] && ax < skip[1]) continue; arch(ctx, ax, y, w, h, inside); px(ctx, ax - 2, y - 1, S.lit, 1, h + 1); }
}
function gate(ctx, cx, top, bottom, w = 20) {
  arch(ctx, cx - w / 2, top, w, bottom - top);
  for (let x = 0; x < w; x += 3) px(ctx, cx - w / 2 + x, top + 3, 'steelD', 1, 4); // the portcullis, raised
  px(ctx, cx - w / 2 + 1, top + 6, 'steel', w - 2, 1);
  for (let y = top + 2; y < bottom; y++) { px(ctx, cx - w / 2 - 2, y, S.lit); px(ctx, cx + w / 2 + 1, y, S.shade); } // jambs
  px(ctx, cx - 3, top - 4, 'gold', 6, 3); px(ctx, cx - 2, top - 3, 'goldL', 4, 1); // a gilded crest
}
function banner(ctx, x, y, h = 10) {
  px(ctx, x, y, 'woodD', 1, h); px(ctx, x, y - 1, 'gold');
  px(ctx, x + 1, y + 1, 'red', 4, 6); px(ctx, x + 1, y + 1, 'redL', 4, 1); px(ctx, x + 2, y + 3, 'gold', 2, 1); px(ctx, x + 1, y + 7, 'redD'); px(ctx, x + 4, y + 7, 'redD');
}
const brazier = (ctx, x, base) => { px(ctx, x, base - 2, 'steelD', 4, 2); px(ctx, x + 1, base, 'steelD', 2, 5); px(ctx, x + 1, base - 5, 'fire', 2, 3); px(ctx, x + 1, base - 6, 'fireL', 2, 1); };
const hang = (ctx, x, y) => { px(ctx, x, y, 'red', 6, 9); px(ctx, x, y, 'redL', 6, 1); px(ctx, x + 2, y + 3, 'gold', 2, 2); for (let i = 0; i < 6; i += 2) px(ctx, x + i, y + 9, 'red'); }; // a long cloth banner on the wall

// A: a straight facade: attic band with small windows, two arcades, the gate
export function optStraight() {
  const W = 128, H = 76, [c, ctx] = makeCanvas(W, H);
  wall(ctx, 2, 12, W - 4, H - 13);
  band(ctx, 2, 12, W - 4);
  for (let x = 8; x < W - 8; x += 10) px(ctx, x, 16, 'night', 3, 3); // attic windows
  band(ctx, 2, 23, W - 4);
  arcade(ctx, 8, W - 6, 28, 12);
  band(ctx, 2, 42, W - 4);
  arcade(ctx, 8, W - 6, 48, 18, 7, 11, 'ink', [44, 84]);
  gate(ctx, 64, 46, H - 1, 22);
  for (const bx of [10, 34, 90, 114]) banner(ctx, bx, 2);
  brazier(ctx, 44, H - 2); brazier(ctx, 80, H - 2);
  outline(c, 'ink');
  return c;
}

// B: the same face, its ends stepping back in shade so the curve of the
// drum is only hinted, never shown from above
export function optCurvedEnds() {
  const W = 128, H = 76, [c, ctx] = makeCanvas(W, H);
  for (const [x0, w, dy] of [[2, 10, 6], [116, 10, 6]]) { wall(ctx, x0, 12 + dy, w, H - 13 - dy, { shadeFrom: 0 }); band(ctx, x0, 12 + dy, w); for (let y = 30; y < H - 6; y += 14) arch(ctx, x0 + 2, y, 6, 9, 'night'); }
  wall(ctx, 12, 12, W - 24, H - 13);
  band(ctx, 12, 12, W - 24);
  for (let x = 17; x < W - 16; x += 10) px(ctx, x, 16, 'night', 3, 3);
  band(ctx, 12, 23, W - 24);
  arcade(ctx, 18, W - 14, 28, 12);
  band(ctx, 12, 42, W - 24);
  arcade(ctx, 18, W - 14, 48, 18, 7, 11, 'ink', [44, 84]);
  for (const x of [12, W - 13]) px(ctx, x, 12, S.course, 1, H - 13); // where the face turns
  gate(ctx, 64, 46, H - 1, 22);
  for (const bx of [18, 40, 86, 108]) banner(ctx, bx, 2);
  brazier(ctx, 44, H - 2); brazier(ctx, 80, H - 2);
  outline(c, 'ink');
  return c;
}

// C: a tall gatehouse in the middle, its pediment flying the big banner,
// with lower arcaded wings either side
export function optGatehouse() {
  const W = 128, H = 80, [c, ctx] = makeCanvas(W, H);
  for (const [x0, w] of [[2, 42], [84, 42]]) {
    wall(ctx, x0, 24, w, H - 25, { seed: x0 });
    band(ctx, x0, 24, w);
    arcade(ctx, x0 + 6, x0 + w - 2, 31, 11);
    band(ctx, x0, 45, w);
    arcade(ctx, x0 + 6, x0 + w - 2, 51, 18);
  }
  wall(ctx, 44, 10, 40, H - 11, { shadeFrom: 0.85, seed: 9 });
  for (let i = 0; i < 9; i++) px(ctx, 64 - 18 + i * 2, 10 - i, S.lit, 36 - i * 4, 1); // the pediment
  px(ctx, 47, 10, S.course, 34, 1);
  band(ctx, 44, 18, 40);
  arch(ctx, 52, 23, 7, 10, 'night'); arch(ctx, 69, 23, 7, 10, 'night');
  hang(ctx, 61, 22);
  gate(ctx, 64, 42, H - 1, 22);
  for (const x of [44, 83]) px(ctx, x, 10, S.course, 1, H - 11);
  banner(ctx, 63, -1 + 2, 8);
  for (const bx of [8, 30, 94, 116]) banner(ctx, bx, 14);
  brazier(ctx, 40, H - 2); brazier(ctx, 85, H - 2);
  outline(c, 'ink');
  return c;
}

// D: the old arena in Highmeadow as it stands now: the straight facade with
// its top broken away on the east side, moss in the joints, rubble at its foot
export function optRuined() {
  const c = optStraight(), ctx = c.getContext('2d');
  // break the top away: a jagged line descending east of the middle
  for (let x = 74; x < 128; x++) {
    const cut = 12 + Math.round((x - 74) * 0.32 + hash(x, 3, 7) * 5);
    ctx.clearRect(x, 0, 1, cut);
    if (cut < 75) px(ctx, x, cut, S.shade);
  }
  for (let i = 0; i < 40; i++) { const x = 4 + Math.floor(hash(i, 1, 5) * 120), y = 20 + Math.floor(hash(i, 2, 5) * 50); if (c.getContext('2d').getImageData(x, y, 1, 1).data[3]) px(ctx, x, y, hash(i, 3, 5) < 0.5 ? 'moss' : 'mossL'); }
  for (const [x, w] of [[96, 6], [104, 4], [112, 7], [20, 4]]) { px(ctx, x, 72, S.shade, w, 3); px(ctx, x + 1, 71, S.mid, w - 2, 1); }
  outline(c, 'ink');
  return c;
}

// ---- with a hint of depth, the way the castle facade does it: the far side
// of the arena rising behind the front wall (smaller, darker: further off),
// never a view down into it; round ends shaded as cylinders; a lit walkway.
const FAR = { lit: 'dirtL', mid: 'dirt', shade: 'dirtD', course: 'mudD' };
// the far wall's upper storey seen over the front: its inner arcade in shadow, masts on top
function farWall(ctx, x0, w, top, h) {
  for (let y = top; y < top + h; y++) for (let x = x0; x < x0 + w; x++) {
    const r = y - top, joint = r % 6 === 5 || ((x + Math.floor(r / 6) * 5) % 10 === 0 && r % 6 !== 0);
    px(ctx, x, y, joint ? FAR.course : (x - x0) / w > 0.75 ? FAR.shade : FAR.mid);
  }
  px(ctx, x0, top, FAR.lit, w, 1); px(ctx, x0, top + 1, FAR.course, w, 1);
  for (let ax = x0 + 5; ax + 5 <= x0 + w - 3; ax += 9) for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) if ((x - 2) ** 2 + Math.max(0, 2 - y) ** 2 <= 6) px(ctx, ax + x, top + 4 + y, 'night');
  for (let mx = x0 + 6; mx < x0 + w - 4; mx += 18) { px(ctx, mx, top - 7, 'woodD', 1, 7); px(ctx, mx + 1, top - 6, 'redD', 3, 3); } // the awning masts
}
// a round stair tower: shaded across like a cylinder, lit from the top left
function tower(ctx, x0, w, top, bottom) {
  const tone = (f) => (f < 0.15 ? S.mid : f < 0.45 ? S.lit : f < 0.75 ? S.mid : f < 0.92 ? S.shade : S.course);
  for (let y = top; y < bottom; y++) for (let x = x0; x < x0 + w; x++) {
    const f = (x - x0 + 0.5) / w, r = y - top;
    px(ctx, x, y, r % 6 === 5 ? S.course : tone(f));
  }
  for (let x = x0; x < x0 + w; x++) { const f = (x - x0 + 0.5) / w; px(ctx, x, top - 2, f < 0.6 ? S.top : S.mid); px(ctx, x, top - 1, S.mid); } // its lit top
  for (let y = top + 8; y < bottom - 10; y += 14) for (let yy = 0; yy < 6; yy++) px(ctx, x0 + Math.floor(w / 2) - 1, y + yy, 'night', 2, 1); // slit windows
}
// the front face again, with a lit walkway along its top
function walkway(ctx, x0, w, y) { px(ctx, x0, y - 2, S.top, w, 1); px(ctx, x0, y - 1, S.mid, w, 1); }
function compose(front, { far = true, towers = false, H = 92, frontY = 14, farInset = 14, walks = [[3, 122, 12]] } = {}) {
  const f = front(), W = 128 + (towers ? 8 : 0), [c, ctx] = makeCanvas(W, H), ox = towers ? 4 : 0;
  if (far) farWall(ctx, ox + farInset, f.width - farInset * 2, 7, 22);
  ctx.drawImage(f, ox, frontY);
  for (const [x, w, y] of walks) walkway(ctx, ox + x, w, frontY + y);
  if (towers) { tower(ctx, 0, 16, frontY + 6, H - 1); tower(ctx, W - 16, 16, frontY + 6, H - 1); banner(ctx, 7, frontY - 6, 10); banner(ctx, W - 9, frontY - 6, 10); }
  outline(c, 'ink');
  return c;
}
export const optDepthStraight = () => compose(optStraight);
export const optDepthCurved = () => compose(optCurvedEnds, { walks: [[13, 102, 12], [3, 9, 18], [117, 9, 18]] });
export const optDepthGatehouse = () => compose(optGatehouse, { H: 96, frontY: 16, farInset: 20, walks: [[3, 41, 24], [84, 41, 24]] });
export const optDepthTowers = () => compose(optStraight, { towers: true });

// ---- built the way Keep Defense's keep is: a ring of wall on a shallow
// oval, drawn column by column. The back half shows its inner face (here the
// stands: tiers of seats and the crowd, a colonnade along the top) standing
// up behind; the front half its outer face (the arcades) nearest, nearly
// straight, turning back only at the ends. Big irregular blocks, lit from the
// top left. The gate is a taller block on the front, flanked by round towers
// in one variant.
const SAND = ['dirtD', 'dirt', 'dirtL', 'sand', 'bone'];
const pick = (tones, l, x, y) => tones[Math.max(0, Math.min(tones.length - 1, Math.floor(l * tones.length + (bayer(x, y) - 0.5) * 0.5)))];
// big irregular blocks: 4px courses, each row's blocks a different width and offset
function block(x, y, top, seed) {
  const row = Math.floor((y - top) / 4), off = Math.floor(hash(row, 1, seed) * 9), bw = 7 + Math.floor(hash(row, 2, seed) * 4);
  const k = Math.floor((x + off) / bw);
  return { joint: (x + off) % bw === 0 || (y - top) % 4 === 3, tone: (hash(k, row, seed + 5) - 0.5) * 0.22 };
}
export function optRing({ W = 136, H = 84, RX = 62, RY = 17, WH = 32, WB = 30, gateTowers = false, towers = false, seated = false, archStep = 9, frontBanners = true, seatStep = 13 } = {}) {
  const [c, ctx] = makeCanvas(W, H), CX = W / 2, ECY = H - 2 - RY;
  const at = (deg) => { const a = (deg * Math.PI) / 180; return [CX + Math.cos(a) * RX, ECY + Math.sin(a) * RY]; };
  const run = (a0, a1, col) => { let last = null; for (let a = a0; a <= a1; a += 0.2) { const [x, y] = at(a), ix = Math.round(x); if (ix === last) continue; last = ix; col(ix, Math.round(y), a); } };
  // the back half: the stands' inner face, seats stepping up to a colonnade
  run(180, 360, (x, gy, a) => {
    const top = gy - WB, light = 0.5 - (x - CX) / RX * 0.12;
    for (let y = top; y <= gy; y++) {
      const r = y - top;
      if (seated && r >= 7) { // benches sized for people: a 2px lit seat, then an 8px riser in shadow
        const k = (r - 7) % 10;
        px(ctx, x, y, pick(SAND, k < 2 ? light + 0.22 - k * 0.1 : light - 0.2 - (k > 7 ? 0.08 : 0), x, y));
        continue;
      }
      if (r < 7) { // the colonnade along the top: pillars and dark openings
        const open = r > 1 && r < 6 && Math.floor((x + 1) / 3) % 2 === 0;
        px(ctx, x, y, open ? 'night' : pick(SAND, r === 0 ? light + 0.25 : light, x, y));
        continue;
      }
      const tier = Math.floor((r - 7) / 3), step = (r - 7) % 3; // rows of seats: a lit tread, a shadowed riser
      const crowd = step === 1 && hash(x, tier, 31) < 0.45;
      px(ctx, x, y, crowd ? ['redL', 'blueL', 'goldL', 'bone', 'skin', 'grassL'][Math.floor(hash(x, tier, 32) * 6)] : pick(SAND, step === 0 ? light + 0.12 : light - 0.18, x, y));
    }
    if (Math.round(a) % 30 === 0) { px(ctx, x, top - 7, 'woodD', 1, 7); px(ctx, x + 1, top - 6, 'red', 3, 3); } // awning masts on the far rim
  });
  // the arena floor, where any shows between the stands and the front wall
  for (let y = Math.floor(ECY - RY); y <= ECY + RY; y++) for (let x = Math.floor(CX - RX); x <= CX + RX; x++) {
    if (((x - CX) / RX) ** 2 + ((y - ECY) / RY) ** 2 > 0.9) continue;
    px(ctx, x, y, hash(x, y, 4) < 0.15 ? 'dirtL' : 'sand');
  }
  // townsfolk in the seats, facing the middle: two rows on the far side, the
  // ones near the ends turned side-on. Each shows head and shoulders above
  // the bench in front of them (in the game: real sprites, cropped, between
  // a back layer and a front layer, so they can cheer)
  if (seated) {
    const tex = window.__game.textures, ids = ['tam', 'ada', 'piet', 'hobb', 'oswin', 'quill', 'greta', 'wick', 'orla', 'iren', 'margo', 'brisk', 'rowan', 'fennel', 'hew', 'tansy', 'tolly', 'coal', 'dusty', 'brew', 'inka', 'hale', 'oda', 'bess', 'wynn', 'hilde'];
    let n = 0;
    for (const [tier, offset] of [[0, 0], [1, 6.5]]) {
      for (let a = 196 + offset * seatStep / 13; a <= 344; a += seatStep) {
        if (hash(Math.round(a), tier, 77) < 0.22) continue; // an empty seat here and there
        const [x, gy] = at(a), ix = Math.round(x), top = Math.round(gy) - WB, ledge = top + 18 + tier * 10;
        const id = ids[Math.floor(hash(Math.round(a), tier, 78) * ids.length)], side = a < 222 || a > 318;
        const f = tex.get(id).get(side ? 'idle_side_0' : 'idle_down_0');
        ctx.save();
        if (side && a > 270) { ctx.translate(ix * 2, 0); ctx.scale(-1, 1); } // the right end faces left
        ctx.drawImage(f.source.image, f.cutX + 16, f.cutY + 14, 16, 11, ix - 8, ledge - 11, 16, 11);
        ctx.restore();
        n++;
      }
    }
  }
  // the front half: the outer face, two arcades, a cornice and a lit walk on top
  const inArch = (a, step, r0, r1, gy, y) => { // is (column at angle a, row y) inside an arch of this arcade?
    const u = (((a % step) + step) % step) / step - 0.5, half = 0.24;
    if (Math.abs(u) > half) return false;
    const archTop = gy - r1 + Math.round((1 - Math.sqrt(1 - (u / half) ** 2)) * 3);
    return y >= archTop && y <= gy - r0;
  };
  run(0, 180, (x, gy, a) => {
    const top = gy - WH, light = 0.62 - (x - CX) / RX * 0.16 - Math.abs(Math.cos((a * Math.PI) / 180)) * 0.12; // darker where it turns away
    for (let y = top; y <= gy; y++) {
      const r = gy - y, b = block(x, y, top, 3);
      let l = light + b.tone - (b.joint ? 0.28 : 0) - (r < 2 ? 0.15 : 0);
      if (y === top) l = light + 0.35; // the walk's lit edge
      else if (y === top + 1 || r === Math.round(WH * 0.5)) l = light + 0.12; // cornices
      else if (y === top + 2 || r === Math.round(WH * 0.5) - 1) l = light - 0.3;
      if (inArch(a + archStep * 0.45, archStep, 2, Math.round(WH * 0.4), gy, y)) { px(ctx, x, y, y - (gy - 13) < 2 ? 'night' : 'ink'); continue; }
      if (inArch(a, archStep, Math.round(WH * 0.58), Math.round(WH * 0.84), gy, y)) { px(ctx, x, y, 'night'); continue; }
      px(ctx, x, y, pick(SAND, l, x, y));
    }
  });
  // the gate: a taller block in the middle of the front, its arch with the portcullis raised
  const gx = Math.round(CX), gy = H - 2, gw = 26, gTop = gy - WH - (seated ? 6 : 10);
  for (let y = gTop; y <= gy; y++) for (let x = gx - gw / 2; x < gx + gw / 2; x++) {
    const b = block(x, y, gTop, 8), f = (x - (gx - gw / 2)) / gw;
    let l = 0.66 - f * 0.22 + b.tone - (b.joint ? 0.28 : 0);
    if (y === gTop) l = 0.95; else if (y === gTop + 1) l = 0.75; else if (y === gTop + 2) l = 0.3;
    px(ctx, x, y, pick(SAND, l, x, y));
  }
  for (let i = 0; i < 6; i++) px(ctx, gx - 12 + i * 2, gTop - 1 - i, 'sand', 24 - i * 4, 1); // a low pediment
  arch(ctx, gx - 9, gy - 22, 18, 22);
  for (let x = 0; x < 18; x += 3) px(ctx, gx - 9 + x, gy - 19, 'steelD', 1, 4);
  px(ctx, gx - 8, gy - 16, 'steel', 16, 1);
  hang(ctx, gx - 3, gTop + 5);
  if (gateTowers) for (const tx of [gx - gw / 2 - 5, gx + gw / 2 + 5]) roundTower(ctx, tx, gy - WH - 14, gy, 6);
  if (towers) for (const deg of [20, 160]) { const [tx, ty] = at(deg); roundTower(ctx, tx, ty - WH - 10, ty, 7); }
  if (frontBanners) for (const deg of [35, 62, 118, 145]) { const [bx, by] = at(deg); banner(ctx, Math.round(bx), Math.round(by) - WH - 11); }
  brazier(ctx, gx - 17, gy); brazier(ctx, gx + 13, gy);
  outline(c, 'ink');
  return c;
}
// a round tower, shaded like a cylinder with a flat lit top
function roundTower(ctx, cx, top, bottom, r) {
  const ry = r * 0.4;
  for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const u = (x + 0.5 - cx) / r;
    if (Math.abs(u) > 1) continue;
    const bow = Math.sqrt(1 - u * u) * ry, light = 0.62 - u * 0.4 - Math.abs(u) * 0.15;
    for (let y = Math.round(top + bow); y <= Math.round(bottom + bow); y++) { const b = block(Math.round(Math.asin(u) * r * 1.3), y, top, 11); px(ctx, x, y, pick(SAND, light + b.tone - (b.joint ? 0.28 : 0), x, y)); }
    for (let y = Math.round(top - bow); y < Math.round(top + bow); y++) px(ctx, x, y, pick(SAND, 0.8 - u * 0.2, x, y)); // the top
  }
  px(ctx, Math.round(cx) - 1, Math.round(top + 8), 'ink', 1, 3);
  banner(ctx, Math.round(cx), Math.round(top - 10), 10);
}
export const optRingPlain = () => optRing();
export const optRingGateTowers = () => optRing({ gateTowers: true });
export const optRingTowers = () => optRing({ towers: true });
export const optRingDeeper = () => optRing({ RY: 24, H: 92, WB: 32 });
const SEATED = { W: 176, RX: 82, WH: 26, WB: 38, seated: true, archStep: 7, frontBanners: false, seatStep: 9.5 };
export const optSeated = () => optRing({ ...SEATED, RY: 12, H: 90 });
export const optSeatedShallowest = () => optRing({ ...SEATED, RY: 9, H: 86 });
export const optSeatedTowers = () => optRing({ ...SEATED, RY: 12, H: 90, towers: true });

// The sheet: the options at 3x with labels, the current drum and the party beside them.
export async function sheet(depth = false) {
  const tex = window.__game.textures;
  const frame = (k, f) => { const t = tex.get(k), fr = f ? t.get(f) : t.get(); return { src: fr.source.image, x: fr.cutX, y: fr.cutY, w: fr.cutWidth, h: fr.cutHeight }; };
  const cv = (c) => ({ src: c, x: 0, y: 0, w: c.width, h: c.height });
  const rows = depth === 'seated' ? [
    [['M. SHALLOWER, TOWNSFOLK SEATED', cv(optSeated())], ['N. SHALLOWEST, TOWNSFOLK', cv(optSeatedShallowest())]],
    [['O. SHALLOWER + END TOWERS', cv(optSeatedTowers())], ['I. BEFORE (PAINTED CROWD)', cv(optRingPlain())]],
    [['THE PARTY', null]],
  ] : depth === 'ring' ? [
    [['I. RING (THE KEEP\'S WAY)', cv(optRingPlain())], ['J. RING + GATE TOWERS', cv(optRingGateTowers())]],
    [['K. RING + END TOWERS', cv(optRingTowers())], ['L. RING, DEEPER OVAL', cv(optRingDeeper())]],
    [['NOW: DRUM', cv(colosseum())], ['THE PARTY', null]],
  ] : depth ? [
    [['E. STRAIGHT + FAR SIDE', cv(optDepthStraight())], ['F. CURVED + FAR SIDE', cv(optDepthCurved())]],
    [['G. GATEHOUSE + FAR SIDE', cv(optDepthGatehouse())], ['H. ROUND TOWERS + FAR SIDE', cv(optDepthTowers())]],
    [['A. STRAIGHT (FLAT)', cv(optStraight())], ['THE PARTY', null]],
  ] : [
    [['A. STRAIGHT', cv(optStraight())], ['B. CURVED ENDS', cv(optCurvedEnds())]],
    [['C. GATEHOUSE', cv(optGatehouse())], ['D. RUINED', cv(optRuined())]],
    [['NOW: DRUM', cv(colosseum())], ['THE PARTY', null]],
  ];
  const k = 3, pad = 16, colW = (depth === 'seated' ? 180 : 136) * k + pad * 2, rowH = 98 * k + 28;
  const out = document.createElement('canvas'); out.width = colW * 2; out.height = rowH * rows.length;
  const g = out.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#4a8a4a'; g.fillRect(0, 0, out.width, out.height);
  rows.forEach((row, r) => row.forEach(([label, it], col) => {
    const ox = col * colW + pad, oy = r * rowH;
    g.fillStyle = '#1a1423'; g.fillRect(ox - 4, oy + 4, label.length * 9 + 10, 18); g.fillStyle = '#fff0a0'; g.font = 'bold 14px monospace'; g.fillText(label, ox, oy + 18);
    const draw = (i, x, by) => g.drawImage(i.src, i.x, i.y, i.w, i.h, x, by - i.h * k, i.w * k, i.h * k);
    if (it) draw(it, ox, oy + rowH - 8);
    else ['brann', 'pip', 'sable'].forEach((id, i) => draw(frame(id, 'idle_down_0'), ox + 20 + i * 70, oy + rowH - 8));
  }));
  await fetch(`/__snap?name=colosseum-options${typeof depth === 'string' ? `-${depth}` : depth ? '-depth' : ''}.png`, { method: 'POST', body: out.toDataURL() });
  return { w: out.width, h: out.height };
}
