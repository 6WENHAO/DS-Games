// Renderer, camera, HDR post-processing stack, quality tiers, frame stats.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { clamp, smoothstep } from './utils.js';

export const QUALITY = {
  low:  { pixelRatio: 0.75, shadowMap: 1024, shadowExtent: 46,  texSize: 128, farSegs: 110, terrainDetail: 0.6, bloom: 0.34, grassDensity: 0.35, godrays: 0,  reflections: false, msaa: 0, maxLights: 4,  ao: false },
  med:  { pixelRatio: 1.0,  shadowMap: 2048, shadowExtent: 56,  texSize: 256, farSegs: 160, terrainDetail: 1.0, bloom: 0.38, grassDensity: 0.7,  godrays: 12, reflections: true,  msaa: 4, maxLights: 8,  ao: true },
  high: { pixelRatio: 1.0,  shadowMap: 4096, shadowExtent: 64, texSize: 512, farSegs: 210, terrainDetail: 1.0, bloom: 0.40, grassDensity: 1.0, godrays: 20, reflections: true,  msaa: 4, maxLights: 12, ao: true },
};

const MasterShader = {
  uniforms: {
    tDiffuse: { value: null }, uSunScreen: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVis: { value: 0 }, uSunColor: { value: new THREE.Color(1, 0.9, 0.75) },
    uExposure: { value: 0.92 }, uTime: { value: 0 }, uVignette: { value: 0.34 },
    uCA: { value: 0.32 }, uGrain: { value: 0.018 }, uSat: { value: 1.02 }, uContrast: { value: 1.06 },
    uLift: { value: new THREE.Vector3(0.008, 0.010, 0.018) },
    uGain: { value: new THREE.Vector3(1.03, 1.0, 0.97) },
    uHit: { value: 0 }, uHitColor: { value: new THREE.Color(1, 0.2, 0.2) },
    uRadial: { value: 0 }, uElement: { value: new THREE.Vector3(0, 0, 0) },
    uFade: { value: 0 }, uFadeColor: { value: new THREE.Color(0, 0, 0) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen; uniform float uSunVis, uExposure, uTime, uVignette, uCA, uGrain, uSat, uHit, uRadial, uFade, uContrast;
    uniform vec3 uSunColor, uLift, uGain, uElement, uHitColor, uFadeColor;

    vec3 ACESFilm(vec3 x){
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      // radial blur / speed lines during dashes and bursts
      vec3 col = vec3(0.0);
      if (uRadial > 0.001) {
        vec2 dir = uv - vec2(0.5);
        float w = 0.0;
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 7.0;
          float s = 1.0 - t * 0.085 * uRadial;
          vec2 p = vec2(0.5) + dir * s;
          float wi = 1.0 - t * 0.5;
          col += texture2D(tDiffuse, p).rgb * wi; w += wi;
        }
        col /= w;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      // chromatic aberration grows toward the edges
      float r2 = dot(uv - 0.5, uv - 0.5);
      if (uCA > 0.001) {
        vec2 off = (uv - 0.5) * r2 * uCA * 0.020;
        col.r = texture2D(tDiffuse, uv + off).r;
        col.b = texture2D(tDiffuse, uv - off).b;
      }
      // volumetric god rays: march toward the sun in screen space
      #if GODRAY_SAMPLES > 0
      if (uSunVis > 0.001) {
        vec2 delta = (uSunScreen - uv) / float(GODRAY_SAMPLES);
        vec2 p = uv; float dec = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < GODRAY_SAMPLES; i++) {
          p += delta;
          vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb;
          float lum = dot(s, vec3(0.299, 0.587, 0.114));
          acc += s * smoothstep(0.72, 1.5, lum) * dec;
          dec *= 0.955;
        }
        acc /= float(GODRAY_SAMPLES);
        float edge = smoothstep(1.15, 0.15, length(uSunScreen - vec2(0.5)));
        col += acc * uSunColor * uSunVis * 2.35 * edge;
      }
      #endif

      col *= uExposure;
      col = ACESFilm(col);

      // grade: lift / gain / saturation
      col = col * uGain + uLift;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      // filmic S-curve: restores the midtone separation the tonemapper flattens
      col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.04);
      // elemental screen tint (pyro/cryo/electro reactions)
      col += uElement * 0.5;
      // damage vignette
      col = mix(col, uHitColor, uHit * smoothstep(0.10, 0.85, r2) * 0.85);
      // vignette + grain
      col *= 1.0 - uVignette * smoothstep(0.16, 0.86, r2);
      col += (hash(uv * 1024.0 + fract(uTime) * 91.7) - 0.5) * uGrain;
      col = mix(col, uFadeColor, clamp(uFade, 0.0, 1.0));
      // linear -> sRGB
      col = max(col, vec3(0.0));
      vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0/2.4)) - 0.055, step(0.0031308, col));
      gl_FragColor = vec4(srgb, 1.0);
    }`,
};

export class Engine {
  constructor(canvas, tier = 'med') {
    this.tier = tier;
    this.quality = { ...QUALITY[tier] };
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance',
      stencil: false, alpha: false, logarithmicDepthBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;    // handled in the master pass
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 8000);
    this.camera.position.set(0, 30, 20);

    const size = this._size();
    const rtOpts = { type: THREE.HalfFloatType, samples: this.quality.msaa, depthBuffer: true, stencilBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(size.w, size.h, rtOpts);
    this.composer = new EffectComposer(this.renderer, this.rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // Ambient occlusion grounds objects into the terrain. Optional: a failure here must
    // never break the renderer, so it is loaded lazily and guarded.
    this.ao = null;
    if (this.quality.ao) this._initAO(size);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), this.quality.bloom, 0.58, 1.05);
    this.composer.addPass(this.bloom);

    const shader = { ...MasterShader, defines: { GODRAY_SAMPLES: this.quality.godrays | 0 } };
    this.master = new ShaderPass(shader);
    this.master.renderToScreen = true;
    this.composer.addPass(this.master);
    this.fx = this.master.uniforms;

    this._sunNdc = new THREE.Vector3();
    this._clock = new THREE.Clock();
    this.frame = 0; this.fps = 60; this._fpsAcc = 0; this._fpsN = 0;
    this.stats = { drawCalls: 0, tris: 0, programs: 0 };

    addEventListener('resize', () => this.resize());
  }

  async _initAO(size) {
    try {
      const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
      const ao = new GTAOPass(this.scene, this.camera, size.w, size.h);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 1.25;
      ao.updateGtaoMaterial({
        radius: 0.85, distanceExponent: 1.7, thickness: 0.9, scale: 1.15,
        samples: this.tier === 'high' ? 16 : 11, distanceFallOff: 1.0, screenSpaceRadius: false,
      });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 8 });
      // insert directly after the scene render, before bloom
      this.composer.insertPass(ao, 1);
      this.ao = ao;
      console.log('[engine] GTAO enabled');
    } catch (e) { console.warn('[engine] GTAO unavailable:', e.message); }
  }

  _size() {
    const pr = this.renderer.getPixelRatio();
    return { w: Math.max(2, Math.floor(innerWidth * pr)), h: Math.max(2, Math.floor(innerHeight * pr)) };
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    const s = this._size();
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.setSize(s.w, s.h);
    this.ao?.setSize?.(s.w, s.h);
  }

  /** Project the sun into screen space and estimate how visible it is (for god rays). */
  updateSun(sunDir, occluded = 0) {
    const cam = this.camera;
    const worldSun = sunDir.clone().multiplyScalar(2000).add(cam.position);
    this._sunNdc.copy(worldSun).project(cam);
    const behind = this._sunNdc.z > 1 || sunDir.dot(cam.getWorldDirection(new THREE.Vector3())) < 0.02;
    this.fx.uSunScreen.value.set(this._sunNdc.x * 0.5 + 0.5, this._sunNdc.y * 0.5 + 0.5);
    const facing = smoothstep(0.0, 0.45, sunDir.dot(cam.getWorldDirection(new THREE.Vector3())));
    const elev = smoothstep(-0.05, 0.25, sunDir.y);
    this.fx.uSunVis.value = behind ? 0 : facing * elev * (1 - occluded) * 0.9;
  }

  render() {
    this.renderer.info.reset();
    this.composer.render();
    this.stats.drawCalls = this.renderer.info.render.calls;
    this.stats.tris = this.renderer.info.render.triangles;
    this.stats.programs = this.renderer.info.programs?.length ?? 0;
  }

  tick() {
    const dt = Math.min(0.05, this._clock.getDelta());
    this.frame++;
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc > 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
    this.fx.uTime.value += dt;
    return dt;
  }
}
