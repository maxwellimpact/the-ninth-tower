// Hero + humanoid enemy definitions for the puppet renderer.
// Heroes come from data (src/data/heroes.json) composed with their equipped
// gear looks (gear.js). The goblin is a fixed puppet.
import heroData from '../data/heroes.json';
import items from '../data/items.json';
import { composeHero } from './gear.js';
import { hex } from './palette.js';
import { spearAttack, bowAttack } from './poses.js';

export const HERO_DATA = heroData;
export const ITEMS = items;

// equip: { slot: itemId } -> { slot: lookId }
export const looksOf = (equip) => Object.fromEntries(Object.entries(equip).map(([slot, id]) => [slot, id ? items[id].look : null]));

export function heroDef(id, equip) {
  const h = heroData.find((x) => x.id === id);
  return composeHero(id, looksOf(equip || h.equip), { name: h.name, title: h.title, voice: h.voice });
}

export const HEROES = heroData.map((h) => heroDef(h.id));
export const [BRANN, PIP, SABLE] = HEROES;

// ----------------------------------------------------------------- enemies

export const GOBLIN = {
  id: 'goblin',
  name: 'Goblin',
  map: {
    G: 'grass', g: 'grassD', L: 'grassL', Y: 'gold', E: 'ink', w: 'white',
    h: 'leatherD', H: 'leather', T: 'dirtD', t: 'woodD', r: 'red',
  },
  head: {
    down: [
      '...hHHh...',
      '..hHHHHh..',
      'LGgGGGGgGL',
      '.gGLGGGGg.',
      '..GYGGYG..',
      '..GGGGGG..',
      '...gwwg...',
    ],
    side: [
      '..hHHHh...',
      '.hHHHHHh..',
      'GgGGGGGG..',
      '.ggGGLGGG.',
      '..gGGGYGG.',
      '..gGGGGGG.',
      '...gGwwg..',
    ],
    up: [
      '...hHHh...',
      '..hHHHHh..',
      'LGhHHHHhGL',
      '.gGGGGGGg.',
      '..gGGGGg..',
      '..gGGGGg..',
      '...gggg...',
    ],
  },
  torso: {
    down: ['tTTTTTTt', 'tTrTTTTt', 'tTTTTrTt', '.tTTTTt.', '.hhhhhh.'],
    side: ['tTTTTt', 'tTTrTt', 'tTTTTt', '.tTTTt', '.hhhhh'],
    up: ['tTTTTTTt', 'tTTTTTTt', 'tTTrTTTt', '.tTTTTt.', '.hhhhhh.'],
  },
  legs: ['grassD', 'leafD', 'leatherD'],
  arms: ['grass', 'grassD', 'grassL'],
  weaponR: 'spear',
  idleAng: { down: -1.57, up: -1.57, side: -1.4 },
  attack: spearAttack,
  cast: (v) => spearAttack(v),
};


export const ARCHER = {
  ...GOBLIN,
  id: 'archer',
  name: 'Goblin Archer',
  map: { ...GOBLIN.map, h: 'leafD', H: 'leaf', T: 'mossD', t: 'mudD' },
  weaponR: 'bow',
  idleAng: { down: 1.2, up: -1.3, side: 0.7 },
  attack: bowAttack,
  cast: bowAttack,
};

export const KNIGHT = { ...composeHero('brann', { head: 'helm_hex', body: 'plate_hex', weapon: 'sword_dark', offhand: 'shield_hex' }), id: 'knight', name: 'Hex Knight' };
export const MARLA = { ...composeHero('pip', { head: 'kerchief', body: 'apron_blue', weapon: 'none', offhand: null }), id: 'marla', name: 'Marla' };
export const BRUNO = { ...composeHero('brann', { head: null, body: 'apron_brown', weapon: 'none', offhand: null }), id: 'bruno', name: 'Bruno' };

// Errand townsfolk: the hero puppet bases dressed in tier-recoloured looks.
const folk = (id, base, eq) => ({ ...composeHero(base, { weapon: 'none', offhand: null, head: null, ...eq }), id, name: id });
export const FOLK = {
  tam: folk('tam', 'brann', { body: 'apron_brown@3' }),
  ada: folk('ada', 'pip', { head: 'kerchief@4', body: 'apron_blue@2' }),
  piet: folk('piet', 'sable', { head: 'bandana_red@3', body: 'jacket_leather@2' }),
  hobb: folk('hobb', 'brann', { body: 'apron_brown@2' }),
  oswin: folk('oswin', 'brann', { head: 'helm_great', body: 'plate_guard', weapon: 'sword_long' }),
  quill: folk('quill', 'pip', { head: 'hat_star@2', body: 'robe_scholar@5' }),
  greta: folk('greta', 'brann', { head: 'kerchief@5', body: 'apron_brown', weapon: 'sword_iron@1' }),
  wick: folk('wick', 'pip', { head: 'hat_apprentice@2', body: 'robe_apprentice@3' }),
  orla: folk('orla', 'pip', { head: 'hat_star@4', body: 'robe_scholar@4' }),
  iren: folk('iren', 'sable', { head: 'bandana_red@5', body: 'leather_studded@4', weapon: 'sword_long@3' }),
  bard: folk('bard', 'pip', { head: 'hat_star@3', body: 'robe_scholar@2' }),
  margo: folk('margo', 'sable', { head: 'hood_shadow@2', body: 'jacket_leather@5', weapon: 'dagger_kris@4' }),
  // Gloamwood edge camp
  brisk: folk('brisk', 'wren', { head: 'hood_ranger@3', body: 'leathers_ranger@4', weapon: 'bow_long@2' }),
  rowan: folk('rowan', 'wren', { head: 'cap_ranger@5', body: 'leathers_scout@3', weapon: 'bow_hunting@4' }),
  fennel: folk('fennel', 'brann', { head: 'kerchief@2', body: 'apron_brown@4' }),
  hew: folk('hew', 'kesh', { head: 'warhelm_hide@2', body: 'furs_hide@3', weapon: 'axe_bearded@2' }),
  tansy: folk('tansy', 'sable', { head: 'hood_shadow@4', body: 'leathers_scout@2', weapon: 'dagger_steel@3' }),
  moss: folk('moss', 'pip', { head: 'hat_apprentice@4', body: 'robe_scholar@3' }),
  hermit: folk('hermit', 'oake', { head: 'hood_monk@5', body: 'robe_scholar@5', weapon: 'staff_oak@2' }), // the Arcane hermit
  tolly: folk('tolly', 'oake', { head: 'hood_monk@4', body: 'habit_monk@2' }), // the belfry's ghost ringer
  // Cinderreach: Emberwatch and St. Cinder's
  coal: folk('coal', 'kesh', { head: 'warhelm_hide@4', body: 'apron_brown@5' }),
  ignatius: folk('ignatius', 'pip', { head: 'hat_star@5', body: 'robe_phoenix@2' }),
  ember: folk('ember', 'pip', { head: 'kerchief@3', body: 'robe_apprentice@4' }),
  rook: folk('rook', 'brann', { head: 'helm_iron@2', body: 'jacket_leather@4' }),
  dusty: folk('dusty', 'kesh', { body: 'furs_hide@2' }),
  halloway: folk('halloway', 'brann', { head: 'helm_great@6', body: 'robe_scholar@6', weapon: 'sword_long@6' }), // master of the Trainers' Hall
  brew: folk('brew', 'pip', { head: 'kerchief@2', body: 'apron_blue@4' }), // the alchemist
  inka: folk('inka', 'wren', { head: 'cap_ranger@2', body: 'leathers_scout@5' }), // the cartographer
  vey: folk('vey', 'brann', { head: 'helm_iron@4', body: 'plate_guard@2', weapon: 'sword_iron@2' }), // Emberwatch's watch-captain
  tamsin: folk('tamsin', 'gizmo', { head: 'goggles_brass@2', body: 'apron_brown@5' }), // the Forgemaster's last apprentice
  // Frosthelm: Rimewatch
  hale: folk('hale', 'pip', { head: 'kerchief@5', body: 'furs_hide@4' }), // the tonic-brewer
  oda: folk('oda', 'brann', { head: 'helm_great@3', body: 'plate_guard@4', weapon: 'sword_long@4' }), // the Guardian trainer
  king: folk('king', 'brann', { head: 'helm_lion@6', body: 'robe_phoenix@6' }), // King Aldric, no longer a frog
  marek: folk('marek', 'brann', { head: 'helm_iron@1', body: 'plate_guard@1', weapon: 'sword_long@1' }), // the Basin's last watcher
  bjorna: folk('bjorna', 'brann', { head: 'kerchief@3', body: 'apron_brown@4' }), // the Rimewatch innkeeper (once Frosthelm is free)
  aldric: folk('aldric', 'brann', { head: 'helm_lion@6', body: 'plate_guard@6' }), // the Royal Armorer (five stones)
  // Brightwater's homes, opened as the townsfolk come back
  bess: folk('bess', 'pip', { head: 'hat_star@6', body: 'robe_phoenix@4' }), // the curio-monger
  wynn: folk('wynn', 'wren', { head: 'cap_ranger@4', body: 'leathers_ranger@2', weapon: 'bow_long@4' }), // the fletcher
  hilde: folk('hilde', 'pip', { head: 'kerchief@6', body: 'apron_blue@3' }), // keeps the steam house
  mayor: folk('mayor', 'brann', { head: 'helm_lion@3', body: 'robe_scholar@6' }), // Mayor Tobin
  ferryman: folk('ferryman', 'oake', { head: 'hood_monk@3', body: 'jacket_leather@3', weapon: 'staff_oak@1' }), // the lake's boatman (30 townsfolk)
  kaari: folk('kaari', 'wren', { head: 'hood_ranger@5', body: 'furs_hide@2', weapon: 'bow_hunting@3' }), // Rimewatch's warden
};

// Hollow Guard: an empty suit of silversteel armour animated by the curse.
export const HOLLOW = { ...composeHero('hollow', { head: 'helm_hollow', body: 'plate_hollow', weapon: 'sword_rust', offhand: null }), id: 'hollow', name: 'Hollow Guard' };

// Hex Warlock: one of Malgrim's cultists - shields its allies and calls hexlings.
export const WARLOCK = { ...composeHero('cultist', { head: 'hood_cultist', body: 'robe_cultist', weapon: 'staff_hex', offhand: null }), id: 'warlock', name: 'Hex Warlock' };
// Mistfen: the Drowned (waterlogged dead) and Marsh Witchlings (Malgrim's swamp cultists).
export const DROWNED = { ...composeHero('drowned', { head: 'weeds_drowned', body: 'rags_drowned', weapon: 'hook_rust', offhand: null }), id: 'drowned', name: 'Drowned' };
// Gloamwood: Shades (hooded wraiths, drawn dark and veiled in play) and
// Wailing Banshees (pale drifting ghosts; washed out and hovering in play).
export const SHADE = { ...composeHero('sable', { head: 'hood_shadow@5', body: 'coat_nightsilk@5', weapon: 'dagger_kris@5', offhand: 'parry_kris@5' }), id: 'shade', name: 'Shade' };
export const BANSHEE = { ...composeHero('pip', { head: null, body: 'robe_scholar@1', weapon: 'none', offhand: null }), id: 'banshee', name: 'Wailing Banshee' };
// Ghost palettes, applied to a puppet's baked frames: every colour is mapped
// by brightness onto a ramp (keeping the ink outline and dark eyes), and the
// hem fades out so the figure floats with no feet.
const RAMP_GHOST = [[52, 58, 92], [150, 158, 190], [206, 214, 232], [244, 248, 255]];
const RAMP_PALE = [[30, 32, 46], [106, 112, 132], [178, 184, 200], [232, 236, 242]];
export const ghostRecolor = recolorer(RAMP_GHOST, true);
export const paleRecolor = recolorer(RAMP_PALE, false); // the Pale Huntsman: drained, but solid
const RAMP_SCALE = [[52, 18, 16], [142, 46, 26], [214, 102, 38], [255, 196, 104]];
export const scaleRecolor = recolorer(RAMP_SCALE, false); // Salamander Warriors: red scales
const RAMP_ICE = [[34, 62, 112], [104, 160, 214], [168, 214, 244], [232, 248, 255]];
export const iceRecolor = recolorer(RAMP_ICE, true); // Ice Wraiths: glassy blue, footless
const RAMP_RIME = [[30, 40, 72], [92, 122, 170], [170, 200, 232], [240, 248, 255]];
export const rimeRecolor = recolorer(RAMP_RIME, false); // Isolde: armour of frosted steel
const RAMP_MALGRIM = [[22, 14, 34], [62, 44, 92], [120, 100, 150], [214, 196, 236]];
export const malgrimRecolor = recolorer(RAMP_MALGRIM, false, ['skin', 'skinL', 'skinD', 'curse', 'curseL', 'ink']); // Malgrim: his coat and hat in grey-violet; his pale face and the hex light kept
function recolorer(RAMP, fade, keep = null) {
  const done = new WeakSet(); // frames can share a canvas: recolour each once
  const kept = keep && new Set(keep.map((k) => hex(k).toLowerCase()));
  return (canvas) => {
    if (done.has(canvas)) return;
    done.add(canvas);
    recolorCanvas(canvas, RAMP, fade, kept);
  };
}
function recolorCanvas(canvas, RAMP_GHOST, fade, kept = null) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  let bottom = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) bottom = y;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!d[i + 3]) continue;
    if (kept && kept.has(`#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`)) continue;
    const l = (0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2]) / 255;
    const c = l < 0.16 ? RAMP_GHOST[0] : l < 0.38 ? RAMP_GHOST[1] : l < 0.62 ? RAMP_GHOST[2] : RAMP_GHOST[3];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    const fromBottom = bottom - y;
    if (!fade) continue;
    if (fromBottom < 2) d[i + 3] = 0; // no feet
    else if (fromBottom < 6) d[i + 3] = Math.round(d[i + 3] * (fromBottom - 1) / 6); // a fading hem
  }
  ctx.putImageData(img, 0, 0);
}
// The Pale Huntsman: a ranger in a deep hood with a great bow, drained pale (paleRecolor)
export const HUNTSMAN = { ...composeHero('skull', { head: 'hood_antler', body: 'pelt_hunter', weapon: 'bow_long@5', offhand: 'quiver_fine@5' }), id: 'huntsman', name: 'Pale Huntsman' };
// Salamander Warrior: a scaled fighter with a horned helm, a long blade and a kite shield
export const SALAMANDER = { ...composeHero('lizard', { head: null, body: 'scale_armor', weapon: 'sword_long@4', offhand: 'shield_hex' }), id: 'salamander', name: 'Salamander Warrior' };
// Forgemaster Vulk: the salamander smith, horned and plated, with his great forge-axe
export const VULK = { ...composeHero('lizard', { head: 'crown_forge', body: 'apron_forge', weapon: 'axe_bearded@5', offhand: null }), id: 'vulk', name: 'Forgemaster Vulk' };
// Isolde the Rimeguard: Mirelle's sister in a great helm and plate, a frost lance and a kite shield
export const ISOLDE = { ...composeHero('mirelle', { head: 'helm_great', body: 'plate_guard', weapon: 'lance_rime', offhand: 'shield_kite' }), id: 'isolde', name: 'Isolde' };
// Ice Wraith: a hooded, footless shape of frost that drifts through walls (iceRecolor)
export const WRAITH = { ...composeHero('pip', { head: 'hood_shadow@3', body: 'robe_scholar@1', weapon: 'none', offhand: null }), id: 'icewraith', name: 'Ice Wraith' };
// Malgrim the Unkind: a tall wizard in a star-pointed hat and a long coat, with a hex staff
export const MALGRIM = { ...composeHero('brann', { head: 'hat_star', body: 'robe_scholar', weapon: 'staff_hex', offhand: null }), id: 'malgrim', name: 'Malgrim' };
// Chain Warden: Malgrim's jailer, a hulking plated hex knight swinging a shackle-mace (hexRecolor-free: dark steel)
export const WARDEN = { ...composeHero('brann', { head: 'helm_hex', body: 'plate_hex', weapon: 'hammer_war@1', offhand: null }), id: 'chainwarden', name: 'Chain Warden' };
export const WITCHLING = { ...composeHero('hag', { head: 'hat_hag', body: 'shawl_hag', weapon: 'staff_bog', offhand: null }), id: 'witchling', name: 'Marsh Witchling' };
