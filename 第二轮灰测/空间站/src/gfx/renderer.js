/**
 * gfx/renderer.js —— 前向渲染管线
 *
 * 每帧顺序：
 *   1. 阴影通道       方向光正交投影 → 2048² 深度贴图（PCF 3×3 + 法线偏移）
 *   2. 预通道         写入深度 + 视空间法线/线性深度（与主通道共享深度纹理）
 *   3. SSAO           半分辨率 16 采样半球遮蔽 → 双边可分离模糊
 *   4. 主通道         depthFunc LEQUAL + depthMask false，零 overdraw 的前向 PBR
 *   5. 天空           全屏一次，depth 测试自动被舱体挡住
 *   6. God Rays       以太阳屏幕位置为中心的径向遮挡累积（1/4 分辨率）
 *   7. Bloom          亮度提取 → 6 级降采样 → tent 升采样
 *   8. 合成           曝光 / 镜头光斑 / 色散 / ACES / 暗角 / 颗粒 → LDR
 *   9. FXAA           输出到默认帧缓冲
 *
 * 另有按需触发的 GPU 拾取通道（低分辨率，输出舱段 ID）。
 */

import { createFullscreenTriangle } from './gl.js';
import { Program } from './shader.js';
import { RenderTarget, ShadowMap, FMT } from './target.js';
import { geometryVS, geometryFS } from './shaders/geometry.js';
import { skyVS, skyFS } from './shaders/sky.js';
import {
  fullscreenVS, ssaoFS, ssaoBlurFS, brightFS, downsampleFS, upsampleFS,
  godraysFS, compositeFS, fxaaFS, blitFS,
} from './shaders/post.js';
import { mat4, vec3, extractFrustum, sphereInFrustum, mulberry32 } from '../core/math.js';

const SHADOW_SIZE = 2048;
const SSAO_KERNEL = 16;
const BLOOM_LEVELS = 6;

export class Renderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {import('./gl.js').GLCaps} caps
   */
  constructor(gl, caps) {
    this.gl = gl;
    this.caps = caps;
    this.hdrFormat = caps.colorBufferFloat ? FMT.RGBA16F : FMT.RGBA8;

    this.tri = createFullscreenTriangle(gl);

    const defs = { SHADOW_SIZE: `${SHADOW_SIZE}.0` };
    this.progShadow = new Program(gl, geometryVS, geometryFS, { name: 'geo/shadow', defines: { ...defs, PASS_SHADOW: true } });
    this.progPrepass = new Program(gl, geometryVS, geometryFS, { name: 'geo/prepass', defines: { ...defs, PASS_PREPASS: true } });
    this.progMain = new Program(gl, geometryVS, geometryFS, { name: 'geo/main', defines: { ...defs, PASS_MAIN: true } });
    this.progPick = new Program(gl, geometryVS, geometryFS, { name: 'geo/pick', defines: { ...defs, PASS_PICK: true } });
    this.progSky = new Program(gl, skyVS, skyFS, { name: 'sky' });
    this.progSSAO = new Program(gl, fullscreenVS, ssaoFS, { name: 'ssao', defines: { KERNEL_SIZE: SSAO_KERNEL } });
    this.progSSAOBlur = new Program(gl, fullscreenVS, ssaoBlurFS, { name: 'ssao/blur' });
    this.progBright = new Program(gl, fullscreenVS, brightFS, { name: 'bloom/bright' });
    this.progDown = new Program(gl, fullscreenVS, downsampleFS, { name: 'bloom/down' });
    this.progUp = new Program(gl, fullscreenVS, upsampleFS, { name: 'bloom/up' });
    this.progRays = new Program(gl, fullscreenVS, godraysFS, { name: 'godrays' });
    this.progComposite = new Program(gl, fullscreenVS, compositeFS, { name: 'composite' });
    this.progFXAA = new Program(gl, fullscreenVS, fxaaFS, { name: 'fxaa' });
    this.progBlit = new Program(gl, fullscreenVS, blitFS, { name: 'blit' });

    this.shadow = new ShadowMap(gl, SHADOW_SIZE);

    // 目标在首次 resize 时创建
    this.width = 0; this.height = 0;
    /** @type {RenderTarget[]} */
    this.bloomChain = [];

    this.kernel = buildKernel(SSAO_KERNEL);
    this._whiteAO = makeSolidTexture(gl, 255);

    // 复用的矩阵与向量，避免每帧分配
    this._m = {
      lightView: mat4.create(), lightProj: mat4.create(), lightVP: mat4.create(),
      invVP: mat4.create(), tmp: mat4.create(),
    };
    this._v = { eye: vec3.create(), center: vec3.create(), up: vec3.create(0, 1, 0), tmp: vec3.create() };
    this._frustum = new Float32Array(24);

    this.stats = { drawCalls: 0, triangles: 0, culled: 0, passes: 0 };
    this._identity = mat4.create();
  }

  /** 调整所有渲染目标尺寸 */
  resize(width, height) {
    width = Math.max(2, Math.floor(width));
    height = Math.max(2, Math.floor(height));
    if (width === this.width && height === this.height) return;
    const gl = this.gl;
    this.width = width; this.height = height;
    const half = [Math.max(1, width >> 1), Math.max(1, height >> 1)];
    const quarter = [Math.max(1, width >> 2), Math.max(1, height >> 2)];

    const mk = (opts) => new RenderTarget(gl, opts);

    if (!this.sceneRT) {
      this.sceneRT = mk({ width, height, colors: [this.hdrFormat], depth: 'texture', name: 'scene' });
      this.normalRT = mk({ width, height, colors: [FMT.RGBA16F], sharedDepth: this.sceneRT.depthTexture, name: 'normal' });
      this.aoRT = mk({ width: half[0], height: half[1], colors: [FMT.R8], name: 'ao' });
      this.aoTmpRT = mk({ width: half[0], height: half[1], colors: [FMT.R8], name: 'aoTmp' });
      this.raysRT = mk({ width: quarter[0], height: quarter[1], colors: [this.hdrFormat], name: 'rays' });
      this.ldrRT = mk({ width, height, colors: [FMT.RGBA8], name: 'ldr' });
      this.pickRT = mk({ width: Math.max(2, width >> 1), height: Math.max(2, height >> 1), colors: [FMT.RGBA8], depth: true, linear: false, name: 'pick' });
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        const w = Math.max(1, width >> (i + 1)), h = Math.max(1, height >> (i + 1));
        this.bloomChain.push(mk({ width: w, height: h, colors: [this.hdrFormat], name: `bloom${i}` }));
      }
    } else {
      this.sceneRT.resize(width, height);
      this.normalRT.resize(width, height);
      this.normalRT.setSharedDepth(this.sceneRT.depthTexture);
      this.aoRT.resize(half[0], half[1]);
      this.aoTmpRT.resize(half[0], half[1]);
      this.raysRT.resize(quarter[0], quarter[1]);
      this.ldrRT.resize(width, height);
      this.pickRT.resize(Math.max(2, width >> 1), Math.max(2, height >> 1));
      this.bloomChain.forEach((rt, i) => rt.resize(Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1))));
    }
  }

  /* ════════════════════ 主渲染入口 ════════════════════ */

  /**
   * @param {object} scene  { modules, sun, env, radius }
   * @param {object} camera { view, proj, viewProj, position, fovY, aspect, near, far }
   * @param {object} S      渲染设置
   */
  render(scene, camera, S) {
    const gl = this.gl;
    this.stats.drawCalls = 0; this.stats.triangles = 0; this.stats.culled = 0; this.stats.passes = 0;

    const visible = scene.modules.filter((m) => m.visible && m.mesh);
    extractFrustum(this._frustum, camera.viewProj);

    /* ── 1. 阴影通道 ── */
    this._buildLightMatrix(scene);
    if (S.shadows) {
      const p = this.progShadow.use();
      this.shadow.bind();
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.colorMask(false, false, false, false);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE);
      p.mat4('uViewProj', this._m.lightVP);
      p.mat4('uView', this._m.lightView);
      p.float('uNormalBias', 1.35);
      p.float('uTime', S.time);
      p.int('uMode', 0);
      for (const m of visible) this._drawModule(p, m, S, false);
      gl.colorMask(true, true, true, true);
      this.stats.passes++;
    } else {
      this.shadow.bind();
      gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    /* ── 2. 预通道（深度 + 视空间法线/线性深度） ── */
    this.normalRT.bind();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    {
      const p = this.progPrepass.use();
      p.mat4('uViewProj', camera.viewProj);
      p.mat4('uView', camera.view);
      p.float('uTime', S.time);
      p.int('uMode', S.mode);
      p.vec3('uCamPos', camera.position);
      for (const m of visible) this._drawModule(p, m, S, true);
      this.stats.passes++;
    }

    /* ── 3. SSAO ── */
    if (S.ssao > 0.001) {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      this.aoRT.bind();
      const p = this.progSSAO.use();
      p.texture('uND', 0, this.normalRT.texture);
      p.mat4('uProj', camera.proj);
      p.vec3s('uKernel', this.kernel);
      p.vec2('uRes', this.aoRT.width, this.aoRT.height);
      p.float('uTanHalfY', Math.tan(camera.fovY / 2));
      p.float('uAspect', camera.aspect);
      p.float('uRadius', S.ssaoRadius);
      p.float('uBias', 0.35);
      p.float('uIntensity', 1.0);
      this.tri.draw();
      // 双边可分离模糊
      const b = this.progSSAOBlur.use();
      this.aoTmpRT.bind();
      b.texture('uAO', 0, this.aoRT.texture);
      b.texture('uND', 1, this.normalRT.texture);
      b.vec2('uDir', 1 / this.aoRT.width, 0);
      this.tri.draw();
      this.aoRT.bind();
      b.texture('uAO', 0, this.aoTmpRT.texture);
      b.texture('uND', 1, this.normalRT.texture);
      b.vec2('uDir', 0, 1 / this.aoRT.height);
      this.tri.draw();
      this.stats.passes += 3;
    }

    /* ── 4. 主通道 ── */
    this.sceneRT.bind();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);           // 深度沿用预通道结果
    {
      const p = this.progMain.use();
      p.mat4('uViewProj', camera.viewProj);
      p.mat4('uView', camera.view);
      p.mat4('uShadowVP', this._m.lightVP);
      p.vec3('uCamPos', camera.position);
      p.vec3('uSunDir', scene.sun.dir);
      p.vec3('uSunColor', scene.sun.color);
      p.vec3('uSkyColor', scene.env.skyColor);
      p.vec3('uGroundColor', scene.env.groundColor);
      p.vec3('uEarthColor', scene.env.earthColor);
      p.vec3('uEarthDir', scene.env.earthDir);
      p.vec3('uFillColor', scene.env.fillColor);
      p.vec3('uHighlightColor', S.highlightColor);
      p.float('uTime', S.time);
      p.float('uShadowStrength', S.shadows ? S.shadowStrength : 0);
      p.float('uAOStrength', S.ssao);
      p.float('uEmissiveBoost', S.emissive);
      p.float('uDetail', S.detail);
      p.int('uMode', S.mode);
      p.vec2('uInvRes', 1 / this.width, 1 / this.height);
      p.texture('uShadowMap', 4, this.shadow.texture);
      p.texture('uAOTex', 5, S.ssao > 0.001 ? this.aoRT.texture : this._whiteAO);
      for (const m of visible) this._drawModule(p, m, S, true);
      this.stats.passes++;
    }

    /* ── 5. 天空（含地球与太阳） ── */
    {
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      mat4.invert(this._m.invVP, camera.viewProj);
      const p = this.progSky.use();
      p.mat4('uInvViewProj', this._m.invVP);
      p.vec3('uCamPos', camera.position);
      p.vec3('uSunDir', scene.sun.dir);
      p.vec3('uSunColor', scene.sun.color);
      p.vec3('uEarthCenter', scene.env.earthCenter);
      p.vec3('uGalaxyAxis', scene.env.galaxyAxis);
      p.float('uEarthRadius', scene.env.earthRadius);
      p.float('uTime', S.time);
      p.float('uStarBoost', S.stars);
      p.float('uNebulaBoost', S.nebula);
      p.float('uEarthOn', S.earth ? 1 : 0);
      this.tri.draw();
      this.stats.drawCalls++; this.stats.passes++;
    }

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);

    /* ── 6. God Rays ── */
    const sunUV = this._sunScreenPos(scene, camera);
    this.raysRT.bind();
    {
      const p = this.progRays.use();
      p.texture('uSrc', 0, this.sceneRT.texture);
      p.texture('uND', 1, this.normalRT.texture);
      p.vec2('uSunUV', sunUV[0], sunUV[1]);
      p.float('uDensity', 0.85);
      p.float('uDecay', 0.955);
      p.float('uWeight', 3.4);
      p.float('uOn', S.godrays > 0.001 && sunUV[2] > 0 ? 1 : 0);
      this.tri.draw();
      this.stats.passes++;
    }

    /* ── 7. Bloom ── */
    {
      const bp = this.progBright.use();
      this.bloomChain[0].bind();
      bp.texture('uSrc', 0, this.sceneRT.texture);
      bp.float('uThreshold', S.bloomThreshold);
      bp.float('uKnee', 0.55);
      bp.float('uClamp', 12.0);        // 限制单像素进入泛光链的能量，避免太阳把全屏抬亮
      this.tri.draw();

      const dp = this.progDown.use();
      for (let i = 1; i < BLOOM_LEVELS; i++) {
        const src = this.bloomChain[i - 1], dst = this.bloomChain[i];
        dst.bind();
        dp.texture('uSrc', 0, src.texture);
        dp.vec2('uTexel', 1 / src.width, 1 / src.height);
        this.tri.draw();
      }
      const up = this.progUp.use();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
        const src = this.bloomChain[i], dst = this.bloomChain[i - 1];
        dst.bind();
        up.texture('uSrc', 0, src.texture);
        up.vec2('uTexel', 1 / src.width, 1 / src.height);
        up.float('uRadius', 1.15);
        this.tri.draw();
      }
      gl.disable(gl.BLEND);
      this.stats.passes += BLOOM_LEVELS * 2;
    }

    /* ── 8. 合成 ── */
    this.ldrRT.bind();
    {
      const p = this.progComposite.use();
      p.texture('uHDR', 0, this.sceneRT.texture);
      p.texture('uBloom', 1, this.bloomChain[0].texture);
      p.texture('uRays', 2, this.raysRT.texture);
      p.float('uExposure', S.exposure);
      p.float('uBloomStrength', S.bloom);
      p.float('uRayStrength', S.godrays);
      p.float('uVignette', S.vignette);
      p.float('uGrain', S.grain);
      p.float('uChroma', S.chroma);
      p.float('uTime', S.time);
      p.vec2('uSunUV', sunUV[0], sunUV[1]);
      p.float('uSunVisible', sunUV[2] * S.flare);
      p.vec3('uSunTint', scene.sun.color);
      p.float('uAspect', camera.aspect);
      this.tri.draw();
      this.stats.passes++;
    }

    /* ── 9. FXAA → 屏幕 ── */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    {
      const p = this.progFXAA.use();
      p.texture('uTex', 0, this.ldrRT.texture);
      p.vec2('uInvRes', 1 / this.width, 1 / this.height);
      p.float('uOn', S.fxaa ? 1 : 0);
      this.tri.draw();
      this.stats.passes++;
    }
  }

  /* ════════════════════ GPU 拾取 ════════════════════ */

  /**
   * 在指定像素坐标处拾取舱段。
   * @returns {number} 舱段索引，-1 表示空
   */
  pick(scene, camera, px, py, S) {
    const gl = this.gl;
    const rt = this.pickRT;
    const sx = Math.floor(px * rt.width / this.width);
    const sy = Math.floor((this.height - py) * rt.height / this.height);
    if (sx < 0 || sy < 0 || sx >= rt.width || sy >= rt.height) return -1;

    rt.bind();
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.max(0, sx - 1), Math.max(0, sy - 1), 3, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = this.progPick.use();
    p.mat4('uViewProj', camera.viewProj);
    p.mat4('uView', camera.view);
    p.vec3('uCamPos', camera.position);
    p.float('uTime', S.time);
    p.int('uMode', 0);                      // 拾取不受显示模式影响
    let idx = 0;
    for (const m of scene.modules) {
      idx++;
      if (!m.visible || !m.mesh) continue;
      p.vec3('uPickColor', (idx & 255) / 255, ((idx >> 8) & 255) / 255, 0);
      this._drawModule(p, m, S, true, /* forcePick */ true);
    }
    const buf = new Uint8Array(4);
    gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const id = buf[0] + (buf[1] << 8);
    return id === 0 ? -1 : id - 1;
  }

  /* ════════════════════ 内部工具 ════════════════════ */

  _drawModule(p, m, S, doCull, forcePick = false) {
    if (doCull && m.boundsRadius) {
      const c = m.worldCenter;
      if (!sphereInFrustum(this._frustum, c[0], c[1], c[2], m.boundsRadius)) { this.stats.culled++; return; }
    }
    p.mat4('uModel', m.matrix);
    p.vec3('uOrigin', m.mesh.origin[0], m.mesh.origin[1], m.mesh.origin[2]);
    if (!forcePick) {
      p.float('uOpacity', m.opacity);
      p.float('uHighlight', m.highlight);
      p.float('uDim', m.dim);
    } else {
      p.float('uOpacity', 1);
    }
    m.mesh.draw();
    this.stats.drawCalls++;
    this.stats.triangles += m.mesh.triangleCount;
  }

  /** 为方向光拟合正交投影包围盒 */
  _buildLightMatrix(scene) {
    const R = scene.radius * 1.05;
    const { eye, center, up } = this._v;
    vec3.set(center, 0, 0, 0);
    vec3.addScaled(eye, center, scene.sun.dir, R * 2.2);
    // 避免 up 与光线共线
    if (Math.abs(scene.sun.dir[1]) > 0.985) vec3.set(up, 0, 0, 1);
    else vec3.set(up, 0, 1, 0);
    mat4.lookAt(this._m.lightView, eye, center, up);
    mat4.ortho(this._m.lightProj, -R, R, -R, R, 0.1, R * 4.5);
    mat4.multiply(this._m.lightVP, this._m.lightProj, this._m.lightView);
  }

  /** 太阳的屏幕 uv 与可见度（0..1） */
  _sunScreenPos(scene, camera) {
    const d = scene.sun.dir;
    const far = camera.far * 0.85;
    const t = this._v.tmp;
    vec3.set(t, camera.position[0] + d[0] * far, camera.position[1] + d[1] * far, camera.position[2] + d[2] * far);
    const m = camera.viewProj;
    const x = t[0], y = t[1], z = t[2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0) return [0.5, 0.5, 0];
    const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
    const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
    const u = cx * 0.5 + 0.5, v = cy * 0.5 + 0.5;
    // 越靠画面外越弱
    const fade = Math.max(0, 1 - Math.max(Math.abs(cx), Math.abs(cy))) ;
    return [u, v, Math.min(1, fade * 1.6)];
  }

  /**
   * 诊断用：回读最终 LDR 画面并统计像素分布。
   * 用于自动化自检（确认画面不是全黑、也没有被整体提亮、色彩层次是否充分），
   * 也便于排查不同驱动之间的差异。
   * @param {number} [step] 采样步长（像素）
   */
  readbackStats(step = 4) {
    const gl = this.gl;
    const rt = this.ldrRT;
    const w = rt.width, h = rt.height;
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    let nonBlack = 0, sum = 0, max = 0, n = 0;
    const buckets = new Set();
    const hist = new Uint32Array(8);      // 每 32 灰阶一档
    const lums = [];
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        if (lum > 6) nonBlack++;
        sum += lum;
        if (lum > max) max = lum;
        hist[Math.min(7, lum >> 5)]++;
        buckets.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4));
        lums.push(lum);
        n++;
      }
    }
    lums.sort((a, b) => a - b);
    const pct = (p) => +lums[Math.min(lums.length - 1, Math.floor(lums.length * p))].toFixed(1);
    const at = (x, y) => {
      const i = ((h - 1 - y) * w + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    };
    return {
      width: w, height: h,
      nonBlack: +(nonBlack / n).toFixed(4),
      mean: +(sum / n).toFixed(2),
      max: +max.toFixed(1),
      unique: buckets.size,
      /** 亮度分位数：暗部/中间调/亮部的分布 */
      p05: pct(0.05), p25: pct(0.25), p50: pct(0.5), p75: pct(0.75), p95: pct(0.95),
      /** 每 32 灰阶一档的占比 */
      hist: [...hist].map((c) => +(c / n).toFixed(4)),
      corners: [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3), at(w >> 1, h >> 1)],
    };
  }

  dispose() {
    for (const k of ['progShadow', 'progPrepass', 'progMain', 'progPick', 'progSky', 'progSSAO',
      'progSSAOBlur', 'progBright', 'progDown', 'progUp', 'progRays', 'progComposite', 'progFXAA', 'progBlit']) {
      this[k]?.dispose();
    }
    for (const k of ['sceneRT', 'normalRT', 'aoRT', 'aoTmpRT', 'raysRT', 'ldrRT', 'pickRT']) this[k]?.dispose();
    for (const rt of this.bloomChain) rt.dispose();
    this.shadow.dispose();
    this.tri.dispose();
    this.gl.deleteTexture(this._whiteAO);
  }
}

/** 生成半球采样核（越靠中心密度越高） */
function buildKernel(n) {
  const rnd = mulberry32(0x51ce);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x, y, z, l;
    do {
      x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd();
      l = Math.hypot(x, y, z);
    } while (l < 0.15 || l > 1);
    let scale = i / n;
    scale = 0.12 + 0.88 * scale * scale;
    out[i * 3] = (x / l) * scale;
    out[i * 3 + 1] = (y / l) * scale;
    out[i * 3 + 2] = (z / l) * scale;
  }
  return out;
}

function makeSolidTexture(gl, v) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([v, v, v, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
