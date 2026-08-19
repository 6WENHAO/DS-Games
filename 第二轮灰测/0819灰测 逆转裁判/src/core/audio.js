/* ============================================================
   audio.js — WebAudio 合成核心
   母线：master → 压缩 → 输出；分 sfx / music / amb 三条支线
   附带程序生成的混响（法庭空间感）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U;
  var A = AA.AUDIO = {};

  A.ctx = null;
  A.ready = false;
  var master, comp, sfxBus, musBus, ambBus, revIn, revOut, hp;
  var waves = {};
  var vol = { master: 0.7, sfx: 1.0, mus: 0.62, amb: 0.5 };

  /* ---------- 自定义波形 ---------- */
  function makePulse(ctx, duty, n) {
    n = n || 24;
    var real = new Float32Array(n), imag = new Float32Array(n);
    for (var i = 1; i < n; i++) {
      // 方波占空比 duty 的傅里叶系数
      imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
      real[i] = (2 / (i * Math.PI)) * (1 - Math.cos(Math.PI * i * duty * 2)) * 0;
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  function makeHarm(ctx, coeffs) {
    var n = coeffs.length + 1;
    var real = new Float32Array(n), imag = new Float32Array(n);
    for (var i = 0; i < coeffs.length; i++) imag[i + 1] = coeffs[i];
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  /* ---------- 混响脉冲 ---------- */
  function makeIR(ctx, dur, decay, damp) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / len;
        var n = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        lp += (n - lp) * (damp || 0.35);
        d[i] = lp;
        // 早期反射
        if (i === Math.floor(len * 0.012) || i === Math.floor(len * 0.031) || i === Math.floor(len * 0.047)) d[i] += (ch ? -1 : 1) * 0.5;
      }
    }
    return buf;
  }

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return A.ctx; }
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    var ctx = A.ctx = new C({ latencyHint: 'interactive' });

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -13; comp.knee.value = 22; comp.ratio.value = 3.2;
    comp.attack.value = 0.004; comp.release.value = 0.18;

    master = ctx.createGain(); master.gain.value = vol.master;

    // 轻微高通去掉直流轰隆
    hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;

    master.connect(comp); comp.connect(hp); hp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = vol.mus; musBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = vol.amb; ambBus.connect(master);

    // 混响
    var conv = ctx.createConvolver();
    conv.buffer = makeIR(ctx, 1.5, 3.2, 0.30);
    revIn = ctx.createGain(); revIn.gain.value = 1;
    revOut = ctx.createGain(); revOut.gain.value = 0.34;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);

    waves.p12 = makePulse(ctx, 0.125);
    waves.p25 = makePulse(ctx, 0.25);
    waves.p50 = makePulse(ctx, 0.5);
    waves.p75 = makePulse(ctx, 0.32);
    waves.organ = makeHarm(ctx, [1, 0.0, 0.55, 0.0, 0.34, 0, 0.2, 0, 0.12]);
    waves.brass = makeHarm(ctx, [1, 0.62, 0.42, 0.3, 0.21, 0.15, 0.11, 0.08, 0.05, 0.04]);
    waves.strings = makeHarm(ctx, [1, 0.5, 0.36, 0.16, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02]);
    waves.bell = makeHarm(ctx, [1, 0.02, 0.5, 0.02, 0.28, 0, 0.16, 0, 0.09, 0, 0.05]);
    waves.vox = makeHarm(ctx, [1, 0.8, 0.62, 0.5, 0.4, 0.33, 0.27, 0.22, 0.18, 0.15, 0.12, 0.1, 0.08]);

    A.ready = true;
    A.buses = { sfx: sfxBus, mus: musBus, amb: ambBus, rev: revIn, master: master };
    if (A.onready) A.onready();
    return ctx;
  };

  A.now = function () { return A.ctx ? A.ctx.currentTime : 0; };
  A.setVolume = function (name, v) {
    vol[name] = v;
    if (!A.ctx) return;
    var g = { master: master, sfx: sfxBus, mus: musBus, amb: ambBus }[name];
    if (g) g.gain.setTargetAtTime(v, A.ctx.currentTime, 0.02);
  };
  A.getVolume = function (n) { return vol[n]; };
  A.wave = function (n) { return waves[n]; };

  /* ---------- 噪声缓冲（共享） ---------- */
  var noiseBuf = null, metalBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    var ctx = A.ctx, len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // 金属噪声（用于木槌/撞击的“质感”）
  function metal() {
    if (metalBuf) return metalBuf;
    var ctx = A.ctx, len = Math.floor(ctx.sampleRate * 0.7);
    metalBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = metalBuf.getChannelData(0);
    var f = [1.0, 1.41, 1.83, 2.29, 2.71, 3.17, 4.13];
    for (var i = 0; i < len; i++) {
      var t = i / ctx.sampleRate, s = 0;
      for (var k = 0; k < f.length; k++) s += Math.sin(2 * Math.PI * 320 * f[k] * t) / (k + 1.6);
      d[i] = s * Math.exp(-t * 9) * 0.5 + (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.3;
    }
    return metalBuf;
  }
  A.noiseBuf = noise;

  /* ---------- 包络工具 ---------- */
  function env(g, t, o) {
    var pk = o.g == null ? 0.3 : o.g;
    var a = o.a == null ? 0.005 : o.a;
    var d = o.d == null ? 0.06 : o.d;
    var s = o.s == null ? 0 : o.s;
    var hold = o.hold == null ? 0 : o.hold;
    var r = o.r == null ? 0.05 : o.r;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    if (s > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, pk * s), t + a + d);
      g.gain.setValueAtTime(Math.max(0.0001, pk * s), t + a + d + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
      return a + d + hold + r;
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return a + d;
  }
  A.env = env;

  function busFor(name) {
    return name === 'mus' ? musBus : (name === 'amb' ? ambBus : sfxBus);
  }

  /* ---------- 单音 ---------- */
  /**
   * o: {t:'square'|'sine'|'sawtooth'|'triangle'|'p12'|'p25'|'p50'|'brass'|...,
   *     f, f2, fT (滑音时长), dur, a,d,s,hold,r, g, pan, bus,
   *     vib:{f,d,delay}, filt:{type,f,f2,q}, rev, detune, when}
   */
  A.tone = function (o) {
    if (!A.ready) return null;
    var ctx = A.ctx, t = o.when || ctx.currentTime;
    var osc = ctx.createOscillator();
    if (waves[o.t]) osc.setPeriodicWave(waves[o.t]);
    else osc.type = o.t || 'square';
    osc.frequency.setValueAtTime(Math.max(8, o.f || 440), t);
    if (o.f2) {
      var fT = o.fT == null ? (o.dur || 0.2) : o.fT;
      if (o.slideLin) osc.frequency.linearRampToValueAtTime(Math.max(8, o.f2), t + fT);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(8, o.f2), t + fT);
    }
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);

    var node = osc, g = ctx.createGain();
    if (o.filt) {
      var bq = ctx.createBiquadFilter();
      bq.type = o.filt.type || 'lowpass';
      bq.frequency.setValueAtTime(o.filt.f || 1200, t);
      if (o.filt.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(20, o.filt.f2), t + (o.filt.fT || o.dur || .2));
      bq.Q.value = o.filt.q || 1;
      node.connect(bq); node = bq;
    }
    node.connect(g);
    var out = g;
    if (o.pan != null && ctx.createStereoPanner) {
      var pn = ctx.createStereoPanner(); pn.pan.value = o.pan; g.connect(pn); out = pn;
    }
    out.connect(busFor(o.bus));
    if (o.rev) { var rg = ctx.createGain(); rg.gain.value = o.rev; out.connect(rg); rg.connect(revIn); }

    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib.f || 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + (o.vib.delay || 0));
      lg.gain.linearRampToValueAtTime(o.vib.d || 6, t + (o.vib.delay || 0) + 0.08);
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + (o.dur || 0.3) + 0.4);
    }

    var total = env(g, t, o);
    var stopAt = t + Math.max(total, o.dur || 0) + 0.05;
    osc.start(t); osc.stop(stopAt);
    return { osc: osc, gain: g, end: stopAt };
  };

  /* ---------- 噪声 ---------- */
  A.noise = function (o) {
    if (!A.ready) return null;
    var ctx = A.ctx, t = o.when || ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = o.buf === 'metal' ? metal() : noise();
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    var node = src;
    if (o.filt) {
      var bq = ctx.createBiquadFilter();
      bq.type = o.filt.type || 'bandpass';
      bq.frequency.setValueAtTime(o.filt.f || 900, t);
      if (o.filt.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(24, o.filt.f2), t + (o.filt.fT || o.dur || 0.2));
      bq.Q.value = o.filt.q == null ? 1 : o.filt.q;
      node.connect(bq); node = bq;
      if (o.filt2) {
        var b2 = ctx.createBiquadFilter();
        b2.type = o.filt2.type || 'lowpass'; b2.frequency.value = o.filt2.f || 4000; b2.Q.value = o.filt2.q || 1;
        node.connect(b2); node = b2;
      }
    }
    var g = ctx.createGain(); node.connect(g);
    var out = g;
    if (o.pan != null && ctx.createStereoPanner) { var pn = ctx.createStereoPanner(); pn.pan.value = o.pan; g.connect(pn); out = pn; }
    out.connect(busFor(o.bus));
    if (o.rev) { var rg = ctx.createGain(); rg.gain.value = o.rev; out.connect(rg); rg.connect(revIn); }
    var total = env(g, t, o);
    var stopAt = t + Math.max(total, o.dur || 0) + 0.05;
    src.start(t, o.offset || (Math.random() * 1.5)); src.stop(stopAt);
    return { src: src, gain: g, end: stopAt };
  };

  /* ---------- 持续噪声（人群 / 环境） ---------- */
  A.loopNoise = function (o) {
    if (!A.ready) return null;
    var ctx = A.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    var bq = ctx.createBiquadFilter(); bq.type = o.type || 'bandpass';
    bq.frequency.value = o.f || 700; bq.Q.value = o.q || 0.8;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(bq); bq.connect(g); g.connect(busFor(o.bus || 'amb'));
    src.start(t);
    // 缓慢起伏
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = 'sine'; lfo.frequency.value = o.wob || 0.27; lg.gain.value = (o.f || 700) * 0.28;
    lfo.connect(lg); lg.connect(bq.frequency); lfo.start(t);
    var lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
    lfo2.type = 'sine'; lfo2.frequency.value = 0.13; lg2.gain.value = (o.g || .2) * 0.4;
    lfo2.connect(lg2); lg2.connect(g.gain); lfo2.start(t);
    return {
      gain: g,
      fadeTo: function (v, dur) { g.gain.setTargetAtTime(v, A.ctx.currentTime, Math.max(0.02, (dur || .5) / 3)); },
      stop: function (dur) {
        g.gain.setTargetAtTime(0, A.ctx.currentTime, Math.max(0.02, (dur || .5) / 3));
        setTimeout(function () { try { src.stop(); lfo.stop(); lfo2.stop(); } catch (e) { } }, (dur || .5) * 1000 + 400);
      }
    };
  };

  /* ---------- 音名 → 频率 ---------- */
  var NOTES = {
    c: 0, 'c#': 1, cs: 1, db: 1, d: 2, 'd#': 3, ds: 3, eb: 3, e: 4, f: 5,
    'f#': 6, fs: 6, gb: 6, g: 7, 'g#': 8, gs: 8, ab: 8, a: 9, 'a#': 10, as: 10, bb: 10, b: 11
  };
  var NOTERE = /^([a-gA-G](?:#|s|b)?)(-?\d)$/;
  A.freq = function (name) {
    if (typeof name === 'number') return name;
    var m = NOTERE.exec(name);
    if (!m) return 440;
    var semi = NOTES[m[1].toLowerCase()] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  };
  A.midi = function (name) {
    var m = NOTERE.exec(name);
    if (!m) return 69;
    return NOTES[m[1].toLowerCase()] + (parseInt(m[2], 10) + 1) * 12;
  };
  A.mf = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  A.suspend = function () { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

})(window.AA);
