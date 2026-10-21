// 07: dungeons are text. The Forge of Ash's first room straight from
// dungeons.json: its floor and walls painted by the terrain painter (the
// dungeon lives in the same world map), and the kit's pieces (block, plate,
// shutter, vault door, campfire, chest) drawn by the dungeon art code.
import D from '../../src/data/dungeons.json';
import * as DG from '../../src/gfx/dungeonart.js';
import * as P from '../../src/gfx/props.js';
import { paintArea } from '../lib/world.js';
import { pixelCanvas, heroFrames } from '../lib/pixels.js';
import { animate } from '../lib/loop.js';

const F = D.forge;
const C0 = 12, C1 = 43, R0 = 44, R1 = 58; // the crop, in the dungeon's own grid
const COLW = C1 - C0 + 1, ROWH = R1 - R0 + 1;
const COLOR = { '#': '#45405e', '.': '#2b2140', B: '#f2c14e', P: '#f2c14e', '=': '#e7a6ff', '&': '#ff7b2e', W: '#4e9ad0', V: '#6f93e0', '%': '#a3a1b9', F: '#ffd04a', '@': '#73b25a', 8: '#fff0a0', k: '#e7a6ff', K: '#e7a6ff', '!': '#ec6a5e' };

export async function mount(el) {
  el.innerHTML = `
    <div class="dg-grid">
      <div class="stage dg-stage"><span class="hint">Tap the block to push it</span></div>
      <pre class="code dg-ascii" aria-label="The room as text"></pre>
    </div>
    <div class="controls"><button class="chip" data-a="reset">Put it back</button><span class="caption dg-cap">The shutter at the top stays shut until something heavy holds the plate down.</span></div>`;
  const css = document.createElement('style');
  css.textContent = `
    .dg-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .dg-ascii { font-size: clamp(9px, 1.05vw, 13px); line-height: 1.25; letter-spacing: 0.04em; max-height: none; }
    .dg-ascii span { border-radius: 2px; }
    .dg-ascii span.on { background: rgba(255,240,160,0.25); outline: 1px solid rgba(255,240,160,0.7); }
    .dg-stage canvas { width: 100% !important; height: auto !important; cursor: pointer; }
    @media (max-width: 760px) { .dg-grid { grid-template-columns: 1fr; } }`;
  el.appendChild(css);

  // the text, one span per cell, so a cell can light up with its tile
  const pre = el.querySelector('.dg-ascii'), cells = [];
  for (let r = R0; r <= R1; r++) {
    const row = [];
    for (let c = C0; c <= C1; c++) {
      const ch = F.rows[r][c], s = document.createElement('span');
      s.textContent = ch; s.style.color = COLOR[ch] || '#6e6a87';
      pre.appendChild(s); row.push(s);
    }
    pre.appendChild(document.createTextNode('\n'));
    cells.push(row);
  }

  const [ox, oy] = F.origin;
  const bg = await paintArea((ox + C0) * 16, (oy + R0) * 16, COLW * 16, ROWH * 16);
  const stage = el.querySelector('.dg-stage');
  const [cv, ctx] = pixelCanvas(COLW * 16, ROWH * 16, 2);
  stage.prepend(cv);

  const find = (ch) => { for (let r = R0; r <= R1; r++) { const c = F.rows[r].indexOf(ch, C0); if (c >= 0 && c <= C1) return [c - C0, r - R0]; } return null; };
  const blockAt = find('B'), plate = find('P');
  const shutter = []; for (let c = C0; c <= C1; c++) if (F.rows[48][c] === '=') shutter.push(c - C0);
  const vault = []; for (let r = R0; r <= R1; r++) if (F.rows[r][21] === 'V') vault.push(r - R0);
  const art = {
    block: DG.pushBlock(), plateUp: DG.plate(false), plateDown: DG.plate(true),
    shutH: DG.door('shutter', false, false), shutHOpen: DG.door('shutter', false, true), vault: DG.door('vault', true, false),
    crack: DG.crackedWall(true), chest: P.chest(false), fire: P.campfire(),
  };
  const solidAt = (x, y) => { const ch = F.rows[y + R0]?.[x + C0]; return !ch || '#&WV%8='.includes(ch) || (x === -1); };
  const block = { x: blockAt[0], y: blockAt[1], fx: blockAt[0], fy: blockAt[1] };
  const brann = heroFrames('brann');
  const hero = { x: blockAt[0] - 1, y: blockAt[1] };
  let open = false, push = null, hover = null, msg = el.querySelector('.dg-cap');

  const tileOf = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width) * COLW), Math.floor(((e.clientY - r.top) / r.height) * ROWH), ((e.clientX - r.left) / r.width) * COLW, ((e.clientY - r.top) / r.height) * ROWH]; };
  cv.addEventListener('pointermove', (e) => { const [x, y] = tileOf(e); light(x, y); });
  cv.addEventListener('pointerleave', () => light(-1, -1));
  for (let y = 0; y < ROWH; y++) for (let x = 0; x < COLW; x++) cells[y][x].onmouseenter = () => light(x, y);
  function light(x, y) { if (hover) hover.classList.remove('on'); hover = cells[y]?.[x] || null; hover?.classList.add('on'); }

  cv.addEventListener('pointerdown', (e) => {
    if (push) return;
    const [x, y, fx, fy] = tileOf(e);
    if (x !== Math.round(block.fx) || y !== Math.round(block.fy)) { msg.textContent = 'Tap the block: it slides away from the side you tap.'; return; }
    // push away from the side you tapped, like the hero walking into it
    const dx = fx - (block.fx + 0.5), dy = fy - (block.fy + 0.5);
    const [mx, my] = Math.abs(dx) > Math.abs(dy) ? [-Math.sign(dx), 0] : [0, -Math.sign(dy)];
    const nx = block.x + mx, ny = block.y + my;
    if (solidAt(nx, ny)) { msg.textContent = "It won't go that way: there's a wall."; return; }
    hero.x = block.x - mx; hero.y = block.y - my; hero.view = mx ? 'side' : my > 0 ? 'down' : 'up'; hero.flip = mx < 0;
    push = { t: 0, from: [block.x, block.y], to: [nx, ny] };
    block.x = nx; block.y = ny;
  });
  el.querySelector('[data-a=reset]').onclick = () => { block.x = block.fx = blockAt[0]; block.y = block.fy = blockAt[1]; hero.x = blockAt[0] - 1; hero.y = blockAt[1]; open = false; push = null; msg.textContent = 'Back where it started. (Leaving a room unsolved does the same in the game.)'; };

  let t = 0;
  animate(stage, (dt) => {
    t += dt;
    if (push) {
      push.t += dt / 0.22;
      const k = Math.min(1, push.t);
      block.fx = push.from[0] + (push.to[0] - push.from[0]) * k; block.fy = push.from[1] + (push.to[1] - push.from[1]) * k;
      if (k >= 1) {
        push = null;
        if (block.x === plate[0] && block.y === plate[1] && !open) { open = true; msg.textContent = 'Click. The plate holds, and the shutter grinds open.'; }
        else if (!open) { const n = Math.abs(plate[0] - block.x) + Math.abs(plate[1] - block.y); msg.textContent = `${n} tile${n === 1 ? "" : "s"} from the plate.`; }
      }
    }
    ctx.drawImage(bg, 0, 0);
    const on = !push && block.x === plate[0] && block.y === plate[1];
    ctx.drawImage(on ? art.plateDown : art.plateUp, plate[0] * 16 + 8 - art.plateUp.width / 2, plate[1] * 16 + 8 - art.plateUp.height / 2);
    // the shutter: front-on over its three tiles, its bottom on the row's bottom edge
    const sx = (shutter[0] + shutter[shutter.length - 1] + 1) / 2 * 16, sy = (48 - R0 + 1) * 16;
    const sh = open ? art.shutHOpen : art.shutH;
    ctx.drawImage(sh, Math.round(sx - sh.width / 2), sy - sh.height);
    if (vault.length) ctx.drawImage(art.vault, (21 - C0) * 16, (vault[0] + vault.length / 2) * 16 - art.vault.height / 2);
    const cr = find('%'); if (cr) ctx.drawImage(art.crack, cr[0] * 16, cr[1] * 16 + 16 - art.crack.height);
    const ch = find('8'); if (ch) ctx.drawImage(art.chest, ch[0] * 16 + 8 - art.chest.width / 2, ch[1] * 16 + 12 - art.chest.height);
    const fi = find('F'), ff = art.fire[Math.floor(t * 8) % art.fire.length]; if (fi) ctx.drawImage(ff, fi[0] * 16 + 8 - ff.width / 2, fi[1] * 16 + 14 - ff.height);
    // the block and the hero who pushes it
    const bx = block.fx * 16 + 8, by = block.fy * 16 + 16;
    const items = [{ y: by, draw: () => ctx.drawImage(art.block, Math.round(bx - art.block.width / 2), Math.round(by - art.block.height)) },
      { y: hero.y * 16 + 14, draw: () => {
        const v = hero.view || 'side', list = push ? brann.walk[v] : brann.idle[v];
        const f = list[Math.floor(t * (push ? 9 : 2.5)) % list.length];
        const hx = (push ? hero.x + (block.fx - block.x) : hero.x) * 16 + 8, hy = (push ? hero.y + (block.fy - block.y) : hero.y) * 16 + 14;
        ctx.save(); ctx.translate(Math.round(hx), Math.round(hy)); if (v === 'side' && hero.flip) ctx.scale(-1, 1); ctx.drawImage(f, -24, -36); ctx.restore();
      } }].sort((a, b) => a.y - b.y);
    for (const i of items) i.draw();
  });
}
