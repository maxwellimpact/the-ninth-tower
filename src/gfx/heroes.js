// Hero + humanoid enemy definitions for the puppet renderer.
// Heroes come from data (src/data/heroes.json) composed with their equipped
// gear looks (gear.js). The goblin is a fixed puppet.
import heroData from '../data/heroes.json';
import items from '../data/items.json';
import { composeHero } from './gear.js';
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
};

// Hollow Guard: an empty suit of silversteel armour animated by the curse.
export const HOLLOW = { ...composeHero('brann', { head: 'helm_great@3', body: 'plate_guard@4', weapon: 'sword_iron@3', offhand: 'shield_round@4' }), id: 'hollow', name: 'Hollow Guard' };

// Hex Warlock: one of Malgrim's cultists - shields its allies and calls hexlings.
export const WARLOCK = { ...composeHero('pip', { head: 'hat_apprentice@5', body: 'robe_apprentice@5', weapon: 'staff_oak@5', offhand: null }), id: 'warlock', name: 'Hex Warlock' };
