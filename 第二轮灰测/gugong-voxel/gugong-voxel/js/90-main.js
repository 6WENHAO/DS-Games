/* =====================================================================
 * 紫禁城 体素模型 — 应用层 (Main)
 * ---------------------------------------------------------------------
 * · 真实太阳位置（北纬 39.92°）驱动平行光 + 天空 + 雾色，正午日在正南
 * · 跟随视点自适应的正交阴影相机（静态阴影贴图，移动后节流刷新）
 * · 自写环绕 / 平移 / 缩放 / WASD 漫游相机，含触屏
 * · 分帧建网格 + 载入进度
 * · 校验报告与建成单体清单接入侧栏，点击飞抵
 * ===================================================================== */
(function (G) {
  'use strict';
  var T = G.THREE;
  var $ = function (s) { return document.querySelector(s); };

  /* =============== 载入进度 =============== */
  var boot = $('#boot'), bar = $('#bar i'), bmsg = $('#bmsg'), blog = $('#blog');
  var logLines = [];
  function setProg(p, msg) {
    bar.style.width = Math.round(p * 100) + '%';
    if (msg) bmsg.textContent = msg;
  }
  function addLog(m) {
    logLines.push('· ' + m);
    if (logLines.length > 13) logLines.shift();
    blog.innerHTML = logLines.join('<br>');
  }
  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); }

  /* =============== 渲染器 =============== */
  var canvas = $('#cv');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
  else renderer.outputEncoding = T.sRGBEncoding;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  var maxTex = renderer.capabilities.maxTextureSize || 4096;
  var SMAP = [2048, 4096, Math.min(8192, maxTex)];
  var SMAP_LBL = ['2K', '4K', SMAP[2] >= 8192 ? '8K' : '4K'];

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.6, 6000);

  /* =============== 天空 / 雾 / 光 =============== */
  var sky = G.MeshKit.createSky();
  scene.add(sky.mesh);
  scene.fog = new T.Fog(0xb9cfe0, 300, 2400);

  var sun = new T.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SMAP[1], SMAP[1]);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 2800;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  var hemi = new T.HemisphereLight(0xbfd8ee, 0x6a5f4c, 0.44);
  scene.add(hemi);
  var amb = new T.AmbientLight(0xffffff, 0.11);
  scene.add(amb);
  // 补一盏极弱的反向光，避免背阴面纯黑（模拟地面与红墙的互反射）
  var bounce = new T.DirectionalLight(0xa9b7c9, 0.20);
  scene.add(bounce);

  /* ---- 真实太阳位置：北纬 39.92°，取赤纬 +15°（春末夏初） ---- */
  var LAT = 39.92 * Math.PI / 180, DEC = 15 * Math.PI / 180;
  function sunVector(hour) {
    var H = (hour - 12) * 15 * Math.PI / 180;
    var sinAlt = Math.sin(DEC) * Math.sin(LAT) + Math.cos(DEC) * Math.cos(LAT) * Math.cos(H);
    sinAlt = Math.max(-1, Math.min(1, sinAlt));
    var alt = Math.asin(sinAlt);
    var cosAz = (Math.sin(DEC) - sinAlt * Math.sin(LAT)) / (Math.cos(alt) * Math.cos(LAT) + 1e-9);
    var az = Math.acos(Math.max(-1, Math.min(1, cosAz)));      // 自北起算
    if (H > 0) az = 2 * Math.PI - az;                           // 午后偏西
    return {
      dir: new T.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)),
      alt: alt, az: az
    };
  }
  function lerpC(a, b, t) { return new T.Color(a).lerp(new T.Color(b), t); }

  var curHour = 9.5, fogScale = 1.0, ambScale = 1.0;
  function applySun() {
    var sv = sunVector(curHour);
    var alt = Math.max(0.0, sv.alt);
    var t = Math.min(1, alt / (55 * Math.PI / 180));            // 0 地平 → 1 高日
    var warm = Math.pow(1 - t, 1.7);

    // r152 为旧式（非物理）光照约定，强度直接参与漫反射，故取较小数值：
    // 受光面总量 ≈ 3.0、背阴面 ≈ 0.75，经 ACES 后明暗比约 1.7:1，接近实景
    sun.position.copy(sv.dir).multiplyScalar(1200);
    sun.target.position.set(0, 0, 0);
    sun.color.copy(lerpC(0xff9038, 0xfff6e6, Math.min(1, t * 1.5)));
    sun.intensity = 0.22 + 2.05 * Math.pow(t, 0.60);

    bounce.position.set(-sv.dir.x * 500, 340, -sv.dir.z * 500);
    bounce.color.copy(lerpC(0x8b7a6a, 0xa9b7c9, t));
    bounce.intensity = (0.06 + 0.15 * t) * ambScale;

    hemi.color.copy(lerpC(0xd8a878, 0xbfd8ee, t));
    hemi.groundColor.copy(lerpC(0x463c30, 0x6f6350, t));
    hemi.intensity = (0.14 + 0.32 * Math.pow(t, 0.5)) * ambScale;
    amb.intensity = (0.04 + 0.075 * t) * ambScale;

    var top = lerpC(0x1b3a6b, 0x2f6ec4, t);
    var mid = lerpC(0xe8ab72, 0xbcd6ea, Math.min(1, t * 1.25));
    var bot = lerpC(0x6b5a48, 0x8f8a7c, t);
    sky.uniforms.uTop.value.copy(top);
    sky.uniforms.uMid.value.copy(mid);
    sky.uniforms.uBot.value.copy(bot);
    sky.uniforms.uSunDir.value.copy(sv.dir);
    sky.uniforms.uSunCol.value.copy(sun.color);
    sky.uniforms.uHaze.value = 0.6 + warm * 1.5;
    sky.uniforms.uExposure.value = expoUser;

    scene.fog.color.copy(mid);
    fogNearBase = 320 / Math.max(0.15, fogScale);
    fogFarBase = 2600 / Math.max(0.15, fogScale);
    scene.fog.near = fogNearBase;
    scene.fog.far = fogFarBase;
    if (!POST.on) renderer.setClearColor(mid);
    // 后期用：日照方向、日色，以及随日高变暖的云影色偏
    postParams.sunDir.copy(sv.dir);
    postParams.sunColor.copy(sun.color);
    POST.cloudTint.setRGB(0.62, 0.66, 0.78).lerp(new T.Color(0.80, 0.63, 0.52), warm);
    shadowDirty = true;
    var hh = Math.floor(curHour), mm = Math.round((curHour - hh) * 60);
    $('#hourV').textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* =============== 自适应静态阴影相机 =============== */
  var shadowDirty = true, lastShadowR = -1, lastShadowC = new T.Vector3(1e9, 0, 0), lastShadowT = 0;
  function updateShadowCam(target, dist, now) {
    var R = Math.max(150, Math.min(1000, dist * 0.95));
    var moved = lastShadowC.distanceTo(target) > R * 0.10;
    var zoomed = Math.abs(R - lastShadowR) / Math.max(1, lastShadowR) > 0.12;
    if (!shadowDirty && !moved && !zoomed) return;
    // 日影推移时太阳每帧都在动，须限频重烘，否则每帧多渲一千万三角面
    if (now - lastShadowT < (autoSunOn ? 90 : 20)) return;
    lastShadowT = now; lastShadowR = R; lastShadowC.copy(target); shadowDirty = false;

    var c = sun.shadow.camera;
    c.left = -R; c.right = R; c.top = R; c.bottom = -R;
    c.near = Math.max(1, 1200 - R - 260);
    c.far = 1200 + R + 500;
    c.updateProjectionMatrix();
    sun.target.position.copy(target);
    sun.position.copy(target).add(sunVector(curHour).dir.multiplyScalar(1200));
    sun.shadow.normalBias = 0.35 + R * 0.0009;
    renderer.shadowMap.needsUpdate = true;
  }

  /* =============== 后期处理与滤镜 =============== */
  var postfx = new G.PostFX(renderer, scene, camera);
  var autoSunOn = false, sunSpeed = 0.42, waterMat = null;
  var fogNearBase = 320, fogFarBase = 2600;
  var expoUser = 1.06, postTested = false;
  var POST = {
    // 初始为 false：装配完成前走"渲染器内 ACES"直出路径，
    // 避免后期链以 1×1 目标渲出首帧、令自检误判
    on: false, filter: 0,
    bloom: 0.55, bloomThreshold: 0.88, rays: 0.30, cloud: 0.42,
    vignette: 0.16, grain: 0.02, aberration: 0.15, fxaa: true,
    tonemap: 1, gradeEx: 1.00, contrast: 1, saturation: 1,
    temperature: 0, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1],
    cloudDrift: new T.Vector2(0, 0), cloudTint: new T.Color(0.62, 0.66, 0.78),
    cloudSpeed: 1.0
  };
  var postParams = {
    time: 0, sunDir: new T.Vector3(0, 1, 0), sunColor: new T.Color(1, 1, 1),
    cloudDrift: POST.cloudDrift, cloudTint: POST.cloudTint,
    bloom: 0, bloomThreshold: 0.88, rays: 0, cloud: 0,
    tonemap: 1, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0,
    lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0, grain: 0, aberration: 0, fxaa: true
  };

  /** 后期开关切换：关闭时完全回到"渲染器内做 ACES + sRGB"的原路径 */
  function setPostEnabled(on) {
    POST.on = !!on && postfx.ok;
    if (POST.on) {
      renderer.toneMapping = T.NoToneMapping;
      renderer.toneMappingExposure = 1;
      sky.uniforms.uPost.value = 1;
      postfx.setSize(renderer.domElement.width, renderer.domElement.height);
    } else {
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = expoUser;
      sky.uniforms.uPost.value = 0;
      sky.uniforms.uExposure.value = expoUser;
    }
  }

  function applyFilter(i) {
    var f = G.PostFX.FILTERS[i];
    if (!f) return;
    POST.filter = i;
    POST.tonemap = f.tm; POST.gradeEx = f.ex; POST.contrast = f.ct; POST.saturation = f.sa;
    POST.temperature = f.tp; POST.tint = f.ti;
    POST.lift = f.lift.slice(); POST.gain = f.gain.slice();
    POST.vignette = f.vig; POST.grain = f.gr; POST.aberration = f.ab;
    POST.bloom = f.bl; POST.bloomThreshold = f.th; POST.rays = f.ry; POST.cloud = f.cl;
    syncPostUI();
  }

  function syncPostUI() {
    var set = function (id, val, txt) {
      var el = $('#' + id); if (el) el.value = val;
      var lv = $('#' + id + 'V'); if (lv) lv.textContent = txt;
    };
    set('bloom', POST.bloom, POST.bloom.toFixed(2));
    set('rays', POST.rays, POST.rays.toFixed(2));
    set('cloud', POST.cloud, POST.cloud.toFixed(2));
    set('vig', POST.vignette, POST.vignette.toFixed(2));
    set('grain', POST.grain, POST.grain.toFixed(2));
    set('aber', POST.aberration, POST.aberration.toFixed(2));
    Array.prototype.forEach.call(document.querySelectorAll('#filters .btn'), function (b, k) {
      b.classList.toggle('on', k === POST.filter);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tonemaps .btn'), function (b, k) {
      b.classList.toggle('on', k === POST.tonemap);
    });
  }

  /* =============== 相机控制 =============== */
  var ctl = {
    target: new T.Vector3(0, 14, -150), dist: 900,
    theta: Math.PI, phi: 1.02,
    sTarget: new T.Vector3(0, 14, -150), sDist: 900, sTheta: Math.PI, sPhi: 1.02
  };
  function applyCam() {
    var sp = Math.sin(ctl.sPhi), cp = Math.cos(ctl.sPhi);
    camera.position.set(
      ctl.sTarget.x + ctl.sDist * sp * Math.sin(ctl.sTheta),
      ctl.sTarget.y + ctl.sDist * cp,
      ctl.sTarget.z + ctl.sDist * sp * Math.cos(ctl.sTheta)
    );
    if (camera.position.y < 2.2) camera.position.y = 2.2;
    camera.lookAt(ctl.sTarget);
  }
  var keys = {};
  addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'KeyF') { $('#panel').classList.toggle('hide'); $('#toggle').classList.toggle('hide'); }
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });

  (function bindPointer() {
    var down = false, btn = 0, lx = 0, ly = 0, pts = {};
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pts).length === 1) { down = true; btn = e.button; lx = e.clientX; ly = e.clientY; }
    });
    canvas.addEventListener('pointerup', function (e) { delete pts[e.pointerId]; if (!Object.keys(pts).length) down = false; });
    canvas.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; down = false; });
    canvas.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {                                   // 双指：缩放 + 平移
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (bindPointer.pd) {
          var k = bindPointer.pd / Math.max(1, d);
          ctl.dist = Math.max(22, Math.min(2600, ctl.dist * k));
        }
        bindPointer.pd = d;
        return;
      }
      bindPointer.pd = 0;
      if (!down) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (btn === 0 && !e.shiftKey) {
        ctl.theta -= dx * 0.0042;
        ctl.phi = Math.max(0.06, Math.min(1.545, ctl.phi - dy * 0.0035));
      } else {
        var s = ctl.dist * 0.0016;
        var rt = new T.Vector3(Math.cos(ctl.theta), 0, -Math.sin(ctl.theta));
        var fw = new T.Vector3(Math.sin(ctl.theta), 0, Math.cos(ctl.theta));
        ctl.target.addScaledVector(rt, -dx * s).addScaledVector(fw, dy * s);
      }
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      ctl.dist = Math.max(22, Math.min(2600, ctl.dist * Math.exp(e.deltaY * 0.0011)));
    }, { passive: false });
  })();

  function stepKeys(dt) {
    var sp = (keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1) * Math.max(14, ctl.dist * 0.5) * dt;
    var rt = new T.Vector3(Math.cos(ctl.theta), 0, -Math.sin(ctl.theta));
    var fw = new T.Vector3(-Math.sin(ctl.theta), 0, -Math.cos(ctl.theta));
    if (keys.KeyW) ctl.target.addScaledVector(fw, sp);
    if (keys.KeyS) ctl.target.addScaledVector(fw, -sp);
    if (keys.KeyA) ctl.target.addScaledVector(rt, -sp);
    if (keys.KeyD) ctl.target.addScaledVector(rt, sp);
    if (keys.KeyQ) ctl.target.y -= sp * 0.7;
    if (keys.KeyE) ctl.target.y += sp * 0.7;
    ctl.target.y = Math.max(-4, Math.min(420, ctl.target.y));
  }

  /* =============== 机位预设 =============== */
  var CAMS = [
    { n: '全城鸟瞰', t: [0, 18, -60], d: 1180, a: 180, p: 58 },
    { n: '中轴纵览', t: [0, 16, -120], d: 700, a: 180, p: 70 },
    { n: '午门五凤楼', t: [0, 16, -496], d: 235, a: 180, p: 80 },
    { n: '内金水桥', t: [0, 8, -368], d: 165, a: 178, p: 83 },
    { n: '太和门', t: [0, 14, -312], d: 175, a: 180, p: 79 },
    { n: '太和殿广场', t: [0, 12, -240], d: 300, a: 180, p: 73 },
    { n: '太和殿正面', t: [0, 22, -112], d: 148, a: 180, p: 81 },
    { n: '三大殿', t: [0, 18, -48], d: 330, a: 168, p: 60 },
    { n: '保和殿丹陛', t: [0, 16, 40], d: 150, a: 8, p: 80 },
    { n: '乾清门', t: [0, 12, 127], d: 175, a: 180, p: 79 },
    { n: '后三宫', t: [0, 14, 226], d: 300, a: 180, p: 66 },
    { n: '御花园', t: [0, 10, 392], d: 205, a: 192, p: 74 },
    { n: '神武门', t: [0, 16, 462], d: 215, a: 6, p: 78 },
    { n: '东南角楼', t: [371, 20, -475], d: 120, a: 138, p: 78 },
    { n: '西北角楼', t: [-371, 20, 475], d: 120, a: 318, p: 78 },
    { n: '东六宫', t: [128, 12, 270], d: 290, a: 205, p: 62 },
    { n: '文华殿区', t: [190, 12, -212], d: 215, a: 196, p: 72 },
    { n: '武英殿区', t: [-190, 12, -240], d: 215, a: 164, p: 72 },
    { n: '宁寿宫区', t: [260, 14, 250], d: 300, a: 200, p: 66 },
    { n: '慈宁宫区', t: [-260, 14, 150], d: 300, a: 160, p: 66 },
    { n: '护城河角', t: [-420, 14, -524], d: 260, a: 140, p: 80 },
    { n: '殿脊走兽', t: [0, 34, -104], d: 52, a: 205, p: 74 }
  ];
  var camIdx = 0;
  function goCam(i, instant) {
    var c = CAMS[i]; camIdx = i;
    ctl.target.set(c.t[0], c.t[1], c.t[2]);
    ctl.dist = c.d;
    ctl.theta = c.a * Math.PI / 180;
    ctl.phi = c.p * Math.PI / 180;
    if (instant) { ctl.sTarget.copy(ctl.target); ctl.sDist = c.d; ctl.sTheta = ctl.theta; ctl.sPhi = ctl.phi; }
    $('#where').textContent = c.n;
    Array.prototype.forEach.call(document.querySelectorAll('#cams .btn'), function (b, k) {
      b.classList.toggle('on', k === i);
    });
    shadowDirty = true;
  }
  function flyTo(x, y, z, d) {
    ctl.target.set(x, y + 6, z);
    ctl.dist = d || 110;
    ctl.phi = 1.30;
    $('#where').textContent = '';
    shadowDirty = true;
  }

  /* =============== 中轴线标示 =============== */
  var axisHelper = new T.Group();
  (function () {
    var m = new T.MeshBasicMaterial({ color: 0xffd873, transparent: true, opacity: 0.55 });
    var g = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 1000), m);
    g.position.set(0, 70, 0);
    axisHelper.add(g);
    for (var z = -480; z <= 480; z += 40) {
      var t = new T.Mesh(new T.BoxGeometry(1, 140, 1),
        new T.MeshBasicMaterial({ color: 0xffd873, transparent: true, opacity: 0.13 }));
      t.position.set(0, 70, z);
      axisHelper.add(t);
    }
    axisHelper.visible = false;
    scene.add(axisHelper);
  })();

  /* =============== 启动流程 =============== */
  var voxMeshes = [], tileMeshes = [], farGround = null, stats = { tri: 0, groups: 0, vox: 0, tiles: 0 };

  async function boot_() {
    setProg(0.04, '正在载入体素引擎…'); await frame();

    setProg(0.08, '正在营建紫禁城（约 110 万方块）…'); await frame();
    var t0 = performance.now();
    var res = G.BuildCity({ log: addLog });
    var rep = res.report;
    addLog('生成 ' + rep.实际方块 + ' 块，可见 ' + rep.可见方块 + ' 块');
    setProg(0.42, '正在生成材质与实例网格…'); await frame();

    var mats = G.MeshKit.createMaterials();
    waterMat = mats[G.GGPalette.BLOCK.WATER];
    farGround = G.MeshKit.buildFarGround();
    scene.add(farGround);

    var tm = G.MeshKit.buildTileMeshes(res.tiles, mats);
    tileMeshes = tm.meshes;
    tileMeshes.forEach(function (m) { scene.add(m); });
    stats.tiles = res.tiles.count;
    setProg(0.5, '正在装配体素实例（分帧）…'); await frame();

    var it = G.MeshKit.voxelMeshIterator(res.voxels, mats, { bucket: 128 });
    while (!it.done) {
      it.step(26);
      setProg(0.5 + 0.46 * it.progress(), '正在装配体素实例… ' + Math.round(it.progress() * 100) + '%');
      await frame();
    }
    var out = it.result();
    voxMeshes = out.meshes;
    voxMeshes.forEach(function (m) { scene.add(m); });
    stats.tri = out.triangles + tm.triangles;
    stats.groups = out.groups + tm.meshes.length;
    stats.vox = res.voxels.count;

    setProg(0.98, '烘焙首帧阴影与后期链…'); await frame();
    buildUI(rep);
    applyFilter(0);
    setPostEnabled(true);
    applySun();
    goCam(0, true);
    renderer.shadowMap.needsUpdate = true;
    setProg(1, '营建告竣');
    await frame();
    boot.style.transition = 'opacity .7s'; boot.style.opacity = '0';
    setTimeout(function () { boot.style.display = 'none'; }, 760);
    console.log('[紫禁城] 校验报告', rep);
  }

  /* =============== UI =============== */
  function buildUI(rep) {
    // 机位
    var cams = $('#cams');
    CAMS.forEach(function (c, i) {
      var b = document.createElement('div');
      b.className = 'btn'; b.textContent = c.n;
      b.onclick = function () { goCam(i); };
      cams.appendChild(b);
    });

    // 校验报告
    var rows = [
      ['总写入次数', rep.总写入, ''],
      ['实际方块数', rep.实际方块, ''],
      ['可见方块数', rep.可见方块, ''],
      ['内部遮挡剔除', rep.内部剔除, ''],
      ['重叠方块', rep.重叠方块, rep.重叠方块 === 0 ? 'ok' : 'bad'],
      ['越界拒绝', rep.越界拒绝, rep.越界拒绝 === 0 ? 'ok' : 'bad'],
      ['非整数坐标', rep.非整数, rep.非整数 === 0 ? 'ok' : 'bad'],
      ['孤立块（已清理）', rep.清理孤立块 || 0, 'ok'],
      ['材质冲突（已仲裁）', rep.材质冲突, 'ok'],
      ['券门挖除', rep.挖除, ''],
      ['铺装/水面板块', rep.铺装.铺装块, ''],
      ['生成耗时', rep.用时.生成毫秒 + ' ms', ''],
      ['编译耗时', rep.用时.编译毫秒 + ' ms', '']
    ];
    var tb = $('#rep');
    tb.innerHTML = rows.map(function (r) {
      return '<tr class="' + r[2] + '"><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
    }).join('');

    // 建成单体清单
    var info = rep.建筑定位 || {};
    var names = Object.keys(info).filter(function (k) { return info[k].n > 40; })
      .sort(function (a, b) { return info[b].n - info[a].n; });
    var list = $('#list');
    list.innerHTML = '';
    names.forEach(function (nm) {
      var d = document.createElement('div');
      d.innerHTML = '<span>' + nm + '</span><span>' + info[nm].n + '</span>';
      d.onclick = function () {
        var i = info[nm];
        var span = Math.sqrt(i.n) * 1.9 + 60;
        flyTo(i.sx / i.n, i.ymax * 0.7, i.sz / i.n, Math.min(520, span));
      };
      list.appendChild(d);
    });
    var head = document.createElement('div');
    head.style.color = '#6f685b';
    head.innerHTML = '<span>共 ' + names.length + ' 项</span><span>方块数</span>';
    list.insertBefore(head, list.firstChild);

    // 控件
    $('#hour').oninput = function () { curHour = parseFloat(this.value); applySun(); };
    $('#expo').oninput = function () {
      expoUser = parseFloat(this.value);
      if (!POST.on) renderer.toneMappingExposure = expoUser;
      sky.uniforms.uExposure.value = expoUser;
      $('#expoV').textContent = expoUser.toFixed(2);
    };
    $('#autoSun').onchange = function () { autoSunOn = this.checked; };
    $('#sunspeed').oninput = function () {
      sunSpeed = parseFloat(this.value);
      $('#sunspeedV').textContent = sunSpeed.toFixed(2) + '×';
    };
    $('#ambi').oninput = function () {
      ambScale = parseFloat(this.value); applySun();
      $('#ambiV').textContent = ambScale.toFixed(2);
    };
    $('#fogv').oninput = function () {
      fogScale = parseFloat(this.value); applySun();
      $('#fogV').textContent = fogScale.toFixed(2);
    };
    $('#shadow').onchange = function () {
      renderer.shadowMap.enabled = this.checked;
      voxMeshes.concat(tileMeshes).forEach(function (m) { m.material.needsUpdate = true; });
      shadowDirty = true;
    };
    $('#showTiles').onchange = function () {
      var s = this.checked;
      tileMeshes.forEach(function (m) { m.visible = s; });
      if (farGround) farGround.visible = s;
      shadowDirty = true;
    };
    $('#showSky').onchange = function () { sky.mesh.visible = this.checked; };
    $('#axis').onchange = function () { axisHelper.visible = this.checked; };
    $('#smap').oninput = function () {
      var i = parseInt(this.value, 10);
      $('#smapV').textContent = SMAP_LBL[i];
      sun.shadow.mapSize.set(SMAP[i], SMAP[i]);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      shadowDirty = true;
    };
    $('#smapV').textContent = SMAP_LBL[1];
    $('#ddist').oninput = function () {
      drawDist = parseFloat(this.value);
      $('#ddistV').textContent = drawDist >= 3000 ? '∞' : drawDist + 'm';
      lodDirty = true; shadowDirty = true;
    };

    /* ---- 后期与滤镜 ---- */
    var fbox = $('#filters');
    G.PostFX.FILTERS.forEach(function (f, i) {
      var b = document.createElement('div');
      b.className = 'btn'; b.textContent = f.n;
      b.onclick = function () { applyFilter(i); };
      fbox.appendChild(b);
    });
    var tbox = $('#tonemaps');
    G.PostFX.TONEMAPS.forEach(function (nm, i) {
      var b = document.createElement('div');
      b.className = 'btn'; b.textContent = nm;
      b.onclick = function () { POST.tonemap = i; syncPostUI(); };
      tbox.appendChild(b);
    });
    $('#post').onchange = function () {
      setPostEnabled(this.checked);
      $('#postNote').textContent = POST.on ? '后期链已开启' : '后期链已关闭（渲染器内 ACES）';
    };
    var bindPost = function (id, key, fmt) {
      var el = $('#' + id); if (!el) return;
      el.oninput = function () {
        POST[key] = parseFloat(this.value);
        var lv = $('#' + id + 'V');
        if (lv) lv.textContent = fmt ? fmt(POST[key]) : POST[key].toFixed(2);
      };
    };
    bindPost('bloom', 'bloom');
    bindPost('rays', 'rays');
    bindPost('cloud', 'cloud');
    bindPost('vig', 'vignette');
    bindPost('grain', 'grain');
    bindPost('aber', 'aberration');
    $('#cspeed').oninput = function () {
      POST.cloudSpeed = parseFloat(this.value);
      $('#cspeedV').textContent = POST.cloudSpeed.toFixed(2) + '×';
    };
    $('#fxaa').onchange = function () { POST.fxaa = this.checked; };
    if (!postfx.canDepth) {
      $('#postNote').textContent = '本机不支持深度纹理，云影已禁用';
      $('#cloud').disabled = true;
    }

    $('#toggle').onclick = function () {
      $('#panel').classList.toggle('hide'); this.classList.toggle('hide');
      this.textContent = $('#panel').classList.contains('hide') ? '‹' : '›';
    };
  }

  /* =============== 主循环 =============== */
  var last = performance.now(), fps = 60, acc = 0, frames = 0;
  var drawDist = 3000, lodDirty = false;
  function applyLOD() {
    var cp = camera.position, i, m, c, d;
    if (drawDist >= 3000) {
      if (!lodDirty) return;
      for (i = 0; i < voxMeshes.length; i++) voxMeshes[i].visible = true;
      lodDirty = false;
      return;
    }
    for (i = 0; i < voxMeshes.length; i++) {
      m = voxMeshes[i]; c = m.boundingSphere.center;
      var dx = c.x - cp.x, dy = c.y - cp.y, dz = c.z - cp.z;
      d = drawDist + m.boundingSphere.radius;
      m.visible = (dx * dx + dy * dy + dz * dz) < d * d;
    }
    lodDirty = true;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var tsec = now * 0.001;

    if (autoSunOn) {
      curHour += dt * sunSpeed;
      if (curHour > 19.5) curHour = 5;
      $('#hour').value = curHour;
      applySun();
    }
    stepKeys(dt);
    var k = 1 - Math.pow(0.0016, dt);
    ctl.sTarget.lerp(ctl.target, k);
    ctl.sDist += (ctl.dist - ctl.sDist) * k;
    ctl.sTheta += (ctl.theta - ctl.sTheta) * k;
    ctl.sPhi += (ctl.phi - ctl.sPhi) * k;
    applyCam();
    sky.mesh.position.copy(camera.position);
    if (farGround) { farGround.position.x = camera.position.x; farGround.position.z = camera.position.z; }
    updateShadowCam(ctl.sTarget, ctl.sDist, now);
    applyLOD();

    /* ---- 动态：云影随风飘移、水面反光微颤、雾气呼吸 ---- */
    POST.cloudDrift.x += dt * 0.0125 * POST.cloudSpeed;
    POST.cloudDrift.y += dt * 0.0047 * POST.cloudSpeed;
    if (waterMat) {
      waterMat.shininess = 130 + 46 * Math.sin(tsec * 0.63);
      var wg = 0.58 + 0.20 * Math.sin(tsec * 0.41 + 1.7);
      waterMat.specular.setRGB(wg * 0.66, wg * 0.82, wg);
    }
    if (scene.fog) {
      var br = 1 + 0.035 * Math.sin(tsec * 0.11);
      scene.fog.near = fogNearBase * br;
      scene.fog.far = fogFarBase * br;
    }

    if (POST.on) {
      postParams.time = tsec;
      postParams.bloom = POST.bloom;
      postParams.bloomThreshold = POST.bloomThreshold;
      postParams.rays = POST.rays;
      postParams.cloud = POST.cloud;
      postParams.tonemap = POST.tonemap;
      postParams.exposure = expoUser * POST.gradeEx;
      postParams.contrast = POST.contrast;
      postParams.saturation = POST.saturation;
      postParams.temperature = POST.temperature;
      postParams.tint = POST.tint;
      postParams.lift = POST.lift;
      postParams.gain = POST.gain;
      postParams.vignette = POST.vignette;
      postParams.grain = POST.grain;
      postParams.aberration = POST.aberration;
      postParams.fxaa = POST.fxaa;
      postfx.render(postParams);
      if (!postTested) {                     // 首帧自检：着色器若未生效则自动回退
        postTested = true;
        if (!postfx.selfTest()) {
          postfx.ok = false;
          setPostEnabled(false);
          var pc = $('#post'); if (pc) pc.checked = false;
          var pn = $('#postNote');
          if (pn) pn.textContent = '后期着色器未能运行，已自动回退到渲染器内 ACES';
          console.warn('[紫禁城] 后期链自检未通过，已回退');
        }
      }
    } else {
      renderer.render(scene, camera);
    }

    acc += dt; frames++;
    if (acc >= 0.5) {
      fps = frames / acc; acc = 0; frames = 0;
      var info = renderer.info.render;
      $('#stat').innerHTML =
        '帧率 <b>' + fps.toFixed(0) + '</b> fps　批次 <b>' + info.calls + '</b><br>' +
        '可见方块 <b>' + stats.vox.toLocaleString() + '</b><br>' +
        '铺装板块 <b>' + stats.tiles.toLocaleString() + '</b>　实例组 <b>' + stats.groups + '</b><br>' +
        '三角面 <b>' + (stats.tri / 1e6).toFixed(2) + '</b> M　后期 <b>' +
        (POST.on ? G.PostFX.FILTERS[POST.filter].n : '关') + '</b>';
    }
  }

  addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (POST.on) postfx.setSize(renderer.domElement.width, renderer.domElement.height);
    shadowDirty = true;
  });

  applySun();
  requestAnimationFrame(loop);
  boot_().catch(function (e) {
    console.error(e);
    bmsg.textContent = '营建失败：' + e.message;
    addLog(String(e.stack || e));
  });
})(typeof window !== 'undefined' ? window : globalThis);
