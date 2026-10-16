// Set-piece behaviour for scripted enemies: foes that put on a show for an
// errand (raiders hounding a traveller) until the party steps in. While
// staged they ignore the party completely; they wake when the errand is
// accepted, when the party hits one, or (wake mode, after a reload) when the
// party walks up. Reusable: an errand step names a mode and its options.
//
//   "stage": { "mode": "harass" }              circle the victim and take turns
//                                               swinging at them (the default)
//   "stage": { "mode": "harass", "ring": 22 }  options override the mode's defaults
//
// What keeps it calm to watch (the old orbiting version twitched): each foe
// holds a fixed post and only walks when it is clearly off it (a dead band),
// never faces the party, and the group swings one at a time with a visible
// wind-up, the way real attacks are telegraphed.
import { audio } from '../audio/synth.js';

export const MODES = {
  harass: {
    ring: 17,       // melee post distance from the victim (px)
    rangedRing: 42, // archers / casters stand back
    swingGap: [0.7, 1.3], // seconds between swings, across the whole group
    windup: 0.28,
    swing: 0.32,
    shuffle: [4, 7], // now and then a melee foe moves to a free post
  },
};

const rand = ([a, b]) => a + Math.random() * (b - a);

// the shared state of one staged group (one errand)
export function makeStage(victim, units, opts = {}) {
  const cfg = { ...MODES[opts.mode || 'harass'], ...opts };
  const g = { victim, cfg, units, turn: rand(cfg.swingGap) * 0.6, swinger: null, posts: [] };
  // posts: melee foes spread evenly around the victim, the ranged ones behind
  const melee = units.filter((u) => !u.s.ranged), ranged = units.filter((u) => u.s.ranged);
  const n = Math.max(3, melee.length + 1); // a spare post leaves room to shuffle
  for (let i = 0; i < n; i++) g.posts.push({ a: Math.PI * 2 * (i / n) + 0.4, ring: cfg.ring, taken: null });
  melee.forEach((u, i) => { g.posts[i].taken = u; });
  ranged.forEach((u, i) => { const p = { a: Math.PI * 2 * (i / Math.max(1, ranged.length)) + 2.2, ring: cfg.rangedRing, taken: u }; g.posts.push(p); });
  return g;
}

const postXY = (g, p) => ({ x: g.victim.px + Math.cos(p.a) * p.ring, y: g.victim.py + 4 + Math.sin(p.a) * p.ring * 0.7 });

// one frame of one staged foe
export function updateStaged(u, dt) {
  const st = u.staged, g = st.group, sc = u.scene, v = g.victim, cfg = g.cfg;
  // a group turn clock: only one foe swings at a time
  if (g.clockFrame !== sc.game.loop.frame) { g.clockFrame = sc.game.loop.frame; tickGroup(g, dt); }
  let post = g.posts.find((p) => p.taken === u);
  if (!post) { post = g.posts.find((p) => !p.taken && (p.ring === cfg.rangedRing) === !!u.s.ranged) || g.posts[0]; post.taken = u; }
  const spot = postXY(g, post);
  // swinging: hold the pose until it's done
  if (st.phase === 'windup' || st.phase === 'swing') {
    st.t -= dt;
    u.face(v.px - u.x, v.py - u.y);
    if (st.phase === 'windup') {
      u.play('windup');
      if (st.t <= 0) {
        st.phase = 'swing'; st.t = cfg.swing;
        u.anim = ''; u.play('attack');
        if (u.onScreen()) audio.sfx(u.s.ranged ? 'swing' : 'stab', { pitch: u.s.ranged ? 1.6 : 1.2 });
        if (!u.s.ranged) sc.time.delayedCall(120, () => flinch(sc, v, u));
      }
    } else if (st.t <= 0) { st.phase = null; if (g.swinger === u) g.swinger = null; }
    return;
  }
  // walk to the post only when clearly off it (dead band), then stand still
  const d = Math.hypot(spot.x - u.x, spot.y - u.y);
  if (st.walking ? d > 1.5 : d > 6) { st.walking = true; u.stepTo(spot, dt, 0.45); return; }
  st.walking = false;
  u.face(v.px - u.x, v.py - u.y);
  u.play('idle');
  // our turn to swing
  if (g.swinger === u && !st.phase) { st.phase = 'windup'; st.t = cfg.windup; return; }
  // now and then shuffle to the spare post (melee only, not mid-turn)
  st.shuffleT = (st.shuffleT ?? rand(cfg.shuffle)) - dt;
  if (st.shuffleT <= 0 && !u.s.ranged && g.swinger !== u) {
    st.shuffleT = rand(cfg.shuffle);
    const free = g.posts.filter((p) => !p.taken && p.ring === cfg.ring && !sc.nav.solidAtPx(postXY(g, p).x, postXY(g, p).y));
    if (free.length) { post.taken = null; free[Math.floor(Math.random() * free.length)].taken = u; }
  }
}

function tickGroup(g, dt) {
  if (g.swinger && (!g.swinger.alive || !g.swinger.staged)) g.swinger = null;
  if (g.swinger) return;
  g.turn -= dt;
  if (g.turn > 0) return;
  // the next swinger: someone standing at their post, not the last one
  const ready = g.units.filter((u) => u.alive && u.staged && !u.staged.walking && !u.staged.phase && u !== g.last);
  const pick = ready[Math.floor(Math.random() * ready.length)] || g.units.find((u) => u.alive && u.staged && !u.staged.walking);
  if (!pick) return;
  g.swinger = g.last = pick;
  g.turn = rand(g.cfg.swingGap);
}

// the victim reacts: a white flash and a little hop away from the blow
function flinch(sc, v, u) {
  if (!v.s?.active || !u.staged) return;
  v.s.setTintFill(0xffffff);
  sc.time.delayedCall(60, () => v.s.active && v.s.clearTint());
  const dx = Math.sign(v.px - u.x) || 1;
  if (!sc.tweens.isTweening(v.s)) sc.tweens.add({ targets: v.s, x: v.s.x + dx * 2, duration: 60, yoyo: true });
}
