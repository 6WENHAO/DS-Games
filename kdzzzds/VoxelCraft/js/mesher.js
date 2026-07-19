/* mesher.js - 近景区块贪婪合并网格（主线程 + Worker 共享）
 * 优化（借鉴 Sodium CompactChunkVertex / noa-engine terrainMesher / 0fps AO）：
 *  ① 逐角环境光遮蔽 AO：mask 同时携带 2bit×4 AO，合并需 id+AO 全等；对角线按 AO 翻转（噪点/各向异性修正）
 *  ② 压缩顶点：位置 Uint16(×16 定点，存储 y≤4000→64000 在量程内；世界 y = 存储 y + Y0)、uv Int16、tile Uint8、shade Uint8 归一化
 *  ③ 体素直接数组寻址：Worker 直接复用 genChunk 的 pad 缓冲，主线程一次性快照，消除热循环闭包调用
 *  ④ 索引 vc≤65535 时用 Uint16；输出附带 y 包围范围，供主线程免扫描建 boundingSphere */
function MESHER_MODULE(E) {
  'use strict';

  let SOLID = null;
  function buildSolidTable() {
    const B = E.BLOCKS, t = new Uint8Array(256);
    for (let i = 1; i < B.length; i++) if (B[i] && B[i].kind === 0) t[i] = 1;
    return t;
  }

  /* 增长型 TypedArray 缓冲 */
  function Grow(Type, cap) { this.T = Type; this.a = new Type(cap); this.n = 0; }
  Grow.prototype.need = function (k) {
    if (this.n + k <= this.a.length) return;
    let c = this.a.length;
    while (c < this.n + k) c *= 2;
    const b = new this.T(c);
    b.set(this.a.subarray(0, this.n));
    this.a = b;
  };
  Grow.prototype.done = function () { return this.a.slice(0, this.n); };

  const PSCALE = 16; // 位置定点倍率（着色器中 ×1/16 还原）

  // gb(x,y,z): 局部坐标 -1..16 / y 0..CHH-1；yMax: 本区块最高非空方块+2
  // pad: 可选，genChunk 产出的 18×18×padH 体素缓冲（Worker 端直接复用，免二次采样）
  // padH: pad 的 y 步幅（变高度区块）；无 pad 时主线程按 yTop 快照
  // yMin: pad 窗口最低地表-1（其下全实心 → 三轴扫掠直接跳过，峰区区块提速一个量级）
  // 返回 {opq:{pos,uv,tile,shade,shade2,idx,y0,y1}, alp:{...}, wat:{pos,idx,y0,y1}}
  E.meshChunk = function (gb, yMax, pad, padH, yMin) {
    const B = E.BLOCKS, CHH = E.CHH;
    if (!SOLID) SOLID = buildSolidTable();
    const S = SOLID;
    const yTop = Math.min(CHH, (yMax || CHH) + 1);
    const yLo = Math.max(0, Math.min(yMin || 0, yTop - 1));

    /* ---------- ③ 体素快照：统一 pad 布局 ((x+1)*18+(z+1))*SV+y ---------- */
    let V = pad;
    let SV = pad ? (padH || CHH) : yTop;
    if (!V) {
      V = new Uint8Array(18 * 18 * SV);
      const y0f = Math.max(0, yLo - 2);
      for (let x = -1; x <= 16; x++) for (let z = -1; z <= 16; z++) {
        const base = ((x + 1) * 18 + (z + 1)) * SV;
        for (let y = y0f; y < yTop; y++) V[base + y] = gb(x, y, z);
      }
    }
    function vox(x, y, z) {
      if (y < 0) return 12;
      if (y >= SV) return 0;
      return V[((x + 1) * 18 + (z + 1)) * SV + y];
    }
    function solidV(x, y, z) {
      if (y < 0) return 1;
      if (y >= SV) return 0;
      return S[V[((x + 1) * 18 + (z + 1)) * SV + y]];
    }

    function mkBucket(withUv) {
      const g = {
        pos: new Grow(Uint16Array, 4096), idx: new Grow(Int32Array, 4096),
        vc: 0, y0: 1e9, y1: -1e9
      };
      if (withUv) {
        g.uv = new Grow(Int16Array, 4096);
        g.tile = new Grow(Uint8Array, 2048);
        g.shade = new Grow(Uint8Array, 2048);
        g.shade2 = new Grow(Uint8Array, 2048);  // 无 AO 基础亮度（远距离淡出 AO 用）
      }
      return g;
    }
    const opq = mkBucket(true);
    const alp = mkBucket(true);
    const wat = { pos: new Grow(Float32Array, 1024), idx: new Grow(Int32Array, 1024), vc: 0, y0: 1e9, y1: -1e9 };

    const SH_Y = 1.0, SH_YN = 0.55, SH_X = 0.8, SH_Z = 0.66;
    const AO_MUL = [1, 0.8, 0.62, 0.62]; // AO 级别 0..2 → 亮度系数

    /* 通用四边形发射：s0..s3 为逐角 shade 字节（含AO），sBase 为无 AO 亮度；diag1 时沿 v1-v3 切分 */
    function quad(tgt, v0, v1, v2, v3, uv0, uv1, uv2, uv3, tu, tv, s0, s1, s2, s3, sBase, flip, diag1) {
      const vi = tgt.vc;
      tgt.pos.need(12); tgt.uv.need(8); tgt.tile.need(8); tgt.shade.need(4); tgt.shade2.need(4); tgt.idx.need(6);
      const P = tgt.pos.a; let pn = tgt.pos.n;
      P[pn] = v0[0] * PSCALE; P[pn + 1] = v0[1] * PSCALE; P[pn + 2] = v0[2] * PSCALE;
      P[pn + 3] = v1[0] * PSCALE; P[pn + 4] = v1[1] * PSCALE; P[pn + 5] = v1[2] * PSCALE;
      P[pn + 6] = v2[0] * PSCALE; P[pn + 7] = v2[1] * PSCALE; P[pn + 8] = v2[2] * PSCALE;
      P[pn + 9] = v3[0] * PSCALE; P[pn + 10] = v3[1] * PSCALE; P[pn + 11] = v3[2] * PSCALE;
      tgt.pos.n += 12;
      const U = tgt.uv.a; let un = tgt.uv.n;
      U[un] = uv0[0]; U[un + 1] = uv0[1]; U[un + 2] = uv1[0]; U[un + 3] = uv1[1];
      U[un + 4] = uv2[0]; U[un + 5] = uv2[1]; U[un + 6] = uv3[0]; U[un + 7] = uv3[1];
      tgt.uv.n += 8;
      const T = tgt.tile.a; let tn = tgt.tile.n;
      T[tn] = tu; T[tn + 1] = tv; T[tn + 2] = tu; T[tn + 3] = tv;
      T[tn + 4] = tu; T[tn + 5] = tv; T[tn + 6] = tu; T[tn + 7] = tv;
      tgt.tile.n += 8;
      const H = tgt.shade.a; let hn = tgt.shade.n;
      H[hn] = s0; H[hn + 1] = s1; H[hn + 2] = s2; H[hn + 3] = s3;
      tgt.shade.n += 4;
      const H2 = tgt.shade2.a; let h2n = tgt.shade2.n;
      H2[h2n] = sBase; H2[h2n + 1] = sBase; H2[h2n + 2] = sBase; H2[h2n + 3] = sBase;
      tgt.shade2.n += 4;
      const I = tgt.idx.a; let ni = tgt.idx.n;
      if (!flip) {
        if (!diag1) { I[ni] = vi; I[ni + 1] = vi + 1; I[ni + 2] = vi + 2; I[ni + 3] = vi; I[ni + 4] = vi + 2; I[ni + 5] = vi + 3; }
        else { I[ni] = vi + 1; I[ni + 1] = vi + 2; I[ni + 2] = vi + 3; I[ni + 3] = vi + 1; I[ni + 4] = vi + 3; I[ni + 5] = vi; }
      } else {
        if (!diag1) { I[ni] = vi; I[ni + 1] = vi + 3; I[ni + 2] = vi + 2; I[ni + 3] = vi; I[ni + 4] = vi + 2; I[ni + 5] = vi + 1; }
        else { I[ni] = vi + 1; I[ni + 1] = vi; I[ni + 2] = vi + 3; I[ni + 3] = vi + 1; I[ni + 4] = vi + 3; I[ni + 5] = vi + 2; }
      }
      tgt.idx.n += 6;
      tgt.vc += 4;
      let lo = v0[1] < v2[1] ? v0[1] : v2[1], hi = v0[1] > v2[1] ? v0[1] : v2[1];
      if (v1[1] < lo) lo = v1[1]; if (v1[1] > hi) hi = v1[1];
      if (v3[1] < lo) lo = v3[1]; if (v3[1] > hi) hi = v3[1];
      if (lo < tgt.y0) tgt.y0 = lo;
      if (hi > tgt.y1) tgt.y1 = hi;
    }

    /* ---------- 不透明块贪婪合并（含 ① AO） ---------- */
    const dims = [16, yTop, 16];
    const x = [0, 0, 0], c = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const du = dims[u], dv = dims[v];
      const mask = new Int32Array(du * dv);
      const baseShade = d === 1 ? SH_Y : (d === 0 ? SH_X : SH_Z);
      const shTab = [
        (baseShade * AO_MUL[0] * 255) | 0, (baseShade * AO_MUL[1] * 255) | 0, (baseShade * AO_MUL[2] * 255) | 0
      ];
      const shTabN = [
        (SH_YN * AO_MUL[0] * 255) | 0, (SH_YN * AO_MUL[1] * 255) | 0, (SH_YN * AO_MUL[2] * 255) | 0
      ];

      // 空气侧层 L 上，切向 (ui,vi) 单元的 4 角 AO（noa packAOMask 简化版：无反向 AO）
      function aoPack(L, ui, vi) {
        c[d] = L;
        c[u] = ui - 1; c[v] = vi;
        const s0 = solidV(c[0], c[1], c[2]);
        c[u] = ui + 1;
        const s1 = solidV(c[0], c[1], c[2]);
        c[u] = ui; c[v] = vi - 1;
        const s2 = solidV(c[0], c[1], c[2]);
        c[v] = vi + 1;
        const s3 = solidV(c[0], c[1], c[2]);
        let a0 = s0 + s2, a1 = s1 + s2, a2 = s1 + s3, a3 = s0 + s3;
        if (a0 === 0) { c[u] = ui - 1; c[v] = vi - 1; if (solidV(c[0], c[1], c[2])) a0 = 1; }
        if (a1 === 0) { c[u] = ui + 1; c[v] = vi - 1; if (solidV(c[0], c[1], c[2])) a1 = 1; }
        if (a2 === 0) { c[u] = ui + 1; c[v] = vi + 1; if (solidV(c[0], c[1], c[2])) a2 = 1; }
        if (a3 === 0) { c[u] = ui - 1; c[v] = vi + 1; if (solidV(c[0], c[1], c[2])) a3 = 1; }
        return a0 | (a1 << 2) | (a2 << 4) | (a3 << 6);
      }

      for (let t = (d === 1 ? yLo : 0); t <= dims[d]; t++) {
        const uStart = u === 1 ? yLo : 0;
        for (x[v] = 0; x[v] < dv; x[v]++) {
          let n = x[v] * du + uStart;
          for (x[u] = uStart; x[u] < du; x[u]++) {
            x[d] = t - 1;
            const a = (t > 0 || d !== 1) ? vox(x[0], x[1], x[2]) : 12;
            x[d] = t;
            const b = (t < dims[d] || d !== 1) ? vox(x[0], x[1], x[2]) : 0;
            const oa = !!(a && S[a]), ob = !!(b && S[b]);
            if (oa === ob) { mask[n++] = 0; continue; }
            // id | back<<8 | ao<<9
            if (oa) mask[n++] = a | (aoPack(t, x[u], x[v]) << 9);
            else mask[n++] = b | 256 | (aoPack(t - 1, x[u], x[v]) << 9);
          }
        }
        let n = 0;
        for (let j = 0; j < dv; j++) {
          for (let i = 0; i < du;) {
            const m = mask[n];
            if (m === 0) { i++; n++; continue; }
            let w = 1;
            while (i + w < du && mask[n + w] === m) w++;
            let hq = 1, done = false;
            while (j + hq < dv && !done) {
              for (let k = 0; k < w; k++) if (mask[n + hq * du + k] !== m) { done = true; break; }
              if (!done) hq++;
            }
            // 发射面
            const id = m & 255;
            const back = (m & 256) !== 0;
            const ao = m >>> 9;
            const a0 = ao & 3, a1 = (ao >> 2) & 3, a2 = (ao >> 4) & 3, a3 = (ao >> 6) & 3;
            const bt = B[id].t;
            const tileId = d === 1 ? (back ? bt[2] : bt[0]) : bt[1];
            const tu = tileId & 15, tv = tileId >> 4;
            const p = [0, 0, 0];
            p[d] = t; p[u] = i; p[v] = j;
            const duv = [0, 0, 0]; duv[u] = w;
            const dvv = [0, 0, 0]; dvv[v] = hq;
            const v0 = [p[0], p[1], p[2]];
            const v1 = [p[0] + duv[0], p[1] + duv[1], p[2] + duv[2]];
            const v2 = [p[0] + duv[0] + dvv[0], p[1] + duv[1] + dvv[1], p[2] + duv[2] + dvv[2]];
            const v3 = [p[0] + dvv[0], p[1] + dvv[1], p[2] + dvv[2]];
            // uv：侧面 v=世界Y，顶底 uv=(x,z)
            let uv0, uv1, uv2, uv3;
            if (d === 1) { uv0 = [v0[0], v0[2]]; uv1 = [v1[0], v1[2]]; uv2 = [v2[0], v2[2]]; uv3 = [v3[0], v3[2]]; }
            else if (d === 0) { uv0 = [v0[2], v0[1]]; uv1 = [v1[2], v1[1]]; uv2 = [v2[2], v2[1]]; uv3 = [v3[2], v3[1]]; }
            else { uv0 = [v0[0], v0[1]]; uv1 = [v1[0], v1[1]]; uv2 = [v2[0], v2[1]]; uv3 = [v3[0], v3[1]]; }
            const tab = (d === 1 && back) ? shTabN : shTab;
            quad(opq, v0, v1, v2, v3, uv0, uv1, uv2, uv3, tu, tv,
              tab[a0], tab[a1], tab[a2], tab[a3], tab[0], back, a0 + a2 > a1 + a3);
            for (let jj = 0; jj < hq; jj++) for (let ii = 0; ii < w; ii++) mask[n + jj * du + ii] = 0;
            i += w; n += w;
          }
        }
      }
    }

    /* ---------- 十字植物 / 玻璃 / 水 ---------- */
    const SH95 = 242; // 0.95*255
    for (let xx = 0; xx < 16; xx++) for (let zz = 0; zz < 16; zz++) {
      const colBase = ((xx + 1) * 18 + (zz + 1)) * SV;
      for (let yy = yLo; yy < yTop; yy++) {
        const id = V[colBase + yy];
        if (id === 0) continue;
        const k = B[id].kind;
        if (k === 0) continue;
        if (k === 1) { // 十字
          const tileId = B[id].t[1], tu = tileId & 15, tv = tileId >> 4;
          const a = 0.15, b = 0.85;
          quad(alp, [xx + a, yy, zz + a], [xx + b, yy, zz + b], [xx + b, yy + 1, zz + b], [xx + a, yy + 1, zz + a],
            [0, yy], [1, yy], [1, yy + 1], [0, yy + 1], tu, tv, SH95, SH95, SH95, SH95, SH95, false, false);
          quad(alp, [xx + a, yy, zz + b], [xx + b, yy, zz + a], [xx + b, yy + 1, zz + a], [xx + a, yy + 1, zz + b],
            [0, yy], [1, yy], [1, yy + 1], [0, yy + 1], tu, tv, SH95, SH95, SH95, SH95, SH95, false, false);
        } else if (k === 3) { // 玻璃
          const tileId = B[id].t[1], tu = tileId & 15, tv = tileId >> 4;
          for (let f = 0; f < 6; f++) {
            const nx = xx + DIRS[f][0], ny = yy + DIRS[f][1], nz = zz + DIRS[f][2];
            const nb = vox(nx, ny, nz);
            if (nb === id || (nb > 0 && S[nb])) continue;
            emitFace(alp, xx, yy, zz, f, tu, tv);
          }
        } else if (k === 2) { // 水面
          const above = yy + 1 >= SV ? 0 : V[colBase + yy + 1];
          if (above !== id && !(above > 0 && S[above])) {
            const y = yy + 0.86, vi = wat.vc;
            wat.pos.need(12); wat.idx.need(12);
            const P = wat.pos.a; let pn = wat.pos.n;
            P[pn] = xx; P[pn + 1] = y; P[pn + 2] = zz;
            P[pn + 3] = xx + 1; P[pn + 4] = y; P[pn + 5] = zz;
            P[pn + 6] = xx + 1; P[pn + 7] = y; P[pn + 8] = zz + 1;
            P[pn + 9] = xx; P[pn + 10] = y; P[pn + 11] = zz + 1;
            wat.pos.n += 12;
            const I = wat.idx.a; let ni = wat.idx.n;
            I[ni] = vi; I[ni + 1] = vi + 2; I[ni + 2] = vi + 1; I[ni + 3] = vi; I[ni + 4] = vi + 3; I[ni + 5] = vi + 2;
            I[ni + 6] = vi; I[ni + 7] = vi + 1; I[ni + 8] = vi + 2; I[ni + 9] = vi; I[ni + 10] = vi + 2; I[ni + 11] = vi + 3;
            wat.idx.n += 12;
            wat.vc += 4;
            if (y < wat.y0) wat.y0 = y;
            if (y + 0.2 > wat.y1) wat.y1 = y + 0.2;
          }
        }
      }
    }

    function emitFace(tgt, xx, yy, zz, f, tu, tv) {
      let v0, v1, v2, v3, sh;
      if (f === 0) { v0 = [xx + 1, yy, zz]; v1 = [xx + 1, yy, zz + 1]; v2 = [xx + 1, yy + 1, zz + 1]; v3 = [xx + 1, yy + 1, zz]; sh = 204; }
      else if (f === 1) { v0 = [xx, yy, zz + 1]; v1 = [xx, yy, zz]; v2 = [xx, yy + 1, zz]; v3 = [xx, yy + 1, zz + 1]; sh = 204; }
      else if (f === 2) { v0 = [xx, yy + 1, zz]; v1 = [xx + 1, yy + 1, zz]; v2 = [xx + 1, yy + 1, zz + 1]; v3 = [xx, yy + 1, zz + 1]; sh = 255; }
      else if (f === 3) { v0 = [xx, yy, zz + 1]; v1 = [xx + 1, yy, zz + 1]; v2 = [xx + 1, yy, zz]; v3 = [xx, yy, zz]; sh = 140; }
      else if (f === 4) { v0 = [xx + 1, yy, zz + 1]; v1 = [xx, yy, zz + 1]; v2 = [xx, yy + 1, zz + 1]; v3 = [xx + 1, yy + 1, zz + 1]; sh = 168; }
      else { v0 = [xx, yy, zz]; v1 = [xx + 1, yy, zz]; v2 = [xx + 1, yy + 1, zz]; v3 = [xx, yy + 1, zz]; sh = 168; }
      const uvs = [v0, v1, v2, v3].map(function (p) {
        if (f === 2 || f === 3) return [p[0], p[2]];
        if (f < 2) return [p[2], p[1]];
        return [p[0], p[1]];
      });
      quad(tgt, v0, v1, v2, v3, uvs[0], uvs[1], uvs[2], uvs[3], tu, tv, sh, sh, sh, sh, sh, false, false);
    }

    /* ---------- ④ 打包：Uint16 索引 + y 范围（quad 已记录未缩放 y） ---------- */
    function packRaw(g, withUv) {
      const src = g.idx.a.subarray(0, g.idx.n);
      const r = {
        pos: g.pos.done(),
        idx: g.vc <= 65535 ? new Uint16Array(src) : new Uint32Array(src),
        y0: g.vc ? g.y0 : 0, y1: g.vc ? g.y1 : 0
      };
      if (withUv) { r.uv = g.uv.done(); r.tile = g.tile.done(); r.shade = g.shade.done(); r.shade2 = g.shade2.done(); }
      return r;
    }
    return { opq: packRaw(opq, true), alp: packRaw(alp, true), wat: packRaw(wat, false) };
  };

  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
}
if (typeof module !== 'undefined') module.exports = MESHER_MODULE;
