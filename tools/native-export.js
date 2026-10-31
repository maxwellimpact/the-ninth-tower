// Exports what the native iOS game (a private repository, ninth-tower-ios)
// draws and plays, straight out of the web build, so the two stay
// pixel-identical (design/tech.md §13: "art is exported, not re-drawn").
// Dev only. In the dev page:
//   const X = await import('/tools/native-export.js')
//   await X.art()                // every texture, animation, font and sound effect
//   await X.world()              // Aldermere: tiles, props, terrain chunks, curses
//   await X.world('colosseum')   // a separate map (src/data/maps), the same way
// Each writes its files into snapshots/ as nx_* (through the dev server's
// /__snap); then `node tools/native-sync.mjs` copies them into the native
// game's Export/ folder beside the game's JSON data.
import { step } from './goto.js';
import { boot } from './dungeon-walk.js';

const SOUNDS_LONG = new Set(['levelUp', 'ult', 'curseLift', 'chest', 'portalOpen', 'portalClose', 'warp', 'rumble', 'roar', 'shatter', 'unlock']);

const toCanvas = (src) => {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
};
// one file into snapshots/ (the endpoint keeps only [\w.-] in a name, and
// strips a data:image/...;base64, prefix)
async function put(name, dataUrl) {
  const body = dataUrl.startsWith('data:image/') ? dataUrl : `data:image/x;base64,${dataUrl.slice(dataUrl.indexOf(',') + 1)}`;
  const r = await fetch(`/__snap?name=${encodeURIComponent(name)}`, { method: 'POST', body });
  if (!r.ok) throw new Error(`write ${name}: ${r.status}`);
}
const putJSON = (name, obj) => put(name, `data:image/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}`);
const safe = (k) => k.replace(/[^\w.-]/g, (c) => `-${c.charCodeAt(0).toString(16)}`);

async function game(map = null) {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
  if (map) st.map = map;
  const sc = await boot({ state: st });
  for (const e of sc.enemies) { e.alive = false; e.destroy(); }
  sc.enemies = [];
  return sc;
}

// Made per save (a hero dressed in its gear) or per world (terrain, curses):
// those are composed at run time natively, or exported by world().
const perSave = (k) => k.includes('#') || k.startsWith('chunk_') || k.startsWith('__') || k.startsWith('curseOverlay_');

export async function art() {
  const sc = await game();
  const A = await import('/src/game/assets.js');
  for (const g of Object.keys(A.GROUPS)) await A.loadGroup(sc, g); // (waits on any group already loading in the background)
  const anims = {};
  for (const a of Object.values(sc.anims.anims.entries)) {
    if (!a.frames.length) continue;
    anims[a.key] = { frames: a.frames.map((f) => [f.textureKey, f.textureFrame]), fps: a.frameRate, repeat: a.repeat, yoyo: !!a.yoyo };
  }
  const textures = {};
  let n = 0;
  for (const k of sc.textures.getTextureKeys()) {
    if (perSave(k)) continue;
    const tex = sc.textures.get(k);
    const frames = {};
    for (const [name, f] of Object.entries(tex.frames)) if (name !== '__BASE') frames[name] = [f.cutX, f.cutY, f.cutWidth, f.cutHeight];
    const file = `nx_t_${safe(k)}.png`;
    await put(file, toCanvas(tex.getSourceImage()).toDataURL('image/png'));
    textures[k] = { file, frames, data: tex.customData && Object.keys(tex.customData).length ? tex.customData : undefined };
    if (++n % 50 === 0) await step(1);
  }
  const fonts = { chars: (await import('/src/gfx/font.js')).FONT_CHARS };
  const sounds = await renderSounds();
  await putJSON('nx_art.json', { textures, anims, fonts, sounds });
  return { textures: n, anims: Object.keys(anims).length, sounds: sounds.length };
}

// Each sound effect rendered once, offline, through the game's own synth.
async function renderSounds() {
  const { audio, SFX } = await import('/src/audio/synth.js');
  const Real = window.AudioContext, saved = { ctx: audio.ctx, muted: audio.muted, tests: window.__muteTests };
  window.__muteTests = false; // (a muted tab would render silence)
  const names = [];
  try {
    for (const name of Object.keys(SFX)) {
      const len = SOUNDS_LONG.has(name) ? 2.4 : 1.0;
      let off = null;
      window.AudioContext = function () { off = new OfflineAudioContext(2, Math.ceil(44100 * len), 44100); return off; };
      audio.ctx = null; audio.muted = false;
      audio.init();
      try { audio.sfx(name); } catch { continue; } // (one that needs live state)
      await put(`nx_s_${name}.wav`, wav(await off.startRendering()));
      names.push(name);
    }
  } finally {
    window.AudioContext = Real;
    audio.ctx = saved.ctx; audio.muted = saved.muted; window.__muteTests = saved.tests;
  }
  return names;
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

// A world: its tile grid, its props as built, each overworld tile's region,
// the painted terrain as 256px chunks (only those the map covers; all-wall
// chunks off in the interiors' margins are left out and drawn as ink), and
// each standing Ward Stone's curse overlay.
export async function world(mapId = null) {
  const sc = await game(mapId);
  const M = await import('/src/world/map.js');
  const C = await import('/src/world/content.js');
  const id = mapId || 'aldermere';
  const W = M.MAP_W, H = M.MAP_H, CH = 256;
  const rect = C.mapRect(); // tiles; null on Aldermere
  const [tx0, ty0, tx1, ty1] = rect ? [rect.x0, rect.y0, rect.x1, rect.y1] : [0, 0, W - 1, H - 1];
  let bin = '';
  for (let i = 0; i < sc.world.tiles.length; i++) bin += String.fromCharCode(sc.world.tiles[i]);
  const biomeIds = ['vale', 'meadow', 'marsh', 'gloam', 'cinder', 'frost', 'basin'];
  let biome = '';
  if (!rect) for (let y = 0; y < H; y++) for (let x = 0; x < M.OW_W; x++) biome += String(Math.max(0, biomeIds.indexOf(M.biomeAt(x, y))));
  const allWall = (cx, cy) => {
    for (let y = cy * 16; y < cy * 16 + 16; y++) for (let x = cx * 16; x < cx * 16 + 16; x++) if (x < W && y < H && !M.SOLID.has(sc.world.at(x, y))) return false;
    return true;
  };
  const chunks = [];
  for (let cy = Math.floor(ty0 * 16 / CH); cy <= Math.floor((ty1 * 16 + 15) / CH); cy++) for (let cx = Math.floor(tx0 * 16 / CH); cx <= Math.floor((tx1 * 16 + 15) / CH); cx++) {
    if (cx * CH >= W * 16 || cy * CH >= H * 16) continue;
    if (allWall(cx, cy) && (rect || cx * 16 >= M.OW_W)) continue;
    const c = document.createElement('canvas'); c.width = c.height = CH;
    c.getContext('2d').putImageData(new ImageData(sc.painter.chunkPixels(cx, cy), CH, CH), 0, 0);
    await put(`nx_w_${id}_${cx}_${cy}.png`, c.toDataURL('image/png'));
    chunks.push([cx, cy]);
    if (chunks.length % 20 === 0) await step(1);
  }
  const curses = [];
  for (const w of sc.wards || []) {
    for (let i = 0; i < 200 && !w.canvas; i++) await step(2); // (painted by the worker)
    if (!w.canvas) continue;
    await put(`nx_w_${id}_curse_${w.def.id}.png`, w.canvas.toDataURL('image/png'));
    curses.push({ id: w.def.id, region: w.region });
  }
  const def = {
    id, w: W, h: H, owW: M.OW_W, rect: [tx0, ty0, tx1, ty1],
    tiles: btoa(bin), props: sc.world.props, biome: rect ? null : biome, biomeIds,
    chunks, curses,
    areas: M.AREAS, landmarks: M.LANDMARKS, tower: M.TOWER, barrierR: M.BARRIER_R, towerDoor: M.TOWER_DOOR, highfold: M.HIGHFOLD, lavaRiver: M.LAVA_RIVER,
    T: M.T, solid: [...M.SOLID], soft: [...M.SOFT],
  };
  await putJSON(`nx_w_${id}.json`, def);
  return { id, chunks: chunks.length, props: def.props.length, curses: curses.length };
}
