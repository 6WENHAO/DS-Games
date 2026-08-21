/* ==========================================================================
 * math3d.js — minimal 3D math for the tank simulator.
 *
 * Conventions (kept simple on purpose):
 *   world axes : +X right (east), +Y up, +Z forward (north)
 *   yaw        : rotation about +Y. yaw = 0 looks along +Z, +90deg looks +X
 *   pitch      : positive = nose/muzzle/eyes UP
 *   matrices   : plain Array(16), ROW major, column vectors: p' = M * p
 *                index = row * 4 + col
 * ==========================================================================*/
(function (global) {
  'use strict';

  const M = {};

  /* ---------- scalars ---------- */
  M.TAU = Math.PI * 2;
  M.rad = d => d * Math.PI / 180;
  M.deg = r => r * 180 / Math.PI;
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.mix = M.lerp;
  M.smooth = t => t * t * (3 - 2 * t);
  M.sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

  /** move `cur` toward `target` at `rate` units/sec, never overshooting. */
  M.approach = function (cur, target, rate, dt) {
    const d = target - cur, m = rate * dt;
    if (Math.abs(d) <= m) return target;
    return cur + Math.sign(d) * m;
  };
  /** exponential smoothing that is stable for any dt */
  M.damp = function (cur, target, halfLife, dt) {
    if (halfLife <= 0) return target;
    const k = Math.pow(0.5, dt / halfLife);
    return target + (cur - target) * k;
  };
  /** wrap angle into (-PI, PI] */
  M.wrapPi = function (a) {
    a = (a + Math.PI) % M.TAU;
    if (a < 0) a += M.TAU;
    return a - Math.PI;
  };
  M.angleDelta = (from, to) => M.wrapPi(to - from);

  /* ---------- vectors (plain [x,y,z] arrays) ---------- */
  M.v = (x = 0, y = 0, z = 0) => [x, y, z];
  M.copy = a => [a[0], a[1], a[2]];
  M.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  M.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  M.mulv = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  M.addScaled = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  M.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  M.cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  M.len = a => Math.hypot(a[0], a[1], a[2]);
  M.dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  M.dist2 = (a, b) => {
    const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
    return x * x + y * y + z * z;
  };
  M.norm = function (a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  M.lerpv = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
  /** unit forward vector for a yaw/pitch pair (pitch>0 = up) */
  M.dirYawPitch = function (yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  };

  /* ---------- matrices ---------- */
  M.ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  M.mul = function (a, b) {
    const o = new Array(16);
    for (let r = 0; r < 4; r++) {
      const r0 = a[r * 4], r1 = a[r * 4 + 1], r2 = a[r * 4 + 2], r3 = a[r * 4 + 3];
      for (let c = 0; c < 4; c++) {
        o[r * 4 + c] = r0 * b[c] + r1 * b[4 + c] + r2 * b[8 + c] + r3 * b[12 + c];
      }
    }
    return o;
  };
  M.mulAll = function () {
    let m = arguments[0];
    for (let i = 1; i < arguments.length; i++) m = M.mul(m, arguments[i]);
    return m;
  };
  M.translate = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
  M.translateV = p => M.translate(p[0], p[1], p[2]);
  M.scaleM = (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  M.rotX = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  };
  M.rotY = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  };
  M.rotZ = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  };
  /** pitch>0 = nose up (about X), so it is rotX(-pitch) */
  M.pitchM = a => M.rotX(-a);

  M.xformPoint = function (m, p) {
    const x = p[0], y = p[1], z = p[2];
    return [
      m[0] * x + m[1] * y + m[2] * z + m[3],
      m[4] * x + m[5] * y + m[6] * z + m[7],
      m[8] * x + m[9] * y + m[10] * z + m[11]
    ];
  };
  M.xformDir = function (m, p) {
    const x = p[0], y = p[1], z = p[2];
    return [
      m[0] * x + m[1] * y + m[2] * z,
      m[4] * x + m[5] * y + m[6] * z,
      m[8] * x + m[9] * y + m[10] * z
    ];
  };

  /**
   * Rigid body transform: translate(pos) * rotY(yaw) * rotX(-pitch) * rotZ(roll)
   * roll>0 rolls to the right (starboard down looks natural enough for tanks).
   */
  M.body = function (pos, yaw, pitch, roll) {
    let m = M.mul(M.translateV(pos), M.rotY(yaw || 0));
    if (pitch) m = M.mul(m, M.rotX(-pitch));
    if (roll) m = M.mul(m, M.rotZ(roll));
    return m;
  };

  /** view matrix for a camera at pos with yaw/pitch/roll (inverse of M.body) */
  M.view = function (pos, yaw, pitch, roll) {
    let m = roll ? M.rotZ(-roll) : M.ident();
    if (pitch) m = M.mul(m, M.rotX(pitch));
    m = M.mul(m, M.rotY(-yaw || 0));
    return M.mul(m, M.translate(-pos[0], -pos[1], -pos[2]));
  };

  /* ---------- deterministic noise (terrain, scatter) ---------- */
  M.hash2 = function (x, y, seed) {
    let h = x * 374761393 + y * 668265263 + (seed || 0) * 1442695040888963407 % 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return ((h >>> 0) % 100000) / 100000;
  };
  M.valueNoise2 = function (x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = M.smooth(xf), v = M.smooth(yf);
    const a = M.hash2(xi, yi, seed), b = M.hash2(xi + 1, yi, seed);
    const c = M.hash2(xi, yi + 1, seed), d = M.hash2(xi + 1, yi + 1, seed);
    return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
  };
  M.fbm2 = function (x, y, seed, octaves) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < (octaves || 4); i++) {
      sum += amp * M.valueNoise2(x * freq, y * freq, (seed || 0) + i * 17);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
  /** tiny seeded PRNG */
  M.rng = function (seed) {
    let s = (seed | 0) || 1;
    return function () {
      s ^= s << 13; s |= 0;
      s ^= s >>> 17;
      s ^= s << 5; s |= 0;
      return ((s >>> 0) % 1000000) / 1000000;
    };
  };

  /* ---------- colours ---------- */
  const C = {};
  C.hex = function (h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  /** f<1 darkens, f>1 brightens */
  C.tint = (c, f) => [
    M.clamp(c[0] * f, 0, 255),
    M.clamp(c[1] * f, 0, 255),
    M.clamp(c[2] * f, 0, 255)
  ];
  C.mixc = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
  C.lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  C.css = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  C.rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  /** slight per-face random variation so large flat plates do not look dead */
  C.jitter = function (c, seed, amount) {
    const j = 1 + (M.hash2(seed * 7 + 3, seed * 13 + 5, 91) - 0.5) * 2 * (amount || 0.05);
    return C.tint(c, j);
  };

  global.M = M;
  global.C = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = { M, C };
})(typeof window !== 'undefined' ? window : globalThis);
