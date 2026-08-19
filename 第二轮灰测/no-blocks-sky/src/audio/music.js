/**
 * music.js — generative soundtrack director for "no-blocks-sky"
 * ---------------------------------------------------------------------------
 * A procedural (no samples) music engine that fuses two aesthetics:
 *
 *   Style A — "No Man's Sky" / 65daysofstatic:
 *     slowly evolving detuned saw/triangle pads through a lowpass with a very
 *     slow filter LFO, 3-8 s attacks, huge convolution reverb, deep sub-bass
 *     drones, shimmering high bell arpeggios drenched in delay, tape-ish
 *     noise swells. Modal harmony, chord changes every 8-24 s.
 *
 *   Style B — "Minecraft" / C418:
 *     sparse, gentle, slightly out-of-time piano-like voices (sine+triangle
 *     stack, ~8 ms attack, exponential 1.2-2.5 s decay, subtle detune, soft
 *     lowpass), pentatonic/Ionian motifs, wide spacing, lonely and warm.
 *
 * FUSION: 'surface' floats Style B melody over Style A pads (the signature
 * sound of the game). 'space' is pure Style A plus a slow sub pulse every ~4 s.
 * 'cave' is dark drone + filtered noise + rare dissonant piano. 'danger' pulses
 * a 16th-note ostinato under a minor-2nd cluster pad with noise risers. 'warp'
 * accelerates a rising arpeggio over a massive sub into a bright pad. 'station'
 * is a calm safe-harbour of major-7 pads and gentle bells. 'title' is the
 * theme: a 6-8 note minor motif on the piano voice, answered by pads, over a
 * big low swell.
 *
 * Everything is scheduled by a ~200 ms lookahead scheduler that queues events
 * up to ~1.2 s ahead using absolute AudioContext times, so there is no
 * setTimeout-per-note drift. update() only touches AudioParams — it never
 * allocates nodes.
 *
 * Integration: voices connect to audio.music; sends go to audio.revSend /
 * audio.revSendBig / audio.delaySend. Nothing in the engine is modified.
 */

/* =========================================================================
 *  constants, scales, note helpers
 * ========================================================================= */

const MIN_GAIN = 0.0001;   // never ramp exponentially to 0
const LOOKAHEAD = 1.2;     // seconds of events queued ahead of now
const TICK_MS = 200;       // scheduler wake-up interval
const MAX_VOICE = 14;      // simultaneous voice oscillators (hard ceiling)
const MAX_BED = 7;         // lane for pads / drones (guaranteed)
const MAX_SUB = 2;         // lane reserved for the deep sub-bass
const MAX_LEAD = 5;        // lane kept free for melody, bells, ostinato
                           // BED + SUB + LEAD == MAX_VOICE: a hard ceiling
const MAX_NOISE = 3;       // concurrent noise sources (buffer sources, not oscillators)
const LFO_RATES = [0.021, 0.047];   // Hz — two shared control-rate filter LFOs
                                    // (control rate, outside the voice budget)

export const SCALES = {
  aeolian:  [0, 2, 3, 5, 7, 8, 10],
  dorian:   [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian:   [0, 2, 4, 6, 7, 9, 11],
  ionian:   [0, 2, 4, 5, 7, 9, 11],
  mixo:     [0, 2, 4, 5, 7, 9, 10],
  pentaMaj: [0, 2, 4, 7, 9],
  pentaMin: [0, 3, 5, 7, 10],
  ambig:    [0, 2, 5, 7, 9, 10],   // quartal / ambiguous tonality
};

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' -> 60, 'F#2' -> 42, 'Bb3' -> 58 (MIDI numbers, A4 = 69). */
export function noteToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) return 60;
  let semi = LETTERS[m[1].toUpperCase()];
  if (m[2] === '#') semi += 1;
  else if (m[2] === 'b') semi -= 1;
  return semi + (parseInt(m[3], 10) + 1) * 12;
}

/** semitones relative to A4 -> Hz */
export function freqFromA4(semitoneFromA4) {
  return 440 * Math.pow(2, semitoneFromA4 / 12);
}

/** MIDI note -> Hz */
export function midiToFreq(midi) {
  return freqFromA4(midi - 69);
}

/** Deterministic-per-session PRNG so each play-through gets its own voicings. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Per-mode tonal identity. Roots stay low; the scale sets the colour. */
const MODE_KEYS = {
  title:   { root: noteToMidi('A2'), scales: ['aeolian', 'phrygian'] },
  surface: { root: noteToMidi('D3'), scales: ['dorian', 'lydian', 'ionian'] },
  space:   { root: noteToMidi('F2'), scales: ['aeolian', 'ambig', 'dorian'] },
  cave:    { root: noteToMidi('C2'), scales: ['phrygian', 'aeolian'] },
  danger:  { root: noteToMidi('E2'), scales: ['phrygian', 'aeolian'] },
  warp:    { root: noteToMidi('G2'), scales: ['lydian', 'mixo'] },
  station: { root: noteToMidi('F3'), scales: ['ionian', 'lydian'] },
  silence: { root: noteToMidi('A2'), scales: ['aeolian'] },
};

/* Chord walks, expressed as scale-degree indices (0 = tonic). */
const PROGRESSIONS = {
  title:   [[0, 5, 3, 4], [0, -2, 3, 5], [0, 4, 5, 3]],
  surface: [[0, 5, 3, 1], [0, 3, 5, 4], [0, -2, 4, 2], [0, 6, 3, 5]],
  space:   [[0, 4, -3, 2], [0, 3, 6, 2], [0, -2, 4, 1]],
  cave:    [[0, 1, 0, -2], [0, -1, 0, 3]],
  danger:  [[0, 0, 1, 0], [0, 1, 0, 4]],
  warp:    [[0, 4, 2, 6], [0, 3, 5, 4]],
  station: [[0, 3, 5, 1], [0, 5, 3, 4], [0, 2, 5, 3]],
  silence: [[0]],
};

/* Crossfade lengths (seconds) per destination mode. */
const FADE = {
  title: 4.0, surface: 4.5, space: 5.0, cave: 4.0,
  danger: 2.2, warp: 2.0, station: 3.5, silence: 3.0,
};

/* Memorable title-theme contours (scale degrees, minor mode). */
const MOTIFS = [
  [4, 2, 0, -1, 0, 2],
  [0, 4, 3, 2, 4, 0, -3],
  [4, 7, 4, 2, 0, 2, -1],
  [0, 2, 4, 2, 7, 4, 2, 0],
  [7, 4, 5, 4, 2, 0, -2],
];

const RHYTHMS = [
  [0.95, 0.95, 1.5, 0.75, 0.75, 2.4],
  [0.7, 0.7, 0.7, 1.6, 1.0, 1.0, 2.6],
  [1.2, 0.6, 0.6, 1.2, 1.8, 0.9, 2.2],
];
/* =========================================================================
 *  MusicDirector
 * ========================================================================= */

export class MusicDirector {
  constructor(audio) {
    this.audio = audio;
    this.mode = 'silence';
    this.intensity = 0.5;

    this._rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    this._timer = null;
    this._cleanupTimer = null;
    this._started = false;

    // graph (built lazily, once the AudioContext exists)
    this.out = null;       // sum of all mode buses
    this.tilt = null;      // global brightness lowpass
    this.duckGain = null;  // cinematic ducking
    this.buses = new Map();
    this._lfos = [];       // shared slow filter LFOs (see _ensureGraph)
    this._retire = [];     // faded-out buses awaiting disconnect

    // scheduler
    this._sched = [];      // [{ name, next, run(when) -> secondsUntilNextEvent }]
    this._active = [];     // polyphony reservations { t0, t1, n }
    this._sources = new Set();

    // musical state
    this.keys = {};
    this._ms = null;       // per-mode state (chord walk, phrases, bars, ...)
    this._keyChangeAt = 0;
    this.motif = { degrees: MOTIFS[0], rhythm: RHYTHMS[0] };

    // automation state (driven by update())
    this.info = { dayT: 0.5, underground: false, altitude: 0, hazard: 0, health: 1 };
    this.brightness = 1;
    this.tension = 0;
    this._autoAcc = 0;
    this._level = 1;
  }

  /* --------------------------------------------------------------------- *
   *  public API
   * --------------------------------------------------------------------- */

  start(mode = 'title') {
    if (!this.audio.enabled || !this.audio.ctx) return;
    this._ensureGraph();
    this._started = true;
    this.mode = null;            // force a full mode build, even for 'silence'
    this._sched = [];
    this.setMode(mode, { fade: 2.6 });
  }

  /** Crossfade to another mode (2-6 s). Calling with the current mode is a no-op. */
  setMode(mode, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    if (!MODE_KEYS[mode]) mode = 'surface';
    if (mode === this.mode && !opts.force) return;

    this._ensureGraph();
    const ctx = this.audio.ctx;
    const now = this._now();
    const fade = Math.min(6, Math.max(2, opts.fade != null ? opts.fade : (FADE[mode] || 4)));

    // fade out every sounding bus; its tails keep ringing through it
    for (const [name, bus] of this.buses) {
      if (name === mode) continue;
      const g = bus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(MIN_GAIN, g.value), now);
      g.exponentialRampToValueAtTime(MIN_GAIN, now + fade);
      this._retire.push({ name, bus, at: now + fade + 9 });
    }
    this.buses = new Map([...this.buses].filter(function (e) { return e[0] === mode; }));

    // fade in the destination bus
    let bus = this.buses.get(mode);
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = MIN_GAIN;
      bus.connect(this.out);
      this.buses.set(mode, bus);
    }
    const target = mode === 'silence' ? MIN_GAIN : 1;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(MIN_GAIN, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(target, now + fade * 0.85);

    this.mode = mode;
    this._initModeState(mode);
    this._sched = this._buildGenerators(mode, bus, now);
    this._startTimer();
  }

  /** Cheap per-frame parameter automation only — allocates nothing. */
  update(dt, ctxInfo) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    if (ctxInfo) {
      const i = this.info;
      if (ctxInfo.dayT != null) i.dayT = ctxInfo.dayT;
      if (ctxInfo.underground != null) i.underground = !!ctxInfo.underground;
      if (ctxInfo.altitude != null) i.altitude = ctxInfo.altitude;
      if (ctxInfo.hazard != null) i.hazard = ctxInfo.hazard;
      if (ctxInfo.health != null) i.health = ctxInfo.health;
    }

    this._autoAcc += (typeof dt === 'number' && dt > 0 ? dt : 0.016);
    if (this._autoAcc < 0.12) return;          // throttle AudioParam writes
    this._autoAcc = 0;
    if (!this.tilt || !this.out) return;

    const info = this.info;
    const now = this._now();

    // daylight curve: dayT 0..1 with ~0.5 = noon
    const day = 0.5 + 0.5 * Math.cos((0.5 - (info.dayT || 0)) * Math.PI * 2);
    const hurt = 1 - Math.min(1, Math.max(0, info.health == null ? 1 : info.health));
    const hazNum = typeof info.hazard === 'number' && Number.isFinite(info.hazard) ? info.hazard : 0;
    const haz = Math.min(1, Math.max(0, hazNum));
    const altNum = typeof info.altitude === 'number' && Number.isFinite(info.altitude) ? info.altitude : 0;
    const high = Math.min(1, Math.max(0, altNum / 240));

    let bright = 0.42 + 0.34 * this.intensity + 0.2 * day + 0.16 * high - 0.22 * hurt;
    if (info.underground) bright *= 0.5;
    if (this.mode === 'cave') bright *= 0.62;
    else if (this.mode === 'space') bright *= 0.92;
    bright = Math.min(1.25, Math.max(0.16, bright));
    this.brightness = bright;
    this.tension = Math.min(1, haz * 0.7 + hurt * 0.5);

    const cut = 320 * Math.pow(40, bright);    // ~380 Hz .. 16 kHz
    this.tilt.frequency.setTargetAtTime(Math.min(17000, cut), now, 0.5);
    this.tilt.Q.setTargetAtTime(0.3 + 0.5 * this.tension, now, 0.6);

    const lvl = (0.74 + 0.32 * this.intensity) * (1 - 0.12 * hurt);
    if (Math.abs(lvl - this._level) > 0.01) {
      this._level = lvl;
      this.out.gain.setTargetAtTime(lvl, now, 0.8);
    }
  }

  /** 0..1 — scales density and brightness. */
  setIntensity(v) {
    this.intensity = Math.min(1, Math.max(0, typeof v === 'number' ? v : 0.5));
  }

  /** Briefly pull the music bus down for a cinematic moment. */
  duck(seconds = 2) {
    if (!this.audio.enabled || !this.audio.ctx || !this.duckGain) return;
    const now = this._now();
    const hold = Math.min(20, Math.max(0.2, seconds));
    const g = this.duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(MIN_GAIN, g.value), now);
    g.exponentialRampToValueAtTime(0.16, now + 0.35);
    g.setValueAtTime(0.16, now + 0.35 + hold);
    g.exponentialRampToValueAtTime(1, now + 0.35 + hold + 1.4);
  }

  /** Tear everything down: timers, scheduled sources, graph. */
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._cleanupTimer) { clearTimeout(this._cleanupTimer); this._cleanupTimer = null; }
    this._sched = [];
    this._active = [];
    this._started = false;
    this.mode = 'silence';

    if (!this.audio.ctx) { this._sources.clear(); return; }
    const now = this._now();

    if (this.out) {
      const g = this.out.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(Math.max(MIN_GAIN, g.value), now);
        g.exponentialRampToValueAtTime(MIN_GAIN, now + 0.3);
      } catch (e) { /* ignore */ }
    }
    for (const s of this._sources) {
      try { s.stop(now + 0.34); } catch (e) { /* ignore */ }
    }

    for (const osc of this._lfos) {
      try { osc.stop(now + 0.34); } catch (e) { /* ignore */ }
    }
    const nodes = [this.out, this.tilt, this.duckGain, ...this._lfos];
    this._lfos = [];
    for (const bus of this.buses.values()) nodes.push(bus);
    for (const r of this._retire) nodes.push(r.bus);
    this.buses = new Map();
    this._retire = [];
    this.out = null; this.tilt = null; this.duckGain = null;

    this._cleanupTimer = setTimeout(() => {
      this._cleanupTimer = null;
      for (const n of nodes) { try { if (n) n.disconnect(); } catch (e) { /* ignore */ } }
      this._sources.clear();
    }, 500);
  }
  /* --------------------------------------------------------------------- *
   *  graph + scheduler plumbing
   * --------------------------------------------------------------------- */

  _now() { return this.audio.ctx ? this.audio.ctx.currentTime : 0; }
  _rnd(a, b) { return a + (b - a) * this._rng(); }
  _pick(arr) { return arr[Math.min(arr.length - 1, Math.floor(this._rng() * arr.length))]; }
  _chance(p) { return this._rng() < p; }

  _ensureGraph() {
    if (!this.audio.ctx || this.out) return;
    const ctx = this.audio.ctx;
    if (this._cleanupTimer) { clearTimeout(this._cleanupTimer); this._cleanupTimer = null; }

    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.duckGain.connect(this.audio.music);

    this.tilt = ctx.createBiquadFilter();
    this.tilt.type = 'lowpass';
    this.tilt.frequency.value = 9000;
    this.tilt.Q.value = 0.4;
    this.tilt.connect(this.duckGain);

    this.out = ctx.createGain();
    this.out.gain.value = this._level;
    this.out.connect(this.tilt);

    // Two shared, always-running slow LFOs. Pads tap one through their own
    // depth gain, so the "very slow filter sweep" costs no per-pad oscillator.
    this._lfos = LFO_RATES.map((rate) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rate;
      osc.start(ctx.currentTime);
      return osc;
    });
  }

  _startTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      try { this._tick(); } catch (e) { /* never let audio break the game loop */ }
    }, TICK_MS);
  }

  /** The lookahead scheduler: absolute times only, ~1.2 s of runway. */
  _tick() {
    if (!this.audio.enabled || !this.audio.ctx || !this.out) return;
    const now = this._now();
    const until = now + LOOKAHEAD;

    // retire buses whose tails have finished
    for (let i = this._retire.length - 1; i >= 0; i--) {
      if (this._retire[i].at <= now) {
        try { this._retire[i].bus.disconnect(); } catch (e) { /* ignore */ }
        this._retire.splice(i, 1);
      }
    }
    if (this._active.length > 120) {
      this._active = this._active.filter(function (v) { return v.t1 > now; });
    }

    for (const gen of this._sched) {
      if (gen.next < now) gen.next = now + 0.05;   // recover from tab throttling
      let guard = 0;
      while (gen.next < until && guard++ < 32) {
        const when = gen.next;
        let delta = 4;
        try { delta = gen.run(when); } catch (e) { delta = 4; }
        if (!isFinite(delta) || delta < 0.05) delta = 0.05;
        gen.next = when + delta;
      }
    }

    if (now > this._keyChangeAt) this._transpose();
  }

  /**
   * Polyphony reservation with two lanes: 'bed' (pads, drones, sub, noise) and
   * 'lead' (melody, bells, ostinato). The lanes stop the harmonic bed from
   * eating the lane the melody needs, and the total stays under MAX_VOICE.
   */
  _poly(when, dur, n, lane = 'lead') {
    const now = this._now();
    if (this._active.length) {
      this._active = this._active.filter(function (v) { return v.t1 > now - 0.5; });
    }
    let total = 0, same = 0;
    for (const v of this._active) {
      if (v.t0 < when + dur && v.t1 > when) {
        if (v.lane !== 'noise') total += v.n;
        if (v.lane === lane) same += v.n;
      }
    }
    if (lane === 'noise') {
      if (same + n > MAX_NOISE) return false;          // not oscillators: own cap
    } else if (lane === 'bed' || lane === 'sub') {
      // The harmonic bed and the sub-bass own their lanes outright: a chord
      // change or a drone is never dropped because the melody is busy.
      if (same + n > (lane === 'bed' ? MAX_BED : MAX_SUB)) return false;
    } else {
      // Leads live in their own lane and borrow whatever the bed is not using,
      // so the absolute total can never pass MAX_VOICE.
      if (same + n > MAX_LEAD || total + n > MAX_VOICE) return false;
    }
    this._active.push({ t0: when, t1: when + dur, n, lane });
    return true;
  }

  _track(node) {
    this._sources.add(node);
    node.onended = () => { this._sources.delete(node); };
    return node;
  }

  _bus() { return this.buses.get(this.mode) || this.out; }

  /** Feed a node to reverb / big reverb / delay at the given depths. */
  _sends(node, opts) {
    const o = opts || {};
    const ctx = this.audio.ctx;
    const mk = (dest, amt) => {
      if (!dest || !amt || amt <= 0) return;
      const g = ctx.createGain();
      g.gain.value = amt;
      node.connect(g);
      g.connect(dest);
    };
    mk(this.audio.revSend, o.rev);
    mk(this.audio.revSendBig, o.revBig);
    mk(this.audio.delaySend, o.dly);
  }

  /* --------------------------------------------------------------------- *
   *  harmony
   * --------------------------------------------------------------------- */

  _key() {
    let k = this.keys[this.mode];
    if (!k) {
      const def = MODE_KEYS[this.mode] || MODE_KEYS.surface;
      k = { root: def.root, scale: this._pick(def.scales) };
      this.keys[this.mode] = k;
    }
    return k;
  }

  /** scale degree (negative or beyond the octave is fine) -> MIDI note */
  _deg(d, key) {
    const k = key || this._key();
    const sc = SCALES[k.scale] || SCALES.aeolian;
    const n = sc.length;
    const oct = Math.floor(d / n);
    const idx = d - oct * n;
    return k.root + sc[idx] + 12 * oct;
  }

  /** semitones from A4 -> Hz (required note helper) */
  _freq(semitoneFromA4) { return freqFromA4(semitoneFromA4); }

  /** MIDI -> Hz */
  _mf(midi) { return midiToFreq(midi); }

  /** Build a pad voicing (array of Hz) rooted on a scale degree. */
  _voicing(deg, style, octave) {
    const oct = octave == null ? 1 : octave;
    const degs = style === 'quartal' ? [0, 3, 6, 9]
      : style === 'seventh' ? [0, 2, 4, 6]
        : style === 'ninth' ? [0, 2, 4, 8]
          : style === 'open' ? [0, 4, 7]
            : [0, 2, 4];
    const out = [];
    for (const d of degs) out.push(this._mf(this._deg(deg + d) + 12 * oct));
    return out;
  }

  /** Occasional key move by +-2 / +-5 semitones (every ~2-4 minutes). */
  _transpose() {
    const shift = this._pick([-5, -2, 2, 5]);
    for (const name of Object.keys(this.keys)) {
      const k = this.keys[name];
      const base = (MODE_KEYS[name] || MODE_KEYS.surface).root;
      let r = k.root + shift;
      if (r < base - 5) r += 12;
      if (r > base + 5) r -= 12;
      k.root = r;
    }
    this.motif = { degrees: this._pick(MOTIFS), rhythm: this._pick(RHYTHMS) };
    this._keyChangeAt = this._now() + this._rnd(120, 240);
  }

  _initModeState(mode) {
    const def = MODE_KEYS[mode] || MODE_KEYS.surface;
    if (!this.keys[mode]) this.keys[mode] = { root: def.root, scale: this._pick(def.scales) };
    if (!this._keyChangeAt) this._keyChangeAt = this._now() + this._rnd(120, 240);
    this._ms = {
      prog: (PROGRESSIONS[mode] || PROGRESSIONS.surface).slice(),
      progRow: this._pick(PROGRESSIONS[mode] || PROGRESSIONS.surface).slice(),
      step: 0,
      formStep: 0,
      bar: 0,
      bpm: this._rnd(132, 150),
      phrase: null,
      phraseIdx: 0,
      rest: 4,
    };
    this.motif = { degrees: this._pick(MOTIFS), rhythm: this._pick(RHYTHMS) };
  }

  _nextDegree() {
    const ms = this._ms;
    const row = ms.progRow;
    let d = row[ms.step % row.length];
    ms.step++;
    if (this._chance(0.16)) d += this._pick([-2, 2, 3]);   // ambiguous substitution
    return d;
  }
  /* =====================================================================
   *  VOICES
   * ===================================================================== */

  /** Create + track one oscillator with its own trim gain, wired into dest. */
  _osc(dest, wave, freq, gain, when, stopAt, detune) {
    const ctx = this.audio.ctx;
    const osc = this._track(ctx.createOscillator());
    osc.type = wave;
    osc.frequency.value = freq;
    osc.detune.value = detune || 0;
    if (gain === 1) {
      osc.connect(dest);
    } else {
      const og = ctx.createGain();
      og.gain.value = gain;
      osc.connect(og); og.connect(dest);
    }
    osc.start(when);
    osc.stop(stopAt);
    return osc;
  }

  /**
   * Release a voice's output node once its primary source has ended, plus any
   * extra teardown (e.g. unhooking a shared LFO tap) so nothing is kept alive.
   */
  _autoFree(head, vg, cleanup) {
    head.onended = () => {
      this._sources.delete(head);
      try { vg.disconnect(); } catch (e) { /* ignore */ }
      if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } }
    };
  }

  /**
   * Style A pad: detuned saw/triangle stack -> lowpass -> long attack / long
   * release -> bus + reverb, with a shared very slow LFO sweeping the filter.
   * Chords thin out (see the ladder below) rather than dropping when the
   * texture is full, so the harmonic bed is always present.
   */
  _pad(freqs, when, dur, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    let list = (freqs || []).filter(function (f) { return isFinite(f) && f > 20 && f < 8000; });
    if (!list.length) return;

    const {
      type = 'sawtooth', peak = 0.05, attack = 5, release = 6, cutoff = 780,
      q = 0.9, detune = 7, rev = 0.55, revBig = 0.4, dly = 0,
      lfoRate = 0.035, lfoDepth = 380, pan = 0, layers = 2,
    } = opts;

    const total = attack + dur + release;
    if (list.length > 4) list = list.slice(0, 4);

    // Degradation ladder: a chord may thin out, but it must never vanish.
    // [notes, oscillators per note] — the first entry that fits the bed lane
    // wins. Nothing asks for more than 4 oscillators, so two chords can always
    // overlap during a crossfade without starving the melody lane.
    const wide = Math.max(2, Math.min(4, list.length));
    const fat = Math.max(1, Math.min(2, layers));
    const ladder = [];
    if (fat === 2 && wide <= 2) ladder.push([wide, 2]);
    ladder.push([wide, 1], [3, 1], [2, 1]);
    let per = 0, notes = 0;
    for (const step of ladder) {
      const nn = Math.min(list.length, step[0]);
      if (this._poly(when, total, nn * step[1], 'bed')) { notes = nn; per = step[1]; break; }
    }
    if (!per) return;
    if (notes < list.length) {
      // keep the outer voices (root and top colour) when thinning
      const kept = [list[0]];
      for (let i = list.length - 1; i > 0 && kept.length < notes; i--) kept.push(list[i]);
      list = kept;
    }

    const vg = ctx.createGain();              // envelope / voice output
    vg.gain.value = MIN_GAIN;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    const fc = Math.min(9000, Math.max(120, cutoff * (0.55 + 0.75 * this.brightness)));
    filt.frequency.value = fc;
    filt.Q.value = q;
    filt.connect(vg);

    // tap a shared very slow LFO through this pad's own depth gain: the sweep
    // fades in with the pad and is unhooked again when the pad dies
    let tap = null;
    if (this._lfos.length) {
      // pick the shared LFO closest to the requested rate, and flip the depth
      // sign at random so overlapping pads never sweep in lockstep
      let lfo = this._lfos[0], best = Infinity;
      for (let i = 0; i < this._lfos.length; i++) {
        const d = Math.abs(LFO_RATES[i] - lfoRate);
        if (d < best) { best = d; lfo = this._lfos[i]; }
      }
      const amp = ctx.createGain();
      const depth = Math.min(fc * 0.7, lfoDepth) * (this._chance(0.5) ? 1 : -1);
      amp.gain.value = MIN_GAIN;
      amp.gain.setValueAtTime(MIN_GAIN, when);
      amp.gain.linearRampToValueAtTime(depth, when + attack);
      amp.gain.setValueAtTime(depth, when + attack + dur);
      amp.gain.linearRampToValueAtTime(MIN_GAIN, when + total);
      lfo.connect(amp);
      amp.connect(filt.frequency);
      tap = { lfo, amp };
    }

    const norm = 1 / Math.sqrt(list.length * per);
    let last = null;
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < per; j++) {
        const wave = ((j === 1 || (per === 1 && i % 2)) && this._chance(0.5))
          ? 'triangle' : type;
        // with one oscillator per note, alternate the detune sign so adjacent
        // chord tones still beat against each other
        const sign = per === 1 ? (i % 2 ? 1 : -1) : (j === 0 ? -1 : 1);
        const cents = sign * detune * this._rnd(0.6, 1.4)
          + this.tension * 6 * (this._rng() - 0.5);
        last = this._osc(filt, wave, list[i], norm * (j === 0 ? 1 : 0.82),
          when, when + total + 0.05, cents);
      }
    }

    let tail = vg;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      vg.connect(p);
      tail = p;
    }
    tail.connect(this._bus());
    this._sends(tail, { rev, revBig, dly });

    // long, click-free envelope (linear in, exponential out, floor 0.0001)
    const g = vg.gain;
    const pk = Math.max(0.0008, peak);
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(pk, when + attack);
    g.setValueAtTime(pk, when + attack + dur);
    g.exponentialRampToValueAtTime(MIN_GAIN, when + total);

    if (last) {
      this._autoFree(last, vg, tap ? () => {
        try { tap.lfo.disconnect(tap.amp); } catch (e) { /* ignore */ }
        tap.amp.disconnect();
      } : null);
    }
  }

  /**
   * Style B piano-ish voice: sine + detuned triangle (+ faint octave sparkle),
   * ~8 ms attack, exponential decay, soft lowpass. Warm and lonely.
   */
  _piano(freq, when, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    if (!isFinite(freq) || freq < 25 || freq > 5000) return;
    const ctx = this.audio.ctx;
    const {
      vel = 0.7, decay = 1.8, detune = 5, cutoff = 2500,
      rev = 0.3, revBig = 0.1, dly = 0.1, sparkle = true, pan = 0,
    } = opts;

    const dur = Math.max(0.4, decay) + 0.1;
    // graceful degradation: sine+triangle if there is room, otherwise a bare
    // sine — a melody note is never dropped just because the texture is full
    let body = true;
    if (!this._poly(when, dur, 2)) {
      if (!this._poly(when, dur, 1)) return;
      body = false;
    }
    const wantSparkle = body && sparkle && freq < 700
      && this._chance(0.5) && this._poly(when, dur, 1);

    const vg = ctx.createGain();
    vg.gain.value = MIN_GAIN;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(6000, cutoff * (0.6 + 0.6 * this.brightness));
    filt.Q.value = 0.4;
    filt.connect(vg);

    const stop = when + dur;
    const head = this._osc(filt, 'sine', freq, 0.72, when, stop, this._rnd(-1.5, 1.5));
    if (body) {
      this._osc(filt, 'triangle', freq, 0.34, when, stop, detune * this._rnd(0.5, 1.3));
    }
    if (wantSparkle) this._osc(filt, 'sine', freq * 2.002, 0.1, when, stop);

    let tail = vg;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      vg.connect(p); tail = p;
    }
    tail.connect(this._bus());
    this._sends(tail, { rev, revBig, dly });

    const pk = Math.max(0.002, 0.1 * Math.min(1.2, vel));
    const g = vg.gain;
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(pk, when + 0.008);
    g.exponentialRampToValueAtTime(MIN_GAIN, when + dur - 0.02);

    this._autoFree(head, vg);
  }

  /** Shimmering bell: sine + inharmonic partial, drenched in delay. */
  _bell(freq, when, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    if (!isFinite(freq) || freq < 60 || freq > 7000) return;
    const ctx = this.audio.ctx;
    const {
      vel = 0.5, decay = 2.4, rev = 0.5, revBig = 0.3, dly = 0.55, pan = 0,
    } = opts;
    const dur = decay + 0.1;
    let partial = true;
    if (!this._poly(when, dur, 2)) {
      if (!this._poly(when, dur, 1)) return;
      partial = false;
    }

    const vg = ctx.createGain();
    vg.gain.value = MIN_GAIN;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(9000, 5200 * (0.5 + 0.7 * this.brightness));
    filt.connect(vg);

    // fundamental plus a slightly inharmonic partial -> glassy shimmer
    const o1 = this._osc(filt, 'sine', freq, 0.7, when, when + dur);
    if (partial) {
      this._osc(filt, 'sine', freq * this._rnd(2.94, 3.06), 0.16, when, when + dur * 0.6);
    }

    let tail = vg;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan || this._rnd(-0.7, 0.7)));
      vg.connect(p); tail = p;
    }
    tail.connect(this._bus());
    this._sends(tail, { rev, revBig, dly });

    const pk = Math.max(0.0015, 0.055 * Math.min(1.2, vel));
    const g = vg.gain;
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(pk, when + 0.005);
    g.exponentialRampToValueAtTime(MIN_GAIN, when + dur - 0.02);

    this._autoFree(o1, vg);
  }
  /** Deep sub drone / pulse. Nearly dry — reverb muddies the low end. */
  _sub(freq, when, dur, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    if (!isFinite(freq) || freq < 15 || freq > 300) return;
    const ctx = this.audio.ctx;
    const { peak = 0.1, attack = Math.min(2.5, dur * 0.35), rev = 0, revBig = 0.08 } = opts;
    const total = dur + 0.4;
    if (!this._poly(when, total, 1, 'sub')) return;

    const vg = ctx.createGain();
    vg.gain.value = MIN_GAIN;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 130;
    filt.Q.value = 0.6;
    filt.connect(vg);

    const o1 = this._osc(filt, 'sine', freq, 1, when, when + total);
    // a faint octave above makes the sub audible on small speakers — if it fits
    if (this._poly(when, total, 1, 'sub')) {
      this._osc(filt, 'triangle', freq * 2, 0.16, when, when + total, this._rnd(-6, 6));
    }

    vg.connect(this._bus());
    this._sends(vg, { rev, revBig });

    const g = vg.gain;
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(Math.max(0.002, peak), when + Math.max(0.05, attack));
    g.exponentialRampToValueAtTime(MIN_GAIN, when + total);

    this._autoFree(o1, vg);
  }

  /** Tape-ish noise swell: looped noise through a slowly sweeping filter. */
  _noiseSwell(when, dur, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    const {
      brown = true, peak = 0.03, f0 = 240, f1 = 1400, q = 1.2,
      type = 'bandpass', rev = 0.5, revBig = 0.5, pan = 0,
    } = opts;

    const buf = this.audio.noiseBuffer(3, brown);
    if (!buf || !this._poly(when, dur + 0.1, 1, 'noise')) return;
    const src = this._track(ctx.createBufferSource());
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = this._rnd(0.85, 1.1);

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(40, f0), when);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur * 0.7);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f0 * 0.8), when + dur);

    const vg = ctx.createGain();
    vg.gain.value = MIN_GAIN;
    src.connect(filt); filt.connect(vg);

    let tail = vg;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan || this._rnd(-0.6, 0.6)));
      vg.connect(p); tail = p;
    }
    tail.connect(this._bus());
    this._sends(tail, { rev, revBig });

    const pk = Math.max(0.001, peak * (0.6 + 0.5 * this.intensity));
    const g = vg.gain;
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(pk, when + dur * 0.45);
    g.exponentialRampToValueAtTime(MIN_GAIN, when + dur);

    src.start(when);
    src.stop(when + dur + 0.05);
    this._autoFree(src, vg);
  }

  /** Filtered-noise riser plus a pitch sweep: tension / warp transitions. */
  _riser(when, dur, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    const { peak = 0.05, tone = true } = opts;
    const k = this._key();

    this._noiseSwell(when, dur, {
      brown: false, peak: peak * 0.8, f0: 300, f1: 6200, q: 3.2,
      type: 'bandpass', rev: 0.4, revBig: 0.45,
    });

    if (!tone || !this._poly(when, dur + 0.3, 1)) return;
    const vg = ctx.createGain();
    vg.gain.value = MIN_GAIN;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(320, when);
    filt.frequency.exponentialRampToValueAtTime(5200, when + dur);
    filt.Q.value = 2.5;
    filt.connect(vg);

    const osc = this._track(ctx.createOscillator());
    osc.type = 'sawtooth';
    const fA = this._mf(k.root);
    osc.frequency.setValueAtTime(fA, when);
    osc.frequency.exponentialRampToValueAtTime(fA * 4, when + dur);
    osc.connect(filt);
    osc.start(when); osc.stop(when + dur + 0.25);

    vg.connect(this._bus());
    this._sends(vg, { rev: 0.35, revBig: 0.3 });

    const g = vg.gain;
    g.setValueAtTime(MIN_GAIN, when);
    g.linearRampToValueAtTime(Math.max(0.002, peak * 0.55), when + dur * 0.92);
    g.exponentialRampToValueAtTime(MIN_GAIN, when + dur + 0.22);

    this._autoFree(osc, vg);
  }

  /** Pulsing low 16th-note ostinato (square through a lowpass) — 'danger'. */
  _ostinato(rootMidi, when, stepDur, steps, opts = {}) {
    if (!this.audio.enabled || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    const {
      pattern = [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
      pitches = [0, 0, 0, 3, 0, 0, -2, 0], peak = 0.05, cutoff = 620,
    } = opts;

    for (let i = 0; i < steps; i++) {
      if (!pattern[i % pattern.length]) continue;
      const t = when + i * stepDur;
      const accent = (i % 4 === 0) ? 1.25 : (i % 2 === 0 ? 1 : 0.78);
      const dur = stepDur * this._rnd(0.7, 0.95);
      if (!this._poly(t, dur + 0.05, 1)) continue;

      const midi = rootMidi + (pitches[i % pitches.length] || 0);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      const open = Math.min(4000,
        cutoff * accent * (0.7 + 0.7 * this.brightness) + 260 * this.tension);
      filt.frequency.setValueAtTime(open, t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.55), t + dur);
      filt.Q.value = 3.6;

      const vg = ctx.createGain();
      vg.gain.value = MIN_GAIN;
      filt.connect(vg);
      vg.connect(this._bus());
      const osc = this._osc(filt, 'square', this._mf(midi), 1,
        t, t + dur + 0.02, this._rnd(-4, 4));
      this._sends(vg, { rev: 0.12, dly: (i % 4 === 2) ? 0.18 : 0 });

      const pk = Math.max(0.002, peak * accent * (0.7 + 0.4 * this.intensity));
      const g = vg.gain;
      g.setValueAtTime(MIN_GAIN, t);
      g.linearRampToValueAtTime(pk, t + 0.006);
      g.exponentialRampToValueAtTime(MIN_GAIN, t + dur);

      this._autoFree(osc, vg);
    }
  }
  /* =====================================================================
   *  GENERATORS — one small closure per musical layer, per mode.
   *  Each run(when) schedules its events and returns seconds until the next.
   * ===================================================================== */

  _buildGenerators(mode, bus, now) {
    const G = (name, offset, run) => ({ name: name, next: now + offset, run: run });
    const soon = () => this._rnd(0.2, 1.2);

    switch (mode) {
      /* ---------------- TITLE: the game's theme ---------------- */
      case 'title': return [
        G('form', 0.4, (t) => this._genTitleForm(t)),
        G('swell', 6, (t) => {
          this._noiseSwell(t, this._rnd(9, 15), {
            peak: 0.024, f0: 180, f1: 900, revBig: 0.6,
          });
          return this._rnd(26, 44);
        }),
      ];

      /* ---------------- SURFACE: Style B melody over Style A pads --------- */
      case 'surface': return [
        G('pad', soon(), (t) => this._genPad(t, {
          style: () => this._pick(['triad', 'ninth', 'seventh', 'open']),
          len: [9, 22], attack: [3.5, 7.5], release: [4.5, 7],
          cutoff: [560, 1150], peak: 0.046, detune: [5, 10], octave: 1,
        })),
        G('melody', this._rnd(3, 7), (t) => this._genSurfaceMelody(t)),
        G('bells', this._rnd(12, 26), (t) => this._genBellArp(t, {})),
        G('sub', 1.2, (t) => {
          const dur = this._rnd(16, 24);
          this._sub(this._mf(this._deg(0) - 24), t, dur, {
            peak: 0.085, attack: this._rnd(5, 8),
          });
          return dur + this._rnd(0.2, 1.5);
        }),
        G('air', this._rnd(10, 26), (t) => {
          this._noiseSwell(t, this._rnd(6, 12), { peak: 0.02, f0: 320, f1: 2100 });
          return this._rnd(22, 48);
        }),
      ];

      /* ---------------- SPACE: pure Style A, vast and cold ---------------- */
      case 'space': return [
        G('pad', soon(), (t) => this._genPad(t, {
          style: () => this._pick(['quartal', 'open', 'ninth']),
          len: [13, 24], attack: [5, 8], release: [6, 9],
          cutoff: [380, 760], peak: 0.05, detune: [8, 14], octave: 1,
          rev: 0.4, revBig: 0.62, lfoRate: [0.012, 0.035],
        })),
        G('subpulse', 1.0, (t) => {
          const per = this._rnd(3.6, 4.6);            // slow sub pulse every ~4 s
          const f = this._mf(this._deg(0) - 24) * (this._chance(0.2) ? 1.5 : 1);
          this._sub(f, t, per * 0.82, { peak: 0.095, attack: per * 0.3 });
          return per;
        }),
        G('bells', this._rnd(20, 40), (t) => this._genBellArp(t, { high: true, sparse: true })),
        G('air', this._rnd(14, 30), (t) => {
          this._noiseSwell(t, this._rnd(9, 16), {
            peak: 0.022, f0: 200, f1: 1200, revBig: 0.65,
          });
          return this._rnd(28, 58);
        }),
      ];

      /* ---------------- CAVE: very dark, no pads ---------------- */
      case 'cave': return [
        G('drone', 0.5, (t) => {
          const dur = this._rnd(14, 22);
          const k = this._key();
          this._pad([this._mf(k.root - 12), this._mf(k.root - 12 + 7)], t, dur, {
            type: 'sawtooth', peak: 0.04, attack: this._rnd(5, 8), release: 8,
            cutoff: 190, q: 2.2, detune: 11, rev: 0.3, revBig: 0.55,
            lfoRate: 0.014, lfoDepth: 70, layers: 1,
          });
          this._sub(this._mf(k.root - 24), t, dur * 0.9, { peak: 0.08, attack: 5 });
          return dur - this._rnd(1, 4);
        }),
        G('noise', this._rnd(2, 6), (t) => {
          this._noiseSwell(t, this._rnd(7, 14), {
            brown: true, peak: 0.03, f0: 120, f1: this._rnd(420, 780),
            q: 1.6, rev: 0.5, revBig: 0.5,
          });
          return this._rnd(9, 18);
        }),
        G('drips', this._rnd(6, 14), (t) => {
          // rare dissonant piano notes with long reverb, left hanging
          const midi = this._deg(this._pick([0, 1, 3, 4, 6])) + 12 * this._pick([0, 1]);
          this._piano(this._mf(midi), t, {
            vel: this._rnd(0.22, 0.45), decay: this._rnd(2.2, 3.4),
            cutoff: 1500, rev: 0.6, revBig: 0.55, dly: 0.2,
            pan: this._rnd(-0.6, 0.6),
          });
          if (this._chance(0.35)) {
            this._piano(this._mf(midi + 1), t + this._rnd(0.06, 0.3), {
              vel: 0.2, decay: 2.6, cutoff: 1300, rev: 0.6, revBig: 0.5,
            });
          }
          return this._rnd(8, 22) * (1.2 - 0.5 * this.intensity);
        }),
      ];

      /* ---------------- DANGER: tense and driving ---------------- */
      case 'danger': return [
        G('ostinato', 0.3, (t) => {
          const ms = this._ms;
          const bpm = ms.bpm * (1 + 0.08 * this.tension);
          const step = 60 / bpm / 4;                  // 16th notes
          const steps = 8;
          const k = this._key();
          this._ostinato(k.root - 12, t, step, steps, {
            peak: 0.05 + 0.015 * this.intensity,
            cutoff: 520 + 260 * this.intensity,
            pitches: (ms.bar % 4 === 3)
              ? [0, 0, 1, 0, 3, 0, 1, 0] : [0, 0, 0, 3, 0, 0, -2, 0],
          });
          if (ms.bar % 4 === 0) {
            this._sub(this._mf(k.root - 24), t, step * steps * 0.9,
              { peak: 0.1, attack: 0.02 });
          }
          ms.bar++;
          return step * steps;
        }),
        G('cluster', 1.4, (t) => {
          const k = this._key();
          const dur = this._rnd(4, 8);
          const base = k.root + 12;
          const freqs = [base, base + 1, base + 6, base + 13].map((m) => this._mf(m));
          this._pad(freqs, t, dur, {
            type: 'sawtooth', peak: 0.03, attack: this._rnd(1.2, 2.6), release: 3,
            cutoff: 460 + 280 * this.intensity, q: 1.4, detune: 12,
            rev: 0.4, revBig: 0.25, lfoRate: 0.08, lfoDepth: 220, layers: 1,
          });
          return dur + this._rnd(1.5, 4);
        }),
        G('riser', this._rnd(5, 10), (t) => {
          this._riser(t, this._rnd(2.4, 4.2), { peak: 0.05 + 0.02 * this.tension });
          return this._rnd(9, 17) * (1.15 - 0.4 * this.intensity);
        }),
      ];

      /* ---------------- WARP: accelerating ascent ---------------- */
      case 'warp': return [
        G('gesture', 0.5, (t) => this._genWarpGesture(t)),
      ];

      /* ---------------- STATION: calm safe harbour ---------------- */
      case 'station': return [
        G('pad', soon(), (t) => this._genPad(t, {
          style: () => this._pick(['seventh', 'ninth', 'triad']),
          len: [10, 18], attack: [3, 6], release: [4, 7],
          cutoff: [900, 1700], peak: 0.042, detune: [3, 6], octave: 1,
          type: 'triangle', rev: 0.42, revBig: 0.2, lfoRate: [0.03, 0.07],
        })),
        G('bells', this._rnd(2, 6), (t) => {
          const deg = this._pick([0, 2, 4, 6, 7, 9]);
          this._bell(this._mf(this._deg(deg) + 24), t, {
            vel: this._rnd(0.3, 0.55), decay: this._rnd(1.8, 3.2), dly: 0.45,
          });
          if (this._chance(0.4)) {
            this._bell(this._mf(this._deg(deg + 2) + 24), t + this._rnd(0.22, 0.5),
              { vel: 0.3, decay: 2.4, dly: 0.5 });
          }
          return this._rnd(5, 13) * (1.2 - 0.4 * this.intensity);
        }),
        G('hum', 1.0, (t) => {
          const dur = this._rnd(18, 26);
          const k = this._key();
          this._sub(this._mf(k.root - 12), t, dur, { peak: 0.05, attack: 6 });
          this._noiseSwell(t, dur, {
            brown: false, peak: 0.012, f0: 620, f1: 900, q: 4,
            type: 'bandpass', rev: 0.25, revBig: 0.15,
          });
          return dur - this._rnd(1, 3);
        }),
      ];

      case 'silence':
      default:
        return [];
    }
  }
  /* ------------------------- generator bodies ------------------------- */

  /** Shared Style A pad walker: one chord per call; returns its length. */
  _genPad(when, cfg) {
    const deg = this._nextDegree();
    const len = this._rnd(cfg.len[0], cfg.len[1]);
    const style = typeof cfg.style === 'function' ? cfg.style() : (cfg.style || 'triad');
    const freqs = this._voicing(deg, style, cfg.octave != null ? cfg.octave : 1);

    // occasional high sparkle layer for width
    if (this._chance(0.3 + 0.3 * this.intensity)) {
      freqs.push(this._mf(this._deg(deg + 4) + 24));
    }

    const lfoRate = cfg.lfoRate
      ? this._rnd(cfg.lfoRate[0], cfg.lfoRate[1]) : this._rnd(0.02, 0.06);

    this._pad(freqs, when, len, {
      type: cfg.type || 'sawtooth',
      peak: cfg.peak * (0.8 + 0.35 * this.intensity),
      attack: this._rnd(cfg.attack[0], cfg.attack[1]),
      release: this._rnd(cfg.release[0], cfg.release[1]),
      cutoff: this._rnd(cfg.cutoff[0], cfg.cutoff[1]),
      detune: cfg.detune ? this._rnd(cfg.detune[0], cfg.detune[1]) : 7,
      rev: cfg.rev != null ? cfg.rev : 0.55,
      revBig: cfg.revBig != null ? cfg.revBig : 0.4,
      lfoRate: lfoRate,
      lfoDepth: this._rnd(220, 520),
      pan: this._rnd(-0.35, 0.35),
      layers: 2,
    });

    // shadow the chord root in the deep sub now and then
    if (this._chance(0.2)) {
      this._sub(this._mf(this._deg(deg) - 24), when + this._rnd(0, 1.5),
        len * 0.8, { peak: 0.06, attack: 4 });
    }
    return len * this._rnd(0.9, 1.05);
  }

  /**
   * Style B melody: sparse pentatonic phrases, humanised timing, notes
   * sometimes left hanging over the pads. Returns time to the next note.
   */
  _genSurfaceMelody(when) {
    const ms = this._ms;
    const k = this._key();
    const bright = (k.scale === 'lydian' || k.scale === 'ionian' || k.scale === 'mixo');
    const pentaKey = { root: k.root, scale: bright ? 'pentaMaj' : 'pentaMin' };

    if (!ms.phrase || ms.phraseIdx >= ms.phrase.length) {
      // build a new phrase: 3-6 notes, gentle contour, wide spacing
      const n = 3 + Math.floor(this._rng() * 4);
      let d = this._pick([0, 2, 4, -1, 5]);
      const ph = [];
      for (let i = 0; i < n; i++) {
        ph.push(d);
        d += this._pick([-2, -1, -1, 1, 1, 2, 3]);
        if (d > 9) d -= 5;
        if (d < -3) d += 5;
      }
      ms.phrase = ph;
      ms.phraseIdx = 0;
      ms.rest = this._rnd(3.5, 8) * (1.3 - 0.6 * this.intensity);
    }

    const deg = ms.phrase[ms.phraseIdx++];
    const oct = this._pick([1, 1, 2, 2, 2]);
    const midi = this._deg(deg, pentaKey) + 12 * oct;
    const humanise = this._rnd(-0.045, 0.055);   // slightly out of time

    this._piano(this._mf(midi), Math.max(when + 0.005, when + humanise), {
      vel: this._rnd(0.4, 0.85),
      decay: this._rnd(1.2, 2.5),
      cutoff: this._rnd(2000, 2900),
      rev: 0.34, revBig: 0.16,
      dly: this._chance(0.4) ? 0.16 : 0.06,
      pan: this._rnd(-0.5, 0.5),
    });

    // sometimes a soft harmony note below, a touch late
    if (this._chance(0.22)) {
      this._piano(this._mf(this._deg(deg - 2, pentaKey) + 12 * oct),
        when + this._rnd(0.03, 0.13), {
          vel: 0.3, decay: 2.0, cutoff: 1900, rev: 0.3, pan: this._rnd(-0.4, 0.4),
        });
    }

    if (ms.phraseIdx >= ms.phrase.length) return ms.rest;
    return this._rnd(0.5, 2.2) * (1.25 - 0.5 * this.intensity);
  }

  /** Shimmering high bell arpeggio, drenched in delay. */
  _genBellArp(when, opts) {
    const o = opts || {};
    const n = o.sparse ? 3 + Math.floor(this._rng() * 2) : 3 + Math.floor(this._rng() * 3);
    const gap = this._rnd(0.3, 0.46);
    const up = this._chance(0.7);
    const baseDeg = this._pick([0, 2, 4, 5]);
    const oct = o.high ? 3 : this._pick([2, 3]);
    for (let i = 0; i < n; i++) {
      const step = up ? i * 2 : (n - 1 - i) * 2;
      const midi = this._deg(baseDeg + step) + 12 * oct;
      this._bell(this._mf(midi), when + i * gap * this._rnd(0.92, 1.08), {
        vel: this._rnd(0.25, 0.5) * (0.7 + 0.4 * this.brightness),
        decay: this._rnd(1.1, 2.1),
        dly: 0.6, rev: 0.45, revBig: 0.35,
        pan: this._rnd(-0.8, 0.8),
      });
    }
    const base = o.sparse ? this._rnd(22, 46) : this._rnd(14, 34);
    return base * (1.3 - 0.6 * this.intensity);
  }

  /** WARP: accelerating rising arpeggio over a massive sub, then a bright pad. */
  _genWarpGesture(when) {
    const k = this._key();
    const notes = 18 + Math.floor(this._rng() * 7);
    let t = when;
    let gap = 0.19;
    for (let i = 0; i < notes; i++) {
      const midi = this._deg(i * (this._chance(0.5) ? 1 : 2)) + 12;
      if (i % 3 === 0 || i > notes * 0.6) {
        this._bell(this._mf(midi), t, {
          vel: 0.2 + 0.3 * (i / notes), decay: this._rnd(0.9, 2.0),
          dly: 0.6, rev: 0.4, revBig: 0.3,
          pan: (i % 2 ? 1 : -1) * this._rnd(0.3, 0.8),
        });
      } else {
        this._piano(this._mf(midi), t, {
          vel: 0.28 + 0.3 * (i / notes), decay: 1.1, cutoff: 3200,
          rev: 0.3, dly: 0.35, sparkle: false,
        });
      }
      t += gap;
      gap *= 0.94;                              // accelerando
      if (gap < 0.045) gap = 0.045;
    }
    const span = t - when;

    this._sub(this._mf(k.root - 24), when, span + 1.6, { peak: 0.12, attack: span * 0.6 });
    this._riser(when + span * 0.35, Math.max(1.5, span * 0.62), { peak: 0.055 });

    // resolution: bright, wide pad
    const res = when + span + 0.05;
    this._pad(this._voicing(0, 'ninth', 2), res, this._rnd(5, 9), {
      type: 'sawtooth', peak: 0.05, attack: 0.5, release: 7,
      cutoff: 2600, q: 0.6, detune: 9, rev: 0.5, revBig: 0.5,
      lfoRate: 0.05, lfoDepth: 700, layers: 2,
    });
    this._sub(this._mf(k.root - 12), res, 6, { peak: 0.07, attack: 0.3 });

    return span + this._rnd(6, 10);
  }

  /**
   * TITLE form: low swell -> 6-8 note minor motif -> pad answer ->
   * transposed motif variation -> big swell. One section per call.
   */
  _genTitleForm(when) {
    const ms = this._ms;
    const k = this._key();
    const step = ms.formStep % 5;
    ms.formStep++;

    switch (step) {
      case 0: {
        // awe: big low swell with the tonic pad opening up
        this._sub(this._mf(k.root - 24), when, 12, { peak: 0.11, attack: 6 });
        this._pad(this._voicing(0, 'open', 1), when + 0.2, 8, {
          peak: 0.045, attack: 6.5, release: 6, cutoff: 620, detune: 9,
          rev: 0.55, revBig: 0.55, lfoRate: 0.02, lfoDepth: 300,
        });
        this._noiseSwell(when + 1, 10, { peak: 0.022, f0: 200, f1: 1100, revBig: 0.6 });
        return this._rnd(9, 12);
      }
      case 1:
      case 3: {
        // the theme: the motif on the piano voice, deliberate and wide
        const trans = step === 3 ? this._pick([3, 4, -2]) : 0;
        const degs = this.motif.degrees;
        const rhy = this.motif.rhythm;
        let t = when;
        for (let i = 0; i < degs.length; i++) {
          const midi = this._deg(degs[i] + trans) + 12 * (this._chance(0.25) ? 2 : 1);
          this._piano(this._mf(midi), t + this._rnd(-0.03, 0.04), {
            vel: i === 0 ? 0.85 : this._rnd(0.5, 0.8),
            decay: this._rnd(1.8, 2.5), cutoff: 2600,
            rev: 0.42, revBig: 0.25, dly: 0.14, pan: this._rnd(-0.3, 0.3),
          });
          t += rhy[i % rhy.length] * this._rnd(0.95, 1.06);
        }
        // pads shadow the motif
        this._pad(this._voicing(trans, 'triad', 1), when, (t - when) * 0.8, {
          peak: 0.032, attack: 3.5, release: 6, cutoff: 700, detune: 7,
          rev: 0.5, revBig: 0.45, layers: 1,
        });
        return (t - when) + this._rnd(1.2, 2.6);
      }
      case 2: {
        // the pads answer, with a shimmer of bells
        const deg = this._nextDegree();
        const len = this._rnd(8, 12);
        this._pad(this._voicing(deg, 'ninth', 1), when, len, {
          peak: 0.05, attack: this._rnd(4, 7), release: 6,
          cutoff: this._rnd(700, 1200), detune: 10,
          rev: 0.55, revBig: 0.5, lfoRate: 0.028, lfoDepth: 420,
        });
        this._sub(this._mf(this._deg(deg) - 24), when + 0.5, len * 0.8,
          { peak: 0.075, attack: 4 });
        if (this._chance(0.75)) this._genBellArp(when + this._rnd(2, 5), { high: true });
        return len * 0.85;
      }
      default: {
        // resolution back to the tonic over a big low swell
        this._pad(this._voicing(0, 'seventh', 1), when, this._rnd(9, 14), {
          peak: 0.05, attack: 7, release: 8, cutoff: 560, detune: 12,
          rev: 0.6, revBig: 0.6, lfoRate: 0.016, lfoDepth: 260,
        });
        this._sub(this._mf(k.root - 24), when, 14, { peak: 0.115, attack: 7 });
        this._noiseSwell(when + 2, 12, { peak: 0.026, f0: 160, f1: 800, revBig: 0.65 });
        if (this._chance(0.5)) {
          this.motif = { degrees: this._pick(MOTIFS), rhythm: this._pick(RHYTHMS) };
        }
        return this._rnd(12, 16);
      }
    }
  }
}

export default MusicDirector;
