import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function angleDamp(a, b, lambda, dt) {
  return angleLerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function flatAngle(dx, dz) {
  return Math.atan2(dx, dz);
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// deterministic pseudo random for world generation
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- value noise (seeded, smooth) ----
const NOISE_SIZE = 256;
function buildNoiseTable(seed) {
  const rng = mulberry32(seed);
  const table = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  return table;
}
const noiseTable = buildNoiseTable(20260718);

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = ((xi % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
  const Y = ((yi % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
  const X1 = (X + 1) % NOISE_SIZE, Y1 = (Y + 1) % NOISE_SIZE;
  const a = noiseTable[Y * NOISE_SIZE + X];
  const b = noiseTable[Y * NOISE_SIZE + X1];
  const c = noiseTable[Y1 * NOISE_SIZE + X];
  const d = noiseTable[Y1 * NOISE_SIZE + X1];
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// distance from point to polyline (2D), returns { dist, t }
export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const abx = bx - ax, abz = bz - az;
    const apx = px - ax, apz = pz - az;
    const len2 = abx * abx + abz * abz || 1e-6;
    let t = (apx * abx + apz * abz) / len2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t, cz = az + abz * t;
    const d = dist2D(px, pz, cx, cz);
    if (d < best) best = d;
  }
  return best;
}

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const tmpBox = new THREE.Box3();
export function measureHeight(object) {
  tmpBox.setFromObject(object);
  return tmpBox.max.y - tmpBox.min.y;
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
