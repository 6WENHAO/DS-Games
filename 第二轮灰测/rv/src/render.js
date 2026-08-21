/* ============================================================================
 * render.js —— WebGL2 渲染器：方向光阴影贴图 + 半球环境光 + 室内点光 + 透明玻璃
 *   分组可见性用于"剖切视图"；支持线框、昼夜、投影取点（HTML 标签层）
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENDER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------ 矩阵 ------------------------------ */
  const M4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      } return o;
    },
    persp(f, a, n, fa) {
      const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa);
      return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]);
    },
    ortho(l, r, b, t, n, f) {
      return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0,
        -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },
    look(e, c, u) {
      const z = nrm(sub(e, c)), x = nrm(crs(u, z)), y = crs(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, e), -dot(y, e), -dot(z, e), 1]);
    },
    inv(m) {
      const a = m, o = new Float32Array(16);
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
      const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
      const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
      const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!d) return M4.ident(); d = 1 / d;
      o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
      o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
      o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
      o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
      o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
      o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
      o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
      o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
      return o;
    }
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /* ------------------------------ 着色器 ------------------------------ */
  const VS = `#version 300 es
  precision highp float;
  in vec3 a_pos; in vec3 a_nrm; in vec3 a_col; in vec3 a_mat;
  uniform mat4 u_vp; uniform mat4 u_lightVP;
  out vec3 v_pos; out vec3 v_nrm; out vec3 v_col; out vec3 v_mat; out vec4 v_lpos;
  void main() {
    v_pos = a_pos; v_nrm = a_nrm; v_col = a_col; v_mat = a_mat;
    v_lpos = u_lightVP * vec4(a_pos, 1.0);
    gl_Position = u_vp * vec4(a_pos, 1.0);
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec3 v_pos; in vec3 v_nrm; in vec3 v_col; in vec3 v_mat; in vec4 v_lpos;
  uniform vec3 u_eye, u_sunDir, u_sunCol, u_skyCol, u_gndCol, u_fogCol, u_dustCol;
  uniform float u_ambient, u_alpha, u_dust, u_fogDens, u_night, u_flat;
  uniform vec3 u_pl0, u_pl1, u_plCol; uniform float u_plPow;
  uniform sampler2D u_shadow; uniform float u_shadowTexel, u_shadowOn;
  out vec4 o_col;

  float shadowFactor() {
    if (u_shadowOn < 0.5) return 1.0;
    vec3 p = v_lpos.xyz / v_lpos.w;
    p = p * 0.5 + 0.5;
    if (p.x < 0.002 || p.x > 0.998 || p.y < 0.002 || p.y > 0.998 || p.z > 1.0) return 1.0;
    float ndl = max(dot(normalize(v_nrm), u_sunDir), 0.0);
    float bias = max(0.0016 * (1.0 - ndl), 0.00035);
    float sum = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      float d = texture(u_shadow, p.xy + vec2(float(i), float(j)) * u_shadowTexel).r;
      sum += (p.z - bias > d) ? 0.0 : 1.0;
    }
    return sum / 9.0;
  }
  vec3 pointLight(vec3 lp, vec3 N, vec3 V, vec3 albedo, float rough) {
    vec3 d = lp - v_pos; float dist = length(d);
    vec3 L = d / max(dist, 0.001);
    float att = u_plPow / (0.35 + dist * dist * 0.55);
    float ndl = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(N, H), 0.0), mix(10.0, 160.0, 1.0 - rough)) * 0.35;
    return (albedo * ndl + vec3(sp)) * u_plCol * att;
  }
  void main() {
    vec3 N = normalize(v_nrm);
    vec3 V = normalize(u_eye - v_pos);
    if (dot(N, V) < 0.0 && u_alpha < 0.99) N = -N;      // 玻璃双面
    vec3 albedo = v_col;
    float rough = clamp(v_mat.x, 0.03, 1.0), metal = clamp(v_mat.y, 0.0, 1.0), emis = v_mat.z;
    // 落尘：朝上且靠近地面的表面积灰
    float dust = clamp(0.55 - v_pos.y * 0.22, 0.0, 0.45) * max(0.0, N.y) * u_dust;
    albedo = mix(albedo, u_dustCol, dust);
    float sh = shadowFactor();
    float ndl = max(dot(N, u_sunDir), 0.0);
    vec3 amb = mix(u_gndCol, u_skyCol, N.y * 0.5 + 0.5) * u_ambient;
    vec3 col = albedo * amb;
    col += albedo * u_sunCol * ndl * sh;
    vec3 H = normalize(u_sunDir + V);
    float spec = pow(max(dot(N, H), 0.0), mix(10.0, 240.0, 1.0 - rough));
    col += u_sunCol * spec * (0.05 + metal * 0.95) * sh;
    col += pointLight(u_pl0, N, V, albedo, rough);
    col += pointLight(u_pl1, N, V, albedo, rough);
    col += albedo * emis * (1.0 + u_night * 1.6) + vec3(emis * 0.25);
    // 边缘光（让曲面轮廓更清晰）
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    col += mix(u_skyCol, u_plCol, u_night) * fres * 0.35;
    float d = length(u_eye - v_pos);
    col = mix(col, u_fogCol, clamp((d - 12.0) * u_fogDens, 0.0, 0.85));
    if (u_flat > 0.5) col = albedo * (0.35 + 0.65 * ndl);
    col = pow(max(col, vec3(0.0)), vec3(0.86));           // 轻度提亮
    o_col = vec4(col, u_alpha);
  }`;
  const VS_DEPTH = `#version 300 es
  precision highp float;
  in vec3 a_pos; uniform mat4 u_lightVP;
  void main() { gl_Position = u_lightVP * vec4(a_pos, 1.0); }`;
  const FS_DEPTH = `#version 300 es
  precision highp float;
  out vec4 o; void main() { o = vec4(1.0); }`;
  const VS_SKY = `#version 300 es
  precision highp float;
  in vec2 a_p; out vec2 v_uv;
  void main() { v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;
  const FS_SKY = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 o;
  uniform vec3 u_top, u_bot, u_sunCol; uniform vec2 u_sunUV; uniform float u_night, u_aspect;
  void main() {
    vec3 c = mix(u_bot, u_top, pow(clamp(v_uv.y, 0.0, 1.0), 0.85));
    vec2 d = (v_uv - u_sunUV) * vec2(u_aspect, 1.0);
    float r = length(d);
    c += u_sunCol * exp(-r * 9.0) * (1.0 - u_night * 0.75);
    c += u_sunCol * exp(-r * 2.2) * 0.18 * (1.0 - u_night * 0.8);
    // 夜空星点
    if (u_night > 0.4) {
      float s = fract(sin(dot(floor(v_uv * 420.0), vec2(12.9898, 78.233))) * 43758.5453);
      c += vec3(step(0.9985, s)) * (u_night - 0.4) * 1.6;
    }
    o = vec4(c, 1.0);
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

  /* ------------------------------ 渲染器 ------------------------------ */
  function createRenderer(canvas, geo) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('需要支持 WebGL2 的浏览器');
    const pMain = prog(gl, VS, FS), pDepth = prog(gl, VS_DEPTH, FS_DEPTH), pSky = prog(gl, VS_SKY, FS_SKY);

    // 顶点缓冲
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const mk = (data, name, n, program) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l = gl.getAttribLocation(program, name);
      if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }
      return b;
    };
    const bufPos = mk(geo.pos, 'a_pos', 3, pMain);
    mk(geo.nrm, 'a_nrm', 3, pMain); mk(geo.col, 'a_col', 3, pMain); mk(geo.mat, 'a_mat', 3, pMain);
    gl.bindVertexArray(null);
    // 深度通道 VAO
    const vaoD = gl.createVertexArray();
    gl.bindVertexArray(vaoD);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    const ld = gl.getAttribLocation(pDepth, 'a_pos');
    gl.enableVertexAttribArray(ld); gl.vertexAttribPointer(ld, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // 天空 VAO
    const vaoS = gl.createVertexArray();
    gl.bindVertexArray(vaoS);
    const bs = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bs);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const lsp = gl.getAttribLocation(pSky, 'a_p');
    gl.enableVertexAttribArray(lsp); gl.vertexAttribPointer(lsp, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 阴影贴图
    const SM = 2048;
    const shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SM, SM, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const shadowFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    const shadowOK = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    /* 分组绘制顺序：不透明 -> 玻璃 */
    const GROUPS = Object.keys(geo.groupRanges);
    const visible = {};
    GROUPS.forEach(g => visible[g] = true);
    const isGlass = g => g === 'glass';

    const cam = { yaw: 0.85, pitch: 0.30, dist: 15.5, tx: 0, ty: 1.5, tz: 0, fov: 0.72 };
    const opt = { night: 0, dust: 1, wire: 0, flat: 0, shadows: shadowOK, labels: true };
    let W = 1, H = 1, vp = M4.ident(), ivp = M4.ident(), eye = [0, 3, 15], lightVP = M4.ident();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 960, h = canvas.clientHeight || 600;
      W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    }
    function updateCam() {
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const ctr = [cam.tx, cam.ty, cam.tz];
      eye = [ctr[0] + Math.sin(cam.yaw) * cp * cam.dist, ctr[1] + sp * cam.dist, ctr[2] + Math.cos(cam.yaw) * cp * cam.dist];
      vp = M4.mul(M4.persp(cam.fov, W / H, 0.05, 160), M4.look(eye, ctr, [0, 1, 0]));
      ivp = M4.inv(vp);
    }
    function sunDir() {
      const t = opt.night;
      const el = 0.95 - t * 0.75, az = 0.9 + t * 0.8;
      return nrm([Math.cos(az) * Math.cos(el * 1.2), Math.max(0.12, Math.sin(el)), Math.sin(az) * Math.cos(el * 1.2)]);
    }
    function updateLight() {
      const L = sunDir(), R = 9.5;
      const target = [0, 1.4, 0];
      const lp = [target[0] + L[0] * 22, target[1] + L[1] * 22, target[2] + L[2] * 22];
      lightVP = M4.mul(M4.ortho(-R, R, -R, R, 1, 46), M4.look(lp, target, [0, 1, 0]));
    }

    function drawGeometry(program, glassPass) {
      GROUPS.forEach(g => {
        if (!visible[g]) return;
        if (glassPass !== isGlass(g)) return;
        const r = geo.groupRanges[g];
        gl.drawArrays(opt.wire ? gl.LINES : gl.TRIANGLES, r.start, r.count);
      });
      void program;
    }

    function draw(nowMs) {
      resize(); updateCam(); updateLight();
      const night = opt.night;
      const sunCol = [1.0 - night * 0.75, 0.94 - night * 0.72, 0.82 - night * 0.62];
      const skyCol = [0.55 - night * 0.48, 0.68 - night * 0.58, 0.92 - night * 0.72];
      const gndCol = [0.42 - night * 0.36, 0.36 - night * 0.30, 0.28 - night * 0.22];
      const fogCol = [0.72 - night * 0.66, 0.76 - night * 0.68, 0.86 - night * 0.74];

      // ---- 阴影通道
      if (opt.shadows) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
        gl.viewport(0, 0, SM, SM);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
        gl.useProgram(pDepth);
        gl.uniformMatrix4fv(gl.getUniformLocation(pDepth, 'u_lightVP'), false, lightVP);
        gl.bindVertexArray(vaoD);
        GROUPS.forEach(g => {
          if (!visible[g] || isGlass(g)) return;
          const r = geo.groupRanges[g];
          gl.drawArrays(gl.TRIANGLES, r.start, r.count);
        });
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      // ---- 天空
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(pSky);
      const L = sunDir();
      // 把太阳方向投影到屏幕，得到光斑位置
      const far = [eye[0] + L[0] * 60, eye[1] + L[1] * 60, eye[2] + L[2] * 60];
      const o = new Float32Array(4);
      for (let i = 0; i < 4; i++) o[i] = vp[i] * far[0] + vp[4 + i] * far[1] + vp[8 + i] * far[2] + vp[12 + i];
      const sunUV = o[3] > 0 ? [o[0] / o[3] * 0.5 + 0.5, o[1] / o[3] * 0.5 + 0.5] : [0.5, 1.4];
      gl.uniform3f(gl.getUniformLocation(pSky, 'u_top'), skyCol[0] * 0.85, skyCol[1] * 0.9, skyCol[2]);
      gl.uniform3f(gl.getUniformLocation(pSky, 'u_bot'), 0.86 - night * 0.78, 0.78 - night * 0.70, 0.66 - night * 0.56);
      gl.uniform3f(gl.getUniformLocation(pSky, 'u_sunCol'), sunCol[0], sunCol[1] * 0.9, sunCol[2] * 0.7);
      gl.uniform2f(gl.getUniformLocation(pSky, 'u_sunUV'), sunUV[0], sunUV[1]);
      gl.uniform1f(gl.getUniformLocation(pSky, 'u_night'), night);
      gl.uniform1f(gl.getUniformLocation(pSky, 'u_aspect'), W / H);
      gl.bindVertexArray(vaoS);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);

      // ---- 主通道
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(pMain);
      const U = n => gl.getUniformLocation(pMain, n);
      gl.uniformMatrix4fv(U('u_vp'), false, vp);
      gl.uniformMatrix4fv(U('u_lightVP'), false, lightVP);
      gl.uniform3f(U('u_eye'), eye[0], eye[1], eye[2]);
      gl.uniform3f(U('u_sunDir'), L[0], L[1], L[2]);
      gl.uniform3f(U('u_sunCol'), sunCol[0] * 1.15, sunCol[1] * 1.08, sunCol[2] * 0.95);
      gl.uniform3f(U('u_skyCol'), skyCol[0], skyCol[1], skyCol[2]);
      gl.uniform3f(U('u_gndCol'), gndCol[0], gndCol[1], gndCol[2]);
      gl.uniform3f(U('u_fogCol'), fogCol[0], fogCol[1], fogCol[2]);
      gl.uniform3f(U('u_dustCol'), 0.60, 0.54, 0.42);
      gl.uniform1f(U('u_ambient'), 0.55 - night * 0.34);
      gl.uniform1f(U('u_dust'), opt.dust);
      gl.uniform1f(U('u_fogDens'), 0.010);
      gl.uniform1f(U('u_night'), night);
      gl.uniform1f(U('u_flat'), opt.flat);
      gl.uniform3f(U('u_pl0'), -1.10, 2.30, 0.30);
      gl.uniform3f(U('u_pl1'), 1.60, 2.32, -0.40);
      gl.uniform3f(U('u_plCol'), 1.0, 0.82, 0.56);
      gl.uniform1f(U('u_plPow'), 0.55 + night * 1.5);
      gl.uniform1f(U('u_shadowTexel'), 1 / SM);
      gl.uniform1f(U('u_shadowOn'), opt.shadows ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.uniform1i(U('u_shadow'), 0);
      gl.bindVertexArray(vao);
      gl.uniform1f(U('u_alpha'), 1.0);
      drawGeometry(pMain, false);
      // 玻璃（后绘制、混合、不写深度）
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(U('u_alpha'), 0.42);
      drawGeometry(pMain, true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      void nowMs;
    }

    /* 世界坐标 -> 屏幕像素 */
    function project(p) {
      const o = new Float32Array(4);
      for (let i = 0; i < 4; i++) o[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i];
      if (o[3] <= 0) return null;
      return [(o[0] / o[3] * 0.5 + 0.5) * (canvas.clientWidth || 1),
        (1 - (o[1] / o[3] * 0.5 + 0.5)) * (canvas.clientHeight || 1), o[3]];
    }
    /* 屏幕射线（用于点选部件） */
    function pickPart(px, py) {
      const x = (px / (canvas.clientWidth || 1)) * 2 - 1, y = 1 - (py / (canvas.clientHeight || 1)) * 2;
      const un = z => {
        const v = [x, y, z, 1], o = new Float32Array(4);
        for (let i = 0; i < 4; i++) o[i] = ivp[i] * v[0] + ivp[4 + i] * v[1] + ivp[8 + i] * v[2] + ivp[12 + i] * v[3];
        return [o[0] / o[3], o[1] / o[3], o[2] / o[3]];
      };
      const a = un(-1), d = nrm(sub(un(1), a));
      // 精确的三角形级射线求交（Möller–Trumbore），只遍历可见分组
      const pos = geo.pos, triPart = geo.triPart;
      let bestT = Infinity, bestTri = -1;
      for (const g of GROUPS) {
        if (!visible[g] || isGlass(g)) continue;        // 透明玻璃不参与拾取（可穿窗点选）
        const r = geo.groupRanges[g];
        const t0i = r.start / 3, t1i = (r.start + r.count) / 3;
        for (let t = t0i; t < t1i; t++) {
          const o = t * 9;
          const ax = pos[o], ay = pos[o + 1], az = pos[o + 2];
          const e1x = pos[o + 3] - ax, e1y = pos[o + 4] - ay, e1z = pos[o + 5] - az;
          const e2x = pos[o + 6] - ax, e2y = pos[o + 7] - ay, e2z = pos[o + 8] - az;
          const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-9 && det < 1e-9) continue;
          const inv = 1 / det;
          const tvx = a[0] - ax, tvy = a[1] - ay, tvz = a[2] - az;
          const u = (tvx * px + tvy * py + tvz * pz) * inv;
          if (u < -1e-5 || u > 1.00001) continue;
          const qx = tvy * e1z - tvz * e1y, qy = tvz * e1x - tvx * e1z, qz = tvx * e1y - tvy * e1x;
          const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
          if (v < -1e-5 || u + v > 1.00001) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (tt > 0.01 && tt < bestT) { bestT = tt; bestTri = t; }
        }
      }
      if (bestTri < 0) return null;
      const pi = triPart[bestTri];
      return pi >= 0 ? geo.parts[pi] : null;
    }

    return {
      gl, cam, opt, visible, groups: GROUPS, geo, draw, resize, project, pickPart,
      shadowOK, sunDir,
      setVisible(g, v) { if (g in visible) visible[g] = v; },
      size: () => [canvas.clientWidth, canvas.clientHeight],
      eyePos: () => eye.slice()
    };
  }

  return { createRenderer, M4 };
});
