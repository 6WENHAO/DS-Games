import { clamp } from './utils.js';

/**
 * WebAudio 音频管理：主音量 / 3D定位音效 / 引擎循环声 / 环境风声
 */
export class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.listenerFwd = { x: 0, y: 0, z: -1 };
    this.buffers = null;
    this._windStarted = false;
  }

  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) { this.master.gain.value = clamp(v, 0, 1); }

  setListener(pos, fwd) {
    this.listenerPos = pos;
    this.listenerFwd = fwd;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(pos.x, t, 0.05);
      l.positionY.setTargetAtTime(pos.y, t, 0.05);
      l.positionZ.setTargetAtTime(pos.z, t, 0.05);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.05);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.05);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.05);
      l.upX.setTargetAtTime(0, t, 0.05);
      l.upY.setTargetAtTime(1, t, 0.05);
      l.upZ.setTargetAtTime(0, t, 0.05);
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  /** UI音效（非定位） */
  playUI(name, volume = 0.6, rate = 1) {
    const buf = this.buffers?.[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.master);
    src.start();
  }

  /** 3D 定位一次性音效 */
  play3D(name, pos, { volume = 1, rate = 1, refDist = 18, maxDist = 900 } = {}) {
    const buf = this.buffers?.[name];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDist;
    panner.maxDistance = maxDist;
    panner.rolloffFactor = 1;
    panner.positionX?.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY?.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ?.setValueAtTime(pos.z, this.ctx.currentTime);
    if (!panner.positionX && panner.setPosition) panner.setPosition(pos.x, pos.y, pos.z);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(panner); panner.connect(this.sfx);
    src.start();
    return src;
  }

  /** 创建循环引擎声源，返回控制句柄 */
  createEngine(name, pos) {
    const buf = this.buffers?.[name];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 14;
    panner.rolloffFactor = 1;
    src.connect(g); g.connect(panner); panner.connect(this.sfx);
    src.start();
    const handle = {
      setPos: (p) => {
        if (panner.positionX) {
          const t = this.ctx.currentTime;
          panner.positionX.setTargetAtTime(p.x, t, 0.1);
          panner.positionY.setTargetAtTime(p.y, t, 0.1);
          panner.positionZ.setTargetAtTime(p.z, t, 0.1);
        } else if (panner.setPosition) panner.setPosition(p.x, p.y, p.z);
      },
      set: (volume, rate) => {
        const t = this.ctx.currentTime;
        g.gain.setTargetAtTime(volume, t, 0.12);
        src.playbackRate.setTargetAtTime(rate, t, 0.12);
      },
      stop: () => {
        try { src.stop(); } catch (e) { /* noop */ }
      },
    };
    handle.setPos(pos);
    return handle;
  }

  /** 程序化风声环境 */
  startWind() {
    if (this._windStarted) return;
    this._windStarted = true;
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.97 + white * 0.03;
      data[i] = last * 6;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.16;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(); lfo.start();
  }
}
