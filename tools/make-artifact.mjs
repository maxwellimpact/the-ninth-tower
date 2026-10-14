// Turns dist/index.html into a page for publishing as a private claude.ai
// Artifact: the host wraps the page in its own <html>/<head>/<body>, so strip
// ours, and drop the host's safe-area padding (the game reads the insets
// itself via #safe and lays the HUD out edge to edge).
//   node tools/make-artifact.mjs [out]   (default dist/full.html; the demo used dist/artifact.html)
import { readFileSync, writeFileSync } from 'fs';
const out = process.argv[2] || 'dist/full.html';
const title = process.argv[3] || 'Ninth Tower Wave 1';
const h = readFileSync('dist/index.html', 'utf8');
const head = h.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '').replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
const body = h.match(/<body>([\s\S]*?)<\/body>/)[1];
const fix = `<style>:root{padding:0!important;color-scheme:dark;background:#16121f} #app{height:100%}</style>\n`;
writeFileSync(out, head.trim() + '\n' + fix + body.trim() + '\n');
console.log(`${out} written`);
