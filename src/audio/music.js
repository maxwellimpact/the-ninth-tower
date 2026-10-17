// Adaptive music sequencer.
// A song is data: tracks of [step, midi, lengthInSteps, velocity] events on a
// 16-step-per-bar grid. Every track belongs to a LAYER ('base' | 'combat') and
// a VARIANT ('freed' | 'cursed'). The cursed variant is derived automatically
// from the freed (major) one by mapping it to the parallel minor, detuning and
// thinning it — so a region's theme "resolves" when its Ward Stone falls.
import { audio, midiHz } from './synth.js';

// ---------------------------------------------------------- note helpers
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function n(name) {
  const m = name.match(/^([A-G])(#|b)?(-?\d)$/);
  return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3]) + 1) * 12;
}
// C major -> C natural minor (E->Eb, A->Ab, B->Bb)
const toMinor = (m) => ([4, 9, 11].includes(((m % 12) + 12) % 12) ? m - 1 : m);

// Sequential melody: [['E4',4],['G4',4],...] -> events from step 0.
function seq(list, vel = 1, start = 0) {
  const ev = [];
  let s = start;
  for (const [name, len, v] of list) {
    if (name !== '-') ev.push([s, n(name), len, v ?? vel]);
    s += len;
  }
  return ev;
}

// ------------------------------------------------------------ theme builder
// Every region theme is written in C (so the cursed variant can be derived by
// mapping to the parallel minor) and shifted into its own key with `key`.
// Themes share the Vale's instruments and layering; each varies the tempo,
// chords, melody, accompaniment patterns and instrument colour.
const BARS = 8;
const chordsOf = (list) => list.map((c) => c.map(n));

const ARP = {
  // rolling eighths (the Vale)
  roll: (ch, b, ev) => {
    const tones = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[0] + 36];
    for (let i = 0; i < 16; i++) ev.push([b * 16 + i, tones[[0, 1, 2, 3, 2, 1, 0, 1][i % 8]], 1, i % 4 === 0 ? 0.9 : 0.6]);
  },
  // climbing sparkle, an octave up (Highmeadow)
  sparkle: (ch, b, ev) => {
    const tones = [ch[0] + 36, ch[1] + 36, ch[2] + 36, ch[0] + 48];
    for (let i = 0; i < 16; i++) ev.push([b * 16 + i, tones[[0, 1, 2, 3, 0, 2, 1, 3][i % 8]], 1, i % 4 === 0 ? 0.8 : 0.5]);
  },
  // slow, wide, hesitant (Mistfen)
  drift: (ch, b, ev) => {
    const tones = [ch[0] + 24, ch[2] + 24, ch[1] + 36, ch[2] + 24];
    for (let i = 0; i < 16; i += 4) ev.push([b * 16 + i, tones[i / 4], 3, i === 0 ? 0.8 : 0.5]);
  },
  // a single high drip or two per bar (caves and dungeons)
  drip: (ch, b, ev) => {
    ev.push([b * 16 + [3, 9, 5, 12][b % 4], ch[[2, 1, 0, 1][b % 4]] + 36, 1, 0.7]);
    if (b % 2) ev.push([b * 16 + 14, ch[0] + 48, 1, 0.4]);
  },
  // quiet ticking eighths, root and fifth up high: clockwork, a puzzle being worked (dungeons)
  clock: (ch, b, ev) => {
    for (let i = 0; i < 16; i += 2) ev.push([b * 16 + i, (i % 4 ? ch[2] : ch[0]) + 36, 1, i % 8 === 0 ? 0.75 : 0.4]);
  },
  // a wind-up music box: high, plucked, slightly uneven, as if the comb is worn (Gloamwood)
  musicbox: (ch, b, ev) => {
    const tones = [ch[0] + 36, ch[2] + 36, ch[1] + 48, ch[2] + 36, ch[0] + 48, ch[1] + 36];
    [0, 3, 5, 8, 11, 13].forEach((st, i) => ev.push([b * 16 + st, tones[(i + b) % 6], 1, i === 0 ? 0.85 : 0.45 + (i % 2) * 0.15]));
  },
  // an anvil: a bright ring on the off-beats with a quieter tap after (Cinderreach)
  anvil: (ch, b, ev) => {
    for (const st of [2, 6, 10, 14]) ev.push([b * 16 + st, ch[0] + 48, 1, st === 6 || st === 14 ? 0.9 : 0.55]);
    ev.push([b * 16 + 7, ch[2] + 36, 1, 0.35]);
  },
  // glass bells in three: a high chime on each "beat" of a slow waltz, with a
  // fainter shimmer an octave up after the first (Frosthelm). A bar of 16
  // steps is felt as three beats at 0, 5 and 11
  bells: (ch, b, ev) => {
    ev.push([b * 16, ch[0] + 48, 2, 0.8]);
    ev.push([b * 16 + 5, ch[2] + 36, 2, 0.5]);
    ev.push([b * 16 + 11, ch[1] + 36, 2, 0.5]);
    if (b % 2) ev.push([b * 16 + 2, ch[2] + 48, 1, 0.3]);
  },
  // lute strums on the beat (interiors)
  lute: (ch, b, ev) => {
    const tones = [ch[0] + 24, ch[2] + 24, ch[1] + 24, ch[2] + 24];
    for (let i = 0; i < 16; i += 2) ev.push([b * 16 + i, tones[(i / 2) % 4], 2, i % 4 === 0 ? 0.9 : 0.55]);
  },
};

const BASS = {
  walk: [[0, 'r', 3], [4, 'r8', 2], [6, 'f', 2], [8, 'r', 3], [12, 'f', 2], [14, 'r8', 2]],
  gallop: [[0, 'r', 2], [3, 'r', 1], [4, 'f', 2], [8, 'r', 2], [11, 'r', 1], [12, 'r8', 2], [14, 'f', 2]],
  murk: [[0, 'r', 7], [8, 'f', 6]],
  hollow: [[0, 'r', 12]],
  oompah: [[0, 'r', 2], [4, 'f', 2], [8, 'r', 2], [12, 'f', 2]],
  march: [[0, 'r', 3], [6, 'r', 1], [8, 'f', 3], [14, 'r', 1]],
  waltz: [[0, 'r', 5], [5, 'f', 4], [11, 'r8', 4]], // oom, pah, pah
};

function buildTheme(o) {
  const CH = chordsOf(o.chords);
  const melody = seq(o.melody);
  const arp = [];
  if (o.arp) CH.forEach((ch, b) => ARP[o.arp](ch, b, arp));
  const bass = [];
  CH.forEach((ch, b) => {
    const p = { r: ch[0] + 12, r8: ch[0] + 24, f: ch[2] + 12 };
    BASS[o.bass].forEach(([s, k, l]) => bass.push([b * 16 + s, p[k], l, 1]));
  });
  const cbass = [];
  CH.forEach((ch, b) => { for (let i = 0; i < 16; i += 2) cbass.push([b * 16 + i, ch[0] + 12 + (i % 8 === 6 ? 7 : 0), 1, i % 4 ? 0.7 : 1]); });
  const drums = [];
  for (let b = 0; b < BARS; b++) {
    for (const s of [0, 8, 10]) drums.push([b * 16 + s, 'kick', 1, 1]);
    for (const s of [4, 12]) drums.push([b * 16 + s, 'snare', 1, 1]);
    for (let s = 0; s < 16; s += 2) drums.push([b * 16 + s, 'hat', 1, s % 4 ? 0.6 : 1]);
    if (b % 4 === 3) for (const s of [13, 14, 15]) drums.push([b * 16 + s, 'snare', 1, 0.7]);
  }
  const x = o.inst || {};
  const tracks = [
    { inst: 'lead', layer: 'base', events: melody, o: x.lead },
    o.arp && { inst: 'arp', layer: 'base', events: arp, o: x.arp },
    { inst: 'bass', layer: 'base', events: bass, o: x.bass },
    { inst: 'pad', layer: 'base', events: CH.map((ch, b) => [b * 16, ch.map((m) => m + 12), 16, 1]), o: x.pad },
    { inst: 'sub', layer: 'base', events: CH.map((ch, b) => [b * 16, ch[0], 16, 1]), o: x.sub },
    { inst: 'drums', layer: 'combat', events: drums, o: x.drums },
    { inst: 'cbass', layer: 'combat', events: cbass },
    { inst: 'counter', layer: 'combat', events: melody.map(([s, m, l, v]) => [s, m + 12, l, v * 0.8]) },
    // the Bard's harp (once 10 townsfolk are home): broken chords an octave up
    { inst: 'harp', layer: 'bard', events: CH.flatMap((ch, b) => [0, 3, 6, 10].map((st2, k) => [b * 16 + st2, ch[k % 3] + 24 + (k === 3 ? 12 : 0), 2, k ? 0.6 : 0.9])) },
  ].filter(Boolean);
  return { name: o.name, bpm: o.bpm, key: o.key || 0, steps: BARS * 16, tracks };
}

// Brightwater Vale: the home theme — warm, walking, C major
export const VALE_THEME = buildTheme({
  name: 'Brightwater Vale', bpm: 100, key: 0, arp: 'roll', bass: 'walk',
  chords: [['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'],
    ['C3', 'E3', 'G3'], ['E2', 'G2', 'B2'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']],
  melody: [
    ['E4', 4], ['G4', 4], ['C5', 6], ['B4', 2],
    ['A4', 6], ['G4', 2], ['E4', 8],
    ['F4', 4], ['A4', 4], ['C5', 4], ['A4', 4],
    ['G4', 6], ['F4', 2], ['E4', 4], ['D4', 4],
    ['E4', 4], ['G4', 4], ['C5', 4], ['E5', 4],
    ['D5', 6], ['C5', 2], ['B4', 8],
    ['A4', 4], ['C5', 4], ['F4', 4], ['A4', 4],
    ['G4', 4], ['B4', 4], ['D5', 4], ['B4', 2], ['G4', 2],
  ],
});

// Highmeadow: brighter and more open — up a step, quicker, a flute-like lead
// with leaping lines over a galloping bass
export const MEADOW_THEME = buildTheme({
  name: 'Highmeadow', bpm: 114, key: 2, arp: 'sparkle', bass: 'gallop',
  chords: [['C3', 'E3', 'G3'], ['G2', 'B2', 'D3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'],
    ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']],
  melody: [
    ['G4', 4], ['C5', 4], ['E5', 4], ['D5', 2], ['C5', 2],
    ['D5', 6], ['B4', 2], ['G4', 8],
    ['A4', 4], ['C5', 4], ['E5', 6], ['D5', 2],
    ['C5', 4], ['A4', 4], ['F4', 8],
    ['G4', 2], ['A4', 2], ['C5', 4], ['E5', 4], ['G5', 4],
    ['F5', 4], ['E5', 2], ['D5', 2], ['B4', 8],
    ['A4', 4], ['C5', 4], ['F5', 4], ['E5', 4],
    ['D5', 6], ['B4', 2], ['G4', 4], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 1.5, vibrato: 0.02, echo: 0.3 }, arp: { vol: 0.8 }, pad: { cutoff: 2200 } },
});

// Mistfen: slow and murky — down a step, minor-leaning progression, long
// echoing lead notes, a heavy dark pad and a bass that barely moves
export const MISTFEN_THEME = buildTheme({
  name: 'Mistfen', bpm: 78, key: -2, arp: 'drift', bass: 'murk',
  chords: [['A2', 'C3', 'E3'], ['E2', 'G2', 'B2'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'],
    ['D2', 'F2', 'A2'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']],
  melody: [
    ['E4', 8], ['A4', 4], ['G4', 4],
    ['B4', 12], ['G4', 4],
    ['A4', 6], ['G4', 2], ['F4', 8],
    ['E4', 12], ['-', 4],
    ['D4', 4], ['F4', 4], ['A4', 8],
    ['C5', 6], ['B4', 2], ['A4', 8],
    ['A4', 4], ['G4', 4], ['F4', 4], ['E4', 4],
    ['D4', 8], ['B3', 4], ['-', 4],
  ],
  inst: { lead: { duty: 0.125, vibrato: 0.022, echo: 0.42, vol: 0.9 }, arp: { echo: 0.35, vol: 0.9 }, pad: { vol: 1.6, cutoff: 850 }, sub: { vol: 1.3 } },
});

// The deep places (caves, the Undercroft, the Abbey, the grotto): sparse and
// echoing — slow, hollow bass, water-drip notes and a distant lead
export const DEPTHS_THEME = buildTheme({
  name: 'The Depths', bpm: 70, key: -5, arp: 'drip', bass: 'hollow',
  chords: [['A2', 'C3', 'E3'], ['D2', 'F2', 'A2'], ['A2', 'C3', 'E3'], ['E2', 'G2', 'B2'],
    ['F2', 'A2', 'C3'], ['D2', 'F2', 'A2'], ['E2', 'G2', 'B2'], ['A2', 'C3', 'E3']],
  melody: [
    ['-', 4], ['E5', 2], ['-', 2], ['A4', 8],
    ['-', 8], ['D5', 4], ['C5', 4],
    ['E5', 12], ['-', 4],
    ['-', 4], ['B4', 4], ['G4', 8],
    ['-', 4], ['A4', 2], ['C5', 2], ['F5', 8],
    ['-', 8], ['E5', 4], ['D5', 4],
    ['B4', 12], ['-', 4],
    ['-', 4], ['C5', 4], ['A4', 8],
  ],
  inst: { lead: { type: 'triangle', vol: 1.1, echo: 0.55, vibrato: 0.006 }, arp: { echo: 0.5, vol: 1.6 }, bass: { vol: 0.8 }, pad: { vol: 1.3, cutoff: 600 } },
});

// Dungeons (the Undercroft first): a stately minor march with a ticking
// clockwork ostinato under it, for rooms that are puzzles as much as fights
export const UNDERCROFT_THEME = buildTheme({
  name: 'The Undercroft', bpm: 88, key: -4, arp: 'clock', bass: 'march',
  chords: [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['E2', 'G#2', 'B2'],
    ['A2', 'C3', 'E3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2'], ['A2', 'C3', 'E3']],
  melody: [
    ['A4', 4], ['E4', 2], ['A4', 2], ['C5', 6], ['B4', 2],
    ['A4', 4], ['F4', 4], ['C5', 8],
    ['B4', 4], ['G4', 2], ['B4', 2], ['D5', 6], ['C5', 2],
    ['B4', 6], ['G#4', 2], ['E4', 8],
    ['A4', 4], ['C5', 2], ['E5', 2], ['A5', 6], ['G5', 2],
    ['F5', 4], ['D5', 4], ['A4', 8],
    ['G#4', 4], ['B4', 4], ['E5', 4], ['D5', 2], ['B4', 2],
    ['A4', 12], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 1.2, echo: 0.4, vibrato: 0.01 }, arp: { vol: 0.7, echo: 0.3 }, bass: { vol: 1.0 }, pad: { vol: 1.1, cutoff: 700 } },
});

// The Sunken Abbey: a drowned hymn - slow and wide, a hollow organ-like pad
// under drifting water notes, the melody rising like a half-remembered psalm
export const ABBEY_THEME = buildTheme({
  name: 'The Sunken Abbey', bpm: 64, key: -3, arp: 'drift', bass: 'hollow',
  chords: [['D2', 'F2', 'A2'], ['A2', 'C3', 'E3'], ['B2', 'D3', 'F3'], ['F2', 'A2', 'C3'],
    ['G2', 'B2', 'D3'], ['D2', 'F2', 'A2'], ['A2', 'C#3', 'E3'], ['D2', 'F2', 'A2']],
  melody: [
    ['D4', 6], ['E4', 2], ['F4', 8],
    ['E4', 4], ['C4', 4], ['A3', 8],
    ['B3', 4], ['D4', 4], ['F4', 6], ['E4', 2],
    ['C4', 12], ['-', 4],
    ['D4', 4], ['G4', 4], ['F4', 4], ['E4', 4],
    ['F4', 6], ['D4', 2], ['A3', 8],
    ['C#4', 4], ['E4', 4], ['A4', 6], ['G4', 2],
    ['F4', 4], ['E4', 4], ['D4', 8],
  ],
  inst: { lead: { type: 'triangle', vol: 1.15, echo: 0.6, vibrato: 0.008 }, arp: { vol: 1.2, echo: 0.55 }, bass: { vol: 0.85 }, pad: { vol: 1.6, cutoff: 650 } },
});

// Gloamwood: hushed and uneasy - a worn music box over a hollow drone, the
// melody wandering through the minor with a few wrong-sounding turns
export const GLOAMWOOD_THEME = buildTheme({
  name: 'Gloamwood', bpm: 70, key: -6, arp: 'musicbox', bass: 'hollow',
  chords: [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2'],
    ['A2', 'C3', 'E3'], ['C3', 'E3', 'G3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2']],
  melody: [
    ['-', 4], ['E4', 4], ['A4', 6], ['G#4', 2],
    ['A4', 4], ['C5', 4], ['F4', 8],
    ['-', 4], ['D4', 4], ['F4', 4], ['A4', 4],
    ['G#4', 10], ['E4', 2], ['-', 4],
    ['-', 4], ['A4', 4], ['C5', 6], ['B4', 2],
    ['C5', 4], ['E5', 4], ['G4', 8],
    ['F4', 4], ['A4', 4], ['D5', 4], ['C5', 2], ['A4', 2],
    ['B4', 12], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 0.95, echo: 0.6, vibrato: 0.012 }, arp: { echo: 0.55, vol: 1.3 }, bass: { vol: 0.7 }, pad: { vol: 1.2, cutoff: 560 }, sub: { vol: 1.1 } },
});

// Cinderreach: a low, hot drone with an anvil ringing on the off-beats, a
// stern melody in the Phrygian minor, like a smith's work song
export const CINDERREACH_THEME = buildTheme({
  name: 'Cinderreach', bpm: 84, key: -7, arp: 'anvil', bass: 'march',
  chords: [['E2', 'G2', 'B2'], ['F2', 'A2', 'C3'], ['E2', 'G2', 'B2'], ['D2', 'F2', 'A2'],
    ['C2', 'E2', 'G2'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['E2', 'G#2', 'B2']],
  melody: [
    ['E4', 4], ['F4', 4], ['E4', 8],
    ['C5', 6], ['B4', 2], ['A4', 8],
    ['G4', 4], ['F4', 4], ['E4', 4], ['D4', 4],
    ['E4', 12], ['-', 4],
    ['C4', 4], ['E4', 4], ['G4', 8],
    ['F4', 4], ['A4', 4], ['C5', 8],
    ['B4', 6], ['A4', 2], ['G4', 4], ['F4', 4],
    ['E4', 12], ['-', 4],
  ],
  inst: { lead: { duty: 0.25, vibrato: 0.01, echo: 0.3, vol: 0.95 }, arp: { vol: 0.8, echo: 0.2 }, bass: { vol: 1.15 }, pad: { vol: 1.1, cutoff: 480 }, sub: { vol: 1.5 } },
});

// Frosthelm: a slow waltz on glass bells over a cold, wide pad, the melody
// turning in threes like skaters on the lake ice
export const FROSTHELM_THEME = buildTheme({
  name: 'Frosthelm', bpm: 64, key: -3, arp: 'bells', bass: 'waltz',
  chords: [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3'],
    ['A2', 'C3', 'E3'], ['D2', 'F2', 'A2'], ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2']],
  melody: [
    ['E5', 5], ['D5', 6], ['C5', 5],
    ['A4', 11], ['C5', 5],
    ['E5', 5], ['G5', 6], ['E5', 5],
    ['D5', 11], ['B4', 5],
    ['C5', 5], ['E5', 6], ['A5', 5],
    ['G5', 5], ['F5', 6], ['D5', 5],
    ['C5', 5], ['A4', 6], ['F4', 5],
    ['G#4', 11], ['-', 5],
  ],
  inst: { lead: { type: 'triangle', vol: 0.9, echo: 0.55, vibrato: 0.01 }, arp: { vol: 1.2, echo: 0.6 }, bass: { vol: 0.7 }, pad: { vol: 1.3, cutoff: 900 }, sub: { vol: 0.8 } },
});

// The Rimeglass Spire: the waltz turned inward - glass bells high and
// sparse, a hollow drone, the melody climbing like a stair in the tower
export const SPIRE_THEME = buildTheme({
  name: 'The Rimeglass Spire', bpm: 58, key: -2, arp: 'bells', bass: 'hollow',
  chords: [['A2', 'C3', 'E3'], ['E2', 'G#2', 'B2'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'],
    ['D2', 'F2', 'A2'], ['A2', 'C3', 'E3'], ['B2', 'D3', 'F3'], ['E2', 'G#2', 'B2']],
  melody: [
    ['-', 5], ['A4', 6], ['C5', 5],
    ['B4', 11], ['-', 5],
    ['-', 5], ['C5', 6], ['E5', 5],
    ['G5', 11], ['-', 5],
    ['F5', 5], ['E5', 6], ['D5', 5],
    ['C5', 5], ['B4', 6], ['A4', 5],
    ['-', 5], ['D5', 6], ['F5', 5],
    ['E5', 11], ['-', 5],
  ],
  inst: { lead: { type: 'triangle', vol: 0.85, echo: 0.65, vibrato: 0.008 }, arp: { vol: 1.1, echo: 0.7 }, bass: { vol: 0.8 }, pad: { vol: 1.3, cutoff: 700 }, sub: { vol: 1.1 } },
});

// The Blight Basin: everything the realm's themes were, drained - a slow
// tolling drone, the arpeggio a heartbeat, a melody that keeps falling
export const BASIN_THEME = buildTheme({
  name: 'The Blight Basin', bpm: 60, key: -4, arp: 'drip', bass: 'murk',
  chords: [['A2', 'C3', 'E3'], ['A2', 'C3', 'F3'], ['G#2', 'B2', 'E3'], ['A2', 'C3', 'E3'],
    ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2']],
  melody: [
    ['E5', 8], ['D5', 4], ['C5', 4],
    ['B4', 12], ['-', 4],
    ['C5', 8], ['B4', 4], ['A4', 4],
    ['G#4', 12], ['-', 4],
    ['A4', 4], ['C5', 4], ['B4', 4], ['A4', 4],
    ['G#4', 8], ['E4', 8],
    ['F4', 4], ['E4', 4], ['D4', 4], ['C4', 4],
    ['B3', 12], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 0.8, echo: 0.6, vibrato: 0.02 }, arp: { vol: 0.9, echo: 0.6 }, bass: { vol: 1.2 }, pad: { vol: 1.4, cutoff: 420 }, sub: { vol: 1.5 } },
});

// The Ninth Tower: a march up endless stairs - a heavy two-note bass, the
// anvil's off-beat ring turned to a bell of doom, a melody in the minor that
// climbs a step each bar
export const TOWER_THEME = buildTheme({
  name: 'The Ninth Tower', bpm: 76, key: -5, arp: 'clock', bass: 'march',
  chords: [['A2', 'C3', 'E3'], ['B2', 'D3', 'F3'], ['C3', 'E3', 'G3'], ['B2', 'D3', 'F3'],
    ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2']],
  melody: [
    ['A4', 4], ['B4', 4], ['C5', 8],
    ['B4', 4], ['C5', 4], ['D5', 8],
    ['C5', 4], ['D5', 4], ['E5', 8],
    ['F5', 6], ['E5', 2], ['D5', 8],
    ['E5', 4], ['C5', 4], ['A4', 8],
    ['F4', 4], ['A4', 4], ['C5', 8],
    ['D5', 4], ['C5', 4], ['B4', 4], ['A4', 4],
    ['G#4', 12], ['-', 4],
  ],
  inst: { lead: { duty: 0.25, vol: 0.95, echo: 0.4, vibrato: 0.01 }, arp: { vol: 0.8, echo: 0.3 }, bass: { vol: 1.2 }, pad: { vol: 1.2, cutoff: 520 }, sub: { vol: 1.4 } },
});
// Malgrim: the Tower's march sped up and soured, a mocking waltz-step in it
export const MALGRIM_THEME = buildTheme({
  name: 'Malgrim the Unkind', bpm: 96, key: -6, arp: 'anvil', bass: 'gallop',
  chords: [['A2', 'C3', 'E3'], ['A#2', 'D3', 'F3'], ['A2', 'C3', 'E3'], ['G#2', 'B2', 'E3'],
    ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2'], ['D2', 'F2', 'A#2'], ['E2', 'G#2', 'B2']],
  melody: [
    ['E5', 2], ['F5', 2], ['E5', 4], ['A4', 8],
    ['A#4', 4], ['D5', 4], ['F5', 8],
    ['E5', 2], ['D#5', 2], ['E5', 4], ['C5', 4], ['A4', 4],
    ['B4', 12], ['-', 4],
    ['C5', 4], ['A4', 4], ['F4', 4], ['A4', 4],
    ['G#4', 4], ['B4', 4], ['E5', 8],
    ['F5', 4], ['D5', 4], ['A#4', 4], ['F4', 4],
    ['E4', 12], ['-', 4],
  ],
  inst: { lead: { duty: 0.125, vol: 1, echo: 0.3, vibrato: 0.015 }, arp: { vol: 0.9, echo: 0.2 }, bass: { vol: 1.2 }, pad: { vol: 1.1, cutoff: 600 }, sub: { vol: 1.5 } },
});

// The Forge of Ash: the work song gone underground - slower, the anvil
// echoing off stone, a hollow drone where the hearth used to roar
export const FORGE_THEME = buildTheme({
  name: 'The Forge of Ash', bpm: 72, key: -9, arp: 'anvil', bass: 'hollow',
  chords: [['E2', 'G2', 'B2'], ['C2', 'E2', 'G2'], ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2'],
    ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2']],
  melody: [
    ['-', 4], ['E4', 4], ['F4', 4], ['G4', 4],
    ['E4', 12], ['-', 4],
    ['-', 4], ['C5', 4], ['B4', 4], ['A4', 4],
    ['G#4', 12], ['-', 4],
    ['A4', 4], ['C5', 4], ['E5', 8],
    ['D5', 4], ['C5', 4], ['A4', 8],
    ['F4', 4], ['A4', 4], ['G#4', 4], ['F4', 4],
    ['E4', 12], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 1.05, echo: 0.5, vibrato: 0.008 }, arp: { vol: 0.9, echo: 0.45 }, bass: { vol: 0.95 }, pad: { vol: 1.2, cutoff: 460 }, sub: { vol: 1.4 } },
});

// Witchroot Hollow: under the elder's roots - the forest's music box, slowed
// and sunk an octave, dripping between long hollow notes
export const WITCHROOT_THEME = buildTheme({
  name: 'Witchroot Hollow', bpm: 62, key: -8, arp: 'drip', bass: 'hollow',
  chords: [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['E2', 'G#2', 'B2'],
    ['D2', 'F2', 'A2'], ['A2', 'C3', 'E3'], ['B2', 'D3', 'F3'], ['E2', 'G#2', 'B2']],
  melody: [
    ['-', 8], ['E4', 4], ['A4', 4],
    ['C5', 6], ['B4', 2], ['A4', 8],
    ['-', 4], ['G4', 4], ['B4', 4], ['D5', 4],
    ['G#4', 12], ['-', 4],
    ['-', 8], ['F4', 4], ['A4', 4],
    ['E5', 6], ['D5', 2], ['C5', 8],
    ['B4', 4], ['A4', 4], ['F4', 4], ['D4', 4],
    ['E4', 12], ['-', 4],
  ],
  inst: { lead: { type: 'triangle', vol: 1.0, echo: 0.65, vibrato: 0.01 }, arp: { echo: 0.6, vol: 1.5 }, bass: { vol: 0.8 }, pad: { vol: 1.3, cutoff: 520 } },
});

// Shops and the tavern: cosy and light — a bouncy jig over oom-pah bass and
// lute strums, no drums until a brawl breaks out
export const HEARTH_THEME = buildTheme({
  name: 'Hearth', bpm: 104, key: 5, arp: 'lute', bass: 'oompah',
  chords: [['C3', 'E3', 'G3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['C3', 'E3', 'G3'],
    ['A2', 'C3', 'E3'], ['D2', 'F2', 'A2'], ['G2', 'B2', 'D3'], ['C3', 'E3', 'G3']],
  melody: [
    ['E4', 2], ['G4', 2], ['C5', 2], ['G4', 2], ['E4', 2], ['G4', 2], ['C5', 4],
    ['A4', 2], ['C5', 2], ['F5', 2], ['C5', 2], ['A4', 4], ['F4', 4],
    ['G4', 2], ['B4', 2], ['D5', 2], ['B4', 2], ['G4', 4], ['D4', 4],
    ['E4', 4], ['G4', 4], ['C5', 8],
    ['C5', 2], ['B4', 2], ['A4', 2], ['E4', 2], ['A4', 4], ['C5', 4],
    ['D5', 2], ['C5', 2], ['A4', 2], ['F4', 2], ['D4', 4], ['F4', 4],
    ['G4', 2], ['A4', 2], ['B4', 2], ['D5', 2], ['G4', 4], ['B4', 4],
    ['C5', 6], ['G4', 2], ['C5', 8],
  ],
  inst: { lead: { type: 'triangle', vol: 1.4, echo: 0.08, vibrato: 0.015 }, arp: { vol: 1.4, echo: 0.05 }, pad: { vol: 0.6, cutoff: 1000 }, sub: { vol: 0.6 } },
});

const REGION_THEMES = {
  vale: VALE_THEME, meadow: MEADOW_THEME, marsh: MISTFEN_THEME, gloam: GLOAMWOOD_THEME, witchroot: WITCHROOT_THEME, cinder: CINDERREACH_THEME, forge: FORGE_THEME, frost: FROSTHELM_THEME,
  cave: DEPTHS_THEME, grotto: DEPTHS_THEME, clawhold: DEPTHS_THEME, spire: SPIRE_THEME, basin: BASIN_THEME,
  tower1: TOWER_THEME, tower2: TOWER_THEME, tower3: TOWER_THEME, tower4: TOWER_THEME, tower5: TOWER_THEME, tower6: TOWER_THEME, tower7: TOWER_THEME, tower8: TOWER_THEME, tower9: MALGRIM_THEME, undercroft: UNDERCROFT_THEME, abbey: ABBEY_THEME,
  shop: HEARTH_THEME, tavern: HEARTH_THEME,
};
export const themeFor = (region) => REGION_THEMES[region] || VALE_THEME;

// ------------------------------------------------------------ instruments
// play(event, time, out, variant, stepDur)
const INST = {
  lead(e, t, out, v, sd, o = {}) {
    audio.tone({ type: o.type || 'pulse', duty: v === 'cursed' ? 0.125 : o.duty || 0.25, freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.92, vol: 0.13 * e[3] * (o.vol ?? 1),
      vibrato: o.vibrato ?? 0.012, detune: v === 'cursed' ? 14 : 0, out, send: 0.25, echo: o.echo ?? 0.22, decay: 0.12, sustain: 0.7, release: 0.09, slide: e[2] >= 6 ? -1 : 0 });
  },
  arp(e, t, out, v, sd, o = {}) {
    if (v === 'cursed' && e[0] % 2) return; // thinner, hesitant
    audio.tone({ type: 'pulse', duty: 0.125, freq: midiHz(e[1]), time: t, dur: sd * 0.6 * (e[2] > 1 ? e[2] * 0.8 : 1), vol: 0.045 * e[3] * (o.vol ?? 1), out, decay: 0.05, sustain: 0.4, release: 0.03, pan: e[0] % 4 < 2 ? -0.35 : 0.35, echo: o.echo ?? 0.12 });
  },
  bass(e, t, out, v, sd, o = {}) {
    audio.tone({ type: 'triangle', freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.85, vol: 0.32 * e[3] * (o.vol ?? 1), out, decay: 0.1, sustain: 0.8, release: 0.04 });
  },
  pad(e, t, out, v, sd, o = {}) {
    audio.pad({ freqs: e[1].map(midiHz), time: t, dur: e[2] * sd, vol: (v === 'cursed' ? 0.03 : 0.04) * (o.vol ?? 1), out, cutoff: v === 'cursed' ? Math.min(800, o.cutoff || 800) : o.cutoff || 1400 });
  },
  sub(e, t, out, v, sd, o = {}) {
    audio.tone({ type: 'sine', freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.95, vol: 0.12 * (o.vol ?? 1), out, attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.2 });
  },
  cbass(e, t, out, v, sd) {
    audio.tone({ type: 'pulse', duty: 0.5, freq: midiHz(e[1]), time: t, dur: sd * 0.8, vol: 0.07 * e[3], out, decay: 0.05, sustain: 0.6, release: 0.02 });
  },
  counter(e, t, out, v, sd) {
    audio.tone({ type: 'pulse', duty: 0.5, freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.5, vol: 0.05 * e[3], out, vibrato: 0.01, echo: 0.3, pan: 0.25 });
  },
  harp(e, t, out, v, sd) {
    audio.tone({ type: 'triangle', freq: midiHz(e[1]), time: t, dur: sd * 3, vol: 0.06 * e[3], out, decay: 0.25, sustain: 0.15, release: 0.3, echo: 0.3, pan: (e[0] % 8) < 4 ? -0.3 : 0.3 });
  },
  drums(e, t, out) {
    if (e[1] === 'kick') audio.tone({ type: 'triangle', freq: 160, freq2: 42, time: t, dur: 0.12, vol: 0.55 * e[3], out, decay: 0.12, sustain: 0, release: 0.02 });
    else if (e[1] === 'snare') {
      audio.noiseHit({ time: t, dur: 0.13, vol: 0.22 * e[3], type: 'bandpass', f0: 1900, q: 0.8, out });
      audio.tone({ type: 'triangle', freq: 190, freq2: 120, time: t, dur: 0.06, vol: 0.18 * e[3], out });
    } else audio.noiseHit({ time: t, dur: 0.035, vol: 0.07 * e[3], type: 'highpass', f0: 7500, out, short: true });
  },
};

// --------------------------------------------------------------- player
export class MusicPlayer {
  constructor() {
    this.song = null;
    this.playing = false;
    this.state = { variant: 'freed', combat: 0 };
  }

  start(song, fadeIn = 0.01) {
    clearTimeout(this.swapT);
    this.pending = null;
    const a = audio.init();
    const ctx = a.ctx;
    this.song = song;
    if (!this.nodes) {
      this.nodes = {};
      for (const layer of ['base', 'combat', 'bard']) for (const v of ['freed', 'cursed']) {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(a.musicBus);
        this.nodes[layer + ':' + v] = g;
      }
    }
    // Pre-index events by step; derive the cursed variant (in C), then shift
    // both into the song's key.
    this.byStep = Array.from({ length: song.steps }, () => []);
    const k = song.key || 0;
    const shift = (p, f) => (Array.isArray(p) ? p.map((m) => f(m) + k) : f(p) + k);
    for (const tr of song.tracks) {
      for (const e of tr.events) {
        const drum = tr.inst === 'drums';
        this.byStep[e[0]].push({ tr, e: drum ? e : [e[0], shift(e[1], (m) => m), e[2], e[3]], v: 'freed' });
        this.byStep[e[0]].push({ tr, e: drum ? e : [e[0], shift(e[1], toMinor), e[2], e[3]], v: 'cursed' });
      }
    }
    this.stepDur = 60 / song.bpm / 4;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.playing = true;
    this.applyMix(fadeIn);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  // Crossfade to another region's theme: the current song fades out, then the
  // new one starts from its top and fades in. Variant and combat state carry over.
  setTheme(song) {
    if (!this.playing || !this.nodes) { this.start(song); return; }
    if (this.pending === song || (!this.pending && this.song === song)) return;
    clearTimeout(this.swapT);
    this.pending = song;
    if (this.song === song) { this.pending = null; this.applyMix(0.5); return; }
    for (const g of Object.values(this.nodes)) g.gain.setTargetAtTime(0, audio.t, 0.3);
    this.swapT = setTimeout(() => { if (this.pending === song) this.start(song, 0.6); }, 1100);
  }

  stop() {
    clearTimeout(this.swapT);
    this.pending = null;
    this.playing = false;
    clearInterval(this.timer);
    if (this.nodes) for (const g of Object.values(this.nodes)) g.gain.setTargetAtTime(0, audio.t, 0.3);
  }

  schedule() {
    if (!this.playing) return;
    const ctx = audio.ctx;
    while (this.nextTime < ctx.currentTime + 0.15) {
      for (const { tr, e, v } of this.byStep[this.step]) {
        const g = this.nodes[tr.layer + ':' + v];
        // skip scheduling voices that are fully silent (saves CPU)
        if (g.gain.value < 0.001 && this.targetOf(tr.layer, v) < 0.001) continue;
        INST[tr.inst](e, this.nextTime, g, v, this.stepDur, tr.o);
      }
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % this.song.steps;
    }
  }

  targetOf(layer, v) {
    const vg = this.state.variant === v ? 1 : 0;
    return layer === 'base' ? vg : layer === 'bard' ? vg * (this.state.bard ? 1 : 0) : vg * this.state.combat;
  }

  applyMix(tc = 0.6) {
    if (!this.nodes || this.pending) return; // mid-crossfade: the next song picks up the state
    for (const layer of ['base', 'combat', 'bard']) for (const v of ['freed', 'cursed']) {
      this.nodes[layer + ':' + v].gain.setTargetAtTime(this.targetOf(layer, v), audio.t, tc);
    }
  }

  setVariant(v, tc = 1.2) {
    if (this.state.variant === v) return;
    this.state.variant = v;
    this.applyMix(tc);
  }

  setBard(on) {
    if (!!this.state.bard === !!on) return;
    this.state.bard = !!on;
    this.applyMix(2);
  }

  setCombat(on) {
    const c = on ? 1 : 0;
    if (this.state.combat === c) return;
    this.state.combat = c;
    this.applyMix(on ? 0.25 : 1.5);
  }
}

export const music = new MusicPlayer();
