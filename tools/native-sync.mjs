// Copies what tools/native-export.js wrote into snapshots/ (nx_*) into the
// native game's Export/ folder, in its own private repository
// (../ninth-tower-ios, or NATIVE_DIR):
//   art.json        every texture's file, frames and data; every animation; the font; the sounds
//   img/            the textures
//   world/<id>.json a world's tiles, props, regions and landmarks; world/<id>/ its curses and vines
//   ../reference/terrain/<id>/ the web's terrain chunks, outside the app: the app paints its own
//                   ground, and -terraintest checks it against these pixel for pixel
//   sfx/*.m4a       the sound effects (rendered by the web synth)
//   data/           the game's own data files, copied unchanged
// Usage: node tools/native-sync.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = resolve(ROOT, 'snapshots');
const NATIVE = resolve(process.env.NATIVE_DIR || resolve(ROOT, '../ninth-tower-ios'));
const OUT = resolve(NATIVE, 'NinthTower/Export');
const REF = resolve(NATIVE, 'reference/terrain');

rmSync(OUT, { recursive: true, force: true });
rmSync(REF, { recursive: true, force: true });
for (const d of ['img', 'sfx', 'music', 'world', 'data/maps']) mkdirSync(resolve(OUT, d), { recursive: true });
const files = readdirSync(SNAP).filter((f) => f.startsWith('nx_'));
let n = { img: 0, sfx: 0, chunks: 0 };
for (const f of files) {
  const src = resolve(SNAP, f);
  if (f === 'nx_art.json') copyFileSync(src, resolve(OUT, 'art.json'));
  else if (f === 'nx_gear.json') copyFileSync(src, resolve(OUT, 'gear.json'));
  else if (f === 'nx_music.json') copyFileSync(src, resolve(OUT, 'music.json'));
  else if (f.startsWith('nx_m_')) { execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', src, resolve(OUT, 'music', `${f.slice(5, -4)}.m4a`)]); n.music = (n.music || 0) + 1; }
  else if (f.startsWith('nx_t_')) { copyFileSync(src, resolve(OUT, 'img', f.slice(5))); n.img++; }
  else if (f.startsWith('nx_s_')) {
    const name = f.slice(5, -4);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', src, resolve(OUT, 'sfx', `${name}.m4a`)]);
    n.sfx++;
  } else if (f.startsWith('nx_w_')) {
    const rest = f.slice(5);
    if (rest.endsWith('.json')) copyFileSync(src, resolve(OUT, 'world', rest));
    else { // <id>_<cx>_<cy>.png (a terrain chunk: a reference only), or a curse or vine image
      const id = rest.split('_')[0], name = rest.slice(id.length + 1);
      const dir = /^\d+_\d+\.png$/.test(name) ? resolve(REF, id) : resolve(OUT, 'world', id);
      mkdirSync(dir, { recursive: true });
      copyFileSync(src, resolve(dir, name));
      n.chunks++;
    }
  }
}
// the art manifest names each texture's file with its nx_t_ prefix: drop it
const art = JSON.parse(readFileSync(resolve(OUT, 'art.json'), 'utf8'));
for (const t of Object.values(art.textures)) t.file = t.file.slice(5);
writeFileSync(resolve(OUT, 'art.json'), JSON.stringify(art));
for (const f of readdirSync(resolve(ROOT, 'src/data'))) if (f.endsWith('.json')) copyFileSync(resolve(ROOT, 'src/data', f), resolve(OUT, 'data', f));
for (const f of readdirSync(resolve(ROOT, 'src/data/maps'))) copyFileSync(resolve(ROOT, 'src/data/maps', f), resolve(OUT, 'data/maps', f));
// JS keeps an object's keys in the order written, and the game leans on it
// (a hero's starting skills, lists in the menu); Swift's dictionaries don't.
// So every object's key order goes along: "<file>:<path>" -> keys.
const order = {};
const walk = (v, path) => {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') { const ks = Object.keys(v); if (ks.length > 1) order[path] = ks; for (const k of ks) walk(v[k], path ? `${path}.${k}` : k); }
};
for (const f of readdirSync(resolve(ROOT, 'src/data'))) if (f.endsWith('.json')) walk(JSON.parse(readFileSync(resolve(ROOT, 'src/data', f), 'utf8')), `${f.slice(0, -5)}:`);
writeFileSync(resolve(OUT, 'data/_order.json'), JSON.stringify(order));
console.log(`${n.img} textures, ${n.sfx} sounds, ${n.music || 0} music stems, ${n.chunks} world images -> ${OUT} (terrain references -> ${REF})`);
