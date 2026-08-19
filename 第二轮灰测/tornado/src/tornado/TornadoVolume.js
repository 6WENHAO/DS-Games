/**
 * TornadoVolume.js — 龙卷风体积着色器（本项目的核心）。
 *
 * 做法：场景渲染完成后，用一个全屏 pass 在世界空间对涡旋密度场做光线步进：
 *   · 密度场      = 漏斗壁（高斯环）× 垂直包络 × 湍流侵蚀 + 多涡旋 + 地面尘裙 + 云底盘
 *   · 旋转        = Rankine 涡旋角速度（核内刚体旋转、核外 1/r²），配合螺旋相位与上升气流平流噪声
 *   · 光照        = 朝阳光方向二次步进求透过率（自阴影）+ 双叶 HG 相函数 + 环境光 + 粉末效应 + 闪电
 *   · 遮挡        = 采样场景深度纹理逐像素截断，建筑/船/地形能正确遮挡涡柱（也支持涡柱遮住它们）
 *   · 半分辨率    = 体积在 1/2 分辨率步进，再用深度双边上采样合成，速度提升约 3~4 倍
 */
import * as THREE from 'three';
import { FullScreenPass } from '../core/Engine.js';
import { GLSL_HASH, GLSL_NOISE3, GLSL_MATH, GLSL_PHASE, GLSL_AERIAL, GLSL_TONE } from '../core/GlslLib.js';
import { P } from '../core/Params.js';

const VOLUME_FRAG = /* glsl */`
uniform sampler2D tDepth;
uniform vec2  uRes;            // 本 pass 的分辨率
uniform mat4  uInvViewProj;
uniform vec3  uCamPos, uCamFwd;
uniform float uNear, uFar, uTime, uFrame;

/* --- 涡旋形态 --- */
uniform vec3  uPos;            // 底部中心（世界坐标，y = 地面高度）
uniform float uHeight;         // 云底高度
uniform float uBaseR, uTopR, uProfile, uHollow, uWall;
uniform vec2  uTiltDir;        // 归一化倾斜方向
uniform float uTilt, uWobble, uWobSpeed;
uniform float uOmega;          // 核心角速度 rad/s（由 Vmax/rc 推出）
uniform float uDiff, uHelix, uUpdraft, uTurb, uTurbScale;
uniform float uMulti, uSubOrbit;
uniform float uDensity, uBright, uAmbientK, uScatterG, uCondense;
uniform float uDust, uDustHeight;
uniform vec3  uDustColor;
uniform float uSteps, uJitter, uPad;
uniform vec2  uBoundC; uniform float uBoundR;
uniform float uWaterMode;      // 1 = 海面模式（底部换成水雾环）

/* --- 共享光照 --- */
uniform vec3  uSunDir, uSunColor, uAmbient;
uniform float uSunIntensity, uFlash;
uniform vec3  uFlashDir;

${GLSL_HASH}
${GLSL_NOISE3}
${GLSL_MATH}
${GLSL_PHASE}
${GLSL_AERIAL}
${GLSL_TONE}

/* ---------- 涡柱骨架 ---------- */
/* 与 CPU 端 Tornado.spineOffset() 必须完全一致，物理与视觉才对得上 */
vec2 spineOffset(float t){
  vec2 o = uTiltDir * (uTilt * uHeight * t);
  float w = uWobble;
  o += vec2(sin(uTime*uWobSpeed*1.00 + t*3.4), cos(uTime*uWobSpeed*0.83 + t*2.7)) * (w * 26.0 * t*t);
  o += vec2(sin(uTime*uWobSpeed*0.41 + t*1.3), cos(uTime*uWobSpeed*0.37 - t*1.1)) * (w * 44.0 * t);
  return o;
}

float radiusAt(float t){
  /* 底部略微收颈 + 向上按 profile 幂律张开 */
  float neck = 1.0 - 0.22*exp(-t*26.0);
  float r = uBaseR*neck + (uTopR - uBaseR) * pow(clamp(t,0.0,1.0), uProfile);
  /* 缓慢的整体脉动，让形态"不断变化" */
  r *= 1.0 + 0.06*sin(uTime*0.37 + t*5.1) + 0.04*sin(uTime*0.19 - t*2.3);
  return max(r, 0.6);
}

/* Rankine 涡旋角速度：核内刚体、核外 ~1/r² */
float angVel(float r, float rc){
  float x = max(r, 0.05) / max(rc, 0.6);
  float w = (x < 1.0) ? 1.0 : 1.0/(x*x);
  return uOmega * mix(1.0, w, uDiff);
}

/* ---------- 密度场 ---------- */
float density(vec3 wp, float lod, out float heightT, out float wallness){
  vec3 lp = wp - uPos;
  heightT = 0.0; wallness = 0.0;
  float H = uHeight;
  float t = lp.y / H;
  if(t < -0.02 || t > 1.34) return 0.0;
  heightT = clamp(t, 0.0, 1.0);

  vec2 sp = spineOffset(clamp(t, 0.0, 1.0));
  vec2 rel = lp.xz - sp;
  float r = length(rel);
  float R = radiusAt(clamp(t, 0.0, 1.0));
  float wall = max(uWall * R, 1.1);

  /* 快速剔除：远离涡壁 + 远离尘裙 + 远离云底盘 */
  float skirtR = (uBaseR*1.7 + max(lp.y,0.0)*1.15);
  float plateR = uTopR*2.3;
  float maxR = max(R + wall*3.0, mix(skirtR*1.4, plateR, smoothstep(0.72, 1.06, t)));
  if(r > maxR) return 0.0;

  /* --- 旋转坐标（视觉上的涡旋切向拉丝） --- */
  float rc = R*0.92;
  float ang = angVel(r, rc)*uTime - lp.y*uHelix;
  vec2 rr = rot2(ang) * rel;
  /* 上升气流把噪声向上平流；越靠核心越快 */
  float upFlow = uUpdraft * (14.0 + 26.0*exp(-r/max(rc,1.0)));
  vec3 np = vec3(rr.x, lp.y*0.42 - uTime*upFlow, rr.y) * (0.011 * uTurbScale);

  int oct = lod > 0.5 ? 2 : 4;
  float n  = turb3(np, oct, 2.12, 0.55);
  float n2 = vnoise3(np*0.34 + vec3(11.0, -uTime*0.35, 4.0));

  /* --- 漏斗壁 --- */
  float x = (r - R) / wall;
  float shell  = exp(-x*x);                                  // 空心环
  float filled = smoothstep(R + wall*0.9, R - wall*0.7, r);   // 实心柱
  float radial = mix(filled, shell, uHollow);
  wallness = shell;

  /* 垂直包络：接地端收紧，云底端张开并融入云 */
  float bottom = smoothstep(-0.015, 0.045, t);
  float top    = 1.0 - smoothstep(0.94, 1.30, t)*0.72;
  float env = bottom * top * (0.72 + 0.5*n2);

  /* 湍流侵蚀：靠外侧撕碎成丝 */
  float erode = uTurb * (0.55 + 0.45*smoothstep(0.05, 0.55, abs(x)));
  float d = radial * env * clamp(1.0 - erode*(1.0 - n*1.35), 0.0, 1.6);
  /* 细丝卷须：更高频的一层噪声只作用在涡壁外侧，撕出丝状结构 */
  if(lod < 0.5){
    float fil = turb3(np*3.3 + vec3(2.0, -uTime*0.9, 5.0), 2, 2.4, 0.55);
    d *= mix(1.0, 0.55 + 0.95*fil, smoothstep(0.05, 0.85, abs(x)) * min(uTurb, 1.0));
  }

  /* --- 多涡旋 --- */
  if(uMulti > 0.5){
    float k = 0.0;
    for(int i=0;i<4;i++){
      if(float(i) >= uMulti) break;
      float ph = float(i)*6.2831853/max(uMulti,1.0) + uTime*uSubOrbit;
      vec2 c = vec2(cos(ph), sin(ph)) * R*0.62;
      float sr = length(rel - c) / max(R*0.26, 1.0);
      k = max(k, exp(-sr*sr) * (0.55 + 0.75*n));
    }
    d = max(d, k * env * smoothstep(1.12, 0.55, t));
  }

  /* --- 地面尘裙 / 碎片扇（海面则是水雾环） --- */
  if(lp.y < uDustHeight*3.2 && uDust > 0.001){
    float hy = max(lp.y, 0.0);
    float fall = exp(-hy/max(uDustHeight,4.0));
    float sr = r / max(skirtR, 1.0);
    /* 螺旋尘臂：随涡旋一起转 */
    float ringArm = 0.62 + 0.38*sin(atan(rel.y, rel.x)*3.0 - r*0.055 + uTime*(1.3 + uOmega*0.35));
    float dustN = 0.45 + 0.75*turb3(vec3(rr.x, hy*0.5, rr.y)*0.019 + vec3(0.0, -uTime*1.4, 0.0), oct, 2.0, 0.55);
    float skirt = uDust * fall * exp(-sr*sr*1.35) * ringArm * dustN;
    /* 海面：贴着水面的白色雾环更亮更薄 */
    skirt *= mix(1.0, 1.35*exp(-hy/max(uDustHeight*0.55,3.0)), uWaterMode);
    d += skirt;
  }

  /* --- 云底盘：把涡柱顶端和天空云层连起来（噪声要平滑，否则大跨度步进会出现条纹） --- */
  if(t > 0.68){
    float pl = smoothstep(0.68, 1.05, t) * (1.0 - smoothstep(1.05, 1.34, t));
    float pr = 1.0 - smoothstep(plateR*0.30, plateR, r);
    float pn = 0.80 + 0.42*fbm3(vec3(rr.x, lp.y*0.25, rr.y)*0.0085 + vec3(3.0, -uTime*0.5, 7.0), oct, 2.0, 0.55);
    d += pl * pr * pn * 1.25;
  }

  return max(d, 0.0) * uDensity;
}

float densityFast(vec3 wp){
  float a, b;
  return density(wp, 1.0, a, b);
}

void main(){
  vec2 uv = vUv;
  /* --- 世界空间射线 --- */
  vec4 nd = uInvViewProj * vec4(uv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(nd.xyz/nd.w - uCamPos);
  vec3 ro = uCamPos;

  /* --- 场景深度 → 该像素的最大步进距离 --- */
  float dv = texture(tDepth, uv).x;
  float sceneT = 1e9;
  if(dv < 0.999995){
    float viewZ = (uNear*uFar) / ((uFar-uNear)*dv - uFar);   // 负值
    sceneT = (-viewZ) / max(dot(rd, uCamFwd), 1e-3);
  }

  /* --- 包围体：圆柱 ∩ 水平板（相机可能在包围体内部，区间求交自然处理） --- */
  float y0 = uPos.y - 6.0;
  float y1 = uPos.y + uHeight*1.34;
  vec2 cyl = rayCylinder(ro, rd, uBoundC, uBoundR);
  vec2 slab = raySlab(ro, rd, y0, y1);
  float t0 = max(max(cyl.x, slab.x), 0.0);
  float t1 = min(min(cyl.y, slab.y), sceneT);
  if(t1 <= t0){ fragColor = vec4(0.0); return; }

  int steps = int(clamp(uSteps, 12.0, 200.0));
  float span = t1 - t0;
  /* 大跨度时限制单步长度，避免远景闪烁；同时保证近处足够细 */
  float dt = span / float(steps);
  float maxStep = max(uBoundR*0.09, 2.5);
  if(dt > maxStep){ dt = maxStep; steps = int(min(200.0, span/dt)); }

  float jitter = (ign(uv*uRes + vec2(uFrame*0.618, uFrame*0.382)) - 0.5) * uJitter;
  float t = t0 + dt*(0.5 + jitter);

  vec3  acc = vec3(0.0);
  float T = 1.0;
  float cosT = dot(rd, normalize(uSunDir));
  float phase = dualHG(cosT, uScatterG, -0.18, 0.72);
  float wsum = 0.0, tsum = 0.0;

  vec3 sunL = uSunColor * uSunIntensity;
  vec3 flashL = vec3(0.6, 0.68, 0.95) * uFlash * 1.6;

  for(int i=0;i<200;i++){
    if(i >= steps || T < 0.004 || t > t1) break;
    vec3 p = ro + rd*t;
    float ht, wn;
    float d = density(p, 0.0, ht, wn);
    if(d > 0.0025){
      /* --- 朝太阳自阴影 --- */
      float shadowAcc = 0.0;
      float ls = max(uBaseR*0.55, 9.0);
      for(int j=1;j<=4;j++){
        vec3 sp2 = p + uSunDir * (ls*float(j));
        shadowAcc += densityFast(sp2);
      }
      float sunT = exp(-shadowAcc * ls * 0.55);
      /* 粉末效应：表层亮、深处暗 */
      float powder = 1.0 - exp(-d*3.4);
      /* 颜色：底部尘土 → 顶部凝结白 */
      vec3 albedo = mix(uDustColor, vec3(0.86, 0.88, 0.93), smoothstep(0.06, 0.62, ht)*uCondense);
      albedo = mix(albedo, vec3(0.94,0.95,0.98), uWaterMode*0.35*(1.0-smoothstep(0.0,0.35,ht)));

      vec3 L = sunL * (sunT*phase*3.0 + 0.06) * mix(0.55, 1.0, powder);
      L += uAmbient * uAmbientK * (0.45 + 0.55*ht) * mix(0.35, 1.0, powder);
      L += flashL * (0.4 + 0.6*sunT);
      L *= albedo * uBright;

      float a = 1.0 - exp(-d*dt);
      acc += T * a * L;
      wsum += T * a; tsum += T * a * t;
      T *= (1.0 - a);
    }
    /* 空区域加速跳步 */
    t += (d < 0.0025) ? dt*1.85 : dt;
  }

  float alpha = 1.0 - T;
  if(alpha > 0.001){
    float tAvg = wsum > 1e-5 ? tsum/wsum : (t0+t1)*0.5;
    vec3 mid = ro + rd*tAvg;
    /* 与全场景共用的空气透视，让远处涡柱自然融进雾里 */
    acc = applyAerial(acc/max(alpha,1e-4), uCamPos, mid, normalize(uSunDir), uSunColor) * alpha;
  }
  fragColor = vec4(acc, alpha);
}
`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene, tVol, tDepth;
uniform vec2 uResFull, uResVol;
uniform float uNear, uFar, uHalf;
float linz(float d){
  if(d >= 0.999995) return uFar*4.0;
  return (uNear*uFar) / ((uFar-uNear)*d - uFar);
}
void main(){
  vec3 scene = texture(tScene, vUv).rgb;
  vec4 v;
  if(uHalf < 0.5){
    v = texture(tVol, vUv);
  } else {
    /* 深度双边上采样：抑制半分辨率体积在前景边缘的漏光 */
    float zc = linz(texture(tDepth, vUv).x);
    vec2 tv = 1.0/uResVol;
    vec2 base = (floor(vUv*uResVol - 0.5) + 0.5) * tv;
    vec2 f = fract(vUv*uResVol - 0.5);
    vec4 sum = vec4(0.0); float wsum = 0.0;
    for(int j=0;j<2;j++) for(int i=0;i<2;i++){
      vec2 uv2 = base + vec2(float(i), float(j))*tv;
      float zi = linz(texture(tDepth, uv2).x);
      float wb = (i==0 ? 1.0-f.x : f.x) * (j==0 ? 1.0-f.y : f.y);
      float wz = 1.0 / (1e-3 + abs(zi - zc)*0.08);
      float w = wb*wz + 1e-4;
      sum += texture(tVol, uv2) * w;
      wsum += w;
    }
    v = sum/max(wsum, 1e-4);
  }
  fragColor = vec4(scene*(1.0 - v.a) + v.rgb, 1.0);
}
`;

export class TornadoVolume {
  /** @param {import('../core/Lighting.js').Lighting} lighting */
  constructor(lighting) {
    const L = lighting.uniforms;
    this.pass = new FullScreenPass(VOLUME_FRAG, {
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uInvViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
      uNear: { value: 1 }, uFar: { value: 20000 },
      uTime: { value: 0 }, uFrame: { value: 0 },

      uPos: { value: new THREE.Vector3() },
      uHeight: { value: 780 },
      uBaseR: { value: 24 }, uTopR: { value: 170 }, uProfile: { value: 1.75 },
      uHollow: { value: 0.62 }, uWall: { value: 0.34 },
      uTiltDir: { value: new THREE.Vector2(1, 0) },
      uTilt: { value: 0.12 }, uWobble: { value: 0.42 }, uWobSpeed: { value: 0.45 },
      uOmega: { value: 3.5 }, uDiff: { value: 0.95 }, uHelix: { value: 0.004 },
      uUpdraft: { value: 0.75 }, uTurb: { value: 0.9 }, uTurbScale: { value: 1.0 },
      uMulti: { value: 0 }, uSubOrbit: { value: 1.2 },
      uDensity: { value: 1.25 }, uBright: { value: 1.0 }, uAmbientK: { value: 0.62 },
      uScatterG: { value: 0.44 }, uCondense: { value: 0.55 },
      uDust: { value: 1.1 }, uDustHeight: { value: 70 },
      uDustColor: { value: new THREE.Color(0.44, 0.36, 0.27) },
      uSteps: { value: 76 }, uJitter: { value: 1.0 }, uPad: { value: 0 },
      uBoundC: { value: new THREE.Vector2() }, uBoundR: { value: 400 },
      uWaterMode: { value: 0 },

      uSunDir: L.uSunDir, uSunColor: L.uSunColor, uAmbient: L.uAmbient,
      uSunIntensity: L.uSunIntensity, uFlash: L.uFlash, uFlashDir: L.uFlashDir,
      uFogColor: L.uFogColor, uFogDensity: L.uFogDensity,
      uFogHeightFalloff: L.uFogHeightFalloff, uFogSunAmount: L.uFogSunAmount,
    });

    this.composite = new FullScreenPass(COMPOSITE_FRAG, {
      tScene: { value: null }, tVol: { value: null }, tDepth: { value: null },
      uResFull: { value: new THREE.Vector2() }, uResVol: { value: new THREE.Vector2() },
      uNear: { value: 1 }, uFar: { value: 20000 }, uHalf: { value: 1 },
    });

    this._m = new THREE.Matrix4();
    this._fwd = new THREE.Vector3();
  }

  get uniforms() { return this.pass.uniforms; }

  /** 由 Engine.volumePass 调用 */
  render(renderer, camera, engine, sceneTex, depthTex, volRT, compRT) {
    const u = this.pass.uniforms;
    u.tDepth.value = depthTex;
    u.uRes.value.set(volRT.width, volRT.height);
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    u.uInvViewProj.value.copy(this._m);
    u.uCamPos.value.copy(camera.position);
    camera.getWorldDirection(this._fwd);
    u.uCamFwd.value.copy(this._fwd);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uTime.value = engine.time;
    u.uFrame.value = engine.frame % 64;
    u.uSteps.value = Math.max(14, Math.round(P.get('t_steps') * engine.perf.scale));

    this.pass.render(renderer, volRT);

    const c = this.composite.uniforms;
    c.tScene.value = sceneTex;
    c.tVol.value = volRT.texture;
    c.tDepth.value = depthTex;
    c.uResFull.value.set(compRT.width, compRT.height);
    c.uResVol.value.set(volRT.width, volRT.height);
    c.uNear.value = camera.near;
    c.uFar.value = camera.far;
    c.uHalf.value = volRT.width < compRT.width ? 1 : 0;
    this.composite.render(renderer, compRT);
  }

  dispose() { this.pass.dispose(); this.composite.dispose(); }
}
