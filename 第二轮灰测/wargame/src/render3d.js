/* ============================================================================
 * render3d.js —— 纯 WebGL2 三维兵棋沙盘（零依赖）
 *   · 六角棱柱地形（按地形抬升、按国别着色）+ 网格描边
 *   · 要点标记（核设施/基地/港口/首都/海峡/油气）与双方"棋子"
 *   · 打击弹道抛物线、拦截闪光、命中冲击波
 *   · 提供拾取与三维→屏幕投影（供 HTML 标签层使用）
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENDER3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------- 矩阵/向量 ------------------------------- */
  const M4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      } return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
      return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
    },
    look(eye, ctr, up) {
      const z = nrm(sub(eye, ctr)), x = nrm(crs(up, z)), y = crs(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    },
    inv(m) {
      const a = m, inv = new Float32Array(16);
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
      const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
      const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
      const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!d) return M4.ident(); d = 1 / d;
      inv[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; inv[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
      inv[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; inv[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
      inv[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; inv[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
      inv[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; inv[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
      inv[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; inv[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
      inv[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; inv[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
      inv[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; inv[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
      inv[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; inv[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
      return inv;
    }
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const hex2rgb = h => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

  /* ------------------------------- 着色器 ------------------------------- */
  const VS_SOLID = `#version 300 es
  precision highp float;
  in vec3 a_pos; in vec3 a_nrm; in vec3 a_col; in vec2 a_meta;   // meta.x=hexId, meta.y=kind
  uniform mat4 u_vp; uniform float u_selHex; uniform float u_hlHex[64]; uniform int u_hlN;
  uniform float u_time;
  out vec3 v_nrm; out vec3 v_col; out vec3 v_pos; out float v_kind; out float v_glow;
  void main() {
    vec3 p = a_pos;
    float glow = 0.0;
    if (abs(a_meta.x - u_selHex) < 0.5) glow = 1.0;
    for (int i = 0; i < 64; i++) { if (i >= u_hlN) break; if (abs(a_meta.x - u_hlHex[i]) < 0.5) glow = max(glow, 0.55); }
    if (a_meta.y > 2.5) p.y += 0.06 * sin(u_time * 2.2 + a_pos.x * 0.7);   // 棋子轻微浮动
    v_nrm = a_nrm; v_col = a_col; v_pos = p; v_kind = a_meta.y; v_glow = glow;
    gl_Position = u_vp * vec4(p, 1.0);
  }`;
  const FS_SOLID = `#version 300 es
  precision highp float;
  in vec3 v_nrm; in vec3 v_col; in vec3 v_pos; in float v_kind; in float v_glow;
  uniform vec3 u_eye; uniform float u_time;
  out vec4 o;
  void main() {
    vec3 n = normalize(v_nrm);
    vec3 L = normalize(vec3(-0.42, 0.88, 0.52));
    float d = dot(n, L) * 0.5 + 0.5;
    float band = d > 0.80 ? 1.04 : (d > 0.58 ? 0.92 : (d > 0.38 ? 0.78 : 0.66));
    vec3 col = v_col * band;
    vec3 V = normalize(u_eye - v_pos);
    col += vec3(0.35, 0.55, 0.85) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.32;
    if (v_kind < 0.5) {                        // 海域：轻微波光
      col += vec3(0.05, 0.12, 0.2) * (0.5 + 0.5 * sin(v_pos.x * 1.7 + v_pos.z * 1.3 + u_time * 1.4));
    }
    col += vec3(1.0, 0.86, 0.35) * v_glow * (0.22 + 0.14 * sin(u_time * 4.0));
    float fog = clamp((length(u_eye - v_pos) - 32.0) / 52.0, 0.0, 0.55);
    col = mix(col, vec3(0.045, 0.06, 0.10), fog);
    o = vec4(col, 1.0);
  }`;
  const VS_LINE = `#version 300 es
  precision highp float;
  in vec3 a_pos; in vec4 a_col;
  uniform mat4 u_vp;
  out vec4 v_col;
  void main() { v_col = a_col; gl_Position = u_vp * vec4(a_pos, 1.0); }`;
  const FS_LINE = `#version 300 es
  precision highp float;
  in vec4 v_col; out vec4 o;
  void main() { o = v_col; }`;
  const VS_SPR = `#version 300 es
  precision highp float;
  in vec3 a_pos; in vec2 a_off; in vec4 a_col; in float a_size;
  uniform mat4 u_vp; uniform vec3 u_right; uniform vec3 u_up;
  out vec4 v_col; out vec2 v_uv;
  void main() {
    v_col = a_col; v_uv = a_off;
    vec3 p = a_pos + u_right * a_off.x * a_size + u_up * a_off.y * a_size;
    gl_Position = u_vp * vec4(p, 1.0);
  }`;
  const FS_SPR = `#version 300 es
  precision highp float;
  in vec4 v_col; in vec2 v_uv; out vec4 o;
  void main() {
    float r = length(v_uv);
    float ring = smoothstep(1.0, 0.72, r) * smoothstep(0.30, 0.62, r);
    float core = smoothstep(0.55, 0.0, r);
    float a = max(ring * 0.95, core);
    if (a < 0.02) discard;
    o = vec4(v_col.rgb, v_col.a * a);
  }`;

  function sh(gl, t, src) {
    const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function prog(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  /* ------------------------------- 六角布局 ------------------------------- */
  const SIZE = 1.0, SQ3 = Math.sqrt(3);
  const hexWorld = (c, r) => [SQ3 * SIZE * (c + 0.5 * (r & 1)), 0, 1.5 * SIZE * r];
  function worldToHex(x, z) {
    const r = Math.round(z / (1.5 * SIZE));
    const c = Math.round(x / (SQ3 * SIZE) - 0.5 * (r & 1));
    // 邻域微调（避免边界误判）
    let best = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc, rr = r + dr, w = hexWorld(cc, rr);
      const d = (w[0] - x) ** 2 + (w[2] - z) ** 2;
      if (!best || d < best.d) best = { c: cc, r: rr, d };
    }
    return best;
  }
  const HEX_ANG = [];
  for (let i = 0; i < 6; i++) HEX_ANG.push(Math.PI / 2 + i * Math.PI / 3);

  /* ------------------------------- 渲染器 ------------------------------- */
  function createRenderer(canvas, ENGINE, SCEN) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('需要支持 WebGL2 的浏览器');
    const pSolid = prog(gl, VS_SOLID, FS_SOLID), pLine = prog(gl, VS_LINE, FS_LINE), pSpr = prog(gl, VS_SPR, FS_SPR);

    /* ---- 静态地形几何 ---- */
    const hexIndex = new Map();       // key -> id
    ENGINE.MAP.hexes.forEach((h, i) => hexIndex.set(h.key, i));
    const SV = { pos: [], nrm: [], col: [], meta: [] };
    function pushTri(A, B, C, n, col, meta) {
      [A, B, C].forEach(p => { SV.pos.push(p[0], p[1], p[2]); SV.nrm.push(n[0], n[1], n[2]); SV.col.push(col[0], col[1], col[2]); SV.meta.push(meta[0], meta[1]); });
    }
    function prism(cx, cz, y0, y1, size, col, meta, sideDark) {
      const top = [], bot = [];
      for (let i = 0; i < 6; i++) {
        const a = HEX_ANG[i];
        top.push([cx + Math.cos(a) * size, y1, cz + Math.sin(a) * size]);
        bot.push([cx + Math.cos(a) * size, y0, cz + Math.sin(a) * size]);
      }
      const ctr = [cx, y1, cz];
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        pushTri(ctr, top[j], top[i], [0, 1, 0], col, meta);
        const sc = [col[0] * sideDark, col[1] * sideDark, col[2] * sideDark];
        const a = HEX_ANG[i], nx = Math.cos((a + HEX_ANG[j]) / 2), nz = Math.sin((a + HEX_ANG[j]) / 2);
        const n = nrm([nx, 0.25, nz]);
        pushTri(top[i], bot[i], bot[j], n, sc, meta);
        pushTri(top[i], bot[j], top[j], n, sc, meta);
      }
    }
    const lineData = [];
    ENGINE.MAP.hexes.forEach((h, i) => {
      const w = hexWorld(h.c, h.r);
      const isSea = h.terrain.id === 'sea' || h.terrain.id === 'strait';
      let col = hex2rgb(h.nation.color);
      const lift = h.terrain.h;
      const boost = isSea ? 1.05 : 1.30;              // 陆地适度提亮，便于识别国别
      col = [Math.min(1, col[0] * boost + 0.05), Math.min(1, col[1] * boost + 0.05), Math.min(1, col[2] * boost + 0.05)];
      if (h.terrain.id === 'urban') col = [Math.min(1, col[0] * 1.15 + 0.12), Math.min(1, col[1] * 1.1 + 0.11), Math.min(1, col[2] * 1.05 + 0.10)];
      if (h.terrain.id === 'mountain') col = [col[0] * 0.86, col[1] * 0.86, col[2] * 0.9];
      if (h.terrain.id === 'strait') col = [0.22, 0.55, 0.78];
      prism(w[0], w[2], -0.6, lift, SIZE * 0.955, col, [i, isSea ? 0 : 1], 0.62);
      // 顶面描边
      for (let k = 0; k < 6; k++) {
        const a1 = HEX_ANG[k], a2 = HEX_ANG[(k + 1) % 6];
        const y = lift + 0.012;
        const c = isSea ? [0.35, 0.6, 0.8, 0.30] : [0.08, 0.10, 0.14, 0.55];
        lineData.push(w[0] + Math.cos(a1) * SIZE * 0.955, y, w[2] + Math.sin(a1) * SIZE * 0.955, c[0], c[1], c[2], c[3]);
        lineData.push(w[0] + Math.cos(a2) * SIZE * 0.955, y, w[2] + Math.sin(a2) * SIZE * 0.955, c[0], c[1], c[2], c[3]);
      }
    });
    const mapVertCount = SV.pos.length / 3;

    /* ---- 要点与棋子（动态几何，状态变化时重建）---- */
    function box(cx, y0, cz, w, h, col, meta) {
      const x0 = cx - w, x1 = cx + w, z0 = cz - w, z1 = cz + w, y1 = y0 + h;
      const q = (a, b, c, d, n) => { pushTri(a, b, c, n, col, meta); pushTri(a, c, d, n, col, meta); };
      q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
      q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
      q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    }
    function cone(cx, y0, cz, rad, h, col, meta, seg) {
      seg = seg || 8;
      const apex = [cx, y0 + h, cz];
      for (let i = 0; i < seg; i++) {
        const a1 = i / seg * Math.PI * 2, a2 = (i + 1) / seg * Math.PI * 2;
        const p1 = [cx + Math.cos(a1) * rad, y0, cz + Math.sin(a1) * rad];
        const p2 = [cx + Math.cos(a2) * rad, y0, cz + Math.sin(a2) * rad];
        pushTri(p1, p2, apex, nrm([Math.cos((a1 + a2) / 2), 0.6, Math.sin((a1 + a2) / 2)]), col, meta);
        pushTri([cx, y0, cz], p2, p1, [0, -1, 0], col, meta);
      }
    }
    function chip(cx, y0, cz, rad, h, col, meta) {
      const top = [], bot = [];
      for (let i = 0; i < 6; i++) {
        const a = HEX_ANG[i];
        top.push([cx + Math.cos(a) * rad, y0 + h, cz + Math.sin(a) * rad]);
        bot.push([cx + Math.cos(a) * rad, y0, cz + Math.sin(a) * rad]);
      }
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        pushTri([cx, y0 + h, cz], top[j], top[i], [0, 1, 0], col, meta);
        const sc = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
        pushTri(top[i], bot[i], bot[j], nrm([Math.cos(HEX_ANG[i]), 0.3, Math.sin(HEX_ANG[i])]), sc, meta);
        pushTri(top[i], bot[j], top[j], nrm([Math.cos(HEX_ANG[i]), 0.3, Math.sin(HEX_ANG[i])]), sc, meta);
      }
    }

    const BLUE = hex2rgb('#3f7dff'), RED = hex2rgb('#e2483d'), NEU = hex2rgb('#c9c2a8');
    let dynStart = 0, dynCount = 0, tokens = [];   // tokens: {kind,id,pos:[x,y,z]}
    function rebuildDynamic(state) {
      SV.pos.length = mapVertCount * 3; SV.nrm.length = mapVertCount * 3;
      SV.col.length = mapVertCount * 3; SV.meta.length = mapVertCount * 2;
      dynStart = mapVertCount;
      tokens = [];
      // 要点
      state.sites.forEach(s => {
        const h = ENGINE.MAP.byKey.get(s.c + ',' + s.r); if (!h) return;
        const w = hexWorld(s.c, s.r), y = h.terrain.h + 0.02, id = hexIndex.get(h.key);
        const col = s.side === 'blue' ? BLUE : s.side === 'red' ? RED : NEU;
        const dm = 1 - 0.5 * (s.dmg / 100);
        const c = [col[0] * dm + 0.12, col[1] * dm + 0.12, col[2] * dm + 0.12];
        if (s.kind === 'nuke') cone(w[0], y, w[2], 0.30, 0.62, c, [id, 3]);
        else if (s.kind === 'base') box(w[0], y, w[2], 0.24, 0.34, c, [id, 3]);
        else if (s.kind === 'capital') { box(w[0], y, w[2], 0.20, 0.5, c, [id, 3]); cone(w[0], y + 0.5, w[2], 0.2, 0.24, c, [id, 3]); }
        else if (s.kind === 'port') box(w[0], y, w[2], 0.26, 0.18, c, [id, 3]);
        else if (s.kind === 'oil') { box(w[0], y, w[2], 0.16, 0.46, c, [id, 3]); }
        else if (s.kind === 'strait') cone(w[0], y + 0.34, w[2], 0.26, -0.34, [1, 0.78, 0.25], [id, 3], 6);
        else box(w[0], y, w[2], 0.18, 0.2, c, [id, 3]);
        tokens.push({ kind: 'site', id: s.id, pos: [w[0], y + 0.66, w[2]] });
      });
      // 棋子（同格多单位错开摆放）
      const perHex = new Map();
      state.units.forEach(u => {
        if (!ENGINE.unitActive(u)) return;
        const h = ENGINE.MAP.byKey.get(u.c + ',' + u.r); if (!h) return;
        const k = u.c + ',' + u.r, n = perHex.get(k) || 0; perHex.set(k, n + 1);
        const w = hexWorld(u.c, u.r);
        const ang = n * 1.05 + (u.side === 'blue' ? 0 : Math.PI);
        const rad = n === 0 ? 0 : 0.34;
        const x = w[0] + Math.cos(ang) * rad, z = w[2] + Math.sin(ang) * rad;
        const y = h.terrain.h + 0.05 + n * 0.015;
        const base = u.side === 'blue' ? BLUE : RED;
        const life = 0.45 + 0.55 * (u.hp / u.maxHp);
        const col = [base[0] * life, base[1] * life, base[2] * life];
        chip(x, y, z, 0.26, 0.16, col, [hexIndex.get(h.key), 3]);
        // 顶面小标记：类型高度不同的针状体
        const mark = { air: 0.42, bmb: 0.52, msl: 0.46, uav: 0.3, ad: 0.34, nav: 0.26, grd: 0.22, cyb: 0.3 }[u.type] || 0.3;
        cone(x, y + 0.16, z, 0.1, mark, [Math.min(1, col[0] + 0.35), Math.min(1, col[1] + 0.35), Math.min(1, col[2] + 0.35)], [hexIndex.get(h.key), 3], 5);
        tokens.push({ kind: 'unit', id: u.id, pos: [x, y + 0.16 + mark + 0.12, z] });
      });
      dynCount = SV.pos.length / 3 - dynStart;
      upload();
    }

    /* ---- GL 缓冲 ---- */
    const vao = gl.createVertexArray();
    const buf = { pos: gl.createBuffer(), nrm: gl.createBuffer(), col: gl.createBuffer(), meta: gl.createBuffer() };
    function bind(b, loc, n, data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const l = gl.getAttribLocation(pSolid, loc);
      if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }
    }
    function upload() {
      gl.bindVertexArray(vao);
      bind(buf.pos, 'a_pos', 3, new Float32Array(SV.pos));
      bind(buf.nrm, 'a_nrm', 3, new Float32Array(SV.nrm));
      bind(buf.col, 'a_col', 3, new Float32Array(SV.col));
      bind(buf.meta, 'a_meta', 2, new Float32Array(SV.meta));
      gl.bindVertexArray(null);
    }
    // 线条
    const lvao = gl.createVertexArray(), lbuf = gl.createBuffer();
    gl.bindVertexArray(lvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineData), gl.DYNAMIC_DRAW);
    let lp = gl.getAttribLocation(pLine, 'a_pos'), lc = gl.getAttribLocation(pLine, 'a_col');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    const staticLineCount = lineData.length / 7;
    // 动态线（弹道）
    const dvao = gl.createVertexArray(), dbuf = gl.createBuffer();
    gl.bindVertexArray(dvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(6000 * 7), gl.DYNAMIC_DRAW);
    lp = gl.getAttribLocation(pLine, 'a_pos'); lc = gl.getAttribLocation(pLine, 'a_col');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    // 精灵（闪光）
    const svao = gl.createVertexArray(), sbuf = gl.createBuffer();
    gl.bindVertexArray(svao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(4000 * 10), gl.DYNAMIC_DRAW);
    const sp = gl.getAttribLocation(pSpr, 'a_pos'), so = gl.getAttribLocation(pSpr, 'a_off'),
      sc = gl.getAttribLocation(pSpr, 'a_col'), ss = gl.getAttribLocation(pSpr, 'a_size');
    gl.enableVertexAttribArray(sp); gl.vertexAttribPointer(sp, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(so); gl.vertexAttribPointer(so, 2, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(sc); gl.vertexAttribPointer(sc, 4, gl.FLOAT, false, 40, 20);
    gl.enableVertexAttribArray(ss); gl.vertexAttribPointer(ss, 1, gl.FLOAT, false, 40, 36);
    gl.bindVertexArray(null);

    /* ---- 相机 ---- */
    // 依据地图实际世界范围自动取景（否则南部红海/阿拉伯海会落在视野外）
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    ENGINE.MAP.hexes.forEach(h => {
      const w = hexWorld(h.c, h.r);
      bx0 = Math.min(bx0, w[0]); bx1 = Math.max(bx1, w[0]);
      bz0 = Math.min(bz0, w[2]); bz1 = Math.max(bz1, w[2]);
    });
    const spanX = bx1 - bx0, spanZ = bz1 - bz0;
    // 让整幅地图落进竖直视场（0.72 rad）：dist ≈ 外接圆半径 / tan(半视场)
    const fitR = 0.5 * Math.hypot(spanX, spanZ);
    const cam = {
      yaw: 0.24, pitch: 0.82,
      dist: Math.min(72, Math.max(26, (fitR * 0.92) / Math.tan(0.36))),
      cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2
    };
    let W = 1, H = 1, vp = M4.ident(), ivp = M4.ident(), eye = [0, 20, 20], right = [1, 0, 0], upv = [0, 1, 0];
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 600;
      W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    }
    function updateCam() {
      const cp = Math.cos(cam.pitch), sp2 = Math.sin(cam.pitch);
      const ctr = [cam.cx, 0, cam.cz];
      eye = [ctr[0] + Math.sin(cam.yaw) * cp * cam.dist, sp2 * cam.dist, ctr[2] + Math.cos(cam.yaw) * cp * cam.dist];
      const proj = M4.persp(0.72, W / H, 0.35, 200);
      const view = M4.look(eye, ctr, [0, 1, 0]);
      vp = M4.mul(proj, view); ivp = M4.inv(vp);
      const fwd = nrm(sub(ctr, eye));
      right = nrm(crs([0, 1, 0], fwd)); upv = nrm(crs(fwd, right));
    }

    /* ---- 特效队列 ---- */
    const fx = [];    // {kind:'arc'|'flash'|'ring', ...}
    function addArc(from, to, side, opts) {
      const a = hexWorld(from[0], from[1]), b = hexWorld(to[0], to[1]);
      const ha = (ENGINE.MAP.byKey.get(from.join(',')) || { terrain: { h: 0.3 } }).terrain.h;
      const hb = (ENGINE.MAP.byKey.get(to.join(',')) || { terrain: { h: 0.3 } }).terrain.h;
      fx.push(Object.assign({
        kind: 'arc', t0: performance.now(), dur: 850, side,
        a: [a[0], ha + 0.35, a[2]], b: [b[0], hb + 0.35, b[2]]
      }, opts || {}));
    }
    function addFlash(hex, color, size, delay) {
      const w = hexWorld(hex[0], hex[1]);
      const h = (ENGINE.MAP.byKey.get(hex.join(',')) || { terrain: { h: 0.3 } }).terrain.h;
      fx.push({ kind: 'flash', t0: performance.now() + (delay || 0), dur: 620, p: [w[0], h + 0.5, w[2]], color, size: size || 1.4 });
    }
    const clearFx = () => { fx.length = 0; };

    /* ---- 绘制 ---- */
    let highlight = { sel: -1, list: [] };
    function setHighlight(selKey, keys) {
      highlight.sel = selKey && hexIndex.has(selKey) ? hexIndex.get(selKey) : -1;
      highlight.list = (keys || []).map(k => hexIndex.get(k)).filter(v => v !== undefined).slice(0, 64);
    }
    function draw(nowMs) {
      resize(); updateCam();
      const t = nowMs * 0.001;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.035, 0.048, 0.075, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);     // 六角棱柱/标记体量很小，直接靠深度测试，避免绕序问题
      gl.disable(gl.BLEND);

      gl.useProgram(pSolid);
      gl.uniformMatrix4fv(gl.getUniformLocation(pSolid, 'u_vp'), false, vp);
      gl.uniform3f(gl.getUniformLocation(pSolid, 'u_eye'), eye[0], eye[1], eye[2]);
      gl.uniform1f(gl.getUniformLocation(pSolid, 'u_time'), t);
      gl.uniform1f(gl.getUniformLocation(pSolid, 'u_selHex'), highlight.sel);
      gl.uniform1i(gl.getUniformLocation(pSolid, 'u_hlN'), highlight.list.length);
      if (highlight.list.length) gl.uniform1fv(gl.getUniformLocation(pSolid, 'u_hlHex'), new Float32Array(highlight.list));
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, mapVertCount + dynCount);
      gl.bindVertexArray(null);

      // 网格线
      gl.useProgram(pLine);
      gl.uniformMatrix4fv(gl.getUniformLocation(pLine, 'u_vp'), false, vp);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(lvao);
      gl.drawArrays(gl.LINES, 0, staticLineCount);
      gl.bindVertexArray(null);

      // 弹道
      const now = performance.now();
      const arcs = [];
      const sprites = [];
      for (let i = fx.length - 1; i >= 0; i--) {
        const e = fx[i];
        const p = (now - e.t0) / e.dur;
        if (p < 0) continue;
        if (p > 1) { fx.splice(i, 1); continue; }
        if (e.kind === 'arc') {
          const peak = 1.6 + Math.hypot(e.b[0] - e.a[0], e.b[2] - e.a[2]) * 0.18;
          const seg = 26, head = p;
          const col = e.side === 'blue' ? [0.45, 0.72, 1] : [1, 0.5, 0.35];
          for (let k = 0; k < seg; k++) {
            const u1 = (k / seg) * head, u2 = ((k + 1) / seg) * head;
            const q = u => [e.a[0] + (e.b[0] - e.a[0]) * u, e.a[1] + (e.b[1] - e.a[1]) * u + peak * 4 * u * (1 - u), e.a[2] + (e.b[2] - e.a[2]) * u];
            const p1 = q(u1), p2 = q(u2);
            const fade = 0.25 + 0.75 * (k / seg);
            arcs.push(p1[0], p1[1], p1[2], col[0], col[1], col[2], fade * 0.9);
            arcs.push(p2[0], p2[1], p2[2], col[0], col[1], col[2], fade * 0.9);
          }
          const q = u => [e.a[0] + (e.b[0] - e.a[0]) * u, e.a[1] + (e.b[1] - e.a[1]) * u + peak * 4 * u * (1 - u), e.a[2] + (e.b[2] - e.a[2]) * u];
          const hp = q(head);
          sprites.push({ p: hp, col: [col[0], col[1], col[2], 0.95], size: 0.45 });
        } else if (e.kind === 'flash') {
          const s = e.size * (0.4 + 2.2 * p);
          sprites.push({ p: e.p, col: [e.color[0], e.color[1], e.color[2], (1 - p) * 0.95], size: s });
        }
      }
      if (arcs.length) {
        gl.bindVertexArray(dvao);
        gl.bindBuffer(gl.ARRAY_BUFFER, dbuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(arcs));
        gl.drawArrays(gl.LINES, 0, Math.min(6000, arcs.length / 7));
        gl.bindVertexArray(null);
      }
      // 精灵
      if (sprites.length) {
        const arr = [];
        sprites.forEach(s => {
          const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
          quad.forEach(o => arr.push(s.p[0], s.p[1], s.p[2], o[0], o[1], s.col[0], s.col[1], s.col[2], s.col[3], s.size));
        });
        gl.useProgram(pSpr);
        gl.uniformMatrix4fv(gl.getUniformLocation(pSpr, 'u_vp'), false, vp);
        gl.uniform3f(gl.getUniformLocation(pSpr, 'u_right'), right[0], right[1], right[2]);
        gl.uniform3f(gl.getUniformLocation(pSpr, 'u_up'), upv[0], upv[1], upv[2]);
        gl.depthMask(false);
        gl.bindVertexArray(svao);
        gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(arr.slice(0, 4000 * 10)));
        gl.drawArrays(gl.TRIANGLES, 0, Math.min(4000, arr.length / 10));
        gl.bindVertexArray(null);
        gl.depthMask(true);
      }
      gl.disable(gl.BLEND);
    }

    /* ---- 拾取 / 投影 ---- */
    function ray(px, py) {
      const x = (px / (canvas.clientWidth || 1)) * 2 - 1, y = 1 - (py / (canvas.clientHeight || 1)) * 2;
      const un = z => {
        const v = [x, y, z, 1], o = new Float32Array(4);
        for (let i = 0; i < 4; i++) o[i] = ivp[i] * v[0] + ivp[4 + i] * v[1] + ivp[8 + i] * v[2] + ivp[12 + i] * v[3];
        return [o[0] / o[3], o[1] / o[3], o[2] / o[3]];
      };
      const a = un(-1), b = un(1);
      return { o: a, d: nrm(sub(b, a)) };
    }
    function pickHex(px, py) {
      const { o, d } = ray(px, py);
      if (Math.abs(d[1]) < 1e-6) return null;
      const t = (0.32 - o[1]) / d[1];
      if (t <= 0) return null;
      const p = [o[0] + d[0] * t, 0, o[2] + d[2] * t];
      const h = worldToHex(p[0], p[2]);
      const key = h.c + ',' + h.r;
      return ENGINE.MAP.byKey.has(key) ? { c: h.c, r: h.r, key } : null;
    }
    function project(p) {
      const o = new Float32Array(4);
      for (let i = 0; i < 4; i++) o[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i];
      if (o[3] <= 0) return null;
      return [(o[0] / o[3] * 0.5 + 0.5) * (canvas.clientWidth || 1), (1 - (o[1] / o[3] * 0.5 + 0.5)) * (canvas.clientHeight || 1)];
    }
    function labelPositions() { return tokens.map(tk => ({ kind: tk.kind, id: tk.id, screen: project(tk.pos) })); }

    return {
      gl, cam, draw, resize, rebuildDynamic, setHighlight, pickHex, project, labelPositions,
      addArc, addFlash, clearFx, hexWorld, size: () => [canvas.clientWidth, canvas.clientHeight],
      fxCount: () => fx.length
    };
  }

  return { createRenderer, M4, hexWorld };
});
