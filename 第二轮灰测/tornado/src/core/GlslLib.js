/**
 * GlslLib.js — 所有着色器共享的 GLSL 代码块（噪声 / 旋转 / 相函数 / 大气 / 高度雾 / 色调）。
 * 以字符串常量导出，用模板拼接进各个 ShaderMaterial，保证全场景一致。
 */

/* ---------------- 哈希与噪声 ---------------- */
export const GLSL_HASH = /* glsl */`
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1,311.7,74.7)), dot(p, vec3(269.5,183.3,246.1)), dot(p, vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123)*2.0-1.0;
}
vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453123)*2.0-1.0;
}
`;

/** 3D value noise + fbm（云雾主力） */
export const GLSL_NOISE3 = /* glsl */`
float vnoise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n000 = hash13(i+vec3(0,0,0)), n100 = hash13(i+vec3(1,0,0));
  float n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
  float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1));
  float n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
/* Perlin 风格梯度噪声，[-1,1]，比 value noise 更干净 */
float gnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash33(i+vec3(0,0,0)), f-vec3(0,0,0)),
                     dot(hash33(i+vec3(1,0,0)), f-vec3(1,0,0)), u.x),
                 mix(dot(hash33(i+vec3(0,1,0)), f-vec3(0,1,0)),
                     dot(hash33(i+vec3(1,1,0)), f-vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash33(i+vec3(0,0,1)), f-vec3(0,0,1)),
                     dot(hash33(i+vec3(1,0,1)), f-vec3(1,0,1)), u.x),
                 mix(dot(hash33(i+vec3(0,1,1)), f-vec3(0,1,1)),
                     dot(hash33(i+vec3(1,1,1)), f-vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm3(vec3 p, int oct, float lac, float gain){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    s += a*vnoise3(p); n += a; p *= lac; a *= gain;
  }
  return s/max(n,1e-4);
}
/* 山脊/湍流型 fbm，边缘更锐利，适合尘埃与漏斗壁细节 */
float turb3(vec3 p, int oct, float lac, float gain){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    s += a*abs(gnoise3(p)); n += a; p = p*lac + vec3(11.3,7.7,3.1); a *= gain;
  }
  return s/max(n,1e-4);
}
/* 无缝 3D worley（絮状团块） */
float worley3(vec3 p, float jitter){
  vec3 ip = floor(p), fp = fract(p);
  float d = 1e9;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = 0.5 + 0.5*hash33(ip+g)*jitter;
    d = min(d, length(g+o-fp));
  }
  return clamp(d, 0.0, 1.0);
}
`;

/** 2D 噪声（水面细节、地表纹理、草地） */
export const GLSL_NOISE2 = /* glsl */`
float vnoise2(vec2 x){
  vec2 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float gnoise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(hash22(i+vec2(0,0)), f-vec2(0,0)), dot(hash22(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(hash22(i+vec2(0,1)), f-vec2(0,1)), dot(hash22(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
}
float fbm2(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    s += a*gnoise2(p); n += a; p = p*2.03 + vec2(5.2,1.3); a *= 0.5;
  }
  return s/max(n,1e-4)*0.5+0.5;
}
`;

/** curl noise：无散度流场，龙卷风的丝状卷须与碎片轨迹都靠它 */
export const GLSL_CURL = /* glsl */`
vec3 curl3(vec3 p, float e){
  float n1 = gnoise3(p + vec3(0.0, e, 0.0)) - gnoise3(p - vec3(0.0, e, 0.0));
  float n2 = gnoise3(p + vec3(0.0, 0.0, e)) - gnoise3(p - vec3(0.0, 0.0, e));
  float n3 = gnoise3(p + vec3(e, 0.0, 0.0)) - gnoise3(p - vec3(e, 0.0, 0.0));
  vec3 c = vec3(n2 - n1, n3 - n2, n1 - n3) / (2.0*e);
  return c;
}
`;

/* ---------------- 通用数学 ---------------- */
export const GLSL_MATH = /* glsl */`
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
float remap(float v, float a, float b, float c, float d){ return c + (d-c)*clamp((v-a)/max(b-a,1e-6),0.0,1.0); }
float sat(float v){ return clamp(v,0.0,1.0); }
vec3 sat3(vec3 v){ return clamp(v,0.0,1.0); }
/* 射线与无限圆柱（Y 轴）求交；返回 [t0,t1]。未命中返回空区间 (1e9,-1e9)，
   这样"相机在圆柱内部"(t0<0<t1) 与"完全未命中"能被同一套区间求交正确处理。 */
vec2 rayCylinder(vec3 ro, vec3 rd, vec2 c, float r){
  vec2 o = ro.xz - c, d = rd.xz;
  float a = dot(d,d);
  float cc = dot(o,o) - r*r;
  if(a < 1e-9) return cc <= 0.0 ? vec2(-1e9, 1e9) : vec2(1e9, -1e9);   // 垂直射线
  float b = dot(o,d);
  float h = b*b - a*cc;
  if(h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2((-b-h)/a, (-b+h)/a);
}
/* 射线与水平板（y=y0..y1）求交；未命中同样返回空区间 */
vec2 raySlab(vec3 ro, vec3 rd, float y0, float y1){
  if(abs(rd.y) < 1e-6) return (ro.y > y0 && ro.y < y1) ? vec2(-1e9, 1e9) : vec2(1e9, -1e9);
  float ta = (y0-ro.y)/rd.y, tb = (y1-ro.y)/rd.y;
  return vec2(min(ta,tb), max(ta,tb));
}
`;

/* ---------------- 散射相函数 ---------------- */
export const GLSL_PHASE = /* glsl */`
float hgPhase(float cosT, float g){
  float g2 = g*g;
  return (1.0-g2) / (12.566370614 * pow(max(1.0 + g2 - 2.0*g*cosT, 1e-4), 1.5));
}
/* 双叶 HG：前向强散射 + 少量背向，云雾更有体积感 */
float dualHG(float cosT, float g1, float g2, float w){
  return mix(hgPhase(cosT,g2), hgPhase(cosT,g1), w);
}
float rayleighPhase(float cosT){ return 0.0596831 * (1.0 + cosT*cosT); }
`;

/* ---------------- 共用大气/天空（天空盒、雾、水面反射共享同一套） ---------------- */
export const GLSL_ATMOS = /* glsl */`
/* 简化 Preetham/Hosek 风格解析天空：Rayleigh + Mie，附加风暴云层压暗 */
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uTurbidity;
uniform float uStormCover;      // 0 晴 → 1 强雷暴
uniform float uStormDark;       // 云底压暗
uniform vec3  uZenithColor;
uniform vec3  uHorizonColor;
uniform float uSkyLuminance;

vec3 atmosphere(vec3 dir, vec3 sunDir){
  float up = max(dir.y, -0.12);
  float h = pow(1.0 - sat(up), 4.0);                       // 地平线堆积
  vec3 base = mix(uZenithColor, uHorizonColor, h);
  float cosT = dot(dir, sunDir);
  /* Rayleigh 蓝散射 + Mie 日周光晕 */
  float ray = rayleighPhase(cosT) * (1.0 + 1.6*uTurbidity*0.1);
  float mie = hgPhase(cosT, 0.76) * 12.0 / (1.0 + uTurbidity);
  vec3 col = base * (0.85 + 0.7*ray);
  col += uSunColor * mie * (0.30 + 0.45*sat(sunDir.y+0.1));
  /* 太阳本体（不要过亮，否则会从体积云/漏斗里"透"出来） */
  float disk = smoothstep(0.99965, 0.99991, cosT);
  col += uSunColor * disk * 20.0 * smoothstep(-0.06, 0.10, sunDir.y);
  /* 风暴：整体压暗 + 去饱和 */
  float dark = uStormCover * uStormDark;
  col = mix(col, vec3(dot(col, vec3(0.299,0.587,0.114))) * 0.72, dark*0.55);
  col *= (1.0 - 0.55*dark);
  return col * uSkyLuminance;
}
`;

/** 高度雾 / 空气透视：所有不透明材质与水面共享，保证三场景光影一致 */
export const GLSL_AERIAL = /* glsl */`
uniform vec3  uFogColor;
uniform float uFogDensity;      // 每米消光
uniform float uFogHeightFalloff;// 指数高度衰减
uniform float uFogSunAmount;    // 朝阳方向的散射增强

/* 沿视线积分指数高度雾的解析解 */
float heightFogAmount(vec3 camPos, vec3 worldPos){
  vec3 d = worldPos - camPos;
  float dist = length(d);
  if(dist < 1e-4) return 0.0;
  float dy = d.y;
  float kf = max(uFogHeightFalloff, 1e-5);
  float t;
  if(abs(dy) < 1e-3){
    t = uFogDensity * dist * exp(-kf * camPos.y);
  } else {
    t = uFogDensity * dist * (exp(-kf*camPos.y) - exp(-kf*worldPos.y)) / (kf*dy);
  }
  return 1.0 - exp(-max(t, 0.0));
}

vec3 applyAerial(vec3 color, vec3 camPos, vec3 worldPos, vec3 sunDir, vec3 sunColor){
  vec3 v = normalize(worldPos - camPos);
  float f = heightFogAmount(camPos, worldPos);
  float cosT = max(dot(v, sunDir), 0.0);
  vec3 fog = uFogColor + sunColor * uFogSunAmount * pow(cosT, 8.0);
  return mix(color, fog, f);
}
`;

/* ---------------- 色调映射与工具 ---------------- */
export const GLSL_TONE = /* glsl */`
vec3 acesFilm(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
/* 交错梯度噪声：低成本蓝噪声近似，用于抖动去带状 */
float ign(vec2 p){ return fract(52.9829189 * fract(0.06711056*p.x + 0.00583715*p.y)); }
`;

/** 常用组合：噪声全家桶 */
export const GLSL_NOISE_ALL = GLSL_HASH + GLSL_NOISE2 + GLSL_NOISE3 + GLSL_CURL + GLSL_MATH;
