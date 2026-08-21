/* ============================================================================
 * viewer3d.js — 三维展示台 + 方向精灵烘焙器
 * ----------------------------------------------------------------------------
 * 【展示台 Viewer3D】装备检视/图鉴中的可旋转三维实体，按需渲染(空闲零开销)。
 * 【烘焙器 SpriteBank】把三维模型离屏渲染成 N 个航向角的位图并缓存，
 *   战场地图直接 2D 贴图 —— 既得到三维实体外观，又保持纯 2D 的绘制开销。
 *   · 惰性烘焙、每帧预算限制、按画质分级、LRU 上限
 *   · WebGL 不可用时自动回退到二维矢量绘制
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  var doc = root.document;

  function haveGL() {
    if (TWG._glOk != null) return TWG._glOk;
    if (typeof root.THREE === 'undefined' || !doc) return (TWG._glOk = false);
    try {
      var c = doc.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      TWG._glOk = !!gl;
      if (gl && gl.getExtension) { var lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext(); }
    } catch (e) { TWG._glOk = false; }
    return TWG._glOk;
  }

  /* 通用灯光/环境 */
  function lightRig(scene, X, opt) {
    opt = opt || {};
    var hemi = new X.HemisphereLight(0xbcd8e6, 0x1a2228, 0.85);
    scene.add(hemi);
    var key = new X.DirectionalLight(0xffffff, 1.55);
    key.position.set(-1.1, 1.7, 0.85);
    if (opt.shadow) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      var d = opt.shadowExtent || 200;
      key.shadow.camera.left = -d; key.shadow.camera.right = d;
      key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
      key.shadow.camera.near = 0.5; key.shadow.camera.far = d * 6;
      key.shadow.bias = -0.0012;
    }
    scene.add(key);
    var fill = new X.DirectionalLight(0x88b6d8, 0.55);
    fill.position.set(1.4, 0.6, -1.0);
    scene.add(fill);
    var rim = new X.DirectionalLight(0xffd9a0, 0.35);
    rim.position.set(0.3, 0.4, -1.6);
    scene.add(rim);
    return { hemi: hemi, key: key, fill: fill, rim: rim };
  }

  /* =====================================================================
   * Viewer3D — 检视面板/图鉴中的三维展示台
   * ===================================================================*/
  function Viewer3D(canvas, opt) {
    if (!haveGL()) { this.dead = true; return; }
    var X = root.THREE;
    this.opt = Object.assign({ shadow: true, autoRotate: true, grid: true, water: true }, opt || {});
    this.cv = canvas;
    this.X = X;
    this.renderer = new X.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !!this.opt.shadow;
    this.renderer.shadowMap.type = X.PCFSoftShadowMap;
    if (X.sRGBEncoding !== undefined) this.renderer.outputEncoding = X.sRGBEncoding;
    this.renderer.toneMapping = X.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.scene = new X.Scene();
    this.camera = new X.PerspectiveCamera(34, 1, 0.1, 20000);
    this.lights = lightRig(this.scene, X, { shadow: this.opt.shadow, shadowExtent: 220 });
    // 地面/海面
    this.groundMat = new X.MeshStandardMaterial({ color: 0x11242e, roughness: 0.28, metalness: 0.55, transparent: true, opacity: 0.92 });
    this.ground = new X.Mesh(new X.CircleGeometry(1, 48), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.gridHelper = null;
    this.holder = new X.Group();
    this.scene.add(this.holder);
    this.yaw = -0.7; this.pitch = 0.42; this.dist = 100;
    this.spin = 0;
    this._need = true;
    this._raf = 0;
    this.bind();
  }
  Viewer3D.prototype.bind = function () {
    if (this.dead) return;
    var self = this, drag = null;
    this.cv.style.touchAction = 'none';
    this.cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; self.cv.setPointerCapture(e.pointerId); self.userSpin = 1; });
    this.cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      self.yaw -= (e.clientX - drag.x) * 0.008;
      self.pitch = Math.max(-0.15, Math.min(1.45, self.pitch + (e.clientY - drag.y) * 0.006));
      drag.x = e.clientX; drag.y = e.clientY;
      self.request();
    });
    this.cv.addEventListener('pointerup', function (e) { drag = null; try { self.cv.releasePointerCapture(e.pointerId); } catch (x) { } });
    this.cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.dist *= (e.deltaY > 0 ? 1.12 : 0.89);
      self.dist = Math.max(self.minDist || 5, Math.min(self.maxDist || 4000, self.dist));
      self.request();
    }, { passive: false });
  };
  Viewer3D.prototype.show = function (cls, sideCol) {
    if (this.dead) return false;
    var X = this.X;
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    var m = TWG.M3D.get(cls, true);
    if (!m) return false;
    var bb = m.userData.bbox || (TWG.M3D.get(cls) || {}).userData.bbox;
    var size = bb ? bb.size : { x: 20, y: 8, z: 40 };
    var ctr = bb ? bb.center : { x: 0, y: 0, z: 0 };
    m.position.set(-ctr.x, -ctr.y, -ctr.z);
    this.holder.add(m);
    var span = Math.max(size.x, size.z, size.y * 1.6);
    this.dist = span * 1.9;
    this.minDist = span * 0.55; this.maxDist = span * 6;
    this.camera.near = Math.max(0.05, span / 900); this.camera.far = span * 40;
    this.camera.updateProjectionMatrix();
    // 地面盘尺寸与水/陸材质
    var P = TWG.PLATFORMS[cls];
    var naval = P && (P.domain === 'surface' || P.domain === 'sub');
    this.ground.geometry.dispose();
    this.ground.geometry = new X.CircleGeometry(span * 1.15, 56);
    this.groundMat.color.setHex(naval ? 0x0d2634 : 0x1e2620);
    this.groundMat.roughness = naval ? 0.22 : 0.9;
    this.groundMat.metalness = naval ? 0.6 : 0.1;
    this.ground.position.y = naval ? -(size.y * 0.5 - (bb ? 0 : 0)) * 0 : -size.y * 0.5;
    if (naval) this.ground.position.y = 0;                        // 水线
    if (this.gridHelper) { this.scene.remove(this.gridHelper); this.gridHelper.geometry.dispose(); }
    if (this.opt.grid) {
      var step = span > 200 ? 50 : span > 80 ? 20 : span > 25 ? 5 : 2;
      this.gridHelper = new X.GridHelper(Math.ceil(span * 2 / step) * step, Math.ceil(span * 2 / step),
        0x2c4a56, 0x1b3038);
      this.gridHelper.material.transparent = true; this.gridHelper.material.opacity = 0.42;
      this.gridHelper.position.y = this.ground.position.y + 0.02;
      this.scene.add(this.gridHelper);
    }
    this.cls = cls;
    this.userSpin = 0;
    this.spin = 0;
    this.request();
    return true;
  };
  Viewer3D.prototype.resize = function () {
    if (this.dead) return;
    var r = this.cv.getBoundingClientRect();
    var w = Math.max(80, Math.round(r.width)), h = Math.max(60, Math.round(r.height));
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  };
  Viewer3D.prototype.request = function () {
    if (this.dead) return;
    this._need = true;
    if (this._raf) return;
    var self = this;
    this._raf = root.requestAnimationFrame(function () { self._raf = 0; self.frame(); });
  };
  Viewer3D.prototype.frame = function () {
    if (this.dead) return;
    this.resize();
    var rotating = this.opt.autoRotate && !this.userSpin && this.visible !== false;
    if (rotating) this.spin += 0.0055;
    var yaw = this.yaw + this.spin;
    var cy = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(Math.sin(yaw) * cy, Math.sin(this.pitch) * this.dist + this.dist * 0.06, Math.cos(yaw) * cy);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    this._need = false;
    if (rotating) this.request();
  };
  Viewer3D.prototype.setAutoRotate = function (v) { this.opt.autoRotate = !!v; this.userSpin = v ? 0 : 1; this.request(); };
  Viewer3D.prototype.setVisible = function (v) { this.visible = v; if (v) this.request(); };
  Viewer3D.prototype.dispose = function () {
    if (this.dead) return;
    try { this.renderer.dispose(); } catch (e) { }
  };

  /* =====================================================================
   * SpriteBank — 三维模型 → 方向精灵位图缓存 (地图用)
   * ===================================================================*/
  var QUALITY = {
    low: { dirs: 8, px: 64, ss: 2, shadow: false, aa: false, maxCls: 30 },
    mid: { dirs: 12, px: 88, ss: 2, shadow: false, aa: true, maxCls: 36 },
    high: { dirs: 16, px: 124, ss: 2, shadow: true, aa: true, maxCls: 40 }
  };

  function SpriteBank(quality) {
    this.q = QUALITY[quality] || QUALITY.mid;
    this.cache = {};        // cls -> {dirs:[canvas], t:lastUse, scale:pxPerMeter}
    this.order = [];
    this.pending = [];
    this.dead = !haveGL();
    this.elev = 62 * Math.PI / 180;   // 俯视仰角 (兼顾三维感与位置精度)
    if (this.dead) return;
    var X = root.THREE;
    this.X = X;
    this.cv = doc.createElement('canvas');
    this.cv.width = this.cv.height = this.q.px * this.q.ss;
    try {
      this.renderer = new X.WebGLRenderer({ canvas: this.cv, antialias: this.q.aa, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { this.dead = true; return; }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.q.px * this.q.ss, this.q.px * this.q.ss, false);
    this.renderer.shadowMap.enabled = this.q.shadow;
    if (X.sRGBEncoding !== undefined) this.renderer.outputEncoding = X.sRGBEncoding;
    this.renderer.toneMapping = X.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new X.Scene();
    this.cam = new X.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
    lightRig(this.scene, X, { shadow: this.q.shadow, shadowExtent: 260 });
    this.holder = new X.Group();
    this.scene.add(this.holder);
  }
  SpriteBank.prototype.setQuality = function (q) {
    if (this.dead) return;
    var nq = QUALITY[q] || QUALITY.mid;
    if (nq === this.q) return;
    this.q = nq;
    this.cache = {}; this.order = []; this.pending = [];
    this.cv.width = this.cv.height = nq.px * nq.ss;
    this.renderer.setSize(nq.px * nq.ss, nq.px * nq.ss, false);
    this.renderer.shadowMap.enabled = nq.shadow;
  };
  /** 取得指定航向的精灵；未烘焙则登记任务并返回 null */
  SpriteBank.prototype.get = function (cls, hdgDeg) {
    if (this.dead) return null;
    var e = this.cache[cls];
    if (!e) {
      if (this.pending.indexOf(cls) < 0 && this.pending.length < 24) this.pending.push(cls);
      return null;
    }
    e.t = Date.now();
    if (e.bad) return null;
    var n = this.q.dirs;
    var i = Math.round(((hdgDeg % 360) + 360) % 360 / 360 * n) % n;
    return { img: e.dirs[i], px: this.q.px, mPerPx: e.mPerPx, len: e.len, pad: e.pad };
  };
  /** 每帧调用：按预算烘焙待办类型 */
  SpriteBank.prototype.pump = function (budget) {
    if (this.dead || !this.pending.length) return 0;
    var n = 0, b = budget == null ? 1 : budget;
    while (this.pending.length && n < b) {
      var cls = this.pending.shift();
      try { this.bake(cls); } catch (e) { this.cache[cls] = { dirs: [], bad: 1, t: Date.now() }; }
      n++;
    }
    return n;
  };
  SpriteBank.prototype.bake = function (cls) {
    var X = this.X, q = this.q;
    var m = TWG.M3D.get(cls, true);
    if (!m) { this.cache[cls] = { dirs: [], bad: 1, t: Date.now() }; return; }
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    var bb = m.userData.bbox || { size: { x: 20, y: 8, z: 40 }, center: { x: 0, y: 0, z: 0 } };
    var ctr = bb.center, size = bb.size;
    m.position.set(-ctr.x, -ctr.y, -ctr.z);
    var pivot = new X.Group(); pivot.add(m);
    this.holder.add(pivot);
    // 正交相机框住模型最大水平尺寸（留 12% 边距）
    var extent = Math.max(size.x, size.z) * 1.14;
    var halfV = extent / 2;
    this.cam.left = -halfV; this.cam.right = halfV; this.cam.top = halfV; this.cam.bottom = -halfV;
    this.cam.near = -extent * 6; this.cam.far = extent * 6;
    this.cam.updateProjectionMatrix();
    var d = extent * 2;
    this.cam.position.set(0, Math.sin(this.elev) * d, Math.cos(this.elev) * d);
    this.cam.lookAt(0, 0, 0);
    var dirs = [], px = q.px, ss = q.ss;
    for (var i = 0; i < q.dirs; i++) {
      var a = i / q.dirs * Math.PI * 2;
      pivot.rotation.y = -a;                 // 航向角 (0=正北=-Z)
      this.renderer.render(this.scene, this.cam);
      var c = doc.createElement('canvas');
      c.width = px; c.height = px;
      var cx = c.getContext('2d');
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(this.cv, 0, 0, px * ss, px * ss, 0, 0, px, px);   // 超采样降采样 = 抗锯齿
      dirs.push(c);
    }
    this.cache[cls] = { dirs: dirs, t: Date.now(), mPerPx: extent / px, len: Math.max(size.x, size.z), pad: 1.14 };
    this.order.push(cls);
    while (this.order.length > q.maxCls) {
      var old = this.order.shift();
      if (old !== cls) delete this.cache[old];
    }
  };
  SpriteBank.prototype.stats = function () {
    var n = 0, bad = 0;
    Object.keys(this.cache).forEach(function (k) { if (this.cache[k].bad) bad++; else n++; }, this);
    return { classes: n, bad: bad, dirs: this.q.dirs, px: this.q.px, pending: this.pending.length,
      approxMB: +(n * this.q.dirs * Math.pow(this.q.px, 2) * 4 / 1048576).toFixed(1) };
  };

  TWG.haveGL = haveGL;
  TWG.Viewer3D = Viewer3D;
  TWG.SpriteBank = SpriteBank;
  TWG.SPRITE_QUALITY = QUALITY;
})(typeof window !== 'undefined' ? window : globalThis);
