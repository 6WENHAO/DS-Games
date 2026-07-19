"use strict";
// ============================================================
//  方块星野 BlockWilds - 音乐系统（全部原创旋律，实时合成）
//  营火吉他主题 / 超新星弦乐预警 / 太空氛围垫
// ============================================================
window.G = window.G || {};

(function() {
  function ctx() { return G.Audio.ctx; }

  // ---------- 音名 -> 频率 ----------
  var A4 = 440;
  function nf(semiFromA4) { return A4 * Math.pow(2, semiFromA4 / 12); }
  // A小调五声音阶常用音（原创旋律使用）
  var N = {
    A2: nf(-24), C3: nf(-21), D3: nf(-19), E3: nf(-17), G3: nf(-14),
    A3: nf(-12), C4: nf(-9), D4: nf(-7), E4: nf(-5), G4: nf(-2),
    A4: nf(0), C5: nf(3), D5: nf(5), E5: nf(7), G5: nf(10), A5: nf(12)
  };

  // ---------- 吉他拨弦（Karplus-Strong，复用 sfx 的实现思路但独立输出） ----------
  function pluckTo(gainNode, freq, dur, vol, damp) {
    var c = ctx(); if (!c) return;
    dur = dur || 1.8; vol = vol || 0.3; damp = damp || 0.9962;
    var sr = c.sampleRate, len = Math.floor(sr * dur);
    var buf = c.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var Nn = Math.max(2, Math.round(sr / freq));
    var ring = new Float32Array(Nn);
    for (var i = 0; i < Nn; i++) ring[i] = Math.random() * 2 - 1;
    var idx = 0;
    for (var i = 0; i < len; i++) {
      var cur = ring[idx], nxt = ring[(idx + 1) % Nn];
      ring[idx] = (cur + nxt) * 0.5 * damp;
      d[i] = cur; idx = (idx + 1) % Nn;
    }
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3800;
    src.connect(f); f.connect(g); g.connect(gainNode);
    src.start(); src.stop(c.currentTime + dur + 0.05);
    G.Audio.gc([src, f, g], dur + 0.1);
  }

  // ============================================================
  //  营火主题（原创曲；四小节循环，低音+旋律双声部）
  //  格式: [拍位, 频率, 时值, 力度]
  // ============================================================
  var BPM = 72, BEAT = 60 / BPM;
  var MELODY = [
    // 小节1
    [0.0, N.A4, 1.6, 0.9], [1.0, N.C5, 0.8, 0.7], [1.5, N.D5, 0.8, 0.75],
    [2.0, N.E5, 1.8, 0.95], [3.5, N.D5, 0.6, 0.6],
    // 小节2
    [4.0, N.C5, 1.4, 0.85], [5.0, N.A4, 0.9, 0.7], [5.5, N.G4, 0.9, 0.65],
    [6.0, N.A4, 2.2, 0.9],
    // 小节3
    [8.0, N.E4, 1.2, 0.8], [9.0, N.G4, 0.8, 0.7], [9.5, N.A4, 0.8, 0.75],
    [10.0, N.C5, 1.6, 0.9], [11.0, N.D5, 0.7, 0.6], [11.5, N.E5, 0.7, 0.65],
    // 小节4
    [12.0, N.D5, 1.2, 0.85], [13.0, N.C5, 0.8, 0.7], [13.5, N.A4, 0.9, 0.75],
    [14.0, N.G4, 1.0, 0.7], [14.75, N.A4, 2.4, 0.95]
  ];
  var BASSLINE = [
    [0.0, N.A2, 1.9, 0.8], [2.0, N.E3, 1.9, 0.6],
    [4.0, N.G3, 1.9, 0.7], [6.0, N.A2, 1.9, 0.75],
    [8.0, N.C3, 1.9, 0.7], [10.0, N.A2, 1.9, 0.65],
    [12.0, N.D3, 1.9, 0.7], [14.0, N.E3, 1.9, 0.7]
  ];
  var LOOP_BEATS = 16;

  var _campGain = null, _campTimer = null, _campLevel = 0;

  function scheduleCampLoop() {
    if (!ctx() || !_campGain) return;
    var events = [];
    MELODY.forEach(function(e) { events.push({ t: e[0] * BEAT, f: e[1], d: e[2] * BEAT + 0.7, v: e[3] * 0.34 }); });
    BASSLINE.forEach(function(e) { events.push({ t: e[0] * BEAT, f: e[1], d: e[2] * BEAT + 0.8, v: e[3] * 0.3, damp: 0.9975 }); });
    events.forEach(function(e) {
      e.timer = setTimeout(function() {
        if (_campGain) pluckTo(_campGain, e.f, e.d, e.v, e.damp || 0.9962);
      }, e.t * 1000);
    });
    _campTimer = setTimeout(scheduleCampLoop, LOOP_BEATS * BEAT * 1000);
  }

  // ============================================================
  //  超新星预警弦乐：末段渐强的合成弦乐团
  // ============================================================
  var _novaNodes = null;
  function startNovaSwell(seconds) {
    var c = ctx(); if (!c || _novaNodes) return;
    var out = c.createGain(); out.gain.value = 0;
    out.connect(G.Audio.bus('music'));
    var freqs = [110, 138.6, 164.8, 220, 277.2, 329.6]; // A小三和弦堆叠
    var nodes = [out];
    freqs.forEach(function(f, i) {
      var o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      var fl = c.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(400, c.currentTime);
      fl.frequency.linearRampToValueAtTime(3200, c.currentTime + seconds);
      var g = c.createGain(); g.gain.value = 0.07;
      o.connect(fl); fl.connect(g); g.connect(out);
      o.start();
      nodes.push(o, fl, g);
    });
    out.gain.setValueAtTime(0.0001, c.currentTime);
    out.gain.exponentialRampToValueAtTime(0.85, c.currentTime + seconds);
    // 半音上行的紧张感：顶部声部缓慢滑升
    _novaNodes = nodes;
  }
  function stopNovaSwell() {
    if (!_novaNodes) return;
    var c = ctx();
    var out = _novaNodes[0];
    try { out.gain.setTargetAtTime(0, c.currentTime, 0.2); } catch (e) {}
    var list = _novaNodes;
    _novaNodes = null;
    setTimeout(function() {
      list.forEach(function(n) { try { n.stop ? n.stop() : 0; } catch (e) {} try { n.disconnect(); } catch (e) {} });
    }, 1500);
  }

  // ============================================================
  //  太空氛围垫：缥缈长音（进入太空时淡入）
  // ============================================================
  var _padNodes = null, _padGain = null;
  function ensurePad() {
    var c = ctx(); if (!c || _padNodes) return;
    _padGain = c.createGain(); _padGain.gain.value = 0;
    _padGain.connect(G.Audio.bus('music'));
    var freqs = [N.A3, N.E4, N.A4];
    var nodes = [];
    freqs.forEach(function(f) {
      var o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      var g = c.createGain(); g.gain.value = 0.05;
      var lfo = c.createOscillator(); lfo.frequency.value = 0.06 + Math.random() * 0.05;
      var lg = c.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(_padGain);
      o.start(); lfo.start();
      nodes.push(o, g, lfo, lg);
    });
    _padNodes = nodes;
  }

  G.Music = {
    // 营火主题由 gameplay 按玩家与营火距离驱动音量
    startCampfireTheme: function() {
      var c = ctx(); if (!c || _campGain) return;
      _campGain = c.createGain();
      _campGain.gain.value = 0;
      _campGain.connect(G.Audio.bus('music'));
      scheduleCampLoop();
    },
    setCampfireLevel: function(v, t) {
      var c = ctx(); if (!c) return;
      if (!_campGain) this.startCampfireTheme();
      if (_campLevel === v) return;
      _campLevel = v;
      _campGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), c.currentTime, t || 0.8);
    },
    stopCampfireTheme: function() {
      if (_campTimer) { clearTimeout(_campTimer); _campTimer = null; }
      if (_campGain) {
        var g = _campGain; _campGain = null; _campLevel = 0;
        try { g.gain.setTargetAtTime(0, ctx().currentTime, 0.3); } catch (e) {}
        setTimeout(function() { try { g.disconnect(); } catch (e) {} }, 1200);
      }
    },
    startNovaSwell: startNovaSwell,
    stopNovaSwell: stopNovaSwell,
    setSpacePad: function(v, t) {
      var c = ctx(); if (!c) return;
      ensurePad();
      if (_padGain) _padGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), c.currentTime, t || 1.5);
    }
  };
})();
