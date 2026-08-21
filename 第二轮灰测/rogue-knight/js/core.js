/* core.js — 数学 / 随机 / 输入 / 网格碰撞 */
window.K = window.K || {};
(function (K) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sgn(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
  function rnd(a, b) { if (b === undefined) { b = a === undefined ? 1 : a; a = 0; } return a + Math.random() * (b - a); }
  function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function chance(p) { return Math.random() < p; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function dist(a, b) { return len(b.x - a.x, b.y - a.y); }
  function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
  function ang(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function angDiff(a, b) { var d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function approach(v, t, s) { return v < t ? Math.min(v + s, t) : Math.max(v - s, t); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function shuffle(a, R) {
    for (var i = a.length - 1; i > 0; i--) { var j = R ? R.int(0, i) : rndi(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* 可复现随机 */
  function RNG(seed) { this.s = (seed | 0) || 12345; }
  RNG.prototype.next = function () { this.s = (this.s * 1664525 + 1013904223) % 4294967296; return this.s / 4294967296; };
  RNG.prototype.f = function (a, b) { if (b === undefined) { b = a === undefined ? 1 : a; a = 0; } return a + this.next() * (b - a); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.f(a, b + 1)); };
  RNG.prototype.pick = function (a) { return a[this.int(0, a.length - 1)]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.weighted = function (list, key) {
    var tot = 0, i;
    for (i = 0; i < list.length; i++) tot += (key ? list[i][key] : list[i].w) || 1;
    var r = this.f(0, tot);
    for (i = 0; i < list.length; i++) { r -= (key ? list[i][key] : list[i].w) || 1; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  };

  K.M = { TAU: TAU, clamp: clamp, lerp: lerp, sgn: sgn, rnd: rnd, rndi: rndi, pick: pick, chance: chance,
    len: len, dist: dist, dist2: dist2, ang: ang, angDiff: angDiff, approach: approach, smooth: smooth,
    easeOut: easeOut, shuffle: shuffle, RNG: RNG };

  /* ---------------- 网格碰撞 ---------------- */
  var TS = 44;
  K.TS = TS;
  /* 轴分离的 AABB-vs-瓦片 移动（俯视游戏最稳） */
  function moveBody(e, dx, dy, solid) {
    var r = e.r * .86, ty0, ty1, tx0, tx1, c, t, hitX = 0, hitY = 0;
    if (dx) {
      e.x += dx;
      ty0 = Math.floor((e.y - r) / TS); ty1 = Math.floor((e.y + r) / TS);
      if (dx > 0) {
        c = Math.floor((e.x + r) / TS);
        for (t = ty0; t <= ty1; t++) if (solid(c, t)) { e.x = c * TS - r - .01; hitX = 1; break; }
      } else {
        c = Math.floor((e.x - r) / TS);
        for (t = ty0; t <= ty1; t++) if (solid(c, t)) { e.x = (c + 1) * TS + r + .01; hitX = -1; break; }
      }
    }
    if (dy) {
      e.y += dy;
      tx0 = Math.floor((e.x - r) / TS); tx1 = Math.floor((e.x + r) / TS);
      if (dy > 0) {
        c = Math.floor((e.y + r) / TS);
        for (t = tx0; t <= tx1; t++) if (solid(t, c)) { e.y = c * TS - r - .01; hitY = 1; break; }
      } else {
        c = Math.floor((e.y - r) / TS);
        for (t = tx0; t <= tx1; t++) if (solid(t, c)) { e.y = (c + 1) * TS + r + .01; hitY = -1; break; }
      }
    }
    return { x: hitX, y: hitY };
  }
  /* 光线步进（激光/视线） */
  function ray(x, y, dx, dy, maxD, solid) {
    var l = len(dx, dy) || 1, sx = dx / l * 6, sy = dy / l * 6, d = 0;
    while (d < maxD) {
      x += sx; y += sy; d += 6;
      if (solid(Math.floor(x / TS), Math.floor(y / TS))) return { x: x - sx, y: y - sy, d: d - 6, hit: 1 };
    }
    return { x: x, y: y, d: d, hit: 0 };
  }
  function circHit(a, b) { var dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r); return dx * dx + dy * dy < rr * rr; }
  /* 扇形命中（近战挥击） */
  function arcHit(cx, cy, r0, r1, a0, half, px, py, pr) {
    var d = len(px - cx, py - cy);
    if (d > r1 + pr || d < r0 - pr) return 0;
    var a = Math.atan2(py - cy, px - cx);
    var ad = Math.abs(angDiff(a0, a));
    var slack = d > 1 ? Math.asin(clamp(pr / d, 0, 1)) : Math.PI;
    return ad <= half + slack ? 1 : 0;
  }
  K.Col = { moveBody: moveBody, ray: ray, circHit: circHit, arcHit: arcHit };

  /* ---------------- 输入 ---------------- */
  var raw = {}, edge = {}, mouse = { x: 640, y: 360, wx: 0, wy: 0, down: 0, pdown: 0, rdown: 0, prdown: 0, moved: 0, wheel: 0 };
  K.In = {
    raw: raw, mouse: mouse, padIdx: 0,
    init: function (cv) {
      if (typeof window === 'undefined') return;
      window.addEventListener('keydown', function (e) {
        if (!raw[e.code]) edge[e.code] = 1;
        raw[e.code] = 1;
        if (['Space', 'Tab', 'F1', 'F2', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) { raw[e.code] = 0; });
      window.addEventListener('blur', function () { for (var k in raw) raw[k] = 0; mouse.down = 0; mouse.rdown = 0; });
      if (!cv) return;
      function pos(e) {
        var r = cv.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width * 1280;
        mouse.y = (e.clientY - r.top) / r.height * 720;
        mouse.moved = 30;
      }
      cv.addEventListener('mousemove', pos);
      cv.addEventListener('mousedown', function (e) { pos(e); if (e.button === 0) mouse.down = 1; if (e.button === 2) mouse.rdown = 1; e.preventDefault(); });
      window.addEventListener('mouseup', function (e) { if (e.button === 0) mouse.down = 0; if (e.button === 2) mouse.rdown = 0; });
      cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      cv.addEventListener('wheel', function (e) { mouse.wheel = e.deltaY > 0 ? 1 : -1; e.preventDefault(); }, { passive: false });
    },
    /* 每帧调用：键鼠为事件驱动，此处仅保留手柄轮询钩子 */
    update: function () { },
    pad: function () {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
      var g = navigator.getGamepads()[K.In.padIdx];
      return g && g.connected ? g : null;
    },
    /* 移动向量（键盘 + 左摇杆） */
    move: function () {
      var x = 0, y = 0;
      if (raw.KeyA || raw.ArrowLeft) x -= 1;
      if (raw.KeyD || raw.ArrowRight) x += 1;
      if (raw.KeyW || raw.ArrowUp) y -= 1;
      if (raw.KeyS || raw.ArrowDown) y += 1;
      var g = this.pad();
      if (g) {
        var ax = g.axes[0] || 0, ay = g.axes[1] || 0;
        if (Math.abs(ax) > .22) x += ax; if (Math.abs(ay) > .22) y += ay;
        if (g.buttons[14] && g.buttons[14].pressed) x -= 1;
        if (g.buttons[15] && g.buttons[15].pressed) x += 1;
        if (g.buttons[12] && g.buttons[12].pressed) y -= 1;
        if (g.buttons[13] && g.buttons[13].pressed) y += 1;
      }
      var l = len(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x: x, y: y, l: Math.min(1, l) };
    },
    stickAim: function () {
      var g = this.pad(); if (!g) return null;
      var ax = g.axes[2] || 0, ay = g.axes[3] || 0;
      if (len(ax, ay) < .3) return null;
      return { x: ax, y: ay };
    },
    down: function (c) { return !!raw[c]; },
    tap: function (c) { return !!edge[c]; },
    padDown: function (i) { var g = this.pad(); return !!(g && g.buttons[i] && g.buttons[i].pressed); },
    fire: function () { return mouse.down || this.down('KeyJ') || this.padDown(7) || this.padDown(5); },
    endFrame: function () {
      edge = {}; K.In.edge = edge;
      mouse.pdown = mouse.down; mouse.prdown = mouse.rdown; mouse.wheel = 0;
      if (mouse.moved > 0) mouse.moved--;
    },
    setRaw: function (c, v) { if (v) { if (!raw[c]) edge[c] = 1; raw[c] = 1; } else raw[c] = 0; },
    rumble: function (s, d) {
      try { var g = this.pad(); if (g && g.vibrationActuator) g.vibrationActuator.playEffect('dual-rumble', { duration: d || 90, strongMagnitude: s, weakMagnitude: s * .7 }); } catch (e) { }
    }
  };
  K.In.edge = edge;
})(window.K);
