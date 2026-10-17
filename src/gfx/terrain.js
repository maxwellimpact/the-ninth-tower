// Per-pixel terrain painter. Renders the tile map into 256px chunk canvases
// with organic (noise-jittered) boundaries between soft terrains, water depth
// bands, cliff strata, paving and wall faces. Pure function of the map, so
// chunks can be painted lazily as the camera streams through a large world.
import { rgb, curseRGB } from './palette.js';
import { hash, vnoise, bayer, makeCanvas } from './pixel.js';
import { T, TILE, SOFT, MAP_W, MAP_H, SOUTH_Y, RIDGE_X, AREAS } from '../world/map.js';

export const CHUNK = 256;

const C = {};
for (const k of ['grassD', 'grass', 'grassL', 'grassXL', 'leafD', 'leaf', 'dirtD', 'dirt', 'dirtL', 'sand', 'waterD', 'water', 'waterL', 'foam',
  'stone', 'slate', 'mist', 'bone', 'night', 'ink', 'white', 'gold', 'redL', 'blueL', 'purpL', 'woodD', 'wood', 'woodL',
  'mossD', 'moss', 'mossL', 'mossXL', 'mudD', 'mud', 'bogD', 'bog', 'bogL', 'bogXL', 'reed', 'caveD', 'cave', 'caveL', 'caveXL', 'hexD',
  'gloomD', 'gloom', 'gloomL', 'gloomXL', 'fernD', 'fern', 'fernL', 'barkD', 'bark', 'barkL']) C[k] = rgb(k);

export function makeTerrainPainter(world) {
  const at = world.at;
  const W = MAP_W * TILE, H = MAP_H * TILE;

  const tileAtPx = (px, py) => at(Math.floor(px / TILE), Math.floor(py / TILE));

  // Terrain type for a pixel, with soft terrains jittered for organic edges.
  function typeAt(px, py) {
    const t = tileAtPx(px, py);
    if (!SOFT.has(t)) return t;
    const jx = (vnoise(px / 11, py / 11, 1) - 0.5) * 12;
    const jy = (vnoise(px / 11, py / 11, 2) - 0.5) * 12;
    const j = tileAtPx(px + jx, py + jy);
    return SOFT.has(j) ? j : t;
  }

  function grassColor(x, y, lift = 0) {
    // broad, low-contrast patches + sparse blade flecks (not camo noise)
    const n = vnoise(x / 56, y / 56, 4) * 0.8 + vnoise(x / 14, y / 14, 5) * 0.2 + lift;
    const v = n + (bayer(x, y) - 0.5) * 0.1;
    const h = hash(x, y, 6);
    if (h < 0.01) return C.grassL;
    if (h < 0.018 && hash(x, y - 1, 6) >= 0.01) return C.grassD;
    return v < 0.27 ? C.grassD : v < 0.7 ? C.grass : C.grassL;
  }

  // Gloamwood floor: blue-black loam under leaf litter, with cold moss where
  // light gets through. Clearings (GRASS) there are mossy, never vale-green.
  function gloamColor(x, y, clearing) {
    const n = vnoise(x / 40, y / 40, 150) * 0.7 + vnoise(x / 9, y / 9, 151) * 0.3 + (bayer(x, y) - 0.5) * 0.12;
    const h = hash(x, y, 152);
    if (clearing) {
      if (h < 0.012) return C.fernL;
      return n < 0.35 ? C.fernD : n < 0.72 ? C.fern : C.gloomXL;
    }
    if (h < 0.02) return C.barkD; // twigs
    if (h < 0.032) return hash(x, y, 153) < 0.5 ? C.mudD : C.fernD; // fallen leaves
    return n < 0.3 ? C.gloomD : n < 0.66 ? C.gloom : C.gloomL;
  }

  const WR = AREAS.witchroot;
  const inWitchroot = (tx, ty) => tx >= WR.x0 && tx <= WR.x1 && ty >= WR.y0 && ty <= WR.y1;

  function pixel(x, y) {
    const t = typeAt(x, y);
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const lx = x - tx * TILE, ly = y - ty * TILE;
    const gloam = ty >= SOUTH_Y && tx < RIDGE_X;
    if (t === T.LOAM || (gloam && t === T.GRASS)) {
      // a dark rim where the floor meets a road
      if (typeAt(x, y + 2) === T.PATH || typeAt(x, y - 2) === T.PATH || typeAt(x - 2, y) === T.PATH || typeAt(x + 2, y) === T.PATH) return C.gloomD;
      return gloamColor(x, y, t === T.GRASS);
    }
    switch (t) {
      case T.GRASS:
      case T.PLATEAU: {
        if (t === T.PLATEAU && ty >= 64) {
          // mossy rock top in the fen
          const n = vnoise(x / 20, y / 20, 93) + (bayer(x, y) - 0.5) * 0.15;
          if (tileAtPx(x, y - 2) === T.RIM || tileAtPx(x - 2, y) === T.RIM || tileAtPx(x + 2, y) === T.RIM) return C.mossD;
          // raised rock: bare stone with moss pockets, lighter toward the front lip
          const lip = tileAtPx(x, y + 3) === T.CLIFF;
          if (lip) return tileAtPx(x, y + 1) === T.CLIFF ? C.mist : C.bone;
          const m = vnoise(x / 9, y / 9, 95) + (bayer(x, y) - 0.5) * 0.2;
          if (m > 0.62) return n < 0.5 ? C.moss : C.mossL;
          if (hash(x, y, 94) < 0.03) return C.slate;
          return n < 0.35 ? C.slate : n < 0.8 ? C.stone : C.mist;
        }
        let c = grassColor(x, y, t === T.PLATEAU ? 0.22 : 0);
        // darker lip where grass meets a path/sand edge
        if (typeAt(x, y + 2) === T.PATH || typeAt(x, y - 2) === T.PATH || typeAt(x - 2, y) === T.PATH || typeAt(x + 2, y) === T.PATH) c = C.grassD;
        // ambient occlusion under walls / cliffs
        const above = tileAtPx(x, y - 6), above2 = tileAtPx(x, y - 12);
        if ((above === T.WALL || above === T.CLIFF) && tileAtPx(x, y) !== above && bayer(x, y) < 0.7) c = C.leafD;
        else if (above2 === T.CLIFF && tileAtPx(x, y) !== T.CLIFF && bayer(x, y) < 0.35) c = C.grassD;
        // plateau rim highlight along its edges
        if (t === T.PLATEAU && (tileAtPx(x, y - 2) === T.RIM || tileAtPx(x - 2, y) === T.RIM || tileAtPx(x + 2, y) === T.RIM)) c = C.grassD;
        return c;
      }
      case T.PATH: {
        if (gloam) {
          // a trodden forest track: dark mud with root ridges, not sandy dirt
          const edgeG = typeAt(x + 2, y) !== T.PATH || typeAt(x - 2, y) !== T.PATH || typeAt(x, y + 2) !== T.PATH || typeAt(x, y - 2) !== T.PATH;
          if (edgeG) return C.gloomD;
          const hg = hash(x, y, 154);
          if (hg < 0.03) return C.barkD;
          if (hg < 0.06) return C.dirtD;
          const ng = vnoise(x / 14, y / 14, 155) + (bayer(x, y) - 0.5) * 0.2;
          return ng > 0.66 ? C.dirtD : ng > 0.3 ? C.mud : C.mudD;
        }
        const edge = typeAt(x + 2, y) !== T.PATH || typeAt(x - 2, y) !== T.PATH || typeAt(x, y + 2) !== T.PATH || typeAt(x, y - 2) !== T.PATH;
        if (edge) return C.dirtD;
        const h = hash(x, y, 8);
        if (h < 0.035) return C.dirtD;
        if (h < 0.08) return C.dirtL;
        const n = vnoise(x / 14, y / 14, 9) + (bayer(x, y) - 0.5) * 0.2;
        return n > 0.62 ? C.dirtL : C.dirt;
      }
      case T.SAND: {
        if (typeAt(x, y + 3) === T.WATER || typeAt(x, y - 3) === T.WATER || typeAt(x + 3, y) === T.WATER || typeAt(x - 3, y) === T.WATER) return C.dirtL;
        const h = hash(x, y, 10);
        return h < 0.05 ? C.dirtL : h < 0.07 ? C.bone : C.sand;
      }
      case T.WATER: {
        // foam right at the shore, light shallows, dithered deep
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (typeAt(x + dx, y + dy) !== T.WATER) return C.foam;
        for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3]]) if (typeAt(x + dx, y + dy) !== T.WATER) return C.waterL;
        // smooth depth: probe rings at increasing radii for the shoreline
        let lvl = 2;
        for (const [r, l] of [[9, 0], [20, 1]]) {
          let hit = false;
          for (let a = 0; a < 8 && !hit; a++) {
            const ang = a * 0.785 + 0.3;
            if (typeAt(x + Math.cos(ang) * r, y + Math.sin(ang) * r) !== T.WATER) hit = true;
          }
          if (hit) { lvl = l; break; }
        }
        if (hash(Math.floor(x / 6), y, 13) < 0.02 && lvl > 0) return C.waterL; // ripples
        if (lvl === 0) return C.water;
        if (lvl === 1) return bayer(x, y) < 0.3 ? C.waterD : C.water;
        return bayer(x, y) < 0.85 ? C.waterD : C.water;
      }
      case T.CLIFF: {
        const top = at(tx, ty - 1) !== T.CLIFF; // first face row
        const fy = top ? ly : ly + TILE;     // 0..31 down the face
        if (fy < 3) return hash(x, 0, 14) < 0.5 || fy < 2 ? C.grassD : C.leafD; // grass overhang drips
        if (fy > 28) return C.night;
        if (hash(Math.floor(x / 1), 0, 15) < 0.06 && fy > 6) return C.slate; // vertical cracks
        const band = Math.floor((fy + vnoise(x / 6, 0, 16) * 4) / 6);
        const lit = (fy + Math.floor(vnoise(x / 6, 0, 16) * 4)) % 6 === 0;
        if (lit) return C.mist;
        return band % 2 ? C.stone : C.slate;
      }
      case T.RIM: {
        // side cliff: rock wall seen edge-on, grass lip on the plateau side
        if (at(tx, ty + 1) === T.PLATEAU) {
          // back edge of a raised shelf: only its top lip shows from above
          const d = TILE - 1 - ly;
          if (d < 2) return C.grassD;
          if (d < 4) return C.mist;
          if (d < 11) return (x + Math.floor(vnoise(x / 6, ty, 18) * 4)) % 7 === 0 ? C.slate : C.stone;
          return d < 13 ? C.slate : C.leafD;
        }
        const plateauRight = at(tx + 1, ty) === T.PLATEAU;
        const d = plateauRight ? TILE - 1 - lx : lx; // distance from the plateau edge
        if (d < 2) return C.grassD;
        if (d > 13) return C.leafD;
        const band = Math.floor((y + vnoise(0, y / 6, 17) * 4) / 6);
        if ((y + Math.floor(vnoise(0, y / 6, 17) * 4)) % 6 === 0) return plateauRight ? C.slate : C.mist;
        if (d > 11) return C.night;
        return band % 2 ? C.stone : C.slate;
      }
      case T.STAIRS: {
        if (lx < 2 || lx > 13) return C.slate;
        const s = (y % 6);
        return s < 2 ? C.bone : s < 5 ? C.stone : C.slate;
      }
      case T.PAVED: {
        const row = Math.floor(y / 8);
        const ox = (row % 2) * 4;
        const cx = Math.floor((x + ox) / 8);
        const mortar = y % 8 === 7 || (x + ox) % 8 === 7;
        const missing = hash(cx, row, 17) < 0.08;
        if (missing) return hash(x, y, 18) < 0.3 ? C.dirtD : C.dirt;
        if (mortar) return hash(x, y, 19) < 0.25 ? C.grass : C.slate;
        const tint = hash(cx, row, 20);
        if (hash(x, y, 21) < 0.03) return C.slate; // cracks / pits
        if ((x + ox) % 8 === 0 || y % 8 === 0) return C.mist;
        return tint < 0.33 ? C.stone : tint < 0.9 ? C.mist : C.bone;
      }
      case T.WALL: {
        const faceBelow = at(tx, ty + 1) !== T.WALL;
        if (!faceBelow || ly < 6) {
          // wall top: capstones
          if (ly === 0 || lx % 8 === 0) return C.stone;
          return ly < 2 ? C.white : C.bone;
        }
        // front face brickwork
        const fy = ly - 6;
        if (fy === 0) return C.slate;
        const row = Math.floor(fy / 4);
        const mortar = fy % 4 === 3 || (lx + (row % 2) * 4) % 8 === 0;
        if (mortar) return C.slate;
        return ly > 13 ? C.slate : lx < 3 ? C.mist : C.stone;
      }
      case T.FLOOR: {
        // planks: 5px rows, staggered seams, a little grain
        const row = Math.floor(y / 5);
        const off = (row * 37) % 23;
        if (y % 5 === 4) return C.woodD;
        if ((x + off) % 23 === 0) return C.woodD;
        const plank = Math.floor((x + off) / 23);
        if (tileAtPx(x, y - 5) === T.IWALL && bayer(x, y) < 0.6) return C.woodD; // shadow under the wall
        if (hash(x, row, 95) < 0.04) return C.woodD;
        return hash(plank, row, 96) < 0.35 ? C.woodL : C.wood;
      }
      case T.IWALL: {
        const faceBelow = at(tx, ty + 1) === T.FLOOR || at(tx, ty + 2) === T.FLOOR;
        if (!faceBelow) return hash(x, y, 97) < 0.1 ? C.caveD : C.night;
        // two-tile tall plaster wall with timber beams and a skirting board
        const fy = at(tx, ty + 1) === T.FLOOR ? ly + TILE : ly;
        if (fy < 2) return C.woodD;
        if (fy > 28) return C.woodD;
        if (fy > 25) return C.wood;
        if (x % 32 < 3) return C.woodD;
        if (fy === 13 || fy === 14) return C.wood;
        return (x + fy) % 9 === 0 && hash(x, fy, 98) < 0.4 ? C.mist : C.bone;
      }
      case T.HOUSE: return bayer(x, y) < 0.5 ? C.slate : C.stone;
      case T.DFLOOR: {
        if (inWitchroot(tx, ty)) {
          // packed earth between the roots, with root tendrils crossing it
          const up = tileAtPx(x, y - 6);
          if (up === T.DWALL && bayer(x, y) < 0.75) return C.gloomD; // shadow under the root wall
          const r = Math.abs(Math.sin(x * 0.11 + vnoise(x / 30, y / 30, 160) * 6) * 9 - (y % 37)) < 0.9;
          if (r && hash(Math.floor(x / 9), Math.floor(y / 9), 161) < 0.5) return hash(x, y, 162) < 0.3 ? C.barkL : C.bark;
          const n = vnoise(x / 18, y / 18, 163) + (bayer(x, y) - 0.5) * 0.18;
          if (hash(x, y, 164) < 0.025) return C.fernD;
          return n < 0.3 ? C.mudD : n < 0.7 ? C.mud : C.dirtD;
        }
        // dungeon flagstones: big worn slabs, dark mortar, moss in the cracks
        const row = Math.floor(y / 10), ox = (row % 2) * 6;
        const cx = Math.floor((x + ox) / 12);
        if (y % 10 === 9 || (x + ox) % 12 === 11) return hash(x, y, 120) < 0.18 ? C.mossD : C.night;
        const up = tileAtPx(x, y - 6);
        if (up === T.DWALL && bayer(x, y) < 0.7) return C.night; // shadow under the wall
        if (hash(x, y, 121) < 0.02) return C.slate;
        const tint = hash(cx, row, 122);
        if ((x + ox) % 12 === 0 || y % 10 === 0) return C.stone;
        return tint < 0.45 ? C.slate : tint < 0.9 ? C.stone : C.mist;
      }
      case T.DWALL: {
        if (inWitchroot(tx, ty)) {
          // a wall of tangled roots: dark mass on top, a face of braided roots
          const faceBelowW = at(tx, ty + 1) === T.DFLOOR || at(tx, ty + 2) === T.DFLOOR || at(tx, ty + 1) === T.STAIRS;
          if (!faceBelowW) { const n = vnoise(x / 6, y / 6, 165) + (bayer(x, y) - 0.5) * 0.3; return n > 0.7 ? C.barkD : n > 0.42 ? C.gloomD : C.ink; }
          const fy = at(tx, ty + 1) === T.DFLOOR || at(tx, ty + 1) === T.STAIRS ? ly + TILE : ly;
          if (fy > 29) return C.ink;
          // braided strands running down the face, each lit on its left edge
          const strand = (x + Math.round(Math.sin(fy * 0.35 + Math.floor(x / 5)) * 1.5)) % 5;
          if (fy < 3) return hash(x, 0, 166) < 0.4 ? C.fern : C.barkL; // moss on the lip
          if (strand === 0) return C.ink;
          if (strand === 1) return C.barkL;
          if (hash(Math.floor(x / 5), Math.floor(fy / 4) + ty * 11, 167) < 0.08) return C.fernD;
          return strand === 4 ? C.barkD : C.bark;
        }
        const faceBelow = at(tx, ty + 1) === T.DFLOOR || at(tx, ty + 2) === T.DFLOOR || at(tx, ty + 1) === T.STAIRS;
        if (!faceBelow) { const n = vnoise(x / 7, y / 7, 123) + (bayer(x, y) - 0.5) * 0.3; return n > 0.72 ? C.slate : n > 0.4 ? C.night : C.ink; }
        // two-tile face of heavy blocks with a lit capstone edge
        const fy = at(tx, ty + 1) === T.DFLOOR || at(tx, ty + 1) === T.STAIRS ? ly + TILE : ly;
        if (fy < 2) return C.mist;
        if (fy < 4) return C.stone;
        if (fy > 29) return C.ink;
        const brow = Math.floor((fy - 4) / 6), bx = (x + (brow % 2) * 7) % 14;
        if ((fy - 4) % 6 === 5 || bx === 0) return C.night;
        if (hash(Math.floor((x + (brow % 2) * 7) / 14), brow + ty * 7, 124) < 0.12 && fy > 20) return C.mossD;
        return bx < 2 ? C.stone : C.slate;
      }
      case T.MARSH: {
        // olive moss with mud patches; darker lip at paths and water
        const n = vnoise(x / 40, y / 40, 80) * 0.7 + vnoise(x / 10, y / 10, 81) * 0.3 + (bayer(x, y) - 0.5) * 0.1;
        const h = hash(x, y, 82);
        let c = h < 0.012 ? C.mossXL : h < 0.025 ? C.mossD : n < 0.3 ? C.mud : n < 0.42 ? C.mossD : n < 0.72 ? C.moss : C.mossL;
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
          const o = typeAt(x + dx, y + dy);
          if (o === T.PATH) c = C.mossD;
          if (o === T.SHALLOW || o === T.BOG) c = C.mudD;
        }
        const above = tileAtPx(x, y - 6), above2 = tileAtPx(x, y - 12);
        if ((above === T.WALL || above === T.CLIFF || above === T.MOUTH) && tileAtPx(x, y) !== above && bayer(x, y) < 0.7) c = C.mossD;
        else if (above2 === T.CLIFF && bayer(x, y) < 0.35) c = C.mud;
        if (tileAtPx(x, y + 4) === T.CHASM && bayer(x, y) < 0.5) c = C.mossD;
        return c;
      }
      case T.SHALLOW: {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = typeAt(x + dx, y + dy); if (o !== T.SHALLOW && o !== T.BOG) return C.bogL; }
        if (hash(Math.floor(x / 5), y, 83) < 0.03) return C.bogXL;
        const n = vnoise(x / 9, y / 9, 84) + (bayer(x, y) - 0.5) * 0.25;
        return n > 0.6 ? C.bogL : C.bog;
      }
      case T.BOG: {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = typeAt(x + dx, y + dy); if (o !== T.SHALLOW && o !== T.BOG) return C.bogL; }
        for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (typeAt(x + dx, y + dy) !== T.BOG) return C.bog;
        if (hash(Math.floor(x / 4), y, 85) < 0.02) return C.bogL;
        return bayer(x, y) < 0.8 ? C.bogD : C.bog;
      }
      case T.CHASM: {
        // south-facing rock wall just below the lip, then darkness
        let dTop = 0;
        while (dTop < 20 && tileAtPx(x, y - dTop - 1) === T.CHASM) dTop++;
        if (dTop < 2) return C.mossD;
        if (dTop < 12) {
          const band = Math.floor((dTop + vnoise(x / 5, 0, 86) * 3) / 4);
          return dTop === 2 ? C.stone : band % 2 ? C.slate : C.stone;
        }
        const side = tileAtPx(x - 3, y) !== T.CHASM || tileAtPx(x + 3, y) !== T.CHASM;
        if (side) return C.slate;
        const v = (dTop - 12) / 10 + (bayer(x, y) - 0.5) * 0.4;
        return v < 0.3 ? C.night : v < 0.7 ? C.hexD : C.ink;
      }
      case T.CAVEFLOOR: {
        const above = tileAtPx(x, y - 5);
        if (above === T.CAVEWALL && bayer(x, y) < 0.75) return C.caveD;
        const h = hash(x, y, 87);
        if (h < 0.03) return C.caveXL;
        if (h < 0.07) return C.caveD;
        const n = vnoise(x / 12, y / 12, 88) + (bayer(x, y) - 0.5) * 0.2;
        return n > 0.62 ? C.caveL : C.cave;
      }
      case T.CAVEWALL: {
        const faceBelow = at(tx, ty + 1) === T.CAVEFLOOR;
        if (faceBelow && ly >= 4) {
          const fy = ly - 4;
          if (fy === 0) return C.caveXL;
          const band = Math.floor((fy + vnoise(x / 5, ty, 89) * 3) / 4);
          return fy > 9 ? C.caveD : band % 2 ? C.caveL : C.cave;
        }
        // rock top: rough, very dark
        const n = vnoise(x / 6, y / 6, 90) + (bayer(x, y) - 0.5) * 0.3;
        return n > 0.7 ? C.cave : n > 0.45 ? C.caveD : C.ink;
      }
      case T.BRIDGE: {
        const horiz = tileAtPx(x - 16, y) === T.BRIDGE || tileAtPx(x + 16, y) === T.BRIDGE;
        const along = horiz ? y : x, across = horiz ? x : y;
        const edge0 = horiz ? tileAtPx(x, y - 16) !== T.BRIDGE && ly < 2 : tileAtPx(x - 16, y) !== T.BRIDGE && lx < 2;
        const edge1 = horiz ? tileAtPx(x, y + 16) !== T.BRIDGE && ly > 13 : tileAtPx(x + 16, y) !== T.BRIDGE && lx > 13;
        if (edge0 || edge1) return C.woodD;
        if (across % 5 === 0) return C.woodD;
        return hash(Math.floor(across / 5), 0, 91) < 0.3 ? C.woodL : (along % 7 === 0 && hash(across, along, 92) < 0.2 ? C.woodD : C.wood);
      }
      case T.MOUTH: {
        // dark opening in the cliff face with a rocky arch
        const fy = at(tx, ty - 1) === T.MOUTH ? ly + TILE : ly;
        const fx = at(tx - 1, ty) === T.MOUTH ? lx + TILE : lx;
        const archY = 4 + Math.round(Math.pow((fx - 15.5) / 15.5, 2) * 10);
        if (fy < archY) return fy < archY - 2 ? (fy < 3 ? C.grassD : C.stone) : C.slate;
        return fy > 28 ? C.hexD : C.ink;
      }
    }
    return C.ink;
  }

  // Pure: RGBA pixels for one chunk (worker-safe, no DOM).
  function chunkPixels(cx, cy) {
    const d = new Uint8ClampedArray(CHUNK * CHUNK * 4);
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
      const wx = cx * CHUNK + x, wy = cy * CHUNK + y;
      const col = wx < W && wy < H ? pixel(wx, wy) : C.ink;
      const i = (y * CHUNK + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    return d;
  }

  // Pure: cursed version of a rectangle (world px). Pixels inside the curse
  // circle are transformed; a dithered falloff ring softens the boundary.
  function cursePixels(region, curse) {
    const { x: rx, y: ry, w, h } = region;
    const d = new Uint8ClampedArray(w * h * 4);
    const ccx = (curse.x + 0.5) * TILE, ccy = (curse.y + 0.5) * TILE, R = curse.r * TILE;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = rx + x, wy = ry + y;
      const dist = Math.hypot(wx - ccx, wy - ccy) + (vnoise(wx / 20, wy / 20, 30) - 0.5) * 40;
      const edge = (R - dist) / 40;
      if (edge <= 0 || (edge < 1 && bayer(wx, wy) > edge)) continue;
      let col = curseRGB(...pixel(wx, wy));
      if (vnoise(wx / 7, wy / 7, 31) > 0.78 && hash(wx, wy, 32) < 0.5) col = [86, 40, 120];
      const i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    return d;
  }

  // Main-thread helpers: wrap pixel buffers in canvases.
  function toCanvas(data, w, h) {
    const [c, ctx] = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    img.data.set(data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
  const paintChunk = (cx, cy) => toCanvas(chunkPixels(cx, cy), CHUNK, CHUNK);
  const paintCurse = (region, curse) => toCanvas(cursePixels(region, curse), region.w, region.h);

  return { chunkPixels, cursePixels, toCanvas, paintChunk, paintCurse, typeAt, width: W, height: H };
}
