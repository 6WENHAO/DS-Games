/**
 * world/mesher.js
 * ------------------------------------------------------------------
 * Turns a padded block/light neighbourhood into GPU-ready vertex data.
 *
 * Runs inside the chunk worker. The main thread hands over an
 * 18 x 130 x 18 copy of the chunk (one block of margin on every side),
 * which is everything needed for face culling, ambient occlusion and
 * smooth lighting without further cross-chunk queries.
 *
 * Output is three interleaved vertex streams - opaque, cutout and
 * translucent - in the 20-byte layout documented in
 * gfx/shaders/chunk.js. Every quad is 4 vertices in a fixed winding, so
 * all chunks share one immutable index buffer.
 *
 * Greedy merging: cube faces whose four corners share identical ambient
 * occlusion and light values are merged into rectangles. Faces with
 * varying corner light are emitted individually, so smooth lighting
 * stays pixel-identical while large flat surfaces (open ground, cave
 * walls, ocean floors) collapse into a handful of quads.
 *
 * Coordinate conventions
 *   - a face is swept in "canonical" in-plane axes (i, j):
 *       X faces: i = Z, j = Y
 *       Y faces: i = X, j = Z
 *       Z faces: i = X, j = Y
 *   - vertices are emitted P0..P3 counter-clockwise seen from outside;
 *   - UVs are in 1/16-tile units, so 16 == one full tile.
 */

import {
  CHUNK_SIZE, WORLD_HEIGHT, PADDED_SIZE, paddedIndex, FACE, PASS, MODEL, TINT,
} from './constants.js';
import {
  IS_OPAQUE, MODEL_OF, PASS_OF, TINT_OF, SWAY_OF, LIQUID_HEIGHT,
  IS_LIQUID, blocks,
} from './blocks.js';
import { GRASS_TINTS, FOLIAGE_TINTS, WATER_TINTS, BIOMES } from './biomes.js';

/** Bytes per vertex; must match CHUNK_VERTEX_STRIDE in the shader module. */
export const STRIDE = 20;
const U32_PER_VERTEX = STRIDE / 4;   // 5
const U16_PER_VERTEX = STRIDE / 2;   // 10

/* ------------------------------------------------------------------ */
/* per-face tables                                                    */
/* ------------------------------------------------------------------ */

/**
 * For each face: outward normal, which world axis the normal runs along,
 * the canonical in-plane axis vectors, and the (di, dj) sign pairs for
 * vertices P0..P3 (used for ambient-occlusion neighbour lookups).
 */
const F = [
  { // 0 : +X east
    n: [1, 0, 0], axis: 0, offset: 1,
    iAxis: [0, 0, 1], jAxis: [0, 1, 0],
    signs: [[1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  { // 1 : -X west
    n: [-1, 0, 0], axis: 0, offset: 0,
    iAxis: [0, 0, 1], jAxis: [0, 1, 0],
    signs: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  },
  { // 2 : +Y up
    n: [0, 1, 0], axis: 1, offset: 1,
    iAxis: [1, 0, 0], jAxis: [0, 0, 1],
    signs: [[-1, -1], [-1, 1], [1, 1], [1, -1]],
  },
  { // 3 : -Y down
    n: [0, -1, 0], axis: 1, offset: 0,
    iAxis: [1, 0, 0], jAxis: [0, 0, 1],
    signs: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  },
  { // 4 : +Z south
    n: [0, 0, 1], axis: 2, offset: 1,
    iAxis: [1, 0, 0], jAxis: [0, 1, 0],
    signs: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  },
  { // 5 : -Z north
    n: [0, 0, -1], axis: 2, offset: 0,
    iAxis: [1, 0, 0], jAxis: [0, 1, 0],
    signs: [[1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
];

/**
 * World-space corner positions, in block units relative to the merged
 * rectangle's (i0, j0) origin, for vertices P0..P3. Expressed as
 * multipliers of (w, h) so a merged quad scales correctly.
 */
const CORNER_IJ = [
  [[1, 0], [0, 0], [0, 1], [1, 1]], // +X
  [[0, 0], [1, 0], [1, 1], [0, 1]], // -X
  [[0, 0], [0, 1], [1, 1], [1, 0]], // +Y
  [[0, 0], [1, 0], [1, 1], [0, 1]], // -Y
  [[0, 0], [1, 0], [1, 1], [0, 1]], // +Z
  [[1, 0], [0, 0], [0, 1], [1, 1]], // -Z
];

/**
 * UVs for P0..P3 in units of (w, h). Side faces flip vertically so the
 * texture is not upside down; the horizontal faces map straight onto
 * world X/Z as vanilla does.
 */
const CORNER_UV = [
  [[0, 1], [1, 1], [1, 0], [0, 0]], // +X (side)
  [[0, 1], [1, 1], [1, 0], [0, 0]], // -X (side)
  [[0, 0], [0, 1], [1, 1], [1, 0]], // +Y (top)
  [[0, 0], [1, 0], [1, 1], [0, 1]], // -Y (bottom)
  [[0, 1], [1, 1], [1, 0], [0, 0]], // +Z (side)
  [[0, 1], [1, 1], [1, 0], [0, 0]], // -Z (side)
];

/* ------------------------------------------------------------------ */
/* vertex sink                                                        */
/* ------------------------------------------------------------------ */

/** Growable interleaved vertex buffer for one render pass. */
class VertexSink {
  constructor(initialQuads = 1024) {
    this.quadCount = 0;
    this.vertexInQuad = 0;
    this.#alloc(initialQuads);
  }

  #alloc(quads) {
    const bytes = quads * 4 * STRIDE;
    const buffer = new ArrayBuffer(bytes);
    const old = this.u8;
    this.buffer = buffer;
    this.u8 = new Uint8Array(buffer);
    this.u16 = new Uint16Array(buffer);
    this.u32 = new Uint32Array(buffer);
    if (old) this.u8.set(old.subarray(0, Math.min(old.length, bytes)));
    this.capacityQuads = quads;
  }

  reset() { this.quadCount = 0; this.vertexInQuad = 0; }

  ensure(extraQuads) {
    if (this.quadCount + extraQuads <= this.capacityQuads) return;
    let next = Math.max(this.capacityQuads * 2, 64);
    while (this.quadCount + extraQuads > next) next *= 2;
    this.#alloc(next);
  }

  /**
   * Writes one vertex.
   * @param {number} px chunk-local position in 1/16-block units
   * @param {number} s  tile-space UV in 1/16-tile units
   * @param {number} meta packed layer/face/ao/light/flags word
   */
  vertex(px, py, pz, s, t, meta, r, g, b, a) {
    const vi = this.quadCount * 4 + this.vertexInQuad;
    this.u32[vi * U32_PER_VERTEX] = meta;
    const h = vi * U16_PER_VERTEX;
    this.u16[h + 2] = px;
    this.u16[h + 3] = py;
    this.u16[h + 4] = pz;
    this.u16[h + 5] = s;
    this.u16[h + 6] = t;
    const o = vi * STRIDE + 14;
    this.u8[o] = r; this.u8[o + 1] = g; this.u8[o + 2] = b; this.u8[o + 3] = a;
    if (++this.vertexInQuad === 4) { this.vertexInQuad = 0; this.quadCount++; }
  }

  /** Tightly-sized copy, ready to transfer to the main thread. */
  finish() {
    const bytes = this.quadCount * 4 * STRIDE;
    const out = new ArrayBuffer(bytes);
    new Uint8Array(out).set(this.u8.subarray(0, bytes));
    return { buffer: out, quadCount: this.quadCount };
  }
}

/* ------------------------------------------------------------------ */
/* packing                                                            */
/* ------------------------------------------------------------------ */

const FLAG_SWAY = 1;
const FLAG_FLAT = 2;
const FLAG_LIQUID_SURFACE = 16;

/** Packs the per-vertex meta word (see gfx/shaders/chunk.js). */
const packMeta = (layer, face, ao, sky, block, flags) => (
  (layer & 0xfff)
  | ((face & 0x7) << 12)
  | ((ao & 0x3) << 15)
  | ((sky & 0xf) << 17)
  | ((block & 0xf) << 21)
  | ((flags & 0x1f) << 25)
) >>> 0;

/** Vanilla-style corner occlusion from the three neighbouring voxels. */
const vertexAO = (side1, side2, corner) => (side1 && side2 ? 0 : 3 - (side1 + side2 + corner));

/* ------------------------------------------------------------------ */
/* mesher                                                            */
/* ------------------------------------------------------------------ */

/**
 * Texture layer indices resolved by the main thread after the array
 * texture is built, then shipped to the worker once.
 * @typedef {object} LayerTable
 * @property {Int16Array} faceLayers      blockCount * 6 layer indices
 * @property {Int16Array} grassSideLayers per-biome grass side layers
 * @property {number}     snowSideLayer
 * @property {Uint8Array} animGroups      per-block animation group id
 */

export class ChunkMesher {
  /** @param {LayerTable} layerTable */
  constructor(layerTable) {
    this.setLayerTable(layerTable);
    this.sinks = [new VertexSink(4096), new VertexSink(1024), new VertexSink(1024)];

    const maxSlice = CHUNK_SIZE * WORLD_HEIGHT;
    this.maskKey = new Int32Array(maxSlice);
    this.maskLayer = new Int32Array(maxSlice);
    this.maskTint = new Int32Array(maxSlice);
    this.maskC01 = new Int32Array(maxSlice);
    this.maskC23 = new Int32Array(maxSlice);
    this.maskBlock = new Uint16Array(maxSlice);
    this.corners = new Int32Array(4);
    this.tint = new Uint8Array(3);
  }

  setLayerTable(layerTable) {
    this.layers = layerTable;
    this.animGroups = layerTable.animGroups;
  }

  /**
   * @param {{blocks: Uint16Array, light: Uint8Array, biomes: Uint8Array}} job
   */
  mesh(job) {
    this.vox = job.blocks;
    this.lightData = job.light;
    this.biomeData = job.biomes;
    for (const s of this.sinks) s.reset();

    for (let face = 0; face < 6; face++) this.#sweepFace(face);
    this.#meshNonCubes();

    return {
      opaque: this.sinks[PASS.OPAQUE].finish(),
      cutout: this.sinks[PASS.CUTOUT].finish(),
      translucent: this.sinks[PASS.TRANSLUCENT].finish(),
    };
  }

  /* ---------------- data access ---------------------------------- */

  /** Block id at chunk-local coordinates (the -1..16 margin is valid). */
  at(x, y, z) {
    if (y < -1 || y > WORLD_HEIGHT) return 0;
    return this.vox[paddedIndex(x, y, z)];
  }

  /** Packed light byte: (sky << 4) | block. Above the world = full sky. */
  lightAt(x, y, z) {
    if (y > WORLD_HEIGHT) return 0xf0;
    if (y < -1) return 0;
    return this.lightData[paddedIndex(x, y, z)];
  }

  biomeAt(x, z) {
    const px = (x < -1 ? -1 : x > CHUNK_SIZE ? CHUNK_SIZE : x) + 1;
    const pz = (z < -1 ? -1 : z > CHUNK_SIZE ? CHUNK_SIZE : z) + 1;
    return this.biomeData[pz * PADDED_SIZE + px];
  }

  /**
   * Should the face between `id` and `neighbour` be drawn?
   * Opaque neighbours always hide a face. Identical see-through blocks
   * hide each other unless the block opts out - leaves keep their inner
   * faces so canopies stay dense, matching vanilla's fancy graphics.
   */
  #faceVisible(id, neighbour) {
    if (IS_OPAQUE[neighbour]) return false;
    if (neighbour === id) return blocks[id].cullSame === false;
    if (IS_LIQUID[id] && IS_LIQUID[neighbour]) return false;
    return true;
  }

  /** Texture layer for one face, honouring per-biome grass variants. */
  #layerFor(id, face, lx, lz) {
    const d = blocks[id];
    if (d.sideVariant === 'grass' && face !== FACE.UP && face !== FACE.DOWN) {
      const biomeId = this.biomeAt(lx, lz);
      if (BIOMES[biomeId]?.snowy && this.layers.snowSideLayer >= 0) return this.layers.snowSideLayer;
      const variant = this.layers.grassSideLayers[biomeId];
      if (variant >= 0) return variant;
    }
    return this.layers.faceLayers[id * 6 + face];
  }

  /** Writes biome tint bytes for a block face into `this.tint`. */
  #tintFor(id, lx, lz) {
    const t = this.tint;
    const kind = TINT_OF[id];
    if (kind === TINT.NONE) { t[0] = 255; t[1] = 255; t[2] = 255; return; }
    const biomeId = this.biomeAt(lx, lz);
    const table = kind === TINT.GRASS ? GRASS_TINTS
      : kind === TINT.FOLIAGE ? FOLIAGE_TINTS : WATER_TINTS;
    const o = biomeId * 3;
    t[0] = (table[o] * 255) | 0;
    t[1] = (table[o + 1] * 255) | 0;
    t[2] = (table[o + 2] * 255) | 0;
  }

  /* ---------------- cube face sweep ------------------------------ */

  /**
   * Builds a face mask for every slice perpendicular to `face`, merges
   * equal-descriptor rectangles, then emits them.
   */
  #sweepFace(face) {
    const f = F[face];
    const nx = f.n[0]; const ny = f.n[1]; const nz = f.n[2];
    const sliceAxis = f.axis;
    const sliceCount = sliceAxis === 1 ? WORLD_HEIGHT : CHUNK_SIZE;
    const iExtent = sliceAxis === 0 ? CHUNK_SIZE : CHUNK_SIZE;             // i is always horizontal
    const jExtent = sliceAxis === 1 ? CHUNK_SIZE : WORLD_HEIGHT;           // j is Y except on Y faces

    const { maskKey, maskLayer, maskTint, maskC01, maskC23, maskBlock } = this;

    for (let slice = 0; slice < sliceCount; slice++) {
      maskKey.fill(0, 0, iExtent * jExtent);
      let any = false;

      for (let j = 0; j < jExtent; j++) {
        for (let i = 0; i < iExtent; i++) {
          let x; let y; let z;
          if (sliceAxis === 0) { x = slice; z = i; y = j; }
          else if (sliceAxis === 1) { y = slice; x = i; z = j; }
          else { z = slice; x = i; y = j; }

          const id = this.at(x, y, z);
          if (id === 0 || MODEL_OF[id] !== MODEL.CUBE) continue;
          if (!this.#faceVisible(id, this.at(x + nx, y + ny, z + nz))) continue;

          const uniform = this.#faceInfo(face, x, y, z);
          const layer = this.#layerFor(id, face, x, z);
          this.#tintFor(id, x, z);
          const mi = j * iExtent + i;
          const c = this.corners;
          maskLayer[mi] = layer;
          maskTint[mi] = (this.tint[0] << 16) | (this.tint[1] << 8) | this.tint[2];
          maskC01[mi] = (c[0] & 0x3ff) | ((c[1] & 0x3ff) << 10);
          maskC23[mi] = (c[2] & 0x3ff) | ((c[3] & 0x3ff) << 10);
          maskBlock[mi] = id;
          // Merge key: only uniformly-lit faces get a positive (shared)
          // key. Everything else gets a unique negative key.
          maskKey[mi] = uniform
            ? (1 | ((layer & 0xfff) << 1) | ((c[0] & 0x3ff) << 13) | ((this.biomeAt(x, z) & 0x1f) << 23))
            : -(mi + 2);
          any = true;
        }
      }
      if (!any) continue;

      for (let j = 0; j < jExtent; j++) {
        for (let i = 0; i < iExtent;) {
          const mi = j * iExtent + i;
          const key = maskKey[mi];
          if (key === 0) { i++; continue; }

          let w = 1;
          let h = 1;
          if (key > 0) {
            while (i + w < iExtent && maskKey[mi + w] === key) w++;
            grow: while (j + h < jExtent) {
              const row = (j + h) * iExtent + i;
              for (let k = 0; k < w; k++) if (maskKey[row + k] !== key) break grow;
              h++;
            }
          }

          this.#emitFace(face, slice, i, j, w, h, maskBlock[mi], maskLayer[mi], maskTint[mi], maskC01[mi], maskC23[mi]);

          for (let dj = 0; dj < h; dj++) {
            const row = (j + dj) * iExtent + i;
            for (let di = 0; di < w; di++) maskKey[row + di] = 0;
          }
          i += w;
        }
      }
    }
  }

  /**
   * Computes ambient occlusion and smooth light for the four corners of
   * one block face into `this.corners`.
   * @returns {boolean} true when all four corners are identical (mergeable)
   */
  #faceInfo(face, x, y, z) {
    const f = F[face];
    const fx = x + f.n[0]; const fy = y + f.n[1]; const fz = z + f.n[2];
    const ix = f.iAxis[0]; const iy = f.iAxis[1]; const iz = f.iAxis[2];
    const jx = f.jAxis[0]; const jy = f.jAxis[1]; const jz = f.jAxis[2];
    const signs = f.signs;
    const out = this.corners;
    let uniform = true;

    for (let c = 0; c < 4; c++) {
      const si = signs[c][0]; const sj = signs[c][1];
      const ax = fx + ix * si; const ay = fy + iy * si; const az = fz + iz * si;
      const bx = fx + jx * sj; const by = fy + jy * sj; const bz = fz + jz * sj;
      const cx = ax + jx * sj; const cy = ay + jy * sj; const cz = az + jz * sj;

      const s1 = IS_OPAQUE[this.at(ax, ay, az)] ? 1 : 0;
      const s2 = IS_OPAQUE[this.at(bx, by, bz)] ? 1 : 0;
      const co = IS_OPAQUE[this.at(cx, cy, cz)] ? 1 : 0;
      const ao = vertexAO(s1, s2, co);

      // Smooth lighting: mean of the transparent cells touching this corner.
      let skySum = 0; let blkSum = 0; let n = 0;
      let l = this.lightAt(fx, fy, fz);
      skySum += (l >> 4) & 15; blkSum += l & 15; n++;
      if (!s1) { l = this.lightAt(ax, ay, az); skySum += (l >> 4) & 15; blkSum += l & 15; n++; }
      if (!s2) { l = this.lightAt(bx, by, bz); skySum += (l >> 4) & 15; blkSum += l & 15; n++; }
      if (!co && !(s1 && s2)) { l = this.lightAt(cx, cy, cz); skySum += (l >> 4) & 15; blkSum += l & 15; n++; }

      const sky = (skySum / n + 0.5) | 0;
      const blk = (blkSum / n + 0.5) | 0;
      out[c] = (ao & 3) | ((sky & 15) << 2) | ((blk & 15) << 6);
      if (c > 0 && out[c] !== out[0]) uniform = false;
    }
    return uniform;
  }

  /** Emits one (possibly merged) rectangular cube face. */
  #emitFace(face, slice, i0, j0, w, h, id, layer, tintPacked, c01, c23) {
    const f = F[face];
    const d = blocks[id];
    const sink = this.sinks[PASS_OF[id]];
    sink.ensure(1);

    const corners = [c01 & 0x3ff, (c01 >> 10) & 0x3ff, c23 & 0x3ff, (c23 >> 10) & 0x3ff];
    const r = (tintPacked >> 16) & 255;
    const g = (tintPacked >> 8) & 255;
    const b = tintPacked & 255;
    const sway = SWAY_OF[id];
    let flags = 0;
    if (sway > 0) flags |= FLAG_SWAY;
    if (d.flatShade) flags |= FLAG_FLAT;
    flags |= (this.animGroups[id] & 3) << 2;

    // Rectangle origin in block coordinates.
    let ox; let oy; let oz;
    if (f.axis === 0) { ox = slice + f.offset; oz = i0; oy = j0; }
    else if (f.axis === 1) { oy = slice + f.offset; ox = i0; oz = j0; }
    else { oz = slice + f.offset; ox = i0; oy = j0; }

    const ij = CORNER_IJ[face];
    const uv = CORNER_UV[face];
    for (let c = 0; c < 4; c++) {
      const ai = ij[c][0] * w; const aj = ij[c][1] * h;
      const px = (ox + f.iAxis[0] * ai + f.jAxis[0] * aj) * 16;
      const py = (oy + f.iAxis[1] * ai + f.jAxis[1] * aj) * 16;
      const pz = (oz + f.iAxis[2] * ai + f.jAxis[2] * aj) * 16;
      const s = uv[c][0] * w * 16;
      const t = uv[c][1] * h * 16;
      const packed = corners[c];
      const meta = packMeta(layer, face, packed & 3, (packed >> 2) & 15, (packed >> 6) & 15, flags);
      sink.vertex(px, py, pz, s, t, meta, r, g, b, sway);
    }
  }

  /* ---------------- non-cube models ------------------------------ */

  /** Cross plants, torches and liquids, emitted one block at a time. */
  #meshNonCubes() {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.at(x, y, z);
          if (id === 0) continue;
          const model = MODEL_OF[id];
          if (model === MODEL.CUBE || model === MODEL.AIR) continue;
          this.#tintFor(id, x, z);
          if (model === MODEL.CROSS) this.#emitCross(id, x, y, z);
          else if (model === MODEL.TORCH) this.#emitTorch(id, x, y, z);
          else if (model === MODEL.LIQUID) this.#emitLiquid(id, x, y, z);
        }
      }
    }
  }

  /**
   * Two crossed quads, each emitted with both windings so plants are
   * visible from every angle while back-face culling stays enabled.
   */
  #emitCross(id, x, y, z) {
    const sink = this.sinks[PASS_OF[id]];
    sink.ensure(4);
    const layer = this.layers.faceLayers[id * 6 + FACE.UP];
    const l = this.lightAt(x, y, z);
    const sky = (l >> 4) & 15; const blk = l & 15;
    const sway = SWAY_OF[id];
    const flags = (sway > 0 ? FLAG_SWAY : 0) | FLAG_FLAT | ((this.animGroups[id] & 3) << 2);
    const meta = packMeta(layer, FACE.UP, 3, sky, blk, flags);
    const r = this.tint[0]; const g = this.tint[1]; const b = this.tint[2];

    const lo = 2; const hi = 14; const top = 16;
    const bx = x * 16; const by = y * 16; const bz = z * 16;
    const q = (x0, z0, x1, z1) => {
      this.#quad(sink, meta, r, g, b, sway,
        bx + x0, by, bz + z0, 0, 16,
        bx + x1, by, bz + z1, 16, 16,
        bx + x1, by + top, bz + z1, 16, 0,
        bx + x0, by + top, bz + z0, 0, 0);
    };
    q(lo, lo, hi, hi); q(hi, hi, lo, lo);   // plane A, both sides
    q(hi, lo, lo, hi); q(lo, hi, hi, lo);   // plane B, both sides
  }

  /** A 2x10x2 post using vanilla's torch UV window, plus its lit top. */
  #emitTorch(id, x, y, z) {
    const sink = this.sinks[PASS_OF[id]];
    sink.ensure(5);
    const layer = this.layers.faceLayers[id * 6 + FACE.UP];
    const l = this.lightAt(x, y, z);
    const sky = (l >> 4) & 15; const blk = l & 15;
    const bx = x * 16; const by = y * 16; const bz = z * 16;
    const a = 7; const e = 9; const top = 10;
    const su0 = 7; const su1 = 9; const sv0 = 6; const sv1 = 16;
    const m = (face, light) => packMeta(layer, face, 3, sky, light ?? blk, FLAG_FLAT);

    this.#quad(sink, m(FACE.NORTH), 255, 255, 255, 0,
      bx + e, by, bz + a, su0, sv1, bx + a, by, bz + a, su1, sv1,
      bx + a, by + top, bz + a, su1, sv0, bx + e, by + top, bz + a, su0, sv0);
    this.#quad(sink, m(FACE.SOUTH), 255, 255, 255, 0,
      bx + a, by, bz + e, su0, sv1, bx + e, by, bz + e, su1, sv1,
      bx + e, by + top, bz + e, su1, sv0, bx + a, by + top, bz + e, su0, sv0);
    this.#quad(sink, m(FACE.WEST), 255, 255, 255, 0,
      bx + a, by, bz + a, su0, sv1, bx + a, by, bz + e, su1, sv1,
      bx + a, by + top, bz + e, su1, sv0, bx + a, by + top, bz + a, su0, sv0);
    this.#quad(sink, m(FACE.EAST), 255, 255, 255, 0,
      bx + e, by, bz + e, su0, sv1, bx + e, by, bz + a, su1, sv1,
      bx + e, by + top, bz + a, su1, sv0, bx + e, by + top, bz + e, su0, sv0);
    this.#quad(sink, m(FACE.UP, Math.max(blk, 13)), 255, 255, 255, 0,
      bx + a, by + top, bz + a, su0, sv0, bx + a, by + top, bz + e, su0, sv0 + 2,
      bx + e, by + top, bz + e, su1, sv0 + 2, bx + e, by + top, bz + a, su1, sv0);
  }

  /**
   * Liquid surface + sides. The surface sits 1/8 of a block low unless
   * the same liquid is above, producing vanilla's stepped shoreline.
   */
  #emitLiquid(id, x, y, z) {
    const sink = this.sinks[PASS_OF[id]];
    const layer = this.layers.faceLayers[id * 6 + FACE.UP];
    const anim = (this.animGroups[id] & 3) << 2;
    const r = this.tint[0]; const g = this.tint[1]; const b = this.tint[2];
    const above = this.at(x, y + 1, z);
    const sameAbove = above === id;
    const height = sameAbove ? 16 : LIQUID_HEIGHT[id];
    const bx = x * 16; const by = y * 16; const bz = z * 16;
    const l = this.lightAt(x, y, z);
    const sky = (l >> 4) & 15; const blk = l & 15;

    if (!sameAbove && !IS_OPAQUE[above]) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.UP, 3, sky, blk, anim | FLAG_LIQUID_SURFACE);
      this.#quad(sink, meta, r, g, b, 0,
        bx, by + height, bz, 0, 0,
        bx, by + height, bz + 16, 0, 16,
        bx + 16, by + height, bz + 16, 16, 16,
        bx + 16, by + height, bz, 16, 0);
    }

    const below = this.at(x, y - 1, z);
    if (below !== id && !IS_OPAQUE[below]) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.DOWN, 3, sky, blk, anim);
      this.#quad(sink, meta, r, g, b, 0,
        bx, by, bz, 0, 0,
        bx + 16, by, bz, 16, 0,
        bx + 16, by, bz + 16, 16, 16,
        bx, by, bz + 16, 0, 16);
    }

    const vTop = 16 - height;
    // north (-Z)
    if (this.#liquidSideVisible(id, x, y, z - 1)) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.NORTH, 3, sky, blk, anim);
      this.#quad(sink, meta, r, g, b, 0,
        bx + 16, by, bz, 0, 16, bx, by, bz, 16, 16,
        bx, by + height, bz, 16, vTop, bx + 16, by + height, bz, 0, vTop);
    }
    // south (+Z)
    if (this.#liquidSideVisible(id, x, y, z + 1)) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.SOUTH, 3, sky, blk, anim);
      this.#quad(sink, meta, r, g, b, 0,
        bx, by, bz + 16, 0, 16, bx + 16, by, bz + 16, 16, 16,
        bx + 16, by + height, bz + 16, 16, vTop, bx, by + height, bz + 16, 0, vTop);
    }
    // west (-X)
    if (this.#liquidSideVisible(id, x - 1, y, z)) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.WEST, 3, sky, blk, anim);
      this.#quad(sink, meta, r, g, b, 0,
        bx, by, bz, 0, 16, bx, by, bz + 16, 16, 16,
        bx, by + height, bz + 16, 16, vTop, bx, by + height, bz, 0, vTop);
    }
    // east (+X)
    if (this.#liquidSideVisible(id, x + 1, y, z)) {
      sink.ensure(1);
      const meta = packMeta(layer, FACE.EAST, 3, sky, blk, anim);
      this.#quad(sink, meta, r, g, b, 0,
        bx + 16, by, bz + 16, 0, 16, bx + 16, by, bz, 16, 16,
        bx + 16, by + height, bz, 16, vTop, bx + 16, by + height, bz + 16, 0, vTop);
    }
  }

  #liquidSideVisible(id, x, y, z) {
    const n = this.at(x, y, z);
    return n !== id && !IS_OPAQUE[n];
  }

  /**
   * Emits four vertices as one quad.
   * UV arguments are in 1/16-tile units (16 == one full tile).
   */
  #quad(sink, meta, r, g, b, a,
    x0, y0, z0, s0, t0,
    x1, y1, z1, s1, t1,
    x2, y2, z2, s2, t2,
    x3, y3, z3, s3, t3) {
    sink.vertex(x0, y0, z0, s0, t0, meta, r, g, b, a);
    sink.vertex(x1, y1, z1, s1, t1, meta, r, g, b, a);
    sink.vertex(x2, y2, z2, s2, t2, meta, r, g, b, a);
    sink.vertex(x3, y3, z3, s3, t3, meta, r, g, b, a);
  }
}
