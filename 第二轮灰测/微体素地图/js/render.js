/* =====================================================================
   微体素地图 · 渲染管线
   HDR 场景 → 泛光(bloom) → ACES 色调映射 + 暗角 + 颗粒
   光照 = 烘焙日照遮蔽 (顶点/贴图) + 天空环境 + 3D 霓虹体积 + 自发光
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, G = VX.G;

  /* ---------------------- 时段调色（晨昏色调） ---------------------- */
  var KEYS = [
    { t: 0.00, name: '深夜',  sun: [0.30, 0.42, 0.70], sunI: 0.05, zen: [0.014, 0.022, 0.058], hor: [0.042, 0.044, 0.100],
      ambS: [0.070, 0.098, 0.190], ambG: [0.024, 0.028, 0.048], neon: 1.70, star: 1.0, fogD: 0.00022, exp: 1.20, glow: [0.26, 0.36, 0.76] },
    { t: 0.16, name: '黎明',  sun: [1.00, 0.52, 0.34], sunI: 0.50, zen: [0.078, 0.108, 0.250], hor: [0.640, 0.320, 0.270],
      ambS: [0.180, 0.180, 0.310], ambG: [0.078, 0.062, 0.068], neon: 1.20, star: 0.32, fogD: 0.00034, exp: 1.14, glow: [1.00, 0.52, 0.34] },
    { t: 0.32, name: '晨光',  sun: [1.00, 0.86, 0.68], sunI: 0.92, zen: [0.190, 0.340, 0.610], hor: [0.520, 0.545, 0.610],
      ambS: [0.300, 0.375, 0.520], ambG: [0.140, 0.132, 0.118], neon: 0.55, star: 0.00, fogD: 0.00026, exp: 0.98, glow: [1.00, 0.86, 0.70] },
    { t: 0.50, name: '正午',  sun: [1.00, 0.97, 0.92], sunI: 1.12, zen: [0.175, 0.365, 0.740], hor: [0.500, 0.610, 0.760],
      ambS: [0.340, 0.430, 0.590], ambG: [0.165, 0.160, 0.145], neon: 0.30, star: 0.00, fogD: 0.00020, exp: 0.82, glow: [1.00, 0.98, 0.92] },
    { t: 0.68, name: '黄昏',  sun: [1.00, 0.60, 0.28], sunI: 1.00, zen: [0.115, 0.190, 0.440], hor: [0.820, 0.415, 0.220],
      ambS: [0.235, 0.250, 0.400], ambG: [0.125, 0.094, 0.086], neon: 0.90, star: 0.06, fogD: 0.00030, exp: 1.06, glow: [1.00, 0.54, 0.24] },
    { t: 0.84, name: '暮色',  sun: [0.86, 0.40, 0.44], sunI: 0.30, zen: [0.052, 0.068, 0.185], hor: [0.320, 0.165, 0.300],
      ambS: [0.140, 0.150, 0.280], ambG: [0.058, 0.048, 0.066], neon: 1.40, star: 0.55, fogD: 0.00032, exp: 1.24, glow: [0.80, 0.32, 0.52] },
    { t: 1.00, name: '深夜',  sun: [0.30, 0.42, 0.70], sunI: 0.05, zen: [0.014, 0.022, 0.058], hor: [0.042, 0.044, 0.100],
      ambS: [0.070, 0.098, 0.190], ambG: [0.024, 0.028, 0.048], neon: 1.70, star: 1.0, fogD: 0.00022, exp: 1.20, glow: [0.26, 0.36, 0.76] }
  ];
  VX.TIMEKEYS = KEYS;

  function sampleTime(t) {
    t = ((t % 1) + 1) % 1;
    var i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    k = M.smooth(M.clamp(k, 0, 1));
    return {
      name: k < 0.5 ? a.name : b.name,
      sun: M.mix3(a.sun, b.sun, k), sunI: M.lerp(a.sunI, b.sunI, k),
      zen: M.mix3(a.zen, b.zen, k), hor: M.mix3(a.hor, b.hor, k),
      ambS: M.mix3(a.ambS, b.ambS, k), ambG: M.mix3(a.ambG, b.ambG, k),
      glow: M.mix3(a.glow, b.glow, k),
      neon: M.lerp(a.neon, b.neon, k), star: M.lerp(a.star, b.star, k),
      fogD: M.lerp(a.fogD, b.fogD, k), exp: M.lerp(a.exp, b.exp, k)
    };
  }
  VX.sampleTime = sampleTime;

  /* ------------------------- 共享 GLSL ------------------------- */
  var GLSL_SKY = [
    'uniform vec3 uZen, uHor, uSunCol, uSunGlow, uSunDir;',
    'uniform float uStar, uSunI;',
    'float h11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }',
    'float h31(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yzx+33.33); return fract((p.x+p.y)*p.z); }',
    'vec3 skyColor(vec3 d){',
    '  float up = clamp(d.y, -1.0, 1.0);',
    '  vec3 c = mix(uHor, uZen, pow(clamp(up,0.0,1.0), 0.52));',
    // 地平线以下：迅速沉入深空，让悬浮沙盘与背景分离
    '  if (up < 0.0) c = mix(uHor*0.62, uZen*0.16 + vec3(0.008,0.010,0.020), clamp(-up*1.7,0.0,1.0));',
    '  float s = max(dot(d, uSunDir), 0.0);',
    '  c += uSunGlow * pow(s, 6.0) * 0.42 * smoothstep(-0.12, 0.10, up);',
    '  c += uSunCol * smoothstep(0.9975, 0.9992, s) * 26.0 * max(uSunI, 0.12);',
    '  if (uStar > 0.001) {',
    '    vec3 q = floor(d * 320.0);',
    '    float st = h31(q);',
    '    float br = smoothstep(0.9975, 1.0, st) * (0.55 + 0.45*sin(uTime*2.0 + st*80.0));',
    '    c += vec3(0.80,0.88,1.0) * br * uStar * 2.4 * smoothstep(-0.02, 0.35, up);',
    '  }',
    // 赛博朋克地平线霞带
    '  float band = exp(-abs(up-0.012)*54.0);',
    '  c += mix(vec3(0.32,0.10,0.46), vec3(0.06,0.30,0.42), h11(floor(d.x*7.0)+floor(d.z*7.0))) * band * 0.30;',
    '  return c;',
    '}'
  ].join('\n');

  var GLSL_FOG = [
    'uniform vec3 uCamPos; uniform float uFogD, uFogY, uFogFall;',
    'vec3 applyFog(vec3 col, vec3 wpos){',
    '  vec3 v = wpos - uCamPos; float dist = length(v);',
    '  float hf = exp(-max(0.0, wpos.y - uFogY) * uFogFall);',
    '  float f = 1.0 - exp(-dist * uFogD * (0.35 + 0.65*hf));',
    '  return mix(col, skyColor(normalize(v)), clamp(f, 0.0, 0.96));',
    '}'
  ].join('\n');

  var GLSL_VOL = [
    'uniform sampler3D uVol; uniform vec3 uWorldSize; uniform float uNeonMul;',
    'vec3 neonAt(vec3 p){',
    '  vec3 uv = vec3(p.x/uWorldSize.x, p.z/uWorldSize.z, p.y/uWorldSize.y);',
    '  vec4 t = texture(uVol, clamp(uv, 0.0, 1.0));',
    '  return t.rgb * max(1.0, t.a*2.656) * uNeonMul;',
    '}'
  ].join('\n');

  /* ------------------------- 体素着色器 ------------------------- */
  var VOX_VS = [
    '#version 300 es',
    'in vec3 aPos; in float aNrm; in float aAO; in float aSun; in float aEmis;',
    'in float aFlk; in float aAlpha; in vec3 aAlb; in float aFMode;',
    'uniform mat4 uVP;',
    'out vec3 vPos; out vec3 vNrm; out vec3 vAlb;',
    'out float vAO; out float vSun; out float vEmis; out float vFlk; out float vAlpha; out float vFMode;',
    'const vec3 NR[6] = vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));',
    'void main(){',
    '  vec3 p = aPos * 0.5;',
    '  vPos = p; vNrm = NR[int(aNrm+0.5)]; vAlb = aAlb;',
    '  vAO = aAO; vSun = aSun; vEmis = aEmis*1.5; vFlk = aFlk; vAlpha = aAlpha; vFMode = aFMode;',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var VOX_FS = [
    '#version 300 es',
    'precision highp float; precision highp sampler3D;',
    'in vec3 vPos; in vec3 vNrm; in vec3 vAlb;',
    'in float vAO; in float vSun; in float vEmis; in float vFlk; in float vAlpha; in float vFMode;',
    'uniform float uTime; uniform vec3 uAmbS, uAmbG; uniform float uEdge;',
    GLSL_SKY, GLSL_FOG, GLSL_VOL,
    'out vec4 fragColor;',
    'float flicker(){',
    '  if (vFMode < 0.5) return 1.0;',
    '  float ph = vFlk * 62.83;',
    '  if (vFMode < 1.5) return 0.80 + 0.20*sin(uTime*1.6 + ph);',
    '  if (vFMode < 2.5) return 0.84 + 0.16*sin(uTime*8.0 + ph);',
    '  float t = fract(uTime*0.63 + vFlk);',
    '  return t < 0.055 ? 0.10 : (t < 0.10 ? 0.62 : 1.0);',
    '}',
    'void main(){',
    '  vec3 N = vNrm; vec3 alb = vAlb;',
    '  float fk = flicker();',
    '  float ndl = max(dot(N, uSunDir), 0.0);',
    '  vec3 amb = mix(uAmbG, uAmbS, N.y*0.5+0.5) * (0.20 + 0.80*vAO);',
    '  vec3 lit = amb + uSunCol * uSunI * ndl * vSun * (0.42 + 0.58*vAO);',
    '  vec3 neon = neonAt(vPos + N*1.6) * (0.24 + 0.76*vAO);',
    '  neon = neon / (1.0 + neon*0.62);',   // 软上限：密集霓虹饱和而不过曝
    '  vec3 col = alb * (lit + neon);',
    '  col += alb * vEmis * fk * 1.45;',
    // 高光：金属/玻璃的简易镜面
    '  vec3 V = normalize(uCamPos - vPos);',
    '  vec3 Hf = normalize(V + uSunDir);',
    '  float spec = pow(max(dot(N, Hf), 0.0), 42.0) * vSun * uSunI;',
    '  col += uSunCol * spec * (vAlpha < 0.99 ? 0.85 : 0.16);',
    '  col = applyFog(col, vPos);',
    '  fragColor = vec4(col * vAlpha, vAlpha);',   // 预乘 alpha：玻璃/光晕体不再叠爆
    '}'
  ].join('\n');

  /* ------------------------- 地形着色器 ------------------------- */
  var TER_VS = [
    '#version 300 es',
    'in vec3 aPos; in vec2 aUV; in float aNrm; in float aKind;',
    'uniform mat4 uVP;',
    'out vec3 vPos; out vec2 vUV; out vec3 vNrm; out float vKind;',
    'const vec3 NR[6] = vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));',
    'void main(){',
    '  vec3 p = aPos * 0.5;',
    '  vPos = p; vUV = aUV * 0.5; vNrm = NR[int(aNrm+0.5)]; vKind = aKind;',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var TER_FS = [
    '#version 300 es',
    'precision highp float; precision highp sampler3D;',
    'in vec3 vPos; in vec2 vUV; in vec3 vNrm; in float vKind;',
    'uniform sampler2D uAlb; uniform sampler2D uSunMap;',
    'uniform float uTime; uniform vec3 uAmbS, uAmbG;',
    GLSL_SKY, GLSL_FOG, GLSL_VOL,
    'out vec4 fragColor;',
    'void main(){',
    '  vec2 uv = vUV / uWorldSize.xz;',
    '  vec4 a = texture(uAlb, uv);',
    '  vec3 alb = a.rgb; float ao = a.a;',
    '  float sunv = texture(uSunMap, uv).r;',
    '  vec3 N = vNrm;',
    '  if (vKind > 1.5) {',                       // 底座
    '    float g = step(0.94, fract(vPos.x*0.125)) + step(0.94, fract(vPos.z*0.125));',
    '    alb = mix(vec3(0.115,0.125,0.152), vec3(0.20,0.23,0.30), clamp(g,0.0,1.0));',
    '    alb *= 0.55 + 0.45*smoothstep(-2.0, 18.0, vPos.y);',
    '    ao = 0.55; sunv = 0.0;',
    '  } else if (vKind > 0.5) {',                // 侧壁：岩层带
    '    float bi = floor(vPos.y * 0.5);',
    '    float bn = h11(bi*1.7);',
    '    alb *= 0.72 + 0.42*bn;',
    '    alb *= 0.80 + 0.20*h11(floor(vUV.x*0.7)+bi*3.1);',
    '    ao *= 0.86; sunv *= 0.55;',
    '  }',
    '  float ndl = max(dot(N, uSunDir), 0.0);',
    '  vec3 amb = mix(uAmbG, uAmbS, N.y*0.5+0.5) * (0.18 + 0.82*ao);',
    '  vec3 lit = amb + uSunCol * uSunI * ndl * sunv * (0.38 + 0.62*ao);',
    '  vec3 neon = neonAt(vPos + N*1.8) * (0.30 + 0.70*ao);',
    '  neon = neon / (1.0 + neon*0.62);',
    '  vec3 col = alb * (lit + neon);',
    '  col = applyFog(col, vPos);',
    '  fragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------- 水面着色器 ------------------------- */
  var WAT_FS = [
    '#version 300 es',
    'precision highp float; precision highp sampler3D;',
    'in vec3 vPos; in vec2 vUV; in vec3 vNrm; in float vKind;',
    'uniform float uTime; uniform vec3 uAmbS, uAmbG;',
    GLSL_SKY, GLSL_FOG, GLSL_VOL,
    'out vec4 fragColor;',
    'void main(){',
    '  float w1 = sin(vPos.x*0.42 + uTime*1.1) * 0.5 + sin(vPos.z*0.31 - uTime*0.8) * 0.5;',
    '  float w2 = sin((vPos.x+vPos.z)*0.23 + uTime*0.55);',
    '  vec3 N = normalize(vec3(w1*0.11, 1.0, w2*0.11));',
    '  if (vNrm.y < 0.5) N = vNrm;',
    '  vec3 V = normalize(uCamPos - vPos);',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.4);',
    '  vec3 R = reflect(-V, N);',
    '  vec3 refl = skyColor(normalize(R));',
    '  vec3 deep = mix(vec3(0.035,0.115,0.185), vec3(0.06,0.20,0.28), 0.5+0.5*w2);',
    '  vec3 neon = neonAt(vPos + vec3(0.0, 2.5, 0.0)) * 0.9;',
    '  vec3 Hf = normalize(V + uSunDir);',
    '  float spec = pow(max(dot(N, Hf), 0.0), 160.0) * 3.2 * uSunI;',
    '  vec3 col = mix(deep * (0.35 + uAmbS), refl, clamp(0.16 + fres*0.86, 0.0, 1.0));',
    '  col += uSunCol * spec + neon;',
    '  col = applyFog(col, vPos);',
    '  fragColor = vec4(col, 0.80);',
    '}'
  ].join('\n');

  /* ------------------------- 天空 ------------------------- */
  var SKY_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'uniform float uTime; uniform vec3 uCamRight, uCamUp, uCamFwd; uniform vec2 uTan;',
    GLSL_SKY,
    'out vec4 fragColor;',
    'void main(){',
    '  vec2 n = vUV*2.0 - 1.0;',
    '  vec3 d = normalize(uCamFwd + uCamRight*n.x*uTan.x + uCamUp*n.y*uTan.y);',
    '  fragColor = vec4(skyColor(d), 1.0);',
    '}'
  ].join('\n');

  /* ------------------------- 后处理 ------------------------- */
  var BRIGHT_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vUV;',
    'uniform sampler2D uTex; uniform float uThresh, uKnee;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec3 c = texture(uTex, vUV).rgb;',
    '  float l = max(c.r, max(c.g, c.b));',
    '  float s = clamp((l - uThresh) / max(uKnee, 1e-4), 0.0, 1.0);',
    '  fragColor = vec4(c * s * s, 1.0);',
    '}'
  ].join('\n');

  var BLUR_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vUV;',
    'uniform sampler2D uTex; uniform vec2 uDir;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec3 s = texture(uTex, vUV).rgb * 0.227027;',
    '  s += (texture(uTex, vUV + uDir*1.3846).rgb + texture(uTex, vUV - uDir*1.3846).rgb) * 0.316216;',
    '  s += (texture(uTex, vUV + uDir*3.2308).rgb + texture(uTex, vUV - uDir*3.2308).rgb) * 0.070270;',
    '  fragColor = vec4(s, 1.0);',
    '}'
  ].join('\n');

  var COMP_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vUV;',
    'uniform sampler2D uScene, uB1, uB2, uB3;',
    'uniform float uExp, uBloom, uVig, uGrain, uTime, uSat;',
    'out vec4 fragColor;',
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
    'void main(){',
    '  vec3 c = texture(uScene, vUV).rgb;',
    '  vec3 b = texture(uB1, vUV).rgb*0.46 + texture(uB2, vUV).rgb*0.30 + texture(uB3, vUV).rgb*0.22;',
    '  c += b * uBloom;',
    '  c *= uExp;',
    '  c = aces(c);',
    // 分离色调（青影 / 暖高光）—— 赛博朋克底味
    '  float l = dot(c, vec3(0.2126,0.7152,0.0722));',
    '  vec3 shadowT = vec3(0.86, 0.97, 1.14);',
    '  vec3 highT   = vec3(1.07, 0.995, 0.92);',
    '  c *= mix(shadowT, highT, smoothstep(0.10, 0.72, l));',
    '  c = mix(vec3(l), c, uSat);',
    // 轻微 S 曲线，提对比
    '  c = clamp(c, 0.0, 1.4);',
    '  c = c*c*(3.0-2.0*clamp(c,0.0,1.0))*0.34 + c*0.66;',
    '  vec2 q = vUV - 0.5;',
    '  c *= 1.0 - uVig * dot(q,q) * 2.05;',
    '  float g = fract(sin(dot(vUV*vec2(1234.5,6789.1) + uTime, vec2(12.9898,78.233)))*43758.5453);',
    '  c += (g - 0.5) * uGrain;',
    '  fragColor = vec4(pow(max(c, 0.0), vec3(1.0/2.2)), 1.0);',
    '}'
  ].join('\n');

  /* ========================= Renderer ========================= */
  function Renderer(canvas) {
    var gl = this.gl = G.create(canvas);
    this.canvas = canvas;
    this.progVox = G.program(gl, VOX_VS, VOX_FS, 'vox');
    this.progTer = G.program(gl, TER_VS, TER_FS, 'ter');
    this.progWat = G.program(gl, TER_VS, WAT_FS, 'wat');
    this.progSky = G.program(gl, G.fullscreenVS, SKY_FS, 'sky');
    this.progBright = G.program(gl, G.fullscreenVS, BRIGHT_FS, 'bright');
    this.progBlur = G.program(gl, G.fullscreenVS, BLUR_FS, 'blur');
    this.progComp = G.program(gl, G.fullscreenVS, COMP_FS, 'comp');
    this.emptyVAO = gl.createVertexArray();

    this.sunDir = M.norm3([0.60, 0.50, 0.62]);
    this.time = 0.68;
    this.clock = 0;
    this.opts = { bloom: 1.0, fog: 1.0, neon: 1.0, grain: 0.016, vignette: 0.46, sat: 1.14, glass: true, water: true };
    this.stats = { drawn: 0, quads: 0, sectors: 0 };
    this.sectors = [];
    this.terrain = [];
    this.water = null;
    this.fbo = null;
    this.bloomFBO = [];
    this._size = [0, 0];
  }
  var R = Renderer.prototype;

  R.attr = function (prog, name, size, type, norm, stride, off) {
    var gl = this.gl, loc = prog.a[name];
    if (loc == null || loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, type, !!norm, stride, off);
  };

  /** 上传全部网格；shared 索引缓冲复用 */
  R.upload = function (data) {
    var gl = this.gl, i;
    var maxQuads = 0;
    for (i = 0; i < data.voxels.meshes.length; i++) maxQuads = Math.max(maxQuads, data.voxels.meshes[i].quads);
    for (i = 0; i < data.terrain.meshes.length; i++) maxQuads = Math.max(maxQuads, data.terrain.meshes[i].quads);
    if (data.water) maxQuads = Math.max(maxQuads, data.water.quads);
    var idx = new Uint32Array(maxQuads * 6);
    for (i = 0; i < maxQuads; i++) {
      var b = i * 4, o = i * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
      idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
    }
    this.ibo = G.buffer(gl, gl.ELEMENT_ARRAY_BUFFER, idx);
    this.maxQuads = maxQuads;

    var self = this;
    function mkVox(m) {
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      var vbo = G.buffer(gl, gl.ARRAY_BUFFER, m.data);
      var S = 16, P = self.progVox;
      self.attr(P, 'aPos', 3, gl.UNSIGNED_SHORT, false, S, 0);
      self.attr(P, 'aNrm', 1, gl.UNSIGNED_BYTE, false, S, 6);
      self.attr(P, 'aAO', 1, gl.UNSIGNED_BYTE, true, S, 7);
      self.attr(P, 'aSun', 1, gl.UNSIGNED_BYTE, true, S, 8);
      self.attr(P, 'aEmis', 1, gl.UNSIGNED_BYTE, true, S, 9);
      self.attr(P, 'aFlk', 1, gl.UNSIGNED_BYTE, true, S, 10);
      self.attr(P, 'aAlpha', 1, gl.UNSIGNED_BYTE, true, S, 11);
      self.attr(P, 'aAlb', 3, gl.UNSIGNED_BYTE, true, S, 12);
      self.attr(P, 'aFMode', 1, gl.UNSIGNED_BYTE, false, S, 15);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.ibo);
      gl.bindVertexArray(null);
      return { vao: vao, quads: m.quads, pass: m.pass, aabb: [m.x0, 0, m.z0, m.x1, VX.SY, m.z1] };
    }
    function mkTer(m, prog) {
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      G.buffer(gl, gl.ARRAY_BUFFER, m.data);
      var S = 12;
      self.attr(prog, 'aPos', 3, gl.UNSIGNED_SHORT, false, S, 0);
      self.attr(prog, 'aUV', 2, gl.UNSIGNED_SHORT, false, S, 6);
      self.attr(prog, 'aNrm', 1, gl.UNSIGNED_BYTE, false, S, 10);
      self.attr(prog, 'aKind', 1, gl.UNSIGNED_BYTE, false, S, 11);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.ibo);
      gl.bindVertexArray(null);
      return { vao: vao, quads: m.quads,
        aabb: [m.x0 != null ? m.x0 : 0, 0, m.z0 != null ? m.z0 : 0,
               m.x1 != null ? m.x1 : VX.SX, VX.SY, m.z1 != null ? m.z1 : VX.SZ] };
    }

    this.sectors = data.voxels.meshes.map(mkVox);
    this.terrain = data.terrain.meshes.map(function (m) { return mkTer(m, self.progTer); });
    this.water = data.water ? mkTer(data.water, this.progWat) : null;
    this.stats.quads = data.voxels.faces + data.terrain.quads;

    // 地形贴图
    this.texAlb = G.tex2D(gl, VX.SX, VX.SZ, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data.terrain.albedo, gl.NEAREST);
    this.texSun = G.tex2D(gl, data.terrain.sunW || VX.SX, data.terrain.sunH || VX.SZ,
      gl.R8, gl.RED, gl.UNSIGNED_BYTE, data.terrain.sun, gl.LINEAR);

    // 霓虹体积（3D）
    var v = data.lightVol;
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, v.w, v.d, v.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, v.data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    this.texVol = t;
    this.volScale = v.scale;
  };

  R.resize = function () {
    var gl = this.gl, cv = this.canvas;
    var dpr = Math.min(root.devicePixelRatio || 1, 1.75);
    var w = Math.max(2, Math.round(cv.clientWidth * dpr));
    var h = Math.max(2, Math.round(cv.clientHeight * dpr));
    if (w === this._size[0] && h === this._size[1]) return;
    cv.width = w; cv.height = h; this._size = [w, h];
    this.fbo = G.fbo(gl, w, h, true, true);
    var bw = w >> 1, bh = h >> 1;
    this.bloomFBO = [];
    for (var i = 0; i < 3; i++) {
      this.bloomFBO.push([G.fbo(gl, Math.max(2, bw), Math.max(2, bh), true, false),
                          G.fbo(gl, Math.max(2, bw), Math.max(2, bh), true, false)]);
      bw >>= 1; bh >>= 1;
    }
  };

  R.setUniformsCommon = function (P, cam, tp) {
    var gl = this.gl;
    gl.uniform3f(P.u.uZen, tp.zen[0], tp.zen[1], tp.zen[2]);
    gl.uniform3f(P.u.uHor, tp.hor[0], tp.hor[1], tp.hor[2]);
    gl.uniform3f(P.u.uSunCol, tp.sun[0], tp.sun[1], tp.sun[2]);
    gl.uniform3f(P.u.uSunGlow, tp.glow[0], tp.glow[1], tp.glow[2]);
    gl.uniform3f(P.u.uSunDir, this.sunDir[0], this.sunDir[1], this.sunDir[2]);
    gl.uniform1f(P.u.uSunI, tp.sunI);
    gl.uniform1f(P.u.uStar, tp.star);
    gl.uniform1f(P.u.uTime, this.clock);
    if (P.u.uAmbS) gl.uniform3f(P.u.uAmbS, tp.ambS[0], tp.ambS[1], tp.ambS[2]);
    if (P.u.uAmbG) gl.uniform3f(P.u.uAmbG, tp.ambG[0], tp.ambG[1], tp.ambG[2]);
    if (P.u.uCamPos) gl.uniform3f(P.u.uCamPos, cam.eye[0], cam.eye[1], cam.eye[2]);
    if (P.u.uFogD) gl.uniform1f(P.u.uFogD, tp.fogD * this.opts.fog);
    if (P.u.uFogY) gl.uniform1f(P.u.uFogY, 28.0);
    if (P.u.uFogFall) gl.uniform1f(P.u.uFogFall, 0.034);
    if (P.u.uWorldSize) gl.uniform3f(P.u.uWorldSize, VX.SX, VX.SY, VX.SZ);
    if (P.u.uNeonMul) gl.uniform1f(P.u.uNeonMul, this.volScale * tp.neon * this.opts.neon);
    if (P.u.uVP) gl.uniformMatrix4fv(P.u.uVP, false, cam.viewProj);
  };

  R.render = function (cam, dt) {
    var gl = this.gl, i, s;
    this.clock += dt;
    this.resize();
    var tp = sampleTime(this.time);
    var W = this._size[0], H = this._size[1];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* 天空 */
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(this.progSky);
    var right = M.norm3([-Math.sin(cam.yaw), 0, Math.cos(cam.yaw)]);
    var fwd = cam.fwd;
    var up = M.norm3([fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]]);
    this.setUniformsCommon(this.progSky, cam, tp);
    gl.uniform3f(this.progSky.u.uCamRight, right[0], right[1], right[2]);
    gl.uniform3f(this.progSky.u.uCamUp, up[0], up[1], up[2]);
    gl.uniform3f(this.progSky.u.uCamFwd, fwd[0], fwd[1], fwd[2]);
    var th = Math.tan(cam.fov / 2);
    gl.uniform2f(this.progSky.u.uTan, th * (W / H), th);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 场景 */
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    var planes = cam.planes, drawn = 0;

    // 地形
    gl.useProgram(this.progTer);
    this.setUniformsCommon(this.progTer, cam, tp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texAlb);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texSun);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, this.texVol);
    gl.uniform1i(this.progTer.u.uAlb, 0);
    gl.uniform1i(this.progTer.u.uSunMap, 1);
    gl.uniform1i(this.progTer.u.uVol, 2);
    for (i = 0; i < this.terrain.length; i++) {
      s = this.terrain[i];
      if (M.aabbOutside(planes, s.aabb[0], s.aabb[1], s.aabb[2], s.aabb[3], s.aabb[4], s.aabb[5])) continue;
      gl.bindVertexArray(s.vao);
      gl.drawElements(gl.TRIANGLES, s.quads * 6, gl.UNSIGNED_INT, 0);
      drawn++;
    }

    // 体素：不透明
    gl.useProgram(this.progVox);
    this.setUniformsCommon(this.progVox, cam, tp);
    gl.uniform1i(this.progVox.u.uVol, 2);
    for (i = 0; i < this.sectors.length; i++) {
      s = this.sectors[i];
      if (s.pass !== 0) continue;
      if (M.aabbOutside(planes, s.aabb[0], s.aabb[1], s.aabb[2], s.aabb[3], s.aabb[4], s.aabb[5])) continue;
      gl.bindVertexArray(s.vao);
      gl.drawElements(gl.TRIANGLES, s.quads * 6, gl.UNSIGNED_INT, 0);
      drawn++;
    }

    // 水
    if (this.water && this.opts.water) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.progWat);
      this.setUniformsCommon(this.progWat, cam, tp);
      gl.uniform1i(this.progWat.u.uVol, 2);
      gl.bindVertexArray(this.water.vao);
      gl.drawElements(gl.TRIANGLES, this.water.quads * 6, gl.UNSIGNED_INT, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 体素：半透明 + 叠加发光
    if (this.opts.glass) {
      gl.useProgram(this.progVox);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for (var pass = 1; pass <= 2; pass++) {
        gl.blendFunc(gl.ONE, pass === 1 ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
        for (i = 0; i < this.sectors.length; i++) {
          s = this.sectors[i];
          if (s.pass !== pass) continue;
          if (M.aabbOutside(planes, s.aabb[0], s.aabb[1], s.aabb[2], s.aabb[3], s.aabb[4], s.aabb[5])) continue;
          gl.bindVertexArray(s.vao);
          gl.drawElements(gl.TRIANGLES, s.quads * 6, gl.UNSIGNED_INT, 0);
          drawn++;
        }
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    this.stats.drawn = drawn;

    /* 泛光 */
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.emptyVAO);
    var lv = this.bloomFBO;
    if (this.opts.bloom > 0.001) {
      gl.useProgram(this.progBright);
      gl.uniform1i(this.progBright.u.uTex, 0);
      gl.uniform1f(this.progBright.u.uThresh, 1.06);
      gl.uniform1f(this.progBright.u.uKnee, 0.72);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbo.color);
      gl.bindFramebuffer(gl.FRAMEBUFFER, lv[0][0].fb);
      gl.viewport(0, 0, lv[0][0].w, lv[0][0].h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(this.progBlur);
      gl.uniform1i(this.progBlur.u.uTex, 0);
      for (var L = 0; L < 3; L++) {
        if (L > 0) {   // 从上一级降采样
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lv[L - 1][0].color);
          gl.bindFramebuffer(gl.FRAMEBUFFER, lv[L][0].fb);
          gl.viewport(0, 0, lv[L][0].w, lv[L][0].h);
          gl.uniform2f(this.progBlur.u.uDir, 1 / lv[L - 1][0].w, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lv[L][0].color);
        gl.bindFramebuffer(gl.FRAMEBUFFER, lv[L][1].fb);
        gl.viewport(0, 0, lv[L][1].w, lv[L][1].h);
        gl.uniform2f(this.progBlur.u.uDir, 1 / lv[L][0].w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lv[L][1].color);
        gl.bindFramebuffer(gl.FRAMEBUFFER, lv[L][0].fb);
        gl.viewport(0, 0, lv[L][0].w, lv[L][0].h);
        gl.uniform2f(this.progBlur.u.uDir, 0, 1 / lv[L][0].h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    /* 合成到屏幕 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progComp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbo.color);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lv[0][0].color);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, lv[1][0].color);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, lv[2][0].color);
    gl.uniform1i(this.progComp.u.uScene, 0);
    gl.uniform1i(this.progComp.u.uB1, 1);
    gl.uniform1i(this.progComp.u.uB2, 2);
    gl.uniform1i(this.progComp.u.uB3, 3);
    gl.uniform1f(this.progComp.u.uExp, tp.exp);
    gl.uniform1f(this.progComp.u.uBloom, this.opts.bloom * 0.62);
    gl.uniform1f(this.progComp.u.uVig, this.opts.vignette);
    gl.uniform1f(this.progComp.u.uGrain, this.opts.grain);
    gl.uniform1f(this.progComp.u.uSat, this.opts.sat);
    gl.uniform1f(this.progComp.u.uTime, this.clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  VX.Renderer = Renderer;
})(window);
