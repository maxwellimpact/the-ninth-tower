// Prints the `files` map to publish alongside dist/full.html: every script the
// page loads (main, music, the terrain worker), with absolute source paths.
// The page alone is not enough — it references these by hashed name.
//   node tools/artifact-files.mjs
import { readdirSync } from 'fs';
import { resolve } from 'path';
const files = {};
for (const f of readdirSync('dist/assets')) if (f.endsWith('.js') && !f.startsWith('lab-')) files[`assets/${f}`] = resolve('dist/assets', f);
console.log(JSON.stringify(files, null, 2));
