/* =====================================================================
 * GL — WebGL2 上下文封装：程序编译、缓冲区、状态缓存、网格对象
 * ===================================================================== */

export class GLContext {
  constructor(canvas, opts = {}) {
    const attrs = {
      alpha: false,
      antialias: opts.antialias ?? false,
      depth: true,
      stencil: false,
      // 注意：desynchronized 在部分 GPU/驱动上与 DOM 覆盖层合成时会整屏闪烁，故默认关闭
      desynchronized: opts.desynchronized ?? false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
      failIfMajorPerformanceCaveat: false,
    };
    const gl = canvas.getContext('webgl2', attrs);
    if (!gl) throw new Error('WEBGL2_UNSUPPORTED');
    this.gl = gl;
    this.canvas = canvas;
    this.width = 0; this.height = 0;
    this.pixelRatio = 1;

    // 扩展
    this.ext = {
      aniso: gl.getExtension('EXT_texture_filter_anisotropic'),
      lose: gl.getExtension('WEBGL_lose_context'),
      float: gl.getExtension('EXT_color_buffer_float'),
      timer: gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    };
    this.maxAniso = this.ext.aniso ? gl.getParameter(this.ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

    // 状态缓存（避免冗余 GL 调用）
    this._state = {
      program: null, vao: null, blend: null, depthTest: null, depthMask: null,
      cull: null, cullFace: null, blendFunc: null,
    };

    this.info = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxArrayLayers: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
    };

    // 默认状态
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  /** 调整绘制缓冲大小；返回是否发生变化 */
  resize(cssWidth, cssHeight, scale = 1) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(cssWidth * dpr * scale));
    const h = Math.max(1, Math.floor(cssHeight * dpr * scale));
    if (w === this.width && h === this.height) return false;
    this.width = w; this.height = h;
    this.pixelRatio = dpr * scale;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    return true;
  }

  get aspect() { return this.width / Math.max(1, this.height); }

  // ---------------- 状态封装 ----------------
  useProgram(p) {
    if (this._state.program === p) return;
    this._state.program = p;
    this.gl.useProgram(p);
  }
  bindVAO(v) {
    if (this._state.vao === v) return;
    this._state.vao = v;
    this.gl.bindVertexArray(v);
  }
  setBlend(on, src = null, dst = null) {
    const gl = this.gl;
    if (this._state.blend !== on) {
      this._state.blend = on;
      if (on) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    }
    if (on && src !== null) {
      const key = src * 100000 + dst;
      if (this._state.blendFunc !== key) {
        this._state.blendFunc = key;
        gl.blendFunc(src, dst);
      }
    }
  }
  setDepthTest(on) {
    const gl = this.gl;
    if (this._state.depthTest === on) return;
    this._state.depthTest = on;
    if (on) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
  }
  setDepthMask(on) {
    if (this._state.depthMask === on) return;
    this._state.depthMask = on;
    this.gl.depthMask(on);
  }
  setCull(on, face = null) {
    const gl = this.gl;
    if (this._state.cull !== on) {
      this._state.cull = on;
      if (on) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    }
    if (on && face !== null && this._state.cullFace !== face) {
      this._state.cullFace = face;
      gl.cullFace(face);
    }
  }

  clear(r, g, b, a = 1) {
    const gl = this.gl;
    gl.clearColor(r, g, b, a);
    this.setDepthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
}

/* ==================================================================== *
 *  Program — 着色器程序 + 自动 uniform 定位
 * ==================================================================== */
export class Program {
  constructor(glc, vsSource, fsSource, name = 'program') {
    this.glc = glc;
    this.name = name;
    const gl = glc.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource, name + '.vert');
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource, name + '.frag');
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      throw new Error(`[GL] 程序链接失败 ${name}: ${log}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = p;

    // uniform / attribute 位置表
    this.u = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) {
      const info = gl.getActiveUniform(p, i);
      const base = info.name.replace(/\[0\]$/, '');
      this.u[base] = gl.getUniformLocation(p, info.name);
    }
    this.a = {};
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) {
      const info = gl.getActiveAttrib(p, i);
      this.a[info.name] = gl.getAttribLocation(p, info.name);
    }
  }

  use() { this.glc.useProgram(this.program); return this; }

  // 便捷 uniform 设置（位置不存在时静默跳过）
  m4(n, v) { const l = this.u[n]; if (l) this.glc.gl.uniformMatrix4fv(l, false, v); return this; }
  f(n, v) { const l = this.u[n]; if (l !== undefined && l !== null) this.glc.gl.uniform1f(l, v); return this; }
  i(n, v) { const l = this.u[n]; if (l !== undefined && l !== null) this.glc.gl.uniform1i(l, v); return this; }
  v2(n, x, y) { const l = this.u[n]; if (l) this.glc.gl.uniform2f(l, x, y); return this; }
  v3(n, x, y, z) {
    const l = this.u[n]; if (!l) return this;
    if (Array.isArray(x) || x instanceof Float32Array) this.glc.gl.uniform3fv(l, x);
    else this.glc.gl.uniform3f(l, x, y, z);
    return this;
  }
  v4(n, x, y, z, w) { const l = this.u[n]; if (l) this.glc.gl.uniform4f(l, x, y, z, w); return this; }

  destroy() { this.glc.gl.deleteProgram(this.program); }
}

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const lines = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join('\n');
    console.error(`[GL] 着色器编译失败 ${label}:\n${log}\n${lines}`);
    throw new Error(`[GL] 着色器编译失败 ${label}: ${log}`);
  }
  return sh;
}

/* ==================================================================== *
 *  Mesh — VAO + 顶点/索引缓冲
 * ==================================================================== */
export class Mesh {
  /**
   * @param {GLContext} glc
   * @param {Array<{name:string,size:number,type?:number,offset:number,stride:number,integer?:boolean}>} layout
   */
  constructor(glc, layout) {
    this.glc = glc;
    const gl = glc.gl;
    this.layout = layout;
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.ibo = null;
    this.vertexCount = 0;
    this.indexCount = 0;
    this.byteSize = 0;
    this.indexType = gl.UNSIGNED_INT;
  }

  /** 上传顶点数据（Float32Array）与索引（Uint32Array 可选） */
  upload(program, vertices, indices = null, dynamic = false) {
    const gl = this.glc.gl;
    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, usage);
    this.byteSize = vertices.byteLength;

    for (const attr of this.layout) {
      const loc = program.a[attr.name];
      if (loc === undefined || loc < 0) continue;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, attr.size, attr.type ?? gl.FLOAT, false, attr.stride, attr.offset);
    }

    if (indices) {
      if (!this.ibo) this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, usage);
      this.indexCount = indices.length;
      this.indexType = indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
      this.byteSize += indices.byteLength;
    } else {
      this.indexCount = 0;
    }
    const floatsPerVertex = this.layout[0] ? this.layout[0].stride / 4 : 1;
    this.vertexCount = vertices.length / floatsPerVertex;
    gl.bindVertexArray(null);
    return this;
  }

  /**
   * 使用共享索引缓冲上传（所有四边形网格共用同一个 IBO，省显存）
   * @param {WebGLBuffer} sharedIbo 已填充 0,1,2,0,2,3,… 的 ELEMENT_ARRAY_BUFFER
   */
  uploadShared(program, vertices, sharedIbo, indexCount, dynamic = false) {
    const gl = this.glc.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    for (const attr of this.layout) {
      const loc = program.a[attr.name];
      if (loc === undefined || loc < 0) continue;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, attr.size, attr.type ?? gl.FLOAT, false, attr.stride, attr.offset);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sharedIbo);
    gl.bindVertexArray(null);
    this.indexCount = indexCount;
    this.indexType = gl.UNSIGNED_INT;
    this.byteSize = vertices.byteLength;
    const floatsPerVertex = this.layout[0] ? this.layout[0].stride / 4 : 1;
    this.vertexCount = vertices.length / floatsPerVertex;
    this.shared = true;
    return this;
  }

  draw(mode = null) {
    const gl = this.glc.gl;
    if (this.indexCount === 0 && this.vertexCount === 0) return 0;
    this.glc.bindVAO(this.vao);
    const m = mode ?? gl.TRIANGLES;
    if (this.indexCount > 0) {
      gl.drawElements(m, this.indexCount, this.indexType, 0);
      return this.indexCount / 3;
    }
    gl.drawArrays(m, 0, this.vertexCount);
    return this.vertexCount / 3;
  }

  destroy() {
    const gl = this.glc.gl;
    gl.deleteBuffer(this.vbo);
    if (this.ibo && !this.shared) gl.deleteBuffer(this.ibo);
    gl.deleteVertexArray(this.vao);
    this.vertexCount = this.indexCount = 0;
  }
}

/** 生成共享的四边形索引缓冲（0,1,2, 0,2,3 …） */
export function makeQuadIndices(quadCount) {
  const arr = new Uint32Array(quadCount * 6);
  for (let q = 0, i = 0, v = 0; q < quadCount; q++, v += 4) {
    arr[i++] = v; arr[i++] = v + 1; arr[i++] = v + 2;
    arr[i++] = v; arr[i++] = v + 2; arr[i++] = v + 3;
  }
  return arr;
}
