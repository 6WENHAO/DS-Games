// Deterministic noise shared by CPU (terrain/collision/placement) and GPU (glsl string).
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}
const PERM = buildPerm(20200928);

/** 2D simplex noise, output roughly [-1,1]. */
export function simplex2(xin, yin) {
  const s = (xin + yin) * F2;
  let i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t, Y0 = j - t;
  const x0 = xin - X0, y0 = yin - Y0;
  let i1, j1;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  i &= 255; j &= 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = GRAD[PERM[i + PERM[j]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = GRAD[PERM[i + i1 + PERM[j + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = GRAD[PERM[i + 1 + PERM[j + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * n;
}

export function fbm2(x, y, oct = 4, lac = 2.0, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * simplex2(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return sum / norm;
}

/** Ridged multifractal in [0,1] - sharp mountain crests. */
export function ridged2(x, y, oct = 5, lac = 2.05, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0, prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(simplex2(x * f, y * f));
    n *= n; n *= prev; prev = n;
    sum += a * n; norm += a; a *= gain; f *= lac;
  }
  return sum / norm;
}

/** Cheap deterministic hash for placement decisions. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** GLSL: value-noise + fbm used by material shaders (not bit-identical to CPU simplex, only for detail). */
export const GLSL_NOISE = /* glsl */`
vec2 gh2(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(gh2(i+vec2(0,0)), f-vec2(0,0)), dot(gh2(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(gh2(i+vec2(0,1)), f-vec2(0,1)), dot(gh2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
}
float gfbm(vec2 p, int oct){
  float a = 0.5, s = 0.0; for (int i=0;i<8;i++){ if(i>=oct) break; s += a*gnoise(p); p *= 2.03; a *= 0.5; } return s;
}
`;
