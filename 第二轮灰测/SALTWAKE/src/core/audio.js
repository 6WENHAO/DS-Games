/**
 * SALTWAKE — audio engine (1997 cult-FPS sound).
 *
 * Every sound in the game is synthesised live with the Web Audio API. There is
 * no asset loading: noise buffers and the reverb impulse response are generated
 * once at unlock() time and cached for the lifetime of the engine, then shaped
 * per-shot with filters, waveshapers, envelopes and short delays.
 *
 * Design goals, matching the game's cosmic-horror, fog-drowned port-town mood:
 *
 *   - Gunshots   — layered noise burst + a pitched-down body tone, run through a
 *                  hard-clipping waveshaper and a short feedback-delay tail. The
 *                  revolver "cracks" (a high-passed transient), the shotgun is
 *                  broader and lower, the bone cannon is a slow resonant boom.
 *   - Flesh      — band-passed noise whose filter frequency drops fast, with a
 *                  squelch envelope and a low thump underneath.
 *   - Metal      — inharmonic stacks of detuned square/triangle oscillators, each
 *                  through its own band-pass, for a metallic ring-down.
 *   - Voices     — formant-ish timbres built from 3–4 filtered sawtooth partials
 *                  with a vowel filter; "reversed" voices reverse the envelope so
 *                  they swell backwards. Chant layers use a per-instance random
 *                  base pitch so stacked layers never phase-lock.
 *   - Ambience   — slowly LFO-modulated filtered noise plus a low sine swell bed.
 *   - Music      — industrial: a low drone, an irregular/broken percussion grid
 *                  made of noise and metallic hits, and a detuned square/saw motif
 *                  in a phrygian-flavoured scale. Scheduling is lookahead-based and
 *                  driven from update(dt) against ctx.currentTime (no timers).
 *
 * The engine is written so a missing or failed AudioContext degrades to no-ops:
 * the game keeps running silently rather than throwing.
 *
 * Plain ES module — no imports, no dependencies.
 */

/** Deterministic 32-bit PRNG (mulberry32). Reproducible across sessions. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp a number into [lo, hi]. */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** MIDI note number -> frequency (Hz), A4 = 440. */
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Low phrygian-flavoured scale for the music bass line (MIDI notes). */
const BASS_SCALE = [33, 34, 36, 38, 40, 41, 43, 45, 46, 48];
/** Upper phrygian-flavoured scale for the music motif (MIDI notes). */
const LEAD_SCALE = [45, 46, 48, 50, 52, 53, 55, 57, 58, 60, 62, 64];

/**
 * Every sound key the engine supports. Frozen; the rest of the codebase may rely
 * on this array to enumerate effects.
 */
export const SOUND_NAMES = Object.freeze([
  // Weapons
  'revolver', 'revolverEmpty', 'revolverReload', 'shotgun', 'shotgunReload',
  'harpoonFire', 'harpoonHitFlesh', 'harpoonHitStone', 'flamethrower',
  'flamethrowerIgnite', 'focusCharge', 'focusRelease', 'boneCannon',
  'boneCannonWind', 'weaponSwitch', 'shellDrop',
  // Enemies
  'fishermanAlert', 'fishermanSwing', 'fishermanHurt', 'fishermanDie',
  'cultistChant', 'cultistSpit', 'cultistDie', 'crawlerSkitter', 'crawlerLunge',
  'crawlerDie', 'eyeHum', 'eyeBeam', 'eyePop', 'summonerWhisper',
  'summonerSpawn', 'summonerDie', 'scionRoar', 'scionStep', 'scionSlam',
  // Player
  'playerHurt', 'playerDie', 'playerLand', 'stepWet', 'stepStone', 'stepWood',
  'playerDrown',
  // World
  'doorOpen', 'doorClose', 'doorLocked', 'mechanismTurn', 'mechanismLock',
  'pickupAmmo', 'pickupHealth', 'pickupArmor', 'pickupKey', 'secretFound',
  'tideRush', 'distantHorn', 'distantBoom', 'reversedVoice', 'chantLayer',
  'ambientSea', 'ambientWind', 'ambientDrone', 'sanityWhisper', 'uiClick',
  'uiConfirm', 'ritualPulse', 'portalEnter',
]);

/* -------------------------------------------------------------------------- *
 *  Envelope helpers (all times in seconds, absolute against the ctx timeline).
 * -------------------------------------------------------------------------- */

/** Instant attack to `peak`, then exponential decay with time-constant `tau`. */
function punch(param, t0, peak, tau) {
  const v = Math.max(peak, 0.0001);
  param.setValueAtTime(v, t0);
  param.setTargetAtTime(0.0001, t0, Math.max(tau, 0.001));
}

/** Linear ramp up over `attack`, then exponential decay with constant `tau`. */
function swell(param, t0, peak, attack, tau) {
  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(Math.max(peak, 0.0001), t0 + Math.max(attack, 0.001));
  param.setTargetAtTime(0.0001, t0 + Math.max(attack, 0.001), Math.max(tau, 0.001));
}

/** Backwards swell: quiet -> peak over `dur`, then a hard cut (reversed feel). */
function revSwell(param, t0, peak, dur) {
  const d = Math.max(dur, 0.01);
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + d);
  param.linearRampToValueAtTime(0.0001, t0 + d + 0.01);
}

/* -------------------------------------------------------------------------- *
 *  Low-level node builders.
 *  `b` is the per-voice build context (see AudioEngine#_spawn). It carries the
 *  AudioContext, start time, PRNG, and the arrays used to track sources,
 *  rate parameters and cleanup nodes for voice accounting.
 * -------------------------------------------------------------------------- */

/** Create an oscillator with optional pitch glide, detune and gain envelope. */
function osc(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const oscN = ctx.createOscillator();
  oscN.type = o.type || 'sine';
  const freq = (o.freq ?? 440) * (b.rate ?? 1);
  oscN.frequency.setValueAtTime(freq, t);
  if (o.glide != null) {
    oscN.frequency.exponentialRampToValueAtTime(
      Math.max((o.glide * (b.rate ?? 1)), 0.01), t + (o.glideTime ?? 0.1));
  }
  oscN.detune.setValueAtTime((o.detune ?? 0) + (b.detune ?? 0), t);

  let node = oscN;
  if (o.gain != null) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    if (o.env === 'punch') punch(g.gain, t, o.gain, o.tau ?? 0.1);
    else if (o.env === 'rev') revSwell(g.gain, t, o.gain, o.dur ?? 0.2);
    else if (o.env === 'swell') swell(g.gain, t, o.gain, o.attack ?? 0.05, o.tau ?? 0.1);
    else g.gain.setValueAtTime(o.gain, t);
    oscN.connect(g);
    node = g;
    b.cleanup.push(g);
  }

  node.connect(o.dest || b.out);
  const dur = o.dur ?? 0.2;
  oscN.start(t);
  oscN.stop(t + dur + 0.05);
  b.sources.push({ node: oscN, end: t + dur + 0.05 });
  b.cleanup.push(oscN);
  if (o.trackRate) b.rateParams.push({ param: oscN.frequency, base: o.freq ?? 440 });
  return oscN;
}

/** Create a (cached) noise buffer source with optional filter/shaper/envelope. */
function noise(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const dur = o.dur ?? 0.2;
  const src = ctx.createBufferSource();
  src.buffer = e._noiseBuffer;
  src.loop = !!o.loop;
  const rate = (o.rate ?? 1) * (b.rate ?? 1);
  src.playbackRate.setValueAtTime(rate, t);
  if (o.trackRate) b.rateParams.push({ param: src.playbackRate, base: o.rate ?? 1 });

  let node = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type || 'bandpass';
    f.frequency.setValueAtTime(o.filter.freq ?? 1000, t);
    if (o.filter.q != null) f.Q.setValueAtTime(o.filter.q, t);
    if (o.filter.gain != null) f.gain.setValueAtTime(o.filter.gain, t);
    if (o.filter.glide != null) {
      f.frequency.exponentialRampToValueAtTime(
        Math.max(o.filter.glide, 1), t + (o.filter.glideTime ?? dur));
    }
    src.connect(f);
    node = f;
    b.cleanup.push(f);
  }
  if (o.shaper) {
    const ws = ctx.createWaveShaper();
    ws.curve = e._distCurves[o.shaper] || e._distCurves.crunch;
    if (o.oversample) ws.oversample = o.oversample;
    node.connect(ws);
    node = ws;
    b.cleanup.push(ws);
  }
  if (o.gain != null) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    if (o.env === 'punch') punch(g.gain, t, o.gain, o.tau ?? 0.1);
    else if (o.env === 'rev') revSwell(g.gain, t, o.gain, dur);
    else if (o.env === 'swell') swell(g.gain, t, o.gain, o.attack ?? 0.05, o.tau ?? 0.1);
    else g.gain.setValueAtTime(o.gain, t);
    node.connect(g);
    node = g;
    b.cleanup.push(g);
  }

  node.connect(o.dest || b.out);
  src.start(t);
  if (!o.loop) src.stop(t + dur + 0.05);
  b.sources.push({ node: src, end: o.loop ? Infinity : t + dur + 0.05 });
  b.cleanup.push(src);
  return src;
}

/* -------------------------------------------------------------------------- *
 *  Composite sound primitives shared by many sound keys.
 * -------------------------------------------------------------------------- */

/** Short filtered-noise click (empty gun, UI, shells, ratchets). */
function click(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 2500, t);
  f.Q.setValueAtTime(o.q ?? 3, t);
  const g = ctx.createGain();
  punch(g.gain, t, o.peak ?? 0.5, o.tau ?? 0.015);
  n.connect(f);
  f.connect(g);
  g.connect(o.dest || b.out);
  n.start(t);
  n.stop(t + 0.06);
  b.sources.push({ node: n, end: t + 0.06 });
  b.cleanup.push(n, f, g);
}

/** A run of rapid clicks (ratchet / skitter / reload). */
function ratchet(e, b, o = {}) {
  const count = o.count ?? 4;
  const span = o.span ?? 0.3;
  for (let i = 0; i < count; i++) {
    click(e, b, {
      start: (o.start ?? 0) + (span * i) / count,
      freq: o.freq ?? (2000 + b.rng() * 800),
      peak: o.peak ?? 0.32,
      tau: o.tau ?? 0.02,
    });
  }
}

/** Band-passed noise whoosh with a sweeping filter. */
function whoosh(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const dur = o.dur ?? 0.3;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);
  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  n.playbackRate.setValueAtTime((o.rate ?? 1) * (b.rate ?? 1), t);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 400, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(o.freqEnd ?? 2000, 1), t + dur);
  f.Q.setValueAtTime(o.q ?? 1, t);
  n.connect(f);
  f.connect(g);
  n.start(t);
  n.stop(t + dur + 0.05);
  b.sources.push({ node: n, end: t + dur + 0.05 });
  b.cleanup.push(n, f);
  swell(g.gain, t, o.peak ?? 0.5, o.attack ?? 0.05, o.tau ?? 0.1);
  return g;
}

/** Wet flesh squelch: dropping band-pass noise + a low thump. */
function squelch(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const dur = o.dur ?? 0.15;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);
  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  n.playbackRate.setValueAtTime((o.rate ?? 1) * (b.rate ?? 1), t);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 800, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(o.freqEnd ?? 200, 1), t + dur);
  f.Q.setValueAtTime(o.q ?? 1.2, t);
  n.connect(f);
  f.connect(g);
  n.start(t);
  n.stop(t + dur + 0.05);
  b.sources.push({ node: n, end: t + dur + 0.05 });
  b.cleanup.push(n, f);

  const th = ctx.createOscillator();
  th.type = 'sine';
  th.frequency.setValueAtTime(o.thumpFreq ?? 90, t);
  th.frequency.exponentialRampToValueAtTime(Math.max(o.thumpEnd ?? 45, 1), t + dur);
  const thg = ctx.createGain();
  thg.gain.value = o.thumpGain ?? 0.4;
  th.connect(thg);
  thg.connect(g);
  th.start(t);
  th.stop(t + dur + 0.05);
  b.sources.push({ node: th, end: t + dur + 0.05 });
  b.cleanup.push(th, thg);

  swell(g.gain, t, o.peak ?? 0.6, o.attack ?? 0.004, o.tau ?? 0.08);
  return g;
}

/** Footstep: a low tap plus a material-dependent noise layer. */
function footstep(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now;
  const th = ctx.createOscillator();
  th.type = 'sine';
  th.frequency.setValueAtTime(o.tapFreq ?? 130, t);
  th.frequency.exponentialRampToValueAtTime(Math.max(o.tapEnd ?? 55, 1), t + 0.12);
  const tg = ctx.createGain();
  punch(tg.gain, t, o.tapPeak ?? 0.5, o.tapTau ?? 0.07);
  th.connect(tg);
  tg.connect(b.out);
  th.start(t);
  th.stop(t + 0.22);
  b.sources.push({ node: th, end: t + 0.22 });
  b.cleanup.push(th, tg);

  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.noiseFreq ?? 800, t);
  f.Q.setValueAtTime(o.noiseQ ?? 1.5, t);
  const ng = ctx.createGain();
  punch(ng.gain, t, o.noisePeak ?? 0.35, o.noiseTau ?? 0.05);
  n.connect(f);
  f.connect(ng);
  ng.connect(b.out);
  n.start(t);
  n.stop(t + 0.2);
  b.sources.push({ node: n, end: t + 0.2 });
  b.cleanup.push(n, f, ng);
}

/** Warm/bright chime from sine partials (pickups). */
function chime(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const dur = o.dur ?? 0.5;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);
  const notes = o.notes || [NOTE(69)];
  const partials = o.partials || [1, 2.01];
  for (const n of notes) {
    for (const p of partials) {
      const oscN = ctx.createOscillator();
      oscN.type = o.type || 'sine';
      oscN.frequency.setValueAtTime(n * p * (b.rate ?? 1), t);
      oscN.detune.setValueAtTime((b.detune ?? 0) + (b.rng() * 2 - 1) * 3, t);
      const gi = ctx.createGain();
      gi.gain.value = o.partialGain ?? 0.25;
      oscN.connect(gi);
      gi.connect(g);
      oscN.start(t);
      oscN.stop(t + dur + 0.1);
      b.sources.push({ node: oscN, end: t + dur + 0.1 });
      b.cleanup.push(oscN, gi);
    }
  }
  punch(g.gain, t, o.peak ?? 0.4, o.tau ?? 0.25);
  return g;
}

/**
 * Formant-ish voice from filtered sawtooth partials. A few partials, each shaped
 * by its own band-pass (the "vowel"), plus an optional pitch glide and envelope.
 */
function formant(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const rate = b.rate ?? 1;
  const dur = o.dur ?? 0.4;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);
  const partials = o.partials || [1, 2, 3, 4];
  const gains = o.partialGains || [1, 0.6, 0.35, 0.2];
  const f1 = o.f1 ?? 700, f2 = o.f2 ?? 1100, f3 = o.f3 ?? 2500;
  const baseFreq = (o.freq ?? 110) * rate;
  for (let i = 0; i < partials.length; i++) {
    const p = partials[i];
    const oscN = ctx.createOscillator();
    oscN.type = o.type || 'sawtooth';
    oscN.frequency.setValueAtTime(baseFreq * p, t);
    if (o.glide != null) {
      oscN.frequency.exponentialRampToValueAtTime(
        Math.max((o.glide * p) * rate, 0.01), t + (o.glideTime ?? dur));
    }
    oscN.detune.setValueAtTime(
      (o.detune ?? 0) + (b.detune ?? 0) + (b.rng() * 2 - 1) * (o.jitter ?? 4), t);
    const fi = ctx.createBiquadFilter();
    fi.type = 'bandpass';
    fi.frequency.setValueAtTime(i === 0 ? f1 : i === 1 ? f2 : f3, t);
    fi.Q.setValueAtTime(o.filterQ ?? 6, t);
    const gi = ctx.createGain();
    gi.gain.value = gains[i] || 0.1;
    oscN.connect(fi);
    fi.connect(gi);
    gi.connect(g);
    oscN.start(t);
    oscN.stop(t + dur + 0.1);
    b.sources.push({ node: oscN, end: t + dur + 0.1 });
    b.cleanup.push(oscN, fi, gi);
  }
  if (o.env === 'punch') punch(g.gain, t, o.peak ?? 0.5, o.tau ?? 0.1);
  else if (o.env === 'rev') revSwell(g.gain, t, o.peak ?? 0.5, dur);
  else if (o.env === 'swell') swell(g.gain, t, o.peak ?? 0.5, o.attack ?? 0.05, o.tau ?? 0.1);
  else g.gain.setValueAtTime(o.peak ?? 0.5, t);
  return g;
}

/** Breathiness + faint formant partials (whispers / reversed voices). */
function whisper(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const dur = o.dur ?? 0.9;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);

  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  n.playbackRate.setValueAtTime((o.rate ?? 1) * (b.rate ?? 1), t);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1400, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(o.freqEnd ?? 800, 1), t + dur);
  f.Q.setValueAtTime(o.q ?? 4, t);
  n.connect(f);
  f.connect(g);
  n.start(t);
  n.stop(t + dur + 0.05);
  b.sources.push({ node: n, end: t + dur + 0.05 });
  b.cleanup.push(n, f);

  const parts = [[700, 0.12], [1100, 0.08], [2500, 0.05]];
  for (const [pf, pg] of parts) {
    const oscN = ctx.createOscillator();
    oscN.type = 'sine';
    oscN.frequency.setValueAtTime(pf * (b.rate ?? 1), t);
    const fi = ctx.createBiquadFilter();
    fi.type = 'bandpass';
    fi.frequency.setValueAtTime(pf, t);
    fi.Q.setValueAtTime(12, t);
    const gi = ctx.createGain();
    gi.gain.value = pg;
    oscN.connect(fi);
    fi.connect(gi);
    gi.connect(g);
    oscN.start(t);
    oscN.stop(t + dur + 0.05);
    b.sources.push({ node: oscN, end: t + dur + 0.05 });
    b.cleanup.push(oscN, fi, gi);
  }

  if (o.reverse) revSwell(g.gain, t, o.peak ?? 0.3, dur);
  else swell(g.gain, t, o.peak ?? 0.3, o.attack ?? 0.1, o.tau ?? 0.15);
  return g;
}

/** Inharmonic metallic ring: detuned square/triangle partials through band-passes. */
function metalRing(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now + (o.start ?? 0);
  const rate = b.rate ?? 1;
  const g = ctx.createGain();
  g.connect(o.dest || b.out);
  b.cleanup.push(g);
  const ratios = o.ratios || [1, 1.78, 2.32, 3.4, 5.1];
  const base = o.freq ?? 300;
  const dur = o.dur ?? 0.8;
  for (const r of ratios) {
    const oscN = ctx.createOscillator();
    oscN.type = o.type || 'square';
    const f = base * r * rate;
    oscN.frequency.setValueAtTime(f, t);
    oscN.detune.setValueAtTime(
      (o.detune ?? 0) + (b.detune ?? 0) + (b.rng() * 2 - 1) * (o.jitter ?? 3), t);
    const fi = ctx.createBiquadFilter();
    fi.type = 'bandpass';
    fi.frequency.setValueAtTime(f * (o.freqMul ?? 1), t);
    fi.Q.setValueAtTime(o.q ?? 8, t);
    const gi = ctx.createGain();
    gi.gain.value = (o.partialGain ?? 0.2) / Math.sqrt(r);
    oscN.connect(fi);
    fi.connect(gi);
    gi.connect(g);
    oscN.start(t);
    oscN.stop(t + dur + 0.1);
    b.sources.push({ node: oscN, end: t + dur + 0.1 });
    b.cleanup.push(oscN, fi, gi);
  }
  if (o.impact !== false) {
    const n = ctx.createBufferSource();
    n.buffer = e._noiseBuffer;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(o.impactFreq ?? base * 2, t);
    nf.Q.setValueAtTime(o.impactQ ?? 2, t);
    const ng = ctx.createGain();
    punch(ng.gain, t, o.impactPeak ?? 0.5, o.impactTau ?? 0.06);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(g);
    n.start(t);
    n.stop(t + 0.2);
    b.sources.push({ node: n, end: t + 0.2 });
    b.cleanup.push(n, nf, ng);
  }
  punch(g.gain, t, o.peak ?? 0.4, o.tau ?? 0.3);
  return g;
}

/** Low foghorn: two detuned saws, slow attack, gentle vibrato. */
function horn(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now;
  const dur = o.dur ?? 2.5;
  const g = ctx.createGain();
  g.connect(b.out);
  b.cleanup.push(g);
  const base = o.freq ?? 55;
  for (const det of (o.detunes ?? [-7, 8])) {
    const oscN = ctx.createOscillator();
    oscN.type = o.type || 'sawtooth';
    oscN.frequency.setValueAtTime(base * (b.rate ?? 1), t);
    oscN.detune.setValueAtTime(det + (b.detune ?? 0), t);
    const fi = ctx.createBiquadFilter();
    fi.type = 'lowpass';
    fi.frequency.setValueAtTime(o.cutoff ?? 420, t);
    fi.Q.setValueAtTime(2, t);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(o.vibrato ?? 0.55, t);
    const lfoG = ctx.createGain();
    lfoG.gain.value = o.vibratoDepth ?? 5;
    lfo.connect(lfoG);
    lfoG.connect(oscN.frequency);
    const gi = ctx.createGain();
    gi.gain.value = 0.4;
    oscN.connect(fi);
    fi.connect(gi);
    gi.connect(g);
    oscN.start(t);
    oscN.stop(t + dur + 0.1);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    b.sources.push({ node: oscN, end: t + dur + 0.1 }, { node: lfo, end: t + dur + 0.1 });
    b.cleanup.push(oscN, fi, gi, lfo, lfoG);
  }
  const peak = o.peak ?? 0.35;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.6));
  g.gain.setValueAtTime(peak, t + dur - (o.release ?? 0.5));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
}

/** A click sequence for weapon reloads. */
function reloadSeq(e, b, o = {}) {
  const span = o.span ?? 0.9;
  const count = o.count ?? 5;
  for (let i = 0; i < count; i++) {
    const tt = (span * i) / count;
    click(e, b, { start: tt, freq: 2100 + b.rng() * 900, peak: 0.3, tau: 0.014 });
    if (o.heavy && i % 2 === 0) {
      click(e, b, { start: tt + 0.05, freq: 1400, peak: 0.18, tau: 0.03 });
    }
  }
  click(e, b, { start: span + 0.02, freq: 1700, peak: 0.5, tau: 0.035 });
}

/**
 * Layered gunshot: distorted noise burst + pitched-down body + optional crack
 * transient and sub layer, finished with a short feedback-delay reverb tail.
 */
function gunshot(e, b, o = {}) {
  const ctx = b.ctx;
  const t = b.now;
  const rate = b.rate ?? 1;
  const ws = ctx.createWaveShaper();
  ws.curve = e._distCurves[o.drive] || e._distCurves.crunch;
  ws.oversample = '2x';
  const outg = ctx.createGain();
  outg.gain.value = o.outGain ?? 0.5;
  ws.connect(outg);
  outg.connect(b.out);

  // Pitched-down body thump.
  const body = ctx.createOscillator();
  body.type = o.bodyType || 'triangle';
  body.frequency.setValueAtTime((o.bodyFreq ?? 160) * rate, t);
  body.frequency.exponentialRampToValueAtTime(
    Math.max((o.bodyEnd ?? 40) * rate, 1), t + (o.bodyDur ?? 0.25));
  body.detune.setValueAtTime(b.detune ?? 0, t);
  const bodyG = ctx.createGain();
  punch(bodyG.gain, t, o.bodyPeak ?? 0.8, o.bodyTau ?? 0.12);
  body.connect(bodyG);
  bodyG.connect(ws);
  body.start(t);
  body.stop(t + (o.bodyDur ?? 0.25) + 0.1);
  b.sources.push({ node: body, end: t + (o.bodyDur ?? 0.25) + 0.1 });

  // Noise burst (the "blast").
  const n = ctx.createBufferSource();
  n.buffer = e._noiseBuffer;
  n.playbackRate.setValueAtTime((o.noiseRate ?? 1) * rate, t);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.setValueAtTime(o.filterFreq ?? 2500, t);
  nf.Q.setValueAtTime(o.filterQ ?? 0.7, t);
  nf.frequency.exponentialRampToValueAtTime(
    Math.max(o.filterEnd ?? 200, 1), t + (o.noiseDur ?? 0.2));
  const ng = ctx.createGain();
  punch(ng.gain, t, o.noisePeak ?? 0.9, o.noiseTau ?? 0.09);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(ws);
  n.start(t);
  n.stop(t + (o.noiseDur ?? 0.2) + 0.1);
  b.sources.push({ node: n, end: t + (o.noiseDur ?? 0.2) + 0.1 });

  // Crack transient (revolver).
  if (o.crack) {
    const cn = ctx.createBufferSource();
    cn.buffer = e._noiseBuffer;
    const cf = ctx.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.setValueAtTime(o.crackFreq ?? 3200, t);
    const cg = ctx.createGain();
    punch(cg.gain, t, o.crackPeak ?? 0.5, o.crackTau ?? 0.012);
    cn.connect(cf);
    cf.connect(cg);
    cg.connect(ws);
    cn.start(t);
    cn.stop(t + 0.07);
    b.sources.push({ node: cn, end: t + 0.07 });
    b.cleanup.push(cn, cf, cg);
  }

  // Sub layer (bone cannon / scion slam).
  if (o.sub) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(o.sub, t);
    sub.frequency.exponentialRampToValueAtTime(Math.max(o.sub * 0.5, 1), t + 0.6);
    const subG = ctx.createGain();
    punch(subG.gain, t, o.subPeak ?? 0.9, o.subTau ?? 0.5);
    sub.connect(subG);
    subG.connect(outg);
    sub.start(t);
    sub.stop(t + 1.2);
    b.sources.push({ node: sub, end: t + 1.2 });
    b.cleanup.push(sub, subG);
  }

  // Short feedback-delay tail.
  const dly = ctx.createDelay(0.5);
  dly.delayTime.setValueAtTime(o.delayTime ?? 0.045, t);
  const fb = ctx.createGain();
  fb.gain.setValueAtTime(o.feedback ?? 0.32, t);
  const wet = ctx.createGain();
  wet.gain.setValueAtTime(o.wet ?? 0.25, t);
  outg.connect(dly);
  dly.connect(fb);
  fb.connect(dly);
  dly.connect(wet);
  wet.connect(b.out);

  b.cleanup.push(ws, outg, body, bodyG, n, nf, ng, dly, fb, wet);
}

/* -------------------------------------------------------------------------- *
 *  One-shot sound builders, keyed by SOUND_NAMES.
 * -------------------------------------------------------------------------- */

const SOUND_BUILDERS = {
  // ---- Weapons ----
  revolver: (e, b) => gunshot(e, b, {
    crack: true, bodyFreq: 190, bodyEnd: 55, bodyType: 'triangle',
    noiseDur: 0.16, filterFreq: 3400, filterEnd: 320, filterQ: 0.7,
    noiseTau: 0.05, noisePeak: 1.0, bodyTau: 0.09, bodyPeak: 0.7,
    drive: 'hard', delayTime: 0.04, feedback: 0.32, wet: 0.28, outGain: 0.7,
  }),
  revolverEmpty: (e, b) => click(e, b, { freq: 2600, peak: 0.45, tau: 0.012 }),
  revolverReload: (e, b) => reloadSeq(e, b, {}),
  shotgun: (e, b) => gunshot(e, b, {
    crack: false, bodyFreq: 125, bodyEnd: 42, bodyType: 'sawtooth',
    noiseDur: 0.32, filterFreq: 1700, filterEnd: 150, filterQ: 0.6,
    noiseTau: 0.13, noisePeak: 1.0, bodyTau: 0.17, bodyPeak: 0.9,
    drive: 'crunch', delayTime: 0.06, feedback: 0.38, wet: 0.36, outGain: 0.75,
  }),
  shotgunReload: (e, b) => reloadSeq(e, b, { heavy: true }),
  harpoonFire: (e, b) => {
    osc(e, b, { type: 'square', freq: 420, glide: 90, glideTime: 0.25, dur: 0.3, gain: 0.4, env: 'punch', tau: 0.12 });
    whoosh(e, b, { freq: 500, freqEnd: 2400, dur: 0.25, peak: 0.4, attack: 0.02, tau: 0.08 });
    click(e, b, { start: 0.18, freq: 2600, peak: 0.35, tau: 0.02 });
  },
  harpoonHitFlesh: (e, b) => squelch(e, b, {
    freq: 900, freqEnd: 180, dur: 0.18, peak: 0.6,
    thumpFreq: 110, thumpEnd: 45, thumpGain: 0.35, tau: 0.07,
  }),
  harpoonHitStone: (e, b) => metalRing(e, b, {
    freq: 240, dur: 0.7, peak: 0.5, tau: 0.18,
    ratios: [1, 1.34, 2.02, 3.1], impactFreq: 900,
  }),
  flamethrower: (e, b) => {
    noise(e, b, { filter: { type: 'lowpass', freq: 1100, glide: 250, glideTime: 0.55, q: 0.7 }, dur: 0.6, rate: 0.65, gain: 0.5, env: 'punch', tau: 0.22 });
    osc(e, b, { type: 'sawtooth', freq: 70, glide: 40, glideTime: 0.5, dur: 0.6, gain: 0.3, env: 'punch', tau: 0.3 });
  },
  flamethrowerIgnite: (e, b) => {
    click(e, b, { freq: 2000, peak: 0.4, tau: 0.02 });
    whoosh(e, b, { freq: 300, freqEnd: 2000, dur: 0.25, peak: 0.45, attack: 0.01, tau: 0.06 });
  },
  focusCharge: (e, b) => {
    const dur = 1.6;
    osc(e, b, { type: 'sawtooth', freq: 120, glide: 700, glideTime: 1.3, dur, gain: 0.3, env: 'swell', attack: 1.0, tau: 0.4 });
    noise(e, b, { filter: { type: 'bandpass', freq: 600, glide: 2600, glideTime: 1.3, q: 2 }, dur, gain: 0.2, env: 'swell', attack: 1.0, tau: 0.4 });
  },
  focusRelease: (e, b) => {
    osc(e, b, { type: 'square', freq: 900, glide: 150, glideTime: 0.4, dur: 0.5, gain: 0.4, env: 'punch', tau: 0.12 });
    noise(e, b, { filter: { type: 'highpass', freq: 3000 }, dur: 0.35, gain: 0.3, env: 'punch', tau: 0.08 });
  },
  boneCannon: (e, b) => {
    gunshot(e, b, {
      crack: false, bodyFreq: 58, bodyEnd: 26, bodyType: 'sine',
      noiseDur: 0.95, filterFreq: 750, filterEnd: 55, filterQ: 0.5,
      noiseTau: 0.4, noisePeak: 0.8, bodyTau: 0.55, bodyPeak: 1.0,
      drive: 'fuzz', delayTime: 0.13, feedback: 0.5, wet: 0.5, outGain: 0.85, sub: 34,
    });
    metalRing(e, b, { freq: 40, dur: 1.6, peak: 0.3, tau: 0.6, ratios: [1, 1.5, 2.3], partialGain: 0.12 });
  },
  boneCannonWind: (e, b) => {
    const dur = 1.6;
    noise(e, b, { filter: { type: 'lowpass', freq: 400, glide: 120, glideTime: dur, q: 0.5 }, dur, gain: 0.4, env: 'swell', attack: 1.0, tau: 0.4 });
    osc(e, b, { type: 'sine', freq: 45, glide: 70, glideTime: dur, dur, gain: 0.35, env: 'swell', attack: 1.2, tau: 0.4 });
  },
  weaponSwitch: (e, b) => {
    click(e, b, { freq: 1800, peak: 0.4, tau: 0.02 });
    click(e, b, { start: 0.08, freq: 2400, peak: 0.3, tau: 0.02 });
  },
  shellDrop: (e, b) => {
    click(e, b, { freq: 2000, peak: 0.35, tau: 0.03 });
    click(e, b, { start: 0.09, freq: 1600, peak: 0.22, tau: 0.04 });
    click(e, b, { start: 0.18, freq: 1200, peak: 0.12, tau: 0.05 });
  },

  // ---- Enemies ----
  fishermanAlert: (e, b) => {
    formant(e, b, { freq: 120, glide: 260, glideTime: 0.35, dur: 0.5, env: 'punch', peak: 0.45, tau: 0.18, type: 'sawtooth', f1: 650, f2: 1050, f3: 2300 });
    noise(e, b, { filter: { type: 'lowpass', freq: 500, glide: 200, glideTime: 0.4, q: 1 }, dur: 0.5, gain: 0.2, env: 'punch', tau: 0.15 });
  },
  fishermanSwing: (e, b) => whoosh(e, b, { freq: 350, freqEnd: 1800, dur: 0.3, peak: 0.35, attack: 0.03, tau: 0.07 }),
  fishermanHurt: (e, b) => {
    formant(e, b, { freq: 150, glide: 80, glideTime: 0.3, dur: 0.4, env: 'punch', peak: 0.4, tau: 0.12, type: 'sawtooth', f1: 600, f2: 900, f3: 2000 });
    noise(e, b, { filter: { type: 'bandpass', freq: 400, glide: 150, glideTime: 0.3, q: 1.5 }, dur: 0.35, gain: 0.2, env: 'punch', tau: 0.1 });
  },
  fishermanDie: (e, b) => {
    formant(e, b, { freq: 180, glide: 55, glideTime: 0.9, dur: 1.1, env: 'swell', attack: 0.05, tau: 0.5, peak: 0.4, type: 'sawtooth', f1: 700, f2: 1000, f3: 2100 });
    squelch(e, b, { freq: 700, freqEnd: 150, dur: 0.7, peak: 0.3, thumpFreq: 90, thumpEnd: 40, thumpGain: 0.25, tau: 0.3 });
  },
  cultistChant: (e, b) => {
    formant(e, b, { freq: 105, glide: 160, glideTime: 0.6, dur: 1.4, env: 'swell', attack: 0.4, tau: 0.5, peak: 0.35, type: 'sawtooth', f1: 550, f2: 950, f3: 2200, jitter: 5 });
    osc(e, b, { type: 'sawtooth', freq: 52, dur: 1.4, gain: 0.15, env: 'swell', attack: 0.4, tau: 0.5 });
  },
  cultistSpit: (e, b) => {
    squelch(e, b, { freq: 1500, freqEnd: 300, dur: 0.12, peak: 0.4, thumpFreq: 400, thumpEnd: 150, thumpGain: 0.15, tau: 0.05 });
    click(e, b, { start: 0.05, freq: 3000, peak: 0.2, tau: 0.02 });
  },
  cultistDie: (e, b) => {
    formant(e, b, { freq: 220, glide: 60, glideTime: 1.2, dur: 1.4, env: 'swell', attack: 0.05, tau: 0.6, peak: 0.4, type: 'sawtooth', f1: 700, f2: 1100, f3: 2300 });
    noise(e, b, { filter: { type: 'bandpass', freq: 900, glide: 200, glideTime: 1.2, q: 1 }, dur: 1.3, gain: 0.15, env: 'swell', attack: 0.1, tau: 0.4 });
  },
  crawlerSkitter: (e, b) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      click(e, b, { start: (i / n) * 0.45, freq: 2500 + b.rng() * 2500, peak: 0.2 + b.rng() * 0.15, tau: 0.008 });
    }
  },
  crawlerLunge: (e, b) => {
    whoosh(e, b, { freq: 400, freqEnd: 2200, dur: 0.2, peak: 0.4, attack: 0.01, tau: 0.06 });
    noise(e, b, { filter: { type: 'highpass', freq: 3000 }, dur: 0.15, gain: 0.25, env: 'punch', tau: 0.05 });
    osc(e, b, { type: 'sine', freq: 150, glide: 60, glideTime: 0.15, dur: 0.25, gain: 0.35, env: 'punch', tau: 0.08 });
  },
  crawlerDie: (e, b) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      click(e, b, { start: (i / n) * 0.3, freq: 2200 - i * 200, peak: 0.25, tau: 0.01 });
    }
    squelch(e, b, { freq: 800, freqEnd: 150, dur: 0.5, peak: 0.35, thumpFreq: 100, thumpEnd: 40, thumpGain: 0.2, tau: 0.25 });
  },
  eyeHum: (e, b) => {
    const dur = 0.9;
    const g = b.ctx.createGain();
    g.connect(b.out);
    b.cleanup.push(g);
    const parts = [[220, 1], [220.7, 0.5], [331, 0.4], [442, 0.25]];
    for (const [f, p] of parts) {
      const oi = b.ctx.createOscillator();
      oi.type = 'sine';
      oi.frequency.setValueAtTime(f, b.now);
      const gi = b.ctx.createGain();
      gi.gain.value = p * 0.25;
      oi.connect(gi);
      gi.connect(g);
      oi.start(b.now);
      oi.stop(b.now + dur);
      b.sources.push({ node: oi, end: b.now + dur });
      b.cleanup.push(oi, gi);
    }
    swell(g.gain, b.now, 0.4, 0.05, 0.2);
  },
  eyeBeam: (e, b) => {
    const dur = 0.7;
    const g = b.ctx.createGain();
    g.connect(b.out);
    b.cleanup.push(g);
    const oi = b.ctx.createOscillator();
    oi.type = 'sawtooth';
    oi.frequency.setValueAtTime(250 * (b.rate ?? 1), b.now);
    oi.frequency.exponentialRampToValueAtTime(Math.max(2600 * (b.rate ?? 1), 1), b.now + dur);
    oi.detune.setValueAtTime(b.detune ?? 0, b.now);
    const f = b.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, b.now);
    f.Q.setValueAtTime(2, b.now);
    oi.connect(f);
    f.connect(g);
    oi.start(b.now);
    oi.stop(b.now + dur);
    b.sources.push({ node: oi, end: b.now + dur });
    b.cleanup.push(oi, f);
    noise(e, b, { filter: { type: 'highpass', freq: 3500 }, dur, gain: 0.15, env: 'punch', tau: 0.15, dest: g });
    swell(g.gain, b.now, 0.4, 0.01, 0.1);
  },
  eyePop: (e, b) => {
    squelch(e, b, { freq: 1200, freqEnd: 200, dur: 0.25, peak: 0.5, thumpFreq: 300, thumpEnd: 80, thumpGain: 0.25, tau: 0.1 });
    click(e, b, { start: 0.05, freq: 4000, peak: 0.3, tau: 0.02 });
  },
  summonerWhisper: (e, b) => whisper(e, b, { freq: 1500, freqEnd: 700, dur: 1.2, peak: 0.3, q: 3, reverse: true }),
  summonerSpawn: (e, b) => {
    const dur = 2.5;
    osc(e, b, { type: 'sawtooth', freq: 40, glide: 120, glideTime: dur, dur, gain: 0.35, env: 'swell', attack: 1.4, tau: 0.7 });
    noise(e, b, { filter: { type: 'lowpass', freq: 300, glide: 900, glideTime: dur, q: 1 }, dur, gain: 0.25, env: 'swell', attack: 1.4, tau: 0.7 });
    metalRing(e, b, { freq: 90, dur: 2.2, peak: 0.3, tau: 0.9, ratios: [1, 1.98, 3.4], partialGain: 0.1, start: 0.6 });
    formant(e, b, { freq: 70, glide: 40, glideTime: dur, dur, env: 'rev', peak: 0.15, type: 'sawtooth', f1: 500, f2: 800, f3: 1800 });
  },
  summonerDie: (e, b) => {
    osc(e, b, { type: 'sine', freq: 90, glide: 25, glideTime: 1.4, dur: 1.6, gain: 0.5, env: 'swell', attack: 0.1, tau: 0.7 });
    noise(e, b, { filter: { type: 'lowpass', freq: 500, glide: 80, glideTime: 1.4, q: 1 }, dur: 1.5, gain: 0.3, env: 'swell', attack: 0.1, tau: 0.7 });
    whisper(e, b, { freq: 1200, freqEnd: 600, dur: 1.2, peak: 0.25, q: 3, reverse: true });
  },
  scionRoar: (e, b) => {
    const dur = 2.8;
    const g = b.ctx.createGain();
    g.connect(b.out);
    b.cleanup.push(g);
    osc(e, b, { type: 'sawtooth', freq: 60, glide: 28, glideTime: dur, dur, gain: 0.5, env: 'swell', attack: 0.3, tau: 1.0, dest: g });
    osc(e, b, { type: 'sine', freq: 34, glide: 20, glideTime: dur, dur, gain: 0.6, env: 'swell', attack: 0.2, tau: 1.2, dest: g });
    noise(e, b, { filter: { type: 'bandpass', freq: 500, glide: 150, glideTime: dur, q: 0.8 }, dur, gain: 0.4, env: 'swell', attack: 0.25, tau: 0.9, dest: g, shaper: 'fuzz' });
    noise(e, b, { filter: { type: 'lowpass', freq: 300, glide: 80, glideTime: dur, q: 0.6 }, dur, gain: 0.4, env: 'swell', attack: 0.3, tau: 1.1, dest: g });
    swell(g.gain, b.now, 0.7, 0.2, 1.0);
  },
  scionStep: (e, b) => {
    osc(e, b, { type: 'sine', freq: 80, glide: 30, glideTime: 0.5, dur: 0.7, gain: 0.6, env: 'punch', tau: 0.25 });
    noise(e, b, { filter: { type: 'lowpass', freq: 250, glide: 60, glideTime: 0.5, q: 0.7 }, dur: 0.6, gain: 0.4, env: 'punch', tau: 0.2 });
  },
  scionSlam: (e, b) => {
    gunshot(e, b, {
      crack: false, bodyFreq: 45, bodyEnd: 20, bodyType: 'sine',
      noiseDur: 1.2, filterFreq: 500, filterEnd: 45, filterQ: 0.5,
      noiseTau: 0.5, noisePeak: 0.9, bodyTau: 0.7, bodyPeak: 1.0,
      drive: 'fuzz', delayTime: 0.16, feedback: 0.55, wet: 0.55, outGain: 0.9, sub: 26,
    });
    metalRing(e, b, { freq: 60, dur: 2.0, peak: 0.25, tau: 0.8, ratios: [1, 1.6, 2.4] });
  },

  // ---- Player ----
  playerHurt: (e, b) => {
    formant(e, b, { freq: 160, glide: 90, glideTime: 0.25, dur: 0.4, env: 'punch', peak: 0.4, tau: 0.12, type: 'sawtooth', f1: 550, f2: 900, f3: 2000 });
    osc(e, b, { type: 'sine', freq: 110, glide: 50, glideTime: 0.2, dur: 0.3, gain: 0.4, env: 'punch', tau: 0.12 });
  },
  playerDie: (e, b) => {
    const dur = 2.2;
    formant(e, b, { freq: 140, glide: 40, glideTime: dur, dur, env: 'swell', attack: 0.1, tau: 1.0, peak: 0.4, type: 'sawtooth', f1: 600, f2: 900, f3: 1900 });
    noise(e, b, { filter: { type: 'lowpass', freq: 400, glide: 80, glideTime: dur, q: 1 }, dur, gain: 0.25, env: 'swell', attack: 0.2, tau: 0.8 });
    osc(e, b, { type: 'sine', freq: 60, dur: 0.25, gain: 0.4, env: 'punch', tau: 0.1, start: 0.4 });
    osc(e, b, { type: 'sine', freq: 60, dur: 0.25, gain: 0.4, env: 'punch', tau: 0.1, start: 0.7 });
  },
  playerLand: (e, b) => {
    osc(e, b, { type: 'sine', freq: 100, glide: 35, glideTime: 0.2, dur: 0.35, gain: 0.6, env: 'punch', tau: 0.12 });
    noise(e, b, { filter: { type: 'lowpass', freq: 300, glide: 80, glideTime: 0.25, q: 0.7 }, dur: 0.3, gain: 0.4, env: 'punch', tau: 0.1 });
  },
  stepWet: (e, b) => squelch(e, b, { freq: 700, freqEnd: 200, dur: 0.12, peak: 0.3, thumpFreq: 90, thumpEnd: 50, thumpGain: 0.2, tau: 0.05 }),
  stepStone: (e, b) => footstep(e, b, { tapFreq: 150, tapEnd: 60, tapPeak: 0.35, noiseFreq: 1100, noiseQ: 1.5, noisePeak: 0.2, noiseTau: 0.04 }),
  stepWood: (e, b) => footstep(e, b, { tapFreq: 220, tapEnd: 80, tapPeak: 0.3, noiseFreq: 450, noiseQ: 2, noisePeak: 0.25, noiseTau: 0.06 }),
  playerDrown: (e, b) => {
    const dur = 2.4;
    for (let i = 0; i < 10; i++) {
      osc(e, b, { type: 'sine', freq: 500 + b.rng() * 900, dur: 0.08, gain: 0.12, env: 'punch', tau: 0.03, start: b.rng() * dur });
    }
    noise(e, b, { filter: { type: 'lowpass', freq: 500, glide: 120, glideTime: dur, q: 1.5 }, dur, gain: 0.3, env: 'swell', attack: 0.3, tau: 0.9 });
    formant(e, b, { freq: 90, glide: 50, glideTime: dur, dur, env: 'swell', attack: 0.4, tau: 1.0, peak: 0.2, type: 'sawtooth', f1: 500, f2: 800, f3: 1800 });
  },

  // ---- World ----
  doorOpen: (e, b) => {
    const dur = 1.4;
    osc(e, b, { type: 'sawtooth', freq: 140, glide: 320, glideTime: dur, dur, gain: 0.2, env: 'swell', attack: 0.2, tau: 0.3 });
    noise(e, b, { filter: { type: 'bandpass', freq: 600, glide: 1600, glideTime: dur, q: 3 }, dur, gain: 0.12, env: 'swell', attack: 0.2, tau: 0.3 });
    click(e, b, { start: dur, freq: 900, peak: 0.4, tau: 0.06 });
  },
  doorClose: (e, b) => {
    osc(e, b, { type: 'sine', freq: 120, glide: 40, glideTime: 0.25, dur: 0.4, gain: 0.5, env: 'punch', tau: 0.15 });
    click(e, b, { start: 0.2, freq: 1600, peak: 0.4, tau: 0.03 });
  },
  doorLocked: (e, b) => ratchet(e, b, { count: 3, span: 0.18, freq: 1500, peak: 0.4 }),
  mechanismTurn: (e, b) => {
    ratchet(e, b, { count: 8, span: 0.8, freq: 1800, peak: 0.3 });
    noise(e, b, { filter: { type: 'lowpass', freq: 300, glide: 120, glideTime: 0.9, q: 1 }, dur: 0.9, gain: 0.15, env: 'swell', attack: 0.2, tau: 0.3 });
  },
  mechanismLock: (e, b) => {
    metalRing(e, b, { freq: 200, dur: 0.6, peak: 0.4, tau: 0.2, ratios: [1, 1.9, 2.7], impactFreq: 800 });
    click(e, b, { start: 0.1, freq: 2400, peak: 0.35, tau: 0.03 });
  },
  pickupAmmo: (e, b) => {
    metalRing(e, b, { freq: 500, dur: 0.3, peak: 0.3, tau: 0.1, ratios: [1, 1.5, 2.2], partialGain: 0.15 });
    click(e, b, { start: 0.02, freq: 3000, peak: 0.25, tau: 0.02 });
  },
  pickupHealth: (e, b) => chime(e, b, { notes: [NOTE(69), NOTE(73)], dur: 0.5, peak: 0.35, tau: 0.25, type: 'sine' }),
  pickupArmor: (e, b) => {
    metalRing(e, b, { freq: 160, dur: 0.5, peak: 0.35, tau: 0.18, ratios: [1, 1.8, 2.6], impactFreq: 500 });
    osc(e, b, { type: 'sine', freq: 90, glide: 40, glideTime: 0.3, dur: 0.4, gain: 0.3, env: 'punch', tau: 0.15 });
  },
  pickupKey: (e, b) => chime(e, b, { notes: [NOTE(76), NOTE(79)], dur: 0.5, peak: 0.3, tau: 0.3, type: 'triangle', partials: [1, 1.005] }),
  secretFound: (e, b) => {
    chime(e, b, { notes: [NOTE(57), NOTE(64)], dur: 1.2, peak: 0.3, tau: 0.6, type: 'sine' });
    whisper(e, b, { freq: 1400, freqEnd: 800, dur: 0.8, peak: 0.15, q: 4, start: 0.3 });
  },
  tideRush: (e, b) => {
    const dur = 2.2;
    noise(e, b, { filter: { type: 'lowpass', freq: 1200, glide: 150, glideTime: dur, q: 0.5 }, dur, gain: 0.5, env: 'swell', attack: 0.4, tau: 0.8 });
    noise(e, b, { filter: { type: 'bandpass', freq: 800, glide: 100, glideTime: dur, q: 0.7 }, dur, gain: 0.3, env: 'swell', attack: 0.5, tau: 0.9 });
    osc(e, b, { type: 'sine', freq: 40, glide: 25, glideTime: dur, dur, gain: 0.4, env: 'swell', attack: 0.5, tau: 1.0 });
  },
  distantHorn: (e, b) => horn(e, b, { freq: 55, dur: 3.0, peak: 0.35, attack: 0.8, release: 0.7, cutoff: 420, vibrato: 0.55, vibratoDepth: 5 }),
  distantBoom: (e, b) => {
    const dur = 2.5;
    noise(e, b, { filter: { type: 'lowpass', freq: 400, glide: 60, glideTime: dur, q: 0.6 }, dur, gain: 0.5, env: 'punch', tau: 0.9 });
    osc(e, b, { type: 'sine', freq: 50, glide: 22, glideTime: dur, dur, gain: 0.5, env: 'punch', tau: 1.1 });
  },
  reversedVoice: (e, b) => {
    formant(e, b, { freq: 95, glide: 220, glideTime: 0.9, dur: 0.9, env: 'rev', peak: 0.35, type: 'sawtooth', f1: 500, f2: 900, f3: 2100 });
    noise(e, b, { filter: { type: 'bandpass', freq: 1100, glide: 600, glideTime: 0.9, q: 2.5 }, dur: 0.9, gain: 0.15, env: 'rev' });
  },
  chantLayer: (e, b) => {
    const f0 = 82 + e._rng() * 40;
    formant(e, b, { freq: f0, dur: 2.4, env: 'swell', attack: 1.2, tau: 0.9, peak: 0.28, type: 'sawtooth', f1: 600, f2: 1000, f3: 2200, jitter: 8, partials: [1, 2, 3] });
    osc(e, b, { type: 'sawtooth', freq: f0 * 0.5, dur: 2.4, gain: 0.12, env: 'swell', attack: 1.2, tau: 0.9 });
  },
  ambientSea: (e, b) => noise(e, b, { filter: { type: 'lowpass', freq: 500, glide: 200, glideTime: 2.0, q: 0.5 }, dur: 2.2, gain: 0.3, env: 'swell', attack: 0.5, tau: 0.9 }),
  ambientWind: (e, b) => noise(e, b, { filter: { type: 'bandpass', freq: 700, glide: 1400, glideTime: 1.6, q: 1.2 }, dur: 1.8, gain: 0.3, env: 'swell', attack: 0.4, tau: 0.7 }),
  ambientDrone: (e, b) => {
    const dur = 1.6;
    osc(e, b, { type: 'sawtooth', freq: 55, dur, gain: 0.2, env: 'swell', attack: 0.5, tau: 0.6 });
    osc(e, b, { type: 'sawtooth', freq: 55.4, dur, gain: 0.2, env: 'swell', attack: 0.5, tau: 0.6 });
    osc(e, b, { type: 'triangle', freq: 82.5, dur, gain: 0.15, env: 'swell', attack: 0.5, tau: 0.6 });
  },
  sanityWhisper: (e, b) => whisper(e, b, { freq: 1500, freqEnd: 600, dur: 0.7, peak: 0.22, q: 4 }),
  uiClick: (e, b) => click(e, b, { freq: 2200, peak: 0.35, tau: 0.02 }),
  uiConfirm: (e, b) => {
    osc(e, b, { type: 'square', freq: 660, dur: 0.08, gain: 0.2, env: 'punch', tau: 0.03 });
    osc(e, b, { type: 'square', freq: 990, dur: 0.1, gain: 0.2, env: 'punch', tau: 0.04, start: 0.07 });
  },
  ritualPulse: (e, b) => {
    const dur = 2.0;
    const g = b.ctx.createGain();
    g.connect(b.out);
    b.cleanup.push(g);
    const oi = b.ctx.createOscillator();
    oi.type = 'sine';
    oi.frequency.setValueAtTime(38, b.now);
    const og = b.ctx.createGain();
    og.gain.value = 0.7;
    oi.connect(og);
    og.connect(g);
    const lfo = b.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(2.5, b.now);
    const lfoG = b.ctx.createGain();
    lfoG.gain.value = 0.4;
    lfo.connect(lfoG);
    lfoG.connect(og.gain);
    oi.start(b.now);
    oi.stop(b.now + dur);
    lfo.start(b.now);
    lfo.stop(b.now + dur);
    b.sources.push({ node: oi, end: b.now + dur }, { node: lfo, end: b.now + dur });
    b.cleanup.push(oi, og, lfo, lfoG);
    noise(e, b, { filter: { type: 'lowpass', freq: 500, glide: 100, glideTime: dur, q: 1 }, dur, gain: 0.25, env: 'swell', attack: 0.3, tau: 0.7, dest: g });
    swell(g.gain, b.now, 0.5, 0.1, 0.7);
  },
  portalEnter: (e, b) => {
    const dur = 2.0;
    noise(e, b, { filter: { type: 'bandpass', freq: 400, glide: 2200, glideTime: dur, q: 1.5 }, dur, gain: 0.35, env: 'rev' });
    osc(e, b, { type: 'sawtooth', freq: 200, glide: 40, glideTime: dur, dur, gain: 0.3, env: 'rev' });
    osc(e, b, { type: 'sine', freq: 60, glide: 18, glideTime: dur, dur, gain: 0.5, env: 'swell', attack: 0.6, tau: 0.8 });
  },
};

/* -------------------------------------------------------------------------- *
 *  Sustained (loop) sound builders. These connect indefinitely-running sources
 *  to the voice output and register their rate parameters so setRate() works.
 * -------------------------------------------------------------------------- */

function flamethrowerLoop(e, b) {
  const src = b.ctx.createBufferSource();
  src.buffer = e._noiseBuffer;
  src.loop = true;
  src.playbackRate.setValueAtTime(0.7 * (b.rate ?? 1), b.now);
  b.rateParams.push({ param: src.playbackRate, base: 0.7 });
  const f = b.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(700, b.now);
  f.Q.setValueAtTime(0.8, b.now);
  const ng = b.ctx.createGain();
  ng.gain.value = 0.5;
  src.connect(f);
  f.connect(ng);
  ng.connect(b.out);
  const lfo = b.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.8, b.now);
  const lfoG = b.ctx.createGain();
  lfoG.gain.value = 240;
  lfo.connect(lfoG);
  lfoG.connect(f.frequency);
  const rum = b.ctx.createOscillator();
  rum.type = 'sawtooth';
  rum.frequency.setValueAtTime(55, b.now);
  const rumF = b.ctx.createBiquadFilter();
  rumF.type = 'lowpass';
  rumF.frequency.setValueAtTime(220, b.now);
  const rumG = b.ctx.createGain();
  rumG.gain.value = 0.22;
  rum.connect(rumF);
  rumF.connect(rumG);
  rumG.connect(b.out);
  src.start(b.now);
  lfo.start(b.now);
  rum.start(b.now);
  b.sources.push({ node: src, end: Infinity }, { node: lfo, end: Infinity }, { node: rum, end: Infinity });
  b.cleanup.push(src, f, ng, lfo, lfoG, rum, rumF, rumG);
}

function eyeHumLoop(e, b) {
  const g = b.ctx.createGain();
  g.gain.value = 0.5;
  g.connect(b.out);
  b.cleanup.push(g);
  const lfo = b.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.35, b.now);
  const lfoG = b.ctx.createGain();
  lfoG.gain.value = 0.15;
  lfo.connect(lfoG);
  lfoG.connect(g.gain);
  const parts = [[220, 1], [220.8, 0.5], [331, 0.4], [442, 0.25]];
  for (const [f, p] of parts) {
    const oi = b.ctx.createOscillator();
    oi.type = 'sine';
    oi.frequency.setValueAtTime(f, b.now);
    oi.detune.setValueAtTime((e._rng() * 2 - 1) * 3, b.now);
    const gi = b.ctx.createGain();
    gi.gain.value = p * 0.2;
    oi.connect(gi);
    gi.connect(g);
    oi.start(b.now);
    b.sources.push({ node: oi, end: Infinity });
    b.cleanup.push(oi, gi);
    b.rateParams.push({ param: oi.frequency, base: f });
  }
  lfo.start(b.now);
  b.sources.push({ node: lfo, end: Infinity });
  b.cleanup.push(lfo, lfoG);
}

function ambientSeaLoop(e, b) {
  const src = b.ctx.createBufferSource();
  src.buffer = e._noiseBuffer;
  src.loop = true;
  src.playbackRate.setValueAtTime(0.5, b.now);
  b.rateParams.push({ param: src.playbackRate, base: 0.5 });
  const f = b.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(480, b.now);
  f.Q.setValueAtTime(0.5, b.now);
  const ng = b.ctx.createGain();
  ng.gain.value = 0.45;
  src.connect(f);
  f.connect(ng);
  ng.connect(b.out);
  const lfo = b.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.06, b.now);
  const lfoG = b.ctx.createGain();
  lfoG.gain.value = 320;
  lfo.connect(lfoG);
  lfoG.connect(f.frequency);
  const bed = b.ctx.createOscillator();
  bed.type = 'sine';
  bed.frequency.setValueAtTime(0.05, b.now);
  const bedG = b.ctx.createGain();
  bedG.gain.value = 0.5;
  const bedOsc = b.ctx.createOscillator();
  bedOsc.type = 'sine';
  bedOsc.frequency.setValueAtTime(55, b.now);
  const bedOG = b.ctx.createGain();
  bedOG.gain.value = 0.5;
  bed.connect(bedG);
  bedG.connect(bedOG.gain);
  bedOsc.connect(bedOG);
  bedOG.connect(b.out);
  src.start(b.now);
  lfo.start(b.now);
  bed.start(b.now);
  bedOsc.start(b.now);
  b.sources.push(
    { node: src, end: Infinity }, { node: lfo, end: Infinity },
    { node: bed, end: Infinity }, { node: bedOsc, end: Infinity });
  b.cleanup.push(src, f, ng, lfo, lfoG, bed, bedG, bedOsc, bedOG);
}

function ambientWindLoop(e, b) {
  const src = b.ctx.createBufferSource();
  src.buffer = e._noiseBuffer;
  src.loop = true;
  src.playbackRate.setValueAtTime(0.9, b.now);
  b.rateParams.push({ param: src.playbackRate, base: 0.9 });
  const f = b.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(700, b.now);
  f.Q.setValueAtTime(1.1, b.now);
  const ng = b.ctx.createGain();
  ng.gain.value = 0.35;
  src.connect(f);
  f.connect(ng);
  ng.connect(b.out);
  const lfo = b.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.09, b.now);
  const lfoG = b.ctx.createGain();
  lfoG.gain.value = 450;
  lfo.connect(lfoG);
  lfoG.connect(f.frequency);
  const lfo2 = b.ctx.createOscillator();
  lfo2.type = 'sine';
  lfo2.frequency.setValueAtTime(0.13, b.now);
  const lfo2G = b.ctx.createGain();
  lfo2G.gain.value = 0.12;
  lfo2.connect(lfo2G);
  lfo2G.connect(ng.gain);
  src.start(b.now);
  lfo.start(b.now);
  lfo2.start(b.now);
  b.sources.push({ node: src, end: Infinity }, { node: lfo, end: Infinity }, { node: lfo2, end: Infinity });
  b.cleanup.push(src, f, ng, lfo, lfoG, lfo2, lfo2G);
}

function ambientDroneLoop(e, b) {
  const g = b.ctx.createGain();
  g.gain.value = 0.4;
  g.connect(b.out);
  b.cleanup.push(g);
  const freqs = [55, 55.5, 82.5, 110.3];
  for (const f of freqs) {
    const oi = b.ctx.createOscillator();
    oi.type = 'sawtooth';
    oi.frequency.setValueAtTime(f, b.now);
    oi.detune.setValueAtTime((e._rng() * 2 - 1) * 6, b.now);
    const fi = b.ctx.createBiquadFilter();
    fi.type = 'lowpass';
    fi.frequency.setValueAtTime(300, b.now);
    fi.Q.setValueAtTime(1, b.now);
    const gi = b.ctx.createGain();
    gi.gain.value = 0.12;
    oi.connect(fi);
    fi.connect(gi);
    gi.connect(g);
    oi.start(b.now);
    b.sources.push({ node: oi, end: Infinity });
    b.cleanup.push(oi, fi, gi);
    b.rateParams.push({ param: oi.frequency, base: f });
  }
  const lfo = b.ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.05, b.now);
  const lfoG = b.ctx.createGain();
  lfoG.gain.value = 140;
  lfo.connect(lfoG);
  lfoG.connect(g.gain);
  lfo.start(b.now);
  b.sources.push({ node: lfo, end: Infinity });
  b.cleanup.push(lfo, lfoG);
}

const LOOP_BUILDERS = {
  flamethrower: flamethrowerLoop,
  eyeHum: eyeHumLoop,
  ambientSea: ambientSeaLoop,
  ambientWind: ambientWindLoop,
  ambientDrone: ambientDroneLoop,
};

/* -------------------------------------------------------------------------- *
 *  Voice: a live play()/loop() handle with teardown.
 * -------------------------------------------------------------------------- */

class Voice {
  constructor(engine, cfg) {
    this.engine = engine;
    this.gain = cfg.gain;               // voice master volume
    this.positionGain = cfg.positionGain;
    this.panner = cfg.panner;
    this.reverbSend = cfg.reverbSend;
    this.sources = cfg.sources;         // [{node, end}]
    this.rateParams = cfg.rateParams;   // [{param, base}]
    this.cleanup = cfg.cleanup;         // nodes to disconnect on release
    this.sustained = cfg.sustained;
    this.startTime = cfg.startTime;
    this.endTime = cfg.endTime;
    this.stopped = false;
  }

  /** Stop the voice, optionally fading out over `fadeSeconds`. Safe to repeat. */
  stop(fadeSeconds = 0) {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.engine._ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const fade = Math.max(0, fadeSeconds || 0);
    if (fade > 0.001) {
      const p = this.gain.gain;
      try {
        p.cancelScheduledValues(t);
        p.setValueAtTime(Math.max(p.value, 0.0001), t);
        p.linearRampToValueAtTime(0.0001, t + fade);
      } catch { /* ignore */ }
    }
    for (const s of this.sources) {
      try { s.node.stop(t + fade); } catch { /* already stopped */ }
    }
    this.endTime = t + fade;
  }

  /** Set the voice's absolute volume (0..2). */
  setVolume(v) {
    if (this.stopped) return;
    const ctx = this.engine._ctx;
    if (!ctx) return;
    try { this.gain.gain.setTargetAtTime(clamp(v, 0, 2), ctx.currentTime, 0.03); } catch { /* ignore */ }
  }

  /** Move the voice in 3D space (only meaningful for positional voices). */
  setPosition(p) {
    if (this.stopped || !this.panner || !this.positionGain) return;
    const ctx = this.engine._ctx;
    if (!ctx) return;
    try {
      const pg = this.engine._computePanGain(p);
      this.panner.pan.setTargetAtTime(clamp(pg.pan, -1, 1), ctx.currentTime, 0.05);
      this.positionGain.gain.setTargetAtTime(clamp(pg.gain, 0, 1), ctx.currentTime, 0.05);
    } catch { /* ignore */ }
  }

  /** Set playback rate (0.05..4) — affects pitch for pitched sources. */
  setRate(r) {
    if (this.stopped) return;
    const ctx = this.engine._ctx;
    if (!ctx) return;
    const rr = clamp(r, 0.05, 4);
    try {
      for (const rp of this.rateParams) {
        rp.param.setValueAtTime(rp.base * rr, ctx.currentTime);
      }
    } catch { /* ignore */ }
  }

  /** Disconnect every node in this voice's graph so nothing leaks. */
  _disconnect() {
    for (const n of [this.gain, this.positionGain, this.panner, this.reverbSend]) {
      if (!n) continue;
      try { n.disconnect(); } catch { /* ignore */ }
    }
    for (const n of this.cleanup) {
      if (!n) continue;
      try { n.disconnect(); } catch { /* ignore */ }
    }
    this.sources.length = 0;
    this.cleanup.length = 0;
  }
}

/* -------------------------------------------------------------------------- *
 *  AudioEngine
 * -------------------------------------------------------------------------- */

/**
 * The SALTWAKE audio engine.
 *
 * All synthesis is procedural. Construct an instance, `await unlock()` on a user
 * gesture, then call `play()`/`loop()` per frame. `update(dt)` runs the music
 * lookahead scheduler and voice housekeeping and must be called every frame.
 *
 * @param {Object} [opts]
 * @param {number} [opts.masterVolume]  0..1 master volume (default 0.8).
 * @param {Function} [opts.AudioContext] Optional AudioContext constructor override
 *   (used by the headless tests to inject a mock; browsers use the global one).
 */
export class AudioEngine {
  constructor(opts = {}) {
    this._masterVolume = clamp(opts.masterVolume ?? 0.8, 0, 1);
    this._ctxCtor = opts.AudioContext || null;
    this._ctx = null;
    this._ready = false;
    this._failed = false;
    this._rng = mulberry32(0x5a17c0de);
    this._musicRng = mulberry32(0xbeefcafe);
    this._voices = [];
    this._maxVoices = 24;
    this._peakVoices = 0;
    this._peakTotal = 0;
    this._listener = {
      pos: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
    };
    this._sanity = 1;
    this._whisperTimer = 0;
    this._music = {
      running: false,
      step: 0,
      nextTime: 0,
      intensity: 0,
      intensityTarget: 0,
      sources: [],
      drone: [],
    };
    this._master = null;
    this._compressor = null;
    this._sfxBus = null;
    this._musicBus = null;
    this._ambientBus = null;
    this._musicFilter = null;
    this._reverb = null;
    this._reverbGain = null;
    this._noiseBuffer = null;
    this._distCurves = null;
  }

  /**
   * Create (or resume) the AudioContext and build the shared graph. Safe to call
   * repeatedly. Resolves once the context is ready, or leaves the engine inert
   * (ready === false) if no AudioContext is available.
   * @returns {Promise<void>}
   */
  async unlock() {
    if (this._ctx) {
      if (this._ctx.state === 'suspended') {
        try { await this._ctx.resume(); } catch { /* ignore */ }
      }
      return;
    }
    let Ctor = this._ctxCtor;
    if (!Ctor) {
      if (typeof AudioContext !== 'undefined') Ctor = AudioContext;
      else if (typeof webkitAudioContext !== 'undefined') Ctor = webkitAudioContext;
    }
    if (!Ctor) { this._failed = true; return; }
    try {
      const ctx = new Ctor();
      this._ctx = ctx;
      this._buildGraph();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* ignore */ }
      }
      this._ready = true;
    } catch (err) {
      this._ctx = null;
      this._ready = false;
      this._failed = true;
    }
  }

  /** @returns {boolean} True once unlock() has successfully built the graph. */
  get ready() {
    return this._ready;
  }

  /**
   * Set the master volume (0..1). Ramps smoothly to avoid clicks.
   * @param {number} v
   */
  setMasterVolume(v) {
    this._masterVolume = clamp(v, 0, 1);
    if (this._master && this._ctx) {
      try { this._master.gain.setTargetAtTime(this._masterVolume, this._ctx.currentTime, 0.02); } catch { /* ignore */ }
    }
  }

  /** Suspend the underlying context (best-effort). */
  suspend() {
    if (this._ctx) { try { this._ctx.suspend(); } catch { /* ignore */ } }
  }

  /** Resume the underlying context (best-effort). */
  resume() {
    if (this._ctx) { try { this._ctx.resume(); } catch { /* ignore */ } }
  }

  /**
   * Set the listener pose. Called once per frame; drives 3D pan/attenuation for
   * positional sounds.
   * @param {{x:number,y:number,z:number}} pos
   * @param {{x:number,y:number,z:number}} forward
   * @param {{x:number,y:number,z:number}} up
   */
  setListener(pos, forward, up) {
    if (pos) {
      this._listener.pos.x = pos.x ?? 0;
      this._listener.pos.y = pos.y ?? 0;
      this._listener.pos.z = pos.z ?? 0;
    }
    if (forward) {
      this._listener.forward.x = forward.x ?? 0;
      this._listener.forward.y = forward.y ?? 0;
      this._listener.forward.z = forward.z ?? -1;
    }
    if (up) {
      this._listener.up.x = up.x ?? 0;
      this._listener.up.y = up.y ?? 1;
      this._listener.up.z = up.z ?? 0;
    }
  }

  /**
   * Play a one-shot sound.
   * @param {string} name One of SOUND_NAMES.
   * @param {Object} [opts]
   * @param {{x:number,y:number,z:number}} [opts.position] 3D position (enables pan/attenuation).
   * @param {number} [opts.volume] 0..1 (default 1).
   * @param {number} [opts.rate] Playback/pitch rate multiplier.
   * @param {number} [opts.detune] Detune in cents.
   * @returns {{stop: Function}|null} A stop handle, or null when not ready.
   */
  play(name, opts = {}) {
    if (!this._ready || !this._ctx) return null;
    return this._spawn(name, opts, false);
  }

  /**
   * Start a sustained sound (flamethrower, ambience, eye hum).
   * @param {string} name One of SOUND_NAMES.
   * @param {Object} [opts]
   * @param {{x:number,y:number,z:number}} [opts.position]
   * @param {number} [opts.volume]
   * @param {number} [opts.rate]
   * @returns {{stop:Function,setVolume:Function,setPosition:Function,setRate:Function}|null}
   */
  loop(name, opts = {}) {
    if (!this._ready || !this._ctx) return null;
    if (LOOP_BUILDERS[name]) return this._spawn(name, opts, true);
    return this._spawn(name, opts, false);
  }

  /** Stop every live voice and the music. */
  stopAll() {
    if (!this._ctx) return;
    for (const v of [...this._voices]) {
      try { v.stop(0.03); } catch { /* ignore */ }
    }
    this.stopMusic();
  }

  /**
   * Music director target. 0 = ambient dread, 1 = full combat. Ramps smoothly in
   * update(); raises tempo, adds percussion layers and opens the filter.
   * @param {number} v 0..1
   */
  setMusicIntensity(v) {
    this._music.intensityTarget = clamp(v, 0, 1);
  }

  /** Start the industrial music loop (drone + scheduled percussion/motif). */
  startMusic() {
    if (!this._ready || !this._ctx) return;
    if (this._music.running) return;
    this._music.running = true;
    this._music.step = 0;
    this._music.nextTime = this._ctx.currentTime + 0.1;
    this._startDrone();
  }

  /** Stop the music and fade out any in-flight notes. */
  stopMusic() {
    const M = this._music;
    M.running = false;
    this._stopDrone();
    if (this._ctx) {
      const now = this._ctx.currentTime;
      for (const s of M.sources) {
        try { if (s.stoppable) s.node.stop(now + 0.05); } catch { /* ignore */ }
        s.end = now + 0.05;
      }
    }
  }

  /**
   * Sanity state. 1 = lucid, 0 = broken. Low sanity detunes and misplaces sounds
   * and mixes in whispers.
   * @param {number} v 0..1
   */
  setSanity(v) {
    this._sanity = clamp(v, 0, 1);
  }

  /**
   * Per-frame housekeeping: music lookahead scheduling, intensity ramp, voice and
   * music-node pruning, sanity whisper timing. Must be cheap.
   * @param {number} dt Seconds since the previous frame.
   */
  update(dt) {
    if (!this._ready || !this._ctx) return;
    const d = dt || 0.016;
    const now = this._ctx.currentTime;
    const M = this._music;

    // Smoothly ramp music intensity.
    const target = M.intensityTarget;
    if (Math.abs(M.intensity - target) < 0.001) M.intensity = target;
    else M.intensity += (target - M.intensity) * Math.min(1, d * 2.5);
    if (this._musicFilter) {
      const cut = 220 + 2200 * M.intensity * M.intensity;
      this._musicFilter.frequency.setTargetAtTime(cut, now, 0.08);
    }

    // Music lookahead scheduler + pruning.
    this._musicTick(now);
    this._pruneMusic(now);

    // Prune finished voices.
    for (let i = this._voices.length - 1; i >= 0; i--) {
      const v = this._voices[i];
      if (v.endTime <= now) {
        v._disconnect();
        this._voices.splice(i, 1);
      }
    }

    // Sanity whispers.
    this._whisperTimer -= d;
    if (this._sanity < 0.5 && this._whisperTimer <= 0) {
      this._buildWhisper(0.3 + (1 - this._sanity) * 0.4);
      this._whisperTimer = 1.5 + this._rng() * 4 * (1 - this._sanity);
    }

    // Track peak simultaneous usage (diagnostics / tests).
    const total = this._voices.length + M.sources.length + M.drone.length;
    this._peakVoices = Math.max(this._peakVoices, this._voices.length);
    this._peakTotal = Math.max(this._peakTotal, total);
  }

  /* ------------------------------------------------------------------ *
   *  Internals
   * ------------------------------------------------------------------ */

  /** Build the master graph: buses, compressor, reverb, music filter, caches. */
  _buildGraph() {
    const ctx = this._ctx;
    this._master = ctx.createGain();
    this._master.gain.value = this._masterVolume;
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -12;
    this._compressor.knee.value = 20;
    this._compressor.ratio.value = 6;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.25;
    this._master.connect(this._compressor);
    this._compressor.connect(ctx.destination);

    this._sfxBus = ctx.createGain();
    this._musicBus = ctx.createGain();
    this._ambientBus = ctx.createGain();
    this._sfxBus.gain.value = 1;
    this._musicBus.gain.value = 1;
    this._ambientBus.gain.value = 1;
    this._sfxBus.connect(this._master);
    this._musicBus.connect(this._master);
    this._ambientBus.connect(this._master);

    this._reverb = ctx.createConvolver();
    this._reverb.buffer = this._makeImpulse();
    this._reverbGain = ctx.createGain();
    this._reverbGain.gain.value = 0.35;
    this._reverb.connect(this._reverbGain);
    this._reverbGain.connect(this._master);

    this._musicFilter = ctx.createBiquadFilter();
    this._musicFilter.type = 'lowpass';
    this._musicFilter.frequency.value = 800;
    this._musicFilter.Q.value = 1;
    this._musicFilter.connect(this._musicBus);

    this._noiseBuffer = this._makeNoiseBuffer();
    this._distCurves = this._makeDistCurves();
  }

  /** Cached 2-second white-noise buffer. */
  _makeNoiseBuffer() {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1;
    return buf;
  }

  /** Cached procedural stereo reverb impulse (decaying filtered noise). */
  _makeImpulse() {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const decay = Math.pow(1 - t, 3.0);
        last = last * 0.85 + (this._rng() * 2 - 1) * 0.15;
        d[i] = last * 3 * decay;
      }
    }
    return buf;
  }

  /** Cached waveshaper curves (hard clip / tanh crunch / fuzz). */
  _makeDistCurves() {
    const N = 1024;
    const mk = (fn) => {
      const c = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1;
        c[i] = fn(x);
      }
      return c;
    };
    return {
      hard: mk((x) => Math.max(-1, Math.min(1, x * 3))),
      crunch: mk((x) => Math.tanh(2.2 * x) / Math.tanh(2.2)),
      fuzz: mk((x) => (x >= 0 ? 1 - Math.exp(-3.5 * x) : -1 + Math.exp(3.5 * x))),
    };
  }

  /**
   * Core voice spawner. Builds the voice graph (volume gain, optional positional
   * chain, reverb send), runs the requested sound builder, and registers the
   * resulting Voice with the voice budget.
   */
  _spawn(name, opts, sustained) {
    if (!this._ctx || !this._ready) return null;
    const builder = sustained ? LOOP_BUILDERS[name] : SOUND_BUILDERS[name];
    if (!builder) return null;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const b = {
      ctx,
      now,
      out: null,
      rng: this._rng,
      engine: this,
      sources: [],
      rateParams: [],
      cleanup: [],
      rate: opts.rate ?? 1,
      detune: opts.detune ?? 0,
      sustained,
      opts,
    };

    // Low sanity: detune and (later) misplace this sound.
    if (this._sanity < 1) {
      b.detune += (b.rng() * 2 - 1) * (1 - this._sanity) * 140;
    }

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = clamp(opts.volume ?? 1, 0, 2);
    b.out = voiceGain;

    let panner = null;
    let positionGain = null;
    let busOut = voiceGain;
    if (opts.position) {
      positionGain = ctx.createGain();
      const pg = this._computePanGain(opts.position);
      let pan = pg.pan;
      if (this._sanity < 1) {
        pan = clamp(pan + (b.rng() * 2 - 1) * (1 - this._sanity) * 0.4, -1, 1);
      }
      panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      positionGain.gain.value = pg.gain;
      voiceGain.connect(positionGain);
      positionGain.connect(panner);
      busOut = panner;
    }

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = sustained ? 0.16 : (opts.reverb ?? 0.15);
    voiceGain.connect(reverbSend);
    reverbSend.connect(this._reverb);
    busOut.connect(this._sfxBus);

    let voice;
    try {
      builder(this, b);
      let endTime = Infinity;
      if (!sustained) {
        endTime = now + 0.1;
        for (const s of b.sources) {
          if (Number.isFinite(s.end) && s.end > endTime) endTime = s.end;
        }
      }
      voice = new Voice(this, {
        gain: voiceGain,
        positionGain,
        panner,
        reverbSend,
        sources: b.sources,
        rateParams: b.rateParams,
        cleanup: b.cleanup,
        sustained,
        endTime,
        startTime: now,
      });
      this._admit(voice);
    } catch (err) {
      for (const n of [voiceGain, positionGain, panner, reverbSend, ...b.cleanup]) {
        try { if (n) n.disconnect(); } catch { /* ignore */ }
      }
      return null;
    }

    // Low sanity occasionally mixes in a whisper.
    if (this._sanity < 0.45 && !sustained && name !== 'sanityWhisper' && b.rng() < 0.04) {
      this._buildWhisper(clamp(opts.volume ?? 1, 0, 2) * 0.5);
    }
    return voice;
  }

  /** Register a voice, evicting the quietest/oldest when over the voice budget. */
  _admit(voice) {
    this._voices.push(voice);
    if (this._voices.length <= this._maxVoices) return;

    let candidates = this._voices.filter((v) => v !== voice && !v.sustained && !v.stopped);
    if (candidates.length === 0) candidates = this._voices.filter((v) => v !== voice && !v.stopped);
    if (candidates.length === 0) return;

    let victim = candidates[0];
    for (const v of candidates) {
      if (
        v.gain.gain.value < victim.gain.gain.value ||
        (v.gain.gain.value === victim.gain.gain.value && v.startTime < victim.startTime)
      ) {
        victim = v;
      }
    }
    victim.stop(0);
    victim._disconnect();
    const i = this._voices.indexOf(victim);
    if (i >= 0) this._voices.splice(i, 1);
  }

  /** Fire-and-forget sanity whisper. */
  _buildWhisper(volume) {
    if (!this._ready) return;
    try { this._spawn('sanityWhisper', { volume }, false); } catch { /* ignore */ }
  }

  /**
   * Compute stereo pan and distance gain from the listener pose. Uses an inverse
   * distance model and projects the source direction onto the listener's right
   * vector for pan (a simple, deterministic 1997-style spatial model).
   * @returns {{pan:number, gain:number}}
   */
  _computePanGain(pos) {
    const l = this._listener;
    const dx = pos.x - l.pos.x;
    const dy = pos.y - l.pos.y;
    const dz = pos.z - l.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    const ref = 1.5;
    const gain = clamp(ref / (ref + dist * 0.7), 0, 1);
    let rx = l.forward.y * l.up.z - l.forward.z * l.up.y;
    let ry = l.forward.z * l.up.x - l.forward.x * l.up.z;
    let rz = l.forward.x * l.up.y - l.forward.y * l.up.x;
    const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const dot = (dx * rx + dy * ry + dz * rz) / dist;
    return { pan: clamp(dot, -1, 1), gain };
  }

  /* --------------------------- music internals --------------------------- */

  /** Register a music-graph node for pruning (disconnects after `end`). */
  _musicTrack(node, end, stoppable) {
    this._music.sources.push({ node, end, stoppable });
  }

  _startDrone() {
    if (!this._ctx || !this._musicFilter) return;
    const ctx = this._ctx;
    const nodes = [];
    const specs = [
      [27.5, 'sawtooth', 0.22],
      [55.0, 'sawtooth', 0.16],
      [82.4, 'triangle', 0.12],
    ];
    for (const [f, type, level] of specs) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, ctx.currentTime);
      o.detune.setValueAtTime((this._rng() * 2 - 1) * 5, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, ctx.currentTime);
      o.connect(g);
      g.connect(this._musicFilter);
      o.start();
      nodes.push(o, g);
    }
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.06, ctx.currentTime);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(60, ctx.currentTime);
    lfo.connect(lfoG);
    lfoG.connect(this._musicFilter.frequency);
    lfo.start();
    nodes.push(lfo, lfoG);
    this._music.drone = nodes;
  }

  _stopDrone() {
    const nodes = this._music.drone;
    this._music.drone = [];
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    for (const n of nodes) {
      try {
        if (typeof n.stop === 'function') n.stop(t + 0.1);
        n.disconnect();
      } catch { /* ignore */ }
    }
  }

  _musicTick(now) {
    const M = this._music;
    if (!M.running || !this._ctx) return;
    const lookahead = 0.15;
    let guard = 0;
    while (M.nextTime < now + lookahead && guard < 32) {
      const bpm = 55 + 95 * M.intensity;
      const stepDur = 60 / bpm / 4; // 16th note
      this._musicStep(M.nextTime, M.step, M.intensity, stepDur);
      M.nextTime += stepDur;
      M.step = (M.step + 1) % 64;
      guard++;
    }
  }

  _pruneMusic(now) {
    const M = this._music;
    const alive = [];
    for (const s of M.sources) {
      if (s.end <= now) {
        try { if (s.stoppable) s.node.stop(now); } catch { /* ignore */ }
        try { s.node.disconnect(); } catch { /* ignore */ }
      } else {
        alive.push(s);
      }
    }
    M.sources = alive;
  }

  _musicStep(t, step, int, stepDur) {
    const rng = this._musicRng;
    if (int > 0.03) {
      if (step % 16 === 0) this._musicKick(t, int);
      if (step % 16 === 8 && int > 0.25) this._musicKick(t, int * 0.8);
    }
    if (int > 0.35 && step % 8 === 4) this._musicSnare(t, int);
    if (int > 0.6 && step % 2 === 0) this._musicHat(t, int);
    if (int > 0.75 && rng() < 0.2) this._musicMetal(t, int);
    if (int > 0.06) {
      const s = step % 16;
      if ([0, 3, 6, 10, 12, 14].includes(s) && (int > 0.3 || rng() < 0.5)) {
        this._musicBass(t, int, stepDur);
      }
    }
    if (int > 0.4 && rng() < 0.35) this._musicLead(t, int, stepDur);
  }

  _musicKick(t, int) {
    const ctx = this._ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.65 + 0.2 * int, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.004, 0.09);
    o.connect(g);
    g.connect(this._musicFilter);
    o.start(t);
    o.stop(t + 0.3);
    this._musicTrack(o, t + 0.3, true);
    this._musicTrack(g, t + 0.3, false);
  }

  _musicSnare(t, int) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1900, t);
    f.Q.setValueAtTime(1.1, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 * int, t);
    g.gain.setTargetAtTime(0.0001, t, 0.06);
    src.connect(f);
    f.connect(g);
    g.connect(this._musicFilter);
    src.start(t);
    src.stop(t + 0.22);
    this._musicTrack(src, t + 0.22, true);
    this._musicTrack(f, t + 0.22, false);
    this._musicTrack(g, t + 0.22, false);
  }

  _musicHat(t, int) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(7000, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * int, t);
    g.gain.setTargetAtTime(0.0001, t, 0.03);
    src.connect(f);
    f.connect(g);
    g.connect(this._musicFilter);
    src.start(t);
    src.stop(t + 0.08);
    this._musicTrack(src, t + 0.08, true);
    this._musicTrack(f, t + 0.08, false);
    this._musicTrack(g, t + 0.08, false);
  }

  _musicMetal(t, int) {
    const ctx = this._ctx;
    const base = NOTE(52 + Math.floor(this._musicRng() * 6) * 2);
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(base * (1 + i * 0.01), t);
      o.detune.setValueAtTime((this._musicRng() * 2 - 1) * 6, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18 * int, t);
      g.gain.setTargetAtTime(0.0001, t, 0.1);
      o.connect(g);
      g.connect(this._musicFilter);
      o.start(t);
      o.stop(t + 0.4);
      this._musicTrack(o, t + 0.4, true);
      this._musicTrack(g, t + 0.4, false);
    }
  }

  _musicBass(t, int, stepDur) {
    const ctx = this._ctx;
    const m = BASS_SCALE[Math.floor(this._musicRng() * BASS_SCALE.length)];
    const f = NOTE(m) * (this._sanity < 0.5
      ? Math.pow(2, (this._musicRng() * 2 - 1) * 0.012)
      : 1);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.detune.setValueAtTime((this._musicRng() * 2 - 1) * 8, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.24 + 0.1 * int, t + 0.02);
    g.gain.setTargetAtTime(0.0001, t + 0.02, stepDur * 1.6);
    o.connect(g);
    g.connect(this._musicFilter);
    const end = t + stepDur * 3 + 0.1;
    o.start(t);
    o.stop(end);
    this._musicTrack(o, end, true);
    this._musicTrack(g, end, false);
  }

  _musicLead(t, int, stepDur) {
    const ctx = this._ctx;
    const m = LEAD_SCALE[Math.floor(this._musicRng() * LEAD_SCALE.length)];
    const o = ctx.createOscillator();
    o.type = this._musicRng() < 0.5 ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(NOTE(m), t);
    o.detune.setValueAtTime((this._musicRng() * 2 - 1) * 12, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13 + 0.06 * int, t + 0.015);
    g.gain.setTargetAtTime(0.0001, t + 0.015, stepDur * 1.2);
    o.connect(g);
    g.connect(this._musicFilter);
    const end = t + stepDur * 2 + 0.1;
    o.start(t);
    o.stop(end);
    this._musicTrack(o, end, true);
    this._musicTrack(g, end, false);
  }
}
