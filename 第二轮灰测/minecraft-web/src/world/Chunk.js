/* =====================================================================
 * Chunk — 16×128×16 的体素列
 *   blocks: Uint8Array(32768)   方块 ID
 *   light : Uint8Array(32768)   高 4 位天光 / 低 4 位块光
 *   索引  : (y << 8) | (z << 4) | x
 * ===================================================================== */
import {
  CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_VOLUME, CHUNK_AREA,
  SECTION_COUNT, SECTION_HEIGHT, LAYER,
} from '../core/Constants.js';
import { IS_OPAQUE, EMISSION } from '../data/blocks.js';

export const STATE = Object.freeze({
  EMPTY: 0,        // 刚创建
  GENERATED: 1,    // 地形已生成
  DECORATED: 2,    // 树木/矿脉等装饰完成
  LIT: 3,          // 光照计算完成
  READY: 4,        // 网格已构建
});

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = cx + ',' + cz;
    this.originX = cx * CHUNK_SIZE;
    this.originZ = cz * CHUNK_SIZE;

    this.blocks = new Uint8Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.heightMap = new Uint8Array(CHUNK_AREA);   // 最高非空气方块的 y+1
    this.surfaceMap = new Uint8Array(CHUNK_AREA);  // 最高不透光方块的 y+1（天光用）
    this.biomes = new Uint8Array(CHUNK_AREA);

    this.state = STATE.EMPTY;
    this.sectionEmpty = new Uint8Array(SECTION_COUNT).fill(1);
    this.sectionDirty = new Uint8Array(SECTION_COUNT);
    this.lightDirty = false;
    this.meshes = new Array(SECTION_COUNT);        // [si] = { [layer]: Mesh }
    for (let i = 0; i < SECTION_COUNT; i++) this.meshes[i] = [null, null, null];
    this.triangleCount = 0;
    this.lastUsed = 0;
    this.emitters = [];        // 生成阶段记录的光源索引，供光照初始化
    this.modified = false;     // 是否被玩家改动（存档用）
  }

  // ---------------- 方块访问（局部坐标，调用者保证范围） ----------------
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.blocks[(y << 8) | (z << 4) | x];
  }

  setBlockRaw(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const i = (y << 8) | (z << 4) | x;
    this.blocks[i] = id;
    if (id !== 0) this.sectionEmpty[y >> 4] = 0;
  }

  getLight(x, y, z) {
    if (y < 0) return 0;
    if (y >= CHUNK_HEIGHT) return 0xF0;
    return this.light[(y << 8) | (z << 4) | x];
  }
  getSkyLight(x, y, z) {
    if (y < 0) return 0;
    if (y >= CHUNK_HEIGHT) return 15;
    return this.light[(y << 8) | (z << 4) | x] >> 4;
  }
  getBlockLight(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.light[(y << 8) | (z << 4) | x] & 15;
  }
  setSkyLight(x, y, z, v) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const i = (y << 8) | (z << 4) | x;
    this.light[i] = (this.light[i] & 0x0F) | (v << 4);
  }
  setBlockLight(x, y, z, v) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const i = (y << 8) | (z << 4) | x;
    this.light[i] = (this.light[i] & 0xF0) | v;
  }

  // ---------------- 高度图 ----------------
  /** 重新计算某一列的高度与遮光高度 */
  recomputeColumn(x, z) {
    const ci = (z << 4) | x;
    let top = 0, surface = 0;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const id = this.blocks[(y << 8) | ci];
      if (id !== 0) {
        if (top === 0) top = y + 1;
        if (IS_OPAQUE[id]) { surface = y + 1; break; }
      }
    }
    this.heightMap[ci] = top;
    this.surfaceMap[ci] = surface;
  }

  recomputeAllColumns() {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) this.recomputeColumn(x, z);
    }
  }

  getHeight(x, z) { return this.heightMap[(z << 4) | x]; }
  getSurface(x, z) { return this.surfaceMap[(z << 4) | x]; }
  getBiome(x, z) { return this.biomes[(z << 4) | x]; }

  /** 重新统计 section 是否为空 */
  recomputeSectionEmptiness() {
    for (let s = 0; s < SECTION_COUNT; s++) {
      let empty = 1;
      const start = s * SECTION_HEIGHT * CHUNK_AREA;
      const end = start + SECTION_HEIGHT * CHUNK_AREA;
      for (let i = start; i < end; i++) {
        if (this.blocks[i] !== 0) { empty = 0; break; }
      }
      this.sectionEmpty[s] = empty;
    }
  }

  /** 收集自发光方块（供光照 BFS 播种） */
  collectEmitters() {
    this.emitters.length = 0;
    for (let i = 0; i < CHUNK_VOLUME; i++) {
      const id = this.blocks[i];
      if (id !== 0 && EMISSION[id] > 0) this.emitters.push(i);
    }
    return this.emitters;
  }

  markSectionDirty(si) {
    if (si >= 0 && si < SECTION_COUNT) this.sectionDirty[si] = 1;
  }

  markAllSectionsDirty() {
    this.sectionDirty.fill(1);
  }

  hasDirtySections() {
    for (let i = 0; i < SECTION_COUNT; i++) if (this.sectionDirty[i]) return true;
    return false;
  }

  /** 释放 GPU 资源 */
  disposeMeshes() {
    for (let s = 0; s < SECTION_COUNT; s++) {
      const m = this.meshes[s];
      for (let l = 0; l < LAYER.COUNT; l++) {
        if (m[l]) { m[l].destroy(); m[l] = null; }
      }
    }
    this.triangleCount = 0;
  }

  get memoryBytes() {
    return this.blocks.byteLength + this.light.byteLength +
      this.heightMap.byteLength + this.surfaceMap.byteLength + this.biomes.byteLength;
  }
}

/** 世界坐标 -> 区块坐标 */
export const toChunkCoord = (v) => v >> 4;
/** 世界坐标 -> 区块内局部坐标 */
export const toLocalCoord = (v) => v & 15;
export const chunkKey = (cx, cz) => cx + ',' + cz;
