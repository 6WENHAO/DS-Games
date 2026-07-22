import { CONFIG } from '../config.js';
import { clamp, rand } from './utils.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.sfxGain = null;
    this.musicEl = null;
    this.currentMusic = null;
    this.unlocked = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = CONFIG.audio.sfxVolume;
    this.sfxGain.connect(this.ctx.destination);
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  async loadBuffers(manifest, onEach) {
    this.init();
    const entries = Object.entries(manifest);
    await Promise.all(entries.map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        this.buffers.set(key, buf);
      } catch (err) {
        console.warn('audio load failed', key, err);
      }
      onEach?.();
    }));
  }

  play(key, { volume = 1, rate = 1, ratejitter = 0, delay = 0 } = {}) {
    if (!this.ctx || !this.unlocked) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate + (ratejitter ? rand(-ratejitter, ratejitter) : 0);
    const g = this.ctx.createGain();
    g.gain.value = clamp(volume, 0, 2);
    src.connect(g).connect(this.sfxGain);
    src.start(this.ctx.currentTime + delay);
  }

  playAt(key, position, listenerPos, opts = {}) {
    const d = position.distanceTo(listenerPos);
    const vol = clamp(1 - d / 26, 0, 1) ** 1.4 * (opts.volume ?? 1);
    if (vol <= 0.02) return;
    this.play(key, { ...opts, volume: vol });
  }

  music(url, { volume = CONFIG.audio.musicVolume, fade = 1.2 } = {}) {
    if (this.currentMusic === url) return;
    this.currentMusic = url;
    const old = this.musicEl;
    if (old) {
      const startVol = old.volume;
      const t0 = performance.now();
      const fadeOut = () => {
        const k = (performance.now() - t0) / (fade * 1000);
        if (k >= 1) { old.pause(); old.src = ''; return; }
        old.volume = startVol * (1 - k);
        requestAnimationFrame(fadeOut);
      };
      fadeOut();
    }
    if (!url) { this.musicEl = null; return; }
    const el = new Audio(url);
    el.loop = true;
    el.volume = 0;
    el.play().catch(() => {});
    this.musicEl = el;
    const t0 = performance.now();
    const fadeIn = () => {
      if (this.musicEl !== el) return;
      const k = (performance.now() - t0) / (fade * 1000);
      el.volume = volume * clamp(k, 0, 1);
      if (k < 1) requestAnimationFrame(fadeIn);
    };
    fadeIn();
  }

  stopMusic() { this.music(null); }
}

export const audio = new AudioManager();
