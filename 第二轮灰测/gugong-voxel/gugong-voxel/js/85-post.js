/* =====================================================================
 * 紫禁城 体素模型 — 后期处理管线 (PostFX)
 * ---------------------------------------------------------------------
 * vendor 为 three.js r152 的经典全局构建，其中**不含** EffectComposer
 * （后期链只存在于 examples/jsm 的 ESM 版本），故此处自行实现一套：
 *
 *   场景 → HDR 渲染目标（半浮点 + 深度纹理）
 *        → 亮部提取 → 五级降采样高斯模糊（泛光金字塔）
 *        → 合成：泛光 + 云隙光 + 云影 + 色调映射 + 调色 + 暗角 + 颗粒
 *                + 色散 + FXAA → 画布
 *
 * 关键点：
 *   · 开启后期时场景以线性 HDR 渲入 RT（renderer.toneMapping 置 NoToneMapping、
 *     RT 纹理色彩空间置 srgb-linear），色调映射与 sRGB 编码统一在合成阶段做；
 *   · 云影由深度纹理反投影出世界坐标，再沿真实日照方向投影到 620 m 高的云层
 *     采样 fbm 噪声——因此云影会随太阳方位角改变形状与偏移，并随风飘移；
 *   · 全部 GLSL 为 ES 1.00 语法（循环上界为常量、无 textureLod / switch），
 *     以保证在 WebGL1 与 WebGL2 上都能编译。
 * ===================================================================== */
(function (G) {
  'use strict';
  var T = G.THREE;
  if (!T) { console.error('THREE 未载入'); return; }

  /* ------------------------------------------------------------------ */
  /* 着色器                                                              */
  /* ------------------------------------------------------------------ */
  var VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4( position.xy, 0.0, 1.0 );',
    '}'
  ].join('\n');

  /* 亮部提取：软阈值，避免暗部被硬切出台阶 */
  var FRAG_BRIGHT = [
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform float uThreshold;',
    'uniform float uKnee;',
    'void main(){',
    '  vec3 c = texture2D( tDiffuse, vUv ).rgb;',
    '  float l = max( c.r, max( c.g, c.b ) );',
    '  float k = max( 1e-4, uKnee );',
    '  float s = clamp( ( l - uThreshold + k ) / ( 2.0 * k ), 0.0, 1.0 );',
    '  float w = max( l - uThreshold, s * s * k ) / max( 1e-4, l );',
    '  gl_FragColor = vec4( c * w, 1.0 );',
    '}'
  ].join('\n');

  /* 四点盒式降采样 */
  var FRAG_DOWN = [
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uTexel;',
    'void main(){',
    '  vec2 o = uTexel;',
    '  vec3 c = texture2D( tDiffuse, vUv + vec2( -o.x, -o.y ) ).rgb',
    '         + texture2D( tDiffuse, vUv + vec2(  o.x, -o.y ) ).rgb',
    '         + texture2D( tDiffuse, vUv + vec2( -o.x,  o.y ) ).rgb',
    '         + texture2D( tDiffuse, vUv + vec2(  o.x,  o.y ) ).rgb;',
    '  gl_FragColor = vec4( c * 0.25, 1.0 );',
    '}'
  ].join('\n');

  /* 可分离九点高斯 */
  var FRAG_BLUR = [
    'varying vec2 vUv;',
    'uniform sampler2D tDiffuse;',
    'uniform vec2 uDir;',
    'void main(){',
    '  vec3 c = texture2D( tDiffuse, vUv ).rgb * 0.227027;',
    '  c += ( texture2D( tDiffuse, vUv + uDir * 1.3846154 ).rgb',
    '       + texture2D( tDiffuse, vUv - uDir * 1.3846154 ).rgb ) * 0.3162162;',
    '  c += ( texture2D( tDiffuse, vUv + uDir * 3.2307692 ).rgb',
    '       + texture2D( tDiffuse, vUv - uDir * 3.2307692 ).rgb ) * 0.0702703;',
    '  gl_FragColor = vec4( c, 1.0 );',
    '}'
  ].join('\n');

  /* 合成 */
  var FRAG_COMP = [
    'varying vec2 vUv;',
    'uniform sampler2D tScene;',
    'uniform sampler2D tDepth;',
    'uniform sampler2D tB0;',
    'uniform sampler2D tB1;',
    'uniform sampler2D tB2;',
    'uniform sampler2D tB3;',
    'uniform sampler2D tB4;',
    'uniform vec2  uResolution;',
    'uniform float uTime;',
    'uniform float uBloom;',
    'uniform float uRays;',
    'uniform vec2  uSunScreen;',
    'uniform float uSunOnScreen;',
    'uniform vec3  uSunColor;',
    'uniform float uCloud;',
    'uniform vec2  uCloudDrift;',
    'uniform vec3  uCloudTint;',
    'uniform vec3  uSunDir;',
    'uniform mat4  uInvVP;',
    'uniform float uTonemap;',
    'uniform float uExposure;',
    'uniform float uContrast;',
    'uniform float uSaturation;',
    'uniform float uTemperature;',
    'uniform float uTint;',
    'uniform vec3  uLift;',
    'uniform vec3  uGain;',
    'uniform float uVignette;',
    'uniform float uGrain;',
    'uniform float uAberration;',
    'uniform float uFxaa;',
    '',
    'const int RAY_SAMPLES = 20;',
    '',
    'float luma( vec3 c ){ return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }',
    'vec3 tmAces( vec3 x ){',
    '  return clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 );',
    '}',
    'vec3 tmFilmic( vec3 x ){',
    '  x = max( vec3( 0.0 ), x - 0.004 );',
    '  return ( x * ( 6.2 * x + 0.5 ) ) / ( x * ( 6.2 * x + 1.7 ) + 0.06 );',
    '}',
    'vec3 tmReinhard( vec3 x ){ return x / ( 1.0 + x ); }',
    'vec3 lin2srgb( vec3 c ){',
    '  c = max( c, vec3( 0.0 ) );',
    '  return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666667 ) ) - 0.055, step( vec3( 0.0031308 ), c ) );',
    '}',
    'float hash12( vec2 p ){',
    '  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );',
    '  p3 += dot( p3, p3.yzx + 33.33 );',
    '  return fract( ( p3.x + p3.y ) * p3.z );',
    '}',
    'float vnoise( vec2 p ){',
    '  vec2 i = floor( p ), f = fract( p );',
    '  f = f * f * ( 3.0 - 2.0 * f );',
    '  float a = hash12( i );',
    '  float b = hash12( i + vec2( 1.0, 0.0 ) );',
    '  float c = hash12( i + vec2( 0.0, 1.0 ) );',
    '  float d = hash12( i + vec2( 1.0, 1.0 ) );',
    '  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );',
    '}',
    'float fbm( vec2 p ){',
    '  float s = 0.0, a = 0.5;',
    '  for ( int i = 0; i < 4; i++ ){',
    '    s += a * vnoise( p );',
    '    p *= 2.03;',
    '    a *= 0.5;',
    '  }',
    '  return s;',
    '}',
    'vec3 sceneAt( vec2 uv ){ return texture2D( tScene, uv ).rgb; }',
    '',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 texel = 1.0 / uResolution;',
    '',
    '  /* 色散：沿径向轻微分离三通道，边缘越远越明显 */',
    '  vec3 base;',
    '  if ( uAberration > 0.0001 ) {',
    '    vec2 rd = uv - 0.5;',
    '    float amt = uAberration * 0.010 * dot( rd, rd );',
    '    base.r = sceneAt( uv + rd * amt ).r;',
    '    base.g = sceneAt( uv ).g;',
    '    base.b = sceneAt( uv - rd * amt ).b;',
    '  } else {',
    '    base = sceneAt( uv );',
    '  }',
    '',
    '  /* FXAA：亮度边缘检测后沿梯度法线做一次混合 */',
    '  if ( uFxaa > 0.5 ) {',
    '    float lM = luma( base );',
    '    float lN = luma( sceneAt( uv + vec2( 0.0, texel.y ) ) );',
    '    float lS = luma( sceneAt( uv - vec2( 0.0, texel.y ) ) );',
    '    float lE = luma( sceneAt( uv + vec2( texel.x, 0.0 ) ) );',
    '    float lW = luma( sceneAt( uv - vec2( texel.x, 0.0 ) ) );',
    '    float lMin = min( lM, min( min( lN, lS ), min( lE, lW ) ) );',
    '    float lMax = max( lM, max( max( lN, lS ), max( lE, lW ) ) );',
    '    float rng = lMax - lMin;',
    '    if ( rng > 0.10 * lMax + 0.015 ) {',
    '      vec2 g = vec2( -( ( lN + lS ) - 2.0 * lM ), ( lE + lW ) - 2.0 * lM );',
    '      if ( length( g ) > 1e-5 ) {',
    '        vec2 d = normalize( g ) * texel * 1.35;',
    '        base = mix( base, ( sceneAt( uv + d ) + sceneAt( uv - d ) ) * 0.5, 0.62 );',
    '      }',
    '    }',
    '  }',
    '',
    '  vec3 col = base;',
    '',
    '  /* 云影：由深度反投影世界坐标，沿日照方向投到云层平面采样 fbm */',
    '  float depth = texture2D( tDepth, uv ).x;',
    '  float notSky = 1.0 - step( 0.999999, depth );',
    '  if ( uCloud > 0.0001 && notSky > 0.5 ) {',
    '    vec4 ndc = vec4( uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );',
    '    vec4 wp = uInvVP * ndc;',
    '    vec3 world = wp.xyz / max( 1e-6, wp.w );',
    '    vec2 sp = world.xz - ( uSunDir.xz / max( 0.18, uSunDir.y ) ) * ( 620.0 - world.y );',
    '    float n = fbm( sp * 0.0021 + uCloudDrift );',
    '    float lit = smoothstep( 0.44, 0.68, n );',
    '    col = mix( col, col * uCloudTint, ( 1.0 - lit ) * uCloud );',
    '  }',
    '',
    '  /* 泛光：五级模糊按权重叠加 */',
    '  if ( uBloom > 0.0001 ) {',
    '    vec3 b = texture2D( tB0, uv ).rgb * 0.42',
    '           + texture2D( tB1, uv ).rgb * 0.28',
    '           + texture2D( tB2, uv ).rgb * 0.17',
    '           + texture2D( tB3, uv ).rgb * 0.09',
    '           + texture2D( tB4, uv ).rgb * 0.04;',
    '    col += b * uBloom;',
    '  }',
    '',
    '  /* 云隙光：向日轮屏幕位置做径向模糊，取亮部金字塔首级为源 */',
    '  if ( uRays > 0.0001 && uSunOnScreen > 0.0001 ) {',
    '    vec2 step2 = ( uSunScreen - uv ) / float( RAY_SAMPLES );',
    '    vec2 p = uv;',
    '    float w = 1.0;',
    '    vec3 acc = vec3( 0.0 );',
    '    for ( int i = 0; i < RAY_SAMPLES; i++ ) {',
    '      p += step2;',
    '      acc += texture2D( tB0, clamp( p, vec2( 0.0 ), vec2( 1.0 ) ) ).rgb * w;',
    '      w *= 0.93;',
    '    }',
    '    acc /= float( RAY_SAMPLES );',
    '    col += acc * uSunColor * uRays * uSunOnScreen;',
    '  }',
    '',
    '  /* 曝光与色调映射 */',
    '  col *= uExposure;',
    '  if ( uTonemap > 2.5 )      col = tmReinhard( col );',
    '  else if ( uTonemap > 1.5 ) col = tmFilmic( col );',
    '  else if ( uTonemap > 0.5 ) col = tmAces( col );',
    '  else                       col = clamp( col, 0.0, 1.0 );',
    '',
    '  /* 调色：先去/增饱和，再上色偏，最后提升增益与对比。',
    '     顺序很重要——若饱和度放在最后，棕褐/水墨这类"先褪色再上色"的效果会被拉回灰。 */',
    '  col = mix( vec3( luma( col ) ), col, uSaturation );',
    '  col.r *= 1.0 + uTemperature * 0.22;',
    '  col.b *= 1.0 - uTemperature * 0.22;',
    '  col.g *= 1.0 + uTint * 0.16;',
    '  col = col * uGain + uLift * ( 1.0 - col );',
    '  col = ( col - 0.5 ) * uContrast + 0.5;',
    '  col = clamp( col, 0.0, 1.0 );',
    '',
    '  /* 暗角 */',
    '  if ( uVignette > 0.0001 ) {',
    '    vec2 q = uv - 0.5;',
    '    float r = length( q * vec2( uResolution.x / uResolution.y, 1.0 ) );',
    '    col *= 1.0 - uVignette * smoothstep( 0.34, 0.96, r );',
    '  }',
    '',
    '  /* 胶片颗粒：暗部更明显 */',
    '  if ( uGrain > 0.0001 ) {',
    '    float n = hash12( uv * uResolution + fract( uTime ) * 917.0 ) - 0.5;',
    '    col += n * uGrain * ( 0.10 + 0.34 * ( 1.0 - luma( col ) ) );',
    '  }',
    '',
    '  gl_FragColor = vec4( lin2srgb( clamp( col, 0.0, 1.0 ) ), 1.0 );',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* 管线                                                                */
  /* ------------------------------------------------------------------ */
  var LEVELS = 5;

  function PostFX(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.ok = true;

    var caps = renderer.capabilities;
    // 渲染到浮点目标需要相应的 color buffer 扩展；缺失则退回字节目标（泛光会被截顶但仍可渲染）
    this.hdr = caps.isWebGL2
      ? (renderer.extensions.has('EXT_color_buffer_float') ||
         renderer.extensions.has('EXT_color_buffer_half_float'))
      : (renderer.extensions.has('OES_texture_half_float') &&
         renderer.extensions.has('WEBGL_color_buffer_float'));
    this.canDepth = caps.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');

    this.matBright = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.85 }, uKnee: { value: 0.35 } },
      vertexShader: VERT, fragmentShader: FRAG_BRIGHT, depthTest: false, depthWrite: false
    });
    this.matDown = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new T.Vector2() } },
      vertexShader: VERT, fragmentShader: FRAG_DOWN, depthTest: false, depthWrite: false
    });
    this.matBlur = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new T.Vector2() } },
      vertexShader: VERT, fragmentShader: FRAG_BLUR, depthTest: false, depthWrite: false
    });
    this.matComp = new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tDepth: { value: null },
        tB0: { value: null }, tB1: { value: null }, tB2: { value: null },
        tB3: { value: null }, tB4: { value: null },
        uResolution: { value: new T.Vector2(1, 1) },
        uTime: { value: 0 },
        uBloom: { value: 0.6 },
        uRays: { value: 0.35 },
        uSunScreen: { value: new T.Vector2(0.5, 0.5) },
        uSunOnScreen: { value: 0 },
        uSunColor: { value: new T.Color(1, 1, 1) },
        uCloud: { value: 0.45 },
        uCloudDrift: { value: new T.Vector2() },
        uCloudTint: { value: new T.Color(0.60, 0.65, 0.78) },
        uSunDir: { value: new T.Vector3(0, 1, 0) },
        uInvVP: { value: new T.Matrix4() },
        uTonemap: { value: 1 },
        uExposure: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uTemperature: { value: 0 },
        uTint: { value: 0 },
        uLift: { value: new T.Vector3(0, 0, 0) },
        uGain: { value: new T.Vector3(1, 1, 1) },
        uVignette: { value: 0.18 },
        uGrain: { value: 0.02 },
        uAberration: { value: 0.15 },
        uFxaa: { value: 1 }
      },
      vertexShader: VERT, fragmentShader: FRAG_COMP, depthTest: false, depthWrite: false
    });

    /* 全屏四边形（顶点着色器直接输出裁剪坐标，相机仅作占位） */
    this.quadScene = new T.Scene();
    this.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.matBright);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.targets = null;
    this._invVP = new T.Matrix4();
    this._sunPos = new T.Vector3();
    this._fwd = new T.Vector3();
    this.setSize(1, 1);
  }

  PostFX.prototype._mkRT = function (w, h, depth) {
    var rt = new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: this.hdr ? T.HalfFloatType : T.UnsignedByteType,
      format: T.RGBAFormat,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      wrapS: T.ClampToEdgeWrapping,
      wrapT: T.ClampToEdgeWrapping,
      depthBuffer: !!depth,
      stencilBuffer: false,
      generateMipmaps: false
    });
    if (rt.texture && 'colorSpace' in rt.texture) rt.texture.colorSpace = T.LinearSRGBColorSpace;
    if (depth && this.canDepth) {
      var dt = new T.DepthTexture(Math.max(1, w), Math.max(1, h));
      dt.type = T.UnsignedIntType;
      dt.minFilter = T.NearestFilter;
      dt.magFilter = T.NearestFilter;
      rt.depthTexture = dt;
    }
    return rt;
  };

  PostFX.prototype.setSize = function (w, h) {
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    if (this.targets && this.targets.w === w && this.targets.h === h) return;
    this.dispose();
    var t = { w: w, h: h, a: [], b: [], size: [] };
    t.scene = this._mkRT(w, h, true);
    var lw = Math.max(1, w >> 1), lh = Math.max(1, h >> 1);
    for (var i = 0; i < LEVELS; i++) {
      t.a.push(this._mkRT(lw, lh, false));
      t.b.push(this._mkRT(lw, lh, false));
      t.size.push([lw, lh]);
      lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1);
    }
    this.targets = t;
    this.matComp.uniforms.uResolution.value.set(w, h);
  };

  PostFX.prototype.dispose = function () {
    var t = this.targets;
    if (!t) return;
    var all = [t.scene].concat(t.a, t.b);
    for (var i = 0; i < all.length; i++) {
      if (all[i].depthTexture) all[i].depthTexture.dispose();
      all[i].dispose();
    }
    this.targets = null;
  };

  PostFX.prototype._blit = function (mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target || null);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.quadScene, this.quadCam);
  };

  /**
   * p 需提供：
   *   time, sunDir(Vector3 指向太阳), sunColor(Color), skyColor(Color),
   *   bloom, bloomThreshold, rays, cloud, cloudDrift(Vector2),
   *   tonemap, exposure, contrast, saturation, temperature, tint,
   *   lift[3], gain[3], vignette, grain, aberration, fxaa
   */
  PostFX.prototype.render = function (p) {
    var r = this.renderer, t = this.targets;
    var u = this.matComp.uniforms;

    /* 1. 场景 → HDR 目标 */
    r.setRenderTarget(t.scene);
    r.clear();
    r.render(this.scene, this.camera);

    /* 2. 亮部提取 */
    this.matBright.uniforms.tDiffuse.value = t.scene.texture;
    this.matBright.uniforms.uThreshold.value = p.bloomThreshold;
    this._blit(this.matBright, t.a[0]);

    /* 3. 逐级降采样 */
    for (var i = 1; i < LEVELS; i++) {
      this.matDown.uniforms.tDiffuse.value = t.a[i - 1].texture;
      this.matDown.uniforms.uTexel.value.set(1 / t.size[i - 1][0], 1 / t.size[i - 1][1]);
      this._blit(this.matDown, t.a[i]);
    }

    /* 4. 每级做一次可分离高斯 */
    for (var j = 0; j < LEVELS; j++) {
      var sw = t.size[j][0], sh = t.size[j][1];
      this.matBlur.uniforms.tDiffuse.value = t.a[j].texture;
      this.matBlur.uniforms.uDir.value.set(1 / sw, 0);
      this._blit(this.matBlur, t.b[j]);
      this.matBlur.uniforms.tDiffuse.value = t.b[j].texture;
      this.matBlur.uniforms.uDir.value.set(0, 1 / sh);
      this._blit(this.matBlur, t.a[j]);
    }

    /* 5. 合成到画布 */
    u.tScene.value = t.scene.texture;
    u.tDepth.value = t.scene.depthTexture || null;
    u.tB0.value = t.a[0].texture; u.tB1.value = t.a[1].texture;
    u.tB2.value = t.a[2].texture; u.tB3.value = t.a[3].texture;
    u.tB4.value = t.a[4].texture;
    u.uTime.value = p.time;
    u.uBloom.value = p.bloom;
    u.uRays.value = p.rays;
    u.uCloud.value = this.canDepth ? p.cloud : 0;
    u.uCloudDrift.value.copy(p.cloudDrift);
    u.uCloudTint.value.copy(p.cloudTint);
    u.uSunDir.value.copy(p.sunDir);
    u.uSunColor.value.copy(p.sunColor);
    u.uTonemap.value = p.tonemap;
    u.uExposure.value = p.exposure;
    u.uContrast.value = p.contrast;
    u.uSaturation.value = p.saturation;
    u.uTemperature.value = p.temperature;
    u.uTint.value = p.tint;
    u.uLift.value.set(p.lift[0], p.lift[1], p.lift[2]);
    u.uGain.value.set(p.gain[0], p.gain[1], p.gain[2]);
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uAberration.value = p.aberration;
    u.uFxaa.value = p.fxaa ? 1 : 0;

    /* 日轮屏幕位置与可见度 */
    this._sunPos.copy(p.sunDir).multiplyScalar(3000).add(this.camera.position);
    this._sunPos.project(this.camera);
    this.camera.getWorldDirection(this._fwd);
    var facing = this._fwd.dot(p.sunDir);
    var sx = (this._sunPos.x + 1) * 0.5, sy = (this._sunPos.y + 1) * 0.5;
    var edge = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
    var vis = facing <= 0.02 ? 0 : Math.min(1, facing * 1.6);   // 太阳需在镜头前方
    vis *= Math.max(0, 1 - Math.max(0, edge - 0.5) * 2.4);      // 离画面越远越弱
    vis *= Math.max(0, Math.min(1, p.sunDir.y * 6));            // 太阳落到地平就熄灭
    u.uSunScreen.value.set(sx, sy);
    u.uSunOnScreen.value = vis;

    /* 深度反投影矩阵 */
    this._invVP.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).invert();
    u.uInvVP.value.copy(this._invVP);

    this._blit(this.matComp, null);
    r.setRenderTarget(null);
  };

  /** 首帧自检：读回画面中心像素，若全黑则判定着色器未能工作，交由调用方回退 */
  PostFX.prototype.selfTest = function () {
    try {
      var gl = this.renderer.getContext();
      var c = this.renderer.domElement;
      var px = new Uint8Array(4 * 64);
      gl.readPixels(Math.max(0, (c.width >> 1) - 4), Math.max(0, (c.height >> 1) - 4),
                    8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var sum = 0;
      for (var i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
      return sum > 0;
    } catch (e) { return true; }
  };

  PostFX.SHADERS = {
    bright: { vert: VERT, frag: FRAG_BRIGHT },
    down: { vert: VERT, frag: FRAG_DOWN },
    blur: { vert: VERT, frag: FRAG_BLUR },
    comp: { vert: VERT, frag: FRAG_COMP }
  };
  PostFX.LEVELS = LEVELS;

  /* ------------------------------------------------------------------ */
  /* 滤镜预设                                                            */
  /* ------------------------------------------------------------------ */
  PostFX.FILTERS = [
    { n: '原色', tm: 1, ex: 1.00, ct: 1.00, sa: 1.00, tp: 0.00, ti: 0.00,
      lift: [0, 0, 0], gain: [1, 1, 1], vig: 0.16, gr: 0.02, ab: 0.15,
      bl: 0.55, th: 0.88, ry: 0.30, cl: 0.42 },
    { n: '金瓦丹墙', tm: 1, ex: 1.06, ct: 1.06, sa: 1.18, tp: 0.16, ti: 0.02,
      lift: [0.010, 0.005, 0.000], gain: [1.06, 1.01, 0.94], vig: 0.22, gr: 0.02, ab: 0.20,
      bl: 0.82, th: 0.80, ry: 0.48, cl: 0.38 },
    { n: '青绿彩画', tm: 2, ex: 1.02, ct: 1.12, sa: 1.08, tp: -0.12, ti: 0.05,
      lift: [0.000, 0.012, 0.032], gain: [0.96, 1.02, 1.09], vig: 0.26, gr: 0.03, ab: 0.24,
      bl: 0.70, th: 0.86, ry: 0.38, cl: 0.50 },
    { n: '水墨', tm: 2, ex: 0.98, ct: 1.30, sa: 0.16, tp: 0.05, ti: 0.00,
      lift: [0.020, 0.020, 0.018], gain: [0.98, 0.98, 0.96], vig: 0.42, gr: 0.06, ab: 0.00,
      bl: 0.34, th: 0.92, ry: 0.18, cl: 0.55 },
    { n: '黄昏', tm: 1, ex: 1.12, ct: 1.06, sa: 1.30, tp: 0.44, ti: 0.06,
      lift: [0.026, 0.010, 0.000], gain: [1.18, 0.98, 0.78], vig: 0.32, gr: 0.03, ab: 0.34,
      bl: 1.05, th: 0.72, ry: 0.92, cl: 0.34 },
    { n: '月夜', tm: 1, ex: 0.86, ct: 1.12, sa: 0.58, tp: -0.34, ti: -0.02,
      lift: [0.004, 0.010, 0.030], gain: [0.86, 0.93, 1.14], vig: 0.40, gr: 0.05, ab: 0.20,
      bl: 0.88, th: 0.78, ry: 0.14, cl: 0.58 },
    { n: '旧照', tm: 3, ex: 1.00, ct: 1.14, sa: 0.30, tp: 0.32, ti: 0.08,
      lift: [0.036, 0.028, 0.012], gain: [1.06, 0.96, 0.78], vig: 0.48, gr: 0.10, ab: 0.14,
      bl: 0.40, th: 0.88, ry: 0.22, cl: 0.48 }
  ];
  PostFX.TONEMAPS = ['无', 'ACES', 'Filmic', 'Reinhard'];

  G.PostFX = PostFX;
})(typeof window !== 'undefined' ? window : globalThis);
