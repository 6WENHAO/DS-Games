/* =========================================================================
 * GREENFALL · audio.js —— WebAudio 程序化音效与环境音（无音频文件）
 * ======================================================================= */
(function (GF) {
  'use strict';

  class Audio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.volume = 0.55;
      this.enabled = true;
      this.ambientNodes = null;
      this.lastPlay = {};
    }
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return null; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    }
    resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

    _noiseBuffer(dur) {
      const c = this.ctx;
      const n = Math.floor(c.sampleRate * dur);
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    /** 通用发声：噪声/振荡器 + 包络 + 滤波 */
    play(opt) {
      if (!this.enabled) return;
      const c = this.ensure(); if (!c) return;
      const t0 = c.currentTime;
      const o = Object.assign({
        type: 'sine', freq: 440, freq2: null, dur: 0.15, gain: 0.3,
        noise: false, filter: null, q: 1, attack: 0.005, decay: null, pan: 0,
      }, opt || {});
      // 简单节流：同名音效 40ms 内不重复
      if (o.key) {
        const last = this.lastPlay[o.key] || 0;
        if (t0 - last < 0.035) return;
        this.lastPlay[o.key] = t0;
      }
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(o.gain, t0 + o.attack);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + o.dur);
      let src;
      if (o.noise) {
        src = c.createBufferSource();
        src.buffer = this._noiseBuffer(Math.max(0.05, o.dur));
      } else {
        src = c.createOscillator();
        src.type = o.type;
        src.frequency.setValueAtTime(o.freq, t0);
        if (o.freq2) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + o.dur);
      }
      let node = src;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter;
        f.frequency.value = o.fc || 900;
        f.Q.value = o.q;
        node.connect(f); node = f;
      }
      if (o.pan) {
        const p = c.createStereoPanner ? c.createStereoPanner() : null;
        if (p) { p.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(p); node = p; }
      }
      node.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + o.dur + 0.02);
    }

    /* ------------------------------------------------- 具体音效 */
    step(mat) {
      const map = {
        grass: { noise: true, filter: 'bandpass', fc: 900, gain: 0.11, dur: 0.10 },
        dirt: { noise: true, filter: 'lowpass', fc: 600, gain: 0.12, dur: 0.11 },
        stone: { noise: true, filter: 'highpass', fc: 1600, gain: 0.10, dur: 0.07 },
        wood: { noise: true, filter: 'bandpass', fc: 500, gain: 0.13, dur: 0.09 },
        metal: { noise: true, filter: 'highpass', fc: 2600, gain: 0.09, dur: 0.08 },
        sand: { noise: true, filter: 'lowpass', fc: 1100, gain: 0.09, dur: 0.10 },
        gravel: { noise: true, filter: 'bandpass', fc: 1800, gain: 0.11, dur: 0.09 },
        glass: { noise: true, filter: 'highpass', fc: 3200, gain: 0.08, dur: 0.07 },
        mud: { noise: true, filter: 'lowpass', fc: 400, gain: 0.14, dur: 0.14 },
        soft: { noise: true, filter: 'lowpass', fc: 700, gain: 0.07, dur: 0.10 },
      };
      this.play(Object.assign({ key: 'step' }, map[mat] || map.dirt));
    }
    mine(mat) {
      this.step(mat);
      this.play({ key: 'mine', type: 'square', freq: 160 + Math.random() * 60, freq2: 90, dur: 0.06, gain: 0.05 });
    }
    breakBlock(mat) {
      this.play({ noise: true, filter: 'bandpass', fc: mat === 'glass' ? 3600 : 1200, q: 0.8, gain: 0.2, dur: 0.28 });
    }
    place() { this.play({ noise: true, filter: 'lowpass', fc: 800, gain: 0.16, dur: 0.12 }); }
    hit() { this.play({ type: 'triangle', freq: 220, freq2: 80, dur: 0.16, gain: 0.22 }); }
    hurt() { this.play({ type: 'sawtooth', freq: 300, freq2: 110, dur: 0.3, gain: 0.2, filter: 'lowpass', fc: 1400 }); }
    eat() { this.play({ noise: true, filter: 'lowpass', fc: 520, gain: 0.13, dur: 0.2 }); }
    drink() { for (let i = 0; i < 3; i++) setTimeout(() => this.play({ type: 'sine', freq: 320 + i * 60, freq2: 200, dur: 0.09, gain: 0.10 }), i * 110); }
    med() { this.play({ type: 'sine', freq: 660, freq2: 990, dur: 0.22, gain: 0.13 }); }
    craft() { this.play({ type: 'triangle', freq: 520, freq2: 780, dur: 0.18, gain: 0.14 }); }
    ui() { this.play({ type: 'sine', freq: 720, dur: 0.05, gain: 0.07 }); }
    error() { this.play({ type: 'square', freq: 180, freq2: 120, dur: 0.16, gain: 0.11 }); }
    quest() { [0, 130, 260].forEach((d, i) => setTimeout(() => this.play({ type: 'sine', freq: [523, 659, 784][i], dur: 0.24, gain: 0.13 }), d)); }
    gunshot(loud) {
      this.play({ noise: true, filter: 'lowpass', fc: loud ? 2600 : 1400, gain: loud ? 0.5 : 0.22, dur: loud ? 0.34 : 0.16 });
      this.play({ type: 'sawtooth', freq: 140, freq2: 40, dur: 0.2, gain: 0.2 });
    }
    bow() { this.play({ noise: true, filter: 'highpass', fc: 2200, gain: 0.14, dur: 0.12 }); }
    zombie() {
      this.play({ type: 'sawtooth', freq: 90 + Math.random() * 40, freq2: 60, dur: 0.7, gain: 0.10, filter: 'lowpass', fc: 520 });
    }
    dog() { this.play({ type: 'square', freq: 420, freq2: 180, dur: 0.18, gain: 0.14, filter: 'bandpass', fc: 900 }); }
    crow() { this.play({ type: 'sawtooth', freq: 900, freq2: 420, dur: 0.16, gain: 0.09, filter: 'bandpass', fc: 1800 }); }
    thunder() {
      this.play({ noise: true, filter: 'lowpass', fc: 260, gain: 0.42, dur: 1.8 });
    }
    death() { [0, 200, 420].forEach((d, i) => setTimeout(() => this.play({ type: 'sine', freq: [392, 311, 233][i], dur: 0.8, gain: 0.17 }), d)); }

    /* ----------------------------------------- 环境音（风/雨/虫鸣） */
    ambient(state) {
      const c = this.ensure(); if (!c) return;
      if (!this.ambientNodes) {
        const src = c.createBufferSource();
        src.buffer = this._noiseBuffer(3);
        src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        const g = c.createGain(); g.gain.value = 0.0;
        src.connect(lp); lp.connect(g); g.connect(this.master);
        src.start();
        // 雨声（更高频）
        const src2 = c.createBufferSource();
        src2.buffer = this._noiseBuffer(3); src2.loop = true;
        const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.5;
        const g2 = c.createGain(); g2.gain.value = 0;
        src2.connect(hp); hp.connect(g2); g2.connect(this.master);
        src2.start();
        this.ambientNodes = { wind: g, windF: lp, rain: g2 };
      }
      const n = this.ambientNodes;
      const t = c.currentTime;
      n.wind.gain.setTargetAtTime(0.02 + state.wind * 0.05, t, 1.5);
      n.windF.frequency.setTargetAtTime(300 + state.wind * 500, t, 2);
      n.rain.gain.setTargetAtTime(state.rain * 0.075, t, 1.5);
    }
  }

  GF.Audio = Audio;
})(globalThis.GF = globalThis.GF || {});
