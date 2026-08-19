// Procedural audio engine — every sound is synthesised at runtime (no samples).
// Minecraft-flavoured block/material sounds + No Man's Sky flavoured UI / ship / scanner sounds.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volumes = { master: 0.85, sfx: 0.95, ui: 0.7, music: 0.5, amb: 0.6 };
    this.loops = new Map();
    this.lastStep = 0;
    this._noiseBuf = null;
    this._brownBuf = null;
  }

  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // master chain: bus -> tone filter (underwater/helmet) -> compressor -> destination
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    this.masterFilter.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 3.2;
    comp.attack.value = 0.005; comp.release.value = 0.22;
    this.master.connect(this.masterFilter);
    this.masterFilter.connect(comp);
    comp.connect(ctx.destination);

    const bus = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
    this.sfx = bus(this.volumes.sfx);
    this.ui = bus(this.volumes.ui);
    this.music = bus(this.volumes.music);
    this.amb = bus(this.volumes.amb);

    // reverb (procedural impulse response)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._makeIR(2.6, 2.4);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.9;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.revSend = ctx.createGain();
    this.revSend.gain.value = 1;
    this.revSend.connect(this.reverb);

    // long space reverb
    this.reverbBig = ctx.createConvolver();
    this.reverbBig.buffer = this._makeIR(5.2, 3.4);
    this.reverbBigGain = ctx.createGain();
    this.reverbBigGain.gain.value = 0.75;
    this.reverbBig.connect(this.reverbBigGain);
    this.reverbBigGain.connect(this.master);
    this.revSendBig = ctx.createGain();
    this.revSendBig.gain.value = 1;
    this.revSendBig.connect(this.reverbBig);

    // stereo delay for UI shimmer
    this.delay = ctx.createDelay(1.2);
    this.delay.delayTime.value = 0.28;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.34;
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.value = 2400;
    this.delay.connect(this.delayFilter); this.delayFilter.connect(this.delayFb); this.delayFb.connect(this.delay);
    this.delayOut = ctx.createGain(); this.delayOut.gain.value = 0.4;
    this.delay.connect(this.delayOut); this.delayOut.connect(this.master);
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 1; this.delaySend.connect(this.delay);

    this.enabled = true;
    return ctx;
  }

  async unlock() {
    this.init();
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) { /* ignore */ } }
    return this.ctx.state === 'running';
  }

  setVolume(name, v) {
    this.volumes[name] = v;
    if (!this.ctx) return;
    const target = { master: this.master, sfx: this.sfx, ui: this.ui, music: this.music, amb: this.amb }[name];
    if (target) target.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  _makeIR(dur = 2.5, decay = 2.6) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        // slightly filtered noise for a smoother tail
        const n = (Math.random() * 2 - 1);
        last = last * 0.62 + n * 0.38;
        // early reflections
        const er = (i < rate * 0.08 && Math.random() < 0.004) ? 2.4 : 1;
        d[i] = last * env * er * (ch === 0 ? 1 : 0.92);
      }
    }
    return buf;
  }

  noiseBuffer(seconds = 2, brown = false) {
    const cacheKey = brown ? '_brownBuf' : '_noiseBuf';
    if (this[cacheKey]) return this[cacheKey];
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    this[cacheKey] = buf;
    return buf;
  }

  /* ------------------------------------------------------------------ *
   *  primitives
   * ------------------------------------------------------------------ */
  env(gainNode, t0, { attack = 0.005, hold = 0, decay = 0.2, peak = 1, sustain = 0 }) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    if (hold > 0) g.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    const end = t0 + attack + hold + decay;
    if (sustain > 0) g.exponentialRampToValueAtTime(Math.max(0.0002, sustain), end);
    else g.exponentialRampToValueAtTime(0.0001, end);
    return end;
  }

  tone(o = {}) {
    if (!this.enabled) return null;
    const ctx = this.ctx;
    const t0 = (o.when || 0) + this.t;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    const f0 = o.freq || 440;
    osc.frequency.setValueAtTime(f0, t0);
    if (o.freqEnd && o.freqEnd !== f0) {
      if (o.expSweep === false) osc.frequency.linearRampToValueAtTime(o.freqEnd, t0 + (o.sweepTime || o.dur || 0.2));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + (o.sweepTime || o.dur || 0.2));
    }
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter; f.frequency.setValueAtTime(o.filterFreq || 1200, t0);
      if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filterEnd), t0 + (o.dur || 0.2));
      f.Q.value = o.q || 1;
      node.connect(f); node = f;
    }
    const g = ctx.createGain();
    node.connect(g);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(o.pan || 0, -1, 1);
    g.connect(pan);
    const dest = o.bus === 'ui' ? this.ui : o.bus === 'music' ? this.music : o.bus === 'amb' ? this.amb : this.sfx;
    pan.connect(dest);
    if (o.reverb) { const rs = ctx.createGain(); rs.gain.value = o.reverb; pan.connect(rs); rs.connect(o.bigReverb ? this.revSendBig : this.revSend); }
    if (o.delay) { const ds = ctx.createGain(); ds.gain.value = o.delay; pan.connect(ds); ds.connect(this.delaySend); }
    const end = this.env(g, t0, { attack: o.attack ?? 0.005, hold: o.hold || 0, decay: o.decay ?? (o.dur || 0.2), peak: o.gain ?? 0.3 });
    osc.start(t0);
    osc.stop(end + 0.05);
    return { osc, gain: g, end };
  }

  noise(o = {}) {
    if (!this.enabled) return null;
    const ctx = this.ctx;
    const t0 = (o.when || 0) + this.t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2, !!o.brown);
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    let node = src;
    if (o.filter !== 'none') {
      const f = ctx.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 900, t0);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + (o.sweepTime || o.dur || 0.2));
      f.Q.value = o.q ?? 1.2;
      node.connect(f); node = f;
      if (o.filter2) {
        const f2 = ctx.createBiquadFilter();
        f2.type = o.filter2; f2.frequency.value = o.freq2 || 4000; f2.Q.value = o.q2 || 0.7;
        node.connect(f2); node = f2;
      }
    }
    const g = ctx.createGain();
    node.connect(g);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(o.pan || 0, -1, 1);
    g.connect(pan);
    const dest = o.bus === 'ui' ? this.ui : o.bus === 'music' ? this.music : o.bus === 'amb' ? this.amb : this.sfx;
    pan.connect(dest);
    if (o.reverb) { const rs = ctx.createGain(); rs.gain.value = o.reverb; pan.connect(rs); rs.connect(o.bigReverb ? this.revSendBig : this.revSend); }
    const end = this.env(g, t0, { attack: o.attack ?? 0.002, hold: o.hold || 0, decay: o.decay ?? (o.dur || 0.12), peak: o.gain ?? 0.25 });
    src.start(t0);
    src.stop(end + 0.05);
    return { src, gain: g, end };
  }

  /* ------------------------------------------------------------------ *
   *  Minecraft-style material sounds
   * ------------------------------------------------------------------ */
  blockBreak(material = 'stone', pan = 0) {
    if (!this.enabled) return;
    const p = 0.86 + Math.random() * 0.3; // MC-ish pitch randomisation
    switch (material) {
      case 'dirt':
      case 'gravel':
        this.noise({ filter: 'lowpass', freq: 780 * p, freqEnd: 190 * p, q: 0.9, dur: 0.16, gain: 0.32, pan, reverb: 0.1 });
        this.noise({ filter: 'bandpass', freq: 300 * p, q: 1.4, dur: 0.1, gain: 0.16, pan });
        break;
      case 'grass':
      case 'plant':
        this.noise({ filter: 'highpass', freq: 1500 * p, q: 0.6, dur: 0.12, gain: 0.2, pan });
        this.noise({ filter: 'bandpass', freq: 2600 * p, q: 1.1, dur: 0.08, gain: 0.14, pan });
        break;
      case 'sand':
        this.noise({ filter: 'bandpass', freq: 1900 * p, q: 0.8, dur: 0.18, gain: 0.24, pan });
        this.noise({ filter: 'lowpass', freq: 420 * p, dur: 0.12, gain: 0.12, pan });
        break;
      case 'wood':
        this.tone({ type: 'triangle', freq: 220 * p, freqEnd: 90 * p, dur: 0.13, gain: 0.22, decay: 0.13, pan });
        this.noise({ filter: 'bandpass', freq: 620 * p, q: 2.2, dur: 0.12, gain: 0.2, pan, reverb: 0.08 });
        break;
      case 'metal':
        this.tone({ type: 'square', freq: 520 * p, freqEnd: 300 * p, dur: 0.1, gain: 0.1, pan });
        this.tone({ type: 'sine', freq: 1420 * p, dur: 0.35, gain: 0.09, decay: 0.35, pan, reverb: 0.3 });
        this.noise({ filter: 'bandpass', freq: 3400 * p, q: 3, dur: 0.16, gain: 0.13, pan });
        break;
      case 'glass':
        for (let i = 0; i < 5; i++) {
          this.tone({ type: 'sine', freq: (1800 + Math.random() * 3400) * p, dur: 0.13, gain: 0.075, decay: 0.13, when: i * 0.014, pan, reverb: 0.25 });
        }
        this.noise({ filter: 'highpass', freq: 4200, dur: 0.18, gain: 0.16, pan });
        break;
      case 'crystal':
        this.tone({ type: 'sine', freq: 880 * p, dur: 0.5, gain: 0.13, decay: 0.5, pan, reverb: 0.45 });
        this.tone({ type: 'sine', freq: 1320 * p, dur: 0.42, gain: 0.09, decay: 0.42, when: 0.01, pan, reverb: 0.4 });
        this.tone({ type: 'triangle', freq: 2640 * p, dur: 0.3, gain: 0.05, decay: 0.3, when: 0.02, pan, reverb: 0.5 });
        this.noise({ filter: 'highpass', freq: 5200, dur: 0.12, gain: 0.1, pan });
        break;
      case 'snow':
        this.noise({ filter: 'lowpass', freq: 900 * p, freqEnd: 300, dur: 0.14, gain: 0.2, pan });
        break;
      case 'water':
        this.noise({ filter: 'bandpass', freq: 700 * p, freqEnd: 1800, q: 1.2, dur: 0.22, gain: 0.2, pan, reverb: 0.2 });
        break;
      default: // stone
        this.noise({ filter: 'bandpass', freq: 1100 * p, freqEnd: 420 * p, q: 1.1, dur: 0.16, gain: 0.3, pan, reverb: 0.12 });
        this.tone({ type: 'triangle', freq: 150 * p, freqEnd: 70, dur: 0.1, gain: 0.14, pan });
        break;
    }
  }

  blockPlace(material = 'stone', pan = 0) {
    if (!this.enabled) return;
    const p = 0.9 + Math.random() * 0.24;
    this.blockBreakQuiet(material, p, pan);
  }

  blockBreakQuiet(material, p, pan) {
    switch (material) {
      case 'wood': this.tone({ type: 'triangle', freq: 180 * p, freqEnd: 110 * p, dur: 0.09, gain: 0.16, pan }); break;
      case 'metal': this.tone({ type: 'square', freq: 420 * p, freqEnd: 260 * p, dur: 0.07, gain: 0.07, pan }); this.noise({ filter: 'bandpass', freq: 2800, q: 3, dur: 0.09, gain: 0.08, pan }); break;
      case 'glass': this.tone({ type: 'sine', freq: 2400 * p, dur: 0.1, gain: 0.07, pan, reverb: 0.2 }); break;
      case 'grass': case 'plant': this.noise({ filter: 'highpass', freq: 1300 * p, dur: 0.08, gain: 0.13, pan }); break;
      case 'sand': this.noise({ filter: 'bandpass', freq: 1500 * p, q: 0.8, dur: 0.1, gain: 0.14, pan }); break;
      default: this.noise({ filter: 'bandpass', freq: 900 * p, freqEnd: 420, q: 1.2, dur: 0.1, gain: 0.18, pan }); this.tone({ type: 'triangle', freq: 130 * p, freqEnd: 80, dur: 0.08, gain: 0.1, pan }); break;
    }
  }

  footstep(material = 'stone', sprint = false) {
    if (!this.enabled) return;
    const now = this.t;
    if (now - this.lastStep < 0.12) return;
    this.lastStep = now;
    const p = 0.82 + Math.random() * 0.34;
    const g = (sprint ? 0.16 : 0.11);
    const pan = (Math.random() - 0.5) * 0.35;
    switch (material) {
      case 'grass': case 'plant':
        this.noise({ filter: 'bandpass', freq: 1400 * p, q: 0.8, dur: 0.09, gain: g * 0.9, pan });
        this.noise({ filter: 'lowpass', freq: 320, dur: 0.07, gain: g * 0.5, pan });
        break;
      case 'sand': this.noise({ filter: 'bandpass', freq: 1750 * p, q: 0.7, dur: 0.12, gain: g, pan }); break;
      case 'snow': this.noise({ filter: 'lowpass', freq: 700 * p, freqEnd: 260, dur: 0.11, gain: g, pan }); break;
      case 'wood': this.tone({ type: 'triangle', freq: 150 * p, freqEnd: 95, dur: 0.07, gain: g * 0.8, pan }); this.noise({ filter: 'bandpass', freq: 520 * p, q: 2, dur: 0.06, gain: g * 0.6, pan }); break;
      case 'metal': this.tone({ type: 'square', freq: 300 * p, freqEnd: 190, dur: 0.05, gain: g * 0.4, pan }); this.noise({ filter: 'bandpass', freq: 2400, q: 2.5, dur: 0.08, gain: g * 0.5, pan, reverb: 0.15 }); break;
      case 'water': this.noise({ filter: 'bandpass', freq: 900 * p, freqEnd: 2200, q: 1, dur: 0.16, gain: g * 1.1, pan, reverb: 0.2 }); break;
      default:
        this.noise({ filter: 'bandpass', freq: 900 * p, freqEnd: 400, q: 1.1, dur: 0.08, gain: g, pan });
        this.tone({ type: 'triangle', freq: 120 * p, freqEnd: 70, dur: 0.06, gain: g * 0.7, pan });
        break;
    }
  }

  itemPickup(high = false) {
    if (!this.enabled) return;
    const base = high ? 720 : 520;
    const p = 0.95 + Math.random() * 0.18;
    this.tone({ type: 'sine', freq: base * p, freqEnd: base * 2 * p, dur: 0.11, gain: 0.15, attack: 0.004, decay: 0.11, bus: 'ui', reverb: 0.12 });
    this.tone({ type: 'triangle', freq: base * 1.5 * p, freqEnd: base * 3 * p, dur: 0.08, gain: 0.07, bus: 'ui' });
  }

  hurt() {
    if (!this.enabled) return;
    this.tone({ type: 'sawtooth', freq: 320, freqEnd: 110, dur: 0.22, gain: 0.2, filter: 'lowpass', filterFreq: 1400, filterEnd: 380 });
    this.noise({ filter: 'bandpass', freq: 700, freqEnd: 220, q: 1.1, dur: 0.2, gain: 0.16 });
    this.tone({ type: 'sine', freq: 90, freqEnd: 50, dur: 0.3, gain: 0.22 });
  }

  shieldHit() {
    if (!this.enabled) return;
    this.tone({ type: 'square', freq: 1500, freqEnd: 420, dur: 0.14, gain: 0.09, filter: 'bandpass', filterFreq: 2200, q: 4, reverb: 0.3 });
    this.noise({ filter: 'highpass', freq: 2600, dur: 0.12, gain: 0.12 });
    this.tone({ type: 'sine', freq: 180, freqEnd: 90, dur: 0.2, gain: 0.14 });
  }

  /* ------------------------------------------------------------------ *
   *  No Man's Sky style UI
   * ------------------------------------------------------------------ */
  uiHover() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 3200, q: 6, dur: 0.035, gain: 0.05, bus: 'ui' });
    this.tone({ type: 'sine', freq: 2100, dur: 0.04, gain: 0.028, bus: 'ui' });
  }

  uiClick() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 4200, q: 8, dur: 0.03, gain: 0.09, bus: 'ui' });
    this.tone({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.07, gain: 0.09, bus: 'ui', reverb: 0.16 });
    this.tone({ type: 'triangle', freq: 2640, dur: 0.05, gain: 0.04, bus: 'ui' });
  }

  uiBack() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 900, freqEnd: 480, dur: 0.1, gain: 0.09, bus: 'ui', reverb: 0.14 });
    this.noise({ filter: 'bandpass', freq: 2200, q: 5, dur: 0.04, gain: 0.05, bus: 'ui' });
  }

  uiError() {
    if (!this.enabled) return;
    this.tone({ type: 'square', freq: 220, dur: 0.09, gain: 0.08, bus: 'ui', filter: 'lowpass', filterFreq: 1200 });
    this.tone({ type: 'square', freq: 165, dur: 0.13, gain: 0.08, when: 0.1, bus: 'ui', filter: 'lowpass', filterFreq: 900 });
  }

  uiOpen() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 600, freqEnd: 4200, q: 0.9, dur: 0.3, gain: 0.1, bus: 'ui', reverb: 0.3 });
    this.tone({ type: 'sine', freq: 330, freqEnd: 990, dur: 0.22, gain: 0.07, bus: 'ui' });
    this.tone({ type: 'sine', freq: 1320, dur: 0.3, gain: 0.04, when: 0.06, bus: 'ui', reverb: 0.4, delay: 0.2 });
  }

  uiClose() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 3800, freqEnd: 500, q: 0.9, dur: 0.26, gain: 0.09, bus: 'ui', reverb: 0.2 });
    this.tone({ type: 'sine', freq: 880, freqEnd: 280, dur: 0.2, gain: 0.06, bus: 'ui' });
  }

  /** hold-to-confirm charge, returns a handle you must stop() */
  startCharge() {
    if (!this.enabled) return null;
    const ctx = this.ctx, t0 = this.t;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.linearRampToValueAtTime(760, t0 + 1.1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(500, t0);
    f.frequency.linearRampToValueAtTime(2600, t0 + 1.1);
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.075, t0 + 0.12);
    osc.connect(f); f.connect(g); g.connect(this.ui);
    const rs = ctx.createGain(); rs.gain.value = 0.25; g.connect(rs); rs.connect(this.revSend);
    osc.start(t0);
    return {
      stop: (success) => {
        const t = this.t;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        osc.stop(t + 0.12);
        if (success) this.confirm();
      },
    };
  }

  confirm() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 660, dur: 0.16, gain: 0.13, bus: 'ui', reverb: 0.3 });
    this.tone({ type: 'sine', freq: 990, dur: 0.24, gain: 0.1, when: 0.05, bus: 'ui', reverb: 0.35, delay: 0.15 });
    this.tone({ type: 'triangle', freq: 1320, dur: 0.3, gain: 0.06, when: 0.1, bus: 'ui', reverb: 0.4 });
    this.noise({ filter: 'highpass', freq: 5000, dur: 0.12, gain: 0.05, bus: 'ui' });
  }

  questComplete() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'sine', freq: f, dur: 0.7, gain: 0.11, when: i * 0.11, decay: 0.7, bus: 'ui', reverb: 0.5, bigReverb: true });
      this.tone({ type: 'triangle', freq: f * 2, dur: 0.4, gain: 0.04, when: i * 0.11, bus: 'ui', reverb: 0.4 });
    });
    this.noise({ filter: 'highpass', freq: 4000, dur: 0.5, gain: 0.05, bus: 'ui', reverb: 0.5 });
  }

  discovery() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 440, freqEnd: 880, dur: 0.5, gain: 0.1, bus: 'ui', reverb: 0.5, bigReverb: true, sweepTime: 0.4 });
    this.tone({ type: 'sine', freq: 1320, dur: 0.6, gain: 0.05, when: 0.12, bus: 'ui', reverb: 0.6, bigReverb: true, delay: 0.25 });
    this.noise({ filter: 'bandpass', freq: 2000, freqEnd: 6000, q: 1.4, dur: 0.45, gain: 0.06, bus: 'ui', reverb: 0.4 });
  }

  /* ------------------------------------------------------------------ *
   *  Multi-tool
   * ------------------------------------------------------------------ */
  startMiningBeam() {
    if (!this.enabled) return null;
    if (this.loops.has('beam')) return this.loops.get('beam');
    const ctx = this.ctx, t0 = this.t;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
    out.connect(this.sfx);
    const rs = ctx.createGain(); rs.gain.value = 0.2; out.connect(rs); rs.connect(this.revSend);

    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 78;
    const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = 156; sq.detune.value = 8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 6;
    const sizzle = ctx.createBufferSource(); sizzle.buffer = this.noiseBuffer(2); sizzle.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3600; hp.Q.value = 1.4;
    const sizzleG = ctx.createGain(); sizzleG.gain.value = 0.16;
    // wobble
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 17;
    const lfoG = ctx.createGain(); lfoG.gain.value = 320;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 8.5;
    const tremG = ctx.createGain(); tremG.gain.value = 0.05;
    const tremTarget = ctx.createGain(); tremTarget.gain.value = 1;
    trem.connect(tremG); tremG.connect(tremTarget.gain);

    saw.connect(lp); sq.connect(lp); lp.connect(tremTarget); tremTarget.connect(out);
    sizzle.connect(hp); hp.connect(sizzleG); sizzleG.connect(out);
    saw.start(t0); sq.start(t0); lfo.start(t0); trem.start(t0); sizzle.start(t0);
    const handle = {
      out, lp, saw, sq,
      setHeat: (h) => {
        const t = this.t;
        lp.frequency.setTargetAtTime(700 + h * 1800, t, 0.08);
        saw.frequency.setTargetAtTime(78 + h * 44, t, 0.1);
        sizzleG.gain.setTargetAtTime(0.14 + h * 0.22, t, 0.1);
      },
      stop: () => {
        const t = this.t;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        saw.frequency.setTargetAtTime(40, t, 0.05);
        [saw, sq, lfo, trem, sizzle].forEach((n) => n.stop(t + 0.2));
        this.loops.delete('beam');
      },
    };
    this.loops.set('beam', handle);
    return handle;
  }

  stopMiningBeam() { const h = this.loops.get('beam'); if (h) h.stop(); }

  beamOverheat() {
    if (!this.enabled) return;
    this.tone({ type: 'square', freq: 1200, freqEnd: 300, dur: 0.3, gain: 0.1, filter: 'lowpass', filterFreq: 2400 });
    this.noise({ filter: 'bandpass', freq: 5000, freqEnd: 1200, q: 1, dur: 0.6, gain: 0.14, reverb: 0.3 });
    for (let i = 0; i < 3; i++) this.tone({ type: 'square', freq: 880, dur: 0.06, gain: 0.07, when: 0.1 + i * 0.14, bus: 'ui' });
  }

  scanPing() {
    if (!this.enabled) return;
    // NMS sonar ping: bright transient + descending sine tail + big reverb
    this.tone({ type: 'sine', freq: 1500, freqEnd: 320, dur: 1.1, gain: 0.16, decay: 1.1, sweepTime: 0.9, reverb: 0.7, bigReverb: true, bus: 'ui' });
    this.tone({ type: 'sine', freq: 2250, freqEnd: 640, dur: 0.7, gain: 0.07, decay: 0.7, sweepTime: 0.6, reverb: 0.6, bigReverb: true, bus: 'ui', delay: 0.3 });
    this.noise({ filter: 'bandpass', freq: 3200, freqEnd: 700, q: 2.2, dur: 0.5, gain: 0.08, reverb: 0.5, bigReverb: true, bus: 'ui' });
    this.tone({ type: 'sine', freq: 80, dur: 0.5, gain: 0.12, bus: 'ui' });
  }

  visorOn() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 400, freqEnd: 3800, q: 1.1, dur: 0.35, gain: 0.1, bus: 'ui', reverb: 0.25 });
    this.tone({ type: 'sawtooth', freq: 120, freqEnd: 620, dur: 0.3, gain: 0.05, filter: 'lowpass', filterFreq: 900, filterEnd: 3200, bus: 'ui' });
    this.tone({ type: 'sine', freq: 1760, dur: 0.18, gain: 0.05, when: 0.16, bus: 'ui', reverb: 0.3 });
  }

  visorOff() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 3400, freqEnd: 380, q: 1.1, dur: 0.3, gain: 0.08, bus: 'ui' });
    this.tone({ type: 'sine', freq: 880, freqEnd: 220, dur: 0.2, gain: 0.05, bus: 'ui' });
  }

  analyseComplete() {
    if (!this.enabled) return;
    [880, 1174.7, 1760].forEach((f, i) => this.tone({ type: 'sine', freq: f, dur: 0.45, gain: 0.09, when: i * 0.07, bus: 'ui', reverb: 0.55, bigReverb: true }));
    this.noise({ filter: 'highpass', freq: 4600, dur: 0.3, gain: 0.05, bus: 'ui', reverb: 0.4 });
  }

  /* ------------------------------------------------------------------ *
   *  Jetpack / player
   * ------------------------------------------------------------------ */
  startJetpack() {
    if (!this.enabled) return null;
    if (this.loops.has('jet')) return this.loops.get('jet');
    const ctx = this.ctx, t0 = this.t;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(2, true); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.24, t0 + 0.08);
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(this.sfx);
    const rs = ctx.createGain(); rs.gain.value = 0.2; g.connect(rs); rs.connect(this.revSend);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 62;
    const subG = ctx.createGain(); subG.gain.value = 0.09;
    sub.connect(subG); subG.connect(this.sfx);
    src.start(t0); sub.start(t0);
    const handle = {
      stop: () => {
        const t = this.t;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        subG.gain.setTargetAtTime(0.0001, t, 0.06);
        src.stop(t + 0.25); sub.stop(t + 0.25);
        this.loops.delete('jet');
      },
    };
    this.loops.set('jet', handle);
    return handle;
  }
  stopJetpack() { const h = this.loops.get('jet'); if (h) h.stop(); }

  lowResourceAlarm(kind = 'life') {
    if (!this.enabled) return;
    const f = kind === 'life' ? 1180 : 880;
    this.tone({ type: 'square', freq: f, dur: 0.09, gain: 0.06, bus: 'ui', filter: 'lowpass', filterFreq: 3000 });
    this.tone({ type: 'square', freq: f, dur: 0.09, gain: 0.06, when: 0.16, bus: 'ui', filter: 'lowpass', filterFreq: 3000 });
  }

  heartbeat() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 62, freqEnd: 40, dur: 0.22, gain: 0.3 });
    this.tone({ type: 'sine', freq: 54, freqEnd: 34, dur: 0.26, gain: 0.22, when: 0.3 });
  }

  /* ------------------------------------------------------------------ *
   *  Ship
   * ------------------------------------------------------------------ */
  startShipEngine() {
    if (!this.enabled) return null;
    if (this.loops.has('ship')) return this.loops.get('ship');
    const ctx = this.ctx, t0 = this.t;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.2, t0 + 0.9);
    out.connect(this.sfx);
    const rs = ctx.createGain(); rs.gain.value = 0.3; out.connect(rs); rs.connect(this.revSendBig);

    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 44;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 66; o2.detune.value = -12;
    const o3 = ctx.createOscillator(); o3.type = 'square'; o3.frequency.value = 22;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3;
    const air = ctx.createBufferSource(); air.buffer = this.noiseBuffer(2, true); air.loop = true;
    const airF = ctx.createBiquadFilter(); airF.type = 'bandpass'; airF.frequency.value = 520; airF.Q.value = 0.7;
    const airG = ctx.createGain(); airG.gain.value = 0.12;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.28;
    const lfoG = ctx.createGain(); lfoG.gain.value = 60;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(out);
    air.connect(airF); airF.connect(airG); airG.connect(out);
    [o1, o2, o3, lfo, air].forEach((n) => n.start(t0));
    const handle = {
      setThrottle: (v, speed = 0) => {
        const t = this.t;
        const f = 40 + v * 62 + speed * 0.5;
        o1.frequency.setTargetAtTime(f, t, 0.18);
        o2.frequency.setTargetAtTime(f * 1.5, t, 0.18);
        o3.frequency.setTargetAtTime(f * 0.5, t, 0.2);
        lp.frequency.setTargetAtTime(340 + v * 1500, t, 0.15);
        airG.gain.setTargetAtTime(0.07 + v * 0.28, t, 0.15);
        out.gain.setTargetAtTime(0.14 + v * 0.16, t, 0.2);
      },
      stop: () => {
        const t = this.t;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        [o1, o2, o3, lfo, air].forEach((n) => n.stop(t + 1.0));
        this.loops.delete('ship');
      },
    };
    this.loops.set('ship', handle);
    return handle;
  }
  stopShipEngine() { const h = this.loops.get('ship'); if (h) h.stop(); }

  shipTakeoff() {
    if (!this.enabled) return;
    this.noise({ brown: true, filter: 'lowpass', freq: 180, freqEnd: 2600, q: 1, dur: 2.4, gain: 0.4, attack: 0.6, reverb: 0.4, bigReverb: true });
    this.tone({ type: 'sine', freq: 30, freqEnd: 70, dur: 2.2, gain: 0.5, attack: 0.5, sweepTime: 2 });
    this.tone({ type: 'sawtooth', freq: 55, freqEnd: 180, dur: 2.4, gain: 0.12, filter: 'lowpass', filterFreq: 400, filterEnd: 2200, sweepTime: 2.2 });
    this.noise({ filter: 'highpass', freq: 3000, dur: 1.4, gain: 0.1, attack: 0.8 });
  }

  shipLandingGear() {
    if (!this.enabled) return;
    this.tone({ type: 'sawtooth', freq: 320, freqEnd: 90, dur: 0.55, gain: 0.07, filter: 'lowpass', filterFreq: 1400, filterEnd: 400 });
    this.noise({ filter: 'bandpass', freq: 900, q: 2, dur: 0.5, gain: 0.07 });
    this.tone({ type: 'square', freq: 120, dur: 0.1, gain: 0.05, when: 0.5 });
  }

  shipLandThud() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 70, freqEnd: 34, dur: 0.6, gain: 0.42 });
    this.noise({ brown: true, filter: 'lowpass', freq: 400, freqEnd: 120, dur: 0.5, gain: 0.3, reverb: 0.3 });
    this.noise({ filter: 'bandpass', freq: 2200, q: 2, dur: 0.2, gain: 0.1 });
    this.tone({ type: 'square', freq: 180, freqEnd: 90, dur: 0.14, gain: 0.06, when: 0.05 });
  }

  cockpitEnter() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 700, freqEnd: 240, q: 1.4, dur: 0.5, gain: 0.16, reverb: 0.2 });
    this.tone({ type: 'square', freq: 200, freqEnd: 110, dur: 0.16, gain: 0.06, when: 0.3 });
    this.tone({ type: 'sine', freq: 660, dur: 0.2, gain: 0.05, when: 0.42, bus: 'ui', reverb: 0.3 });
    this.tone({ type: 'sine', freq: 990, dur: 0.3, gain: 0.04, when: 0.52, bus: 'ui', reverb: 0.3 });
  }

  startPulseDrive() {
    if (!this.enabled) return null;
    if (this.loops.has('pulse')) return this.loops.get('pulse');
    const ctx = this.ctx, t0 = this.t;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.3, t0 + 0.6);
    out.connect(this.sfx);
    const rs = ctx.createGain(); rs.gain.value = 0.4; out.connect(rs); rs.connect(this.revSendBig);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(2, true); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(2400, t0 + 2.5);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(70, t0);
    o1.frequency.exponentialRampToValueAtTime(240, t0 + 2.5);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(35, t0);
    o2.frequency.exponentialRampToValueAtTime(60, t0 + 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    src.connect(bp); bp.connect(out);
    o1.connect(lp); lp.connect(out); o2.connect(out);
    [src, o1, o2].forEach((n) => n.start(t0));
    const handle = {
      stop: () => {
        const t = this.t;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        bp.frequency.setTargetAtTime(200, t, 0.2);
        [src, o1, o2].forEach((n) => n.stop(t + 0.7));
        this.loops.delete('pulse');
      },
    };
    this.loops.set('pulse', handle);
    return handle;
  }
  stopPulseDrive() { const h = this.loops.get('pulse'); if (h) h.stop(); }

  atmosphereEntry(dur = 7) {
    if (!this.enabled) return;
    // deep rumble that swells, plasma roar, crackles, then a release whoosh
    this.tone({ type: 'sine', freq: 28, freqEnd: 46, dur: dur * 0.8, gain: 0.55, attack: 1.6, sweepTime: dur * 0.7 });
    this.noise({ brown: true, filter: 'lowpass', freq: 220, freqEnd: 1800, q: 0.8, dur: dur * 0.85, gain: 0.42, attack: 1.8, reverb: 0.3, bigReverb: true });
    this.noise({ filter: 'bandpass', freq: 1400, freqEnd: 5200, q: 0.8, dur: dur * 0.7, gain: 0.2, attack: 2.2 });
    for (let i = 0; i < 26; i++) {
      const w = 0.6 + Math.random() * (dur * 0.7);
      this.noise({ filter: 'bandpass', freq: 1800 + Math.random() * 4200, q: 6, dur: 0.06, gain: 0.05 + Math.random() * 0.06, when: w, pan: (Math.random() - 0.5) * 1.4 });
    }
    // break-through whoosh
    this.noise({ filter: 'lowpass', freq: 5000, freqEnd: 300, q: 0.7, dur: 2.2, gain: 0.3, when: dur * 0.72, attack: 0.12, reverb: 0.5, bigReverb: true });
    this.tone({ type: 'sine', freq: 60, freqEnd: 24, dur: 2.4, gain: 0.3, when: dur * 0.72 });
  }

  atmosphereExit(dur = 6) {
    if (!this.enabled) return;
    this.noise({ brown: true, filter: 'lowpass', freq: 1600, freqEnd: 120, q: 0.8, dur: dur * 0.9, gain: 0.34, attack: 0.8, reverb: 0.4, bigReverb: true });
    this.tone({ type: 'sine', freq: 52, freqEnd: 22, dur: dur * 0.9, gain: 0.4, attack: 0.6 });
    this.tone({ type: 'sawtooth', freq: 120, freqEnd: 40, dur: dur * 0.8, gain: 0.08, filter: 'lowpass', filterFreq: 1200, filterEnd: 200 });
    // silence-of-space swell
    this.tone({ type: 'sine', freq: 220, dur: 3.5, gain: 0.05, when: dur * 0.65, attack: 1.5, reverb: 0.8, bigReverb: true });
    this.tone({ type: 'sine', freq: 330, dur: 4, gain: 0.04, when: dur * 0.7, attack: 1.8, reverb: 0.8, bigReverb: true });
  }

  warpJump() {
    if (!this.enabled) return;
    // charge
    this.tone({ type: 'sawtooth', freq: 60, freqEnd: 900, dur: 2.6, gain: 0.12, filter: 'lowpass', filterFreq: 400, filterEnd: 5000, sweepTime: 2.4, reverb: 0.4, bigReverb: true });
    this.noise({ filter: 'bandpass', freq: 200, freqEnd: 6000, q: 1.2, dur: 2.6, gain: 0.2, attack: 1.6 });
    for (let i = 0; i < 10; i++) {
      this.tone({ type: 'sine', freq: 220 * Math.pow(1.2, i), dur: 0.3, gain: 0.05, when: 0.2 + i * 0.2, bus: 'ui', reverb: 0.5, bigReverb: true, delay: 0.3 });
    }
    // jump
    this.noise({ brown: true, filter: 'lowpass', freq: 6000, freqEnd: 90, q: 0.7, dur: 3.2, gain: 0.45, when: 2.6, attack: 0.05, reverb: 0.6, bigReverb: true });
    this.tone({ type: 'sine', freq: 140, freqEnd: 20, dur: 3.4, gain: 0.5, when: 2.6, sweepTime: 3 });
    this.tone({ type: 'sine', freq: 880, freqEnd: 110, dur: 2.4, gain: 0.1, when: 2.6, reverb: 0.7, bigReverb: true });
  }

  sentinelAlert() {
    if (!this.enabled) return;
    [1046, 830, 660].forEach((f, i) => {
      this.tone({ type: 'square', freq: f, dur: 0.18, gain: 0.1, when: i * 0.17, filter: 'lowpass', filterFreq: 2600, reverb: 0.3 });
    });
    this.noise({ filter: 'bandpass', freq: 3000, freqEnd: 900, q: 3, dur: 0.5, gain: 0.1, when: 0.1 });
    this.tone({ type: 'sine', freq: 70, dur: 0.8, gain: 0.2, when: 0.4 });
  }

  sentinelScan() {
    if (!this.enabled) return;
    this.tone({ type: 'sine', freq: 620, freqEnd: 1240, dur: 0.5, gain: 0.06, sweepTime: 0.45, reverb: 0.4 });
    this.tone({ type: 'sine', freq: 1240, freqEnd: 620, dur: 0.5, gain: 0.05, when: 0.5, sweepTime: 0.45, reverb: 0.4 });
  }

  laserShot(pan = 0) {
    if (!this.enabled) return;
    this.tone({ type: 'square', freq: 1800, freqEnd: 200, dur: 0.16, gain: 0.1, filter: 'bandpass', filterFreq: 2400, q: 3, pan, reverb: 0.25 });
    this.noise({ filter: 'bandpass', freq: 4000, freqEnd: 800, q: 2, dur: 0.12, gain: 0.1, pan });
    this.tone({ type: 'sine', freq: 120, freqEnd: 60, dur: 0.14, gain: 0.1, pan });
  }

  explosion(size = 1) {
    if (!this.enabled) return;
    this.noise({ brown: true, filter: 'lowpass', freq: 900 * size, freqEnd: 90, q: 0.8, dur: 1.2 * size, gain: 0.4, reverb: 0.5, bigReverb: true });
    this.tone({ type: 'sine', freq: 90 * size, freqEnd: 24, dur: 1.1 * size, gain: 0.45 });
    this.noise({ filter: 'highpass', freq: 2400, dur: 0.3, gain: 0.16 });
  }

  creatureCall(seed = 0.5, hostile = false) {
    if (!this.enabled) return;
    const base = hostile ? 120 + seed * 160 : 260 + seed * 700;
    const n = 2 + Math.floor(seed * 3);
    for (let i = 0; i < n; i++) {
      const f = base * (1 + (Math.random() - 0.5) * 0.4);
      this.tone({
        type: hostile ? 'sawtooth' : (seed > 0.5 ? 'triangle' : 'sine'),
        freq: f, freqEnd: f * (0.6 + Math.random() * 1.1),
        dur: 0.12 + Math.random() * 0.22, gain: 0.075, when: i * (0.09 + Math.random() * 0.13),
        filter: 'bandpass', filterFreq: f * 2.2, q: 2.5,
        pan: (Math.random() - 0.5) * 1.2, reverb: 0.45, bigReverb: true,
      });
    }
  }

  teleport() {
    if (!this.enabled) return;
    this.noise({ filter: 'bandpass', freq: 600, freqEnd: 7000, q: 1.5, dur: 0.8, gain: 0.18, reverb: 0.6, bigReverb: true });
    for (let i = 0; i < 8; i++) this.tone({ type: 'sine', freq: 300 * Math.pow(1.3, i), dur: 0.25, gain: 0.05, when: i * 0.06, bus: 'ui', reverb: 0.6, bigReverb: true, delay: 0.3 });
  }

  refinerLoop(on) {
    if (!this.enabled) return;
    if (on) {
      if (this.loops.has('refiner')) return;
      const ctx = this.ctx, t0 = this.t;
      const out = ctx.createGain(); out.gain.value = 0.0001;
      out.gain.exponentialRampToValueAtTime(0.1, t0 + 0.3);
      out.connect(this.sfx);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 96;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 4;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 3.2;
      const lfoG = ctx.createGain(); lfoG.gain.value = 180;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(2, true); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1;
      const ng = ctx.createGain(); ng.gain.value = 0.06;
      o.connect(lp); lp.connect(out); src.connect(bp); bp.connect(ng); ng.connect(out);
      [o, lfo, src].forEach((n) => n.start(t0));
      this.loops.set('refiner', { stop: () => {
        const t = this.t;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        [o, lfo, src].forEach((n) => n.stop(t + 0.4));
        this.loops.delete('refiner');
      } });
    } else {
      const h = this.loops.get('refiner'); if (h) h.stop();
    }
  }

  /* ------------------------------------------------------------------ *
   *  Ambience beds
   * ------------------------------------------------------------------ */
  startAmbience(kind = 'lush', hazard = 'none') {
    this.stopAmbience();
    if (!this.enabled) return;
    const ctx = this.ctx, t0 = this.t;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.5, t0 + 2.5);
    out.connect(this.amb);

    const nodes = [];
    // wind bed
    const wind = ctx.createBufferSource(); wind.buffer = this.noiseBuffer(2, true); wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass';
    wf.frequency.value = kind === 'frozen' ? 900 : kind === 'volcanic' ? 260 : 480;
    wf.Q.value = 1.2;
    const wg = ctx.createGain(); wg.gain.value = kind === 'barren' ? 0.1 : 0.2;
    const wlfo = ctx.createOscillator(); wlfo.type = 'sine'; wlfo.frequency.value = 0.07;
    const wlfoG = ctx.createGain(); wlfoG.gain.value = kind === 'frozen' ? 420 : 200;
    wlfo.connect(wlfoG); wlfoG.connect(wf.frequency);
    const wamp = ctx.createOscillator(); wamp.type = 'sine'; wamp.frequency.value = 0.045;
    const wampG = ctx.createGain(); wampG.gain.value = 0.09;
    wamp.connect(wampG); wampG.connect(wg.gain);
    wind.connect(wf); wf.connect(wg); wg.connect(out);
    nodes.push(wind, wlfo, wamp);

    // planet-specific drone
    const droneFreq = { lush: 110, desert: 82, frozen: 146, toxic: 92, radioactive: 138, volcanic: 55, exotic: 174, barren: 65 }[kind] || 110;
    const d1 = ctx.createOscillator(); d1.type = 'sine'; d1.frequency.value = droneFreq;
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = droneFreq * 1.5; d2.detune.value = 6;
    const dg = ctx.createGain(); dg.gain.value = 0.035;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 700;
    d1.connect(dlp); d2.connect(dlp); dlp.connect(dg); dg.connect(out);
    const rs = ctx.createGain(); rs.gain.value = 0.5; dg.connect(rs); rs.connect(this.revSendBig);
    nodes.push(d1, d2);

    nodes.forEach((n) => n.start(t0));

    // sporadic critters / geology
    let alive = true;
    const chirp = () => {
      if (!alive) return;
      const gap = 2.5 + Math.random() * 7;
      if (kind === 'volcanic') {
        this.noise({ brown: true, filter: 'lowpass', freq: 200, freqEnd: 60, dur: 1.6, gain: 0.12, bus: 'amb', reverb: 0.5, bigReverb: true });
      } else if (kind === 'frozen') {
        this.tone({ type: 'sine', freq: 1200 + Math.random() * 1800, dur: 1.2, gain: 0.02, bus: 'amb', reverb: 0.7, bigReverb: true, attack: 0.4 });
      } else if (kind === 'barren') {
        this.tone({ type: 'sine', freq: 60 + Math.random() * 40, dur: 2.4, gain: 0.05, bus: 'amb', attack: 1.0, reverb: 0.6, bigReverb: true });
      } else {
        this.creatureCall(Math.random(), false);
      }
      this._ambTimer = setTimeout(chirp, gap * 1000);
    };
    this._ambTimer = setTimeout(chirp, 3000);

    this.loops.set('amb', {
      stop: () => {
        alive = false;
        clearTimeout(this._ambTimer);
        const t = this.t;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        nodes.forEach((n) => { try { n.stop(t + 1.4); } catch (e) { /* */ } });
        this.loops.delete('amb');
      },
      setUnderground: (v) => {
        wf.frequency.setTargetAtTime(v ? 160 : 480, this.t, 0.6);
        dg.gain.setTargetAtTime(v ? 0.06 : 0.035, this.t, 0.6);
      },
    });
  }

  stopAmbience() { const h = this.loops.get('amb'); if (h) h.stop(); }

  startSpaceAmbience() {
    this.stopAmbience();
    if (!this.enabled) return;
    const ctx = this.ctx, t0 = this.t;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.45, t0 + 3);
    out.connect(this.amb);
    const nodes = [];
    const freqs = [55, 82.5, 110, 164.8];
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      const g = ctx.createGain(); g.gain.value = 0.02 + Math.random() * 0.02;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.02 + Math.random() * 0.05;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.014;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      o.connect(g); g.connect(out);
      nodes.push(o, lfo);
    }
    const hiss = ctx.createBufferSource(); hiss.buffer = this.noiseBuffer(2, true); hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3400; hf.Q.value = 0.5;
    const hg = ctx.createGain(); hg.gain.value = 0.018;
    hiss.connect(hf); hf.connect(hg); hg.connect(out);
    nodes.push(hiss);
    const rs = ctx.createGain(); rs.gain.value = 0.6; out.connect(rs); rs.connect(this.revSendBig);
    nodes.forEach((n) => n.start(t0));
    this.loops.set('amb', {
      stop: () => {
        const t = this.t;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        nodes.forEach((n) => { try { n.stop(t + 1.7); } catch (e) { /* */ } });
        this.loops.delete('amb');
      },
      setUnderground: () => {},
    });
  }

  setUnderground(v) { const h = this.loops.get('amb'); if (h && h.setUnderground) h.setUnderground(v); }

  /** muffle everything when the helmet goes under water */
  setUnderwater(on) {
    if (!this.enabled) return;
    if (this._uw === on) return;
    this._uw = on;
    this.masterFilter.frequency.setTargetAtTime(on ? 620 : 20000, this.t, 0.25);
    this.masterFilter.Q.setTargetAtTime(on ? 1.6 : 0.4, this.t, 0.25);
    if (on) this.noise({ filter: 'lowpass', freq: 500, dur: 0.7, gain: 0.18, reverb: 0.3 });
  }

  /** airflow layer for atmospheric flight; level 0..1 */
  startWind() {
    if (!this.enabled) return null;
    if (this.loops.has('wind')) return this.loops.get('wind');
    const ctx = this.ctx, t0 = this.t;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(2, true); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(this.sfx);
    src.start(t0);
    const handle = {
      setLevel: (v) => {
        const t = this.t;
        g.gain.setTargetAtTime(Math.max(0.0001, v * 0.3), t, 0.2);
        bp.frequency.setTargetAtTime(320 + v * 1500, t, 0.25);
      },
      stop: () => {
        const t = this.t;
        g.gain.setTargetAtTime(0.0001, t, 0.15);
        src.stop(t + 0.6);
        this.loops.delete('wind');
      },
    };
    this.loops.set('wind', handle);
    return handle;
  }
  stopWind() { const h = this.loops.get('wind'); if (h) h.stop(); }

  stopAll() {
    for (const [, h] of this.loops) { try { h.stop(); } catch (e) { /* */ } }
    this.loops.clear();
  }
}

export const audio = new AudioEngine();
