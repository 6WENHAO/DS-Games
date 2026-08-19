/* ============================================================
   music.js — 芯片音乐音序器 + 原创曲目（逆转裁判风格）
   记谱：以 16 分音符为一格的字符串
         "a4"=发音  "."=延音  "-"=休止  "|"=小节线(忽略)
         鼓轨：k 大鼓 / s 小鼓 / h 闭镲 / H 开镲 / c 钹 / t 桶鼓 / r 边击
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, A = AA.AUDIO;
  var M = AA.MUSIC = {};

  /* ---------------- 乐器 ---------------- */
  function susEnv(dur, o) {
    o = o || {};
    var a = o.a == null ? 0.006 : o.a;
    var d = o.d == null ? 0.045 : o.d;
    var s = o.s == null ? 0.72 : o.s;
    var r = o.r == null ? 0.09 : o.r;
    var hold = Math.max(0, dur - a - d - r * 0.4);
    return { a: a, d: d, s: s, hold: hold, r: r };
  }

  var INST = {
    /* 脉冲波主旋律 */
    pulse: function (p, f, dur, when) {
      var e = susEnv(dur, p.env);
      A.tone({
        t: p.wave || 'p25', f: f, dur: dur, when: when, bus: 'mus',
        a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r,
        g: p.gain, pan: p.pan, rev: p.rev,
        vib: p.vib === false ? null : { f: p.vibF || 5.4, d: p.vibD || (f * 0.008), delay: Math.min(0.16, dur * 0.4) },
        filt: p.filt
      });
    },
    /* 短促跳音（和弦刺 / 拨弦） */
    stab: function (p, f, dur, when) {
      A.tone({
        t: p.wave || 'p25', f: f, dur: dur, when: when, bus: 'mus',
        a: 0.003, d: Math.min(dur * 0.95, 0.22), g: p.gain, pan: p.pan, rev: p.rev,
        filt: p.filt || { type: 'lowpass', f: 5200, q: 0.8 }
      });
    },
    /* 贝斯 */
    bass: function (p, f, dur, when) {
      var e = susEnv(dur, { a: 0.004, d: 0.05, s: 0.6, r: 0.05 });
      A.tone({
        t: p.wave || 'triangle', f: f, dur: dur, when: when, bus: 'mus',
        a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain, pan: p.pan,
        filt: p.filt || { type: 'lowpass', f: 1500, q: 1.2 }
      });
      if (p.click !== false) {
        A.tone({ t: 'square', f: f * 2, dur: 0.03, when: when, bus: 'mus', a: 0.001, d: 0.035, g: p.gain * 0.28 });
      }
    },
    /* 铜管（开庭用） */
    brass: function (p, f, dur, when) {
      var e = susEnv(dur, { a: 0.028, d: 0.07, s: 0.8, r: 0.12 });
      A.tone({
        t: 'brass', f: f, dur: dur, when: when, bus: 'mus',
        a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain, pan: p.pan, rev: p.rev == null ? 0.24 : p.rev,
        filt: { type: 'lowpass', f: 3400, q: 0.9 },
        vib: { f: 4.6, d: f * 0.006, delay: 0.2 }
      });
    },
    /* 弦乐衬底 */
    strings: function (p, f, dur, when) {
      var e = susEnv(dur, { a: 0.14, d: 0.1, s: 0.86, r: 0.3 });
      A.tone({
        t: 'strings', f: f, dur: dur, when: when, bus: 'mus',
        a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain, pan: p.pan, rev: p.rev == null ? 0.35 : p.rev,
        filt: { type: 'lowpass', f: 2600, q: 0.7 }, vib: { f: 4.1, d: f * 0.005, delay: 0.3 }
      });
      A.tone({
        t: 'strings', f: f * 1.005, dur: dur, when: when, bus: 'mus',
        a: e.a * 1.3, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain * 0.6, pan: p.pan ? -p.pan : 0.2, rev: 0.3,
        filt: { type: 'lowpass', f: 2200 }
      });
    },
    /* 管风琴（庄严） */
    organ: function (p, f, dur, when) {
      var e = susEnv(dur, { a: 0.02, d: 0.05, s: 0.9, r: 0.16 });
      A.tone({ t: 'organ', f: f, dur: dur, when: when, bus: 'mus', a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain, pan: p.pan, rev: p.rev == null ? 0.4 : p.rev });
    },
    /* 电钢/铃（回忆） */
    bell: function (p, f, dur, when) {
      A.tone({ t: 'bell', f: f, dur: dur, when: when, bus: 'mus', a: 0.004, d: Math.max(0.5, dur * 1.1), g: p.gain, pan: p.pan, rev: p.rev == null ? 0.35 : p.rev });
    },
    /* 锯齿主音（追い詰め） */
    saw: function (p, f, dur, when) {
      var e = susEnv(dur, { a: 0.006, d: 0.06, s: 0.7, r: 0.08 });
      A.tone({
        t: 'sawtooth', f: f, dur: dur, when: when, bus: 'mus',
        a: e.a, d: e.d, s: e.s, hold: e.hold, r: e.r, g: p.gain, pan: p.pan, rev: p.rev,
        filt: { type: 'lowpass', f: p.cut || 3000, q: p.q || 3.2 },
        vib: { f: 5.8, d: f * 0.007, delay: 0.12 }
      });
    },
    /* 鼓组 */
    drum: function (p, tok, dur, when) {
      var g = p.gain;
      switch (tok) {
        case 'k':
          A.tone({ t: 'sine', f: 130, f2: 46, fT: 0.09, dur: 0.16, when: when, bus: 'mus', a: 0.001, d: 0.17, g: g * 1.5 });
          A.noise({ dur: 0.03, when: when, bus: 'mus', a: 0.001, d: 0.03, g: g * 0.35, filt: { type: 'lowpass', f: 900 } });
          break;
        case 'K':
          A.tone({ t: 'sine', f: 165, f2: 40, fT: 0.13, dur: 0.2, when: when, bus: 'mus', a: 0.001, d: 0.22, g: g * 1.8 });
          break;
        case 's':
          A.noise({ dur: 0.13, when: when, bus: 'mus', a: 0.001, d: 0.14, g: g * 0.85, filt: { type: 'bandpass', f: 1900, q: 0.8 }, rev: 0.12 });
          A.tone({ t: 'triangle', f: 220, f2: 150, fT: 0.06, dur: 0.08, when: when, bus: 'mus', a: 0.001, d: 0.08, g: g * 0.4 });
          break;
        case 'S':
          A.noise({ dur: 0.2, when: when, bus: 'mus', a: 0.001, d: 0.22, g: g * 1.1, filt: { type: 'bandpass', f: 1700, q: 0.7 }, rev: 0.2 });
          break;
        case 'r':
          A.noise({ dur: 0.05, when: when, bus: 'mus', a: 0.001, d: 0.05, g: g * 0.5, filt: { type: 'bandpass', f: 2600, q: 3 } });
          break;
        case 'h':
          A.noise({ dur: 0.035, when: when, bus: 'mus', a: 0.0008, d: 0.04, g: g * 0.34, filt: { type: 'highpass', f: 7000 } });
          break;
        case 'H':
          A.noise({ dur: 0.2, when: when, bus: 'mus', a: 0.001, d: 0.22, g: g * 0.34, filt: { type: 'highpass', f: 6200 } });
          break;
        case 'c':
          A.noise({ dur: 0.7, when: when, bus: 'mus', a: 0.002, d: 0.75, g: g * 0.6, filt: { type: 'highpass', f: 3800 }, rev: 0.3 });
          break;
        case 't':
          A.tone({ t: 'sine', f: 200, f2: 120, fT: 0.12, dur: 0.16, when: when, bus: 'mus', a: 0.001, d: 0.17, g: g * 1.0 });
          A.noise({ dur: 0.08, when: when, bus: 'mus', a: 0.001, d: 0.08, g: g * 0.2, filt: { type: 'bandpass', f: 500, q: 1.4 } });
          break;
        case 'T':  // 定音鼓
          A.tone({ t: 'sine', f: 98, f2: 78, fT: 0.3, dur: 0.4, when: when, bus: 'mus', a: 0.002, d: 0.42, g: g * 1.7, rev: 0.35 });
          A.noise({ dur: 0.1, when: when, bus: 'mus', a: 0.001, d: 0.1, g: g * 0.18, filt: { type: 'lowpass', f: 400 } });
          break;
      }
    }
  };

  /* ---------------- 编译 ---------------- */
  function compile(part) {
    var toks = part.seq.replace(/\|/g, ' ').trim().split(/\s+/);
    part._len = toks.length;
    part._map = Object.create(null);
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk === '.' || tk === '-') continue;
      var L = 1;
      for (var j = i + 1; j < toks.length && toks[j] === '.'; j++) L++;
      part._map[i] = { n: tk, l: L };
    }
    return part;
  }

  function prep(track) {
    if (track._ready) return track;
    for (var i = 0; i < track.parts.length; i++) compile(track.parts[i]);
    track._ready = true;
    return track;
  }

  /* ---------------- 播放器 ---------------- */
  var cur = null, timer = null, step = 0, nextTime = 0, playing = null, gainNode = null;
  var LOOKAHEAD = 0.18, TICK = 25;

  function stepDur(tr) { return 60 / tr.bpm / (tr.div || 4); }

  function schedule() {
    if (!cur || !A.ready) return;
    var sd = stepDur(cur);
    var now = A.ctx.currentTime;
    while (nextTime < now + LOOKAHEAD) {
      if (nextTime < now) nextTime = now + 0.02;
      for (var p = 0; p < cur.parts.length; p++) {
        var part = cur.parts[p];
        if (part.mute) continue;
        var idx = step % part._len;
        var ev = part._map[idx];
        if (!ev) continue;
        var dur = ev.l * sd * (part.gate == null ? 0.94 : part.gate);
        var fn = INST[part.inst] || INST.pulse;
        if (part.inst === 'drum') fn(part, ev.n, dur, nextTime);
        else {
          var f = A.freq(ev.n);
          if (part.oct) f *= Math.pow(2, part.oct);
          if (part.detuneCents) f *= Math.pow(2, part.detuneCents / 1200);
          fn(part, f, dur, nextTime);
          if (part.echo) {
            A.tone({
              t: part.wave || 'p25', f: f, dur: dur * .5, when: nextTime + sd * (part.echoStep || 3),
              bus: 'mus', a: .004, d: dur * .55, g: part.gain * (part.echoG || .28), pan: part.pan ? -part.pan : .3
            });
          }
        }
      }
      step++;
      nextTime += sd;
    }
  }

  M.isPlaying = function (name) { return playing === name; };
  M.current = function () { return playing; };

  M.play = function (name, o) {
    o = o || {};
    if (!A.ready) { M._pending = [name, o]; return; }
    var tr = M.tracks[name];
    if (!tr) { U.dbg('no track', name); return; }
    if (playing === name && cur && !o.restart) return;
    M.stop(o.xfade == null ? 0.25 : o.xfade);
    cur = prep(tr);
    playing = name;
    step = o.fromStep || 0;
    nextTime = A.ctx.currentTime + 0.06;
    // 每首曲子自己的音量修正
    A.buses.mus.gain.cancelScheduledValues(A.ctx.currentTime);
    var target = A.getVolume('mus') * (tr.vol == null ? 1 : tr.vol);
    A.buses.mus.gain.setValueAtTime(o.fadeIn ? 0.0001 : target, A.ctx.currentTime);
    if (o.fadeIn) A.buses.mus.gain.linearRampToValueAtTime(target, A.ctx.currentTime + o.fadeIn);
    if (timer) clearInterval(timer);
    timer = setInterval(schedule, TICK);
    schedule();
  };

  M.stop = function (fade) {
    if (!cur) { playing = null; return; }
    if (timer) { clearInterval(timer); timer = null; }
    cur = null; playing = null;
    if (A.ready) {
      var t = A.ctx.currentTime;
      A.buses.mus.gain.cancelScheduledValues(t);
      if (fade > 0) {
        A.buses.mus.gain.setValueAtTime(A.buses.mus.gain.value, t);
        A.buses.mus.gain.linearRampToValueAtTime(0.0001, t + fade);
        setTimeout(function () { if (!cur) A.buses.mus.gain.value = A.getVolume('mus'); }, fade * 1000 + 60);
      } else {
        A.buses.mus.gain.value = 0.0001;
        setTimeout(function () { if (!cur) A.buses.mus.gain.value = A.getVolume('mus'); }, 40);
      }
    }
  };
  // 压低音乐（对话高潮时）
  M.duck = function (amt, dur) {
    if (!A.ready) return;
    var t = A.ctx.currentTime, target = A.getVolume('mus') * (cur && cur.vol != null ? cur.vol : 1);
    A.buses.mus.gain.cancelScheduledValues(t);
    A.buses.mus.gain.setValueAtTime(A.buses.mus.gain.value, t);
    A.buses.mus.gain.linearRampToValueAtTime(target * amt, t + 0.08);
    A.buses.mus.gain.linearRampToValueAtTime(target, t + 0.08 + (dur || 0.5));
  };
  M.onAudioReady = function () {
    if (M._pending) { var p = M._pending; M._pending = null; M.play(p[0], p[1]); }
  };

  /* ============================================================
     曲目
     ============================================================ */
  function J() { return Array.prototype.join.call(arguments, ' '); }
  function rep(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' '); }
  var R16 = '- - - - - - - - - - - - - - - -';

  M.tracks = {};

  /* ---------- 标题：「逆转裁判 ～ 序曲」 ---------- */
  M.tracks.title = {
    bpm: 96, div: 4, vol: 1.0,
    parts: [
      { // 铜管主题（D 小调）
        inst: 'brass', gain: 0.075, rev: 0.3, pan: -0.08,
        seq: J(
          'd4 . . . . . a4 . f4 . . . d4 . . .',
          'a3 . . . . . . . - - - - - - - -',
          'bb3 . . . . . f4 . d4 . . . bb3 . . .',
          'a3 . . . . . . . . . . . - - - -',
          'd4 . . . f4 . a4 . d5 . . . c5 . bb4 .',
          'a4 . . . . . . . g4 . f4 . e4 . . .',
          'f4 . . . e4 . d4 . cs4 . . . a3 . . .',
          'd4 . . . . . . . . . . . . . . .')
      },
      { // 弦乐和声
        inst: 'strings', gain: 0.045, rev: 0.4, pan: 0.14,
        seq: J(
          'f3 . . . . . . . . . . . . . . .',
          'e3 . . . . . . . . . . . . . . .',
          'd3 . . . . . . . . . . . . . . .',
          'cs3 . . . . . . . . . . . . . . .',
          'f3 . . . . . . . a3 . . . . . . .',
          'e3 . . . . . . . . . . . . . . .',
          'd3 . . . . . . . a2 . . . . . . .',
          'd3 . . . . . . . . . . . . . . .')
      },
      { // 低音
        inst: 'bass', gain: 0.10, wave: 'triangle',
        seq: J(
          'd2 . . . d2 . . . a2 . . . a2 . . .',
          'a1 . . . a1 . . . e2 . . . e2 . . .',
          'bb1 . . . bb1 . . . f2 . . . f2 . . .',
          'a1 . . . a1 . . . a1 . . . a1 . . .',
          'd2 . . . d2 . . . d2 . . . d2 . . .',
          'a1 . . . a1 . . . c2 . . . c2 . . .',
          'd2 . . . d2 . . . a1 . . . a1 . . .',
          'd2 . . . . . . . d2 . . . . . . .')
      },
      { // 定音鼓
        inst: 'drum', gain: 0.10,
        seq: J(
          'T - - - - - - - T - - - - - - -',
          'T - - - - - - - - - - - - - - -',
          'T - - - - - - - T - - - - - - -',
          'T - - - T - - - T - - - T - - -',
          'T - - - - - - - T - - - - - - -',
          'T - - - - - - - T - - - T - - -',
          'T - - - T - - - T - - - T - - -',
          'T - - - - - - - c - - - - - - -')
      }
    ]
  };

  /* ---------- 「开庭」 ---------- */
  M.tracks.courtStart = {
    bpm: 104, div: 4, vol: 1.0,
    parts: [
      {
        inst: 'brass', gain: 0.08, rev: 0.26,
        seq: J(
          'g4 . g4 . g4 . - - bb4 . . . g4 . - -',
          'd5 . . . c5 . bb4 . a4 . . . - - - -',
          'g4 . g4 . g4 . - - d5 . . . bb4 . - -',
          'c5 . . . a4 . . . g4 . . . . . - -',
          'eb5 . . . d5 . c5 . bb4 . . . g4 . - -',
          'f4 . . . g4 . a4 . bb4 . . . . . - -',
          'c5 . . . bb4 . a4 . g4 . fs4 . g4 . a4 .',
          'bb4 . . . . . . . d4 . . . . . - -')
      },
      {
        inst: 'organ', gain: 0.04, rev: 0.42, pan: 0.2,
        seq: J(
          'g3 . . . . . . . bb3 . . . . . . .',
          'd4 . . . . . . . c4 . . . . . . .',
          'g3 . . . . . . . d4 . . . . . . .',
          'c4 . . . . . . . g3 . . . . . . .',
          'eb4 . . . . . . . c4 . . . . . . .',
          'f3 . . . . . . . bb3 . . . . . . .',
          'c4 . . . . . . . fs3 . . . . . . .',
          'g3 . . . . . . . . . . . . . . .')
      },
      {
        inst: 'bass', gain: 0.115,
        seq: J(
          'g2 - g2 - g2 - g2 - eb2 - eb2 - eb2 - eb2 -',
          'bb2 - bb2 - bb2 - bb2 - f2 - f2 - f2 - f2 -',
          'g2 - g2 - g2 - g2 - d2 - d2 - d2 - d2 -',
          'c2 - c2 - c2 - c2 - g2 - g2 - g2 - g2 -',
          'eb2 - eb2 - eb2 - eb2 - c2 - c2 - c2 - c2 -',
          'f2 - f2 - f2 - f2 - bb2 - bb2 - bb2 - bb2 -',
          'c2 - c2 - c2 - c2 - d2 - d2 - ds2 - e2 -',
          'g2 - g2 - d2 - d2 - g2 - - - - - - -')
      },
      {
        inst: 'drum', gain: 0.105,
        seq: J(
          'T - - - t - T - T - - - t - - -',
          'T - - - t - T - T - t - T - - -',
          'T - - - t - T - T - - - t - - -',
          'T - t - T - t - T - - - T - - -',
          'T - - - t - T - T - - - t - - -',
          'T - - - t - T - T - t - T - - -',
          'T - t - T - t - T - t - T - t -',
          'T - - - c - - - T - - - - - - -')
      }
    ]
  };

  /* ---------- 「调查 ～ 核心」 ---------- */
  M.tracks.investigate = {
    bpm: 112, div: 4, vol: 1.0,
    parts: [
      { // 主旋律（轻快，Bb 大调偏爵士）
        inst: 'pulse', wave: 'p25', gain: 0.062, pan: -0.12, rev: 0.14, echo: true, echoG: 0.2,
        seq: J(
          '- - - - bb4 - c5 - d5 . . . f5 . - -',
          'd5 . . . c5 - bb4 - c5 . . . - - - -',
          '- - - - g4 - a4 - bb4 . . . d5 . - -',
          'c5 . . . bb4 - a4 - g4 . . . - - - -',
          '- - - - f5 - eb5 - d5 . . . c5 . - -',
          'bb4 . . . - - d5 - f5 . . . eb5 . - -',
          'd5 - c5 - bb4 . . . a4 - g4 - f4 . . .',
          'bb4 . . . . . - - - - - - - - - -')
      },
      { // 和弦刺
        inst: 'stab', wave: 'p12', gain: 0.036, pan: 0.24,
        seq: J(
          '- - d4 - - - d4 - - - f4 - - - f4 -',
          '- - eb4 - - - eb4 - - - g4 - - - g4 -',
          '- - d4 - - - d4 - - - bb3 - - - bb3 -',
          '- - c4 - - - c4 - - - eb4 - - - eb4 -',
          '- - f4 - - - f4 - - - a4 - - - a4 -',
          '- - g4 - - - g4 - - - bb4 - - - bb4 -',
          '- - f4 - - - eb4 - - - d4 - - - c4 -',
          '- - d4 - - - - - - - - - - - - -')
      },
      { // 走动贝斯
        inst: 'bass', gain: 0.11, wave: 'triangle',
        seq: J(
          'bb1 - bb1 - d2 - f2 - bb1 - bb1 - a1 - g1 -',
          'eb2 - eb2 - g2 - bb2 - eb2 - d2 - c2 - bb1 -',
          'g1 - g1 - bb1 - d2 - g1 - g1 - f1 - eb1 -',
          'c2 - c2 - eb2 - g2 - c2 - bb1 - a1 - g1 -',
          'f1 - f1 - a1 - c2 - f1 - f1 - e1 - eb1 -',
          'bb1 - bb1 - d2 - f2 - bb1 - a1 - ab1 - g1 -',
          'eb2 - eb2 - d2 - d2 - c2 - c2 - f1 - f1 -',
          'bb1 - bb1 - f1 - f1 - bb1 - - - - - - -')
      },
      {
        inst: 'drum', gain: 0.085,
        seq: J(
          'k - h - r - h - k - k h s - h -',
          '- - h - s - h k k - h - s - h h',
          'k - h - r - h - k - k h s - h -',
          '- - h - s - h k k - h h s - H -',
          'k - h - r - h - k - k h s - h -',
          '- - h - s - h k k - h - s - h h',
          'k - h - s - h - k - h - s - h -',
          'k - s - k - s - k - - - c - - -')
      }
    ]
  };

  /* ---------- 「尋問 ～ 中庸」 ---------- */
  M.tracks.crossExam = {
    bpm: 140, div: 4, vol: 1.0,
    parts: [
      { // 主旋律（A 小调）
        inst: 'pulse', wave: 'p25', gain: 0.068, pan: -0.1, rev: 0.12,
        seq: J(
          'a4 . . . c5 - b4 - a4 . . . e4 . - -',
          'f4 . . . a4 - g4 - f4 . . . c4 . - -',
          'g4 . . . b4 - d5 - c5 - b4 - a4 - g4 -',
          'e4 . . . gs4 - b4 - e5 . . . . . - -',
          'a4 . . . c5 - b4 - a4 . . . e5 . - -',
          'f5 . . . e5 - d5 - c5 . . . a4 . - -',
          'd5 - c5 - b4 - a4 - gs4 . . . b4 . - -',
          'a4 . . . . . e4 - a4 . . . . . - -')
      },
      { // 副旋律（三度下方）
        inst: 'pulse', wave: 'p12', gain: 0.032, pan: 0.26, vib: false,
        seq: J(
          'e4 . . . a4 - g4 - e4 . . . c4 . - -',
          'c4 . . . f4 - e4 - c4 . . . a3 . - -',
          'd4 . . . g4 - b4 - a4 - g4 - f4 - e4 -',
          'b3 . . . e4 - gs4 - b4 . . . . . - -',
          'e4 . . . a4 - g4 - e4 . . . c5 . - -',
          'a4 . . . g4 - f4 - e4 . . . c4 . - -',
          'f4 - e4 - d4 - c4 - b3 . . . gs4 . - -',
          'e4 . . . . . c4 - e4 . . . . . - -')
      },
      { // 八分音符驱动贝斯
        inst: 'bass', gain: 0.115,
        seq: J(
          'a2 - a2 - a2 - e3 - a2 - a2 - c3 - e3 -',
          'f2 - f2 - f2 - c3 - f2 - f2 - a2 - c3 -',
          'g2 - g2 - g2 - d3 - g2 - g2 - b2 - d3 -',
          'e2 - e2 - e2 - b2 - e2 - e2 - gs2 - b2 -',
          'a2 - a2 - a2 - e3 - a2 - a2 - c3 - e3 -',
          'f2 - f2 - f2 - c3 - f2 - f2 - a2 - c3 -',
          'd2 - d2 - f2 - a2 - e2 - e2 - gs2 - b2 -',
          'a2 - a2 - e2 - e2 - a2 - a2 - a2 - - -')
      },
      { // 和弦背刺（切分）
        inst: 'stab', wave: 'p50', gain: 0.026, pan: 0.32,
        seq: J(
          '- - a3 - - - a3 - - - e4 - - a3 - -',
          '- - a3 - - - a3 - - - f4 - - c4 - -',
          '- - b3 - - - b3 - - - g4 - - d4 - -',
          '- - b3 - - - b3 - - - e4 - - gs3 - -',
          '- - a3 - - - a3 - - - e4 - - a3 - -',
          '- - a3 - - - a3 - - - f4 - - c4 - -',
          '- - a3 - - - a3 - - - b3 - - gs3 - -',
          '- - a3 - - - - - - - - - - - - -')
      },
      {
        inst: 'drum', gain: 0.09,
        seq: J(
          'k - h - s - h - k - k - s - h h',
          'k - h - s - h - k - k - s - h -',
          'k - h - s - h - k - k - s - h h',
          'k - h h s - h - k - t - s - H -',
          'k - h - s - h - k - k - s - h h',
          'k - h - s - h - k - k - s - h -',
          'k - h - s - h - k - h - s - h h',
          'k - s - k - s - k - s - c - - -')
      }
    ]
  };

  /* ---------- 「追い詰め ～ 逆転」 ---------- */
  M.tracks.pursuit = {
    bpm: 172, div: 4, vol: 1.05,
    parts: [
      { // 主旋律：D 小调、上冲
        inst: 'saw', gain: 0.055, cut: 3600, q: 3.4, pan: -0.06, rev: 0.16,
        seq: J(
          'd5 - d5 - f5 - e5 - d5 - a4 - d5 . - -',
          'c5 - c5 - e5 - d5 - c5 - g4 - c5 . - -',
          'bb4 - bb4 - d5 - c5 - bb4 - f4 - bb4 . - -',
          'a4 - c5 - e5 - g5 - f5 - e5 - d5 . - -',
          'd5 - d5 - f5 - e5 - d5 - a5 - f5 . - -',
          'e5 - e5 - g5 - f5 - e5 - a4 - cs5 . - -',
          'd5 - e5 - f5 - g5 - a5 - g5 - f5 - e5 -',
          'd5 . . . a4 . . . d5 . . . - - - -')
      },
      { // 铜管齐奏（呼应）
        inst: 'brass', gain: 0.05, rev: 0.2, pan: 0.2,
        seq: J(
          '- - - - - - - - - - - - d4 . - -',
          '- - - - - - - - - - - - c4 . - -',
          '- - - - - - - - - - - - bb3 . - -',
          'a3 . . . . . . . a3 - a3 - a3 . - -',
          '- - - - - - - - - - - - f4 . - -',
          '- - - - - - - - - - - - e4 . - -',
          'd4 - e4 - f4 - g4 - a4 . . . . . - -',
          'd4 . . . a3 . . . d4 . . . - - - -')
      },
      { // 16 分音符低音（推进感）
        inst: 'bass', gain: 0.12, gate: 0.8,
        seq: J(
          'd2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 a2 a2 c3 c3',
          'c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 g2 g2 bb2 bb2',
          'bb1 bb1 bb1 bb1 bb1 bb1 bb1 bb1 bb1 bb1 bb1 bb1 f2 f2 a2 a2',
          'a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 e2 e2 gs2 gs2',
          'd2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 a2 a2 c3 c3',
          'a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 a1 e2 e2 g2 g2',
          'bb1 bb1 bb1 bb1 c2 c2 c2 c2 d2 d2 d2 d2 e2 e2 f2 f2',
          'd2 d2 d2 d2 a1 a1 a1 a1 d2 d2 d2 d2 - - - -')
      },
      { // 高音装饰
        inst: 'stab', wave: 'p12', gain: 0.02, pan: 0.34, echo: true, echoG: 0.25, echoStep: 2,
        seq: J(
          '- - - d6 - - - - - - - a5 - - - -',
          '- - - c6 - - - - - - - g5 - - - -',
          '- - - bb5 - - - - - - - f5 - - - -',
          '- - - a5 - - - - - - - e5 - - - -',
          '- - - d6 - - - - - - - a5 - - - -',
          '- - - e6 - - - - - - - a5 - - - -',
          '- - - f5 - - - g5 - - - a5 - - - -',
          '- - - d6 - - - - - - - - - - - -')
      },
      {
        inst: 'drum', gain: 0.095,
        seq: J(
          'k - h h s - h - k - h h s - h h',
          'k - h h s - h - k - h h s - h h',
          'k - h h s - h - k - h h s - h h',
          'k - h h s - h - k k t t S - H -',
          'k - h h s - h - k - h h s - h h',
          'k - h h s - h - k - h h s - h h',
          'k - h h s - h - k - h h s - h h',
          'k k s s k k s s K - - - c - - -')
      }
    ]
  };

  /* ---------- 「疑惑」 ---------- */
  M.tracks.suspense = {
    bpm: 88, div: 4, vol: 0.95,
    parts: [
      {
        inst: 'bell', gain: 0.05, rev: 0.4, pan: -0.16,
        seq: J(
          'e4 . . . - - - - b3 . . . - - - -',
          'c4 . . . - - - - g3 . . . - - - -',
          'd4 . . . - - - - a3 . . . - - - -',
          'b3 . . . - - - - - - - - - - - -')
      },
      {
        inst: 'strings', gain: 0.032, rev: 0.45,
        seq: J(
          'a2 . . . . . . . . . . . . . . .',
          'f2 . . . . . . . . . . . . . . .',
          'g2 . . . . . . . . . . . . . . .',
          'gs2 . . . . . . . . . . . . . . .')
      },
      {
        inst: 'bass', gain: 0.085, wave: 'triangle',
        seq: J(
          'a1 . . . - - - - a1 . . . - - - -',
          'f1 . . . - - - - f1 . . . - - - -',
          'g1 . . . - - - - g1 . . . - - - -',
          'gs1 . . . - - - - gs1 . . . - - - -')
      },
      {
        inst: 'drum', gain: 0.05,
        seq: J(
          'r - - - - - - - r - - - - - - -',
          'r - - - - - - - r - - - - - - -',
          'r - - - - - - - r - - - - - - -',
          'r - - - - - - - r - - r - - r -')
      }
    ]
  };

  /* ---------- 「哀しみ」 ---------- */
  M.tracks.sad = {
    bpm: 74, div: 4, vol: 0.95,
    parts: [
      {
        inst: 'bell', gain: 0.052, rev: 0.42, pan: -0.1,
        seq: J(
          'a4 . . . . . g4 . f4 . . . e4 . . .',
          'd4 . . . e4 . f4 . e4 . . . . . . .',
          'c5 . . . . . b4 . a4 . . . g4 . . .',
          'f4 . . . e4 . d4 . e4 . . . . . . .',
          'a4 . . . c5 . e5 . d5 . . . c5 . . .',
          'b4 . . . a4 . g4 . a4 . . . . . . .',
          'f4 . . . g4 . a4 . bb4 . . . a4 . g4 .',
          'a4 . . . . . . . . . . . . . . .')
      },
      {
        inst: 'strings', gain: 0.03, rev: 0.5, pan: 0.2,
        seq: J(
          'a3 . . . . . . . . . . . . . . .',
          'f3 . . . . . . . . . . . . . . .',
          'e3 . . . . . . . . . . . . . . .',
          'd3 . . . . . . . . . . . . . . .',
          'a3 . . . . . . . . . . . . . . .',
          'e3 . . . . . . . . . . . . . . .',
          'f3 . . . . . . . . . . . . . . .',
          'a3 . . . . . . . . . . . . . . .')
      },
      {
        inst: 'bass', gain: 0.08, wave: 'triangle',
        seq: J(
          'a1 . . . . . . . e2 . . . . . . .',
          'd2 . . . . . . . a1 . . . . . . .',
          'f1 . . . . . . . c2 . . . . . . .',
          'd2 . . . . . . . a1 . . . . . . .',
          'a1 . . . . . . . e2 . . . . . . .',
          'e1 . . . . . . . b1 . . . . . . .',
          'f1 . . . . . . . c2 . . . . . . .',
          'a1 . . . . . . . . . . . . . . .')
      }
    ]
  };

  /* ---------- 「逆転成功！」 ---------- */
  M.tracks.victory = {
    bpm: 138, div: 4, vol: 1.0,
    parts: [
      {
        inst: 'brass', gain: 0.075, rev: 0.22,
        seq: J(
          'c5 - c5 - c5 . e5 . g5 . . . - - - -',
          'a4 - a4 - c5 . e5 . f5 . . . - - - -',
          'g4 - g4 - b4 . d5 . g5 . . . f5 . e5 .',
          'd5 . . . c5 . . . c5 . . . - - - -',
          'e5 - e5 - g5 . c6 . b5 . . . - - - -',
          'a5 . . . g5 . f5 . e5 . . . d5 . - -',
          'c5 - e5 - g5 - c6 - d6 . . . b5 . - -',
          'c6 . . . . . . . g5 . . . c6 . - -')
      },
      {
        inst: 'pulse', wave: 'p25', gain: 0.036, pan: 0.24,
        seq: J(
          'e4 - e4 - e4 . g4 . c5 . . . - - - -',
          'c4 - c4 - e4 . g4 . a4 . . . - - - -',
          'b3 - b3 - d4 . g4 . b4 . . . a4 . g4 .',
          'f4 . . . e4 . . . e4 . . . - - - -',
          'g4 - g4 - c5 . e5 . d5 . . . - - - -',
          'c5 . . . b4 . a4 . g4 . . . f4 . - -',
          'e4 - g4 - c5 - e5 - f5 . . . d5 . - -',
          'e5 . . . . . . . c5 . . . e5 . - -')
      },
      {
        inst: 'bass', gain: 0.11,
        seq: J(
          'c2 - c2 - g2 - c3 - c2 - c2 - g2 - b2 -',
          'a1 - a1 - e2 - a2 - f2 - f2 - c3 - e3 -',
          'g1 - g1 - d2 - g2 - g1 - g1 - b1 - d2 -',
          'g1 - g1 - c2 - c2 - c2 - c2 - g1 - g1 -',
          'c2 - c2 - g2 - c3 - c2 - c2 - g2 - b2 -',
          'a1 - a1 - e2 - a2 - g1 - g1 - d2 - g2 -',
          'c2 - e2 - g2 - c3 - d2 - d2 - g2 - g2 -',
          'c2 - - - g1 - - - c2 - - - - - - -')
      },
      {
        inst: 'drum', gain: 0.095,
        seq: J(
          'k - h - s - h - k - k - s - h h',
          'k - h - s - h - k - k - s - h -',
          'k - h - s - h - k - k - s - h h',
          'k - s - k - s - k - - - c - - -',
          'k - h - s - h - k - k - s - h h',
          'k - h - s - h - k - k - s - h -',
          'k - h - s - h - k - h - s - h h',
          'k - s - k - s - K - - - c - - -')
      }
    ]
  };

  /* ---------- 「証言」（证人证言时的低压背景） ---------- */
  M.tracks.testimony = {
    bpm: 108, div: 4, vol: 0.9,
    parts: [
      {
        inst: 'stab', wave: 'p12', gain: 0.022, pan: 0.2,
        seq: J(
          '- - e4 - - - a3 - - - e4 - - - - -',
          '- - d4 - - - a3 - - - d4 - - - - -',
          '- - e4 - - - b3 - - - e4 - - - - -',
          '- - f4 - - - c4 - - - e4 - - - - -')
      },
      {
        inst: 'bass', gain: 0.09,
        seq: J(
          'a1 - - - a1 - - - e2 - - - - - - -',
          'f1 - - - f1 - - - c2 - - - - - - -',
          'g1 - - - g1 - - - d2 - - - - - - -',
          'gs1 - - - gs1 - - - b1 - - - e2 - - -')
      },
      {
        inst: 'drum', gain: 0.055,
        seq: J(
          'k - - - r - - - k - - - r - - -',
          'k - - - r - - - k - - - r - - -',
          'k - - - r - - - k - - - r - - -',
          'k - - - r - - - k - - r - - r -')
      }
    ]
  };

  /* ---------- 「深夜电台」（案发现场的空气感） ---------- */
  M.tracks.midnight = {
    bpm: 84, div: 4, vol: 0.92,
    parts: [
      {
        inst: 'bell', gain: 0.038, rev: 0.45, pan: -0.2, echo: true, echoG: 0.3, echoStep: 6,
        seq: J(
          'd5 . . . - - a4 . - - - - f4 . - -',
          '- - - - c5 . . . - - g4 . - - - -',
          'e5 . . . - - c5 . - - - - a4 . - -',
          '- - - - d5 . . . - - - - - - - -')
      },
      {
        inst: 'strings', gain: 0.028, rev: 0.5,
        seq: J(
          'd3 . . . . . . . . . . . . . . .',
          'bb2 . . . . . . . . . . . . . . .',
          'a2 . . . . . . . . . . . . . . .',
          'gs2 . . . . . . . . . . . . . . .')
      },
      {
        inst: 'bass', gain: 0.075, wave: 'triangle',
        seq: J(
          'd1 . . . . . . . d1 . . . . . . .',
          'bb0 . . . . . . . bb0 . . . . . . .',
          'a0 . . . . . . . a0 . . . . . . .',
          'gs0 . . . . . . . gs0 . . . . . . .')
      }
    ]
  };

  A.onready = function () { M.onAudioReady(); };

})(window.AA);
