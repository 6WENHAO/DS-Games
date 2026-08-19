/* =====================================================================
 * Random — 可复现的伪随机数发生器
 * ===================================================================== */

/** 把任意字符串/数字散列成 32 位无符号整数种子 */
export function hashSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    let h = input | 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  const s = String(input ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32：快、质量足够、周期 2^32 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 面向坐标的确定性哈希（无状态，适合地形装饰） */
export function hash2i(seed, x, y) {
  let h = seed >>> 0;
  h ^= Math.imul(x | 0, 0x27d4eb2d); h = (h << 13) | (h >>> 19);
  h ^= Math.imul(y | 0, 0x165667b1); h = (h << 11) | (h >>> 21);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function hash3i(seed, x, y, z) {
  let h = seed >>> 0;
  h ^= Math.imul(x | 0, 0x27d4eb2d); h = (h << 13) | (h >>> 19);
  h ^= Math.imul(y | 0, 0x85ebca6b); h = (h << 7) | (h >>> 25);
  h ^= Math.imul(z | 0, 0x165667b1); h = (h << 11) | (h >>> 21);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 带便捷方法的随机源 */
export class Rng {
  constructor(seed = Date.now()) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    this.next = mulberry32(this.seed);
  }
  /** [0,1) */
  float() { return this.next(); }
  /** [min,max) */
  range(min, max) { return min + this.next() * (max - min); }
  /** 整数 [min,max] 闭区间 */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  /** 概率 p 命中 */
  chance(p) { return this.next() < p; }
  bool() { return this.next() < 0.5; }
  pick(arr) { return arr[(this.next() * arr.length) | 0]; }
  /** 按权重挑选 [{w, ...}] */
  pickWeighted(arr, weightOf = (o) => o.w ?? 1) {
    let total = 0;
    for (const o of arr) total += weightOf(o);
    let r = this.next() * total;
    for (const o of arr) { r -= weightOf(o); if (r <= 0) return o; }
    return arr[arr.length - 1];
  }
  /** 标准正态（Box-Muller） */
  gaussian(mean = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** 派生一个子随机源（用于互不干扰的子系统） */
  derive(tag) { return new Rng((this.seed ^ hashSeed(tag)) >>> 0); }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (this.next() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
