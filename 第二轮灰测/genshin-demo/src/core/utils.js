// Small shared utilities: math, easing, seeded RNG, event bus, pooling.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const smootherstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
export const randRange = (r, a, b) => a + r() * (b - a);
export const pick = (r, arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];

export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
};

/** Deterministic 32-bit RNG (mulberry32). */
export function makeRNG(seed = 1337) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Events {
  constructor() { this.map = new Map(); }
  on(name, fn) { (this.map.get(name) ?? this.map.set(name, []).get(name)).push(fn); return () => this.off(name, fn); }
  once(name, fn) { const un = this.on(name, (...a) => { un(); fn(...a); }); return un; }
  off(name, fn) { const l = this.map.get(name); if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
  emit(name, payload) {
    const l = this.map.get(name); if (l) for (const f of l.slice()) { try { f(payload); } catch (e) { console.error('[events]', name, e); } }
    const w = this.map.get('*'); if (w) for (const f of w.slice()) { try { f(name, payload); } catch (e) { console.error(e); } }
  }
}

/** Fixed-size object pool. */
export class Pool {
  constructor(factory, reset, size = 32) { this.factory = factory; this.reset = reset; this.free = []; this.used = []; for (let i = 0; i < size; i++) this.free.push(factory()); }
  get() { const o = this.free.pop() ?? this.factory(); this.used.push(o); return o; }
  release(o) { const i = this.used.indexOf(o); if (i >= 0) this.used.splice(i, 1); this.reset?.(o); this.free.push(o); }
  releaseAll() { for (const o of this.used.slice()) this.release(o); }
}

/** Time-sliced task queue so world generation never blocks a frame for long. */
export class TaskQueue {
  constructor(budgetMs = 6) { this.q = []; this.budgetMs = budgetMs; }
  push(fn, priority = 0) { this.q.push({ fn, priority }); this.dirty = true; }
  get length() { return this.q.length; }
  run(budgetMs = this.budgetMs) {
    if (!this.q.length) return 0;
    if (this.dirty) { this.q.sort((a, b) => a.priority - b.priority); this.dirty = false; }
    const t0 = performance.now(); let n = 0;
    while (this.q.length && performance.now() - t0 < budgetMs) { const t = this.q.shift(); try { t.fn(); } catch (e) { console.error('[task]', e); } n++; }
    return n;
  }
}
