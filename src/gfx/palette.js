// The locked game palette. Every pixel in the game comes from here (plus the
// curse transform, which is derived). Keys are short names used by sprite code.
export const PAL = {
  // neutrals
  ink: '#1a1423', // universal outline
  night: '#2b2140',
  slate: '#45405e',
  stone: '#6e6a87',
  mist: '#a3a1b9',
  bone: '#d8d3e0',
  white: '#f6f2ea',

  // skin & hair
  skinD: '#b8735a',
  skin: '#e5a07c',
  skinL: '#f6c9a2',
  hairBr: '#5c3a2a',
  hairBrL: '#8a5a3c',
  hairBl: '#e9c46a',
  hairBlD: '#c08f3a',
  hairBk: '#2e2438',
  hairBkL: '#4a3a5c',

  // greens (vale)
  grassD: '#2f5d3a',
  grass: '#4a8a4a',
  grassL: '#73b25a',
  grassXL: '#a6d36a',
  leafD: '#1f4630',
  leaf: '#2f6e45',

  // earth
  dirtD: '#7a5236',
  dirt: '#a7744a',
  dirtL: '#c99a66',
  sand: '#e2c48f',
  woodD: '#5a3a26',
  wood: '#8a5c38',
  woodL: '#b07d4c',

  // water
  waterD: '#20406e',
  water: '#2f6aa3',
  waterL: '#4e9ad0',
  foam: '#bfe6f2',

  // steel & cloth
  steelD: '#4d5873',
  steel: '#8593b0',
  steelL: '#c4cfe2',
  blueD: '#25386e',
  blue: '#3a5fb0',
  blueL: '#6f93e0',
  redD: '#7a2238',
  red: '#c0394b',
  redL: '#ec6a5e',
  purpD: '#3e2463',
  purp: '#6b3fa0',
  purpL: '#a070d8',
  leatherD: '#3a2a2e',
  leather: '#5e4048',

  // magic & fx
  gold: '#f2c14e',
  goldL: '#fff0a0',
  fire: '#ff7b2e',
  fireL: '#ffd04a',
  curse: '#b24ce6',
  curseL: '#e7a6ff',
  hexD: '#2a1838',

  // Mistfen marsh
  mossD: '#2f3a24',
  moss: '#4a5a32',
  mossL: '#6e7c42',
  mossXL: '#93a055',
  mudD: '#3a2e24',
  mud: '#58462f',
  bogD: '#1a302e',
  bog: '#27463f',
  bogL: '#3f6a5a',
  bogXL: '#7aa88a',
  reed: '#b8a45c',
  reedD: '#7d6e3a',
  mushR: '#c8473a',
  mushL: '#f2dcc4',

  // caves
  caveD: '#120e17',
  cave: '#241d2c',
  caveL: '#3a3046',
  caveXL: '#5a4c68',
  crystal: '#5fd4e8',
  crystalL: '#c8f6ff',
};

export const hex = (k) => PAL[k] ?? k;
export const toInt = (k) => parseInt(hex(k).slice(1), 16);

export function rgb(k) {
  const h = hex(k);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Curse transform: desaturate, crush toward violet-grey. Used on the ground
// canvas and (as a tint) on sprites in cursed areas.
export function curseRGB(r, g, b) {
  const l = 0.3 * r + 0.55 * g + 0.15 * b;
  const m = 0.72;
  return [
    Math.round((l * 0.78 + r * 0.12) * m + 18),
    Math.round((l * 0.66 + g * 0.08) * m + 10),
    Math.round((l * 0.92 + b * 0.14) * m + 30),
  ];
}
export const CURSE_TINT = 0x9a86b8;
