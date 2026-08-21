/* =========================================================
   core.js — 工具：数学 / 噪声 / 输入 / 音效
   全局命名空间: window.G
   ========================================================= */
(function () {
  'use strict';
  var G = (window.G = window.G || {});

  /* ---------- 数学 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }
  function approach(v, target, delta) { return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target); }
  function hash2(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi, seed), hash2(xi + 1, yi, seed), u),
      lerp(hash2(xi, yi + 1, seed), hash2(xi + 1, yi + 1, seed), u), v);
  }
  function fmtTime(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  // 颜色明暗调整（用于自动生成高光/阴影色阶）
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return '#' + [r, g, b].map(function (v) { return ('0' + (v | 0).toString(16)).slice(-2); }).join('');
  }
  G.clamp = clamp; G.lerp = lerp; G.rand = rand; G.randInt = randInt; G.pick = pick;
  G.sign = sign; G.approach = approach; G.hash2 = hash2; G.vnoise = vnoise;
  G.fmtTime = fmtTime; G.shade = shade;

  /* ---------- 输入（含跳跃缓冲，手感关键） ---------- */
  var Input = G.Input = {
    keys: {}, just: {},
    jumpBuffer: 0,           // 提前按跳的宽容时间
    attach: function () {
      var self = this;
      window.addEventListener('keydown', function (e) {
        if (!e.repeat) { self.just[e.code] = true; if (isJump(e.code)) self.jumpBuffer = 0.13; }
        self.keys[e.code] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
        G.SFX.unlock();
      });
      window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
      window.addEventListener('blur', function () { self.keys = {}; });
    },
    down: function (c) { return !!this.keys[c]; },
    pressed: function (c) { return !!this.just[c]; },
    endFrame: function (dt) { this.just = {}; if (this.jumpBuffer > 0) this.jumpBuffer -= (dt || 0.016); },
    axisX: function () {
      var x = 0;
      if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
      if (this.touch) x += this.touch;
      return clamp(x, -1, 1);
    },
    jumpHeld: function () {
      return !!(this.keys.Space || this.keys.KeyW || this.keys.ArrowUp || this.keys.KeyK || this.touchJump);
    },
    runHeld: function () { return !!(this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.KeyJ || this.touchRun); },
    consumeJump: function () { if (this.jumpBuffer > 0) { this.jumpBuffer = 0; return true; } return false; }
  };
  function isJump(c) { return c === 'Space' || c === 'KeyW' || c === 'ArrowUp' || c === 'KeyK'; }

  /* ---------- 音效（WebAudio 程序化） ---------- */
  var SFX = G.SFX = {
    ctx: null, muted: false, master: null, noiseBuf: null,
    unlock: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    tone: function (f, dur, type, vol, f2) {
      if (this.muted || !this.ctx) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol === undefined ? 0.16 : vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, vol, f0, f1) {
      if (this.muted || !this.ctx) return;
      if (!this.noiseBuf) {
        var n = Math.floor(this.ctx.sampleRate * 0.4);
        var buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      var t = this.ctx.currentTime;
      var src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
      var g = this.ctx.createGain(), flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(f0 || 1200, t);
      flt.frequency.exponentialRampToValueAtTime(f1 || 200, t + dur);
      g.gain.setValueAtTime(vol === undefined ? 0.2 : vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.02);
    },
    play: function (name) {
      if (this.muted || !this.ctx) return;
      switch (name) {
        case 'jump': this.tone(430, 0.12, 'square', 0.12, 700); break;
        case 'land': this.noise(0.08, 0.1, 700, 180); break;
        case 'step': this.noise(0.045, 0.05, 900, 400); break;
        case 'coin': this.tone(1050, 0.07, 'square', 0.1); setTimeout(function () { SFX.tone(1560, 0.11, 'square', 0.09); }, 60); break;
        case 'stomp': this.tone(220, 0.09, 'square', 0.14, 90); this.noise(0.1, 0.12, 900, 200); break;
        case 'hurt': this.tone(300, 0.2, 'sawtooth', 0.15, 90); break;
        case 'break': this.noise(0.16, 0.18, 1600, 300); break;
        case 'shoot': this.tone(620, 0.05, 'triangle', 0.06, 340); break;
        case 'boom': this.noise(0.5, 0.35, 800, 60); this.tone(90, 0.4, 'sawtooth', 0.12, 35); break;
        case 'heal': [660, 880, 1100].forEach(function (f, i) { setTimeout(function () { SFX.tone(f, 0.14, 'triangle', 0.1); }, i * 70); }); break;
        case 'check': [880, 1320].forEach(function (f, i) { setTimeout(function () { SFX.tone(f, 0.16, 'square', 0.1); }, i * 90); }); break;
        case 'clear': [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { SFX.tone(f, 0.2, 'square', 0.12); }, i * 120); }); break;
        case 'die': [392, 330, 262, 175].forEach(function (f, i) { setTimeout(function () { SFX.tone(f, 0.28, 'sawtooth', 0.13); }, i * 160); }); break;
        case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { SFX.tone(f, 0.24, 'square', 0.13); }, i * 150); }); break;
      }
    }
  };
})();
