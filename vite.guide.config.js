// The developer guide (guide/): a walkthrough of how the game works, built
// from the game's own code, so every sprite, chunk and note on it is real.
//   npm run guide          dev server
//   npm run build:guide    static site in dist-guide/ (deployed to GitHub Pages)
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execSync } from 'child_process';

let BUILD = 'dev';
try { BUILD = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a git checkout */ }

export default defineConfig({
  root: resolve(__dirname, 'guide'),
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: { fs: { allow: [resolve(__dirname)] } },
  resolve: { alias: { phaser: resolve(__dirname, 'guide/lib/phaser-stub.js') } },
  worker: { format: 'es' },
  build: { outDir: resolve(__dirname, 'dist-guide'), emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
