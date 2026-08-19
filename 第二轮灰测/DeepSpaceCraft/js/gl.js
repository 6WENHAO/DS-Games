/* DEEP SPACE CRAFT · gl.js —— WebGL2 极简封装（所有渲染模块只准通过它建资源） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  var GL = {
    gl: null, canvas: null, W: 1, H: 1, dpr: 1,
    _state: { depth: true, blend: 'off', cull: 'back' },
    stats: { draws: 0, tris: 0 },

    init: function (canvas) {
      var gl = canvas.getContext('webgl2', {
        antialias: false, alpha: false, depth: true, stencil: false,
        powerPreference: 'high-performance', preserveDrawingBuffer: false,
        desynchronized: false
      });
      if (!gl) throw new Error('WebGL2 unavailable');
      GL.gl = gl; GL.canvas = canvas;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      GL.resize();
      return gl;
    },

    resize: function (maxDpr) {
      var c = GL.canvas; if (!c) return false;
      var dpr = Math.min(maxDpr || 1.5, window.devicePixelRatio || 1);
      var w = Math.max(320, Math.floor((c.clientWidth || window.innerWidth) * dpr));
      var h = Math.max(240, Math.floor((c.clientHeight || window.innerHeight) * dpr));
      if (c.width === w && c.height === h && GL.dpr === dpr) return false;
      c.width = w; c.height = h; GL.W = w; GL.H = h; GL.dpr = dpr;
      GL.gl.viewport(0, 0, w, h);
      return true;
    },

    /* ------------------------------------------------------------ 着色器 */
    shader: function (type, src, name) {
      var gl = GL.gl, s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(s) || '';
        var lines = src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n');
        console.error('[GL] shader compile failed <' + (name || '?') + '>\n' + log + '\n' + lines);
        throw new Error('shader compile failed: ' + (name || '') + ' ' + log);
      }
      return s;
    },

    program: function (vsSrc, fsSrc, name) {
      var gl = GL.gl;
      var vs = GL.shader(gl.VERTEX_SHADER, vsSrc, name + '.vs');
      var fs = GL.shader(gl.FRAGMENT_SHADER, fsSrc, name + '.fs');
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error('[GL] link failed <' + name + '>: ' + gl.getProgramInfoLog(p));
      }
      gl.deleteShader(vs); gl.deleteShader(fs);
      var u = {}, a = {}, i, info;
      var nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (i = 0; i < nu; i++) {
        info = gl.getActiveUniform(p, i);
        var un = info.name.replace(/\[0\]$/, '');
        u[un] = gl.getUniformLocation(p, info.name);
      }
      var na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (i = 0; i < na; i++) {
        info = gl.getActiveAttrib(p, i);
        a[info.name] = gl.getAttribLocation(p, info.name);
      }
      var obj = {
        prog: p, u: u, a: a, name: name,
        use: function () { gl.useProgram(p); return obj; },
        /* 便捷 uniform 设置（找不到就静默跳过，方便着色器裁剪） */
        set: function (n, v) {
          var loc = u[n]; if (loc === undefined || loc === null) return obj;
          if (typeof v === 'number') { gl.uniform1f(loc, v); return obj; }
          if (typeof v === 'boolean') { gl.uniform1i(loc, v ? 1 : 0); return obj; }
          switch (v.length) {
            case 2: gl.uniform2fv(loc, v); break;
            case 3: gl.uniform3fv(loc, v); break;
            case 4: gl.uniform4fv(loc, v); break;
            case 9: gl.uniformMatrix3fv(loc, false, v); break;
            case 16: gl.uniformMatrix4fv(loc, false, v); break;
            default: gl.uniform1fv(loc, v);
          }
          return obj;
        },
        seti: function (n, v) { var loc = u[n]; if (loc) gl.uniform1i(loc, v); return obj; }
      };
      return obj;
    },

    /* ------------------------------------------------------------ 缓冲 */
    buffer: function (dataOrSize, target, usage) {
      var gl = GL.gl;
      target = target || gl.ARRAY_BUFFER;
      usage = usage || gl.STATIC_DRAW;
      var b = gl.createBuffer();
      gl.bindBuffer(target, b);
      if (dataOrSize != null) gl.bufferData(target, dataOrSize, usage);
      gl.bindBuffer(target, null);
      b._target = target;
      return b;
    },
    upload: function (buf, data, target, usage) {
      var gl = GL.gl;
      target = target || buf._target || gl.ARRAY_BUFFER;
      gl.bindBuffer(target, buf);
      gl.bufferData(target, data, usage || gl.STATIC_DRAW);
      gl.bindBuffer(target, null);
      return buf;
    },
    /* attribs: [{buffer, loc, size, type?, normalized?, stride, offset, divisor?, integer?}] */
    vao: function (attribs, indexBuffer) {
      var gl = GL.gl, v = gl.createVertexArray();
      gl.bindVertexArray(v);
      for (var i = 0; i < attribs.length; i++) {
        var A = attribs[i];
        if (A.loc === undefined || A.loc < 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, A.buffer);
        gl.enableVertexAttribArray(A.loc);
        var type = A.type || gl.FLOAT;
        if (A.integer) gl.vertexAttribIPointer(A.loc, A.size, type, A.stride || 0, A.offset || 0);
        else gl.vertexAttribPointer(A.loc, A.size, type, !!A.normalized, A.stride || 0, A.offset || 0);
        if (A.divisor) gl.vertexAttribDivisor(A.loc, A.divisor);
      }
      if (indexBuffer) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return v;
    },

    /* ------------------------------------------------------------ 纹理 */
    texFromCanvas: function (cv, o) {
      o = o || {};
      var gl = GL.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!o.flipY);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      var near = o.nearest === undefined ? true : o.nearest;
      if (o.mips) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, near ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, near ? gl.NEAREST : gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, near ? gl.NEAREST : gl.LINEAR);
      var wrap = o.wrap || gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    },

    texData: function (w, h, pixels, o) {
      o = o || {};
      var gl = GL.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      var internal = o.internal || gl.RGBA8, format = o.format || gl.RGBA, type = o.type || gl.UNSIGNED_BYTE;
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, pixels || null);
      var near = o.nearest === undefined ? true : o.nearest;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, near ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, near ? gl.NEAREST : gl.LINEAR);
      var wrap = o.wrap || gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (o.mips) { gl.generateMipmap(gl.TEXTURE_2D); }
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    },

    setTex: function (unit, tex, target) {
      var gl = GL.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(target || gl.TEXTURE_2D, tex);
    },

    /* ------------------------------------------------------------ FBO */
    _floatOK: null,
    canFloat: function () {
      if (GL._floatOK === null) {
        /* WebGL2 渲染到 half/float 纹理必须要有此扩展，否则 FBO 不完整（0x506） */
        GL._floatOK = !!(GL.gl.getExtension('EXT_color_buffer_float') || GL.gl.getExtension('EXT_color_buffer_half_float'));
        if (!GL._floatOK) console.warn('[GL] 无 EXT_color_buffer_float，HDR 缓冲回退为 RGBA8');
      }
      return GL._floatOK;
    },
    fbo: function (w, h, o) {
      o = o || {};
      var gl = GL.gl;
      var useFloat = !!o.float && GL.canFloat();
      var obj = { w: w, h: h, fb: gl.createFramebuffer(), color: null, depth: null, float: useFloat };
      function alloc() {
        obj.color = GL.texData(obj.w, obj.h, null, {
          internal: obj.float ? gl.RGBA16F : gl.RGBA8, format: gl.RGBA,
          type: obj.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, nearest: !!o.nearest
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, obj.fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, obj.color, 0);
        if (o.depth !== false) {
          if (obj.depth) gl.deleteRenderbuffer(obj.depth);
          obj.depth = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, obj.depth);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, obj.w, obj.h);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, obj.depth);
        }
        /* 完整性检查：不完整则降级为 RGBA8 再试一次 */
        var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (st !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          if (obj.float) {
            console.warn('[GL] FBO 不完整(0x' + st.toString(16) + ')，降级 RGBA8 重建');
            obj.float = false;
            gl.deleteTexture(obj.color);
            alloc();
            return;
          }
          console.error('[GL] FBO 不完整: 0x' + st.toString(16));
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      alloc();
      obj.resize = function (nw, nh) {
        nw = Math.max(1, nw | 0); nh = Math.max(1, nh | 0);
        if (nw === obj.w && nh === obj.h) return;
        obj.w = nw; obj.h = nh;
        if (obj.color) gl.deleteTexture(obj.color);
        alloc();
      };
      obj.bind = function () { GL.bindFB(obj); };
      return obj;
    },

    bindFB: function (f, w, h) {
      var gl = GL.gl;
      if (!f) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w || GL.W, h || GL.H); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, w || f.w, h || f.h); }
    },

    /* ------------------------------------------------------------ 状态 */
    clear: function (r, g, b, a, depth) {
      var gl = GL.gl;
      gl.clearColor(r, g, b, a === undefined ? 1 : a);
      gl.clear(gl.COLOR_BUFFER_BIT | (depth === false ? 0 : gl.DEPTH_BUFFER_BIT));
    },
    depth: function (enable, o) {
      var gl = GL.gl; o = o || {};
      if (enable) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      gl.depthMask(o.write === undefined ? true : !!o.write);
      if (o.func) gl.depthFunc(o.func);
      GL._state.depth = enable;
    },
    blend: function (mode) {
      var gl = GL.gl;
      GL._state.blend = mode;
      if (mode === 'off' || !mode) { gl.disable(gl.BLEND); return; }
      gl.enable(gl.BLEND);
      if (mode === 'add') { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); }
      else if (mode === 'premul') { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
      else { gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    },
    cull: function (mode) {
      var gl = GL.gl;
      GL._state.cull = mode;
      if (mode === 'off' || !mode) { gl.disable(gl.CULL_FACE); return; }
      gl.enable(gl.CULL_FACE);
      gl.cullFace(mode === 'front' ? gl.FRONT : gl.BACK);
    },
    /* 渲染模块入口/出口的标准状态 */
    resetState: function () { GL.depth(true, { write: true }); GL.blend('off'); GL.cull('back'); },

    /* ------------------------------------------------------------ 几何 */
    _screen: null,
    screenVAO: function (loc) {
      if (GL._screen && GL._screen.loc === (loc === undefined ? 0 : loc)) return GL._screen.vao;
      var buf = GL.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
      var v = GL.vao([{ buffer: buf, loc: loc === undefined ? 0 : loc, size: 2 }]);
      GL._screen = { vao: v, loc: loc === undefined ? 0 : loc, buf: buf };
      return v;
    },
    drawScreen: function () {
      var gl = GL.gl;
      gl.bindVertexArray(GL._screen ? GL._screen.vao : GL.screenVAO());
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },

    /* 单位球（UV 球），属性 loc: 0=pos 1=nrm 2=uv */
    sphereMesh: function (segX, segY) {
      var gl = GL.gl;
      segX = segX || 64; segY = segY || 32;
      var verts = [], idx = [];
      for (var y = 0; y <= segY; y++) {
        var v = y / segY, theta = v * Math.PI;
        for (var x = 0; x <= segX; x++) {
          var u = x / segX, phi = u * Math.PI * 2;
          var px = Math.sin(theta) * Math.cos(phi), py = Math.cos(theta), pz = Math.sin(theta) * Math.sin(phi);
          verts.push(px, py, pz, px, py, pz, u, 1 - v);
        }
      }
      for (y = 0; y < segY; y++) for (x = 0; x < segX; x++) {
        var a = y * (segX + 1) + x, b = a + segX + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      var vb = GL.buffer(new Float32Array(verts));
      var ib = GL.buffer(new Uint32Array(idx), gl.ELEMENT_ARRAY_BUFFER);
      var stride = 8 * 4;
      var vao = GL.vao([
        { buffer: vb, loc: 0, size: 3, stride: stride, offset: 0 },
        { buffer: vb, loc: 1, size: 3, stride: stride, offset: 12 },
        { buffer: vb, loc: 2, size: 2, stride: stride, offset: 24 }
      ], ib);
      return { vao: vao, indexCount: idx.length, indexType: gl.UNSIGNED_INT };
    },

    /* 单位立方体 [-0.5,0.5]，属性 loc: 0=pos 1=nrm 2=uv */
    boxMesh: function () {
      var gl = GL.gl;
      var f = [
        [[0, 0, 1], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]],
        [[0, 0, -1], [.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]],
        [[1, 0, 0], [.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]],
        [[-1, 0, 0], [-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]],
        [[0, 1, 0], [-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]],
        [[0, -1, 0], [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]]
      ];
      var verts = [], idx = [], n = 0;
      for (var i = 0; i < f.length; i++) {
        var nrm = f[i][0];
        var uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (var k = 1; k <= 4; k++) {
          var p = f[i][k];
          verts.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], uvs[k - 1][0], uvs[k - 1][1]);
        }
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
      }
      var vb = GL.buffer(new Float32Array(verts));
      var ib = GL.buffer(new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER);
      var stride = 8 * 4;
      var vao = GL.vao([
        { buffer: vb, loc: 0, size: 3, stride: stride, offset: 0 },
        { buffer: vb, loc: 1, size: 3, stride: stride, offset: 12 },
        { buffer: vb, loc: 2, size: 2, stride: stride, offset: 24 }
      ], ib);
      return { vao: vao, indexCount: idx.length, indexType: gl.UNSIGNED_SHORT };
    },

    draw: function (mesh, mode) {
      var gl = GL.gl;
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(mode || gl.TRIANGLES, mesh.indexCount, mesh.indexType || gl.UNSIGNED_SHORT, 0);
      GL.stats.draws++; GL.stats.tris += mesh.indexCount / 3;
      gl.bindVertexArray(null);
    },

    err: function (tag) {
      var e = GL.gl.getError();
      if (e) console.warn('[GL error]', tag, '0x' + e.toString(16));
      return e;
    }
  };

  DSC.GL = GL;
})();
