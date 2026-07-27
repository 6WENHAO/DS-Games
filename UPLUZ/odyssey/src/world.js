import * as THREE from 'three';

// ---------------------------------------------------------------------------
// World heightfield.
// One authored-equivalent heightmap, baked once, kept in two forms:
//   - Float32Array on the CPU  -> collision / ground-follow (O(1) bilinear)
//   - RGBA16F DataTexture      -> vertex displacement for terrain AND grass
// R = height, GBA = normal. Grass shares this so blades sit on the same
// surface the player walks on, with zero per-blade CPU work.
// ---------------------------------------------------------------------------

export const WORLD_SIZE = 1024;   // metres, world spans [-512, 512]
export const HEIGHT_RES = 1024;   // 1 texel per metre
export const MAX_HEIGHT = 58;

function hash2(ix, iy) {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function fbm(x, y, octaves, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// Long S-curve hills, one readable valley, a flat-ish waking meadow at spawn.
function shape(x, z) {
  const s = 0.0022;
  // domain warp keeps ridgelines from reading as straight noise banding
  const wx = x + 90 * (fbm(x * 0.0011, z * 0.0011, 3) - 0.5);
  const wz = z + 90 * (fbm(x * 0.0011 + 31.7, z * 0.0011 - 12.3, 3) - 0.5);

  let h = fbm(wx * s, wz * s, 5) * 1.0;
  h = Math.pow(h, 1.35);                       // flatten lows, keep tops soft
  h *= MAX_HEIGHT;

  // a broad valley running roughly NE, so the eye has somewhere to travel
  const valley = Math.exp(-Math.pow((x * 0.7 + z * 0.7) / 210, 2));
  h *= 1 - 0.55 * valley;

  // distant landmark ridge to the north — the thing you walk toward
  const rd = Math.hypot(x - 60, z + 400);
  h += 26 * Math.exp(-Math.pow(rd / 190, 2));

  // the waking meadow: gently flattened bowl around spawn
  const sd = Math.hypot(x, z);
  const flat = Math.exp(-Math.pow(sd / 110, 2));
  h = h * (1 - 0.7 * flat) + 6.5 * flat;

  // fine surface roll so grass has something to drape over
  h += 2.4 * (fbm(x * 0.012, z * 0.012, 3) - 0.5);
  return h;
}

export class World {
  constructor() {
    const n = HEIGHT_RES;
    this.heights = new Float32Array(n * n);

    for (let j = 0; j < n; j++) {
      const z = (j / n) * WORLD_SIZE - WORLD_SIZE * 0.5;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * WORLD_SIZE - WORLD_SIZE * 0.5;
        this.heights[j * n + i] = shape(x, z);
      }
    }

    // pack height + normal into one RGBA half-float texture
    const data = new Uint16Array(n * n * 4);
    const half = THREE.DataUtils.toHalfFloat;
    const texel = WORLD_SIZE / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const l = this.heights[j * n + Math.max(i - 1, 0)];
        const r = this.heights[j * n + Math.min(i + 1, n - 1)];
        const d = this.heights[Math.max(j - 1, 0) * n + i];
        const u = this.heights[Math.min(j + 1, n - 1) * n + i];
        let nx = (l - r) / (2 * texel);
        let nz = (d - u) / (2 * texel);
        const inv = 1 / Math.hypot(nx, 1, nz);
        data[k * 4 + 0] = half(this.heights[k]);
        data[k * 4 + 1] = half(nx * inv);
        data[k * 4 + 2] = half(inv);
        data[k * 4 + 3] = half(nz * inv);
      }
    }

    this.texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  // bilinear, matches the GPU sample within half-float precision
  heightAt(x, z) {
    const n = HEIGHT_RES;
    const fx = ((x + WORLD_SIZE * 0.5) / WORLD_SIZE) * n;
    const fz = ((z + WORLD_SIZE * 0.5) / WORLD_SIZE) * n;
    const i = Math.min(Math.max(Math.floor(fx), 0), n - 2);
    const j = Math.min(Math.max(Math.floor(fz), 0), n - 2);
    const tx = Math.min(Math.max(fx - i, 0), 1);
    const tz = Math.min(Math.max(fz - j, 0), 1);
    const h = this.heights;
    const a = h[j * n + i], b = h[j * n + i + 1];
    const c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  normalAt(x, z) {
    const e = 1.0;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    const v = new THREE.Vector3((hl - hr) / (2 * e), 1, (hd - hu) / (2 * e));
    return v.normalize();
  }
}
