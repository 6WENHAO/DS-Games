/**
 * Engine.js — 渲染核心。
 *
 * 管线（自建，不用 EffectComposer：体积龙卷风需要场景深度做逐像素遮挡合成）：
 *   1) scene  → sceneRT (RGBA16F, MSAA4, 附带 DepthTexture)
 *   2) 体积龙卷风 raymarch → volRT（半分辨率，预乘颜色 + 透过率）
 *   3) 深度感知上采样合成 → compRT
 *   4) 阈值降采样 + 分离高斯 = 5 级泛光
 *   5) 合成 + ACES + 分级 + 暗角 + 颗粒 + FXAA → 屏幕
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { P, FLAGS } from './Params.js';
import { clamp, damp } from './Random.js';
import { GLSL_TONE } from './GlslLib.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** 全屏 pass 小工具 */
export class FullScreenPass {
  constructor(fragmentShader, uniforms = {}, defines = {}) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `precision highp float;\nin vec3 position;\nin vec2 uv;\nout vec2 vUv;\nvoid main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `precision highp float;\nprecision highp int;\nprecision highp sampler2D;\nin vec2 vUv;\nout vec4 fragColor;\n` + fragmentShader,
      uniforms,
      defines,
      depthTest: false, depthWrite: false, transparent: false,
    });
    this.uniforms = this.material.uniforms;
    this._geo = new THREE.BufferGeometry();
    this._geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this._geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this._mesh = new THREE.Mesh(this._geo, this.material);
    this._mesh.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._mesh);
    this._cam = new THREE.Camera();
  }
  render(renderer, target = null) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this._scene, this._cam);
    renderer.setRenderTarget(prev);
  }
  dispose() { this.material.dispose(); this._geo.dispose(); }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    const gl = this.renderer.getContext();
    this.isWebGL2 = this.renderer.capabilities.isWebGL2 !== false && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;   // 自己在最终 pass 做 ACES
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.autoClear = true;
    this.renderer.info.autoReset = false;

    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.hasFloatBlend = !!gl.getExtension?.('EXT_float_blend');
    this.hasColorBufferFloat = !!gl.getExtension?.('EXT_color_buffer_float');
    this.rendererName = (() => {
      try {
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
      } catch { return 'unknown'; }
    })();
    this.softwareGL = /swiftshader|software|llvmpipe|basic render/i.test(String(this.rendererName));

    this.camera = new THREE.PerspectiveCamera(52, 1, 1.0, 26000);
    this.camera.position.set(-320, 145, 430);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 6500;
    this.controls.maxPolarAngle = Math.PI * 0.497;
    this.controls.target.set(0, 90, 0);

    this._last = performance.now() / 1000;
    this.time = 0;
    this.frame = 0;
    this.dt = 1 / 60;
    this.paused = false;

    /** 体积 pass 由 Tornado 注册： (colorTex, depthTex, outTarget) => void */
    this.volumePass = null;

    this.size = new THREE.Vector2(1, 1);
    this.renderScale = 1;
    this._initTargets();
    this._initPost();

    // 自适应性能：软件渲染或低帧率时压低体积步数
    this.perf = { fps: 60, ms: 16, scale: FLAGS.perf > 0 ? FLAGS.perf : (this.softwareGL ? 0.34 : 1), avg: 16 };

    this._onResize = () => this.resize();
    addEventListener('resize', this._onResize);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost = true; window.__diag?.('WEBGL CONTEXT LOST'); });
    this.resize();
  }

  _makeRT(w, h, opts = {}) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      depthBuffer: !!opts.depth,
      stencilBuffer: false,
      generateMipmaps: false,
      samples: opts.samples || 0,
      colorSpace: THREE.NoColorSpace,
      ...opts,
    });
    rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    return rt;
  }

  _initTargets() {
    const samples = (FLAGS.lowend || this.softwareGL) ? 0 : 4;
    this.msaa = samples;
    this.sceneRT = this._makeRT(2, 2, { depth: true, samples });
    this.sceneRT.depthTexture = new THREE.DepthTexture(2, 2, THREE.UnsignedIntType);
    this.sceneRT.depthTexture.format = THREE.DepthFormat;
    this.sceneRT.depthTexture.minFilter = THREE.NearestFilter;
    this.sceneRT.depthTexture.magFilter = THREE.NearestFilter;
    this.volRT = this._makeRT(2, 2);
    this.compRT = this._makeRT(2, 2);
    this.bloomRT = [];
    for (let i = 0; i < 5; i++) this.bloomRT.push({ a: this._makeRT(2, 2), b: this._makeRT(2, 2) });
  }

  _initPost() {
    /* 泛光：亮度阈值降采样 */
    this.pDown = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, softKnee, first;
      ${GLSL_TONE}
      void main(){
        vec3 s = texture(tSrc, vUv).rgb;
        vec3 c = s
          + texture(tSrc, vUv + vec2( texel.x,  texel.y)).rgb
          + texture(tSrc, vUv + vec2(-texel.x,  texel.y)).rgb
          + texture(tSrc, vUv + vec2( texel.x, -texel.y)).rgb
          + texture(tSrc, vUv + vec2(-texel.x, -texel.y)).rgb;
        c *= 0.2;
        if(first > 0.5){
          float l = max(luma(c), 1e-5);
          float knee = threshold * softKnee + 1e-5;
          float soft = clamp(l - threshold + knee, 0.0, 2.0*knee);
          soft = soft*soft / (4.0*knee);
          c *= max(soft, l - threshold) / l;
        }
        fragColor = vec4(min(c, vec3(140.0)), 1.0);
      }`, {
      tSrc: { value: null }, texel: { value: new THREE.Vector2() },
      threshold: { value: 1.0 }, softKnee: { value: 0.6 }, first: { value: 0 },
    });

    /* 分离高斯（9 tap，线性采样加权） */
    this.pBlur = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 dir;
      void main(){
        vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
        c += texture(tSrc, vUv + dir*1.3846153846).rgb * 0.3162162162;
        c += texture(tSrc, vUv - dir*1.3846153846).rgb * 0.3162162162;
        c += texture(tSrc, vUv + dir*3.2307692308).rgb * 0.0702702703;
        c += texture(tSrc, vUv - dir*3.2307692308).rgb * 0.0702702703;
        fragColor = vec4(c, 1.0);
      }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });

    /* 上采样累加 */
    this.pUp = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc, tAdd; uniform float k;
      void main(){ fragColor = vec4(texture(tSrc, vUv).rgb + texture(tAdd, vUv).rgb * k, 1.0); }
    `, { tSrc: { value: null }, tAdd: { value: null }, k: { value: 1.0 } });

    /* 最终：泛光合成 + 曝光 + ACES + 分级 + 暗角 + 颗粒 + FXAA */
    this.pFinal = new FullScreenPass(/* glsl */`
      uniform sampler2D tScene, tBloom;
      uniform vec2  texel;
      uniform float exposure, bloomK, vignette, grain, time, saturation, contrast, fxaa;
      uniform vec3  lift, gain;
      ${GLSL_TONE}
      vec3 fetch(vec2 uv){ return texture(tScene, uv).rgb; }
      void main(){
        vec3 c = fetch(vUv);
        /* FXAA（在 HDR 上做亮度边缘检测的轻量版本） */
        if(fxaa > 0.5){
          float lM = luma(c);
          float lN = luma(fetch(vUv + vec2(0.0,  texel.y)));
          float lS = luma(fetch(vUv + vec2(0.0, -texel.y)));
          float lE = luma(fetch(vUv + vec2( texel.x, 0.0)));
          float lW = luma(fetch(vUv + vec2(-texel.x, 0.0)));
          float lMin = min(lM, min(min(lN,lS), min(lE,lW)));
          float lMax = max(lM, max(max(lN,lS), max(lE,lW)));
          float rng = lMax - lMin;
          if(rng > max(0.10, lMax*0.16)){
            vec2 d = normalize(vec2(abs(lN+lS-2.0*lM) + 1e-5, abs(lE+lW-2.0*lM) + 1e-5));
            vec2 off = vec2(-d.y, d.x) * texel * 1.35;
            vec3 blur = 0.25*(fetch(vUv+off) + fetch(vUv-off) + fetch(vUv+off*0.5) + fetch(vUv-off*0.5));
            c = mix(c, blur, clamp(rng*1.6, 0.0, 0.75));
          }
        }
        c += texture(tBloom, vUv).rgb * bloomK;
        c *= exposure;
        c = acesFilm(c);
        /* 分级：lift/gain + 饱和 + 对比 */
        c = c*gain + lift*(1.0-c);
        float l = luma(c);
        c = mix(vec3(l), c, saturation);
        c = clamp((c - 0.5)*contrast + 0.5, 0.0, 1.0);
        /* 暗角 */
        vec2 q = vUv - 0.5;
        float v = 1.0 - vignette*dot(q,q)*1.34;
        c *= clamp(v, 0.0, 1.0);
        /* 颗粒（打散色带） */
        c += (ign(vUv/texel + vec2(time*61.0, time*37.0)) - 0.5) * grain;
        /* 线性 → sRGB */
        c = max(c, vec3(0.0));
        vec3 srgb = mix(c*12.92, 1.055*pow(max(c,vec3(1e-5)), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
        fragColor = vec4(srgb, 1.0);
      }`, {
      tScene: { value: null }, tBloom: { value: null },
      texel: { value: new THREE.Vector2() },
      exposure: { value: 1 }, bloomK: { value: 0.5 }, vignette: { value: 0.42 },
      grain: { value: 0.008 }, time: { value: 0 }, saturation: { value: 1.06 }, contrast: { value: 1.04 },
      fxaa: { value: 1 }, lift: { value: new THREE.Color(0.012, 0.017, 0.028) }, gain: { value: new THREE.Color(1.02, 1.0, 0.985) },
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.softwareGL ? 1 : 2);
    const cssW = Math.max(320, this.canvas.clientWidth || innerWidth);
    const cssH = Math.max(240, this.canvas.clientHeight || innerHeight);
    this.renderScale = clamp(P.get('q_renderScale') || 1, 0.4, 1.6);
    const w = Math.round(cssW * dpr * this.renderScale);
    const h = Math.round(cssH * dpr * this.renderScale);
    if (w === this.size.x && h === this.size.y) { this.applyQuality(); return; }
    this.size.set(w, h);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);   // 屏幕缓冲用 CSS 尺寸；离屏 RT 用 renderScale 缩放尺寸

    this.camera.aspect = cssW / cssH;
    this.camera.updateProjectionMatrix();

    this.sceneRT.setSize(w, h);
    this.sceneRT.depthTexture.image.width = w;
    this.sceneRT.depthTexture.image.height = h;
    this.sceneRT.depthTexture.needsUpdate = true;
    this.compRT.setSize(w, h);
    let bw = w, bh = h;
    for (let i = 0; i < this.bloomRT.length; i++) {
      bw = Math.max(2, Math.floor(bw / 2)); bh = Math.max(2, Math.floor(bh / 2));
      this.bloomRT[i].a.setSize(bw, bh);
      this.bloomRT[i].b.setSize(bw, bh);
    }
    this.pFinal.uniforms.texel.value.set(1 / w, 1 / h);
    this.applyQuality();
  }

  /** 画质相关的 RT 尺寸（半分辨率体积开关等） */
  applyQuality() {
    const volDiv = P.get('t_halfRes') ? 2 : 1;
    this.volRT.setSize(Math.max(2, Math.ceil(this.size.x / volDiv)), Math.max(2, Math.ceil(this.size.y / volDiv)));
  }

  /** 每帧推进时间（selftest 用固定步长保证可复现） */
  tick() {
    const now = performance.now() / 1000;
    const real = clamp(now - this._last, 0.0002, 0.25);
    this._last = now;
    const raw = FLAGS.fixedDt || real;
    this.dt = clamp(raw, 0.0005, 0.05) * (this.paused ? 0 : P.get('l_timeScale'));
    this.time += this.dt;
    this.frame++;
    const ms = real * 1000;
    this.perf.avg = this.perf.avg * 0.9 + ms * 0.1;
    this.perf.ms = this.perf.avg;
    this.perf.fps = 1000 / Math.max(this.perf.avg, 1e-3);
    // 体积步数自适应（不改用户参数，只作用于内部倍率）
    if (FLAGS.perf > 0) {
      this.perf.scale = FLAGS.perf;
    } else {
      const target = this.softwareGL ? 0.34 : (this.perf.fps < 34 ? 0.6 : this.perf.fps > 52 ? 1.0 : 0.85);
      this.perf.scale = damp(this.perf.scale, target, 0.6, Math.min(this.dt || 0.016, 0.05));
    }
    this.controls.update();
    return this.dt;
  }

  /** 主渲染 */
  render(scene) {
    const r = this.renderer;
    r.info.reset();

    // 1) 场景
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, this.camera);
    r.setRenderTarget(null);

    // 2+3) 体积龙卷风（内部合成 scene+volume → compRT）
    let sceneTex = this.sceneRT.texture;
    if (this.volumePass) {
      const out = this.volumePass(sceneTex, this.sceneRT.depthTexture, this.volRT, this.compRT);
      if (out) sceneTex = out;
    }

    // 4) 泛光
    const bK = P.get('l_bloom');
    if (bK > 0.001) {
      let src = sceneTex;
      for (let i = 0; i < this.bloomRT.length; i++) {
        const t = this.bloomRT[i];
        this.pDown.uniforms.tSrc.value = src;
        this.pDown.uniforms.first.value = i === 0 ? 1 : 0;
        this.pDown.uniforms.threshold.value = 1.05;
        this.pDown.uniforms.texel.value.set(1 / t.a.width, 1 / t.a.height);
        this.pDown.render(r, t.a);
        this.pBlur.uniforms.tSrc.value = t.a.texture;
        this.pBlur.uniforms.dir.value.set(1.4 / t.a.width, 0);
        this.pBlur.render(r, t.b);
        this.pBlur.uniforms.tSrc.value = t.b.texture;
        this.pBlur.uniforms.dir.value.set(0, 1.4 / t.a.height);
        this.pBlur.render(r, t.a);
        src = t.a.texture;
      }
      for (let i = this.bloomRT.length - 1; i > 0; i--) {
        this.pUp.uniforms.tSrc.value = this.bloomRT[i - 1].a.texture;
        this.pUp.uniforms.tAdd.value = this.bloomRT[i].a.texture;
        this.pUp.uniforms.k.value = 0.82;
        this.pUp.render(r, this.bloomRT[i - 1].b);
        // b → a 复用：下一次迭代读取 a，因此拷回
        const tmp = this.bloomRT[i - 1].a;
        this.bloomRT[i - 1].a = this.bloomRT[i - 1].b;
        this.bloomRT[i - 1].b = tmp;
      }
      this.pFinal.uniforms.tBloom.value = this.bloomRT[0].a.texture;
    } else {
      this.pFinal.uniforms.tBloom.value = this.bloomRT[this.bloomRT.length - 1].a.texture;
    }

    // 5) 最终
    const u = this.pFinal.uniforms;
    u.tScene.value = sceneTex;
    u.exposure.value = P.get('l_exposure');
    u.bloomK.value = bK * 0.42;
    u.time.value = this.time;
    u.fxaa.value = this.msaa ? 0.6 : 1.0;
    this.pFinal.render(r, null);
  }

  stats() {
    const i = this.renderer.info;
    return {
      fps: this.perf.fps, ms: this.perf.ms,
      calls: i.render.calls, tris: i.render.triangles,
      programs: i.programs?.length || 0,
      textures: i.memory.textures, geometries: i.memory.geometries,
      volScale: this.perf.scale,
    };
  }

  dispose() {
    removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
