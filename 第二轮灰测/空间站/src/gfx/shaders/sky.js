/**
 * gfx/shaders/sky.js —— 深空环境着色器
 *
 * 全屏一次绘制即完成：
 *   · 三层程序化星场（含色温差异与闪烁）
 *   · 银河带 + 星云（fbm 体噪声投影）
 *   · 解析法求交的地球（程序化大陆/海洋/云层/极冰/夜面城市灯光/大气散射边缘）
 *   · 太阳圆盘与多层光晕
 * 全部为解析式，无需任何几何体与贴图。
 */

import { NOISE } from './common.js';

export const skyVS = /* glsl */`
precision highp float;
layout(location = 0) in vec2 aPos;
uniform mat4 uInvViewProj;
out vec3 vRay;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  vec4 n = uInvViewProj * vec4(aPos, -1.0, 1.0);
  vec4 f = uInvViewProj * vec4(aPos,  1.0, 1.0);
  vRay = f.xyz / f.w - n.xyz / n.w;
  gl_Position = vec4(aPos, 1.0, 1.0);   // 深度写在远平面
}
`;

export const skyFS = /* glsl */`
precision highp float;
${NOISE}

in vec3 vRay;
in vec2 vUV;

uniform vec3  uCamPos;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uTime;
uniform vec3  uEarthCenter;
uniform float uEarthRadius;
uniform float uStarBoost;
uniform float uNebulaBoost;
uniform float uEarthOn;
uniform vec3  uGalaxyAxis;

layout(location = 0) out vec4 oColor;

/* ── 星场 ──────────────────────────────────────────────────────────
   把方向向量量化到立方格，每格按散列决定是否放一颗恒星。

   关键点：判据必须用「格单位」的距离，而不是裸角距。
   d*scale 落入的格子，其中心与 d 的角距天然只有 ~1/scale，
   若直接用 exp(-角距 × 常数) 作衰减，每个像素都会命中最近格而让整片天空发亮。
   这里改为 dist = |d - dir| * scale（单位：格），恒星半径也以格为单位给出，
   于是恒星尺寸与格密度解耦，任何 scale 下都是干净的点光源。
   radius 取值保证在常见分辨率下恒星至少覆盖约一个像素，避免闪烁走样。 */
vec3 starColor(float t){
  // 由蓝白到橙红的近似色温序列
  return mix(mix(vec3(0.62, 0.74, 1.00), vec3(1.0), smoothstep(0.0, 0.45, t)),
             vec3(1.00, 0.78, 0.58), smoothstep(0.55, 1.0, t));
}

float starField(vec3 d, float scale, float thresh, float radius, out vec3 tint){
  vec3 p = d * scale;
  vec3 base = floor(p);
  float acc = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 8; i++){
    vec3 o = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 c = base + o;
    float h = hash31(c + 0.5);
    if (h < thresh) continue;
    vec3 jitter = hash33(c * 1.37 + 5.1);
    vec3 dir = normalize(c + jitter);
    float dist = length(d - dir) * scale;              // 单位：格
    float mag = (h - thresh) / max(1.0 - thresh, 1e-4);  // 0..1 视星等
    float r = radius * (0.45 + 0.55 * mag);
    float core = exp(-(dist * dist) / max(r * r, 1e-8));
    float halo = exp(-dist / (r * 7.0)) * 0.10;
    float tw = 0.80 + 0.20 * sin(uTime * (1.1 + jitter.x * 3.0) + jitter.y * 40.0);
    float b = (core + halo) * (0.25 + 1.6 * mag * mag) * tw;
    acc += b;
    col += starColor(jitter.z) * b;
  }
  tint = acc > 1e-5 ? col / acc : vec3(1.0);
  return acc;
}

/* ── 地球表面 ── */
vec3 earthShade(vec3 N, vec3 D, float lodFade){
  float cont = fbm3(N * 2.05 + vec3(4.3, 1.7, 9.2), 5);
  float detail = fbm3(N * 7.3 + vec3(11.0), 4);
  float land = smoothstep(0.498, 0.545, cont + detail * 0.085);
  float lat = abs(N.y);

  vec3 deep  = vec3(0.006, 0.026, 0.082);
  vec3 shelf = vec3(0.020, 0.095, 0.200);
  vec3 ocean = mix(deep, shelf, smoothstep(0.40, 0.50, cont));

  vec3 veg  = mix(vec3(0.045, 0.135, 0.048), vec3(0.115, 0.185, 0.070), detail);
  vec3 des  = mix(vec3(0.34, 0.26, 0.145), vec3(0.42, 0.34, 0.20), detail);
  vec3 tund = vec3(0.215, 0.215, 0.195);
  float aridity = smoothstep(0.10, 0.32, abs(sin(lat * 5.3 + cont * 2.0)));
  vec3 landC = mix(veg, des, aridity);
  landC = mix(landC, tund, smoothstep(0.52, 0.76, lat));
  // 山脉高光
  landC += vec3(0.06) * smoothstep(0.62, 0.80, detail) * land;

  float ice = smoothstep(0.795, 0.925, lat + fbm3(N * 6.0, 3) * 0.07);
  vec3 albedo = mix(ocean, landC, land);
  albedo = mix(albedo, vec3(0.86, 0.905, 0.955), ice);

  /* 云层：两层不同速度，制造流动感 */
  float c1 = fbm3(N * 3.1 + vec3(uTime * 0.0032, 0.0, uTime * 0.0011), 5);
  float c2 = fbm3(N * 6.4 + vec3(-uTime * 0.0048, 1.3, 0.0), 4);
  float cloud = smoothstep(0.50, 0.70, c1 * 0.75 + c2 * 0.35) * lodFade;
  albedo = mix(albedo, vec3(0.94, 0.96, 1.0), cloud * 0.92);

  /* 光照 */
  float sn = dot(N, uSunDir);
  float day = smoothstep(-0.14, 0.26, sn);
  // 系数取 1.05：云顶反照率接近 0.95，再乘更大的系数会直接削顶、丢掉云层层次
  vec3 lit = albedo * uSunColor * max(sn, 0.0) * 1.05;
  // 海面镜面反光
  vec3 R = reflect(-D, N);
  float glint = pow(max(dot(R, uSunDir), 0.0), 220.0) * (1.0 - land) * (1.0 - cloud);
  lit += uSunColor * glint * 2.6;
  // 大气瑞利散射（正面偏蓝，掠射偏青）
  float rim = pow(1.0 - max(dot(N, -D), 0.0), 2.6);
  lit += vec3(0.16, 0.36, 0.78) * rim * day * 1.5;
  // 夜面：城市灯光 + 极光暗示
  float nightMask = 1.0 - day;
  float cityNoise = smoothstep(0.60, 0.80, fbm3(N * 22.0, 3)) * smoothstep(0.55, 0.75, fbm3(N * 5.0 + 3.0, 3));
  vec3 night = vec3(1.0, 0.72, 0.36) * cityNoise * land * (1.0 - cloud * 0.7) * 1.5;
  night += vec3(0.10, 0.55, 0.35) * smoothstep(0.72, 0.95, lat) * (0.4 + 0.6 * fbm3(N * 9.0 + uTime * 0.02, 3));
  lit += night * nightMask;
  lit += albedo * vec3(0.012, 0.020, 0.040) * nightMask;   // 星光/月光微弱补光
  return lit;
}

void main(){
  vec3 D = normalize(vRay);
  vec3 col = vec3(0.0);

  /* ── 银河带与星云 ──
     标定依据：ACES + sRGB 传递曲线下，线性 0.010 约对应 sRGB 15/255，
     线性 0.031 约对应 40/255。因此把「空旷深空」定在 ~0.010、
     「银河带内」定在 ~0.031，既能看出层次又不会把背景糊亮。 */
  vec3 gAxis = normalize(uGalaxyAxis);
  float band = abs(dot(D, gAxis));
  float galaxy = exp(-band * band * 14.0);
  float nb = fbm3(D * 2.4 + 7.0, 5);
  float nb2 = fbm3(D * 6.1 - 3.0, 4);
  vec3 neb = vec3(0.010, 0.014, 0.032) * nb
           + vec3(0.020, 0.008, 0.024) * pow(nb2, 2.0)
           + vec3(0.005, 0.015, 0.021) * pow(nb, 3.0);
  col += neb * uNebulaBoost * (0.18 + 1.10 * galaxy);
  // 银河的弥散恒星背景（未分解的暗星积分光）
  col += vec3(0.030, 0.032, 0.042) * galaxy * (0.15 + 0.85 * nb) * uNebulaBoost;

  /* ── 三层星场（近→远：亮星、常规、暗尘） ── */
  float dense = 1.0 + galaxy * 2.2;
  vec3 t1, t2, t3;
  float s1 = starField(D, 52.0,  0.9720, 0.150, t1);
  float s2 = starField(D, 112.0, 0.9560, 0.105, t2);
  float s3 = starField(D, 236.0, 0.9760, 0.080, t3);
  col += (t1 * s1 * 1.55 + t2 * s2 * 0.95 + t3 * s3 * 0.55 * dense) * uStarBoost;

  /* ── 地球（解析射线-球求交） ── */
  if (uEarthOn > 0.5){
    vec3 oc = uCamPos - uEarthCenter;
    float b = dot(oc, D);
    float cc = dot(oc, oc) - uEarthRadius * uEarthRadius;
    float disc = b * b - cc;
    if (disc > 0.0 && b < 0.0){
      float t = -b - sqrt(disc);
      if (t > 0.0){
        vec3 P = uCamPos + D * t;
        vec3 N = normalize(P - uEarthCenter);
        col = earthShade(N, D, 1.0);
      }
    }
    /* 大气辉光：按射线到球心的垂距分布，集中在临边 */
    if (b < 0.0){
      float perp = sqrt(max(dot(oc, oc) - b * b, 0.0));
      float R = uEarthRadius;
      float outer = smoothstep(R * 0.988, R, perp) * (1.0 - smoothstep(R, R * 1.085, perp));
      float limb  = smoothstep(R * 0.78, R, perp) * (1.0 - smoothstep(R, R * 1.06, perp));
      vec3 limbN = normalize(oc - D * b);
      float lit = smoothstep(-0.35, 0.45, dot(limbN, uSunDir));
      col += vec3(0.22, 0.48, 1.00) * outer * 2.6 * lit;
      col += vec3(0.12, 0.30, 0.85) * limb * 0.55 * lit;
    }
  }

  /* ── 太阳：一个会被 Bloom 拉出眩光的过曝圆盘 + 三层收敛的光晕 ──
     圆盘亮度不宜过高：它会经亮度提取进入 6 级 Bloom 链，数值过大时
     整幅画面都会被泛光抬亮（这正是"深空变灰"的常见成因）。 */
  float sd = dot(D, uSunDir);
  float discMask = smoothstep(0.99976, 0.99990, sd);
  col += uSunColor * discMask * 18.0;
  col += uSunColor * pow(max(sd, 0.0), 2200.0) * 6.0;
  col += uSunColor * pow(max(sd, 0.0), 320.0) * 0.42;
  col += uSunColor * pow(max(sd, 0.0), 40.0) * 0.030;

  oColor = vec4(max(col, 0.0), 1.0);
}
`;
