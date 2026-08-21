/**
 * gfx/shaders/geometry.js —— 体素几何着色器
 *
 * 一份源码通过 #define 复用于四个通道：
 *   PASS_MAIN     前向着色（PBR + 阴影 + SSAO + 程序化表面细节）
 *   PASS_PREPASS  仅写深度与视空间法线/线性深度（供 SSAO 与深度相等测试）
 *   PASS_SHADOW   仅写深度（方向光正交投影）
 *   PASS_PICK     输出舱段 ID（GPU 拾取）
 *
 * 「精致度」的关键在片元阶段：贪心网格化把大量体素合并成大四边形后，
 * 靠 uv（面内体素坐标，跨面连续）在片元里重建体素格线、面板缝、铆钉、
 * 电池栅线、隔热毯褶皱、散热鳍片、警示斜纹等细节，并用屏幕空间导数
 * 做凹凸法线扰动，从而在极低的顶点开销下获得高密度表面信息。
 */

import { NOISE, BRDF } from './common.js';

export const geometryVS = /* glsl */`
precision highp float;

layout(location = 0) in vec3 aPos;      // 体素局部坐标
layout(location = 1) in vec4 aMeta;     // faceId / AO / code / variant
layout(location = 2) in vec4 aAlbedo;   // albedo.rgb + roughness
layout(location = 3) in vec4 aEmissive; // emissive.rgb + metallic
layout(location = 4) in vec2 aUV;       // 面内体素坐标

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uView;
uniform vec3 uOrigin;
uniform float uNormalBias;

const vec3 FACE_N[6] = vec3[6](
  vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));

out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec4 vAlbedo;
out vec4 vEmissive;
out float vAO;
out float vVariant;
flat out int vCode;
flat out int vFace;
out vec3 vViewNormal;
out float vViewZ;

void main(){
  int face = int(aMeta.x + 0.5);
  vec3 n = FACE_N[face];
  vec4 wp = uModel * vec4(aPos + uOrigin, 1.0);
  vec3 wn = normalize(mat3(uModel) * n);

  vWorld = wp.xyz;
  vNormal = wn;
  vUV = aUV;
  vAlbedo = aAlbedo;
  vEmissive = aEmissive;
  vAO = aMeta.y * (1.0 / 255.0);
  vCode = int(aMeta.z + 0.5);
  vVariant = aMeta.w * (1.0 / 255.0);
  vFace = face;

#ifdef PASS_SHADOW
  wp.xyz += wn * uNormalBias;   // 法线偏移，抑制自遮挡条纹
#endif
  vec4 vp = uView * wp;
  vViewNormal = normalize(mat3(uView) * wn);
  vViewZ = -vp.z;
  gl_Position = uViewProj * wp;
}
`;

export const geometryFS = /* glsl */`
precision highp float;
precision highp sampler2DShadow;

${NOISE}
${BRDF}

in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec4 vAlbedo;
in vec4 vEmissive;
in float vAO;
in float vVariant;
flat in int vCode;
flat in int vFace;
in vec3 vViewNormal;
in float vViewZ;

/* ── 通用 uniform ── */
uniform float uTime;
uniform float uOpacity;      // 抖动裁剪（装配动画）
uniform int   uMode;         // 0=PBR 1=蓝图 2=透视
uniform float uDetail;       // 表面细节强度

/* ── 主通道 uniform ── */
uniform vec3  uCamPos;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uSkyColor;
uniform vec3  uGroundColor;
uniform vec3  uEarthColor;
uniform vec3  uEarthDir;
uniform vec3  uFillColor;
uniform mat4  uShadowVP;
uniform sampler2DShadow uShadowMap;
uniform sampler2D uAOTex;
uniform vec2  uInvRes;
uniform float uShadowStrength;
uniform float uAOStrength;
uniform float uEmissiveBoost;
uniform float uHighlight;
uniform vec3  uHighlightColor;
uniform float uDim;          // 未选中舱段的压暗（单独显示模式）

/* ── 拾取通道 uniform ── */
uniform vec3 uPickColor;

#define EMISSIVE_SCALE 8.0
#define D_PLAIN 0
#define D_HULL 1
#define D_FOIL 2
#define D_SOLAR 3
#define D_TRUSS 4
#define D_WINDOW 5
#define D_RADIATOR 6
#define D_HAZARD 7
#define D_NOZZLE 8
#define D_GRATE 9
#define D_LED 10

#define F_BLINK 1
#define F_PULSE 2
#define F_SWEEP 4
#define F_FLICKER 8

#if defined(PASS_MAIN)
layout(location = 0) out vec4 oColor;
#elif defined(PASS_PREPASS)
layout(location = 0) out vec4 oNormalDepth;
#elif defined(PASS_PICK)
layout(location = 0) out vec4 oPick;
#endif

/* ═════════════ 程序化表面细节 ═════════════ */

/** 体素单元凹槽：0 = 位于格线上，1 = 单元中心 */
float cellMask(vec2 uv, float soft){
  vec2 f = abs(fract(uv) - 0.5);
  return smoothstep(0.0, soft, 0.5 - max(f.x, f.y));
}

/** 周期为 period 的分格缝：0 = 缝上 */
float seamMask(vec2 uv, float period, float soft){
  vec2 g = abs(fract(uv / period + 0.5) - 0.5) * period;
  return smoothstep(0.0, soft, min(g.x, g.y));
}

/** 面板四边中点的铆钉：1 = 铆钉中心 */
float rivetMask(vec2 uv, float period){
  vec2 c = (floor(uv / period) + 0.5) * period;
  vec2 l = uv - c;
  float h = period * 0.5 - 0.75;
  float m = 1e9;
  m = min(m, length(l - vec2(0.0,  h)));
  m = min(m, length(l - vec2(0.0, -h)));
  m = min(m, length(l - vec2( h, 0.0)));
  m = min(m, length(l - vec2(-h, 0.0)));
  return 1.0 - smoothstep(0.16, 0.34, m);
}

/** 单向细鳍片 */
float finMask(vec2 uv, float freq, float soft){
  float f = abs(fract(uv.x * freq) - 0.5);
  return smoothstep(0.0, soft, f);
}

struct Surface {
  float h;      // 高度场（用于导数凹凸）
  vec3  albedo;
  float rough;
  float metal;
  vec3  emis;
  float aoMul;  // 附加遮蔽
};

Surface shadeSurface(int detail, int flags, vec2 uv, vec3 base, float rough, float metal, vec3 emis){
  Surface s;
  s.h = 0.0; s.albedo = base; s.rough = rough; s.metal = metal; s.emis = emis; s.aoMul = 1.0;

  float cell = cellMask(uv, 0.10);
  float grain = vnoise2(uv * 3.7 + vVariant * 21.0);

  if (detail == D_HULL){
    float seam = seamMask(uv, 4.0, 0.10);
    float rivet = rivetMask(uv, 4.0);
    s.h = cell * 0.35 + seam * 0.65 + rivet * 0.5;
    s.albedo *= mix(0.66, 1.0, cell) * mix(0.74, 1.0, seam);
    s.albedo *= 1.0 + rivet * 0.16;
    // 沿面板方向的风化条纹
    float streak = fbm2(vec2(uv.x * 0.35, uv.y * 5.0), 3);
    s.albedo *= mix(0.90, 1.06, streak);
    s.rough = clamp(rough + (grain - 0.5) * 0.18 + (1.0 - seam) * 0.12, 0.04, 1.0);
    s.aoMul = mix(0.80, 1.0, seam);
  } else if (detail == D_FOIL){
    // 多层隔热毯：低频褶皱 + 高频细纹，金属高光被强烈打散
    float w = fbm2(uv * 0.55, 4) * 1.4 + fbm2(uv * 2.6 + 13.0, 2) * 0.35;
    s.h = w * 1.9 + cell * 0.18;
    s.albedo *= 0.82 + 0.36 * w;
    s.rough = clamp(rough + (w - 0.7) * 0.30, 0.06, 1.0);
    s.aoMul = mix(0.86, 1.0, cell);
  } else if (detail == D_SOLAR){
    float grid = smoothstep(0.0, 0.09, abs(fract(uv.x) - 0.5));       // 细栅线
    float bus  = smoothstep(0.0, 0.16, abs(fract(uv.y / 8.0) - 0.5) * 8.0);
    s.h = (1.0 - grid) * 0.5 + (1.0 - bus) * 0.9;
    s.albedo *= mix(0.55, 1.0, grid) * mix(0.7, 1.0, bus);
    s.albedo += vec3(0.02, 0.05, 0.13) * (1.0 - bus);
    s.rough = clamp(rough * mix(1.6, 0.7, grid), 0.03, 1.0);
    s.aoMul = mix(0.9, 1.0, grid);
  } else if (detail == D_TRUSS){
    float seam = seamMask(uv, 2.0, 0.12);
    s.h = cell * 0.55 + seam * 0.4;
    s.albedo *= mix(0.62, 1.0, cell) * mix(0.86, 1.0, seam);
    s.rough = clamp(rough + (grain - 0.5) * 0.22, 0.05, 1.0);
    s.aoMul = mix(0.74, 1.0, cell);
  } else if (detail == D_WINDOW){
    // 玻璃：窗框内凹 + 逐窗随机亮度 + 内部灯光闪烁
    float frame = smoothstep(0.0, 0.16, min(abs(fract(uv.x) - 0.5), abs(fract(uv.y) - 0.5)));
    s.h = -(1.0 - frame) * 1.2;
    float lit = step(0.18, hash11(vVariant * 97.0 + floor(uv.x) * 3.1 + floor(uv.y) * 7.7));
    float fl = 1.0;
    if ((flags & F_FLICKER) != 0){
      fl = 0.72 + 0.28 * sin(uTime * (0.5 + vVariant) + vVariant * 40.0);
    }
    s.emis *= lit * fl * mix(0.25, 1.0, frame);
    s.albedo *= mix(0.35, 1.0, frame);
    s.rough = mix(0.65, rough, frame);
    s.aoMul = mix(0.6, 1.0, frame);
  } else if (detail == D_RADIATOR){
    float fin = finMask(uv, 1.0, 0.13);
    s.h = fin * 0.6;
    s.albedo *= mix(0.78, 1.0, fin);
    s.rough = clamp(rough + (1.0 - fin) * 0.2, 0.05, 1.0);
    s.aoMul = mix(0.88, 1.0, fin);
  } else if (detail == D_HAZARD){
    float st = fract((uv.x + uv.y) * 0.25);
    float band = step(0.5, st);
    s.albedo = mix(vec3(0.055, 0.05, 0.045), base, band);
    s.h = cell * 0.35;
    s.rough = clamp(rough + 0.1 * (1.0 - band), 0.05, 1.0);
    s.aoMul = mix(0.85, 1.0, cell);
  } else if (detail == D_NOZZLE){
    float ring = smoothstep(0.0, 0.14, abs(fract(uv.y * 0.5) - 0.5));
    s.h = (1.0 - ring) * 1.1 + cell * 0.2;
    s.albedo *= mix(0.5, 1.0, ring);
    // 靠近喷口方向的烧蚀渐变
    float burn = smoothstep(0.0, 14.0, fract(uv.y / 32.0) * 32.0);
    s.albedo *= mix(0.35, 1.0, burn);
    s.rough = clamp(rough + (1.0 - burn) * 0.4, 0.05, 1.0);
  } else if (detail == D_GRATE){
    vec2 f = abs(fract(uv) - 0.5);
    float bar = smoothstep(0.28, 0.42, max(f.x, f.y));
    s.h = bar * 0.9;
    s.albedo *= mix(0.16, 1.0, bar);
    s.aoMul = mix(0.35, 1.0, bar);
    s.rough = clamp(rough + 0.12, 0.05, 1.0);
  } else if (detail == D_LED){
    vec2 f = fract(uv) - 0.5;
    float core = 1.0 - smoothstep(0.05, 0.42, length(f));
    s.h = core * 0.7;
    s.emis *= 0.35 + 1.9 * core;
    s.albedo *= 0.6 + 0.6 * core;
  } else {
    s.h = cell * 0.45;
    s.albedo *= mix(0.78, 1.0, cell);
    s.rough = clamp(rough + (grain - 0.5) * 0.12, 0.04, 1.0);
    s.aoMul = mix(0.86, 1.0, cell);
  }

  /* 动态标志 */
  if ((flags & F_BLINK) != 0){
    float ph = fract(uTime * 0.55 + vVariant);
    s.emis *= 0.08 + 1.7 * smoothstep(0.55, 0.72, ph) * (1.0 - smoothstep(0.78, 0.95, ph));
  }
  if ((flags & F_PULSE) != 0){
    s.emis *= 0.62 + 0.5 * sin(uTime * 2.1 + vVariant * TAU);
  }
  if ((flags & F_SWEEP) != 0){
    float sw = fract(uv.x * 0.06 - uTime * 0.35);
    s.emis *= 0.25 + 2.0 * smoothstep(0.86, 1.0, sw);
  }
  return s;
}

/** 屏幕空间导数凹凸映射（无需显式切线） */
vec3 bumpNormal(vec3 N, vec3 P, float h, float scale){
  vec3 dpdx = dFdx(P), dpdy = dFdy(P);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-9) return N;
  vec3 g = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * N - scale * g);
}

/** 抖动裁剪：装配动画与透视模式共用，保证各通道一致 */
bool cutout(float facing){
  float keep = uOpacity;
  if (uMode == 2) keep = min(keep, clamp(pow(1.0 - facing, 1.4) * 1.5 + 0.05, 0.0, 1.0));
  if (keep >= 0.999) return false;
  return bayer4(gl_FragCoord.xy) > keep;
}

float sampleShadow(vec3 wp, float NdL){
#ifdef PASS_MAIN
  if (uShadowStrength <= 0.001) return 1.0;
  vec4 sp = uShadowVP * vec4(wp, 1.0);
  vec3 pc = sp.xyz / sp.w * 0.5 + 0.5;
  if (pc.z >= 1.0 || pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) return 1.0;
  float texel = 1.0 / float(SHADOW_SIZE);
  float bias = mix(2.2, 0.6, NdL) * texel;
  float s = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      s += texture(uShadowMap, vec3(pc.xy + vec2(float(x), float(y)) * texel, pc.z - bias));
    }
  }
  return mix(1.0, s / 9.0, uShadowStrength);
#else
  return 1.0;
#endif
}

void main(){
  vec3 Ng = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float facing = clamp(dot(Ng, V), 0.0, 1.0);
  if (cutout(facing)) discard;

  int detail = vCode & 15;
  int flags = (vCode >> 4) & 15;

#if defined(PASS_SHADOW)
  return;                              // 仅需深度
#elif defined(PASS_PICK)
  oPick = vec4(uPickColor, 1.0);
  return;
#elif defined(PASS_PREPASS)
  oNormalDepth = vec4(vViewNormal, vViewZ);
  return;
#else
  /* ── 蓝图模式 ── */
  if (uMode == 1){
    float lines = 1.0 - cellMask(vUV, 0.07);
    float seams = 1.0 - seamMask(vUV, 4.0, 0.10);
    float rim = pow(1.0 - facing, 2.6);
    vec3 c = vec3(0.012, 0.035, 0.062);
    c += vec3(0.16, 0.72, 1.0) * (lines * 0.42 + seams * 1.15);
    c += vec3(0.30, 0.85, 1.0) * rim * 1.15;
    c += uHighlightColor * uHighlight * (0.5 + rim);
    oColor = vec4(c * uDim, 1.0);
    return;
  }
  /* ── 结构透视模式 ── */
  if (uMode == 2){
    float rim = pow(1.0 - facing, 1.3);
    vec3 c = mix(vec3(0.05, 0.30, 0.48), vec3(0.62, 0.95, 1.0), rim) * 1.5;
    c += vEmissive.rgb * EMISSIVE_SCALE * 0.35;
    c += uHighlightColor * uHighlight * 1.2;
    oColor = vec4(c * uDim, 1.0);
    return;
  }

  /* ── 标准 PBR 着色 ── */
  Surface s = shadeSurface(detail, flags, vUV, vAlbedo.rgb, vAlbedo.a, vEmissive.a,
                           vEmissive.rgb * EMISSIVE_SCALE);
  vec3 N = bumpNormal(Ng, vWorld, s.h * uDetail, 0.55 * uDetail);

  float NdV = max(dot(N, V), 1e-4);
  float NdL = max(dot(N, uSunDir), 0.0);
  vec3 H = normalize(V + uSunDir);
  float NdH = max(dot(N, H), 0.0);
  float VdH = max(dot(V, H), 0.0);

  vec3 f0 = mix(vec3(0.04), s.albedo, s.metal);
  vec3 F = f_schlick(VdH, f0);
  float D = d_ggx(NdH, s.rough);
  float Vis = v_smith(NdV, max(NdL, 1e-4), s.rough);
  vec3 spec = D * Vis * F;
  vec3 kd = (1.0 - F) * (1.0 - s.metal);
  vec3 diff = kd * s.albedo / PI;

  float shadow = sampleShadow(vWorld, NdL);
  vec3 direct = (diff + spec) * uSunColor * NdL * shadow;

  /* 环境项：顶天/底地半球 + 地球反照 + 粗糙度补偿的镜面环境 */
  float ssao = texture(uAOTex, gl_FragCoord.xy * uInvRes).r;
  float vao = mix(1.0, vAO * s.aoMul, 0.88);
  float ao = clamp(vao * mix(1.0, ssao, uAOStrength), 0.0, 1.0);

  float up = N.y * 0.5 + 0.5;
  vec3 ambDiff = mix(uGroundColor, uSkyColor, up);
  ambDiff += uEarthColor * max(dot(N, uEarthDir), 0.0);
  ambDiff *= s.albedo * (1.0 - s.metal);

  vec3 R = reflect(-V, N);
  vec3 envSpec = mix(uGroundColor, uSkyColor, R.y * 0.5 + 0.5) * 1.25;
  envSpec += uSunColor * 0.06 * pow(max(dot(R, uSunDir), 0.0), mix(2.0, 64.0, 1.0 - s.rough));
  envSpec *= env_fresnel(f0, s.rough, NdV) * (1.0 - s.rough * 0.7);

  // 侧向补光：让背光面不至于死黑，同时勾出体积感
  vec3 fill = uFillColor * s.albedo * (0.35 + 0.65 * max(dot(N, normalize(vec3(-uSunDir.x, 0.35, -uSunDir.z))), 0.0));

  vec3 color = direct + (ambDiff + envSpec + fill) * ao + s.emis * uEmissiveBoost;

  /* 选中/悬停高亮：边缘光 + 轻微整体提亮 */
  if (uHighlight > 0.001){
    float rim = pow(1.0 - facing, 2.2);
    color += uHighlightColor * (rim * 2.6 + 0.10) * uHighlight;
  }
  color *= uDim;

  oColor = vec4(color, 1.0);
#endif
}
`;
