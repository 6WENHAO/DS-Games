/* audio.js — 全程序化音效 + 地牢 BGM（无外部资源） */
(function (K) {
  'use strict';
  var ctx = null, master, sfxG, musG, comp, nb, ready = false, muted = false, vs = 1;
  function AC() { return typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null); }
  function init() {
    if (ready) return true;
    var C = AC(); if (!C) return false;
    try { ctx = new C(); } catch (e) { return false; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 9; comp.attack.value = .003; comp.release.value = .2;
    master = ctx.createGain(); master.gain.value = .8;
    sfxG = ctx.createGain(); sfxG.gain.value = 1;
    musG = ctx.createGain(); musG.gain.value = .3;
    sfxG.connect(comp); musG.connect(comp); comp.connect(master); master.connect(ctx.destination);
    var n = ctx.sampleRate * 2; nb = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = nb.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    ready = true; return true;
  }
  function T() { return ctx.currentTime; }
  function noise(o) {
    if (!ready) return;
    var s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = o.rate || 1;
    var f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    var d = o.dur || .1;
    f.frequency.setValueAtTime(o.f0 || 900, T());
    f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1 || o.f0 || 900), T() + d);
    f.Q.value = o.q === undefined ? 1 : o.q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, T());
    g.gain.linearRampToValueAtTime((o.gain === undefined ? .3 : o.gain) * vs, T() + (o.atk || .003));
    g.gain.exponentialRampToValueAtTime(.0005, T() + d);
    s.connect(f); f.connect(g); g.connect(sfxG); s.start(); s.stop(T() + d + .02);
  }
  function tone(o) {
    if (!ready) return;
    var s = ctx.createOscillator(); s.type = o.type || 'sine';
    var d = o.dur || .12;
    s.frequency.setValueAtTime(o.f0 || 300, T());
    if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), T() + d);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, T());
    g.gain.linearRampToValueAtTime((o.gain === undefined ? .22 : o.gain) * vs, T() + (o.atk || .004));
    g.gain.exponentialRampToValueAtTime(.0005, T() + d);
    var last = g;
    if (o.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); last = f; }
    s.connect(g); last.connect(sfxG); s.start(); s.stop(T() + d + .02);
  }
  var SFX = {
    /* —— 射击 —— */
    pistol: function () { noise({ f0: 2200, f1: 500, q: .9, dur: .07, gain: .26 }); tone({ type: 'square', f0: 420, f1: 120, dur: .06, gain: .1, lp: 2600 }); },
    rifle: function () { noise({ f0: 1700, f1: 420, q: .8, dur: .06, gain: .22 }); tone({ type: 'sawtooth', f0: 300, f1: 90, dur: .05, gain: .09, lp: 2200 }); },
    smg: function () { noise({ f0: 2600, f1: 800, q: 1.2, dur: .045, gain: .17 }); },
    shotgun: function () { noise({ type: 'lowpass', f0: 1400, f1: 160, q: .6, dur: .22, gain: .45 }); tone({ type: 'sine', f0: 160, f1: 45, dur: .24, gain: .35 }); },
    sniper: function () { noise({ type: 'lowpass', f0: 3000, f1: 200, q: .5, dur: .3, gain: .5 }); tone({ type: 'sine', f0: 220, f1: 40, dur: .34, gain: .4 }); },
    laser: function () { tone({ type: 'sawtooth', f0: 1400, f1: 420, dur: .12, gain: .13, lp: 5000 }); noise({ type: 'highpass', f0: 2400, f1: 5000, q: .6, dur: .1, gain: .1 }); },
    beam: function () { tone({ type: 'square', f0: 90, f1: 130, dur: .1, gain: .06, lp: 1400 }); },
    rocket: function () { noise({ type: 'lowpass', f0: 900, f1: 200, q: .5, dur: .3, gain: .32 }); tone({ type: 'sawtooth', f0: 120, f1: 300, dur: .3, gain: .12, lp: 1200 }); },
    bow: function () { noise({ type: 'bandpass', f0: 1200, f1: 3000, q: 2, dur: .1, gain: .16 }); tone({ type: 'triangle', f0: 700, f1: 1400, dur: .07, gain: .07 }); },
    magic: function () { tone({ type: 'triangle', f0: 500, f1: 1500, dur: .18, gain: .12 }); tone({ type: 'sine', f0: 1200, f1: 2400, dur: .14, gain: .06 }); },
    swing: function () { noise({ type: 'bandpass', f0: 2400, f1: 600, q: 1.1, dur: .12, gain: .16 }); },
    heavy: function () { noise({ type: 'lowpass', f0: 1200, f1: 200, q: .6, dur: .2, gain: .3 }); tone({ type: 'sine', f0: 140, f1: 50, dur: .22, gain: .28 }); },
    throwx: function () { noise({ type: 'bandpass', f0: 900, f1: 2200, q: 1.4, dur: .12, gain: .13 }); },
    flame: function () { noise({ type: 'lowpass', f0: 700, f1: 300, q: .4, dur: .16, gain: .14 }); },
    tesla: function () { noise({ type: 'highpass', f0: 3000, f1: 900, q: .5, dur: .14, gain: .18 }); tone({ type: 'square', f0: 900, f1: 200, dur: .1, gain: .07, lp: 4000 }); },
    /* —— 命中 —— */
    hit: function () { noise({ f0: 1500, f1: 380, q: .7, dur: .07, gain: .3 }); tone({ type: 'triangle', f0: 240, f1: 90, dur: .08, gain: .22 }); },
    hitWall: function () { noise({ f0: 3000, f1: 900, q: 1.4, dur: .05, gain: .14 }); },
    crit: function () { noise({ f0: 2600, f1: 500, q: .6, dur: .12, gain: .4 }); tone({ type: 'square', f0: 700, f1: 180, dur: .12, gain: .14, lp: 3600 }); tone({ type: 'sine', f0: 170, f1: 60, dur: .16, gain: .3 }); },
    explode: function () { noise({ type: 'lowpass', f0: 2200, f1: 70, q: .4, dur: .55, gain: .6 }); tone({ type: 'sine', f0: 110, f1: 26, dur: .6, gain: .5 }); },
    shatter: function () { noise({ type: 'highpass', f0: 2000, f1: 4200, q: .6, dur: .22, gain: .2 }); },
    freeze: function () { tone({ type: 'triangle', f0: 1600, f1: 600, dur: .3, gain: .1 }); noise({ type: 'highpass', f0: 4000, f1: 2000, q: .5, dur: .3, gain: .1 }); },
    /* —— 玩家 —— */
    hurt: function () { tone({ type: 'sawtooth', f0: 300, f1: 90, dur: .22, gain: .26, lp: 1600 }); noise({ type: 'lowpass', f0: 900, f1: 200, q: .5, dur: .2, gain: .24 }); },
    dash: function () { noise({ type: 'bandpass', f0: 600, f1: 2400, q: .9, dur: .16, gain: .16 }); },
    skill: function () { tone({ type: 'sawtooth', f0: 200, f1: 900, dur: .3, gain: .16, lp: 4000 }); noise({ type: 'highpass', f0: 800, f1: 3600, q: .5, dur: .3, gain: .14 }); },
    shield: function () { tone({ type: 'sine', f0: 700, f1: 1300, dur: .26, gain: .12 }); },
    heal: function () { tone({ type: 'sine', f0: 600, f1: 1200, dur: .3, gain: .12 }); tone({ type: 'sine', f0: 900, f1: 1800, dur: .26, gain: .07 }); },
    die: function () { tone({ type: 'sawtooth', f0: 260, f1: 40, dur: 1.1, gain: .3, lp: 1200 }); noise({ type: 'lowpass', f0: 1200, f1: 60, q: .4, dur: 1, gain: .3 }); },
    /* —— 敌人 —— */
    edie: function () { noise({ type: 'lowpass', f0: 1400, f1: 200, q: .5, dur: .2, gain: .28 }); tone({ type: 'triangle', f0: 200, f1: 60, dur: .22, gain: .2 }); },
    spawn: function () { tone({ type: 'triangle', f0: 120, f1: 400, dur: .3, gain: .12 }); },
    warn: function () { tone({ type: 'square', f0: 900, f1: 900, dur: .08, gain: .09, lp: 3000 }); },
    roar: function () { tone({ type: 'sawtooth', f0: 160, f1: 55, dur: 1.2, gain: .4, lp: 900 }); noise({ type: 'lowpass', f0: 700, f1: 120, q: .4, dur: 1.1, gain: .35 }); },
    /* —— 拾取/界面 —— */
    coin: function () { tone({ type: 'square', f0: 1200, f1: 1800, dur: .09, gain: .1, lp: 6000 }); },
    gem: function () { tone({ type: 'triangle', f0: 900, f1: 1900, dur: .18, gain: .12 }); tone({ type: 'sine', f0: 1400, f1: 2600, dur: .16, gain: .07 }); },
    item: function () { tone({ type: 'square', f0: 700, f1: 1400, dur: .22, gain: .11, lp: 5000 }); tone({ type: 'sine', f0: 1050, f1: 2100, dur: .2, gain: .07 }); },
    chest: function () { noise({ type: 'bandpass', f0: 800, f1: 2200, q: 1.2, dur: .3, gain: .2 }); tone({ type: 'triangle', f0: 400, f1: 900, dur: .3, gain: .12 }); },
    door: function () { noise({ type: 'lowpass', f0: 500, f1: 120, q: .5, dur: .4, gain: .26 }); },
    clear: function () { [0, 4, 7, 12].forEach(function (s, i) { setTimeout(function () { tone({ type: 'square', f0: 440 * Math.pow(2, s / 12), dur: .16, gain: .1, lp: 6000 }); }, i * 70); }); },
    levelup: function () { [0, 5, 9, 12, 16].forEach(function (s, i) { setTimeout(function () { tone({ type: 'triangle', f0: 330 * Math.pow(2, s / 12), dur: .22, gain: .12 }); }, i * 80); }); },
    menu: function () { tone({ type: 'square', f0: 700, f1: 880, dur: .05, gain: .07, lp: 3200 }); },
    ok: function () { tone({ type: 'square', f0: 600, f1: 1500, dur: .15, gain: .1, lp: 4200 }); },
    no: function () { tone({ type: 'square', f0: 300, f1: 160, dur: .16, gain: .1, lp: 2000 }); },
    portal: function () { tone({ type: 'sine', f0: 200, f1: 1200, dur: .8, gain: .14 }); noise({ type: 'bandpass', f0: 400, f1: 3000, q: .8, dur: .8, gain: .12 }); }
  };
  /* —— BGM —— */
  var mus = { on: false, step: 0, next: 0, bpm: 128, timer: null, mode: 'dungeon' };
  var SCALE = [0, 2, 3, 5, 7, 8, 10];  // 自然小调
  function nf(deg, oct) { return 55 * Math.pow(2, (SCALE[((deg % 7) + 7) % 7] + 12 * (oct || 0)) / 12); }
  var BASS = [0, 0, 3, 0, 5, 3, 0, 6];
  var ARP = [0, 2, 4, 2, 5, 4, 2, 0];
  function sched() {
    if (!ready || !mus.on) return;
    var boss = mus.mode === 'boss';
    var spb = 60 / (boss ? 158 : mus.bpm) / 4;
    while (mus.next < ctx.currentTime + .2) {
      var s = mus.step % 16, bar = Math.floor(mus.step / 16) % 4, t = mus.next;
      if (s === 0 || s === 6 || s === 10 || (boss && s === 13)) { mt('sine', 120, 42, .18, .42, t); mn(t, 2200, 500, .02, .1); }
      if (s === 4 || s === 12) mn(t, 1800, 600, .1, .16);
      if (s % 2 === 1) mn(t, 8000, 5600, .03, boss ? .07 : .045);
      if (s % 2 === 0) { var b = nf(BASS[(s / 2) % 8] + (bar >= 2 ? 2 : 0), 1); mt('sawtooth', b, b, .17, .17, t, 380); }
      if (boss || bar % 2 === 1) { var a = nf(ARP[s % 8] + (bar >= 2 ? 2 : 0), 3); mt('square', a, a, .09, .045, t, 3000); }
      if (s === 0 && bar === 0) { var p = nf(0, 2); mt('triangle', p, p, 1.2, .05, t, 900); }
      mus.step++; mus.next += spb;
    }
  }
  function mt(type, f0, f1, dur, gain, t, lp) {
    var s = ctx.createOscillator(); s.type = type;
    s.frequency.setValueAtTime(f0, t); if (f1 !== f0) s.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .006);
    g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    var last = g;
    if (lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); last = f; }
    s.connect(g); last.connect(musG); s.start(t); s.stop(t + dur + .02);
  }
  function mn(t, f0, f1, dur, gain) {
    var s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .9;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004);
    g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(musG); s.start(t); s.stop(t + dur + .02);
  }
  var last = {};
  K.Snd = {
    init: init,
    get ok() { return ready; },
    play: function (n, vol, minGap) {
      if (!ready || muted) return;
      var f = SFX[n]; if (!f) return;
      var now = ready ? ctx.currentTime : 0;
      if (minGap && last[n] && now - last[n] < minGap) return;
      last[n] = now;
      vs = vol === undefined ? 1 : vol;
      try { f(); } catch (e) { }
      vs = 1;
    },
    resume: function () { if (ready && ctx.state === 'suspended') ctx.resume(); },
    music: function (on, mode) {
      if (!init()) return;
      if (mode) mus.mode = mode;
      mus.on = on;
      if (on) { if (!mus.timer) { mus.next = ctx.currentTime + .06; mus.timer = setInterval(sched, 45); } }
      else if (mus.timer) { clearInterval(mus.timer); mus.timer = null; }
    },
    setMode: function (m) { mus.mode = m; },
    get musicOn() { return mus.on; },
    toggleMute: function () { muted = !muted; if (ready) master.gain.value = muted ? 0 : .8; return muted; }
  };
})(window.K);
