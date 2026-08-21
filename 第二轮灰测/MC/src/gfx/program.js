/**
 * gfx/program.js
 * ------------------------------------------------------------------
 * Shader program compilation with readable error reporting plus cached
 * uniform/attribute lookup and thin `setX` helpers.
 */

function compileStage(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`[${label}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader failed:\n${log}\n${numberLines(source, log)}`);
  }
  return shader;
}

/** Annotates the offending source lines so GLSL errors are actionable. */
function numberLines(source, log) {
  const bad = new Set();
  for (const m of log.matchAll(/:(\d+):/g)) bad.add(Number(m[1]));
  return source
    .split('\n')
    .map((line, i) => `${bad.has(i + 1) ? '>>' : '  '}${String(i + 1).padStart(4)} | ${line}`)
    .filter((_, i) => bad.size === 0 || [...bad].some((b) => Math.abs(b - (i + 1)) <= 4))
    .join('\n');
}

/** A compiled program with cached uniform locations. */
export class Program {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {{name: string, vertex: string, fragment: string}} desc
   */
  constructor(gl, { name, vertex, fragment }) {
    this.gl = gl;
    this.name = name;
    const vs = compileStage(gl, gl.VERTEX_SHADER, vertex, name);
    const fs = compileStage(gl, gl.FRAGMENT_SHADER, fragment, name);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`[${name}] program link failed:\n${log}`);
    }
    this.handle = prog;

    /** @type {Map<string, WebGLUniformLocation|null>} */
    this.uniforms = new Map();
    const uniformCount = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      const base = info.name.replace(/\[0\]$/, '');
      this.uniforms.set(base, gl.getUniformLocation(prog, info.name));
    }

    /** @type {Map<string, number>} */
    this.attribs = new Map();
    const attribCount = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < attribCount; i++) {
      const info = gl.getActiveAttrib(prog, i);
      if (!info) continue;
      this.attribs.set(info.name, gl.getAttribLocation(prog, info.name));
    }
  }

  use() {
    this.gl.useProgram(this.handle);
    return this;
  }

  loc(name) {
    return this.uniforms.get(name) ?? null;
  }

  attrib(name) {
    const a = this.attribs.get(name);
    return a === undefined ? -1 : a;
  }

  /* --- uniform setters (silently ignore optimised-out uniforms) --- */

  int(name, v) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  float(name, v) { const l = this.loc(name); if (l) this.gl.uniform1f(l, v); return this; }
  vec2(name, x, y) { const l = this.loc(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  vec3(name, x, y, z) {
    const l = this.loc(name);
    if (!l) return this;
    if (typeof x === 'number') this.gl.uniform3f(l, x, y, z);
    else this.gl.uniform3fv(l, x);
    return this;
  }

  vec4(name, x, y, z, w) {
    const l = this.loc(name);
    if (!l) return this;
    if (typeof x === 'number') this.gl.uniform4f(l, x, y, z, w);
    else this.gl.uniform4fv(l, x);
    return this;
  }

  mat4(name, m) { const l = this.loc(name); if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
  floats(name, arr) { const l = this.loc(name); if (l) this.gl.uniform1fv(l, arr); return this; }
  vec3Array(name, arr) { const l = this.loc(name); if (l) this.gl.uniform3fv(l, arr); return this; }

  /** Binds `texture` to `unit` and points the sampler uniform at it. */
  texture(name, unit, target, texture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, texture);
    this.int(name, unit);
    return this;
  }

  dispose() {
    this.gl.deleteProgram(this.handle);
  }
}

/** Prefix shared by every shader in the project. */
export const GLSL_HEADER = '#version 300 es\nprecision highp float;\nprecision highp int;\n';

/** Builds a Program, injecting the common header and optional #defines. */
export function buildProgram(gl, { name, vertex, fragment, defines = {} }) {
  const defs = Object.entries(defines)
    .map(([k, v]) => `#define ${k} ${v}`)
    .join('\n');
  const prelude = GLSL_HEADER + (defs ? `${defs}\n` : '');
  return new Program(gl, {
    name,
    vertex: prelude + vertex,
    fragment: prelude + fragment,
  });
}
