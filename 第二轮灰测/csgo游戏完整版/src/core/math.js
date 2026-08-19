// ---------------------------------------------------------------------------
// 基础数学库：vec3 / mat4 / 四元数 / AABB / 随机数
// 约定：右手坐标系，Y 轴向上，长度单位为米。
// mat4 使用列主序 Float32Array(16)，与 WebGL 直接兼容。
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
/** CS 引擎单位 -> 米 */
export const UNIT = 0.01905;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const mod = (a, n) => ((a % n) + n) % n;

/** 角度差归一化到 [-PI, PI] */
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/** 指数平滑（与帧率无关） */
export function damp(cur, target, rate, dt) {
  return target + (cur - target) * Math.exp(-rate * dt);
}

// --------------------------- 随机数 ----------------------------------------

let _seed = 0x2f6e2b1 >>> 0;
export function srand(seed) { _seed = (seed >>> 0) || 1; }
/** 确定性 PRNG（xorshift32），返回 [0,1) */
export function rnd() {
  _seed ^= _seed << 13; _seed >>>= 0;
  _seed ^= _seed >>> 17;
  _seed ^= _seed << 5; _seed >>>= 0;
  return _seed / 4294967296;
}
export const rndRange = (a, b) => a + (b - a) * rnd();
export const rndInt = (a, b) => Math.floor(a + (b - a + 1) * rnd());
export const rndSign = () => (rnd() < 0.5 ? -1 : 1);
export function rndPick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
/** 近似高斯分布（Irwin–Hall） */
export function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) * 0.5; }

// --------------------------- vec3 ------------------------------------------

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const vclone = (a) => [a[0], a[1], a[2]];
export function vset(o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; }
export function vcopy(o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; }
export function vadd(o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; }
export function vsub(o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; }
export function vmul(o, a, b) { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; }
export function vscale(o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; }
/** o = a + b*s */
export function vaddScaled(o, a, b, s) { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; }
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function vcross(o, a, b) {
  const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
  o[0] = ay * bz - az * by; o[1] = az * bx - ax * bz; o[2] = ax * by - ay * bx; return o;
}
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vlen2 = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
export const vlenXZ = (a) => Math.hypot(a[0], a[2]);
export function vdist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
export function vdist2(a, b) { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
export function vdistXZ(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }
export function vnorm(o, a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  if (l < 1e-9) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
  const s = 1 / l; o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o;
}
export function vlerp(o, a, b, t) {
  o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o;
}
export function vneg(o, a) { o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; return o; }
/** 反射：o = a - 2*(a·n)*n */
export function vreflect(o, a, n) {
  const d = vdot(a, n) * 2;
  o[0] = a[0] - n[0] * d; o[1] = a[1] - n[1] * d; o[2] = a[2] - n[2] * d; return o;
}
/** 由 yaw/pitch（弧度）生成朝向向量。yaw 绕 Y 轴，0 指向 +X；pitch 抬头为正 */
export function anglesToDir(o, yaw, pitch) {
  const cp = Math.cos(pitch);
  o[0] = Math.cos(yaw) * cp;
  o[1] = Math.sin(pitch);
  o[2] = Math.sin(yaw) * cp;
  return o;
}
export function dirToAngles(d) {
  return { yaw: Math.atan2(d[2], d[0]), pitch: Math.asin(clamp(d[1], -1, 1)) };
}
/** 生成与 dir 垂直的右向量（world up = +Y） */
export function rightFromYaw(o, yaw) { o[0] = -Math.sin(yaw); o[1] = 0; o[2] = Math.cos(yaw); return o; }

// --------------------------- mat4 ------------------------------------------

export function m4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
export function m4identity(o) {
  o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
}
export function m4copy(o, a) { o.set(a); return o; }

export function m4mul(o, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return o;
}

export function m4perspective(o, fovyDeg, aspect, near, far) {
  const f = 1 / Math.tan(fovyDeg * DEG * 0.5);
  const nf = 1 / (near - far);
  o.fill(0);
  o[0] = f / aspect; o[5] = f;
  o[10] = (far + near) * nf; o[11] = -1;
  o[14] = 2 * far * near * nf;
  return o;
}

export function m4ortho(o, l, r, b, t, n, f) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}

const _lx = v3(), _ly = v3(), _lz = v3();
export function m4lookAt(o, eye, center, up) {
  vnorm(_lz, vsub(_lz, eye, center));           // z = 视线反方向
  if (vlen2(_lz) < 1e-12) { _lz[2] = 1; }
  vnorm(_lx, vcross(_lx, up, _lz));
  if (vlen2(_lx) < 1e-12) { _lx[0] = 1; _lx[1] = 0; _lx[2] = 0; }
  vcross(_ly, _lz, _lx);
  o[0] = _lx[0]; o[1] = _ly[0]; o[2] = _lz[0]; o[3] = 0;
  o[4] = _lx[1]; o[5] = _ly[1]; o[6] = _lz[1]; o[7] = 0;
  o[8] = _lx[2]; o[9] = _ly[2]; o[10] = _lz[2]; o[11] = 0;
  o[12] = -vdot(_lx, eye); o[13] = -vdot(_ly, eye); o[14] = -vdot(_lz, eye); o[15] = 1;
  return o;
}

export function m4translate(o, x, y, z) {
  m4identity(o); o[12] = x; o[13] = y; o[14] = z; return o;
}
export function m4scale(o, x, y, z) {
  m4identity(o); o[0] = x; o[5] = y; o[10] = z; return o;
}
export function m4rotX(o, a) {
  const c = Math.cos(a), s = Math.sin(a);
  m4identity(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
}
export function m4rotY(o, a) {
  const c = Math.cos(a), s = Math.sin(a);
  m4identity(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
}
export function m4rotZ(o, a) {
  const c = Math.cos(a), s = Math.sin(a);
  m4identity(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
}

/** 组合：平移 * RotY * RotX * RotZ * 缩放（欧拉序 YXZ，适合角色/道具） */
export function m4compose(o, pos, rot, scl) {
  const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
  const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
  const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
  const sx0 = scl ? scl[0] : 1, sy0 = scl ? scl[1] : 1, sz0 = scl ? scl[2] : 1;
  // R = Ry * Rx * Rz
  const m00 = cy * cz + sy * sx * sz;
  const m01 = cx * sz;
  const m02 = -sy * cz + cy * sx * sz;
  const m10 = -cy * sz + sy * sx * cz;
  const m11 = cx * cz;
  const m12 = sy * sz + cy * sx * cz;
  const m20 = sy * cx;
  const m21 = -sx;
  const m22 = cy * cx;
  o[0] = m00 * sx0; o[1] = m01 * sx0; o[2] = m02 * sx0; o[3] = 0;
  o[4] = m10 * sy0; o[5] = m11 * sy0; o[6] = m12 * sy0; o[7] = 0;
  o[8] = m20 * sz0; o[9] = m21 * sz0; o[10] = m22 * sz0; o[11] = 0;
  o[12] = pos[0]; o[13] = pos[1]; o[14] = pos[2]; o[15] = 1;
  return o;
}

export function m4invert(o, a) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return m4identity(o);
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
}

/** 3x3 部分的转置逆（法线矩阵），写入 Float32Array(9) */
export function m4normalMatrix(o9, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) { o9.fill(0); o9[0] = o9[4] = o9[8] = 1; return o9; }
  det = 1 / det;
  o9[0] = b01 * det;
  o9[1] = (-a22 * a01 + a02 * a21) * det;
  o9[2] = (a12 * a01 - a02 * a11) * det;
  o9[3] = b11 * det;
  o9[4] = (a22 * a00 - a02 * a20) * det;
  o9[5] = (-a12 * a00 + a02 * a10) * det;
  o9[6] = b21 * det;
  o9[7] = (-a21 * a00 + a01 * a20) * det;
  o9[8] = (a11 * a00 - a01 * a10) * det;
  return o9;
}

export function m4transformPoint(o, m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return o;
}
export function m4transformDir(o, m, p) {
  const x = p[0], y = p[1], z = p[2];
  o[0] = m[0] * x + m[4] * y + m[8] * z;
  o[1] = m[1] * x + m[5] * y + m[9] * z;
  o[2] = m[2] * x + m[6] * y + m[10] * z;
  return o;
}

// --------------------------- AABB / 射线 -----------------------------------

export function aabbOverlap(aMin, aMax, bMin, bMax) {
  return aMin[0] < bMax[0] && aMax[0] > bMin[0] &&
         aMin[1] < bMax[1] && aMax[1] > bMin[1] &&
         aMin[2] < bMax[2] && aMax[2] > bMin[2];
}
export function pointInAABB(p, min, max) {
  return p[0] >= min[0] && p[0] <= max[0] &&
         p[1] >= min[1] && p[1] <= max[1] &&
         p[2] >= min[2] && p[2] <= max[2];
}
export function pointInAABBxz(p, min, max) {
  return p[0] >= min[0] && p[0] <= max[0] && p[2] >= min[2] && p[2] <= max[2];
}

/**
 * 射线与 AABB 求交（slab 法）。
 * 返回 null 或 { t, normal:[x,y,z] }；t 为进入距离（可为 0，起点在盒内时返回 t=0）。
 */
export function rayAABB(ro, rd, min, max, maxT = Infinity) {
  let tmin = 0, tmax = maxT;
  let axis = -1, sgn = 1;
  for (let i = 0; i < 3; i++) {
    const o = ro[i], d = rd[i];
    if (Math.abs(d) < 1e-9) {
      if (o < min[i] || o > max[i]) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min[i] - o) * inv;
    let t2 = (max[i] - o) * inv;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sgn = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  const n = [0, 0, 0];
  if (axis >= 0) n[axis] = sgn;
  return { t: tmin, normal: n, axis };
}

/** 射线与球求交，返回最近正 t 或 null */
export function raySphere(ro, rd, center, radius, maxT = Infinity) {
  const ox = ro[0] - center[0], oy = ro[1] - center[1], oz = ro[2] - center[2];
  const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0 || t > maxT) return null;
  return t;
}

/** 点到线段的最近距离平方 */
export function pointSegDist2(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const d = abx * abx + aby * aby + abz * abz;
  let t = d > 1e-9 ? (apx * abx + apy * aby + apz * abz) / d : 0;
  t = clamp(t, 0, 1);
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
