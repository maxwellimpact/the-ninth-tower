// Paper-doll gear. Each hero is a bare BASE body (face + hair, posing
// rules); equipped LOOKS layer on top:
//   head    -> overlay grid drawn over the base head (oy = rows above head top)
//   body    -> replaces the torso grid + arm/leg colours
//   weapon  -> procedural weapon kind + style params
//   offhand -> shield / tome / floating orb, or a second dagger (Sable)
// composeHero() merges base + looks into a def for drawPuppet(). The game
// bakes that into a sprite sheet whenever equipment changes.
import { grid, px, makeCanvas, outline } from './pixel.js';
import { swordAttack, daggerAttack, staffAttack, castRaise } from './poses.js';
import { shadedBlob } from './creatures.js';
import { WEAPONS } from './puppet.js';

// ------------------------------------------------------------- base bodies
const SKIN = { S: 'skin', s: 'skinD', L: 'skinL', E: 'ink' };

export const BASE = {
  brann: {
    headMap: { ...SKIN, H: 'hairBrL', h: 'hairBr' },
    head: {
      down: ['..hHHHHh..', '.hHHHHHHh.', '.hHHHHHHh.', '.hSSSSSSh.', '.SSESSESS.', '.SLSSSSLS.', '..hHHHHh..', '...hHHh...'],
      side: ['..hHHHH...', '.hHHHHHH..', '.hHHHHSSS.', '.hHHSSSES.', '.hHSSSSSSS', '..hSSLSS..', '..hhHHHh..', '....hHh...'],
      up: ['..hHHHHh..', '.hHHHHHHh.', '.hHHHHHHh.', '.hHHHHHHh.', '.hHHhHHHh.', '.hhHHHHhh.', '..hhhhhh..', '..........'],
    },
    idleAng: { down: 1.9, up: 1.4, side: 1.3 },
    attack: swordAttack,
    cast: (v) => castRaise(v).map((p) => ({ ...p, handL: undefined, angR: -1.6 })),
  },
  pip: {
    headMap: { ...SKIN, Y: 'hairBl', y: 'hairBlD' },
    head: {
      down: ['...YyY....', '.YYYYYYyY.', 'YYYYYYYYYY', '.YSYYSYSY.', '.YSSSSSSY.', '.YSESSESY.', '..SLSSLS..', '...ssss...'],
      side: ['...YYy....', '.YYYYYYY..', 'YYYYYYYYY.', 'YYYYYSYS..', '.YYYSSSSS.', '.YYYSSES..', '..YYSLSSS.', '...Ysss...'],
      up: ['...YyY....', '.YYYYYYyY.', 'YYYYYYYYYY', '.YYYYYYYY.', '.YYyYYyYY.', '.YYYYYYYY.', '..YyYYyY..', '...YYYY...'],
    },
    idleAng: { down: -1.6, up: -1.6, side: -1.5 },
    attack: staffAttack,
    cast: (v) => castRaise(v).map((p) => ({ ...p, angR: -1.57 })),
  },
  sable: {
    headMap: { ...SKIN, H: 'hairBk', h: 'night', K: 'hairBkL' },
    head: {
      down: ['..hHHHHh..', '.hHKKHHHh.', '.HHHHHHHHh', '.HHSHHSHH.', '.HSSSSSSH.', '.HSESSESH.', '.HSLSSLSH.', '..SSssSS..'],
      side: ['..hHHHH...', '.hHKKHHH..', 'hHHHHHHHH.', 'HHHHHHSHH.', 'HhHHSSSSS.', 'H.HHSSES..', '..hHSLSSS.', '...hSsss..'],
      up: ['..hHHHHh..', '.hHKKHHHh.', '.HHHHHHHH.', '.HHHHHHHH.', '.HHHhHHHH.', '.hHHHHHHh.', '..hHHHHh..', '...hHHh...'],
    },
    idleAng: { down: 1.7, up: 1.5, side: 1.25 },
    idleAngL: { down: 1.4, up: 1.6, side: 1.1 },
    attack: daggerAttack,
    cast: (v) => castRaise(v, { crouch: 1 }),
  },
};

// ------------------------------------------------------------------ LOOKS
const HEAD = {
  // ---- Brann
  helm_iron: {
    oy: 3, map: { B: 'blue', b: 'blueD', W: 'steelL', K: 'steel', k: 'steelD' },
    down: ['....BB....', '...Bb.....', '..kWWKKk..', '.kWKKKKKk.', '.kKKKKKKk.', '.kbbbbbbk.', '.k......k.', '.k......k.', '.k......k.'],
    side: ['...BB.....', '....BB....', '..kWWKk...', '.kWKKKKk..', '.kKKKKKKk.', '.kbbbbbbb.', '.kkk......', '.kkk......', '.kkk......'],
    up: ['....BB....', '....bB....', '..kWWKKk..', '.kWKKKKKk.', '.kKKKKKKk.', '.kbbbbbbk.', '.kKKKKKKk.', '.kKKKKKKk.', '.kkKKKKkk.', '..kkkkkk..'],
  },
  helm_great: {
    oy: 3, map: { R: 'red', r: 'redD', W: 'steelL', K: 'steel', k: 'steelD', E: 'ink', d: 'slate' },
    down: ['....RR....', '...Rr.....', '..kWWKKk..', '.kWKKKKKk.', '.kKKKKKKk.', '.kKKKKKKk.', '.kEEEEEEk.', '.kKKdKKKk.', '.kKKdKKKk.', '..kKKKKk..', '...kkkk...'],
    side: ['...RR.....', '....RR....', '..kWWKk...', '.kWKKKKk..', '.kKKKKKKk.', '.kKKKKKKk.', '.kKKKEEEE.', '.kKKKKdKK.', '.kKKKKdKk.', '..kKKKKk..', '...kkkk...'],
    up: ['....RR....', '....rR....', '..kWWKKk..', '.kWKKKKKk.', '.kKKKKKKk.', '.kKKKKKKk.', '.kKKKKKKk.', '.kKKKKKKk.', '.kkKKKKkk.', '..kKKKKk..', '...kkkk...'],
  },
  helm_lion: {
    oy: 3, map: { G: 'gold', g: 'hairBlD', Y: 'goldL', W: 'white', R: 'red' },
    down: ['W...gg...W', 'WW.gYYg.WW', '.WgGYYGgW.', '.gGGGGGGg.', '.gGGGGGGg.', '.gRgGGgRg.', '.g..gg..g.', '.g......g.', '.g......g.'],
    side: ['...gg.....', 'W.gYYg....', 'WWGYYGg...', '.WGGGGGg..', '.gGGGGGGg.', '.gGGGGGRg.', '.ggg..g...', '.ggg......', '.ggg......'],
    up: ['W...gg...W', 'WW.gYYg.WW', '.WgGYYGgW.', '.gGGGGGGg.', '.gGGGGGGg.', '.gGGGGGGg.', '.gGGGGGGg.', '.gGGGGGGg.', '.ggGGGGgg.', '..gggggg..'],
  },
  // ---- enemies / NPCs
  helm_hex: { oy: 3, map: { R: 'curse', r: 'purpD', W: 'stone', K: 'slate', k: 'night', E: 'curseL', d: 'ink' } },
  kerchief: {
    oy: 1, map: { R: 'redL', r: 'red' },
    down: ['...rRRr...', '.rRRRRRRr.', 'rRRRRRRRRr'],
    side: ['...rRR....', '.rRRRRRR..', 'rRRRRRRRR.'],
    up: ['...rRRr...', '.rRRRRRRr.', 'rRRRRRRRRr', '....RR....'],
  },
  // ---- Pip
  hat_apprentice: {
    oy: 4, map: { P: 'purp', p: 'purpD', Q: 'purpL', G: 'gold' },
    down: ['......P...', '.....PQ...', '....PPp...', '...PQPp...', '..PPPPPp..', '.GGGGGGGG.', 'pPPPPPPPPp'],
    side: ['....P.....', '....PP....', '...PQp....', '...PPPp...', '..PPPPPp..', '.GGGGGGGG.', 'pPPPPPPPPp'],
    up: ['......P...', '.....PP...', '....pPQ...', '...pPPP...', '..pPPPPP..', '.GGGGGGGG.', 'pPPPPPPPPp'],
  },
  hat_star: {
    oy: 5, map: { B: 'blue', b: 'blueD', Y: 'goldL', W: 'mist' },
    down: ['.......BB.', '......Bb..', '.....BBb..', '....BYBb..', '...BBBBBb.', '..BBYBBBb.', '.WWWWWWWW.', 'bBBBBBBBBb'],
    side: ['..BB......', '...bB.....', '...bBB....', '...bBYB...', '..bBBBBB..', '..bBBYBBB.', '.WWWWWWWW.', 'bBBBBBBBBb'],
    up: ['.......BB.', '......Bb..', '.....BBb..', '....BBBb..', '...BBBBBb.', '..BBBBYBb.', '.WWWWWWWW.', 'bBBBBBBBBb'],
  },
  circlet_ember: {
    oy: 1, map: { G: 'gold', g: 'hairBlD', R: 'red', F: 'fireL', f: 'fire' },
    down: ['....f.....', '...fFf....', '...fRf....', 'GGGGRRGGGG'],
    side: ['.......f..', '......fFf.', '.......R..', '.GGGGGGRG.'],
    up: ['..........', '..........', '..........', 'gGGGGGGGGg'],
  },
  // ---- Sable
  bandana_red: {
    oy: 0, map: { R: 'red', r: 'redD' },
    down: ['..........', '..........', 'rRRRRRRRRr', '.........R', '.........R'],
    side: ['..........', '..........', 'RRRRRRRRR.', 'Rr........', '.R........'],
    up: ['..........', '..........', 'rRRRRRRRRr', '....RR....', '...R..R...'],
  },
  hood_shadow: {
    oy: 1, map: { D: 'slate', d: 'night' },
    down: ['...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDD....DDd', 'dD......Dd', 'dD......Dd', '.dD....Dd.', '.dd....dd.'],
    side: ['..dDDd....', '.dDDDDd...', 'dDDDDDDd..', 'dDDDDDDDd.', 'dDDDD.....', 'dDDD......', 'dDDD......', '.dDD......', '..dd......'],
    up: ['...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', '.dDDDDDDd.', '..dDDDDd..'],
  },
  mask_raven: {
    oy: 1, map: { D: 'night', d: 'hexD', W: 'bone', w: 'mist', R: 'red' },
    down: ['...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDWWWWWWDd', 'dDRWWWWRDd', 'dDWWwwWWDd', '.dD.ww.Dd.', '.dd.ww.dd.'],
    side: ['..dDDd....', '.dDDDDd...', 'dDDDDDDd..', 'dDDDDDDDd.', 'dDDDWWWW..', 'dDDDWWRW..', 'dDDDWWWwww', '.dDDWWww..', '..dd.w....'],
    up: ['...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', '.dDDDDDDd.', '..dDDDDd..'],
  },
};

// Hex helm reuses the greathelm shape with Malgrim's colours.
Object.assign(HEAD.helm_hex, { down: HEAD.helm_great.down, side: HEAD.helm_great.side, up: HEAD.helm_great.up });

const ROBE_GRIDS = {
  down: ['.pPGPPGPp.', '.pPPPPPPp.', '.pPPGPPPp.', '.pbbbbbbp.', '.pPPGPPPp.', '.pPPGPPPp.', 'pPPPGPPPPp', 'pGGGGGGGGp'],
  side: ['..pPPG..', '..pPPPp.', '..pPPPp.', '..pbbbb.', '..pPPPp.', '..pPPPPp', '.pPPPPPp', '.pGGGGGG'],
  up: ['.pPPPPPPp.', '.pPPPPPPp.', '.pPPPPPPp.', '.pbbbbbbp.', '.pPPPPPPp.', '.pPPPPPPp.', 'pPPPPPPPPp', 'pGGGGGGGGp'],
};
const JACKET_GRIDS = {
  down: ['rRXRRRRr', 'lRrMMMMl', 'lMRMMMMl', 'lMRMMMMl', 'lbbGbbbl', '.lMMMMl.'],
  side: ['RrRXRr', 'RlMMMl', 'RlMMMl', '.lMMMl', '.bbbGb', '.lMMMl'],
  up: ['rRRRRRRr', 'lMMMMMMl', 'lMMRRMMl', 'lMMRrMMl', 'lbbbbbbl', '.lMMMMl.'],
};

const APRON_GRIDS = {
  down: ['wWWWWWWw', 'lAAAAAAl', 'lAAAAAAl', 'lAAPAAAl', '.AAAAAA.', '.lAAAAl.'],
  side: ['wWWWWw', 'lAAAAl', 'lAAAAl', '.lAPAl', '.AAAAA', '.lAAAl'],
  up: ['wWWWWWWw', 'llllllll', 'lAlllAll', 'llllllll', '.AAAAAA.', '.llllll.'],
};

const BODY = {
  plate_hex: {
    map: { B: 'purpD', b: 'hexD', W: 'stone', K: 'slate', k: 'night', l: 'ink', T: 'curse', G: 'curseL' },
    down: ['kWKKKKWk', 'kKBBBBKk', 'kKBTBBKk', '.kBBBBk.', '.llGlll.', '.kbBBbk.'],
    side: ['kWKKKk', 'kKKKBk', 'kKKKBk', '.kKKBk', '.lllGl', '.kKbBk'],
    up: ['kWKKKKWk', 'kKKKKKKk', 'kKKkkKKk', '.kKKKKk.', '.llllll.', '.kbBBbk.'],
    legs: ['night', 'hexD', 'ink'], arms: ['slate', 'night', 'slate'],
  },
  apron_blue: { map: { W: 'white', A: 'bone', l: 'blue', P: 'woodD' }, ...APRON_GRIDS, legs: ['woodD', 'leatherD', 'leatherD'], arms: ['blue', 'blueD', 'skin'] },
  apron_brown: { map: { W: 'bone', A: 'bone', l: 'leather', P: 'woodD' }, ...APRON_GRIDS, legs: ['leatherD', 'night', 'night'], arms: ['leather', 'leatherD', 'skin'] },
  // ---- Brann
  plate_guard: {
    map: { B: 'blue', b: 'blueD', W: 'steelL', K: 'steel', k: 'steelD', l: 'leatherD', T: 'blueL', G: 'gold' },
    down: ['kWKKKKWk', 'kKBBBBKk', 'kKBTBBKk', '.kBBBBk.', '.llGlll.', '.kbBBbk.'],
    side: ['kWKKKk', 'kKKKBk', 'kKKKBk', '.kKKBk', '.lllGl', '.kKbBk'],
    up: ['kWKKKKWk', 'kKKKKKKk', 'kKKkkKKk', '.kKKKKk.', '.llllll.', '.kbBBbk.'],
    legs: ['blueD', 'night', 'leatherD'], arms: ['steel', 'steelD', 'skin'],
  },
  hauberk_steel: {
    map: { K: 'steel', k: 'steelD', W: 'steelL', R: 'red', r: 'redD', l: 'leatherD', G: 'gold' },
    down: ['kWkKkKWk', 'KkRRRRkK', 'kKRRrRKk', '.kRRRRk.', '.lllGll.', '.kKRRKk.'],
    side: ['kWkKkk', 'KkKkRk', 'kKkKRk', '.kKkRk', '.lllGl', '.kKkRk'],
    up: ['kWkKkKWk', 'KkKkKkKk', 'kKkKkKkK', '.kKkKkk.', '.llllll.', '.kKkKkk.'],
    legs: ['slate', 'night', 'leatherD'], arms: ['steel', 'steelD', 'skin'],
  },
  aegis_dawn: {
    map: { G: 'gold', g: 'hairBlD', W: 'white', Y: 'goldL' },
    down: ['GWWWWWWG', 'gWWYYWWg', 'gWYGGYWg', '.gWYYWg.', '.ggYYgg.', '.gWWWWg.'],
    side: ['GWWWWg', 'gWWWYg', 'gWWWGg', '.gWWYg', '.gggYg', '.gWWWg'],
    up: ['GWWWWWWG', 'gWWWWWWg', 'gWWggWWg', '.gWWWWg.', '.gggggg.', '.gWWWWg.'],
    legs: ['bone', 'stone', 'gold'], arms: ['white', 'mist', 'skin'],
  },
  // ---- Pip
  robe_apprentice: {
    map: { P: 'purp', p: 'purpD', G: 'gold', b: 'woodD' }, ...ROBE_GRIDS, swayFrom: 6,
    legs: ['purpD', 'night', 'woodD'], arms: ['purp', 'purpD', 'skin'],
  },
  robe_scholar: {
    map: { P: 'blue', p: 'blueD', G: 'mist', b: 'leatherD' }, ...ROBE_GRIDS, swayFrom: 6,
    legs: ['blueD', 'night', 'leatherD'], arms: ['blue', 'blueD', 'skin'],
  },
  robe_phoenix: {
    map: { R: 'red', r: 'redD', G: 'gold', g: 'goldL', F: 'fire', f: 'fireL' }, swayFrom: 6,
    down: ['.rRGRRGRr.', '.rRRRRRRr.', '.rRRGRRRr.', '.rggggggr.', '.rRFGRFRr.', '.rFRGRRFr.', 'rFFRGRFFFr', 'FfFfFfFfFf'],
    side: ['..rRRG..', '..rRRRr.', '..rRRRr.', '..rgggg.', '..rRFRr.', '..rFRRFr', '.rFFRFFr', '.FfFfFfF'],
    up: ['.rRRRRRRr.', '.rRRRRRRr.', '.rRRRRRRr.', '.rggggggr.', '.rRFRRFRr.', '.rFRRRRFr.', 'rFFRRRFFFr', 'FfFfFfFfFf'],
    legs: ['redD', 'night', 'woodD'], arms: ['red', 'redD', 'skin'],
  },
  // ---- Sable
  jacket_leather: {
    map: { R: 'red', r: 'redD', X: 'redL', l: 'leatherD', M: 'leather', b: 'woodD', G: 'gold' }, ...JACKET_GRIDS,
    legs: ['slate', 'night', 'leatherD'], arms: ['leather', 'leatherD', 'skin'],
  },
  leather_studded: {
    map: { R: 'stone', r: 'slate', X: 'mist', l: 'night', M: 'slate', b: 'leatherD', G: 'steelL' }, ...JACKET_GRIDS,
    legs: ['leatherD', 'night', 'night'], arms: ['slate', 'night', 'skin'],
  },
  coat_nightsilk: {
    map: { p: 'purpD', P: 'purp', W: 'bone', w: 'mist', S: 'steelL' }, swayFrom: 6,
    down: ['wWWWWWWw', 'pWwPPPPp', 'pPWPSPPp', 'pPPPSPPp', 'pSSSSSSp', 'pPPPPPPp', 'pPP..PPp', 'pp....pp'],
    side: ['wWWWWw', 'WpPPPp', 'WpPPPp', '.pPPSp', '.SSSSS', '.pPPPp', 'pPPPPp', 'pp..pp'],
    up: ['wWWWWWWw', 'pPPPPPPp', 'pPPWWPPp', 'pPPWwPPp', 'pSSSSSSp', 'pPPPPPPp', 'pPPPPPPp', 'pp.pp.pp'],
    legs: ['night', 'hexD', 'leatherD'], arms: ['purp', 'purpD', 'skin'],
  },
};

const WEAPON = {
  none: null,
  sword_dark: { kind: 'sword', style: { len: 11, blade: 'mist', edge: 'slate', guard: 'curse', tip: 'curseL', grip: 'night' } },
  sword_iron: { kind: 'sword', style: {} },
  sword_long: { kind: 'sword', style: { len: 12, blade: 'white', edge: 'steelL', guard: 'steelL' } },
  sword_ember: { kind: 'sword', style: { len: 11, blade: 'fireL', edge: 'fire', guard: 'redD', tip: 'goldL', grip: 'night', flames: true } },
  staff_oak: { kind: 'staff', style: {} },
  staff_crystal: { kind: 'staff', style: { shaft: ['woodL', 'wood'], rim: 'blueL', core: 'white', glow: 'foam', crystal: true } },
  staff_sunspire: { kind: 'staff', style: { shaft: ['gold', 'hairBlD'], rim: 'fire', core: 'goldL', glow: 'fireL', hook: true, big: true } },
  dagger_steel: { kind: 'dagger', style: {} },
  dagger_kris: { kind: 'dagger', style: { blade: 'bone', tip: 'white', guard: 'redD', wavy: true, len: 7 } },
  dagger_fang: { kind: 'dagger', style: { blade: 'grassXL', tip: 'white', guard: 'leafD', len: 7, glow: 'grassL' } },
};

// ---------------------------------------------------------------- offhand
const SHIELDS = {
  hex: {
    map: { k: 'night', B: 'purpD', G: 'curse', w: 'hexD', W: 'slate' },
    front: ['.kkkk.', 'kBBBBk', 'kBBGBk', 'kBGGGk', 'kBBGBk', '.kBBk.', '..kk..'],
    back: ['.kkkk.', 'kwWWwk', 'kwWWwk', 'kwkkwk', 'kwWWwk', '.kwwk.', '..kk..'],
    edge: ['kB', 'kB', 'kG', 'kB', 'kB', 'kB', '.k'],
  },
  round: {
    map: { k: 'steelD', B: 'blue', G: 'gold', w: 'woodD', W: 'wood' },
    front: ['.kkkk.', 'kBBBBk', 'kBBGBk', 'kBGGGk', 'kBBGBk', '.kBBk.', '..kk..'],
    back: ['.kkkk.', 'kwWWwk', 'kwWWwk', 'kwkkwk', 'kwWWwk', '.kwwk.', '..kk..'],
    edge: ['kB', 'kB', 'kG', 'kB', 'kB', 'kB', '.k'],
  },
  kite: {
    map: { k: 'steelD', R: 'red', W: 'white', w: 'woodD', V: 'wood' },
    front: ['kkkkkk', 'kRRWRk', 'kRRWRk', 'kWWWWk', 'kRRWRk', 'kRRWRk', '.kRWk.', '.kRRk.', '..kk..'],
    back: ['kkkkkk', 'kwVVwk', 'kwVVwk', 'kwkkwk', 'kwVVwk', 'kwVVwk', '.kwwk.', '.kwwk.', '..kk..'],
    edge: ['kR', 'kR', 'kW', 'kR', 'kR', 'kR', 'kR', '.k', '.k'],
  },
  bulwark: {
    map: { g: 'hairBlD', G: 'gold', Y: 'goldL', R: 'red', w: 'woodD', V: 'wood' },
    front: ['gggggggg', 'gGGGGGGg', 'gGYGGYGg', 'gGGRRGGg', 'gGRYYRGg', 'gGGRRGGg', 'gGGGGGGg', 'gGYGGYGg', '.gGGGGg.', '..gggg..'],
    back: ['gggggggg', 'gwVVVVwg', 'gwVVVVwg', 'gwggggwg', 'gwVVVVwg', 'gwVVVVwg', 'gwggggwg', 'gwVVVVwg', '.gwwwwg.', '..gggg..'],
    edge: ['gG', 'gG', 'gY', 'gG', 'gR', 'gG', 'gG', 'gY', '.g', '.g'],
  },
};

function shieldDraw(kind) { return shieldDrawFrom(SHIELDS[kind]); }
function shieldDrawFrom(s) {
  const h = s.front.length;
  return (ctx, view, hL) => {
    const w = s.front[0].length;
    if (view === 'down') grid(ctx, s.front, s.map, hL.x - Math.floor(w / 2) + 1, hL.y - Math.floor(h / 2) - 1);
    else if (view === 'up') grid(ctx, s.back, s.map, hL.x - Math.floor(w / 2), hL.y - Math.floor(h / 2) - 1);
    else grid(ctx, s.edge, s.map, 27, hL.y - Math.floor(h / 2) - 1);
  };
}

const TOMES = {
  worn: { k: 'woodD', c: 'wood', p: 'bone', m: 'gold' },
  frost: { k: 'blueD', c: 'blue', p: 'white', m: 'foam' },
};
function tomeDraw(kind) { return tomeDrawFrom(TOMES[kind]); }
function tomeDrawFrom(map) {
  const rows = ['kcck', 'cmcc', 'cccc', 'ppkp'];
  return (ctx, view, hL) => {
    if (view === 'side') return; // held on the far side
    grid(ctx, rows, map, hL.x - 1, hL.y - 2);
  };
}
function orbDraw() {
  return (ctx, view, hL, pose) => {
    const bob = Math.round(Math.sin(((pose.fi || 0) / 4) * Math.PI * 2) * 1.2);
    const pos = view === 'down' ? { x: 32, y: 20 } : view === 'up' ? { x: 16, y: 20 } : { x: 17, y: 19 };
    const cx = pos.x, cy = pos.y + bob + (pose.bob || 0);
    shadedBlob(ctx, cx, cy, 2.6, 2.6, ['purpD', 'purp', 'purpL', 'white']);
    px(ctx, cx - 4, cy + 2, 'curseL'); px(ctx, cx + 3, cy - 3, 'curseL');
  };
}

const OFFHAND = {
  shield_hex: { draw: shieldDraw('hex') },
  shield_round: { draw: shieldDraw('round') },
  shield_kite: { draw: shieldDraw('kite') },
  shield_bulwark: { draw: shieldDraw('bulwark') },
  tome_worn: { draw: tomeDraw('worn') },
  tome_frost: { draw: tomeDraw('frost') },
  orb_echo: { draw: () => {} }, // drawn live by GearFX so it can float freely
  parry_steel: { dagger: WEAPON.dagger_steel.style },
  parry_kris: { dagger: WEAPON.dagger_kris.style },
  parry_fang: { dagger: WEAPON.dagger_fang.style },
};

export const LOOKS = { head: HEAD, body: BODY, weapon: WEAPON, offhand: OFFHAND };

// ------------------------------------------------------------ tier recolours
// Generated gear uses look ids like "sword_iron@3": the base look recoloured
// with that tier's material ramp (iron, steel, silversteel, runesteel,
// starsteel, kingsteel and the matching cloth / leather colours).
const RAMPS = {
  1: {},
  2: { steelD: 'steel', steel: 'steelL', steelL: 'white', blue: 'red', blueD: 'redD', blueL: 'redL', purp: 'blue', purpD: 'blueD', purpL: 'blueL', leather: 'wood', leatherD: 'woodD' },
  3: { steelD: 'stone', steel: 'mist', steelL: 'white', blue: 'grass', blueD: 'grassD', blueL: 'grassL', purp: 'grass', purpD: 'grassD', purpL: 'grassL', red: 'grass', redD: 'grassD', redL: 'grassL', leather: 'stone', leatherD: 'slate', wood: 'woodL', woodD: 'wood' },
  4: { steelD: 'night', steel: 'blueD', steelL: 'blueL', blue: 'purp', blueD: 'purpD', blueL: 'purpL', purp: 'waterD', purpD: 'night', purpL: 'water', red: 'purp', redD: 'purpD', redL: 'purpL', leather: 'grassD', leatherD: 'leafD', gold: 'crystalL', goldL: 'white' },
  5: { steelD: 'purpD', steel: 'purp', steelL: 'purpL', blue: 'night', blueD: 'ink', blueL: 'slate', purp: 'night', purpD: 'ink', purpL: 'slate', red: 'night', redD: 'ink', redL: 'slate', leather: 'night', leatherD: 'ink', wood: 'slate', woodD: 'night' },
  6: { steelD: 'hairBlD', steel: 'gold', steelL: 'goldL', blue: 'white', blueD: 'bone', blueL: 'white', purp: 'white', purpD: 'bone', purpL: 'white', red: 'redD', redD: 'woodD', redL: 'red', leather: 'redD', leatherD: 'woodD', wood: 'gold', woodD: 'hairBlD', gold: 'goldL' },
};
const WEAPON_DEFAULTS = {
  sword: { blade: 'steelL', edge: 'steel', guard: 'gold', tip: 'white', grip: 'woodD' },
  staff: { shaft: ['wood', 'woodD'], rim: 'gold', core: 'goldL', glow: 'fireL' },
  dagger: { blade: 'steelL', tip: 'white', guard: 'gold' },
};
const RINGS = { vigor: 'redL', might: 'fireL', warding: 'blueL', precision: 'grassXL' };
const rc = (ramp) => (k) => (typeof k === 'string' && ramp[k]) || k;
const mapObj = (o, f) => Object.fromEntries(Object.entries(o).map(([c, k]) => [c, Array.isArray(k) ? k.map(f) : f(k)]));
const lookCache = new Map();

export function getLook(slot, lookId) {
  if (!lookId) return null;
  if (!lookId.includes('@')) return LOOKS[slot][lookId];
  const key = `${slot}|${lookId}`;
  if (lookCache.has(key)) return lookCache.get(key);
  const [baseId, t] = lookId.split('@');
  const f = rc(RAMPS[t] || {});
  const base = LOOKS[slot][baseId];
  let out = null;
  if (base && (slot === 'head' || slot === 'body')) {
    out = { ...base, map: mapObj(base.map, f) };
    if (base.legs) out.legs = base.legs.map(f);
    if (base.arms) out.arms = base.arms.map(f);
  } else if (base && slot === 'weapon') {
    out = { kind: base.kind, style: mapObj({ ...WEAPON_DEFAULTS[base.kind], ...base.style }, f) };
  } else if (base && slot === 'offhand') {
    if (base.dagger) out = { dagger: mapObj({ ...WEAPON_DEFAULTS.dagger, ...base.dagger }, f) };
    else if (baseId.startsWith('shield')) {
      const sh = SHIELDS[baseId.split('_')[1]];
      const s2 = { ...sh, map: mapObj(sh.map, f) };
      out = { draw: shieldDrawFrom(s2), shield: s2 };
    } else if (baseId.startsWith('tome')) {
      const map = mapObj(TOMES[baseId.split('_')[1]], f);
      out = { draw: tomeDrawFrom(map), tome: map };
    } else out = base;
  }
  lookCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- compose
// equip: { head, body, weapon, offhand } -> look ids (null = nothing equipped)
export const DEFAULT_BODY = { brann: 'plate_guard', pip: 'robe_apprentice', sable: 'jacket_leather' };
export const DEFAULT_WEAPON = { brann: 'sword_iron', pip: 'staff_oak', sable: 'dagger_steel' };
export function composeHero(heroId, equip, meta = {}) {
  const b = BASE[heroId];
  const body = getLook('body', equip.body) || BODY[DEFAULT_BODY[heroId]];
  const head = equip.head ? getLook('head', equip.head) : null;
  const wpn = equip.weapon === 'none' ? null : getLook('weapon', equip.weapon) || WEAPON[DEFAULT_WEAPON[heroId]];
  const off = equip.offhand ? getLook('offhand', equip.offhand) : null;
  return {
    ...meta,
    id: heroId,
    headMap: b.headMap,
    head: b.head,
    headOver: head ? { rows: head, map: head.map, oy: head.oy } : null,
    torsoMap: body.map,
    torso: { down: body.down, up: body.up, side: body.side },
    swayFrom: body.swayFrom,
    legs: body.legs,
    arms: body.arms,
    weaponR: wpn ? { kind: wpn.kind, style: wpn.style } : null,
    weaponL: off && off.dagger ? { kind: 'dagger', style: off.dagger } : null,
    offhand: off && off.draw ? off.draw : null,
    idleAng: b.idleAng,
    idleAngL: b.idleAngL,
    attack: b.attack,
    cast: b.cast,
  };
}

// ------------------------------------------------------------------ icons
// 16x16 inventory icon for an item look.
export function itemIcon(heroId, slot, lookId) {
  const [c, ctx] = makeCanvas(16, 16);
  if (slot === 'trinket') {
    // ring: tier-coloured band with a gem in the ring's stat colour
    const [kind, t] = lookId.replace('ring_', '').split('@');
    const f = rc(RAMPS[t] || {});
    const band = [f('steelD'), f('steel'), f('steelL')];
    for (let a = 0; a < 24; a++) { const ang = (a / 24) * Math.PI * 2; px(ctx, Math.round(8 + Math.cos(ang) * 4), Math.round(9 + Math.sin(ang) * 3.4), band[a % 3 === 0 ? 2 : a % 2]); }
    px(ctx, 7, 4, RINGS[kind] || 'redL', 3, 2); px(ctx, 8, 3, 'white');
  } else if (slot === 'head') {
    const L = getLook('head', lookId);
    const b = BASE[heroId];
    const top = Math.max(0, 16 - 8 - L.oy - 1);
    grid(ctx, b.head.down, b.headMap, 3, top + L.oy);
    grid(ctx, L.down, L.map, 3, top);
  } else if (slot === 'body') {
    const L = getLook('body', lookId);
    const w = L.down[0].length;
    grid(ctx, L.down, L.map, 8 - Math.floor(w / 2), Math.floor((16 - L.down.length) / 2));
    // little sleeves
    const y0 = Math.floor((16 - L.down.length) / 2);
    px(ctx, 8 - Math.floor(w / 2) - 1, y0 + 1, L.arms[0], 1, 3);
    px(ctx, 8 + Math.ceil(w / 2), y0 + 1, L.arms[0], 1, 3);
  } else if (slot === 'weapon') {
    const L = getLook('weapon', lookId);
    WEAPONS[L.kind](ctx, { x: 4, y: 12 }, -0.785, L.kind === 'staff' ? 1 : 0, L.style);
  } else {
    const L = getLook('offhand', lookId);
    const baseId = lookId.split('@')[0];
    if (L.dagger) WEAPONS.dagger(ctx, { x: 5, y: 11 }, -0.785, 0, L.dagger);
    else if (baseId.startsWith('shield')) {
      const sh = L.shield || SHIELDS[baseId.split('_')[1]];
      grid(ctx, sh.front, sh.map, 8 - Math.floor(sh.front[0].length / 2), 8 - Math.floor(sh.front.length / 2));
    } else if (baseId.startsWith('tome')) {
      const map = L.tome || TOMES[baseId.split('_')[1]];
      grid(ctx, ['kcccck', 'cmmccc', 'cmcccc', 'cccccc', 'cccccc', 'pppppk'], map, 5, 5);
    } else shadedBlob(ctx, 8, 8, 4, 4, ['purpD', 'purp', 'purpL', 'white']);
  }
  outline(c, 'ink');
  return c;
}
