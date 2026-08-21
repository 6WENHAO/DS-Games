/* =======================================================================
 *  shaders.js  —  GLSL ES 3.00 着色器库（第一部分）
 *  公共片段 / 解析撞击坑 / 星球表面 / 大气散射 / 云层 / 行星环 / 恒星
 *
 *  撞击坑采用“双轨”方案：
 *   · 最近 4 个坑作为解析几何（uniform 数组）实时求值 —— 任意缩放都是锐利的，
 *     且能给出解析梯度用于法线，不受贴图分辨率限制；
 *   · 更早的坑被烘焙进等距柱状伤痕图（scar map），作为历史沉积。
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const S = {};

  /* ---------------------- 对数深度缓冲 ------------------------------- */
  S.logdepthVS = `
out float vFragDepth;
#define LOGDEPTH_VS(clip) vFragDepth = 1.0 + clip.w;
`;
  S.logdepthFS = `
in float vFragDepth;
uniform float uLogFC;
#define LOGDEPTH_FS() gl_FragDepth = log2(vFragDepth) * uLogFC * 0.5;
`;

  /* ---------------------- 噪声库 ------------------------------------- */
  S.noise = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

// Ashima Arts 3D simplex noise (MIT)
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

const mat3 ROT1 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float fbm(vec3 p, int oct, float gain){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 10; i++){
    if (i >= oct) break;
    s += a * snoise(p);
    n += a;
    a *= gain;
    p = ROT1 * p * 2.02;
  }
  return s / max(n, 1e-4);
}

float ridged(vec3 p, int oct, float gain){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 10; i++){
    if (i >= oct) break;
    float v = 1.0 - abs(snoise(p));
    v *= v;
    s += a * v;
    n += a;
    a *= gain;
    p = ROT1 * p * 2.07;
  }
  return s / max(n, 1e-4);
}

float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// 天然撞击坑场（"出厂即千疮百孔"的古老表面）
// 抖动限制在 ±0.25 格内，于是最近的坑心必定落在角点周围的 2×2×2 块中，
// 只需搜 8 格而不是 27 格 —— 这是整个片元着色器里最贵的一段，值得省。
float natCraters(vec3 p, float freq, int layers, out float rimMask){
  float total = 0.0; rimMask = 0.0;
  float f = freq, amp = 1.0;
  for (int L = 0; L < 4; L++){
    if (L >= layers) break;
    vec3 q = p * f;
    vec3 corner = floor(q + 0.5);
    float best = 1e9; vec3 bestC = vec3(0.0);
    for (int i = -1; i <= 0; i++)
    for (int j = -1; j <= 0; j++)
    for (int k = -1; k <= 0; k++){
      vec3 c = corner + vec3(float(i), float(j), float(k));
      vec3 jt = vec3(hash13(c), hash13(c + 17.1), hash13(c + 43.7)) - 0.5;
      vec3 site = c + 0.5 + jt * 0.5;
      float d = length(q - site);
      if (d < best){ best = d; bestC = c; }
    }
    float rr = 0.20 + 0.30 * hash13(bestC + 7.3);
    float exists = step(0.44, hash13(bestC + 3.7));
    float t = best / rr;
    float bowl = -(1.0 - clamp(t * t, 0.0, 1.0));
    float rim = exp(-pow((t - 1.0) / 0.32, 2.0)) * 0.6;
    total += amp * exists * (bowl * 0.75 + rim);
    rimMask += amp * exists * rim;
    f *= 2.33; amp *= 0.54;
  }
  return total;
}

vec2 equirect(vec3 d){
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
vec3 fromEquirect(vec2 uv){
  float lon = (uv.x - 0.5) * 6.28318531;
  float lat = (uv.y - 0.5) * 3.14159265;
  float cl = cos(lat);
  return vec3(cos(lon) * cl, sin(lat), sin(lon) * cl);
}
mat3 rotY(float a){
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
`;

  /* ---------------------- 球面光源软阴影（日食） --------------------- */
  S.shadow = `
uniform vec3 uOcc[4];
uniform float uOccR[4];
uniform int uOccCount;

float discOverlap(float sep, float rSun, float rOcc){
  if (sep >= rSun + rOcc) return 0.0;
  if (sep <= abs(rSun - rOcc)) return min(1.0, (rOcc * rOcc) / (rSun * rSun));
  float r1 = rSun, r2 = rOcc, d = max(sep, 1e-7);
  float a1 = clamp((d*d + r1*r1 - r2*r2) / (2.0*d*r1), -1.0, 1.0);
  float a2 = clamp((d*d + r2*r2 - r1*r1) / (2.0*d*r2), -1.0, 1.0);
  float area = r1*r1*acos(a1) + r2*r2*acos(a2)
             - 0.5*sqrt(max(0.0, (-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2)));
  return clamp(area / (3.14159265 * r1 * r1), 0.0, 1.0);
}

float sunVisibility(vec3 pos, vec3 sunPos, float sunR){
  vec3 toSun = sunPos - pos;
  float dSun = length(toSun);
  vec3 ls = toSun / max(dSun, 1e-9);
  float angSun = sunR / max(dSun, 1e-9);
  float vis = 1.0;
  for (int i = 0; i < 4; i++){
    if (i >= uOccCount) break;
    vec3 toOcc = uOcc[i] - pos;
    float dOcc = length(toOcc);
    if (dOcc > dSun * 0.999 || dOcc < 1e-6) continue;
    float angOcc = uOccR[i] / dOcc;
    float sep = acos(clamp(dot(ls, toOcc / dOcc), -1.0, 1.0));
    vis *= 1.0 - discOverlap(sep, angSun, angOcc);
  }
  return clamp(vis, 0.0, 1.0);
}
`;

  /* ---------------------- 解析撞击坑 -------------------------------- */
  S.craters = `
uniform vec4 uCr[4];    // xyz = 撞击点方向(体坐标), w = 最终坑角半径
uniform vec4 uCrA[4];   // x=坑深(m) y=坑缘(m) z=中央峰(m) w=喷出物参考厚度(m)
uniform vec4 uCrB[4];   // x=坑底反照率Δ y=射线纹反照率Δ z=熔融 w=类型(0/1/2)
uniform vec4 uCrC[4];   // x=射线纹伸展 y=随机种子 z=阶地 w=余温0..1
uniform int uCrCount;
uniform float uRadiusM;

// 单个坑的一维剖面（r = 归一化半径）
float crProfile(float r, vec4 A, vec4 B, vec4 C, float rayN, float reach){
  float h = 0.0;
  float type = B.w;
  if (r < 1.0){
    float bowl = 1.0 - r * r;
    if (type < 0.5){
      h -= A.x * pow(max(bowl, 0.0), 0.85);
    } else {
      float floorT = smoothstep(0.0, 0.55, 1.0 - r);
      h -= A.x * mix(pow(max(bowl, 0.0), 1.6), 1.0, floorT * 0.85);
      h += A.x * 0.05 * (sin(r * 24.0) * 0.5 + 0.5) * smoothstep(0.5, 1.0, r) * C.z;
      h += A.z * exp(-pow(r / 0.17, 2.0));
      if (type > 1.5) h += A.z * 0.5 * exp(-pow((r - 0.45) / 0.10, 2.0));
    }
  }
  h += A.y * exp(-pow((r - 1.0) / 0.20, 2.0));
  if (r > 0.85){
    float blanket = smoothstep(reach, 0.9, r);
    h += A.w * pow(max(r, 0.9), -3.0) * blanket * (0.5 + mix(0.25, 1.0, rayN) * 0.9);
  }
  return h;
}

/**
 * 解析求值全部近期撞击坑。
 * 输出：高度增量(m)、切向梯度(m/m)、反照率Δ、喷出物覆盖、熔融、自发光
 */
void craterEval(vec3 p, out float H, out vec3 grad, out float alb,
                out float dust, out float melt, out vec3 glow){
  H = 0.0; grad = vec3(0.0); alb = 0.0; dust = 0.0; melt = 0.0; glow = vec3(0.0);
  for (int i = 0; i < 4; i++){
    if (i >= uCrCount) break;
    vec4 C0 = uCr[i];
    float angR = max(C0.w, 1e-9);
    float cosA = clamp(dot(p, C0.xyz), -1.0, 1.0);
    float ang = acos(cosA);
    float reach = max(uCrC[i].x, 1.5);
    if (ang > angR * reach) continue;

    vec3 out_ = p - C0.xyz * cosA;             // 指向 ang 增大方向的切向
    float sl = length(out_);
    vec3 tdir = sl > 1e-6 ? out_ / sl : vec3(0.0);
    vec3 tt = normalize(cross(abs(C0.y) < 0.98 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), C0.xyz));
    vec3 bb = cross(C0.xyz, tt);
    float az = atan(dot(p, bb), dot(p, tt));
    float rayN = fbm(vec3(cos(az) * 6.0, sin(az) * 6.0, uCrC[i].y), 2, 0.6) * 0.5 + 0.5;
    float lump = 1.0 + (fbm(vec3(cos(az) * 2.0, sin(az) * 2.0, uCrC[i].y * 1.7), 2, 0.55)) * 0.09;

    float r = (ang / angR) * lump;
    float h = crProfile(r, uCrA[i], uCrB[i], uCrC[i], rayN, reach);
    // 解析梯度：只对 r 求差分（噪声项视作方位常量），成本极低
    float dr = 0.006;
    float hp = crProfile(r + dr, uCrA[i], uCrB[i], uCrC[i], rayN, reach);
    float dhdr = (hp - h) / dr;
    H += h;
    grad += tdir * (dhdr / (angR * uRadiusM));

    float blanket = smoothstep(reach, 0.9, r);
    float inner = smoothstep(1.0, 0.4, r);
    alb += uCrB[i].x * inner + uCrB[i].y * (blanket * (0.25 + rayN * 0.95)
         + 0.35 * exp(-pow((r - 1.0) / 0.20, 2.0)));
    dust += clamp(blanket * (0.35 + rayN * 0.7) + 0.35 * inner, 0.0, 1.0);
    melt += uCrB[i].z * smoothstep(1.0, 0.25, r);

    float heat = uCrC[i].w;
    if (heat > 0.002){
      float core = smoothstep(1.05, 0.15, r);
      float cracks = 0.35 + 0.65 * smoothstep(0.35, 0.9, rayN);
      vec3 bb2 = vec3(1.0, pow(heat, 1.4) * 0.8 + 0.06, pow(heat, 3.2) * 0.5);
      glow += bb2 * (core * cracks * heat * heat * 7.0
            + exp(-pow((r - 1.0) / 0.16, 2.0)) * heat * 1.2);
    }
  }
  alb = clamp(alb, -1.0, 2.0);
  dust = clamp(dust, 0.0, 1.0);
  melt = clamp(melt, 0.0, 1.0);
}
`;

  /* ---------------------- 星球表面公共部分 --------------------------- */
  const PLANET_COMMON = `
uniform int   uKind;
uniform float uRadius;
uniform float uRelief;
uniform float uNoiseFreq;
uniform float uRough;
uniform float uOcean;
uniform float uIce;
uniform float uCraterField;
uniform float uBands;
uniform float uStorm;
uniform float uCracks;
uniform float uMare;
uniform float uTime;
uniform float uCloudCover;
uniform float uCloudFreq;
uniform float uCloudSpeed;
uniform int   uOct;
uniform int   uCrLayers;
uniform float uSeed;
uniform float uDust;
uniform float uIceBoost;
uniform float uGreen;
uniform sampler2D uScar;

#define K_SUN 0
#define K_ROCKY 1
#define K_EARTH 2
#define K_VENUS 3
#define K_GAS 4
#define K_ICEGIANT 5
#define K_ICEMOON 6
#define K_VOLCANIC 7
#define K_MARS 8
#define K_DWARF 9

// 地形高度（米），不含解析撞击坑；scar 为烘焙历史伤痕
float terrainHeight(vec3 p, out vec4 scar, out float rimMask){
  rimMask = 0.0;
  scar = texture(uScar, equirect(p));
  if (uKind == K_GAS || uKind == K_ICEGIANT || uKind == K_SUN) return 0.0;

  vec3 q = p * uNoiseFreq + uSeed;
  float cont = fbm(q, uOct, uRough);
  float mount = ridged(q * 2.1 + 11.3, max(uOct - 1, 3), 0.55);
  float h;
  if (uKind == K_EARTH){
    float shelf = smoothstep(-0.05, 0.25, cont);
    h = cont * 0.55 + mount * shelf * 0.5;
  } else if (uKind == K_MARS){
    float bulge = smoothstep(0.15, 0.9, fbm(q * 0.42 + 4.1, 4, 0.5));
    h = cont * 0.45 + mount * 0.3 + bulge * 0.65;
  } else if (uKind == K_ICEMOON){
    float cr = ridged(q * 1.6 + 21.7, max(uOct - 2, 3), 0.5);
    h = cont * 0.28 - pow(cr, 3.0) * uCracks * 0.75;
  } else if (uKind == K_VOLCANIC){
    h = cont * 0.4 + pow(max(fbm(q * 2.8 + 8.8, max(uOct - 2, 3), 0.5), 0.0), 2.0) * 0.85;
  } else {
    h = cont * 0.5 + mount * 0.3;
  }
  if (uCraterField > 0.001 && uCrLayers > 0){
    float rm;
    float cf = natCraters(p + uSeed * 0.7, 5.5, uCrLayers, rm);
    h += cf * uCraterField * 0.5;
    rimMask = rm;
  }
  return h * uRelief + scar.r;
}
`;

  S.planetVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
uniform mat4 uViewProj;
uniform vec3 uOffset;
uniform mat3 uRot;
uniform float uReliefGain;
` + S.noise + S.craters + PLANET_COMMON + S.logdepthVS + `
out vec3 vLocal;
out vec3 vWorld;
void main(){
  vec3 p = normalize(aPos);
  vec4 scar; float rimMask;
  float H = terrainHeight(p, scar, rimMask);
  float ch; vec3 cg; float ca, cd, cm; vec3 cglow;
  craterEval(p, ch, cg, ca, cd, cm, cglow);
  H += ch;
  float rUnits = uRadius + (H * uReliefGain) * 1e-6;
  vLocal = p;
  vWorld = uOffset + uRot * (p * rUnits);
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.planetFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform vec3 uSunPos, uSunColor;
uniform float uSunR, uSunIntensity;
uniform vec3 uColA, uColB, uColC, uOceanCol, uShoreCol, uDustCol;
uniform float uNight, uAtmoThick;
uniform vec3 uAtmoTint;
uniform vec3 uShineCol;      // 行星反照的辐照度（地照等）
uniform vec3 uShineDir;      // 指向母天体的方向（世界坐标）
uniform mat3 uRot;
uniform vec4 uBlot[4];       // 气体行星伤痕：xyz 方向, w 角半径
uniform vec4 uBlotP[4];      // x 深度, y 年龄0..1, z 剪切, w 备用
uniform int uBlotCount;
` + S.noise + S.shadow + S.craters + PLANET_COMMON + S.logdepthFS + `

float cloudField(vec3 p){
  vec3 q = p * uCloudFreq;
  float warp = fbm(q * 0.7 + uTime * 0.006 * uCloudSpeed, 3, 0.5);
  vec3 flow = vec3(uTime * 0.004 * uCloudSpeed, 0.0, 0.0);
  return fbm(q + flow + warp * 0.6, 5, 0.55);
}

void main(){
  vec3 p = normalize(vLocal);
  vec4 scar; float rimMask;
  float h = terrainHeight(p, scar, rimMask);

  // 解析撞击坑：高度 + 切向梯度 + 材质变化 + 余温辉光
  float ch; vec3 cgrad; float cAlb, cDust, cMelt; vec3 cGlow;
  craterEval(p, ch, cgrad, cAlb, cDust, cMelt, cGlow);

  // 地形法线：切空间有限差分（不含解析坑，坑用解析梯度）
  vec3 n = p;
  if (uKind != K_GAS && uKind != K_ICEGIANT){
    vec3 t = normalize(cross(abs(p.y) < 0.98 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0), p));
    vec3 b = cross(p, t);
    float eps = 0.0012;
    vec4 s1, s2; float r1, r2;
    float h1 = terrainHeight(normalize(p + t * eps), s1, r1);
    float h2 = terrainHeight(normalize(p + b * eps), s2, r2);
    float d = eps * uRadiusM;
    vec3 grad = ((h1 - h) / d) * t + ((h2 - h) / d) * b + cgrad;
    n = normalize(p - grad);
  }

  vec3 N = normalize(uRot * n);
  vec3 Ns = normalize(uRot * p);
  vec3 V = normalize(-vWorld);
  vec3 toSun = uSunPos - vWorld;
  float sunDist = length(toSun);
  vec3 L = toSun / sunDist;
  float ndl = dot(N, L);
  float ndlS = dot(Ns, L);

  float relH = (h + ch) / max(uRelief, 1.0);
  float lat = abs(p.y);
  float albedoDelta = clamp(scar.g + cAlb, -1.0, 1.5);
  float dustCover = clamp(scar.b + cDust, 0.0, 1.0);
  float meltCover = clamp(scar.a + cMelt, 0.0, 1.0);

  vec3 albedo = uColA;
  float gloss = 0.0;
  vec3 emissive = cGlow;
  float cloudShadow = 1.0;

  if (uKind == K_EARTH){
    float sea = uOcean * 2.0 - 1.0;
    float land = smoothstep(sea - 0.02, sea + 0.05, relH * 2.0);
    float depth = clamp((sea - relH * 2.0) * 2.0, 0.0, 1.0);
    vec3 water = mix(uShoreCol, uOceanCol, smoothstep(0.0, 0.30, depth));
    float moist = fbm(p * 3.1 + 31.7, 4, 0.5) * 0.5 + 0.5;
    float desert = smoothstep(0.40, 0.10, abs(lat - 0.36)) * smoothstep(0.55, 0.28, moist);
    vec3 veg = mix(uColA, vec3(0.14, 0.20, 0.07), moist * 0.6);
    veg = mix(veg, uColB, desert);
    veg = mix(vec3(0.20, 0.18, 0.15), veg, clamp(uGreen, 0.0, 1.0));
    float rocky = smoothstep(0.35, 0.85, relH * 2.0);
    veg = mix(veg, vec3(0.28, 0.25, 0.22), rocky * 0.8);
    // 雪线：uIceBoost 由一维能量平衡算出（日照下降 → 雪线向赤道推进）
    float iceLine = uIce - uIceBoost;
    float ice = clamp(smoothstep(iceLine - 0.06, iceLine + 0.04, lat)
              + smoothstep(0.60, 0.95, relH * 2.0) * 0.7, 0.0, 1.0);
    albedo = mix(water, veg, land);
    albedo = mix(albedo, uColC, ice * (0.35 + 0.65 * land));
    gloss = mix(0.9, 0.05, land) * (1.0 - ice * 0.7);
    float cover = smoothstep(0.52 - uCloudCover * 0.5, 0.72 - uCloudCover * 0.35, cloudField(p));
    cloudShadow = 1.0 - cover * 0.5;
    float coast = smoothstep(0.0, 0.22, land) * (1.0 - smoothstep(0.16, 0.50, relH * 2.0));
    float city = smoothstep(0.44, 0.78, fbm(p * 24.0 + 7.7, 3, 0.55) * 0.5 + 0.5) * coast * land;
    emissive += vec3(1.0, 0.70, 0.34) * city * uNight * 3.0 * max(0.0, -ndlS - 0.02) * (1.0 - ice);
  } else if (uKind == K_VENUS){
    float v = fbm(p * uNoiseFreq * 1.5 + 5.1, max(uOct - 1, 4), 0.55);
    albedo = mix(uColB, uColA, smoothstep(-0.3, 0.4, v + relH));
    albedo = mix(albedo, uColC, smoothstep(0.35, 0.85, relH * 2.0));
    gloss = 0.03;
  } else if (uKind == K_MARS){
    float d = fbm(p * 5.0 + 2.7, max(uOct - 2, 3), 0.5) * 0.5 + 0.5;
    albedo = mix(uColB, uColA, d);
    float iceLine = uIce - uIceBoost;
    albedo = mix(albedo, uColC, smoothstep(iceLine - 0.04, iceLine + 0.03, lat));
    gloss = 0.03;
  } else if (uKind == K_ICEMOON){
    float cr = ridged(p * uNoiseFreq * 1.6 + 21.7, max(uOct - 2, 4), 0.5);
    float ice = 1.0 - smoothstep(0.18, 0.72, cr * uCracks);
    albedo = mix(uColB, uColA, ice);
    albedo = mix(albedo, uColC, uIce * 0.5);
    gloss = 0.10 + 0.25 * uIce;
  } else if (uKind == K_VOLCANIC){
    float s = fbm(p * uNoiseFreq * 1.4 + 3.3, max(uOct - 1, 4), 0.55) * 0.5 + 0.5;
    albedo = mix(uColB, uColA, s);
    float vent = smoothstep(0.74, 0.96, fbm(p * 6.5 + 55.1, 3, 0.5) * 0.5 + 0.5);
    emissive += vec3(3.0, 0.6, 0.08) * vent * 1.2;
    albedo = mix(albedo, vec3(0.05, 0.04, 0.03), vent * 0.5);
    gloss = 0.04;
  } else if (uKind == K_ROCKY || uKind == K_DWARF){
    float g = fbm(p * uNoiseFreq * 1.8 + 9.1, max(uOct - 1, 4), 0.55) * 0.5 + 0.5;
    albedo = mix(uColB, uColA, g);
    float mare = smoothstep(0.44, 0.64, fbm(p * 1.25 + 3.3, 3, 0.5) * 0.5 + 0.5) * uMare;
    albedo = mix(albedo, uColB * 0.55, mare * smoothstep(0.15, -0.35, relH));
    albedo = mix(albedo, uColC, uIce * smoothstep(0.70, 0.95, lat));
    albedo = mix(albedo, uColC * 0.9, rimMask * 0.3);
    gloss = 0.02;
  } else if (uKind == K_GAS || uKind == K_ICEGIANT){
    float shear = uTime * uCloudSpeed * 0.02;
    vec3 q = rotY(shear * (1.0 - 1.7 * p.y * p.y)) * p;
    float warp = fbm(q * 1.6 + 4.4, 4, 0.55);
    float band = sin(p.y * uBands * 3.14159 + warp * 1.6) * 0.5 + 0.5;
    float fine = fbm(q * vec3(3.0, 13.0, 3.0) * uCloudFreq * 0.32 + 7.7, max(uOct, 5), 0.6);
    float t = clamp(band * 0.75 + fine * 0.35 + 0.2, 0.0, 1.0);
    albedo = mix(uColB, uColA, t);
    albedo = mix(albedo, uColC, smoothstep(0.72, 1.0, t) * 0.8);
    albedo *= mix(1.0, 0.80, smoothstep(0.55, 0.98, lat));
    if (uStorm > 0.01){
      vec3 sd = normalize(vec3(cos(shear * 0.6), -0.42, sin(shear * 0.6)));
      float dlon = atan(q.z, q.x) - atan(sd.z, sd.x);
      dlon = atan(sin(dlon), cos(dlon));
      float dlat = q.y - sd.y;
      float e = length(vec2(dlon * 0.5, dlat * 1.9));
      float spot = smoothstep(0.34, 0.04, e);
      float swirl = fbm(vec3(dlon * 6.0, dlat * 12.0, shear * 3.0), 4, 0.55);
      vec3 sc = uKind == K_GAS ? vec3(0.50, 0.14, 0.06) : vec3(0.03, 0.06, 0.20);
      albedo = mix(albedo, sc * (0.8 + swirl * 0.5), spot * uStorm);
    }
    // 撞击留下的深色气溶胶伤痕（SL9 式）
    for (int i = 0; i < 4; i++){
      if (i >= uBlotCount) break;
      vec3 bd = uBlot[i].xyz;
      float ar = max(uBlot[i].w, 1e-6);
      // 随年龄被环流向东剪切拉长
      float dlon = atan(p.z, p.x) - atan(bd.z, bd.x);
      dlon = atan(sin(dlon), cos(dlon));
      float dlat = p.y - bd.y;
      float stretch = 1.0 + uBlotP[i].z * 6.0;
      float e = length(vec2(dlon / (ar * stretch), dlat / ar));
      float m = smoothstep(1.25, 0.15, e);
      float grain = fbm(vec3(dlon * 14.0, dlat * 22.0, uBlotP[i].y * 4.0), 4, 0.55) * 0.5 + 0.5;
      float dark = uBlotP[i].x * m * (0.55 + grain * 0.85) * (1.0 - uBlotP[i].y);
      albedo = mix(albedo, vec3(0.055, 0.030, 0.018), clamp(dark, 0.0, 0.95));
      // 新鲜伤痕外圈仍在发光
      emissive += vec3(1.0, 0.35, 0.10) * smoothstep(1.0, 0.7, e)
                * max(0.0, 0.25 - uBlotP[i].y) * 4.0;
    }
    gloss = 0.0;
  }

  albedo = mix(albedo, uDustCol, dustCover * 0.8);
  albedo *= (1.0 + albedoDelta * 0.85);
  albedo = mix(albedo, vec3(0.035, 0.030, 0.026), meltCover * 0.7);
  albedo = max(albedo, vec3(0.004));
  albedo = mix(albedo, albedo * vec3(0.78, 0.64, 0.56), clamp(uDust * 0.5, 0.0, 0.85));

  /* ---------------- 光照 ---------------- */
  float vis = sunVisibility(vWorld, uSunPos, uSunR);
  float irr = uSunIntensity / max(sunDist * sunDist, 1e-9);
  // 气体行星的"wrap"来自大气多次散射，岩质天体几乎没有
  float wrap = (uKind == K_GAS || uKind == K_ICEGIANT) ? 0.20 : 0.02;
  float diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
  // 晨昏线：夜面就是黑的（没有虚假的环境光底噪）
  diff *= smoothstep(-0.03, 0.07, ndlS);
  vec3 light = uSunColor * irr * vis;
  vec3 col = albedo * light * diff * cloudShadow;

  if (gloss > 0.01){
    vec3 Hv = normalize(L + V);
    float sp = pow(max(dot(N, Hv), 0.0), mix(26.0, 700.0, gloss));
    col += light * sp * gloss * vis * smoothstep(-0.05, 0.22, ndlS) * 1.5;
  }

  // 行星反照（如地照 earthshine）：母天体把阳光反射到卫星夜面上，
  // 强度 = 母天体反照率 × 其所受辐照度 × (R_母/d)²，是真实可测的效应
  col += albedo * uShineCol * clamp(dot(N, uShineDir), 0.0, 1.0);

  // 大气在地表附近的散射补光（贴合限边的柔光）
  float limb = 1.0 - clamp(dot(V, Ns), 0.0, 1.0);
  col += uAtmoTint * light * uAtmoThick * 0.04 * pow(limb, 3.0)
       * smoothstep(-0.10, 0.30, ndlS);

  col += emissive;

  fragColor = vec4(col, 1.0);
  LOGDEPTH_FS()
}
`;

  /* ---------------------- 云层壳 ------------------------------------ */
  S.cloudVS = `#version 300 es
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

  S.cloudFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;
uniform vec3 uSunPos, uSunColor, uCloudCol;
uniform float uSunR, uSunIntensity, uCloudCover, uCloudFreq, uCloudSpeed, uTime, uDust;
uniform mat3 uRot;
uniform int uKind;
` + S.noise + S.shadow + S.logdepthFS + `
void main(){
  vec3 p = normalize(vLocal);
  vec3 N = normalize(uRot * p);
  vec3 toSun = uSunPos - vWorld;
  float sunDist = length(toSun);
  vec3 L = toSun / sunDist;

  vec3 q = p * uCloudFreq;
  float warp = fbm(q * 0.8 + uTime * 0.005 * uCloudSpeed, 3, 0.5);
  vec3 flow = vec3(uTime * 0.0035 * uCloudSpeed, 0.0, 0.0);
  float band = uKind == 3 ? sin(p.y * 14.0 + warp * 3.0) * 0.10 : 0.0;
  float c = fbm(q + flow + warp * 0.7, 6, 0.55) + band;
  float cover = smoothstep(0.50 - uCloudCover * 0.55, 0.74 - uCloudCover * 0.30, c);
  if (cover < 0.004) discard;

  float ndl = dot(N, L);
  float vis = sunVisibility(vWorld, uSunPos, uSunR);
  float irr = uSunIntensity / max(sunDist * sunDist, 1e-9);
  float lit = clamp((ndl + 0.30) / 1.30, 0.0, 1.0);
  lit *= mix(0.05, 1.0, smoothstep(-0.18, 0.22, ndl));
  vec3 V = normalize(-vWorld);
  float fwd = pow(clamp(dot(V, -L), 0.0, 1.0), 6.0) * 0.5;
  vec3 col = uCloudCol * uSunColor * irr * vis * (lit * 1.05 + fwd);
  col = mix(col, col * vec3(0.85, 0.74, 0.68), clamp(uDust * 0.5, 0.0, 0.8));
  float limb = 1.0 - abs(dot(V, N));
  float alpha = clamp(cover * 0.94 * (1.0 + limb * 0.7), 0.0, 1.0);
  fragColor = vec4(col, alpha);
  LOGDEPTH_FS()
}
`;

  /* ---------------------- 大气单次散射 ------------------------------ */
  S.atmoVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
uniform mat4 uViewProj;
uniform vec3 uOffset;
uniform float uShellRadius;
` + S.logdepthVS + `
out vec3 vWorld;
void main(){
  vWorld = uOffset + normalize(aPos) * uShellRadius;
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.atmoFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;
uniform vec3 uOffset;
uniform vec3 uSunPos, uSunColor;
uniform float uSunR, uSunIntensity;
uniform float uRadius, uShellRadius, uHR, uBetaM, uDust;
uniform vec3 uBetaR;
` + S.shadow + S.logdepthFS + `
vec2 raySphere(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main(){
  vec3 ro = -uOffset;                 // 相机在星球坐标系中的位置
  vec3 rd = normalize(vWorld);        // 相机位于原点
  vec2 tShell = raySphere(ro, rd, uShellRadius);
  if (tShell.y <= 0.0) discard;
  float t0 = max(tShell.x, 0.0);
  float t1 = tShell.y;
  vec2 tG = raySphere(ro, rd, uRadius);
  if (tG.x > 0.0) t1 = min(t1, tG.x);
  if (t1 <= t0) discard;

  const int STEPS = 12;
  const int LSTEPS = 4;
  float HR = max(uHR, 1e-7);
  float HM = HR * 0.35;
  float seg = (t1 - t0) / float(STEPS);
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odVR = 0.0, odVM = 0.0;
  float dustK = 1.0 + uDust * 1.4;

  for (int i = 0; i < STEPS; i++){
    float t = t0 + seg * (float(i) + 0.5);
    vec3 pos = ro + rd * t;
    float alt = max(length(pos) - uRadius, 0.0);
    float dR = exp(-alt / HR) * dustK;
    float dM = exp(-alt / HM) * dustK;
    odVR += dR * seg;
    odVM += dM * seg;
    vec3 world = pos + uOffset;
    vec3 ls = normalize(uSunPos - world);
    if (raySphere(pos, ls, uRadius).x > 0.0) continue;
    vec2 tl = raySphere(pos, ls, uShellRadius);
    if (tl.y <= 0.0) continue;
    float lseg = tl.y / float(LSTEPS);
    float odLR = 0.0, odLM = 0.0;
    for (int j = 0; j < LSTEPS; j++){
      vec3 lp = pos + ls * (lseg * (float(j) + 0.5));
      float la = max(length(lp) - uRadius, 0.0);
      odLR += exp(-la / HR) * lseg * dustK;
      odLM += exp(-la / HM) * lseg * dustK;
    }
    vec3 tr = exp(-(uBetaR * (odVR + odLR) + vec3(uBetaM * 1.1 * (odVM + odLM))));
    float vis = sunVisibility(world, uSunPos, uSunR);
    sumR += tr * dR * seg * vis;
    sumM += tr * dM * seg * vis;
  }

  vec3 toSunV = normalize(uSunPos - vWorld);
  float mu = dot(rd, toSunV);
  float phaseR = 0.0596831 * (1.0 + mu * mu);
  float g = 0.76;
  float phaseM = (1.0 - g * g) / (12.5663706 * pow(max(1.0 + g * g - 2.0 * g * mu, 1e-4), 1.5));
  float sunDist = length(uSunPos - vWorld);
  float irr = uSunIntensity / max(sunDist * sunDist, 1e-9);
  vec3 col = uSunColor * irr * (sumR * uBetaR * phaseR + sumM * uBetaM * phaseM * 1.4);
  col = mix(col, col * vec3(1.25, 0.80, 0.55), clamp(uDust * 0.7, 0.0, 0.9));
  fragColor = vec4(col, 1.0);
  LOGDEPTH_FS()
}
`;

  /* ---------------------- 行星环 ------------------------------------ */
  S.ringVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec4 aPos;
uniform mat4 uViewProj;
uniform vec3 uOffset;
uniform mat3 uRot;
uniform float uRadius;
` + S.logdepthVS + `
out vec3 vWorld;
out float vR;
void main(){
  vR = aPos.w;
  vWorld = uOffset + uRot * (aPos.xyz * uRadius);
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.ringFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vWorld;
in float vR;
layout(location = 0) out vec4 fragColor;
uniform vec3 uOffset, uSunPos, uSunColor, uRingCol;
uniform float uSunR, uSunIntensity, uRadius, uInner, uOuter, uOpacity, uSeed;
` + S.noise + S.shadow + S.logdepthFS + `
void main(){
  float t = (vR - uInner) / max(uOuter - uInner, 1e-5);
  if (t < 0.0 || t > 1.0) discard;
  float bands = fbm(vec3(t * 46.0, uSeed, 0.0), 5, 0.62) * 0.5 + 0.5;
  float fine = fbm(vec3(t * 210.0, uSeed * 2.0, 0.0), 3, 0.55) * 0.5 + 0.5;
  float dens = smoothstep(0.015, 0.10, t) * (1.0 - smoothstep(0.88, 1.0, t));
  dens *= 0.35 + 0.65 * bands;
  dens *= 0.75 + 0.25 * fine;
  dens *= 1.0 - 0.92 * exp(-pow((t - 0.66) / 0.022, 2.0));   // 卡西尼缝
  dens *= 1.0 - 0.55 * exp(-pow((t - 0.23) / 0.015, 2.0));
  dens *= 1.0 - 0.45 * exp(-pow((t - 0.95) / 0.008, 2.0));   // 恩克缝
  dens = clamp(dens, 0.0, 1.0) * uOpacity;
  if (dens < 0.002) discard;

  vec3 pc = vWorld - uOffset;
  vec3 toSun = uSunPos - vWorld;
  float sunDist = length(toSun);
  vec3 L = toSun / sunDist;
  float b = dot(pc, L);
  float shadow = 1.0;
  if (b < 0.0){
    float d2 = dot(pc, pc) - b * b;
    shadow = smoothstep(uRadius * uRadius * 0.92, uRadius * uRadius * 1.25, d2);
  }
  float vis = sunVisibility(vWorld, uSunPos, uSunR) * shadow;
  vec3 V = normalize(-vWorld);
  float irr = uSunIntensity / max(sunDist * sunDist, 1e-9);
  float mu = dot(V, -L);
  float fwd = 0.35 + 0.95 * pow(clamp(mu, 0.0, 1.0), 3.0);
  vec3 col = uRingCol * uSunColor * irr * vis * fwd * 1.7;
  float alpha = clamp(dens * (0.55 + 0.45 * fwd), 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
  LOGDEPTH_FS()
}
`;

  /* ---------------------- 恒星 -------------------------------------- */
  S.sunVS = `#version 300 es
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

  S.sunFS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;
uniform vec3 uColA, uColB, uColC;
uniform float uTime, uIntensity;
uniform mat3 uRot;
` + S.noise + S.logdepthFS + `
void main(){
  vec3 p = normalize(vLocal);
  float t = uTime * 0.05;
  float gran = fbm(p * 46.0 + vec3(t * 0.4, t * 0.2, -t * 0.3), 4, 0.55);
  float superg = fbm(p * 8.0 + vec3(-t * 0.15, t * 0.1, t * 0.2), 4, 0.5);
  float g = gran * 0.55 + superg * 0.75;
  float spot = smoothstep(0.60, 0.86, fbm(p * 3.2 + 17.3, 4, 0.5) * 0.5 + 0.5);
  spot *= smoothstep(0.55, 0.12, abs(p.y));
  vec3 col = mix(uColB, uColA, clamp(g * 0.5 + 0.55, 0.0, 1.0));
  col = mix(col, uColC * 0.22, spot * 0.85);
  vec3 V = normalize(-vWorld);
  vec3 N = normalize(uRot * p);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  col *= 0.34 + 0.66 * pow(mu, 0.62);
  col += uColC * pow(1.0 - mu, 5.0) * 0.6;
  fragColor = vec4(col * uIntensity, 1.0);
  LOGDEPTH_FS()
}
`;

  S.coronaVS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPos;
uniform mat4 uViewProj;
uniform vec3 uOffset, uCamRight, uCamUp;
uniform float uSize;
` + S.logdepthVS + `
out vec2 vUV;
out vec3 vWorld;
void main(){
  vUV = aPos;
  vWorld = uOffset + (uCamRight * aPos.x + uCamUp * aPos.y) * uSize;
  vec4 clip = uViewProj * vec4(vWorld, 1.0);
  LOGDEPTH_VS(clip)
  gl_Position = clip;
}
`;

  S.coronaFS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
in vec3 vWorld;
layout(location = 0) out vec4 fragColor;
uniform vec3 uColA, uColC;
uniform float uTime, uIntensity, uCoreFrac;
` + S.noise + S.logdepthFS + `
void main(){
  float r = length(vUV);
  if (r > 1.0) discard;
  float ang = atan(vUV.y, vUV.x);
  float streamer = fbm(vec3(cos(ang) * 2.4, sin(ang) * 2.4, uTime * 0.02), 4, 0.55) * 0.5 + 0.5;
  float rr = max(r, uCoreFrac);
  float fall = pow(uCoreFrac / rr, 2.6);
  float wisp = pow(uCoreFrac / rr, 1.35) * (0.35 + streamer * 0.9);
  float a = clamp(fall * 1.1 + wisp * 0.5, 0.0, 4.0) * smoothstep(1.0, 0.70, r);
  vec3 col = mix(uColC, uColA, clamp(fall, 0.0, 1.0)) * a * uIntensity;
  fragColor = vec4(col, 1.0);
  LOGDEPTH_FS()
}
`;

  SS.SH = S;
  S.planetCommon = PLANET_COMMON;
})(window);
