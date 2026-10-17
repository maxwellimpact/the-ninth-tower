// Live gear effects: a dynamic layer drawn ON TOP of the baked hero sprite.
// Items with an `fx` entry (items.json) emit particles + a pulsing glow from
// where that item sits on the body (per hero, per facing). Because it's a
// separate layer it animates independently of the sprite frames.
import Phaser from 'phaser';
import items from '../data/items.json';

// anchor offsets from the feet [x, y] per view ('side' faces right; mirrored when flipped)
const ANCHOR = {
  brann: { weapon: { down: [-7, -1], up: [5, 1], side: [2, -1] }, offhand: { down: [5, -6], up: [-5, -6], side: [4, -6] }, head: [0, -17], body: [0, -8] },
  pip: { weapon: { down: [-5, -18], up: [4, -18], side: [0, -18] }, offhand: { down: [5, -6], up: [-5, -6], side: [2, -6] }, orb: { down: [8, -15], up: [-8, -15], side: [-7, -16] }, head: [0, -21], body: [0, -6] },
  mirelle: { weapon: { down: [-5, -16], up: [4, -16], side: [0, -16] }, offhand: { down: [5, -8], up: [-5, -8], side: [2, -8] }, head: [0, -21], body: [0, -6] },
  sable: { weapon: { down: [-6, -2], up: [4, -2], side: [3, -2] }, offhand: { down: [5, -2], up: [-5, -2], side: [2, -4] }, head: [0, -17], body: [0, -8] },
};
// Glow halos sit BEHIND the sprite (never over the character) and only on
// "source" items: [colour, alpha, radius px].
const GLOW = { flame: [0xff7b2e, 0.4, 5], sun: [0xffd04a, 0.5, 6], frost: [0x6fd3ff, 0.35, 4], arcane: [0xb24ce6, 0.45, 5] };
// seconds between particles (sparse on purpose: the character stays readable)
const RATE = { flame: 0.11, sun: 0.16, frost: 0.3, arcane: 0.24, radiant: 0.7, phoenix: 0.22, shadow: 0.2, venom: 0.5, glint: 2.4, stars: 0.9 };
// head/body effects get no halo; weapon-side effects keep a small one
const HALO_SLOTS = new Set(['weapon', 'offhand', 'orb']);

export class GearFX {
  constructor(scene, { scale = 1, depth = 100000 - 9, glowDepth = null, fixed = false } = {}) {
    this.glowDepth = glowDepth;
    this.fixed = fixed; // previews/labs: fixed depths instead of world y-sorting
    this.scene = scene;
    this.k = scale;
    this.depth = depth;
    this.slots = new Map(); // key -> { t, glow }
    // Emitters are created per hero+slot (not shared) so each can be depth-
    // sorted with its owner: trees and walls in front hide the effect too.
    const mk = (tex, cfg) => () => scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
    const sp = (a, b) => ({ min: a * scale, max: b * scale });
    this.make = {
      flame: mk('px_fireL', { speedY: sp(-18, -8), speedX: sp(-3, 3), lifespan: { min: 220, max: 380 }, scale: scale, alpha: { start: 1, end: 0 }, tint: [0xffd04a, 0xff7b2e] }),
      sun: mk('px_goldL', { speed: sp(6, 14), lifespan: { min: 250, max: 400 }, scale: scale, alpha: { start: 1, end: 0 } }),
      frost: mk('px_foam', { speedY: sp(3, 8), speedX: sp(-3, 3), lifespan: { min: 350, max: 600 }, scale: scale, alpha: { start: 0.9, end: 0 } }),
      arcane: mk('px_curseL', { speed: sp(3, 9), lifespan: { min: 300, max: 550 }, scale: scale, alpha: { start: 0.9, end: 0 } }),
      radiant: mk('px_white', { lifespan: 260, scale: scale, alpha: { start: 1, end: 0 } }),
      phoenix: mk('px_fire', { speedY: sp(-14, -6), speedX: sp(-4, 4), lifespan: { min: 280, max: 480 }, scale: scale, alpha: { start: 1, end: 0 } }),
      shadow: mk('px_ink', { speedY: sp(-10, -4), speedX: sp(-3, 3), lifespan: { min: 300, max: 520 }, scale: scale, alpha: { start: 0.7, end: 0 } }),
      venom: mk('px_grassXL', { speedY: sp(4, 10), gravityY: 40 * scale, lifespan: { min: 250, max: 420 }, scale: scale }),
      glint: mk('px_white', { lifespan: 180, scale: { start: scale * 2, end: scale } }),
      stars: mk('px_goldL', { speed: sp(1, 4), lifespan: 400, scale: scale, alpha: { start: 1, end: 0 } }),
    };
  }

  anchor(heroId, at, view) {
    const a = ANCHOR[heroId]?.[at] ?? ANCHOR[heroId]?.body ?? [0, -8];
    return Array.isArray(a) ? a : a[view] || a.down;
  }

  // u: { x, y, view, flip, downed, hs, def, sprite? } (a Hero, or a stand-in for previews)
  update(u, dt) {
    const k = this.k;
    for (const slot of ['head', 'body', 'weapon', 'offhand']) {
      const key = `${u.key || u.def.id}:${slot}`;
      const it = items[u.hs.equip[slot]];
      const fx = it?.fx;
      let st = this.slots.get(key);
      if (!fx || u.downed || u.hidden) {
        if (st?.glow) st.glow.setVisible(false);
        if (st?.orb) st.orb.setVisible(false);
        continue;
      }
      if (!st || st.type !== fx.type) {
        st?.glow?.destroy(); st?.em?.destroy(); st?.orb?.destroy();
        const g = GLOW[fx.type];
        const halo = g && HALO_SLOTS.has(fx.at);
        st = { t: Math.random() * RATE[fx.type], type: fx.type, glow: halo ? this.scene.add.image(0, 0, 'glow').setTint(g[0]).setBlendMode(Phaser.BlendModes.ADD) : null, ph: Math.random() * 6, em: this.make[fx.type]() };
        if (fx.at === 'orb') st.orb = this.scene.add.image(0, 0, 'orb').setScale(k);
        this.slots.set(key, st);
      }
      const front = this.fixed ? this.depth : u.y + 1.5;
      st.em.setDepth(front);
      let [ox, oy] = this.anchor(u.def.id, fx.at, u.view);
      if (st.orb) {
        // the orb floats on its own: slow bob + a small lazy orbit
        st.op = (st.op || Math.random() * 6) + dt;
        ox += Math.cos(st.op * 1.1) * 2.5;
        oy += Math.sin(st.op * 2.2) * 2.5 - 1;
      }
      const x = u.x + (u.flip ? -ox : ox) * k, y = u.y + oy * k;
      if (st.orb) st.orb.setVisible(true).setPosition(Math.round(x), Math.round(y)).setDepth(this.fixed ? this.depth - 1 : u.y + (u.view === 'up' ? -1 : 1));
      if (st.glow) {
        const g = GLOW[fx.type];
        st.ph += dt * (fx.type === 'sun' ? 5 : 3);
        // behind the character: just under the sprite's depth
        st.glow.setDepth(this.glowDepth ?? (st.orb ? u.y + (u.view === 'up' ? -1.5 : 0.5) : u.y - 0.5));
        st.glow.setVisible(true).setPosition(Math.round(x), Math.round(y)).setAlpha(g[1] * (0.8 + Math.sin(st.ph) * 0.2)).setScale((g[2] * k * (0.92 + Math.sin(st.ph * 1.3) * 0.08)) / 16);
      }
      st.t -= dt;
      if (st.t > 0) continue;
      st.t = RATE[fx.type] * (0.6 + Math.random() * 0.8);
      const jitter = (r) => (Math.random() * 2 - 1) * r * k;
      const em = st.em;
      if (fx.type === 'radiant' || fx.type === 'glint') em.explode(1, x + jitter(fx.at === 'body' ? 4 : 3), y + jitter(3));
      else if (fx.type === 'phoenix') em.explode(1, x + jitter(4), y + 7 * k + jitter(1));
      else if (fx.type === 'shadow') em.explode(1, x + jitter(4), y + 4 * k + jitter(2));
      else em.explode(1, x + jitter(1.5), y + jitter(1.5));
    }
  }

  clear(heroId) {
    for (const [key, st] of this.slots) if (key.startsWith(`${heroId}:`)) { st.glow?.destroy(); st.em?.destroy(); st.orb?.destroy(); this.slots.delete(key); }
  }
}
