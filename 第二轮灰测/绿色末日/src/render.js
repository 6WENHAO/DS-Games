/* =========================================================================
 * GREENFALL · render.js —— WebGL2 渲染器
 * 地形 / 天空与昼夜 / 水体波动 / 实体 / 粒子 / 选中框 / 手持模型 / 雨雪
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util, M4 = GF.M4;

  /* ------------------------------------------------------------ 着色器 */
  const VS_TERRAIN = `#version 300 es
in vec3 aPos; in vec2 aUV; in vec4 aLig;
uniform mat4 uVP; uniform vec3 uCam; uniform float uTime; uniform int uWave;
out vec2 vUV; out vec3 vLig; out float vDist;
void main(){
  vec3 p = aPos;
  if (uWave == 1) {
    p.y -= 0.11 + sin(uTime*1.5 + p.x*0.6 + p.z*0.55)*0.05;
  }
  vUV = aUV; vLig = aLig.xyz; vDist = length(p - uCam);
  gl_Position = uVP * vec4(p, 1.0);
}`;

  const FS_TERRAIN = `#version 300 es
precision mediump float;
in vec2 vUV; in vec3 vLig; in float vDist;
uniform sampler2D uAtlas;
uniform float uSun, uAlphaTest, uFogNear, uFogFar, uOpacity, uHandLight;
uniform vec3 uFog, uNightTint, uTorch;
out vec4 frag;
void main(){
  vec4 t = texture(uAtlas, vUV);
  if (t.a < uAlphaTest) discard;
  float shade = vLig.x;
  float sky = vLig.y * uSun;
  float blk = vLig.z;
  vec3 skyCol = mix(uNightTint, vec3(1.0, 0.985, 0.95), clamp(uSun*1.15, 0.0, 1.0));
  vec3 lit = skyCol * sky + uTorch * blk * 1.15;
  // 手持光源（手电筒 / 油灯 / 头灯）
  float hl = uHandLight * clamp(1.0 - vDist / 15.0, 0.0, 1.0);
  lit = max(lit, vec3(1.0, 0.94, 0.82) * hl * hl);
  lit = max(lit, uNightTint * 0.16);
  vec3 col = t.rgb * shade * (0.16 + 0.94 * lit);
  float f = clamp((vDist - uFogNear) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFog, f * f * 0.96);
  frag = vec4(col, t.a * uOpacity);
}`;

  const VS_SKY = `#version 300 es
in vec2 aPos;
uniform mat4 uInvVP; uniform vec3 uCam;
out vec3 vRay;
void main(){
  vec4 p = uInvVP * vec4(aPos, 0.0, 1.0);
  vec4 q = uInvVP * vec4(aPos, 1.0, 1.0);
  vRay = normalize(q.xyz / q.w - p.xyz / p.w);
  gl_Position = vec4(aPos, 0.9999, 1.0);
}`;

  const FS_SKY = `#version 300 es
precision mediump float;
in vec3 vRay;
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol;
uniform float uSun, uStars, uOvercast;
out vec4 frag;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 r = normalize(vRay);
  float up = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.75));
  // 太阳/月亮
  float sd = max(0.0, dot(r, normalize(uSunDir)));
  col += uSunCol * pow(sd, 260.0) * 2.2;
  col += uSunCol * pow(sd, 12.0) * 0.28;
  // 星空
  if (uStars > 0.01 && r.y > -0.05) {
    vec2 g = floor(r.xz / max(0.02, abs(r.y) * 0.06 + 0.02) * 40.0);
    float s = h21(g);
    if (s > 0.9965) col += vec3(0.9, 0.93, 1.0) * uStars * (0.5 + 0.5 * h21(g + 3.1));
  }
  col = mix(col, mix(uHorizon, vec3(0.42, 0.44, 0.44), 0.55), uOvercast * 0.6);
  frag = vec4(col, 1.0);
}`;

  const VS_MODEL = `#version 300 es
in vec3 aPos; in vec2 aUV; in vec3 aNor;
uniform mat4 uVP, uModel; uniform vec3 uCam;
out vec2 vUV; out float vDist; out float vNdl;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vUV = aUV; vDist = length(wp.xyz - uCam);
  vec3 n = normalize(mat3(uModel) * aNor);
  vNdl = 0.45 + 0.55 * max(0.0, dot(n, normalize(vec3(0.4, 0.9, 0.25))));
  gl_Position = uVP * wp;
}`;

  const FS_MODEL = `#version 300 es
precision mediump float;
in vec2 vUV; in float vDist; in float vNdl;
uniform sampler2D uAtlas;
uniform vec3 uTint, uFog;
uniform float uLight, uFogNear, uFogFar, uAlpha;
out vec4 frag;
void main(){
  vec4 t = texture(uAtlas, vUV);
  if (t.a < 0.35) discard;
  vec3 col = t.rgb * uTint * vNdl * (0.2 + 0.9 * uLight);
  float f = clamp((vDist - uFogNear) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFog, f * f * 0.96);
  frag = vec4(col, t.a * uAlpha);
}`;

  const VS_PART = `#version 300 es
in vec3 aPos; in vec4 aCol; in float aSize;
uniform mat4 uVP; uniform vec3 uCam; uniform float uScale;
out vec4 vCol;
void main(){
  vCol = aCol;
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  // aSize 是世界尺寸（米），uScale = 屏幕高 / (2*tan(fov/2))
  gl_PointSize = clamp(aSize * uScale / max(0.35, p.w), 1.0, 26.0);
}`;

  const FS_PART = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  frag = vCol;
}`;

  const VS_LINE = `#version 300 es
in vec3 aPos; uniform mat4 uVP; uniform vec3 uOff;
void main(){ gl_Position = uVP * vec4(aPos + uOff, 1.0); }`;
  const FS_LINE = `#version 300 es
precision mediump float; uniform vec4 uCol; out vec4 frag;
void main(){ frag = uCol; }`;

  /* --------------------------------------------------------- 工具函数 */
  function compile(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('[shader ' + name + '] ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
  function program(gl, vs, fs, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('[link ' + name + '] ' + gl.getProgramInfoLog(p));
    const u = {}, a = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
    return { p, u, a };
  }

  /* ------------------------------------------------- 实体模型（箱体组） */
  // box: [ox,oy,oz, sx,sy,sz, texName]
  const MODELS = {
    zombie: {
      h: 1.85, boxes: [
        [-0.19, 0.0, -0.09, 0.16, 0.78, 0.18, 'zombie_cloth'],
        [0.03, 0.0, -0.09, 0.16, 0.78, 0.18, 'zombie_cloth'],
        [-0.22, 0.78, -0.13, 0.44, 0.62, 0.26, 'zombie_cloth'],
        [-0.34, 0.86, -0.10, 0.12, 0.52, 0.20, 'zombie_skin'],
        [0.22, 0.86, -0.10, 0.12, 0.52, 0.20, 'zombie_skin'],
        [-0.16, 1.40, -0.16, 0.32, 0.32, 0.32, 'zombie_skin'],
        [-0.10, 1.66, -0.10, 0.20, 0.10, 0.20, 'zombie_moss'],
      ],
    },
    dog: {
      h: 0.8, boxes: [
        [-0.16, 0.28, -0.42, 0.32, 0.34, 0.72, 'fur_grey'],
        [-0.13, 0.40, -0.72, 0.26, 0.26, 0.32, 'fur_grey'],
        [-0.14, 0.0, -0.34, 0.09, 0.30, 0.09, 'fur_grey'],
        [0.05, 0.0, -0.34, 0.09, 0.30, 0.09, 'fur_grey'],
        [-0.14, 0.0, 0.20, 0.09, 0.30, 0.09, 'fur_grey'],
        [0.05, 0.0, 0.20, 0.09, 0.30, 0.09, 'fur_grey'],
      ],
    },
    boar: {
      h: 1.0, boxes: [
        [-0.26, 0.34, -0.52, 0.52, 0.48, 1.0, 'fur_brown'],
        [-0.20, 0.30, -0.86, 0.40, 0.36, 0.36, 'fur_brown'],
        [-0.22, 0.0, -0.42, 0.12, 0.36, 0.12, 'fur_brown'],
        [0.10, 0.0, -0.42, 0.12, 0.36, 0.12, 'fur_brown'],
        [-0.22, 0.0, 0.26, 0.12, 0.36, 0.12, 'fur_brown'],
        [0.10, 0.0, 0.26, 0.12, 0.36, 0.12, 'fur_brown'],
      ],
    },
    deer: {
      h: 1.5, boxes: [
        [-0.22, 0.72, -0.50, 0.44, 0.46, 1.0, 'hide_deer'],
        [-0.14, 1.02, -0.80, 0.28, 0.30, 0.34, 'hide_deer'],
        [-0.20, 0.0, -0.40, 0.09, 0.74, 0.09, 'hide_deer'],
        [0.11, 0.0, -0.40, 0.09, 0.74, 0.09, 'hide_deer'],
        [-0.20, 0.0, 0.30, 0.09, 0.74, 0.09, 'hide_deer'],
        [0.11, 0.0, 0.30, 0.09, 0.74, 0.09, 'hide_deer'],
      ],
    },
    crow: { h: 0.4, boxes: [[-0.12, 0.0, -0.18, 0.24, 0.20, 0.36, 'feather_black'], [-0.07, 0.16, -0.30, 0.14, 0.14, 0.16, 'feather_black']] },
    survivor: {
      h: 1.85, boxes: [
        [-0.19, 0.0, -0.09, 0.16, 0.78, 0.18, 'cloth_player'],
        [0.03, 0.0, -0.09, 0.16, 0.78, 0.18, 'cloth_player'],
        [-0.22, 0.78, -0.13, 0.44, 0.62, 0.26, 'cloth_player'],
        [-0.34, 0.86, -0.10, 0.12, 0.52, 0.20, 'skin_human'],
        [0.22, 0.86, -0.10, 0.12, 0.52, 0.20, 'skin_human'],
        [-0.16, 1.40, -0.16, 0.32, 0.32, 0.32, 'skin_human'],
      ],
    },
    spore: { h: 2.0, boxes: [[-0.9, 0.0, -0.9, 1.8, 1.8, 1.8, 'spore_cloud']] },
  };

  /* ============================================================ 渲染器 */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('需要支持 WebGL2 的浏览器（Chrome / Edge / Firefox 新版本）');
      this.gl = gl;
      this.renderDist = 8;      // 8 区块 ≈ 128 格，够看见 CBD 的天际线
      this.fov = 72;
      this.meshBudget = 3;
      this.meshMs = 9;
      this._init();
    }

    _init() {
      const gl = this.gl;
      this.progTerrain = program(gl, VS_TERRAIN, FS_TERRAIN, 'terrain');
      this.progSky = program(gl, VS_SKY, FS_SKY, 'sky');
      this.progModel = program(gl, VS_MODEL, FS_MODEL, 'model');
      this.progPart = program(gl, VS_PART, FS_PART, 'part');
      this.progLine = program(gl, VS_LINE, FS_LINE, 'line');

      // 图集纹理
      const atlas = GF.Atlas.build();
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // 全屏四边形
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      // 单位立方体（模型渲染用）
      this._buildCube();
      // 选中框线段
      this._buildBox();
      // 粒子缓冲
      this.partBuf = { pos: gl.createBuffer(), col: gl.createBuffer(), size: gl.createBuffer() };
      this.partCap = 4096;

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
    }

    _buildCube() {
      const gl = this.gl;
      const pos = [], uv = [], nor = [];
      const F = GF.FACES;
      for (const f of F) {
        const q = f.v, uvs = [[0, 1], [0, 0], [1, 0], [1, 1]];
        for (const vi of [0, 1, 2, 0, 2, 3]) {
          pos.push(q[vi][0], q[vi][1], q[vi][2]);
          uv.push(uvs[vi][0], uvs[vi][1]);
          nor.push(f.n[0], f.n[1], f.n[2]);
        }
      }
      const mk = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
      this.cube = { pos: mk(pos), uv: mk(uv), nor: mk(nor), count: pos.length / 3, uvArr: uv };
      this.cubeUVBufDyn = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeUVBufDyn);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv.length), gl.DYNAMIC_DRAW);
    }

    _buildBox() {
      const gl = this.gl;
      const e = 0.0022, a = -e, b = 1 + e;
      const P = [[a, a, a], [b, a, a], [b, a, b], [a, a, b], [a, b, a], [b, b, a], [b, b, b], [a, b, b]];
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const arr = [];
      for (const [i, j] of E) { arr.push(...P[i]); arr.push(...P[j]); }
      this.boxLines = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.boxLines);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      this.boxCount = arr.length / 3;
    }

    resize() {
      const c = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.gl.viewport(0, 0, c.width, c.height);
      this.aspect = c.width / Math.max(1, c.height);
    }

    /* ------------------------------------------------- 区块 GPU 资源 */
    uploadChunk(chunk) {
      const gl = this.gl;
      if (!chunk.geom) return;
      if (chunk.mesh) this.disposeChunk(chunk);
      const mk = (g) => {
        if (!g) return null;
        const pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pos); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
        const uv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, g.uv, gl.STATIC_DRAW);
        const lig = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lig); gl.bufferData(gl.ARRAY_BUFFER, g.lig, gl.STATIC_DRAW);
        return { pos, uv, lig, count: g.count };
      };
      chunk.mesh = { opaque: mk(chunk.geom.opaque), alpha: mk(chunk.geom.alpha), water: mk(chunk.geom.water) };
      chunk.geom = null;
    }
    disposeChunk(chunk) {
      const gl = this.gl;
      if (!chunk.mesh) return;
      for (const k of ['opaque', 'alpha', 'water']) {
        const m = chunk.mesh[k];
        if (m) { gl.deleteBuffer(m.pos); gl.deleteBuffer(m.uv); gl.deleteBuffer(m.lig); }
      }
      chunk.mesh = null;
    }

    _bindTerrain(m) {
      const gl = this.gl, A = this.progTerrain.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(A.aPos); gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.enableVertexAttribArray(A.aUV); gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.lig); gl.enableVertexAttribArray(A.aLig); gl.vertexAttribPointer(A.aLig, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    }

    /* ------------------------------------------------------- 主渲染 */
    render(st) {
      const gl = this.gl, world = st.world, cam = st.cam;
      this.resize();

      /* --- 天空颜色（按太阳高度与天气插值） --- */
      const sun = world.sunLevel();
      const t = world.time;
      const sunAngle = (t - 0.25) * Math.PI * 2;
      const sunDir = [Math.cos(sunAngle) * 0.4, Math.sin(sunAngle), 0.32];
      const night = t < 0.22 || t > 0.82;
      const dawn = Math.max(0, 1 - Math.abs(t - 0.25) / 0.09);
      const dusk = Math.max(0, 1 - Math.abs(t - 0.79) / 0.09);
      const twi = Math.max(dawn, dusk);
      let zen = U.mix3([0.05, 0.07, 0.14], [0.30, 0.52, 0.78], U.clamp(sun * 1.3, 0, 1));
      let hor = U.mix3([0.10, 0.12, 0.18], [0.66, 0.76, 0.80], U.clamp(sun * 1.4, 0, 1));
      hor = U.mix3(hor, [0.86, 0.48, 0.28], twi * 0.85);
      zen = U.mix3(zen, [0.36, 0.26, 0.40], twi * 0.5);
      const oc = world.weather.kind === 'overcast' ? 0.7 : world.weather.rain * 0.8 + world.weather.fog * 0.5;
      let fog = U.mix3(hor, [0.62, 0.66, 0.62], 0.28);
      fog = U.mix3(fog, [0.42, 0.47, 0.44], world.weather.fog * 0.75);
      const nightTint = night ? [0.34, 0.42, 0.62] : U.mix3([0.34, 0.42, 0.62], [1, 1, 1], U.clamp(sun * 2, 0, 1));
      const torch = [1.0, 0.76, 0.46];
      this.fogColor = fog;

      let far = this.renderDist * GF.CHUNK * 1.05;
      const fogFar = far * (world.weather.fog > 0.4 ? 0.42 : (world.weather.rain > 0.3 ? 0.62 : 0.92));
      const fogNear = fogFar * 0.35;

      /* --- 相机矩阵 --- */
      const fovNow = st.fov || this.fov;
      const proj = M4.persp(fovNow, this.aspect, 0.08, far + 40);
      // 每"世界米"在屏幕上的像素数（供粒子点尺寸使用）
      this._pxPerUnit = this.canvas.height / (2 * Math.tan(fovNow * Math.PI / 360));
      const cd = cam.dir;
      const view = M4.lookAt(cam.x, cam.y, cam.z, cam.x + cd[0], cam.y + cd[1], cam.z + cd[2], 0, 1, 0);
      const VP = M4.mul(proj, view);
      this.VP = VP;

      gl.clearColor(fog[0], fog[1], fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* --- 天空 --- */
      {
        const P = this.progSky;
        gl.useProgram(P.p);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        const inv = invert4(VP);
        gl.uniformMatrix4fv(P.u.uInvVP, false, inv);
        gl.uniform3f(P.u.uCam, cam.x, cam.y, cam.z);
        gl.uniform3fv(P.u.uZenith, zen);
        gl.uniform3fv(P.u.uHorizon, hor);
        gl.uniform3f(P.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
        const sc = night ? [0.72, 0.78, 0.92] : U.mix3([1.0, 0.62, 0.34], [1.0, 0.96, 0.86], U.clamp(sun, 0, 1));
        gl.uniform3fv(P.u.uSunCol, sc);
        gl.uniform1f(P.u.uSun, sun);
        gl.uniform1f(P.u.uStars, U.clamp(1 - sun * 3.2, 0, 1) * (1 - oc));
        gl.uniform1f(P.u.uOvercast, oc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.enableVertexAttribArray(P.a.aPos);
        gl.vertexAttribPointer(P.a.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
      }

      /* --- 收集可见区块 --- */
      const pcx = Math.floor(cam.x / GF.CHUNK), pcz = Math.floor(cam.z / GF.CHUNK);
      const R = this.renderDist;
      const visible = [];
      let meshed = 0;
      const meshT0 = performance.now();
      const cands = [];
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 0.5) * (R + 0.5)) continue;
        cands.push([dx, dz, d2]);
      }
      cands.sort((a, b) => a[2] - b[2]);            // 近处优先网格化
      for (const [dx, dz, d2] of cands) {
        const c = world.getChunk(pcx + dx, pcz + dz);
        if (!c) { world.ensureChunk(pcx + dx, pcz + dz, d2); continue; }
        if (!c.ready) continue;
        if ((c.meshDirty || !c.mesh) && meshed < this.meshBudget && performance.now() - meshT0 < this.meshMs) {
          world.buildMesh(c); this.uploadChunk(c); meshed++;
        }
        if (!c.mesh) continue;
        // 视锥粗剔除：区块中心方向
        const cx0 = c.cx * GF.CHUNK + 8, cz0 = c.cz * GF.CHUNK + 8;
        const vx = cx0 - cam.x, vz = cz0 - cam.z;
        const dist = Math.hypot(vx, vz);
        if (dist > 24) {
          const dot = (vx * cd[0] + vz * cd[2]) / (dist || 1);
          if (dot < -0.42) continue;
        }
        visible.push({ c, d: d2 });
      }
      visible.sort((a, b) => a.d - b.d);

      /* --- 地形（不透明） --- */
      const P = this.progTerrain;
      gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(P.u.uAtlas, 0);
      gl.uniformMatrix4fv(P.u.uVP, false, VP);
      gl.uniform3f(P.u.uCam, cam.x, cam.y, cam.z);
      gl.uniform1f(P.u.uSun, Math.max(0.06, sun));
      gl.uniform3fv(P.u.uFog, fog);
      gl.uniform3fv(P.u.uNightTint, nightTint);
      gl.uniform3fv(P.u.uTorch, torch);
      gl.uniform1f(P.u.uFogNear, fogNear);
      gl.uniform1f(P.u.uFogFar, fogFar);
      gl.uniform1f(P.u.uTime, st.elapsed);
      gl.uniform1f(P.u.uOpacity, 1);
      gl.uniform1i(P.u.uWave, 0);
      gl.uniform1f(P.u.uAlphaTest, 0.5);
      gl.uniform1f(P.u.uHandLight, st.handLight || 0);
      gl.enable(gl.CULL_FACE);
      let tris = 0;
      for (const v of visible) {
        const m = v.c.mesh.opaque; if (!m) continue;
        this._bindTerrain(m); gl.drawArrays(gl.TRIANGLES, 0, m.count); tris += m.count / 3;
      }
      /* --- 植被 / 玻璃 / 格栅（alpha 测试 + 混合，双面） --- */
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(P.u.uAlphaTest, 0.06);
      for (const v of visible) {
        const m = v.c.mesh.alpha; if (!m) continue;
        this._bindTerrain(m); gl.drawArrays(gl.TRIANGLES, 0, m.count); tris += m.count / 3;
      }
      gl.disable(gl.BLEND);
      gl.uniform1f(P.u.uAlphaTest, 0.5);
      this.tris = tris;

      /* --- 实体 --- */
      this._drawEntities(st, VP, cam, fog, fogNear, fogFar, sun);

      /* --- 水（半透明，最后） --- */
      gl.useProgram(P.p);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(P.u.uWave, 1);
      gl.uniform1f(P.u.uAlphaTest, 0.02);
      gl.uniform1f(P.u.uOpacity, 0.78);
      gl.depthMask(false);
      for (const v of visible) {
        const m = v.c.mesh.water; if (!m) continue;
        this._bindTerrain(m); gl.drawArrays(gl.TRIANGLES, 0, m.count);
      }
      gl.depthMask(true);
      gl.uniform1i(P.u.uWave, 0);
      gl.uniform1f(P.u.uOpacity, 1);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);

      /* --- 选中框 --- */
      if (st.target) {
        const L = this.progLine;
        gl.useProgram(L.p);
        gl.uniformMatrix4fv(L.u.uVP, false, VP);
        gl.uniform3f(L.u.uOff, st.target.x, st.target.y, st.target.z);
        gl.uniform4f(L.u.uCol, 0.05, 0.05, 0.05, 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.boxLines);
        gl.enableVertexAttribArray(L.a.aPos);
        gl.vertexAttribPointer(L.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, this.boxCount);
      }

      /* --- 粒子 --- */
      this._drawParticles(st, VP, cam);

      /* --- 手持模型 --- */
      this._drawHeld(st, cam, sun);
      return { tris, chunks: visible.length };
    }

    /* -------------------------------------------------------- 实体绘制 */
    _drawEntities(st, VP, cam, fog, fogNear, fogFar, sun) {
      const gl = this.gl, P = this.progModel;
      if (!st.entities || !st.entities.length) return;
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, VP);
      gl.uniform3f(P.u.uCam, cam.x, cam.y, cam.z);
      gl.uniform3fv(P.u.uFog, fog);
      gl.uniform1f(P.u.uFogNear, fogNear);
      gl.uniform1f(P.u.uFogFar, fogFar);
      gl.uniform1i(P.u.uAtlas, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      const A = P.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cube.pos); gl.enableVertexAttribArray(A.aPos); gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cube.nor); gl.enableVertexAttribArray(A.aNor); gl.vertexAttribPointer(A.aNor, 3, gl.FLOAT, false, 0, 0);

      const uvArr = this.cube.uvArr;
      const tmp = new Float32Array(uvArr.length);
      let transparentQueue = [];

      for (const e of st.entities) {
        const model = MODELS[e.model] || MODELS.zombie;
        const dist = Math.hypot(e.x - cam.x, e.z - cam.z);
        if (dist > this.renderDist * GF.CHUNK) continue;
        const light = e.light != null ? e.light : U.clamp(sun * 0.9 + 0.18, 0.15, 1);
        if (e.model === 'spore') { transparentQueue.push(e); continue; }
        const bob = e.moving ? Math.sin(st.elapsed * 7 + e.id * 1.3) * 0.045 : 0;
        for (const bx of model.boxes) {
          const uv = GF.Atlas.uvOf(bx[6]);
          for (let i = 0; i < uvArr.length; i += 2) {
            tmp[i] = uv[0] + uvArr[i] * uv[2];
            tmp[i + 1] = uv[1] + uvArr[i + 1] * uv[3];
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeUVBufDyn);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, tmp);
          gl.enableVertexAttribArray(A.aUV); gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, 0, 0);
          const s = e.scale || 1;
          const m = M4.mul(
            M4.trs(e.x, e.y + bob, e.z, e.yaw || 0, s, s, s),
            M4.trs(bx[0], bx[1], bx[2], 0, bx[3], bx[4], bx[5]));
          gl.uniformMatrix4fv(P.u.uModel, false, m);
          gl.uniform3f(P.u.uTint, e.tint ? e.tint[0] : 1, e.tint ? e.tint[1] : 1, e.tint ? e.tint[2] : 1);
          gl.uniform1f(P.u.uLight, light);
          gl.uniform1f(P.u.uAlpha, 1);
          gl.drawArrays(gl.TRIANGLES, 0, this.cube.count);
        }
      }
      // 孢子云（半透明）
      if (transparentQueue.length) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        for (const e of transparentQueue) {
          const uv = GF.Atlas.uvOf('spore_cloud');
          for (let i = 0; i < uvArr.length; i += 2) { tmp[i] = uv[0] + uvArr[i] * uv[2]; tmp[i + 1] = uv[1] + uvArr[i + 1] * uv[3]; }
          gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeUVBufDyn);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, tmp);
          gl.enableVertexAttribArray(A.aUV); gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, 0, 0);
          const s = (e.scale || 1) * (1 + Math.sin(st.elapsed * 0.7 + e.id) * 0.06);
          gl.uniformMatrix4fv(P.u.uModel, false, M4.trs(e.x - 0.9 * s, e.y, e.z - 0.9 * s, 0, 1.8 * s, 1.8 * s, 1.8 * s));
          gl.uniform3f(P.u.uTint, 0.7, 1.0, 0.45);
          gl.uniform1f(P.u.uLight, 1);
          gl.uniform1f(P.u.uAlpha, 0.5);
          gl.drawArrays(gl.TRIANGLES, 0, this.cube.count);
        }
        gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
      }
    }

    /* -------------------------------------------------------- 粒子绘制 */
    _drawParticles(st, VP, cam) {
      const list = st.particles;
      if (!list || !list.length) return;
      const gl = this.gl, P = this.progPart;
      const n = Math.min(list.length, this.partCap);
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = list[i];
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b; col[i * 4 + 3] = p.a;
        size[i] = p.size;
      }
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, VP);
      gl.uniform3f(P.u.uCam, cam.x, cam.y, cam.z);
      gl.uniform1f(P.u.uScale, this._pxPerUnit || (this.canvas.height * 0.7));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf.pos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf.col); gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.a.aCol); gl.vertexAttribPointer(P.a.aCol, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf.size); gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.a.aSize); gl.vertexAttribPointer(P.a.aSize, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.disable(gl.BLEND);
    }

    /* ------------------------------------------------------ 手持模型 */
    _drawHeld(st, cam, sun) {
      const held = st.held;
      if (!held) return;
      const gl = this.gl, P = this.progModel;
      // 用固定的"视图空间"矩阵：相机永远在原点看 -Z
      const proj = M4.persp(58, this.aspect, 0.02, 6);
      const swing = st.swing || 0;
      const sw = Math.sin(swing * Math.PI) ;
      const bobx = (st.bob || 0) * 0.02;
      const px = 0.42 - sw * 0.16, py = -0.42 + bobx - sw * 0.10, pz = -0.72 + sw * 0.18;
      const yaw = -0.42 + sw * 0.7;
      const s = held.blockTex ? 0.30 : 0.26;
      const model = M4.trs(px, py, pz, yaw, s, s, s * (held.blockTex ? 1 : 0.28));
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, proj);
      gl.uniform3f(P.u.uCam, 0, 0, 0);
      gl.uniform3fv(P.u.uFog, this.fogColor || [0.6, 0.65, 0.6]);
      gl.uniform1f(P.u.uFogNear, 40); gl.uniform1f(P.u.uFogFar, 60);
      gl.uniform1i(P.u.uAtlas, 0);
      const uv = GF.Atlas.uvOf(held.blockTex || 'white');
      const uvArr = this.cube.uvArr, tmp = new Float32Array(uvArr.length);
      for (let i = 0; i < uvArr.length; i += 2) { tmp[i] = uv[0] + uvArr[i] * uv[2]; tmp[i + 1] = uv[1] + uvArr[i + 1] * uv[3]; }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cube.pos); gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cube.nor); gl.enableVertexAttribArray(P.a.aNor); gl.vertexAttribPointer(P.a.aNor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeUVBufDyn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, tmp);
      gl.enableVertexAttribArray(P.a.aUV); gl.vertexAttribPointer(P.a.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(P.u.uModel, false, model);
      const tint = held.tint || [1, 1, 1];
      gl.uniform3f(P.u.uTint, tint[0], tint[1], tint[2]);
      gl.uniform1f(P.u.uLight, U.clamp(sun * 0.8 + 0.3 + (st.handLight || 0), 0.25, 1.4));
      gl.uniform1f(P.u.uAlpha, 1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, this.cube.count);
    }
  }

  /* ---------------------------------------------------- 4x4 逆矩阵 */
  function invert4(m) {
    const inv = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.ident();
    det = 1 / det;
    inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return inv;
  }

  GF.Renderer = Renderer;
  GF.MODELS = MODELS;
})(globalThis.GF = globalThis.GF || {});
