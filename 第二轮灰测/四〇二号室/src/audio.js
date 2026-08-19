/* =============================================================================
 * audio.js — 程序化恐怖音景（WebAudio，无外部音频资源）
 *
 * 全部声音实时合成：环境嗡鸣、脚步、门、耳语、心跳、电视机雪花、
 * 电话铃、惊悚音刺等。一个 Convolver 混响模拟走廊空间。
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;

  function AudioSys() {
    this.ctx = null;
    this.master = null;
    this.reverbSend = null;
    this.noiseBuf = null;
    this.droneNodes = null;
    this.roomTone = null;
    this.started = false;
    this.dread = 0;         // 0..1 由游戏更新（影响心跳/耳语密度）
    this.darkness = 0;
    this._hbTimer = 0;
    this._whisperTimer = 10;
    this._creakTimer = 6;
    this._rnd = HZ.rng(777);
  }

  AudioSys.prototype.init = function () {
    if (this.started) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('WebAudio 不可用'); return; }
    try {
      this.ctx = new AC();
    } catch (e) { return; }

    var ctx = this.ctx;
    // 主链：master → compressor → destination
    this.master = ctx.createGain();
    this.master.gain.value = HZ.settings.volume;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // 混响（走廊感）：生成 2.4s 指数衰减噪声 IR
    var len = Math.floor(ctx.sampleRate * 2.4);
    var ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.42;
    this.convolver.connect(this.reverbSend);
    this.reverbSend.connect(this.master);

    // 共享白噪声
    var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var nd = nb.getChannelData(0);
    for (var n = 0; n < nd.length; n++) nd[n] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // 环境底噪（房间空气音）
    this._startRoomTone();
    // 环境嗡鸣（低频 + 中频拍频）
    this._startDrone();

    this.started = true;
  };

  /* 低频环境嗡鸣 */
  AudioSys.prototype._startDrone = function () {
    var ctx = this.ctx;
    var g = ctx.createGain();
    g.gain.value = 0.05;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 130; lp.Q.value = 0.8;
    var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 52;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 52.6; // 拍频
    var o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 104.2;
    var g3 = ctx.createGain(); g3.gain.value = 0.22;
    o1.connect(lp); o2.connect(lp); o3.connect(g3); g3.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    // 缓慢起伏
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    o1.start(); o2.start(); o3.start(); lfo.start();
    this.droneNodes = [o1, o2, o3, lfo, g, lp];
  };

  /* 房间空气音（轻微白噪 + 远处通风） */
  AudioSys.prototype._startRoomTone = function () {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    var g = ctx.createGain(); g.gain.value = 0.012;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this.roomTone = { src: src, gain: g };
  };

  /* ---------------- 播放辅助 ---------------- */

  // 泛音器（含包络）
  AudioSys.prototype._env = function (param, t0, a, d, peak, end) {
    var ctx = this.ctx;
    param.setValueAtTime(0.0001, t0);
    param.linearRampToValueAtTime(peak, t0 + a);
    param.exponentialRampToValueAtTime(Math.max(0.0001, end), t0 + a + d);
  };

  AudioSys.prototype._noise = function (opts) {
    // {dur, filter, freq, q, gain, type, freqEnd, pan}
    var ctx = this.ctx;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = HZ.range(this._rnd, 0.85, 1.15);
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 800, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    f.Q.value = opts.q || 0.7;
    var g = ctx.createGain();
    this._env(g.gain, t, opts.a || 0.01, opts.dur, opts.gain || 0.2, 0.0001);
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(f); f.connect(g);
    if (pan) {
      pan.pan.value = opts.pan || 0;
      g.connect(pan); pan.connect(this.master);
      if (opts.reverb) g.connect(this.convolver);
    } else {
      g.connect(this.master);
      if (opts.reverb) g.connect(this.convolver);
    }
    src.start(t);
    src.stop(t + opts.dur + 0.1);
    return src;
  };

  AudioSys.prototype._tone = function (opts) {
    var ctx = this.ctx;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    var g = ctx.createGain();
    this._env(g.gain, t, opts.a || 0.01, opts.dur, opts.gain || 0.1, 0.0001);
    o.connect(g); g.connect(this.master);
    if (opts.reverb) g.connect(this.convolver);
    o.start(t); o.stop(t + opts.dur + 0.1);
    return o;
  };

  /* ---------------- 具体音效 ---------------- */

  AudioSys.prototype.play = function (name, opt) {
    if (!this.started) return;
    var r = this._rnd;
    switch (name) {

      case 'footstep':
        this._noise({
          dur: 0.12, filter: 'lowpass', freq: HZ.range(r, 300, 520), q: 0.8,
          gain: HZ.range(r, 0.12, 0.2) * (this.darkness > 0.5 ? 1.25 : 1),
          pan: HZ.range(r, -0.3, 0.3), reverb: true
        });
        this._noise({
          dur: 0.06, filter: 'bandpass', freq: HZ.range(r, 900, 1400), q: 2,
          gain: 0.045, pan: HZ.range(r, -0.3, 0.3), reverb: true
        });
        break;

      case 'doorOpen':
        this._tone({ type: 'sawtooth', freq: 84, freqEnd: 142, dur: 0.7, gain: 0.05, reverb: true });
        this._noise({ dur: 0.7, filter: 'bandpass', freq: 240, freqEnd: 520, q: 3, gain: 0.05, reverb: true });
        break;

      case 'doorClose':
        this._tone({ type: 'sawtooth', freq: 138, freqEnd: 74, dur: 0.3, gain: 0.055, reverb: true });
        this._noise({ dur: 0.14, filter: 'lowpass', freq: 260, q: 1, gain: 0.16, reverb: true });
        break;

      case 'rattle':
        for (var i = 0; i < 5; i++) {
          this._noise({
            dur: 0.05, filter: 'bandpass', freq: HZ.range(r, 700, 1300), q: 4,
            gain: 0.07, a: 0.002
          });
        }
        break;

      case 'switch':
        this._noise({ dur: 0.05, filter: 'highpass', freq: 1600, q: 1, gain: 0.14 });
        break;

      case 'paper':
        this._noise({ dur: 0.3, filter: 'highpass', freq: 2400, q: 0.6, gain: 0.07, pan: 0.2 });
        break;

      case 'pickup':
        this._tone({ type: 'square', freq: 620, freqEnd: 930, dur: 0.09, gain: 0.03 });
        this._tone({ type: 'square', freq: 930, dur: 0.06, gain: 0.02, a: 0.09 });
        break;

      case 'tvOn':
        this._noise({ dur: 1.4, filter: 'bandpass', freq: 2400, q: 0.5, gain: 0.1, a: 0.02, freqEnd: 5200 });
        break;

      case 'tvOff':
        this._noise({ dur: 0.2, filter: 'bandpass', freq: 3800, freqEnd: 500, q: 0.6, gain: 0.09 });
        break;

      case 'lightsOut':
        this._tone({ type: 'sine', freq: 300, freqEnd: 60, dur: 1.1, gain: 0.09, reverb: true });
        break;

      case 'thump':
        this._tone({ type: 'sine', freq: opt && opt.freq ? opt.freq : 58, freqEnd: 38, dur: 0.22, gain: 0.5, reverb: true });
        break;

      case 'creak':
        this._tone({
          type: 'sawtooth', freq: HZ.range(r, 60, 100), freqEnd: HZ.range(r, 90, 150),
          dur: HZ.range(r, 0.9, 1.8), gain: 0.028, reverb: true
        });
        break;

      case 'whisper':
        this._whisper(opt);
        break;

      case 'phone':
        for (var p = 0; p < 4; p++) {
          this._tone({ type: 'sine', freq: 440, dur: 0.5, gain: 0.07, a: 0.005 });
          this._tone({ type: 'sine', freq: 480, dur: 0.5, gain: 0.07, a: 0.005 });
        }
        break;

      case 'stinger':
        this._stinger(opt && opt.gain ? opt.gain : 0.5);
        break;

      case 'static':
        this._noise({ dur: opt && opt.dur ? opt.dur : 0.8, filter: 'highpass', freq: 1000, q: 0.3, gain: 0.4, a: 0.01 });
        break;

      case 'breath':
        this._noise({
          dur: 1.6, filter: 'bandpass', freq: 420, q: 2.5,
          gain: 0.16, a: 0.35, reverb: true, pan: opt && opt.pan ? opt.pan : 0
        });
        break;
    }
  };

  /* 耳语：带共振峰扫频的噪声，几乎无法听清 */
  AudioSys.prototype._whisper = function (opt) {
    var ctx = this.ctx;
    var t = ctx.currentTime;
    var dur = (opt && opt.dur) || 2.2;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = HZ.range(this._rnd, 0.6, 1.3);
    var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 6;
    var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1450; f2.Q.value = 8;
    var g = ctx.createGain();
    this._env(g.gain, t, 0.6, dur, 0.05, 0.0001);
    // 元音漂移
    var lfo = ctx.createOscillator(); lfo.frequency.value = HZ.range(this._rnd, 2, 4);
    var lfoG = ctx.createGain(); lfoG.gain.value = 260;
    lfo.connect(lfoG); lfoG.connect(f1.frequency);
    var pan = ctx.createStereoPanner();
    pan.pan.value = (opt && opt.pan) || HZ.range(this._rnd, -0.85, 0.85);
    src.connect(f1); f1.connect(f2); f2.connect(g);
    g.connect(pan); pan.connect(this.master); g.connect(this.convolver);
    src.start(t); src.stop(t + dur + 0.5);
    lfo.start(t); lfo.stop(t + dur + 0.5);
  };

  /* 惊悚音刺：小二度音簇 + 噪声冲击 */
  AudioSys.prototype._stinger = function (gain) {
    var ctx = this.ctx;
    var t = ctx.currentTime;
    var freqs = [196, 208, 311, 466];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freqs[i] * HZ.range(this._rnd, 0.98, 1.02);
      var g = ctx.createGain();
      this._env(g.gain, t, 0.005, 1.6, gain * 0.14, 0.0001);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
      o.connect(f); f.connect(g); g.connect(this.master); g.connect(this.convolver);
      o.start(t); o.stop(t + 1.8);
    }
    this._noise({ dur: 0.4, filter: 'highpass', freq: 900, gain: 0.5, a: 0.002 });
    this._tone({ type: 'sine', freq: 46, freqEnd: 24, dur: 1.2, gain: 0.4, reverb: true });
  };

  /* ---------------- 持续状态：心跳 / 随机耳语 ---------------- */

  AudioSys.prototype.update = function (dt, state) {
    if (!this.started) return;
    this.dread = state.dread;
    this.darkness = state.darkness;

    // 心跳：dread 越高越快越响
    if (this.dread > 0.12) {
      this._hbTimer -= dt;
      if (this._hbTimer <= 0) {
        var rate = HZ.lerp(1.4, 0.55, this.dread);
        this._hbTimer = rate;
        this._tone({ type: 'sine', freq: 52, freqEnd: 34, dur: 0.13, gain: 0.16 + this.dread * 0.3, reverb: true });
        this._tone({ type: 'sine', freq: 46, freqEnd: 30, dur: 0.1, gain: 0.1 + this.dread * 0.22, reverb: true, a: 0.12 });
      }
    }
    // 随机耳语：黑暗中偶尔在耳边响起
    this._whisperTimer -= dt;
    if (this._whisperTimer <= 0) {
      this._whisperTimer = HZ.range(this._rnd, 14, 34) * (1 - this.dread * 0.5);
      if (this.darkness > 0.45 || this.dread > 0.4) {
        this.play('whisper', { dur: HZ.range(this._rnd, 1.4, 3), pan: this._rnd() < 0.5 ? -0.8 : 0.8 });
      }
    }
    // 随机房屋吱嘎声
    this._creakTimer -= dt;
    if (this._creakTimer <= 0) {
      this._creakTimer = HZ.range(this._rnd, 5, 16);
      this.play('creak');
    }
  };

  AudioSys.prototype.setVolume = function (v) {
    HZ.settings.volume = v;
    if (this.master) this.master.gain.value = v;
  };

  AudioSys.prototype.setDread = function (d) { this.dread = HZ.clamp(d, 0, 1); };

  HZ.AudioSys = AudioSys;
})();
