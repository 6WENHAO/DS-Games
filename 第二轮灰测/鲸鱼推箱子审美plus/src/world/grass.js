/**
 * Instanced blade fields.
 *
 * One InstancedBufferGeometry, one draw call, tens of thousands of blades. The
 * meadow is scattered as tufts rather than as independent blades: a tuft shares
 * a height band, a colour zone and a species, which is what makes stylised grass
 * read as clumps of vegetation instead of noise.
 *
 * The same builder produces the tall hedge walls that fence the puzzle plot, so
 * the level boundary is made of the same shader as the meadow around it.
 */
import * as THREE from 'three';
import { GRASS, FLOWERS, WORLD } from '../core/config.js';
import { createGrassMaterial } from '../gfx/grassMaterial.js';
import { BLADE_VARIANT_INDEX } from '../gfx/textures.js';
import { Rng, fbm2, smoothstep, lerp, clamp } from './noise.js';

let sharedMaterial = null;
export function grassMaterial() {
  if (!sharedMaterial) sharedMaterial = createGrassMaterial();
  return sharedMaterial;
}

/** Growable typed-array builder for blade instances. */
export class BladeBuilder {
  constructor(capacity) {
    this.capacity = Math.max(16, capacity | 0);
    this.count = 0;
    this.base = new Float32Array(this.capacity * 3);
    this.params = new Float32Array(this.capacity * 4);
    this.tint = new Float32Array(this.capacity * 4);
    this.sway = new Float32Array(this.capacity * 2);
  }

  grow() {
    const cap = this.capacity * 2;
    const copy = (src, stride) => {
      const dst = new Float32Array(cap * stride);
      dst.set(src);
      return dst;
    };
    this.base = copy(this.base, 3);
    this.params = copy(this.params, 4);
    this.tint = copy(this.tint, 4);
    this.sway = copy(this.sway, 2);
    this.capacity = cap;
  }

  add(x, y, z, width, height, phase, rnd, tintR, tintG, tintB, variant, stiff, lean) {
    if (this.count >= this.capacity) this.grow();
    const i = this.count;
    this.base[i * 3] = x;
    this.base[i * 3 + 1] = y;
    this.base[i * 3 + 2] = z;
    this.params[i * 4] = width;
    this.params[i * 4 + 1] = height;
    this.params[i * 4 + 2] = phase;
    this.params[i * 4 + 3] = rnd;
    this.tint[i * 4] = tintR;
    this.tint[i * 4 + 1] = tintG;
    this.tint[i * 4 + 2] = tintB;
    this.tint[i * 4 + 3] = variant;
    this.sway[i * 2] = stiff;
    this.sway[i * 2 + 1] = lean;
    this.count = i + 1;
    return i;
  }

  /** @returns {THREE.Mesh|null} */
  build(name, boundsRadius = WORLD.size) {
    if (this.count === 0) return null;
    const plane = new THREE.PlaneGeometry(1, 1, 1, 4);
    plane.translate(0, 0.5, 0);
    // Every blade normal points straight up: the field then receives light as a
    // single continuous surface, which is what keeps the shading flat and calm.
    const n = plane.getAttribute('normal');
    for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0);
    n.needsUpdate = true;

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index;
    geometry.setAttribute('position', plane.getAttribute('position'));
    geometry.setAttribute('normal', plane.getAttribute('normal'));
    geometry.setAttribute('uv', plane.getAttribute('uv'));

    const slice = (arr, stride) => new THREE.InstancedBufferAttribute(
      arr.subarray(0, this.count * stride), stride,
    );
    geometry.setAttribute('aBase', slice(this.base, 3));
    geometry.setAttribute('aParams', slice(this.params, 4));
    geometry.setAttribute('aTint', slice(this.tint, 4));
    geometry.setAttribute('aSway', slice(this.sway, 2));
    geometry.instanceCount = this.count;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), boundsRadius);

    const mesh = new THREE.Mesh(geometry, grassMaterial());
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.bladeCount = this.count;
    return mesh;
  }
}

const GRASS_VARIANTS = BLADE_VARIANT_INDEX.grass;
const FLOWER_VARIANTS = BLADE_VARIANT_INDEX.flower;

/**
 * Scatters the meadow.
 * @param {object} terrain result of createTerrain()
 * @param {object} opts
 * @param {number} opts.count blade budget
 * @param {{x:number,z:number,inner:number,outer:number}[]} opts.focals dense regions
 * @param {(x:number,z:number)=>number} opts.shadeQuery canopy occlusion in [0,1]
 */
export function createMeadow(terrain, { count, focals, shadeQuery = () => 0 }) {
  const half = terrain.half;
  const spacing = 0.92;
  const cells = Math.floor((half * 2) / spacing);
  const bladesPerTuft = 5;

  const densityAt = (x, z) => {
    const r = Math.hypot(x, z);
    if (r > half + 6) return 0;
    const road = terrain.samplePath(x, z);
    let d = clamp(1 - road * 1.35, 0, 1);
    if (d <= 0) return 0;

    let focal = 0;
    for (const f of focals) {
      const fd = Math.hypot(x - f.x, z - f.z);
      focal = Math.max(focal, 1 - smoothstep(f.inner, f.outer, fd));
    }
    d *= lerp(0.09, 1.0, focal);

    const patch = 0.5 + 0.95 * fbm2(x * 0.035, z * 0.035, { seed: 4021, octaves: 3 });
    d *= patch;

    const lawn = terrain.sampleLawn(x, z);
    d *= lerp(1.0, 1.75, lawn);
    return clamp(d, 0, 1.8);
  };

  // Pass 1: total density, so the budget lands where we want it.
  let total = 0;
  for (let j = 0; j < cells; j += 1) {
    const z = -half + (j + 0.5) * spacing;
    for (let i = 0; i < cells; i += 1) {
      total += densityAt(-half + (i + 0.5) * spacing, z);
    }
  }
  const scale = total > 0 ? clamp((count / bladesPerTuft) / total, 0, 1) : 0;

  const builder = new BladeBuilder(Math.round(count * 1.08));
  const rng = new Rng(WORLD.seed ^ 0x51ed);

  for (let j = 0; j < cells; j += 1) {
    const cz = -half + (j + 0.5) * spacing;
    for (let i = 0; i < cells; i += 1) {
      const cx = -half + (i + 0.5) * spacing;
      const d = densityAt(cx, cz);
      if (d <= 0) continue;
      if (rng.next() > d * scale) continue;

      const tx = cx + (rng.next() - 0.5) * spacing;
      const tz = cz + (rng.next() - 0.5) * spacing;

      const lawn = terrain.sampleLawn(tx, tz);
      const road = terrain.samplePath(tx, tz);
      const shade = clamp(shadeQuery(tx, tz), 0, 1);

      // Species zones: a broad noise field decides whether a tuft is fresh,
      // cool, olive or sun-bleached, so colour varies in patches.
      const zone = fbm2(tx * 0.018, tz * 0.018, { seed: 9111, octaves: 3 });
      const dryness = clamp((zone - 0.34) * 2.3, 0, 1);
      let variant = GRASS_VARIANTS[Math.min(3, Math.floor(dryness * 3.999))];
      if (rng.next() < 0.22) variant = rng.pick(GRASS_VARIANTS);

      const isFlowerTuft = lawn < 0.2 && road < 0.08 && rng.next() < 0.055;
      const tuftSize = isFlowerTuft ? 1 + Math.floor(rng.next() * 3) : bladesPerTuft;

      // Height: full in the meadow, cropped on the mown plot, trampled at the
      // road shoulder.
      const heightScale = lerp(1.0, 0.34, lawn) * lerp(1.0, 0.55, clamp(road * 2.2, 0, 1));
      const tuftHeight = lerp(GRASS.height[0], GRASS.height[1], rng.next()) * heightScale;

      const warm = clamp(zone * 1.25, 0, 1);
      const tintR = lerp(0.88, 1.12, warm) * lerp(1, 0.5, shade);
      const tintG = lerp(1.02, 1.0, warm) * lerp(1, 0.56, shade);
      const tintB = lerp(1.0, 0.82, warm) * lerp(1, 0.62, shade);

      for (let k = 0; k < tuftSize; k += 1) {
        const ang = rng.next() * Math.PI * 2;
        const rad = rng.next() * spacing * 0.46;
        const bx = tx + Math.cos(ang) * rad;
        const bz = tz + Math.sin(ang) * rad;

        // A tuft accepted on the verge can still scatter a blade onto the packed
        // surface. The baked field is bilinear, so near the shoulder the exact
        // road mask is consulted per blade and anything on the tread is dropped.
        if (terrain.samplePath(bx, bz) > 0.18 && terrain.pathMaskAt(bx, bz) > 0.55) continue;

        const by = terrain.sampleHeight(bx, bz) - 0.06;

        const jitter = lerp(0.78, 1.22, rng.next());
        let width = lerp(GRASS.width[0], GRASS.width[1], rng.next());
        let height = tuftHeight * jitter;
        let v = variant;
        let stiff = lerp(0.8, 1.2, rng.next()) * lerp(1.0, 1.35, lawn);
        let lean = (rng.next() - 0.5) * 0.34;

        if (isFlowerTuft) {
          v = rng.pick(FLOWER_VARIANTS);
          width = lerp(FLOWERS.width[0], FLOWERS.width[1], rng.next());
          height = lerp(GRASS.height[1] * 0.82, GRASS.height[1] * 1.25, rng.next());
          stiff *= 0.72;                     // stems bow further than blades
          lean *= 0.6;
        }

        builder.add(
          bx, by, bz,
          width, height,
          rng.next(), rng.next(),
          tintR, tintG, tintB, v,
          stiff, lean,
        );
      }
    }
  }

  const mesh = builder.build('meadow', terrain.half * 2.2);
  return { mesh, count: builder.count };
}

/**
 * A dense wall of tall blades. Used for the hedges that bound a puzzle: the
 * level's collision boundary and its silhouette are the same object.
 */
export function createHedgeField(cells, terrain, { seed = 4242, heightRange = [2.0, 3.1], density = 26 } = {}) {
  const builder = new BladeBuilder(cells.length * density + 16);
  const rng = new Rng(seed);
  for (const cell of cells) {
    const { x, z, size } = cell;
    for (let k = 0; k < density; k += 1) {
      const bx = x + (rng.next() - 0.5) * size * 1.02;
      const bz = z + (rng.next() - 0.5) * size * 1.02;
      const by = terrain.sampleHeight(bx, bz) - 0.05;
      // Blades near the tuft centre stand tallest, giving each hedge block a
      // rounded crown rather than a flat top.
      const toCentre = 1 - clamp(Math.hypot(bx - x, bz - z) / (size * 0.62), 0, 1);
      const height = lerp(heightRange[0], heightRange[1], rng.next()) * lerp(0.66, 1.0, toCentre);
      const variant = rng.next() < 0.18 ? GRASS_VARIANTS[2] : GRASS_VARIANTS[rng.next() < 0.5 ? 0 : 1];
      const shade = lerp(0.62, 1.0, toCentre);
      builder.add(
        bx, by, bz,
        lerp(0.34, 0.52, rng.next()),
        height,
        rng.next(), rng.next(),
        shade * 0.94, shade * 1.0, shade * 0.9,
        variant,
        lerp(0.55, 0.85, rng.next()),
        (rng.next() - 0.5) * 0.22,
      );
    }
  }
  return builder.build('hedges', 60);
}
