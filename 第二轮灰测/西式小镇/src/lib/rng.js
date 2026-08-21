// ---------------------------------------------------------------------------
// 确定性随机数工具 (deterministic pseudo random helpers)
// 使用 mulberry32，保证每次刷新页面生成完全相同的小镇。
// ---------------------------------------------------------------------------

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

export class Rng {
  constructor(seed = 20240607) {
    this.next = mulberry32(seed);
  }
  /** [0,1) */
  f() {
    return this.next();
  }
  /** [a,b) */
  range(a, b) {
    return a + (b - a) * this.next();
  }
  /** 整数 [a,b] */
  int(a, b) {
    return Math.floor(this.range(a, b + 0.999999));
  }
  /** 中心分布，围绕 mid 抖动 */
  jitter(mid, amount) {
    return mid + (this.next() * 2 - 1) * amount;
  }
  bool(p = 0.5) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  /** 打乱数组（返回新数组） */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
}

/** 平滑噪声（用于地形起伏），值域约 [-1,1] */
export function hillNoise(x, z) {
  return (
    Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.6) * 0.6 +
    Math.sin(x * 0.043 - z * 0.031) * 0.25 +
    Math.cos(x * 0.089 + z * 0.077) * 0.12
  );
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
