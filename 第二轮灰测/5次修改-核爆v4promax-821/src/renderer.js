/* =========================================================================
 * renderer.js — WebGL2 多通道渲染器
 *
 * 通道顺序：
 *   sceneFBO(RGBA16F + DEPTH24) ← 天空 → 地面 → 建筑
 *   blit 深度到 depthCopy（软粒子要采样深度，不能读正在写的附件）
 *   → 激波壳(加性) → 凝结云(alpha) → 粒子(按视深排序, 预乘 alpha)
 *   → 激波屏幕空间折射 → 亮度提取 → 两级高斯泛光 → ACES 合成到画布
 *
 * 曝光是物理量驱动的：火球辐射功率 P=4πR²σT⁴ 换算成相机处的照度
 * （以「太阳常数」为单位），再模拟视网膜/胶片的非对称适应。
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE = root.NUKE || {};
  var U = NK.util, P = NK.physics;
  var M4 = U.mat4;

  var STRIDE = 12;                 // sim 粒子步长
  var IX = 0, IY = 1, IZ = 2, IT = 6, IAGE = 7, ILIFE = 8, ISIZE = 9, ISEED = 10, IKIND = 11;
  var INST = 12;                   // 粒子实例步长（float）：pos(3)+pad+A(4)+B(4)
  var BSTRIDE = 16;                // 建筑实例步长（float）：4×vec4
  var NBUCKET = 768;

  /* ------------------------------------------------------------ GL 小工具 */
  function compile(gl, type, src, errs, name) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh) || '?';
      errs.push('[' + name + '] ' + log.trim().split('\n').slice(0, 4).join(' | '));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
  function program(gl, vs, fs, errs, name) {
    var v = compile(gl, gl.VERTEX_SHADER, vs, errs, name + '.vs');
    var f = compile(gl, gl.FRAGMENT_SHADER, fs, errs, name + '.fs');
    if (!v || !f) { return null; }
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      errs.push('[' + name + '.link] ' + (gl.getProgramInfoLog(p) || '?'));
      return null;
    }
    var obj = { p: p, loc: {} };
    obj.u = function (n) {
      if (!(n in obj.loc)) { obj.loc[n] = gl.getUniformLocation(p, n); }
      return obj.loc[n];
    };
    return obj;
  }

  /* ------------------------------------------------------------ 网格 */
  function makeSphere(rings, sectors) {
    var pos = [], idx = [];
    for (var i = 0; i <= rings; i++) {
      var v = i / rings, th = v * Math.PI;
      for (var j = 0; j <= sectors; j++) {
        var u = j / sectors, ph = u * Math.PI * 2;
        pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      }
    }
    for (i = 0; i < rings; i++) {
      for (j = 0; j < sectors; j++) {
        var a = i * (sectors + 1) + j, b = a + sectors + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }

  function makeBox() {
    // 单位盒：x,z ∈ [-0.5,0.5]，y ∈ [0,1]
    var f = [
      [[0, 0, 1], [[-.5, 0, .5], [.5, 0, .5], [.5, 1, .5], [-.5, 1, .5]]],
      [[0, 0, -1], [[.5, 0, -.5], [-.5, 0, -.5], [-.5, 1, -.5], [.5, 1, -.5]]],
      [[1, 0, 0], [[.5, 0, .5], [.5, 0, -.5], [.5, 1, -.5], [.5, 1, .5]]],
      [[-1, 0, 0], [[-.5, 0, -.5], [-.5, 0, .5], [-.5, 1, .5], [-.5, 1, -.5]]],
      [[0, 1, 0], [[-.5, 1, .5], [.5, 1, .5], [.5, 1, -.5], [-.5, 1, -.5]]],
      [[0, -1, 0], [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5]]]
    ];
    var pos = [], nrm = [], idx = [], n = 0;
    for (var i = 0; i < f.length; i++) {
      var N = f[i][0], q = f[i][1];
      for (var k = 0; k < 4; k++) { pos.push(q[k][0], q[k][1], q[k][2]); nrm.push(N[0], N[1], N[2]); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  function makeGroundDisc(r0, r1, rings, sectors, seed) {
    var rand = U.rng(seed || 991);
    // 简易 fbm 地形（预计算到顶点，着色器只做法线扰动）
    var lat = 64, hs = new Float32Array(lat * lat);
    for (var i = 0; i < lat * lat; i++) { hs[i] = rand() * 2 - 1; }
    function h2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      function g(a, b) { return hs[(((a % lat) + lat) % lat) + (((b % lat) + lat) % lat) * lat]; }
      var a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
    function terrain(x, z) {
      var r = Math.sqrt(x * x + z * z);
      var amp = 5 + 55 * U.smoothstep(4000, 90000, r);
      var s = h2(x / 900, z / 900) * 0.6 + h2(x / 240, z / 240) * 0.3 + h2(x / 70, z / 70) * 0.1;
      return s * amp;
    }
    var pos = [], idx = [];
    for (i = 0; i <= rings; i++) {
      var t = i / rings;
      var r = r0 * Math.pow(r1 / r0, t);
      for (var j = 0; j <= sectors; j++) {
        var a = j / sectors * Math.PI * 2;
        var x = Math.cos(a) * r, z = Math.sin(a) * r;
        pos.push(x, terrain(x, z), z);
      }
    }
    for (i = 0; i < rings; i++) {
      for (j = 0; j < sectors; j++) {
        var p0 = i * (sectors + 1) + j, p1 = p0 + sectors + 1;
        idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    }
    return {
      pos: new Float32Array(pos),
      idx: (pos.length / 3) > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
      big: (pos.length / 3) > 65535
    };
  }

  /* ------------------------------------------------------------ Renderer */
  var R = NK.Renderer = function (canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.errors = [];
    this.notes = [];
    var gl = this.gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    if (!gl) { this.errors.push('WebGL2 不可用：本效果需要 WebGL2（ES 3.0）'); return; }

    this.extFloat = gl.getExtension('EXT_color_buffer_float');
    this.extHalf = this.extFloat ? null : gl.getExtension('EXT_color_buffer_half_float');
    this.hdrFormat = this.extFloat ? gl.RGBA16F : (this.extHalf ? gl.RGBA16F : gl.RGBA8);
    this.hdr = !!(this.extFloat || this.extHalf);
    this.notes.push('HDR 缓冲: ' + (this.hdr ? 'RGBA16F' : 'RGBA8(无浮点扩展，闪光会截顶)'));
    this.notes.push('GL: ' + gl.getParameter(gl.VERSION) + ' | ' + gl.getParameter(gl.RENDERER));

    var S = NK.shaders, E = this.errors;
    this.pSky = program(gl, S.skyVS, S.skyFS, E, 'sky');
    this.pGround = program(gl, S.groundVS, S.groundFS, E, 'ground');
    this.pBuild = program(gl, S.buildVS, S.buildFS, E, 'build');
    this.pPart = program(gl, S.partVS, S.partFS, E, 'part');
    this.pShell = program(gl, S.shellVS, S.shellFS, E, 'shell');
    this.pDistort = program(gl, S.fsQuadVS, S.distortFS, E, 'distort');
    this.pBright = program(gl, S.fsQuadVS, S.brightFS, E, 'bright');
    this.pBlur = program(gl, S.fsQuadVS, S.blurFS, E, 'blur');
    this.pComp = program(gl, S.fsQuadVS, S.compositeFS, E, 'composite');
    this.pBlit = program(gl, S.fsQuadVS, S.blitFS, E, 'blit');

    this._initBuffers();
    this.fbo = {};
    this.resScale = opts.resScale || 1.0;
    this.resize();

    // 曝光状态
    this.exposure = 1;
    this.whiteout = 0;
    this._sortIdx = null;
    this._buckets = new Int32Array(NBUCKET + 1);
    this.stats = { drawn: 0, sortMs: 0, buildings: 0 };
  };

  R.prototype.ok = function () { return !!this.gl && this.errors.length === 0; };

  R.prototype._initBuffers = function () {
    var gl = this.gl;
    // 全屏四边形
    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // 球
    var sp = makeSphere(28, 56);
    this.sphere = { vbo: gl.createBuffer(), ibo: gl.createBuffer(), n: sp.idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, sp.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphere.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sp.idx, gl.STATIC_DRAW);

    // 盒（建筑）
    var bx = makeBox();
    this.box = { vbo: gl.createBuffer(), nbo: gl.createBuffer(), ibo: gl.createBuffer(), n: bx.idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, this.box.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, bx.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.box.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, bx.nrm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.box.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bx.idx, gl.STATIC_DRAW);
    this.buildInst = gl.createBuffer();

    // 粒子四边形角点 + 实例缓冲
    this.cornerVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.partInst = gl.createBuffer();
    this.partData = null;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  };

  R.prototype.setGround = function (radius) {
    var gl = this.gl;
    var g = makeGroundDisc(6, radius || 300000, 78, 128, 4242);
    if (!this.ground) { this.ground = { vbo: gl.createBuffer(), ibo: gl.createBuffer() }; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ground.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ground.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    this.ground.n = g.idx.length;
    this.ground.type = g.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    this.groundRadius = radius;
  };

  /* ------------------------------------------------------------ FBO */
  R.prototype._tex = function (w, h, fmt, filter) {
    var gl = this.gl;
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    var type = gl.UNSIGNED_BYTE, ifmt = gl.RGBA;
    if (fmt === gl.RGBA16F) { type = gl.HALF_FLOAT; ifmt = gl.RGBA; }
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, ifmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  R.prototype._depthTex = function (w, h) {
    var gl = this.gl;
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  R.prototype._fb = function (color, depth) {
    var gl = this.gl;
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    if (color) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0); }
    if (depth) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0); }
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) { this.errors.push('FBO 不完整: 0x' + st.toString(16)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  };

  R.prototype.resize = function () {
    var gl = this.gl, c = this.canvas;
    if (!gl) { return; }
    var dpr = Math.min(root.devicePixelRatio || 1, 1.75) * this.resScale;
    var w = Math.max(2, Math.floor((c.clientWidth || 960) * dpr));
    var h = Math.max(2, Math.floor((c.clientHeight || 540) * dpr));
    if (c.width === w && c.height === h && this.fbo.scene) { return; }
    c.width = w; c.height = h;
    this.W = w; this.H = h;
    var f = this.fbo;
    // 释放旧资源
    ['scene', 'depthCopy', 'b1a', 'b1b', 'b2a', 'b2b', 'dist'].forEach(function (k) {
      if (f[k]) { gl.deleteFramebuffer(f[k]); f[k] = null; }
    });
    ['tScene', 'tDepth', 'tDepthCopy', 'tDist', 't1a', 't1b', 't2a', 't2b'].forEach(function (k) {
      if (f[k]) { gl.deleteTexture(f[k]); f[k] = null; }
    });
    var F = this.hdrFormat;
    f.tScene = this._tex(w, h, F);
    f.tDepth = this._depthTex(w, h);
    f.tDepthCopy = this._depthTex(w, h);
    f.tDist = this._tex(w, h, F);
    var hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    var qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    f.t1a = this._tex(hw, hh, F); f.t1b = this._tex(hw, hh, F);
    f.t2a = this._tex(qw, qh, F); f.t2b = this._tex(qw, qh, F);
    f.scene = this._fb(f.tScene, f.tDepth);
    f.depthCopy = this._fb(null, f.tDepthCopy);
    f.dist = this._fb(f.tDist, null);
    f.b1a = this._fb(f.t1a, null); f.b1b = this._fb(f.t1b, null);
    f.b2a = this._fb(f.t2a, null); f.b2b = this._fb(f.t2b, null);
    f.hw = hw; f.hh = hh; f.qw = qw; f.qh = qh;
  };

  /* ------------------------------------------------------------ 粒子打包 + 深度排序 */
  R.prototype._packParticles = function (sim, view, params) {
    var t0 = (root.performance || Date).now();
    var n = sim.count, d = sim.data, al = sim.alive;
    if (!this.partData || this.partData.length < sim.capacity * INST) {
      this.partData = new Float32Array(sim.capacity * INST);
      this._sortIdx = new Int32Array(sim.capacity);
      this._depth = new Float32Array(sim.capacity);
    }
    var out = this.partData, idxArr = this._sortIdx, dep = this._depth;
    var v2 = view[2], v6 = view[6], v10 = view[10], v14 = view[14];
    // 1) 收集可见粒子的视深
    var m = 0, zmin = 1e30, zmax = -1e30;
    for (var i = 0; i < n; i++) {
      if (!al[i]) { continue; }
      var b = i * STRIDE;
      var z = -(v2 * d[b + IX] + v6 * d[b + IY] + v10 * d[b + IZ] + v14);
      if (z < 0.1) { continue; }                 // 相机背后
      idxArr[m] = i; dep[m] = z;
      if (z < zmin) { zmin = z; }
      if (z > zmax) { zmax = z; }
      m++;
    }
    if (m === 0) { this.stats.drawn = 0; return 0; }
    // 2) 计数排序（按视深从远到近）—— O(n)，足以满足烟雾的 alpha 合成顺序
    var nb = NBUCKET, bk = this._buckets;
    bk.fill(0);
    var span = Math.max(zmax - zmin, 1e-3), inv = (nb - 1) / span;
    var k, bi;
    for (k = 0; k < m; k++) {
      bi = nb - 1 - ((dep[k] - zmin) * inv | 0);   // 远的在前
      if (bi < 0) { bi = 0; } else if (bi >= nb) { bi = nb - 1; }
      bk[bi + 1]++;
    }
    for (k = 0; k < nb; k++) { bk[k + 1] += bk[k]; }
    var order = this._order && this._order.length >= m ? this._order : (this._order = new Int32Array(sim.capacity));
    for (k = 0; k < m; k++) {
      bi = nb - 1 - ((dep[k] - zmin) * inv | 0);
      if (bi < 0) { bi = 0; } else if (bi >= nb) { bi = nb - 1; }
      order[bk[bi]++] = idxArr[k];
    }
    // 3) 填实例缓冲
    var yLow = Math.max(0, sim.cloudBottom || 0);
    var cloudTop = Math.max(sim.cloudTop, sim.Rfb * 2);
    var refSize = 0.20 * Math.max(sim.Rc, sim.Rfb);
    var o = 0;
    var kOpa = [0.95, 0.60, 0.50, 0.46, 0.65, 0.58, 0.80];
    for (k = 0; k < m; k++) {
      var ii = order[k], bb = ii * STRIDE;
      var kind = d[bb + IKIND] | 0;
      var size = d[bb + ISIZE];
      var age = d[bb + IAGE], life = d[bb + ILIFE];
      var opa = kOpa[kind] || 0.5;
      // 生命周期淡入淡出
      if (life < 1e8) {
        opa *= U.smoothstep(0, 0.05 * life, age) * U.smoothstep(life, 0.5 * life, age);
      } else {
        opa *= U.smoothstep(0, 0.4, age + 0.4);
      }
      // 体积膨胀 ⇒ 光学厚度下降（质量守恒的近似）
      opa *= U.clamp(Math.pow(refSize / Math.max(size, 1e-3), 0.85), 0.18, 1.5);
      opa = U.clamp(opa * params.opacity, 0, 1);
      var y = d[bb + IY];
      var shade = U.clamp((y - yLow) / Math.max(cloudTop - yLow, 1), 0, 1);
      shade = 0.25 + 0.75 * shade * shade;
      out[o] = d[bb + IX]; out[o + 1] = y; out[o + 2] = d[bb + IZ]; out[o + 3] = 0;
      out[o + 4] = size * params.sizeScale;
      out[o + 5] = d[bb + IT];
      out[o + 6] = opa;
      out[o + 7] = d[bb + ISEED];
      out[o + 8] = kind;
      out[o + 9] = shade;
      out[o + 10] = 0; out[o + 11] = 0;
      o += INST;
    }
    this.stats.drawn = m;
    this.stats.sortMs = (root.performance || Date).now() - t0;
    return m;
  };

  /* ------------------------------------------------------------ 主渲染 */
  /**
   * @param {Sim} sim
   * @param {object} cam  {pos:[3], target:[3], fov, near, far}
   * @param {object} env  环境与后处理参数
   */
  R.prototype.render = function (sim, cam, env) {
    var gl = this.gl;
    if (!gl || this.errors.length) { return; }
    this.resize();
    var W = this.W, H = this.H, f = this.fbo;

    var view = this._view || (this._view = M4.create());
    var proj = this._proj || (this._proj = M4.create());
    var vp = this._vp || (this._vp = M4.create());
    var invVP = this._invVP || (this._invVP = M4.create());
    M4.lookAt(view, cam.pos, cam.target, [0, 1, 0]);
    M4.perspective(proj, cam.fov, W / H, cam.near, cam.far);
    M4.mul(vp, proj, view);
    M4.invert(invVP, vp);

    var t = sim.t, bl = sim.blast;
    var burst = [0, sim.opts.hob, 0];
    var Rs = bl.radius(t), fbR = bl.fireballR(t);
    var relP = bl.relPower(t);

    /* ---------- 物理曝光：把火球功率折算成相机处照度（单位=太阳常数） ---------- */
    var Pw = bl.power(t);                                   // W
    var dCam = Math.max(Math.sqrt(
      Math.pow(cam.pos[0] - burst[0], 2) + Math.pow(cam.pos[1] - burst[1], 2) +
      Math.pow(cam.pos[2] - burst[2], 2)), 1);
    var flashLight = Pw / (4 * Math.PI) / 1000;              // /r² 后即为「太阳数」
    var illumCam = flashLight / (dCam * dCam) * Math.exp(-dCam / 20000);
    var dayLum = env.night ? 0.02 : 1.0;
    var target = 1.0 / (0.35 * dayLum + illumCam * 0.85 + 0.05);
    // 视网膜/胶片的非对称适应：变亮快、变暗慢。必须用「时间常数」而不是
    // 每帧固定比例 —— 否则适应速度与帧率耦合，且双闪光的极小值之后会留下
    // 一段全黑窗口（曝光仍停在峰值、whiteout 已归零 ⇒ 画面除火球外全黑）。
    var dtE = U.clamp(env.dt || 0.016, 1 / 240, 0.2);
    var tauE = target < this.exposure ? 0.08 : 0.30;
    this.exposure += (target - this.exposure) * (1 - Math.exp(-dtE / tauE));
    // 视网膜/胶片过曝：真实核爆早期确实把画面完全打白，但那样就看不到火球
    // 结构了。这里保留「非常亮」的观感而把上限压到 0.58，让形态仍然可辨。
    this.whiteout = 0.58 * U.smoothstep(8, 900, illumCam);
    var expo = this.exposure * (env.exposureBias || 1);

    var sun = env.sunDir, sunCol = env.sunCol, skyCol = env.skyCol;
    var flashCol = env.flashCol;

    /* ---------- 场景 ---------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.scene);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // 天空
    if (this.pSky && !env.noSky) {
      gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.pSky.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(this.pSky.u('uInvVP'), false, invVP);
      gl.uniform3fv(this.pSky.u('uCamPos'), cam.pos);
      gl.uniform3fv(this.pSky.u('uSunDir'), sun);
      gl.uniform3fv(this.pSky.u('uZenith'), env.zenith);
      gl.uniform3fv(this.pSky.u('uHorizon'), env.horizon);
      gl.uniform3fv(this.pSky.u('uGround'), env.groundCol);
      gl.uniform1f(this.pSky.u('uFlash'), U.clamp(illumCam * 0.30, 0, 400));
      gl.uniform3fv(this.pSky.u('uFlashCol'), flashCol);
      var bdir = [burst[0] - cam.pos[0], burst[1] - cam.pos[1], burst[2] - cam.pos[2]];
      gl.uniform3fv(this.pSky.u('uBurstDir'), bdir);
      gl.uniform1f(this.pSky.u('uNight'), env.night ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    }

    // 地面
    if (this.pGround && this.ground && !env.noGround) {
      var pg = this.pGround;
      gl.useProgram(pg.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ground.vbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ground.ibo);
      gl.uniformMatrix4fv(pg.u('uVP'), false, vp);
      gl.uniform3fv(pg.u('uCamPos'), cam.pos);
      gl.uniform3fv(pg.u('uSunDir'), sun);
      gl.uniform3fv(pg.u('uSunCol'), sunCol);
      gl.uniform3fv(pg.u('uSkyCol'), skyCol);
      gl.uniform3fv(pg.u('uFogCol'), env.fogCol);
      gl.uniform1f(pg.u('uFogDensity'), env.fogDensity);
      gl.uniform3fv(pg.u('uBurst'), burst);
      gl.uniform1f(pg.u('uFlashLight'), flashLight);
      gl.uniform3fv(pg.u('uFlashCol'), flashCol);
      gl.uniform1f(pg.u('uFlashScatter'), env.flashScatter);
      gl.uniform1f(pg.u('uFlashR'), Math.max(fbR, 1));
      gl.uniform1f(pg.u('uThermalA'), env.thermalA);
      gl.uniform1f(pg.u('uThermalLam'), env.visibility);
      gl.uniform1f(pg.u('uCharQ'), P.BURN.ignition);
      gl.uniform1f(pg.u('uCraterR'), sim.craterR);
      gl.uniform1f(pg.u('uCraterD'), sim.craterD);
      gl.uniform1f(pg.u('uShockRg'), sim._groundShockR());
      gl.uniform1f(pg.u('uDustR'), env.dustRingR || 0);
      gl.uniform1f(pg.u('uGrid'), env.gridSize);
      gl.uniform1f(pg.u('uShowGrid'), env.showGrid ? 1 : 0);
      gl.uniform1f(pg.u('uCityR'), env.showCity ? (sim.cityR || 0) : 0);
      gl.uniform1f(pg.u('uCityAng'), sim.cityGridAng || 0);
      gl.uniform1f(pg.u('uCityStep'), sim.cityStep || 120);
      gl.uniform1f(pg.u('uCityStreet'), sim.cityStreet || 24);
      gl.uniform1f(pg.u('uNight'), env.night ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, this.ground.n, this.ground.type, 0);
    }

    // 建筑
    if (this.pBuild && env.showCity && sim.buildings && sim.buildings.length) {
      env.fireballR = fbR;
      this._drawBuildings(sim, vp, cam, env, sun, sunCol, skyCol, flashLight, flashCol, burst);
    }

    /* ---------- 深度拷贝（软粒子采样用） ---------- */
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, f.scene);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f.depthCopy);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.scene);
    gl.viewport(0, 0, W, H);

    /* ---------- 激波壳（加性） ---------- */
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    if (this.pShell && Rs > 1 && Rs < cam.far * 0.85 && env.showShock) {
      var dp = bl.dpBar(Rs);
      var strength = U.clamp(Math.log(1 + dp * 2.2) * 0.28, 0, 2.2) *
        U.smoothstep(cam.far * 0.85, cam.far * 0.35, Rs);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.BLEND);
      this._drawShell(vp, cam, burst, Rs, 0, strength, [0.62, 0.74, 1.0], t, env,
        sim.opts.hob < Rs ? U.clamp(sim.opts.hob / Rs * 0.35 + 0.72, 0.5, 1) : 1);
    }

    /* ---------- 威尔逊凝结云（alpha） ---------- */
    if (this.pShell && env.showWilson) {
      var wc = bl.wilson(t, sim.opts.humidity);
      if (wc.a > 0.01 && wc.r < cam.far * 0.6) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        this._drawShell(vp, cam, burst, wc.r, 1, wc.a * 0.9, [0.94, 0.96, 1.0], t, env, 1);
      }
    }

    /* ---------- 粒子 ---------- */
    var m = env.noParticles ? 0 : this._packParticles(sim, view, env);
    if (this.pPart && m > 0 && !env.noParticles) {
      var pp = this.pPart;
      gl.useProgram(pp.p);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerVBO);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst);
      gl.bufferData(gl.ARRAY_BUFFER, this.partData.subarray(0, m * INST), gl.DYNAMIC_DRAW);
      var st = INST * 4;
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 16);
      gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, st, 32);
      gl.vertexAttribDivisor(3, 1);
      // 视空间太阳方向
      var sv = [
        view[0] * sun[0] + view[4] * sun[1] + view[8] * sun[2],
        view[1] * sun[0] + view[5] * sun[1] + view[9] * sun[2],
        view[2] * sun[0] + view[6] * sun[1] + view[10] * sun[2]
      ];
      gl.uniformMatrix4fv(pp.u('uView'), false, view);
      gl.uniformMatrix4fv(pp.u('uProj'), false, proj);
      gl.uniform3fv(pp.u('uCamPos'), cam.pos);
      gl.uniform3fv(pp.u('uSunDirV'), sv);
      gl.uniform3fv(pp.u('uSunCol'), sunCol);
      gl.uniform3fv(pp.u('uSkyCol'), skyCol);
      gl.uniform3fv(pp.u('uBurst'), burst);
      gl.uniform1f(pp.u('uFlashLight'), flashLight);
      gl.uniform3fv(pp.u('uFlashCol'), flashCol);
      gl.uniform1f(pp.u('uEmissive'), env.emissive);
      gl.uniform1f(pp.u('uFlashR'), Math.max(fbR, 1));
      gl.uniform1f(pp.u('uThermalLam'), env.visibility);
      gl.uniform1f(pp.u('uTime'), t);
      gl.uniform1f(pp.u('uNight'), env.night ? 1 : 0);
      gl.uniform2f(pp.u('uRes'), W, H);
      gl.uniform1f(pp.u('uNear'), cam.near);
      gl.uniform1f(pp.u('uFar'), cam.far);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, f.tDepthCopy);
      gl.uniform1i(pp.u('uDepth'), 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, m);
      gl.vertexAttribDivisor(1, 0); gl.vertexAttribDivisor(2, 0); gl.vertexAttribDivisor(3, 0);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
    }

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    /* ---------- 后处理 ---------- */
    this._post(sim, cam, env, vp, expo, Rs, burst);
  };

  R.prototype._drawShell = function (vp, cam, center, radius, mode, strength, tint, t, env, flatten) {
    var gl = this.gl, ps = this.pShell;
    gl.useProgram(ps.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphere.ibo);
    gl.uniformMatrix4fv(ps.u('uVP'), false, vp);
    gl.uniform3fv(ps.u('uCenter'), center);
    gl.uniform1f(ps.u('uRadius'), radius);
    gl.uniform1f(ps.u('uFlatten'), flatten == null ? 1 : flatten);
    gl.uniform3fv(ps.u('uCamPos'), cam.pos);
    gl.uniform1f(ps.u('uMode'), mode);
    gl.uniform1f(ps.u('uStrength'), strength);
    gl.uniform3fv(ps.u('uTint'), tint);
    gl.uniform1f(ps.u('uTime'), t);
    gl.uniform3fv(ps.u('uSunDir'), env.sunDir);
    gl.uniform3fv(ps.u('uSkyCol'), env.skyCol);
    gl.drawElements(gl.TRIANGLES, this.sphere.n, gl.UNSIGNED_SHORT, 0);
  };

  /**
   * 建筑实例装填：每栋楼最多 3 个子实例 —— 主体、塔楼退台、废墟堆。
   * 部分倒塌的楼会同时出现「残存主体 + 脚下废墟堆」，这是真实震害照片里
   * 最常见的形态；完全倒塌只剩废墟堆。
   */
  R.prototype._drawBuildings = function (sim, vp, cam, env, sun, sunCol, skyCol, flashLight, flashCol, burst) {
    var gl = this.gl, pb = this.pBuild, B = sim.buildings;
    var n = B.length, need = n * 3 * BSTRIDE;
    if (!this._bdata || this._bdata.length < need) { this._bdata = new Float32Array(need); }
    var a = this._bdata, o = 0, cnt = 0;
    for (var i = 0; i < n; i++) {
      var b = B[i];
      if (b.h > 0.6) {
        a[o] = b.x; a[o + 1] = b.z; a[o + 2] = b.w; a[o + 3] = b.d;
        a[o + 4] = b.h; a[o + 5] = b.ang; a[o + 6] = b.topAng; a[o + 7] = b.lean;
        a[o + 8] = b.seed; a[o + 9] = b.state; a[o + 10] = b.glass; a[o + 11] = b.clad;
        a[o + 12] = b.char; a[o + 13] = b.burning; a[o + 14] = 0; a[o + 15] = 0;
        o += BSTRIDE; cnt++;
        if (b.tierH > 0.5 && b.collapse < 0.03) {
          a[o] = b.x; a[o + 1] = b.z; a[o + 2] = b.tierW; a[o + 3] = b.tierD;
          a[o + 4] = b.tierH; a[o + 5] = b.ang; a[o + 6] = b.topAng; a[o + 7] = b.lean;
          a[o + 8] = b.seed + 0.37; a[o + 9] = b.state; a[o + 10] = b.glass; a[o + 11] = b.clad;
          a[o + 12] = b.char; a[o + 13] = b.burning; a[o + 14] = 0; a[o + 15] = b.h;
          o += BSTRIDE; cnt++;
        }
      }
      if (b.rubbleH > 0.35) {
        a[o] = b.x; a[o + 1] = b.z; a[o + 2] = b.w * 1.30; a[o + 3] = b.d * 1.30;
        a[o + 4] = b.rubbleH; a[o + 5] = b.ang; a[o + 6] = 0; a[o + 7] = 0;
        a[o + 8] = b.seed + 0.71; a[o + 9] = b.state; a[o + 10] = 0; a[o + 11] = 0;
        a[o + 12] = b.char * 0.6; a[o + 13] = b.burning * 0.7; a[o + 14] = 1; a[o + 15] = 0;
        o += BSTRIDE; cnt++;
      }
    }
    if (!cnt) { return; }
    gl.useProgram(pb.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.box.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.box.nbo);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buildInst);
    gl.bufferData(gl.ARRAY_BUFFER, a.subarray(0, cnt * BSTRIDE), gl.DYNAMIC_DRAW);
    var bs = BSTRIDE * 4;
    for (var k = 0; k < 4; k++) {
      gl.enableVertexAttribArray(2 + k);
      gl.vertexAttribPointer(2 + k, 4, gl.FLOAT, false, bs, k * 16);
      gl.vertexAttribDivisor(2 + k, 1);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.box.ibo);
    gl.uniformMatrix4fv(pb.u('uVP'), false, vp);
    gl.uniform3fv(pb.u('uCamPos'), cam.pos);
    gl.uniform3fv(pb.u('uSunDir'), sun);
    gl.uniform3fv(pb.u('uSunCol'), sunCol);
    gl.uniform3fv(pb.u('uSkyCol'), skyCol);
    gl.uniform3fv(pb.u('uFogCol'), env.fogCol);
    gl.uniform1f(pb.u('uFogDensity'), env.fogDensity);
    gl.uniform3fv(pb.u('uBurst'), burst);
    gl.uniform1f(pb.u('uFlashLight'), flashLight);
    gl.uniform3fv(pb.u('uFlashCol'), flashCol);
    gl.uniform1f(pb.u('uThermalLam'), env.visibility);
    gl.uniform1f(pb.u('uFlashScatter'), env.flashScatter);
    gl.uniform1f(pb.u('uFlashR'), Math.max(env.fireballR || 1, 1));
    gl.uniform1f(pb.u('uNight'), env.night ? 1 : 0);
    gl.drawElementsInstanced(gl.TRIANGLES, this.box.n, gl.UNSIGNED_SHORT, 0, cnt);
    for (k = 0; k < 4; k++) {
      gl.vertexAttribDivisor(2 + k, 0);
      gl.disableVertexAttribArray(2 + k);
    }
    this.stats.buildings = cnt;
  };

  R.prototype._fsPass = function (prog, fb, w, h, setup) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (setup) { setup(prog); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  R.prototype._post = function (sim, cam, env, vp, expo, Rs, burst) {
    var gl = this.gl, f = this.fbo, W = this.W, H = this.H, self = this;

    /* --- 激波屏幕空间折射 --- */
    var visible = 0, cx = 0, cy = 0, rPx = 0, wPx = 0, amp = 0;
    if (env.showShock && Rs > 1) {
      var c4 = [
        vp[0] * burst[0] + vp[4] * burst[1] + vp[8] * burst[2] + vp[12],
        vp[1] * burst[0] + vp[5] * burst[1] + vp[9] * burst[2] + vp[13],
        vp[2] * burst[0] + vp[6] * burst[1] + vp[10] * burst[2] + vp[14],
        vp[3] * burst[0] + vp[7] * burst[1] + vp[11] * burst[2] + vp[15]
      ];
      if (c4[3] > 0.001) {
        cx = (c4[0] / c4[3] * 0.5 + 0.5) * W;
        cy = (c4[1] / c4[3] * 0.5 + 0.5) * H;
        var dist = Math.max(c4[3], 1);
        // 球体投影半径（远场近似）
        rPx = Rs / dist * (0.5 * H / Math.tan(cam.fov * 0.5));
        if (rPx > 4 && rPx < H * 12) {
          var dpb = sim.blast.dpBar(Rs);
          wPx = U.clamp(rPx * 0.035, 2, 42);
          amp = U.clamp(Math.log(1 + dpb * 6) * 3.2, 0, 26) * (env.distort || 1);
          visible = 1;
        }
      }
    }
    this._fsPass(this.pDistort, f.dist, W, H, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tScene);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform2f(p.u('uRes'), W, H);
      gl.uniform2f(p.u('uCenter'), cx, cy);
      gl.uniform1f(p.u('uR'), rPx);
      gl.uniform1f(p.u('uW'), wPx);
      gl.uniform1f(p.u('uAmp'), amp);
      gl.uniform1f(p.u('uVisible'), visible);
    });

    /* --- 亮度提取 → 半分辨率 --- */
    this._fsPass(this.pBright, f.b1a, f.hw, f.hh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tDist);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform1f(p.u('uThreshold'), env.bloomThreshold);
      gl.uniform1f(p.u('uExposure'), expo);
    });
    /* --- 半分辨率两向高斯 --- */
    this._fsPass(this.pBlur, f.b1b, f.hw, f.hh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.t1a);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform2f(p.u('uDir'), 1.4 / f.hw, 0);
    });
    this._fsPass(this.pBlur, f.b1a, f.hw, f.hh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.t1b);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform2f(p.u('uDir'), 0, 1.4 / f.hh);
    });
    /* --- 四分之一分辨率宽泛光 --- */
    this._fsPass(this.pBlit, f.b2a, f.qw, f.qh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.t1a);
      gl.uniform1i(p.u('uTex'), 0);
    });
    this._fsPass(this.pBlur, f.b2b, f.qw, f.qh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.t2a);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform2f(p.u('uDir'), 3.0 / f.qw, 0);
    });
    this._fsPass(this.pBlur, f.b2a, f.qw, f.qh, function (p) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.t2b);
      gl.uniform1i(p.u('uTex'), 0);
      gl.uniform2f(p.u('uDir'), 0, 3.0 / f.qh);
    });

    /* --- 合成到画布 --- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.pComp.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    var pc = this.pComp;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f.tDist);
    gl.uniform1i(pc.u('uScene'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, f.t1a);
    gl.uniform1i(pc.u('uBloom1'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, f.t2a);
    gl.uniform1i(pc.u('uBloom2'), 2);
    gl.uniform1f(pc.u('uExposure'), expo);
    gl.uniform1f(pc.u('uBloom'), env.bloom);
    gl.uniform1f(pc.u('uWhiteout'), this.whiteout * (env.whiteoutScale == null ? 1 : env.whiteoutScale));
    gl.uniform1f(pc.u('uGrain'), env.grain);
    gl.uniform1f(pc.u('uTime'), sim.t);
    gl.uniform1f(pc.u('uVignette'), env.vignette);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  /** 读回整帧像素并做分块亮度统计（黑块探测用；纯数值，无视觉模型） */
  R.prototype.readTiles = function (tx, ty) {
    var gl = this.gl, W = this.W, H = this.H;
    tx = tx || 48; ty = ty || 27;
    var buf = this._pxBuf && this._pxBuf.length === W * H * 4 ?
      this._pxBuf : (this._pxBuf = new Uint8Array(W * H * 4));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    var tiles = new Float32Array(tx * ty);
    var cw = W / tx, ch = H / ty;
    for (var j = 0; j < ty; j++) {
      var y0 = Math.floor(j * ch), y1 = Math.max(y0 + 1, Math.floor((j + 1) * ch));
      for (var i = 0; i < tx; i++) {
        var x0 = Math.floor(i * cw), x1 = Math.max(x0 + 1, Math.floor((i + 1) * cw));
        var sum = 0, n = 0;
        for (var y = y0; y < y1; y += 2) {
          var row = y * W * 4;
          for (var x = x0; x < x1; x += 2) {
            var o = row + x * 4;
            sum += buf[o] * 0.2126 + buf[o + 1] * 0.7152 + buf[o + 2] * 0.0722;
            n++;
          }
        }
        tiles[i + j * tx] = n ? sum / n / 255 : 0;
      }
    }
    return { tx: tx, ty: ty, tiles: tiles };
  };

  /**
   * 在分块亮度图上找「暗且填充率高（近矩形）」的连通域。
   * 用于回归「闪光期出现黑方块」这类问题 —— 纯数值判据，不使用视觉模型。
   * 评分 = 填充率 × 内外对比 × 相对面积（贴边的暗区按 0.35 折减，
   * 因为地平线/天空的大片暗区属于正常画面）。
   */
  R.prototype.findDarkRect = function (g) {
    var tx = g.tx, ty = g.ty, T = g.tiles, N = tx * ty, i;
    var mean = 0;
    for (i = 0; i < N; i++) { mean += T[i]; }
    mean /= N;
    var thr = Math.max(0.012, mean * 0.28);
    var lab = new Int32Array(N), best = null, stack = [];
    for (i = 0; i < N; i++) {
      if (T[i] > thr || lab[i]) { continue; }
      var comp = [];
      stack.length = 0; stack.push(i); lab[i] = 1;
      while (stack.length) {
        var p = stack.pop(); comp.push(p);
        var px = p % tx, py = (p / tx) | 0;
        var nb = [px > 0 ? p - 1 : -1, px < tx - 1 ? p + 1 : -1,
          py > 0 ? p - tx : -1, py < ty - 1 ? p + tx : -1];
        for (var k = 0; k < 4; k++) {
          var q = nb[k];
          if (q >= 0 && !lab[q] && T[q] <= thr) { lab[q] = 1; stack.push(q); }
        }
      }
      if (comp.length < 4) { continue; }
      var x0 = tx, x1 = -1, y0 = ty, y1 = -1, inner = 0;
      for (k = 0; k < comp.length; k++) {
        var cx = comp[k] % tx, cy = (comp[k] / tx) | 0;
        if (cx < x0) { x0 = cx; } if (cx > x1) { x1 = cx; }
        if (cy < y0) { y0 = cy; } if (cy > y1) { y1 = cy; }
        inner += T[comp[k]];
      }
      inner /= comp.length;
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      var fill = comp.length / (bw * bh);
      var outer = 0, on = 0;
      for (cy = Math.max(y0 - 2, 0); cy <= Math.min(y1 + 2, ty - 1); cy++) {
        for (cx = Math.max(x0 - 2, 0); cx <= Math.min(x1 + 2, tx - 1); cx++) {
          if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) { continue; }
          outer += T[cx + cy * tx]; on++;
        }
      }
      outer = on ? outer / on : 0;
      var edge = (x0 === 0 || y0 === 0 || x1 === tx - 1 || y1 === ty - 1) ? 0.35 : 1;
      var score = fill * Math.min(outer / Math.max(inner, 0.004) / 6, 1.6) *
        Math.min(comp.length / N * 26, 1.4) * edge;
      var res = {
        area: comp.length, x0: x0, y0: y0, w: bw, h: bh, fill: fill,
        inner: inner, outer: outer, mean: mean, score: score
      };
      if (!best || score > best.score) { best = res; }
    }
    return best || {
      area: 0, x0: 0, y0: 0, w: 0, h: 0, fill: 0,
      inner: 0, outer: 0, mean: mean, score: 0
    };
  };

  /** 把分块亮度图渲染成 ASCII（诊断输出用；这是读数字，不是看图像） */
  R.prototype.asciiTiles = function (g) {
    var ch = ' .:-=+*#%@', lines = [];
    for (var y = g.ty - 1; y >= 0; y--) {
      var line = '';
      for (var x = 0; x < g.tx; x++) {
        var v = g.tiles[x + y * g.tx];
        line += ch[Math.min(9, Math.max(0, Math.round(Math.sqrt(Math.max(v, 0)) * 9)))];
      }
      lines.push(line);
    }
    return lines.join('\n');
  };

  /** 读回一帧的像素统计（无头自检用；不含任何视觉模型） */
  R.prototype.sampleStats = function () {
    var gl = this.gl, W = this.W, H = this.H;
    var sw = Math.min(W, 160), sh = Math.min(H, 90);
    var buf = new Uint8Array(sw * sh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    var n = sw * sh, sum = 0, mx = 0, nz = 0, hist = [0, 0, 0, 0];
    for (var i = 0; i < n; i++) {
      var r = buf[i * 4], g = buf[i * 4 + 1], b = buf[i * 4 + 2];
      var l = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      sum += l; if (l > mx) { mx = l; }
      if (l > 0.02) { nz++; }
      hist[Math.min(3, Math.floor(l * 4))]++;
    }
    return {
      w: sw, h: sh, mean: sum / n, max: mx, nonBlackFrac: nz / n,
      hist: hist.map(function (v) { return +(v / n).toFixed(3); })
    };
  };

  R.prototype.diagnostics = function () {
    return { errors: this.errors.slice(), notes: this.notes.slice(), hdr: this.hdr, W: this.W, H: this.H };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
