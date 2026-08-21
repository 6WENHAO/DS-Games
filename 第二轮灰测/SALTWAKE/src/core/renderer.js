/**
 * SALTWAKE — renderer and the retro composite.
 *
 * The scene renders into a fixed-height low-resolution target (200 px by
 * default, widened to the viewport aspect) and is point-sampled up to the
 * canvas. One composite pass then does, in this order:
 *
 *   tone map -> three-point grade -> sRGB -> palette quantise with ordered
 *   dither -> scanlines -> interlace dropout -> film grain -> vignette
 *
 * The order matters. Grading before quantisation means the limited palette is
 * chosen from graded colours, which is what gives the image its cohesive sickly
 * cast instead of looking like a filter dropped on top. Quantising before
 * scanlines and grain keeps those two effects from being flattened away.
 *
 * Deliberately absent: bloom, depth of field, chromatic aberration, motion blur
 * and any large-radius blur. Enemies, projectiles, doors and pickups have to
 * stay readable at 200 px.
 */
import * as THREE from 'three';
import { RENDER, GRADE } from './config.js';
import { SW_MATH, SW_GRADE_FRAG } from '../gfx/chunks.js';

const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = [SW_MATH, SW_GRADE_FRAG, /* glsl */ `
uniform sampler2D uScene;
uniform vec2  uSize;          // internal buffer size in pixels
uniform float uExposure;
uniform float uPaletteSteps;
uniform float uDither;
uniform float uScanlines;
uniform float uScanCount;
uniform float uGrain;
uniform float uInterlace;
uniform float uVignette;
uniform float uTime;
uniform float uFrame;
uniform float uDamage;        // red wash on taking a hit
uniform float uDistortion;    // sanity: horizontal tear and hue slip
uniform float uFade;          // 0 = black, used for transitions
varying vec2 vUv;

void main(){
  vec2 uvp = vUv;

  // Sanity tear: whole scanlines slide sideways, the way a failing signal does.
  if (uDistortion > 0.001){
    float row = floor(uvp.y * uSize.y);
    float band = step(0.986 - uDistortion * 0.05, swHash11(row + floor(uTime * 7.0)));
    float slip = (swHash11(row * 1.7 + floor(uTime * 11.0)) - 0.5) * uDistortion * 0.06;
    uvp.x += band * slip;
    uvp.x += sin(uvp.y * 42.0 + uTime * 2.2) * uDistortion * 0.0018;
  }

  // Point sample on the low-res lattice: no bilinear smear between texels.
  vec2 texel = 1.0 / uSize;
  vec2 snapped = (floor(uvp * uSize) + 0.5) * texel;
  vec3 col = texture2D(uScene, clamp(snapped, texel * 0.5, 1.0 - texel * 0.5)).rgb;

  col = swToneMap(col * uExposure);
  col = swGrade(col);
  col = swLinearToSrgb(col);

  // Damage wash, applied before quantisation so it lands on the palette too.
  col = mix(col, vec3(0.62, 0.06, 0.03), clamp(uDamage, 0.0, 1.0) * 0.55);

  // Limited palette with ordered dither on the pixel lattice.
  vec2 ditherCoord = floor(uvp * uSize);
  float d = (SW_BAYER8(ditherCoord) - 0.5) * uDither / max(uPaletteSteps, 1.0);
  col = floor(col * uPaletteSteps + d + 0.5) / uPaletteSteps;

  // Scanlines. Every other line is darkened; the strength is modest so the
  // image survives at small window sizes.
  float scan = sin(uvp.y * uScanCount * SW_PI);
  col *= 1.0 - uScanlines * (0.5 + 0.5 * scan) * 0.5;

  // Interlace dropout: alternate frames drop alternate line pairs slightly.
  float lineParity = mod(floor(uvp.y * uSize.y) + uFrame, 2.0);
  col *= 1.0 - uInterlace * lineParity;

  // Film grain, quantised so it reads as pixels rather than video noise.
  float g = swHash21(ditherCoord + vec2(uFrame * 7.13, uFrame * 3.71));
  col += (floor(g * 4.0) / 3.0 - 0.5) * uGrain;

  vec2 v = uvp - 0.5;
  float vig = 1.0 - uVignette * dot(v, v) * 2.4;
  col *= clamp(vig, 0.0, 1.0);

  col *= uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`].join('\n');

const c = (hex) => new THREE.Color(hex);

export class Stage {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false;

    this.quality = RENDER.quality;
    this.frame = 0;

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        uScene: { value: this.target.texture },
        uSize: { value: new THREE.Vector2(2, 2) },
        uExposure: { value: RENDER.exposure },
        uPaletteSteps: { value: RENDER.paletteSteps },
        uDither: { value: RENDER.ditherStrength },
        uScanlines: { value: RENDER.scanlines },
        uScanCount: { value: RENDER.scanlineCount },
        uGrain: { value: RENDER.grain },
        uInterlace: { value: RENDER.interlace },
        uVignette: { value: RENDER.vignette },
        uTime: { value: 0 },
        uFrame: { value: 0 },
        uDamage: { value: 0 },
        uDistortion: { value: 0 },
        uFade: { value: 1 },
        uGradeShadow: { value: c(GRADE.shadowTint) },
        uGradeMid: { value: c(GRADE.midTint) },
        uGradeHigh: { value: c(GRADE.highTint) },
        uGradeTint: { value: GRADE.tintStrength },
        uGradeLift: { value: GRADE.lift },
        uGradeGamma: { value: GRADE.gamma },
        uGradeGain: { value: GRADE.gain },
        uSaturation: { value: GRADE.saturation },
        uContrast: { value: GRADE.contrast },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compositeScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.compositeScene.add(quad);
    this.compositeCamera = new THREE.Camera();

    this.size = new THREE.Vector2(1, 1);
    this.sceneStats = { calls: 0, triangles: 0 };
    this.resize();
  }

  get aspect() {
    return this.size.x / Math.max(1, this.size.y);
  }

  /** Internal buffer size, which shaders need for vertex snapping. */
  get bufferSize() {
    return new THREE.Vector2(this.target.width, this.target.height);
  }

  setQuality(name) {
    if (!RENDER.heights[name]) return;
    this.quality = name;
    this.resize();
  }

  resize() {
    const w = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(200, this.canvas.clientHeight || window.innerHeight);
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);

    // Fixed internal height, width from aspect: the pixels stay square and the
    // field of view widens on wide monitors instead of stretching.
    const bufH = RENDER.heights[this.quality] || RENDER.heights.classic;
    const bufW = Math.max(2, Math.round(bufH * (w / h)));
    if (this.target.width !== bufW || this.target.height !== bufH) {
      this.target.setSize(bufW, bufH);
    }
    this.material.uniforms.uSize.value.set(bufW, bufH);
    this.material.uniforms.uScanCount.value = bufH;
    return { width: bufW, height: bufH };
  }

  setDamage(v) { this.material.uniforms.uDamage.value = v; }
  setDistortion(v) { this.material.uniforms.uDistortion.value = v; }
  setFade(v) { this.material.uniforms.uFade.value = v; }

  /**
   * A frame is drawn in three explicit stages so the viewmodel can be layered
   * into the same low-resolution target before the composite runs:
   *
   *   beginFrame(time) -> renderInto(world) -> renderInto(viewmodel, clearDepth)
   *   -> present()
   */
  beginFrame(time) {
    this.frame += 1;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFrame.value = this.frame % 2048;
    const info = this.renderer.info;
    info.reset();
    this.renderer.autoClear = true;
    this.renderer.setRenderTarget(this.target);
  }

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {boolean} [clearDepthFirst] for overlays that must sit on top
   */
  renderInto(scene, camera, clearDepthFirst = false) {
    if (clearDepthFirst) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
    }
    this.renderer.render(scene, camera);
    const info = this.renderer.info;
    this.sceneStats.calls = info.render.calls;
    this.sceneStats.triangles = info.render.triangles;
  }

  /** Unbinds the target and runs the composite chain to the canvas. */
  present() {
    this.renderer.autoClear = true;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compositeScene, this.compositeCamera);
  }

  /** Convenience for a single-scene frame. */
  render(scene, camera, time) {
    this.beginFrame(time);
    this.renderInto(scene, camera);
    this.present();
  }

  stats() {
    return {
      calls: this.sceneStats.calls,
      triangles: this.sceneStats.triangles,
      width: this.target.width,
      height: this.target.height,
    };
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
