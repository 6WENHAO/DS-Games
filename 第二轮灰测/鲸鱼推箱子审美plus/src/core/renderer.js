/**
 * Renderer + the pixel-art composite.
 *
 * The 3D frame is rendered into a half-float target whose height is fixed
 * (288 / 384 / 512 px depending on quality) and then point-sampled up to the
 * canvas. Everything downstream of that blit — exposure, ACES tone mapping,
 * saturation, palette quantisation with ordered dithering, vignette, sRGB
 * encode — happens in one pass, which is what gives every surface in the scene
 * the same limited-palette pixel finish.
 */
import * as THREE from 'three';
import { RENDER } from './config.js';
import { renderState } from './env.js';
import { GLSL_MATH } from '../gfx/shaderChunks.js';

const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = [GLSL_MATH, /* glsl */ `
uniform sampler2D uScene;
uniform vec2  uSceneSize;
uniform float uExposure;
uniform float uSaturation;
uniform float uPaletteSteps;
uniform float uDither;
uniform float uVignette;
uniform float uFade;
varying vec2 vUv;

vec3 dshACESFilmic(vec3 x){
  const mat3 ACESInput = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  const mat3 ACESOutput = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602
  );
  x = ACESInput * x;
  vec3 a = x * (x + 0.0245786) - 0.000090537;
  vec3 b = x * (0.983729 * x + 0.432951) + 0.238081;
  return clamp(ACESOutput * (a / b), 0.0, 1.0);
}

vec3 dshLinearToSRGB(vec3 c){
  c = max(c, vec3(0.0));
  vec3 lo = c * 12.92;
  vec3 hi = pow(c, vec3(0.41666667)) * 1.055 - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main(){
  // Point sample on the low-res grid: no bilinear smear between texels.
  vec2 texel = 1.0 / uSceneSize;
  vec2 snapped = (floor(vUv * uSceneSize) + 0.5) * texel;
  vec3 col = texture2D(uScene, snapped).rgb;

  col = dshACESFilmic(col * uExposure);

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);

  col = dshLinearToSRGB(col);

  // Posterise in display space, dithered on the low-res grid so gradients
  // break into pixel clusters instead of smooth bands.
  vec2 ditherCoord = floor(vUv * uSceneSize);
  float d = (DSH_BAYER8(ditherCoord) - 0.5) * uDither / max(uPaletteSteps, 1.0);
  col = floor(col * uPaletteSteps + d + 0.5) / uPaletteSteps;

  vec2 v = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(v, v) * 2.15;
  col *= clamp(vig, 0.0, 1.0);

  col *= uFade;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`].join('\n');

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = true;

    this.pixelArt = RENDER.pixelArt;
    this.quality = renderState.quality;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.NoColorSpace,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        uScene: { value: this.target.texture },
        uSceneSize: { value: new THREE.Vector2(2, 2) },
        uExposure: { value: RENDER.exposure },
        uSaturation: { value: RENDER.saturation },
        uPaletteSteps: { value: RENDER.paletteSteps },
        uDither: { value: RENDER.ditherStrength },
        uVignette: { value: RENDER.vignette },
        uFade: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.compositeScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
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

  setQuality(quality) {
    this.quality = quality;
    this.resize();
  }

  setPixelArt(enabled) {
    this.pixelArt = enabled;
    this.canvas.classList.toggle('is-smooth', !enabled);
    this.resize();
  }

  setFade(value) {
    this.compositeMaterial.uniforms.uFade.value = value;
  }

  resize() {
    const w = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(240, this.canvas.clientHeight || window.innerHeight);
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);

    let rtH;
    let rtW;
    if (this.pixelArt) {
      rtH = RENDER.pixelHeights[this.quality] || RENDER.pixelHeights.medium;
      rtW = Math.round(rtH * (w / h));
    } else {
      const ratio = this.maxPixelRatio;
      rtW = Math.round(w * ratio);
      rtH = Math.round(h * ratio);
    }
    rtW = Math.max(2, rtW);
    rtH = Math.max(2, rtH);
    if (this.target.width !== rtW || this.target.height !== rtH) {
      this.target.setSize(rtW, rtH);
    }
    this.compositeMaterial.uniforms.uSceneSize.value.set(rtW, rtH);
    this.compositeMaterial.uniforms.uDither.value = this.pixelArt ? RENDER.ditherStrength : RENDER.ditherStrength * 0.4;
    this.compositeMaterial.uniforms.uPaletteSteps.value = this.pixelArt ? RENDER.paletteSteps : 64.0;
    return { width: rtW, height: rtH };
  }

  render(scene, camera) {
    // The renderer resets its counters at the start of every render() call, so
    // the scene pass is measured before the composite pass overwrites them.
    const info = this.renderer.info;
    info.autoReset = false;
    info.reset();

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.sceneStats.calls = info.render.calls;
    this.sceneStats.triangles = info.render.triangles;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compositeScene, this.compositeCamera);
  }

  stats() {
    return {
      calls: this.sceneStats.calls,
      triangles: this.sceneStats.triangles,
      width: this.target.width,
      height: this.target.height,
    };
  }
}
