/*
 * TS.Audio — fully synthesized sound for a WW2-era tank simulator.
 *
 * Hand-written Web Audio, no libraries, no ES modules, no build step.
 * Works from file:// and depends on nothing else in the project.
 * Every sound is synthesized: no audio files, no network.
 *
 * The whole thing lives inside one IIFE. All heavy/complex state (the
 * continuously running engine, track and radio graphs) is built exactly
 * once in init() and only ever *tweaked* afterwards via AudioParam
 * setTargetAtTime calls — setEngine never allocates a node.
 */
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;

  // ---------------------------------------------------------------------
  // State (remembered even before init(), so calls can safely come first)
  // ---------------------------------------------------------------------
  var ctx = null;              // the one and only AudioContext (or null)
  var _volume = 0.8;           // remembered master volume 0..1
  var _muted = false;
  var _interior = false;       // true = buttoned up (muffled)
  var _radioOn = false;
  var _starterOn = false;      // remembers previous frame's starter flag
  var starterStart = 0;        // time the starter motor began spinning
  var _engineState = {
    running: false, starting: false, rpm: 600, throttle: 0, load: 0,
    speed: 0, tracks: 0, damaged: false
  };

  // ---------------------------------------------------------------------
  // Master / reverb chain nodes (created once)
  // ---------------------------------------------------------------------
  var master = null, compressor = null, muffle = null;
  var revSend = null, revDelay1 = null, revDelay2 = null;
  var revFilter1 = null, revFilter2 = null, revFeedback = null, revReturn = null;

  // Reusable 2s white-noise buffer (deterministic PRNG).
  var noiseBuffer = null;

  // ---------------------------------------------------------------------
  // Engine graph nodes
  // ---------------------------------------------------------------------
  var engineMix = null, engineLP = null;
  var engOsc1 = null, engOsc2 = null, engOsc3 = null, engSub = null, engOscGain = null;
  var engNoiseSrc = null, engCombFilter = null, engCombGain = null;
  var engFireLFO = null, engFireDepth = null, engFireFM = null;
  var engWobble1 = null, engWobble2 = null, engWobbleDepth = null;
  var starterOsc = null, starterGain = null;
  var starterNoiseSrc = null, starterBP = null, starterRattleGain = null;
  var starterLFO = null, starterRattleDepth = null;

  // ---------------------------------------------------------------------
  // Track graph nodes
  // ---------------------------------------------------------------------
  var trackMix = null, trackGain = null;
  var trackNoiseSrc = null, trackLP = null, trackNoiseGain = null;
  var squeakOsc = null, squeakLFO = null, squeakFM = null, squeakGain = null;
  var clankNoiseSrc = null, clankBP = null, clankGain = null;
  var trackGateLFO = null, trackGateDepth = null;

  // ---------------------------------------------------------------------
  // Radio graph nodes
  // ---------------------------------------------------------------------
  var radioNoiseSrc = null, radioBP = null, radioGain = null;
  var radioLFO = null, radioLFOdepth = null;

  // ---------------------------------------------------------------------
  // Small numeric helpers (NaN-safe)
  // ---------------------------------------------------------------------
  function noop() {}

  // Return v if it is a finite number, otherwise def.
  function num(v, def) {
    return (typeof v === 'number' && isFinite(v)) ? v : def;
  }

  function clamp01(v) {
    var n = num(v, 0);
    return n < 0 ? 0 : (n > 1 ? 1 : n);
  }

  function clamp(v, lo, hi) {
    var n = num(v, lo);
    return n < lo ? lo : (n > hi ? hi : n);
  }

  function sanitizeEngine(s) {
    s = s || {};
    return {
      running: !!s.running,
      starting: !!s.starting,
      rpm: clamp(num(s.rpm, 600), 600, 2600),
      throttle: clamp01(s.throttle),
      load: clamp01(s.load),
      speed: num(s.speed, 0),
      tracks: clamp01(s.tracks),
      damaged: !!s.damaged
    };
  }

  // ---------------------------------------------------------------------
  // One-shot synthesis helpers. These DO allocate short-lived nodes, but
  // only inside play(); they always stop + disconnect themselves.
  // ---------------------------------------------------------------------

  // A noise burst swept through a filter, with an exponential envelope.
  function noiseBurst(t0, dur, o) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = false;
    src.playbackRate.value = num(o.rate, 1);

    var filt = ctx.createBiquadFilter();
    filt.type = o.filterType || 'lowpass';
    filt.frequency.setValueAtTime(Math.max(num(o.f0, 1000), 1), t0);
    if (o.f1 !== undefined) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(num(o.f1, 500), 1), t0 + dur);
    }
    filt.Q.value = num(o.q, 0.7);

    var g = ctx.createGain();
    var peak = Math.max(num(o.peak, 0.5), 0.0001);
    var attack = Math.max(num(o.attack, 0.005), 0.0005);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    if (o.wet) {
      var s = ctx.createGain();
      s.gain.value = num(o.wet, 0);
      g.connect(s);
      s.connect(revSend);
    }

    src.start(t0);
    src.stop(t0 + dur + 0.05);
    src.onended = function () {
      try { g.disconnect(); src.disconnect(); } catch (e) { noop(); }
    };
  }

  // A single oscillator tone with an optional pitch drop and envelope.
  function toneBurst(t0, o) {
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(num(o.f0, 440), 1), t0);
    var decay = Math.max(num(o.decay, 0.1), 0.005);
    if (o.f1 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(num(o.f1, 220), 1), t0 + decay);
    }

    var g = ctx.createGain();
    var peak = Math.max(num(o.gain, 0.2), 0.0001);
    var attack = Math.max(num(o.attack, 0.002), 0.0005);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

    osc.connect(g);
    g.connect(master);
    if (o.wet) {
      var s = ctx.createGain();
      s.gain.value = num(o.wet, 0);
      g.connect(s);
      s.connect(revSend);
    }

    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
    osc.onended = function () {
      try { g.disconnect(); osc.disconnect(); } catch (e) { noop(); }
    };
  }

  // ---------------------------------------------------------------------
  // Individual one-shot effects (called by play())
  // ---------------------------------------------------------------------

  function sfxFire(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4) * 1.6;
    // Main boom: noise through a fast downward lowpass sweep.
    noiseBurst(t0, 1.8, { rate: 0.35 * rate, filterType: 'lowpass', f0: 3500, f1: 140, q: 0.5, peak: 1.0 * g, attack: 0.003, wet: 0.6 });
    // Punchy sub-bass drop.
    toneBurst(t0, { type: 'sine', f0: 150 * rate, f1: 32 * rate, gain: 0.9 * g, attack: 0.002, decay: 0.5, wet: 0.25 });
    // Metallic ring partials.
    toneBurst(t0 + 0.01, { type: 'triangle', f0: 2200 * rate, f1: 1500 * rate, gain: 0.18 * g, attack: 0.001, decay: 0.35, wet: 0.7 });
    toneBurst(t0 + 0.012, { type: 'sine', f0: 2700 * rate, f1: 1800 * rate, gain: 0.12 * g, attack: 0.001, decay: 0.3, wet: 0.7 });
    // Long, roomy rumble tail.
    noiseBurst(t0 + 0.05, 2.2, { rate: 0.2 * rate, filterType: 'lowpass', f0: 500, f1: 90, q: 0.5, peak: 0.4 * g, attack: 0.03, wet: 0.9 });
  }

  function sfxExplosion(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4) * 0.9;
    noiseBurst(t0, 2.5, { rate: 0.25 * rate, filterType: 'lowpass', f0: 900, f1: 80, q: 0.6, peak: 0.6 * g, attack: 0.03, wet: 0.8 });
    toneBurst(t0 + 0.02, { type: 'sine', f0: 80 * rate, f1: 30 * rate, gain: 0.5 * g, attack: 0.02, decay: 1.2, wet: 0.5 });
    // Delayed secondary rumble (distant impact).
    noiseBurst(t0 + 0.3, 2.0, { rate: 0.18 * rate, filterType: 'lowpass', f0: 400, f1: 60, q: 0.5, peak: 0.3 * g, attack: 0.05, wet: 0.9 });
  }

  function sfxHit(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    toneBurst(t0, { type: 'sine', f0: 2800 * rate, f1: 900 * rate, gain: 0.5 * g, attack: 0.001, decay: 0.18, wet: 0.6 });
    toneBurst(t0, { type: 'triangle', f0: 3600 * rate, f1: 1100 * rate, gain: 0.25 * g, attack: 0.001, decay: 0.12, wet: 0.6 });
    noiseBurst(t0, 0.05, { rate: rate, filterType: 'highpass', f0: 4000, q: 0.7, peak: 0.2 * g, attack: 0.001, wet: 0.2 });
  }

  function sfxBreech(t0, g0, rate, heavier) {
    var g = clamp(g0, 0.001, 4) * (heavier ? 1.3 : 1.0);
    // Bandpassed noise thump.
    noiseBurst(t0, heavier ? 0.25 : 0.18, {
      rate: rate * (heavier ? 0.5 : 0.6), filterType: 'bandpass',
      f0: heavier ? 280 : 380, q: 2.5, peak: 0.8 * g, attack: 0.002, wet: 0.5
    });
    // Inharmonic metallic partial cluster.
    var partials = heavier ? [620, 940, 1420, 2210] : [820, 1240, 1870, 2600];
    for (var i = 0; i < partials.length; i++) {
      toneBurst(t0 + 0.002, {
        type: 'triangle', f0: partials[i] * rate, f1: partials[i] * rate * 0.82,
        gain: (0.16 - i * 0.02) * g, attack: 0.001, decay: 0.12 + i * 0.01, wet: 0.6
      });
    }
  }

  function sfxLoad(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    // Shell sliding into the tube: filtered noise sweep.
    noiseBurst(t0, 0.5, { rate: rate * 0.7, filterType: 'bandpass', f0: 2600, f1: 700, q: 3, peak: 0.3 * g, attack: 0.02, wet: 0.4 });
    // Seating clunk at the end of the stroke.
    noiseBurst(t0 + 0.48, 0.2, { rate: rate * 0.5, filterType: 'bandpass', f0: 320, q: 3, peak: 0.7 * g, attack: 0.002, wet: 0.5 });
    toneBurst(t0 + 0.48, { type: 'triangle', f0: 900 * rate, f1: 700 * rate, gain: 0.2 * g, attack: 0.001, decay: 0.1, wet: 0.5 });
  }

  function sfxShellDrop(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    var n = 6;
    for (var i = 0; i < n; i++) {
      var st = t0 + i * (0.05 + Math.random() * 0.05);
      var f = (900 + Math.random() * 2200) * rate;
      toneBurst(st, { type: 'triangle', f0: f, f1: f * 0.6, gain: 0.22 * g * (1 - i * 0.08), attack: 0.001, decay: 0.08, wet: 0.6 });
      noiseBurst(st, 0.03, { rate: rate, filterType: 'highpass', f0: 3000, q: 0.7, peak: 0.1 * g, attack: 0.001, wet: 0.2 });
    }
  }

  function sfxSwitch(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.04, { rate: rate, filterType: 'highpass', f0: 3500, q: 0.8, peak: 0.5 * g, attack: 0.001, wet: 0.15 });
    toneBurst(t0, { type: 'square', f0: 1800 * rate, f1: 1200 * rate, gain: 0.12 * g, attack: 0.001, decay: 0.04, wet: 0.15 });
  }

  function sfxButton(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.06, { rate: rate, filterType: 'lowpass', f0: 1800, q: 0.6, peak: 0.4 * g, attack: 0.002, wet: 0.1 });
    toneBurst(t0, { type: 'sine', f0: 700 * rate, f1: 400 * rate, gain: 0.1 * g, attack: 0.001, decay: 0.05, wet: 0.1 });
  }

  function sfxKnob(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.02, { rate: rate, filterType: 'highpass', f0: 5000, q: 1, peak: 0.4 * g, attack: 0.0005, wet: 0.1 });
  }

  function sfxLever(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    var n = 3 + Math.floor(Math.random() * 4); // 3..6 rapid ticks
    for (var i = 0; i < n; i++) {
      var st = t0 + i * 0.035;
      noiseBurst(st, 0.03, { rate: rate, filterType: 'bandpass', f0: 2500, q: 3, peak: 0.4 * g, attack: 0.0008, wet: 0.2 });
      toneBurst(st, { type: 'square', f0: 1400 * rate, f1: 900 * rate, gain: 0.08 * g, attack: 0.0005, decay: 0.025, wet: 0.15 });
    }
  }

  function sfxGear(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    // Gearbox grind.
    noiseBurst(t0, 0.22, { rate: rate, filterType: 'bandpass', f0: 1500, f1: 900, q: 4, peak: 0.45 * g, attack: 0.01, wet: 0.3 });
    toneBurst(t0, { type: 'sawtooth', f0: 220 * rate, f1: 140 * rate, gain: 0.15 * g, attack: 0.01, decay: 0.2, wet: 0.2 });
    // Engagement clunk.
    noiseBurst(t0 + 0.22, 0.15, { rate: rate * 0.5, filterType: 'bandpass', f0: 400, q: 2.5, peak: 0.7 * g, attack: 0.002, wet: 0.5 });
    toneBurst(t0 + 0.22, { type: 'triangle', f0: 500 * rate, f1: 350 * rate, gain: 0.2 * g, attack: 0.002, decay: 0.1, wet: 0.5 });
  }

  function sfxHatch(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4) * 1.2;
    noiseBurst(t0, 0.35, { rate: rate * 0.4, filterType: 'lowpass', f0: 900, f1: 200, q: 0.7, peak: 0.9 * g, attack: 0.002, wet: 0.8 });
    toneBurst(t0, { type: 'sine', f0: 140 * rate, f1: 45 * rate, gain: 0.6 * g, attack: 0.002, decay: 0.4, wet: 0.8 });
    toneBurst(t0 + 0.005, { type: 'triangle', f0: 700 * rate, f1: 300 * rate, gain: 0.2 * g, attack: 0.001, decay: 0.25, wet: 0.9 });
  }

  function sfxStarterFail(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    // Weak grind.
    toneBurst(t0, { type: 'sawtooth', f0: 90 * rate, f1: 60 * rate, gain: 0.3 * g, attack: 0.02, decay: 0.7, wet: 0.3 });
    noiseBurst(t0, 0.6, { rate: rate, filterType: 'bandpass', f0: 800, f1: 400, q: 2, peak: 0.25 * g, attack: 0.02, wet: 0.3 });
    // Failed catches: stuttering clicks that never take.
    for (var i = 0; i < 4; i++) {
      noiseBurst(t0 + 0.15 + i * 0.12, 0.03, { rate: rate, filterType: 'bandpass', f0: 1200, q: 3, peak: 0.2 * g * (1 - i * 0.15), attack: 0.001, wet: 0.2 });
    }
  }

  function sfxIgnite(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    // Rising thump that hands off into the drone (drone rises via setEngine).
    toneBurst(t0, { type: 'sine', f0: 60 * rate, f1: 160 * rate, gain: 0.6 * g, attack: 0.02, decay: 0.6, wet: 0.4 });
    noiseBurst(t0, 0.5, { rate: rate, filterType: 'bandpass', f0: 300, f1: 1200, q: 1.5, peak: 0.5 * g, attack: 0.03, wet: 0.4 });
    for (var i = 0; i < 3; i++) {
      noiseBurst(t0 + 0.05 + i * 0.08, 0.08, { rate: rate, filterType: 'bandpass', f0: 900, q: 2, peak: 0.3 * g, attack: 0.005, wet: 0.3 });
    }
  }

  function sfxStall(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    var st = t0;
    for (var i = 0; i < 6; i++) {
      noiseBurst(st, 0.1, { rate: rate * (1 - i * 0.1), filterType: 'bandpass', f0: 500 - i * 40, q: 2, peak: 0.4 * g * (1 - i * 0.14), attack: 0.005, wet: 0.3 });
      toneBurst(st, { type: 'sawtooth', f0: (120 - i * 10) * rate, f1: (70 - i * 8) * rate, gain: 0.15 * g * (1 - i * 0.12), attack: 0.005, decay: 0.1, wet: 0.3 });
      st += 0.12 + i * 0.03;
    }
  }

  function sfxBuzzer(t0, g0, rate, dur) {
    var g = clamp(g0, 0.001, 4);
    var d = clamp(dur, 0.05, 5);
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 400 * rate;
    var lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 9; // pulse-train rate
    var lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    var gate = ctx.createGain();
    gate.gain.value = 0;
    var out = ctx.createGain();
    lfo.connect(lfoG);
    lfoG.connect(gate.gain);
    o.connect(gate);
    gate.connect(out);
    out.connect(master);

    var peak = Math.max(0.5 * g, 0.0001);
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    out.gain.setValueAtTime(peak, t0 + d - 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + d + 0.05);
    lfo.stop(t0 + d + 0.05);
    o.onended = function () {
      try { out.disconnect(); o.disconnect(); lfo.disconnect(); } catch (e) { noop(); }
    };
  }

  function sfxRadioBeep(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    toneBurst(t0, { type: 'sine', f0: 1200 * rate, gain: 0.4 * g, attack: 0.003, decay: 0.12, wet: 0.3 });
    noiseBurst(t0, 0.08, { rate: rate, filterType: 'bandpass', f0: 1500, q: 2, peak: 0.15 * g, attack: 0.002, wet: 0.2 });
  }

  function sfxSqueak(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    toneBurst(t0, { type: 'sine', f0: 1300 * rate, f1: 900 * rate, gain: 0.4 * g, attack: 0.01, decay: 0.35, wet: 0.5 });
    toneBurst(t0 + 0.02, { type: 'sine', f0: 1650 * rate, f1: 1000 * rate, gain: 0.2 * g, attack: 0.01, decay: 0.3, wet: 0.5 });
  }

  function sfxClunk(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.12, { rate: rate * 0.6, filterType: 'bandpass', f0: 500, q: 2.5, peak: 0.6 * g, attack: 0.001, wet: 0.5 });
    toneBurst(t0, { type: 'triangle', f0: 600 * rate, f1: 320 * rate, gain: 0.25 * g, attack: 0.001, decay: 0.1, wet: 0.5 });
  }

  function sfxReticle(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.015, { rate: rate, filterType: 'highpass', f0: 4500, q: 1, peak: 0.3 * g, attack: 0.0004, wet: 0.1 });
  }

  function sfxHydraulic(t0, g0, rate, dur) {
    var g = clamp(g0, 0.001, 4);
    var d = clamp(dur, 0.1, 8);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.5 * rate;

    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 1.2;

    var hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55 * rate;
    var humG = ctx.createGain();
    humG.gain.value = 0.5;

    var g1 = ctx.createGain();
    g1.gain.value = 0;
    var fade = Math.min(0.15, d * 0.3);
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(Math.max(0.3 * g, 0.0001), t0 + fade);
    g1.gain.setValueAtTime(Math.max(0.3 * g, 0.0001), t0 + d - fade);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

    src.connect(bp);
    bp.connect(g1);
    hum.connect(humG);
    humG.connect(g1);
    g1.connect(master);
    var s = ctx.createGain();
    s.gain.value = 0.3;
    g1.connect(s);
    s.connect(revSend);

    src.start(t0);
    hum.start(t0);
    src.stop(t0 + d + 0.05);
    hum.stop(t0 + d + 0.05);
    src.onended = function () {
      try { g1.disconnect(); src.disconnect(); hum.disconnect(); } catch (e) { noop(); }
    };
  }

  function sfxDust(t0, g0, rate) {
    var g = clamp(g0, 0.001, 4);
    noiseBurst(t0, 0.4, { rate: rate * 0.7, filterType: 'lowpass', f0: 1200, f1: 300, q: 0.5, peak: 0.3 * g, attack: 0.02, wet: 0.4 });
  }

  // ---------------------------------------------------------------------
  // Graph builders — each node is created exactly once, in init().
  // ---------------------------------------------------------------------

  function buildNoiseBuffer() {
    var seconds = 2;
    var len = Math.floor(ctx.sampleRate * seconds);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    var s = 0x6D2B79F5 | 0; // deterministic xorshift32 seed
    for (var i = 0; i < len; i++) {
      s = (s ^ (s << 13)) | 0;
      s = (s ^ (s >>> 17)) | 0;
      s = (s ^ (s << 5)) | 0;
      data[i] = ((s >>> 0) / 4294967295) * 2 - 1;
    }
  }

  function buildMasterChain() {
    master = ctx.createGain();
    master.gain.value = _muted ? 0 : _volume;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.3;

    muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = _interior ? 900 : 16000;
    muffle.Q.value = 0.5;

    master.connect(compressor);
    compressor.connect(muffle);
    muffle.connect(ctx.destination);

    // Cheap convolution-free "space": two feedback delay lines + lowpass.
    revSend = ctx.createGain();
    revSend.gain.value = 0.4;
    revDelay1 = ctx.createDelay(2);
    revDelay1.delayTime.value = 0.089;
    revDelay2 = ctx.createDelay(2);
    revDelay2.delayTime.value = 0.143;
    revFilter1 = ctx.createBiquadFilter();
    revFilter1.type = 'lowpass';
    revFilter1.frequency.value = 3600;
    revFilter1.Q.value = 0.5;
    revFilter2 = ctx.createBiquadFilter();
    revFilter2.type = 'lowpass';
    revFilter2.frequency.value = 2000;
    revFilter2.Q.value = 0.5;
    revFeedback = ctx.createGain();
    revFeedback.gain.value = 0.44;
    revReturn = ctx.createGain();
    revReturn.gain.value = 0.7;

    revSend.connect(revDelay1);
    revDelay1.connect(revFilter1);
    revFilter1.connect(revReturn);
    revFilter1.connect(revDelay2);
    revDelay2.connect(revFilter2);
    revFilter2.connect(revReturn);
    revFilter2.connect(revFeedback);
    revFeedback.connect(revDelay1);
    revReturn.connect(master);
  }

  function buildEngineGraph() {
    engineMix = ctx.createGain();
    engineMix.gain.value = 1;
    engineLP = ctx.createBiquadFilter();
    engineLP.type = 'lowpass';
    engineLP.frequency.value = 2000;
    engineLP.Q.value = 0.5;
    engineMix.connect(engineLP);
    engineLP.connect(master);
    var ew = ctx.createGain();
    ew.gain.value = 0.35;
    engineLP.connect(ew);
    ew.connect(revSend);

    // Detuned drone oscillators (V-engine character) + sub sine an octave down.
    engOsc1 = ctx.createOscillator();
    engOsc1.type = 'sawtooth';
    engOsc1.frequency.value = 40;
    engOsc1.detune.value = -8;
    engOsc2 = ctx.createOscillator();
    engOsc2.type = 'square';
    engOsc2.frequency.value = 40.4;
    engOsc2.detune.value = 9;
    engOsc3 = ctx.createOscillator();
    engOsc3.type = 'sawtooth';
    engOsc3.frequency.value = 80;
    engOsc3.detune.value = 5;
    engSub = ctx.createOscillator();
    engSub.type = 'sine';
    engSub.frequency.value = 20;
    engOscGain = ctx.createGain();
    engOscGain.gain.value = 0;
    engOsc1.connect(engOscGain);
    engOsc2.connect(engOscGain);
    engOsc3.connect(engOscGain);
    engSub.connect(engOscGain);
    engOscGain.connect(engineMix);

    // Combustion roughness: looping noise, bandpassed and amplitude-modulated
    // by an LFO running at the cylinder firing frequency.
    engNoiseSrc = ctx.createBufferSource();
    engNoiseSrc.buffer = noiseBuffer;
    engNoiseSrc.loop = true;
    engNoiseSrc.playbackRate.value = 1;
    engCombFilter = ctx.createBiquadFilter();
    engCombFilter.type = 'bandpass';
    engCombFilter.frequency.value = 400;
    engCombFilter.Q.value = 1.5;
    engCombGain = ctx.createGain();
    engCombGain.gain.value = 0;
    engNoiseSrc.connect(engCombFilter);
    engCombFilter.connect(engCombGain);
    engCombGain.connect(engineMix);

    engFireLFO = ctx.createOscillator();
    engFireLFO.type = 'sine';
    engFireLFO.frequency.value = 40;
    engFireDepth = ctx.createGain();
    engFireDepth.gain.value = 0;   // AM depth (into engCombGain.gain)
    engFireLFO.connect(engFireDepth);
    engFireDepth.connect(engCombGain.gain);
    engFireFM = ctx.createGain();
    engFireFM.gain.value = 0;      // subtle FM of the combustion filter
    engFireLFO.connect(engFireFM);
    engFireFM.connect(engCombFilter.frequency);

    // Two slightly detuned-rate LFOs give an "irregular" wobble when damaged.
    engWobble1 = ctx.createOscillator();
    engWobble1.type = 'sine';
    engWobble1.frequency.value = 0.7;
    engWobble2 = ctx.createOscillator();
    engWobble2.type = 'sine';
    engWobble2.frequency.value = 1.7;
    engWobbleDepth = ctx.createGain();
    engWobbleDepth.gain.value = 0;
    engWobble1.connect(engWobbleDepth);
    engWobble2.connect(engWobbleDepth);
    engWobbleDepth.connect(engineMix.gain);

    // Starter motor: rising saw whine + solenoid rattle (gated noise).
    starterOsc = ctx.createOscillator();
    starterOsc.type = 'sawtooth';
    starterOsc.frequency.value = 60;
    starterGain = ctx.createGain();
    starterGain.gain.value = 0;
    starterOsc.connect(starterGain);
    starterGain.connect(engineMix);

    starterNoiseSrc = ctx.createBufferSource();
    starterNoiseSrc.buffer = noiseBuffer;
    starterNoiseSrc.loop = true;
    starterNoiseSrc.playbackRate.value = 0.5;
    starterBP = ctx.createBiquadFilter();
    starterBP.type = 'bandpass';
    starterBP.frequency.value = 900;
    starterBP.Q.value = 1.5;
    starterRattleGain = ctx.createGain();
    starterRattleGain.gain.value = 0;
    starterLFO = ctx.createOscillator();
    starterLFO.type = 'square';
    starterLFO.frequency.value = 28;
    starterRattleDepth = ctx.createGain();
    starterRattleDepth.gain.value = 0;
    starterLFO.connect(starterRattleDepth);
    starterRattleDepth.connect(starterRattleGain.gain);
    starterNoiseSrc.connect(starterBP);
    starterBP.connect(starterRattleGain);
    starterRattleGain.connect(engineMix);

    engOsc1.start();
    engOsc2.start();
    engOsc3.start();
    engSub.start();
    engNoiseSrc.start();
    engFireLFO.start();
    engWobble1.start();
    engWobble2.start();
    starterOsc.start();
    starterNoiseSrc.start();
    starterLFO.start();
  }

  function buildTrackGraph() {
    trackMix = ctx.createGain();
    trackMix.gain.value = 1;
    trackGain = ctx.createGain();
    trackGain.gain.value = 0;
    trackMix.connect(trackGain);
    trackGain.connect(master);
    var tw = ctx.createGain();
    tw.gain.value = 0.5;
    trackGain.connect(tw);
    tw.connect(revSend);

    // Continuous rolling rumble.
    trackNoiseSrc = ctx.createBufferSource();
    trackNoiseSrc.buffer = noiseBuffer;
    trackNoiseSrc.loop = true;
    trackNoiseSrc.playbackRate.value = 0.8;
    trackLP = ctx.createBiquadFilter();
    trackLP.type = 'lowpass';
    trackLP.frequency.value = 400;
    trackLP.Q.value = 0.6;
    trackNoiseGain = ctx.createGain();
    trackNoiseGain.gain.value = 0;
    trackNoiseSrc.connect(trackLP);
    trackLP.connect(trackNoiseGain);
    trackNoiseGain.connect(trackMix);

    // Periodic squeal (wavery sine, gated by the track-rate LFO below).
    squeakOsc = ctx.createOscillator();
    squeakOsc.type = 'sine';
    squeakOsc.frequency.value = 1100;
    squeakLFO = ctx.createOscillator();
    squeakLFO.type = 'sine';
    squeakLFO.frequency.value = 6;
    squeakFM = ctx.createGain();
    squeakFM.gain.value = 70;
    squeakLFO.connect(squeakFM);
    squeakFM.connect(squeakOsc.frequency);
    squeakGain = ctx.createGain();
    squeakGain.gain.value = 0;
    squeakOsc.connect(squeakGain);
    squeakGain.connect(trackMix);

    // Periodic clank (resonant bandpassed noise, same gate).
    clankNoiseSrc = ctx.createBufferSource();
    clankNoiseSrc.buffer = noiseBuffer;
    clankNoiseSrc.loop = true;
    clankNoiseSrc.playbackRate.value = 0.7;
    clankBP = ctx.createBiquadFilter();
    clankBP.type = 'bandpass';
    clankBP.frequency.value = 1200;
    clankBP.Q.value = 9;
    clankGain = ctx.createGain();
    clankGain.gain.value = 0;
    clankNoiseSrc.connect(clankBP);
    clankBP.connect(clankGain);
    clankGain.connect(trackMix);

    trackGateLFO = ctx.createOscillator();
    trackGateLFO.type = 'square';
    trackGateLFO.frequency.value = 3;
    trackGateDepth = ctx.createGain();
    trackGateDepth.gain.value = 0;
    trackGateLFO.connect(trackGateDepth);
    trackGateDepth.connect(squeakGain.gain);
    trackGateDepth.connect(clankGain.gain);

    trackNoiseSrc.start();
    squeakOsc.start();
    squeakLFO.start();
    clankNoiseSrc.start();
    trackGateLFO.start();
  }

  function buildRadioGraph() {
    radioNoiseSrc = ctx.createBufferSource();
    radioNoiseSrc.buffer = noiseBuffer;
    radioNoiseSrc.loop = true;
    radioNoiseSrc.playbackRate.value = 1.2;
    radioBP = ctx.createBiquadFilter();
    radioBP.type = 'bandpass';
    radioBP.frequency.value = 2200;
    radioBP.Q.value = 0.9;
    radioGain = ctx.createGain();
    radioGain.gain.value = 0;
    // Slow wander of the band centre reads as faint static chatter.
    radioLFO = ctx.createOscillator();
    radioLFO.type = 'sine';
    radioLFO.frequency.value = 7;
    radioLFOdepth = ctx.createGain();
    radioLFOdepth.gain.value = 300;
    radioLFO.connect(radioLFOdepth);
    radioLFOdepth.connect(radioBP.frequency);
    radioNoiseSrc.connect(radioBP);
    radioBP.connect(radioGain);
    radioGain.connect(master);
    var rw = ctx.createGain();
    rw.gain.value = 0.4;
    radioGain.connect(rw);
    rw.connect(revSend);
    radioNoiseSrc.start();
    radioLFO.start();
  }

  // ---------------------------------------------------------------------
  // Continuous parameter updates. NOTE: no nodes are created in here —
  // only AudioParam setTargetAtTime calls on the graph built by init().
  // ---------------------------------------------------------------------
  function applyEngine() {
    var e = _engineState;
    var t = ctx.currentTime;
    var ftc = 0.05; // frequency time constant
    var gtc = 0.1;  // gain time constant (~0.3 s to settle => gentle fade)

    var running = e.running;
    var rpm = clamp(e.rpm, 600, 2600);
    var rpm01 = clamp01((rpm - 600) / 2000);
    var throttle = e.throttle;
    var load = e.load;
    var speed = e.speed;
    var tracks = e.tracks;
    var damaged = e.damaged;
    var starting = e.starting;

    // Drone pitch = rpm/60 * cylinderFactor; firing freq = rpm/60 * (cyls/2).
    var drone = rpm / 60 * 2;
    var firing = rpm / 60 * 4;
    engOsc1.frequency.setTargetAtTime(drone, t, ftc);
    engOsc2.frequency.setTargetAtTime(drone * 1.008, t, ftc);
    engOsc3.frequency.setTargetAtTime(drone * 2, t, ftc);
    engSub.frequency.setTargetAtTime(drone * 0.5, t, ftc);
    engFireLFO.frequency.setTargetAtTime(firing, t, ftc);
    engCombFilter.frequency.setTargetAtTime(240 + firing * 3.2, t, ftc);
    engCombFilter.Q.setTargetAtTime(0.9 + rpm01 * 1.5, t, ftc);

    // Loudness rises with rpm, throttle and load; zero when not running.
    var level = running ? clamp(0.15 + 0.42 * rpm01 + 0.22 * throttle + 0.18 * load, 0, 0.9) : 0;
    engOscGain.gain.setTargetAtTime(level * 0.5, t, gtc);
    engCombGain.gain.setTargetAtTime(level * 0.62, t, gtc);
    engFireDepth.gain.setTargetAtTime(level * 0.22, t, gtc);
    engFireFM.gain.setTargetAtTime(level * 40, t, gtc);
    engineLP.frequency.setTargetAtTime(320 + rpm01 * 3800 + throttle * 500 + load * 300, t, ftc);

    // Damage wobble (two detuned LFOs => irregular beating).
    engWobbleDepth.gain.setTargetAtTime(damaged ? 0.06 : 0, t, gtc);

    // Starter whine: rising pitch + solenoid rattle while cranking.
    if (starting && !_starterOn) {
      starterStart = t;
    }
    _starterOn = starting;
    if (starting && !running) {
      var el = clamp(t - starterStart, 0, 3);
      starterOsc.frequency.setTargetAtTime(55 + el * 150, t, ftc);
      starterGain.gain.setTargetAtTime(0.5, t, gtc);
      starterRattleGain.gain.setTargetAtTime(0.3, t, gtc);
      starterRattleDepth.gain.setTargetAtTime(0.4, t, gtc);
      starterBP.frequency.setTargetAtTime(700 + el * 400, t, ftc);
    } else {
      starterGain.gain.setTargetAtTime(0, t, gtc);
      starterRattleGain.gain.setTargetAtTime(0, t, gtc);
      starterRattleDepth.gain.setTargetAtTime(0, t, gtc);
    }

    // Tracks: rolling rumble + rate-driven squeak/clank, only when moving.
    var sp = Math.abs(speed);
    var moving = running && (tracks > 0.01 || sp > 0.3);
    var trackAmt = moving ? clamp(tracks * 0.7 + clamp(sp / 22, 0, 1) * 0.4, 0, 0.8) : 0;
    trackNoiseGain.gain.setTargetAtTime(trackAmt * 0.75, t, gtc);
    trackLP.frequency.setTargetAtTime(240 + sp * 50, t, ftc);
    var gateRate = clamp(1.2 + tracks * 6 + sp * 0.5, 0, 18);
    trackGateLFO.frequency.setTargetAtTime(gateRate, t, ftc);
    trackGateDepth.gain.setTargetAtTime(moving ? 0.5 : 0, t, gtc);
    squeakOsc.frequency.setTargetAtTime(950 + sp * 25 + tracks * 300, t, ftc);
    clankBP.frequency.setTargetAtTime(1000 + sp * 30, t, ftc);
  }

  function applyVolume() {
    if (!ctx) { return; }
    master.gain.setTargetAtTime(_muted ? 0 : _volume, ctx.currentTime, 0.03);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function init() {
    if (ctx) { return; }        // already inited — safe no-op
    if (!AC) { return; }        // no Web Audio at all — everything stays no-op

    ctx = new AC();

    buildNoiseBuffer();
    buildMasterChain();
    buildEngineGraph();
    buildTrackGraph();
    buildRadioGraph();

    // Apply any settings remembered from before init.
    applyVolume();
    setInterior(_interior);
    setRadio(_radioOn);
    applyEngine();

    // Try to start immediately if the browser left it suspended.
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        var p = ctx.resume();
        if (p && p.catch) { p.catch(noop); }
      } catch (e) { noop(); }
    }
  }

  function resume() {
    if (!ctx || typeof ctx.resume !== 'function') { return; }
    try {
      var p = ctx.resume();
      if (p && p.catch) { p.catch(noop); }
    } catch (e) { noop(); }
  }

  function suspend() {
    if (!ctx || typeof ctx.suspend !== 'function') { return; }
    try {
      var p = ctx.suspend();
      if (p && p.catch) { p.catch(noop); }
    } catch (e) { noop(); }
  }

  function setMaster(v) {
    _volume = clamp01(v);
    applyVolume();
  }

  function setMuted(b) {
    _muted = !!b;
    applyVolume();
  }

  function setInterior(buttonedUp) {
    _interior = !!buttonedUp;
    if (!ctx) { return; }
    muffle.frequency.setTargetAtTime(buttonedUp ? 900 : 16000, ctx.currentTime, 0.1);
    revSend.gain.setTargetAtTime(buttonedUp ? 0.12 : 0.45, ctx.currentTime, 0.1);
  }

  function setRadio(on) {
    _radioOn = !!on;
    if (!ctx) { return; }
    radioGain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.1);
  }

  function setEngine(s) {
    _engineState = sanitizeEngine(s);
    if (!ctx) { return; }
    applyEngine();
  }

  function play(name, opts) {
    if (!ctx) { return; }       // ignore before init / when unavailable
    opts = opts || {};
    var gain = num(opts.gain, 1);
    var rate = clamp(num(opts.rate, 1), 0.05, 8);
    var delay = Math.max(num(opts.delay, 0), 0);
    var dur = num(opts.duration, 0.5);
    var t0 = ctx.currentTime + delay;

    switch (name) {
      case 'fire': sfxFire(t0, gain, rate); break;
      case 'explosion': sfxExplosion(t0, gain, rate); break;
      case 'hit': sfxHit(t0, gain, rate); break;
      case 'breechOpen': sfxBreech(t0, gain, rate, false); break;
      case 'breechClose': sfxBreech(t0, gain, rate, true); break;
      case 'load': sfxLoad(t0, gain, rate); break;
      case 'shellDrop': sfxShellDrop(t0, gain, rate); break;
      case 'switch': sfxSwitch(t0, gain, rate); break;
      case 'button': sfxButton(t0, gain, rate); break;
      case 'knob': sfxKnob(t0, gain, rate); break;
      case 'lever': sfxLever(t0, gain, rate); break;
      case 'gear': sfxGear(t0, gain, rate); break;
      case 'hatch': sfxHatch(t0, gain, rate); break;
      case 'starterFail': sfxStarterFail(t0, gain, rate); break;
      case 'ignite': sfxIgnite(t0, gain, rate); break;
      case 'stall': sfxStall(t0, gain, rate); break;
      case 'buzzer': sfxBuzzer(t0, gain, rate, dur); break;
      case 'radioBeep': sfxRadioBeep(t0, gain, rate); break;
      case 'squeak': sfxSqueak(t0, gain, rate); break;
      case 'clunk': sfxClunk(t0, gain, rate); break;
      case 'reticleClick': sfxReticle(t0, gain, rate); break;
      case 'hydraulic': sfxHydraulic(t0, gain, rate, dur); break;
      case 'dust': sfxDust(t0, gain, rate); break;
      default: break;           // unknown names: never throw, just ignore
    }
  }

  function ready() {
    return !!(ctx && ctx.state === 'running');
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------
  window.TS = window.TS || {};
  window.TS.Audio = {
    init: init,
    resume: resume,
    suspend: suspend,
    setMaster: setMaster,
    setMuted: setMuted,
    get muted() { return _muted; },
    setInterior: setInterior,
    setRadio: setRadio,
    setEngine: setEngine,
    play: play,
    ready: ready
  };
})();
