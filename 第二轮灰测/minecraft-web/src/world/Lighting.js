/* =====================================================================
 * Lighting — 天光 + 方块光的洪水填充光照引擎
 *  · 初始化：逐列垂直投射天光，再横向 BFS 扩散
 *  · 增量：方块变化后局部移除 / 重新扩散（经典双队列算法）
 *  · 所有队列都支持分帧预算，避免卡顿
 * ===================================================================== */
import { CHUNK_HEIGHT, CHUNK_SIZE, MAX_LIGHT } from '../core/Constants.js';
import { OPACITY, EMISSION, IS_OPAQUE } from '../data/blocks.js';

/** 4 元组队列（x, y, z, level），使用可增长 Int32Array */
class LightQueue {
  constructor(capacity = 4096) {
    this.data = new Int32Array(capacity * 4);
    this.head = 0;
    this.tail = 0;
  }
  get size() { return (this.tail - this.head) / 4; }
  get empty() { return this.head >= this.tail; }

  push(x, y, z, level) {
    if (this.tail + 4 > this.data.length) this._grow();
    const d = this.data, t = this.tail;
    d[t] = x; d[t + 1] = y; d[t + 2] = z; d[t + 3] = level;
    this.tail += 4;
  }

  _grow() {
    // 先尝试压缩（移除已消费部分）
    if (this.head > this.data.length / 3) {
      this.data.copyWithin(0, this.head, this.tail);
      this.tail -= this.head;
      this.head = 0;
      return;
    }
    const bigger = new Int32Array(this.data.length * 2);
    bigger.set(this.data.subarray(0, this.tail));
    this.data = bigger;
  }

  /** 读取到 out=[x,y,z,level] */
  pop(out) {
    const d = this.data, h = this.head;
    out[0] = d[h]; out[1] = d[h + 1]; out[2] = d[h + 2]; out[3] = d[h + 3];
    this.head += 4;
    if (this.head >= this.tail) { this.head = 0; this.tail = 0; }
    return out;
  }

  clear() { this.head = this.tail = 0; }
}

const DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export class LightEngine {
  constructor(world) {
    this.world = world;
    this.skyAdd = new LightQueue(8192);
    this.skyRemove = new LightQueue(2048);
    this.blockAdd = new LightQueue(4096);
    this.blockRemove = new LightQueue(2048);
    this._tmp = new Int32Array(4);
    this.stats = { skyNodes: 0, blockNodes: 0 };
  }

  get pending() {
    return this.skyAdd.size + this.skyRemove.size + this.blockAdd.size + this.blockRemove.size;
  }

  /* ================= 初始化整块光照 ================= */

  /**
   * 计算一个区块的初始光照。
   * 要求：区块自身已生成；邻区块可缺失（之后会通过边界 BFS 修正）。
   */
  initChunk(chunk) {
    const blocks = chunk.blocks;
    const light = chunk.light;
    light.fill(0);

    const ox = chunk.originX, oz = chunk.originZ;

    // ---- 垂直天光投射 ----
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const colBase = (z << 4) | x;
        let level = MAX_LIGHT;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const i = (y << 8) | colBase;
          const id = blocks[i];
          const op = OPACITY[id];
          if (op > 0) {
            level = level - op;
            if (level < 0) level = 0;
          }
          light[i] = (level << 4);
          if (level === 0) break;      // 下方全黑，交给 BFS 处理侧向照明
        }
      }
    }

    // ---- 把可能向外扩散的天光节点入队 ----
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const colBase = (z << 4) | x;
        const border = (x === 0 || x === 15 || z === 0 || z === 15);
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const i = (y << 8) | colBase;
          const lvl = light[i] >> 4;
          if (lvl <= 1) {
            if (lvl === 0) break;
            continue;
          }
          // 只在"可能存在更暗邻居"的位置播种，减少无效节点
          if (border || this._hasDarkerNeighborLocal(chunk, x, y, z, lvl)) {
            this.skyAdd.push(ox + x, y, oz + z, lvl);
          }
        }
      }
    }

    // ---- 方块光源 ----
    const emitters = chunk.collectEmitters();
    for (const i of emitters) {
      const y = i >> 8;
      const z = (i >> 4) & 15;
      const x = i & 15;
      const e = EMISSION[blocks[i]];
      light[i] = (light[i] & 0xF0) | e;
      this.blockAdd.push(ox + x, y, oz + z, e);
    }
  }

  /** 局部检测：同区块内是否存在更暗（且可透光）的邻居 */
  _hasDarkerNeighborLocal(chunk, x, y, z, lvl) {
    const blocks = chunk.blocks, light = chunk.light;
    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (nx < 0 || nx > 15 || nz < 0 || nz > 15) return true;    // 跨区块，保守播种
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
      const i = (ny << 8) | (nz << 4) | nx;
      if (IS_OPAQUE[blocks[i]]) continue;
      if ((light[i] >> 4) < lvl - 1) return true;
    }
    return false;
  }

  /* ================= BFS 扩散（分帧） ================= */

  /**
   * 处理队列，maxNodes 为本次处理的节点上限
   * @returns 实际处理的节点数
   */
  process(maxNodes = 20000) {
    let n = 0;
    n += this._processRemove(this.blockRemove, this.blockAdd, false, maxNodes - n);
    n += this._processRemove(this.skyRemove, this.skyAdd, true, maxNodes - n);
    n += this._processAdd(this.blockAdd, false, maxNodes - n);
    n += this._processAdd(this.skyAdd, true, maxNodes - n);
    return n;
  }

  _processAdd(queue, isSky, budget) {
    if (budget <= 0) return 0;
    const world = this.world;
    const out = this._tmp;
    let count = 0;
    while (!queue.empty && count < budget) {
      queue.pop(out);
      const x = out[0], y = out[1], z = out[2];
      let level = out[3];
      const cur = isSky ? world.getSkyLight(x, y, z) : world.getBlockLight(x, y, z);
      // 种子必须与该位置的当前光值同步：remove 先于 add 执行，
      // 入队时的旧值可能已被清零/改写。若沿用过期值传播，会把已删除
      // 光源的光"复活"（删除火把后周围光影残留的根因）。
      level = cur;
      if (level <= 1) { count++; continue; }

      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        const id = world.getBlock(nx, ny, nz);
        if (id < 0) continue;                     // 区块未加载
        if (IS_OPAQUE[id]) continue;
        const op = OPACITY[id];
        const next = level - 1 - op;
        if (next <= 0) continue;
        const have = isSky ? world.getSkyLight(nx, ny, nz) : world.getBlockLight(nx, ny, nz);
        if (have >= next) continue;
        if (isSky) world.setSkyLightRaw(nx, ny, nz, next);
        else world.setBlockLightRaw(nx, ny, nz, next);
        queue.push(nx, ny, nz, next);
      }
      count++;
    }
    if (isSky) this.stats.skyNodes += count; else this.stats.blockNodes += count;
    return count;
  }

  _processRemove(queue, addQueue, isSky, budget) {
    if (budget <= 0) return 0;
    const world = this.world;
    const out = this._tmp;
    let count = 0;
    while (!queue.empty && count < budget) {
      queue.pop(out);
      const x = out[0], y = out[1], z = out[2], level = out[3];

      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        const id = world.getBlock(nx, ny, nz);
        if (id < 0) continue;
        const have = isSky ? world.getSkyLight(nx, ny, nz) : world.getBlockLight(nx, ny, nz);
        if (have === 0) continue;
        if (have < level) {
          // 天光特例：直接暴露在天空下的格子不能被移除（否则会把整片露天区域清黑）
          if (isSky && world.isDirectlySunlit(nx, ny, nz)) {
            addQueue.push(nx, ny, nz, have);
            continue;
          }
          if (isSky) world.setSkyLightRaw(nx, ny, nz, 0);
          else world.setBlockLightRaw(nx, ny, nz, 0);
          queue.push(nx, ny, nz, have);
        } else {
          // 邻居更亮：它会重新照回来
          addQueue.push(nx, ny, nz, have);
        }
      }
      count++;
    }
    return count;
  }

  /** 一次性跑完所有队列（世界初始化时使用） */
  flush(maxIterations = 4000000) {
    let total = 0;
    while (this.pending > 0 && total < maxIterations) {
      total += this.process(50000);
    }
    return total;
  }

  /* ================= 增量更新 ================= */

  /**
   * 方块变化后更新光照
   */
  onBlockChanged(x, y, z, oldId, newId) {
    const world = this.world;

    // ---------- 方块光 ----------
    const oldE = EMISSION[oldId];
    const newE = EMISSION[newId];
    const curBlockLight = world.getBlockLight(x, y, z);

    if (curBlockLight > 0) {
      // 该格原有块光需要清除后重算（无论来源）
      world.setBlockLightRaw(x, y, z, 0);
      this.blockRemove.push(x, y, z, curBlockLight);
    }
    if (newE > 0) {
      world.setBlockLightRaw(x, y, z, newE);
      this.blockAdd.push(x, y, z, newE);
    }
    // 邻居重新照进来
    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
      const bl = world.getBlockLight(nx, ny, nz);
      if (bl > 1) this.blockAdd.push(nx, ny, nz, bl);
    }

    // ---------- 天光 ----------
    this.recomputeColumnSky(x, z);
    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
      const sl = world.getSkyLight(nx, ny, nz);
      if (sl > 1) this.skyAdd.push(nx, ny, nz, sl);
    }
    void oldE;
  }

  /** 重新计算某一列的直射天光，并把差异入队 */
  recomputeColumnSky(x, z) {
    const world = this.world;
    const chunk = world.getChunkAt(x, z);
    if (!chunk) return;
    const lx = x & 15, lz = z & 15;
    const colBase = (lz << 4) | lx;
    const blocks = chunk.blocks, light = chunk.light;

    let level = MAX_LIGHT;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const i = (y << 8) | colBase;
      const id = blocks[i];
      const op = OPACITY[id];
      if (op > 0) {
        level -= op;
        if (level < 0) level = 0;
      }
      const old = light[i] >> 4;
      if (old === level) {
        if (level === 0) {
          // 下方保持原状，但仍需检查旧值（可能之前是亮的）
          continue;
        }
        continue;
      }
      light[i] = (light[i] & 0x0F) | (level << 4);
      if (level < old) {
        this.skyRemove.push(x, y, z, old);
      } else {
        this.skyAdd.push(x, y, z, level);
      }
    }
  }
}
