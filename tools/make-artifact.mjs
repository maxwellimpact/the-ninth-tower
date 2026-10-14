// Turns dist/index.html into dist/artifact.html for publishing as a private
// claude.ai Artifact: the host wraps the page in its own <html>/<head>/<body>,
// so strip ours, and drop the host's safe-area padding (the game reads the
// insets itself via #safe and lays the HUD out edge to edge).
import { readFileSync, writeFileSync } from 'fs';
let h = readFileSync('dist/index.html', 'utf8');
const head = h.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
const body = h.match(/<body>([\s\S]*?)<\/body>/)[1];
const fix = `<style>:root{padding:0!important;color-scheme:dark;background:#16121f} #app{height:100%}</style>\n`;
writeFileSync('dist/artifact.html', head.trim() + '\n' + fix + body.trim() + '\n');
console.log('dist/artifact.html written');
