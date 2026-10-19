// Ferryman look study (dev only): candidate mystic looks beside the current
// one and the heroes, idle facing down, at 3x; saved to snapshots/ferry-looks.png.
//   const F = await import('/tools/ferry-looks.js'); await F.sheet()
import { composeHero } from '../src/gfx/gear.js';
import { buildPuppetFrames } from '../src/gfx/puppet.js';
export const CANDIDATES = {
  A: { head: 'hood_shadow@6', body: 'habit_monk@6', weapon: 'staff_crystal@6' },
  B: { head: 'hood_monk@6', body: 'robe_scholar@6', weapon: 'staff_crystal@4' },
  C: { head: 'hood_cultist@3', body: 'robe_cultist@3', weapon: 'staff_crystal@5' },
  D: { head: 'hood_shadow@3', body: 'robe_phoenix@5', weapon: 'staff_sunspire@4' },
};
export async function sheet(name = 'ferry-looks.png') {
  const sc = window.__scene;
  const S = 3, cw = 40, items = [];
  for (const k of ['brann', 'pip', 'ferryman']) { const f = sc.textures.getFrame(k, 'idle_down_0'); if (f) items.push([k === 'ferryman' ? 'NOW' : k.toUpperCase(), f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight]); }
  for (const [k, eq0] of Object.entries(CANDIDATES)) {
    const { base = 'oake', anim = 'idle', frame = 0, ...eq } = eq0;
    const def = { ...composeHero(base, { weapon: 'none', offhand: null, head: null, ...eq }), id: 'ferry' + k, name: k };
    const fr = buildPuppetFrames(def)[anim].down, c = fr[Math.min(frame, fr.length - 1)];
    items.push([k, c, 0, 0, c.width, c.height]);
  }
  const cv = document.createElement('canvas'); cv.width = items.length * cw * S; cv.height = 64 * S;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#5c9e4f'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${5 * S}px monospace`; g.fillStyle = '#f2c14e'; g.textBaseline = 'top';
  items.forEach(([label, img, x, y, w, h], i) => { g.drawImage(img, x, y, w, h, (i * cw + (cw - w) / 2) * S, (52 - h) * S, w * S, h * S); g.fillText(label, (i * cw + 4) * S, 54 * S); });
  await fetch(`/__snap?name=${name}`, { method: 'POST', body: cv.toDataURL('image/png') });
  return items.length;
}
