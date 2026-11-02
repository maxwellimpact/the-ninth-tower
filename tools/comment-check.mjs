// Swallowed code check (node, from the repo root):  node tools/comment-check.mjs
// Finds statements inside end-of-line comments, where a comment added mid-line has
// silently turned the rest of the line off (never-again rule 18). Exits 1 on a find.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const CODE = /audio\.sfx\(|this\.[A-Za-z_.]+\(.*\);|\bsc\.[A-Za-z_.]+\(.*\);|\bfx\.[a-zA-Z]+\(.*\);|events\.emit\(|\.setText\(/;
// where a line's comment starts, outside its strings
function commentAt(l) {
  let q = null;
  for (let i = 0; i < l.length - 1; i++) {
    if (q) { if (l[i] === '\\') i++; else if (l[i] === q) q = null; } else if (`'"\``.includes(l[i])) q = l[i];
    else if (l[i] === '/' && l[i + 1] === '/') return i;
  }
  return -1;
}
const finds = [];
for (const f of walk('src')) readFileSync(f, 'utf8').split('\n').forEach((l, n) => {
  const i = commentAt(l);
  if (i > 0 && l.slice(0, i).trim() && CODE.test(l.slice(i))) finds.push(`${f}:${n + 1}  ${l.slice(i, i + 120)}`);
});
for (const x of finds) console.log(x);
console.log(finds.length ? `${finds.length} comment(s) swallowing code` : 'comment check: no code swallowed');
process.exit(finds.length ? 1 : 0);
