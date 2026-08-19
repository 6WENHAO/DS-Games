/* =====================================================================
 * MathUtils — 基础数学工具
 * ===================================================================== */

export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const EPS = 1e-6;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const mix = lerp;

/** 真正的数学取模（结果符号跟随除数） */
export const mod = (n, m) => ((n % m) + m) % m;

/** 向下取整除法，负数也正确 */
export const floorDiv = (n, m) => Math.floor(n / m);

export const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };

export const step = (edge, v) => (v < edge ? 0 : 1);
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** 把 v 从 [a,b] 映射到 [c,d] */
export const remap = (v, a, b, c, d) => c + (d - c) * clamp01(invLerp(a, b, v));

/** 角度差值（处理 -PI..PI 环绕） */
export function angleDelta(a, b) {
  let d = mod(b - a + PI, TAU) - PI;
  return d;
}
export function lerpAngle(a, b, t) { return a + angleDelta(a, b) * t; }

/** 指数平滑，与帧率无关 */
export function damp(cur, target, rate, dt) {
  return lerp(cur, target, 1 - Math.exp(-rate * dt));
}

export const nextPow2 = (v) => { let p = 1; while (p < v) p <<= 1; return p; };

/** 三线性插值 */
export function trilerp(c000, c100, c010, c110, c001, c101, c011, c111, x, y, z) {
  const c00 = lerp(c000, c100, x), c10 = lerp(c010, c110, x);
  const c01 = lerp(c001, c101, x), c11 = lerp(c011, c111, x);
  return lerp(lerp(c00, c10, y), lerp(c01, c11, y), z);
}

/** 数组洗牌（需外部随机源） */
export function shuffle(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** 颜色工具 */
export function hsvToRgb(h, s, v) {
  h = mod(h, 1) * 6;
  const i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
export function rgbToHex(r, g, b) {
  const c = (x) => clamp(Math.round(x * 255), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function mixColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
