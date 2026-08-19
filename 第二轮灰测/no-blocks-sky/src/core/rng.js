// Deterministic hashing + PRNG helpers.

export function hash32(x, y = 0, z = 0, seed = 0) {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hashFloat(x, y = 0, z = 0, seed = 0) {
  return hash32(x, y, z, seed) / 4294967296;
}

export function mulberry32(a) {
  a = a | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function strSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// small helper: seeded random object with convenience methods
export function makeRng(seed) {
  const r = mulberry32(seed >>> 0);
  return {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length) % arr.length],
    chance: (p) => r() < p,
    sign: () => (r() < 0.5 ? -1 : 1),
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
  };
}
