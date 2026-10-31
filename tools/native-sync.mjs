// Unpacks snapshots/native-export.json (written by tools/native-export.js in
// the dev page) into ios/NinthTower/Export/, the native prototype's assets:
//   manifest.json   the map, the cast and every sheet's frames and animations
//   img/*.png       the sheets, the ground
//   sfx/*.m4a       the sound effects (rendered by the web synth)
//   data/*.json     the game's own data files, copied unchanged
// Usage: node tools/native-sync.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.env.NATIVE_DIR || resolve(ROOT, '../ninth-tower-ios'), 'NinthTower/Export');
const ex = JSON.parse(readFileSync(resolve(ROOT, 'snapshots/native-export.json'), 'utf8'));

rmSync(OUT, { recursive: true, force: true });
for (const d of ['img', 'sfx', 'data']) mkdirSync(resolve(OUT, d), { recursive: true });
const bytes = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const safe = (k) => k.replace(/[^\w.-]/g, '_');

const sheets = {};
for (const [key, s] of Object.entries(ex.sheets)) {
  const file = `${safe(key)}.png`;
  writeFileSync(resolve(OUT, 'img', file), bytes(s.image));
  sheets[key] = { file, frames: s.frames, anims: s.anims };
}
writeFileSync(resolve(OUT, 'img', 'ground.png'), bytes(ex.map.ground));
const sounds = [];
for (const [name, url] of Object.entries(ex.sounds)) {
  const wav = resolve(OUT, 'sfx', `${name}.wav`);
  writeFileSync(wav, bytes(url));
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wav, resolve(OUT, 'sfx', `${name}.m4a`)]);
  rmSync(wav);
  sounds.push(name);
}
const map = { ...ex.map, ground: 'ground.png' };
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify({ map, cast: ex.cast, sheets, fontChars: ex.fontChars, sounds }));
for (const f of ['heroes', 'enemies', 'skills', 'items', 'tuning']) copyFileSync(resolve(ROOT, `src/data/${f}.json`), resolve(OUT, 'data', `${f}.json`));
console.log(`${Object.keys(sheets).length} sheets, ${map.props.length} props, ${sounds.length} sounds -> ${OUT}`);
