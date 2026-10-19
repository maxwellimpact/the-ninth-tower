// House mix sheet (dev only): a grid of seeded A and C cottages from
// src/gfx/cottage.js, each with what it rolled written under it, Brann at the
// first door of each row for scale; saved to snapshots/house-mix.png.
//   const M = await import('/tools/house-mix.js'); await M.sheet()
export async function sheet(name = 'house-mix.png', seed = 1, n = 12, cols = 4) {
  const sc = window.__scene, C = await import('/src/gfx/cottage.js?' + Date.now());
  const S = 3, cw = 76, rh = 96, top = 4, rows = Math.ceil(n / cols);
  const cv = document.createElement('canvas'); cv.width = cols * cw * S; cv.height = (top + rows * rh) * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#5c9e4f'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = `${4 * S}px monospace`; g.textBaseline = 'top';
  const hero = sc.textures.getFrame('brann', 'idle_down_0');
  C.street(n, seed).forEach((f, i) => {
    const type = f.type, c = C.cottage(f);
    const col = i % cols, row = Math.floor(i / cols), x0 = col * cw + Math.round((cw - c.width) / 2), base = top + row * rh + 72;
    g.drawImage(c, 0, 0, c.width, c.height, x0 * S, (base - c.height) * S, c.width * S, c.height * S);
    if (col === 0) g.drawImage(hero.source.image, hero.cutX, hero.cutY, hero.cutWidth, hero.cutHeight, (x0 + c.width - hero.cutWidth / 2 - 2) * S, (base - hero.cutHeight + 6) * S, hero.cutWidth * S, hero.cutHeight * S);
    g.fillStyle = 'rgba(22,18,31,0.75)'; g.fillRect(col * cw * S + 2, (base + 3) * S, (cw - 2) * S - 4, 18 * S);
    g.fillStyle = '#f2c14e';
    const lines = [`${type} ${f.roof} / ${f.doorStyle}${f.arch ? ' arched' : ''}`, `win ${f.windows[0]}${f.windows[1] !== f.windows[0] ? '+' + f.windows[1] : ''}${f.flowers ? ' +box' : ''}`, `chim ${f.chimney}  ${f.ornaments.join(' ') || '-'}`];
    lines.forEach((l, k) => g.fillText(l, (col * cw + 3) * S, (base + 4 + k * 5.5) * S));
  });
  await fetch(`/__snap?name=${name}`, { method: 'POST', body: cv.toDataURL('image/png') });
  return { w: cv.width, h: cv.height };
}

// Brightwater's own six (props.js house()), open, then the four homes boarded up;
// the open-door overlay is drawn beside each door to check it lines up
//   const M = await import('/tools/house-mix.js'); await M.town()
export async function town(name = 'house-town.png') {
  const P = await import('/src/gfx/props.js?' + Date.now());
  const kinds = ['curio', 'shop', 'tavern', 'mayor', 'bath', 'archery'], shut = ['curio', 'archery', 'bath', 'mayor'];
  const S = 3, cw = 72, rh = 84;
  const cv = document.createElement('canvas'); cv.width = 6 * cw * S; cv.height = 3 * rh * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#5c9e4f'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${5 * S}px monospace`; g.textBaseline = 'top'; g.fillStyle = '#f2c14e';
  const put = (c, col, row, label) => { const x0 = col * cw + Math.round((cw - c.width) / 2), base = row * rh + 72; g.drawImage(c, 0, 0, c.width, c.height, x0 * S, (base - c.height) * S, c.width * S, c.height * S); g.fillText(label, (col * cw + 3) * S, (base + 3) * S); return { x0, base }; };
  kinds.forEach((k, i) => {
    const c = P.house(k), { x0, base } = put(c, i, 0, k.toUpperCase());
    const d = P.doorOf(k), o = P.houseDoorOpen(k), bx = x0 + c.width / 2;
    // row 2: the same house with its door open (the overlay laid over it)
    const c2 = P.house(k), { x0: x2, base: b2 } = put(c2, i, 1, 'DOOR OPEN');
    g.drawImage(o, 0, 0, o.width, o.height, (x2 + c2.width / 2 + d.x) * S, (b2 + d.y) * S, o.width * S, o.height * S);
    const ch = P.chimneyOf(k); if (ch) { g.fillStyle = 'rgba(216,211,224,0.8)'; g.fillRect((bx + ch[0] - 1) * S, (base + ch[1] - 3) * S, 3 * S, 3 * S); g.fillStyle = '#f2c14e'; }
  });
  shut.forEach((k, i) => put(P.house(k, true), i, 2, k.toUpperCase() + ' SHUT'));
  await fetch(`/__snap?name=${name}`, { method: 'POST', body: cv.toDataURL('image/png') });
  return { w: cv.width, h: cv.height };
}
