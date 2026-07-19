"use strict";
// ============================================================
//  方块星野 BlockWilds - 程序化音效库
//  所有声音均由 WebAudio 实时合成 / 烘焙，无任何外部音频
// ============================================================
window.G = window.G || {};

(function() {
  var A = null; // G.Audio 引用，init 时赋值
  function ctx() { return G.Audio.ctx; }
  function now() { return ctx().currentTime; }

  // ---------- 一次性噪声打击：核心模板 ----------
  // opts: {dur, filter:[type,freq,Q], vol, color, pitchEnv:[f0,f1], attack}
  function noiseHit(o, dest) {
    var c = ctx(); if (!c) return;
    o = o || {};
    var dur = o.dur || 0.09;
    var buf = G.Audio.noiseBuffer(Math.max(0.25, dur + 0.05), o.color || 'white');
    var src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    var f = c.createBiquadFilter();
    f.type = (o.filter && o.filter[0]) || 'lowpass';
    f.frequency.value = (o.filter && o.filter[1]) || 1200;
    if (o.filter && o.filter[2] !== undefined) f.Q.value = o.filter[2];
    if (o.fSweep) {
      f.frequency.setValueAtTime(o.fSweep[0], now());
      f.frequency.exponentialRampToValueAtTime(Math.max(40, o.fSweep[1]), now() + dur);
    }
    var g = c.createGain();
    var v = o.vol !== undefined ? o.vol : 0.5;
    var atk = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(v, now() + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(); src.stop(now() + dur + 0.1);
    G.Audio.gc([src, f, g], dur + 0.2);
  }

  // ---------- 简单音调 ----------
  // opts: {freq, freq1, type, dur, vol, attack, dest}
  function tone(o, dest) {
    var c = ctx(); if (!c) return;
    o = o || {};
    var dur = o.dur || 0.15;
    var osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, now());
    if (o.freq1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq1), now() + dur);
    var g = c.createGain();
    var v = o.vol !== undefined ? o.vol : 0.3;
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(v, now() + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    osc.connect(g); g.connect(dest);
    osc.start(); osc.stop(now() + dur + 0.05);
    G.Audio.gc([osc, g], dur + 0.1);
  }

  // ---------- Karplus-Strong 拨弦（吉他/翻译机音色核心） ----------
  function pluck(freq, dur, vol, damp, dest) {
    var c = ctx(); if (!c) return;
    dur = dur || 1.6; vol = vol || 0.35; damp = damp || 0.996;
    var sr = c.sampleRate;
    var len = Math.floor(sr * dur);
    var buf = c.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var N = Math.max(2, Math.round(sr / freq));
    var ring = new Float32Array(N);
    for (var i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    var idx = 0;
    for (var i = 0; i < len; i++) {
      var cur = ring[idx];
      var nxt = ring[(idx + 1) % N];
      var next = (cur + nxt) * 0.5 * damp;
      ring[idx] = next;
      d[i] = cur;
      idx = (idx + 1) % N;
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 5200;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(); src.stop(now() + dur + 0.05);
    G.Audio.gc([src, f, g], dur + 0.1);
    return dur;
  }

  // ============================================================
  //  一次性音效实现表
  // ============================================================
  var ONESHOT = {};
  function busS() { return G.Audio.bus('sfx'); }
  function busU() { return G.Audio.bus('ui'); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ------- 挖掘：按材质分音色 -------
  ONESHOT.dig_stone = function(v) { noiseHit({ dur: 0.09, filter: ['lowpass', 900], vol: 0.55 * v, rate: rnd(0.9, 1.1) }, busS()); };
  ONESHOT.dig_wood = function(v) {
    noiseHit({ dur: 0.08, filter: ['bandpass', 420, 1.2], vol: 0.5 * v, rate: rnd(0.85, 1.05) }, busS());
    tone({ freq: rnd(180, 220), freq1: 90, dur: 0.07, type: 'triangle', vol: 0.22 * v }, busS());
  };
  ONESHOT.dig_sand = function(v) { noiseHit({ dur: 0.12, filter: ['highpass', 900], vol: 0.32 * v, color: 'pink', rate: rnd(0.9, 1.15) }, busS()); };
  ONESHOT.dig_grass = function(v) { noiseHit({ dur: 0.1, filter: ['bandpass', 1500, 0.8], vol: 0.3 * v, color: 'pink', rate: rnd(0.9, 1.2) }, busS()); };
  ONESHOT.dig_glass = function(v) {
    noiseHit({ dur: 0.09, filter: ['highpass', 2600], vol: 0.35 * v }, busS());
    tone({ freq: rnd(1700, 2100), freq1: 900, dur: 0.09, type: 'sine', vol: 0.16 * v }, busS());
  };
  ONESHOT.dig_metal = function(v) {
    tone({ freq: 820, freq1: 640, dur: 0.1, type: 'square', vol: 0.1 * v }, busS());
    tone({ freq: 1230, freq1: 980, dur: 0.12, type: 'sine', vol: 0.14 * v }, busS());
    noiseHit({ dur: 0.05, filter: ['highpass', 2000], vol: 0.22 * v }, busS());
  };
  ONESHOT.dig_crystal = function(v) {
    tone({ freq: rnd(1150, 1350), dur: 0.22, type: 'sine', vol: 0.16 * v }, busS());
    tone({ freq: rnd(1750, 2050), dur: 0.16, type: 'sine', vol: 0.1 * v }, busS());
  };
  ONESHOT.dig_snow = function(v) { noiseHit({ dur: 0.1, filter: ['lowpass', 2200], vol: 0.3 * v, color: 'pink', rate: rnd(1.0, 1.3) }, busS()); };
  ONESHOT.dig_water = function(v) {
    tone({ freq: rnd(300, 380), freq1: rnd(600, 760), dur: 0.1, type: 'sine', vol: 0.2 * v }, busS());
    noiseHit({ dur: 0.1, filter: ['lowpass', 900], vol: 0.15 * v }, busS());
  };

  // ------- 放置 -------
  function placeGen(filterF, v, extra) {
    noiseHit({ dur: 0.07, filter: ['lowpass', filterF], vol: 0.5 * v, rate: 0.8 }, busS());
    tone({ freq: 140, freq1: 70, dur: 0.06, type: 'triangle', vol: 0.25 * v }, busS());
    if (extra) extra();
  }
  ONESHOT.place_stone = function(v) { placeGen(700, v); };
  ONESHOT.place_wood = function(v) { placeGen(500, v); };
  ONESHOT.place_sand = function(v) { noiseHit({ dur: 0.1, filter: ['highpass', 700], vol: 0.3 * v, color: 'pink', rate: 0.9 }, busS()); };
  ONESHOT.place_grass = function(v) { placeGen(1100, v); };
  ONESHOT.place_glass = function(v) { placeGen(900, v, function() { tone({ freq: 1500, dur: 0.06, vol: 0.1 * v }, busS()); }); };
  ONESHOT.place_metal = function(v) { placeGen(600, v, function() { tone({ freq: 900, freq1: 760, dur: 0.09, vol: 0.1 * v }, busS()); }); };
  ONESHOT.place_crystal = function(v) { placeGen(800, v, function() { tone({ freq: 1300, dur: 0.14, vol: 0.1 * v }, busS()); }); };
  ONESHOT.place_snow = function(v) { noiseHit({ dur: 0.09, filter: ['lowpass', 1800], vol: 0.28 * v, color: 'pink' }, busS()); };

  // ------- 脚步 -------
  function stepGen(f, v, color, r0, r1) {
    noiseHit({ dur: 0.055, filter: ['lowpass', f], vol: 0.2 * v, color: color || 'white', rate: rnd(r0 || 0.9, r1 || 1.15), attack: 0.002 }, busS());
  }
  ONESHOT.step_stone = function(v) { stepGen(750, v); };
  ONESHOT.step_wood = function(v) { stepGen(450, v); tone({ freq: rnd(150, 190), freq1: 90, dur: 0.045, type: 'triangle', vol: 0.08 * v }, busS()); };
  ONESHOT.step_sand = function(v) { stepGen(2400, v, 'pink', 0.8, 1.0); };
  ONESHOT.step_grass = function(v) { stepGen(1600, v, 'pink', 0.95, 1.3); };
  ONESHOT.step_snow = function(v) { stepGen(2000, v, 'pink', 1.0, 1.2); };
  ONESHOT.step_metal = function(v) { stepGen(900, v); tone({ freq: rnd(700, 860), freq1: 500, dur: 0.05, vol: 0.05 * v }, busS()); };

  window.__SFX_ONESHOT = ONESHOT;
  window.__sfxTools = { noiseHit: noiseHit, tone: tone, pluck: pluck, rnd: rnd, busS: busS, busU: busU };
})();

(function() {
  var ONESHOT = window.__SFX_ONESHOT;
  var T = window.__sfxTools;
  var noiseHit = T.noiseHit, tone = T.tone, pluck = T.pluck, rnd = T.rnd, busS = T.busS, busU = T.busU;
  function ctx() { return G.Audio.ctx; }
  function now() { return ctx().currentTime; }

  // ------- UI -------
  ONESHOT.ui_click = function(v) { tone({ freq: 620, freq1: 520, dur: 0.045, type: 'square', vol: 0.12 * v }, busU()); };
  ONESHOT.ui_open = function(v) {
    noiseHit({ dur: 0.1, filter: ['bandpass', 900, 1], vol: 0.2 * v }, busU());
    tone({ freq: 320, freq1: 480, dur: 0.09, type: 'triangle', vol: 0.1 * v }, busU());
  };
  ONESHOT.ui_close = function(v) {
    noiseHit({ dur: 0.09, filter: ['bandpass', 700, 1], vol: 0.18 * v }, busU());
    tone({ freq: 460, freq1: 300, dur: 0.08, type: 'triangle', vol: 0.1 * v }, busU());
  };
  ONESHOT.drag_pick = function(v) { tone({ freq: 740, freq1: 820, dur: 0.04, type: 'square', vol: 0.09 * v }, busU()); };
  ONESHOT.drag_put = function(v) { tone({ freq: 520, freq1: 430, dur: 0.05, type: 'square', vol: 0.1 * v }, busU()); };
  ONESHOT.pickup = function(v) {
    tone({ freq: 720, dur: 0.05, type: 'square', vol: 0.08 * v }, busU());
    setTimeout(function() { tone({ freq: 1080, dur: 0.07, type: 'square', vol: 0.08 * v }, busU()); }, 45);
  };
  ONESHOT.drop = function(v) { tone({ freq: 400, freq1: 260, dur: 0.07, type: 'square', vol: 0.08 * v }, busU()); };
  ONESHOT.craft = function(v) {
    noiseHit({ dur: 0.07, filter: ['lowpass', 800], vol: 0.3 * v }, busU());
    setTimeout(function() { tone({ freq: 540, dur: 0.06, type: 'square', vol: 0.09 * v }, busU()); }, 60);
    setTimeout(function() { tone({ freq: 810, dur: 0.09, type: 'square', vol: 0.09 * v }, busU()); }, 130);
  };
  ONESHOT.eat = function(v) {
    for (var i = 0; i < 3; i++) {
      setTimeout(function() { noiseHit({ dur: 0.06, filter: ['bandpass', rnd(600, 1200), 1.5], vol: 0.28 * v, rate: rnd(0.8, 1.2) }, busS()); }, i * 130);
    }
  };
  ONESHOT.hurt = function(v) {
    tone({ freq: 260, freq1: 150, dur: 0.16, type: 'sawtooth', vol: 0.18 * v }, busS());
    noiseHit({ dur: 0.1, filter: ['lowpass', 700], vol: 0.3 * v }, busS());
  };
  ONESHOT.death = function(v) {
    tone({ freq: 300, freq1: 60, dur: 0.9, type: 'sawtooth', vol: 0.2 * v }, busS());
    noiseHit({ dur: 0.5, filter: ['lowpass', 500], fSweep: [800, 90], vol: 0.35 * v, color: 'brown' }, busS());
  };

  // ------- 翻译机：空灵五声音阶点亮音 -------
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  ONESHOT.translate_note = function(v) {
    var f = PENTA[Math.floor(Math.random() * PENTA.length)];
    tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.1 * v, attack: 0.01 }, busS());
    tone({ freq: f * 2.01, dur: 0.3, type: 'sine', vol: 0.03 * v, attack: 0.01 }, busS());
  };
  ONESHOT.translate_done = function(v) {
    [0, 90, 180, 300].forEach(function(t, i) {
      setTimeout(function() { tone({ freq: PENTA[i] * (i === 3 ? 1 : 1), dur: 0.6, type: 'sine', vol: 0.09 * v }, busS()); }, t);
    });
  };
  ONESHOT.signal_found = function(v) {
    [660, 880, 1320].forEach(function(f, i) {
      setTimeout(function() { tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.1 * v }, busS()); }, i * 110);
    });
  };

  // ------- 侦察兵 -------
  ONESHOT.scout_launch = function(v) {
    noiseHit({ dur: 0.18, filter: ['lowpass', 1400], fSweep: [1800, 300], vol: 0.4 * v }, busS());
    tone({ freq: 300, freq1: 900, dur: 0.14, type: 'square', vol: 0.07 * v }, busS());
  };
  ONESHOT.scout_beep = function(v) { tone({ freq: 1560, dur: 0.06, type: 'square', vol: 0.05 * v }, busS()); };
  ONESHOT.scout_recall = function(v) {
    tone({ freq: 900, freq1: 300, dur: 0.2, type: 'square', vol: 0.07 * v }, busS());
    noiseHit({ dur: 0.12, filter: ['highpass', 1200], vol: 0.15 * v }, busS());
  };

  // ------- 飞船 / 世界事件 -------
  ONESHOT.ship_door = function(v) {
    noiseHit({ dur: 0.35, filter: ['lowpass', 500], fSweep: [300, 900], vol: 0.3 * v, color: 'brown', attack: 0.05 }, busS());
    setTimeout(function() { tone({ freq: 180, freq1: 110, dur: 0.12, type: 'triangle', vol: 0.2 * v }, busS()); }, 320);
  };
  ONESHOT.landing_thud = function(v) {
    noiseHit({ dur: 0.22, filter: ['lowpass', 300], vol: 0.55 * v, color: 'brown' }, busS());
    tone({ freq: 90, freq1: 45, dur: 0.25, type: 'sine', vol: 0.35 * v }, busS());
  };
  ONESHOT.splash = function(v) {
    noiseHit({ dur: 0.3, filter: ['bandpass', 1000, 0.7], fSweep: [2000, 500], vol: 0.4 * v, color: 'pink' }, busS());
  };
  ONESHOT.geyser_burst = function(v) {
    noiseHit({ dur: 0.7, filter: ['lowpass', 1600], fSweep: [400, 2000], vol: 0.4 * v, color: 'pink', attack: 0.08 }, busS());
  };
  ONESHOT.quantum_shift = function(v) {
    tone({ freq: 1400, freq1: 700, dur: 0.18, type: 'sine', vol: 0.1 * v }, busS());
    tone({ freq: 700, freq1: 1400, dur: 0.18, type: 'sine', vol: 0.08 * v }, busS());
    noiseHit({ dur: 0.15, filter: ['highpass', 3000], vol: 0.12 * v }, busS());
  };
  ONESHOT.loop_reset = function(v) {
    tone({ freq: 880, freq1: 110, dur: 1.6, type: 'sine', vol: 0.2 * v }, busS());
    noiseHit({ dur: 1.2, filter: ['lowpass', 2000], fSweep: [4000, 100], vol: 0.25 * v, color: 'pink', attack: 0.1 }, busS());
  };
  ONESHOT.log_update = function(v) {
    [523, 659, 784].forEach(function(f, i) {
      setTimeout(function() { tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.08 * v }, busU()); }, i * 90);
    });
  };
  ONESHOT.discovery = function(v) {
    [392, 523, 659, 784].forEach(function(f, i) {
      setTimeout(function() { pluck(f, 1.2, 0.14 * v, 0.995, busU()); }, i * 140);
    });
  };
  ONESHOT.alarm_oxygen = function(v) {
    tone({ freq: 980, dur: 0.12, type: 'square', vol: 0.1 * v }, busU());
    setTimeout(function() { tone({ freq: 980, dur: 0.12, type: 'square', vol: 0.1 * v }, busU()); }, 200);
  };
  ONESHOT.alarm_fuel = function(v) { tone({ freq: 620, dur: 0.18, type: 'square', vol: 0.1 * v }, busU()); };
  ONESHOT.marshmallow_catch_fire = function(v) { noiseHit({ dur: 0.25, filter: ['bandpass', 2400, 1], vol: 0.2 * v, color: 'pink' }, busS()); };
  ONESHOT.statue_activate = function(v) {
    [220, 277, 330, 440].forEach(function(f, i) {
      setTimeout(function() { tone({ freq: f, dur: 1.4, type: 'sine', vol: 0.1 * v, attack: 0.2 }, busS()); }, i * 260);
    });
  };

  window.__SFX_ONESHOT = ONESHOT;
})();

// ============================================================
//  循环音效（loops）：营火/风/太空/喷气/引擎/龙卷/黑洞/心跳...
// ============================================================
(function() {
  var T = window.__sfxTools;
  var rnd = T.rnd;
  function ctx() { return G.Audio.ctx; }
  function now() { return ctx().currentTime; }

  // 每个 loop 返回 {gain, stop()}，音量由外部按距离实时驱动
  var LOOPS = {};

  function baseLoop(build) {
    return function(destBus) {
      var c = ctx(); if (!c) return null;
      var out = c.createGain();
      out.gain.value = 0;
      out.connect(G.Audio.bus(destBus || 'ambient'));
      var nodes = build(c, out) || [];
      return {
        gain: out,
        setLevel: function(v, t) { out.gain.setTargetAtTime(Math.max(0, v), c.currentTime, t || 0.12); },
        stop: function() {
          try { out.gain.setTargetAtTime(0, c.currentTime, 0.1); } catch (e) {}
          setTimeout(function() {
            for (var i = 0; i < nodes.length; i++) { try { nodes[i].stop ? nodes[i].stop() : 0; } catch (e) {} try { nodes[i].disconnect(); } catch (e) {} }
            try { out.disconnect(); } catch (e) {}
          }, 400);
        }
      };
    };
  }

  function noiseLoopSrc(c, color, dur) {
    var src = c.createBufferSource();
    src.buffer = G.Audio.noiseBuffer(dur || 2, color || 'pink');
    src.loop = true;
    src.start();
    return src;
  }

  // 营火：噼啪 + 低频火焰
  LOOPS.campfire = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'brown', 2);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    var g = c.createGain(); g.gain.value = 0.5;
    n.connect(f); f.connect(g); g.connect(out);
    // 噼啪声：随机短爆
    var crack = c.createGain(); crack.gain.value = 0; crack.connect(out);
    var n2 = noiseLoopSrc(c, 'white', 1);
    var f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 2600;
    n2.connect(f2); f2.connect(crack);
    var alive = true;
    (function pop() {
      if (!alive || !G.Audio.ctx) return;
      var t = c.currentTime;
      crack.gain.cancelScheduledValues(t);
      crack.gain.setValueAtTime(0, t);
      crack.gain.linearRampToValueAtTime(rnd(0.2, 0.6), t + 0.005);
      crack.gain.exponentialRampToValueAtTime(0.001, t + rnd(0.03, 0.09));
      setTimeout(pop, rnd(120, 700));
    })();
    out._killers = [function() { alive = false; }];
    return [n, n2, f, f2, g, crack];
  });

  // 风（大气内）
  LOOPS.wind = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'pink', 3);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.13;
    var lg = c.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    n.connect(f); f.connect(out);
    return [n, f, lfo, lg];
  });

  // 太空静谧：极低哼鸣 + 微弱闪烁
  LOOPS.space_drone = baseLoop(function(c, out) {
    var o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 48;
    var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 72.3;
    var g1 = c.createGain(); g1.gain.value = 0.35;
    var g2 = c.createGain(); g2.gain.value = 0.12;
    o1.connect(g1); g1.connect(out); o2.connect(g2); g2.connect(out);
    o1.start(); o2.start();
    var n = noiseLoopSrc(c, 'pink', 4);
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    var ng = c.createGain(); ng.gain.value = 0.015;
    n.connect(f); f.connect(ng); ng.connect(out);
    return [o1, o2, g1, g2, n, f, ng];
  });

  // 喷气背包
  LOOPS.jetpack = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'white', 1.5);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
    n.connect(f); f.connect(out);
    return [n, f];
  });

  // 飞船引擎
  LOOPS.ship_thrust = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'brown', 2);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
    var og = c.createGain(); og.gain.value = 0.18;
    n.connect(f); f.connect(out);
    o.connect(og); og.connect(out); o.start();
    out._engineFilter = f; out._engineOsc = o;
    return [n, f, o, og];
  });

  // 龙卷风
  LOOPS.tornado = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'pink', 3);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 1.2;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.5;
    var lg = c.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    n.connect(f); f.connect(out);
    return [n, f, lfo, lg];
  });

  // 黑洞低频轰鸣
  LOOPS.blackhole = baseLoop(function(c, out) {
    var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 31;
    var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 38.7;
    var g = c.createGain(); g.gain.value = 0.6;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    var lg = c.createGain(); lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    o.connect(g); o2.connect(g); g.connect(out);
    o.start(); o2.start();
    return [o, o2, g, lfo, lg];
  });

  // 心跳（鮟鱇鱼逼近）
  LOOPS.heartbeat = baseLoop(function(c, out) {
    var alive = true;
    out._rate = 1;
    function thump(delay, vol) {
      var t = c.currentTime + delay;
      var o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.2);
      G.Audio.gc([o, g], delay + 0.4);
    }
    (function beat() {
      if (!alive) return;
      thump(0, 0.85); thump(0.22 / out._rate, 0.5);
      setTimeout(beat, (900 / out._rate));
    })();
    out._killers = [function() { alive = false; }];
    return [];
  });

  // 幽灵物质
  LOOPS.ghost_crackle = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'white', 2);
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5200;
    var g = c.createGain(); g.gain.value = 0.4;
    var lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9;
    var lg = c.createGain(); lg.gain.value = 0.3;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    n.connect(f); f.connect(g); g.connect(out);
    return [n, f, g, lfo, lg];
  });

  // 重力晶体
  LOOPS.gravity_hum = baseLoop(function(c, out) {
    var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 110;
    var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 165.2;
    var g = c.createGain(); g.gain.value = 0.35;
    o.connect(g); o2.connect(g); g.connect(out);
    o.start(); o2.start();
    return [o, o2, g];
  });

  // 信号镜静态噪声
  LOOPS.signal_static = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'white', 2);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.5;
    var g = c.createGain(); g.gain.value = 0.25;
    n.connect(f); f.connect(g); g.connect(out);
    return [n, f, g];
  });

  // 间歇泉 / 流沙柱 / 鮟鱇鱼游动
  LOOPS.geyser = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'pink', 2.5);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1000;
    n.connect(f); f.connect(out);
    return [n, f];
  });
  LOOPS.sand_flow = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'pink', 3);
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    var g = c.createGain(); g.gain.value = 0.5;
    n.connect(f); f.connect(g); g.connect(out);
    return [n, f, g];
  });
  LOOPS.anglerfish = baseLoop(function(c, out) {
    var n = noiseLoopSrc(c, 'brown', 2);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.4;
    var lg = c.createGain(); lg.gain.value = 90;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    n.connect(f); f.connect(out);
    return [n, f, lfo, lg];
  });

  // ============ G.SFX 公开 API ============
  var ONESHOT = window.__SFX_ONESHOT;
  var _liveLoops = {};

  G.SFX = {
    play: function(name, vol) {
      if (!G.Audio.ctx) return;
      var fn = ONESHOT[name];
      if (fn) { try { fn(vol === undefined ? 1 : vol); } catch (e) {} }
    },
    // 材质相关快捷
    dig: function(mat, vol) { this.play('dig_' + (mat || 'stone'), vol); },
    place: function(mat, vol) { this.play('place_' + (mat === 'water' ? 'stone' : (mat || 'stone')), vol); },
    step: function(mat, vol) {
      var m = mat || 'stone';
      if (m === 'water' || m === 'glass' || m === 'crystal') m = 'stone';
      this.play('step_' + m, vol);
    },
    loop: function(name, bus) {
      if (!G.Audio.ctx) return null;
      if (_liveLoops[name]) return _liveLoops[name];
      var mk = LOOPS[name];
      if (!mk) return null;
      var inst = mk(bus);
      _liveLoops[name] = inst;
      return inst;
    },
    setLoopLevel: function(name, v, t) {
      var l = _liveLoops[name] || this.loop(name);
      if (l) l.setLevel(v, t);
    },
    stopLoop: function(name) {
      var l = _liveLoops[name];
      if (l) {
        if (l.gain && l.gain._killers) l.gain._killers.forEach(function(k) { k(); });
        l.stop();
        delete _liveLoops[name];
      }
    },
    getLoop: function(name) { return _liveLoops[name] || null; }
  };
})();
