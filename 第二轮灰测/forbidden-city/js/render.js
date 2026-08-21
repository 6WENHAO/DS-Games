/* ============================================================
   渲染器：WebGL2 · 体素着色(逐格色差+格线+AO) · 三级级联阴影
             · 程序化天空/昼夜 · 水面 · 大气雾
   ============================================================ */
'use strict';

const GLSL_COMMON = `
const vec3 NRM[6] = vec3[6](
  vec3(1.,0.,0.), vec3(-1.,0.,0.), vec3(0.,1.,0.),
  vec3(0.,-1.,0.), vec3(0.,0.,1.), vec3(0.,0.,-1.));
float hash13(vec3 p){
  p = fract(p*0.3183099 + vec3(0.71,0.113,0.419));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
`;

const GLSL_SKY = `
uniform vec3 uSunDir;      // 指向太阳
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSunColor;
uniform float uNight;
vec3 skyColor(vec3 d){
  float h = clamp(d.y*1.0, -0.2, 1.0);
  float t = pow(clamp(1.0-h, 0.0, 1.0), 2.2);
  vec3 c = mix(uSkyZenith, uSkyHorizon, t);
  // 太阳附近的辉光
  float sd = max(dot(normalize(d), uSunDir), 0.0);
  c += uSunColor * pow(sd, 24.0) * 0.30;
  c += uSunColor * pow(sd, 1400.0) * 5.0;
  // 夜空星点
  if (uNight > 0.01 && d.y > 0.0) {
    vec3 sp = floor(normalize(d)*180.0);
    float s = hash13(sp);
    float star = smoothstep(0.9975, 1.0, s) * uNight * (0.4+0.6*d.y);
    c += vec3(star*1.6, star*1.6, star*1.9);
  }
  return c;
}
`;

const VS_VOXEL = `#version 300 es
precision highp float;
layout(location=0) in uint aP;
layout(location=1) in uint aC;
uniform vec3 uRegion;
uniform mat4 uViewProj;
uniform sampler2D uPal;
out vec3 vWorld; out vec3 vNrm; out vec3 vAlbedo; out float vAO; out float vEmis; out float vGloss;
${GLSL_COMMON}
void main(){
  vec3 p = vec3(float(aP & 255u), float((aP>>8) & 255u), float((aP>>16) & 255u));
  uint nrmI = (aP>>24) & 7u;
  vec3 world = uRegion + p;
  vNrm = NRM[nrmI];
  uint ci = aC & 255u;
  vec4 pal = texelFetch(uPal, ivec2(int(ci), 0), 0);
  vAlbedo = pow(pal.rgb, vec3(2.2));      // sRGB -> 线性
  vEmis = pal.a;
  vGloss = texelFetch(uPal, ivec2(int(ci), 1), 0).r;
  vAO = float((aC>>8) & 3u)/3.0;
  vWorld = world;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const FS_VOXEL = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld; in vec3 vNrm; in vec3 vAlbedo; in float vAO; in float vEmis; in float vGloss;
out vec4 outColor;
uniform vec3 uCam;
uniform mat4 uShadowM[3];
uniform sampler2DShadow uShadow0, uShadow1, uShadow2;
uniform float uCascadeEnd[3];
uniform float uShadowTexel[3];
uniform float uShadowTexelWorld[3];
uniform float uShadowDepthRange;
uniform float uFogDensity;
uniform float uExposure;
uniform float uGridStrength;
uniform float uAmbient;
uniform float uShadowOn;
${GLSL_COMMON}
${GLSL_SKY}

float sampleShadow(int idx, vec3 world, vec3 N, float nDotL){
  float tw = uShadowTexelWorld[idx];
  vec4 sp = uShadowM[idx] * vec4(world + N * tw * 1.7, 1.0);
  vec3 c = sp.xyz / sp.w * 0.5 + 0.5;
  if (c.x<0.003||c.x>0.997||c.y<0.003||c.y>0.997||c.z>0.999) return -1.0;
  // 世界尺度偏移换算到深度归一化空间
  float bias = (0.28 + tw * (0.9 + 1.6*(1.0-nDotL))) / uShadowDepthRange;
  c.z -= bias;
  float t = uShadowTexel[idx];
  float s = 0.0;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
    vec3 uvw = vec3(c.xy + vec2(float(x),float(y))*t, c.z);
    if (idx==0) s += texture(uShadow0, uvw);
    else if (idx==1) s += texture(uShadow1, uvw);
    else s += texture(uShadow2, uvw);
  }
  return s/9.0;
}

void main(){
  vec3 N = normalize(vNrm);
  // ---- 体素质感：逐格明暗 + 格线 ----
  vec3 cell = floor(vWorld - N*0.5);
  float n = hash13(cell);
  vec3 albedo = vAlbedo * (0.93 + 0.14*n);
  // 面内切向坐标 → 格线
  vec3 t1 = abs(N.y) > 0.5 ? vec3(1.,0.,0.) : vec3(0.,1.,0.);
  vec3 t2 = cross(N, t1);
  vec2 uv = vec2(dot(vWorld, t1), dot(vWorld, t2));
  vec2 f = abs(fract(uv) - 0.5);
  vec2 w = fwidth(uv)*1.4 + 1e-5;
  vec2 lineAA = smoothstep(vec2(0.5)-w, vec2(0.5), f);
  float grid = max(lineAA.x, lineAA.y) * clamp(1.0 - max(w.x,w.y)*1.2, 0.0, 1.0);
  albedo *= (1.0 - uGridStrength*grid);

  // ---- 光照 ----
  float nDotL = max(dot(N, uSunDir), 0.0);
  float d = length(vWorld - uCam);
  float shadow = 1.0;
  if (nDotL > 0.0){
    float s = -1.0;
    if (d < uCascadeEnd[0]) s = sampleShadow(0, vWorld, N, nDotL);
    if (s < 0.0 && d < uCascadeEnd[1]) s = sampleShadow(1, vWorld, N, nDotL);
    if (s < 0.0) s = sampleShadow(2, vWorld, N, nDotL);
    shadow = mix(1.0, max(s, 0.0), uShadowOn);
  }
  float ao = mix(0.42, 1.0, vAO);
  // 天空半球环境光
  vec3 skyUp = skyColor(vec3(0.,1.,0.));
  vec3 skyHz = skyColor(normalize(vec3(N.x, 0.15, N.z)+vec3(0.001)));
  vec3 ambRaw = mix(skyHz, skyUp, 0.5*(N.y+1.0));
  float aL = dot(ambRaw, vec3(0.25,0.55,0.20));
  vec3 ambient = mix(ambRaw, vec3(aL), 0.52);                 // 去饱和，避免影子发蓝
  ambient = mix(ambient, uSunColor*0.5, 0.20);
  ambient *= (0.85 + 0.35*N.y) * uAmbient;
  // 地面反弹光（宫城多黄瓦灰砖，暖调）
  vec3 bounce = vec3(0.055,0.042,0.028) * max(-N.y*0.5+0.42, 0.0) * (0.35+0.65*shadow) * uSunColor.r;
  vec3 direct = uSunColor * nDotL * shadow * 1.95;
  vec3 col = albedo * (direct + ambient*ao + bounce*ao);
  // 高光（琉璃瓦/金饰）
  vec3 Vv = normalize(uCam - vWorld);
  vec3 H = normalize(Vv + uSunDir);
  float shin = mix(6.0, 130.0, vGloss);
  float spec = pow(max(dot(N,H),0.0), shin) * shadow * nDotL * vGloss * vGloss * 2.2;
  col += uSunColor * spec * (0.35+0.65*albedo);
  col += albedo * vEmis * 2.4;

  // ---- 雾 / 大气透视 ----
  vec3 vd = normalize(vWorld - uCam);
  float fog = 1.0 - exp(-pow(d*uFogDensity, 1.6));
  col = mix(col, mix(vec3(0.62,0.60,0.55), skyColor(vd)*0.94, 0.55), clamp(fog,0.0,1.0));

  // ---- 曝光 + ACES 近似 ----
  col *= uExposure;
  col = (col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  outColor = vec4(pow(max(col,0.0), vec3(1.0/2.2)), 1.0);
}`;

const VS_DEPTH = `#version 300 es
precision highp float;
layout(location=0) in uint aP;
uniform vec3 uRegion;
uniform mat4 uViewProj;
void main(){
  vec3 p = vec3(float(aP & 255u), float((aP>>8) & 255u), float((aP>>16) & 255u));
  gl_Position = uViewProj * vec4(uRegion + p, 1.0);
}`;
const FS_DEPTH = `#version 300 es
precision highp float;
void main(){}`;

const VS_SKY = `#version 300 es
precision highp float;
layout(location=0) in vec2 aXY;
uniform mat4 uInvViewProj;
uniform vec3 uCam;
out vec3 vDir;
void main(){
  vec4 p = uInvViewProj * vec4(aXY, 1.0, 1.0);
  vDir = normalize(p.xyz/p.w - uCam);
  gl_Position = vec4(aXY, 1.0, 1.0);
}`;
const FS_SKY = `#version 300 es
precision highp float;
in vec3 vDir; out vec4 outColor;
uniform float uExposure;
${GLSL_COMMON}
${GLSL_SKY}
void main(){
  vec3 c = skyColor(normalize(vDir));
  // 地平线以下渐变到雾色
  c = mix(c, uSkyHorizon*0.55, smoothstep(0.0,-0.08, vDir.y));
  c *= uExposure;
  c = (c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14);
  outColor = vec4(pow(max(c,0.0), vec3(1.0/2.2)), 1.0);
}`;

const VS_WATER = `#version 300 es
precision highp float;
layout(location=0) in uint aP;
layout(location=1) in uint aC;
uniform vec3 uRegion;
uniform mat4 uViewProj;
out vec3 vWorld;
void main(){
  vec3 p = vec3(float(aP & 255u), float((aP>>8) & 255u), float((aP>>16) & 255u));
  vWorld = uRegion + p;
  gl_Position = uViewProj * vec4(vWorld, 1.0);
}`;
const FS_WATER = `#version 300 es
precision highp float;
in vec3 vWorld; out vec4 outColor;
uniform vec3 uCam; uniform float uTime; uniform float uExposure; uniform float uFogDensity;
${GLSL_COMMON}
${GLSL_SKY}
void main(){
  vec2 p = vWorld.xz;
  float w1 = sin(p.x*0.34 + uTime*0.9) * 0.5 + sin(p.y*0.41 - uTime*0.7)*0.5;
  float w2 = sin((p.x+p.y)*0.21 + uTime*0.55) + sin((p.x-p.y)*0.17 - uTime*0.4);
  vec3 N = normalize(vec3(w1*0.055 + w2*0.03, 1.0, w2*0.05 - w1*0.035));
  vec3 Vv = normalize(uCam - vWorld);
  float fres = pow(1.0 - max(dot(N,Vv),0.0), 4.0);
  vec3 R = reflect(-Vv, N);
  R.y = abs(R.y);
  vec3 refl = skyColor(R);
  vec3 deep = vec3(0.010,0.028,0.038);
  vec3 col = mix(deep, refl, clamp(0.14 + fres*0.9, 0.0, 1.0));
  vec3 H = normalize(Vv + uSunDir);
  col += uSunColor * pow(max(dot(N,H),0.0), 260.0) * 3.2;
  col += uSunColor * pow(max(dot(N,H),0.0), 24.0) * 0.10;
  float d = length(vWorld-uCam);
  float fog = 1.0 - exp(-pow(d*uFogDensity, 1.6));
  col = mix(col, skyColor(normalize(vWorld-uCam))*0.94, clamp(fog,0.0,1.0));
  col *= uExposure;
  col = (col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  outColor = vec4(pow(max(col,0.0), vec3(1.0/2.2)), 0.93);
}`;

class Renderer {
  constructor(canvas, opts = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('需要 WebGL2 支持');
    this.gl = gl; this.canvas = canvas;
    this.shadowSize = opts.shadowSize || 2048;
    this.cascadeSpan = opts.cascadeSpan || [70, 300, 1400];
    this.progVoxel = GLX.program(gl, VS_VOXEL, FS_VOXEL, 'voxel');
    this.progDepth = GLX.program(gl, VS_DEPTH, FS_DEPTH, 'depth');
    this.progSky = GLX.program(gl, VS_SKY, FS_SKY, 'sky');
    this.progWater = GLX.program(gl, VS_WATER, FS_WATER, 'water');
    this.skyVAO = gl.createVertexArray();
    gl.bindVertexArray(this.skyVAO);
    GLX.buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this._initShadow();
    this._initPalette();
    this.frustum = new Frustum();
    this.lightFrustum = new Frustum();
    this.tmp = {
      view: M4.create(), proj: M4.create(), vp: M4.create(), inv: M4.create(),
      lv: M4.create(), lp: M4.create(), lvp: M4.create(),
      eye: V3.create(), ctr: V3.create(), up: V3.create(0, 1, 0),
    };
    this.shadowM = [M4.create(), M4.create(), M4.create()];
    this.stats = { drawn: 0, quads: 0, culled: 0 };
    this.time = 0;
  }
  _initShadow() {
    const gl = this.gl, S = this.shadowSize;
    this.shadowTex = []; this.shadowFB = [];
    for (let i = 0; i < 3; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, S, S, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.shadowTex.push(t); this.shadowFB.push(fb);
    }
  }
  _initPalette() {
    const gl = this.gl;
    const data = new Uint8Array(256 * 2 * 4);
    for (let i = 0; i < PALETTE.length; i++) {
      const p = PALETTE[i], k = (i + 1) * 4;
      data[k] = p[0]; data[k + 1] = p[1]; data[k + 2] = p[2];
      data[k + 3] = Math.round((p[3] || 0) * 255);
      data[1024 + k] = Math.round((p[4] === undefined ? 0.06 : p[4]) * 255);
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.palTex = t;
  }
  /** 上传网格（MeshSet），建立每区域 VAO */
  upload(meshSet, waterSet) {
    const gl = this.gl;
    let maxQ = 0;
    for (const m of [meshSet, waterSet]) {
      if (!m) continue;
      for (const r of m.regions.values()) maxQ = Math.max(maxQ, r.quads);
    }
    // 共享索引缓冲
    const idx = new Uint32Array(maxQ * 6);
    for (let q = 0; q < maxQ; q++) {
      const v = q * 4, o = q * 6;
      idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
      idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
    }
    this.ibo = GLX.buffer(gl, idx, gl.ELEMENT_ARRAY_BUFFER);
    const build = (m) => {
      const out = [];
      if (!m) return out;
      for (const r of m.regions.values()) {
        if (!r.quads) continue;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, r.data.subarray(0, r.n), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 8, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 8, 4);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bindVertexArray(null);
        r.vao = vao; r.vbo = vbo;
        r.data = null;      // 释放 CPU 内存
        out.push(r);
      }
      return out;
    };
    this.regions = build(meshSet);
    this.waterRegions = build(waterSet);
    this.totalQuads = this.regions.reduce((a, r) => a + r.quads, 0) +
      this.waterRegions.reduce((a, r) => a + r.quads, 0);
  }
  /** 太阳与天空参数（t: 0..1 一天，0.25=日出 0.5=正午 0.75=日落） */
  setSun(t) {
    // 北京纬度日轨：日出偏东北→正午偏南→日落偏西北
    const maxEl = (this.sunMaxElev || 56) * Math.PI / 180;
    const el = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * maxEl - 0.075;
    const az = (86 + 208 * t) * Math.PI / 180;       // 方位角（自北顺时针）
    const ce = Math.cos(el);
    this.sunDir = V3.norm(V3.create(), V3.create(
      Math.sin(az) * ce, Math.max(Math.sin(el), -0.3), -Math.cos(az) * ce));
    const h = Math.max(0, Math.sin(el));
    const elev = Math.sin(el);
    const night = 1 - Math.min(1, Math.max(0, (elev + 0.09) * 8));
    this.night = night;
    // 日出日落偏暖，正午偏白
    const warm = Math.pow(1 - Math.min(1, h * 1.9), 2.0);
    const inten = 1.15 * (1 - night * 0.94);
    this.sunColor = V3.create(
      (1.00 + warm * 0.30) * inten,
      (0.90 - warm * 0.30) * inten,
      (0.74 - warm * 0.52) * inten);
    if (night > 0.55) this.sunColor = V3.create(0.055, 0.070, 0.125);   // 月光
    const srgb = (c) => V3.create(Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2));
    const dayZen = srgb([0.28, 0.47, 0.82]), dayHz = srgb([0.64, 0.75, 0.88]);
    const duskZen = srgb([0.26, 0.28, 0.52]), duskHz = srgb([0.95, 0.58, 0.30]);
    const nightZen = srgb([0.045, 0.065, 0.14]), nightHz = srgb([0.10, 0.13, 0.22]);
    const k = Math.pow(1 - Math.min(1, h * 2.4), 1.6);
    let zen = V3.lerp(V3.create(), dayZen, duskZen, k);
    let hz = V3.lerp(V3.create(), dayHz, duskHz, k);
    zen = V3.lerp(V3.create(), zen, nightZen, night);
    hz = V3.lerp(V3.create(), hz, nightHz, night);
    this.skyZenith = zen; this.skyHorizon = hz;
    this.exposure = 0.95 + night * 1.7;
    this.ambientScale = 0.85 + night * 0.35;
  }
  _shadowMatrix(i, focus, span) {
    const t = this.tmp;
    const S = this.shadowSize;
    const texel = span * 2 / S;
    // 对齐到纹素网格，减少抖动
    const fx = Math.round(focus[0] / texel) * texel;
    const fy = Math.round(focus[1] / texel) * texel;
    const fz = Math.round(focus[2] / texel) * texel;
    const dist = 700;
    this.shadowDepthRange = dist * 2;
    V3.set(t.ctr, fx, fy, fz);
    V3.scaleAdd(t.eye, t.ctr, this.sunDir, dist);
    M4.lookAt(t.lv, t.eye, t.ctr, Math.abs(this.sunDir[1]) > 0.95 ? V3.create(0, 0, 1) : t.up);
    M4.ortho(t.lp, -span, span, -span, span, 1, dist * 2);
    M4.mul(this.shadowM[i], t.lp, t.lv);
    return this.shadowM[i];
  }
  _drawRegions(prog, list, frustum, isWater) {
    const gl = this.gl;
    let drawn = 0, quads = 0;
    for (const r of list) {
      if (r.bx1 < r.bx0) continue;
      if (frustum && !frustum.boxVisible(r.bx0 - 0.5, r.by0 - 0.5, r.bz0 - 0.5, r.bx1 + 0.5, r.by1 + 0.5, r.bz1 + 0.5)) continue;
      gl.uniform3f(prog.u.uRegion, r.rx, r.ry, r.rz);
      gl.bindVertexArray(r.vao);
      gl.drawElements(gl.TRIANGLES, r.quads * 6, gl.UNSIGNED_INT, 0);
      drawn++; quads += r.quads;
    }
    this.stats.drawn += drawn; this.stats.quads += quads;
    void isWater;
  }
  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR || 2);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { w, h };
  }
  /** 主渲染 */
  render(cam, dt) {
    const gl = this.gl, t = this.tmp;
    this.time += dt;
    const { w, h } = this.resize();
    this.stats.drawn = 0; this.stats.quads = 0;
    M4.perspective(t.proj, cam.fovy, w / h, cam.near || 0.1, cam.far || 4000);
    M4.lookAt(t.view, cam.pos, cam.target, cam.up || t.up);
    M4.mul(t.vp, t.proj, t.view);
    this.frustum.fromMatrix(t.vp);

    // ---------- 阴影 ----------
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.colorMask(false, false, false, false);
    gl.useProgram(this.progDepth);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    const focus = cam.shadowFocus || cam.target;
    this.frameNo = (this.frameNo || 0) + 1;
    if (!this._sst) this._sst = [null, null, null];
    const sunKey = this.sunDir[0] * 1e4 + this.sunDir[1] * 97 + this.sunDir[2];
    const shadowsEnabled = this.shadowOn !== false;
    for (let i = 0; i < 3; i++) {
      const span = this.cascadeSpan[i];
      const f = i === 2 ? V3.create(0, 0, 0) : focus;
      const st = this._sst[i];
      let need = !st || !shadowsEnabled === false && false;
      if (!st) need = true;
      else if (st.sun !== sunKey) need = true;
      else if (i === 0) need = true;
      else if (V3.dist(st.focus, f) > (i === 1 ? 10 : 400)) need = true;
      else if (this.frameNo - st.frame > (i === 1 ? 15 : 240)) need = true;
      if (!shadowsEnabled) need = false;
      if (!need) continue;
      this._sst[i] = { sun: sunKey, focus: V3.copy(V3.create(), f), frame: this.frameNo };
      const m = this._shadowMatrix(i, f, span);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB[i]);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(this.progDepth.u.uViewProj, false, m);
      this.lightFrustum.fromMatrix(m);
      this._drawRegions(this.progDepth, this.regions, this.lightFrustum, false);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, w, h);

    // ---------- 天空 ----------
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.useProgram(this.progSky);
    M4.invert(t.inv, t.vp);
    gl.uniformMatrix4fv(this.progSky.u.uInvViewProj, false, t.inv);
    gl.uniform3fv(this.progSky.u.uCam, cam.pos);
    this._skyUniforms(this.progSky);
    gl.bindVertexArray(this.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // ---------- 体素 ----------
    gl.enable(gl.CULL_FACE);
    const p = this.progVoxel;
    gl.useProgram(p);
    gl.uniformMatrix4fv(p.u.uViewProj, false, t.vp);
    gl.uniform3fv(p.u.uCam, cam.pos);
    this._skyUniforms(p);
    gl.uniform1f(p.u.uFogDensity, this.fogDensity === undefined ? 0.00042 : this.fogDensity);
    gl.uniform1f(p.u.uGridStrength, this.gridStrength === undefined ? 0.16 : this.gridStrength);
    gl.uniform1f(p.u.uAmbient, this.ambientScale === undefined ? 1.0 : this.ambientScale);
    gl.uniform1f(p.u.uShadowOn, this.shadowOn === false ? 0 : 1);
    const mArr = new Float32Array(48);
    for (let i = 0; i < 3; i++) mArr.set(this.shadowM[i], i * 16);
    gl.uniformMatrix4fv(p.u.uShadowM, false, mArr);
    gl.uniform1fv(p.u.uCascadeEnd, new Float32Array([
      this.cascadeSpan[0] * 0.92, this.cascadeSpan[1] * 0.92, 1e9]));
    gl.uniform1fv(p.u.uShadowTexel, new Float32Array([1 / this.shadowSize, 1 / this.shadowSize, 1 / this.shadowSize]));
    gl.uniform1fv(p.u.uShadowTexelWorld, new Float32Array([
      2 * this.cascadeSpan[0] / this.shadowSize,
      2 * this.cascadeSpan[1] / this.shadowSize,
      2 * this.cascadeSpan[2] / this.shadowSize]));
    gl.uniform1f(p.u.uShadowDepthRange, this.shadowDepthRange || 1400);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.palTex);
    gl.uniform1i(p.u.uPal, 0);
    for (let i = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex[i]);
      gl.uniform1i(p.u['uShadow' + i], 1 + i);
    }
    this._drawRegions(p, this.regions, this.frustum, false);

    // ---------- 水面 ----------
    if (this.waterRegions.length) {
      const wp = this.progWater;
      gl.useProgram(wp);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(wp.u.uViewProj, false, t.vp);
      gl.uniform3fv(wp.u.uCam, cam.pos);
      gl.uniform1f(wp.u.uTime, this.time);
      gl.uniform1f(wp.u.uFogDensity, this.fogDensity === undefined ? 0.00042 : this.fogDensity);
      this._skyUniforms(wp);
      this._drawRegions(wp, this.waterRegions, this.frustum, true);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }
  _skyUniforms(p) {
    const gl = this.gl;
    gl.uniform3fv(p.u.uSunDir, this.sunDir);
    gl.uniform3fv(p.u.uSkyZenith, this.skyZenith);
    gl.uniform3fv(p.u.uSkyHorizon, this.skyHorizon);
    gl.uniform3fv(p.u.uSunColor, this.sunColor);
    gl.uniform1f(p.u.uNight, this.night);
    gl.uniform1f(p.u.uExposure, this.exposure);
  }
}

window.Renderer = Renderer;
