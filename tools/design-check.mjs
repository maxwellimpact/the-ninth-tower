// Design docs check (node, from the repo root):  node tools/design-check.mjs
// The design index (design/README.md) is the contract: every file under
// design/ must be listed in it, and every relative link in the design files
// and the root docs must point at a file that exists. Exits 1 on a problem.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const designFiles = walk('design').filter((f) => f.endsWith('.md'));
const docs = [...designFiles, 'DESIGN.md', 'README.md', 'AGENTS.md', 'CONTRIBUTING.md'];
const problems = [];

// every design file is in the index
const index = readFileSync('design/README.md', 'utf8');
for (const f of designFiles) {
  const rel = relative('design', f);
  if (rel !== 'README.md' && !index.includes(`(${rel})`)) problems.push(`not in design/README.md: ${f}`);
}

// every relative link resolves
for (const f of docs) {
  const text = readFileSync(f, 'utf8');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = join(dirname(f), target.split('#')[0]);
    if (!existsSync(path)) problems.push(`broken link in ${f}: ${target}`);
  }
}

if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log(`design check: ${designFiles.length} design files, all indexed; links in ${docs.length} docs all resolve`);
