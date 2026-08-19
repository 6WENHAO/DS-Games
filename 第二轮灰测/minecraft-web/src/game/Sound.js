/* =====================================================================
 * Sound — 全程序化音效（WebAudio 合成，无音频文件）
 *  step / dig / break / place / hurt / hit / pickup / explode / fuse ...
 * ===================================================================== */
import settings from '../core/Settings.js';
import { bus, EV } from '../core/EventBus.js';
import { MATERIAL } from '../core/Constants.js';

/** 每种材质的音色参数 */
const MATERIAL_PROFILE = {
  [MATERIAL.STONE]: { type: 'bandpass', freq: 780, q: 1.2, dur: 0.10, gain: 0.9, tone: 0 },
  [MATERIAL.DIRT]: { type: 'lowpass', freq: 420, q: 0.8, dur: 0.12, gain: 0.85, tone: 0 },
  [MATERIAL.GRASS]: { type: 'highpass', freq: 1600, q: 0.7, dur: 0.11, gain: 0.55, tone: 0 },
  [MATERIAL.GRAVEL]: { type: 'lowpass', freq: 900, q: 0.9, dur: 0.13, gain: 0.8, tone: 0 },
  [MATERIAL.SAND]: { type: 'highpass', freq: 2600, q: 0.6, dur: 0.13, gain: 0.42, tone: 0 },
  [MATERIAL.WOOD]: { type: 'bandpass', freq: 460, q: 1.6, dur: 0.11, gain: 0.9, tone: 190 },
  [MATERIAL.GLASS]: { type: 'highpass', freq: 3200, q: 1.0, dur: 0.14, gain: 0.7, tone: 1800 },
  [MATERIAL.WOOL]: { type: 'lowpass', freq: 700, q: 0.7, dur: 0.10, gain: 0.42, tone: 0 },
  [MATERIAL.PLANT]: { type: 'highpass', freq: 2000, q: 0.6, dur: 0.09, gain: 0.4, tone: 0 },
  [MATERIAL.METAL]: { type: 'bandpass', freq: 1400, q: 2.4, dur: 0.14, gain: 0.75, tone: 900 },
  [MATERIAL.SNOW]: { type: 'highpass', freq: 2200, q: 0.5, dur: 0.10, gain: 0.35, tone: 0 },
  [MATERIAL.LIQUID]: { type: 'lowpass', freq: 600, q: 0.9, dur: 0.22, gain: 0.5, tone: 0 },
};

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.musicNodes = [];
    this.musicTimer = 0;
    this._lastPlay = new Map();
    bus.on(EV.SOUND, (name, opts) => this.play(name, opts));
  }

  /** 必须在用户手势中调用一次 */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = settings.volumeScalar;
    this.master.connect(this.ctx.destination);

    // 预生成 1 秒白噪声
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    bus.on(EV.SETTINGS_CHANGED, (key) => {
      if (key === 'volume' || key === 'sound' || key === '*') {
        if (this.master) this.master.gain.value = settings.volumeScalar;
      }
      if (key === 'music' && !settings.get('music')) this.stopMusic();
    });
  }

  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  /* ---------------- 基础发声 ---------------- */

  _noise({ dur = 0.1, type = 'lowpass', freq = 800, q = 1, gain = 0.5, rate = 1, delay = 0 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = rate;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0, Math.random() * 0.5, dur + 0.02);
    src.stop(t0 + dur + 0.05);
    return { src, g };
  }

  _tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.2, delay = 0 }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t0 = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    return { osc, g };
  }

  /** 限流：同名音效最小间隔 */
  _throttle(name, ms) {
    const now = performance.now();
    const last = this._lastPlay.get(name) || 0;
    if (now - last < ms) return false;
    this._lastPlay.set(name, now);
    return true;
  }

  /* ---------------- 音效表 ---------------- */

  play(name, opts = {}) {
    if (!settings.get('sound')) return;
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    if (!this.noiseBuffer) return;
    const vol = (opts.volume ?? 0.5);
    const mat = opts.material || MATERIAL.STONE;
    const prof = MATERIAL_PROFILE[mat] || MATERIAL_PROFILE[MATERIAL.STONE];

    try {
      switch (name) {
        case 'step':
          if (!this._throttle('step', 120)) return;
          this._noise({
            dur: prof.dur * 0.8, type: prof.type, freq: prof.freq * (0.85 + Math.random() * 0.3),
            q: prof.q, gain: prof.gain * vol * 0.55, rate: 0.9 + Math.random() * 0.25,
          });
          break;

        case 'land':
          this._noise({ dur: prof.dur * 1.4, type: prof.type, freq: prof.freq * 0.7, q: prof.q, gain: prof.gain * vol });
          if (prof.tone) this._tone({ freq: prof.tone * 0.7, to: prof.tone * 0.4, dur: 0.1, gain: 0.05 * vol });
          break;

        case 'dig':
          if (!this._throttle('dig', 90)) return;
          this._noise({
            dur: prof.dur * 0.7, type: prof.type, freq: prof.freq * (0.8 + Math.random() * 0.4),
            q: prof.q, gain: prof.gain * vol * 0.7, rate: 0.85 + Math.random() * 0.3,
          });
          break;

        case 'break':
          this._noise({ dur: prof.dur * 2.2, type: prof.type, freq: prof.freq, q: prof.q, gain: prof.gain * vol * 1.1 });
          this._noise({ dur: prof.dur * 1.4, type: prof.type, freq: prof.freq * 1.6, q: prof.q, gain: prof.gain * vol * 0.6, delay: 0.03 });
          if (prof.tone) this._tone({ freq: prof.tone, to: prof.tone * 0.5, dur: 0.16, gain: 0.09 * vol, type: 'triangle' });
          break;

        case 'place':
          this._noise({ dur: prof.dur, type: prof.type, freq: prof.freq * 0.9, q: prof.q, gain: prof.gain * vol });
          if (prof.tone) this._tone({ freq: prof.tone * 0.8, to: prof.tone * 0.6, dur: 0.08, gain: 0.06 * vol, type: 'triangle' });
          break;

        case 'hit':
          this._noise({ dur: 0.08, type: 'bandpass', freq: 1200, q: 1.5, gain: 0.5 * vol });
          this._tone({ freq: 220, to: 140, dur: 0.09, gain: 0.1 * vol, type: 'square' });
          break;

        case 'hurt':
          this._tone({ freq: 300, to: 140, dur: 0.22, gain: 0.22 * vol, type: 'sawtooth' });
          this._noise({ dur: 0.14, type: 'bandpass', freq: 700, q: 1, gain: 0.3 * vol });
          break;

        case 'mobHurt':
          this._tone({ freq: 420 + Math.random() * 120, to: 200, dur: 0.18, gain: 0.16 * vol, type: 'square' });
          break;

        case 'mobDeath':
          this._tone({ freq: 380, to: 90, dur: 0.42, gain: 0.18 * vol, type: 'sawtooth' });
          break;

        case 'pickup':
          if (!this._throttle('pickup', 60)) return;
          this._tone({ freq: 620, to: 900, dur: 0.07, gain: 0.12 * vol, type: 'triangle' });
          this._tone({ freq: 900, to: 1250, dur: 0.06, gain: 0.09 * vol, type: 'triangle', delay: 0.05 });
          break;

        case 'eat':
          if (!this._throttle('eat', 200)) return;
          this._noise({ dur: 0.1, type: 'lowpass', freq: 500, q: 1, gain: 0.35 * vol, rate: 0.8 });
          break;

        case 'explode':
          this._noise({ dur: 1.1, type: 'lowpass', freq: 320, q: 0.7, gain: 1.0 * vol, rate: 0.6 });
          this._noise({ dur: 0.5, type: 'bandpass', freq: 90, q: 0.5, gain: 0.9 * vol, rate: 0.4 });
          this._tone({ freq: 80, to: 30, dur: 0.7, gain: 0.3 * vol, type: 'sine' });
          break;

        case 'fuse':
          this._noise({ dur: 1.4, type: 'highpass', freq: 5000, q: 0.5, gain: 0.3 * vol, rate: 1.4 });
          break;

        case 'splash':
          this._noise({ dur: 0.3, type: 'lowpass', freq: 900, q: 0.8, gain: 0.5 * vol, rate: 1.2 });
          break;

        case 'click':
          this._tone({ freq: 1000, to: 700, dur: 0.04, gain: 0.09 * vol, type: 'square' });
          break;

        case 'levelup':
          [523, 659, 784, 1047].forEach((f, i) => {
            this._tone({ freq: f, dur: 0.18, gain: 0.11 * vol, type: 'triangle', delay: i * 0.09 });
          });
          break;

        default:
          break;
      }
    } catch (e) { /* 忽略音频错误 */ }
  }

  /* ---------------- 环境音乐（生成式） ---------------- */
  updateMusic(dt, isNight) {
    if (!settings.get('music') || !this.ready) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 6 + Math.random() * 10;

    const scale = isNight ? [220, 261.6, 293.7, 349.2, 392] : [261.6, 293.7, 329.6, 392, 440];
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const f = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * (0.9 + Math.random());
      const dur = 2.6 + Math.random() * 2;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.045, t0 + 0.9);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.1);
    }
  }

  stopMusic() {
    for (const n of this.musicNodes) { try { n.stop(); } catch (e) { /* ignore */ } }
    this.musicNodes.length = 0;
  }
}

export const sound = new SoundEngine();
