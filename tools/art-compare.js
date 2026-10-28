// Before/after sheets for key-object art (dev only). In a running dev game:
//   const A = await import('/tools/art-compare.js');
//   await A.save('tower', (P) => P.ninthTower())          // snapshots/art-tower-before.png: the art as it is now, at 3x beside Brann
//   await A.pair('tower', (P) => P.ninthTower())          // snapshots/art-tower.png: that before beside the art the code draws now
// `draw` gets src/gfx/props.js (or `{ mod }`: any module under src/) loaded
// fresh, and returns a canvas or an array of canvases (frames: the first is used).
// Take the before first, then change the art, reload and take the pair.
const S = 3;
const fresh = (mod) => import(`/src/${mod}?t=${Date.now()}`);

function render(canvas, { ground = '#3b3340', label = '', hero = true } = {}) {
  const sc = window.__scene, pad = 10, hf = hero && sc?.textures.exists('brann') ? sc.textures.getFrame('brann', 'idle_down_0') : null;
  const hw = hf ? hf.cutWidth + 6 : 0, w = canvas.width + hw + pad * 2, h = Math.max(canvas.height, 40) + pad * 2 + 8;
  const cv = document.createElement('canvas'); cv.width = w * S; cv.height = h * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = ground; g.fillRect(0, 0, cv.width, cv.height);
  const base = h - pad;
  g.drawImage(canvas, 0, 0, canvas.width, canvas.height, pad * S, (base - canvas.height) * S, canvas.width * S, canvas.height * S);
  if (hf) g.drawImage(hf.source.image, hf.cutX, hf.cutY, hf.cutWidth, hf.cutHeight, (pad + canvas.width + 4) * S, (base - hf.cutHeight) * S, hf.cutWidth * S, hf.cutHeight * S);
  if (label) { g.fillStyle = '#f2c14e'; g.font = `bold ${5 * S}px monospace`; g.textBaseline = 'top'; g.fillText(label, 4 * S, 2 * S); }
  return cv;
}
const post = (name, cv) => fetch(`/__snap?name=${name}`, { method: 'POST', body: cv.toDataURL('image/png') });
async function art(draw, mod) { const r = await draw(await fresh(mod)); return Array.isArray(r) ? r[0] : r; }

export async function save(name, draw, { mod = 'gfx/props.js', ground } = {}) {
  const cv = render(await art(draw, mod), { ground, label: 'BEFORE' });
  await post(`art-${name}-before.png`, cv);
  return { w: cv.width, h: cv.height };
}

export async function pair(name, draw, { mod = 'gfx/props.js', ground } = {}) {
  const before = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `/snapshots/art-${name}-before.png?t=${Date.now()}`; });
  const after = render(await art(draw, mod), { ground, label: 'AFTER' });
  const gap = 8 * S, cv = document.createElement('canvas');
  cv.width = before.width + gap + after.width; cv.height = Math.max(before.height, after.height);
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#16121f'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(before, 0, cv.height - before.height); g.drawImage(after, before.width + gap, cv.height - after.height);
  await post(`art-${name}.png`, cv);
  return { w: cv.width, h: cv.height };
}

// The cast at a glance: each kind's idle frame at its in-game size and tint
// (spawned out of the way to read them, then removed), side by side at 3x
// with Brann first for scale; saved as snapshots/art-<name>.png.
//   await A.cast('bosses', ['golem', 'snagtooth', 'murk', 'mab', 'huntsman', 'drake', 'vulk', 'troll', 'isolde', 'malgrim'])
export async function cast(name, kinds, { ground = '#5c7a4f', cols = 6 } = {}) {
  const sc = window.__scene, L = sc.leader;
  const cells = [{ label: 'BRANN', frame: sc.textures.getFrame(L.sprite.texture.key, L.sprite.frame.name), scale: 1, tint: null }];
  for (const k of kinds) {
    const e = sc.spawnEnemy(k, L.x + 4000, L.y, false);
    const sp = e.sprite;
    cells.push({ label: k.toUpperCase(), frame: sc.textures.getFrame(sp.texture.key, sp.frame.name), scale: sp.scaleX, tint: sp.isTinted ? sp.tintTopLeft : null, alpha: sp.alpha });
    e.alive = false; e.destroy();
  }
  const cw = Math.max(...cells.map((c) => c.frame.cutWidth * c.scale)) + 12, ch = Math.max(...cells.map((c) => c.frame.cutHeight * c.scale)) + 16;
  const rows = Math.ceil(cells.length / cols), cv = document.createElement('canvas');
  cv.width = Math.min(cells.length, cols) * cw * S; cv.height = rows * ch * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = ground; g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${4 * S}px monospace`; g.textBaseline = 'top';
  cells.forEach((c, i) => {
    const f = c.frame, w = f.cutWidth * c.scale, h = f.cutHeight * c.scale, x0 = (i % cols) * cw + (cw - w) / 2, y0 = Math.floor(i / cols) * ch + ch - 8 - h;
    const tmp = document.createElement('canvas'); tmp.width = f.cutWidth; tmp.height = f.cutHeight;
    const tg = tmp.getContext('2d'); tg.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
    if (c.tint != null && c.tint !== 0xffffff) { tg.globalCompositeOperation = 'multiply'; tg.fillStyle = `#${c.tint.toString(16).padStart(6, '0')}`; tg.fillRect(0, 0, tmp.width, tmp.height); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight); }
    g.globalAlpha = c.alpha ?? 1; g.drawImage(tmp, 0, 0, tmp.width, tmp.height, x0 * S, y0 * S, w * S, h * S); g.globalAlpha = 1;
    g.fillStyle = '#16121f'; g.fillText(c.label, ((i % cols) * cw + 3) * S, (Math.floor(i / cols) * ch + ch - 7) * S);
  });
  await post(`art-${name}.png`, cv);
  return { w: cv.width, h: cv.height };
}

// A boss's turnaround: for each builder in gfx/bosses.js (puppet-shaped
// frames), rows of down, side and up through idle, walk, the attack, the cast and hurt,
// at 3x with Brann for scale; saved as snapshots/art-<name>.png. Returns each
// builder's build time.
//   await A.turnaround('gobboss', ['buildSnagtooth', 'buildGutcrusher'])
export async function turnaround(name, builders, { mod = 'gfx/bosses.js', ground = '#5c7a4f' } = {}) {
  const B = await fresh(mod), rows = [], ms = {};
  for (const b of builders) {
    const t0 = performance.now(), f0 = B[b](); ms[b] = Math.round(performance.now() - t0);
    const f = f0.down ? Object.fromEntries(Object.keys(f0.down).map((a) => [a, { down: f0.down[a], side: f0.side[a], up: f0.up[a] }])) : f0; // a creature's frames come by view
    const hit = f.attack || f.slam, extra = f.cast || f.fly || f.windup;
    for (const v of ['down', 'side', 'up']) rows.push([f.idle[v][0], f.walk[v][1], f.walk[v][3], (f.windup || f.attack)[v][f.windup ? 1 : 0], hit[v][f.windup ? 0 : 1], extra[v][extra[v].length > 1 ? 1 : 0], f.hurt[v][0]]);
  }
  const cell = Math.max(...rows.flat().map((c) => c.width)) + 2, rh = Math.max(...rows.flat().map((c) => c.height)) + 2;
  const hf = window.__scene?.textures.getFrame('brann', 'idle_down_0'), cv = document.createElement('canvas');
  cv.width = (7 * cell + 30) * S; cv.height = rows.length * rh * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = ground; g.fillRect(0, 0, cv.width, cv.height);
  rows.forEach((row, r) => {
    row.forEach((x, i) => g.drawImage(x, 0, 0, x.width, x.height, (i * cell + (cell - x.width) / 2) * S, (r * rh + rh - 2 - x.height) * S, x.width * S, x.height * S));
    if (hf) g.drawImage(hf.source.image, hf.cutX, hf.cutY, hf.cutWidth, hf.cutHeight, 7 * cell * S, (r * rh + rh - 2 - row[0].height * 0.25 - 36) * S, hf.cutWidth * S, hf.cutHeight * S);
  });
  await post(`art-${name}.png`, cv);
  return ms;
}
