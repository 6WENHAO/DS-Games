/**
 * gfx/renderer.js
 * ------------------------------------------------------------------
 * Frame orchestration: owns the GL context, the texture set and every
 * sub-renderer, computes the per-frame environment (fog, daylight,
 * underwater state) and issues the passes in the right order.
 *
 * Pass order
 *   1. sky gradient, stars, sun/moon      (no depth)
 *   2. terrain opaque                     (depth write, cull back)
 *   3. terrain cutout                     (alpha test)
 *   4. clouds                             (depth test, no depth write)
 *   5. terrain translucent                (blended, back-to-front)
 *   6. entities
 *   7. particles
 *   8. block selection outline + break crack
 *   9. first-person hand / held item
 *  10. screen overlays and the 2D interface
 */

import { createContext, probeCapabilities, resizeToDisplay, clear, createBuffer } from './gl.js';
import { buildProgram } from './program.js';
import { overlayVertexShader, overlayFragmentShader } from './shaders/chunk.js';
import { TextureSet } from './textures.js';
import { ChunkRenderer } from './chunk-renderer.js';
import { SkyRenderer } from './sky-renderer.js';
import { SpriteBatch } from './sprite-batch.js';
import { PASS } from '../world/constants.js';
import { B, blocks } from '../world/blocks.js';
import { clamp } from '../core/math.js';

/** Unit cube edge list for the block selection wireframe. */
function cubeEdgeVertices(inflate = 0.002) {
  const a = -inflate;
  const b = 1 + inflate;
  const c = [
    [a, a, a], [b, a, a], [b, a, b], [a, a, b],
    [a, b, a], [b, b, a], [b, b, b], [a, b, b],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const out = new Float32Array(edges.length * 2 * 5);
  let i = 0;
  for (const [p, q] of edges) {
    for (const idx of [p, q]) {
      out[i++] = c[idx][0]; out[i++] = c[idx][1]; out[i++] = c[idx][2];
      out[i++] = 0; out[i++] = 0;
    }
  }
  return out;
}

/** Six faces of a slightly inflated unit cube with 0..1 UVs. */
function cubeFaceVertices(inflate = 0.003) {
  const a = -inflate;
  const b = 1 + inflate;
  const faces = [
    // +X, -X, +Y, -Y, +Z, -Z, each as 4 corners CCW from outside
    [[b, a, b], [b, a, a], [b, b, a], [b, b, b]],
    [[a, a, a], [a, a, b], [a, b, b], [a, b, a]],
    [[a, b, a], [a, b, b], [b, b, b], [b, b, a]],
    [[a, a, a], [b, a, a], [b, a, b], [a, a, b]],
    [[a, a, b], [b, a, b], [b, b, b], [a, b, b]],
    [[b, a, a], [a, a, a], [a, b, a], [b, b, a]],
  ];
  const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const out = new Float32Array(6 * 6 * 5);
  let i = 0;
  for (const face of faces) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out[i++] = face[k][0]; out[i++] = face[k][1]; out[i++] = face[k][2];
      out[i++] = uv[k][0]; out[i++] = uv[k][1];
    }
  }
  return out;
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [settings]
   */
  constructor(canvas, settings = {}) {
    this.canvas = canvas;
    this.gl = createContext(canvas, { antialias: false });
    this.caps = probeCapabilities(this.gl);
    this.settings = {
      renderDistance: 8,
      guiScale: 0,
      resolutionScale: 1,
      brightness: 0.08,
      fov: 70,
      clouds: true,
      stars: true,
      smoothLighting: true,
      ...settings,
    };

    this.textures = new TextureSet(this.gl, { caps: this.caps, anisotropy: 4 });
    /** Filled in by init(). */
    this.chunks = null;
    this.sky = null;
    this.gui = null;
    this.overlayProgram = null;

    this.environment = {
      daylight: 1,
      skyLightColor: new Float32Array([1, 1, 1]),
      fogColor: new Float32Array([0.66, 0.79, 1]),
      ambient: this.settings.brightness,
      fogStart: 80,
      fogEnd: 128,
      fogDensity: 0,
      underwater: false,
      inLava: false,
    };

    this.frameStats = { fps: 0, frameMs: 0, drawCalls: 0, quads: 0 };
    this.time = 0;
  }

  /** Loads textures and builds the sub-renderers. */
  async init(onProgress) {
    await this.textures.load(onProgress);
    const gl = this.gl;

    this.chunks = new ChunkRenderer(gl, this.textures);
    this.sky = new SkyRenderer(gl, this.textures);
    this.gui = new SpriteBatch(gl);
    this.gui.setWhite(this.textures.white);

    this.overlayProgram = buildProgram(gl, {
      name: 'overlay', vertex: overlayVertexShader, fragment: overlayFragmentShader,
    });

    // Selection wireframe
    this.edgeVao = gl.createVertexArray();
    gl.bindVertexArray(this.edgeVao);
    this.edgeBuffer = createBuffer(gl, gl.ARRAY_BUFFER, cubeEdgeVertices());
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

    // Break-progress cube
    this.faceVao = gl.createVertexArray();
    gl.bindVertexArray(this.faceVao);
    this.faceBuffer = createBuffer(gl, gl.ARRAY_BUFFER, cubeFaceVertices());
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);

    this.sky.enabled.clouds = this.settings.clouds;
    this.sky.enabled.stars = this.settings.stars;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL ?? 0x9240, false);
    return this;
  }

  /**
   * The texture layer table the chunk worker needs, built once the array
   * texture exists.
   */
  buildLayerTable() {
    const faceLayers = new Int16Array(blocks.length * 6);
    const animGroups = new Uint8Array(blocks.length);
    for (const b of blocks) {
      for (let f = 0; f < 6; f++) faceLayers[b.id * 6 + f] = b.faceLayers[f];
      animGroups[b.id] = b.animGroup ?? 0;
    }
    return {
      faceLayers,
      grassSideLayers: this.textures.grassSideLayers.slice(),
      snowSideLayer: this.textures.snowSideLayer,
      animGroups,
    };
  }

  /** Applies a settings change that needs GL or sub-renderer attention. */
  applySettings(patch) {
    Object.assign(this.settings, patch);
    this.environment.ambient = this.settings.brightness;
    if (this.sky) {
      this.sky.enabled.clouds = this.settings.clouds;
      this.sky.enabled.stars = this.settings.stars;
    }
    this.resize(true);
  }

  /** Syncs the drawing buffer with the CSS size. */
  resize(force = false) {
    const changed = resizeToDisplay(this.gl, this.canvas, this.settings.resolutionScale);
    if (changed || force) {
      this.gui?.resize(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, this.settings.guiScale);
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }
    return changed;
  }

  get aspect() {
    return this.gl.drawingBufferWidth / Math.max(1, this.gl.drawingBufferHeight);
  }

  /* ---------------------------------------------------------------- */
  /* environment                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Recomputes fog and light uniforms for this frame.
   * @param {import('./camera.js').Camera} camera
   * @param {import('../game/daycycle.js').DayCycle} day
   * @param {import('../world/world.js').World} world
   */
  buildEnvironment(camera, day, world) {
    const env = this.environment;
    const eyeBlock = world.getBlock(
      Math.floor(camera.position[0]), Math.floor(camera.position[1]), Math.floor(camera.position[2]),
    );
    env.underwater = eyeBlock === B.WATER;
    env.inLava = eyeBlock === B.LAVA;

    env.daylight = day.daylight;
    env.skyLightColor.set(day.skyLightColor);
    env.ambient = this.settings.brightness;

    const viewDistance = this.settings.renderDistance * 16;

    if (env.inLava) {
      env.fogColor.set([0.72, 0.22, 0.03]);
      env.fogStart = 0.2;
      env.fogEnd = 2.5;
      env.fogDensity = 1.4;
    } else if (env.underwater) {
      const biome = world.biomeAt(Math.floor(camera.position[0]), Math.floor(camera.position[2]));
      const tint = biome.water;
      const brightness = 0.35 + 0.65 * day.daylight;
      env.fogColor.set([
        tint[0] * 0.32 * brightness,
        tint[1] * 0.55 * brightness,
        tint[2] * 0.75 * brightness,
      ]);
      env.fogStart = 0.5;
      env.fogEnd = 26;
      env.fogDensity = 0.085;
    } else {
      env.fogColor.set(day.fogColor);
      env.fogStart = viewDistance * 0.58;
      env.fogEnd = viewDistance * 0.98;
      env.fogDensity = 0;
    }
    return env;
  }

  /* ---------------------------------------------------------------- */
  /* frame                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Renders one frame of the world (everything except the 2D interface,
   * which the caller draws afterwards through `this.gui`).
   *
   * @param {object} scene
   * @param {import('./camera.js').Camera} scene.camera
   * @param {import('../world/world.js').World} scene.world
   * @param {import('../game/daycycle.js').DayCycle} scene.day
   * @param {number} scene.dt
   * @param {object|null} [scene.target] highlighted block {x,y,z,progress}
   */
  renderWorld({ camera, world, day, dt, target = null, entities = null, particles = null }) {
    const gl = this.gl;
    this.time += dt;
    this.chunks.resetStats();

    const env = this.buildEnvironment(camera, day, world);
    const far = Math.max(64, this.settings.renderDistance * 16 * 1.5);
    camera.fov = this.settings.fov;
    camera.update(this.aspect, far);

    clear(gl, env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);

    // 1. sky
    this.sky.drawBackground(camera, day, env);

    // 2..3. terrain solid geometry
    this.chunks.cull(world.chunks.values(), camera, this.settings.renderDistance * 16 + 24);
    this.chunks.beginFrame(camera, env, this.time);
    this.chunks.drawPass(PASS.OPAQUE);
    this.chunks.drawPass(PASS.CUTOUT);

    // 4. clouds sit between solid terrain and water
    this.sky.drawClouds(camera, day, env, dt);

    // 5. entities before translucency so water blends over them
    entities?.render(camera, env, day);

    // 6. water and other blended blocks
    this.chunks.beginFrame(camera, env, this.time);
    this.chunks.drawPass(PASS.TRANSLUCENT);

    // 7. particles
    particles?.render(camera, env);

    // 8. selection + break progress
    if (target) this.drawTarget(camera, target);

    this.frameStats.drawCalls = this.chunks.stats.drawCalls;
    this.frameStats.quads = this.chunks.stats.quadsDrawn;
  }

  /** Black wireframe box plus the crack overlay on the targeted block. */
  drawTarget(camera, target) {
    const gl = this.gl;
    const p = this.overlayProgram.use();
    p.mat4('uViewProj', camera.viewProjection);

    // --- crack overlay -----------------------------------------
    if (target.progress > 0 && this.textures.destroyStrip) {
      const stages = this.textures.destroyStages ?? 10;
      const stage = clamp(Math.floor(target.progress * stages), 0, stages - 1);
      gl.enable(gl.BLEND);
      // Multiplicative-ish blend keeps the crack dark like vanilla.
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      p.int('uUseTexture', 1);
      p.vec4('uColor', 1, 1, 1, 0.85);
      p.vec3('uOffset', target.x, target.y, target.z);
      p.texture('uTex', 0, gl.TEXTURE_2D, this.textures.destroyStrip.texture);
      p.float('uStageCount', stages);
      p.float('uStage', stage);
      gl.bindVertexArray(this.faceVao);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }

    // --- wireframe ---------------------------------------------
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    p.int('uUseTexture', 0);
    p.vec4('uColor', 0, 0, 0, 0.4);
    p.vec3('uOffset', target.x, target.y, target.z);
    gl.bindVertexArray(this.edgeVao);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose() {
    this.chunks?.dispose();
    this.sky?.dispose();
    this.gui?.dispose();
    this.overlayProgram?.dispose();
    this.textures.dispose();
  }
}

