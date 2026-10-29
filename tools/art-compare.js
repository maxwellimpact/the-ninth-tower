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

// A boss's turnaround: for each builder in gfx/bigcast.js (puppet-shaped
// frames), rows of down, side and up through idle, walk, the attack, the cast and hurt,
// at 3x with Brann for scale; saved as snapshots/art-<name>.png. Returns each
// builder's build time.
//   await A.turnaround('gobboss', ['buildSnagtooth', 'buildGutcrusher'])
export async function turnaround(name, builders, { mod = 'gfx/bigcast.js', ground = '#5c7a4f' } = {}) {
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

// Close-ups: canvases side by side at `S`x, saved as snapshots/<name>.png.
//   const N = await import('/src/gfx/bigcast.js'); const f = N.buildSnagtooth();
//   await A.zoom('snag-zoom', [f.idle.down[0], f.idle.side[0], f.idle.up[0]], 6)
export async function zoom(name, canvases, S = 6, ground = '#5c7a4f') {
  const w = canvases.reduce((a, c) => a + c.width + 4, 0), h = Math.max(...canvases.map((c) => c.height));
  const cv = document.createElement('canvas'); cv.width = w * S; cv.height = h * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = ground; g.fillRect(0, 0, cv.width, cv.height);
  let x = 0;
  for (const c of canvases) { g.drawImage(c, 0, 0, c.width, c.height, x * S, (h - c.height) * S, c.width * S, c.height * S); x += c.width + 4; }
  await post(`${name}.png`, cv);
  return { w: cv.width, h: cv.height };
}

// Frame sheets: for each [label, frames] (puppet-shaped, { anim: { view: [canvas] } }),
// a row per view of idle, two walk frames, the windup, the strike and hurt,
// with Brann and a goblin (front and side) at the end for scale; at 3x.
//   await A.sheet('snag', [['NEW', N.buildSnagtooth()], ['OLD', O.buildSnagtooth(['down'])]])
export async function sheet(name, sets, { ground = '#5c7a4f' } = {}) {
  const T = window.__game.textures, fr = (k, f) => { const x = T.getFrame(k, f), c = document.createElement('canvas'); c.width = x.cutWidth; c.height = x.cutHeight; c.getContext('2d').drawImage(x.source.image, x.cutX, x.cutY, x.cutWidth, x.cutHeight, 0, 0, x.cutWidth, x.cutHeight); return c; };
  const out = [];
  for (const [label, f] of sets) for (const v of ['down', 'side', 'up']) if (f.idle[v]) out.push([`${label} ${v}`, [f.idle[v][0], f.walk[v][0], f.walk[v][2], f.attack[v][0], f.attack[v][1], (f.cast?.[v] || f.hurt[v])[1] || f.hurt[v][0], f.hurt[v][0]]]);
  const cast = [fr('brann', 'idle_down_0'), fr('goblin', 'idle_down_0'), fr('brann', 'idle_side_0'), fr('goblin', 'idle_side_0')];
  const cell = Math.max(...out.flatMap(([, r]) => r.map((c) => c.width))) + 4, rh = Math.max(...out.flatMap(([, r]) => r.map((c) => c.height))) + 2;
  const cv = document.createElement('canvas'); cv.width = (7 * cell + 4 * 50) * S; cv.height = (out.length * rh + 6) * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = ground; g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${4 * S}px monospace`; g.textBaseline = 'top';
  out.forEach(([lab, row], r) => {
    row.forEach((x, i) => g.drawImage(x, 0, 0, x.width, x.height, (i * cell + (cell - x.width) / 2) * S, (r * rh + 6 + rh - x.height) * S, x.width * S, x.height * S));
    g.fillStyle = '#16121f'; g.fillText(lab, 2 * S, (r * rh + 6) * S);
  });
  cast.forEach((x, i) => g.drawImage(x, 0, 0, x.width, x.height, (7 * cell + i * 50) * S, (6 + rh - x.height - 12) * S, x.width * S, x.height * S));
  await post(`${name}.png`, cv);
  return { w: cv.width, h: cv.height };
}
