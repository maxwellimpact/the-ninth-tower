// Asset registry. All art is generated, so "loading" = running generator
// tasks. Tasks are grouped: `core` runs behind the boot progress bar; biome
// groups run lazily (time-sliced) when the party approaches that biome, which
// is how a much larger world stays within memory and startup budgets.
import { HEROES, GOBLIN, ARCHER, KNIGHT, MARLA, BRUNO, FOLK, HOLLOW, WARLOCK, DROWNED, WITCHLING, SHADE, BANSHEE, HUNTSMAN, SALAMANDER, VULK, WRAITH, ISOLDE, WARDEN, MALGRIM, malgrimRecolor, ghostRecolor, paleRecolor, scaleRecolor, iceRecolor, rimeRecolor } from '../gfx/heroes.js';
import * as Q from '../gfx/questart.js';
import * as DG from '../gfx/dungeonart.js';
import * as PORTAL from '../gfx/portal.js';
import { buildHexling, buildFrogKing, buildGolem, boulder, portraitFrom, MIRE_TONES, buildRats, hollowPile, golemPlate, buildBoar, buildCrab, buildWisp, buildLeeches, buildLurker, buildCroaker, buildSnapjaw, buildMurk, buildRootling, buildSpider, buildMab, eggSac, buildHound, buildImp, buildSlug, buildBrute, buildBeetle, buildDrake, buildWolf, buildRimehorn, buildSentinel, buildRaider, buildTroll, buildVoidling, buildGargoyle, buildTurret, buildBot, buildClank } from '../gfx/creatures.js';
import * as P from '../gfx/props.js';
import { registerFont } from '../gfx/font.js';
import { buildIcons } from '../gfx/icons.js';
import { itemIcon } from '../gfx/gear.js';
import items from '../data/items.json';
import { packFrames, registerPuppet } from './bake.js';

const frames = (scene, key, list, rate, repeat = -1) => {
  packFrames(scene, key, list.map((canvas, i) => ({ name: `${i}`, canvas })));
  scene.anims.create({ key, frames: list.map((_, i) => ({ key, frame: `${i}` })), frameRate: rate, repeat });
};

function creature(scene, key, fr, rates, loops) {
  const list = [];
  for (const [a, fs] of Object.entries(fr)) fs.forEach((canvas, i) => list.push({ name: `${a}_${i}`, canvas }));
  packFrames(scene, key, list);
  for (const [a, fs] of Object.entries(fr)) {
    scene.anims.create({ key: `${key}_${a}`, frames: fs.map((_, i) => ({ key, frame: `${a}_${i}` })), frameRate: rates[a] || 6, repeat: loops.includes(a) ? -1 : 0 });
  }
}

const HEX_RATES = { idle: 3, walk: 8, windup: 8, attack: 10, hurt: 1 };

export const GROUPS = {
  core: [
    ['fonts', (s) => { registerFont(s, 'font'); registerFont(s, 'fontGold', 'goldL', 'ink'); registerFont(s, 'fontPlain', 'bone', null); }],
    ...HEROES.map((def) => [`hero ${def.name}`, (s) => registerPuppet(s, def.id, def)]),
    ['goblin', (s) => registerPuppet(s, 'goblin', GOBLIN)],
    ['goblin archer', (s) => registerPuppet(s, 'archer', ARCHER)],
    ['hex knight', (s) => registerPuppet(s, 'knight', KNIGHT)],
    ['hexling', (s) => creature(s, 'hexling', buildHexling(), HEX_RATES, ['idle', 'walk', 'windup'])],
    ['hex golem', (s) => {
      creature(s, 'golem', buildGolem(), { idle: 2.5, walk: 5, windup: 4, slam: 8, throw: 6, hurt: 1 }, ['idle', 'walk', 'windup']);
      s.textures.addCanvas('boulder', boulder());
      s.textures.addCanvas('plate', golemPlate());
    }],
    ['frog king', (s) => {
      const frog = buildFrogKing();
      packFrames(s, 'frog', frog.idle.map((canvas, i) => ({ name: `idle_${i}`, canvas })));
      s.anims.create({ key: 'frog_idle', frames: [0, 1, 0, 2, 0].map((i) => ({ key: 'frog', frame: `idle_${i}` })), frameRate: 2.5, repeat: -1 });
      s.textures.addCanvas('portrait_frog', portraitFrom(frog.idle[0], 8, 12, 16));
    }],
    ['trees', (s) => { for (let k = 0; k < 8; k++) s.textures.addCanvas(`tree${k}`, P.tree(k)); }],
    ['shrubs & rocks', (s) => {
      for (let k = 0; k < 4; k++) {
        s.textures.addCanvas(`bush${k}`, P.bush(k, false)); s.textures.addCanvas(`bushB${k}`, P.bush(k, true));
        s.textures.addCanvas(`rock${k}`, P.rock(k, false)); s.textures.addCanvas(`rockB${k}`, P.rock(k, true));
      }
    }],
    ['grass', (s) => {
      for (let k = 0; k < 4; k++) {
        packFrames(s, `tuft${k}`, P.grassTuft(k).map((canvas, i) => ({ name: `${i}`, canvas })));
        s.anims.create({ key: `tuft${k}`, frames: [0, 1, 2, 1].map((i) => ({ key: `tuft${k}`, frame: `${i}` })), frameRate: 2 + k * 0.3, repeat: -1 });
      }
      for (let k = 0; k < 6; k++) s.textures.addCanvas(`flowers${k}`, P.flowerPatch(k));
      for (let k = 0; k < 3; k++) s.textures.addCanvas(`lily${k}`, P.lilyPad(k));
    }],
    ['landmarks', (s) => {
      frames(s, 'campfire', P.campfire(), 8);
      frames(s, 'ward', P.wardStone(), 5);
      s.textures.addCanvas('wardRubble', P.wardRubble());
      s.textures.addCanvas('pillar', P.pillar(false));
      s.textures.addCanvas('pillarBroken', P.pillar(true));
      s.textures.addCanvas('sign', P.signpost());
      s.textures.addCanvas('barrel', P.barrel());
      s.textures.addCanvas('chest', P.chest(false));
      s.textures.addCanvas('chestOpen', P.chest(true));
      s.textures.addCanvas('cistern', P.cisternCrack(false)); s.textures.addCanvas('cisternDived', P.cisternCrack(true));
      s.textures.addCanvas('post', P.grapplePost());
      s.textures.addCanvas('clawmarks', P.clawMarks());
      s.textures.addCanvas('iceblock', P.iceBlock());
      s.textures.addCanvas('house_spire', P.rimeSpire());
      s.textures.addCanvas('house_tower', P.ninthTower());
      s.textures.addCanvas('house_towerRuin', P.towerRuin());
      s.textures.addCanvas('iceplat', P.icePlatform());
      frames(s, 'windvent', P.windVent(), 6);
      s.textures.addCanvas('icewall', P.iceWall());
      s.textures.addCanvas('house_shop', P.house('shop'));
      s.textures.addCanvas('house_tavern', P.house('tavern'));
      s.textures.addCanvas('house_mill', P.mill());
      for (const k of ['curio', 'archery', 'bath', 'mayor']) { s.textures.addCanvas(`house_${k}`, P.house(k)); s.textures.addCanvas(`house_${k}_shut`, P.house(k, true)); }
      s.textures.addCanvas('strawbutt', P.strawButt());
      [[64, 40], [80, 48], [56, 34], [72, 44], [96, 56], [48, 30]].forEach(([w, h], k) => s.textures.addCanvas(`blight${k}`, P.blightPatch(k * 7 + 3, w, h)));
      frames(s, 'millwheel', P.millWheel(), 7);
      s.textures.addCanvas('house_elder', P.elderTree());
      for (let k = 0; k < 3; k++) s.textures.addCanvas(`tent${k}`, P.tent(k));
      s.textures.addCanvas('house_forgegate', P.forgeGate());
      s.textures.addCanvas('house_colosseum', P.colosseum());
      s.textures.addCanvas('boulder_cracked', P.crackedBoulder());
      s.textures.addCanvas('wall_cracked', P.crackedWall());
      frames(s, 'fly', P.goldenFly(), 8);
      s.textures.addCanvas('ore', P.oreNode(false));
      s.textures.addCanvas('ore_used', P.oreNode(true));
      s.textures.addCanvas('arrow', P.arrow());
    }],
    ['effects', (s) => {
      frames(s, 'coin', P.coin(), 10);
      frames(s, 'firebolt', P.fireBolt(), 14);
      frames(s, 'hitstar', P.hitStar(), 24, 0);
      frames(s, 'dust', P.dustPuff(), 14, 0);
      frames(s, 'lootC', P.lootBag('bone'), 3); frames(s, 'lootF', P.lootBag('grassXL'), 3); frames(s, 'lootU', P.lootBag('goldL'), 3);
      s.textures.addCanvas('shadow', P.shadow(14, 5));
      s.textures.addCanvas('shadowL', P.shadow(24, 7));
      s.textures.addCanvas('shadowXL', P.shadow(40, 10));
      s.textures.addCanvas('spark', P.sparkle('white', 2));
      s.textures.addCanvas('sparkGold', P.sparkle('goldL', 2));
      s.textures.addCanvas('sparkCurse', P.sparkle('curseL', 2));
      s.textures.addCanvas('sparkGreen', P.sparkle('grassXL', 2));
      for (const c of ['white', 'fire', 'fireL', 'red', 'curse', 'curseL', 'goldL', 'grassXL', 'foam', 'bone', 'blueL', 'purpL', 'mist', 'steelL', 'ink']) s.textures.addCanvas(`px_${c}`, P.dot(c, 1));
      for (const c of ['fire', 'fireL', 'curseL', 'mist', 'goldL']) s.textures.addCanvas(`px2_${c}`, P.dot(c, 2));
      s.textures.addCanvas('ringGold', P.ring(8, 'goldL'));
      s.textures.addCanvas('ringRed', P.ring(8, 'redL'));
      s.textures.addCanvas('ringWhite', P.ring(8, 'white'));
      s.textures.addCanvas('ringBlue', P.ring(8, 'blueL'));
      s.textures.addCanvas('glow', P.glow(16));
      s.textures.addCanvas('bubble', P.bubble());
      s.textures.addCanvas('orb', P.orb());
      for (const k of ['shop', 'tavern', 'curio', 'archery', 'bath', 'mayor']) s.textures.addCanvas(`door_open_${k}`, P.houseDoorOpen(k));
      s.textures.addCanvas('idoor', P.interiorDoor(false));
      s.textures.addCanvas('idoor_open', P.interiorDoor(true));
    }],
    ['icons', (s) => {
      buildIcons(s);
      for (const [id, it] of Object.entries(items)) s.textures.addCanvas(`item_${id}`, itemIcon(it.hero, it.slot, it.look));
    }],
  ],
  marsh: [
    ['fen foes', (s) => {
      creature(s, 'leeches', buildLeeches(), { idle: 4, walk: 12, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'lurker', buildLurker(), { idle: 2, walk: 3, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'croaker', buildCroaker(), { idle: 2, walk: 6, windup: 6, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'snapjaw', buildSnapjaw(), { idle: 2, walk: 5, windup: 6, attack: 8, hurt: 1, flipped: 5 }, ['idle', 'walk', 'windup', 'flipped']);
      creature(s, 'murk', buildMurk(), { idle: 2.5, walk: 4, windup: 5, slam: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      registerPuppet(s, 'drowned', DROWNED);
      registerPuppet(s, 'witchling', WITCHLING);
    }],
    ['mire slime', (s) => creature(s, 'mire', buildHexling(MIRE_TONES, 'goldL'), HEX_RATES, ['idle', 'walk', 'windup'])],
    ['dead trees', (s) => { for (let k = 0; k < 8; k++) s.textures.addCanvas(`deadtree${k}`, P.deadTree(k)); }],
    ['reeds', (s) => {
      for (let k = 0; k < 4; k++) {
        packFrames(s, `reeds${k}`, P.reeds(k).map((canvas, i) => ({ name: `${i}`, canvas })));
        s.anims.create({ key: `reeds${k}`, frames: [0, 1, 2, 1].map((i) => ({ key: `reeds${k}`, frame: `${i}` })), frameRate: 1.6 + k * 0.3, repeat: -1 });
      }
    }],
    ['mushrooms', (s) => { for (let k = 0; k < 4; k++) s.textures.addCanvas(`mushrooms${k}`, P.mushrooms(k)); }],
  ],
  // Gloamwood (Wave 2)
  gloam: [
    ['gloam foes', (s) => {
      registerPuppet(s, 'shade', SHADE);
      creature(s, 'rootling', buildRootling(), { idle: 2, walk: 2, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'spider', buildSpider(1), { idle: 3, walk: 12, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'spiderling', buildSpider(0.6), { idle: 3, walk: 14, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'hound', buildHound(), { idle: 3, walk: 12, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      registerPuppet(s, 'banshee', BANSHEE, ghostRecolor);
      registerPuppet(s, 'huntsman', HUNTSMAN, paleRecolor);
      creature(s, 'mab', buildMab(), { idle: 2, walk: 9, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      s.textures.addCanvas('eggsac', eggSac());
    }],
    ['gloomtrees', (s) => { for (let k = 0; k < 6; k++) s.textures.addCanvas(`gloomtree${k}`, P.gloomTree(k)); }],
    ['undergrowth', (s) => {
      for (let k = 0; k < 4; k++) {
        packFrames(s, `fern${k}`, P.fern(k).map((canvas, i) => ({ name: `${i}`, canvas })));
        s.anims.create({ key: `fern${k}`, frames: [0, 1, 2, 1].map((i) => ({ key: `fern${k}`, frame: `${i}` })), frameRate: 1.2 + k * 0.25, repeat: -1 });
        frames(s, `glowcap${k}`, P.glowcap(k), 1.4 + k * 0.2);
        s.textures.addCanvas(`stump${k}`, P.stump(k));
        s.textures.addCanvas(`web${k}`, P.web(k));
      }
    }],
  ],
  // Cinderreach (Wave 2)
  cinder: [
    ['cinder foes', (s) => {
      creature(s, 'imp', buildImp(), { idle: 4, walk: 8, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'slug', buildSlug(), { idle: 2, walk: 5, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'brute', buildBrute(false), { idle: 2, walk: 5, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'bruteCracked', buildBrute(true), { idle: 2, walk: 5, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'beetle', buildBeetle(), { idle: 4, walk: 12, windup: 10, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'drake', buildDrake(), { idle: 2, walk: 6, windup: 6, attack: 8, fly: 6, hurt: 1 }, ['idle', 'walk', 'windup', 'fly']);
      registerPuppet(s, 'salamander', SALAMANDER, scaleRecolor);
      registerPuppet(s, 'vulk', VULK, scaleRecolor);
    }],
    ['badlands', (s) => {
      for (let k = 0; k < 6; k++) s.textures.addCanvas(`ashtree${k}`, P.ashTree(k));
      for (let k = 0; k < 4; k++) {
        s.textures.addCanvas(`obsidian${k}`, P.obsidian(k)); s.textures.addCanvas(`obsidianB${k}`, P.obsidian(k, true));
        frames(s, `vent${k}`, P.vent(k), 2 + k * 0.3);
        s.textures.addCanvas(`emberbloom${k}`, P.emberbloom(k)); s.textures.addCanvas(`cinders${k}`, P.cinders(k));
      }
    }],
  ],
  // Frosthelm (Wave 3)
  frost: [
    ['frost foes', (s) => {
      creature(s, 'frostwolf', buildWolf(), { idle: 2, walk: 9, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'rimehorn', buildRimehorn(), { idle: 2, walk: 5, windup: 6, attack: 8, throw: 6, hurt: 1 }, ['idle', 'walk', 'windup', 'throw']);
      creature(s, 'sentinel', buildSentinel(), { idle: 2, walk: 2, windup: 8, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'raider', buildRaider(), { idle: 4, walk: 8, windup: 6, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'troll', buildTroll(), { idle: 2, walk: 5, windup: 4, attack: 8, hurt: 1 }, ['idle', 'walk', 'windup']);
      registerPuppet(s, 'icewraith', WRAITH, iceRecolor);
      registerPuppet(s, 'isolde', ISOLDE, rimeRecolor);
    }],
    ['highlands', (s) => {
      for (let k = 0; k < 6; k++) s.textures.addCanvas(`snowpine${k}`, P.snowPine(k));
      for (let k = 0; k < 4; k++) {
        s.textures.addCanvas(`rimeglass${k}`, P.rimeglass(k)); s.textures.addCanvas(`rimeglassB${k}`, P.rimeglass(k, true));
        s.textures.addCanvas(`snowrock${k}`, P.snowRock(k)); s.textures.addCanvas(`snowrockB${k}`, P.snowRock(k, true));
        s.textures.addCanvas(`drift${k}`, P.snowDrift(k)); s.textures.addCanvas(`snowtuft${k}`, P.snowTuft(k));
      }
      for (let k = 0; k < 3; k++) s.textures.addCanvas(`furtent${k}`, P.furTent(k));
    }],
  ],
  // the Blight Basin (Wave 3)
  basin: [
    ['basin foes', (s) => {
      creature(s, 'voidling', buildVoidling(), { idle: 4, walk: 8, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      creature(s, 'gargoyle', buildGargoyle(), { idle: 1, walk: 8, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
      registerPuppet(s, 'chainwarden', WARDEN);
      registerPuppet(s, 'malgrim', MALGRIM, malgrimRecolor);
    }],
    ['blight', (s) => {
      for (let k = 0; k < 4; k++) { s.textures.addCanvas(`hexcrystal${k}`, P.hexCrystal(k)); s.textures.addCanvas(`hexcrystalB${k}`, P.hexCrystal(k, true)); s.textures.addCanvas(`bones${k}`, P.bones(k)); }
    }],
  ],
  interior: [
    ['furniture', (s) => {
      s.textures.addCanvas('counter', P.counter());
      s.textures.addCanvas('shelf', P.shelf());
      s.textures.addCanvas('table', P.table());
      s.textures.addCanvas('rug', P.rug());
      s.textures.addCanvas('whackboard', P.whackBoard());
      frames(s, 'fireplace', P.fireplace(), 7);
    }],
    ['townsfolk', (s) => { registerPuppet(s, 'marla', MARLA); registerPuppet(s, 'bruno', BRUNO); }],
  ],
  cave: [
    ['stalagmites', (s) => { for (let k = 0; k < 4; k++) s.textures.addCanvas(`stalagmite${k}`, P.stalagmite(k)); }],
    ['crystals', (s) => { for (let k = 0; k < 3; k++) frames(s, `crystal${k}`, P.crystal(k), 3); }],
    ['light', (s) => s.textures.addCanvas('lightShaft', P.lightShaft())],
  ],
};
// errand townsfolk + props are small and needed across the Vale, so they ride with core
GROUPS.core.push(
  ['gadgets', (s) => {
    creature(s, 'gadget_turret', buildTurret(), { idle: 1, attack: 12 }, ['idle']);
    creature(s, 'gadget_bot', buildBot(), { idle: 12 }, ['idle']);
    creature(s, 'gadget_clank', buildClank(), { idle: 2, walk: 6, attack: 8 }, ['idle', 'walk']);
  }],
  ['herbs', (s) => { frames(s, 'herb', P.herbNode(false), 2); s.textures.addCanvas('herb_used', P.herbNode(true)[0]); }],
  ['vale foes', (s) => {
    creature(s, 'boar', buildBoar(), { idle: 2, walk: 8, windup: 10, attack: 12, hurt: 1 }, ['idle', 'walk', 'windup']);
    creature(s, 'crab', buildCrab(), { idle: 2, walk: 9, windup: 6, attack: 10, hurt: 1, flipped: 6 }, ['idle', 'walk', 'windup', 'flipped']);
    creature(s, 'wisp', buildWisp(), { idle: 6, walk: 8, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
    registerPuppet(s, 'warlock', WARLOCK);
  }],
  ['undercroft foes', (s) => {
    creature(s, 'rats', buildRats(), { idle: 4, walk: 12, windup: 8, attack: 10, hurt: 1 }, ['idle', 'walk', 'windup']);
    registerPuppet(s, 'hollow', HOLLOW);
    s.textures.addCanvas('hollowpile', hollowPile());
  }],
  ...Object.entries(FOLK).map(([id, def]) => [`folk ${id}`, (s) => registerPuppet(s, id, def)]),
  ['errand props', (s) => {
    frames(s, 'dog', Q.dogFrames(), 4);
    s.anims.create({ key: 'dog_sit', frames: [0, 1].map((i) => ({ key: 'dog', frame: `${i}` })), frameRate: 2, repeat: -1 });
    s.anims.create({ key: 'dog_run', frames: [2, 3].map((i) => ({ key: 'dog', frame: `${i}` })), frameRate: 8, repeat: -1 });
    frames(s, 'glint', Q.glintFrames(), 5);
    s.textures.addCanvas('bell', Q.bell()); s.textures.addCanvas('bellRung', Q.bell(true));
    for (const g of ['eye', 'sun', 'moon', 'star']) { s.textures.addCanvas(`rune_${g}`, Q.runeStone(g)); s.textures.addCanvas(`rune_${g}_lit`, Q.runeStone(g, true)); }
    frames(s, 'cart', Q.cartFrames('side'), 6); frames(s, 'cartDown', Q.cartFrames('down'), 6); frames(s, 'cartUp', Q.cartFrames('up'), 6);
    s.textures.addCanvas('board', Q.noticeBoard());
    s.textures.addCanvas('forge', Q.forge());
    s.textures.addCanvas('shrine', Q.shrine(true)); s.textures.addCanvas('shrineUsed', Q.shrine(false));
    s.textures.addCanvas('lookout', Q.lookout());
    s.textures.addCanvas('lookoutFront', Q.lookoutFront());
    s.textures.addCanvas('lorePage', Q.lorePage());
    frames(s, 'hawk', Q.hawkFrames(), 10);
    s.textures.addCanvas('snare', Q.snareTrap());
    s.textures.addCanvas('cage', Q.cage()); s.textures.addCanvas('net', Q.net());
    s.textures.addCanvas('stairsDown', Q.stairsDown());
    // dungeon kit pieces
    s.textures.addCanvas('dgBlock', DG.pushBlock());
    s.textures.addCanvas('dgWater', DG.waterTile()); s.textures.addCanvas('dgLever_A', DG.lever('A')); s.textures.addCanvas('dgLever_B', DG.lever('B'));
    for (const k of ['key', 'seal', 'map', 'compass']) s.textures.addCanvas(`dgIcon_${k}`, DG.dungeonIcon(k));
    s.textures.addCanvas('dgPlate', DG.plate(false)); s.textures.addCanvas('dgPlateDown', DG.plate(true));
    for (const col of ['blue', 'red']) { s.textures.addCanvas(`dgCrystal_${col}`, DG.crystal(col)); s.textures.addCanvas(`dgPeg_${col}_up`, DG.peg(col, true)); s.textures.addCanvas(`dgPeg_${col}_down`, DG.peg(col, false)); }
    s.textures.addCanvas('dgCrackFace', DG.crackedWall(true)); s.textures.addCanvas('dgCrackTop', DG.crackedWall(false));
    s.textures.addCanvas('dgBrazier', DG.brazier(false)); frames(s, 'dgBrazierLit', [0, 1, 2].map((f) => DG.brazier(true, f)), 9);
    frames(s, 'dgFalseWall', [0, 1].map((f) => DG.falseWall(f)), 3); s.textures.addCanvas('dgSpiritBridge', DG.spiritBridge());
    s.textures.addCanvas('dgBoulder', DG.heavyBoulder()); s.textures.addCanvas('dgBoulderSunk', DG.sunkBoulder());
    s.textures.addCanvas('dgReinforcedFace', DG.reinforcedWall(true)); s.textures.addCanvas('dgReinforcedTop', DG.reinforcedWall(false));
    for (const k of ['shutter', 'key', 'boss', 'vault']) for (const v of [false, true]) { s.textures.addCanvas(`dgDoor_${k}_${v ? 'v' : 'h'}`, DG.door(k, v)); s.textures.addCanvas(`dgDoor_${k}_${v ? 'v' : 'h'}_open`, DG.door(k, v, true)); }
    s.textures.addCanvas('markQ', Q.questMark('!')); s.textures.addCanvas('markA', Q.questMark('?'));
    frames(s, 'portal', PORTAL.portal(), 10); frames(s, 'portalMark', PORTAL.portalMark(), 8); // the Ferryman's portal and the sign over his head
  }],
);

// Yield between task slices. MessageChannel isn't clamped/throttled like
// setTimeout, so background loading doesn't stall when the tab is hidden.
const chan = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
const queue = [];
if (chan) chan.port1.onmessage = () => queue.shift()?.();
const nextTick = (fn) => { if (chan) { queue.push(fn); chan.port2.postMessage(0); } else setTimeout(fn, 0); };

export const loaded = new Set();
const inflight = new Map();
const progress = {}; // group -> index of next task (shared by async + sync loaders)
export const assetStats = { lastGroupMs: {}, log: [] };

function finish(name, t0, how) {
  loaded.add(name);
  inflight.delete(name);
  assetStats.lastGroupMs[name] = Math.round(performance.now() - t0);
  assetStats.log.push(`${name} ${assetStats.lastGroupMs[name]}ms${how}`);
}

// Run a group's tasks time-sliced so the frame keeps rendering.
export function loadGroup(scene, name, onProgress, budgetMs = 12) {
  if (loaded.has(name)) return Promise.resolve();
  if (inflight.has(name)) return inflight.get(name);
  const tasks = GROUPS[name];
  const t0 = performance.now();
  progress[name] = progress[name] || 0;
  const p = new Promise((resolve) => {
    const step = () => {
      if (loaded.has(name)) { resolve(); return; } // finished synchronously meanwhile
      const start = performance.now();
      while (progress[name] < tasks.length && performance.now() - start < budgetMs) {
        tasks[progress[name]++][1](scene);
        onProgress?.(progress[name] / tasks.length, tasks[progress[name]]?.[0]);
      }
      if (progress[name] < tasks.length) nextTick(step);
      else { finish(name, t0, ''); resolve(); }
    };
    step();
  });
  inflight.set(name, p);
  return p;
}

// Synchronous fallback when content is needed right now.
export function loadGroupNow(scene, name) {
  if (loaded.has(name)) return;
  const t0 = performance.now();
  const tasks = GROUPS[name];
  progress[name] = progress[name] || 0;
  while (progress[name] < tasks.length) tasks[progress[name]++][1](scene);
  finish(name, t0, ' (sync)');
}
