/* =============================================================================
   gl.js - tiny hand-written WebGL 1 forward renderer.
   Features: interleaved static meshes, one Phong-ish program with hemisphere
   ambient + 1 directional sun + 4 point lights, canvas textures, UV scroll,
   emissive, unlit mode, alpha + additive blending, exponential fog,
   draw-queue with transparency sorting, and multi-pass depth ranges so that
   a 3 cm cockpit switch and a 1 km horizon can coexist without z-fighting.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var M4 = TS.M4;

  var VS = [
    'precision highp float;',
    'attribute vec3 a_pos;',
    'attribute vec3 a_nrm;',
    'attribute vec2 a_uv;',
    'attribute vec3 a_col;',
    'uniform mat4 u_model;',
    'uniform mat4 u_viewProj;',
    'uniform mat3 u_nmat;',
    'varying vec3 v_wpos;',
    'varying vec3 v_nrm;',
    'varying vec2 v_uv;',
    'varying vec3 v_col;',
    'void main(){',
    '  vec4 wp = u_model * vec4(a_pos, 1.0);',
    '  v_wpos = wp.xyz;',
    '  v_nrm = u_nmat * a_nrm;',
    '  v_uv = a_uv;',
    '  v_col = a_col;',
    '  gl_Position = u_viewProj * wp;',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'uniform vec3 u_camPos;',
    'uniform vec3 u_sunDir;',
    'uniform vec3 u_sunCol;',
    'uniform vec3 u_skyCol;',
    'uniform vec3 u_gndCol;',
    'uniform vec3 u_fogCol;',
    'uniform float u_fogDens;',
    'uniform vec4 u_color;',
    'uniform vec3 u_emissive;',
    'uniform float u_spec;',
    'uniform float u_shine;',
    'uniform float u_useTex;',
    'uniform float u_unlit;',
    'uniform float u_twoSided;',
    'uniform float u_lightMul;',
    'uniform vec2 u_uvOffset;',
    'uniform vec2 u_uvScale;',
    'uniform sampler2D u_tex;',
    'uniform vec3 u_plPos[4];',
    'uniform vec3 u_plCol[4];',
    'uniform float u_plRad[4];',
    'varying vec3 v_wpos;',
    'varying vec3 v_nrm;',
    'varying vec2 v_uv;',
    'varying vec3 v_col;',
    'void main(){',
    '  vec4 base = u_color;',
    '  vec3 texc = vec3(1.0);',
    '  if (u_useTex > 0.5) {',
    '    vec4 t = texture2D(u_tex, v_uv * u_uvScale + u_uvOffset);',
    '    texc = t.rgb;',
    '    base *= t;',
    '  }',
    '  base.rgb *= v_col;',
    '  if (base.a < 0.01) discard;',
    '  vec3 col;',
    '  float dcam = length(u_camPos - v_wpos);',
    '  if (u_unlit > 0.5) {',
    '    col = base.rgb + u_emissive * texc;',
    '  } else {',
    '    vec3 N = normalize(v_nrm);',
    '    vec3 V = normalize(u_camPos - v_wpos);',
    '    if (u_twoSided > 0.5 && dot(N, V) < 0.0) N = -N;',
    '    vec3 amb = mix(u_gndCol, u_skyCol, N.y * 0.5 + 0.5);',
    '    float ndl = max(dot(N, u_sunDir), 0.0);',
    '    vec3 lit = amb + u_sunCol * ndl + u_sunCol * 0.14 * (dot(N, u_sunDir) * 0.5 + 0.5);',
    '    for (int i = 0; i < 4; i++) {',
    '      float r = u_plRad[i];',
    '      if (r > 0.0) {',
    '        vec3 d = u_plPos[i] - v_wpos;',
    '        float dist = max(length(d), 0.0001);',
    '        float att = max(0.0, 1.0 - dist / r);',
    '        att *= att;',
    '        lit += u_plCol[i] * att * (0.25 + 0.75 * max(dot(N, d / dist), 0.0));',
    '      }',
    '    }',
    '    vec3 H = normalize(u_sunDir + V);',
    '    float sp = pow(max(dot(N, H), 0.0), u_shine) * u_spec * (ndl > 0.0 ? 1.0 : 0.0);',
    '    col = base.rgb * lit * u_lightMul + u_sunCol * sp + u_emissive * texc;',
    '  }',
    '  float f = 1.0 - exp(-(dcam * u_fogDens) * (dcam * u_fogDens));',
    '  col = mix(col, u_fogCol, clamp(f, 0.0, 1.0));',
    '  gl_FragColor = vec4(col, base.a);',
    '}'
  ].join('\n');

  var STRIDE = 11; /* pos3 nrm3 uv2 col3 */

  function compile(gl, type, src, name) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader compile failed (' + name + '): ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function Renderer(canvas) {
    this.canvas = canvas;
    var opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.gl = gl;
    this.meshSeq = 1;

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS, 'vs'));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS, 'fs'));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    gl.useProgram(prog);

    this.attr = {
      pos: gl.getAttribLocation(prog, 'a_pos'),
      nrm: gl.getAttribLocation(prog, 'a_nrm'),
      uv: gl.getAttribLocation(prog, 'a_uv'),
      col: gl.getAttribLocation(prog, 'a_col')
    };
    var names = ['u_model', 'u_viewProj', 'u_nmat', 'u_camPos', 'u_sunDir', 'u_sunCol',
      'u_skyCol', 'u_gndCol', 'u_fogCol', 'u_fogDens', 'u_color', 'u_emissive', 'u_spec',
      'u_shine', 'u_useTex', 'u_unlit', 'u_twoSided', 'u_lightMul', 'u_uvOffset', 'u_uvScale',
      'u_tex', 'u_plPos', 'u_plCol', 'u_plRad'];
    this.u = {};
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(prog, names[i]);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    /* canvas row 0 is the top of the image, so flip on upload: then v=1 is the
       top of the texture and UVs behave "y-up" like the rest of the maths. */
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.white = this.texFromPixel([255, 255, 255, 255]);

    /* frame state */
    this.viewProj = M4.create();
    this.camPos = [0, 0, 0];
    this.env = {
      sunDir: [0.42, 0.72, 0.55], sunCol: [1.05, 0.98, 0.86],
      skyCol: [0.36, 0.42, 0.52], gndCol: [0.16, 0.15, 0.12],
      fogCol: [0.66, 0.70, 0.76], fogDens: 0.0009
    };
    this.lights = [];
    this.queue = [];
    this.transparent = [];
    this.stats = { draws: 0, tris: 0 };
    this._curMesh = null;
    this._blend = null;
    this._cull = true;
    this._depthMask = true;
  }

  Renderer.prototype.resize = function (dpr) {
    var c = this.canvas;
    dpr = dpr || Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(c.clientWidth * dpr));
    var h = Math.max(1, Math.floor(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.gl.viewport(0, 0, c.width, c.height);
    return c.width / c.height;
  };

  Renderer.prototype.aspect = function () {
    return this.canvas.width / Math.max(1, this.canvas.height);
  };

  /* ------------------------------------------------------------- textures --- */
  Renderer.prototype.texFromPixel = function (rgba) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };

  function isPOT(n) { return n > 0 && (n & (n - 1)) === 0; }

  Renderer.prototype.texture = function (source, opt) {
    opt = opt || {};
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    var pot = isPOT(source.width) && isPOT(source.height);
    var wrap = (opt.wrap === 'clamp' || !pot) ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    var filt = opt.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    if (pot && opt.mip !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
        opt.nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    }
    return t;
  };

  /* ---------------------------------------------------------------- mesh --- */
  /* geom = {p:[x,y,z...], n:[...], t:[u,v...], c:[r,g,b...], i:[...]} */
  Renderer.prototype.mesh = function (geom) {
    var gl = this.gl;
    var vcount = geom.p.length / 3;
    var data = new Float32Array(vcount * STRIDE);
    var hasN = geom.n && geom.n.length === geom.p.length;
    var hasT = geom.t && geom.t.length === vcount * 2;
    var hasC = geom.c && geom.c.length === geom.p.length;
    for (var v = 0; v < vcount; v++) {
      var o = v * STRIDE;
      data[o] = geom.p[v * 3]; data[o + 1] = geom.p[v * 3 + 1]; data[o + 2] = geom.p[v * 3 + 2];
      data[o + 3] = hasN ? geom.n[v * 3] : 0;
      data[o + 4] = hasN ? geom.n[v * 3 + 1] : 1;
      data[o + 5] = hasN ? geom.n[v * 3 + 2] : 0;
      data[o + 6] = hasT ? geom.t[v * 2] : 0;
      data[o + 7] = hasT ? geom.t[v * 2 + 1] : 0;
      data[o + 8] = hasC ? geom.c[v * 3] : 1;
      data[o + 9] = hasC ? geom.c[v * 3 + 1] : 1;
      data[o + 10] = hasC ? geom.c[v * 3 + 2] : 1;
    }
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var ibo = null, count, big = false;
    if (geom.i && geom.i.length) {
      ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      big = vcount > 65535;
      if (big && !gl.getExtension('OES_element_index_uint')) {
        throw new Error('mesh too large for 16-bit indices and OES_element_index_uint missing');
      }
      var arr = big ? new Uint32Array(geom.i) : new Uint16Array(geom.i);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      count = geom.i.length;
    } else {
      count = vcount;
    }
    return { id: this.meshSeq++, vbo: vbo, ibo: ibo, count: count, uint: big, vcount: vcount };
  };

  Renderer.prototype.deleteMesh = function (m) {
    if (!m) return;
    var gl = this.gl;
    if (m.vbo) gl.deleteBuffer(m.vbo);
    if (m.ibo) gl.deleteBuffer(m.ibo);
    m.vbo = m.ibo = null;
  };

  /* --------------------------------------------------------------- frame --- */
  Renderer.prototype.clear = function (col) {
    var gl = this.gl;
    gl.clearColor(col[0], col[1], col[2], 1);
    gl.depthMask(true); this._depthMask = true;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };

  Renderer.prototype.clearDepth = function () {
    var gl = this.gl;
    gl.depthMask(true); this._depthMask = true;
    gl.clear(gl.DEPTH_BUFFER_BIT);
  };

  Renderer.prototype.setEnv = function (env) {
    for (var k in env) if (Object.prototype.hasOwnProperty.call(env, k)) this.env[k] = env[k];
  };

  Renderer.prototype.setCamera = function (viewProj, camPos) {
    this.viewProj = viewProj;
    this.camPos = camPos;
  };

  Renderer.prototype.setLights = function (list) {
    this.lights = list || [];
  };

  Renderer.prototype.beginFrame = function () {
    this.stats.draws = 0; this.stats.tris = 0;
  };

  /* push a draw. mat: {color,tex,emissive,spec,shine,alpha,additive,unlit,
     doubleSided,uvOffset,uvScale,lightMul,depthWrite,noFog}                  */
  Renderer.prototype.draw = function (mesh, model, mat) {
    if (!mesh) return;
    mat = mat || EMPTY;
    var a = mat.alpha === undefined ? 1 : mat.alpha;
    if (a >= 0.999 && !mat.additive) {
      this.queue.push({ m: mesh, x: model, mt: mat });
    } else {
      var dx = model[12] - this.camPos[0], dy = model[13] - this.camPos[1], dz = model[14] - this.camPos[2];
      this.transparent.push({ m: mesh, x: model, mt: mat, d: dx * dx + dy * dy + dz * dz });
    }
  };

  var EMPTY = {};
  var TMP_N = new Float32Array(9);

  Renderer.prototype._applyMesh = function (mesh) {
    if (this._curMesh === mesh.id) return;
    var gl = this.gl, at = this.attr;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    var bs = STRIDE * 4;
    gl.enableVertexAttribArray(at.pos);
    gl.vertexAttribPointer(at.pos, 3, gl.FLOAT, false, bs, 0);
    if (at.nrm >= 0) { gl.enableVertexAttribArray(at.nrm); gl.vertexAttribPointer(at.nrm, 3, gl.FLOAT, false, bs, 12); }
    if (at.uv >= 0) { gl.enableVertexAttribArray(at.uv); gl.vertexAttribPointer(at.uv, 2, gl.FLOAT, false, bs, 24); }
    if (at.col >= 0) { gl.enableVertexAttribArray(at.col); gl.vertexAttribPointer(at.col, 3, gl.FLOAT, false, bs, 32); }
    if (mesh.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    this._curMesh = mesh.id;
  };

  Renderer.prototype._setGlobals = function () {
    var gl = this.gl, u = this.u, e = this.env;
    gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
    gl.uniform3fv(u.u_camPos, this.camPos);
    var sd = TS.V3.normalize(e.sunDir);
    gl.uniform3fv(u.u_sunDir, sd);
    gl.uniform3fv(u.u_sunCol, e.sunCol);
    gl.uniform3fv(u.u_skyCol, e.skyCol);
    gl.uniform3fv(u.u_gndCol, e.gndCol);
    gl.uniform3fv(u.u_fogCol, e.fogCol);
    gl.uniform1f(u.u_fogDens, e.fogDens);
    var pos = new Float32Array(12), col = new Float32Array(12), rad = new Float32Array(4);
    for (var i = 0; i < 4; i++) {
      var L = this.lights[i];
      if (L) {
        pos[i * 3] = L.pos[0]; pos[i * 3 + 1] = L.pos[1]; pos[i * 3 + 2] = L.pos[2];
        col[i * 3] = L.col[0]; col[i * 3 + 1] = L.col[1]; col[i * 3 + 2] = L.col[2];
        rad[i] = L.rad;
      } else { rad[i] = 0; }
    }
    gl.uniform3fv(u.u_plPos, pos);
    gl.uniform3fv(u.u_plCol, col);
    gl.uniform1fv(u.u_plRad, rad);
    gl.uniform1i(u.u_tex, 0);
  };

  Renderer.prototype._issue = function (item) {
    var gl = this.gl, u = this.u, mt = item.mt, mesh = item.m;
    this._applyMesh(mesh);
    gl.uniformMatrix4fv(u.u_model, false, item.x);
    M4.normalMatrix(item.x, TMP_N);
    gl.uniformMatrix3fv(u.u_nmat, false, TMP_N);
    var c = mt.color || WHITE3;
    var a = mt.alpha === undefined ? 1 : mt.alpha;
    gl.uniform4f(u.u_color, c[0], c[1], c[2], a);
    var em = mt.emissive || ZERO3;
    gl.uniform3f(u.u_emissive, em[0], em[1], em[2]);
    gl.uniform1f(u.u_spec, mt.spec === undefined ? 0.12 : mt.spec);
    gl.uniform1f(u.u_shine, mt.shine === undefined ? 24 : mt.shine);
    gl.uniform1f(u.u_unlit, mt.unlit ? 1 : 0);
    gl.uniform1f(u.u_twoSided, mt.doubleSided ? 1 : 0);
    gl.uniform1f(u.u_lightMul, mt.lightMul === undefined ? 1 : mt.lightMul);
    var uo = mt.uvOffset || ZERO2, us = mt.uvScale || ONE2;
    gl.uniform2f(u.u_uvOffset, uo[0], uo[1]);
    gl.uniform2f(u.u_uvScale, us[0], us[1]);
    if (mt.tex) {
      gl.uniform1f(u.u_useTex, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mt.tex);
    } else {
      gl.uniform1f(u.u_useTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.white);
    }
    /* pipeline state */
    var wantCull = !mt.doubleSided;
    if (wantCull !== this._cull) {
      this._cull = wantCull;
      if (wantCull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    }
    var mode = mt.additive ? 2 : (a < 0.999 ? 1 : 0);
    if (mode !== this._blend) {
      this._blend = mode;
      if (mode === 0) gl.disable(gl.BLEND);
      else {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, mode === 2 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      }
    }
    var dw = mt.depthWrite === undefined ? (mode === 0) : mt.depthWrite;
    if (dw !== this._depthMask) { this._depthMask = dw; gl.depthMask(dw); }

    if (mesh.ibo) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.uint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.stats.draws++;
    this.stats.tris += mesh.count / 3;
  };

  var WHITE3 = [1, 1, 1], ZERO3 = [0, 0, 0], ZERO2 = [0, 0], ONE2 = [1, 1];

  Renderer.prototype.flush = function () {
    var gl = this.gl;
    gl.useProgram(this.prog);
    this._curMesh = null;
    this._setGlobals();
    /* opaque: group by mesh id to minimise buffer rebinds */
    this.queue.sort(function (a, b) { return a.m.id - b.m.id; });
    for (var i = 0; i < this.queue.length; i++) this._issue(this.queue[i]);
    /* transparent: far to near */
    this.transparent.sort(function (a, b) { return b.d - a.d; });
    for (var j = 0; j < this.transparent.length; j++) this._issue(this.transparent[j]);
    this.queue.length = 0;
    this.transparent.length = 0;
    if (!this._depthMask) { gl.depthMask(true); this._depthMask = true; }
    if (this._blend !== 0) { gl.disable(gl.BLEND); this._blend = 0; }
  };

  TS.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : this);
