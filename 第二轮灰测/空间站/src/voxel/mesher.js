/**
 * voxel/mesher.js —— 贪心网格化（Greedy Meshing）+ 逐顶点环境光遮蔽烘焙
 *
 * 算法：对三个主轴各做一次「切片扫描」，在每个切片平面上构造面掩码，
 * 然后在 2D 上做贪心矩形合并。合并键 = 材质 + 4 角 AO + 变体，
 * 因此合并后的大四边形内部 AO 恒定，不会产生插值瑕疵。
 *
 * 顶点格式（24 字节，紧凑交错）：
 *   0  aPos       3 × u16   体素局部坐标（着色器加上 uOrigin 得到模型坐标）
 *   6  (padding)  1 × u16
 *   8  aMeta      4 × u8    faceId / AO / code(detail|flags<<4) / variant
 *  12  aAlbedo    4 × u8n   albedo.rgb + roughness
 *  16  aEmissive  4 × u8n   emissive.rgb + metallic
 *  20  aUV        2 × u16   面内体素坐标（全局连续，保证图案跨面无缝）
 */

import { bakeMaterial, packCode } from './palette.js';

export const VERTEX_BYTES = 24;
export const ATTRIB = Object.freeze({
  POS: { loc: 0, size: 3, type: 'u16', offset: 0, normalized: false },
  META: { loc: 1, size: 4, type: 'u8', offset: 8, normalized: false },
  ALBEDO: { loc: 2, size: 4, type: 'u8', offset: 12, normalized: true },
  EMISSIVE: { loc: 3, size: 4, type: 'u8', offset: 16, normalized: true },
  UV: { loc: 4, size: 2, type: 'u16', offset: 20, normalized: false },
});

/** faceId → 单位法线（与着色器 FACE_N 表一致） */
export const FACE_NORMALS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

const AXIS_U = [1, 2, 0];
const AXIS_V = [2, 0, 1];

/**
 * uv 世界偏置的取模基数。
 *
 * uv 以 u16 存储。若直接加上可能为负的 volume.min（例如 -104），按 & 0xffff
 * 得到 65432 这类接近上界的值，一个跨度上百体素的合并四边形就会跨越 65536 回绕，
 * 使该四边形内部的 uv 出现 65535 → 0 的巨大跳变，表现为一条贯穿的图案乱纹。
 *
 * 改为对 4096 取正模：4096 是片元着色器中全部整数图案周期（1/2/4/8/16/32）的公倍数，
 * 跨面连续性完全保留；同时 4095 + 最大面尺寸远小于 65535，绝不回绕。
 */
export const UV_WRAP = 4096;
const uvBias = (v) => ((v % UV_WRAP) + UV_WRAP) % UV_WRAP;

/** 可增长的交错顶点缓冲 */
class VertexSink {
  constructor(estQuads = 4096) {
    this.cap = Math.max(256, estQuads) * 4;
    this.buf = new ArrayBuffer(this.cap * VERTEX_BYTES);
    this.u8 = new Uint8Array(this.buf);
    this.u16 = new Uint16Array(this.buf);
    this.n = 0; // 顶点数
    this.idxCap = Math.max(384, estQuads * 6);
    this.idx = new Uint32Array(this.idxCap);
    this.iN = 0;
  }
  _growV() {
    this.cap *= 2;
    const nb = new ArrayBuffer(this.cap * VERTEX_BYTES);
    new Uint8Array(nb).set(this.u8.subarray(0, this.n * VERTEX_BYTES));
    this.buf = nb; this.u8 = new Uint8Array(nb); this.u16 = new Uint16Array(nb);
  }
  _growI() {
    this.idxCap *= 2;
    const ni = new Uint32Array(this.idxCap);
    ni.set(this.idx.subarray(0, this.iN));
    this.idx = ni;
  }
  /** 写入一个顶点，返回索引 */
  push(px, py, pz, face, ao, code, variant, mat8, uu, vv) {
    if (this.n + 1 > this.cap) this._growV();
    const b = this.n * VERTEX_BYTES;
    const h = b >> 1;
    this.u16[h] = px; this.u16[h + 1] = py; this.u16[h + 2] = pz;
    this.u8[b + 8] = face; this.u8[b + 9] = ao; this.u8[b + 10] = code; this.u8[b + 11] = variant;
    this.u8[b + 12] = mat8[0]; this.u8[b + 13] = mat8[1]; this.u8[b + 14] = mat8[2]; this.u8[b + 15] = mat8[3];
    this.u8[b + 16] = mat8[4]; this.u8[b + 17] = mat8[5]; this.u8[b + 18] = mat8[6]; this.u8[b + 19] = mat8[7];
    this.u16[h + 10] = uu; this.u16[h + 11] = vv;
    return this.n++;
  }
  tri(a, b, c) {
    if (this.iN + 3 > this.idxCap) this._growI();
    this.idx[this.iN++] = a; this.idx[this.iN++] = b; this.idx[this.iN++] = c;
  }
  finish() {
    return {
      vertices: new Uint8Array(this.buf, 0, this.n * VERTEX_BYTES).slice(),
      indices: this.idx.slice(0, this.iN),
      vertexCount: this.n,
      indexCount: this.iN,
    };
  }
}

/**
 * 对一个体积执行贪心网格化。
 * @param {{data:Uint8Array,size:number[],min:number[]}} vol 稠密体素数据
 * @returns {{vertices:Uint8Array,indices:Uint32Array,vertexCount:number,indexCount:number,
 *            quadCount:number,origin:number[],size:number[],bounds:object}}
 */
export function meshVolume(vol) {
  const { data, size, min } = vol;
  const [sx, sy, sz] = size;
  const strideY = sx, strideZ = sx * sy;
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) ? 0 : data[x + y * strideY + z * strideZ];
  const solid = (x, y, z) => at(x, y, z) !== 0;

  const sink = new VertexSink(Math.max(1024, (sx * sy + sy * sz + sx * sz) >> 1));
  const mat8 = new Uint8Array(8);
  let quadCount = 0;

  // 各面朝向的 AO 采样偏移由 (d,u,v) 决定，循环内即时计算
  for (let d = 0; d < 3; d++) {
    const u = AXIS_U[d], v = AXIS_V[d];
    const du = size[u], dv = size[v];
    const area = du * dv;
    const maskMat = new Int32Array(area);   // 正数=+d 面，负数=-d 面，绝对值为材质 id
    const maskAO = new Int32Array(area);    // 4 角 AO 打包（每角 2 bit）
    const p = [0, 0, 0], n = [0, 0, 0];

    for (let slice = -1; slice < size[d]; slice++) {
      maskMat.fill(0);
      // ── 构造面掩码 ─────────────────────────────────
      for (let j = 0; j < dv; j++) {
        for (let i = 0; i < du; i++) {
          p[d] = slice; p[u] = i; p[v] = j;
          const a = slice >= 0 ? at(p[0], p[1], p[2]) : 0;
          p[d] = slice + 1;
          const b = slice + 1 < size[d] ? at(p[0], p[1], p[2]) : 0;
          if ((a !== 0) === (b !== 0)) continue;

          const positive = a !== 0;               // 实心在 -d 侧 → 面朝 +d
          const mat = positive ? a : b;
          // 实心体素坐标
          p[d] = positive ? slice : slice + 1;
          const vx = p[0], vy = p[1], vz = p[2];
          n[0] = 0; n[1] = 0; n[2] = 0; n[d] = positive ? 1 : -1;

          // 4 角 AO
          let packedAO = 0;
          for (let cj = 0; cj < 2; cj++) {
            for (let ci = 0; ci < 2; ci++) {
              const su = ci === 0 ? -1 : 1, sv = cj === 0 ? -1 : 1;
              const o1 = [0, 0, 0], o2 = [0, 0, 0], oc = [0, 0, 0];
              o1[u] = su; o2[v] = sv; oc[u] = su; oc[v] = sv;
              const bx = vx + n[0], by = vy + n[1], bz = vz + n[2];
              const s1 = solid(bx + o1[0], by + o1[1], bz + o1[2]) ? 1 : 0;
              const s2 = solid(bx + o2[0], by + o2[1], bz + o2[2]) ? 1 : 0;
              const sc = solid(bx + oc[0], by + oc[1], bz + oc[2]) ? 1 : 0;
              const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + sc);
              packedAO |= ao << ((cj * 2 + ci) * 2);
            }
          }
          const k = i + j * du;
          maskMat[k] = positive ? mat : -mat;
          maskAO[k] = packedAO;
        }
      }

      // ── 2D 贪心矩形合并 ─────────────────────────────
      for (let j = 0; j < dv; j++) {
        for (let i = 0; i < du;) {
          const k0 = i + j * du;
          const m0 = maskMat[k0];
          if (m0 === 0) { i++; continue; }
          const ao0 = maskAO[k0];
          // 沿 u 扩展
          let w = 1;
          while (i + w < du && maskMat[k0 + w] === m0 && maskAO[k0 + w] === ao0) w++;
          // 沿 v 扩展
          let h = 1;
          outer: while (j + h < dv) {
            const row = k0 + h * du;
            for (let q = 0; q < w; q++) {
              if (maskMat[row + q] !== m0 || maskAO[row + q] !== ao0) break outer;
            }
            h++;
          }
          // 清除已消耗区域
          for (let b = 0; b < h; b++) maskMat.fill(0, k0 + b * du, k0 + b * du + w);

          // ── 发射四边形 ──────────────────────────────
          const positive = m0 > 0;
          const mat = positive ? m0 : -m0;
          const faceId = d * 2 + (positive ? 0 : 1);
          const plane = slice + 1;

          // 顶点角落（局部体素坐标）
          const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
          const uv = [[i, j], [i + w, j], [i + w, j + h], [i, j + h]];
          for (let t = 0; t < 4; t++) {
            c[t][d] = plane;
            c[t][u] = uv[t][0];
            c[t][v] = uv[t][1];
          }

          // 材质烘焙：以四边形起点为随机种子，得到逐面色差
          const solidPlane = positive ? slice : slice + 1;
          const hp = [0, 0, 0];
          hp[d] = solidPlane; hp[u] = i; hp[v] = j;
          bakeMaterial(mat, min[0] + hp[0], min[1] + hp[1], min[2] + hp[2], mat8);
          const code = packCode(mat);
          const variant = (i * 73 + j * 151 + slice * 31 + d * 17) & 255;
          const aoCorner = [ao0 & 3, (ao0 >> 2) & 3, (ao0 >> 6) & 3, (ao0 >> 4) & 3]; // 对应 c00,c10,c11,c01
          const aoByte = (a) => (a * 85) & 255; // 0,85,170,255

          const vi = [];
          const biasU = uvBias(min[u]), biasV = uvBias(min[v]);
          for (let t = 0; t < 4; t++) {
            vi.push(sink.push(
              c[t][0], c[t][1], c[t][2],
              faceId, aoByte(aoCorner[t]), code, variant, mat8,
              uv[t][0] + biasU, uv[t][1] + biasV
            ));
          }
          if (positive) { sink.tri(vi[0], vi[1], vi[2]); sink.tri(vi[0], vi[2], vi[3]); }
          else { sink.tri(vi[0], vi[2], vi[1]); sink.tri(vi[0], vi[3], vi[2]); }
          quadCount++;
          i += w;
        }
      }
    }
  }

  const out = sink.finish();
  return { ...out, quadCount, origin: min.slice(), size: size.slice() };
}

/** 统计三角形数量 */
export const triangleCount = (mesh) => mesh.indexCount / 3;
