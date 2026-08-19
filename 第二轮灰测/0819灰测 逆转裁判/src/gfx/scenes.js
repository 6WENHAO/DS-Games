/* ============================================================
   scenes.js — 场景管理
   ・3D 背景 / 前景双层渲染（前景层遮挡角色下半身，如法庭台面）
   ・相机预设与平滑插值
   ・角色屏幕槽位（slots）：[中心x, 脚底y, 缩放]，切换相机时插值
   ・静止时对 3D 画面做像素吸附，得到硬边低多边形质感
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P3 = AA.P3, MD = AA.MODELS;
  var SCN = AA.SCENES = {};

  var W = 256, H = 192;
  var bgCtx = U.ctx(W, H);
  var fgCtx = U.ctx(W, H);
  var R = P3.renderer(bgCtx, W, H);
  var cur = null, curName = '';
  var cam = { eye: [0, 130, 200], target: [0, 120, -200], fov: 40, roll: 0, fgZ: 0 };
  var camFrom = null, camTo = null, camT = 0, camDur = 0, camEase = null, camMoving = false;
  var slotsFrom = null, slotsTo = null, slotsNow = null;
  var dirty = true, snapPending = 0, hasFG = false;
  var tint = null;
  var offset = { x: 0, y: 0, z: 0, fov: 0 };

  var BUILDERS = {
    court: MD.courtroom, studio: MD.studio, detention: MD.detention,
    lobby: MD.lobby, office: MD.office
  };
  var built = Object.create(null);

  var MOOD = {
    court: { light: [-0.42, 0.80, -0.42], amb: 0.56, fog: { color: '#232b4a', near: 700, far: 2200, k: .78 }, tint: null, sky: '#2b3358' },
    studio: { light: [-0.30, 0.86, 0.40], amb: 0.42, fog: { color: '#141a2e', near: 260, far: 900, k: .85 }, tint: 'rgba(28,44,104,.14)', sky: '#161c34' },
    detention: { light: [-0.16, 0.94, 0.28], amb: 0.50, fog: { color: '#1c2028', near: 240, far: 700, k: .7 }, tint: 'rgba(90,100,120,.07)', sky: '#22252e' },
    lobby: { light: [-0.34, 0.78, 0.52], amb: 0.60, fog: { color: '#3a4258', near: 380, far: 1100, k: .55 }, tint: null, sky: '#4a5470' },
    office: { light: [-0.40, 0.82, 0.42], amb: 0.56, fog: { color: '#2e2a26', near: 280, far: 850, k: .6 }, tint: 'rgba(126,92,48,.08)', sky: '#3a3430' }
  };
  var sky = '#2b3358';

  SCN.load = function (name, camName) {
    if (!built[name]) built[name] = BUILDERS[name]();
    cur = built[name]; curName = name;
    var mood = MOOD[name] || MOOD.court;
    R.light = P3.norm(mood.light);
    R.ambient = mood.amb;
    R.fog = mood.fog;
    tint = mood.tint; sky = mood.sky;
    SCN.setCam(camName || Object.keys(cur.cams)[0]);
    return cur;
  };
  SCN.name = function () { return curName; };
  SCN.scene = function () { return cur; };
  SCN.camName = function () { return SCN._camName; };
  SCN.hasCam = function (n) { return !!(cur && cur.cams[n]); };
  SCN.talkCam = function () { return cur && cur.talkCam; };

  function copySlots(s) {
    var o = Object.create(null);
    for (var k in s) o[k] = s[k].slice();
    return o;
  }
  function applyCam(c) {
    cam.eye = c.eye.slice(); cam.target = c.target.slice();
    cam.fov = c.fov || 40; cam.roll = c.roll || 0; cam.fgZ = c.fgZ || 0;
    slotsNow = copySlots(c.slots || {});
    dirty = true;
  }

  SCN.setCam = function (n) {
    if (!cur) return;
    var c = cur.cams[n];
    if (!c) return;
    SCN._camName = n;
    camMoving = false; camFrom = camTo = null;
    applyCam(c);
    snapPending = 2;
  };

  SCN.moveTo = function (n, dur, ease) {
    if (!cur || !cur.cams[n]) return 0;
    if (!dur) { SCN.setCam(n); return 0; }
    var t = cur.cams[n];
    camFrom = { eye: cam.eye.slice(), target: cam.target.slice(), fov: cam.fov, roll: cam.roll, fgZ: cam.fgZ };
    slotsFrom = copySlots(slotsNow || {});
    camTo = { eye: t.eye.slice(), target: t.target.slice(), fov: t.fov || 40, roll: t.roll || 0, fgZ: t.fgZ || 0 };
    slotsTo = copySlots(t.slots || {});
    SCN._camName = n;
    camT = 0; camDur = dur; camEase = ease || U.ease.inOutCubic; camMoving = true;
    return dur;
  };
  SCN.camMoving = function () { return camMoving; };

  SCN.nudge = function (dx, dy, dz, dfov) {
    offset.x = dx || 0; offset.y = dy || 0; offset.z = dz || 0; offset.fov = dfov || 0;
    dirty = true;
  };

  SCN.update = function (dt) {
    if (!camMoving) return;
    camT += dt;
    var t = U.sat(camT / camDur), e = camEase(t);
    function L(a, b) { return [U.lerp(a[0], b[0], e), U.lerp(a[1], b[1], e), U.lerp(a[2], b[2], e)]; }
    cam.eye = L(camFrom.eye, camTo.eye);
    cam.target = L(camFrom.target, camTo.target);
    cam.fov = U.lerp(camFrom.fov, camTo.fov, e);
    cam.roll = U.lerp(camFrom.roll, camTo.roll, e);
    cam.fgZ = U.lerp(camFrom.fgZ, camTo.fgZ, e);
    // 槽位插值：两端都有的取插值；只有一端的做淡入淡出（缩放趋 0）
    var out = Object.create(null), k;
    for (k in slotsTo) {
      var a = slotsFrom[k], b = slotsTo[k];
      if (a) out[k] = [U.lerp(a[0], b[0], e), U.lerp(a[1], b[1], e), U.lerp(a[2], b[2], e)];
      else out[k] = [b[0], b[1], b[2] * e];
    }
    slotsNow = out;
    dirty = true;
    if (t >= 1) { camMoving = false; snapPending = 2; slotsNow = copySlots(camTo === null ? {} : (cur.cams[SCN._camName].slots || {})); }
  };

  /* ---------------- 渲染 ---------------- */
  function renderBG() {
    if (!cur) return;
    R.ctx = bgCtx;
    R.setCamera({
      eye: [cam.eye[0] + offset.x, cam.eye[1] + offset.y, cam.eye[2] + offset.z],
      target: cam.target, fov: cam.fov + offset.fov, roll: cam.roll
    });
    bgCtx.setTransform(1, 0, 0, 1, 0, 0);
    var g = bgCtx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, U.shade(sky, .10)); g.addColorStop(1, U.shade(sky, -.34));
    bgCtx.fillStyle = g; bgCtx.fillRect(0, 0, W, H);

    R.begin();
    R.mesh(cur.mesh, null);
    var all = R.list;
    hasFG = false;
    if (cam.fgZ > 0) {
      // 只有显式标记为「遮挡物」(occl) 且位于角色之前的面才进前景层，
      // 避免近处地板等大面积几何整屏盖住角色
      var near = [], far = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].f.occl && all[i].z < cam.fgZ) near.push(all[i]); else far.push(all[i]);
      }
      hasFG = near.length > 0;
      R.list = far; R.end();
      if (tint) { bgCtx.fillStyle = tint; bgCtx.fillRect(0, 0, W, H); }
      if (hasFG) {
        fgCtx.setTransform(1, 0, 0, 1, 0, 0);
        fgCtx.clearRect(0, 0, W, H);
        R.ctx = fgCtx; R.list = near; R.end();
        if (tint) {
          fgCtx.save(); fgCtx.globalCompositeOperation = 'source-atop';
          fgCtx.fillStyle = tint; fgCtx.fillRect(0, 0, W, H); fgCtx.restore();
        }
        R.ctx = bgCtx;
      }
    } else {
      R.end();
      if (tint) { bgCtx.fillStyle = tint; bgCtx.fillRect(0, 0, W, H); }
    }

    if (snapPending > 0) {
      var pal = R.palette();
      pal.push(U.hex2rgb(U.shade(sky, .10)), U.hex2rgb(U.shade(sky, -.34)), U.hex2rgb(sky));
      for (var q = 1; q < 6; q++) pal.push(U.hex2rgb(U.mix(U.shade(sky, .10), U.shade(sky, -.34), q / 6)));
      PX.snap(bgCtx, pal, { alphaThreshold: 1 });
      if (hasFG) PX.snap(fgCtx, pal, { alphaThreshold: 90 });
      snapPending--;
    }
    dirty = false;
  }

  SCN.ensure = function () { if (dirty) renderBG(); };
  SCN.bg = function () { SCN.ensure(); return bgCtx.canvas; };
  SCN.fg = function () { SCN.ensure(); return hasFG ? fgCtx.canvas : null; };
  SCN.renderer = function () { return R; };

  /** 角色槽位（屏幕空间） */
  SCN.slot = function (who) {
    if (!slotsNow) return null;
    var s = slotsNow[who] || slotsNow.talk;
    if (!s) return null;
    return { x: s[0], y: s[1], s: s[2] };
  };
  SCN.slots = function () { return slotsNow; };
  SCN.hasSlot = function (who) { return !!(slotsNow && slotsNow[who]); };

  /** 3D 锚点 → 屏幕（特效定位用） */
  SCN.project = function (p) { SCN.ensure(); return R.project(p); };
  SCN.anchorScreen = function (name, dy) {
    if (!cur) return null;
    var a = cur.anchors[name];
    if (!a) return null;
    return SCN.project([a[0], a[1] + (dy || 0), a[2]]);
  };

  SCN.reset = function () { built = Object.create(null); dirty = true; };

})(window.AA);
