// Door arrival check (dev only): after going in / out of the tavern and shop,
// how far does each companion swing round the leader (degrees) and walk (px)
// in the next 3 seconds? A lap round the leader shows as ~180-360 degrees.
//   const D = await import('/tools/door-orbit.js'); await D.run()
import { go } from './goto.js';
import W from '../src/data/world.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function run() {
  const sc = await go(21, 34, { clear: true });
  const out = [];
  for (const [a, b] of [['tavernIn', 'tavernOut'], ['shopIn', 'shopOut']]) for (const id of [a, b]) {
    sc.doorWarp(W.warps.find((w) => w.id === id));
    const inside = id.endsWith('In');
    while ((sc.area !== 'overworld') !== inside) await wait(16); // the teleport has happened
    await wait(150); // arrived (the fade-in starts)
    const L = sc.leader, comps = sc.party.filter((h) => h !== L);
    const st = comps.map((h) => ({ a: Math.atan2(h.y - L.y, h.x - L.x), sweep: 0, walk: 0, x: h.x, y: h.y }));
    for (let t = 0; t < 3000; t += 50) {
      await wait(50);
      comps.forEach((h, i) => { const s = st[i], a = Math.atan2(h.y - L.y, h.x - L.x); let d = a - s.a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; s.sweep += Math.abs(d); s.a = a; s.walk += Math.hypot(h.x - s.x, h.y - s.y); s.x = h.x; s.y = h.y; });
    }
    out.push([id, ...st.map((s) => `${Math.round(s.sweep * 180 / Math.PI)}deg/${Math.round(s.walk)}px`)]);
    while (sc.busy) await wait(50);
  }
  return out;
}
