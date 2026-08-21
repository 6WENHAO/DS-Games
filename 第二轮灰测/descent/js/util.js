/* ============================================================
   util.js — 数学 / 颜色 / 噪声 / DOM 小工具
   ============================================================ */
(function (glob) {
  'use strict';

  const u = {};

  u.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  u.lerp = (a, b, t) => a + (b - a) * t;
  u.inv = (a, b, v) => (b === a ? 0 : u.clamp((v - a) / (b - a), 0, 1));
  u.smoothstep = (a, b, v) => { const t = u.inv(a, b, v); return t * t * (3 - 2 * t); };
  u.mix3 = (A, B, t) => [u.lerp(A[0], B[0], t), u.lerp(A[1], B[1], t), u.lerp(A[2], B[2], t)];
  u.scale3 = (A, s) => [A[0] * s, A[1] * s, A[2] * s];
  u.add3 = (A, B) => [A[0] + B[0], A[1] + B[1], A[2] + B[2]];

  /* sRGB hex -> 线性 rgb（可带强度倍率） */
  u.hexLin = function (hex, mul) {
    mul = mul === undefined ? 1 : mul;
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const f = c => Math.pow(c / 255, 2.2);
    return [f((n >> 16) & 255) * mul, f((n >> 8) & 255) * mul, f(n & 255) * mul];
  };
  /* 线性 rgb -> css 字符串（给 2D overlay 用） */
  u.linCss = function (c, a) {
    const g = x => Math.round(u.clamp(Math.pow(u.clamp(x, 0, 1), 1 / 2.2), 0, 1) * 255);
    return 'rgba(' + g(c[0]) + ',' + g(c[1]) + ',' + g(c[2]) + ',' + (a === undefined ? 1 : a) + ')';
  };

  /* 确定性随机 */
  u.rng = function (seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  /* 简易 1D 值噪声（阵风 / 抖动用） */
  u.noise1 = function (x) {
    const i = Math.floor(x), f = x - i;
    const h = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    const t = f * f * (3 - 2 * f);
    return u.lerp(h(i), h(i + 1), t) * 2 - 1;
  };
  u.fbm1 = function (x) {
    return u.noise1(x) * 0.55 + u.noise1(x * 2.13 + 5.3) * 0.28 + u.noise1(x * 4.31 + 11.7) * 0.17;
  };

  u.dir = function (elevDeg, aziDeg) {
    const e = elevDeg * Math.PI / 180, a = aziDeg * Math.PI / 180;
    return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
  };

  u.fmt = function (v, d) { return v.toFixed(d === undefined ? 0 : d); };
  u.commas = function (v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  u.$ = s => document.querySelector(s);
  u.$$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

  /* 大气：指数密度模型 */
  u.density = function (altM, rho0, scaleHeightKm) {
    if (altM < 0) altM = 0;
    return rho0 * Math.exp(-altM / (scaleHeightKm * 1000));
  };

  glob.u = u;
})(window);
