// ============================================================================
// Procedural music: modes, diatonic chord progressions, rule-based melody, and
// a WebAudio look-ahead scheduler that keeps generating bars forever.
//
// Nothing is sampled - every instrument is an oscillator stack (PeriodicWave
// harmonic recipes) or filtered noise.
// ============================================================================
import { clamp, makeRNG, pick } from '../core/utils.js';
import { tone, noise, boom, mtof, EPS } from './synth.js';

// ---------------------------------------------------------------------------
// Theory helpers
// ---------------------------------------------------------------------------
export const SCALES = {
  major:         [0, 2, 4, 5, 7, 9, 11],
  minor:         [0, 2, 3, 5, 7, 8, 10],
  dorian:        [0, 2, 3, 5, 7, 9, 10],
  lydian:        [0, 2, 4, 6, 7, 9, 11],
  mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  penta:         [0, 2, 4, 7, 9],
  pentaMinor:    [0, 3, 5, 7, 10],
};

/** Scale degree (may be negative or beyond one octave) into a MIDI note. */
export function scaleNote(scale, root, degree) {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = degree - oct * n;
  return root + oct * 12 + scale[idx];
}

/** Diatonic stack: [0,2,4] gives a triad, [0,2,4,6] a seventh chord. */
export function chordNotes(scale, root, deg, ext = [0, 2, 4]) {
  return ext.map((e) => scaleNote(scale, root, deg + e));
}

function nearestChordDeg(degs, cur, len, rng) {
  let best = cur, bd = Infinity, second = cur, sd = Infinity;
  for (const d of degs) {
    for (let o = -2; o <= 2; o++) {
      const c = d + o * len, dist = Math.abs(c - cur);
      if (dist < bd) { second = best; sd = bd; best = c; bd = dist; }
      else if (dist < sd) { second = c; sd = dist; }
    }
  }
  return (rng() < 0.72 || !Number.isFinite(sd)) ? best : second;
}

/**
 * Rule/Markov-ish melody for one bar. Strong beats land on chord tones, weak
 * beats step through the mode. o = { rhythms, rest, steps, range, oct }
 */
export function phrase(A, o = {}) {
  const pat = pick(A.rng, o.rhythms || [[[0, 1], [1, 1], [2, 1], [3, 1]]]);
  const len = A.scale.length;
  const lo = (o.range && o.range[0]) ?? -3, hi = (o.range && o.range[1]) ?? 11;
  const notes = [];
  for (const [b, d] of pat) {
    if (A.rng() < (o.rest ?? 0.15)) continue;
    const strong = b < 0.01 || Math.abs(b - Math.floor(A.bpb / 2)) < 0.01;
    let deg = A.st.deg ?? 2;
    if (strong) {
      deg = nearestChordDeg(A.chordDegs, deg, len, A.rng);
    } else {
      deg += pick(A.rng, o.steps || [-2, -1, -1, 1, 1, 2, 3, -3, 0]);
      if (A.rng() < 0.34) deg = nearestChordDeg(A.chordDegs, deg, len, A.rng);
    }
    if (deg < lo) deg = lo + (lo - deg);
    if (deg > hi) deg = hi - (deg - hi);
    deg = clamp(Math.round(deg), lo, hi);
    A.st.deg = deg;
    notes.push({ b, d, midi: scaleNote(A.scale, A.root, deg) + (o.oct ?? 0) * 12 });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Instruments. Each takes (ac, dest, o) with o = { t0, freq, dur, peak, ... }.
// ---------------------------------------------------------------------------
const lp = (f, mul, add, hi) => clamp(f * mul + add, 300, hi);

export const INS = {
  harp(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: 0.02, a: 0.004, d: o.dur ?? 0.9, sustain: 0.002, r: 0.14,
      peak: o.peak ?? 0.13,
      stack: [{ type: 'harp', gain: 1 }, { type: 'triangle', gain: 0.3, detune: o.detune ?? 6 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 7, 900, 12000), q: 0.7 },
      pan: o.pan, send: o.send,
    });
  },
  pluck(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: 0.02, a: 0.003, d: o.dur ?? 0.4, sustain: 0.002, r: 0.1,
      peak: o.peak ?? 0.12,
      stack: [{ type: 'pluck', gain: 1 }, { type: 'triangle', gain: 0.35, detune: -7 }],
      filter: [{ type: 'lowpass', freq: lp(o.freq, 6, 700, 9000), q: 1.1 }, { type: 'highpass', freq: 90 }],
      pan: o.pan, send: o.send,
    });
  },
  piano(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: 0.03, a: 0.005, d: o.dur ?? 1.1, sustain: 0.0025, r: 0.2,
      peak: o.peak ?? 0.13,
      stack: [{ type: 'piano', gain: 1 }, { type: 'sine', gain: 0.28, mul: 2, detune: 4 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 6, 800, 8500), freqTo: lp(o.freq, 3, 400, 5000), time: o.dur ?? 1.0, q: 0.8 },
      pan: o.pan, send: o.send,
    });
  },
  strings(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 1.6, a: o.a ?? 0.34, d: 0.3, sustain: 0.82, r: o.r ?? 0.55,
      peak: o.peak ?? 0.07,
      stack: [{ type: 'strings', gain: 1 }, { type: 'sawtooth', gain: 0.4, detune: 8 }, { type: 'sawtooth', gain: 0.4, detune: -9 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 5, 600, 4600), q: 0.9 },
      vibrato: { rate: 4.7, depth: 8, delay: 0.4 }, trem: { rate: 1.1, depth: 0.16 },
      pan: o.pan, send: o.send,
    });
  },
  tremStrings(ac, dest, o) {
    // short repeated bow strokes add up to a tremolo
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: 0.01, a: 0.006, d: o.dur ?? 0.11, sustain: 0.003, r: 0.05,
      peak: o.peak ?? 0.07,
      stack: [{ type: 'strings', gain: 1 }, { type: 'sawtooth', gain: 0.5, detune: 11 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 6, 700, 5200), q: 1.2 },
      pan: o.pan, send: o.send,
    });
  },
  choir(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 2.2, a: o.a ?? 0.75, d: 0.5, sustain: 0.85, r: o.r ?? 1.1,
      peak: o.peak ?? 0.06,
      stack: [{ type: 'choir', gain: 1 }, { type: 'sine', gain: 0.3, mul: 2, detune: 6 }, { type: 'sine', gain: 0.16, mul: 3 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 6, 1200, 3400), q: 0.7 },
      vibrato: { rate: 4.1, depth: 9, delay: 0.7 },
      pan: o.pan, send: o.send,
    });
  },
  flute(ac, dest, o) {
    const end = tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 0.6, a: 0.07, d: 0.12, sustain: 0.82, r: 0.2,
      peak: o.peak ?? 0.1,
      stack: [{ type: 'flute', gain: 1 }, { type: 'sine', gain: 0.3, mul: 2, detune: 5 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 8, 1400, 9000), q: 0.8 },
      vibrato: { rate: 5.4, depth: 14, delay: 0.14 },
      glideFrom: o.glide ? o.freq * o.glide : undefined, glideTime: 0.06,
      pan: o.pan, send: o.send,
    });
    noise(ac, dest, {
      t0: o.t0, kind: 'white', dur: (o.dur ?? 0.6) * 0.7, a: 0.08, d: 0.1, sustain: 0.6, r: 0.2,
      peak: (o.peak ?? 0.1) * 0.13,
      filter: [{ type: 'bandpass', freq: clamp(o.freq * 2.2, 400, 9000), q: 1.3 }, { type: 'highpass', freq: 900 }],
      pan: o.pan,
    });
    return end;
  },
  clarinet(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 0.9, a: 0.075, d: 0.16, sustain: 0.86, r: 0.26,
      peak: o.peak ?? 0.1,
      stack: [{ type: 'clarinet', gain: 1 }, { type: 'sine', gain: 0.22, mul: 2 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 6, 900, 4200), q: 1.0 },
      vibrato: { rate: 5.0, depth: 13, delay: 0.3 },
      glideFrom: o.glide ? o.freq * o.glide : undefined, glideTime: 0.09,
      pan: o.pan, send: o.send,
    });
  },
  brass(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 0.45, a: 0.05, d: 0.15, sustain: 0.72, r: 0.2,
      peak: o.peak ?? 0.1,
      stack: [{ type: 'brass', gain: 1 }, { type: 'sawtooth', gain: 0.32, detune: 9 }],
      filter: { type: 'lowpass', freq: lp(o.freq, 3, 500, 4200), freqTo: lp(o.freq, 6, 1400, 6000), time: 0.12, q: 1.4 },
      drive: 1.6, pan: o.pan, send: o.send,
    });
  },
  accordion(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 0.35, a: 0.035, d: 0.1, sustain: 0.85, r: 0.11,
      peak: o.peak ?? 0.08,
      stack: [{ type: 'organ', gain: 1 }, { type: 'reed', gain: 0.5, detune: 11 }, { type: 'reed', gain: 0.4, detune: -13 }],
      filter: [{ type: 'lowpass', freq: lp(o.freq, 6, 1100, 4200), q: 0.9 }, { type: 'highpass', freq: 160 }],
      trem: { rate: 5.6, depth: 0.17 },
      pan: o.pan, send: o.send,
    });
  },
  bass(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: o.dur ?? 0.7, a: 0.012, d: 0.16, sustain: 0.68, r: 0.14,
      peak: o.peak ?? 0.16,
      stack: [{ type: 'sine', gain: 1 }, { type: 'triangle', gain: 0.38 }, { type: 'sine', gain: 0.18, mul: 2 }],
      filter: { type: 'lowpass', freq: 460, q: 1.1 },
      send: o.send,
    });
  },
  bell(ac, dest, o) {
    return tone(ac, dest, {
      t0: o.t0, freq: o.freq, dur: 0.012, a: 0.003, d: o.dur ?? 1.6, sustain: 0.0015, r: 0.3,
      peak: o.peak ?? 0.07, type: 'bell',
      pan: o.pan, send: o.send,
    });
  },
  timpani(ac, dest, o) {
    const f = o.freq ?? 82;
    boom(ac, dest, {
      t0: o.t0, freq: f, freqTo: f * 0.72, freqToTime: 0.18, decay: o.dur ?? 0.7,
      peak: o.peak ?? 0.4, send: o.send,
    });
    noise(ac, dest, {
      t0: o.t0, kind: 'brown', perc: true, a: 0.002, d: 0.09, peak: (o.peak ?? 0.4) * 0.5,
      filter: [{ type: 'lowpass', freq: 700 }, { type: 'highpass', freq: 60 }],
    });
    return o.t0 + (o.dur ?? 0.7) + 0.1;
  },
  kick(ac, dest, o) {
    boom(ac, dest, { t0: o.t0, freq: o.freq ?? 155, freqTo: (o.freq ?? 155) * 0.32, freqToTime: 0.06, decay: o.dur ?? 0.19, peak: o.peak ?? 0.42 });
    noise(ac, dest, {
      t0: o.t0, kind: 'white', perc: true, a: 0.001, d: 0.022, peak: (o.peak ?? 0.42) * 0.35,
      filter: { type: 'lowpass', freq: 2600 },
    });
    return o.t0 + 0.3;
  },
  snare(ac, dest, o) {
    noise(ac, dest, {
      t0: o.t0, kind: 'white', perc: true, a: 0.001, d: o.dur ?? 0.14, peak: o.peak ?? 0.2,
      filter: [{ type: 'bandpass', freq: 1900, q: 0.9 }, { type: 'highpass', freq: 380 }],
      pan: o.pan,
    });
    tone(ac, dest, {
      t0: o.t0, freq: 195, freqTo: 150, freqToTime: 0.05, dur: 0.006, a: 0.001, d: 0.07,
      sustain: 0.0015, r: 0.02, peak: (o.peak ?? 0.2) * 0.5, type: 'triangle',
    });
    return o.t0 + 0.25;
  },
  hat(ac, dest, o) {
    return noise(ac, dest, {
      t0: o.t0, kind: 'white', perc: true, a: 0.001, d: o.dur ?? 0.035, peak: o.peak ?? 0.09,
      filter: [{ type: 'highpass', freq: 7200 }, { type: 'bandpass', freq: 9500, q: 0.8 }],
      pan: o.pan,
    });
  },
};

// ---------------------------------------------------------------------------
// Shared bar building blocks
// ---------------------------------------------------------------------------
function padChord(A, ins, o = {}) {
  const notes = o.notes || A.chord;
  const dur = o.dur ?? A.barLen * 0.98;
  for (let i = 0; i < notes.length; i++) {
    INS[ins](A.ac, A.dest, {
      t0: A.t0 + i * (o.stagger ?? 0), freq: mtof(notes[i] + (o.oct ?? 0) * 12), dur,
      peak: (o.peak ?? 0.06) * (1 - i * 0.1), a: o.a, r: o.r,
      pan: o.spread ? (i / Math.max(1, notes.length - 1) - 0.5) * o.spread : undefined,
      send: o.send,
    });
  }
}

function arpeggio(A, ins, o = {}) {
  const step = o.step ?? 0.5;
  const chord = o.notes || A.chord;
  const pattern = o.pattern || [0, 1, 2, 1];
  const oct = o.oct ?? 0;
  const n = Math.round(A.bpb / step);
  for (let i = 0; i < n; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const p = pattern[i % pattern.length];
    const extra = Math.floor(p / chord.length);
    const midi = chord[p % chord.length] + (oct + extra) * 12;
    INS[ins](A.ac, A.dest, {
      t0: A.B(i * step), freq: mtof(midi), dur: o.dur ?? step * 1.8,
      peak: (o.peak ?? 0.1) * (i % 2 ? 0.82 : 1),
      pan: o.pan ?? ((i % 4) - 1.5) * 0.12, send: o.send,
    });
  }
}

function melody(A, ins, o = {}) {
  const notes = phrase(A, o);
  for (const nt of notes) {
    INS[ins](A.ac, A.dest, {
      t0: A.B(nt.b), freq: mtof(nt.midi), dur: nt.d * A.spb * (o.legato ?? 0.92),
      peak: o.peak ?? 0.1, glide: o.glide, pan: o.pan, send: o.send,
    });
  }
  return notes;
}

const R = {
  slow:  [[[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 1.5], [1.5, 2.5]], [[0, 4]]],
  calm:  [[[0, 1], [1, 1], [2, 2]], [[0, 2], [2, 1], [3, 1]], [[0, 1], [1.5, 0.5], [2, 2]], [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]]],
  lively:[[[0, 0.5], [0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]],
          [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
          [[0, 0.75], [0.75, 0.25], [1, 1], [2, 1], [3, 1]],
          [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 0.5], [2.5, 1.5]]],
  waltz: [[[0, 1], [1, 1], [2, 1]], [[0, 2], [2, 1]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1]], [[0, 3]]],
};

// ---------------------------------------------------------------------------
// The 8 tracks
// ---------------------------------------------------------------------------
export const TRACKS = {

  // ethereal opening: harp + strings + choir pad
  title: {
    id: 'title', tempo: 70, bpb: 4, root: 62, scale: 'major', prog: [0, 4, 5, 3], barsPerChord: 2,
    bar(A) {
      const rev = [[A.revIn, 0.5]];
      padChord(A, 'choir', { peak: 0.055, oct: 0, spread: 0.5, a: 1.0, r: 1.6, send: rev, dur: A.barLen * 1.15 });
      padChord(A, 'strings', { peak: 0.05, oct: -1, a: 0.7, r: 0.9, send: [[A.revIn, 0.35]] });
      arpeggio(A, 'harp', { step: 0.5, pattern: [0, 1, 2, 3, 4, 2, 1, 0], oct: 1, peak: 0.1, dur: 1.0, send: [[A.revIn, 0.45]] });
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24), dur: A.barLen * 0.9, peak: 0.14 });
      if (A.bar % 2 === 1) melody(A, 'flute', { rhythms: R.slow, rest: 0.1, oct: 1, range: [0, 9], peak: 0.085, send: [[A.revIn, 0.5]] });
      if (A.bar % 4 === 0) INS.bell(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] + 24), dur: 2.4, peak: 0.05, send: [[A.revIn, 0.6]] });
    },
  },

  // bright daytime field: flute + plucks + light drums
  field_day: {
    id: 'field_day', tempo: 112, bpb: 4, root: 67, scale: 'major', prog: [0, 3, 4, 5], barsPerChord: 1,
    bar(A) {
      arpeggio(A, 'pluck', { step: 0.5, pattern: [0, 2, 1, 3, 2, 4, 1, 2], oct: 0, peak: 0.095, dur: 0.5 });
      padChord(A, 'strings', { peak: 0.035, oct: -1, a: 0.5, r: 0.5, send: [[A.revIn, 0.3]] });
      melody(A, 'flute', { rhythms: R.lively, rest: 0.16, oct: 1, range: [0, 10], peak: 0.085, send: [[A.revIn, 0.32]] });
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 12), dur: A.spb * 1.6, peak: 0.15 });
      INS.bass(A.ac, A.dest, { t0: A.B(2.5), freq: mtof(A.chord[2] - 12), dur: A.spb * 1.2, peak: 0.11 });
      INS.kick(A.ac, A.dest, { t0: A.t0, peak: 0.3 });
      INS.kick(A.ac, A.dest, { t0: A.B(2), peak: 0.24 });
      for (let i = 0; i < 8; i++) INS.hat(A.ac, A.dest, { t0: A.B(i * 0.5), peak: i % 2 ? 0.035 : 0.06 });
      if (A.bar % 4 === 3) INS.snare(A.ac, A.dest, { t0: A.B(3.5), peak: 0.13 });
    },
  },

  // quiet night: piano-ish arpeggio + faint strings
  field_night: {
    id: 'field_night', tempo: 62, bpb: 4, root: 57, scale: 'dorian', prog: [0, 5, 3, 4], barsPerChord: 2,
    bar(A) {
      const rev = [[A.revIn, 0.5]];
      arpeggio(A, 'piano', { step: 1, pattern: [0, 2, 1, 3], oct: 1, peak: 0.1, dur: 1.6, send: rev });
      padChord(A, 'strings', { peak: 0.03, oct: -1, a: 0.9, r: 1.0, send: [[A.revIn, 0.4]] });
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24), dur: A.barLen * 0.85, peak: 0.12 });
      if (A.bar % 2 === 0) melody(A, 'piano', { rhythms: R.calm, rest: 0.28, oct: 1, range: [2, 12], peak: 0.075, send: rev });
      if (A.bar % 4 === 2) INS.bell(A.ac, A.dest, { t0: A.B(2), freq: mtof(A.chord[1] + 24), dur: 2.6, peak: 0.045, send: [[A.revIn, 0.65]] });
    },
  },

  // Mondstadt folk waltz: accordion oom-pah-pah in 3/4
  town: {
    id: 'town', tempo: 128, bpb: 3, root: 60, scale: 'major', prog: [0, 4, 5, 3], barsPerChord: 1,
    bar(A) {
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 12), dur: A.spb * 0.8, peak: 0.17 });
      for (const b of [1, 2]) {
        for (let i = 0; i < A.chord.length; i++) {
          INS.accordion(A.ac, A.dest, {
            t0: A.B(b), freq: mtof(A.chord[i]), dur: A.spb * 0.6, peak: 0.058 - i * 0.006,
            pan: (i - 1) * 0.22,
          });
        }
      }
      melody(A, 'pluck', { rhythms: R.waltz, rest: 0.2, oct: 1, range: [0, 9], peak: 0.1, send: [[A.revIn, 0.25]] });
      INS.kick(A.ac, A.dest, { t0: A.t0, peak: 0.24, freq: 140 });
      INS.hat(A.ac, A.dest, { t0: A.B(1), peak: 0.05 });
      INS.hat(A.ac, A.dest, { t0: A.B(2), peak: 0.05 });
      if (A.bar % 4 === 3) INS.snare(A.ac, A.dest, { t0: A.B(2.5), peak: 0.1, dur: 0.08 });
    },
  },

  // battle: tremolo strings + brass stabs + kit
  combat: {
    id: 'combat', tempo: 148, bpb: 4, root: 52, scale: 'minor', prog: [0, 5, 6, 4], barsPerChord: 1,
    bar(A) {
      for (let i = 0; i < 16; i++) {
        const midi = A.chord[i % 2 === 0 ? 0 : (1 + ((i >> 2) % 2))] + 12;
        INS.tremStrings(A.ac, A.dest, {
          t0: A.B(i * 0.25), freq: mtof(midi), dur: 0.1,
          peak: 0.05 * (i % 4 === 0 ? 1.25 : 0.85), pan: (i % 2 ? 0.25 : -0.25),
        });
      }
      for (const b of [0, 2.5]) {
        for (let i = 0; i < A.chord.length; i++) {
          INS.brass(A.ac, A.dest, {
            t0: A.B(b), freq: mtof(A.chord[i] - 12), dur: A.spb * 0.5, peak: 0.085 - i * 0.012,
            send: [[A.revIn, 0.2]],
          });
        }
      }
      for (let i = 0; i < 8; i++) {
        INS.bass(A.ac, A.dest, {
          t0: A.B(i * 0.5), freq: mtof(A.chord[0] - 24 + (i % 4 === 3 ? 7 : 0)),
          dur: A.spb * 0.4, peak: i % 2 ? 0.1 : 0.15,
        });
      }
      INS.kick(A.ac, A.dest, { t0: A.t0, peak: 0.42 });
      INS.kick(A.ac, A.dest, { t0: A.B(1.5), peak: 0.3 });
      INS.kick(A.ac, A.dest, { t0: A.B(2), peak: 0.36 });
      INS.snare(A.ac, A.dest, { t0: A.B(1), peak: 0.2 });
      INS.snare(A.ac, A.dest, { t0: A.B(3), peak: 0.22 });
      for (let i = 0; i < 8; i++) INS.hat(A.ac, A.dest, { t0: A.B(i * 0.5), peak: i % 2 ? 0.04 : 0.07 });
      if (A.bar % 4 === 3) {
        for (let i = 0; i < 4; i++) INS.snare(A.ac, A.dest, { t0: A.B(3 + i * 0.25), peak: 0.1 + i * 0.05, dur: 0.09 });
        INS.brass(A.ac, A.dest, { t0: A.B(3.5), freq: mtof(A.chord[2] + 12), dur: A.spb * 0.4, peak: 0.09, send: [[A.revIn, 0.3]] });
      }
    },
  },

  // boss: timpani + tutti + chromatic descent
  boss: {
    id: 'boss', tempo: 92, bpb: 4, root: 48, scale: 'harmonicMinor', prog: [0, 0, 5, 4], barsPerChord: 1,
    bar(A) {
      const chrom = -(A.bar % 4);
      const rev = [[A.revIn, 0.45]];
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24 + chrom), dur: A.barLen * 0.95, peak: 0.2, send: rev });
      INS.timpani(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24 + chrom) * 2, dur: 0.8, peak: 0.4, send: rev });
      INS.timpani(A.ac, A.dest, { t0: A.B(2), freq: mtof(A.chord[0] - 24 + chrom) * 2, dur: 0.6, peak: 0.3, send: rev });
      if (A.bar % 4 === 3) {
        for (let i = 0; i < 6; i++) {
          INS.timpani(A.ac, A.dest, { t0: A.B(3 + i * 0.16), freq: mtof(A.chord[0] - 12 + chrom), dur: 0.3, peak: 0.12 + i * 0.04 });
        }
      }
      for (let i = 0; i < A.chord.length; i++) {
        const m = A.chord[i] + chrom;
        INS.strings(A.ac, A.dest, { t0: A.t0, freq: mtof(m), dur: A.barLen * 0.9, peak: 0.06, a: 0.12, send: rev });
        INS.brass(A.ac, A.dest, { t0: A.t0, freq: mtof(m - 12), dur: A.spb * 1.7, peak: 0.075, send: rev });
      }
      padChord(A, 'choir', { peak: 0.045, oct: 1, a: 0.8, r: 1.2, spread: 0.4, send: [[A.revIn, 0.6]] });
      const top = 84 - (A.bar % 8);
      for (const b of [0, 1.5, 3]) {
        INS.brass(A.ac, A.dest, { t0: A.B(b), freq: mtof(top - (b === 3 ? 1 : 0)), dur: A.spb * 0.7, peak: 0.06, send: rev });
      }
      INS.kick(A.ac, A.dest, { t0: A.t0, peak: 0.3 });
      INS.kick(A.ac, A.dest, { t0: A.B(2), peak: 0.26 });
      INS.snare(A.ac, A.dest, { t0: A.B(3.5), peak: 0.16 });
    },
  },

  // lyrical: clarinet solo over strings
  emotional: {
    id: 'emotional', tempo: 58, bpb: 4, root: 65, scale: 'major', prog: [0, 4, 5, 3], barsPerChord: 2,
    bar(A) {
      const rev = [[A.revIn, 0.5]];
      padChord(A, 'strings', {
        peak: 0.055, oct: -1, a: 0.8, r: 1.1, spread: 0.4, send: rev,
        notes: chordNotes(A.scale, A.root, A.deg, [0, 2, 4, 6]),
      });
      arpeggio(A, 'piano', { step: 1, pattern: [0, 2, 3, 1], oct: 0, peak: 0.075, dur: 1.8, send: rev });
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24), dur: A.barLen * 0.9, peak: 0.13 });
      melody(A, 'clarinet', { rhythms: R.slow, rest: 0.08, oct: 0, range: [2, 12], peak: 0.11, glide: 0.94, legato: 0.95, send: rev });
      if (A.bar % 4 === 2) INS.bell(A.ac, A.dest, { t0: A.B(3), freq: mtof(A.chord[2] + 12), dur: 2.2, peak: 0.04, send: [[A.revIn, 0.6]] });
    },
  },

  // windrise: flute + harmonics + air
  windrise: {
    id: 'windrise', tempo: 78, bpb: 4, root: 69, scale: 'penta', prog: [0, 3, 4, 2], barsPerChord: 2,
    bar(A) {
      const rev = [[A.revIn, 0.55]];
      padChord(A, 'choir', { peak: 0.05, oct: -1, a: 1.1, r: 1.6, spread: 0.6, send: rev, dur: A.barLen * 1.2 });
      arpeggio(A, 'harp', { step: 0.75, pattern: [0, 2, 4, 1, 3], oct: 1, peak: 0.075, dur: 1.4, send: rev });
      melody(A, 'flute', { rhythms: R.calm, rest: 0.12, oct: 1, range: [0, 8], peak: 0.095, send: rev });
      INS.bass(A.ac, A.dest, { t0: A.t0, freq: mtof(A.chord[0] - 24), dur: A.barLen * 0.85, peak: 0.1 });
      if (A.bar % 2 === 0) INS.bell(A.ac, A.dest, { t0: A.B(2), freq: mtof(A.chord[1] + 24), dur: 3.0, peak: 0.035, send: [[A.revIn, 0.7]] });
      noise(A.ac, A.dest, {
        t0: A.t0, kind: 'pink', dur: A.barLen * 0.7, a: A.barLen * 0.35, d: 0.3, sustain: 0.7, r: A.barLen * 0.45,
        peak: 0.05,
        filter: [{ type: 'lowpass', freq: 1200, q: 0.8, lfo: { rate: 0.3, depth: 400 } }, { type: 'highpass', freq: 300 }],
        send: [[A.revIn, 0.3]],
      });
    },
  },
};

export const TRACK_NAMES = Object.keys(TRACKS);

// ---------------------------------------------------------------------------
// Look-ahead scheduler (setInterval driven, schedules bars ~1s in advance)
// ---------------------------------------------------------------------------
export class MusicEngine {
  constructor(ac, busses, o = {}) {
    this.ac = ac;
    this.busses = busses;
    this.dest = busses.music;
    this.revIn = busses.reverbIn;
    this.delayIn = busses.delayIn;
    this.layers = [];
    this.current = null;
    this.seed = o.seed ?? 20240921;
    this.maxLayers = o.maxLayers ?? 3;
  }

  /** Crossfade to a track. Re-calling with the same name is a no-op. */
  set(name, fade = 2) {
    if (!TRACKS[name]) { console.warn('[music] unknown track', name); return false; }
    if (this.current === name) return false;
    const t = this.ac.currentTime + 0.04;
    const f = Math.max(0.01, fade);
    for (const l of this.layers) this._retire(l, t, f);
    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(EPS, t);
    gain.gain.linearRampToValueAtTime(1, t + f);
    gain.connect(this.dest);
    this.layers.push({
      name, def: TRACKS[name], gain, bar: 0, nextBar: t + 0.02,
      rng: makeRNG((this.seed ^ (name.length * 7919)) >>> 0), st: { deg: 2 },
      dying: false, stopAt: Infinity,
    });
    while (this.layers.length > this.maxLayers) {
      const l = this.layers.shift();
      try { l.gain.disconnect(); } catch (e) { /* noop */ }
    }
    this.current = name;
    return true;
  }

  _retire(l, t, fade) {
    if (l.dying) return;
    l.dying = true;
    l.stopAt = t + fade;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(Math.max(EPS, l.gain.gain.value), t);
    l.gain.gain.linearRampToValueAtTime(EPS, t + fade);
  }

  stop(fade = 1.5) {
    const t = this.ac.currentTime + 0.02;
    for (const l of this.layers) this._retire(l, t, Math.max(0.01, fade));
    this.current = null;
  }

  /** Schedule every active layer up to the absolute time given by until. */
  tick(until) {
    const now = this.ac.currentTime;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (l.dying && now > l.stopAt + 0.3) {
        try { l.gain.disconnect(); } catch (e) { /* noop */ }
        this.layers.splice(i, 1);
        continue;
      }
      const spb = 60 / l.def.tempo;
      const barLen = spb * l.def.bpb;
      let guard = 0;
      while (l.nextBar < until && guard++ < 24) {
        if (l.dying && l.nextBar > l.stopAt) break;
        this._bar(l, l.nextBar, spb, barLen);
        l.bar++;
        l.nextBar += barLen;
      }
    }
  }

  _bar(l, t0, spb, barLen) {
    const def = l.def;
    const scale = SCALES[def.scale] || SCALES.major;
    const bpc = def.barsPerChord || 1;
    const deg = def.prog[Math.floor(l.bar / bpc) % def.prog.length];
    const nextDeg = def.prog[Math.floor((l.bar + 1) / bpc) % def.prog.length];
    const chordDegs = [deg, deg + 2, deg + 4];
    const A = {
      ac: this.ac, dest: l.gain, revIn: this.revIn, delayIn: this.delayIn,
      t0, spb, bpb: def.bpb, barLen, bar: l.bar, rng: l.rng,
      root: def.root, scale, deg, nextDeg, chordDegs,
      chord: chordDegs.map((d) => scaleNote(scale, def.root, d)),
      st: l.st, B: (b) => t0 + b * spb,
    };
    try { def.bar(A); } catch (e) { console.error('[music] bar failed', def.id, e); }
  }

  dispose() {
    for (const l of this.layers) { try { l.gain.disconnect(); } catch (e) { /* noop */ } }
    this.layers.length = 0;
    this.current = null;
  }
}

/** Render N seconds of one track into an offline context (self-test/preview). */
export function scheduleTrackOffline(ac, busses, name, seconds) {
  const m = new MusicEngine(ac, busses);
  m.set(name, 0.02);
  m.tick(seconds);
  return m;
}
