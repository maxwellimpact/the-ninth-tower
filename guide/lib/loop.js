// One animation loop for the whole page. A demo only ticks while it's on
// screen (and the tab is visible), the same rule the game uses for chunks:
// nothing off camera costs a frame.
const demos = new Set();
let last = 0, running = false;
export const frameStats = { dt: [], add(ms) { this.dt.push(ms); if (this.dt.length > 240) this.dt.shift(); } };

function frame(t) {
  const dt = Math.min(0.05, (t - (last || t)) / 1000);
  last = t;
  frameStats.add(dt * 1000);
  for (const d of demos) if (d.visible) d.tick(dt, t / 1000);
  if ([...demos].some((d) => d.visible)) requestAnimationFrame(frame);
  else { running = false; last = 0; }
}
const wake = () => { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } };
document.addEventListener('visibilitychange', wake);

const io = new IntersectionObserver((entries) => {
  for (const e of entries) for (const d of demos) if (d.el === e.target) d.visible = e.isIntersecting;
  wake();
}, { rootMargin: '80px' });

// Testing with ?test: every demo counts as visible, and frames can be stepped
// by hand (a hidden tab gets no animation frames).
export const TEST = new URLSearchParams(location.search).has('test');
export function step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { last += dt * 1000; for (const d of demos) if (d.visible || TEST) d.tick(dt, last / 1000); } }
if (TEST) window.__guide = { step, show: async (id, off = -10) => { const el = document.getElementById(id); scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: 'instant' }); for (let i = 0; i < 6; i++) { step(10); await new Promise((r) => setTimeout(r, 20)); } return Math.round(scrollY); } };

// how many demos exist, and how many are animating right now
export const demoCount = () => ({ all: demos.size, on: [...demos].filter((d) => d.visible).length });

// Run tick(dt, t) every frame while `el` is on screen. Returns a stop function.
export function animate(el, tick) {
  const d = { el, tick, visible: false };
  demos.add(d);
  io.observe(el);
  return () => { demos.delete(d); io.unobserve(el); };
}

// Call `start` once, the first time `el` comes near the viewport (so each
// section's code and generated art load only when you scroll to it).
export function whenNear(el, start) {
  if (TEST) { setTimeout(start, 0); return; }
  const o = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { o.disconnect(); start(); }
  }, { rootMargin: '600px' });
  o.observe(el);
}
