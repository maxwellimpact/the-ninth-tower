// "8-bit plus" audio engine. Everything is synthesized at runtime:
//   core voices  : pulse (12.5/25/50% duty), triangle, noise
//   plus layer   : detuned saw pad, sine sub-bass, bell, vibrato, echo, reverb
// Music is a tracker-style sequencer with adaptive layers (see music.js).

const A4 = 440;
export const midiHz = (m) => A4 * Math.pow(2, (m - 69) / 12);
const rnd = (amt) => 1 + (Math.random() - 0.5) * amt;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVol = 0.55;
    this.sfxVol = 0.8;
  }

  // Must be called from a user gesture (browser autoplay rules).
  init() {
    if (window.__muteTests) this.muted = true;
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    // Reverb: generated stereo impulse (decaying noise), low-passed.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4, 2.6);
    const revOut = ctx.createGain(); revOut.gain.value = 0.9;
    const revLp = ctx.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 4200;
    this.reverb.connect(revLp).connect(revOut).connect(this.master);

    // Echo: dotted-eighth feedback delay with darkening repeats.
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    const delOut = ctx.createGain(); delOut.gain.value = 0.5;
    dlp.connect(delOut).connect(this.master);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    const sfxRev = ctx.createGain(); sfxRev.gain.value = 0.12;
    this.sfxBus.connect(sfxRev).connect(this.reverb);

    // Pulse waves via Fourier series.
    this.waves = {};
    for (const d of [0.125, 0.25, 0.5]) this.waves[d] = this.pulseWave(d);
    this.noise = this.noiseBuffer(1.0);
    this.noiseShort = this.noiseBuffer(0.02); // periodic "metallic" NES noise
    return this;
  }

  get t() { return this.ctx.currentTime; }

  pulseWave(duty) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return this.ctx.createPeriodicWave(re, im);
  }

  noiseBuffer(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  impulse(sec, decay) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  // ------------------------------------------------------------ voices
  // Generic enveloped oscillator. Returns nothing; nodes self-clean.
  tone({ type = 'pulse', duty = 0.5, freq = 440, freq2, time, dur = 0.2, vol = 0.3, attack = 0.004, decay = 0.08,
    sustain = 0.6, release = 0.06, out, vibrato = 0, detune = 0, send = 0, echo = 0, pan = 0, slide = 0 }) {
    const ctx = this.ctx;
    const t0 = time ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    if (type === 'pulse') osc.setPeriodicWave(this.waves[duty] || this.waves[0.5]);
    else osc.type = type;
    osc.frequency.setValueAtTime(slide ? freq * Math.pow(2, slide / 12) : freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.05);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t0 + dur);
    osc.detune.value = detune;
    if (vibrato) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(freq * vibrato, t0 + Math.min(0.35, dur * 0.6));
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + release + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.linearRampToValueAtTime(vol * sustain, t0 + attack + decay);
    g.gain.setValueAtTime(vol * sustain, t0 + Math.max(attack + decay, dur));
    g.gain.linearRampToValueAtTime(0, t0 + Math.max(attack + decay, dur) + release);
    let node = osc.connect(g);
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(out || this.sfxBus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(this.reverb); }
    if (echo) { const e = ctx.createGain(); e.gain.value = echo; node.connect(e).connect(this.delay); }
    osc.start(t0);
    osc.stop(t0 + Math.max(attack + decay, dur) + release + 0.02);
  }

  noiseHit({ time, dur = 0.1, vol = 0.3, type = 'bandpass', f0 = 2000, f1, q = 1, out, short = false, send = 0, attack = 0.002 }) {
    const ctx = this.ctx;
    const t0 = time ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = short ? this.noiseShort : this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(out || this.sfxBus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.reverb); }
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // Warm detuned-saw pad through a lowpass.
  pad({ freqs, time, dur, vol = 0.05, out, cutoff = 1300 }) {
    const ctx = this.ctx;
    const t0 = time ?? ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(vol, t0 + dur * 0.85);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.5);
    f.connect(g).connect(out || this.musicBus);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s).connect(this.reverb);
    for (const fr of freqs) for (const dt of [-8, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt;
      o.connect(f); o.start(t0); o.stop(t0 + dur + 0.6);
    }
  }

  bell({ freq, time, vol = 0.15, dur = 1.2, out, send = 0.4 }) {
    // two inharmonic sines = glassy bell
    this.tone({ type: 'sine', freq, time, dur: 0.02, decay: dur, sustain: 0, release: 0.01, vol, out, send });
    this.tone({ type: 'sine', freq: freq * 2.76, time, dur: 0.02, decay: dur * 0.4, sustain: 0, release: 0.01, vol: vol * 0.35, out, send });
  }

  // --------------------------------------------------------------- SFX
  sfx(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const fn = SFX[name];
    if (fn) fn(this, opts);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.t, 0.05);
  }
}

// Each SFX is short, punchy, and lightly randomized so repeats don't grate.
export const SFX = {
  swing(a, { pitch = 1 } = {}) {
    a.noiseHit({ dur: 0.11, vol: 0.22, type: 'bandpass', f0: 900 * pitch * rnd(0.2), f1: 3800 * pitch, q: 2.5 });
  },
  stab(a) {
    a.noiseHit({ dur: 0.06, vol: 0.2, type: 'highpass', f0: 2500 * rnd(0.2), f1: 6000, q: 1 });
  },
  hit(a, { pitch = 1 } = {}) {
    a.tone({ type: 'pulse', duty: 0.5, freq: 260 * pitch * rnd(0.12), freq2: 70, dur: 0.07, decay: 0.05, sustain: 0.3, vol: 0.28 });
    a.noiseHit({ dur: 0.07, vol: 0.3, type: 'lowpass', f0: 2600, f1: 400 });
  },
  crit(a) {
    SFX.hit(a, { pitch: 1.3 });
    a.bell({ freq: 1760 * rnd(0.04), vol: 0.12, dur: 0.5 });
    a.tone({ type: 'pulse', duty: 0.125, freq: 1320, dur: 0.05, vol: 0.12, time: a.t + 0.03 });
  },
  squish(a) {
    a.tone({ type: 'sine', freq: 340 * rnd(0.2), freq2: 110, dur: 0.12, vol: 0.32, sustain: 0.4 });
    a.noiseHit({ dur: 0.09, vol: 0.2, type: 'lowpass', f0: 900, f1: 200 });
  },
  block(a) {
    a.tone({ type: 'pulse', duty: 0.25, freq: 520 * rnd(0.08), dur: 0.04, vol: 0.2, decay: 0.12, sustain: 0 });
    a.bell({ freq: 900, vol: 0.08, dur: 0.25 });
  },
  hurt(a) {
    a.tone({ type: 'pulse', duty: 0.25, freq: 320 * rnd(0.1), freq2: 140, dur: 0.14, vol: 0.22 });
    a.noiseHit({ dur: 0.1, vol: 0.18, type: 'lowpass', f0: 1200, f1: 300 });
  },
  dodge(a) {
    a.noiseHit({ dur: 0.2, vol: 0.18, type: 'bandpass', f0: 500 * rnd(0.2), f1: 2200, q: 1.5 });
  },
  step(a, { surface = 'grass' } = {}) {
    const f = surface === 'stone' ? 2600 : surface === 'path' ? 1400 : 3600;
    a.noiseHit({ dur: surface === 'stone' ? 0.035 : 0.028, vol: 0.045, type: 'bandpass', f0: f * rnd(0.3), q: 2, short: surface === 'stone' });
  },
  fireCast(a) {
    a.noiseHit({ dur: 0.28, vol: 0.2, type: 'lowpass', f0: 300, f1: 3000, q: 4 });
    a.tone({ type: 'sine', freq: 180, freq2: 660, dur: 0.22, vol: 0.12, send: 0.2 });
  },
  fireImpact(a) {
    a.noiseHit({ dur: 0.35, vol: 0.32, type: 'lowpass', f0: 1800, f1: 160, q: 0.7, send: 0.2 });
    a.tone({ type: 'triangle', freq: 140, freq2: 45, dur: 0.22, vol: 0.35 });
  },
  frost(a) {
    for (let i = 0; i < 5; i++) a.bell({ freq: 2200 + Math.random() * 1800, time: a.t + i * 0.035, vol: 0.06, dur: 0.4 });
    a.noiseHit({ dur: 0.3, vol: 0.1, type: 'highpass', f0: 5000 });
  },
  bash(a) {
    a.tone({ type: 'triangle', freq: 120, freq2: 40, dur: 0.18, vol: 0.5 });
    a.noiseHit({ dur: 0.16, vol: 0.32, type: 'lowpass', f0: 1600, f1: 200 });
    a.tone({ type: 'pulse', duty: 0.5, freq: 200, dur: 0.05, vol: 0.15 });
  },
  dash(a) {
    a.noiseHit({ dur: 0.16, vol: 0.18, type: 'highpass', f0: 1500, f1: 7000, q: 0.7 });
    a.tone({ type: 'pulse', duty: 0.125, freq: 600, freq2: 1600, dur: 0.1, vol: 0.08 });
  },
  heal(a) {
    a.tone({ type: 'triangle', freq: 523, freq2: 1046, dur: 0.35, vol: 0.18, send: 0.4 });
    for (let i = 0; i < 4; i++) a.bell({ freq: [1568, 2093, 2637, 3136][i], time: a.t + 0.06 * i, vol: 0.05, dur: 0.5 });
  },
  enemyDie(a) {
    a.tone({ type: 'pulse', duty: 0.25, freq: 700, freq2: 70, dur: 0.28, vol: 0.2 });
    a.noiseHit({ dur: 0.25, vol: 0.2, type: 'lowpass', f0: 3000, f1: 300, time: a.t + 0.05 });
  },
  coin(a) {
    a.tone({ type: 'pulse', duty: 0.5, freq: midiHz(83), dur: 0.06, vol: 0.14, sustain: 1, release: 0.01 });
    a.tone({ type: 'pulse', duty: 0.5, freq: midiHz(88), dur: 0.2, vol: 0.14, time: a.t + 0.065, decay: 0.2, sustain: 0.2, echo: 0.2 });
  },
  chest(a) {
    [60, 67, 72, 76, 79, 84].forEach((m, i) => a.tone({ type: 'pulse', duty: 0.25, freq: midiHz(m), time: a.t + i * 0.07, dur: 0.1, vol: 0.13, echo: 0.15 }));
    a.bell({ freq: midiHz(96), time: a.t + 0.45, vol: 0.1, dur: 1.2 });
  },
  levelUp(a) {
    [72, 76, 79, 84].forEach((m, i) => a.tone({ type: 'pulse', duty: 0.125, freq: midiHz(m), time: a.t + i * 0.08, dur: 0.12, vol: 0.14 }));
    a.tone({ type: 'pulse', duty: 0.25, freq: midiHz(88), time: a.t + 0.34, dur: 0.5, vol: 0.14, vibrato: 0.01, echo: 0.3 });
  },
  shatter(a) {
    a.noiseHit({ dur: 0.7, vol: 0.4, type: 'highpass', f0: 1800, f1: 600, send: 0.5 });
    a.tone({ type: 'triangle', freq: 90, freq2: 30, dur: 0.6, vol: 0.5 });
    for (let i = 0; i < 14; i++) a.bell({ freq: 3600 - i * 160 + Math.random() * 400, time: a.t + 0.05 + i * 0.05, vol: 0.06, dur: 0.6 });
  },
  curseLift(a) {
    // rising major swell — the region's colour comes back
    a.pad({ freqs: [midiHz(48), midiHz(55), midiHz(64), midiHz(67)], time: a.t, dur: 3, vol: 0.07, out: a.sfxBus, cutoff: 2200 });
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => a.bell({ freq: midiHz(m + 12), time: a.t + 0.4 + i * 0.12, vol: 0.09, dur: 1.6 }));
  },
  click(a) { a.tone({ type: 'pulse', duty: 0.25, freq: 1300, dur: 0.02, vol: 0.08, decay: 0.02, sustain: 0 }); },
  swap(a) {
    a.tone({ type: 'pulse', duty: 0.125, freq: midiHz(79), dur: 0.05, vol: 0.12 });
    a.tone({ type: 'pulse', duty: 0.125, freq: midiHz(86), dur: 0.08, vol: 0.12, time: a.t + 0.06 });
  },
  ult(a) {
    a.tone({ type: 'pulse', duty: 0.25, freq: midiHz(60), freq2: midiHz(84), dur: 0.35, vol: 0.18, send: 0.4, echo: 0.3 });
    a.noiseHit({ dur: 0.4, vol: 0.2, type: 'bandpass', f0: 400, f1: 5000, q: 1 });
    [72, 79, 84, 91].forEach((m, i) => a.bell({ freq: midiHz(m), time: a.t + 0.08 * i, vol: 0.07, dur: 0.8 }));
  },
  zip(a) {
    a.tone({ type: 'pulse', duty: 0.125, freq: 300, freq2: 1800, dur: 0.16, vol: 0.12 });
    a.noiseHit({ dur: 0.3, vol: 0.14, type: 'highpass', f0: 2000, f1: 6000, q: 0.8 });
  },
  bellTone(a, { pitch = 1 } = {}) {
    a.bell({ freq: 440 * pitch, vol: 0.18, dur: 1.6, send: 0.6 });
  },
  zap(a) {
    // storm: crackling square burst with a jittery pitch
    for (let i = 0; i < 3; i++) a.tone({ type: 'pulse', duty: 0.5, freq: 900 * rnd(0.5), freq2: 300 * rnd(0.4), dur: 0.06, vol: 0.08, time: a.ctx.currentTime + i * 0.035 });
    a.noiseHit({ dur: 0.14, vol: 0.12, type: 'highpass', f0: 3000, f1: 5000, q: 1 });
  },
  warp(a) {
    a.tone({ type: 'triangle', freq: 600, freq2: 120, dur: 0.4, vol: 0.2, send: 0.5 });
    a.noiseHit({ dur: 0.45, vol: 0.12, type: 'lowpass', f0: 3000, f1: 200 });
  },
  roar(a) {
    const ctx = a.ctx, t = a.t;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + 0.5); o.frequency.linearRampToValueAtTime(45, t + 1.1);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(f).connect(g).connect(a.sfxBus); o.start(t); o.stop(t + 1.25);
    a.noiseHit({ dur: 1.0, vol: 0.25, type: 'lowpass', f0: 900, f1: 120, send: 0.3 });
  },
  doorOpen(a) {
    a.tone({ type: 'triangle', freq: 220, freq2: 330, dur: 0.25, vol: 0.12, vibrato: 0.04 });
    a.noiseHit({ dur: 0.22, vol: 0.06, type: 'bandpass', f0: 900, f1: 1400, q: 6 });
  },
  doorClose(a) {
    a.tone({ type: 'triangle', freq: 110, freq2: 60, dur: 0.1, vol: 0.35 });
    a.noiseHit({ dur: 0.1, vol: 0.18, type: 'lowpass', f0: 900, f1: 200 });
  },
  equip(a) {
    a.tone({ type: 'pulse', duty: 0.25, freq: midiHz(67), dur: 0.05, vol: 0.12 });
    a.tone({ type: 'pulse', duty: 0.25, freq: midiHz(74), dur: 0.12, vol: 0.12, time: a.t + 0.06, echo: 0.2 });
    a.noiseHit({ dur: 0.08, vol: 0.12, type: 'highpass', f0: 3000 });
  },
  aggro(a) { a.tone({ type: 'pulse', duty: 0.5, freq: midiHz(81), freq2: midiHz(88), dur: 0.09, vol: 0.12 }); },
  hexCharge(a) { a.tone({ type: 'sine', freq: 200, freq2: 600, dur: 0.3, vol: 0.15, vibrato: 0.08 }); },
  blip(a, { voice = { pitch: 300, wave: 'square' } } = {}) {
    const type = voice.wave === 'triangle' ? 'triangle' : 'pulse';
    a.tone({ type, duty: voice.duty || 0.5, freq: voice.pitch * rnd(0.25), dur: 0.035, decay: 0.02, sustain: 0.5, release: 0.02, vol: type === 'triangle' ? 0.2 : 0.09 });
  },
};

export const audio = new AudioEngine();
