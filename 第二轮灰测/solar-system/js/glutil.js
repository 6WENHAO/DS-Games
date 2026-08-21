/* =======================================================================
 *  glutil.js  —  WebGL2 薄封装：着色器 / 程序 / VAO / FBO / 纹理
 *  所有编译错误都会同时写入页面诊断面板（便于无 devtools 时排障）
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});

  const diag = {
    lines: [],
    push(kind, msg) {
      this.lines.push({ kind, msg });
      const el = document.getElementById('diag-log');
      if (el) {
        const d = document.createElement('div');
        d.className = 'diag-' + kind;
        d.textContent = '[' + kind + '] ' + msg;
        el.appendChild(d);
      }
      const box = document.getElementById('diag');
      if (box && kind === 'error') box.classList.add('visible');
      if (kind === 'error') console.error(msg); else console.log(msg);
    },
  };
  SS.diag = diag;

  const GL = {};

  GL.createContext = function (canvas) {
    const opts = {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      desynchronized: false,
    };
    const gl = canvas.getContext('webgl2', opts);
    if (!gl) {
      diag.push('error', '当前浏览器不支持 WebGL2，无法运行（建议 Chrome / Edge / Firefox 最新版）');
      return null;
    }
    gl.__ext = {
      colorFloat: gl.getExtension('EXT_color_buffer_float'),
      floatBlend: gl.getExtension('EXT_float_blend'),
      texFilterAniso: gl.getExtension('EXT_texture_filter_anisotropic'),
      lose: gl.getExtension('WEBGL_lose_context'),
    };
    if (!gl.__ext.colorFloat) {
      diag.push('warn', '缺少 EXT_color_buffer_float：HDR 通道降级为 8bit，画质会下降');
    }
    return gl;
  };

  function shaderSource(gl, type, src, name) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || '';
      const lines = src.split('\n');
      let detail = '';
      const m = /:(\d+):(\d+):/.exec(log) || /ERROR:\s*\d+:(\d+)/.exec(log);
      if (m) {
        const ln = parseInt(m[1] === undefined ? m[2] : m[1], 10);
        for (let i = Math.max(0, ln - 4); i < Math.min(lines.length, ln + 3); i++) {
          detail += '\n  ' + (i + 1) + ' | ' + lines[i];
        }
      }
      diag.push('error', '着色器编译失败 [' + name + ']: ' + log + detail);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  /** 编译并链接程序；自动缓存 uniform 位置 */
  GL.program = function (gl, vsSrc, fsSrc, name) {
    const vs = shaderSource(gl, gl.VERTEX_SHADER, vsSrc, name + '.vert');
    const fs = shaderSource(gl, gl.FRAGMENT_SHADER, fsSrc, name + '.frag');
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      diag.push('error', '程序链接失败 [' + name + ']: ' + gl.getProgramInfoLog(p));
      return null;
    }
    const prog = {
      name,
      handle: p,
      u: Object.create(null),
      loc(n) {
        let l = this.u[n];
        if (l === undefined) {
          l = gl.getUniformLocation(p, n);
          this.u[n] = l;
        }
        return l;
      },
      use() { gl.useProgram(p); return this; },
      // ---- uniform setters（位置不存在时静默跳过）----
      f(n, v) { const l = this.loc(n); if (l) gl.uniform1f(l, v); return this; },
      i(n, v) { const l = this.loc(n); if (l) gl.uniform1i(l, v); return this; },
      v2(n, x, y) { const l = this.loc(n); if (l) gl.uniform2f(l, x, y); return this; },
      v3(n, a, b, c) {
        const l = this.loc(n); if (!l) return this;
        if (b === undefined) gl.uniform3f(l, a[0], a[1], a[2]); else gl.uniform3f(l, a, b, c);
        return this;
      },
      v4(n, a, b, c, d) {
        const l = this.loc(n); if (!l) return this;
        if (b === undefined) gl.uniform4f(l, a[0], a[1], a[2], a[3]); else gl.uniform4f(l, a, b, c, d);
        return this;
      },
      fv(n, arr) { const l = this.loc(n); if (l) gl.uniform1fv(l, arr); return this; },
      v3v(n, arr) { const l = this.loc(n); if (l) gl.uniform3fv(l, arr); return this; },
      v4v(n, arr) { const l = this.loc(n); if (l) gl.uniform4fv(l, arr); return this; },
      m3(n, m) { const l = this.loc(n); if (l) gl.uniformMatrix3fv(l, false, m instanceof Float32Array ? m : new Float32Array(m)); return this; },
      m4(n, m) { const l = this.loc(n); if (l) gl.uniformMatrix4fv(l, false, m); return this; },
      tex(n, unit, texture, target) {
        const l = this.loc(n); if (!l) return this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(target || gl.TEXTURE_2D, texture);
        gl.uniform1i(l, unit);
        return this;
      },
    };
    return prog;
  };

  /** 静态几何体：交错顶点缓冲 + 可选索引 */
  GL.mesh = function (gl, attribs, indices, drawMode) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];
    attribs.forEach((a) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, a.data, a.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, a.type || gl.FLOAT, !!a.normalized, a.stride || 0, a.offset || 0);
      if (a.divisor) gl.vertexAttribDivisor(a.loc, a.divisor);
      buffers.push(buf);
    });
    let ibo = null, count = 0, itype = gl.UNSIGNED_INT;
    if (indices) {
      ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      count = indices.length;
      itype = indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    } else {
      count = attribs[0].data.length / attribs[0].size;
    }
    gl.bindVertexArray(null);
    return {
      vao, buffers, ibo, count, itype,
      mode: drawMode === undefined ? gl.TRIANGLES : drawMode,
      draw(n) {
        gl.bindVertexArray(vao);
        const c = n === undefined ? count : n;
        if (ibo) gl.drawElements(this.mode, c, itype, 0);
        else gl.drawArrays(this.mode, 0, c);
      },
      drawInstanced(instances, n) {
        gl.bindVertexArray(vao);
        const c = n === undefined ? count : n;
        if (ibo) gl.drawElementsInstanced(this.mode, c, itype, 0, instances);
        else gl.drawArraysInstanced(this.mode, 0, c, instances);
      },
      update(index, data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[index]);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      },
    };
  };

  GL.texture2D = function (gl, opts) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const internal = opts.internalFormat || gl.RGBA8;
    const w = opts.width, h = opts.height;
    if (opts.data !== undefined && opts.data !== null) {
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, opts.format || gl.RGBA, opts.type || gl.UNSIGNED_BYTE, opts.data);
    } else {
      gl.texStorage2D(gl.TEXTURE_2D, opts.levels || 1, internal, w, h);
    }
    const min = opts.min || gl.LINEAR, mag = opts.mag || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT || gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { handle: t, width: w, height: h, internalFormat: internal };
  };

  /** 渲染目标：一张颜色纹理 + 可选深度 */
  GL.renderTarget = function (gl, width, height, opts) {
    opts = opts || {};
    const internal = opts.internalFormat || (gl.__ext.colorFloat ? gl.RGBA16F : gl.RGBA8);
    const color = GL.texture2D(gl, {
      width, height, internalFormat: internal,
      min: opts.min || gl.LINEAR, mag: opts.mag || gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
    });
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color.handle, 0);
    let depth = null;
    if (opts.depth) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      if (opts.samples && opts.samples > 1) {
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, opts.samples, gl.DEPTH_COMPONENT24, width, height);
      } else {
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      }
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) diag.push('error', 'FBO 不完整 (0x' + st.toString(16) + ') ' + width + 'x' + height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      fbo, color, depth, width, height,
      bind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, width, height);
      },
      dispose() {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(color.handle);
        if (depth) gl.deleteRenderbuffer(depth);
      },
    };
  };

  SS.GL = GL;
})(window);
