/* =====================================================================
 * World — 区块管理、方块读写、生成流水线、光照调度、方块刻
 *
 * 区块生命周期:
 *   EMPTY → GENERATED(地形) → DECORATED(植被/建筑) → LIT(光照) → READY(网格)
 * 每一步都有时间预算，保证主线程不卡顿。
 * ===================================================================== */
import {
  CHUNK_SIZE, CHUNK_HEIGHT, SECTION_COUNT, SEA_LEVEL, MAX_LIGHT,
} from '../core/Constants.js';
import { Chunk, STATE, chunkKey } from './Chunk.js';
import { Generator } from './Generator.js';
import { LightEngine } from './Lighting.js';
import { bus, EV } from '../core/EventBus.js';
import {
  IS_OPAQUE, IS_SOLID, EMISSION, BLOCKS, idByName, getBlock as blockDef,
} from '../data/blocks.js';
import { biomeInfo } from './Biomes.js';

const AIR = 0;
const UNLOADED = -1;

export class World {
  constructor(options = {}) {
    this.name = options.name || '新的世界';
    this.seedString = options.seed ?? String(Math.floor(Math.random() * 1e9));
    this.type = options.type || 'default';
    this.generator = new Generator({
      seed: this.seedString, type: this.type, structures: options.structures !== false,
    });
    this.seed = this.generator.seed;
    this.lighting = new LightEngine(this);

    /** @type {Map<string, Chunk>} */
    this.chunks = new Map();
    this.renderDistance = options.renderDistance ?? 8;

    // 流水线队列（存 chunkKey）
    this.genQueue = [];
    this.decorQueue = [];
    this.lightQueue = [];
    /** 需要重建网格的 section: Set<"cx,cz,si"> */
    this.dirtySections = new Set();

    // 玩家改动（存档用）：chunkKey -> Map<index, blockId>
    this.edits = new Map();

    // 时间与天气
    this.timeOfDay = 6000;            // 0..24000，6000 = 正午
    this.dayCount = 0;
    this.weather = 'clear';           // clear | rain | thunder
    this.weatherTimer = 600;
    this.doDaylightCycle = true;

    // 待处理的落沙 / 生长
    this.fallingQueue = [];
    this.randomTickSpeed = 3;

    this.stats = {
      generated: 0, decorated: 0, lit: 0, meshed: 0,
      lastGenMs: 0, lastLightMs: 0, chunkCount: 0,
    };
    this._playerCX = 0;
    this._playerCZ = 0;
    this._sortCounter = 0;
    this._ids = {
      water: idByName('water'), sand: idByName('sand'), gravel: idByName('gravel'),
      grass: idByName('grass_block'), dirt: idByName('dirt'), snowyGrass: idByName('grass_block_snowy'),
      sapling: idByName('oak_sapling'), oakLog: idByName('oak_log'), oakLeaves: idByName('oak_leaves'),
      farmland: idByName('farmland'), tallGrass: idByName('tall_grass'),
    };
  }

  /* ================= 坐标与区块访问 ================= */

  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)) || null; }
  getChunkAt(wx, wz) { return this.chunks.get(chunkKey(wx >> 4, wz >> 4)) || null; }
  hasChunk(cx, cz) { return this.chunks.has(chunkKey(cx, cz)); }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    c = new Chunk(cx, cz);
    this.chunks.set(key, c);
    this.genQueue.push(key);
    return c;
  }

  /* ================= 方块读写 ================= */

  /** 未加载返回 -1 */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return AIR;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return UNLOADED;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  /** 未加载视为空气（渲染 / 逻辑用） */
  getBlockSafe(x, y, z) {
    const b = this.getBlock(x, y, z);
    return b < 0 ? AIR : b;
  }

  /** 未加载视为固体（物理用，防止掉出世界） */
  getBlockCollide(x, y, z) {
    if (y < 0) return 1;
    if (y >= CHUNK_HEIGHT) return AIR;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || c.state < STATE.GENERATED) return 1;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  /** 生成阶段专用：直接写入，不触发光照/网格（但标记 section） */
  setBlockGen(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || c.state < STATE.GENERATED) return false;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    if (c.blocks[i] === id) return true;
    c.blocks[i] = id;
    if (id !== AIR) c.sectionEmpty[y >> 4] = 0;
    if (c.state >= STATE.LIT) {
      // 已点亮的邻居被装饰改动：需要重算
      c.lightDirty = true;
      this.markSectionDirtyAt(x, y, z);
    }
    return true;
  }

  getBlockGen(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return AIR;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || c.state < STATE.GENERATED) return AIR;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  surfaceHeightGen(x, z) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (c && c.state >= STATE.GENERATED) return c.heightMap[((z & 15) << 4) | (x & 15)];
    return this.generator.surfaceHeight(x, z);
  }

  /** 最高不透光方块 y+1（光照用；未加载返回 -1） */
  surfaceHeightAt(x, z) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c || c.state < STATE.GENERATED) return -1;
    return c.surfaceMap[((z & 15) << 4) | (x & 15)];
  }

  /** 是否为"直接暴露在天空下"的格子（y 不低于遮光高度） */
  isDirectlySunlit(x, y, z) {
    const surf = this.surfaceHeightAt(x, z);
    return surf >= 0 && y >= surf;
  }

  /**
   * 正式修改方块（玩家行为 / 逻辑更新）
   * 会更新高度图、光照、脏区块，并记录存档差异
   */
  setBlock(x, y, z, id, opts = {}) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x & 15, lz = z & 15;
    const i = (y << 8) | (lz << 4) | lx;
    const old = c.blocks[i];
    if (old === id) return false;

    c.blocks[i] = id;
    if (id !== AIR) c.sectionEmpty[y >> 4] = 0;
    else c.recomputeSectionEmptinessAt?.(y >> 4);
    c.recomputeColumn(lx, lz);
    c.modified = true;

    if (opts.record !== false) this._recordEdit(cx, cz, i, id);

    // 光照
    this.lighting.onBlockChanged(x, y, z, old, id);

    // 网格
    this.markSectionDirtyAt(x, y, z);
    this._markNeighborSections(x, y, z);

    // 落沙 / 生长检查
    if (opts.physics !== false) {
      this._scheduleFalling(x, y + 1, z);
      this._scheduleFalling(x, y, z);
    }

    bus.emit(EV.BLOCK_CHANGED, x, y, z, old, id);
    return true;
  }

  _recordEdit(cx, cz, index, id) {
    const key = chunkKey(cx, cz);
    let m = this.edits.get(key);
    if (!m) { m = new Map(); this.edits.set(key, m); }
    m.set(index, id);
  }

  /* ================= 光照读写 ================= */

  getSkyLight(x, y, z) {
    if (y < 0) return 0;
    if (y >= CHUNK_HEIGHT) return MAX_LIGHT;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] >> 4;
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return 0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] & 15;
  }

  setSkyLightRaw(x, y, z, v) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    c.light[i] = (c.light[i] & 0x0F) | (v << 4);
    this.markSectionDirtyAt(x, y, z);
  }

  setBlockLightRaw(x, y, z, v) {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    c.light[i] = (c.light[i] & 0xF0) | v;
    this.markSectionDirtyAt(x, y, z);
  }

  /** 综合亮度（0..1），供实体/粒子着色 */
  lightAt(x, y, z, daylight = 1) {
    const sky = this.getSkyLight(x, y, z) / MAX_LIGHT;
    const blk = this.getBlockLight(x, y, z) / MAX_LIGHT;
    return Math.max(sky * daylight, blk);
  }

  /* ================= 脏区块标记 ================= */

  markSectionDirtyAt(x, y, z) {
    const cx = x >> 4, cz = z >> 4, si = y >> 4;
    if (si < 0 || si >= SECTION_COUNT) return;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return;
    c.sectionDirty[si] = 1;
    this.dirtySections.add(cx + ',' + cz + ',' + si);
  }

  /** 改动位于边界时，邻居 section 也要重建 */
  _markNeighborSections(x, y, z) {
    const lx = x & 15, lz = z & 15, ly = y & 15;
    if (lx === 0) this.markSectionDirtyAt(x - 1, y, z);
    if (lx === 15) this.markSectionDirtyAt(x + 1, y, z);
    if (lz === 0) this.markSectionDirtyAt(x, y, z - 1);
    if (lz === 15) this.markSectionDirtyAt(x, y, z + 1);
    if (ly === 0) this.markSectionDirtyAt(x, y - 1, z);
    if (ly === 15) this.markSectionDirtyAt(x, y + 1, z);
    // 斜角（光照溢出）
    this.markSectionDirtyAt(x - 1, y, z - 1);
    this.markSectionDirtyAt(x + 1, y, z + 1);
  }

  markChunkDirty(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (!c) return;
    for (let si = 0; si < SECTION_COUNT; si++) {
      if (c.sectionEmpty[si] && si > 0) continue;
      c.sectionDirty[si] = 1;
      this.dirtySections.add(cx + ',' + cz + ',' + si);
    }
  }

  /* ================= 生成流水线 ================= */

  /** 每帧调用：加载/卸载区块并推进流水线 */
  update(playerX, playerZ, budgetMs = 8) {
    const pcx = playerX >> 4, pcz = playerZ >> 4;
    const moved = pcx !== this._playerCX || pcz !== this._playerCZ;
    this._playerCX = pcx; this._playerCZ = pcz;

    if (moved || this._sortCounter++ % 30 === 0) {
      this._requestRing(pcx, pcz);
      this._unloadFar(pcx, pcz);
      this._sortQueues(pcx, pcz);
    }

    const deadline = performance.now() + budgetMs;
    let guard = 0;
    while (performance.now() < deadline && guard++ < 512) {
      if (!this._pipelineStep(pcx, pcz)) break;
    }

    // 光照 BFS
    const t0 = performance.now();
    this.lighting.process(14000);
    this.stats.lastLightMs = performance.now() - t0;

    this.stats.chunkCount = this.chunks.size;
  }

  _requestRing(pcx, pcz) {
    const r = this.renderDistance + 1;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue;
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
  }

  _unloadFar(pcx, pcz) {
    const limit = this.renderDistance + 3;
    const limitSq = limit * limit;
    for (const [key, c] of this.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz <= limitSq) continue;
      c.disposeMeshes();
      this.chunks.delete(key);
      for (let si = 0; si < SECTION_COUNT; si++) this.dirtySections.delete(c.cx + ',' + c.cz + ',' + si);
      bus.emit(EV.CHUNK_UNLOADED, c.cx, c.cz);
    }
  }

  _sortQueues(pcx, pcz) {
    const dist = (key) => {
      const i = key.indexOf(',');
      const cx = +key.slice(0, i), cz = +key.slice(i + 1);
      const dx = cx - pcx, dz = cz - pcz;
      return dx * dx + dz * dz;
    };
    this.genQueue.sort((a, b) => dist(a) - dist(b));
    this.decorQueue.sort((a, b) => dist(a) - dist(b));
    this.lightQueue.sort((a, b) => dist(a) - dist(b));
  }

  /** 推进一个流水线步骤，返回是否还有工作 */
  _pipelineStep() {
    // 1) 光照（最后一步，优先完成，让区块尽快可见）
    while (this.lightQueue.length) {
      const key = this.lightQueue.shift();
      const c = this.chunks.get(key);
      if (!c || c.state >= STATE.LIT) continue;
      if (!this._neighborsAtLeast(c, STATE.DECORATED)) { this.lightQueue.push(key); break; }
      this.lighting.initChunk(c);
      c.state = STATE.LIT;
      c.lightDirty = false;
      this.markChunkDirty(c.cx, c.cz);
      // 邻居边界需要刷新
      this.markChunkDirty(c.cx - 1, c.cz);
      this.markChunkDirty(c.cx + 1, c.cz);
      this.markChunkDirty(c.cx, c.cz - 1);
      this.markChunkDirty(c.cx, c.cz + 1);
      this.stats.lit++;
      bus.emit(EV.CHUNK_READY, c.cx, c.cz);
      return true;
    }

    // 2) 装饰
    while (this.decorQueue.length) {
      const key = this.decorQueue.shift();
      const c = this.chunks.get(key);
      if (!c || c.state >= STATE.DECORATED) continue;
      if (!this._neighborsAtLeast(c, STATE.GENERATED)) { this.decorQueue.push(key); break; }
      this.generator.decorate(c, this);
      this._applyEdits(c);
      this.lightQueue.push(key);
      this.stats.decorated++;
      return true;
    }

    // 3) 地形
    if (this.genQueue.length) {
      const key = this.genQueue.shift();
      const c = this.chunks.get(key);
      if (!c || c.state >= STATE.GENERATED) return true;
      const t0 = performance.now();
      this.generator.generateChunk(c);
      this.stats.lastGenMs = performance.now() - t0;
      this.stats.generated++;
      this.decorQueue.push(key);
      return true;
    }

    // 4) 因装饰而失效的光照
    for (const c of this.chunks.values()) {
      if (c.lightDirty && c.state >= STATE.LIT) {
        c.lightDirty = false;
        this.lighting.initChunk(c);
        this.markChunkDirty(c.cx, c.cz);
        return true;
      }
    }

    return false;
  }

  _neighborsAtLeast(c, state) {
    // 注意：缺失的邻居（加载圈外的对角区块）不能阻塞状态推进，
    // 否则边缘区块永远到不了 DECORATED/LIT → 整圈区块不渲染（虚空）。
    // 光照与装饰都能容忍邻居缺失（边界 BFS 修正 / setBlock 静默丢弃）。
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const n = this.getChunk(c.cx + dx, c.cz + dz);
        if (!n) continue;
        if (n.state < state) return false;
      }
    }
    return true;
  }

  _applyEdits(c) {
    const m = this.edits.get(c.key);
    if (!m) return;
    for (const [i, id] of m) {
      c.blocks[i] = id;
      if (id !== AIR) c.sectionEmpty[i >> 12] = 0;
    }
    c.recomputeAllColumns();
    c.recomputeSectionEmptiness();
  }

  /** 区块是否可以建网格 */
  canMesh(c) {
    if (c.state < STATE.LIT) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || n.state < STATE.DECORATED) return false;
    }
    return true;
  }

  /** 世界初始化：同步生成玩家附近的区块（避免掉进虚空） */
  primeAround(x, z, radius = 3, onProgress = null) {
    const pcx = x >> 4, pcz = z >> 4;
    const keys = [];
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        const c = this.ensureChunk(pcx + dx, pcz + dz);
        keys.push(c);
      }
    }
    // 地形
    for (const c of keys) if (c.state < STATE.GENERATED) this.generator.generateChunk(c);
    onProgress?.(0.35, '生成地形');
    // 装饰
    for (const c of keys) {
      if (c.state === STATE.GENERATED && this._neighborsAtLeast(c, STATE.GENERATED)) {
        this.generator.decorate(c, this);
        this._applyEdits(c);
      }
    }
    onProgress?.(0.6, '种植树木');
    // 光照
    for (const c of keys) {
      if (c.state >= STATE.DECORATED && c.state < STATE.LIT && this._neighborsAtLeast(c, STATE.DECORATED)) {
        this.lighting.initChunk(c);
        c.state = STATE.LIT;
        this.markChunkDirty(c.cx, c.cz);
      }
    }
    this.lighting.flush();
    onProgress?.(0.85, '计算光照');
    // 清理队列中已完成的项
    this.genQueue = this.genQueue.filter(k => (this.chunks.get(k)?.state ?? 0) < STATE.GENERATED);
    this.decorQueue = this.decorQueue.filter(k => {
      const c = this.chunks.get(k); return c && c.state < STATE.DECORATED;
    });
    this.lightQueue = this.lightQueue.filter(k => {
      const c = this.chunks.get(k); return c && c.state < STATE.LIT;
    });
    for (const c of this.chunks.values()) {
      if (c.state >= STATE.DECORATED && c.state < STATE.LIT && !this.lightQueue.includes(c.key)) {
        this.lightQueue.push(c.key);
      }
    }
  }

  /** 找一个安全的出生点 */
  findSpawn() {
    const gen = this.generator;
    for (let r = 0; r < 64; r += 4) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r);
        const z = Math.round(Math.sin(ang) * r);
        const h = gen.surfaceHeight(x, z);
        if (h > SEA_LEVEL + 1 && h < 96) {
          return [x + 0.5, h + 1.2, z + 0.5];
        }
      }
    }
    return [0.5, gen.surfaceHeight(0, 0) + 2, 0.5];
  }

  /** 某坐标最高可站立位置 */
  highestSolidY(x, z) {
    const c = this.getChunkAt(x, z);
    if (c && c.state >= STATE.GENERATED) {
      const h = c.heightMap[((z & 15) << 4) | (x & 15)];
      for (let y = h; y >= 0; y--) {
        const id = c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
        if (id !== AIR && IS_SOLID[id]) return y + 1;
      }
      return 1;
    }
    return this.generator.surfaceHeight(x, z) + 1;
  }

  /* ================= 时间 / 天气 / 方块刻 ================= */

  tick(tickIndex) {
    if (this.doDaylightCycle) {
      this.timeOfDay += 1;
      if (this.timeOfDay >= 24000) { this.timeOfDay = 0; this.dayCount++; }
    }

    // 天气
    this.weatherTimer -= 1;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 2400 + Math.floor(Math.random() * 6000);
      const r = Math.random();
      const next = r < 0.68 ? 'clear' : (r < 0.93 ? 'rain' : 'thunder');
      if (next !== this.weather) {
        this.weather = next;
        bus.emit(EV.WEATHER_CHANGED, next);
      }
    }

    // 落沙
    this._processFalling();

    // 随机刻（草蔓延、树苗生长）
    if (tickIndex % 4 === 0) this._randomTicks();
  }

  get dayFraction() { return this.timeOfDay / 24000; }

  /** 阳光强度 0..1 */
  get daylight() {
    const t = this.timeOfDay;
    // 0=日出, 6000=正午, 12000=日落, 18000=午夜
    let d;
    if (t < 1500) d = 0.35 + (t / 1500) * 0.65;           // 清晨
    else if (t < 10500) d = 1;                             // 白天
    else if (t < 13500) d = 1 - ((t - 10500) / 3000) * 0.88; // 黄昏
    else if (t < 22500) d = 0.12;                          // 夜晚
    else d = 0.12 + ((t - 22500) / 1500) * 0.23;           // 破晓
    if (this.weather === 'rain') d *= 0.72;
    if (this.weather === 'thunder') d *= 0.5;
    return d;
  }

  get isNight() { return this.timeOfDay > 13000 && this.timeOfDay < 23000; }

  _scheduleFalling(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id <= 0) return;
    const b = BLOCKS[id];
    if (b && b.gravity) this.fallingQueue.push([x, y, z]);
  }

  _processFalling() {
    let n = 0;
    while (this.fallingQueue.length && n++ < 64) {
      const [x, y, z] = this.fallingQueue.pop();
      const id = this.getBlock(x, y, z);
      if (id <= 0) continue;
      const b = BLOCKS[id];
      if (!b || !b.gravity) continue;
      const below = this.getBlock(x, y - 1, z);
      if (below === AIR || (below > 0 && BLOCKS[below].liquid)) {
        this.setBlock(x, y, z, AIR, { physics: false });
        this.setBlock(x, y - 1, z, id, { physics: false });
        this.fallingQueue.push([x, y - 1, z]);
        this._scheduleFalling(x, y + 1, z);
      }
    }
  }

  _randomTicks() {
    const ids = this._ids;
    const r = this.renderDistance;
    const cx0 = this._playerCX, cz0 = this._playerCZ;
    const tries = this.randomTickSpeed * 6;
    for (let t = 0; t < tries; t++) {
      const cx = cx0 + ((Math.random() * (2 * r + 1)) | 0) - r;
      const cz = cz0 + ((Math.random() * (2 * r + 1)) | 0) - r;
      const c = this.getChunk(cx, cz);
      if (!c || c.state < STATE.LIT) continue;
      const lx = (Math.random() * 16) | 0, lz = (Math.random() * 16) | 0;
      const ci = (lz << 4) | lx;
      const h = c.heightMap[ci];
      if (h <= 1) continue;
      const y = Math.max(1, Math.min(CHUNK_HEIGHT - 2, h - 1 + ((Math.random() * 3) | 0) - 1));
      const wx = c.originX + lx, wz = c.originZ + lz;
      const id = c.blocks[(y << 8) | ci];

      // 泥土长草
      if (id === ids.dirt) {
        const above = c.blocks[((y + 1) << 8) | ci];
        if (above === AIR && this.getSkyLight(wx, y + 1, wz) >= 9) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (this.getBlockSafe(wx + dx, y, wz + dz) === ids.grass) {
              this.setBlock(wx, y, wz, ids.grass, { record: false });
              break;
            }
          }
        }
      }
      // 树苗长树
      else if (id === ids.sapling) {
        if (this.getSkyLight(wx, y, wz) >= 9 && Math.random() < 0.12) {
          this.setBlock(wx, y, wz, AIR, { record: false });
          this.generator._placeTree(this, wx, y, wz, 'oak', { int: (a, b2) => a + ((Math.random() * (b2 - a + 1)) | 0), chance: (p) => Math.random() < p, float: () => Math.random(), bool: () => Math.random() < 0.5, pick: (arr) => arr[(Math.random() * arr.length) | 0] });
          this.markChunkDirty(cx, cz);
        }
      }
      // 草蔓延
      else if (id === ids.grass && Math.random() < 0.06) {
        const above = c.blocks[((y + 1) << 8) | ci];
        if (above === AIR && this.getSkyLight(wx, y + 1, wz) >= 9 && Math.random() < 0.25) {
          this.setBlock(wx, y + 1, wz, ids.tallGrass, { record: false });
        }
      }
    }
  }

  /* ================= 查询辅助 ================= */

  biomeAt(x, z) {
    const c = this.getChunkAt(x, z);
    if (!c) return this.generator.columnInfo(x, z).biome;
    return c.biomes[((z & 15) << 4) | (x & 15)];
  }

  biomeInfoAt(x, z) { return biomeInfo(this.biomeAt(x, z)); }

  isOpaque(x, y, z) {
    const id = this.getBlock(x, y, z);
    return id > 0 && IS_OPAQUE[id] === 1;
  }

  isSolid(x, y, z) {
    const id = this.getBlockCollide(x, y, z);
    return id > 0 && IS_SOLID[id] === 1;
  }

  isLiquid(x, y, z) {
    const id = this.getBlockSafe(x, y, z);
    return id > 0 && BLOCKS[id].liquid;
  }

  blockDefAt(x, y, z) { return blockDef(Math.max(0, this.getBlockSafe(x, y, z))); }

  get loadedChunkCount() { return this.chunks.size; }
  get pendingChunks() { return this.genQueue.length + this.decorQueue.length + this.lightQueue.length; }

  get memoryMB() {
    let bytes = 0;
    for (const c of this.chunks.values()) bytes += c.memoryBytes;
    return bytes / 1048576;
  }

  /* ================= 存档 ================= */

  serialize(player = null) {
    const edits = [];
    for (const [key, m] of this.edits) {
      const arr = [];
      for (const [i, id] of m) arr.push(i, id);
      if (arr.length) edits.push([key, arr]);
    }
    return {
      version: 1,
      name: this.name,
      seed: this.seedString,
      type: this.type,
      timeOfDay: this.timeOfDay,
      dayCount: this.dayCount,
      weather: this.weather,
      edits,
      player,
    };
  }

  loadEdits(data) {
    if (!data || !data.edits) return;
    this.edits.clear();
    for (const [key, arr] of data.edits) {
      const m = new Map();
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
      this.edits.set(key, m);
    }
    if (typeof data.timeOfDay === 'number') this.timeOfDay = data.timeOfDay;
    if (typeof data.dayCount === 'number') this.dayCount = data.dayCount;
    if (data.weather) this.weather = data.weather;
  }
}
