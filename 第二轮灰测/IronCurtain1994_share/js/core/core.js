/* 铁幕1994 — 核心工具 / 六角格数学 / DOM 助手
 * 全局命名空间 IC
 */
(function () {
  'use strict';
  var IC = window.IC = window.IC || {};

  /* ---------------- 随机数（可复现） ---------------- */
  function RNG(seed) {
    this.s = (seed >>> 0) || 0x2f6e2b1;
  }
  RNG.prototype.next = function () {
    // xorshift32
    var x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)] ; };
  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  IC.RNG = RNG;

  /* ---------------- 通用 ---------------- */
  var U = IC.Util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sum: function (arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) s += f ? f(arr[i]) : arr[i]; return s; },
    deep: function (o) { return JSON.parse(JSON.stringify(o)); },
    pad: function (n, w) { var s = '' + n; while (s.length < (w || 2)) s = '0' + s; return s; },
    id: (function () { var n = 1; return function (p) { return (p || 'x') + (n++); }; })(),
    fmt: function (n) { return Math.round(n).toLocaleString('zh-CN'); },
    pct: function (v) { return Math.round(v * 100) + '%'; },
    byId: function (id) { return document.getElementById(id); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
  };

  /* ---------------- DOM 助手 ---------------- */
  U.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.clear = function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };
  U.on = function (node, ev, fn) { if (node) node.addEventListener(ev, fn); return node; };

  /* ---------------- 六角格（axial, pointy-top） ---------------- */
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  var Hex = IC.Hex = {
    DIRS: DIRS,
    key: function (q, r) { return q + ',' + r; },
    parse: function (k) { var p = k.split(','); return { q: +p[0], r: +p[1] }; },
    neighbor: function (q, r, d) { var v = DIRS[((d % 6) + 6) % 6]; return { q: q + v[0], r: r + v[1] }; },
    neighbors: function (q, r) {
      var out = [];
      for (var i = 0; i < 6; i++) out.push({ q: q + DIRS[i][0], r: r + DIRS[i][1], d: i });
      return out;
    },
    dist: function (a, b) {
      var dq = a.q - b.q, dr = a.r - b.r;
      return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
    },
    dirTo: function (a, b) {
      // 返回 0..5 中与 a->b 方向最接近者
      var best = 0, bestDot = -Infinity;
      var ax = a.q + a.r * 0.5, ay = a.r;
      var bx = b.q + b.r * 0.5, by = b.r;
      var vx = bx - ax, vy = by - ay;
      var len = Math.sqrt(vx * vx + vy * vy) || 1; vx /= len; vy /= len;
      for (var i = 0; i < 6; i++) {
        var dx = DIRS[i][0] + DIRS[i][1] * 0.5, dy = DIRS[i][1];
        var l2 = Math.sqrt(dx * dx + dy * dy) || 1;
        var dot = (dx / l2) * vx + (dy / l2) * vy;
        if (dot > bestDot) { bestDot = dot; best = i; }
      }
      return best;
    },
    ring: function (q, r, rad) {
      if (rad <= 0) return [{ q: q, r: r }];
      var res = [], cq = q + DIRS[4][0] * rad, cr = r + DIRS[4][1] * rad;
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < rad; j++) {
          res.push({ q: cq, r: cr });
          cq += DIRS[i][0]; cr += DIRS[i][1];
        }
      }
      return res;
    },
    spiral: function (q, r, rad) {
      var res = [{ q: q, r: r }];
      for (var i = 1; i <= rad; i++) res = res.concat(Hex.ring(q, r, i));
      return res;
    },
    /* 直线插值（cube lerp），返回途经格 */
    line: function (a, b) {
      var N = Hex.dist(a, b);
      if (N === 0) return [{ q: a.q, r: a.r }];
      function cube(h) { return { x: h.q, z: h.r, y: -h.q - h.r }; }
      function round(c) {
        var rx = Math.round(c.x), ry = Math.round(c.y), rz = Math.round(c.z);
        var dx = Math.abs(rx - c.x), dy = Math.abs(ry - c.y), dz = Math.abs(rz - c.z);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
        return { q: rx, r: rz };
      }
      var ca = cube(a), cb = cube(b), out = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        out.push(round({ x: U.lerp(ca.x, cb.x, t) + 1e-6, y: U.lerp(ca.y, cb.y, t) + 1e-6, z: U.lerp(ca.z, cb.z, t) - 2e-6 }));
      }
      return out;
    },
    /* 像素坐标（pointy-top） */
    toPixel: function (q, r, size) {
      return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
    },
    fromPixel: function (x, y, size) {
      var r = (2 / 3) * y / size;
      var q = (x / (size * Math.sqrt(3))) - r / 2;
      // cube round
      var cz = r, cx = q, cy = -cx - cz;
      var rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
      var dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      return { q: rx, r: rz };
    }
  };

  /* ---------------- 存档 ---------------- */
  IC.Store = {
    KEY: 'ironcurtain1994',
    read: function () {
      try { return JSON.parse(localStorage.getItem(IC.Store.KEY) || '{}'); } catch (e) { return {}; }
    },
    write: function (o) {
      try { localStorage.setItem(IC.Store.KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
    },
    patch: function (o) {
      var d = IC.Store.read();
      for (var k in o) d[k] = o[k];
      return IC.Store.write(d);
    }
  };
})();
