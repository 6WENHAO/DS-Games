/* ============================================================
   体素引擎：稀疏区块体积 + 贪心网格化(含 AO) + 地面瓦片 + 渲染批次
   坐标：x 东正 / z 南正（北为 -z）/ y 上正，1 体素 = 1 米
   ============================================================ */
'use strict';

const CH = 32;          // 体素区块边长
const CH2 = CH * CH;
const PAD = CH + 2;     // 带一层邻居的padding
const PAD2 = PAD * PAD;
const REG = 128;        // 渲染批次区域边长（必须是 CH 的整数倍）

/* ------------------------------------------------------------
   稀疏体素体积
   ------------------------------------------------------------ */
class Volume {
  constructor() {
    this.chunks = new Map();      // key -> Uint8Array(CH^3)
    this.filled = new Map();      // key -> 非空体素数
    this._ck = -1; this._ca = null;
    this.total = 0;
    this.minX = 1e9; this.maxX = -1e9;
    this.minY = 1e9; this.maxY = -1e9;
    this.minZ = 1e9; this.maxZ = -1e9;
  }
  static key(cx, cy, cz) { return ((cx + 256) * 512 + (cz + 256)) * 64 + (cy + 8); }

  get(x, y, z) {
    const cx = x >> 5, cy = y >> 5, cz = z >> 5;
    const k = ((cx + 256) * 512 + (cz + 256)) * 64 + (cy + 8);
    let a;
    if (k === this._ck) a = this._ca;
    else { a = this.chunks.get(k); this._ck = k; this._ca = a; }
    if (a === undefined) return 0;
    return a[(((x & 31) * CH) + (y & 31)) * CH + (z & 31)];
  }
  set(x, y, z, c) {
    const cx = x >> 5, cy = y >> 5, cz = z >> 5;
    const k = ((cx + 256) * 512 + (cz + 256)) * 64 + (cy + 8);
    let a;
    if (k === this._ck && this._ca !== undefined) a = this._ca;
    else {
      a = this.chunks.get(k);
      if (a === undefined) {
        if (!c) return;
        a = new Uint8Array(CH * CH2);
        this.chunks.set(k, a);
        this.filled.set(k, 0);
      }
      this._ck = k; this._ca = a;
    }
    const i = (((x & 31) * CH) + (y & 31)) * CH + (z & 31);
    const old = a[i];
    if (old === c) return;
    a[i] = c;
    if (!old && c) { this.filled.set(k, this.filled.get(k) + 1); this.total++; }
    else if (old && !c) { this.filled.set(k, this.filled.get(k) - 1); this.total--; }
    if (c) {
      if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x;
      if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
      if (z < this.minZ) this.minZ = z; if (z > this.maxZ) this.maxZ = z;
    }
  }
  /** 实心盒（含端点），y 方向从 y0 到 y1 */
  box(x0, y0, z0, x1, y1, z1, c) {
    if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }
    if (z1 < z0) { const t = z0; z0 = z1; z1 = t; }
    x0 = Math.round(x0); x1 = Math.round(x1); y0 = Math.round(y0);
    y1 = Math.round(y1); z0 = Math.round(z0); z1 = Math.round(z1);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.set(x, y, z, c);
  }
  /** 空心盒：只留外壳（省内存），t = 壳厚 */
  shell(x0, y0, z0, x1, y1, z1, c, t = 1) {
    if (x1 < x0) { const q = x0; x0 = x1; x1 = q; }
    if (y1 < y0) { const q = y0; y0 = y1; y1 = q; }
    if (z1 < z0) { const q = z0; z0 = z1; z1 = q; }
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          if (x < x0 + t || x > x1 - t || y < y0 + t || y > y1 - t || z < z0 + t || z > z1 - t)
            this.set(x, y, z, c);
        }
  }
  /** 仅在空位填充 */
  boxIfEmpty(x0, y0, z0, x1, y1, z1, c) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) if (!this.get(x, y, z)) this.set(x, y, z, c);
  }
  clearBox(x0, y0, z0, x1, y1, z1) { this.box(x0, y0, z0, x1, y1, z1, 0); }
  isSolid(x, y, z) { return this.get(x | 0, y | 0, z | 0) !== 0; }
  memoryMB() { return (this.chunks.size * CH * CH2 / 1048576); }
}

/* ------------------------------------------------------------
   区域批次：把体素面/地面面打包成 GPU 顶点
   顶点 = 2 x uint32：
     u0: px(8) | py(8) | pz(8) | normal(3)      —— 相对区域原点
     u1: color(8) | ao(2) | flag(2)
   ------------------------------------------------------------ */
class RegionMesh {
  constructor(rx, ry, rz) {
    this.rx = rx; this.ry = ry; this.rz = rz;     // 区域原点（体素）
    this.data = new Uint32Array(4096);
    this.n = 0;                                    // 已用 uint32 数量
    this.quads = 0;
    this.vao = null; this.vbo = null;
    // 实际包围盒
    this.bx0 = 1e9; this.by0 = 1e9; this.bz0 = 1e9;
    this.bx1 = -1e9; this.by1 = -1e9; this.bz1 = -1e9;
  }
  _grow(need) {
    if (this.n + need <= this.data.length) return;
    let cap = this.data.length;
    while (cap < this.n + need) cap *= 2;
    const nd = new Uint32Array(cap);
    nd.set(this.data.subarray(0, this.n));
    this.data = nd;
  }
  /** 加入一个四边形（4 个顶点，逆时针面向法线） */
  quad(vx, vy, vz, color, normal, ao, flag = 0) {
    this._grow(8);
    const d = this.data;
    let n = this.n;
    for (let i = 0; i < 4; i++) {
      d[n++] = (vx[i] & 255) | ((vy[i] & 255) << 8) | ((vz[i] & 255) << 16) | (normal << 24);
      d[n++] = (color & 255) | ((ao[i] & 3) << 8) | (flag << 10);
    }
    this.n = n;
    this.quads++;
    for (let i = 0; i < 4; i++) {
      const X = this.rx + vx[i], Y = this.ry + vy[i], Z = this.rz + vz[i];
      if (X < this.bx0) this.bx0 = X; if (X > this.bx1) this.bx1 = X;
      if (Y < this.by0) this.by0 = Y; if (Y > this.by1) this.by1 = Y;
      if (Z < this.bz0) this.bz0 = Z; if (Z > this.bz1) this.bz1 = Z;
    }
  }
}

class MeshSet {
  constructor() { this.regions = new Map(); this.maxQuads = 0; }
  static rkey(rx, ry, rz) { return ((rx + 128) * 256 + (rz + 128)) * 32 + (ry + 4); }
  region(x, y, z) {
    const rx = Math.floor(x / REG) * REG, ry = Math.floor(y / REG) * REG, rz = Math.floor(z / REG) * REG;
    const k = MeshSet.rkey(rx / REG, ry / REG, rz / REG);
    let r = this.regions.get(k);
    if (!r) { r = new RegionMesh(rx, ry, rz); this.regions.set(k, r); }
    return r;
  }
  totalQuads() { let t = 0; for (const r of this.regions.values()) t += r.quads; return t; }
  finalize() { for (const r of this.regions.values()) this.maxQuads = Math.max(this.maxQuads, r.quads); }
}

/* ------------------------------------------------------------
   贪心网格化（带 AO）
   ------------------------------------------------------------ */
const NORMALS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const ORDER_P = [0, 1, 2, 3], ORDER_N = [0, 3, 2, 1];
const CU = [0, 1, 1, 0], CV = [0, 0, 1, 1];

class Mesher {
  constructor(volume) {
    this.vol = volume;
    this.P = new Uint8Array(PAD * PAD2);       // padded chunk
    this.mask = new Int32Array(CH * CH);       // 面掩码：color | ao<<8
    this.vx = new Int32Array(4); this.vy = new Int32Array(4); this.vz = new Int32Array(4);
    this.ao = new Int32Array(4);
    this._base = new Int32Array(3); this._du = new Int32Array(3); this._dv = new Int32Array(3);
  }
  _loadPadded(cx, cy, cz) {
    const P = this.P; P.fill(0);
    const vol = this.vol;
    const key = Volume.key(cx, cy, cz);
    const arr = vol.chunks.get(key);
    if (arr) {
      for (let x = 0; x < CH; x++) {
        for (let y = 0; y < CH; y++) {
          const src = (x * CH + y) * CH;
          const dst = ((x + 1) * PAD + (y + 1)) * PAD + 1;
          P.set(arr.subarray(src, src + CH), dst);
        }
      }
    }
    const ox = cx * CH, oy = cy * CH, oz = cz * CH;
    // 六个面的邻居壳
    for (let a = 0; a < PAD; a++) {
      for (let b = 0; b < PAD; b++) {
        // x = -1 / CH
        let yy = a - 1, zz = b - 1;
        if (yy >= -1 && yy <= CH && zz >= -1 && zz <= CH) {
          P[(0 * PAD + a) * PAD + b] = vol.get(ox - 1, oy + yy, oz + zz);
          P[((CH + 1) * PAD + a) * PAD + b] = vol.get(ox + CH, oy + yy, oz + zz);
        }
        // y = -1 / CH
        let xx = a - 1; zz = b - 1;
        P[(a * PAD + 0) * PAD + b] = vol.get(ox + xx, oy - 1, oz + zz);
        P[(a * PAD + (CH + 1)) * PAD + b] = vol.get(ox + xx, oy + CH, oz + zz);
        // z = -1 / CH
        xx = a - 1; yy = b - 1;
        P[(a * PAD + b) * PAD + 0] = vol.get(ox + xx, oy + yy, oz - 1);
        P[(a * PAD + b) * PAD + (CH + 1)] = vol.get(ox + xx, oy + yy, oz + CH);
      }
    }
  }
  _p(x, y, z) { return this.P[((x + 1) * PAD + (y + 1)) * PAD + (z + 1)]; }

  /** 对单个区块生成面，写入 meshSet */
  meshChunk(cx, cy, cz, meshSet) {
    const key = Volume.key(cx, cy, cz);
    if (!this.vol.filled.get(key)) return;
    this._loadPadded(cx, cy, cz);
    const ox = cx * CH, oy = cy * CH, oz = cz * CH;
    const P = this.P;
    const STR = [PAD2, PAD, 1];                       // x,y,z 步长
    const ORIGIN = (1 * PAD + 1) * PAD + 1;           // (0,0,0) 的索引

    // d: 主轴 0=x,1=y,2=z ；dir: +1/-1
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const sd = STR[d], su_ = STR[u], sv_ = STR[v];
      for (let dir = 0; dir < 2; dir++) {
        const s = dir === 0 ? 1 : -1;
        const normal = d * 2 + dir;
        const step = s * sd;
        for (let layer = 0; layer < CH; layer++) {
          // 建掩码
          const mask = this.mask;
          mask.fill(0);
          const layerBase = ORIGIN + layer * sd;
          for (let j = 0; j < CH; j++) {
            const rowBase = layerBase + j * sv_;
            for (let i = 0; i < CH; i++) {
              const pi = rowBase + i * su_;
              const c = P[pi];
              if (!c) continue;
              const ni = pi + step;
              if (P[ni]) continue;
              // 四角 AO：在面前方的空层上采样 8 邻域
              const um = P[ni - su_] ? 1 : 0, up = P[ni + su_] ? 1 : 0;
              const vm = P[ni - sv_] ? 1 : 0, vp = P[ni + sv_] ? 1 : 0;
              const mm = P[ni - su_ - sv_] ? 1 : 0, pm = P[ni + su_ - sv_] ? 1 : 0;
              const pp = P[ni + su_ + sv_] ? 1 : 0, mp = P[ni - su_ + sv_] ? 1 : 0;
              const a0 = (um && vm) ? 0 : 3 - (um + vm + mm);   // (0,0)
              const a1 = (up && vm) ? 0 : 3 - (up + vm + pm);   // (1,0)
              const a2 = (up && vp) ? 0 : 3 - (up + vp + pp);   // (1,1)
              const a3 = (um && vp) ? 0 : 3 - (um + vp + mp);   // (0,1)
              const aoPack = a0 | (a1 << 2) | (a2 << 4) | (a3 << 6);
              mask[j * CH + i] = c | (aoPack << 8);
            }
          }
          // 贪心合并
          for (let j = 0; j < CH; j++) {
            for (let i = 0; i < CH;) {
              const m = mask[j * CH + i];
              if (!m) { i++; continue; }
              let w = 1;
              while (i + w < CH && mask[j * CH + i + w] === m) w++;
              let h = 1;
              outer:
              while (j + h < CH) {
                for (let k = 0; k < w; k++) if (mask[(j + h) * CH + i + k] !== m) break outer;
                h++;
              }
              const color = m & 255, aoPack = (m >> 8) & 255;
              // 生成四边形（用预分配数组避免 GC）
              const base = this._base, du = this._du, dv = this._dv;
              base[0] = base[1] = base[2] = 0; du[0] = du[1] = du[2] = 0; dv[0] = dv[1] = dv[2] = 0;
              base[d] = layer + (s > 0 ? 1 : 0);
              base[u] = i; base[v] = j;
              du[u] = w; dv[v] = h;
              const r = meshSet.region(ox + base[0], oy + base[1], oz + base[2]);
              const bx = ox + base[0] - r.rx, by = oy + base[1] - r.ry, bz = oz + base[2] - r.rz;
              const vx = this.vx, vy = this.vy, vz = this.vz, ao = this.ao;
              // 角点顺序：(0,0) (u,0) (u,v) (0,v)；对 -dir 反转以保持逆时针
              const order = s > 0 ? ORDER_P : ORDER_N;
              const cu = CU, cv = CV;
              for (let k = 0; k < 4; k++) {
                const o = order[k];
                vx[k] = bx + du[0] * cu[o] + dv[0] * cv[o];
                vy[k] = by + du[1] * cu[o] + dv[1] * cv[o];
                vz[k] = bz + du[2] * cu[o] + dv[2] * cv[o];
                ao[k] = (aoPack >> (o * 2)) & 3;
              }
              r.quad(vx, vy, vz, color, normal, ao);
              // 清除已合并
              for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) mask[(j + jj) * CH + i + ii] = 0;
              i += w;
            }
          }
        }
      }
    }
  }
}

/* ------------------------------------------------------------
   地面瓦片系统（平面区域，不占体素内存）
   ------------------------------------------------------------ */
class Ground {
  constructor(x0, z0, x1, z1, tile = 2) {
    this.tile = tile;
    this.x0 = x0; this.z0 = z0;
    this.nx = Math.ceil((x1 - x0) / tile); this.nz = Math.ceil((z1 - z0) / tile);
    this.mat = new Uint8Array(this.nx * this.nz);
    this.hgt = new Int8Array(this.nx * this.nz);
  }
  idx(ix, iz) { return iz * this.nx + ix; }
  inside(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz; }
  toIX(x) { return Math.floor((x - this.x0) / this.tile); }
  toIZ(z) { return Math.floor((z - this.z0) / this.tile); }
  rect(x0, z0, x1, z1, mat, h = 0) {
    const i0 = this.toIX(Math.min(x0, x1)), i1 = this.toIX(Math.max(x0, x1) - 0.001);
    const j0 = this.toIZ(Math.min(z0, z1)), j1 = this.toIZ(Math.max(z0, z1) - 0.001);
    for (let j = Math.max(0, j0); j <= Math.min(this.nz - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) {
        const k = j * this.nx + i; this.mat[k] = mat; this.hgt[k] = h;
      }
  }
  ring(x0, z0, x1, z1, t, mat, h = 0) {
    this.rect(x0, z0, x1, z0 + t, mat, h); this.rect(x0, z1 - t, x1, z1, mat, h);
    this.rect(x0, z0, x0 + t, z1, mat, h); this.rect(x1 - t, z0, x1, z1, mat, h);
  }
  disc(cx, cz, r, mat, h = 0) {
    const i0 = this.toIX(cx - r), i1 = this.toIX(cx + r), j0 = this.toIZ(cz - r), j1 = this.toIZ(cz + r);
    for (let j = Math.max(0, j0); j <= Math.min(this.nz - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) {
        const px = this.x0 + (i + 0.5) * this.tile, pz = this.z0 + (j + 0.5) * this.tile;
        if ((px - cx) ** 2 + (pz - cz) ** 2 <= r * r) { const k = j * this.nx + i; this.mat[k] = mat; this.hgt[k] = h; }
      }
  }
  matAt(x, z) {
    const i = this.toIX(x), j = this.toIZ(z);
    if (!this.inside(i, j)) return 0;
    return this.mat[j * this.nx + i];
  }
  heightAt(x, z) {
    const i = this.toIX(x), j = this.toIZ(z);
    if (!this.inside(i, j)) return 0;
    return this.hgt[j * this.nx + i];
  }
  /** 贪心合并成四边形，写入 meshSet（materials: mat -> {color, water}） */
  build(meshSet, materials, waterOut) {
    const nx = this.nx, nz = this.nz, t = this.tile;
    const used = new Uint8Array(nx * nz);
    const vx = new Int32Array(4), vy = new Int32Array(4), vz = new Int32Array(4), ao = new Int32Array(4);
    ao[0] = ao[1] = ao[2] = ao[3] = 3;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx;) {
        const k = j * nx + i;
        const m = this.mat[k];
        if (!m || used[k]) { i++; continue; }
        const h = this.hgt[k];
        // 限制在同一渲染区域内（保证顶点相对坐标 < 256）
        const wx = this.x0 + i * t, wz = this.z0 + j * t;
        const regX = Math.floor(wx / REG) * REG, regZ = Math.floor(wz / REG) * REG;
        const maxI = Math.min(nx, this.toIX(regX + REG - 0.001) + 1);
        const maxJ = Math.min(nz, this.toIZ(regZ + REG - 0.001) + 1);
        let w = 1;
        while (i + w < maxI && !used[k + w] && this.mat[k + w] === m && this.hgt[k + w] === h) w++;
        let hh = 1;
        outer:
        while (j + hh < maxJ) {
          for (let q = 0; q < w; q++) {
            const kk = (j + hh) * nx + i + q;
            if (used[kk] || this.mat[kk] !== m || this.hgt[kk] !== h) break outer;
          }
          hh++;
        }
        for (let jj = 0; jj < hh; jj++) for (let ii = 0; ii < w; ii++) used[(j + jj) * nx + i + ii] = 1;
        const X0 = this.x0 + i * t, Z0 = this.z0 + j * t, X1 = X0 + w * t, Z1 = Z0 + hh * t;
        const md = materials[m];
        const target = md.water ? waterOut : meshSet;
        const r = target.region(X0, h, Z0);
        const bx = X0 - r.rx, by = h - r.ry, bz = Z0 - r.rz;
        const bw = X1 - X0, bd = Z1 - Z0;
        vx[0] = bx; vz[0] = bz; vx[1] = bx + bw; vz[1] = bz; vx[2] = bx + bw; vz[2] = bz + bd; vx[3] = bx; vz[3] = bz + bd;
        vy[0] = vy[1] = vy[2] = vy[3] = by;
        // 顶面法线 +y（normal index 2）；逆时针（从上往下看）
        const o = [0, 3, 2, 1];
        const tx = [vx[o[0]], vx[o[1]], vx[o[2]], vx[o[3]]];
        const tz = [vz[o[0]], vz[o[1]], vz[o[2]], vz[o[3]]];
        r.quad(tx, vy, tz, md.color, 2, ao, md.water ? 1 : 0);
        i += w;
      }
    }
  }
}

window.CH = CH; window.REG = REG; window.Volume = Volume; window.Mesher = Mesher;
window.MeshSet = MeshSet; window.RegionMesh = RegionMesh; window.Ground = Ground; window.NORMALS = NORMALS;
