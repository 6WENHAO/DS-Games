/**
 * Random.js — 可复现的伪随机数（xorshift128），保证场景每次加载完全一致。
 */
export class Rng {
  constructor(seed = 1337) {
    this.s0 = seed >>> 0 || 1;
    this.s1 = (seed * 1812433253 + 1) >>> 0;
    this.s2 = (seed * 69069 + 12345) >>> 0;
    this.s3 = (seed ^ 0x9e3779b9) >>> 0;
    for (let i = 0; i < 12; i++) this.next();
  }
  /** [0,1) */
  next() {
    let t = this.s0;
    const s = this.s3;
    t ^= t << 11; t >>>= 0;
    t ^= t >>> 8;
    this.s0 = this.s1; this.s1 = this.s2; this.s2 = this.s3;
    this.s3 = (s ^ t ^ (s >>> 19)) >>> 0;
    return this.s3 / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]; }
  /** 高斯分布（Box-Muller） */
  gauss() {
    let u = 0, v = 0;
    while (u <= 1e-7) u = this.next();
    while (v <= 1e-7) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  bool(p = 0.5) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
