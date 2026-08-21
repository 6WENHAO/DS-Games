/**
 * gfx/shader.js —— 着色器程序封装
 *
 * 提供：#define 注入、编译错误的带行号定位、uniform 位置缓存、
 * 以及带脏值检查的 uniform 设置器（避免每帧重复上传相同数据）。
 */

export class Program {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {string} vs 顶点着色器源码（不含 #version）
   * @param {string} fs 片元着色器源码（不含 #version）
   * @param {object} [opts]
   * @param {Record<string, string|number|boolean>} [opts.defines]
   * @param {string} [opts.name]
   */
  constructor(gl, vs, fs, { defines = {}, name = 'program' } = {}) {
    this.gl = gl;
    this.name = name;
    const header = '#version 300 es\n' + Object.entries(defines)
      .filter(([, v]) => v !== false && v !== undefined && v !== null)
      .map(([k, v]) => `#define ${k} ${v === true ? 1 : v}\n`).join('');

    const vso = compile(gl, gl.VERTEX_SHADER, header + vs, `${name}.vert`);
    const fso = compile(gl, gl.FRAGMENT_SHADER, header + fs, `${name}.frag`);
    const p = gl.createProgram();
    gl.attachShader(p, vso);
    gl.attachShader(p, fso);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(`[${name}] 程序链接失败：\n${log}`);
    }
    gl.deleteShader(vso);
    gl.deleteShader(fso);
    this.program = p;

    /** @type {Map<string, WebGLUniformLocation|null>} */
    this._loc = new Map();
    /** @type {Map<string, any>} */
    this._cache = new Map();

    // 记录实际存在的 uniform，便于自检与调试
    this.uniforms = new Set();
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      if (info) this.uniforms.add(info.name.replace(/\[0\]$/, ''));
    }
  }

  use() { this.gl.useProgram(this.program); return this; }

  loc(nameStr) {
    let l = this._loc.get(nameStr);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, nameStr);
      this._loc.set(nameStr, l);
    }
    return l;
  }

  /* ── 标量 / 向量 / 矩阵设置器（带脏值检查） ── */

  int(n, v) { const l = this.loc(n); if (l && this._dirty(n, v)) this.gl.uniform1i(l, v); return this; }
  float(n, v) { const l = this.loc(n); if (l && this._dirty(n, v)) this.gl.uniform1f(l, v); return this; }
  vec2(n, x, y) { const l = this.loc(n); if (l) this.gl.uniform2f(l, x, y); return this; }
  vec3(n, x, y, z) {
    const l = this.loc(n); if (!l) return this;
    if (typeof x === 'number') this.gl.uniform3f(l, x, y, z);
    else this.gl.uniform3fv(l, x);
    return this;
  }
  vec4(n, x, y, z, w) { const l = this.loc(n); if (l) this.gl.uniform4f(l, x, y, z, w); return this; }
  mat3(n, m) { const l = this.loc(n); if (l) this.gl.uniformMatrix3fv(l, false, m); return this; }
  mat4(n, m) { const l = this.loc(n); if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
  floats(n, arr) { const l = this.loc(n); if (l) this.gl.uniform1fv(l, arr); return this; }
  vec2s(n, arr) { const l = this.loc(n); if (l) this.gl.uniform2fv(l, arr); return this; }
  vec3s(n, arr) { const l = this.loc(n); if (l) this.gl.uniform3fv(l, arr); return this; }

  /** 绑定纹理到指定纹理单元并设置 sampler uniform */
  texture(n, unit, tex, target = null) {
    const gl = this.gl;
    const l = this.loc(n);
    if (!l) return this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, tex);
    if (this._dirty(`__s_${n}`, unit)) gl.uniform1i(l, unit);
    return this;
  }

  _dirty(k, v) {
    if (this._cache.get(k) === v) return false;
    this._cache.set(k, v);
    return true;
  }

  /** 切换程序后缓存可能失效（同一 program 对象则无需清理） */
  invalidate() { this._cache.clear(); return this; }

  dispose() { this.gl.deleteProgram(this.program); }
}

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    gl.deleteShader(s);
    throw new Error(`[${label}] 编译失败：\n${log}\n\n${numberLines(src, log)}`);
  }
  return s;
}

/** 只打印出错行附近的源码，避免控制台被上千行 GLSL 淹没 */
function numberLines(src, log) {
  const lines = src.split('\n');
  const bad = new Set();
  for (const m of log.matchAll(/:(\d+):/g)) bad.add(parseInt(m[1], 10));
  if (bad.size === 0) return lines.map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).slice(0, 60).join('\n');
  const keep = new Set();
  for (const b of bad) for (let i = b - 4; i <= b + 4; i++) keep.add(i);
  return lines
    .map((l, i) => (keep.has(i + 1) ? `${bad.has(i + 1) ? '>>' : '  '}${String(i + 1).padStart(4)} | ${l}` : null))
    .filter(Boolean).join('\n');
}
