/* ============================================================
   sfx.js — 逆转裁判标志性音效（全部实时合成）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, A = AA.AUDIO;
  var S = AA.SFX = {};

  function t0(d) { return A.ready ? A.ctx.currentTime + (d || 0) : 0; }
  function ok() { return A.ready; }

  /* ============ 文字音 ============ */
  var blipFlip = 0;
  S.blip = function () {
    if (!ok()) return;
    blipFlip ^= 1;
    A.tone({
      t: 'p25', f: blipFlip ? 1180 : 1050, f2: blipFlip ? 900 : 820, fT: 0.028,
      dur: 0.03, a: 0.001, d: 0.032, g: 0.062, filt: { type: 'lowpass', f: 3600, q: 0.7 }
    });
  };
  // 关键词/重要句的文字音（略沉）
  S.blipLow = function () {
    if (!ok()) return;
    A.tone({ t: 'p12', f: 700, f2: 560, fT: 0.04, dur: 0.045, a: 0.001, d: 0.05, g: 0.075 });
  };

  /* ============ 光标 / 选择 ============ */
  S.cursor = function () {
    if (!ok()) return;
    A.tone({ t: 'p50', f: 1560, f2: 1980, fT: 0.02, dur: 0.035, a: 0.001, d: 0.04, g: 0.075 });
  };
  S.select = function () {
    if (!ok()) return;
    A.tone({ t: 'p25', f: 880, dur: 0.05, a: 0.001, d: 0.05, g: 0.09 });
    A.tone({ t: 'p25', f: 1320, dur: 0.09, a: 0.002, d: 0.1, g: 0.085, when: t0(0.045) });
    A.tone({ t: 'p12', f: 1760, dur: 0.12, a: 0.002, d: 0.13, g: 0.05, when: t0(0.09) });
  };
  S.cancel = function () {
    if (!ok()) return;
    A.tone({ t: 'p25', f: 620, dur: 0.055, a: 0.001, d: 0.06, g: 0.085 });
    A.tone({ t: 'p25', f: 420, dur: 0.1, a: 0.002, d: 0.11, g: 0.075, when: t0(0.05) });
  };
  S.deny = function () {   // 不可选
    if (!ok()) return;
    A.tone({ t: 'square', f: 200, f2: 150, fT: .12, dur: 0.14, a: .002, d: .15, g: 0.07, filt: { type: 'lowpass', f: 900 } });
  };

  /* ============ 菜单 / 翻页 ============ */
  S.open = function () {
    if (!ok()) return;
    A.noise({ dur: 0.2, a: 0.004, d: 0.2, g: 0.10, filt: { type: 'bandpass', f: 500, f2: 3400, fT: 0.18, q: 0.8 } });
    A.tone({ t: 'p12', f: 520, f2: 1450, fT: 0.13, dur: 0.15, a: 0.003, d: 0.16, g: 0.045 });
  };
  S.close = function () {
    if (!ok()) return;
    A.noise({ dur: 0.18, a: 0.003, d: 0.18, g: 0.09, filt: { type: 'bandpass', f: 3000, f2: 420, fT: 0.16, q: 0.8 } });
    A.tone({ t: 'p12', f: 1300, f2: 460, fT: 0.12, dur: 0.14, a: 0.003, d: 0.15, g: 0.04 });
  };
  S.page = function () {
    if (!ok()) return;
    A.noise({ dur: 0.13, a: 0.002, d: 0.13, g: 0.13, rate: 1.4, filt: { type: 'highpass', f: 1600, q: 0.6 }, filt2: { type: 'lowpass', f: 7000 } });
  };
  S.pop = function (p) {
    if (!ok()) return;
    A.tone({ t: 'sine', f: 780 * (p || 1), f2: 1500 * (p || 1), fT: 0.035, dur: 0.05, a: 0.002, d: 0.055, g: 0.09 });
  };

  /* ============ 汗 / 紧张 ============ */
  S.sweat = function () {
    if (!ok()) return;
    A.tone({ t: 'sine', f: 1500, f2: 520, fT: 0.10, dur: 0.12, a: 0.003, d: 0.13, g: 0.075 });
  };
  S.heartbeat = function () {
    if (!ok()) return;
    A.tone({ t: 'sine', f: 78, f2: 46, fT: 0.13, dur: 0.16, a: 0.006, d: 0.18, g: 0.38, rev: 0.12 });
    A.tone({ t: 'sine', f: 62, f2: 40, fT: 0.14, dur: 0.2, a: 0.008, d: 0.2, g: 0.26, when: t0(0.19) });
  };
  S.clockTick = function () {
    if (!ok()) return;
    A.noise({ dur: 0.03, a: 0.001, d: 0.03, g: 0.10, filt: { type: 'bandpass', f: 2600, q: 6 } });
  };

  /* ============ 撞击 / 拍桌 ============ */
  S.thud = function (power) {
    if (!ok()) return;
    var p = power == null ? 1 : power;
    A.tone({ t: 'sine', f: 128 * p, f2: 44, fT: 0.13, dur: 0.2, a: 0.002, d: 0.22, g: 0.5 * p, rev: 0.18 });
    A.noise({ dur: 0.1, a: 0.001, d: 0.1, g: 0.2 * p, filt: { type: 'lowpass', f: 900, f2: 200, fT: 0.09, q: 1.6 } });
  };
  // 「机バン！」拍桌
  S.slam = function () {
    if (!ok()) return;
    // 低频冲击
    A.tone({ t: 'sine', f: 190, f2: 42, fT: 0.16, dur: 0.24, a: 0.001, d: 0.26, g: 0.62, rev: 0.22 });
    A.tone({ t: 'triangle', f: 320, f2: 90, fT: 0.09, dur: 0.12, a: 0.001, d: 0.13, g: 0.22 });
    // 木质爆裂
    A.noise({ dur: 0.14, a: 0.0008, d: 0.15, g: 0.42, filt: { type: 'bandpass', f: 1500, f2: 320, fT: 0.12, q: 1.1 }, filt2: { type: 'lowpass', f: 5200 }, rev: 0.16 });
    // 高频“啪”
    A.noise({ dur: 0.035, a: 0.0005, d: 0.035, g: 0.3, filt: { type: 'highpass', f: 3200, q: 0.7 } });
  };
  // 木槌
  S.gavel = function (n, gap) {
    if (!ok()) return;
    n = n || 1; gap = gap || 0.30;
    for (var i = 0; i < n; i++) {
      var w = t0(i * gap);
      A.noise({ when: w, buf: 'metal', rate: 1.9, dur: 0.09, a: 0.0006, d: 0.1, g: 0.30, filt: { type: 'bandpass', f: 1700, q: 1.5 }, rev: 0.3 });
      A.tone({ when: w, t: 'triangle', f: 430, f2: 150, fT: 0.07, dur: 0.1, a: 0.0008, d: 0.11, g: 0.34, rev: 0.28 });
      A.tone({ when: w, t: 'sine', f: 150, f2: 62, fT: 0.1, dur: 0.14, a: 0.001, d: 0.15, g: 0.34, rev: 0.2 });
      A.noise({ when: w, dur: 0.03, a: 0.0004, d: 0.03, g: 0.24, filt: { type: 'highpass', f: 2600 } });
    }
  };

  /* ============ 冲击 / 顿悟 ============ */
  // 「ドン！」大冲击（发现矛盾、突入）
  S.shock = function () {
    if (!ok()) return;
    A.tone({ t: 'sine', f: 240, f2: 34, fT: 0.34, dur: 0.5, a: 0.001, d: 0.55, g: 0.66, rev: 0.4 });
    A.tone({ t: 'p12', f: 1400, f2: 220, fT: 0.16, dur: 0.2, a: 0.001, d: 0.22, g: 0.16 });
    A.noise({ dur: 0.42, a: 0.001, d: 0.45, g: 0.34, filt: { type: 'bandpass', f: 2600, f2: 380, fT: 0.38, q: 0.7 }, rev: 0.4 });
    A.noise({ dur: 0.05, a: 0.0005, d: 0.05, g: 0.3, filt: { type: 'highpass', f: 4200 } });
  };
  // 短促惊愕音
  S.sting = function () {
    if (!ok()) return;
    A.tone({ t: 'p25', f: 1760, f2: 1180, fT: 0.06, dur: 0.14, a: 0.001, d: 0.15, g: 0.16 });
    A.tone({ t: 'p25', f: 2340, f2: 1560, fT: 0.06, dur: 0.14, a: 0.001, d: 0.15, g: 0.10, when: t0(0.008) });
    A.noise({ dur: 0.16, a: 0.001, d: 0.17, g: 0.14, filt: { type: 'highpass', f: 3000 } });
  };
  // 顿悟铃
  S.ding = function () {
    if (!ok()) return;
    var f = 1568;
    A.tone({ t: 'bell', f: f, dur: 0.9, a: 0.002, d: 0.95, g: 0.16, rev: 0.4 });
    A.tone({ t: 'bell', f: f * 1.5, dur: 0.7, a: 0.002, d: 0.75, g: 0.09, rev: 0.4, when: t0(0.01) });
    A.tone({ t: 'sine', f: f * 2, dur: 0.5, a: 0.002, d: 0.5, g: 0.05, when: t0(0.02) });
  };
  // 心の声・気づき（低い共鳴）
  S.realize = function () {
    if (!ok()) return;
    A.tone({ t: 'organ', f: 220, dur: 1.2, a: 0.02, d: 1.3, g: 0.11, rev: 0.5 });
    A.tone({ t: 'organ', f: 330, dur: 1.1, a: 0.03, d: 1.2, g: 0.08, rev: 0.5 });
    A.tone({ t: 'bell', f: 1320, dur: 0.6, a: 0.004, d: 0.65, g: 0.07, rev: 0.5, when: t0(0.04) });
  };

  /* ============ 风声 / 划过 ============ */
  S.whoosh = function (dir, power) {
    if (!ok()) return;
    var p = power || 1;
    A.noise({
      dur: 0.3 * p, a: 0.03, d: 0.3 * p, g: 0.18,
      filt: { type: 'bandpass', f: dir < 0 ? 2600 : 500, f2: dir < 0 ? 400 : 3000, fT: 0.28 * p, q: 0.7 },
      pan: dir < 0 ? 0.4 : -0.4
    });
  };
  S.swipe = function () {
    if (!ok()) return;
    A.noise({ dur: 0.16, a: 0.008, d: 0.16, g: 0.16, filt: { type: 'bandpass', f: 900, f2: 4200, fT: 0.14, q: 0.9 } });
  };

  /* ============ 举证 ============ */
  S.present = function () {
    if (!ok()) return;
    A.noise({ dur: 0.22, a: 0.004, d: 0.22, g: 0.2, filt: { type: 'bandpass', f: 700, f2: 4600, fT: 0.2, q: 0.8 } });
    A.tone({ t: 'p12', f: 660, f2: 2640, fT: 0.16, dur: 0.18, a: 0.002, d: 0.19, g: 0.09 });
    A.tone({ t: 'bell', f: 2640, dur: 0.5, a: 0.003, d: 0.55, g: 0.09, rev: 0.3, when: t0(0.16) });
  };
  S.grab = function () {
    if (!ok()) return;
    A.noise({ dur: 0.09, a: 0.002, d: 0.09, g: 0.12, filt: { type: 'bandpass', f: 1400, q: 2 } });
    A.tone({ t: 'p25', f: 980, f2: 1470, fT: 0.05, dur: 0.07, a: 0.002, d: 0.07, g: 0.07 });
  };

  /* ============ ダメージ（ペナルティ） ============ */
  S.damage = function () {
    if (!ok()) return;
    // 从高到低的刺耳蜂鸣
    A.tone({ t: 'sawtooth', f: 880, f2: 92, fT: 0.42, dur: 0.5, a: 0.001, d: 0.55, g: 0.26, filt: { type: 'lowpass', f: 2600, f2: 500, fT: 0.45, q: 3 }, rev: 0.2 });
    A.tone({ t: 'square', f: 440, f2: 60, fT: 0.44, dur: 0.5, a: 0.001, d: 0.55, g: 0.18 });
    A.tone({ t: 'sine', f: 180, f2: 32, fT: 0.4, dur: 0.55, a: 0.001, d: 0.6, g: 0.5, rev: 0.3 });
    A.noise({ dur: 0.4, a: 0.001, d: 0.45, g: 0.24, filt: { type: 'bandpass', f: 1800, f2: 260, fT: 0.4, q: 0.6 } });
  };
  S.lifeLost = function () {
    if (!ok()) return;
    A.tone({ t: 'p12', f: 1200, f2: 300, fT: 0.2, dur: 0.24, a: 0.001, d: 0.25, g: 0.12 });
    A.noise({ dur: 0.2, a: 0.001, d: 0.22, g: 0.14, filt: { type: 'highpass', f: 2200 } });
  };
  S.gameover = function () {
    if (!ok()) return;
    var seq = [['a3', 0], ['g3', .18], ['f3', .36], ['e3', .54], ['d3', .78], ['a2', 1.1]];
    for (var i = 0; i < seq.length; i++) {
      A.tone({ t: 'organ', f: A.freq(seq[i][0]), dur: .5, a: .01, d: .6, g: .14, rev: .45, when: t0(seq[i][1]) });
      A.tone({ t: 'p25', f: A.freq(seq[i][0]) * 2, dur: .3, a: .01, d: .35, g: .05, when: t0(seq[i][1]) });
    }
    A.tone({ t: 'sine', f: 55, dur: 2.4, a: .05, d: 2.6, g: .3, rev: .4, when: t0(1.1) });
  };

  /* ============ 崩壊 ============ */
  S.breakdown = function () {
    if (!ok()) return;
    A.noise({ dur: 1.5, a: 0.05, d: 1.6, g: 0.3, filt: { type: 'lowpass', f: 3600, f2: 180, fT: 1.5, q: 2 }, rev: 0.5 });
    A.tone({ t: 'sawtooth', f: 300, f2: 26, fT: 1.4, dur: 1.5, a: 0.02, d: 1.6, g: 0.22, filt: { type: 'lowpass', f: 1800, f2: 200, fT: 1.4, q: 4 } });
    A.tone({ t: 'sine', f: 90, f2: 22, fT: 1.4, dur: 1.6, a: 0.03, d: 1.7, g: 0.5, rev: 0.4 });
    for (var i = 0; i < 7; i++) {
      A.noise({ when: t0(0.1 + i * 0.17 + Math.random() * .05), dur: 0.1, a: 0.001, d: 0.11, g: 0.16, filt: { type: 'bandpass', f: 400 + Math.random() * 1800, q: 1.4 } });
    }
  };
  S.rumble = function (dur) {
    if (!ok()) return;
    dur = dur || 1.2;
    A.noise({ dur: dur, a: 0.15, d: dur, g: 0.3, filt: { type: 'lowpass', f: 160, q: 1.4 }, rev: 0.3 });
  };
  S.thunder = function () {
    if (!ok()) return;
    A.noise({ dur: 0.09, a: 0.001, d: 0.1, g: 0.4, filt: { type: 'highpass', f: 2800 } });
    A.noise({ dur: 1.8, a: 0.02, d: 2.0, g: 0.36, filt: { type: 'lowpass', f: 900, f2: 120, fT: 1.7, q: 1.2 }, rev: 0.6 });
    A.tone({ t: 'sine', f: 60, f2: 24, fT: 1.4, dur: 1.6, a: 0.02, d: 1.7, g: 0.45, rev: 0.4 });
  };

  /* ============ 扉 / 足音 ============ */
  S.doorOpen = function () {
    if (!ok()) return;
    A.noise({ dur: 0.5, a: 0.03, d: 0.5, g: 0.13, filt: { type: 'bandpass', f: 320, f2: 900, fT: 0.45, q: 1.6 } });
    A.tone({ t: 'triangle', f: 140, f2: 210, fT: 0.4, dur: 0.45, a: 0.03, d: 0.5, g: 0.08 });
  };
  S.doorClose = function () {
    if (!ok()) return;
    A.noise({ dur: 0.3, a: 0.02, d: 0.3, g: 0.12, filt: { type: 'bandpass', f: 800, f2: 260, fT: 0.26, q: 1.4 } });
    S.thud(0.7);
  };
  S.step = function (i) {
    if (!ok()) return;
    A.noise({ dur: 0.08, a: 0.001, d: 0.085, g: 0.11, filt: { type: 'bandpass', f: 380 + (i % 2) * 90, q: 1.8 }, rev: 0.14 });
    A.tone({ t: 'sine', f: 100, f2: 60, fT: 0.06, dur: 0.08, a: 0.001, d: 0.09, g: 0.14 });
  };

  /* ============ 群衆 ============ */
  var crowd = null;
  S.crowdStart = function (level) {
    if (!ok()) return;
    if (crowd) { crowd.fadeTo(level == null ? 0.16 : level, 0.6); return; }
    crowd = A.loopNoise({ f: 620, q: 0.55, wob: 0.31, g: 0.16, bus: 'amb' });
    crowd.fadeTo(level == null ? 0.16 : level, 1.2);
  };
  S.crowdLevel = function (v, dur) { if (crowd) crowd.fadeTo(v, dur || 0.6); };
  S.crowdStop = function (dur) { if (crowd) { crowd.stop(dur || 0.8); crowd = null; } };
  // ざわっ！（一斉にどよめく）
  S.murmur = function () {
    if (!ok()) return;
    A.noise({ dur: 1.1, a: 0.06, d: 1.15, g: 0.26, filt: { type: 'bandpass', f: 700, f2: 480, fT: 1.0, q: 0.5 }, rev: 0.35 });
    A.noise({ dur: 0.9, a: 0.09, d: 0.95, g: 0.14, filt: { type: 'bandpass', f: 1500, f2: 900, fT: 0.85, q: 0.7 }, when: t0(0.05) });
  };
  S.gasp = function () {
    if (!ok()) return;
    A.noise({ dur: 0.5, a: 0.02, d: 0.52, g: 0.24, filt: { type: 'bandpass', f: 1100, f2: 2100, fT: 0.2, q: 0.6 }, rev: 0.3 });
  };
  S.cheer = function () {
    if (!ok()) return;
    A.noise({ dur: 2.6, a: 0.12, d: 2.7, g: 0.3, filt: { type: 'bandpass', f: 1300, q: 0.5 }, rev: 0.4 });
    A.noise({ dur: 2.6, a: 0.2, d: 2.7, g: 0.2, filt: { type: 'highpass', f: 2600 }, rev: 0.4 });
    for (var i = 0; i < 26; i++) {
      A.noise({ when: t0(Math.random() * 2.2), dur: 0.05, a: 0.002, d: 0.05, g: 0.05, filt: { type: 'bandpass', f: 1800 + Math.random() * 2600, q: 3 } });
    }
  };
  // 紙吹雪
  S.confetti = function () {
    if (!ok()) return;
    for (var i = 0; i < 30; i++) {
      A.noise({ when: t0(Math.random() * 1.6), dur: 0.06, a: 0.004, d: 0.06, g: 0.045, rate: 1.6, filt: { type: 'highpass', f: 3200 }, pan: Math.random() * 2 - 1 });
    }
  };

  /* ============ 叫び（異議あり！等）── フォルマント合成 ============ */
  var VOWEL = {
    a: [730, 1090, 2440, 3400], A: [850, 1220, 2810, 3500],
    e: [530, 1840, 2480, 3500], i: [300, 2290, 3010, 3600],
    o: [570, 840, 2410, 3300], u: [330, 900, 2200, 3300],
    y: [400, 1900, 2600, 3400],   // 「异」的 i 介音
    n: [320, 1300, 2400, 3300],
    E: [660, 1720, 2410, 3400]
  };

  /**
   * syls: [{v:'a', d:0.16, p:1.0, cons:null|'k'|'sh'|'t'|'g'|'d'}]
   * o: {f0, gender:'m'|'f', gain, rough}
   */
  S.speak = function (syls, o) {
    if (!ok()) return 0;
    o = o || {};
    var ctx = A.ctx, t = t0(0);
    var f0 = o.f0 || (o.gender === 'f' ? 340 : 190);
    var gain = (o.gain == null ? 1 : o.gain);
    var total = 0; for (var i = 0; i < syls.length; i++) total += syls[i].d;

    // 声源：富含泛音的锯齿 + 次谐波
    var src = ctx.createOscillator();
    src.setPeriodicWave(A.wave('vox'));
    var sub = ctx.createOscillator(); sub.type = 'square';

    var srcGain = ctx.createGain(); srcGain.gain.value = 0.55;
    var subGain = ctx.createGain(); subGain.gain.value = 0.16;

    // 粗糙度（喊叫的破音）
    var shaper = ctx.createWaveShaper();
    var curve = new Float32Array(1024), k = o.rough == null ? 4.2 : o.rough;
    for (var ci = 0; ci < 1024; ci++) {
      var x = ci / 512 - 1;
      curve[ci] = Math.tanh(x * k) / Math.tanh(k);
    }
    shaper.curve = curve; shaper.oversample = '2x';

    var mixIn = ctx.createGain(); mixIn.gain.value = 1;
    src.connect(srcGain); srcGain.connect(shaper);
    sub.connect(subGain); subGain.connect(shaper);
    shaper.connect(mixIn);

    // 气声（让喊声更有力）
    var breath = ctx.createBufferSource(); breath.buffer = A.noiseBuf(); breath.loop = true;
    var bhp = ctx.createBiquadFilter(); bhp.type = 'bandpass'; bhp.frequency.value = 1800; bhp.Q.value = 0.6;
    var bg = ctx.createGain(); bg.gain.value = 0.10;
    breath.connect(bhp); bhp.connect(bg); bg.connect(mixIn);

    // 4 个共振峰
    var out = ctx.createGain();
    var fs = [], fg = [];
    var FGAIN = [1.0, 0.62, 0.32, 0.14];
    for (var b = 0; b < 4; b++) {
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = b === 0 ? 7 : (b === 1 ? 9 : 11);
      var g2 = ctx.createGain(); g2.gain.value = FGAIN[b];
      mixIn.connect(bp); bp.connect(g2); g2.connect(out);
      fs.push(bp); fg.push(g2);
    }
    // 直通一点点让声音更厚
    var thru = ctx.createGain(); thru.gain.value = 0.10;
    var tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 900;
    mixIn.connect(tlp); tlp.connect(thru); thru.connect(out);

    var amp = ctx.createGain(); amp.gain.value = 0.0001;
    out.connect(amp);
    var pre = ctx.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 130;
    amp.connect(pre);
    var post = ctx.createGain(); post.gain.value = 1.55 * gain;
    pre.connect(post);
    post.connect(A.buses.sfx);
    var rg = ctx.createGain(); rg.gain.value = 0.42; post.connect(rg); rg.connect(A.buses.rev);

    // 音高轮廓：起音冲高 → 缓降（喊叫）
    src.frequency.setValueAtTime(f0 * 1.22, t);
    src.frequency.linearRampToValueAtTime(f0 * 1.04, t + total * 0.28);
    sub.frequency.setValueAtTime(f0 * 0.5 * 1.22, t);
    sub.frequency.linearRampToValueAtTime(f0 * 0.5 * 1.04, t + total * 0.28);

    var cur = t;
    for (var si = 0; si < syls.length; si++) {
      var sy = syls[si];
      var V = VOWEL[sy.v] || VOWEL.a;
      var pitch = (sy.p == null ? 1 : sy.p);
      var next = cur + sy.d;
      // 共振峰过渡
      for (var q = 0; q < 4; q++) {
        var fv = V[q] * (o.gender === 'f' ? 1.14 : 1);
        if (si === 0) fs[q].frequency.setValueAtTime(fv, cur);
        else fs[q].frequency.linearRampToValueAtTime(fv, cur + Math.min(0.05, sy.d * .4));
      }
      // 音高（每个音节）
      src.frequency.linearRampToValueAtTime(f0 * pitch, cur + sy.d * 0.35);
      sub.frequency.linearRampToValueAtTime(f0 * 0.5 * pitch, cur + sy.d * 0.35);
      // 音量：辅音→元音
      var atk = sy.cons ? 0.022 : 0.012;
      if (si === 0) {
        amp.gain.setValueAtTime(0.0001, cur);
      } else {
        amp.gain.linearRampToValueAtTime(sy.cons ? 0.06 : 0.5, cur);
      }
      amp.gain.linearRampToValueAtTime(1.0, cur + atk);
      amp.gain.setValueAtTime(1.0, next - sy.d * 0.30);
      amp.gain.linearRampToValueAtTime(si === syls.length - 1 ? 0.0001 : 0.72, next);

      // 辅音噪声
      if (sy.cons) {
        var cf = { k: 2400, t: 3600, sh: 2600, s: 5200, g: 1500, d: 1900, h: 1400, y: 2600 }[sy.cons] || 2400;
        var cd = (sy.cons === 'sh' || sy.cons === 's') ? 0.075 : 0.028;
        A.noise({
          when: cur - cd * 0.7, dur: cd, a: 0.002, d: cd, g: 0.14,
          filt: { type: 'bandpass', f: cf, q: sy.cons === 'sh' ? 1.2 : 2.4 }
        });
      }
      cur = next;
    }
    // 结尾颤音 + 收束
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 6.4; lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + total * 0.5);
    lg.gain.linearRampToValueAtTime(f0 * 0.045, t + total);
    lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + total + 0.3);

    amp.gain.linearRampToValueAtTime(0.0001, t + total + 0.06);
    src.start(t); sub.start(t); breath.start(t, Math.random());
    var stop = t + total + 0.2;
    src.stop(stop); sub.stop(stop); breath.stop(stop);
    return total;
  };

  /* 三种喊声（中文台词） */
  S.shout = function (kind, gender) {
    if (!ok()) return 0;
    // 冲击铺底
    A.noise({ dur: 0.16, a: 0.001, d: 0.17, g: 0.3, filt: { type: 'bandpass', f: 1600, f2: 320, fT: 0.14, q: 1 } });
    A.tone({ t: 'sine', f: 170, f2: 40, fT: 0.2, dur: 0.26, a: 0.001, d: 0.28, g: 0.5, rev: 0.3 });
    var g = gender || 'm';
    var d;
    if (kind === 'holdit') {          // 等 一 下！
      d = S.speak([
        { v: 'E', d: 0.15, p: 1.16, cons: 'd' },
        { v: 'i', d: 0.13, p: 1.06, cons: 'y' },
        { v: 'a', d: 0.30, p: 0.95, cons: 'h' }
      ], { gender: g, gain: 1.0, f0: g === 'f' ? 360 : 196 });
    } else if (kind === 'takethat') { // 看 这 个！
      d = S.speak([
        { v: 'a', d: 0.16, p: 1.14, cons: 'k' },
        { v: 'e', d: 0.14, p: 1.02, cons: 't' },
        { v: 'o', d: 0.30, p: 0.92, cons: 'g' }
      ], { gender: g, gain: 1.0, f0: g === 'f' ? 350 : 192 });
    } else {                          // 异 议 ！
      d = S.speak([
        { v: 'y', d: 0.19, p: 1.20, cons: null },
        { v: 'i', d: 0.42, p: 1.02, cons: 'y' }
      ], { gender: g, gain: 1.08, f0: g === 'f' ? 372 : 200, rough: 5.0 });
    }
    return d;
  };

  /* ============ 判決 ============ */
  S.verdict = function () {
    if (!ok()) return;
    S.gavel(3, 0.34);
    setTimeout(function () { S.cheer(); S.confetti(); }, 900);
  };
  S.fanfare = function () {
    if (!ok()) return;
    var ns = ['c5', 'e5', 'g5', 'c6'], tt = [0, .1, .2, .34];
    for (var i = 0; i < 4; i++) {
      A.tone({ t: 'brass', f: A.freq(ns[i]), dur: i === 3 ? .8 : .14, a: .005, d: i === 3 ? .85 : .16, g: .14, rev: .3, when: t0(tt[i]) });
      A.tone({ t: 'p50', f: A.freq(ns[i]) / 2, dur: i === 3 ? .8 : .14, a: .005, d: i === 3 ? .85 : .16, g: .07, when: t0(tt[i]) });
    }
    A.noise({ when: t0(.34), dur: .6, a: .004, d: .65, g: .12, filt: { type: 'highpass', f: 4000 } });
  };

  /* ============ 电台 / 场景环境 ============ */
  var hum = null;
  S.humStart = function (f, g) {
    if (!ok()) return;
    if (hum) return;
    var ctx = A.ctx;
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f || 60;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = (f || 60) * 2;
    var gg = ctx.createGain(); gg.gain.value = 0;
    var g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(gg); o2.connect(g2); g2.connect(gg); gg.connect(A.buses.amb);
    o.start(); o2.start();
    gg.gain.setTargetAtTime(g == null ? 0.09 : g, ctx.currentTime, 0.5);
    hum = { o: o, o2: o2, g: gg };
  };
  S.humStop = function () {
    if (!hum) return;
    hum.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3);
    var h = hum; hum = null;
    setTimeout(function () { try { h.o.stop(); h.o2.stop(); } catch (e) { } }, 1200);
  };
  S.staticBurst = function () {
    if (!ok()) return;
    A.noise({ dur: 0.4, a: 0.005, d: 0.42, g: 0.12, filt: { type: 'highpass', f: 1400 }, filt2: { type: 'lowpass', f: 6000 } });
  };
  S.tapeStop = function () {
    if (!ok()) return;
    A.noise({ dur: 0.12, a: 0.002, d: 0.13, g: 0.1, filt: { type: 'bandpass', f: 900, q: 2 } });
    A.tone({ t: 'square', f: 320, f2: 60, fT: 0.3, dur: 0.34, a: 0.004, d: 0.36, g: 0.07, filt: { type: 'lowpass', f: 1400 } });
  };

  S.stopAll = function () { S.crowdStop(0.2); S.humStop(); };

})(window.AA);
