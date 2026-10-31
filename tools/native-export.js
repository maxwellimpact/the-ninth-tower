// Exports what the native iOS prototype (ios/) draws and plays, straight out
// of the web build, so the two stay pixel-identical (design/tech.md §13: "art
// is exported, not re-drawn"). Dev only. In the dev page, on the Training
// Grounds (it boots a test game there):
//   const X = await import('/tools/native-export.js'); await X.run()
// It writes snapshots/native-export.json (every image as a PNG data URL, the
// sounds as WAV data URLs); then `node tools/native-sync.mjs` unpacks it into
// the native game's Export/ folder beside the game's JSON data.
import { step } from './goto.js';
import { boot } from './dungeon-walk.js';

// the cast: the party, and foes of each element (none, fire, frost, venom)
const HEROES = ['brann', 'pip', 'sable'];
const FOES = ['goblin', 'archer', 'imp', 'frostwolf', 'spider'];
const FX = ['shadow', 'shadowXL', 'arrow', 'firebolt', 'hitstar', 'dust', 'spark', 'sparkCurse', 'ringRed', 'ringGold', 'ringBlue',
  'px_white', 'px_fireL', 'px_curseL', 'px_grassXL', 'px_goldL', 'px_foam', 'px2_curseL', 'px2_mist', 'web0'];
const ICONS = ['icon_bash', 'icon_taunt', 'icon_fireball', 'icon_mend', 'icon_step', 'icon_fan', 'icon_bulwark', 'icon_meteor', 'icon_cuts', 'icon_dodge'];
const FONTS = ['font', 'fontGold', 'fontPlain'];
const SOUNDS = ['swing', 'stab', 'hit', 'crit', 'squish', 'block', 'hurt', 'dodge', 'step', 'fireCast', 'fireImpact', 'frost', 'bash', 'dash',
  'heal', 'enemyDie', 'swap', 'ult', 'aggro', 'levelUp', 'coin', 'zip'];

const png = (c) => c.toDataURL('image/png');
function toCanvas(src) {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

// A texture as one sheet plus its named frames and the animations drawn from it
// (`${key}_${anim}_${view}` for heroes and foes; anything else keeps its own key).
function sheet(scene, key) {
  const tex = scene.textures.get(key);
  if (!tex || tex.key === '__MISSING') return null;
  const frames = {};
  for (const [name, f] of Object.entries(tex.frames)) if (name !== '__BASE') frames[name] = [f.cutX, f.cutY, f.cutWidth, f.cutHeight];
  const anims = {};
  for (const a of Object.values(scene.anims.anims.entries)) {
    if (!a.frames.length || a.frames.some((f) => f.textureKey !== key)) continue;
    anims[a.key.startsWith(`${key}_`) ? a.key.slice(key.length + 1) : a.key] = { frames: a.frames.map((f) => f.textureFrame), fps: a.frameRate, loop: a.repeat === -1 };
  }
  return { image: png(toCanvas(tex.getSourceImage())), frames, anims };
}

// Each sound effect rendered once, offline, through the game's own synth.
async function renderSounds() {
  const { audio, SFX } = await import('/src/audio/synth.js');
  const Real = window.AudioContext, saved = { ctx: audio.ctx, muted: audio.muted, tests: window.__muteTests };
  window.__muteTests = false; // (a muted tab would render silence)
  const out = {};
  try {
    for (const name of SOUNDS) {
      if (!SFX[name]) continue;
      const len = name === 'levelUp' || name === 'ult' ? 1.6 : 0.9;
      let off = null;
      window.AudioContext = function () { off = new OfflineAudioContext(2, Math.ceil(44100 * len), 44100); return off; };
      audio.ctx = null; audio.muted = false;
      audio.init();
      audio.sfx(name);
      out[name] = wav(await off.startRendering());
    }
  } finally {
    window.AudioContext = Real;
    audio.ctx = saved.ctx; audio.muted = saved.muted; window.__muteTests = saved.tests;
  }
  return out;
}

// 16-bit stereo WAV, trailing silence trimmed
function wav(buf) {
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let n = L.length;
  while (n > 1000 && Math.abs(L[n - 1]) < 1e-4 && Math.abs(R[n - 1]) < 1e-4) n--;
  n = Math.min(L.length, n + 441);
  const b = new DataView(new ArrayBuffer(44 + n * 4));
  const s = (o, t) => [...t].forEach((ch, i) => b.setUint8(o + i, ch.charCodeAt(0)));
  s(0, 'RIFF'); b.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 2, true);
  b.setUint32(24, 44100, true); b.setUint32(28, 44100 * 4, true); b.setUint16(32, 4, true); b.setUint16(34, 16, true); s(36, 'data'); b.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (const [k, ch] of [[0, L], [1, R]]) b.setInt16(44 + i * 4 + k * 2, Math.max(-1, Math.min(1, ch[i])) * 32767, true);
  let bin = ''; const u = new Uint8Array(b.buffer);
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export async function run() {
  const content = await import('/src/world/content.js');
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann'); st.recruited = [...HEROES]; st.active = [...HEROES]; st.map = 'arena';
  for (const id of HEROES) st.heroes[id].level = 6;
  const sc = await boot({ state: st });
  const { mapDef } = content;
  for (const e of sc.enemies) { e.alive = false; e.destroy(); }
  sc.enemies = [];
  const { GROUPS, loadGroupNow } = await import('/src/game/assets.js');
  for (const g of Object.keys(GROUPS)) if (!g.startsWith('boss_')) loadGroupNow(sc, g);

  // the map: the Training Grounds' rectangle, its ground painted by the
  // terrain painter, its scenery as placed, and which tiles are walkable
  const def = mapDef('arena'), TILE = 16;
  const [ax, ay] = def.at, tw = def.rows[0].length, th = def.rows.length;
  const x0 = ax * TILE, y0 = ay * TILE, w = tw * TILE, h = th * TILE;
  sc.cameras.main.centerOn(x0 + w / 2, y0 + h / 2);
  await step(60); // let every chunk and its scenery stream in
  const ground = document.createElement('canvas'); ground.width = w; ground.height = h;
  const gx = ground.getContext('2d'), CH = 256;
  for (let cy = Math.floor(y0 / CH); cy <= Math.floor((y0 + h - 1) / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor((x0 + w - 1) / CH); cx++) {
    gx.putImageData(new ImageData(sc.painter.chunkPixels(cx, cy), CH, CH), cx * CH - x0, cy * CH - y0);
  }
  const nav = [];
  for (let ty = 0; ty < th; ty++) {
    let row = '';
    for (let tx = 0; tx < tw; tx++) row += sc.nav.isWater(ax + tx, ay + ty) ? '~' : sc.nav.isSolid(ax + tx, ay + ty) ? '#' : '.';
    nav.push(row);
  }
  const props = [], propTex = new Set();
  const units = new Set([...sc.party.flatMap((p) => [p.sprite, p.shadow])]);
  for (const o of sc.children.list) {
    if (!o.visible || !o.texture || units.has(o) || o.type === 'BitmapText' || (o.scrollFactorX ?? 1) !== 1) continue;
    if (o.x < x0 - 24 || o.x > x0 + w + 24 || o.y < y0 - 24 || o.y > y0 + h + 48) continue;
    if (o.texture.key.startsWith('__') || o.texture.key.startsWith('chunk_')) continue; // (the ground is painted above)
    const anim = o.anims?.currentAnim?.key;
    props.push({ tex: o.texture.key, frame: o.frame.name === '__BASE' ? null : o.frame.name, anim: anim || null, x: o.x - x0, y: o.y - y0, ox: o.originX, oy: o.originY,
      flip: !!o.flipX, sx: o.scaleX, sy: o.scaleY, depth: o.depth - y0, alpha: o.alpha, tint: o.tintTopLeft === 0xffffff ? null : o.tintTopLeft });
    propTex.add(o.texture.key);
  }

  const out = { map: { id: 'arena', name: def.name, tile: TILE, w: tw, h: th, start: def.start, nav, ground: png(ground), props }, sheets: {}, cast: {}, fontChars: null, sounds: null };
  for (const id of HEROES) {
    const hero = sc.party.find((p) => p.def.id === id);
    out.cast[id] = { sheet: hero.texKey, portrait: `${hero.texKey}_portrait` };
    out.sheets[hero.texKey] = sheet(sc, hero.texKey);
    out.sheets[`${hero.texKey}_portrait`] = sheet(sc, `${hero.texKey}_portrait`);
  }
  for (const id of FOES) out.cast[id] = { sheet: id }, out.sheets[id] = sheet(sc, id);
  for (const k of [...FX, ...ICONS, ...FONTS, ...propTex]) { const s = sheet(sc, k); if (s) out.sheets[k] = s; }
  out.fontChars = (await import('/src/gfx/font.js')).FONT_CHARS;
  out.sounds = await renderSounds();
  const missing = [...HEROES, ...FOES, ...FX, ...ICONS, ...FONTS].filter((k) => !out.sheets[k] && !out.cast[k]);
  const body = `data:image/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(out))))}`; // (the snapshot endpoint takes a data URL)
  await fetch('/__snap?name=native-export.json', { method: 'POST', body });
  return { sheets: Object.keys(out.sheets).length, props: props.length, sounds: Object.keys(out.sounds).length, missing, kb: Math.round(body.length / 1024) };
}
