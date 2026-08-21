/* =========================================================================
 * shaders.js — 全部 GLSL ES 3.00 着色器源码
 * 每段以 '#version 300 es' 开头且前面不能有任何空白字符。
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE = root.NUKE || {};
  var S = NK.shaders = {};

  /* ------------------------------------------------------------ 公共片段 */
  var HDR_MAX = 40000.0;
  var COMMON = [
    'float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }',
    'float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',
    'float fbm2(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s += a*vnoise(p); p*=2.03; a*=0.5; } return s; }',
    'float hash31(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float vnoise3(vec3 p){',
    '  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  float n000=hash31(i), n100=hash31(i+vec3(1,0,0)), n010=hash31(i+vec3(0,1,0)), n110=hash31(i+vec3(1,1,0));',
    '  float n001=hash31(i+vec3(0,0,1)), n101=hash31(i+vec3(1,0,1)), n011=hash31(i+vec3(0,1,1)), n111=hash31(i+vec3(1,1,1));',
    '  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);',
    '}',
    // 黑体色（Planck 轨迹的经典有理/对数拟合，与 CPU 侧 util.blackbodyRGB 一致）
    'vec3 blackbody(float T){',
    '  float k = clamp(T, 1000.0, 40000.0)/100.0;',
    '  float r = k<=66.0 ? 255.0 : 329.698727446*pow(max(k-60.0,1e-3), -0.1332047592);',
    '  float g = k<=66.0 ? (99.4708025861*log(max(k,1.0)) - 161.1195681661)',
    '                    : 288.1221695283*pow(max(k-60.0,1e-3), -0.0755148492);',
    '  float b = k>=66.0 ? 255.0 : (k<=19.0 ? 0.0 : 138.5177312231*log(max(k-10.0,1e-3)) - 305.0447927307);',
    '  return clamp(vec3(r,g,b)/255.0, 0.0, 1.0);',
    '}',
    'float linDepth(float d, float n, float f){ float z = d*2.0-1.0; return (2.0*n*f)/(f+n-z*(f-n)); }',
    '#define HDR_MAX 40000.0',
    'vec3 hdrSafe(vec3 c){ return clamp(c, vec3(0.0), vec3(HDR_MAX)); }'
  ].join('\n');

  /* ============================ 天空 ============================ */
  S.skyVS = [
    '#version 300 es',
    'layout(location=0) in vec2 aPos;',
    'uniform mat4 uInvVP;',
    'uniform vec3 uCamPos;',
    'out vec3 vRay;',
    'out vec2 vUV;',
    'void main(){',
    '  vUV = aPos*0.5+0.5;',
    '  vec4 p = uInvVP*vec4(aPos, 1.0, 1.0);',
    '  vRay = p.xyz/p.w - uCamPos;',
    '  gl_Position = vec4(aPos, 1.0, 1.0);',
    '}'
  ].join('\n');

  S.skyFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec3 vRay; in vec2 vUV;',
    'uniform vec3 uSunDir;',      // 指向太阳
    'uniform vec3 uZenith;',
    'uniform vec3 uHorizon;',
    'uniform vec3 uGround;',
    'uniform float uFlash;',      // 闪光强度（已含曝光归一）
    'uniform vec3 uFlashCol;',
    'uniform vec3 uBurstDir;',    // 摄像机→爆心方向
    'uniform float uNight;',
    'out vec4 oCol;',
    'void main(){',
    '  vec3 d = normalize(vRay);',
    '  float h = d.y;',
    '  float t = pow(clamp(1.0-max(h,0.0), 0.0, 1.0), 2.2);',
    '  vec3 sky = mix(uZenith, uHorizon, t);',
    // 地平线以下：大气+地面混合（远处地面被雾吞没）
    '  sky = mix(sky, uGround*0.55+uHorizon*0.45, smoothstep(0.0, -0.06, h));',
    // 太阳与米氏散射光晕
    '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
    '  sky += vec3(1.0,0.93,0.82)*pow(sd, 900.0)*22.0*(1.0-uNight);',
    '  sky += vec3(1.0,0.82,0.62)*pow(sd, 8.0)*0.16*(1.0-uNight);',
    // 星星（夜间）
    '  if (uNight > 0.02 && h > 0.0) {',
    '    vec2 sp = d.xz/max(abs(d.y),0.02)*3.0;',
    '    float st = pow(vnoise(floor(sp*90.0)), 24.0);',
    '    sky += vec3(0.9,0.95,1.0)*st*3.0*uNight*smoothstep(0.0,0.25,h);',
    '  }',
    // 火球照亮整片天空 + 爆心方向的散射光柱
    '  float bd = max(dot(d, normalize(uBurstDir)), 0.0);',
    '  vec3 flash = uFlashCol*uFlash;',
    '  sky += flash*(0.10 + 0.9*pow(bd, 3.0));',
    '  oCol = vec4(hdrSafe(sky), 1.0);',
    '}'
  ].join('\n');

  /* ============================ 地面 ============================ */
  S.groundVS = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos;',   // y 已含地形起伏
    'uniform mat4 uVP;',
    'uniform float uCraterR;',
    'uniform float uCraterD;',
    'out vec3 vWorld;',
    'out float vR;',
    'void main(){',
    '  vec3 p = aPos;',
    '  float r = length(p.xz);',
    '  vR = r;',
    // 弹坑：中心下凹 + 抬起的坑唇（抛掷物堆积）
    '  if (uCraterR > 1.0) {',
    '    float q = r/uCraterR;',
    '    float bowl = -uCraterD*exp(-q*q*2.2);',
    '    float lip  =  uCraterD*0.32*exp(-pow((q-1.15)*2.4,2.0));',
    '    p.y += bowl + lip;',
    '  }',
    '  vWorld = p;',
    '  gl_Position = uVP*vec4(p, 1.0);',
    '}'
  ].join('\n');

  S.groundFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec3 vWorld; in float vR;',
    'uniform vec3 uCamPos;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uSunCol;',
    'uniform vec3 uSkyCol;',
    'uniform vec3 uFogCol;',
    'uniform float uFogDensity;',
    'uniform vec3 uBurst;',        // 爆心世界坐标
    'uniform float uFlashLight;',  // 闪光点光源强度（含 1/r² 前的系数）
    'uniform vec3 uFlashCol;',
    'uniform float uFlashScatter;',// 闪光的各向同性散射分额
    'uniform float uFlashR;',      // 火球半径（有限尺寸光源的距离下限）
    'uniform float uThermalA;',    // 热剂量系数：Q = A/r² * exp(-r/lam)  [cal/cm²]
    'uniform float uThermalLam;',
    'uniform float uCharQ;',       // 炭化阈值 cal/cm²
    'uniform float uCraterR;',
    'uniform float uShockRg;',     // 地面激波环半径
    'uniform float uDustR;',       // 尘环半径
    'uniform float uGrid;',
    'uniform float uShowGrid;',
    'uniform float uNight;',
    'uniform float uCityR;',       // 城区半径（0 = 不画城市）
    'uniform float uCityAng;',     // 路网朝向
    'uniform float uCityStep;',    // 街区间距（街区+街道）
    'uniform float uCityStreet;',  // 街道宽度
    'out vec4 oCol;',
    'void main(){',
    '  vec3 P = vWorld;',
    '  float r = vR;',
    // —— 地表反照率：两个尺度的噪声 + 一点色调变化 ——
    '  float n1 = fbm2(P.xz*0.0016);',
    '  float n2 = fbm2(P.xz*0.021);',
    '  vec3 dry = vec3(0.42,0.35,0.26);',
    '  vec3 veg = vec3(0.20,0.26,0.14);',
    '  vec3 alb = mix(dry, veg, smoothstep(0.42,0.72,n1))*(0.75+0.5*n2);',
    // —— 城区：路网 + 街区铺装（沿建筑同一套网格，从空中看是真实城市肌理） ——
    '  if (uCityR > 1.0) {',
    '    float ci = smoothstep(uCityR, uCityR*0.80, r);',
    '    float ca2 = cos(-uCityAng), sa2 = sin(-uCityAng);',
    '    vec2 g = vec2(P.x*ca2 - P.z*sa2, P.x*sa2 + P.z*ca2)/uCityStep;',
    '    vec2 fg = fract(g);',
    '    vec2 dEdge = min(fg, 1.0-fg);',
    '    float halfS = 0.5*uCityStreet/uCityStep;',
    '    float onStreet = 1.0 - smoothstep(halfS*0.75, halfS*1.15, min(dEdge.x, dEdge.y));',
    '    float blockHash = hash21(floor(g)+0.5);',
    '    vec3 asphalt = vec3(0.085,0.086,0.092)*(0.85+0.3*vnoise(P.xz*0.5));',
    '    vec3 pave = mix(vec3(0.30,0.29,0.27), vec3(0.20,0.19,0.185), blockHash);',
    '    pave *= 0.8 + 0.45*vnoise(P.xz*0.09 + blockHash*11.0);',
    '    vec3 urban = mix(pave, asphalt, onStreet);',
    // 人行道亮边
    '    float curb = smoothstep(halfS*1.35, halfS*1.05, min(dEdge.x, dEdge.y)) *',
    '                 smoothstep(halfS*0.95, halfS*1.2, min(dEdge.x, dEdge.y));',
    '    urban = mix(urban, vec3(0.38,0.37,0.35), curb*0.6);',
    '    alb = mix(alb, urban, ci*0.92);',
    '  }',
    // —— 法线：由噪声梯度做凹凸 ——
    '  float e = max(2.0, r*0.004);',
    '  float hx = fbm2((P.xz+vec2(e,0))*0.021) - fbm2((P.xz-vec2(e,0))*0.021);',
    '  float hz = fbm2((P.xz+vec2(0,e))*0.021) - fbm2((P.xz-vec2(0,e))*0.021);',
    '  vec3 N = normalize(vec3(-hx*90.0, 1.0, -hz*90.0));',
    // —— 热辐射炭化：Q(r) 超过阈值即烧焦，形成同心焦环 ——
    '  float Q = uThermalA/max(r*r,1.0)*exp(-r/uThermalLam);',
    '  float char_ = smoothstep(uCharQ*0.45, uCharQ*2.2, Q);',
    '  float scorch = smoothstep(uCharQ*0.12, uCharQ*0.8, Q);',
    '  alb = mix(alb, vec3(0.075,0.062,0.055), char_*0.92);',
    '  alb = mix(alb, alb*vec3(0.55,0.48,0.42), scorch*0.7);',
    // —— 激波扫过：地表被吹刮、浮土剥离 ——
    '  float swept = smoothstep(uShockRg*1.02, uShockRg*0.80, r);',
    '  alb = mix(alb, alb*0.82+vec3(0.06,0.05,0.04), swept*0.6);',
    // —— 弹坑：熔融玻璃化的深色内壁 + 亮色坑唇 ——
    '  if (uCraterR > 1.0) {',
    '    float q = r/uCraterR;',
    '    alb = mix(alb, vec3(0.055,0.05,0.05), smoothstep(1.05,0.35,q));',
    '    alb = mix(alb, vec3(0.5,0.44,0.36), smoothstep(0.35,0.0,abs(q-1.15))*0.55);',
    '  }',
    // —— 光照：太阳 + 天空环境 + 火球点光源（1/r²，被大气衰减） ——
    '  vec3 L = normalize(uSunDir);',
    '  float ndl = max(dot(N,L), 0.0);',
    '  vec3 lit = alb*uSunCol*ndl*(1.0-uNight*0.92) + alb*uSkyCol*(0.35+0.65*N.y);',
    '  vec3 BL = uBurst - P;',
    '  float bl = length(BL);',
    '  float ndb = max(dot(N, BL/max(bl,1.0)), 0.0);',
    '  bl = max(bl, uFlashR*0.75);',
    '  float atten = uFlashLight/max(bl*bl, 1.0)*exp(-bl/uThermalLam);',
    // 直射 + 散射：火球把整片天空点亮，背光面靠漫射照明仍然可见
    '  lit += alb*uFlashCol*(ndb + uFlashScatter)*atten;',
    // —— 地面激波环：亮环（压缩空气折射+扬尘）与尘环 ——
    '  float ring = exp(-pow((r-uShockRg)/max(uShockRg*0.035, 12.0), 2.0));',
    '  lit += vec3(0.85,0.86,0.95)*ring*1.1*smoothstep(0.0,1.0,uShockRg/1000.0);',
    '  float dring = exp(-pow((r-uDustR)/max(uDustR*0.09, 25.0), 2.0));',
    '  lit = mix(lit, vec3(0.5,0.42,0.33)*(0.35+atten*0.6+ndl*0.6), dring*0.55);',
    // —— 参考网格（判断尺度用） ——
    '  if (uShowGrid > 0.5) {',
    '    vec2 g = abs(fract(P.xz/uGrid)-0.5);',
    '    vec2 w = fwidth(P.xz/uGrid)*1.2;',
    '    float line = 1.0 - min(min(smoothstep(0.0,w.x,g.x), smoothstep(0.0,w.y,g.y)), 1.0);',
    '    lit = mix(lit, vec3(0.55,0.75,0.85), clamp(line,0.0,1.0)*0.18);',
    '  }',
    // —— 距离雾 ——
    '  float dist = length(uCamPos-P);',
    '  float fog = 1.0-exp(-dist*uFogDensity);',
    '  oCol = vec4(hdrSafe(mix(lit, uFogCol, clamp(fog,0.0,1.0))), 1.0);',
    '}'
  ].join('\n');

  /* ============================ 建筑（实例化：朝向 / 倾覆 / 坍塌 / 破坏） ============================ */
  /*
   * 实例数据（16 float = 4×vec4）
   *   aI0 = (x, z, w, d)              位置与底面尺寸
   *   aI1 = (h, angOrient, topAng, lean)   高度、街区朝向、倾覆角、坍塌倾斜
   *   aI2 = (seed, state, glass, clad)     破坏状态与玻璃/幕墙损伤度
   *   aI3 = (char, burning, isRubble, baseY)  炭化、燃烧、废墟标志、体量底高
   * 倾覆/倾斜绕「背离爆心的水平轴」用 Rodrigues 旋转，支点取底面在径向上的边缘。
   */
  S.buildVS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNrm;',
    'layout(location=2) in vec4 aI0;',
    'layout(location=3) in vec4 aI1;',
    'layout(location=4) in vec4 aI2;',
    'layout(location=5) in vec4 aI3;',
    'uniform mat4 uVP;',
    'out vec3 vWorld; out vec3 vNrm; out float vSeed; out float vBaseY;',
    'out float vGlass; out float vClad; out float vChar; out float vBurn;',
    'out float vRubble; out float vState; out float vH;',
    'void main(){',
    '  float w = aI0.z, d = aI0.w, h = aI1.x;',
    '  float ao = aI1.y, topA = aI1.z + aI1.w;',
    '  vec3 base = vec3(aI0.x, aI3.w, aI0.y);',
    // 建筑自身朝向（街区轴向）
    '  vec2 eo = vec2(cos(ao), sin(ao));',
    '  vec3 ex = vec3(eo.x, 0.0, eo.y);',
    '  vec3 ez = vec3(-eo.y, 0.0, eo.x);',
    '  float u = aPos.x*w, v = aPos.y*h, sd = aPos.z*d;',
    // 废墟堆：顶面做不规则起伏
    '  if (aI3.z > 0.5 && aPos.y > 0.5) {',
    '    float nn = vnoise(vec2(aI0.x + u*3.0, aI0.y + sd*3.0)*0.09 + aI2.x*13.0);',
    '    v *= 0.45 + 1.05*nn;',
    '  }',
    '  vec3 q = ex*u + ez*sd + vec3(0.0, v, 0.0);',
    // 倾覆：绕 (背离爆心方向 × 上) 的水平轴旋转，支点在底面径向边缘
    '  if (topA > 0.0008) {',
    '    vec2 rad = normalize(vec2(aI0.x, aI0.y) + vec2(1e-4));',
    '    vec3 kx = vec3(rad.x, 0.0, rad.y);',
    '    vec3 kAxis = vec3(-rad.y, 0.0, rad.x);',
    '    float edge = 0.5*(abs(dot(ex.xz, rad))*w + abs(dot(ez.xz, rad))*d);',
    '    vec3 pv = kx*edge;',
    '    vec3 rq = q - pv;',
    '    float c = cos(topA), s2 = sin(topA);',
    '    rq = rq*c + cross(kAxis, rq)*s2 + kAxis*dot(kAxis, rq)*(1.0-c);',
    '    q = rq + pv;',
    '    vec3 nn2 = ex*aNrm.x + ez*aNrm.z + vec3(0.0, aNrm.y, 0.0);',
    '    nn2 = nn2*c + cross(kAxis, nn2)*s2 + kAxis*dot(kAxis, nn2)*(1.0-c);',
    '    vNrm = normalize(nn2);',
    '  } else {',
    '    vNrm = normalize(ex*aNrm.x + ez*aNrm.z + vec3(0.0, aNrm.y, 0.0));',
    '  }',
    '  vec3 P = base + q;',
    '  vWorld = P; vSeed = aI2.x; vBaseY = aI3.w; vH = h;',
    '  vState = aI2.y; vGlass = aI2.z; vClad = aI2.w;',
    '  vChar = aI3.x; vBurn = aI3.y; vRubble = aI3.z;',
    '  gl_Position = uVP*vec4(P,1.0);',
    '}'
  ].join('\n');

  S.buildFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec3 vWorld; in vec3 vNrm; in float vSeed; in float vBaseY;',
    'in float vGlass; in float vClad; in float vChar; in float vBurn;',
    'in float vRubble; in float vState; in float vH;',
    'uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol;',
    'uniform vec3 uFogCol; uniform float uFogDensity;',
    'uniform vec3 uBurst; uniform float uFlashLight; uniform vec3 uFlashCol; uniform float uThermalLam;',
    'uniform float uFlashScatter; uniform float uFlashR;',
    'uniform float uNight;',
    'out vec4 oCol;',
    'void main(){',
    '  vec3 N = normalize(vNrm);',
    '  float up = abs(N.y);',
    '  float tone = 0.55 + 0.45*hash11(vSeed*91.7);',
    '  vec3 alb;',
    '  vec3 emis = vec3(0.0);',
    '  if (vRubble > 0.5) {',
    // ── 废墟堆：混凝土碎块 + 砖屑 + 扬尘覆盖，顶面偏灰白
    '    float n1 = vnoise(vWorld.xz*0.55 + vSeed*31.0);',
    '    float n2 = vnoise(vWorld.xz*2.3 + vSeed*7.0);',
    '    vec3 conc = vec3(0.40,0.39,0.375), brick = vec3(0.33,0.22,0.17);',
    '    alb = mix(conc, brick, smoothstep(0.45,0.75,n1))*(0.62+0.55*n2);',
    '    alb = mix(alb, vec3(0.46,0.44,0.41), up*0.45);',
    '  } else {',
    // ── 立面：以世界坐标定义 3.2 m×3.6 m 的窗格模块（跨建筑一致）
    '    vec2 tang = vec2(-N.z, N.x);',
    '    float su = dot(vWorld.xz, tang);',
    '    float sv = vWorld.y - vBaseY;',
    '    vec3 concrete = vec3(0.52,0.50,0.47)*tone;',
    '    vec3 brickC = vec3(0.44,0.29,0.23)*tone;',
    '    vec3 panelC = vec3(0.44,0.47,0.50)*tone;',
    '    float mat = hash11(vSeed*3.13);',
    '    alb = mat < 0.34 ? brickC : (mat < 0.7 ? concrete : panelC);',
    '    if (up < 0.5) {',
    '      vec2 cell = vec2(su/3.2, sv/3.6);',
    '      vec2 fc = fract(cell);',
    '      float floorLine = smoothstep(0.10, 0.0, min(fc.y, 1.0-fc.y));',
    '      float winX = step(0.20, fc.x)*step(fc.x, 0.80);',
    '      float winY = step(0.22, fc.y)*step(fc.y, 0.86);',
    '      float sill = step(2.2, sv);',
    '      float win = winX*winY*sill;',
    // 玻璃：完好时反天光，破碎后是黑洞（内部无光）
    '      vec3 glassOK = mix(vec3(0.20,0.26,0.32), uSkyCol*0.9, 0.45);',
    '      float broken = smoothstep(0.15, 0.75, vGlass)*(0.35+0.65*hash21(floor(cell)+vSeed));',
    '      vec3 glassCol = mix(glassOK, vec3(0.035,0.033,0.03), broken);',
    '      alb = mix(alb, glassCol, win*0.92);',
    '      alb *= 1.0 - floorLine*0.18;',
    // 幕墙/外墙剥离：露出楼板与框架（强化水平楼层线，色调转向混凝土）
    '      float strip = smoothstep(0.25, 0.95, vClad);',
    '      float slab = smoothstep(0.16, 0.0, min(fc.y, 1.0-fc.y));',
    '      vec3 skel = mix(vec3(0.30,0.29,0.275), vec3(0.44,0.43,0.41), slab);',
    '      skel *= 0.75 + 0.5*hash21(floor(cell)*1.7 + vSeed*5.0);',
    '      alb = mix(alb, skel, strip*0.88);',
    '    } else {',
    // 屋顶：设备层/沥青防水，比立面更暗更脏
    '      float rn = vnoise(vWorld.xz*0.35 + vSeed*17.0);',
    '      alb = mix(alb*0.55, vec3(0.26,0.25,0.24), 0.55)*(0.8+0.45*rn);',
    '    }',
    '  }',
    // ── 迎爆面炭化：只黑化朝向爆心的那几面
    '  vec3 toB = normalize(uBurst - vWorld);',
    '  float facing = max(dot(N, toB), 0.0);',
    '  float charAmt = vChar*smoothstep(0.05, 0.65, facing);',
    '  alb = mix(alb, vec3(0.055,0.05,0.048), clamp(charAmt,0.0,0.93));',
    // ── 燃烧：内部火光从窗洞/裂缝透出（夜间尤其明显）
    '  if (vBurn > 0.02) {',
    '    float flick = 0.65 + 0.35*vnoise(vWorld.xz*0.9 + vec2(vSeed*23.0));',
    '    float low = exp(-max(vWorld.y - vBaseY, 0.0)/max(vH*0.55, 6.0));',
    '    emis += vec3(1.0,0.42,0.11)*vBurn*flick*low*(0.5 + 2.5*uNight);',
    '  }',
    '  float ndl = max(dot(N, normalize(uSunDir)), 0.0);',
    '  vec3 lit = alb*uSunCol*ndl*(1.0-uNight*0.92) + alb*uSkyCol*(0.32+0.68*max(N.y,0.0));',
    '  vec3 BL = uBurst - vWorld; float bl = length(BL);',
    '  float ndb = max(dot(N, BL/max(bl,1.0)), 0.0);',
    '  bl = max(bl, uFlashR*0.75);',
    // 直射 + 散射：否则闪光期背对爆心的立面会被曝光压成纯黑方块
    '  lit += alb*uFlashCol*(ndb + uFlashScatter)*',
    '         (uFlashLight/max(bl*bl,1.0))*exp(-bl/uThermalLam);',
    '  lit += emis;',
    '  float dist = length(uCamPos-vWorld);',
    '  float fog = 1.0-exp(-dist*uFogDensity);',
    '  oCol = vec4(hdrSafe(mix(lit, uFogCol, clamp(fog,0.0,1.0))), 1.0);',
    '}'
  ].join('\n');

  /* ============================ 粒子（实例化广告牌 + 软深度） ============================ */
  S.partVS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'layout(location=0) in vec2 aCorner;',
    'layout(location=1) in vec3 aP;',
    'layout(location=2) in vec4 aA;',   // size, temp, opacity, seed
    'layout(location=3) in vec4 aB;',   // kind, shade, unused, unused
    'uniform mat4 uView; uniform mat4 uProj;',
    'uniform vec3 uCamPos; uniform vec3 uSunDirV;',  // 视空间太阳方向
    'uniform vec3 uSunCol; uniform vec3 uSkyCol;',
    'uniform vec3 uBurst; uniform float uFlashLight; uniform vec3 uFlashCol;',
    'uniform float uEmissive; uniform float uThermalLam;',
    'uniform float uFlashR;',      // 火球半径（有限尺寸光源的距离下限）
    'uniform float uTime; uniform float uNight;',
    'out vec2 vUV; out vec3 vCol; out vec3 vEmi; out float vAlpha; out float vViewZ; out float vSizeV;',
    'void main(){',
    '  float size = aA.x, T = aA.y, opa = aA.z, seed = aA.w;',
    '  float kind = aB.x, shade = aB.y;',
    '  vec4 vp4 = uView*vec4(aP, 1.0);',
    '  float rot = seed*6.28318 + uTime*0.03*(seed-0.5);',
    '  float c = cos(rot), s = sin(rot);',
    '  vec2 q = vec2(aCorner.x*c - aCorner.y*s, aCorner.x*s + aCorner.y*c)*size;',
    '  vp4.xy += q;',
    '  vViewZ = -vp4.z; vSizeV = size;',
    '  gl_Position = uProj*vp4;',
    '  vUV = aCorner;',
    // —— 发射（黑体）：强度 ∝ T⁴ ——
    '  float TT = max(T, 1.0);',
    '  float em = uEmissive*pow(TT/3000.0, 4.0);',
    '  vEmi = blackbody(TT)*clamp(em, 0.0, 6000.0);',
    // —— 散射反照率：尘土 vs 水汽云 ——
    '  vec3 dust = vec3(0.40,0.33,0.25);',
    '  vec3 vapor = vec3(0.86,0.87,0.90);',
    '  vec3 soot = vec3(0.085,0.080,0.074);',   // 火场浓烟 = 炭黑，反照率极低
    '  vec3 alb;',
    '  if (kind < 0.5)      { alb = vapor*0.92; }',
    '  else if (kind < 1.5) { alb = vapor; }',
    '  else if (kind < 2.5) { alb = mix(dust, vapor, 0.30); }',
    '  else if (kind < 3.5) { alb = dust; }',
    '  else if (kind < 4.5) { alb = dust*0.72; }',
    '  else if (kind < 5.5) { alb = soot; }',
    '  else                 { alb = soot*1.5; }',
    // 伪球面法线做包裹光照 + 顶部受光/底部自阴影
    '  vec3 nv = normalize(vec3(aCorner, 0.75));',
    '  float ndl = max(dot(nv, normalize(uSunDirV)), 0.0);',
    '  float wrap = 0.5+0.5*dot(nv, normalize(uSunDirV));',
    '  vec3 lit = alb*uSunCol*(0.25*ndl + 0.55*wrap)*(1.0-uNight*0.9);',
    '  lit += alb*uSkyCol*(0.30+0.55*shade);',
    '  vec3 BL = uBurst - aP;',
    // 火球是有限尺寸的面光源：距离取火球半径为下限，否则火球内部的粒子
    // 会拿到 1/r²→∞ 的照度，在 RGBA16F 里溢出成 +Inf，再在 ACES 里变 NaN
    // （表现为一个被泛光扩散开的黑方块）
    '  float bl = max(length(BL), uFlashR*0.75);',
    '  lit += alb*uFlashCol*(uFlashLight/max(bl*bl,1.0))*exp(-bl/uThermalLam)*0.75;',
    '  vCol = min(lit*mix(0.35, 1.0, shade), vec3(HDR_MAX));',
    '  vEmi = min(vEmi, vec3(HDR_MAX));',
    '  vAlpha = opa;',
    '}'
  ].join('\n');

  S.partFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec2 vUV; in vec3 vCol; in vec3 vEmi; in float vAlpha; in float vViewZ; in float vSizeV;',
    'uniform sampler2D uDepth;',
    'uniform vec2 uRes; uniform float uNear; uniform float uFar;',
    'out vec4 oCol;',
    'void main(){',
    '  float d = length(vUV);',
    '  if (d > 1.0) { discard; }',
    // 高斯状软边（比线性衰减更像烟）
    '  float a = exp(-d*d*2.6) - 0.0733;',
    '  a = clamp(a*1.08, 0.0, 1.0);',
    '  a *= vAlpha;',
    '  if (a < 0.002) { discard; }',
    // 软粒子：与场景深度相交处渐隐，避免硬切边
    '  float sceneD = texture(uDepth, gl_FragCoord.xy/uRes).r;',
    '  float sceneZ = linDepth(sceneD, uNear, uFar);',
    '  float fade = clamp((sceneZ - vViewZ)/max(vSizeV*0.9, 1.0), 0.0, 1.0);',
    '  a *= fade;',
    '  vec3 col = vCol + vEmi;',
    '  oCol = vec4(hdrSafe(col*a), a);',   // 预乘 alpha（并钳制到 half-float 安全范围）
    '}'
  ].join('\n');

  /* ============================ 球壳：激波面 / 威尔逊凝结云 ============================ */
  S.shellVS = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos;',
    'uniform mat4 uVP; uniform vec3 uCenter; uniform float uRadius;',
    'uniform float uFlatten;',    // 触地压扁
    'out vec3 vN; out vec3 vWorld;',
    'void main(){',
    '  vec3 n = normalize(aPos);',
    '  vec3 p = uCenter + n*uRadius*vec3(1.0, uFlatten, 1.0);',
    '  vN = n; vWorld = p;',
    '  gl_Position = uVP*vec4(p,1.0);',
    '}'
  ].join('\n');

  S.shellFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec3 vN; in vec3 vWorld;',
    'uniform vec3 uCamPos;',
    'uniform float uMode;',       // 0 = 激波面（加性）, 1 = 凝结云（alpha）
    'uniform float uStrength;',
    'uniform vec3 uTint;',
    'uniform float uTime;',
    'uniform vec3 uSunDir; uniform vec3 uSkyCol;',
    'out vec4 oCol;',
    'void main(){',
    '  vec3 V = normalize(uCamPos - vWorld);',
    '  float ndv = abs(dot(normalize(vN), V));',
    '  float rim = pow(1.0-ndv, 3.4);',
    '  float n = vnoise3(vN*7.0 + vec3(0.0, uTime*0.15, 0.0));',
    '  if (uMode < 0.5) {',
    // 激波面：极薄的高亮边缘（压缩空气的折射/发光），正对视线处几乎透明
    '    float a = rim*uStrength*(0.72+0.55*n);',
    '    oCol = vec4(uTint*a, a*0.35);',
    '  } else {',
    // 凝结云：厚壳、白色、边缘更实（视线穿过的水汽路径更长）
    '    float a = clamp((0.30+0.85*rim)*uStrength*(0.55+0.75*n), 0.0, 1.0);',
    '    float ndl = 0.55+0.45*dot(normalize(vN), normalize(uSunDir));',
    '    vec3 col = uTint*(0.75*ndl) + uSkyCol*0.35;',
    '    oCol = vec4(col*a, a);',
    '  }',
    '}'
  ].join('\n');

  /* ============================ 后处理 ============================ */
  S.fsQuadVS = [
    '#version 300 es',
    'layout(location=0) in vec2 aPos;',
    'out vec2 vUV;',
    'void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }'
  ].join('\n');

  // 激波折射：屏幕空间环带位移（密度梯度造成的透镜效应）+ 轻微色散
  S.distortFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform vec2 uCenter;',      // 爆心屏幕坐标（像素）
    'uniform float uR;',          // 激波环屏幕半径（像素）
    'uniform float uW;',          // 环宽（像素）
    'uniform float uAmp;',        // 位移幅度（像素）
    'uniform float uVisible;',
    'out vec4 oCol;',
    'void main(){',
    '  vec2 px = vUV*uRes;',
    '  vec2 dv = px - uCenter;',
    '  float d = length(dv);',
    '  vec3 col;',
    '  if (uVisible < 0.5 || uW <= 0.0) {',
    '    col = texture(uTex, vUV).rgb;',
    '  } else {',
    '    float prof = exp(-pow((d-uR)/max(uW,1.0), 2.0));',
    '    float sgn = sign(d-uR);',
    '    vec2 dir = dv/max(d,1.0);',
    '    vec2 off = dir*prof*uAmp*sgn;',
    '    vec2 uv0 = vUV + off/uRes;',
    '    vec2 uv1 = vUV + off*1.10/uRes;',
    '    vec2 uv2 = vUV + off*0.90/uRes;',
    '    col = vec3(texture(uTex, uv1).r, texture(uTex, uv0).g, texture(uTex, uv2).b);',
    '    col += vec3(0.55,0.62,0.85)*prof*0.05*uAmp/max(uW,1.0);',
    '  }',
    '  oCol = vec4(col, 1.0);',
    '}'
  ].join('\n');

  S.brightFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'uniform sampler2D uTex;',
    'uniform float uThreshold;',
    'uniform float uExposure;',
    'out vec4 oCol;',
    'void main(){',
    '  vec3 c = texture(uTex, vUV).rgb*uExposure;',
    '  if (any(isnan(c)) || any(isinf(c))) { c = vec3(uThreshold); }',
    '  c = clamp(c, vec3(0.0), vec3(4096.0));',
    '  float l = dot(c, vec3(0.2126,0.7152,0.0722));',
    '  float k = max(l-uThreshold, 0.0)/max(l, 1e-4);',
    '  oCol = vec4(c*k, 1.0);',
    '}'
  ].join('\n');

  S.blurFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'uniform sampler2D uTex;',
    'uniform vec2 uDir;',        // 像素步长方向
    'out vec4 oCol;',
    'void main(){',
    '  float w[5];',
    '  w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;',
    '  vec3 c0 = texture(uTex, vUV).rgb;',
    '  if (any(isnan(c0)) || any(isinf(c0))) { c0 = vec3(0.0); }',
    '  vec3 s = c0*w[0];',
    '  for (int i=1;i<5;i++){',
    '    vec3 cp = texture(uTex, vUV + uDir*float(i)).rgb;',
    '    vec3 cm = texture(uTex, vUV - uDir*float(i)).rgb;',
    '    if (any(isnan(cp)) || any(isinf(cp))) { cp = vec3(0.0); }',
    '    if (any(isnan(cm)) || any(isinf(cm))) { cm = vec3(0.0); }',
    '    s += cp*w[i]; s += cm*w[i];',
    '  }',
    '  oCol = vec4(s, 1.0);',
    '}'
  ].join('\n');

  S.compositeFS = [
    '#version 300 es',
    'precision highp float;',
    COMMON,
    'in vec2 vUV;',
    'uniform sampler2D uScene;',
    'uniform sampler2D uBloom1;',
    'uniform sampler2D uBloom2;',
    'uniform float uExposure;',
    'uniform float uBloom;',
    'uniform float uWhiteout;',   // 视网膜过曝
    'uniform float uGrain;',
    'uniform float uTime;',
    'uniform float uVignette;',
    'out vec4 oCol;',
    // ACES filmic 近似（Narkowicz）
    'vec3 aces(vec3 x){',
    '  const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;',
    '  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);',
    '}',
    'void main(){',
    '  vec3 c = texture(uScene, vUV).rgb;',
    '  vec3 b = texture(uBloom1, vUV).rgb + texture(uBloom2, vUV).rgb*0.85;',
    // 任何 Inf/NaN 都会在 ACES 里变成 NaN 并显示为黑块；此处判定为「极亮」
    // 而不是黑（注意 NaN*0 仍是 NaN，所以关掉泛光也挡不住，必须显式拦截）
    '  if (any(isnan(c)) || any(isinf(c))) { c = vec3(1e4); }',
    '  if (any(isnan(b)) || any(isinf(b))) { b = vec3(0.0); }',
    '  c = c*uExposure + b*uBloom;',
    '  c = aces(max(c, vec3(0.0)));',
    '  c = mix(c, vec3(1.0), clamp(uWhiteout, 0.0, 1.0));',
    // 暗角
    '  vec2 q = vUV-0.5;',
    '  c *= 1.0 - uVignette*dot(q,q)*1.35;',
    // 胶片颗粒
    '  float g = hash21(vUV*uRes_dummy() + fract(uTime)*137.0)-0.5;',
    '  c += g*uGrain;',
    '  c = pow(max(c, 0.0), vec3(1.0/2.2));',
    '  oCol = vec4(c, 1.0);',
    '}'
  ].join('\n').replace('uRes_dummy()', 'vec2(1920.0,1080.0)');

  /* 调试：把一张纹理直接画出来 */
  S.blitFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'uniform sampler2D uTex;',
    'out vec4 oCol;',
    'void main(){ oCol = vec4(texture(uTex, vUV).rgb, 1.0); }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : this);
