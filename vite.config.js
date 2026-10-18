import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// the commit a build came from, shown small on the title screen (so a phone
// still holding a cached older build is easy to spot)
let BUILD = 'dev';
try { BUILD = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a git checkout */ }

// Dev-only: POST a data URL to /__snap?name=foo.png and it lands in
// ./snapshots/foo.png. Used to pull sprite sheets / screenshots out of the
// browser for review without a visible window.
const snapshots = {
  name: 'snapshots',
  configureServer(server) {
    server.middlewares.use('/__snap', (req, res) => {
      const name = new URL(req.url, 'http://x').searchParams.get('name') || 'snap.png';
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const dir = resolve(__dirname, 'snapshots');
        mkdirSync(dir, { recursive: true });
        const b64 = body.replace(/^data:image\/\w+;base64,/, '');
        writeFileSync(resolve(dir, name.replace(/[^\w.-]/g, '_')), Buffer.from(b64, 'base64'));
        res.end('ok');
      });
    });
  },
};

export default defineConfig({
  base: './',
  plugins: [snapshots],
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), lab: resolve(__dirname, 'lab.html') },
    },
  },
});
