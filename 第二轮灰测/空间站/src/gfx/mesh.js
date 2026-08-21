/**
 * gfx/mesh.js —— 体素网格的 GPU 资源封装
 *
 * 把 Worker 产出的交错顶点缓冲直接上传，不做任何 CPU 侧重排。
 */

import { VERTEX_BYTES, ATTRIB } from '../voxel/mesher.js';

export class VoxelMesh {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {{vertices:Uint8Array|ArrayBuffer, indices:Uint32Array, vertexCount:number, indexCount:number, origin:number[]}} data
   */
  constructor(gl, data) {
    this.gl = gl;
    this.origin = data.origin;
    this.vertexCount = data.vertexCount;
    this.indexCount = data.indexCount;
    this.triangleCount = data.indexCount / 3;

    this.vbo = gl.createBuffer();
    this.ebo = gl.createBuffer();
    this.vao = gl.createVertexArray();

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);

    const T = { u8: gl.UNSIGNED_BYTE, u16: gl.UNSIGNED_SHORT };
    for (const a of Object.values(ATTRIB)) {
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, T[a.type], a.normalized, VERTEX_BYTES, a.offset);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    this.byteSize = (data.vertices.byteLength || data.vertices.length) + data.indices.byteLength;
  }

  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ebo);
    gl.deleteVertexArray(this.vao);
  }
}
