import Phaser from 'phaser';
import { HEROES as ALL_HEROES } from '../gfx/heroes.js';
// Starting heroes: the core three plus Wren. Kesh, Oake and Gizmo are met
// and recruited out in the world (The Pit, Excessive Optimism, The Water Wheel).
const STARTERS = ['brann', 'pip', 'sable', 'wren'];
const HEROES = ALL_HEROES.filter((h) => STARTERS.includes(h.id));
import { HERO_STATS, SKILLS } from '../game/units.js';
import { audio } from '../audio/synth.js';
import { newState, loadState, clearSave, newSkillState, skillDef } from '../game/state.js';
import { cloudStatus } from '../game/cloudsave.js';
import { dungeonStart } from '../game/dungeon.js';
import { mapDef } from '../world/content.js';
import { makeItem, tierForLevel } from '../game/itemgen.js';

// Title + "choose your starting hero" (the other two join as first recruits).
export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    // a deep link (?demo=combat | boss | explore), e.g. for the developer
    // guide's embeds: straight into a ready-made sandbox that never saves
    // ?map=<id> opens a test map from src/data/maps the same way (no waves)
    const q = new URLSearchParams(location.search), demo = q.get('demo') || (q.get('map') && 'map');
    if (demo && !Title.demoStarted) { Title.demoStarted = true; this.time.delayedCall(30, () => this.startDemo(demo, q.get('map'))); }
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
    this.add.bitmapText(W / 2, 42, 'fontPlain', `BUILD ${typeof __BUILD__ === 'string' ? __BUILD__ : 'DEV'}`.toUpperCase()).setOrigin(0.5); // which build this is (a cached older one shows an older number)
    const save = loadState();
    if (save) this.saveMenu(save);
    else this.heroSelect();
    // the lab hint is for testing; the hero picker needs the room (its cards reach H - 24)
    if (save) this.add.bitmapText(W / 2, H - 10, 'fontPlain', 'OPEN /LAB.HTML FOR THE SPRITE + SOUND LAB').setOrigin(0.5).setAlpha(0.6);
    // whether this device can keep the save between visits (the Claude app wipes local storage)
    const cs = this.add.bitmapText(W / 2, save ? H - 20 : H - 10, 'fontPlain', '').setOrigin(0.5).setAlpha(0.6);
    const showCloud = () => cs.setText(`CLOUD SAVE: ${cloudStatus().toUpperCase().replace(/[^A-Z0-9 .,!?:/()-]/g, " ")}`);
    showCloud(); this.time.addEvent({ delay: 1000, loop: true, callback: showCloud });
    // The Vast: a generated world forty times Aldermere's size, for profiling
    // load times and frame rates, with a ready-made party. Never saves. (The
    // Dungeon Lab that used to sit here still opens via #dungeon or ?demo=boss.)
    // a framed button in the corner (the save menu adds a full-size one too),
    // kept clear of a landscape notch / rounded corner
    const lab = this.add.bitmapText(W - 34, 38, 'fontGold', 'THE VAST').setOrigin(1, 0).setDepth(1);
    const bx = lab.x - lab.width - 8, bw = lab.width + 16;
    const lg = this.add.graphics();
    const drawLab = (hot) => lg.clear().fillStyle(0x1a1423).fillRect(bx - 1, 31, bw + 2, 22).fillStyle(hot ? 0xf2c14e : 0x45405e).fillRect(bx, 32, bw, 20).fillStyle(0x2b2140).fillRect(bx + 1, 33, bw - 2, 18);
    drawLab(false);
    const lz = this.add.zone(bx, 31, bw, 22).setOrigin(0).setInteractive({ useHandCursor: true });
    lz.on('pointerover', () => drawLab(true)); lz.on('pointerout', () => drawLab(false));
    lz.on('pointerdown', () => this.startDemo('vast'));
    this.labLink = [lab, lg, lz];
    this.showLabLink(!save); // the save menu has its own full-size button
    if (location.hash === '#dungeon') this.time.delayedCall(300, () => this.enterLab());
  }

  showLabLink(on) {
    for (const o of this.labLink || []) { o.setVisible(on); if (o.input) o.input.enabled = on; }
  }

  // the Dungeon Lab: the real Undercroft with a ready-made party, starting at
  // its boss (and never saved)
  enterLab(id = 'undercroft') {
    if (this.leaving) return;
    this.leaving = true;
    audio.init(); audio.sfx('levelUp');
    const st = newState('brann');
    st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
    // geared a tier above level 5 (rare weapon + body, fine head + off-hand) so
    // the boss fight can be tested properly, plus party Elixirs
    for (const h of st.recruited) {
      const hs = st.heroes[h];
      hs.level = 5; hs.sp = (hs.sp || 0) + 4;
      for (const [slot, rarity] of [['weapon', 'rare'], ['body', 'rare'], ['head', 'fine'], ['offhand', 'fine']]) { const id = makeItem(h, slot, 2, rarity); if (id) hs.equip[slot] = id; }
    }
    st.potions.potion = 6; st.potions.elixir = 3;
    st.relics = ['tide']; // carried from Mistfen, so the Sealed Vault can be tried (normally a return visit)
    st.lab = id; st.labStart = 'boss';
    const p = dungeonStart(id, 'boss');
    st.pos = { x: p.x * 16 + 8, y: p.y * 16 + 8 };
    this.cameras.main.fadeOut(400, 10, 6, 20);
    this.time.delayedCall(420, () => this.enterWorld(st));
  }

  // The deep-link sandboxes. They never read or write the real save.
  startDemo(kind, mapId = null) {
    if (kind === 'boss') { this.enterLab('undercroft'); return; }
    if (kind === 'vast') { kind = 'map'; mapId ||= 'vast40'; } // the title's button: forty times Aldermere (?map=vast is ten)
    if (this.leaving) return;
    this.leaving = true;
    audio.init(); audio.sfx('levelUp');
    const st = newState('brann');
    st.recruited = ['brann', 'pip', 'sable']; st.active = [...st.recruited];
    const vast = kind === 'map' && /^vast/.test(mapId || '');
    const level = kind === 'combat' ? 8 : vast ? 12 : 6; // the Vast's bands run 1-30: level 12 suits its middle
    for (const h of st.recruited) {
      const hs = st.heroes[h];
      hs.level = level; hs.sp = (hs.sp || 0) + level - 1;
      for (const slot of ['weapon', 'body', 'head', 'offhand']) { const id = makeItem(h, slot, tierForLevel(level), 'fine'); if (id) hs.equip[slot] = id; }
    }
    st.potions.potion = 8; st.potions.elixir = 3;
    // the Vast has no Ward Stones to break: its land starts freed (no blight,
    // the freed music), and the party carries salves and tonics for the heat and cold
    if (vast) { Object.assign(st.flags, { wardBroken: true, ward_marsh: true, ward_gloam: true, ward_cinder: true, ward_frost: true }); st.potions.salve = 4; st.potions.tonic = 4; }
    st.demo = kind === 'combat' ? 'combat' : kind === 'map' ? 'map' : 'explore';
    // combat (and ?map=): a test map of its own (src/data/maps); explore: Brightwater
    st.map = kind === 'combat' ? 'arena' : kind === 'map' ? mapId : null;
    const md = st.map && mapDef(st.map);
    if (st.map && !md) { st.map = null; st.demo = 'explore'; } // no such map: Brightwater instead
    const at = md ? { x: md.at[0] + md.start[0], y: md.at[1] + md.start[1] } : { x: 15, y: 37 };
    st.demoAt = at;
    st.pos = { x: at.x * 16 + 8, y: at.y * 16 + 8 };
    this.enterWorld(st);
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
      this.showLabLink(true);
      this.heroSelect();
    });
    opt(144, 'THE VAST', 'A 40X WORLD FOR PROFILING - NOT SAVED', () => this.startDemo('vast'));
  }

  heroSelect() {
    const W = this.scale.width, H = this.scale.height;
    this.add.bitmapText(W / 2, 62, 'font', 'CHOOSE YOUR STARTING HERO').setOrigin(0.5);

    // centred for however many heroes there are, so none run off the edge
    const spacing = Math.min(100, (W - 16) / HEROES.length);
    const hw = Math.min(40, Math.floor(spacing / 2) - 2); // cards narrow as the roster grows
    const skillsFit = hw >= 40, ch = skillsFit ? 96 : 80; // narrow cards drop the skill list (it can't shrink and stay legible)
    HEROES.forEach((def, i) => {
      const x = Math.round(W / 2 + (i - (HEROES.length - 1) / 2) * spacing), y = 128;
      const card = this.add.graphics();
      const drawCard = (hot) => {
        card.clear();
        card.fillStyle(0x1a1423).fillRect(x - hw, y - 52, hw * 2, ch);
        card.fillStyle(hot ? 0xf2c14e : 0x45405e).fillRect(x - hw + 1, y - 51, hw * 2 - 2, ch - 2);
        card.fillStyle(0x2b2140).fillRect(x - hw + 2, y - 50, hw * 2 - 4, ch - 4);
        card.fillStyle(0x2f5d3a).fillRect(x - hw + 2, y - 4, hw * 2 - 4, 14);
      };
      drawCard(false);
      this.add.image(x + 1, y + 2, 'shadow').setAlpha(0.3).setScale(2);
      const s = this.add.sprite(x, y, def.id).setOrigin(0.5, 0.75).setScale(2).play(`${def.id}_idle_down`);
      const fit = (t) => { if (t.width > hw * 2 - 4) t.setScale((hw * 2 - 4) / t.width); return t; }; // text never spills past a narrow card
      fit(this.add.bitmapText(x, y + 14, 'fontGold', def.name.toUpperCase()).setOrigin(0.5));
      fit(this.add.bitmapText(x, y + 22, 'fontPlain', def.title.toUpperCase()).setOrigin(0.5));
      const st = HERO_STATS[def.id];
      if (skillsFit) this.add.bitmapText(x, y + 31, 'fontPlain', newSkillState(def.id).skills.active.filter(Boolean).map((k) => skillDef(k).name).join('\n')).setOrigin(0.5, 0).setCenterAlign();
      const z = this.add.zone(x - hw, y - 52, hw * 2, ch).setOrigin(0).setInteractive({ useHandCursor: true });
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
    window.__loadT0 = performance.now(); // the load timings count from here
    this.scene.launch('Loading');
    this.time.delayedCall(80, () => this.scene.start('Game', { state }));
  }
}
