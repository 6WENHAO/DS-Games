/* ============================================================
   POOLROOMS · audio.js
   全合成环境音:空间低鸣 / 回声水滴 / 水波轻拍 / 脚步涉水
   ============================================================ */
(function () {
  'use strict';

  PR.audio = {
    ctx: null, master: null, inited: false,

    init() {
      if (this.inited) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(ctx.destination);
      this.inited = true;

      /* 噪声源 */
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
      this.noiseBuf = buf;
      const wbuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const wd = wbuf.getChannelData(0);
      for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
      this.whiteBuf = wbuf;

      /* 空间低鸣 */
      const room = ctx.createBufferSource();
      room.buffer = buf; room.loop = true;
      const roomF = ctx.createBiquadFilter();
      roomF.type = 'lowpass'; roomF.frequency.value = 160;
      const roomG = ctx.createGain(); roomG.gain.value = 0.16;
      room.connect(roomF); roomF.connect(roomG); roomG.connect(this.master);
      room.start();

      /* 水面轻拍(调制噪声) */
      const lap = ctx.createBufferSource();
      lap.buffer = wbuf; lap.loop = true;
      const lapF = ctx.createBiquadFilter();
      lapF.type = 'bandpass'; lapF.frequency.value = 620; lapF.Q.value = 1.4;
      const lapG = ctx.createGain(); lapG.gain.value = 0.0;
      lap.connect(lapF); lapF.connect(lapG); lapG.connect(this.master);
      lap.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.16;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.012;
      lfo.connect(lfoG); lfoG.connect(lapG.gain);
      lfo.start();
      lapG.gain.value = 0.02;

      /* 回声延迟(共享给水滴) */
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.34;
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const fbF = ctx.createBiquadFilter();
      fbF.type = 'lowpass'; fbF.frequency.value = 2400;
      delay.connect(fb); fb.connect(fbF); fbF.connect(delay);
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      delay.connect(wet); wet.connect(this.master);
      this.delay = delay;

      this._dripLoop();
    },

    _dripLoop() {
      const next = 2 + Math.random() * 7;
      setTimeout(() => { if (this.inited) { this._drip(); this._dripLoop(); } }, next * 1000);
    },
    _drip() {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = 900 + Math.random() * 1500;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + Math.random()), t + 0.02);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g); g.connect(pan); pan.connect(this.master); g.connect(this.delay);
      o.start(t); o.stop(t + 0.2);
    },

    _burst(freq, q, dur, vol, type) {
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.whiteBuf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.1);
      return g;
    },

    step(mat, vol) {
      if (!this.inited) return;
      const v = vol || 1;
      if (mat === 'tile') {
        this._burst(2600 + Math.random() * 900, 1.2, 0.07, 0.028 * v);
        this._burst(300 + Math.random() * 120, 2, 0.05, 0.03 * v, 'lowpass');
      } else if (mat === 'splash') {
        const g = this._burst(700 + Math.random() * 300, 0.8, 0.22, 0.05 * v);
        g.connect(this.delay);
        this._burst(2200 + Math.random() * 1200, 1.5, 0.1, 0.02 * v);
      } else if (mat === 'stroke') {
        const g = this._burst(520 + Math.random() * 160, 0.7, 0.5, 0.045 * v);
        g.connect(this.delay);
      }
    }
  };
})();
