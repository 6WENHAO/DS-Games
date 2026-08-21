/**
 * voxel/volume.js —— 稠密体素容器
 *
 * 采用「世界坐标 + 原点偏移」的稠密 Uint8Array，牺牲少量内存换取网格化时
 * O(1) 的邻域查询（贪心网格化与 AO 计算都是邻域密集型操作）。
 * 每个舱段一个独立 Volume，因此可以各自拥有变换矩阵（自转、爆炸视图、装配动画）。
 */

export class VoxelVolume {
  /**
   * @param {number} minX @param {number} minY @param {number} minZ 世界坐标下的包围盒最小角
   * @param {number} sx @param {number} sy @param {number} sz 各轴体素数量
   */
  constructor(minX, minY, minZ, sx, sy, sz) {
    this.min = [minX | 0, minY | 0, minZ | 0];
    this.size = [sx | 0, sy | 0, sz | 0];
    this.data = new Uint8Array(sx * sy * sz);
    this.strideY = sx;
    this.strideZ = sx * sy;
    this.count = 0;
    /** 实际写入区域的紧包围盒（世界坐标） */
    this.usedMin = [Infinity, Infinity, Infinity];
    this.usedMax = [-Infinity, -Infinity, -Infinity];
    this.clipped = 0; // 越界写入次数，用于建模自检
  }

  /** 世界坐标 → 线性索引，越界返回 -1 */
  index(x, y, z) {
    const lx = x - this.min[0], ly = y - this.min[1], lz = z - this.min[2];
    if (lx < 0 || ly < 0 || lz < 0 || lx >= this.size[0] || ly >= this.size[1] || lz >= this.size[2]) return -1;
    return lx + ly * this.strideY + lz * this.strideZ;
  }

  /** 读取材质 id（越界视为真空） */
  get(x, y, z) {
    const i = this.index(x, y, z);
    return i < 0 ? 0 : this.data[i];
  }

  /** 写入材质 id（0 = 挖空） */
  set(x, y, z, mat) {
    const i = this.index(x, y, z);
    if (i < 0) { this.clipped++; return false; }
    const prev = this.data[i];
    if (prev === mat) return true;
    if (prev === 0 && mat !== 0) this.count++;
    else if (prev !== 0 && mat === 0) this.count--;
    this.data[i] = mat;
    if (mat !== 0) {
      if (x < this.usedMin[0]) this.usedMin[0] = x;
      if (y < this.usedMin[1]) this.usedMin[1] = y;
      if (z < this.usedMin[2]) this.usedMin[2] = z;
      if (x > this.usedMax[0]) this.usedMax[0] = x;
      if (y > this.usedMax[1]) this.usedMax[1] = y;
      if (z > this.usedMax[2]) this.usedMax[2] = z;
    }
    return true;
  }

  /** 仅在该位置为空时写入（用于"不覆盖已有结构"的贴花/greeble） */
  setIfEmpty(x, y, z, mat) {
    const i = this.index(x, y, z);
    if (i < 0) { this.clipped++; return false; }
    if (this.data[i] !== 0) return false;
    return this.set(x, y, z, mat);
  }

  /** 仅在该位置非空时替换（用于表面重涂：条纹、标识、风化） */
  repaint(x, y, z, mat) {
    const i = this.index(x, y, z);
    if (i < 0) return false;
    if (this.data[i] === 0) return false;
    this.data[i] = mat;
    return true;
  }

  /** 该体素是否为实心 */
  solid(x, y, z) {
    const i = this.index(x, y, z);
    return i >= 0 && this.data[i] !== 0;
  }

  /** 是否为暴露在真空中的表面体素（六邻域至少一面为空） */
  exposed(x, y, z) {
    if (!this.solid(x, y, z)) return false;
    return !this.solid(x + 1, y, z) || !this.solid(x - 1, y, z) ||
           !this.solid(x, y + 1, z) || !this.solid(x, y - 1, z) ||
           !this.solid(x, y, z + 1) || !this.solid(x, y, z - 1);
  }

  /** 空容器 */
  get empty() { return this.count === 0; }

  /** 已使用区域尺寸（世界坐标包围盒） */
  bounds() {
    if (this.count === 0) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
    const min = this.usedMin.slice(), max = this.usedMax.slice();
    return {
      min, max,
      size: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1],
      center: [(min[0] + max[0] + 1) / 2, (min[1] + max[1] + 1) / 2, (min[2] + max[2] + 1) / 2],
    };
  }

  /**
   * 裁剪为紧包围盒（外扩 1 体素保留邻域上下文，AO 需要）。
   * 返回新的 VoxelVolume；若已经很紧凑则返回自身。
   */
  trim(pad = 1) {
    if (this.count === 0) return this;
    const b = this.bounds();
    const nx = b.size[0] + pad * 2, ny = b.size[1] + pad * 2, nz = b.size[2] + pad * 2;
    if (nx * ny * nz >= this.data.length * 0.85) return this;
    const out = new VoxelVolume(b.min[0] - pad, b.min[1] - pad, b.min[2] - pad, nx, ny, nz);
    for (let z = b.min[2]; z <= b.max[2]; z++) {
      for (let y = b.min[1]; y <= b.max[1]; y++) {
        const srcRow = (y - this.min[1]) * this.strideY + (z - this.min[2]) * this.strideZ;
        const dstRow = (y - out.min[1]) * out.strideY + (z - out.min[2]) * out.strideZ;
        for (let x = b.min[0]; x <= b.max[0]; x++) {
          const v = this.data[(x - this.min[0]) + srcRow];
          if (v !== 0) out.data[(x - out.min[0]) + dstRow] = v;
        }
      }
    }
    out.count = this.count;
    out.usedMin = b.min.slice();
    out.usedMax = b.max.slice();
    out.clipped = this.clipped;
    return out;
  }

  /** 统计每种材质的体素数量（用于舱段档案面板） */
  histogram() {
    const h = new Uint32Array(256);
    const d = this.data;
    for (let i = 0; i < d.length; i++) h[d[i]]++;
    h[0] = 0;
    return h;
  }

  /** 结构化克隆用的裸数据（供 Worker → 主线程零拷贝转移） */
  serialize() {
    return { min: this.min.slice(), size: this.size.slice(), data: this.data, count: this.count };
  }

  /** @param {{min:number[],size:number[],data:Uint8Array,count:number}} raw */
  static deserialize(raw) {
    const v = new VoxelVolume(raw.min[0], raw.min[1], raw.min[2], raw.size[0], raw.size[1], raw.size[2]);
    v.data = raw.data;
    v.count = raw.count;
    return v;
  }
}
