/**
 * 贪心网格化（Greedy Meshing）+ 逐顶点环境光遮蔽（AO）。
 *
 * 关键设计：
 *  - 以 16³ 区块为单位网格化（只遍历真实存在的区块），把结果按 128³ “扇区”合并成一个 mesh，
 *    兼顾 draw call 数量（~百级）与视锥剔除粒度。
 *  - 每个区块拷贝一份 18³ padded 缓冲，所有邻居查询变成直接数组索引 → 快。
 *  - 面归属规则：区块拥有自己“低侧”的面；只有当高侧邻居区块不存在时才额外生成高侧面
 *    → 每个面全局只生成一次，且不会漏。
 *  - AO 参与贪心合并的 key，所以细节不会被合并抹掉。
 */

import { CS, CS3 } from './world.js';
import { MAT } from './palette.js';

const PS = CS + 2;                 // padded size 18
const PS2 = PS * PS;
const PAD_ORIGIN = 1 + PS + PS2;   // local(0,0,0)
const SECTOR = 8;                  // 8 chunks = 128 voxels per sector

const AO_TABLE = [0.40, 0.615, 0.83, 1.0];
const AO_BYTE = AO_TABLE.map((v) => Math.round(v * 255));

function aoValue(s1, s2, c) {
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + c);
}

class Chan {
  constructor(Type, comps, cap) {
    this.Type = Type; this.comps = comps;
    this.a = new Type(cap * comps); this.n = 0;
  }
  need(verts) {
    const req = (this.n + verts) * this.comps;
    if (req <= this.a.length) return;
    let len = this.a.length * 2;
    while (len < req) len *= 2;
    const b = new this.Type(len);
    b.set(this.a.subarray(0, this.n * this.comps));
    this.a = b;
  }
  out() { return this.a.subarray(0, this.n * this.comps); }
}

class SectorBuilder {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    const cap = 2048;
    this.pos = new Chan(Int16Array, 3, cap);
    this.nor = new Chan(Int8Array, 3, cap);
    this.col = new Chan(Uint8Array, 3, cap);
    this.ao = new Chan(Uint8Array, 1, cap);
    this.emi = new Chan(Uint8Array, 2, cap);
    this.idx = new Chan(Uint32Array, 1, cap * 2);
    this.verts = 0;
    this.quads = 0;
    this.bmin = [32767, 32767, 32767];
    this.bmax = [-32768, -32768, -32768];
  }

  quad(px, py, pz, u, v, w, h, nx, ny, nz, mat, a0, a1, a2, a3) {
    const P = this.pos, N = this.nor, C = this.col, A = this.ao, E = this.emi, I = this.idx;
    P.need(4); N.need(4); C.need(4); A.need(4); E.need(4); I.need(6);

    // 4 个角点：(0,0) (w,0) (w,h) (0,h) 在 (u,v) 平面内
    const cu = [0, w, w, 0], cv = [0, 0, h, h];
    const pa = P.a; let pi = P.n * 3;
    for (let k = 0; k < 4; k++) {
      const p = [px, py, pz];
      p[u] += cu[k]; p[v] += cv[k];
      pa[pi++] = p[0]; pa[pi++] = p[1]; pa[pi++] = p[2];
      if (p[0] < this.bmin[0]) this.bmin[0] = p[0];
      if (p[1] < this.bmin[1]) this.bmin[1] = p[1];
      if (p[2] < this.bmin[2]) this.bmin[2] = p[2];
      if (p[0] > this.bmax[0]) this.bmax[0] = p[0];
      if (p[1] > this.bmax[1]) this.bmax[1] = p[1];
      if (p[2] > this.bmax[2]) this.bmax[2] = p[2];
    }
    P.n += 4;

    const na = N.a; let ni = N.n * 3;
    for (let k = 0; k < 4; k++) { na[ni++] = nx; na[ni++] = ny; na[ni++] = nz; }
    N.n += 4;

    const m = MAT[mat];
    const r = (m.hex >> 16) & 255, g = (m.hex >> 8) & 255, b = m.hex & 255;
    const ca = C.a; let ci = C.n * 3;
    for (let k = 0; k < 4; k++) { ca[ci++] = r; ca[ci++] = g; ca[ci++] = b; }
    C.n += 4;

    const eb = Math.min(255, Math.round((m.emissive / 4) * 255));
    const eg = Math.min(255, Math.round((m.nightGain / 4) * 255));
    const ea = E.a; let ei = E.n * 2;
    for (let k = 0; k < 4; k++) { ea[ei++] = eb; ea[ei++] = eg; }
    E.n += 4;

    const aa = A.a; let ai = A.n;
    aa[ai++] = AO_BYTE[a0]; aa[ai++] = AO_BYTE[a1];
    aa[ai++] = AO_BYTE[a2]; aa[ai++] = AO_BYTE[a3];
    A.n += 4;

    const base = this.verts;
    const ia = I.a; let ii = I.n;
    const flip = (a0 + a2) > (a1 + a3);   // AO 各向异性修正：换对角线
    const front = (nx + ny + nz) > 0;
    if (front) {
      if (flip) { ia[ii++] = base; ia[ii++] = base + 1; ia[ii++] = base + 3; ia[ii++] = base + 1; ia[ii++] = base + 2; ia[ii++] = base + 3; }
      else { ia[ii++] = base; ia[ii++] = base + 1; ia[ii++] = base + 2; ia[ii++] = base; ia[ii++] = base + 2; ia[ii++] = base + 3; }
    } else {
      if (flip) { ia[ii++] = base; ia[ii++] = base + 3; ia[ii++] = base + 1; ia[ii++] = base + 1; ia[ii++] = base + 3; ia[ii++] = base + 2; }
      else { ia[ii++] = base; ia[ii++] = base + 3; ia[ii++] = base + 2; ia[ii++] = base; ia[ii++] = base + 2; ia[ii++] = base + 1; }
    }
    I.n = ii;
    this.verts += 4;
    this.quads++;
  }

  result() {
    return {
      key: `${this.sx},${this.sy},${this.sz}`,
      position: this.pos.out(),
      normal: this.nor.out(),
      color: this.col.out(),
      ao: this.ao.out(),
      emissive: this.emi.out(),
      index: this.idx.out(),
      verts: this.verts,
      quads: this.quads,
      bmin: this.bmin,
      bmax: this.bmax,
    };
  }
}

/**
 * 分批网格化：返回一个迭代器，每次 next() 处理 batch 个区块，
 * 便于主线程在加载界面上刷新进度条。
 */
export function createMesher(world, batch = 220) {
  const keys = [];
  for (const k of world.chunks.keys()) keys.push(k);
  // 由下到上排序，视觉上先出地面（也让进度条更有“建造感”）
  const decoded = keys.map((k) => {
    const cz = (k & 1023) - 512;
    const cy = ((k >> 10) & 1023) - 512;
    const cx = ((k >> 20) & 1023) - 512;
    return [cx, cy, cz];
  });
  decoded.sort((a, b) => a[1] - b[1]);

  const pad = new Uint8Array(PS * PS * PS);
  const mask = new Int16Array(CS * CS);
  const aoq = new Uint8Array(CS * CS);
  const sectors = new Map();
  const st = [1, PS, PS2];

  let cursor = 0;
  let quads = 0;

  function padLoad(cx, cy, cz) {
    pad.fill(0);
    for (let dz = -1; dz <= 1; dz++) {
      const pz0 = Math.max(0, dz * CS + 1), pz1 = Math.min(PS - 1, dz * CS + CS);
      if (pz1 < pz0) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const py0 = Math.max(0, dy * CS + 1), py1 = Math.min(PS - 1, dy * CS + CS);
        if (py1 < py0) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const px0 = Math.max(0, dx * CS + 1), px1 = Math.min(PS - 1, dx * CS + CS);
          if (px1 < px0) continue;
          const data = world.getChunkData(cx + dx, cy + dy, cz + dz);
          if (data === undefined) continue;
          const lx0 = px0 - 1 - dx * CS;
          const len = px1 - px0 + 1;
          for (let pz = pz0; pz <= pz1; pz++) {
            const lz = pz - 1 - dz * CS;
            for (let py = py0; py <= py1; py++) {
              const ly = py - 1 - dy * CS;
              const src = (lz << 8) | (ly << 4);
              pad.set(data.subarray(src + lx0, src + lx0 + len), pz * PS2 + py * PS + px0);
            }
          }
        }
      }
    }
  }

  function meshChunk(cx, cy, cz) {
    padLoad(cx, cy, cz);
    const org = [cx * CS, cy * CS, cz * CS];
    const sx = cx >> 3, sy = cy >> 3, sz = cz >> 3;
    const sk = ((sx + 64) << 16) | ((sy + 64) << 8) | (sz + 64);
    let sec = sectors.get(sk);
    if (sec === undefined) { sec = new SectorBuilder(sx, sy, sz); sectors.set(sk, sec); }

    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const sd = st[d], su = st[u], sv = st[v];
      const nb = [0, 0, 0]; nb[d] = 1;
      const highExists = world.hasChunk(cx + nb[0], cy + nb[1], cz + nb[2]);
      const sMax = highExists ? CS - 1 : CS;

      for (let s = 0; s <= sMax; s++) {
        const baseA = PAD_ORIGIN + (s - 1) * sd;
        let any = false;
        for (let j = 0; j < CS; j++) {
          const rowJ = j * CS, jOff = j * sv;
          for (let i = 0; i < CS; i++) {
            const ia = baseA + i * su + jOff;
            const a = pad[ia];
            const b = pad[ia + sd];
            const cell = rowJ + i;
            if ((a !== 0) === (b !== 0)) { mask[cell] = 0; continue; }
            let m, solidIdx, n;
            if (a !== 0) { m = a; solidIdx = ia; n = 1; }
            else { m = -b; solidIdx = ia + sd; n = -1; }
            const o = solidIdx + n * sd;
            const pu = pad[o + su] !== 0 ? 1 : 0;
            const mu = pad[o - su] !== 0 ? 1 : 0;
            const pv = pad[o + sv] !== 0 ? 1 : 0;
            const mv = pad[o - sv] !== 0 ? 1 : 0;
            const a0 = aoValue(mu, mv, pad[o - su - sv] !== 0 ? 1 : 0);
            const a1 = aoValue(pu, mv, pad[o + su - sv] !== 0 ? 1 : 0);
            const a2 = aoValue(pu, pv, pad[o + su + sv] !== 0 ? 1 : 0);
            const a3 = aoValue(mu, pv, pad[o - su + sv] !== 0 ? 1 : 0);
            mask[cell] = m;
            aoq[cell] = a0 | (a1 << 2) | (a2 << 4) | (a3 << 6);
            any = true;
          }
        }
        if (!any) continue;

        // 贪心合并
        for (let j = 0; j < CS; j++) {
          for (let i = 0; i < CS;) {
            const cell = j * CS + i;
            const m = mask[cell];
            if (m === 0) { i++; continue; }
            const av = aoq[cell];
            let w = 1;
            while (i + w < CS && mask[cell + w] === m && aoq[cell + w] === av) w++;
            let h = 1;
            grow: while (j + h < CS) {
              const row = (j + h) * CS + i;
              for (let k = 0; k < w; k++) {
                if (mask[row + k] !== m || aoq[row + k] !== av) break grow;
              }
              h++;
            }
            const p = [0, 0, 0];
            p[d] = org[d] + s; p[u] = org[u] + i; p[v] = org[v] + j;
            const sign = m > 0 ? 1 : -1;
            const nx = d === 0 ? sign : 0, ny = d === 1 ? sign : 0, nz = d === 2 ? sign : 0;
            sec.quad(p[0], p[1], p[2], u, v, w, h, nx, ny, nz, Math.abs(m),
              av & 3, (av >> 2) & 3, (av >> 4) & 3, (av >> 6) & 3);
            quads++;
            for (let jj = 0; jj < h; jj++) {
              const row = (j + jj) * CS + i;
              for (let ii = 0; ii < w; ii++) mask[row + ii] = 0;
            }
            i += w;
          }
        }
      }
    }
  }

  return {
    total: decoded.length,
    get progress() { return cursor / Math.max(1, decoded.length); },
    get quadCount() { return quads; },
    /** 处理一批；返回 true 表示还有剩余 */
    step() {
      const end = Math.min(decoded.length, cursor + batch);
      for (; cursor < end; cursor++) {
        const [cx, cy, cz] = decoded[cursor];
        if (world.isBuried(cx, cy, cz)) continue;
        meshChunk(cx, cy, cz);
      }
      return cursor < decoded.length;
    },
    finish() {
      const out = [];
      for (const sec of sectors.values()) {
        if (sec.quads === 0) continue;
        out.push(sec.result());
      }
      return out;
    },
  };
}

export { SECTOR, CS3 };
