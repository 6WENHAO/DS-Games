/* =======================================================================
 *  shaders2.js  —  GLSL ES 3.00 着色器库（第二部分）
 *  星空 / 撞击伤痕绘制 / 表面冲击环 / 粒子 / 流星轨迹 / 轨道线 / 后处理
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const S = SS.SH;

  /* ------------------------------------------------------------------ *
   *  背景：星云 + 银河带（全屏）
   * ------------------------------------------------------------------ */
  S.bgVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPos;
uniform mat4 uInvViewProj;
out vec3 vRay;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
  vec4 far = uInvViewProj * vec4(aPos, 1.0, 1.0);
  vec4 near = uInvViewProj * vec4(aPos, -1.0, 1.0);
  vRay = normalize(far.xyz / far.w - near.xyz / near.w);
}
`;

  S.bgFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vRay;
layout(location = 0) out vec4 fragColor;
uniform float uGalaxy;
` + S.noise + `
void main(){
  vec3 d = normalize(vRay);
  // 银道面法线（相对黄道约 60°）
  vec3 gn = normalize(vec3(0.0, 0.4965, 0.8681));
  float lat = dot(d, gn);
  float band = exp(-lat * lat / 0.020);
  float clump = fbm(d * 3.4, 6, 0.58) * 0.5 + 0.5;
  float dust = fbm(d * 9.0 + 4.4, 5, 0.6) * 0.5 + 0.5;
  vec3 milky = mix(vec3(0.030, 0.036, 0.055), vec3(0.075, 0.068, 0.058), clump);
  // 真实银河面亮度约 22 mag/arcsec²，比受日照的行星表面暗 10⁶ 倍以上。
  // 这里只保留一层可辨认的微光；它同样受自动曝光影响，靠近太阳时会被自然压掉。
  const float SCALE = 0.06;
  vec3 col = milky * band * (0.55 + clump * 0.9) * (1.0 - dust * 0.55) * uGalaxy * SCALE;
  col += vec3(0.006, 0.008, 0.014) * (0.6 + 0.4 * clump) * uGalaxy * SCALE;
  fragColor = vec4(col, 1.0);
}
`;

  /* ------------------------------------------------------------------ *
   *  恒星点云
   * ------------------------------------------------------------------ */
  S.starVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aDir;
layout(location = 1) in float aMag;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aPhase;
uniform mat4 uViewProj;
uniform float uDist, uTime, uPixelScale;
out vec3 vCol;
out float vMag;
void main(){
  vec3 world = aDir * uDist;
  vec4 clip = uViewProj * vec4(world, 1.0);
  gl_Position = clip;
  float tw = 0.85 + 0.15 * sin(uTime * 2.4 + aPhase);
  vMag = aMag * tw;
  vCol = aColor;
  gl_PointSize = clamp(1.0 + aMag * 2.6, 1.0, 6.0) * uPixelScale;
}
`;

  S.starFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vCol;
in float vMag;
layout(location = 0) out vec4 fragColor;
uniform float uBright;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.4);
  vec3 col = vCol * vMag * uBright * (a + pow(a, 8.0) * 2.2);
  fragColor = vec4(col, 1.0);
}
`;

  /* ------------------------------------------------------------------ *
   *  撞击伤痕：把一个撞击坑加性绘制进等距柱状伤痕图
   *  R = 高度变化(m)  G = 反照率变化  B = 喷出物覆盖  A = 熔融玻璃
   * ------------------------------------------------------------------ */
  S.scarVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  S.scarFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform vec3 uCenter;        // 撞击点（体坐标单位向量）
uniform float uAngR;         // 最终坑角半径（弧度）
uniform float uDepth;        // 坑深（m）
uniform float uRim;          // 坑缘高（m）
uniform float uPeak;         // 中央峰高（m）
uniform float uEjectaRef;    // 喷出物厚度参考（m，坑缘处）
uniform float uRayReach;     // 射线纹伸展倍数
uniform float uAlbFloor;     // 坑底反照率变化
uniform float uAlbRay;       // 射线纹反照率变化
uniform float uMelt;         // 熔融强度 0..1
uniform float uType;         // 0 简单坑 1 复杂坑 2 盆地
uniform float uSeed;
uniform float uTerrace;
` + S.noise + `
void main(){
  vec3 d = fromEquirect(vUV);
  float ang = acos(clamp(dot(d, uCenter), -1.0, 1.0));
  float reach = uAngR * max(uRayReach, 1.5);
  if (ang > reach) { fragColor = vec4(0.0); return; }

  // 以撞击点为极点的局部方位角
  vec3 t = normalize(cross(abs(uCenter.y) < 0.98 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), uCenter));
  vec3 b = cross(uCenter, t);
  float az = atan(dot(d, b), dot(d, t));

  float r = ang / max(uAngR, 1e-8);
  float h = 0.0, alb = 0.0, dust = 0.0, melt = 0.0;

  // 方位向的随机调制：让坑不是完美圆形，喷出物呈射线纹
  float lumpy = fbm(vec3(cos(az) * 2.2, sin(az) * 2.2, uSeed), 4, 0.55);
  float rr = r * (1.0 + lumpy * 0.10);
  float rays = fbm(vec3(cos(az) * 7.0, sin(az) * 7.0, uSeed * 1.7), 5, 0.6) * 0.5 + 0.5;
  rays = pow(clamp(rays, 0.0, 1.0), 2.2);

  if (rr < 1.0){
    float bowl = 1.0 - rr * rr;
    if (uType < 0.5){
      h -= uDepth * pow(bowl, 0.85);
    } else {
      // 复杂坑：平底 + 阶地 + 中央峰
      float floorT = smoothstep(0.0, 0.55, 1.0 - rr);
      h -= uDepth * mix(pow(bowl, 1.6), 1.0, floorT * 0.85);
      float terr = sin(rr * 26.0) * 0.5 + 0.5;
      h += uDepth * 0.06 * terr * smoothstep(0.55, 1.0, rr) * uTerrace;
      h += uPeak * exp(-pow(rr / 0.17, 2.0));
      if (uType > 1.5){
        // 盆地：内环山
        h += uPeak * 0.55 * exp(-pow((rr - 0.45) / 0.09, 2.0));
      }
    }
    melt = uMelt * smoothstep(1.0, 0.25, rr);
    dust = 0.35 * smoothstep(1.0, 0.6, rr);
    alb += uAlbFloor * smoothstep(1.0, 0.4, rr);
  }

  // 坑缘隆起
  float rimProf = exp(-pow((rr - 1.0) / 0.20, 2.0));
  h += uRim * rimProf;
  alb += uAlbRay * 0.35 * rimProf;

  // 喷出物毯：厚度 ∝ r^-3（Melosh 1989），并叠加射线纹
  if (rr > 0.85){
    float th = uEjectaRef * pow(max(rr, 0.9), -3.0);
    float rayMask = mix(0.25, 1.0, rays) * smoothstep(reach / uAngR, 1.0, rr * 1.0);
    float blanket = smoothstep(reach / uAngR, 0.9, rr);
    h += th * blanket * (0.5 + rayMask * 0.9);
    dust += clamp(blanket * (0.35 + rays * 0.75), 0.0, 1.0);
    alb += uAlbRay * blanket * (0.25 + rays * 0.95);
    // 次级坑
    float sec = fbm(vec3(d * 260.0), 3, 0.5);
    h -= max(0.0, sec - 0.35) * uDepth * 0.05 * blanket;
  }

  fragColor = vec4(h, alb, dust, melt);
}
`;

  /* ------------------------------------------------------------------ *
   *  表面事件环：冲击波 / 海啸 / 尘暴（贴地薄壳，加性）
   * ------------------------------------------------------------------ */
  S.surfRingVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
uniform mat4 uViewProj;
uniform vec3 uOffset;
uniform mat3 uRot;
uniform float uRadius;
` + S.logdepthVS + `
out vec3 vLocal;
out vec3 vWorld;
void main(){
  vec3 p = normalize(aPos);
  vLocal = p;
  vWorld = uOffset + uRot * (p * uRadius);
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.surfRingFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;
uniform vec4 uRing[6];      // xyz = 中心方向, w = 角半径
uniform vec4 uRingP[6];     // x = 强度, y = 环宽, z = 类型(0冲击1海啸2尘暴), w = 内部填充
uniform int uRingCount;
uniform vec3 uSunPos;
uniform float uSunR;
` + S.noise + S.shadow + S.logdepthFS + `
void main(){
  vec3 p = normalize(vLocal);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= uRingCount) break;
    float ang = acos(clamp(dot(p, uRing[i].xyz), -1.0, 1.0));
    float R = uRing[i].w;
    float w = max(uRingP[i].y, 1e-5);
    float k = uRingP[i].x;
    float ty = uRingP[i].z;
    float d = ang - R;
    float ring = exp(-pow(d / w, 2.0));
    // 环上的不规则起伏
    vec3 t = normalize(cross(abs(uRing[i].y) < 0.98 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), uRing[i].xyz));
    vec3 b = cross(uRing[i].xyz, t);
    float az = atan(dot(p, b), dot(p, t));
    float wob = fbm(vec3(cos(az) * 4.0, sin(az) * 4.0, R * 8.0), 4, 0.55) * 0.5 + 0.5;
    ring *= 0.55 + wob * 0.9;
    vec3 c;
    if (ty < 0.5)      c = vec3(1.0, 0.72, 0.42);       // 冲击波：炽热
    else if (ty < 1.5) c = vec3(0.55, 0.82, 1.0);       // 海啸：泛白的蓝
    else               c = vec3(0.62, 0.50, 0.38);      // 尘暴
    // 环内侧的填充（R 极小时 smoothstep 会退化，必须显式保护）
    float inner = 0.0;
    if (R > 1.0e-4) inner = uRingP[i].w * (1.0 - smoothstep(R * 0.25, R, ang));
    col += c * (ring * k + inner * k * 0.35);
    alpha = max(alpha, clamp(ring * k * 1.2 + inner * k * 0.4, 0.0, 1.0));
  }
  if (alpha < 0.003) discard;
  fragColor = vec4(col, alpha);
  LOGDEPTH_FS()
}
`;

  /* ------------------------------------------------------------------ *
   *  粒子（喷出物 / 尘埃 / 碎屑环）
   * ------------------------------------------------------------------ */
  S.partVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;      // 相对相机（单位）
layout(location = 1) in vec4 aAttr;     // x=尺寸(单位) y=温度0..1 z=寿命比 w=类型
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uSizeScale;
` + S.logdepthVS + `
out vec4 vAttr;
out float vDist;
void main(){
  vec4 clip = uViewProj * vec4(aPos, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
  float dist = max(length(aPos), 1e-5);
  vDist = dist;
  // 世界尺寸 → 像素尺寸（透视投影）
  float px = (aAttr.x / dist) * uViewport.y * uSizeScale;
  gl_PointSize = clamp(px, 1.0, 64.0);
  vAttr = aAttr;
}
`;

  S.partFS = `#version 300 es
precision highp float;
precision highp int;
in vec4 vAttr;
in float vDist;
layout(location = 0) out vec4 fragColor;
uniform float uBright;
` + S.logdepthFS + `
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 2.6);
  float temp = vAttr.y;
  float life = vAttr.z;
  vec3 hot = vec3(1.0, 0.42 + 0.5 * temp, 0.10 + 0.35 * temp * temp);
  vec3 dustc = vec3(0.62, 0.55, 0.48);
  vec3 col = mix(dustc, hot * 2.4, clamp(temp, 0.0, 1.0));
  float fade = smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.55, life);
  col *= uBright * (0.35 + temp * 2.4) * fade;
  fragColor = vec4(col * a, a * fade);
  LOGDEPTH_FS()
}
`;

  /* ------------------------------------------------------------------ *
   *  流星本体 + 尾迹
   * ------------------------------------------------------------------ */
  S.trailVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aAttr;   // x = 沿轨迹 0..1, y = 亮度
uniform mat4 uViewProj;
` + S.logdepthVS + `
out vec2 vAttr;
void main(){
  vec4 clip = uViewProj * vec4(aPos, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
  vAttr = aAttr;
}
`;

  S.trailFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vAttr;
layout(location = 0) out vec4 fragColor;
uniform vec3 uColor;
uniform float uBright;
` + S.logdepthFS + `
void main(){
  float t = vAttr.x;
  float glow = pow(1.0 - t, 2.2) * vAttr.y;
  vec3 col = mix(vec3(1.0, 0.86, 0.62), uColor, t * 0.8) * glow * uBright;
  fragColor = vec4(col, glow);
  LOGDEPTH_FS()
}
`;

  // 面向相机的发光球（火球 / 闪光 / 羽流）
  S.flashVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPos;
uniform mat4 uViewProj;
uniform vec3 uCenter, uCamRight, uCamUp;
uniform float uSize;
` + S.logdepthVS + `
out vec2 vUV;
void main(){
  vUV = aPos;
  vec3 world = uCenter + (uCamRight * aPos.x + uCamUp * aPos.y) * uSize;
  vec4 clip = uViewProj * vec4(world, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.flashFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform vec3 uColor;
uniform float uIntensity, uCore, uTime, uTurb;
` + S.noise + S.logdepthFS + `
void main(){
  float r = length(vUV);
  if (r > 1.0) discard;
  float core = exp(-pow(r / max(uCore, 0.02), 2.0));
  float halo = pow(max(0.0, 1.0 - r), 3.0) * 0.55;
  float turb = 1.0;
  if (uTurb > 0.01){
    float ang = atan(vUV.y, vUV.x);
    turb = 0.55 + 0.9 * (fbm(vec3(cos(ang) * 3.0, sin(ang) * 3.0, uTime * 0.6), 4, 0.55) * 0.5 + 0.5);
    turb = mix(1.0, turb, uTurb);
  }
  vec3 col = uColor * (core * 2.2 + halo * turb) * uIntensity;
  fragColor = vec4(col, clamp(core + halo * 0.6, 0.0, 1.0));
  LOGDEPTH_FS()
}
`;

  /* ------------------------------------------------------------------ *
   *  轨道线
   * ------------------------------------------------------------------ */
  S.orbitVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in float aT;      // 0..1 沿轨道
uniform mat4 uViewProj;
uniform vec3 uCenter;                  // 焦点（相对相机）
uniform mat3 uBasis;                   // 轨道平面基
uniform float uA, uB, uPhase;
` + S.logdepthVS + `
out float vT;
void main(){
  float ang = aT * 6.28318531;
  vec3 local = vec3(cos(ang) * uA, 0.0, sin(ang) * uB);
  vec3 world = uCenter + uBasis * local;
  vec4 clip = uViewProj * vec4(world, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
  vT = fract(aT - uPhase);
}
`;

  S.orbitFS = `#version 300 es
precision highp float;
precision highp int;
in float vT;
layout(location = 0) out vec4 fragColor;
uniform vec3 uColor;
uniform float uAlpha;
` + S.logdepthFS + `
void main(){
  // 天体所在处最亮，向后拖尾
  float head = pow(1.0 - vT, 3.0);
  float a = uAlpha * (0.16 + 0.84 * head);
  fragColor = vec4(uColor * a, a);
  LOGDEPTH_FS()
}
`;

  /* ------------------------------------------------------------------ *
   *  后处理：亮部提取 → 高斯模糊 → 合成（ACES）
   * ------------------------------------------------------------------ */
  const POST_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
  S.postVS = POST_VS;

  S.brightFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uTex;
uniform float uThreshold, uKnee;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = max(max(c.r, c.g), c.b);
  float s = max(l - uThreshold, 0.0) / max(l, 1e-5);
  s = s * s / (s + uKnee);
  fragColor = vec4(c * clamp(s, 0.0, 1.0), 1.0);
}
`;

  S.blurFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uDir;      // 像素步长方向
void main(){
  // 9 tap 高斯（线性采样合并）
  float w0 = 0.227027, w1 = 0.316216, w2 = 0.070270, w3 = 0.008163;
  vec3 c = texture(uTex, vUV).rgb * w0;
  c += texture(uTex, vUV + uDir * 1.3846).rgb * w1;
  c += texture(uTex, vUV - uDir * 1.3846).rgb * w1;
  c += texture(uTex, vUV + uDir * 3.2308).rgb * w2;
  c += texture(uTex, vUV - uDir * 3.2308).rgb * w2;
  c += texture(uTex, vUV + uDir * 5.1538).rgb * w3;
  c += texture(uTex, vUV - uDir * 5.1538).rgb * w3;
  fragColor = vec4(c, 1.0);
}
`;

  S.compositeFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform float uExposure, uBloomStrength, uVignette, uGrain, uTime, uChroma;

// ACES filmic tonemap（Stephen Hill 拟合）
vec3 RRTAndODTFit(vec3 v){
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 ACESFitted(vec3 color){
  const mat3 ACESInput = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777);
  const mat3 ACESOutput = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602);
  color = ACESInput * color;
  color = RRTAndODTFit(color);
  color = ACESOutput * color;
  return clamp(color, 0.0, 1.0);
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 uv = vUV;
  vec3 scene;
  if (uChroma > 0.0001){
    // 极轻微的横向色散，模拟真实镜头
    vec2 d = (uv - 0.5) * uChroma;
    scene.r = texture(uScene, uv + d).r;
    scene.g = texture(uScene, uv).g;
    scene.b = texture(uScene, uv - d).b;
  } else {
    scene = texture(uScene, uv).rgb;
  }
  vec3 bloom = texture(uBloom1, uv).rgb * 0.5
             + texture(uBloom2, uv).rgb * 0.32
             + texture(uBloom3, uv).rgb * 0.18;
  vec3 col = scene + bloom * uBloomStrength;
  col *= uExposure;
  col = ACESFitted(col);
  // 暗角
  float r = length((uv - 0.5) * vec2(1.0, 1.0));
  col *= mix(1.0, smoothstep(0.95, 0.28, r), uVignette);
  // 线性 → sRGB
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
  // 胶片颗粒 / 抖动放在编码之后：只用于打散色带，不会把星空变灰
  float n = hash(uv * 1024.0 + fract(uTime));
  col += (n - 0.5) * uGrain;
  fragColor = vec4(col, 1.0);
}
`;

  /* ------------------------------------------------------------------ *
   *  测光：把场景降采样成 8x8 的对数亮度图，供 CPU 读回做自动曝光
   *  （像真实相机一样对画面实际亮度反应：撞击白热熔体会让相机收光圈）
   * ------------------------------------------------------------------ */
  S.meterFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uCell;      // 每个 meter 像素覆盖的 uv 尺寸
void main(){
  vec3 sum = vec3(0.0);
  for (int j = 0; j < 4; j++){
    for (int i = 0; i < 4; i++){
      vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0;
      sum += texture(uTex, (floor(vUV / uCell) + o) * uCell).rgb;
    }
  }
  vec3 c = sum / 16.0;
  float lum = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  // log2 亮度编码到 [0,1]：覆盖 2^-16 ~ 2^16
  float e = clamp(log2(lum) / 32.0 + 0.5, 0.0, 1.0);
  fragColor = vec4(e, e, e, 1.0);
}
`;

  /* ------------------------------------------------------------------ *
   *  地表探针：在 1×1 目标里求值指定方向的地形高度，读回后即可判断
   *  撞击点是深海 / 陆地 / 冰盖 —— 让"是否海洋撞击"由地形本身决定
   * ------------------------------------------------------------------ */
  S.probeFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform vec3 uProbeDir;
` + S.noise + S.craters + S.planetCommon + `
void main(){
  vec3 p = normalize(uProbeDir);
  vec4 scar; float rimMask;
  float h = terrainHeight(p, scar, rimMask);
  float ch; vec3 cg; float ca, cd, cm; vec3 cglow;
  craterEval(p, ch, cg, ca, cd, cm, cglow);
  float relH = (h + ch) / max(uRelief, 1.0);      // 约 -1 .. 1
  float sea = uOcean * 2.0 - 1.0;
  float land = relH * 2.0 > sea ? 1.0 : 0.0;
  float lat = abs(p.y);
  float ice = (uIce > 0.01 && lat > uIce - uIceBoost) ? 1.0 : 0.0;
  fragColor = vec4(clamp(relH * 0.5 + 0.5, 0.0, 1.0), land, ice, 1.0);
}
`;

  /* 拾取辅助：把方向绘制成颜色（未使用，保留调试） */
  S.blitFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uTex;
uniform float uScale;
void main(){ fragColor = vec4(texture(uTex, vUV).rgb * uScale, 1.0); }
`;
})(window);
