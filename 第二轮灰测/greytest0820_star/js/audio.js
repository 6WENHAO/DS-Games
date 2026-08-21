/* ==========================================================================
 * audio.js — everything you hear is synthesised at runtime (no asset files).
 *  - engine: layered saw/square oscillators + noise, driven by rpm and load
 *  - gun:    noise burst + descending sine thump + crack
 *  - metal:  short filtered blips for switches, breech, hatches, loading
 * ==========================================================================*/
(function (global) {
  'use strict';

  class Sfx {
    constructor() {
      this.ctx = null;
      this.ready = false;
      this.muted = false;
      this.interior = false;
      this.noiseBuf = null;
    }

    ensure() {
      if (this.ready) return true;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); } catch (e) { return false; }
      const ctx = this.ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
      if (this.comp) {
        this.comp.threshold.value = -18;
        this.comp.ratio.value = 6;
        this.comp.connect(ctx.destination);
        this.master.connect(this.comp);
      } else {
        this.master.connect(ctx.destination);
      }

      // muffling filter used when the crew is buttoned up inside
      this.cabin = ctx.createBiquadFilter();
      this.cabin.type = 'lowpass';
      this.cabin.frequency.value = 20000;
      this.cabin.connect(this.master);

      // ---- noise source shared by many effects ----
      const len = 2 * ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // ---- engine bus ----
      this.eng = {};
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 40;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 80;
      const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 20;
      const g1 = ctx.createGain(); g1.gain.value = 0.5;
      const g2 = ctx.createGain(); g2.gain.value = 0.22;
      const g3 = ctx.createGain(); g3.gain.value = 0.5;
      const rumble = ctx.createBufferSource(); rumble.buffer = buf; rumble.loop = true;
      const rg = ctx.createGain(); rg.gain.value = 0.10;
      const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 120; rf.Q.value = 0.7;
      // turbine whine (used by the Abrams)
      const whine = ctx.createOscillator(); whine.type = 'sine'; whine.frequency.value = 600;
      const wg = ctx.createGain(); wg.gain.value = 0;
      o1.connect(g1); o2.connect(g2); o3.connect(g3);
      g1.connect(lp); g2.connect(lp); g3.connect(lp);
      rumble.connect(rf); rf.connect(rg); rg.connect(lp);
      whine.connect(wg); wg.connect(g);
      lp.connect(g);
      g.connect(this.cabin);
      o1.start(); o2.start(); o3.start(); rumble.start(); whine.start();
      this.eng = { g, lp, o1, o2, o3, whine, wg, rg };

      // ---- track / squeak bus ----
      const tg = ctx.createGain(); tg.gain.value = 0;
      const tsrc = ctx.createBufferSource(); tsrc.buffer = buf; tsrc.loop = true;
      const tf = ctx.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 1800; tf.Q.value = 1.4;
      tsrc.connect(tf); tf.connect(tg); tg.connect(this.cabin); tsrc.start();
      this.track = { g: tg, f: tf };

      this.ready = true;
      return true;
    }

    resume() {
      if (!this.ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setMuted(m) {
      this.muted = m;
      if (this.ready) this.master.gain.value = m ? 0 : 0.55;
    }
    setInterior(inside, hatchOpen) {
      if (!this.ready) return;
      this.interior = inside;
      const f = inside ? (hatchOpen ? 2600 : 900) : 20000;
      this.cabin.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.2);
    }

    /** called every frame with the player's engine state */
    engine(on, rpm, load, turbine, speed) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      const e = this.eng;
      const f = Math.max(8, rpm / 60 * (turbine ? 1.6 : 2.2));
      e.o1.frequency.setTargetAtTime(f, t, 0.08);
      e.o2.frequency.setTargetAtTime(f * 2.01, t, 0.08);
      e.o3.frequency.setTargetAtTime(f * 0.5, t, 0.1);
      e.lp.frequency.setTargetAtTime(220 + rpm * 0.16 + load * 260, t, 0.1);
      e.g.gain.setTargetAtTime(on ? (0.10 + 0.12 * load) : 0, t, 0.18);
      e.wg.gain.setTargetAtTime(turbine && on ? 0.020 + 0.02 * load : 0, t, 0.25);
      if (turbine) e.whine.frequency.setTargetAtTime(420 + rpm * 0.42, t, 0.15);
      const sp = Math.min(1, Math.abs(speed) / 8);
      this.track.g.gain.setTargetAtTime(on ? sp * 0.035 : 0, t, 0.2);
      this.track.f.frequency.setTargetAtTime(900 + sp * 1800, t, 0.2);
    }

    _noise(dur, gain, type, freq, Q, when) {
      const ctx = this.ctx, t = (when || ctx.currentTime);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const f = ctx.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.value = freq || 1200;
      f.Q.value = Q || 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.cabin);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    }
    _tone(freq, freq2, dur, gain, type, when) {
      const ctx = this.ctx, t = (when || ctx.currentTime);
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.cabin);
      o.start(t); o.stop(t + dur + 0.05);
    }

    play(name, opt) {
      if (!this.ready || this.muted) return;
      opt = opt || {};
      const delay = opt.dist ? opt.dist / 343 : 0;
      const when = this.ctx.currentTime + delay;
      const far = opt.dist ? Math.max(0.12, 1 - opt.dist / 900) : 1;
      switch (name) {
        case 'fire':
          this._noise(0.5 * far + 0.25, 0.95 * far, 'lowpass', 900, 0.6, when);
          this._tone(150, 34, 0.7, 0.55 * far, 'sine', when);
          this._tone(320, 60, 0.22, 0.3 * far, 'triangle', when);
          this._noise(1.6, 0.16 * far, 'lowpass', 320, 0.4, when + 0.05);
          break;
        case 'hit':
          this._noise(0.4, 0.7 * far, 'bandpass', 2200, 0.9, when);
          this._tone(110, 40, 0.5, 0.4 * far, 'sine', when);
          break;
        case 'explode':
          this._noise(1.2, 0.9 * far, 'lowpass', 700, 0.5, when);
          this._tone(90, 28, 1.1, 0.55 * far, 'sine', when);
          break;
        case 'ricochet':
          this._noise(0.25, 0.4 * far, 'bandpass', 3000, 3, when);
          this._tone(1800, 400, 0.3, 0.12 * far, 'sawtooth', when);
          break;
        case 'mg':
          for (let i = 0; i < 4; i++) {
            this._noise(0.07, 0.32 * far, 'bandpass', 1600 + Math.random() * 900, 1.6, when + i * 0.075);
          }
          break;
        case 'switch':
          this._noise(0.05, 0.28, 'bandpass', 2600, 4, when);
          this._tone(900, 500, 0.05, 0.1, 'square', when);
          break;
        case 'button':
          this._noise(0.04, 0.22, 'bandpass', 3400, 5, when);
          break;
        case 'clank':
          this._noise(0.16, 0.42, 'bandpass', 1100, 2.2, when);
          this._tone(320, 140, 0.18, 0.2, 'triangle', when);
          break;
        case 'breech':
          this._noise(0.28, 0.5, 'bandpass', 780, 1.6, when);
          this._tone(260, 90, 0.3, 0.28, 'square', when);
          break;
        case 'load':
          this._noise(0.34, 0.4, 'bandpass', 620, 1.2, when);
          this._tone(180, 120, 0.28, 0.22, 'triangle', when + 0.16);
          break;
        case 'autoload':
          for (let i = 0; i < 5; i++) this._noise(0.12, 0.22, 'bandpass', 700 + i * 220, 2, when + i * 0.22);
          this._tone(120, 90, 0.5, 0.16, 'square', when + 1.1);
          break;
        case 'hatch':
          this._noise(0.5, 0.4, 'lowpass', 520, 0.8, when);
          this._tone(140, 70, 0.5, 0.2, 'sine', when + 0.2);
          break;
        case 'starter':
          this._noise(1.4, 0.3, 'bandpass', 420, 1.2, when);
          this._tone(48, 88, 1.3, 0.25, 'sawtooth', when);
          break;
        case 'radio':
          this._noise(0.6, 0.14, 'bandpass', 1500, 0.8, when);
          this._tone(1200, 900, 0.1, 0.06, 'square', when);
          break;
        case 'lase':
          this._tone(2400, 2400, 0.06, 0.09, 'square', when);
          break;
        case 'smoke':
          for (let i = 0; i < 6; i++) this._noise(0.3, 0.3, 'lowpass', 900, 0.7, when + i * 0.045);
          break;
        case 'error':
          this._tone(220, 160, 0.14, 0.14, 'square', when);
          break;
        case 'ready':
          this._tone(780, 1180, 0.12, 0.14, 'triangle', when);
          break;
        default:
          this._noise(0.08, 0.2, 'bandpass', 1800, 2, when);
      }
    }
  }

  global.Sfx = Sfx;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Sfx };
})(typeof window !== 'undefined' ? window : globalThis);
