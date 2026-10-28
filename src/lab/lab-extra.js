// Lab: creature / prop / FX previews + the Sound Lab (music layers, SFX, voices).
import { buildHexling, buildFrogKing, buildGolem, MIRE_TONES } from '../gfx/creatures.js';
import * as P from '../gfx/props.js';
import { audio, SFX } from '../audio/synth.js';
import { music, VALE_THEME } from '../audio/music.js';
import { HEROES, HERO_DATA, ITEMS, heroDef } from '../gfx/heroes.js';
import { buildPuppetFrames, mirrorFrame } from '../gfx/puppet.js';
import { itemIcon } from '../gfx/gear.js';

export default function ({ section, animCell }) {
  soundLab(section);
  gearSection(section, animCell);

  const c = section('Creatures & NPCs');
  const row = document.createElement('div'); row.className = 'row'; c.appendChild(row);
  const hx = buildHexling();
  for (const [k, f] of Object.entries(hx)) animCell(row, `hexling ${k}`, f, k === 'walk' ? 8 : 4, 4);
  animCell(row, 'frog king', buildFrogKing().idle, 2.5, 4);
  const mire = buildHexling(MIRE_TONES, 'goldL');
  animCell(row, 'mire slime walk', mire.walk, 8, 4);
  const gol = buildGolem();
  for (const [v, anims] of Object.entries(gol)) for (const [k, f] of Object.entries(anims)) animCell(row, `golem ${v} ${k}`, f, k === 'walk' ? 5 : 3, 2, true);

  const p = section('Props');
  const r2 = document.createElement('div'); r2.className = 'row'; p.appendChild(r2);
  for (let s = 0; s < 4; s++) animCell(r2, `tree ${s}`, [P.tree(s)], 1, 3);
  animCell(r2, 'bush', [P.bush(1)], 1, 4);
  animCell(r2, 'berry bush', [P.bush(2, true)], 1, 4);
  animCell(r2, 'rock', [P.rock(1, true)], 1, 4);
  animCell(r2, 'tall grass', P.grassTuft(2), 3, 4);
  animCell(r2, 'campfire', P.campfire(), 8, 4);
  animCell(r2, 'ward stone', P.wardStone(), 5, 3, true);
  animCell(r2, 'ward rubble', [P.wardRubble()], 1, 3, true);
  animCell(r2, 'gate pillar', [P.pillar(false)], 1, 3);
  animCell(r2, 'chest', [P.chest(false), P.chest(true)], 1, 4);
  animCell(r2, 'sign', [P.signpost()], 1, 4);

  const f = section('FX');
  const r3 = document.createElement('div'); r3.className = 'row'; f.appendChild(r3);
  animCell(r3, 'fire bolt', P.fireBolt(), 14, 5, true);
  animCell(r3, 'hit star', P.hitStar(), 10, 5, true);
  animCell(r3, 'coin', P.coin(), 8, 6, true);
  animCell(r3, 'dust', P.dustPuff(), 8, 6, true);
}

function btn(parent, label, fn, cls = '') {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = () => { audio.init(); fn(b); };
  parent.appendChild(b);
  return b;
}

function soundLab(section) {
  const s = section('Sound Lab — all audio is synthesized live (no audio files)');

  const note = document.createElement('p');
  note.style.cssText = 'color:var(--muted);margin:0 0 10px;max-width:760px';
  note.textContent = 'Theme: "Brightwater Vale". Freed = C major with full arrangement. Cursed = the same theme auto-mapped to C minor, detuned, thinner arp, darker pad. Combat layer adds drums, driving bass and a counter-melody. In-game, entering the curse zone crossfades to Cursed; breaking the Ward Stone resolves it back to Freed.';
  s.appendChild(note);

  const m = document.createElement('div'); m.className = 'controls'; s.appendChild(m);
  const stateEl = document.createElement('span');
  stateEl.style.cssText = 'align-self:center;color:var(--accent);margin-left:8px';
  const refresh = () => { stateEl.textContent = music.playing ? `▶ ${music.state.variant.toUpperCase()}${music.state.combat ? ' + COMBAT' : ''}` : '■ stopped'; };
  btn(m, '▶ Play theme', () => { music.start(VALE_THEME); refresh(); });
  btn(m, '■ Stop', () => { music.stop(); refresh(); });
  btn(m, 'Freed (major)', () => { music.setVariant('freed', 1.2); refresh(); });
  btn(m, 'Cursed (minor)', () => { music.setVariant('cursed', 1.2); refresh(); });
  btn(m, 'Combat layer on/off', () => { music.setCombat(!music.state.combat); refresh(); });
  btn(m, '✦ Lift the curse', () => {
    if (!music.playing) music.start(VALE_THEME);
    music.setVariant('cursed', 0.01);
    setTimeout(() => { audio.sfx('shatter'); }, 300);
    setTimeout(() => { audio.sfx('curseLift'); music.setVariant('freed', 1.6); refresh(); }, 1000);
    refresh();
  });
  m.appendChild(stateEl);
  refresh();

  const vol = document.createElement('div'); vol.className = 'controls'; s.appendChild(vol);
  const slider = (label, get, set) => {
    const w = document.createElement('label');
    w.style.cssText = 'display:flex;gap:6px;align-items:center;color:var(--muted)';
    w.textContent = label;
    const i = document.createElement('input');
    i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = get();
    i.oninput = () => { audio.init(); set(+i.value); };
    w.appendChild(i);
    vol.appendChild(w);
  };
  slider('Music', () => audio.musicVol, (v) => { audio.musicVol = v; audio.musicBus?.gain.setTargetAtTime(v, audio.t, 0.05); });
  slider('SFX', () => audio.sfxVol, (v) => { audio.sfxVol = v; audio.sfxBus?.gain.setTargetAtTime(v, audio.t, 0.05); });

  const h3 = document.createElement('h2'); h3.textContent = 'Sound effects'; h3.style.marginTop = '14px'; s.appendChild(h3);
  const fx = document.createElement('div'); fx.className = 'controls'; s.appendChild(fx);
  for (const name of Object.keys(SFX)) {
    if (name === 'blip') continue;
    btn(fx, name, () => audio.sfx(name));
  }

  const h4 = document.createElement('h2'); h4.textContent = 'Character voices (dialogue blips)'; h4.style.marginTop = '14px'; s.appendChild(h4);
  const vc = document.createElement('div'); vc.className = 'controls'; s.appendChild(vc);
  const box = document.createElement('div'); box.id = 'dialog'; s.appendChild(box);
  const voices = [
    ...HEROES.map((h) => ({ name: h.name, voice: h.voice, line: { brann: "STAY BEHIND ME. I'VE GOT THE BIG SHIELD.", pip: "I CAN EXPLAIN THE FIRE. MOSTLY.", sable: 'TOUCH MY SCARF AND LOSE A HAND.' }[h.id] })),
    { name: 'King Aldric (frog)', voice: { pitch: 110, wave: 'square', duty: 0.125 }, line: 'MALGRIM HAS MADE A FROG OF YOUR KING. RIBBIT. I MEAN... AHEM.' },
  ];
  let timer;
  for (const v of voices) {
    btn(vc, `🗨 ${v.name}`, () => {
      clearInterval(timer);
      let i = 0;
      box.innerHTML = `<b style="color:var(--accent)">${v.name.toUpperCase()}</b><br>`;
      const span = document.createElement('span'); box.appendChild(span);
      timer = setInterval(() => {
        i++;
        span.textContent = v.line.slice(0, i);
        if (i % 2 === 0 && v.line[i - 1] !== ' ') audio.sfx('blip', { voice: v.voice });
        if (i >= v.line.length) clearInterval(timer);
      }, 30);
    });
  }
}

const RARITY_COL = { common: '#d8d3e0', fine: '#6fd3a0', unique: '#f2c14e' };

// Every item shown on its hero (one slot swapped from the starter kit).
function gearSection(section, animCell) {
  for (const h of HERO_DATA) {
    const s = section(`Gear — ${h.name}`);
    for (const slot of ['head', 'body', 'weapon', 'offhand']) {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginBottom = '6px';
      const tag = document.createElement('div');
      tag.style.cssText = 'width:60px;color:var(--muted)';
      tag.textContent = slot;
      row.appendChild(tag);
      const ids = Object.entries(ITEMS).filter(([, it]) => it.hero === h.id && it.slot === slot);
      for (const [id, it] of ids) {
        const f = buildPuppetFrames(heroDef(h.id, { ...h.equip, [slot]: id }));
        const box = document.createElement('div');
        box.style.cssText = `display:flex;gap:4px;align-items:flex-end;border:1px solid ${RARITY_COL[it.rarity]};border-radius:6px;padding:4px`;
        animCell(box, 'idle', f.idle.down, 2.5, 3);
        animCell(box, 'walk', f.walk.side, 8, 3);
        animCell(box, 'back', f.walk.up, 8, 3);
        animCell(box, 'attack', f.attack.side.map(mirrorFrame), 8, 3);
        animCell(box, it.name.toLowerCase(), [itemIcon(h.id, slot, it.look)], 1, 4, true);
        row.appendChild(box);
      }
      s.appendChild(row);
    }
  }
}
