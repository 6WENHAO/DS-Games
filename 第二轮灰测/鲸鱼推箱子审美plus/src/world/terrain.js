/**
 * Terrain.
 *
 * Height is the sum of three noise octaves plus a ridged rim that lifts the
 * outskirts into hills, closing the basin so the world has no visible edge. The
 * road is then graded into the surface (a smoothed longitudinal profile plus a
 * shallow trench) and the garden plot is levelled flat for the puzzle grid.
 *
 * Exact evaluation is used for the mesh; everything else (grass scattering, tree
 * placement, gameplay queries) reads a baked 1 metre field, which keeps ~100k
 * lookups inside a few milliseconds.
 */
import * as THREE from 'three';
import { WORLD, LAWN } from '../core/config.js';
import { fbm2, ridged2, smoothstep, lerp, clamp } from './noise.js';
import { createRoad } from './path.js';
import { PLOT } from './plot.js';
import { createGroundMaterial } from '../gfx/groundMaterial.js';

/** Bilinearly sampled scalar field on a regular grid. */
export class Field2D {
  constructor(size, step) {
    this.size = size;
    this.step = step;
    this.half = size * 0.5;
    this.n = Math.round(size / step) + 1;
    this.data = new Float32Array(this.n * this.n);
  }

  fill(fn) {
    const { n, step, half } = this;
    for (let j = 0; j < n; j += 1) {
      const z = -half + j * step;
      for (let i = 0; i < n; i += 1) {
        this.data[j * n + i] = fn(-half + i * step, z);
      }
    }
    return this;
  }

  sample(x, z) {
    const { n, step, half } = this;
    const fx = clamp((x + half) / step, 0, n - 1.0001);
    const fz = clamp((z + half) / step, 0, n - 1.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const d = this.data;
    const a = d[j * n + i];
    const b = d[j * n + i + 1];
    const c = d[(j + 1) * n + i];
    const e = d[(j + 1) * n + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, e, tx), tz);
  }
}

export function createTerrain() {
  const size = WORLD.size;
  const half = size * 0.5;
  const seed = WORLD.seed;

  /** Undulation before any grading. */
  function baseHeight(x, z) {
    let h = (fbm2(x * 0.0125, z * 0.0125, { seed, octaves: 4 }) - 0.5) * 11.5;
    h += (fbm2(x * 0.045, z * 0.045, { seed: seed + 7, octaves: 3 }) - 0.5) * 2.7;
    h += (fbm2(x * 0.17, z * 0.17, { seed: seed + 19, octaves: 2 }) - 0.5) * 0.6;

    // Ridged rim: hills close the horizon so the terrain never runs out.
    const r = Math.hypot(x, z);
    const rim = smoothstep(52, 88, r);
    h += rim * (7.5 + ridged2(x * 0.021, z * 0.021, { seed: seed + 3, octaves: 4 }) * 13.0);
    return h;
  }

  const road = createRoad(size);
  road.bakeProfile(baseHeight, 30);

  // Plot height follows the local ground so the verge transition stays gentle.
  const plotHeight = Math.round(baseHeight(LAWN.center.x, LAWN.center.z) * 4) / 4;
  PLOT.setHeight(plotHeight);

  /** Levelling mask for the plot, evaluated in the plot's own rotated frame. */
  function lawnMask(x, z) {
    return 1 - smoothstep(0, LAWN.border, PLOT.edgeDistance(x, z));
  }

  function roadInfo(x, z) {
    const n = road.nearest(x, z);
    if (!isFinite(n.dist)) return null;
    const hw = road.halfWidthAt(n.t, x, z);
    return { n, hw };
  }

  function heightAt(x, z) {
    let h = baseHeight(x, z);

    const info = roadInfo(x, z);
    if (info) {
      const { n, hw } = info;
      const grade = 1 - smoothstep(hw * 0.85, hw * 3.4, n.dist);
      h = lerp(h, road.heightAtIndex(n.index), grade * 0.94);
      const trench = (1 - smoothstep(hw * 0.3, hw * 1.1, n.dist)) * 0.17;
      h -= trench;
    }

    const lm = lawnMask(x, z);
    if (lm > 0) h = lerp(h, plotHeight, lm);
    return h;
  }

  function pathMaskAt(x, z) {
    const info = roadInfo(x, z);
    if (!info) return 0;
    return 1 - smoothstep(info.hw * 0.62, info.hw * 1.3, info.n.dist);
  }

  // Baked fields for the bulk consumers.
  const heightField = new Field2D(size + 24, 1.0).fill(heightAt);
  const pathField = new Field2D(size + 24, 1.0).fill(pathMaskAt);
  const lawnField = new Field2D(size + 24, 1.0).fill(lawnMask);

  const sampleHeight = (x, z) => heightField.sample(x, z);
  const samplePath = (x, z) => pathField.sample(x, z);
  const sampleLawn = (x, z) => lawnField.sample(x, z);

  /* ---------------- mesh ---------------- */
  const seg = WORLD.segments;
  const vertCount = (seg + 1) * (seg + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const aPath = new Float32Array(vertCount);
  const aLawn = new Float32Array(vertCount);
  const aShade = new Float32Array(vertCount);
  const stepSize = size / seg;

  for (let j = 0; j <= seg; j += 1) {
    const z = -half + j * stepSize;
    for (let i = 0; i <= seg; i += 1) {
      const x = -half + i * stepSize;
      const idx = j * (seg + 1) + i;
      const y = heightAt(x, z);
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = i / seg;
      uvs[idx * 2 + 1] = j / seg;
      aPath[idx] = pathMaskAt(x, z);
      aLawn[idx] = lawnMask(x, z);
    }
  }

  // Normals from the vertex lattice (central differences on the grid).
  const heightOf = (i, j) => {
    const ci = clamp(i, 0, seg);
    const cj = clamp(j, 0, seg);
    return positions[(cj * (seg + 1) + ci) * 3 + 1];
  };
  const nrm = new THREE.Vector3();
  for (let j = 0; j <= seg; j += 1) {
    for (let i = 0; i <= seg; i += 1) {
      const idx = j * (seg + 1) + i;
      const dhx = (heightOf(i + 1, j) - heightOf(i - 1, j)) / (2 * stepSize);
      const dhz = (heightOf(i, j + 1) - heightOf(i, j - 1)) / (2 * stepSize);
      nrm.set(-dhx, 1, -dhz).normalize();
      normals[idx * 3] = nrm.x;
      normals[idx * 3 + 1] = nrm.y;
      normals[idx * 3 + 2] = nrm.z;
    }
  }

  const indices = new Uint32Array(seg * seg * 6);
  let ptr = 0;
  for (let j = 0; j < seg; j += 1) {
    for (let i = 0; i < seg; i += 1) {
      const a = j * (seg + 1) + i;
      const b = a + 1;
      const c = a + (seg + 1);
      const d = c + 1;
      indices[ptr] = a; indices[ptr + 1] = c; indices[ptr + 2] = b;
      indices[ptr + 3] = b; indices[ptr + 4] = c; indices[ptr + 5] = d;
      ptr += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aPath', new THREE.BufferAttribute(aPath, 1));
  geometry.setAttribute('aLawn', new THREE.BufferAttribute(aLawn, 1));
  geometry.setAttribute('aShade', new THREE.BufferAttribute(aShade, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  const material = createGroundMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  /**
   * Bakes soft contact shadows under canopies and prop clusters into the
   * terrain's aShade attribute. Called after the trees are placed.
   * @param {{x:number,z:number,radius:number,strength:number}[]} circles
   */
  function applyShade(circles) {
    const attr = geometry.getAttribute('aShade');
    const arr = attr.array;
    arr.fill(0);
    for (const c of circles) {
      const rad = c.radius;
      const i0 = Math.max(0, Math.floor((c.x - rad + half) / stepSize));
      const i1 = Math.min(seg, Math.ceil((c.x + rad + half) / stepSize));
      const j0 = Math.max(0, Math.floor((c.z - rad + half) / stepSize));
      const j1 = Math.min(seg, Math.ceil((c.z + rad + half) / stepSize));
      for (let j = j0; j <= j1; j += 1) {
        const z = -half + j * stepSize;
        for (let i = i0; i <= i1; i += 1) {
          const x = -half + i * stepSize;
          const d = Math.hypot(x - c.x, z - c.z);
          if (d > rad) continue;
          const f = (1 - smoothstep(rad * 0.25, rad, d)) * c.strength;
          const idx = j * (seg + 1) + i;
          arr[idx] = Math.min(1, arr[idx] + f);
        }
      }
    }
    attr.needsUpdate = true;
  }

  const lawn = {
    center: LAWN.center.clone().setY(plotHeight),
    height: plotHeight,
    halfW: LAWN.halfW,
    halfD: LAWN.halfD,
    tile: LAWN.tile,
    plot: PLOT,
  };

  return {
    mesh,
    material,
    road,
    size,
    half,
    lawn,
    baseHeight,
    heightAt,
    pathMaskAt,
    lawnMask,
    sampleHeight,
    samplePath,
    sampleLawn,
    applyShade,
  };
}
