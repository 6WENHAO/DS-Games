/* ============ 核心工具 ============ */
window.COC = window.COC || {};

COC.U = (function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
  function dist2(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function randF(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* 数字格式化 12,345 */
  function fmt(n) {
    n = Math.floor(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* 秒 -> "1天2时" / "3分05秒" */
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600),
        m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    if (d > 0) return d + '天' + (h > 0 ? h + '时' : '');
    if (h > 0) return h + '时' + (m > 0 ? m + '分' : '');
    if (m > 0) return m + '分' + (s > 0 ? (s < 10 ? '0' + s : s) + '秒' : '');
    return s + '秒';
  }

  function now() { return Date.now(); }

  /* 简易事件总线 */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, data) {
    var l = listeners[ev];
    if (l) for (var i = 0; i < l.length; i++) l[i](data);
  }

  return {
    clamp: clamp, lerp: lerp, dist: dist, dist2: dist2,
    randInt: randInt, randF: randF, pick: pick, shuffle: shuffle,
    fmt: fmt, fmtTime: fmtTime, now: now, on: on, emit: emit
  };
})();
