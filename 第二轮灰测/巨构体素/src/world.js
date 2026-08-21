/**
 * 稀疏体素世界。
 * - 16³ 区块，Map 索引，只为被写入的区域分配内存 → 支持 500×500×1600 这种“巨构级”尺度
 * - fillBox 走逐区块 typed-array fill，百万级体素填充仍是毫秒量级
 */

export const CS = 16;            // chunk size
export const CS2 = CS * CS;
export const CS3 = CS * CS * CS;
const BIAS = 512;                // 区块坐标偏移（支持 -512..511 → 世界 ±8192）

export function chunkKey(cx, cy, cz) {
  return ((cx + BIAS) << 20) | ((cy + BIAS) << 10) | (cz + BIAS);
}

export class VoxelWorld {
  constructor() {
    this.chunks = new Map();      // key -> Uint8Array(4096)
    this.fullness = new Map();    // key -> 非空体素数（生成后统一计算）
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
    this.writes = 0;
    this._ck = -1; this._cd = null;   // 写缓存
    this._gk = -1; this._gd = null;   // 读缓存
  }

  _invalidate() { this._ck = -1; this._cd = null; this._gk = -1; this._gd = null; }

  ensure(cx, cy, cz) {
    const k = chunkKey(cx, cy, cz);
    let d = this.chunks.get(k);
    if (d === undefined) {
      d = new Uint8Array(CS3);
      this.chunks.set(k, d);
      this._gk = -1; this._gd = null;
    }
    return d;
  }

  getChunkData(cx, cy, cz) {
    return this.chunks.get(chunkKey(cx, cy, cz));
  }

  hasChunk(cx, cy, cz) {
    return this.chunks.has(chunkKey(cx, cy, cz));
  }

  get(x, y, z) {
    const d = this.chunks.get(chunkKey(x >> 4, y >> 4, z >> 4));
    if (d === undefined) return 0;
    return d[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)];
  }

  set(x, y, z, m) {
    if (m === 0) {
      const d = this.chunks.get(chunkKey(x >> 4, y >> 4, z >> 4));
      if (d === undefined) return;
      d[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)] = 0;
      return;
    }
    const d = this.ensure(x >> 4, y >> 4, z >> 4);
    d[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)] = m;
    this._bump(x, y, z);
  }

  /**
   * 带区块缓存的快速写入。细节绘制在空间上是连续的，命中率极高，
   * 相比 set() 可省掉绝大多数 Map 查询。
   */
  setC(x, y, z, m) {
    const k = chunkKey(x >> 4, y >> 4, z >> 4);
    if (k !== this._ck) {
      this._ck = k;
      this._cd = this.chunks.get(k) ?? null;
    }
    if (this._cd === null) {
      if (m === 0) return;
      this._cd = this.ensure(x >> 4, y >> 4, z >> 4);
    }
    this._cd[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)] = m;
    if (m !== 0) this._bump(x, y, z);
  }

  getC(x, y, z) {
    const k = chunkKey(x >> 4, y >> 4, z >> 4);
    if (k !== this._gk) {
      this._gk = k;
      this._gd = this.chunks.get(k) ?? null;
    }
    if (this._gd === null) return 0;
    return this._gd[(x & 15) | ((y & 15) << 4) | ((z & 15) << 8)];
  }

  /** 只在原本是空气时写入（用于叠加细节而不破坏已有结构） */
  setIfAir(x, y, z, m) {
    const d = this.ensure(x >> 4, y >> 4, z >> 4);
    const i = (x & 15) | ((y & 15) << 4) | ((z & 15) << 8);
    if (d[i] === 0) { d[i] = m; this._bump(x, y, z); }
  }

  /** 只替换已有实体（用于给表面“上漆”） */
  paint(x, y, z, m) {
    const d = this.chunks.get(chunkKey(x >> 4, y >> 4, z >> 4));
    if (d === undefined) return;
    const i = (x & 15) | ((y & 15) << 4) | ((z & 15) << 8);
    if (d[i] !== 0) d[i] = m;
  }

  _bump(x, y, z) {
    this.writes++;
    const mn = this.min, mx = this.max;
    if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x;
    if (y < mn[1]) mn[1] = y; if (y > mx[1]) mx[1] = y;
    if (z < mn[2]) mn[2] = z; if (z > mx[2]) mx[2] = z;
  }

  /** 闭区间实心盒填充（逐区块 fill，极快） */
  fillBox(x0, y0, z0, x1, y1, z1, m) {
    if (x1 < x0 || y1 < y0 || z1 < z0) return;
    const cx0 = x0 >> 4, cx1 = x1 >> 4;
    const cy0 = y0 >> 4, cy1 = y1 >> 4;
    const cz0 = z0 >> 4, cz1 = z1 >> 4;
    for (let cz = cz0; cz <= cz1; cz++) {
      const oz = cz << 4;
      const lz0 = Math.max(z0 - oz, 0), lz1 = Math.min(z1 - oz, 15);
      for (let cy = cy0; cy <= cy1; cy++) {
        const oy = cy << 4;
        const ly0 = Math.max(y0 - oy, 0), ly1 = Math.min(y1 - oy, 15);
        for (let cx = cx0; cx <= cx1; cx++) {
          const ox = cx << 4;
          const lx0 = Math.max(x0 - ox, 0), lx1 = Math.min(x1 - ox, 15);
          let d;
          if (m === 0) {
            d = this.chunks.get(chunkKey(cx, cy, cz));
            if (d === undefined) continue;
          } else {
            d = this.ensure(cx, cy, cz);
          }
          for (let lz = lz0; lz <= lz1; lz++) {
            const zb = lz << 8;
            for (let ly = ly0; ly <= ly1; ly++) {
              const base = zb | (ly << 4);
              d.fill(m, base + lx0, base + lx1 + 1);
            }
          }
        }
      }
    }
    if (m !== 0) {
      this._bump(x0, y0, z0);
      this._bump(x1, y1, z1);
      this.writes += (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    }
  }

  /** 生成结束后统计每区块非空数量，用于网格化时跳过“完全内部”的区块 */
  computeFullness() {
    this.fullness.clear();
    let solid = 0;
    for (const [k, d] of this.chunks) {
      let c = 0;
      for (let i = 0; i < CS3; i++) if (d[i] !== 0) c++;
      this.fullness.set(k, c);
      solid += c;
    }
    this.solidCount = solid;
    return solid;
  }

  isFull(cx, cy, cz) {
    return this.fullness.get(chunkKey(cx, cy, cz)) === CS3;
  }

  /** 该区块本身满且六邻满 → 无任何暴露面，网格化可整块跳过 */
  isBuried(cx, cy, cz) {
    if (!this.isFull(cx, cy, cz)) return false;
    return this.isFull(cx + 1, cy, cz) && this.isFull(cx - 1, cy, cz)
        && this.isFull(cx, cy + 1, cz) && this.isFull(cx, cy - 1, cz)
        && this.isFull(cx, cy, cz + 1) && this.isFull(cx, cy, cz - 1);
  }

  /** 从 (x,y,z) 向下找到第一个实体的顶面高度（用于放置道具/出生点） */
  groundAt(x, z, yStart, yMin = -64) {
    for (let y = yStart; y >= yMin; y--) {
      if (this.get(x, y, z) !== 0) return y + 1;
    }
    return yMin;
  }

  memoryMB() {
    return (this.chunks.size * CS3) / (1024 * 1024);
  }
}
