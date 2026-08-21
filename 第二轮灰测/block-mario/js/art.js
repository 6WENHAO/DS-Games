/* =========================================================
   art.js — 高精度程序化像素美术
   设计要点（本项目的重点）：
     · 每个部件用 box() 画出「顶部高光 + 左侧亮面 + 底/右阴影」的立体色阶
     · 精灵统一做 outline() 描边 + aoShade() 底部环境光遮蔽 + topLight() 顶光
     · 方块用邻居掩码自动拼接（草皮只长在暴露面），并按暴露方向做边缘明暗
     · 全部运行时生成，零图片资源
   ========================================================= */
(function () {
  'use strict';
  var G = (window.G = window.G || {});
  var PX = (G.PX = {});
  var sh = G.shade;

  /* ================= 基础绘制 ================= */
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    var x = c.getContext('2d');
    if (x) x.imageSmoothingEnabled = false;
    return c;
  }
  function r(x, px, py, w, h, col) { x.fillStyle = col; x.fillRect(px, py, w, h); }
  // 立体块：顶部高光 / 左侧亮面 / 底部与右侧阴影
  function box(x, px, py, w, h, base, li, dk) {
    li = li === undefined ? 0.20 : li;
    dk = dk === undefined ? 0.24 : dk;
    r(x, px, py, w, h, base);
    if (h > 1) r(x, px, py, w, 1, sh(base, li));
    if (w > 1) r(x, px, py + 1, 1, h - 1, sh(base, li * 0.55));
    if (h > 2) r(x, px, py + h - 1, w, 1, sh(base, -dk));
    if (w > 2) r(x, px + w - 1, py + 1, 1, h - 2, sh(base, -dk * 0.7));
  }
  function speck(x, px, py, w, h, cols, seed, dens) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var v = G.hash2(px + i, py + j, seed);
      if (v < dens) { x.fillStyle = cols[(v * 997 | 0) % cols.length]; x.fillRect(px + i, py + j, 1, 1); }
    }
  }
  function blob(x, px, py, w, h, col) {
    r(x, px + 1, py, w - 2, h, col);
    r(x, px, py + 1, w, h - 2, col);
  }
  // 竖向渐变（用色带模拟，保持像素风）
  function vgrad(x, px, py, w, h, top, bot, steps) {
    steps = steps || h;
    for (var i = 0; i < steps; i++) {
      var t = i / Math.max(1, steps - 1);
      var y0 = py + Math.round(i * h / steps), y1 = py + Math.round((i + 1) * h / steps);
      x.fillStyle = mixHex(top, bot, t);
      x.fillRect(px, y0, w, Math.max(1, y1 - y0));
    }
  }
  function mixHex(a, b, t) {
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    var r1 = (A >> 16) & 255, g1 = (A >> 8) & 255, b1 = A & 255;
    var r2 = (B >> 16) & 255, g2 = (B >> 8) & 255, b2 = B & 255;
    var out = [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
    return '#' + out.map(function (v) { return ('0' + (v | 0).toString(16)).slice(-2); }).join('');
  }
  PX.mk = mk; PX.rect = r; PX.box = box; PX.mixHex = mixHex;

  /* ================= 后处理（精度与美观的关键） ================= */
  function hexRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 1px 外描边，让精灵在任何背景上都清晰
  function outline(cv, col, alpha) {
    var x = cv.getContext('2d');
    if (!x || !x.getImageData) return cv;
    var w = cv.width, h = cv.height;
    var img = x.getImageData(0, 0, w, h), d = img.data;
    var out = new Uint8ClampedArray(d);
    var c = hexRgb(col || '#141019');
    var a = Math.round(255 * (alpha === undefined ? 1 : alpha));
    for (var y = 0; y < h; y++) {
      for (var i = 0; i < w; i++) {
        var p = (y * w + i) * 4;
        if (d[p + 3] > 24) continue;
        var solid = (i > 0 && d[p - 4 + 3] > 60) || (i < w - 1 && d[p + 4 + 3] > 60) ||
          (y > 0 && d[p - w * 4 + 3] > 60) || (y < h - 1 && d[p + w * 4 + 3] > 60);
        if (solid) { out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = a; }
      }
    }
    img.data.set(out);
    x.putImageData(img, 0, 0);
    return cv;
  }
  // 底部环境光遮蔽：越靠下越暗，立刻有体积感
  function aoShade(cv, strength, fromRatio) {
    var x = cv.getContext('2d');
    if (!x || !x.getImageData) return cv;
    var w = cv.width, h = cv.height;
    var img = x.getImageData(0, 0, w, h), d = img.data;
    strength = strength === undefined ? 0.30 : strength;
    fromRatio = fromRatio === undefined ? 0.45 : fromRatio;
    var from = h * fromRatio;
    for (var y = Math.floor(from); y < h; y++) {
      var t = (y - from) / Math.max(1, h - from);
      var m = 1 - strength * t * t;
      for (var i = 0; i < w; i++) {
        var p = (y * w + i) * 4;
        if (d[p + 3] < 24) continue;
        d[p] *= m; d[p + 1] *= m; d[p + 2] *= m;
      }
    }
    x.putImageData(img, 0, 0);
    return cv;
  }
  // 顶光：最上面若干行提亮
  function topLight(cv, strength, rows) {
    var x = cv.getContext('2d');
    if (!x || !x.getImageData) return cv;
    var w = cv.width, h = cv.height;
    var img = x.getImageData(0, 0, w, h), d = img.data;
    strength = strength === undefined ? 0.16 : strength;
    rows = rows || Math.max(2, Math.round(h * 0.18));
    for (var y = 0; y < Math.min(rows, h); y++) {
      var t = 1 - y / rows;
      for (var i = 0; i < w; i++) {
        var p = (y * w + i) * 4;
        if (d[p + 3] < 24) continue;
        var m = strength * t;
        d[p] += (255 - d[p]) * m; d[p + 1] += (255 - d[p + 1]) * m; d[p + 2] += (255 - d[p + 2]) * m;
      }
    }
    x.putImageData(img, 0, 0);
    return cv;
  }
  function finish(cv, opts) {
    opts = opts || {};
    if (opts.ao !== false) aoShade(cv, opts.ao || 0.28, opts.aoFrom);
    if (opts.top !== false) topLight(cv, opts.top || 0.15);
    if (opts.outline !== false) outline(cv, opts.outlineCol || '#150f1c', opts.outlineA);
    return cv;
  }
  PX.outline = outline; PX.aoShade = aoShade; PX.topLight = topLight;
  PX.flash = function (src, col, alpha) {
    var c = mk(src.width, src.height), x = c.getContext('2d');
    if (!x) return c;
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = alpha === undefined ? 0.75 : alpha;
    r(x, 0, 0, c.width, c.height, col || '#ffffff');
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return c;
  };

  /* ================= 侧视人形骨架 ================= */
  /* 画布 24x36：头 12x12 / 躯干 10x11 / 手臂 4x11 / 腿 5x9 + 靴
     侧视角的关键：四肢主要沿 X 前后摆动，抬腿时腿变短（屈膝）           */
  function humanoid(x, o, p) {
    var bodyY = p.bodyY || 0;
    var hx = 5, hy = 0 + bodyY + (p.headY || 0);
    var bx = 6, by = 12 + bodyY;
    var skinD = sh(o.skin, -0.28), shirtD = sh(o.shirt, -0.32);
    var crouch = p.crouch || 0;

    function leg(dx, lift, pants, boot, front) {
      var lx = bx + (front ? 4 : 1) + dx;
      var ly = 23 + bodyY;
      var len = Math.max(3, 9 - crouch - lift);
      box(x, lx, ly, 5, len, pants, front ? 0.22 : 0.10, front ? 0.24 : 0.16);
      if (front) {
        r(x, lx, ly + 1, 1, len - 2, sh(pants, 0.28));
        r(x, lx + 2, ly + 2, 1, Math.max(1, len - 4), sh(pants, -0.20));
      }
      box(x, lx - 1, ly + len, 6, 3, boot, front ? 0.22 : 0.12, 0.26);
      r(x, lx - 1, ly + len, 6, 1, sh(boot, front ? 0.34 : 0.16));
      r(x, lx - 1, ly + len + 2, 6, 1, '#2b2118');
    }
    function arm(dx, dy, col, front) {
      var ax = bx + (front ? 6 : -1) + dx, ay = by + dy;
      box(x, ax, ay, 4, 9, col, front ? 0.24 : 0.10, front ? 0.24 : 0.16);
      r(x, ax, ay + 7, 4, 3, front ? o.skin : sh(o.skin, -0.32));   // 手
      r(x, ax, ay + 9, 4, 1, front ? skinD : sh(o.skin, -0.45));
    }

    // ---- 后侧肢体（压暗，形成前后层次）----
    arm(p.armB || 0, p.armBY || 0, shirtD, false);
    leg(p.legB || 0, p.legBLift || 0, sh(o.pants, -0.28), sh(o.boot, -0.26), false);

    // ---- 躯干 ----
    box(x, bx, by, 10, 11, o.shirt, 0.22, 0.28);
    r(x, bx + 1, by + 1, 3, 4, sh(o.shirt, 0.32));            // 胸口高光
    r(x, bx + 7, by + 4, 2, 6, sh(o.shirt, -0.24));           // 侧面暗部
    r(x, bx, by + 8, 10, 1, sh(o.shirt, -0.36));              // 下摆
    if (o.belt) { r(x, bx, by + 9, 10, 2, o.belt); r(x, bx, by + 9, 10, 1, sh(o.belt, 0.24)); }

    // ---- 前侧肢体 ----
    leg(p.legF || 0, p.legFLift || 0, o.pants, o.boot, true);
    arm(p.armF || 0, p.armFY || 0, o.shirt, true);

    // ---- 头 ----
    box(x, hx, hy, 12, 12, o.skin, 0.16, 0.22);
    r(x, hx + 1, hy + 1, 4, 3, sh(o.skin, 0.26));             // 额头高光
    r(x, hx + 7, hy + 7, 3, 2, sh(o.skin, 0.16));             // 颊部受光
    // 头发：顶部 + 后脑 + 鬓角
    r(x, hx, hy, 12, 3, o.hair);
    r(x, hx, hy, 12, 1, sh(o.hair, 0.26));
    r(x, hx + 1, hy + 1, 5, 1, sh(o.hair, 0.14));
    r(x, hx, hy + 3, 3, 6, o.hair);
    r(x, hx + 1, hy + 3, 1, 5, sh(o.hair, 0.20));
    r(x, hx, hy + 9, 2, 2, sh(o.hair, -0.20));
    // 眉 + 眼（白眼球 + 虹膜 + 高光）
    r(x, hx + 6, hy + 3, 5, 1, sh(o.skin, -0.44));
    r(x, hx + 6, hy + 4, 5, 3, '#f6f3ea');
    r(x, hx + 8, hy + 4, 2, 3, o.iris);
    r(x, hx + 8, hy + 4, 1, 1, '#ffffff');
    r(x, hx + 10, hy + 4, 1, 3, '#cfc9bc');
    // 鼻 + 嘴
    r(x, hx + 11, hy + 5, 2, 3, o.skin);
    r(x, hx + 12, hy + 5, 1, 3, sh(o.skin, -0.22));
    r(x, hx + 11, hy + 8, 1, 1, skinD);
    r(x, hx + 8, hy + 9, 3, 1, sh(o.skin, -0.46));
    if (o.beard) r(x, hx + 6, hy + 10, 6, 2, o.beard);
  }

  /* ================= 玩家姿态 ================= */
  var STEVE = {
    skin: '#c99a6e', hair: '#4a3122', shirt: '#2fa2b0', pants: '#4a5aa8',
    boot: '#63492f', iris: '#3f6ac0', belt: '#6b5740'
  };
  // 跑步 6 帧：腿前后摆 + 抬腿屈膝 + 手臂反向摆 + 身体起伏
  var RUN = [
    { legF: 3, legFLift: 0, legB: -3, legBLift: 3, armF: -2, armFY: 1, armB: 2, armBY: -1, bodyY: 0 },
    { legF: 1, legFLift: 0, legB: -1, legBLift: 1, armF: -1, armFY: 0, armB: 1, armBY: 0, bodyY: 1 },
    { legF: -2, legFLift: 2, legB: 2, legBLift: 0, armF: 1, armFY: -1, armB: -1, armBY: 1, bodyY: 0 },
    { legF: -3, legFLift: 3, legB: 3, legBLift: 0, armF: 2, armFY: -1, armB: -2, armBY: 1, bodyY: 0 },
    { legF: -1, legFLift: 1, legB: 1, legBLift: 0, armF: 1, armFY: 0, armB: -1, armBY: 0, bodyY: 1 },
    { legF: 2, legFLift: 0, legB: -2, legBLift: 2, armF: -1, armFY: 1, armB: 1, armBY: -1, bodyY: 0 }
  ];
  var POSES = {
    idle: { frames: 2, get: function (f) { return { bodyY: f ? 1 : 0, armF: 0, armB: 0, legF: 1, legB: -1 }; } },
    run: { frames: 6, get: function (f) { return RUN[f % 6]; } },
    jump: { frames: 1, get: function () { return { legF: 2, legFLift: 3, legB: -2, legBLift: 1, armF: 1, armFY: -5, armB: -1, armBY: -4, bodyY: -1 }; } },
    fall: { frames: 1, get: function () { return { legF: -2, legFLift: 1, legB: 2, legBLift: 0, armF: 2, armFY: -3, armB: -2, armBY: -2, bodyY: 0 }; } },
    land: { frames: 1, get: function () { return { legF: 2, legB: -2, armF: -2, armFY: 3, armB: 2, armBY: 3, bodyY: 2, crouch: 3 }; } },
    hurt: { frames: 1, get: function () { return { legF: -3, legB: 3, armF: 3, armFY: -4, armB: -3, armBY: -3, bodyY: 0, headY: 1 }; } },
    cheer: { frames: 2, get: function (f) { return { legF: 1, legB: -1, armF: 0, armFY: -9, armB: 0, armBY: -9, bodyY: f ? -1 : 0 }; } }
  };
  var playerCache = {};
  PX.playerPoses = Object.keys(POSES);
  PX.poseFrames = function (pose) { return POSES[pose] ? POSES[pose].frames : 1; };
  PX.player = function (pose, frame) {
    var P = POSES[pose] || POSES.idle;
    frame = ((frame | 0) % P.frames + P.frames) % P.frames;
    var key = pose + '|' + frame;
    if (playerCache[key]) return playerCache[key];
    var cv = mk(24, 40), x = cv.getContext('2d');
    if (x) { x.save(); x.translate(1, 2); humanoid(x, STEVE, P.get(frame)); x.restore(); }
    finish(cv, { ao: 0.16, aoFrom: 0.62, top: 0.16 });
    playerCache[key] = cv;
    return cv;
  };

  /* ================= 怪物 ================= */
  var MOBS = {
    zombie: {
      w: 24, h: 40, frames: 4,
      draw: function (x, f) {
        var walk = [0, -2, 0, 2][f];
        humanoid(x, {
          skin: '#5b8a45', hair: '#2d3f2a', shirt: '#3b6b8f', pants: '#3a4560',
          boot: '#2f3a4a', iris: '#1d2b1d', belt: '#2b3550'
        }, { legF: walk, legB: -walk, armF: -6, armB: -6, bodyY: f === 1 || f === 3 ? 1 : 0 });
        // 伸出的手（僵尸标志）
        r(x, 15, 12, 4, 3, '#5b8a45');
        r(x, 15, 14, 4, 1, '#3f6630');
      }
    },
    skeleton: {
      w: 24, h: 40, frames: 4,
      draw: function (x, f) {
        var walk = [0, -2, 0, 2][f];
        var bone = '#d9d6c6', boneD = '#a9a695';
        // 腿
        box(x, 7, 23 + walk, 4, 9, boneD, 0.14, 0.2);
        box(x, 11, 23 - walk, 4, 9, bone, 0.16, 0.22);
        box(x, 6, 31 + walk, 5, 3, boneD, 0.1, 0.2);
        box(x, 11, 31 - walk, 5, 3, boneD, 0.1, 0.2);
        // 肋骨躯干
        box(x, 7, 12, 9, 11, bone, 0.18, 0.24);
        for (var i = 0; i < 4; i++) r(x, 8, 14 + i * 2, 7, 1, boneD);
        r(x, 11, 13, 1, 9, sh(bone, -0.28));
        // 手臂（举弓）
        box(x, 5, 13, 4, 10, boneD, 0.12, 0.2);
        box(x, 14, 11, 4, 9, bone, 0.16, 0.22);
        // 弓
        r(x, 18, 9, 2, 14, '#7a5330');
        r(x, 17, 8, 2, 2, '#7a5330'); r(x, 17, 22, 2, 2, '#7a5330');
        r(x, 17, 10, 1, 12, '#e8e2cf');
        // 头骨
        box(x, 5, 0, 12, 12, bone, 0.18, 0.24);
        r(x, 6, 1, 4, 3, sh(bone, 0.22));
        r(x, 7, 5, 3, 4, '#241f1c'); r(x, 11, 5, 3, 4, '#241f1c');
        r(x, 8, 6, 1, 1, '#5a5348'); r(x, 12, 6, 1, 1, '#5a5348');
        r(x, 8, 10, 6, 1, '#2c2622');
        for (var t = 0; t < 3; t++) r(x, 8 + t * 2, 10, 1, 2, boneD);
      }
    },
    creeper: {
      w: 24, h: 36, frames: 4,
      draw: function (x, f) {
        var walk = [0, 1, 0, -1][f];
        var g = '#5aa83e';
        // 四条腿（侧视看到两条）
        box(x, 5, 26 + walk, 6, 8, sh(g, -0.22), 0.12, 0.2);
        box(x, 13, 26 - walk, 6, 8, g, 0.16, 0.24);
        // 身体
        box(x, 5, 12, 14, 15, g, 0.2, 0.26);
        speck(x, 6, 13, 12, 13, [sh(g, 0.16), sh(g, -0.16), sh(g, -0.28)], 3, 0.5);
        // 头
        box(x, 4, 0, 16, 13, g, 0.2, 0.26);
        speck(x, 5, 1, 14, 11, [sh(g, 0.18), sh(g, -0.14)], 7, 0.45);
        // 侧视脸：一只眼 + 嘴
        r(x, 8, 3, 4, 5, '#0d0d0d');
        r(x, 14, 3, 4, 5, '#0d0d0d');
        r(x, 11, 7, 4, 4, '#0d0d0d');
        r(x, 10, 9, 2, 3, '#0d0d0d');
        r(x, 9, 4, 1, 1, '#2f2f2f'); r(x, 15, 4, 1, 1, '#2f2f2f');
      }
    },
    slime: {
      w: 26, h: 22, frames: 4,
      draw: function (x, f) {
        var sq = [0, 2, 3, 1][f];
        var base = 'rgba(104,196,104,0.88)';
        var h = 18 - sq, y = 4 + sq;
        blob(x, 2, y, 22, h, base);
        blob(x, 4, y + 1, 18, Math.max(2, h - 6), 'rgba(140,224,140,0.75)');
        r(x, 5, y + 2, 6, 3, 'rgba(210,255,210,0.65)');            // 高光
        // 内核（史莱姆特征）
        blob(x, 8, y + Math.round(h * 0.35), 10, Math.max(3, Math.round(h * 0.4)), 'rgba(70,150,70,0.55)');
        // 眼睛与嘴
        r(x, 8, y + 5, 3, 3, '#1c3a1c'); r(x, 15, y + 5, 3, 3, '#1c3a1c');
        r(x, 9, y + 5, 1, 1, '#8fe08f'); r(x, 16, y + 5, 1, 1, '#8fe08f');
        r(x, 11, y + 10, 4, 1, '#1c3a1c');
        r(x, 2, y + h - 1, 22, 1, 'rgba(50,110,50,0.7)');
      }
    },
    blaze: {
      w: 26, h: 30, frames: 4,
      draw: function (x, f) {
        var a = f * 0.9;
        for (var i = 0; i < 8; i++) {
          var an = a + i / 8 * Math.PI * 2;
          var rx = 13 + Math.cos(an) * 9 - 1, ry = 15 + Math.sin(an) * 10 - 2;
          box(x, rx, ry, 3, 6, i % 2 ? '#e09a20' : '#f4c542', 0.2, 0.2);
        }
        box(x, 8, 8, 10, 10, '#f4c542', 0.22, 0.26);
        speck(x, 9, 9, 8, 8, ['#ffe066', '#e0a022'], 3, 0.5);
        r(x, 10, 11, 2, 3, '#2b1a10'); r(x, 14, 11, 2, 3, '#2b1a10');
        r(x, 11, 16, 4, 1, '#7a4a10');
        box(x, 9, 18, 8, 6, '#e0a022', 0.18, 0.24);
      }
    }
  };
  var mobCache = {};
  PX.mobNames = Object.keys(MOBS);
  PX.mobFrames = function (n) { return MOBS[n] ? MOBS[n].frames : 1; };
  PX.mob = function (name, frame) {
    var M = MOBS[name] || MOBS.zombie;
    frame = ((frame | 0) % M.frames + M.frames) % M.frames;
    var key = name + '|' + frame;
    if (mobCache[key]) return mobCache[key];
    var cv = mk(M.w + 2, M.h + 4), x = cv.getContext('2d');
    if (x) { x.save(); x.translate(1, 2); M.draw(x, frame); x.restore(); }
    finish(cv, { ao: name === 'slime' ? 0.18 : 0.26, top: 0.14 });
    mobCache[key] = cv;
    return cv;
  };
  PX.mobSize = function (n) { var M = MOBS[n] || MOBS.zombie; return { w: M.w, h: M.h }; };

  /* ================= 方块（16x16，按邻居掩码自动拼接） =================
     mask 位：1=上有方块 2=下有方块 4=左有方块 8=右有方块
     暴露的面会加亮边/暗边与内角遮蔽，让地形立刻有立体感。            */
  var T = 16;
  function edges(x, mask, base) {
    if (!(mask & 1)) {                                    // 暴露顶：亮边 + 细高光
      r(x, 0, 0, T, 1, sh(base, 0.34));
      r(x, 0, 1, T, 1, sh(base, 0.14));
    }
    if (!(mask & 2)) {                                    // 暴露底：压暗
      r(x, 0, T - 2, T, 1, 'rgba(0,0,0,0.16)');
      r(x, 0, T - 1, T, 1, 'rgba(0,0,0,0.30)');
    }
    if (!(mask & 4)) {                                    // 暴露左
      r(x, 0, 0, 1, T, 'rgba(255,255,255,0.10)');
      r(x, 1, 0, 1, T, 'rgba(0,0,0,0.05)');
    }
    if (!(mask & 8)) {                                    // 暴露右
      r(x, T - 1, 0, 1, T, 'rgba(0,0,0,0.22)');
      r(x, T - 2, 0, 1, T, 'rgba(0,0,0,0.08)');
    }
    // 内角遮蔽：被夹在方块之间的角落压暗，块与块之间有缝
    if (mask & 1) r(x, 0, 0, T, 1, 'rgba(0,0,0,0.10)');
    if (mask & 4) r(x, 0, 0, 1, T, 'rgba(0,0,0,0.08)');
  }

  var TILES = {
    grass: {
      solid: true,
      draw: function (x, mask, v) {
        var dirt = '#8a6242';
        r(x, 0, 0, T, T, dirt);
        speck(x, 0, 0, T, T, ['#7b573b', '#9a6f4c', '#6d4c33', '#a37a55'], 41 + v, 0.75);
        if (!(mask & 1)) {                                // 只有暴露面才长草
          var g = '#6aa544';
          r(x, 0, 0, T, 4, g);
          speck(x, 0, 0, T, 4, ['#5c9439', '#78b34f', '#84c25b'], 11 + v, 0.8);
          r(x, 0, 0, T, 1, '#84c25b');
          for (var i = 0; i < T; i++) {                   // 草根参差伸入泥土
            var d = 1 + Math.floor(G.hash2(i, v, 5) * 3);
            r(x, i, 4, 1, d, i % 2 ? '#5c9439' : '#67a041');
          }
          r(x, 0, 3, T, 1, 'rgba(0,0,0,0.10)');
        }
      }
    },
    dirt: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#8a6242');
        speck(x, 0, 0, T, T, ['#7b573b', '#9a6f4c', '#6d4c33', '#a37a55'], 41 + v, 0.8);
        r(x, 3, 6, 3, 2, '#6d4c33'); r(x, 10, 11, 3, 2, '#6d4c33');
      }
    },
    stone: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#8d8d8d');
        speck(x, 0, 0, T, T, ['#7f7f7f', '#9b9b9b', '#747474', '#a5a5a5'], 61 + v, 0.85);
        r(x, 4, 5, 4, 2, '#6f6f6f'); r(x, 9, 10, 4, 2, '#6f6f6f');
      }
    },
    cobble: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#6e6e6e');
        var seed = 71 + v * 13;
        for (var j = 0; j < 4; j++) {
          for (var i = 0; i < 4; i++) {
            var h = G.hash2(i, j, seed);
            if (h < 0.12) continue;
            var px = i * 4 + (h < 0.5 ? 0 : 1), py = j * 4 + (h > 0.7 ? 1 : 0);
            var w = 4 - (h < 0.3 ? 1 : 0), hh = 4 - (h > 0.8 ? 1 : 0);
            box(x, px, py, w, hh, h < 0.45 ? '#9a9a9a' : '#868686', 0.16, 0.22);
          }
        }
        speck(x, 0, 0, T, T, ['#5f5f5f'], seed, 0.12);
      }
    },
    planks: {
      solid: true,
      draw: function (x, mask, v) {
        var w1 = '#9c7b4d';
        r(x, 0, 0, T, T, w1);
        for (var b = 0; b < 4; b++) {
          var y = b * 4;
          r(x, 0, y, T, 1, sh(w1, 0.18));
          r(x, 0, y + 3, T, 1, sh(w1, -0.30));
          speck(x, 0, y + 1, T, 2, [sh(w1, 0.08), sh(w1, -0.12)], 151 + b + v, 0.4);
          r(x, (b % 2) * 8 + 2, y + 1, 1, 2, sh(w1, -0.34));       // 木纹节点
        }
        r(x, 5, 0, 1, T, 'rgba(0,0,0,0.10)'); r(x, 11, 0, 1, T, 'rgba(0,0,0,0.08)');
      }
    },
    log: {
      solid: true,
      draw: function (x, mask, v) {
        var bark = '#6b5230';
        r(x, 0, 0, T, T, bark);
        for (var i = 0; i < T; i += 3) {
          r(x, i, 0, 1, T, sh(bark, -0.24));
          r(x, i + 1, 0, 1, T, sh(bark, 0.12));
        }
        speck(x, 0, 0, T, T, [sh(bark, -0.3), sh(bark, 0.16)], 33 + v, 0.35);
        if (!(mask & 1)) {                                // 顶面年轮
          r(x, 0, 0, T, 6, '#b08a52');
          r(x, 2, 1, 12, 4, '#c49a5c');
          r(x, 5, 2, 6, 2, '#8f6c3c');
          r(x, 7, 2, 2, 2, '#b08a52');
          r(x, 0, 5, T, 1, 'rgba(0,0,0,0.18)');
        }
      }
    },
    leaves: {
      solid: true,
      draw: function (x, mask, v) {
        var g = ['#3f6b23', '#4c7f2b', '#588f33', '#69a33d'];
        for (var j = 0; j < T; j++) {
          for (var i = 0; i < T; i++) {
            var h = G.hash2(i, j, 17 + v * 7);
            if (h < 0.10) continue;                        // 叶隙透光
            r(x, i, j, 1, 1, g[(h * 4) | 0]);
          }
        }
        r(x, 2, 2, 3, 2, '#7cb84a'); r(x, 10, 7, 3, 2, '#7cb84a');
      }
    },
    brick: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#8f4a3a');
        for (var row = 0; row < 4; row++) {
          var off = (row % 2) * 4;
          for (var c = -1; c < 3; c++) {
            var px = off + c * 8;
            box(x, px, row * 4, 7, 3, '#a85a45', 0.14, 0.2);
          }
          r(x, 0, row * 4 + 3, T, 1, '#6f6259');           // 灰缝
        }
        speck(x, 0, 0, T, T, ['#94503c', '#b06a52'], 91 + v, 0.25);
      }
    },
    bonus: {
      solid: true,
      draw: function (x, mask, v, t) {
        var gold = '#c9962f';
        box(x, 0, 0, T, T, gold, 0.26, 0.3);
        r(x, 2, 2, 12, 12, sh(gold, -0.12));
        // 铆钉四角
        [[1, 1], [13, 1], [1, 13], [13, 13]].forEach(function (p) {
          r(x, p[0], p[1], 2, 2, sh(gold, 0.34));
          r(x, p[0], p[1] + 1, 2, 1, sh(gold, -0.2));
        });
        // 中央绿宝石（会随时间轻微闪烁）
        var bright = t ? 0.18 : 0;
        r(x, 6, 4, 4, 8, sh('#2fc46a', bright));
        r(x, 5, 6, 6, 4, sh('#3fd97a', bright));
        r(x, 6, 6, 2, 2, '#c8ffe0');
        r(x, 6, 11, 4, 1, '#1c8f4a');
      }
    },
    used: {
      solid: true,
      draw: function (x, mask, v) {
        var c = '#6b5a44';
        box(x, 0, 0, T, T, c, 0.16, 0.24);
        r(x, 3, 3, 10, 10, sh(c, -0.14));
        speck(x, 3, 3, 10, 10, [sh(c, -0.22), sh(c, 0.08)], 55, 0.3);
      }
    },
    bedrock: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#4a4a52');
        for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) {
          var h = G.hash2(i, j, 3 + v);
          box(x, i * 4, j * 4, 4, 4, h < 0.33 ? '#3a3a42' : (h < 0.66 ? '#565660' : '#2e2e36'), 0.1, 0.18);
        }
      }
    },
    sand: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#dcd0a0');
        speck(x, 0, 0, T, T, ['#d2c493', '#e6dcae', '#c9bb8a'], 83 + v, 0.8);
      }
    },
    netherrack: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#7e3434');
        speck(x, 0, 0, T, T, ['#8e3c3c', '#6b2a2a', '#9c4444', '#5c2020'], 113 + v, 0.9);
        r(x, 4, 3, 2, 3, '#552020'); r(x, 10, 9, 3, 2, '#552020');
      }
    },
    glowstone: {
      solid: true, light: 1,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#c9932f');
        speck(x, 0, 0, T, T, ['#e8b64a', '#ffd76b', '#a8761f'], 7 + v, 0.85);
        r(x, 3, 3, 4, 4, '#ffe98f'); r(x, 9, 8, 4, 4, '#ffe98f');
        r(x, 4, 4, 2, 2, '#fffbe0'); r(x, 10, 9, 2, 2, '#fffbe0');
      }
    },
    soulsand: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#544133');
        speck(x, 0, 0, T, T, ['#463629', '#63503f'], 127 + v, 0.85);
        r(x, 4, 5, 3, 3, '#33261d'); r(x, 10, 9, 3, 3, '#33261d');
        r(x, 5, 6, 1, 1, '#7a6653'); r(x, 11, 10, 1, 1, '#7a6653');
      }
    },
    obsidian: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#1b1226');
        speck(x, 0, 0, T, T, ['#251a35', '#120c1a', '#33234a'], 149 + v, 0.8);
        r(x, 3, 2, 3, 5, '#3d2a5c'); r(x, 10, 8, 3, 4, '#3d2a5c');
        r(x, 3, 2, 1, 3, '#6a4f96');
      }
    },
    endstone: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#dcd9a8');
        speck(x, 0, 0, T, T, ['#cfcb96', '#eae7bd', '#bdb984'], 23 + v, 0.85);
        r(x, 5, 4, 2, 2, '#b3af7a'); r(x, 10, 10, 2, 2, '#b3af7a');
      }
    },
    purpur: {
      solid: true,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#a97ba9');
        speck(x, 0, 0, T, T, ['#9d6d9d', '#b98cb9', '#8c5f8c'], 29 + v, 0.7);
        for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) {
          if ((i + j) % 2) r(x, i * 4 + 1, j * 4 + 1, 2, 2, '#c39cc3');
        }
      }
    },
    // ---- 非实体 / 特殊 ----
    platform: {
      solid: false, oneWay: true,
      draw: function (x, mask, v) {
        var w1 = '#a8834f';
        box(x, 0, 0, T, 5, w1, 0.26, 0.3);
        r(x, 0, 4, T, 1, sh(w1, -0.42));
        r(x, 2, 1, 4, 1, sh(w1, 0.3)); r(x, 9, 2, 4, 1, sh(w1, 0.22));
        r(x, 1, 5, 2, 2, sh(w1, -0.5)); r(x, 13, 5, 2, 2, sh(w1, -0.5));
      }
    },
    ladder: {
      solid: false, climb: true,
      draw: function (x, mask, v) {
        var w1 = '#8a6a3a';
        r(x, 2, 0, 2, T, w1); r(x, 12, 0, 2, T, w1);
        r(x, 2, 0, 1, T, sh(w1, 0.2)); r(x, 12, 0, 1, T, sh(w1, 0.2));
        for (var i = 2; i < T; i += 5) { r(x, 3, i, 10, 2, sh(w1, 0.1)); r(x, 3, i + 1, 10, 1, sh(w1, -0.24)); }
      }
    },
    water: {
      solid: false, liquid: 'water',
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, 'rgba(58,98,196,0.62)');
        r(x, 0, 0, T, 2, 'rgba(120,170,255,0.55)');
        speck(x, 0, 2, T, T - 2, ['rgba(90,140,230,0.5)', 'rgba(40,80,180,0.45)'], 101 + v, 0.4);
        r(x, 2 + v * 3, 5, 5, 1, 'rgba(180,215,255,0.6)');
        r(x, 9 - v * 2, 11, 4, 1, 'rgba(180,215,255,0.45)');
      }
    },
    lava: {
      solid: false, liquid: 'lava', hazard: true, light: 0.8,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#d2551a');
        speck(x, 0, 0, T, T, ['#f08a22', '#ffb43b', '#a83c10'], 23 + v * 31, 0.8);
        r(x, 0, 0, T, 2, '#ffc84b');
        r(x, 3 + v * 4, 4, 4, 3, '#ffe08a');
        r(x, 10 - v * 3, 9, 3, 3, '#ffe08a');
      }
    },
    cactus: {
      solid: true, hazard: true,
      draw: function (x, mask, v) {
        var g = '#3f7a35';
        box(x, 2, 0, 12, T, g, 0.2, 0.26);
        r(x, 4, 0, 2, T, sh(g, 0.18));
        speck(x, 3, 0, 10, T, [sh(g, -0.16), sh(g, 0.1)], 19 + v, 0.35);
        for (var i = 1; i < T; i += 4) {                    // 尖刺
          r(x, 1, i, 2, 1, '#e8e0c0'); r(x, 13, i + 2, 2, 1, '#e8e0c0');
          r(x, 6, i, 1, 1, '#d8d0a8'); r(x, 9, i + 2, 1, 1, '#d8d0a8');
        }
      }
    },
    spike: {
      solid: false, hazard: true,
      draw: function (x, mask, v) {
        var m = '#b9b6c6';
        for (var i = 0; i < 4; i++) {
          var px = i * 4;
          r(x, px + 1, 6, 2, 10, m);
          r(x, px + 1, 4, 2, 2, sh(m, 0.2));
          r(x, px + 2, 3, 1, 3, sh(m, 0.34));
          r(x, px, 12, 4, 4, sh(m, -0.3));
        }
        r(x, 0, 14, T, 2, '#5c5a68');
      }
    },
    portal: {
      solid: false, goal: true, light: 0.9,
      draw: function (x, mask, v) {
        r(x, 0, 0, T, T, '#1b0f2e');
        speck(x, 0, 0, T, T, ['#3a1f66', '#5a2f9a', '#7a3fd0'], 5 + v * 17, 0.7);
        r(x, 4, 3 + v, 8, 2, '#c48aff');
        r(x, 3, 8 - v, 10, 2, '#a05ce0');
        r(x, 6, 12, 4, 2, '#e0b8ff');
        for (var i = 0; i < 6; i++) {
          var h = G.hash2(i, v, 9);
          r(x, (h * 14) | 0, ((h * 331) % 14) | 0, 1, 1, '#ffffff');
        }
      }
    }
  };
  var tileCache = {};
  PX.tileNames = Object.keys(TILES);
  PX.tileDef = function (k) { return TILES[k] || null; };
  PX.tileSize = T;
  PX.tile = function (kind, mask, variant) {
    var D = TILES[kind];
    if (!D) return null;
    mask = mask | 0; variant = (variant | 0) & 3;
    var key = kind + '|' + mask + '|' + variant;
    if (tileCache[key]) return tileCache[key];
    var cv = mk(T, T), x = cv.getContext('2d');
    if (x) {
      D.draw(x, mask, variant, variant);
      if (D.solid) edges(x, mask, kind === 'grass' && !(mask & 1) ? '#6aa544' : '#8a8a8a');
    }
    tileCache[key] = cv;
    return cv;
  };

  /* ================= 道具 ================= */
  var ITEMS = {
    emerald: {
      frames: 4,
      draw: function (x, f) {
        var w = [10, 7, 4, 7][f], off = (12 - w) / 2;
        var g = '#2fc46a';
        r(x, off, 2, w, 12, g);
        r(x, off, 4, w, 8, sh(g, 0.16));
        r(x, off + 1, 3, Math.max(1, w - 6), 3, '#c8ffe0');
        r(x, off, 12, w, 2, sh(g, -0.34));
        r(x, off, 2, w, 1, sh(g, 0.3));
      }
    },
    diamond: {
      frames: 4,
      draw: function (x, f) {
        var w = [10, 7, 4, 7][f], off = (12 - w) / 2;
        var c = '#4fd9d0';
        r(x, off, 3, w, 10, c);
        r(x, off, 5, w, 6, sh(c, 0.2));
        r(x, off + 1, 4, Math.max(1, w - 6), 3, '#dffffb');
        r(x, off, 11, w, 2, sh(c, -0.3));
      }
    },
    apple: {
      frames: 1,
      draw: function (x) {
        var c = '#c8382a';
        blob(x, 1, 3, 12, 11, c);
        r(x, 3, 5, 3, 3, '#f08a7a');
        r(x, 2, 11, 10, 2, sh(c, -0.3));
        r(x, 6, 0, 2, 4, '#6b4a28');
        r(x, 8, 1, 4, 2, '#4f8a3a');
        r(x, 9, 1, 2, 1, '#6fb04f');
      }
    },
    heart: {
      frames: 1,
      draw: function (x) {
        var c = '#e2384a';
        r(x, 1, 3, 5, 4, c); r(x, 8, 3, 5, 4, c);
        r(x, 0, 5, 14, 4, c); r(x, 2, 9, 10, 2, c); r(x, 4, 11, 6, 2, c);
        r(x, 6, 13, 2, 1, c);
        r(x, 2, 4, 3, 2, '#ff8a94'); r(x, 9, 4, 2, 1, '#ff8a94');
        r(x, 3, 11, 8, 1, sh(c, -0.3));
      }
    },
    arrow: {
      frames: 1,
      draw: function (x) {
        r(x, 2, 7, 9, 2, '#8a6a3a');
        r(x, 2, 7, 9, 1, '#a8834f');
        r(x, 10, 5, 4, 6, '#c9c6b4');
        r(x, 11, 6, 2, 4, '#eae7d5');
        r(x, 0, 5, 3, 2, '#e8e4dc'); r(x, 0, 9, 3, 2, '#e8e4dc');
      }
    },
    torch: {
      frames: 2,
      draw: function (x, f) {
        r(x, 6, 6, 3, 10, '#8a6a3a');
        r(x, 6, 6, 1, 10, '#a8834f');
        r(x, 5, 2 - f, 5, 5, '#ffb43b');
        r(x, 6, 1 - f, 3, 4, '#ffe08a');
        r(x, 7, 0 - f, 1, 2, '#fffbe0');
      }
    }
  };
  var itemCache = {};
  PX.itemNames = Object.keys(ITEMS);
  PX.itemFrames = function (n) { return ITEMS[n] ? ITEMS[n].frames : 1; };
  PX.item = function (name, frame) {
    var D = ITEMS[name] || ITEMS.emerald;
    frame = ((frame | 0) % D.frames + D.frames) % D.frames;
    var key = name + '|' + frame;
    if (itemCache[key]) return itemCache[key];
    var cv = mk(16, 18), x = cv.getContext('2d');
    if (x) { x.save(); x.translate(1, 1); D.draw(x, frame); x.restore(); }
    finish(cv, { ao: 0.18, top: 0.18, outlineCol: '#1a1420' });
    itemCache[key] = cv;
    return cv;
  };

  /* ================= 装饰 & 背景 ================= */
  var DECO = {
    cloud_s: { w: 34, h: 16, draw: function (x) { cloud(x, 34, 16); } },
    cloud_m: { w: 52, h: 20, draw: function (x) { cloud(x, 52, 20); } },
    cloud_l: { w: 74, h: 24, draw: function (x) { cloud(x, 74, 24); } },
    tree_small: { w: 46, h: 58, draw: function (x) { tree(x, 46, 58, 0); } },
    tree_big: { w: 62, h: 78, draw: function (x) { tree(x, 62, 78, 1); } },
    bush: {
      w: 26, h: 18, draw: function (x) {
        var g = ['#3f6b23', '#4c7f2b', '#588f33'];
        for (var i = 0; i < 26; i++) {
          var hh = 6 + Math.round(Math.sin(i / 26 * Math.PI) * 10);
          r(x, i, 18 - hh, 1, hh, g[(G.hash2(i, 1, 3) * 3) | 0]);
        }
        r(x, 4, 4, 4, 2, '#7cb84a'); r(x, 15, 6, 3, 2, '#7cb84a');
      }
    },
    flower_red: {
      w: 10, h: 14, draw: function (x) {
        r(x, 4, 6, 1, 8, '#4f8a2e'); r(x, 2, 8, 2, 1, '#5c9c36'); r(x, 6, 10, 2, 1, '#5c9c36');
        r(x, 2, 2, 5, 4, '#c8382c'); r(x, 3, 1, 3, 1, '#e05a4a'); r(x, 3, 3, 3, 2, '#8f1f16');
        r(x, 4, 3, 1, 1, '#ffe066');
      }
    },
    flower_yellow: {
      w: 10, h: 14, draw: function (x) {
        r(x, 4, 6, 1, 8, '#4f8a2e'); r(x, 2, 9, 2, 1, '#5c9c36');
        r(x, 2, 2, 5, 4, '#e8cf3d'); r(x, 3, 1, 3, 1, '#f7e470'); r(x, 4, 3, 1, 2, '#a8801f');
      }
    },
    tuft: {
      w: 12, h: 10, draw: function (x) {
        r(x, 2, 4, 1, 6, '#4f8a2e'); r(x, 5, 1, 1, 9, '#5c9c36'); r(x, 8, 3, 1, 7, '#4f8a2e');
        r(x, 4, 0, 1, 3, '#6cb043'); r(x, 7, 2, 1, 3, '#6cb043');
      }
    },
    stalactite: {
      w: 14, h: 30, draw: function (x) {
        for (var y = 0; y < 30; y++) {
          var w = Math.max(1, Math.round(12 * (1 - y / 30)));
          r(x, 7 - (w >> 1), y, w, 1, y < 4 ? '#9b9b9b' : (y % 5 ? '#7f7f7f' : '#6d6d6d'));
        }
        r(x, 5, 0, 2, 8, '#a5a5a5');
      }
    },
    lamp: {
      w: 16, h: 16, draw: function (x) {
        box(x, 0, 0, 16, 16, '#c9932f', 0.24, 0.3);
        r(x, 3, 3, 10, 10, '#ffd76b');
        r(x, 4, 4, 4, 4, '#fffbe0');
        r(x, 3, 11, 10, 2, '#a8761f');
      }
    },
    flag: {
      w: 30, h: 74, draw: function (x) {
        // 旗杆
        box(x, 2, 0, 4, 74, '#b9b6c6', 0.22, 0.28);
        r(x, 2, 0, 4, 3, '#e8e4dc');
        box(x, 0, 70, 8, 4, '#8a8796', 0.18, 0.26);
        // 旗面（末地传送门色）
        for (var i = 0; i < 22; i++) {
          var hh = 16 - Math.abs(i - 11);
          r(x, 6 + i, 6 + Math.round(Math.sin(i / 4) * 1.5), 1, hh, i % 3 ? '#7a3fd0' : '#8f4ce0');
        }
        r(x, 8, 10, 6, 3, '#e0b8ff');
      }
    },
    sign: {
      w: 26, h: 22, draw: function (x) {
        box(x, 11, 12, 4, 10, '#6b5230', 0.2, 0.26);
        box(x, 0, 0, 26, 13, '#a8834f', 0.24, 0.3);
        r(x, 2, 2, 22, 9, '#8f6c3c');
        r(x, 4, 4, 12, 1, '#5c4426'); r(x, 4, 6, 16, 1, '#5c4426'); r(x, 4, 8, 9, 1, '#5c4426');
      }
    }
  };
  function cloud(x, w, h) {
    var lumps = Math.max(3, Math.round(w / 18));
    for (var i = 0; i < lumps; i++) {
      var cw = Math.round(w / lumps) + 6;
      var cx = Math.round(i * (w - cw) / Math.max(1, lumps - 1));
      var chh = h - 4 - (i % 2) * 3;
      blob(x, cx, h - chh - 2, cw, chh, '#ffffff');
    }
    r(x, 0, h - 4, w, 3, '#d8e4f0');
    r(x, 2, 1, Math.round(w * 0.4), 2, '#ffffff');
  }
  function tree(x, w, h, big) {
    var tw = big ? 10 : 8;
    var tx = Math.round((w - tw) / 2);
    var trunkH = Math.round(h * 0.45);
    var bark = '#6b5230';
    box(x, tx, h - trunkH, tw, trunkH, bark, 0.2, 0.26);
    for (var i = 0; i < tw; i += 3) r(x, tx + i, h - trunkH, 1, trunkH, sh(bark, -0.22));
    r(x, tx - 2, h - 3, tw + 4, 3, sh(bark, -0.3));           // 根部
    // 树冠：多层块状叶簇
    var g = ['#3f6b23', '#4c7f2b', '#588f33', '#69a33d'];
    var cw = w, ch = h - trunkH + 6;
    for (var j = 0; j < ch; j++) {
      var t = j / ch;
      var rowW = Math.round(cw * (0.45 + 0.55 * Math.sin(Math.min(1, t * 1.15) * Math.PI)));
      if (rowW < 4) continue;
      var px = Math.round((cw - rowW) / 2);
      for (var i2 = 0; i2 < rowW; i2++) {
        var hsh = G.hash2(px + i2, j, big ? 7 : 3);
        if (hsh < 0.06) continue;
        r(x, px + i2, j, 1, 1, g[(hsh * 4) | 0]);
      }
    }
    r(x, Math.round(cw * 0.22), 4, Math.round(cw * 0.25), 3, '#7cb84a');
  }
  var decoCache = {};
  PX.decoNames = Object.keys(DECO);
  PX.deco = function (name) {
    if (decoCache[name]) return decoCache[name];
    var D = DECO[name];
    if (!D) return null;
    var cv = mk(D.w + 2, D.h + 2), x = cv.getContext('2d');
    if (x) { x.save(); x.translate(1, 1); D.draw(x); x.restore(); }
    if (name.indexOf('cloud') !== 0) finish(cv, { ao: 0.22, top: 0.12, outlineCol: '#171320', outlineA: 0.85 });
    decoCache[name] = cv;
    return cv;
  };

  /* ---------- 天空与视差层 ---------- */
  var THEME = G.THEMES = {
    plains: { sky: ['#7cc4f0', '#b9e4ff', '#e8f6ff'], far: '#8fb9d8', near: '#6f9a6a', ground: '#4d7a3f', sun: true, tint: null },
    cave: { sky: ['#1a2634', '#26384a', '#33485e'], far: '#33475c', near: '#25344a', ground: '#1c2734', sun: false, tint: 'rgba(8,16,34,0.30)' },
    nether: { sky: ['#4a1010', '#7d2216', '#b8481a'], far: '#6b2018', near: '#471614', ground: '#2f0e0b', sun: false, tint: 'rgba(90,20,8,0.18)' },
    end: { sky: ['#0d0d18', '#171230', '#241a44'], far: '#221c3c', near: '#2c2450', ground: '#1a1430', sun: false, tint: 'rgba(34,18,60,0.24)' }
  };
  var skyCache = {}, layerCache = {};
  PX.sky = function (theme, w, h) {
    var key = theme + '|' + w + 'x' + h;
    if (skyCache[key]) return skyCache[key];
    var C = THEME[theme] || THEME.plains;
    var cv = mk(w, h), x = cv.getContext('2d');
    if (x) {
      vgrad(x, 0, 0, w, Math.round(h * 0.62), C.sky[0], C.sky[1], 14);
      vgrad(x, 0, Math.round(h * 0.62), w, h - Math.round(h * 0.62), C.sky[1], C.sky[2], 10);
      if (C.sun) {
        var sx = Math.round(w * 0.74), sy = Math.round(h * 0.16);
        r(x, sx, sy, 26, 26, '#fff6c8');
        r(x, sx + 2, sy - 2, 22, 30, '#fff6c8');
        r(x, sx - 2, sy + 2, 30, 22, '#fff6c8');
        r(x, sx + 4, sy + 4, 12, 12, '#ffffff');
      }
      if (theme === 'end') {                       // 末地星空
        for (var i = 0; i < 90; i++) {
          var hx = G.hash2(i, 3, 11), hy = G.hash2(i, 7, 13);
          r(x, (hx * w) | 0, (hy * h * 0.8) | 0, hx > 0.8 ? 2 : 1, hx > 0.8 ? 2 : 1, hx > 0.5 ? '#e8e0ff' : '#a89ad0');
        }
      }
      if (theme === 'nether') {                    // 下界灰烬
        for (var k = 0; k < 60; k++) {
          var ax = G.hash2(k, 5, 17), ay = G.hash2(k, 9, 19);
          r(x, (ax * w) | 0, (ay * h) | 0, 2, 2, 'rgba(255,150,60,0.35)');
        }
      }
    }
    skyCache[key] = cv;
    return cv;
  };
  // 视差层：可横向平铺的剪影（0=远山 1=近景）
  PX.layer = function (theme, idx, w, h) {
    var key = theme + '|' + idx + '|' + w + 'x' + h;
    if (layerCache[key]) return layerCache[key];
    var C = THEME[theme] || THEME.plains;
    var cv = mk(w, h), x = cv.getContext('2d');
    var col = idx === 0 ? C.far : C.near;
    if (x) {
      if (theme === 'cave') {
        // 岩层剪影 + 钟乳石
        for (var i = 0; i < w; i++) {
          var hh = Math.round(h * (0.45 + 0.25 * G.vnoise(i / (idx ? 40 : 90), idx * 3, 5)));
          r(x, i, h - hh, 1, hh, col);
        }
        for (var s = 0; s < w / 60; s++) {
          var sx = Math.round(G.hash2(s, idx, 7) * w);
          var sh2 = 20 + Math.round(G.hash2(s, idx, 9) * 30);
          for (var y = 0; y < sh2; y++) {
            var ww = Math.max(1, Math.round(10 * (1 - y / sh2)));
            r(x, sx - (ww >> 1), y, ww, 1, col);
          }
        }
      } else if (theme === 'nether') {
        for (var i2 = 0; i2 < w; i2++) {
          var hh2 = Math.round(h * (0.35 + 0.3 * G.vnoise(i2 / (idx ? 30 : 70), idx * 5, 9)));
          r(x, i2, h - hh2, 1, hh2, col);
        }
        for (var p = 0; p < w / 90; p++) {           // 岩浆瀑布
          var px = Math.round(G.hash2(p, idx, 3) * w);
          r(x, px, Math.round(h * 0.3), 5, h, idx ? 'rgba(210,85,26,0.55)' : 'rgba(150,50,20,0.4)');
        }
      } else if (theme === 'end') {
        for (var q = 0; q < w / 70; q++) {           // 悬浮岛
          var ix = Math.round(G.hash2(q, idx, 5) * w);
          var iy = Math.round(h * (0.3 + G.hash2(q, idx, 11) * 0.4));
          var iw = 40 + Math.round(G.hash2(q, idx, 13) * 60);
          for (var yy = 0; yy < 18; yy++) {
            var ww2 = Math.max(2, Math.round(iw * (1 - yy / 18)));
            r(x, ix + ((iw - ww2) >> 1), iy + yy, ww2, 1, col);
          }
          r(x, ix, iy, iw, 3, idx ? '#3a3060' : '#4a3e78');
        }
      } else {
        // 平原：远山 / 近树林
        if (idx === 0) {
          for (var m = 0; m < w; m++) {
            var mh = Math.round(h * (0.3 + 0.45 * G.vnoise(m / 120, 0, 3)));
            r(x, m, h - mh, 1, mh, col);
            if (mh > h * 0.6) r(x, m, h - mh, 1, 3, '#e8f4ff');   // 雪顶
          }
        } else {
          for (var n2 = 0; n2 < w; n2++) {
            var nh = Math.round(h * (0.35 + 0.3 * G.vnoise(n2 / 26, 5, 7)));
            r(x, n2, h - nh, 1, nh, col);
          }
          r(x, 0, h - 4, w, 4, C.ground);
        }
      }
    }
    layerCache[key] = cv;
    return cv;
  };
})();
