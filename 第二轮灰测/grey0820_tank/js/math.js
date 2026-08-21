/* =============================================================================
   math.js - minimal linear algebra for the tank simulator.
   Column-major 4x4 matrices (OpenGL convention): element (row i, col j) = m[j*4+i].
   Points are column vectors:  p' = M * p.   MVP = P * V * M.
   No dependencies. Classic script, attaches to window.TS.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};

  /* ---------------------------------------------------------------- vec3 --- */
  var V3 = {
    create: function (x, y, z) { return [x || 0, y || 0, z || 0]; },
    set: function (o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; },
    copy: function (a) { return [a[0], a[1], a[2]]; },
    add: function (a, b, o) { o = o || []; o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
    sub: function (a, b, o) { o = o || []; o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
    mul: function (a, b, o) { o = o || []; o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; },
    scale: function (a, s, o) { o = o || []; o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
    addScaled: function (a, b, s, o) { o = o || []; o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b, o) {
      o = o || [];
      var x = a[1] * b[2] - a[2] * b[1];
      var y = a[2] * b[0] - a[0] * b[2];
      var z = a[0] * b[1] - a[1] * b[0];
      o[0] = x; o[1] = y; o[2] = z; return o;
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    len2: function (a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; },
    dist: function (a, b) {
      var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
      return Math.sqrt(x * x + y * y + z * z);
    },
    dist2: function (a, b) {
      var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
      return x * x + y * y + z * z;
    },
    normalize: function (a, o) {
      o = o || [];
      var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
      if (l < 1e-9) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
      o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
    },
    lerp: function (a, b, t, o) {
      o = o || [];
      o[0] = a[0] + (b[0] - a[0]) * t;
      o[1] = a[1] + (b[1] - a[1]) * t;
      o[2] = a[2] + (b[2] - a[2]) * t;
      return o;
    },
    negate: function (a, o) { o = o || []; o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; return o; }
  };

  /* ---------------------------------------------------------------- mat4 --- */
  var M4 = {
    create: function () {
      var m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    identity: function (m) {
      m = m || new Float32Array(16);
      m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
      m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
      m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
      m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
      return m;
    },
    copy: function (a, o) {
      o = o || new Float32Array(16);
      for (var i = 0; i < 16; i++) o[i] = a[i];
      return o;
    },
    /* out = a * b  (apply b first, then a) */
    multiply: function (a, b, o) {
      o = o || new Float32Array(16);
      var a00 = a[0], a01 = a[4], a02 = a[8], a03 = a[12];
      var a10 = a[1], a11 = a[5], a12 = a[9], a13 = a[13];
      var a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
      var a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];
      var b00 = b[0], b01 = b[4], b02 = b[8], b03 = b[12];
      var b10 = b[1], b11 = b[5], b12 = b[9], b13 = b[13];
      var b20 = b[2], b21 = b[6], b22 = b[10], b23 = b[14];
      var b30 = b[3], b31 = b[7], b32 = b[11], b33 = b[15];
      o[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
      o[1] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
      o[2] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
      o[3] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
      o[4] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
      o[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
      o[6] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
      o[7] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
      o[8] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
      o[9] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
      o[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
      o[11] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
      o[12] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
      o[13] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
      o[14] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
      o[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;
      return o;
    },
    /* chain: mulAll(a,b,c) = a*b*c */
    mulAll: function () {
      var o = M4.copy(arguments[0]);
      for (var i = 1; i < arguments.length; i++) o = M4.multiply(o, arguments[i]);
      return o;
    },
    translation: function (x, y, z, o) {
      o = M4.identity(o);
      o[12] = x; o[13] = y; o[14] = z;
      return o;
    },
    scaling: function (x, y, z, o) {
      o = M4.identity(o);
      o[0] = x; o[5] = (y === undefined ? x : y); o[10] = (z === undefined ? x : z);
      return o;
    },
    rotationX: function (a, o) {
      var c = Math.cos(a), s = Math.sin(a);
      o = M4.identity(o);
      o[5] = c; o[6] = s; o[9] = -s; o[10] = c;
      return o;
    },
    rotationY: function (a, o) {
      var c = Math.cos(a), s = Math.sin(a);
      o = M4.identity(o);
      o[0] = c; o[2] = -s; o[8] = s; o[10] = c;
      return o;
    },
    rotationZ: function (a, o) {
      var c = Math.cos(a), s = Math.sin(a);
      o = M4.identity(o);
      o[0] = c; o[1] = s; o[4] = -s; o[5] = c;
      return o;
    },
    /* rotation about an arbitrary unit axis */
    rotationAxis: function (axis, a, o) {
      var x = axis[0], y = axis[1], z = axis[2];
      var l = Math.sqrt(x * x + y * y + z * z) || 1;
      x /= l; y /= l; z /= l;
      var c = Math.cos(a), s = Math.sin(a), t = 1 - c;
      o = M4.identity(o);
      o[0] = t * x * x + c; o[1] = t * x * y + s * z; o[2] = t * x * z - s * y;
      o[4] = t * x * y - s * z; o[5] = t * y * y + c; o[6] = t * y * z + s * x;
      o[8] = t * x * z + s * y; o[9] = t * y * z - s * x; o[10] = t * z * z + c;
      return o;
    },
    /* Euler order: Y (yaw) then X (pitch) then Z (roll)  =>  Ry*Rx*Rz */
    fromEuler: function (yaw, pitch, roll, o) {
      var m = M4.multiply(M4.rotationY(yaw || 0), M4.rotationX(pitch || 0));
      if (roll) m = M4.multiply(m, M4.rotationZ(roll));
      return M4.copy(m, o);
    },
    compose: function (pos, yaw, pitch, roll, scale) {
      var m = M4.fromEuler(yaw, pitch, roll);
      if (scale !== undefined && scale !== 1) {
        var s = (typeof scale === 'number') ? [scale, scale, scale] : scale;
        m = M4.multiply(m, M4.scaling(s[0], s[1], s[2]));
      }
      m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2];
      return m;
    },
    /* build from orthonormal basis columns + translation */
    fromBasis: function (right, up, fwd, pos, o) {
      o = o || new Float32Array(16);
      o[0] = right[0]; o[1] = right[1]; o[2] = right[2]; o[3] = 0;
      o[4] = up[0]; o[5] = up[1]; o[6] = up[2]; o[7] = 0;
      o[8] = fwd[0]; o[9] = fwd[1]; o[10] = fwd[2]; o[11] = 0;
      o[12] = pos ? pos[0] : 0; o[13] = pos ? pos[1] : 0; o[14] = pos ? pos[2] : 0; o[15] = 1;
      return o;
    },
    perspective: function (fovy, aspect, near, far, o) {
      o = o || new Float32Array(16);
      var f = 1.0 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
      o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
      return o;
    },
    ortho: function (l, r, b, t, n, f, o) {
      o = M4.identity(o);
      o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
      return o;
    },
    /* camera looks down its own -Z axis */
    lookAt: function (eye, target, up, o) {
      var z = V3.normalize(V3.sub(eye, target));
      if (V3.len2(z) < 1e-12) z = [0, 0, 1];
      var x = V3.cross(up || [0, 1, 0], z);
      if (V3.len2(x) < 1e-12) x = V3.cross([1, 0, 0], z);
      V3.normalize(x, x);
      var y = V3.cross(z, x);
      o = o || new Float32Array(16);
      o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
      o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
      o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
      o[12] = -V3.dot(x, eye); o[13] = -V3.dot(y, eye); o[14] = -V3.dot(z, eye); o[15] = 1;
      return o;
    },
    inverse: function (m, o) {
      o = o || new Float32Array(16);
      var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      var a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      var a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      var a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
      var b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      var b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      var b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      var b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
      var b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return M4.identity(o);
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
    },
    transpose: function (m, o) {
      o = o || new Float32Array(16);
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) o[j * 4 + i] = m[i * 4 + j];
      return o;
    },
    /* upper-left 3x3 of inverse-transpose, for normals */
    normalMatrix: function (m, o) {
      var inv = M4.inverse(m);
      o = o || new Float32Array(9);
      o[0] = inv[0]; o[1] = inv[4]; o[2] = inv[8];
      o[3] = inv[1]; o[4] = inv[5]; o[5] = inv[9];
      o[6] = inv[2]; o[7] = inv[6]; o[8] = inv[10];
      return o;
    },
    transformPoint: function (m, v, o) {
      o = o || [];
      var x = v[0], y = v[1], z = v[2];
      var w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (!w) w = 1;
      var rx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      var ry = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      var rz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      o[0] = rx; o[1] = ry; o[2] = rz;
      return o;
    },
    transformDir: function (m, v, o) {
      o = o || [];
      var x = v[0], y = v[1], z = v[2];
      var rx = m[0] * x + m[4] * y + m[8] * z;
      var ry = m[1] * x + m[5] * y + m[9] * z;
      var rz = m[2] * x + m[6] * y + m[10] * z;
      o[0] = rx; o[1] = ry; o[2] = rz;
      return o;
    },
    getTranslation: function (m, o) {
      o = o || [];
      o[0] = m[12]; o[1] = m[13]; o[2] = m[14];
      return o;
    },
    /* column i as a vec3 (0=right, 1=up, 2=forward) */
    axis: function (m, i, o) {
      o = o || [];
      o[0] = m[i * 4]; o[1] = m[i * 4 + 1]; o[2] = m[i * 4 + 2];
      return o;
    }
  };

  /* ------------------------------------------------------------- helpers --- */
  var MU = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    /* frame-rate independent exponential approach */
    damp: function (cur, target, rate, dt) {
      var t = 1 - Math.exp(-rate * dt);
      return cur + (target - cur) * t;
    },
    moveTowards: function (cur, target, maxDelta) {
      var d = target - cur;
      if (Math.abs(d) <= maxDelta) return target;
      return cur + Math.sign(d) * maxDelta;
    },
    smoothstep: function (a, b, x) {
      var t = MU.clamp((x - a) / (b - a || 1e-9), 0, 1);
      return t * t * (3 - 2 * t);
    },
    deg: function (r) { return r * 180 / Math.PI; },
    rad: function (d) { return d * Math.PI / 180; },
    /* wrap an angle to (-PI, PI] */
    wrapAngle: function (a) {
      a = (a + Math.PI) % (2 * Math.PI);
      if (a < 0) a += 2 * Math.PI;
      return a - Math.PI;
    },
    /* deterministic PRNG (mulberry32) */
    rng: function (seed) {
      var s = (seed || 1) >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    /* ray vs axis-aligned box, ray in box-local space. returns t or -1 */
    rayAABB: function (ro, rd, min, max) {
      var tmin = -Infinity, tmax = Infinity;
      for (var i = 0; i < 3; i++) {
        var d = rd[i];
        if (Math.abs(d) < 1e-9) {
          if (ro[i] < min[i] || ro[i] > max[i]) return -1;
        } else {
          var t1 = (min[i] - ro[i]) / d;
          var t2 = (max[i] - ro[i]) / d;
          if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
          if (t1 > tmin) tmin = t1;
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) return -1;
        }
      }
      if (tmax < 0) return -1;
      return tmin >= 0 ? tmin : tmax;
    },
    /* ray vs sphere, world space. returns t or -1 */
    raySphere: function (ro, rd, c, r) {
      var ox = ro[0] - c[0], oy = ro[1] - c[1], oz = ro[2] - c[2];
      var b = ox * rd[0] + oy * rd[1] + oz * rd[2];
      var cc = ox * ox + oy * oy + oz * oz - r * r;
      var disc = b * b - cc;
      if (disc < 0) return -1;
      var sq = Math.sqrt(disc);
      var t = -b - sq;
      if (t < 0) t = -b + sq;
      return t < 0 ? -1 : t;
    }
  };

  TS.V3 = V3;
  TS.M4 = M4;
  TS.MU = MU;
})(typeof window !== 'undefined' ? window : this);
