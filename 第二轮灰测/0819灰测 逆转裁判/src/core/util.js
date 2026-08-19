/* ============================================================
   util.js — 全局命名空间、数学、缓动、颜色、随机数、补间
   ============================================================ */
window.AA = window.AA || {};

(function (AA) {
  'use strict';

  var U = AA.U = {};

  /* ---------------- 数学 ---------------- */
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.inv = function (a, b, v) { return b === a ? 0 : (v - a) / (b - a); };
  U.sat = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  U.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  U.round = Math.round;
  U.mod = function (a, n) { return ((a % n) + n) % n; };
  U.dist = function (x, y) { return Math.sqrt(x * x + y * y); };
  U.deg = Math.PI / 180;
  U.tri = function (t) { t = U.mod(t, 1); return t < 0.5 ? t * 2 : 2 - t * 2; };

  /* ---------------- 缓动 ---------------- */
  var E = U.ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { var f = t - 1; return f * f * f + 1; },
    inOutCubic: function (t) { return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    outQuart: function (t) { var f = t - 1; return 1 - f * f * f * f; },
    inExpo: function (t) { return t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)); },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    outBack: function (t) { var s = 1.9; var f = t - 1; return 1 + f * f * ((s + 1) * f + s); },
    outElastic: function (t) {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return Math.pow(2, -9 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1;
    },
    outBounce: function (t) {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + .75; }
      if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + .9375; }
      t -= 2.625 / 2.75; return 7.5625 * t * t + .984375;
    },
    // 逆转裁判式的“弹进后微抖”
    pop: function (t) { return t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) * Math.cos(t * 7.2); }
  };

  /* ---------------- 随机 ---------------- */
  U.rng = function (seed) {
    var s = (seed | 0) || 0x2f6e2b1;
    return function () {
      s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  };
  var _r = U.rng(20250819);
  U.rand = function (a, b) { if (a === undefined) return _r(); if (b === undefined) return _r() * a; return a + _r() * (b - a); };
  U.randi = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.pick = function (arr) { return arr[Math.floor(_r() * arr.length)]; };
  // 稳定的伪随机（用于确定性的像素噪点）
  U.hash2 = function (x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  };

  /* ---------------- 颜色 ---------------- */
  function hx(n) { n = U.clamp(Math.round(n), 0, 255).toString(16); return n.length < 2 ? '0' + n : n; }
  U.rgb2hex = function (r, g, b) { return '#' + hx(r) + hx(g) + hx(b); };
  U.hex2rgb = function (h) {
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  U.mix = function (c1, c2, t) {
    var a = U.hex2rgb(c1), b = U.hex2rgb(c2);
    return U.rgb2hex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  U.shade = function (c, amt) { return amt < 0 ? U.mix(c, '#000000', -amt) : U.mix(c, '#ffffff', amt); };
  // 朝阴影色偏移（不是单纯变暗：向蓝紫偏，更像手绘赛璐璐）
  U.shadow = function (c, amt) {
    var a = U.hex2rgb(c);
    return U.rgb2hex(
      U.lerp(a[0], a[0] * .48 + 18, amt),
      U.lerp(a[1], a[1] * .50 + 20, amt),
      U.lerp(a[2], a[2] * .66 + 46, amt));
  };
  U.hilite = function (c, amt) {
    var a = U.hex2rgb(c);
    return U.rgb2hex(
      U.lerp(a[0], a[0] * .74 + 88, amt),
      U.lerp(a[1], a[1] * .76 + 82, amt),
      U.lerp(a[2], a[2] * .78 + 66, amt));
  };
  // 15bit（NDS）色彩量化
  U.q15 = function (c) {
    var a = U.hex2rgb(c);
    return U.rgb2hex((a[0] >> 3) * 255 / 31, (a[1] >> 3) * 255 / 31, (a[2] >> 3) * 255 / 31);
  };

  /* ---------------- 简易补间管理 ---------------- */
  function Tw(obj) {
    this.o = obj; this.q = []; this.done = false;
  }
  Tw.prototype.to = function (props, dur, ease) {
    this.q.push({ p: props, d: Math.max(1e-4, dur), e: ease || E.outCubic, t: 0, from: null });
    return this;
  };
  Tw.prototype.wait = function (dur) { this.q.push({ p: null, d: dur, e: E.linear, t: 0 }); return this; };
  Tw.prototype.call = function (fn) { this.q.push({ fn: fn, d: 0, t: 0 }); return this; };
  Tw.prototype.step = function (dt) {
    while (dt > 0 && this.q.length) {
      var s = this.q[0];
      if (s.fn) { s.fn(); this.q.shift(); continue; }
      if (s.p && !s.from) {
        s.from = {};
        for (var k in s.p) s.from[k] = this.o[k] || 0;
      }
      var use = Math.min(dt, s.d - s.t);
      s.t += use; dt -= use;
      var t = s.e(U.sat(s.t / s.d));
      if (s.p) for (var k2 in s.p) this.o[k2] = U.lerp(s.from[k2], s.p[k2], t);
      if (s.t >= s.d - 1e-9) this.q.shift();
    }
    this.done = this.q.length === 0;
    return this.done;
  };

  U.Tween = function (obj) { return new Tw(obj); };

  function TweenPool() { this.list = []; }
  TweenPool.prototype.add = function (obj) { var t = new Tw(obj); this.list.push(t); return t; };
  TweenPool.prototype.step = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) if (this.list[i].step(dt)) this.list.splice(i, 1);
  };
  TweenPool.prototype.clear = function () { this.list.length = 0; };
  U.TweenPool = TweenPool;

  /* ---------------- 定时器 / 序列 ---------------- */
  function Timers() { this.list = []; }
  Timers.prototype.after = function (t, fn) { this.list.push({ t: t, fn: fn }); };
  Timers.prototype.every = function (t, fn) { this.list.push({ t: t, fn: fn, rep: t }); };
  Timers.prototype.step = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var e = this.list[i]; e.t -= dt;
      if (e.t <= 0) {
        if (e.rep) { e.t += e.rep; e.fn(); }
        else { this.list.splice(i, 1); e.fn(); }
      }
    }
  };
  Timers.prototype.clear = function () { this.list.length = 0; };
  U.Timers = Timers;

  /* ---------------- canvas 工具 ---------------- */
  U.canvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  U.ctx = function (w, h) {
    var c = U.canvas(w, h);
    var x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = false;
    return x;
  };
  U.crisp = function (ctx) { ctx.imageSmoothingEnabled = false; return ctx; };

  /* ---------------- 文本换行（按宽度，支持 CJK 逐字断行） ---------------- */
  U.wrap = function (text, maxw, measure) {
    var lines = [], cur = '', curw = 0;
    var noHead = '，。、；：？！）】》”』・…,.!?:;)]}>';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { lines.push(cur); cur = ''; curw = 0; continue; }
      var w = measure(ch);
      if (curw + w > maxw && cur.length) {
        // 避免行首标点
        if (noHead.indexOf(ch) >= 0 && cur.length > 1) {
          var last = cur[cur.length - 1];
          cur = cur.slice(0, -1);
          lines.push(cur);
          cur = last + ch; curw = measure(last) + w;
        } else {
          lines.push(cur); cur = ch; curw = w;
        }
      } else { cur += ch; curw += w; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  };

  U.dbg = function () {
    if (!AA.DEBUG) return;
    try { console.log.apply(console, arguments); } catch (e) { }
  };

})(window.AA);
