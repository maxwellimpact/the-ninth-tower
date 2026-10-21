// A patch of the real world, ready to draw: its painted terrain, and every
// prop, building and campfire standing in it (sorted by their feet, like the
// game's depth sort). Used by the opening scene and the pathfinding demo.
import W from '../../src/data/world.json';
import * as P from '../../src/gfx/props.js';
import { world, paintArea } from './world.js';
import { propSprite, heroFrames, mirrored } from './pixels.js';

const BUILD = {
  shop: () => P.house('shop'), tavern: () => P.house('tavern'), mill: () => P.mill(),
  curio: () => P.house('curio'), archery: () => P.house('archery'), bath: () => P.house('bath'), mayor: () => P.house('mayor'),
};
let fire = null;

export async function makeScene(x0, y0, w, h) {
  const [wd, bg] = await Promise.all([world(), paintArea(x0, y0, w, h)]);
  const items = []; // { img, x, y (feet, in area px), flat? }
  const inside = (px, py, m = 64) => px > x0 - m && px < x0 + w + m && py > y0 - 16 && py < y0 + h + 96;
  for (const p of wd.props) {
    const px = p.x * 16 + 8, py = p.y * 16 + 8;
    if (!inside(px, py)) continue;
    const s = propSprite(p);
    if (!s) continue;
    items.push(s.flat ? { img: s.img, x: px - x0, y: py - y0, flat: true } : { img: s.img, x: px - x0, y: py - y0 + s.dy });
  }
  for (const b of W.buildings) {
    if (!BUILD[b.kind]) continue;
    const bx = b.x * 16 + 8, by = (b.y + 1) * 16;
    if (!inside(bx, by, 160)) continue;
    items.push({ img: BUILD[b.kind](), x: bx - x0, y: by - y0, building: b });
  }
  fire ??= P.campfire();
  for (const c of W.campfires) {
    const cx = c.x * 16 + 8, cy = c.y * 16 + 8;
    if (inside(cx, cy)) items.push({ frames: fire, x: cx - x0, y: cy - y0 + 6, fire: true });
  }
  return { bg, items, x0, y0, w, h, world: wd };
}

// Draw the scene's sprites plus any extras (heroes), back to front.
export function drawSorted(ctx, scene, extras = [], t = 0) {
  for (const it of scene.items) if (it.flat) ctx.drawImage(it.img, Math.round(it.x - it.img.width / 2), Math.round(it.y - it.img.height / 2));
  const list = [...scene.items.filter((i) => !i.flat), ...extras].sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.draw) { it.draw(ctx); continue; }
    const img = it.frames ? it.frames[Math.floor(t * 8) % it.frames.length] : it.img;
    ctx.drawImage(img, Math.round(it.x - img.width / 2), Math.round(it.y - img.height));
  }
}

// A hero walking a path, drawn like the game's units: a soft shadow, the
// walk cycle at 9 fps, facing the way it moves (side frames mirrored for left).
export function walker(id, x, y) {
  const fr = heroFrames(id);
  return {
    id, x, y, vx: 0, vy: 0, view: 'down', flip: false, moving: false, t: Math.random(),
    face(dx, dy) { if (Math.abs(dx) > Math.abs(dy) * 1.1) { this.view = 'side'; this.flip = dx < 0; } else if (Math.abs(dy) > 0.01) { this.view = dy > 0 ? 'down' : 'up'; } },
    draw(ctx) {
      const anim = this.moving ? fr.walk[this.view] : fr.idle[this.view];
      const rate = this.moving ? 9 : 2.5;
      let img = anim[Math.floor(this.t * rate) % anim.length];
      if (this.view === 'side' && this.flip) img = mirrored(img);
      ctx.fillStyle = 'rgba(15, 10, 20, 0.28)';
      ctx.beginPath(); ctx.ellipse(Math.round(this.x), Math.round(this.y), 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(img, Math.round(this.x - 24), Math.round(this.y - 36));
    },
  };
}
