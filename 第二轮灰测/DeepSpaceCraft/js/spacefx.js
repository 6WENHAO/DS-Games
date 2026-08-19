/* DEEP SPACE CRAFT · spacefx.js —— 太空视觉模块（星空 / 星云 / 银河 / 星球 / 恒星 / 曲速隧道 / 太空尘埃）
 * 契约见 SPEC.md §8：
 *  - 加载零副作用，所有 program/mesh 在 init() 里创建（幂等）；
 *  - 只经 DSC.GL.* 创建 GL 资源；uniform 一律 prog.set()（缺失静默跳过）；
 *  - 每个 draw 进入时假设 depth on/write on, blend off, cull back，退出前必须还原；
 *  - GLSL 全部为 WebGL2 GLSL ES 3.00（#version 300 es 首行），禁 varying/attribute/gl_FragColor/texture2D。
 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var Util = DSC.Util || {};
  var M4 = DSC.M4, V3 = DSC.V3;

  /* ================================================================
   * 共享 GLSL 噪声代码（零纹理、纯哈希 value noise；拼进各片元着色器）
   * ================================================================ */
  var NOISE = [
    '// ---- 共享程序化噪声：value noise / fbm / ridged（零纹理，纯哈希） ----',
    'float hash(vec3 p){',
    '  p = fract(p * 0.1031);',
    '  p += dot(p, p.zyx + 31.32);',
    '  return fract((p.x + p.y) * p.z);',
    '}',
    'vec3 hash3(vec3 p){',
    '  p = fract(p * 0.1031);',
    '  p += dot(p, p.zyx + 33.32);',
    '  return fract(vec3((p.x + p.y) * p.z, (p.x + p.z) * p.y, (p.y + p.z) * p.x));',
    '}',
    '// 3D 值噪声（8 角点三线性）',
    'float vnoise(vec3 p){',
    '  vec3 i = floor(p), f = fract(p);',
    '  vec3 u = f * f * (3.0 - 2.0 * f);',
    '  float a = mix(hash(i), hash(i + vec3(1,0,0)), u.x);',
    '  float b = mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x);',
    '  float c = mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x);',
    '  float d = mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x);',
    '  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);',
    '}',
    '// 带梯度的 3D 值噪声：x=值，yzw=梯度（行星法线扰动用）',
    'vec4 vnoiseG(vec3 p){',
    '  vec3 i = floor(p), f = p - i;',
    '  vec3 u = f * f * (3.0 - 2.0 * f);',
    '  vec3 du = 6.0 * f * (1.0 - f);',
    '  float n000 = hash(i);',
    '  float n100 = hash(i + vec3(1,0,0));',
    '  float n010 = hash(i + vec3(0,1,0));',
    '  float n001 = hash(i + vec3(0,0,1));',
    '  float n110 = hash(i + vec3(1,1,0));',
    '  float n101 = hash(i + vec3(1,0,1));',
    '  float n011 = hash(i + vec3(0,1,1));',
    '  float n111 = hash(i + vec3(1,1,1));',
    '  float a = mix(n000, n100, u.x), da = (n100 - n000) * du.x;',
    '  float b = mix(n010, n110, u.x), db = (n110 - n010) * du.x;',
    '  float c = mix(n001, n101, u.x), dc = (n101 - n001) * du.x;',
    '  float d = mix(n011, n111, u.x), dd = (n111 - n011) * du.x;',
    '  float e = mix(a, b, u.y), de = (b - a) * du.y;',
    '  float g = mix(c, d, u.y), dg = (d - c) * du.y;',
    '  float v = mix(e, g, u.z), dv = (g - e) * du.z;',
    '  return vec4(v, da, de, dv);',
    '}',
    '// 2D 值噪声',
    'float vnoise2(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = mix(hash(vec3(i, 0.0)), hash(vec3(i + vec2(1,0), 0.0)), u.x);',
    '  float b = mix(hash(vec3(i + vec2(0,1), 0.0)), hash(vec3(i + vec2(1,1), 0.0)), u.x);',
    '  return mix(a, b, u.y);',
    '}',
    '// fbm 3D（octave 由 uniform 控制，上限 8 层）',
    'float fbm3(vec3 p, float oct){',
    '  float v = 0.0, amp = 0.5, fq = 1.0;',
    '  for (int i = 0; i < 8; i++){',
    '    if (float(i) >= oct) break;',
    '    v += vnoise(p * fq) * amp;',
    '    amp *= 0.5; fq *= 2.13;',
    '  }',
    '  return v;',
    '}',
    '// fbm 2D',
    'float fbm2(vec2 p, float oct){',
    '  float v = 0.0, amp = 0.5, fq = 1.0;',
    '  for (int i = 0; i < 8; i++){',
    '    if (float(i) >= oct) break;',
    '    v += vnoise2(p * fq) * amp;',
    '    amp *= 0.5; fq *= 2.13;',
    '  }',
    '  return v;',
    '}',
    '// ridged 3D：丝状/纤维感（星云边缘、山脉）',
    'float ridged(vec3 p, float oct){',
    '  float v = 0.0, amp = 0.5, fq = 1.0;',
    '  for (int i = 0; i < 8; i++){',
    '    if (float(i) >= oct) break;',
    '    float n = vnoise(p * fq);',
    '    v += (1.0 - abs(2.0 * n - 1.0)) * amp;',
    '    amp *= 0.5; fq *= 2.17;',
    '  }',
    '  return v;',
    '}',
    '// ridged 2D',
    'float ridged2(vec2 p, float oct){',
    '  float v = 0.0, amp = 0.5, fq = 1.0;',
    '  for (int i = 0; i < 8; i++){',
    '    if (float(i) >= oct) break;',
    '    float n = vnoise2(p * fq);',
    '    v += (1.0 - abs(2.0 * n - 1.0)) * amp;',
    '    amp *= 0.5; fq *= 2.17;',
    '  }',
    '  return v;',
    '}',
    '// fbm + 梯度（行星高度场与法线一次算清）',
    'vec4 fbmG(vec3 p, float oct){',
    '  float v = 0.0;',
    '  vec3 g = vec3(0.0);',
    '  float amp = 0.5, fq = 1.0;',
    '  for (int i = 0; i < 8; i++){',
    '    if (float(i) >= oct) break;',
    '    vec4 n = vnoiseG(p * fq);',
    '    v += n.x * amp;',
    '    g += n.yzw * amp * fq;',
    '    amp *= 0.5; fq *= 2.13;',
    '  }',
    '  return vec4(v, g);',
    '}'
  ].join('\n');

  /* ================================================================
   * 背景（星空/星云/银河）：全屏三角形 + invViewProj 反投影视线方向
   * ================================================================ */
  var VS_BG = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 a_pos;',
    'uniform mat4 uInvViewProj;',
    'out vec4 vWorld;',
    'void main(){',
    '  // 反投影到世界远平面：相机平移时每像素视线方向随之改变 → 星星钉在天空不抖动',
    '  vWorld = uInvViewProj * vec4(a_pos, 1.0, 1.0);',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_BG = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 vWorld;',
    'uniform vec3 uCamPos;',
    'uniform float uTime;',
    'uniform float uSeedF;',
    'uniform float uStarDensity;',
    'uniform float uExposure;',
    'uniform float uFade;',
    'uniform vec3 uNebA;',
    'uniform vec3 uNebB;',
    'uniform float uNebIntensity;',
    'uniform mat3 uRot1;',
    'uniform mat3 uRot2;',
    'uniform mat3 uRot3;',
    'uniform vec3 uGalAxis;',
    'uniform float uGalWidth;',
    'uniform float uGalIntensity;',
    'uniform vec3 uGalOff;',
    'uniform float uOctN;',
    'uniform float uOctG;',
    'out vec4 fragColor;',
    NOISE,
    '// 方向 → 等距柱状 uv（经度环绕无缝；asin 保证星点密度均匀）',
    'vec2 dirUV(vec3 rd, float shift){',
    '  float u = atan(rd.z, rd.x) * 0.159154943 + 0.5 + shift;',
    '  float v = asin(clamp(rd.y, -1.0, 1.0)) * 0.318309886 + 0.5;',
    '  return vec2(fract(u), v);',
    '}',
    '// 一层星点网格：每格哈希一个候选星（位+属性），9 邻域采样保证跨格无缝；',
    '// 距离用"延伸域"公式 |starPos + o - f|，在经度环绕缝上同样精确。',
    'float starLayer(vec3 rd, vec2 uv, float grid, float dens, float sizeR, float brightMul, float shift, out float flare){',
    '  vec2 uvN = uv * grid;',
    '  vec2 c = floor(uvN);',
    '  vec2 f = fract(uvN);',
    '  float total = 0.0;',
    '  flare = 0.0;',
    '  float th = 0.92 - 0.60 * dens;',
    '  for (int oy = -1; oy <= 1; oy++){',
    '    for (int ox = -1; ox <= 1; ox++){',
    '      vec2 o = vec2(float(ox), float(oy));',
    '      vec2 cc = c + o;',
    '      cc.x = mod(cc.x, grid);',
    '      cc.y = clamp(cc.y, 0.0, grid - 1.0);',
    '      vec3 h = hash3(vec3(cc, shift));',
    '      float has = smoothstep(th, th + 0.22, h.z);',
    '      vec2 d = (h.xy + o) - f;',
    '      float g = 1.0 - smoothstep(0.0, sizeR, length(d));',
    '      total += g * has * brightMul;',
    '      // 亮星（约 5%~10%）带十字星芒：细长横向+纵向衍射尖',
    '      float isBright = step(0.9, h.z);',
    '      float fl = isBright * has;',
    '      if (fl > 0.5){',
    '        vec2 duv = d / grid;',
    '        float hx = exp(-abs(duv.y) * 3000.0) * exp(-abs(duv.x) * 400.0);',
    '        float hy = exp(-abs(duv.x) * 3000.0) * exp(-abs(duv.y) * 400.0);',
    '        flare += (hx + hy) * 0.55;',
    '      }',
    '    }',
    '  }',
    '  return total;',
    '}',
    'void main(){',
    '  vec3 rd = normalize(vWorld.xyz / vWorld.w - uCamPos);',
    '  // 极暗深空底色（#04060c 级别蓝黑，绝不纯黑）',
    '  vec3 base = vec3(0.014, 0.021, 0.042);',
    '  vec3 col = base;',
    '  // ---- 星云：fbm 主体 + 域扭曲 + ridged 丝状纤维边缘，双色混合 ----',
    '  vec3 np = rd * 1.1 + vec3(uSeedF * 3.7, uSeedF * 1.3, uSeedF * 5.1);',
    '  np.x += uTime * 0.0015;',
    '  float w = vnoise(np);',
    '  np += (w - 0.5) * 0.55;',
    '  float n = fbm3(np, uOctN);',
    '  float r = ridged(np * 1.65 + vec3(uSeedF * 9.2, 0.0, uSeedF * 4.4), 2.0);',
    '  float nebMask = smoothstep(-0.55, 0.62, n);',
    '  float fib = pow(r, 3.0);',
    '  vec3 neb = mix(uNebA, uNebB, clamp(smoothstep(0.0, 1.0, n) * 0.62 + fib * 0.38, 0.0, 1.0));',
    '  neb *= (0.28 + 0.72 * nebMask);',
    '  neb += uNebB * fib * 0.55;',
    '  // ---- 银河带：seed 决定的大圆 + 亮度起伏 + 尘埃暗带（ridged 挖暗） ----',
    '  float gc = abs(dot(rd, uGalAxis));',
    '  float band = exp(-gc * gc * uGalWidth);',
    '  vec3 upv = abs(uGalAxis.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 u1 = normalize(cross(upv, uGalAxis));',
    '  vec3 u2 = cross(uGalAxis, u1);',
    '  vec2 bp = vec2(dot(rd, u1), dot(rd, u2));',
    '  float lump = fbm2(bp * 6.0 + uGalOff.xy, uOctG);',
    '  float dust = ridged2(bp * 11.0 + uGalOff.xy * 2.0 + 3.7, 2.0);',
    '  band *= (0.35 + 0.9 * lump);',
    '  band *= (1.0 - dust * 0.9);',
    '  vec3 gal = mix(vec3(0.78, 0.86, 1.0), vec3(0.55, 0.7, 1.0), lump) * band * uGalIntensity;',
    '  gal += vec3(1.0, 0.78, 0.55) * band * band * uGalIntensity * 0.30;',
    '  col += neb * uNebIntensity * (1.0 + band * 0.9);',
    '  col += gal;',
    '  // ---- 3 层星点：不同密度 / 亮度 / 大小；各层独立旋转藏住接缝与极点 ----',
    '  float f1, f2, f3;',
    '  float dens = clamp(uStarDensity, 0.0, 1.6);',
    '  vec3 rd1 = uRot1 * rd;',
    '  vec3 rd2 = uRot2 * rd;',
    '  vec3 rd3 = uRot3 * rd;',
    '  float s1 = starLayer(rd1, dirUV(rd1, uSeedF * 0.37), 210.0, 0.55 * dens, 0.126, 0.30, uSeedF * 3.1, f1);',
    '  float s2 = starLayer(rd2, dirUV(rd2, uSeedF * 0.83), 130.0, 0.34 * dens, 0.078, 0.55, uSeedF * 7.7, f2);',
    '  float s3 = starLayer(rd3, dirUV(rd3, uSeedF * 0.19), 66.0, 0.20 * dens, 0.040, 1.10, uSeedF * 11.3, f3);',
    '  // 亮星轻微色温差：按视线方向哈希选 蓝白 / 橙红（方向固定 → 画面稳定）',
    '  float csel = hash(vec3(rd * 37.0 + uSeedF * 1.7));',
    '  vec3 tint = vec3(1.0);',
    '  tint = mix(tint, vec3(0.72, 0.85, 1.0), smoothstep(0.42, 0.55, csel));',
    '  tint = mix(tint, vec3(1.0, 0.80, 0.56), smoothstep(0.70, 0.86, csel));',
    '  vec3 stars = vec3(0.0);',
    '  stars += s1 * vec3(0.88, 0.92, 1.0);',
    '  stars += s2 * vec3(0.94, 0.96, 1.0);',
    '  stars += s3 * (vec3(1.0) + tint * 0.4);',
    '  stars += (f1 * 0.35 + f2 * 0.7 + f3) * tint * 0.6;',
    '  col += stars;',
    '  // ---- 曝光（指数 tone map 防过曝）+ fade（进入大气层时隐去星空） ----',
    '  col = 1.0 - exp(-col * uExposure);',
    '  col = max(col, base);',
    '  col *= uFade;',
    '  fragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ================================================================
   * 恒星：billboard 亮核 + 多层日冕 + 6 道十字星芒 + 脉动
   * ================================================================ */
  var VS_STAR = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 a_pos;',
    'uniform mat4 uViewProj;',
    'uniform vec3 uCenter, uCamPos;',
    'uniform float uSize;',
    'out vec2 vUv;',
    'void main(){',
    '  // 面向相机的 billboard 基向量（世界空间，忽略相机滚转即可）',
    '  vec3 dir = normalize(uCenter - uCamPos);',
    '  vec3 up = abs(dir.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 right = normalize(cross(up, dir));',
    '  vec3 up2 = cross(dir, right);',
    '  vec3 wp = uCenter + (right * a_pos.x + up2 * a_pos.y) * uSize;',
    '  vUv = a_pos;',
    '  gl_Position = uViewProj * vec4(wp, 1.0);',
    '}'
  ].join('\n');

  var FS_STAR = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform vec3 uColor;',
    'uniform float uTime;',
    'uniform float uFade;',
    'out vec4 fragColor;',
    'void main(){',
    '  float d = length(vUv);',
    '  // 轻微脉动（两层正弦叠加，像恒星呼吸）',
    '  float pulse = 1.0 + 0.05 * sin(uTime * 1.9) + 0.025 * sin(uTime * 4.7 + 1.3);',
    '  // 亮核',
    '  float core = exp(-d * 8.0);',
    '  // 多层日冕（不同衰减半径叠加，外柔内亮）',
    '  float corona = exp(-d * 3.0) * 0.5 + exp(-d * 6.5) * 0.35 + exp(-d * 12.0) * 0.25;',
    '  // 6 道细长十字星芒：3 根轴各贡献 2 条衍射尖，整体缓慢旋转',
    '  float ang = uTime * 0.05;',
    '  float flare = 0.0;',
    '  for (int i = 0; i < 3; i++){',
    '    float a = ang + float(i) * 1.04719755;',
    '    vec2 ax = vec2(cos(a), sin(a));',
    '    float along = dot(vUv, ax);',
    '    float across = abs(dot(vUv, vec2(-ax.y, ax.x)));',
    '    flare += exp(-across * 30.0) * exp(-abs(along) * 3.0);',
    '  }',
    '  float glow = core * 1.1 + corona + flare * 0.45;',
    '  // 中心偏白，外缘保留色温',
    '  vec3 c = uColor * (0.55 + 0.65 * core) + vec3(0.9, 0.95, 1.0) * 0.25;',
    '  fragColor = vec4(c * glow * pulse * uFade, 1.0);',
    '}'
  ].join('\n');

  /* ================================================================
   * 星球：程序化表面（fbm 高度场 + 群系 + 昼夜终结线 + 城市灯光 + 云 + 大气 Fresnel）
   * ================================================================ */
  var VS_PLANET = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 a_pos;',
    'layout(location=1) in vec3 a_nrm;',
    'layout(location=2) in vec2 a_uv;',
    'uniform mat4 uViewProj;',
    'uniform mat4 uModel;',
    'out vec3 vPos;',
    'void main(){',
    '  vec4 wp = uModel * vec4(a_pos, 1.0);',
    '  vPos = wp.xyz;',
    '  gl_Position = uViewProj * wp;',
    '}'
  ].join('\n');

  var FS_PLANET = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vPos;',
    'uniform vec3 uCamPos, uPlanetPos, uSunDir, uAxis;',
    'uniform float uTime, uSpin, uSeedF;',
    'uniform float uOctT, uOctR, uOctC;',
    'uniform vec3 uColLow, uColMid, uColHigh, uColWater, uColIce, uColCloud, uColAtmo;',
    'uniform float uHasWater, uHasClouds, uAtmoStrength, uCityLights, uFade;',
    'out vec4 fragColor;',
    NOISE,
    '// Rodrigues 旋转：地表/云层以不同角速度绕自转轴转',
    'vec3 rotAxis(vec3 p, vec3 ax, float a){',
    '  float c = cos(a), s = sin(a);',
    '  return p * c + cross(ax, p) * s + ax * dot(ax, p) * (1.0 - c);',
    '}',
    'void main(){',
    '  vec3 p = normalize(vPos - uPlanetPos);',
    '  vec3 nrm = p;',
    '  vec3 viewDir = normalize(uCamPos - vPos);',
    '  float lat = abs(dot(p, uAxis));',
    '  // 地表采样坐标（自转 spin）与云层采样坐标（角速度不同 + 时间）',
    '  vec3 pq = rotAxis(p, uAxis, uSpin);',
    '  vec3 pqc = rotAxis(p, uAxis, uSpin * 1.35 + uTime * 0.02 + uSeedF * 0.37);',
    '  // ---- 高度场：fbm 带梯度（一次算清高度+法线扰动），叠加 ridged 山脉 ----',
    '  vec4 hg = fbmG(pq * 4.5 + vec3(uSeedF * 7.3, uSeedF * 3.1, uSeedF * 5.7), uOctT);',
    '  float h = hg.x;',
    '  vec3 grad = hg.yzw;',
    '  float ridge = ridged(pq * 11.0 + vec3(uSeedF * 2.9, 0.0, uSeedF * 4.4), uOctR);',
    '  h += ridge * 0.4;',
    '  vec3 n = normalize(nrm - grad * 0.10);',
    '  // ---- 群系遮罩：海洋 / 大陆 / 沙漠 / 极冠 / 高山雪（纬度 + 噪声软边） ----',
    '  float waterMask = uHasWater * (1.0 - smoothstep(-0.14, 0.02, h));',
    '  float landMask = 1.0 - waterMask;',
    '  float polar = smoothstep(0.76, 0.97, lat);',
    '  float snow = smoothstep(0.58, 0.82, h) * (0.35 + 0.65 * smoothstep(0.15, 0.8, lat));',
    '  float iceMask = clamp(polar + snow * 0.65, 0.0, 1.0);',
    '  float desertN = vnoise(pq * 3.0 + vec3(9.1, 2.2, 4.7));',
    '  float desert = smoothstep(0.15, 0.6, lat) * smoothstep(0.3, 0.75, desertN) * landMask * (1.0 - polar);',
    '  // ---- 表面混色：低/中/高 + 沙漠 + 海洋 + 冰 ----',
    '  float cont = smoothstep(-0.12, 0.4, h);',
    '  vec3 land = mix(uColLow, uColMid, cont);',
    '  land = mix(land, uColHigh, smoothstep(0.5, 0.92, h));',
    '  land = mix(land, vec3(0.82, 0.72, 0.5), desert * 0.85);',
    '  vec3 surf = land * landMask + uColWater * waterMask;',
    '  surf = mix(surf, uColIce, iceMask);',
    '  // ---- 光照：昼夜软终结线，夜面压暗 ----',
    '  float sunDot = dot(n, uSunDir);',
    '  float day = smoothstep(-0.12, 0.24, sunDot);',
    '  float night = 1.0 - day;',
    '  vec3 lit = surf * (0.045 + 0.92 * clamp(sunDot, 0.0, 1.0));',
    '  // 终结线附近暖红过渡带（像大气折射的暮光）',
    '  float term = exp(-abs(sunDot) * 16.0);',
    '  lit += vec3(1.0, 0.45, 0.2) * term * 0.28 * (0.35 + 0.65 * day);',
    '  lit *= mix(1.0, 0.16, night);',
    '  // ---- 城市灯光：陆地 + 夜面 + 哈希亮斑（小圆点，微闪） ----',
    '  vec3 ccell = floor(pq * 58.0);',
    '  vec3 cf = fract(pq * 58.0);',
    '  vec3 chh = hash3(ccell);',
    '  float hasCity = step(0.87, chh.z);',
    '  float cd = length(vec2(chh.x, chh.y) - cf.xy);',
    '  float city = hasCity * exp(-cd * 20.0) * landMask * night * uCityLights;',
    '  lit += vec3(1.0, 0.72, 0.38) * city * (0.8 + 0.2 * sin(uTime * 2.5 + chh.z * 60.0));',
    '  // ---- 云层：第二层 fbm 不同角速度；云影投地表（简单乘暗）+ 自身白色高光 ----',
    '  float cloud = 0.0;',
    '  if (uHasClouds > 0.5){',
    '    cloud = fbm3(pqc * 3.0 + vec3(uSeedF * 1.7, uSeedF * 3.9, 0.0), uOctC);',
    '    cloud = smoothstep(0.38, 0.88, cloud);',
    '  }',
    '  vec3 final = lit * (1.0 - cloud * 0.45);',
    '  final += cloud * uColCloud * (0.15 + 0.85 * day);',
    '  // ---- 大气 Fresnel 边缘散射：边缘更亮、昼侧更亮（前向散射感） ----',
    '  float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.3);',
    '  float dayF = clamp(sunDot, 0.0, 1.0);',
    '  final += uColAtmo * fres * uAtmoStrength * (0.30 + 0.70 * dayF) * 1.1;',
    '  final += uColAtmo * fres * fres * dayF * uAtmoStrength * 0.85;',
    '  final *= uFade;',
    '  fragColor = vec4(final, 1.0);',
    '}'
  ].join('\n');

  /* ---- 大气外壳：略大球体，cull FRONT + additive，远看柔和光晕 ---- */
  var FS_SHELL = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vPos;',
    'uniform vec3 uCamPos, uPlanetPos, uSunDir, uColAtmo;',
    'uniform float uAtmoStrength, uFade;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec3 n = normalize(vPos - uPlanetPos);',
    '  vec3 viewDir = normalize(uCamPos - vPos);',
    '  // cull front 后只渲染背壳：边缘 dot≈0 → rim 最亮，中心渐暗',
    '  float rim = pow(1.0 + dot(n, viewDir), 3.2);',
    '  // 昼侧（朝阳面）光晕更亮',
    '  float sunSide = smoothstep(-0.3, 0.75, dot(n, uSunDir));',
    '  float glow = 0.16 + 0.9 * rim * (0.22 + 0.78 * sunSide);',
    '  fragColor = vec4(uColAtmo * glow * uAtmoStrength * 0.85 * uFade, 1.0);',
    '}'
  ].join('\n');

  /* ---- 行星环：环平面大四边形 + 径向噪声条纹 + 光影 + 行星阴影近似 ---- */
  var VS_RING = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 a_pos;',
    'uniform mat4 uViewProj;',
    'uniform vec3 uCenter, uBasisU, uBasisV;',
    'uniform float uROut;',
    'out vec2 vLocal;',
    'out vec3 vWorld;',
    'void main(){',
    '  vec2 corner = a_pos * uROut;',
    '  vec3 wp = uCenter + uBasisU * corner.x + uBasisV * corner.y;',
    '  vLocal = corner;',
    '  vWorld = wp;',
    '  gl_Position = uViewProj * vec4(wp, 1.0);',
    '}'
  ].join('\n');

  var FS_RING = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vLocal;',
    'in vec3 vWorld;',
    'uniform vec3 uColRing, uSunDir, uPlanetPos;',
    'uniform vec2 uSunProj;',
    'uniform float uRIn, uROut, uRadius, uSeedF;',
    'uniform float uOctR;',
    'out vec4 fragColor;',
    NOISE,
    'void main(){',
    '  float d = length(vLocal);',
    '  // 内外半径软边遮罩',
    '  float mask = smoothstep(uRIn - uRIn * 0.015, uRIn, d) * (1.0 - smoothstep(uROut, uROut * 1.015, d));',
    '  float ang = atan(vLocal.y, vLocal.x);',
    '  // 环面噪声（cos/sin 环绕无缝）+ 细环缝',
    '  float n = fbm2(vec2(cos(ang) * 2.0, sin(ang) * 2.0) + vec2(0.0, d * 1.2) + vec2(uSeedF * 3.7, uSeedF * 1.1), uOctR);',
    '  float seam = 0.68 + 0.32 * sin(d * 38.0 + uSeedF * 23.0);',
    '  float alpha = mask * (0.22 + 0.78 * n) * seam;',
    '  // 光影：向阳侧亮',
    '  float lit = 0.3 + 0.7 * smoothstep(-0.3, 0.5, dot(normalize(vLocal), uSunProj));',
    '  // 行星阴影近似：环点位于行星背阳侧且靠近行星 → 变暗',
    '  float behind = dot(vWorld - uPlanetPos, uSunDir);',
    '  float shadow = 1.0;',
    '  if (behind < 0.0){',
    '    shadow = mix(0.15, 1.0, smoothstep(uRadius * 0.85, uRadius * 1.5, d));',
    '  }',
    '  alpha *= shadow;',
    '  vec3 col = uColRing * lit * (0.8 + 0.4 * n);',
    '  fragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* ================================================================
   * 曲速隧道：极坐标流动条纹 + 辐条 + 中心亮点 + 末段白闪
   * ================================================================ */
  var VS_WARP = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 a_pos;',
    'uniform mat4 uInvViewProj;',
    'out vec4 vWorld;',
    'void main(){',
    '  vWorld = uInvViewProj * vec4(a_pos, 1.0, 1.0);',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_WARP = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 vWorld;',
    'uniform vec3 uCamPos, uDir, uTint;',
    'uniform float uTime, uProgress;',
    'uniform float uOctW;',
    'out vec4 fragColor;',
    NOISE,
    'void main(){',
    '  vec3 rd = normalize(vWorld.xyz / vWorld.w - uCamPos);',
    '  // 隧道轴 uDir，投影到垂直平面得极坐标',
    '  vec3 f = normalize(uDir);',
    '  vec3 upv = abs(f.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 u1 = normalize(cross(upv, f));',
    '  vec3 u2 = cross(f, u1);',
    '  vec2 pol = vec2(dot(rd, u1), dot(rd, u2));',
    '  float r = length(pol);',
    '  float ang = atan(pol.y, pol.x);',
    '  // progress 控制：速度加快、隧道收束、整体亮度',
    '  float speed = mix(2.0, 30.0, uProgress);',
    '  float wallR = mix(0.6, 0.1, uProgress);',
    '  float bright = smoothstep(0.0, 0.22, uProgress) * (1.0 - smoothstep(0.86, 1.0, uProgress));',
    '  // 径向流动噪声（cos/sin 保证角度无缝）+ 极坐标辐条 = 高速拉伸条纹',
    '  vec2 flow = vec2(cos(ang) * 6.0, sin(ang) * 6.0) + vec2(0.0, r * 24.0 - uTime * speed);',
    '  float st = fbm2(flow, uOctW);',
    '  float streak = pow(st, 6.0);',
    '  float spokes = pow(max(0.0, sin(ang * 15.0 + uTime * speed * 0.6)), 16.0);',
    '  float wall = exp(-abs(r - wallR) * 6.0);',
    '  float center = exp(-r * 8.0);',
    '  float tunnel = (streak * 0.85 + spokes * 0.3) * wall + center * 0.9;',
    '  // 蓝白 → 紫（随条纹强度渐变），中心白亮',
    '  vec3 col = mix(vec3(0.72, 0.88, 1.0), vec3(0.62, 0.38, 1.0), streak);',
    '  col = mix(col, vec3(1.0), center * 1.5);',
    '  col += uTint * wall * 0.3;',
    '  col *= tunnel * bright;',
    '  // 末段 0.82→1 强白闪（抵达瞬间）',
    '  float flash = smoothstep(0.82, 0.99, uProgress);',
    '  col += vec3(1.0, 0.99, 1.0) * flash * (0.7 + 0.6 * center);',
    '  fragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ================================================================
   * 太空尘埃：实例化四边形 + 速度线拉伸 + 相机环绕 wrap
   * ================================================================ */
  var VS_DUST = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 a_corner;',
    'layout(location=1) in vec3 a_pos;',
    'layout(location=2) in float a_size;',
    'layout(location=3) in float a_seed;',
    'uniform mat4 uViewProj;',
    'uniform vec3 uCamPos, uVelDir;',
    'uniform float uStretch, uThrottle, uTime, uFade;',
    'out float vAlpha;',
    'out vec2 vUv;',
    'void main(){',
    '  vec3 dir = a_pos - uCamPos;',
    '  float dist = length(dir);',
    '  dir = normalize(dir);',
    '  vec3 up = abs(dir.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 right = normalize(cross(up, dir));',
    '  vec3 up2 = cross(dir, right);',
    '  // 速度线：速度在屏幕平面投影方向拉伸（throttle 决定长度倍率）',
    '  vec2 vs = vec2(dot(uVelDir, right), dot(uVelDir, up2));',
    '  float ext = 1.0 + uStretch * uThrottle;',
    '  vec2 off = a_corner * a_size + vs * (a_corner.y * a_size * ext);',
    '  vec3 wp = a_pos + right * off.x + up2 * off.y;',
    '  gl_Position = uViewProj * vec4(wp, 1.0);',
    '  vUv = a_corner;',
    '  // 近大远小由 a_size 决定；远处淡出、贴近相机淡化，避免糊脸',
    '  float farFade = 1.0 - smoothstep(140.0, 520.0, dist);',
    '  float nearFade = smoothstep(0.0, 2.0, dist);',
    '  vAlpha = (0.35 + 0.65 * a_seed) * farFade * nearFade * (0.85 + 0.15 * sin(uTime * 2.0 + a_seed * 40.0)) * uFade;',
    '}'
  ].join('\n');

  var FS_DUST = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'in float vAlpha;',
    'out vec4 fragColor;',
    'void main(){',
    '  float a = smoothstep(1.0, 0.35, length(vUv)) * vAlpha;',
    '  fragColor = vec4(vec3(0.72, 0.83, 1.0), a);',
    '}'
  ].join('\n');

  /* ================================================================
   * SFX 主体
   * ================================================================ */
  var ZERO = [0, 0, 0];
  var DEFAULT_PALETTE = {
    low: [0.20, 0.30, 0.26], mid: [0.42, 0.52, 0.36], high: [0.86, 0.90, 0.93],
    water: [0.10, 0.32, 0.52], ice: [0.88, 0.95, 1.00], cloud: [0.96, 0.97, 1.00]
  };

  var SFX = {
    /* 质量 0..1：降低噪声 octave 数与粒子数 */
    quality: 1,
    _cache: {},
    _init: false,
    /* 暴露着色器源码（调试 / 自测用），key = '程序名.vs' / '.fs' */
    _shaders: {
      'bg.vs': VS_BG, 'bg.fs': FS_BG,
      'star.vs': VS_STAR, 'star.fs': FS_STAR,
      'planet.vs': VS_PLANET, 'planet.fs': FS_PLANET,
      'shell.vs': VS_PLANET, 'shell.fs': FS_SHELL,
      'ring.vs': VS_RING, 'ring.fs': FS_RING,
      'warp.vs': VS_WARP, 'warp.fs': FS_WARP,
      'dust.vs': VS_DUST, 'dust.fs': FS_DUST
    }
  };

  /* ---------- 工具 ---------- */
  function col(v, def) {
    if (v == null) return def;
    if (typeof v === 'string') return Util.hex ? Util.hex(v) : def;
    if (typeof v.length === 'number' && v.length >= 3) return [v[0], v[1], v[2]];
    return def;
  }
  function oct(q, base) { return Math.max(1, Math.round(base * q)); }
  function len3(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function norm3(a) {
    var l = len3(a);
    if (l < 1e-9) return [0, 1, 0];
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

  /* seed → 旋转矩阵（mat3，列主序）：让各星层的接缝/极点落在不同方位 */
  SFX._seedRot = function (seed) {
    var key = 'r' + seed;
    if (SFX._cache[key]) return SFX._cache[key];
    var rng = Util.makeRng ? Util.makeRng((seed * 2654435761 >>> 0) || 1) : Math.random;
    var ax = norm3([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
    var q = DSC.Q ? DSC.Q.fromAxisAngle(ax, rng() * Math.PI * 2) : [0, 0, 0, 1];
    var m4;
    if (M4 && M4.fromQuatPos) m4 = M4.fromQuatPos(q, ZERO);
    else if (M4) m4 = M4.identity();
    else m4 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
    var m3 = new Float32Array([m4[0], m4[1], m4[2], m4[4], m4[5], m4[6], m4[8], m4[9], m4[10]]);
    SFX._cache[key] = m3;
    return m3;
  };

  /* seed → 银河带参数（大圆轴 / 带宽 / 亮度 / 偏移） */
  SFX._galaxy = function (seed) {
    var key = 'g' + seed;
    if (SFX._cache[key]) return SFX._cache[key];
    var rng = Util.makeRng ? Util.makeRng((seed * 7919 >>> 0) || 7) : Math.random;
    var g = {
      axis: norm3([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]),
      width: 70 + rng() * 90,
      intensity: 0.55 + rng() * 0.85,
      off: [rng() * 20, rng() * 20, 0]
    };
    SFX._cache[key] = g;
    return g;
  };

  /* seed → 行星自转轴（轻微倾斜） */
  SFX._axis = function (seed) {
    var key = 'a' + seed;
    if (SFX._cache[key]) return SFX._cache[key];
    var rng = Util.makeRng ? Util.makeRng((seed * 104729 >>> 0) || 3) : Math.random;
    var ax = norm3([(rng() - 0.5) * 1.6, 0.35 + rng() * 0.65, (rng() - 0.5) * 1.6]);
    SFX._cache[key] = ax;
    return ax;
  };

  /* ---------- init：建 program / 几何 / 尘埃缓冲（幂等） ---------- */
  SFX.init = function () {
    if (SFX._init) return SFX;
    var GL = DSC.GL;
    if (!GL || !GL.gl) return SFX; // 须在 DSC.GL.init 之后调用；未就绪时静默跳过

    SFX._bg = GL.program(VS_BG, FS_BG, 'sfx.bg');
    SFX._star = GL.program(VS_STAR, FS_STAR, 'sfx.star');
    SFX._planet = GL.program(VS_PLANET, FS_PLANET, 'sfx.planet');
    SFX._shell = GL.program(VS_PLANET, FS_SHELL, 'sfx.shell');
    SFX._ring = GL.program(VS_RING, FS_RING, 'sfx.ring');
    SFX._warp = GL.program(VS_WARP, FS_WARP, 'sfx.warp');
    SFX._dust = GL.program(VS_DUST, FS_DUST, 'sfx.dust');

    /* 共享单位四边形（6 顶点非索引，供恒星/环/尘埃实例化用） */
    var qv = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    SFX._quadBuf = GL.buffer(qv);
    SFX._quad = GL.vao([{ buffer: SFX._quadBuf, loc: 0, size: 2 }]);

    /* 星球 / 大气外壳共用球体 */
    SFX._sphere = GL.sphereMesh(64, 32);

    /* 尘埃：实例缓冲 [x,y,z, size, seed]，DYNAMIC 每帧重传 */
    SFX._dustCount = Math.max(300, Math.round(3000 * SFX.quality));
    SFX._dustData = new Float32Array(SFX._dustCount * 5);
    var rng = Util.makeRng ? Util.makeRng(4242) : Math.random;
    var box = 420, i, o;
    for (i = 0; i < SFX._dustCount; i++) {
      o = i * 5;
      SFX._dustData[o] = (rng() * 2 - 1) * box;
      SFX._dustData[o + 1] = (rng() * 2 - 1) * box;
      SFX._dustData[o + 2] = (rng() * 2 - 1) * box;
      SFX._dustData[o + 3] = 0.8 + Math.pow(rng(), 2.2) * 3.0; // 尺寸：近大远小
      SFX._dustData[o + 4] = rng();                            // 亮度种子
    }
    SFX._dustBuf = GL.buffer(SFX._dustData, GL.gl.ARRAY_BUFFER, GL.gl.DYNAMIC_DRAW);
    SFX._dustVAO = GL.vao([
      { buffer: SFX._quadBuf, loc: 0, size: 2 },
      { buffer: SFX._dustBuf, loc: 1, size: 3, stride: 20, offset: 0, divisor: 1 },
      { buffer: SFX._dustBuf, loc: 2, size: 1, stride: 20, offset: 12, divisor: 1 },
      { buffer: SFX._dustBuf, loc: 3, size: 1, stride: 20, offset: 16, divisor: 1 }
    ]);

    SFX._init = true;
    return SFX;
  };

  /* ---------- 背景（星空 / 星云 / 银河） ---------- */
  SFX.drawBackground = function (c) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._bg;
    if (!prg || !gl) return;
    c = c || {};
    var seed = c.seed === undefined ? 1 : c.seed;
    var inv = c.invViewProj;
    if (!inv && c.viewProj) inv = M4.invert(c.viewProj); // 缺 invViewProj 时由 viewProj 反推
    if (!inv) inv = M4.identity();
    var g = SFX._galaxy(seed);
    prg.use();
    prg.set('uInvViewProj', inv);
    prg.set('uCamPos', c.camPos || ZERO);
    prg.set('uTime', c.time || 0);
    prg.set('uSeedF', seed);
    prg.set('uStarDensity', c.starDensity === undefined ? 1 : c.starDensity);
    prg.set('uExposure', c.exposure === undefined ? 1 : c.exposure);
    prg.set('uFade', c.fade === undefined ? 1 : c.fade);
    prg.set('uNebA', c.nebulaA || [0.10, 0.15, 0.36]);
    prg.set('uNebB', c.nebulaB || [0.38, 0.14, 0.44]);
    prg.set('uNebIntensity', c.nebulaIntensity === undefined ? 0.75 : c.nebulaIntensity);
    prg.set('uRot1', SFX._seedRot(seed + 0.7));
    prg.set('uRot2', SFX._seedRot(seed + 7.3));
    prg.set('uRot3', SFX._seedRot(seed + 91.1));
    prg.set('uGalAxis', g.axis);
    prg.set('uGalWidth', g.width);
    prg.set('uGalIntensity', g.intensity);
    prg.set('uGalOff', g.off);
    prg.set('uOctN', oct(SFX.quality, 3));
    prg.set('uOctG', oct(SFX.quality, 3));
    // 全屏不透明底色：关闭深度（不留深度痕迹，星球随后叠加）
    GL.depth(false, { write: false });
    GL.blend('off');
    GL.cull('off');
    gl.bindVertexArray(GL.screenVAO());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    GL.resetState(); // 还原 depth on/write on, blend off, cull back
  };

  /* ---------- 恒星 ---------- */
  SFX.drawStar = function (c, s) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._star;
    if (!prg || !gl) return;
    c = c || {}; s = s || {};
    var r = s.radius || 10;
    prg.use();
    prg.set('uViewProj', c.viewProj || M4.identity());
    prg.set('uCenter', s.pos || ZERO);
    prg.set('uCamPos', c.camPos || ZERO);
    prg.set('uSize', r * (s.coronaScale === undefined ? 4 : s.coronaScale));
    prg.set('uColor', s.color || [1.0, 0.97, 0.9]);
    prg.set('uTime', c.time || 0);
    prg.set('uFade', c.fade === undefined ? 1 : c.fade);
    // additive 发光：开深度测试（被行星遮挡）但不写深度
    GL.depth(true, { write: false });
    GL.blend('add');
    GL.cull('off');
    gl.bindVertexArray(SFX._quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    GL.resetState();
  };

  /* ---------- 行星环（drawPlanet 内部调用） ---------- */
  SFX._drawRing = function (c, R) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._ring;
    if (!prg || !gl) return;
    var u = cross3(R.axis, [0, 1, 0]);
    if (len3(u) < 0.01) u = [1, 0, 0];
    u = norm3(u);
    var v = cross3(R.axis, u);
    var outer = R.radius * 2.35, inner = R.radius * 1.45;
    var sp = R.sun;
    sp = norm3([sp[0] - R.axis[0] * dot3(sp, R.axis), sp[1] - R.axis[1] * dot3(sp, R.axis), sp[2] - R.axis[2] * dot3(sp, R.axis)]);
    if (len3(sp) < 0.01) sp = [1, 0, 0];
    prg.use();
    prg.set('uViewProj', c.viewProj || M4.identity());
    prg.set('uCenter', R.center);
    prg.set('uBasisU', u);
    prg.set('uBasisV', v);
    prg.set('uROut', outer);
    prg.set('uRIn', inner);
    prg.set('uColRing', R.color);
    prg.set('uSunDir', R.sun);
    prg.set('uSunProj', [dot3(sp, u), dot3(sp, v)]);
    prg.set('uPlanetPos', R.center);
    prg.set('uRadius', R.radius);
    prg.set('uSeedF', R.seed);
    prg.set('uOctR', oct(SFX.quality, 2));
    GL.depth(true, { write: false });
    GL.blend('alpha');
    GL.cull('off');
    gl.bindVertexArray(SFX._quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    GL.resetState();
  };

  /* ---------- 大气外壳（drawPlanet 内部调用） ---------- */
  SFX._drawShell = function (c, S) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._shell;
    if (!prg || !gl) return;
    var model = M4.translation(S.center);
    M4.scale(model, [S.radius * 1.07, S.radius * 1.07, S.radius * 1.07], model);
    prg.use();
    prg.set('uViewProj', c.viewProj || M4.identity());
    prg.set('uModel', model);
    prg.set('uCamPos', c.camPos || ZERO);
    prg.set('uPlanetPos', S.center);
    prg.set('uSunDir', S.sun);
    prg.set('uColAtmo', S.atmo);
    prg.set('uAtmoStrength', S.strength);
    prg.set('uFade', c.fade === undefined ? 1 : c.fade);
    GL.depth(true, { write: false });
    GL.blend('add');
    GL.cull('front');
    GL.draw(SFX._sphere);
    GL.resetState();
  };

  /* ---------- 星球 ---------- */
  SFX.drawPlanet = function (c, p) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._planet;
    if (!prg || !gl) return;
    c = c || {}; p = p || {};
    var r = p.radius || 1;
    var pos = p.pos || ZERO;
    var seed = p.seed === undefined ? 1 : p.seed;
    var axis = SFX._axis(seed);
    var sun = norm3(p.sunDir || [0.4, 1, 0.3]);
    var pal = p.palette || {};
    var model = M4.translation(pos);
    M4.scale(model, [r, r, r], model);
    var atmoStrength = p.atmoStrength === undefined ? 0.85 : p.atmoStrength;
    var atmoCol = col(p.atmoColor, [0.30, 0.58, 1.00]);

    prg.use();
    prg.set('uViewProj', c.viewProj || M4.identity());
    prg.set('uModel', model);
    prg.set('uCamPos', c.camPos || ZERO);
    prg.set('uPlanetPos', pos);
    prg.set('uSunDir', sun);
    prg.set('uAxis', axis);
    prg.set('uTime', c.time || 0);
    prg.set('uSpin', p.spin || 0);
    prg.set('uSeedF', seed);
    prg.set('uColLow', col(pal.low, DEFAULT_PALETTE.low));
    prg.set('uColMid', col(pal.mid, DEFAULT_PALETTE.mid));
    prg.set('uColHigh', col(pal.high, DEFAULT_PALETTE.high));
    prg.set('uColWater', col(pal.water, DEFAULT_PALETTE.water));
    prg.set('uColIce', col(pal.ice, DEFAULT_PALETTE.ice));
    prg.set('uColCloud', col(pal.cloud, DEFAULT_PALETTE.cloud));
    prg.set('uColAtmo', atmoCol);
    prg.set('uHasWater', p.hasWater ? 1 : 0);
    prg.set('uHasClouds', p.hasClouds ? 1 : 0);
    prg.set('uAtmoStrength', atmoStrength);
    prg.set('uCityLights', p.cityLights === undefined ? 0.6 : p.cityLights);
    prg.set('uFade', c.fade === undefined ? 1 : c.fade);
    prg.set('uOctT', oct(SFX.quality, 4));
    prg.set('uOctR', oct(SFX.quality, 2));
    prg.set('uOctC', oct(SFX.quality, 3));
    GL.depth(true, { write: true });
    GL.blend('off');
    GL.cull('back');
    GL.draw(SFX._sphere); // 地表（含云影/城市/大气 Fresnel，全在一遍内）

    if (p.hasRings) {
      SFX._drawRing(c, { center: pos, radius: r, axis: axis, sun: sun, color: col(p.ringColor, [0.85, 0.80, 0.72]), seed: seed });
    }
    SFX._drawShell(c, { center: pos, radius: r, sun: sun, atmo: atmoCol, strength: atmoStrength });
    GL.resetState();
  };

  /* ---------- 曲速隧道 ---------- */
  SFX.drawWarp = function (c, w) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._warp;
    if (!prg || !gl) return;
    c = c || {}; w = w || {};
    var inv = c.invViewProj;
    if (!inv && c.viewProj) inv = M4.invert(c.viewProj);
    if (!inv) inv = M4.identity();
    var dir = w.dir;
    if (!dir) {
      // 缺省 dir：由 invViewProj 推屏幕中心视线方向
      var far = M4.mulVec(inv, [0, 0, 1, 1]);
      var cam = c.camPos || ZERO;
      if (Math.abs(far[3]) > 1e-9) dir = norm3([far[0] / far[3] - cam[0], far[1] / far[3] - cam[1], far[2] / far[3] - cam[2]]);
      else dir = [0, 0, -1];
    }
    prg.use();
    prg.set('uInvViewProj', inv);
    prg.set('uCamPos', c.camPos || ZERO);
    prg.set('uDir', dir);
    prg.set('uTint', w.tint || [0.55, 0.75, 1.0]);
    prg.set('uTime', c.time || 0);
    prg.set('uProgress', w.progress01 === undefined ? 0.5 : Math.max(0, Math.min(1, w.progress01)));
    prg.set('uOctW', oct(SFX.quality, 3));
    GL.depth(false, { write: false });
    GL.blend('add');
    GL.cull('off');
    gl.bindVertexArray(GL.screenVAO());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    GL.resetState();
  };

  /* ---------- 尘埃更新：围绕相机 wrap（避免飞出视野） ---------- */
  SFX._dustUpdate = function (camPos) {
    var d = SFX._dustData, n = SFX._dustCount, box = 420, i, o;
    var cx = camPos[0], cy = camPos[1], cz = camPos[2];
    for (i = 0; i < n; i++) {
      o = i * 5;
      var px = d[o] - cx, py = d[o + 1] - cy, pz = d[o + 2] - cz;
      d[o] = ((px + box) % (2 * box)) - box + cx;
      d[o + 1] = ((py + box) % (2 * box)) - box + cy;
      d[o + 2] = ((pz + box) % (2 * box)) - box + cz;
    }
    DSC.GL.upload(SFX._dustBuf, d, null, DSC.GL.gl.DYNAMIC_DRAW);
  };

  /* ---------- 太空尘埃 / 速度线 ---------- */
  SFX.drawDust = function (c, d) {
    var GL = DSC.GL, gl = GL.gl;
    var prg = SFX._dust;
    if (!prg || !gl || !SFX._dustVAO) return;
    c = c || {}; d = d || {};
    var cam = d.camPos || c.camPos || ZERO;
    var vel = d.velocity || ZERO;
    var vlen = len3(vel);
    var vdir = vlen > 1e-4 ? scale3(vel, 1 / vlen) : [0, 0, 1];
    var throttle = d.throttle01 === undefined ? 0 : Math.max(0, Math.min(1, d.throttle01));
    SFX._dustUpdate(cam);
    prg.use();
    prg.set('uViewProj', c.viewProj || M4.identity());
    prg.set('uCamPos', cam);
    prg.set('uVelDir', vdir);
    prg.set('uStretch', Math.min(6.0, vlen * 0.06));
    prg.set('uThrottle', throttle);
    prg.set('uTime', c.time || 0);
    prg.set('uFade', c.fade === undefined ? 1 : c.fade);
    GL.depth(false, { write: false });
    GL.blend('add');
    GL.cull('off');
    gl.bindVertexArray(SFX._dustVAO);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, SFX._dustCount);
    gl.bindVertexArray(null);
    GL.resetState();
  };

  DSC.SpaceFX = SFX;
})();
