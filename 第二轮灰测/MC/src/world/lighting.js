/**
 * world/lighting.js
 * ------------------------------------------------------------------
 * Sky light and block light propagation.
 *
 * Two independent 15-level light channels, exactly like Minecraft:
 *
 *  - **sky light** streams straight down from the sky at full strength
 *    and loses one level per block when it spreads sideways or through
 *    a light-filtering block (water, leaves);
 *  - **block light** radiates from emitters (torches, glowstone, lava)
 *    and loses one level per block in every direction.
 *
 * Propagation is a breadth-first flood fill over world coordinates, so
 * light crosses chunk boundaries naturally. The queues persist between
 * frames and are drained under a time budget, which keeps a big lighting
 * update (a cave breach, sunrise on freshly loaded chunks) from stalling
 * the frame.
 *
 * Removal uses the standard two-phase algorithm: first darken every cell
 * whose light could only have come from the removed source, collecting
 * the brighter boundary cells, then re-propagate from that boundary.
 */

import { CHUNK_SIZE, WORLD_HEIGHT, MAX_LIGHT, FACE_DIR } from './constants.js';
import { LIGHT_EMIT, LIGHT_FILTER, IS_OPAQUE } from './blocks.js';

/**
 * FIFO queue of (x, y, z) triples plus an optional payload, backed by a
 * growable Int32Array. Using one flat buffer avoids millions of small
 * object allocations during world load.
 */
class CoordQueue {
  constructor(capacity = 1 << 14, stride = 3) {
    this.stride = stride;
    this.data = new Int32Array(capacity * stride);
    this.head = 0;
    this.tail = 0;
  }

  get size() { return (this.tail - this.head) / this.stride; }
  get isEmpty() { return this.head === this.tail; }

  #grow() {
    const live = this.tail - this.head;
    // Compact first; only reallocate when compaction is not enough.
    if (this.head > 0) {
      this.data.copyWithin(0, this.head, this.tail);
      this.tail = live;
      this.head = 0;
      if (this.tail + this.stride <= this.data.length) return;
    }
    const next = new Int32Array(this.data.length * 2);
    next.set(this.data.subarray(0, this.tail));
    this.data = next;
  }

  push(x, y, z, payload = 0) {
    if (this.tail + this.stride > this.data.length) this.#grow();
    const d = this.data;
    d[this.tail] = x;
    d[this.tail + 1] = y;
    d[this.tail + 2] = z;
    if (this.stride > 3) d[this.tail + 3] = payload;
    this.tail += this.stride;
  }

  /** Copies the next entry into `out` and advances. */
  shift(out) {
    const d = this.data;
    out[0] = d[this.head];
    out[1] = d[this.head + 1];
    out[2] = d[this.head + 2];
    if (this.stride > 3) out[3] = d[this.head + 3];
    this.head += this.stride;
    if (this.head === this.tail) { this.head = 0; this.tail = 0; }
    return out;
  }

  clear() { this.head = 0; this.tail = 0; }
}

/**
 * Owns the light queues for a world and knows how to seed, spread and
 * remove light. All coordinates are world coordinates; block and light
 * access goes through the world so chunk boundaries are transparent.
 */
export class LightEngine {
  /** @param {import('./world.js').World} world */
  constructor(world) {
    this.world = world;
    this.skyAdd = new CoordQueue(1 << 15);
    this.skyRemove = new CoordQueue(1 << 12, 4);
    this.blockAdd = new CoordQueue(1 << 13);
    this.blockRemove = new CoordQueue(1 << 12, 4);
    this.scratch = new Int32Array(4);
    /** Chunks whose light changed and therefore need a remesh. */
    this.touched = new Set();
    this.stats = { skySpread: 0, blockSpread: 0 };
  }

  get pending() {
    return !this.skyAdd.isEmpty || !this.blockAdd.isEmpty
      || !this.skyRemove.isEmpty || !this.blockRemove.isEmpty;
  }

  /* ---------------------------------------------------------------- */
  /* seeding                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Initial lighting for a freshly generated chunk.
   *
   * Sky light is filled column-by-column top-down (the cheap, exact
   * vertical case), then every lit cell is queued so the BFS can spread
   * it sideways and into neighbouring chunks. Emitters are queued too.
   */
  seedChunk(chunk) {
    const { blocks, light } = chunk;
    light.fill(0);

    // --- vertical sky light ------------------------------------
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let level = MAX_LIGHT;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const i = (y << 8) | (lz << 4) | lx;
          const filter = LIGHT_FILTER[blocks[i]];
          if (filter >= MAX_LIGHT) { level = 0; }
          else if (filter > 0) { level = Math.max(0, level - filter); }
          if (level === 0) {
            // Everything below is dark until an emitter says otherwise.
            for (let yy = y; yy >= 0; yy--) light[(yy << 8) | (lz << 4) | lx] = 0;
            break;
          }
          light[i] = (level << 4);
        }
      }
    }

    // --- queue everything that can spread ----------------------
    const baseX = chunk.originX;
    const baseZ = chunk.originZ;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const i = (y << 8) | (lz << 4) | lx;
          const id = blocks[i];
          const emit = LIGHT_EMIT[id];
          if (emit > 0) {
            light[i] = (light[i] & 0xf0) | emit;
            this.blockAdd.push(baseX + lx, y, baseZ + lz);
          }
          if ((light[i] >> 4) > 1) this.skyAdd.push(baseX + lx, y, baseZ + lz);
        }
      }
    }
    chunk.recomputeHeightMap();
    this.touched.add(chunk.key);
  }

  /**
   * Re-seeds sky light along the border shared with a chunk that has
   * just appeared, so the two columns exchange light.
   */
  seedBorder(chunk) {
    const baseX = chunk.originX;
    const baseZ = chunk.originZ;
    const light = chunk.light;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let k = 0; k < CHUNK_SIZE; k++) {
        for (const [lx, lz] of [[0, k], [CHUNK_SIZE - 1, k], [k, 0], [k, CHUNK_SIZE - 1]]) {
          const i = (y << 8) | (lz << 4) | lx;
          const l = light[i];
          if ((l >> 4) > 1) this.skyAdd.push(baseX + lx, y, baseZ + lz);
          if ((l & 15) > 1) this.blockAdd.push(baseX + lx, y, baseZ + lz);
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* edits                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Updates lighting after a single block change.
   * @param {number} x world coordinates of the changed block
   * @param {number} oldId
   * @param {number} newId
   */
  onBlockChanged(x, y, z, oldId, newId) {
    const world = this.world;

    // --- block light -------------------------------------------
    const oldEmit = LIGHT_EMIT[oldId];
    const newEmit = LIGHT_EMIT[newId];
    if (oldEmit > 0) {
      this.blockRemove.push(x, y, z, oldEmit);
      world.setBlockLightRaw(x, y, z, 0);
    }
    if (LIGHT_FILTER[newId] >= MAX_LIGHT && LIGHT_FILTER[oldId] < MAX_LIGHT) {
      // A new opaque block shadows whatever was lit behind it.
      const existing = world.getBlockLight(x, y, z);
      if (existing > 0) {
        this.blockRemove.push(x, y, z, existing);
        world.setBlockLightRaw(x, y, z, 0);
      }
    }
    if (newEmit > 0) {
      world.setBlockLightRaw(x, y, z, newEmit);
      this.blockAdd.push(x, y, z);
    } else if (!IS_OPAQUE[newId]) {
      // Opening a hole lets neighbouring block light flow in.
      for (const [dx, dy, dz] of FACE_DIR) {
        if (world.getBlockLight(x + dx, y + dy, z + dz) > 0) {
          this.blockAdd.push(x + dx, y + dy, z + dz);
        }
      }
    }

    // --- sky light ---------------------------------------------
    const oldSky = world.getSkyLight(x, y, z);
    if (LIGHT_FILTER[newId] > LIGHT_FILTER[oldId]) {
      // Placing something that blocks light: darken the shadow it casts.
      if (oldSky > 0) {
        this.skyRemove.push(x, y, z, oldSky);
        world.setSkyLightRaw(x, y, z, 0);
      }
      // Everything directly below loses its sky column too.
      for (let yy = y - 1; yy >= 0; yy--) {
        const level = world.getSkyLight(x, yy, z);
        if (level === 0) break;
        this.skyRemove.push(x, yy, z, level);
        world.setSkyLightRaw(x, yy, z, 0);
        if (IS_OPAQUE[world.getBlock(x, yy, z)]) break;
      }
    } else if (LIGHT_FILTER[newId] < LIGHT_FILTER[oldId]) {
      // Removing a blocker: re-open the sky column and let neighbours in.
      const above = world.getSkyLight(x, y + 1, z);
      const filter = LIGHT_FILTER[newId];
      const straightDown = above >= MAX_LIGHT && filter === 0 ? MAX_LIGHT : Math.max(0, above - Math.max(1, filter));
      if (straightDown > 0) {
        world.setSkyLightRaw(x, y, z, straightDown);
        this.skyAdd.push(x, y, z);
      }
      for (const [dx, dy, dz] of FACE_DIR) {
        if (world.getSkyLight(x + dx, y + dy, z + dz) > 1) this.skyAdd.push(x + dx, y + dy, z + dz);
      }
    }

    this.#touchAround(x, y, z);
  }

  /** Marks the chunk containing (x,z) plus neighbours as needing a remesh. */
  #touchAround(x, y, z) {
    const world = this.world;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = world.chunkAtBlock(x + dx * 1, z + dz * 1);
        if (c) this.touched.add(c.key);
      }
    }
    void y;
  }

  /* ---------------------------------------------------------------- */
  /* propagation                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Drains the light queues.
   * @param {number} budget maximum cells to visit this call
   * @returns {number} cells actually visited
   */
  update(budget = 40000) {
    let work = 0;
    work += this.#processRemoval(this.blockRemove, false, budget - work);
    work += this.#processRemoval(this.skyRemove, true, budget - work);
    work += this.#processAdd(this.blockAdd, false, budget - work);
    work += this.#processAdd(this.skyAdd, true, budget - work);
    return work;
  }

  /** Spreads light outward from queued cells. */
  #processAdd(queue, isSky, budget) {
    if (budget <= 0) return 0;
    const world = this.world;
    const out = this.scratch;
    let work = 0;

    while (!queue.isEmpty && work < budget) {
      queue.shift(out);
      const x = out[0]; const y = out[1]; const z = out[2];
      const level = isSky ? world.getSkyLight(x, y, z) : world.getBlockLight(x, y, z);
      work++;
      if (level <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const dir = FACE_DIR[d];
        const nx = x + dir[0]; const ny = y + dir[1]; const nz = z + dir[2];
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const chunk = world.chunkAtBlock(nx, nz);
        if (!chunk) continue;

        const id = world.getBlock(nx, ny, nz);
        const filter = LIGHT_FILTER[id];
        if (filter >= MAX_LIGHT) continue;

        // Sky light travelling straight down through empty space keeps
        // its full strength; every other step costs at least one level.
        const cost = (isSky && dir[1] === -1 && level === MAX_LIGHT && filter === 0)
          ? 0
          : Math.max(1, filter);
        const next = level - cost;
        if (next <= 0) continue;

        const current = isSky ? world.getSkyLight(nx, ny, nz) : world.getBlockLight(nx, ny, nz);
        if (current >= next) continue;

        if (isSky) world.setSkyLightRaw(nx, ny, nz, next);
        else world.setBlockLightRaw(nx, ny, nz, next);
        this.touched.add(chunk.key);
        queue.push(nx, ny, nz);
      }
    }
    if (isSky) this.stats.skySpread += work; else this.stats.blockSpread += work;
    return work;
  }

  /**
   * Darkens cells that were only lit by a now-removed source, and
   * re-queues brighter neighbours so the gap fills back in.
   */
  #processRemoval(queue, isSky, budget) {
    if (budget <= 0) return 0;
    const world = this.world;
    const out = this.scratch;
    const addQueue = isSky ? this.skyAdd : this.blockAdd;
    let work = 0;

    while (!queue.isEmpty && work < budget) {
      queue.shift(out);
      const x = out[0]; const y = out[1]; const z = out[2];
      const oldLevel = out[3];
      work++;

      for (let d = 0; d < 6; d++) {
        const dir = FACE_DIR[d];
        const nx = x + dir[0]; const ny = y + dir[1]; const nz = z + dir[2];
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const chunk = world.chunkAtBlock(nx, nz);
        if (!chunk) continue;

        const level = isSky ? world.getSkyLight(nx, ny, nz) : world.getBlockLight(nx, ny, nz);
        if (level === 0) continue;

        // Sky light falling straight down was not attenuated, so a full
        // strength cell below also has to be cleared.
        const wasChild = level < oldLevel
          || (isSky && dir[1] === -1 && level === MAX_LIGHT && oldLevel === MAX_LIGHT);
        if (wasChild) {
          if (isSky) world.setSkyLightRaw(nx, ny, nz, 0);
          else world.setBlockLightRaw(nx, ny, nz, 0);
          this.touched.add(chunk.key);
          queue.push(nx, ny, nz, level);
        } else if (level >= oldLevel) {
          addQueue.push(nx, ny, nz);
        }
      }
    }
    return work;
  }

  /** Consumes and returns the set of chunk keys whose light changed. */
  takeTouched() {
    if (this.touched.size === 0) return null;
    const set = this.touched;
    this.touched = new Set();
    return set;
  }

  reset() {
    this.skyAdd.clear();
    this.skyRemove.clear();
    this.blockAdd.clear();
    this.blockRemove.clear();
    this.touched.clear();
  }
}
