/**
 * game/particles.js
 * ------------------------------------------------------------------
 * Particle simulation and rendering.
 *
 * Particles are a flat struct-of-arrays pool so thousands can live
 * without allocation churn. Each one is drawn as a camera-facing
 * billboard, textured either from a block face (break/step dust) or from
 * the vanilla particle sheet (flame, smoke, splash, hearts).
 *
 * Break particles sample the actual block texture, which is what makes
 * vanilla's block-breaking puff read as "that block".
 */

import { buildProgram } from '../gfx/program.js';
import {
  particleVertexShader, particleFragmentShader, PARTICLE_VERTEX_STRIDE,
} from '../gfx/shaders/gui.js';
import { getBlock } from '../world/blocks.js';
import { clamp } from '../core/math.js';

const MAX_PARTICLES = 4000;

/** Sprite regions inside particle/particles.png (a 16x16 grid of 8px cells). */
export const PARTICLE_SPRITE = {
  // The vanilla sheet's first row holds the generic "puff" frames.
  generic0: [0, 0], generic1: [8, 0], generic2: [16, 0], generic3: [24, 0],
  generic4: [32, 0], generic5: [40, 0], generic6: [48, 0], generic7: [56, 0],
  splash: [24, 8], bubble: [0, 16], flame: [0, 24], heart: [8, 16],
};

/** Particle behaviour presets. */
export const PARTICLE_KIND = {
  BLOCK_DUST: 0,
  SMOKE: 1,
  FLAME: 2,
  SPLASH: 3,
  BUBBLE: 4,
  CRIT: 5,
};

export class ParticleSystem {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {import('../gfx/textures.js').TextureSet} textures
   * @param {import('../world/world.js').World} world
   */
  constructor(gl, textures, world) {
    this.gl = gl;
    this.textures = textures;
    this.world = world;

    this.program = buildProgram(gl, {
      name: 'particles', vertex: particleVertexShader, fragment: particleFragmentShader,
    });

    // --- pool -------------------------------------------------------
    this.count = 0;
    this.capacity = MAX_PARTICLES;
    const n = this.capacity;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.size = new Float32Array(n);
    this.gravity = new Float32Array(n);
    this.r = new Uint8Array(n); this.g = new Uint8Array(n); this.b = new Uint8Array(n);
    this.kind = new Uint8Array(n);
    /** For block dust: the array layer to sample. */
    this.layer = new Int16Array(n);
    /** Sub-tile UV offset so each dust particle shows a different pixel patch. */
    this.uOff = new Float32Array(n); this.vOff = new Float32Array(n);
    this.light = new Float32Array(n);

    // --- GPU buffers -----------------------------------------------
    this.vertexData = new ArrayBuffer(this.capacity * 4 * PARTICLE_VERTEX_STRIDE);
    this.f32 = new Float32Array(this.vertexData);
    this.u8 = new Uint8Array(this.vertexData);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);
    const S = PARTICLE_VERTEX_STRIDE;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, S, 20);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 24);

    const indices = new Uint32Array(this.capacity * 6);
    for (let q = 0, i = 0, v = 0; q < this.capacity; q++, i += 6, v += 4) {
      indices[i] = v; indices[i + 1] = v + 1; indices[i + 2] = v + 2;
      indices[i + 3] = v; indices[i + 4] = v + 2; indices[i + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    this.drawn = 0;
  }

  /** Allocates a slot, recycling the oldest particle when full. */
  #alloc() {
    if (this.count < this.capacity) return this.count++;
    // Overwrite whichever particle has the least life left.
    let worst = 0;
    let worstLife = Infinity;
    for (let i = 0; i < this.count; i += 7) {
      if (this.life[i] < worstLife) { worstLife = this.life[i]; worst = i; }
    }
    return worst;
  }

  /**
   * Spawns one particle.
   * @param {object} p
   */
  spawn(p) {
    const i = this.#alloc();
    this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z;
    this.vx[i] = p.vx ?? 0; this.vy[i] = p.vy ?? 0; this.vz[i] = p.vz ?? 0;
    this.maxLife[i] = p.life ?? 0.8;
    this.life[i] = this.maxLife[i];
    this.size[i] = p.size ?? 0.1;
    this.gravity[i] = p.gravity ?? 14;
    this.r[i] = p.r ?? 255; this.g[i] = p.g ?? 255; this.b[i] = p.b ?? 255;
    this.kind[i] = p.kind ?? PARTICLE_KIND.BLOCK_DUST;
    this.layer[i] = p.layer ?? -1;
    this.uOff[i] = p.uOff ?? Math.random() * 0.75;
    this.vOff[i] = p.vOff ?? Math.random() * 0.75;
    this.light[i] = 1;
    return i;
  }

  /**
   * Vanilla-style block break puff: a cloud of particles textured with
   * the block's own top face.
   */
  emitBlockBreak(x, y, z, blockId, amount = 22) {
    const def = getBlock(blockId);
    const layer = def.faceLayers[2] ?? 0;
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
        vx: (Math.random() - 0.5) * 3.2,
        vy: Math.random() * 3.4 + 0.6,
        vz: (Math.random() - 0.5) * 3.2,
        life: 0.5 + Math.random() * 0.5,
        size: 0.06 + Math.random() * 0.06,
        gravity: 16,
        kind: PARTICLE_KIND.BLOCK_DUST,
        layer,
      });
    }
  }

  /** Small puff while a block is being hit. */
  emitBlockHit(x, y, z, nx, ny, nz, blockId) {
    const def = getBlock(blockId);
    const layer = def.faceLayers[2] ?? 0;
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + 0.5 + nx * 0.55 + (Math.random() - 0.5) * 0.5,
        y: y + 0.5 + ny * 0.55 + (Math.random() - 0.5) * 0.5,
        z: z + 0.5 + nz * 0.55 + (Math.random() - 0.5) * 0.5,
        vx: nx * 1.2 + (Math.random() - 0.5), vy: 0.8 + Math.random(), vz: nz * 1.2 + (Math.random() - 0.5),
        life: 0.35 + Math.random() * 0.3,
        size: 0.05,
        gravity: 12,
        kind: PARTICLE_KIND.BLOCK_DUST,
        layer,
      });
    }
  }

  /** Dust kicked up by footsteps and landings. */
  emitStepDust(x, y, z, blockId, amount = 6) {
    const def = getBlock(blockId);
    const layer = def.faceLayers[2] ?? 0;
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.6, y: y + 0.06, z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 1.1, vy: Math.random() * 0.9, vz: (Math.random() - 0.5) * 1.1,
        life: 0.35 + Math.random() * 0.25,
        size: 0.05, gravity: 10,
        kind: PARTICLE_KIND.BLOCK_DUST, layer,
      });
    }
  }

  /** Torch/lava flame flicker. */
  emitFlame(x, y, z) {
    this.spawn({
      x, y, z,
      vx: (Math.random() - 0.5) * 0.1, vy: 0.16 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.1,
      life: 0.6, size: 0.08, gravity: -1.2,
      kind: PARTICLE_KIND.FLAME, r: 255, g: 200, b: 90,
    });
  }

  emitSmoke(x, y, z, amount = 1) {
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.2, y, z: z + (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 0.3, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.3,
        life: 1.2, size: 0.12, gravity: -0.8,
        kind: PARTICLE_KIND.SMOKE, r: 60, g: 60, b: 60,
      });
    }
  }

  /** Splash ring when something enters water. */
  emitSplash(x, y, z, amount = 16) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 1.6;
      this.spawn({
        x: x + Math.cos(a) * 0.3, y: y + 0.1, z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * speed, vy: 2 + Math.random() * 2, vz: Math.sin(a) * speed,
        life: 0.5, size: 0.06, gravity: 18,
        kind: PARTICLE_KIND.SPLASH, r: 200, g: 225, b: 255,
      });
    }
  }

  /** Bubbles trailing an underwater entity. */
  emitBubble(x, y, z) {
    this.spawn({
      x, y, z,
      vx: (Math.random() - 0.5) * 0.3, vy: 1.2, vz: (Math.random() - 0.5) * 0.3,
      life: 1.0, size: 0.05, gravity: -3,
      kind: PARTICLE_KIND.BUBBLE, r: 220, g: 240, b: 255,
    });
  }

  emitCrit(x, y, z, amount = 8) {
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x, y, z,
        vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3,
        life: 0.4, size: 0.07, gravity: 8,
        kind: PARTICLE_KIND.CRIT, r: 255, g: 240, b: 180,
      });
    }
  }

  /**
   * Advances every particle, applying gravity, drag, world collision and
   * per-particle lighting.
   */
  update(dt) {
    const world = this.world;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.#kill(i); continue; }

      this.vy[i] -= this.gravity[i] * dt;
      // Air drag; smoke and flame rise slowly so they need heavier drag.
      const drag = this.kind[i] === PARTICLE_KIND.SMOKE || this.kind[i] === PARTICLE_KIND.FLAME ? 2.4 : 1.2;
      const damp = Math.exp(-drag * dt);
      this.vx[i] *= damp; this.vz[i] *= damp;

      let nx = this.px[i] + this.vx[i] * dt;
      let ny = this.py[i] + this.vy[i] * dt;
      let nz = this.pz[i] + this.vz[i] * dt;

      // Cheap collision: stop at solid blocks, bounce a little on the floor.
      if (world.isSolidAt(Math.floor(nx), Math.floor(this.py[i]), Math.floor(this.pz[i]))) {
        nx = this.px[i]; this.vx[i] = 0;
      }
      if (world.isSolidAt(Math.floor(this.px[i]), Math.floor(ny), Math.floor(this.pz[i]))) {
        ny = this.py[i];
        this.vy[i] = -this.vy[i] * 0.25;
        this.vx[i] *= 0.6; this.vz[i] *= 0.6;
      }
      if (world.isSolidAt(Math.floor(this.px[i]), Math.floor(this.py[i]), Math.floor(nz))) {
        nz = this.pz[i]; this.vz[i] = 0;
      }
      this.px[i] = nx; this.py[i] = ny; this.pz[i] = nz;

      // Sample world light for shading.
      const lightByte = world.getLightByte(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      const sky = (lightByte >> 4) & 15;
      const block = lightByte & 15;
      const level = Math.max(sky, block) / 15;
      this.light[i] = this.kind[i] === PARTICLE_KIND.FLAME ? 1 : clamp(0.12 + level * 0.95, 0, 1);
      i++;
    }
  }

  /** Swap-removes a particle. */
  #kill(i) {
    const last = --this.count;
    if (i !== last) {
      this.px[i] = this.px[last]; this.py[i] = this.py[last]; this.pz[i] = this.pz[last];
      this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.vz[i] = this.vz[last];
      this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
      this.size[i] = this.size[last]; this.gravity[i] = this.gravity[last];
      this.r[i] = this.r[last]; this.g[i] = this.g[last]; this.b[i] = this.b[last];
      this.kind[i] = this.kind[last]; this.layer[i] = this.layer[last];
      this.uOff[i] = this.uOff[last]; this.vOff[i] = this.vOff[last];
      this.light[i] = this.light[last];
    }
  }

  /**
   * Draws every particle as a camera-facing quad.
   *
   * Block dust is drawn from the block array texture and sheet particles
   * from the 2D particle atlas, so the pool is split into two batches.
   */
  render(camera, env) {
    if (this.count === 0) { this.drawn = 0; return; }
    const gl = this.gl;
    const rx = camera.right[0]; const ry = camera.right[1]; const rz = camera.right[2];
    const ux = camera.up[0]; const uy = camera.up[1]; const uz = camera.up[2];

    // Two passes so each uses the right sampler.
    for (const pass of [0, 1]) {
      let quads = 0;
      for (let i = 0; i < this.count; i++) {
        const isDust = this.kind[i] === PARTICLE_KIND.BLOCK_DUST;
        if ((pass === 0) !== isDust) continue;

        const s = this.size[i];
        // Fade out over the last third of the lifetime.
        const t = this.life[i] / this.maxLife[i];
        const alpha = Math.round(clamp(t * 3, 0, 1) * 255);

        let u0; let v0; let u1; let v1;
        if (isDust) {
          // A quarter-tile patch of the block texture.
          u0 = this.uOff[i]; v0 = this.vOff[i];
          u1 = u0 + 0.25; v1 = v0 + 0.25;
        } else {
          const sheet = this.#sheetUV(this.kind[i], t);
          u0 = sheet[0]; v0 = sheet[1]; u1 = sheet[2]; v1 = sheet[3];
        }

        const base = quads * 4;
        const write = (k, cx, cy, uu, vv) => {
          const o = (base + k) * (PARTICLE_VERTEX_STRIDE / 4);
          this.f32[o] = this.px[i] + rx * cx * s + ux * cy * s;
          this.f32[o + 1] = this.py[i] + ry * cx * s + uy * cy * s;
          this.f32[o + 2] = this.pz[i] + rz * cx * s + uz * cy * s;
          this.f32[o + 3] = uu;
          this.f32[o + 4] = vv;
          const bo = (base + k) * PARTICLE_VERTEX_STRIDE + 20;
          this.u8[bo] = this.r[i]; this.u8[bo + 1] = this.g[i];
          this.u8[bo + 2] = this.b[i]; this.u8[bo + 3] = alpha;
          this.f32[o + 6] = this.light[i];
        };
        write(0, -1, -1, u0, v1);
        write(1, 1, -1, u1, v1);
        write(2, 1, 1, u1, v0);
        write(3, -1, 1, u0, v0);
        quads++;
        if (quads >= this.capacity) break;
      }
      if (quads === 0) continue;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);

      const p = this.program.use();
      p.mat4('uViewProj', camera.viewProjection);
      p.vec3('uCameraPos', camera.position);
      p.vec3('uFogColor', env.fogColor);
      p.float('uFogStart', env.fogStart);
      p.float('uFogEnd', env.fogEnd);
      p.float('uFogDensity', env.fogDensity);
      // Dust uses one representative block texture layer via a 2D view;
      // the particle sheet covers everything else.
      p.texture('uTex', 0, gl.TEXTURE_2D, this.textures.get('particles').texture);

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0,
        new Uint8Array(this.vertexData, 0, quads * 4 * PARTICLE_VERTEX_STRIDE));
      gl.drawElements(gl.TRIANGLES, quads * 6, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);

      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      this.drawn = quads;
    }
  }

  /** UV rect inside particles.png for a sheet-based particle kind. */
  #sheetUV(kind, t) {
    const sheet = this.textures.get('particles');
    const cell = 8 / sheet.width;
    const pick = (col, row) => [col * cell, row * cell, (col + 1) * cell, (row + 1) * cell];
    switch (kind) {
      case PARTICLE_KIND.SMOKE: return pick(Math.min(7, Math.floor((1 - t) * 8)), 0);
      case PARTICLE_KIND.FLAME: return pick(0, 3);
      case PARTICLE_KIND.SPLASH: return pick(3, 1);
      case PARTICLE_KIND.BUBBLE: return pick(0, 2);
      case PARTICLE_KIND.CRIT: return pick(1, 2);
      default: return pick(0, 0);
    }
  }

  clear() { this.count = 0; }

  dispose() {
    this.program.dispose();
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.vbo);
    this.gl.deleteBuffer(this.ibo);
  }
}
