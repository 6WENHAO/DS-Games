/**
 * Noise.js — CPU 端噪声。用于生成地形高度图（同一张高度图会上传到 GPU 供顶点着色器采样，
 * 因此 CPU 查询与 GPU 采样使用完全相同的数据源，物体不会浮空或陷地）。
 */
import { lerp } from './Random.js';

/* 整数哈希：位运算实现，JS 与结果完全可复现（不依赖 sin 精度） */
function hash2i(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise，返回 [-1,1] */
export function vnoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash2i(xi, yi, seed), b = hash2i(xi + 1, yi, seed);
  const c = hash2i(xi, yi + 1, seed), d = hash2i(xi + 1, yi + 1, seed);
  return (lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1);
}

/** 分形叠加 */
export function fbm2(x, y, octaves = 5, lacunarity = 2.03, gain = 0.5, seed = 0) {
  let f = 1, a = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += a * vnoise2(x * f, y * f, seed + i * 131);
    norm += a;
    f *= lacunarity; a *= gain;
  }
  return sum / (norm || 1);
}

/** 山脊噪声（做沙丘脊线 / 丘陵） */
export function ridged2(x, y, octaves = 4, lacunarity = 2.07, gain = 0.5, seed = 0) {
  let f = 1, a = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(vnoise2(x * f, y * f, seed + i * 977));
    sum += a * n * n;
    norm += a;
    f *= lacunarity; a *= gain;
  }
  return sum / (norm || 1);
}

/** 域扭曲 fbm，产生更自然的流线形态 */
export function warpedFbm2(x, y, warp = 0.6, seed = 0) {
  const wx = fbm2(x * 0.5 + 11.3, y * 0.5 - 7.1, 3, 2.0, 0.5, seed + 17);
  const wy = fbm2(x * 0.5 - 3.7, y * 0.5 + 19.2, 3, 2.0, 0.5, seed + 91);
  return fbm2(x + warp * wx, y + warp * wy, 5, 2.03, 0.5, seed);
}

/**
 * HeightField —— 带双线性插值的高度场，既能上传成纹理也能被 CPU 精确查询。
 */
export class HeightField {
  /**
   * @param {number} size    分辨率（size × size）
   * @param {number} extent  世界尺寸（米，覆盖 [-extent/2, extent/2]）
   * @param {(wx:number, wz:number)=>number} fn 高度函数（世界坐标 → 米）
   */
  constructor(size, extent, fn) {
    this.size = size;
    this.extent = extent;
    this.data = new Float32Array(size * size);
    this.min = Infinity; this.max = -Infinity;
    const step = extent / (size - 1);
    const half = extent * 0.5;
    for (let j = 0; j < size; j++) {
      const wz = -half + j * step;
      for (let i = 0; i < size; i++) {
        const wx = -half + i * step;
        const h = fn(wx, wz);
        this.data[j * size + i] = h;
        if (h < this.min) this.min = h;
        if (h > this.max) this.max = h;
      }
    }
  }

  /** 世界坐标 → 高度（双线性插值；越界按边缘钳制） */
  height(wx, wz) {
    const n = this.size;
    const half = this.extent * 0.5;
    let u = ((wx + half) / this.extent) * (n - 1);
    let v = ((wz + half) / this.extent) * (n - 1);
    u = u < 0 ? 0 : u > n - 1 ? n - 1 : u;
    v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const i1 = Math.min(n - 1, i0 + 1), j1 = Math.min(n - 1, j0 + 1);
    const fu = u - i0, fv = v - j0;
    const d = this.data;
    const h00 = d[j0 * n + i0], h10 = d[j0 * n + i1];
    const h01 = d[j1 * n + i0], h11 = d[j1 * n + i1];
    return lerp(lerp(h00, h10, fu), lerp(h01, h11, fu), fv);
  }

  /** 法线（中心差分） */
  normal(wx, wz, out = { x: 0, y: 1, z: 0 }) {
    const e = this.extent / (this.size - 1);
    const hl = this.height(wx - e, wz), hr = this.height(wx + e, wz);
    const hd = this.height(wx, wz - e), hu = this.height(wx, wz + e);
    const nx = hl - hr, nz = hd - hu, ny = 2 * e;
    const len = Math.hypot(nx, ny, nz) || 1;
    out.x = nx / len; out.y = ny / len; out.z = nz / len;
    return out;
  }

  /** 坡度（0=平地，1=陡） */
  slope(wx, wz) {
    const n = this.normal(wx, wz);
    return 1 - n.y;
  }
}
