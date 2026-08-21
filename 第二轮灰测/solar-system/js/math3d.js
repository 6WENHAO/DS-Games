/* =======================================================================
 *  math3d.js  —  轻量线性代数库（列主序 mat4，与 GLSL 一致）
 *  单位约定：整套引擎内部长度单位 1 unit = 1000 km
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});

  const M = {};

  M.DEG = Math.PI / 180;
  M.RAD = 180 / Math.PI;
  M.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smoothstep = function (e0, e1, x) {
    const t = M.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  M.mix = M.lerp;

  /* ---------------------------- vec3 ---------------------------------- */
  const V = (M.v3 = {});
  V.create = (x = 0, y = 0, z = 0) => [x, y, z];
  V.clone = (a) => [a[0], a[1], a[2]];
  V.set = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
  V.copy = (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
  V.add = (a, b, o = [0, 0, 0]) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
  V.sub = (a, b, o = [0, 0, 0]) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
  V.mul = (a, b, o = [0, 0, 0]) => { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; };
  V.scale = (a, s, o = [0, 0, 0]) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
  V.addScaled = (a, b, s, o = [0, 0, 0]) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; };
  V.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  V.len = (a) => Math.hypot(a[0], a[1], a[2]);
  V.len2 = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  V.dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  V.cross = (a, b, o = [0, 0, 0]) => {
    const x = a[1] * b[2] - a[2] * b[1];
    const y = a[2] * b[0] - a[0] * b[2];
    const z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  };
  V.norm = (a, o = [0, 0, 0]) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
  };
  V.negate = (a, o = [0, 0, 0]) => { o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; return o; };
  V.lerp = (a, b, t, o = [0, 0, 0]) => {
    o[0] = a[0] + (b[0] - a[0]) * t;
    o[1] = a[1] + (b[1] - a[1]) * t;
    o[2] = a[2] + (b[2] - a[2]) * t;
    return o;
  };
  /** 任取一条与 n 垂直的单位切向 */
  V.perp = (n, o = [0, 0, 0]) => {
    const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    V.cross(ref, n, o);
    return V.norm(o, o);
  };

  /* ---------------------------- mat3 ---------------------------------- */
  const M3 = (M.m3 = {});
  M3.identity = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
  /** 从 mat4 取左上 3x3 */
  M3.fromMat4 = (m, o = new Array(9)) => {
    o[0] = m[0]; o[1] = m[1]; o[2] = m[2];
    o[3] = m[4]; o[4] = m[5]; o[5] = m[6];
    o[6] = m[8]; o[7] = m[9]; o[8] = m[10];
    return o;
  };
  /** 以列向量 x,y,z 组装（列主序） */
  M3.fromBasis = (x, y, z, o = new Array(9)) => {
    o[0] = x[0]; o[1] = x[1]; o[2] = x[2];
    o[3] = y[0]; o[4] = y[1]; o[5] = y[2];
    o[6] = z[0]; o[7] = z[1]; o[8] = z[2];
    return o;
  };
  M3.mul = (a, b, o = new Array(9)) => {
    const r = new Array(9);
    for (let c = 0; c < 3; c++) {
      for (let ro = 0; ro < 3; ro++) {
        r[c * 3 + ro] = a[ro] * b[c * 3] + a[3 + ro] * b[c * 3 + 1] + a[6 + ro] * b[c * 3 + 2];
      }
    }
    for (let i = 0; i < 9; i++) o[i] = r[i];
    return o;
  };
  M3.transpose = (a, o = new Array(9)) => {
    const r = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
    for (let i = 0; i < 9; i++) o[i] = r[i];
    return o;
  };
  M3.xform = (m, v, o = [0, 0, 0]) => {
    const x = v[0], y = v[1], z = v[2];
    o[0] = m[0] * x + m[3] * y + m[6] * z;
    o[1] = m[1] * x + m[4] * y + m[7] * z;
    o[2] = m[2] * x + m[5] * y + m[8] * z;
    return o;
  };
  /** 绕任意轴旋转（右手系，弧度） */
  M3.axisAngle = (axis, ang, o = new Array(9)) => {
    const [x, y, z] = V.norm(axis);
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    o[0] = t * x * x + c;     o[1] = t * x * y + s * z; o[2] = t * x * z - s * y;
    o[3] = t * x * y - s * z; o[4] = t * y * y + c;     o[5] = t * y * z + s * x;
    o[6] = t * x * z + s * y; o[7] = t * y * z - s * x; o[8] = t * z * z + c;
    return o;
  };
  M3.rotY = (ang) => M3.axisAngle([0, 1, 0], ang);
  M3.rotX = (ang) => M3.axisAngle([1, 0, 0], ang);
  M3.rotZ = (ang) => M3.axisAngle([0, 0, 1], ang);

  /* ---------------------------- mat4 ---------------------------------- */
  const M4 = (M.m4 = {});
  M4.identity = (o = new Float32Array(16)) => {
    o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
  };
  M4.clone = (m) => Float32Array.from(m);
  M4.mul = (a, b, o = new Float32Array(16)) => {
    const r = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      for (let ro = 0; ro < 4; ro++) {
        r[c * 4 + ro] = a[ro] * b0 + a[4 + ro] * b1 + a[8 + ro] * b2 + a[12 + ro] * b3;
      }
    }
    o.set(r); return o;
  };
  M4.perspective = (fovy, aspect, near, far, o = new Float32Array(16)) => {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far);
    o[11] = -1;
    o[14] = (2 * far * near) / (near - far);
    return o;
  };
  /** 相机基（右、上、后）+ 位置 → 视图矩阵 */
  M4.viewFromBasis = (right, up, back, eye, o = new Float32Array(16)) => {
    o[0] = right[0]; o[1] = up[0]; o[2] = back[0]; o[3] = 0;
    o[4] = right[1]; o[5] = up[1]; o[6] = back[1]; o[7] = 0;
    o[8] = right[2]; o[9] = up[2]; o[10] = back[2]; o[11] = 0;
    o[12] = -V.dot(right, eye); o[13] = -V.dot(up, eye); o[14] = -V.dot(back, eye); o[15] = 1;
    return o;
  };
  M4.lookAt = (eye, center, upHint, o = new Float32Array(16)) => {
    const back = V.norm(V.sub(eye, center));
    let right = V.cross(upHint, back);
    if (V.len2(right) < 1e-12) right = V.perp(back);
    V.norm(right, right);
    const up = V.cross(back, right);
    return M4.viewFromBasis(right, up, back, eye, o);
  };
  M4.xformPoint = (m, v, o = [0, 0, 0]) => {
    const x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  };
  /** 只做投影，返回 [x,y,z,w] 便于裁剪判断 */
  M4.xform4 = (m, v, w0 = 1) => {
    const x = v[0], y = v[1], z = v[2];
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12] * w0,
      m[1] * x + m[5] * y + m[9] * z + m[13] * w0,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w0,
      m[3] * x + m[7] * y + m[11] * z + m[15] * w0,
    ];
  };
  M4.fromM3T = (r, t, o = new Float32Array(16)) => {
    o[0] = r[0]; o[1] = r[1]; o[2] = r[2]; o[3] = 0;
    o[4] = r[3]; o[5] = r[4]; o[6] = r[5]; o[7] = 0;
    o[8] = r[6]; o[9] = r[7]; o[10] = r[8]; o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
    return o;
  };

  /* --------------------- 射线 / 球体求交 -------------------------------- */
  /** 返回最近正交点距离，未命中返回 -1。ro 相对球心 */
  M.raySphere = function (ro, rd, radius) {
    const b = V.dot(ro, rd);
    const c = V.len2(ro) - radius * radius;
    const h = b * b - c;
    if (h < 0) return -1;
    const s = Math.sqrt(h);
    const t0 = -b - s, t1 = -b + s;
    if (t0 > 0) return t0;
    if (t1 > 0) return t1;
    return -1;
  };

  /* --------------------- 开普勒轨道求解 -------------------------------- */
  /** 由平近点角解偏近点角（牛顿迭代） */
  M.solveKepler = function (Mean, e) {
    let Ea = Mean + e * Math.sin(Mean) * (1 + e * Math.cos(Mean));
    for (let i = 0; i < 12; i++) {
      const f = Ea - e * Math.sin(Ea) - Mean;
      const fp = 1 - e * Math.cos(Ea);
      const d = f / fp;
      Ea -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return Ea;
  };

  SS.M = M;
})(typeof window !== 'undefined' ? window : globalThis);
