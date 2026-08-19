// ---------------------------------------------------------------------------
// 几何构建：把 brush / 基础体素化为顶点数据，并上传成 GPU 网格
// 顶点布局固定：位置(3) 法线(3) UV(2) = 8 floats，attribute location 0/1/2
// ---------------------------------------------------------------------------

import { createBuffer, createVAO } from './gl.js';

export const FACES = ['-x', '+x', '-y', '+y', '-z', '+z'];
// 兼容更直观的别名
const FACE_ALIAS = { left: '-x', right: '+x', bottom: '-y', top: '+y', back: '-z', front: '+z' };

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.idx = [];
    this.vcount = 0;
  }
  get empty() { return this.vcount === 0; }

  vertex(x, y, z, nx, ny, nz, u, v) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    return this.vcount++;
  }

  /** 逆时针四边形（p0->p1->p2->p3），uv 顺序对应 */
  quad(p0, p1, p2, p3, n, uv0, uv1, uv2, uv3) {
    const b = this.vcount;
    this.vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv0[0], uv0[1]);
    this.vertex(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv1[0], uv1[1]);
    this.vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv2[0], uv2[1]);
    this.vertex(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv3[0], uv3[1]);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /**
   * 轴对齐盒。UV 采用世界坐标平面投影（保证相邻 brush 贴图连续）。
   * @param {number[]} min [x,y,z]
   * @param {number[]} max [x,y,z]
   * @param {number} tile 每米重复次数
   * @param {string[]} nodraw 不绘制的面
   * @param {number[]} uvOffset 可选 UV 偏移（局部 UV 模式用）
   * @param {boolean} localUV true 则每个面 UV 归一化到 0..1（贴图正好铺满一面，箱子用）
   */
  box(min, max, tile = 1, nodraw = null, localUV = false, uvOffset = [0, 0]) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const skip = {};
    if (nodraw) for (const f of nodraw) skip[FACE_ALIAS[f] || f] = true;
    const t = tile;
    const uo = uvOffset[0], vo = uvOffset[1];
    const U = (a) => a * t + uo;
    const V = (a) => a * t + vo;

    // -x 面（法线指向 -X），UV 用 (z, y)
    if (!skip['-x']) {
      if (localUV) this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      else this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0],
        [U(z1), V(y0)], [U(z0), V(y0)], [U(z0), V(y1)], [U(z1), V(y1)]);
    }
    // +x
    if (!skip['+x']) {
      if (localUV) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      else this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0],
        [U(z0), V(y0)], [U(z1), V(y0)], [U(z1), V(y1)], [U(z0), V(y1)]);
    }
    // -y（朝下）UV 用 (x, z)
    if (!skip['-y']) {
      if (localUV) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      else this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0],
        [U(x0), V(z0)], [U(x1), V(z0)], [U(x1), V(z1)], [U(x0), V(z1)]);
    }
    // +y（朝上）
    if (!skip['+y']) {
      if (localUV) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      else this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
        [U(x0), V(z1)], [U(x1), V(z1)], [U(x1), V(z0)], [U(x0), V(z0)]);
    }
    // -z，UV 用 (x, y)
    if (!skip['-z']) {
      if (localUV) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1], [0, 0], [0, 1], [1, 1], [1, 0]);
      else this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1],
        [U(x0), V(y0)], [U(x0), V(y1)], [U(x1), V(y1)], [U(x1), V(y0)]);
    }
    // +z
    if (!skip['+z']) {
      if (localUV) this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [0, 0, 1], [0, 0], [0, 1], [1, 1], [1, 0]);
      else this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [0, 0, 1],
        [U(x1), V(y0)], [U(x1), V(y1)], [U(x0), V(y1)], [U(x0), V(y0)]);
    }
    return this;
  }

  /** 以中心+半尺寸建盒（模型用，局部 UV） */
  boxCentered(cx, cy, cz, hx, hy, hz, localUV = true) {
    return this.box([cx - hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz + hz], 1, null, localUV);
  }

  sphere(cx, cy, cz, r, segs = 12, rings = 8) {
    const base = this.vcount;
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI;
      const sy = Math.cos(phi), sr = Math.sin(phi);
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * Math.PI * 2;
        const nx = Math.cos(th) * sr, ny = sy, nz = Math.sin(th) * sr;
        this.vertex(cx + nx * r, cy + ny * r, cz + nz * r, nx, ny, nz, i / segs, j / rings);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = base + j * (segs + 1) + i;
        const b = a + segs + 1;
        this.idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    return this;
  }

  /** 沿 Y 轴的圆柱（底面 y0，顶面 y1） */
  cylinder(cx, y0, cz, r, y1, segs = 12, caps = true) {
    const base = this.vcount;
    for (let i = 0; i <= segs; i++) {
      const th = (i / segs) * Math.PI * 2;
      const nx = Math.cos(th), nz = Math.sin(th);
      this.vertex(cx + nx * r, y0, cz + nz * r, nx, 0, nz, i / segs, 0);
      this.vertex(cx + nx * r, y1, cz + nz * r, nx, 0, nz, i / segs, 1);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
    }
    if (caps) {
      for (const [y, ny] of [[y1, 1], [y0, -1]]) {
        const c = this.vertex(cx, y, cz, 0, ny, 0, 0.5, 0.5);
        const r0 = this.vcount;
        for (let i = 0; i <= segs; i++) {
          const th = (i / segs) * Math.PI * 2;
          this.vertex(cx + Math.cos(th) * r, y, cz + Math.sin(th) * r, 0, ny, 0,
            0.5 + Math.cos(th) * 0.5, 0.5 + Math.sin(th) * 0.5);
        }
        for (let i = 0; i < segs; i++) {
          if (ny > 0) this.idx.push(c, r0 + i, r0 + i + 1);
          else this.idx.push(c, r0 + i + 1, r0 + i);
        }
      }
    }
    return this;
  }

  /** 水平面（用于地面/天花板等单面） */
  plane(x0, z0, x1, z1, y, tile = 1, up = true) {
    const n = up ? [0, 1, 0] : [0, -1, 0];
    if (up) {
      this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], n,
        [x0 * tile, z1 * tile], [x1 * tile, z1 * tile], [x1 * tile, z0 * tile], [x0 * tile, z0 * tile]);
    } else {
      this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], n,
        [x0 * tile, z0 * tile], [x1 * tile, z0 * tile], [x1 * tile, z1 * tile], [x0 * tile, z1 * tile]);
    }
    return this;
  }

  /** 应用一个 4x4 变换到已有顶点（法线用 3x3 部分，假设无非均匀缩放） */
  transform(m) {
    for (let i = 0; i < this.pos.length; i += 3) {
      const x = this.pos[i], y = this.pos[i + 1], z = this.pos[i + 2];
      this.pos[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      this.pos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      this.pos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const nx = this.nrm[i], ny = this.nrm[i + 1], nz = this.nrm[i + 2];
      this.nrm[i] = m[0] * nx + m[4] * ny + m[8] * nz;
      this.nrm[i + 1] = m[1] * nx + m[5] * ny + m[9] * nz;
      this.nrm[i + 2] = m[2] * nx + m[6] * ny + m[10] * nz;
    }
    return this;
  }

  data() {
    return {
      pos: new Float32Array(this.pos),
      nrm: new Float32Array(this.nrm),
      uv: new Float32Array(this.uv),
      idx: this.vcount > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
      vcount: this.vcount,
      icount: this.idx.length,
    };
  }
}

/** 把 MeshBuilder 数据打包成交错 VBO 并创建 VAO */
export class GPUMesh {
  constructor(gl, builderOrData) {
    const d = builderOrData instanceof MeshBuilder ? builderOrData.data() : builderOrData;
    this.gl = gl;
    this.count = d.icount;
    this.vcount = d.vcount;
    const inter = new Float32Array(d.vcount * 8);
    for (let i = 0; i < d.vcount; i++) {
      inter[i * 8] = d.pos[i * 3];
      inter[i * 8 + 1] = d.pos[i * 3 + 1];
      inter[i * 8 + 2] = d.pos[i * 3 + 2];
      inter[i * 8 + 3] = d.nrm[i * 3];
      inter[i * 8 + 4] = d.nrm[i * 3 + 1];
      inter[i * 8 + 5] = d.nrm[i * 3 + 2];
      inter[i * 8 + 6] = d.uv[i * 2];
      inter[i * 8 + 7] = d.uv[i * 2 + 1];
    }
    this.vbo = createBuffer(gl, inter);
    this.ibo = createBuffer(gl, d.idx, gl.ELEMENT_ARRAY_BUFFER);
    this.indexType = d.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const S = 32;
    this.vao = createVAO(gl, [
      { buffer: this.vbo, loc: 0, size: 3, stride: S, offset: 0 },
      { buffer: this.vbo, loc: 1, size: 3, stride: S, offset: 12 },
      { buffer: this.vbo, loc: 2, size: 2, stride: S, offset: 24 },
    ], this.ibo);
  }
  draw() {
    if (!this.count) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, this.indexType, 0);
  }
  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteBuffer(this.ibo); gl.deleteVertexArray(this.vao);
  }
}

// --------------------------- 常用模型 --------------------------------------

/** 单位立方体（-0.5..0.5），模型基元 */
export function unitBoxMesh(gl) {
  const mb = new MeshBuilder();
  mb.box([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], 1, null, true);
  return new GPUMesh(gl, mb);
}

/** 单位球（半径 0.5） */
export function unitSphereMesh(gl, segs = 14, rings = 10) {
  const mb = new MeshBuilder();
  mb.sphere(0, 0, 0, 0.5, segs, rings);
  return new GPUMesh(gl, mb);
}

/** 沿 Y 的单位圆柱（-0.5..0.5，半径 0.5） */
export function unitCylinderMesh(gl, segs = 14) {
  const mb = new MeshBuilder();
  mb.cylinder(0, -0.5, 0, 0.5, 0.5, segs, true);
  return new GPUMesh(gl, mb);
}

/** 全屏四边形（NDC），用于后处理/天空 */
export function fullscreenQuad(gl) {
  const buf = createBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const vao = createVAO(gl, [{ buffer: buf, loc: 0, size: 2 }]);
  return { vao, draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); } };
}
