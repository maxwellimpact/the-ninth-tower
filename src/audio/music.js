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

// ---------------------------------------------------- Brightwater Vale theme
const BARS = 8;
const CHORDS = [
  ['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'],
  ['C3', 'E3', 'G3'], ['E2', 'G2', 'B2'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'],
].map((c) => c.map(n));

const MELODY = seq([
  ['E4', 4], ['G4', 4], ['C5', 6], ['B4', 2],
  ['A4', 6], ['G4', 2], ['E4', 8],
  ['F4', 4], ['A4', 4], ['C5', 4], ['A4', 4],
  ['G4', 6], ['F4', 2], ['E4', 4], ['D4', 4],
  ['E4', 4], ['G4', 4], ['C5', 4], ['E5', 4],
  ['D5', 6], ['C5', 2], ['B4', 8],
  ['A4', 4], ['C5', 4], ['F4', 4], ['A4', 4],
  ['G4', 4], ['B4', 4], ['D5', 4], ['B4', 2], ['G4', 2],
]);

function arp() {
  const ev = [];
  CHORDS.forEach((ch, b) => {
    const tones = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[0] + 36];
    for (let i = 0; i < 16; i++) ev.push([b * 16 + i, tones[[0, 1, 2, 3, 2, 1, 0, 1][i % 8]], 1, i % 4 === 0 ? 0.9 : 0.6]);
  });
  return ev;
}
function bass() {
  const ev = [];
  CHORDS.forEach((ch, b) => {
    const r = ch[0] + 12, f = ch[2] + 12;
    [[0, r, 3], [4, r + 12, 2], [6, f, 2], [8, r, 3], [12, f, 2], [14, r + 12, 2]].forEach(([s, m, l]) => ev.push([b * 16 + s, m, l, 1]));
  });
  return ev;
}
const padEv = () => CHORDS.map((ch, b) => [b * 16, ch.map((m) => m + 12), 16, 1]);
const subEv = () => CHORDS.map((ch, b) => [b * 16, ch[0], 16, 1]);
function combatBass() {
  const ev = [];
  CHORDS.forEach((ch, b) => { for (let i = 0; i < 16; i += 2) ev.push([b * 16 + i, ch[0] + 12 + (i % 8 === 6 ? 7 : 0), 1, i % 4 ? 0.7 : 1]); });
  return ev;
}
function drums() {
  const ev = [];
  for (let b = 0; b < BARS; b++) {
    for (const s of [0, 8, 10]) ev.push([b * 16 + s, 'kick', 1, 1]);
    for (const s of [4, 12]) ev.push([b * 16 + s, 'snare', 1, 1]);
    for (let s = 0; s < 16; s += 2) ev.push([b * 16 + s, 'hat', 1, s % 4 ? 0.6 : 1]);
    if (b % 4 === 3) for (const s of [13, 14, 15]) ev.push([b * 16 + s, 'snare', 1, 0.7]);
  }
  return ev;
}
const counter = () => MELODY.map(([s, m, l, v]) => [s, m + 12, l, v * 0.8]);

export const VALE_THEME = {
  name: 'Brightwater Vale',
  bpm: 100,
  steps: BARS * 16,
  tracks: [
    { inst: 'lead', layer: 'base', events: MELODY },
    { inst: 'arp', layer: 'base', events: arp() },
    { inst: 'bass', layer: 'base', events: bass() },
    { inst: 'pad', layer: 'base', events: padEv() },
    { inst: 'sub', layer: 'base', events: subEv() },
    { inst: 'drums', layer: 'combat', events: drums() },
    { inst: 'cbass', layer: 'combat', events: combatBass() },
    { inst: 'counter', layer: 'combat', events: counter() },
  ],
};

// ------------------------------------------------------------ instruments
// play(event, time, out, variant, stepDur)
const INST = {
  lead(e, t, out, v, sd) {
    audio.tone({ type: 'pulse', duty: v === 'cursed' ? 0.125 : 0.25, freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.92, vol: 0.13 * e[3],
      vibrato: 0.012, detune: v === 'cursed' ? 14 : 0, out, send: 0.25, echo: 0.22, decay: 0.12, sustain: 0.7, release: 0.09, slide: e[2] >= 6 ? -1 : 0 });
  },
  arp(e, t, out, v, sd) {
    if (v === 'cursed' && e[0] % 2) return; // thinner, hesitant
    audio.tone({ type: 'pulse', duty: 0.125, freq: midiHz(e[1]), time: t, dur: sd * 0.6, vol: 0.045 * e[3], out, decay: 0.05, sustain: 0.4, release: 0.03, pan: e[0] % 4 < 2 ? -0.35 : 0.35, echo: 0.12 });
  },
  bass(e, t, out, v, sd) {
    audio.tone({ type: 'triangle', freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.85, vol: 0.32 * e[3], out, decay: 0.1, sustain: 0.8, release: 0.04 });
  },
  pad(e, t, out, v, sd) {
    audio.pad({ freqs: e[1].map(midiHz), time: t, dur: e[2] * sd, vol: v === 'cursed' ? 0.03 : 0.04, out, cutoff: v === 'cursed' ? 800 : 1400 });
  },
  sub(e, t, out, v, sd) {
    audio.tone({ type: 'sine', freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.95, vol: 0.12, out, attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.2 });
  },
  cbass(e, t, out, v, sd) {
    audio.tone({ type: 'pulse', duty: 0.5, freq: midiHz(e[1]), time: t, dur: sd * 0.8, vol: 0.07 * e[3], out, decay: 0.05, sustain: 0.6, release: 0.02 });
  },
  counter(e, t, out, v, sd) {
    audio.tone({ type: 'pulse', duty: 0.5, freq: midiHz(e[1]), time: t, dur: e[2] * sd * 0.5, vol: 0.05 * e[3], out, vibrato: 0.01, echo: 0.3, pan: 0.25 });
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

  start(song) {
    const a = audio.init();
    const ctx = a.ctx;
    this.song = song;
    if (!this.nodes) {
      this.nodes = {};
      for (const layer of ['base', 'combat']) for (const v of ['freed', 'cursed']) {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(a.musicBus);
        this.nodes[layer + ':' + v] = g;
      }
    }
    // Pre-index events by step; derive the cursed variant.
    this.byStep = Array.from({ length: song.steps }, () => []);
    for (const tr of song.tracks) {
      for (const e of tr.events) {
        this.byStep[e[0]].push({ tr, e, v: 'freed' });
        const ce = tr.inst === 'drums' ? e : [e[0], Array.isArray(e[1]) ? e[1].map(toMinor) : toMinor(e[1]), e[2], e[3]];
        this.byStep[e[0]].push({ tr, e: ce, v: 'cursed' });
      }
    }
    this.stepDur = 60 / song.bpm / 4;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.playing = true;
    this.applyMix(0.01);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
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
        INST[tr.inst](e, this.nextTime, g, v, this.stepDur);
      }
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % this.song.steps;
    }
  }

  targetOf(layer, v) {
    const vg = this.state.variant === v ? 1 : 0;
    return layer === 'base' ? vg : vg * this.state.combat;
  }

  applyMix(tc = 0.6) {
    if (!this.nodes) return;
    for (const layer of ['base', 'combat']) for (const v of ['freed', 'cursed']) {
      this.nodes[layer + ':' + v].gain.setTargetAtTime(this.targetOf(layer, v), audio.t, tc);
    }
  }

  setVariant(v, tc = 1.2) {
    if (this.state.variant === v) return;
    this.state.variant = v;
    this.applyMix(tc);
  }

  setCombat(on) {
    const c = on ? 1 : 0;
    if (this.state.combat === c) return;
    this.state.combat = c;
    this.applyMix(on ? 0.25 : 1.5);
  }
}

export const music = new MusicPlayer();
