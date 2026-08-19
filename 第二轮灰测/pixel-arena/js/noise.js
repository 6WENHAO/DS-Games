// ============================================================
// noise.js — 哈希噪声 / 值噪声 / fbm / 可播种随机数
// 云影以世界 XZ 坐标采样 fbm 噪声生成。
// ============================================================
'use strict';

// 2D 整数哈希 -> [0,1)
function hash2(x, y, seed) {
  seed = seed | 0;
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}

// 平滑插值值噪声
function vnoise2(x, y, seed) {
  seed = seed | 0;
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 分形叠加 2 阶
function fbm2(x, y, oct, seed) {
  let amp = 1, freq = 1, sum = 0, tot = 0;
  for (let i = 0; i < oct; i++) {
    sum += vnoise2(x * freq, y * freq, seed + i * 17) * amp;
    tot += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / tot;
}

// mulberry32 可播种随机数
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hash2, vnoise2, fbm2, mulberry32 };
}
