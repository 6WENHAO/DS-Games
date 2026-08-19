/**
 * Ocean.js — 高质量海面。
 *
 * 高度场由三部分叠加，且**前三项 CPU 与 GPU 严格同式**，所以船只浮力、涟漪、涡流
 * 与看到的水面完全一致：
 *   1) GerstnerSwell   解析涌浪（长波，主导船体运动）        CPU ✓ GPU ✓
 *   2) RippleSim       CPU 波动方程（龙卷风压强坑辐射的尾迹） CPU ✓ GPU ✓
 *   3) 涡旋形变        中心抬升水柱 + 环形凹陷 + 表面旋转流   CPU ✓ GPU ✓
 *   4) OceanFFT        Phillips 频谱短波细节（纯视觉，法线/泡沫/尖浪）  GPU only
 *
 * 着色：Schlick 菲涅尔 + 与天空穹顶同一套解析大气的反射 + GGX 阳光镜面 +
 *       浪尖次表面透光 + 深浅水吸收 + 雅可比折叠泡沫 + 共享高度雾。
 */
import * as THREE from 'three';
import { makeRadialGrid } from '../world/RadialGrid.js';
import { GerstnerSwell, GLSL_GERSTNER } from './Gerstner.js';
import { OceanFFT } from './OceanFFT.js';
import { RippleSim } from './RippleSim.js';
import { P } from '../core/Params.js';
import { clamp } from '../core/Random.js';
import { GLSL_HASH, GLSL_NOISE2, GLSL_MATH, GLSL_PHASE, GLSL_ATMOS, GLSL_AERIAL, GLSL_TONE } from '../core/GlslLib.js';

const SWELL_N = 10;

/* 涡旋形变：GPU 版本（与下面 CPU 版本必须一致） */
const GLSL_VORTEX = /* glsl */`
uniform vec3  uVortexPos;
uniform float uVortexR, uVortexPull, uVortexSpin;
/* 返回 (垂直位移, 水平旋转位移 xz) */
vec3 vortexDisp(vec2 w){
  if(uVortexPull < 0.001) return vec3(0.0);
  vec2 rel = w - uVortexPos.xz;
  float d = length(rel) + 1e-4;
  float R = max(uVortexR, 2.0);
  /* 中心水柱抬升（吸水）*/
  float colH = uVortexPull * R * 0.22 * exp(-pow(d/(R*0.95), 2.0));
  /* 环形凹陷（离心 + 卷吸）*/
  float dip = -uVortexPull * R * 0.075 * exp(-pow((d - R*1.85)/(R*1.6), 2.0));
  /* 表面切向牵引：水面被拖着转 */
  float vt = uVortexSpin * (d <= R ? d/R : pow(R/d, 0.72));
  vec2 tang = vec2(rel.y, -rel.x)/d * vt;
  return vec3(colH + dip, tang.x, tang.y);
}
/* 把细节纹理的采样坐标绕涡心随时间旋转：水面纹理看起来真的在转（纯视觉） */
vec2 vortexSwirlUV(vec2 w){
  if(uVortexPull < 0.001) return w;
  vec2 rel = w - uVortexPos.xz;
  float d = length(rel) + 1e-4;
  float R = max(uVortexR, 2.0);
  float vt = uVortexSpin * (d <= R ? d/R : pow(R/d, 0.72));
  float ang = -(vt/d) * uTime * 0.85;
  float c = cos(ang), s = sin(ang);
  return uVortexPos.xz + vec2(c*rel.x - s*rel.y, s*rel.x + c*rel.y);
}
`;

const WATER_VERT = /* glsl */`
attribute float aRadius;
attribute float aRing;
uniform vec2  uCenter;
uniform float uTime, uSea, uPatch, uDetail, uFFTAmp;
uniform sampler2D uDisp, uRipple;
uniform float uRippleExtent, uRippleK;
varying vec3  vWorld;
varying float vRadius;
varying float vFFTFade;
varying float vRipple;
${GLSL_GERSTNER}
${GLSL_VORTEX}

float rippleAt(vec2 w){
  vec2 uv = w/uRippleExtent + 0.5;
  if(uv.x < 0.002 || uv.y < 0.002 || uv.x > 0.998 || uv.y > 0.998) return 0.0;
  return texture2D(uRipple, uv).r * uRippleK;
}

void main(){
  vec2 w = position.xz + uCenter;
  float fade = 1.0 - smoothstep(700.0, 3600.0, aRadius);
  vFFTFade = fade;

  vec3 sw = swellDisplace(w, uTime);
  vec3 vx = vortexDisp(w);
  float rip = rippleAt(w);
  vRipple = rip;

  /* FFT 细节：两个尺度错开采样，压掉平铺感；采样坐标绕涡心旋转 */
  vec2 sw2 = vortexSwirlUV(w);
  vec3 d1 = texture2D(uDisp, sw2/uPatch).xyz;
  vec3 d2 = texture2D(uDisp, sw2/(uPatch*4.37) + vec2(0.37, 0.11)).xyz * 0.62;
  vec3 fft = (d1 + d2) * uFFTAmp * fade * uDetail;

  vec3 wp;
  wp.x = w.x + sw.x + fft.y + vx.y;
  wp.z = w.y + sw.z + fft.z + vx.z;
  wp.y = uSea + sw.y + fft.x + rip + vx.x;

  vWorld = wp;
  vRadius = aRadius;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const WATER_FRAG = /* glsl */`
uniform float uTime, uSea, uPatch, uDetail, uFFTAmp;
uniform sampler2D uNorm, uRipple;
uniform vec2  uCenter;
uniform float uRippleExtent, uRippleK;
uniform vec3  uDeep, uShallow, uFoamColor;
uniform float uFoamK, uSSS, uReflectK, uSparkle, uTransparency;
uniform float uSunIntensity, uFlash;
uniform vec3  uAmbient;
varying vec3  vWorld;
varying float vRadius;
varying float vFFTFade;
varying float vRipple;

${GLSL_HASH}
${GLSL_NOISE2}
${GLSL_MATH}
${GLSL_PHASE}
${GLSL_ATMOS}
${GLSL_AERIAL}
${GLSL_TONE}
${GLSL_GERSTNER}
${GLSL_VORTEX}

float rippleRaw(vec2 w){
  vec2 uv = w/uRippleExtent + 0.5;
  if(uv.x < 0.002 || uv.y < 0.002 || uv.x > 0.998 || uv.y > 0.998) return 0.0;
  return texture2D(uRipple, uv).r;
}
float rippleFoam(vec2 w){
  vec2 uv = w/uRippleExtent + 0.5;
  if(uv.x < 0.002 || uv.y < 0.002 || uv.x > 0.998 || uv.y > 0.998) return 0.0;
  return texture2D(uRipple, uv).g;
}

/* 法线混合（whiteout blend） */
vec3 blendN(vec3 a, vec3 b){ return normalize(vec3(a.x + b.x, a.y * b.y, a.z + b.z)); }

void main(){
  vec2 w = vWorld.xz;
  vec3 V = normalize(cameraPosition - vWorld);

  /* ---- 法线：解析涌浪 + FFT 细节 + 涟漪 ---- */
  vec3 nSwell; float jac;
  swellNormal(w, uTime, nSwell, jac);

  vec4 f1 = texture2D(uNorm, vortexSwirlUV(w)/uPatch);
  vec4 f2 = texture2D(uNorm, vortexSwirlUV(w)/(uPatch*4.37) + vec2(0.37, 0.11));
  float fade = vFFTFade;
  vec3 nF1 = normalize(vec3(f1.x, 1.0, f1.y));
  vec3 nF2 = normalize(vec3(f2.x*0.6, 1.0, f2.y*0.6));
  vec3 nFFT = blendN(nF1, nF2);
  nFFT = normalize(mix(vec3(0.0,1.0,0.0), nFFT, fade*uDetail));

  /* 涟漪法线：有限差分 */
  float e = uRippleExtent/256.0;
  float rl = rippleRaw(w - vec2(e,0.0)), rr = rippleRaw(w + vec2(e,0.0));
  float rd = rippleRaw(w - vec2(0.0,e)), ru = rippleRaw(w + vec2(0.0,e));
  vec3 nRip = normalize(vec3((rl-rr)*uRippleK, 2.0*e, (rd-ru)*uRippleK));

  vec3 N = blendN(blendN(nSwell, nFFT), nRip);
  /* 远处法线拉平，避免高频闪烁 */
  float distFlat = smoothstep(900.0, 5200.0, vRadius);
  N = normalize(mix(N, vec3(0.0,1.0,0.0), distFlat*0.85));

  vec3 sun = normalize(uSunDir);
  float NdV = max(dot(N, V), 1e-4);
  float NdL = dot(N, sun);

  /* ---- 反射：与天空穹顶完全同一套解析大气 ---- */
  vec3 R = reflect(-V, N);
  R.y = abs(R.y)*0.85 + 0.02;                       // 避免朝下采样到穹顶以下
  vec3 skyCol = atmosphere(normalize(R), sun);
  /* 龙卷风在水面的暗色倒影（解析近似：反射线是否掠过涡柱）*/
  {
    vec2 rel = uVortexPos.xz - vWorld.xz;
    float along = dot(rel, normalize(R.xz + 1e-5));
    if(along > 0.0 && uVortexPull > 0.001){
      vec2 closest = vWorld.xz + normalize(R.xz + 1e-5)*along;
      float dd = length(closest - uVortexPos.xz);
      float w2 = exp(-pow(dd/max(uVortexR*3.0, 30.0), 2.0));
      float upOk = smoothstep(0.0, 0.25, R.y);
      skyCol = mix(skyCol, skyCol*0.22 + vec3(0.03,0.032,0.036), w2*upOk*0.9);
    }
  }

  /* ---- 菲涅尔 ---- */
  float F0 = 0.020;
  float fres = F0 + (1.0 - F0)*pow(1.0 - NdV, 5.0);
  fres = mix(fres, 1.0, distFlat*0.35);

  /* ---- 水体颜色：深浅吸收 + 次表面透光 ---- */
  float steep = clamp((vWorld.y - uSea)*0.42 + 0.4, 0.0, 1.6);
  vec3 body = mix(uDeep, uShallow, clamp(steep*0.42, 0.0, 1.0)) * uTransparency;
  /* 风暴天海水几乎不透绿，主要是天空的灰 —— 让水体色向雾色靠一点，去掉塑料感 */
  body = mix(body, uFogColor*0.16, 0.28 + 0.34*uStormCover);
  /* 浪尖背光透射（阳光从波峰后面透过来） */
  float back = pow(clamp(dot(-V, sun)*0.5 + 0.5, 0.0, 1.0), 3.0);
  float crest = smoothstep(0.15, 1.2, (vWorld.y - uSea));
  vec3 sss = uShallow * uSunColor * (uSSS * back * crest * 1.5);
  body += sss;
  body += uAmbient * 0.10;

  /* ---- 阳光镜面（GGX，粗糙度随距离放大以抑制闪点） ---- */
  float rough = mix(0.055, 0.30, distFlat) + 0.02;
  vec3 H = normalize(sun + V);
  float NdH = max(dot(N, H), 0.0);
  float a2 = rough*rough;
  float dGGX = a2 / (3.14159265*pow(NdH*NdH*(a2-1.0)+1.0, 2.0) + 1e-6);
  float vis = 0.25/max(NdV*max(NdL,0.0)+1e-3, 0.02);
  vec3 spec = uSunColor * uSunIntensity * dGGX * vis * clamp(NdL,0.0,1.0) * 0.32;
  /* 高频闪烁（sparkle）：用 FFT 法线的细碎程度调制 */
  float sp = pow(clamp(dot(nFFT, H), 0.0, 1.0), 220.0) * (1.0-distFlat) * uSparkle;
  spec += uSunColor * sp * 2.4;

  /* ---- 泡沫：折叠 + 涟漪泡沫 + 涡旋喷溅 ---- */
  float foamFFT = clamp(f1.z*1.15 + f2.z*0.55, 0.0, 2.0);
  float foamRip = rippleFoam(w)*1.5;
  vec2 vrel = w - uVortexPos.xz;
  float vd = length(vrel);
  float foamVortex = uVortexPull > 0.001
    ? exp(-pow(vd/max(uVortexR*3.2, 25.0), 2.0)) * 1.35
      + exp(-pow((vd - uVortexR*2.2)/max(uVortexR*1.5, 18.0), 2.0)) * 0.8
    : 0.0;
  float texFoam = fbm2(w*0.09 + vec2(uTime*0.05), 3);
  /* 顺风向拉长的泡沫条纹（风暴海面的标志） */
  vec2 wdir = normalize(vec2(uSwellA[0].x, uSwellA[0].y) + 1e-4);
  float streak = fbm2(vec2(dot(w, vec2(-wdir.y, wdir.x))*0.11, dot(w, wdir)*0.012 - uTime*0.02), 3);
  float foam = clamp((foamFFT + foamRip + foamVortex) * uFoamK, 0.0, 1.6);
  foam *= 0.45 + 0.7*texFoam + 0.5*smoothstep(0.5, 0.85, streak);
  foam = clamp(foam, 0.0, 1.0) * (1.0 - distFlat*0.35);

  /* ---- 合成 ---- */
  vec3 col = mix(body, skyCol*uReflectK, clamp(fres, 0.0, 1.0));
  col += spec;
  vec3 foamCol = uFoamColor * (uAmbient*0.6 + uSunColor*uSunIntensity*0.32 + vec3(0.35,0.4,0.5)*uFlash);
  col = mix(col, foamCol, foam);
  col += vec3(0.5,0.56,0.72)*uFlash*0.16;

  col = applyAerial(col, cameraPosition, vWorld, sun, uSunColor);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export class Ocean {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {import('../core/Lighting.js').Lighting} o.lighting
   * @param {number} o.seaLevel
   */
  constructor({ renderer, lighting, seaLevel = 0, fftSize = 256, rMax = 16000 }) {
    this.renderer = renderer;
    this.lighting = lighting;
    this.seaLevel = seaLevel;
    this.time = 0;

    this.swell = new GerstnerSwell(SWELL_N);
    this.swell.configure(P.get('w_windSpeed'), P.get('w_windDir'), P.get('w_amp'), P.get('w_choppy'));
    this.fft = new OceanFFT(renderer, fftSize);
    this.ripple = new RippleSim({ res: 192, extent: 2600, speed: 21 });
    /* 让 FFT 法线/位移带 mipmap，远处水面不会闪成噪点 */
    for (const rt of [this.fft.dispRT, this.fft.normRT]) {
      rt.texture.generateMipmaps = true;
      rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      rt.texture.needsUpdate = true;
    }

    const L = lighting.uniforms;
    const swellU = this.swell.makeUniforms();
    this.uniforms = Object.assign({
      uCenter: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uSea: { value: seaLevel },
      uPatch: { value: this.fft.patch },
      uDetail: { value: 1 },
      uFFTAmp: { value: 1 },
      uDisp: { value: this.fft.dispTex },
      uNorm: { value: this.fft.normTex },
      uRipple: { value: this.ripple.tex },
      uRippleExtent: { value: this.ripple.extent },
      uRippleK: { value: 1 },
      uDeep: { value: new THREE.Color(0.0045, 0.0145, 0.0265) },
      uShallow: { value: new THREE.Color(0.026, 0.072, 0.079) },
      uFoamColor: { value: new THREE.Color(0.80, 0.845, 0.875) },
      uFoamK: { value: 1 },
      uSSS: { value: 1 },
      uReflectK: { value: 1 },
      uSparkle: { value: 1 },
      uTransparency: { value: 1 },
      uVortexPos: { value: new THREE.Vector3(0, 0, 0) },
      uVortexR: { value: 24 },
      uVortexPull: { value: 1 },
      uVortexSpin: { value: 6 },
      /* 共享光照（按引用） */
      uSunDir: L.uSunDir, uSunColor: L.uSunColor, uSunIntensity: L.uSunIntensity,
      uAmbient: L.uAmbient, uFlash: L.uFlash,
      uZenithColor: L.uZenithColor, uHorizonColor: L.uHorizonColor,
      uSkyLuminance: L.uSkyLuminance, uTurbidity: L.uTurbidity,
      uStormCover: L.uStormCover, uStormDark: L.uStormDark,
      uFogColor: L.uFogColor, uFogDensity: L.uFogDensity,
      uFogHeightFalloff: L.uFogHeightFalloff, uFogSunAmount: L.uFogSunAmount,
    }, swellU);

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      defines: { SWELL_COUNT: SWELL_N },
      side: THREE.FrontSide,
      fog: false,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });

    this.geometry = makeRadialGrid({ rings: 236, segs: 232, r0: 0.9, rMax });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    this.mesh.name = 'ocean';
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = -5;

    this._tmp = new THREE.Vector3();
  }

  /* ---------------- CPU 查询（与着色器同式） ---------------- */

  /** 涡旋形变的垂直分量（GPU: vortexDisp().x） */
  vortexHeight(x, z) {
    const pull = this.uniforms.uVortexPull.value;
    if (pull < 0.001) return 0;
    const p = this.uniforms.uVortexPos.value;
    const R = Math.max(this.uniforms.uVortexR.value, 2);
    const d = Math.hypot(x - p.x, z - p.z) + 1e-4;
    const colH = pull * R * 0.22 * Math.exp(-Math.pow(d / (R * 0.95), 2));
    const dip = -pull * R * 0.075 * Math.exp(-Math.pow((d - R * 1.85) / (R * 1.6), 2));
    return colH + dip;
  }

  /** 水面高度（浮力/相机/碎片都用它） */
  heightAt(x, z) {
    return this.seaLevel + this.swell.height(x, z, this.time)
      + this.ripple.sample(x, z) * this.uniforms.uRippleK.value
      + this.vortexHeight(x, z);
  }

  /** 水面流速（含波浪轨道速度 + 涡旋切向牵引） */
  velAt(x, z, out = this._tmp) {
    this.swell.velocity(x, z, this.time, out);
    const pull = this.uniforms.uVortexPull.value;
    if (pull > 0.001) {
      const p = this.uniforms.uVortexPos.value;
      const R = Math.max(this.uniforms.uVortexR.value, 2);
      const rx = x - p.x, rz = z - p.z;
      const d = Math.hypot(rx, rz) + 1e-4;
      const spin = this.uniforms.uVortexSpin.value;
      const vt = spin * (d <= R ? d / R : Math.pow(R / d, 0.72));
      out.x += (rz / d) * vt;
      out.z += (-rx / d) * vt;
    }
    return out;
  }

  /** 表面法线（CPU，粗略，用于船体贴合与相机） */
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 2.0;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  /* ---------------- 每帧 ---------------- */

  update(dt, camera, tornado) {
    this.time += dt;
    const u = this.uniforms;

    /* 参数变化时重建频谱与波列 */
    const ws = P.get('w_windSpeed'), wd = P.get('w_windDir');
    const amp = P.get('w_amp'), chop = P.get('w_choppy'), patch = P.get('w_patch');
    if (this.swell.configure(ws, wd, amp, chop)) {
      /* 数组 uniform 内容原地更新即可（引用没变） */
      u.uSwellCount.value = this.swell.count;
    }
    if (this._patch !== patch || this._ws !== ws || this._wd !== wd || this._amp !== amp) {
      this._patch = patch; this._ws = ws; this._wd = wd; this._amp = amp;
      this.fft.setSpectrum(ws, wd, patch, amp);
      u.uPatch.value = patch;
    }

    /* 涡旋耦合 */
    const pull = P.get('w_vortexPull') * (tornado ? clamp(tornado.strength, 0, 1.4) : 0);
    u.uVortexPos.value.copy(tornado ? tornado.position : new THREE.Vector3(0, -1e5, 0));
    u.uVortexR.value = tornado ? Math.max(tornado.rc, 3) : 3;
    u.uVortexPull.value = pull;
    u.uVortexSpin.value = tornado ? Math.min(tornado.vmax * 0.16, 26) : 0;
    u.uRippleK.value = P.get('w_ripple');
    u.uFoamK.value = P.get('w_foam');
    u.uSSS.value = P.get('w_sss');
    u.uReflectK.value = P.get('w_reflect');
    u.uTime.value = this.time;
    u.uCenter.value.set(camera.position.x, camera.position.z);
    u.uDisp.value = this.fft.dispTex;
    u.uNorm.value = this.fft.normTex;

    /* CPU 波动方程（真正的物理耦合） */
    this.ripple.step(dt, tornado, P.get('w_ripple'));

    /* GPU FFT */
    this.fft.update(this.time, chop, 0.62, 1.0);

    this.mesh.position.set(camera.position.x, 0, camera.position.z);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
  }

  /** 船体/碎片入水时打一发涟漪 */
  splash(x, z, radius, amp) { this.ripple.splash(x, z, radius, amp); }

  setFFTSize(n) {
    if (n === this.fft.size) return;
    const old = this.fft;
    this.fft = new OceanFFT(this.renderer, n);
    this.fft.setSpectrum(P.get('w_windSpeed'), P.get('w_windDir'), P.get('w_patch'), P.get('w_amp'));
    for (const rt of [this.fft.dispRT, this.fft.normRT]) {
      rt.texture.generateMipmaps = true;
      rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      rt.texture.needsUpdate = true;
    }
    this.uniforms.uDisp.value = this.fft.dispTex;
    this.uniforms.uNorm.value = this.fft.normTex;
    old.dispose();
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.fft.dispose();
    this.ripple.dispose();
  }
}
