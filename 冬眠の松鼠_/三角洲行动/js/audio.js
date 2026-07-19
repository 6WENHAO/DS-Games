/* ===== WebAudio 程序化音效 ===== */
"use strict";

const AudioSys = {
  ctx: null, master: null, volume: 0.8,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) { console.warn("音频初始化失败", e); }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },

  _noise(dur) {
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; return src;
  },
  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  },

  gunshot(kind, vol) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    vol = vol === undefined ? 1 : vol;
    const cfg = {
      pistol:  { dur: .14, f: 1400, peak: .5 },
      smg:     { dur: .12, f: 1800, peak: .5 },
      rifle:   { dur: .18, f: 1100, peak: .65 },
      lmg:     { dur: .18, f: 1000, peak: .7 },
      shotgun: { dur: .3,  f: 700,  peak: .85 },
      sniper:  { dur: .4,  f: 600,  peak: .95 }
    }[kind] || { dur: .15, f: 1200, peak: .6 };
    const n = this._noise(cfg.dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cfg.f * 3, t0);
    lp.frequency.exponentialRampToValueAtTime(cfg.f * 0.4, t0 + cfg.dur);
    const g = this.ctx.createGain();
    this._env(g, t0, cfg.peak * vol, 0.004, cfg.dur);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t0);
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + cfg.dur);
    const og = this.ctx.createGain();
    this._env(og, t0, cfg.peak * 0.7 * vol, 0.004, cfg.dur * 0.9);
    o.connect(og); og.connect(this.master);
    o.start(t0); o.stop(t0 + cfg.dur + 0.05);
  },

  distantShot(dist) {
    if (!this.ctx) return;
    const vol = Math.max(0.03, 1 - dist / 140) * 0.5;
    this.gunshot("rifle", vol);
  },

  click(freq, dur, vol) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "square"; o.frequency.value = freq || 900;
    const g = this.ctx.createGain();
    this._env(g, t0, (vol || 0.15), 0.002, dur || 0.05);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + (dur || 0.05) + 0.03);
  },

  ui() { this.click(700, 0.04, 0.12); },
  reload() {
    if (!this.ctx) return;
    this.click(500, 0.05, 0.2);
    setTimeout(() => this.click(350, 0.06, 0.2), 220);
    setTimeout(() => this.click(800, 0.05, 0.25), 500);
  },
  dryfire() { this.click(1200, 0.03, 0.18); },
  footstep(run) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const n = this._noise(0.07);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = run ? 500 : 350;
    const g = this.ctx.createGain();
    this._env(g, t0, run ? 0.12 : 0.07, 0.005, 0.06);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t0);
  },
  hurt() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(90, t0 + 0.18);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.25, 0.005, 0.2);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.25);
  },
  hitmark(kill) { this.click(kill ? 300 : 1500, 0.035, 0.2); },
  heal() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = this.ctx.createGain();
      this._env(g, t0 + i * 0.09, 0.1, 0.01, 0.12);
      o.connect(g); g.connect(this.master);
      o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.2);
    });
  },
  lootOpen() { this.click(420, 0.08, 0.15); setTimeout(() => this.click(620, 0.06, 0.12), 130); },
  pickup() { this.click(880, 0.05, 0.14); },
  beep(high) { this.click(high ? 1320 : 880, 0.09, 0.2); },
  explosion() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const n = this._noise(0.9);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(60, t0 + 0.9);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.9, 0.008, 0.85);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t0);
  },
  extractDone() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [392, 523, 659, 784].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = f;
      const g = this.ctx.createGain();
      this._env(g, t0 + i * 0.14, 0.16, 0.01, 0.2);
      o.connect(g); g.connect(this.master);
      o.start(t0 + i * 0.14); o.stop(t0 + i * 0.14 + 0.3);
    });
  },
  deathSting() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [220, 185, 147].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      const g = this.ctx.createGain();
      this._env(g, t0 + i * 0.25, 0.18, 0.02, 0.4);
      o.connect(g); g.connect(this.master);
      o.start(t0 + i * 0.25); o.stop(t0 + i * 0.25 + 0.5);
    });
  },
  heartbeat() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine"; o.frequency.value = 55;
    const g = this.ctx.createGain();
    this._env(g, t0, 0.3, 0.01, 0.12);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.2);
  },

  ambient: null,
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const n = this._noise(4);
    n.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 220;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start();
    this.ambient = { src: n, gain: g };
  },
  stopAmbient() {
    if (this.ambient) { try { this.ambient.src.stop(); } catch (e) {} this.ambient = null; }
  }
};
