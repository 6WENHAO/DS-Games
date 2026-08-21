/* ============================================================
   紫禁城体素沙盘 — 极简数学库 + WebGL2 封装（零依赖）
   ============================================================ */
'use strict';

/* ---------- vec3 ---------- */
const V3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  set(o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; },
  copy(o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
  add(o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
  sub(o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
  scale(o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
  scaleAdd(o, a, b, s) { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm(o, a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
  },
  cross(o, a, b) {
    const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  },
  lerp(o, a, b, t) { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; },
};

/* ---------- mat4 (column-major, WebGL 约定) ---------- */
const M4 = {
  create: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  identity(o) { o.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); return o; },
  copy(o, a) { o.set(a); return o; },
  mul(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.set([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    return o;
  },
  ortho(o, l, r, b, t, n, f) {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o.set([-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, 2 * nf, 0,
      (l + r) * lr, (t + b) * bt, (f + n) * nf, 1]);
    return o;
  },
  lookAt(o, eye, center, up) {
    let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    let l = Math.hypot(z0, z1, z2) || 1; z0 /= l; z1 /= l; z2 /= l;
    let x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
    l = Math.hypot(x0, x1, x2);
    if (!l) { x0 = 1; x1 = 0; x2 = 0; } else { x0 /= l; x1 /= l; x2 /= l; }
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o.set([x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0,
      -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
      -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
      -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]), 1]);
    return o;
  },
  invert(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  /** 变换点（w=1，返回 NDC 需自行除 w） */
  xformPoint(out4, m, p) {
    out4[0] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    out4[1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    out4[2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    out4[3] = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return out4;
  },
};

/* ---------- 视锥体（从 viewProj 提取 6 平面） ---------- */
class Frustum {
  constructor() { this.p = new Float32Array(24); }
  fromMatrix(m) {
    const p = this.p;
    const rows = [
      [m[0], m[4], m[8], m[12]],
      [m[1], m[5], m[9], m[13]],
      [m[2], m[6], m[10], m[14]],
      [m[3], m[7], m[11], m[15]],
    ];
    const put = (i, a, b, s) => {
      for (let k = 0; k < 4; k++) p[i * 4 + k] = rows[3][k] + s * rows[a][k];
      const l = Math.hypot(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]) || 1;
      for (let k = 0; k < 4; k++) p[i * 4 + k] /= l;
      void b;
    };
    put(0, 0, 0, 1); put(1, 0, 0, -1);
    put(2, 1, 0, 1); put(3, 1, 0, -1);
    put(4, 2, 0, 1); put(5, 2, 0, -1);
    return this;
  }
  /** AABB 与视锥体相交测试 */
  boxVisible(x0, y0, z0, x1, y1, z1) {
    const p = this.p;
    for (let i = 0; i < 6; i++) {
      const a = p[i * 4], b = p[i * 4 + 1], c = p[i * 4 + 2], d = p[i * 4 + 3];
      const px = a > 0 ? x1 : x0, py = b > 0 ? y1 : y0, pz = c > 0 ? z1 : z0;
      if (a * px + b * py + c * pz + d < 0) return false;
    }
    return true;
  }
}

/* ---------- GL 工具 ---------- */
const GLX = {
  shader(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error('[shader:' + name + ']\n' + log + '\n' +
        src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('着色器编译失败 ' + name + ': ' + log);
    }
    return s;
  },
  program(gl, vs, fs, name = 'prog') {
    const p = gl.createProgram();
    gl.attachShader(p, GLX.shader(gl, gl.VERTEX_SHADER, vs, name + '.vert'));
    gl.attachShader(p, GLX.shader(gl, gl.FRAGMENT_SHADER, fs, name + '.frag'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('程序链接失败 ' + name + ': ' + gl.getProgramInfoLog(p));
    }
    // 收集 uniform 位置
    p.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      p.u[nm] = gl.getUniformLocation(p, info.name);
    }
    return p;
  },
  buffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, usage);
    return b;
  },
};

window.V3 = V3; window.M4 = M4; window.Frustum = Frustum; window.GLX = GLX;
