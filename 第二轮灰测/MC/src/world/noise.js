/**
 * @file src/world/noise.js
 *
 * Deterministic, dependency-free procedural noise for the voxel terrain
 * generator (a Minecraft-style block world).
 *
 * Every generator here is seeded: the same seed always produces the same
 * output on every platform and in every JS runtime that implements IEEE-754
 * double arithmetic (browsers, web workers, and Node 24 included). Nothing in
 * this file reads any ambient state beyond `Math` and the typed-array
 * constructors, so it is safe to `import` from a worker or to run under Node
 * without shims or a bundler.
 *
 * The exports are the building blocks of the terrain pipeline:
 *
 *   - `mulberry32` / `hashSeed`      reproducible master seeds and per-layer
 *                                    sub-seeds.
 *   - `Noise2D` / `Noise3D`          Perlin-style ("improved") gradient noise
 *                                    for height, temperature, humidity,
 *                                    erosion, and 3D density fields.
 *   - `Cellular2D`                   Worley/cellular noise for biome region
 *                                    shapes and cave "cheese" caverns.
 *   - `smoothstep`/`smootherstep`/
 *     `lerp`/`remap`/`spline`        cheap shaping/interpolation helpers used
 *                                    when turning a noise field into a height
 *                                    or density curve.
 *
 * Performance notes
 * -----------------
 * `sample` / `fbm` / `ridged` / `warpedFbm` allocate nothing on the hot path:
 * no object or array literals are created inside them, and the permutation
 * table is a flat `Uint8Array` indexed with a bit-mask instead of a modulo.
 * This keeps the module fast enough to be invoked millions of times during
 * chunk generation.
 *
 * Range contract
 * --------------
 * `Noise2D.sample` and `Noise3D.sample` return values in [-1, 1]. The 2D
 * "improved" lattice is bounded by [-1, 1] directly; the 3D lattice is scaled
 * by a normalisation constant so it matches. `fbm` additionally divides by the
 * sum of the octave amplitudes, so its output stays near [-1, 1] regardless of
 * octave count.
 */

/**
 * Quintic fade curve. Maps [0, 1] -> [0, 1] with zero first and second
 * derivatives at both endpoints, which hides the lattice grid (Mach banding)
 * in the generated terrain.
 *
 * @param {number} t  fractional position within a lattice cell, in [0, 1]
 * @returns {number}
 */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * 2D gradient selector (Perlin "improved" noise, 4 unit-diagonal directions
 * each reachable from two hash values). `hash` is a byte from the permutation
 * table; the return value is the dot product of the chosen gradient with
 * `(x, y)`.
 *
 * @param {number} hash  permutation byte (0..255)
 * @param {number} x     offset from the lattice corner along x
 * @param {number} y     offset from the lattice corner along y
 * @returns {number}
 */
function grad2(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * 3D gradient selector (Perlin "improved" noise, 12 edge-centred directions).
 *
 * @param {number} hash  permutation byte (0..255)
 * @param {number} x     offset from the lattice corner along x
 * @param {number} y     offset from the lattice corner along y
 * @param {number} z     offset from the lattice corner along z
 * @returns {number}
 */
function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * Normalisation factor for the 3D lattice.
 *
 * The 2D "improved" gradient set is exactly bounded by [-1, 1], but the 3D
 * set (12 edge-centred directions) has a theoretical maximum magnitude of
 * ~1.036353811, so the raw 3D result is scaled back into [-1, 1]. This keeps
 * `Noise3D.sample`/`fbm`/`ridged` within the same contract as the 2D variants
 * (and stops the value from creeping past 1 with many octaves).
 */
const NOISE3D_SCALE = 1 / 1.036353811;

/**
 * Build a 512-entry permutation table from `seed` with a Fisher-Yates shuffle
 * driven by `mulberry32`, then duplicate the first 256 entries so lattice
 * lookups only ever need `& 255` (never a modulo).
 *
 * This is the only mutable state a noise instance carries. Because the shuffle
 * is fully deterministic, two instances constructed with the same seed get
 * bit-identical tables and therefore identical output, while different seeds
 * produce unrelated tables.
 *
 * @param {number} seed  integer seed (coerced to int32)
 * @returns {Uint8Array}  512-entry permutation table of values 0..255
 */
function buildPermutation(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  const rand = mulberry32(seed | 0);
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0; // 0..i
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/**
 * Deterministic 32-bit hash-based PRNG.
 *
 * Returns a closure that yields successive pseudo-random floats in [0, 1).
 * It is used to shuffle permutation tables and, at call sites, to derive
 * reproducible jitter without touching the non-seedable `Math.random`.
 *
 * @param {number} seed  any integer (coerced to int32)
 * @returns {() => number}  function returning successive floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits a master world seed into a well-distributed int32 sub-seed for a
 * named terrain layer.
 *
 * The name is mixed in one UTF-16 code unit at a time using only integer
 * arithmetic (`Math.imul`, `^`, `>>>`, `|0`), so the result is bit-identical
 * across platforms, locales and JS engines — no float rounding is involved.
 *
 * @param {number} seed  master world seed (coerced to int32)
 * @param {string} name  layer name, e.g. "height", "temperature", "biome",
 *                       "caves"
 * @returns {number}  int32 sub-seed for the named layer
 */
export function hashSeed(seed, name) {
  let h = seed | 0;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b1) | 0;
    h = (h ^ (h >>> 16)) | 0;
  }
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) | 0;
  return (h ^ (h >>> 16)) | 0;
}

/**
 * Seeded 2D Perlin-style ("improved") gradient noise.
 *
 * One instance is typically created per terrain layer (height, temperature,
 * humidity, ...). The permutation lattice is derived from the seed, so
 * instances with different seeds produce unrelated fields while instances
 * sharing a seed are bit-identical.
 */
export class Noise2D {
  /**
   * @param {number} seed  integer seed
   */
  constructor(seed) {
    this.perm = buildPermutation(seed);
  }

  /**
   * Single octave of gradient noise in [-1, 1].
   *
   * Allocation-free and intended to be called millions of times.
   *
   * @param {number} x
   * @param {number} y
   * @returns {number}  noise value in [-1, 1]
   */
  sample(x, y) {
    const perm = this.perm;
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xi = X & 255;
    const yi = Y & 255;
    const xf = x - X;
    const yf = y - Y;

    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const A = perm[xi] + yi;
    const B = perm[xi + 1] + yi;
    const aa = perm[A];
    const ab = perm[A + 1];
    const ba = perm[B];
    const bb = perm[B + 1];

    const x1 = xf - 1;
    const y1 = yf - 1;

    const n00 = grad2(perm[aa], xf, yf);
    const n10 = grad2(perm[ba], x1, yf);
    const n01 = grad2(perm[ab], xf, y1);
    const n11 = grad2(perm[bb], x1, y1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0);
  }

  /**
   * Fractal Brownian motion: `octaves` layers of noise with increasing
   * frequency and decreasing amplitude, normalised by the sum of the
   * amplitudes so the result stays near [-1, 1] no matter how many octaves are
   * requested.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} octaves       number of octaves (>= 1)
   * @param {number} [lacunarity]  frequency multiplier per octave (default 2)
   * @param {number} [persistence] amplitude multiplier per octave (default 0.5)
   * @returns {number}  normalised fbm value, roughly in [-1, 1]
   */
  fbm(x, y, octaves, lacunarity = 2, persistence = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.sample(x * freq, y * freq);
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }

  /**
   * Ridged multifractal noise: each octave is `abs()`-folded (losing its sign)
   * and squared for sharp ridgelines, then the whole sum is re-centred to
   * roughly [-1, 1]. Produces the jagged mountain ridges used by terrain
   * shaping.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} octaves       number of octaves (>= 1)
   * @param {number} [lacunarity]  frequency multiplier per octave (default 2)
   * @param {number} [persistence] amplitude multiplier per octave (default 0.5)
   * @returns {number}  ridge value in [-1, 1] (1 = ridge line)
   */
  ridged(x, y, octaves, lacunarity = 2, persistence = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = this.sample(x * freq, y * freq);
      const fold = 1 - Math.abs(n); // [0, 1]
      sum += amp * fold * fold; // square for sharper ridges
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return norm === 0 ? 0 : (sum / norm) * 2 - 1;
  }

  /**
   * Domain-warped fbm: samples the base fbm at a coordinate displaced by the
   * fbm itself (the classic "warped noise" trick), keeping the sign of every
   * octave. Gives the flowing, distorted shapes used for riverbeds, ore veins
   * and similar features.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} octaves  number of octaves for the fbm layers
   * @param {number} warp     warp strength (0 disables warping)
   * @returns {number}  warped fbm value in [-1, 1]
   */
  warpedFbm(x, y, octaves, warp) {
    const qx = this.fbm(x, y, octaves);
    const qy = this.fbm(x + 5.2, y + 1.3, octaves);
    return this.fbm(x + warp * qx, y + warp * qy, octaves);
  }
}

/**
 * Seeded 3D Perlin-style ("improved") gradient noise.
 *
 * Used for volumetric fields such as 3D cave density, ore distribution, or
 * sampled wind/light variation inside the world.
 */
export class Noise3D {
  /**
   * @param {number} seed  integer seed
   */
  constructor(seed) {
    this.perm = buildPermutation(seed);
  }

  /**
   * Single octave of gradient noise in [-1, 1].
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}  noise value in [-1, 1]
   */
  sample(x, y, z) {
    const perm = this.perm;
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const xf = x - X;
    const yf = y - Y;
    const zf = z - Z;

    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);

    const A = perm[xi] + yi;
    const AA = perm[A] + zi;
    const AB = perm[A + 1] + zi;
    const B = perm[xi + 1] + yi;
    const BA = perm[B] + zi;
    const BB = perm[B + 1] + zi;

    const x0 = xf - 1;
    const y0 = yf - 1;
    const z0 = zf - 1;

    const n000 = grad3(perm[AA], xf, yf, zf);
    const n100 = grad3(perm[BA], x0, yf, zf);
    const n010 = grad3(perm[AB], xf, y0, zf);
    const n110 = grad3(perm[BB], x0, y0, zf);
    const n001 = grad3(perm[AA + 1], xf, yf, z0);
    const n101 = grad3(perm[BA + 1], x0, yf, z0);
    const n011 = grad3(perm[AB + 1], xf, y0, z0);
    const n111 = grad3(perm[BB + 1], x0, y0, z0);

    const nx00 = n000 + u * (n100 - n000);
    const nx10 = n010 + u * (n110 - n010);
    const nx01 = n001 + u * (n101 - n001);
    const nx11 = n011 + u * (n111 - n011);

    const nxy0 = nx00 + v * (nx10 - nx00);
    const nxy1 = nx01 + v * (nx11 - nx01);

    return (nxy0 + w * (nxy1 - nxy0)) * NOISE3D_SCALE;
  }

  /**
   * Fractal Brownian motion, normalised by the sum of octave amplitudes.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} octaves       number of octaves (>= 1)
   * @param {number} [lacunarity]  frequency multiplier per octave (default 2)
   * @param {number} [persistence] amplitude multiplier per octave (default 0.5)
   * @returns {number}  normalised fbm value, roughly in [-1, 1]
   */
  fbm(x, y, z, octaves, lacunarity = 2, persistence = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.sample(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return norm === 0 ? 0 : sum / norm;
  }

  /**
   * Ridged multifractal noise in 3D (see `Noise2D.ridged` for the folding
   * rule).
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} octaves       number of octaves (>= 1)
   * @param {number} [lacunarity]  frequency multiplier per octave (default 2)
   * @param {number} [persistence] amplitude multiplier per octave (default 0.5)
   * @returns {number}  ridge value in [-1, 1]
   */
  ridged(x, y, z, octaves, lacunarity = 2, persistence = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = this.sample(x * freq, y * freq, z * freq);
      const fold = 1 - Math.abs(n);
      sum += amp * fold * fold;
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return norm === 0 ? 0 : (sum / norm) * 2 - 1;
  }
}

/**
 * Cellular / Worley noise (2D), used to build biome region shapes and the
 * "cheese" cavern network: it returns a smoothly varying distance field whose
 * isolines form organic cell boundaries.
 *
 * Distances are normalised by `sqrt(2)` (the maximum in-cell distance) so
 * `f1` falls in roughly [0, 1]. `f2` is the second-nearest feature distance,
 * useful for detecting cell borders (`f2 - f1`).
 *
 * IMPORTANT: `sample` returns a single object reused across calls, so callers
 * must copy values they want to keep (or read them from the mirrored fields on
 * the instance: `this.f1`, `this.f2`, `this.cellX`, `this.cellY`,
 * `this.cellHash`). This avoids any allocation on the hot path.
 */
export class Cellular2D {
  /**
   * @param {number} seed  integer seed
   */
  constructor(seed) {
    this.seed = seed | 0;
    this.f1 = 0;
    this.f2 = 0;
    this.cellX = 0;
    this.cellY = 0;
    this.cellHash = 0;
    this._result = { f1: 0, f2: 0, cellX: 0, cellY: 0, cellHash: 0 };
  }

  /**
   * Evaluate the cellular field at `(x, y)`.
   *
   * @param {number} x
   * @param {number} y
   * @returns {{ f1: number, f2: number, cellX: number, cellY: number, cellHash: number }}
   *   A reused object holding: `f1` (nearest feature distance, ~[0,1]),
   *   `f2` (second-nearest feature distance), `cellX`/`cellY` (integer lattice
   *   cell of the nearest feature) and `cellHash` (deterministic float in
   *   [0,1) identifying that cell). The same object is returned on every call.
   */
  sample(x, y) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const dx = x - cx;
    const dy = y - cy;
    let f1 = Infinity;
    let f2 = Infinity;
    let bx = 0;
    let by = 0;
    let bh = 0;
    const seed = this.seed;

    // Only the 3x3 neighbourhood is needed: the nearest feature point is
    // always within the cell containing (x, y), which is inside this window.
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cellX = cx + ox;
        const cellY = cy + oy;

        // Deterministic per-cell hash (int32), independent of sample position.
        let h = seed;
        h = Math.imul(h ^ cellX, 0x27d4eb2d) | 0;
        h = Math.imul(h ^ cellY, 0x165667b1) | 0;
        h = (h ^ (h >>> 13)) | 0;
        h = Math.imul(h, 0x85ebca6b) | 0;
        h = (h ^ (h >>> 16)) | 0;

        const px = (h & 0xffff) / 65536; // feature x offset within the cell
        const py = ((h >>> 16) & 0xffff) / 65536; // feature y offset
        const fx = ox + px - dx;
        const fy = oy + py - dy;
        const d2 = fx * fx + fy * fy;

        if (d2 < f1) {
          f2 = f1;
          f1 = d2;
          bx = cellX;
          by = cellY;
          bh = (h >>> 0) / 4294967296;
        } else if (d2 < f2) {
          f2 = d2;
        }
      }
    }

    f1 = Math.sqrt(f1) / Math.SQRT2;
    f2 = Math.sqrt(f2) / Math.SQRT2;
    this.f1 = f1;
    this.f2 = f2;
    this.cellX = bx;
    this.cellY = by;
    this.cellHash = bh;

    const r = this._result;
    r.f1 = f1;
    r.f2 = f2;
    r.cellX = bx;
    r.cellY = by;
    r.cellHash = bh;
    return r;
  }
}

/**
 * Cubic smoothstep. Maps `t` from [0, 1] to [0, 1] with zero first derivative
 * at both ends. Callers are expected to pass a clamped `t`.
 *
 * @param {number} t  interpolation factor, typically in [0, 1]
 * @returns {number}
 */
export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Quintic smoothstep (same curve as the internal fade). Zero first and second
 * derivatives at both ends, so it transitions even more smoothly than
 * `smoothstep`; used where visible terrain gradients must not kink.
 *
 * @param {number} t  interpolation factor, typically in [0, 1]
 * @returns {number}
 */
export function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation between `a` and `b`.
 *
 * @param {number} a  value at t = 0
 * @param {number} b  value at t = 1
 * @param {number} t  interpolation factor
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + t * (b - a);
}

/**
 * Re-maps `v` from the range [inMin, inMax] to [outMin, outMax], clamping
 * `v` to the input range first. Used to turn a normalised noise value into a
 * concrete world quantity (e.g. a block height or a cave radius).
 *
 * @param {number} v       input value
 * @param {number} inMin   input range minimum
 * @param {number} inMax   input range maximum
 * @param {number} outMin  output range minimum
 * @param {number} outMax  output range maximum
 * @returns {number}
 */
export function remap(v, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  let t = (v - inMin) / (inMax - inMin);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return outMin + t * (outMax - outMin);
}

/**
 * Piecewise-linear spline over a set of control points, used for the
 * Minecraft-style "continentalness -> height" (and similar) curves.
 *
 * The value is linearly interpolated between the two surrounding knots,
 * clamped to the first knot's value below the first x and to the last knot's
 * value above the last x.
 *
 * @param {Array<[number, number]>} points  control points `[x, y]`, sorted
 *                                          ascending by x (no duplicate x)
 * @param {number} x  input value
 * @returns {number}  interpolated (or clamped) output value
 */
export function spline(points, x) {
  const n = points.length;
  if (n === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (points[mid][0] <= x) lo = mid;
    else hi = mid;
  }

  const x0 = points[lo][0];
  const x1 = points[hi][0];
  const t = (x - x0) / (x1 - x0);
  return points[lo][1] + t * (points[hi][1] - points[lo][1]);
}
