/**
 * postfx.js — 电影级后处理管线
 * ==================================================================
 * 规格书 §1.3：CG 级电影渲染质量，无闪烁、无可见噪点。
 * 因此本管线的抗锯齿策略是「每帧内超采样」而非跨帧时间累积：
 *   · master 档使用 SSAARenderPass，单帧内渲染 2^level 次抖动采样并平均
 *     → 确定性、可逐帧捕获、绝不产生帧间闪烁
 *   · preview / review 档使用 MSAA + SMAA，保证交互流畅
 *
 * 链路：Render(SSAA) → Bokeh 景深 → UnrealBloom → OutputPass(ACES) → Grade
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BRAND } from './config.js';

/**
 * 最终调色 Pass：暗角 + 胶片颗粒 + 轻微色散 + 冷暖分离 + 轻微 halation。
 * 颗粒使用「帧号驱动的确定性哈希」而非 Math.random，
 * 保证同一帧号渲染结果完全一致 —— 母版逐帧捕获可重复。
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFrame: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.32 },
    uAberration: { value: 0.0012 },
    uLift: { value: new THREE.Vector3(0.004, 0.006, 0.012) },
    uGain: { value: new THREE.Vector3(1.015, 1.005, 0.985) },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.045 },
    uHalation: { value: 0.12 },
    uAspect: { value: 1.777 },
    uLetterbox: { value: 0.0 },      // 0 = 无遮幅；>0 = 上下黑边比例
    uFade: { value: 0.0 },           // 黑场过渡 0 = 正常, 1 = 全黑
    uFlashWhite: { value: 0.0 },     // 白闪（主脉冲击中瞬间）
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uFrame, uGrain, uVignette, uAberration, uSaturation, uContrast;
    uniform float uHalation, uAspect, uLetterbox, uFade, uFlashWhite;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;

    // 确定性哈希：仅依赖 (uv, 帧号)，同帧号必得同结果
    float hash13(vec3 p){
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // 横向色散（镜头色差），中心为零、边缘渐强
      vec2 dir = c * uAberration * (0.35 + r2 * 2.2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      // 非有限值兜底：上游任何 NaN/Inf 都不得污染成片（§1.3 无未渲染帧）
      if (!(col.r == col.r)) col.r = 0.0;
      if (!(col.g == col.g)) col.g = 0.0;
      if (!(col.b == col.b)) col.b = 0.0;
      col = clamp(col, vec3(0.0), vec3(64.0));

      // Halation：高光向外扩散的暖调溢出
      if (uHalation > 0.0) {
        vec3 s = vec3(0.0);
        float w = 0.0;
        for (int i = 0; i < 6; i++) {
          float a = float(i) * 1.0472;
          vec2 o = vec2(cos(a), sin(a)) * 0.0055;
          s += texture2D(tDiffuse, uv + o).rgb; w += 1.0;
        }
        s /= w;
        float lum = max(max(s.r, s.g), s.b);
        if (lum == lum) col += s * vec3(1.0, 0.72, 0.42) * uHalation * smoothstep(0.62, 1.0, lum);
      }

      // Lift / Gain / 对比 / 饱和
      col = col * uGain + uLift;
      col = (col - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);

      // 暗角
      float vig = 1.0 - uVignette * smoothstep(0.18, 0.92, r2 * 2.0);
      col *= vig;

      // 胶片颗粒（亮部弱、暗部略强，更接近真实负片）
      float g = hash13(vec3(uv * vec2(1920.0, 1080.0), uFrame)) - 0.5;
      col += g * uGrain * (1.25 - 0.7 * l);

      // 白闪 / 黑场
      col = mix(col, vec3(1.0), clamp(uFlashWhite, 0.0, 1.0));
      col = mix(col, vec3(0.0), clamp(uFade, 0.0, 1.0));

      // 遮幅（宽银幕）
      if (uLetterbox > 0.0) {
        float bar = step(uv.y, uLetterbox) + step(1.0 - uLetterbox, uv.y);
        col = mix(col, vec3(0.0), clamp(bar, 0.0, 1.0));
      }

      col = max(col, vec3(0.0));
      if (!(col.r == col.r)) col = vec3(0.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function buildPostFX(renderer, scene, camera, quality, size) {
  const { width, height } = size;

  // MSAA：给 composer 的渲染目标开多重采样（preview/review 档主力抗锯齿）
  const rt = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    samples: quality.taaLevel > 0 ? 0 : quality.msaaSamples,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(width, height);

  // ① 渲染 —— master 档用单帧内超采样，彻底消除锯齿与闪烁
  let renderPass;
  if (quality.taaLevel > 0) {
    renderPass = new SSAARenderPass(scene, camera);
    renderPass.sampleLevel = quality.taaLevel;   // 2^level 次抖动采样
    renderPass.unbiased = true;
  } else {
    renderPass = new RenderPass(scene, camera);
  }
  composer.addPass(renderPass);

  // ② 景深（浅景深是"电影感"的主要来源）
  let bokeh = null;
  if (quality.dof.enabled) {
    bokeh = new BokehPass(scene, camera, {
      focus: 60.0, aperture: quality.dof.aperture, maxblur: quality.dof.maxblur,
    });
    composer.addPass(bokeh);
  }

  // ③ 泛光 —— 等离子体与 EUV 光束的核心观感
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    quality.bloom.strength, quality.bloom.radius, quality.bloom.threshold);
  composer.addPass(bloom);

  // ④ 色调映射 + 色彩空间（ACES Filmic 由 renderer.toneMapping 指定）
  const output = new OutputPass();
  composer.addPass(output);

  // ⑤ 最终调色
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uGrain.value = quality.grain;
  grade.uniforms.uAspect.value = width / height;
  composer.addPass(grade);

  // ⑥ preview/review 档补一道 SMAA（master 档由 SSAA 覆盖，不需要）
  let smaa = null;
  if (quality.taaLevel === 0) {
    smaa = new SMAAPass(width, height);
    composer.addPass(smaa);
  }

  return {
    composer, renderPass, bokeh, bloom, grade, smaa,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      if (smaa) smaa.setSize(w, h);
      grade.uniforms.uAspect.value = w / h;
    },
    /** 每帧由 main.js 调用：帧号驱动颗粒，focus 由 camera.js 给出 */
    setFrame(frame) { grade.uniforms.uFrame.value = frame; },
    setFocus(distance) { if (bokeh) bokeh.uniforms.focus.value = distance; },
    setAperture(a) { if (bokeh) bokeh.uniforms.aperture.value = a; },
    setBloom({ strength, radius, threshold }) {
      if (strength !== undefined) bloom.strength = strength;
      if (radius !== undefined) bloom.radius = radius;
      if (threshold !== undefined) bloom.threshold = threshold;
    },
    setFade(v) { grade.uniforms.uFade.value = v; },
    setFlash(v) { grade.uniforms.uFlashWhite.value = v; },
    setLetterbox(v) { grade.uniforms.uLetterbox.value = v; },
    setGrade({ saturation, contrast, vignette, halation, aberration } = {}) {
      const u = grade.uniforms;
      if (saturation !== undefined) u.uSaturation.value = saturation;
      if (contrast !== undefined) u.uContrast.value = contrast;
      if (vignette !== undefined) u.uVignette.value = vignette;
      if (halation !== undefined) u.uHalation.value = halation;
      if (aberration !== undefined) u.uAberration.value = aberration;
    },
    dispose() { composer.dispose(); rt.dispose(); },
  };
}

/** 渲染器基础配置（ACES + 物理光照 + 阴影） */
export function configureRenderer(renderer, quality) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.80;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color(BRAND.colors.ink), 1);
  return renderer;
}
