/* ============================================================
   screen.js — 双屏管理 / 机身外壳绘制 / 布局 / 指针映射
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, FL = AA.FILTER, IN = AA.INPUT;
  var SC = AA.SCREEN = {};

  var SW = 256, SH = 192;
  SC.W = SW; SC.H = SH;

  var devEl, shellCv, shellCtx, glCv, atlas, atlasCtx;
  var topCtx, botCtx;
  var dpr = 1, scale = 3, layoutMode = 'auto', resolved = 'vertical';
  var devW = 288, devH = 442;
  var unitRects = [];
  var shellDirty = true;
  var shellSkin = 'lite';

  SC.buttons = [];   // 机身按键（shell 模式）
  var btnDown = Object.create(null);

  /* ---------------- 布局定义 ---------------- */
  function layoutVertical() {
    var m = 15, gap = 24;
    devW = SW + m * 2;
    devH = m + SH + gap + SH + m;
    unitRects = [{ x: m, y: m, w: SW, h: SH }, { x: m, y: m + SH + gap, w: SW, h: SH }];
    SC.buttons = [];
  }
  function layoutSide() {
    var m = 15, gap = 24;
    devW = m + SW + gap + SW + m;
    devH = m + SH + m;
    unitRects = [{ x: m, y: m, w: SW, h: SH }, { x: m + SW + gap, y: m, w: SW, h: SH }];
    SC.buttons = [];
  }
  function layoutShell() {
    // 风格化掌机（比例参考 DS Lite，侧边略收窄以适应屏幕）
    var side = 78, topPad = 30, botPad = 56, hinge = 17;
    devW = SW + side * 2;
    var half = topPad + SH + botPad;
    devH = half * 2 + hinge;
    unitRects = [
      { x: side, y: topPad, w: SW, h: SH },
      { x: side, y: half + hinge + topPad, w: SW, h: SH }
    ];
    var by = half + hinge;           // 下半机身起点
    var cy = by + topPad + SH / 2;   // 下屏中心
    SC.buttons = [
      { id: 'dpad', x: side / 2 - 1, y: cy - 6, r: 30 },
      { id: 'A', x: devW - side / 2 + 17, y: cy - 4, r: 11.5, label: 'A' },
      { id: 'B', x: devW - side / 2 - 1, y: cy + 13, r: 11.5, label: 'B' },
      { id: 'Y', x: devW - side / 2 - 19, y: cy - 4, r: 11.5, label: 'Y' },
      { id: 'X', x: devW - side / 2 - 1, y: cy - 21, r: 11.5, label: 'X' },
      { id: 'START', x: devW - side / 2 + 6, y: by + half - 34, w: 26, h: 8, label: 'START' },
      { id: 'SELECT', x: side / 2 + 2, y: by + half - 34, w: 26, h: 8, label: 'SELECT' }
    ];
  }

  function applyLayout() {
    resolved = layoutMode;
    if (layoutMode === 'auto') {
      var ar = window.innerWidth / Math.max(1, window.innerHeight - 110);
      resolved = ar >= 1.5 ? 'side' : 'vertical';
    }
    if (resolved === 'side') layoutSide();
    else if (resolved === 'shell') layoutShell();
    else layoutVertical();
  }

  /* ---------------- 初始化 ---------------- */
  SC.init = function (opts) {
    devEl = opts.device; shellCv = opts.shell; glCv = opts.screens;
    shellCtx = shellCv.getContext('2d');
    atlas = U.canvas(SW, SH * 2);
    atlasCtx = atlas.getContext('2d');
    atlasCtx.imageSmoothingEnabled = false;

    var t = U.canvas(SW, SH), b = U.canvas(SW, SH);
    topCtx = t.getContext('2d'); botCtx = b.getContext('2d');
    U.crisp(topCtx); U.crisp(botCtx);
    SC.top = topCtx; SC.bot = botCtx;
    SC.topCv = t; SC.botCv = b;

    FL.init(glCv);

    IN.setMapper(function (px, py) {
      var ux = px * devW, uy = py * devH;
      for (var i = 0; i < unitRects.length; i++) {
        var r = unitRects[i];
        if (ux >= r.x && ux < r.x + r.w && uy >= r.y && uy < r.y + r.h) {
          return { x: Math.floor(ux - r.x), y: Math.floor(uy - r.y), scr: i };
        }
      }
      return { x: Math.floor(ux), y: Math.floor(uy), scr: -1, unit: true };
    });
    IN.attach(devEl);

    // 机身按键 → 输入
    devEl.addEventListener('pointerdown', function (e) {
      var hit = shellHit(e);
      if (hit) {
        btnDown[hit.id] = true; shellDirty = true;
        pressButton(hit);
      }
    });
    window.addEventListener('pointerup', function () {
      for (var k in btnDown) if (btnDown[k]) { btnDown[k] = false; shellDirty = true; }
    });

    SC.resize();
    window.addEventListener('resize', function () { SC.resize(); });
    return SC;
  };

  function shellHit(e) {
    if (resolved !== 'shell') return null;
    var r = devEl.getBoundingClientRect();
    var ux = (e.clientX - r.left) / r.width * devW;
    var uy = (e.clientY - r.top) / r.height * devH;
    for (var i = 0; i < SC.buttons.length; i++) {
      var b = SC.buttons[i];
      if (b.id === 'dpad') {
        var dx = ux - b.x, dy = uy - b.y;
        if (Math.abs(dx) < b.r && Math.abs(dy) < b.r && (Math.abs(dx) < b.r * .42 || Math.abs(dy) < b.r * .42)) {
          var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          return { id: 'dpad', dir: dir };
        }
      } else if (b.r) {
        if (Math.hypot(ux - b.x, uy - b.y) < b.r) return b;
      } else {
        if (Math.abs(ux - b.x) < b.w / 2 && Math.abs(uy - b.y) < b.h / 2 + 3) return b;
      }
    }
    return null;
  }
  function pressButton(b) {
    var map = { A: 'confirm', B: 'cancel', X: 'record', Y: 'objection', START: 'pause', SELECT: 'log' };
    if (b.id === 'dpad') IN.injectKey(b.dir);
    else if (map[b.id]) IN.injectKey(map[b.id]);
  }

  /* ---------------- 尺寸 ---------------- */
  SC.resize = function () {
    applyLayout();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var availW = Math.max(200, window.innerWidth - 24);
    var availH = Math.max(200, window.innerHeight - (window.innerHeight < 700 ? 74 : 108));
    var maxS = Math.min(availW / devW, availH / devH);
    var s;
    if (SC.forcedScale) s = SC.forcedScale;
    else if (resolved === 'shell') s = Math.max(0.8, Math.floor(maxS * 20) / 20);
    else s = Math.max(1, Math.floor(maxS * 2) / 2);
    if (s > 6) s = 6;
    scale = s;

    var cw = Math.round(devW * s), ch = Math.round(devH * s);
    devEl.style.width = cw + 'px'; devEl.style.height = ch + 'px';
    shellCv.style.width = cw + 'px'; shellCv.style.height = ch + 'px';
    shellCv.width = Math.round(cw * dpr); shellCv.height = Math.round(ch * dpr);
    glCv.style.width = cw + 'px'; glCv.style.height = ch + 'px';
    glCv.width = Math.round(cw * dpr); glCv.height = Math.round(ch * dpr);
    shellDirty = true;
    SC.scale = s; SC.devW = devW; SC.devH = devH; SC.layoutName = resolved;
  };

  SC.setLayout = function (m) { layoutMode = m; SC.forcedScale = 0; SC.resize(); };
  SC.cycleLayout = function () {
    var order = ['vertical', 'side', 'shell'];
    var i = order.indexOf(resolved);
    SC.setLayout(order[(i + 1) % order.length]);
    return resolved;
  };
  SC.cycleScale = function () {
    var opts = resolved === 'shell' ? [0, 1, 1.5, 2] : [0, 1, 2, 3, 4];
    var cur = SC.forcedScale || 0;
    var i = opts.indexOf(cur);
    SC.forcedScale = opts[(i + 1) % opts.length];
    SC.resize();
    return SC.forcedScale || 'auto';
  };
  SC.layout = function () { return resolved; };
  SC.setSkin = function (s) { shellSkin = s; shellDirty = true; };

  /* ---------------- 合成输出 ---------------- */
  SC.present = function (time) {
    atlasCtx.drawImage(SC.topCv, 0, 0);
    atlasCtx.drawImage(SC.botCv, 0, SH);
    var rects = [];
    for (var i = 0; i < unitRects.length; i++) {
      var r = unitRects[i];
      rects.push({ x: r.x * scale * dpr, y: r.y * scale * dpr, w: r.w * scale * dpr, h: r.h * scale * dpr });
    }
    if (shellDirty) { drawShell(); shellDirty = false; }
    if (FL.available()) FL.render(atlas, rects, glCv.width, glCv.height, time, scale * dpr);
    else {
      var c2 = glCv.getContext('2d');
      c2.clearRect(0, 0, glCv.width, glCv.height);
      FL.fallback(c2, atlas, rects, scale * dpr);
    }
  };
  SC.markShellDirty = function () { shellDirty = true; };

  /* ============================================================
     机身外壳绘制
     ============================================================ */
  var SKIN = {
    lite: { body1: '#f4f6fa', body2: '#c8ccd8', body3: '#9aa0b0', edge: '#7d8290', text: '#8a90a0' },
    onyx: { body1: '#3a3f4d', body2: '#22262f', body3: '#14171d', edge: '#0b0d11', text: '#6d7385' },
    crimson: { body1: '#6e1d28', body2: '#4a1119', body3: '#2c0a0f', edge: '#180508', text: '#b07d84' }
  };

  function drawShell() {
    var ctx = shellCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, shellCv.width, shellCv.height);
    ctx.scale(scale * dpr, scale * dpr);
    ctx.imageSmoothingEnabled = true;
    if (resolved === 'shell') drawHandheld(ctx);
    else drawBezel(ctx);
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 简约边框（vertical / side） ---------- */
  function drawBezel(ctx) {
    var g = ctx.createLinearGradient(0, 0, devW * .3, devH);
    g.addColorStop(0, '#2b3450'); g.addColorStop(.42, '#141a2c'); g.addColorStop(1, '#0a0d16');
    rrect(ctx, 0, 0, devW, devH, 13); ctx.fillStyle = g; ctx.fill();

    // 外框细线
    ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(232,196,106,.32)';
    rrect(ctx, .5, .5, devW - 1, devH - 1, 12.6); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,.10)';
    rrect(ctx, 2, 2, devW - 4, devH - 4, 11); ctx.stroke();

    // 顶部高光
    var hg = ctx.createLinearGradient(0, 0, 0, 16);
    hg.addColorStop(0, 'rgba(255,255,255,.10)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    rrect(ctx, 1, 1, devW - 2, 18, 12); ctx.fillStyle = hg; ctx.fill();

    for (var i = 0; i < unitRects.length; i++) {
      var r = unitRects[i];
      // 屏幕外的黑色内嵌框
      rrect(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, 4);
      ctx.fillStyle = '#05060a'; ctx.fill();
      ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.stroke();
      // 内侧一圈微光
      ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(150,175,230,.22)';
      rrect(ctx, r.x - 1.2, r.y - 1.2, r.w + 2.4, r.h + 2.4, 1.6); ctx.stroke();
      // 屏幕底色（滤镜留出的透明处能看到）
      ctx.fillStyle = '#01020a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // 中间的“铰链”装饰点
    if (resolved === 'vertical') {
      var cy = (unitRects[0].y + unitRects[0].h + unitRects[1].y) / 2;
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      for (var d = 0; d < 3; d++) ctx.fillRect(devW / 2 - 9 + d * 8, cy - 1, 3, 2);
      ctx.fillStyle = 'rgba(232,196,106,.30)';
      ctx.fillRect(20, cy - .5, devW - 40, 1);
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(20, cy + .5, devW - 40, 1);
      // 侧边小字
      ctx.save();
      ctx.fillStyle = 'rgba(200,215,255,.30)';
      ctx.font = '600 4.2px "Segoe UI",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DUAL SCREEN', 17, cy + 4.6);
      ctx.textAlign = 'right';
      ctx.fillText('15BIT LCD', devW - 17, cy + 4.6);
      ctx.restore();
    } else {
      var cx = (unitRects[0].x + unitRects[0].w + unitRects[1].x) / 2;
      ctx.fillStyle = 'rgba(232,196,106,.26)';
      ctx.fillRect(cx - .5, 18, 1, devH - 36);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      for (var d2 = 0; d2 < 3; d2++) ctx.fillRect(cx - 1, devH / 2 - 9 + d2 * 8, 2, 3);
    }
    // 电源灯
    ctx.beginPath(); ctx.arc(devW - 9, devH - 9, 1.5, 0, 6.3);
    ctx.fillStyle = '#7fe0ff'; ctx.fill();
    ctx.beginPath(); ctx.arc(devW - 9, devH - 9, 3.6, 0, 6.3);
    ctx.fillStyle = 'rgba(127,224,255,.20)'; ctx.fill();
  }

  /* ---------- 掌机外壳 ---------- */
  function drawHandheld(ctx) {
    var sk = SKIN[shellSkin] || SKIN.lite;
    var half = (devH - 17) / 2, hinge = 17;
    var by = half + hinge;

    function bodyFill(x, y, w, h, r) {
      var g = ctx.createLinearGradient(x, y, x + w * .35, y + h);
      g.addColorStop(0, sk.body1); g.addColorStop(.45, sk.body2); g.addColorStop(1, sk.body3);
      rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = sk.edge; ctx.stroke();
      // 内侧高光
      var hg = ctx.createLinearGradient(x, y, x, y + 10);
      hg.addColorStop(0, 'rgba(255,255,255,.42)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      rrect(ctx, x + 1.5, y + 1.2, w - 3, 12, r * .8); ctx.fillStyle = hg; ctx.fill();
    }

    // 阴影
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
    bodyFill(0, 0, devW, half + 3, 11);          // 上半
    bodyFill(0, by - 3, devW, half + 3, 11);     // 下半
    ctx.restore();

    // 铰链
    var hg2 = ctx.createLinearGradient(0, half, 0, by);
    hg2.addColorStop(0, sk.body3); hg2.addColorStop(.5, sk.body2); hg2.addColorStop(1, sk.body3);
    ctx.fillStyle = hg2;
    ctx.fillRect(devW * .30, half, devW * .40, hinge);
    ctx.fillStyle = 'rgba(0,0,0,.30)';
    ctx.fillRect(devW * .30, half, devW * .40, 1.4);
    ctx.fillRect(devW * .30, by - 1.4, devW * .40, 1.4);
    // 铰链圆柱
    for (var s = 0; s < 2; s++) {
      var hx = s ? devW * .70 : devW * .30 - 20;
      var g3 = ctx.createLinearGradient(0, half, 0, by);
      g3.addColorStop(0, sk.body2); g3.addColorStop(.4, sk.body1); g3.addColorStop(1, sk.body3);
      rrect(ctx, hx, half + .5, 20, hinge - 1, 4.5); ctx.fillStyle = g3; ctx.fill();
      ctx.lineWidth = .6; ctx.strokeStyle = sk.edge; ctx.stroke();
    }

    // 屏幕黑框
    for (var i = 0; i < unitRects.length; i++) {
      var r = unitRects[i];
      var pad = 9;
      rrect(ctx, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 4.5);
      var bg = ctx.createLinearGradient(r.x, r.y - pad, r.x, r.y + r.h + pad);
      bg.addColorStop(0, '#2a2c33'); bg.addColorStop(.06, '#0b0c10'); bg.addColorStop(1, '#05060a');
      ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.fillStyle = '#01020a'; ctx.fillRect(r.x, r.y, r.w, r.h);
      // 屏边细高光
      ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(160,180,220,.18)';
      rrect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 1.2); ctx.stroke();
    }

    // 上半：扬声器孔
    var topR = unitRects[0];
    function grille(cx, cy) {
      ctx.fillStyle = 'rgba(0,0,0,.30)';
      for (var yy = 0; yy < 6; yy++) for (var xx = 0; xx < 4; xx++) {
        var ox = (yy % 2) * 1.6;
        ctx.beginPath();
        ctx.arc(cx + xx * 3.2 + ox, cy + yy * 3.2, .78, 0, 6.3);
        ctx.fill();
      }
    }
    grille(topR.x - 62, topR.y + 46);
    grille(topR.x + topR.w + 42, topR.y + 46);

    // 上半 logo
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = sk.text;
    ctx.font = '700 6.6px "Segoe UI",sans-serif';
    ctx.fillText('GYAKUTEN  PORTABLE', devW / 2, topR.y + topR.h + 22);
    ctx.font = '600 4px "Segoe UI",sans-serif';
    ctx.fillStyle = 'rgba(128,136,152,.85)';
    ctx.fillText('D U A L   S C R E E N   S Y S T E M', devW / 2, topR.y + topR.h + 30);
    ctx.restore();

    // 下半：按键
    var botR = unitRects[1];
    for (var bi = 0; bi < SC.buttons.length; bi++) drawButton(ctx, SC.buttons[bi], sk);

    // 麦克风孔
    ctx.beginPath(); ctx.arc(devW / 2, botR.y + botR.h + 14, 1.5, 0, 6.3);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    // 电源灯
    ctx.beginPath(); ctx.arc(18, botR.y - 16, 1.7, 0, 6.3);
    ctx.fillStyle = '#8ef0ff'; ctx.fill();
    ctx.beginPath(); ctx.arc(18, botR.y - 16, 4.4, 0, 6.3);
    ctx.fillStyle = 'rgba(142,240,255,.22)'; ctx.fill();
    ctx.fillStyle = sk.text; ctx.font = '600 3.4px "Segoe UI",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('POWER', 24, botR.y - 14.6);
    // 触摸笔槽
    rrect(ctx, devW - 46, devH - 7, 40, 3, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
  }

  function drawButton(ctx, b, sk) {
    var pressed = btnDown[b.id];
    ctx.save();
    if (b.id === 'dpad') {
      var r = b.r, arm = r * .40;
      ctx.beginPath();
      ctx.moveTo(b.x - arm, b.y - r); ctx.lineTo(b.x + arm, b.y - r);
      ctx.lineTo(b.x + arm, b.y - arm); ctx.lineTo(b.x + r, b.y - arm);
      ctx.lineTo(b.x + r, b.y + arm); ctx.lineTo(b.x + arm, b.y + arm);
      ctx.lineTo(b.x + arm, b.y + r); ctx.lineTo(b.x - arm, b.y + r);
      ctx.lineTo(b.x - arm, b.y + arm); ctx.lineTo(b.x - r, b.y + arm);
      ctx.lineTo(b.x - r, b.y - arm); ctx.lineTo(b.x - arm, b.y - arm);
      ctx.closePath();
      var g = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
      g.addColorStop(0, '#5b6070'); g.addColorStop(.5, '#3d414d'); g.addColorStop(1, '#282b33');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(b.x - arm * .5, b.y - r + 2, arm, 1.2);
      // 中心圆
      ctx.beginPath(); ctx.arc(b.x, b.y, arm * .62, 0, 6.3);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();
    } else if (b.r) {
      var gg = ctx.createLinearGradient(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
      if (pressed) { gg.addColorStop(0, '#2c3040'); gg.addColorStop(1, '#4a5060'); }
      else { gg.addColorStop(0, '#6b7182'); gg.addColorStop(.55, '#464c5b'); gg.addColorStop(1, '#2e323d'); }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3);
      ctx.fillStyle = gg; ctx.fill();
      ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      if (!pressed) {
        ctx.beginPath(); ctx.arc(b.x - b.r * .28, b.y - b.r * .34, b.r * .42, 0, 6.3);
        ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.fill();
      }
      ctx.fillStyle = 'rgba(235,240,255,.72)';
      ctx.font = '700 7.4px "Segoe UI",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y + .4);
    } else {
      rrect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
      ctx.fillStyle = pressed ? '#33384a' : '#4c5262'; ctx.fill();
      ctx.lineWidth = .6; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
      ctx.fillStyle = (SKIN[shellSkin] || SKIN.lite).text;
      ctx.font = '700 3.6px "Segoe UI",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y + b.h / 2 + 3.4);
    }
    ctx.restore();
  }

})(window.AA);
