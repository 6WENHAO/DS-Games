/* ============================================================
   filter.js — NDS 液晶屏滤镜（WebGL）
   ・15bit 色彩量化（NDS 真机为每通道 5bit）
   ・液晶余像（帧混合）
   ・像素栅格 + RGB 子像素条纹
   ・辉光 / 背光泄漏 / 暗角 / 玻璃反光 / 极轻微枕形畸变
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U;
  var FL = AA.FILTER = {};

  var VS = [
    'attribute vec2 aPos;',
    'uniform vec4 uRect;',   // x0,y0,x1,y1 (clip space)
    'uniform vec4 uUV;',     // u0,v0,u1,v1
    'varying vec2 vUV;',
    'void main(){',
    '  vec2 p = mix(uRect.xy, uRect.zw, aPos);',
    '  vUV = mix(uUV.xy, uUV.zw, aPos);',
    '  gl_Position = vec4(p, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---- 累积（量化 + 余像） ---- */
  var FS_ACC = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform sampler2D uSrc;',
    'uniform sampler2D uPrev;',
    'uniform float uGhost;',
    'uniform float uQuant;',
    'void main(){',
    '  vec3 c = texture2D(uSrc, vUV).rgb;',
    '  vec3 q = floor(c * 31.0 + 0.5) / 31.0;',
    '  c = mix(c, q, uQuant);',
    '  vec3 p = texture2D(uPrev, vUV).rgb;',
    '  gl_FragColor = vec4(mix(c, max(p*0.985, c*0.55), uGhost), 1.0);',
    '}'
  ].join('\n');

  /* ---- 亮部提取 ---- */
  var FS_BRIGHT = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform sampler2D uSrc;',
    'uniform float uThresh;',
    'void main(){',
    '  vec3 c = texture2D(uSrc, vUV).rgb;',
    '  float l = max(max(c.r,c.g),c.b);',
    '  float k = max(0.0, l - uThresh) / max(0.001, 1.0 - uThresh);',
    '  gl_FragColor = vec4(c * k * k, 1.0);',
    '}'
  ].join('\n');

  /* ---- 高斯模糊（可分离） ---- */
  var FS_BLUR = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform sampler2D uSrc;',
    'uniform vec2 uDir;',
    'void main(){',
    '  vec3 s = texture2D(uSrc, vUV).rgb * 0.227027;',
    '  s += texture2D(uSrc, vUV + uDir*1.3846).rgb * 0.316216;',
    '  s += texture2D(uSrc, vUV - uDir*1.3846).rgb * 0.316216;',
    '  s += texture2D(uSrc, vUV + uDir*3.2308).rgb * 0.070270;',
    '  s += texture2D(uSrc, vUV - uDir*3.2308).rgb * 0.070270;',
    '  gl_FragColor = vec4(s, 1.0);',
    '}'
  ].join('\n');

  /* ---- 最终显示 ---- */
  var FS_MAIN = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform sampler2D uSrc;',
    'uniform sampler2D uBloom;',
    'uniform vec2 uTexSize;',   // 源纹理像素尺寸 (256,384)
    'uniform vec2 uSubRect;',   // 本屏在纹理中的 v 范围
    'uniform float uScale;',    // 每个源像素占多少设备像素
    'uniform float uK;',        // 总强度
    'uniform float uTime;',
    'uniform vec2  uCurve;',    // 畸变量
    'uniform float uBloomK;',
    'void main(){',
    '  vec2 uv = vUV;',
    // 极轻微枕形畸变（以本屏为单位）
    '  vec2 local = vec2(uv.x, (uv.y - uSubRect.x) / max(0.0001,(uSubRect.y - uSubRect.x)));',
    '  vec2 cc = local * 2.0 - 1.0;',
    '  float r2 = dot(cc, cc);',
    '  vec2 warped = cc * (1.0 + uCurve.x * r2 * uK);',
    '  vec2 l2 = warped * 0.5 + 0.5;',
    '  float off = (any(lessThan(l2, vec2(0.0))) || any(greaterThan(l2, vec2(1.0)))) ? 1.0 : 0.0;',
    '  l2 = clamp(l2, 0.0, 1.0);',
    '  uv = vec2(l2.x, mix(uSubRect.x, uSubRect.y, l2.y));',
    '  vec3 c = texture2D(uSrc, uv).rgb;',
    // 液晶横向轻微拖影
    '  vec3 cl = texture2D(uSrc, uv - vec2(0.55/uTexSize.x, 0.0)).rgb;',
    '  c = mix(c, mix(c, cl, 0.5), 0.30 * uK);',
    // 辉光
    '  vec3 bl = texture2D(uBloom, uv).rgb;',
    '  c += bl * uBloomK * uK;',
    // 源像素网格
    '  vec2 px = vec2(uv.x, l2.y) * vec2(uTexSize.x, uTexSize.y * (uSubRect.y-uSubRect.x));',
    '  vec2 f = fract(px);',
    '  float gw = clamp(0.85 / max(1.0, uScale), 0.03, 0.5);',
    '  float gx = smoothstep(0.0, gw, f.x) * smoothstep(0.0, gw, 1.0 - f.x);',
    '  float gy = smoothstep(0.0, gw, f.y) * smoothstep(0.0, gw, 1.0 - f.y);',
    '  float grid = mix(1.0, 0.55 + 0.45 * min(gx, gy), 0.62 * uK);',
    // RGB 子像素条纹（分辨率足够时按源像素对齐）
    '  vec3 mask = vec3(1.0);',
    '  if (uScale >= 2.7) {',
    '    float s = floor(f.x * 3.0);',
    '    mask = vec3(s < 0.5 ? 1.0 : 0.72, (s > 0.5 && s < 1.5) ? 1.0 : 0.72, s > 1.5 ? 1.0 : 0.72);',
    '    mask = mix(vec3(1.0), mask, 0.55 * uK);',
    '  } else {',
    '    float s = mod(floor(gl_FragCoord.x), 3.0);',
    '    mask = vec3(s < 0.5 ? 1.0 : 0.84, (s > 0.5 && s < 1.5) ? 1.0 : 0.84, s > 1.5 ? 1.0 : 0.84);',
    '    mask = mix(vec3(1.0), mask, 0.4 * uK);',
    '  }',
    '  c *= grid;',
    '  c *= mask;',
    // 背光泄漏（提亮黑位，液晶不会全黑）
    '  c += vec3(0.028, 0.032, 0.045) * uK;',
    // 暗角
    '  float vig = 1.0 - 0.30 * uK * dot(cc*0.72, cc*0.72);',
    '  c *= vig;',
    // 玻璃反光（斜向柔和高光）
    '  float gl1 = smoothstep(0.55, 1.25, (local.x * 0.85 + (1.0-local.y) * 0.55));',
    '  c += vec3(0.055, 0.062, 0.078) * gl1 * uK;',
    // 对比 / 饱和 微调（NDS 屏幕偏艳）
    '  c = mix(vec3(dot(c, vec3(0.299,0.587,0.114))), c, 1.0 + 0.13*uK);',
    '  c = pow(max(c, 0.0), vec3(1.0 - 0.055*uK));',
    '  c *= (1.0 - off);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var gl = null, ok = false;
  var progAcc, progBright, progBlur, progMain, quad;
  var texSrc, accTex = [], accFbo = [], accCur = 0;
  var bTex = [], bFbo = [];
  var TW = 256, TH = 384, BW = 128, BH = 192;
  var strength = 1.0;

  function compile(vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('shader', gl.getShaderInfoLog(s), src);
        return null;
      }
      return s;
    }
    var p = gl.createProgram();
    var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
    if (!a || !b) return null;
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
    p.u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      p.u[info.name] = gl.getUniformLocation(p, info.name);
    }
    p.aPos = gl.getAttribLocation(p, 'aPos');
    return p;
  }

  function mkTex(w, h, filter) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function mkFbo(tex) {
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  }

  FL.init = function (canvas) {
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: false })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false });
    } catch (e) { gl = null; }
    if (!gl) { ok = false; return false; }

    progAcc = compile(VS, FS_ACC);
    progBright = compile(VS, FS_BRIGHT);
    progBlur = compile(VS, FS_BLUR);
    progMain = compile(VS, FS_MAIN);
    if (!progAcc || !progBright || !progBlur || !progMain) { ok = false; return false; }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    texSrc = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    for (var i = 0; i < 2; i++) { accTex[i] = mkTex(TW, TH, gl.NEAREST); accFbo[i] = mkFbo(accTex[i]); }
    for (var j = 0; j < 2; j++) { bTex[j] = mkTex(BW, BH, gl.LINEAR); bFbo[j] = mkFbo(bTex[j]); }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    ok = true;
    return true;
  };

  FL.available = function () { return ok; };
  FL.setStrength = function (s) { strength = Math.max(0, s); };
  FL.strength = function () { return strength; };

  function drawQuad(p, rect, uv) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4f(p.u.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform4f(p.u.uUV, uv[0], uv[1], uv[2], uv[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  var FULL = [-1, -1, 1, 1], FULLUV = [0, 0, 1, 1];

  /**
   * 渲染
   * atlas: 256x384 的 canvas（上屏在上半、下屏在下半）
   * rects: [{x,y,w,h}, {x,y,w,h}] 设备像素中两块屏幕的位置
   * dw,dh: 画布尺寸
   */
  FL.render = function (atlas, rects, dw, dh, time, scale) {
    if (!ok) return;
    var k = strength;

    gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

    /* --- 累积 --- */
    var prev = accCur, next = 1 - accCur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo[next]);
    gl.viewport(0, 0, TW, TH);
    gl.useProgram(progAcc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texSrc);
    gl.uniform1i(progAcc.u.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, accTex[prev]);
    gl.uniform1i(progAcc.u.uPrev, 1);
    gl.uniform1f(progAcc.u.uGhost, 0.20 * Math.min(1, k));
    gl.uniform1f(progAcc.u.uQuant, Math.min(1, k * 1.2));
    drawQuad(progAcc, FULL, FULLUV);
    accCur = next;

    /* --- 辉光 --- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo[0]);
    gl.viewport(0, 0, BW, BH);
    gl.useProgram(progBright);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accTex[accCur]);
    gl.uniform1i(progBright.u.uSrc, 0);
    gl.uniform1f(progBright.u.uThresh, 0.62);
    drawQuad(progBright, FULL, FULLUV);

    gl.useProgram(progBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bTex[0]);
    gl.uniform1i(progBlur.u.uSrc, 0);
    gl.uniform2f(progBlur.u.uDir, 1 / BW, 0);
    drawQuad(progBlur, FULL, FULLUV);

    gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo[0]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bTex[1]);
    gl.uniform2f(progBlur.u.uDir, 0, 1 / BH);
    drawQuad(progBlur, FULL, FULLUV);

    /* --- 显示 --- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, dw, dh);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(progMain);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accTex[accCur]);
    gl.uniform1i(progMain.u.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bTex[0]);
    gl.uniform1i(progMain.u.uBloom, 1);
    gl.uniform2f(progMain.u.uTexSize, TW, TH);
    gl.uniform1f(progMain.u.uK, Math.min(1.5, k));
    gl.uniform1f(progMain.u.uTime, time || 0);
    gl.uniform2f(progMain.u.uCurve, 0.012, 0);
    gl.uniform1f(progMain.u.uBloomK, 0.55);
    gl.uniform1f(progMain.u.uScale, scale || 3);

    for (var i = 0; i < 2; i++) {
      var r = rects[i];
      if (!r) continue;
      var x0 = r.x / dw * 2 - 1, x1 = (r.x + r.w) / dw * 2 - 1;
      var y0 = 1 - (r.y + r.h) / dh * 2, y1 = 1 - r.y / dh * 2;
      var v0 = i === 0 ? 0 : 0.5, v1 = i === 0 ? 0.5 : 1.0;
      gl.uniform2f(progMain.u.uSubRect, v0, v1);
      // 注意：纹理 v 与屏幕 y 相反，故 uv 的 y 从 v1 → v0
      drawQuad(progMain, [x0, y0, x1, y1], [0, v1, 1, v0]);
    }
  };

  FL.resize = function (canvas, w, h) {
    canvas.width = w; canvas.height = h;
  };

  /* ---------------- 2D 回退 ---------------- */
  FL.fallback = function (ctx, atlas, rects, scale) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < 2; i++) {
      var r = rects[i]; if (!r) continue;
      ctx.drawImage(atlas, 0, i * 192, 256, 192, r.x, r.y, r.w, r.h);
    }
    if (strength > 0.02 && scale >= 2) {
      ctx.globalAlpha = 0.16 * Math.min(1, strength);
      ctx.fillStyle = '#000';
      for (var j = 0; j < 2; j++) {
        var rr = rects[j]; if (!rr) continue;
        for (var y = 0; y < 192; y++) ctx.fillRect(rr.x, rr.y + Math.round(y * scale + scale - 1), rr.w, 1);
      }
    }
    ctx.restore();
  };

})(window.AA);
