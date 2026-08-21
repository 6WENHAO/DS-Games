// Procedural soundscape: generative music + wind + rain, all synthesised in the browser.
// No audio assets — everything is oscillators, filtered noise and a generated reverb tail,
// so it works offline and reacts continuously to weather, wind and the swarm's motion.

const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);

// One musical "mood" per weather preset: pentatonic-ish scales, register and brightness.
const MOODS = {
  dawn: { root: 62, scale: [0, 2, 4, 7, 9, 11], bright: 1500, pad: 0.24, every: [3.5, 7.0], oct: 0 },
  clear: { root: 62, scale: [0, 2, 4, 7, 9], bright: 2700, pad: 0.20, every: [2.6, 5.5], oct: 0 },
  windy: { root: 64, scale: [0, 2, 5, 7, 9], bright: 2200, pad: 0.18, every: [2.2, 4.6], oct: 0 },
  overcast: { root: 60, scale: [0, 3, 5, 7, 10], bright: 1250, pad: 0.26, every: [4.0, 8.0], oct: -12 },
  rain: { root: 58, scale: [0, 3, 5, 7, 10], bright: 950, pad: 0.28, every: [4.5, 9.0], oct: -12 },
  sunset: { root: 63, scale: [0, 2, 4, 7, 9], bright: 1900, pad: 0.26, every: [3.0, 6.5], oct: 0 },
  night: { root: 55, scale: [0, 3, 7, 10, 14], bright: 1050, pad: 0.22, every: [5.0, 10.0], oct: -12 },
};

function noiseBuffer(ctx, seconds = 4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // pink-ish noise: a cheap one-pole cascade over white noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.28;
    }
  }
  return buf;
}

function reverbBuffer(ctx, seconds = 3.2, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // soft diffuse tail with a touch of early reflection sparkle
      const env = Math.pow(1 - t, decay);
      const sparkle = i < ctx.sampleRate * 0.08 ? 1.6 : 1.0;
      d[i] = (Math.random() * 2 - 1) * env * sparkle;
    }
  }
  return buf;
}

export class SoundScape {
  constructor(opts = {}) {
    this.ctx = null;
    this.ready = false;
    this.unavailable = false;
    this.error = null;
    this.volume = opts.volume ?? 0.75;
    this.musicVol = opts.music ?? 0.7;
    this.ambVol = opts.ambience ?? 0.8;
    this.muted = !!opts.muted;

    this.mood = MOODS.clear;
    this.moodKey = 'clear';
    this.nextPad = 0;
    this.nextNote = 0;
    this.lastChime = -1;
    this.flowerAcc = 0;
    this.lastFlash = 0;
    this.notes = 0;
    this.pads = 0;
    this.thunders = 0;
    this.chimes = 0;
    this.stale = false;
    this.allowSuspendedSchedule = false;
    // last computed automation targets (the audible values chase these)
    this.targets = { windLow: 0, windBand: 0, windHiss: 0, windFreq: 0, rainMid: 0, rainLow: 0 };
  }

  /** must be called from a user gesture (browser autoplay policy) */
  start() {
    if (this.unavailable) return false;
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.unavailable = true; return false; }
    try {
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.build();
      ctx.resume().catch(() => {});
      this.ready = true;
      const t = ctx.currentTime;
      this.nextPad = t + 0.4;
      this.nextNote = t + 2.0;
      return true;
    } catch (e) {
      this.unavailable = true;
      this.error = e.message;
      return false;
    }
  }

  build() {
    const ctx = this.ctx;

    // ---- master chain
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.02;
    comp.release.value = 0.35;
    this.master.connect(comp).connect(ctx.destination);

    // ---- reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = reverbBuffer(ctx);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.85;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.send = ctx.createGain();
    this.send.gain.value = 1.0;
    this.send.connect(this.reverb);

    // ---- buses
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);
    this.musicSend = ctx.createGain();
    this.musicSend.gain.value = 0.55;
    this.musicBus.connect(this.musicSend).connect(this.send);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = this.ambVol;
    this.ambBus.connect(this.master);
    const ambSend = ctx.createGain();
    ambSend.gain.value = 0.12;
    this.ambBus.connect(ambSend).connect(this.send);

    // ---- one looping noise source feeds wind and rain
    this.noise = ctx.createBufferSource();
    this.noise.buffer = noiseBuffer(ctx);
    this.noise.loop = true;

    const mk = (type, freq, q, gain) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q !== undefined) f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      this.noise.connect(f).connect(g).connect(this.ambBus);
      return { f, g };
    };

    this.windLow = mk('lowpass', 230, 0.7, 0.0);     // body / rumble
    this.windBand = mk('bandpass', 520, 0.85, 0.0);  // the voice of the gust
    this.windHiss = mk('highpass', 2400, 0.6, 0.0);  // grass hiss
    this.rainMid = mk('bandpass', 1850, 0.5, 0.0);   // the patter
    this.rainLow = mk('lowpass', 420, 0.9, 0.0);     // rain on soil

    this.noise.start();

    // ---- bass drone (two detuned sines)
    this.drone = [];
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.connect(this.musicBus);
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = MIDI(this.mood.root - 24);
      o.detune.value = det;
      o.connect(this.droneGain);
      o.start();
      this.drone.push(o);
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMusic(v) {
    this.musicVol = v;
    if (this.musicBus) this.musicBus.gain.value = v;
  }

  setAmbience(v) {
    this.ambVol = v;
    if (this.ambBus) this.ambBus.gain.value = v;
  }

  setMood(key) {
    if (!MOODS[key] || key === this.moodKey) return;
    this.moodKey = key;
    this.mood = MOODS[key];
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const f = MIDI(this.mood.root - 24);
    for (const o of this.drone) o.frequency.setTargetAtTime(f, t, 2.5);
  }

  note(midi, when, dur, level, type = 'sine', pan = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = MIDI(midi);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    if (p) {
      p.pan.value = pan;
      o.connect(g).connect(p).connect(this.musicBus);
      p.connect(this.musicSend);
    } else {
      o.connect(g).connect(this.musicBus);
    }
    o.start(when);
    o.stop(when + dur + 0.05);
    return o;
  }

  /** slow evolving chord */
  schedulePad(when) {
    const m = this.mood;
    const ctx = this.ctx;
    const dur = 9 + Math.random() * 5;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = m.bright * (0.7 + Math.random() * 0.5);
    lp.Q.value = 0.6;
    g.connect(lp).connect(this.musicBus);
    lp.connect(this.musicSend);

    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(m.pad, when + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);

    const pick = () => m.scale[(Math.random() * m.scale.length) | 0];
    const voices = [0, pick(), pick() + 12];
    for (const semi of voices) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = Math.random() < 0.5 ? 'sine' : 'triangle';
        o.frequency.value = MIDI(m.root + m.oct + semi);
        o.detune.value = det + (Math.random() - 0.5) * 6;
        o.connect(g);
        o.start(when);
        o.stop(when + dur + 0.1);
      }
    }
    this.pads++;
    return dur;
  }

  /** sparse plucked note */
  scheduleNote(when) {
    const m = this.mood;
    const semi = m.scale[(Math.random() * m.scale.length) | 0] + (Math.random() < 0.35 ? 12 : 0);
    const midi = m.root + m.oct + 12 + semi;
    const pan = (Math.random() - 0.5) * 1.2;
    const dur = 1.6 + Math.random() * 1.8;
    this.note(midi, when, dur, 0.11, 'sine', pan);
    this.note(midi + 12, when + 0.01, dur * 0.5, 0.035, 'triangle', -pan * 0.6);
    this.notes++;
  }

  /** a blossom opened: soft bell, heavily reverbed */
  chime() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02;
    const m = this.mood;
    const semi = m.scale[(Math.random() * m.scale.length) | 0];
    const midi = m.root + m.oct + 24 + semi;
    this.note(midi, t, 1.5, 0.055, 'sine', (Math.random() - 0.5) * 1.4);
    this.note(midi + 19, t + 0.015, 0.9, 0.018, 'sine', 0);
    this.chimes++;
  }

  thunder(strength) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const delay = 0.25 + Math.random() * 1.4;          // distance
    const when = ctx.currentTime + delay;
    const dur = 2.4 + Math.random() * 2.4;
    const src = ctx.createBufferSource();
    src.buffer = this.noise.buffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, when);
    lp.frequency.exponentialRampToValueAtTime(70, when + dur);
    const g = ctx.createGain();
    const level = 0.42 * Math.min(1, strength) / (0.6 + delay);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(level, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(lp).connect(g).connect(this.ambBus);
    g.connect(this.send);
    src.start(when);
    src.stop(when + dur + 0.1);
    this.thunders++;
  }

  /**
   * state: { weather, wind, gust, rain, flash, speed, idle, flowers, night }
   */
  update(dt, state) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    // Parameter targets are safe to set at any time; only *scheduling* needs a running
    // clock, otherwise notes would pile up at a frozen currentTime and fire together.
    const running = ctx.state === 'running' || this.allowSuspendedSchedule;
    if (!running) this.stale = true;
    const t = ctx.currentTime;
    const k = 0.25;                                    // smoothing time constant

    this.setMood(state.weather);

    // ---- wind: strength drives level, gusts drive the band-pass sweep
    const w = Math.min(1.6, state.wind || 0);
    const gust = state.gust ?? 0.5;
    const move = Math.min(1, (state.speed || 0) / 16);
    const windLevel = 0.10 + 0.55 * w + 0.18 * move;
    const tg = this.targets;
    tg.windLow = 0.35 * windLevel;
    tg.windBand = 0.30 * windLevel * (0.45 + 0.9 * gust);
    tg.windHiss = 0.16 * windLevel * (0.3 + 0.9 * gust) + 0.05 * move;
    tg.windFreq = 360 + 900 * gust + 260 * move;
    this.windLow.g.gain.setTargetAtTime(tg.windLow, t, k);
    this.windBand.g.gain.setTargetAtTime(tg.windBand, t, k);
    this.windHiss.g.gain.setTargetAtTime(tg.windHiss, t, k);
    this.windBand.f.frequency.setTargetAtTime(tg.windFreq, t, k);
    this.windLow.f.frequency.setTargetAtTime(190 + 120 * w, t, k);

    // ---- rain
    const r = Math.min(1, state.rain || 0);
    tg.rainMid = 0.34 * r;
    tg.rainLow = 0.24 * r;
    this.rainMid.g.gain.setTargetAtTime(tg.rainMid, t, 0.6);
    this.rainLow.g.gain.setTargetAtTime(tg.rainLow, t, 0.6);
    this.rainMid.f.frequency.setTargetAtTime(1500 + 700 * r, t, 0.6);

    // ---- drone: quieter while racing, fuller when you settle
    const droneLevel = 0.05 + 0.05 * (state.idle ?? 0);
    this.droneGain.gain.setTargetAtTime(droneLevel, t, 1.2);

    // ---- thunder on lightning
    const flash = state.flash || 0;
    if (flash > 0.45 && this.lastFlash <= 0.45) this.thunder(flash);
    this.lastFlash = flash;

    // ---- blossoms ring, but rate limited so it stays music, not a slot machine
    const bloomed = state.flowers || 0;
    if (this.lastChime < 0) this.lastChime = bloomed;
    if (bloomed - this.lastChime >= 6 && (this.chimeCooldown || 0) <= 0) {
      this.lastChime = bloomed;
      this.chimeCooldown = 0.55 + Math.random() * 0.7;
      this.chime();
    }
    this.chimeCooldown = Math.max(0, (this.chimeCooldown || 0) - dt);
    if (bloomed < this.lastChime) this.lastChime = bloomed;   // meadow was reset

    if (!running) return;
    if (this.stale) {
      this.stale = false;
      this.nextPad = t + 0.15;
      this.nextNote = t + 0.9;
    }

    // ---- schedule pads and plucks a little ahead of the clock
    const look = t + 1.0;
    for (let guard = 0; guard < 4 && this.nextPad < look; guard++) {
      const dur = this.schedulePad(this.nextPad);
      this.nextPad += dur * 0.72;                      // overlap so the bed never gaps
    }
    for (let guard = 0; guard < 6 && this.nextNote < look; guard++) {
      this.scheduleNote(this.nextNote);
      const [lo, hi] = this.mood.every;
      const busy = 0.7 + 0.6 * (1 - (state.idle ?? 0));
      this.nextNote += (lo + Math.random() * (hi - lo)) * busy;
    }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  diag() {
    return {
      ready: this.ready,
      unavailable: this.unavailable,
      state: this.ctx ? this.ctx.state : 'none',
      sampleRate: this.ctx ? this.ctx.sampleRate : 0,
      mood: this.moodKey,
      pads: this.pads,
      notes: this.notes,
      chimes: this.chimes,
      thunders: this.thunders,
      muted: this.muted,
      volume: this.volume,
      targets: this.targets,
      error: this.error,
    };
  }
}
