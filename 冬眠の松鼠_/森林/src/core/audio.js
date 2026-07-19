import { Assets } from './assets.js';

// WebAudio 音频引擎：2D/3D 音效 + 程序化环境音（风声/海浪/夜虫）
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.master = null;
    this.ambGain = null;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this._ambNodes = [];
    this.cricketGain = null;
    this.windGain = null;
  }

  // 必须在用户手势后调用
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this._decodeAll();
    this._startAmbience();
  }

  async _decodeAll() {
    for (const [key, raw] of Assets.sounds) {
      try {
        const buf = await this.ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(key, buf);
      } catch (e) { console.warn('decode fail', key); }
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  play(key, { volume = 1, rate = 1, detune = 0 } = {}) {
    if (!this.ctx || !this.buffers.has(key)) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(key);
    src.playbackRate.value = rate;
    if (detune) src.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.master);
    src.start();
  }

  playRandom(keys, opts = {}) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    this.play(key, { ...opts, rate: (opts.rate || 1) * (0.92 + Math.random() * 0.16) });
  }

  // 简易 3D 衰减（按距离）
  playAt(key, pos, { volume = 1, maxDist = 40, rate = 1 } = {}) {
    const dx = pos.x - this.listenerPos.x;
    const dy = pos.y - this.listenerPos.y;
    const dz = pos.z - this.listenerPos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > maxDist) return;
    const att = Math.max(0, 1 - d / maxDist);
    this.play(key, { volume: volume * att * att, rate });
  }

  setListener(pos) { this.listenerPos = { x: pos.x, y: pos.y, z: pos.z }; }

  // ---------- 程序化环境音 ----------
  _noiseBuffer(seconds = 2) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startAmbience() {
    const ctx = this.ctx;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 1;
    this.ambGain.connect(this.master);

    // 风声：滤波白噪声 + 缓慢起伏
    const wind = ctx.createBufferSource();
    wind.buffer = this._noiseBuffer(4);
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.ambGain);
    wind.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain); lfoGain.connect(windFilter.frequency);
    lfo.start();

    // 海浪：更低频噪声脉动
    const surf = ctx.createBufferSource();
    surf.buffer = this._noiseBuffer(6);
    surf.loop = true;
    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 240;
    this.surfGain = ctx.createGain();
    this.surfGain.gain.value = 0.0;
    surf.connect(surfFilter); surfFilter.connect(this.surfGain); this.surfGain.connect(this.ambGain);
    surf.start();
    const surfLfo = ctx.createOscillator();
    surfLfo.frequency.value = 0.11;
    const surfLfoGain = ctx.createGain();
    surfLfoGain.gain.value = 0.035;
    surfLfo.connect(surfLfoGain); surfLfoGain.connect(this.surfGain.gain);
    surfLfo.start();

    // 夜晚虫鸣：高频窄带噪声抖动
    const cricket = ctx.createBufferSource();
    cricket.buffer = this._noiseBuffer(2);
    cricket.loop = true;
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 4200;
    cf.Q.value = 18;
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    const trem = ctx.createOscillator();
    trem.frequency.value = 13;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.5;
    const tremBase = ctx.createGain();
    tremBase.gain.value = 0.5;
    cricket.connect(cf);
    cf.connect(tremBase); tremBase.connect(this.cricketGain);
    trem.connect(tremGain); tremGain.connect(tremBase.gain);
    this.cricketGain.connect(this.ambGain);
    cricket.start(); trem.start();
  }

  // dayFactor: 0=深夜, 1=正午; shore: 0..1 距海岸近的程度
  updateAmbience(dayFactor, shore) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.cricketGain) this.cricketGain.gain.setTargetAtTime((1 - dayFactor) * 0.045, t, 1.5);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.04 + 0.03 * dayFactor, t, 2);
    if (this.surfGain) this.surfGain.gain.setTargetAtTime(shore * 0.12, t, 1.0);
  }
}

export const Audio = new AudioEngine();
