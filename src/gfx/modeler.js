// The creature modeler (Keep Defense's ART_GUIDE.md, section 5): a creature
// or a big boss is defined once as 3D volumes, and every facing is rendered
// from that one model, so the views can't disagree about size, proportions or
// features. Model space: x across (the creature's left to right as it faces
// you), y forward (the way it faces), z up, in pixels; the ground is z = 0.
//
// A part is a sphere or ellipsoid { c: [x, y, z], r: [rx, ry, rz] | r, ramp,
// rim? } or a limb { a: [x, y, z], b: [x, y, z], r0, r1, ramp } (a chain of
// spheres tapering from r0 to r1); `id` groups parts that join seamlessly (no
// ink line between them, as where a leg grows out of the body); a line part
// { line: [[x, y, z], ...], color, w } is drawn thin and depth-tested (spear
// shafts, straps). For a facing, the model is turned about z (down: it faces
// you; side: it faces right; up: it faces away), projected with the camera
// `tilt` degrees above the ground (40, the world's camera, for creatures; the
// bosses' figures are drawn nearly flat-on, as the puppets are), rasterised with a depth buffer, shaded from
// each pixel's surface normal (light from the upper left of the screen, so a
// mirrored side view stays right), given a lit rim on top edges, then
// outlined: always round the silhouette, inside only where the depth jumps
// between different groups. `paint(ctx, P)` then adds pixel details, with
// P.at(x, y, z) giving a model point's screen position and whether it shows.
import { makeCanvas, px, bayer } from './pixel.js';
import { rgb } from './palette.js';

const LIGHT = (() => { const l = [-0.62, 0.38, 0.68], n = Math.hypot(...l); return l.map((v) => v / n); })(); // screen left, toward you, up

// turn a model point for a facing: down faces +y toward the viewer, side faces +x (right), up faces away
function turn([x, y, z], view) {
  if (view === 'side') return [y, -x, z];
  if (view === 'up') return [-x, -y, z];
  return [x, y, z];
}

export function renderModel(parts, view, { W = 64, H = 64, feet = 48, paint = null, outline = 'ink', tilt = 40 } = {}) {
  const [c, ctx] = makeCanvas(W, H);
  const CA = Math.cos((tilt * Math.PI) / 180), SA = Math.sin((tilt * Math.PI) / 180); // how far the camera looks down: characters are drawn nearly flat-on, like the puppets
  const cx = W / 2;
  const depth = new Float32Array(W * H).fill(-1e9), part = new Int16Array(W * H).fill(-1), group = new Int16Array(W * H).fill(-1);
  const color = new Array(W * H).fill(null);
  const groups = new Map(), gid = (p) => { const k = p.id ?? p; if (!groups.has(k)) groups.set(k, groups.size); return groups.get(k); };
  // screen position of a turned point, and its depth toward the camera
  const proj = ([x, y, z]) => [cx + x, feet + y * SA - z * CA, y * CA + z * SA];
  const spheres = [];
  parts.forEach((p, i) => {
    if (p.line) return;
    if (p.a) { // a limb: spheres along it
      const a = turn(p.a, view), b = turn(p.b, view), n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / Math.max(0.8, Math.min(p.r0, p.r1) * 0.6)));
      for (let k = 0; k <= n; k++) { const t = k / n, r = p.r0 + (p.r1 - p.r0) * t; spheres.push({ c: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], r: [r, r, r], p, i }); }
    } else {
      const r = typeof p.r === 'number' ? [p.r, p.r, p.r] : p.r, rr = view === 'side' ? [r[1], r[0], r[2]] : r;
      spheres.push({ c: turn(p.c, view), r: rr, p, i });
    }
  });
  for (const s of spheres) {
    const [sx, sy, sd] = proj(s.c), R = Math.max(...s.r) + 1;
    const [rx, ry, rz] = s.r;
    for (let Y = Math.floor(sy - R * 1.2); Y <= Math.ceil(sy + R * 1.2); Y++) for (let X = Math.floor(sx - R); X <= Math.ceil(sx + R); X++) {
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      // the ray through this pixel: model point = base + t * toward-camera, base on the depth-0 plane
      const u = X + 0.5 - cx, v = Y + 0.5 - feet; // screen offsets
      // a point with screen (u, v) and depth t: x = u, y = v*SA + t*CA, z = -v*CA + t*SA
      const ox = (u - s.c[0]) / rx, oy0 = (v * SA - s.c[1]) / ry, oz0 = (-v * CA - s.c[2]) / rz, dy = CA / ry, dz = SA / rz;
      const A = dy * dy + dz * dz, B = 2 * (oy0 * dy + oz0 * dz), Cq = ox * ox + oy0 * oy0 + oz0 * oz0 - 1, disc = B * B - 4 * A * Cq;
      if (disc < 0) continue;
      const t = (-B + Math.sqrt(disc)) / (2 * A); // the nearer hit
      const k = Y * W + X;
      if (t <= depth[k]) continue;
      // the surface normal there (in turned model space), then in camera terms for the light
      const nx = ox / rx, ny = (oy0 + dy * t) / ry, nz = (oz0 + dz * t) / rz, nl = Math.hypot(nx, ny, nz) || 1;
      const lit = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl;
      depth[k] = t; part[k] = s.i; group[k] = gid(s.p);
      const ramp = s.p.ramp, l = 0.42 + (lit - 0.5) * 0.85 + (s.p.bias || 0); // a surface square to the camera comes out a little above the middle of its ramp
      color[k] = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length + (bayer(X, Y) - 0.5) * 0.35)))];
    }
  }
  // thin parts: depth-tested lines
  for (const p of parts) {
    if (!p.line) continue;
    const pts = p.line.map((q) => proj(turn(q, view)));
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0, d0] = pts[i], [x1, y1, d1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let j = 0; j <= n; j++) {
        const t = j / n, X = Math.round(x0 + (x1 - x0) * t - 0.5), Y = Math.round(y0 + (y1 - y0) * t - 0.5), d = d0 + (d1 - d0) * t;
        for (let w = 0; w < (p.w || 1); w++) {
          const k = Y * W + X + w;
          if (X + w < 0 || Y < 0 || X + w >= W || Y >= H || d <= depth[k] - 0.5) continue;
          depth[k] = d; group[k] = gid(p); part[k] = -2;
          color[k] = Array.isArray(p.color) ? p.color[w === 0 ? 0 : 1] ?? p.color[0] : p.color;
        }
      }
    }
  }
  // a lit rim along each group's top edge, a darker line under where a part sits over another
  for (let Y = 1; Y < H; Y++) for (let X = 0; X < W; X++) {
    const k = Y * W + X, up = k - W;
    if (!color[k] || part[k] < 0) continue;
    const p = parts[part[k]];
    if ((group[up] !== group[k]) && p.rim !== false && depth[k] > depth[up]) { const ramp = p.ramp, i = ramp.indexOf(color[k]); if (i >= 0 && i < ramp.length - 1) color[k] = ramp[i + 1]; }
  }
  for (let k = 0; k < W * H; k++) if (color[k]) px(ctx, k % W, Math.floor(k / W), color[k]);
  // ink: round the silhouette, and inside where one group stands in front of another
  const ink = rgb(outline);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const set = (k) => { d[k * 4] = ink[0]; d[k * 4 + 1] = ink[1]; d[k * 4 + 2] = ink[2]; d[k * 4 + 3] = 255; };
  const edge = [];
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const k = Y * W + X;
    const nbs = [X > 0 ? k - 1 : -1, X < W - 1 ? k + 1 : -1, Y > 0 ? k - W : -1, Y < H - 1 ? k + W : -1];
    if (!color[k]) { if (nbs.some((n) => n >= 0 && color[n])) edge.push(k); continue; }
    // this pixel is behind a neighbour of another group by a clear step: a line on the far side
    if (nbs.some((n) => n >= 0 && color[n] && group[n] !== group[k] && depth[n] > depth[k] + 2.5 && !parts[part[n]]?.soft && !parts[part[k]]?.soft)) edge.push(k);
  }
  for (const k of edge) set(k);
  ctx.putImageData(img, 0, 0);
  if (paint) {
    const at = (x, y, z) => { const q = turn([x, y, z], view), [X, Y, D] = proj(q), k = Math.floor(Y) * W + Math.floor(X); return { x: Math.floor(X), y: Math.floor(Y), show: k >= 0 && k < W * H && D >= depth[k] - 1.5, d: D }; };
    paint(ctx, { at, view, px: (x, y, col, w, h) => px(ctx, x, y, col, w, h) });
  }
  return c;
}
