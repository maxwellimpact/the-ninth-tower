// The opening scene: Brightwater, painted by the game's terrain painter in a
// worker, with its real props and cottages, and the party walking a loop
// through the village on paths found by the game's own pathfinder.
import { makeScene, drawSorted, walker } from '../lib/scene.js';
import { navGrid } from '../lib/world.js';
import { pixelCanvas, heroFrames } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const AREA = { x0: 0, y0: 16 * 16, w: 44 * 16, h: 34 * 16 }; // tiles 0-43 x 16-49
const LOOP = [[13, 37], [21, 33], [29, 31], [31, 38], [24, 41], [17, 46], [8, 40], [6, 35]]; // round the village (tiles)

// While the worker builds the world (a few seconds), the party waits in a
// pool of lantern light, with an honest note of what's happening.
function waiting(stage) {
  const [c, ctx] = pixelCanvas(160, 90, 1, 'hero-wait');
  stage.appendChild(c);
  const party = ['sable', 'brann', 'pip'].map((id, i) => ({ fr: heroFrames(id).idle.down, x: 56 + i * 24, t: i * 0.3 }));
  const t0 = performance.now();
  const note = document.createElement('p');
  note.className = 'hero-note';
  stage.appendChild(note);
  const fit = () => { const r = stage.getBoundingClientRect(); const s = Math.max(2, Math.floor(Math.min(r.width / 160, r.height / 90))); c.style.width = `${160 * s}px`; c.style.height = `${90 * s}px`; };
  fit(); addEventListener('resize', fit);
  const stop = animate(stage, (dt) => {
    ctx.clearRect(0, 0, 160, 90);
    const g = ctx.createRadialGradient(80, 40, 2, 80, 40, 60); g.addColorStop(0, 'rgba(242,193,78,0.16)'); g.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 90);
    for (const h of party) { h.t += dt; const f = h.fr[Math.floor(h.t * 2.5) % h.fr.length]; ctx.drawImage(f, h.x - 24, 50 - 36); }
    note.textContent = `Building the world in a worker · ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  });
  return () => { stop(); removeEventListener('resize', fit); c.style.transition = note.style.transition = 'opacity 0.6s'; c.style.opacity = note.style.opacity = '0'; setTimeout(() => { c.remove(); note.remove(); }, 700); };
}

export async function mountHero(stage) {
  const done = waiting(stage);
  const scene = await makeScene(AREA.x0, AREA.y0, AREA.w, AREA.h);
  done();
  const nav = await navGrid();
  // the route: A* between each pair of waypoints, joined into one loop
  const route = [];
  for (let i = 0; i < LOOP.length; i++) {
    const [ax, ay] = nav.nearestOpen(...LOOP[i]), [bx, by] = nav.nearestOpen(...LOOP[(i + 1) % LOOP.length]);
    const seg = nav.find(ax * 16 + 8, ay * 16 + 8, bx * 16 + 8, by * 16 + 8, 20000) || [{ x: bx * 16 + 8, y: by * 16 + 8 }];
    route.push(...seg.map((p) => ({ x: p.x - AREA.x0, y: p.y - AREA.y0 })));
  }
  const start = route[route.length - 1];
  const party = ['brann', 'pip', 'sable'].map((id) => walker(id, start.x, start.y));
  const trail = [{ x: start.x, y: start.y }];
  let wp = 0;

  let canvas, ctx, vw, vh, cam = { x: start.x, y: start.y };
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const s = Math.max(2, Math.min(4, Math.round(r.height / 290)));
    vw = Math.ceil(r.width / s); vh = Math.ceil(r.height / s);
    canvas?.remove();
    [canvas, ctx] = pixelCanvas(vw, vh, s, 'hero-scene');
    stage.appendChild(canvas);
  };
  fit();
  addEventListener('resize', fit);

  const SPEED = 34; // px/s: the game's walk at its 0.72 speed
  animate(stage, (dt, t) => {
    const L = party[0];
    const goal = route[wp];
    const dx = goal.x - L.x, dy = goal.y - L.y, d = Math.hypot(dx, dy);
    if (d < 1.5) wp = (wp + 1) % route.length;
    else { L.x += (dx / d) * SPEED * dt; L.y += (dy / d) * SPEED * dt; L.face(dx, dy); }
    L.moving = true;
    // the others walk the leader's footsteps, a body length apart
    const last = trail[trail.length - 1];
    if (Math.hypot(L.x - last.x, L.y - last.y) > 1) { trail.push({ x: L.x, y: L.y }); if (trail.length > 200) trail.shift(); }
    party.slice(1).forEach((h, i) => {
      const p = trail[Math.max(0, trail.length - 1 - (i + 1) * 15)];
      const mx = p.x - h.x, my = p.y - h.y;
      h.moving = Math.hypot(mx, my) > 0.3;
      if (h.moving) h.face(mx, my);
      h.x = p.x; h.y = p.y;
    });
    for (const h of party) h.t += dt;
    // camera eases after the leader, kept inside the painted area
    cam.x += (L.x - cam.x) * Math.min(1, dt * 2); cam.y += (L.y - cam.y) * Math.min(1, dt * 2);
    // wide screens: the party walks to the right of the title; narrow: above it
    const wide = canvas.clientWidth > 900;
    const ox = Math.round(Math.max(0, Math.min(AREA.w - vw, cam.x - vw * (wide ? 0.68 : 0.5))));
    const oy = Math.round(Math.max(0, Math.min(AREA.h - vh, cam.y - vh * (wide ? 0.42 : 0.26))));
    ctx.fillStyle = '#16121f'; ctx.fillRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(-ox, -oy);
    ctx.drawImage(scene.bg, 0, 0);
    drawSorted(ctx, scene, party, t);
    ctx.restore();
  });
}
