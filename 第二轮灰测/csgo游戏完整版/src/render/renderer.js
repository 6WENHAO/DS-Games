// ---------------------------------------------------------------------------
// 前向渲染器：天空 + 静态世界批次 + 动态模型 + 阴影贴图 + 精灵/贴花/线条 + 视图模型
// ---------------------------------------------------------------------------

import { createGL, Shader, createShadowMap, createTexture, solidTexture, DynamicBuffer, createVAO } from './gl.js';
import { fullscreenQuad } from './mesh.js';
import { MATERIALS, makeTexture, makeSprite } from './textures.js';
import {
  m4, m4mul, m4perspective, m4ortho, m4lookAt, m4identity, m4invert, m4normalMatrix,
  v3, vadd, vsub, vscale, vnorm, vcross, vaddScaled, vdist, clamp, DEG, anglesToDir,
} from '../core/math.js';

// 精灵默认混合模式：add = 加法（发光），alpha = 普通半透明
const SPRITE_BLEND = {
  flash: 'add', spark: 'add', glow: 'add', ring: 'add', fire: 'add',
  smoke: 'alpha', dust: 'alpha', blood: 'alpha', hole: 'alpha',
  crosshair_dot: 'add',
  bullet_decal_metal: 'alpha', bullet_decal_wood: 'alpha',
  bullet_decal_glass: 'alpha', bullet_decal_dirt: 'alpha',
};

const COMMON_FRAG_HEAD = /* glsl */`
precision highp float;
precision highp sampler2DShadow;
const float GAMMA = 2.2;
vec3 tonemap(vec3 c){
  // 简化 ACES 曲线
  c *= 1.0;
  vec3 a = c * (2.51 * c + 0.03);
  vec3 b = c * (2.43 * c + 0.59) + 0.14;
  return clamp(a / b, 0.0, 1.0);
}
vec3 encode(vec3 c){ return pow(tonemap(c), vec3(1.0 / GAMMA)); }
`;

const WORLD_VERT = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uLightMat;
uniform vec2 uUVScale;
out vec3 vWorld;
out vec3 vNrm;
out vec2 vUV;
out vec4 vShadow;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNrm = uNormalMat * aNrm;
  vUV = aUV * uUVScale;
  vShadow = uLightMat * wp;
  gl_Position = uProj * uView * wp;
}
`;

const WORLD_FRAG = /* glsl */`#version 300 es
${COMMON_FRAG_HEAD}
in vec3 vWorld;
in vec3 vNrm;
in vec2 vUV;
in vec4 vShadow;
uniform sampler2D uTex;
uniform sampler2DShadow uShadow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
uniform vec4 uTint;
uniform float uSpec;
uniform float uGloss;
uniform float uEmissive;
uniform float uShadowTexel;
uniform float uShadowStrength;
uniform int uNumLights;
uniform vec3 uLightPos[8];
uniform vec3 uLightColor[8];
uniform float uLightRadius[8];
uniform float uAlphaTest;
out vec4 outColor;

float shadowFactor(vec3 N){
  if(uShadowStrength <= 0.0) return 1.0;
  vec3 p = vShadow.xyz / vShadow.w;
  if(p.x < 0.002 || p.x > 0.998 || p.y < 0.002 || p.y > 0.998 || p.z > 1.0) return 1.0;
  float ndl = max(dot(N, -uSunDir), 0.0);
  float bias = mix(0.0022, 0.0006, ndl);
  p.z -= bias;
  float s = 0.0;
  for(int y = -1; y <= 1; y++){
    for(int x = -1; x <= 1; x++){
      s += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * uShadowTexel, p.z));
    }
  }
  return mix(1.0, s / 9.0, uShadowStrength);
}

void main(){
  vec4 texel = texture(uTex, vUV);
  if(texel.a < uAlphaTest) discard;
  vec3 N = normalize(vNrm);
  vec3 albedo = texel.rgb * uTint.rgb;
  vec3 V = normalize(uCamPos - vWorld);
  float sh = shadowFactor(N);

  float ndl = max(dot(N, -uSunDir), 0.0);
  vec3 light = uSunColor * ndl * sh;

  // 半球环境光
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = uAmbient * mix(uSkyBottom, uSkyTop, hemi) * 2.0;
  // 轻微的朝下遮蔽，避免天花板过亮
  ambient *= mix(0.55, 1.0, hemi);
  light += ambient;

  // 点光源
  for(int i = 0; i < 8; i++){
    if(i >= uNumLights) break;
    vec3 d = uLightPos[i] - vWorld;
    float dist = length(d);
    float r = uLightRadius[i];
    if(dist > r) continue;
    vec3 L = d / max(dist, 0.0001);
    float att = 1.0 - dist / r;
    att *= att;
    light += uLightColor[i] * max(dot(N, L), 0.0) * att;
  }

  vec3 color = albedo * light;

  // 高光（仅太阳）
  if(uSpec > 0.0){
    vec3 H = normalize(V - uSunDir);
    float s = pow(max(dot(N, H), 0.0), uGloss) * uSpec * sh * ndl;
    color += uSunColor * s;
  }
  color += albedo * uEmissive;

  // 雾
  float dist = length(uCamPos - vWorld);
  float f = clamp((dist - uFogRange.x) / max(uFogRange.y - uFogRange.x, 0.001), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  color = mix(color, uFogColor, f * 0.92);

  outColor = vec4(encode(color), uTint.a * texel.a);
}
`;

const DEPTH_VERT = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }
`;
const DEPTH_FRAG = /* glsl */`#version 300 es
precision mediump float;
void main(){}
`;

const SPRITE_VERT = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aColor;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform vec2 uFogRange;
out vec2 vUV;
out vec4 vColor;
out float vFog;
void main(){
  vUV = aUV;
  vColor = aColor;
  float d = length(uCamPos - aPos);
  float f = clamp((d - uFogRange.x) / max(uFogRange.y - uFogRange.x, 0.001), 0.0, 1.0);
  vFog = f * f * (3.0 - 2.0 * f);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;
const SPRITE_FRAG = /* glsl */`#version 300 es
${COMMON_FRAG_HEAD}
in vec2 vUV;
in vec4 vColor;
in float vFog;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform int uAdditive;
out vec4 outColor;
void main(){
  vec4 t = texture(uTex, vUV);
  vec3 c = t.rgb * vColor.rgb;
  float a = t.a * vColor.a;
  if(a < 0.004) discard;
  if(uAdditive == 1){
    c *= (1.0 - vFog * 0.85);
    outColor = vec4(pow(clamp(c, 0.0, 4.0), vec3(1.0 / GAMMA)) * a, a);
  } else {
    c = mix(c, uFogColor, vFog * 0.92);
    outColor = vec4(pow(clamp(c, 0.0, 4.0), vec3(1.0 / GAMMA)), a);
  }
}
`;

const LINE_VERT = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
uniform mat4 uViewProj;
out vec4 vColor;
void main(){ vColor = aColor; gl_Position = uViewProj * vec4(aPos, 1.0); }
`;
const LINE_FRAG = /* glsl */`#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main(){ outColor = vColor; }
`;

const SKY_VERT = /* glsl */`#version 300 es
layout(location=0) in vec2 aPos;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
out vec3 vDir;
void main(){
  vec4 p = uInvViewProj * vec4(aPos, 1.0, 1.0);
  vDir = p.xyz / p.w - uCamPos;
  gl_Position = vec4(aPos, 0.999999, 1.0);
}
`;
const SKY_FRAG = /* glsl */`#version 300 es
${COMMON_FRAG_HEAD}
in vec3 vDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTime;
out vec4 outColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  float t = pow(clamp(h * 1.05 + 0.02, 0.0, 1.0), 0.55);
  vec3 sky = mix(uSkyBottom, uSkyTop, t);

  // 太阳
  vec3 sd = normalize(-uSunDir);
  float sun = max(dot(d, sd), 0.0);
  sky += uSunColor * pow(sun, 900.0) * 12.0;
  sky += uSunColor * pow(sun, 12.0) * 0.16;

  // 云层（沿视线在固定高度平面投影）
  if(d.y > 0.015){
    vec2 cp = d.xz / d.y * 0.11;
    float c = fbm(cp * 1.5 + vec2(uTime * 0.004, uTime * 0.0022));
    c = smoothstep(0.52, 0.86, c);
    float fade = smoothstep(0.015, 0.30, d.y);
    vec3 cloudCol = mix(vec3(0.72, 0.74, 0.78), vec3(1.06, 1.03, 0.98), c);
    sky = mix(sky, cloudCol, c * fade * 0.82);
  }
  outColor = vec4(encode(sky), 1.0);
}
`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = createGL(canvas);
    const gl = this.gl;

    this.shWorld = new Shader(gl, WORLD_VERT, WORLD_FRAG, 'world');
    this.shDepth = new Shader(gl, DEPTH_VERT, DEPTH_FRAG, 'depth');
    this.shSprite = new Shader(gl, SPRITE_VERT, SPRITE_FRAG, 'sprite');
    this.shLine = new Shader(gl, LINE_VERT, LINE_FRAG, 'line');
    this.shSky = new Shader(gl, SKY_VERT, SKY_FRAG, 'sky');

    this.quad = fullscreenQuad(gl);
    this.shadow = createShadowMap(gl, 2048);
    this.shadowEnabled = true;
    this.shadowStrength = 0.78;
    this.shadowExtent = 42;

    this.white = solidTexture(gl, 255, 255, 255, 255);
    this.textures = new Map();
    this.spriteTex = new Map();

    // 帧数据
    this.camera = { pos: v3(0, 1.6, 0), yaw: 0, pitch: 0, fov: 90, roll: 0 };
    this.proj = m4();
    this.view = m4();
    this.viewProj = m4();
    this.invViewProj = m4();
    this.lightVP = m4();
    this.lightMat = m4();
    this._tmpM = m4();
    this._tmpM2 = m4();
    this._nm = new Float32Array(9);
    this._identity = m4();

    this.worldBatches = [];
    this.models = [];
    this.transModels = [];
    this.viewModels = [];
    this.spriteGroups = new Map();
    this.lineBuf = new DynamicBuffer(gl, 7, 8192);
    this.spriteBuf = new DynamicBuffer(gl, 9, 24000);
    this.lineVAO = createVAO(gl, [
      { buffer: this.lineBuf.buffer, loc: 0, size: 3, stride: 28, offset: 0 },
      { buffer: this.lineBuf.buffer, loc: 1, size: 4, stride: 28, offset: 12 },
    ]);
    this.spriteVAO = createVAO(gl, [
      { buffer: this.spriteBuf.buffer, loc: 0, size: 3, stride: 36, offset: 0 },
      { buffer: this.spriteBuf.buffer, loc: 1, size: 2, stride: 36, offset: 12 },
      { buffer: this.spriteBuf.buffer, loc: 2, size: 4, stride: 36, offset: 20 },
    ]);

    this.env = {
      skyTop: [0.42, 0.60, 0.86], skyBottom: [0.85, 0.86, 0.80],
      sunDir: [-0.45, -0.78, -0.44], sunColor: [1.2, 1.1, 0.92],
      ambient: [0.34, 0.36, 0.42], fogColor: [0.76, 0.75, 0.70], fogRange: [70, 260],
    };
    this.lights = { count: 0, pos: new Float32Array(24), color: new Float32Array(24), radius: new Float32Array(8) };
    this.time = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.stats = { drawCalls: 0, tris: 0 };
    this.viewmodelFov = 68;
    this.resize();
  }

  /** 生成所有程序化贴图（较慢，只在启动时做一次） */
  init(onProgress) {
    const gl = this.gl;
    const names = new Set();
    for (const k in MATERIALS) names.add(MATERIALS[k].tex);
    let i = 0;
    const list = [...names];
    for (const n of list) {
      const size = n === 'skybox' ? 512 : 256;
      const cv = makeTexture(n, size);
      this.textures.set(n, createTexture(gl, cv, { srgb: true }));
      if (onProgress) onProgress(++i / (list.length + 16), '贴图: ' + n);
    }
    const spriteNames = Object.keys(SPRITE_BLEND);
    for (const n of spriteNames) {
      const cv = makeSprite(n, 128);
      this.spriteTex.set(n, createTexture(gl, cv, { srgb: true, clamp: true }));
      if (onProgress) onProgress(0.9, '特效: ' + n);
    }
  }

  materialTexture(matName) {
    const m = MATERIALS[matName];
    if (!m) return this.white;
    return this.textures.get(m.tex) || this.white;
  }

  resize() {
    const c = this.canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(c.clientWidth * this.dpr));
    const h = Math.max(2, Math.round(c.clientHeight * this.dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.width = w; this.height = h;
    this.aspect = w / h;
  }

  setEnv(sky) {
    if (!sky) return;
    const e = this.env;
    if (sky.top) e.skyTop = sky.top;
    if (sky.bottom) e.skyBottom = sky.bottom;
    if (sky.sunDir) { e.sunDir = vnorm(v3(), sky.sunDir); }
    if (sky.sunColor) e.sunColor = sky.sunColor;
    if (sky.ambient) e.ambient = sky.ambient;
    if (sky.fog) { e.fogColor = sky.fog.color; e.fogRange = [sky.fog.start, sky.fog.end]; }
  }

  setLights(list) {
    const L = this.lights;
    L.count = Math.min(8, list ? list.length : 0);
    for (let i = 0; i < L.count; i++) {
      const l = list[i];
      L.pos[i * 3] = l.pos[0]; L.pos[i * 3 + 1] = l.pos[1]; L.pos[i * 3 + 2] = l.pos[2];
      const inten = l.intensity === undefined ? 1 : l.intensity;
      L.color[i * 3] = l.color[0] * inten; L.color[i * 3 + 1] = l.color[1] * inten; L.color[i * 3 + 2] = l.color[2] * inten;
      L.radius[i] = l.radius || 8;
    }
  }

  /** batches: [{ mat:'sand', mesh:GPUMesh }] */
  setWorld(batches) { this.worldBatches = batches || []; }

  // --------------------------- 每帧接口 -------------------------------------

  beginFrame(camera, dt) {
    this.time += dt || 0;
    this.resize();
    Object.assign(this.camera, camera);
    this.models.length = 0;
    this.transModels.length = 0;
    this.viewModels.length = 0;
    this.spriteGroups.clear();
    this.lineBuf.reset();
    this.spriteBuf.reset();
    this.stats.drawCalls = 0; this.stats.tris = 0;

    const cam = this.camera;
    m4perspective(this.proj, cam.fov, this.aspect, 0.03, 400);
    const dir = anglesToDir(v3(), cam.yaw, cam.pitch);
    const target = vadd(v3(), cam.pos, dir);
    let up = [0, 1, 0];
    if (cam.roll) {
      const right = vnorm(v3(), vcross(v3(), dir, [0, 1, 0]));
      const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
      up = vnorm(v3(), [right[0] * sr + 0 * cr, 1 * cr, right[2] * sr]);
    }
    m4lookAt(this.view, cam.pos, target, up);
    m4mul(this.viewProj, this.proj, this.view);
    m4invert(this.invViewProj, this.viewProj);
    this._camDir = dir;
    // 精灵用的相机右/上向量
    this._camRight = vnorm(v3(), vcross(v3(), dir, [0, 1, 0]));
    this._camUp = vnorm(v3(), vcross(v3(), this._camRight, dir));
  }

  /**
   * 提交一个动态模型
   * opts: { mat, color:[r,g,b,a], spec, gloss, emissive, uvScale, noShadow, alpha }
   */
  drawModel(mesh, matrix, opts = {}) {
    if (!mesh) return;
    const item = { mesh, matrix, o: opts };
    if (opts.color && opts.color[3] !== undefined && opts.color[3] < 0.999) this.transModels.push(item);
    else this.models.push(item);
  }

  drawViewmodel(mesh, matrix, opts = {}) {
    if (!mesh) return;
    this.viewModels.push({ mesh, matrix, o: opts });
  }

  drawLine(a, b, color) {
    const buf = this.lineBuf;
    if (buf.room < 2) return;
    const c = color || [1, 1, 1, 1];
    buf.push(a[0], a[1], a[2], c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]);
    buf.push(b[0], b[1], b[2], c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]);
  }

  /** 世界坐标下的公告板精灵 */
  drawSprite(name, pos, size, color, opts = {}) {
    const blend = opts.additive === undefined ? (SPRITE_BLEND[name] || 'alpha') : (opts.additive ? 'add' : 'alpha');
    const key = name + '|' + blend;
    let g = this.spriteGroups.get(key);
    if (!g) { g = { name, additive: blend === 'add', items: [] }; this.spriteGroups.set(key, g); }
    g.items.push({
      pos, size, color: color || [1, 1, 1, 1],
      rot: opts.rot || 0, normal: opts.normal || null,
      dist: vdist(pos, this.camera.pos),
      aspect: opts.aspect || 1,
    });
  }

  /** 贴花：贴在表面上的四边形（color 需自行预乘光照） */
  drawDecal(name, pos, normal, size, angle, color) {
    this.drawSprite(name, pos, size, color, { normal, rot: angle, additive: false });
  }

  endFrame() {
    const gl = this.gl;
    const env = this.env;

    if (this.shadowEnabled) this._shadowPass();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 天空
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    const sk = this.shSky.use();
    sk.m4('uInvViewProj', this.invViewProj);
    sk.v3('uCamPos', this.camera.pos);
    sk.v3('uSkyTop', env.skyTop);
    sk.v3('uSkyBottom', env.skyBottom);
    sk.v3('uSunDir', env.sunDir);
    sk.v3('uSunColor', env.sunColor);
    sk.f('uTime', this.time);
    this.quad.draw();
    this.stats.drawCalls++;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    // 世界 + 模型
    const s = this.shWorld.use();
    this._setWorldUniforms(s);
    for (const b of this.worldBatches) this._drawBatch(s, b);
    for (const m of this.models) this._drawDynamic(s, m);

    // 半透明模型
    if (this.transModels.length) {
      this.transModels.sort((a, b) => vdist(b.matrix.slice(12, 15), this.camera.pos) - vdist(a.matrix.slice(12, 15), this.camera.pos));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const m of this.transModels) this._drawDynamic(s, m);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 精灵 / 贴花
    this._spritePass();

    // 线条
    if (this.lineBuf.count) {
      this.lineBuf.upload();
      const ls = this.shLine.use();
      ls.m4('uViewProj', this.viewProj);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(this.lineVAO);
      gl.drawArrays(gl.LINES, 0, this.lineBuf.count);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      this.stats.drawCalls++;
    }

    // 第一人称模型（独立近裁剪投影 + 清深度）
    if (this.viewModels.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const proj = m4perspective(this._tmpM, this.viewmodelFov, this.aspect, 0.004, 8);
      const vs = this.shWorld.use();
      this._setWorldUniforms(vs);
      vs.m4('uProj', proj);
      vs.m4('uView', m4identity(this._tmpM2));
      vs.f('uShadowStrength', 0);
      for (const m of this.viewModels) this._drawDynamic(vs, m);
      vs.f('uShadowStrength', this.shadowStrength);
    }
    gl.bindVertexArray(null);
  }

  _setWorldUniforms(s) {
    const env = this.env;
    const gl = this.gl;
    s.m4('uProj', this.proj);
    s.m4('uView', this.view);
    s.m4('uLightMat', this.lightMat);
    s.v3('uSunDir', env.sunDir);
    s.v3('uSunColor', env.sunColor);
    s.v3('uAmbient', env.ambient);
    s.v3('uSkyTop', env.skyTop);
    s.v3('uSkyBottom', env.skyBottom);
    s.v3('uCamPos', this.camera.pos);
    s.v3('uFogColor', env.fogColor);
    s.v2('uFogRange', env.fogRange[0], env.fogRange[1]);
    s.f('uShadowTexel', 1 / this.shadow.size);
    s.f('uShadowStrength', this.shadowEnabled ? this.shadowStrength : 0);
    s.i('uNumLights', this.lights.count);
    if (this.lights.count) {
      const l = this.shWorld.loc('uLightPos');
      if (l) gl.uniform3fv(l, this.lights.pos);
      const l2 = this.shWorld.loc('uLightColor');
      if (l2) gl.uniform3fv(l2, this.lights.color);
      const l3 = this.shWorld.loc('uLightRadius');
      if (l3) gl.uniform1fv(l3, this.lights.radius);
    }
    s.tex('uShadow', this.shadow.tex, 1);
    s.f('uAlphaTest', 0);
  }

  _drawBatch(s, b) {
    const mat = MATERIALS[b.mat] || {};
    s.m4('uModel', this._identity);
    m4normalMatrix(this._nm, this._identity);
    s.m3('uNormalMat', this._nm);
    s.v2('uUVScale', 1, 1);
    const tint = mat.tint || [1, 1, 1];
    const alpha = mat.alpha === undefined ? 1 : mat.alpha;
    s.v4('uTint', tint[0], tint[1], tint[2], alpha);
    s.f('uSpec', mat.spec === undefined ? 0.05 : mat.spec);
    s.f('uGloss', mat.gloss === undefined ? 8 : mat.gloss);
    s.f('uEmissive', 0);
    s.tex('uTex', this.materialTexture(b.mat), 0);
    if (alpha < 0.999) {
      const gl = this.gl;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      b.mesh.draw();
      gl.disable(gl.BLEND);
    } else {
      b.mesh.draw();
    }
    this.stats.drawCalls++;
    this.stats.tris += b.mesh.count / 3;
  }

  _drawDynamic(s, item) {
    const o = item.o;
    s.m4('uModel', item.matrix);
    m4normalMatrix(this._nm, item.matrix);
    s.m3('uNormalMat', this._nm);
    const uv = o.uvScale || 1;
    s.v2('uUVScale', uv, uv);
    const c = o.color || [1, 1, 1, 1];
    s.v4('uTint', c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]);
    s.f('uSpec', o.spec === undefined ? 0.12 : o.spec);
    s.f('uGloss', o.gloss === undefined ? 16 : o.gloss);
    s.f('uEmissive', o.emissive || 0);
    s.tex('uTex', o.mat ? this.materialTexture(o.mat) : this.white, 0);
    item.mesh.draw();
    this.stats.drawCalls++;
    this.stats.tris += item.mesh.count / 3;
  }

  _spritePass() {
    if (!this.spriteGroups.size) return;
    const gl = this.gl;
    const buf = this.spriteBuf;
    const right = this._camRight, up = this._camUp;
    const groups = [];
    for (const g of this.spriteGroups.values()) {
      g.items.sort((a, b) => b.dist - a.dist);
      const start = buf.count;
      for (const it of g.items) {
        if (buf.room < 6) break;
        const hw = it.size * 0.5 * it.aspect, hh = it.size * 0.5;
        let rx, ry, rz, ux, uy, uz;
        if (it.normal) {
          // 贴花：以法线为朝向
          const n = it.normal;
          let t = Math.abs(n[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
          const r0 = vnorm(v3(), vcross(v3(), t, n));
          const u0 = vnorm(v3(), vcross(v3(), n, r0));
          const ca = Math.cos(it.rot), sa = Math.sin(it.rot);
          rx = r0[0] * ca + u0[0] * sa; ry = r0[1] * ca + u0[1] * sa; rz = r0[2] * ca + u0[2] * sa;
          ux = u0[0] * ca - r0[0] * sa; uy = u0[1] * ca - r0[1] * sa; uz = u0[2] * ca - r0[2] * sa;
        } else {
          const ca = Math.cos(it.rot), sa = Math.sin(it.rot);
          rx = right[0] * ca + up[0] * sa; ry = right[1] * ca + up[1] * sa; rz = right[2] * ca + up[2] * sa;
          ux = up[0] * ca - right[0] * sa; uy = up[1] * ca - right[1] * sa; uz = up[2] * ca - right[2] * sa;
        }
        const p = it.pos, c = it.color;
        const a = c[3] === undefined ? 1 : c[3];
        const x0 = p[0] - rx * hw - ux * hh, y0 = p[1] - ry * hw - uy * hh, z0 = p[2] - rz * hw - uz * hh;
        const x1 = p[0] + rx * hw - ux * hh, y1 = p[1] + ry * hw - uy * hh, z1 = p[2] + rz * hw - uz * hh;
        const x2 = p[0] + rx * hw + ux * hh, y2 = p[1] + ry * hw + uy * hh, z2 = p[2] + rz * hw + uz * hh;
        const x3 = p[0] - rx * hw + ux * hh, y3 = p[1] - ry * hw + uy * hh, z3 = p[2] - rz * hw + uz * hh;
        buf.push(x0, y0, z0, 0, 1, c[0], c[1], c[2], a);
        buf.push(x1, y1, z1, 1, 1, c[0], c[1], c[2], a);
        buf.push(x2, y2, z2, 1, 0, c[0], c[1], c[2], a);
        buf.push(x0, y0, z0, 0, 1, c[0], c[1], c[2], a);
        buf.push(x2, y2, z2, 1, 0, c[0], c[1], c[2], a);
        buf.push(x3, y3, z3, 0, 0, c[0], c[1], c[2], a);
      }
      groups.push({ g, start, count: buf.count - start });
    }
    buf.upload();
    const s = this.shSprite.use();
    s.m4('uViewProj', this.viewProj);
    s.v3('uCamPos', this.camera.pos);
    s.v3('uFogColor', this.env.fogColor);
    s.v2('uFogRange', this.env.fogRange[0], this.env.fogRange[1]);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.spriteVAO);
    // 先画普通半透明，再画加法发光
    groups.sort((a, b) => (a.g.additive ? 1 : 0) - (b.g.additive ? 1 : 0));
    for (const grp of groups) {
      if (!grp.count) continue;
      if (grp.g.additive) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      s.i('uAdditive', grp.g.additive ? 1 : 0);
      s.tex('uTex', this.spriteTex.get(grp.g.name) || this.white, 0);
      gl.drawArrays(gl.TRIANGLES, grp.start, grp.count);
      this.stats.drawCalls++;
    }
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _shadowPass() {
    const gl = this.gl;
    const env = this.env;
    const sm = this.shadow;
    const ext = this.shadowExtent;
    // 阴影中心取相机前方一点，并对齐到纹素网格减少抖动
    const c = vaddScaled(v3(), this.camera.pos, this._camDir || [0, 0, 1], ext * 0.35);
    const texelWorld = (ext * 2) / sm.size;
    c[0] = Math.round(c[0] / texelWorld) * texelWorld;
    c[1] = Math.round(c[1] / texelWorld) * texelWorld;
    c[2] = Math.round(c[2] / texelWorld) * texelWorld;
    const eye = vaddScaled(v3(), c, env.sunDir, -70);
    const lv = m4lookAt(m4(), eye, c, [0, 1, 0]);
    const lp = m4ortho(m4(), -ext, ext, -ext, ext, 1, 160);
    m4mul(this.lightVP, lp, lv);
    // bias 矩阵：clip -> [0,1]
    const bias = m4();
    bias[0] = 0.5; bias[5] = 0.5; bias[10] = 0.5;
    bias[12] = 0.5; bias[13] = 0.5; bias[14] = 0.5;
    m4mul(this.lightMat, bias, this.lightVP);

    gl.bindFramebuffer(gl.FRAMEBUFFER, sm.fbo);
    gl.viewport(0, 0, sm.size, sm.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);   // 正面剔除减轻 peter-panning
    const s = this.shDepth.use();
    s.m4('uLightVP', this.lightVP);
    s.m4('uModel', this._identity);
    for (const b of this.worldBatches) {
      const mat = MATERIALS[b.mat];
      if (mat && mat.translucent) continue;
      b.mesh.draw();
    }
    for (const m of this.models) {
      if (m.o.noShadow) continue;
      s.m4('uModel', m.matrix);
      m.mesh.draw();
    }
    gl.cullFace(gl.BACK);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
