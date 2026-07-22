/* ============================================================
 * 真·三國無雙 WEB —— WebAudio 音效引擎 + 摇滚BGM
 * ============================================================ */
'use strict';

var SFX = (function () {
  var ctx = null;
  var master, sfxBus, bgmBus;
  var noiseBuf = null;
  var enabled = true, bgmOn = true;
  var bgmTimer = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.4; bgmBus.connect(master);

    var len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function noise(dur, filterType, freq, q, gain, t0) {
    if (!ctx) return;
    t0 = t0 || ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
    return { src: src, filter: f, gain: g };
  }

  function tone(type, f0, f1, dur, gain, t0, bus) {
    if (!ctx) return;
    t0 = t0 || ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  var S = {};
  S.init = init;
  S.isOn = function () { return enabled; };
  S.toggle = function () { enabled = !enabled; if (master) master.gain.value = enabled ? 0.55 : 0; return enabled; };

  /* ---------- 战斗音效 ---------- */
  S.swing = function () {
    if (!ctx || !enabled) return;
    var n = noise(0.12, 'bandpass', 1800 + Math.random() * 800, 2.5, 0.25);
    if (n) n.filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.12);
  };
  S.hit = function (heavy) {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('square', heavy ? 150 : 220, 60, 0.09, heavy ? 0.4 : 0.28, t);
    noise(heavy ? 0.18 : 0.1, 'lowpass', heavy ? 900 : 1400, 1, heavy ? 0.5 : 0.32, t);
    if (heavy) tone('sine', 80, 35, 0.22, 0.5, t);
  };
  S.clang = function () { // 打中武将/格挡
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('triangle', 2400, 1200, 0.1, 0.2, t);
    tone('square', 1320, 880, 0.13, 0.12, t);
    noise(0.1, 'highpass', 3500, 1, 0.18, t);
  };
  S.kill = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    noise(0.25, 'lowpass', 700, 1, 0.3, t);
    tone('sawtooth', 300, 90, 0.22, 0.12, t);
  };
  S.stun = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('sine', 900, 1400, 0.3, 0.12, t);
  };
  S.jump = function () {
    if (!ctx || !enabled) return;
    noise(0.1, 'bandpass', 900, 2, 0.1);
  };
  S.guard = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('square', 1600, 1100, 0.08, 0.16, t);
    noise(0.06, 'highpass', 4000, 1, 0.14, t);
  };
  S.hurt = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('sawtooth', 200, 90, 0.18, 0.3, t);
    noise(0.15, 'lowpass', 1200, 1, 0.3, t);
  };

  /* ---------- 系统音效 ---------- */
  S.cursor = function () { if (ctx && enabled) tone('square', 880, 880, 0.05, 0.12); };
  S.select = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('square', 660, 660, 0.07, 0.15, t);
    tone('square', 990, 990, 0.12, 0.15, t + 0.07);
  };
  S.pickup = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('sine', 780, 780, 0.08, 0.2, t);
    tone('sine', 1170, 1170, 0.14, 0.2, t + 0.08);
  };
  S.powerup = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone('square', f, f, 0.12, 0.14, t + i * 0.07);
    });
  };
  S.musou = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('sawtooth', 100, 500, 0.5, 0.3, t);
    noise(0.6, 'bandpass', 400, 1.5, 0.3, t);
    tone('sine', 55, 55, 0.7, 0.4, t);
  };
  S.musouFin = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('sine', 70, 30, 0.5, 0.6, t);
    noise(0.5, 'lowpass', 800, 1, 0.55, t);
    tone('sawtooth', 400, 100, 0.4, 0.2, t);
  };
  S.lightning = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    noise(0.35, 'highpass', 1800, 1, 0.35, t);
    tone('sawtooth', 1200, 100, 0.3, 0.25, t);
    tone('sine', 60, 30, 0.4, 0.4, t + 0.05);
  };
  S.arrowShot = function () { if (ctx && enabled) noise(0.09, 'bandpass', 2500, 3, 0.1); };

  /* ---------- 敌将讨取小号角 ---------- */
  S.fanfare = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    var notes = [[523, 0, 0.12], [523, 0.13, 0.12], [659, 0.26, 0.14], [784, 0.42, 0.3]];
    notes.forEach(function (n) {
      tone('square', n[0], n[0], n[2], 0.16, t + n[1]);
      tone('sawtooth', n[0] / 2, n[0] / 2, n[2], 0.1, t + n[1]);
    });
  };
  S.baseCapture = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    [392, 523, 659].forEach(function (f, i) { tone('square', f, f, 0.14, 0.14, t + i * 0.09); });
  };
  S.alert = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    tone('square', 440, 440, 0.15, 0.15, t);
    tone('square', 349, 349, 0.25, 0.15, t + 0.17);
  };
  S.victory = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    var seq = [[523, 0, 0.18], [659, 0.2, 0.18], [784, 0.4, 0.18], [1047, 0.6, 0.5], [784, 1.15, 0.15], [1047, 1.32, 0.7]];
    seq.forEach(function (n) {
      tone('square', n[0], n[0], n[2], 0.18, t + n[1]);
      tone('triangle', n[0] * 2, n[0] * 2, n[2], 0.08, t + n[1]);
    });
  };
  S.defeat = function () {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    [[440, 0], [415, 0.5], [392, 1.0], [330, 1.5]].forEach(function (n) {
      tone('sawtooth', n[0], n[0], 0.55, 0.14, t + n[1]);
      tone('sawtooth', n[0] / 2, n[0] / 2, 0.55, 0.12, t + n[1]);
    });
  };

  /* ============ BGM：摇滚战斗曲 ============ */
  // E小调五声：E G A B D
  var BPM = 140;
  var STEP = 60 / BPM / 4;          // 16分音符
  var BARS = 8;
  var curStep = 0;
  var nextTime = 0;

  // 音高表
  function nfreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var E1 = 28, E2 = 40; // MIDI

  // 贝斯线（每小节16步，音符=midi或null）
  var bassPat = [
    [E2,null,E2,null, E2,null,null,E2, null,E2,null,null, E2,null,43,45],
    [E2,null,E2,null, E2,null,null,E2, null,E2,null,null, 43,null,45,47],
    [36,null,36,null, 36,null,null,36, null,36,null,null, 36,null,38,40],
    [38,null,38,null, 38,null,null,38, null,38,null,null, 40,null,43,45],
    [E2,null,E2,null, E2,null,null,E2, null,E2,null,null, E2,null,43,45],
    [E2,null,E2,null, E2,null,null,E2, null,E2,null,null, 43,null,45,47],
    [36,null,36,null, 36,null,null,36, null,38,null,null, 38,null,40,41],
    [43,null,43,null, 43,null,null,43, null,45,null,47, 47,null,47,null]
  ];
  // 强力和弦（根音midi，在步0和8）
  var chordRoots = [52, 52, 48, 50, 52, 52, 48, 55];
  // 主音旋律（中国风五声）
  var leadPat = [
    [76,null,null,79, 81,null,79,null, 76,null,74,null, 76,null,null,null],
    [74,null,76,null, 79,null,76,null, 74,null,71,null, 74,null,null,null],
    [72,null,null,72, 74,null,76,null, 74,null,72,null, 69,null,71,null],
    [74,null,null,null, 71,null,74,null, 76,null,74,null, 71,null,69,null],
    [76,null,null,79, 81,null,83,null, 81,null,79,null, 76,null,null,null],
    [79,null,81,null, 83,null,81,null, 79,null,76,null, 74,null,76,null],
    [72,null,74,null, 76,null,74,null, 72,null,71,null, 69,null,67,null],
    [71,null,74,null, 76,null,79,null, 83,null,81,null, 79,null,76,null]
  ];

  function distCurve(amt) {
    var n = 256, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i * 2 / n - 1;
      curve[i] = (3 + amt) * x * 20 * (Math.PI / 180) / (Math.PI + amt * Math.abs(x));
    }
    return curve;
  }
  var shaper = null;

  function schedStep(step, t) {
    var bar = Math.floor(step / 16) % BARS;
    var s = step % 16;

    // 鼓
    if (s % 8 === 0 || s === 10) { // 底鼓
      tone('sine', 130, 40, 0.14, 0.6, t, bgmBus);
    }
    if (s === 4 || s === 12) { // 军鼓
      noise(0.12, 'bandpass', 1800, 1, 0.3, t);
      tone('triangle', 220, 180, 0.08, 0.15, t, bgmBus);
    }
    if (s % 2 === 0) { // 踩镲
      noise(0.03, 'highpass', 8000, 1, s % 4 === 0 ? 0.1 : 0.06, t);
    }

    // 贝斯
    var bn = bassPat[bar][s];
    if (bn !== null && bn !== undefined) {
      tone('sawtooth', nfreq(bn), nfreq(bn), STEP * 1.8, 0.22, t, bgmBus);
    }

    // 强力和弦
    if (s === 0 || s === 8) {
      var root = chordRoots[bar];
      [0, 7, 12].forEach(function (iv) {
        var f = nfreq(root + iv);
        var o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f;
        o.detune.value = (Math.random() - 0.5) * 12;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 7);
        if (!shaper) { shaper = ctx.createWaveShaper(); shaper.curve = distCurve(40); shaper.connect(bgmBus); }
        o.connect(g); g.connect(shaper);
        o.start(t); o.stop(t + STEP * 8);
      });
    }

    // 主旋律
    var ln = leadPat[bar][s];
    if (ln !== null && ln !== undefined) {
      tone('square', nfreq(ln), nfreq(ln), STEP * 2.5, 0.11, t, bgmBus);
      tone('sawtooth', nfreq(ln - 12), nfreq(ln - 12), STEP * 2.5, 0.05, t, bgmBus);
    }
  }

  S.startBGM = function () {
    if (!ctx || bgmTimer || !bgmOn) return;
    curStep = 0;
    nextTime = ctx.currentTime + 0.1;
    bgmTimer = setInterval(function () {
      if (!ctx) return;
      while (nextTime < ctx.currentTime + 0.15) {
        if (enabled && bgmOn) schedStep(curStep, nextTime);
        nextTime += STEP;
        curStep++;
      }
    }, 40);
  };
  S.stopBGM = function () {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  };
  S.toggleBGM = function () {
    bgmOn = !bgmOn;
    if (bgmOn) S.startBGM(); else S.stopBGM();
    return bgmOn;
  };
  S.bgmIsOn = function () { return bgmOn; };

  return S;
})();
