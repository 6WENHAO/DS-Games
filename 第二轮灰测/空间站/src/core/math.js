/**
 * core/math.js —— 极简高性能线性代数库（列主序 mat4，与 GL 内存布局一致）
 * 所有函数遵循 `out` 优先约定，避免在渲染循环中分配对象。
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const EPS = 1e-6;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, x) => {
  const t = saturate((x - a) / (b - a || EPS));
  return t * t * (3 - 2 * t);
};
/** 帧率无关的指数阻尼插值：t 为「每秒收敛比例」 */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
/** 角度阻尼，自动走最短弧 */
export const dampAngle = (a, b, rate, dt) => a + shortAngle(a, b) * (1 - Math.exp(-rate * dt));
export const shortAngle = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t) => {
  const c = 1.70158, c3 = c + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/* ─────────────────────────── 伪随机 ─────────────────────────── */

/** mulberry32：确定性 PRNG，保证每次构建的空间站完全一致 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32 位整数散列（用于逐面/逐体素的稳定变化） */
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* ─────────────────────────── vec3 ─────────────────────────── */

export const vec3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  set: (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; },
  copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
  add: (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
  sub: (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
  scale: (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
  mul: (o, a, b) => { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; },
  addScaled: (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  cross: (o, a, b) => {
    const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
    o[0] = ay * bz - az * by; o[1] = az * bx - ax * bz; o[2] = ax * by - ay * bx; return o;
  },
  normalize: (o, a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
  },
  lerp: (o, a, b, t) => {
    o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o;
  },
  transformMat4: (o, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  },
  transformDir: (o, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z;
    o[1] = m[1] * x + m[5] * y + m[9] * z;
    o[2] = m[2] * x + m[6] * y + m[10] * z;
    return o;
  },
};

/* ─────────────────────────── mat4 ─────────────────────────── */

export const mat4 = {
  create: () => {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  identity: (o) => {
    o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
  },
  copy: (o, a) => { o.set(a); return o; },

  multiply: (o, a, b) => {
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
  },

  perspective: (o, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[11] = -1;
    const nf = 1 / (near - far);
    o[10] = (far + near) * nf;
    o[14] = 2 * far * near * nf;
    return o;
  },

  /** 无穷远反向深度投影不需要，这里给出标准正交 */
  ortho: (o, l, r, b, t, n, f) => {
    o.fill(0);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = 2 / (n - f);
    o[12] = (r + l) / (l - r); o[13] = (t + b) / (b - t); o[14] = (f + n) / (n - f);
    o[15] = 1;
    return o;
  },

  lookAt: (o, eye, center, up) => {
    let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    let l = Math.hypot(z0, z1, z2);
    if (l < EPS) { z0 = 0; z1 = 0; z2 = 1; l = 1; }
    z0 /= l; z1 /= l; z2 /= l;
    let x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
    l = Math.hypot(x0, x1, x2);
    if (l < EPS) { // up 与视线平行时换一个参考轴
      x0 = 1; x1 = 0; x2 = 0;
      const d = z0;
      x0 -= z0 * d; x1 -= z1 * d; x2 -= z2 * d;
      l = Math.hypot(x0, x1, x2) || 1;
    }
    x0 /= l; x1 /= l; x2 /= l;
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0;
    o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
    o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
    o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    o[15] = 1;
    return o;
  },

  fromTranslation: (o, x, y, z) => {
    mat4.identity(o); o[12] = x; o[13] = y; o[14] = z; return o;
  },
  fromScale: (o, x, y, z) => {
    o.fill(0); o[0] = x; o[5] = y; o[10] = z; o[15] = 1; return o;
  },
  fromRotationX: (o, r) => {
    const c = Math.cos(r), s = Math.sin(r);
    mat4.identity(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
  },
  fromRotationY: (o, r) => {
    const c = Math.cos(r), s = Math.sin(r);
    mat4.identity(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
  },
  fromRotationZ: (o, r) => {
    const c = Math.cos(r), s = Math.sin(r);
    mat4.identity(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
  },

  /** 绕任意轴（需已归一化）旋转 */
  fromAxisAngle: (o, ax, ay, az, r) => {
    const c = Math.cos(r), s = Math.sin(r), t = 1 - c;
    o[0] = t * ax * ax + c;      o[1] = t * ax * ay + s * az; o[2] = t * ax * az - s * ay; o[3] = 0;
    o[4] = t * ax * ay - s * az; o[5] = t * ay * ay + c;      o[6] = t * ay * az + s * ax; o[7] = 0;
    o[8] = t * ax * az + s * ay; o[9] = t * ay * az - s * ax; o[10] = t * az * az + c;     o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  },

  /** 平移 · 绕任意轴旋转 · 均匀缩放，并以 pivot 为旋转中心 */
  compose: (o, translate, axis, angle, scale, pivot) => {
    mat4.fromAxisAngle(o, axis[0], axis[1], axis[2], angle);
    if (scale !== 1) {
      for (let i = 0; i < 11; i++) if (i % 4 !== 3) o[i] *= scale;
    }
    // T = translate + pivot - R*S*pivot
    const px = pivot[0], py = pivot[1], pz = pivot[2];
    o[12] = translate[0] + px - (o[0] * px + o[4] * py + o[8] * pz);
    o[13] = translate[1] + py - (o[1] * px + o[5] * py + o[9] * pz);
    o[14] = translate[2] + pz - (o[2] * px + o[6] * py + o[10] * pz);
    return o;
  },

  invert: (o, m) => {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return mat4.identity(o);
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

  /** 法线矩阵（3x3 逆转置，写入 Float32Array(9)） */
  normalMatrix: (o3, m) => {
    const inv = mat4.invert(_tmpA, m);
    o3[0] = inv[0]; o3[1] = inv[4]; o3[2] = inv[8];
    o3[3] = inv[1]; o3[4] = inv[5]; o3[5] = inv[9];
    o3[6] = inv[2]; o3[7] = inv[6]; o3[8] = inv[10];
    return o3;
  },
};

const _tmpA = mat4.create();

/* ─────────────────────── 视锥体裁剪 ─────────────────────── */

/** 从 viewProj 提取 6 个裁剪平面（写入 Float32Array(24)：nx,ny,nz,d ×6） */
export function extractFrustum(out, m) {
  const rows = [
    [m[0], m[4], m[8], m[12]],
    [m[1], m[5], m[9], m[13]],
    [m[2], m[6], m[10], m[14]],
    [m[3], m[7], m[11], m[15]],
  ];
  const planes = [
    [3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1],
  ];
  for (let i = 0; i < 6; i++) {
    const [w, r, sign] = planes[i];
    for (let c = 0; c < 4; c++) out[i * 4 + c] = rows[w][c] + sign * rows[r][c];
    const l = Math.hypot(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]) || 1;
    for (let c = 0; c < 4; c++) out[i * 4 + c] /= l;
  }
  return out;
}

/** 球体 vs 视锥体（保守判定） */
export function sphereInFrustum(planes, cx, cy, cz, r) {
  for (let i = 0; i < 6; i++) {
    const d = planes[i * 4] * cx + planes[i * 4 + 1] * cy + planes[i * 4 + 2] * cz + planes[i * 4 + 3];
    if (d < -r) return false;
  }
  return true;
}

/* ─────────────────────── 颜色工具 ─────────────────────── */

/** sRGB(0..255) → 线性(0..1)，材质定义用直观的 sRGB，渲染前转线性 */
export function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** #rrggbb 或 [r,g,b] → [r,g,b] 0..255 */
export function parseColor(c) {
  if (Array.isArray(c)) return c;
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** HSL → RGB(0..255)，用于程序化配色 */
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
