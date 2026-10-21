// 12: how changes are proven. A real benchmark from tools/bench-results (the
// dodge change: the old code twice, then the new), the never-again rules read
// straight out of DESIGN.md, and the test tools.
import old1 from '../../tools/bench-results/evade-old-1.json';
import old2 from '../../tools/bench-results/evade-old-2.json';
import neu from '../../tools/bench-results/evade-new.json';
import design from '../../DESIGN.md?raw';

const TOOLS = [
  ['errand-walk.js', 'plays every errand start to finish: talks, fights, gathers, escorts, turns in'],
  ['dungeon-walk.js', 'walks every dungeon to its boss, checking each puzzle beat'],
  ['region-check.js', 'everything in a region stands somewhere you can walk to'],
  ['people-check.js', 'everyone stands on dry, open ground'],
  ['fight-bench.js', 'seven fixed fights, measured before and after any combat change'],
  ['goto.js', 'jump anywhere in the world'],
];

export function mount(el) {
  // the never-again rules: "1. **Title.**" lines under §8
  const sec = design.slice(design.indexOf('### 8. Never-again rules'));
  const rules = [...sec.slice(0, sec.indexOf('\n---')).matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[2].replace(/\.$/, ''));
  const runs = [['Old code, run 1', old1], ['Old code, run 2', old2], ['New code', neu]];
  const total = (r, k) => r.res.reduce((a, f) => a + f[k], 0);
  el.innerHTML = `
    <div class="ts-grid">
      <div>
        <h3 class="ts-h">The dodge change, measured</h3>
        <p class="caption">Totals over the benchmark's seven fights. The new code lands about as far from the old as two runs of the old code land from each other: inside the noise, so dodges didn't make fights easier or harder overall.</p>
        <div class="ts-chart"></div>
      </div>
      <div>
        <h3 class="ts-h">Never again</h3>
        <p class="caption">Each was a real bug in a playtest. Every new region, room and system is checked against them (from <code>DESIGN.md</code>).</p>
        <ol class="ts-rules">${rules.map((r) => `<li>${r}</li>`).join('')}</ol>
      </div>
    </div>
    <h3 class="ts-h ts-gap">The tools <span class="caption">in <code>tools/</code>, run from the browser console of a dev build</span></h3>
    <dl class="ts-tools">${TOOLS.map(([f, d]) => `<div><dt><code>${f}</code></dt><dd>${d}</dd></div>`).join('')}</dl>`;
  const css = document.createElement('style');
  css.textContent = `
    .ts-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; }
    .ts-h { font: 600 16px var(--sans); color: var(--white); margin: 0 0 4px; }
    .ts-h .caption { font-weight: 400; margin-left: 8px; }
    .ts-gap { margin-top: 30px; }
    .ts-chart { display: grid; gap: 14px; margin-top: 14px; }
    .ts-metric b { display: block; font-size: 13px; color: var(--bone); margin-bottom: 6px; font-weight: 600; }
    .ts-bar { display: grid; grid-template-columns: 120px minmax(0, 1fr) 54px; align-items: center; gap: 8px; font-size: 13px; color: var(--mist); margin: 4px 0; font-variant-numeric: tabular-nums; }
    .ts-bar i { display: block; height: 12px; border-radius: 3px; background: var(--slate); }
    .ts-bar.new i { background: var(--gold); }
    .ts-bar span:last-child { text-align: right; color: var(--white); }
    .ts-rules { margin: 12px 0 0; padding-left: 22px; display: grid; gap: 6px; font-size: 15px; }
    .ts-rules li::marker { color: var(--gold); font-weight: 600; }
    .ts-tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px 18px; margin: 12px 0 0; }
    .ts-tools div { min-width: 0; }
    .ts-tools dt { margin: 0; } .ts-tools dd { margin: 2px 0 0; color: var(--mist); font-size: 14px; }
    @media (max-width: 760px) { .ts-grid { grid-template-columns: 1fr; } }`;
  el.appendChild(css);
  const chart = el.querySelector('.ts-chart');
  for (const [label, key, unit] of [['Damage the party took', 'dmgTaken', ''], ['Damage dealt per second, added up over the fights', 'dpsOut', '']]) {
    const vals = runs.map(([, r]) => total(r, key)), max = Math.max(...vals) * 1.1;
    chart.insertAdjacentHTML('beforeend', `<div class="ts-metric"><b>${label}</b>${runs.map(([n], i) => `<div class="ts-bar ${i === 2 ? 'new' : ''}"><span>${n}</span><i style="width:${(vals[i] / max) * 100}%"></i><span>${vals[i].toFixed(0)}${unit}</span></div>`).join('')}</div>`);
  }
  chart.insertAdjacentHTML('beforeend', `<p class="caption">Over the new run, heroes dodged ${neu.counts.heroDodged} blows and foes missed ${neu.counts.foeMissed} times.</p>`);
}
