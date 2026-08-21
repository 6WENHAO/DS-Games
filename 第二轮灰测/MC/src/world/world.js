/**
 * world/world.js
 * ------------------------------------------------------------------
 * The chunk manager: owns loaded chunks, drives terrain generation and
 * meshing through the worker pool, runs the light engine and exposes
 * block access in world coordinates.
 *
 * Pipeline for one chunk
 *   1. requested        - inside the render distance, not loaded yet
 *   2. GENERATED        - terrain data arrived from a worker
 *   3. seeded           - the light engine has queued its initial light
 *   4. meshable         - all eight neighbours are GENERATED
 *   5. READY            - a worker returned vertex data and the renderer
 *                         uploaded it
 *
 * Work per frame is budgeted: a fixed number of generation requests,
 * light-propagation steps and mesh uploads, so loading terrain never
 * causes a long frame.
 */

import {
  CHUNK_SIZE, WORLD_HEIGHT, PADDED_SIZE, PADDED_VOLUME, paddedIndex,
  localIndex, SEA_LEVEL,
} from './constants.js';
import { Chunk, CHUNK_STATE, chunkKey } from './chunk.js';
import { LightEngine } from './lighting.js';
import { blocks, LIGHT_EMIT, IS_OPAQUE, IS_COLLIDABLE, IS_LIQUID, B } from './blocks.js';
import { BIOMES, PLAINS } from './biomes.js';
import { WorkerPool, BufferPool } from '../workers/pool.js';
import { TerrainGenerator, findSpawn } from './terrain.js';

/** Per-frame work limits. */
const DEFAULT_BUDGET = {
  generateRequests: 6,
  lightSteps: 45000,
  meshRequests: 6,
  meshUploads: 4,
};

export class World {
  /**
   * @param {object} opts
   * @param {number} opts.seed
   * @param {string} opts.workerUrl
   * @param {number} [opts.renderDistance] in chunks
   * @param {string} [opts.worldType] see WORLD_TYPES in terrain.js
   */
  constructor({ seed, workerUrl, renderDistance = 8, worldType = 'default' }) {
    this.seed = seed | 0;
    this.worldType = worldType;
    this.renderDistance = renderDistance;
    /** @type {Map<number, Chunk>} */
    this.chunks = new Map();
    this.light = new LightEngine(this);
    this.budget = { ...DEFAULT_BUDGET };

    /** Generator kept on the main thread for spawn search and queries. */
    this.generator = new TerrainGenerator(this.seed, { type: worldType });

    /** Set by the renderer to receive finished vertex data. */
    this.onMesh = null;
    /** Called with (x, y, z, oldId, newId) after every successful edit. */
    this.onBlockChange = null;
    /** Called before a chunk is dropped, so the renderer can free buffers. */
    this.onChunkUnload = null;

    this.pool = new WorkerPool({
      url: workerUrl,
      initMessage: { seed: this.seed, worldType },
      fallback: null,   // installed by #installFallback() once textures exist
    });

    this.paddedBlocks = new BufferPool(() => new Uint16Array(PADDED_VOLUME));
    this.paddedLight = new BufferPool(() => new Uint8Array(PADDED_VOLUME));
    this.paddedBiomes = new BufferPool(() => new Uint8Array(PADDED_SIZE * PADDED_SIZE));

    /** Chunks currently being generated / meshed, keyed by chunk key. */
    this.generating = new Set();
    this.meshing = new Set();
    /** Mesh results waiting to be uploaded to the GPU. */
    this.meshQueue = [];
    /** Sorted list of chunk coords we still want, refreshed on movement. */
    this.wishlist = [];
    this.lastCenter = { cx: Number.NaN, cz: Number.NaN };

    this.stats = {
      loaded: 0, generating: 0, meshing: 0, queued: 0,
      lightWork: 0, generatedTotal: 0, meshedTotal: 0,
    };
    this.layerTable = null;
    this.ready = false;
  }

  /* ---------------------------------------------------------------- */
  /* setup                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Publishes the texture layer table to the workers. Meshing cannot
   * start before this happens because layer indices only exist after the
   * array texture is built.
   */
  setLayerTable(layerTable) {
    this.layerTable = layerTable;
    this.pool.broadcast({ type: 'layers', layerTable });
    if (this.pool.usingFallback) this.#installFallback();
    this.ready = true;
  }

  /**
   * When workers are unavailable, run the worker entry point inline.
   * Imported lazily so the normal path never pays for it.
   */
  async #installFallback() {
    const mod = await import('../workers/chunk-worker.js');
    mod.handleMessage({
      type: 'init', seed: this.seed, worldType: this.worldType, layerTable: this.layerTable,
    });
    this.pool.fallback = (msg) => mod.handleMessage(msg);
  }

  /** Finds a safe spawn position using the main-thread generator. */
  findSpawnPoint() {
    return findSpawn(this.generator);
  }

  /* ---------------------------------------------------------------- */
  /* chunk access                                                    */
  /* ---------------------------------------------------------------- */

  chunkAt(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** Chunk containing a world block column, or undefined. */
  chunkAtBlock(x, z) {
    return this.chunks.get(chunkKey(x >> 4, z >> 4));
  }

  /** True when the chunk holding this column has terrain data. */
  isLoaded(x, z) {
    const c = this.chunkAtBlock(x, z);
    return !!c && c.state >= CHUNK_STATE.GENERATED;
  }

  /* ---------------------------------------------------------------- */
  /* block access                                                    */
  /* ---------------------------------------------------------------- */

  /** Block id at world coordinates; air for anything not loaded. */
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.blocks[localIndex(x & 15, y, z & 15)];
  }

  getBlockDef(x, y, z) {
    return blocks[this.getBlock(x, y, z)];
  }

  isSolidAt(x, y, z) {
    return IS_COLLIDABLE[this.getBlock(x, y, z)] === 1;
  }

  isOpaqueAt(x, y, z) {
    return IS_OPAQUE[this.getBlock(x, y, z)] === 1;
  }

  isLiquidAt(x, y, z) {
    return IS_LIQUID[this.getBlock(x, y, z)] === 1;
  }

  /**
   * Places or removes a block and schedules the resulting light and mesh
   * updates.
   * @returns {boolean} false when the chunk is not loaded
   */
  setBlock(x, y, z, id, { silent = false } = {}) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || c.state < CHUNK_STATE.GENERATED) return false;

    const lx = x & 15; const lz = z & 15;
    const i = localIndex(lx, y, lz);
    const old = c.blocks[i];
    if (old === id) return true;

    c.blocks[i] = id;
    c.modified = true;
    c.recomputeColumnHeight(lx, lz);

    if (!silent) {
      this.light.onBlockChanged(x, y, z, old, id);
      this.#markDirtyAround(x, y, z);
      this.onBlockChange?.(x, y, z, old, id);
    }
    return true;
  }

  /** Marks the containing chunk (and neighbours on a border) for remesh. */
  #markDirtyAround(x, y, z) {
    const cx = x >> 4; const cz = z >> 4;
    const lx = x & 15; const lz = z & 15;
    this.#markDirty(cx, cz);
    if (lx === 0) this.#markDirty(cx - 1, cz);
    if (lx === 15) this.#markDirty(cx + 1, cz);
    if (lz === 0) this.#markDirty(cx, cz - 1);
    if (lz === 15) this.#markDirty(cx, cz + 1);
    if (lx === 0 && lz === 0) this.#markDirty(cx - 1, cz - 1);
    if (lx === 15 && lz === 0) this.#markDirty(cx + 1, cz - 1);
    if (lx === 0 && lz === 15) this.#markDirty(cx - 1, cz + 1);
    if (lx === 15 && lz === 15) this.#markDirty(cx + 1, cz + 1);
    void y;
  }

  #markDirty(cx, cz) {
    const c = this.chunkAt(cx, cz);
    if (c && c.state >= CHUNK_STATE.GENERATED) c.dirty = true;
  }

  /* ---------------------------------------------------------------- */
  /* light access (used by LightEngine)                              */
  /* ---------------------------------------------------------------- */

  getSkyLight(x, y, z) {
    if (y >= WORLD_HEIGHT) return 15;
    if (y < 0) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return (c.light[localIndex(x & 15, y, z & 15)] >> 4) & 15;
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.light[localIndex(x & 15, y, z & 15)] & 15;
  }

  /** Combined light byte, for entity and particle shading. */
  getLightByte(x, y, z) {
    if (y >= WORLD_HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0xf0;
    return c.light[localIndex(x & 15, y, z & 15)];
  }

  setSkyLightRaw(x, y, z, level) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return;
    const i = localIndex(x & 15, y, z & 15);
    c.light[i] = (c.light[i] & 0x0f) | ((level & 15) << 4);
  }

  setBlockLightRaw(x, y, z, level) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return;
    const i = localIndex(x & 15, y, z & 15);
    c.light[i] = (c.light[i] & 0xf0) | (level & 15);
  }

  /* ---------------------------------------------------------------- */
  /* biome / height queries                                          */
  /* ---------------------------------------------------------------- */

  biomeAt(x, z) {
    const c = this.chunkAtBlock(x, z);
    if (!c) return PLAINS;
    return BIOMES[c.biomes[(z & 15) * CHUNK_SIZE + (x & 15)]] ?? PLAINS;
  }

  /** Highest light-blocking block in a column, or -1. */
  heightAt(x, z) {
    const c = this.chunkAtBlock(x, z);
    if (!c) return -1;
    return c.heightMap[(z & 15) * CHUNK_SIZE + (x & 15)];
  }

  /**
   * The generator's terrain surface for a column, ignoring anything
   * placed on top of it (trees, snow, plants). Spawn placement wants this
   * rather than `heightAt`, which would put the player on a canopy.
   */
  terrainHeightAt(x, z) {
    const c = this.chunkAtBlock(x, z);
    if (!c) return -1;
    return c.heights[(z & 15) * CHUNK_SIZE + (x & 15)];
  }

  /** Y of the first air block above the terrain, for entity placement. */
  surfaceY(x, z) {
    const top = this.heightAt(x, z);
    return top < 0 ? SEA_LEVEL + 1 : top + 1;
  }

  /* ---------------------------------------------------------------- */
  /* per-frame update                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Advances chunk streaming, lighting and meshing.
   * @param {number} px player world x
   * @param {number} pz player world z
   */
  update(px, pz) {
    const cx = Math.floor(px) >> 4;
    const cz = Math.floor(pz) >> 4;

    if (cx !== this.lastCenter.cx || cz !== this.lastCenter.cz) {
      this.lastCenter.cx = cx;
      this.lastCenter.cz = cz;
      this.#rebuildWishlist(cx, cz);
      this.#unloadDistant(cx, cz);
    }

    this.#pumpGeneration();
    this.stats.lightWork = this.light.update(this.budget.lightSteps);
    this.#applyLightTouches();
    if (this.ready) this.#pumpMeshing();

    this.stats.loaded = this.chunks.size;
    this.stats.generating = this.generating.size;
    this.stats.meshing = this.meshing.size;
    this.stats.queued = this.meshQueue.length;
  }

  /** Ordered list of chunks we want, nearest first. */
  #rebuildWishlist(cx, cz) {
    const r = this.renderDistance;
    const list = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r + r) continue;
        list.push({ cx: cx + dx, cz: cz + dz, d2 });
      }
    }
    list.sort((a, b) => a.d2 - b.d2);
    this.wishlist = list;
  }

  #unloadDistant(cx, cz) {
    const limit = (this.renderDistance + 2) ** 2 + this.renderDistance;
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - cx; const dz = chunk.cz - cz;
      if (dx * dx + dz * dz <= limit) continue;
      this.onChunkUnload?.(chunk);
      this.chunks.delete(key);
    }
  }

  /** Issues terrain generation requests within the frame budget. */
  #pumpGeneration() {
    let issued = 0;
    const maxInFlight = this.pool.size * 3;
    for (const want of this.wishlist) {
      if (issued >= this.budget.generateRequests) break;
      if (this.generating.size >= maxInFlight) break;
      const key = chunkKey(want.cx, want.cz);
      if (this.chunks.has(key) || this.generating.has(key)) continue;

      this.generating.add(key);
      issued++;
      this.pool.submit({ type: 'generate', cx: want.cx, cz: want.cz })
        .then((res) => this.#onGenerated(res))
        .catch((err) => {
          console.error(`[world] generation failed for ${want.cx},${want.cz}: ${err.message}`);
          this.generating.delete(key);
        });
    }
  }

  #onGenerated(res) {
    const key = chunkKey(res.cx, res.cz);
    this.generating.delete(key);
    if (this.chunks.has(key)) return;   // raced with a load from disk

    const chunk = new Chunk(res.cx, res.cz);
    chunk.blocks.set(new Uint16Array(res.blocks.buffer ?? res.blocks));
    chunk.biomes.set(new Uint8Array(res.biomes.buffer ?? res.biomes));
    chunk.heights.set(new Int16Array(res.heights.buffer ?? res.heights));
    chunk.state = CHUNK_STATE.GENERATED;
    this.chunks.set(key, chunk);
    this.stats.generatedTotal++;

    this.light.seedChunk(chunk);
    // Existing neighbours must exchange light across the new border.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunkAt(res.cx + dx, res.cz + dz);
      if (n && n.state >= CHUNK_STATE.GENERATED) {
        this.light.seedBorder(n);
        n.dirty = true;
      }
    }
    chunk.state = CHUNK_STATE.LIT;
    chunk.dirty = true;
  }

  /** Turns light-engine touches into remesh flags. */
  #applyLightTouches() {
    const touched = this.light.takeTouched();
    if (!touched) return;
    for (const key of touched) {
      const c = this.chunks.get(key);
      if (c && c.state >= CHUNK_STATE.GENERATED) c.dirty = true;
    }
  }

  /** True when every neighbour needed for correct edge meshing exists. */
  #neighboursReady(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const n = this.chunkAt(cx + dx, cz + dz);
        if (!n || n.state < CHUNK_STATE.GENERATED) return false;
      }
    }
    return true;
  }

  /** Issues mesh jobs for dirty chunks, nearest first. */
  #pumpMeshing() {
    if (this.light.pending && this.meshQueue.length > 2) return;
    let issued = 0;
    const maxInFlight = this.pool.size * 2;

    for (const want of this.wishlist) {
      if (issued >= this.budget.meshRequests) break;
      if (this.meshing.size >= maxInFlight) break;
      const chunk = this.chunkAt(want.cx, want.cz);
      if (!chunk || !chunk.dirty) continue;
      if (this.meshing.has(chunk.key)) continue;
      if (!this.#neighboursReady(want.cx, want.cz)) continue;

      chunk.dirty = false;
      chunk.revision++;
      this.meshing.add(chunk.key);
      issued++;
      this.#submitMesh(chunk);
    }
  }

  #submitMesh(chunk) {
    const blocksBuf = this.paddedBlocks.acquire();
    const lightBuf = this.paddedLight.acquire();
    const biomesBuf = this.paddedBiomes.acquire();
    this.#buildPadded(chunk, blocksBuf, lightBuf, biomesBuf);

    const message = {
      type: 'mesh',
      cx: chunk.cx,
      cz: chunk.cz,
      revision: chunk.revision,
      blocks: blocksBuf,
      light: lightBuf,
      biomes: biomesBuf,
    };
    const transfer = this.pool.usingFallback
      ? []
      : [blocksBuf.buffer, lightBuf.buffer, biomesBuf.buffer];

    this.pool.submit(message, transfer)
      .then((res) => {
        this.meshing.delete(chunk.key);
        // Recycle the scratch buffers the worker handed back.
        if (res.blocks) this.paddedBlocks.release(new Uint16Array(res.blocks.buffer ?? res.blocks));
        if (res.light) this.paddedLight.release(new Uint8Array(res.light.buffer ?? res.light));
        if (res.biomes) this.paddedBiomes.release(new Uint8Array(res.biomes.buffer ?? res.biomes));
        // Discard results that a newer edit already invalidated.
        if (res.revision !== chunk.revision) { chunk.dirty = true; return; }
        this.meshQueue.push({ chunk, data: res });
        this.stats.meshedTotal++;
      })
      .catch((err) => {
        this.meshing.delete(chunk.key);
        chunk.dirty = true;
        console.error(`[world] mesh failed for ${chunk.cx},${chunk.cz}: ${err.message}`);
      });
  }

  /**
   * Hands finished meshes to the renderer, capped per frame so uploads
   * never spike the frame time.
   */
  drainMeshQueue(limit = this.budget.meshUploads) {
    let uploaded = 0;
    while (this.meshQueue.length && uploaded < limit) {
      const { chunk, data } = this.meshQueue.shift();
      if (!this.chunks.has(chunk.key)) continue;
      this.onMesh?.(chunk, data);
      chunk.state = CHUNK_STATE.READY;
      uploaded++;
    }
    return uploaded;
  }

  /**
   * Copies this chunk and one block of every neighbour into the padded
   * arrays the mesher expects. Rows of 16 blocks are contiguous in both
   * source and destination, so the bulk of the copy is `TypedArray.set`.
   */
  #buildPadded(chunk, blocksOut, lightOut, biomesOut) {
    blocksOut.fill(0);
    lightOut.fill(0);
    biomesOut.fill(chunk.biomes[0]);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.chunkAt(chunk.cx + dx, chunk.cz + dz);
        if (!c) continue;
        const xStart = dx === -1 ? CHUNK_SIZE - 1 : 0;
        const xEnd = dx === 1 ? 1 : CHUNK_SIZE;
        const zStart = dz === -1 ? CHUNK_SIZE - 1 : 0;
        const zEnd = dz === 1 ? 1 : CHUNK_SIZE;
        const offX = dx * CHUNK_SIZE;
        const offZ = dz * CHUNK_SIZE;
        const runLen = xEnd - xStart;
        const fullRow = runLen === CHUNK_SIZE;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          for (let lz = zStart; lz < zEnd; lz++) {
            const srcBase = (y << 8) | (lz << 4);
            const dstBase = paddedIndex(offX + xStart, y, offZ + lz);
            if (fullRow) {
              blocksOut.set(c.blocks.subarray(srcBase, srcBase + CHUNK_SIZE), dstBase);
              lightOut.set(c.light.subarray(srcBase, srcBase + CHUNK_SIZE), dstBase);
            } else {
              for (let k = 0; k < runLen; k++) {
                blocksOut[dstBase + k] = c.blocks[srcBase + xStart + k];
                lightOut[dstBase + k] = c.light[srcBase + xStart + k];
              }
            }
          }
        }
        for (let lz = zStart; lz < zEnd; lz++) {
          for (let lx = xStart; lx < xEnd; lx++) {
            biomesOut[(offZ + lz + 1) * PADDED_SIZE + (offX + lx + 1)] = c.biomes[lz * CHUNK_SIZE + lx];
          }
        }
      }
    }

    // The layer above the world is open sky.
    for (let z = -1; z <= CHUNK_SIZE; z++) {
      for (let x = -1; x <= CHUNK_SIZE; x++) {
        lightOut[paddedIndex(x, WORLD_HEIGHT, z)] = 0xf0;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* misc                                                            */
  /* ---------------------------------------------------------------- */

  /** All chunks the player has edited, for saving. */
  modifiedChunks() {
    return [...this.chunks.values()].filter((c) => c.modified);
  }

  /**
   * Inserts a chunk restored from storage, bypassing generation.
   * @param {object} record output of Chunk#serialise
   */
  restoreChunk(record) {
    const key = chunkKey(record.cx, record.cz);
    if (this.chunks.has(key)) return;
    const chunk = new Chunk(record.cx, record.cz);
    chunk.deserialise(record);
    this.chunks.set(key, chunk);
    this.light.seedChunk(chunk);
    chunk.state = CHUNK_STATE.LIT;
    chunk.dirty = true;
  }

  /** True once the chunk under the given position can be stood on. */
  isSpawnReady(x, z) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.chunkAtBlock(Math.floor(x) + dx * CHUNK_SIZE, Math.floor(z) + dz * CHUNK_SIZE);
        if (!c || c.state < CHUNK_STATE.GENERATED) return false;
      }
    }
    return true;
  }

  /** Number of chunks that already have GPU meshes. */
  readyChunkCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.state === CHUNK_STATE.READY) n++;
    return n;
  }

  setRenderDistance(d) {
    this.renderDistance = Math.max(2, Math.min(16, d | 0));
    this.lastCenter.cx = Number.NaN;
  }

  dispose() {
    this.pool.terminate();
    this.chunks.clear();
    this.light.reset();
  }
}

export { CHUNK_STATE, LIGHT_EMIT, B };
