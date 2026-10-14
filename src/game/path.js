// Grid pathfinding: 8-directional A* (no corner cutting) + string-pulling so
// tap-to-move paths look natural instead of zig-zagging tile to tile.
import { TILE } from '../world/map.js';

export class NavGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.solid = new Uint8Array(w * h);
  }
  block(tx, ty) { if (this.inb(tx, ty)) this.solid[ty * this.w + tx] = 1; }
  inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  isSolid(tx, ty) { return !this.inb(tx, ty) || this.solid[ty * this.w + tx] === 1; }
  solidAtPx(x, y) { return this.isSolid(Math.floor(x / TILE), Math.floor(y / TILE)); }

  // Is the straight line between two world points clear for a body of radius r?
  lineClear(x0, y0, x1, y1, r = 4) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 4);
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (this.solidAtPx(x - r, y - r) || this.solidAtPx(x + r, y - r) || this.solidAtPx(x - r, y + r) || this.solidAtPx(x + r, y + r)) return false;
    }
    return true;
  }

  // Nearest walkable tile to a (possibly solid) tile.
  nearestOpen(tx, ty, maxR = 6) {
    if (!this.isSolid(tx, ty)) return [tx, ty];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!this.isSolid(tx + dx, ty + dy)) {
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = [tx + dx, ty + dy]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Returns an array of world-space waypoints (excluding the start), or null.
  find(sx, sy, gx, gy, maxNodes = 5000) {
    if (this.lineClear(sx, sy, gx, gy)) return [{ x: gx, y: gy }];
    const W = this.w;
    let s = [Math.floor(sx / TILE), Math.floor(sy / TILE)];
    let g = [Math.floor(gx / TILE), Math.floor(gy / TILE)];
    s = this.nearestOpen(...s) || s;
    const gOpen = this.nearestOpen(...g);
    if (!gOpen) return null;
    const goalAdjusted = gOpen[0] !== g[0] || gOpen[1] !== g[1];
    g = gOpen;
    const start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gScore = new Float32Array(this.w * this.h).fill(Infinity);
    const came = new Int32Array(this.w * this.h).fill(-1);
    const closed = new Uint8Array(this.w * this.h);
    const heap = [];
    const h = (i) => {
      const dx = Math.abs((i % W) - g[0]), dy = Math.abs(Math.floor(i / W) - g[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    gScore[start] = 0;
    push(start, h(start));
    let expanded = 0;
    while (heap.length) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxNodes) return null;
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (this.isSolid(nx, ny)) continue;
        if (dx && dy && (this.isSolid(cx + dx, cy) || this.isSolid(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        const ng = gScore[cur] + (dx && dy ? 1.414 : 1);
        if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; push(ni, ng + h(ni)); }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    // reconstruct tile centres
    const pts = [];
    for (let i = goal; i !== -1 && i !== start; i = came[i]) pts.push({ x: (i % W) * TILE + TILE / 2, y: Math.floor(i / W) * TILE + TILE / 2 });
    pts.reverse();
    if (!goalAdjusted) pts.push({ x: gx, y: gy });
    // string-pull
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(ax, ay, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]);
      ax = pts[j].x; ay = pts[j].y;
      i = j + 1;
    }
    return out;
  }
}
