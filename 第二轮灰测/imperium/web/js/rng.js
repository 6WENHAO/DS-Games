// Deterministic RNG (mulberry32) + helpers.
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
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
export class RNG {
  constructor(seed) { this.r = mulberry32(typeof seed === 'string' ? hash32(seed) : seed); }
  next() { return this.r(); }
  int(n) { return Math.floor(this.r() * n); }
  range(a, b) { return a + this.r() * (b - a); }
  irange(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  picks(arr, n) {
    const c = arr.slice(); const o = [];
    while (o.length < n && c.length) o.push(c.splice(Math.floor(this.r() * c.length), 1)[0]);
    return o;
  }
  chance(p) { return this.r() < p; }
  gauss(mu = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.r();
    while (v === 0) v = this.r();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
