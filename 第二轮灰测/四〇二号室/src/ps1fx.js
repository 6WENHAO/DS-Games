/* =============================================================================
 * ps1fx.js — PS1 风格着色器补丁 + 复古后处理链
 *
 * 【PS1 材质补丁】对 THREE 内置材质做 onBeforeCompile 注入：
 *   1) 顶点抖动：投影后把顶点吸附到"内部低分辨率"的像素网格 → PS1 顶点 wobble
 *   2) 仿射 UV：额外传 vUvAff = uv * w 与 vHZw = w，片元用 vUvAff / vHZw 采样，
 *      得到破坏透视校正的屏幕线性 UV → PS1 标志性的贴图"游动"失真
 *   只替换 <map_fragment>（漫反射贴图），其它贴图仍用正常 UV，风险最小。
 *   任何编译失败 → 自动全局降级为无补丁（不黑屏）。
 *
 * 【后处理链】
 *   场景 → 低分辨率 RT(带 depthTexture) → SSAO(半分辨率) → Bloom(阈值+两次分离模糊)
 *        → 合成(VHS 行抖/滚动条/颗粒/扫描线/色差/5bit Bayer 抖动/暗角) → 屏幕
 *   GLSL 全部写成 ES1 兼容（不用 int %、abs(int)、动态数组下标）。
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;
  var PS1 = (HZ.PS1 = {});

  /* ======================= 一、材质补丁 ======================= */

  var patchFatal = false;
  var snapUniforms = [];
  var patchedSet = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;

  function patchMaterial(mat) {
    if (patchFatal || !mat || typeof mat.onBeforeCompile !== 'function') return;
    if (patchedSet && patchedSet.has(mat)) return;
    if (patchedSet) patchedSet.add(mat);

    var wantSnap = HZ.settings.vertexSnap > 0;
    var wantAffine = HZ.settings.affineUV && !!mat.map;
    if (!wantSnap && !wantAffine) return;

    mat.onBeforeCompile = function (shader) {
      if (patchFatal || !shader) return;
      try {
        var vs = shader.vertexShader;
        var fs = shader.fragmentShader;
        var vHead = '', fHead = '';

        /* ---- 顶点抖动 ---- */
        if (wantSnap) {
          vHead += 'uniform vec2 uHZPixel;\n';
          var m = vs.match(/gl_Position\s*=\s*[^;]+;/);
          if (m) {
            vs = vs.replace(m[0], m[0] +
              '\n  {\n' +
              '    float hzw = max(abs(gl_Position.w), 1e-4);\n' +
              '    vec2 hzp = gl_Position.xy / hzw * uHZPixel;\n' +
              '    gl_Position.xy = floor(hzp + 0.5) / uHZPixel * gl_Position.w;\n' +
              '  }');
          }
        }

        /* ---- 仿射 UV（仅漫反射贴图） ---- */
        if (wantAffine && fs.indexOf('#include <map_fragment>') >= 0) {
          vHead += 'varying vec2 vUvAff;\nvarying float vInvW;\n';
          fHead += 'varying vec2 vUvAff;\nvarying float vInvW;\n';
          // 插到 main 的末尾（此时 gl_Position 已算好，且抖动已应用）
          var lastBrace = vs.lastIndexOf('}');
          if (lastBrace > 0) {
            vs = vs.slice(0, lastBrace) +
              '  float hzAw = max(abs(gl_Position.w), 1e-4);\n' +
              '  vUvAff = uv * hzAw;\n' +
              '  vInvW = 1.0 / hzAw;\n' +
              vs.slice(lastBrace);
          }
          fs = fs.replace('#include <map_fragment>',
            '#ifdef USE_MAP\n' +
            '  diffuseColor *= texture2D( map, vUvAff * vInvW );\n' +
            '#endif');
        }

        shader.vertexShader = vHead + vs;
        shader.fragmentShader = fHead + fs;

        shader.uniforms.uHZPixel = { value: new THREE.Vector2(160, 100) };
        snapUniforms.push(shader.uniforms.uHZPixel);
      } catch (e) {
        console.warn('[PS1 patch]', e);
      }
    };

    var key = 'hz' + (wantSnap ? 'S' : '') + (wantAffine ? 'A' : '');
    mat.customProgramCacheKey = function () { return key; };
    mat.needsUpdate = true;
  }

  PS1.patchScene = function (root) {
    if (patchFatal || !root) return 0;
    var n = 0;
    root.traverse(function (o) {
      if (o && o.isMesh && o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        for (var i = 0; i < mats.length; i++) { patchMaterial(mats[i]); n++; }
      }
    });
    return n;
  };

  /** 每帧更新像素网格（半分辨率格子，抖动更明显） */
  PS1.updateSnapUniforms = function (intW, intH) {
    if (patchFatal) return;
    for (var i = 0; i < snapUniforms.length; i++) {
      var u = snapUniforms[i];
      if (u && u.value && u.value.set) u.value.set(intW * 0.28, intH * 0.28);
    }
  };

  PS1.isDisabled = function () { return patchFatal; };

  PS1.disablePatches = function (root) {
    if (patchFatal) return;
    patchFatal = true;
    HZ.settings.vertexSnap = 0;
    HZ.settings.affineUV = false;
    snapUniforms.length = 0;
    HZ.bus.emit('toast', '已关闭 PS1 着色器补丁（兼容性保护）');
    if (!root) return;
    root.traverse(function (o) {
      if (o && o.isMesh && o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        for (var i = 0; i < mats.length; i++) {
          mats[i].onBeforeCompile = function () {};
          mats[i].customProgramCacheKey = function () { return 'hzoff'; };
          mats[i].needsUpdate = true;
        }
      }
    });
  };

  /* ======================= 二、后处理 ======================= */

  var VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var LINDEPTH = [
    'uniform float uCamNear;',
    'uniform float uCamFar;',
    'float linDepth(sampler2D dtex, vec2 uv){',
    '  float d = texture2D(dtex, uv).x;',
    '  float z = d * 2.0 - 1.0;',
    '  float v = (2.0 * uCamNear * uCamFar) / (uCamFar + uCamNear - z * (uCamFar - uCamNear));',
    '  return clamp(v / uCamFar, 0.0, 1.0);',
    '}'
  ].join('\n');

  var COMPOSE = [
    'uniform sampler2D tScene;',
    'uniform sampler2D tBloom;',
    'uniform sampler2D tAO;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uGrain;',
    'uniform float uScan;',
    'uniform float uAberr;',
    'uniform float uVig;',
    'uniform float uDit;',
    'uniform float uBloomMix;',
    'uniform float uAO;',
    'uniform float uDread;',
    'uniform float uGlitch;',
    'varying vec2 vUv;',
    'float hash(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float bayer2(vec2 a){',
    '  a = floor(a);',
    '  return fract(a.x / 2.0 + a.y * a.y * 0.75);',
    '}',
    'float bayer4(vec2 a){',
    '  return bayer2(0.5 * a) * 0.25 + bayer2(a);',
    '}',
    'void main(){',
    '  vec2 uv = vUv;',
    '  float t = uTime;',
    '  uv += vec2(sin(uv.y * 9.0 + t * 1.7), cos(uv.x * 7.0 + t * 1.3)) * 0.0016 * uDread;',
    '  float line = floor(uv.y * uRes.y);',
    '  float jitter = step(0.996, hash(vec2(line, floor(t * 12.0))));',
    '  float roll = fract(t * 0.11);',
    '  float rollBand = smoothstep(0.0, 0.05, uv.y - roll) * smoothstep(0.13, 0.05, uv.y - roll);',
    '  uv.x += (jitter * 0.004 + rollBand * 0.010 + uGlitch * 0.03) * sin(t * 37.0 + line * 2.7);',
    '  uv.x += sin(uv.y * 40.0 + t * 2.0) * 0.0007;',
    '  uv = clamp(uv, vec2(0.001), vec2(0.999));',
    '  vec2 c = uv - 0.5;',
    '  vec2 off = c * dot(c, c) * 0.10 * uAberr;',
    '  vec3 col;',
    '  col.r = texture2D(tScene, clamp(uv - off, 0.001, 0.999)).r;',
    '  col.g = texture2D(tScene, uv).g;',
    '  col.b = texture2D(tScene, clamp(uv + off, 0.001, 0.999)).b;',
    '  float ao = texture2D(tAO, uv).x;',
    '  col *= pow(ao, 1.35) * uAO + (1.0 - uAO) * 0.85;',
    '  col += texture2D(tBloom, uv).rgb * uBloomMix;',
    '  col = pow(max(col, vec3(0.0)), vec3(0.78));',
    '  col = col * 0.9 - 0.004;',
    '  col = max(col, vec3(0.0));',
    '  col.r *= 0.97; col.g *= 1.015; col.b *= 1.05;',
    '  float g = hash(uv * uRes + fract(t) * 17.0);',
    '  col += (g - 0.5) * 2.0 * (0.03 + 0.09 * uGrain);',
    '  col *= 1.0 - 0.16 * uScan * (0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159));',
    '  float b = (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;',
    '  col = floor(col * 31.0 + b * uDit * 31.0 + 0.5) / 31.0;',
    '  float vig = smoothstep(1.15, 0.30 - uDread * 0.12, length(c) * 1.25);',
    '  col *= mix(1.0, vig, uVig);',
    '  col = mix(col, vec3(g), uGlitch * 0.75);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var SSAO = [
    'uniform sampler2D tDepth;',
    'uniform vec2 uRes;',
    'uniform float uRadius;',
    'uniform float uCamNear;',
    'uniform float uCamFar;',
    'varying vec2 vUv;',
    'float hash(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    // 线性化深度（近处数值小，远处数值大，差值即真实距离差）
    'float decodeDepth(vec2 uv){',
    '  vec3 c = texture2D(tDepth, uv).rgb;',
    '  return dot(c, vec3(1.0, 1.0/255.0, 1.0/65025.0));',
    '}',
    'void main(){',
    '  float d0 = decodeDepth(vUv);',
    '  float ang0 = hash(vUv) * 6.2831853;',
    '  float occ = 0.0;',
    '  // 半径随距离放大（透视校正），但给近处一个下限',
    '  float baseR = uRadius * (1.0 + d0 * 5.0);',
    '  for (int i = 0; i < 8; i++){',
    '    float fi = float(i);',
    '    float a = ang0 + fi * 2.39996;',
    '    float r = (fi + 1.0) / 8.0;',
    '    vec2 o = vec2(cos(a), sin(a)) * r * baseR;',
    '    float d = decodeDepth(clamp(vUv + o, 0.0, 1.0));',
    '    // 样本比中心更远 → 凹陷/角落 → 遮蔽',
    '    occ += clamp((d - d0) * 60.0, 0.0, 1.0) * (1.0 - r * 0.4);',
    '  }',
    '  float ao = clamp(1.0 - occ / 8.0 * 2.3, 0.0, 1.0);',
    '  gl_FragColor = vec4(vec3(ao), 1.0);',
    '}'
  ].join('\n');

  // 把场景深度写成线性灰度到普通 RGBA 纹理（规避深度纹理反馈绑定问题）
  // 场景深度 pass：用摄像机空间线性深度重绘整个场景（只写颜色，靠深度比较
  // 保证"看见的像素"与主 pass 完全一致），编码进 RGB（3×8bit = 24bit 精度）
  var DEPTHWRITE_VERT = [
    'varying float vDepth;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vDepth = clamp(-mv.z / 90.0, 0.0, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var DEPTHWRITE = [
    'varying float vDepth;',
    'void main(){',
    '  float d = clamp(vDepth, 0.0, 0.99999);',
    '  vec3 enc = vec3(1.0, 255.0, 65025.0);',
    '  vec3 r = fract(d * enc);',
    '  r.xy -= r.yz * (1.0 / 255.0);',
    '  gl_FragColor = vec4(r, 1.0);',
    '}'
  ].join('\n');

  var BRIGHT = [
    'uniform sampler2D tIn;',
    'uniform float uThreshold;',
    'uniform float uKnee;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec3 c = texture2D(tIn, vUv).rgb;',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float k = max(uThreshold, (l - uThreshold) * uKnee + uThreshold);',
    '  float w = smoothstep(uThreshold, k, l);',
    '  gl_FragColor = vec4(c * w, 1.0);',
    '}'
  ].join('\n');

  var BLUR = [
    'uniform sampler2D tIn;',
    'uniform vec2 uDir;',
    'uniform vec2 uRes;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 px = uDir / uRes;',
    '  vec3 sum = vec3(0.0);',
    '  sum += texture2D(tIn, vUv - px * 4.0).rgb * 0.016;',
    '  sum += texture2D(tIn, vUv - px * 3.0).rgb * 0.054;',
    '  sum += texture2D(tIn, vUv - px * 2.0).rgb * 0.122;',
    '  sum += texture2D(tIn, vUv - px).rgb * 0.194;',
    '  sum += texture2D(tIn, vUv).rgb * 0.227;',
    '  sum += texture2D(tIn, vUv + px).rgb * 0.194;',
    '  sum += texture2D(tIn, vUv + px * 2.0).rgb * 0.122;',
    '  sum += texture2D(tIn, vUv + px * 3.0).rgb * 0.054;',
    '  sum += texture2D(tIn, vUv + px * 4.0).rgb * 0.016;',
    '  gl_FragColor = vec4(sum, 1.0);',
    '}'
  ].join('\n');

  function fsGeo() {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    return g;
  }

  function makeRT(w, h, opts) {
    opts = opts || {};
    var filter = opts.linear ? THREE.LinearFilter : THREE.NearestFilter;
    var t = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      minFilter: filter,
      magFilter: filter,
      format: THREE.RGBAFormat,
      type: opts.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: !!opts.depth,
      stencilBuffer: false,
      generateMipmaps: false
    });
    if (opts.depth) {
      t.depthTexture = new THREE.DepthTexture(Math.max(2, w), Math.max(2, h));
      t.depthTexture.minFilter = THREE.NearestFilter;
      t.depthTexture.magFilter = THREE.NearestFilter;
    }
    return t;
  }

  function PostFX(renderer) {
    this.renderer = renderer;
    this.t = 0;
    this.intW = 0; this.intH = 0;

    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tAO: { value: null },
        uRes: { value: new THREE.Vector2(2, 2) },
        uTime: { value: 0 }, uGrain: { value: 0.5 }, uScan: { value: 0.45 },
        uAberr: { value: 0.6 }, uVig: { value: 0.85 }, uDit: { value: 1 },
        uBloomMix: { value: 0.85 }, uAO: { value: 0.8 },
        uDread: { value: 0 }, uGlitch: { value: 0 }
      },
      vertexShader: VERT, fragmentShader: COMPOSE,
      depthTest: false, depthWrite: false
    });
    this.aoMat = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uRes: { value: new THREE.Vector2(2, 2) },
        uCamNear: { value: 0.1 }, uCamFar: { value: 100 },
        uRadius: { value: 0.05 }
      },
      vertexShader: VERT, fragmentShader: SSAO,
      depthTest: false, depthWrite: false
    });
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tIn: { value: null }, uThreshold: { value: 0.42 }, uKnee: { value: 6.0 } },
      vertexShader: VERT, fragmentShader: BRIGHT,
      depthTest: false, depthWrite: false
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tIn: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uRes: { value: new THREE.Vector2(2, 2) }
      },
      vertexShader: VERT, fragmentShader: BLUR,
      depthTest: false, depthWrite: false
    });

    this.depthMat = new THREE.ShaderMaterial({
      vertexShader: DEPTHWRITE_VERT,
      fragmentShader: DEPTHWRITE,
      depthTest: true, depthWrite: false,
      side: THREE.DoubleSide
    });

    this.quad = new THREE.Mesh(fsGeo(), this.compMat);
    this.quad.frustumCulled = false;
    this.ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
  }

  PostFX.prototype.resize = function () {
    var size = this.renderer.getSize(new THREE.Vector2());
    var scale = HZ.clamp(HZ.settings.renderScale, 0.2, 1);
    var W = Math.max(96, Math.floor(size.x * scale));
    var H = Math.max(96, Math.floor(size.y * scale));
    if (this.intW === W && this.intH === H && this.sceneRT) return;

    var old = [this.sceneRT, this.depthRT, this.aoRT, this.bloomA, this.bloomB];
    for (var i = 0; i < old.length; i++) if (old[i]) old[i].dispose();

    this.sceneRT = makeRT(W, H, { depth: true });
    this.depthRT = makeRT(W, H, { linear: true, half: true });
    this.aoRT = makeRT(W >> 1, H >> 1, {});
    this.bloomA = makeRT(W >> 2, H >> 2, { linear: true });
    this.bloomB = makeRT(W >> 2, H >> 2, { linear: true });

    this.compMat.uniforms.uRes.value.set(W, H);
    this.compMat.uniforms.tScene.value = this.sceneRT.texture;
    this.compMat.uniforms.tAO.value = this.aoRT.texture;
    this.compMat.uniforms.tBloom.value = this.bloomA.texture;
    this.aoMat.uniforms.uRes.value.set(W, H);
    this.aoMat.uniforms.tDepth.value = this.depthRT.texture;
    this.blurMat.uniforms.uRes.value.set(Math.max(2, W >> 2), Math.max(2, H >> 2));
    this.intW = W; this.intH = H;
  };

  PostFX.prototype._pass = function (material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.ocam);
  };

  PostFX.prototype.render = function (scene, camera, dt, state) {
    var s = HZ.settings;
    var R = this.renderer;
    state = state || {};
    this.t += dt;

    PS1.updateSnapUniforms(this.intW, this.intH);

    /* 1. 场景 → 低分辨率 RT */
    R.setRenderTarget(this.sceneRT);
    R.setClearColor(0x080c12, 1);
    R.clear();
    R.render(scene, camera);

    /* 2. 场景深度 → 编码纹理（重绘场景，深度比较保持像素一致） */
    if (s.ao > 0.001) {
      R.setRenderTarget(this.depthRT);
      R.clear();
      scene.overrideMaterial = this.depthMat;
      R.render(scene, camera);
      scene.overrideMaterial = null;
    }

    /* 3. SSAO */
    if (s.ao > 0.001) {
      this._pass(this.aoMat, this.aoRT);
      this.compMat.uniforms.uAO.value = s.ao * 0.85;
    } else {
      this.compMat.uniforms.uAO.value = 0;
    }

    /* 3. Bloom */
    if (s.bloom > 0.001) {
      this.brightMat.uniforms.tIn.value = this.sceneRT.texture;
      this._pass(this.brightMat, this.bloomA);
      for (var i = 0; i < 2; i++) {
        this.blurMat.uniforms.tIn.value = this.bloomA.texture;
        this.blurMat.uniforms.uDir.value.set(1, 0);
        this._pass(this.blurMat, this.bloomB);
        this.blurMat.uniforms.tIn.value = this.bloomB.texture;
        this.blurMat.uniforms.uDir.value.set(0, 1);
        this._pass(this.blurMat, this.bloomA);
      }
      this.compMat.uniforms.uBloomMix.value = s.bloom;
    } else {
      this.compMat.uniforms.uBloomMix.value = 0;
    }

    /* 4. 合成 → 屏幕 */
    var u = this.compMat.uniforms;
    u.uTime.value = this.t;
    u.uGrain.value = s.grain;
    u.uScan.value = s.scanlines;
    u.uAberr.value = s.aberration;
    u.uVig.value = s.vignette;
    u.uDit.value = s.dither;
    u.uDread.value = state.dread || 0;
    u.uGlitch.value = state.glitch || 0;
    this._pass(this.compMat, null);
  };

  PostFX.prototype.renderRaw = function (scene, camera) {
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x080c12, 1);
    this.renderer.render(scene, camera);
  };

  PostFX.prototype.dispose = function () {
    var rts = [this.sceneRT, this.depthRT, this.aoRT, this.bloomA, this.bloomB];
    for (var i = 0; i < rts.length; i++) if (rts[i]) rts[i].dispose();
    this.compMat.dispose(); this.aoMat.dispose();
    this.brightMat.dispose(); this.blurMat.dispose();
    this.quad.geometry.dispose();
  };

  PS1.PostFX = PostFX;
})();
