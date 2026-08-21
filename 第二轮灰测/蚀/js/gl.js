/* ===================================================================
   gl.js — WebGL 底层：着色器 / 网格 / 动态批次 / 像素化色调分级
   真 3D 渲染，但把画布后备缓冲压到低分辨率并用 CSS 最近邻放大，
   再在片元着色器里做「去饱和 + 提红 + 暗角 + 有序抖动量化」，
   得到剑风传奇式的粗颗粒暗黑像素观感。
   顶点格式（10 float / 顶点）: pos(3) uv(2) color(3) light(1) emis(1)
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4;

  const VSTRIDE = 10;                       // float / vertex
  const MAXL = 6;                           // 动态点光源数量

  /* --------------------------- 顶点构建器 --------------------------- */
  class MeshB {
    constructor(capVerts) {
      this.cap = capVerts || 4096;
      this.buf = new Float32Array(this.cap * VSTRIDE);
      this.n = 0;                            // 顶点数
    }
    reset() { this.n = 0; return this; }
    ensure(extra) {
      if ((this.n + extra) * VSTRIDE <= this.buf.length) return true;
      let cap = this.cap;
      while ((this.n + extra) > cap) cap = (cap * 2) | 0;
      if (cap > 2200000) return false;        // 安全上限
      const nb = new Float32Array(cap * VSTRIDE);
      nb.set(this.buf.subarray(0, this.n * VSTRIDE));
      this.buf = nb; this.cap = cap;
      return true;
    }
    v(x, y, z, u, vv, r, g, b, l, e) {
      const a = this.buf, i = this.n * VSTRIDE;
      a[i] = x; a[i + 1] = y; a[i + 2] = z;
      a[i + 3] = u; a[i + 4] = vv;
      a[i + 5] = r; a[i + 6] = g; a[i + 7] = b;
      a[i + 8] = l; a[i + 9] = e || 0;
      this.n++;
    }
    // 四边形（p0->p1->p2->p3 逆时针面向观察者），t = 图集矩形
    quad(p0, p1, p2, p3, t, c, l, e) {
      if (!this.ensure(6)) return;
      const r = c[0], g = c[1], b = c[2];
      const u0 = t[0], v0 = t[1], u1 = t[2], v1 = t[3];
      this.v(p0[0], p0[1], p0[2], u0, v1, r, g, b, l, e);
      this.v(p1[0], p1[1], p1[2], u1, v1, r, g, b, l, e);
      this.v(p2[0], p2[1], p2[2], u1, v0, r, g, b, l, e);
      this.v(p0[0], p0[1], p0[2], u0, v1, r, g, b, l, e);
      this.v(p2[0], p2[1], p2[2], u1, v0, r, g, b, l, e);
      this.v(p3[0], p3[1], p3[2], u0, v0, r, g, b, l, e);
    }
    // 直接写 4 个角（数组形式，省去临时对象）
    quadRaw(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, t, r, g, b, l, e) {
      if (!this.ensure(6)) return;
      const u0 = t[0], v0 = t[1], u1 = t[2], v1 = t[3];
      this.v(ax, ay, az, u0, v1, r, g, b, l, e);
      this.v(bx, by, bz, u1, v1, r, g, b, l, e);
      this.v(cx, cy, cz, u1, v0, r, g, b, l, e);
      this.v(ax, ay, az, u0, v1, r, g, b, l, e);
      this.v(cx, cy, cz, u1, v0, r, g, b, l, e);
      this.v(dx, dy, dz, u0, v0, r, g, b, l, e);
    }
    /* 轴对齐盒子。cx,cy,cz = 中心；hx,hy,hz = 半尺寸
       mask: 位掩码 1=+X 2=-X 4=+Y 8=-Y 16=+Z 32=-Z（默认全开）
       体素式面着色，让 3D 立体感清晰 */
    box(cx, cy, cz, hx, hy, hz, t, c, l, e, mask) {
      mask = (mask === undefined) ? 63 : mask;
      const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
      const r = c[0], g = c[1], b = c[2];
      const S = MeshB.SHADE;
      if (mask & 4)  this.quadRaw(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, t, r * S[0], g * S[0], b * S[0], l, e); // top
      if (mask & 8)  this.quadRaw(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, t, r * S[1], g * S[1], b * S[1], l, e); // bottom
      if (mask & 16) this.quadRaw(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, t, r * S[2], g * S[2], b * S[2], l, e); // +Z
      if (mask & 32) this.quadRaw(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, t, r * S[3], g * S[3], b * S[3], l, e); // -Z
      if (mask & 1)  this.quadRaw(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, t, r * S[4], g * S[4], b * S[4], l, e); // +X
      if (mask & 2)  this.quadRaw(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, t, r * S[5], g * S[5], b * S[5], l, e); // -X
    }
    /* 经矩阵变换的盒子（体素肢块 / 剑身），m = mat4，盒子在局部空间以 (ox,oy,oz) 为中心 */
    boxM(m, ox, oy, oz, hx, hy, hz, t, c, l, e) {
      const P = MeshB._tmp;
      let k = 0;
      for (let iz = -1; iz <= 1; iz += 2)
        for (let iy = -1; iy <= 1; iy += 2)
          for (let ix = -1; ix <= 1; ix += 2) {
            const x = ox + ix * hx, y = oy + iy * hy, z = oz + iz * hz;
            P[k++] = m[0] * x + m[4] * y + m[8] * z + m[12];
            P[k++] = m[1] * x + m[5] * y + m[9] * z + m[13];
            P[k++] = m[2] * x + m[6] * y + m[10] * z + m[14];
          }
      // 角点索引：ix 最快，然后 iy，然后 iz
      // 0:(-,-,-) 1:(+,-,-) 2:(-,+,-) 3:(+,+,-) 4:(-,-,+) 5:(+,-,+) 6:(-,+,+) 7:(+,+,+)
      const g = (i, o) => P[i * 3 + o];
      const r = c[0], gg = c[1], b = c[2], S = MeshB.SHADE;
      const face = (a, bb, cc, d, sh) => {
        this.quadRaw(g(a, 0), g(a, 1), g(a, 2), g(bb, 0), g(bb, 1), g(bb, 2),
          g(cc, 0), g(cc, 1), g(cc, 2), g(d, 0), g(d, 1), g(d, 2),
          t, r * sh, gg * sh, b * sh, l, e);
      };
      face(6, 7, 3, 2, S[0]);   // +Y
      face(0, 1, 5, 4, S[1]);   // -Y
      face(4, 5, 7, 6, S[2]);   // +Z
      face(1, 0, 2, 3, S[3]);   // -Z
      face(5, 1, 3, 7, S[4]);   // +X
      face(0, 4, 6, 2, S[5]);   // -X
    }
    // 面向摄像机的公告板（血雾 / 火焰 / 光点）
    billboard(x, y, z, w, h, rx, ry, rz, ux, uy, uz, t, c, l, e) {
      const hw = w * 0.5, hh = h * 0.5;
      const ax = x - rx * hw - ux * hh, ay = y - ry * hw - uy * hh, az = z - rz * hw - uz * hh;
      const bx = x + rx * hw - ux * hh, by = y + ry * hw - uy * hh, bz = z + rz * hw - uz * hh;
      const cx2 = x + rx * hw + ux * hh, cy2 = y + ry * hw + uy * hh, cz2 = z + rz * hw + uz * hh;
      const dx = x - rx * hw + ux * hh, dy = y - ry * hw + uy * hh, dz = z - rz * hw + uz * hh;
      this.quadRaw(ax, ay, az, bx, by, bz, cx2, cy2, cz2, dx, dy, dz, t, c[0], c[1], c[2], l, e);
    }
    // 地面贴花（水平四边形，带朝向角）。绕序保证法线朝 +Y
    decal(x, y, z, sz, ang, t, c, l, e) {
      const ca = Math.cos(ang) * sz * 0.5, sa = Math.sin(ang) * sz * 0.5;
      const ax = x - ca + sa, az = z - sa - ca;
      const bx = x + ca + sa, bz = z + sa - ca;
      const cx = x + ca - sa, cz = z + sa + ca;
      const dx = x - ca - sa, dz = z - sa + ca;
      this.quadRaw(ax, y, az, dx, y, dz, cx, y, cz, bx, y, bz, t, c[0], c[1], c[2], l, e);
    }
    data() { return this.buf.subarray(0, this.n * VSTRIDE); }
  }
  MeshB.SHADE = [1.16, 0.50, 0.80, 0.66, 0.94, 0.86];   // 上 下 +Z -Z +X -X
  MeshB._tmp = new Float32Array(24);
  G.MeshB = MeshB;

  /* --------------------------- 着色器 --------------------------- */
  const VS = `
  attribute vec3 aPos;
  attribute vec2 aUV;
  attribute vec3 aCol;
  attribute float aLight;
  attribute float aEmis;
  uniform mat4 uVP;
  uniform mat4 uModel;
  varying vec2 vUV;
  varying vec3 vCol;
  varying float vLight;
  varying float vEmis;
  varying vec3 vW;
  void main(){
    vec4 wp = uModel * vec4(aPos,1.0);
    vW = wp.xyz;
    vUV = aUV; vCol = aCol; vLight = aLight; vEmis = aEmis;
    gl_Position = uVP * wp;
  }`;

  const FS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec3  uCam;
  uniform vec3  uFogCol;
  uniform float uFogDen;
  uniform vec3  uTint;
  uniform vec3  uAdd;
  uniform float uAlpha;
  uniform float uTorch;
  uniform float uTorchK;
  uniform float uAmbient;
  uniform vec3  uLPos[${MAXL}];
  uniform vec4  uLCol[${MAXL}];
  uniform vec3  uGrade;      // x=受伤红 y=狂气 z=曝光
  uniform vec2  uRes;
  uniform vec2  uDitherUV;   // 图集内 4x4 Bayer 图块左上角
  uniform vec2  uTexel;
  uniform float uDither;
  varying vec2 vUV;
  varying vec3 vCol;
  varying float vLight;
  varying float vEmis;
  varying vec3 vW;
  void main(){
    vec4 tx = texture2D(uTex, vUV);
    if (tx.a < 0.04) discard;
    vec3 base = tx.rgb * vCol * uTint;
    float d = distance(vW, uCam);

    // 手持火把（跟随摄像机）+ 静态烘焙光
    float lit = uAmbient * vLight + uTorch / (1.0 + d * d * uTorchK);
    vec3 lightSum = vec3(lit);
    for (int i = 0; i < ${MAXL}; i++) {
      vec3 dl = uLPos[i] - vW;
      float dd = dot(dl, dl);
      lightSum += uLCol[i].rgb * (uLCol[i].w / (1.0 + dd * 2.6));
    }
    vec3 c = base * lightSum + uAdd;
    c = mix(c, base * 1.35 + uAdd, clamp(vEmis, 0.0, 1.0));

    // 雾 → 纯黑，制造 Doom 式深渊
    float fog = 1.0 - exp(-d * uFogDen);
    c = mix(c, uFogCol, fog * (1.0 - clamp(vEmis,0.0,1.0) * 0.75));

    // 色调分级：低饱和 + 提红压蓝
    float lum = dot(c, vec3(0.299,0.587,0.114));
    c = mix(vec3(lum), c, 0.80);
    c.r *= 1.08; c.b *= 0.93;
    c = mix(c, vec3(0.42,0.02,0.01), uGrade.x * 0.55);
    c += vec3(0.20,0.01,0.0) * uGrade.y;
    c *= uGrade.z;

    // 暗角
    vec2 sp = gl_FragCoord.xy / uRes - 0.5;
    c *= 1.0 - dot(sp,sp) * 0.62;

    // 有序抖动 + 量化 → 复古色带
    if (uDither > 0.5) {
      vec2 dUV = uDitherUV + mod(gl_FragCoord.xy, 4.0) * uTexel;
      float bay = texture2D(uTex, dUV).r - 0.5;
      float q = 22.0;
      c = floor(c * q + bay * 1.15 + 0.5) / q;
    }
    gl_FragColor = vec4(max(c, vec3(0.0)), tx.a * uAlpha);
  }`;

  /* --------------------------- 主对象 --------------------------- */
  const GL = {
    gl: null, canvas: null,
    W: 480, H: 270,
    pixelScale: 3,
    prog: null,
    loc: {},
    tex: null,
    _model: M4.create(),
    _lp: new Float32Array(MAXL * 3),
    _lc: new Float32Array(MAXL * 4),
    _stat: { draws: 0, verts: 0 },
    ok: false,
  };

  GL.init = function (canvas) {
    GL.canvas = canvas;
    const opts = {
      alpha: false, antialias: false, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false,
    };
    const gl = GL.gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;

    const prog = GL.prog = mkProgram(gl, VS, FS);
    if (!prog) return false;
    gl.useProgram(prog);

    const L = GL.loc = {};
    ['aPos', 'aUV', 'aCol', 'aLight', 'aEmis'].forEach(n => L[n] = gl.getAttribLocation(prog, n));
    ['uVP', 'uModel', 'uTex', 'uCam', 'uFogCol', 'uFogDen', 'uTint', 'uAdd', 'uAlpha',
      'uTorch', 'uTorchK', 'uAmbient', 'uLPos', 'uLCol', 'uGrade', 'uRes', 'uDitherUV',
      'uTexel', 'uDither'].forEach(n => L[n] = gl.getUniformLocation(prog, n));

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0, 0, 0, 1);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniform1i(L.uTex, 0);
    gl.uniform1f(L.uAlpha, 1);
    gl.uniform1f(L.uDither, 1);
    gl.uniform3f(L.uTint, 1, 1, 1);
    gl.uniform3f(L.uAdd, 0, 0, 0);
    gl.uniform3f(L.uGrade, 0, 0, 1);
    gl.uniform1f(L.uAmbient, 1);
    gl.uniform1f(L.uTorch, 1.15);
    gl.uniform1f(L.uTorchK, 0.055);
    gl.uniform3f(L.uFogCol, 0, 0, 0);
    gl.uniform1f(L.uFogDen, 0.085);
    M4.identity(GL._model);
    gl.uniformMatrix4fv(L.uModel, false, GL._model);

    // 动态批次缓冲
    GL._dynBuf = gl.createBuffer();
    GL._dynCap = 0;
    GL.ok = true;
    GL.resize();
    return true;
  };

  function mkProgram(gl, vs, fs) {
    const v = mkShader(gl, gl.VERTEX_SHADER, vs);
    const f = mkShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[GL] link failed:', gl.getProgramInfoLog(p)); return null;
    }
    return p;
  }
  function mkShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[GL] shader error:', gl.getShaderInfoLog(s), src);
      return null;
    }
    return s;
  }

  /* --------------------------- 尺寸 / 像素化 --------------------------- */
  GL.setPixelScale = function (s) { GL.pixelScale = U.clamp(s | 0, 1, 6); GL.resize(); };

  GL.resize = function () {
    if (!GL.gl) return;
    const c = GL.canvas;
    const cssW = c.clientWidth || window.innerWidth;
    const cssH = c.clientHeight || window.innerHeight;
    const dpr = 1;                                // 故意不跟随 DPR：我们要像素块
    let w = Math.max(120, Math.round(cssW * dpr / GL.pixelScale));
    let h = Math.max(80, Math.round(cssH * dpr / GL.pixelScale));
    w = Math.min(w, 1920); h = Math.min(h, 1080);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    GL.W = w; GL.H = h;
    GL.gl.viewport(0, 0, w, h);
    GL.gl.uniform2f(GL.loc.uRes, w, h);
  };
  GL.aspect = function () { return GL.W / GL.H; };

  /* --------------------------- 纹理 --------------------------- */
  GL.uploadAtlas = function (canvas) {
    const gl = GL.gl;
    if (!GL.tex) GL.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(GL.loc.uTexel, 1 / canvas.width, 1 / canvas.height);
  };
  GL.setDitherTile = function (u, v) { GL.gl.uniform2f(GL.loc.uDitherUV, u, v); };

  /* --------------------------- 帧 --------------------------- */
  GL.beginFrame = function (fogCol) {
    const gl = GL.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(fogCol ? fogCol[0] : 0, fogCol ? fogCol[1] : 0, fogCol ? fogCol[2] : 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    GL._stat.draws = 0; GL._stat.verts = 0;
    GL.setAlpha(1); GL.setTint(1, 1, 1); GL.setAdd(0, 0, 0);
  };

  GL.setCamera = function (vp, cx, cy, cz) {
    const gl = GL.gl, L = GL.loc;
    gl.uniformMatrix4fv(L.uVP, false, vp);
    gl.uniform3f(L.uCam, cx, cy, cz);
  };
  GL.setFog = function (col, den) {
    GL.gl.uniform3f(GL.loc.uFogCol, col[0], col[1], col[2]);
    GL.gl.uniform1f(GL.loc.uFogDen, den);
  };
  GL.setTorch = function (intensity, falloff, ambient) {
    const L = GL.loc, gl = GL.gl;
    gl.uniform1f(L.uTorch, intensity);
    gl.uniform1f(L.uTorchK, falloff);
    gl.uniform1f(L.uAmbient, ambient);
  };
  GL.setGrade = function (dmg, berserk, exposure) { GL.gl.uniform3f(GL.loc.uGrade, dmg, berserk, exposure); };
  GL.setDither = function (on) { GL.gl.uniform1f(GL.loc.uDither, on ? 1 : 0); };
  GL.setAlpha = function (a) { GL.gl.uniform1f(GL.loc.uAlpha, a); };
  GL.setTint = function (r, g, b) { GL.gl.uniform3f(GL.loc.uTint, r, g, b); };
  GL.setAdd = function (r, g, b) { GL.gl.uniform3f(GL.loc.uAdd, r, g, b); };
  GL.setModel = function (m) { GL.gl.uniformMatrix4fv(GL.loc.uModel, false, m || M4.identity(GL._model)); };
  GL.identity = function () { GL.gl.uniformMatrix4fv(GL.loc.uModel, false, M4.identity(GL._model)); };

  // lights: [{x,y,z,r,g,b,i}]  取前 MAXL 个
  GL.setLights = function (lights) {
    const lp = GL._lp, lc = GL._lc;
    for (let i = 0; i < MAXL; i++) {
      const l = lights && lights[i];
      if (l) {
        lp[i * 3] = l.x; lp[i * 3 + 1] = l.y; lp[i * 3 + 2] = l.z;
        lc[i * 4] = l.r; lc[i * 4 + 1] = l.g; lc[i * 4 + 2] = l.b; lc[i * 4 + 3] = l.i;
      } else {
        lp[i * 3] = 0; lp[i * 3 + 1] = -999; lp[i * 3 + 2] = 0;
        lc[i * 4] = 0; lc[i * 4 + 1] = 0; lc[i * 4 + 2] = 0; lc[i * 4 + 3] = 0;
      }
    }
    GL.gl.uniform3fv(GL.loc.uLPos, lp);
    GL.gl.uniform4fv(GL.loc.uLCol, lc);
  };
  GL.MAXL = MAXL;

  GL.blend = function (on, additive) {
    const gl = GL.gl;
    if (on) {
      gl.enable(gl.BLEND);
      if (additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else gl.disable(gl.BLEND);
  };
  GL.depthWrite = function (on) { GL.gl.depthMask(!!on); };
  GL.depthTest = function (on) { const gl = GL.gl; if (on) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST); };
  GL.cull = function (on) { const gl = GL.gl; if (on) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE); };

  /* --------------------------- 静态网格 --------------------------- */
  GL.mesh = function (dataOrBuilder) {
    const gl = GL.gl;
    const data = (dataOrBuilder instanceof MeshB) ? dataOrBuilder.data() : dataOrBuilder;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { vbo: vbo, count: (data.length / VSTRIDE) | 0 };
  };
  GL.free = function (mesh) { if (mesh && mesh.vbo) { GL.gl.deleteBuffer(mesh.vbo); mesh.vbo = null; mesh.count = 0; } };

  function bindAttribs(gl, L) {
    const S = VSTRIDE * 4;
    gl.enableVertexAttribArray(L.aPos); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(L.aUV); gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(L.aCol); gl.vertexAttribPointer(L.aCol, 3, gl.FLOAT, false, S, 20);
    gl.enableVertexAttribArray(L.aLight); gl.vertexAttribPointer(L.aLight, 1, gl.FLOAT, false, S, 32);
    gl.enableVertexAttribArray(L.aEmis); gl.vertexAttribPointer(L.aEmis, 1, gl.FLOAT, false, S, 36);
  }

  GL.draw = function (mesh, model) {
    if (!mesh || !mesh.count) return;
    const gl = GL.gl, L = GL.loc;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    bindAttribs(gl, L);
    GL.setModel(model);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    GL._stat.draws++; GL._stat.verts += mesh.count;
  };

  /* --------------------------- 动态批次 --------------------------- */
  // 每帧构建的几何（尸块、血雾、剑光、贴花…）直接以世界坐标提交
  GL.drawDynamic = function (builder, model) {
    if (!builder || !builder.n) return;
    const gl = GL.gl, L = GL.loc;
    const data = builder.data();
    gl.bindBuffer(gl.ARRAY_BUFFER, GL._dynBuf);
    if (data.length > GL._dynCap) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      GL._dynCap = data.length;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    bindAttribs(gl, L);
    GL.setModel(model);
    gl.drawArrays(gl.TRIANGLES, 0, builder.n);
    GL._stat.draws++; GL._stat.verts += builder.n;
  };

  GL.stats = function () { return GL._stat; };
  GL.VSTRIDE = VSTRIDE;
  G.GL = GL;
})();
