/* =========================================================================
 * util.js  —  数学 / 矩阵 / 噪声场 / 颜色
 * 纯 ES5-ish 经典脚本，浏览器 (file://) 与 node (vm) 双用，无任何依赖。
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE = root.NUKE || {};
  var U = NK.util = {};

  /* ---------------------------- 标量工具 ---------------------------- */
  U.clamp = function (x, a, b) { return x < a ? a : (x > b ? b : x); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smoothstep = function (e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  };
  U.smootherstep = function (t) {
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  U.mix = U.lerp;
  /** 对数插值：在 (x0,y0)-(x1,y1) 之间按 log-log 直线插值 */
  U.logLerp = function (x, x0, x1, y0, y1) {
    var t = (Math.log(x) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
    t = U.clamp(t, 0, 1);
    return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
  };
  U.finite = function (x) { return (typeof x === 'number') && isFinite(x); };

  /* ---------------------------- 随机数 ---------------------------- */
  /** 确定性 LCG（可复现，便于自检对比） */
  U.rng = function (seed) {
    var s = (seed | 0) || 1;
    return function () {
      // 32-bit xorshift
      s ^= s << 13; s |= 0;
      s ^= s >>> 17;
      s ^= s << 5; s |= 0;
      return ((s >>> 0) / 4294967296);
    };
  };
  /** 单位球内均匀采样（Marsaglia 拒绝法） */
  U.sampleBall = function (rand, out) {
    var x, y, z, d2;
    do {
      x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1;
      d2 = x * x + y * y + z * z;
    } while (d2 > 1 || d2 < 1e-9);
    out[0] = x; out[1] = y; out[2] = z;
    return Math.sqrt(d2);
  };

  /* ---------------------------- vec3 ---------------------------- */
  var V3 = U.vec3 = {};
  V3.create = function (x, y, z) { return new Float32Array([x || 0, y || 0, z || 0]); };
  V3.set = function (o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; };
  V3.copy = function (o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
  V3.add = function (o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
  V3.sub = function (o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
  V3.scale = function (o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
  V3.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  V3.len = function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); };
  V3.cross = function (o, a, b) {
    var x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  };
  V3.norm = function (o, a) {
    var l = V3.len(a); if (l < 1e-12) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
    return V3.scale(o, a, 1 / l);
  };

  /* ---------------------------- mat4 (列主序，同 WebGL) ---------------------------- */
  var M4 = U.mat4 = {};
  M4.create = function () {
    var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m;
  };
  M4.identity = function (m) {
    m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
    m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1; return m;
  };
  M4.mul = function (o, a, b) { // o = a * b
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
      a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
      a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      o[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      o[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      o[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return o;
  };
  M4.perspective = function (o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  };
  M4.lookAt = function (o, eye, center, up) {
    var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    var l = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2); if (l < 1e-9) { return M4.identity(o); }
    z0 /= l; z1 /= l; z2 /= l;
    var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
    l = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (l < 1e-9) { x0 = 1; x1 = 0; x2 = 0; } else { x0 /= l; x1 /= l; x2 /= l; }
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0;
    o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
    o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
    o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    o[15] = 1;
    return o;
  };
  M4.invert = function (o, m) {
    var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
      a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
      a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) { return M4.identity(o); }
    det = 1.0 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };

  /* ---------------------------- 3D 噪声场 ---------------------------- */
  /**
   * 预计算格点噪声场（3 通道），三线性 + smootherstep 插值。
   * 比逐点 hash 快得多，用于每帧对数万粒子做湍流采样。
   * 单元格边长由采样时的 scale 控制（米/格）。
   */
  U.NoiseField = function (size, seed) {
    this.n = size || 48;
    var n = this.n, total = n * n * n * 3;
    this.data = new Float32Array(total);
    var rand = U.rng(seed || 12345);
    for (var i = 0; i < total; i++) { this.data[i] = rand() * 2 - 1; }
  };
  /** 采样：p 为已缩放到格点坐标的位置；结果写入 out[0..2] */
  U.NoiseField.prototype.sample = function (out, x, y, z) {
    var n = this.n, d = this.data;
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var fx = x - xi, fy = y - yi, fz = z - zi;
    // smootherstep 权重 → C1 连续
    var u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    var v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    var w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    var x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, z0 = ((zi % n) + n) % n;
    var x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, z1 = (z0 + 1) % n;
    var nn = n * n;
    var i000 = (x0 + y0 * n + z0 * nn) * 3, i100 = (x1 + y0 * n + z0 * nn) * 3;
    var i010 = (x0 + y1 * n + z0 * nn) * 3, i110 = (x1 + y1 * n + z0 * nn) * 3;
    var i001 = (x0 + y0 * n + z1 * nn) * 3, i101 = (x1 + y0 * n + z1 * nn) * 3;
    var i011 = (x0 + y1 * n + z1 * nn) * 3, i111 = (x1 + y1 * n + z1 * nn) * 3;
    for (var c = 0; c < 3; c++) {
      var c00 = d[i000 + c] + (d[i100 + c] - d[i000 + c]) * u;
      var c10 = d[i010 + c] + (d[i110 + c] - d[i010 + c]) * u;
      var c01 = d[i001 + c] + (d[i101 + c] - d[i001 + c]) * u;
      var c11 = d[i011 + c] + (d[i111 + c] - d[i011 + c]) * u;
      var c0 = c00 + (c10 - c00) * v;
      var c1 = c01 + (c11 - c01) * v;
      out[c] = c0 + (c1 - c0) * w;
    }
    return out;
  };

  /* ---------------------------- 黑体色（CPU 侧，与 GLSL 保持一致） ---------------------------- */
  U.blackbodyRGB = function (out, T) {
    var k = U.clamp(T, 1000, 40000) / 100, r, g, b;
    if (k <= 66) { r = 255; } else { r = 329.698727446 * Math.pow(k - 60, -0.1332047592); }
    if (k <= 66) { g = 99.4708025861 * Math.log(Math.max(k, 1)) - 161.1195681661; }
    else { g = 288.1221695283 * Math.pow(k - 60, -0.0755148492); }
    if (k >= 66) { b = 255; }
    else if (k <= 19) { b = 0; }
    else { b = 138.5177312231 * Math.log(k - 10) - 305.0447927307; }
    out[0] = U.clamp(r / 255, 0, 1);
    out[1] = U.clamp(g / 255, 0, 1);
    out[2] = U.clamp(b / 255, 0, 1);
    return out;
  };

  U.fmtLen = function (m) {
    if (!U.finite(m)) { return '—'; }
    if (Math.abs(m) < 1000) { return m.toFixed(0) + ' m'; }
    return (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km';
  };
  U.fmtTime = function (s) {
    if (!U.finite(s)) { return '—'; }
    if (s < 1e-3) { return (s * 1e6).toFixed(0) + ' µs'; }
    if (s < 1) { return (s * 1e3).toFixed(s < 0.01 ? 2 : 1) + ' ms'; }
    if (s < 60) { return s.toFixed(s < 10 ? 3 : 2) + ' s'; }
    var m = Math.floor(s / 60);
    return m + ' min ' + (s - m * 60).toFixed(1) + ' s';
  };
  U.fmtYield = function (kt) {
    if (kt < 1000) { return kt < 10 ? kt.toFixed(1) + ' kt' : kt.toFixed(0) + ' kt'; }
    return (kt / 1000).toFixed(kt < 10000 ? 2 : 1) + ' Mt';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
