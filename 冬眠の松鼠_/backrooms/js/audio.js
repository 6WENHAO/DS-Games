/* ============================================================
   audio.js — fully procedural Web Audio engine (no sound files)
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = false;
      this.buzzGain = null;
      this.droneGain = null;
      this._hbTimer = 0;
      this._hbRate = 0; // heartbeats per second target (0 = off)
      this.volume = 0.8;
    }

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this._buildAmbience();
    }

    resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

    _noiseBuffer(dur) {
      const n = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    // ---- constant fluorescent light buzz ----
    _buildAmbience() {
      const ctx = this.ctx;
      // hum: 60hz + 120hz + high whine
      this.buzzGain = ctx.createGain();
      this.buzzGain.gain.value = 0.05;
      this.buzzGain.connect(this.master);

      const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 60;
      const o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = 120;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = 8200;
      const g3 = ctx.createGain(); g3.gain.value = 0.04;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(this.buzzGain);
      o3.connect(g3); g3.connect(this.buzzGain);
      o1.start(); o2.start(); o3.start();

      // subtle amplitude flicker via LFO
      const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.5;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.015;
      lfo.connect(lfoG); lfoG.connect(this.buzzGain.gain); lfo.start();

      // low ominous drone (controllable for tension)
      this.droneGain = ctx.createGain();
      this.droneGain.gain.value = 0.0;
      this.droneGain.connect(this.master);
      const d1 = ctx.createOscillator(); d1.type = "sine"; d1.frequency.value = 42;
      const d2 = ctx.createOscillator(); d2.type = "sine"; d2.frequency.value = 55.5;
      d1.connect(this.droneGain); d2.connect(this.droneGain);
      d1.start(); d2.start();
    }

    setTension(t) { // 0..1
      if (!this.droneGain) return;
      this.droneGain.gain.setTargetAtTime(t * 0.09, this.ctx.currentTime, 0.4);
    }

    // light flicker click
    flicker() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.04);
      const bp = ctx.createBiquadFilter(); bp.type = "highpass"; bp.frequency.value = 3000;
      const g = ctx.createGain(); g.gain.value = 0.0;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start();
    }

    footstep(running, soft) {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.12);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.value = running ? 900 : 620;
      const g = ctx.createGain();
      const vol = (soft ? 0.06 : running ? 0.22 : 0.14);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (running ? 0.1 : 0.15));
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      src.start();
    }

    drink() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = "sine";
        const g = ctx.createGain();
        const st = t + i * 0.18;
        o.frequency.setValueAtTime(180, st);
        o.frequency.exponentialRampToValueAtTime(90, st + 0.12);
        g.gain.setValueAtTime(0.0, st);
        g.gain.linearRampToValueAtTime(0.12, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.15);
        o.connect(g); g.connect(this.master); o.start(st); o.stop(st + 0.16);
      }
    }

    pickup() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "triangle";
      const g = ctx.createGain();
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.1);
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 0.16);
    }

    // entity screech / growl
    screech() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sawtooth";
      const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.detune.value = 30;
      const g = ctx.createGain();
      const dist = ctx.createWaveShaper(); dist.curve = this._distCurve(200);
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.3);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.9);
      o2.frequency.setValueAtTime(180, t);
      o2.frequency.exponentialRampToValueAtTime(900, t + 0.3);
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      o.connect(dist); o2.connect(dist); dist.connect(g); g.connect(this.master);
      o.start(); o2.start(); o.stop(t + 1.0); o2.stop(t + 1.0);
    }

    _distCurve(amount) {
      const n = 256, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + amount) * x * 20 * Math.PI) / (Math.PI + amount * Math.abs(x));
      }
      return curve;
    }

    // heartbeat controlled by rate (bpm)
    setHeartRate(bpm) { this._hbRate = bpm > 0 ? bpm / 60 : 0; }

    _heartbeat() {
      const ctx = this.ctx, t = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator(); o.type = "sine";
        const g = ctx.createGain();
        const st = t + i * 0.14;
        o.frequency.setValueAtTime(58, st);
        o.frequency.exponentialRampToValueAtTime(32, st + 0.12);
        g.gain.setValueAtTime(0.0, st);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.32 : 0.2, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
        o.connect(g); g.connect(this.master); o.start(st); o.stop(st + 0.2);
      }
    }

    // whisper for low sanity
    whisper() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(1.2);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = 1000 + Math.random() * 1500; bp.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.4);
      g.gain.linearRampToValueAtTime(0.0, t + 1.2);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
      const lg = ctx.createGain(); lg.gain.value = 400;
      lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start(); src.stop(t + 1.2);
    }

    noclipWhoosh() {
      if (!this.enabled) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(2.0);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.exponentialRampToValueAtTime(4000, t + 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0, t + 2.0);
      src.connect(lp); lp.connect(g); g.connect(this.master); src.start(); src.stop(t + 2.0);
    }

    update(dt) {
      if (!this.enabled || this._hbRate <= 0) return;
      this._hbTimer -= dt;
      if (this._hbTimer <= 0) {
        this._heartbeat();
        this._hbTimer = 1 / this._hbRate;
      }
    }
  }

  BR.AudioEngine = AudioEngine;
})();
