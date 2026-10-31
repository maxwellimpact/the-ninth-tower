// Exports what the native iOS game (a private repository, ninth-tower-ios)
// draws and plays, straight out of the web build, so the two stay
// pixel-identical (design/tech.md §13: "art is exported, not re-drawn").
// Dev only. In the dev page:
//   const X = await import('/tools/native-export.js')
//   await X.art()                // every texture, animation, font and sound effect
//   await X.world()              // Aldermere: tiles, props, terrain chunks, curses
//   await X.world('colosseum')   // a separate map (src/data/maps), the same way
//   await X.music()              // every song's layers, one loop each
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
  // every item icon (gear is generated, so the web draws icons on demand):
  // the fixed items, and every generated look at every tier
  const IT = await import('/src/game/itemtex.js');
  const items = (await import('/src/data/items.json')).default;
  const G = (await import('/src/data/gear.json')).default;
  for (const id of Object.keys(items)) IT.itemTex(sc, id);
  for (let tier = 1; tier <= G.tiers.length; tier++) {
    for (const [hero, slots] of Object.entries(G.families)) for (const [slot, f] of Object.entries(slots)) f.looks.forEach((_, look) => IT.itemTex(sc, `g.${hero}.${slot}.${tier}.fine.${look}.-.-#nx`));
    for (const ring of Object.keys(G.rings)) IT.itemTex(sc, `g.any.trinket.${tier}.fine.${ring}.-.-#nx`);
  }
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
  const P = await import('/src/gfx/palette.js');
  const palette = Object.fromEntries(Object.keys(P.PAL).map((k) => [k, P.hex(k)]));
  await putJSON('nx_art.json', { textures, anims, fonts, sounds, palette });
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

// The music: each song's six layers (base / combat / the bard's harp, each
// freed and cursed) rendered offline through the game's own sequencer and
// instruments, one loop each. Two loops are rendered and the second kept, so
// the echoes and reverb of the loop's end ring on into its start, and it
// loops seamlessly. The native player plays the six together and fades
// between them as the web's mixer does.
export async function music({ only = null } = {}) {
  const { audio } = await import('/src/audio/synth.js');
  const M = await import('/src/audio/music.js');
  const REGIONS = ['vale', 'meadow', 'marsh', 'gloam', 'witchroot', 'cinder', 'forge', 'frost', 'cave', 'grotto', 'clawhold', 'spire', 'basin', 'undercroft', 'abbey', 'shop', 'tavern', ...Array.from({ length: 9 }, (_, i) => `tower${i + 1}`)];
  const slug = (song) => song.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const songs = new Map(), regions = {};
  for (const r of REGIONS) { const song = M.themeFor(r); regions[r] = slug(song); songs.set(slug(song), song); }
  const Real = window.AudioContext, saved = { ctx: audio.ctx, muted: audio.muted, tests: window.__muteTests };
  window.__muteTests = false;
  const out = {};
  try {
    for (const [id, song] of songs) {
      const loop = song.steps * (60 / song.bpm / 4);
      out[id] = { bpm: song.bpm, steps: song.steps, loop };
      if (only && !only.includes(id)) continue;
      for (const layer of ['base', 'combat', 'bard']) for (const v of ['freed', 'cursed']) {
        let off = null, now = 0;
        window.AudioContext = function () { off = new OfflineAudioContext(2, Math.ceil(44100 * (loop * 2 + 0.2)), 44100); return off; };
        audio.ctx = null; audio.muted = false;
        audio.init();
        const real = audio.ctx;
        // the sequencer reads the clock; offline, it's ours to move
        audio.ctx = new Proxy(real, { get: (t, k) => (k === 'currentTime' ? now : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
        const p = new M.MusicPlayer();
        p.state = { variant: v, combat: layer === 'combat' ? 1 : 0, bard: layer === 'bard' };
        p.start(song, 0.01);
        clearInterval(p.timer);
        // only this layer's notes (another's echoes would bleed into the shared reverb)
        p.byStep = p.byStep.map((list) => list.filter((x) => x.tr.layer === layer && x.v === v));
        for (const g of Object.values(p.nodes)) { g.gain.cancelScheduledValues(0); g.gain.value = 0; }
        p.nodes[`${layer}:${v}`].gain.value = 1;
        p.nextTime = 0;
        for (now = 0; now < loop * 2; now += 0.1) p.schedule();
        p.playing = false;
        audio.ctx = real;
        const buf = await off.startRendering();
        await put(`nx_m_${id}_${layer}_${v}.wav`, wavSlice(buf, Math.round(loop * 44100), Math.round(loop * 2 * 44100)));
      }
      await step(1);
    }
  } finally {
    window.AudioContext = Real;
    audio.ctx = saved.ctx; audio.muted = saved.muted; window.__muteTests = saved.tests;
  }
  await putJSON('nx_music.json', { regions, songs: out });
  return { songs: songs.size, stems: songs.size * 6 };
}

function wavSlice(buf, a, b) {
  const L = buf.getChannelData(0).subarray(a, b), R = buf.getChannelData(1).subarray(a, b), n = L.length;
  const d = new DataView(new ArrayBuffer(44 + n * 4));
  const s = (o, t) => [...t].forEach((ch, i) => d.setUint8(o + i, ch.charCodeAt(0)));
  s(0, 'RIFF'); d.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true);
  d.setUint32(24, 44100, true); d.setUint32(28, 44100 * 4, true); d.setUint16(32, 4, true); d.setUint16(34, 16, true); s(36, 'data'); d.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { d.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); d.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  let bin = ''; const u = new Uint8Array(d.buffer);
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

// The paper-doll gear (gfx/gear.js): every hero's bare head and posing rules,
// with each pose it strikes written out (attack and cast frames per view, as
// poses.js computes them), and every head, body and weapon look. The native
// game draws hero sheets from these with its port of gfx/puppet.js.
export async function gear() {
  const G = await import('/src/gfx/gear.js');
  const views = ['down', 'up', 'side'];
  const base = {};
  for (const [id, b] of Object.entries(G.BASE)) {
    base[id] = { headMap: b.headMap, head: b.head, idleAng: b.idleAng, idleAngL: b.idleAngL || null,
      attack: Object.fromEntries(views.map((v) => [v, b.attack(v)])), cast: Object.fromEntries(views.map((v) => [v, b.cast(v)])) };
  }
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  const offhand = {};
  for (const [id, o] of Object.entries(G.LOOKS.offhand)) offhand[id] = strip(o);
  await putJSON('nx_gear.json', { base, head: strip(G.LOOKS.head), body: strip(G.LOOKS.body), weapon: strip(G.LOOKS.weapon), offhand, defaultBody: G.DEFAULT_BODY, defaultWeapon: G.DEFAULT_WEAPON });
  return { bases: Object.keys(base).length };
}

// Reference sheets for checking the native composer: each hero in their
// starting gear with one item swapped in (every item with a look), and in
// every tier's recolour, drawn by the web's own puppet code (not saved in the
// game's export; the native game's -geartest compares against them).
export async function gearRef() {
  const G = await import('/src/gfx/gear.js');
  const P = await import('/src/gfx/puppet.js');
  const H = await import('/src/gfx/heroes.js');
  const items = (await import('/src/data/items.json')).default;
  const heroes = (await import('/src/data/heroes.json')).default;
  const combos = [];
  for (const h of heroes) {
    const start = H.looksOf(h.equip);
    for (const it of Object.values(items)) if (it.hero === h.id && it.look && it.slot !== 'trinket') combos.push({ hero: h.id, equip: { ...start, [it.slot]: it.look } });
    const firstOff = Object.values(items).find((it) => it.hero === h.id && it.slot === 'offhand')?.look;
    for (let t = 2; t <= 6; t++) {
      const e = {};
      for (const slot of ['head', 'body', 'weapon', 'offhand']) {
        const l = start[slot] || (slot === 'offhand' ? firstOff : slot === 'body' ? G.DEFAULT_BODY[h.id] : slot === 'weapon' ? G.DEFAULT_WEAPON[h.id] : Object.values(items).find((it) => it.hero === h.id && it.slot === 'head')?.look);
        e[slot] = l ? `${l}@${t}` : null;
      }
      combos.push({ hero: h.id, equip: e });
    }
  }
  const out = [];
  for (const [n, c] of combos.entries()) {
    const fr = P.buildPuppetFrames(G.composeHero(c.hero, c.equip));
    const list = [];
    for (const [anim, views] of Object.entries(fr)) for (const [v, frames] of Object.entries(views)) frames.forEach((canvas, i) => list.push({ name: `${anim}_${v}_${i}`, canvas }));
    const cv = document.createElement('canvas'); cv.width = 48 * list.length; cv.height = 48;
    const ctx = cv.getContext('2d');
    list.forEach((f, i) => ctx.drawImage(f.canvas, i * 48, 0));
    await put(`nx_gref_${n}.png`, cv.toDataURL('image/png'));
    out.push({ ...c, file: `nx_gref_${n}.png`, frames: list.map((f) => f.name) });
  }
  await putJSON('nx_gref.json', out);
  return { combos: out.length };
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
  // the Ward Stones' vines: each painted live and withered (with its stretch
  // under water, if any), and the path the motes run along
  const P = await import('/src/gfx/props.js');
  const putTex = async (key) => { if (!sc.textures.exists(key)) return null; const file = `nx_w_${id}_${safe(key)}.png`; await put(file, toCanvas(sc.textures.get(key).getSourceImage()).toDataURL('image/png')); return file; };
  const vines = [];
  for (const v of sc.vines || []) {
    const key = `vine_${v.ward.def.id}_${v.i}`;
    const live = await putTex(key), liveWet = await putTex(`${key}_wet`);
    const dv = { ...v, dead: true, img: null };
    sc.paintVine(dv);
    const dead = await putTex(`${key}_dead`), deadWet = await putTex(`${key}_dead_wet`);
    vines.push({ ward: v.ward.def.id, i: v.i, n: v.n, source: !!v.source, box: v.box, len: v.len, pods: v.pods, sigil: v.sigil || null,
      pts: v.pts.map((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round(q.d * 10) / 10]), live, liveWet, dead, deadWet });
  }
  // each building's doorway and chimney (gfx/props.js), and the Colosseum's seats
  const buildings = {};
  for (const b of C.W.buildings || []) if (!buildings[b.kind]) { let door = null; try { door = P.doorOf(b.kind); } catch (e) { /* landmarks without a door */ } buildings[b.kind] = { door, chimney: P.chimneyOf(b.kind) || null }; }
  const colosseum = (C.W.buildings || []).some((b) => b.kind === 'colosseum') ? { ...P.COLOSSEUM, seats: (P.COLOSSEUM.seats ??= P.colosseumArt().seats) } : null;
  const def = {
    id, w: W, h: H, owW: M.OW_W, rect: [tx0, ty0, tx1, ty1],
    tiles: btoa(bin), props: sc.world.props, biome: rect ? null : biome, biomeIds,
    chunks, curses, vines, buildings, colosseum,
    areas: M.AREAS, landmarks: M.LANDMARKS, tower: M.TOWER, barrierR: M.BARRIER_R, towerDoor: M.TOWER_DOOR, highfold: M.HIGHFOLD, lavaRiver: M.LAVA_RIVER,
    T: M.T, solid: [...M.SOLID], soft: [...M.SOFT],
  };
  await putJSON(`nx_w_${id}.json`, def);
  return { id, chunks: chunks.length, props: def.props.length, curses: curses.length };
}
