// Boot: generates the core art set behind a progress bar (all art is code-
// drawn, so "loading" is generation time). Biome sets load lazily in-game.
import Phaser from 'phaser';
import { loadGroup } from '../game/assets.js';
import { SAVE_KEY, ownSaveKey } from '../game/state.js';
import { ownMapIds } from '../world/content.js';
import { cloudRestore } from '../game/cloudsave.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    document.getElementById('loader')?.remove();
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    const bw = Math.min(180, W - 60), bx = Math.round((W - bw) / 2), by = Math.round(H / 2);
    let label = null, title = null;
    const draw = (p, name) => {
      g.clear();
      g.fillStyle(0x1a1423).fillRect(bx - 2, by - 2, bw + 4, 10);
      g.fillStyle(0x45405e).fillRect(bx - 1, by - 1, bw + 2, 8);
      g.fillStyle(0x2b2140).fillRect(bx, by, bw, 6);
      g.fillStyle(0xf2c14e).fillRect(bx, by, Math.round(bw * p), 6);
      g.fillStyle(0xfff0a0).fillRect(bx, by, Math.round(bw * p), 1);
      // little tower silhouette that fills as we load
      const tx = Math.round(W / 2), base = by - 22;
      for (let y = 0; y < 30; y++) {
        const w = 2 + Math.floor(y / 6);
        g.fillStyle(y > 30 - p * 30 ? 0x6b3fa0 : 0x2b2140).fillRect(tx - w, base - 30 + y, w * 2, 1);
      }
      g.fillStyle(0xe7a6ff).fillRect(tx - 1, base - 33, 2, 2);
      if (this.cache.bitmapFont.exists('font')) {
        title ??= this.add.bitmapText(W / 2, by - 64, 'fontGold', 'THE NINTH TOWER').setOrigin(0.5).setScale(2);
        label ??= this.add.bitmapText(W / 2, by + 16, 'fontPlain', '').setOrigin(0.5);
        label.setText(name ? `FORGING ${name.toUpperCase()}...` : 'READY');
      }
    };
    draw(0);
    const t0 = performance.now();
    const restored = cloudRestore([SAVE_KEY, ...ownMapIds().map(ownSaveKey)]); // fetch the cloud saves (the main one, and each map's own) while the art generates
    Promise.all([loadGroup(this, 'core', (p, name) => draw(p, name), 14), restored]).then(() => {
      console.log(`[boot] core art generated in ${Math.round(performance.now() - t0)}ms`);
      draw(1);
      this.time.delayedCall(150, () => this.scene.start('Title'));
    });
  }
}
