/**
 * 数学与随机工具 —— 无 DOM 依赖，可在 Node 中直接测试。
 * Math / RNG / noise helpers. Pure JS, no DOM.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp01(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};
export const mix = lerp;

/** 与帧率无关的指数阻尼插值 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** 把角度收敛到 [-PI, PI] */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** mulberry32：小巧、确定性强的伪随机数发生器 */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b + 1 - a) * rng() * (1 - 1e-9));
  rng.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.gauss = (mean = 0, dev = 1) => {
    const u = Math.max(1e-9, rng());
    return mean + dev * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng());
  };
  return rng;
}

/* ------------------------------------------------------------------ *
 * 值噪声 —— 程序化贴图（行星、船体、星云）
 * ------------------------------------------------------------------ */

function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** 3D value noise，返回 [0,1] */
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

/** 分形叠加噪声 */
export function fbm3(x, y, z, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** 山脊噪声：行星大陆 / 星云纤维 */
export function ridged3(x, y, z, octaves = 5) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * f, y * f, z * f) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2.01;
  }
  return sum / norm;
}

/** 经纬度 → 单位球方向（等距柱状投影） */
export function lonLatToDir(u, v) {
  const phi = u * TAU;
  const theta = v * Math.PI;
  const st = Math.sin(theta);
  return [st * Math.cos(phi), Math.cos(theta), st * Math.sin(phi)];
}

/** 1 unit ≈ 10 m（本项目世界尺度约定） */
export function formatDistance(units) {
  const km = (units * 10) / 1000;
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 1000) return `${km.toFixed(1)} km`;
  if (km < 1e6) return `${(km / 1000).toFixed(1)} 千km`;
  return `${(km / 1e6).toFixed(2)} 百万km`;
}

export function formatSpeed(unitsPerSec) {
  const kms = (unitsPerSec * 10) / 1000;
  if (kms < 1) return `${(kms * 1000).toFixed(0)} m/s`;
  if (kms < 100) return `${kms.toFixed(2)} km/s`;
  return `${kms.toFixed(0)} km/s`;
}
