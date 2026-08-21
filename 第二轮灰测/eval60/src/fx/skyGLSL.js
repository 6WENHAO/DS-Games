/**
 * 共享 GLSL：程序化星空 / 星云。
 * 天空球与黑洞透镜着色器共用同一个 skyColor(dir)，
 * 这样被引力弯折的背景与真实天空严丝合缝，看不到接缝。
 */

export const SKY_GLSL = /* glsl */ `
#ifndef SKY_INCLUDED
#define SKY_INCLUDED

float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);
  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
}

float skyFbm(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 5; i++){
    s += a * vnoise(p);
    n += a;
    a *= 0.5;
    p *= 2.03;
  }
  return s / n;
}

float skyRidge(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++){
    float v = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    s += a * v * v;
    n += a;
    a *= 0.5;
    p *= 2.11;
  }
  return s / n;
}

const vec3 GALAXY_UP = vec3(0.24, 0.94, -0.24);

/** 单层恒星：按 3D 网格撒点，中心内缩保证不被格子裁切 */
vec3 starLayer(vec3 dir, float cells, float thresh, float sharp, float bright){
  vec3 p = dir * cells;
  vec3 id = floor(p);
  vec3 h = hash33(id);
  if (h.x < thresh) return vec3(0.0);
  vec3 c = id + 0.5 + (h - 0.5) * 0.55;
  vec3 sc = normalize(c);
  float d = length(dir - sc) * cells;
  float core = pow(max(0.0, 1.0 - d * 0.85), sharp);
  // 光谱：冷蓝 → 白 → 暖橙
  float t = h.z;
  vec3 tint = mix(vec3(0.62, 0.76, 1.0), vec3(1.0, 0.98, 0.94), smoothstep(0.0, 0.55, t));
  tint = mix(tint, vec3(1.0, 0.78, 0.55), smoothstep(0.62, 1.0, t));
  float mag = mix(0.25, 1.0, pow(h.y, 3.0));
  return tint * core * mag * bright;
}

vec3 skyStars(vec3 dir){
  float band = exp(-pow(abs(dot(dir, GALAXY_UP)) * 2.1, 2.0));
  vec3 c = vec3(0.0);
  c += starLayer(dir, 42.0,  0.60, 9.0,  1.30);
  c += starLayer(dir, 96.0,  0.72, 12.0, 0.72);
  c += starLayer(dir, 210.0, 0.82, 16.0, 0.40) * (0.55 + 0.9 * band);
  c += starLayer(dir, 430.0, 0.88, 20.0, 0.20) * (0.35 + 1.2 * band);
  return c;
}

vec3 skyNebula(vec3 dir){
  float band = exp(-pow(abs(dot(dir, GALAXY_UP)) * 2.4, 2.0));
  float n1 = skyFbm(dir * 2.1 + 11.0);
  float n2 = skyRidge(dir * 4.3 - 5.0);
  float n3 = skyFbm(dir * 7.7 + 31.0);

  vec3 col = vec3(0.0);
  // 银河尘埃带（冷蓝紫）——对比度拉高，避免糊成一片灰
  col += vec3(0.055, 0.075, 0.155) * band * pow(n1, 3.2) * 2.9;
  // 电离氢云（洋红/玫红）
  float mag = smoothstep(0.62, 0.98, n2) * band;
  col += vec3(0.19, 0.045, 0.13) * mag * 1.5;
  // 青绿反射星云
  float teal = smoothstep(0.70, 1.0, skyFbm(dir * 3.1 - 21.0));
  col += vec3(0.02, 0.10, 0.115) * teal * 1.1;
  // 暗尘埃遮挡
  float dust = smoothstep(0.42, 0.85, n3) * band;
  col *= 1.0 - 0.6 * dust;
  // 极微弱的宇宙底光
  col += vec3(0.0022, 0.0030, 0.0062);
  return col * 0.42;
}

vec3 skyColor(vec3 dir){
  dir = normalize(dir);
  return skyNebula(dir) + skyStars(dir);
}
#endif
`;
