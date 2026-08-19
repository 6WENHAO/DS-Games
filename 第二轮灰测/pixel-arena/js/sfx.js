// ============================================================
// sfx.js — 合成音效（WebAudio 程序化生成，无外部素材）
// 首次用户交互后解锁；M 键静音。
// ============================================================
'use strict';

const Sfx = {
  ctx: null,
  muted: false,
  last: {},
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function () {});
    }
  },
  tone(freq, dur, type, vol, slide) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (lowpass) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      src.connect(lp);
      node = lp;
    }
    node.connect(gain).connect(this.ctx.destination);
    src.start(t0);
  },
  // 具体音效
  move() { this.tone(660, 0.05, 'square', 0.05); },
  confirm() { this.tone(880, 0.07, 'square', 0.06); this.tone(1320, 0.09, 'square', 0.05); },
  cancel() { this.tone(440, 0.06, 'square', 0.05, 220); },
  hit() { this.noise(0.12, 0.16, 2400); this.tone(160, 0.12, 'square', 0.09, 60); },
  superHit() { this.noise(0.2, 0.2, 2000); this.tone(120, 0.2, 'sawtooth', 0.1, 40); },
  weakHit() { this.tone(300, 0.08, 'triangle', 0.07, 140); },
  heal() { this.tone(520, 0.08, 'triangle', 0.07); this.tone(780, 0.1, 'triangle', 0.07); },
  statUp() { this.tone(392, 0.07, 'square', 0.05); this.tone(523, 0.07, 'square', 0.05); this.tone(659, 0.09, 'square', 0.05); },
  statDown() { this.tone(523, 0.07, 'square', 0.05); this.tone(392, 0.09, 'square', 0.05); },
  faint() { this.tone(660, 0.4, 'sawtooth', 0.07, 110); this.noise(0.25, 0.1, 900); },
  faintEnemy() { this.tone(880, 0.35, 'sawtooth', 0.07, 160); },
  weather() { this.noise(0.5, 0.08, 1500); this.tone(300, 0.4, 'triangle', 0.05, 600); },
  victory() {
    const seq = [523, 659, 784, 1047, 784, 1047];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'square', 0.06), i * 130));
  },
  defeat() {
    const seq = [392, 349, 311, 262];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.07), i * 200));
  },
};
