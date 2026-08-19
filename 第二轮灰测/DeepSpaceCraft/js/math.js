/* DEEP SPACE CRAFT · math.js —— 零依赖数学库（列主序 mat4，与 GLSL 一致） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  /* ---------------------------------------------------------------- V3 */
  var V3 = {
    create: function (x, y, z) { return new Float32Array([x || 0, y || 0, z || 0]); },
    clone: function (a) { return new Float32Array([a[0], a[1], a[2]]); },
    set: function (o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; },
    copy: function (o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
    zero: function (o) { o[0] = o[1] = o[2] = 0; return o; },
    add: function (a, b, o) { o = o || new Float32Array(3); o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
    sub: function (a, b, o) { o = o || new Float32Array(3); o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
    mul: function (a, b, o) { o = o || new Float32Array(3); o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; },
    scale: function (a, s, o) { o = o || new Float32Array(3); o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b, o) {
      o = o || new Float32Array(3);
      var x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
      o[0] = x; o[1] = y; o[2] = z; return o;
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    len2: function (a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; },
    dist: function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); },
    norm: function (a, o) {
      o = o || new Float32Array(3);
      var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
      if (l < 1e-12) { o[0] = o[1] = o[2] = 0; return o; }
      o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
    },
    lerp: function (a, b, t, o) {
      o = o || new Float32Array(3);
      o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o;
    }
  };

  /* ---------------------------------------------------------------- M4 */
  var M4 = {
    identity: function (o) {
      o = o || new Float32Array(16);
      o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
      o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
      return o;
    },
    perspective: function (fovy, aspect, near, far, o) {
      o = o || new Float32Array(16);
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
      o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
      return o;
    },
    ortho: function (l, r, b, t, n, f, o) {
      o = o || new Float32Array(16);
      var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
      o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
      o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1;
      return o;
    },
    lookAt: function (eye, center, up, o) {
      o = o || new Float32Array(16);
      var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      var l = Math.sqrt(zx * zx + zy * zy + zz * zz);
      if (l < 1e-9) return M4.identity(o);
      zx /= l; zy /= l; zz /= l;
      var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.sqrt(xx * xx + xy * xy + xz * xz);
      if (l < 1e-9) { xx = 1; xy = 0; xz = 0; } else { xx /= l; xy /= l; xz /= l; }
      var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      o[15] = 1;
      return o;
    },
    mul: function (a, b, o) {
      o = o || new Float32Array(16);
      var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (var i = 0; i < 4; i++) {
        var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        o[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
        o[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
        o[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
        o[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
      }
      return o;
    },
    mulVec: function (m, v, o) {
      o = o || new Float32Array(4);
      var x = v[0], y = v[1], z = v[2], w = v.length > 3 ? v[3] : 1;
      o[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
      o[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
      o[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
      o[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
      return o;
    },
    translation: function (v, o) { o = M4.identity(o); o[12] = v[0]; o[13] = v[1]; o[14] = v[2]; return o; },
    scaling: function (v, o) {
      o = M4.identity(o);
      o[0] = v[0]; o[5] = v[1]; o[10] = v[2]; return o;
    },
    translate: function (m, v, o) {
      o = o || new Float32Array(16);
      if (o !== m) for (var i = 0; i < 16; i++) o[i] = m[i];
      o[12] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
      o[13] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
      o[14] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
      o[15] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
      return o;
    },
    scale: function (m, v, o) {
      o = o || new Float32Array(16);
      for (var i = 0; i < 4; i++) { o[i] = m[i] * v[0]; o[4 + i] = m[4 + i] * v[1]; o[8 + i] = m[8 + i] * v[2]; o[12 + i] = m[12 + i]; }
      return o;
    },
    rotateX: function (m, r, o) {
      var s = Math.sin(r), c = Math.cos(r), t = new Float32Array(16);
      M4.identity(t); t[5] = c; t[6] = s; t[9] = -s; t[10] = c;
      return M4.mul(m, t, o);
    },
    rotateY: function (m, r, o) {
      var s = Math.sin(r), c = Math.cos(r), t = new Float32Array(16);
      M4.identity(t); t[0] = c; t[2] = -s; t[8] = s; t[10] = c;
      return M4.mul(m, t, o);
    },
    rotateZ: function (m, r, o) {
      var s = Math.sin(r), c = Math.cos(r), t = new Float32Array(16);
      M4.identity(t); t[0] = c; t[1] = s; t[4] = -s; t[5] = c;
      return M4.mul(m, t, o);
    },
    transpose: function (m, o) {
      o = o || new Float32Array(16);
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) o[i * 4 + j] = m[j * 4 + i];
      return o;
    },
    invert: function (m, o) {
      o = o || new Float32Array(16);
      var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return M4.identity(o);
      det = 1 / det;
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
    },
    normalFromMat4: function (m, o) {
      o = o || new Float32Array(9);
      var inv = M4.invert(m);
      o[0] = inv[0]; o[1] = inv[4]; o[2] = inv[8];
      o[3] = inv[1]; o[4] = inv[5]; o[5] = inv[9];
      o[6] = inv[2]; o[7] = inv[6]; o[8] = inv[10];
      return o;
    },
    /* 由朝向（yaw/pitch/roll，弧度）与位置构建模型矩阵 */
    fromEulerPos: function (yaw, pitch, roll, pos, o) {
      o = M4.identity(o);
      M4.translate(o, pos, o);
      M4.rotateY(o, yaw, o);
      M4.rotateX(o, pitch, o);
      M4.rotateZ(o, roll, o);
      return o;
    },
    fromQuatPos: function (q, p, o) {
      o = o || new Float32Array(16);
      var x = q[0], y = q[1], z = q[2], w = q[3];
      var x2 = x + x, y2 = y + y, z2 = z + z;
      var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
      var wx = w * x2, wy = w * y2, wz = w * z2;
      o[0] = 1 - (yy + zz); o[1] = xy + wz; o[2] = xz - wy; o[3] = 0;
      o[4] = xy - wz; o[5] = 1 - (xx + zz); o[6] = yz + wx; o[7] = 0;
      o[8] = xz + wy; o[9] = yz - wx; o[10] = 1 - (xx + yy); o[11] = 0;
      o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
      return o;
    }
  };

  /* ------------------------------------------------------------ Quat */
  var Q = {
    create: function () { return new Float32Array([0, 0, 0, 1]); },
    identity: function (o) { o = o || new Float32Array(4); o[0] = o[1] = o[2] = 0; o[3] = 1; return o; },
    fromAxisAngle: function (axis, rad, o) {
      o = o || new Float32Array(4);
      var h = rad * 0.5, s = Math.sin(h);
      var l = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]) || 1;
      o[0] = axis[0] / l * s; o[1] = axis[1] / l * s; o[2] = axis[2] / l * s; o[3] = Math.cos(h);
      return o;
    },
    mul: function (a, b, o) {
      o = o || new Float32Array(4);
      var ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
      o[0] = ax * bw + aw * bx + ay * bz - az * by;
      o[1] = ay * bw + aw * by + az * bx - ax * bz;
      o[2] = az * bw + aw * bz + ax * by - ay * bx;
      o[3] = aw * bw - ax * bx - ay * by - az * bz;
      return o;
    },
    normalize: function (q, o) {
      o = o || q;
      var l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) || 1;
      o[0] = q[0] / l; o[1] = q[1] / l; o[2] = q[2] / l; o[3] = q[3] / l; return o;
    },
    rotateVec: function (q, v, o) {
      o = o || new Float32Array(3);
      var x = v[0], y = v[1], z = v[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      var ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
      o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return o;
    },
    slerp: function (a, b, t, o) {
      o = o || new Float32Array(4);
      var ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
      var cos = ax * bx + ay * by + az * bz + aw * bw;
      if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
      var s0, s1;
      if (1 - cos > 1e-6) {
        var om = Math.acos(cos), sin = Math.sin(om);
        s0 = Math.sin((1 - t) * om) / sin; s1 = Math.sin(t * om) / sin;
      } else { s0 = 1 - t; s1 = t; }
      o[0] = s0 * ax + s1 * bx; o[1] = s0 * ay + s1 * by; o[2] = s0 * az + s1 * bz; o[3] = s0 * aw + s1 * bw;
      return o;
    }
  };

  /* ------------------------------------------------------------ Util */
  var Util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    /* 帧率无关的指数趋近 */
    approach: function (cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); },
    smoothstep: function (a, b, x) { var t = Util.clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); },
    smootherstep: function (a, b, x) { var t = Util.clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); },
    mod: function (a, n) { return ((a % n) + n) % n; },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    /* mulberry32：确定性 rng，返回 0..1 */
    makeRng: function (seed) {
      var a = (seed >>> 0) || 1;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hashStr: function (s) {
      var h = 2166136261 >>> 0;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    randRange: function (rng, a, b) { return a + (b - a) * rng(); },
    randInt: function (rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); },
    pick: function (rng, arr) { return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]; },
    shuffle: function (rng, arr) {
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    },
    fmtNum: function (n) {
      n = Math.floor(n);
      var s = String(Math.abs(n)), out = '';
      while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
      return (n < 0 ? '-' : '') + s + out;
    },
    fmtDist: function (m) {
      if (m < 1000) return Math.round(m) + ' m';
      if (m < 1e6) return (m / 1000).toFixed(m < 1e4 ? 2 : 1) + ' km';
      if (m < 1e9) return (m / 1e6).toFixed(2) + ' Mm';
      return (m / 1e9).toFixed(2) + ' Gm';
    },
    fmtTime: function (sec) {
      var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    },
    /* 十六进制 -> [r,g,b] 0..1 */
    hex: function (h) {
      h = h.replace('#', '');
      return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    },
    rgbCss: function (c, a) {
      return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a === undefined ? 1 : a) + ')';
    }
  };

  DSC.V3 = V3; DSC.M4 = M4; DSC.Q = Q; DSC.Util = Util;
})();
