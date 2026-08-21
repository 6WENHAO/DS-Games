/* =======================================================================
 *  renderer.js  —  渲染管线
 *  背景星云 → 恒星点云 → 不透明天体 → 半透明（云 / 大气 / 环 / 冲击环）
 *  → 特效（粒子 / 尾迹 / 闪光 / 日冕）→ Bloom → ACES 合成
 *  深度使用对数深度缓冲，天体位置全部转成“相机相对”以规避浮点精度崩塌
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const M = SS.M, V = SS.M.v3, M3 = SS.M.m3, M4 = SS.M.m4;

  // 使得地球处（1 AU）的太阳辐照度归一化为 1
  const AU_UNITS = 149597.8707;
  const SUN_I = AU_UNITS * AU_UNITS;

  const QUALITY = {
    low: { oct: 4, crLayers: 1, scale: 0.72, sphere: [2, 3, 4, 4], stars: 2200, bloom: 2 },
    mid: { oct: 6, crLayers: 2, scale: 1.0, sphere: [3, 4, 5, 5], stars: 3600, bloom: 3 },
    high: { oct: 8, crLayers: 3, scale: 1.0, sphere: [3, 4, 5, 6], stars: 5200, bloom: 3 },
    ultra: { oct: 9, crLayers: 3, scale: 1.35, sphere: [3, 5, 6, 6], stars: 6400, bloom: 3 },
  };

  const R = {
    gl: null, canvas: null,
    W: 1, H: 1, RW: 1, RH: 1,
    quality: 'mid',
    prog: {}, mesh: {}, rt: {},
    settings: {
      exposure: 1.0, bloom: 0.8, sizeBoost: 1, reliefGain: 1,
      showOrbits: true, showStars: true, showAtmo: true, showFX: true,
      grain: 0.012, vignette: 0.55, chroma: 0.0006, galaxy: 1.0,
    },
    stats: { tris: 0, draws: 0 },
  };

  /* ------------------------------------------------------------------ *
   *  初始化
   * ------------------------------------------------------------------ */
  R.init = function (gl, canvas) {
    R.gl = gl; R.canvas = canvas;
    const GL = SS.GL, S = SS.SH;

    R.prog.bg = GL.program(gl, S.bgVS, S.bgFS, 'bg');
    R.prog.star = GL.program(gl, S.starVS, S.starFS, 'star');
    R.prog.planet = GL.program(gl, S.planetVS, S.planetFS, 'planet');
    R.prog.cloud = GL.program(gl, S.cloudVS, S.cloudFS, 'cloud');
    R.prog.atmo = GL.program(gl, S.atmoVS, S.atmoFS, 'atmo');
    R.prog.ring = GL.program(gl, S.ringVS, S.ringFS, 'ring');
    R.prog.sun = GL.program(gl, S.sunVS, S.sunFS, 'sun');
    R.prog.corona = GL.program(gl, S.coronaVS, S.coronaFS, 'corona');
    R.prog.scar = GL.program(gl, S.scarVS, S.scarFS, 'scar');
    R.prog.surfRing = GL.program(gl, S.surfRingVS, S.surfRingFS, 'surfRing');
    R.prog.part = GL.program(gl, S.partVS, S.partFS, 'part');
    R.prog.trail = GL.program(gl, S.trailVS, S.trailFS, 'trail');
    R.prog.flash = GL.program(gl, S.flashVS, S.flashFS, 'flash');
    R.prog.orbit = GL.program(gl, S.orbitVS, S.orbitFS, 'orbit');
    R.prog.bright = GL.program(gl, S.postVS, S.brightFS, 'bright');
    R.prog.blur = GL.program(gl, S.postVS, S.blurFS, 'blur');
    R.prog.meter = GL.program(gl, S.postVS, S.meterFS, 'meter');
    R.prog.probe = GL.program(gl, S.postVS, S.probeFS, 'probe');
    R.prog.comp = GL.program(gl, S.postVS, S.compositeFS, 'composite');

    const missing = Object.keys(R.prog).filter((k) => !R.prog[k]);
    if (missing.length) {
      SS.diag.push('error', '以下着色器程序创建失败：' + missing.join(', '));
      return false;
    }

    buildMeshes();
    R.emptyScar = GL.texture2D(gl, {
      width: 1, height: 1, internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.FLOAT,
      data: new Float32Array([0, 0, 0, 0]), min: gl.NEAREST, mag: gl.NEAREST,
    });
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    return true;
  };

  function buildMeshes() {
    const gl = R.gl, GL = SS.GL, Geo = SS.Geo;
    const q = QUALITY[R.quality];

    // 共享球体（不同细分等级）
    R.mesh.spheres = [];
    const levels = [2, 3, 4, 5, 6];
    for (const lv of levels) {
      const ico = Geo.icosphere(lv);
      R.mesh.spheres.push({
        level: lv,
        mesh: GL.mesh(gl, [{ loc: 0, size: 3, data: ico.positions }], ico.indices),
        tris: ico.triCount,
      });
    }

    // 全屏三角形
    R.mesh.fs = GL.mesh(gl, [{ loc: 0, size: 2, data: Geo.fullscreenQuad() }], null);
    // 广告牌四边形
    R.mesh.quad = GL.mesh(gl, [{
      loc: 0, size: 2,
      data: new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
    }], null);

    // 恒星点云
    const sd = Geo.starField(q.stars);
    const dir = new Float32Array(q.stars * 3), mag = new Float32Array(q.stars);
    const col = new Float32Array(q.stars * 3), ph = new Float32Array(q.stars);
    for (let i = 0; i < q.stars; i++) {
      dir[i * 3] = sd[i * 8]; dir[i * 3 + 1] = sd[i * 8 + 1]; dir[i * 3 + 2] = sd[i * 8 + 2];
      mag[i] = sd[i * 8 + 3];
      col[i * 3] = sd[i * 8 + 4]; col[i * 3 + 1] = sd[i * 8 + 5]; col[i * 3 + 2] = sd[i * 8 + 6];
      ph[i] = sd[i * 8 + 7];
    }
    if (R.mesh.stars) {
      R.mesh.stars.buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteVertexArray(R.mesh.stars.vao);
    }
    R.mesh.stars = GL.mesh(gl, [
      { loc: 0, size: 3, data: dir },
      { loc: 1, size: 1, data: mag },
      { loc: 2, size: 3, data: col },
      { loc: 3, size: 1, data: ph },
    ], null, gl.POINTS);

    // 轨道线
    if (!R.mesh.orbit) {
      const N = 360;
      const t = new Float32Array(N + 1);
      for (let i = 0; i <= N; i++) t[i] = i / N;
      R.mesh.orbit = GL.mesh(gl, [{ loc: 0, size: 1, data: t }], null, gl.LINE_STRIP);
    }

    // 行星环（按天体各自的内外半径生成）
    if (!R.mesh.rings) {
      R.mesh.rings = {};
      for (const b of SS.World.bodies) {
        const lk = b.def.look;
        if (!lk.ringOuter) continue;
        const g = Geo.ring(lk.ringInner, lk.ringOuter, 320);
        R.mesh.rings[b.id] = GL.mesh(gl, [{ loc: 0, size: 4, data: g.data }], g.indices);
      }
    }

    // 粒子 / 尾迹的动态缓冲
    if (!R.mesh.part) {
      const MAXP = SS.FX.P.attr.length / 4;
      R.partPos = new Float32Array(MAXP * 3);
      R.mesh.part = GL.mesh(gl, [
        { loc: 0, size: 3, data: R.partPos, dynamic: true },
        { loc: 1, size: 4, data: SS.FX.draw.attr, dynamic: true },
      ], null, gl.POINTS);
      R.ribbonPos = new Float32Array(256 * 3);
      R.ribbonAttr = new Float32Array(256 * 2);
      R.mesh.trail = GL.mesh(gl, [
        { loc: 0, size: 3, data: R.ribbonPos, dynamic: true },
        { loc: 1, size: 2, data: R.ribbonAttr, dynamic: true },
      ], null, gl.TRIANGLE_STRIP);
    }
  }

  R.setQuality = function (name) {
    if (!QUALITY[name]) return;
    R.quality = name;
    buildMeshes();
    R.resize(R.W, R.H, true);
  };

  R.resize = function (w, h, force) {
    const gl = R.gl;
    const q = QUALITY[R.quality];
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const RW = Math.max(64, Math.floor(w * dpr * q.scale));
    const RH = Math.max(64, Math.floor(h * dpr * q.scale));
    if (!force && RW === R.RW && RH === R.RH) return;
    R.W = w; R.H = h; R.RW = RW; R.RH = RH;
    R.canvas.width = RW;
    R.canvas.height = RH;
    R.canvas.style.width = w + 'px';
    R.canvas.style.height = h + 'px';
    SS.Cam.aspect = RW / RH;

    const GL = SS.GL;
    ['scene', 'b1', 'b1t', 'b2', 'b2t', 'b3', 'b3t'].forEach((k) => {
      if (R.rt[k]) R.rt[k].dispose();
    });
    R.rt.scene = GL.renderTarget(gl, RW, RH, { depth: true });
    const mk = (d) => GL.renderTarget(gl, Math.max(2, RW >> d), Math.max(2, RH >> d), {});
    R.rt.b1 = mk(1); R.rt.b1t = mk(1);
    R.rt.b2 = mk(2); R.rt.b2t = mk(2);
    R.rt.b3 = mk(3); R.rt.b3t = mk(3);
    if (!R.rt.meter) {
      R.rt.meter = GL.renderTarget(gl, 8, 8, { internalFormat: gl.RGBA8, min: gl.NEAREST, mag: gl.NEAREST });
      R.meterPix = new Uint8Array(8 * 8 * 4);
    }
  };

  /* ------------------------------------------------------------------ *
   *  自动曝光：把场景降采样成 8x8 对数亮度图并读回，按几何平均定曝光。
   *  和真实相机一样对画面实际亮度反应 —— 白热熔体会让相机自动收光圈。
   * ------------------------------------------------------------------ */
  R.expo = 1;
  function meterExposure(dt, guess) {
    const gl = R.gl;
    let lum = -1;
    try {
      R.rt.meter.bind();
      R.prog.meter.use()
        .tex('uTex', 0, R.rt.scene.color.handle)
        .v2('uCell', 1 / 8, 1 / 8);
      R.mesh.fs.draw();
      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, R.meterPix);
      // 先找最亮格，只统计落在其 6 档以内的格子 —— 等价于"忽略空无一物的黑天"
      let mx = -99;
      const l2 = new Float32Array(64);
      for (let i = 0; i < 64; i++) {
        l2[i] = (R.meterPix[i * 4] / 255 - 0.5) * 32;
        if (l2[i] > mx) mx = l2[i];
      }
      const floor = mx - 6;
      let s = 0, wsum = 0;
      for (let i = 0; i < 64; i++) {
        if (l2[i] < floor || l2[i] < -15.5) continue;
        const cx = (i % 8) - 3.5, cy = Math.floor(i / 8) - 3.5;
        const r2 = (cx * cx + cy * cy) / 24.5;
        const w = 0.4 + 0.6 * Math.exp(-2 * r2);   // 中央重点测光
        s += l2[i] * w; wsum += w;
      }
      if (wsum > 0) lum = Math.pow(2, s / wsum);
    } catch (e) { lum = -1; }
    const KEY = 0.17;                              // 目标中灰（标准 18% 灰附近）
    let target = lum > 0 ? KEY / lum : guess;
    // 只允许在"辐照度推出的物理曝光"上下 2 档内修正，避免黑天/白热熔体把测光带跑
    target = M.clamp(target, guess * 0.25, guess * 4);
    const tau = target < R.expo ? 0.35 : 1.1;      // 亮→暗收得快，暗→亮放得慢
    R.expo += (target - R.expo) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
    if (!isFinite(R.expo) || R.expo <= 0) R.expo = guess;
    return R.expo;
  }

  /* ------------------------------------------------------------------ *
   *  伤痕图：惰性分配 + 撞击坑烘焙
   * ------------------------------------------------------------------ */
  function ensureScar(body) {
    if (body.scar) return body.scar;
    const gl = R.gl;
    const big = body.def.radius >= 3000;
    const w = big ? 2048 : 1024, h = big ? 1024 : 512;
    const tex = SS.GL.texture2D(gl, {
      width: w, height: h, internalFormat: gl.RGBA16F,
      min: gl.LINEAR, mag: gl.LINEAR, wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE,
    });
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.handle, 0);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.DEPTH_TEST);
    body.scar = { tex, fbo, w, h };
    return body.scar;
  }

  R.clearScar = function (body) {
    if (!body.scar) return;
    const gl = R.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, body.scar.fbo);
    gl.viewport(0, 0, body.scar.w, body.scar.h);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.DEPTH_TEST);
  };

  /** 把一个撞击坑加性烘焙进伤痕图（历史沉积） */
  R.bakeCrater = function (body, c) {
    const gl = R.gl;
    const sc = ensureScar(body);
    const p = R.prog.scar;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sc.fbo);
    gl.viewport(0, 0, sc.w, sc.h);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    p.use();
    p.v3('uCenter', c.dir);
    p.f('uAngR', c.angR).f('uDepth', c.depth).f('uRim', c.rim).f('uPeak', c.peak);
    p.f('uEjectaRef', c.ejecta).f('uRayReach', c.rayReach);
    p.f('uAlbFloor', c.albFloor).f('uAlbRay', c.albRay).f('uMelt', c.melt);
    p.f('uType', c.type).f('uSeed', c.seed).f('uTerrace', c.terrace);
    R.mesh.fs.draw();
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  function flushBakeQueue() {
    for (const b of SS.World.bodies) {
      if (b.scarDirty === 'clear') { R.clearScar(b); b.scarDirty = null; }
      if (b.bakeQueue && b.bakeQueue.length) {
        for (const c of b.bakeQueue) R.bakeCrater(b, c);
        b.bakeQueue.length = 0;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  逐帧
   * ------------------------------------------------------------------ */
  const scratch = { occ: new Float32Array(12), occR: new Float32Array(4) };

  R.frame = function (dt) {
    const gl = R.gl, Cam = SS.Cam, W = SS.World;
    const st = R.settings;
    const q = QUALITY[R.quality];
    R.stats.draws = 0; R.stats.tris = 0;

    flushBakeQueue();

    const sun = W.byId.sun;
    const camPos = Cam.pos;
    const sunRel = [sun.pos[0] - camPos[0], sun.pos[1] - camPos[1], sun.pos[2] - camPos[2]];
    const sunColor = [1.0, 0.965, 0.92];

    // 曝光估计：先用锁定天体所受辐照度给一个初值，再由测光结果收敛
    const focus = Cam.focus || W.byId.earth;
    const dFocus = Math.max(V.dist(focus.pos, sun.pos), sun.radius * 1.2);
    const irrFocus = SUN_I / (dFocus * dFocus);
    const guess = focus.id === 'sun' ? 0.055
      : M.clamp(Math.pow(1 / Math.max(irrFocus, 1e-6), 0.85), 0.04, 150);
    if (!R.expoReady) { R.expo = guess; R.expoReady = true; }
    // 星空与银河不随曝光漂移（合成上的选择，见 README「已知的简化」）
    const skyGain = 1 / Math.max(R.expo, 1e-6);

    // ---- 场景 FBO ----
    R.rt.scene.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // ---- 背景 ----
    if (st.showStars) {
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);
      M4.mul(Cam.proj, Cam.view, Cam.viewProj);
      const inv = invertViewProj();
      R.prog.bg.use().m4('uInvViewProj', inv).f('uGalaxy', st.galaxy * skyGain);
      R.mesh.fs.draw();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      R.prog.star.use()
        .m4('uViewProj', Cam.viewProj)
        .f('uDist', 3.0e7).f('uTime', W.fxTime)
        .f('uPixelScale', Math.max(1, R.RH / 900))
        .f('uBright', 0.16 * skyGain);
      R.mesh.stars.draw();
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    }

    // ---- 排序 + 屏幕尺寸 ----
    const list = [];
    for (const b of W.bodies) {
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const dist = V.len(rel);
      const sr = Cam.screenRadius(b, R.RH, st.sizeBoost);
      b.screenSize = sr;
      list.push({ b, rel, dist, sr });
    }
    list.sort((a, c) => c.dist - a.dist);

    // ---- 不透明天体 ----
    for (const it of list) {
      const b = it.b;
      if (it.sr < 1.1) continue;       // 太小 → 后面用发光点绘制
      if (b.id === 'sun') drawSun(b, it, sunRel, sunColor);
      else drawPlanet(b, it, sunRel, sunColor, q);
    }

    // ---- 半透明 ----
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    for (const it of list) {
      const b = it.b;
      if (it.sr < 1.1) continue;
      const lk = b.def.look;
      // 云层
      if (lk.cloud > 0.02 && b.def.atmo) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        drawCloud(b, it, sunRel, sunColor);
      }
      // 表面事件环
      if (b.rings.length) {
        gl.blendFunc(gl.ONE, gl.ONE);
        drawSurfRings(b, it, sunRel);
      }
      // 大气
      if (st.showAtmo && b.def.atmo) {
        gl.blendFunc(gl.ONE, gl.ONE);
        drawAtmo(b, it, sunRel, sunColor);
      }
      // 行星环
      if (lk.ringOuter && R.mesh.rings[b.id]) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        drawRing(b, it, sunRel, sunColor);
      }
    }

    // ---- 远处天体：发光点 ----
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const it of list) {
      if (it.sr >= 1.1) continue;
      drawBodyPoint(it, sunRel, sunColor);
    }

    // ---- 日冕 ----
    {
      const it = list.find((x) => x.b.id === 'sun');
      if (it && it.sr > 0.6) drawCorona(it);
    }

    // ---- 轨道线 ----
    if (st.showOrbits) {
      gl.blendFunc(gl.ONE, gl.ONE);
      drawOrbits(camPos);
    }

    // ---- 特效 ----
    if (st.showFX) {
      gl.blendFunc(gl.ONE, gl.ONE);
      drawParticles(camPos);
      drawTrails(camPos);
      drawFlashes(camPos);
    }

    gl.disable(gl.BLEND);
    gl.depthMask(true);

    // ---- 后处理（内含测光 → 自动曝光）----
    const exposure = post(dt, guess);
    return { exposure, irrFocus };
  };

  function invertViewProj() {
    // 只需要方向：用视图基与投影参数直接构造逆矩阵
    const Cam = SS.Cam;
    const th = Math.tan(Cam.fov / 2);
    const m = new Float32Array(16);
    // 列 0..2 为相机基（缩放到 NDC → 视线方向），列 3 为原点
    const r = Cam.right, u = Cam.up, b = Cam.back;
    m[0] = r[0] * th * Cam.aspect; m[1] = r[1] * th * Cam.aspect; m[2] = r[2] * th * Cam.aspect; m[3] = 0;
    m[4] = u[0] * th; m[5] = u[1] * th; m[6] = u[2] * th; m[7] = 0;
    m[8] = -b[0]; m[9] = -b[1]; m[10] = -b[2]; m[11] = 0;
    m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
    return m;
  }

  /* ---------------------- 遮挡体（日食） ----------------------------- */
  function setOccluders(prog, body, camPos) {
    const W = SS.World;
    const sun = W.byId.sun;
    const cand = [];
    const push = (o) => {
      // 光源本身永远不是遮挡体（否则会把自己完全挡住）
      if (!o || o === body || o === sun) return;
      const d = V.dist(o.pos, body.pos);
      if (d < 1e-9) return;
      // 比被照天体更远离太阳的天体不可能遮挡它
      if (V.dist(o.pos, sun.pos) > V.dist(body.pos, sun.pos) + o.radius) return;
      cand.push({ o, ang: o.radius / d });
    };
    if (body.parent) push(body.parent);
    for (const o of W.bodies) {
      if (o.parent === body || (body.parent && o.parent === body.parent)) push(o);
    }
    cand.sort((a, b2) => b2.ang - a.ang);
    const n = Math.min(4, cand.length);
    for (let i = 0; i < n; i++) {
      const o = cand[i].o;
      scratch.occ[i * 3] = o.pos[0] - camPos[0];
      scratch.occ[i * 3 + 1] = o.pos[1] - camPos[1];
      scratch.occ[i * 3 + 2] = o.pos[2] - camPos[2];
      scratch.occR[i] = o.radius * (o.id === 'sun' ? 1 : R.settings.sizeBoost);
    }
    prog.i('uOccCount', n);
    if (n > 0) {
      prog.v3v('uOcc', scratch.occ.subarray(0, n * 3));
      prog.fv('uOccR', scratch.occR.subarray(0, n));
    }
  }

  /* ---------------------- 撞击坑 uniform ---------------------------- */
  const crA = new Float32Array(16), crB = new Float32Array(16),
    crC = new Float32Array(16), crD = new Float32Array(16);
  function setCraters(prog, body) {
    const n = Math.min(4, body.craters.length);
    prog.i('uCrCount', n);
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const c = body.craters[i];
      crA[i * 4] = c.dir[0]; crA[i * 4 + 1] = c.dir[1]; crA[i * 4 + 2] = c.dir[2];
      crA[i * 4 + 3] = c.angR;
      crB[i * 4] = c.depth; crB[i * 4 + 1] = c.rim; crB[i * 4 + 2] = c.peak; crB[i * 4 + 3] = c.ejecta;
      crC[i * 4] = c.albFloor; crC[i * 4 + 1] = c.albRay; crC[i * 4 + 2] = c.melt; crC[i * 4 + 3] = c.type;
      crD[i * 4] = c.rayReach; crD[i * 4 + 1] = c.seed; crD[i * 4 + 2] = c.terrace; crD[i * 4 + 3] = c.hot || 0;
    }
    prog.v4v('uCr', crA.subarray(0, n * 4));
    prog.v4v('uCrA', crB.subarray(0, n * 4));
    prog.v4v('uCrB', crC.subarray(0, n * 4));
    prog.v4v('uCrC', crD.subarray(0, n * 4));
  }

  const blA = new Float32Array(16), blB = new Float32Array(16);
  function setBlots(prog, body) {
    const n = Math.min(4, body.blots.length);
    prog.i('uBlotCount', n);
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const b = body.blots[i];
      blA[i * 4] = b.dir[0]; blA[i * 4 + 1] = b.dir[1]; blA[i * 4 + 2] = b.dir[2]; blA[i * 4 + 3] = b.angR;
      blB[i * 4] = b.depth; blB[i * 4 + 1] = M.clamp(b.age, 0, 1); blB[i * 4 + 2] = b.shear; blB[i * 4 + 3] = 0;
    }
    prog.v4v('uBlot', blA.subarray(0, n * 4));
    prog.v4v('uBlotP', blB.subarray(0, n * 4));
  }

  function pickSphere(sr, q) {
    const s = R.mesh.spheres;
    const idx = sr > 420 ? q.sphere[3] : sr > 120 ? q.sphere[2] : sr > 26 ? q.sphere[1] : q.sphere[0];
    for (const sp of s) if (sp.level === idx) return sp;
    return s[s.length - 1];
  }

  /* ---------------------- 地形 uniform（星球着色器与探针共用） ------- */
  function setTerrainUniforms(p, b, oct, crL) {
    const lk = b.def.look;
    p.i('uKind', lk.kind).f('uRelief', lk.relief).f('uNoiseFreq', lk.noiseFreq);
    p.f('uRough', lk.rough).f('uOcean', lk.ocean).f('uIce', lk.ice);
    p.f('uCraterField', lk.craterField || 0).f('uBands', lk.bands || 0);
    p.f('uStorm', lk.storm || 0).f('uCracks', lk.cracks || 0).f('uMare', lk.mare || 0);
    p.f('uTime', SS.World.fxTime).i('uOct', oct).i('uCrLayers', crL).f('uSeed', b.seed);
    p.f('uCloudCover', lk.cloud || 0).f('uCloudFreq', lk.cloudFreq || 1)
      .f('uCloudSpeed', lk.cloudSpeed || 0);
    p.f('uDust', b.st.dust).f('uIceBoost', b.st.iceBoost).f('uGreen', b.st.green);
    p.f('uRadiusM', b.radiusM);
    p.tex('uScar', 0, b.scar ? b.scar.tex.handle : R.emptyScar.handle);
    setCraters(p, b);
  }

  /**
   * 地表探针：读回指定方向上的真实地形高度
   * → 撞击点究竟是深海、陆地还是冰盖，由地形函数本身决定，而不是让用户猜
   */
  R.probeSurface = function (body, dirLocal) {
    const gl = R.gl;
    if (!R.rt.probe) {
      R.rt.probe = SS.GL.renderTarget(gl, 1, 1, {
        internalFormat: gl.RGBA8, min: gl.NEAREST, mag: gl.NEAREST,
      });
      R.probePix = new Uint8Array(4);
    }
    const q = QUALITY[R.quality];
    const p = R.prog.probe.use();
    setTerrainUniforms(p, body, q.oct, q.crLayers);
    p.v3('uProbeDir', dirLocal);
    R.rt.probe.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    R.mesh.fs.draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, R.probePix);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.DEPTH_TEST);
    const relH = (R.probePix[0] / 255 - 0.5) * 2;
    const lk = body.def.look;
    return {
      relH,
      heightM: relH * lk.relief,
      land: R.probePix[1] > 127,
      ice: R.probePix[2] > 127,
      hasOcean: lk.ocean > 0.01,
    };
  };

  /* ---------------------- 绘制：星球 -------------------------------- */
  function drawPlanet(b, it, sunRel, sunColor, q) {
    const gl = R.gl, Cam = SS.Cam, st = R.settings, lk = b.def.look;
    const p = R.prog.planet.use();
    const sp = pickSphere(it.sr, q);
    const isFocus = Cam.focus === b;
    const oct = Math.max(3, isFocus ? q.oct : Math.min(q.oct, it.sr > 200 ? q.oct : 4));
    const crL = it.sr > 60 ? q.crLayers : Math.min(1, q.crLayers);

    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).m3('uRot', b.rotM);
    p.f('uRadius', b.radius * st.sizeBoost).f('uRadiusM', b.radiusM);
    p.f('uReliefGain', st.reliefGain);
    setTerrainUniforms(p, b, oct, crL);
    p.f('uNight', (lk.night || 0) * b.st.cityLights);
    p.v3('uColA', lk.colA).v3('uColB', lk.colB).v3('uColC', lk.colC);
    p.v3('uOceanCol', lk.oceanCol || lk.colB).v3('uShoreCol', lk.shoreCol || lk.colA);
    p.v3('uDustCol', lk.dustCol || lk.colB);
    p.v3('uSunPos', sunRel).f('uSunR', SS.World.byId.sun.radius).v3('uSunColor', sunColor);
    p.f('uSunIntensity', SUN_I);
    const atmo = b.def.atmo;
    p.f('uAtmoThick', atmo ? Math.min(atmo.thick || 1, 3) : 0);
    p.v3('uAtmoTint', atmo ? atmo.rayleigh : [0, 0, 0]);
    // 行星反照（地照）：母天体反射到卫星上的辐照度
    const shine = planetShine(b);
    p.v3('uShineCol', shine.col).v3('uShineDir', shine.dir);
    setOccluders(p, b, SS.Cam.pos);
    setBlots(p, b);
    sp.mesh.draw();
    R.stats.draws++; R.stats.tris += sp.tris;
  }

  function drawSun(b, it, sunRel, sunColor) {
    const gl = R.gl, Cam = SS.Cam;
    const p = R.prog.sun.use();
    const sp = pickSphere(it.sr, QUALITY[R.quality]);
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).m3('uRot', b.rotM).f('uRadius', b.radius);
    p.v3('uColA', b.def.look.colA).v3('uColB', b.def.look.colB).v3('uColC', b.def.look.colC);
    p.f('uTime', SS.World.fxTime).f('uIntensity', 26.0);
    sp.mesh.draw();
    R.stats.draws++;
  }

  function drawCloud(b, it, sunRel, sunColor) {
    const Cam = SS.Cam, lk = b.def.look, st = R.settings;
    const p = R.prog.cloud.use();
    const sp = pickSphere(it.sr, QUALITY[R.quality]);
    const cloudR = b.radius * st.sizeBoost * (1 + (b.def.atmo.top * 0.12) / b.def.radius);
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).m3('uRot', b.rotM).f('uRadius', cloudR);
    p.v3('uSunPos', sunRel).v3('uSunColor', sunColor).f('uSunR', SS.World.byId.sun.radius);
    p.f('uSunIntensity', SUN_I);
    p.v3('uCloudCol', lk.cloudCol).f('uCloudCover', lk.cloud);
    p.f('uCloudFreq', lk.cloudFreq).f('uCloudSpeed', lk.cloudSpeed);
    p.f('uTime', SS.World.fxTime).f('uDust', b.st.dust).i('uKind', lk.kind);
    setOccluders(p, b, SS.Cam.pos);
    sp.mesh.draw();
    R.stats.draws++;
  }

  function drawAtmo(b, it, sunRel, sunColor) {
    const gl = R.gl, Cam = SS.Cam, st = R.settings;
    const atmo = b.def.atmo;
    const p = R.prog.atmo.use();
    const sp = pickSphere(it.sr * 1.2, QUALITY[R.quality]);
    const surf = b.radius * st.sizeBoost;
    const shell = surf + atmo.top / 1000;
    const densRatio = atmo.rho0 / 1.225;
    const k = Math.pow(Math.max(densRatio, 1e-4), 0.55);
    const tint = atmo.rayleigh;
    const mx = Math.max(tint[0], tint[1], tint[2], 1e-4);
    const beta = [33.1 * k * tint[0] / mx, 33.1 * k * tint[1] / mx, 33.1 * k * tint[2] / mx];
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).f('uShellRadius', shell).f('uRadius', surf);
    p.f('uHR', (atmo.H / 1000) * (st.sizeBoost > 1 ? st.sizeBoost : 1));
    p.v3('uBetaR', beta).f('uBetaM', 21.0 * k * (atmo.mie || 0.3));
    p.v3('uSunPos', sunRel).v3('uSunColor', sunColor).f('uSunR', SS.World.byId.sun.radius);
    p.f('uSunIntensity', SUN_I).f('uDust', b.st.dust);
    setOccluders(p, b, SS.Cam.pos);
    // 相机在壳内时需要绘制背面
    const inside = it.dist < shell * 1.001;
    R.gl.cullFace(inside ? R.gl.FRONT : R.gl.BACK);
    sp.mesh.draw();
    R.gl.cullFace(R.gl.BACK);
    R.stats.draws++;
  }

  function drawRing(b, it, sunRel, sunColor) {
    const Cam = SS.Cam, lk = b.def.look, st = R.settings;
    const p = R.prog.ring.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).m3('uRot', b.tiltM).f('uRadius', b.radius * st.sizeBoost);
    p.f('uInner', lk.ringInner).f('uOuter', lk.ringOuter).f('uOpacity', lk.ringOpacity);
    p.v3('uRingCol', lk.ringCol).f('uSeed', b.seed);
    p.v3('uSunPos', sunRel).v3('uSunColor', sunColor).f('uSunR', SS.World.byId.sun.radius);
    p.f('uSunIntensity', SUN_I);
    setOccluders(p, b, SS.Cam.pos);
    R.gl.disable(R.gl.CULL_FACE);
    R.mesh.rings[b.id].draw();
    R.gl.enable(R.gl.CULL_FACE);
    R.stats.draws++;
  }

  const ringA = new Float32Array(24), ringB = new Float32Array(24);
  function drawSurfRings(b, it, sunRel) {
    const Cam = SS.Cam, st = R.settings;
    const n = Math.min(6, b.rings.length);
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const r = b.rings[i];
      ringA[i * 4] = r.dir[0]; ringA[i * 4 + 1] = r.dir[1]; ringA[i * 4 + 2] = r.dir[2];
      ringA[i * 4 + 3] = r.ang;
      ringB[i * 4] = r.k; ringB[i * 4 + 1] = r.width; ringB[i * 4 + 2] = r.type;
      ringB[i * 4 + 3] = r.type === 0 ? 0.25 : 0.0;
    }
    const p = R.prog.surfRing.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).m3('uRot', b.rotM);
    p.f('uRadius', b.radius * st.sizeBoost * 1.0015);
    p.v4v('uRing', ringA.subarray(0, n * 4));
    p.v4v('uRingP', ringB.subarray(0, n * 4));
    p.i('uRingCount', n);
    p.v3('uSunPos', sunRel).f('uSunR', SS.World.byId.sun.radius);
    p.i('uOccCount', 0);
    pickSphere(it.sr, QUALITY[R.quality]).mesh.draw();
    R.stats.draws++;
  }

  function drawCorona(it) {
    const Cam = SS.Cam;
    const b = it.b;
    const p = R.prog.corona.use();
    const size = b.radius * 4.2;
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uOffset', it.rel).v3('uCamRight', Cam.right).v3('uCamUp', Cam.up);
    p.f('uSize', size).f('uCoreFrac', b.radius / size);
    p.v3('uColA', b.def.look.colA).v3('uColC', b.def.look.colB);
    p.f('uTime', SS.World.fxTime).f('uIntensity', 1.6);
    R.gl.disable(R.gl.CULL_FACE);
    R.mesh.quad.draw();
    R.gl.enable(R.gl.CULL_FACE);
    R.stats.draws++;
  }

  /* ---------------------- 行星反照（地照） --------------------------- *
   *  母天体把阳光反射到卫星上：E = A·E_母·(R_母/d)²·相位因子
   *  地球→月球约为日照的 1/12000，是肉眼可见的真实效应
   * ------------------------------------------------------------------ */
  function planetShine(b) {
    const zero = { col: [0, 0, 0], dir: [0, 1, 0] };
    const par = b.parent;
    if (!par || par.id === 'sun') return zero;
    const sun = SS.World.byId.sun;
    const dPar = V.dist(par.pos, sun.pos);
    if (dPar < 1e-9) return zero;
    const irrPar = SUN_I / (dPar * dPar);
    const lk = par.def.look;
    const alb = [
      (lk.colA[0] + lk.colC[0]) * 0.5, (lk.colA[1] + lk.colC[1]) * 0.5,
      (lk.colA[2] + lk.colC[2]) * 0.5,
    ];
    const d = Math.max(V.dist(b.pos, par.pos), par.radius * 1.01);
    const geo = Math.pow(par.radius / d, 2);
    // 相位因子：卫星看到的母天体被照亮的比例
    const toSun = V.norm([sun.pos[0] - par.pos[0], sun.pos[1] - par.pos[1], sun.pos[2] - par.pos[2]]);
    const toBody = V.norm([b.pos[0] - par.pos[0], b.pos[1] - par.pos[1], b.pos[2] - par.pos[2]]);
    const phase = M.clamp(0.5 * (1 + V.dot(toSun, toBody)), 0, 1);
    const k = irrPar * geo * phase * 0.55;      // 0.55 ≈ 半球平均的反射效率
    return {
      col: [alb[0] * k, alb[1] * k, alb[2] * k],
      dir: V.norm([par.pos[0] - b.pos[0], par.pos[1] - b.pos[1], par.pos[2] - b.pos[2]]),
    };
  }

  /** 远处天体：按能量守恒把整个天体的通量摊到亚像素的点上 */
  function drawBodyPoint(it, sunRel, sunColor) {
    const Cam = SS.Cam, b = it.b;
    const sun = SS.World.byId.sun;
    const p = R.prog.flash.use();
    const px = 1.7;   // 目标像素半径
    const size = it.dist * px * Math.tan(Cam.fov / 2) / (R.RH * 0.5);
    // 一个像素张开的立体角
    const omegaPix = Math.pow(2 * Math.tan(Cam.fov / 2) / R.RH, 2);
    const geo = Math.pow(b.radius / it.dist, 2) / Math.max(omegaPix, 1e-12);
    let col;
    if (b.id === 'sun') {
      const k = 26.0 * geo / (px * px * 3.0);
      col = [k, k * 0.96, k * 0.92];
    } else {
      const dSun = Math.max(V.dist(b.pos, sun.pos), 1);
      const irr = SUN_I / (dSun * dSun);
      const lk = b.def.look;
      const alb = [(lk.colA[0] + lk.colC[0]) * 0.5, (lk.colA[1] + lk.colC[1]) * 0.5,
        (lk.colA[2] + lk.colC[2]) * 0.5];
      // 相位：远处天体看到的是部分照亮的圆面
      const toSun = V.norm([sun.pos[0] - b.pos[0], sun.pos[1] - b.pos[1], sun.pos[2] - b.pos[2]]);
      const toCam = V.norm([-it.rel[0], -it.rel[1], -it.rel[2]]);
      const phase = M.clamp(0.5 * (1 + V.dot(toSun, toCam)), 0.02, 1);
      const flux = irr * geo * phase / (px * px * 3.0);
      col = [alb[0] * flux, alb[1] * flux, alb[2] * flux];
    }
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v3('uCenter', it.rel).v3('uCamRight', Cam.right).v3('uCamUp', Cam.up);
    p.f('uSize', size).v3('uColor', col);
    p.f('uIntensity', 1.0).f('uCore', 0.42).f('uTime', 0).f('uTurb', 0);
    R.gl.disable(R.gl.CULL_FACE);
    R.mesh.quad.draw();
    R.gl.enable(R.gl.CULL_FACE);
    R.stats.draws++;
  }

  function drawOrbits(camPos) {
    const Cam = SS.Cam;
    const p = R.prog.orbit.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    for (const b of SS.World.bodies) {
      if (!b.def.orbit) continue;
      const isMoon = b.parent && b.parent.id !== 'sun';
      // 只画“当前关注层级”的轨道，避免远景一团糊
      const parentPos = b.parent ? b.parent.pos : [0, 0, 0];
      const centerLocal = M3.xform(b.orbitBasis, [b.orbitCenterOffset, 0, 0]);
      const center = [
        parentPos[0] + centerLocal[0] - camPos[0],
        parentPos[1] + centerLocal[1] - camPos[1],
        parentPos[2] + centerLocal[2] - camPos[2],
      ];
      const scr = (b.orbitA / Math.max(V.len(center), 1e-6));
      if (scr < 0.02) continue;                      // 太小
      if (scr > 22) continue;                        // 相机贴得太近，轨道线只会变成穿屏噪声
      if (isMoon && scr > 40) continue;
      const alpha = M.clamp(0.10 + 0.5 * M.smoothstep(0.02, 0.4, scr), 0, 0.6) * (isMoon ? 0.7 : 1);
      p.v3('uCenter', center).m3('uBasis', b.orbitBasis);
      p.f('uA', b.orbitA).f('uB', b.orbitB).f('uPhase', b.orbitPhase);
      const c = b.def.look.colA;
      p.v3('uColor', [0.35 + c[0] * 0.5, 0.42 + c[1] * 0.45, 0.55 + c[2] * 0.4]);
      p.f('uAlpha', alpha);
      R.mesh.orbit.draw();
      R.stats.draws++;
    }
  }

  function drawParticles(camPos) {
    const FX = SS.FX, Cam = SS.Cam;
    const n = FX.draw.n;
    if (!n) return;
    // 粒子坐标是天体本地坐标：这里用双精度加上"天体−相机"的偏移
    const W = SS.World;
    const off = R.bodyOffsets || (R.bodyOffsets = []);
    for (let i = 0; i < W.bodies.length; i++) {
      const b = W.bodies[i];
      off[i] = off[i] || [0, 0, 0];
      off[i][0] = b.pos[0] - camPos[0];
      off[i][1] = b.pos[1] - camPos[1];
      off[i][2] = b.pos[2] - camPos[2];
    }
    const dp = R.partPos;
    for (let i = 0; i < n; i++) {
      const o = off[FX.draw.body[i]] || [0, 0, 0];
      dp[i * 3] = FX.draw.pos[i * 3] + o[0];
      dp[i * 3 + 1] = FX.draw.pos[i * 3 + 1] + o[1];
      dp[i * 3 + 2] = FX.draw.pos[i * 3 + 2] + o[2];
    }
    R.mesh.part.update(0, dp.subarray(0, n * 3));
    R.mesh.part.update(1, FX.draw.attr.subarray(0, n * 4));
    const p = R.prog.part.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    p.v2('uViewport', R.RW, R.RH).f('uSizeScale', 1.0).f('uBright', 1.0);
    R.mesh.part.draw(n);
    R.stats.draws++;
  }

  function drawTrails(camPos) {
    const FX = SS.FX, Cam = SS.Cam;
    if (!FX.meteors.length) return;
    const p = R.prog.trail.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    for (const m of FX.meteors) {
      const tr = m.trail;
      if (tr.length < 3) continue;
      const N = Math.min(tr.length, 120);
      const start = tr.length - N;
      let v = 0;
      const wBase = Math.max(m.radiusUnits * 2.5, m.body.radius * 0.0006);
      for (let i = 0; i < N; i++) {
        const cur = tr[start + i].p;
        const prev = tr[Math.max(start, start + i - 1)].p;
        const next = tr[Math.min(tr.length - 1, start + i + 1)].p;
        const dir = V.norm(V.sub(next, prev));
        const rel = [cur[0] - camPos[0], cur[1] - camPos[1], cur[2] - camPos[2]];
        const toCam = V.norm(V.negate(rel));
        let side = V.cross(dir, toCam);
        if (V.len2(side) < 1e-16) side = V.perp(dir);
        V.norm(side, side);
        const age = tr[start + i].t;
        const frac = 1 - i / (N - 1);              // 0 = 头部
        const lum = 0.25 + tr[start + i].lum * 3.0;
        const w = wBase * (0.35 + (1 - frac) * 0.2 + lum * 0.5) * (1 + age * 0.8);
        const fade = Math.max(0, 1 - age / 2.2);
        R.ribbonPos[v * 3] = rel[0] + side[0] * w;
        R.ribbonPos[v * 3 + 1] = rel[1] + side[1] * w;
        R.ribbonPos[v * 3 + 2] = rel[2] + side[2] * w;
        R.ribbonAttr[v * 2] = frac; R.ribbonAttr[v * 2 + 1] = lum * fade;
        v++;
        R.ribbonPos[v * 3] = rel[0] - side[0] * w;
        R.ribbonPos[v * 3 + 1] = rel[1] - side[1] * w;
        R.ribbonPos[v * 3 + 2] = rel[2] - side[2] * w;
        R.ribbonAttr[v * 2] = frac; R.ribbonAttr[v * 2 + 1] = lum * fade;
        v++;
      }
      R.mesh.trail.update(0, R.ribbonPos.subarray(0, v * 3));
      R.mesh.trail.update(1, R.ribbonAttr.subarray(0, v * 2));
      const mc = m.mat ? m.mat.color : [1, 0.6, 0.3];
      p.v3('uColor', [mc[0] * 0.6 + 0.4, mc[1] * 0.4 + 0.2, mc[2] * 0.3 + 0.1]);
      p.f('uBright', 2.2);
      R.mesh.trail.draw(v);
      R.stats.draws++;

      // 流星本体
      const fp = R.prog.flash.use();
      const rel = [m.pos[0] - camPos[0], m.pos[1] - camPos[1], m.pos[2] - camPos[2]];
      const glow = 0.35 + m.lum * 4.5;
      fp.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
      fp.v3('uCenter', rel).v3('uCamRight', Cam.right).v3('uCamUp', Cam.up);
      const px = Math.max(m.radiusUnits * (2 + m.lum * 9),
        V.len(rel) * 2.2 * Math.tan(Cam.fov / 2) / (R.RH * 0.5));
      fp.f('uSize', px).v3('uColor', [1.0, 0.72 + m.lum * 0.25, 0.42 + m.lum * 0.45]);
      fp.f('uIntensity', glow * 6.0).f('uCore', 0.32).f('uTime', SS.World.fxTime).f('uTurb', 0.6);
      R.gl.disable(R.gl.CULL_FACE);
      R.mesh.quad.draw();
      R.gl.enable(R.gl.CULL_FACE);
      p.use();
    }
  }

  function drawFlashes(camPos) {
    const FX = SS.FX, Cam = SS.Cam;
    if (!FX.flashes.length) return;
    const p = R.prog.flash.use();
    p.m4('uViewProj', Cam.viewProj).f('uLogFC', Cam.logFC);
    R.gl.disable(R.gl.CULL_FACE);
    for (const f of FX.flashes) {
      const t = M.clamp(f.t / f.dur, 0, 1);
      // 快速上升 + 幂律衰减
      const rise = M.smoothstep(0, 0.06, t);
      const decay = Math.pow(1 - t, 2.4);
      const inten = f.peak * rise * decay;
      if (inten < 0.01) continue;
      const size = f.size0 + (f.size1 - f.size0) * Math.pow(t, 0.45);
      const rel = [f.pos[0] - camPos[0], f.pos[1] - camPos[1], f.pos[2] - camPos[2]];
      p.v3('uCenter', rel).v3('uCamRight', Cam.right).v3('uCamUp', Cam.up);
      p.f('uSize', size).v3('uColor', f.color).f('uIntensity', inten);
      p.f('uCore', f.core).f('uTime', SS.World.fxTime + f.t).f('uTurb', f.turb);
      R.mesh.quad.draw();
      R.stats.draws++;
    }
    R.gl.enable(R.gl.CULL_FACE);
  }

  /* ---------------------- 后处理 ------------------------------------ */
  function post(dt, guess) {
    const gl = R.gl, st = R.settings;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);

    // 测光 → 自动曝光（本帧即生效）
    const exposure = st.exposure * meterExposure(dt, guess);

    // 亮部阈值随曝光缩放：判据是"曝光后会不会过亮"，于是外行星附近也有泛光
    const thr = 1.0 / Math.max(exposure, 1e-6);
    R.rt.b1.bind();
    R.prog.bright.use().tex('uTex', 0, R.rt.scene.color.handle)
      .f('uThreshold', thr).f('uKnee', thr * 0.6);
    R.mesh.fs.draw();

    const chain = [[R.rt.b1, R.rt.b1t], [R.rt.b2, R.rt.b2t], [R.rt.b3, R.rt.b3t]];
    const bl = R.prog.blur;
    for (let i = 0; i < chain.length; i++) {
      const [a, t] = chain[i];
      if (i > 0) {
        // 从上一级降采样
        a.bind();
        R.prog.bright.use().tex('uTex', 0, chain[i - 1][0].color.handle)
          .f('uThreshold', 0.0).f('uKnee', 0.01);
        R.mesh.fs.draw();
      }
      t.bind();
      bl.use().tex('uTex', 0, a.color.handle).v2('uDir', 1 / a.width, 0);
      R.mesh.fs.draw();
      a.bind();
      bl.use().tex('uTex', 0, t.color.handle).v2('uDir', 0, 1 / a.height);
      R.mesh.fs.draw();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, R.RW, R.RH);
    const c = R.prog.comp.use();
    c.tex('uScene', 0, R.rt.scene.color.handle);
    c.tex('uBloom1', 1, R.rt.b1.color.handle);
    c.tex('uBloom2', 2, R.rt.b2.color.handle);
    c.tex('uBloom3', 3, R.rt.b3.color.handle);
    c.f('uExposure', exposure).f('uBloomStrength', st.bloom);
    c.f('uVignette', st.vignette).f('uGrain', st.grain);
    c.f('uTime', SS.World.fxTime).f('uChroma', st.chroma);
    R.mesh.fs.draw();
    gl.enable(gl.DEPTH_TEST);
    return exposure;
  }

  R.QUALITY = QUALITY;
  R.SUN_I = SUN_I;
  SS.R = R;
})(window);
