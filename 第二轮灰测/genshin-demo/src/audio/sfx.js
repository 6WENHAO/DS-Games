// ============================================================================
// Procedural SFX library + ambience beds. Everything is synthesised on the fly.
//
// Every entry of SFX_DEFS is a function of an "A" (argument bundle):
//   A = { ac, dest, revIn, delayIn, t0, rate, vol, rng }
// and returns the approximate absolute end time of the voice it scheduled.
// ============================================================================
import { clamp } from '../core/utils.js';
import {
  tone, noise, boom, metal, mtof, noiseBuffer, loopSource,
  percEnv, swellEnv, EPS,
} from './synth.js';

const rr = (rng, a, b) => a + rng() * (b - a);

// ---------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------
export const SFX_DEFS = {

  // ---- footsteps: cheap, tiny, randomised (fired several times a second) --
  footstep_grass(A) {
    const { ac, dest, t0, rng } = A;
    const r = A.rate * rr(rng, 0.9, 1.15), v = A.vol * 0.5;
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.065, peak: v * 0.6, rate: r,
      filter: [{ type: 'highpass', freq: 620 }, { type: 'lowpass', freq: 4600 * r, freqTo: 1400 * r, time: 0.07, q: 0.8 }],
    });
    tone(ac, dest, {
      t0, freq: 132 * r, freqTo: 76 * r, freqToTime: 0.05, dur: 0.006,
      a: 0.003, d: 0.06, sustain: 0.0015, r: 0.02, peak: v * 0.32, type: 'sine',
    });
    return t0 + 0.16;
  },

  footstep_stone(A) {
    const { ac, dest, t0, rng } = A;
    const r = A.rate * rr(rng, 0.92, 1.12), v = A.vol * 0.45;
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.0015, d: 0.04, peak: v * 0.75, rate: r,
      filter: [{ type: 'highpass', freq: 1500 }, { type: 'lowpass', freq: 9000 }],
    });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.09, peak: v * 0.4, rate: r,
      filter: { type: 'bandpass', freq: 2400 * r, q: 5.5 },
    });
    boom(ac, dest, { t0, freq: 150 * r, freqTo: 90 * r, decay: 0.07, peak: v * 0.3 });
    return t0 + 0.15;
  },

  footstep_water(A) {
    const { ac, dest, t0, rng } = A;
    const r = A.rate * rr(rng, 0.88, 1.18), v = A.vol * 0.5;
    noise(ac, dest, {
      t0, kind: 'white', dur: 0.05, a: 0.004, d: 0.05, sustain: 0.35, r: 0.13, peak: v * 0.7, rate: r,
      filter: [{ type: 'bandpass', freq: 1100 * r, freqTo: 420 * r, time: 0.16, q: 1.1 },
               { type: 'highpass', freq: 260 }],
    });
    tone(ac, dest, {
      t0: t0 + 0.02, freq: 900 * r, freqTo: 380 * r, freqToTime: 0.1, dur: 0.005,
      a: 0.004, d: 0.11, sustain: 0.002, r: 0.03, peak: v * 0.2, type: 'sine',
    });
    return t0 + 0.25;
  },

  // ---- weapon swings ------------------------------------------------------
  swing1(A) { return swoosh(A, 1500, 0.17, 0.44); },
  swing2(A) { return swoosh(A, 1150, 0.22, 0.5); },
  swing3(A) { return swoosh(A, 1950, 0.14, 0.56); },

  // ---- impacts ------------------------------------------------------------
  hit_flesh(A) {
    const { ac, dest, t0, rng } = A;
    const r = A.rate * rr(rng, 0.94, 1.08), v = A.vol;
    boom(ac, dest, { t0, freq: 105 * r, freqTo: 46 * r, decay: 0.22, peak: v * 0.6 });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.13, peak: v * 0.42, rate: r,
      filter: [{ type: 'lowpass', freq: 1400 * r, freqTo: 400, time: 0.12, q: 1.2 }, { type: 'highpass', freq: 110 }],
    });
    noise(ac, dest, {
      t0, kind: 'pink', perc: true, a: 0.002, d: 0.06, peak: v * 0.3, rate: r,
      filter: { type: 'bandpass', freq: 430 * r, q: 2.2 },
    });
    return t0 + 0.4;
  },

  hit_metal(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const r = A.rate * rr(rng, 0.95, 1.09), v = A.vol;
    metal(ac, dest, {
      t0, freq: 660 * r, ratios: [1, 1.42, 1.97, 2.63, 3.42], decay: 0.42, q: 8,
      peak: v * 0.3, type: 'square', send: [[revIn, 0.22]],
    });
    tone(ac, dest, {
      t0, freq: 5200 * r, dur: 0.006, a: 0.002, d: 0.5, sustain: 0.0015, r: 0.05,
      peak: v * 0.09, type: 'bell', send: [[revIn, 0.3]],
    });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.001, d: 0.045, peak: v * 0.35, rate: r,
      filter: { type: 'highpass', freq: 2600 },
    });
    boom(ac, dest, { t0, freq: 170 * r, freqTo: 95 * r, decay: 0.1, peak: v * 0.3 });
    return t0 + 0.75;
  },

  crit(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const r = A.rate * rr(rng, 0.98, 1.04), v = A.vol;
    metal(ac, dest, {
      t0, freq: 880 * r, ratios: [1, 1.51, 2.11, 2.98], decay: 0.5, q: 9,
      peak: v * 0.22, type: 'square', send: [[revIn, 0.3]],
    });
    const notes = [mtof(93), mtof(100), mtof(105)];
    for (let i = 0; i < notes.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.045, freq: notes[i] * r, dur: 0.008,
        a: 0.002, d: 0.55 - i * 0.1, sustain: 0.0015, r: 0.08,
        peak: v * (0.16 - i * 0.03), type: 'bell', send: [[revIn, 0.45]],
      });
    }
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.22, peak: v * 0.16,
      filter: { type: 'highpass', freq: 6200 }, send: [[revIn, 0.3]],
    });
    return t0 + 0.9;
  },

  // ---- creatures ----------------------------------------------------------
  slime_die(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const r = A.rate * rr(rng, 0.9, 1.12), v = A.vol;
    tone(ac, dest, {
      t0, freq: 460 * r, freqTo: 110 * r, freqToTime: 0.42, dur: 0.3,
      a: 0.01, d: 0.1, sustain: 0.7, r: 0.16, peak: v * 0.3, type: 'sine',
      vibrato: { rate: 13, depth: 220, delay: 0.02 },
      filter: { type: 'lowpass', freq: 2200, freqTo: 500, time: 0.4, q: 3 },
      send: [[revIn, 0.2]],
    });
    noise(ac, dest, {
      t0, kind: 'pink', dur: 0.22, a: 0.01, d: 0.1, sustain: 0.5, r: 0.2, peak: v * 0.3,
      rate: r, rateTo: r * 0.4,
      filter: [{ type: 'bandpass', freq: 900 * r, freqTo: 280 * r, time: 0.4, q: 1.6 }],
    });
    for (let i = 0; i < 3; i++) {
      const tt = t0 + 0.12 + i * rr(rng, 0.07, 0.14);
      tone(ac, dest, {
        t0: tt, freq: rr(rng, 500, 1100) * r, freqTo: rr(rng, 180, 340) * r, freqToTime: 0.06,
        dur: 0.005, a: 0.002, d: 0.06, sustain: 0.0015, r: 0.02, peak: v * 0.12, type: 'sine',
      });
    }
    return t0 + 0.8;
  },

  enemy_alert(A) {
    const { ac, dest, t0 } = A;
    const r = A.rate, v = A.vol;
    for (let i = 0; i < 2; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.11, freq: (990 + i * 340) * r, dur: 0.05,
        a: 0.004, d: 0.03, sustain: 0.5, r: 0.07, peak: v * 0.22, type: 'square',
        filter: { type: 'lowpass', freq: 4200, q: 1.2 },
      });
    }
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.05, peak: v * 0.1,
      filter: { type: 'bandpass', freq: 3000, q: 3 },
    });
    return t0 + 0.35;
  },

  dragon_roar(A) {
    const { ac, dest, revIn, delayIn, t0, rng } = A;
    const r = A.rate * rr(rng, 0.97, 1.05), v = A.vol;
    const sends = [[revIn, 0.5], [delayIn, 0.18]];
    // fundamental with a menacing bend
    tone(ac, dest, {
      t0, freq: 62 * r, dur: 1.5, a: 0.09, d: 0.35, sustain: 0.85, r: 0.7, peak: v * 0.33,
      type: 'sine', glideFrom: 44 * r, glideTime: 0.22, freqTo: 40 * r, freqToTime: 1.9,
      send: sends,
    });
    // detuned saw body through a formant sweep + drive
    tone(ac, dest, {
      t0: t0 + 0.02, freq: 86 * r, dur: 1.45, a: 0.11, d: 0.3, sustain: 0.8, r: 0.65, peak: v * 0.24,
      stack: [{ type: 'sawtooth', gain: 1 }, { type: 'sawtooth', gain: 0.85, detune: 24 },
              { type: 'sawtooth', gain: 0.6, detune: -31 }],
      drive: 3.5,
      filter: [{ type: 'lowpass', freq: 260, freqTo: 1050, time: 0.5, freqBack: 190, backTime: 1.4, q: 3.4 },
               { type: 'highpass', freq: 60 }],
      vibrato: { rate: 5.5, depth: 40, delay: 0.2 },
      send: sends,
    });
    // growl noise
    noise(ac, dest, {
      t0, kind: 'brown', dur: 1.4, a: 0.1, d: 0.3, sustain: 0.75, r: 0.7, peak: v * 0.25, rate: 0.7,
      filter: [{ type: 'bandpass', freq: 230, q: 2.4, lfo: { rate: 7.5, depth: 130 } },
               { type: 'lowpass', freq: 1600 }],
      drive: 2.2, send: sends,
    });
    // upper snarl
    tone(ac, dest, {
      t0: t0 + 0.14, freq: 330 * r, dur: 1.1, a: 0.16, d: 0.4, sustain: 0.55, r: 0.6, peak: v * 0.08,
      stack: [{ type: 'sawtooth', gain: 1 }, { type: 'square', gain: 0.4, detune: 17 }],
      filter: { type: 'bandpass', freq: 900, freqTo: 420, time: 1.4, q: 2.2 },
      vibrato: { rate: 6.2, depth: 70, delay: 0.1 },
      send: sends,
    });
    return t0 + 3.2;
  },

  // ---- player movement ----------------------------------------------------
  jump(A) {
    const { ac, dest, t0 } = A;
    const r = A.rate, v = A.vol;
    tone(ac, dest, {
      t0, freq: 430 * r, glideFrom: 200 * r, glideTime: 0.11, dur: 0.05,
      a: 0.006, d: 0.06, sustain: 0.4, r: 0.09, peak: v * 0.24, type: 'triangle',
      filter: { type: 'lowpass', freq: 2600, q: 1 },
    });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.004, d: 0.11, peak: v * 0.18,
      filter: [{ type: 'highpass', freq: 900 }, { type: 'lowpass', freq: 5200, freqTo: 1600, time: 0.12 }],
    });
    return t0 + 0.25;
  },

  land(A) {
    const { ac, dest, t0, rng } = A;
    const r = A.rate * rr(rng, 0.95, 1.06), v = A.vol;
    boom(ac, dest, { t0, freq: 125 * r, freqTo: 48 * r, decay: 0.3, peak: v * 0.66 });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.13, peak: v * 0.4, rate: r,
      filter: [{ type: 'lowpass', freq: 1100, freqTo: 320, time: 0.13 }, { type: 'highpass', freq: 90 }],
    });
    noise(ac, dest, {
      t0: t0 + 0.01, kind: 'white', perc: true, a: 0.002, d: 0.07, peak: v * 0.2,
      filter: { type: 'highpass', freq: 2100 },
    });
    return t0 + 0.45;
  },

  glide_open(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const v = A.vol;
    for (let i = 0; i < 3; i++) {
      noise(ac, dest, {
        t0: t0 + i * rr(rng, 0.07, 0.12), kind: 'white', perc: true, a: 0.004, d: rr(rng, 0.07, 0.12),
        peak: v * (0.34 - i * 0.07),
        filter: [{ type: 'bandpass', freq: rr(rng, 700, 1300), q: 1.1 }, { type: 'highpass', freq: 320 }],
      });
    }
    noise(ac, dest, {
      t0: t0 + 0.05, kind: 'pink', dur: 0.9, a: 0.35, d: 0.25, sustain: 0.7, r: 0.6, peak: v * 0.3,
      filter: [{ type: 'lowpass', freq: 700, freqTo: 1500, time: 0.8, q: 0.8, lfo: { rate: 0.7, depth: 260 } },
               { type: 'highpass', freq: 180 }],
      send: [[revIn, 0.2]],
    });
    tone(ac, dest, {
      t0: t0 + 0.06, freq: 520, glideFrom: 300, glideTime: 0.5, dur: 0.5,
      a: 0.3, d: 0.2, sustain: 0.6, r: 0.5, peak: v * 0.07, type: 'flute',
      send: [[revIn, 0.35]],
    });
    return t0 + 1.8;
  },

  // ---- elemental skills ---------------------------------------------------
  skill_anemo(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const r = A.rate, v = A.vol;
    noise(ac, dest, {
      t0, kind: 'white', dur: 0.5, a: 0.06, d: 0.14, sustain: 0.75, r: 0.35, peak: v * 0.42, rate: r,
      filter: [{ type: 'bandpass', freq: 420 * r, freqTo: 3100 * r, time: 0.55, q: 2.4, lfo: { rate: 17, depth: 480 } },
               { type: 'highpass', freq: 260 }],
      send: [[revIn, 0.35]],
    });
    tone(ac, dest, {
      t0, freq: 700 * r, glideFrom: 230 * r, glideTime: 0.42, dur: 0.32,
      a: 0.05, d: 0.14, sustain: 0.6, r: 0.34, peak: v * 0.17, type: 'flute',
      vibrato: { rate: 9, depth: 40, delay: 0.05 },
      send: [[revIn, 0.4]],
    });
    for (let i = 0; i < 3; i++) {
      tone(ac, dest, {
        t0: t0 + 0.16 + i * 0.07, freq: mtof(88 + i * 5) * r, dur: 0.006,
        a: 0.002, d: 0.38, sustain: 0.0015, r: 0.06, peak: v * 0.075, type: 'bell',
        send: [[revIn, 0.5]],
      });
    }
    return t0 + 1.2;
  },

  skill_pyro(A) {
    const { ac, dest, revIn, t0, rng } = A;
    const r = A.rate, v = A.vol;
    noise(ac, dest, {
      t0, kind: 'pink', dur: 0.34, a: 0.02, d: 0.13, sustain: 0.6, r: 0.32, peak: v * 0.5, rate: r,
      filter: [{ type: 'lowpass', freq: 4600 * r, freqTo: 420, time: 0.55, q: 1.3 }, { type: 'highpass', freq: 130 }],
      send: [[revIn, 0.25]],
    });
    boom(ac, dest, { t0, freq: 96 * r, freqTo: 42 * r, decay: 0.34, peak: v * 0.42, send: [[revIn, 0.2]] });
    for (let i = 0; i < 7; i++) {
      noise(ac, dest, {
        t0: t0 + rr(rng, 0.03, 0.55), kind: 'white', perc: true, a: 0.001, d: rr(rng, 0.015, 0.045),
        peak: v * rr(rng, 0.07, 0.17),
        filter: { type: 'bandpass', freq: rr(rng, 2200, 6500), q: 4 },
      });
    }
    return t0 + 1.0;
  },

  burst(A) {
    const { ac, dest, revIn, delayIn, t0, rng } = A;
    const r = A.rate, v = A.vol;
    const sends = [[revIn, 0.6], [delayIn, 0.14]];
    boom(ac, dest, { t0, freq: 140 * r, freqTo: 26 * r, decay: 1.0, freqToTime: 0.7, peak: v * 0.8, send: sends });
    noise(ac, dest, {
      t0, kind: 'brown', perc: true, a: 0.004, d: 0.8, peak: v * 0.55, rate: r * 0.8,
      filter: [{ type: 'lowpass', freq: 2000, freqTo: 240, time: 0.9, q: 1.1 }],
      drive: 2.2, send: sends,
    });
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.3, peak: v * 0.34,
      filter: { type: 'highpass', freq: 3200 }, send: sends,
    });
    metal(ac, dest, { t0: t0 + 0.02, freq: 520 * r, decay: 0.7, peak: v * 0.12, q: 6, send: [[revIn, 0.6]] });
    return t0 + 2.6;
  },

  // ---- UI -----------------------------------------------------------------
  ui_click(A) {
    const { ac, dest, t0 } = A, v = A.vol;
    tone(ac, dest, {
      t0, freq: 1180 * A.rate, dur: 0.012, a: 0.002, d: 0.05, sustain: 0.0015, r: 0.03,
      peak: v * 0.2, type: 'square', filter: { type: 'lowpass', freq: 5200, q: 1 },
    });
    noise(ac, dest, { t0, kind: 'white', perc: true, a: 0.001, d: 0.022, peak: v * 0.08, filter: { type: 'highpass', freq: 4200 } });
    return t0 + 0.12;
  },

  ui_hover(A) {
    const { ac, dest, t0 } = A, v = A.vol;
    tone(ac, dest, {
      t0, freq: 1760 * A.rate, dur: 0.01, a: 0.003, d: 0.05, sustain: 0.0015, r: 0.03,
      peak: v * 0.09, type: 'sine',
    });
    return t0 + 0.1;
  },

  ui_confirm(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const ns = [mtof(81), mtof(88)];
    for (let i = 0; i < ns.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.075, freq: ns[i] * r, dur: 0.02, a: 0.003, d: 0.28, sustain: 0.0015, r: 0.06,
        peak: v * 0.17, type: 'bell', send: [[revIn, 0.3]],
      });
    }
    tone(ac, dest, {
      t0: t0 + 0.15, freq: mtof(93) * r, dur: 0.01, a: 0.002, d: 0.4, sustain: 0.0015, r: 0.08,
      peak: v * 0.08, type: 'bell', send: [[revIn, 0.4]],
    });
    return t0 + 0.7;
  },

  ui_cancel(A) {
    const { ac, dest, t0 } = A, v = A.vol, r = A.rate;
    const ns = [mtof(74), mtof(69)];
    for (let i = 0; i < ns.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.07, freq: ns[i] * r, dur: 0.03, a: 0.004, d: 0.12, sustain: 0.1, r: 0.08,
        peak: v * 0.15, type: 'square', filter: { type: 'lowpass', freq: 1900, q: 1.2 },
      });
    }
    return t0 + 0.35;
  },

  // ---- world / progression -------------------------------------------------
  chest_open(A) {
    const { ac, dest, revIn, t0, rng } = A, v = A.vol, r = A.rate;
    // wooden lid
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.002, d: 0.09, peak: v * 0.34,
      filter: [{ type: 'bandpass', freq: 430, q: 3.4 }, { type: 'highpass', freq: 180 }],
    });
    tone(ac, dest, {
      t0, freq: 190 * r, freqTo: 130 * r, freqToTime: 0.1, dur: 0.008,
      a: 0.003, d: 0.13, sustain: 0.0015, r: 0.04, peak: v * 0.26, type: 'triangle',
    });
    noise(ac, dest, {
      t0: t0 + 0.06, kind: 'pink', dur: 0.12, a: 0.02, d: 0.08, sustain: 0.4, r: 0.12, peak: v * 0.14,
      filter: { type: 'bandpass', freq: 1500, freqTo: 2600, time: 0.2, q: 2 },
    });
    // reward arpeggio (pentatonic up)
    const arp = [72, 76, 79, 84, 88];
    for (let i = 0; i < arp.length; i++) {
      tone(ac, dest, {
        t0: t0 + 0.14 + i * 0.075, freq: mtof(arp[i]) * r, dur: 0.01,
        a: 0.003, d: 0.55, sustain: 0.0015, r: 0.12, peak: v * (0.15 - i * 0.012),
        type: 'harp', send: [[revIn, 0.4]],
      });
    }
    tone(ac, dest, {
      t0: t0 + 0.52, freq: mtof(96) * r, dur: 0.01, a: 0.002, d: 0.9, sustain: 0.0015, r: 0.2,
      peak: v * 0.08, type: 'bell', send: [[revIn, 0.55]],
    });
    return t0 + 1.6;
  },

  waypoint_unlock(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const arp = [72, 76, 79, 83, 88, 91];
    for (let i = 0; i < arp.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.085, freq: mtof(arp[i]) * r, dur: 0.012,
        a: 0.003, d: 0.9 - i * 0.06, sustain: 0.0015, r: 0.25,
        peak: v * (0.15 - i * 0.011), type: 'bell', send: [[revIn, 0.6]],
      });
    }
    // crystalline shimmer pad underneath
    tone(ac, dest, {
      t0, freq: mtof(60) * r, dur: 0.9, a: 0.35, d: 0.3, sustain: 0.7, r: 0.9, peak: v * 0.1,
      stack: [{ type: 'choir', gain: 1 }, { type: 'sine', gain: 0.5, mul: 2 }, { type: 'sine', gain: 0.3, mul: 3 }],
      filter: { type: 'lowpass', freq: 3200, q: 0.8 }, send: [[revIn, 0.5]],
    });
    noise(ac, dest, {
      t0, kind: 'white', dur: 0.5, a: 0.2, d: 0.2, sustain: 0.5, r: 0.5, peak: v * 0.09,
      filter: { type: 'bandpass', freq: 7200, q: 1.6 }, send: [[revIn, 0.5]],
    });
    return t0 + 2.2;
  },

  quest_accept(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const ch = [72, 76, 79];
    for (let i = 0; i < ch.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.035, freq: mtof(ch[i]) * r, dur: 0.015,
        a: 0.004, d: 0.6, sustain: 0.0015, r: 0.14, peak: v * 0.15, type: 'harp',
        send: [[revIn, 0.35]],
      });
    }
    tone(ac, dest, {
      t0: t0 + 0.1, freq: mtof(91) * r, dur: 0.01, a: 0.002, d: 0.7, sustain: 0.0015, r: 0.16,
      peak: v * 0.09, type: 'bell', send: [[revIn, 0.45]],
    });
    return t0 + 1.1;
  },

  quest_complete(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const chords = [[60, 64, 67], [67, 71, 74], [72, 76, 79, 84]];
    let end = t0;
    for (let c = 0; c < chords.length; c++) {
      const tt = t0 + c * 0.26;
      for (const m of chords[c]) {
        const e = tone(ac, dest, {
          t0: tt, freq: mtof(m) * r, dur: c === 2 ? 0.5 : 0.2,
          a: 0.02, d: 0.1, sustain: 0.6, r: c === 2 ? 0.6 : 0.16,
          peak: v * (c === 2 ? 0.13 : 0.1),
          stack: [{ type: 'brass', gain: 1 }, { type: 'sawtooth', gain: 0.3, detune: 8 }],
          filter: { type: 'lowpass', freq: 3600, freqTo: 2400, time: 0.4, q: 1.1 },
          send: [[revIn, 0.4]],
        });
        if (e > end) end = e;
      }
    }
    tone(ac, dest, {
      t0: t0 + 0.52, freq: mtof(96) * r, dur: 0.01, a: 0.002, d: 1.1, sustain: 0.0015, r: 0.3,
      peak: v * 0.1, type: 'bell', send: [[revIn, 0.6]],
    });
    return end + 0.6;
  },

  puzzle_solve(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const arp = [69, 71, 74, 76, 79, 83, 86];
    for (let i = 0; i < arp.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.062, freq: mtof(arp[i]) * r, dur: 0.01,
        a: 0.003, d: 0.5, sustain: 0.0015, r: 0.16, peak: v * (0.14 - i * 0.009),
        stack: [{ type: 'harp', gain: 1 }, { type: 'bell', gain: 0.35, mul: 2 }],
        send: [[revIn, 0.5]],
      });
    }
    for (const m of [74, 78, 81, 86]) {
      tone(ac, dest, {
        t0: t0 + 0.44, freq: mtof(m) * r, dur: 0.4, a: 0.06, d: 0.3, sustain: 0.5, r: 0.7,
        peak: v * 0.075, type: 'choir', filter: { type: 'lowpass', freq: 3000 }, send: [[revIn, 0.55]],
      });
    }
    return t0 + 1.9;
  },

  // ---- bow ----------------------------------------------------------------
  bow_charge(A) {
    const { ac, dest, t0 } = A, v = A.vol, r = A.rate;
    tone(ac, dest, {
      t0, freq: 116 * r, dur: 0.7, a: 0.5, d: 0.2, sustain: 0.85, r: 0.14, peak: v * 0.2,
      stack: [{ type: 'sawtooth', gain: 1 }, { type: 'sawtooth', gain: 0.6, detune: 12 }],
      filter: { type: 'lowpass', freq: 200, freqTo: 1900, time: 0.85, q: 4.5 },
    });
    tone(ac, dest, {
      t0, freq: 620 * r, glideFrom: 300 * r, glideTime: 0.8, dur: 0.7,
      a: 0.45, d: 0.2, sustain: 0.8, r: 0.16, peak: v * 0.08, type: 'triangle',
      vibrato: { rate: 6, depth: 18, delay: 0.3 },
    });
    noise(ac, dest, {
      t0, kind: 'pink', dur: 0.7, a: 0.4, d: 0.2, sustain: 0.8, r: 0.16, peak: v * 0.13,
      filter: { type: 'bandpass', freq: 1300, q: 2.4, lfo: { rate: 3.5, depth: 350 } },
    });
    return t0 + 1.0;
  },

  bow_shot(A) {
    const { ac, dest, t0, rng } = A, v = A.vol, r = A.rate * rr(rng, 0.97, 1.05);
    noise(ac, dest, {
      t0, kind: 'white', perc: true, a: 0.001, d: 0.05, peak: v * 0.5,
      filter: [{ type: 'highpass', freq: 1100 }, { type: 'bandpass', freq: 2400, q: 2.2 }],
    });
    tone(ac, dest, {
      t0, freq: 340 * r, freqTo: 150 * r, freqToTime: 0.08, dur: 0.006,
      a: 0.002, d: 0.11, sustain: 0.0015, r: 0.03, peak: v * 0.28, type: 'pluck',
      filter: { type: 'bandpass', freq: 900 * r, q: 2 },
    });
    noise(ac, dest, {
      t0: t0 + 0.02, kind: 'white', dur: 0.1, a: 0.01, d: 0.06, sustain: 0.5, r: 0.2, peak: v * 0.22,
      filter: [{ type: 'bandpass', freq: 1600, freqTo: 5200, time: 0.28, q: 3 }],
    });
    return t0 + 0.5;
  },

  // ---- support ------------------------------------------------------------
  heal(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    const ch = [72, 76, 79, 84];
    for (let i = 0; i < ch.length; i++) {
      tone(ac, dest, {
        t0: t0 + i * 0.09, freq: mtof(ch[i]) * r, dur: 0.5, a: 0.16, d: 0.25, sustain: 0.6, r: 0.6,
        peak: v * 0.11,
        stack: [{ type: 'choir', gain: 1 }, { type: 'sine', gain: 0.45, mul: 2 }],
        filter: { type: 'lowpass', freq: 3400, q: 0.8 },
        vibrato: { rate: 4.6, depth: 10, delay: 0.25 },
        send: [[revIn, 0.5]],
      });
    }
    noise(ac, dest, {
      t0, kind: 'white', dur: 0.6, a: 0.3, d: 0.25, sustain: 0.5, r: 0.5, peak: v * 0.07,
      filter: { type: 'bandpass', freq: 5600, freqTo: 9000, time: 1.0, q: 1.4 }, send: [[revIn, 0.45]],
    });
    return t0 + 2.0;
  },

  death(A) {
    const { ac, dest, revIn, t0 } = A, v = A.vol, r = A.rate;
    tone(ac, dest, {
      t0, freq: 220 * r, freqTo: 96 * r, freqToTime: 1.3, dur: 1.0, a: 0.05, d: 0.4, sustain: 0.7, r: 0.8,
      stack: [{ type: 'strings', gain: 1 }, { type: 'sawtooth', gain: 0.4, detune: -14 }],
      peak: v * 0.22, filter: { type: 'lowpass', freq: 1800, freqTo: 380, time: 1.4, q: 1.4 },
      send: [[revIn, 0.5]],
    });
    for (let i = 0; i < 2; i++) {
      tone(ac, dest, {
        t0: t0 + 0.05 + i * 0.42, freq: mtof(60 - i * 3) * r, dur: 0.5,
        a: 0.03, d: 0.3, sustain: 0.4, r: 0.7, peak: v * 0.13, type: 'piano',
        send: [[revIn, 0.55]],
      });
    }
    boom(ac, dest, { t0, freq: 78 * r, freqTo: 34 * r, decay: 0.9, peak: v * 0.4, send: [[revIn, 0.4]] });
    noise(ac, dest, {
      t0, kind: 'brown', dur: 0.5, a: 0.06, d: 0.3, sustain: 0.4, r: 0.8, peak: v * 0.16,
      filter: { type: 'lowpass', freq: 900, freqTo: 200, time: 1.3 }, send: [[revIn, 0.4]],
    });
    return t0 + 2.6;
  },

  wind_gust(A) {
    const { ac, dest, revIn, t0, rng } = A, v = A.vol;
    const dur = rr(rng, 0.9, 1.4);
    noise(ac, dest, {
      t0, kind: 'pink', dur, a: dur * 0.45, d: dur * 0.2, sustain: 0.8, r: dur * 0.7, peak: v * 0.34,
      rate: rr(rng, 0.8, 1.2),
      filter: [{ type: 'lowpass', freq: 900, freqTo: 1900, time: dur, q: 0.9, lfo: { rate: 0.5, depth: 340 } },
               { type: 'highpass', freq: 200 }],
      send: [[revIn, 0.2]],
    });
    noise(ac, dest, {
      t0: t0 + 0.1, kind: 'white', dur: dur * 0.7, a: dur * 0.4, d: dur * 0.2, sustain: 0.7, r: dur * 0.6,
      peak: v * 0.1,
      filter: { type: 'bandpass', freq: 1400, q: 5, lfo: { rate: 0.35, depth: 700 } },
      send: [[revIn, 0.3]],
    });
    return t0 + dur * 2.4;
  },
};

/** Shared implementation of the three sword swings. */
function swoosh(A, center, dur, peak) {
  const { ac, dest, t0, rng } = A;
  const r = A.rate * rr(rng, 0.93, 1.1), v = A.vol * peak;
  noise(ac, dest, {
    t0, kind: 'white', dur: dur * 0.45, a: dur * 0.3, d: dur * 0.25, sustain: 0.7, r: dur * 0.55, peak: v,
    rate: r,
    filter: [{ type: 'bandpass', freq: center * 0.42 * r, freqTo: center * 2.1 * r, time: dur * 0.8, q: 1.7 },
             { type: 'highpass', freq: 420 }],
  });
  noise(ac, dest, {
    t0: t0 + dur * 0.35, kind: 'white', dur: dur * 0.3, a: dur * 0.2, d: dur * 0.2, sustain: 0.5, r: dur * 0.5,
    peak: v * 0.5, rate: r,
    filter: [{ type: 'bandpass', freq: center * 1.9 * r, freqTo: center * 0.6 * r, time: dur * 0.8, q: 1.4 }],
  });
  tone(ac, dest, {
    t0, freq: 300 * r, freqTo: 130 * r, freqToTime: dur, dur: dur * 0.4,
    a: dur * 0.25, d: dur * 0.2, sustain: 0.5, r: dur * 0.5, peak: v * 0.22, type: 'sine',
  });
  return t0 + dur * 2.2;
}

export const SFX_NAMES = Object.keys(SFX_DEFS);

/** Rough per-sfx retrigger guard (seconds) so spam cannot pile up. */
export const SFX_MIN_GAP = {
  footstep_grass: 0.085, footstep_stone: 0.085, footstep_water: 0.085,
  ui_hover: 0.05, ui_click: 0.03,
  hit_flesh: 0.035, hit_metal: 0.035, crit: 0.05,
  dragon_roar: 1.2, burst: 0.25, wind_gust: 0.4, bow_charge: 0.4,
};

// ---------------------------------------------------------------------------
// Ambience beds
// ---------------------------------------------------------------------------
function bed(ac, out, o) {
  // helper: looping noise -> filter chain -> gain -> out
  const src = loopSource(ac, noiseBuffer(ac, o.kind || 'pink', 2), o.rate ?? 1);
  const g = ac.createGain();
  g.gain.value = o.gain ?? 0.3;
  let cur = src;
  for (const f of (o.filters || [])) {
    const b = ac.createBiquadFilter();
    b.type = f.type || 'lowpass';
    b.frequency.value = clamp(f.freq ?? 800, 20, ac.sampleRate * 0.45);
    if (f.q !== undefined) b.Q.value = f.q;
    cur.connect(b); cur = b;
    if (f.lfo) {
      const l = ac.createOscillator();
      l.frequency.value = f.lfo.rate ?? 0.1;
      const lg = ac.createGain(); lg.gain.value = f.lfo.depth ?? 200;
      l.connect(lg); lg.connect(b.frequency);
      o.nodes.push(l);
    }
  }
  cur.connect(g); g.connect(out);
  if (o.amp) {
    const l = ac.createOscillator();
    l.frequency.value = o.amp.rate ?? 0.12;
    const lg = ac.createGain(); lg.gain.value = (o.amp.depth ?? 0.3) * (o.gain ?? 0.3);
    l.connect(lg); lg.connect(g.gain);
    o.nodes.push(l);
  }
  o.nodes.push(src);
  return g;
}

function drone(ac, out, nodes, freq, gain, type = 'sine', detune = 0) {
  const osc = ac.createOscillator();
  osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
  const g = ac.createGain(); g.gain.value = gain;
  osc.connect(g); g.connect(out);
  nodes.push(osc);
  return g;
}

function birdChirp(ac, dest, revIn, t, rng, high = 1) {
  const n = 2 + Math.floor(rng() * 3);
  const base = rr(rng, 2000, 3400) * high;
  for (let i = 0; i < n; i++) {
    const tt = t + i * rr(rng, 0.05, 0.1);
    const f = base * rr(rng, 0.9, 1.25);
    tone(ac, dest, {
      t0: tt, freq: f, glideFrom: f * rr(rng, 0.6, 0.9), glideTime: 0.03,
      freqTo: f * rr(rng, 0.75, 1.3), freqToTime: 0.05,
      dur: 0.02, a: 0.006, d: 0.03, sustain: 0.3, r: 0.05, peak: rr(rng, 0.08, 0.17),
      type: 'sine', pan: rr(rng, -0.7, 0.7), send: [[revIn, 0.3]],
    });
  }
  return n;
}

export const AMBIENCE_DEFS = {
  meadow: {
    wet: 0.14, rate: [0.7, 2.6],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'pink', rate: 0.85, gain: 0.34,
        filters: [{ type: 'lowpass', freq: 760, q: 0.7, lfo: { rate: 0.08, depth: 280 } }, { type: 'highpass', freq: 90 }],
        amp: { rate: 0.13, depth: 0.35 } });
      bed(ac, out, { nodes, kind: 'white', rate: 1, gain: 0.05,
        filters: [{ type: 'bandpass', freq: 3000, q: 0.8, lfo: { rate: 0.21, depth: 900 } }],
        amp: { rate: 0.27, depth: 0.6 } });
      return { nodes, event: (t, rng) => birdChirp(ac, out, o.revIn, t, rng, 1) };
    },
  },

  forest: {
    wet: 0.22, rate: [1.6, 5.5],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'brown', rate: 0.7, gain: 0.42,
        filters: [{ type: 'lowpass', freq: 420, q: 0.8, lfo: { rate: 0.06, depth: 160 } }],
        amp: { rate: 0.09, depth: 0.4 } });
      bed(ac, out, { nodes, kind: 'white', rate: 1.1, gain: 0.07,
        filters: [{ type: 'bandpass', freq: 2600, q: 0.7, lfo: { rate: 0.17, depth: 700 } }, { type: 'highpass', freq: 700 }],
        amp: { rate: 0.19, depth: 0.75 } });
      drone(ac, out, nodes, 96, 0.012, 'sine');
      return {
        nodes,
        event: (t, rng) => {
          if (rng() < 0.55) birdChirp(ac, out, o.revIn, t, rng, 0.75);
          else {
            // branch creak
            tone(ac, out, {
              t0: t, freq: rr(rng, 150, 260), freqTo: rr(rng, 110, 190), freqToTime: 0.5,
              dur: 0.3, a: 0.08, d: 0.2, sustain: 0.5, r: 0.4, peak: 0.06,
              stack: [{ type: 'sawtooth', gain: 1 }],
              filter: { type: 'bandpass', freq: 700, q: 6 }, send: [[o.revIn, 0.4]],
            });
          }
        },
      };
    },
  },

  lake: {
    wet: 0.2, rate: [1.2, 4.5],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'pink', rate: 0.6, gain: 0.4,
        filters: [{ type: 'bandpass', freq: 520, q: 1.1, lfo: { rate: 0.11, depth: 240 } }, { type: 'lowpass', freq: 1800 }],
        amp: { rate: 0.18, depth: 0.55 } });
      bed(ac, out, { nodes, kind: 'white', rate: 0.9, gain: 0.06,
        filters: [{ type: 'bandpass', freq: 2200, q: 1.4, lfo: { rate: 0.33, depth: 600 } }],
        amp: { rate: 0.41, depth: 0.7 } });
      return {
        nodes,
        event: (t, rng) => {
          const f = rr(rng, 900, 1900);
          tone(ac, out, {
            t0: t, freq: f, freqTo: f * 0.45, freqToTime: 0.14, dur: 0.008,
            a: 0.003, d: 0.16, sustain: 0.0015, r: 0.05, peak: rr(rng, 0.12, 0.22),
            type: 'sine', pan: rr(rng, -0.6, 0.6), send: [[o.revIn, 0.5]],
          });
          noise(ac, out, {
            t0: t, kind: 'white', perc: true, a: 0.001, d: 0.03, peak: 0.05,
            filter: { type: 'bandpass', freq: f * 1.6, q: 3 },
          });
        },
      };
    },
  },

  snow: {
    wet: 0.16, rate: [2.5, 7],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'white', rate: 0.75, gain: 0.34,
        filters: [{ type: 'highpass', freq: 260 }, { type: 'lowpass', freq: 2100, q: 0.8, lfo: { rate: 0.07, depth: 700 } }],
        amp: { rate: 0.05, depth: 0.5 } });
      bed(ac, out, { nodes, kind: 'white', rate: 1, gain: 0.08,
        filters: [{ type: 'bandpass', freq: 1250, q: 7, lfo: { rate: 0.09, depth: 620 } }],
        amp: { rate: 0.11, depth: 0.8 } });
      drone(ac, out, nodes, 46, 0.05, 'sine');
      drone(ac, out, nodes, 69, 0.02, 'sine', 8);
      return {
        nodes,
        event: (t, rng) => {
          noise(ac, out, {
            t0: t, kind: 'pink', dur: rr(rng, 1.0, 2.0), a: 0.8, d: 0.4, sustain: 0.8, r: 1.2,
            peak: rr(rng, 0.12, 0.24),
            filter: [{ type: 'bandpass', freq: rr(rng, 900, 1800), q: 4, lfo: { rate: 0.3, depth: 500 } },
                     { type: 'highpass', freq: 300 }],
            send: [[o.revIn, 0.25]],
          });
        },
      };
    },
  },

  night: {
    wet: 0.18, rate: [5, 13],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'brown', rate: 0.6, gain: 0.24,
        filters: [{ type: 'lowpass', freq: 320, q: 0.7, lfo: { rate: 0.04, depth: 110 } }],
        amp: { rate: 0.07, depth: 0.3 } });
      // cricket layer: narrow band noise gated by a fast tremolo
      const crickets = bed(ac, out, { nodes, kind: 'white', rate: 1, gain: 0.055,
        filters: [{ type: 'bandpass', freq: 4900, q: 12 }, { type: 'highpass', freq: 2600 }] });
      const trem = ac.createOscillator();
      trem.type = 'sine'; trem.frequency.value = 23;
      const tg = ac.createGain(); tg.gain.value = 0.05;
      trem.connect(tg); tg.connect(crickets.gain);
      const slow = ac.createOscillator();
      slow.type = 'sine'; slow.frequency.value = 0.14;
      const sg = ac.createGain(); sg.gain.value = 0.035;
      slow.connect(sg); sg.connect(crickets.gain);
      nodes.push(trem, slow);
      drone(ac, out, nodes, 87, 0.018, 'sine');
      return {
        nodes,
        event: (t, rng) => {
          // owl
          const f = rr(rng, 380, 470);
          for (let i = 0; i < 2; i++) {
            tone(ac, out, {
              t0: t + i * 0.4, freq: f * (i ? 0.94 : 1), dur: 0.22,
              a: 0.06, d: 0.1, sustain: 0.6, r: 0.3, peak: 0.12,
              stack: [{ type: 'sine', gain: 1 }, { type: 'sine', gain: 0.25, mul: 2 }],
              vibrato: { rate: 5, depth: 14, delay: 0.05 },
              filter: { type: 'lowpass', freq: 1400 }, send: [[o.revIn, 0.55]],
            });
          }
        },
      };
    },
  },

  cave: {
    wet: 0.3, rate: [1.8, 6.5],
    build(ac, out, o) {
      const nodes = [];
      bed(ac, out, { nodes, kind: 'brown', rate: 0.5, gain: 0.42,
        filters: [{ type: 'lowpass', freq: 210, q: 1.1, lfo: { rate: 0.03, depth: 80 } }],
        amp: { rate: 0.05, depth: 0.35 } });
      bed(ac, out, { nodes, kind: 'white', rate: 0.8, gain: 0.035,
        filters: [{ type: 'bandpass', freq: 780, q: 4, lfo: { rate: 0.13, depth: 260 } }] });
      drone(ac, out, nodes, 57, 0.055, 'sine');
      drone(ac, out, nodes, 86, 0.028, 'sine', -12);
      return {
        nodes,
        event: (t, rng) => {
          const f = rr(rng, 1100, 2300);
          tone(ac, out, {
            t0: t, freq: f, freqTo: f * 0.4, freqToTime: 0.12, dur: 0.008,
            a: 0.002, d: 0.14, sustain: 0.0015, r: 0.05, peak: rr(rng, 0.14, 0.26),
            type: 'sine', pan: rr(rng, -0.8, 0.8),
            send: [[o.revIn, 0.7], [o.delayIn, 0.35]],
          });
        },
      };
    },
  },
};

export const AMBIENCE_NAMES = Object.keys(AMBIENCE_DEFS);

/**
 * Instantiate one ambience layer. Returns a handle with fade/stop control.
 * o = { dest, revIn, delayIn, gain }
 */
export function buildAmbience(ac, name, o) {
  const def = AMBIENCE_DEFS[name] || AMBIENCE_DEFS.meadow;
  const g = ac.createGain();
  g.gain.value = EPS;
  g.connect(o.dest);
  const revSend = ac.createGain();
  revSend.gain.value = def.wet ?? 0.15;
  g.connect(revSend);
  if (o.revIn) revSend.connect(o.revIn);

  const built = def.build(ac, g, o);
  const target = o.gain ?? 1;
  let started = false, stopped = false;

  return {
    name, gain: g, rate: def.rate || [2, 5],
    event: built.event,
    start(t) {
      if (started) return;
      started = true;
      for (const n of built.nodes) { try { n.start(t); } catch (e) { /* already started */ } }
    },
    fadeIn(t, time = 2) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(EPS, g.gain.value), t);
      g.gain.linearRampToValueAtTime(target, t + Math.max(0.01, time));
    },
    fadeOut(t, time = 2) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(EPS, g.gain.value), t);
      g.gain.linearRampToValueAtTime(EPS, t + Math.max(0.01, time));
    },
    stop(t) {
      if (stopped) return;
      stopped = true;
      for (const n of built.nodes) { try { n.stop(t); } catch (e) { /* not started */ } }
    },
  };
}
