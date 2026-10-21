// The page: pixel-font labels, the section index, and each section's demo,
// loaded only as you scroll near it.
import { pixelText } from './lib/pixels.js';
import { whenNear } from './lib/loop.js';
import { mountHero } from './sections/hero.js';
import { wardStone } from '../src/gfx/props.js';

// the tab icon is a sprite too: the Ward Stone, drawn now
{ const f = wardStone()[0], c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; const k = Math.min(32 / f.width, 32 / f.height); x.drawImage(f, (32 - f.width * k) / 2, 32 - f.height * k, f.width * k, f.height * k); const l = document.createElement('link'); l.rel = 'icon'; l.href = c.toDataURL(); document.head.appendChild(l); }

document.getElementById('build').textContent = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

// labels drawn with the game's own font
for (const el of document.querySelectorAll('[data-px]')) {
  const big = el.classList.contains('num');
  const t = pixelText(el.dataset.px, big ? 4 : 2, { color: big ? 'goldL' : 'white' });
  el.appendChild(t);
}

// the index down the side, lit for the section in view
const toc = document.getElementById('toc');
const sections = [...document.querySelectorAll('main section')];
for (const s of sections) {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><span>${s.dataset.title}</span></a>`;
  toc.appendChild(li);
}
const links = [...toc.querySelectorAll('a')];
const seen = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`));
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => seen.observe(s));

mountHero(document.getElementById('hero-stage'));

const DEMOS = {
  'demo-code': () => import('./sections/code.js'),
  'demo-puppets': () => import('./sections/puppets.js'),
  'demo-world': () => import('./sections/world.js'),
  'demo-loading': () => import('./sections/loading.js'),
  'demo-walking': () => import('./sections/walking.js'),
  'demo-combat': () => import('./sections/combat.js'),
  'demo-dungeons': () => import('./sections/dungeons.js'),
  'demo-curse': () => import('./sections/curse.js'),
  'demo-music': () => import('./sections/music.js'),
  'demo-data': () => import('./sections/data.js'),
  'demo-perf': () => import('./sections/perf.js'),
  'demo-testing': () => import('./sections/testing.js'),
  'demo-join': () => import('./sections/join.js'),
};
for (const [id, load] of Object.entries(DEMOS)) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.innerHTML = '<p class="loading">Generating…</p>';
  whenNear(el, async () => {
    try {
      const m = await load();
      el.innerHTML = '';
      await m.mount(el);
    } catch (e) {
      console.error(id, e);
      el.innerHTML = `<p class="loading">This demo couldn't start here (${e.message}).</p>`;
    }
  });
}
