import Phaser from 'phaser';
import { HEROES } from '../gfx/heroes.js';
import { HERO_STATS, SKILLS } from '../game/units.js';
import { audio } from '../audio/synth.js';
import { newState, loadState, clearSave, newSkillState, skillDef } from '../game/state.js';
import { dungeonStart } from '../game/dungeon.js';

// Title + "choose your starting hero" (the other two join as first recruits).
export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    // night sky gradient bands (dithered look via stepped bands)
    const bands = [0x16121f, 0x1d1729, 0x241c33, 0x2b2140, 0x33264a];
    bands.forEach((c, i) => g.fillStyle(c).fillRect(0, (H * i) / bands.length, W, H / bands.length + 1));
    for (let i = 0; i < 70; i++) g.fillStyle(i % 7 ? 0x6e6a87 : 0xd8d3e0).fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H * 0.6), 1, 1);
    // distant hills
    g.fillStyle(0x1f4630);
    for (let x = 0; x < W; x++) { const h = 30 + Math.sin(x / 23) * 6 + Math.sin(x / 9) * 2; g.fillRect(x, H - h, 1, h); }
    g.fillStyle(0x2f5d3a);
    for (let x = 0; x < W; x++) { const h = 18 + Math.sin(x / 31 + 2) * 5; g.fillRect(x, H - h, 1, h); }
    // the Ninth Tower on the horizon
    const tx = Math.round(W * 0.78), base = H - 34;
    g.fillStyle(0x110c18);
    for (let y = 0; y < 90; y++) { const w = 4 + Math.floor(y / 9); g.fillRect(tx - w, base - 90 + y, w * 2, 1); }
    g.fillRect(tx - 9, base - 64, 18, 4); g.fillRect(tx - 7, base - 40, 14, 3);
    const glow = this.add.circle(tx, base - 94, 7, 0xb24ce6, 0.8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scale: 1.6, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1 });
    this.add.circle(tx, base - 94, 2, 0xe7a6ff);

    this.add.bitmapText(W / 2, 22, 'fontGold', 'THE NINTH TOWER').setOrigin(0.5).setScale(3);
    this.add.bitmapText(W / 2, 42, 'fontPlain', 'WAVE 1 PREVIEW').setOrigin(0.5);
    const save = loadState();
    if (save) this.saveMenu(save);
    else this.heroSelect();
    this.add.bitmapText(W / 2, H - 10, 'fontPlain', 'OPEN /LAB.HTML FOR THE SPRITE + SOUND LAB').setOrigin(0.5).setAlpha(0.6);
    // Dungeon lab: try a test dungeon with a ready-made party. Never saves,
    // so it can't touch the real game. (Also opens straight away via #dungeon.)
    const lab = this.add.bitmapText(W - 30, 10, 'fontGold', 'DUNGEON LAB >').setOrigin(1, 0); // clear of a landscape notch / rounded corner
    const lz = this.add.zone(lab.x - lab.width - 6, 2, lab.width + 12, 20).setOrigin(0).setInteractive({ useHandCursor: true });
    lz.on('pointerdown', () => this.enterLab());
    if (location.hash === '#dungeon') this.time.delayedCall(300, () => this.enterLab());
  }

  enterLab(id = 'labUndercroft') {
    if (this.leaving) return;
    this.leaving = true;
    audio.init(); audio.sfx('levelUp');
    const st = newState('brann');
    st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
    for (const h of st.recruited) { st.heroes[h].level = 5; st.heroes[h].sp = (st.heroes[h].sp || 0) + 4; }
    st.potions.potion = 4;
    st.relics = ['tide']; // carried from Mistfen, so the Sealed Vault can be tried (normally a return visit)
    st.lab = id;
    const p = dungeonStart(id);
    st.pos = { x: p.x * 16 + 8, y: p.y * 16 + 8 };
    this.cameras.main.fadeOut(400, 10, 6, 20);
    this.time.delayedCall(420, () => this.enterWorld(st));
  }

  saveMenu(save) {
    const W = this.scale.width;
    const objs = [];
    const lead = save.heroes[save.leader];
    const mins = Math.floor(save.playTime / 60);
    const bw = Math.min(180, W - 16), bh = bw / 2;
    const opt = (y, label, sub, fn) => {
      const g = this.add.graphics();
      const draw = (hot) => { g.clear().fillStyle(0x1a1423).fillRect(W / 2 - bh - 1, y - 1, bw + 2, 26).fillStyle(hot ? 0xf2c14e : 0x45405e).fillRect(W / 2 - bh, y, bw, 24).fillStyle(0x2b2140).fillRect(W / 2 - bh + 1, y + 1, bw - 2, 22); };
      draw(false);
      const t1 = this.add.bitmapText(W / 2, y + 7, 'fontGold', label).setOrigin(0.5);
      const t2 = this.add.bitmapText(W / 2, y + 16, 'fontPlain', sub).setOrigin(0.5);
      if (t2.width > bw - 6) t2.setScale((bw - 6) / t2.width); // never spill past the button
      const z = this.add.zone(W / 2 - bh, y, bw, 24).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => draw(true)); z.on('pointerout', () => draw(false));
      z.on('pointerdown', fn);
      objs.push(g, t1, t2, z);
    };
    opt(80, 'CONTINUE', `${save.leader.toUpperCase()} LV${lead.level} - ${save.recruited.length} HEROES - ${mins}M`, () => {
      audio.init(); audio.sfx('levelUp');
      this.cameras.main.fadeOut(500, 10, 6, 20);
      this.time.delayedCall(520, () => this.enterWorld(save));
    });
    opt(112, 'NEW GAME', 'START OVER', () => {
      audio.init(); audio.sfx('click');
      for (const o of objs) o.destroy();
      this.heroSelect();
    });
  }

  heroSelect() {
    const W = this.scale.width, H = this.scale.height;
    this.add.bitmapText(W / 2, 62, 'font', 'CHOOSE YOUR STARTING HERO').setOrigin(0.5);

    const spacing = Math.min(100, W / 3.3);
    HEROES.forEach((def, i) => {
      const x = Math.round(W / 2 + (i - 1) * spacing), y = 128;
      const card = this.add.graphics();
      const drawCard = (hot) => {
        card.clear();
        card.fillStyle(0x1a1423).fillRect(x - 40, y - 52, 80, 96);
        card.fillStyle(hot ? 0xf2c14e : 0x45405e).fillRect(x - 39, y - 51, 78, 94);
        card.fillStyle(0x2b2140).fillRect(x - 38, y - 50, 76, 92);
        card.fillStyle(0x2f5d3a).fillRect(x - 38, y - 4, 76, 14);
      };
      drawCard(false);
      this.add.image(x + 1, y + 2, 'shadow').setAlpha(0.3).setScale(2);
      const s = this.add.sprite(x, y, def.id).setOrigin(0.5, 0.75).setScale(2).play(`${def.id}_idle_down`);
      this.add.bitmapText(x, y + 14, 'fontGold', def.name.toUpperCase()).setOrigin(0.5);
      this.add.bitmapText(x, y + 22, 'fontPlain', def.title.toUpperCase()).setOrigin(0.5);
      const st = HERO_STATS[def.id];
      this.add.bitmapText(x, y + 31, 'fontPlain', newSkillState(def.id).skills.active.filter(Boolean).map((k) => skillDef(k).name).join('\n')).setOrigin(0.5, 0).setScale(1).setCenterAlign();
      const z = this.add.zone(x - 40, y - 52, 80, 96).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { drawCard(true); s.play(`${def.id}_walk_down`); });
      z.on('pointerout', () => { drawCard(false); s.play(`${def.id}_idle_down`); });
      z.on('pointerdown', () => {
        audio.init();
        audio.sfx('levelUp');
        s.play(`${def.id}_attack_down`);
        this.cameras.main.fadeOut(500, 10, 6, 20);
        this.time.delayedCall(520, () => { clearSave(); this.enterWorld(newState(def.id)); });
      });
      void st;
    });
  }

  // Put the loading curtain up first and give it a frame to draw, because
  // building the Game scene blocks the main thread for a moment.
  enterWorld(state) {
    this.scene.launch('Loading');
    this.time.delayedCall(80, () => this.scene.start('Game', { state }));
  }
}
