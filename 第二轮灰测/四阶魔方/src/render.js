/* ============================================================================
 * render.js —— 纯 WebGL2 动漫卡线（Cel + Outline）渲染器，零依赖
 *   · 主通道：三阶色阶卡通着色 + 边缘光 + 块状高光
 *   · 描边通道：逐块反向外壳（Inverted Hull）+ 正面剔除 → 手绘卡线感
 *   · 背景通道：渐变 + 放射集中线（动漫演出感）
 *   · 转层动画完全在顶点着色器完成（按 cubie 坐标判定是否属于转动层）
 * ==========================================================================*/
(function (root, factory) {
  const api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./cube4.js') : root.CUBE4);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENDER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  /* ------------------------------ 矩阵工具 ------------------------------ */
  const M4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    lookAt(eye, center, up) {
      const z = norm(sub(eye, center)), x = norm(cross(up, z)), y = cross(z, x);
      return new Float32Array([
        x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    },
    invert(m) {
      const inv = new Float32Array(16), a = m;
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
      const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
      const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
      const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return M4.ident();
      det = 1 / det;
      inv[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
      inv[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
      inv[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
      inv[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
      inv[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
      inv[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
      inv[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
      inv[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
      inv[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
      inv[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
      inv[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
      inv[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
      inv[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
      inv[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
      inv[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
      inv[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
      return inv;
    }
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /* ------------------------------ 着色器 ------------------------------ */
  const VS_MAIN = `#version 300 es
  precision highp float;
  in vec3 a_pos; in vec3 a_nrm; in vec3 a_cell; in float a_fid; in float a_kind; in float a_edge;
  uniform mat4 u_vp;
  uniform int u_axis; uniform int u_mask; uniform float u_angle;
  uniform float u_expand;              // 描边外壳膨胀量
  uniform vec3 u_stick[96];            // 96 张贴纸颜色
  uniform vec3 u_bodyCol;
  out vec3 v_nrm; out vec3 v_col; out vec3 v_wpos; out float v_kind; out float v_edge;
  void main() {
    vec3 p = a_pos; vec3 n = a_nrm;
    if (u_expand > 0.0) {               // 反向外壳：按 cubie 中心缩放
      vec3 c = a_cell - 1.5;
      p = c + (p - c) * (1.0 + u_expand);
    }
    if (u_axis >= 0) {
      float lay = a_axis_pick(a_cell, u_axis);
      int li = int(lay + 0.5);
      if (((u_mask >> li) & 1) == 1) {
        float s = sin(u_angle), c2 = cos(u_angle);
        if (u_axis == 0) { p = vec3(p.x, c2 * p.y - s * p.z, s * p.y + c2 * p.z); n = vec3(n.x, c2 * n.y - s * n.z, s * n.y + c2 * n.z); }
        else if (u_axis == 1) { p = vec3(c2 * p.x + s * p.z, p.y, -s * p.x + c2 * p.z); n = vec3(c2 * n.x + s * n.z, n.y, -s * n.x + c2 * n.z); }
        else { p = vec3(c2 * p.x - s * p.y, s * p.x + c2 * p.y, p.z); n = vec3(c2 * n.x - s * n.y, s * n.x + c2 * n.y, n.z); }
      }
    }
    v_nrm = n; v_wpos = p; v_kind = a_kind; v_edge = a_edge;
    v_col = a_fid >= 0.0 ? u_stick[int(a_fid)] : u_bodyCol;
    gl_Position = u_vp * vec4(p, 1.0);
  }`;

  const FS_MAIN = `#version 300 es
  precision highp float;
  in vec3 v_nrm; in vec3 v_col; in vec3 v_wpos; in float v_kind; in float v_edge;
  uniform vec3 u_eye; uniform float u_flat; uniform float u_time;
  out vec4 o_col;
  void main() {
    if (u_flat > 0.5) { o_col = vec4(v_col, 1.0); return; }   // 描边通道：纯色
    vec3 n = normalize(v_nrm);
    vec3 L = normalize(vec3(-0.45, 0.86, 0.62));
    vec3 V = normalize(u_eye - v_wpos);
    float d = dot(n, L) * 0.5 + 0.5;
    // 三阶色阶（卡通）
    float band = d > 0.78 ? 1.00 : (d > 0.55 ? 0.88 : (d > 0.36 ? 0.72 : 0.56));
    vec3 col = v_col * band;
    // 边缘光（动漫描边高光）
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    col += vec3(0.66, 0.82, 1.0) * rim * 0.30;
    // 贴纸内部轻微边缘压暗：手绘塑料质感
    col *= mix(1.0, 0.84, pow(v_edge, 2.5) * v_kind);
    // 动漫式"扫光"：只在左上前方一小片区域出现块状高光，而不是整面过曝
    float sw = dot(normalize(v_wpos + n * 0.55), normalize(vec3(-0.62, 1.0, 0.80)));
    col += vec3(1.0) * smoothstep(0.88, 0.95, sw) * 0.26 * v_kind * (1.0 - 0.7 * v_edge);
    o_col = vec4(pow(min(col, vec3(1.35)), vec3(0.94)), 1.0);
  }`;

  const VS_BG = `#version 300 es
  precision highp float;
  in vec2 a_p; out vec2 v_uv;
  void main() { v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;

  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 o_col;
  uniform float u_time; uniform vec2 u_res;
  void main() {
    vec2 uv = v_uv;
    vec3 top = vec3(0.086, 0.106, 0.170);
    vec3 bot = vec3(0.043, 0.055, 0.098);
    vec3 col = mix(bot, top, smoothstep(0.0, 1.0, uv.y));
    vec2 c = (uv - vec2(0.5, 0.52)) * vec2(u_res.x / u_res.y, 1.0);
    float r = length(c);
    // 中心光晕
    col += vec3(0.16, 0.24, 0.42) * smoothstep(0.75, 0.0, r) * 0.55;
    // 放射集中线（动漫演出）
    float ang = atan(c.y, c.x);
    float rays = sin(ang * 34.0 + u_time * 0.12) * 0.5 + 0.5;
    col += vec3(0.30, 0.44, 0.70) * pow(rays, 6.0) * smoothstep(0.22, 0.95, r) * 0.20;
    // 暗角
    col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.55;
    o_col = vec4(col, 1.0);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }

  /* ------------------------------ 几何构建 ------------------------------ */
  const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function buildGeometry(opts) {
    const cs = opts.cell, sk = opts.sticker, rad = opts.radius, lift = opts.lift;
    const pos = [], nrm = [], cell = [], fid = [], kind = [], edge = [];
    // 贴纸查找：(cubie + 法向) -> fid
    const lookup = new Map();
    for (const g of C.GEOM) lookup.set(g.i + ',' + g.j + ',' + g.k + '|' + g.n.join(','), g.fid);

    const pushTri = (a, b, c, n, cl, f, k, eg) => {
      const e = eg || [0, 0, 0];
      [a, b, c].forEach((p, ix) => {
        pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]);
        cell.push(cl[0], cl[1], cl[2]); fid.push(f); kind.push(k); edge.push(e[ix]);
      });
    };
    const bodyRanges = { start: 0, count: 0 };

    // ---- 1. 块体（黑色底座）：先放，便于描边通道单独绘制
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      if (i > 0 && i < 3 && j > 0 && j < 3 && k > 0 && k < 3) continue;   // 内部不可见
      const c = [i - 1.5, j - 1.5, k - 1.5], cl = [i, j, k];
      for (let ax = 0; ax < 3; ax++) for (const s of [1, -1]) {
        const n = [AXES[ax][0] * s, AXES[ax][1] * s, AXES[ax][2] * s];
        const u = AXES[(ax + 1) % 3], v = AXES[(ax + 2) % 3];
        const h = cs / 2;
        const ctr = [c[0] + n[0] * h, c[1] + n[1] * h, c[2] + n[2] * h];
        const P = (a, b) => [ctr[0] + u[0] * a * h + v[0] * b * h, ctr[1] + u[1] * a * h + v[1] * b * h, ctr[2] + u[2] * a * h + v[2] * b * h];
        const q = s > 0 ? [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)] : [P(-1, -1), P(-1, 1), P(1, 1), P(1, -1)];
        pushTri(q[0], q[1], q[2], n, cl, -1, 0);
        pushTri(q[0], q[2], q[3], n, cl, -1, 0);
      }
    }
    bodyRanges.count = pos.length / 3;

    // ---- 2. 贴纸（圆角方块，动漫描边风格）
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      const cl = [i, j, k], c = [i - 1.5, j - 1.5, k - 1.5];
      for (let ax = 0; ax < 3; ax++) for (const s of [1, -1]) {
        const idx = ax === 0 ? i : ax === 1 ? j : k;
        if (!(s > 0 ? idx === 3 : idx === 0)) continue;    // 只有最外层才有贴纸
        const n = [AXES[ax][0] * s, AXES[ax][1] * s, AXES[ax][2] * s];
        const f = lookup.get(i + ',' + j + ',' + k + '|' + n.join(','));
        if (f === undefined) continue;
        const u = AXES[(ax + 1) % 3], v = AXES[(ax + 2) % 3];
        const off = cs / 2 + lift;
        const ctr = [c[0] + n[0] * off, c[1] + n[1] * off, c[2] + n[2] * off];
        // 圆角方块边界点
        const pts = [];
        const hh = sk / 2, r = rad;
        const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
        const SEG = 5;
        for (const [sx, sy] of corners) {
          const cx = sx * (hh - r), cy = sy * (hh - r);
          const base = Math.atan2(sy, sx) - Math.PI / 4;
          for (let t = 0; t <= SEG; t++) {
            const a = base + (t / SEG) * (Math.PI / 2);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
        }
        const toW = (a, b) => [ctr[0] + u[0] * a + v[0] * b, ctr[1] + u[1] * a + v[1] * b, ctr[2] + u[2] * a + v[2] * b];
        const flip = s > 0;
        for (let t = 0; t < pts.length; t++) {
          const p1 = pts[t], p2 = pts[(t + 1) % pts.length];
          const A = toW(0, 0), B = toW(p1[0], p1[1]), D = toW(p2[0], p2[1]);
          if (flip) pushTri(A, B, D, n, cl, f, 1, [0, 1, 1]); else pushTri(A, D, B, n, cl, f, 1, [0, 1, 1]);
        }
      }
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm), cell: new Float32Array(cell),
      fid: new Float32Array(fid), kind: new Float32Array(kind), edge: new Float32Array(edge),
      bodyCount: bodyRanges.count, total: pos.length / 3
    };
  }

  /* ------------------------------ 渲染器 ------------------------------ */
  function createRenderer(canvas, palette) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('当前浏览器不支持 WebGL2');

    // a_axis_pick 辅助函数注入
    const vsMain = VS_MAIN.replace('float lay = a_axis_pick(a_cell, u_axis);',
      'float lay = u_axis == 0 ? a_cell.x : (u_axis == 1 ? a_cell.y : a_cell.z);');
    const progMain = program(gl, vsMain, FS_MAIN);
    const progBg = program(gl, VS_BG, FS_BG);

    const G = buildGeometry({ cell: 0.955, sticker: 0.80, radius: 0.15, lift: 0.014 });
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const mkBuf = (data, loc, n) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l = gl.getAttribLocation(progMain, loc);
      if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }
      return b;
    };
    mkBuf(G.pos, 'a_pos', 3); mkBuf(G.nrm, 'a_nrm', 3); mkBuf(G.cell, 'a_cell', 3);
    mkBuf(G.fid, 'a_fid', 1); mkBuf(G.kind, 'a_kind', 1); mkBuf(G.edge, 'a_edge', 1);
    gl.bindVertexArray(null);

    const bgVao = gl.createVertexArray();
    gl.bindVertexArray(bgVao);
    const bgBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const bl = gl.getAttribLocation(progBg, 'a_p');
    gl.enableVertexAttribArray(bl); gl.vertexAttribPointer(bl, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const U = n => gl.getUniformLocation(progMain, n);
    const uni = {
      vp: U('u_vp'), axis: U('u_axis'), mask: U('u_mask'), angle: U('u_angle'),
      expand: U('u_expand'), stick: U('u_stick'), body: U('u_bodyCol'),
      eye: U('u_eye'), flat: U('u_flat'), time: U('u_time')
    };
    const uBg = { time: gl.getUniformLocation(progBg, 'u_time'), res: gl.getUniformLocation(progBg, 'u_res') };

    const stickColors = new Float32Array(96 * 3);
    const pal = (palette || C.FACE_COLORS).map(hexToRgb);
    function hexToRgb(h) {
      const v = parseInt(h.slice(1), 16);
      return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    }
    function setState(state) {
      for (let i = 0; i < 96; i++) {
        const c = pal[state[i]] || [0.1, 0.1, 0.1];
        stickColors[i * 3] = c[0]; stickColors[i * 3 + 1] = c[1]; stickColors[i * 3 + 2] = c[2];
      }
    }

    const cam = { yaw: -0.62, pitch: 0.52, dist: 10.2, fov: 0.62 };
    let anim = { axis: -1, mask: 0, angle: 0 };
    let vp = M4.ident(), invVp = M4.ident(), eye = [0, 0, 10];
    let W = 1, H = 1, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
      W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    }
    function updateCamera() {
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      eye = [Math.sin(cam.yaw) * cp * cam.dist, sp * cam.dist, Math.cos(cam.yaw) * cp * cam.dist];
      const proj = M4.perspective(cam.fov, W / H, 0.1, 100);
      const view = M4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
      vp = M4.mul(proj, view);
      invVp = M4.invert(vp);
    }

    function draw(timeMs) {
      resize(); updateCamera();
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(progBg);
      gl.uniform1f(uBg.time, timeMs * 0.001); gl.uniform2f(uBg.res, W, H);
      gl.bindVertexArray(bgVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.CULL_FACE);
      gl.useProgram(progMain);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uni.vp, false, vp);
      gl.uniform3fv(uni.stick, stickColors);
      gl.uniform3f(uni.eye, eye[0], eye[1], eye[2]);
      gl.uniform1i(uni.axis, anim.axis);
      gl.uniform1i(uni.mask, anim.mask);
      gl.uniform1f(uni.angle, anim.angle);
      gl.uniform1f(uni.time, timeMs * 0.001);

      // 描边通道：外壳 + 正面剔除
      gl.cullFace(gl.FRONT);
      gl.uniform1f(uni.expand, 0.085);
      gl.uniform1f(uni.flat, 1.0);
      gl.uniform3f(uni.body, 0.02, 0.025, 0.045);
      gl.drawArrays(gl.TRIANGLES, 0, G.bodyCount);

      // 主通道
      gl.cullFace(gl.BACK);
      gl.uniform1f(uni.expand, 0.0);
      gl.uniform1f(uni.flat, 0.0);
      gl.uniform3f(uni.body, 0.075, 0.082, 0.11);
      gl.drawArrays(gl.TRIANGLES, 0, G.total);
      gl.bindVertexArray(null);
    }

    /* ---------------- 拾取：射线 vs 魔方六个外表面 ---------------- */
    function rayFrom(px, py) {
      const x = (px / (canvas.clientWidth || 1)) * 2 - 1;
      const y = 1 - (py / (canvas.clientHeight || 1)) * 2;
      const un = (z) => {
        const v = [x, y, z, 1], o = new Float32Array(4);
        for (let i = 0; i < 4; i++) o[i] = invVp[0 * 4 + i] * v[0] + invVp[1 * 4 + i] * v[1] + invVp[2 * 4 + i] * v[2] + invVp[3 * 4 + i] * v[3];
        return [o[0] / o[3], o[1] / o[3], o[2] / o[3]];
      };
      const p0 = un(-1), p1 = un(1);
      return { o: p0, d: norm(sub(p1, p0)) };
    }
    function pick(px, py) {
      const { o, d } = rayFrom(px, py);
      const HALF = 2.0;
      let best = null;
      for (let ax = 0; ax < 3; ax++) for (const s of [1, -1]) {
        if (Math.abs(d[ax]) < 1e-6) continue;
        const t = (s * HALF - o[ax]) / d[ax];
        if (t <= 0) continue;
        const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
        const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
        if (Math.abs(p[a1]) > HALF || Math.abs(p[a2]) > HALF) continue;
        if (d[ax] * s > 0) continue;      // 背面
        if (!best || t < best.t) {
          const cellIdx = [0, 0, 0];
          for (let q = 0; q < 3; q++) cellIdx[q] = Math.max(0, Math.min(3, Math.floor(p[q] + HALF)));
          cellIdx[ax] = s > 0 ? 3 : 0;
          best = { t, axis: ax, sign: s, point: p, cell: cellIdx };
        }
      }
      return best;
    }
    // 世界方向在屏幕上的像素方向
    function screenDir(point, dir) {
      const proj = p => {
        const o = new Float32Array(4);
        for (let i = 0; i < 4; i++) o[i] = vp[0 * 4 + i] * p[0] + vp[1 * 4 + i] * p[1] + vp[2 * 4 + i] * p[2] + vp[3 * 4 + i];
        return [(o[0] / o[3] * 0.5 + 0.5) * (canvas.clientWidth || 1), (1 - (o[1] / o[3] * 0.5 + 0.5)) * (canvas.clientHeight || 1)];
      };
      const a = proj(point);
      const b = proj([point[0] + dir[0] * 0.35, point[1] + dir[1] * 0.35, point[2] + dir[2] * 0.35]);
      return [b[0] - a[0], b[1] - a[1]];
    }

    // 世界坐标 -> 屏幕像素（供自动化验收使用）
    function project(p) {
      const o = new Float32Array(4);
      for (let i = 0; i < 4; i++) o[i] = vp[0 * 4 + i] * p[0] + vp[1 * 4 + i] * p[1] + vp[2 * 4 + i] * p[2] + vp[3 * 4 + i];
      return [(o[0] / o[3] * 0.5 + 0.5) * (canvas.clientWidth || 1), (1 - (o[1] / o[3] * 0.5 + 0.5)) * (canvas.clientHeight || 1)];
    }
    // 贴纸中心的世界坐标 + 法向（用于验证"贴纸颜色 <-> 屏幕像素"一致性）
    function faceletCenter(fid) {
      const g = C.GEOM[fid];
      const c = [g.i - 1.5, g.j - 1.5, g.k - 1.5];
      const off = 0.955 / 2 + 0.014;
      return { p: [c[0] + g.n[0] * off, c[1] + g.n[1] * off, c[2] + g.n[2] * off], n: g.n.slice() };
    }
    function eyePos() { return eye.slice(); }

    setState(C.solvedState());
    return {
      gl, cam, draw, resize, setState, pick, screenDir, project, faceletCenter, eyePos,
      setAnim(a) { anim = a || { axis: -1, mask: 0, angle: 0 }; },
      getAnim: () => anim,
      size: () => [canvas.clientWidth, canvas.clientHeight]
    };
  }

  return { createRenderer, M4 };
});
