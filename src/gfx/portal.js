// The Ferryman's portal: a standing oval of swirling violet light, and the
// little spinning portal sign that floats over his head (in place of the
// townsfolk's "!" bubble) so he stands out at a campfire.
import { makeCanvas, px, outline } from './pixel.js';

// 8 frames, 24x32: the swirl turns a step each frame
export function portal() {
  const W = 24, H = 32, cx = 11.5, cy = 15.5, a = 9.5, b = 14;
  return [0, 1, 2, 3, 4, 5, 6, 7].map((f) => {
    const [c, ctx] = makeCanvas(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - cx) / a, ny = (y - cy) / b, r = Math.hypot(nx, ny);
      if (r > 1) continue;
      if (r > 0.86) { px(ctx, x, y, (x + y + f) % 4 === 0 ? 'crystalL' : 'purpL'); continue; } // the bright rim, its sparkle walking round
      // two spiral arms winding into a dark heart
      const ang = Math.atan2(ny, nx), s = (ang / (Math.PI * 2) * 2 + r * 2.2 - f / 8 + 4) % 1;
      const col = r < 0.22 ? 'night' : s < 0.18 ? 'crystalL' : s < 0.42 ? 'purpL' : s < 0.7 ? 'purp' : 'purpD';
      px(ctx, x, y, col);
    }
    outline(c, 'ink');
    return c;
  });
}

// 6 frames, 11x13: a small ring with a light running round it, on a stem (like the "!" sign)
export function portalMark() {
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const [c, ctx] = makeCanvas(11, 13);
    const cx = 5, cy = 5;
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > 4.6) continue;
      if (r > 3.2) { const ang = (Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 1) % 1, k = (ang * 6 - f + 6) % 6; px(ctx, x, y, k < 1.2 ? 'white' : k < 2.4 ? 'crystalL' : 'purpL'); }
      else px(ctx, x, y, r < 1.3 ? 'night' : 'purp');
    }
    px(ctx, 5, 10, 'purpL'); px(ctx, 5, 11, 'purpL');
    outline(c, 'ink');
    return c;
  });
}
