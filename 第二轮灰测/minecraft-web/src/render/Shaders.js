/* =====================================================================
 * Shaders — 全部 GLSL ES 3.0 着色器源码
 *  chunk    : 体素区块（纹理数组 + 平滑光照 + AO + 雾）
 *  sky      : 天空渐变穹顶
 *  celestial: 太阳/月亮/星星 billboard
 *  cloud    : 云层
 *  block    : 单个方块立方体（手持物品 / 掉落物 / 破坏裂纹）
 *  entity   : 生物模型（纯色盒子 + 定向光）
 *  particle : 粒子 billboard
 *  line     : 线框（方块选择框、碰撞盒）
 * ===================================================================== */

const COMMON_FOG = /* glsl */`
float fogFactor(float dist, float start, float end){
  float f = clamp((dist - start) / max(end - start, 0.001), 0.0, 1.0);
  return f * f;
}
`;

/* ------------------------------------------------------------------ *
 * 区块
 * ------------------------------------------------------------------ */
export const chunkVS = `#version 300 es
precision highp float;

in vec3 aPos;      // 区块内局部坐标
in vec3 aUV;       // u, v, 纹理层
in float aData;    // face + ao*8 + skyLight*32 + blockLight*512

uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uChunkOffset;
uniform float uDaylight;    // 0(夜) .. 1(正午)
uniform float uMinLight;    // 亮度设置带来的保底照明
uniform float uTime;
uniform float uWave;        // >0 时顶面做水波位移
uniform float uSmooth;      // 1=平滑光照, 0=关闭AO

out vec3 vUV;
out vec3 vLight;
out float vDist;
out vec3 vWorld;

void main(){
  vec3 world = aPos + uChunkOffset;

  float d = aData;
  float face = mod(d, 8.0);
  float ao   = mod(floor(d / 8.0), 4.0);
  float sky  = mod(floor(d / 32.0), 16.0);
  float blk  = floor(d / 512.0);
  int fi = int(face + 0.5);

  float shade = 0.6;
  if (fi == 2) shade = 1.0;
  else if (fi == 3) shade = 0.5;
  else if (fi == 4 || fi == 5) shade = 0.8;

  if (uWave > 0.5 && fi == 2) {
    world.y += sin(world.x * 0.7 + uTime * 1.9) * 0.028
             + sin(world.z * 0.9 - uTime * 1.4) * 0.028 - 0.03;
  }

  float skyL = sky / 15.0;
  float blkL = blk / 15.0;
  float sl = skyL * uDaylight;
  float lum = max(sl, blkL * 1.02);
  lum = uMinLight + (1.0 - uMinLight) * lum;
  lum = lum * (0.72 + 0.28 * lum);          // 轻微的非线性，接近原版观感

  float aoF = mix(0.52, 1.0, ao / 3.0);
  aoF = mix(1.0, aoF, uSmooth);

  vec3 skyCol   = vec3(0.94, 0.97, 1.00);
  vec3 torchCol = vec3(1.00, 0.82, 0.58);
  float t = blkL / max(blkL + sl, 0.0001);
  vec3 lightCol = mix(skyCol, torchCol, t * 0.85);

  vLight = lightCol * lum * shade * aoF;
  vUV = aUV;
  vWorld = world;

  vec4 vp = uView * vec4(world, 1.0);
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
}
`;

export const chunkFS = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 vUV;
in vec3 vLight;
in float vDist;
in vec3 vWorld;

uniform sampler2DArray uTex;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform int uCutout;
uniform float uAlpha;
uniform int uUnderwater;

out vec4 outColor;
${COMMON_FOG}

void main(){
  vec4 t = texture(uTex, vUV);
  if (uCutout == 1 && t.a < 0.5) discard;
  if (t.a < 0.02) discard;

  vec3 c = t.rgb * vLight;

  // 水下整体偏蓝绿
  if (uUnderwater == 1) c = mix(c, c * vec3(0.35, 0.62, 1.0), 0.55);

  float f = fogFactor(vDist, uFogStart, uFogEnd);
  c = mix(c, uFogColor, f);

  outColor = vec4(c, t.a * uAlpha);
}
`;

/* ------------------------------------------------------------------ *
 * 天空
 * ------------------------------------------------------------------ */
export const skyVS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uInvVP;
out vec3 vDir;
void main(){
  vec4 far = uInvVP * vec4(aPos, 1.0, 1.0);
  vec4 near = uInvVP * vec4(aPos, -1.0, 1.0);
  vDir = normalize(far.xyz / far.w - near.xyz / near.w);
  gl_Position = vec4(aPos, 0.999999, 1.0);
}
`;

export const skyFS = `#version 300 es
precision highp float;
in vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;      // 0=白天 1=夜晚
uniform float uUnderwater;
out vec4 outColor;

void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
  vec3 col = mix(uHorizon, uZenith, t);

  // 地平线以下：略暗的雾色
  if (d.y < 0.0) {
    col = mix(uHorizon, uHorizon * 0.55, clamp(-d.y * 2.2, 0.0, 1.0));
  }

  // 太阳光晕
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 64.0) * 1.4;
  col += uSunColor * pow(sd, 6.0) * 0.16 * (1.0 - uNight);

  if (uUnderwater > 0.5) col = mix(col, vec3(0.09, 0.24, 0.48), 0.85);

  outColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ *
 * 太阳 / 月亮 / 星星
 * ------------------------------------------------------------------ */
export const celestialVS = `#version 300 es
precision highp float;
in vec3 aPos;     // 单位球面方向
in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;   // 天体方向（单位向量）
uniform float uSize;
uniform float uDistance;
out vec2 vUV;
void main(){
  // 视图空间 billboard：只用视图矩阵的旋转部分（去掉平移）。
  // 若在世界空间构造（平面垂直于"原点→天体"方向），相机平移会让平面
  // 不正对视线，视角转动时太阳会被透视投影拉成梯形（大幅形变）。
  vec3 f = normalize(mat3(uView) * normalize(uCenter));
  vec3 up0 = abs(f.y) > 0.99 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0);
  vec3 r = normalize(cross(up0, f));
  vec3 u = cross(f, r);
  vec3 viewPos = f * uDistance + (r * aPos.x + u * aPos.y) * uSize;
  vUV = aUV;
  gl_Position = uProj * vec4(viewPos, 1.0);
}
`;

export const celestialFS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUV;
uniform sampler2DArray uTex;
uniform float uLayer;
uniform vec4 uTint;
out vec4 outColor;
void main(){
  vec4 t = texture(uTex, vec3(vUV, uLayer));
  if (t.a < 0.05) discard;
  outColor = vec4(t.rgb * uTint.rgb, t.a * uTint.a);
}
`;

export const starVS = `#version 300 es
precision highp float;
in vec3 aPos;
in float aSize;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uScale;
out float vAlpha;
void main(){
  vec4 vp = uView * vec4(aPos * 220.0, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = aSize * uScale;
  vAlpha = aSize;
}
`;

export const starFS = `#version 300 es
precision highp float;
in float vAlpha;
uniform float uOpacity;
out vec4 outColor;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float a = uOpacity * smoothstep(0.5, 0.15, d);
  outColor = vec4(vec3(1.0, 1.0, 0.96), a);
}
`;

/* ------------------------------------------------------------------ *
 * 云
 * ------------------------------------------------------------------ */
export const cloudVS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCamera;
uniform float uHeight;
uniform float uSize;
out vec2 vUV;
out float vDist;
void main(){
  vec3 world = vec3(uCamera.x + aPos.x * uSize, uHeight, uCamera.z + aPos.y * uSize);
  vUV = aPos * uSize;
  vec4 vp = uView * vec4(world, 1.0);
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
}
`;

export const cloudFS = `#version 300 es
precision highp float;
in vec2 vUV;
in float vDist;
uniform sampler2D uTex;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uFogColor;
uniform float uFogEnd;
uniform float uOpacity;
out vec4 outColor;
void main(){
  vec2 uv = vUV * 0.0055 + vec2(uTime * 0.0022, 0.0);
  float a = texture(uTex, uv).r;
  a = smoothstep(0.46, 0.62, a);
  if (a < 0.02) discard;
  float fade = 1.0 - clamp(vDist / uFogEnd, 0.0, 1.0);
  outColor = vec4(mix(uFogColor, uColor, fade), a * uOpacity * fade);
}
`;

/* ------------------------------------------------------------------ *
 * 单方块立方体（手持 / 掉落物 / 破坏裂纹 / 图标）
 * ------------------------------------------------------------------ */
export const blockVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aUV;
in float aData;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLayerOverride;   // >=0 时覆盖贴图层
out vec3 vUV;
out float vShade;
out float vDist;
void main(){
  float face = mod(aData, 8.0);
  int fi = int(face + 0.5);
  float shade = 0.6;
  if (fi == 2) shade = 1.0;
  else if (fi == 3) shade = 0.5;
  else if (fi == 4 || fi == 5) shade = 0.8;
  vShade = shade;
  vUV = vec3(aUV.xy, uLayerOverride >= 0.0 ? uLayerOverride : aUV.z);
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * world;
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
}
`;

export const blockFS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vUV;
in float vShade;
in float vDist;
uniform sampler2DArray uTex;
uniform float uLight;
uniform vec4 uTint;
uniform int uCutout;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
out vec4 outColor;
${COMMON_FOG}
void main(){
  vec4 t = texture(uTex, vUV);
  if (uCutout == 1 && t.a < 0.35) discard;
  vec3 c = t.rgb * vShade * uLight * uTint.rgb;
  float f = fogFactor(vDist, uFogStart, uFogEnd);
  c = mix(c, uFogColor, f);
  outColor = vec4(c, t.a * uTint.a);
}
`;

/* ------------------------------------------------------------------ *
 * 生物 / 实体（纯色盒子）
 * ------------------------------------------------------------------ */
export const entityVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out float vDist;
void main(){
  vec4 world = uModel * vec4(aPos, 1.0);
  vNormal = mat3(uModel) * aNormal;
  vec4 vp = uView * world;
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
}
`;

export const entityFS = `#version 300 es
precision highp float;
in vec3 vNormal;
in float vDist;
uniform vec4 uColor;
uniform float uLight;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
out vec4 outColor;
${COMMON_FOG}
void main(){
  vec3 n = normalize(vNormal);
  // 与方块一致的方向明暗
  float shade = 0.6;
  if (n.y > 0.5) shade = 1.0;
  else if (n.y < -0.5) shade = 0.5;
  else if (abs(n.z) > 0.5) shade = 0.8;
  vec3 c = uColor.rgb * shade * uLight;
  float f = fogFactor(vDist, uFogStart, uFogEnd);
  c = mix(c, uFogColor, f);
  outColor = vec4(c, uColor.a);
}
`;

/* ------------------------------------------------------------------ *
 * 粒子
 * ------------------------------------------------------------------ */
export const particleVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aUV;
in vec4 aColor;   // rgb = 亮度着色, a = 透明度
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vUV;
out vec4 vColor;
out float vDist;
void main(){
  vec4 vp = uView * vec4(aPos, 1.0);
  vDist = length(vp.xyz);
  vUV = aUV;
  vColor = aColor;
  gl_Position = uProj * vp;
}
`;

export const particleFS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vUV;
in vec4 vColor;
in float vDist;
uniform sampler2DArray uTex;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
out vec4 outColor;
${COMMON_FOG}
void main(){
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vColor.rgb;
  float f = fogFactor(vDist, uFogStart, uFogEnd);
  c = mix(c, uFogColor, f);
  outColor = vec4(c, t.a * vColor.a);
}
`;

/* ------------------------------------------------------------------ *
 * 纯色线框
 * ------------------------------------------------------------------ */
export const lineVS = `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
void main(){
  gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}
`;

export const lineFS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main(){ outColor = uColor; }
`;

/* ------------------------------------------------------------------ *
 * 全屏纯色/贴图叠加（水下、受伤闪红等由 CSS 处理，这里备用）
 * ------------------------------------------------------------------ */
export const quadVS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const quadFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec4 uColor;
out vec4 outColor;
void main(){ outColor = uColor; }
`;
