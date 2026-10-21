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
  "&": ".#.#.#.#.##..##",
  ";": "....#.....#.#..",
  "~": "...##..##......",
};

export const FONT_CHARS = Object.keys(G).join('');
export const GLYPHS = G; // 3x5 shapes, for drawing tiny digits straight into a Graphics
export const CELL_W = 5, CELL_H = 7;

export function buildFontAtlas(color = 'white', edge = 'ink') {
  const n = FONT_CHARS.length;
  const [c, ctx] = makeCanvas(n * CELL_W, CELL_H);
  [...FONT_CHARS].forEach((ch, i) => {
    const g = G[ch];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y * 3 + x] === '#') px(ctx, i * CELL_W + 1 + x, 1 + y, color);
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
}
