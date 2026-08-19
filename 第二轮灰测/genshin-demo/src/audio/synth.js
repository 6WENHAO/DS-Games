// ============================================================================
// Procedural WebAudio synthesis primitives - no audio files, everything is
// generated from oscillators / noise buffers / generated impulse responses.
//
// Every function takes the AudioContext explicitly, so the exact same code can
// be rendered by an OfflineAudioContext for automated self-tests.
// ============================================================================
import { clamp, makeRNG } from '../core/utils.js';

export const EPS = 1e-4;

/** MIDI note -> Hz. */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** Hz -> MIDI note. */
export const ftom = (f) => 69 + 12 * Math.log2(Math.max(1e-6, f) / 440);

// ---------------------------------------------------------------------------
// Per-context cache (waves / noise buffers / impulse responses). WeakMap so an
// offline context used by a self-test is fully collectable afterwards.
// ---------------------------------------------------------------------------
const _store = new WeakMap();
function store(ac) {
  let s = _store.get(ac);
  if (!s) { s = { waves: new Map(), noise: new Map(), ir: new Map(), curve: new Map() }; _store.set(ac, s); }
  return s;
}

/** Additive harmonic recipes -> PeriodicWave. Index 0 is DC and must stay 0. */
const WAVES = {
  piano:    [0, 1, 0.46, 0.28, 0.16, 0.10, 0.065, 0.042, 0.028, 0.018, 0.011],
  harp:     [0, 1, 0.30, 0.19, 0.095, 0.055, 0.032, 0.020, 0.012],
  pluck:    [0, 1, 0.56, 0.36, 0.24, 0.16, 0.11, 0.072, 0.048, 0.030],
  strings:  [0, 1, 0.62, 0.46, 0.34, 0.27, 0.20, 0.15, 0.11, 0.082, 0.058, 0.041, 0.029, 0.020],
  choir:    [0, 1, 0.52, 0.30, 0.47, 0.20, 0.11, 0.145, 0.072, 0.048, 0.034, 0.022],
  brass:    [0, 1, 0.74, 0.57, 0.44, 0.33, 0.245, 0.175, 0.125, 0.088, 0.061, 0.042],
  clarinet: [0, 1, 0.05, 0.62, 0.045, 0.38, 0.03, 0.20, 0.022, 0.115, 0.015],
  organ:    [0, 1, 0.33, 0.56, 0.19, 0.35, 0.105, 0.21, 0.075, 0.105, 0.05],
  flute:    [0, 1, 0.145, 0.072, 0.036, 0.021, 0.013, 0.008],
  bell:     [0, 1, 0.0, 0.56, 0.0, 0.29, 0.145, 0.0, 0.095, 0.0, 0.05],
  reed:     [0, 1, 0.42, 0.55, 0.28, 0.36, 0.18, 0.22, 0.12, 0.14, 0.08],
};
export const WAVE_NAMES = Object.keys(WAVES);

export function getWave(ac, name) {
  const h = WAVES[name];
  if (!h) return null;
  const s = store(ac);
  let w = s.waves.get(name);
  if (!w) {
    const imag = new Float32Array(h);
    const real = new Float32Array(h.length);
    w = ac.createPeriodicWave(real, imag, { disableNormalization: false });
    s.waves.set(name, w);
  }
  return w;
}

/** Accepts either a native osc type or one of WAVE_NAMES. */
export function setOscWave(ac, osc, type) {
  const t = type === 'saw' ? 'sawtooth' : (type || 'sine');
  if (WAVES[t]) { const w = getWave(ac, t); if (w) { osc.setPeriodicWave(w); return; } }
  osc.type = (t === 'sine' || t === 'square' || t === 'sawtooth' || t === 'triangle') ? t : 'sine';
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------
/** Cached, loop-friendly noise buffer. kind: white | pink | brown. */
export function noiseBuffer(ac, kind = 'white', seconds = 2) {
  const key = kind + '|' + seconds;
  const s = store(ac);
  let buf = s.noise.get(key);
  if (buf) return buf;
  const len = Math.max(64, Math.floor(ac.sampleRate * seconds));
  buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  const rng = makeRNG(0x5EED ^ len ^ (kind.length * 7919));
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.32, -1, 1);
      b6 = w * 0.115926;
    }
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) { const w = rng() * 2 - 1; last = (last + 0.022 * w) / 1.022; d[i] = clamp(last * 4.2, -1, 1); }
  } else {
    for (let i = 0; i < len; i++) d[i] = rng() * 2 - 1;
  }
  // crossfade the tail into the head so loop=true has no click
  const xf = Math.min(Math.floor(len * 0.04), Math.floor(ac.sampleRate * 0.05));
  for (let i = 0; i < xf; i++) {
    const t = i / xf, j = len - xf + i;
    d[j] = d[j] * (1 - t) + d[i] * t;
  }
  s.noise.set(key, buf);
  return buf;
}

/** Looping buffer source (ambience beds). Caller starts/stops it. */
export function loopSource(ac, buffer, rate = 1) {
  const s = ac.createBufferSource();
  s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
  return s;
}

// ---------------------------------------------------------------------------
// Reverb: noise * exponential decay + early reflections -> ConvolverNode
// ---------------------------------------------------------------------------
export function impulseResponse(ac, seconds = 2.6, decay = 2.6) {
  const key = seconds + '|' + decay;
  const s = store(ac);
  let buf = s.ir.get(key);
  if (buf) return buf;
  const rate = ac.sampleRate, len = Math.max(256, Math.floor(rate * seconds));
  buf = ac.createBuffer(2, len, rate);
  const rng = makeRNG(0x1CE1CE ^ len);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, decay);
      const w = (rng() * 2 - 1) * env;
      lp += (0.42 - 0.3 * t) * (w - lp);          // tail gets progressively darker
      d[i] = w * 0.36 + lp * 0.9;
    }
    // sparse early reflections give the tail a room shape
    const taps = [0.0091, 0.0137, 0.0212, 0.0301, 0.0437, 0.0611, 0.0833];
    for (let k = 0; k < taps.length; k++) {
      const idx = Math.floor(taps[k] * rate * (1 + c * 0.07));
      if (idx < len) d[idx] += (0.35 + rng() * 0.5) * (c ? -1 : 1) * Math.pow(0.72, k);
    }
    const fi = Math.max(1, Math.floor(rate * 0.0015));
    for (let i = 0; i < fi; i++) d[i] *= i / fi;
  }
  s.ir.set(key, buf);
  return buf;
}

export function distortionCurve(ac, amount = 6) {
  const s = store(ac);
  let c = s.curve.get(amount);
  if (c) return c;
  const n = 1024;
  c = new Float32Array(n);
  const k = Math.max(0.01, amount), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; c[i] = Math.tanh(x * k) / norm; }
  s.curve.set(amount, c);
  return c;
}

export function makeDistortion(ac, amount = 6) {
  const w = ac.createWaveShaper();
  w.curve = distortionCurve(ac, amount);
  w.oversample = '2x';
  return w;
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------
/** Classic ADSR on a gain AudioParam. Returns the absolute end time. */
export function adsr(param, t0, o = {}) {
  const peak = Math.max(EPS * 2, o.peak ?? 1);
  const a = Math.max(0.0015, o.a ?? 0.01);
  const d = Math.max(0.0015, o.d ?? 0.08);
  const sustain = clamp(o.sustain ?? 0.6, 0, 1);
  const r = Math.max(0.005, o.r ?? 0.2);
  const dur = Math.max(a + d, o.dur ?? 0.3);
  const sus = Math.max(EPS, peak * sustain);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(peak, t0 + a);
  param.exponentialRampToValueAtTime(sus, t0 + a + d);
  if (dur > a + d + 1e-4) param.setValueAtTime(sus, t0 + dur);
  param.exponentialRampToValueAtTime(EPS, t0 + dur + r);
  return t0 + dur + r;
}

/** Percussive (attack -> exponential decay to silence). Returns end time. */
export function percEnv(param, t0, peak = 0.5, decay = 0.25, attack = 0.004) {
  const p = Math.max(EPS * 2, peak);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(p, t0 + attack);
  param.exponentialRampToValueAtTime(EPS, t0 + attack + decay);
  return t0 + attack + decay;
}

/** Swell (slow in, slow out) used by wind / ambience gusts. */
export function swellEnv(param, t0, peak = 0.3, up = 0.6, hold = 0.4, down = 0.9) {
  const p = Math.max(EPS * 2, peak);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(p, t0 + up);
  param.setValueAtTime(p, t0 + up + hold);
  param.exponentialRampToValueAtTime(EPS, t0 + up + hold + down);
  return t0 + up + hold + down;
}

// ---------------------------------------------------------------------------
// Filter chain helper
// ---------------------------------------------------------------------------
function nyq(ac) { return ac.sampleRate * 0.45; }

/**
 * spec: { type, freq, freqTo, time, q, gain, lfo:{rate,depth} } or an array of them.
 * Returns the last node of the chain.
 */
export function applyFilters(ac, node, spec, t0, dur) {
  if (!spec) return node;
  const list = Array.isArray(spec) ? spec : [spec];
  let cur = node;
  const finite = Number.isFinite(dur);
  for (const s of list) {
    if (!s) continue;
    const f = ac.createBiquadFilter();
    f.type = s.type || 'lowpass';
    if (s.q !== undefined) f.Q.value = s.q;
    if (s.gain !== undefined) f.gain.value = s.gain;
    const lim = nyq(ac);
    const f0 = clamp(s.freq ?? 1200, 20, lim);
    f.frequency.setValueAtTime(f0, t0);
    if (s.freqTo) {
      const f1 = clamp(s.freqTo, 20, lim);
      const tt = t0 + (s.time ?? (finite ? dur : 1));
      f.frequency.exponentialRampToValueAtTime(f1, tt);
      if (s.freqBack) f.frequency.exponentialRampToValueAtTime(clamp(s.freqBack, 20, lim), tt + (s.backTime ?? 0.2));
    }
    if (s.lfo) {
      const l = ac.createOscillator();
      l.type = s.lfo.type || 'sine';
      l.frequency.value = s.lfo.rate ?? 0.3;
      const lg = ac.createGain();
      lg.gain.value = s.lfo.depth ?? 200;
      l.connect(lg); lg.connect(f.frequency);
      l.start(t0);
      if (finite) l.stop(t0 + dur + 0.2);
      if (s.lfo.out) s.lfo.out.push(l);
    }
    cur.connect(f); cur = f;
  }
  return cur;
}

function connectSends(ac, node, sends) {
  if (!sends) return;
  for (const s of sends) {
    if (!s || !s[0]) continue;
    const g = ac.createGain();
    g.gain.value = s[1] ?? 0.2;
    node.connect(g); g.connect(s[0]);
  }
}

// ---------------------------------------------------------------------------
// tone(): the workhorse oscillator voice
// ---------------------------------------------------------------------------
/**
 * o = {
 *   t0, dur, freq, freqTo, freqToTime, glideFrom, glideTime,
 *   type | stack:[{type,gain,mul,detune}], detune,
 *   peak, a, d, sustain, r,
 *   filter (see applyFilters), vibrato:{rate,depth,delay}, trem:{rate,depth},
 *   pan, send:[[node,gain]]
 * }
 * Returns the absolute end time of the voice.
 */
export function tone(ac, dest, o = {}) {
  const t0 = o.t0 ?? ac.currentTime;
  const dur = Math.max(0.005, o.dur ?? 0.25);
  const peak = Math.max(EPS * 2, o.peak ?? 0.3);
  const g = ac.createGain();
  g.gain.value = EPS;
  const end = adsr(g.gain, t0, { peak, a: o.a, d: o.d, sustain: o.sustain, r: o.r, dur });
  const span = end - t0;

  let out = applyFilters(ac, g, o.filter, t0, span);
  if (o.drive) { const w = makeDistortion(ac, o.drive); out.connect(w); out = w; }
  if (o.pan !== undefined && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    out.connect(p); out = p;
  }
  out.connect(dest);
  connectSends(ac, out, o.send);

  let vib = null;
  if (o.vibrato) {
    const l = ac.createOscillator();
    l.type = 'sine';
    l.frequency.value = o.vibrato.rate ?? 5.2;
    vib = ac.createGain();
    vib.gain.setValueAtTime(0, t0);
    vib.gain.linearRampToValueAtTime(o.vibrato.depth ?? 20, t0 + (o.vibrato.delay ?? 0.1) + 0.2);
    l.connect(vib);
    l.start(t0); l.stop(end + 0.02);
  }
  if (o.trem) {
    const l = ac.createOscillator();
    l.type = 'sine';
    l.frequency.value = o.trem.rate ?? 4.5;
    const tg = ac.createGain();
    tg.gain.value = (o.trem.depth ?? 0.2) * peak;
    l.connect(tg); tg.connect(g.gain);
    l.start(t0); l.stop(end + 0.02);
  }

  const stack = o.stack && o.stack.length ? o.stack : [{ type: o.type || 'sine', gain: 1 }];
  const base = Math.max(8, o.freq ?? 440);
  for (const st of stack) {
    const osc = ac.createOscillator();
    setOscWave(ac, osc, st.type || o.type || 'sine');
    const mul = st.mul ?? 1;
    const f0 = clamp(base * mul, 8, nyq(ac) * 2);
    if (o.glideFrom) {
      osc.frequency.setValueAtTime(clamp(o.glideFrom * mul, 8, nyq(ac) * 2), t0);
      osc.frequency.exponentialRampToValueAtTime(f0, t0 + (o.glideTime ?? 0.07));
    } else {
      osc.frequency.setValueAtTime(f0, t0);
    }
    if (o.freqTo) {
      osc.frequency.exponentialRampToValueAtTime(clamp(o.freqTo * mul, 8, nyq(ac) * 2),
        t0 + (o.glideFrom ? (o.glideTime ?? 0.07) : 0) + (o.freqToTime ?? span * 0.9));
    }
    osc.detune.value = (st.detune ?? 0) + (o.detune ?? 0);
    const og = ac.createGain();
    og.gain.value = st.gain ?? 1;
    osc.connect(og); og.connect(g);
    if (vib) vib.connect(osc.detune);
    osc.start(t0); osc.stop(end + 0.02);
  }
  return end;
}

// ---------------------------------------------------------------------------
// noise(): filtered noise burst / bed
// ---------------------------------------------------------------------------
/**
 * o = { t0, dur, kind, rate, peak, a, d, sustain, r, perc, filter, pan, send, loop }
 * Returns the absolute end time.
 */
export function noise(ac, dest, o = {}) {
  const t0 = o.t0 ?? ac.currentTime;
  const dur = Math.max(0.005, o.dur ?? 0.2);
  const peak = Math.max(EPS * 2, o.peak ?? 0.3);
  const g = ac.createGain();
  g.gain.value = EPS;
  const end = o.perc
    ? percEnv(g.gain, t0, peak, o.d ?? dur, o.a ?? 0.003)
    : adsr(g.gain, t0, { peak, a: o.a, d: o.d, sustain: o.sustain, r: o.r, dur });
  const span = end - t0;

  let out = applyFilters(ac, g, o.filter, t0, span);
  if (o.drive) { const w = makeDistortion(ac, o.drive); out.connect(w); out = w; }
  if (o.pan !== undefined && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    out.connect(p); out = p;
  }
  out.connect(dest);
  connectSends(ac, out, o.send);

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, o.kind || 'white', o.seconds ?? 2);
  src.loop = o.loop ?? (span > 1.6);
  src.playbackRate.value = clamp(o.rate ?? 1, 0.06, 8);
  if (o.rateTo) src.playbackRate.exponentialRampToValueAtTime(clamp(o.rateTo, 0.06, 8), t0 + span);
  src.connect(g);
  src.start(t0, (o.offset ?? 0));
  src.stop(end + 0.02);
  return end;
}

/** Low sine "boom" with pitch drop - impacts, explosions, timpani bodies. */
export function boom(ac, dest, o = {}) {
  const t0 = o.t0 ?? ac.currentTime;
  const f = o.freq ?? 110, to = o.freqTo ?? f * 0.42;
  return tone(ac, dest, {
    t0, freq: f, freqTo: to, freqToTime: o.freqToTime ?? (o.decay ?? 0.3) * 0.8,
    dur: 0.008, a: o.a ?? 0.004, d: o.decay ?? 0.3, sustain: 0.0015, r: 0.03,
    peak: o.peak ?? 0.5, type: o.type || 'sine', pan: o.pan, send: o.send,
    filter: o.filter,
  });
}

/** Metallic inharmonic cluster - metal hits, bells, crystal chimes. */
export function metal(ac, dest, o = {}) {
  const t0 = o.t0 ?? ac.currentTime;
  const f = o.freq ?? 520;
  const ratios = o.ratios || [1, 1.41, 1.93, 2.71, 3.47];
  const decay = o.decay ?? 0.5;
  let end = t0;
  for (let i = 0; i < ratios.length; i++) {
    const e = tone(ac, dest, {
      t0, freq: f * ratios[i], dur: 0.006,
      a: 0.002, d: decay * (1 - i * 0.13), sustain: 0.0015, r: 0.03,
      peak: (o.peak ?? 0.25) * Math.pow(0.62, i),
      type: o.type || 'square',
      filter: { type: 'bandpass', freq: f * ratios[i], q: o.q ?? 7 },
      pan: o.pan, send: o.send,
    });
    if (e > end) end = e;
  }
  return end;
}

// ---------------------------------------------------------------------------
// Mixer / bus graph. Shared by the live context and offline self-tests.
// ---------------------------------------------------------------------------
export function buildBusses(ac, o = {}) {
  const dest = o.destination || ac.destination;

  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -9; limiter.knee.value = 8; limiter.ratio.value = 8;
  limiter.attack.value = 0.003; limiter.release.value = 0.16;

  let analyser = null;
  if (o.analyser && ac.createAnalyser) {
    analyser = ac.createAnalyser();
    analyser.fftSize = 4096;   // ~85ms window: overlaps consecutive frames, so
                               // per-frame polling cannot miss a short transient
    analyser.smoothingTimeConstant = 0.72;
    limiter.connect(analyser);
    analyser.connect(dest);
  } else {
    limiter.connect(dest);
  }

  const master = ac.createGain();
  master.gain.value = o.master ?? 0.85;
  master.connect(limiter);

  // --- reverb send/return -------------------------------------------------
  const reverb = ac.createConvolver();
  reverb.normalize = true;
  reverb.buffer = impulseResponse(ac, o.revSeconds ?? 2.6, o.revDecay ?? 2.6);
  const revReturn = ac.createGain();
  revReturn.gain.value = o.revReturn ?? 1.15;
  const reverbIn = ac.createGain();
  reverbIn.gain.value = 1;
  reverbIn.connect(reverb); reverb.connect(revReturn); revReturn.connect(master);

  // --- feedback echo (caves, roars) --------------------------------------
  const delayIn = ac.createGain(); delayIn.gain.value = 1;
  const delay = ac.createDelay(2);
  delay.delayTime.value = o.delayTime ?? 0.34;
  const delayLP = ac.createBiquadFilter();
  delayLP.type = 'lowpass'; delayLP.frequency.value = 2400;
  const delayFB = ac.createGain(); delayFB.gain.value = o.delayFb ?? 0.36;
  const delayOut = ac.createGain(); delayOut.gain.value = 0.9;
  delayIn.connect(delay); delay.connect(delayLP); delayLP.connect(delayFB);
  delayFB.connect(delay);                       // legal cycle: goes through a DelayNode
  delayLP.connect(delayOut); delayOut.connect(master);

  // --- music bus (volume -> duck -> master) ------------------------------
  const musicVol = ac.createGain(); musicVol.gain.value = o.musicVolume ?? 0.6;
  const musicDuck = ac.createGain(); musicDuck.gain.value = 1;
  musicVol.connect(musicDuck); musicDuck.connect(master);
  const musicRev = ac.createGain(); musicRev.gain.value = o.musicWet ?? 0.17;
  musicDuck.connect(musicRev); musicRev.connect(reverbIn);

  // --- sfx bus ------------------------------------------------------------
  const sfxVol = ac.createGain(); sfxVol.gain.value = o.sfxVolume ?? 0.95;
  sfxVol.connect(master);
  const sfxRev = ac.createGain(); sfxRev.gain.value = o.sfxWet ?? 0.2;
  sfxVol.connect(sfxRev); sfxRev.connect(reverbIn);

  // --- ambience bus -------------------------------------------------------
  const ambVol = ac.createGain(); ambVol.gain.value = o.ambVolume ?? 0.5;
  ambVol.connect(master);
  const ambRev = ac.createGain(); ambRev.gain.value = o.ambWet ?? 0.1;
  ambVol.connect(ambRev); ambRev.connect(reverbIn);

  return {
    ac, dest, master, limiter, analyser,
    reverb, reverbIn, revReturn,
    delayIn, delay, delayOut,
    music: musicVol, musicDuck, musicRev,
    sfx: sfxVol, sfxRev,
    amb: ambVol, ambRev,
  };
}

/** Analyse a rendered AudioBuffer: used by the offline self-test. */
export function analyseBuffer(buf) {
  let sum = 0, peak = 0, bad = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { bad++; continue; }
      sum += v * v; n++;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
  }
  return { rms: n ? Math.sqrt(sum / n) : 0, peak, bad, samples: n };
}
