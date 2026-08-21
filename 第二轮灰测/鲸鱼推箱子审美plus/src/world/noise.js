/**
 * Deterministic CPU noise. Used for terrain height, grass scattering, tree
 * placement and prop jitter, so the world is identical on every load.
 */

export function hash2i(ix, iy, seed) {
  let n = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 362437);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function valueNoise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy, seed);
  const b = hash2i(ix + 1, iy, seed);
  const c = hash2i(ix, iy + 1, seed);
  const d = hash2i(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

export function fbm2(x, y, { seed = 0, octaves = 4, lacunarity = 2.03, gain = 0.5 } = {}) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise2(x * f, y * f, seed + o * 1013);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Ridged variant: sharper crests, used for the hill rims that frame the view. */
export function ridged2(x, y, { seed = 0, octaves = 4 } = {}) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    const n = 1 - Math.abs(valueNoise2(x * f, y * f, seed + o * 617) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2.11;
  }
  return sum / norm;
}

/** Deterministic per-index random stream. */
export class Rng {
  constructor(seed = 1) {
    this.state = (seed | 0) || 1;
  }

  next() {
    let x = this.state;
    x ^= x << 13; x |= 0;
    x ^= x >>> 17;
    x ^= x << 5; x |= 0;
    this.state = x;
    return ((x >>> 0) / 4294967296);
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1 - 1e-9));
  }

  pick(list) {
    return list[Math.min(list.length - 1, Math.floor(this.next() * list.length))];
  }
}

export const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6)));
  return t * t * (3 - 2 * t);
};

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
