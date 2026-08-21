/**
 * gfx/shaders/post.js —— 后处理着色器集合
 *
 *  SSAO（半分辨率 + 深度感知双边模糊）
 *  Bloom（亮度提取 → 13-tap 降采样链 → tent 升采样）
 *  God Rays（以太阳屏幕位置为中心的径向遮挡累积）
 *  Composite（曝光 → 镜头光斑 → 色散 → ACES → 暗角 → 颗粒）
 *  FXAA 3.8 console 版本
 */

import { NOISE, TONEMAP, DEPTH_UTIL } from './common.js';

/** 所有后处理共用的全屏顶点着色器 */
export const fullscreenVS = /* glsl */`
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/* ═══════════════════════ SSAO ═══════════════════════ */

export const ssaoFS = /* glsl */`
precision highp float;
${NOISE}
${DEPTH_UTIL}

in vec2 vUV;
uniform sampler2D uND;          // (viewNormal.xyz, linearViewZ)
uniform mat4  uProj;
uniform vec3  uKernel[KERNEL_SIZE];
uniform vec2  uRes;
uniform float uTanHalfY;
uniform float uAspect;
uniform float uRadius;
uniform float uBias;
uniform float uIntensity;
layout(location = 0) out vec4 oAO;

void main(){
  vec4 nd = texture(uND, vUV);
  float z = nd.w;
  if (z <= 1e-4){ oAO = vec4(1.0); return; }   // 天空不做遮蔽

  vec3 N = normalize(nd.xyz);
  vec3 P = viewFromDepth(vUV, z, uTanHalfY, uAspect);

  float ang = hash21(floor(vUV * uRes)) * TAU;
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);

  vec3 up = abs(N.z) < 0.98 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  mat3 TBN = mat3(T, B, N);

  float occ = 0.0;
  float valid = 0.0;
  for (int i = 0; i < KERNEL_SIZE; i++){
    vec3 k = uKernel[i];
    k.xy = rot * k.xy;
    vec3 sp = P + TBN * k * uRadius;
    vec4 clip = uProj * vec4(sp, 1.0);
    if (clip.w <= 0.0) continue;
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sz = texture(uND, suv).w;
    valid += 1.0;
    if (sz <= 1e-4) continue;                    // 采样点落在天空
    float spz = -sp.z;
    float range = smoothstep(0.0, 1.0, uRadius / max(abs(z - sz), 1e-3));
    occ += (sz < spz - uBias ? 1.0 : 0.0) * range;
  }
  float ao = 1.0 - (occ / max(valid, 1.0)) * uIntensity;
  oAO = vec4(clamp(ao, 0.0, 1.0));
}
`;

export const ssaoBlurFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uAO;
uniform sampler2D uND;
uniform vec2 uDir;              // (1/w,0) 或 (0,1/h)
layout(location = 0) out vec4 oAO;
void main(){
  float cz = texture(uND, vUV).w;
  float sum = 0.0, wsum = 0.0;
  for (int i = -3; i <= 3; i++){
    vec2 uv = vUV + uDir * float(i);
    float z = texture(uND, uv).w;
    float wz = exp(-abs(z - cz) * 0.35);
    float wg = exp(-float(i * i) * 0.14);
    float w = wz * wg;
    sum += texture(uAO, uv).r * w;
    wsum += w;
  }
  oAO = vec4(sum / max(wsum, 1e-4));
}
`;

/* ═══════════════════════ Bloom ═══════════════════════ */

export const brightFS = /* glsl */`
precision highp float;
${TONEMAP}
in vec2 vUV;
uniform sampler2D uSrc;
uniform float uThreshold;
uniform float uKnee;
uniform float uClamp;
layout(location = 0) out vec4 oColor;
void main(){
  vec3 c = texture(uSrc, vUV).rgb;
  c = min(c, vec3(uClamp));                       // 抑制单像素"萤火虫"
  float l = luma(c);
  float soft = clamp((l - uThreshold + uKnee) / max(2.0 * uKnee, 1e-4), 0.0, 1.0);
  float w = max(soft * soft, step(uThreshold, l));
  oColor = vec4(c * w, 1.0);
}
`;

/** 13-tap 降采样（Jimenez / COD Advanced Warfare 方案，能有效抑制闪烁） */
export const downsampleFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;            // 源纹理像素尺寸
layout(location = 0) out vec4 oColor;
void main(){
  vec2 t = uTexel;
  vec3 a = texture(uSrc, vUV + t * vec2(-2.0,  2.0)).rgb;
  vec3 b = texture(uSrc, vUV + t * vec2( 0.0,  2.0)).rgb;
  vec3 c = texture(uSrc, vUV + t * vec2( 2.0,  2.0)).rgb;
  vec3 d = texture(uSrc, vUV + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture(uSrc, vUV).rgb;
  vec3 f = texture(uSrc, vUV + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture(uSrc, vUV + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(uSrc, vUV + t * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture(uSrc, vUV + t * vec2( 2.0, -2.0)).rgb;
  vec3 j = texture(uSrc, vUV + t * vec2(-1.0,  1.0)).rgb;
  vec3 k = texture(uSrc, vUV + t * vec2( 1.0,  1.0)).rgb;
  vec3 l = texture(uSrc, vUV + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(uSrc, vUV + t * vec2( 1.0, -1.0)).rgb;
  vec3 o = e * 0.125;
  o += (a + c + g + i) * 0.03125;
  o += (b + d + f + h) * 0.0625;
  o += (j + k + l + m) * 0.125;
  oColor = vec4(o, 1.0);
}
`;

/** 3×3 tent 升采样（与降采样链配合形成宽而柔和的光晕） */
export const upsampleFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uRadius;
layout(location = 0) out vec4 oColor;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 o = texture(uSrc, vUV + t * vec2(-1.0,  1.0)).rgb * 1.0;
  o += texture(uSrc, vUV + t * vec2( 0.0,  1.0)).rgb * 2.0;
  o += texture(uSrc, vUV + t * vec2( 1.0,  1.0)).rgb * 1.0;
  o += texture(uSrc, vUV + t * vec2(-1.0,  0.0)).rgb * 2.0;
  o += texture(uSrc, vUV).rgb * 4.0;
  o += texture(uSrc, vUV + t * vec2( 1.0,  0.0)).rgb * 2.0;
  o += texture(uSrc, vUV + t * vec2(-1.0, -1.0)).rgb * 1.0;
  o += texture(uSrc, vUV + t * vec2( 0.0, -1.0)).rgb * 2.0;
  o += texture(uSrc, vUV + t * vec2( 1.0, -1.0)).rgb * 1.0;
  oColor = vec4(o / 16.0, 1.0);
}
`;

/* ═══════════════════════ God Rays ═══════════════════════ */

export const godraysFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;         // HDR 场景
uniform sampler2D uND;          // 用于判断是否为天空
uniform vec2  uSunUV;
uniform float uDensity;
uniform float uDecay;
uniform float uWeight;
uniform float uOn;
layout(location = 0) out vec4 oColor;
#define RAY_SAMPLES 28
void main(){
  if (uOn < 0.5){ oColor = vec4(0.0); return; }
  vec2 delta = (uSunUV - vUV) * (uDensity / float(RAY_SAMPLES));
  vec2 uv = vUV;
  float illum = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < RAY_SAMPLES; i++){
    uv += delta;
    float sky = texture(uND, uv).w <= 1e-4 ? 1.0 : 0.0;   // 被舱体遮挡则不贡献
    acc += texture(uSrc, uv).rgb * sky * illum;
    illum *= uDecay;
  }
  oColor = vec4(acc * (uWeight / float(RAY_SAMPLES)), 1.0);
}
`;

/* ═══════════════════════ 合成 ═══════════════════════ */

export const compositeFS = /* glsl */`
precision highp float;
${NOISE}
${TONEMAP}

in vec2 vUV;
uniform sampler2D uHDR;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uRayStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uChroma;
uniform float uTime;
uniform vec2  uSunUV;
uniform float uSunVisible;
uniform vec3  uSunTint;
uniform float uAspect;
layout(location = 0) out vec4 oColor;

/** 镜头光斑：沿"画面中心—太阳"轴线排布若干鬼影 + 一道水平条纹 + 收敛的中心柔光 */
vec3 lensFlare(vec2 uv, vec2 sun){
  if (uSunVisible < 0.01) return vec3(0.0);
  vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 s = (sun - 0.5) * vec2(uAspect, 1.0);
  vec3 acc = vec3(0.0);
  const float sizes[5] = float[5](0.048, 0.026, 0.072, 0.016, 0.036);
  const float offs[5]  = float[5](-0.42, -0.85, 0.55, 1.28, -1.55);
  for (int i = 0; i < 5; i++){
    vec2 g = s * offs[i];
    float r = length(d - g);
    float a = 1.0 - smoothstep(0.0, sizes[i], r);
    float ring = smoothstep(sizes[i] * 0.55, sizes[i] * 0.85, r) * (1.0 - smoothstep(sizes[i] * 0.85, sizes[i], r));
    vec3 tint = mix(vec3(0.45, 0.75, 1.0), vec3(1.0, 0.72, 0.42), float(i) / 4.0);
    acc += tint * (a * 0.10 + ring * 0.22);
  }
  // 水平耀斑条（各向异性镜头的典型表现）
  float streak = exp(-abs(d.y - s.y) * 260.0) * exp(-abs(d.x - s.x) * 2.2);
  acc += uSunTint * streak * 0.30;
  // 太阳周围的柔光：必须收敛得足够快，否则会把整片天空抬亮
  acc += uSunTint * exp(-length(d - s) * 17.0) * 0.09;
  return acc * uSunVisible;
}

void main(){
  vec2 d = vUV - 0.5;
  vec3 c;
  if (uChroma > 1e-4){
    float k = uChroma * dot(d, d);
    c.r = texture(uHDR, vUV - d * k).r;
    c.g = texture(uHDR, vUV).g;
    c.b = texture(uHDR, vUV + d * k).b;
  } else {
    c = texture(uHDR, vUV).rgb;
  }

  c += texture(uBloom, vUV).rgb * uBloomStrength;
  c += texture(uRays, vUV).rgb * uRayStrength;
  c += lensFlare(vUV, uSunUV);

  c *= uExposure;
  c = acesFilmic(c);

  float vig = 1.0 - uVignette * dot(d, d) * 2.1;
  c *= clamp(vig, 0.0, 1.0);

  // 轻微冷调分级：暗部偏蓝、亮部偏暖，增强"深空"氛围
  c = mix(c, c * vec3(0.94, 0.99, 1.08), 0.55 * (1.0 - luma(c)));
  c = mix(c, c * vec3(1.05, 1.01, 0.96), 0.35 * luma(c));

  c += (hash21(vUV * 1637.0 + fract(uTime) * 91.7) - 0.5) * uGrain;
  oColor = vec4(linearToSrgb(max(c, 0.0)), 1.0);
}
`;

/* ═══════════════════════ FXAA ═══════════════════════ */

export const fxaaFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uInvRes;
uniform float uOn;
layout(location = 0) out vec4 oColor;

float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(){
  vec3 m = texture(uTex, vUV).rgb;
  if (uOn < 0.5){ oColor = vec4(m, 1.0); return; }
  vec3 nw = texture(uTex, vUV + vec2(-1.0, -1.0) * uInvRes).rgb;
  vec3 ne = texture(uTex, vUV + vec2( 1.0, -1.0) * uInvRes).rgb;
  vec3 sw = texture(uTex, vUV + vec2(-1.0,  1.0) * uInvRes).rgb;
  vec3 se = texture(uTex, vUV + vec2( 1.0,  1.0) * uInvRes).rgb;
  float lnw = lum(nw), lne = lum(ne), lsw = lum(sw), lse = lum(se), lm = lum(m);
  float lmin = min(lm, min(min(lnw, lne), min(lsw, lse)));
  float lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
  if (lmax - lmin < 0.035 * lmax + 0.008){ oColor = vec4(m, 1.0); return; }

  vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
  float reduce = max((lnw + lne + lsw + lse) * 0.25 * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcp, -8.0, 8.0) * uInvRes;

  vec3 rgbA = 0.5 * (texture(uTex, vUV + dir * (1.0 / 3.0 - 0.5)).rgb +
                     texture(uTex, vUV + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture(uTex, vUV + dir * -0.5).rgb +
                                   texture(uTex, vUV + dir *  0.5).rgb);
  float lb = lum(rgbB);
  oColor = vec4((lb < lmin || lb > lmax) ? rgbA : rgbB, 1.0);
}
`;

/** 简单拷贝（调试与降级路径用） */
export const blitFS = /* glsl */`
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
layout(location = 0) out vec4 oColor;
void main(){ oColor = texture(uTex, vUV); }
`;
