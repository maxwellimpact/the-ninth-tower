// Tiny 3x5 pixel font, rendered into an atlas with a 1px ink outline
// (cell 5x7). Registered with Phaser as a RetroFont; also usable directly.
import Phaser from 'phaser';
import { makeCanvas, px, outline } from './pixel.js';

const G = {
  "A": ".#.#.#####.##.#",
  "B": "##.#.###.#.###.",
  "C": ".###..#..#...##",
  "D": "##.#.##.##.###.",
  "E": "####..##.#..###",
  "F": "####..##.#..#..",
  "G": ".###..#.##.#.##",
  "H": "#.##.#####.##.#",
  "I": "###.#..#..#.###",
  "J": "..#..#..##.#.#.",
  "K": "#.##.###.#.##.#",
  "L": "#..#..#..#..###",
  "M": "#.########.##.#",
  "N": "#.###########.#",
  "O": ".#.#.##.##.#.#.",
  "P": "##.#.###.#..#..",
  "Q": ".#.#.##.###..##",
  "R": "##.#.###.#.##.#",
  "S": ".###...#...###.",
  "T": "###.#..#..#..#.",
  "U": "#.##.##.##.####",
  "V": "#.##.##.##.#.#.",
  "W": "#.##.##.#####.#",
  "X": "#.##.#.#.#.##.#",
  "Y": "#.##.#.#..#..#.",
  "Z": "###..#.#.#..###",
  "0": "####.##.##.####",
  "1": ".#.##..#..#.###",
  "2": "##...#.#.#..###",
  "3": "##...#.#...###.",
  "4": "#.##.####..#..#",
  "5": "####..##...###.",
  "6": ".###..####.####",
  "7": "###..#.#..#..#.",
  "8": "####.#####.####",
  "9": "####.####..###.",
  ".": ".............#.",
  ",": "..........#.#..",
  "!": ".#..#..#.....#.",
  "?": "##...#.#.....#.",
  "'": ".#..#..........",
  "-": "......###......",
  "+": "....#.###.#....",
  ":": "....#.....#....",
  "/": "..#..#.#.#..#..",
  "(": ".#.#..#..#...#.",
  ")": ".#...#..#..#.#.",
  "\"": "#.##.#.........",
  " ": "...............",
  ">": "#...#...#.#.#..",
  "<": "..#.#.#...#...#",
  "*": "...#.#.#.#.#...",
  "%": "#.#..#.#.#..#.#",
  "#": "#.#####.#####.#",
  "&": ".#.#.#.#.#.#.##", // the narrow fallback (GLYPHS); text draws the wide one below
  ";": "....#.....#.#..",
  "~": "...##..##......",
};

// "&" is too intricate for 3 pixels, so text draws it across two cells: a
// wider ampersand (4 or 5 pixels) centred in the pair, drawn whole before the outline so the
// two cells join seamlessly. BitmapText swaps each "&" for the pair as it's set.
const AMP = ['.#...', '#.#..', '.#...', '#.#.#', '.#.#.'];
const AMP_L = '\uE000', AMP_R = '\uE001';
export const AMP_PAIR = AMP_L + AMP_R;
export const FONT_CHARS = Object.keys(G).join('') + AMP_PAIR;
export const GLYPHS = G; // 3x5 shapes, for drawing tiny digits straight into a Graphics
export const CELL_W = 5, CELL_H = 7;

export function buildFontAtlas(color = 'white', edge = 'ink') {
  const n = FONT_CHARS.length;
  const [c, ctx] = makeCanvas(n * CELL_W, CELL_H);
  [...FONT_CHARS].forEach((ch, i) => {
    const g = G[ch];
    if (g) for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '#') px(ctx, i * CELL_W + 1 + x, 1 + y, color);
    if (ch === AMP_L) { const w = AMP[0].length, ox = i * CELL_W + 1 + Math.floor((8 - w) / 2); for (let y = 0; y < 5; y++) for (let x = 0; x < w; x++) if (AMP[y][x] === '#') px(ctx, ox + x, 1 + y, color); }
  });
  if (edge) outline(c, edge, true);
  return c;
}

// Register with Phaser as a RetroFont bitmap font.
export function registerFont(scene, key, color = 'white', edge = 'ink') {
  const atlas = buildFontAtlas(color, edge);
  scene.textures.addCanvas(key, atlas);
  const cfg = {
    image: key,
    width: CELL_W,
    height: CELL_H,
    chars: FONT_CHARS,
    charsPerRow: FONT_CHARS.length,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 1,
  };
  scene.cache.bitmapFont.add(key, Phaser.GameObjects.RetroFont.Parse(scene, cfg));
  const BT = Phaser.GameObjects.BitmapText.prototype;
  if (!BT.ampPatched) {
    const set = BT.setText;
    BT.setText = function (value) { return set.call(this, typeof value === 'string' && value.includes('&') ? value.replace(/&/g, AMP_PAIR) : value); };
    BT.ampPatched = true;
  }
}

// how many cells a string takes in the pixel font ("&" takes two)
export const cellCount = (str) => str.length + (str.match(/&/g)?.length || 0);
