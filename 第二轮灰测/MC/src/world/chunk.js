/**
 * world/chunk.js
 * ------------------------------------------------------------------
 * Storage for one 16 x 128 x 16 chunk column.
 *
 * Layout choices
 *  - `blocks` is a Uint16Array so the registry can grow past 255 ids
 *    without a separate metadata plane;
 *  - `light` packs sky light in the high nibble and block light in the
 *    low nibble of one byte, which is how the mesher reads it;
 *  - `heightMap` caches the highest light-blocking block per column so
 *    sky-light recalculation after an edit stays O(column).
 */

import {
  CHUNK_SIZE, WORLD_HEIGHT, CHUNK_VOLUME, localIndex,
} from './constants.js';
import { LIGHT_FILTER } from './blocks.js';

/** Lifecycle of a chunk as it moves through the pipeline. */
export const CHUNK_STATE = {
  EMPTY: 0,
  GENERATING: 1,
  GENERATED: 2,
  LIT: 3,
  MESHING: 4,
  READY: 5,
};

/** Packs chunk coordinates into a single Map key. */
export const chunkKey = (cx, cz) => (cx + 0x8000) * 0x10000 + (cz + 0x8000);

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
    this.originX = cx * CHUNK_SIZE;
    this.originZ = cz * CHUNK_SIZE;

    this.blocks = new Uint16Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    /** Terrain surface height from the generator. */
    this.heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    /** Highest light-blocking block per column, -1 when the column is clear. */
    this.heightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE).fill(-1);

    this.state = CHUNK_STATE.EMPTY;
    /** Needs a mesh rebuild. */
    this.dirty = false;
    /** Mesh rebuild requested but a neighbour is still missing. */
    this.meshPending = false;
    /** GPU meshes per pass; filled by the renderer. */
    this.meshes = { opaque: null, cutout: null, translucent: null };
    /** Set when the player has edited this chunk (drives world saving). */
    this.modified = false;
    /** Monotonic counter so stale worker results can be discarded. */
    this.revision = 0;
  }

  /* ---------------- block access --------------------------------- */

  getBlock(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blocks[localIndex(lx, y, lz)];
  }

  setBlock(lx, y, lz, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[localIndex(lx, y, lz)] = id;
  }

  /* ---------------- light access --------------------------------- */

  getLight(lx, y, lz) {
    if (y < 0) return 0;
    if (y >= WORLD_HEIGHT) return 0xf0;
    return this.light[localIndex(lx, y, lz)];
  }

  getSkyLight(lx, y, lz) {
    if (y >= WORLD_HEIGHT) return 15;
    if (y < 0) return 0;
    return (this.light[localIndex(lx, y, lz)] >> 4) & 15;
  }

  getBlockLight(lx, y, lz) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.light[localIndex(lx, y, lz)] & 15;
  }

  setSkyLight(lx, y, lz, level) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const i = localIndex(lx, y, lz);
    this.light[i] = (this.light[i] & 0x0f) | ((level & 15) << 4);
  }

  setBlockLight(lx, y, lz, level) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const i = localIndex(lx, y, lz);
    this.light[i] = (this.light[i] & 0xf0) | (level & 15);
  }

  /* ---------------- height map ----------------------------------- */

  /**
   * Recomputes the cached top light-blocker for one column.
   * @returns {number} the new height (-1 when nothing blocks light)
   */
  recomputeColumnHeight(lx, lz) {
    const ci = lz * CHUNK_SIZE + lx;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (LIGHT_FILTER[this.blocks[localIndex(lx, y, lz)]] > 0) {
        this.heightMap[ci] = y;
        return y;
      }
    }
    this.heightMap[ci] = -1;
    return -1;
  }

  /** Rebuilds the whole height map (after generation or loading). */
  recomputeHeightMap() {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) this.recomputeColumnHeight(lx, lz);
    }
  }

  /** Highest solid block in a column, for spawn and entity placement. */
  topSolid(lx, lz) {
    return this.heightMap[lz * CHUNK_SIZE + lx];
  }

  biomeAt(lx, lz) {
    return this.biomes[lz * CHUNK_SIZE + lx];
  }

  /* ---------------- serialisation -------------------------------- */

  /**
   * Compact form for IndexedDB. Blocks are run-length encoded, which
   * shrinks a typical column from 64 KB to a few hundred bytes.
   */
  serialise() {
    const runs = [];
    let prev = this.blocks[0];
    let count = 0;
    for (let i = 0; i < CHUNK_VOLUME; i++) {
      const v = this.blocks[i];
      if (v === prev && count < 0xffff) { count++; continue; }
      runs.push(prev, count);
      prev = v; count = 1;
    }
    runs.push(prev, count);
    return {
      cx: this.cx,
      cz: this.cz,
      version: 1,
      runs: new Uint16Array(runs),
      biomes: this.biomes.slice(),
      heights: this.heights.slice(),
    };
  }

  /** Restores block data produced by `serialise`. */
  deserialise(record) {
    const runs = record.runs;
    let i = 0;
    for (let r = 0; r < runs.length; r += 2) {
      const value = runs[r];
      const count = runs[r + 1];
      this.blocks.fill(value, i, i + count);
      i += count;
    }
    if (record.biomes) this.biomes.set(record.biomes);
    if (record.heights) this.heights.set(record.heights);
    this.recomputeHeightMap();
    this.state = CHUNK_STATE.GENERATED;
    this.modified = true;
    return this;
  }

  /** Releases GPU resources. */
  disposeMeshes(gl) {
    for (const key of ['opaque', 'cutout', 'translucent']) {
      const mesh = this.meshes[key];
      if (!mesh) continue;
      if (mesh.vao) gl.deleteVertexArray(mesh.vao);
      if (mesh.vbo) gl.deleteBuffer(mesh.vbo);
      this.meshes[key] = null;
    }
  }
}
