/* =========================================================================
 * app.js — 应用层：对数时间轴播放、相机、UI 绑定、HUD、无头自检
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE, U = NK.util, P = NK.physics;
  var doc = root.document;

  var App = NK.App = function () {
    this.canvas = doc.getElementById('gl');
    this.renderer = new NK.Renderer(this.canvas, { resScale: 1.0 });
    // 默认场景与下拉框选中项保持一致（长崎 Fat Man：21 kt 空爆 503 m）
    this.state = {
      W: 21, hob: 503, humidity: 0.6, wind: 6, shear: 1.6, dirt: 1.0,
      cityScale: 1.0, era: 0, fires: true, camMode: 'auto',
      capacity: 32000,
      playing: true, speed: 1.4, s: 0, loopEnd: 1.02,
      night: false, showGrid: true, showCity: true, showShock: true, showWilson: true,
      autoFrame: true, exposureBias: 1.0, bloom: 0.85, opacity: 1.0, sizeScale: 1.0,
      emissive: 0.02, distort: 1.0, visibility: 20000, resScale: 1.0,
      sunAz: 2.4, sunEl: 0.42, showHUD: true
    };
    this.cam = {
      az: 2.05, el: 0.16, distMul: 1.0, dist: 4000,
      pos: [0, 0, 0], target: [0, 0, 0], fov: 48 * Math.PI / 180, near: 5, far: 400000,
      smTarget: [0, 0, 0], smDist: 4000
    };
    this.fps = 0; this._fpsAcc = 0; this._fpsN = 0;
    this.sim = null;
    this.buildSim();
    if (this.renderer.gl) { this.renderer.setGround(300000); }
    this._bindUI();
    this._bindInput();
    this.showErrors();
    this.lastWall = (root.performance || Date).now();
  };

  /* ---------------------------------------------------------------- 仿真生命周期 */
  App.prototype.buildSim = function () {
    var st = this.state;
    this.sim = new NK.Sim({
      capacity: st.capacity, W: st.W, hob: st.hob,
      humidity: st.humidity, wind: st.wind, shear: st.shear, dirt: st.dirt,
      cityScale: st.cityScale, era: st.era, fires: st.fires ? 1 : 0
    });
    this.tEnd = P.stabilizeTime(st.W) * 1.45;
    this.tStart = 3e-4;
    this.logSpan = Math.log(this.tEnd / this.tStart);
    st.s = 0;
    this.simTime = 0;
    // 初次进入时让相机取一个合理的机位
    var scale = Math.max(this.sim.Rfb * 6, 900);
    this.cam.dist = scale; this.cam.smDist = scale;
    this.cam.smTarget = [0, this.sim.Rfb * 0.8, 0];
  };
  App.prototype.reconfigure = function (rebuild) {
    var st = this.state;
    if (rebuild) { this.buildSim(); }
    else {
      this.sim.configure({
        W: st.W, hob: st.hob, humidity: st.humidity,
        wind: st.wind, shear: st.shear, dirt: st.dirt,
        cityScale: st.cityScale, era: st.era, fires: st.fires ? 1 : 0
      });
      this.tEnd = P.stabilizeTime(st.W) * 1.45;
      this.logSpan = Math.log(this.tEnd / this.tStart);
      st.s = 0; this.simTime = 0;
    }
    this._syncUI();
  };

  /** 归一化时间轴位置 s ∈[0,1] ↔ 物理时间（对数轴：每个数量级占同样宽度） */
  App.prototype.sToT = function (s) {
    if (s <= 0) { return 0; }
    return this.tStart * Math.exp(U.clamp(s, 0, 1.2) * this.logSpan);
  };
  App.prototype.tToS = function (t) {
    if (!(t > 0)) { return 0; }
    return U.clamp(Math.log(t / this.tStart) / this.logSpan, 0, 1.2);
  };

  /* ---------------------------------------------------------------- 主循环 */
  App.prototype.frame = function () {
    var now = (root.performance || Date).now();
    var dtWall = Math.min((now - this.lastWall) / 1000, 0.1);
    this.lastWall = now;
    this.lastDt = dtWall;
    this._fpsAcc += dtWall; this._fpsN++;
    if (this._fpsAcc > 0.4) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }

    var st = this.state;
    if (st.playing) {
      // 时间轴按对数匀速推进：60 s 墙钟走完全过程（约每 9 s 一个数量级）
      st.s += dtWall * st.speed / 62;
      if (st.s >= st.loopEnd) { st.s = st.loopEnd; st.playing = false; this._syncPlayBtn(); }
      var tTarget = this.sToT(st.s);
      if (tTarget < this.simTime) { this.sim.seek(tTarget); this.simTime = this.sim.t; }
      else {
        var dt = tTarget - this.simTime;
        if (dt > 0) {
          // 单帧最多推进 1/8 当前时间，保证早期不跳帧
          var maxStep = Math.max(this.simTime * 0.35, 2e-4);
          var guard = 0;
          while (dt > 1e-9 && guard++ < 6) {
            var h = Math.min(dt, maxStep);
            this.sim.step(h);
            dt -= h;
            maxStep = Math.max(this.sim.t * 0.35, 2e-4);
          }
          this.simTime = this.sim.t;
        }
      }
    }
    this._updateCamera(dtWall);
    if (this.renderer.gl && !this.renderer.errors.length) {
      this.renderer.render(this.sim, this.cam, this.envParams());
    }
    if (st.showHUD) { this._updateHUD(); }
    this._syncTimeSlider();
  };

  App.prototype.envParams = function () {
    var st = this.state, sim = this.sim;
    var E = st.W * P.K.KT_J;
    var thermalA = 0.35 * E / (4 * Math.PI) / P.K.CAL_CM2;   // Q = A/r²·exp(-r/λ)
    var sun = [
      Math.cos(st.sunEl) * Math.cos(st.sunAz),
      Math.sin(st.sunEl),
      Math.cos(st.sunEl) * Math.sin(st.sunAz)
    ];
    var night = st.night;
    var R5 = sim.blast.radiusForPsi(5);
    var grid = Math.pow(10, Math.round(Math.log(Math.max(R5 / 4, 50)) / Math.LN10));
    // 地面尘环：取激波环稍后的位置（尘土被卷起后落后于激波）
    var Rg = sim._groundShockR();
    return {
      sunDir: sun,
      sunCol: night ? [0.05, 0.06, 0.09] : [1.35, 1.22, 1.02],
      skyCol: night ? [0.02, 0.025, 0.04] : [0.34, 0.42, 0.58],
      zenith: night ? [0.012, 0.016, 0.035] : [0.16, 0.30, 0.62],
      horizon: night ? [0.03, 0.035, 0.055] : [0.62, 0.70, 0.82],
      groundCol: night ? [0.01, 0.01, 0.015] : [0.28, 0.26, 0.22],
      fogCol: night ? [0.03, 0.035, 0.055] : [0.60, 0.68, 0.80],
      fogDensity: 1.6 / st.visibility,
      flashCol: [1.0, 0.93, 0.82],
      thermalA: thermalA,
      visibility: st.visibility,
      dustRingR: Rg * 0.86,
      gridSize: grid,
      showGrid: st.showGrid, showCity: st.showCity,
      showShock: st.showShock, showWilson: st.showWilson,
      night: night,
      emissive: st.emissive,
      exposureBias: st.exposureBias,
      bloom: st.bloom, bloomThreshold: 1.0,
      grain: night ? 0.035 : 0.018,
      vignette: 0.35,
      opacity: st.opacity, sizeScale: st.sizeScale,
      distort: st.distort,
      whiteoutScale: 1.0,
      flashScatter: 0.22,
      dt: this.lastDt || 0.016
    };
  };

  /* ---------------------------------------------------------------- 相机 */
  /** 在城区里找一处「街面空地」作为贴地机位（附近建筑最低的方位） */
  App.prototype._streetSpot = function (r) {
    var sim = this.sim, best = null;
    for (var i = 0; i < 28; i++) {
      var a = i / 28 * Math.PI * 2;
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      var h = sim.buildings && sim.buildings.length ?
        sim.maxBuildingHeightNear(x, z, 55) : 0;
      if (!best || h < best.h) { best = { h: h, x: x, z: z, a: a }; }
      if (h < 1) { break; }
    }
    return best || { h: 0, x: r, z: 0, a: 0 };
  };

  /**
   * 镜头构图。各模式给出「目标点 / 距离 / 建议仰角」：
   *   auto   毁伤窗口内偏向城市构图，随后平滑切回蘑菇云
   *   city   低角横扫毁伤区（把 5 psi 圈放满画面）
   *   street 街面 12 m 视高，站在空地上看激波扫过
   *   top    俯视同心毁伤环
   *   cloud  只跟云
   */
  App.prototype._camFrame = function () {
    var sim = this.sim, st = this.state, t = sim.t;
    var R5 = Math.max(sim.blast.radiusForPsi(5), 60);
    var top = Math.max(sim.cloudTop, sim.Rfb * 2.2);
    var wide = Math.max(sim.stats.cloudR * 2.2, (sim.Rdisk || 0) * 2.4,
      sim.blast.radius(t) * 0.5, sim.Rfb * 4);
    var cloud = {
      t: [sim.cx * 0.45, top * 0.46, 0],
      d: Math.max(top * 1.5, wide * 1.15, sim.Rfb * 5), el: 0.16
    };
    /* 要看清单栋建筑倒塌，屏幕像素高需 20–40 px ⇒ 视距必须限制在 0.3–1.5 km。
       「按毁伤圈取景」和「看清单栋建筑」在大当量下不可兼得（15 Mt 的 5 psi 圈
       在 19 km 外，建筑只有 4 px）。因此改为：把机位放进毁伤区内（~0.95×R5，
       该处 5–8 psi，建筑成片坐塌而非被荡平），沿当前方位朝爆心看一段街区，
       火球/云柱正好落在画面上方作背景。这样 1 kt–50 Mt 都能看清。         */
    var azc = this.cam.az, cac = Math.cos(azc), sac = Math.sin(azc);
    var dLook = U.clamp(0.55 * R5, 260, 1500);
    // 机位半径同时受毁伤圈与城区范围约束：兆吨级时 5 psi 圈在城外，
    // 此时应站到城区密集带里拍「被荡平的城市 + 顶上的火球」
    // 取 0.45×城区半径：那里是中高层带（外围 0.7R 是 10–30 m 的低矮郊区，
    // 拍出来只有几个像素）。兆吨级时该处已在毁伤圈内，画面即「被荡平的城区」
    var rEye = Math.min(0.95 * R5, 0.45 * (sim.cityR || R5));
    var rT = Math.max(rEye - dLook, 0.12 * R5);
    var tyC = U.clamp(0.05 * dLook, 25, 110);
    var eyeC = U.clamp(0.12 * dLook, 40, 260);
    var city = {
      t: [cac * rT, tyC, sac * rT], d: dLook,
      el: Math.asin(U.clamp((eyeC - tyC) / dLook, -0.6, 0.6))
    };
    var m = st.camMode;
    if (m === 'city') { return city; }
    if (m === 'street') {
      // 街面机位：眼高由 el 反解锁定在 18 m（人/车视高），与当量无关。
      // 若像原先那样把目标点抬到固定 55 m 而仰角取常数，小当量下眼高会被
      // 顶到 40 m 以上。
      var dS = U.clamp(0.40 * R5, 180, 900);
      var rEyeS = Math.min(0.80 * R5, 0.38 * (sim.cityR || R5));
      var rS = Math.max(rEyeS - dS, 0.10 * R5);
      var sp = this._streetSpot(rS + dS);
      var tyS = U.clamp(0.06 * dS, 22, 130);
      return {
        t: [Math.cos(sp.a) * rS, tyS, Math.sin(sp.a) * rS], d: dS,
        el: -Math.asin(U.clamp((tyS - 18) / dS, -0.6, 0.6)),
        az: sp.a, street: 1
      };
    }
    if (m === 'top') {
      return {
        t: [0, 0, 0],
        d: Math.max(1.3 * sim.blast.radiusForPsi(1), top * 1.15), el: 1.10
      };
    }
    if (m === 'cloud') { return cloud; }
    // auto：以「激波扫到相机视野」为基准切向城市构图，之后回到云。
    // 若用「全城扫完」作基准，兆吨级下二者差一个量级（相机所在的内城 4 s 就
    // 被扫过，而全城要 42 s），权重会一直接近 0。
    var tCam = Math.max(sim.blast.arrival(rEye), 0.2);
    var f = U.smoothstep(0.35 * tCam, 1.1 * tCam, t) *
      U.smoothstep(9.0 * tCam, 3.5 * tCam, t);
    return {
      t: [U.lerp(cloud.t[0], city.t[0], f), U.lerp(cloud.t[1], city.t[1], f), 0],
      d: Math.exp(U.lerp(Math.log(cloud.d), Math.log(city.d), f)),
      el: U.lerp(cloud.el, city.el, f), blend: f
    };
  };

  App.prototype._updateCamera = function (dtWall) {
    var c = this.cam, sim = this.sim, st = this.state;
    var fr = this._camFrame();
    this._frame = fr;
    if (st.autoFrame) {
      var k = 1 - Math.exp(-dtWall * 1.6);
      c.smTarget[0] += (fr.t[0] - c.smTarget[0]) * k;
      c.smTarget[1] += (fr.t[1] - c.smTarget[1]) * k;
      c.smTarget[2] += (fr.t[2] - c.smTarget[2]) * k;
      c.smDist += (fr.d - c.smDist) * k;
      if (fr.az != null) { c.az += (fr.az - c.az) * k; }
    }
    c.dist = c.smDist * c.distMul;
    var ce = Math.cos(c.el), se = Math.sin(c.el);
    c.target = [c.smTarget[0], c.smTarget[1], c.smTarget[2]];
    c.pos = [
      c.target[0] + Math.cos(c.az) * ce * c.dist,
      Math.max(c.target[1] + se * c.dist, 12),
      c.target[2] + Math.sin(c.az) * ce * c.dist
    ];
    // 自动构图时把视点抬到附近建筑之上：否则近处高楼会贴脸占满画面，
    // 在闪光期呈现为一个巨大的黑方块
    if (st.autoFrame && !(this._frame && this._frame.street) &&
      sim.buildings && sim.buildings.length) {
      var hN = sim.maxBuildingHeightNear(c.pos[0], c.pos[2], Math.max(150, c.dist * 0.12));
      var minY = hN + 55;
      if (c.pos[1] < minY) { c.pos[1] = minY; }
    }
    c.near = U.clamp(c.dist * 0.004, 1.2, 400);
    c.far = Math.max(c.dist * 8, 420000);
  };

  App.prototype._bindInput = function () {
    var self = this, cv = this.canvas, c = this.cam;
    var drag = false, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', function (e) {
      drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointerup', function (e) {
      drag = false; try { cv.releasePointerCapture(e.pointerId); } catch (err) { }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) { return; }
      c.az -= (e.clientX - lx) * 0.005;
      c.el = U.clamp(c.el + (e.clientY - ly) * 0.004, -0.12, 1.35);
      lx = e.clientX; ly = e.clientY;
    });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      c.distMul = U.clamp(c.distMul * Math.exp(e.deltaY * 0.0012), 0.06, 12);
    }, { passive: false });
    doc.addEventListener('keydown', function (e) {
      var st = self.state;
      if (e.code === 'Space') { e.preventDefault(); self.togglePlay(); }
      else if (e.key === 'r' || e.key === 'R') { self.replay(); }
      else if (e.key === 'g' || e.key === 'G') { st.showGrid = !st.showGrid; self._syncUI(); }
      else if (e.key === 'c' || e.key === 'C') { st.showCity = !st.showCity; self._syncUI(); }
      else if (e.key === 'n' || e.key === 'N') { st.night = !st.night; self._syncUI(); }
      else if (e.key === 'f' || e.key === 'F') { st.autoFrame = !st.autoFrame; self._syncUI(); }
      else if (e.key === 'v' || e.key === 'V') {
        var order = ['auto', 'city', 'street', 'top', 'cloud'];
        self.setCamMode(order[(order.indexOf(st.camMode) + 1) % order.length]);
      }
      else if (e.key === 'h' || e.key === 'H') {
        st.showHUD = !st.showHUD;
        doc.body.classList.toggle('hide-ui', !st.showHUD);
      }
    });
    root.addEventListener('resize', function () { self.renderer.resize(); });
  };

  /* ---------------------------------------------------------------- UI */
  function $(id) { return doc.getElementById(id); }

  App.prototype._bindUI = function () {
    var self = this, st = this.state;
    // 预设
    var sel = $('preset');
    P.scenarios.forEach(function (sc, i) {
      var o = doc.createElement('option');
      o.value = String(i); o.textContent = sc.name; sel.appendChild(o);
    });
    sel.value = '2';
    sel.addEventListener('change', function () {
      var sc = P.scenarios[+sel.value];
      st.W = sc.W; st.hob = sc.hob; st.humidity = sc.hum;
      st.dirt = sc.surface ? 1.2 : 1.0;
      if (sc.era != null) { st.era = sc.era; }
      if (sc.city != null) { st.cityScale = sc.city; }
      self.reconfigure(true);
      self.replay();
    });

    function slider(id, key, fn, rebuild) {
      var el = $(id);
      if (!el) { return; }
      el.addEventListener('input', function () {
        var v = parseFloat(el.value);
        st[key] = fn ? fn(v) : v;
        self._syncUI();
        if (rebuild === 'reset') { self.reconfigure(false); }
      });
    }
    // 当量为对数滑块：0..1 → 0.5 kt .. 50 Mt
    $('yield').addEventListener('input', function () {
      var v = parseFloat($('yield').value);
      st.W = 0.5 * Math.pow(100000, v);
      self.reconfigure(false); self.replay();
    });
    $('hob').addEventListener('input', function () {
      st.hob = parseFloat($('hob').value);
      self.reconfigure(false); self.replay();
    });
    slider('humidity', 'humidity', null, 'reset');
    $('cityScale').addEventListener('input', function () {
      st.cityScale = parseFloat($('cityScale').value);
      self.reconfigure(false); self.replay();
    });
    $('camMode').addEventListener('change', function () {
      self.setCamMode($('camMode').value);
    });
    $('era').addEventListener('change', function () {
      st.era = parseInt($('era').value, 10);
      self.reconfigure(false); self.replay();
    });
    $('fires').addEventListener('change', function () {
      st.fires = $('fires').checked;
      self.reconfigure(false); self.replay();
    });
    slider('wind', 'wind', null, 'reset');
    slider('shear', 'shear', null, 'reset');
    slider('dirt', 'dirt', null, 'reset');
    slider('speed', 'speed');
    slider('expo', 'exposureBias');
    slider('bloom', 'bloom');
    slider('opacity', 'opacity');
    slider('psize', 'sizeScale');
    slider('emissive', 'emissive');
    slider('vis', 'visibility', function (v) { return v * 1000; });

    $('quality').addEventListener('change', function () {
      st.capacity = parseInt($('quality').value, 10);
      self.reconfigure(true); self.replay();
    });
    $('resscale').addEventListener('change', function () {
      st.resScale = parseFloat($('resscale').value);
      self.renderer.resScale = st.resScale;
      self.renderer.fbo.scene = null;
      self.renderer.resize();
    });
    ['showGrid', 'showCity', 'showShock', 'showWilson', 'autoFrame', 'night'].forEach(function (k) {
      var el = $(k);
      if (!el) { return; }
      el.addEventListener('change', function () { st[k] = el.checked; });
    });
    $('time').addEventListener('input', function () {
      st.s = parseFloat($('time').value);
      var t = self.sToT(st.s);
      if (t < self.simTime) { self.sim.seek(t); } else { self.sim.step(t - self.simTime); }
      self.simTime = self.sim.t;
    });
    $('play').addEventListener('click', function () { self.togglePlay(); });
    $('replay').addEventListener('click', function () { self.replay(); });
    // 阶段跳转
    var jumps = [
      ['火球', function () { return P.tMin(st.W) * 0.4; }],
      ['双闪光', function () { return P.t2Max(st.W); }],
      ['激波扫地', function () { return self.sim.blast.arrival(Math.max(self.sim.blast.radiusForPsi(5), 1)); }],
      ['涡环翻卷', function () { return Math.max(self.sim.tDecouple * 8, 4); }],
      ['蘑菇成形', function () { return P.stabilizeTime(st.W) * 0.35; }],
      ['稳定铺开', function () { return P.stabilizeTime(st.W) * 1.05; }]
    ];
    var jw = $('jumps');
    jumps.forEach(function (j) {
      var b = doc.createElement('button');
      b.textContent = j[0];
      b.className = 'jump';
      b.addEventListener('click', function () {
        var t = j[1]();
        st.s = self.tToS(t);
        if (t < self.simTime) { self.sim.seek(t); } else { self.sim.step(t - self.simTime); }
        self.simTime = self.sim.t;
      });
      jw.appendChild(b);
    });
    this._syncUI();
  };

  /** 切换视角：重置仰角与缩放，并强制打开自动构图（否则模式不起作用） */
  App.prototype.setCamMode = function (mode) {
    var st = this.state, c = this.cam;
    st.camMode = mode;
    st.autoFrame = true;
    var fr = this._camFrame();
    if (fr.el != null) { c.el = fr.el; }
    if (fr.az != null) { c.az = fr.az; }
    c.distMul = 1;
    this._syncUI();
  };

  App.prototype.togglePlay = function () {
    this.state.playing = !this.state.playing;
    if (this.state.playing && this.state.s >= this.state.loopEnd - 1e-6) { this.replay(); }
    this._syncPlayBtn();
  };
  App.prototype._syncPlayBtn = function () {
    var b = $('play'); if (b) { b.textContent = this.state.playing ? '⏸ 暂停' : '▶ 播放'; }
  };
  App.prototype.replay = function () {
    this.sim.reset();
    this.simTime = 0; this.state.s = 0; this.state.playing = true;
    this._syncPlayBtn();
  };

  App.prototype._syncUI = function () {
    var st = this.state;
    function set(id, v) { var e = $(id); if (e) { e.textContent = v; } }
    function val(id, v) { var e = $(id); if (e && doc.activeElement !== e) { e.value = v; } }
    val('yield', Math.log(st.W / 0.5) / Math.log(100000));
    val('hob', st.hob);
    val('humidity', st.humidity); val('wind', st.wind); val('shear', st.shear);
    val('dirt', st.dirt); val('speed', st.speed); val('expo', st.exposureBias);
    val('bloom', st.bloom); val('opacity', st.opacity); val('psize', st.sizeScale);
    val('emissive', st.emissive); val('vis', st.visibility / 1000);
    val('cityScale', st.cityScale);
    var eraEl = $('era'); if (eraEl) { eraEl.value = String(st.era); }
    var cmEl = $('camMode'); if (cmEl) { cmEl.value = st.camMode; }
    var fEl = $('fires'); if (fEl) { fEl.checked = !!st.fires; }
    set('cityScaleV', st.cityScale.toFixed(2) + '×');
    set('yieldV', U.fmtYield(st.W));
    set('hobV', st.hob < 1 ? '接地' : U.fmtLen(st.hob));
    set('humidityV', (st.humidity * 100).toFixed(0) + '%');
    set('windV', st.wind.toFixed(1) + ' m/s');
    set('shearV', st.shear.toFixed(1) + ' (m/s)/km');
    set('dirtV', st.dirt.toFixed(2));
    set('speedV', st.speed.toFixed(2) + '×');
    set('expoV', st.exposureBias.toFixed(2));
    set('bloomV', st.bloom.toFixed(2));
    set('opacityV', st.opacity.toFixed(2));
    set('psizeV', st.sizeScale.toFixed(2));
    set('emissiveV', st.emissive.toFixed(3));
    set('visV', (st.visibility / 1000).toFixed(0) + ' km');
    ['showGrid', 'showCity', 'showShock', 'showWilson', 'autoFrame', 'night'].forEach(function (k) {
      var e = $(k); if (e) { e.checked = !!st[k]; }
    });
  };
  App.prototype._syncTimeSlider = function () {
    var e = $('time');
    if (e && doc.activeElement !== e) { e.value = this.state.s; }
  };

  App.prototype._updateHUD = function () {
    var sim = this.sim, st = this.state, t = sim.t, bl = sim.blast;
    var rep = P.report(bl, t, { visibility: st.visibility });

    var cs = sim.cityStats || { intact: 0, glass: 0, clad: 0, partial: 0, collapse: 0, scour: 0, burnt: 0, burning: 0 };
    var sevRate = sim.buildings.length ?
      (cs.partial + cs.collapse + cs.scour) / sim.buildings.length : 0;
    var rows = [
      ['时间 t', U.fmtTime(t)],
      ['当量 / 爆高', U.fmtYield(st.W) + ' / ' + (st.hob < 1 ? '接地' : U.fmtLen(st.hob))],
      ['火球半径', U.fmtLen(rep.fireballR) + '（上限 ' + U.fmtLen(bl.Rfb) + '）'],
      ['火球表面温度', rep.fireballT > 9999 ? rep.fireballT.toExponential(2) + ' K' : rep.fireballT.toFixed(0) + ' K'],
      ['相对辐射功率', rep.relPower.toExponential(2) + '（第二极大=1）'],
      ['激波半径', U.fmtLen(rep.shockR)],
      ['激波马赫数', rep.mach.toFixed(2) + ' M'],
      ['波前峰值超压', rep.dpPsi > 1e4 ? rep.dpPsi.toExponential(2) : rep.dpPsi.toFixed(2), 'psi'],
      ['波前峰值动压', P.barToPsi(rep.qBar).toFixed(2) + ' psi'],
      ['—— 云 ——', ''],
      ['云顶（仿真）', U.fmtLen(sim.cloudTop)],
      ['云顶（经验式）', U.fmtLen(rep.cloudTopEmp) + '　比 ' + (sim.cloudTop / rep.cloudTopEmp).toFixed(2)],
      ['云团中心 / 半径', U.fmtLen(sim.cz) + ' / ' + U.fmtLen(sim.Rc)],
      ['砧状云盘 R / 厚', U.fmtLen(sim.Rdisk) + ' / ' + U.fmtLen(sim.Hdisk)],
      ['云盘（经验式）', U.fmtLen(P.cloudRadiusEmpirical(st.W)) + '　比 ' +
        (sim.Rdisk / P.cloudRadiusEmpirical(st.W)).toFixed(2)],
      ['上升速度 w', sim.w.toFixed(1) + ' m/s'],
      ['位温超出 Δθ', sim.dtheta.toFixed(1) + ' K'],
      ['标定 sStrat / cSpread', sim.sStrat.toFixed(3) + ' / ' + sim.cSpread.toFixed(2)],
      ['顺风漂移', U.fmtLen(sim.cx)],
      ['—— 毁伤半径 ——', ''],
      ['20 / 5 / 1 psi', U.fmtLen(rep.r20psi) + ' / ' + U.fmtLen(rep.r5psi) + ' / ' + U.fmtLen(rep.r1psi)],
      ['三度 / 二度烧伤', U.fmtLen(rep.rBurn3) + ' / ' + U.fmtLen(rep.rBurn2)],
      ['弹坑半径', sim.craterR > 1 ? U.fmtLen(sim.craterR) : '无（空爆）'],

      ['—— 城市破坏 ——', ''],
      ['建筑 / 城区半径', sim.buildings.length + ' 栋 / ' + U.fmtLen(sim.cityR)],
      ['结构年代', ['1945 木构为主', '战后砖混', '现代钢混'][st.era] || '—'],
      ['完好 / 玻璃破碎', cs.intact + ' / ' + cs.glass],
      ['外墙剥离', cs.clad + ''],
      ['部分倒塌', cs.partial + ''],
      ['完全倒塌', cs.collapse + ''],
      ['清扫至基础', cs.scour + ''],
      ['重度毁伤率', (sevRate * 100).toFixed(1) + ' %'],
      ['起火 / 正在燃烧', cs.burnt + ' / ' + cs.burning],
      ['视角', ({ auto: '自动', city: '城市', street: '街面', top: '俯视', cloud: '云' })[st.camMode] +
        (st.camMode === 'auto' && this._frame ?
          '（城市权重 ' + (this._frame.blend || 0).toFixed(2) + '）' : '')],
      ['—— 运行 ——', ''],
      ['粒子 存活/绘制', sim.stats.live + ' / ' + this.renderer.stats.drawn],
      ['建筑实例数', this.renderer.stats.buildings + ''],
      ['FPS / 排序', this.fps.toFixed(0) + ' / ' + this.renderer.stats.sortMs.toFixed(1) + ' ms'],
      ['曝光 / 过曝', this.renderer.exposure.toExponential(2) + ' / ' + this.renderer.whiteout.toFixed(2)]
    ];
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][1] === '') { html += '<div class="sep">' + rows[i][0] + '</div>'; }
      else {
        html += '<div class="row"><span>' + rows[i][0] + '</span><b>' + rows[i][1] +
          (rows[i][2] ? ' ' + rows[i][2] : '') + '</b></div>';
      }
    }
    $('hud').innerHTML = html;
  };

  App.prototype.showErrors = function () {
    var d = this.renderer.diagnostics();
    var box = $('err');
    if (d.errors.length) {
      box.style.display = 'block';
      box.innerHTML = '<b>⚠ 渲染初始化失败</b><br>' +
        d.errors.map(function (e) { return e.replace(/</g, '&lt;'); }).join('<br>');
    }
    var n = $('notes');
    if (n) { n.textContent = d.notes.join(' · '); }
  };

  /* ---------------------------------------------------------------- 无头自检 */
  /**
   * ?selftest=1 时执行：跑若干关键相位，检查着色器编译、像素统计、物理量、
   * 并把结果写入 #selftest 与 document.title（供 headless --dump-dom 读取）。
   * 纯文本断言，不依赖任何视觉模型。
   */
  NK.runSelfTest = function () {
    var lines = [], fails = 0;
    function ok(cond, msg, extra) {
      lines.push((cond ? 'PASS  ' : 'FAIL  ') + msg + (extra ? '   [' + extra + ']' : ''));
      if (!cond) { fails++; }
    }
    var app;
    try {
      app = new NK.App();
      // ?selftest=1&W=15000&hob=2&cap=12000 —— 便于对极端当量做回归
      var qs = root.location.search || '';
      var mW = /[?&]W=([\d.]+)/.exec(qs), mH = /[?&]hob=([\d.]+)/.exec(qs),
        mC = /[?&]cap=(\d+)/.exec(qs);
      if (mW || mH || mC) {
        if (mW) { app.state.W = parseFloat(mW[1]); }
        if (mH) { app.state.hob = parseFloat(mH[1]); }
        if (mC) { app.state.capacity = parseInt(mC[1], 10); }
        app.reconfigure(true);
        lines.push('# 覆盖参数: W=' + app.state.W + ' kt, hob=' + app.state.hob +
          ' m, cap=' + app.state.capacity);
      }
    } catch (e) {
      lines.push('FAIL  App 构造异常: ' + (e && e.message));
      fails++;
      finish();
      return;
    }
    var r = app.renderer, d = r.diagnostics();
    lines.push('# 环境: ' + d.notes.join(' | '));
    ok(!!r.gl, 'WebGL2 上下文创建');
    ok(d.errors.length === 0, '全部着色器编译/链接通过', d.errors.join(' ; ') || 'no error');
    if (!r.gl || d.errors.length) { finish(); return; }
    ok(r.W > 0 && r.H > 0, '画布尺寸 ' + r.W + '×' + r.H);

    // 允许 ?off=part,city,... 关闭图层，用于二分定位渲染异常
    var offL = (/[?&]off=([a-z,]+)/.exec(qs) || [, ''])[1].split(',');
    var offHas = function (k) { return offL.indexOf(k) >= 0; };
    if (offL.filter(Boolean).length) { lines.push('# 关闭图层: ' + offL.join(',')); }
    var phases = [
      ['火球膨胀 (1 ms)', 1e-3],
      ['双闪光极小值', P.tMin(app.state.W)],
      ['第二极大闪光', P.t2Max(app.state.W)],
      ['激波扫过 (1 s)', 1.0],
      ['涡环翻卷 (12 s)', 12],
      ['蘑菇云 (90 s)', 90],
      ['稳定铺开', P.stabilizeTime(app.state.W)]
    ];
    for (var i = 0; i < phases.length; i++) {
      var name = phases[i][0], t = phases[i][1];
      var tSeek0 = (root.performance || Date).now();
      app.sim.seek(t);
      var seekMs = (root.performance || Date).now() - tSeek0;
      app.simTime = app.sim.t;
      app.state.s = app.tToS(t);
      app._updateCamera(0.5); app._updateCamera(0.5); app._updateCamera(0.5);
      // 渲染两帧：第一帧含着色器/缓冲预热，第二帧才是稳态耗时
      var envP = app.envParams();
      envP.noSky = offHas('sky'); envP.noGround = offHas('ground');
      envP.noParticles = offHas('part');
      if (offHas('city')) { envP.showCity = false; }
      if (offHas('shock')) { envP.showShock = false; }
      if (offHas('wilson')) { envP.showWilson = false; }
      if (offHas('bloom')) { envP.bloom = 0; }
      if (offHas('white')) { envP.whiteoutScale = 0; }
      app.renderer.render(app.sim, app.cam, envP);
      var t0 = (root.performance || Date).now();
      app.renderer.render(app.sim, app.cam, envP);
      var ms = (root.performance || Date).now() - t0;
      var s = r.sampleStats();
      var glErr = r.gl.getError();
      // NaN 扫描
      var nan = 0, dd = app.sim.data;
      for (var k = 0; k < app.sim.count; k++) {
        if (!app.sim.alive[k]) { continue; }
        for (var q = 0; q < 12; q++) { if (!isFinite(dd[k * 12 + q])) { nan++; } }
      }
      var info = 'mean=' + s.mean.toFixed(3) + ' max=' + s.max.toFixed(3) +
        ' 非黑=' + (s.nonBlackFrac * 100).toFixed(1) + '% 粒子=' + r.stats.drawn +
        ' 云顶=' + U.fmtLen(app.sim.cloudTop) + ' 楼=' + r.stats.buildings +
        ' 渲染=' + ms.toFixed(0) + 'ms' +
        ' seek=' + seekMs.toFixed(0) + 'ms 曝光=' + r.exposure.toExponential(1) +
        ' 白化=' + r.whiteout.toFixed(2);
      ok(glErr === 0, name + ' · 无 GL 错误', 'glGetError=0x' + glErr.toString(16));
      ok(nan === 0, name + ' · 粒子无 NaN/Inf', 'nan=' + nan);
      ok(s.nonBlackFrac > 0.5, name + ' · 画面非黑屏', info);
      ok(s.mean > 0.004 && s.mean < 0.99, name + ' · 亮度在合理区间', info);
      // 画面不能被闪光糊成一片纯色：亮部与均值必须有可分辨的差异
      ok(s.max - s.mean > 0.02, name + ' · 画面有明暗结构（非纯色）',
        'max-mean=' + (s.max - s.mean).toFixed(3));
      ok(r.stats.drawn > 10, name + ' · 有粒子被绘制', 'drawn=' + r.stats.drawn);
      ok(r.stats.buildings > 20, name + ' · 建筑实例已提交绘制',
        'instances=' + r.stats.buildings);
      // 黑方块回归：闪光期若曝光/散射处理不当，背光立面会被压成纯黑矩形
      var grid = r.readTiles(48, 27);
      var dr = r.findDarkRect(grid);
      ok(dr.score < 0.35, name + ' · 无异常黑方块',
        '评分=' + dr.score.toFixed(2) + ' 暗块=' + dr.area + ' bbox=' + dr.w + 'x' + dr.h +
        '@(' + dr.x0 + ',' + dr.y0 + ')' +
        ' 内/外亮度=' + dr.inner.toFixed(3) + '/' + dr.outer.toFixed(3));
      if (dr.score >= 0.35) {
        lines.push('  ── ' + name + ' 亮度分块图（左下为原点）──');
        lines.push(r.asciiTiles(grid));
        // 诊断：把该帧的关键 uniform 与实例数据打印出来
        var pd = r.partData, mm = r.stats.drawn;
        var st2 = { size: [1e9, -1e9], temp: [1e9, -1e9], opa: [1e9, -1e9], sh: [1e9, -1e9] };
        for (var q2 = 0; q2 < Math.min(mm, 4000); q2++) {
          var b3 = q2 * 12;
          st2.size[0] = Math.min(st2.size[0], pd[b3 + 4]); st2.size[1] = Math.max(st2.size[1], pd[b3 + 4]);
          st2.temp[0] = Math.min(st2.temp[0], pd[b3 + 5]); st2.temp[1] = Math.max(st2.temp[1], pd[b3 + 5]);
          st2.opa[0] = Math.min(st2.opa[0], pd[b3 + 6]); st2.opa[1] = Math.max(st2.opa[1], pd[b3 + 6]);
          st2.sh[0] = Math.min(st2.sh[0], pd[b3 + 9]); st2.sh[1] = Math.max(st2.sh[1], pd[b3 + 9]);
        }
        var Pw2 = app.sim.blast.power(app.sim.t);
        var fL = Pw2 / (4 * Math.PI) / 1000;
        lines.push('     诊断: P=' + Pw2.toExponential(2) + 'W flashLight=' + fL.toExponential(2) +
          ' 曝光=' + r.exposure.toExponential(2) + ' 白化=' + r.whiteout.toFixed(2) +
          ' emissive=' + app.state.emissive);
        lines.push('     实例: size=' + st2.size[0].toFixed(1) + '~' + st2.size[1].toFixed(1) +
          ' T=' + st2.temp[0].toFixed(0) + '~' + st2.temp[1].toFixed(0) +
          ' opa=' + st2.opa[0].toFixed(3) + '~' + st2.opa[1].toFixed(3) +
          ' shade=' + st2.sh[0].toFixed(2) + '~' + st2.sh[1].toFixed(2) +
          ' 相机距爆心=' + U.fmtLen(Math.hypot(app.cam.pos[0], app.cam.pos[1] - app.state.hob, app.cam.pos[2])));
        var pb0 = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9];
        for (var q3 = 0; q3 < mm; q3++) {
          var b4 = q3 * 12;
          pb0[0] = Math.min(pb0[0], pd[b4]); pb0[1] = Math.max(pb0[1], pd[b4]);
          pb0[2] = Math.min(pb0[2], pd[b4 + 1]); pb0[3] = Math.max(pb0[3], pd[b4 + 1]);
          pb0[4] = Math.min(pb0[4], pd[b4 + 2]); pb0[5] = Math.max(pb0[5], pd[b4 + 2]);
        }
        lines.push('     位置包围盒: x[' + pb0[0].toFixed(1) + ',' + pb0[1].toFixed(1) +
          '] y[' + pb0[2].toFixed(1) + ',' + pb0[3].toFixed(1) +
          '] z[' + pb0[4].toFixed(1) + ',' + pb0[5].toFixed(1) + ']  实例数=' + mm);
        var envOnly = app.envParams();
        envOnly.noSky = true; envOnly.noGround = true; envOnly.showCity = false;
        envOnly.showShock = false; envOnly.showWilson = false;
        r.render(app.sim, app.cam, envOnly);
        lines.push('  ── 同一帧「只画粒子」──');
        lines.push(r.asciiTiles(r.readTiles(48, 27)));
        var envNP = app.envParams(); envNP.noParticles = true;
        r.render(app.sim, app.cam, envNP);
        lines.push('  ── 同一帧「关闭粒子」对照图 ──');
        lines.push(r.asciiTiles(r.readTiles(48, 27)));
        r.render(app.sim, app.cam, envP);
      }
    }
    /* ---- 城市与破坏 ---- */
    var cs = app.sim.cityStats, NB = app.sim.buildings.length;
    var sev = (cs.partial + cs.collapse + cs.scour) / Math.max(NB, 1);
    ok(NB > 300, '城市已生成', NB + ' 栋 / 城区 ' + U.fmtLen(app.sim.cityR));
    // 重度毁伤率 ≈ (全毁环 / 城区)² × 密度向内集中的修正。判据必须随
    // 「全毁环占城区的比例」自适应：1 kt 时全毁环只占城区面积的 ~14%，
    // 而兆吨级地爆会把整座城市（数十公里）全部摧毁 —— 两者都是正确结果。
    var rSev = app.sim.blast.radiusForPsi(4);
    var cover = Math.min(rSev / Math.max(app.sim.cityR, 1), 1);
    ok(sev > 0.05 && sev <= 1.0, '重度毁伤率在合理区间',
      (sev * 100).toFixed(1) + '%（部分' + cs.partial + ' 全塌' + cs.collapse +
      ' 清扫' + cs.scour + '）  全毁环/城区=' + cover.toFixed(2));
    ok(Math.abs(sev - Math.min(1, cover * cover * 1.5 + 0.04)) < 0.42,
      '重度毁伤率与全毁环面积占比一致',
      '实测 ' + (sev * 100).toFixed(1) + '% vs 预期 ' +
      (Math.min(1, cover * cover * 1.5 + 0.04) * 100).toFixed(1) + '%');
    if (app.sim.cityR > 1.6 * rSev) {
      ok(cs.intact + cs.glass + cs.clad > NB * 0.05,
        '城区大于毁伤圈时外圈有建筑存活（毁伤呈梯度）',
        '完好' + cs.intact + ' 玻璃' + cs.glass + ' 外墙' + cs.clad);
    } else {
      ok(sev > 0.55, '城区小于毁伤圈时全城被摧毁（兆吨级的正确结果）',
        (sev * 100).toFixed(1) + '%');
    }
    var rub = 0, stump = 0;
    for (var bi2 = 0; bi2 < app.sim.buildings.length; bi2++) {
      var bb2 = app.sim.buildings[bi2];
      if (bb2.rubbleH > 0.35) { rub++; }
      if (bb2.state === 3 && bb2.h > 0.3 * bb2.h0) { stump++; }
    }
    ok(rub > 20, '废墟堆已生成（完全倒塌只剩废墟）', rub + ' 处');
    if (cs.partial > 5) {
      ok(stump > 5, '部分倒塌留下残存主体', stump + ' 处 / 共 ' + cs.partial + ' 栋部分倒塌');
    } else {
      // 超大当量下城区完全落在全毁环内，不存在「部分倒塌」这一中间态
      ok(sev > 0.9, '全城被彻底摧毁，无「部分倒塌」中间态（超大当量的正确结果）',
        (sev * 100).toFixed(1) + '%');
    }
    ok(cs.burnt > 0, '热辐射点燃了建筑', cs.burnt + ' 栋起火 / 燃烧中 ' + cs.burning);
    ok(app.sim.kindCount(NK.Sim.KIND.SMOKE) > 20, '火场浓烟粒子已生成',
      app.sim.kindCount(NK.Sim.KIND.SMOKE) + ' 粒');
    // 形态学：以各高度处的云轴为中心（风切变会让轴倾斜）
    var sim = app.sim, d = sim.data;
    function radii(lo, hi, kinds) {
      var a = [];
      for (var i2 = 0; i2 < sim.count; i2++) {
        if (!sim.alive[i2]) { continue; }
        var b2 = i2 * 12, k2 = d[b2 + 11] | 0, y2 = d[b2 + 1];
        if (kinds.indexOf(k2) < 0 || y2 < lo || y2 > hi) { continue; }
        var dx2 = d[b2] - sim.axisXAt(y2), dz2 = d[b2 + 2];
        a.push(Math.sqrt(dx2 * dx2 + dz2 * dz2));
      }
      a.sort(function (x, y) { return x - y; });
      return a;
    }
    var capA = radii(sim.cz - 0.9 * sim.Hdisk, sim.cz + 1.5 * sim.Hdisk, [0, 1]);
    var stemA = radii(0.18 * sim.cz, 0.62 * sim.cz, [2]);
    var capR = capA.length ? capA[Math.floor(capA.length * 0.9)] : 0;
    var stemR = stemA.length ? stemA[Math.floor(stemA.length * 0.5)] : 1e9;
    // 亚千吨级云团小、相对湍流强（实测柱宽与随机行走估计一致），真实形态本就
    // 接近「细高的蓬松柱」而非典型蘑菇 —— 因此对小当量改为检验柱状形态这一
    // 正面判据，而不是削弱蘑菇阈值。
    if (app.state.W < 5) {
      ok(app.sim.cloudTop / Math.max(app.sim.Rdisk, 1) > 2.0,
        '形态：小当量呈细高柱状（高/宽 > 2）',
        U.fmtLen(app.sim.cloudTop) + ' / ' + U.fmtLen(app.sim.Rdisk) + ' = ' +
        (app.sim.cloudTop / app.sim.Rdisk).toFixed(2) +
        '；盖/茎 = ' + (capR / stemR).toFixed(2));
    } else {
      ok(capR / stemR > 1.6, '形态：云盖显著宽于尘茎（蘑菇形）',
        '盖 ' + U.fmtLen(capR) + ' / 茎 ' + U.fmtLen(stemR) + ' = ' +
        (capR / stemR).toFixed(2));
    }
    ok(sim.Hdisk / sim.Rdisk < 1.3, '形态：云盘呈扁平砧状',
      (sim.Hdisk / sim.Rdisk).toFixed(2));
    /* ---- 镜头视角：建筑毁坏是否「看得清」 ----
       指标 = 毁伤区内建筑在屏幕上的像素高度中位数（客观、可回归）。 */
    var M4 = U.mat4;
    function camMetrics() {
      var sim2 = app.sim, cam2 = app.cam;
      var vw = M4.create(), pj = M4.create(), vp2 = M4.create();
      M4.lookAt(vw, cam2.pos, cam2.target, [0, 1, 0]);
      M4.perspective(pj, cam2.fov, r.W / r.H, cam2.near, cam2.far);
      M4.mul(vp2, pj, vw);
      function proj(x, y, z) {
        var w = vp2[3] * x + vp2[7] * y + vp2[11] * z + vp2[15];
        if (w <= 1e-4) { return null; }
        return {
          x: (vp2[0] * x + vp2[4] * y + vp2[8] * z + vp2[12]) / w,
          y: (vp2[1] * x + vp2[5] * y + vp2[9] * z + vp2[13]) / w
        };
      }
      var R5b = sim2.blast.radiusForPsi(5);
      var hs = [], vis = [], onScreen = 0, tot = 0, dmgSeen = 0;
      for (var i2 = 0; i2 < sim2.buildings.length; i2++) {
        var b2 = sim2.buildings[i2];
        if (b2.r > 1.25 * R5b) { continue; }
        tot++;
        var p0 = proj(b2.x, 0, b2.z), p1 = proj(b2.x, Math.max(b2.h0, 4), b2.z);
        if (!p0 || !p1) { continue; }
        var inX = Math.abs(p0.x) < 1.1, inY = p0.y > -1.15 && p0.y < 1.15;
        if (inX && inY) {
          onScreen++;
          if (b2.state >= 3) { dmgSeen++; }
          var px = Math.abs(p1.y - p0.y) * r.H * 0.5;
          hs.push(px);
          vis.push({ px: px, dc: Math.hypot(b2.x - cam2.pos[0], b2.z - cam2.pos[2]) });
        }
      }
      hs.sort(function (a2, b3) { return a2 - b3; });
      // 前景指标：离相机最近的 30 栋在画面内建筑的像素高中位数。
      // 直接用全体中位数会被「相机与爆心之间成千上万栋远处建筑」稀释 ——
      // 兆吨级下相机前方明明有 90 px 高的楼，全体 p90 却只有 4 px。
      vis.sort(function (a2, b3) { return a2.dc - b3.dc; });
      var fg = vis.slice(0, 30).map(function (v2) { return v2.px; })
        .sort(function (a2, b3) { return a2 - b3; });
      return {
        med: hs.length ? hs[hs.length >> 1] : 0,
        p90: hs.length ? hs[Math.floor(hs.length * 0.9)] : 0,
        fg: fg.length ? fg[fg.length >> 1] : 0,
        fgN: fg.length,
        onScreen: onScreen, tot: tot, dmgSeen: dmgSeen
      };
    }
    // 取「激波刚扫到相机视野」的时刻 —— 那才是相机前方建筑成片倒塌的窗口。
    // 若统一取 5 psi 圈的到达时间×2.2，兆吨级下相机周围早已被荡平多时。
    var rMeter = Math.min(0.95 * app.sim.blast.radiusForPsi(5), 0.45 * app.sim.cityR);
    var tDmg = app.sim.blast.arrival(rMeter) * 1.2 + 0.6;
    var modes = ['auto', 'city', 'street', 'top', 'cloud'];
    var camRes = {};
    for (var mi = 0; mi < modes.length; mi++) {
      var mode = modes[mi];
      app.setCamMode(mode);
      app.sim.seek(tDmg);
      app.simTime = app.sim.t;
      for (var cw = 0; cw < 8; cw++) { app._updateCamera(0.35); }
      var envM = app.envParams();
      app.renderer.render(app.sim, app.cam, envM);
      var cm = camMetrics();
      var drm = r.findDarkRect(r.readTiles(48, 27));
      cm.eye = app.cam.pos[1];
      cm.blend = app._frame && app._frame.blend != null ? app._frame.blend : -1;
      camRes[mode] = cm;
      lines.push('  视角 ' + mode.padEnd(7) +
        ' 前景建筑像素高=' + cm.fg.toFixed(0) + 'px（全体中位 ' + cm.med.toFixed(1) +
        '/90% ' + cm.p90.toFixed(1) + '）' +
        '  在画面内 ' + cm.onScreen + '/' + cm.tot +
        '（其中受损 ' + cm.dmgSeen + '）' +
        ' 相机距爆心=' + U.fmtLen(Math.hypot(app.cam.pos[0], app.cam.pos[2])) +
        ' 眼高=' + U.fmtLen(app.cam.pos[1]) +
        ' 黑块评分=' + drm.score.toFixed(2));
      ok(drm.score < 0.35, '视角 ' + mode + ' · 无异常黑方块', '评分=' + drm.score.toFixed(2));
    }
    ok(camRes.city.fg > 12, '城市视角：前景建筑足够大（> 12px）',
      camRes.city.fg.toFixed(0) + 'px（前景样本 ' + camRes.city.fgN + ' 栋）');
    // 阈值 18px（≈画面高度的 3%）：兆吨级城区半径 14 km、建筑上限 1 万栋，
    // 密度 16.7 栋/km²，前景 30 栋会延伸到 ~1.2 km，像素高自然低于小当量
    ok(camRes.street.fg > 18, '街面视角：前景建筑充满画面（> 18px）',
      camRes.street.fg.toFixed(0) + 'px（前景样本 ' + camRes.street.fgN + ' 栋）');
    ok(camRes.street.eye < 40, '街面视角眼高在人/车视高量级（< 40 m）',
      U.fmtLen(camRes.street.eye));
    // 后期（云已长大）对比：此时纯云视角必然远离城市
    var lateCmp = {};
    ['city', 'cloud'].forEach(function (mo) {
      app.setCamMode(mo);
      app.sim.seek(60);
      app.simTime = app.sim.t;
      for (var cw2 = 0; cw2 < 10; cw2++) { app._updateCamera(0.35); }
      app.renderer.render(app.sim, app.cam, app.envParams());
      lateCmp[mo] = camMetrics();
    });
    ok(lateCmp.city.fg > lateCmp.cloud.fg * 1.6,
      't=60s 时城市视角比纯云视角清楚得多',
      '城市前景 ' + lateCmp.city.fg.toFixed(0) + 'px vs 云前景 ' +
      lateCmp.cloud.fg.toFixed(0) + 'px');
    ok(camRes.top.onScreen > camRes.top.tot * 0.75,
      '俯视视角：毁伤区建筑基本都在画面内（可见同心毁伤环）',
      camRes.top.onScreen + '/' + camRes.top.tot);
    ok(camRes.auto.fg > 10, '自动视角在毁伤窗口内也偏向城市构图',
      '前景 ' + camRes.auto.fg.toFixed(0) + 'px，城市权重 ' + camRes.auto.blend.toFixed(2));
    app.setCamMode('auto');
    // 镜头测量把仿真推到了 t=60 s，恢复到稳定期再做后续物理断言
    app.sim.seek(P.stabilizeTime(app.state.W));
    app.simTime = app.sim.t;

    /* ---- H 键：隐藏全部界面（含播放条） ---- */
    (function () {
      function disp(id) {
        var el = doc.getElementById(id);
        return el ? root.getComputedStyle(el).display : 'missing';
      }
      var ids = ['ctl', 'hudbox', 'bar', 'notes'];
      var before = ids.map(disp).join(',');
      doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'h' }));
      var after = ids.map(disp);
      ok(after.every(function (d2) { return d2 === 'none'; }),
        'H 键隐藏全部界面（含播放条 #bar）', ids.map(function (id, i3) {
          return id + '=' + after[i3];
        }).join(' '));
      doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'h' }));
      var back = ids.map(disp);
      ok(back.every(function (d2) { return d2 !== 'none'; }),
        'H 键再次按下恢复界面', back.join(','));
      if (before === 'x') { lines.push(''); }
    })();

    // 物理一致性抽检
    var bl = app.sim.blast;
    var r5 = bl.radiusForPsi(5);
    // 注意用「有效当量」：地爆的地面反射会把有效当量放大最多 1.8 倍，
    // 于是 5 psi 半径合理地比同当量空爆大 1.8^(1/3) ≈ 1.22 倍
    var r5ref = 6400 * Math.pow(bl.Weff / 1000, 1 / 3);
    ok(Math.abs(r5 / r5ref - 1) < 0.08, '5 psi 半径符合立方根标定律',
      U.fmtLen(r5) + ' vs ' + U.fmtLen(r5ref) + '（有效当量 ' + U.fmtYield(bl.Weff) + '）');
    // H = 21.6·(W/Mt)^0.2 是用兆吨级数据拟合的，向下外推到千吨级会明显偏高，
    // 因此小当量放宽下界（详见 README「已知局限」）
    var topMin = app.state.W < 5 ? 0.45 : 0.6;
    ok(app.sim.cloudTop > topMin * P.cloudTopEmpirical(app.state.W),
      '云顶达到经验值的 ' + (topMin * 100) + '% 以上',
      U.fmtLen(app.sim.cloudTop) + ' vs ' + U.fmtLen(P.cloudTopEmpirical(app.state.W)));
    finish();

    function finish() {
      var el = doc.getElementById('selftest');
      if (!el) {
        el = doc.createElement('pre');
        el.id = 'selftest';
        doc.body.appendChild(el);
      }
      el.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#000;color:#0f0;' +
        'font:12px/1.5 monospace;padding:12px;max-height:100%;overflow:auto;white-space:pre-wrap';
      var head = fails === 0 ? 'SELFTEST:OK' : 'SELFTEST:FAIL(' + fails + ')';
      el.textContent = head + '\n' + lines.join('\n');
      doc.title = head;
      root.__SELFTEST__ = { fails: fails, lines: lines };
    }
  };

  /* ---------------------------------------------------------------- 黑块探测 */
  /**
   * ?blackbox=1[&off=sky,ground,city,part,shock,wilson,post][&W=..&hob=..]
   * 逐帧读回像素 → 分块亮度 → 连通域 → 找出「暗且填充率高（矩形）」的区块。
   * 输出 ASCII 亮度图供定位。纯数值判据，不使用任何视觉模型。
   */
  NK.runBlackBoxTest = function () {
    var out = [];
    var qs = root.location.search || '';
    var off = (/[?&]off=([a-z,]+)/.exec(qs) || [, ''])[1].split(',');
    var has = function (k) { return off.indexOf(k) >= 0; };
    var app = new NK.App();
    var mW = /[?&]W=([\d.]+)/.exec(qs), mH = /[?&]hob=([\d.]+)/.exec(qs);
    if (mW) { app.state.W = parseFloat(mW[1]); }
    if (mH) { app.state.hob = parseFloat(mH[1]); }
    if (mW || mH) { app.reconfigure(true); }
    var r = app.renderer;
    if (!r.gl || r.errors.length) {
      dump('GL 初始化失败: ' + r.errors.join(' | '));
      return;
    }
    out.push('# 关闭图层: ' + (off.filter(Boolean).join(',') || '（无）') +
      '  W=' + app.state.W + 'kt hob=' + app.state.hob + 'm  ' + r.W + 'x' + r.H);

    // 连续播放模式（复现真实播放路径：曝光自适应与相机平滑逐帧演化，
    // 这是复现「闪烁」类问题的必要条件）；否则退化为对数采样。
    var worst = null;
    var cont = /[?&]cont=1/.test(qs);
    var lowCam = /[?&]cam=low/.test(qs);
    function forceLowCam() {
      // 城内低空机位：正对爆心方向，眼高 40 m，距爆心 1.1 km
      var c = app.cam;
      c.target = [0, 260, 0];
      c.pos = [1100, 40, 260];
      c.near = 3; c.far = 200000;
    }
    var frames = [];
    if (cont) {
      var sEnd = parseFloat((/[?&]sEnd=([\d.]+)/.exec(qs) || [, '0.62'])[1]);
      var dtW = 1 / 30;
      app.sim.reset(); app.simTime = 0; app.state.s = 0;
      out.push('# 连续模式: dtWall=1/30 speed=' + app.state.speed + ' 至 s=' + sEnd);
      var guard = 0;
      while (app.state.s < sEnd && guard++ < 4000) {
        app.state.s += dtW * app.state.speed / 62;
        var tT = app.sToT(app.state.s);
        var dtP = tT - app.simTime;
        if (dtP > 0) {
          var mx = Math.max(app.simTime * 0.35, 2e-4), gg = 0;
          while (dtP > 1e-9 && gg++ < 6) {
            var hh = Math.min(dtP, mx);
            app.sim.step(hh); dtP -= hh; mx = Math.max(app.sim.t * 0.35, 2e-4);
          }
          app.simTime = app.sim.t;
        }
        app._updateCamera(dtW);
      if (lowCam) { forceLowCam(); }
        frames.push(-1);   // 占位：连续模式下逐帧就地渲染
        renderAndScan(app.sim.t);
      }
      finish();
      return;
    }
    var times = [];
    for (var e = -3.3; e <= 1.7; e += 0.14) { times.push(Math.pow(10, e)); }
    for (var ti = 0; ti < times.length; ti++) {
      var t = times[ti];
      app.sim.seek(t);
      app.simTime = app.sim.t;
      app.state.s = app.tToS(t);
      for (var w = 0; w < 3; w++) { app._updateCamera(0.4); }
      if (lowCam) { forceLowCam(); }
      var env = app.envParams();
      env.noSky = has('sky'); env.noGround = has('ground');
      env.noParticles = has('part');
      if (has('city')) { env.showCity = false; }
      if (has('shock')) { env.showShock = false; }
      if (has('wilson')) { env.showWilson = false; }
      if (has('post')) { env.bloom = 0; env.distort = 0; }
      r.render(app.sim, app.cam, env);
      var g = r.readTiles(48, 27);
      var res = findDarkRect(g);
      if (!worst || res.score > worst.res.score) { worst = { t: t, res: res, grid: g }; }
      if (res.score > 0.35) {
        out.push('  t=' + U.fmtTime(t).padEnd(11) + ' 帧均值=' + res.mean.toFixed(3) +
          ' 暗块=' + res.area + ' bbox=' + res.w + 'x' + res.h +
          ' 填充=' + res.fill.toFixed(2) + ' 内/外亮度=' + res.inner.toFixed(3) +
          '/' + res.outer.toFixed(3) + ' 评分=' + res.score.toFixed(2));
      }
    }
    finish();

    function renderAndScan(tNow) {
      var env2 = app.envParams();
      env2.noSky = has('sky'); env2.noGround = has('ground');
      env2.noParticles = has('part');
      if (has('city')) { env2.showCity = false; }
      if (has('shock')) { env2.showShock = false; }
      if (has('wilson')) { env2.showWilson = false; }
      if (has('post')) { env2.bloom = 0; env2.distort = 0; }
      r.render(app.sim, app.cam, env2);
      var g2 = r.readTiles(48, 27);
      var res2 = findDarkRect(g2);
      if (!worst || res2.score > worst.res.score) { worst = { t: tNow, res: res2, grid: g2 }; }
      if (res2.score > 0.40) {
        out.push('  t=' + U.fmtTime(tNow).padEnd(11) + ' 帧均值=' + res2.mean.toFixed(3) +
          ' 暗块=' + res2.area + ' bbox=' + res2.w + 'x' + res2.h +
          '@(' + res2.x0 + ',' + res2.y0 + ')' +
          ' 填充=' + res2.fill.toFixed(2) + ' 内/外=' + res2.inner.toFixed(3) +
          '/' + res2.outer.toFixed(3) + ' 评分=' + res2.score.toFixed(2));
      }
    }

    function finish() {
      if (worst) {
        out.push('');
        out.push('## 最可疑帧 t=' + U.fmtTime(worst.t) + '  评分=' + worst.res.score.toFixed(2) +
          '  bbox=(' + worst.res.x0 + ',' + worst.res.y0 + ')-(' +
          (worst.res.x0 + worst.res.w - 1) + ',' + (worst.res.y0 + worst.res.h - 1) + ')' +
          ' 填充=' + worst.res.fill.toFixed(2) + ' 内/外亮度=' + worst.res.inner.toFixed(3) +
          '/' + worst.res.outer.toFixed(3));
        out.push(asciiMap(worst.grid));
      }
      dump(out.join('\n'));
    }

    function findDarkRect(g) { return r.findDarkRect(g); }

    function asciiMap(g) {
      var ch = ' .:-=+*#%@';
      var s2 = [];
      for (var y = g.ty - 1; y >= 0; y--) {
        var line = '   ';
        for (var x = 0; x < g.tx; x++) {
          var v = g.tiles[x + y * g.tx];
          line += ch[Math.min(9, Math.max(0, Math.round(Math.pow(v, 0.5) * 9)))];
        }
        s2.push(line);
      }
      return s2.join('\n');
    }

    function dump(txt) {
      var el = doc.getElementById('selftest');
      if (!el) { el = doc.createElement('pre'); el.id = 'selftest'; doc.body.appendChild(el); }
      el.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#000;color:#0f0;' +
        'font:11px/1.25 monospace;padding:8px;max-height:100%;overflow:auto;white-space:pre';
      el.textContent = 'BLACKBOX\n' + txt;
      doc.title = 'BLACKBOX';
    }
  };

  /* ---------------------------------------------------------------- 启动 */
  root.addEventListener('DOMContentLoaded', function () {
    var q = root.location.search || '';
    if (/[?&]blackbox=1/.test(q)) { NK.runBlackBoxTest(); return; }
    if (/[?&]selftest=1/.test(q)) { NK.runSelfTest(); return; }
    var app = NK.app = new NK.App();
    function loop() { app.frame(); root.requestAnimationFrame(loop); }
    root.requestAnimationFrame(loop);
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
