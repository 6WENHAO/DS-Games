/**
 * 后期处理：泛光(Bloom) + 曲速径向拉丝 + 色散 + 暗角 + 颗粒 + 受损红闪。
 * 顺序：Render → Bloom → FinalFX → Output(色调映射/色彩空间)
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const FinalFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uWarp: { value: 0 },
    uAberration: { value: 0.6 },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.03 },
    uDamage: { value: 0 },
    uGravity: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uWarp, uAberration, uVignette, uGrain, uDamage, uGravity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(41.7, 289.3))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r = length(c);

      // 引力场：轻微桶形拉扯，强化“靠近黑洞”的压迫感
      if (uGravity > 0.001){
        uv += c * (r * r) * uGravity * 0.22;
        c = uv - 0.5;
      }

      // 色散（越靠边越明显）
      float ab = uAberration * (0.0016 + uWarp * 0.006) * (0.35 + r);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;

      // 曲速径向拉丝
      if (uWarp > 0.001){
        vec3 streak = vec3(0.0);
        float wsum = 0.0;
        for (int i = 1; i <= 7; i++){
          float f = float(i) / 7.0;
          float k = f * uWarp * 0.30;
          float w = 1.0 - f;
          streak += texture2D(tDiffuse, uv - c * k).rgb * w;
          wsum += w;
        }
        streak /= max(wsum, 0.0001);
        col = mix(col, col * 0.45 + streak * 1.15, clamp(uWarp * (0.35 + r * 0.9), 0.0, 0.92));
      }

      // 受损红闪
      col = mix(col, vec3(0.55, 0.06, 0.05), uDamage * 0.5);

      // 暗角
      float vig = smoothstep(0.98, 0.22, r * uVignette);
      col *= mix(1.0, vig, 0.85);

      // 颗粒
      float g = hash(uv * uResolution + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, { quality = 'high' } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
      Math.max(2, size.x), Math.max(2, size.y),
      {
        type: THREE.HalfFloatType,
        samples: quality === 'high' ? 4 : 0,
        colorSpace: THREE.LinearSRGBColorSpace,
      },
    ));

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      quality === 'low' ? 0.5 : 0.62,    // strength
      0.72,                              // radius
      quality === 'low' ? 1.05 : 0.98,   // threshold（只让真正的 HDR 高光泛光）
    );
    this.composer.addPass(this.bloom);

    this.finalPass = new ShaderPass(FinalFXShader);
    this.composer.addPass(this.finalPass);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.setSize(size.x, size.y);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.finalPass.uniforms.uResolution.value.set(w, h);
  }

  setQuality(quality) {
    this.quality = quality;
    this.bloom.strength = quality === 'low' ? 0.5 : quality === 'medium' ? 0.56 : 0.64;
    this.bloom.threshold = quality === 'low' ? 1.05 : 0.98;
    this.finalPass.uniforms.uGrain.value = quality === 'low' ? 0.016 : 0.03;
  }

  render(dt, state = {}) {
    const u = this.finalPass.uniforms;
    u.uTime.value += dt;
    u.uWarp.value = state.warp ?? 0;
    u.uDamage.value = state.damage ?? 0;
    u.uGravity.value = state.gravity ?? 0;
    this.composer.render(dt);
  }
}
