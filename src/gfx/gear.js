// Paper-doll gear. Each hero is a bare BASE body (face + hair, posing
// rules); equipped LOOKS layer on top:
//   head    -> overlay grid drawn over the base head (oy = rows above head top)
//   body    -> replaces the torso grid + arm/leg colours
//   weapon  -> procedural weapon kind + style params
//   offhand -> shield / tome / floating orb, or a second dagger (Sable)
// composeHero() merges base + looks into a def for drawPuppet(). The game
// bakes that into a sprite sheet whenever equipment changes.
import { grid, px, makeCanvas, outline } from './pixel.js';
import { swordAttack, daggerAttack, staffAttack, castRaise, bowAttack } from './poses.js';
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

BASE.wren = {
  headMap: { ...SKIN, H: 'red', h: 'redD' },
  head: {
    down: ['..hHHHHh..', '.hHHHHHHh.', '.HHHHHHHHh', '.HSSSSSSH.', '.HSESSESH.', '.hSLSSLSh.', '.hHSSSSHh.', '..h....h..'],
    side: ['..hHHHH...', '.hHHHHHH..', 'hHHHHHHHH.', 'HHHHHSSSS.', 'HHHHSSSES.', 'hHHHSSLSS.', 'hHHh.SSS..', '.hh.......'],
    up: ['..hHHHHh..', '.hHHHHHHh.', '.HHHHHHHH.', '.HHHHHHHH.', '.HHHHHHHH.', '.hHHHHHHh.', '.hHHHHHHh.', '..hHHHHh..'],
  },
  idleAng: { down: 1.2, up: -1.3, side: 0.7 },
  attack: bowAttack,
  cast: (v) => castRaise(v),
};
BASE.kesh = {
  headMap: { ...SKIN, F: 'stone', f: 'slate', E: 'goldL', N: 'ink', T: 'white' },
  head: {
    down: ['F.......F.', 'Ff.fFFf.fF', '.fFFFFFFf.', '.FSSSSSSF.', '.SSESSESS.', '.SLSSSSLS.', '..STSSTS..', '...SSSS...'],
    side: ['.F........', '.Ff.fFFF..', '.fFFFFFFF.', '.FFFFSSSS.', '.FFFSSSEN.', '.FFSSSSSSS', '..FSSTSS..', '...SSSS...'],
    up: ['F.......F.', 'Ff.fFFf.fF', '.fFFFFFFf.', '.FFFFFFFF.', '.FFFFFFFF.', '.fFFFFFFf.', '..fFFFFf..', '...ffff...'],
  },
  idleAng: { down: 1.9, up: 1.4, side: 1.3 },
  idleAngL: { down: 1.3, up: 1.6, side: 1.1 },
  attack: swordAttack,
  cast: (v) => castRaise(v, { crouch: 1 }),
};

// Brother Oake: a round, cheerful monk with a tonsure (bare crown, brown fringe)
BASE.oake = {
  headMap: { ...SKIN, H: 'hairBrL', h: 'hairBr', R: 'redL' },
  head: {
    down: ['...SSSS...', '..SSLSSS..', '.hSSSSSSh.', '.HSSSSSSH.', '.SSESSESS.', '.SRSSSSRS.', '..SSssSS..', '...SSSS...'],
    side: ['...SSSS...', '..SSLSSS..', '.hSSSSSSS.', '.HHSSSSES.', '.HHSSSSSSS', '..HSRSSs..', '..SSSsSS..', '...SSSS...'],
    up: ['...SSSS...', '..SSLSSS..', '.hSSSSSSh.', '.HHHHHHHH.', '.HhHHHHhH.', '.hHHHHHHh.', '..hhhhhh..', '..........'],
  },
  idleAng: { down: 1.9, up: 1.4, side: 1.3 },
  attack: swordAttack,
  cast: (v) => castRaise(v),
};
// Gizmo: a gnome inventor - wild white hair, a big nose, bushy brows
BASE.gizmo = {
  headMap: { ...SKIN, H: 'white', h: 'mist', N: 'skinD' },
  head: {
    down: ['h.hHHHh.h.', 'HhHHHHHHhH', '.HHHHHHHH.', '.hSSSSSSh.', '.SSESSESS.', '.SSSNNSSS.', '..SSNNSS..', '...SSSS...'],
    side: ['.h.HHHh...', 'hHHHHHHH..', '.HHHHHHHH.', '.HHHSSSSh.', '.HHSSSSES.', '.HHSSSSNNN', '..HSSSSNN.', '...SSSS...'],
    up: ['h.hHHHh.h.', 'HhHHHHHHhH', '.HHHHHHHH.', '.HHHHHHHH.', '.HHhHHhHH.', '.hHHHHHHh.', '..hHHHHh..', '..........'],
  },
  idleAng: { down: 1.9, up: 1.4, side: 1.3 },
  attack: swordAttack,
  cast: (v) => castRaise(v),
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
  // ---- Wren
  cap_ranger: {
    oy: 1, map: { G: 'leaf', g: 'leafD' },
    down: ['...gGGg...', '.gGGGGGGg.', 'gGGGGGGGGg'],
    side: ['...gGG....', '.gGGGGGG..', 'gGGGGGGGGg'],
    up: ['...gGGg...', '.gGGGGGGg.', 'gGGGGGGGGg', '.gGGGGGGg.'],
  },
  hood_ranger: { oy: 1, map: { D: 'leaf', d: 'leafD' } },
  // ---- Kesh
  warhelm_hide: {
    oy: 2, map: { w: 'leatherD', W: 'leather', b: 'bone' },
    down: ['b........b', 'bw......wb', '.wwwwwwww.', 'wWWWWWWWWw'],
    side: ['b.........', 'bw........', '.wwwwwww..', 'wWWWWWWWW.'],
    up: ['b........b', 'bw......wb', '.wwwwwwww.', 'wWWWWWWWWw', '.wWWWWWWw.'],
  },
  warhelm_horn: {
    oy: 3, map: { B: 'bone', b: 'mist', k: 'steelD', K: 'steel' },
    down: ['B........B', 'BB......BB', '.bBkkkkBb.', '.kKKKKKKk.', 'kKKKKKKKKk'],
    side: ['B.........', 'BB........', '.bBkkkk...', '.kKKKKKK..', 'kKKKKKKKK.'],
    up: ['B........B', 'BB......BB', '.bBkkkkBb.', '.kKKKKKKk.', 'kKKKKKKKKk', '.kKKKKKKk.'],
  },
  // ---- Oake
  hood_monk: {
    oy: 2, map: { M: 'wood', m: 'woodD', L: 'woodL' },
    down: ['..mMMMMm..', '.mMLMMMMm.', 'mMMMMMMMMm', 'mM......Mm', 'm........m'],
    side: ['..mMMMM...', '.mMLMMMM..', 'mMMMMMMMMm', 'mMMMM.....', 'mMMM......'],
    up: ['..mMMMMm..', '.mMLMMMMm.', 'mMMMMMMMMm', 'mMMMMMMMMm', 'mMMMMMMMMm', '.mMMMMMMm.'],
  },
  mitre_cheer: {
    oy: 5, map: { W: 'white', w: 'bone', G: 'gold', g: 'goldL', R: 'red' },
    down: ['....gg....', '...wWWw...', '..wWGGWw..', '..WWGGWW..', '.wWWRRWWw.', '.GGGGGGGG.', 'wWWWWWWWWw'],
    side: ['...gg.....', '..wWWw....', '..WGGWw...', '.wWGGWWw..', '.WWRRWWW..', '.GGGGGGGG.', 'wWWWWWWWW.'],
    up: ['....gg....', '...wWWw...', '..wWWWWw..', '..WWWWWW..', '.wWWWWWWw.', '.GGGGGGGG.', 'wWWWWWWWWw'],
  },
  // ---- Gizmo
  goggles_brass: {
    oy: 0, map: { K: 'leatherD', G: 'gold', g: 'hairBlD', L: 'foam', l: 'waterL' },
    // pushed up on the hair, so they read as goggles and not as eyes
    down: ['..........', '.gGGggGGg.', 'KGLlGGLlGK', '.gGGggGGg.'],
    side: ['..........', '.....gGGg.', 'KKKKKGLlG.', '.....gGGg.'],
    up: ['..........', '..........', 'KKKKKKKKKK'],
  },
  goggles_clockwork: {
    oy: 0, map: { K: 'woodD', G: 'gold', g: 'hairBlD', L: 'grassXL', l: 'grassL', R: 'redL' },
    down: ['....RR....', '.gGGggGGg.', 'KGLlGRLlGK', '.gGGggGGg.'],
    side: ['......RR..', '.....gGGg.', 'KKKKKGLlG.', '.....gGGg.'],
    up: ['....RR....', '..........', 'KKKKKKKKKK'],
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

Object.assign(HEAD.hood_ranger, { down: HEAD.hood_shadow.down, side: HEAD.hood_shadow.side, up: HEAD.hood_shadow.up });
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
  // ---- Wren
  leathers_ranger: {
    map: { G: 'leaf', g: 'leafD', L: 'leather', l: 'leatherD', b: 'woodD', B: 'gold' },
    down: ['gGGGGGGg', 'lGLLLLGl', 'lGLLLLGl', 'lGGLLGGl', 'lbbBbbbl', '.lLLLLl.'],
    side: ['gGGGGg', 'GlLLLl', 'GlLLLl', '.lLLLl', '.bbbBb', '.lLLLl'],
    up: ['gGGGGGGg', 'lGGGGGGl', 'lGGlLGGl', 'lGGLlGGl', 'lbbbbbbl', '.lLLLLl.'],
    legs: ['leatherD', 'night', 'woodD'], arms: ['leaf', 'leafD', 'skin'],
  },
  leathers_scout: {
    map: { G: 'grassD', g: 'leafD', L: 'mossD', l: 'night', b: 'leatherD', B: 'steelL' },
    down: ['gGGGGGGg', 'lGLLLLGl', 'lGLLLLGl', 'lGGLLGGl', 'lbbBbbbl', '.lLLLLl.'],
    side: ['gGGGGg', 'GlLLLl', 'GlLLLl', '.lLLLl', '.bbbBb', '.lLLLl'],
    up: ['gGGGGGGg', 'lGGGGGGl', 'lGGlLGGl', 'lGGLlGGl', 'lbbbbbbl', '.lLLLLl.'],
    legs: ['night', 'night', 'leatherD'], arms: ['grassD', 'leafD', 'skin'],
  },
  // ---- Kesh
  // ---- Oake
  habit_monk: {
    map: { M: 'wood', m: 'woodD', L: 'woodL', R: 'sand', r: 'dirtD' },
    down: ['mMMMMMMm', 'mMMLMMMm', 'mMMMMMMm', '.mMMMMm.', '.rRRRRr.', '.mMMMMm.'],
    side: ['mMMMMm', 'mMMLMm', 'mMMMMm', '.mMMMm', '.rRRRr', '.mMMMm'],
    up: ['mMMMMMMm', 'mMMMMMMm', 'mMMMMMMm', '.mMMMMm.', '.rRRRRr.', '.mMMMMm.'],
    swayFrom: 6, legs: ['woodD', 'night', 'woodD'], arms: ['wood', 'woodD', 'skin'],
  },
  vestments_cleric: {
    map: { M: 'white', m: 'bone', L: 'goldL', R: 'gold', r: 'hairBlD' },
    down: ['mMMMMMMm', 'mMRMMRMm', 'mMRMMRMm', '.mMRRMm.', '.rRRRRr.', '.mMMMMm.'],
    side: ['mMMMMm', 'mMMRMm', 'mMMRMm', '.mMRMm', '.rRRRr', '.mMMMm'],
    up: ['mMMMMMMm', 'mMMRRMMm', 'mMMRRMMm', '.mMRRMm.', '.rRRRRr.', '.mMMMMm.'],
    swayFrom: 6, legs: ['bone', 'night', 'woodD'], arms: ['white', 'bone', 'skin'],
  },
  // Vestments of the Undimmed: white and gold with a rising sun on the chest
  vestments_undimmed: {
    map: { M: 'white', m: 'bone', L: 'fireL', R: 'goldL', r: 'redD', S: 'redL' },
    down: ['mMMMMMMm', 'mMMLLMMm', 'mMLRRLMm', '.mMLLMm.', '.rSSSSr.', '.mMMMMm.'],
    side: ['mMMMMm', 'mMMLMm', 'mMLRLm', '.mMLMm', '.rSSSr', '.mMMMm'],
    up: ['mMMMMMMm', 'mMMRRMMm', 'mMMRRMMm', '.mMRRMm.', '.rSSSSr.', '.mMMMMm.'],
    swayFrom: 6, legs: ['bone', 'night', 'woodD'], arms: ['white', 'bone', 'skin'],
  },
  // ---- Gizmo
  overalls_work: {
    map: { D: 'blue', d: 'blueD', S: 'redL', s: 'red', G: 'gold', P: 'blueL' },
    down: ['sSdDDdSs', 'sSDGGDSs', '.dDDDDd.', '.dDPPDd.', '.dDDDDd.', '.dDddDd.'],
    side: ['sSDDds', 'sSDGDs', '.dDDDd', '.dDPDd', '.dDDDd', '.dDdDd'],
    up: ['sSdDDdSs', 'sSDDDDSs', '.dDDDDd.', '.dDDDDd.', '.dDDDDd.', '.dDddDd.'],
    legs: ['blueD', 'night', 'woodD'], arms: ['red', 'redD', 'skin'],
  },
  overalls_flame: {
    map: { D: 'lavaD', d: 'redD', S: 'mist', s: 'stone', G: 'gold', P: 'lavaL' },
    down: ['sSdDDdSs', 'sSDGGDSs', '.dDDDDd.', '.dDPPDd.', '.dDDDDd.', '.dDddDd.'],
    side: ['sSDDds', 'sSDGDs', '.dDDDd', '.dDPDd', '.dDDDd', '.dDdDd'],
    up: ['sSdDDdSs', 'sSDDDDSs', '.dDDDDd.', '.dDDDDd.', '.dDDDDd.', '.dDddDd.'],
    legs: ['redD', 'night', 'woodD'], arms: ['stone', 'slate', 'skin'],
  },
  furs_hide: {
    map: { F: 'stone', f: 'slate', L: 'leather', l: 'leatherD', b: 'woodD', T: 'bone' },
    down: ['fFFFFFFf', 'FfLLLLfF', '.lLLLLl.', '.lLTTLl.', '.bbbbbb.', '.lLLLLl.'],
    side: ['fFFFFf', 'FfLLLl', '.lLLLl', '.lLTLl', '.bbbbb', '.lLLLl'],
    up: ['fFFFFFFf', 'FFFFFFFF', '.lLLLLl.', '.lLLLLl.', '.bbbbbb.', '.lLLLLl.'],
    legs: ['leatherD', 'night', 'leatherD'], arms: ['skin', 'skinD', 'skin'],
  },
  furs_wolf: {
    map: { F: 'mist', f: 'stone', L: 'redD', l: 'woodD', b: 'night', T: 'bone' },
    down: ['fFFFFFFf', 'FfLLLLfF', 'FlLLLLlF', '.lLTTLl.', '.bbbbbb.', '.lLLLLl.'],
    side: ['fFFFFf', 'FfLLLl', 'FlLLLl', '.lLTLl', '.bbbbb', '.lLLLl'],
    up: ['fFFFFFFf', 'FFFFFFFF', 'FFFFFFFF', '.lLLLLl.', '.bbbbbb.', '.lLLLLl.'],
    legs: ['woodD', 'night', 'night'], arms: ['skin', 'skinD', 'mist'],
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
  bow_hunting: { kind: 'bow', style: {} },
  bow_long: { kind: 'bow', style: { len: 7, bend: 3, wood: 'wood', tips: 'night' } },
  axe_hand: { kind: 'axe', style: {} },
  axe_bearded: { kind: 'axe', style: { len: 9, bearded: true } },
  hammer_war: { kind: 'hammer', style: {} },
  hammer_dawn: { kind: 'hammer', style: { len: 10, head: 'gold', face: 'goldL', haft: 'bone', glow: 'goldL' } },
  wrench_steel: { kind: 'wrench', style: {} },
  wrench_omni: { kind: 'wrench', style: { len: 9, head: 'gold', jaw: 'goldL', grip: 'redD' } },
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
    else grid(ctx, s.edge, s.map, 29, hL.y - Math.floor(h / 2) - 1); // side-on: the far-arm shield shows past the chest, behind the sword arm
  };
}

const TOMES = {
  worn: { k: 'woodD', c: 'wood', p: 'bone', m: 'gold' },
  frost: { k: 'blueD', c: 'blue', p: 'white', m: 'foam' },
};
// Things carried in the off hand (a book, a relic, a gadget), as opposed to a
// shield worn on the arm: the puppet draws them behind the body when facing
// away or side-on (far hand), in front when facing you.
const held = (fn) => Object.assign(fn, { held: true });
function tomeDraw(kind) { return tomeDrawFrom(TOMES[kind]); }
function tomeDrawFrom(map) {
  const rows = ['kcck', 'cmcc', 'cccc', 'ppkp'];
  return held((ctx, view, hL) => grid(ctx, rows, map, hL.x - 1, hL.y - 2));
}
// Oake's holy relic: a little golden reliquary held in the off hand (or a
// lantern, for the Lantern of the Faithful)
function relicDraw(map, lantern = false) {
  const rows = lantern ? ['.kk.', 'kggk', 'kgwk', 'kggk', '.kk.'] : ['.gg.', 'kcck', 'cwgc', 'cggc', 'kcck'];
  return held((ctx, view, hL) => grid(ctx, rows, map, hL.x - 1, hL.y - 3));
}
// Gizmo's gadget: a little box of gears with a blinking light on a stalk
function gadgetDraw(map) {
  const rows = ['..l.', '..k.', 'kcck', 'cgcc', 'kcck'];
  return held((ctx, view, hL) => grid(ctx, rows, map, hL.x - 1, hL.y - 3));
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

// Wren's quiver rides on her back: arrows show over the shoulder.
const QUIVERS = { basic: { q: 'leather', Q: 'leatherD', f: 'white', r: 'red' }, fine: { q: 'leaf', Q: 'leafD', f: 'white', r: 'gold' } };
// Slung diagonally across the back: top at one shoulder, bottom at the
// opposite hip, fletching poking up past the shoulder. `by` is the body bob.
function quiverDraw(map) {
  return (ctx, view, by = 0) => {
    // [top x, top y, bottom x, bottom y] of the quiver's spine
    const [x0, y0, x1, y1] = view === 'up' ? [28, 18, 21, 30] : view === 'side' ? [19, 18, 22, 30] : [29, 18, 23, 30];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + by + (y1 - y0) * t);
      px(ctx, x - 1, y, map.Q); px(ctx, x, y, map.q); px(ctx, x + 1, y, i % 4 === 0 ? map.Q : map.q);
    }
    // arrows: shafts and fletching above the shoulder
    const dx = Math.sign(x0 - x1);
    for (let k = -1; k <= 1; k++) {
      const ax = x0 + k + dx, ay = y0 + by - 2 - (k === 0 ? 1 : 0);
      px(ctx, ax, ay + 1, 'wood'); px(ctx, ax, ay, k === 0 ? map.r : map.f); px(ctx, ax + dx, ay - 1, k === 0 ? map.r : map.f);
    }
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
  quiver_basic: { back: quiverDraw(QUIVERS.basic), quiver: QUIVERS.basic },
  quiver_fine: { back: quiverDraw(QUIVERS.fine), quiver: QUIVERS.fine },
  relic_holy: { draw: relicDraw({ k: 'hairBlD', c: 'gold', g: 'goldL', w: 'white' }) },
  relic_lantern: { draw: relicDraw({ k: 'hairBlD', c: 'gold', g: 'fireL', w: 'goldL' }, true) },
  gadget_box: { draw: gadgetDraw({ k: 'steelD', c: 'steel', l: 'redL', g: 'gold' }) },
  gadget_turret: { draw: gadgetDraw({ k: 'hairBlD', c: 'gold', l: 'blueL', g: 'goldL' }) },
  gadget_turret2: { draw: gadgetDraw({ k: 'night', c: 'blue', l: 'white', g: 'crystalL' }) }, // Turret Mk. II: storm-blue
  hatchet_plain: { weaponL: { kind: 'axe', style: { len: 7 } } },
  hatchet_bearded: { weaponL: { kind: 'axe', style: { len: 7, bearded: true } } },
};


// ------------------------------------------------------------ enemy bodies
// Foes built on a hero's frame get their own heads and outfits, so they read
// as monsters and cultists, not as a tinted hero. Bases borrow the hero's
// posing (attack / cast); heads and looks are their own.
const reHead = (hero, headMap) => ({ ...BASE[hero], headMap }); // a hero's head shape in new colours
// an empty suit of armour: darkness where the face was, two eye-lights
BASE.hollow = reHead('brann', { S: 'night', s: 'ink', L: 'night', E: 'curseL', H: 'night', h: 'ink' });
BASE.cultist = reHead('pip', { S: 'bone', s: 'mist', L: 'white', E: 'curse', Y: 'night', y: 'ink' }); // a pale bone mask in the cowl, eye-holes lit from within
// a bog hag: mossy skin, lank black hair, yellow eyes
BASE.hag = reHead('pip', { S: 'mossL', s: 'moss', L: 'mossXL', E: 'goldL', Y: 'night', y: 'mudD' });
// the drowned: grey-blue waterlogged skin, weed for hair, pale pinprick eyes
BASE.drowned = reHead('sable', { S: 'mist', s: 'stone', L: 'bone', E: 'foam', H: 'mossD', h: 'night', K: 'moss' });
// a skull under the hood (the Pale Huntsman)
BASE.skull = { ...BASE.wren, headMap: { S: 'bone', s: 'mist', L: 'white', E: 'ink', H: 'bone', h: 'mist' },
  head: {
    down: ['...hhhh...', '..hHHHHh..', '.hHHHHHHh.', '.HHHHHHHH.', '.HEEHHEEH.', '.HEEHHEEH.', '..HHEEHH..', '..sHsHsH..'],
    side: ['...hhhh...', '..hHHHHh..', '.hHHHHHHh.', '.HHHHHHHH.', '.HHHHHEEH.', '.HHHHHEEH.', '..HHHHHEH.', '...HsHsH..'],
    up: ['...hhhh...', '..hHHHHh..', '.hHHHHHHh.', '.HHHHHHHH.', '.HHHHHHHH.', '.hHHHHHHh.', '..hHHHHh..', '...hhhh...'],
  } };
// a salamander: a blunt reptile head with a crest, slit eyes and a long snout in profile
BASE.lizard = { ...BASE.kesh, headMap: { G: 'stone', g: 'slate', k: 'night', E: 'goldL', e: 'ink', m: 'ink', C: 'mist' },
  head: {
    down: ['...C.C....', '..gCgCg...', '.gGGGGGGg.', 'gGEeGGEeGg', 'gGGGGGGGGg', '.gGGGGGGg.', '.gGmmmmGg.', '..gggggg..'],
    side: ['.C.C......', '.gCgCg....', 'gGGGGGGg..', 'gGGGGEeGg.', 'gGGGGGGGGg', '.gGGGGGmmg', '.gGGGgggg.', '..ggg.....'],
    up: ['...C.C....', '..gCgCg...', '.gGGCGGGg.', 'gGGGCGGGGg', 'gGGGCGGGGg', '.gGGCGGGg.', '.gGGGGGGg.', '..gggggg..'],
  } };

Object.assign(HEAD, {
  // dented great helm, no plume, a broken spike; the visor glows from inside
  helm_hollow: {
    oy: 3, map: { W: 'mist', K: 'stone', k: 'slate', E: 'curseL', d: 'night', r: 'leatherD' },
    down: ['..........', '....k.....', '..kWKKKk..', '.kWKdKKKk.', '.kKKKKdKk.', '.kKKKKKKk.', '.kkEkkEkk.', '.kKKdKKrk.', '.kKrKdKKk.', '..kKKKrk..', '...kkkk...'],
    side: ['..........', '...k......', '..kWKKk...', '.kWKdKKk..', '.kKKKKdKk.', '.kKKKKKKk.', '.kKKKkkEk.', '.kKKKKdKK.', '.kKrKKdKk.', '..kKKKrk..', '...kkkk...'],
    up: ['..........', '....k.....', '..kWKKKk..', '.kWKKdKKk.', '.kKKKKKKk.', '.kKKdKKKk.', '.kKKKKKKk.', '.kKrKKKKk.', '.kkKKKKrk.', '..kKKKKk..', '...kkkk...'],
  },
  // a deep pointed cowl; the face inside is shadow and two embers
  hood_cultist: {
    oy: 3, map: { D: 'hexD', d: 'night', R: 'curse' },
    down: ['....d.....', '...dDd....', '...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDD....DDd', 'dD......Dd', 'dD......Dd', '.dD....Dd.', '.dR....Rd.'],
    side: ['......d...', '.....dDd..', '....dDDd..', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDd.', 'dDDDD.....', 'dDDD......', 'dDDD......', '.dDD......', '..dR......'],
    up: ['....d.....', '...dDd....', '...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDRDDDDDd', 'dDDDDDDDDd', '.dDDDDDDd.', '..dDDDDd..'],
  },
  // a crooked, patched witch's hat with a bent tip
  hat_hag: {
    oy: 6, map: { P: 'night', p: 'hexD', r: 'mud', b: 'bogL' },
    down: ['........P.', '.......Pp.', '......PP..', '.....PpP..', '....PPPp..', '...PPPPPp.', '...PrPPPP.', '..bbbbbbb.', 'pPPPPPPPPp'],
    side: ['P.........', 'pP........', '.PP.......', '.PpP......', '..PPPp....', '..PPPPp...', '..PPrPPP..', '..bbbbbbb.', 'pPPPPPPPP.'],
    up: ['........P.', '.......Pp.', '......PP..', '.....PpP..', '....PPPp..', '...PPPPPp.', '...PPPPrP.', '..bbbbbbb.', 'pPPPPPPPPp'],
  },
  // weed draped over the head and face
  weeds_drowned: {
    oy: 1, map: { g: 'mossD', G: 'moss', w: 'grassD' },
    down: ['..gGgGg...', '.gGwGGwGg.', 'gG.g..gGGg', 'g..w...g.g', '...g...w..', '.......g..'],
    side: ['..gGgGg...', '.gGwGGwg..', 'gGGgGw....', 'g.gw.g....', '..g..w....', '.....g....'],
    up: ['..gGgGg...', '.gGwGGwGg.', 'gGGgGGwGGg', 'gGwGGgGGwg', '.gGGwGGgg.', '..g.g.g...'],
  },
  // the huntsman's hood, crowned with antlers
  hood_antler: {
    oy: 4, map: { D: 'leafD', d: 'night', B: 'bone', b: 'mist' },
    down: ['B.b....b.B', '.BB....BB.', '..B.dd.B..', '...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDD....DDd', 'dD......Dd', 'dD......Dd', '.dD....Dd.', '.dd....dd.'],
    side: ['B.b.......', '.BB.......', '..B.dd....', '..dDDd....', '.dDDDDd...', 'dDDDDDDd..', 'dDDDDDDDd.', 'dDDDD.....', 'dDDD......', 'dDDD......', '.dDD......', '..dd......'],
    up: ['B.b....b.B', '.BB....BB.', '..B.dd.B..', '...dDDd...', '..dDDDDd..', '.dDDDDDDd.', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', 'dDDDDDDDDd', '.dDDDDDDd.', '..dDDDDd..'],
  },
  // Vulk: an iron forge-crown with horns and a molten stone
  crown_forge: {
    oy: 4, map: { K: 'steel', k: 'steelD', B: 'bone', F: 'fireL', f: 'fire' },
    down: ['B........B', 'BB.K..K.BB', '.BkKkKkKB.', '.kKKfFKKk.', '.kkkkkkkk.'],
    side: ['B.........', 'BB.K..K...', '.BkKkKkK..', '.kKKKKfF..', '.kkkkkkk..'],
    up: ['B........B', 'BB.K..K.BB', '.BkKkKkKB.', '.kKKKKKKk.', '.kkkkkkkk.'],
  },
});

Object.assign(BODY, {
  // rusted plate over a rotted purple tabard; curse-light leaks at the seams
  plate_hollow: {
    map: { B: 'hexD', b: 'night', W: 'mist', K: 'stone', k: 'slate', l: 'leatherD', T: 'curse', G: 'curseL', r: 'leatherD' },
    down: ['kWKrKKWk', 'kKBBBBKk', 'kKBTBBrk', '.kBBTBk.', '.llGlll.', '.kb.Bbk.'],
    side: ['kWKrKk', 'kKKKBk', 'kKrKBk', '.kKKTk', '.lllGl', '.kK.Bk'],
    up: ['kWKKKKWk', 'kKKrKKKk', 'kKKkkKrk', '.kKKKKk.', '.llllll.', '.kb.Bbk.'],
    legs: ['slate', 'night', 'stone'], arms: ['stone', 'slate', 'stone'],
  },
  // a cultist's robe: black with a hex-purple trim and a glowing sigil, ragged hem
  robe_cultist: {
    map: { P: 'hexD', p: 'night', G: 'curse', g: 'curseL', b: 'ink' }, swayFrom: 6,
    down: ['.pPGPPGPp.', '.pPPPPPPp.', '.pPPgPPPp.', '.pbbbbbbp.', '.pPPgPPPp.', '.pPgPgPPp.', 'pPPPPPPPPp', 'pP.pP.Pp.p'],
    side: ['..pPPG..', '..pPPPp.', '..pPgPp.', '..pbbbb.', '..pPgPp.', '..pgPgPp', '.pPPPPPp', '.p.Pp.pp'],
    up: ['.pPPPPPPp.', '.pPPPPPPp.', '.pPPPPPPp.', '.pbbbbbbp.', '.pPPPPPPp.', '.pPPPPPPp.', 'pPPPPPPPPp', 'pP.pP.Pp.p'],
    legs: ['night', 'ink', 'night'], arms: ['hexD', 'night', 'mist'],
  },
  // a hag's mossy shawl over a black dress, frayed to threads
  shawl_hag: {
    map: { S: 'moss', s: 'mossD', D: 'night', d: 'ink', b: 'bog' }, swayFrom: 6,
    down: ['.sSSSSSSs.', '.sSSsSSSs.', '.ssSSSSss.', '.dDsDDsDd.', '.dDDDDDDd.', '.dDDbDDDd.', 'dDDDDDDDDd', 'd.Dd.dD.dd'],
    side: ['..sSSS..', '..sSSSs.', '..ssSSs.', '..dDsDd.', '..dDDDd.', '..dDDbDd', '.dDDDDDd', '.d.Dd.dd'],
    up: ['.sSSSSSSs.', '.sSSSSSSs.', '.sSSSSSSs.', '.dDDsDDDd.', '.dDDDDDDd.', '.dDDDDDDd.', 'dDDDDDDDDd', 'd.Dd.dD.dd'],
    legs: ['night', 'ink', 'mudD'], arms: ['moss', 'mossD', 'mossL'],
  },
  // a drowned sailor's rags: a sodden shirt, weed and barnacles
  rags_drowned: {
    map: { S: 'stone', s: 'slate', g: 'mossD', m: 'mist', b: 'leatherD' },
    down: ['sSSSSSSs', 'gSsSSsSg', 'gSSmSSSg', '.SsSSsS.', '.bbbbbb.', '.s.SS.s.'],
    side: ['sSSSSs', 'gSsSSs', 'gSSmSs', '.SsSSs', '.bbbbb', '.s.SSs'],
    up: ['sSSSSSSs', 'gSSsSSSg', 'gSSSSmSg', '.SSsSSS.', '.bbbbbb.', '.s.SS.s.'],
    legs: ['slate', 'night', 'mossD'], arms: ['stone', 'slate', 'mist'],
  },
  // a hunter's pelt mantle with a claw trophy
  pelt_hunter: {
    map: { F: 'stone', f: 'slate', L: 'leafD', l: 'night', T: 'bone', b: 'leatherD' },
    down: ['fFFFFFFf', 'FfLLLLfF', 'fLLLLLLf', '.lLTLLl.', '.bbbbbb.', '.lLLLLl.'],
    side: ['fFFFFf', 'FfLLLl', 'fLLLLl', '.lLTLl', '.bbbbb', '.lLLLl'],
    up: ['fFFFFFFf', 'FFFFFFFF', 'fFFFFFFf', '.lLLLLl.', '.bbbbbb.', '.lLLLLl.'],
    legs: ['leafD', 'night', 'night'], arms: ['leafD', 'night', 'bone'],
  },
  // salamander scale mail
  scale_armor: {
    map: { S: 'stone', s: 'slate', k: 'night', l: 'leatherD', G: 'gold' },
    down: ['kSsSsSsk', 'kSsSsSsk', 'ksSsSsSk', '.kSsSsk.', '.llGlll.', '.ksSSsk.'],
    side: ['kSsSsk', 'kSsSsk', 'ksSsSk', '.kSsSk', '.lllGl', '.ksSsk'],
    up: ['kSsSsSsk', 'kSsSsSsk', 'ksSsSsSk', '.kSsSsk.', '.llllll.', '.ksSSsk.'],
    legs: ['slate', 'night', 'slate'], arms: ['stone', 'slate', 'stone'],
  },
  // the forgemaster's heavy apron over scale, chained at the waist
  apron_forge: {
    map: { S: 'stone', s: 'slate', A: 'leather', a: 'leatherD', k: 'night', C: 'steelL', F: 'fire' },
    down: ['kSsSsSsk', 'kSAAAAsk', 'ksAaaAsk', '.kAAFAk.', '.CCCCCC.', '.kAaaAk.'],
    side: ['kSsSsk', 'kSAAAk', 'ksAaAk', '.kAFAk', '.CCCCC', '.kAaAk'],
    up: ['kSsSsSsk', 'kSsSsSsk', 'ksSsSsSk', '.kSsSsk.', '.CCCCCC.', '.ksSSsk.'],
    legs: ['slate', 'night', 'slate'], arms: ['stone', 'slate', 'stone'],
  },
});

Object.assign(WEAPON, {
  sword_rust: { kind: 'sword', style: { len: 12, blade: 'stone', edge: 'leatherD', guard: 'slate', tip: 'mist', grip: 'night' } },
  staff_hex: { kind: 'staff', style: { shaft: ['night', 'ink'], rim: 'bone', core: 'curse', glow: 'curseL' } },
  staff_bog: { kind: 'staff', style: { shaft: ['bark', 'barkD'], rim: 'mud', core: 'glow', glow: 'glowL' } },
  hook_rust: { kind: 'dagger', style: { blade: 'leather', tip: 'leatherD', guard: 'woodD' } },
});

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
  hammer: { haft: 'wood', haftD: 'woodD', head: 'steel', face: 'steelL' },
  wrench: { head: 'steel', jaw: 'steelL', grip: 'leatherD' },
  bow: { wood: 'woodL', tips: 'woodD', string: 'bone' },
  axe: { haft: 'wood', haftD: 'woodD', head: 'steel', edge: 'steelL' },
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
    else if (base.weaponL) out = { weaponL: { kind: base.weaponL.kind, style: mapObj({ ...WEAPON_DEFAULTS[base.weaponL.kind], ...base.weaponL.style }, f) } };
    else if (base.quiver) { const q = mapObj(base.quiver, f); out = { back: quiverDraw(q), quiver: q }; }
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
export const DEFAULT_BODY = { brann: 'plate_guard', pip: 'robe_apprentice', sable: 'jacket_leather', wren: 'leathers_ranger', kesh: 'furs_hide', oake: 'habit_monk', gizmo: 'overalls_work' };
export const DEFAULT_WEAPON = { brann: 'sword_iron', pip: 'staff_oak', sable: 'dagger_steel', wren: 'bow_hunting', kesh: 'axe_hand', oake: 'hammer_war', gizmo: 'wrench_steel' };
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
    weaponL: off && off.dagger ? { kind: 'dagger', style: off.dagger } : off?.weaponL || null,
    offhand: off && off.draw ? off.draw : null,
    back: off?.back || null,
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
    WEAPONS[L.kind](ctx, L.kind === 'bow' ? { x: 6, y: 9 } : { x: 4, y: 12 }, L.kind === 'bow' ? 0 : -0.785, L.kind === 'staff' ? 1 : 0, L.style);
  } else {
    const L = getLook('offhand', lookId);
    const baseId = lookId.split('@')[0];
    if (L.dagger) WEAPONS.dagger(ctx, { x: 5, y: 11 }, -0.785, 0, L.dagger);
    else if (L.weaponL) WEAPONS[L.weaponL.kind](ctx, { x: 5, y: 11 }, -0.785, 0, L.weaponL.style);
    else if (L.quiver) grid(ctx, ['f.r.f', 'r.f.r', 'qqqqq', 'qQqQq', 'qQqQq', 'qQqQq', 'qQqQq', 'qqqqq'], L.quiver, 5, 4);
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
