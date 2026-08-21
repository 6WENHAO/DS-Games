/**
 * gfx/shaders/common.js —— 公共 GLSL 代码块
 * 以模板字符串形式提供，由各程序按需拼接（相当于一个极简的 #include 机制）。
 */

/** 常量与散列/噪声 */
export const NOISE = /* glsl */`
#define PI 3.141592653589793
#define TAU 6.283185307179586

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float vnoise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1,0));
  float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i), n100 = hash31(i + vec3(1,0,0));
  float n010 = hash31(i + vec3(0,1,0)), n110 = hash31(i + vec3(1,1,0));
  float n001 = hash31(i + vec3(0,0,1)), n101 = hash31(i + vec3(1,0,1));
  float n011 = hash31(i + vec3(0,1,1)), n111 = hash31(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float fbm2(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    s += a * vnoise2(p); p *= 2.03; a *= 0.5;
  }
  return s;
}

float fbm3(vec3 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++){
    if (i >= oct) break;
    s += a * vnoise3(p); p *= 2.02; a *= 0.5;
  }
  return s;
}

/** 4×4 Bayer 有序抖动阈值（用于无混合的半透明裁剪） */
float bayer4(vec2 c){
  const float m[16] = float[16](
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0);
  ivec2 i = ivec2(mod(c, 4.0));
  return (m[i.y * 4 + i.x] + 0.5) / 16.0;
}
`;

/** 色调映射与色彩工具 */
export const TONEMAP = /* glsl */`
vec3 acesFilmic(vec3 x){
  // Narkowicz 近似 ACES
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 linearToSrgb(vec3 c){
  return mix(12.92 * c, 1.055 * pow(max(c, 1e-5), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** PBR BRDF */
export const BRDF = /* glsl */`
float d_ggx(float NdH, float rough){
  float a = rough * rough;
  float a2 = a * a;
  float d = NdH * NdH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 1e-7);
}
float v_smith(float NdV, float NdL, float rough){
  float a = rough * rough;
  float gv = NdL * sqrt(NdV * NdV * (1.0 - a) + a);
  float gl = NdV * sqrt(NdL * NdL * (1.0 - a) + a);
  return 0.5 / max(gv + gl, 1e-6);
}
vec3 f_schlick(float u, vec3 f0){
  float f = pow(1.0 - u, 5.0);
  return f0 + (1.0 - f0) * f;
}
/** 环境镜面的粗糙度补偿 Fresnel */
vec3 env_fresnel(vec3 f0, float rough, float NdV){
  return f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - NdV, 5.0);
}
`;

/** 屏幕空间深度重建 */
export const DEPTH_UTIL = /* glsl */`
/** 由线性视深与屏幕 uv 反算视空间坐标 */
vec3 viewFromDepth(vec2 uv, float viewZ, float tanHalfY, float aspect){
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * tanHalfY * aspect, ndc.y * tanHalfY, -1.0) * viewZ;
}
`;
