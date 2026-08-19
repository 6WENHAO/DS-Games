/* =====================================================================
 * Vec3 — 以普通数组 / Float32Array 为载体的三维向量运算（无 GC 压力风格）
 * 所有函数都接受 out 作为第一个参数（可与输入相同）
 * ===================================================================== */

export function create(x = 0, y = 0, z = 0) { return new Float32Array([x, y, z]); }
export function of(x = 0, y = 0, z = 0) { return [x, y, z]; }
export function clone(a) { return [a[0], a[1], a[2]]; }

export function set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; }
export function copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }

export function add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; }
export function sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; }
export function mul(out, a, b) { out[0] = a[0] * b[0]; out[1] = a[1] * b[1]; out[2] = a[2] * b[2]; return out; }
export function scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; }
export function addScaled(out, a, b, s) {
  out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s; return out;
}
export function negate(out, a) { out[0] = -a[0]; out[1] = -a[1]; out[2] = -a[2]; return out; }

export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(out, a, b) {
  const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export function lenSq(a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; }
export function len(a) { return Math.sqrt(lenSq(a)); }
export function distSq(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
export function dist(a, b) { return Math.sqrt(distSq(a, b)); }

export function normalize(out, a) {
  const l = len(a);
  if (l < 1e-8) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
  const inv = 1 / l;
  out[0] = a[0] * inv; out[1] = a[1] * inv; out[2] = a[2] * inv;
  return out;
}

export function lerp(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

export function floor(out, a) {
  out[0] = Math.floor(a[0]); out[1] = Math.floor(a[1]); out[2] = Math.floor(a[2]); return out;
}

/** 用 4x4 矩阵变换点（含平移，w 归一化） */
export function transformMat4(out, a, m) {
  const x = a[0], y = a[1], z = a[2];
  let w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}

/** 用 4x4 矩阵变换方向（忽略平移） */
export function transformDir(out, a, m) {
  const x = a[0], y = a[1], z = a[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z;
  out[1] = m[1] * x + m[5] * y + m[9] * z;
  out[2] = m[2] * x + m[6] * y + m[10] * z;
  return out;
}

/** 由偏航/俯仰（弧度）计算朝向向量：yaw 绕 Y，pitch 抬头为正 */
export function fromYawPitch(out, yaw, pitch) {
  const cp = Math.cos(pitch);
  out[0] = -Math.sin(yaw) * cp;
  out[1] = Math.sin(pitch);
  out[2] = -Math.cos(yaw) * cp;
  return out;
}

export function toString(a, digits = 2) {
  return `(${a[0].toFixed(digits)}, ${a[1].toFixed(digits)}, ${a[2].toFixed(digits)})`;
}

export const ZERO = Object.freeze([0, 0, 0]);
export const ONE = Object.freeze([1, 1, 1]);
export const UP = Object.freeze([0, 1, 0]);
export const DOWN = Object.freeze([0, -1, 0]);
