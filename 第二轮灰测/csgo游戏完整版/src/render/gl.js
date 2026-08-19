// ---------------------------------------------------------------------------
// WebGL2 薄封装：着色器、VAO、纹理、帧缓冲
// ---------------------------------------------------------------------------

export function createGL(canvas) {
  const opts = {
    alpha: false, antialias: true, depth: true, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'high-performance', desynchronized: true,
  };
  const gl = canvas.getContext('webgl2', opts);
  if (!gl) throw new Error('本游戏需要 WebGL2 支持，请使用最新版 Chrome / Edge / Firefox。');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  gl.anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.maxAniso = gl.anisoExt ? gl.getParameter(gl.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
  return gl;
}

export class Shader {
  constructor(gl, vsSrc, fsSrc, name = 'shader') {
    this.gl = gl;
    this.name = name;
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, name + '.vert');
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, name + '.frag');
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`[${name}] 链接失败: ` + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = p;
    this.uniforms = new Map();
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      this.uniforms.set(nm, gl.getUniformLocation(p, nm));
    }
  }
  use() { this.gl.useProgram(this.program); return this; }
  loc(name) { return this.uniforms.has(name) ? this.uniforms.get(name) : null; }
  m4(name, v) { const l = this.loc(name); if (l) this.gl.uniformMatrix4fv(l, false, v); return this; }
  m3(name, v) { const l = this.loc(name); if (l) this.gl.uniformMatrix3fv(l, false, v); return this; }
  v2(name, x, y) { const l = this.loc(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  v3(name, a, b, c) {
    const l = this.loc(name); if (!l) return this;
    if (b === undefined) this.gl.uniform3f(l, a[0], a[1], a[2]);
    else this.gl.uniform3f(l, a, b, c);
    return this;
  }
  v4(name, a, b, c, d) {
    const l = this.loc(name); if (!l) return this;
    if (b === undefined) this.gl.uniform4f(l, a[0], a[1], a[2], a[3]);
    else this.gl.uniform4f(l, a, b, c, d);
    return this;
  }
  f(name, v) { const l = this.loc(name); if (l) this.gl.uniform1f(l, v); return this; }
  i(name, v) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  fv(name, v) { const l = this.loc(name); if (l) this.gl.uniform1fv(l, v); return this; }
  v3v(name, v) { const l = this.loc(name); if (l) this.gl.uniform3fv(l, v); return this; }
  /** 绑定纹理到指定 unit 并设置 sampler */
  tex(name, texture, unit, target) {
    const gl = this.gl;
    const l = this.loc(name); if (l === null) return this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, texture);
    gl.uniform1i(l, unit);
    return this;
  }
}

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    const lines = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join('\n');
    console.error(`[${label}] 编译失败\n${log}\n${lines}`);
    throw new Error(`[${label}] 编译失败: ${log}`);
  }
  return s;
}

/** 创建静态 VBO */
export function createBuffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  gl.bindBuffer(target, null);
  return b;
}

/**
 * attribs: [{ buffer, loc, size, type?, normalized?, stride?, offset?, divisor? }]
 */
export function createVAO(gl, attribs, indexBuffer = null) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const a of attribs) {
    gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
    gl.enableVertexAttribArray(a.loc);
    const type = a.type || gl.FLOAT;
    if (type === gl.UNSIGNED_BYTE && a.integer) {
      gl.vertexAttribIPointer(a.loc, a.size, type, a.stride || 0, a.offset || 0);
    } else {
      gl.vertexAttribPointer(a.loc, a.size, type, !!a.normalized, a.stride || 0, a.offset || 0);
    }
    if (a.divisor) gl.vertexAttribDivisor(a.loc, a.divisor);
  }
  if (indexBuffer) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vao;
}

/** 从 canvas / ImageData 创建 2D 纹理 */
export function createTexture(gl, source, opts = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, opts.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const wrap = opts.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (opts.mipmap !== false) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (gl.anisoExt && gl.maxAniso > 1) {
      gl.texParameterf(gl.TEXTURE_2D, gl.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.maxAniso));
    }
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

/** 1x1 纯色纹理 */
export function solidTexture(gl, r, g, b, a = 255) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

/** 阴影贴图：深度纹理 + FBO */
export function createShadowMap(gl, size) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { tex, fbo, size };
}

/** 动态顶点缓冲（用于粒子/线条/贴花） */
export class DynamicBuffer {
  constructor(gl, floatsPerVertex, maxVertices) {
    this.gl = gl;
    this.fpv = floatsPerVertex;
    this.max = maxVertices;
    this.data = new Float32Array(floatsPerVertex * maxVertices);
    this.count = 0;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  reset() { this.count = 0; }
  get room() { return this.max - this.count; }
  push(...vals) {
    if (this.count >= this.max) return false;
    this.data.set(vals, this.count * this.fpv);
    this.count++;
    return true;
  }
  /** 直接写入位置，返回可写偏移 */
  alloc(n) {
    if (this.count + n > this.max) return -1;
    const off = this.count * this.fpv;
    this.count += n;
    return off;
  }
  upload() {
    if (!this.count) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * this.fpv);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
