import * as THREE from 'three';
import { PALETTE } from './palette.js';

const OFF = 512;             // 坐标偏移，支持 -512..511
const S1 = 1024;
const S2 = 1024 * 1024;

const encode = (x, y, z) => (x + OFF) + (y + OFF) * S1 + (z + OFF) * S2;

function decode(k) {
  const z = Math.floor(k / S2);
  const r = k - z * S2;
  const y = Math.floor(r / S1);
  const x = r - y * S1;
  return [x - OFF, y - OFF, z - OFF];
}

/** 稳定伪随机（同一坐标恒定），用于材质噪点 */
function hash3(x, y, z) {
  let n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  n = n < 0 ? -n : n;
  return (n % 4096) / 4096;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * 体素世界：稀疏 Map 存储 → 相邻面剔除 → 每材质一个 InstancedMesh
 */
export class VoxelWorld {
  constructor() {
    this.map = new Map();
    this.placed = 0;
  }

  /* ---------------- 基础写入 ---------------- */

  set(x, y, z, mat) {
    if (!mat) throw new Error(`VoxelWorld.set: 缺少材质 (${x},${y},${z})`);
    this.map.set(encode(Math.round(x), Math.round(y), Math.round(z)), mat);
    this.placed++;
    return this;
  }

  /** 仅在空位放置（不覆盖已有体素） */
  setIfEmpty(x, y, z, mat) {
    const k = encode(Math.round(x), Math.round(y), Math.round(z));
    if (!this.map.has(k)) this.map.set(k, mat);
    return this;
  }

  get(x, y, z) {
    return this.map.get(encode(Math.round(x), Math.round(y), Math.round(z)));
  }

  has(x, y, z) {
    return this.map.has(encode(Math.round(x), Math.round(y), Math.round(z)));
  }

  del(x, y, z) {
    this.map.delete(encode(Math.round(x), Math.round(y), Math.round(z)));
    return this;
  }

  /* ---------------- 体块工具（坐标闭区间） ---------------- */

  box(x0, y0, z0, x1, y1, z1, mat) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = Math.round(ax); x <= Math.round(bx); x++)
      for (let y = Math.round(ay); y <= Math.round(by); y++)
        for (let z = Math.round(az); z <= Math.round(bz); z++) this.set(x, y, z, mat);
    return this;
  }

  clearBox(x0, y0, z0, x1, y1, z1) {
    for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++)
      for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++)
        for (let z = Math.round(Math.min(z0, z1)); z <= Math.round(Math.max(z0, z1)); z++)
          this.del(x, y, z);
    return this;
  }

  /** 水平实心矩形（单层） */
  slab(x0, z0, x1, z1, y, mat) {
    return this.box(x0, y, z0, x1, y, z1, mat);
  }

  /** 水平环（墙圈 / 屋面环），t = 壁厚 */
  ring(x0, z0, x1, z1, y, mat, t = 1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let x = ax; x <= bx; x++)
      for (let z = az; z <= bz; z++) {
        const d = Math.min(x - ax, bx - x, z - az, bz - z);
        if (d < t) this.set(x, y, z, mat);
      }
    return this;
  }

  /** 竖直空心盒（四面墙），y 为闭区间 */
  wallBox(x0, z0, x1, z1, yFrom, yTo, mat, t = 1) {
    for (let y = yFrom; y <= yTo; y++) this.ring(x0, z0, x1, z1, y, mat, t);
    return this;
  }

  /** 竖柱 */
  pillar(x, z, yFrom, yTo, mat) {
    return this.box(x, yFrom, z, x, yTo, z, mat);
  }

  /* ---------------- 网格生成 ---------------- */

  get size() {
    return this.map.size;
  }

  isOpaque(x, y, z) {
    if (y < 0) return true;                    // 视为基岩：地面层底面永不可见
    const m = this.map.get(encode(x, y, z));
    if (!m) return false;
    return PALETTE[m]?.opaque !== false;
  }

  /** 六面全被不透明体素包裹 → 不必渲染 */
  isHidden(x, y, z) {
    return (
      this.isOpaque(x + 1, y, z) && this.isOpaque(x - 1, y, z) &&
      this.isOpaque(x, y + 1, z) && this.isOpaque(x, y - 1, z) &&
      this.isOpaque(x, y, z + 1) && this.isOpaque(x, y, z - 1)
    );
  }

  /** 上方遮蔽计数 → 伪 AO，让檐下、廊道自然变暗 */
  aoShade(x, y, z) {
    let n = 0;
    if (this.isOpaque(x, y + 1, z)) n += 2;
    if (this.isOpaque(x + 1, y + 1, z)) n++;
    if (this.isOpaque(x - 1, y + 1, z)) n++;
    if (this.isOpaque(x, y + 1, z + 1)) n++;
    if (this.isOpaque(x, y + 1, z - 1)) n++;
    if (this.isOpaque(x + 1, y, z) && this.isOpaque(x, y, z + 1)) n++;
    if (this.isOpaque(x - 1, y, z) && this.isOpaque(x, y, z - 1)) n++;
    return Math.max(0.6, 1 - 0.052 * n);
  }

  /**
   * 生成 InstancedMesh 组
   * @returns {{ group: THREE.Group, stats: { total:number, drawn:number, meshes:number } }}
   */
  buildMeshes(materials, { cull = true, ao = true } = {}) {
    const buckets = new Map();
    for (const [k, mat] of this.map) {
      const [x, y, z] = decode(k);
      if (cull && this.isHidden(x, y, z)) continue;
      let arr = buckets.get(mat);
      if (!arr) buckets.set(mat, (arr = []));
      arr.push(x, y, z);
    }

    const group = new THREE.Group();
    group.name = 'voxels';
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let drawn = 0;

    for (const [matKey, arr] of buckets) {
      const material = materials[matKey];
      if (!material) throw new Error(`未知材质: ${matKey}`);
      const def = PALETTE[matKey];
      const count = arr.length / 3;
      const mesh = new THREE.InstancedMesh(BOX, material, count);
      mesh.name = matKey;
      mesh.castShadow = def.shadow !== false;
      mesh.receiveShadow = def.shadow !== false;
      mesh.matrixAutoUpdate = false;

      const vary = def.vary ?? 0.0;
      for (let i = 0; i < count; i++) {
        const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // 明度扰动 + 伪 AO
        const n = (hash3(x, y, z) - 0.5) * 2 * vary;
        const shade = (ao ? this.aoShade(x, y, z) : 1) * (1 + n);
        color.setHex(def.color).multiplyScalar(shade);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      drawn += count;
    }

    return {
      group,
      stats: { total: this.map.size, drawn, meshes: buckets.size }
    };
  }
}
