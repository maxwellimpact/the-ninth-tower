// Art comparison sheet (dev only). In a running game:
//   const S = await import('/tools/sheet.js'); S.sheet([['brann', 'idle_side_0'], ['frostwolf', 'idle_0']])
// Draws the given texture frames side by side at 3x on a snow-blue card over
// the HUD (feet on one line), so new sprites can be checked against the cast.
// S.hide() removes it.
export function sheet(items, { bg = '#c3cfe6', S = 3, x = 4, y = 4 } = {}) {
  const sc = window.__scene, ui = sc.scene.get('UI');
  const frames = items.map(([k, f]) => sc.textures.getFrame(k, f)).filter(Boolean);
  const W = frames.reduce((a, fr) => a + fr.cutWidth + 6, 6), H = Math.max(...frames.map((fr) => fr.cutHeight)) + 12;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  let ox = 6;
  for (const fr of frames) {
    g.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, ox * S, (H - 6 - fr.cutHeight) * S, fr.cutWidth * S, fr.cutHeight * S);
    ox += fr.cutWidth + 6;
  }
  if (ui.textures.exists('devSheet')) ui.textures.remove('devSheet');
  ui.textures.addCanvas('devSheet', c);
  window.__devSheet?.destroy();
  window.__devSheet = ui.add.image(x, y, 'devSheet').setOrigin(0).setScale(0.5).setDepth(99999);
  return window.__devSheet;
}

export function hide() { window.__devSheet?.destroy(); window.__devSheet = null; }
