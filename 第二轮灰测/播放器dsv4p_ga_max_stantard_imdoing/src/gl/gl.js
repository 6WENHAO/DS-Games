/*!
 * src/gl/gl.js — WebGL 核心：上下文、程序缓存、渲染目标池、绘制与回读
 *
 * 兼容策略：优先 WebGL2 上下文，但着色器一律使用 GLSL ES 1.00（WebGL2 向后兼容），
 * 因此在只有 WebGL1 的机器上（老驱动、虚拟机、部分 Linux 发行版默认配置）同样可用。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});

  var CTX_ATTRS = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    desynchronized: false
  };

  function GLCore(canvas) {
    D.Emitter.call(this);
    this.canvas = canvas;
    this.gl = null;
    this.isWebGL2 = false;
    this.ok = false;
    this.error = null;
    this.programs = Object.create(null);
    this._pool = Object.create(null);
    this._live = [];
    this._units = 0;
    this.stats = { programs: 0, draws: 0, rtCreated: 0, rtLive: 0, bytes: 0 };
    this._init();
  }
  GLCore.prototype = Object.create(D.Emitter.prototype);
  GLCore.prototype.constructor = GLCore;

  GLCore.prototype._init = function () {
    var self = this;
    var gl = null;
    try { gl = this.canvas.getContext('webgl2', CTX_ATTRS); } catch (e) {}
    if (gl) this.isWebGL2 = true;
    if (!gl) {
      try { gl = this.canvas.getContext('webgl', CTX_ATTRS) || this.canvas.getContext('experimental-webgl', CTX_ATTRS); } catch (e2) {}
    }
    if (!gl) {
      this.error = '当前浏览器/驱动没有可用的 WebGL 上下文';
      this.ok = false;
      return;
    }
    this.gl = gl;
    this.ok = true;
    D.caps.webgl2 = this.isWebGL2;

    this.canvas.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      self.ok = false;
      self.programs = Object.create(null);
      self._pool = Object.create(null);
      self.emit('lost', {});
    }, false);
    this.canvas.addEventListener('webglcontextrestored', function () {
      self._init();
      self.emit('restored', {});
    }, false);

    // 全屏四边形（两个三角形）
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.rendererInfo = dbg ? {
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
    } : { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER) };
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  };

  /* ------------------------------------------------------------------ *
   * 程序编译（带缓存与友好报错）
   * ------------------------------------------------------------------ */

  function numberLines(src) {
    return src.split('\n').map(function (l, i) {
      var n = String(i + 1);
      while (n.length < 4) n = ' ' + n;
      return n + ' | ' + l;
    }).join('\n');
  }

  GLCore.prototype._shader = function (type, src) {
    var gl = this.gl;
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh) || '(no log)';
      gl.deleteShader(sh);
      var err = new Error(log.trim());
      err.shaderSource = src;
      err.listing = numberLines(src);
      throw err;
    }
    return sh;
  };

  /**
   * 编译/取出程序
   * @param {string} fsSrc 片段着色器完整源码
   * @param {string} [key] 缓存键（默认用源码本身）
   * @returns {{prog:WebGLProgram, loc:object, samplers:string[]}}
   */
  GLCore.prototype.program = function (fsSrc, key) {
    key = key || fsSrc;
    var cached = this.programs[key];
    if (cached) return cached;
    var gl = this.gl;
    var vs = this._shader(gl.VERTEX_SHADER, D.ShaderLib.VERT);
    var fs;
    try {
      fs = this._shader(gl.FRAGMENT_SHADER, fsSrc);
    } catch (e) {
      gl.deleteShader(vs);
      throw e;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(prog) || '(no log)';
      gl.deleteProgram(prog);
      var err = new Error('链接失败: ' + log.trim());
      err.listing = numberLines(fsSrc);
      throw err;
    }
    // 收集 uniform 位置
    var loc = Object.create(null);
    var samplers = [];
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      var name = info.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(prog, info.name);
      if (info.type === gl.SAMPLER_2D) samplers.push(name);
    }
    var rec = { prog: prog, loc: loc, samplers: samplers };
    this.programs[key] = rec;
    this.stats.programs++;
    return rec;
  };

  /* ------------------------------------------------------------------ *
   * 纹理与渲染目标
   * ------------------------------------------------------------------ */

  GLCore.prototype.createTexture = function (opts) {
    var gl = this.gl;
    opts = opts || {};
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    var f = opts.filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    var wrap = opts.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (opts.width && opts.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, opts.width, opts.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, opts.data || null);
    }
    return tex;
  };

  /** 上传 8 位灰度/RGBA 数据（Uint8Array） */
  GLCore.prototype.uploadData = function (tex, w, h, data) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  };

  /**
   * 上传视频帧 / ImageBitmap / Canvas
   * @returns {boolean} 是否成功（file:// 下跨源污染会抛 SecurityError）
   */
  GLCore.prototype.uploadFrame = function (tex, source, flipY) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY === false ? 0 : 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (e) {
      this.error = '无法把视频帧上传到 GPU：' + (e && e.message ? e.message : e);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      return false;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    return true;
  };

  /** 取一个渲染目标（带池化复用） */
  GLCore.prototype.rt = function (w, h, filter) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    filter = filter === 'nearest' ? 'nearest' : 'linear';
    var key = w + 'x' + h + ':' + filter;
    var bucket = this._pool[key] || (this._pool[key] = []);
    if (bucket.length) {
      var r = bucket.pop();
      this.stats.rtLive++;
      return r;
    }
    var gl = this.gl;
    var tex = this.createTexture({ width: w, height: h, filter: filter });
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('创建渲染目标失败 (status 0x' + status.toString(16) + ')，可能是分辨率超出上限 ' + this.maxTexture);
    }
    this.stats.rtCreated++;
    this.stats.rtLive++;
    this.stats.bytes += w * h * 4;
    return { tex: tex, fbo: fbo, w: w, h: h, filter: filter, key: key };
  };

  GLCore.prototype.release = function (rt) {
    if (!rt) return;
    var bucket = this._pool[rt.key] || (this._pool[rt.key] = []);
    if (bucket.length < 6) bucket.push(rt);
    else {
      var gl = this.gl;
      gl.deleteFramebuffer(rt.fbo);
      gl.deleteTexture(rt.tex);
      this.stats.bytes -= rt.w * rt.h * 4;
    }
    this.stats.rtLive = Math.max(0, this.stats.rtLive - 1);
  };

  /** 清空整个渲染目标池（换分辨率时调用） */
  GLCore.prototype.purge = function () {
    var gl = this.gl;
    var keys = Object.keys(this._pool);
    for (var i = 0; i < keys.length; i++) {
      var b = this._pool[keys[i]];
      for (var j = 0; j < b.length; j++) {
        gl.deleteFramebuffer(b[j].fbo);
        gl.deleteTexture(b[j].tex);
      }
    }
    this._pool = Object.create(null);
    this.stats.bytes = 0;
  };

  /* ------------------------------------------------------------------ *
   * 绘制
   * ------------------------------------------------------------------ */

  /**
   * 绘制一次全屏 pass
   * @param {object} rec program() 的返回值
   * @param {object} uniforms 名字 -> 值（number / [x,y] / [x,y,z] / Float32Array / WebGLTexture / rt 对象）
   * @param {object|null} target 渲染目标（null = 画布）
   */
  GLCore.prototype.draw = function (rec, uniforms, target) {
    var gl = this.gl;
    if (!this.ok) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    var w = target ? target.w : this.canvas.width;
    var h = target ? target.h : this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(rec.prog);

    var unit = 0;
    if (uniforms) {
      var names = Object.keys(uniforms);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var loc = rec.loc[name];
        if (loc == null) continue; // 未使用的 uniform 会被编译器优化掉，正常现象
        var v = uniforms[name];
        if (v == null) continue;
        // 是否 sampler 由程序自省结果决定，而不是靠 instanceof 猜类型
        if (rec.samplers.indexOf(name) >= 0) {
          var tex = (v && v.tex !== undefined) ? v.tex : v;
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1i(loc, unit);
          unit++;
        } else if (typeof v === 'number') {
          gl.uniform1f(loc, v);
        } else if (typeof v === 'boolean') {
          gl.uniform1f(loc, v ? 1 : 0);
        } else if (v.length === 2) {
          gl.uniform2f(loc, v[0], v[1]);
        } else if (v.length === 3) {
          gl.uniform3f(loc, v[0], v[1], v[2]);
        } else if (v.length === 4) {
          gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
        } else if (v.length > 4) {
          gl.uniform3fv(loc, v);
        }
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.stats.draws++;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  GLCore.prototype.clear = function (target, r, g, b) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
    gl.clearColor(r || 0, g || 0, b || 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /** 回读像素（RGBA，行序自下而上） */
  GLCore.prototype.readPixels = function (target) {
    var gl = this.gl;
    var w = target ? target.w : this.canvas.width;
    var h = target ? target.h : this.canvas.height;
    var buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { data: buf, width: w, height: h };
  };

  /**
   * 回读一小块区域（像素检查器 / 放大镜用，避免整帧回读）
   * @param {object} target 渲染目标
   * @param {number} x 左下角 x（GL 坐标系，原点在左下）
   * @param {number} y 左下角 y
   * @param {number} w 宽
   * @param {number} h 高
   */
  GLCore.prototype.readRegion = function (target, x, y, w, h) {
    var gl = this.gl;
    var tw = target ? target.w : this.canvas.width;
    var th = target ? target.h : this.canvas.height;
    w = Math.max(1, Math.min(w, tw));
    h = Math.max(1, Math.min(h, th));
    x = Math.max(0, Math.min(tw - w, Math.round(x)));
    y = Math.max(0, Math.min(th - h, Math.round(y)));
    var buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { data: buf, width: w, height: h, x: x, y: y };
  };

  /** 回读结果转成 2D canvas（自动上下翻转），用于 PNG 导出 */
  GLCore.prototype.toCanvas = function (target, out) {
    var px = this.readPixels(target);
    var w = px.width, h = px.height;
    var cv = out || document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    var src = px.data, dst = img.data;
    var rowBytes = w * 4;
    for (var y = 0; y < h; y++) {
      var srcOff = (h - 1 - y) * rowBytes;
      var dstOff = y * rowBytes;
      for (var x = 0; x < rowBytes; x++) dst[dstOff + x] = src[srcOff + x];
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };

  D.GLCore = GLCore;
})(typeof window !== 'undefined' ? window : globalThis);
