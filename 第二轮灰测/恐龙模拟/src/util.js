/* ============ 工具：数学 / 随机 / 噪声 ============ */
window.DINO = window.DINO || {};
(function (D) {
  "use strict";

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
  function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
  function angleDiff(a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }
  function turnToward(a, b, maxStep) { return a + clamp(angleDiff(a, b), -maxStep, maxStep); }

  function mulberry32(a) {
    a = a | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2i(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function noise2(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var u = smoothstep(x - xi), v = smoothstep(y - yi);
    var a = hash2i(xi, yi, seed), b = hash2i(xi + 1, yi, seed);
    var c = hash2i(xi, yi + 1, seed), d = hash2i(xi + 1, yi + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, seed, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2; gain = gain === undefined ? 0.5 : gain;
    var f = 1, amp = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) {
      sum += noise2(x * f, y * f, seed + i * 1013) * amp;
      norm += amp; f *= lac; amp *= gain;
    }
    return sum / norm;
  }

  function rand(rng, a, b) { return a + (b - a) * rng(); }
  function irand(rng, a, b) { return Math.floor(a + (b - a + 1) * rng()); }
  function pick(rng, arr) { return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]; }
  function chance(rng, p) { return rng() < p; }
  function pad2(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
  function clockText(tod) {
    var h = tod * 24;
    var m = (h - Math.floor(h)) * 60;
    return pad2(h) + ":" + pad2(Math.floor(m / 5) * 5);
  }
  function rgb(c) { return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }
  function mixc(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function shade(hex, amt) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  D.util = {
    TAU: TAU, clamp: clamp, lerp: lerp, smoothstep: smoothstep, len: len,
    dist: dist, dist2: dist2, angleDiff: angleDiff, turnToward: turnToward,
    mulberry32: mulberry32, hash2i: hash2i, noise2: noise2, fbm: fbm,
    rand: rand, irand: irand, pick: pick, chance: chance,
    pad2: pad2, clockText: clockText, rgb: rgb, rgba: rgba, mixc: mixc, shade: shade
  };
})(window.DINO);
