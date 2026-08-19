import * as THREE from 'three';
import { CAMERA, RENDER } from '../config.js';
import { PostFX } from '../vfx/PostFX.js';

/**
 * Engine — owns the renderer, the scene, the camera and the post-processing
 * chain, plus the adaptive-resolution governor.
 *
 * BACKEND NOTE (deliberate, documented decision)
 * ----------------------------------------------
 * The cinematic path runs on WebGL2 + EffectComposer. The full VFX chain this
 * project needs (god rays, screen-space shockwave refraction, chromatic
 * aberration, velocity-free motion blur) is authored as GLSL ShaderPasses, and
 * the batched rigid-body renderer patches MeshStandardMaterial through
 * onBeforeCompile — neither mechanism exists under WebGPURenderer, which wants
 * NodeMaterial/TSL instead.
 *
 * Rather than ship a half-broken second path, WebGPU/TSL is delivered as a
 * genuine, self-contained implementation of the ocean in src/webgpu/OceanTSL.js
 * (see webgpu-ocean.html). This class still probes for WebGPU so the UI can
 * report the capability and offer the link. The README documents the migration.
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.capabilities = { webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;   // filmic highlight rolloff
    this.renderer.toneMappingExposure = RENDER.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;     // soft directional shadows
    this.renderer.shadowMap.autoUpdate = true;
    // The post chain issues many renderer.render() calls per frame, and
    // renderer.info resets on each one — so a naive read reports the cost of the
    // final blit (1 draw call). Take manual control and reset once per frame so
    // the HUD shows the true whole-frame totals.
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far,
    );
    this.camera.position.set(900, 260, 900);

    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    // ---- adaptive resolution governor -----------------------------------
    // Large debris counts + a 4k shadow map will tank a laptop GPU. Instead of
    // dropping effects we trade pixels: render scale walks between 0.62 and the
    // device ratio, re-evaluated on a slow cadence so it never visibly pumps.
    this._basePixelRatio = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio);
    this._renderScale = 1;
    this._emaFrameMs = 16;
    this._governorCountdown = 60;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  get domElement() { return this.renderer.domElement; }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this._basePixelRatio * this._renderScale);
    this.renderer.setSize(w, h, false);
    this.postfx.setSize(w, h, this._basePixelRatio * this._renderScale);
  }

  /** Frame-time driven resolution governor. Uses REAL dt: it must run while paused. */
  _governResolution(realDt) {
    const ms = realDt * 1000;
    this._emaFrameMs += (ms - this._emaFrameMs) * 0.08;
    if (--this._governorCountdown > 0) return;
    this._governorCountdown = 45;

    const target = RENDER.adaptiveTargetMs;
    const prev = this._renderScale;
    if (this._emaFrameMs > target * 1.35) this._renderScale = Math.max(0.62, prev - 0.08);
    else if (this._emaFrameMs < target * 0.72) this._renderScale = Math.min(1, prev + 0.05);
    if (Math.abs(this._renderScale - prev) > 0.001) this.resize();
  }

  render(dt, realDt) {
    this._governResolution(realDt);
    this.renderer.info.reset();
    this.postfx.render(dt, realDt);
  }

  get stats() {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs ? info.programs.length : 0,
      renderScale: this._renderScale,
      frameMs: this._emaFrameMs,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.postfx.dispose();
    this.renderer.dispose();
  }
}
