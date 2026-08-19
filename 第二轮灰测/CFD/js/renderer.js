/* =============================================================================
 * renderer.js - raw WebGL2 renderer. No three.js, no CDN, no external asset.
 *   - particles: GL_POINTS drawn as analytic sphere impostors with per-fragment
 *     normals and corrected fragment depth (so spheres intersect correctly)
 *   - container: line grid + edges, plus a two-pass fresnel glass shell
 *   - colour: shared piecewise ramp, generated into GLSL from one stop table
 * ========================================================================== */
(function (global) {
  'use strict';
  var NS = global.CFD = global.CFD || {};
  var mat4 = NS.mat4;

  /* single source of truth for the colour ramp (also drawn in the HTML legend) */
  var STOPS = [
    [0.024, 0.071, 0.180],   /* deep navy     - at rest */
    [0.043, 0.227, 0.494],   /* blue          */
    [0.075, 0.588, 0.737],   /* teal          */
    [0.325, 0.878, 0.855],   /* bright cyan   */
    [0.976, 0.808, 0.353],   /* amber         */
    [0.937, 0.290, 0.196]    /* red           - violent impact / high pressure */
  ];

  function rampGLSL() {
    var n = STOPS.length - 1, i, s = '';
    for (i = 0; i <= n; i++) {
      s += 'const vec3 K' + i + '=vec3(' + STOPS[i][0].toFixed(4) + ',' +
        STOPS[i][1].toFixed(4) + ',' + STOPS[i][2].toFixed(4) + ');\n';
    }
    s += 'vec3 ramp(float t){\n  t=clamp(t,0.0,1.0)*' + n.toFixed(1) + ';\n';
    for (i = 0; i < n; i++) {
      if (i === 0) s += '  if(t<1.0) return mix(K0,K1,t);\n';
      else if (i < n - 1) s += '  if(t<' + (i + 1).toFixed(1) + ') return mix(K' + i + ',K' + (i + 1) + ',t-' + i.toFixed(1) + ');\n';
      else s += '  return mix(K' + i + ',K' + (i + 1) + ',t-' + i.toFixed(1) + ');\n';
    }
    s += '}\n';
    return s;
  }

  var VS_PARTICLE =
    '#version 300 es\n' +
    'layout(location=0) in vec4 a_data;\n' +   /* xyz = position, w = scalar */
    'uniform mat4 u_view;\n' +
    'uniform mat4 u_proj;\n' +
    'uniform float u_radius;\n' +
    'uniform float u_pixScale;\n' +
    'uniform float u_maxPoint;\n' +
    'uniform float u_mode;\n' +
    'out float v_val;\n' +
    'out float v_viewZ;\n' +
    'void main(){\n' +
    '  vec4 vp = u_view * vec4(a_data.xyz,1.0);\n' +
    '  gl_Position = u_proj * vp;\n' +
    '  float z = max(-vp.z, 1e-3);\n' +
    '  float s = (u_mode > 1.5) ? 2.0 : (u_pixScale * u_radius / z);\n' +
    '  gl_PointSize = clamp(s, 1.0, u_maxPoint);\n' +
    '  v_val = a_data.w;\n' +
    '  v_viewZ = vp.z;\n' +
    '}\n';

  /* Two variants. The full one writes a corrected fragment depth so impostor
     spheres intersect geometrically; if a driver rejects gl_FragDepth we fall
     back to sprite-centre depth, which still looks right for small particles. */
  function fsParticle(useFragDepth) {
    return '#version 300 es\n' +
    'precision highp float;\n' +
    'precision highp int;\n' +
    'in float v_val;\n' +
    'in float v_viewZ;\n' +
    'uniform mat4 u_proj;\n' +
    'uniform float u_radius;\n' +
    'uniform vec3 u_light;\n' +
    'uniform float u_mode;\n' +
    'out vec4 o_col;\n' +
    rampGLSL() +
    'void main(){\n' +
    '  vec3 base = ramp(v_val);\n' +
    '  if(u_mode > 1.5){ ' + (useFragDepth ? 'gl_FragDepth = gl_FragCoord.z; ' : '') +
        'o_col = vec4(base,1.0); return; }\n' +
    '  vec2 c = gl_PointCoord*2.0 - 1.0;\n' +
    '  c.y = -c.y;\n' +
    '  float r2 = dot(c,c);\n' +
    '  if(r2 > 1.0) discard;\n' +
    '  if(u_mode > 0.5){ ' + (useFragDepth ? 'gl_FragDepth = gl_FragCoord.z;\n' : '') +
    '    o_col = vec4(base*(0.55+0.45*sqrt(1.0-r2)),1.0); return; }\n' +
    '  float nz = sqrt(1.0-r2);\n' +
    '  vec3 n = vec3(c, nz);\n' +
    (useFragDepth ?
    '  float zv = v_viewZ + nz*u_radius;\n' +
    '  vec4 clip = u_proj * vec4(0.0,0.0,zv,1.0);\n' +
    '  gl_FragDepth = clamp(clip.z/clip.w*0.5+0.5, 0.0, 1.0);\n' : '') +
    '  float diff = max(dot(n, u_light), 0.0);\n' +
    '  vec3 hv = normalize(u_light + vec3(0.0,0.0,1.0));\n' +
    '  float spec = pow(max(dot(n,hv),0.0), 42.0);\n' +
    '  vec3 col = base*(0.26 + 0.80*diff);\n' +
    '  col += base*pow(1.0-nz, 3.0)*0.45;\n' +          /* rim */
    '  col += vec3(0.55,0.60,0.62)*spec*0.55;\n' +
    '  o_col = vec4(col,1.0);\n' +
    '}\n';
  }

  var VS_LINE =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'uniform mat4 u_vp;\n' +
    'void main(){ gl_Position = u_vp * vec4(a_pos,1.0); }\n';

  var FS_LINE =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'precision highp int;\n' +
    'uniform vec4 u_col;\n' +
    'out vec4 o_col;\n' +
    'void main(){ o_col = u_col; }\n';

  var VS_GLASS =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'layout(location=1) in vec3 a_nrm;\n' +
    'uniform mat4 u_vp;\n' +
    'uniform vec3 u_eye;\n' +
    'out vec3 v_n;\n' +
    'out vec3 v_e;\n' +
    'void main(){ v_n = a_nrm; v_e = normalize(u_eye - a_pos); gl_Position = u_vp*vec4(a_pos,1.0); }\n';

  var FS_GLASS =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'precision highp int;\n' +
    'in vec3 v_n;\n' +
    'in vec3 v_e;\n' +
    'uniform float u_base;\n' +
    'out vec4 o_col;\n' +
    'void main(){\n' +
    '  float f = 1.0 - abs(dot(normalize(v_n), normalize(v_e)));\n' +
    '  float a = u_base + pow(f, 2.2)*0.20;\n' +
    '  o_col = vec4(vec3(0.62,0.71,0.75)*(0.35+0.65*f), a);\n' +
    '}\n';

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      throw new Error('shader compile failed: ' + log + '\n' + src);
    }
    return s;
  }

  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  function uniforms(gl, p, names) {
    var u = {}, i;
    for (i = 0; i < names.length; i++) u[names[i]] = gl.getUniformLocation(p, names[i]);
    return u;
  }

  var ATTEMPTS = [
    { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false,
      powerPreference: 'high-performance' },
    { alpha: false, antialias: false, depth: true, stencil: false, premultipliedAlpha: false,
      powerPreference: 'high-performance' },
    { alpha: false, antialias: false, depth: true, failIfMajorPerformanceCaveat: false },
    { depth: true },
    {}
  ];

  function acquireContext(canvas) {
    var creationError = '', gl = null, i;
    function onErr(e) { if (e && e.statusMessage) creationError = e.statusMessage; }
    canvas.addEventListener('webglcontextcreationerror', onErr, false);
    for (i = 0; i < ATTEMPTS.length && !gl; i++) {
      try { gl = canvas.getContext('webgl2', ATTEMPTS[i]); }
      catch (e) { creationError = creationError || (e && e.message ? e.message : String(e)); }
    }
    canvas.removeEventListener('webglcontextcreationerror', onErr, false);
    if (gl) { gl.__attempt = i - 1; return gl; }

    /* build a diagnosis the operator can act on */
    var probe = document.createElement('canvas'), has1 = false;
    try { has1 = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl')); } catch (e2) {}
    var msg = 'WebGL2 context could not be created after ' + ATTEMPTS.length + ' attempts.';
    if (creationError) msg += '\nDriver reported: ' + creationError;
    msg += has1
      ? '\nWebGL1 works here but WebGL2 does not: the browser or the graphics driver is too old. Update the browser, or update/enable the GPU driver.'
      : '\nNo WebGL context of any version is available: hardware acceleration is most likely disabled. In Chrome or Edge check chrome://gpu and enable "Use graphics acceleration when available" in Settings > System, then restart the browser.';
    throw new Error(msg);
  }

  function Renderer(canvas, box) {
    var gl = acquireContext(canvas);
    this.canvas = canvas;
    this.gl = gl;
    this.box = box;
    this.w = 1; this.h = 1;

    this.contextAttempt = gl.__attempt || 0;
    this.shaderNote = '';
    this.depthCorrected = true;
    try {
      this.pProg = program(gl, VS_PARTICLE, fsParticle(true));
    } catch (e) {
      this.depthCorrected = false;
      this.shaderNote = 'impostor depth correction unavailable: ' + (e && e.message ? e.message : e);
      this.pProg = program(gl, VS_PARTICLE, fsParticle(false));
    }
    this.pU = uniforms(gl, this.pProg, ['u_view', 'u_proj', 'u_radius', 'u_pixScale', 'u_maxPoint', 'u_light', 'u_mode']);
    this.lProg = program(gl, VS_LINE, FS_LINE);
    this.lU = uniforms(gl, this.lProg, ['u_vp', 'u_col']);
    this.gProg = program(gl, VS_GLASS, FS_GLASS);
    this.gU = uniforms(gl, this.gProg, ['u_vp', 'u_eye', 'u_base']);

    var range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    this.maxPoint = Math.max(8, Math.min(range && range[1] ? range[1] : 255, 4096));

    this.view = mat4.create();
    this.proj = mat4.create();
    this.vp = mat4.create();
    this.eye = [0, 0, 0];
    this.cam = null;
    this.resetView();

    this.buildStatic();
    this.particleVao = gl.createVertexArray();
    this.particleBuf = gl.createBuffer();
    this.capacity = 0;

    this.timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.qPool = []; this.qPending = []; this.qActive = null; this.lastGpuMs = null;
    this.gpuDisabled = false;

    gl.disable(gl.DITHER);
    gl.clearColor(0.051, 0.051, 0.051, 1.0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);
  }

  Renderer.DEFAULT_CAM = { az: 0.75, el: 0.28, dist: 2.20, target: [0, 0.42, 0], fov: 42 };
  Renderer.STOPS = STOPS;

  Renderer.prototype.resetView = function () {
    var d = Renderer.DEFAULT_CAM;
    this.cam = { az: d.az, el: d.el, dist: d.dist, target: d.target.slice(), fov: d.fov };
  };

  Renderer.prototype.setCamera = function (c) {
    this.cam = { az: c.az, el: c.el, dist: c.dist, target: c.target.slice(), fov: c.fov || 42 };
  };

  Renderer.prototype.orbit = function (dx, dy) {
    this.cam.az -= dx * 0.006;
    this.cam.el += dy * 0.006;
    if (this.cam.el > 1.45) this.cam.el = 1.45;
    if (this.cam.el < -1.30) this.cam.el = -1.30;
  };

  Renderer.prototype.zoom = function (delta) {
    this.cam.dist *= Math.exp(delta * 0.0012);
    if (this.cam.dist < 1.05) this.cam.dist = 1.05;
    if (this.cam.dist > 8.0) this.cam.dist = 8.0;
  };

  /* container geometry: line set (grid then edges) and glass shell ---------- */
  Renderer.prototype.buildStatic = function () {
    var gl = this.gl, b = this.box, i;
    var hx = b.hx, hy = b.hy, hz = b.hz;
    var lines = [];

    /* floor reference grid (drawn first, dim) */
    var DIV = 10;
    for (i = 0; i <= DIV; i++) {
      var t = i / DIV;
      var x = -hx + 2 * hx * t;
      var z = -hz + 2 * hz * t;
      lines.push(x, 0.0008, -hz, x, 0.0008, hz);
      lines.push(-hx, 0.0008, z, hx, 0.0008, z);
    }
    this.gridCount = lines.length / 3;

    /* 12 cube edges */
    var c = [
      [-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz],
      [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]
    ];
    var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (i = 0; i < E.length; i++) {
      var a = c[E[i][0]], d = c[E[i][1]];
      lines.push(a[0], a[1], a[2], d[0], d[1], d[2]);
    }
    this.edgeCount = lines.length / 3 - this.gridCount;

    this.lineVao = gl.createVertexArray();
    this.lineBuf = gl.createBuffer();
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);

    /* glass shell: 6 quads, inward-consistent winding, with normals */
    var F = [];
    function quad(p0, p1, p2, p3, nx, ny, nz) {
      var v = [p0, p1, p2, p0, p2, p3], k;
      for (k = 0; k < 6; k++) F.push(v[k][0], v[k][1], v[k][2], nx, ny, nz);
    }
    quad([-hx, 0, hz], [hx, 0, hz], [hx, hy, hz], [-hx, hy, hz], 0, 0, 1);      /* +Z */
    quad([hx, 0, -hz], [-hx, 0, -hz], [-hx, hy, -hz], [hx, hy, -hz], 0, 0, -1); /* -Z */
    quad([hx, 0, hz], [hx, 0, -hz], [hx, hy, -hz], [hx, hy, hz], 1, 0, 0);      /* +X */
    quad([-hx, 0, -hz], [-hx, 0, hz], [-hx, hy, hz], [-hx, hy, -hz], -1, 0, 0); /* -X */
    quad([-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], 0, -1, 0);     /* floor */
    quad([-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], 0, 1, 0);  /* ceiling */
    this.glassCount = F.length / 6;
    this.glassVao = gl.createVertexArray();
    this.glassBuf = gl.createBuffer();
    gl.bindVertexArray(this.glassVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glassBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(F), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
  };

  Renderer.prototype.resize = function (w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.w = w; this.h = h;
  };

  Renderer.prototype.ensureCapacity = function (n) {
    var gl = this.gl;
    if (n <= this.capacity) return;
    this.capacity = n;
    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, n * 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
  };

  Renderer.prototype.beginGpuTimer = function () {
    var gl = this.gl, ext = this.timerExt;
    if (!ext || this.gpuDisabled || this.qActive) return;
    if (this.qPending.length > 5) { this.gpuDisabled = true; return; }
    try {
      var q = this.qPool.length ? this.qPool.pop() : gl.createQuery();
      if (!q) { this.gpuDisabled = true; return; }
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      this.qActive = q;
    } catch (e) { this.gpuDisabled = true; this.qActive = null; }
  };

  Renderer.prototype.endGpuTimer = function () {
    var gl = this.gl, ext = this.timerExt;
    if (!ext || !this.qActive) return;
    try {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.qPending.push(this.qActive);
      this.qActive = null;
    } catch (e) { this.gpuDisabled = true; this.qActive = null; return; }
    try {
    while (this.qPending.length) {
      var q = this.qPending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.qPending.shift();
      var disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      var ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      if (!disjoint && ns > 0) this.lastGpuMs = ns / 1e6;
      this.qPool.push(q);
    }
    } catch (e) { this.gpuDisabled = true; this.qPending.length = 0; }
  };

  /* ---- one frame --------------------------------------------------------- */
  Renderer.prototype.render = function (solver, opt) {
    var gl = this.gl, cam = this.cam;
    var w = this.w, h = this.h;
    var ce = Math.cos(cam.el), se = Math.sin(cam.el);
    this.eye[0] = cam.target[0] + cam.dist * ce * Math.sin(cam.az);
    this.eye[1] = cam.target[1] + cam.dist * se;
    this.eye[2] = cam.target[2] + cam.dist * ce * Math.cos(cam.az);
    mat4.perspective(this.proj, cam.fov * Math.PI / 180, w / h, 0.05, 40.0);
    mat4.lookAt(this.view, this.eye, cam.target, [0, 1, 0]);
    mat4.multiply(this.vp, this.proj, this.view);

    gl.viewport(0, 0, w, h);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* reference lines */
    gl.useProgram(this.lProg);
    gl.uniformMatrix4fv(this.lU.u_vp, false, this.vp);
    gl.bindVertexArray(this.lineVao);
    if (opt.grid) {
      gl.uniform4f(this.lU.u_col, 0.185, 0.196, 0.204, 1.0);
      gl.drawArrays(gl.LINES, 0, this.gridCount);
    }
    gl.uniform4f(this.lU.u_col, 0.40, 0.44, 0.46, 1.0);
    gl.drawArrays(gl.LINES, this.gridCount, this.edgeCount);
    gl.bindVertexArray(null);

    /* glass: far side first, no depth write */
    if (opt.glass) {
      gl.useProgram(this.gProg);
      gl.uniformMatrix4fv(this.gU.u_vp, false, this.vp);
      gl.uniform3fv(this.gU.u_eye, this.eye);
      gl.uniform1f(this.gU.u_base, 0.045);
      gl.bindVertexArray(this.glassVao);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.drawArrays(gl.TRIANGLES, 0, this.glassCount);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.bindVertexArray(null);
    }

    /* particles */
    var n = solver.n;
    this.ensureCapacity(n);
    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, solver.packed, 0, n * 4);
    gl.useProgram(this.pProg);
    gl.uniformMatrix4fv(this.pU.u_view, false, this.view);
    gl.uniformMatrix4fv(this.pU.u_proj, false, this.proj);
    var radius = solver.spacing * 0.55 * opt.particleScale;
    gl.uniform1f(this.pU.u_radius, radius);
    gl.uniform1f(this.pU.u_pixScale, this.proj[5] * h);
    gl.uniform1f(this.pU.u_maxPoint, this.maxPoint);
    gl.uniform3f(this.pU.u_light, -0.371, 0.557, 0.743);
    gl.uniform1f(this.pU.u_mode, opt.shading | 0);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.bindVertexArray(null);

    /* glass: near side last, tints the fluid */
    if (opt.glass) {
      gl.useProgram(this.gProg);
      gl.uniform1f(this.gU.u_base, 0.030);
      gl.bindVertexArray(this.glassVao);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.drawArrays(gl.TRIANGLES, 0, this.glassCount);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.bindVertexArray(null);
    }
  };

  Renderer.prototype.info = function () {
    var gl = this.gl;
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    var out = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      glVersion: gl.getParameter(gl.VERSION),
      glslVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxPointSize: this.maxPoint,
      antialiasSamples: gl.getParameter(gl.SAMPLES),
      timerQuery: !!this.timerExt,
      contextAttempt: this.contextAttempt,
      impostorDepthCorrection: this.depthCorrected,
      shaderNote: this.shaderNote || null
    };
    return out;
  };

  NS.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
