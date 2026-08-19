import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { GodRaysShader } from '../shaders/godrays.glsl.js';
import { ShockwaveShader } from '../shaders/shockwave.glsl.js';
import { GradeShader } from '../shaders/grade.glsl.js';
import { BLOOM_LAYER } from './ParticleSystem.js';
import { RENDER } from '../config.js';

const MAX_WAVES = 3;

/**
 * GradePass — the final pass, which also owns the motion-blur history.
 *
 * It renders the graded image into a persistent history target and then blits
 * that to the screen, so next frame's blur has a real previous frame to read.
 * Two ping-ponged targets, one extra blit; no velocity buffer, no reprojection.
 */
class GradePass extends Pass {
  constructor() {
    super();
    this.uniforms = THREE.UniformsUtils.clone(GradeShader.uniforms);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
    });
    this.fsQuad = new FullScreenQuad(this.material);

    this.copyUniforms = THREE.UniformsUtils.clone(CopyShader.uniforms);
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
    });
    this.copyQuad = new FullScreenQuad(this.copyMaterial);

    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.history = [
      new THREE.WebGLRenderTarget(1, 1, opts),
      new THREE.WebGLRenderTarget(1, 1, opts),
    ];
    this.cur = 0;
  }

  setSize(w, h) {
    for (const rt of this.history) rt.setSize(Math.max(1, w), Math.max(1, h));
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tPrev.value = this.history[this.cur].texture;

    const next = 1 - this.cur;
    renderer.setRenderTarget(this.history[next]);
    renderer.clear();
    this.fsQuad.render(renderer);

    this.copyUniforms.tDiffuse.value = this.history[next].texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.copyQuad.render(renderer);

    this.cur = next;
  }

  dispose() {
    this.material.dispose();
    this.copyMaterial.dispose();
    this.fsQuad.dispose();
    this.copyQuad.dispose();
    for (const rt of this.history) rt.dispose();
  }
}

/** Additively composites the isolated bloom render over the main image. */
const BloomCombineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tBloom: { value: null },
    tBloomBase: { value: null },
    uStrength: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform sampler2D tBloomBase;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      // UnrealBloomPass outputs (bloomed input + input). The input's own
      // brightness is ALREADY in the main image (the bloom layer renders into
      // the main pass too), so adding the pass output verbatim would count the
      // fireball twice and blow the frame out — measured: a meteor blast frame
      // went 100% white. Subtract the pass input to isolate the blur EXCESS,
      // the halo, and add only that.
      vec3 excess = texture2D(tBloom, vUv).rgb - texture2D(tBloomBase, vUv).rgb;
      gl_FragColor = vec4(base + max(excess, vec3(0.0)) * uStrength, 1.0);
    }
  `,
};

/**
 * PostFX — the cinematic chain.
 *
 *   scene ──► RenderPass ──► GodRays ──► Shockwave ──► +Bloom ──► Grade ──► screen
 *                                                        ▲
 *   scene (BLOOM layer only) ──► RenderPass(black) ──► UnrealBloom
 *
 * SELECTIVE BLOOM, DONE PROPERLY
 * ------------------------------
 * A threshold bloom over the whole frame makes the sky and the white foam glow.
 * Instead, a second composer renders ONLY objects on the bloom layer (fire,
 * embers) against black, blurs that, and adds it back. The extra render is
 * almost free because the bloom layer contains nothing but two instanced
 * particle draws — and the result is that fire glows while a sunlit tower does
 * not, which is the whole point.
 */
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // ---- bloom (isolated layer) ----
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomRenderPass = new RenderPass(scene, camera, null, 0x000000, 1);
    this.bloomComposer.addPass(this.bloomRenderPass);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1), RENDER.bloomStrength, RENDER.bloomRadius, 0.0,
    );
    this.bloomComposer.addPass(this.bloomPass);

    // ---- main chain ----
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.godRays = new ShaderPass(GodRaysShader);
    this.godRays.uniforms.uSunScreen.value = new THREE.Vector2(0.5, 0.8);
    this.godRays.uniforms.uTint.value = new THREE.Color(1, 0.93, 0.8);
    this.godRays.uniforms.uIntensity.value = 0.75;
    this.composer.addPass(this.godRays);

    this.shockwave = new ShaderPass(ShockwaveShader);
    this.shockwave.uniforms.uWaves.value = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    this.shockwave.uniforms.uWaveMod.value = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    this.shockwave.enabled = false;
    this.composer.addPass(this.shockwave);

    this.bloomCombine = new ShaderPass(BloomCombineShader);
    this.bloomCombine.uniforms.tBloom.value = this.bloomComposer.renderTarget2.texture;
    // The bloom composer's INPUT buffer is the un-blurred source image; the
    // combine shader subtracts it to isolate the bloom halo.
    this.bloomCombine.uniforms.tBloomBase.value = this.bloomComposer.renderTarget1.texture;
    this.composer.addPass(this.bloomCombine);

    this.grade = new GradePass();
    this.composer.addPass(this.grade);

    // OutputPass MUST terminate the chain.
    //
    // When three renders into a render target, it deliberately skips both tone
    // mapping and the output colour-space transform — that is why a composer
    // chain works in linear light. Everything above therefore operates on linear
    // HDR values, and OutputPass is what applies ACES + the sRGB encode on the
    // way to the canvas. Omitting it does not "look slightly off": linear values
    // get written straight into an sRGB framebuffer and the entire image is
    // crushed (measured: mid-grey 0.21 linear displayed as 0.21 sRGB ≈ 2.4×
    // too dark), which is easy to misdiagnose as a lighting bug.
    this.output = new OutputPass();
    this.output.renderToScreen = true;
    this.composer.addPass(this.output);

    /** @type {Array<{center:THREE.Vector3, radius:number, speed:number, age:number, life:number, amp:number, thickness:number, chroma:number, heat:number}>} */
    this.waves = [];

    this._sunWorld = new THREE.Vector3();
    this._proj = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._aspect = 1;
    this._time = 0;
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    // Bloom runs at half resolution: it is a wide blur, nobody can tell.
    this.bloomComposer.setPixelRatio(pixelRatio * 0.5);
    this.bloomComposer.setSize(w, h);
    this.bloomPass.setSize(w * 0.5, h * 0.5);
    this.grade.setSize(Math.round(w * pixelRatio), Math.round(h * pixelRatio));
    this._aspect = w / h;
    this.godRays.uniforms.uAspect.value = this._aspect;
    this.shockwave.uniforms.uAspect.value = this._aspect;
    this.grade.uniforms.uAspect.value = this._aspect;
    // Re-bind: EffectComposer may have recreated its targets.
    this.bloomCombine.uniforms.tBloom.value = this.bloomComposer.renderTarget2.texture;
    this.bloomCombine.uniforms.tBloomBase.value = this.bloomComposer.renderTarget1.texture;
  }

  /**
   * Spawn an expanding shockwave front at a world position.
   * @param {THREE.Vector3} center
   * @param {object} o
   * @param {number} o.speed     front expansion speed (m/s)
   * @param {number} o.life      seconds
   * @param {number} o.amp       peak uv displacement
   * @param {number} o.thickness front thickness in world metres
   * @param {number} o.chroma    dispersion strength
   * @param {number} o.heat      heat-haze amount behind the front
   */
  spawnShockwave(center, o = {}) {
    if (this.waves.length >= MAX_WAVES) this.waves.shift();
    this.waves.push({
      center: center.clone(),
      radius: o.radius0 ?? 2,
      speed: o.speed ?? 620,
      age: 0,
      life: o.life ?? 2.4,
      amp: o.amp ?? 0.055,
      thickness: o.thickness ?? 70,
      chroma: o.chroma ?? 0.35,
      heat: o.heat ?? 0.55,
    });
    this.shockwave.enabled = true;
  }

  /** Per-frame environment/camera coupling, supplied by main. */
  setFrameState({ sunDir, rayTint, rayStrength, motionBlur, aberration }) {
    if (sunDir) {
      // Place a proxy for the sun 8 km out along its direction and project it.
      this._sunWorld.copy(this.camera.position).addScaledVector(sunDir, 8000);
      this._proj.copy(this._sunWorld).project(this.camera);
      this.godRays.uniforms.uSunScreen.value.set(
        this._proj.x * 0.5 + 0.5, this._proj.y * 0.5 + 0.5,
      );
      // Behind the camera → no shafts, and fade as the sun leaves the frame.
      this.camera.getWorldDirection(this._fwd);
      const facing = this._fwd.dot(sunDir);
      const onScreen = Math.max(0, 1 - Math.max(
        Math.abs(this._proj.x) - 1, Math.abs(this._proj.y) - 1, 0,
      ) * 1.4);
      const vis = Math.max(0, facing) * onScreen * (rayStrength ?? 1);
      this.godRays.uniforms.uVisible.value = vis;
      this.godRays.enabled = vis > 0.002;
    }
    if (rayTint) this.godRays.uniforms.uTint.value.copy(rayTint);
    if (motionBlur !== undefined) this.grade.uniforms.uBlend.value = motionBlur;
    if (aberration !== undefined) this.grade.uniforms.uAberration.value = aberration;
  }

  _updateWaves(dt) {
    if (this.waves.length === 0) {
      if (this.shockwave.enabled) {
        this.shockwave.uniforms.uCount.value = 0;
        this.shockwave.enabled = false;
      }
      return;
    }

    this.camera.matrixWorld.extractBasis(this._right, this._up, this._fwd);
    const uWaves = this.shockwave.uniforms.uWaves.value;
    const uMod = this.shockwave.uniforms.uWaveMod.value;
    let n = 0;

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      w.radius += w.speed * dt;
      if (w.age >= w.life) { this.waves.splice(i, 1); continue; }

      const fade = 1 - w.age / w.life;

      // Project the centre, then project a point one radius to the camera's
      // right to convert a world radius into aspect-corrected uv units.
      this._proj.copy(w.center).project(this.camera);
      const cx = this._proj.x * 0.5 + 0.5;
      const cy = this._proj.y * 0.5 + 0.5;

      const edge = w.center.clone().addScaledVector(this._right, w.radius).project(this.camera);
      const du = (edge.x - this._proj.x) * 0.5 * this._aspect;
      const dv = (edge.y - this._proj.y) * 0.5;
      const rUv = Math.hypot(du, dv);

      const thickEdge = w.center.clone()
        .addScaledVector(this._right, w.radius + w.thickness).project(this.camera);
      const tUv = Math.max(
        Math.abs((thickEdge.x - edge.x) * 0.5 * this._aspect), 0.004,
      );

      if (n < MAX_WAVES) {
        uWaves[n].set(cx, cy, rUv, w.amp * fade * fade);
        uMod[n].set(tUv, w.chroma * fade, w.heat * fade, 0);
        n++;
      }
    }

    this.shockwave.uniforms.uCount.value = n;
    this.shockwave.enabled = n > 0;
  }

  render(dt, realDt) {
    this._time += realDt;
    this.shockwave.uniforms.uTime.value = this._time;
    this.grade.uniforms.uTime.value = this._time;
    this._updateWaves(dt);

    // ---- pass 1: isolated bloom layer ----
    const mask = this.camera.layers.mask;
    this.camera.layers.set(BLOOM_LAYER);
    const prevBg = this.scene.background;
    const prevFog = this.scene.fog;
    this.scene.background = null;
    this.scene.fog = null;
    this.bloomComposer.render(realDt);
    this.scene.background = prevBg;
    this.scene.fog = prevFog;
    this.camera.layers.mask = mask;

    // ---- pass 2: the main chain ----
    this.composer.render(realDt);
  }

  dispose() {
    this.grade.dispose();
    this.composer.dispose();
    this.bloomComposer.dispose();
  }
}
