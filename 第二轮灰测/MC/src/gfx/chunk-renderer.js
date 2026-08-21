/**
 * gfx/chunk-renderer.js
 * ------------------------------------------------------------------
 * Uploads chunk vertex data and draws the three terrain passes.
 *
 * Every chunk mesh uses the identical 4-vertices-per-quad layout, so one
 * immutable index buffer serves them all - a big saving in both memory
 * and per-chunk upload cost.
 *
 * Pass order matters:
 *   1. opaque      - depth write on, back-face culling on
 *   2. cutout      - alpha tested (leaves, plants, glass), culling on
 *   3. translucent - blended (water, ice), culling OFF so the underside
 *                    of a water surface is visible from below, drawn
 *                    back-to-front
 */

import { buildProgram } from './program.js';
import { createSharedQuadIndexBuffer } from './gl.js';
import {
  chunkVertexShader, chunkFragmentShader, CHUNK_VERTEX_STRIDE, CHUNK_ATTRIBS,
} from './shaders/chunk.js';
import { CHUNK_SIZE, WORLD_HEIGHT, PASS } from '../world/constants.js';

/** Upper bound on quads in one chunk mesh (checkerboard worst case). */
const MAX_QUADS_PER_CHUNK = 1 << 17;   // 131072

const PASS_NAMES = ['opaque', 'cutout', 'translucent'];

export class ChunkRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {import('./textures.js').TextureSet} textures
   */
  constructor(gl, textures) {
    this.gl = gl;
    this.textures = textures;

    this.program = buildProgram(gl, {
      name: 'chunk',
      vertex: chunkVertexShader,
      fragment: chunkFragmentShader,
    });

    this.indexBuffer = createSharedQuadIndexBuffer(gl, MAX_QUADS_PER_CHUNK);

    /** Draw lists rebuilt every frame, one per pass. */
    this.lists = [[], [], []];
    this.stats = {
      chunksDrawn: 0, chunksCulled: 0, quadsDrawn: 0,
      drawCalls: 0, gpuBytes: 0,
    };
    this.animFrames = new Float32Array(4);
  }

  /* ---------------------------------------------------------------- */
  /* uploads                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Installs freshly meshed vertex data onto a chunk.
   * @param {import('../world/chunk.js').Chunk} chunk
   * @param {{opaque: object, cutout: object, translucent: object}} data
   */
  upload(chunk, data) {
    for (let pass = 0; pass < 3; pass++) {
      const stream = data[PASS_NAMES[pass]];
      this.#uploadPass(chunk, PASS_NAMES[pass], stream);
    }
  }

  #uploadPass(chunk, name, stream) {
    const gl = this.gl;
    let mesh = chunk.meshes[name];
    const quadCount = Math.min(stream?.quadCount ?? 0, MAX_QUADS_PER_CHUNK);

    if (quadCount === 0) {
      if (mesh) {
        this.stats.gpuBytes -= mesh.bytes;
        gl.deleteVertexArray(mesh.vao);
        gl.deleteBuffer(mesh.vbo);
        chunk.meshes[name] = null;
      }
      return;
    }

    const bytes = quadCount * 4 * CHUNK_VERTEX_STRIDE;
    if (!mesh) {
      mesh = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), quadCount: 0, bytes: 0, capacity: 0 };
      chunk.meshes[name] = mesh;
      gl.bindVertexArray(mesh.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      this.#setupAttribs();
      // The element buffer binding is part of VAO state.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.buffer);
      gl.bindVertexArray(null);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    const source = new Uint8Array(stream.buffer, 0, bytes);
    if (bytes > mesh.capacity) {
      // Round up so small edits do not reallocate every time.
      const capacity = Math.ceil(bytes * 1.25);
      gl.bufferData(gl.ARRAY_BUFFER, capacity, gl.DYNAMIC_DRAW);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, source);
      this.stats.gpuBytes += capacity - mesh.capacity;
      mesh.capacity = capacity;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, source);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    mesh.quadCount = quadCount;
    mesh.bytes = bytes;
  }

  /** Declares the interleaved 20-byte chunk vertex layout. */
  #setupAttribs() {
    const gl = this.gl;
    const S = CHUNK_VERTEX_STRIDE;
    gl.enableVertexAttribArray(CHUNK_ATTRIBS.meta);
    gl.vertexAttribIPointer(CHUNK_ATTRIBS.meta, 1, gl.UNSIGNED_INT, S, 0);
    gl.enableVertexAttribArray(CHUNK_ATTRIBS.pos);
    gl.vertexAttribPointer(CHUNK_ATTRIBS.pos, 3, gl.UNSIGNED_SHORT, false, S, 4);
    gl.enableVertexAttribArray(CHUNK_ATTRIBS.uv);
    gl.vertexAttribPointer(CHUNK_ATTRIBS.uv, 2, gl.UNSIGNED_SHORT, false, S, 10);
    gl.enableVertexAttribArray(CHUNK_ATTRIBS.tint);
    gl.vertexAttribPointer(CHUNK_ATTRIBS.tint, 4, gl.UNSIGNED_BYTE, true, S, 14);
  }

  /* ---------------------------------------------------------------- */
  /* drawing                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Rebuilds the per-pass draw lists with frustum culling.
   * @param {Iterable<import('../world/chunk.js').Chunk>} chunks
   * @param {import('./camera.js').Camera} camera
   * @param {number} maxDistance chunks beyond this are skipped
   */
  cull(chunks, camera, maxDistance) {
    for (const list of this.lists) list.length = 0;
    this.stats.chunksDrawn = 0;
    this.stats.chunksCulled = 0;

    const px = camera.position[0];
    const pz = camera.position[2];
    const maxSq = maxDistance * maxDistance;

    for (const chunk of chunks) {
      const minX = chunk.originX;
      const minZ = chunk.originZ;
      const cx = minX + CHUNK_SIZE / 2;
      const cz = minZ + CHUNK_SIZE / 2;
      const dx = cx - px; const dz = cz - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq > maxSq) { this.stats.chunksCulled++; continue; }

      if (!camera.boxVisible(minX, 0, minZ, minX + CHUNK_SIZE, WORLD_HEIGHT, minZ + CHUNK_SIZE)) {
        this.stats.chunksCulled++;
        continue;
      }

      let any = false;
      for (let pass = 0; pass < 3; pass++) {
        const mesh = chunk.meshes[PASS_NAMES[pass]];
        if (mesh && mesh.quadCount > 0) {
          this.lists[pass].push({ chunk, mesh, distSq });
          any = true;
        }
      }
      if (any) this.stats.chunksDrawn++;
    }

    // Opaque: near-to-far maximises early-z rejection.
    this.lists[PASS.OPAQUE].sort((a, b) => a.distSq - b.distSq);
    this.lists[PASS.CUTOUT].sort((a, b) => a.distSq - b.distSq);
    // Translucent: far-to-near so blending composites correctly.
    this.lists[PASS.TRANSLUCENT].sort((a, b) => b.distSq - a.distSq);
  }

  /**
   * Binds the shared uniforms for all three passes.
   * @param {object} env see Renderer#buildEnvironment
   */
  beginFrame(camera, env, time) {
    const gl = this.gl;
    const p = this.program.use();
    p.mat4('uViewProj', camera.viewProjection);
    p.vec3('uCameraPos', camera.position);
    p.float('uTime', time);
    p.float('uDaylight', env.daylight);
    p.vec3('uSkyLightColor', env.skyLightColor);
    p.float('uAmbient', env.ambient);
    p.vec3('uFogColor', env.fogColor);
    p.float('uFogStart', env.fogStart);
    p.float('uFogEnd', env.fogEnd);
    p.float('uFogDensity', env.fogDensity);
    this.textures.animFrames(time, this.animFrames);
    const loc = p.loc('uAnimFrames');
    if (loc) gl.uniform4fv(loc, this.animFrames);
    p.texture('uAtlas', 0, gl.TEXTURE_2D_ARRAY, this.textures.blockArray);
  }

  /** Draws one pass with the appropriate GL state. */
  drawPass(pass) {
    const gl = this.gl;
    const list = this.lists[pass];
    if (list.length === 0) return;
    const p = this.program;

    switch (pass) {
      case PASS.OPAQUE:
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        p.float('uAlphaCutoff', 0.02);
        p.float('uOpacity', 1);
        break;
      case PASS.CUTOUT:
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        // Alpha tested: keeps leaf and plant silhouettes crisp.
        p.float('uAlphaCutoff', 0.5);
        p.float('uOpacity', 1);
        break;
      case PASS.TRANSLUCENT:
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // Water needs both faces so the surface is visible from below.
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        p.float('uAlphaCutoff', 0.02);
        p.float('uOpacity', 0.82);
        break;
      default: break;
    }

    const originLoc = p.loc('uChunkOrigin');
    for (const item of list) {
      gl.bindVertexArray(item.mesh.vao);
      if (originLoc) gl.uniform3f(originLoc, item.chunk.originX, 0, item.chunk.originZ);
      gl.drawElements(gl.TRIANGLES, item.mesh.quadCount * 6, gl.UNSIGNED_INT, 0);
      this.stats.quadsDrawn += item.mesh.quadCount;
      this.stats.drawCalls++;
    }
    gl.bindVertexArray(null);

    if (pass === PASS.TRANSLUCENT) {
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }
  }

  resetStats() {
    this.stats.quadsDrawn = 0;
    this.stats.drawCalls = 0;
  }

  /** Releases a chunk's GPU buffers (called when a chunk unloads). */
  release(chunk) {
    for (const name of PASS_NAMES) {
      const mesh = chunk.meshes[name];
      if (!mesh) continue;
      this.stats.gpuBytes -= mesh.capacity;
      this.gl.deleteVertexArray(mesh.vao);
      this.gl.deleteBuffer(mesh.vbo);
      chunk.meshes[name] = null;
    }
  }

  dispose() {
    this.program.dispose();
    this.gl.deleteBuffer(this.indexBuffer.buffer);
  }
}
