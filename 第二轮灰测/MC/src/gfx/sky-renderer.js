/**
 * gfx/sky-renderer.js
 * ------------------------------------------------------------------
 * Everything above the terrain: the sky gradient, a rotating star field,
 * the sun and phased moon, and the scrolling cloud deck.
 *
 * Draw order within a frame
 *   sky gradient -> stars -> sun/moon      (before terrain, no depth)
 *   clouds                                 (after opaque terrain, depth
 *                                           tested so mountains occlude
 *                                           them correctly)
 */

import { buildProgram } from './program.js';
import { createBuffer } from './gl.js';
import {
  skyVertexShader, skyFragmentShader,
  starVertexShader, starFragmentShader,
  celestialVertexShader, celestialFragmentShader,
  cloudVertexShader, cloudFragmentShader,
} from './shaders/sky.js';
import { mulberry32 } from '../world/noise.js';
import { vec3 } from '../core/math.js';
import { WORLD_HEIGHT } from '../world/constants.js';

const STAR_COUNT = 1800;
/** Cloud deck altitude; vanilla puts clouds well above the build height. */
export const CLOUD_HEIGHT = WORLD_HEIGHT - 10;
const CLOUD_EXTENT = 1400;
/** World blocks per cloud texture pixel. */
const CLOUD_BLOCKS_PER_PIXEL = 8;

export class SkyRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {import('./textures.js').TextureSet} textures
   */
  constructor(gl, textures) {
    this.gl = gl;
    this.textures = textures;

    this.skyProgram = buildProgram(gl, { name: 'sky', vertex: skyVertexShader, fragment: skyFragmentShader });
    this.starProgram = buildProgram(gl, { name: 'stars', vertex: starVertexShader, fragment: starFragmentShader });
    this.celestialProgram = buildProgram(gl, { name: 'celestial', vertex: celestialVertexShader, fragment: celestialFragmentShader });
    this.cloudProgram = buildProgram(gl, { name: 'clouds', vertex: cloudVertexShader, fragment: cloudFragmentShader });

    // Empty VAO for the attribute-less full-screen triangle.
    this.emptyVao = gl.createVertexArray();

    this.#buildStars();
    this.#buildQuads();

    this.right = vec3.create();
    this.up = vec3.create();
    this.centre = vec3.create();
    this.cloudScroll = 0;
    this.enabled = { stars: true, clouds: true, celestial: true };
  }

  /** A fixed pseudo-random star field on the unit sphere. */
  #buildStars() {
    const gl = this.gl;
    const rand = mulberry32(0x57a45);
    const data = new Float32Array(STAR_COUNT * 4);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform sphere sampling, then bias magnitude so most stars are faint.
      let x; let y; let z; let len;
      do {
        x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1;
        len = Math.hypot(x, y, z);
      } while (len < 0.001 || len > 1);
      const inv = 1 / len;
      const mag = rand() ** 2.2;
      data[i * 4] = x * inv;
      data[i * 4 + 1] = y * inv;
      data[i * 4 + 2] = z * inv;
      data[i * 4 + 3] = 0.15 + mag * 0.85;
    }
    this.starVao = gl.createVertexArray();
    gl.bindVertexArray(this.starVao);
    this.starBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
  }

  /** Unit quads used by the sun/moon billboards and the cloud deck. */
  #buildQuads() {
    const gl = this.gl;
    // -1..1 quad for billboards
    this.billboardVao = gl.createVertexArray();
    gl.bindVertexArray(this.billboardVao);
    this.billboardBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, 1, 1,
      -1, -1, 1, 1, -1, 1,
    ]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

    // 0..1 quad for the cloud plane
    this.cloudVao = gl.createVertexArray();
    gl.bindVertexArray(this.cloudVao);
    this.cloudBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Draws the sky dome, stars and celestial bodies.
   * Must run before terrain with depth writes disabled.
   */
  drawBackground(camera, day, env) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    // --- gradient -------------------------------------------------
    const sp = this.skyProgram.use();
    sp.mat4('uInvViewProj', camera.invViewProjection);
    sp.vec3('uCameraPos', camera.position);
    sp.vec3('uZenithColor', day.zenithColor);
    sp.vec3('uHorizonColor', day.horizonColor);
    sp.vec3('uVoidColor', day.voidColor);
    sp.vec3('uSunDir', day.sunDirection);
    sp.vec3('uSunGlowColor', day.sunGlowColor);
    sp.float('uSunGlowStrength', day.sunGlowStrength);
    sp.float('uNight', day.nightFactor);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    if (env.underwater) {
      // Underwater the sky is irrelevant; skip the celestial layer.
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      return;
    }

    // --- stars ----------------------------------------------------
    if (this.enabled.stars && day.nightFactor > 0.01) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const stp = this.starProgram.use();
      stp.mat4('uViewProj', camera.viewProjection);
      stp.vec3('uCameraPos', camera.position);
      stp.float('uCelestialAngle', day.celestialAngle);
      stp.float('uAlpha', day.nightFactor * 0.9);
      stp.float('uPointScale', Math.max(1, gl.drawingBufferHeight / 420));
      gl.bindVertexArray(this.starVao);
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);
      gl.bindVertexArray(null);
    }

    // --- sun & moon ----------------------------------------------
    if (this.enabled.celestial) {
      gl.enable(gl.BLEND);
      const cp = this.celestialProgram.use();
      cp.mat4('uViewProj', camera.viewProjection);
      gl.bindVertexArray(this.billboardVao);

      // Sun: additive so it blows out the sky around it.
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.#drawBody(cp, camera, day.sunDirection, 30, 'sun', 0, 0, 1, 1,
        1, 1, 1, Math.max(0, Math.min(1, 0.35 + day.sunDirection[1] * 2.2)));

      // Moon: normal blending, UV picks the current phase from a 4x2 sheet.
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const phase = day.moonPhase % 8;
      const col = phase % 4;
      const row = Math.floor(phase / 4);
      this.#drawBody(cp, camera, day.moonDirection, 20, 'moon',
        col / 4, row / 2, 1 / 4, 1 / 2,
        1, 1, 1, Math.max(0, Math.min(1, 0.25 + day.moonDirection[1] * 2.4)));

      gl.bindVertexArray(null);
    }

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  /** Places one billboard on the celestial sphere and draws it. */
  #drawBody(program, camera, direction, size, texName, u0, v0, uw, vh, r, g, b, a) {
    if (a <= 0.002) return;
    const gl = this.gl;
    const distance = 190;
    vec3.scale(this.centre, direction, distance);
    vec3.add(this.centre, camera.position, this.centre);

    // Build a stable basis perpendicular to the view direction.
    const upHint = Math.abs(direction[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
    vec3.cross(this.right, direction, upHint);
    vec3.normalize(this.right, this.right);
    vec3.cross(this.up, this.right, direction);
    vec3.normalize(this.up, this.up);

    program.vec3('uCenter', this.centre);
    program.vec3('uRight', this.right);
    program.vec3('uUp', this.up);
    program.float('uSize', size);
    program.vec4('uUVRect', u0, v0, uw, vh);
    program.vec4('uColor', r, g, b, a);
    program.texture('uTex', 0, gl.TEXTURE_2D, this.textures.get(texName).texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Draws the cloud deck. Runs after opaque terrain so hills occlude it,
   * with depth writes off so water still blends over it.
   */
  drawClouds(camera, day, env, dt) {
    if (!this.enabled.clouds || env.underwater) return;
    const gl = this.gl;
    this.cloudScroll += dt * 1.6;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    const p = this.cloudProgram.use();
    p.mat4('uViewProj', camera.viewProjection);
    p.vec3('uCameraPos', camera.position);
    p.float('uHeight', CLOUD_HEIGHT);
    p.float('uExtent', CLOUD_EXTENT);
    p.vec2('uScroll', this.cloudScroll, 0);
    p.float('uScale', 1 / (CLOUD_BLOCKS_PER_PIXEL * 256));
    p.vec3('uCloudColor', day.cloudColor);
    p.float('uOpacity', 0.85);
    p.vec3('uFogColor', day.fogColor);
    p.float('uFadeStart', CLOUD_EXTENT * 0.18);
    p.float('uFadeEnd', CLOUD_EXTENT * 0.52);
    p.texture('uTex', 0, gl.TEXTURE_2D, this.textures.get('clouds').texture);

    gl.bindVertexArray(this.cloudVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const gl = this.gl;
    this.skyProgram.dispose();
    this.starProgram.dispose();
    this.celestialProgram.dispose();
    this.cloudProgram.dispose();
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteVertexArray(this.starVao);
    gl.deleteVertexArray(this.billboardVao);
    gl.deleteVertexArray(this.cloudVao);
    gl.deleteBuffer(this.starBuffer);
    gl.deleteBuffer(this.billboardBuffer);
    gl.deleteBuffer(this.cloudBuffer);
  }
}
